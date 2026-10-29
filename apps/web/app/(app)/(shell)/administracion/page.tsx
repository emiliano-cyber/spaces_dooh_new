'use client'

import { useEffect, useState, useCallback } from 'react'
import { conteo } from '@/lib/plural'
import { CheckCircle2, Users, ShieldCheck, UserPlus, Building2, X, Plus, Check, Upload, Percent, MonitorPlay, KeyRound, Scale, AlertTriangle, Mail, FileText, CornerUpLeft, Loader2, Wrench, Save, ToggleLeft, ToggleRight, CalendarClock, ListChecks } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { CRUDO_INVALIDO } from '@/lib/captura-cifra'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
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
import { TIPO_OT_LABEL, TIPO_OT_SOLO_FIJA, TIPO_OT_OBSOLETO, TODOS_TIPOS_OT, tiposOtPara } from '@/lib/tipos-ot'
import { payloadCostosOt } from '@/lib/costos-ot-payload'
import { useCandado, DialogoCandado } from '@/components/demo/ui/candado'
import { OrganizacionesPanel } from '@/components/demo/admin/OrganizacionesPanel'
import { ControlCambiosPanel } from '@/components/demo/admin/ControlCambiosPanel'
import { ActualizacionesPanel } from '@/components/demo/admin/ActualizacionesPanel'
import { TicketsPanel } from '@/components/demo/admin/TicketsPanel'
import { Chip, TONO, FRANJA_AVISO } from '@/components/demo/admin/Chip'
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
import Link from 'next/link'
import { useActualizarConfig, useSitios, useEntidadesFiscales } from '@/lib/data/client'
import type { RolDemo, UsuarioDemo, ConfigNegocio } from '@/lib/data/client'
import type { TipoOT } from '@/lib/data/types'
import { validarPassword, REGLA_PASSWORD } from '@/lib/password'
import { ROL_POR_OMISION } from '@/lib/roles'

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
        <TabPanel value="roles" className="pt-4"><div className="space-y-4"><ControlCambiosPanel onToast={notify} /><MatrizRoles /></div></TabPanel>
        <TabPanel value="config" className="pt-4"><Configuracion onToast={notify} /></TabPanel>
      </Tabs>

      {/* Organizaciones (CRMs) — solo super-admin de plataforma. Va AL FINAL y
          no encabezando la página: a la Dueña le sale en su rama «sin
          permiso», y lo primero que veía quien administra su negocio era lo
          que NO puede hacer. Para el super-admin funciona igual, más abajo. */}
      <OrganizacionesPanel />
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

  // Solo conteo de lo que ya está cargado: no es otra consulta.
  const activos = usuarios?.filter((u) => u.activo).length ?? 0
  const inactivos = (usuarios?.length ?? 0) - activos

  // Los tres controles de una fila se pintan DOS veces —tabla desde `sm` y
  // lista apilada en móvil, donde la tabla desbordaba y cortaba la columna de
  // contraseña—, así que se escriben una sola vez aquí. Mismos manejadores y
  // mismo `esYo` en las dos: lo único que cambia entre una y otra es dónde va
  // cada control, nunca qué hace.
  const controlRol = (u: UsuarioDemo, esYo: boolean) =>
    esYo ? (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink"><ShieldCheck className="h-3.5 w-3.5 text-muted" /> {rolLabel(u.rol)}</span>
    ) : (
      <select value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value as RolDemo, u.nombre)}
        aria-label={`Rol de ${u.nombre}`}
        className="h-8 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    )
  // El estatus ES un botón que activa o desactiva con un clic (y sin
  // confirmación: así lo decidió el dueño, no se cambia aquí). Antes se veía
  // idéntico al chip de solo lectura de tu propia fila, así que nada avisaba
  // de que pulsarlo dejaba a alguien fuera. Ahora lleva el icono del
  // interruptor y el `title` dice lo que va a pasar; tu fila, que no se puede
  // cambiar, queda como chip plano sin icono.
  const controlEstatus = (u: UsuarioDemo, esYo: boolean) => {
    const tono = u.activo ? TONO.exito : TONO.neutro
    const etiqueta = u.activo ? 'Activo' : 'Inactivo'
    if (esYo) return <Chip tono={u.activo ? 'exito' : 'neutro'} punto title="No puedes cambiar tu propio estatus">{etiqueta}</Chip>
    const Interruptor = u.activo ? ToggleRight : ToggleLeft
    return (
      <button type="button" onClick={() => toggle(u.id, u.activo, u.nombre)}
        title={u.activo ? `Pulsa para desactivar a ${u.nombre}` : `Pulsa para activar a ${u.nombre}`}
        className={cn('m-0 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium',
          'transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          tono)}>
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', u.activo ? 'bg-success' : 'bg-muted')} />
        {etiqueta}
        <Interruptor aria-hidden="true" className={cn('h-3.5 w-3.5', u.activo ? 'text-[#0f7a55]' : 'text-muted')} />
      </button>
    )
  }
  const controlPassword = (u: UsuarioDemo, esYo: boolean) => (
    <button type="button" onClick={() => setPasswordDe(u)}
      className="m-0 inline-flex cursor-pointer items-center gap-1.5 rounded border border-border-strong bg-surface px-2 py-1 text-[12px] text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <KeyRound className="h-3.5 w-3.5 text-muted" /> {esYo ? 'Cambiar la mía' : 'Cambiar'}
    </button>
  )
  const chipTu = <Chip tono="acento" className="px-1.5 text-[10px]">tú</Chip>

  return (
    <>
    <CardColapsable
      id="admin.usuarios"
      titulo="Equipo"
      icono={<Users className="h-4 w-4 text-muted" />}
      contentClassName="px-0 pb-0"
      resumen={usuarios && usuarios.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <Chip><span className="demo-num">{conteo(usuarios.length, 'usuario')}</span></Chip>
          <Chip tono="exito" punto><span className="demo-num">{conteo(activos, 'activo')}</span></Chip>
          {inactivos > 0 && <Chip punto><span className="demo-num">{conteo(inactivos, 'inactivo')}</span></Chip>}
        </div>
      ) : undefined}
      accion={<Button variant="success" size="sm" onClick={() => setInvOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Invitar usuario</Button>}
    >
        {!usuarios ? (
          <div className="space-y-2 px-4 pb-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />)}</div>
        ) : usuarios.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">Sin usuarios.</p>
        ) : (
          <>
          {/* Desde `sm`: la tabla de siempre. */}
          <div className="hidden overflow-x-auto sm:block">
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
                          {esYo && chipTu}
                        </div>
                        <div className="demo-num text-[11px] text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-2.5">{controlRol(u, esYo)}</td>
                      <td className="px-4 py-2.5">{controlEstatus(u, esYo)}</td>
                      <td className="px-4 py-2.5">{controlPassword(u, esYo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* En móvil: una fila apilada por persona, al estilo de las listas
              del Dashboard (dato a la izquierda, estatus a la derecha). */}
          <ul className="m-0 list-none divide-y divide-border border-t border-border p-0 sm:hidden">
            {usuarios.map((u) => {
              const esYo = u.id === yo
              return (
                <li key={u.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] text-ink">{u.nombre}</span>
                        {esYo && chipTu}
                      </div>
                      <div className="demo-num truncate text-[11px] text-muted">{u.email}</div>
                    </div>
                    <div className="shrink-0">{controlEstatus(u, esYo)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {controlRol(u, esYo)}
                    {controlPassword(u, esYo)}
                  </div>
                </li>
              )
            })}
          </ul>
          </>
        )}
    </CardColapsable>

      {/* Los modales van FUERA de la tarjeta: CardColapsable desmonta su
          contenido al plegar, e «Invitar usuario» está en el encabezado, así
          que con la tarjeta plegada el modal no se abriría. */}
      <InvitarModal open={invOpen} onOpenChange={setInvOpen} onInvitado={(n, enviada) => { onToast(enviada ? `Invitación enviada a ${n}` : `Usuario ${n} creado`); cargar() }} />

      {passwordDe && (
        <CambiarPasswordModal
          usuario={passwordDe}
          esYo={passwordDe.id === yo}
          onClose={() => setPasswordDe(null)}
          onDone={() => { onToast(passwordDe.id === yo ? 'Tu contraseña se actualizó' : `Contraseña de ${passwordDe.nombre} actualizada`); setPasswordDe(null) }}
        />
      )}
    </>
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
  // OBLIG-01 · qué falta depende del paso en el que esté el cuadro: cambiar la
  // propia pide las tres (el servidor exige `passwordActual`,
  // `perfil-controller.ts:86`); restablecer la de otro solo pide la TUYA cuando
  // el servidor reclama la reautenticación.
  const pasoPropia = esYo && !reautenticando && !temporal
  const ob = useObligatorios({ actual, nueva, confirmar, passActor }, [
    { campo: 'actual', si: pasoPropia },
    { campo: 'nueva', si: pasoPropia },
    { campo: 'confirmar', si: pasoPropia },
    { campo: 'passActor', si: reautenticando },
  ])

  async function guardarPropia() {
    setError(null)
    if (!ob.validar()) return
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
    if (!ob.validar()) return
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
              <Button size="sm" disabled={enviando} onClick={reautenticarYRestablecer}>
                {enviando ? 'Confirmando…' : 'Confirmar y restablecer'}
              </Button>
            </>
          ) : esYo ? (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" disabled={enviando} onClick={guardarPropia}>
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
            <p className={FRANJA_AVISO}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
              <span>
                No se puede volver a ver: en la base solo queda su huella. Se cerraron las sesiones
                abiertas de {usuario.nombre} y el sistema le pedirá cambiarla en cuanto entre.
              </span>
            </p>
          </>
        ) : reautenticando ? (
          <>
            <p className="text-[13px] text-ink">
              Confirma con <b>tu</b> contraseña. Vas a cambiar el acceso de {usuario.nombre}, y la
              bitácora tiene que poder probar que fuiste tú.
            </p>
            <Campo label="Tu contraseña" obligatorio falta={ob.falta('passActor')}>
              <input type="password" className={inputCls} value={passActor}
                onChange={(e) => setPassActor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !enviando) void reautenticarYRestablecer() }}
                autoComplete="current-password" autoFocus />
            </Campo>
          </>
        ) : esYo ? (
          <>
            <Campo label="Contraseña actual" obligatorio falta={ob.falta('actual')}>
              <input type="password" className={inputCls} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" autoFocus />
            </Campo>
            <Campo label="Nueva contraseña" obligatorio falta={ob.falta('nueva')}>
              <input type="password" className={inputCls} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder={REGLA_PASSWORD} autoComplete="new-password" />
            </Campo>
            <Campo label="Confirmar contraseña" obligatorio falta={ob.falta('confirmar')}>
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

// Tres formas de dar acceso, y se manda UNA (el servidor rechaza mezclas con un
// 400). La invitación va primero y por omisión (ADR 0044): es la única en la
// que nadie más que la persona conoce su contraseña. «Fijar contraseña» se
// conserva a propósito —decisión del dueño del 06/10— para quien la prefiera.
type AccesoAlta = 'invitar' | 'password' | 'google'

function InvitarModal({ open, onOpenChange, onInvitado }: { open: boolean; onOpenChange: (v: boolean) => void; onInvitado: (nombre: string, invitacionEnviada: boolean) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  // VENDEDOR y no 'COMERCIAL': desde el ADR 0040 la API rechaza COMERCIAL, y el
  // desplegable —que no lo ofrece— enseñaba la primera opción mientras el estado
  // seguía en COMERCIAL. Quien no tocaba el rol recibía un 400 al crear.
  const [rol, setRol] = useState<RolDemo>(ROL_POR_OMISION)
  const [password, setPassword] = useState('')
  const [acceso, setAcceso] = useState<AccesoAlta>('invitar')
  const [googleDisponible, setGoogleDisponible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // El enlace de invitación cuando el correo NO salió. Se enseña una sola vez,
  // como la contraseña temporal: al cerrar el modal no hay forma de recuperarlo
  // (se puede emitir otro con «Restablecer contraseña»).
  const [enlace, setEnlace] = useState<{ url: string; fallo: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)

  // La bandera de Google no viaja al cliente (no lleva prefijo NEXT_PUBLIC_,
  // para que apagarla no exija recompilar), así que se pregunta al servidor.
  // Empieza oculto: si la consulta falla, no se ofrece una opción que crearía
  // un usuario incapaz de entrar.
  useEffect(() => {
    if (!open) return
    let vivo = true
    fetch('/spaces-dooh/api/auth/metodos/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.google === true) setGoogleDisponible(true) })
      .catch(() => { /* sin opción, que es el estado seguro */ })
    return () => { vivo = false }
  }, [open])

  // Con invitación o Google no hace falta contraseña. Con «fijar», el mínimo es
  // el que exige el SERVIDOR (validarPassword: 8, con letra y número) — antes
  // pedía 6 aquí, así que una de 6 pasaba el formulario y el servidor la
  // rechazaba después con un mensaje que parecía salido de la nada.
  //
  // OBLIG-01 · lo que exige el servidor (`usuarios-controller.ts:52-53`): nombre
  // y correo; la contraseña solo con «fijar». Los vacíos ya NO deshabilitan el
  // botón —se pulsa y se pinta en rojo lo que falta—; una contraseña ESCRITA que
  // no cumple la regla sí, como antes.
  const ob = useObligatorios({ nombre, email, password }, [
    'nombre',
    'email',
    { campo: 'password', si: acceso === 'password' },
  ])
  const passwordInvalida = acceso === 'password' && !!password && !!validarPassword(password)

  function limpiar() {
    setNombre(''); setEmail(''); setCargo(''); setPassword(''); setRol(ROL_POR_OMISION)
    setAcceso('invitar'); setEnlace(null); setCopiado(false); setError(null)
    ob.reiniciar()
  }

  function cerrar() {
    onOpenChange(false)
    limpiar()
  }

  async function enviar() {
    if (!ob.validar()) return
    if (!esEmailValido(email)) { setError(EMAIL_INVALIDO); return }
    setEnviando(true)
    setError(null)
    try {
      const u = await invitarUsuarioApi({
        nombre: nombre.trim(),
        email: email.trim(),
        cargo: cargo.trim() || 'Miembro del equipo',
        rol,
        // Se manda UNA de las tres, nunca dos: el servidor contesta 400 a una
        // mezcla, y mandar una contraseña que no se va a usar dejaría un
        // secreto en el cuerpo de la petición.
        ...(acceso === 'invitar' ? { invitar: true }
          : acceso === 'google' ? { entraConGoogle: true }
          : { password: password.trim() }),
      })
      const inv = u.invitacion
      if (inv && !inv.enviada) {
        // La cuenta ya existe: se avisa al padre ahora (para recargar la lista)
        // y el modal se queda abierto enseñando el enlace.
        onInvitado(nombre.trim(), false)
        setEnlace({ url: inv.enlace, fallo: !!inv.fallo })
      } else {
        onInvitado(nombre.trim(), !!inv?.enviada)
        cerrar()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo invitar')
    }
    setEnviando(false)
  }

  function copiar() {
    if (!enlace) return
    navigator.clipboard?.writeText(enlace.url).then(
      () => setCopiado(true),
      () => setCopiado(false),
    )
  }

  const subtitulo = enlace ? 'Comparte el enlace con la persona'
    : acceso === 'invitar' ? 'Recibirá un enlace para elegir su contraseña'
    : acceso === 'google' ? 'Entrará con su cuenta de Google'
    : 'Define su acceso y contraseña'

  const footer = enlace
    ? <div className="flex justify-end gap-2"><Button variant="success" size="sm" onClick={cerrar}>Listo</Button></div>
    : <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={cerrar}>Cancelar</Button><Button variant="success" size="sm" disabled={passwordInvalida || enviando} onClick={enviar}>{enviando ? 'Creando…' : acceso === 'invitar' ? 'Crear e invitar' : 'Crear usuario'}</Button></div>

  return (
    <Modal open={open} onOpenChange={(v) => (v ? onOpenChange(true) : cerrar())} title="Crear usuario" subtitle={subtitulo} footer={footer}>
      {enlace ? (
        <div className="space-y-3">
          {enlace.fallo ? (
            <p className={FRANJA_AVISO}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
              La cuenta se creó, pero el correo no se pudo enviar. Pásale este enlace por otro medio.
            </p>
          ) : (
            <p className="text-[12px] text-muted">
              La cuenta de <b className="text-ink">{nombre}</b> está creada. Este servidor no tiene correo
              configurado, así que pásale este enlace por un medio seguro: con él elige su contraseña.
            </p>
          )}
          <div className="break-all rounded border border-border bg-bg p-2.5 font-mono text-[12px] text-ink">{enlace.url}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">Vence en 72 horas y sirve una sola vez. No se volverá a mostrar.</span>
            <Button variant="secondary" size="sm" onClick={copiar}>{copiado ? <><Check className="h-3.5 w-3.5" /> Copiado</> : 'Copiar enlace'}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Campo label="Nombre" obligatorio falta={ob.falta('nombre')}><input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Campo>
          <Campo label="Correo" obligatorio falta={ob.falta('email')}><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" /></Campo>
          <Campo label="Cargo"><input className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)} /></Campo>
          <Campo label="Rol"><select className={inputCls} value={rol} onChange={(e) => setRol(e.target.value as RolDemo)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Campo>
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-[12px] font-medium text-ink">Acceso</legend>
            <OpcionAcceso
              activa={acceso === 'invitar'} onElegir={() => { setAcceso('invitar'); setError(null) }}
              titulo="Enviar invitación"
              detalle="Recibe un enlace para elegir su propia contraseña. Nadie más la conoce."
            />
            <OpcionAcceso
              activa={acceso === 'password'} onElegir={() => { setAcceso('password'); setError(null) }}
              titulo="Fijar la contraseña yo"
              detalle="Tú la escribes y se la entregas por un medio seguro."
            />
            {googleDisponible && (
              <OpcionAcceso
                activa={acceso === 'google'} onElegir={() => { setAcceso('google'); setError(null) }}
                titulo="Entra con su cuenta de Google"
                detalle="Su correo de Google debe ser el mismo que escribiste arriba."
              />
            )}
          </fieldset>
          {/* La contraseña desaparece —no se deshabilita— si no se va a usar:
              un campo gris que sigue ahí invita a preguntarse si hay que
              rellenarlo igual. */}
          {acceso === 'password' && (
            <Campo label="Contraseña" obligatorio falta={ob.falta('password')}>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={REGLA_PASSWORD} />
            </Campo>
          )}
          {error && <p className="text-[12px] text-error">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

function OpcionAcceso({ activa, onElegir, titulo, detalle }: { activa: boolean; onElegir: () => void; titulo: string; detalle: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2 rounded border p-2.5', activa ? 'border-accent bg-bg' : 'border-border')}>
      <input type="radio" name="acceso-alta" className="mt-0.5" checked={activa} onChange={onElegir} />
      <span className="text-[12px] leading-snug">
        <span className="font-medium text-ink">{titulo}</span>
        <span className="block text-muted">{detalle}</span>
      </span>
    </label>
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
    <CardColapsable id="admin.permisos" titulo="Permisos por rol y módulo" contentClassName="px-0 pb-0">
        {/* La leyenda va ARRIBA (antes iba al pie, tras once filas): las
            celdas son letras sueltas —V, C, A…— y sin la clave delante la
            tabla no se puede leer. Mismo criterio que Stripe con sus roles. */}
        <div className="mx-4 mb-3 flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-[11px] text-muted">
          {CAPACIDADES.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5"><CapChip cap={c} /> {CAP_LABEL[c]}</span>
          ))}
          <span>* el área no tiene API propia: su permiso lo aplica /api/estado</span>
        </div>
        {data === undefined ? (
          <div className="h-32 animate-pulse rounded bg-surface-2 mx-4 mb-4" />
        ) : !data ? (
          <div className="px-4 py-6 text-[13px] text-muted">No se pudo cargar la matriz de permisos.</div>
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  {/* Primera columna fija: en móvil la tabla se desplaza a
                      lo ancho y, sin esto, el nombre del módulo se iba con el
                      scroll y quedaban columnas de letras sin saber de qué. */}
                  <th className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">Módulo · qué abre</th>
                  {data.roles.map((r) => <th key={r.rol} className="px-3 py-2 text-center font-medium">{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.modulos.map((mod) => (
                  <tr key={mod.key} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 align-top">
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
    </CardColapsable>
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

// Las cuatro familias de la pestaña Configuración, en el orden en que se
// pintan. El `id` es el ancla de cada `<section>` (solo desplaza la vista).
const FAMILIAS_CONFIG = [
  { id: 'admin-cfg-empresa', label: 'Empresa' },
  { id: 'admin-cfg-comercial', label: 'Comercial' },
  { id: 'admin-cfg-operacion', label: 'Operación' },
  { id: 'admin-cfg-instancia', label: 'Instancia' },
] as const

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

  // ─── TOPE-01 · el tope de descuento pide la contraseña ────────────────────
  //
  // Es el único campo de esta pantalla con candado, porque es el único que es
  // un CONTROL y no un ajuste: quien lo sube puede a continuación regalar la
  // venta. El servidor lo exige (`app/api/config/route.ts`), así que este
  // cuadro no protege nada — lo que hace es que el camino EXISTA. Sin él, el
  // 403 dejaría el campo mudo y la única salida sería el rodeo por «Cambios
  // bloqueados» (ver `components/demo/ui/candado.tsx`).
  const candadoTope = useCandado()
  const [topeInput, setTopeInput] = useState('')
  // Resincroniza con lo GUARDADO cada vez que el cuadro se cierra —lo confirmes
  // o lo canceles— y cada vez que el servidor devuelve una config nueva. Sin
  // esto, cancelar dejaría en pantalla un número que no está guardado, que es
  // la peor forma de enseñar un tope: la que se cree.
  useEffect(() => {
    if (!candadoTope.reautenticando) setTopeInput(String(config?.topeDescuentoPct ?? 100))
  }, [candadoTope.reautenticando, config?.topeDescuentoPct])

  function guardarTope() {
    const txt = topeInput.trim()
    const v = Number(txt)
    if (txt === '' || !Number.isFinite(v) || v < 0 || v > 100) {
      onToast('El tope de descuento tiene que ser un número entre 0 y 100')
      setTopeInput(String(config?.topeDescuentoPct ?? 100))
      return
    }
    if (v === config?.topeDescuentoPct) return
    void candadoTope.ejecutar({
      guardar: async () => { setConfig(await actualizarConfigApi({ topeDescuentoPct: v })) },
      alLograr: () => onToast(v >= 100 ? 'Sin tope de descuento' : `Tope de descuento: ${v} %`),
      alFallar: (m) => onToast(m),
      mensajeSiFalla: 'No se pudo guardar el tope de descuento',
    })
  }

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
      // El encabezado de Inicio lee la razón social del store, igual que el logo.
      if ('entidadPrincipalId' in cambios || 'rfc' in cambios) {
        sincronizarConfig({ razonSocial: c.razonSocial, entidadPrincipalId: c.entidadPrincipalId })
      }
      if (msg) onToast(msg)
      return true
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo guardar')
      return false
    }
  }

  // Subir el logo son TRES esperas, y solo la última es una petición:
  //   1. leer el archivo a base64 (un JPG de 2 MB no es instantáneo),
  //   2. comprobar que el navegador puede pintarlo,
  //   3. mandarlo (~2.7 MB de base64 viajando en un PATCH).
  //
  // La barra de carga global solo se entera de la 3, porque cuenta peticiones.
  // Durante 1 y 2 no pasaba NADA visible: la vista previa seguía enseñando el
  // logo viejo y el botón seguía como si no lo hubieras pulsado, así que la
  // impresión era que el archivo no se había aceptado — y la gente vuelve a
  // pulsar. De ahí este estado propio, que cubre las tres.
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // Guarda contra el doble envío: el control es un <label> con un input
    // oculto y un <label> no se puede deshabilitar, así que taparlo con CSS no
    // basta — el teclado sigue llegando.
    if (subiendoLogo) return
    // Algunos sistemas no reportan MIME (típico en .svg): se cae a la extensión.
    const tipoOk = f.type ? LOGO_TIPOS.includes(f.type) : LOGO_EXT.test(f.name)
    if (!tipoOk) { onToast('El logo debe ser PNG, JPG, WebP o SVG'); return }
    if (f.size > LOGO_MAX_MB * 1024 * 1024) { onToast(`El logo supera ${LOGO_MAX_MB} MB`); return }

    setSubiendoLogo(true)
    try {
      const dataUrl = await leerDataUrl(f).catch(() => null)
      if (!dataUrl) { onToast('No se pudo leer el archivo'); return }
      if (!(await puedePintarse(dataUrl))) {
        onToast('El archivo no es una imagen válida')
        return
      }
      await guardar({ logoUrl: dataUrl }, 'Logo actualizado: ya se ve en el menú')
    } finally {
      // En `finally` y no al final del `try`: los tres `return` de arriba son
      // salidas legítimas (archivo ilegible, no es imagen) y sin esto dejarían
      // el control girando para siempre.
      setSubiendoLogo(false)
    }
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
    <div className="space-y-6">
      {/* Trece tarjetas en una columna eran ~2400 px de scroll y en un orden
          que no seguía a nadie: lo de la INSTANCIA (actualizaciones, soporte)
          iba antes que la identidad del negocio, y lo comercial mezclado con
          lo operativo. Se agrupan en cuatro familias con un índice de anclas
          arriba —solo desplazan la vista, no son rutas—. Los `id` de cada
          `CardColapsable` NO cambian: son la clave con la que se recuerda
          qué dejó plegado cada persona (PLEG-01). */}
      <nav aria-label="Secciones de la configuración" className="flex flex-wrap items-center gap-1.5">
        {FAMILIAS_CONFIG.map((f) => (
          <a key={f.id} href={`#${f.id}`}
            className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[12px] text-ink no-underline transition-colors hover:border-border-strong hover:bg-surface-2">
            {f.label}
          </a>
        ))}
      </nav>

      <section id="admin-cfg-empresa" aria-label="Empresa" className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">Empresa</p>
        {/* PLEG-01 · las tarjetas de abajo se pliegan y DESMONTAN su contenido.
            Lo que se teclea en ellas no se pierde al plegar: los campos de
            «guardar al salir» (onBlur) se guardan antes, porque el clic en el
            encabezado les quita el foco; y los borradores (IVA, plazo, tope)
            viven en el estado de `Configuracion`, fuera de la tarjeta. */}
        <CardColapsable
          id="admin.config.identidad"
          titulo="Identidad de la empresa"
          icono={<Building2 className="h-4 w-4 text-muted" />}
          contentClassName="space-y-4"
        >
            {/* Logo */}
            <Campo label="Logo">
              {/* 80px de vista previa: el logo ahora sale en el menú, en el
                  portal del cliente y en los correos, así que quien lo sube tiene
                  que poder ver qué está subiendo. A 56 no se distinguía si el
                  recorte estaba bien. */}
              <div className="flex items-center gap-3">
                {/* El aviso va SOBRE la vista previa, que es donde está mirando
                    quien acaba de elegir un archivo — no en una esquina de la
                    pantalla. El logo viejo se atenúa detrás en vez de
                    desaparecer: así se ve que sigue siendo el actual hasta que el
                    nuevo termine de guardarse. */}
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
                  {config.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={config.logoUrl}
                      alt="logo"
                      className={cn('h-full w-full object-contain', subiendoLogo && 'opacity-30')}
                    />
                  ) : (
                    <Building2 className={cn('h-6 w-6 text-muted', subiendoLogo && 'opacity-30')} />
                  )}
                  {subiendoLogo && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted" />
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <label
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded border border-border-strong px-3 text-[13px] text-ink',
                      subiendoLogo
                        ? 'pointer-events-none opacity-60'
                        : 'cursor-pointer hover:bg-surface-2',
                    )}
                  >
                    {subiendoLogo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {subiendoLogo ? 'Subiendo…' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                      className="hidden"
                      disabled={subiendoLogo}
                      onChange={subirLogo}
                    />
                  </label>
                  {config.logoUrl && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={subiendoLogo}
                      onClick={() => guardar({ logoUrl: null }, 'Logo quitado')}
                    >
                      Quitar
                    </Button>
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
            {/* Nombre y Moneda comparten fila: la moneda es de solo lectura y
                a ancho completo ocupaba una fila entera para un dato fijo. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nombre de la empresa">
              <input className={inputCls} value={config.nombreTenant}
                onChange={(e) => setConfig({ ...config, nombreTenant: e.target.value })}
                onBlur={(e) => guardar({ nombreTenant: e.target.value }, 'Nombre actualizado')} />
              <span className="mt-1 block text-[11px] text-muted">
                Es el que aparece en el menú lateral.
              </span>
            </Campo>
            <Campo label="Moneda">
              <div className="flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">$ · Peso mexicano (MXN)</div>
            </Campo>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RazonSocialPrincipal config={config} guardar={guardar} />
              <Campo label="Nombre comercial">
                <input className={inputCls} value={config.nombreComercial ?? ''} placeholder="p. ej. PIXELED"
                  onChange={(e) => setConfig({ ...config, nombreComercial: e.target.value })}
                  onBlur={(e) => guardar({ nombreComercial: e.target.value.trim() || null }, 'Nombre comercial actualizado')} />
              </Campo>
            </div>
            <span className="-mt-2 block text-[11px] text-muted">Se muestran en el encabezado del Dashboard.</span>
        </CardColapsable>

        <DatosFiscales config={config} setConfig={setConfig} guardar={guardar} />

        <CorreoDeAvisos config={config} guardar={guardar} />
      </section>

      <section id="admin-cfg-comercial" aria-label="Comercial" className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">Comercial</p>
        {/* IVA(s) con los que trabaja */}
        <CardColapsable
          id="admin.config.iva"
          titulo="IVA(s) con los que trabaja"
          icono={<Percent className="h-4 w-4 text-muted" />}
        >
            <div className="flex flex-wrap items-center gap-2">
              {config.ivaTasas.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] text-ink">
                  <span className="demo-num">{p}%</span>
                  <button type="button" disabled={config.ivaTasas.length <= 1}
                    onClick={() => guardar({ ivaTasas: config.ivaTasas.filter((x) => x !== p) })}
                    className="m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-error disabled:cursor-default disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <div className="inline-flex items-center gap-1">
                <input type="number" value={nuevoIva} onChange={(e) => setNuevoIva(e.target.value)} placeholder="%"
                  className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
                <Button size="sm" variant="success" onClick={() => {
                  const nx = Number(nuevoIva)
                  if (nx >= 0 && !config.ivaTasas.includes(nx)) guardar({ ivaTasas: [...config.ivaTasas, nx].sort((a, b) => a - b) }, `IVA ${nx}% agregado`)
                  setNuevoIva('')
                }}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">Las tasas disponibles para facturar. El IVA aplicado se elige por cliente.</p>
        </CardColapsable>

        <CardColapsable id="admin.config.plazos-cobranza" titulo="Plazos de cobranza (días)" icono={<CalendarClock className="h-4 w-4 text-muted" />}>
            <div className="flex flex-wrap items-center gap-2">
              {config.plazosCobranza.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] text-ink">
                  <span className="demo-num">{p}</span>
                  <button type="button" onClick={() => guardar({ plazosCobranza: config.plazosCobranza.filter((x) => x !== p) })} className="m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-error"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <div className="inline-flex items-center gap-1">
                <input type="number" value={nuevoPlazo} onChange={(e) => setNuevoPlazo(e.target.value)} placeholder="días"
                  className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
                <Button size="sm" variant="success" onClick={() => {
                  const nx = Number(nuevoPlazo)
                  if (nx > 0 && !config.plazosCobranza.includes(nx)) guardar({ plazosCobranza: [...config.plazosCobranza, nx].sort((a, b) => a - b) }, `Plazo ${nx} días agregado`)
                  setNuevoPlazo('')
                }}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
              </div>
            </div>
        </CardColapsable>

        {/* TOPE-01 · techo de descuento comercial de esta organización.
            100 % = sin tope, que es como nace: desplegar esto no invalida
            ninguna propuesta viva. Es el ÚNICO campo de esta pantalla que pide
            la contraseña, porque es el único que es un control y no un ajuste. */}
        <CardColapsable
          id="admin.config.tope-descuento"
          titulo="Tope de descuento comercial"
          icono={<Percent className="h-4 w-4 text-muted" />}
        >
            <div className="flex flex-wrap items-end gap-3">
              <Campo label="Descuento máximo (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`demo-num ${inputCls}`}
                  value={topeInput}
                  onChange={(e) => setTopeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarTope() }}
                />
              </Campo>
              <Button
                size="sm"
                onClick={guardarTope}
                disabled={candadoTope.enviando || Number(topeInput) === config.topeDescuentoPct}
              >
                {candadoTope.enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar tope
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              El descuento más alto que se puede aplicar a una propuesta. Por encima de este número la
              propuesta <b>no se guarda</b> y quien vende ve cuál es el tope. Déjalo en <b>100</b> para no
              limitar nada, que es como nace la organización. Lo que ya está pactado no cambia:
              bajar el tope no toca las propuestas que ya lo superan, solo impide volver a teclear
              ese descuento.
            </p>
            <p className="mt-1.5 text-[11px] text-muted">
              Cambiarlo pide tu contraseña: es el control que limita cuánto dinero se puede regalar en
              una venta, no un ajuste más.
            </p>
        </CardColapsable>
        <DialogoCandado
          candado={candadoTope}
          titulo="Confirma el tope de descuento"
          subtitulo="Estás cambiando cuánto descuento puede aplicar tu equipo en una propuesta."
          etiquetaConfirmar="Guardar tope"
        />

        {/* ADR 0008 · cupo de clientes por pantalla (default de la instalación).
            Vacío = sin límite, que es como nace: la regla se enciende capturando
            un número, nunca por desplegar. Cada pantalla puede sobrescribirlo
            desde su ficha en Comercial. */}
        <CardColapsable
          id="admin.config.cupo-clientes"
          titulo="Cupo de clientes por pantalla"
          icono={<Users className="h-4 w-4 text-muted" />}
        >
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
        </CardColapsable>

        <PropuestasDocumento config={config} guardar={guardar} />
      </section>

      <section id="admin-cfg-operacion" aria-label="Operación" className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">Operación</p>
        {/* Reproducción digital (loop y spot) */}
        <CardColapsable
          id="admin.config.loop"
          titulo="Reproducción digital (loop)"
          icono={<MonitorPlay className="h-4 w-4 text-muted" />}
        >
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
                <b className="text-ink">{conSlotsPropios.length}</b> de {conteo(digitales.length, 'pantalla')} digitales
                tienen un número propio distinto de {spotsPorLoop}
                {' '}({Array.from(new Set(conSlotsPropios.map((x) => x.totalSpots))).sort((a, b) => (a ?? 0) - (b ?? 0)).join(', ')} slots).
                Se edita en cada pantalla, desde Inventario.
              </p>
            )}
        </CardColapsable>

        {/* M15: esta tarjeta era un editor de texto libre que NO LEÍA NADIE — las
            OT sacan su tipo de un enum con reglas por tipo de pantalla. Aparecía
            vacía mientras Operaciones tenía una OT de «Montaje de lona», y la
            auditoría pidió sembrarla. Sembrarla habría sido peor: seguiría sin
            gobernar nada y encima parecería que sí. Ahora enseña lo que de verdad
            rige, en solo lectura. */}
        <CardColapsable id="admin.config.tipos-tarea" titulo="Tipos de tarea de cuadrilla" icono={<ListChecks className="h-4 w-4 text-muted" />}>
            <p className="mb-3 text-[13px] text-muted">
              Los fija el sistema, no se editan: cuáles aplican depende del tipo de pantalla y esa
              regla la comprueba el servidor al crear la orden.
            </p>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {tiposOtPara(null).map((t) => {
                const soloFija = TIPO_OT_SOLO_FIJA.includes(t)
                return (
                  <li key={t} className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-[13px] text-ink">
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#0f7a55]" /> {TIPO_OT_LABEL[t]}
                    </span>
                    <span className="text-[11px] text-muted">
                      {soloFija ? 'solo pantalla fija' : 'fija y digital'}
                    </span>
                  </li>
                )
              })}
            </ul>
        </CardColapsable>

        <CostosOtCard config={config} guardar={guardar} />
      </section>

      <section id="admin-cfg-instancia" aria-label="Instancia" className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">Instancia</p>
        {/* ADR 0037: qué version corre esta instancia, qué hay disponible y
            si el dueño la instala ahora o espera a la ventana automatica. Es
            config de la INSTANCIA (el droplet), no del negocio del tenant, y
            por eso va aparte de `ConfigNegocio` — no viaja en `guardar()`. */}
        <ActualizacionesPanel onToast={onToast} />

        {/* ADR 0038: el dueño escribe una incidencia a AS OOH y ve si ya se la
            contestaron. Consume /api/tickets (T5), no ConfigNegocio. */}
        <TicketsPanel onToast={onToast} />
      </section>
    </div>
  )
}

// ─── Costo de mano de obra por tipo de OT (B11) ─────────────────────────────
// El PATCH ya existía (`app/api/config/route.ts`, `sanearCostosOt`): faltaba
// solo la pantalla. Antes de este bloque solo se podía fijar con una petición
// a mano.
//
// `MONTAJE_DIGITAL` (TIPO_OT_OBSOLETO) queda fuera de la lista: ya no se
// ofrece en ninguna pantalla, así que capturarle un costo aquí sería
// configurar algo que nadie puede crear.
//
// Qué viaja en el PATCH —solo los tipos tocados, `null` explícito para
// "quitar"— es la única decisión no trivial de esta tarjeta y vive en
// `lib/costos-ot-payload.ts`, con su propia prueba: `vitest.config.ts` no
// monta jsdom (CLAUDE.md §4), así que nada dentro de este .tsx se prueba con
// unitarias. Este componente solo orquesta el estado de los inputs.
function CostosOtCard({
  config,
  guardar,
}: {
  config: ConfigNegocio
  guardar: (cambios: Partial<ConfigNegocio>, msg?: string) => Promise<boolean>
}) {
  const tipos = TODOS_TIPOS_OT.filter((t) => !TIPO_OT_OBSOLETO.includes(t))
  const original = config.costosOt ?? {}

  const borradorInicial = () =>
    Object.fromEntries(tipos.map((t) => [t, original[t] != null ? String(original[t]) : ''])) as Partial<
      Record<TipoOT, string>
    >
  const [borrador, setBorrador] = useState<Partial<Record<TipoOT, string>>>(borradorInicial)
  const [busy, setBusy] = useState(false)

  // Tras guardar, `guardar()` reemplaza `config` con la respuesta del
  // servidor (ya saneada): esto resincroniza los inputs con lo que de verdad
  // quedó escrito, igual que hace CorreoDeAvisos con `config.emailRemitente`.
  useEffect(() => {
    setBorrador(borradorInicial())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.costosOt])

  const payload = payloadCostosOt(original, borrador)
  const hayCambios = Object.keys(payload).length > 0
  // `payloadCostosOt` DESCARTA lo que no es un número para no tirar el PATCH
  // entero. Con la coma de miles al teclear, lo que no se entiende llega como
  // 'NaN' (CampoCifra): se para el botón para que ese costo no se quede sin
  // guardar mientras los demás sí, sin que nadie lo note.
  const hayInvalido = Object.values(borrador).includes(CRUDO_INVALIDO)

  async function guardarCostos() {
    setBusy(true)
    // `ConfigNegocio.costosOt` describe la forma que devuelve el GET —ya
    // saneada por `sanearCostosOt`, nunca con `null`—; el PATCH admite además
    // `null` por tipo para "quitarlo" (route.ts:64-67). Ensanchar el tipo
    // compartido para ese único campo de escritura afectaría a cada lector de
    // `costosOt` (derive.ts, reportes.ts), así que la forma más amplia se
    // declara aquí, acotada a esta única llamada.
    const cambios = { costosOt: payload } as unknown as Partial<ConfigNegocio>
    await guardar(cambios, 'Costos de mano de obra actualizados')
    setBusy(false)
  }

  return (
    <CardColapsable
      id="admin.config.costos-ot"
      titulo="Costo de mano de obra por tipo de orden de trabajo"
      icono={<Wrench className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
        <p className="text-[12px] text-muted">
          Se usa para calcular el margen en el dashboard y en los reportes de rentabilidad.
          Deja un campo en blanco para que ese tipo use el valor de respaldo, el mismo que
          aplicaba a todas las OT antes de que existiera esta tarjeta.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tipos.map((t) => (
            <Campo key={t} label={TIPO_OT_LABEL[t]}>
              <CampoCifra
                placeholder="Usa el respaldo"
                className={`demo-num ${inputCls}`}
                valor={borrador[t] ?? ''}
                onCambio={(crudo) => setBorrador((b) => ({ ...b, [t]: crudo }))}
              />
            </Campo>
          ))}
        </div>
        <Button size="sm" disabled={busy || !hayCambios || hayInvalido} onClick={guardarCostos}>
          <Save className="h-3.5 w-3.5" /> {busy ? 'Guardando…' : 'Guardar'}
        </Button>
    </CardColapsable>
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

// La razón social de la empresa NO se escribe aquí: se ELIGE de «Razones
// sociales» (20261012_razon_social_principal.sql). Antes era un texto libre que
// vivía aparte de esa lista, y agregar o renombrar una razón social allá no se
// enteraba aquí. Ahora es la misma fila, así que no pueden discrepar.
//
// Solo se ofrecen las activas: la principal no se puede dar de baja (el
// servidor lo impide con 409), y elegir una retirada la volvería a poner en
// los contratos sin que nadie la reactivara a propósito.
function RazonSocialPrincipal({
  config, guardar,
}: {
  config: ConfigNegocio
  guardar: (cambios: Partial<ConfigNegocio>, msg?: string) => Promise<boolean>
}) {
  const entidades = useEntidadesFiscales()
  const activas = (entidades ?? []).filter((e) => e.activo)
  const elegida = config.entidadPrincipalId ?? ''
  return (
    <Campo label="Razón social">
      {activas.length > 0 ? (
        <select className={inputCls} value={elegida}
          onChange={(e) => { if (e.target.value) void guardar({ entidadPrincipalId: e.target.value }, 'Razón social actualizada') }}>
          {!elegida && <option value="">Elige la razón social de la empresa</option>}
          {activas.map((e) => (
            <option key={e.id} value={e.id}>{e.razonSocial}</option>
          ))}
        </select>
      ) : (
        <div className="flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">
          {entidades === undefined ? 'Cargando…' : 'Todavía no hay razones sociales'}
        </div>
      )}
      <Link href="/razones-sociales" className="mt-1 inline-block text-[11px] font-medium text-accent hover:underline">
        + Agregar o editar en Razones sociales
      </Link>
    </Campo>
  )
}

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
    <CardColapsable
      id="admin.config.datos-fiscales"
      titulo="Datos fiscales para contratos"
      icono={<Scale className="h-4 w-4 text-muted" />}
      contentClassName="space-y-4"
    >
        <p className="text-[12px] text-muted">
          Con estos datos comparece tu empresa como <b>parte arrendataria</b> en los contratos
          de arrendamiento que genera el sistema. Se capturan una vez y valen para todos.
        </p>

        {faltan.length > 0 && (
          <div className={FRANJA_AVISO}>
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
        {campo('datosConstitucion', 'Datos de constitución',
          'p. ej. escritura pública 12,345 del 3 de marzo de 2014, ante el notario 45 de Guadalajara, Jalisco',
          'Datos de constitución actualizados', true)}
        <span className="-mt-1 block text-[11px] text-muted">
          El RFC es el de la razón social principal: cambiarlo aquí lo cambia también en «Razones sociales».
          La razón social se elige arriba, en «Identidad de la empresa».
        </span>
    </CardColapsable>
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
// PROP-COMPLETA (29/10) · lo que cada propuesta nueva hereda de la organización:
// la PLANTILLA de condiciones (se copia al crear; cambiarla aquí no toca las ya
// creadas) y los días de vigencia que se le dan al enviarla (30 por omisión,
// decisión del dueño). Las dos se ajustan después en cada propuesta.
function PropuestasDocumento({
  config,
  guardar,
}: {
  config: ConfigNegocio
  guardar: (cambios: Partial<ConfigNegocio>, msg?: string) => Promise<boolean>
}) {
  const actual = config.condicionesPropuesta ?? ''
  const [texto, setTexto] = useState(actual)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { setTexto(config.condicionesPropuesta ?? '') }, [config.condicionesPropuesta])
  const dias = config.vigenciaPropuestaDias ?? 30

  return (
    <CardColapsable
      id="admin.config.propuestas"
      titulo="Propuestas: vigencia y condiciones"
      icono={<FileText className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Campo label="Vigencia (días)">
          <input
            type="number"
            min={1}
            max={365}
            className={`demo-num ${inputCls}`}
            defaultValue={dias}
            onBlur={(e) => {
              const v = Math.round(Number(e.target.value))
              if (!Number.isFinite(v) || v < 1 || v > 365) {
                e.target.value = String(dias)
                return
              }
              if (v !== dias) void guardar({ vigenciaPropuestaDias: v }, `Vigencia de propuestas: ${v} días`)
            }}
          />
        </Campo>
      </div>
      <p className="text-[11px] text-muted">
        Se cuentan desde que la propuesta se <b>envía</b>. Vencida, el cliente ya no puede aceptarla desde su
        liga; por dentro se le pone otra fecha o se vuelve a enviar.
      </p>
      <Campo label="Plantilla de términos y condiciones">
        <textarea
          className={`${inputCls} h-auto py-2`}
          rows={6}
          maxLength={8000}
          placeholder="Sin condiciones: las propuestas no llevan este bloque."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={guardando || texto.trim() === actual.trim()}
          onClick={async () => {
            setGuardando(true)
            await guardar({ condicionesPropuesta: texto.trim() || null }, 'Plantilla de condiciones guardada')
            setGuardando(false)
          }}
        >
          <Check className="h-3.5 w-3.5" /> {guardando ? 'Guardando…' : 'Guardar plantilla'}
        </Button>
        <span className="text-[11px] text-muted">Se copia a cada propuesta nueva; las ya creadas conservan las suyas.</span>
      </div>
    </CardColapsable>
  )
}

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
    <>
    <CardColapsable
      id="admin.config.correo-avisos"
      titulo="Correo de avisos"
      icono={<Mail className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
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
    </CardColapsable>

      {/* Fuera de la tarjeta: CardColapsable desmonta su contenido al plegar. */}
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
    </>
  )
}
