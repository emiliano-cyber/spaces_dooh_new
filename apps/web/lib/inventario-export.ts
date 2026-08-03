// ============================================================================
//  lib/inventario-export.ts — Descarga del inventario en Excel/CSV.
// ----------------------------------------------------------------------------
//  El archivo que sale es el MISMO formato que come el importador
//  (lib/inventario-import.ts): mismas columnas, mismos nombres, mismo criterio
//  de una fila por modalidad de venta. Así el inventario se puede descargar,
//  editar en masa en Excel y volver a subir sin traducir nada a mano — que es
//  la única razón por la que este formato vale más que un volcado bonito.
//
//  Se exporta la parte PURA (`filasDeInventario`) aparte de la descarga para
//  poder probarla sin navegador: la generación del archivo es la que necesita
//  Blob y DOM, el mapeo no.
// ============================================================================

import * as XLSX from 'xlsx'
import type { Sitio } from './data/types'

// Orden de columnas de la plantilla. Es el contrato con el importador: los
// nombres tienen que sobrevivir a `limpiarHeader()` (minúsculas, sin acentos,
// separadas por "_") y por eso se escriben ya normalizados.
export const COLUMNAS_PLANTILLA = [
  'codigo_proveedor',
  'nombre',
  'tipo_medio',
  'exhibicion',
  'unidad',
  'es_rotativo',
  'plaza_ciudad',
  'direccion',
  'latitud',
  'longitud',
  'ancho_m',
  'alto_m',
  'caras',
  'iluminacion',
  'tipo_estructura',
  'vista',
  'tramo',
  'tarifa_publicada',
  'renta_arrendador',
  'spots_por_hora',
  'duracion_spot_seg',
  'horario',
  'notas',
] as const

// Inverso de MAPEO_TIPO (sitios-repo). Es LOSSY a propósito y conviene saberlo:
// parabus, mupi y publitienda entran los tres como MOBILIARIO_URBANO, así que al
// salir todos dicen "mupi". No rompe el viaje de ida y vuelta —reimportar "mupi"
// vuelve a dar MOBILIARIO_URBANO— pero la palabra original no se recupera.
// PANTALLA_DIGITAL no lo produce nunca el importador (lo digital se indica en
// `exhibicion`), así que sale como "otro".
const TIPO_MEDIO_SALIDA: Record<string, string> = {
  ESPECTACULAR: 'espectacular',
  MURAL: 'muro',
  VALLA: 'valla',
  MOBILIARIO_URBANO: 'mupi',
  PUENTE_PEATONAL: 'puente',
  PANTALLA_DIGITAL: 'otro',
  OTRO: 'otro',
}

const siNo = (v: boolean | null | undefined) => (v ? 'si' : 'no')
// Celda vacía, no un cero: en la plantilla "" significa «no capturado» y 0
// significa cero. Escribir 0 donde no había dato hace que al reimportar una
// renta ausente pase a valer cero, que es justo lo que el ADR 0001 evita.
const numOVacio = (v: number | null | undefined) => (v == null ? '' : v)

export type FilaExport = Record<string, string | number>

// Una fila por modalidad de venta, igual que espera el importador (agrupa por
// `codigo_proveedor`). Una pantalla sin modalidades detalladas sale igual, con
// su unidad y tarifa principales: perderla del archivo sería peor.
export function filasDeInventario(sitios: Sitio[]): FilaExport[] {
  const filas: FilaExport[] = []
  for (const s of sitios) {
    const base = {
      codigo_proveedor: s.codigoProveedor || '',
      nombre: s.nombre || '',
      tipo_medio: TIPO_MEDIO_SALIDA[s.tipoMedio] ?? 'otro',
      exhibicion: s.exhibicion || '',
      plaza_ciudad: s.plazaCiudad || s.ciudad || '',
      direccion: s.direccion || '',
      // Las coordenadas por defecto (centro de CDMX) no son un dato: se marcaron
      // pendientes de verificación al importar. Exportarlas las convertiría en
      // dato bueno en la siguiente vuelta.
      latitud: s.pendienteVerificacion ? '' : numOVacio(s.lat),
      longitud: s.pendienteVerificacion ? '' : numOVacio(s.lng),
      ancho_m: numOVacio(s.ancho),
      alto_m: numOVacio(s.alto),
      caras: numOVacio(s.caras),
      es_rotativo: siNo(s.esRotativo),
      iluminacion: siNo(s.iluminado),
      tipo_estructura: s.tipoEstructura || '',
      vista: s.vista || '',
      tramo: s.tramo || '',
      spots_por_hora: numOVacio(s.spotsPorHora),
      duracion_spot_seg: numOVacio(s.duracionSpotSeg),
      horario: s.horario || '',
      notas: s.notas || '',
    }
    const mods =
      s.modalidadesDetalle && s.modalidadesDetalle.length
        ? s.modalidadesDetalle
        : [{ unidad: s.unidad, tarifaPublicada: s.tarifaPublicada, costoCompra: s.costoCompra }]
    for (const m of mods) {
      filas.push({
        ...base,
        unidad: m.unidad || '',
        tarifa_publicada: numOVacio(m.tarifaPublicada),
        // `costoCompra` ES la renta al arrendador (ADR 0006): una pantalla tiene
        // UN solo costo. Sale bajo el nombre que lee el importador.
        renta_arrendador: numOVacio(m.costoCompra),
      })
    }
  }
  return filas
}

