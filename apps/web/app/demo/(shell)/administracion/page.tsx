'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Users, ShieldCheck, UserPlus, Building2, X, Plus, Check, Upload, Percent, MonitorPlay } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { ROLES, rolLabel } from '@/components/demo/shell/nav'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import {
  MODULOS_PERMISO,
  ROLES_MATRIZ,
  CAP_CORTA,
  CAP_LABEL,
  type Capacidad,
} from '@/components/demo/admin/permisos'
import { cn } from '@/lib/cn'
import {
  listarUsuariosApi,
  invitarUsuarioApi,
  actualizarUsuarioApi,
  borrarUsuarioApi,
  getPermisosApi,
  getConfigApi,
  actualizarConfigApi,
  type PermisoRow,
} from '@/lib/data/admin-api'
import type { RolDemo, UsuarioDemo, ConfigNegocio } from '@/lib/data/client'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function AdministracionPage() {
  const [toast, setToast] = useState<string | null>(null)
  const notify = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Administración</h1>
        <p className="mt-1 text-[13px] text-muted">Usuarios, roles y configuración del negocio</p>
      </div>

      <Tabs
        defaultValue="usuarios"
        tabs={[
          { value: 'usuarios', label: 'Usuarios' },
          { value: 'roles', label: 'Roles y permisos' },
          { value: 'config', label: 'Configuración' },
        ]}
      >
        <TabPanel value="usuarios" className="pt-4"><Usuarios onToast={notify} /></TabPanel>
        <TabPanel value="roles" className="pt-4"><MatrizRoles /></TabPanel>
        <TabPanel value="config" className="pt-4"><Configuracion onToast={notify} /></TabPanel>
      </Tabs>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {toast}</span>
        </div>
      )}
    </div>
  )
}

// ─── Tab Usuarios ───────────────────────────────────────────────────────────
function Usuarios({ onToast }: { onToast: (m: string) => void }) {
  const { sesion } = useSesionCtx()
  const yo = sesion?.usuario.id
  const [usuarios, setUsuarios] = useState<UsuarioDemo[] | null>(null)
  const [invOpen, setInvOpen] = useState(false)

  const cargar = useCallback(async () => setUsuarios(await listarUsuariosApi()), [])
  useEffect(() => { cargar() }, [cargar])

  async function cambiarRol(id: string, rol: RolDemo, nombre: string) {
    await actualizarUsuarioApi(id, { rol })
    onToast(`${nombre}: rol cambiado a ${rolLabel(rol)}`)
    cargar()
  }
  async function toggle(id: string, activo: boolean, nombre: string) {
    await actualizarUsuarioApi(id, { activo: !activo })
    onToast(`${nombre}: ${activo ? 'desactivado' : 'activado'}`)
    cargar()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-muted" /> Equipo</CardTitle>
        <Button size="sm" onClick={() => setInvOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Invitar usuario</Button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!usuarios ? (
          <div className="space-y-2 px-4 pb-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />)}</div>
        ) : usuarios.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">Sin usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Usuario</th>
                  <th className="px-4 py-2 font-medium">Rol</th>
                  <th className="px-4 py-2 font-medium">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const esYo = u.id === yo
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-ink">{u.nombre}</span>
                          {esYo && <span className="rounded-full border border-accent/50 bg-[#f59e0b1a] px-1.5 py-0.5 text-[10px] font-medium text-[#9a6700]">tú</span>}
                        </div>
                        <div className="demo-num text-[11px] text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {esYo ? (
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink"><ShieldCheck className="h-3.5 w-3.5 text-muted" /> {rolLabel(u.rol)}</span>
                        ) : (
                          <select value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value as RolDemo, u.nombre)}
                            className="h-8 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <button type="button" disabled={esYo} onClick={() => toggle(u.id, u.activo, u.nombre)}
                          className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium',
                            u.activo ? 'border-[#10b98140] bg-[#10b9811a] text-[#0f7a55]' : 'border-border bg-surface-2 text-muted',
                            esYo ? 'cursor-default opacity-70' : 'hover:opacity-80')}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', u.activo ? 'bg-success' : 'bg-muted')} />
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <InvitarModal open={invOpen} onOpenChange={setInvOpen} onInvitado={(n) => { onToast(`Usuario ${n} invitado (contraseña inicial: spaces123)`); cargar() }} />
    </Card>
  )
}

