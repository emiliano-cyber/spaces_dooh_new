import 'server-only'
import { descuentoDentroDelTope } from '@/lib/descuento'
import { topeDescuentoDelTenant } from './config-repo'
import { randomBytes } from 'crypto'
import { q, q1, pool, fijarTenant, fijarTenantExplicito, qConTenant, qRaw1 } from './db'
import { tenantActual } from './tenant'
import { usuarioActual } from './auth'
import { folioDocumento } from './folios'
import { divisorDeComision } from '@/lib/data/derive'
import { AVISO_FRANJA_NO_VIAJA_AL_CMS, temporadaDeFecha } from '@/lib/rejilla'
import { volumenDeLineas } from '@/lib/volumen'
import { montoDescuentoCodigo } from '@/lib/codigo-promocional'
import { rutaLogo } from '@/lib/medios-url'

// Error de regla de negocio (propuesta inmutable) → el route lo mapea a 409.
export class PropuestaError extends Error {}

// Bloqueo por negociación: si la agencia tiene negociación SIN validar, no se
// puede crear ni aprobar una propuesta con esa agencia (gate de validación).
async function agenciaBloqueada(
  agenciaId: string | null | undefined,
): Promise<{ bloqueada: boolean; nombre?: string }> {
  if (!agenciaId) return { bloqueada: false }
  const a = await q1<any>(
    'select nombre, tiene_negociacion, negociacion_validada from clientes where id=$1',
    [agenciaId],
  )
  if (!a) return { bloqueada: false }
  return { bloqueada: !!a.tiene_negociacion && !a.negociacion_validada, nombre: a.nombre }
}

// ============================================================================
//  lib/server/propuestas-repo.ts — Propuestas comerciales con método del
//  divisor. bruto = Σ items; divisor = 1 − comisión/100; neto = bruto × divisor;
//  iva = bruto × 16%; total = bruto + iva.
// ============================================================================

const IVA_PCT = 16
const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)
// Folio de propuesta: PR-2026-0001. Antes 3 bytes aleatorios sobre una columna
// UNIQUE (`propuestas.folio`); ahora consecutivo atómico (`lib/server/folios.ts`).
const folio = () => folioDocumento('propuesta')
// S1-3: token aleatorio no enumerable (48 chars) para la liga pública.
const tokenPublico = () => randomBytes(24).toString('hex')

function rowToItem(r: any) {
  return {
    id: r.id,
    propuestaId: r.propuesta_id,
    sitioId: r.sitio_id,
    fechaInicio: iso(r.fecha_inicio),
    fechaFin: iso(r.fecha_fin),
    precio: Number(r.precio),
    // Contratación por tiempo (aditivo; ítems viejos → mensual/1).
    unidad: r.unidad ?? 'mensual',
    cantidad: r.cantidad != null ? Number(r.cantidad) : 1,
    tarifaUnitaria: r.tarifa_unitaria != null ? Number(r.tarifa_unitaria) : Number(r.precio),
    spotsPorDia: r.spots_por_dia != null ? Number(r.spots_por_dia) : null,
    // REJILLA-01 · la franja CONTRATADA. `null` en todo lo vendido hasta el
    // 2026-09-28 y en toda venta que no la use, que es el caso normal. El
    // NOMBRE solo viene cuando la consulta lo trajo por el join —lectura del
    // detalle y congelado del snapshot—; donde no viene queda `null` y la
    // pantalla pinta el identificador en vez de inventarse una etiqueta.
    franjaId: r.franja_id ?? null,
    // VOL-01 · el descuento por volumen que le tocó a esta línea, CONGELADO el
    // día de la captura. `precio` sigue siendo el importe de LISTA: el volumen
    // se aplica como una capa explícita sobre el bruto, para que el documento
    // pueda enseñar «subtotal − volumen − comercial» en vez de un número más
    // bajo sin explicación.
    descuentoVolumenPct: Number(r.descuento_volumen_pct ?? 0) || 0,
    volumenDesde: r.volumen_desde != null ? Number(r.volumen_desde) : null,
    franjaNombre: r.franja_nombre ?? null,
    franjaHorario:
      r.franja_hora_inicio && r.franja_hora_fin
        ? `${r.franja_hora_inicio}–${r.franja_hora_fin}`
        : null,
    aprobado: !!r.aprobado,
  }
}

