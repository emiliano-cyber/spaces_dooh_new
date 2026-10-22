// ============================================================================
//  lib/negociacion.ts — Las reglas de Comercial negociación.  NEG-01.
// ----------------------------------------------------------------------------
//  Un espacio en negociación es un PROSPECTO de tipo PREDIO o PANTALLA
//  (`lib/captacion.ts`): un muro, una azotea o un terreno al que se le está
//  buscando el dueño para rentárselo. Encima de la etapa de venta lleva otro
//  eje —la búsqueda de quién firma—, varios contactos, las ofertas de renta al
//  dueño, la competencia, notas, visibilidad, medidas y ubicación.
//
//  Este archivo NO toca base ni red a propósito, como `lib/captacion.ts`: lo
//  usan la pantalla, para no ofrecer lo que el servidor negaría, y el servidor
//  (`negociacion-repo.ts`), que lo vuelve a aplicar con la fila bloqueada.
//  Las listas cerradas son las mismas que los CHECK de
//  `db/migrations/20261022_comercial_negociacion.sql`.
// ============================================================================

import type { Etapa } from './captacion'

export const VISIBILIDADES = ['CERCANA', 'MEDIA', 'LEJANA'] as const
export type Visibilidad = (typeof VISIBILIDADES)[number]

export const ETIQUETA_VISIBILIDAD: Record<Visibilidad, string> = {
  CERCANA: 'Cercana',
  MEDIA: 'Media',
  LEJANA: 'Lejana',
}

/** Las cinco etapas de encontrar a quién hay que convencer (1..5). */
export const ETAPAS_RESPONSABLE = [
  'Sin contacto',
  'Vecinos o intermediarios',
  'Dueño identificado',
  'En contacto con el dueño',
  'Responsable legal confirmado',
] as const

export const CANALES = ['LLAMADA', 'VISITA', 'REUNION', 'CORREO', 'WHATSAPP', 'OTRO'] as const
export type Canal = (typeof CANALES)[number]

export const ETIQUETA_CANAL: Record<Canal, string> = {
  LLAMADA: 'Llamada',
  VISITA: 'Visita en sitio',
  REUNION: 'Reunión',
  CORREO: 'Correo',
  WHATSAPP: 'WhatsApp',
  OTRO: 'Otro',
}

export const ESTADOS_OFERTA = ['ENVIADA', 'CONTRAOFERTA', 'RECHAZADA', 'ACEPTADA'] as const
export type EstadoOferta = (typeof ESTADOS_OFERTA)[number]

export const ETIQUETA_OFERTA: Record<EstadoOferta, string> = {
  ENVIADA: 'Enviada',
  CONTRAOFERTA: 'Contraoferta',
  RECHAZADA: 'Rechazada',
  ACEPTADA: 'Aceptada',
}

/**
 * Cómo se fijó la ubicación. `GPS` existe en la base para no necesitar otra
 * migración, pero NO está aquí: el dueño lo dejó pendiente (22/10), y lo que
 * la API acepta sale de esta lista.
 */
export const ORIGENES_UBICACION = ['PIN', 'BUSCADOR'] as const
export type OrigenUbicacion = (typeof ORIGENES_UBICACION)[number] | 'GPS'

/**
 * ¿Se puede dejar la búsqueda del responsable en `etapa`? La 5 —«Responsable
 * legal confirmado»— exige al menos un contacto que firme: si no, la etapa
 * está mintiendo, que es justo lo que la maqueta ya ataba con una prueba.
 */
export function motivoEtapaResponsable(etapa: number, contactos: { esLegal: boolean }[]): string | null {
  if (!Number.isInteger(etapa) || etapa < 1 || etapa > ETAPAS_RESPONSABLE.length) {
    return 'Esa etapa de la búsqueda del responsable no existe'
  }
  if (etapa === 5 && !contactos.some((c) => c.esLegal)) {
    return 'Para confirmar al responsable legal, marca primero qué contacto firma'
  }
  return null
}

/**
 * ¿Se le puede quitar la firma (o borrar) al contacto `id`? No, si el espacio
 * está en la etapa 5 y es el ÚNICO que firma: dejaría la etapa mintiendo por
 * la puerta de atrás.
 */
export function motivoQuitarLegal(
  etapa: number | null,
  contactos: { id: string; esLegal: boolean }[],
  id: string,
): string | null {
  if (etapa !== 5) return null
  const c = contactos.find((x) => x.id === id)
  if (!c?.esLegal) return null
  if (contactos.some((x) => x.id !== id && x.esLegal)) return null
  return 'Es quien firma y el responsable legal ya está confirmado: marca antes a otro contacto que firme, o baja la etapa'
}

/** El mínimo no puede pasar del máximo; con un solo extremo, vale. */
export function motivoPresupuesto(min: number | null, max: number | null): string | null {
  if (min != null && max != null && min > max) return 'El mínimo del presupuesto no puede ser mayor que el máximo'
  return null
}

/** La versión de la oferta siguiente: la mayor más uno. */
export function siguienteVersion(ofertas: { version: number }[]): number {
  return ofertas.reduce((m, o) => Math.max(m, o.version), 0) + 1
}

/** Aceptada y rechazada son finales; quedarse igual (corregir la nota) siempre vale. */
export function motivoCambioOferta(actual: EstadoOferta, nuevo: EstadoOferta): string | null {
  if (actual === nuevo) return null
  if (actual === 'ACEPTADA' || actual === 'RECHAZADA') {
    return `Esa oferta ya está ${ETIQUETA_OFERTA[actual].toLowerCase()}: haz una nueva versión`
  }
  return null
}

/**
 * ¿Se puede tocar `que` de un espacio en esta etapa de venta?
 *  · `ficha` (tipo, medidas, visibilidad, ubicación…): no en revisión —cambiaría
 *    lo que alguien está revisando, y la ubicación es la que se usa al crear el
 *    predio— ni perdido.
 *  · `hijos` (contactos, ofertas, competencia): no perdido. Un espacio activo
 *    (aprobado) sí: sus contactos y su renta siguen vivos.
 *  · `notas`: siempre. Una nota sobre un espacio perdido («retomar si lo
 *    revenden») es justo para lo que sirven.
 */
export function motivoEdicion(etapa: Etapa, que: 'ficha' | 'hijos' | 'notas'): string | null {
  if (que === 'notas') return null
  if (etapa === 'PERDIDO') return 'El espacio está perdido: ya solo admite notas'
  if (que === 'ficha' && etapa === 'EN_REVISION') {
    return 'Está en revisión: espera la decisión antes de cambiar la ficha'
  }
  return null
}

/** Ancho por alto con dos decimales; sin una de las dos, null —no cero—. */
export function areaM2(ancho: number | null, alto: number | null): number | null {
  if (ancho == null || alto == null) return null
  return Math.round(ancho * alto * 100) / 100
}

export type EstadoEspacio = 'negociacion' | 'activo' | 'inactivo'

/** Lo que la pantalla llama «estado» sale de la etapa de venta. */
export function estadoEspacio(etapa: Etapa): EstadoEspacio {
  if (etapa === 'APROBADO') return 'activo'
  if (etapa === 'PERDIDO') return 'inactivo'
  return 'negociacion'
}

/**
 * Días completos desde `iso` hasta `hoy`. `null` cuando no hay instante —y
 * `null` NO es cero: «nunca se habló» y «se habló hoy» son cosas distintas, el
 * mismo error que este repositorio ya pagó con el `?? 0` del mapa.
 */
export function diasDesde(iso: string | null, hoy: Date): number | null {
  if (!iso) return null
  const ms = hoy.getTime() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}
