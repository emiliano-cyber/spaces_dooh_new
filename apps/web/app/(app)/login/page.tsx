'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, UserPlus, Mail, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
import { apiLogin } from '@/lib/auth-real'
import { landingDeRol } from '@/lib/data/client'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

type Modo = 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizacion, setOrganizacion] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enlaceDev, setEnlaceDev] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const esSignup = modo === 'signup'
  const esForgot = modo === 'forgot'

  function cambiarModo(m: Modo) {
    setModo(m)
    setError(null)
    setAviso(null)
    setEnlaceDev(null)
  }

  async function entrar(mail: string, pass: string) {
    const { usuario } = await apiLogin(mail.trim(), pass)
    router.push(landingDeRol(usuario.rol))
  }

  async function onSubmit() {
    setError(null)
    setAviso(null)
    // Recuperar contraseña: envía el enlace y muestra un aviso genérico.
    if (esForgot) {
      if (!esEmailValido(email)) { setError(EMAIL_INVALIDO); return }
      setEnviando(true)
      try {
        const r = await fetch('/spaces-dooh/api/auth/forgot/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo enviar el enlace')
        setAviso((d as { mensaje?: string }).mensaje ?? 'Si el correo está registrado, te enviamos un enlace.')
        setEnlaceDev((d as { enlaceDev?: string }).enlaceDev ?? null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo enviar el enlace')
      }
      setEnviando(false)
      return
    }

    if (esSignup && !esEmailValido(email)) { setError(EMAIL_INVALIDO); return }
    setEnviando(true)
    try {
      if (esSignup) {
        const r = await fetch('/spaces-dooh/api/signup/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizacion: organizacion.trim(), nombre: nombre.trim(), email: email.trim(), password }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo crear la cuenta')
      }
      await entrar(email, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : esSignup ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión')
      setEnviando(false)
    }
  }

  const puedeEnviar = esForgot
    ? !!email.trim()
    : esSignup
      ? organizacion.trim() && nombre.trim() && email.trim() && password.trim().length >= 6
      : email && password

  const titulo = esSignup ? 'Crear cuenta' : esForgot ? 'Recuperar contraseña' : 'Iniciar sesión'
  const subtitulo = esSignup
    ? 'Registra tu organización y tu usuario. Tendrás tu propio CRM.'
    : esForgot
      ? 'Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.'
      : 'Accede con tu cuenta.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <SpaceOsMark className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <div className="demo-wordmark text-lg text-ink">Space OS</div>
            <div className="text-[11px] text-muted">RGB Catorce S de RL de CV (PIXELED)</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <h1 className="text-base font-semibold text-ink">{titulo}</h1>
          <p className="mt-0.5 text-[12px] text-muted">{subtitulo}</p>

          {aviso ? (
            <div className="mt-4 space-y-2 rounded-md border border-[#10b98133] bg-[#10b9810d] p-3 text-[12px]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7a55]" />
                <span className="text-ink">{aviso}</span>
              </div>
              {enlaceDev && (
                <div className="border-t border-[#10b98133] pt-2">
                  <div className="mb-1 text-[11px] font-medium text-muted">Enlace (solo en desarrollo):</div>
                  <a href={enlaceDev} className="break-all text-[11px] font-medium text-info hover:underline">{enlaceDev}</a>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
              }}
              className="mt-4 space-y-3"
            >
              {esSignup && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-ink">Organización</span>
                    <input className={inputCls} value={organizacion} onChange={(e) => setOrganizacion(e.target.value)} placeholder="Ej. Media Norte" autoFocus />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-ink">Tu nombre</span>
                    <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Ana López" />
                  </label>
                </>
              )}
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoFocus={!esSignup}
                />
              </label>
              {!esForgot && (
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink">Contraseña</span>
                  <input
                    type="password"
                    className={inputCls}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={esSignup ? 'mínimo 6 caracteres' : '••••••••'}
                  />
                </label>
              )}
              {error && <p className="text-[12px] text-error">{error}</p>}
              <Button type="submit" className="w-full" disabled={enviando || !puedeEnviar}>
                {esSignup ? <UserPlus className="h-4 w-4" /> : esForgot ? <Mail className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {enviando
                  ? esSignup ? 'Creando cuenta…' : esForgot ? 'Enviando…' : 'Entrando…'
                  : esSignup ? 'Crear cuenta' : esForgot ? 'Enviar enlace' : 'Entrar'}
              </Button>

              {/* Enlace a recuperar contraseña (solo en login) */}
              {modo === 'login' && (
                <div className="text-center">
                  <button type="button" onClick={() => cambiarModo('forgot')} className="text-[12px] text-muted hover:text-info hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Cambios de modo */}
          <div className="mt-3 text-center text-[12px] text-muted">
            {esForgot ? (
              <button type="button" onClick={() => cambiarModo('login')} className="hover:underline">
                ← Volver a <span className="font-medium text-info">iniciar sesión</span>
              </button>
            ) : (
              <button type="button" onClick={() => cambiarModo(esSignup ? 'login' : 'signup')} className="hover:underline">
                {esSignup ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
                <span className="font-medium text-info">{esSignup ? 'Iniciar sesión' : 'Crear cuenta'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