function armarPropuesta(p: any, items: any[]) {
  const its = items.map(rowToItem)
  const bruto = its.reduce((s, i) => s + i.precio, 0)
  const comisionPct = Number(p.comision_pct)
  // La lectura también se protege, y no es redundante: si alguna fila se
  // guardó con `NaN` antes de que existiera la guarda de escritura, seguiría
  // contaminando bruto, neto y aprobado cada vez que se lee la propuesta. Un
  // valor imposible se lee como «sin descuento», que es el lado prudente:
  // cobrar de más se ve y se corrige; regalar el 100 % en silencio, no.
  const leido = p.descuento_pct != null ? Number(p.descuento_pct) : 0
  const descuentoPct = Number.isFinite(leido) ? leido : 0
  const version = p.version != null ? Number(p.version) : 1
  const divisor = divisorDeComision(comisionPct)
  // IVA configurado en el cliente (clientes.iva_pct); si no viene, 16.
  const ivaP = p.cliente_iva != null ? Number(p.cliente_iva) : IVA_PCT

  // base = bruto de lista − volumen − descuento comercial. El neto (para el
  // medio) y el IVA se calculan sobre la base; el total es lo que paga el cliente.
  // VOL-01 · el volumen entra AQUÍ, entre el bruto de lista y el descuento
  // comercial, que es exactamente donde lo pone la cadena del ADR 0039. Por eso
  // el comercial se calcula sobre `brutoConVolumen` y no sobre `bruto`: ahí es
  // donde «se compone, no se suma» deja de ser una frase y pasa a ser la
  // aritmética. Con cero volumen, `brutoConVolumen === bruto` y todo lo de
  // abajo da el mismo número que antes de esta fase, dígito por dígito.
  const vol = volumenDeLineas(its)
  const descuentoVolumenMonto = vol.descuentoVolumenMonto
  const brutoConVolumen = vol.brutoConVolumen
  const descuentoMonto = Math.round(brutoConVolumen * (descuentoPct / 100))
  // COD-01 · el CÓDIGO PROMOCIONAL entra AQUÍ, entre el descuento comercial y
  // la comisión de agencia, que es exactamente donde lo pone la cadena del ADR
  // 0039. Por eso se calcula sobre `baseComercial` y no sobre `bruto`: ahí es
  // donde «se compone, no se suma» deja de ser una frase y pasa a ser la
  // aritmética — un 20 % de volumen, un 20 % comercial y un 20 % de cupón dejan
  // al cliente pagando el 51,2 %, no el 40 %.
  //
  // La lectura se protege igual que la del descuento comercial, y por el mismo
  // motivo: `numeric` de Postgres ADMITE `NaN` y lo propaga, así que una fila
  // corrupta contaminaría el neto entero y la petición contestaría 200 OK.
  const leidoCod = p.codigo_descuento_pct != null ? Number(p.codigo_descuento_pct) : 0
  const codigoDescuentoPct = Number.isFinite(leidoCod) ? Math.max(0, Math.min(100, leidoCod)) : 0
  const codigoTexto = p.codigo_texto ?? null
  const baseComercial = brutoConVolumen - descuentoMonto
  const codigoDescuentoMonto = montoDescuentoCodigo(baseComercial, codigoDescuentoPct)
  // Con cero cupón, `base === baseComercial` y todo lo de abajo da el mismo
  // número que antes de esta fase, dígito por dígito. Ése es el invariante que
  // hace que la Fase 3 no mueva una sola venta de la base instalada.
  const base = baseComercial - codigoDescuentoMonto
  const neto = Math.round(base * divisor)
  const iva = Math.round(base * (ivaP / 100))
  // Aprobación granular: presupuesto sobre los items aprobados (modelo "menú").
  const aprob = its.filter((i) => i.aprobado)
  const brutoAprobado = aprob.reduce((s, i) => s + i.precio, 0)
  const volAprobado = volumenDeLineas(aprob)
  const baseComercialAprobado =
    volAprobado.brutoConVolumen - Math.round(volAprobado.brutoConVolumen * (descuentoPct / 100))
  const codigoDescuentoMontoAprobado = montoDescuentoCodigo(
    baseComercialAprobado,
    codigoDescuentoPct,
  )
  const baseAprobado = baseComercialAprobado - codigoDescuentoMontoAprobado
  const netoAprobado = Math.round(baseAprobado * divisor)
  const ivaAprobado = Math.round(baseAprobado * (ivaP / 100))
  return {
    id: p.id,
    folio: p.folio,
    tokenPublico: p.token_publico ?? null,
    clienteId: p.cliente_id ?? null,
    agenciaId: p.agencia_id ?? null,
    nombre: p.nombre,
    fecha: iso(p.fecha),
    estatus: p.estatus,
    comisionPct,
    descuentoPct,
    version,
    notas: p.notas ?? null,
    creadoEn: iso(p.creado_en),
    items: its,
    bruto,
    // VOL-01. Van los tres: lo regalado por volumen, lo que queda después, y el
    // porcentaje ponderado de la propuesta entera — que es el que se compara
    // contra el tope de la organización.
    descuentoVolumenMonto,
    brutoConVolumen,
    descuentoVolumenPct: vol.volumenPctEfectivo,
    descuentoMonto,
    // COD-01. Van los tres, igual que con el volumen: qué código fue, cuánto
    // descuenta y cuánto se regaló con él. El documento tiene que poder enseñar
    // «subtotal − volumen − comercial − CÓDIGO» en vez de un número más bajo sin
    // explicación; un importe que no cuadra con su propia cuenta se lee como un
    // defecto del sistema.
    codigoTexto,
    codigoDescuentoPct,
    codigoDescuentoMonto,
    baseComercial,
    base,
    divisor,
    neto,
    iva,
    total: base + iva,
    itemsAprobados: aprob.length,
    brutoAprobado,
    descuentoVolumenMontoAprobado: volAprobado.descuentoVolumenMonto,
    codigoDescuentoMontoAprobado,
    baseAprobado,
    netoAprobado,
    ivaAprobado,
    totalAprobado: baseAprobado + ivaAprobado,
  }
}

