'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenciaRV {
  id: string
  fotoUrlSigned: string
  timestamp: string
  lat?: number
  lng?: number
  tipo: string
}

interface ChecklistItemRV {
  id: string
  texto: string
  completado: boolean
  completadoEn?: string
}

interface OTRV {
  id: string
  folio: string
  tipo: string
  descripcion: string
  estatus: string
  prioridad: string
  fechaProgramada?: string
  fechaInicio?: string
  fechaCompletada?: string
  notas?: string
  checklistJson: ChecklistItemRV[]
  evidencias: EvidenciaRV[]
}

interface TrafficOrderRV {
  id: string
  folio: string
  estadoTecnico: string
  creadoEn: string
}

interface CampanaRV {
  id: string
  folio: string
  nombre: string
  tipoCampana: string
  estadoComercial: string
  fechaInicio: string
  fechaFin: string
  reportePublicacionUrl?: string
  presupuestoBruto?: string
  cliente?: { nombre: string }
}

interface ReporteVisualData {
  campana: CampanaRV
  ots: OTRV[]
  trafficOrders: TrafficOrderRV[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_OT_LABELS: Record<string, string> = {
  MONTAJE_LONA: 'Montaje de lona',
  MONTAJE_DIGITAL: 'Montaje digital',
  DESMONTAJE: 'Desmontaje',
  MANTENIMIENTO_PREVENTIVO: 'Mtto. preventivo',
  MANTENIMIENTO_CORRECTIVO: 'Mtto. correctivo',
  HERRERIA: 'Herrería',
  ELECTRICO: 'Eléctrico',
  INSPECCION: 'Inspección',
  OTRO: 'Otro',
}

const OT_ESTATUS_C: Record<string, string> = {
  PENDIENTE: '#4a4a6a',
  ASIGNADA: '#6c63ff',
  EN_PROCESO: '#fbbf24',
  COMPLETADA: '#b8f000',
  CANCELADA: '#ff5f5f',
}

const TO_ESTATUS_C: Record<string, string> = {
  PENDIENTE: '#4a4a6a',
  EN_PUBLICACION: '#6c63ff',
  PAUSADA: '#fbbf24',
  FINALIZADA: '#b8f000',
  ERROR: '#ff5f5f',
}

const TIPO_C: Record<string, { bg: string; color: string }> = {
  OOH:     { bg: 'rgba(108,99,255,0.15)', color: '#6c63ff' },
  DOOH:    { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  HIBRIDA: { bg: 'rgba(184,240,0,0.12)',  color: '#b8f000' },
}

function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function fmtShort(d?: string) {
  return d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'
}

// ─── Gantt chart ──────────────────────────────────────────────────────────────

function GanttChart({
  campana,
  ots,
  trafficOrders,
}: {
  campana: CampanaRV
  ots: OTRV[]
  trafficOrders: TrafficOrderRV[]
}) {
  const campaignStart = new Date(campana.fechaInicio)
  const campaignEnd = new Date(campana.fechaFin)
  const today = new Date()
  const totalMs = campaignEnd.getTime() - campaignStart.getTime()
  if (totalMs <= 0) return null

  const toPct = (date: Date) =>
    Math.max(0, Math.min(100, ((date.getTime() - campaignStart.getTime()) / totalMs) * 100))

  const widthPct = (start: Date, end: Date) =>
    Math.max(0.8, toPct(end) - toPct(start))

  const todayPct = toPct(today)
  const showToday = today > campaignStart && today < campaignEnd

  // Month labels
  const months: { label: string; pct: number }[] = []
  const cur = new Date(campaignStart)
  cur.setDate(1)
  cur.setMonth(cur.getMonth() + 1)
  while (cur < campaignEnd) {
    months.push({
      label: cur.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      pct: toPct(new Date(cur)),
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Start / end labels
  const startLabel = campaignStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const endLabel = campaignEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

  interface GanttRow {
    label: string
    sublabel: string
    color: string
    left: number
    width: number
    inProgress: boolean
  }

  const rows: GanttRow[] = []

  // Campaign row
  rows.push({
    label: campana.folio,
    sublabel: 'Campaña completa',
    color: '#3a3a5a',
    left: 0,
    width: 100,
    inProgress: false,
  })

  // OT rows
  for (const ot of ots) {
    const start = ot.fechaProgramada
      ? new Date(ot.fechaProgramada)
      : ot.fechaInicio
      ? new Date(ot.fechaInicio)
      : campaignStart
    const end = ot.fechaCompletada
      ? new Date(ot.fechaCompletada)
      : today < campaignEnd
      ? today
      : campaignEnd

    rows.push({
      label: ot.folio,
      sublabel: TIPO_OT_LABELS[ot.tipo] ?? ot.tipo,
      color: OT_ESTATUS_C[ot.estatus] ?? '#4a4a6a',
      left: toPct(start),
      width: widthPct(start, end),
      inProgress: ot.estatus !== 'COMPLETADA' && ot.estatus !== 'CANCELADA',
    })
  }

  // Traffic rows
  for (const to of trafficOrders) {
    const end =
      to.estadoTecnico === 'FINALIZADA'
        ? campaignEnd
        : today < campaignEnd
        ? today
        : campaignEnd
    rows.push({
      label: to.folio,
      sublabel: `Traffic · ${to.estadoTecnico.replace(/_/g, ' ')}`,
      color: TO_ESTATUS_C[to.estadoTecnico] ?? '#4a4a6a',
      left: 0,
      width: widthPct(campaignStart, end),
      inProgress: to.estadoTecnico !== 'FINALIZADA',
    })
  }

  const LABEL_W = 148

  return (
    <div>
      {/* Date labels row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.375rem' }}>
        <div style={{ width: LABEL_W, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 20 }}>
          <span style={{ position: 'absolute', left: 0, fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{startLabel}</span>
          {months.map((m, i) => (
            <span key={i} style={{
              position: 'absolute', left: `${m.pct}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {m.label}
            </span>
          ))}
          <span style={{ position: 'absolute', right: 0, fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{endLabel}</span>
        </div>
      </div>

      {/* Grid lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minHeight: 34 }}>
            {/* Label */}
            <div style={{ width: LABEL_W, flexShrink: 0, textAlign: 'right', paddingRight: '0.5rem' }}>
              <div style={{
                fontFamily: 'monospace', fontSize: '0.73rem', fontWeight: 700,
                color: i === 0 ? 'var(--muted)' : 'var(--fg)', lineHeight: 1.25,
              }}>
                {row.label}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', lineHeight: 1.2 }}>
                {row.sublabel}
              </div>
            </div>

            {/* Track */}
            <div style={{
              flex: 1, height: 26,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 5,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Today marker */}
              {showToday && (
                <div style={{
                  position: 'absolute', left: `${todayPct}%`,
                  top: 0, bottom: 0, width: 1,
                  background: 'rgba(255,255,255,0.25)', zIndex: 3,
                  pointerEvents: 'none',
                }} />
              )}

              {/* Bar */}
              <div
                title={`${row.label} — ${row.sublabel}`}
                style={{
                  position: 'absolute',
                  left: `${row.left}%`,
                  width: `${row.width}%`,
                  top: 3, bottom: 3,
                  borderRadius: 4,
                  background: row.inProgress
                    ? `repeating-linear-gradient(45deg, ${row.color}dd, ${row.color}dd 5px, ${row.color}55 5px, ${row.color}55 10px)`
                    : row.color,
                  opacity: i === 0 ? 0.55 : 1,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '1rem', marginTop: '0.875rem',
        paddingLeft: LABEL_W + 10, flexWrap: 'wrap',
      }}>
        {([
          ['Completada', '#b8f000'],
          ['En proceso', '#fbbf24'],
          ['Asignada', '#6c63ff'],
          ['Pendiente', '#4a4a6a'],
          ['Cancelada', '#ff5f5f'],
        ] as [string, string][]).map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{label}</span>
          </div>
        ))}
        {showToday && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Hoy</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  value,
  label,
  sub,
  color,
}: {
  value: string
  label: string
  sub: string
  color: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '1.125rem 1rem', textAlign: 'center',
    }}>
      <div style={{
        fontSize: '1.875rem', fontWeight: 800, color,
        fontFamily: 'monospace', lineHeight: 1, marginBottom: '0.375rem',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{sub}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReporteVisual({ campanaId }: { campanaId: string }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxCaption, setLightboxCaption] = useState('')

  const { data, isLoading } = useQuery<ReporteVisualData>({
    queryKey: ['reporte-visual', campanaId],
    queryFn: () => apiFetch(`/campanas/${campanaId}/reporte-visual`),
    staleTime: 60_000,
  })

  if (isLoading || !data) {
    return (
      <div style={{
        color: 'var(--muted)', fontSize: '0.875rem',
        padding: '3rem', textAlign: 'center',
      }}>
        Generando reporte…
      </div>
    )
  }

  const { campana, ots = [], trafficOrders = [] } = data
  if (!campana) return (
    <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '3rem', textAlign: 'center' }}>
      Sin datos de campaña
    </div>
  )

  // KPIs
  const otsCompletadas = ots.filter((o) => o.estatus === 'COMPLETADA').length
  const totalFotos = ots.reduce((s, o) => s + o.evidencias.length, 0)
  const totalTareas = ots.reduce((s, o) => s + (Array.isArray(o.checklistJson) ? o.checklistJson.length : 0), 0)
  const tareasOk = ots.reduce((s, o) => s + (Array.isArray(o.checklistJson) ? o.checklistJson.filter((i) => i.completado).length : 0), 0)
  const checklistPct = totalTareas > 0 ? Math.round((tareasOk / totalTareas) * 100) : 0

  const allEvidencias = ots.flatMap((ot) =>
    ot.evidencias.map((ev) => ({ ...ev, otFolio: ot.folio, otTipo: ot.tipo })),
  )
  const otsConNotas = ots.filter((o) => o.notas?.trim())
  const tc = TIPO_C[campana.tipoCampana] ?? TIPO_C.OOH

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '1.25rem',
  }

  const sec: React.CSSProperties = {
    fontSize: '0.73rem', fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem',
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── ENCABEZADO ───────────────────────────────────────────────────── */}
        <div style={{
          ...card,
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(108,99,255,0.07) 100%)',
          borderColor: 'rgba(108,99,255,0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
                Reporte de Campaña
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.375rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {campana.folio}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.125rem' }}>
                {campana.nombre}
              </div>
              {campana.cliente && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{campana.cliente.nombre}</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <span style={{
                background: tc.bg, color: tc.color,
                border: `1px solid ${tc.color}44`,
                padding: '0.2rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
              }}>
                {campana.tipoCampana}
              </span>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'right' }}>
                {fmt(campana.fechaInicio)} → {fmt(campana.fechaFin)}
              </div>
              {campana.reportePublicacionUrl && (
                <a
                  href={campana.reportePublicacionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'rgba(108,99,255,0.12)', color: '#6c63ff',
                    border: '1px solid rgba(108,99,255,0.3)',
                    borderRadius: 8, padding: '0.375rem 0.875rem',
                    fontSize: '0.8rem', fontWeight: 600,
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                  }}
                >
                  📄 Reporte de publicación
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          <KpiCard
            value={`${otsCompletadas}/${ots.length}`}
            label="Órdenes de trabajo"
            sub="completadas"
            color="#b8f000"
          />
          <KpiCard
            value={String(totalFotos)}
            label="Fotografías"
            sub="evidencias registradas"
            color="#6c63ff"
          />
          <KpiCard
            value={`${checklistPct}%`}
            label="Checklist"
            sub={`${tareasOk}/${totalTareas} tareas`}
            color="#fbbf24"
          />
          <KpiCard
            value={String(trafficOrders.length)}
            label="Traffic Orders"
            sub={`${trafficOrders.filter((t) => t.estadoTecnico === 'FINALIZADA').length} finalizada(s)`}
            color="#9090aa"
          />
        </div>

        {/* ── GANTT ────────────────────────────────────────────────────────── */}
        {(ots.length > 0 || trafficOrders.length > 0) && (
          <div style={card}>
            <div style={sec}>Diagrama de Gantt — Avances de ejecución</div>
            <GanttChart campana={campana} ots={ots} trafficOrders={trafficOrders} />
          </div>
        )}

        {/* ── REPORTE FOTOGRÁFICO ──────────────────────────────────────────── */}
        <div style={card}>
          <div style={sec}>
            Reporte fotográfico{allEvidencias.length > 0 ? ` — ${allEvidencias.length} foto${allEvidencias.length !== 1 ? 's' : ''}` : ''}
          </div>

          {allEvidencias.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Sin fotografías de evidencia registradas aún
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))',
              gap: '0.625rem',
            }}>
              {allEvidencias.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    setLightboxUrl(ev.fotoUrlSigned)
                    setLightboxCaption(
                      `${ev.otFolio} · ${new Date(ev.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`,
                    )
                  }}
                  aria-label="Ver foto"
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: 0, cursor: 'pointer',
                    aspectRatio: '4/3', overflow: 'hidden', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <img
                    src={ev.fotoUrlSigned}
                    alt={ev.otFolio}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25' }}
                  />
                  {/* Overlay */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
                    padding: '0.625rem 0.5rem 0.375rem',
                    textAlign: 'left',
                  }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.63rem', color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                      {ev.otFolio}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                      {new Date(ev.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── NOTAS DEL TÉCNICO ────────────────────────────────────────────── */}
        {otsConNotas.length > 0 && (
          <div style={card}>
            <div style={sec}>Notas del técnico</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {otsConNotas.map((ot) => {
                const color = OT_ESTATUS_C[ot.estatus] ?? '#9090aa'
                return (
                  <div
                    key={ot.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${color}`,
                      borderRadius: '0 8px 8px 0',
                      padding: '0.875rem 1rem',
                    }}
                  >
                    <div style={{
                      display: 'flex', gap: '0.625rem', alignItems: 'center',
                      marginBottom: '0.5rem', flexWrap: 'wrap',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700 }}>{ot.folio}</span>
                      <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{TIPO_OT_LABELS[ot.tipo] ?? ot.tipo}</span>
                      {ot.fechaCompletada && (
                        <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>· Completada {fmt(ot.fechaCompletada)}</span>
                      )}
                      <span style={{
                        background: `${color}20`, color, border: `1px solid ${color}44`,
                        padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600,
                        marginLeft: 'auto',
                      }}>
                        {ot.estatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>
                      {ot.notas}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── DETALLE POR OT ───────────────────────────────────────────────── */}
        {ots.length > 0 && (
          <div style={card}>
            <div style={sec}>Detalle de órdenes de trabajo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ots.map((ot) => {
                const checklist = Array.isArray(ot.checklistJson) ? ot.checklistJson : []
                const done = checklist.filter((i) => i.completado).length
                const color = OT_ESTATUS_C[ot.estatus] ?? '#9090aa'

                return (
                  <div key={ot.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{
                      background: `${color}0d`,
                      borderBottom: checklist.length > 0 ? '1px solid var(--border)' : 'none',
                      padding: '0.625rem 0.875rem',
                      display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700 }}>{ot.folio}</span>
                      <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{TIPO_OT_LABELS[ot.tipo] ?? ot.tipo}</span>
                      <span style={{
                        background: `${color}20`, color, border: `1px solid ${color}44`,
                        padding: '0.12rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 600,
                      }}>
                        {ot.estatus.replace(/_/g, ' ')}
                      </span>

                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {ot.fechaProgramada && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                            Prog. {fmtShort(ot.fechaProgramada)}
                          </span>
                        )}
                        {ot.fechaCompletada && (
                          <span style={{ fontSize: '0.72rem', color: '#b8f000', fontWeight: 600 }}>
                            ✓ {fmtShort(ot.fechaCompletada)}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                          {ot.evidencias.length} foto{ot.evidencias.length !== 1 ? 's' : ''}
                        </span>
                        {checklist.length > 0 && (
                          <span style={{ fontSize: '0.72rem', color: done === checklist.length ? '#b8f000' : 'var(--muted)' }}>
                            {done}/{checklist.length} tareas
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Checklist */}
                    {checklist.length > 0 && (
                      <div style={{ padding: '0.5rem 0.875rem' }}>
                        {/* Progress bar */}
                        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: '0.5rem', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${checklist.length ? (done / checklist.length) * 100 : 0}%`,
                            background: '#b8f000', borderRadius: 2, transition: 'width 0.3s',
                          }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {checklist.map((item) => (
                            <div key={item.id} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                              padding: '0.2rem 0',
                            }}>
                              <div style={{
                                width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2,
                                background: item.completado ? '#b8f000' : 'transparent',
                                border: item.completado ? 'none' : '1.5px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', color: '#0c0c0f', fontWeight: 700,
                              }}>
                                {item.completado ? '✓' : ''}
                              </div>
                              <span style={{
                                fontSize: '0.78rem', lineHeight: 1.4,
                                color: item.completado ? 'var(--muted)' : 'var(--fg)',
                                textDecoration: item.completado ? 'line-through' : 'none',
                              }}>
                                {item.texto}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ──────────────────────────────────────────────────── */}
        {ots.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Sin datos de ejecución todavía
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
              El reporte se generará conforme los técnicos reporten avances en sus órdenes de trabajo
            </div>
          </div>
        )}
      </div>

      {/* ── LIGHTBOX ─────────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)',
            zIndex: 500, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '2rem',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Evidencia"
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 5rem)', objectFit: 'contain', borderRadius: 8 }}
          />
          {lightboxCaption && (
            <div style={{
              marginTop: '0.75rem', fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace',
            }}>
              {lightboxCaption}
            </div>
          )}
          <button
            onClick={() => setLightboxUrl(null)}
            aria-label="Cerrar imagen"
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: '1.25rem',
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
