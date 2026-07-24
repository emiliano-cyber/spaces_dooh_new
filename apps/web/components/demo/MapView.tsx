'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Tono } from './StatusBadge'

// ============================================================================
//  MapView — mapa MapLibre reutilizable. Pines coloreados por tono.
//  Tiles: Maptiler si hay NEXT_PUBLIC_MAPTILER_KEY; si no, raster Carto "light"
//  (sin API key) para que la demo NUNCA dependa de una key que falte ese día.
// ============================================================================

const LIMA: [number, number] = [-77.037, -12.095]

// A partir de este nivel de zoom se muestran automáticamente los nombres de los
// lugares (al alejarse se ocultan para no saturar el mapa).
const LABEL_MIN_ZOOM = 12.5

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
  permitirDibujo = false,
  onZonaChange,
}: {
  points: MapPoint[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  className?: string
  zoom?: number
  autoFit?: boolean
  // Herramienta "dibujar zona": cuando está activa, muestra una barra para trazar
  // un polígono sobre el mapa. Al cerrarlo, notifica sus vértices ([lng,lat][]);
  // al limpiarlo, notifica null. Apagada por default (no afecta otros usos).
  permitirDibujo?: boolean
  onZonaChange?: (poligono: [number, number][] | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const lastFitRef = useRef<string>('')
  const hasFitRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // ── Estado del dibujo de zona (polígono libre) ──────────────────────────────
  const [dibujando, setDibujando] = useState(false)
  const [vertices, setVertices] = useState<[number, number][]>([])
  const [zonaCerrada, setZonaCerrada] = useState(false)
  const dibujandoRef = useRef(false)
  dibujandoRef.current = dibujando

  // Muestra/oculta automáticamente los nombres según el zoom actual. Usa solo
  // refs (estables), así que puede invocarse desde el listener de 'zoom'.
  function aplicarVisibilidadLabels() {
    const map = mapRef.current
    if (!map) return
    const visible = map.getZoom() >= LABEL_MIN_ZOOM
    for (const m of markersRef.current.values()) {
      const lbl = m.getElement().querySelector('.mv-label') as HTMLElement | null
      if (lbl) lbl.style.display = visible ? 'block' : 'none'
    }
  }

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
    // Al cambiar el zoom mostramos/ocultamos los nombres automáticamente.
    map.on('zoom', aplicarVisibilidadLabels)
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
        el.appendChild(document.createElement('span')) // pin (primer hijo)
        // Etiqueta con el nombre del lugar. Automática por zoom (ver
        // aplicarVisibilidadLabels) y además visible al pasar el mouse por el pin.
        const lbl = document.createElement('span')
        lbl.className = 'mv-label'
        lbl.style.cssText = labelStyle()
        el.appendChild(lbl)
        el.addEventListener('mouseenter', () => { lbl.style.display = 'block' })
        el.addEventListener('mouseleave', () => {
          // Al salir, volvemos a la visibilidad que toca según el zoom actual.
          const z = mapRef.current?.getZoom() ?? 0
          lbl.style.display = z >= LABEL_MIN_ZOOM ? 'block' : 'none'
        })
        el.addEventListener('click', () => {
          // Mientras se dibuja la zona, ignorar el clic al pin (no togglear).
          if (dibujandoRef.current) return
          onSelectRef.current?.(p.id)
        })
        marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
        existing.set(p.id, marker)
      } else {
        marker.setLngLat([p.lng, p.lat])
      }
      const root = marker.getElement()
      root.title = p.label ?? ''
      const dot = root.firstChild as HTMLElement
      dot.style.cssText = pinStyle(hex, isSel)
      const lbl = root.querySelector('.mv-label') as HTMLElement | null
      if (lbl) lbl.textContent = p.label ?? ''
    }
    // Remover marcadores que ya no están
    for (const [id, marker] of existing) {
      if (!vistos.has(id)) {
        marker.remove()
        existing.delete(id)
      }
    }

    // Ajusta la visibilidad de los nombres al zoom actual (pines recién creados).
    aplicarVisibilidadLabels()
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

  // ── Dibujo de zona: clic en el mapa agrega un vértice ───────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !permitirDibujo || !dibujando) return
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    const onClick = (e: maplibregl.MapMouseEvent) => {
      setVertices((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]])
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      canvas.style.cursor = ''
    }
  }, [dibujando, permitirDibujo])

  // ── Dibujo de zona: pinta el polígono (relleno + contorno + vértices) ────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !permitirDibujo) return
    const data = zonaGeoJSON(vertices, zonaCerrada)
    const apply = () => {
      try {
        if (!map.getSource('zona')) {
          map.addSource('zona', { type: 'geojson', data })
          map.addLayer({ id: 'zona-fill', type: 'fill', source: 'zona', paint: { 'fill-color': '#0a66ff', 'fill-opacity': 0.12 } })
          map.addLayer({ id: 'zona-line', type: 'line', source: 'zona', paint: { 'line-color': '#0a66ff', 'line-width': 2, 'line-dasharray': [2, 1] } })
          map.addLayer({ id: 'zona-pts', type: 'circle', source: 'zona', paint: { 'circle-radius': 4, 'circle-color': '#ffffff', 'circle-stroke-color': '#0a66ff', 'circle-stroke-width': 2 } })
        } else {
          ;(map.getSource('zona') as maplibregl.GeoJSONSource).setData(data)
        }
      } catch {
        /* el estilo aún no está listo; se reintenta en 'load' */
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [vertices, zonaCerrada, permitirDibujo])

  function iniciarDibujo() {
    setVertices([])
    setZonaCerrada(false)
    setDibujando(true)
    onZonaChange?.(null)
  }
  function cerrarZona() {
    if (vertices.length < 3) return
    setZonaCerrada(true)
    setDibujando(false)
    onZonaChange?.(vertices)
  }
  function limpiarZona() {
    setVertices([])
    setZonaCerrada(false)
    setDibujando(false)
    onZonaChange?.(null)
  }

  const btnCls =
    'rounded-md border border-border-strong bg-surface px-2 py-1 text-[11px] font-medium text-ink shadow-sm transition-colors hover:bg-surface-2 disabled:opacity-50'

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
      {permitirDibujo && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          <div className="pointer-events-auto flex gap-1">
            {!dibujando && !zonaCerrada && (
              <button type="button" onClick={iniciarDibujo} className={btnCls}>
                Dibujar zona
              </button>
            )}
            {dibujando && (
              <>
                <button type="button" onClick={cerrarZona} disabled={vertices.length < 3} className={btnCls}>
                  Cerrar zona ({vertices.length})
                </button>
                <button type="button" onClick={limpiarZona} className={btnCls}>
                  Cancelar
                </button>
              </>
            )}
            {zonaCerrada && (
              <button type="button" onClick={limpiarZona} className={btnCls}>
                Limpiar zona
              </button>
            )}
          </div>
          {dibujando && (
            <span className="pointer-events-none rounded bg-black/70 px-2 py-1 text-[11px] text-white">
              Toca el mapa para marcar la zona (mín. 3 puntos)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Construye el GeoJSON del dibujo: mientras se traza es una línea; al cerrar,
// un polígono. Siempre agrega un punto por cada vértice para que se vean.
function zonaGeoJSON(vertices: [number, number][], cerrada: boolean) {
  const features: any[] = []
  if (cerrada && vertices.length >= 3) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] } })
  } else if (vertices.length >= 2) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: vertices } })
  }
  for (const v of vertices) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: v } })
  }
  return { type: 'FeatureCollection' as const, features }
}

function labelStyle(): string {
  return [
    'position:absolute',
    'left:50%',
    'top:24px',
    'transform:translateX(-50%)',
    'display:none',
    'white-space:nowrap',
    'background:#ffffff',
    'color:#18181b',
    'border:1px solid rgba(0,0,0,0.12)',
    'border-radius:7px',
    'padding:4px 10px',
    'font-size:14px',
    'line-height:1.3',
    'font-weight:600',
    'box-shadow:0 2px 6px rgba(0,0,0,0.18)',
    'pointer-events:none',
    'z-index:1',
  ].join(';')
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
