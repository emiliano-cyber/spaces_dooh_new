'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Code2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { crearCreatividadApi } from '@/lib/data/estado-api'
import { imagenAHtml } from '@/lib/creativo-html'

// ============================================================================
//  Alta rápida de creativos desde la FICHA DE CAMPAÑA (Bloque UX): subir una
//  imagen o pegar código HTML sin salir a la pantalla de Creativos. Reusa el
//  mismo endpoint y la misma conversión imagen→HTML que la pantalla de
//  Creativos, así que el resultado es idéntico.
//
//  Gateado con `comercial.crear` (igual que en la pantalla de Creativos). Si el
//  rol no puede, no se muestra nada.
// ============================================================================

export function AgregarCreativo({ campanaId }: { campanaId: string }) {
  const puede = usePuede('comercial', 'crear')
  const fileRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [codeNombre, setCodeNombre] = useState('')

  if (!puede) return null

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB')
      return
    }
    setSubiendo(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        // Toda imagen subida se convierte a un creativo HTML (no se guarda como imagen).
        const dataUrl = reader.result as string
        await crearCreatividadApi({
          campanaId,
          nombre: f.name,
          codigo: imagenAHtml(dataUrl, f.name),
          formato: 'text/html',
        })
        toast.success('Creativo agregado')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo subir')
      }
      setSubiendo(false)
    }
    reader.readAsDataURL(f)
  }

  async function guardarCodigo() {
    if (!codigo.trim()) return
    setSubiendo(true)
    try {
      await crearCreatividadApi({
        campanaId,
        nombre: codeNombre.trim() || 'Creativo (código)',
        codigo,
        formato: 'text/html',
      })
      setCodigo('')
      setCodeNombre('')
      setCodeOpen(false)
      toast.success('Creativo agregado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
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
            <Button size="sm" disabled={!codigo.trim() || subiendo} onClick={guardarCodigo}>
              {subiendo ? 'Guardando…' : 'Guardar código'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
