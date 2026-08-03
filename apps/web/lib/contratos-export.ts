// ============================================================================
//  lib/contratos-export.ts — Descarga de los contratos VIGENTES en Excel/CSV.
// ----------------------------------------------------------------------------
//  A diferencia del inventario (lib/inventario-export.ts), esto NO tiene que
//  poder reimportarse: no hay importador de contratos. Es un reporte para
//  revisar, mandar a contabilidad o cuadrar la renta del mes, así que las
//  columnas son las que se leen, con los nombres que usa la interfaz.
//
//  «Vigente» aquí significa un acuerdo real en curso, y eso deja fuera dos
//  cosas por motivos distintos:
//    · INCOMPLETO — el ADR 0001: le faltan arrendador, importe, periodicidad o
//      fecha de fin. No es un contrato todavía; meterlo en el reporte con
//      columnas vacías haría creer que hay un acuerdo que no existe.
//    · CANCELADO / VENCIDO — ya no está en curso.
//  RENOVADO y POR_VENCER SÍ entran: siguen cubriendo el espacio hoy.
// ============================================================================

import * as XLSX from 'xlsx'
import type { ContratoArrendamiento, Arrendador, Sitio, Predio } from './data/types'
import { factorMensual, periodicidadLabel } from './renta-periodicidad'

export const ESTATUS_VIGENTES = ['VIGENTE', 'POR_VENCER', 'RENOVADO'] as const

export const COLUMNAS_CONTRATOS = [
  'arrendador',
  'razon_social',
  'rfc',
  'predio',
  'pantallas',
  'renta',
  'periodicidad',
  'renta_mensual_equivalente',
  'moneda',
  'inicio',
  'vence',
  'dias_restantes',
  'auto_renovable',
  'estatus',
  'tiene_documento',
] as const

export type FilaContrato = Record<string, string | number>

export interface RazonSocialLite {
  id: string
  arrendadorId: string
  razonSocial: string
  rfc: string | null
}

// Solo fecha, sin hora: un contrato vence un día, no a una hora.
function soloFecha(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : ''
}

// Días hasta el vencimiento. Se calcula contra `hoy` recibido y no contra
// `new Date()` dentro: así la función es pura y se puede probar.
function diasRestantes(fechaFin: string | null | undefined, hoy: Date): number | '' {
  if (!fechaFin) return ''
  const fin = new Date(`${soloFecha(fechaFin)}T00:00:00`)
  if (Number.isNaN(fin.getTime())) return ''
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((fin.getTime() - base.getTime()) / 86_400_000)
}

