'use client'

import { Modal } from '@/components/demo/ui/Modal'
import { useCampanasResumen, usePropuestas, type Cliente } from '@/lib/data/client'
import { PipelineCliente } from './PipelineCliente'
import { CampanasDelCliente } from './CampanasDelCliente'
import { useTexto } from '@/lib/i18n/contexto'

// La ficha de un cliente en Clientes (20/10): su pipeline y sus campañas.
// Vive aparte de `clientes/page.tsx` a propósito, para que la página solo
// tenga que montarla. Lee lo que el store ya trae: no hay endpoint nuevo.
export function FichaCliente({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const t = useTexto()
  const resumen = useCampanasResumen()
  const propuestas = usePropuestas()
  const listo = resumen && propuestas

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={cliente.nombre}
      subtitle={t('clientes.ficha.subtitulo', {
        tipo: cliente.tipo === 'AGENCIA' ? t('clientes.tipo.agencia') : t('clientes.tipo.directo'),
        rfc: cliente.rfc ? ` · ${cliente.rfc}` : '',
      })}
    >
      {!listo ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : (
        <div className="space-y-5">
          <PipelineCliente
            clienteId={cliente.id}
            propuestas={propuestas}
            campanas={resumen.map((r) => r.campana)}
          />
          <CampanasDelCliente
            clienteId={cliente.id}
            resumen={resumen}
            propuestas={propuestas}
            onNavegar={onClose}
          />
        </div>
      )}
    </Modal>
  )
}
