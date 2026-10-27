import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { pool, q, q1, fijarTenant, qRaw1, qConTenant } from './db'
import { tenantActual } from './tenant'
import { AppError } from './errores'
import { datosContrato, expedienteContrato, type DatosContrato } from './contrato-expediente'
import { JOIN_PRINCIPAL } from './config-repo'
import { documentoATexto, fechaISO, generarContrato } from '@/lib/contrato-documento'
import { rutaLogo } from '@/lib/medios-url'
import type { PoolClient } from 'pg'

// ============================================================================
//  lib/server/firmas-repo.ts — Firma electrónica simple del contrato.
//
//  El punto crítico es QUÉ se firma. El documento se redacta a partir de datos
//  vivos, así que antes de pedir firmas se CONGELA: se renderiza el texto, se
//  guarda literal y se sella con SHA-256. A partir de ahí, cada firma queda
//  atada a ese hash.
//
//  Si el contrato (o el domicilio del arrendador, o cualquier dato que el texto
//  recite) cambia después, el hash actual deja de coincidir y las firmas se
//  muestran INVALIDADAS. Eso NO se guarda en una columna: se deriva comparando,
//  porque un flag escrito a mano solo captura los cambios que alguien recordó
//  marcar, y aquí el cambio puede venir de otra tabla.
// ============================================================================

export const HASH_ALGO = 'sha256'
export function hashDocumento(texto: string): string {
  return createHash(HASH_ALGO).update(texto, 'utf8').digest('hex')
}

// Huella de los DATOS que recita el contrato: el texto redactado sin fecha de
// firma, sellado. Es lo que ata el paso de revisión al envío: la pantalla
// enseña los datos con su huella, y `enviarAFirma` vuelve a calcularla con lo
// que hay en la base en ese instante. Si alguien cambió el domicilio de la
// empresa o la renta mientras la otra persona revisaba, no coinciden y no se
// congela nada: se firmaría algo que nadie validó.
//
// Sin la fecha a propósito: la página la calcula en UTC y el congelado en hora
// local, y con la fecha dentro la revisión fallaría sola unas horas al día.
export function huellaDatosContrato(datos: DatosContrato): string {
  return hashDocumento(documentoATexto(generarContrato({ ...datos, fechaFirma: null })))
}

const DIAS_VALIDEZ_TOKEN = 30

export type Parte = 'ARRENDADOR' | 'ARRENDATARIO'

export interface FirmaVista {
  parte: Parte
  estatus: 'PENDIENTE' | 'FIRMADA' | 'CANCELADA'
  nombreEsperado: string | null
  nombreFirmante: string | null
  firmadoEn: string | null
  ip: string | null
  userAgent: string | null
  documentoHash: string | null
  // Derivado: la firma existe pero el documento ya no es el que se firmó.
  invalidada: boolean
  // Solo la parte externa lo tiene, y solo se entrega a quien puede comprometer
  // a la empresa (permiso `crear` de arrendadores). Ver `firmasDeContrato`.
  token: string | null
  // La FECHA sí viaja siempre: dice hasta cuándo sirve el enlace, que es estado
  // del proceso, no la llave. Sin el token no abre nada.
  tokenExpiraEn: string | null
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null))