// S0-1: congela un snapshot económico INMUTABLE al aceptar/aprobar. Todos los
// módulos (campaña, factura, rentabilidad, comisiones) leen de aquí — nadie
// recalcula desde tarifas de lista. Idempotente: si ya existe, no lo re-escribe.
// Devuelve el snapshot (nuevo o el existente).
// `tenantId` solo lo pasa la aceptación por liga PÚBLICA, donde no hay sesión de
// la que sacar el tenant y las tablas son fail-closed (Bloque B). Desde las rutas
// autenticadas se omite y se usa el tenant de la sesión, como siempre.
export async function congelarSnapshotEconomico(propuestaId: string, tenantId?: string) {
  const qS = <T = any>(sql: string, params?: unknown[]) =>
    tenantId ? qConTenant<T>(tenantId, sql, params) : q<T>(sql, params)
  const qS1 = async <T = any>(sql: string, params?: unknown[]): Promise<T | null> =>
    (await qS<T>(sql, params))[0] ?? null

  const prop = await qS1<any>(
    `select p.*, c.iva_pct as cliente_iva
       from propuestas p left join clientes c on c.id = p.cliente_id
      where p.id = $1`,
    [propuestaId],
  )
  if (!prop) return null
  if (prop.snapshot_economico) return prop.snapshot_economico // inmutable

  // REJILLA-01 · el nombre y el horario de la franja viajan CON el ítem.
  //
  // El `left join` es lo que permite congelar el NOMBRE y no solo el id, y esa
  // es la decisión que hace auditable el snapshot: dentro de seis meses «1 800»
  // sin decir que era el prime del Buen Fin no se puede explicar. Es lo
  // contrario de lo que se decidió el mismo día con el vendedor —ahí NO se
  // denormaliza el nombre porque una propuesta es un registro VIVO—, y no es
  // una incoherencia: un snapshot ES una línea de bitácora congelada, como
  // `acciones.usuario_nombre`. Si el dueño renombra «Prime» o lo desactiva, la
  // propuesta firmada tiene que seguir imprimiendo lo que se vendió.
  //
  // `and f.tenant_id = i.tenant_id` es la segunda capa sobre la RLS que exigen
  // las convenciones. La RLS ya lo impediría; esto es lo que queda en pie el
  // día que alguien conecte con un rol que la salte, y sin él una franja de
  // otra organización podría prestarle su nombre a esta propuesta (R2).
  //
  // `left` y no `join` a secas: la inmensa mayoría de los ítems NO tiene franja
  // —toda la base instalada—, y un `join` interno los dejaría fuera del
  // snapshot. Ese fallo no daría error: la propuesta se aprobaría con un bruto
  // de cero.
  const SEL_ITEMS = `select i.*,
            f.nombre      as franja_nombre,
            f.hora_inicio as franja_hora_inicio,
            f.hora_fin    as franja_hora_fin
       from propuesta_items i
       left join franjas_horarias f
              on f.id = i.franja_id and f.tenant_id = i.tenant_id`
  const aprob = await qS<any>(
    `${SEL_ITEMS} where i.propuesta_id=$1 and i.aprobado=true order by i.creado_en asc`,
    [propuestaId],
  )
  const usar = aprob.length
    ? aprob
    : await qS<any>(`${SEL_ITEMS} where i.propuesta_id=$1`, [propuestaId])

  // Las temporadas VIGENTES de la organización, para deducir cuál cubría la
  // fecha de cada ítem. Se leen todas —son pocas por construcción, una decena
  // al año— y la resolución la hace `lib/rejilla.ts`, que es el único sitio
  // donde vive esa regla. Ordenadas por `desde` porque `temporadaDeFecha`
  // devuelve la primera que cubre: con el solape prohibido no puede haber dos,
  // pero si datos viejos las trajeran, que gane siempre la misma.
  const temporadas = await qS<any>(
    `select id, nombre, to_char(desde,'YYYY-MM-DD') as desde, to_char(hasta,'YYYY-MM-DD') as hasta
       from temporadas where activo = true order by desde asc, id asc`,
  )
  const temporadasRej = temporadas.map((t) => ({
    id: String(t.id),
    nombre: String(t.nombre),
    desde: String(t.desde),
    hasta: String(t.hasta),
  }))

  const comisionPct = Number(prop.comision_pct)
  const descuentoPct = prop.descuento_pct != null ? Number(prop.descuento_pct) : 0
  const ivaPct = prop.cliente_iva != null ? Number(prop.cliente_iva) : IVA_PCT
  const version = prop.version != null ? Number(prop.version) : 1
  const divisor = divisorDeComision(comisionPct)
  const factorDesc = 1 - descuentoPct / 100

  const bruto = usar.reduce((s, it) => s + Number(it.precio), 0)
  // VOL-01 · el volumen se congela desde el PROPIO ÍTEM y no se vuelve a
  // consultar `escalas_volumen`. Es una diferencia real con la franja, que sí
  // se relee de su catálogo para poder congelar su nombre: aquí el porcentaje y
  // el umbral ya están copiados en la línea desde la captura, así que mover la
  // escala no puede alcanzar a una propuesta ni antes ni después de aprobarla.
  // Dos redes, no una.
  const vol = volumenDeLineas(
    usar.map((it) => ({
      precio: Number(it.precio),
      descuentoVolumenPct: Number(it.descuento_volumen_pct ?? 0),
    })),
  )
  const brutoConVolumen = vol.brutoConVolumen
  const descuentoMonto = Math.round(brutoConVolumen * (descuentoPct / 100))
  // COD-01 · el código se congela desde la PROPIA PROPUESTA y no se vuelve a
  // consultar `codigos_promocionales`. Es la misma decisión que con el volumen
  // y la diferencia real con la franja, que sí se relee de su catálogo para
  // poder congelar su nombre: aquí el texto y el porcentaje ya están copiados
  // en la propuesta desde el canje, así que **borrar o cambiar el cupón no
  // puede alcanzar a una venta ni antes ni después de aprobarla**. Dos redes,
  // no una — y es el invariante 3 del ADR 0039, el que decide si esta fase está
  // bien hecha.
  const leidoCod = prop.codigo_descuento_pct != null ? Number(prop.codigo_descuento_pct) : 0
  const codigoPct = Number.isFinite(leidoCod) ? Math.max(0, Math.min(100, leidoCod)) : 0
  const codigoTexto = prop.codigo_texto ?? null
  const baseComercial = brutoConVolumen - descuentoMonto
  const codigoMonto = montoDescuentoCodigo(baseComercial, codigoPct)
  // Mismo molde que `factorVol` de la Fase 2, y con su misma guarda: se mira el
  // PORCENTAJE y no el monto, porque un monto 0 sobre una base 0 no significa
  // «sin cupón». `codigoPct` ya viene acotado y finito de arriba.
  const factorCodigo = codigoPct > 0 ? 1 - Math.min(codigoPct, 100) / 100 : 1
  const base = baseComercial - codigoMonto
  const neto = Math.round(base * divisor)
  const iva = Math.round(base * (ivaPct / 100))
  const total = base + iva
  const porSitio = usar.map((it) => {
    // La temporada se DEDUCE de la fecha de inicio del ítem y no se guarda en
    // `propuesta_items`: ahí sería una segunda verdad que envejece. Aquí sí se
    // guarda, porque aquí deja de ser un dato vivo y pasa a ser un hecho.
    const tempId = temporadaDeFecha(temporadasRej, String(iso(it.fecha_inicio) ?? '').slice(0, 10))
    const temp = tempId ? temporadasRej.find((t) => t.id === tempId) : null
    // El volumen de ESTA línea. Se lee con guarda porque `numeric` de Postgres
    // admite NaN: sin ella, una fila corrupta dejaría el neto de la propuesta
    // en NaN y la aprobación contestaría 200 OK.
    const volPct = Number(it.descuento_volumen_pct ?? 0)
    const factorVol = Number.isFinite(volPct) && volPct > 0 ? 1 - Math.min(volPct, 100) / 100 : 1
    return {
      sitioId: it.sitio_id,
      // `lista` sigue siendo el importe DE LISTA, sin el volumen. Si bajara, el
      // reporte de publicada contra neta compararía la neta con una «publicada»
      // que nadie publicó nunca.
      lista: Number(it.precio),
      // COD-01 · `factorCodigo` entra aquí, entre el descuento comercial y la
      // comisión. Es el número que `campanas-repo` copia a `reservas.precio`, o
      // sea el que se factura: si el cupón no entrara aquí, la campaña cobraría
      // MÁS que la propuesta que la originó y nadie lo vería — el importe es
      // plausible, solo que es el de antes del cupón.
      neto: Math.round(Number(it.precio) * factorVol * factorDesc * factorCodigo * divisor),
      // La tarifa UNITARIA aparte del importe de la línea: `lista` ya lleva la
      // cantidad dentro (50 spots × 1 200), y comparar publicada contra neta
      // exige el precio por unidad. Si no constara, el reporte tendría que
      // dividir —y una división por una cantidad que pudo no guardarse es
      // exactamente el `?? 0` que este repositorio persigue.
      tarifaUnitaria: it.tarifa_unitaria != null ? Number(it.tarifa_unitaria) : Number(it.precio),
      franja: it.franja_id
        ? {
            id: String(it.franja_id),
            nombre: it.franja_nombre ?? null,
            horaInicio: it.franja_hora_inicio ?? null,
            horaFin: it.franja_hora_fin ?? null,
          }
        : null,
      temporada: temp ? { id: temp.id, nombre: temp.nombre } : null,
      // VOL-01 · SOLO cuando hay volumen. Un snapshot que engorda con ceros en
      // toda la base instalada es ruido que se acaba dejando de leer, y encima
      // cambiaría el JSON de propuestas que no cambiaron de precio. Mismo
      // criterio que el `avisoFranja` de la Fase 1.
      //
      // Va el UMBRAL además del porcentaje: un «10 %» sin decir «por llegar a
      // 50» no se puede auditar seis meses después — nadie sabrá si salió de la
      // escala o de un dedazo.
      ...(factorVol !== 1
        ? { descuentoVolumenPct: volPct, volumenDesde: it.volumen_desde != null ? Number(it.volumen_desde) : null }
        : {}),
    }
  })

  // El aviso viaja DENTRO del congelado, y no es adorno. El snapshot es lo que
  // se imprime y lo que alguien audita seis meses después; si la advertencia
  // viviera solo en una pantalla, el documento que queda del trato afirmaría
  // una franja que el sistema nunca programó. Es la misma familia que el `?? 0`
  // del mapa: convertir «no sé» en una afirmación concreta.
  //
  // Se guarda SOLO cuando alguna línea lleva franja: un snapshot sin franjas no
  // tiene nada que advertir, y llenarlo de avisos vacíos haría que se dejaran
  // de leer.
  const hayFranja = porSitio.some((s) => s.franja != null)

  // Igual que con la franja: los totales de volumen se guardan SOLO cuando hay
  // volumen. Así el snapshot de una venta sin tramos es byte por byte el mismo
  // JSON que producía esta función antes de la Fase 2.
  const hayVolumen = vol.descuentoVolumenMonto !== 0

  // COD-01 · EL CONGELADO DEL CÓDIGO, que es lo que decide si esta fase está
  // bien hecha. Se guarda SOLO cuando hay código, igual que la franja y el
  // volumen: así el snapshot de una venta sin cupón es byte por byte el mismo
  // JSON que producía esta función antes de la Fase 3.
  //
  // Va el TEXTO además del porcentaje, y por el mismo motivo por el que el
  // volumen guarda su umbral: un «20 %» sin decir de qué código salió no se
  // puede auditar seis meses después — nadie sabrá si vino de una promoción o
  // de un dedazo. Y va `codigoCanjeadoEn` porque el momento es la mitad de la
  // respuesta a la tercera pregunta con trampa: **un cupón aplicado antes de
  // vencer sigue valiendo al aprobar**, y esa fecha es lo que lo demuestra.
  const hayCodigo = codigoTexto != null && codigoPct > 0

  const snap = {
    version, bruto,
    ...(hayVolumen
      ? {
          descuentoVolumenPct: vol.volumenPctEfectivo,
          descuentoVolumenMonto: vol.descuentoVolumenMonto,
          brutoConVolumen,
        }
      : {}),
    descuentoPct, descuentoMonto,
    ...(hayCodigo
      ? {
          codigoTexto: String(codigoTexto),
          codigoDescuentoPct: codigoPct,
          codigoDescuentoMonto: codigoMonto,
          baseComercial,
          codigoCanjeadoEn: iso(prop.codigo_canjeado_en) ?? null,
        }
      : {}),
    base, comisionPct, neto, ivaPct, iva, total, porSitio,
    ...(hayFranja ? { avisoFranja: AVISO_FRANJA_NO_VIAJA_AL_CMS } : {}),
  }
  await qS('update propuestas set snapshot_economico=$2, snapshot_en=now() where id=$1', [
    propuestaId,
    JSON.stringify(snap),
  ])
  return snap
}

