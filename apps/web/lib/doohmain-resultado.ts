// Lo que respondió DOOHmain al aprobar una publicación, leído para la persona.
//
// Hasta el 13/10 la ficha DESCARTABA este resultado: salía «Publicación
// aprobada» en verde aunque ninguna pantalla hubiera recibido nada, y lo único
// que quedaba era «con N error(es)» en Actividad, sin decir cuáles. Se encontró
// publicando de punta a punta con las tablas del SDK rotas
// (`20261013_doohmain_seguimiento_unicas.sql`). Puro, sin servidor ni React,
// para poder probarlo solo.

// Una fila por (creativo × pantalla), como la devuelve `publicarCampanaEnDoohmain`.
export interface FilaPublicacion {
  creativoNombre?: string
  sitio: string
  screen: string | null
  ok: boolean
  estado?: string
  error?: string
}

// `undefined`: la ruta no publicó porque la integración está apagada.
// `{ error }`: el intento entero reventó antes de dar filas.
export type RespuestaPublicacion = FilaPublicacion[] | { error: string } | undefined

export interface ResumenPublicacion {
  tipo: 'apagada' | 'error' | 'sin-pantallas' | 'ok' | 'parcial'
  publicadas: number
  yaEstaban: number
  fallidas: number
  filas: FilaPublicacion[]
  error?: string
}

export function resumirPublicacion(r: RespuestaPublicacion): ResumenPublicacion {
  const base = { publicadas: 0, yaEstaban: 0, fallidas: 0, filas: [] as FilaPublicacion[] }
  if (r === undefined) return { ...base, tipo: 'apagada' }
  if (!Array.isArray(r)) return { ...base, tipo: 'error', error: r.error }
  if (r.length === 0) return { ...base, tipo: 'sin-pantallas' }

  const fallidas = r.filter((f) => !f.ok).length
  const yaEstaban = r.filter((f) => f.ok && f.estado === 'already_published').length
  const publicadas = r.length - fallidas - yaEstaban
  const tipo = fallidas === 0 ? 'ok' : fallidas === r.length ? 'error' : 'parcial'
  return { tipo, publicadas, yaEstaban, fallidas, filas: r }
}

// El renglón de Actividad. Nombra pantalla y motivo de cada fallo: es lo único
// que sobrevive a recargar la ficha.
// El reintento (botón de la ficha, 13/10) se escribe aparte: en Actividad tiene
// que verse que fue un segundo intento y no la aprobación.
export function textoAccionPublicacion(filas: FilaPublicacion[], cual: 'aprobacion' | 'reintento' = 'aprobacion'): string {
  const fallos = filas.filter((f) => !f.ok)
  const detalle = fallos.map((f) => `${f.sitio} (${f.error ?? 'sin detalle'})`).join('; ')
  if (cual === 'reintento') {
    return fallos.length
      ? `Reintento de publicación en DOOHmain con ${fallos.length} error(es): ${detalle}`
      : 'Reintento de publicación en DOOHmain sin errores'
  }
  if (!fallos.length) return 'Publicó campaña en DOOHmain'
  return `Publicación en DOOHmain con ${fallos.length} error(es): ${detalle}`
}
