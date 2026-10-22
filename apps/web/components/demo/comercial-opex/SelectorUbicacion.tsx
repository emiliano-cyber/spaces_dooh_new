'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// ============================================================================
//  SelectorUbicacion — un mapa con UN pin que la persona coloca y arrastra.
//  NEG-01.
// ----------------------------------------------------------------------------
//  Es lo que fija la ubicación de un espacio en negociación: un clic en el mapa
//  pone el pin, y el pin se arrastra para afinarlo. El buscador de direcciones
//  solo propone un punto de partida (`onCambio` con origen BUSCADOR); lo que se
//  guarda es lo que la persona deja marcado. Es el contrato que exigen los
//  términos de Google para el día que el owner ponga su clave, y el mismo con
//  OpenStreetMap.
//
//  Mismo basemap SIN CLAVE que `MapView.tsx` (OpenFreeMap, ADR 0030), que es el
//  que ya declara la CSP. SIN control de «mi ubicación»: el GPS quedó pendiente
//  por decisión del dueño (22/10), y un botón que centra el mapa en ti sin
//  guardar nada se confundiría con él.
// ============================================================================

const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const CDMX: [number, number] = [-99.1332, 19.4326]

export interface Punto {
  lat: number
  lng: number
}

export function SelectorUbicacion({
  punto,
  onCambio,
  className = 'h-64',
}: {
  punto: Punto | null
  /** Se llama al hacer clic o al soltar el pin. */
  onCambio: (p: Punto) => void
  className?: string
}) {
  const contRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const pinRef = useRef<maplibregl.Marker | null>(null)
  const onCambioRef = useRef(onCambio)
  onCambioRef.current = onCambio

  useEffect(() => {
    if (!contRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: contRef.current,
      style: ESTILO,
      center: punto ? [punto.lng, punto.lat] : CDMX,
      zoom: punto ? 16 : 10,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (e) => onCambioRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
    mapRef.current = map
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(contRef.current)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      pinRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El pin sigue al punto que manda el padre (un clic, un arrastre o un
  // resultado del buscador elegido).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!punto) {
      pinRef.current?.remove()
      pinRef.current = null
      return
    }
    if (!pinRef.current) {
      const pin = new maplibregl.Marker({ draggable: true, color: '#0a66ff' }).setLngLat([punto.lng, punto.lat]).addTo(map)
      pin.on('dragend', () => {
        const ll = pin.getLngLat()
        onCambioRef.current({ lat: ll.lat, lng: ll.lng })
      })
      pinRef.current = pin
    } else {
      pinRef.current.setLngLat([punto.lng, punto.lat])
    }
    const centro = map.getCenter()
    // Solo se recentra si el punto se salió de la vista: no pelear con quien
    // está moviendo el mapa a mano.
    if (!map.getBounds().contains([punto.lng, punto.lat]) || Math.abs(centro.lat - punto.lat) > 1) {
      map.easeTo({ center: [punto.lng, punto.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 })
    }
  }, [punto])

  return (
    <div className="relative">
      <div ref={contRef} className={`w-full overflow-hidden rounded border border-border ${className}`} />
      {!punto && (
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
          Toca el mapa para marcar el lugar
        </span>
      )}
    </div>
  )
}
