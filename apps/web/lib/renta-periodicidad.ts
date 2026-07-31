// ============================================================================
//  lib/renta-periodicidad.ts — Periodicidad de la renta al arrendador.
//
//  Fuente ÚNICA del enum `periodicidad_pago`: su etiqueta, su equivalente
//  mensual, el avance de vencimientos del calendario de pagos y el margen con
//  el que se avisa cada cadencia.
//
//  Antes vivía duplicado en cuatro sitios (arrendadores-repo, derive.ts, la
//  página de Arrendadores y la de Propuestas) más tres tablas de etiquetas en
//  componentes. Añadir una periodicidad a una copia y olvidar otra NO rompe
//  nada visible: el `?? 1` de cada tabla la trata como mensual y el P&L
//  subestima la renta en silencio. Para DIARIA el error sería de 30×, que es el
//  peor modo de fallo posible en el número que sostiene el margen.
//
//  NO lleva 'server-only' a propósito: lo importan el repo (servidor) y los
//  componentes de Inventario/Comercial/Propuestas (cliente). Mismo patrón que
//  lib/finanzas-calculo.ts. Ojo: ese módulo tiene su propio `PeriodicidadCuota`
//  y NO es este — aquel es el cobro en parcialidades AL CLIENTE, este es el
//  pago de renta AL ARRENDADOR. Enums distintos, dominios distintos.
// ============================================================================

// Espejo exacto del enum `periodicidad_pago` de la BD, de mayor a menor
// frecuencia. Es una tupla `as const` y no un array suelto porque los esquemas
// zod de los controladores la consumen con `z.enum(...)`, que exige tupla: así
// la compuerta de validación de la API y el enum de la BD no pueden divergir.
// Esa divergencia no es teórica — es el fallo concreto de ofrecer en la UI una
// periodicidad que el servidor rechaza con 400, o peor, de aceptar una que la
// BD no conoce y que revienta al insertar.
export const PERIODICIDAD_VALUES = [
  'DIARIA', 'SEMANAL', 'CATORCENAL', 'QUINCENAL', 'MENSUAL',
  'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL',
] as const

export type PeriodicidadRenta = (typeof PERIODICIDAD_VALUES)[number]

export const PERIODICIDAD_RENTA_LABEL: Record<PeriodicidadRenta, string> = {
  DIARIA: 'Diaria',
  SEMANAL: 'Semanal',
  CATORCENAL: 'Catorcenal (cada 14 días)',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
}

// Lista para pintar selectores. Se DERIVA de la tupla en vez de escribirse
// aparte: una lista propia podría olvidarse un valor y esconderlo de la UI.
export const PERIODICIDADES: { value: PeriodicidadRenta; label: string }[] =
  PERIODICIDAD_VALUES.map((value) => ({ value, label: PERIODICIDAD_RENTA_LABEL[value] }))

