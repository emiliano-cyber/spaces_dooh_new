'use client'

import { X } from 'lucide-react'

// ============================================================================
//  Un aviso de la campanita, con su botón para borrarlo SOLO (NOTIF-USUARIO).
// ----------------------------------------------------------------------------
//  Vive aparte de `Topbar.tsx` para poder probar su HTML sin el resto del shell
//  (`item-notificacion.test.ts`).
//
//  La papelera va AL LADO del botón que abre el aviso, no dentro: un <button>
//  dentro de otro es HTML inválido, el navegador lo saca fuera al pintar, y el
//  clic en borrar acababa abriendo también el enlace del aviso.
// ============================================================================

export interface AvisoCampanita {
  id: string
  titulo: string
  detalle: string | null
  nivel: string
  link: string | null
  leida: boolean
}

export function ItemNotificacion({
  n,
  onAbrir,
  onBorrar,
}: {
  n: AvisoCampanita
  onAbrir: (id: string, link: string | null) => void
  onBorrar: (id: string) => void
}) {
  return (
    <div className={`group flex items-start gap-1 rounded hover:bg-surface-2 ${n.leida ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={() => onAbrir(n.id, n.link)}
        className="block min-w-0 flex-1 rounded px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              n.nivel === 'ok' ? 'bg-success' : n.nivel === 'warn' ? 'bg-warning' : 'bg-info'
            } ${n.leida ? 'opacity-0' : ''}`}
          />
          <span className="text-[13px] font-medium text-ink">{n.titulo}</span>
        </div>
        {/* B6: `truncate` cortaba el detalle en «…el importe de la re…»
            y no había forma de ver el resto. Se deja en DOS líneas: la
            mayoría cabe entera, y el aviso sigue siendo una fila corta
            de lista y no un párrafo. El `title` da el texto íntegro al
            pasar el ratón, para el caso que aun así se pase. */}
        {n.detalle && (
          <div className="ml-4 line-clamp-2 text-[12px] text-muted" title={n.detalle}>
            {n.detalle}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => onBorrar(n.id)}
        aria-label={`Borrar la notificación ${n.titulo}`}
        title="Borrar esta notificación"
        className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
