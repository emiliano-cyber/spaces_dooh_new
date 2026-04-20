'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Cliente { id: string; nombre: string }
interface SitioItem { id: string; nombre: string; claveInterna: string; ciudad: string; tipoMedio: string; alto?: number; ancho?: number; tieneIncidencia: boolean }

interface LineaDraft {
  sitioId: string; sitioNombre: string; sitioClaveInterna: string; sitioEstado: string
  tipoVenta: string; precio: string; cantidad: string
}

const TIPO_LABELS: Record<string, string> = {
  ESPECTACULAR: 'Espectacular', PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal', MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural', VALLA: 'Valla', OTRO: 'Otro',
}

function inp(style?: React.CSSProperties): React.CSSProperties {
  return { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', width: '100%', ...style }
}

function lbl(text: string) {
  return <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>{text}</label>
}

function StepBar({ step }: { step: number }) {
  const steps = ['Información básica', 'Selección de inventario', 'Revisión y confirmación']
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '2rem' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= step ? 'var(--accent)' : 'var(--border)', transition: 'background 0.3s' }} />}
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: i <= step ? 'var(--accent)' : 'var(--bg-surface)', border: `2px solid ${i <= step ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: i <= step ? '#fff' : 'var(--muted)', flexShrink: 0, transition: 'all 0.3s' }}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? 'var(--accent)' : 'var(--border)', transition: 'background 0.3s' }} />}
          </div>
          <span style={{ fontSize: '0.7rem', color: i === step ? 'var(--fg)' : 'var(--muted)', textAlign: 'center', fontWeight: i === step ? 600 : 400 }}>{s}</span>
        </div>
      ))}
    </div>
  )
}

export default function NuevaCampanaPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [nombre, setNombre] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [tipoCampana, setTipoCampana] = useState<'OOH' | 'DOOH' | 'HIBRIDA'>('OOH')
  const [agencia, setAgencia] = useState('')
  const [marca, setMarca] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [presupuestoBruto, setPresupuestoBruto] = useState('')
  const [presupuestoNeto, setPresupuestoNeto] = useState('')
  const [moneda, setMoneda] = useState('MXN')
  const [notas, setNotas] = useState('')

  // Step 2
  const [lineas, setLineas] = useState<LineaDraft[]>([])
  const [ciudadFil, setCiudadFil] = useState('')
  const [tipoFil, setTipoFil] = useState('')

  // Step 3
  const [confirmarAhora, setConfirmarAhora] = useState(false)

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => apiFetch('/clientes'),
  })

  const qs = new URLSearchParams()
  if (fechaInicio) qs.set('fechaInicio', new Date(fechaInicio).toISOString())
  if (fechaFin) qs.set('fechaFin', new Date(fechaFin).toISOString())
  if (ciudadFil) qs.set('ciudad', ciudadFil)
  if (tipoFil) qs.set('tipoMedio', tipoFil)
  qs.set('limit', '200')

  const { data: sitiosDisp = [] } = useQuery<SitioItem[]>({
    queryKey: ['inventario-wizard', fechaInicio, fechaFin, ciudadFil, tipoFil],
    queryFn: () => apiFetch(`/inventario?${qs}`),
    enabled: step === 1,
  })

  const ciudades = [...new Set(sitiosDisp.map((s) => s.ciudad))].sort()
  const selectedIds = new Set(lineas.map((l) => l.sitioId))

  function toggleSitio(s: SitioItem) {
    if (selectedIds.has(s.id)) {
      setLineas((ls) => ls.filter((l) => l.sitioId !== s.id))
    } else {
      setLineas((ls) => [...ls, {
        sitioId: s.id, sitioNombre: s.nombre, sitioClaveInterna: s.claveInterna,
        sitioEstado: s.ciudad, tipoVenta: 'DAY_PACK', precio: '', cantidad: '1',
      }])
    }
  }

  function updateLinea(sitioId: string, field: keyof LineaDraft, value: string) {
    setLineas((ls) => ls.map((l) => l.sitioId === sitioId ? { ...l, [field]: value } : l))
  }

  const totalPresupuesto = lineas.reduce((sum, l) => {
    const p = parseFloat(l.precio) || 0
    const q = parseInt(l.cantidad) || 1
    return sum + p * q
  }, 0)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const campana = await apiFetch<{ id: string }>('/campanas', {
        method: 'POST',
        body: JSON.stringify({
          nombre, clienteId, tipoCampana, agencia: agencia || undefined,
          marca: marca || undefined,
          fechaInicio: new Date(fechaInicio).toISOString(),
          fechaFin: new Date(fechaFin).toISOString(),
          presupuestoBruto: presupuestoBruto ? Number(presupuestoBruto) : undefined,
          presupuestoNeto: presupuestoNeto ? Number(presupuestoNeto) : undefined,
          moneda, notas: notas || undefined,
        }),
      })

      for (const l of lineas) {
        await apiFetch(`/campanas/${campana.id}/lines`, {
          method: 'POST',
          body: JSON.stringify({
            sitioId: l.sitioId,
            fechaInicio: new Date(fechaInicio).toISOString(),
            fechaFin: new Date(fechaFin).toISOString(),
            tipoVenta: l.tipoVenta,
            precio: parseFloat(l.precio) || 0,
            cantidad: parseInt(l.cantidad) || 1,
          }),
        })
      }

      if (confirmarAhora) {
        await apiFetch(`/campanas/${campana.id}/confirmar`, { method: 'POST', body: '{}' })
      }

      router.push(`/comercial/campanas/${campana.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear campaña')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: 0, marginBottom: '1.5rem' }}>
        ← Volver
      </button>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Nueva campaña</h1>

      <StepBar step={step} />

      {/* ── STEP 1 ── */}
      {step === 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              {lbl('Nombre de campaña *')}
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Campaña Navidad 2026" style={inp()} />
            </div>
            <div>
              {lbl('Cliente *')}
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inp()}>
                <option value="">Selecciona cliente…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              {lbl('Tipo de campaña *')}
              <select value={tipoCampana} onChange={(e) => setTipoCampana(e.target.value as any)} style={inp()}>
                <option value="OOH">OOH — Out-of-Home tradicional</option>
                <option value="DOOH">DOOH — Digital Out-of-Home</option>
                <option value="HIBRIDA">Híbrida — OOH + DOOH</option>
              </select>
            </div>
            <div>
              {lbl('Agencia')}
              <input value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Nombre de agencia" style={inp()} />
            </div>
            <div>
              {lbl('Marca')}
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca anunciante" style={inp()} />
            </div>
            <div>
              {lbl('Fecha inicio *')}
              <input type="date" value={fechaInicio} min={new Date().toISOString().split('T')[0]} onChange={(e) => setFechaInicio(e.target.value)} style={inp()} />
            </div>
            <div>
              {lbl('Fecha fin *')}
              <input type="date" value={fechaFin} min={fechaInicio || new Date().toISOString().split('T')[0]} onChange={(e) => setFechaFin(e.target.value)} style={inp()} />
            </div>
            <div>
              {lbl('Presupuesto bruto')}
              <input type="number" min="0" value={presupuestoBruto} onChange={(e) => setPresupuestoBruto(e.target.value)} placeholder="0.00" style={inp()} />
            </div>
            <div>
              {lbl('Presupuesto neto')}
              <input type="number" min="0" value={presupuestoNeto} onChange={(e) => setPresupuestoNeto(e.target.value)} placeholder="0.00" style={inp()} />
            </div>
            <div>
              {lbl('Moneda')}
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={inp()}>
                <option value="MXN">MXN — Peso Mexicano</option>
                <option value="USD">USD — Dólar</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {lbl('Notas')}
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Observaciones…" style={{ ...inp(), resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              disabled={!nombre || !clienteId || !fechaInicio || !fechaFin}
              onClick={() => setStep(1)}
              style={{ background: nombre && clienteId && fechaInicio && fechaFin ? 'var(--accent)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: nombre && clienteId && fechaInicio && fechaFin ? '#fff' : 'var(--muted)', cursor: nombre && clienteId && fechaInicio && fechaFin ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.5rem' }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>
          {/* Sitios disponibles */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select value={ciudadFil} onChange={(e) => setCiudadFil(e.target.value)} style={{ ...inp(), width: 'auto', flex: 1 }}>
                <option value="">Todas las ciudades</option>
                {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={tipoFil} onChange={(e) => setTipoFil(e.target.value)} style={{ ...inp(), width: 'auto', flex: 1 }}>
                <option value="">Todos los tipos</option>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {sitiosDisp.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  No hay sitios disponibles para las fechas seleccionadas
                </div>
              ) : sitiosDisp.map((s) => {
                const sel = selectedIds.has(s.id)
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', background: sel ? 'rgba(108,99,255,0.08)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <input type="checkbox" checked={sel} onChange={() => toggleSitio(s)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: sel ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.nombre}
                        {s.tieneIncidencia && <span style={{ marginLeft: '0.375rem', fontSize: '0.75rem', color: '#fbbf24' }}>⚠</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {s.claveInterna} · {s.ciudad} · {TIPO_LABELS[s.tipoMedio] ?? s.tipoMedio}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Selected lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Líneas seleccionadas ({lineas.length})</div>
              {lineas.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>Selecciona sitios del panel izquierdo</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 380, overflowY: 'auto' }}>
                  {lineas.map((l) => (
                    <div key={l.sitioId} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.sitioClaveInterna} — {l.sitioNombre}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <select value={l.tipoVenta} onChange={(e) => updateLinea(l.sitioId, 'tipoVenta', e.target.value)} style={{ ...inp(), fontSize: '0.75rem', padding: '0.375rem 0.5rem' }}>
                          {['DAY_PACK','SPOT_UNIT','HOUR_PACK','SOV','TAKEOVER','FIXED_PKG'].map((v) => (
                            <option key={v} value={v}>{v.replace(/_/g,' ')}</option>
                          ))}
                        </select>
                        <input type="number" min="0" placeholder="Precio" value={l.precio} onChange={(e) => updateLinea(l.sitioId, 'precio', e.target.value)} style={{ ...inp(), fontSize: '0.75rem', padding: '0.375rem 0.5rem' }} />
                        <input type="number" min="1" placeholder="Cantidad" value={l.cantidad} onChange={(e) => updateLinea(l.sitioId, 'cantidad', e.target.value)} style={{ ...inp(), fontSize: '0.75rem', padding: '0.375rem 0.5rem', gridColumn: '1 / -1' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.625rem' }}>← Anterior</button>
              <button onClick={() => setStep(2)} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem' }}>Siguiente →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen de la campaña</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem', marginBottom: '1.25rem' }}>
              {[
                ['Nombre', nombre],
                ['Cliente', clientes.find((c) => c.id === clienteId)?.nombre ?? clienteId],
                ['Tipo', tipoCampana],
                ['Moneda', moneda],
                ['Fecha inicio', fechaInicio],
                ['Fecha fin', fechaFin],
                ...(presupuestoBruto ? [['Presupuesto bruto', `${Number(presupuestoBruto).toLocaleString('es-MX')} ${moneda}`]] : []),
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 140, fontSize: '0.8125rem', color: 'var(--muted)', fontWeight: 500 }}>{l}</div>
                  <div style={{ fontSize: '0.875rem' }}>{v}</div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Líneas de campaña ({lineas.length})
            </h3>
            {lineas.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Sin líneas — la campaña se guardará en DRAFT</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Sitio', 'Tipo venta', 'Precio', 'Cant.', 'Subtotal'].map((h) => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.sitioId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>{l.sitioClaveInterna} — {l.sitioNombre}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{l.tipoVenta.replace(/_/g,' ')}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>{Number(l.precio||0).toLocaleString('es-MX')}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>{l.cantidad}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                        {((parseFloat(l.precio)||0) * (parseInt(l.cantidad)||1)).toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted)' }}>Total</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#b8f000' }}>
                      {totalPresupuesto.toLocaleString('es-MX')} {moneda}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.875rem', background: confirmarAhora ? 'rgba(108,99,255,0.08)' : 'var(--bg)', border: `1px solid ${confirmarAhora ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', transition: 'all 0.15s', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={confirmarAhora} onChange={(e) => setConfirmarAhora(e.target.checked)} style={{ width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Confirmar y activar campaña ahora</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                  Si está activo: cambia el estado a CONFIRMADA y crea OTs/TOs automáticamente. Si no, queda en DRAFT.
                </div>
              </div>
            </label>
          </div>

          {error && <div style={{ background: 'rgba(255,92,115,0.1)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '0.875rem', padding: '0.75rem 1rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.625rem 1.25rem' }}>← Anterior</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !nombre || !clienteId}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.9375rem', fontWeight: 600, padding: '0.75rem 2rem', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Creando…' : 'Crear campaña'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
