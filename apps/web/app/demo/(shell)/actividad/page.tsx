'use client'

import { History, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { EmptyState } from '@/components/demo/EmptyState'
import { useAcciones, formatFechaHora } from '@/lib/data/client'

// Bitácora de acciones (punto 2 de la reunión): cada proceso registra quién
// realizó la acción y cuándo. Se alimenta en vivo de las mutaciones del demo.
export default function ActividadPage() {
  const acciones = useAcciones()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Actividad</h1>
        <p className="mt-1 text-[13px] text-muted">
          Bitácora de acciones · quién hizo qué y cuándo
        </p>
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
          ) : (
            <ol className="relative space-y-0">
              {acciones.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* Línea de tiempo */}
                  {i < acciones.length - 1 && (
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
