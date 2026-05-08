'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'

interface OT {
  id: string
  folio: string
  tipo: string
  descripcion: string
  prioridad: string
  estatus: string
  asignadoAUserId: string | null
  fechaProgramada: string | null
  _count?: { evidencias: number }
}

interface OTListRes { data: OT[]; meta: { total: number; pages: number } }
interface UserItem { id: string; nombre: string; email: string }

const TIPO_OT_OPTIONS = [
  ['MONTAJE_LONA', 'Montaje de lona'],
  ['MONTAJE_DIGITAL', 'Montaje digital'],
  ['DESMONTAJE', 'Desmontaje'],
  ['MANTENIMIENTO_PREVENTIVO', 'Mantenimiento preventivo'],
  ['MANTENIMIENTO_CORRECTIVO', 'Mantenimiento correctivo'],
  ['HERRERIA', 'Herrería'],
  ['ELECTRICO', 'Eléctrico'],
  ['INSPECCION', 'Inspección'],
  ['OTRO', 'Otro'],
] as const

const PRIORIDAD_BADGE: Record<string, { bg: string; color: string }> = {
  URGENTE: { bg: 'rgba(163,45,45,0.2)', color: '#B91C1C' },
  ALTA:    { bg: 'rgba(133,79,11,0.25)', color: '#B45309' },
  NORMAL:  { bg: 'rgba(90,90,114,0.15)', color: '#71717A' },
  BAJA:    { bg: 'rgba(60,60,80,0.12)', color: '#7a7a96' },
}

const ESTATUS_BADGE: Record<string, { bg: string; color: string; label: string; strike?: boolean }> = {
  PENDIENTE:   { bg: 'rgba(90,90,114,0.15)', color: '#71717A', label: 'Pendiente' },
  ASIGNADA:    { bg: 'rgba(10,102,255,0.15)', color: '#0A66FF', label: 'Asignada' },
  EN_PROCESO:  { bg: 'rgba(180,83,9,0.15)', color: '#B45309', label: 'En proceso' },
  BLOQUEADA:   { bg: 'rgba(185,28,28,0.12)', color: '#B91C1C', label: 'Bloqueada' },
  EN_REVISION: { bg: 'rgba(124,58,237,0.12)', color: '#7C3AED', label: 'En revisión' },
  COMPLETADA:  { bg: 'rgba(21,128,61,0.12)', color: '#15803D', label: 'Completada' },
  RECHAZADA:   { bg: 'rgba(180,83,9,0.12)', color: '#B45309', label: 'Rechazada' },
  CANCELADA:   { bg: 'rgba(185,28,28,0.08)', color: '#B91C1C', label: 'Cancelada', strike: true },
}

