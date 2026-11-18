'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { useIdioma } from '@/lib/i18n/contexto'

// ============================================================================
//  ImprentaVisibleCliente — el interruptor «mostrar la imprenta al cliente».
// ----------------------------------------------------------------------------
//  Decisión del dueño (17/11): en el seguimiento de la liga pública el NOMBRE
//  de la imprenta va oculto por omisión (revela que imprime un tercero). Lo
//  enciende el vendedor que creó la propuesta o un superior; la regla vive en
//  el servidor (`imprenta-visible-controller.ts`) y aquí solo se respeta
//  `puedeCambiar` para no ofrecer un clic que acabaría en 403.
//
//  Discreto a propósito: una fila con su interruptor, no una tarjeta. El
//  CSRF lo pone el parche global de `fetch` (`lib/csrf-client.ts`).
// ============================================================================

const API = '/spaces-dooh/api'

export function ImprentaVisibleCliente({ propuestaId }: { propuestaId: string }) {
  const { t } = useIdioma()
  // `null` = aún no se sabe: no se pinta un interruptor que podría mentir.
  const [estado, setEstado] = useState<{ imprentaVisible: boolean; puedeCambiar: boolean } | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`${API}/propuestas/${propuestaId}/imprenta-visible/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => vivo && j && setEstado({ imprentaVisible: !!j.imprentaVisible, puedeCambiar: !!j.puedeCambiar }))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [propuestaId])

  if (!estado) return null

  async function cambiar() {
    if (!estado || !estado.puedeCambiar || guardando) return
    const visible = !estado.imprentaVisible
    setGuardando(true)
    try {
      const r = await fetch(`${API}/propuestas/${propuestaId}/imprenta-visible/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        // El servidor ya manda su mensaje traducido (I18N-05).
        toast.error(j.error ?? t('propuestas.imprenta-visible.error'))
        return
      }
      setEstado({ imprentaVisible: !!j.imprentaVisible, puedeCambiar: j.puedeCambiar !== false })
      toast.success(t(j.imprentaVisible ? 'propuestas.imprenta-visible.mostrada' : 'propuestas.imprenta-visible.ocultada'))
    } catch {
      toast.error(t('propuestas.imprenta-visible.error'))
    } finally {
      setGuardando(false)
    }
  }

  const deshabilitado = !estado.puedeCambiar || guardando
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <Printer aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink" id={`imprenta-visible-${propuestaId}`}>
          {t('propuestas.imprenta-visible.etiqueta')}
        </div>
        <p className="mt-0.5 text-[11px] text-muted">
          {estado.puedeCambiar ? t('propuestas.imprenta-visible.ayuda') : t('propuestas.imprenta-visible.sin-permiso')}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={estado.imprentaVisible}
        aria-labelledby={`imprenta-visible-${propuestaId}`}
        title={t('propuestas.imprenta-visible.titulo')}
        disabled={deshabilitado}
        onClick={cambiar}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
          estado.imprentaVisible ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform ${
            estado.imprentaVisible ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
