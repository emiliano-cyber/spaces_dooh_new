import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { Toaster } from 'sonner'
import { localeMapa, propsAvisos, CLAVES_MAPA } from './librerias'
import { IDIOMAS } from './idiomas'

// ============================================================================
//  B70 (05/11) · LOS TEXTOS QUE PINTAN LAS LIBRERIAS, EN EL IDIOMA DE LA PERSONA.
// ----------------------------------------------------------------------------
//  MapLibre («Zoom in», «Find my location», «Toggle attribution», «Map
//  marker»…) y sonner («Notifications alt+T», «Close toast») traen sus
//  textos en ingles y los pintaban asi en los tres idiomas, tambien en
//  espanol. No pasaban por el diccionario y ninguna guardia los veia: son
//  atributos (`aria-label`, `title`) que pone la libreria en el navegador,
//  fuera del HTML que rinden las pruebas de pantallas.
// ============================================================================

const raiz = join(__dirname, '..', '..')

/** El `defaultLocale` de MapLibre, leido del paquete instalado y no copiado. */
function localePorOmisionDeMapLibre(): Record<string, string> {
  const req = createRequire(join(raiz, 'package.json'))
  const js = readFileSync(req.resolve('maplibre-gl/dist/maplibre-gl.js'), 'utf8')
  const m = js.match(/\{"AttributionControl\.ToggleAttribution":[^}]*\}/)
  if (!m) throw new Error('No se encontro el locale por omision de MapLibre en su paquete')
  return JSON.parse(m[0])
}

// Las unidades de la escala («km», «m», «ft») no son palabras, y la escala no
// se usa en ningun mapa: se quedan con las de la libreria.
const SIN_TRADUCIR = /^ScaleControl\./

describe('B70 · los controles del mapa (MapLibre)', () => {
  const omision = localePorOmisionDeMapLibre()
  const conTexto = Object.keys(omision).filter((k) => !SIN_TRADUCIR.test(k))

  it('cada texto de la libreria tiene su clave en el diccionario (si MapLibre trae uno nuevo, esto lo pide)', () => {
    expect(conTexto.length).toBeGreaterThan(15)
    expect(Object.keys(CLAVES_MAPA).sort()).toEqual([...conTexto].sort())
  })

  it('el ingles es EXACTAMENTE el de la libreria: no cambia nada para quien ya lo veia', () => {
    const en = localeMapa('en')
    for (const k of conTexto) expect(en[k], k).toBe(omision[k])
  })

  it('NEGATIVO · en espanol y en italiano no queda ni un texto en ingles', () => {
    for (const idioma of ['es', 'it'] as const) {
      const l = localeMapa(idioma)
      for (const k of conTexto) {
        expect(l[k], `${idioma} ${k}`).toBeTruthy()
        expect(l[k], `${idioma} ${k}`).not.toBe(omision[k])
      }
    }
  })

  it('los botones que se ven en los mapas de la aplicacion', () => {
    expect(localeMapa('es')).toMatchObject({
      'NavigationControl.ZoomIn': 'Acercar',
      'NavigationControl.ZoomOut': 'Alejar',
      'GeolocateControl.FindMyLocation': 'Buscar mi ubicación',
      'AttributionControl.ToggleAttribution': 'Mostrar u ocultar los créditos del mapa',
      'Marker.Title': 'Marcador del mapa',
      'Map.Title': 'Mapa',
    })
    expect(localeMapa('it')).toMatchObject({
      'NavigationControl.ZoomIn': 'Aumenta lo zoom',
      'NavigationControl.ZoomOut': 'Riduci lo zoom',
      'GeolocateControl.FindMyLocation': 'Trova la mia posizione',
      'Map.Title': 'Mappa',
    })
  })

  it('los TRES mapas de la aplicacion le pasan el locale a MapLibre', () => {
    for (const archivo of [
      'components/demo/MapView.tsx',
      'components/demo/comercial-opex/SelectorUbicacion.tsx',
      'components/maps/SitiosMap.tsx',
    ]) {
      const src = readFileSync(join(raiz, archivo), 'utf8')
      const nuevos = src.match(/new maplibregl\.Map\(\{[\s\S]*?\}\)/g) ?? []
      expect(nuevos.length, archivo).toBeGreaterThan(0)
      for (const n of nuevos) expect(n, archivo).toMatch(/locale: localeMapa\(idioma\)/)
    }
  })
})

describe('B70 · el contenedor de avisos (sonner)', () => {
  const html = (idioma: (typeof IDIOMAS)[number]) => renderToStaticMarkup(createElement(Toaster, propsAvisos(idioma)))

  it('la region de avisos se anuncia en el idioma de la persona', () => {
    expect(html('es')).toContain('aria-label="Notificaciones alt+T"')
    expect(html('en')).toContain('aria-label="Notifications alt+T"')
    expect(html('it')).toContain('aria-label="Notifiche alt+T"')
  })

  it('NEGATIVO · en espanol y en italiano ya no dice «Notifications»', () => {
    expect(html('es')).not.toContain('Notifications')
    expect(html('it')).not.toContain('Notifications')
  })

  it('el boton de cerrar cada aviso', () => {
    expect(propsAvisos('es').toastOptions.closeButtonAriaLabel).toBe('Cerrar aviso')
    expect(propsAvisos('en').toastOptions.closeButtonAriaLabel).toBe('Close notification')
    expect(propsAvisos('it').toastOptions.closeButtonAriaLabel).toBe('Chiudi notifica')
  })

  it('el layout le pasa al Toaster las etiquetas del idioma de la peticion', () => {
    const src = readFileSync(join(raiz, 'app/(app)/layout.tsx'), 'utf8')
    expect(src).toMatch(/<Toaster [^>]*\{\.\.\.propsAvisos\(idioma\)\}/)
  })
})
