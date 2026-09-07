'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const API = '/spaces-dooh/api'

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
// ============================================================================

export default function CodigosRecuperacion() {
  const router = useRouter()
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [guardados, setGuardados] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [yaTenia, setYaTenia] = useState(false)

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
      if (!r.ok) throw new Error(d?.error ?? 'No se pudieron generar')
      setCodigos(d.codigos)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(false)
    }
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

  if (yaTenia && !codigos) {
    return (
      <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '2rem 1rem' }}>
        <h1>Códigos de recuperación</h1>
        <p>
          Ya tienes tus códigos guardados. Si los perdiste, puedes generar otros: los
          anteriores dejarán de funcionar.
        </p>
        <button onClick={generar} disabled={ocupado}>
          Generar códigos nuevos
        </button>{' '}
        <button onClick={() => router.push('/inicio')} disabled={ocupado}>
          Volver
        </button>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Guarda tus códigos de recuperación</h1>

      {!codigos && (
        <>
          <p>
            Entras con Google, así que <strong>no tienes contraseña</strong> con la que
            volver. Estos códigos son la única forma de entrar si algún día pierdes el
            acceso a esa cuenta.
          </p>
          <p>Cada uno sirve <strong>una sola vez</strong>. Guárdalos donde no se pierdan.</p>
          <button onClick={generar} disabled={ocupado}>
            {ocupado ? 'Generando…' : 'Mostrar mis códigos'}
          </button>
        </>
      )}

      {codigos && (
        <>
          <p>
            <strong>Se muestran una sola vez.</strong> Cópialos o imprímelos antes de
            continuar: en cuanto salgas de esta pantalla no vuelven a mostrarse.
          </p>

          <ul
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '.4rem 1rem',
              listStyle: 'none',
              padding: '1rem',
              border: '1px solid #8886',
              borderRadius: 6,
              fontFamily: 'ui-monospace, monospace',
              fontSize: '1.05rem',
              letterSpacing: '.04em',
            }}
          >
            {codigos.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(codigos.join('\n')).then(
                () => toast.success('Copiados'),
                () => toast.error('No se pudieron copiar; cópialos a mano'),
              )
            }}
            disabled={ocupado}
          >
            Copiar
          </button>

          {/* La confirmación es un acto EXPLÍCITO. Sin esto, cerrar la pestaña
              dejaría al usuario dentro y sin códigos, creyendo que los tiene. */}
          <p style={{ marginTop: '1.5rem' }}>
            <label>
              <input
                type="checkbox"
                checked={guardados}
                onChange={(e) => setGuardados(e.target.checked)}
              />{' '}
              Ya los guardé en un lugar seguro
            </label>
          </p>

          <button onClick={confirmar} disabled={!guardados || ocupado}>
            {ocupado ? 'Guardando…' : 'Continuar'}
          </button>
        </>
      )}
    </main>
  )
}
