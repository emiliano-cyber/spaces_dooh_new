import type { FilaRentabilidad } from '@/lib/data/reportes'

// ============================================================================
//  components/demo/reportes/tabla.ts — El ordenamiento y las dos columnas raras.
// ----------------------------------------------------------------------------
//  `margenPct` es `number | null`, y ese `null` significa «no hubo ingreso»,
//  NO «0 %». Es el único sitio de esta pantalla donde el ordenamiento puede
//  MENTIR sin dar ningún error: un null tratado como cero coloca la pantalla
//  que costó 15 000 y no vendió nada justo entre las que quedaron a la par, y
//  se lee como «no gana ni pierde» — lo contrario de lo que pasó.
//
//  Por eso sale del `.tsx`: sin jsdom, dentro del componente no se prueba.
// ============================================================================

export type FilaOrdenable = Pick<
  FilaRentabilidad,
  'etiqueta' | 'ingreso' | 'costoEspacio' | 'costoOperacion' | 'costoTotal' | 'margen' | 'margenPct' | 'tieneContrato'
>

export type ColumnaReporte = keyof Omit<FilaOrdenable, 'tieneContrato'>
export type Direccion = 'asc' | 'desc'

export interface Orden {
  columna: ColumnaReporte
  direccion: Direccion
}

// `direccionInicial` es la dirección ÚTIL de cada columna, no la que quedara
// puesta. Al pasar de «margen ascendente» a «ingreso», heredar el `asc`
// pondría arriba las pantallas que no vendieron nada.
export const COLUMNAS: { clave: ColumnaReporte; label: string; numerica: boolean; direccionInicial: Direccion }[] = [
  { clave: 'etiqueta', label: 'Pantalla', numerica: false, direccionInicial: 'asc' },
  { clave: 'ingreso', label: 'Ingreso', numerica: true, direccionInicial: 'desc' },
  { clave: 'costoEspacio', label: 'Costo del espacio', numerica: true, direccionInicial: 'desc' },
  { clave: 'costoOperacion', label: 'Costo de operación', numerica: true, direccionInicial: 'desc' },
  { clave: 'costoTotal', label: 'Costo total', numerica: true, direccionInicial: 'desc' },
  // Margen y margen % arrancan por el PEOR, igual que el reporte: la pregunta
  // que contesta es «¿qué pantallas están perdiendo dinero?».
  { clave: 'margen', label: 'Margen', numerica: true, direccionInicial: 'asc' },
  { clave: 'margenPct', label: 'Margen %', numerica: true, direccionInicial: 'asc' },
]

const COLUMNA = new Map(COLUMNAS.map((c) => [c.clave, c]))

// El mismo orden con el que el servidor devuelve las filas («peor margen
// primero», `lib/data/reportes.ts`). Si la pantalla reordenara al recibir,
// discutiría con el servidor sobre la misma pregunta.
export const ORDEN_INICIAL: Orden = { columna: 'margen', direccion: 'asc' }

// `es-MX` explícito y no el locale del navegador: 'Á' vale 193 y 'B' 66, así
// que por código de carácter «Ángeles» iría DESPUÉS de «Bosques». Y dejarlo al
// locale del visitante haría que la misma tabla saliera en distinto orden en la
// máquina de quien la presenta y en la del cliente.
const comparadorTexto = new Intl.Collator('es-MX', { sensitivity: 'base', numeric: true })

export function ordenarFilas<T extends FilaOrdenable>(filas: readonly T[], orden: Orden): T[] {
  const col = COLUMNA.get(orden.columna) ?? COLUMNA.get('margen')!
  const signo = orden.direccion === 'asc' ? 1 : -1
  // Copia antes de ordenar: `Array.prototype.sort` ordena EN SITIO, y sobre el
  // arreglo que guarda un `useState` eso es una mutación que React no ve, así
  // que la tabla no se vuelve a pintar.
  return [...filas].sort((a, b) => {
    if (!col.numerica) {
      return signo * comparadorTexto.compare(String(a[col.clave] ?? ''), String(b[col.clave] ?? ''))
    }
    const va = a[col.clave] as number | null
    const vb = b[col.clave] as number | null
    // El `null` de margenPct va al final en las DOS direcciones. No es un
    // empate ni un cero: es «no hubo ingreso, no hay porcentaje que calcular»,
    // y por eso no entra en la escala. Si se invirtiera con la dirección, la
    // fila sin ingreso saltaría del final al principio al cambiar el sentido.
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return signo * (va - vb)
  })
}

export function siguienteOrden(actual: Orden, clic: ColumnaReporte): Orden {
  if (actual.columna === clic) {
    return { columna: clic, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' }
  }
  return { columna: clic, direccion: COLUMNA.get(clic)?.direccionInicial ?? 'desc' }
}

// Un decimal, con signo, y una RAYA cuando no hay porcentaje. Nunca «0 %»: ese
// cero afirmaría que la pantalla quedó a la par.
export function formatoPorcentaje(v: number | null): string {
  if (v == null) return '—'
  return `${v.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

// Lo que el reporte NO mide, contado para poder decirlo en pantalla en vez de
// esconderlo detrás de una cifra que parece completa:
//
//  · `sinContrato` — sin contrato no hay renta atribuida, así que el costo del
//    espacio de esa fila es 0 y su margen sale infladamente bueno. La fila es
//    correcta; lo que falta es el dato de entrada.
//  · `sinIngreso` — pantallas que costaron y no vendieron en el rango. Son
//    justo las que este reporte existe para encontrar, y su `margenPct` es
//    `null`, así que en la columna del porcentaje no se ven.
export function advertenciasDelReporte(filas: readonly FilaOrdenable[]): {
  sinContrato: number
  sinIngreso: number
} {
  return {
    sinContrato: filas.filter((f) => !f.tieneContrato).length,
    sinIngreso: filas.filter((f) => f.ingreso === 0).length,
  }
}
