'use client'

import { useState } from 'react'
import { Upload, PlusSquare, PackagePlus, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { ImportarInventarioDialog } from './ImportarInventarioDialog'
import { NuevaPantallaForm } from './NuevaPantallaForm'

// Sección "Agregar inventario" (debajo del dashboard): dos flujos — importar un
// archivo Excel/CSV en masa, o dar de alta una sola pantalla con el formulario.
export function AgregarInventario() {
  const [importOpen, setImportOpen] = useState(false)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <PackagePlus className="h-4 w-4 text-muted" />
        <CardTitle>Agregar inventario</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-[13px] text-muted">
          Carga pantallas a tu inventario por archivo (Excel/CSV) o una por una.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-start gap-3 rounded-md border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-2 text-ink">
              <Upload className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-ink">Importar archivo</span>
              <span className="block text-[12px] text-muted">Excel (.xlsx) o CSV en masa, con validaciones y resumen</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setNuevaOpen(true)}
            className="flex items-start gap-3 rounded-md border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-2 text-ink">
              <PlusSquare className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-[14px] font-medium text-ink">Nueva pantalla</span>
              <span className="block text-[12px] text-muted">Alta manual con formulario de 5 secciones</span>
            </span>
          </button>
        </div>
      </CardContent>

      <ImportarInventarioDialog open={importOpen} onOpenChange={setImportOpen} />
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
