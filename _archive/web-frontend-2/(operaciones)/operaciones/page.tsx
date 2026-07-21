'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface OT {
  id: string
  folio: string
  tipo: string
  descripcion: string
  prioridad: string
  estatus: string
  sitioId: string | null
  asignadoAUserId: string | null
  fechaProgramada: string | null
  fechaCompletada: string | null
  campanaId: string | null
}

interface OTListRes { data: OT[]; meta: { total: number } }

const PRIORIDAD_BADGE: Record<string, { bg: string; color: string }> = {
  URGENTE: { bg: 'rgba(163,45,45,0.2)', color: '#B91C1C' },
  ALTA:    { bg: 'rgba(133,79,11,0.2)', color: '#B45309' },
  NORMAL:  { bg: 'rgba(90,90,114,0.15)', color: '#71717A' },
  BAJA:    { bg: 'rgba(60,60,80,0.15)', color: '#7a7a96' },
}

const TIPO_LABELS: Record<string, string> = {
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

function KpiCard({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem 1.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.875rem', fontWeight: 700, color: color ?? 'var(--fg)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}>{sub}</div>}
    </div>
  )
}

function PrioridadBadge({ p }: { p: string }) {
  const s = PRIORIDAD_BADGE[p] ?? PRIORIDAD_BADGE.NORMAL
  return (
    <span style={{ ...s, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
      {p}
    </span>
  )
}

function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function isToday(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

const CAMPO_ROLES = ['field_worker', 'crew_chief']

export default function OperacionesDashboard() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const isCampo = CAMPO_ROLES.includes(user?.rol ?? '')
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ots-all'],
    queryFn: () => apiFetch<OTListRes>('/ordenes-trabajo?limit=1000'),
  })

  const all = data?.data ?? []

  const FINALES = ['COMPLETADA', 'CANCELADA']
  const activas = all.filter((o) => !FINALES.includes(o.estatus))
  const urgentes = all.filter((o) => o.prioridad === 'URGENTE' && !FINALES.includes(o.estatus))
  const completadasHoy = all.filter((o) => o.estatus === 'COMPLETADA' && isToday(o.fechaCompletada))
  const sinAsignar = all.filter((o) => o.estatus === 'PENDIENTE')
  const enRevision = all.filter((o) => o.estatus === 'EN_REVISION')
  const bloqueadas = all.filter((o) => o.estatus === 'BLOQUEADA')

  const tablaUrgentes = all.filter(
    (o) => (o.prioridad === 'URGENTE' || o.prioridad === 'ALTA') && !FINALES.includes(o.estatus),
  ).slice(0, 20)

  const requierenAccion = all.filter((o) => ['BLOQUEADA', 'EN_REVISION', 'RECHAZADA'].includes(o.estatus)).slice(0, 20)

  if (isLoading) {
    return <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '2rem' }}>Cargando…</div>
  }

  if (isError) {
    return (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)', borderRadius: '10px', padding: '1rem 1.25rem', color: '#B91C1C', fontSize: '0.875rem' }}>
          <strong>Error al cargar las órdenes:</strong> {error instanceof Error ? error.message : 'Error desconocido'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            {user?.nombre ? `Hola, ${user.nombre.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            {isCampo ? 'Resumen de tus órdenes de trabajo' : 'Resumen del módulo Operaciones'}
          </p>
        </div>
        {!isCampo && (
          <Link href="/operaciones/ordenes/nueva" style={{ background: 'var(--accent)', color: '#fff', borderRadius: '7px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            + Nueva OT
          </Link>
        )}
      </div>

      {/* Empty state */}
      {all.length === 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
          No hay órdenes de trabajo registradas.{' '}
          <Link href="/operaciones/ordenes/nueva" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Crea la primera →</Link>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 160}px, 1fr))`, gap: isMobile ? '0.625rem' : '1rem' }}>
        <KpiCard label="OTs activas" value={activas.length} />
        <KpiCard label="Urgentes pendientes" value={urgentes.length} color={urgentes.length > 0 ? '#B91C1C' : undefined} />
        <KpiCard label="Completadas hoy" value={completadasHoy.length} color={completadasHoy.length > 0 ? '#15803D' : undefined} />
        <KpiCard label="Sin asignar" value={sinAsignar.length} color={sinAsignar.length > 0 ? '#B45309' : undefined} sub="estatus PENDIENTE" />
        <KpiCard label="En revisión" value={enRevision.length} color={enRevision.length > 0 ? '#7C3AED' : undefined} sub="esperando aprobación" />
        <KpiCard label="Bloqueadas" value={bloqueadas.length} color={bloqueadas.length > 0 ? '#B91C1C' : undefined} sub="requieren atención" />
      </div>

      {/* Requieren acción inmediata */}
      {requierenAccion.length > 0 && (
        <div style={{ background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(185,28,28,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#B91C1C' }}>Requieren acción inmediata</h2>
            </div>
            <span style={{ fontSize: '0.8125rem', color: '#B91C1C', fontWeight: 600 }}>{requierenAccion.length} {requierenAccion.length === 1 ? 'orden' : 'órdenes'}</span>
          </div>
          <div style={{ padding: '0.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {requierenAccion.map((ot) => {
              const estatusColor = ot.estatus === 'EN_REVISION' ? '#7C3AED' : ot.estatus === 'RECHAZADA' ? '#B45309' : '#B91C1C'
              const estatusLabel = ot.estatus === 'EN_REVISION' ? 'En revisión' : ot.estatus === 'RECHAZADA' ? 'Rechazada' : 'Bloqueada'
              return (
                <div key={ot.id} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', flexWrap: isMobile ? 'wrap' : 'nowrap', padding: '0.625rem 0.75rem', background: 'var(--bg-surface)', borderRadius: '7px', border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)', minWidth: 90 }}>{ot.folio}</span>
                  <span style={{ flex: isMobile ? '1 1 100%' : 1, order: isMobile ? 1 : 0, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{ot.descripcion}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: estatusColor, background: `${estatusColor}18`, padding: '0.2rem 0.6rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>{estatusLabel}</span>
                  <Link href={`/operaciones/ordenes/${ot.id}`} style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap', marginLeft: isMobile ? 'auto' : 0 }}>Ver →</Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabla urgentes + alta prioridad */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Urgentes y alta prioridad</h2>
          <Link href="/operaciones/ordenes" style={{ fontSize: '0.8125rem', color: 'var(--muted)', textDecoration: 'none' }}>Ver todas →</Link>
        </div>
        {tablaUrgentes.length === 0 ? (
          <div style={{ padding: '2rem 1.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin órdenes urgentes pendientes 🎉</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tablaUrgentes.map((ot) => (
              <Link
                key={ot.id}
                href={`/operaciones/ordenes/${ot.id}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--fg)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent)' }}>{ot.folio}</span>
                  <PrioridadBadge p={ot.prioridad} />
                </div>
                <div style={{ fontSize: '0.8125rem' }}>{truncate(ot.descripcion, 80)}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  <span>{TIPO_LABELS[ot.tipo] ?? ot.tipo} · {ot.estatus.replace('_', ' ')}</span>
                  <span>{ot.fechaProgramada ? new Date(ot.fechaProgramada).toLocaleDateString('es-MX') : '—'}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Folio', 'Tipo', 'Descripción', 'Prioridad', 'Estatus', 'Fecha prog.'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablaUrgentes.map((ot) => (
                <tr key={ot.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1.25rem' }}>
                    <Link href={`/operaciones/ordenes/${ot.id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace' }}>
                      {ot.folio}
                    </Link>
                  </td>
                  <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{TIPO_LABELS[ot.tipo] ?? ot.tipo}</td>
                  <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8125rem' }}>{truncate(ot.descripcion)}</td>
                  <td style={{ padding: '0.75rem 1.25rem' }}><PrioridadBadge p={ot.prioridad} /></td>
                  <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>{ot.estatus.replace('_', ' ')}</td>
                  <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {ot.fechaProgramada ? new Date(ot.fechaProgramada).toLocaleDateString('es-MX') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
