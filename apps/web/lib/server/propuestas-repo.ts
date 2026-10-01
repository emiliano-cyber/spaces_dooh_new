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
import {
  bloqueaAprobacion,
  estadoCodigoDeFila,
  filaParaCliente,
  MSJ_APROBAR_CON_PENDIENTE,
  textoQuitadoAlAceptar,
} from '@/lib/codigo-aprobacion'
import { quitarCanjeEnTx } from './codigos-repo'
import {
  AVISO_PAQUETE_PRECIO_CERRADO,
  avisoPaqueteIncompleto,
  paqueteDeFila,
  repartirPaquete,
} from '@/lib/paquete'
import { rutaLogo } from '@/lib/medios-url'

/**
 * Forma del JSON de `snapshot_economico`. Ausente en los congelados hasta el
 * 2026-09-28 (forma 1). La 2 lleva franja, temporada, volumen y codigo.
 * Se sube SOLO cuando un lector tenga que distinguir formas, no en cada cambio.
 *
 * ─── POR QUE LA 3, y no «son campos opcionales, se queda en 2» ────────────
 * PAQ-01 (Fase 4). La regla escrita al crear esta constante es «subela si un
 * lector tiene que distinguir la forma». Aqui lo tiene que hacer, y no es una
 * opinion: `lib/data/reportes.ts` COMPARA `porSitio[].lista` contra
 * `porSitio[].neto` y llama a la diferencia «descuento comercial mas comision».
 *
 * En las formas 1 y 2 esa lectura siempre valia, porque `neto` SIEMPRE derivaba
 * de `lista` multiplicandola por factores. **En la 3 puede no derivar de ella**:
 * con un paquete, el neto sale del reparto de un precio cerrado que no tiene
 * nada que ver con la lista de esa pantalla. Un lector escrito para la forma 2
 * que se encuentre un snapshot de paquete no calcula de menos: calcula MAL, e
 * inventa un descuento que nadie concedio -- o uno NEGATIVO si el paquete se
 * vendio por encima de la suma de las listas.
 *
 * Es exactamente la diferencia con las fases 2 y 3: el volumen y el cupon
 * anadieron capas, pero `neto` seguia derivando de `lista`. El paquete rompe
 * esa invariante, y romper una invariante ES cambiar la forma aunque todos los
 * campos nuevos sean opcionales.
 *
 * LO QUE CUESTA: un snapshot SIN paquete producido hoy lleva `esquema: 3` y es,
 * por lo demas, byte por byte el mismo JSON que producia la forma 2. O sea que
 * el numero dice «puede haber paquete», no «hay paquete». Se acepta: el numero
 * describe el CONTRATO del que salio el JSON, no su contenido, que es para lo
 * que sirve un numero de forma.
 */
