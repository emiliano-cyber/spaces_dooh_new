'use client'

import { useEffect, useRef } from 'react'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Tono } from './StatusBadge'

// ============================================================================
//  MapView — mapa MapLibre reutilizable. Pines coloreados por tono.
//  Tiles: Maptiler si hay NEXT_PUBLIC_MAPTILER_KEY; si no, raster Carto "light"
//  (sin API key) para que la demo NUNCA dependa de una key que falte ese día.
// ============================================================================

const LIMA: [number, number] = [-77.037, -12.095]

const TONO_HEX: Record<Tono, string> = {
  verde: '#10b981',
  ambar: '#f59e0b',
  rojo: '#ef4444',
  azul: '#0a66ff',
  neutro: '#71717a',
}

export interface MapPoint {
  id: string
  lat: number
  lng: number
  tono: Tono
  label?: string
}

function buildStyle(): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY
  if (key) {
    return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${key}`
  }
  // Fallback sin key: raster Carto light (estética plana, encaja con SET).
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap, © CARTO',
      },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
  }
}

export function MapView({
  points,
  selectedId,
  onSelect,
  className,
  zoom = 11,
}: {
  points: MapPoint[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  className?: string
  zoom?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Init una sola vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: LIMA,
      zoom,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sincronizar marcadores con points/selección
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const existing = markersRef.current

    const vistos = new Set<string>()
    for (const p of points) {
      vistos.add(p.id)
      const hex = TONO_HEX[p.tono]
      let marker = existing.get(p.id)
      const isSel = selectedId === p.id
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'demo-map-pin'
        el.addEventListener('click', () => onSelectRef.current?.(p.id))
        marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
        existing.set(p.id, marker)
      } else {
        marker.setLngLat([p.lng, p.lat])
      }
      const el = marker.getElement()
      el.style.cssText = pinStyle(hex, isSel)
      el.title = p.label ?? ''
    }
    // Remover marcadores que ya no están
    for (const [id, marker] of existing) {
      if (!vistos.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }
  }, [points, selectedId])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}

function pinStyle(hex: string, selected: boolean): string {
  const size = selected ? 22 : 16
  return [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:9999px',
    `background:${hex}`,
    'border:2px solid #ffffff',
    `box-shadow:0 0 0 ${selected ? 3 : 1}px ${hex}55`,
    'cursor:pointer',
    'transition:width 150ms,height 150ms,box-shadow 150ms',
    'padding:0',
  ].join(';')
}
