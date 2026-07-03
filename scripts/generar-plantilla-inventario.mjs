// ============================================================================
//  scripts/generar-plantilla-inventario.mjs
// ----------------------------------------------------------------------------
//  Genera apps/web/public/plantilla-sitios-set.xlsx con TRES hojas:
//    1. Instrucciones — cómo llenar el archivo (xlsx o csv), columna por columna.
//    2. Sitios        — encabezados + 2 filas de EJEMPLO (se borran al usar).
//    3. Listas        — valores válidos de cada columna de catálogo.
//
//  El importador (lib/inventario-import.ts) lee la hoja cuyo nombre incluye
//  "sitio", así que las hojas Instrucciones/Listas no interfieren con la carga.
//
//  Uso:  node scripts/generar-plantilla-inventario.mjs
// ============================================================================
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const __dirname = dirname(fileURLToPath(import.meta.url))
const SALIDA = join(__dirname, '..', 'apps', 'web', 'public', 'plantilla-sitios-set.xlsx')

// ── Catálogo de columnas (orden = orden en la hoja Sitios) ──────────────────
// obl: obligatorio · ej1: ejemplo digital · ej2: ejemplo fijo
const COLS = [
  { k: 'codigo_proveedor', obl: false, desc: 'Tu clave interna del sitio (la del proveedor).', valido: 'Texto libre', ej1: 'EJEMPLO-001', ej2: 'EJEMPLO-002' },
  { k: 'nombre', obl: true, desc: 'Nombre visible del sitio o pantalla.', valido: 'Texto libre', ej1: 'Pantalla Periférico Sur', ej2: 'Espectacular Insurgentes' },
  { k: 'tipo_medio', obl: false, desc: 'Tipo de soporte físico.', valido: 'espectacular · muro · valla · parabus · mupi · publitienda · puente · otro', ej1: 'espectacular', ej2: 'espectacular' },
  { k: 'exhibicion', obl: true, desc: '¿La pieza es impresa (fija) o pantalla (digital)?', valido: 'fijo · digital', ej1: 'digital', ej2: 'fijo' },
  { k: 'unidad', obl: true, desc: 'Cómo se comercializa. REGLA: si exhibicion=fijo solo "mensual" o "catorcenal".', valido: 'mensual · catorcenal · semanal · diaria · spot · hora · programatico', ej1: 'spot', ej2: 'mensual' },
  { k: 'es_rotativo', obl: false, desc: '¿La cara rota entre varios anunciantes?', valido: 'si · no', ej1: 'no', ej2: 'no' },
  { k: 'plaza_ciudad', obl: false, desc: 'Ciudad o plaza donde está el sitio.', valido: 'Texto libre', ej1: 'CDMX', ej2: 'CDMX' },
  { k: 'direccion', obl: false, desc: 'Dirección o referencia de ubicación.', valido: 'Texto libre', ej1: 'Periférico Sur 4000', ej2: 'Av. Insurgentes 1200' },
  { k: 'latitud', obl: false, desc: 'Coordenada decimal. Si la dejas vacía, el sitio queda "pendiente de verificación".', valido: 'Número (ej. 19.4326)', ej1: 19.4326, ej2: 19.39 },
  { k: 'longitud', obl: false, desc: 'Coordenada decimal.', valido: 'Número (ej. -99.1332)', ej1: -99.1332, ej2: -99.17 },
  { k: 'ancho_m', obl: false, desc: 'Ancho de la pieza en metros.', valido: 'Número', ej1: 12, ej2: 12 },
  { k: 'alto_m', obl: false, desc: 'Alto de la pieza en metros.', valido: 'Número', ej1: 7, ej2: 7 },
  { k: 'caras', obl: false, desc: 'Número de caras del sitio (default 1).', valido: 'Número entero', ej1: 1, ej2: 2 },
  { k: 'iluminacion', obl: false, desc: '¿Tiene iluminación?', valido: 'si · no', ej1: 'si', ej2: 'si' },
  { k: 'tipo_estructura', obl: false, desc: 'Tipo de estructura (unipolar, metálica, etc.).', valido: 'Texto libre', ej1: 'Estructura metálica', ej2: 'Unipolar' },
  { k: 'vista', obl: false, desc: 'Tipo de vista del tránsito.', valido: 'Texto libre (natural, cruzada…)', ej1: 'natural', ej2: 'cruzada' },
  { k: 'tramo', obl: false, desc: 'Tramo o vialidad.', valido: 'Texto libre', ej1: 'Periférico Sur', ej2: 'Insurgentes Sur' },
  { k: 'tarifa_publicada', obl: true, desc: 'Precio de venta publicado (sin IVA), en la unidad indicada.', valido: 'Número', ej1: 85000, ej2: 45000 },
  { k: 'costo_compra', obl: true, desc: 'Tu costo de compra al proveedor (sin IVA).', valido: 'Número', ej1: 52000, ej2: 28000 },
  { k: 'spots_por_hora', obl: false, desc: 'Solo DIGITAL: cuántos spots se reproducen por hora.', valido: 'Número (dejar vacío si es fijo)', ej1: 6, ej2: '' },
  { k: 'duracion_spot_seg', obl: false, desc: 'Solo DIGITAL: duración del spot en segundos.', valido: 'Número (dejar vacío si es fijo)', ej1: 10, ej2: '' },
  { k: 'horario', obl: false, desc: 'Horario de operación.', valido: 'Texto (ej. 06:00-23:00)', ej1: '06:00-23:00', ej2: '' },
  { k: 'notas', obl: false, desc: 'Notas adicionales.', valido: 'Texto libre', ej1: 'BORRA las filas EJEMPLO antes de importar', ej2: 'BORRA las filas EJEMPLO antes de importar' },
]

