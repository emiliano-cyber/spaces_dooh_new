'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import dynamic from 'next/dynamic'
import type { GeoJSONFeatureCollection } from '@/components/maps/SitiosMap'

const SitiosMap = dynamic(() => import('@/components/maps/SitiosMap'), { ssr: false })

interface SitioItem {
  id: string; nombre: string; claveInterna: string; ciudad: string
  tipoMedio: string; estatusComercial: string; alto?: number; ancho?: number
  tieneIncidencia: boolean; campanasActivas: number
  lat: number; lng: number
}

const TIPO_LABELS: Record<string, string> = {
  ESPECTACULAR: 'Espectacular', PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal', MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural', VALLA: 'Valla', OTRO: 'Otro',
}

const ESTATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DISPONIBLE:       { bg: 'rgba(184,240,0,0.15)', color: '#b8f000' },
  RESERVADO:        { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  OCUPADO:          { bg: 'rgba(255,95,95,0.15)', color: '#ff5f5f' },
  BLOQUEADO:        { bg: 'rgba(90,90,114,0.2)',  color: '#9090aa' },
  EN_MANTENIMIENTO: { bg: 'rgba(90,90,114,0.2)',  color: '#9090aa' },
}

function inp(style?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px',
    color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', width: '100%', ...style,
  }
}

export default function InventarioPage() {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [tipoMedio, setTipoMedio] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Build query string
  const qs = new URLSearchParams()
  if (fechaInicio) qs.set('fechaInicio', new Date(fechaInicio).toISOString())
  if (fechaFin) qs.set('fechaFin', new Date(fechaFin).toISOString())
  if (ciudad) qs.set('ciudad', ciudad)
  if (tipoMedio) qs.set('tipoMedio', tipoMedio)
  if (search) qs.set('search', search)
  qs.set('limit', '200')

  const { data: sitios = [], isLoading } = useQuery<SitioItem[]>({
    queryKey: ['inventario', fechaInicio, fechaFin, ciudad, tipoMedio, search],
    queryFn: () => apiFetch<{ data: SitioItem[] }>(`/inventario?${qs.toString()}`).then(r => r.data),
  })

  const { data: geoData } = useQuery<GeoJSONFeatureCollection>({
    queryKey: ['inventario-geo', fechaInicio, fechaFin, ciudad, tipoMedio, search],
    queryFn: () => apiFetch(`/inventario/map?${qs.toString()}`),
    enabled: sitios.length > 0,
  })

  const ciudades = [...new Set(sitios.map((s) => s.ciudad))].sort()

  const handleMarkerClick = useCallback((sitioId: string) => {
    setSelectedId(sitioId)
    const el = itemRefs.current[sitioId]
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const mapGeo: GeoJSONFeatureCollection = geoData ?? { type: 'FeatureCollection', features: [] }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', margin: '-1.5rem', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: 380, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sticky filters */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.625rem', background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filtrar disponibilidad</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Desde</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inp()} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Hasta</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inp()} />
            </div>
          </div>
          <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={inp()}>
            <option value="">Todas las ciudades</option>
            {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value)} style={inp()}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input
            type="search" placeholder="Buscar por nombre o clave…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inp()}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {isLoading ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '1.5rem', textAlign: 'center' }}>Cargando…</div>
          ) : sitios.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '1.5rem', textAlign: 'center' }}>
              {fechaInicio && fechaFin
                ? 'No hay sitios disponibles para las fechas seleccionadas'
                : 'Sin resultados'}
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', padding: '0.5rem 0.5rem 0.25rem' }}>{sitios.length} sitios</div>
              {sitios.map((s) => {
                const es = ESTATUS_STYLE[s.estatusComercial] ?? ESTATUS_STYLE.BLOQUEADO
                const isSelected = s.id === selectedId
                return (
                  <div
                    key={s.id}
                    ref={(el) => { itemRefs.current[s.id] = el }}
                    onClick={() => { setSelectedId(s.id); router.push(`/comercial/inventario/${s.id}`) }}
                    style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', background: isSelected ? 'var(--bg-hover)' : 'transparent', border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`, marginBottom: '0.25rem', transition: 'all 0.15s' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)' }}>{s.claveInterna} </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{s.nombre}</span>
                        {s.tieneIncidencia && <span style={{ marginLeft: '0.375rem', fontSize: '0.75rem', color: '#fbbf24' }}>⚠</span>}
                      </div>
                      <span style={{ background: es.bg, color: es.color, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>
                        {s.estatusComercial}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>{s.ciudad}</span>
                      <span>·</span>
                      <span>{TIPO_LABELS[s.tipoMedio] ?? s.tipoMedio}</span>
                      {s.alto && s.ancho && <><span>·</span><span>{s.alto}m × {s.ancho}m</span></>}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <SitiosMap
          sitios={mapGeo}
          onSitioClick={handleMarkerClick}
          height="100%"
        />
      </div>
    </div>
  )
}
