'use client'

import { useEffect, useState } from 'react'
import { LifeBuoy, Plus, Loader2 } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import {
  crearTicketApi,
  type Ticket,
  type EstadoTicket,
  type PrioridadTicket,
} from '@/lib/data/tickets-api'
import { textoDeEstado, formularioValido } from '@/components/demo/admin/tickets-ui'
import { Chip, TONO, type Tono } from './Chip'

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

// Tonos de `Chip.tsx`: `bg-success/10` no se genera sobre estos tokens (ver
// su cabecera), y la franja y los chips de estado salían sin color.
const TONO_CLASE = {
  ok: TONO.exito,
  alerta: TONO.aviso,
  info: 'border-border bg-surface-2 text-ink',
} as const

const ESTADO_LABEL: Record<EstadoTicket, string> = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  RESUELTO: 'Resuelto',
  CERRADO: 'Cerrado',
}
const ESTADO_TONO: Record<EstadoTicket, Tono> = {
  ABIERTO: 'aviso',
  EN_PROCESO: 'neutro',
  RESUELTO: 'exito',
  CERRADO: 'neutro',
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
  // OBLIG-01 · asunto y cuerpo, los dos que exige el servidor
  // (`tickets-controller.ts:25-26`). La prioridad trae NORMAL de inicio.
  const ob = useObligatorios({ asunto, cuerpo }, ['asunto', 'cuerpo'])

  async function cargar() {
    try {
      // Fetch crudo y no una función de `lib/data/tickets-api.ts`: aquí hace
      // falta EL STATUS, no solo el cuerpo, para distinguir "sin permiso" de un
      // fallo real -- mismo criterio que `ActualizacionesPanel.tsx:cargar()`.
      // Allí hubo un `listarTicketsApi()` que nadie llegó a llamar por esto
      // mismo, y se retiró el 23/09.
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
    //
    // Los vacíos los pinta `ob.validar()` en rojo; `formularioValido` sigue
    // siendo la regla probada en `tickets-ui.ts`.
    const completos = ob.validar()
    if (!completos || !formularioValido(asunto, cuerpo)) return
    setEnviando(true)
    setError(null)
    try {
      const nuevo = await crearTicketApi({ asunto: asunto.trim(), cuerpo: cuerpo.trim(), prioridad })
      setTickets((prev) => [nuevo, ...(prev ?? [])])
      setAsunto(''); setCuerpo(''); setPrioridad('NORMAL')
      ob.reiniciar()
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
      <CardColapsable
        id="admin.soporte"
        titulo="Soporte"
        icono={<LifeBuoy className="h-4 w-4 text-muted" />}
      >
          <p className="text-[12px] text-muted">
            Ver y abrir tickets de soporte está reservado a quien tenga el permiso de{' '}
            <b className="text-ink">Administración → ver</b>. Pídeselo a quien administre los
            roles y permisos de tu organización.
          </p>
      </CardColapsable>
    )
  }

  // El ticket a medio escribir vive en el estado de este componente, no en el
  // contenido: plegar no lo borra.
  return (
    <CardColapsable
      id="admin.soporte"
      titulo="Soporte"
      icono={<LifeBuoy className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
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
              <Button variant="success" size="sm" onClick={() => setAbierto(true)}>
                <Plus className="h-3.5 w-3.5" /> Nuevo ticket
              </Button>
            ) : (
              <div className="space-y-2.5 rounded-md border border-border bg-bg p-3">
                <Campo label="Asunto" obligatorio falta={ob.falta('asunto')}>
                  <input className={inputCls} value={asunto} onChange={(e) => setAsunto(e.target.value)} autoFocus />
                </Campo>
                <Campo label="Cuéntanos qué pasa" obligatorio falta={ob.falta('cuerpo')}>
                  <textarea
                    className={`${inputCls} h-auto py-2 leading-snug`}
                    rows={3}
                    maxLength={4000}
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                  />
                </Campo>
                <Campo label="Prioridad">
                  <select
                    className={inputCls}
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>
                    ))}
                  </select>
                </Campo>
                {error && <p className="text-[12px] text-error">{error}</p>}
                <div className="flex justify-end gap-2 pt-0.5">
                  <Button size="sm" variant="secondary" onClick={() => { setAbierto(false); setError(null); ob.reiniciar() }}>
                    Cancelar
                  </Button>
                  <Button size="sm" disabled={enviando} onClick={abrirTicket}>
                    {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Abrir ticket
                  </Button>
                </div>
              </div>
            )}

            <ul className="m-0 list-none space-y-2 p-0">
              {tickets.length === 0 && !abierto && (
                <li className="text-[12px] text-muted">Aquí verás tus tickets en cuanto abras el primero.</li>
              )}
              {tickets.map((t) => (
                <li key={t.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="demo-num text-[11px] text-muted">{t.folio}</span>
                      <Chip tono={ESTADO_TONO[t.estado]} punto>{ESTADO_LABEL[t.estado]}</Chip>
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
    </CardColapsable>
  )
}
