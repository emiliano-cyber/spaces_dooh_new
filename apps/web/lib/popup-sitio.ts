// ============================================================================
//  lib/popup-sitio.ts — El HTML del popup de un sitio en el mapa, ESCAPADO.
// ----------------------------------------------------------------------------
//  Vive fuera de `components/maps/SitiosMap.tsx` para poder probarlo sin
//  MapLibre ni navegador (SEG-21OCT, 21/10).
//
//  Por qué existe: el mapa metía `nombre`, `claveInterna` y `tipoMedio` tal cual
//  en `Popup.setHTML(...)`. Los captura cualquiera con permiso de inventario, o
//  llegan de un Excel importado, y el popup se abre en la pantalla de quien mire
//  el mapa. Lo único que había en medio era el saneador de MapLibre, que en 5.24
//  se puede esquivar (GHSA-jrc7-96c5-q579). Aquí el texto se escapa ANTES, así
//  que a `setHTML` solo le llega marcado nuestro y el saneador deja de importar.
//
//  `lib/server/email.ts` tiene su propio `escaparHtml`, pero es `server-only` y
//  el mapa corre en el navegador.
// ============================================================================

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapar(texto: string | null | undefined): string {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c])
}

export function htmlPopupSitio(sitio: {
  nombre: string | null | undefined
  claveInterna: string | null | undefined
  tipoMedio: string | null | undefined
}): string {
  const detalle = [sitio.claveInterna, sitio.tipoMedio].filter(Boolean).map(escapar).join(' · ')
  return `
            <div style="font-family:system-ui;font-size:0.8rem;padding:4px 2px;min-width:140px">
              <div style="font-weight:600;margin-bottom:2px">${escapar(sitio.nombre)}</div>
              <div style="color:#888;font-size:0.72rem">${detalle}</div>
            </div>
          `
}
