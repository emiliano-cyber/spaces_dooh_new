'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, LogIn, ArrowRight } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import {
  USUARIOS_DEMO,
  landingDeRol,
  useIniciarSesion,
  type UsuarioDemo,
} from '@/lib/data/client'

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function LoginPage() {
  const router = useRouter()
  const iniciarSesion = useIniciarSesion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function entrar(usuario: UsuarioDemo) {
    iniciarSesion(usuario)
    router.push(landingDeRol(usuario.rol))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const u = USUARIOS_DEMO.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u) {
      setError('Usuario no encontrado. Usa uno de los accesos rápidos de abajo.')
      return
    }
    entrar(u)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
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

          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="tu@billboardsperu.pe"
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
            <Button type="submit" className="w-full">
              <LogIn className="h-4 w-4" /> Entrar
            </Button>
          </form>
        </div>

        {/* Acceso rápido (demo) */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            Acceso rápido (demo)
          </p>
          <ul className="space-y-1.5">
            {USUARIOS_DEMO.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => entrar(u)}
                  className={cn(
                    'group flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{u.nombre}</span>
                    <span className="block text-[11px] text-muted">{u.cargo}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-[11px] text-muted">
            Demo · cualquier contraseña funciona
          </p>
        </div>
      </div>
    </div>
  )
}
