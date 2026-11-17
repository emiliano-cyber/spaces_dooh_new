// ============================================================================
//  lib/seguimiento-campana.ts — el SEGUIMIENTO que ve el cliente en su liga
// ----------------------------------------------------------------------------
//  Pedido del dueño (17/11): «la ficha de la liga de la propuesta, tipo Mercado
//  Libre: cuando la propuesta ya no es propuesta sino campaña, el creativo o la
//  imprenta seleccionados y cómo va su avance, para que el cliente lo vea».
//
//  Funciones PURAS: el servidor (`seguimiento-publico-controller.ts`) las usa
//  para armar la respuesta y las pruebas las ejercen sin base ni React.
//
//  ─── Por qué NO es el pipeline de Campañas ─────────────────────────────────
//  `ETAPAS_PIPELINE` (lib/data/derive.ts) tiene 13 etapas pensadas para la
//  operación: OC recibida, candado, lista para facturar, facturada… Nada de eso
//  es asunto del cliente, y enseñarle «OC recibida» o «Lista para facturar» en
//  su liga es filtrarle el estado interno de cobranza. Aquí hay SEIS pasos en su
//  idioma, y ninguno se deriva de dinero: se deriva de lo que ÉL percibe (su
//  arte, su lona, su pantalla encendida).
//
//  Los textos NO viven aquí: cada paso lleva una `clave` que la página traduce
//  (ADR 0048, la liga la abre el cliente con el idioma de su navegador).
// ============================================================================

export type TipoCampanaSeg = 'OOH' | 'DOOH' | 'HIBRIDA'

export type ClavePaso = 'aceptada' | 'confirmada' | 'material' | 'instalacion' | 'al_aire' | 'finalizada'

/** hecho = ya pasó · actual = en esto estamos · alerta = actual pero detenido (p. ej. arte rechazado) */
export type EstadoPaso = 'hecho' | 'actual' | 'alerta' | 'pendiente'

export interface PasoSeguimiento {
  clave: ClavePaso
  estado: EstadoPaso
  /** Cuándo se cumplió (ISO). `null` si no se ha cumplido o no se sabe. */
  fecha: string | null
}

export type EstatusCreativo = 'PENDIENTE' | 'VALIDADA' | 'RECHAZADA'
export const PROCESO_IMPRENTA = ['ARTE_RECIBIDO', 'VALIDADO', 'EN_PRODUCCION', 'IMPRESO', 'LISTO_MONTAJE'] as const
export type EstatusImprenta = (typeof PROCESO_IMPRENTA)[number]

/** Lo que el modelo lee de la base, ya sin nada interno. */
export interface DatosSeguimiento {
  aceptadoEn: string | null
  campana: {
    folio: string | null
    nombre: string
    tipo: TipoCampanaSeg
    estado: string // est_comercial_campana
    fechaInicio: string // YYYY-MM-DD
    fechaFin: string // YYYY-MM-DD
    creadaEn: string | null
    publicada: boolean // enviada al CMS Y aprobada por el revisor
    publicadaEn: string | null
  }
  creativos: { nombre: string; formato: string | null; resolucion: string | null; estatus: EstatusCreativo; creadoEn: string | null }[]
  imprenta: {
    folio: string | null
    sitioNombre: string | null
    proveedor: string | null
    material: string | null
    alto: number | null
    ancho: number | null
    estatus: EstatusImprenta
    pruebaColorAprobada: boolean
    actualizadoEn: string | null
  }[]
  montajes: { estatus: string; fechaCompletada: string | null }[]
}

export interface Seguimiento {
  folio: string | null
  nombre: string
  tipo: TipoCampanaSeg
  fechaInicio: string
  fechaFin: string
  cancelada: boolean
  /** El paso en el que está la campaña (el `actual`/`alerta`, o el último si terminó). */
  pasoActual: ClavePaso
  /** Mensaje grande del encabezado: la página lo traduce como `seguimiento.mensaje.<clave>`. */
  mensaje: string
  pasos: PasoSeguimiento[]
  creativos: (DatosSeguimiento['creativos'][number])[]
  imprenta: (DatosSeguimiento['imprenta'][number] & { avance: number })[]
  /** Resumen de la imprenta: cuántas lonas van listas (IMPRESO o LISTO_MONTAJE) de cuántas. */
  imprentaListas: number
  /** Las imprentas distintas que están trabajando la campaña (sin repetir, sin vacíos). */
  proveedores: string[]
}

