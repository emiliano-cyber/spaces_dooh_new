'use client'

import { puedeVerControlCambios } from '@/lib/roles'
import { useEffect, useState } from 'react'
import { Lock, Unlock, Loader2, ShieldCheck, KeyRound } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import {
  estadoCambiosApi,
  fijarExigirReautenticacionApi,
  fijarContrasenaCambiosApi,
} from '@/lib/data/cambios-api'
import { TONO } from './Chip'
import { useTexto } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'

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
  const t = useTexto()
  // El Dueño y el ADMINISTRADOR (29/09). La regla vive en `lib/roles.ts` con su
  // prueba: dentro de este `.tsx` no la comprobaría nada.
  const puedeVerlo = puedeVerControlCambios(sesion?.usuario?.rol)
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
  // OBLIG-01 · las dos, como ya exigía el botón: sin la repetición no se puede
  // comprobar que la contraseña nueva es la que se quiso escribir.
  const ob = useObligatorios({ pass, pass2 }, ['pass', 'pass2'])

  const refrescar = () =>
    estadoCambiosApi()
      .then((e) => { setActivo(e.activo); setMinutos(e.minutos); setTieneContrasena(e.tieneContrasenaCompartida) })
      .catch(() => setActivo(false))

  useEffect(() => { void refrescar() }, [])

  async function guardarContrasena() {
    setErrorPass(null)
    if (!ob.validar()) return
    if (pass !== pass2) { setErrorPass(t('admin.cambios.no-coinciden')); return }
    setGuardandoPass(true)
    try {
      await fijarContrasenaCambiosApi(pass)
      setPass('')
      setPass2('')
      ob.reiniciar()
      setEditando(false)
      onToast(tieneContrasena ? t('admin.cambios.toast.actualizada') : t('admin.cambios.toast.asignada'))
      await refrescar()
    } catch (e) {
      setErrorPass(e instanceof Error ? e.message : t('admin.comun.no-se-pudo-guardar'))
    }
    setGuardandoPass(false)
  }

  // Solo el Dueño lo administra: para los demás el panel no aplica.
  if (!puedeVerlo) return null

  async function cambiar(siguiente: boolean) {
    if (
      siguiente &&
      !window.confirm(t('admin.cambios.confirmar-activar'))
    ) {
      return
    }
    if (
      !siguiente &&
      !window.confirm(t('admin.cambios.confirmar-desactivar'))
    ) {
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await fijarExigirReautenticacionApi(siguiente)
      setActivo(siguiente)
      onToast(siguiente ? t('admin.cambios.toast.activado') : t('admin.cambios.toast.desactivado'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.comun.no-se-pudo-guardar'))
    }
    setEnviando(false)
  }

  return (
    // La contraseña a medio teclear vive en el estado de este componente, no
    // en el contenido: plegar no la borra.
    <CardColapsable
      id="admin.control-cambios"
      titulo={t('admin.cambios.titulo')}
      icono={activo ? <Lock className="h-4 w-4 text-success" /> : <Unlock className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
        <p className="text-[13px] text-muted">
          {t('admin.cambios.explica')}
        </p>
        <p className="text-[12px] text-muted">
          <span className="text-ink">{t('admin.cambios.aplica-a-ti')}</span> {t('admin.cambios.antes-exento')}
        </p>

        {activo === null ? (
          <div className="h-9 w-40 animate-pulse rounded bg-surface-2" />
        ) : activo ? (
          <>
            <div className={`flex items-center gap-2 rounded border px-3 py-2 text-[12px] ${TONO.exito}`}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              {t('admin.cambios.activo', { minutos })}
            </div>
            <Button size="sm" variant="secondary" onClick={() => cambiar(false)} disabled={enviando}>
              {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('admin.cambios.desactivar')}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => cambiar(true)} disabled={enviando}>
            {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('admin.cambios.activar')}
          </Button>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}

        <div className="space-y-2 border-t border-border pt-3">
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            {t('admin.cambios.contrasena')}
          </p>
          <p className="text-[12px] text-muted">
            {interpolarNodos(t('admin.cambios.independiente'), { no: <b>{t('admin.cambios.no')}</b> })}
          </p>

          {!editando ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted">
                {tieneContrasena ? t('admin.cambios.ya-hay') : t('admin.cambios.ninguna')}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {tieneContrasena ? t('admin.cambios.cambiarla') : t('admin.cambios.asignar')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Campo label={t('admin.cambios.nueva', { regla: t('password.regla') })} obligatorio falta={ob.falta('pass')}>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className={inputCls}
                  autoComplete="off"
                />
              </Campo>
              <Campo label={t('admin.cambios.repetirla')} obligatorio falta={ob.falta('pass2')}>
                <input
                  type="password"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  className={inputCls}
                  autoComplete="off"
                />
              </Campo>
              {errorPass && <p className="text-[12px] text-error">{errorPass}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={guardarContrasena}
                  disabled={guardandoPass}
                >
                  {guardandoPass && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('comun.guardar')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setEditando(false); setPass(''); setPass2(''); setErrorPass(null); ob.reiniciar() }}
                  disabled={guardandoPass}
                >
                  {t('comun.cancelar')}
                </Button>
              </div>
            </div>
          )}
        </div>
    </CardColapsable>
  )
}
