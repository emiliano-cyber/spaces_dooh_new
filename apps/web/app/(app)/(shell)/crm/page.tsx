'use client'

import { useSearchParams } from 'next/navigation'
import { useTexto } from '@/lib/i18n/contexto'
import { PestanasCrm } from '@/components/demo/crm/PestanasCrm'
import { Oportunidades } from '@/components/demo/crm/Oportunidades'
import { Captacion } from '@/components/demo/captacion/Captacion'

// ============================================================================
//  /crm — el CRM comercial (ADR 0051, Fase 4).
// ----------------------------------------------------------------------------
//  Tres de sus cuatro pestañas viven aquí (`?vista=`): el embudo (por omisión),
//  la lista de oportunidades y los prospectos de tipo cliente. La cuarta,
//  Propuestas, es `/propuestas` tal cual: no cambió de dirección.
//
//  Encabezado con el patrón del Dashboard (título y una línea, sin icono), que
//  el dueño dio por referencia el 26/10.
// ============================================================================

export default function CrmPage() {
  const t = useTexto()
  const v = useSearchParams()?.get('vista')
  const vista = v === 'oportunidades' || v === 'prospectos' ? v : 'embudo'
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-ink">{t('crm.titulo')}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {vista === 'prospectos' ? t('crm.prospectos.subtitulo') : t('crm.subtitulo')}
        </p>
      </div>
      <PestanasCrm activa={vista} />
      {vista === 'prospectos' ? <Captacion tipoFijo="CLIENTE" /> : <Oportunidades vista={vista} />}
    </div>
  )
}
