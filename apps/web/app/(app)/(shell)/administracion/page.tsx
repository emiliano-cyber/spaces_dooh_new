'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma, useTexto } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { DICCIONARIOS, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
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
  CLAVE_CAP,
  type Capacidad,
} from '@/components/demo/admin/permisos'
import { cn } from '@/lib/cn'
import { simboloMoneda, nombreMoneda } from '@/lib/i18n/dinero'
import { esEmailValido } from '@/lib/validacion'
import { restablecerPasswordApi, desbloquearApi, esErrorDeDesbloqueo } from '@/lib/data/cambios-api'
import { areasDeModulo } from '@/lib/modulos'
import { etiquetaTipoOt, TIPO_OT_SOLO_FIJA, TIPO_OT_OBSOLETO, TODOS_TIPOS_OT, tiposOtPara } from '@/lib/tipos-ot'
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
import { validarPassword } from '@/lib/password'
import { ROL_POR_OMISION } from '@/lib/roles'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function AdministracionPage() {
  const [toast, setToast] = useState<string | null>(null)
  const notify = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }
  const t = useTexto()
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">{t('admin.titulo')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('admin.subtitulo')}</p>
      </div>

      <Tabs
        defaultValue="usuarios"
        tabs={[
          { value: 'usuarios', label: t('admin.tab.usuarios') },
          { value: 'roles', label: t('admin.tab.roles') },
          { value: 'config', label: t('admin.tab.config') },
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
  const { t, idioma } = useIdioma()

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
    onToast(t('admin.usuarios.toast.rol', { nombre, rol: rolLabel(rol, idioma) }))
    cargar()
    await refrescarSiSoyYo(id)
  }
  async function toggle(id: string, activo: boolean, nombre: string) {
    await actualizarUsuarioApi(id, { activo: !activo })
    onToast(t(activo ? 'admin.usuarios.toast.desactivado' : 'admin.usuarios.toast.activado', { nombre }))
    cargar()
    await refrescarSiSoyYo(id)
  }

  // El plural con `.uno`/`.otros` (I18N, 2026-11-02); el espanol es el de
  // `conteo()` de siempre («3 usuarios», «1 inactivo»).
  const contar = (n: number, base: 'usuarios' | 'activos' | 'inactivos') =>
    t(`admin.usuarios.n-${base}.${Math.abs(n) === 1 ? 'uno' : 'otros'}` as ClaveTexto, { n: formatNumero(n, 0, idioma) })
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
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink"><ShieldCheck className="h-3.5 w-3.5 text-muted" /> {rolLabel(u.rol, idioma)}</span>
    ) : (
      <select value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value as RolDemo, u.nombre)}
        aria-label={t('admin.usuarios.rol-de', { nombre: u.nombre })}
        className="h-8 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {ROLES.map((r) => <option key={r.value} value={r.value}>{rolLabel(r.value, idioma)}</option>)}
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
    const etiqueta = u.activo ? t('admin.comun.activo') : t('admin.comun.inactivo')
    if (esYo) return <Chip tono={u.activo ? 'exito' : 'neutro'} punto title={t('admin.usuarios.estatus-propio')}>{etiqueta}</Chip>
    const Interruptor = u.activo ? ToggleRight : ToggleLeft
    return (
      <button type="button" onClick={() => toggle(u.id, u.activo, u.nombre)}
        title={u.activo ? t('admin.usuarios.pulsa-desactivar', { nombre: u.nombre }) : t('admin.usuarios.pulsa-activar', { nombre: u.nombre })}
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
      <KeyRound className="h-3.5 w-3.5 text-muted" /> {esYo ? t('admin.usuarios.cambiar-mia') : t('admin.usuarios.cambiar')}
    </button>
  )
  const chipTu = <Chip tono="acento" className="px-1.5 text-[10px]">{t('admin.usuarios.tu')}</Chip>

  return (
    <>
    <CardColapsable
      id="admin.usuarios"
      titulo={t('admin.usuarios.equipo')}
      icono={<Users className="h-4 w-4 text-muted" />}
      contentClassName="px-0 pb-0"
      resumen={usuarios && usuarios.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <Chip><span className="demo-num">{contar(usuarios.length, 'usuarios')}</span></Chip>
          <Chip tono="exito" punto><span className="demo-num">{contar(activos, 'activos')}</span></Chip>
          {inactivos > 0 && <Chip punto><span className="demo-num">{contar(inactivos, 'inactivos')}</span></Chip>}
        </div>
      ) : undefined}
      accion={<Button variant="success" size="sm" onClick={() => setInvOpen(true)}><UserPlus className="h-3.5 w-3.5" /> {t('admin.usuarios.invitar')}</Button>}
    >
        {!usuarios ? (
          <div className="space-y-2 px-4 pb-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />)}</div>
        ) : usuarios.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">{t('admin.usuarios.sin-usuarios')}</p>
        ) : (
          <>
          {/* Desde `sm`: la tabla de siempre. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">{t('admin.usuarios.col.usuario')}</th>
                  <th className="px-4 py-2 font-medium">{t('admin.usuarios.col.rol')}</th>
                  <th className="px-4 py-2 font-medium">{t('admin.usuarios.col.estatus')}</th>
                  <th className="px-4 py-2 font-medium">{t('admin.usuarios.col.contrasena')}</th>
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
      <InvitarModal open={invOpen} onOpenChange={setInvOpen} onInvitado={(n, enviada) => { onToast(enviada ? t('admin.usuarios.toast.invitacion', { nombre: n }) : t('admin.usuarios.toast.creado', { nombre: n })); cargar() }} />

      {passwordDe && (
        <CambiarPasswordModal
          usuario={passwordDe}
          esYo={passwordDe.id === yo}
          onClose={() => setPasswordDe(null)}
          onDone={() => { onToast(passwordDe.id === yo ? t('admin.usuarios.toast.tu-contrasena') : t('admin.usuarios.toast.contrasena-de', { nombre: passwordDe.nombre })); setPasswordDe(null) }}
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
  const t = useTexto()
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
    if (nueva.length < 8) { setError(t('admin.password.error.corta')); return }
    if (nueva !== confirmar) { setError(t('admin.password.error.no-coinciden')); return }
    if (!actual) { setError(t('admin.password.error.actual')); return }
    setEnviando(true)
    try {
      const r = await fetch('/spaces-dooh/api/perfil/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nueva, passwordActual: actual }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? t('admin.password.error.cambiar'))
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.password.error.cambiar'))
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
      else setError(e instanceof Error ? e.message : t('admin.password.error.restablecer'))
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
      setError(e instanceof Error ? e.message : t('admin.password.error.restablecer'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && (temporal ? onDone() : onClose())}
      title={esYo ? t('admin.password.titulo.mia') : t('admin.password.titulo.de', { nombre: usuario.nombre })}
      subtitle={esYo ? t('admin.password.subtitulo.mia') : usuario.email}
      footer={
        <div className="flex justify-end gap-2">
          {temporal ? (
            <Button size="sm" onClick={onDone}>{t('admin.password.ya-copie')}</Button>
          ) : reautenticando ? (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
              <Button size="sm" disabled={enviando} onClick={reautenticarYRestablecer}>
                {enviando ? t('admin.password.confirmando') : t('admin.password.confirmar-restablecer')}
              </Button>
            </>
          ) : esYo ? (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
              <Button size="sm" disabled={enviando} onClick={guardarPropia}>
                {enviando ? t('admin.comun.guardando') : t('admin.password.guardar')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
              <Button size="sm" disabled={enviando} onClick={restablecer}>
                {enviando ? t('admin.password.restableciendo') : t('admin.password.restablecer')}
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
              {interpolarNodos(t('admin.password.temporal-de'), { nombre: <b>{usuario.nombre}</b> })}
            </p>
            <div className="demo-num select-all rounded-md border border-border-strong bg-surface-2 px-3 py-2.5 text-center text-[15px] tracking-wider text-ink">
              {temporal}
            </div>
            <p className={FRANJA_AVISO}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
              <span>
                {t('admin.password.no-se-ve', { nombre: usuario.nombre })}
              </span>
            </p>
          </>
        ) : reautenticando ? (
          <>
            <p className="text-[13px] text-ink">
              {interpolarNodos(t('admin.password.confirma-tu', { nombre: usuario.nombre }), { tu: <b>{t('admin.password.tu')}</b> })}
            </p>
            <Campo label={t('admin.password.tu-contrasena')} obligatorio falta={ob.falta('passActor')}>
              <input type="password" className={inputCls} value={passActor}
                onChange={(e) => setPassActor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !enviando) void reautenticarYRestablecer() }}
                autoComplete="current-password" autoFocus />
            </Campo>
          </>
        ) : esYo ? (
          <>
            <Campo label={t('admin.password.actual')} obligatorio falta={ob.falta('actual')}>
              <input type="password" className={inputCls} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" autoFocus />
            </Campo>
            <Campo label={t('admin.password.nueva')} obligatorio falta={ob.falta('nueva')}>
              <input type="password" className={inputCls} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder={t('password.regla')} autoComplete="new-password" />
            </Campo>
            <Campo label={t('admin.password.confirmar')} obligatorio falta={ob.falta('confirmar')}>
              <input type="password" className={inputCls} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
            </Campo>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            {interpolarNodos(t('admin.password.se-generara', { nombre: usuario.nombre }), { temporal: <b>{t('admin.password.temporal')}</b> })}
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
  const { t, idioma } = useIdioma()

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
    if (!esEmailValido(email)) { setError(t('validacion.email')); return }
    setEnviando(true)
    setError(null)
    try {
      const u = await invitarUsuarioApi({
        nombre: nombre.trim(),
        email: email.trim(),
        cargo: cargo.trim() || t('admin.alta.cargo-omision'),
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
      setError(e instanceof Error ? e.message : t('admin.alta.error'))
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

  const subtitulo = enlace ? t('admin.alta.sub.enlace')
    : acceso === 'invitar' ? t('admin.alta.sub.invitar')
    : acceso === 'google' ? t('admin.alta.sub.google')
    : t('admin.alta.sub.password')

  const footer = enlace
    ? <div className="flex justify-end gap-2"><Button variant="success" size="sm" onClick={cerrar}>{t('admin.alta.listo')}</Button></div>
    : <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={cerrar}>{t('comun.cancelar')}</Button><Button variant="success" size="sm" disabled={passwordInvalida || enviando} onClick={enviar}>{enviando ? t('admin.comun.creando') : acceso === 'invitar' ? t('admin.alta.crear-invitar') : t('admin.alta.crear')}</Button></div>

  return (
    <Modal open={open} onOpenChange={(v) => (v ? onOpenChange(true) : cerrar())} title={t('admin.alta.titulo')} subtitle={subtitulo} footer={footer}>
      {enlace ? (
        <div className="space-y-3">
          {enlace.fallo ? (
            <p className={FRANJA_AVISO}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a6700]" />
              {t('admin.alta.fallo-correo')}
            </p>
          ) : (
            <p className="text-[12px] text-muted">
              {interpolarNodos(t('admin.alta.sin-correo'), { nombre: <b className="text-ink">{nombre}</b> })}
            </p>
          )}
          <div className="break-all rounded border border-border bg-bg p-2.5 font-mono text-[12px] text-ink">{enlace.url}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">{t('admin.alta.vence')}</span>
            <Button variant="secondary" size="sm" onClick={copiar}>{copiado ? <><Check className="h-3.5 w-3.5" /> {t('admin.alta.copiado')}</> : t('admin.alta.copiar')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Campo label={t('admin.alta.nombre')} obligatorio falta={ob.falta('nombre')}><input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Campo>
          <Campo label={t('admin.alta.correo')} obligatorio falta={ob.falta('email')}><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('admin.alta.ejemplo-correo')} /></Campo>
          <Campo label={t('admin.alta.cargo')}><input className={inputCls} value={cargo} onChange={(e) => setCargo(e.target.value)} /></Campo>
          <Campo label={t('admin.alta.rol')}><select className={inputCls} value={rol} onChange={(e) => setRol(e.target.value as RolDemo)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{rolLabel(r.value, idioma)}</option>)}</select></Campo>
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-[12px] font-medium text-ink">{t('admin.alta.acceso')}</legend>
            <OpcionAcceso
              activa={acceso === 'invitar'} onElegir={() => { setAcceso('invitar'); setError(null) }}
              titulo={t('admin.alta.invitar.titulo')}
              detalle={t('admin.alta.invitar.detalle')}
            />
            <OpcionAcceso
              activa={acceso === 'password'} onElegir={() => { setAcceso('password'); setError(null) }}
              titulo={t('admin.alta.fijar.titulo')}
              detalle={t('admin.alta.fijar.detalle')}
            />
            {googleDisponible && (
              <OpcionAcceso
                activa={acceso === 'google'} onElegir={() => { setAcceso('google'); setError(null) }}
                titulo={t('admin.alta.google.titulo')}
                detalle={t('admin.alta.google.detalle')}
              />
            )}
          </fieldset>
          {/* La contraseña desaparece —no se deshabilita— si no se va a usar:
              un campo gris que sigue ahí invita a preguntarse si hay que
              rellenarlo igual. */}
          {acceso === 'password' && (
            <Campo label={t('admin.alta.contrasena')} obligatorio falta={ob.falta('password')}>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password.regla')} />
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
// I18N (2026-11-02) · en espanol, el `label` de `lib/modulos.ts` de siempre; en
// otro idioma, el rotulo del menu (`nav.<clave>`), que es el mismo texto —lo
// fija `textos/admin.test.ts`—, salvo Space Eyes, que aqui se explica entero.
function etiquetaArea(clave: string, label: string, idioma: Idioma, t: (k: ClaveTexto) => string): string {
  if (idioma === 'es') return label
  if (clave === 'space-eyes') return t('admin.area.space-eyes')
  const k = `nav.${clave}` as ClaveTexto
  return k in DICCIONARIOS.es ? t(k) : label
}

// La etiqueta de un modulo de la matriz la manda el servidor EN ESPANOL
// (`MODULO_LABEL`, `lib/server/usuarios-repo.ts`): en espanol se pinta la que
// llega, y en otro idioma la de `admin.modulo.<key>` si la hay.
function etiquetaModulo(key: string, label: string, idioma: Idioma, t: (k: ClaveTexto) => string): string {
  if (idioma === 'es') return label
  const k = `admin.modulo.${key}` as ClaveTexto
  return k in DICCIONARIOS.es ? t(k) : label
}

function AreasDelModulo({ modulo }: { modulo: string }) {
  const { t, idioma } = useIdioma()
  const areas = areasDeModulo(modulo).filter((a) => a.clave !== modulo)
  if (areas.length === 0) return null
  return (
    <div className="mt-0.5 text-[11px] leading-relaxed text-muted">
      {areas.map((a, i) => (
        <span key={a.clave}>
          {i > 0 && ' · '}
          {etiquetaArea(a.clave, a.label, idioma, t)}
          {!a.apiPropia && <span title={t('admin.matriz.sin-api')}>*</span>}
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
  const { t, idioma } = useIdioma()
  useEffect(() => { getPermisosMatrizApi().then(setData) }, [])

  const tiene = (modulo: string, rol: string, cap: Capacidad) =>
    !!data?.filas.some((r) => r.modulo === modulo && r.rol === rol && r.accion === cap)

  return (
    <CardColapsable id="admin.permisos" titulo={t('admin.matriz.titulo')} contentClassName="px-0 pb-0">
        {/* La leyenda va ARRIBA (antes iba al pie, tras once filas): las
            celdas son letras sueltas —V, C, A…— y sin la clave delante la
            tabla no se puede leer. Mismo criterio que Stripe con sus roles. */}
        <div className="mx-4 mb-3 flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-[11px] text-muted">
          {CAPACIDADES.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5"><CapChip cap={c} /> {t(CLAVE_CAP[c])}</span>
          ))}
          <span>{t('admin.matriz.leyenda-sin-api')}</span>
        </div>
        {data === undefined ? (
          <div className="h-32 animate-pulse rounded bg-surface-2 mx-4 mb-4" />
        ) : !data ? (
          <div className="px-4 py-6 text-[13px] text-muted">{t('admin.matriz.error')}</div>
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  {/* Primera columna fija: en móvil la tabla se desplaza a
                      lo ancho y, sin esto, el nombre del módulo se iba con el
                      scroll y quedaban columnas de letras sin saber de qué. */}
                  <th className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">{t('admin.matriz.col.modulo')}</th>
                  {data.roles.map((r) => <th key={r.rol} className="px-3 py-2 text-center font-medium">{idioma === 'es' ? r.label : rolLabel(r.rol as RolDemo, idioma)}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.modulos.map((mod) => (
                  <tr key={mod.key} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 align-top">
                      <div className="font-medium text-ink">{etiquetaModulo(mod.key, mod.label, idioma, t)}</div>
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
  { id: 'admin-cfg-empresa', label: 'admin.cfg.familia.empresa' },
  { id: 'admin-cfg-comercial', label: 'admin.cfg.familia.comercial' },
  { id: 'admin-cfg-operacion', label: 'admin.cfg.familia.operacion' },
  { id: 'admin-cfg-instancia', label: 'admin.cfg.familia.instancia' },
] as const satisfies readonly { id: string; label: ClaveTexto }[]

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
  const { t, idioma } = useIdioma()
  // Dentro del `map` de los tipos de tarea, `t` es el tipo: ahi se traduce con `tx`.
  const tx = t
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
      onToast(t('admin.tope.invalido'))
      setTopeInput(String(config?.topeDescuentoPct ?? 100))
      return
    }
    if (v === config?.topeDescuentoPct) return
    void candadoTope.ejecutar({
      guardar: async () => { setConfig(await actualizarConfigApi({ topeDescuentoPct: v })) },
      alLograr: () => onToast(v >= 100 ? t('admin.tope.sin-tope') : t('admin.tope.toast', { v })),
      alFallar: (m) => onToast(m),
      mensajeSiFalla: t('admin.tope.error'),
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
      onToast(e instanceof Error ? e.message : t('admin.comun.no-se-pudo-guardar'))
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
    if (!tipoOk) { onToast(t('admin.logo.tipo')); return }
    if (f.size > LOGO_MAX_MB * 1024 * 1024) { onToast(t('admin.logo.peso', { mb: LOGO_MAX_MB })); return }

    setSubiendoLogo(true)
    try {
      const dataUrl = await leerDataUrl(f).catch(() => null)
      if (!dataUrl) { onToast(t('admin.logo.ilegible')); return }
      if (!(await puedePintarse(dataUrl))) {
        onToast(t('admin.logo.no-imagen'))
        return
      }
      await guardar({ logoUrl: dataUrl }, t('admin.logo.actualizado'))
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
      <nav aria-label={t('admin.cfg.secciones')} className="flex flex-wrap items-center gap-1.5">
        {FAMILIAS_CONFIG.map((f) => (
          <a key={f.id} href={`#${f.id}`}
            className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[12px] text-ink no-underline transition-colors hover:border-border-strong hover:bg-surface-2">
            {t(f.label)}
          </a>
        ))}
      </nav>

      <section id="admin-cfg-empresa" aria-label={t('admin.cfg.familia.empresa')} className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">{t('admin.cfg.familia.empresa')}</p>
        {/* PLEG-01 · las tarjetas de abajo se pliegan y DESMONTAN su contenido.
            Lo que se teclea en ellas no se pierde al plegar: los campos de
            «guardar al salir» (onBlur) se guardan antes, porque el clic en el
            encabezado les quita el foco; y los borradores (IVA, plazo, tope)
            viven en el estado de `Configuracion`, fuera de la tarjeta. */}
        <CardColapsable
          id="admin.config.identidad"
          titulo={t('admin.identidad.titulo')}
          icono={<Building2 className="h-4 w-4 text-muted" />}
          contentClassName="space-y-4"
        >
            {/* Logo */}
            <Campo label={t('admin.logo.campo')}>
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
                      alt={t('sidebar.logo-alt')}
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
                    {subiendoLogo ? t('admin.logo.subiendo') : t('admin.logo.subir')}
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
                      onClick={() => guardar({ logoUrl: null }, t('admin.logo.quitado'))}
                    >
                      {t('admin.comun.quitar')}
                    </Button>
                  )}
                </div>
              </div>
              <span className="mt-1 block text-[11px] text-muted">
                {t('admin.logo.ayuda', { mb: LOGO_MAX_MB })}
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
            <Campo label={t('admin.identidad.nombre')}>
              <input className={inputCls} value={config.nombreTenant}
                onChange={(e) => setConfig({ ...config, nombreTenant: e.target.value })}
                onBlur={(e) => guardar({ nombreTenant: e.target.value }, t('admin.identidad.nombre-toast'))} />
              <span className="mt-1 block text-[11px] text-muted">
                {t('admin.identidad.nombre-ayuda')}
              </span>
            </Campo>
            {/* ADR 0048: la moneda es la de la INSTANCIA, se eligio al crearla y
                no se puede cambiar. Antes decia «Peso mexicano (MXN)» escrito a
                mano, que en una instancia en dolares habria mentido. */}
            <Campo label={t('admin.identidad.moneda')}>
              <div className="flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">{simboloMoneda(idioma)} · {nombreMoneda(idioma)}</div>
              <span className="mt-1 block text-[11px] text-muted">
                {t('admin.identidad.moneda-ayuda')}
              </span>
            </Campo>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RazonSocialPrincipal config={config} guardar={guardar} />
              <Campo label={t('admin.identidad.comercial')}>
                <input className={inputCls} value={config.nombreComercial ?? ''} placeholder={t('admin.identidad.comercial-ejemplo')}
                  onChange={(e) => setConfig({ ...config, nombreComercial: e.target.value })}
                  onBlur={(e) => guardar({ nombreComercial: e.target.value.trim() || null }, t('admin.identidad.comercial-toast'))} />
              </Campo>
            </div>
            <span className="-mt-2 block text-[11px] text-muted">{t('admin.identidad.dashboard')}</span>
        </CardColapsable>

        <DatosFiscales config={config} setConfig={setConfig} guardar={guardar} />

        <CorreoDeAvisos config={config} guardar={guardar} />
      </section>

      <section id="admin-cfg-comercial" aria-label={t('admin.cfg.familia.comercial')} className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">{t('admin.cfg.familia.comercial')}</p>
        {/* IVA(s) con los que trabaja */}
        <CardColapsable
          id="admin.config.iva"
          titulo={t('admin.iva.titulo')}
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
                  if (nx >= 0 && !config.ivaTasas.includes(nx)) guardar({ ivaTasas: [...config.ivaTasas, nx].sort((a, b) => a - b) }, t('admin.iva.agregado', { n: nx }))
                  setNuevoIva('')
                }}><Plus className="h-3.5 w-3.5" /> {t('admin.comun.agregar')}</Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted">{t('admin.iva.ayuda')}</p>
        </CardColapsable>

        <CardColapsable id="admin.config.plazos-cobranza" titulo={t('admin.plazos.titulo')} icono={<CalendarClock className="h-4 w-4 text-muted" />}>
            <div className="flex flex-wrap items-center gap-2">
              {config.plazosCobranza.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] text-ink">
                  <span className="demo-num">{p}</span>
                  <button type="button" onClick={() => guardar({ plazosCobranza: config.plazosCobranza.filter((x) => x !== p) })} className="m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-error"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <div className="inline-flex items-center gap-1">
                <input type="number" value={nuevoPlazo} onChange={(e) => setNuevoPlazo(e.target.value)} placeholder={t('admin.plazos.dias')}
                  className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
                <Button size="sm" variant="success" onClick={() => {
                  const nx = Number(nuevoPlazo)
                  if (nx > 0 && !config.plazosCobranza.includes(nx)) guardar({ plazosCobranza: [...config.plazosCobranza, nx].sort((a, b) => a - b) }, t('admin.plazos.agregado', { n: nx }))
                  setNuevoPlazo('')
                }}><Plus className="h-3.5 w-3.5" /> {t('admin.comun.agregar')}</Button>
              </div>
            </div>
        </CardColapsable>

        {/* TOPE-01 · techo de descuento comercial de esta organización.
            100 % = sin tope, que es como nace: desplegar esto no invalida
            ninguna propuesta viva. Es el ÚNICO campo de esta pantalla que pide
            la contraseña, porque es el único que es un control y no un ajuste. */}
        <CardColapsable
          id="admin.config.tope-descuento"
          titulo={t('admin.tope.titulo')}
          icono={<Percent className="h-4 w-4 text-muted" />}
        >
            <div className="flex flex-wrap items-end gap-3">
              <Campo label={t('admin.tope.maximo')}>
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
                {candadoTope.enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('admin.tope.guardar')}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {interpolarNodos(t('admin.tope.explica'), { noSeGuarda: <b>{t('admin.tope.no-se-guarda')}</b>, cien: <b>100</b> })}
            </p>
            <p className="mt-1.5 text-[11px] text-muted">
              {t('admin.tope.contrasena')}
            </p>
        </CardColapsable>
        <DialogoCandado
          candado={candadoTope}
          titulo={t('admin.tope.candado.titulo')}
          subtitulo={t('admin.tope.candado.subtitulo')}
          etiquetaConfirmar={t('admin.tope.guardar')}
        />

        {/* ADR 0008 · cupo de clientes por pantalla (default de la instalación).
            Vacío = sin límite, que es como nace: la regla se enciende capturando
            un número, nunca por desplegar. Cada pantalla puede sobrescribirlo
            desde su ficha en Comercial. */}
        <CardColapsable
          id="admin.config.cupo-clientes"
          titulo={t('admin.cupo.titulo')}
          icono={<Users className="h-4 w-4 text-muted" />}
        >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo label={t('admin.cupo.maximo')}>
                <input
                  type="number"
                  min={1}
                  placeholder={t('admin.cupo.sin-limite')}
                  className={`demo-num ${inputCls}`}
                  defaultValue={config.maxClientesPantalla ?? ''}
                  onBlur={(e) => {
                    const txt = e.target.value.trim()
                    const v = txt === '' ? null : Math.max(1, Math.round(Number(txt) || 1))
                    if (v !== (config.maxClientesPantalla ?? null)) {
                      guardar(
                        { maxClientesPantalla: v },
                        v == null ? t('admin.cupo.desactivado') : t('admin.cupo.toast', { v }),
                      )
                    }
                  }}
                />
              </Campo>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {t('admin.cupo.ayuda')}
            </p>
        </CardColapsable>

        <PropuestasDocumento config={config} guardar={guardar} />
      </section>

      <section id="admin-cfg-operacion" aria-label={t('admin.cfg.familia.operacion')} className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">{t('admin.cfg.familia.operacion')}</p>
        {/* Reproducción digital (loop y spot) */}
        <CardColapsable
          id="admin.config.loop"
          titulo={t('admin.loop.titulo')}
          icono={<MonitorPlay className="h-4 w-4 text-muted" />}
        >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo label={t('admin.loop.tamano')}>
                <input type="number" className={`demo-num ${inputCls}`} defaultValue={config.loopSeg}
                  onBlur={(e) => { const v = Math.max(1, Number(e.target.value) || 0); if (v !== config.loopSeg) guardar({ loopSeg: v }, t('admin.loop.toast')) }} />
              </Campo>
              <Campo label={t('admin.loop.duracion')}>
                <input type="number" className={`demo-num ${inputCls}`} defaultValue={config.spotSeg}
                  onBlur={(e) => { const v = Math.max(1, Number(e.target.value) || 0); if (v !== config.spotSeg) guardar({ spotSeg: v }, t('admin.loop.slot-toast')) }} />
              </Campo>
              <Campo label={t('admin.loop.slots')}>
                <div className="demo-num flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] font-semibold text-ink">{spotsPorLoop}</div>
              </Campo>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {interpolarNodos(t('admin.loop.referencia'), { referencia: <b>{t('admin.loop.referencia-palabra')}</b> })}
            </p>
            {conSlotsPropios.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted">
                {interpolarNodos(
                  t(conSlotsPropios.length === 1 ? 'admin.loop.propios.uno' : 'admin.loop.propios.otros', {
                    pantallas: t(Math.abs(digitales.length) === 1 ? 'admin.loop.pantallas.uno' : 'admin.loop.pantallas.otros', { n: formatNumero(digitales.length, 0, idioma) }),
                    slots: spotsPorLoop,
                    lista: Array.from(new Set(conSlotsPropios.map((x) => x.totalSpots))).sort((a, b) => (a ?? 0) - (b ?? 0)).join(', '),
                  }),
                  { n: <b className="text-ink">{conSlotsPropios.length}</b> },
                )}
              </p>
            )}
        </CardColapsable>

        {/* M15: esta tarjeta era un editor de texto libre que NO LEÍA NADIE — las
            OT sacan su tipo de un enum con reglas por tipo de pantalla. Aparecía
            vacía mientras Operaciones tenía una OT de «Montaje de lona», y la
            auditoría pidió sembrarla. Sembrarla habría sido peor: seguiría sin
            gobernar nada y encima parecería que sí. Ahora enseña lo que de verdad
            rige, en solo lectura. */}
        <CardColapsable id="admin.config.tipos-tarea" titulo={t('admin.tareas.titulo')} icono={<ListChecks className="h-4 w-4 text-muted" />}>
            <p className="mb-3 text-[13px] text-muted">
              {t('admin.tareas.ayuda')}
            </p>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {tiposOtPara(null).map((t) => {
                const soloFija = TIPO_OT_SOLO_FIJA.includes(t)
                return (
                  <li key={t} className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-[13px] text-ink">
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#0f7a55]" /> {etiquetaTipoOt(t, idioma)}
                    </span>
                    <span className="text-[11px] text-muted">
                      {soloFija ? tx('admin.tareas.solo-fija') : tx('admin.tareas.fija-digital')}
                    </span>
                  </li>
                )
              })}
            </ul>
        </CardColapsable>

        <CostosOtCard config={config} guardar={guardar} />
      </section>

      <section id="admin-cfg-instancia" aria-label={t('admin.cfg.familia.instancia')} className="scroll-mt-4 space-y-4">
        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">{t('admin.cfg.familia.instancia')}</p>
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
  const { t, idioma } = useIdioma()

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
    await guardar(cambios, t('admin.costos.toast'))
    setBusy(false)
  }

  return (
    <CardColapsable
      id="admin.config.costos-ot"
      titulo={t('admin.costos.titulo')}
      icono={<Wrench className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
        <p className="text-[12px] text-muted">
          {t('admin.costos.ayuda')}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tipos.map((tipo) => (
            <Campo key={tipo} label={etiquetaTipoOt(tipo, idioma)}>
              <CampoCifra
                placeholder={t('admin.costos.respaldo')}
                className={`demo-num ${inputCls}`}
                valor={borrador[tipo] ?? ''}
                onCambio={(crudo) => setBorrador((b) => ({ ...b, [tipo]: crudo }))}
              />
            </Campo>
          ))}
        </div>
        <Button size="sm" disabled={busy || !hayCambios || hayInvalido} onClick={guardarCostos}>
          <Save className="h-3.5 w-3.5" /> {busy ? t('admin.comun.guardando') : t('comun.guardar')}
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
  ['razonSocial', 'admin.fiscal.razon-social'],
  ['rfc', 'admin.fiscal.rfc'],
  ['domicilioFiscal', 'admin.fiscal.domicilio'],
  ['representanteLegal', 'admin.fiscal.representante'],
] as const satisfies readonly (readonly [string, ClaveTexto])[]

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
  const t = useTexto()
  const activas = (entidades ?? []).filter((e) => e.activo)
  const elegida = config.entidadPrincipalId ?? ''
  return (
    <Campo label={t('admin.fiscal.razon-social')}>
      {activas.length > 0 ? (
        <select className={inputCls} value={elegida}
          onChange={(e) => { if (e.target.value) void guardar({ entidadPrincipalId: e.target.value }, t('admin.fiscal.razon-toast')) }}>
          {!elegida && <option value="">{t('admin.fiscal.elige')}</option>}
          {activas.map((e) => (
            <option key={e.id} value={e.id}>{e.razonSocial}</option>
          ))}
        </select>
      ) : (
        <div className="flex h-9 items-center rounded border border-border bg-surface-2 px-3 text-[13px] text-muted">
          {entidades === undefined ? t('comun.cargando') : t('admin.fiscal.sin-razones')}
        </div>
      )}
      <Link href="/razones-sociales" className="mt-1 inline-block text-[11px] font-medium text-accent hover:underline">
        {t('admin.fiscal.agregar-editar')}
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
  const { t, idioma } = useIdioma()
  const faltan = CAMPOS_CONTRATO.filter(([k]) => !String(config[k] ?? '').trim()).map(([, l]) => t(l))

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
      titulo={t('admin.fiscal.titulo')}
      icono={<Scale className="h-4 w-4 text-muted" />}
      contentClassName="space-y-4"
    >
        <p className="text-[12px] text-muted">
          {interpolarNodos(t('admin.fiscal.comparece'), { parte: <b>{t('admin.fiscal.parte')}</b> })}
        </p>

        {faltan.length > 0 && (
          <div className={FRANJA_AVISO}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              {interpolarNodos(t(faltan.length === 1 ? 'admin.fiscal.falta.uno' : 'admin.fiscal.falta.otros'), { campos: <b>{faltan.join(', ')}</b> })}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campo('rfc', t('admin.fiscal.rfc'), t('admin.fiscal.rfc-ejemplo'), t('admin.fiscal.rfc-toast'))}
          {campo('representanteLegal', t('admin.fiscal.representante'), t('admin.fiscal.representante-ejemplo'), t('admin.fiscal.representante-toast'))}
        </div>
        {campo('domicilioFiscal', t('admin.fiscal.domicilio'), t('admin.fiscal.domicilio-ejemplo'), t('admin.fiscal.domicilio-toast'), true)}
        {campo('datosConstitucion', t('admin.fiscal.constitucion'),
          // La cifra entra por hueco: el diccionario no lleva cifras con miles (GUARDIA 2 de `dinero.test.ts`).
          t('admin.fiscal.constitucion-ejemplo', { escritura: formatNumero(12345, 0, idioma) }),
          t('admin.fiscal.constitucion-toast'), true)}
        <span className="-mt-1 block text-[11px] text-muted">
          {t('admin.fiscal.rfc-principal')}
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
  const t = useTexto()

  return (
    <CardColapsable
      id="admin.config.propuestas"
      titulo={t('admin.propuestas.titulo')}
      icono={<FileText className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Campo label={t('admin.propuestas.vigencia')}>
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
              if (v !== dias) void guardar({ vigenciaPropuestaDias: v }, t('admin.propuestas.vigencia-toast', { v }))
            }}
          />
        </Campo>
      </div>
      <p className="text-[11px] text-muted">
        {interpolarNodos(t('admin.propuestas.cuentan'), { envia: <b>{t('admin.propuestas.envia')}</b> })}
      </p>
      <Campo label={t('admin.propuestas.plantilla')}>
        <textarea
          className={`${inputCls} h-auto py-2`}
          rows={6}
          maxLength={8000}
          placeholder={t('admin.propuestas.sin-condiciones')}
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
            await guardar({ condicionesPropuesta: texto.trim() || null }, t('admin.propuestas.plantilla-toast'))
            setGuardando(false)
          }}
        >
          <Check className="h-3.5 w-3.5" /> {guardando ? t('admin.comun.guardando') : t('admin.propuestas.guardar')}
        </Button>
        <span className="text-[11px] text-muted">{t('admin.propuestas.se-copia')}</span>
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
  const t = useTexto()

  // El padre recarga `config` tras guardar; sin esto el input se quedaría con
  // lo que se tecleó aunque el servidor hubiera normalizado el valor.
  useEffect(() => { setBorrador(config.emailRemitente ?? '') }, [config.emailRemitente])

  const limpio = borrador.trim()
  const hayCambio = limpio !== actual

  async function aplicar(valor: string | null) {
    setGuardando(true)
    const ok = await guardar(
      { emailRemitente: valor },
      valor ? t('admin.correo.actualizado') : t('admin.correo.quitado'),
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
    if (!esEmailValido(limpio)) { setError(t('validacion.email')); return }
    setConfirmando(true)
  }

  return (
    <>
    <CardColapsable
      id="admin.config.correo-avisos"
      titulo={t('admin.correo.titulo')}
      icono={<Mail className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
        <Campo label={t('admin.correo.campo')}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder={t('admin.correo.ejemplo')}
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
              {actual && !limpio ? t('admin.comun.quitar') : actual ? t('admin.correo.actualizar') : t('admin.comun.agregar')}
            </Button>
          </div>
          {error && <span className="mt-1 block text-[11px] text-error">{error}</span>}
          <span className="mt-1 block text-[11px] text-muted">
            {t('admin.correo.ayuda')}
          </span>
        </Campo>

        {!actual && (
          <p className="flex items-start gap-1.5 rounded border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('admin.correo.sin-correo')}
          </p>
        )}
    </CardColapsable>

      {/* Fuera de la tarjeta: CardColapsable desmonta su contenido al plegar. */}
      <Modal
        open={confirmando}
        onOpenChange={(v) => { if (!guardando) setConfirmando(v) }}
        title={t('admin.correo.modal.titulo')}
        subtitle={t('admin.correo.modal.subtitulo')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={guardando} onClick={() => setConfirmando(false)}>
              {t('comun.cancelar')}
            </Button>
            <Button disabled={guardando} onClick={() => void aplicar(limpio)}>
              {guardando ? t('admin.comun.guardando') : t('admin.correo.modal.entendido')}
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
              {interpolarNodos(t('admin.correo.modal.no-desde'), {
                noDesde: <b>{t('admin.correo.modal.no-desde-palabras')}</b>,
                org: <b>{config.nombreTenant || t('admin.correo.modal.tu-organizacion')}</b>,
                respuestas: <b>{t('admin.correo.modal.respuestas')}</b>,
              })}
            </span>
          </p>

          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              {interpolarNodos(t('admin.correo.modal.dns'), { avisanos: <b>{t('admin.correo.modal.avisanos')}</b> })}
            </span>
          </p>

          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              {t('admin.correo.modal.afecta')}
            </span>
          </p>

          <p className="text-[12px] text-muted">
            {t('admin.correo.modal.revisa')}
          </p>
        </div>
      </Modal>
    </>
  )
}