function PrioridadBadge({ p }: { p: string }) {
  const s = PRIORIDAD_BADGE[p] ?? PRIORIDAD_BADGE.NORMAL
  return <span style={{ ...s, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{p}</span>
}

function EstatusBadge({ e }: { e: string }) {
  const s = ESTATUS_BADGE[e] ?? ESTATUS_BADGE.PENDIENTE
  return (
    <span style={{ ...s, padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, textDecoration: s.strike ? 'line-through' : 'none' }}>
      {s.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  const label = TIPO_OT_OPTIONS.find(([v]) => v === tipo)?.[1] ?? tipo
  return (
    <span style={{ background: 'rgba(10,102,255,0.1)', color: '#0A66FF', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--fg)', fontSize: '0.8375rem', padding: '0.45rem 0.75rem', outline: 'none', height: 34 }

export default function OrdenesPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState({ estatus: '', tipo: '', asignadoA: '', fechaDesde: '', fechaHasta: '', page: 1 })

  const CAMPO_ROLES = ['field_worker', 'crew_chief']
  const isCampo = CAMPO_ROLES.includes(user?.rol ?? '')
  const canSeeAll =
    user?.rol === 'owner' || user?.rol === 'admin' ||
    (user?.permisos as string[] | undefined)?.includes('*') ||
    user?.permisos.includes('ots:assign')
  const pageTitle = isCampo ? 'Mis órdenes' : 'Órdenes de trabajo'

  const params = new URLSearchParams()
  if (filters.estatus) params.set('estatus', filters.estatus)
  if (filters.tipo) params.set('tipo', filters.tipo)
  if (filters.asignadoA) params.set('asignadoA', filters.asignadoA)
  if (filters.fechaDesde) params.set('fechaDesde', new Date(filters.fechaDesde).toISOString())
  if (filters.fechaHasta) params.set('fechaHasta', new Date(filters.fechaHasta + 'T23:59:59').toISOString())
  params.set('page', String(filters.page))

  const { data, isLoading } = useQuery({
    queryKey: ['ots-list', filters],
    queryFn: () => apiFetch<OTListRes>(`/ordenes-trabajo?${params}`),
  })

  const { data: usersData, isError: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch<UserItem[]>('/admin/users'),
    enabled: !!canSeeAll,
    retry: 1,
  })

  const ots = data?.data ?? []
  const pages = data?.meta.pages ?? 1

  function setFilter(key: keyof typeof filters, val: string | number) {
    setFilters((f) => ({ ...f, [key]: val, page: key !== 'page' ? 1 : (val as number) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{pageTitle}</h1>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select style={inp} value={filters.estatus} onChange={(e) => setFilter('estatus', e.target.value)}>
            <option value="">Todos los estatus</option>
            {Object.entries(ESTATUS_BADGE).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>

          <select style={inp} value={filters.tipo} onChange={(e) => setFilter('tipo', e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPO_OT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          {canSeeAll && !isCampo && (
            <select style={inp} value={filters.asignadoA} onChange={(e) => setFilter('asignadoA', e.target.value)}>
              <option value="">{usersError ? 'Error al cargar usuarios' : 'Todos los técnicos'}</option>
              {(usersData ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          )}

          <input type="date" style={inp} value={filters.fechaDesde} onChange={(e) => setFilter('fechaDesde', e.target.value)} title="Fecha desde" />
          <input type="date" style={inp} value={filters.fechaHasta} onChange={(e) => setFilter('fechaHasta', e.target.value)} title="Fecha hasta" />
        </div>

        {!isCampo && (
          <Link href="/operaciones/ordenes/nueva" style={{ background: 'var(--accent)', color: '#fff', borderRadius: '7px', padding: '0.45rem 1rem', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            + Nueva OT
          </Link>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {isLoading ? 'Cargando…' : `${data?.meta.total ?? 0} órdenes`}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Folio', 'Tipo', 'Descripción', 'Prioridad', 'Asignado a', 'Fecha prog.', 'Estatus', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ots.length === 0 && !isLoading ? (
                <tr><td colSpan={8} style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>Sin órdenes de trabajo</td></tr>
              ) : (
                ots.map((ot) => (
                  <tr key={ot.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent)' }}>{ot.folio}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}><TipoBadge tipo={ot.tipo} /></td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ot.descripcion}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}><PrioridadBadge p={ot.prioridad} /></td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
                      {ot.asignadoAUserId
                        ? (usersData?.find((u) => u.id === ot.asignadoAUserId)?.nombre ?? ot.asignadoAUserId.slice(0, 8) + '…')
                        : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {ot.fechaProgramada ? new Date(ot.fechaProgramada).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}><EstatusBadge e={ot.estatus} /></td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Link href={`/operaciones/ordenes/${ot.id}`} style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Ver →</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.3rem 0.75rem', opacity: filters.page <= 1 ? 0.4 : 1 }}>← Anterior</button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Pág. {filters.page} / {pages}</span>
            <button disabled={filters.page >= pages} onClick={() => setFilter('page', filters.page + 1)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8125rem', padding: '0.3rem 0.75rem', opacity: filters.page >= pages ? 0.4 : 1 }}>Siguiente →</button>
          </div>
        )}
      </div>
    </div>
  )
}
