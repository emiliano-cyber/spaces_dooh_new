'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
import { validarPassword } from '@/lib/password'
import { useIdioma } from '@/lib/i18n/contexto'
import { mensajeDeAcceso } from '@/lib/i18n/errores-acceso'
import { DICCIONARIOS, type ClaveTexto } from '@/lib/i18n/diccionario'

// I18N (lote cuenta, 2026-11-02) · `validarPassword` la comparte el servidor y
// devuelve espanol; su texto es el de una clave `password.*` (una prueba del
// diccionario lo ata), asi que en pantalla se pinta esa clave en el idioma
// vigente. Solo cambia el texto que se ENSENA, no la regla.
function claveDeRegla(regla: string): ClaveTexto | null {
  const es = DICCIONARIOS.es as Record<string, string>
  return (Object.keys(es).find((k) => k.startsWith('password.') && es[k] === regla) as ClaveTexto | undefined) ?? null
}

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Con `?bienvenida=1` el enlace es una INVITACIÓN (ADR 0044): la misma página y
// el mismo token, pero quien la abre no olvidó nada — nunca tuvo contraseña.
// El parámetro solo cambia los textos; el servidor no distingue los dos casos,
// y no hace falta: el token vale lo mismo en los dos.
export default function RecuperarPage({ params, searchParams }: { params: { token: string }; searchParams?: { bienvenida?: string } }) {
  const router = useRouter()
  const token = params.token
  const bienvenida = searchParams?.bienvenida === '1'
  const [estado, setEstado] = useState<'validando' | 'valido' | 'invalido' | 'listo'>('validando')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const { t, idioma } = useIdioma()

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
    // La misma regla que aplica el servidor: antes se comprobaba solo la
    // longitud, y «aaaaaaaa» pasaba aquí para rebotar después.
    const regla = validarPassword(password)
    if (regla) { const k = claveDeRegla(regla); setError(k ? t(k) : regla); return }
    if (password !== confirmar) { setError(t('cuenta.comun.no-coinciden')); return }
    setEnviando(true)
    try {
      const r = await fetch('/spaces-dooh/api/auth/reset/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? t('cuenta.recuperar.error'))
      setEstado('listo')
    } catch (e) {
      setError(e instanceof Error ? mensajeDeAcceso(e.message, idioma) : t('cuenta.recuperar.error'))
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
            <div className="text-[11px] text-muted">{bienvenida ? t('cuenta.recuperar.bienvenida') : t('cuenta.comun.restablecer-contrasena')}</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          {estado === 'validando' ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('cuenta.recuperar.verificando')}
            </div>
          ) : estado === 'invalido' ? (
            <div>
              <div className="flex items-start gap-2 rounded-md border border-[#ef444440] bg-[#ef44440d] p-3 text-[12px]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <div>
                  <div className="font-medium text-ink">{t('cuenta.recuperar.invalido')}</div>
                  <div className="text-muted">
                    {bienvenida
                      ? t('cuenta.recuperar.invalido.bienvenida')
                      : t('cuenta.recuperar.invalido.restablecer')}
                  </div>
                </div>
              </div>
              <Button className="mt-4 w-full" variant="secondary" onClick={() => router.push('/login')}>
                {t('cuenta.recuperar.ir-login')}
              </Button>
            </div>
          ) : estado === 'listo' ? (
            <div>
              <div className="flex items-start gap-2 rounded-md border border-[#10b98133] bg-[#10b9810d] p-3 text-[12px]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7a55]" />
                <div>
                  <div className="font-medium text-ink">{bienvenida ? t('cuenta.recuperar.creada') : t('cuenta.recuperar.actualizada')}</div>
                  <div className="text-muted">{bienvenida ? t('cuenta.recuperar.listo.bienvenida') : t('cuenta.recuperar.listo.restablecer')}</div>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={() => router.push('/login')}>
                {t('login.titulo.login')}
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-base font-semibold text-ink">{bienvenida ? t('cuenta.recuperar.elige.bienvenida') : t('cuenta.recuperar.elige.restablecer')}</h1>
              <p className="mt-0.5 text-[12px] text-muted">{t('cuenta.recuperar.regla')}</p>
              <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink">{t('cuenta.comun.nueva-contrasena')}</span>
                  <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink">{t('cuenta.comun.confirmar-contrasena')}</span>
                  <input type="password" className={inputCls} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="••••••••" />
                </label>
                {error && <p className="text-[12px] text-error">{error}</p>}
                <Button type="submit" className="w-full" disabled={enviando || !password || !confirmar}>
                  <KeyRound className="h-4 w-4" />
                  {enviando ? t('cuenta.recuperar.guardando') : bienvenida ? t('cuenta.comun.guardar-contrasena') : t('cuenta.comun.restablecer-contrasena')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