// ─── Archivar la versión firmada antes de anular sus firmas ─────────────────
// CONTRATO-FIRMADO-EDITABLE (23/10). Las DOS salidas que anulan firmas —editar
// un contrato firmado y volver a enviarlo a firma— pasan por aquí antes de
// borrar nada. Hasta hoy `enviarAFirma` hacía `delete from contrato_firmas` a
// secas y el expediente de evidencia de lo firmado se perdía sin rastro.
//
// Solo actúa si hay al menos una firma FIRMADA: un envío sin firmas no es una
// versión firmada, es un borrador, y archivarlo llenaría la lista de ruido.
// Devuelve el número de versión archivada, o null si no había nada que guardar.
//
// Va DENTRO de la transacción del llamador: si la edición o el reenvío revierte,
// el archivo también, y no puede quedar archivada una versión que siguió viva.
export async function archivarVersionFirmadaEnTx(
  client: PoolClient,
  args: {
    tenantId: string | null
    contratoId: string
    motivo: string | null
    usuario: { id: string; nombre: string } | null
  },
): Promise<number | null> {
  const { tenantId, contratoId } = args
  const { rows: firmadas } = await client.query(
    `select parte, nombre_esperado, nombre_firmante, firmado_en, ip, user_agent, documento_hash, usuario_id
       from contrato_firmas
      where contrato_id = $1 and tenant_id = $2 and estatus = 'FIRMADA'
      order by parte`,
    [contratoId, tenantId],
  )
  if (!firmadas.length) return null
  const { rows: c } = await client.query(
    `select documento_congelado, documento_hash, congelado_en
       from contratos_arrendamiento where id = $1 and tenant_id = $2 for update`,
    [contratoId, tenantId],
  )
  // Una firma FIRMADA lleva el hash de lo que firmó (`contrato_firma_evidencia_ck`)
  // y `editarContrato` solo descongela cuando no hay firmadas, así que el texto
  // tiene que estar. Si no está, archivar a medias sería peor que no dejar seguir.
  if (!c[0]?.documento_congelado || !c[0]?.documento_hash) {
    throw new AppError('No se encontró el texto firmado de este contrato; no se puede archivar su versión firmada.', 409)
  }
  const { rows: v } = await client.query(
    `insert into contrato_versiones_firmadas
       (tenant_id, contrato_id, version, documento_congelado, documento_hash, congelado_en,
        firmas, motivo, usuario_id, usuario_nombre)
     select $1, $2,
            coalesce((select max(version) from contrato_versiones_firmadas where contrato_id = $2), 0) + 1,
            $3, $4, $5, $6::jsonb, $7, $8, $9
     returning version`,
    [
      tenantId, contratoId, c[0].documento_congelado, c[0].documento_hash, c[0].congelado_en,
      JSON.stringify(
        firmadas.map((f) => ({
          parte: f.parte,
          nombreEsperado: f.nombre_esperado ?? null,
          nombreFirmante: f.nombre_firmante,
          firmadoEn: iso(f.firmado_en),
          ip: f.ip ?? null,
          userAgent: f.user_agent ?? null,
          documentoHash: f.documento_hash,
          usuarioId: f.usuario_id ?? null,
        })),
      ),
      args.motivo?.trim() || null, args.usuario?.id ?? null, args.usuario?.nombre ?? null,
    ],
  )
  return v[0].version as number
}

export interface VersionFirmada {
  version: number
  documentoHash: string
  congeladoEn: string | null
  archivadoEn: string
  motivo: string | null
  usuarioNombre: string | null
  firmas: {
    parte: Parte
    nombreFirmante: string
    firmadoEn: string | null
    ip: string | null
    userAgent: string | null
    documentoHash: string
  }[]
  // El texto exacto solo se entrega cuando se pide una versión concreta: son
  // varios KB por versión y la lista no lo necesita.
  documento?: string
}

export async function versionesFirmadas(contratoId: string): Promise<VersionFirmada[]> {
  const tenantId = await tenantActual()
  const rows = await q<Record<string, any>>(
    `select version, documento_hash, congelado_en, archivado_en, motivo, usuario_nombre, firmas
       from contrato_versiones_firmadas
      where contrato_id = $1 and tenant_id = $2
      order by version desc`,
    [contratoId, tenantId],
  )
  return rows.map((r) => ({
    version: r.version,
    documentoHash: r.documento_hash,
    congeladoEn: iso(r.congelado_en),
    archivadoEn: iso(r.archivado_en)!,
    motivo: r.motivo ?? null,
    usuarioNombre: r.usuario_nombre ?? null,
    firmas: r.firmas,
  }))
}

