'use client'

import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { useIdioma } from '@/lib/i18n/contexto'
import type { EleccionContactado } from '@/lib/prospecto-contactado'

// ============================================================================
//  El cuadro de «pasa a Contactado»: ¿sigue como prospecto o se convierte en
//  oportunidad?  18/11. La regla de cuándo sale y lo que hace cada botón están
//  en `lib/prospecto-contactado.ts`; esto solo lo pinta.
//
//  Cerrarlo (la X, Escape o «Cancelar») es `cancelar`: el estatus NO cambia.
// ============================================================================

export function CuadroContactado({
  abierto,
  nombre,
  ocupado,
  onElegir,
}: {
  abierto: boolean
  nombre: string
  ocupado: boolean
  onElegir: (e: EleccionContactado) => void
}) {
  const { t } = useIdioma()
  return (
    <Modal
      open={abierto}
      onOpenChange={(v) => !v && !ocupado && onElegir('cancelar')}
      title={t('crm.contactado.titulo')}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={ocupado} onClick={() => onElegir('cancelar')}>{t('comun.cancelar')}</Button>
          <Button variant="secondary" disabled={ocupado} onClick={() => onElegir('prospecto')}>{t('crm.contactado.seguir')}</Button>
          <Button variant="success" disabled={ocupado} onClick={() => onElegir('oportunidad')}>{t('crm.contactado.convertir')}</Button>
        </div>
      }
    >
      <p className="text-[13px] text-ink">{t('crm.contactado.texto', { nombre })}</p>
    </Modal>
  )
}
