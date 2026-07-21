'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Building2, UserCircle2, Save } from 'lucide-react'
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
  const puedeEmpresa = usePuede('administracion', 'crear')

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Configuración</h1>
        <p className="mt-1 text-[13px] text-muted">Nombre de la empresa y datos de tu cuenta.</p>
      </div>
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
  useEffect(() => { setEmail(emailActual) }, [emailActual])

  const hayCambio = (email.trim() && email.trim().toLowerCase() !== emailActual.toLowerCase()) || password.length > 0

  async function guardar() {
    if (email.trim() && !esEmailValido(email)) { toast.error(EMAIL_INVALIDO); return }
    if (password && password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
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
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Nueva contraseña</span>
          <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Déjala en blanco para no cambiarla (mín. 6)" />
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
