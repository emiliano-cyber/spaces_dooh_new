// ============================================================================
//  lib/predio-cercania.ts — ¿esta pantalla está de verdad en este predio?
//
//  Un predio es UN inmueble físico y su renta es UNA sola: el contrato cuelga
//  del predio y `derive.ts` reparte esa renta entre sus pantallas (N caras : 1
//  predio). Colgar de un predio una pantalla que está en otra parte no es un
//  error cosmético de captura — DILUYE la renta: el costo del inmueble se
//  reparte entre una cara de más, así que todas sus pantallas salen más baratas
//  de lo que son y el margen de cada una sale inflado. Es el mismo modo de fallo
//  que persiguen el ADR 0001 y el 0006, por otra puerta.
//
//  Por eso se comprueba la distancia. No lleva `server-only`: lo usan el
//  importador y los repos (servidor) y puede usarlo la UI para avisar antes de
//  enviar, mismo patrón que `renta-periodicidad.ts`.
// ============================================================================

// Radio dentro del cual dos puntos se consideran el mismo inmueble.
//
// 250 m es holgado a propósito. Un predio puede ser una manzana, un centro
// comercial o un edificio con caras a dos calles, así que dos pantallas suyas
// pueden estar a cien metros largos. Y las coordenadas suelen venir de geocodar
// una dirección escrita a mano, que ya trae su propio error. Un radio corto
// (50 m) rechazaría cargas legítimas, que es peor que dejar pasar alguna dudosa:
// el operador dejaría de confiar en el aviso y buscaría cómo saltárselo.
//
// Lo que sí atrapa —y es el caso real— es la pantalla de otra colonia o de otra
// ciudad colgada del predio equivocado por un copiar/pegar en el Excel.
export const RADIO_PREDIO_M = 250

const R_TIERRA_M = 6_371_000
const rad = (g: number) => (g * Math.PI) / 180

// Distancia en metros entre dos coordenadas (haversine). Sobra de sobra a esta
// escala: el error frente a un cálculo geodésico exacto es de centímetros en
// distancias de cientos de metros.
export function distanciaMetros(
  aLat: number, aLng: number, bLat: number, bLng: number,
): number {
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R_TIERRA_M * Math.asin(Math.sqrt(h)))
}

