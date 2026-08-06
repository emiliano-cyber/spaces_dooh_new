'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Users, ShieldCheck, UserPlus, Building2, X, Plus, Check, Upload, Percent, MonitorPlay, KeyRound, Scale, AlertTriangle, Mail, CornerUpLeft } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { ROLES, rolLabel } from '@/components/demo/shell/nav'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import {
  CAPACIDADES,
  CAP_CORTA,
  CAP_LABEL,
  type Capacidad,
} from '@/components/demo/admin/permisos'
import { cn } from '@/lib/cn'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'
import { restablecerPasswordApi, desbloquearApi, esErrorDeDesbloqueo } from '@/lib/data/cambios-api'
import { areasDeModulo } from '@/lib/modulos'
import { TIPO_OT_LABEL, TIPO_OT_SOLO_FIJA, tiposOtPara } from '@/lib/tipos-ot'
import { OrganizacionesPanel } from '@/components/demo/admin/OrganizacionesPanel'
import { ControlCambiosPanel } from '@/components/demo/admin/ControlCambiosPanel'
import {
  listarUsuariosApi,
  invitarUsuarioApi,
  actualizarUsuarioApi,
  borrarUsuarioApi,
  getPermisosMatrizApi,
  getConfigApi,
  actualizarConfigApi,
  type PermisosMatriz,
} from '@/lib/data/admin-api'
import { useActualizarConfig, useSitios } from '@/lib/data/client'
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

      {/* Organizaciones (CRMs) — solo super-admin de plataforma */}
      <OrganizacionesPanel />

      <Tabs
        defaultValue="usuarios"
        tabs={[
          { value: 'usuarios', label: 'Usuarios' },
          { value: 'roles', label: 'Roles y permisos' },
          { value: 'config', label: 'Configuración' },
        ]}
      >
        <TabPanel value="usuarios" className="pt-4"><Usuarios onToast={notify} /></TabPanel>
        <TabPanel value="roles" className="pt-4"><div className="space-y-4"><ControlCambiosPanel onToast={notify} /><MatrizRoles /></div></TabPanel>
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
  const { sesion, refrescar } = useSesionCtx()
  const yo = sesion?.usuario.id

  // La sesión del shell se carga UNA vez al montar (lib/auth-real.ts). Si el
  // cambio recae sobre el usuario que está viendo la pantalla, hay que releerla:
  // si no, la barra superior sigue diciendo su rol anterior y `usePuede()` sigue
  // ofreciéndole botones que el servidor ya le va a rechazar. El servidor SÍ se
  // entera al momento (`auth_usuario_por_sesion` lee el rol vigente), así que
  // esto es coherencia de la UI, no un permiso que se estuviera colando.
  async function refrescarSiSoyYo(id: string) {
    if (id === yo) await refrescar()
  }
  const [usuarios, setUsuarios] = useState<UsuarioDemo[] | null>(null)
  const [invOpen, setInvOpen] = useState(false)
  // Usuario al que se le va a cambiar la contraseña (null = modal cerrado).
  const [passwordDe, setPasswordDe] = useState<UsuarioDemo | null>(null)

  const cargar = useCallback(async () => setUsuarios(await listarUsuariosApi()), [])
  useEffect(() => { cargar() }, [cargar])

  async function cambiarRol(id: string, rol: RolDemo, nombre: string) {
    await actualizarUsuarioApi(id, { rol })
    onToast(`${nombre}: rol cambiado a ${rolLabel(rol)}`)
    cargar()
    await refrescarSiSoyYo(id)
  }
  async function toggle(id: string, activo: boolean, nombre: string) {
    await actualizarUsuarioApi(id, { activo: !activo })
    onToast(`${nombre}: ${activo ? 'desactivado' : 'activado'}`)
    cargar()
    await refrescarSiSoyYo(id)
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
                  <th className="px-4 py-2 font-medium">Contraseña</th>
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
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setPasswordDe(u)}
                          className="inline-flex items-center gap-1.5 rounded border border-border-strong px-2 py-1 text-[12px] text-ink hover:bg-surface-2">
                          <KeyRound className="h-3.5 w-3.5 text-muted" /> {esYo ? 'Cambiar la mía' : 'Cambiar'}
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

      <InvitarModal open={invOpen} onOpenChange={setInvOpen} onInvitado={(n) => { onToast(`Usuario ${n} creado`); cargar() }} />

      {passwordDe && (
        <CambiarPasswordModal
          usuario={passwordDe}
          esYo={passwordDe.id === yo}
          onClose={() => setPasswordDe(null)}
          onDone={() => { onToast(passwordDe.id === yo ? 'Tu contraseña se actualizó' : `Contraseña de ${passwordDe.nombre} actualizada`); setPasswordDe(null) }}
        />
      )}
    </Card>
  )
}

