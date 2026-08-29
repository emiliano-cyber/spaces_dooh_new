import 'server-only'
import type { PoolClient } from 'pg'
import { pool, q, q1, fijarTenant } from './db'
import { tenantActual } from './tenant'
import { generarCalendarioDeContratoEnTx } from './arrendadores-repo'
import { exigirContratoCompleto } from './contratos-sitio'
import { spotsDeLaReserva } from '@/lib/spots-reserva'
import { folioCampana } from './folios'
import { esPantallaDigitalSql } from './pantalla-digital-sql'
import { rutaArteCreativo } from '@/lib/medios-url'
import { divisorDeComision } from '@/lib/data/derive'
import { AppError } from './errores'
import { ordenInvertido } from './fechas'

// ============================================================================
//  lib/server/campanas-repo.ts — Clientes, campañas, reservas + flujos
//  (reservar / confirmar / extender). Mapea filas Postgres ↔ tipos del front.
// ============================================================================

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string))

// IGV (Perú) = 18%. Importe de cada reserva = tarifa mensual prorrateada por
// días exactos: precio / 30 × días cubiertos (fecha_fin - fecha_inicio + 1).
// presupuesto_neto = suma prorrateada; presupuesto_bruto = neto + IGV (total).
// IVA por defecto (México). El IVA real se configura por cliente (clientes.iva_pct,
// default 16); este valor es solo el respaldo cuando no hay cliente.
export const IGV_PCT = 0.16

// TTL de una reserva TENTATIVA: días desde su creación tras los cuales caduca
// sola (barrerReservasVencidas la pasa a CANCELADA y libera el sitio). Al
// confirmar se limpia (expira_en = null → no caduca). Ajustable a futuro.
export const TTL_RESERVA_DIAS = 7

type Exec = { query: (sql: string, params?: unknown[]) => Promise<unknown> }
async function recalcularPresupuesto(exec: Exec | null, campanaId: string) {
  // El IVA sale del cliente de la campaña (clientes.iva_pct); si no hay, 16.
  const sql =
    `update campanas c
        set presupuesto_neto = sub.neto,
            presupuesto_bruto = round(
              sub.neto * (1 + coalesce((select iva_pct from clientes cl where cl.id = c.cliente_id), 16) / 100), 2)
       from (
         select coalesce(
           round(sum(precio * (fecha_fin - fecha_inicio + 1) / 30.0), 2), 0
         ) as neto
         from reservas where campana_id = $1
       ) sub
      where c.id = $1`
  if (exec) await exec.query(sql, [campanaId])
  else await q(sql, [campanaId])
}

function rowToCliente(r: any) {
  return {
    id: r.id, nombre: r.nombre, rfc: r.rfc,
    razonSocial: r.razon_social ?? null,
    regimenFiscal: r.regimen_fiscal ?? null,
    cpFiscal: r.cp_fiscal ?? null,
    usoCfdi: r.uso_cfdi ?? null,
    ivaPct: r.iva_pct != null ? Number(r.iva_pct) : 16,
    comisionAgenciaPct: r.comision_agencia_pct != null ? Number(r.comision_agencia_pct) : 0,
    agenciaId: r.agencia_id ?? null,
    tieneNegociacion: !!r.tiene_negociacion,
    negociacionValidada: !!r.negociacion_validada,
    negociacionNota: r.negociacion_nota ?? null,
    tipo: r.tipo,
    contacto: r.contacto ?? {}, activo: !!r.activo, creadoEn: iso(r.creado_en),
  }
}
export function rowToCampana(r: any) {
  return {
    id: r.id, folio: r.folio, nombre: r.nombre, clienteId: r.cliente_id,
    propuestaId: r.propuesta_id ?? null,
    agencia: r.agencia, marca: r.marca, tipoCampana: r.tipo_campana,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    presupuestoBruto: n(r.presupuesto_bruto), presupuestoNeto: n(r.presupuesto_neto),
    moneda: r.moneda, estadoComercial: r.estado_comercial,
    enviadaDominio: !!r.enviada_dominio, enviadaDominioEn: r.enviada_dominio_en ? iso(r.enviada_dominio_en) : null,
    validacionEstatus: r.validacion_estatus ?? 'PENDIENTE',
    validacionMotivo: r.validacion_motivo ?? null,
    validacionPor: r.validacion_por ?? null,
    validacionEn: r.validacion_en ? iso(r.validacion_en) : null,
    ocRecibida: !!r.oc_recibida, fotosComprobatorias: !!r.fotos_comprobatorias,
    reportePublicacion: !!r.reporte_publicacion, ocUrl: r.oc_url,
    contratoUrl: r.contrato_url ?? null,
    reportePublicacionUrl: r.reporte_publicacion_url, portalToken: r.portal_token,
    portalActivo: !!r.portal_activo, notas: r.notas, creadoEn: iso(r.creado_en),
  }
}
// Guarda (o quita) el contrato firmado del cliente en la campaña. Devuelve la
// campaña recompuesta, o null si no existe.
export async function guardarContratoCampana(campanaId: string, contratoUrl: string | null) {
  const rows = await q<any>(
    'update campanas set contrato_url = $2 where id = $1 returning *',
    [campanaId, contratoUrl],
  )
  return rows.length ? rowToCampana(rows[0]) : null
}

export function rowToReserva(r: any) {
  return {
    id: r.id, campanaId: r.campana_id, sitioId: r.sitio_id,
    fechaInicio: iso(r.fecha_inicio), fechaFin: iso(r.fecha_fin),
    precio: n(r.precio) ?? 0, tipoVenta: r.tipo_venta, estatus: r.estatus,
    spotsReservados: n(r.spots_reservados),
    expiraEn: r.expira_en ? iso(r.expira_en) : null,
    creativos: Array.isArray(r.creativos) ? r.creativos : [],
    creadoEn: iso(r.creado_en),
  }
}

