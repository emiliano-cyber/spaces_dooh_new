'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Campo } from '@/components/demo/ui/Campo'
import { FRANJA_AVISO } from '@/components/demo/admin/Chip'

const API = '/spaces-dooh/api'
const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// ============================================================================
//  La pantalla que enseña los códigos de recuperación.  (ADR 0028 · B2)
// ----------------------------------------------------------------------------
//  Es la única vez que estos códigos existen fuera de la base de datos, y van
//  del servidor a los ojos de su dueño y a ningún otro sitio. Con el ADR 0028 el
//  Dueño entra SOLO con Google: si pierde esa cuenta, esto es lo único que le
//  queda.
//
//  ─── Lo que hay que hacer bien aquí, y es donde esto se hace mal ──────────
//  Enseñar el secreto y dejar que el usuario navegue es cómo se pierde. Por eso
//  la pantalla EXIGE una confirmación explícita: hasta que la marca, el servidor
//  sigue cortando (`exigir()`), y por tanto no hay nada útil que pueda hacer.
//
//  Y por eso los códigos NO se piden al montar: se piden cuando él lo pide. Si
//  se generaran solos al abrir la pantalla, un usuario que llega aquí por error
//  invalidaría los que ya tenía guardados sin haber hecho nada.
//
//  ─── B6 · regenerar es otra cosa, y el servidor lo distingue ──────────────
//  Pedir el PRIMER lote no lleva contraseña; pedir OTRO sí, porque invalida en
//  silencio los que su dueño tiene en papel. Esta pantalla no decide cuál es
//  cuál —eso lo decide el servidor—: se limita a reaccionar al 403 con
//  `requiereDesbloqueo` pidiendo la contraseña y reintentando. Duplicar aquí la
//  regla sería tener dos fuentes de verdad, y la del navegador es la que no
//  manda.
// ============================================================================

