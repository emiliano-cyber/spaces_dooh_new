'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiFetch } from '@/lib/api-client'
import type { GeoJSONFeatureCollection } from '@/components/maps/SitiosMap'

const SitiosMap = dynamic(() => import('@/components/maps/SitiosMap'), { ssr: false })

type Tab = 'info' | 'contratos' | 'licencias' | 'incidencias'

const ESTATUS_COMERCIAL_COLORS: Record<string, string> = {
  DISPONIBLE: '#b8f000', RESERVADO: '#fbbf24', OCUPADO: '#ff5f5f',
  BLOQUEADO: '#9090aa', EN_MANTENIMIENTO: '#9090aa', BAJA: '#9090aa',
}
const ESTATUS_LEGAL_COLORS: Record<string, string> = {
  EN_ORDEN: '#b8f000', PERMISO_VENCIDO: '#ff5f5f', EN_TRAMITE: '#fbbf24',
  SUSPENDIDO: '#ff5f5f', SIN_PERMISO: '#ff5f5f',
}
const ESTATUS_OP_COLORS: Record<string, string> = {
  ACTIVO: '#b8f000', EN_MANTENIMIENTO: '#fbbf24', APAGADO: '#9090aa',
  DAÑADO: '#ff5f5f', BAJA: '#9090aa',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, padding: '0.2rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.875rem' }}>{value}</div>
    </div>
  )
}

export default function SitioPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [tab, setTab] = useState<Tab>('info')

  const { data: sitio, isLoading, error } = useQuery({
    queryKey: ['sitio', id],
    queryFn: () => apiFetch<any>(`/sitios/${id}`),
  })

  if (isLoading) return <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem' }}>Cargando…</div>
  if (error || !sitio) return <div style={{ padding: '2rem', color: 'var(--error)' }}>Error al cargar el sitio.</div>

  const geoJson: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(sitio.lng), Number(sitio.lat)] },
      properties: {
        id: sitio.id,
        nombre: sitio.nombre,
        claveInterna: sitio.claveInterna,
        tipoMedio: sitio.tipoMedio,
        estatusComercial: sitio.estatusComercial,
        estatusLegal: sitio.estatusLegal,
        estatusOperativo: sitio.estatusOperativo,
      },
    }],
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'contratos', label: `Contratos (${sitio.contratos?.length ?? 0})` },
    { key: 'licencias', label: `Licencias (${sitio.licencias?.length ?? 0})` },
    { key: 'incidencias', label: `Incidencias (${sitio.incidencias?.length ?? 0})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', justifyContent: 'space-between' }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '0.5rem' }}>
            ← Volver
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.375rem' }}>{sitio.nombre}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge label={sitio.estatusComercial} color={ESTATUS_COMERCIAL_COLORS[sitio.estatusComercial] ?? '#9090aa'} />
            <Badge label={sitio.estatusLegal} color={ESTATUS_LEGAL_COLORS[sitio.estatusLegal] ?? '#9090aa'} />
            <Badge label={sitio.estatusOperativo} color={ESTATUS_OP_COLORS[sitio.estatusOperativo] ?? '#9090aa'} />
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'monospace', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.3rem 0.625rem', borderRadius: '6px' }}>
          {sitio.claveInterna}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', color: tab === key ? 'var(--fg)' : 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: tab === key ? 600 : 400, marginBottom: -1, padding: '0.625rem 1.25rem', transition: 'all 0.15s' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--muted)' }}>DATOS GENERALES</h3>
            <Row label="Tipo de medio" value={sitio.tipoMedio.replace(/_/g, ' ')} />
            <Row label="Dirección" value={sitio.direccion} />
            <Row label="Alcaldía / Municipio" value={sitio.alcaldia} />
            <Row label="Ciudad" value={sitio.ciudad} />
            <Row label="Estado" value={sitio.estado} />
            <Row label="País" value={sitio.pais} />
            <Row label="Coordenadas" value={`${sitio.lat}, ${sitio.lng}`} />
            <Row label="Dimensiones" value={sitio.alto && sitio.ancho ? `${sitio.alto}m × ${sitio.ancho}m` : undefined} />
            <Row label="Iluminado" value={sitio.iluminado ? 'Sí' : 'No'} />
            <Row label="Orientación" value={sitio.orientacion} />
            {sitio.notas && <Row label="Notas" value={<span style={{ color: 'var(--muted)' }}>{sitio.notas}</span>} />}
          </div>
          <div>
            <SitiosMap sitios={geoJson} onSitioClick={() => {}} height="350px" />
          </div>
        </div>
      )}

      {tab === 'contratos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
              + Nuevo contrato
            </button>
          </div>
          {sitio.contratos?.length === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center' }}>Sin contratos registrados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sitio.contratos?.map((c: any) => (
                <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{c.arrendador?.nombre ?? 'Arrendador'}</span>
                    <Badge label={c.estatus} color={c.estatus === 'VIGENTE' ? '#b8f000' : '#fbbf24'} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', display: 'flex', gap: '1.5rem' }}>
                    <span>{new Date(c.fechaInicio).toLocaleDateString('es-MX')} – {new Date(c.fechaFin).toLocaleDateString('es-MX')}</span>
                    <span>${Number(c.montoRenta).toLocaleString('es-MX')} {c.moneda}/{c.periodicidad}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'licencias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
              + Nueva licencia
            </button>
          </div>
          {sitio.licencias?.length === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center' }}>Sin licencias registradas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sitio.licencias?.map((l: any) => (
                <div key={l.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{l.tipo}</span>
                    <Badge label={l.estatus} color={l.estatus === 'VIGENTE' ? '#b8f000' : '#ff5f5f'} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {l.folio && <span>Folio: {l.folio} · </span>}
                    Vence: {new Date(l.fechaVencimiento).toLocaleDateString('es-MX')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'incidencias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' }}>
              Reportar incidencia
            </button>
          </div>
          {sitio.incidencias?.length === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center' }}>Sin incidencias activas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sitio.incidencias?.map((i: any) => (
                <div key={i.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{i.tipo.replace(/_/g, ' ')}</span>
                    <Badge label={i.estatus} color={i.estatus === 'ABIERTA' ? '#ff5f5f' : i.estatus === 'EN_PROCESO' ? '#fbbf24' : '#b8f000'} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{i.descripcion}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{new Date(i.fechaInicio).toLocaleDateString('es-MX')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