// Etiqueta para pintar. Tolera nulos (contrato INCOMPLETO, ADR 0001) y
// etiquetas legacy en minúscula que dejó el seed antes de la migración M3.
export function periodicidadLabel(p: string | null | undefined, vacio = '—'): string {
  if (!p) return vacio
  const k = p.toUpperCase() as PeriodicidadRenta
  return PERIODICIDAD_RENTA_LABEL[k] ?? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

// ─── Equivalente mensual ────────────────────────────────────────────────────
// Todo el módulo asume el mes comercial de 30 días. No es una aproximación
// nueva: es el supuesto que ya traía SEMANAL (×30/7) desde la migración M3, y
// cambiarlo ahora movería el costo de renta histórico de todos los contratos
// semanales. DIARIA ×30 se suma a ese mismo supuesto.
export const FACTOR_MENSUAL: Record<PeriodicidadRenta, number> = {
  DIARIA: 30, SEMANAL: 30 / 7, CATORCENAL: 30 / 14, QUINCENAL: 2, MENSUAL: 1,
  BIMESTRAL: 1 / 2, TRIMESTRAL: 1 / 3, SEMESTRAL: 1 / 6, ANUAL: 1 / 12,
}

// Factor de una periodicidad cualquiera. Las etiquetas legacy (minúsculas, o
// 'anual'/'año'/'yearly' del seed viejo) se reconocen por subcadena antes de
// caer en el default mensual. El orden de las comprobaciones importa:
// 'diaria' NO debe entrar por 'anu', y por eso 'dia' se prueba al final —
// ninguna otra etiqueta lo contiene.
export function factorMensual(periodicidad: string | null | undefined): number {
  const p = (periodicidad || '').toUpperCase()
  if (p in FACTOR_MENSUAL) return FACTOR_MENSUAL[p as PeriodicidadRenta]
  const per = p.toLowerCase()
  if (per.includes('anu') || per.includes('año') || per.includes('year')) return 1 / 12
  if (per.includes('semestr')) return 1 / 6
  if (per.includes('trimestr')) return 1 / 3
  if (per.includes('bimestr')) return 1 / 2
  if (per.includes('catorc')) return 30 / 14
  if (per.includes('quinc')) return 2
  if (per.includes('seman')) return 30 / 7
  if (per.includes('dia')) return 30
  return 1 // mensual por defecto
}

// Renta normalizada a mensual, redondeada a centavos. Acepta null porque un
// contrato INCOMPLETO todavía no tiene importe (ADR 0001): aporta 0 al costo,
// porque un pendiente de captura no es un costo conocido y suponerle un valor
// falsearía el margen en la otra dirección.
export function montoMensualEquivalente(
  monto: number | null | undefined,
  periodicidad: string | null | undefined,
): number {
  if (monto == null) return 0
  return Math.round(monto * factorMensual(periodicidad) * 100) / 100
}

// ─── Avance del calendario de pagos ─────────────────────────────────────────
// Días o meses según la cadencia. Los saltos en MESES no son "N × 30 días" a
// propósito: sumar días se come los meses de 31, y doce cuotas mensuales desde
// el 1 de septiembre acabarían cayendo el 1, el 1, el 31, el 30…
const DIAS_POR_PERIODO: Partial<Record<PeriodicidadRenta, number>> = {
  DIARIA: 1, SEMANAL: 7, CATORCENAL: 14, QUINCENAL: 15,
}
const MESES_POR_PERIODO: Partial<Record<PeriodicidadRenta, number>> = {
  MENSUAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12,
}

// Vencimiento número `k` de un contrato (k = 0 es el primero), contado desde su
// fecha de inicio.
//
// La cuenta va ANCLADA al inicio y no acumulada sobre el vencimiento anterior, y
// esa es toda la diferencia. Lo anterior avanzaba de uno en uno con
// `Date.setMonth`, que DESBORDA en los meses cortos: 29 de enero + 1 mes daba el
// 1 de marzo —febrero se quedaba sin cuota— y desde ahí la serie entera caía el
// día 1. Se veía en la demo: un contrato del 29 sin cuota en febrero de 2027 y
// con todos los vencimientos posteriores el día 1.
//
// Anclar no basta por sí solo: hay que recortar el día al último del mes destino
// y volver a soltarlo en el siguiente. Con `k` meses sobre el ancla, febrero
// recorta a 28 y marzo recupera el 29:
//
//     acumulado:  29-ene → 28-feb → 28-mar → 28-abr…   (el 28 se queda pegado)
//     anclado:    29-ene → 28-feb → 29-mar → 29-abr…   (solo febrero cede)
//
// Es la misma semántica que `fecha + interval 'k months'` de PostgreSQL, que es
// lo que ya hacía `lib/finanzas-calculo.ts` y por eso nunca tuvo este defecto.
// Ver el ADR 0007 y la migración 20260731_calendario_meses_cortos.sql, que
// realinea los calendarios generados antes de este cambio.
export function periodoDeIndice(
  inicio: Date,
  k: number,
  periodicidad: string | null | undefined,
): Date {
  const p = (periodicidad || '').toUpperCase() as PeriodicidadRenta
  const dias = DIAS_POR_PERIODO[p]
  if (dias) {
    const d = new Date(inicio)
    d.setDate(d.getDate() + k * dias)
    return d
  }
  // Mensual por defecto, igual que la columna de la BD.
  const meses = MESES_POR_PERIODO[p] ?? 1
  const ancla = inicio.getDate()
  const destino = new Date(inicio.getFullYear(), inicio.getMonth() + k * meses, 1)
  // Día 0 del mes siguiente = último día del mes destino.
  const ultimoDelMes = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate()
  destino.setDate(Math.min(ancla, ultimoDelMes))
  return destino
}

// ─── Recordatorios de pago ──────────────────────────────────────────────────
// Con cuántos días de anticipación se avisa el próximo pago, según su cadencia.
//
// Era un 90 fijo pensado para contratos anuales. Aplicado a una renta diaria
// avisaría de un pago tres meses antes de que exista, y todas las cuotas del
// trimestre estarían "por vencer" a la vez: el aviso deja de señalar nada.
// El margen escala con el periodo (≈ un tercio de su duración, acotado) para
// que siempre haya tiempo de gestionar el pago sin inundar el panel.
export const DIAS_AVISO_PAGO: Record<PeriodicidadRenta, number> = {
  DIARIA: 1, SEMANAL: 2, CATORCENAL: 4, QUINCENAL: 5, MENSUAL: 15,
  BIMESTRAL: 20, TRIMESTRAL: 30, SEMESTRAL: 60, ANUAL: 90,
}

export function diasAvisoPago(periodicidad: string | null | undefined): number {
  const p = (periodicidad || '').toUpperCase() as PeriodicidadRenta
  // Sin periodicidad (contrato INCOMPLETO) se usa el margen mensual, que es la
  // cadencia por defecto de la columna en la BD.
  return DIAS_AVISO_PAGO[p] ?? DIAS_AVISO_PAGO.MENSUAL
}

// A partir de cuántos días restantes el aviso pasa de ámbar a rojo. Se mantiene
// la proporción que tenía el umbral fijo (15 de 90 = un sexto del margen) para
// que un contrato anual siga poniéndose en rojo a 15 días, exactamente como
// antes. El mínimo de 1 evita que una renta diaria (margen 1) no llegue a rojo
// nunca por redondeo a 0.
export function diasCriticoPago(periodicidad: string | null | undefined): number {
  return Math.max(1, Math.ceil(diasAvisoPago(periodicidad) / 6))
}

// ─── Estado de vencimiento de una cuota, para pintarla ──────────────────────
//
//   · PAGADO     — hecho consumado, no se recalcula.
//   · VENCIDO    — su fecha ya pasó y sigue impaga.
//   · POR_VENCER — entra en la ventana de aviso de SU cadencia. Este estado NO
//                  existe en la BD (`est_pago_renta` solo tiene PAGADO,
//                  PENDIENTE y VENCIDO): es una distinción de presentación,
//                  porque «pendiente» junta lo que vence mañana con lo que vence
//                  en seis meses, y eso es justo lo que Finanzas necesita separar
//                  para programar la salida de dinero.
//   · PROGRAMADO — pendiente, pero todavía lejos.
//
// Se DERIVA de la fecha y no se lee del `estatus` guardado a propósito. El
// estatus persistido lo sincroniza `recomputarEstatusArrendadores()`, que
// /api/estado solo dispara para quien tiene permiso de `arrendadores` —para no
// provocar escrituras desde un rol ajeno—. Un usuario SOLO de Finanzas puede por
// tanto recibir un pago ya vencido con su estatus todavía en PENDIENTE, y era
// exactamente esa pantalla la que tenía que mostrar cuál está vencida. Derivarlo
// de la fecha vale para los dos roles sin escribir nada.
export type EstadoVencimiento = 'PAGADO' | 'VENCIDO' | 'POR_VENCER' | 'PROGRAMADO'

// `dias` es lo que devuelve `diasHasta(periodo)`: positivo si falta, 0 si es hoy,
// negativo si ya pasó. Se recibe calculado en vez de calcularlo aquí porque esa
// conversión tiene una trampa de zona horaria ya resuelta en `diasHasta`
// (derive.ts), y este módulo no puede importar de allí sin cerrar un ciclo.
export function clasificarVencimiento(
  dias: number,
  periodicidad: string | null | undefined,
  pagado: boolean,
): EstadoVencimiento {
  if (pagado) return 'PAGADO'
  if (dias < 0) return 'VENCIDO'
  return dias <= diasAvisoPago(periodicidad) ? 'POR_VENCER' : 'PROGRAMADO'
}

// Texto relativo del vencimiento. Es la columna que responde «cuál está cerca»
// de un vistazo, sin obligar a restar fechas mentalmente.
export function textoVencimiento(dias: number): string {
  if (dias === 0) return 'hoy'
  if (dias > 0) return `en ${dias} ${dias === 1 ? 'día' : 'días'}`
  const atraso = Math.abs(dias)
  return `hace ${atraso} ${atraso === 1 ? 'día' : 'días'}`
}
