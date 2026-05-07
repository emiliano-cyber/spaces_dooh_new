'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import dynamic from 'next/dynamic'
import type { GeoJSONFeatureCollection } from '@/components/maps/SitiosMap'

const SitiosMap = dynamic(() => import('@/components/maps/SitiosMap'), { ssr: false })

interface Sitio {
  id: string; nombre: string; claveInterna: string; tipoMedio: string
  ciudad: string; estado: string; pais: string; direccion: string
  alto?: number; ancho?: number; iluminado: boolean; orientacion?: string
  estatusComercial: string; fotosJson: string[]; notas?: string
  lat: number; lng: number
}

interface Incidencia { id: string; tipo: string; descripcion: string; fechaInicio: string; estatus: string }
interface CampanaSimple { id: string; folio: string; nombre: string; estadoComercial: string }

const TIPO_LABELS: Record<string, string> = {
  ESPECTACULAR: 'Espectacular', PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal', MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural', VALLA: 'Valla', OTRO: 'Otro',
}

const ESTATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DISPONIBLE:       { bg: 'rgba(21,128,61,0.15)', color: '#15803D',  label: 'Disponible' },
  RESERVADO:        { bg: 'rgba(251,191,36,0.15)', color: '#B45309', label: 'Reservado' },
  OCUPADO:          { bg: 'rgba(255,95,95,0.15)',  color: '#B91C1C', label: 'Ocupado' },
  BLOQUEADO:        { bg: 'rgba(90,90,114,0.2)',   color: '#71717A', label: 'Bloqueado' },
  EN_MANTENIMIENTO: { bg: 'rgba(90,90,114,0.2)',   color: '#71717A', label: 'En mantenimiento' },
}

function inp(style?: React.CSSProperties): React.CSSProperties {
  return { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', width: '100%', ...style }
}

function makeGeo(sitio: Sitio): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(sitio.lng), Number(sitio.lat)] },
      properties: {
        id: sitio.id, nombre: sitio.nombre, claveInterna: sitio.claveInterna,
        tipoMedio: sitio.tipoMedio, estatusComercial: sitio.estatusComercial,
        estatusLegal: 'EN_ORDEN', estatusOperativo: 'ACTIVO',
      },
    }],
  }
}

