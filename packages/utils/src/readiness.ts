/**
 * Client-side readiness helpers shared between web and any future consumer.
 * The authoritative readiness check runs server-side (readiness.service.ts).
 * These utilities are for display / progress calculations only.
 */
import type { ReadinessItems, PortalEtapa } from '@spaces-dooh/types'

/** Compute overall progress as a percentage (0–100) */
export function readinessPercent(items: ReadinessItems): number {
  const criteria = [
    items.ocRecibida.ok,
    items.fotosComprobatorias.ok,
    items.reportePublicacion.ok,
    items.otCompletada.requerida ? items.otCompletada.ok : true,
    items.trafficFinalizado.requerido ? items.trafficFinalizado.ok : true,
  ]
  const done = criteria.filter(Boolean).length
  return Math.round((done / criteria.length) * 100)
}

/** Map ReadinessItems to the portal etapas array (indices 0-7) */
export function itemsToEtapas(
  items: ReadinessItems,
  extra: {
    campanaCreada: boolean
    inventarioConfirmado: boolean
    creativoRecibido: boolean
    creativoValidado: boolean
    enPublicacion: boolean
  },
): PortalEtapa[] {
  return [
    { label: 'Campaña creada',          completado: extra.campanaCreada },
    { label: 'Inventario confirmado',   completado: extra.inventarioConfirmado },
    { label: 'Orden de compra recibida',completado: items.ocRecibida.ok },
    { label: 'Creativo recibido',       completado: extra.creativoRecibido },
    { label: 'Creativo validado',       completado: extra.creativoValidado },
    { label: 'En publicación',          completado: extra.enPublicacion },
    { label: 'Reporte generado',        completado: items.reportePublicacion.ok },
    { label: 'Listo para facturar',     completado: items.ocRecibida.ok && items.fotosComprobatorias.ok && items.reportePublicacion.ok },
  ]
}

/** Return a human-readable label for the readiness state */
export function readinessLabel(listaParaFacturar: boolean, items: ReadinessItems): string {
  if (listaParaFacturar) return 'Lista para facturar'
  const pct = readinessPercent(items)
  if (pct === 0) return 'Sin iniciar'
  if (pct < 50) return 'En proceso'
  return 'Casi lista'
}
