// ============================================================================
//  lib/doohmain-aviso.ts — El recordatorio de no tener la pantalla abierta en
//  el sitio de DOOHmain mientras se publica.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: en Campañas, al enviar al dominio y subir el
//  creativo, recordar que no se esté en la pantalla dentro del sitio de
//  DOOHmain, para permitir el proceso. Lo usa `ValidacionPanel.tsx` debajo de
//  sus botones y en los dos diálogos que publican (aprobar y volver a
//  publicar). La regla de cuándo se enseña vive aquí, con prueba, porque
//  dentro del `.tsx` no la comprueba nada.
// ============================================================================

export const AVISO_PANTALLA_DOOHMAIN =
  'Recuerda no estar en la pantalla dentro del sitio de DOOHmain para permitir el proceso: ciérrala allí antes de enviar o publicar.'

/**
 * Se enseña siempre que quien mira tenga un botón que acabe en DOOHmain: una
 * campaña con segmento digital (DOOH o híbrida) y permiso para enviarla o
 * aprobarla. En cualquier estado, porque los tres pasos llevan allí: enviar al
 * dominio, aprobar (que sube el creativo) y volver a publicar.
 */
export function mostrarAvisoPantallaDoohmain(c: {
  puede: boolean
  requiereCreativos: boolean
  enviadaDominio: boolean
  estatus: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
}): boolean {
  return c.puede && c.requiereCreativos
}
