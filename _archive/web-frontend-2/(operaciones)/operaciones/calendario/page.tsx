'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface OT { id: string; folio: string; tipo: string; prioridad: string; estatus: string }

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const PRIORIDAD_C: Record<string, { bg: string; color: string }> = {
  URGENTE: { bg: 'rgba(163,45,45,0.35)', color: '#B91C1C' },
  ALTA:    { bg: 'rgba(133,79,11,0.35)', color: '#B45309' },
  NORMAL:  { bg: 'rgba(10,102,255,0.2)', color: '#0A66FF' },
  BAJA:    { bg: 'rgba(90,90,114,0.2)', color: '#71717A' },
}

const TIPO_SHORT: Record<string, string> = {
  MONTAJE_LONA: 'M.Lona', MONTAJE_DIGITAL: 'M.Digital', DESMONTAJE: 'Desmont.',
  MANTENIMIENTO_PREVENTIVO: 'Mtto.P', MANTENIMIENTO_CORRECTIVO: 'Mtto.C',
  HERRERIA: 'Herr.', ELECTRICO: 'Eléct.', INSPECCION: 'Insp.', OTRO: 'Otro',
}

/** Lunes de la semana que contiene `date` (ISO: lunes = 1) */
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Dom, 1=Lun…
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtHeader(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function fmtRangeTitle(lunes: Date, domingo: Date): string {
  const m1 = lunes.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
  const m2 = domingo.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${m1} – ${m2}`
}

export default function CalendarioPage() {
  const isMobile = useIsMobile()
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))

  const domingo = addDays(weekStart, 6)
  const desde = weekStart.toISOString()
  const hasta = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate(), 23, 59, 59).toISOString()

  const { data: calendarioData, isLoading } = useQuery({
    queryKey: ['calendario', toISO(weekStart)],
    queryFn: () => apiFetch<Record<string, OT[]>>(`/ordenes-trabajo/calendario?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  })

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayISO = toISO(new Date())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.75rem' : 0 }}>
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.125rem' }}>Calendario de OTs</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{fmtRangeTitle(weekStart, domingo)}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.45rem 0.875rem', ...(isMobile ? { flex: 1 } : {}) }}
          >
            {isMobile ? '←' : '← Anterior'}
          </button>
          <button
            onClick={() => setWeekStart(getMondayOf(new Date()))}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.45rem 0.75rem', ...(isMobile ? { flex: 1 } : {}) }}
          >
            Hoy
          </button>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.875rem', padding: '0.45rem 0.875rem', ...(isMobile ? { flex: 1 } : {}) }}
          >
            {isMobile ? '→' : 'Siguiente →'}
          </button>
        </div>
      </div>

      {/* Agenda vertical — móvil */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {days.map((day, i) => {
            const iso = toISO(day)
            const ots = calendarioData?.[iso] ?? []
            const isToday = iso === todayISO
            return (
              <div key={iso} style={{ background: 'var(--bg-surface)', border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.625rem 0.875rem', borderBottom: ots.length > 0 ? '1px solid var(--border)' : 'none', background: isToday ? 'rgba(10,102,255,0.06)' : 'transparent' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--fg)' }}>{DIAS_LARGO[i]}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{fmtHeader(day)}</span>
                  {isToday && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', marginLeft: 'auto' }}>HOY</span>}
                </div>
                {isLoading ? (
                  <div style={{ padding: '0.75rem 0.875rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>…</div>
                ) : ots.length === 0 ? (
                  <div style={{ padding: '0.625rem 0.875rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>Sin órdenes</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.625rem 0.875rem' }}>
                    {ots.map((ot) => {
                      const pc = PRIORIDAD_C[ot.prioridad] ?? PRIORIDAD_C.NORMAL
                      return (
                        <Link
                          key={ot.id}
                          href={`/operaciones/ordenes/${ot.id}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', ...pc, borderRadius: '7px', padding: '0.5rem 0.625rem', border: `1px solid ${pc.color}44` }}
                        >
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8125rem' }}>{ot.folio}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.85, flex: 1 }}>
                            {ot.tipo.split(',').map((t) => TIPO_SHORT[t.trim()] ?? t.trim()).join(' + ')}
                          </span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{ot.estatus.replace('_', ' ')}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
      /* Week grid — escritorio */
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem', overflow: 'hidden' }}>
        {/* Day headers */}
        {days.map((day, i) => {
          const iso = toISO(day)
          const isToday = iso === todayISO
          return (
            <div key={iso} style={{ textAlign: 'center', paddingBottom: '0.625rem', borderBottom: '1px solid var(--border)', marginBottom: '0.625rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DIAS[i]}</div>
              <div style={{
                fontSize: '1.125rem', fontWeight: 700, marginTop: '0.125rem',
                color: isToday ? '#fff' : 'var(--fg)',
                background: isToday ? 'var(--accent)' : 'transparent',
                borderRadius: '50%', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {day.getDate()}
              </div>
            </div>
          )
        })}

        {/* OT chips per day */}
        {days.map((day) => {
          const iso = toISO(day)
          const ots = calendarioData?.[iso] ?? []
          const isToday = iso === todayISO

          return (
            <div key={iso} style={{ minHeight: 120, display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.25rem', background: isToday ? 'rgba(10,102,255,0.04)' : 'transparent', borderRadius: '6px' }}>
              {isLoading ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.7rem', textAlign: 'center', paddingTop: '1rem' }}>…</div>
              ) : ots.length === 0 ? null : (
                ots.map((ot) => {
                  const pc = PRIORIDAD_C[ot.prioridad] ?? PRIORIDAD_C.NORMAL
                  return (
                    <Link
                      key={ot.id}
                      href={`/operaciones/ordenes/${ot.id}`}
                      style={{ display: 'block', textDecoration: 'none', ...pc, borderRadius: '5px', padding: '0.3rem 0.5rem', fontSize: '0.7rem', lineHeight: 1.3, transition: 'opacity 0.15s', border: `1px solid ${pc.color}44` }}
                      title={`${ot.folio} — ${ot.estatus}`}
                    >
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.65rem', marginBottom: '0.1rem' }}>{ot.folio}</div>
                      <div style={{ opacity: 0.85 }}>{ot.tipo.split(',').map((t) => TIPO_SHORT[t.trim()] ?? t.trim()).join('+')}</div>
                    </Link>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(PRIORIDAD_C).map(([p, c]) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.color}44`, display: 'inline-block' }} />
            {p.charAt(0) + p.slice(1).toLowerCase()}
          </div>
        ))}
      </div>
    </div>
  )
}