// Normaliza una dirección para compararla: sin acentos, sin puntuación, sin
// dobles espacios y en minúscula. NO intenta entender la dirección —eso pide un
// geocodificador— solo decidir si dos cadenas dicen lo mismo escrito distinto:
// "Av. Reforma 222, Juárez" y "AV REFORMA 222 JUAREZ".
export function normalizarDireccion(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    // Quita las marcas diacríticas que dejó el NFD (la tilde de "Juárez" pasa a
    // ser un carácter aparte y aquí se descarta).
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// `lat`/`lng` admiten string a propósito: en la BD son columnas `numeric`, y el
// driver de PostgreSQL devuelve los `numeric` como TEXTO para no perder
// precisión. Exigir `number` aquí haría que toda coordenada leída de la base
// se tratara como ausente y la validación no comprobara nunca nada — pasaría
// todo en verde sin mirar. Se coacciona en `coord()`.
export interface Ubicacion {
  lat?: number | string | null
  lng?: number | string | null
  direccion?: string | null
}

// Coordenada utilizable, o null. Descarta el (0,0) —el Golfo de Guinea— porque
// en la práctica es "no capturado" y no un sitio real.
function coord(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export type Cercania =
  // Mismo inmueble: dentro del radio, o la misma dirección escrita.
  | { estado: 'CERCA'; metros: number | null }
  // Fuera del radio. `metros` es la distancia real, para poder decirla.
  | { estado: 'LEJOS'; metros: number }
  // No se puede saber: faltan coordenadas en alguno y las direcciones no
  // coinciden literalmente. NO es un fallo — es ausencia de dato, y tratarla
  // como fallo bloquearía cargas correctas cuyo Excel no trae coordenadas.
  | { estado: 'INDETERMINADO'; metros: null }

function puntoDe(u: Ubicacion): { lat: number; lng: number } | null {
  const lat = coord(u.lat)
  const lng = coord(u.lng)
  if (lat == null || lng == null) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

// Compara dos ubicaciones. Las coordenadas mandan cuando las hay porque son
// objetivas y se pueden expresar en metros; la dirección literal es el respaldo
// para los archivos que no las traen.
export function evaluarCercania(a: Ubicacion, b: Ubicacion): Cercania {
  const pa = puntoDe(a)
  const pb = puntoDe(b)
  if (pa && pb) {
    const metros = distanciaMetros(pa.lat, pa.lng, pb.lat, pb.lng)
    return metros <= RADIO_PREDIO_M ? { estado: 'CERCA', metros } : { estado: 'LEJOS', metros }
  }
  const da = normalizarDireccion(a.direccion)
  const db = normalizarDireccion(b.direccion)
  if (da && db && da === db) return { estado: 'CERCA', metros: null }
  return { estado: 'INDETERMINADO', metros: null }
}

// ─── Direcciones PARECIDAS (no idénticas) ───────────────────────────────────
//
// `evaluarCercania` exige que la dirección sea idéntica tras normalizar, porque
// es la que decide si se BLOQUEA una carga y ahí conviene no inventar. Para
// avisar antes de importar hace falta algo más flexible: "Av. Reforma 222 piso 3"
// y "Av. Reforma 222 local B" son el mismo inmueble escrito distinto, y exigir
// igualdad literal llenaría la pantalla de avisos falsos.
//
// Se usa el coeficiente de Dice sobre las PALABRAS de la dirección normalizada:
// 2·|comunes| / (|a| + |b|). Sobre palabras y no sobre letras a propósito —
// comparar letras da parecidos altísimos entre direcciones distintas de la misma
// ciudad, porque comparten "avenida", "colonia" y el nombre del municipio.
export function similitudDireccion(a: string | null | undefined, b: string | null | undefined): number {
  const pa = new Set(normalizarDireccion(a).split(' ').filter(Boolean))
  const pb = new Set(normalizarDireccion(b).split(' ').filter(Boolean))
  if (!pa.size || !pb.size) return 0
  let comunes = 0
  for (const t of pa) if (pb.has(t)) comunes++
  return (2 * comunes) / (pa.size + pb.size)
}

// Por debajo de esto, dos direcciones se consideran de sitios distintos. 0.5 =
// comparten la mitad de sus palabras. Es deliberadamente permisivo: este umbral
// solo produce un AVISO, y un aviso que salta de más se acaba ignorando.
export const SIMILITUD_MINIMA = 0.5

export interface ItemUbicacion extends Ubicacion {
  clave: string
  // Las filas sin coordenadas en el archivo reciben una por defecto (el centro
  // de la CDMX) y se marcan pendientes. Compararlas por coordenada diría que
  // todas están en el mismo punto, que es exactamente lo contrario de la verdad.
  coordsFiables?: boolean
}

export interface FueraDelGrupo {
  clave: string
  motivo: string
}

// Dada una lista de pantallas que dicen estar en el MISMO predio, devuelve las
// que no encajan con las demás. Avisa; no decide. La referencia es la primera
// pantalla utilizable: en un archivo por predio, es la que fija dónde está.
export function pantallasFueraDelGrupo(items: ItemUbicacion[]): FueraDelGrupo[] {
  const utilizable = (i: ItemUbicacion) =>
    (i.coordsFiables !== false && puntoDe(i) != null) || normalizarDireccion(i.direccion) !== ''
  const usables = items.filter(utilizable)
  if (usables.length < 2) return [] // Con una sola no hay contra qué comparar.

  const ubicacionDe = (i: ItemUbicacion): Ubicacion => ({
    lat: i.coordsFiables === false ? null : i.lat,
    lng: i.coordsFiables === false ? null : i.lng,
    direccion: i.direccion,
  })

  const ref = usables[0]
  const fuera: FueraDelGrupo[] = []
  for (const i of usables.slice(1)) {
    const r = evaluarCercania(ubicacionDe(ref), ubicacionDe(i))
    if (r.estado === 'LEJOS') {
      const km = (r.metros / 1000).toFixed(1)
      fuera.push({
        clave: i.clave,
        motivo: `a ${r.metros >= 1000 ? `${km} km` : `${r.metros} m`} de «${ref.clave}»`,
      })
      continue
    }
    if (r.estado === 'CERCA') continue
    // INDETERMINADO: no hay coordenadas fiables en ambos. Se cae al parecido de
    // las direcciones, y solo se avisa cuando LAS DOS traen dirección — si una
    // viene vacía no hay evidencia de nada.
    const da = normalizarDireccion(ref.direccion)
    const db = normalizarDireccion(i.direccion)
    if (!da || !db) continue
    if (similitudDireccion(da, db) < SIMILITUD_MINIMA) {
      fuera.push({ clave: i.clave, motivo: `su dirección no se parece a la de «${ref.clave}»` })
    }
  }
  return fuera
}
