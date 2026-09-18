'use client'

import { useState } from 'react'
import { PackagePlus, CheckCircle2, Upload, FilePlus2, Table2, FileSignature } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ImportarInventarioDialog } from '@/components/demo/inventario/ImportarInventarioDialog'
import { NuevaPantallaForm } from '@/components/demo/inventario/NuevaPantallaForm'
import { InventarioTabla } from '@/components/demo/inventario/InventarioTabla'
import { ContratoWizard } from '@/components/demo/inventario/ContratoWizard'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'

// Clases de un botón del selector de vía, en UN solo sitio a propósito: son
// cuatro botones con la misma pinta, y cuatro copias de la misma cadena de
// clases es la forma segura de que en un mes tengan tres pintas distintas.
//
// La pastilla activa es la BLANCA y el riel es el crema, no al revés. Antes el
// activo llevaba `bg-surface-2` (crema) dentro de un contenedor `bg-surface`
// (blanco): más oscuro que su propio fondo, así que se leía HUNDIDO — justo lo
// contrario del relieve que se buscaba. Invertir figura y fondo es lo que hace
// que la elevación vaya en la dirección que espera quien mira.
function claseVia(activa: boolean): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded border px-3.5 py-2',
    // Solo color y sombra en la transición: animar la caja movería el texto.
    'transition-[background-color,border-color,box-shadow,color] duration-150',
    // Estos botones no tenían NINGUNA marca de foco. `ring-accent` es la
    // convención que ya documenta `demo.css:141` para los controles.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    activa
      ? 'border-border-strong bg-surface font-medium text-ink shadow-sm'
      : 'border-transparent text-muted hover:border-border hover:bg-surface hover:text-ink',
  )
}

// Pantalla "Inventario" (solo Dueño). Reemplaza al modal: las vías
// — contrato+pantalla, carga masiva y alta manual — viven aquí, en la página.
export default function AgregarInventarioPage() {
  const { sesion } = useSesionCtx()
  const [modo, setModo] = useState<'lista' | 'contrato' | 'masiva' | 'manual'>('lista')
  const [resetKey, setResetKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  // Solo el Dueño. La nav ya lo oculta para otros roles; esto cubre el acceso
  // por URL directa.
  if (sesion && sesion.usuario.rol !== 'DUENO') {
    return (
      <div className="w-full p-6">
        <h1 className="text-lg font-semibold text-ink">Inventario</h1>
        <p className="mt-2 text-[13px] text-muted">Esta sección es exclusiva del Dueño.</p>
      </div>
    )
  }

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  // Terminar de agregar pantallas devuelve a la lista: el resultado del alta se
  // ve donde vive el inventario, no en el formulario que acabas de usar. Además
  // deja el formulario limpio (resetKey) para la próxima carga.
  function alInventario(msg: string) {
    notify(msg)
    setResetKey((k) => k + 1)
    setModo('lista')
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

      {/* Selector de vía — pastilla elevada sobre riel hundido.
          El `gap-3` y el `p-1.5` son la separación. Iba en `gap-1.5`/`p-1`, que
          ya era mejor que el `p-0.5` original con los cuatro pegados, pero
          seguía leyéndose como un bloque: a 12 px cada pastilla se lee sola y
          el riel sigue diciendo que son opciones del mismo grupo. */}
      <div className="inline-flex gap-3 rounded-md border border-border bg-surface-2 p-1.5 text-[13px]">
        <button type="button" onClick={() => setModo('lista')} className={claseVia(modo === 'lista')}>
          <Table2 className="h-3.5 w-3.5" /> Inventario
        </button>
        <button type="button" onClick={() => setModo('contrato')} className={claseVia(modo === 'contrato')}>
          <FileSignature className="h-3.5 w-3.5" /> Contrato + pantalla
        </button>
        <button type="button" onClick={() => setModo('masiva')} className={claseVia(modo === 'masiva')}>
          <Upload className="h-3.5 w-3.5" /> Carga masiva
        </button>
        <button type="button" onClick={() => setModo('manual')} className={claseVia(modo === 'manual')}>
          <FilePlus2 className="h-3.5 w-3.5" /> Alta manual
        </button>
      </div>

      {modo === 'lista' ? (
        <InventarioTabla />
      ) : modo === 'contrato' ? (
        <ContratoWizard
          key={`contrato-${resetKey}`}
          onCreado={(s) => alInventario(`Contrato y pantalla "${s.nombre}" creados`)}
        />
      ) : modo === 'masiva' ? (
        <ImportarInventarioDialog
          key={`masiva-${resetKey}`}
          inline
          open
          onOpenChange={() => setResetKey((k) => k + 1)}
          onImportado={(r) => {
            // Con errores NO se salta: el detalle por fila —qué código falló y
            // por qué— solo se ve en el resumen del importador, y saltando a la
            // lista se perdería justo cuando hace falta. Las advertencias sí
            // dejan pasar: esas filas SÍ entraron, y el aviso cabe en el toast.
            if (r.errores > 0) return
            const partes = [
              r.creadas ? `${r.creadas} nueva${r.creadas === 1 ? '' : 's'}` : '',
              r.actualizadas ? `${r.actualizadas} actualizada${r.actualizadas === 1 ? '' : 's'}` : '',
              r.con_advertencias ? `${r.con_advertencias} con advertencias` : '',
            ].filter(Boolean)
            alInventario(`Inventario importado: ${partes.join(' · ') || 'sin cambios'}`)
          }}
        />
      ) : (
        <NuevaPantallaForm
          key={`manual-${resetKey}`}
          inline
          open
          onOpenChange={() => setResetKey((k) => k + 1)}
          onCreado={(s) => alInventario(`Pantalla "${s.nombre}" agregada al inventario`)}
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
