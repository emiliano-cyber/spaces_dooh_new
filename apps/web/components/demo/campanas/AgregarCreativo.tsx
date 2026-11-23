'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Code2, Eye } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { crearCreatividadApi } from '@/lib/data/estado-api'
import { imagenAHtml } from '@/lib/creativo-html'
import { useTexto } from '@/lib/i18n/contexto'
import { useCampanas, useConfigNegocio, useOrdenesImpresion, useReservas, useSitios } from '@/lib/data/client'
import { resolverRequisitos } from '@/lib/requisitos-impresion'
import { cuerpoArte, lonasDeCampana, topeArteMb } from '@/lib/arte-impresion'
import { RevisionArte, pixelesDeImagen } from '@/components/operaciones/ValoracionArte'

// ============================================================================
//  Alta rápida de creativos desde la FICHA DE CAMPAÑA: subir una imagen o pegar
//  código HTML sin salir a la pantalla de Creativos. Antes de subir, se muestra
//  un MODAL DE VISTA PREVIA con el render real del creativo (como se verá en la
//  pantalla), para confirmar antes de guardarlo. Reusa el mismo endpoint y la
//  misma conversión imagen→HTML que la pantalla de Creativos.
//
//  Gateado con `comercial.crear`. Si el rol no puede, no se muestra nada.
// ============================================================================

// Lo que se está por subir, ya convertido al HTML del creativo (lo que se guarda).
// IMP-VAL (18/11) · si es una IMAGEN, también el archivo tal cual: con él se
// revisa contra la lona y, en una OOH de más de 4 MB, se sube sin envolver.
type Previa = {
  nombre: string
  codigo: string
  imagen?: { dataUrl: string; tipo: string; bytes: number; pixeles: { ancho: number; alto: number } | null }
}