export default function FichaComercialPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const router = useRouter()
  const qc = useQueryClient()

  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [photoIdx, setPhotoIdx] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'existente' | 'nueva'>('existente')
  const [campanaSelId, setCampanaSelId] = useState('')
  const [newCampNombre, setNewCampNombre] = useState('')
  const [newCampClienteId, setNewCampClienteId] = useState('')
  const [tipoVenta, setTipoVenta] = useState('DAY_PACK')
  const [precio, setPrecio] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: sitio, isLoading } = useQuery<Sitio>({
    queryKey: ['sitio-comercial', id],
    queryFn: () => apiFetch(`/sitios/${id}`),
  })

  const { data: incidencias = [] } = useQuery<Incidencia[]>({
    queryKey: ['sitio-incidencias', id],
    queryFn: () => apiFetch(`/sitios/${id}/incidencias`),
  })

  const { data: campanas = [] } = useQuery<CampanaSimple[]>({
    queryKey: ['campanas-draft'],
    queryFn: () => apiFetch<{ data: CampanaSimple[] }>('/campanas?estadoComercial=DRAFT&limit=100').then(r => r.data),
    enabled: showModal,
  })

  const { data: cotizaciones = [] } = useQuery<CampanaSimple[]>({
    queryKey: ['campanas-cotizacion'],
    queryFn: () => apiFetch<{ data: CampanaSimple[] }>('/campanas?estadoComercial=COTIZACION&limit=100').then(r => r.data),
    enabled: showModal,
  })

  const { data: clientes = [] } = useQuery<{ id: string; nombre: string }[]>({
    queryKey: ['clientes'],
    queryFn: () => apiFetch('/clientes'),
    enabled: showModal && modalMode === 'nueva',
  })

  const incidenciaActiva = incidencias.find((i) => i.estatus === 'ABIERTA' || i.estatus === 'EN_PROCESO')
  const fotos: string[] = Array.isArray(sitio?.fotosJson) ? sitio!.fotosJson : []
  const disponible = sitio ? !['OCUPADO','BLOQUEADO','EN_MANTENIMIENTO','BAJA'].includes(sitio.estatusComercial) : false

  async function handleAgregarAcampana() {
    if (!sitio || !fechaInicio || !fechaFin) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      let targetId = campanaSelId
      if (modalMode === 'nueva') {
        const camp = await apiFetch<{ id: string }>('/campanas', {
          method: 'POST',
          body: JSON.stringify({
            nombre: newCampNombre,
            clienteId: newCampClienteId,
            tipoCampana: 'OOH',
            fechaInicio: new Date(fechaInicio).toISOString(),
            fechaFin: new Date(fechaFin).toISOString(),
          }),
        })
        targetId = camp.id
      }
      await apiFetch(`/campanas/${targetId}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          sitioId: sitio.id,
          fechaInicio: new Date(fechaInicio).toISOString(),
          fechaFin: new Date(fechaFin).toISOString(),
          tipoVenta,
          precio: Number(precio) || 0,
        }),
      })
      qc.invalidateQueries({ queryKey: ['campanas-draft'] })
      router.push(`/comercial/campanas/${targetId}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading || !sitio) {
    return <div style={{ color: 'var(--muted)', padding: '2rem' }}>{isLoading ? 'Cargando…' : 'Sitio no encontrado.'}</div>
  }

  const es = ESTATUS_STYLE[sitio.estatusComercial] ?? ESTATUS_STYLE.BLOQUEADO
  const candidatas = [...campanas, ...cotizaciones]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '1rem', alignSelf: 'flex-start' }}>
        ← Volver al inventario
      </button>

      {incidenciaActiva && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#B45309' }}>
          ⚠ Incidencia activa: <strong>{incidenciaActiva.tipo.replace(/_/g, ' ')}</strong> — {incidenciaActiva.descripcion}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '65% 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Photo gallery */}
          {fotos.length > 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '16/7', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={fotos[photoIdx]} alt={`foto-${photoIdx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {fotos.length > 1 && (
                  <>
                    <button onClick={() => setPhotoIdx((i) => (i - 1 + fotos.length) % fotos.length)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', width: 32, height: 32, fontSize: '1rem' }}>‹</button>
                    <button onClick={() => setPhotoIdx((i) => (i + 1) % fotos.length)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', width: 32, height: 32, fontSize: '1rem' }}>›</button>
                    <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>{photoIdx + 1}/{fotos.length}</div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              Sin fotos disponibles
            </div>
          )}

          {/* Info */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--muted)' }}>{sitio.claveInterna}</div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{sitio.nombre}</h1>
              </div>
              <span style={{ background: es.bg, color: es.color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{es.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
              {[
                ['Tipo de medio', TIPO_LABELS[sitio.tipoMedio] ?? sitio.tipoMedio],
                ['Dimensiones', sitio.alto && sitio.ancho ? `${sitio.alto}m × ${sitio.ancho}m` : '—'],
                ['Iluminado', sitio.iluminado ? 'Sí' : 'No'],
                ['Orientación', sitio.orientacion ?? '—'],
                ['Ciudad', sitio.ciudad],
                ['Estado', sitio.estado],
                ['Dirección', sitio.direccion],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 130, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: '0.875rem' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mini map */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', height: 300 }}>
            <SitiosMap sitios={makeGeo(sitio)} onSitioClick={() => {}} height="300px" />
          </div>
        </div>

        {/* RIGHT — sticky */}
        <div style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Disponibilidad</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Fecha inicio</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Fecha fin</label>
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inp()} />
              </div>
              <button
                disabled={!disponible || !fechaInicio || !fechaFin}
                onClick={() => setShowModal(true)}
                style={{ width: '100%', background: disponible && fechaInicio && fechaFin ? 'var(--accent)' : 'var(--bg)', border: disponible && fechaInicio && fechaFin ? 'none' : '1px solid var(--border)', borderRadius: '8px', color: disponible && fechaInicio && fechaFin ? '#fff' : 'var(--muted)', cursor: disponible && fechaInicio && fechaFin ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 600, padding: '0.75rem', transition: 'all 0.15s' }}
              >
                + Agregar a campaña
              </button>
              {!disponible && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>Sitio no disponible</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Agregar a campaña</h2>

            <div style={{ display: 'flex', gap: '1rem' }}>
              {(['existente', 'nueva'] as const).map((m) => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="radio" checked={modalMode === m} onChange={() => setModalMode(m)} />
                  {m === 'existente' ? 'Campaña existente' : 'Nueva campaña'}
                </label>
              ))}
            </div>

            {modalMode === 'existente' ? (
              <select value={campanaSelId} onChange={(e) => setCampanaSelId(e.target.value)} style={inp()}>
                <option value="">Selecciona una campaña…</option>
                {candidatas.map((c) => (
                  <option key={c.id} value={c.id}>{c.folio} — {c.nombre}</option>
                ))}
              </select>
            ) : (
              <>
                <input type="text" placeholder="Nombre de campaña" value={newCampNombre} onChange={(e) => setNewCampNombre(e.target.value)} style={inp()} />
                <select value={newCampClienteId} onChange={(e) => setNewCampClienteId(e.target.value)} style={inp()}>
                  <option value="">Selecciona cliente…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Tipo de venta</label>
                <select value={tipoVenta} onChange={(e) => setTipoVenta(e.target.value)} style={inp()}>
                  {['DAY_PACK','SPOT_UNIT','HOUR_PACK','SOV','TAKEOVER','FIXED_PKG'].map((v) => (
                    <option key={v} value={v}>{v.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Precio (MXN)</label>
                <input type="number" min="0" placeholder="0" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inp()} />
              </div>
            </div>

            {submitError && <p style={{ fontSize: '0.8125rem', color: 'var(--error)' }}>{submitError}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Cancelar</button>
              <button
                onClick={handleAgregarAcampana}
                disabled={submitting || (modalMode === 'existente' ? !campanaSelId : !newCampNombre || !newCampClienteId)}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
