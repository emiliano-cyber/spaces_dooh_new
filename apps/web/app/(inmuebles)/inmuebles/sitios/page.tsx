'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import type { GeoJSONFeatureCollection } from '@/components/maps/SitiosMap'

const SitiosMap = dynamic(() => import('@/components/maps/SitiosMap'), { ssr: false })

interface Sitio {
  id: string
  claveInterna: string
  nombre: string
  ciudad: string
  tipoMedio: string
  estatusComercial: string
  estatusLegal: string
  _count?: { incidencias: number }
}

interface SitioListRes { data: Sitio[]; meta: { total: number; pages: number } }

const ESTATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  DISPONIBLE: { bg: 'rgba(21,128,61,0.12)', color: '#15803D', label: 'Disponible' },
  RESERVADO: { bg: 'rgba(251,191,36,0.15)', color: '#B45309', label: 'Reservado' },
  OCUPADO: { bg: 'rgba(255,95,95,0.15)', color: '#B91C1C', label: 'Ocupado' },
  BLOQUEADO: { bg: 'rgba(90,90,114,0.2)', color: '#71717A', label: 'Bloqueado' },
  EN_MANTENIMIENTO: { bg: 'rgba(90,90,114,0.2)', color: '#71717A', label: 'Mantenimiento' },
  BAJA: { bg: 'rgba(90,90,114,0.2)', color: '#71717A', label: 'Baja' },
}

const TIPO_LABELS: Record<string, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla Digital',
  PUENTE_PEATONAL: 'Puente Peatonal',
  MOBILIARIO_URBANO: 'Mob. Urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

export default function SitiosPage() {
  const router = useRouter()
  const [mobileTab, setMobileTab] = useState<'mapa' | 'lista'>('lista')
  const [filters, setFilters] = useState({ search: '', ciudad: '', tipoMedio: '', estatusComercial: '' })

  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.ciudad) params.set('ciudad', filters.ciudad)
  if (filters.tipoMedio) params.set('tipoMedio', filters.tipoMedio)
  if (filters.estatusComercial) params.set('estatusComercial', filters.estatusComercial)
  params.set('limit', '200')

  const { data: sitiosData, isLoading } = useQuery({
    queryKey: ['sitios-list', filters],
    queryFn: () => apiFetch<SitioListRes>(`/sitios?${params}`),
  })

  const { data: geoJson } = useQuery({
    queryKey: ['sitios-map'],
    queryFn: () => apiFetch<GeoJSONFeatureCollection>('/sitios/map'),
  })

  const sitios = sitiosData?.data ?? []

  const emptyGeo: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    color: 'var(--fg)',
    fontSize: '0.8375rem',
    padding: '0.45rem 0.75rem',
    outline: 'none',
    height: 34,
  }

  const selectStyle = inputStyle

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 52px - 3rem)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, width: 200 }}
            placeholder="Buscar sitio…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <input
            style={{ ...inputStyle, width: 140 }}
            placeholder="Ciudad"
            value={filters.ciudad}
            onChange={(e) => setFilters((f) => ({ ...f, ciudad: e.target.value }))}
          />
          <select style={selectStyle} value={filters.tipoMedio} onChange={(e) => setFilters((f) => ({ ...f, tipoMedio: e.target.value }))}>
            <option value="">Tipo medio</option>
            {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select style={selectStyle} value={filters.estatusComercial} onChange={(e) => setFilters((f) => ({ ...f, estatusComercial: e.target.value }))}>
            <option value="">Estatus comercial</option>
            {Object.keys(ESTATUS_BADGE).map((v) => <option key={v} value={v}>{ESTATUS_BADGE[v].label}</option>)}
          </select>
        </div>
        <Link
          href="/inmuebles/sitios/nuevo"
          style={{ background: 'var(--accent)', color: '#fff', borderRadius: '7px', padding: '0.45rem 1rem', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          + Nuevo sitio
        </Link>
      </div>

      {/* Mobile tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
        {(['lista', 'mapa'] as const).map((tab) => (
          <button key={tab} onClick={() => setMobileTab(tab)} style={{ background: mobileTab === tab ? 'var(--bg-hover)' : 'transparent', border: 'none', borderRadius: '6px', color: mobileTab === tab ? 'var(--fg)' : 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: mobileTab === tab ? 600 : 400, padding: '0.35rem 0.875rem', textTransform: 'capitalize' }}>
            {tab === 'lista' ? '☰ Lista' : '⊹ Mapa'}
          </button>
        ))}
      </div>

      {/* Main split layout */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        {/* Map (60%) */}
        <div style={{ flex: '6', minWidth: 0, display: mobileTab === 'mapa' ? 'flex' : undefined, flexDirection: 'column' }}>
          <SitiosMap
            sitios={geoJson ?? emptyGeo}
            onSitioClick={(id) => router.push(`/inmuebles/sitios/${id}`)}
            height="100%"
          />
        </div>

        {/* List (40%) */}
        <div style={{ flex: '4', minWidth: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--muted)' }}>
            {isLoading ? 'Cargando…' : `${sitios.length} sitio${sitios.length !== 1 ? 's' : ''}`}
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {sitios.map((s) => {
              const badge = ESTATUS_BADGE[s.estatusComercial]
              return (
                <div
                  key={s.id}
                  onClick={() => router.push(`/inmuebles/sitios/${s.id}`)}
                  style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.2rem' }}>{s.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.claveInterna} · {TIPO_LABELS[s.tipoMedio] ?? s.tipoMedio} · {s.ciudad}</div>
                    </div>
                    {badge && (
                      <span style={{ ...badge, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {(s._count?.incidencias ?? 0) > 0 && (
                    <div style={{ marginTop: '0.375rem', fontSize: '0.7125rem', color: '#B91C1C' }}>
                      ⚠ {s._count!.incidencias} incidencia{s._count!.incidencias > 1 ? 's' : ''} abierta{s._count!.incidencias > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
