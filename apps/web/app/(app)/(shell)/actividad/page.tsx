'use client'

import { useMemo, useState } from 'react'
import { History, X } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { EmptyState } from '@/components/demo/EmptyState'
import { Paginacion, usePaginacion } from '@/components/demo/ui/Paginacion'
import { useAcciones, formatFechaHora, formatFecha } from '@/lib/data/client'
import { Button } from '@/components/demo/ui/Button'
import { Chip } from '@/components/demo/admin/Chip'
import { formatNumero } from '@/lib/formato-numero'

const selectCls =
  'h-9 rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Fecha local YYYY-MM-DD de un timestamp ISO (para comparar con <input type=date>).
function fechaLocal(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const horaLocal = (iso: string): number => new Date(iso).getHours()
const pad = (n: number) => String(n).padStart(2, '0')

// Bitácora de acciones (punto 2 de la reunión): cada proceso registra quién
// realizó la acción y cuándo. Filtrable por fecha, hora y usuario.
export default function ActividadPage() {
  const acciones = useAcciones()
  const [fUsuario, setFUsuario] = useState('')
  const [fFecha, setFFecha] = useState('')
  const [fHora, setFHora] = useState('')

  // Usuarios distintos presentes en la bitácora (para el filtro "quién").
  const usuarios = useMemo(
    () => Array.from(new Set((acciones ?? []).map((a) => a.usuarioNombre).filter(Boolean))).sort(),
    [acciones],
  )

  const lista = useMemo(() => {
    return (acciones ?? []).filter((a) => {
      if (fUsuario && a.usuarioNombre !== fUsuario) return false
      if (fFecha && fechaLocal(a.timestamp) !== fFecha) return false
      if (fHora !== '' && horaLocal(a.timestamp) !== Number(fHora)) return false
      return true
    })
  }, [acciones, fUsuario, fFecha, fHora])

  // M7: 168 entradas se pintaban de una vez. La bitácora solo crece, así que el
  // problema empeora con el uso.
  const pag = usePaginacion(lista, 25)

  const hayFiltro = !!fUsuario || !!fFecha || fHora !== ''
  function limpiar() {
    setFUsuario('')
    setFFecha('')
    setFHora('')
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Actividad</h1>
        <p className="mt-1 text-[13px] text-muted">
          Bitácora de acciones · quién hizo qué y cuándo
        </p>
      </div>

      {/* `px-0 pb-0` y el relleno en un `div` propio: así la paginación sigue
          a ras del borde de la tarjeta, como antes. La página actual vive en
          `usePaginacion`, aquí arriba, así que plegar no la reinicia.
          Los filtros viven DENTRO de la tarjeta, en la franja del Dashboard:
          antes flotaban sueltos entre el título y la tarjeta, con el conteo
          «19 de 19» alineado lejos de lo que contaba. El conteo pasa al
          resumen del encabezado, que se ve también con la tarjeta plegada. Su
          estado sigue en esta página, así que plegar no los borra. */}
      <CardColapsable
        id="actividad.registro"
        titulo="Registro de acciones"
        icono={<History className="h-4 w-4 text-muted" />}
        contentClassName="px-0 pb-0"
        resumen={acciones ? (
          <Chip tono={hayFiltro ? 'acento' : 'neutro'}>
            <span className="demo-num">{formatNumero(lista.length)} de {formatNumero(acciones.length)}</span>
          </Chip>
        ) : undefined}
      >
        <div className="px-4 pb-4">
          {/* Filtros: fecha · hora · quién */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-surface-2 px-4 py-2">
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              Fecha
              <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className={selectCls} />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              Hora
              <select value={fHora} onChange={(e) => setFHora(e.target.value)} className={selectCls}>
                <option value="">Toda hora</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{pad(h)}:00–{pad(h)}:59</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              Quién
              <select value={fUsuario} onChange={(e) => setFUsuario(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            {hayFiltro && (
              <button
                type="button"
                onClick={limpiar}
                className="m-0 ml-auto inline-flex h-9 cursor-pointer items-center gap-1 rounded border border-border-strong bg-surface px-2.5 text-[12px] text-ink hover:bg-surface-2"
              >
                <X className="h-3.5 w-3.5" /> Limpiar
              </button>
            )}
          </div>

          {!acciones ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : acciones.length === 0 ? (
            <EmptyState
              icon={History}
              titulo="Sin actividad todavía"
              detalle="Las acciones (reservar, confirmar, cerrar OT, facturar…) aparecerán aquí con su usuario y fecha."
            />
          ) : lista.length === 0 ? (
            // Con la salida al lado: antes era una frase sin nada que hacer.
            <EmptyState
              icon={History}
              titulo="Ninguna acción coincide con los filtros."
              className="py-8"
              accion={
                <Button variant="secondary" size="sm" onClick={limpiar}>
                  <X className="h-3.5 w-3.5" /> Limpiar filtros
                </Button>
              }
            />
          ) : (
            // Agrupada por día y en filas compactas, como las listas del
            // Dashboard. El agrupado es SOLO de pintado, sobre la página que
            // ya trae `usePaginacion`: no cambia ni el orden ni el corte de 25.
            // La hora va a la derecha como pastilla y la fecha la da el rótulo
            // del día; la fecha completa queda en el `title`.
            <ol className="m-0 list-none p-0">
              {pag.visibles.map((a, i) => {
                const dia = fechaLocal(a.timestamp)
                const nuevoDia = i === 0 || fechaLocal(pag.visibles[i - 1].timestamp) !== dia
                return (
                  <li key={a.id}>
                    {nuevoDia && (
                      <p className={`m-0 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted ${i === 0 ? '' : 'pt-4'}`}>
                        {rotuloDia(a.timestamp)}
                      </p>
                    )}
                    <div className={`flex items-center justify-between gap-3 py-2 ${nuevoDia ? '' : 'border-t border-border'}`}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <AvatarIniciales nombre={a.usuarioNombre} />
                        <div className="min-w-0 text-[13px] text-ink">
                          <span className="font-medium">{a.usuarioNombre}</span>{' '}
                          <span className="text-muted">·</span>{' '}
                          {a.accion}{' '}
                          <span className="text-ink">{a.entidad}</span>
                        </div>
                      </div>
                      <span
                        title={formatFechaHora(a.timestamp)}
                        className="demo-num shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                      >
                        {horaMinuto(a.timestamp)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        {/* Fuera del relleno para que la línea superior del control quede a
            ras del borde de la tarjeta, como en el resto de tablas. */}
        <Paginacion {...pag} etiqueta="acciones" />
      </CardColapsable>
    </div>
  )
}

// «Hoy», «Ayer» o la fecha, con el mismo criterio de día LOCAL que el filtro.
function rotuloDia(iso: string): string {
  const dia = fechaLocal(iso)
  const hoy = new Date()
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  if (dia === fechaLocal(hoy.toISOString())) return 'Hoy'
  if (dia === fechaLocal(ayer.toISOString())) return 'Ayer'
  return dia ? formatFecha(dia) : '—'
}

function horaMinuto(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Dos iniciales en vez del mismo icono de persona para todos: ayuda a
// distinguir quién de un vistazo. Sin un color por persona a propósito —el
// color no carga significado en esta app—.
function AvatarIniciales({ nombre }: { nombre: string }) {
  const iniciales = (nombre ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[10px] font-semibold text-muted"
    >
      {iniciales || '·'}
    </span>
  )
}