// ─── Lecturas ───────────────────────────────────────────────────────────────
export async function listarClientes() {
  return (await q('select * from clientes where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToCliente)
}
export async function listarCampanas() {
  return (await q('select * from campanas where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToCampana)
}
export async function listarReservas() {
  return (await q('select * from reservas where tenant_id = $1 order by creado_en asc', [await tenantActual()])).map(rowToReserva)
}
// Alimenta `/api/estado`, que hidrata el shell ENTERO en cada carga de página.
//
// NO trae el arte, y esa es la razón de que exista esta nota. El arte se guarda
// incrustado (`archivo_url` es un `data:` URL y `codigo` es HTML en texto), así
// que devolver las filas tal cual metía las imágenes dentro del JSON: medido en
// producción, 2,977 kB en CUATRO creativos de G500, sobre una base que entera
// pesa 21 MB. Casi 3 MB viajando al navegador cada vez que alguien abre una
// pantalla, para pintar unos KPI que no usan ninguna de esas imágenes.
//
// Las consultas nunca fueron el problema —la más pesada tarda 0.077 ms—, así
// que optimizarlas o meterlas en una vista no habría cambiado nada: el coste
// era el PESO de la respuesta.
//
// `archivoUrl` pasa a apuntar a `/api/creativos/<id>/arte/`, que sirve lo mismo
// como archivo. El nombre del campo ya decía «Url»; ahora lo es de verdad. Los
// `<img>` y los `<iframe>` que lo consumen siguen funcionando sin tocarlos,
// porque una URL es una URL — solo cambia que el navegador la pide cuando la
// necesita, en paralelo y con caché.
//
// `codigo` va en null a propósito y no se omite: quien lo lea verá «no hay
// código» en vez de `undefined`, y quien necesite la fuente la pide a la ruta.
// Ojo: `formato` SÍ viaja, y es lo que ahora distingue una imagen de un HTML —
// antes eso se adivinaba mirando el principio del data URL.
//
// El portal público tiene su PROPIO mapeador (portal-repo) y sigue mandando el
// arte incrustado: es una sola campaña, sin sesión, y no pasa por aquí.
export async function listarCreatividades() {
  return (await q(
    // `es_imagen` se calcula EN POSTGRES y no en JavaScript: para saberlo hay
    // que mirar dentro de `codigo`, que pesa ~1 MB por fila, y traerlo aquí
    // para descartarlo sería volver a mover justo lo que este cambio quitó.
    // Postgres lo evalúa donde está el dato y devuelve un booleano.
    //
    // El patrón es el espejo de `imagenAHtml` (lib/creativo-html.ts): si aquella
    // cambia cómo escribe el `<img>`, esta condición deja de reconocerlo y las
    // miniaturas se vuelven a montar como documentos de 1 MB. Hay una prueba que
    // ata las dos.
    `select id, campana_id, nombre, formato, resolucion, estatus_validacion,
            rechazado_motivo, retirado_en, creado_en,
            (archivo_url like 'data:image%'
             or codigo ~ '<img[^>]+src="data:image/') as es_imagen
       from creatividades where tenant_id = $1 order by creado_en asc`,
    [await tenantActual()],
  )).map((r: any) => ({
    id: r.id, campanaId: r.campana_id, nombre: r.nombre,
    archivoUrl: rutaArteCreativo(r.id),
    // La miniatura tiene que saber si pintar <img> o <iframe>. Antes lo deducía
    // del contenido, que ya no viaja.
    esImagen: r.es_imagen === true,
    codigo: null,
    formato: r.formato, resolucion: r.resolucion, estatusValidacion: r.estatus_validacion,
    rechazadoMotivo: r.rechazado_motivo,
    retiradoEn: r.retirado_en ? iso(r.retirado_en) : null,
    creadoEn: iso(r.creado_en),
  }))
}

// Prefijo de folio POR TENANT: deriva del slug (o nombre) de la organización,
// en mayúsculas y solo alfanumérico (hasta 6). Ej.: slug "g500" → "G500",
// "rgb" → "RGB", "media-norte" → "MEDIAN". Así cada CRM tiene su propio prefijo.
async function prefijoTenant(tenantId: string | null): Promise<string> {
  const t = tenantId ? await q1<any>('select slug, nombre from tenants where id = $1', [tenantId]) : null
  const base = String(t?.slug || t?.nombre || 'CRM').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return base.slice(0, 6) || 'CRM'
}

// Folio de campaña: <PREFIJO_TENANT> + año + mes + día + consecutivo del día.
// p. ej. G50020260703004. Los tres dígitos eran ALEATORIOS: 1.000 combinaciones
// por día, o sea >50% de probabilidad de repetir a las ~37 campañas de la misma
// jornada, y como `campanas.folio` es UNIQUE la reserva moría enseñándole al
// vendedor el error crudo de Postgres. Ahora salen de un contador atómico
// (`lib/server/folios.ts`). Misma forma, sin lotería.

type TipoCampana = 'OOH' | 'DOOH' | 'HIBRIDA'

// Deriva el tipo de campaña según los sitios reservados: solo digitales → DOOH
// (pipeline sin imprenta), solo estáticas → OOH, mezcla → HIBRIDA.
// Nota: lo "digital" NO se marca en tipo_medio (espectacular/valla/…), sino en
// exhibicion ('digital'/'rotativo') o es_rotativo — así lo guarda el importador.
function derivarTipoCampana(digitales: boolean[]): TipoCampana {
  if (digitales.length === 0) return 'OOH'
  const n = digitales.filter(Boolean).length
  if (n === digitales.length) return 'DOOH'
  if (n === 0) return 'OOH'
  return 'HIBRIDA'
}

// ─── Clientes ───────────────────────────────────────────────────────────────
export async function crearCliente(input: { nombre: string; rfc?: string; tipo?: string; contacto?: unknown }) {
  const rows = await q(
    `insert into clientes (nombre, rfc, tipo, contacto, tenant_id) values ($1,$2,$3,$4,$5) returning *`,
    [input.nombre, input.rfc ?? null, input.tipo ?? 'DIRECTO', input.contacto ?? {}, await tenantActual()],
  )
  return rowToCliente(rows[0])
}

// ─── TTL: barrido de reservas tentativas vencidas ───────────────────────────
// Pasa a CANCELADA toda reserva TENTATIVA cuyo `expira_en` ya pasó y libera el
// inventario: devuelve slots a las digitales y regresa a DISPONIBLE las
// estáticas que se quedaron sin reserva activa. Se llama en cada lectura de
// estado (chokepoint) y antes de reservar, así que no requiere cron. Idempotente.
export async function barrerReservasVencidas(): Promise<number> {
  const tenantId = await tenantActual()
  if (!tenantId) return 0
  // Guard barato: si no hay vencidas, no abre transacción (cada lectura pasa por aquí).
  const hay = await q1<{ n: string }>(
    `select count(*)::text as n from reservas
      where tenant_id=$1 and estatus='TENTATIVA' and expira_en is not null and expira_en < now()`,
    [tenantId],
  )
  if (!hay || Number(hay.n) === 0) return 0

  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // 1) Reservas vencidas + flag de medio digital (para liberar inventario).
    const vencidas = (
      await client.query(
        `select r.id, r.sitio_id, r.campana_id, r.spots_reservados,
                ${esPantallaDigitalSql('s')} as digital
           from reservas r join sitios s on s.id = r.sitio_id
          where r.tenant_id=$1 and r.estatus='TENTATIVA'
            and r.expira_en is not null and r.expira_en < now()
          for update of r`,
        [tenantId],
      )
    ).rows as any[]

    const ids = vencidas.map((r) => r.id)
    await client.query(`update reservas set estatus='CANCELADA' where id = any($1::uuid[])`, [ids])

    // 2) Devolver slots a las digitales (acotado a total_spots) → DISPONIBLE.
    for (const r of vencidas) {
      if (r.digital && r.spots_reservados != null) {
        await client.query(
          `update sitios
              set spots_disponibles = least(
                    coalesce(total_spots, coalesce(spots_disponibles,0) + $2),
                    coalesce(spots_disponibles,0) + $2),
                  estatus_comercial = 'DISPONIBLE'
            where id=$1`,
          [r.sitio_id, r.spots_reservados],
        )
      }
    }

    // 3) Liberar estáticas que se quedaron sin ninguna reserva activa.
    const sitiosAfectados = [...new Set(vencidas.map((r) => r.sitio_id))]
    await client.query(
      `update sitios set estatus_comercial='DISPONIBLE'
        where id = any($1::uuid[])
          and estatus_comercial='RESERVADO'
          and not exists (
            select 1 from reservas r
             where r.sitio_id = sitios.id and r.estatus <> 'CANCELADA'
          )`,
      [sitiosAfectados],
    )

    // 4) Recalcular presupuesto de las campañas afectadas.
    for (const cid of [...new Set(vencidas.map((r) => r.campana_id))]) {
      await recalcularPresupuesto(client, cid)
    }

    await client.query('commit')
    return ids.length
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// ─── ADR 0008 · cupo de clientes por pantalla ───────────────────────────────
// Cupo efectivo = el de la pantalla; si no tiene, el default global. `null` en
// los dos = SIN LÍMITE, que es como nace la instalación: la regla se enciende
// capturando un número, nunca por desplegar código.
// El filtro por `tenant_id` es la SEGUNDA capa, la misma que el resto del repo
// aplica en toda operación por id; la primera (RLS sobre `config_negocio`) sigue
// ahí. Hace falta porque un `limit 1` sin `where` devolvería la fila de otra
// organización el día que alguien llame a esto fuera de una transacción con el
// tenant fijado — y ese fallo no da error, contesta en silencio (R2).
export async function cupoGlobalClientes(client: PoolClient): Promise<number | null> {
  const v = (
    await client.query(
      `select max_clientes_pantalla from config_negocio
        where tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
        limit 1`,
    )
  ).rows[0]?.max_clientes_pantalla
  return v != null ? Number(v) : null
}

export function cupoEfectivo(maxDelSitio: unknown, cupoGlobal: number | null): number | null {
  return maxDelSitio != null ? Number(maxDelSitio) : cupoGlobal
}

// ¿Este cliente sobra en esta pantalla? La decisión, aislada de la BD para
// poder probarla: un cliente que YA ocupa la pantalla nunca sobra (puede meter
// otra campaña mientras le queden slots); el cupo solo frena al cliente NUEVO.
export function excedeCupoClientes(opts: {
  cupo: number | null
  ocupantes: { cliente_id: string }[]
  clienteId: string | null | undefined
}): boolean {
  if (opts.cupo == null) return false // sin cupo configurado = sin límite
  const yaEsta = opts.clienteId != null && opts.ocupantes.some((o) => o.cliente_id === opts.clienteId)
  return !yaEsta && opts.ocupantes.length >= opts.cupo
}

// ─── Reservar: crea cliente+campaña si hace falta, reservas CONFIRMADAS (sin
//     tentativa) y consume el spot del sitio (digital: baja 1/12; fija: OCUPADO).
// ────────────────────────────────────────────────────────────────────────────
export async function reservar(input: {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
  // Tipo de campaña. Si se omite, se deriva del medio de los sitios reservados.
  tipoCampana?: TipoCampana
  // Spots a reservar por sitio digital (sitioId → cantidad). Descuenta disponibles.
  spotsPorSitio?: Record<string, number>
}) {
  // S1-1: no permitir rangos de fecha invertidos (fin anterior a inicio).
  if (new Date(input.fechaFin) < new Date(input.fechaInicio)) {
    throw new Error('La fecha fin no puede ser anterior a la fecha de inicio')
  }
  // Libera primero las tentativas vencidas: así el guard de colisión y los slots
  // digitales reflejan el inventario realmente disponible al momento de vender.
  await barrerReservasVencidas()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    let campanaId = input.campanaId

    if (!campanaId) {
      // Tipo manual si viene; si no, derivado del medio de los sitios.
      let tipoCampana = input.tipoCampana
      if (!tipoCampana) {
        const flags = (
          await client.query(
            `select (tipo_medio = 'PANTALLA_DIGITAL') as digital
               from sitios where id = any($1::uuid[])`,
            [input.sitioIds],
          )
        ).rows.map((r: any) => !!r.digital)
        tipoCampana = derivarTipoCampana(flags)
      }
      const tenantId = await tenantActual()
      // ADR 0008 · prerrequisito. Esto insertaba un cliente NUEVO en cada
      // reserva, sin mirar si ya existía: reservar tres veces para "Telcel"
      // dejaba tres fichas. Con eso, cualquier regla que cuente clientes
      // distintos por pantalla —el cupo— contaría fantasmas.
      // La coincidencia es EXACTA sobre el nombre normalizado (trim + minúsculas
      // + espacios colapsados), nunca aproximada: fusionar "Telcel Norte" con
      // "Telcel" sería peor que duplicar.
      const nombreCliente = (input.clienteNombre ?? 'Cliente nuevo').trim() || 'Cliente nuevo'
      const cli =
        (
          await client.query(
            `select id from clientes
              where tenant_id = $1
                and lower(regexp_replace(btrim(nombre), '\\s+', ' ', 'g')) =
                    lower(regexp_replace(btrim($2::text), '\\s+', ' ', 'g'))
              order by creado_en asc limit 1`,
            [tenantId, nombreCliente],
          )
        ).rows[0] ??
        (
          await client.query(`insert into clientes (nombre, tenant_id) values ($1,$2) returning id`, [
            nombreCliente, tenantId,
          ])
        ).rows[0]
      campanaId = (
        await client.query(
          `insert into campanas (folio, nombre, cliente_id, marca, fecha_inicio, fecha_fin, estado_comercial, tipo_campana, moneda, tenant_id)
           values ($1,$2,$3,$4,$5,$6,'COTIZACION',$7,coalesce((select moneda from tenants where id=$8),'MXN'),$8) returning id`,
          [await folioCampana(await prefijoTenant(tenantId), client), input.nombreCampana ?? `${input.clienteNombre ?? 'Campaña'} — nueva`, cli.id,
           input.clienteNombre ?? null, input.fechaInicio, input.fechaFin, tipoCampana, tenantId],
        )
      ).rows[0].id
    }

    // Guard de integridad: si la campaña destino nace de una propuesta, solo
    // admite sitios del set APROBADO de esa propuesta (las manuales no aplican).
    const cp = (await client.query('select propuesta_id from campanas where id=$1', [campanaId])).rows[0]
    if (cp?.propuesta_id) {
      const aprob = (
        await client.query(
          'select sitio_id from propuesta_items where propuesta_id=$1 and aprobado=true',
          [cp.propuesta_id],
        )
      ).rows.map((r: any) => r.sitio_id)
      const set = new Set(aprob)
      const fuera = input.sitioIds.filter((s) => !set.has(s))
      if (fuera.length) {
        throw new Error('Solo se pueden agregar sitios aprobados en la propuesta de esta campaña')
      }
    }

    // Default global del cupo de clientes (ADR 0008). Una lectura por
    // transacción, no una por pantalla.
    const cupoGlobal = await cupoGlobalClientes(client)

    for (const sitioId of input.sitioIds) {
      // FOR UPDATE bloquea la fila del sitio durante la transacción: dos reservas
      // concurrentes del MISMO sitio se serializan, así el chequeo de colisión /
      // conteo de slots y el INSERT son atómicos (cierra el doble-booking y la
      // sobreventa de slots — hallazgo A-1).
      const s = (
        await client.query(
          'select nombre, tarifa_mensual, spots_disponibles, total_spots, max_clientes, es_rotativo, exhibicion, tipo_medio from sitios where id=$1 for update',
          [sitioId],
        )
      ).rows[0]
      const precio = s ? Number(s.tarifa_mensual ?? 0) : 0
      // ADR 0003: no se vende un espacio sobre el que aún no consta qué se paga.
      // Va ANTES de las validaciones de disponibilidad para que el motivo real
      // salga primero: decirle al comercial "no hay slots" cuando el problema es
      // que falta el contrato lo manda a buscar en el sitio equivocado.
      await exigirContratoCompleto(client, { tenantId: await tenantActual(), sitioId })
      // S0-3: el tipo de medio manda. Solo PANTALLA_DIGITAL maneja slots; las
      // demás (espectacular, etc.) son estáticas = reserva exclusiva.
      const digital = !!s && s.tipo_medio === 'PANTALLA_DIGITAL'
      // Validación de colisión de fechas (sobre-reserva): una pantalla ESTÁTICA
      // no puede tener dos reservas activas que se solapen en el mismo periodo.
      // Las digitales se comparten por spots, así que se omiten aquí.
      if (!digital) {
        const choque = (
          await client.query(
            `select c.nombre as campana
               from reservas r join campanas c on c.id = r.campana_id
              where r.sitio_id = $1
                and r.estatus <> 'CANCELADA'
                and r.campana_id <> $4
                and r.fecha_inicio <= $3::date
                and r.fecha_fin    >= $2::date
              limit 1`,
            [sitioId, input.fechaInicio, input.fechaFin, campanaId],
          )
        ).rows[0]
        if (choque) {
          throw new Error(
            `"${s?.nombre ?? 'La pantalla'}" ya está reservada en esas fechas por la campaña "${choque.campana}". Elige otras fechas u otra pantalla.`,
          )
        }
      } else {
        // Digital: 1 slot = 1 campaña. Ocupada cuando el nº de campañas con
        // reserva activa alcanza total_spots (no depende del contador almacenado).
        //
        // ADR 0008: el conteo ahora SOLAPA FECHAS, igual que el de las estáticas
        // de arriba. Antes contaba toda reserva no cancelada desde el principio
        // de los tiempos, así que una campaña terminada en 2024 seguía ocupando
        // su slot para siempre y el inventario envejecía hacia "todo lleno".
        const tot = s?.total_spots != null ? Number(s.total_spots) : null
        const cnt = Number(
          (
            await client.query(
              `select count(distinct campana_id)::int as n from reservas
                where sitio_id=$1 and estatus <> 'CANCELADA' and campana_id <> $2
                  and fecha_inicio <= $4::date and fecha_fin >= $3::date`,
              [sitioId, campanaId, input.fechaInicio, input.fechaFin],
            )
          ).rows[0]?.n ?? 0,
        )
        if (tot != null && cnt >= tot) {
          throw new Error(
            `"${s?.nombre ?? 'La pantalla'}" ya no tiene slots disponibles en esas fechas (${cnt}/${tot} campañas). Elige otras fechas u otra pantalla.`,
          )
        }
      }

      // ─── ADR 0008 · Cupo de clientes de la pantalla ─────────────────────────
      // Segundo eje, independiente de los slots: cuántos ANUNCIANTES distintos
      // pueden compartir la pantalla. Aplica a digitales y a fijas (una fija con
      // cupo 1 no cambia de comportamiento: ya es exclusiva por fechas).
      //
      // Un cliente que YA está en la pantalla no consume cupo al volver: puede
      // meter otra campaña mientras le queden slots. El cupo solo frena al
      // cliente NUEVO. Va después del guard de slots a propósito: si no hay
      // slots, ese es el motivo real y es el que debe salir.
      const cupo = cupoEfectivo(s?.max_clientes, cupoGlobal)
      if (cupo != null) {
        const ocupacion = (
          await client.query(
            `select c.cliente_id, cl.nombre
               from reservas r
               join campanas c  on c.id  = r.campana_id
               join clientes cl on cl.id = c.cliente_id
              where r.sitio_id = $1
                and r.estatus <> 'CANCELADA'
                and r.campana_id <> $2
                and r.fecha_inicio <= $4::date and r.fecha_fin >= $3::date
              group by c.cliente_id, cl.nombre
              order by cl.nombre`,
            [sitioId, campanaId, input.fechaInicio, input.fechaFin],
          )
        ).rows as { cliente_id: string; nombre: string }[]

        const clienteDeLaCampana = (
          await client.query('select cliente_id from campanas where id=$1', [campanaId])
        ).rows[0]?.cliente_id

        if (excedeCupoClientes({ cupo, ocupantes: ocupacion, clienteId: clienteDeLaCampana })) {
          // El mensaje nombra a los ocupantes: es información comercial, pero de
          // este mismo tenant y el usuario ya la ve en Comercial. Sin ella el
          // comercial no sabe si pedir una excepción o cambiar de pantalla.
          throw new Error(
            `"${s?.nombre ?? 'La pantalla'}" ya llegó a su cupo de ${cupo} ${
              cupo === 1 ? 'cliente' : 'clientes'
            } en esas fechas (${ocupacion
              .map((o) => o.nombre)
              .join(', ')}). Elige otras fechas, otra pantalla, o sube el cupo de esta.`,
          )
        }
      }

      // Spots reservados: solo digitales y solo si se pidió una cantidad (acotada
      // a lo disponible). En estáticas queda null.
      const pedidos = input.spotsPorSitio?.[sitioId]
      const disp = s?.spots_disponibles != null ? Number(s.spots_disponibles) : null
      // Misma funcion que el camino de propuesta, y ese es el punto: eran dos
      // expresiones para la misma idea y por eso acabaron significando cosas
      // distintas. Con una sola no pueden volver a divergir.
      const spotsReservados = spotsDeLaReserva({ digital, pedidos, disponibles: disp })

      // En comercial NO hay reserva tentativa: al reservar se consume el spot de
      // inmediato (CONFIRMADA, sin TTL). La disponibilidad se ve por spots
      // (12/12, 8/12… o 0/12 = no disponible), no por un estado "tentativo".
      await client.query(
        `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus, spots_reservados, expira_en, tenant_id)
         values ($1,$2,$3,$4,$5,'FIXED_PKG','CONFIRMADA',$6, null, $7)`,
        [campanaId, sitioId, input.fechaInicio, input.fechaFin, precio, spotsReservados, await tenantActual()],
      )

      if (digital) {
        // 1 slot = 1 campaña. Estatus por conteo de campañas activas: OCUPADO al
        // llenar los slots, si no DISPONIBLE. El nº de disponibles se calcula al
        // leer (listarSitios = total − campañas activas), sin contador que drifte.
        //
        // ADR 0008: el conteo mira fechas (`fecha_fin >= current_date`), igual
        // que el de `listarSitios`. Con el conteo histórico, una pantalla que
        // llenó sus slots una vez se quedaba en OCUPADO para siempre aunque esas
        // campañas hubieran terminado — dos criterios distintos para el mismo
        // dato, que es justo el patrón que produjo el hallazgo A-2.
        await client.query(
          `update sitios s set estatus_comercial = (case
              when (select count(distinct campana_id) from reservas r
                     where r.sitio_id = s.id and r.estatus <> 'CANCELADA'
                       and r.fecha_fin >= current_date)
                   >= coalesce(s.total_spots, 0) then 'OCUPADO'
              else 'DISPONIBLE' end)::est_comercial
            where s.id=$1`,
          [sitioId],
        )
      } else {
        // Fija: 1 solo espacio; al reservar queda OCUPADO (ya no "reservado" tentativo).
        await client.query(`update sitios set estatus_comercial='OCUPADO' where id=$1`, [sitioId])
      }
    }
    await recalcularPresupuesto(client, campanaId!)
    // Releer ANTES del commit: set_config('app.tenant_id', …, true) es
    // TRANSACTION-local, así que tras el commit el GUC ya no está y la RLS
    // fail-closed (Bloque B) devolvería 0 filas.
    const camp = (await client.query('select * from campanas where id=$1', [campanaId])).rows[0]
    await client.query('commit')
    return rowToCampana(camp)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// ─── Propuesta → campaña ─────────────────────────────────────────────────────
// Error de regla de negocio (propuesta no aprobada / ya generada) → 409.
export class PropuestaCampanaError extends Error {}

// Set de sitios APROBADOS de una propuesta (para el guard de integridad).
export async function sitiosAprobadosDePropuesta(propuestaId: string): Promise<Set<string>> {
  const rows = await q<{ sitio_id: string }>(
    'select sitio_id from propuesta_items where propuesta_id=$1 and aprobado=true',
    [propuestaId],
  )
  return new Set(rows.map((r) => r.sitio_id))
}

// Genera una campaña a partir de una propuesta APROBADA: hereda cliente, fechas
// (min/max de los items) y SOLO los sitios aprobados con su precio NETO de
// comisión (item.precio × divisor). Idempotente. La campaña nace CONFIRMADA
// (cliente comprometió), reservas CONFIRMADA, sitios RESERVADO hasta la OC.
// Devuelve además `yaExistia` para que el llamador distinga una CREACIÓN de un
// no-op idempotente. Sin esa señal, el route registraba en bitácora y notificaba
// también cuando no se había creado nada: la auditoría QA (A-5) vio dos entradas
// "Generó campaña desde propuesta" para una sola campaña y lo leyó como una
// duplicación de datos que nunca ocurrió.
export async function generarCampanaDesdePropuesta(
  propuestaId: string,
): Promise<{ campana: ReturnType<typeof rowToCampana>; yaExistia: boolean }> {
  const prop = await q1<any>('select * from propuestas where id=$1', [propuestaId])
  if (!prop) throw new PropuestaCampanaError('Propuesta no encontrada')
  if (prop.estatus !== 'APROBADA') {
    throw new PropuestaCampanaError('La propuesta no está aprobada; no se puede generar la campaña')
  }
  if (!prop.cliente_id) {
    throw new PropuestaCampanaError('La propuesta no tiene cliente asignado; no se puede facturar la campaña')
  }

  const items = await q<any>(
    'select * from propuesta_items where propuesta_id=$1 and aprobado=true order by creado_en asc',
    [propuestaId],
  )
  if (!items.length) throw new PropuestaCampanaError('La propuesta no tiene sitios aprobados')

  const divisor = divisorDeComision(prop.comision_pct)
  const factorDesc = 1 - Number(prop.descuento_pct ?? 0) / 100
  // S0-1: economía congelada en la aceptación. Si existe, la campaña/factura la
  // heredan literalmente (nadie recalcula desde tarifas de lista).
  const snap = (prop.snapshot_economico ?? null) as any
  const netoDeSnap = new Map<string, number>(
    (snap?.porSitio ?? []).map((x: any) => [x.sitioId as string, Number(x.neto)]),
  )
  const fechaInicio = items.map((i) => iso(i.fecha_inicio)).sort()[0]
  const fechaFin = items.map((i) => iso(i.fecha_fin)).sort().at(-1) as string

  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // A-1: idempotencia DENTRO de la transacción, respaldada por el índice único
    // campanas_propuesta_uq. Si ya se generó la campaña de esta propuesta, se
    // devuelve la existente (no duplica). En carrera con otra generación
    // simultánea, la segunda rebota en el INSERT con 23505 y se resuelve abajo.
    const ya = (await client.query('select * from campanas where propuesta_id=$1', [propuestaId])).rows[0]
    if (ya) {
      await client.query('commit')
      return { campana: rowToCampana(ya), yaExistia: true }
    }
    // tipo de campaña derivado del medio de los sitios aprobados
    // Se pide `id` y `spots_disponibles` ademas de la bandera: hasta el
    // 2026-08-27 esta consulta solo traia un arreglo de banderas para
    // `derivarTipoCampana`, asi que al insertar la reserva no se sabia si ESE
    // sitio era digital ni cuantos slots le quedaban — y de ahi salia el
    // `spots_reservados` equivocado (DATA-02).
    const filasSitio = (
      await client.query(
        `select id, (tipo_medio='PANTALLA_DIGITAL') as digital, spots_disponibles
           from sitios where id = any($1::uuid[])`,
        [items.map((i) => i.sitio_id)],
      )
    ).rows as { id: string; digital: boolean; spots_disponibles: number | null }[]
    const porSitio = new Map(filasSitio.map((r) => [r.id, r]))
    const tipoCampana = derivarTipoCampana(filasSitio.map((r) => !!r.digital))

    // La campaña hereda el nombre de la agencia de la propuesta (si la lleva).
    const ag = prop.agencia_id
      ? (await client.query('select nombre from clientes where id=$1', [prop.agencia_id])).rows[0]
      : null
    const agenciaNombre = ag?.nombre ?? null

    const campanaId = (
      await client.query(
        `insert into campanas (folio, nombre, cliente_id, agencia, fecha_inicio, fecha_fin, estado_comercial, tipo_campana, propuesta_id, moneda, tenant_id)
         values ($1,$2,$3,$4,$5,$6,'CONFIRMADA',$7,$8,coalesce((select moneda from tenants where id=$9),'MXN'),$9) returning id`,
        [await folioCampana(await prefijoTenant(await tenantActual()), client), prop.nombre, prop.cliente_id, agenciaNombre, fechaInicio, fechaFin, tipoCampana, propuestaId, await tenantActual()],
      )
    ).rows[0].id

    for (const it of items) {
      // Precio por sitio = NETO del snapshot congelado (o, sin snapshot, el
      // cálculo lista × (1−descuento) × (1−comisión) como respaldo).
      const netoSitio =
        netoDeSnap.get(it.sitio_id) ?? Math.round(Number(it.precio) * factorDesc * divisor)
      // La reserva hereda la contratación por tiempo del ítem (unidad, cantidad
      // de periodos y programación de spots), para que la campaña conserve cómo
      // se contrató y no solo el precio.
      await client.query(
        `insert into reservas
           (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus,
            spots_reservados, unidad, cantidad, tarifa_unitaria, spots_por_dia, tenant_id)
         values ($1,$2,$3,$4,$5,'FIXED_PKG','CONFIRMADA',$6,$7,$8,$9,$10,$11)`,
        [
          campanaId, it.sitio_id, iso(it.fecha_inicio), iso(it.fecha_fin), netoSitio,
          // SLOTS que la reserva retiene — NO `spots_por_dia`, que es la
          // programacion y va en su propia columna dos lineas mas abajo.
          // Escribir el mismo valor en las dos era DATA-02: `spots_por_dia` es
          // opcional, asi que una propuesta mensual normal dejaba
          // `spots_reservados` en null, y `reparto-creativos.ts:51-68` lee ese
          // null como «es una lona».
          spotsDeLaReserva({
            digital: !!porSitio.get(it.sitio_id)?.digital,
            pedidos: it.spots_por_dia,
            disponibles: porSitio.get(it.sitio_id)?.spots_disponibles ?? null,
          }),
          it.unidad ?? 'mensual', it.cantidad ?? 1,
          it.tarifa_unitaria ?? null, it.spots_por_dia ?? null, await tenantActual(),
        ],
      )
      // sitios RESERVADO hasta la OC (no OCUPADO todavía)
      await client.query(`update sitios set estatus_comercial='RESERVADO' where id=$1`, [it.sitio_id])

      // ADR 0001: vender una pantalla es el indicio de que debe existir un
      // contrato con su propietario. Si no hay ninguno, se abre uno INCOMPLETO
      // para que el pendiente sea visible en Arrendadores en vez de quedar como
      // un costo de renta cero que infla el margen de esta campaña.
      // No pisa contratos existentes (de cualquier estatus, incluido el
      // histórico vencido): ahí el dato ya existe. La unicidad la respalda el
      // índice parcial `contratos_sitio_incompleto_uq`, así que un reintento o
      // una carrera no dejan dos pendientes del mismo sitio.
      //
      // La cobertura se busca en los DOS anclajes posibles, y el orden importa:
      // un predio tiene UN contrato que comparten todas sus pantallas, así que
      // vender la segunda cara de un predio ya contratado NO debe abrir nada.
      // Mirando solo `sitio_id` —como se hacía antes— el contrato del predio era
      // invisible aquí y cada cara vendida estrenaba su propio contrato: un
      // duplicado que el índice `contratos_predio_activo_uq` tampoco frena,
      // porque nace con `predio_id` NULL. El resultado eran alertas de «contrato
      // incompleto» sobre pantallas que sí estaban cubiertas y, si alguien las
      // completaba con importe, renta pagada dos veces al mismo propietario.
      // El contrato nace cubriendo el periodo que se vendió: de la fecha de
      // inicio a la de fin del ítem. Así el pendiente ya dice CUÁNTO tiempo hay
      // que cubrir, no solo desde cuándo.
      //
      // Si la propuesta capturó la renta (arrendador + importe + periodicidad),
      // nace COMPLETO y vigente: el costo se conoce desde la venta y el margen
      // deja de salir inflado. Si falta cualquiera de los tres, nace INCOMPLETO
      // como hasta ahora — el CHECK `contrato_completo_ck` exige los cuatro
      // datos para cualquier estatus que afirme un acuerdo real.
      const rentaCompleta =
        it.renta_monto != null && it.renta_periodicidad != null && it.renta_arrendador_id != null
      await client.query(
        `insert into contratos_arrendamiento
           (id, sitio_id, arrendador_id, fecha_inicio, fecha_fin, monto_renta,
            periodicidad, moneda, auto_renovable, estatus, tenant_id)
         select gen_random_uuid(), $1, $5, $2, $4, $6, $7::periodicidad_pago,
                coalesce((select moneda from tenants where id=$3),'MXN'),
                false, $8::est_contrato, $3
          where not exists (
                  select 1 from contratos_arrendamiento c
                   where -- contrato propio de esta pantalla (pantalla suelta).
                         -- Cuenta en CUALQUIER estatus, como hasta ahora: si ya
                         -- hay una ficha del propietario, el dato existe.
                         (c.predio_id is null and c.sitio_id = $1)
                         -- o el contrato del predio al que pertenece, que la
                         -- cubre junto con sus hermanas. Si la pantalla no tiene
                         -- predio, la comparación es NULL y no coincide con nada.
                         -- Aquí sí se excluye CANCELADO: un acuerdo cancelado no
                         -- cubre nada, y sin este filtro las pantallas hermanas
                         -- de un predio con contrato cancelado se quedarían sin
                         -- el pendiente que las hace visibles en Arrendadores.
                      or (c.estatus <> 'CANCELADO'
                          and c.predio_id = (select predio_id from sitios where id = $1))
                )
         on conflict do nothing`,
        [
          it.sitio_id, iso(it.fecha_inicio), await tenantActual(), iso(it.fecha_fin),
          rentaCompleta ? it.renta_arrendador_id : null,
          rentaCompleta ? it.renta_monto : null,
          rentaCompleta ? it.renta_periodicidad : null,
          // VIGENTE y no POR_VENCER/VENCIDO: el barrido de mantenimiento
          // (recomputarEstatusArrendadores) lo ajusta contra la fecha de hoy en
          // la primera carga, así que no hay que duplicar aquí esa regla.
          rentaCompleta ? 'VIGENTE' : 'INCOMPLETO',
        ],
      )
      // Si el pendiente ya existía de una venta anterior y esta campaña va más
      // allá, se estira para seguir cubriendo lo vendido. Solo se toca el
      // marcador INCOMPLETO: un contrato REAL jamás se extiende solo, porque
      // eso sería inventar los términos pactados con el propietario. Ese caso
      // lo denuncia la alerta «El contrato no cubre la campaña».
      await client.query(
        `update contratos_arrendamiento
            set fecha_fin = $2::date
          where sitio_id = $1 and estatus = 'INCOMPLETO'
            and (fecha_fin is null or fecha_fin < $2::date)`,
        [it.sitio_id, iso(it.fecha_fin)],
      )

      // ADR 0003: la pantalla no se vende con el contrato incompleto. El guard va
      // DESPUÉS del bloque de arriba a propósito: si la propuesta capturó la renta
      // (arrendador + importe + periodicidad), ese insert acaba de crear un
      // contrato VIGENTE y la venta debe pasar. Comprobarlo antes bloquearía justo
      // el caso que el sistema resuelve solo.
      await exigirContratoCompleto(client, { tenantId: await tenantActual(), sitioId: it.sitio_id })

      // Calendario de pagos de la renta. La campaña nace SIN PAGO REGISTRADO:
      // se crean las cuotas que tocan según la periodicidad y ninguna se marca
      // como pagada — eso solo ocurre cuando alguien lo registra a mano en
      // Arrendadores o Finanzas. Idempotente (on conflict) y silencioso si el
      // contrato aún está incompleto: sin importe no hay cuotas que calcular.
      if (rentaCompleta) {
        // El contrato que gobierna esta pantalla, con la MISMA regla que usa el
        // P&L (`contratoVigentePorSitio` en lib/data/derive.ts): primero el que
        // está activo, y entre ellos manda el del predio; si el predio no tiene,
        // el propio de la pantalla. El orden por estatus no es cosmético: un
        // predio puede arrastrar contratos vencidos históricos, y sin él se
        // generarían las cuotas del contrato muerto en vez de las del vigente.
        // El `limit 1` de antes iba sin `order by` y sobre `sitio_id` a secas:
        // no encontraba el contrato del predio y, con varias filas, elegía una
        // cualquiera.
        const { rows: cRows } = await client.query(
          `select * from contratos_arrendamiento c
            where c.estatus <> 'CANCELADO'
              and ( (c.predio_id is null and c.sitio_id = $1)
                 or c.predio_id = (select predio_id from sitios where id = $1) )
            order by (c.estatus in ('VIGENTE','POR_VENCER','RENOVADO')) desc,
                     (c.predio_id is not null) desc,
                     c.creado_en desc
            limit 1`,
          [it.sitio_id],
        )
        if (cRows[0]) await generarCalendarioDeContratoEnTx(client, cRows[0])
      }
    }
    // La factura debe reproducir EXACTAMENTE lo que aceptó el cliente: base
    // (lista − descuento) + IVA, SIN prorrateo (la propuesta es un paquete, no
    // una renta mensual). Por eso fijamos el presupuesto desde la propuesta y NO
    // usamos recalcularPresupuesto (que prorratearía y usaría el neto por-sitio).
    // Presupuesto de la campaña = snapshot congelado (base sin IVA + total con
    // IVA). Sin snapshot, respaldo con el cálculo directo (lista − descuento) + IVA.
    let base: number
    let bruto: number
    if (snap) {
      base = Number(snap.base)
      bruto = Number(snap.total)
    } else {
      base = Math.round(items.reduce((s, it) => s + Number(it.precio) * factorDesc, 0) * 100) / 100
      const ivaPct = Number(
        (await client.query('select coalesce(iva_pct, 16) as iva from clientes where id=$1', [prop.cliente_id])).rows[0]?.iva ?? 16,
      )
      bruto = Math.round(base * (1 + ivaPct / 100) * 100) / 100
    }
    await client.query('update campanas set presupuesto_neto=$2, presupuesto_bruto=$3 where id=$1', [campanaId, base, bruto])
    // Releer ANTES del commit: el GUC app.tenant_id es TRANSACTION-local y tras
    // el commit la RLS fail-closed (Bloque B) devolvería 0 filas.
    const creada = (await client.query('select * from campanas where id=$1', [campanaId])).rows[0]
    await client.query('commit')
    return { campana: rowToCampana(creada), yaExistia: false }
  } catch (e) {
    await client.query('rollback')
    // A-1: carrera con otra generación simultánea de la MISMA propuesta. La
    // campaña ya existe (23505 sobre campanas_propuesta_uq): se relee y se
    // devuelve (idempotente), no es un error para el usuario.
    if ((e as { code?: string })?.code === '23505') {
      const existente = await q1<any>('select * from campanas where propuesta_id=$1', [propuestaId])
      if (existente) return { campana: rowToCampana(existente), yaExistia: true }
    }
    throw e
  } finally {
    client.release()
  }
}

// ─── Confirmar: reservas TENTATIVA→CONFIRMADA, sitios→OCUPADO, campaña→CONFIRMADA
export async function confirmarReserva(campanaId: string) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    const sitios = (
      await client.query(
        `select sitio_id from reservas where campana_id=$1 and estatus='TENTATIVA'`,
        [campanaId],
      )
    ).rows.map((r) => r.sitio_id)
    await client.query(
      `update reservas set estatus='CONFIRMADA', expira_en=null where campana_id=$1 and estatus='TENTATIVA'`,
      [campanaId],
    )
    if (sitios.length) {
      // Estáticas → OCUPADO al confirmar. Digitales → OCUPADO solo si ya no les
      // quedan slots; si aún tienen, siguen DISPONIBLE para más campañas.
      await client.query(
        `update sitios set estatus_comercial='OCUPADO'
           where id = any($1::uuid[])
             and (
               not (es_rotativo or exhibicion in ('digital','rotativo') or tipo_medio='PANTALLA_DIGITAL')
               or coalesce(spots_disponibles, 0) <= 0
             )`,
        [sitios],
      )
    }
    await client.query(`update campanas set estado_comercial='CONFIRMADA' where id=$1`, [campanaId])
    await recalcularPresupuesto(client, campanaId)
    // Releer ANTES del commit: el GUC app.tenant_id es TRANSACTION-local y tras
    // el commit la RLS fail-closed (Bloque B) devolvería 0 filas — aquí eso no
    // reventaba, devolvía null en silencio.
    const camp = (await client.query('select * from campanas where id=$1', [campanaId])).rows[0]
    await client.query('commit')
    return camp ? rowToCampana(camp) : null
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// ─── Extender campaña (fechas) ──────────────────────────────────────────────
// Extender NO puede acortar. Hasta el barrido del 26/08 esta funcion escribia la
// fecha que le dieran sin mirar la que la campana ya tenia, y con eso una fecha
// ANTERIOR recortaba la campana Y reescribia la fecha de fin de TODAS sus
// reservas de paso. La accion se llama «extender», nadie esta pidiendo recortar,
// y el inventario que esas reservas ocupaban se liberaba sin que nadie lo
// decidiera; si ademas quedaba por debajo de `fecha_inicio`, la campana salia de
// todos los conteos que filtran por rango.
//
// La comprobacion vive aqui y no en el controlador porque el controlador no
// conoce la fecha EFECTIVA: solo ve la que le mandan. Mismo reparto que UX-01 en
// los contratos.
export async function extenderCampana(campanaId: string, nuevaFechaFin: string) {
  const tenantId = await tenantActual()
  // `and tenant_id` como segunda capa sobre la RLS, aqui y en los dos updates.
  const actual = await q<{ fecha_fin: unknown }>(
    'select fecha_fin from campanas where id=$1 and tenant_id=$2',
    [campanaId, tenantId],
  )
  if (!actual[0]) return null
  const finActual = String(iso(actual[0].fecha_fin) ?? '').slice(0, 10)

  // `ordenInvertido` compara por CALENDARIO. Como texto, '2026-9-1' sale MAYOR
  // que '2026-10-01' y un acortamiento real pasaria: ese fallo ya se pago una
  // vez en el alta de contrato.
  if (finActual && ordenInvertido(finActual, nuevaFechaFin)) {
    throw new AppError(
      `Esta campana llega hasta el ${finActual}. Extender solo puede alargarla: ` +
        `elige esa fecha o una posterior.`,
      400,
    )
  }

  await q(`update campanas set fecha_fin=$2 where id=$1 and tenant_id=$3`, [campanaId, nuevaFechaFin, tenantId])
  await q(`update reservas set fecha_fin=$2 where campana_id=$1 and tenant_id=$3`, [campanaId, nuevaFechaFin, tenantId])
  await recalcularPresupuesto(null, campanaId)
  const rows = await q('select * from campanas where id=$1 and tenant_id=$2', [campanaId, tenantId])
  return rows[0] ? rowToCampana(rows[0]) : null
}

// ─── Validación de publicación ──────────────────────────────────────────────
// Error de regla de negocio (estado inválido / sin anuncios) → el route lo
// mapea a 409.
export class ValidacionError extends Error {}

// Una campaña puede enviarse al dominio en cualquier estado salvo cancelada
// (no tiene sentido publicar en el CMS algo cancelado).
const ESTADOS_NO_ENVIABLES = new Set(['CANCELADA'])

// Paso 1: envía la campaña al dominio/CMS. Deja la validación en PENDIENTE para
// que un revisor verifique la información de los anuncios antes de publicar.
// Requiere campaña comprometida y, en medios digitales (DOOH/HÍBRIDA), al menos
// un creativo cargado (es la "información de los anuncios" a verificar).
// ─── M14 / INC-02 · ninguna pantalla digital se queda sin pieza ─────────────
//
// Tener un creativo cargado NO es tenerlo asignado a cada pantalla.
// `reservas.creativos` es lo que dice QUÉ se exhibe en CADA slot, y estaba sin
// comprobar: la auditoría encontró campañas Publicadas y Completadas con todos
// sus slots en «Sin asignar». Eso rompe la trazabilidad creativo→pantalla, y
// sin ella el reporte al cliente no puede probar qué se exhibió — que es
// justamente lo que se le vende.
//
// Se exige DOS VECES, y no es redundante: al enviar al dominio y otra vez al
// aprobar. Entre las dos hay una revisión humana que puede tardar días, y en
// medio alguien puede rechazar un creativo (que se desasigna solo) o repartir
// de nuevo. Desde que la publicación manda a cada pantalla LO SUYO, un hueco
// aquí ya no significa «sale de más»: significa que esa pantalla contratada se
// queda a oscuras.
//
// Solo se exige a las pantallas DIGITALES: en una HÍBRIDA las fijas llevan lona
// y su trazabilidad va por la OT de montaje y sus fotos, no por aquí.
//
// El `case` sobre `jsonb_typeof` no es adorno: `jsonb_array_length` LANZA si el
// valor no es un arreglo, y entonces esto devolvería un 500 en vez de un
// mensaje. La columna es `not null default '[]'` y hoy las filas son todas
// arreglos, pero el mapper de este mismo archivo se defiende con
// `Array.isArray(r.creativos) ? … : []`, así que no me fío más que él. Un valor
// malformado cuenta como «sin asignar», que es lo correcto.
//
// Cuenta como asignada solo si lo asignado sigue APROBADO: un slot cuya única
// pieza se rechazó después está tan vacío como uno que nunca se llenó.
async function exigirTodaPantallaConCreativo(campanaId: string, accion: string): Promise<void> {
  const sinAsignar = await q<{ nombre: string }>(
    `select s.nombre
       from reservas r
       join sitios s on s.id = r.sitio_id
      where r.campana_id = $1
        and r.estatus <> 'CANCELADA'
        and ${esPantallaDigitalSql('s')}
        and not exists (
          select 1
            from jsonb_array_elements(
                   case when jsonb_typeof(r.creativos) = 'array' then r.creativos
                        else '[]'::jsonb end) e
            join creatividades cr
                   on cr.id = (e->>'creatividadId')::uuid
                  and cr.campana_id = r.campana_id
                  and cr.estatus_validacion = 'VALIDADA'
                  and cr.retirado_en is null)
      order by s.nombre`,
    [campanaId],
  )
  if (sinAsignar.length === 0) return
  // Se nombran las pantallas: «asigna los creativos» a secas obliga a buscarlas
  // una por una en una campaña de doce.
  const lista = sinAsignar.map((r) => r.nombre).join(', ')
  throw new ValidacionError(
    `Hay pantallas sin creativo aprobado asignado: ${lista}. Asígnalo en Creativos antes de ${accion}.`,
  )
}

export async function enviarADominio(campanaId: string) {
  const camp = await q1<any>('select * from campanas where id=$1', [campanaId])
  if (!camp) return null
  if (ESTADOS_NO_ENVIABLES.has(camp.estado_comercial)) {
    throw new ValidacionError(
      'No se puede enviar al dominio una campaña cancelada',
    )
  }
  if (camp.tipo_campana === 'DOOH' || camp.tipo_campana === 'HIBRIDA') {
    const creas = await q1<any>(
      'select count(*)::int as n from creatividades where campana_id=$1',
      [campanaId],
    )
    if (!creas || creas.n === 0) {
      throw new ValidacionError(
        'La campaña no tiene anuncios (creativos) que enviar al dominio',
      )
    }
    // M14: tener un creativo cargado NO es tenerlo asignado a cada pantalla.
    // `reservas.creativos` es lo que dice QUÉ se exhibe en CADA slot, y estaba
    // sin comprobar: la auditoría encontró campañas Publicadas y Completadas
    // con todos sus slots en «Sin asignar». Eso rompe la trazabilidad
    // creativo→pantalla, y sin ella el reporte al cliente no puede probar qué
    // se exhibió — que es justamente lo que se le vende.
    //
    // Solo se exige a las pantallas DIGITALES: en una HÍBRIDA las fijas llevan
    // lona y su trazabilidad va por la OT de montaje y sus fotos, no por aquí.
    //
    await exigirTodaPantallaConCreativo(campanaId, 'enviar al dominio')
  }
  const rows = await q(
    `update campanas
        set enviada_dominio = true,
            enviada_dominio_en = now(),
            validacion_estatus = 'PENDIENTE',
            validacion_motivo = null,
            validacion_por = null,
            validacion_en = null
      where id = $1
      returning *`,
    [campanaId],
  )
  return rows[0] ? rowToCampana(rows[0]) : null
}

// Paso 2: el revisor valida la publicación. Aprobar → la campaña pasa a ACTIVA
// (al aire). Rechazar → se guarda el motivo y se baja la bandera de envío para
// que deba corregirse y reenviarse antes de volver a revisarse.
export async function validarPublicacion(
  campanaId: string,
  aprobar: boolean,
  motivo: string | null,
  validadorNombre: string,
) {
  const camp = await q1<any>('select * from campanas where id=$1', [campanaId])
  if (!camp) return null
  if (!camp.enviada_dominio) {
    throw new ValidacionError(
      'La campaña aún no se ha enviado al dominio; no hay nada que validar',
    )
  }
  if (aprobar) {
    // Se vuelve a exigir la asignación (INC-02). Entre el envío al dominio y
    // esta aprobación hay una revisión humana que puede tardar días, y en medio
    // se puede haber rechazado un creativo —que se desasigna solo— o repartido
    // de nuevo. Aprobar dispara la publicación real, y desde que cada pantalla
    // recibe LO SUYO, un hueco aquí deja esa pantalla a oscuras.
    if (camp.tipo_campana === 'DOOH' || camp.tipo_campana === 'HIBRIDA') {
      await exigirTodaPantallaConCreativo(campanaId, 'aprobar la publicación')
    }
    // Candado de facturación para DIGITALES (A-2): aprobar la publicación (= salió
    // al aire en DOOHmain) enciende la evidencia DIGITAL "reporte_publicacion"
    // (igual que el proof-of-play). La evidencia FÍSICA (fotos_comprobatorias) va
    // aparte, por la OT de montaje. Paso a LISTA_FACTURAR: para DOOH basta la OC
    // (solo tiene segmento digital); para HÍBRIDA falta además la OT física
    // (fotos). Las fijas (OOH) no pasan por aquí: su candado va por la OT.
    const rows = await q(
      `update campanas
          set validacion_estatus = 'APROBADA',
              validacion_motivo = null,
              validacion_por = $2,
              validacion_en = now(),
              reporte_publicacion = true,
              estado_comercial = case
                when oc_recibida and (tipo_campana <> 'HIBRIDA' or fotos_comprobatorias)
                  then 'LISTA_FACTURAR'::est_comercial_campana
                when estado_comercial = 'CONFIRMADA' then 'ACTIVA'
                else estado_comercial end
        where id = $1
        returning *`,
      [campanaId, validadorNombre],
    )
    return rows[0] ? rowToCampana(rows[0]) : null
  }
  const rows = await q(
    `update campanas
        set validacion_estatus = 'RECHAZADA',
            validacion_motivo = $3,
            validacion_por = $2,
            validacion_en = now(),
            enviada_dominio = false
      where id = $1
      returning *`,
    [campanaId, validadorNombre, motivo ?? null],
  )
  return rows[0] ? rowToCampana(rows[0]) : null
}

// ─── Barrido: el estado de la campaña sigue al calendario (INC-03) ──────────
//
// `campanas.estado_comercial` es un campo ALMACENADO que solo cambiaba por
// acción de una persona, así que se quedaba congelado: campañas ACTIVA con la
// fecha de fin ya pasada, y CONFIRMADA que llevaban semanas al aire. De ahí
// salía el doble distintivo «Completada + Aún vigente», que transparentaba el
// desfase pero no lo arreglaba (A1/N5 de la auditoría).
//
// Sigue el patrón de `recomputarEstatusArrendadores()`: un UPDATE por regla,
// con un WHERE lo bastante preciso como para que una segunda pasada no toque
// nada. Se dispara donde se disparan los demás barridos.
//
// Lo que NO hace, y es deliberado:
//
//   · No completa nada cuya fecha de fin sea FUTURA. Una campaña marcada
//     «Completada» antes de tiempo es un dato metido a mano —legítimo: una
//     cancelación anticipada de facto— y adivinar por qué sería inventar.
//   · No toca CANCELADA, DRAFT ni COTIZACION: ninguna depende del calendario.
//   · La transición a ACTIVA no publica nada por sí misma. Solo refleja lo que
//     YA está publicado; si se equivocara, lo peor que hace es adelantar un
//     rótulo, nunca sacar algo al aire.

// «Publicada» no significa lo mismo en cada medio, y usar una sola condición
// dejaría fuera a la mitad del catálogo:
//
//   · DOOH/HÍBRIDA — enviada al dominio y con la validación APROBADA. Es la
//     misma pareja de banderas que enciende el candado digital.
//   · OOH — instalada en campo: una OT de montaje de lona COMPLETADA. Es el
//     equivalente físico que usa `pipelineStage()` para la etapa `instalada`, y
//     se replica aquí para que la interfaz y el servidor no diverjan.
//
// Una HÍBRIDA entra por la primera rama: su segmento digital es el que marca la
// salida al aire.
//
// Va en una constante porque LAS DOS reglas la necesitan, y dos copias de esta
// condición se separarían en el primer cambio. Es texto fijo del módulo, no
// entra nada de fuera: los datos siguen viajando como parámetros.
const SQL_PUBLICADA = `(
     (c.tipo_campana in ('DOOH','HIBRIDA')
        and c.enviada_dominio and c.validacion_estatus = 'APROBADA')
     or
     (c.tipo_campana = 'OOH' and exists (
        select 1 from ordenes_trabajo ot
         where ot.campana_id = c.id
           and ot.tipo = 'MONTAJE_LONA'
           and ot.estatus = 'COMPLETADA'))
   )`

export async function recomputarEstadoCampanas(): Promise<void> {
  // ── Regla 1 · el periodo ya terminó → COMPLETADA ─────────────────────────
  //
  // Entran dos orígenes, no uno:
  //   · las que estaban ACTIVA, el caso corriente;
  //   · las que se quedaron en CONFIRMADA habiendo salido al aire y habiendo
  //     terminado ya. Ése es el atasco que INC-03 viene a limpiar —campañas
  //     que nadie avanzó a mano— y sin esta rama se quedarían en CONFIRMADA
  //     para siempre, porque la regla 2 ya no las alcanza.
  const completadas = await q<{ id: string; nombre: string }>(
    `update campanas c
        set estado_comercial = 'COMPLETADA'
      where c.fecha_fin < current_date
        and (c.estado_comercial = 'ACTIVA'
             or (c.estado_comercial = 'CONFIRMADA' and ${SQL_PUBLICADA}))
      returning id, nombre`,
  )

  // ── Regla 2 · CONFIRMADA que ya empezó y está publicada → ACTIVA ─────────
  //
  // EL ORDEN IMPORTA y no es casual: la regla 1 ya se llevó por delante las
  // CONFIRMADA cuyo periodo terminó, así que aquí solo quedan las vigentes. Sin
  // ese orden, una campaña atascada se activaría hoy y se completaría mañana,
  // dejando en el historial dos apuntes que se contradicen.
  //
  // Se pensó en blindarlo con un `fecha_fin >= current_date` aquí. Se quitó: es
  // inalcanzable después de la regla 1 —lo comprobó una mutación que no rompió
  // ninguna prueba— y una condición que nunca se evalúa se lee como si guardara
  // algo. Lo que sí queda amarrado son los estados finales, que es lo que
  // importa: hay prueba de que una CONFIRMADA publicada y vencida acaba en
  // COMPLETADA con UNA sola anotación.
  const activadas = await q<{ id: string; nombre: string }>(
    `update campanas c
        set estado_comercial = 'ACTIVA'
      where c.estado_comercial = 'CONFIRMADA'
        and c.fecha_inicio <= current_date
        and ${SQL_PUBLICADA}
      returning id, nombre`,
  )

  // Bitácora: una entrada por campaña movida, y solo si de verdad se movió
  // algo. Un barrido que corre en cada hidratación y anota «no hice nada»
  // ahogaría el historial — que es justo lo que este repo cuida de la bitácora.
  await anotarEnBitacora('Campaña completada automáticamente al vencer su periodo', completadas)
  await anotarEnBitacora('Campaña activada automáticamente al iniciar y estar publicada', activadas)
}

// Entradas de bitácora sin actor humano: las escribe el propio barrido. Se hace
// aquí y no con `registrarAccion()` porque aquélla espera un `UsuarioSesion` y
// resuelve el tenant desde la cookie; el barrido corre dentro de la petición de
// hidratación, donde el tenant ya está fijado por `q()`.
//
// Un solo INSERT para todas: en la primera pasada sobre una base con atasco
// esto puede ser una veintena de campañas, y una escritura por cada una son
// veinte idas y vueltas dentro de la petición que hidrata el shell.
async function anotarEnBitacora(accion: string, campanas: { nombre: string }[]): Promise<void> {
  if (campanas.length === 0) return
  try {
    await q(
      `insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id)
       select $1, nombre, null, 'Sistema', $3
         from unnest($2::text[]) as nombre`,
      [accion, campanas.map((c) => c.nombre), await tenantActual()],
    )
  } catch (e) {
    // No se relanza: el estado YA se movió y tumbar la petición por la anotación
    // dejaría la pantalla en blanco por un fallo de historial. Pero tampoco se
    // traga en silencio —el cambio se habría quedado sin rastro en una bitácora
    // que aquí se usa como prueba—, así que queda en el log del servidor.
    console.error('[recomputarEstadoCampanas] no se pudo anotar en la bitácora:', e)
  }
}
