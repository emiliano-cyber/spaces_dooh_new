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

// Encuentra el foco con MÁS sitios: el punto con más vecinos cercanos (densidad)
// y los límites del cúmulo a su alrededor. Así el mapa muestra dónde se concentra
// el inventario en vez de quedarse fijo en un centro arbitrario. Ignora outliers
// lejanos (otra ciudad con pocos sitios no arrastra el encuadre).
const R_DENSIDAD = 0.05 // ~5 km: radio para puntuar densidad
const R_CUMULO = 0.25 // ~25 km: radio del cúmulo a encuadrar (área metropolitana)

function focoDensidad(points: MapPoint[]) {
  const validos = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!validos.length) return null
  let mejor = validos[0]
  let mejorScore = -1
  for (const a of validos) {
    let s = 0
    for (const b of validos) {
      if (Math.abs(a.lat - b.lat) <= R_DENSIDAD && Math.abs(a.lng - b.lng) <= R_DENSIDAD) s++
    }
    if (s > mejorScore) {
      mejorScore = s
      mejor = a
    }
  }
  const cumulo = validos.filter(
    (p) => Math.abs(p.lat - mejor.lat) <= R_CUMULO && Math.abs(p.lng - mejor.lng) <= R_CUMULO,
  )
  return { centro: mejor, cumulo }
}

export function MapView({
  points,
  selectedId,
  onSelect,
  className,
  zoom = 11,
  autoFit = true,
}: {
  points: MapPoint[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  className?: string
  zoom?: number
  autoFit?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const lastFitRef = useRef<string>('')
  const hasFitRef = useRef(false)
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
    // Botón "mi ubicación": pide geolocalización al navegador, muestra tu punto
    // (con círculo de precisión) y centra el mapa en él. Requiere HTTPS o localhost.
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: true,
      }),
      'top-right',
    )
    mapRef.current = map

    // Reproyecta los marcadores si el contenedor cambia de tamaño (reflows).
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
      // El mapa se destruye: reinicia el estado de encuadre para que la próxima
      // instancia (remontaje por StrictMode en dev, o al volver a la pantalla)
      // vuelva a enfocar la zona con más sitios en vez de quedarse en el centro.
      lastFitRef.current = ''
      hasFitRef.current = false
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
        // IMPORTANTE: MapLibre posiciona el elemento RAÍZ con un `transform`.
        // Nunca sobrescribas su `style` (p. ej. cssText) o borras ese transform
        // y el pin salta a la esquina superior izquierda. El visual va en un
        // <span> hijo; el raíz queda íntegro para MapLibre.
        const el = document.createElement('button')
        el.type = 'button'
        el.style.background = 'transparent'
        el.style.border = '0'
        el.style.padding = '0'
        el.style.cursor = 'pointer'
        el.style.lineHeight = '0'
        el.appendChild(document.createElement('span'))
        el.addEventListener('click', () => onSelectRef.current?.(p.id))
        marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
        existing.set(p.id, marker)
      } else {
        marker.setLngLat([p.lng, p.lat])
      }
      const root = marker.getElement()
      root.title = p.label ?? ''
      const dot = root.firstChild as HTMLElement
      dot.style.cssText = pinStyle(hex, isSel)
    }
    // Remover marcadores que ya no están
    for (const [id, marker] of existing) {
      if (!vistos.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }

    // Auto-enfoque a la zona de mayor concentración. Solo cuando cambia el
    // CONJUNTO de sitios (no al seleccionar uno ni al re-render), para no pelear
    // con el desplazamiento manual del usuario.
    if (autoFit) {
      const clave = points.map((p) => p.id).sort().join('|')
      if (clave !== lastFitRef.current && points.length > 0) {
        lastFitRef.current = clave
        const foco = focoDensidad(points)
        if (foco) {
          // La PRIMERA vez encuadra al instante: el mapa "abre" directo en la
          // zona con más carteles. Los cambios posteriores del conjunto se
          // animan suavemente.
          const duration = hasFitRef.current ? 500 : 0
          hasFitRef.current = true
          const aplicarFoco = () => {
            if (foco.cumulo.length === 1) {
              map.easeTo({ center: [foco.centro.lng, foco.centro.lat], zoom: 13, duration })
            } else {
              const b = new maplibregl.LngLatBounds()
              foco.cumulo.forEach((p) => b.extend([p.lng, p.lat]))
              map.fitBounds(b, { padding: 56, maxZoom: 14, duration })
            }
          }
          // Aplicamos el encuadre en cuanto el ESTILO esté listo. Ojo: NO usar
          // map.loaded() — devuelve false mientras cargan los tiles aunque el
          // estilo ya esté y el evento 'load' ya haya ocurrido, lo que dejaría el
          // listener sin disparar y el mapa clavado en el centro inicial.
          if (map.isStyleLoaded()) aplicarFoco()
          else map.once('load', aplicarFoco)
        }
      } else if (points.length === 0) {
        lastFitRef.current = ''
      }
    }
  }, [points, selectedId, autoFit])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}

function pinStyle(hex: string, selected: boolean): string {
  const size = selected ? 22 : 16
  return [
    'display:block',
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