// Lectura pública (sin auth) de una propuesta por su CÓDIGO: acepta el id (UUID)
// o el folio (p. ej. PR-A0BC4F). Datos de solo lectura para una liga
// compartible. Incluye nombres de cliente/agencia y de cada sitio.
export async function obtenerPropuestaPublica(codigo: string) {
  const cod = (codigo ?? '').trim()
  if (!cod) return null

  // Ruta PÚBLICA: sin sesión no hay tenant que fijar, y estas tablas son
  // fail-closed (Hardening 1 · Bloque B). El token aleatorio ES la autorización:
  // Postgres resuelve su tenant y el resto de las consultas corren bajo él.
  const t = await qRaw1<{ tenant: string | null }>(
    'select propuesta_tenant_por_token($1) as tenant',
    [cod],
  )
  const tenantId = t?.tenant
  if (!tenantId) return null

  const qPub = <T = any>(sql: string, params?: unknown[]) => qConTenant<T>(tenantId, sql, params)
  const qPub1 = async <T = any>(sql: string, params?: unknown[]): Promise<T | null> =>
    (await qPub<T>(sql, params))[0] ?? null

  // S1-3: la liga pública se resuelve SOLO por token aleatorio (no por id/folio
  // enumerable). Sin el token exacto no se puede abrir la propuesta.
  const p = await qPub1<any>(
    `select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva
       from propuestas p
      where p.token_publico = $1
      limit 1`,
    [cod],
  )
  if (!p) return null
  const id = p.id
  // REJILLA-01 · la franja contratada, con su nombre, también en la LIGA
  // PÚBLICA. Es la superficie que ve el CLIENTE, así que es donde más caro
  // cuesta callarse que la programación no viaja al CMS.
  //
  // El `left join` corre bajo `qPub`, o sea con el tenant que resolvió el token:
  // la franja no puede venir de otra organización ni aunque el join se olvidara
  // del `and`. Aun así lleva el `and f.tenant_id = i.tenant_id`, igual que los
  // otros dos, porque la regla de este repositorio no admite excepciones «por
  // aquí no llega».
  const items = await qPub(
    `select i.*, f.nombre as franja_nombre, f.hora_inicio as franja_hora_inicio,
            f.hora_fin as franja_hora_fin
       from propuesta_items i
       left join franjas_horarias f on f.id = i.franja_id and f.tenant_id = i.tenant_id
      where i.propuesta_id=$1 order by i.creado_en asc`,
    [id],
  )
  const armado = armarPropuesta(p, items)

  const cliente = p.cliente_id ? await qPub1<any>('select nombre from clientes where id=$1', [p.cliente_id]) : null
  const agencia = p.agencia_id ? await qPub1<any>('select nombre from clientes where id=$1', [p.agencia_id]) : null

  // Membrete de quien EMITE la propuesta. Esta página es la única cosa de la
  // plataforma que ve el cliente final, y hasta ahora no llevaba ni el nombre
  // ni el logo de la organización: llegaba una cotización sin remite. El logo
  // va por `/api/logo/<token>` y no como data URL para no meter hasta 2 MB de
  // base64 en un payload que se pide en cada apertura de la liga.
  const org = await qPub1<any>('select nombre from tenants where id = $1', [tenantId])
  const cfg = await qPub1<any>('select logo_token from config_negocio where tenant_id = $1', [tenantId])

  const sitioIds = (items as any[]).map((i) => i.sitio_id)
  const sitios = sitioIds.length
    ? await qPub<any>(
        `select id, nombre, alcaldia, tipo_medio, lat, lng,
                direccion, plaza_ciudad, ciudad, estado
           from sitios where id = any($1::uuid[])`,
        [sitioIds],
      )
    : []
  const byId = new Map(sitios.map((s) => [s.id, s]))

  return {
    orgNombre: org?.nombre ?? null,
    orgLogoUrl: rutaLogo(cfg?.logo_token ?? null),
    folio: armado.folio,
    nombre: armado.nombre,
    estatus: armado.estatus,
    aceptadoEn: p.aceptado_en ? iso(p.aceptado_en) : null,
    aceptadoPor: p.aceptado_por ?? null,
    version: armado.version,
    clienteNombre: cliente?.nombre ?? null,
    agenciaNombre: agencia?.nombre ?? null,
    comisionPct: armado.comisionPct,
    descuentoPct: armado.descuentoPct,
    descuentoMonto: armado.descuentoMonto,
    // VOL-01 · el volumen viaja a la LIGA PÚBLICA, que es el documento que el
    // cliente lee y acepta. Si no viajara, la cotización enseñaría un bruto y un
    // total que no cuadran entre sí — y la pantalla no puede inventarse la
    // diferencia. Este objeto se arma A MANO, campo por campo: añadir un dato a
    // `armarPropuesta` no basta para que llegue aquí, y ése es exactamente el
    // olvido que esta línea evita.
    descuentoVolumenPct: armado.descuentoVolumenPct,
    descuentoVolumenMonto: armado.descuentoVolumenMonto,
    brutoConVolumen: armado.brutoConVolumen,
    // COD-01 · y el CÓDIGO PROMOCIONAL, por el mismo motivo y con más razón: es
    // lo único de la cadena que se le prometió al cliente por su nombre. Si el
    // documento que firma no dijera «VERANO20 −20 %», enseñaría un total más
    // bajo que su propia cuenta y sin decir por qué — que es exactamente el
    // defecto que la Fase 2 encontró aquí revisando el diff, no corriendo
    // pruebas.
    codigoTexto: armado.codigoTexto,
    codigoDescuentoPct: armado.codigoDescuentoPct,
    codigoDescuentoMonto: armado.codigoDescuentoMonto,
    baseComercial: armado.baseComercial,
    divisor: armado.divisor,
    bruto: armado.bruto,
    base: armado.base,
    neto: armado.neto,
    iva: armado.iva,
    total: armado.total,
    itemsAprobados: armado.itemsAprobados,
    items: armado.items.map((it) => {
      const s = byId.get(it.sitioId)
      return {
        sitioNombre: s?.nombre ?? it.sitioId,
        alcaldia: s?.alcaldia ?? null,
        tipoMedio: s?.tipo_medio ?? null,
        lat: s?.lat != null ? Number(s.lat) : null,
        lng: s?.lng != null ? Number(s.lng) : null,
        // Ubicación en texto: la liga pública debe poder situar la pantalla
        // aunque el mapa no cargue (tiles externos) o el sitio no tenga coords.
        direccion: s?.direccion ?? null,
        ciudad: s?.plaza_ciudad ?? s?.ciudad ?? null,
        estado: s?.estado ?? null,
        fechaInicio: it.fechaInicio,
        fechaFin: it.fechaFin,
        precio: it.precio,
        aprobado: it.aprobado,
        // REJILLA-01 · qué franja se le vendió. Si no viajara, el cliente
        // leería un importe sin saber a qué horas compró.
        franjaId: it.franjaId,
        franjaNombre: it.franjaNombre,
        franjaHorario: it.franjaHorario,
      }
    }),
  }
}

