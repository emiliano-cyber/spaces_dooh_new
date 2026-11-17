'use client'

import { useEffect, useState } from 'react'
import { Percent, Save } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Campo } from '@/components/demo/ui/Campo'
import { useIdioma } from '@/lib/i18n/contexto'
import { porcentajeEnIdioma } from '@/lib/i18n/formato-idioma'
import { ETAPAS_ABIERTAS, PROBABILIDAD_POR_ETAPA, type EtapaAbierta } from '@/lib/crm'
import type { ConfigNegocio } from '@/lib/data/client'
import { claveEtapa } from './etiquetas'

// ============================================================================
//  Administración → Comercial: la probabilidad de cierre por etapa del CRM.
//  ADR 0051, pregunta 3: el dueño decidió el 17/11 que la fija CADA INSTANCIA.
// ----------------------------------------------------------------------------
//  Una casilla por etapa ABIERTA; GANADA (100 %) y PERDIDA (0 %) no se tocan.
//  Vacía = la de fábrica, que se enseña como sugerencia. Solo viajan las
//  etapas que cambiaron, y `null` quita una (vuelve a la de fábrica): el
//  servidor FUSIONA con lo guardado (`app/api/config/route.ts`), así que tocar
//  Contacto no borra lo que había en Negociando.
//
//  Se aplica al LEER: cambiarla recalcula el embudo de todas las oportunidades
//  que no tienen una probabilidad puesta a mano por el vendedor.
// ============================================================================

const inputCls =
  'demo-num h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

type Borrador = Record<EtapaAbierta, string>

export function ProbabilidadesCrmCard({
  config,
  guardar,
}: {
  config: ConfigNegocio
  guardar: (cambios: Partial<ConfigNegocio>, msg?: string) => Promise<boolean>
}) {
  const { t, idioma } = useIdioma()
  const original = config.crmProbabilidades ?? {}
  const inicial = (): Borrador =>
    Object.fromEntries(ETAPAS_ABIERTAS.map((e) => [e, original[e] != null ? String(original[e]) : ''])) as Borrador
  const [borrador, setBorrador] = useState<Borrador>(inicial)
  const [busy, setBusy] = useState(false)

  // Tras guardar, `config` llega del servidor ya saneado: se resincroniza.
  useEffect(() => {
    setBorrador(inicial())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.crmProbabilidades])

  // Solo las etapas que cambiaron; '' = quitarla (null).
  const cambios: Partial<Record<EtapaAbierta, number | null>> = {}
  for (const e of ETAPAS_ABIERTAS) {
    const antes = original[e] != null ? String(original[e]) : ''
    const ahora = borrador[e].trim()
    if (ahora !== antes) cambios[e] = ahora === '' ? null : Number(ahora)
  }
  const hayCambios = Object.keys(cambios).length > 0
  const hayInvalido = Object.values(cambios).some((n) => n != null && !(Number.isInteger(n) && n >= 0 && n <= 100))

  async function guardarTabla() {
    setBusy(true)
    // El PATCH admite `null` por etapa para quitarla; `ConfigNegocio` describe
    // la forma del GET (ya saneada, sin null). Se ensancha solo aquí.
    await guardar({ crmProbabilidades: cambios } as unknown as Partial<ConfigNegocio>, t('crm.admin.toast'))
    setBusy(false)
  }

  return (
    <CardColapsable
      id="admin.config.crm-probabilidades"
      titulo={t('crm.admin.titulo')}
      icono={<Percent className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <p className="text-[12px] text-muted">{t('crm.admin.ayuda')}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ETAPAS_ABIERTAS.map((e) => (
          <Campo key={e} label={t(claveEtapa(e))}>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              className={inputCls}
              placeholder={porcentajeEnIdioma(String(PROBABILIDAD_POR_ETAPA[e]), idioma)}
              value={borrador[e]}
              onChange={(ev) => setBorrador((b) => ({ ...b, [e]: ev.target.value }))}
            />
          </Campo>
        ))}
      </div>
      <p className="text-[11px] text-muted">
        {t('crm.admin.cerradas', {
          ganada: porcentajeEnIdioma('100', idioma),
          perdida: porcentajeEnIdioma('0', idioma),
        })}
      </p>
      <Button size="sm" disabled={busy || !hayCambios || hayInvalido} onClick={guardarTabla}>
        <Save className="h-3.5 w-3.5" /> {busy ? t('admin.comun.guardando') : t('comun.guardar')}
      </Button>
    </CardColapsable>
  )
}