export default function CodigosRecuperacion() {
  const router = useRouter()
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [guardados, setGuardados] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [yaTenia, setYaTenia] = useState(false)
  const [pidePassword, setPidePassword] = useState(false)
  const [password, setPassword] = useState('')

  // Si llega alguien que ya los confirmó, no tiene nada que hacer aquí.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch(`${API}/auth/me/`)
        const d = await r.json().catch(() => ({}))
        if (vivo && r.ok && d?.usuario && !d.usuario.debeGuardarCodigos) setYaTenia(true)
      } catch {
        /* si esto falla, la pantalla sigue siendo utilizable */
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  async function generar() {
    setOcupado(true)
    try {
      const r = await fetch(`${API}/perfil/codigos-recuperacion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const d = await r.json().catch(() => ({}))
      // El servidor pide la contraseña para regenerar. No es un error que
      // enseñar en rojo: es un paso más, y se pide en el sitio.
      if (r.status === 403 && d?.requiereDesbloqueo) {
        setPidePassword(true)
        return
      }
      if (!r.ok) throw new Error(d?.error ?? 'No se pudieron generar')
      setCodigos(d.codigos)
      setPidePassword(false)
      setPassword('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  /** Teclea la contraseña, desbloquea esta sesión y reintenta. */
  async function desbloquearYGenerar(ev: React.FormEvent) {
    ev.preventDefault()
    setOcupado(true)
    try {
      const r = await fetch(`${API}/cambios/desbloquear/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error ?? 'No se pudo verificar la contraseña')
    } catch (e) {
      toast.error((e as Error).message)
      setOcupado(false)
      return
    }
    setOcupado(false)
    await generar()
  }

  async function confirmar() {
    setOcupado(true)
    try {
      const r = await fetch(`${API}/perfil/codigos-recuperacion/?ya=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!r.ok) throw new Error('No se pudo confirmar')
      // Recarga completa y no `router.push`: la sesión que tiene el cliente en
      // memoria dice todavía que faltan los códigos, y con ella el guard de la
      // interfaz lo devolvería aquí en cuanto navegara.
      window.location.href = '/spaces-dooh/inicio/'
    } catch (e) {
      toast.error((e as Error).message)
      setOcupado(false)
    }
  }

  // ─── Solo presentación (rediseño del 26/10) ────────────────────────────────
  // Hasta aquí, ni una línea cambió: el «no generar al montar», el reintento
  // tras desbloquear, la casilla que habilita «Continuar» y la recarga
  // completa son los de siempre. Lo de abajo solo los PINTA con las piezas de
  // la app (Card, Button, Campo, tokens) en vez de HTML sin estilo, donde los
  // botones nativos se leían como texto plano y la advertencia más seria del
  // sistema pesaba lo mismo que el resto del párrafo.
  //
  // `Card` y no `CardColapsable`: es un paso obligado y no debe poder
  // plegarse. Y sin botones de Descargar/Imprimir aunque los tengan GitHub y
  // Google: serían una función nueva, no presentación (queda para el dueño).
  if (yaTenia && !codigos) {
    return (
      <main className="mx-auto w-full max-w-xl space-y-4">
        <div>
          <h1 className="text-2xl text-ink">Códigos de recuperación</h1>
          <p className="mt-1 text-[13px] text-muted">Tu forma de volver a entrar si algún día pierdes el acceso a tu cuenta.</p>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-4">
            <p className="m-0 text-[13px] text-ink">
              Ya tienes tus códigos guardados. Si los perdiste, puedes generar otros: los
              anteriores dejarán de funcionar.
            </p>
            {!pidePassword && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={generar} disabled={ocupado}>
                  <RefreshCw className="h-3.5 w-3.5" /> Generar códigos nuevos
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push('/inicio')} disabled={ocupado}>
                  Volver
                </Button>
              </div>
            )}

            {pidePassword && (
              <form onSubmit={desbloquearYGenerar} className="space-y-3">
                <p className={FRANJA_AVISO}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>
                    Teclea tu contraseña para confirmar. Los códigos que tengas guardados
                    <strong> dejarán de funcionar</strong> en cuanto se generen los nuevos.
                  </span>
                </p>
                <Campo label="Tu contraseña">
                  <input
                    type="password"
                    className={inputCls}
                    value={password}
                    autoFocus
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                  />
                </Campo>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" type="submit" disabled={!password || ocupado}>
                    {ocupado ? 'Verificando…' : 'Confirmar y generar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setPidePassword(false)
                      setPassword('')
                    }}
                    disabled={ocupado}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Guarda tus códigos de recuperación</h1>
        <p className="mt-1 text-[13px] text-muted">Tu forma de volver a entrar si algún día pierdes el acceso a tu cuenta.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-4">
          {!codigos && (
            <>
              <p className="m-0 text-[13px] text-ink">
                Entras con Google, así que <strong>no tienes contraseña</strong> con la que
                volver. Estos códigos son la única forma de entrar si algún día pierdes el
                acceso a esa cuenta.
              </p>
              <p className="m-0 text-[13px] text-ink">Cada uno sirve <strong>una sola vez</strong>. Guárdalos donde no se pierdan.</p>
              <Button size="sm" onClick={generar} disabled={ocupado}>
                <KeyRound className="h-3.5 w-3.5" /> {ocupado ? 'Generando…' : 'Mostrar mis códigos'}
              </Button>
            </>
          )}

          {codigos && (
            <>
              <p className={FRANJA_AVISO}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>
                  <strong>Se muestran una sola vez.</strong> Cópialos o imprímelos antes de
                  continuar: en cuanto salgas de esta pantalla no vuelven a mostrarse.
                </span>
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-ink">Tus {codigos.length} códigos</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(codigos.join('\n')).then(
                        () => toast.success('Copiados'),
                        () => toast.error('No se pudieron copiar; cópialos a mano'),
                      )
                    }}
                    disabled={ocupado}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                <ol className="m-0 grid list-none grid-cols-1 gap-2 rounded-md border border-border-strong bg-surface-2 p-4 sm:grid-cols-2">
                  {codigos.map((c, i) => (
                    <li key={c} className="flex items-baseline gap-2">
                      <span className="demo-num w-5 shrink-0 text-right text-[11px] text-muted">{i + 1}</span>
                      <span className="demo-num select-all text-[15px] tracking-wider text-ink">{c}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* La confirmación es un acto EXPLÍCITO. Sin esto, cerrar la pestaña
                  dejaría al usuario dentro y sin códigos, creyendo que los tiene.
                  Va como bloque con borde, como las opciones de acceso de
                  Administración, para que no se pase por alto. */}
              <label
                className={`flex cursor-pointer items-start gap-2 rounded border p-3 text-[13px] text-ink ${guardados ? 'border-accent bg-bg' : 'border-border'}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={guardados}
                  onChange={(e) => setGuardados(e.target.checked)}
                />
                Ya los guardé en un lugar seguro
              </label>

              <Button onClick={confirmar} disabled={!guardados || ocupado}>
                {ocupado ? 'Guardando…' : 'Continuar'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
