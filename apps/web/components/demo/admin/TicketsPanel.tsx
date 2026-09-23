'use client'

import { useEffect, useState } from 'react'
import { LifeBuoy, Plus, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import {
  crearTicketApi,
  type Ticket,
  type EstadoTicket,
  type PrioridadTicket,
} from '@/lib/data/tickets-api'
import { textoDeEstado, formularioValido } from '@/components/demo/admin/tickets-ui'

// ============================================================================
//  TicketsPanel — ADR 0038, tarea 7: el dueño de la instancia escribe una
//  incidencia a AS OOH desde aquí y ve si ya se la contestaron. Este
//  componente solo PINTA: la frase y el tono del resumen salen de
//  `tickets-ui.ts`, que sí tiene pruebas (`vitest.config.ts` no monta jsdom,
//  ver CLAUDE.md). Mismo criterio que `ActualizacionesPanel.tsx`.
//
//  GET/POST /api/tickets exige `administracion:ver`/`:crear`
//  (`app/api/tickets/route.ts`). Si el servidor responde 403, se explica por
//  qué en vez de esfumarse -- mismo criterio que `ActualizacionesPanel.tsx` y
//  `OrganizacionesPanel.tsx:59-66`.
//
//  Lo que un ticket contestado trae (`respuesta`, `respondidoEn`) se pinta
//  siempre que exista: es lo que el cliente viene a ver, y ocultarlo deja la
//  pantalla sirviendo solo para escribir a un buzón mudo.
// ============================================================================

const TONO_CLASE = {
  ok: 'border-success/30 bg-success/10 text-ink',
  alerta: 'border-warning/40 bg-warning/10 text-ink',
  info: 'border-border bg-surface-2 text-ink',
} as const

const ESTADO_LABEL: Record<EstadoTicket, string> = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
}
const ESTADO_CLASE: Record<EstadoTicket, string> = {
  ABIERTO: 'border-warning/40 bg-warning/10 text-ink',
  EN_PROCESO: 'border-border bg-surface-2 text-ink',
  RESUELTO: 'border-success/30 bg-success/10 text-ink',
  CERRADO: 'border-border bg-surface-2 text-muted',
}
const PRIORIDAD_LABEL: Record<PrioridadTicket, string> = {
  BAJA: 'Baja',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
}
const PRIORIDADES: PrioridadTicket[] = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE']

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export function TicketsPanel({ onToast }: { onToast: (m: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [status, setStatus] = useState<'cargando' | 'ok' | 'sin-permiso' | 'error'>('cargando')
  const [abierto, setAbierto] = useState(false)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadTicket>('NORMAL')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    try {
      // Fetch crudo, no `listarTicketsApi()`: aquí hace falta EL STATUS, no
      // solo el cuerpo, para distinguir "sin permiso" de un fallo real --
      // mismo criterio que `ActualizacionesPanel.tsx:cargar()`.
      const r = await fetch('/spaces-dooh/api/tickets/', { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) { setStatus('sin-permiso'); return }
      if (!r.ok) { setStatus('error'); return }
      setTickets(await r.json())
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => { void cargar() }, [])

  async function abrirTicket() {
    // Segunda barrera, no la única: el controlador (`tickets-controller.ts`,
    // `.strict()`) es quien de verdad decide. Esto solo evita el viaje de red
    // de un formulario que YA SABEMOS que el servidor va a rechazar.
    if (!formularioValido(asunto, cuerpo)) return
    setEnviando(true)
    setError(null)
    try {
      const nuevo = await crearTicketApi({ asunto: asunto.trim(), cuerpo: cuerpo.trim(), prioridad })
      setTickets((prev) => [nuevo, ...(prev ?? [])])
      setAsunto(''); setCuerpo(''); setPrioridad('NORMAL')
      setAbierto(false)
      onToast(`Ticket abierto: ${nuevo.folio}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el ticket')
    }
    setEnviando(false)
  }

  // Sin permiso: se explica en vez de esfumarse, y se dice a quién pedírselo.
  // No cambia ningún permiso -- el servidor sigue respondiendo 403 igual.
  if (status === 'sin-permiso') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-muted" /> Soporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[12px] text-muted">
            Ver y abrir tickets de soporte está reservado a quien tenga el permiso de{' '}
            <b className="text-ink">Administración → ver</b>. Pídeselo a quien administre los
            roles y permisos de tu organización.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-muted" /> Soporte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'cargando' ? (
          <div className="h-24 animate-pulse rounded bg-surface-2" />
        ) : status === 'error' || !tickets ? (
          <p className="text-[13px] text-error">No se pudieron cargar tus tickets de soporte.</p>
        ) : (
          <>
            {(() => {
              const { tono, texto } = textoDeEstado(tickets)
              return <div className={`rounded border px-3 py-2 text-[13px] ${TONO_CLASE[tono]}`}>{texto}</div>
            })()}

            {!abierto ? (
              <Button size="sm" onClick={() => setAbierto(true)}>
                <Plus className="h-3.5 w-3.5" /> Nuevo ticket
              </Button>
            ) : (
              <div className="space-y-2.5 rounded-md border border-border bg-bg p-3">
                <div>
                  <label className="mb-1 block text-[11px] text-muted">Asunto</label>
                  <input className={inputCls} value={asunto} onChange={(e) => setAsunto(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted">Cuéntanos qué pasa</label>
                  <textarea
                    className={`${inputCls} h-auto py-2 leading-snug`}
                    rows={3}
                    maxLength={4000}
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted">Prioridad</label>
                  <select
                    className={inputCls}
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>
                    ))}
                  </select>
                </div>
                {error && <p className="text-[12px] text-error">{error}</p>}
                <div className="flex justify-end gap-2 pt-0.5">
                  <Button size="sm" variant="secondary" onClick={() => { setAbierto(false); setError(null) }}>
                    Cancelar
                  </Button>
                  <Button size="sm" disabled={!formularioValido(asunto, cuerpo) || enviando} onClick={abrirTicket}>
                    {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Abrir ticket
                  </Button>
                </div>
              </div>
            )}

            <ul className="space-y-2">
              {tickets.length === 0 && !abierto && (
                <li className="text-[12px] text-muted">Aquí verás tus tickets en cuanto abras el primero.</li>
              )}
              {tickets.map((t) => (
                <li key={t.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="demo-num text-[11px] text-muted">{t.folio}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[11px] ${ESTADO_CLASE[t.estado]}`}>
                        {ESTADO_LABEL[t.estado]}
                      </span>
                      <span className="text-[11px] text-muted">{PRIORIDAD_LABEL[t.prioridad]}</span>
                    </div>
                    <span className="text-[11px] text-muted">{formatearFecha(t.creadoEn)}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-medium text-ink">{t.asunto}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-muted">{t.cuerpo}</p>

                  {/* Un ticket contestado trae `respuesta` y `respondidoEn`: es
                      lo que el cliente vino a ver, y si no se enseña la
                      pantalla solo sirve para escribir a un buzón mudo
                      (tarea-7-brief.md). */}
                  {t.respuesta ? (
                    <div className="mt-2 rounded border border-border bg-surface-2 px-2.5 py-2">
                      <p className="text-[11px] font-medium text-ink">
                        Respuesta de AS OOH · {formatearFecha(t.respondidoEn)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-ink">{t.respuesta}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted">Esperando respuesta de AS OOH.</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
