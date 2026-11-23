'use client'

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { TONO } from '@/components/demo/admin/Chip'
import { actualizarPropuestaApi, type AvisoCompetencia } from '@/lib/data/estado-api'
import { cambioDeMarca, marcaNoCoincideConCliente } from '@/lib/propuesta-marca'
import { useIdioma } from '@/lib/i18n/contexto'

// ============================================================================
//  PROP-MARCA · decisiones del dueño del 20/11.
//
//  · `AvisoMarcaCliente`: si la marca escrita no «se parece» al cliente
//    (`marcaNoCoincideConCliente`, lib/propuesta-marca.ts), un aviso
//    INFORMATIVO. Tono neutro a propósito: el ámbar es de la competencia de
//    marcas, y esto no es un choque con nadie, es «¿seguro que es esta?».
//    No bloquea nada. Lo pintan el alta (mientras se escribe), el duplicado y
//    la ficha.
//
//  · `BloqueMarcaPropuesta`: editar la marca desde la ficha. Mismas reglas
//    que las condiciones de esa ficha (`BloqueCondicionesVigencia`): quien
//    tiene `comercial.crear`, y no en una APROBADA (el servidor la rechaza:
//    es inmutable). Al guardar, los avisos de competencia que devuelve el
//    PATCH se entregan a la ficha (`onAvisos`) para el recuadro ámbar.
// ============================================================================

const cls =
  'rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function AvisoMarcaCliente({ marca, cliente }: { marca?: string | null; cliente?: string | null }) {
  const { t } = useIdioma()
  if (!marcaNoCoincideConCliente(marca, cliente)) return null
  return (
    <div
      role="note"
      data-testid="aviso-marca-cliente"
      className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]', TONO.neutro)}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{t('propuestas.marca.no-coincide', { marca: marca!.trim(), cliente: cliente!.trim() })}</span>
    </div>
  )
}

export function BloqueMarcaPropuesta({
  propuestaId,
  marca,
  cliente,
  editable,
  onAvisos,
}: {
  propuestaId: string
  marca: string | null
  /** El nombre del cliente de la propuesta, para el aviso de no coincidencia. */
  cliente: string | null
  editable: boolean
  onAvisos: (avisos: AvisoCompetencia[]) => void
}) {
  const { t } = useIdioma()
  const [texto, setTexto] = useState(marca ?? '')
  const [guardando, setGuardando] = useState(false)
  // Si otro guardado (o un refresco del estado) trae otra marca, el campo la
  // recoge.
  useEffect(() => setTexto(marca ?? ''), [marca])

  const cambio = cambioDeMarca(texto, marca)

  async function guardar() {
    if (!cambio) return
    setGuardando(true)
    try {
      const r = await actualizarPropuestaApi(propuestaId, cambio)
      onAvisos(r.avisosCompetencia)
      toast.success(t('propuestas.marca.guardada'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    } finally {
      setGuardando(false)
    }
  }

  if (!editable) {
    // La marca ya se lee en la barra de metadatos; aquí solo el aviso.
    return <AvisoMarcaCliente marca={marca} cliente={cliente} />
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-[13px]" data-testid="editar-marca">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink">{t('propuestas.ficha.meta.marca')}</span>
          <input
            className={`h-9 ${cls}`}
            value={texto}
            maxLength={120}
            placeholder={t('propuestas.alta.marca.placeholder')}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <Button size="sm" onClick={guardar} disabled={guardando || !cambio}>
          {guardando ? t('propuestas.comun.guardando') : t('comun.guardar')}
        </Button>
      </div>
      <AvisoMarcaCliente marca={texto} cliente={cliente} />
    </div>
  )
}