export async function versionFirmada(contratoId: string, version: number): Promise<VersionFirmada | null> {
  const tenantId = await tenantActual()
  const r = await q1<Record<string, any>>(
    `select version, documento_hash, documento_congelado, congelado_en, archivado_en, motivo, usuario_nombre, firmas
       from contrato_versiones_firmadas
      where contrato_id = $1 and tenant_id = $2 and version = $3`,
    [contratoId, tenantId, version],
  )
  if (!r) return null
  return {
    version: r.version,
    documentoHash: r.documento_hash,
    congeladoEn: iso(r.congelado_en),
    archivadoEn: iso(r.archivado_en)!,
    motivo: r.motivo ?? null,
    usuarioNombre: r.usuario_nombre ?? null,
    firmas: r.firmas,
    documento: r.documento_congelado,
  }
}

// ─── Congelar y abrir el proceso de firma ───────────────────────────────────
// Renderiza el documento, lo sella y crea las dos firmas pendientes. Es
// idempotente en el sentido de que RE-congelar reemplaza el texto y reinicia
// las firmas: es lo que ocurre cuando se corrigió algo y se vuelve a enviar.
//
// `huellaRevisada` es la huella de los datos que la persona vio en el paso de
// revisión (`huellaDatosContrato`). Si viene y no coincide con la de ahora, 409:
// los datos cambiaron mientras se revisaban. `usuario` firma el archivo de la
// versión firmada, si la había.
export async function enviarAFirma(
  contratoId: string,
  opts: { huellaRevisada?: string | null; usuario?: { id: string; nombre: string } | null } = {},
): Promise<{ token: string }> {
  const tenantId = await tenantActual()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)

    // La fecha de firma del documento pasa a ser la del congelado. Si siguiera
    // siendo "hoy", el texto —y por tanto el hash— cambiaría cada medianoche y
    // toda firma quedaría invalidada al día siguiente.
    const hoy = new Date()
    const fechaCongelado = fechaISO(hoy)!
    const doc = await expedienteContrato(contratoId, fechaCongelado)
    if (!doc) throw new AppError('El contrato no existe.', 404)
    if (opts.huellaRevisada != null) {
      const datos = await datosContrato(contratoId)
      if (!datos || huellaDatosContrato(datos) !== opts.huellaRevisada) {
        throw new AppError(
          'Los datos del contrato cambiaron mientras los revisabas. Recarga la página, revísalos otra vez y vuelve a enviarlo.',
          409,
        )
      }
    }
    if (doc.faltantes.length) {
      throw new AppError(
        `No se puede enviar a firma: faltan ${doc.faltantes.length} datos por capturar (${doc.faltantes.map((f) => f.etiqueta).join(', ')}).`,
        409,
      )
    }

    const texto = documentoATexto(doc)
    const hash = hashDocumento(texto)

    // Lo firmado se ARCHIVA antes de reenviar (23/10). El `delete` de abajo se
    // llevaba la evidencia de las firmas reales sin dejar copia, y el `update`
    // que sigue pisa el texto que firmaron: por eso va aquí, antes de los dos.
    await archivarVersionFirmadaEnTx(client, {
      tenantId, contratoId, motivo: 'Reenviado a firma', usuario: opts.usuario ?? null,
    })

    const { rowCount } = await client.query(
      `update contratos_arrendamiento
          set documento_congelado = $2, documento_hash = $3, congelado_en = now()
        where id = $1 and tenant_id = $4`,
      [contratoId, texto, hash, tenantId],
    )
    if (!rowCount) throw new AppError('El contrato no existe.', 404)

    // Se reinician las firmas: el texto es nuevo, lo firmado antes ya no aplica.
    // Lo firmado ya quedó archivado arriba, antes de pisar el texto.
    await client.query('delete from contrato_firmas where contrato_id = $1', [contratoId])

    const token = randomBytes(32).toString('hex')
    const nombres = await client.query(
      `select coalesce(rs.razon_social, a.nombre) as arrendador, a.email as correo,
              coalesce(ep.razon_social, t.razon_social, t.nombre)  as arrendatario
         from contratos_arrendamiento c
         left join arrendadores a on a.id = c.arrendador_id
         left join arrendador_razon_social rs on rs.id = c.razon_social_id
         join tenants t on t.id = c.tenant_id
         ${JOIN_PRINCIPAL}
        where c.id = $1`,
      [contratoId],
    )
    const n = nombres.rows[0] ?? {}

    await client.query(
      `insert into contrato_firmas (tenant_id, contrato_id, parte, nombre_esperado, correo, token, token_expira_en)
       values ($1, $2, 'ARRENDADOR', $3, $4, $5, now() + ($6 || ' days')::interval),
              ($1, $2, 'ARRENDATARIO', $7, null, null, null)`,
      [tenantId, contratoId, n.arrendador ?? null, n.correo ?? null, token, String(DIAS_VALIDEZ_TOKEN), n.arrendatario ?? null],
    )

    await client.query('commit')
    return { token }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// ─── Lectura ────────────────────────────────────────────────────────────────
