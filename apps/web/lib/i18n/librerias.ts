import { traducir, type ClaveTexto } from './diccionario'
import type { Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/librerias.ts — LOS TEXTOS QUE PINTAN LAS LIBRERIAS DE TERCEROS.
// ----------------------------------------------------------------------------
//  B70 (05/11, autorizado por el dueno). MapLibre y sonner traen sus textos en
//  ingles y los ponen ellos mismos en el navegador: el `aria-label` y el
//  `title` de los botones del mapa («Zoom in», «Find my location», «Toggle
//  attribution»), el del marcador («Map marker») y el del lienzo («Map»), y
//  la region de avisos («Notifications alt+T») con su boton de cerrar
//  («Close toast»). Salian en ingles en los TRES idiomas, tambien en espanol,
//  y ninguna guardia los veia: no estan en el HTML que rinden las pruebas.
//
//  Las dos librerias aceptan sus textos por configuracion (`locale` de
//  `new maplibregl.Map`, `containerAriaLabel` y `closeButtonAriaLabel` de
//  `Toaster`), asi que aqui solo se traduce: no se toca su HTML ni su CSS.
//
//  `librerias.test.ts` lee el locale por omision DEL PAQUETE INSTALADO: si una
//  version nueva de MapLibre trae un texto mas, la prueba pide su clave en vez
//  de dejarlo salir en ingles en silencio.
// ============================================================================

/**
 * Clave de MapLibre → clave del diccionario. Las de la escala («km», «ft»)
 * no estan: son unidades, no palabras, y ningun mapa de la app la usa.
 */
export const CLAVES_MAPA: Readonly<Record<string, ClaveTexto>> = {
  'NavigationControl.ZoomIn': 'compartidos.mapa.lib.acercar',
  'NavigationControl.ZoomOut': 'compartidos.mapa.lib.alejar',
  'NavigationControl.ResetBearing': 'compartidos.mapa.lib.norte',
  'FullscreenControl.Enter': 'compartidos.mapa.lib.pantalla-completa',
  'FullscreenControl.Exit': 'compartidos.mapa.lib.salir-pantalla-completa',
  'GeolocateControl.FindMyLocation': 'compartidos.mapa.lib.mi-ubicacion',
  'GeolocateControl.LocationNotAvailable': 'compartidos.mapa.lib.sin-ubicacion',
  'AttributionControl.ToggleAttribution': 'compartidos.mapa.lib.creditos',
  'AttributionControl.MapFeedback': 'compartidos.mapa.lib.comentarios',
  'LogoControl.Title': 'compartidos.mapa.lib.logo',
  'Map.Title': 'compartidos.mapa.lib.mapa',
  'Marker.Title': 'compartidos.mapa.lib.marcador',
  'Popup.Close': 'compartidos.mapa.lib.cerrar-globo',
  'GlobeControl.Enable': 'compartidos.mapa.lib.globo-activar',
  'GlobeControl.Disable': 'compartidos.mapa.lib.globo-desactivar',
  'TerrainControl.Enable': 'compartidos.mapa.lib.relieve-activar',
  'TerrainControl.Disable': 'compartidos.mapa.lib.relieve-desactivar',
  'CooperativeGesturesHandler.WindowsHelpText': 'compartidos.mapa.lib.zoom-windows',
  'CooperativeGesturesHandler.MacHelpText': 'compartidos.mapa.lib.zoom-mac',
  'CooperativeGesturesHandler.MobileHelpText': 'compartidos.mapa.lib.zoom-movil',
}

/**
 * El `locale` que se le pasa a `new maplibregl.Map({ locale })`.
 *
 * MapLibre lee el locale AL CREAR el mapa: los mapas de la app se crean una
 * vez por montaje, asi que un cambio de idioma sin recargar (`router.refresh`
 * conserva el estado del cliente) deja los controles en el idioma anterior
 * hasta volver a entrar en la pantalla. Se acepta: cambiar de idioma es raro y
 * el texto del mapa es secundario.
 */
export function localeMapa(idioma: Idioma): Record<string, string> {
  const l: Record<string, string> = {}
  for (const [clave, nuestra] of Object.entries(CLAVES_MAPA)) l[clave] = traducir(idioma, nuestra)
  return l
}

/** Las etiquetas del `Toaster` de sonner, en el idioma de la peticion. */
export function propsAvisos(idioma: Idioma): {
  containerAriaLabel: string
  toastOptions: { closeButtonAriaLabel: string }
} {
  return {
    containerAriaLabel: traducir(idioma, 'compartidos.avisos.contenedor'),
    toastOptions: { closeButtonAriaLabel: traducir(idioma, 'compartidos.avisos.cerrar') },
  }
}
