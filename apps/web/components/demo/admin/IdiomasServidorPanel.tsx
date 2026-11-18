'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Languages, Loader2 } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { IDIOMAS, type Idioma } from '@/lib/i18n/idiomas'

const API = '/spaces-dooh/api'

// ============================================================================
//  IdiomasServidorPanel — «Administracion → Configuracion → Idiomas del
//  servidor» (IDIOMAS-SERVIDOR, 10/11). El boton para encender o apagar los
//  idiomas de ESTE servidor sin entrar por ssh ni recrear el contenedor.
//
//  · El espanol va siempre (casilla fija): es al que cae lo que falte.
//  · «Usar los de las variables» deja el servidor como antes de esta tarea
//    (`IDIOMA_INGLES=1`… en `app.env`), y viene marcado mientras nadie elija.
//  · Al guardar, `router.refresh()`: el layout raiz vuelve con los idiomas
//    nuevos y el selector aparece (o desaparece) del menu de la cuenta sin
//    recargar la pagina.
// ============================================================================

interface Estado {
  idiomas: Idioma[] | null
  activos: Idioma[]
}

// Italiano y portugues siguen en lotes de traduccion: se avisa al elegirlos.
const PARCIALES: readonly Idioma[] = ['it', 'pt']

export function IdiomasServidorPanel({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useIdioma()
  const router = useRouter()
  const [guardado, setGuardado] = useState<Estado | null>(null)
  const [usarServidor, setUsarServidor] = useState(true)
  const [elegidos, setElegidos] = useState<Idioma[]>(['es'])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cargar(e: Estado) {
    setGuardado(e)
    setUsarServidor(e.idiomas === null)
    setElegidos(e.idiomas ?? e.activos)
  }

  useEffect(() => {
    fetch(`${API}/idiomas-servidor/`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) cargar(d) })
  }, [])

  if (!guardado) return null

  const final: Idioma[] | null = usarServidor ? null : IDIOMAS.filter((i) => i === 'es' || elegidos.includes(i))
  const hayCambio = JSON.stringify(final) !== JSON.stringify(guardado.idiomas)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const r = await fetch(`${API}/idiomas-servidor/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idiomas: final }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? t('admin.idiomas_servidor.error'))
      cargar(d as Estado)
      onToast(t('admin.idiomas_servidor.guardado'))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.idiomas_servidor.error'))
    }
    setGuardando(false)
  }

  return (
    <CardColapsable
      id="admin.config.idiomas-servidor"
      titulo={t('admin.idiomas_servidor.titulo')}
      icono={<Languages className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <p className="m-0 text-[12px] text-muted">{t('admin.idiomas_servidor.ayuda')}</p>

      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" checked={usarServidor} onChange={(e) => setUsarServidor(e.target.checked)} />
        {t('admin.idiomas_servidor.servidor')}
      </label>

      <div className={cn('flex flex-wrap gap-x-5 gap-y-2 pl-1', usarServidor && 'opacity-50')}>
        {IDIOMAS.map((i) => (
          <label key={i} className="flex items-center gap-1.5 text-[13px] text-ink">
            <input
              type="checkbox"
              disabled={usarServidor || i === 'es'}
              checked={i === 'es' || (usarServidor ? guardado.activos : elegidos).includes(i)}
              onChange={(e) => setElegidos((prev) => (e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)))}
            />
            {t(`idioma.${i}` as ClaveTexto)}
            {i === 'es' && <span className="text-[11px] text-muted">({t('admin.idiomas_servidor.siempre')})</span>}
            {PARCIALES.includes(i) && <span className="text-[11px] text-muted">({t('admin.idiomas_servidor.parcial')})</span>}
          </label>
        ))}
      </div>

      {error && <p className="m-0 text-[12px] text-error">{error}</p>}

      <div className="flex justify-end">
        <Button size="sm" type="button" disabled={!hayCambio || guardando} onClick={() => { void guardar() }}>
          {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {t('admin.idiomas_servidor.guardar')}
        </Button>
      </div>
    </CardColapsable>
  )
}