// ─── Aceptación del cliente desde la liga pública ───────────────────────────
// El cliente acepta la propuesta con un clic desde la liga (SIN sesión). Deja
// el timestamp + su nombre (medio-contrato) y mueve la propuesta a APROBADA
// (acepta todas las pantallas si no hay selección granular). Idempotente: si ya
// está aceptada, devuelve la aceptación existente sin volver a escribir.
// Nota: NO re-valida el gate de negociación de agencia — enviar la liga al
// cliente (ENVIADA) ya fue un acto deliberado del área comercial.
const MAX_NOMBRE_ACEPTANTE = 240

export async function aceptarPropuestaPublica(
  codigo: string,
  input: { nombre: string; ip?: string | null },
): Promise<{ ok: boolean; yaAceptada: boolean; estatus: string; aceptadoEn: string | null; aceptadoPor: string | null } | null> {
  const cod = (codigo ?? '').trim()
  const nombre = (input.nombre ?? '').trim()
  if (!nombre) throw new PropuestaError('Escribe tu nombre para aceptar la propuesta')
  // Tope por arriba, que no habia. Misma razon que en la firma del contrato
  // (`firmas-repo.ts`): esta ruta es PUBLICA y sin sesion, escribe `aceptado_por`
  // en el registro de la aceptacion, y aceptar es IDEMPOTENTE —la segunda
  // llamada devuelve la aceptacion ya registrada en vez de rehacerla—, asi que
  // tampoco hay forma de enmendarlo desde la aplicacion.
  if (nombre.length > MAX_NOMBRE_ACEPTANTE) {
    throw new PropuestaError(`El nombre no puede pasar de ${MAX_NOMBRE_ACEPTANTE} caracteres`)
  }

  // Ruta PÚBLICA (sin sesión): el token resuelve el tenant, y bajo ese tenant se
  // lee y se escribe. Las tablas son fail-closed (Bloque B), así que sin esto el
  // SELECT no vería la propuesta y el UPDATE fallaría el WITH CHECK.
  const tRow = await qRaw1<{ tenant: string | null }>(
    'select propuesta_tenant_por_token($1) as tenant',
    [cod],
  )
  const tenantId = tRow?.tenant
  if (!tenantId) return null

  const p = (
    await qConTenant<any>(
      tenantId,
      `select id, tenant_id, folio, nombre, estatus, aceptado_en, aceptado_por
         from propuestas where token_publico = $1 limit 1`,
      [cod],
    )
  )[0]
  if (!p) return null

  // Idempotente: ya aceptada / aprobada → devuelve la aceptación registrada.
  if (p.aceptado_en || p.estatus === 'APROBADA') {
    return {
      ok: true,
      yaAceptada: true,
      estatus: p.estatus,
      aceptadoEn: p.aceptado_en ? iso(p.aceptado_en) : null,
      aceptadoPor: p.aceptado_por ?? null,
    }
  }
  if (p.estatus === 'BORRADOR') {
    throw new PropuestaError('Esta propuesta todavía no está disponible para aceptar')
  }
  if (p.estatus === 'RECHAZADA') {
    throw new PropuestaError('Esta propuesta ya no está vigente')
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    // Tenant del token, NO de la sesión: aquí no hay sesión (fijarTenant habría
    // fijado el GUC vacío y la transacción entera fallaría fail-closed).
    await fijarTenantExplicito(client, p.tenant_id)
    // Aceptar = aceptar todas las pantallas si no hay selección granular previa.
    const marcados = (
      await client.query(
        'select count(*)::int as n from propuesta_items where propuesta_id=$1 and aprobado=true',
        [p.id],
      )
    ).rows[0].n
    if (Number(marcados) === 0) {
      await client.query('update propuesta_items set aprobado=true where propuesta_id=$1', [p.id])
    }
    const upd = (
      await client.query(
        `update propuestas
            set estatus='APROBADA', aceptado_en=now(), aceptado_por=$2, aceptado_ip=$3
          where id=$1
          returning estatus, aceptado_en, aceptado_por`,
        [p.id, nombre, input.ip ?? null],
      )
    ).rows[0]
    // Notifica al equipo interno (bell) usando el tenant de la propuesta, no la
    // sesión (aquí no hay sesión). Nunca rompe la aceptación si falla.
    try {
      await client.query(
        `insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id)
         values ('PROPUESTA','ok',$1,$2,$3,$4)`,
        [
          'Propuesta aceptada por el cliente',
          `${p.folio} · ${p.nombre} — aceptada por ${nombre}`,
          `/propuestas/${p.id}`,
          p.tenant_id,
        ],
      )
    } catch { /* la notificación no rompe la aceptación */ }
    await client.query('commit')
    // S0-1: congela el snapshot económico al aceptar por liga pública (inmutable).
    await congelarSnapshotEconomico(p.id, p.tenant_id)
    return {
      ok: true,
      yaAceptada: false,
      estatus: upd.estatus,
      aceptadoEn: iso(upd.aceptado_en),
      aceptadoPor: upd.aceptado_por,
    }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function listarPropuestas() {
  const props = await q(
    `select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva
       from propuestas p where p.tenant_id = $1 order by p.creado_en desc`,
    [await tenantActual()],
  )
  if (!props.length) return []
  // REJILLA-01 · el nombre y el horario de la franja viajan con el ítem, para
  // que el detalle de la propuesta pueda decir «Prime · 06:00–10:00» en vez de
  // un identificador. `left join` porque la inmensa mayoría no tiene franja, y
  // `and f.tenant_id = i.tenant_id` como segunda capa sobre la RLS.
  const items = await q(
    `select i.*, f.nombre as franja_nombre, f.hora_inicio as franja_hora_inicio,
            f.hora_fin as franja_hora_fin
       from propuesta_items i
       left join franjas_horarias f on f.id = i.franja_id and f.tenant_id = i.tenant_id
      order by i.creado_en asc`,
  )
  const porProp = new Map<string, any[]>()
  for (const it of items) {
    const arr = porProp.get(it.propuesta_id) ?? []
    arr.push(it)
    porProp.set(it.propuesta_id, arr)
  }
  return props.map((p: any) => armarPropuesta(p, porProp.get(p.id) ?? []))
}

export interface PropuestaInput {
  clienteId?: string | null
  agenciaId?: string | null
  nombre: string
  comisionPct?: number
  fechaInicio: string
  fechaFin: string
  // Sitios con su contratación por tiempo. El controller ya calculó precio y
  // cantidad; el repo solo persiste. `precio` = tarifaUnitaria × cantidad.
  items: {
    sitioId: string
    precio: number
    unidad?: string
    tarifaUnitaria?: number
    cantidad?: number
    spotsPorDia?: number | null
    // Renta al propietario (ADR 0001). Con los tres, el contrato que nace con la
    // campaña nace COMPLETO y con su calendario de pagos.
    rentaMonto?: number | null
    rentaPeriodicidad?: string | null
    rentaArrendadorId?: string | null
    // REJILLA-01 · la franja horaria contratada, si la venta usa una. NO lleva
    // temporada: ésa se deduce de las fechas del ítem, y copiarla aquí sería
    // una segunda verdad que envejece. La que se aplicó queda congelada en el
    // snapshot al aprobar, que es donde deja de ser un dato vivo.
    franjaId?: string | null
    // VOL-01 · el descuento por volumen que le tocó y el umbral que lo ganó.
    // Los calcula el CONTROLLER leyendo `escalas_volumen` bajo RLS; NUNCA
    // llegan del cuerpo de la petición (ver la cabecera de
    // `propuestas-controller.ts`). Aquí están porque el repo los persiste, no
    // porque sean un dato de entrada del cliente.
    descuentoVolumenPct?: number
    volumenDesde?: number | null
  }[]
  notas?: string | null
}

// S1-1: valida que la fecha fin no sea anterior a la de inicio (rango válido).
export function validarRangoFechas(inicio?: string | null, fin?: string | null) {
  if (!inicio || !fin) return
  if (new Date(fin) < new Date(inicio)) {
    throw new PropuestaError('La fecha fin no puede ser anterior a la fecha de inicio')
  }
}

export async function crearPropuesta(input: PropuestaInput) {
  validarRangoFechas(input.fechaInicio, input.fechaFin)
  // Gate de negociación: la agencia debe tener su negociación validada.
  const bloq = await agenciaBloqueada(input.agenciaId)
  if (bloq.bloqueada) {
    throw new PropuestaError(
      `La negociación con la agencia ${bloq.nombre ?? ''} no está validada; valídala antes de crear la propuesta`,
    )
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    await fijarTenant(client)
    // ⚠️ EL VENDEDOR SALE DE LA SESIÓN, Y NO DE `input`. (VEND-01, 2026-09-28)
    //
    // Es el mismo camino que `tenantActual()` —`usuarioActual()` lee la cookie
    // httpOnly y resuelve la fila por `auth_usuario_por_sesion`—, y por la misma
    // razón: lo que decide QUIÉN eres no puede entrar por el cuerpo de la
    // petición. Si `usuario_id` viajara en el JSON, cualquiera con permiso de
    // `comercial.crear` se atribuiría una venta ajena —o le cargaría a otro un
    // descuento del 80 %— con un `curl`, y NO daría ningún error: la propuesta
    // se crearía igual y solo cambiaría el nombre en la tabla del reporte.
    //
    // Por eso `PropuestaInput` no declara ningún campo de usuario: no es un
    // olvido, es el candado. Añadírselo volvería a abrir el agujero, y
    // `propuestas-vendedor.test.ts` lo vigila en el tipo y en el zod.
    //
    // `null` cuando no hay sesión —hoy imposible por `exigir()` en el route,
    // pero un alta futura por un trabajo programado no tendría cookie— y eso es
    // exactamente lo que el reporte sabe pintar: «Sin vendedor», nunca un cero.
    const vendedorId = (await usuarioActual())?.id ?? null
    const prop = (
      await client.query(
        `insert into propuestas (folio, cliente_id, agencia_id, nombre, comision_pct, notas, token_publico, usuario_id, tenant_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [await folio(), input.clienteId ?? null, input.agenciaId ?? null, input.nombre, input.comisionPct ?? 0, input.notas ?? null, tokenPublico(), vendedorId, await tenantActual()],
      )
    ).rows[0]
    // Siempre asociar la agencia con el cliente: si la propuesta lleva cliente y
    // agencia, se persiste el vínculo en el cliente para que quede ligado y se
    // precargue en futuras propuestas.
    if (input.clienteId && input.agenciaId) {
      await client.query('update clientes set agencia_id=$2 where id=$1', [
        input.clienteId,
        input.agenciaId,
      ])
    }
    const tId = await tenantActual()
    for (const it of input.items) {
      await client.query(
        `insert into propuesta_items
           (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio, unidad, cantidad, tarifa_unitaria, spots_por_dia, tenant_id,
            renta_monto, renta_periodicidad, renta_arrendador_id, franja_id,
            descuento_volumen_pct, volumen_desde)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::periodicidad_pago,$13,$14,$15,$16)`,
        [
          prop.id, it.sitioId, input.fechaInicio, input.fechaFin, it.precio ?? 0,
          it.unidad ?? 'mensual', it.cantidad ?? 1, it.tarifaUnitaria ?? (it.precio ?? 0),
          it.spotsPorDia ?? null, tId,
          // Renta al propietario (opcional). El CHECK `propuesta_items_renta_ck`
          // exige importe y periodicidad juntos, así que se normaliza a null si
          // falta cualquiera de los dos en vez de dejar que reviente la BD.
          it.rentaMonto != null && it.rentaPeriodicidad ? it.rentaMonto : null,
          it.rentaMonto != null && it.rentaPeriodicidad ? it.rentaPeriodicidad : null,
          it.rentaArrendadorId ?? null,
          // REJILLA-01 · la franja CONTRATADA. Ya validada contra el catálogo
          // activo de esta organización en el controller; aquí la red de
          // seguridad es `propuesta_items_franja_fkey`, que es COMPUESTA con el
          // tenant y por tanto no se puede eludir olvidándose de validar.
          it.franjaId ?? null,
          // VOL-01 · el porcentaje y el umbral se guardan JUNTOS y con un
          // respaldo explícito. Un porcentaje sin su umbral es un descuento que
          // nadie puede auditar; el `?? 0` de aquí es el único legítimo de la
          // pareja, porque 0 SÍ significa «sin volumen» en esta columna.
          it.descuentoVolumenPct ?? 0,
          it.volumenDesde ?? null,
        ],
      )
    }
    const items = (
      await client.query('select * from propuesta_items where propuesta_id=$1', [prop.id])
    ).rows
    await client.query('commit')
    return armarPropuesta(prop, items)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Aprobación granular: aprueba/desaprueba un sitio (item) de la propuesta y
// devuelve la propuesta recompuesta (con los totales aprobados al día).
export async function aprobarItem(itemId: string, aprobado: boolean) {
  // Congelado: una propuesta ya APROBADA es inmutable; sus ítems no se editan.
  const est = await q1<any>(
    `select p.estatus from propuesta_items i join propuestas p on p.id=i.propuesta_id where i.id=$1`,
    [itemId],
  )
  if (est?.estatus === 'APROBADA') {
    throw new PropuestaError('La propuesta ya está aprobada y es inmutable; un cambio va como adenda')
  }
  const upd = await q(
    `update propuesta_items set aprobado=$2 where id=$1 returning propuesta_id`,
    [itemId, aprobado],
  )
  if (!upd.length) return null
  const propId = upd[0].propuesta_id
  const p = (await q('select * from propuestas where id=$1', [propId]))[0]
  const items = await q('select * from propuesta_items where propuesta_id=$1', [propId])
  return armarPropuesta(p, items)
}

/** Lo que devuelve `actualizarPropuesta`: la propuesta y qué pasó con el descuento. */
export interface PropuestaActualizada {
  propuesta: Awaited<ReturnType<typeof armarPropuesta>>
  /**
   * TOPE-02 · el descuento que quedó, **solo si cambió de verdad**. `null` = este
   * guardado no lo tocó (se editó el nombre o las notas), y entonces la bitácora
   * no lo menciona. Viaja aparte de la propuesta a propósito: es un dato del
   * CAMBIO, no del documento, y meterlo dentro lo publicaría en la respuesta de
   * la API a todos los clientes.
   */
  descuentoAplicado: number | null
}

// Actualiza campos editables de la propuesta (descuento comercial, nombre,
// notas). Regla de negocio: una propuesta APROBADA es inmutable. Si se cambia
// el descuento de una propuesta ya ENVIADA, sube la versión (renegociación).
export async function actualizarPropuesta(
  id: string,
  input: { descuentoPct?: number; nombre?: string; notas?: string | null },
): Promise<PropuestaActualizada | null> {
  const cur = await q1<any>(
    'select estatus, descuento_pct, codigo_descuento_pct from propuestas where id=$1',
    [id],
  )
  if (!cur) return null
  if (cur.estatus === 'APROBADA') {
    throw new PropuestaError('La propuesta ya está aprobada y es inmutable; un cambio va como adenda')
  }
  const sets: string[] = []
  const vals: any[] = [id]
  let i = 2
  let subeVersion = false
  let descuentoAplicado: number | null = null
  if (input.descuentoPct != null) {
    // `descuentoValido` reemplaza a un recorte que NO recortaba: con un valor
    // que no era número, `Math.max(0, Math.min(100, NaN))` daba `NaN`, y
    // `numeric` de Postgres lo ADMITE y lo propaga. Ver `lib/descuento.ts`.
    //
    // TOPE-01: y además tiene que caber bajo el techo que autoriza ESTA
    // organización. `topeDescuentoDelTenant()` lo lee con contexto de tenant —
    // el techo de una empresa no puede decidirlo la configuración de otra—, y
    // por encima del tope **no se guarda nada**: revienta antes del `update`.
    //
    // VOL-02: y el techo se compara contra el descuento EFECTIVO, o sea el
    // comercial COMPUESTO con el volumen que esta propuesta ya lleva. Es la
    // pregunta de negocio de la Fase 2 y está abierta con el dueño; la
    // respuesta implementada vive entera en `descuentoContraTope`
    // (`lib/descuento.ts`), no aquí.
    //
    // El volumen se lee de las líneas y no se recalcula desde `escalas_volumen`:
    // lo que cuenta es lo que se capturó, no lo que la escala diga hoy.
    const lineas = await q<any>(
      'select precio, descuento_volumen_pct from propuesta_items where propuesta_id=$1',
      [id],
    )
    const volumenPct = volumenDeLineas(
      lineas.map((l) => ({
        precio: Number(l.precio),
        descuentoVolumenPct: Number(l.descuento_volumen_pct ?? 0),
      })),
    ).volumenPctEfectivo
    // COD-02 · el cupón entra como ARGUMENTO aunque hoy no cuente. La decisión
    // de si cuenta o no vive ENTERA en `CODIGO_CUENTA_CONTRA_TOPE`
    // (`lib/descuento.ts`), y está preguntada al dueño; pasarlo desde aquí es lo
    // que hace que cambiar la respuesta sea una constante y no una cacería por
    // los llamantes. Se lee de la propuesta, no de `codigos_promocionales`: lo
    // que cuenta es lo que se canjeó, no lo que el cupón diga hoy.
    const d = descuentoDentroDelTope(
      input.descuentoPct,
      await topeDescuentoDelTenant(),
      volumenPct,
      Number(cur.codigo_descuento_pct ?? 0),
    )
    sets.push(`descuento_pct=$${i++}`)
    vals.push(d)
    // El «cambió de verdad» es UNO y se calcula una sola vez: lo usan la subida
    // de versión (solo si está ENVIADA) y la bitácora (siempre). Tenerlo dos
    // veces sería tener dos definiciones de lo mismo, que es como divergen.
    const cambio = d !== Number(cur.descuento_pct)
    if (cambio) descuentoAplicado = d
    if (cur.estatus === 'ENVIADA' && cambio) subeVersion = true
  }
  if (input.nombre != null) { sets.push(`nombre=$${i++}`); vals.push(input.nombre) }
  if (input.notas !== undefined) { sets.push(`notas=$${i++}`); vals.push(input.notas) }
  if (subeVersion) sets.push('version = version + 1')
  if (sets.length) await q(`update propuestas set ${sets.join(', ')} where id=$1`, vals)

  const p = await q1<any>(
    'select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva from propuestas p where p.id=$1',
    [id],
  )
  const items = await q('select * from propuesta_items where propuesta_id=$1', [id])
  return { propuesta: armarPropuesta(p, items), descuentoAplicado }
}

// S1-2: aprobar una propuesta con Total $0 (p. ej. descuento 100%) exige
// confirmación explícita. El route la mapea a un aviso; el UI reconfirma.
export class PropuestaCeroError extends PropuestaError {}

const ESTATUS_VALIDOS = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA']
export async function cambiarEstatusPropuesta(
  id: string,
  estatus: string,
  opts?: { confirmarCero?: boolean },
) {
  if (!ESTATUS_VALIDOS.includes(estatus)) throw new Error('Estatus inválido')
  // Aprobar exige que la negociación con la agencia esté validada.
  if (estatus === 'APROBADA') {
    const p = await q1<any>('select agencia_id from propuestas where id=$1', [id])
    const bloq = await agenciaBloqueada(p?.agencia_id)
    if (bloq.bloqueada) {
      throw new PropuestaError(
        `La negociación con la agencia ${bloq.nombre ?? ''} no está validada; no se puede aprobar la propuesta`,
      )
    }
    // S1-2: guardarraíl contra aprobar/facturar en $0 sin confirmación.
    const tot = await q1<{ base: string }>(
      // VOL-01 · el volumen entra en la cuenta del guard. Sin esto, una escala
      // al 100 % dejaría la base en cero de verdad y el guard vería el bruto de
      // lista, o sea aprobaría en silencio una propuesta que no cobra nada —
      // que es exactamente lo que este guard existe para impedir.
      // COD-01 · el código entra en la cuenta del guard, igual que el volumen.
      // Sin esto, un cupón al 100 % dejaría la base en cero de verdad y el
      // guard vería el importe de antes del cupón: aprobaría en silencio una
      // propuesta que no cobra nada, que es exactamente lo que existe para
      // impedir.
      `select coalesce(sum(precio * (1 - least(greatest(coalesce(descuento_volumen_pct,0),0),100)/100.0)),0)
                * (1 - coalesce((select descuento_pct from propuestas where id=$1),0)/100.0)
                * (1 - least(greatest(coalesce((select codigo_descuento_pct from propuestas where id=$1),0),0),100)/100.0) as base
         from propuesta_items where propuesta_id=$1`,
      [id],
    )
    if (Number(tot?.base ?? 0) <= 0 && !opts?.confirmarCero) {
      throw new PropuestaCeroError('Estás por aprobar una propuesta con Total $0. Confirma explícitamente para continuar.')
    }
    // Aprobar la propuesta = aceptar sus pantallas. Si no hay ítems marcados,
    // se aprueban TODOS (la campaña se genera sobre todas las pantallas).
    const aprob = await q1<{ n: string }>(
      'select count(*)::text as n from propuesta_items where propuesta_id=$1 and aprobado=true',
      [id],
    )
    if (Number(aprob?.n ?? 0) === 0) {
      await q('update propuesta_items set aprobado=true where propuesta_id=$1', [id])
    }
  }
  const rows = await q(
    `update propuestas set estatus=$2::est_propuesta where id=$1 returning *`,
    [id, estatus],
  )
  if (!rows.length) return null
  // S0-1: al aprobar se congela el snapshot económico (inmutable).
  if (estatus === 'APROBADA') await congelarSnapshotEconomico(id)
  const items = await q('select * from propuesta_items where propuesta_id=$1', [id])
  return armarPropuesta(rows[0], items)
}
