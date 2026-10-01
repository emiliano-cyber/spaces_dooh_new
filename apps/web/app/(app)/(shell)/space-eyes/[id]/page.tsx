'use client'

import { useParams } from 'next/navigation'
import { FichaEquipo } from '@/components/demo/space-eyes/FichaEquipo'

// Ficha de un equipo Space Eyes. El id es el del equipo en Space Eye (numérico);
// uno de otra instancia contesta 404 allá y la ficha lo trata como no
// encontrado, sin decir nunca "no es tuyo".
export default function SpaceEyeEquipoPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="w-full p-6">
        <h1 className="text-lg font-semibold text-ink">Equipo no encontrado</h1>
        <p className="mt-2 text-[13px] text-muted">La dirección no corresponde a ningún equipo Space Eyes.</p>
      </div>
    )
  }
  return <FichaEquipo id={id} />
}