const ESQUEMA_SNAPSHOT = 3


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
  // PAQ-01 · EL PAQUETE CERRADO ENTRA AQUÍ, Y NO COMO UN FACTOR MÁS.
  //
  // Es la diferencia de esta capa con las tres anteriores y la razón por la que
  // el ADR 0039 la puso la última: la franja cambia la TARIFA, el volumen y el
  // cupón MULTIPLICAN un precio ya resuelto, y el paquete lo **sustituye**. Por
  // eso no hay un `factorPaquete` en ninguna parte: hay un `brutoConVolumen`
  // que deja de salir de las líneas y pasa a ser el precio del conjunto.
  //
  // Y por eso el volumen desaparece de la cuenta cuando hay paquete (regla 2
  // del ADR): su precio ya lo lleva dentro, así que aplicarlo encima sería
  // descontar dos veces lo mismo. Las líneas CONSERVAN su
  // `descuento_volumen_pct` —no se borra nada— para que quitar el paquete
  // devuelva los precios de línea exactamente como estaban.
  const paquete = paqueteDeFila(p)
  const descuentoVolumenMonto = paquete ? 0 : vol.descuentoVolumenMonto
  const brutoConVolumen = paquete ? paquete.precio : vol.brutoConVolumen
  const descuentoVolumenPctEfectivo = paquete ? 0 : vol.volumenPctEfectivo
  // El REPARTO del precio cerrado entre las pantallas, a prorrata de su lista y
  // sumando exactamente el precio del paquete (ver `lib/paquete.ts`). Hace
  // falta aquí —y no solo al congelar— porque el documento vivo tiene que poder
  // enseñar cuánto le toca a cada pantalla mientras todavía se negocia.
  const partes = paquete ? repartirPaquete(its.map((i) => i.precio), paquete.precio) : []
  // El aviso de que la propuesta dejó de cuadrar con el paquete que se le
  // aplicó. Se calcula sobre las líneas de HOY contra la composición
  // CONGELADA: es la tercera pregunta de la fase y la respuesta es «se avisa y
  // el precio no se mueve».
  const paqueteAviso = paquete
    ? avisoPaqueteIncompleto(paquete.composicion, its.map((i) => i.sitioId), paquete.nombre, paquete.precio)
    : null
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
  const codigoLeido = Number.isFinite(leidoCod) ? Math.max(0, Math.min(100, leidoCod)) : 0
  // PAQ-01, regla 2 del ADR 0039 · un paquete es PRECIO FINAL y por omisión no
  // admite el cupón encima. La bandera se lee del CONGELADO de la propuesta, no
  // del catálogo: encenderla mañana no puede cambiar el total de una venta que
  // ya se cotizó. Nace apagada, y esto es la segunda red — la primera es que
  // aplicar un paquete que no lo admite sobre una propuesta con cupón se
  // rechaza con una frase (`paquetes-repo.ts`).
  const codigoAnulaPaquete = !!paquete && !paquete.admiteCodigo
  const codigoDescuentoPct = codigoAnulaPaquete ? 0 : codigoLeido
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
  // PAQ-01 · el presupuesto aprobado de un paquete ES EL PRECIO DEL PAQUETE,
  // aunque el cliente acepte solo tres de las cinco pantallas.
  //
  // Es lo mismo que decide `avisoPaqueteIncompleto` y es lo que «precio
  // cerrado» significa. Prorratearlo sobre las aprobadas sería convertir el
  // paquete en un precio unitario disfrazado, y además dejaría al cliente
  // eligiendo su propio descuento: bastaría desmarcar la pantalla más cara.
  const brutoConVolumenAprobado = paquete ? paquete.precio : volAprobado.brutoConVolumen
  const baseComercialAprobado =
    brutoConVolumenAprobado - Math.round(brutoConVolumenAprobado * (descuentoPct / 100))
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
    // PAQ-01 · la parte del precio cerrado que le tocó a cada línea viaja CON
    // la línea. Sin ella la pantalla enseñaría el importe de lista junto a un
    // total que no lo suma, y eso se lee como un defecto del sistema.
    items: its.map((it, i) => ({ ...it, parteDelPaquete: paquete ? (partes[i] ?? 0) : null })),
    bruto,
    // VOL-01. Van los tres: lo regalado por volumen, lo que queda después, y el
    // porcentaje ponderado de la propuesta entera — que es el que se compara
    // contra el tope de la organización.
    descuentoVolumenMonto,
    brutoConVolumen,
    descuentoVolumenPct: descuentoVolumenPctEfectivo,
    // PAQ-01 · el paquete aplicado, con todo lo que hace falta para explicar el
    // importe: cómo se llama, cuánto cuesta, si admite cupón, cuándo se aplicó,
    // con qué pantallas se cotizó y qué le tocó a cada una hoy.
    //
    // `null` cuando no hay paquete, que es el caso de TODA la base instalada —
    // y con `null` todo lo de arriba da el mismo número que antes de esta fase,
    // dígito por dígito. Ése es el invariante que hace que la Fase 4 no mueva
    // una sola venta de las que ya existen.
    paquete: paquete
      ? {
          nombre: paquete.nombre,
          precio: paquete.precio,
          admiteCodigo: paquete.admiteCodigo,
          aplicadoEn: paquete.aplicadoEn,
          composicion: paquete.composicion,
          sitios: its.map((it, i) => ({ sitioId: it.sitioId, parte: partes[i] ?? 0 })),
          aviso: AVISO_PAQUETE_PRECIO_CERRADO,
          // La frase que dice que la propuesta dejó de cuadrar con el paquete.
          // `null` mientras cuadre, que es lo normal.
          avisoComposicion: paqueteAviso,
        }
      : null,
    descuentoMonto,
    // COD-01. Van los tres, igual que con el volumen: qué código fue, cuánto
    // descuenta y cuánto se regaló con él. El documento tiene que poder enseñar
    // «subtotal − volumen − comercial − CÓDIGO» en vez de un número más bajo sin
    // explicación; un importe que no cuadra con su propia cuenta se lee como un
    // defecto del sistema.
    codigoTexto,
    codigoDescuentoPct,
    codigoDescuentoMonto,
    // COD-03 · en qué estado está el cupón, para la pantalla INTERNA (la marca
    // «cupón pendiente» de la lista y la etiqueta del detalle). Los importes de
    // arriba NO cambian con el estado: por dentro, un cupón pendiente sigue
    // contando, porque es lo que el vendedor está ofreciendo. Quien lo quita
    // para el CLIENTE es `obtenerPropuestaPublica`, filtrando la fila antes de
    // armar — por eso este campo NO viaja al objeto público, que se arma a mano.
    codigoEstado: estadoCodigoDeFila(p),
    codigoAprobadoEn: p.codigo_aprobado_en ? iso(p.codigo_aprobado_en) : null,
    codigoAprobadoPor: p.codigo_aprobado_por_nombre ?? null,
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
  // PAQ-01 · EL PAQUETE SE CONGELA DESDE LA PROPIA PROPUESTA y no se vuelve a
  // consultar `paquetes`. Misma decisión que el cupón de la Fase 3 y misma
  // diferencia con la franja de la Fase 1, que sí relee su catálogo para poder
  // congelar el nombre: aquí el nombre, el precio, la bandera y la composición
  // ya están copiados en `propuestas` desde que se aplicó, así que **cambiar,
  // desactivar o borrar el paquete no puede alcanzar a una venta ni antes ni
  // después de aprobarla**. Dos redes, no una — es el invariante 4 del ADR 0039
  // y aquí pesa más que en ninguna de las cuatro fases, porque el paquete no
  // modifica un porcentaje: sustituye el importe entero.
  const paquete = paqueteDeFila(prop)
  // El precio del conjunto SUSTITUYE la suma de las listas y, con él, el
  // volumen deja de existir en la cuenta (regla 2 del ADR): su precio ya lo
  // lleva dentro.
  const brutoConVolumen = paquete ? paquete.precio : vol.brutoConVolumen
  // EL REPARTO, y es lo que decide si esta fase está bien hecha. A prorrata de
  // la lista de cada línea y sumando EXACTAMENTE el precio del paquete: es de
  // aquí de donde sale `reservas.precio`, o sea el ingreso por pantalla del
  // reporte de rentabilidad y lo que se compara contra la renta del arrendador.
  const partes = paquete ? repartirPaquete(usar.map((it) => Number(it.precio)), paquete.precio) : []
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
  const codigoLeido = Number.isFinite(leidoCod) ? Math.max(0, Math.min(100, leidoCod)) : 0
  // PAQ-01, regla 2 · el cupón NO entra sobre un paquete salvo que ese paquete
  // lo admita, y la bandera se lee del congelado de la propuesta.
  const codigoPct = paquete && !paquete.admiteCodigo ? 0 : codigoLeido
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
  const porSitio = usar.map((it, idx) => {
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
      // PAQ-01 · CON PAQUETE, EL NETO SALE DEL REPARTO Y NO DE LA LISTA. Es la
      // única capa de las cuatro que cambia de dónde sale este número, y por
      // eso `porSitio[]` lleva la marca `paquete` justo debajo: el reporte de
      // publicada contra neta tiene que poder saber que aquí la lista y el neto
      // ya no están emparentados.
      //
      // El volumen desaparece de la multiplicación (regla 2 del ADR): la parte
      // ya es el precio final del conjunto repartido.
      neto: paquete
        ? Math.round((partes[idx] ?? 0) * factorDesc * factorCodigo * divisor)
        : Math.round(Number(it.precio) * factorVol * factorDesc * factorCodigo * divisor),
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
      ...(!paquete && factorVol !== 1
        ? { descuentoVolumenPct: volPct, volumenDesde: it.volumen_desde != null ? Number(it.volumen_desde) : null }
        : {}),
      // PAQ-01 · LA MARCA, y es lo único que impide que el reporte «publicada
      // vs neta» mienta.
      //
      // Ese reporte compara `lista` contra `neto` y llama a la diferencia
      // «descuento comercial más comisión de agencia». Con un paquete esa frase
      // es falsa: el neto salió de repartir un precio cerrado, no de descontar
      // la lista. Peor aún, un paquete vendido POR ENCIMA de la suma de las
      // listas —que es un paquete legítimo: se venden conjuntos premium— daría
      // un descuento NEGATIVO, que se leería como haber cobrado por encima de
      // la tarifa publicada.
      //
      // Con la marca, `lib/data/reportes.ts` deja esas reservas FUERA de la
      // comparación y las cuenta en la cobertura, con su frase. Es la misma
      // decisión que ese módulo ya toma con el centinela de ambigüedad: se
      // niega a comparar lo que no sabe que es comparable.
      //
      // Solo cuando hay paquete, igual que la franja y el volumen: así el
      // snapshot de una venta sin paquete es byte por byte el mismo JSON.
      ...(paquete ? { paquete: true } : {}),
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
  // PAQ-01 · y con paquete NO HAY VOLUMEN QUE CONGELAR, por bien que las líneas
  // lo lleven capturado: el precio del conjunto ya lo lleva dentro (regla 2).
  // Congelarlo igualmente dejaría en el documento un «−20 % por volumen» que no
  // se restó de ningún importe.
  const hayVolumen = !paquete && vol.descuentoVolumenMonto !== 0

  // PAQ-01 · ¿las pantallas que se aprueban siguen siendo las que formaban el
  // paquete? Se calcula UNA vez, sobre las mismas líneas que se congelan.
  const avisoComposicion = paquete
    ? avisoPaqueteIncompleto(
        paquete.composicion,
        usar.map((it) => String(it.sitio_id)),
        paquete.nombre,
        paquete.precio,
      )
    : null

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
    // `esquema` dice de QUE FORMA es este JSON; `version` es la revision de la
    // PROPUESTA y sube al renegociar con el cliente. Son dos cosas distintas y
    // no se mezclan: reutilizar `version` para las dos pegaria dos significados
    // que despues ya no se pueden separar.
    //
    // Ausente = forma 1, todo lo congelado antes del 2026-09-28. La forma 2
    // lleva franja y temporada (Fase 1), volumen (Fase 2) y codigo promocional
    // (Fase 3) del ADR 0039.
    //
    // Se anade AHORA y no cuando haga falta, por una razon aritmetica: un
    // snapshot congelado no se reescribe nunca (`:211`), asi que el dia que un
    // lector necesite distinguir viejo de nuevo ya no habra forma de marcarlo
    // hacia atras.
    esquema: ESQUEMA_SNAPSHOT,
    version, bruto,
    // PAQ-01 · EL CONGELADO DEL PAQUETE. Va ARRIBA de todo lo demás porque es
    // lo que explica por qué `base` no sale de `bruto`, y quien lea este JSON
    // tiene que encontrarse con eso antes que con las cuentas.
    //
    // Van las SEIS cosas y ninguna sobra:
    //  · `nombre`, porque un «180 000» sin decir de qué paquete salió no se
    //    puede auditar seis meses después — nadie sabrá si fue una promoción o
    //    un dedazo. Mismo motivo por el que el cupón congela su texto;
    //  · `precio`, porque ES la venta: no un porcentaje sobre ella;
    //  · `admiteCodigo`, porque decide si el cupón de al lado descontó o no, y
    //    sin ella el JSON no se puede recalcular;
    //  · `aplicadoEn`, el momento;
    //  · `composicion`, **con qué pantallas se cotizó**, que es lo que el
    //    encargo de esta fase pide con todas las letras;
    //  · y `sitios`, el REPARTO — qué le tocó a cada pantalla. Sin él, dentro
    //    de seis meses nadie podrá reconstruir por qué esa pantalla facturó eso,
    //    porque su importe no sale de ninguna multiplicación de su tarifa.
    //
    // Solo cuando hay paquete: así el snapshot de una venta sin paquete es byte
    // por byte el mismo JSON que producía la Fase 3 (salvo `esquema`).
    ...(paquete
      ? {
          paquete: {
            nombre: paquete.nombre,
            precio: paquete.precio,
            admiteCodigo: paquete.admiteCodigo,
            aplicadoEn: paquete.aplicadoEn,
            composicion: paquete.composicion,
            sitios: usar.map((it, i) => ({
              sitioId: String(it.sitio_id),
              parte: partes[i] ?? 0,
            })),
            aviso: AVISO_PAQUETE_PRECIO_CERRADO,
            // Y si al aprobar las pantallas ya no eran las que formaban el
            // paquete, eso queda ESCRITO en el documento congelado. Callarlo
            // dejaría un precio de cinco pantallas cobrado por cuatro sin que
            // el papel dijera nada, que es la misma familia de fallo que el
            // `?? 0` del mapa.
            ...(avisoComposicion ? { avisoComposicion } : {}),
          },
        }
      : {}),
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
  const pLeida = await qPub1<any>(
    `select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva
       from propuestas p
      where p.token_publico = $1
      limit 1`,
    [cod],
  )
  if (!pLeida) return null
  // COD-03 · ⚠️ EL CUPÓN PENDIENTE NO EXISTE PARA EL CLIENTE. Decisión 3 del
  // dueño: «no se muestra al cliente hasta que un admin o gerente lo apruebe»,
  // y la 4 (opción B): mientras tanto ve la propuesta SIN el descuento.
  //
  // Se quita de la FILA, antes de `armarPropuesta`, y no del objeto de salida:
  // así el texto no llega al JSON y TODOS los importes —monto del código, base,
  // neto, IVA, total, los «aprobados»— salen sin él por construcción. Un filtro
  // a la salida tendría que acordarse de cada uno, y este objeto ya se ha
  // olvidado campos dos veces (ver el comentario del volumen, abajo).
  //
  // Esconderlo solo en `/p/[id]` no serviría: el JSON se lee con las
  // herramientas del navegador, y un cliente que ve «VERANO20 −20 %» en la
  // respuesta lo tiene por prometido.
  const p = filaParaCliente(pLeida)
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
    // PAQ-01 · Y EL PAQUETE, que de las cuatro capas es la que MÁS falta hace
    // aquí: es la única que no modifica el importe sino que lo sustituye.
    //
    // Sin esta línea, el documento que el cliente firma enseñaría «subtotal
    // 250 000» junto a un total de 208 800 y ni una palabra que explicara los
    // 70 000 de diferencia. Las otras capas al menos se pueden intuir como un
    // descuento; un precio de conjunto no se intuye, se dice.
    //
    // Este objeto se arma A MANO, campo por campo: añadir un dato a
    // `armarPropuesta` NO basta para que llegue aquí. Es el mismo olvido que la
    // Fase 2 encontró revisando el diff y la Fase 3 volvió a encontrar, y por
    // eso esta vez tiene prueba propia (`propuestas-repo-paquete.test.ts`).
    paquete: armado.paquete,
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
        // PAQ-01 · qué parte del precio del paquete le tocó a ESTA pantalla.
        // `null` sin paquete. Si no viajara, el cliente vería el importe de
        // lista de cada renglón y un total que no los suma — y la resta que le
        // saldría no sería ninguno de los descuentos que el documento nombra.
        parteDelPaquete: it.parteDelPaquete,
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

    // COD-03 · REGLA DERIVADA (no es palabra del dueño; la propuso la sesión
    // principal para que el dinero cuadre con la opción B): si el cliente
    // acepta con el cupón PENDIENTE, acepta EL PRECIO QUE VIO, que es sin
    // cupón. Aquí, DENTRO de la transacción de la aceptación y con la fila
    // bloqueada, se quita el cupón y se DEVUELVE SU USO —la misma
    // `quitarCanjeEnTx` que usa quitarlo a mano— antes de pasar a APROBADA.
    // El snapshot se congela DESPUÉS del commit, así que lee la propuesta ya
    // sin cupón: lo firmado nunca lleva un descuento que nadie aprobó.
    //
    // El bloqueo (`for no key update`) es lo que impide que un gerente apruebe
    // el cupón A LA VEZ: quien llegue segundo espera y lee lo que dejó el
    // primero. Si el gerente gana, el cupón ya está APROBADO al llegar aquí y
    // se conserva — el cliente paga MENOS de lo que vio, nunca más. Es el único
    // lado en que esa carrera puede caer, y es el de la promesa cumplida.
    const cup = (
      await client.query(
        `select codigo_texto, codigo_estado from propuestas
          where id=$1 and tenant_id=$2 for no key update`,
        [p.id, p.tenant_id],
      )
    ).rows[0]
    if (cup && estadoCodigoDeFila(cup) === 'PENDIENTE') {
      await quitarCanjeEnTx(client, p.id, p.tenant_id)
      // A mano y no con `registrarAccion()`: aquí no hay sesión de la que
      // sacar el tenant, y la línea tiene que ir en esta misma transacción.
      await client.query(
        `insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id)
         values ($1,$2,null,$3,$4)`,
        [
          textoQuitadoAlAceptar(String(cup.codigo_texto)),
          `${p.folio} · ${p.nombre}`,
          `Cliente (liga pública): ${nombre}`,
          p.tenant_id,
        ],
      )
    }

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
  // COD-03 · el NOMBRE de quien aprobó el cupón viaja con la propuesta, para
  // que el detalle diga «Aprobado por X». Subconsulta con
  // `u.tenant_id = p.tenant_id` como segunda capa: un id de usuario de otra
  // organización no le pone nombre a una aprobación de ésta.
  const props = await q(
    `select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva,
            (select u.nombre from usuarios u
              where u.id = p.codigo_aprobado_por and u.tenant_id = p.tenant_id) as codigo_aprobado_por_nombre
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
    // PAQ-01 · las columnas del paquete entran en esta lectura porque deciden
    // DOS cosas del tope: si el volumen de las líneas cuenta (no cuenta, porque
    // no se aplicó) y si el cupón descuenta (solo si el paquete lo admite).
    `select estatus, descuento_pct, codigo_descuento_pct,
            paquete_nombre, paquete_precio, paquete_admite_codigo
       from propuestas where id=$1`,
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
    //
    // PAQ-01 · Y CON PAQUETE, EL VOLUMEN NO CUENTA CONTRA EL TOPE, porque no se
    // aplicó: el precio del conjunto lo sustituyó entero (regla 2 del ADR). Si
    // contara, a un vendedor le rechazarían un descuento comercial por un
    // volumen que el cliente nunca recibió, y el mensaje de error le nombraría
    // un porcentaje que no aparece en ninguna parte de su cotización.
    const paqueteVivo = paqueteDeFila(cur)
    const volumenPct = paqueteVivo
      ? 0
      : volumenDeLineas(
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
      // PAQ-01 · y el cupón tampoco cuenta si el paquete no lo admite, por la
      // misma razón: no descontó nada. (Hoy `CODIGO_CUENTA_CONTRA_TOPE` es
      // `false`, así que este argumento se anula después de todas formas; se
      // pasa bien igualmente para que el día que el dueño cambie esa constante
      // no haya que volver a buscar los llamantes.)
      paqueteVivo && !paqueteVivo.admiteCodigo ? 0 : Number(cur.codigo_descuento_pct ?? 0),
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

// COD-03 · aprobar por dentro con el cupón PENDIENTE. Clase propia para que la
// ruta lo mapee a 409 sin cambiar el 400 que hoy devuelven los demás
// `PropuestaError` de esa ruta (agencia sin validar, estatus inválido).
export class CodigoPendienteError extends PropuestaError {}

const ESTATUS_VALIDOS = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA']
export async function cambiarEstatusPropuesta(
  id: string,
  estatus: string,
  opts?: { confirmarCero?: boolean },
) {
  if (!ESTATUS_VALIDOS.includes(estatus)) throw new Error('Estatus inválido')
  // Aprobar exige que la negociación con la agencia esté validada.
  if (estatus === 'APROBADA') {
    // COD-03 · REGLA DERIVADA: con el cupón PENDIENTE no se aprueba por dentro.
    // Aprobar congela el snapshot, y el snapshot congelaría un descuento que
    // nadie aprobó —y que el cliente ni siquiera ha visto—. Va PRIMERO, antes
    // que cualquier otra comprobación: es la que dice qué hacer («aprueba o
    // rechaza el código»), y las demás no tienen sentido hasta resolverla.
    //
    // Si la propuesta no es de esta organización, `c` sale null y se sigue
    // como antes: los guards de abajo son los que contestan ese caso, y
    // `aislamiento.e2e.test.ts` fija lo que contestan.
    const c = await q1<any>(
      'select codigo_texto, codigo_estado from propuestas where id=$1 and tenant_id=$2',
      [id, await tenantActual()],
    )
    if (c && bloqueaAprobacion(estadoCodigoDeFila(c))) {
      throw new CodigoPendienteError(MSJ_APROBAR_CON_PENDIENTE)
    }
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
      // PAQ-01 · el paquete entra en el guard SUSTITUYENDO la suma, que es lo
      // que hace en todas partes. Sin esto el guard miraría la suma de las
      // listas, y eso falla por los DOS lados: dejaría aprobar en silencio un
      // paquete de precio 0 con listas altas —justo lo que existe para impedir—
      // y bloquearía una venta legítima de un paquete de 180 000 cuyas líneas
      // se capturaron todas a tarifa 0.
      //
      // Y el cupón solo cuenta si el paquete lo admite (regla 2 del ADR): con
      // un paquete de precio final, un cupón al 100 % no deja la base en cero
      // porque no se aplica.
      `select coalesce(
                (select paquete_precio from propuestas where id=$1),
                coalesce(sum(precio * (1 - least(greatest(coalesce(descuento_volumen_pct,0),0),100)/100.0)),0)
              )
                * (1 - coalesce((select descuento_pct from propuestas where id=$1),0)/100.0)
                * (1 - case when (select paquete_precio from propuestas where id=$1) is not null
                             and not (select paquete_admite_codigo from propuestas where id=$1)
                        then 0
                        else least(greatest(coalesce((select codigo_descuento_pct from propuestas where id=$1),0),0),100)
                        end / 100.0) as base
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
  // COD-03 · la segunda red de la regla de arriba, y la que de verdad cierra la
  // carrera: entre la comprobación y este update, alguien pudo aplicar un
  // cupón (el canje bloquea la fila y lo deja PENDIENTE). Con la condición en
  // el `where`, Postgres la reevalúa sobre la versión de la fila que gana el
  // bloqueo, así que una APROBADA nunca queda con el cupón pendiente.
  const rows = await q(
    `update propuestas set estatus=$2::est_propuesta
      where id=$1
        and ($2::text <> 'APROBADA' or codigo_estado is distinct from 'PENDIENTE')
      returning *`,
    [id, estatus],
  )
  if (!rows.length) {
    if (estatus === 'APROBADA') {
      const c = await q1<any>(
        'select codigo_texto, codigo_estado from propuestas where id=$1 and tenant_id=$2',
        [id, await tenantActual()],
      )
      if (c && bloqueaAprobacion(estadoCodigoDeFila(c))) {
        throw new CodigoPendienteError(MSJ_APROBAR_CON_PENDIENTE)
      }
    }
    return null
  }
  // S0-1: al aprobar se congela el snapshot económico (inmutable).
  if (estatus === 'APROBADA') await congelarSnapshotEconomico(id)
  const items = await q('select * from propuesta_items where propuesta_id=$1', [id])
  return armarPropuesta(rows[0], items)
}
