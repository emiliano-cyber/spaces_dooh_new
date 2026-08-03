'use client'

import { useState } from 'react'
import { PackagePlus, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { ImportarInventarioDialog } from './ImportarInventarioDialog'
import { NuevaPantallaForm } from './NuevaPantallaForm'
import { usePuede } from '@/components/demo/shell/SesionContext'

// Sección "Agregar inventario" (debajo del dashboard). Un botón abre el modal de
// carga masiva (Modal 1), que a su vez ofrece descargar plantilla, subir archivo
// o abrir el formulario manual de "Nueva pantalla".
export function AgregarInventario() {
  const [importOpen, setImportOpen] = useState(false)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const puedeCrear = usePuede('comercial', 'crear')

  if (!puedeCrear) return null

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
            <PackagePlus className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-ink">Agregar inventario</div>
            <div className="text-[13px] text-muted">
              Carga masiva por Excel/CSV con plantilla, o alta manual de una pantalla.
            </div>
          </div>
        </div>
        {/* Dos entradas explícitas. El alta manual colgaba de un botón DENTRO
            del diálogo de carga masiva, que se quitó: pedía entrar a "importar"
            para descubrir que también se podía dar de alta una sola. */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setNuevaOpen(true)}>
            <PackagePlus className="h-4 w-4" /> Alta manual
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <PackagePlus className="h-4 w-4" /> Carga masiva
          </Button>
        </div>
      </CardContent>

      {/* Modal 1 — carga masiva */}
      <ImportarInventarioDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Formulario manual de 5 tabs */}
      <NuevaPantallaForm
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        onCreado={(s) => notify(`Pantalla "${s.nombre}" agregada al inventario`)}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {toast}</span>
        </div>
      )}
    </Card>
  )
}
