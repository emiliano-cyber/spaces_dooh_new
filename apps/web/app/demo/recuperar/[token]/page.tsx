'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function RecuperarPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const token = params.token
  const [estado, setEstado] = useState<'validando' | 'valido' | 'invalido' | 'listo'>('validando')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Verifica el token al cargar para decidir si mostramos el formulario.
  useEffect(() => {
    let vivo = true
    fetch(`/spaces-dooh/api/auth/reset/?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => { if (vivo) setEstado(d?.valido ? 'valido' : 'invalido') })
      .catch(() => { if (vivo) setEstado('invalido') })
    return () => { vivo = false }
  }, [token])

  async function onSubmit() {
    setError(null)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }
    setEnviando(true)
    try {
      const r = await fetch('/spaces-dooh/api/auth/reset/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo restablecer la contraseña')
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restablecer la contraseña')
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <SpaceOsMark className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <div className="demo-wordmark text-lg text-ink">Space OS</div>
            <div className="text-[11px] text-muted">Restablecer contraseña</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          {estado === 'validando' ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando el enlace…
            </div>
          ) : estado === 'invalido' ? (
            <div>
              <div className="flex items-start gap-2 rounded-md border border-[#ef444440] bg-[#ef44440d] p-3 text-[12px]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <div>
                  <div className="font-medium text-ink">Enlace inválido o expirado</div>
                  <div className="text-muted">El enlace ya se usó o venció. Solicita uno nuevo desde el login.</div>
                </div>
              </div>
              <Button className="mt-4 w-full" variant="secondary" onClick={() => router.push('/demo/login')}>
                Ir a iniciar sesión
              </Button>
            </div>
          ) : estado === 'listo' ? (
            <div>
              <div className="flex items-start gap-2 rounded-md border border-[#10b98133] bg-[#10b9810d] p-3 text-[12px]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7a55]" />
                <div>
                  <div className="font-medium text-ink">Contraseña actualizada</div>
                  <div className="text-muted">Ya puedes iniciar sesión con tu nueva contraseña.</div>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={() => router.push('/demo/login')}>
                Iniciar sesión
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-base font-semibold text-ink">Elige una nueva contraseña</h1>
              <p className="mt-0.5 text-[12px] text-muted">Mínimo 8 caracteres, con al menos una letra y un número.</p>
              <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink">Nueva contraseña</span>
                  <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink">Confirmar contraseña</span>
                  <input type="password" className={inputCls} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="••••••••" />
                </label>
                {error && <p className="text-[12px] text-error">{error}</p>}
                <Button type="submit" className="w-full" disabled={enviando || !password || !confirmar}>
                  <KeyRound className="h-4 w-4" />
                  {enviando ? 'Guardando…' : 'Restablecer contraseña'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