// ── Hoja 1: Instrucciones ───────────────────────────────────────────────────
const instr = [
  ['SPACES OS — Plantilla de carga de inventario (sitios / pantallas)'],
  [],
  ['Cómo usar esta plantilla:'],
  ['1) Captura tus sitios en la hoja "Sitios" (una fila por sitio).'],
  ['2) BORRA las 2 filas de EJEMPLO antes de importar.'],
  ['3) Guarda el archivo como .xlsx (o exporta la hoja "Sitios" como .csv) y súbelo en Inventario → Importar.'],
  [],
  ['Reglas importantes:'],
  ['• Campos OBLIGATORIOS: nombre, exhibicion, unidad, tarifa_publicada, costo_compra. Si falta uno, la fila se rechaza.'],
  ['• exhibicion solo acepta: fijo o digital.'],
  ['• Si exhibicion = fijo, la unidad SOLO puede ser "mensual" o "catorcenal" (cualquier otra rechaza la fila).'],
  ['• Si dejas latitud/longitud vacías, el sitio se crea "pendiente de verificación" con coordenadas por default.'],
  ['• tarifa_publicada y costo_compra van SIN IVA, como número (sin $ ni comas). Ej: 85000.'],
  ['• Los valores de catálogo (tipo_medio, unidad, exhibicion, si/no) están en la hoja "Listas".'],
  ['• No cambies los nombres de las columnas ni el nombre de la hoja "Sitios".'],
  ['• ¿Usas CSV? Mismas columnas y mismo orden que la hoja "Sitios"; la primera fila debe ser el encabezado.'],
  [],
  ['Diccionario de columnas:'],
  ['Columna', 'Obligatorio', 'Descripción', 'Valores válidos / formato'],
  ...COLS.map((c) => [c.k, c.obl ? 'SÍ' : 'opcional', c.desc, c.valido]),
]
const wsInstr = XLSX.utils.aoa_to_sheet(instr)
wsInstr['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 64 }, { wch: 52 }]

// ── Hoja 2: Sitios (encabezados + 2 ejemplos) ───────────────────────────────
const header = COLS.map((c) => c.k)
const ejemplo1 = COLS.map((c) => c.ej1)
const ejemplo2 = COLS.map((c) => c.ej2)
const wsSitios = XLSX.utils.aoa_to_sheet([header, ejemplo1, ejemplo2])
wsSitios['!cols'] = COLS.map((c) => ({ wch: Math.max(c.k.length + 2, 14) }))

// ── Hoja 3: Listas (valores válidos) ────────────────────────────────────────
const listas = [
  ['exhibicion', 'unidad', 'unidad_si_es_fijo', 'tipo_medio', 'si_no'],
  ['fijo', 'mensual', 'mensual', 'espectacular', 'si'],
  ['digital', 'catorcenal', 'catorcenal', 'muro', 'no'],
  ['', 'semanal', '', 'valla', ''],
  ['', 'diaria', '', 'parabus', ''],
  ['', 'spot', '', 'mupi', ''],
  ['', 'hora', '', 'publitienda', ''],
  ['', 'programatico', '', 'puente', ''],
  ['', '', '', 'otro', ''],
]
const wsListas = XLSX.utils.aoa_to_sheet(listas)
wsListas['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 8 }]

// ── Libro: Instrucciones primero, luego Sitios, luego Listas ────────────────
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')
XLSX.utils.book_append_sheet(wb, wsSitios, 'Sitios')
XLSX.utils.book_append_sheet(wb, wsListas, 'Listas')
XLSX.writeFile(wb, SALIDA)
console.log('Plantilla generada:', SALIDA)
console.log('Hojas:', wb.SheetNames.join(' · '))
