'use client'

import { useEffect, useState } from 'react'
import { Lock, Unlock, Loader2, ShieldCheck, KeyRound } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import {
  estadoCambiosApi,
  fijarExigirReautenticacionApi,
  fijarContrasenaCambiosApi,
} from '@/lib/data/cambios-api'
import { REGLA_PASSWORD } from '@/lib/password'

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// ============================================================================
//  Control de cambios — panel del Dueño (Administración → Roles y permisos).
//
//  Dos piezas INDEPENDIENTES (ADR 0036, que trae de vuelta lo que el ADR 0009
//  había retirado):
//   · el INTERRUPTOR — exige o no una contraseña para los cambios sensibles;
//   · la CONTRASEÑA COMPARTIDA — la que asigna el Dueño, aparte de la de login
//     de cada quien. Cualquiera de las dos desbloquea el candado; SOLO la
//     propia de cada persona sirve para tocar el acceso de un tercero
//     (`exigirReautenticacionSiempre`, en `lib/server/cambios.ts`) — la
//     compartida no prueba identidad, y eso es justo lo que ese caso necesita.
// ============================================================================

export function ControlCambiosPanel({ onToast }: { onToast: (m: string) => void }) {
  const { sesion } = useSesionCtx()
  const esDueno = sesion?.usuario?.rol === 'DUENO'
  const [activo, setActivo] = useState<boolean | null>(null)
  const [minutos, setMinutos] = useState(15)
  const [tieneContrasena, setTieneContrasena] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editando, setEditando] = useState(false)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [guardandoPass, setGuardandoPass] = useState(false)
  const [errorPass, setErrorPass] = useState<string | null>(null)

  const refrescar = () =>
    estadoCambiosApi()
      .then((e) => { setActivo(e.activo); setMinutos(e.minutos); setTieneContrasena(e.tieneContrasenaCompartida) })
      .catch(() => setActivo(false))

  useEffect(() => { void refrescar() }, [])

  async function guardarContrasena() {
    setErrorPass(null)
    if (pass !== pass2) { setErrorPass('Las dos contraseñas no coinciden'); return }
    setGuardandoPass(true)
    try {
      await fijarContrasenaCambiosApi(pass)
      setPass('')
      setPass2('')
      setEditando(false)
      onToast(tieneContrasena ? 'Contraseña de cambios actualizada' : 'Contraseña de cambios asignada')
      await refrescar()
    } catch (e) {
      setErrorPass(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setGuardandoPass(false)
  }

  // Solo el Dueño lo administra: para los demás el panel no aplica.
  if (!esDueno) return null

  async function cambiar(siguiente: boolean) {
    if (
      siguiente &&
      !window.confirm(
        'A partir de ahora, TODOS —tú incluido— tendrán que volver a teclear su propia contraseña para los cambios que mueven dinero o el catálogo. ¿Activar?',
      )
    ) {
      return
    }
    if (
      !siguiente &&
      !window.confirm('¿Desactivar? Los cambios sensibles dejarán de pedir contraseña a nadie.')
    ) {
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await fijarExigirReautenticacionApi(siguiente)
      setActivo(siguiente)
      onToast(siguiente ? 'Control de cambios activado' : 'Control de cambios desactivado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
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
          Actívalo y los cambios que mueven dinero o el catálogo —tarifas, rentas, contratos, pagos,
          facturación y borrar pantallas, clientes o arrendadores— pedirán una contraseña: la propia
          de quien los hace, o la que asignes aquí abajo para todo el equipo. El trabajo diario —crear
          campañas, subir creatividades, cerrar órdenes— sigue sin fricción.
        </p>
        <p className="text-[12px] text-muted">
          <span className="text-ink">Aplica también a ti.</span> Antes el Dueño estaba exento y una
          sesión suya olvidada abierta podía facturar sin que nadie confirmara nada.
        </p>

        {activo === null ? (
          <div className="h-9 w-40 animate-pulse rounded bg-surface-2" />
        ) : activo ? (
          <>
            <div className="flex items-center gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-ink">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              Activo. Al teclear una contraseña válida, la sesión queda desbloqueada {minutos} minutos
              y luego se vuelve a pedir.
            </div>
            <Button size="sm" variant="secondary" onClick={() => cambiar(false)} disabled={enviando}>
              {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Desactivar el control
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => cambiar(true)} disabled={enviando}>
            {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Activar el control de cambios
          </Button>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}

        <div className="space-y-2 border-t border-border pt-3">
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            Contraseña del control de cambios
          </p>
          <p className="text-[12px] text-muted">
            Independiente de la contraseña de acceso de cada persona. Sirve para desbloquear cambios
            sensibles, pero <b>no</b> para restablecer la contraseña de otra persona — eso siempre
            exige la contraseña propia de quien lo hace.
          </p>

          {!editando ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted">
                {tieneContrasena ? 'Ya hay una contraseña asignada.' : 'Todavía no se ha asignado ninguna.'}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {tieneContrasena ? 'Cambiarla' : 'Asignar contraseña'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">
                  Contraseña nueva ({REGLA_PASSWORD})
                </span>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className={inputCls}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Repetirla</span>
                <input
                  type="password"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  className={inputCls}
                  autoComplete="off"
                />
              </label>
              {errorPass && <p className="text-[12px] text-error">{errorPass}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={guardarContrasena}
                  disabled={guardandoPass || !pass || !pass2}
                >
                  {guardandoPass && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setEditando(false); setPass(''); setPass2(''); setErrorPass(null) }}
                  disabled={guardandoPass}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
