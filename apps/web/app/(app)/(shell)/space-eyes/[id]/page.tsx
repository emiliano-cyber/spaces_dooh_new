'use client'

import { useParams } from 'next/navigation'
import { FichaEquipo } from '@/components/demo/space-eyes/FichaEquipo'
import { useTexto } from '@/lib/i18n/contexto'

// Ficha de un equipo Space Eyes. El id es el del equipo en Space Eye (numérico);
// uno de otra instancia contesta 404 allá y la ficha lo trata como no
// encontrado, sin decir nunca "no es tuyo".
export default function SpaceEyeEquipoPage() {
  const params = useParams<{ id: string }>()
  const t = useTexto()
  const id = Number(params?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="w-full">
        <h1 className="text-2xl text-ink">{t('spaceeyes.ficha.no-encontrado')}</h1>
        <p className="mt-2 text-[13px] text-muted">{t('spaceeyes.pagina.id-invalido')}</p>
      </div>
    )
  }
  return <FichaEquipo id={id} />
}
