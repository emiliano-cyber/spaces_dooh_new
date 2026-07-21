'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface MiSitio {
  id: string
  nombre: string
  claveInterna: string
  ciudad: string
  direccion: string
  tipoMedio: string
  totalOTs: number
  otsPendientes: number
}

const TIPO_LABEL: Record<string, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal',
  MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

export default function MisSitiosPage() {
  const { data: sitios = [], isLoading, error } = useQuery<MiSitio[]>({
    queryKey: ['mis-sitios'],
    queryFn: () => apiFetch('/ordenes-trabajo/mis-sitios'),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
        Cargando sitios…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: '#ef4444', fontSize: '0.875rem' }}>
        Error al cargar sitios. Intenta de nuevo.
      </div>
    )
  }

  if (sitios.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '0.75rem', color: 'var(--muted)' }}>
        <span style={{ fontSize: '2rem' }}>📍</span>
        <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--fg)', margin: 0 }}>Sin sitios asignados</p>
        <p style={{ fontSize: '0.8125rem', margin: 0 }}>No tienes órdenes de trabajo asociadas a sitios por el momento.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--fg)', margin: 0 }}>
          Mis Sitios
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
          {sitios.length} sitio{sitios.length !== 1 ? 's' : ''} con órdenes de trabajo asignadas
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sitios.map((sitio) => (
          <Link
            key={sitio.id}
            href={`/operaciones/ordenes?sitioId=${sitio.id}`}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent, #6366f1)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', minWidth: 0 }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>📍</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--fg)', marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sitio.claveInterna} — {sitio.nombre}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sitio.direccion}, {sitio.ciudad}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {TIPO_LABEL[sitio.tipoMedio] ?? sitio.tipoMedio}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0 }}>
                {sitio.otsPendientes > 0 && (
                  <span style={{
                    background: '#f59e0b',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                  }}>
                    {sitio.otsPendientes} pendiente{sitio.otsPendientes !== 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {sitio.totalOTs} OT{sitio.totalOTs !== 1 ? 's' : ''} total
                </span>
                <span style={{ fontSize: '1rem', color: 'var(--muted)' }}>›</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
