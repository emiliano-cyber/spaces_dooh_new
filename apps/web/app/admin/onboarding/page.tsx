'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'

const TIPO_MEDIO = [
  'ESPECTACULAR',
  'PANTALLA_DIGITAL',
  'PUENTE_PEATONAL',
  'MOBILIARIO_URBANO',
  'MURAL',
  'VALLA',
  'OTRO',
] as const
type TipoMedio = typeof TIPO_MEDIO[number]

interface SitioDraft {
  key: string
  claveInterna: string
  nombre: string
  tipoMedio: TipoMedio
  ciudad: string
  estado: string
  direccion: string
  coords: string // formato "lat, lng" — se parsea al enviar
}

interface AccesoDraft {
  key: string
  contacto: string
  email: string
  password: string
}

interface CreatedSitio { id: string; claveInterna: string; nombre: string }
interface CreatedAcceso { id: string; email: string; nombre: string; password: string }
interface FailedItem { what: string; error: string }

function generatePassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  const chars = [pick(upper), pick(lower), pick(digits)]
  for (let i = 0; i < 11; i++) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function parseCoords(s: string): { lat: number; lng: number } | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (isNaN(lat) || isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function uid() { return Math.random().toString(36).slice(2, 10) }

export default function OnboardingClientePage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1 — empresa
  const [empresa, setEmpresa] = useState('')
  const [ciudadDefault, setCiudadDefault] = useState('')
  const [estadoDefault, setEstadoDefault] = useState('')

  // Step 2 — sitios
  const [sitios, setSitios] = useState<SitioDraft[]>([])

  // Step 3 — accesos
  const [accesos, setAccesos] = useState<AccesoDraft[]>([
    { key: uid(), contacto: '', email: '', password: generatePassword() },
  ])
  const [autoAsignar, setAutoAsignar] = useState(true)

  // Step 4 — resultados
  const [creating, setCreating] = useState(false)
  const [createdSitios, setCreatedSitios] = useState<CreatedSitio[]>([])
  const [createdAccesos, setCreatedAccesos] = useState<CreatedAcceso[]>([])
  const [failures, setFailures] = useState<FailedItem[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Validación por paso
  const step1Ok = empresa.trim().length > 1
  const step2Ok = sitios.every((s) => {
    if (!s.claveInterna.trim() || !s.nombre.trim() || !s.direccion.trim() || !s.ciudad.trim() || !s.estado.trim()) return false
    if (!parseCoords(s.coords)) return false
    return true
  })
  const step3Ok = accesos.length > 0 && accesos.every((a) => {
    return a.contacto.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()) && a.password.length >= 6
  })

  function addSitio() {
    setSitios((prev) => [
      ...prev,
      {
        key: uid(),
        claveInterna: '',
        nombre: '',
        tipoMedio: 'ESPECTACULAR',
        ciudad: ciudadDefault,
        estado: estadoDefault,
        direccion: '',
        coords: '',
      },
    ])
  }

  function updateSitio(key: string, patch: Partial<SitioDraft>) {
    setSitios((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  }

  function removeSitio(key: string) {
    setSitios((prev) => prev.filter((s) => s.key !== key))
  }

  function addAcceso() {
    setAccesos((prev) => [...prev, { key: uid(), contacto: '', email: '', password: generatePassword() }])
  }

  function updateAcceso(key: string, patch: Partial<AccesoDraft>) {
    setAccesos((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)))
  }

  function removeAcceso(key: string) {
    setAccesos((prev) => (prev.length > 1 ? prev.filter((a) => a.key !== key) : prev))
  }

  async function ejecutar() {
    setCreating(true)
    setFailures([])
    const sitiosOk: CreatedSitio[] = []
    const accesosOk: CreatedAcceso[] = []
    const fails: FailedItem[] = []

    // 1) Crear sitios en serie (mejor para detectar conflictos de claveInterna)
    for (const s of sitios) {
      const coords = parseCoords(s.coords)!
      try {
        const created = await apiFetch<{ id: string; claveInterna: string; nombre: string }>('/sitios', {
          method: 'POST',
          body: JSON.stringify({
            claveInterna: s.claveInterna.trim(),
            nombre: s.nombre.trim(),
            tipoMedio: s.tipoMedio,
            lat: coords.lat,
            lng: coords.lng,
            direccion: s.direccion.trim(),
            ciudad: s.ciudad.trim(),
            estado: s.estado.trim(),
            pais: 'MX',
          }),
        })
        sitiosOk.push({ id: created.id, claveInterna: created.claveInterna, nombre: created.nombre })
      } catch (err) {
        fails.push({ what: `Sitio ${s.claveInterna}`, error: err instanceof Error ? err.message : 'Error desconocido' })
      }
    }

    // 2) Crear portal-clientes
    for (const a of accesos) {
      const nombre = `${a.contacto.trim()} — ${empresa.trim()}`
      try {
        const created = await apiFetch<{ id: string; email: string; nombre: string }>('/portal-admin/clientes', {
          method: 'POST',
          body: JSON.stringify({ email: a.email.trim(), password: a.password, nombre }),
        })
        accesosOk.push({ id: created.id, email: created.email, nombre: created.nombre, password: a.password })
      } catch (err) {
        fails.push({ what: `Acceso ${a.email}`, error: err instanceof Error ? err.message : 'Error desconocido' })
      }
    }

    // 3) Asignar sitios creados a TODOS los accesos creados (si está marcado)
    if (autoAsignar && sitiosOk.length > 0 && accesosOk.length > 0) {
      const sitioIds = sitiosOk.map((s) => s.id)
      for (const acceso of accesosOk) {
        try {
          await apiFetch(`/portal-admin/clientes/${acceso.id}/sitios`, {
            method: 'PUT',
            body: JSON.stringify({ sitioIds }),
          })
        } catch (err) {
          fails.push({ what: `Asignar sitios a ${acceso.email}`, error: err instanceof Error ? err.message : 'Error desconocido' })
        }
      }
    }

    setCreatedSitios(sitiosOk)
    setCreatedAccesos(accesosOk)
    setFailures(fails)
    setCreating(false)
    setStep(4)
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { /* noop */ }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = `${baseUrl}/portal/cliente/login`

  const mensajeCompleto = useMemo(() => {
    return createdAccesos.map((a) => (
      `Hola ${a.nombre.split(' — ')[0]},\n\n` +
      `Te comparto el acceso al portal de Spaces DOOH:\n\n` +
      `  Email:     ${a.email}\n` +
      `  Password:  ${a.password}\n` +
      `  URL:       ${portalUrl}\n\n` +
      `Cualquier duda me avisas.`
    )).join('\n\n— — —\n\n')
  }, [createdAccesos, portalUrl])

  // ───────────── UI ─────────────
  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }
  const btnPrimary: React.CSSProperties = { background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.55rem 1.125rem' }
  const btnSecondary: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, padding: '0.55rem 1.125rem' }

  return (
    <div style={{ maxWidth: 920 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Onboarding de cliente nuevo</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Crea empresa, sitios y accesos al portal en un solo flujo. Al final recibirás las credenciales listas para compartir.
      </p>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { n: 1, label: 'Empresa' },
          { n: 2, label: 'Sitios' },
          { n: 3, label: 'Accesos' },
          { n: 4, label: 'Resumen' },
        ].map((s) => {
          const active = step === s.n
          const done = step > s.n
          return (
            <div key={s.n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: active ? 'var(--bg-surface)' : 'transparent', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: done ? '#15803D' : active ? 'var(--accent)' : 'var(--bg)', color: done || active ? '#fff' : 'var(--muted)', fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${done ? '#15803D' : active ? 'var(--accent)' : 'var(--border)'}` }}>
                {done ? '✓' : s.n}
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 500, color: active ? 'var(--fg)' : 'var(--muted)' }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Datos de la empresa</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={lbl}>Nombre de la empresa <span style={{ color: 'var(--error)' }}>*</span></label>
              <input style={inp} value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ej. Tauro Publicidad" autoFocus />
            </div>
            <div>
              <label style={lbl}>Ciudad principal</label>
              <input style={inp} value={ciudadDefault} onChange={(e) => setCiudadDefault(e.target.value)} placeholder="Ej. Mérida" />
            </div>
            <div>
              <label style={lbl}>Estado</label>
              <input style={inp} value={estadoDefault} onChange={(e) => setEstadoDefault(e.target.value)} placeholder="Ej. Yucatán" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            La ciudad y estado se usarán como valores por defecto al agregar sitios. Puedes cambiarlos por sitio si es necesario.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => router.push('/admin/portal-clientes')} style={btnSecondary}>Cancelar</button>
            <button onClick={() => setStep(2)} disabled={!step1Ok} style={{ ...btnPrimary, opacity: step1Ok ? 1 : 0.5, cursor: step1Ok ? 'pointer' : 'not-allowed' }}>
              Siguiente: Sitios →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Sitios de {empresa}</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
                Puedes saltar este paso y agregar sitios después desde Inmuebles. Mínimo 7 campos por sitio.
              </p>
            </div>
            <button onClick={addSitio} style={btnSecondary}>+ Agregar sitio</button>
          </div>

          {sitios.length === 0 ? (
            <div style={{ background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
              Sin sitios todavía. Da click en <strong>+ Agregar sitio</strong> o salta este paso.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {sitios.map((s, idx) => {
                const coordsValid = !s.coords || !!parseCoords(s.coords)
                return (
                  <div key={s.key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>SITIO {idx + 1}</span>
                      <button onClick={() => removeSitio(s.key)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem' }}>Eliminar</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 160px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <label style={lbl}>Clave *</label>
                        <input style={inp} value={s.claveInterna} onChange={(e) => updateSitio(s.key, { claveInterna: e.target.value.toUpperCase() })} placeholder="TAU-001" />
                      </div>
                      <div>
                        <label style={lbl}>Nombre del sitio *</label>
                        <input style={inp} value={s.nombre} onChange={(e) => updateSitio(s.key, { nombre: e.target.value })} placeholder="Espectacular Av. Itzaes" />
                      </div>
                      <div>
                        <label style={lbl}>Dirección *</label>
                        <input style={inp} value={s.direccion} onChange={(e) => updateSitio(s.key, { direccion: e.target.value })} placeholder="Av. Itzaes 123" />
                      </div>
                      <div>
                        <label style={lbl}>Tipo *</label>
                        <select style={{ ...inp, cursor: 'pointer' }} value={s.tipoMedio} onChange={(e) => updateSitio(s.key, { tipoMedio: e.target.value as TipoMedio })}>
                          {TIPO_MEDIO.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 220px', gap: '0.5rem' }}>
                      <div>
                        <label style={lbl}>Ciudad *</label>
                        <input style={inp} value={s.ciudad} onChange={(e) => updateSitio(s.key, { ciudad: e.target.value })} placeholder="Mérida" />
                      </div>
                      <div>
                        <label style={lbl}>Estado *</label>
                        <input style={inp} value={s.estado} onChange={(e) => updateSitio(s.key, { estado: e.target.value })} placeholder="Yucatán" />
                      </div>
                      <div>
                        <label style={lbl}>Coordenadas (lat, lng) *</label>
                        <input
                          style={{ ...inp, fontFamily: 'monospace', borderColor: coordsValid ? 'var(--border)' : 'var(--error)' }}
                          value={s.coords}
                          onChange={(e) => updateSitio(s.key, { coords: e.target.value })}
                          placeholder="20.9674, -89.6237"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setStep(1)} style={btnSecondary}>← Atrás</button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {sitios.length === 0 && (
                <button onClick={() => setStep(3)} style={btnSecondary}>Saltar este paso →</button>
              )}
              <button
                onClick={() => setStep(3)}
                disabled={sitios.length > 0 && !step2Ok}
                style={{ ...btnPrimary, opacity: sitios.length === 0 || step2Ok ? 1 : 0.5, cursor: sitios.length === 0 || step2Ok ? 'pointer' : 'not-allowed' }}
              >
                Siguiente: Accesos →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Accesos al portal — {empresa}</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
                Mínimo 1 acceso. Cada contacto recibe su propio email y password.
              </p>
            </div>
            <button onClick={addAcceso} style={btnSecondary}>+ Agregar acceso</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
            {accesos.map((a, idx) => (
              <div key={a.key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>ACCESO {idx + 1}</span>
                  {accesos.length > 1 && (
                    <button onClick={() => removeAcceso(a.key)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.8rem' }}>Eliminar</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                  <div>
                    <label style={lbl}>Nombre del contacto *</label>
                    <input style={inp} value={a.contacto} onChange={(e) => updateAcceso(a.key, { contacto: e.target.value })} placeholder="Christian" />
                  </div>
                  <div>
                    <label style={lbl}>Email *</label>
                    <input style={inp} type="email" value={a.email} onChange={(e) => updateAcceso(a.key, { email: e.target.value })} placeholder="christian@tauropublicidad.mx" />
                  </div>
                  <div>
                    <label style={lbl}>Contraseña *</label>
                    <input style={{ ...inp, fontFamily: 'monospace' }} value={a.password} onChange={(e) => updateAcceso(a.key, { password: e.target.value })} />
                  </div>
                  <button onClick={() => updateAcceso(a.key, { password: generatePassword() })} style={{ ...btnSecondary, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} title="Regenerar">
                    🎲
                  </button>
                </div>
              </div>
            ))}
          </div>

          {sitios.length > 0 && (
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.625rem 0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={autoAsignar} onChange={(e) => setAutoAsignar(e.target.checked)} />
              Asignar automáticamente los {sitios.length} sitio{sitios.length !== 1 ? 's' : ''} creado{sitios.length !== 1 ? 's' : ''} a todos los accesos
            </label>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setStep(2)} style={btnSecondary}>← Atrás</button>
            <button
              onClick={ejecutar}
              disabled={!step3Ok || creating}
              style={{ ...btnPrimary, opacity: step3Ok && !creating ? 1 : 0.5, cursor: step3Ok && !creating ? 'pointer' : 'not-allowed' }}
            >
              {creating ? 'Creando…' : 'Crear todo →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Resumen */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Resumen verde */}
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: '10px', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#15803D', margin: '0 0 0.5rem' }}>
              ✓ Onboarding de {empresa} completado
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem', fontSize: '0.875rem' }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '0.625rem 0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Empresa</div>
                <div style={{ fontWeight: 600 }}>{empresa}</div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '0.625rem 0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sitios creados</div>
                <div style={{ fontWeight: 600 }}>{createdSitios.length}</div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '0.625rem 0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Accesos creados</div>
                <div style={{ fontWeight: 600 }}>{createdAccesos.length}</div>
              </div>
            </div>
          </div>

          {/* Errores parciales */}
          {failures.length > 0 && (
            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '10px', padding: '1rem 1.125rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '0.5rem' }}>
                ⚠ {failures.length} operación{failures.length !== 1 ? 'es' : ''} falló{failures.length !== 1 ? 'aron' : ''}
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                {failures.map((f, i) => (
                  <li key={i}><strong>{f.what}:</strong> {f.error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Credenciales */}
          {createdAccesos.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Credenciales</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem' }}>
                <strong>Cópialas o envíalas ahora.</strong> No se mostrarán otra vez.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {createdAccesos.map((a) => (
                  <div key={a.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 0.875rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>{a.nombre}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', minWidth: 50 }}>Email:</span>
                        <code style={{ fontSize: '0.8125rem', fontFamily: 'monospace', flex: 1 }}>{a.email}</code>
                        <button onClick={() => copyText(a.email, `email-${a.id}`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          {copiedKey === `email-${a.id}` ? '✓' : 'Copiar'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', minWidth: 50 }}>Pass:</span>
                        <code style={{ fontSize: '0.8125rem', fontFamily: 'monospace', flex: 1 }}>{a.password}</code>
                        <button onClick={() => copyText(a.password, `pass-${a.id}`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          {copiedKey === `pass-${a.id}` ? '✓' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                <button onClick={() => copyText(mensajeCompleto, 'all')} style={btnSecondary}>
                  {copiedKey === 'all' ? '✓ Mensaje copiado' : '📋 Copiar mensaje listo para enviar'}
                </button>
              </div>
            </div>
          )}

          {/* Sitios creados detalle */}
          {createdSitios.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem 1.125rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.5rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sitios creados</h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                {createdSitios.map((s) => (
                  <li key={s.id}><code style={{ fontSize: '0.8rem' }}>{s.claveInterna}</code> — {s.nombre}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setStep(1)
                setEmpresa(''); setCiudadDefault(''); setEstadoDefault('')
                setSitios([])
                setAccesos([{ key: uid(), contacto: '', email: '', password: generatePassword() }])
                setAutoAsignar(true)
                setCreatedSitios([]); setCreatedAccesos([]); setFailures([])
              }}
              style={btnSecondary}
            >
              Onboard otro cliente
            </button>
            <button onClick={() => router.push('/admin/portal-clientes')} style={btnPrimary}>
              Ir a Portal de clientes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