export function filasDeContratos(
  contratos: ContratoArrendamiento[],
  datos: {
    arrendadores: Arrendador[]
    razones: RazonSocialLite[]
    sitios: Sitio[]
    predios: Predio[]
  },
  hoy: Date,
): FilaContrato[] {
  const arrPorId = new Map(datos.arrendadores.map((a) => [a.id, a]))
  const predioPorId = new Map(datos.predios.map((p) => [p.id, p]))
  const razonPorId = new Map(datos.razones.map((r) => [r.id, r]))
  // Cuántas pantallas cubre el contrato. Un contrato de predio cubre TODAS las
  // pantallas de ese predio (N caras : 1 predio), no solo la que quedó anclada
  // en `sitio_id`; reportar 1 subestimaría lo que ampara el acuerdo.
  const pantallasPorPredio = new Map<string, number>()
  for (const s of datos.sitios) {
    if (s.predioId) pantallasPorPredio.set(s.predioId, (pantallasPorPredio.get(s.predioId) ?? 0) + 1)
  }
  const sitioPorId = new Map(datos.sitios.map((s) => [s.id, s]))

  const vigentes = contratos.filter((c) =>
    (ESTATUS_VIGENTES as readonly string[]).includes(c.estatus),
  )

  return vigentes.map((c) => {
    const arr = c.arrendadorId ? arrPorId.get(c.arrendadorId) : null
    const predio = c.predioId ? predioPorId.get(c.predioId) : null
    // La razón social del contrato si la tiene; si no, la única del arrendador
    // (si tuviera varias, elegir una sería inventar cuál factura).
    const razonDirecta = c.razonSocialId ? razonPorId.get(c.razonSocialId) : null
    const suyas = arr ? datos.razones.filter((r) => r.arrendadorId === arr.id) : []
    const razon = razonDirecta ?? (suyas.length === 1 ? suyas[0] : null)
    const pantallas = c.predioId
      ? (pantallasPorPredio.get(c.predioId) ?? 0)
      : sitioPorId.has(c.sitioId)
        ? 1
        : 0
    const factor = c.periodicidad ? factorMensual(c.periodicidad) : 1
    const mensual = c.montoRenta != null ? Math.round(c.montoRenta * factor) : ''

    return {
      arrendador: arr?.nombre ?? '',
      razon_social: razon?.razonSocial ?? '',
      rfc: razon?.rfc ?? arr?.rfc ?? '',
      // Sin predio es una pantalla suelta con contrato propio; se dice cuál, que
      // es lo que identifica el acuerdo para quien lee el reporte.
      predio: predio?.nombre ?? (c.sitioNombre ?? sitioPorId.get(c.sitioId)?.nombre ?? ''),
      pantallas,
      renta: c.montoRenta ?? '',
      periodicidad: c.periodicidad ? periodicidadLabel(c.periodicidad) : '',
      renta_mensual_equivalente: mensual,
      moneda: c.moneda ?? '',
      inicio: soloFecha(c.fechaInicio),
      vence: soloFecha(c.fechaFin),
      dias_restantes: diasRestantes(c.fechaFin, hoy),
      auto_renovable: c.autoRenovable ? 'si' : 'no',
      estatus: c.estatus,
      tiene_documento: c.documentoUrl ? 'si' : 'no',
    }
  })
}

function enOrden(filas: FilaContrato[]): FilaContrato[] {
  return filas.map((f) => {
    const o: FilaContrato = {}
    for (const c of COLUMNAS_CONTRATOS) o[c] = f[c] ?? ''
    return o
  })
}

// Misma defensa que en el export de inventario: un valor que empieza por
// = + - @ lo abre Excel como fórmula. Aquí entran nombres de arrendador y de
// predio, que los escribe una persona. Ver lib/inventario-export.ts.
const PELIGROSO = /^[=+\-@\t\r]/
function neutralizar(fila: FilaContrato): FilaContrato {
  const o: FilaContrato = {}
  for (const [k, v] of Object.entries(fila)) {
    o[k] = typeof v === 'string' && PELIGROSO.test(v) ? `'${v}` : v
  }
  return o
}

export function nombreArchivoContratos(fecha: Date, ext: 'xlsx' | 'csv'): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `contratos-vigentes-${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}.${ext}`
}

export function construirArchivoContratos(
  filas: FilaContrato[],
  formato: 'xlsx' | 'csv',
): Blob {
  const ordenadas = enOrden(filas)
  if (formato === 'csv') {
    const hoja = XLSX.utils.json_to_sheet(ordenadas.map(neutralizar), {
      header: [...COLUMNAS_CONTRATOS],
    })
    return new Blob(['﻿' + XLSX.utils.sheet_to_csv(hoja)], {
      type: 'text/csv;charset=utf-8',
    })
  }
  const hoja = XLSX.utils.json_to_sheet(ordenadas, { header: [...COLUMNAS_CONTRATOS] })
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Contratos vigentes')
  return new Blob([XLSX.write(libro, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function descargarContratos(
  contratos: ContratoArrendamiento[],
  datos: {
    arrendadores: Arrendador[]
    razones: RazonSocialLite[]
    sitios: Sitio[]
    predios: Predio[]
  },
  formato: 'xlsx' | 'csv',
  ahora = new Date(),
): number {
  const filas = filasDeContratos(contratos, datos, ahora)
  const blob = construirArchivoContratos(filas, formato)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivoContratos(ahora, formato)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filas.length
}
