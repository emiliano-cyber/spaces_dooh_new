'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, ArrowRight, KeyRound } from 'lucide-react'

// Entrada pública por CÓDIGO (estilo Hivestack): el cliente teclea el código de
// su propuesta (folio, p. ej. PR-A0BC4F) y se abre la vista de solo lectura.
export default function IngresarCodigoPropuestaPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)

  async function abrir(e: React.FormEvent) {
    e.preventDefault()
    const cod = codigo.trim()
    if (!cod) return
    setVerificando(true)
    setError(null)
    try {
      const r = await fetch(`/spaces-dooh/api/propuestas/publica/${encodeURIComponent(cod)}/`, { cache: 'no-store' })
      if (!r.ok) {
        setError('No encontramos ninguna propuesta con ese código. Revísalo e inténtalo de nuevo.')
        setVerificando(false)
        return
      }
      router.push(`/demo/p/${encodeURIComponent(cod)}`)
    } catch {
      setError('No se pudo verificar el código. Inténtalo de nuevo.')
      setVerificando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-fg">
            <Radio className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold text-ink">Spaces</div>
            <div className="text-[10px] text-muted">Propuestas comerciales</div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex flex-col items-center text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#0a66ff1a] text-info">
              <KeyRound className="h-5 w-5" />
            </span>
            <h1 className="text-lg font-semibold text-ink">Ver tu propuesta</h1>
            <p className="mt-1 text-[13px] text-muted">
              Ingresa el código que te compartimos para ver tu propuesta.
            </p>
          </div>

          <form onSubmit={abrir} className="space-y-3">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="p. ej. PR-A0BC4F"
              autoFocus
              className="demo-num h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-center text-[15px] tracking-wide text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {error && <p className="text-[12px] text-error">{error}</p>}
            <button
              type="submit"
              disabled={!codigo.trim() || verificando}
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-accent text-[14px] font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verificando ? 'Verificando…' : <>Ver propuesta <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-muted">
        Spaces · propuestas comerciales · acceso de solo lectura por código
      </footer>
    </div>
  )
}