const ORDEN: ClavePaso[] = ['aceptada', 'confirmada', 'material', 'instalacion', 'al_aire', 'finalizada']

const usaImprenta = (t: TipoCampanaSeg) => t === 'OOH' || t === 'HIBRIDA'
const usaCreativo = (t: TipoCampanaSeg) => t === 'DOOH' || t === 'HIBRIDA'

/** 0..1 — cuánto lleva una orden de imprenta dentro de sus cinco estatus. */
export function avanceImprenta(estatus: EstatusImprenta): number {
  const i = PROCESO_IMPRENTA.indexOf(estatus)
  return i < 0 ? 0 : (i + 1) / PROCESO_IMPRENTA.length
}

const listaImprenta = (e: EstatusImprenta) => e === 'IMPRESO' || e === 'LISTO_MONTAJE'

const max = (fechas: (string | null | undefined)[]): string | null =>
  fechas.filter((f): f is string => !!f).sort().at(-1) ?? null

/**
 * Arma el seguimiento a partir de los datos. `hoy` es `YYYY-MM-DD` y se recibe
 * de fuera para que las pruebas no dependan del reloj (lección de
 * `ocupacion-idioma`, que fechaba con el reloj real y se rompió un día).
 */
export function armarSeguimiento(d: DatosSeguimiento, hoy: string): Seguimiento {
  const c = d.campana
  const tipo = c.tipo

  // ─── El material: arte digital y/o lona impresa ──────────────────────────
  // Digital: listo con UN creativo validado (es lo que sale al aire). Detenido
  // si hay rechazados y ninguno validado: el cliente tiene que mandar otro, y es
  // lo único de toda la línea que depende de él — por eso se marca en alerta.
  const creaValidado = d.creativos.some((x) => x.estatus === 'VALIDADA')
  const creaDetenido = !creaValidado && d.creativos.length > 0 && d.creativos.every((x) => x.estatus === 'RECHAZADA')
  const creaListo = !usaCreativo(tipo) || creaValidado || c.publicada
  // Impresa: lista cuando TODAS las órdenes están impresas. Sin órdenes no está
  // lista: una OOH sin orden de imprenta todavía no ha empezado su material.
  const imprentaListas = d.imprenta.filter((o) => listaImprenta(o.estatus)).length
  const impListo = !usaImprenta(tipo) || (d.imprenta.length > 0 && imprentaListas === d.imprenta.length)
  const materialListo = creaListo && impListo
  const materialFecha = materialListo
    ? max([
        ...d.creativos.filter((x) => x.estatus === 'VALIDADA').map((x) => x.creadoEn),
        ...d.imprenta.map((o) => o.actualizadoEn),
      ])
    : null

  // ─── Instalación / publicación ───────────────────────────────────────────
  const montada = d.montajes.some((m) => m.estatus === 'COMPLETADA')
  const instListo = (!usaImprenta(tipo) || montada) && (!usaCreativo(tipo) || c.publicada)
  const instFecha = instListo
    ? max([...d.montajes.filter((m) => m.estatus === 'COMPLETADA').map((m) => m.fechaCompletada), c.publicadaEn])
    : null

  // ─── En el aire y terminada: por fechas, que es lo que el cliente entiende
  // por «mi campaña está corriendo». Al aire exige estar instalada: una lona
  // sin montar no está al aire aunque el calendario diga que ya empezó.
  const terminada = c.estado === 'COMPLETADA' || c.estado === 'LISTA_FACTURAR' || hoy > c.fechaFin
  const alAire = instListo && (hoy >= c.fechaInicio || terminada)

  const cumplido: Record<ClavePaso, boolean> = {
    aceptada: true, // si hay campaña, la propuesta se aceptó (aunque no por la liga)
    confirmada: true,
    material: materialListo,
    instalacion: instListo,
    al_aire: alAire,
    finalizada: terminada && instListo,
  }
  const fechas: Record<ClavePaso, string | null> = {
    aceptada: d.aceptadoEn,
    confirmada: c.creadaEn,
    material: materialFecha,
    instalacion: instFecha,
    // Al aire desde lo que pase DESPUÉS: el arranque contratado o la instalación.
    al_aire: alAire ? max([c.fechaInicio, instFecha?.slice(0, 10)]) : null,
    finalizada: cumplido.finalizada ? c.fechaFin : null,
  }

  // El paso actual es el PRIMERO sin cumplir; los de después quedan pendientes
  // aunque alguno «se cumpla» suelto (p. ej. fecha de fin pasada sin instalar):
  // una línea de seguimiento no tiene huecos.
  const iActual = ORDEN.findIndex((k) => !cumplido[k])
  const pasos: PasoSeguimiento[] = ORDEN.map((clave, i) => {
    const hecho = iActual === -1 || i < iActual
    const estado: EstadoPaso = hecho
      ? 'hecho'
      : i === iActual
        ? clave === 'material' && creaDetenido
          ? 'alerta'
          : 'actual'
        : 'pendiente'
    return { clave, estado, fecha: hecho ? fechas[clave] : null }
  })
  const pasoActual = iActual === -1 ? 'finalizada' : ORDEN[iActual]

  const cancelada = c.estado === 'CANCELADA'
  let mensaje: string
  if (cancelada) mensaje = 'cancelada'
  else if (pasoActual === 'material') {
    mensaje = creaDetenido
      ? 'material.rechazado'
      : usaImprenta(tipo) && !usaCreativo(tipo)
        ? d.imprenta.length === 0 ? 'material.esperando-arte' : 'material.imprenta'
        : usaCreativo(tipo) && !usaImprenta(tipo)
          ? d.creativos.length === 0 ? 'material.esperando-arte' : 'material.revision'
          : 'material.hibrida'
  } else if (pasoActual === 'instalacion') {
    mensaje = usaImprenta(tipo) && !usaCreativo(tipo) ? 'instalacion.montaje' : usaCreativo(tipo) && !usaImprenta(tipo) ? 'instalacion.publicacion' : 'instalacion.hibrida'
  } else if (iActual === -1) mensaje = 'finalizada'
  else mensaje = pasoActual

  const proveedores = [...new Set(d.imprenta.map((o) => (o.proveedor ?? '').trim()).filter(Boolean))]

  return {
    folio: c.folio,
    nombre: c.nombre,
    tipo,
    fechaInicio: c.fechaInicio,
    fechaFin: c.fechaFin,
    cancelada,
    pasoActual,
    mensaje,
    pasos,
    creativos: usaCreativo(tipo) ? d.creativos : [],
    imprenta: usaImprenta(tipo) ? d.imprenta.map((o) => ({ ...o, avance: avanceImprenta(o.estatus) })) : [],
    imprentaListas: usaImprenta(tipo) ? imprentaListas : 0,
    proveedores: usaImprenta(tipo) ? proveedores : [],
  }
}

