'use client'

import { useEffect, useState } from 'react'
import { Copy, Inbox } from 'lucide-react'
import { fechaHora } from './piezas'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'

// ============================================================================
//  Las solicitudes de activación de Space Eyes, en el SPACE OS del PADRE.
//
//  Una empresa sin el módulo pulsa «Solicitar activación» en la demostración y
//  eso abre un ticket en su instancia. El panel de flota del padre los recoge
//  y los separa (`/flota/solicitudes.json`, apps/flota/servidor.mjs); antes
//  solo se veían en esa otra página y nadie las buscaba ahí (08/10).
//
//  Solo existe en el padre: el panel de flota vive en su mismo dominio y con su
//  misma sesión. En un hijo `/flota/` no existe (404) y esto no pinta nada, y
//  tampoco a quien no tiene permiso de administración (401).
//
//  Activar se firma con la frase de paso de la llave de licencias, así que no
//  hay botón que lo haga: se da la orden exacta para copiarla.
// ============================================================================

type Solicitud = {
  nombre: string
  dominio: string
  folio: string | null
  creado_en: string | null
  total: number
  orden: string
}

export function SolicitudesActivacion() {
  const { t, idioma } = useIdioma()
  const [lista, setLista] = useState<Solicitud[] | null>(null)
  const [copiada, setCopiada] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/flota/solicitudes.json', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { solicitudes?: Solicitud[] } | null) => {
        if (vivo && d && Array.isArray(d.solicitudes)) setLista(d.solicitudes)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  // No es el padre, o no tiene permiso: nada.
  if (lista === null) return null

  async function copiar(orden: string) {
    try {
      await navigator.clipboard.writeText(orden)
      setCopiada(orden)
    } catch {
      /* sin portapapeles: la orden está a la vista */
    }
  }

  return (
    <section className="mx-4 mt-4 rounded-md border border-border bg-surface sm:mx-6">
      <header className="flex items-center gap-2 border-b border-border p-3">
        <Inbox className="h-4 w-4 text-accent" />
        <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.solicitudes.titulo')}</h2>
        <span className="ml-auto text-[12px] text-muted">
          {lista.length === 0
            ? t('spaceeyes.solicitudes.ninguna')
            : t(lista.length === 1 ? 'spaceeyes.solicitudes.pendientes.uno' : 'spaceeyes.solicitudes.pendientes.otros', { n: lista.length })}
        </span>
      </header>
      {lista.length === 0 ? (
        <p className="p-3 text-[12px] text-muted">
          {t('spaceeyes.solicitudes.vacio')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((s) => (
            <li key={s.nombre} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-[12px]">
              <div className="min-w-[12rem] flex-1">
                <div className="font-medium text-ink">{s.nombre}</div>
                <div className="text-muted">
                  {s.dominio}
                  {s.folio ? t('spaceeyes.solicitudes.folio', { folio: s.folio }) : ''}
                  {s.creado_en ? ` · ${fechaHora(s.creado_en, idioma)}` : ''}
                </div>
              </div>
              <code className="max-w-full overflow-x-auto rounded bg-surface-2 px-2 py-1 text-[11.5px] text-ink">
                {s.orden}
              </code>
              <button
                type="button"
                onClick={() => void copiar(s.orden)}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <Copy className="h-3.5 w-3.5" /> {copiada === s.orden ? t('spaceeyes.solicitudes.copiada') : t('spaceeyes.solicitudes.copiar')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border p-3 text-[11.5px] text-muted">
        {interpolarNodos(t('spaceeyes.solicitudes.pie'), {
          panel: (
            <a className="text-accent hover:underline" href="/flota/tickets/">
              {t('spaceeyes.solicitudes.panel')}
            </a>
          ),
        })}
      </p>
    </section>
  )
}