function InvitarModal({ open, onOpenChange, onInvitado }: { open: boolean; onOpenChange: (v: boolean) => void; onInvitado: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [rol, setRol] = useState<RolDemo>('COMERCIAL')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const valido = nombre.trim() && email.trim()

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      await invitarUsuarioApi({ nombre: nombre.trim(), email: email.trim(), cargo: cargo.trim() || 'Miembro del equipo', rol })
      onInvitado(nombre.trim())
      onOpenChange(false)
      setNombre(''); setEmail(''); setCargo('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo invitar')
    }
    setEnviando(false)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Invitar usuario" subtitle="Se crea con contraseña inicial spaces123"
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button><Button size="sm" disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Creando…' : 'Crear usuario'}</Button></div>}>
      <div className="space-y-3">
        <Campo label="Nombre"><input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Campo>
        <Campo label="Correo"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" /></Campo>
        <Campo label="Cargo"><input className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)} /></Campo>
        <Campo label="Rol"><select className={inputCls} value={rol} onChange={(e) => setRol(e.target.value as RolDemo)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Campo>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    </Modal>
  )
}

// ─── Tab Roles (matriz desde BD) ────────────────────────────────────────────
function MatrizRoles() {
  const [rows, setRows] = useState<PermisoRow[] | null>(null)
  useEffect(() => { getPermisosApi().then(setRows) }, [])

  const tiene = (modulo: string, rol: string, cap: Capacidad) =>
    !!rows?.some((r) => r.modulo === modulo && r.rol === rol && r.accion === cap)

  return (
    <Card>
      <CardHeader><CardTitle>Permisos por rol y módulo</CardTitle></CardHeader>
      <CardContent className="px-0 pb-0">
        {!rows ? (
          <div className="h-32 animate-pulse rounded bg-surface-2 mx-4 mb-4" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Módulo</th>
                  {ROLES_MATRIZ.map((r) => <th key={r.rol} className="px-3 py-2 text-center font-medium">{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {MODULOS_PERMISO.map((mod) => (
                  <tr key={mod.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{mod.label}</td>
                    {ROLES_MATRIZ.map((r) => {
                      const caps = (['ver', 'crear', 'aprobar', 'facturar'] as Capacidad[]).filter((c) => tiene(mod.key, r.rol, c))
                      return (
                        <td key={r.rol} className="px-3 py-2.5 text-center">
                          {caps.length === 0 ? <span className="text-muted">—</span> : (
                            <span className="inline-flex gap-0.5">{caps.map((c) => <CapChip key={c} cap={c} />)}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted">
          {(['ver', 'crear', 'aprobar', 'facturar'] as Capacidad[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5"><CapChip cap={c} /> {CAP_LABEL[c]}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function CapChip({ cap }: { cap: Capacidad }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-surface-2 text-[10px] font-semibold text-ink">{CAP_CORTA[cap]}</span>
}

// ─── Tab Configuración (BD) ─────────────────────────────────────────────────
function Configuracion({ onToast }: { onToast: (m: string) => void }) {
  const [config, setConfig] = useState<ConfigNegocio | null>(null)
  const [nuevoPlazo, setNuevoPlazo] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [nuevoIva, setNuevoIva] = useState('')
  useEffect(() => { getConfigApi().then(setConfig) }, [])

  async function guardar(cambios: Partial<ConfigNegocio>, msg?: string) {
    const c = await actualizarConfigApi(cambios)
    setConfig(c)
    if (msg) onToast(msg)
  }

  function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 1.5 * 1024 * 1024) { onToast('El logo supera 1.5 MB'); return }
    const reader = new FileReader()
    reader.onload = () => guardar({ logoUrl: reader.result as string }, 'Logo actualizado')
    reader.readAsDataURL(f)
  }

  if (!config) return <div className="h-64 animate-pulse rounded-md bg-surface-2" />

  const spotsPorLoop = config.spotSeg > 0 ? Math.floor(config.loopSeg / config.spotSeg) : 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2"><Building2 className="h-4 w-4 text-muted" /><CardTitle>Identidad de la empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <Campo label="Logo">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
                {config.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.logoUrl} alt="logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-6 w-6 text-muted" />
                )}
              </div>
              <div className="flex gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded border border-border-strong px-3 text-[13px] text-ink hover:bg-surface-2">
                  <Upload className="h-3.5 w-3.5" /> Subir logo
                  <input type="file" accept="image/*" className="hidden" onChange={subirLogo} />
                </label>
                {config.logoUrl && (
                  <Button size="sm" variant="secondary" onClick={() => guardar({ logoUrl: null }, 'Logo quitado')}>Quitar</Button>
                )}
              </div>
            </div>
            <span className="mt-1 block text-[11px] text-muted">Se muestra en el menú lateral. PNG/JPG, máx. 1.5 MB.</span>
          </Campo>

          <Campo label="Nombre de la empresa">
            <input className={inputCls} value={config.nombreTenant}
              onChange={(e) => setConfig({ ...config, nombreTenant: e.target.value })}
              onBlur={(e) => guardar({ nombreTenant: e.target.value }, 'Nombre actualizado')} />
          </Campo>
          <Campo label="Moneda">
            <div className="flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">$ · Peso mexicano (MXN)</div>
          </Campo>
        </CardContent>
      </Card>

      {/* IVA(s) con los que trabaja */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2"><Percent className="h-4 w-4 text-muted" /><CardTitle>IVA(s) con los que trabaja</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {config.ivaTasas.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] text-ink">
                <span className="demo-num">{p}%</span>
                <button type="button" disabled={config.ivaTasas.length <= 1}
                  onClick={() => guardar({ ivaTasas: config.ivaTasas.filter((x) => x !== p) })}
                  className="text-muted hover:text-error disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
            <div className="inline-flex items-center gap-1">
              <input type="number" value={nuevoIva} onChange={(e) => setNuevoIva(e.target.value)} placeholder="%"
                className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
              <Button size="sm" variant="secondary" onClick={() => {
                const nx = Number(nuevoIva)
                if (nx >= 0 && !config.ivaTasas.includes(nx)) guardar({ ivaTasas: [...config.ivaTasas, nx].sort((a, b) => a - b) }, `IVA ${nx}% agregado`)
                setNuevoIva('')
              }}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted">Las tasas disponibles para facturar. El IVA aplicado se elige por cliente.</p>
        </CardContent>
      </Card>

      {/* Reproducción digital (loop y spot) */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2"><MonitorPlay className="h-4 w-4 text-muted" /><CardTitle>Reproducción digital (loop)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo label="Tamaño del loop (seg)">
              <input type="number" className={`demo-num ${inputCls}`} defaultValue={config.loopSeg}
                onBlur={(e) => { const v = Math.max(1, Number(e.target.value) || 0); if (v !== config.loopSeg) guardar({ loopSeg: v }, 'Loop actualizado') }} />
            </Campo>
            <Campo label="Duración por slot (seg)">
              <input type="number" className={`demo-num ${inputCls}`} defaultValue={config.spotSeg}
                onBlur={(e) => { const v = Math.max(1, Number(e.target.value) || 0); if (v !== config.spotSeg) guardar({ spotSeg: v }, 'Slot actualizado') }} />
            </Campo>
            <Campo label="Slots por loop">
              <div className="demo-num flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] font-semibold text-ink">{spotsPorLoop}</div>
            </Campo>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Determina cuántos slots tiene un loop (loop ÷ slot). Se usa al apartar pantallas digitales en campañas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plazos de cobranza (días)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {config.plazosCobranza.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] text-ink">
                <span className="demo-num">{p}</span>
                <button type="button" onClick={() => guardar({ plazosCobranza: config.plazosCobranza.filter((x) => x !== p) })} className="text-muted hover:text-error"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
            <div className="inline-flex items-center gap-1">
              <input type="number" value={nuevoPlazo} onChange={(e) => setNuevoPlazo(e.target.value)} placeholder="días"
                className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
              <Button size="sm" variant="secondary" onClick={() => {
                const nx = Number(nuevoPlazo)
                if (nx > 0 && !config.plazosCobranza.includes(nx)) guardar({ plazosCobranza: [...config.plazosCobranza, nx].sort((a, b) => a - b) }, `Plazo ${nx} días agregado`)
                setNuevoPlazo('')
              }}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tipos de tarea de cuadrilla</CardTitle></CardHeader>
        <CardContent>
          <ul className="mb-3 space-y-1.5">
            {config.tiposTarea.map((t) => (
              <li key={t} className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-[13px] text-ink">
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> {t}</span>
                <button type="button" onClick={() => guardar({ tiposTarea: config.tiposTarea.filter((x) => x !== t) })} className="text-muted hover:text-error"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Nuevo tipo de tarea" className={inputCls} />
            <Button size="sm" variant="secondary" onClick={() => {
              const t = nuevoTipo.trim()
              if (t && !config.tiposTarea.includes(t)) guardar({ tiposTarea: [...config.tiposTarea, t] }, 'Tipo de tarea agregado')
              setNuevoTipo('')
            }}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