// Ordena las claves según COLUMNAS_PLANTILLA para que el archivo salga siempre
// con las columnas en el mismo orden, aunque el objeto se haya armado en otro.
function enOrden(filas: FilaExport[]): FilaExport[] {
  return filas.map((f) => {
    const o: FilaExport = {}
    for (const c of COLUMNAS_PLANTILLA) o[c] = f[c] ?? ''
    return o
  })
}

// ─── Inyección de fórmulas en CSV ───────────────────────────────────────────
//
// El nombre, la dirección o las notas de una pantalla los escribe una persona, y
// pueden haber entrado por una carga masiva que no controlamos. Si un valor
// empieza por `=`, `+`, `-` o `@`, Excel lo abre como FÓRMULA, no como texto:
// un `=HYPERLINK("http://…","ver")` en el nombre de una pantalla se convierte en
// un enlace activo en la máquina de quien abra el archivo. Es el vector clásico
// (CSV injection), y aquí aplica porque el archivo se descarga para abrirlo en
// Excel — que es justo para lo que se pidió.
//
// Se antepone una comilla simple, que es como Excel marca «esto es texto». Al
// leer el archivo la comilla no forma parte del valor, así que el viaje de ida y
// vuelta se mantiene.
//
// Solo afecta al CSV: en un .xlsx las celdas se escriben con tipo `s` (cadena) y
// Excel no las evalúa, así que ahí no hace falta tocar nada.
const PELIGROSO = /^[=+\-@\t\r]/

export function neutralizarFormulas(fila: FilaExport): FilaExport {
  const o: FilaExport = {}
  for (const [k, v] of Object.entries(fila)) {
    o[k] = typeof v === 'string' && PELIGROSO.test(v) ? `'${v}` : v
  }
  return o
}

export function nombreArchivo(fecha: Date, ext: 'xlsx' | 'csv'): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const f = `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`
  return `inventario-${f}.${ext}`
}

// Construye el archivo. Devuelve un Blob para que el llamador decida qué hacer
// (descargar, adjuntar, probar).
export function construirArchivo(sitios: Sitio[], formato: 'xlsx' | 'csv'): Blob {
  const filas = enOrden(filasDeInventario(sitios))
  if (formato === 'csv') {
    // Se neutraliza ANTES de construir la hoja, no después: el escape de comillas
    // del CSV lo hace `sheet_to_csv` y tocar su salida a mano lo rompería.
    const hojaCsv = XLSX.utils.json_to_sheet(filas.map(neutralizarFormulas), {
      header: [...COLUMNAS_PLANTILLA],
    })
    // BOM al inicio: sin él, Excel en Windows abre el CSV en ANSI y parte los
    // acentos ("Juárez" → "JuÃ¡rez"). Es el caso normal aquí, no el raro.
    const csv = '﻿' + XLSX.utils.sheet_to_csv(hojaCsv)
    return new Blob([csv], { type: 'text/csv;charset=utf-8' })
  }
  const hoja = XLSX.utils.json_to_sheet(filas, { header: [...COLUMNAS_PLANTILLA] })
  const libro = XLSX.utils.book_new()
  // La hoja se llama "Sitios" porque es la que busca el importador por nombre.
  XLSX.utils.book_append_sheet(libro, hoja, 'Sitios')
  const buf = XLSX.write(libro, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// Dispara la descarga en el navegador.
export function descargarInventario(sitios: Sitio[], formato: 'xlsx' | 'csv', ahora = new Date()): void {
  const blob = construirArchivo(sitios, formato)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(ahora, formato)
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sin esto el Blob queda retenido mientras viva la pestaña. El timeout deja
  // que el navegador arranque la descarga antes de soltarlo.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