//
// `incluirToken` NO es opcional a propósito. El token del arrendador es una
// credencial portadora: con él se firma desde la ruta pública, sin sesión. Por
// eso enviar a firma y firmar exigen permiso de `crear` («firmar compromete a la
// empresa»), pero ESTA lectura iba con `ver` y devolvía el token igualmente —de
// modo que un permiso de solo lectura entregaba la llave que se acababa de
// negar—. Quién puede tenerlo lo decide el llamador, que es quien conoce la
// sesión; hacerlo obligatorio fuerza a decidirlo en cada sitio nuevo en vez de
// heredar un default silencioso.
//
// Ver el estado de las firmas —quién firmó, cuándo, si quedó invalidada— sigue
// siendo de `ver`: es informacion del contrato, no una llave.
export async function firmasDeContrato(
  contratoId: string,
  opts: { incluirToken: boolean },
): Promise<{
  firmas: FirmaVista[]
  hashActual: string | null
  hashCongelado: string | null
  congeladoEn: string | null
}> {
  const tenantId = await tenantActual()
  const c = await q1<Record<string, any>>(
    `select documento_hash, congelado_en, documento_congelado
       from contratos_arrendamiento where id = $1 and tenant_id = $2`,
    [contratoId, tenantId],
  )
  if (!c) throw new AppError('El contrato no existe.', 404)

  // Hash del documento TAL COMO ESTÁ HOY, para compararlo con lo firmado. Se
  // renderiza con la fecha del congelado, no con la de hoy: si no, la única
  // diferencia sería el día y toda firma se invalidaría sola al amanecer.
  let hashActual: string | null = null
  if (c.congelado_en) {
    const doc = await expedienteContrato(contratoId, fechaISO(c.congelado_en)!)
    if (doc) hashActual = hashDocumento(documentoATexto(doc))
  }

  const rows = await q<Record<string, any>>(
    `select parte, estatus, nombre_esperado, nombre_firmante, firmado_en, ip, user_agent,
            documento_hash, token, token_expira_en
       from contrato_firmas where contrato_id = $1 order by parte`,
    [contratoId],
  )

  return {
    hashActual,
    hashCongelado: c.documento_hash ?? null,
    congeladoEn: iso(c.congelado_en),
    firmas: rows.map((r) => ({
      parte: r.parte,
      estatus: r.estatus,
      nombreEsperado: r.nombre_esperado ?? null,
      nombreFirmante: r.nombre_firmante ?? null,
      firmadoEn: iso(r.firmado_en),
      ip: r.ip ?? null,
      userAgent: r.user_agent ?? null,
      documentoHash: r.documento_hash ?? null,
      invalidada:
        r.estatus === 'FIRMADA' && !!hashActual && r.documento_hash !== hashActual,
      token: opts.incluirToken ? (r.token ?? null) : null,
      tokenExpiraEn: iso(r.token_expira_en),
    })),
  }
}

