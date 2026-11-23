'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { FRANJA_AVISO } from '@/components/demo/admin/Chip'
import { avisosCompetenciaApi, type AvisoCompetencia } from '@/lib/data/estado-api'
import { formatFecha } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'

// ============================================================================
//  PROP-MARCA (20/11) · el recuadro ámbar de la COMPETENCIA DE MARCAS en una
//  propuesta: «Pepsi compite con Coca-Cola en Periférico Sur del … al … ·
//  Solo avisa». Lo pinta la pantalla de alta (mientras se eligen marca,
//  fechas y sitios, antes de guardar) y la ficha de la propuesta.
//
//  La regla es la de Vallas y corre en el SERVIDOR
//  (`POST /api/propuestas/competencia` → `verificarCompetencia`): aquí no hay
//  lógica de negocio, solo la pregunta y la respuesta. Con `comercial.crear`
//  basta; no hace falta `inventario.ver` (ver la ruta).
//
//  SOLO AVISA: no deshabilita ningún botón. Sin avisos, o si la pregunta falla,
//  no pinta nada.
// ============================================================================

export function useAvisosCompetencia(e: {
  marca?: string | null
  clienteId?: string | null
  fechaInicio: string
  fechaFin: string
  sitioIds: string[]
}): AvisoCompetencia[] {
  const [avisos, setAvisos] = useState<AvisoCompetencia[]>([])
  const marca = e.marca?.trim() ?? ''
  const cliente = e.clienteId ?? ''
  const sitios = [...e.sitioIds].sort().join(',')
  useEffect(() => {
    const listo =
      (marca || cliente) && sitios && /^\d{4}-\d{2}-\d{2}$/.test(e.fechaInicio) && /^\d{4}-\d{2}-\d{2}$/.test(e.fechaFin) &&
      e.fechaInicio <= e.fechaFin
    if (!listo) {
      setAvisos([])
      return
    }
    let vigente = true
    // Una pausa corta: se pregunta cuando se deja de teclear la marca, no en
    // cada letra.
    const t = setTimeout(async () => {
      const r = await avisosCompetenciaApi({
        marca: marca || null,
        clienteId: cliente || null,
        fechaInicio: e.fechaInicio,
        fechaFin: e.fechaFin,
        sitioIds: sitios.split(','),
      })
      if (vigente) setAvisos(r)
    }, 400)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [marca, cliente, sitios, e.fechaInicio, e.fechaFin])
  return avisos
}

export function RecuadroCompetencia({ avisos }: { avisos: AvisoCompetencia[] }) {
  const { t, idioma } = useIdioma()
  if (!avisos.length) return null
  return (
    <div role="note" data-testid="aviso-competencia" className={FRANJA_AVISO}>
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <div className="font-medium">{t('propuestas.competencia.titulo')}</div>
        <ul className="m-0 list-none space-y-0.5 p-0">
          {avisos.map((a, i) => (
            <li key={i}>
              {t('propuestas.competencia.aviso', {
                marca: a.marca,
                otra: a.marcaExistente,
                categoria: a.categoria,
                sitio: a.sitioNombre ?? '—',
                inicio: a.inicio ? formatFecha(a.inicio, idioma) : '',
                fin: a.fin ? formatFecha(a.fin, idioma) : '',
              })}
            </li>
          ))}
        </ul>
        <div className="opacity-80">{t('propuestas.competencia.solo-avisa')}</div>
      </div>
    </div>
  )
}

/** El hook y el recuadro juntos, para quien solo quiere pintarlo. */
export function AvisoCompetenciaPropuesta(props: Parameters<typeof useAvisosCompetencia>[0]) {
  return <RecuadroCompetencia avisos={useAvisosCompetencia(props)} />
}
