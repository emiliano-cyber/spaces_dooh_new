'use client'

import { useEffect, useState } from 'react'
import { Lock, Unlock, Loader2, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import { estadoCambiosApi, fijarPasswordCambiosApi } from '@/lib/data/cambios-api'

// ============================================================================
//  Control de cambios — panel del Dueño (Administración → Roles y permisos).
//  El Dueño pone una contraseña; los demás roles la necesitan para los cambios
//  sensibles (dinero y catálogo). Apagado por defecto.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function ControlCambiosPanel({ onToast }: { onToast: (m: string) => void }) {
  const { sesion } = useSesionCtx()
  const esDueno = sesion?.usuario?.rol === 'DUENO'
  const [activo, setActivo] = useState<boolean | null>(null)
  const [minutos, setMinutos] = useState(15)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    estadoCambiosApi()
      .then((e) => { setActivo(e.activo); setMinutos(e.minutos) })
      .catch(() => setActivo(false))
  }, [])

  // Solo el Dueño administra su llave: para los demás el panel no aplica.
  if (!esDueno) return null

  async function guardar() {
    setError(null)
    if (pass !== pass2) return setError('Las dos contraseñas no coinciden')
    setEnviando(true)
    try {
      await fijarPasswordCambiosApi(pass)
      setActivo(true)
      setPass(''); setPass2('')
      onToast('Control de cambios activado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setEnviando(false)
  }

  async function quitar() {
    if (!window.confirm('¿Quitar la contraseña? Los demás roles podrán hacer cambios sin pedirla.')) return
    setEnviando(true)
    setError(null)
    try {
      await fijarPasswordCambiosApi(null)
      setActivo(false)
      onToast('Control de cambios desactivado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar')
    }
    setEnviando(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {activo ? <Lock className="h-4 w-4 text-success" /> : <Unlock className="h-4 w-4 text-muted" />}
          Control de cambios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-muted">
          Pon una contraseña y los demás roles tendrán que teclearla para los cambios que mueven
          dinero o el catálogo: tarifas, rentas, contratos, pagos, facturación y borrar pantallas,
          clientes o arrendadores. El trabajo diario —crear campañas, subir creatividades, cerrar
          órdenes— sigue sin fricción. <span className="text-ink">Tú nunca la necesitas.</span>
        </p>

        {activo === null ? (
          <div className="h-9 w-40 animate-pulse rounded bg-surface-2" />
        ) : activo ? (
          <>
            <div className="flex items-center gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-ink">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              Activo. Al teclearla, un rol queda desbloqueado {minutos} minutos y luego se le vuelve a pedir.
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Cambiar la contraseña</span>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className={inputCls} placeholder="Nueva contraseña" autoComplete="new-password" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Repetirla</span>
                <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} className={inputCls} autoComplete="new-password" />
              </label>
            </div>
            <p className="text-[11px] text-muted">
              Al cambiarla, quien esté desbloqueado ahora deja de estarlo y tendrá que usar la nueva.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={guardar} disabled={enviando || !pass}>
                {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cambiar contraseña
              </Button>
              <Button size="sm" variant="secondary" onClick={quitar} disabled={enviando}>
                Quitar el control
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Contraseña</span>
                <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className={inputCls} placeholder="Mínimo 8, con letra y número" autoComplete="new-password" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Repetirla</span>
                <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} className={inputCls} autoComplete="new-password" />
              </label>
            </div>
            <Button size="sm" onClick={guardar} disabled={enviando || !pass}>
              {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Activar el control de cambios
            </Button>
          </>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}
      </CardContent>
    </Card>
  )
}