// ─── Firma de la parte INTERNA (con sesión) ─────────────────────────────────
export async function firmarComoArrendatario(args: {
  contratoId: string
  usuarioId: string
  nombre: string
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  const tenantId = await tenantActual()
  const c = await q1<Record<string, any>>(
    `select documento_hash from contratos_arrendamiento where id = $1 and tenant_id = $2`,
    [args.contratoId, tenantId],
  )
  if (!c?.documento_hash) {
    throw new AppError('El contrato todavía no se ha enviado a firma.', 409)
  }
  const r = await q(
    `update contrato_firmas
        set estatus = 'FIRMADA', firmado_en = now(), nombre_firmante = $3,
            documento_hash = $4, ip = $5, user_agent = $6, usuario_id = $7
      where contrato_id = $1 and tenant_id = $2
        and parte = 'ARRENDATARIO' and estatus = 'PENDIENTE'
      returning id`,
    [args.contratoId, tenantId, args.nombre.trim(), c.documento_hash, args.ip, args.userAgent, args.usuarioId],
  )
  if (!r.length) throw new AppError('Esa firma ya no está pendiente.', 409)
}

// ─── Firma de la parte EXTERNA (enlace público, sin sesión) ─────────────────
// Sin sesión no hay `app.tenant_id` fijado, y contrato_firmas es fail-closed:
// una consulta directa devolvería CERO filas. Se sigue el mismo patrón que el
// portal de campaña — una función SECURITY DEFINER resuelve el tenant a partir
// del token y el resto corre bajo él. El token de 32 bytes ES la autorización.
export async function firmaPorToken(token: string): Promise<{
  contratoId: string
  parte: Parte
  estatus: string
  nombreEsperado: string | null
  // NULL cuando el enlace expiró: ver abajo por qué se decide aquí.
  documento: string | null
  hash: string
  expirado: boolean
  yaFirmada: boolean
  // Membrete de la organización que ofrece el contrato. Va por la ruta pública
  // del logo y no como data URL: esta página la abre alguien de FUERA (el
  // arrendador no tiene cuenta), y meterle hasta 2 MB de base64 en el HTML es
  // peor que una petición más.
  logoUrl: string | null
} | null> {
  // Formato antes de tocar la BD: descarta sondeos con basura sin consultar.
  if (!/^[a-f0-9]{64}$/.test(token)) return null

  const t = await qRaw1<{ tenant: string | null }>(
    'select firma_tenant_por_token($1) as tenant',
    [token],
  )
  const tenantId = t?.tenant
  if (!tenantId) return null

  const rows = await qConTenant<Record<string, any>>(
    tenantId,
    `select f.contrato_id, f.parte, f.estatus, f.nombre_esperado, f.token_expira_en,
            c.documento_congelado, c.documento_hash
       from contrato_firmas f
       join contratos_arrendamiento c on c.id = f.contrato_id
      where f.token = $1`,
    [token],
  )
  const r = rows[0]
  if (!r || !r.documento_congelado) return null

  const expirado = !!r.token_expira_en && new Date(r.token_expira_en) < new Date()

  // El mismo contrato visto por dentro (/contrato/[id]) ya salía con membrete;
  // aquí no, y aquí es donde lo ve QUIEN LO FIRMA. Un contrato sin membrete no
  // es solo feo: es el documento con el que alguien se compromete, y no decía
  // de qué empresa venía.
  const cfg = await qConTenant<{ logo_token: string | null }>(
    tenantId,
    'select logo_token from config_negocio where tenant_id = $1',
    [tenantId],
  )

  return {
    logoUrl: rutaLogo(cfg[0]?.logo_token ?? null),
    contratoId: r.contrato_id,
    parte: r.parte,
    estatus: r.estatus,
    nombreEsperado: r.nombre_esperado ?? null,
    // El TEXTO no viaja si el enlace expiró. El token es una credencial
    // portadora: quien lo tenga puede leer el contrato entero —RFC, domicilio
    // fiscal, importes— y devolverlo igualmente convertía una vigencia de 30
    // días en acceso de lectura permanente. Firmar ya estaba cerrado
    // (`firmarPorToken` responde 410), pero leer no, y el dato sensible es el
    // texto, no la firma.
    //
    // La regla vive AQUÍ y no en cada consumidor porque hay DOS superficies
    // públicas —la página /firmar/[token], que renderiza en servidor, y
    // GET /api/firma/[token]— y una regla repetida en dos sitios es una regla
    // que en algún momento solo se aplica en uno. Lo mismo vale para el tercer
    // consumidor que venga.
    //
    // Ya FIRMADA sí sigue mostrándose mientras el enlace viva: quien acaba de
    // firmar necesita poder volver y guardar su copia, y la ventana de 30 días
    // es justamente el límite que se está haciendo valer.
    documento: expirado ? null : r.documento_congelado,
    // El hash se conserva: no es sensible —es un resumen, no el texto— y
    // `firmarPorToken` lo necesita para sellar la firma. No se expone en la API.
    hash: r.documento_hash,
    expirado,
    yaFirmada: r.estatus === 'FIRMADA',
  }
}

const MAX_NOMBRE_FIRMANTE = 240

export async function firmarPorToken(args: {
  token: string
  nombre: string
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  const f = await firmaPorToken(args.token)
  if (!f) throw new AppError('Enlace de firma no válido.', 404)
  if (f.expirado) throw new AppError('El enlace de firma expiró. Pide uno nuevo.', 410)
  if (f.yaFirmada) throw new AppError('Este contrato ya fue firmado con este enlace.', 409)
  const nombre = args.nombre.trim()
  if (nombre.length < 3) throw new AppError('Escribe tu nombre completo para firmar.', 400)
  // Y un tope por arriba, que no habia. Esta ruta es PUBLICA —la abre alguien de
  // fuera con una liga, sin sesion— y lo que escribe es `nombre_firmante` en el
  // registro de una firma electronica: NINGUNA ruta de la aplicacion lo corrige
  // despues, y sale impreso en el expediente del contrato. Un nombre de 5 000
  // caracteres se quedaba ahi para siempre.
  //
  // 240 es holgado a proposito: el doble de lo que mide un nombre legal largo de
  // verdad. Un tope que estorbe acaba quitandose entero, que es como se llego a
  // no tener ninguno.
  if (nombre.length > MAX_NOMBRE_FIRMANTE) {
    throw new AppError(
      `El nombre no puede pasar de ${MAX_NOMBRE_FIRMANTE} caracteres.`,
      400,
    )
  }

  const t = await qRaw1<{ tenant: string | null }>(
    'select firma_tenant_por_token($1) as tenant',
    [args.token],
  )
  if (!t?.tenant) throw new AppError('Enlace de firma no válido.', 404)

  // El `estatus = 'PENDIENTE'` en el WHERE es lo que hace la operación segura
  // ante doble clic o reenvío: la segunda pasada no actualiza nada.
  const filas = await qConTenant<{ id: string }>(
    t.tenant,
    `update contrato_firmas
        set estatus = 'FIRMADA', firmado_en = now(), nombre_firmante = $2,
            documento_hash = $3, ip = $4, user_agent = $5
      where token = $1 and estatus = 'PENDIENTE'
      returning id`,
    [args.token, nombre, f.hash, args.ip, args.userAgent],
  )
  if (!filas.length) throw new AppError('Esa firma ya no está pendiente.', 409)
}