// ─── ¿Quién puede enseñarle al cliente el nombre de la imprenta? ────────────
// Decisión del dueño (17/11): oculto SIEMPRE por omisión; lo enciende «el
// vendedor que creó la propuesta o cualquiera superior». Superior es por la
// escalera de venta del ADR 0040. Dueño y Administrador pueden siempre (el
// Administrador «puede hacer las mismas cosas que él»). Un rol fuera de venta
// (Operaciones, Imprenta, Finanzas) no puede nunca, aunque haya creado la
// propuesta por algún camino viejo: es una decisión comercial.
const RANGO_VENTA: Record<string, number> = {
  DUENO: 4,
  ADMINISTRADOR: 4,
  DIRECTOR_COMERCIAL: 3,
  GERENTE_VENTAS: 2,
  VENDEDOR: 1,
  COMERCIAL: 1, // retirado (ADR 0040), pero una fila vieja puede traerlo
}
const rangoVenta = (rol: string | null | undefined) => RANGO_VENTA[rol ?? ''] ?? 0

export function puedeCambiarImprentaVisible(
  usuario: { id: string; rol: string },
  propuesta: { usuarioId: string | null; rolCreador: string | null },
): boolean {
  const mio = rangoVenta(usuario.rol)
  if (mio === 0) return false
  if (mio === 4) return true
  if (propuesta.usuarioId && propuesta.usuarioId === usuario.id) return true
  // Creador borrado o sin registrar (`usuario_id` es on delete set null): se le
  // trata como vendedor, que es lo que era casi siempre, y decide un superior.
  const creador = propuesta.usuarioId && propuesta.rolCreador ? rangoVenta(propuesta.rolCreador) : 1
  return mio > creador
}
