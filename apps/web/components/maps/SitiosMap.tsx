'use client'

import { useEffect, useRef } from 'react'

export interface SitioFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    id: string
    nombre: string
    claveInterna: string
    tipoMedio: string
    estatusComercial: string
    estatusLegal: string
    estatusOperativo: string
  }
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: SitioFeature[]
}

interface Props {
  sitios: GeoJSONFeatureCollection
  onSitioClick: (sitioId: string) => void
  height?: string
}

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

const ESTATUS_COLORS: Record<string, string> = {
  DISPONIBLE: '#b8f000',
  RESERVADO: '#fbbf24',
  OCUPADO: '#ff5f5f',
  BLOQUEADO: '#5a5a72',
  EN_MANTENIMIENTO: '#5a5a72',
  BAJA: '#5a5a72',
}

export default function SitiosMap({ sitios, onSitioClick, height = '400px' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const onClickRef = useRef(onSitioClick)
  useEffect(() => { onClickRef.current = onSitioClick }, [onSitioClick])

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    let map: any
    import('maplibre-gl').then((maplibregl) => {
      if (!containerRef.current) return

      map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [-99.1332, 19.4326],
        zoom: 9,
      })

      // Add navigation control
      map.addControl(new maplibregl.NavigationControl(), 'top-right')

      mapRef.current = map
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update markers when sitios changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const interval = setInterval(() => {
      const map = mapRef.current
      if (!map) return
      clearInterval(interval)

      import('maplibre-gl').then((maplibregl) => {
        // Remove old markers
        markersRef.current.forEach((m) => m.remove())
        markersRef.current = []

        for (const feature of sitios.features) {
          const [lng, lat] = feature.geometry.coordinates
          const color = ESTATUS_COLORS[feature.properties.estatusComercial] ?? '#7a7a96'

          const el = document.createElement('div')
          el.style.cssText = [
            'width:14px',
            'height:14px',
            'border-radius:50%',
            `background:${color}`,
            'border:2.5px solid rgba(255,255,255,0.9)',
            'cursor:pointer',
            'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
            'transition:transform 0.15s',
          ].join(';')

          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)' })
          el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
          el.addEventListener('click', () => onClickRef.current(feature.properties.id))

          const popup = new maplibregl.Popup({ closeButton: false, offset: 12 }).setHTML(`
            <div style="font-family:system-ui;font-size:0.8rem;padding:4px 2px;min-width:140px">
              <div style="font-weight:600;margin-bottom:2px">${feature.properties.nombre}</div>
              <div style="color:#888;font-size:0.72rem">${feature.properties.claveInterna} · ${feature.properties.tipoMedio}</div>
            </div>
          `)

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map)

          markersRef.current.push(marker)
        }

        // Fit bounds to all markers
        if (sitios.features.length > 1) {
          const lngs = sitios.features.map((f) => f.geometry.coordinates[0])
          const lats = sitios.features.map((f) => f.geometry.coordinates[1])
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 60, maxZoom: 13, duration: 800 },
          )
        } else if (sitios.features.length === 1) {
          const [lng, lat] = sitios.features[0].geometry.coordinates
          map.flyTo({ center: [lng, lat], zoom: 14 })
        }
      })
    }, 100)

    return () => clearInterval(interval)
  }, [sitios])

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/maplibre-gl@5.22.0/dist/maplibre-gl.css');
        .maplibregl-popup-content {
          background: #16161d !important;
          border: 1px solid #2a2a38 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
          padding: 8px 12px !important;
          color: #e4e4ee !important;
        }
        .maplibregl-popup-tip { display: none !important; }
      `}</style>
      <div
        ref={containerRef}
        style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden', background: '#1a1a24' }}
      />
    </>
  )
}