export function AgregarCreativo({ campanaId }: { campanaId: string }) {
  const puede = usePuede('comercial', 'crear')
  const t = useTexto()
  const fileRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [codeNombre, setCodeNombre] = useState('')
  // Creativo en vista previa (null = modal cerrado).
  const [previa, setPrevia] = useState<Previa | null>(null)
  // OBLIG-01 · al pegar código, el código es lo único obligatorio (sin él no
  // hay creativo); el nombre cae a «Creativo (código)».
  const ob = useObligatorios({ codigo }, ['codigo'])
  // IMP-VAL (18/11) · decisión del dueño: el arte que se sube desde la ficha
  // pasa por la misma revisión contra la lona que en Imprenta. Las lonas son
  // los sitios FIJOS de la campaña con medida (`lonasDeCampana`).
  const campanas = useCampanas()
  const reservas = useReservas()
  const sitios = useSitios()
  const ois = useOrdenesImpresion()
  // IMP-REQ (18/11) · la lona se valora con los requisitos de la imprenta de
  // la orden de ese sitio, si no con los de la empresa.
  const config = useConfigNegocio()
  const tipoCampana = campanas?.find((c) => c.id === campanaId)?.tipoCampana ?? null
  const lonas = useMemo(
    () => lonasDeCampana(campanaId, reservas ?? [], sitios ?? [], ois ?? []),
    [campanaId, reservas, sitios, ois],
  )
  const [lonaId, setLonaId] = useState<string | null>(null)
  const lona = lonas.find((l) => l.id === lonaId) ?? lonas[0] ?? null
  const tope = topeArteMb(tipoCampana)

  if (!puede) return null

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > tope * 1024 * 1024) {
      toast.error(t('campanas.creativo.imagen-supera', { mb: tope }))
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const pixeles = await pixelesDeImagen(f)
      // Toda imagen se convierte al creativo HTML adaptativo (como en Creativos)
      // y se muestra en vista previa antes de subir.
      setPrevia({
        nombre: f.name,
        codigo: imagenAHtml(dataUrl, f.name),
        imagen: { dataUrl, tipo: f.type, bytes: f.size, pixeles },
      })
    }
    reader.readAsDataURL(f)
  }

  function previsualizarCodigo() {
    if (!ob.validar()) return
    setPrevia({ nombre: codeNombre.trim() || t('campanas.creativo.nombre-codigo'), codigo })
  }

  async function confirmarSubida() {
    if (!previa) return
    setSubiendo(true)
    try {
      await crearCreatividadApi(
        previa.imagen
          ? cuerpoArte({
              campanaId,
              nombre: previa.nombre,
              dataUrl: previa.imagen.dataUrl,
              tipo: previa.imagen.tipo,
              bytes: previa.imagen.bytes,
            })
          : { campanaId, nombre: previa.nombre, codigo: previa.codigo, formato: 'text/html' },
      )
      toast.success(t('campanas.creativo.agregado'))
      setPrevia(null)
      setCodigo('')
      setCodeNombre('')
      setCodeOpen(false)
      ob.reiniciar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('campanas.creativo.no-subir'))
    }
    setSubiendo(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <Button variant="success" size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> {t('campanas.creativo.imagen')}
        </Button>
        <Button size="sm" variant="secondary" disabled={subiendo} onClick={() => setCodeOpen((v) => !v)}>
          <Code2 className="h-3.5 w-3.5" /> {t('campanas.creativo.codigo')}
        </Button>
      </div>

      {codeOpen && (
        <div className="space-y-2 rounded-md border border-border bg-surface-2 p-2.5">
          <Campo label={t('campanas.creativo.nombre')}>
            <input
              value={codeNombre}
              onChange={(e) => setCodeNombre(e.target.value)}
              className="h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </Campo>
          <Campo label={t('campanas.creativo.codigo')} obligatorio falta={ob.falta('codigo')}>
            <textarea
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder={t('campanas.creativo.pega')}
              rows={5}
              className="w-full rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </Campo>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCodeOpen(false)
                ob.reiniciar()
              }}
            >
              {t('comun.cancelar')}
            </Button>
            <Button size="sm" disabled={subiendo} onClick={previsualizarCodigo}>
              <Eye className="h-3.5 w-3.5" /> {t('campanas.creativo.vista-previa')}
            </Button>
          </div>
        </div>
      )}

      {/* Modal de vista previa del creativo a subir */}
      <Modal
        open={!!previa}
        size={previa?.imagen && lona ? 'lg' : 'md'}
        onOpenChange={(v) => { if (!v && !subiendo) setPrevia(null) }}
        title={t('campanas.creativo.vista-previa.titulo')}
        subtitle={previa?.nombre}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={subiendo} onClick={() => setPrevia(null)}>{t('comun.cancelar')}</Button>
            <Button size="sm" disabled={subiendo} onClick={confirmarSubida}>
              <Upload className="h-3.5 w-3.5" /> {subiendo ? t('campanas.comun.subiendo') : t('campanas.creativo.subir')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {/* IMP-VAL · la lona a escala y la valoración, si la campaña tiene
              sitios fijos con medida. Una OOH no se ve en una pantalla, así
              que no lleva la vista del player. */}
          {previa?.imagen && lona && (
            <div className="space-y-2">
              {lonas.length > 1 && (
                <label className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  {t('operaciones.imprenta.valoracion.revisar-contra')}
                  <select
                    value={lona.id}
                    onChange={(e) => setLonaId(e.target.value)}
                    className="max-w-full rounded border border-border-strong bg-surface px-2 py-1 text-[12px] text-ink"
                  >
                    {lonas.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
              <RevisionArte
                key={lona.id}
                medida={lona}
                src={previa.imagen.dataUrl}
                imagen
                pixeles={previa.imagen.pixeles}
                tipo={previa.imagen.tipo}
                bytes={previa.imagen.bytes}
                maxMb={tope}
                requisitos={resolverRequisitos(lona.requisitos, config?.requisitosImpresion)}
              />
            </div>
          )}
          {!(previa?.imagen && lona && tipoCampana === 'OOH') && (
          <>
          <p className="text-[12px] text-muted">{t('campanas.creativo.asi-se-vera')}</p>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            {previa && (
              <iframe
                title={t('campanas.creativo.vista-previa.titulo')}
                srcDoc={previa.codigo}
                // Sandbox: renderiza el creativo pero aislado (sin acceso a la
                // página ni navegación); permite scripts para que el HTML se vea
                // como en el player, sin same-origin.
                sandbox="allow-scripts"
                className="h-[360px] w-full bg-black"
              />
            )}
          </div>
          </>
          )}
        </div>
      </Modal>
    </div>
  )
}
