'use client'

import { useMemo, useState } from 'react'
import { History, User, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { EmptyState } from '@/components/demo/EmptyState'
import { useAcciones, formatFechaHora } from '@/lib/data/client'

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

      {/* Filtros: fecha · hora · quién */}
      <div className="flex flex-wrap items-center gap-2">
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
            className="inline-flex h-9 items-center gap-1 rounded border border-border-strong px-2.5 text-[12px] text-ink hover:bg-surface-2"
          >
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
        {acciones && (
          <span className="ml-auto text-[12px] text-muted">
            {lista.length} de {acciones.length}
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <History className="h-4 w-4 text-muted" />
          <CardTitle>Registro de acciones</CardTitle>
        </CardHeader>
        <CardContent>
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
            <p className="py-10 text-center text-[13px] text-muted">
              Ninguna acción coincide con los filtros.
            </p>
          ) : (
            <ol className="relative space-y-0">
              {lista.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* Línea de tiempo */}
                  {i < lista.length - 1 && (
                    <span className="absolute left-[15px] top-7 h-[calc(100%-12px)] w-px bg-border" aria-hidden />
                  )}
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted">
                    <User className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[13px] text-ink">
                      <span className="font-medium">{a.usuarioNombre}</span>{' '}
                      <span className="text-muted">·</span>{' '}
                      {a.accion}{' '}
                      <span className="text-ink">{a.entidad}</span>
                    </div>
                    <div className="demo-num mt-0.5 text-[11px] text-muted">
                      {formatFechaHora(a.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
