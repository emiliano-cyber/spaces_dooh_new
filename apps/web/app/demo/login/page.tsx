'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, LogIn } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { apiLogin } from '@/lib/auth-real'
import { landingDeRol } from '@/lib/data/client'

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Accesos rápidos: usuarios sembrados por bootstrap-auth (contraseña spaces123).
const ACCESOS = [
  { nombre: 'Cliente_ RGB Catorce', email: 'jose@pixeled.com.mx', cargo: 'Dueño' },
  { nombre: 'Carlos Mendoza', email: 'carlos@billboardsperu.pe', cargo: 'Comercial' },
  { nombre: 'Luis Paredes', email: 'luis@billboardsperu.pe', cargo: 'Operaciones' },
  { nombre: 'Andrea Salas', email: 'andrea@billboardsperu.pe', cargo: 'Finanzas' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(mail: string, pass: string) {
    setEnviando(true)
    setError(null)
    try {
      const { usuario } = await apiLogin(mail.trim(), pass)
      router.push(landingDeRol(usuario.rol))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-accent text-accent-fg">
            <Radio className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold text-ink">Spaces</div>
            <div className="text-[11px] text-muted">Billboards Perú SA</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <h1 className="text-base font-semibold text-ink">Iniciar sesión</h1>
          <p className="mt-0.5 text-[12px] text-muted">Accede con tu cuenta.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              entrar(email, password)
            }}
            className="mt-4 space-y-3"
          >
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink">Contraseña</span>
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            {error && <p className="text-[12px] text-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={enviando || !email || !password}>
              <LogIn className="h-4 w-4" /> {enviando ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        {/* Acceso rápido (usuarios de prueba sembrados) */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            Acceso rápido (prueba · contraseña spaces123)
          </p>
          <ul className="space-y-1.5">
            {ACCESOS.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => entrar(u.email, 'spaces123')}
                  className="group flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{u.nombre}</span>
                    <span className="block text-[11px] text-muted">{u.cargo}</span>
                  </span>
                  <LogIn className="h-4 w-4 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
