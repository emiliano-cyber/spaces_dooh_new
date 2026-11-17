'use client'

import { FichaOportunidad } from '@/components/demo/crm/FichaOportunidad'

// /crm/oportunidades/[id] — la ficha de una oportunidad (ADR 0051, Fase 4).
// Una ajena contesta 404 en la API y la ficha lo dice; no hay forma de verla
// desde aquí que el servidor no permita.
export default function OportunidadPage({ params }: { params: { id: string } }) {
  return <FichaOportunidad id={params.id} />
}
