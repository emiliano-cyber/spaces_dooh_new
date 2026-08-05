'use client'

import { useEffect, useState } from 'react'
import { Lock, Unlock, Loader2, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import { estadoCambiosApi, fijarExigirReautenticacionApi } from '@/lib/data/cambios-api'

// ============================================================================
//  Control de cambios — panel del Dueño (Administración → Roles y permisos).
//
//  Es un INTERRUPTOR, no una contraseña (ADR 0009). Antes el Dueño fijaba aquí
//  una clave que todo el equipo tecleaba; se retiró porque un secreto
//  compartido no prueba identidad, y ahora cada quien reconfirma con la suya.
//  Por eso este panel ya no tiene campos de contraseña: no hay nada que fijar.
// ============================================================================

export function ControlCambiosPanel({ onToast }: { onToast: (m: string) => void }) {
  const { sesion } = useSesionCtx()
  const esDueno = sesion?.usuario?.rol === 'DUENO'
  const [activo, setActivo] = useState<boolean | null>(null)
  const [minutos, setMinutos] = useState(15)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    estadoCambiosApi()
      .then((e) => { setActivo(e.activo); setMinutos(e.minutos) })
      .catch(() => setActivo(false))
  }, [])

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
          facturación y borrar pantallas, clientes o arrendadores— pedirán que quien los hace vuelva
          a teclear <span className="text-ink">su propia contraseña</span>. El trabajo diario —crear
          campañas, subir creatividades, cerrar órdenes— sigue sin fricción.
        </p>
        <p className="text-[12px] text-muted">
          <span className="text-ink">Aplica también a ti.</span> Antes el Dueño estaba exento y una
          sesión suya olvidada abierta podía facturar sin que nadie confirmara nada. Como es tu
          propia contraseña, no hay ninguna clave nueva que recordar ni que repartir.
        </p>

        {activo === null ? (
          <div className="h-9 w-40 animate-pulse rounded bg-surface-2" />
        ) : activo ? (
          <>
            <div className="flex items-center gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-ink">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              Activo. Al teclearla, la sesión queda desbloqueada {minutos} minutos y luego se vuelve
              a pedir.
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
      </CardContent>
    </Card>
  )
}
