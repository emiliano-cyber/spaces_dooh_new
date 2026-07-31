// Genera el archivo de prueba de la validación de cercanía al predio.
//   node scripts/generar-prueba-predios.mjs [salida.xlsx]
//
// Cuatro pantallas pensadas para ejercitar los tres resultados posibles de
// `evaluarCercania`:
//
//   PRED-A1 y PRED-A2  → MISMO predio. Dos caras del mismo edificio, a ~45 m.
//                        Misma dirección, coordenadas casi iguales. Deben
//                        entrar juntas sin protestar.
//   PRED-B1            → OTRO predio, a ~12 km (Santa Fe). Si se intenta meter
//                        en el predio de las A, la validación lo rechaza y dice
//                        la distancia.
//   PRED-C1            → OTRO predio, en otra ciudad (Monterrey). El caso
//                        burdo, el del copiar/pegar en el Excel.
//
// El predio NO es una columna de la plantilla: se elige al importar («todas
// estas pantallas son del mismo predio»). Por eso el archivo se carga en dos
// pasadas — ver el README que imprime este script al terminar.
import XLSX from 'xlsx'

const salida = process.argv[2] ?? 'pantallas-predios-prueba.xlsx'

// Mismo orden de columnas que produce `generar-plantilla-inventario.mjs`.
const COLUMNAS = [
  'codigo_proveedor', 'nombre', 'tipo_medio', 'exhibicion', 'unidad', 'es_rotativo',
  'plaza_ciudad', 'direccion', 'latitud', 'longitud', 'ancho_m', 'alto_m', 'caras',
  'iluminacion', 'tipo_estructura', 'vista', 'tramo', 'tarifa_publicada',
  'renta_arrendador', 'spots_por_hora', 'duracion_spot_seg', 'horario', 'notas',
]

const base = {
  tipo_medio: 'espectacular', exhibicion: 'digital', unidad: 'mensual',
  es_rotativo: 'si', iluminacion: 'si', tipo_estructura: 'pantalla LED',
  spots_por_hora: 6, duracion_spot_seg: 10, horario: '06:00-24:00',
}

const FILAS = [
  {
    ...base,
    codigo_proveedor: 'PRED-A1',
    nombre: 'LED Reforma 222 — cara norte',
    plaza_ciudad: 'Ciudad de Mexico',
    direccion: 'Paseo de la Reforma 222, Juarez, Cuauhtemoc',
    latitud: 19.4283, longitud: -99.1590,
    ancho_m: 12, alto_m: 6, caras: 1, vista: 'N-S', tramo: 'Reforma',
    tarifa_publicada: 145000, renta_arrendador: 82000,
    notas: 'Predio A · misma finca que PRED-A2 (~45 m)',
  },
  {
    ...base,
    codigo_proveedor: 'PRED-A2',
    nombre: 'LED Reforma 222 — cara sur',
    plaza_ciudad: 'Ciudad de Mexico',
    direccion: 'Paseo de la Reforma 222, Juarez, Cuauhtemoc',
    latitud: 19.42866, longitud: -99.15912,
    ancho_m: 12, alto_m: 6, caras: 1, vista: 'S-N', tramo: 'Reforma',
    tarifa_publicada: 138000, renta_arrendador: 78000,
    notas: 'Predio A · misma finca que PRED-A1 (~45 m)',
  },
  {
    ...base,
    codigo_proveedor: 'PRED-B1',
    nombre: 'LED Santa Fe Vasco de Quiroga',
    plaza_ciudad: 'Ciudad de Mexico',
    direccion: 'Av. Vasco de Quiroga 3800, Santa Fe, Cuajimalpa',
    latitud: 19.3601, longitud: -99.2597,
    ancho_m: 14.4, alto_m: 8.1, caras: 1, vista: 'O-P', tramo: 'Santa Fe',
    tarifa_publicada: 168000, renta_arrendador: 95000,
    notas: 'Predio B · a ~12 km del predio A',
  },
  {
    ...base,
    codigo_proveedor: 'PRED-C1',
    nombre: 'LED Constitucion Monterrey',
    plaza_ciudad: 'Monterrey',
    direccion: 'Av. Constitucion 1000, Centro, Monterrey',
    latitud: 25.6714, longitud: -100.3095,
    ancho_m: 12, alto_m: 6, caras: 1, vista: 'P-O', tramo: 'Constitucion',
    tarifa_publicada: 96000, renta_arrendador: 54000,
    notas: 'Predio C · otra ciudad',
  },
]

const hoja = XLSX.utils.json_to_sheet(FILAS, { header: COLUMNAS })
hoja['!cols'] = COLUMNAS.map((c) => ({ wch: Math.max(12, c.length + 2) }))

// Segunda hoja con las instrucciones: quien abra el archivo dentro de seis meses
// no va a tener a mano el porqué de las coordenadas.
const GUIA = [
  ['Archivo de prueba — validación de cercanía al predio'],
  [],
  ['Qué contiene'],
  ['PRED-A1 y PRED-A2', 'Mismo predio. Dos caras de la misma finca, a ~45 m.'],
  ['PRED-B1', 'Otro predio, a ~12 km del A (Santa Fe).'],
  ['PRED-C1', 'Otro predio, en otra ciudad (Monterrey).'],
  [],
  ['Cómo cargarlo'],
  ['1', 'Importa SOLO las filas PRED-A1 y PRED-A2 marcando "todas del mismo predio".'],
  ['', 'Deben entrar las dos sin protestar: están a 45 m y el límite son 250 m.'],
  ['2', 'Importa PRED-B1 y PRED-C1 SIN marcar predio: cada una queda suelta con su contrato.'],
  [],
  ['Cómo comprobar que la validación funciona'],
  ['', 'Intenta importar PRED-B1 marcando el predio de las A, o agrégala a ese predio'],
  ['', 'desde Arrendadores. Debe rechazarlo diciendo a cuántos km está.'],
  [],
  ['Por qué importa'],
  ['', 'El contrato cuelga del PREDIO y su renta se reparte entre las pantallas que'],
  ['', 'le cuelgan. Una pantalla que está en otra parte abarata a las demás y'],
  ['', 'infla su margen, sin que nada falle.'],
]
const guia = XLSX.utils.aoa_to_sheet(GUIA)
guia['!cols'] = [{ wch: 20 }, { wch: 78 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, hoja, 'Sitios')
XLSX.utils.book_append_sheet(wb, guia, 'Instrucciones')
XLSX.writeFile(wb, salida)

console.log(`Escrito: ${salida}`)
console.log(`  ${FILAS.length} pantallas · ${COLUMNAS.length} columnas · hoja de instrucciones incluida`)
