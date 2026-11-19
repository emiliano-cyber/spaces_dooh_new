// ============================================================================
//  lib/requisitos-impresion.ts — Lo que cada imprenta pide de un arte.
// ----------------------------------------------------------------------------
//  Decisión del dueño (18/11): «la imprenta usada es de terceros por ahora y,
//  como se vende el proyecto, la imprenta puede ser de cualquiera». Los
//  umbrales de IMP-VAL no pueden quedar fijos: cada IMPRENTA tiene los suyos
//  (`imprentas.requisitos`), la EMPRESA tiene unos por omisión
//  (`config_negocio.requisitos_impresion`) y, si ninguno dice nada, mandan las
//  constantes de siempre (`REQUISITOS_RESPALDO`).
//
//  Se resuelve CAMPO POR CAMPO: una imprenta que solo dice «quiero 25 DPI»
//  hereda el margen de la empresa. Y todo se SANEA al leer, como `costos_ot`:
//  la columna es jsonb y puede traer lo que le metan a mano. Un valor inválido
//  cae al siguiente nivel, NUNCA a 0 (0 DPI daría todo por bueno en silencio).
// ============================================================================

export const FORMATOS_ARTE = ['PNG', 'JPG', 'WEBP', 'PDF', 'TIFF'] as const
export type FormatoArte = (typeof FORMATOS_ARTE)[number]

export type Requisitos = {
  dpiGranVerde: number
  dpiGranAmbar: number
  dpiCercanaVerde: number
  dpiCercanaAmbar: number
  // Lado (m) a partir del cual la lona es de gran formato.
  corteGranM: number
  // Margen de seguridad por lado, en cm.
  margenCm: number
  // null = sin configurar: PNG/JPG/WebP sirven y lo demás es ámbar (IMP-VAL).
  formatos: FormatoArte[] | null
}

export type RequisitosParciales = Partial<Requisitos>

/** Las constantes de IMP-VAL (18/11). Su porqué, en `lib/valoracion-arte.ts`. */
export const REQUISITOS_RESPALDO: Requisitos = {
  dpiGranVerde: 10,
  dpiGranAmbar: 5,
  dpiCercanaVerde: 30,
  dpiCercanaAmbar: 15,
  corteGranM: 6,
  margenCm: 5,
  formatos: null,
}

// Rangos aceptados. Los mismos los exige el servidor (zod) al escribir.
export const RANGOS = {
  dpi: { min: 1, max: 600 },
  corteGranM: { min: 0.5, max: 100 },
  margenCm: { min: 0, max: 50 },
} as const

function numero(v: unknown, min: number, max: number, minExclusivo = false): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  if (n > max || n < min || (minExclusivo && n <= min)) return undefined
  return n
}

/** Solo lo válido del objeto; lo demás desaparece (y cae al siguiente nivel). */
export function sanearRequisitos(crudo: unknown): RequisitosParciales {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {}
  const c = crudo as Record<string, unknown>
  const r: RequisitosParciales = {}
  for (const k of ['dpiGranVerde', 'dpiGranAmbar', 'dpiCercanaVerde', 'dpiCercanaAmbar'] as const) {
    const n = numero(c[k], RANGOS.dpi.min, RANGOS.dpi.max)
    if (n !== undefined) r[k] = n
  }
  const corte = numero(c.corteGranM, RANGOS.corteGranM.min, RANGOS.corteGranM.max)
  if (corte !== undefined) r.corteGranM = corte
  const margen = numero(c.margenCm, RANGOS.margenCm.min, RANGOS.margenCm.max)
  if (margen !== undefined) r.margenCm = margen
  if (Array.isArray(c.formatos)) {
    const f = [...new Set(c.formatos.filter((x): x is FormatoArte => (FORMATOS_ARTE as readonly unknown[]).includes(x)))]
    if (f.length) r.formatos = f
  }
  // Un ámbar por encima de su verde invierte el semáforo: se descarta.
  if (r.dpiGranAmbar !== undefined && r.dpiGranVerde !== undefined && r.dpiGranAmbar > r.dpiGranVerde) delete r.dpiGranAmbar
  if (r.dpiCercanaAmbar !== undefined && r.dpiCercanaVerde !== undefined && r.dpiCercanaAmbar > r.dpiCercanaVerde) delete r.dpiCercanaAmbar
  return r
}

/** Imprenta > empresa > constantes, campo por campo, ya saneado. */
export function resolverRequisitos(imprenta: unknown, empresa: unknown): Requisitos {
  const r: Requisitos = { ...REQUISITOS_RESPALDO, ...sanearRequisitos(empresa), ...sanearRequisitos(imprenta) }
  // Una imprenta que baja el verde por debajo del ámbar heredado.
  r.dpiGranAmbar = Math.min(r.dpiGranAmbar, r.dpiGranVerde)
  r.dpiCercanaAmbar = Math.min(r.dpiCercanaAmbar, r.dpiCercanaVerde)
  return r
}
