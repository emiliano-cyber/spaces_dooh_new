'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Building2, UserCircle2, Save, KeyRound } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { useConfigNegocio } from '@/lib/data/client'
import { refrescarEstado } from '@/lib/data/estado-api'
import { useSesionCtx, usePuede } from '@/components/demo/shell/SesionContext'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'

const API = '/spaces-dooh/api'
const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function ConfiguracionPage() {
  const config = useConfigNegocio()
  const { sesion } = useSesionCtx()
  // Mismo criterio que el servidor (`/api/organizacion`): renombrar la empresa
  // es exclusivo del Dueño, por ROL y no por permiso. Si aquí se usara solo
  // `usePuede`, un rol con `administracion.crear` concedido vería el formulario
  // y recibiría un 403 al guardar.
  const puedeEmpresa = usePuede('administracion', 'crear') && sesion?.usuario.rol === 'DUENO'

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Configuración</h1>
        <p className="mt-1 text-[13px] text-muted">
          {puedeEmpresa ? 'Nombre de la empresa y datos de tu cuenta.' : 'Cambia el correo y la contraseña de tu cuenta.'}
        </p>
      </div>

      {/* Con una contraseña temporal el servidor cierra el resto de la
          aplicación (ADR 0009) y el usuario acaba aquí redirigido. Sin este
          aviso llegaba sin saber por qué se le había cerrado todo. */}
      {sesion?.usuario.debeCambiarPassword && (
        <div className="flex items-start gap-2 rounded border border-[#f59e0b40] bg-warning-soft px-3 py-2.5 text-[13px] text-[#9a6700]">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Tu contraseña es temporal.</b> Cámbiala aquí abajo para volver a entrar al
            resto del sistema. Mientras tanto los demás módulos están cerrados, por
            seguridad: una contraseña temporal la conoce quien te la entregó.
          </span>
        </div>
      )}
      {/* La configuración del negocio (empresa, IVA, loop, plazos…) es solo del
          Dueño; los demás perfiles solo ven "Mi cuenta" (correo + contraseña). */}
      {puedeEmpresa && <EmpresaCard nombreActual={config?.nombreTenant ?? ''} />}
      <CuentaCard emailActual={sesion?.usuario.email ?? ''} />
    </div>
  )
}

function EmpresaCard({ nombreActual }: { nombreActual: string }) {
  const [nombre, setNombre] = useState(nombreActual)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setNombre(nombreActual) }, [nombreActual])

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre de la empresa es requerido'); return }
    setBusy(true)
    try {
      const r = await fetch(`${API}/organizacion/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo guardar')
      await refrescarEstado() // refresca el sidebar con el nuevo nombre
      toast.success('Nombre de la empresa actualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Building2 className="h-4 w-4 text-muted" />
        <CardTitle>Empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] text-muted">Este nombre aparece en el menú de la izquierda.</p>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Nombre de la empresa</span>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <Button size="sm" disabled={busy || !nombre.trim() || nombre.trim() === nombreActual} onClick={guardar}>
          <Save className="h-3.5 w-3.5" /> {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </CardContent>
    </Card>
  )
}

function CuentaCard({ emailActual }: { emailActual: string }) {
  const [email, setEmail] = useState(emailActual)
  const [password, setPassword] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  const [busy, setBusy] = useState(false)
  // Para volver a leer la sesión tras guardar. Sin esto, quien acaba de salir de
  // una contraseña temporal se quedaba encerrado IGUAL: el servidor ya le abría
  // todo, pero la sesión del cliente seguía diciendo «temporal» —se leyó al
  // montar— y la compuerta lo devolvía aquí una y otra vez.
  const { refrescar } = useSesionCtx()
  useEffect(() => { setEmail(emailActual) }, [emailActual])

  const cambiaEmail = !!email.trim() && email.trim().toLowerCase() !== emailActual.toLowerCase()
  const hayCambio = cambiaEmail || password.length > 0

  async function guardar() {
    if (cambiaEmail && !esEmailValido(email)) { toast.error(EMAIL_INVALIDO); return }
    if (password && password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return }
    // Cambiar correo o contraseña exige la contraseña actual (re-autenticación).
    if (!passwordActual) { toast.error('Ingresa tu contraseña actual para confirmar'); return }
    setBusy(true)
    try {
      const r = await fetch(`${API}/perfil/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password || undefined, passwordActual }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo guardar')
      setPassword('')
      setPasswordActual('')
      // Releer la sesión ANTES del aviso: si venía con temporal, esto es lo que
      // baja la bandera y le devuelve el acceso al resto del sistema.
      await refrescar()
      toast.success('Cuenta actualizada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <UserCircle2 className="h-4 w-4 text-muted" />
        <CardTitle>Mi cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] text-muted">Cambia tu correo y/o contraseña. Solo afecta a tu cuenta.</p>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Nueva contraseña</span>
          <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Déjala en blanco para no cambiarla (mín. 8)" autoComplete="new-password" />
        </label>
        {hayCambio && (
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Contraseña actual <span className="text-muted">(para confirmar)</span></span>
            <input type="password" className={inputCls} value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} placeholder="Tu contraseña actual" autoComplete="current-password" />
          </label>
        )}
        <Button size="sm" disabled={busy || !hayCambio} onClick={guardar}>
          <Save className="h-3.5 w-3.5" /> {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </CardContent>
    </Card>
  )
}
