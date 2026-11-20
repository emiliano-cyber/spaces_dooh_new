'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { useIdioma } from '@/lib/i18n/contexto'
import { armarAlbum, nombreDelAlbum, type FotoAlbum } from '@/lib/album-evidencias'
import { descargarBlob } from '@/lib/space-eyes-marca'

// ============================================================================
//  «Descargar álbum» — el comprobante de exhibición de los medios fijos
//  (FLUJO-CREA, 20/11). Baja en un .zip las fotos de evidencia de la campaña,
//  cada una con su sitio y su fecha (`lib/album-evidencias.ts`, que reutiliza
//  el .zip del álbum de Space Eyes). Va en la ficha de campaña y en el portal
//  del cliente, junto a `EvidenciaGaleria`.
//
//  Sin fotos no se descarga nada: se dice por qué. Las que no se puedan leer
//  se saltan y se cuentan, como en Space Eyes.
// ============================================================================

export function DescargarAlbum({
  fotos,
  campana,
}: {
  fotos: FotoAlbum[]
  campana: { folio?: string | null; nombre: string }
}) {
  const { t } = useIdioma()
  const [armando, setArmando] = useState(false)

  async function descargar() {
    if (fotos.length === 0) {
      toast.info(t('campanas.evidencia.album.sin-fotos'))
      return
    }
    setArmando(true)
    try {
      const r = await armarAlbum(fotos)
      if (!r.zip) {
        toast.error(t('campanas.evidencia.album.ninguna'))
        return
      }
      descargarBlob(new Blob([r.zip as BlobPart], { type: 'application/zip' }), nombreDelAlbum(campana))
      if (r.fallidas) {
        toast.info(t(r.fallidas === 1 ? 'campanas.evidencia.album.parcial.uno' : 'campanas.evidencia.album.parcial.otros', { n: r.fallidas }))
      } else {
        toast.success(t(r.incluidas === 1 ? 'campanas.evidencia.album.listo.uno' : 'campanas.evidencia.album.listo.otros', { n: r.incluidas }))
      }
    } catch {
      toast.error(t('campanas.evidencia.album.ninguna'))
    } finally {
      setArmando(false)
    }
  }

  return (
    <Button size="sm" variant="secondary" disabled={armando} onClick={descargar}>
      <Download className="h-3.5 w-3.5" />
      {armando ? t('campanas.evidencia.album.armando') : t('campanas.evidencia.album.descargar')}
    </Button>
  )
}