// Contraseña de un usuario. Son DOS operaciones distintas y a propósito no se
// parecen (ADR 0009):
//
//  · La propia ("tú") exige la contraseña actual y va por /api/perfil.
//  · La de OTRO ya NO deja elegir la contraseña. Antes el Dueño fijaba una que
//    él conocía, entraba como esa persona y todo quedaba registrado a nombre de
//    ella — impersonación limpia (A7). Ahora el servidor genera una temporal de
//    un solo uso, corta las sesiones del afectado y le obliga a cambiarla.
function CambiarPasswordModal({
  usuario, esYo, onClose, onDone,
}: { usuario: UsuarioDemo; esYo: boolean; onClose: () => void; onDone: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // La temporal se enseña UNA vez: en cuanto se cierra el modal no hay forma de
  // volver a verla, porque en la base solo queda su hash.
  const [temporal, setTemporal] = useState<string | null>(null)
  // Reautenticación del ACTOR, aquí dentro. El servidor la exige SIEMPRE para
  // tocar el acceso de otra persona (ADR 0009), pero el único sitio donde se
  // podía teclear era el botón de la barra superior — y ese solo aparece si el
  // tenant tiene el control de cambios ENCENDIDO, que está apagado en los cinco
  // de producción. Resultado: el 403 se pintaba en rojo y no había ningún lugar
  // donde dar la contraseña, así que restablecer era INALCANZABLE. Se pide en
  // el mismo modal, que es donde estás.
  const [reautenticando, setReautenticando] = useState(false)
  const [passActor, setPassActor] = useState('')

  async function guardarPropia() {
    setError(null)
    if (nueva.length < 8) { setError('La contraseña debe tener al menos 8 caracteres, con letra y número.'); return }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    if (!actual) { setError('Ingresa tu contraseña actual para confirmar.'); return }
    setEnviando(true)
    try {
      const r = await fetch('/spaces-dooh/api/perfil/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nueva, passwordActual: actual }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo cambiar la contraseña')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña')
    }
    setEnviando(false)
  }

  async function restablecer() {
    setError(null)
    setEnviando(true)
    try {
      const { temporal: t } = await restablecerPasswordApi(usuario.id)
      setTemporal(t)
    } catch (e) {
      // Falta reautenticarse: no es un error, es un paso. Se pide la contraseña
      // aquí mismo en vez de pintar un rojo sin salida.
      if (esErrorDeDesbloqueo(e)) setReautenticando(true)
      else setError(e instanceof Error ? e.message : 'No se pudo restablecer')
    }
    setEnviando(false)
  }

  // Desbloquea con la contraseña de QUIEN ESTÁ OPERANDO y reintenta. El reintento
  // va aquí y no en un efecto: si volviera a pedir desbloqueo —desbloqueo
  // expirado entre las dos llamadas, por ejemplo— se muestra el motivo en vez de
  // reintentar en bucle.
  async function reautenticarYRestablecer() {
    if (!passActor) { setError('Escribe tu contraseña para confirmar.'); return }
    setError(null)
    setEnviando(true)
    try {
      await desbloquearApi(passActor)
      setPassActor('')
      const { temporal: t } = await restablecerPasswordApi(usuario.id)
      setReautenticando(false)
      setTemporal(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restablecer')
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && (temporal ? onDone() : onClose())}
      title={esYo ? 'Cambiar mi contraseña' : `Restablecer la contraseña de ${usuario.nombre}`}
      subtitle={esYo ? 'Confirma con tu contraseña actual' : usuario.email}
      footer={
        <div className="flex justify-end gap-2">
          {temporal ? (
            <Button size="sm" onClick={onDone}>Ya la copié</Button>
          ) : reautenticando ? (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={enviando || !passActor} onClick={reautenticarYRestablecer}>
                {enviando ? 'Confirmando…' : 'Confirmar y restablecer'}
              </Button>
            </>
          ) : esYo ? (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={enviando || !nueva || !confirmar} onClick={guardarPropia}>
                {enviando ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={enviando} onClick={restablecer}>
                {enviando ? 'Restableciendo…' : 'Restablecer contraseña'}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {temporal ? (
          <>
            <p className="text-[13px] text-ink">
              Contraseña temporal de <b>{usuario.nombre}</b>. Entrégasela por un medio seguro:
            </p>
            <div className="demo-num select-all rounded-md border border-border-strong bg-surface-2 px-3 py-2.5 text-center text-[15px] tracking-wider text-ink">
              {temporal}
            </div>
            <p className="rounded-md border border-[#f59e0b40] bg-[#f59e0b0d] p-2.5 text-[12px] text-[#9a6700]">
              No se puede volver a ver: en la base solo queda su huella. Se cerraron las sesiones
              abiertas de {usuario.nombre} y el sistema le pedirá cambiarla en cuanto entre.
            </p>
          </>
        ) : reautenticando ? (
          <>
            <p className="text-[13px] text-ink">
              Confirma con <b>tu</b> contraseña. Vas a cambiar el acceso de {usuario.nombre}, y la
              bitácora tiene que poder probar que fuiste tú.
            </p>
            <Campo label="Tu contraseña">
              <input type="password" className={inputCls} value={passActor}
                onChange={(e) => setPassActor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && passActor && !enviando) void reautenticarYRestablecer() }}
                autoComplete="current-password" autoFocus />
            </Campo>
          </>
        ) : esYo ? (
          <>
            <Campo label="Contraseña actual">
              <input type="password" className={inputCls} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" autoFocus />
            </Campo>
            <Campo label="Nueva contraseña">
              <input type="password" className={inputCls} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="mínimo 8, con letra y número" autoComplete="new-password" />
            </Campo>
            <Campo label="Confirmar contraseña">
              <input type="password" className={inputCls} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
            </Campo>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            Se generará una contraseña <b>temporal</b> para {usuario.nombre}, se cerrarán sus
            sesiones abiertas y tendrá que cambiarla al entrar. Tú no eliges la contraseña ni
            conservas una que siga sirviendo.
          </p>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    </Modal>
  )
}

function InvitarModal({ open, onOpenChange, onInvitado }: { open: boolean; onOpenChange: (v: boolean) => void; onInvitado: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [rol, setRol] = useState<RolDemo>('COMERCIAL')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const valido = nombre.trim() && email.trim() && password.trim().length >= 6

  async function enviar() {
    if (!esEmailValido(email)) { setError(EMAIL_INVALIDO); return }
    setEnviando(true)
    setError(null)
    try {
      await invitarUsuarioApi({ nombre: nombre.trim(), email: email.trim(), cargo: cargo.trim() || 'Miembro del equipo', rol, password: password.trim() })
      onInvitado(nombre.trim())
      onOpenChange(false)
      setNombre(''); setEmail(''); setCargo(''); setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo invitar')
    }
    setEnviando(false)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Crear usuario" subtitle="Define su acceso y contraseña"
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button><Button size="sm" disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Creando…' : 'Crear usuario'}</Button></div>}>
      <div className="space-y-3">
        <Campo label="Nombre"><input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Campo>
        <Campo label="Correo"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" /></Campo>
        <Campo label="Cargo"><input className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)} /></Campo>
        <Campo label="Rol"><select className={inputCls} value={rol} onChange={(e) => setRol(e.target.value as RolDemo)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Campo>
        <Campo label="Contraseña"><input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" /></Campo>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    </Modal>
  )
}

// Áreas del producto que gobierna un módulo (ADR 0010). Se omite el área que se
// llama igual que el módulo: repetir «Comercial» bajo «Comercial» es ruido.
//
// Las que no tienen API propia se marcan: ocultarles el menú NO protege el dato
// —lo protege el permiso con el que /api/estado filtra—, y confundir las dos
// cosas es creerse un control que no existe.
function AreasDelModulo({ modulo }: { modulo: string }) {
  const areas = areasDeModulo(modulo).filter((a) => a.clave !== modulo)
  if (areas.length === 0) return null
  return (
    <div className="mt-0.5 text-[11px] leading-relaxed text-muted">
      {areas.map((a, i) => (
        <span key={a.clave}>
          {i > 0 && ' · '}
          {a.label}
          {!a.apiPropia && <span title="Sin API propia: el permiso lo aplica /api/estado">*</span>}
        </span>
      ))}
    </div>
  )
}

// ─── Tab Roles (matriz 100% desde BD, Bloque F) ─────────────────────────────
// Módulos (filas), roles (columnas) y celdas vienen de GET
// /api/admin/permisos-matriz, que las deriva de rol_permisos. No hay ninguna
// copia estática del RBAC: un cambio en BD se ve al refrescar, sin desplegar.
function MatrizRoles() {
  const [data, setData] = useState<PermisosMatriz | null | undefined>(undefined)
  useEffect(() => { getPermisosMatrizApi().then(setData) }, [])

  const tiene = (modulo: string, rol: string, cap: Capacidad) =>
    !!data?.filas.some((r) => r.modulo === modulo && r.rol === rol && r.accion === cap)

  return (
    <Card>
      <CardHeader><CardTitle>Permisos por rol y módulo</CardTitle></CardHeader>
      <CardContent className="px-0 pb-0">
        {data === undefined ? (
          <div className="h-32 animate-pulse rounded bg-surface-2 mx-4 mb-4" />
        ) : !data ? (
          <div className="px-4 py-6 text-[13px] text-muted">No se pudo cargar la matriz de permisos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Módulo · qué abre</th>
                  {data.roles.map((r) => <th key={r.rol} className="px-3 py-2 text-center font-medium">{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.modulos.map((mod) => (
                  <tr key={mod.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 align-top">
                      <div className="font-medium text-ink">{mod.label}</div>
                      {/* ADR 0010: qué áreas del producto abre esta casilla. La
                          matriz mostraba 8 módulos y parecía completa, pero
                          marcar `comercial` concede además Clientes, Propuestas
                          y Campañas — y nada lo decía. */}
                      <AreasDelModulo modulo={mod.key} />
                    </td>
                    {data.roles.map((r) => {
                      const caps = CAPACIDADES.filter((c) => tiene(mod.key, r.rol, c))
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
          {CAPACIDADES.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5"><CapChip cap={c} /> {CAP_LABEL[c]}</span>
          ))}
          <span>* el área no tiene API propia: su permiso lo aplica /api/estado</span>
        </div>
      </CardContent>
    </Card>
  )
}

function CapChip({ cap }: { cap: Capacidad }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-surface-2 text-[10px] font-semibold text-ink">{CAP_CORTA[cap]}</span>
}

// ─── Tab Configuración (BD) ─────────────────────────────────────────────────

// Tipos y peso admitidos para el logo. Espejo de `LIMITES.logoEmpresa`
// (apps/web/lib/server/uploads.ts): validar aquí no sustituye al servidor —que
// es el que manda—, pero evita el viaje y da el motivo antes de subir. Antes el
// input aceptaba `image/*` y el servidor devolvía 422 para todo lo que no fuera
// PNG/SVG/WebP: el usuario elegía su logo y no pasaba nada.
const LOGO_TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const LOGO_EXT = /\.(png|jpe?g|webp|svg)$/i
const LOGO_MAX_MB = 2

function leerDataUrl(f: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('lectura fallida'))
    reader.readAsDataURL(f)
  })
}

// El logo va a pintarse en el menú lateral: si el navegador no puede decodificar
// el archivo, el sidebar tampoco podrá y quedaría un hueco. Se comprueba antes
// de guardar, no después.
function puedePintarse(dataUrl: string) {
  return new Promise<boolean>((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = dataUrl
  })
}

function Configuracion({ onToast }: { onToast: (m: string) => void }) {
  const [config, setConfig] = useState<ConfigNegocio | null>(null)
  // Para contrastar el loop global contra los slots reales de cada pantalla (M12).
  const sitios = useSitios()
  const [nuevoPlazo, setNuevoPlazo] = useState('')
  const [nuevoIva, setNuevoIva] = useState('')
  const sincronizarConfig = useActualizarConfig()
  useEffect(() => { getConfigApi().then(setConfig) }, [])

  // Devuelve si se guardó. El error del servidor (422 de subida, permisos…) se
  // muestra tal cual: antes se perdía en una promesa sin capturar y el usuario
  // no sabía por qué no cambiaba nada.
  async function guardar(cambios: Partial<ConfigNegocio>, msg?: string): Promise<boolean> {
    try {
      const c = await actualizarConfigApi(cambios)
      setConfig(c)
      // El sidebar lee el logo del store (hidratado por /api/estado), no de este
      // formulario: sin esta sincronización el menú seguía con la imagen vieja
      // hasta recargar la página.
      if ('logoUrl' in cambios) sincronizarConfig({ logoUrl: c.logoUrl })
      if (msg) onToast(msg)
      return true
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo guardar')
      return false
    }
  }

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // Algunos sistemas no reportan MIME (típico en .svg): se cae a la extensión.
    const tipoOk = f.type ? LOGO_TIPOS.includes(f.type) : LOGO_EXT.test(f.name)
    if (!tipoOk) { onToast('El logo debe ser PNG, JPG, WebP o SVG'); return }
    if (f.size > LOGO_MAX_MB * 1024 * 1024) { onToast(`El logo supera ${LOGO_MAX_MB} MB`); return }

    const dataUrl = await leerDataUrl(f).catch(() => null)
    if (!dataUrl) { onToast('No se pudo leer el archivo'); return }
    if (!(await puedePintarse(dataUrl))) {
      onToast('El archivo no es una imagen válida')
      return
    }
    await guardar({ logoUrl: dataUrl }, 'Logo actualizado: ya se ve en el menú')
  }

  if (!config) return <div className="h-64 animate-pulse rounded-md bg-surface-2" />

  const spotsPorLoop = config.spotSeg > 0 ? Math.floor(config.loopSeg / config.spotSeg) : 0
  // M12: el loop global NO gobierna las reservas — lo hace `totalSpots` de cada
  // pantalla. La auditoría vio «6 slots» aquí junto a pantallas de 10 y 12, sin
  // nada que explicara la contradicción. En vez de forzar que coincidan (cada
  // pantalla puede tener su propio hardware y su propio loop), se cuenta cuántas
  // difieren y se dice.
  const digitales = (sitios ?? []).filter(
    (x) => x.tipoMedio === 'PANTALLA_DIGITAL' || x.esRotativo || x.exhibicion === 'digital' || x.exhibicion === 'rotativo',
  )
  const conSlotsPropios = digitales.filter((x) => (x.totalSpots ?? 0) > 0 && x.totalSpots !== spotsPorLoop)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2"><Building2 className="h-4 w-4 text-muted" /><CardTitle>Identidad de la empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <Campo label="Logo">
            {/* 80px de vista previa: el logo ahora sale en el menú, en el
                portal del cliente y en los correos, así que quien lo sube tiene
                que poder ver qué está subiendo. A 56 no se distinguía si el
                recorte estaba bien. */}
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
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
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    className="hidden"
                    onChange={subirLogo}
                  />
                </label>
                {config.logoUrl && (
                  <Button size="sm" variant="secondary" onClick={() => guardar({ logoUrl: null }, 'Logo quitado')}>Quitar</Button>
                )}
              </div>
            </div>
            <span className="mt-1 block text-[11px] text-muted">
              Se usa en el menú lateral, en el contrato impreso, en la propuesta que ve
              el cliente y en los correos de aviso. PNG, JPG, WebP o SVG, máx. {LOGO_MAX_MB} MB.
            </span>
          </Campo>

          {/* ADR 0011: este campo escribe `tenants.nombre`, que es la ÚNICA
              fuente del nombre de la organización. Antes escribía una fila
              GLOBAL de config_negocio: renombrar tu empresa renombraba la que
              leían todas las demás, y encima el sidebar (que sí leía el del
              tenant) y esta pantalla mostraban cosas distintas. */}
          <Campo label="Nombre de la empresa">
            <input className={inputCls} value={config.nombreTenant}
              onChange={(e) => setConfig({ ...config, nombreTenant: e.target.value })}
              onBlur={(e) => guardar({ nombreTenant: e.target.value }, 'Nombre actualizado')} />
            <span className="mt-1 block text-[11px] text-muted">
              Es el que aparece en el menú lateral.
            </span>
          </Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Razón social">
              <input className={inputCls} value={config.razonSocial ?? ''} placeholder="p. ej. RGB Catorce S de RL de CV"
                onChange={(e) => setConfig({ ...config, razonSocial: e.target.value })}
                onBlur={(e) => guardar({ razonSocial: e.target.value.trim() || null }, 'Razón social actualizada')} />
            </Campo>
            <Campo label="Nombre comercial">
              <input className={inputCls} value={config.nombreComercial ?? ''} placeholder="p. ej. PIXELED"
                onChange={(e) => setConfig({ ...config, nombreComercial: e.target.value })}
                onBlur={(e) => guardar({ nombreComercial: e.target.value.trim() || null }, 'Nombre comercial actualizado')} />
            </Campo>
          </div>
          <span className="-mt-2 block text-[11px] text-muted">Se muestran en el encabezado del Dashboard.</span>
          <Campo label="Moneda">
            <div className="flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">$ · Peso mexicano (MXN)</div>
          </Campo>
        </CardContent>
      </Card>

      <CorreoDeAvisos config={config} guardar={guardar} />

      <DatosFiscales config={config} setConfig={setConfig} guardar={guardar} />

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
            Es la estructura de <b>referencia</b> (loop ÷ slot). Lo que se aparta en una campaña son los
            slots que tiene cada pantalla, no éstos: una pantalla con su propio número manda sobre este
            valor.
          </p>
          {conSlotsPropios.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted">
              <b className="text-ink">{conSlotsPropios.length}</b> de {digitales.length} pantallas digitales
              tienen un número propio distinto de {spotsPorLoop}
              {' '}({Array.from(new Set(conSlotsPropios.map((x) => x.totalSpots))).sort((a, b) => (a ?? 0) - (b ?? 0)).join(', ')} slots).
              Se edita en cada pantalla, desde Inventario.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ADR 0008 · cupo de clientes por pantalla (default de la instalación).
          Vacío = sin límite, que es como nace: la regla se enciende capturando
          un número, nunca por desplegar. Cada pantalla puede sobrescribirlo
          desde su ficha en Comercial. */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2"><Users className="h-4 w-4 text-muted" /><CardTitle>Cupo de clientes por pantalla</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo label="Máximo de clientes (default)">
              <input
                type="number"
                min={1}
                placeholder="Sin límite"
                className={`demo-num ${inputCls}`}
                defaultValue={config.maxClientesPantalla ?? ''}
                onBlur={(e) => {
                  const txt = e.target.value.trim()
                  const v = txt === '' ? null : Math.max(1, Math.round(Number(txt) || 1))
                  if (v !== (config.maxClientesPantalla ?? null)) {
                    guardar(
                      { maxClientesPantalla: v },
                      v == null ? 'Cupo de clientes desactivado' : `Cupo de clientes: ${v}`,
                    )
                  }
                }}
              />
            </Campo>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Cuántos anunciantes distintos pueden compartir una pantalla a la vez, además del límite de
            slots. Déjalo vacío para no aplicar ningún cupo. Un cliente que ya está en la pantalla puede
            seguir metiendo campañas mientras le queden slots; el cupo solo frena al cliente nuevo. Cada
            pantalla puede llevar su propio valor desde su ficha en Comercial.
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

      {/* M15: esta tarjeta era un editor de texto libre que NO LEÍA NADIE — las
          OT sacan su tipo de un enum con reglas por tipo de pantalla. Aparecía
          vacía mientras Operaciones tenía una OT de «Montaje de lona», y la
          auditoría pidió sembrarla. Sembrarla habría sido peor: seguiría sin
          gobernar nada y encima parecería que sí. Ahora enseña lo que de verdad
          rige, en solo lectura. */}
      <Card>
        <CardHeader><CardTitle>Tipos de tarea de cuadrilla</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-[13px] text-muted">
            Los fija el sistema, no se editan: cuáles aplican depende del tipo de pantalla y esa
            regla la comprueba el servidor al crear la orden.
          </p>
          <ul className="space-y-1.5">
            {tiposOtPara(null).map((t) => {
              const soloFija = TIPO_OT_SOLO_FIJA.includes(t)
              return (
                <li key={t} className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-[13px] text-ink">
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" /> {TIPO_OT_LABEL[t]}
                  </span>
                  <span className="text-[11px] text-muted">
                    {soloFija ? 'solo pantalla fija' : 'fija y digital'}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Datos fiscales (parte ARRENDATARIA del contrato) ───────────────────────
// Estas columnas ya existían en `tenants` (migración 20260729_datos_contrato_
// documento.sql) pero NINGUNA pantalla las escribía: se quedaban en NULL y todo
// contrato generado salía con las declaraciones de la empresa en blanco y con el
// aviso de «faltan datos por capturar», que además bloquea el envío a firma
// (lib/server/firmas-repo.ts). Aquí es donde se capturan, una sola vez.
//
// El único que NO entra en `faltantes` es «datos de constitución»: no toda parte
// arrendataria es persona moral, y exigir escritura a una física dejaría el
// contrato bloqueado sin remedio. El documento igual lo recita si está.
const CAMPOS_CONTRATO = [
  ['razonSocial', 'Razón social'],
  ['rfc', 'RFC'],
  ['domicilioFiscal', 'Domicilio fiscal'],
  ['representanteLegal', 'Representante legal'],
] as const

function DatosFiscales({
  config, setConfig, guardar,
}: {
  config: ConfigNegocio
  setConfig: (c: ConfigNegocio) => void
  guardar: (cambios: Partial<ConfigNegocio>, msg?: string) => Promise<boolean>
}) {
  // Espejo del bloque `exigir(arrendatario…)` de lib/contrato-documento.ts: se
  // avisa aquí, donde se arregla, y no solo al abrir el documento ya generado.
  const faltan = CAMPOS_CONTRATO.filter(([k]) => !String(config[k] ?? '').trim()).map(([, l]) => l)

  // El campo se pinta desde `config` y se guarda al salir. `null` y no '' para
  // que el servidor distinga «sin capturar» de «capturado en blanco».
  const campo = (k: 'rfc' | 'domicilioFiscal' | 'representanteLegal' | 'datosConstitucion',
                 label: string, placeholder: string, msg: string, area = false) => {
    const props = {
      value: config[k] ?? '',
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setConfig({ ...config, [k]: e.target.value }),
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        guardar({ [k]: e.target.value.trim() || null }, msg),
    }
    return (
      <Campo label={label}>
        {area
          ? <textarea {...props} rows={2} className={`${inputCls} h-auto py-2 leading-snug`} />
          : <input {...props} className={inputCls} />}
      </Campo>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Scale className="h-4 w-4 text-muted" />
        <CardTitle>Datos fiscales para contratos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[12px] text-muted">
          Con estos datos comparece tu empresa como <b>parte arrendataria</b> en los contratos
          de arrendamiento que genera el sistema. Se capturan una vez y valen para todos.
        </p>

        {faltan.length > 0 && (
          <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-ink">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              Falta{faltan.length === 1 ? '' : 'n'} <b>{faltan.join(', ')}</b>. Sin esto el contrato
              sale con huecos y no se puede enviar a firma.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campo('rfc', 'RFC', 'p. ej. RGB140101AB1', 'RFC actualizado')}
          {campo('representanteLegal', 'Representante legal', 'Nombre de quien firma', 'Representante legal actualizado')}
        </div>
        {campo('domicilioFiscal', 'Domicilio fiscal', 'Calle, número, colonia, CP, ciudad, estado', 'Domicilio fiscal actualizado', true)}
        {campo('datosConstitucion', 'Datos de constitución (opcional)',
          'p. ej. escritura pública 12,345 del 3 de marzo de 2014, ante el notario 45 de Guadalajara, Jalisco',
          'Datos de constitución actualizados', true)}
        <span className="-mt-1 block text-[11px] text-muted">
          La razón social se captura arriba, en «Identidad de la empresa».
        </span>
      </CardContent>
    </Card>
  )
}

// ─── Correo de avisos de la organización ────────────────────────────────────
// La dirección a la que responden los avisos de OPERACIÓN (contratos y lo que
// venga). NO es el correo del sistema: las contraseñas y las invitaciones salen
// del buzón de la plataforma y no se configuran aquí.
//
// El aviso va en un modal ANTES de guardar, y no en una nota al pie, porque lo
// que hay que entender es contraintuitivo: uno escribe su correo esperando que
// los avisos salgan DESDE él, y lo que pasa es que salen desde el buzón de la
// plataforma a nombre de la organización y las respuestas caen aquí. Quien no
// lo sepa va a buscar los envíos en la bandeja de enviados de esta cuenta y no
// los va a encontrar. Una nota al pie de un formulario no se lee; un modal que
// hay que confirmar, sí.
function CorreoDeAvisos({
  config,
  guardar,
}: {
  config: ConfigNegocio
  guardar: (cambios: Partial<ConfigNegocio>, msg?: string) => Promise<boolean>
}) {
  const actual = config.emailRemitente ?? ''
  const [borrador, setBorrador] = useState(actual)
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El padre recarga `config` tras guardar; sin esto el input se quedaría con
  // lo que se tecleó aunque el servidor hubiera normalizado el valor.
  useEffect(() => { setBorrador(config.emailRemitente ?? '') }, [config.emailRemitente])

  const limpio = borrador.trim()
  const hayCambio = limpio !== actual

  async function aplicar(valor: string | null) {
    setGuardando(true)
    const ok = await guardar(
      { emailRemitente: valor },
      valor ? 'Correo de avisos actualizado' : 'Correo de avisos quitado',
    )
    setGuardando(false)
    if (ok) setConfirmando(false)
  }

  function intentar() {
    setError(null)
    // Vaciarlo es QUITARLO, y quitar no necesita advertencia: no estrena
    // ningún comportamiento, lo apaga.
    if (!limpio) { void aplicar(null); return }
    // Se valida ANTES de abrir el modal. Al revés, el usuario leería el aviso
    // completo, confirmaría, y recibiría un error de formato al final — se le
    // habría hecho leer todo para nada.
    if (!esEmailValido(limpio)) { setError(EMAIL_INVALIDO); return }
    setConfirmando(true)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Mail className="h-4 w-4 text-muted" />
        <CardTitle>Correo de avisos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Campo label="Correo de la organización">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="p. ej. avisos@tuempresa.com"
              value={borrador}
              onChange={(e) => { setBorrador(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); intentar() } }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              disabled={!hayCambio || guardando}
              onClick={intentar}
            >
              {limpio ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {actual && !limpio ? 'Quitar' : actual ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
          {error && <span className="mt-1 block text-[11px] text-error">{error}</span>}
          <span className="mt-1 block text-[11px] text-muted">
            A esta dirección responden los avisos de operación que el sistema envía a tu
            equipo. Las contraseñas y las invitaciones no salen de aquí: esas las manda
            la plataforma.
          </span>
        </Campo>

        {!actual && (
          <p className="flex items-start gap-1.5 rounded border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sin correo configurado, los avisos salen sin dirección de respuesta: quien los
            reciba no tendrá a quién contestarle.
          </p>
        )}
      </CardContent>

      <Modal
        open={confirmando}
        onOpenChange={(v) => { if (!guardando) setConfirmando(v) }}
        title="Antes de guardar este correo"
        subtitle="Cómo se va a usar la dirección que acabas de escribir"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={guardando} onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button disabled={guardando} onClick={() => void aplicar(limpio)}>
              {guardando ? 'Guardando…' : 'Entendido, guardar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-ink">
          <p className="rounded border border-border bg-surface-2 px-3 py-2">
            <span className="demo-num font-medium">{limpio}</span>
          </p>

          <p className="flex items-start gap-2">
            <CornerUpLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              Los avisos <b>no se envían desde</b> esta dirección: salen del servidor de
              correo de la plataforma, a nombre de <b>{config.nombreTenant || 'tu organización'}</b>,
              y <b>las respuestas llegan aquí</b>. En la bandeja de enviados de esta cuenta
              no vas a ver nada.
            </span>
          </p>

          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              Es así porque para enviar desde tu propio dominio hace falta autorizarlo en
              los registros DNS de ese dominio. Sin esa autorización, un correo que dijera
              venir de tu dominio lo marcarían como suplantación y acabaría en spam.{' '}
              <b>Si quieres que salgan desde tu dominio, avísanos y lo configuramos.</b>
            </span>
          </p>

          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              Afecta a los avisos de operación —hoy, el resumen diario de contratos que
              necesitan atención—. Las contraseñas y las invitaciones seguirán saliendo del
              correo de la plataforma.
            </span>
          </p>

          <p className="text-[12px] text-muted">
            Revisa que esté bien escrita: si la dirección no existe, las respuestas de tus
            clientes se pierden sin que nadie se entere.
          </p>
        </div>
      </Modal>
    </Card>
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
