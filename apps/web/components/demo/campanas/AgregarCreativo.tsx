'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Code2, Eye } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { crearCreatividadApi } from '@/lib/data/estado-api'
import { imagenAHtml } from '@/lib/creativo-html'

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
type Previa = { nombre: string; codigo: string }

export function AgregarCreativo({ campanaId }: { campanaId: string }) {
  const puede = usePuede('comercial', 'crear')
  const fileRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [codeNombre, setCodeNombre] = useState('')
  // Creativo en vista previa (null = modal cerrado).
  const [previa, setPrevia] = useState<Previa | null>(null)

  if (!puede) return null

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Toda imagen se convierte al creativo HTML adaptativo (como en Creativos)
      // y se muestra en vista previa antes de subir.
      setPrevia({ nombre: f.name, codigo: imagenAHtml(dataUrl, f.name) })
    }
    reader.readAsDataURL(f)
  }

  function previsualizarCodigo() {
    if (!codigo.trim()) return
    setPrevia({ nombre: codeNombre.trim() || 'Creativo (código)', codigo })
  }

  async function confirmarSubida() {
    if (!previa) return
    setSubiendo(true)
    try {
      await crearCreatividadApi({
        campanaId,
        nombre: previa.nombre,
        codigo: previa.codigo,
        formato: 'text/html',
      })
      toast.success('Creativo agregado')
      setPrevia(null)
      setCodigo('')
      setCodeNombre('')
      setCodeOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir')
    }
    setSubiendo(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <Button size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Imagen
        </Button>
        <Button size="sm" variant="secondary" disabled={subiendo} onClick={() => setCodeOpen((v) => !v)}>
          <Code2 className="h-3.5 w-3.5" /> Código
        </Button>
      </div>

      {codeOpen && (
        <div className="space-y-2 rounded-md border border-border bg-surface-2 p-2.5">
          <input
            value={codeNombre}
            onChange={(e) => setCodeNombre(e.target.value)}
            placeholder="Nombre del creativo (opcional)"
            className="h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <textarea
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Pega aquí el código del creativo (HTML/UTF)…"
            rows={5}
            className="w-full rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCodeOpen(false)}>Cancelar</Button>
            <Button size="sm" disabled={!codigo.trim() || subiendo} onClick={previsualizarCodigo}>
              <Eye className="h-3.5 w-3.5" /> Vista previa
            </Button>
          </div>
        </div>
      )}

      {/* Modal de vista previa del creativo a subir */}
      <Modal
        open={!!previa}
        onOpenChange={(v) => { if (!v && !subiendo) setPrevia(null) }}
        title="Vista previa del creativo"
        subtitle={previa?.nombre}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={subiendo} onClick={() => setPrevia(null)}>Cancelar</Button>
            <Button size="sm" disabled={subiendo} onClick={confirmarSubida}>
              <Upload className="h-3.5 w-3.5" /> {subiendo ? 'Subiendo…' : 'Subir creativo'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-[12px] text-muted">Así se verá el creativo en la pantalla:</p>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            {previa && (
              <iframe
                title="Vista previa del creativo"
                srcDoc={previa.codigo}
                // Sandbox: renderiza el creativo pero aislado (sin acceso a la
                // página ni navegación); permite scripts para que el HTML se vea
                // como en el player, sin same-origin.
                sandbox="allow-scripts"
                className="h-[360px] w-full bg-black"
              />
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
