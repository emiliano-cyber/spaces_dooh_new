'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, LogIn, UserPlus } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { apiLogin } from '@/lib/auth-real'
import { landingDeRol } from '@/lib/data/client'

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizacion, setOrganizacion] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const esSignup = modo === 'signup'

  async function entrar(mail: string, pass: string) {
    const { usuario } = await apiLogin(mail.trim(), pass)
    router.push(landingDeRol(usuario.rol))
  }

  async function onSubmit() {
    setEnviando(true)
    setError(null)
    try {
      if (esSignup) {
        // Crea la cuenta (organización + usuario Dueño) y entra automáticamente.
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

  const puedeEnviar = esSignup
    ? organizacion.trim() && nombre.trim() && email.trim() && password.trim().length >= 6
    : email && password

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-accent text-accent-fg">
            <Radio className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold text-ink">Spaces</div>
            <div className="text-[11px] text-muted">RGB Catorce S de RL de CV (PIXELED)</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <h1 className="text-base font-semibold text-ink">{esSignup ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {esSignup ? 'Registra tu organización y tu usuario. Tendrás tu propio CRM.' : 'Accede con tu cuenta.'}
          </p>

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
            {error && <p className="text-[12px] text-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={enviando || !puedeEnviar}>
              {esSignup ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {enviando ? (esSignup ? 'Creando cuenta…' : 'Entrando…') : esSignup ? 'Crear cuenta' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-3 text-center text-[12px] text-muted">
            <button
              type="button"
              onClick={() => { setModo(esSignup ? 'login' : 'signup'); setError(null) }}
              className="hover:underline"
            >
              {esSignup ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
              <span className="font-medium text-info">{esSignup ? 'Iniciar sesión' : 'Crear cuenta'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
