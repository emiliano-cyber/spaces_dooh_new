'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

interface Tenant { id: string; nombre: string; subdominioBase: string; plan: string; activo: boolean }
interface Connector { tipo: string; activo: boolean; configurado: boolean; apiKeyMasked: string | null; baseUrl: string | null }

const CONNECTOR_LABELS: Record<string, { label: string; desc: string }> = {
  DOOHMAIN:  { label: 'DOOHMAIN',  desc: 'Plataforma de gestión DOOH nativa' },
  BROADSIGN: { label: 'Broadsign', desc: 'CMS líder para redes DOOH globales' },
  INVIAN:    { label: 'Invian',    desc: 'Sistema de gestión de pantallas' },
}

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.55rem 0.75rem', outline: 'none', width: '100%' }
const lbl: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg)', marginBottom: '0.3rem', display: 'block' }
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }

export default function ConfigPage() {
  const qc = useQueryClient()

  // Tenant form
  const [nombre, setNombre] = useState('')
  const [savingTenant, setSavingTenant] = useState(false)
  const [tenantMsg, setTenantMsg] = useState<string | null>(null)

  // Connector modal
  const [connModal, setConnModal] = useState<string | null>(null) // tipo
  const [connApiKey, setConnApiKey] = useState('')
  const [connBaseUrl, setConnBaseUrl] = useState('')
  const [connActivo, setConnActivo] = useState(false)
  const [savingConn, setSavingConn] = useState(false)
  const [connError, setConnError] = useState<string | null>(null)

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['admin-tenant'],
    queryFn: () => apiFetch('/admin/tenant'),
  })
  const { data: connectors = [] } = useQuery<Connector[]>({
    queryKey: ['admin-connectors'],
    queryFn: () => apiFetch('/admin/connectors'),
  })

  useEffect(() => { if (tenant) setNombre(tenant.nombre) }, [tenant])

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault()
    setSavingTenant(true); setTenantMsg(null)
    try {
      await apiFetch('/admin/tenant', { method: 'PATCH', body: JSON.stringify({ nombre }) })
      qc.invalidateQueries({ queryKey: ['admin-tenant'] })
      setTenantMsg('Guardado correctamente')
      setTimeout(() => setTenantMsg(null), 3000)
    } catch (err) {
      setTenantMsg(err instanceof Error ? err.message : 'Error')
    } finally { setSavingTenant(false) }
  }

  function openConnModal(c: Connector) {
    setConnModal(c.tipo)
    setConnApiKey('')
    setConnBaseUrl(c.baseUrl ?? '')
    setConnActivo(c.activo)
    setConnError(null)
  }

  async function saveConnector(e: React.FormEvent) {
    e.preventDefault()
    if (!connModal) return
    setSavingConn(true); setConnError(null)
    try {
      await apiFetch(`/admin/connectors/${connModal}`, {
        method: 'PATCH',
        body: JSON.stringify({ apiKey: connApiKey, baseUrl: connBaseUrl, activo: connActivo }),
      })
      qc.invalidateQueries({ queryKey: ['admin-connectors'] })
      setConnModal(null)
    } catch (err) {
      setConnError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setSavingConn(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 680 }}>
      <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Configuración</h1>

      {/* Tenant info */}
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empresa</div>
        </div>
        <form onSubmit={saveTenant} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={fld}>
            <label style={lbl}>Nombre de la empresa *</label>
            <input style={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          {tenant && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fld}>
                <label style={{ ...lbl, color: 'var(--muted)' }}>Subdominio</label>
                <div style={{ ...inp, background: 'var(--bg)', color: 'var(--muted)', cursor: 'default' }}>{tenant.subdominioBase}</div>
              </div>
              <div style={fld}>
                <label style={{ ...lbl, color: 'var(--muted)' }}>Plan</label>
                <div style={{ ...inp, background: 'var(--bg)', color: 'var(--muted)', cursor: 'default' }}>{tenant.plan}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button type="submit" disabled={savingTenant} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem', opacity: savingTenant ? 0.7 : 1 }}>
              {savingTenant ? 'Guardando…' : 'Guardar'}
            </button>
            {tenantMsg && <span style={{ fontSize: '0.8125rem', color: tenantMsg.startsWith('Error') ? 'var(--error)' : '#15803D' }}>{tenantMsg}</span>}
          </div>
        </form>
      </section>

      {/* Connectors */}
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conectores CMS</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Integra tus pantallas DOOH con plataformas de gestión externas</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {connectors.map((c) => {
            const meta = CONNECTOR_LABELS[c.tipo] ?? { label: c.tipo, desc: '' }
            return (
              <div key={c.tipo} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{meta.label}</span>
                    {c.configurado && (
                      <span style={{ background: c.activo ? 'rgba(21,128,61,0.12)' : 'rgba(90,90,114,0.15)', color: c.activo ? '#15803D' : 'var(--muted)', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.125rem' }}>{meta.desc}</div>
                  {c.configurado && c.apiKeyMasked && (
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      API Key: {c.apiKeyMasked}
                      {c.baseUrl && <span> · {c.baseUrl}</span>}
                    </div>
                  )}
                </div>
                <button onClick={() => openConnModal(c)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, padding: '0.375rem 0.875rem', flexShrink: 0 }}>
                  {c.configurado ? 'Editar' : 'Configurar'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Connector modal */}
      {connModal && (
        <>
          <div onClick={() => setConnModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', width: 440, zIndex: 201, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Configurar {CONNECTOR_LABELS[connModal]?.label ?? connModal}</h3>
              <button onClick={() => setConnModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}>✕</button>
            </div>
            <form onSubmit={saveConnector} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '7px', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: '#B45309' }}>
                Las credenciales se guardan cifradas. Solo se muestran los últimos 4 caracteres del API key.
              </div>
              <div style={fld}>
                <label style={lbl}>API Key *</label>
                <input style={inp} type="password" value={connApiKey} onChange={(e) => setConnApiKey(e.target.value)} required placeholder="Pega tu API key aquí" minLength={8} />
              </div>
              <div style={fld}>
                <label style={lbl}>Base URL *</label>
                <input style={inp} type="url" value={connBaseUrl} onChange={(e) => setConnBaseUrl(e.target.value)} required placeholder="https://api.plataforma.com" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <input type="checkbox" id="conn-activo" checked={connActivo} onChange={(e) => setConnActivo(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#15803D' }} />
                <label htmlFor="conn-activo" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>Activar conector</label>
              </div>
              {connError && <div style={{ background: 'rgba(255,75,75,0.1)', border: '1px solid var(--error)', borderRadius: '7px', color: 'var(--error)', fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}>{connError}</div>}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={savingConn} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem', opacity: savingConn ? 0.7 : 1 }}>
                  {savingConn ? 'Guardando…' : 'Guardar credenciales'}
                </button>
                <button type="button" onClick={() => setConnModal(null)} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.625rem' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
