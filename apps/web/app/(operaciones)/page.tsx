'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

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
  URGENTE: { bg: 'rgba(163,45,45,0.2)', color: '#ff5f5f' },
  ALTA:    { bg: 'rgba(133,79,11,0.2)', color: '#fbbf24' },
  NORMAL:  { bg: 'rgba(90,90,114,0.15)', color: '#9090aa' },
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

export default function OperacionesDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['ots-all'],
    queryFn: () => apiFetch<OTListRes>('/ordenes-trabajo?limit=1000'),
  })

  const all = data?.data ?? []

  const activas = all.filter((o) => o.estatus !== 'COMPLETADA' && o.estatus !== 'CANCELADA')
  const urgentes = all.filter((o) => o.prioridad === 'URGENTE' && o.estatus !== 'COMPLETADA' && o.estatus !== 'CANCELADA')
  const completadasHoy = all.filter((o) => o.estatus === 'COMPLETADA' && isToday(o.fechaCompletada))
  const sinAsignar = all.filter((o) => o.estatus === 'PENDIENTE')

  const tablaUrgentes = all.filter(
    (o) => (o.prioridad === 'URGENTE' || o.prioridad === 'ALTA') && o.estatus !== 'COMPLETADA' && o.estatus !== 'CANCELADA',
  ).slice(0, 20)

  if (isLoading) {
    return <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '2rem' }}>Cargando…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Resumen del módulo Operaciones</p>
        </div>
        <Link href="/operaciones/ordenes/nueva" style={{ background: 'var(--accent)', color: '#fff', borderRadius: '7px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
          + Nueva OT
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <KpiCard label="OTs activas" value={activas.length} />
        <KpiCard label="Urgentes pendientes" value={urgentes.length} color={urgentes.length > 0 ? '#ff5f5f' : undefined} />
        <KpiCard label="Completadas hoy" value={completadasHoy.length} color={completadasHoy.length > 0 ? '#b8f000' : undefined} />
        <KpiCard label="Sin asignar" value={sinAsignar.length} color={sinAsignar.length > 0 ? '#fbbf24' : undefined} sub="estatus PENDIENTE" />
      </div>

      {/* Tabla urgentes + alta prioridad */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Urgentes y alta prioridad</h2>
          <Link href="/operaciones/ordenes" style={{ fontSize: '0.8125rem', color: 'var(--muted)', textDecoration: 'none' }}>Ver todas →</Link>
        </div>
        {tablaUrgentes.length === 0 ? (
          <div style={{ padding: '2rem 1.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin órdenes urgentes pendientes 🎉</div>
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
