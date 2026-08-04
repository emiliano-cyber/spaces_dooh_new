import 'server-only'
import type { PoolClient } from 'pg'
import { q } from './db'

// ============================================================================
//  lib/server/folios.ts — Folios consecutivos, sin colisiones.
// ----------------------------------------------------------------------------
//  Los folios se generaban con bytes aleatorios sobre espacios diminutos. El de
//  campaña era el peor: fecha + 3 dígitos = 1.000 combinaciones POR DÍA, así que
//  por la paradoja del cumpleaños la probabilidad de repetir pasa del 50% a las
//  ~37 campañas del mismo día. No es teórico: reventó en pruebas con cinco.
//
//  Y cuando revienta, revienta feo: la columna es UNIQUE, así que el INSERT
//  falla con `duplicate key value violates unique constraint` y ESE texto es lo
//  que ve el vendedor a media venta.
//
//  Espacio de cada generador anterior y a cuántos documentos llegaba al 50% de
//  probabilidad de choque:
//
//    campanas            1.000 / día        ~37 campañas en un día
//    ordenes_trabajo    65.536 / año        ~300 OT en un año
//    propuestas         16,7 M              ~4.800 propuestas
//    ordenes_compra     16,7 M              ~4.800 OC
//    ordenes_impresion  16,7 M              ~4.800 OI
//
//  La solución es un contador, no un dado más grande: un aleatorio siempre tiene
//  probabilidad de repetir, y esconder el problema subiendo bytes solo mueve la
//  fecha del incidente.
//
//  `folios_consecutivos` guarda el último número por (ámbito, periodo) y se
//  incrementa con un UPSERT atómico. Dos reservas simultáneas se serializan en
//  esa fila: la segunda espera y recibe el número siguiente. Nunca el mismo.
//
//  El contador es GLOBAL, no por tenant, porque las restricciones UNIQUE de
//  `folio` son globales: con contadores por tenant, dos organizaciones distintas
//  acuñarían el mismo `OT-2026-0001` y el choque volvería por otra puerta. El
//  folio de campaña sí lleva el prefijo del tenant (RGB…), que es de donde sale
//  su identidad; el número solo garantiza unicidad.
//
//  HAY HUECOS y es correcto que los haya: si la transacción se cae después de
//  tomar el número (p. ej. la reserva se rechaza por cupo), ese folio se pierde.
//  Un folio no es un comprobante fiscal — para eso está `facturas.folio_fiscal`,
//  que NO pasa por aquí a propósito.
// ============================================================================

export type AmbitoFolio = 'campana' | 'propuesta' | 'ot' | 'oc' | 'oi'

// Periodo del contador: dentro de él la numeración es consecutiva y al cambiar
// vuelve a empezar. Día para campañas (su folio ya lleva la fecha), año para el
// resto (que la llevan en el propio folio).
export type PeriodoFolio = 'dia' | 'anio'

function clavePeriodo(periodo: PeriodoFolio, d: Date): string {
  const yyyy = d.getFullYear()
  if (periodo === 'anio') return String(yyyy)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

const SQL = `insert into folios_consecutivos (ambito, periodo, ultimo)
             values ($1, $2, 1)
             on conflict (ambito, periodo)
               do update set ultimo = folios_consecutivos.ultimo + 1
             returning ultimo`

/**
 * Siguiente número consecutivo del ámbito. Atómico: el UPSERT bloquea la fila
 * del contador hasta el commit, así que dos llamadas concurrentes reciben
 * números distintos aunque corran en el mismo milisegundo.
 *
 * `client` es obligatorio cuando ya hay una transacción abierta: usar el pool
 * por fuera abriría una conexión distinta, y el número quedaría consumido
 * aunque la transacción se revierta.
 */
export async function siguienteConsecutivo(opts: {
  ambito: AmbitoFolio
  periodo: PeriodoFolio
  client?: PoolClient
  ahora?: Date
}): Promise<{ n: number; periodo: string }> {
  const periodo = clavePeriodo(opts.periodo, opts.ahora ?? new Date())
  const params = [opts.ambito, periodo]
  const rows = opts.client
    ? (await opts.client.query(SQL, params)).rows
    : await q<{ ultimo: number }>(SQL, params)
  return { n: Number((rows[0] as { ultimo: number })?.ultimo ?? 1), periodo }
}

/**
 * Folio de campaña: `<PREFIJO_TENANT><YYYYMMDD><NNN>`. Misma forma que antes
 * —lo que cambia es que los tres dígitos son un consecutivo del día y no un
 * dado—. Pasando de 999 campañas en un día crece a cuatro dígitos en vez de
 * repetirse.
 */
export async function folioCampana(prefijoTenant: string, client?: PoolClient): Promise<string> {
  const { n, periodo } = await siguienteConsecutivo({ ambito: 'campana', periodo: 'dia', client })
  return `${prefijoTenant}${periodo}${String(n).padStart(3, '0')}`
}

/**
 * Folio de documento operativo: `<SIGLA>-<AAAA>-<NNNN>` (OT-2026-0001). Conserva
 * la forma del folio de OT, que ya era la más legible de las cinco, y la aplica
 * a todas para que un folio se lea igual en cualquier módulo.
 */
export async function folioDocumento(
  ambito: Exclude<AmbitoFolio, 'campana'>,
  client?: PoolClient,
): Promise<string> {
  const sigla = { propuesta: 'PR', ot: 'OT', oc: 'ODC', oi: 'OI' }[ambito]
  const { n, periodo } = await siguienteConsecutivo({ ambito, periodo: 'anio', client })
  return `${sigla}-${periodo}-${String(n).padStart(4, '0')}`
}
