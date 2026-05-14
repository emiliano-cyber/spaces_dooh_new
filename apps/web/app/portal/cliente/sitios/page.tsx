'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { portalFetch } from '@/lib/portal-cliente-api'

interface Sitio {
  id: string; nombre: string; claveInterna: string; ciudad: string; estado: string
  direccion: string; tipoMedio: string; estatusOperativo: string
}

const MEDIO_LABELS: Record<string, string> = {
  ESPECTACULAR: 'Espectacular', MURO: 'Muro', VALLA: 'Valla', URBANO: 'Urbano',
  DIGITAL: 'Digital', INTERIOR: 'Interior', OTRO: 'Otro',
}

export default function PortalSitiosPage() {
  const router = useRouter()
  const [sitios, setSitios] = useState<Sitio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    portalFetch<Sitio[]>('/portal/cliente/sitios')
      .then(setSitios)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '4rem' }}>Cargando sitios…</div>
  if (error) return <div style={{ color: '#dc2626', textAlign: 'center', paddingTop: '4rem' }}>{error}</div>

  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '0.375rem', color: '#1e293b' }}>Mis sitios</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
        {sitios.length} sitio{sitios.length !== 1 ? 's' : ''} asignado{sitios.length !== 1 ? 's' : ''}
      </p>

      {sitios.length === 0 ? (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          No tienes sitios asignados aún. Contacta a tu ejecutivo.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.875rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {sitios.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/portal/cliente/sitios/${s.id}`)}
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', padding: '1.25rem', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0A66FF'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(10,102,255,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                <span style={{ background: 'rgba(10,102,255,0.08)', color: '#0A66FF', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', letterSpacing: '0.04em' }}>
                  {s.claveInterna}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {MEDIO_LABELS[s.tipoMedio] ?? s.tipoMedio}
                </span>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.375rem' }}>{s.nombre}</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{s.ciudad}, {s.estado}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{s.direccion}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
