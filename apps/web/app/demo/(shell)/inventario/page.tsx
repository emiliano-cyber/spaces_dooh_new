'use client'

import { useState } from 'react'
import { PackagePlus, CheckCircle2, Upload, FilePlus2, Table2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ImportarInventarioDialog } from '@/components/demo/inventario/ImportarInventarioDialog'
import { NuevaPantallaForm } from '@/components/demo/inventario/NuevaPantallaForm'
import { InventarioTabla } from '@/components/demo/inventario/InventarioTabla'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'

// Pantalla "Agregar inventario" (solo Dueño). Reemplaza al modal: las dos vías
// — carga masiva y alta manual — viven aquí, en la página, sin diálogos.
export default function AgregarInventarioPage() {
  const { sesion } = useSesionCtx()
  const [modo, setModo] = useState<'lista' | 'masiva' | 'manual'>('lista')
  const [resetKey, setResetKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  // Solo el Dueño. La nav ya lo oculta para otros roles; esto cubre el acceso
  // por URL directa.
  if (sesion && sesion.usuario.rol !== 'DUENO') {
    return (
      <div className="w-full p-6">
        <h1 className="text-lg font-semibold text-ink">Agregar inventario</h1>
        <p className="mt-2 text-[13px] text-muted">Esta sección es exclusiva del Dueño.</p>
      </div>
    )
  }

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div className="w-full space-y-4 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <PackagePlus className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-ink">Inventario</h1>
          <p className="text-[13px] text-muted">
            Consulta el inventario completo, o agrega pantallas por carga masiva o alta manual.
          </p>
        </div>
      </div>

      {/* Selector de vía */}
      <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
        <button
          type="button"
          onClick={() => setModo('lista')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors duration-150',
            modo === 'lista' ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
          )}
        >
          <Table2 className="h-3.5 w-3.5" /> Inventario
        </button>
        <button
          type="button"
          onClick={() => setModo('masiva')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors duration-150',
            modo === 'masiva' ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
          )}
        >
          <Upload className="h-3.5 w-3.5" /> Carga masiva
        </button>
        <button
          type="button"
          onClick={() => setModo('manual')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors duration-150',
            modo === 'manual' ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
          )}
        >
          <FilePlus2 className="h-3.5 w-3.5" /> Alta manual
        </button>
      </div>

      {modo === 'lista' ? (
        <InventarioTabla />
      ) : modo === 'masiva' ? (
        <ImportarInventarioDialog
          key={`masiva-${resetKey}`}
          inline
          open
          onOpenChange={() => setResetKey((k) => k + 1)}
          onNuevaPantalla={() => setModo('manual')}
        />
      ) : (
        <NuevaPantallaForm
          key={`manual-${resetKey}`}
          inline
          open
          onOpenChange={() => setResetKey((k) => k + 1)}
          onCreado={(s) => {
            notify(`Pantalla "${s.nombre}" agregada al inventario`)
            setResetKey((k) => k + 1)
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}
