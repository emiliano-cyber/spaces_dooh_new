'use client'

import { useRouter } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtRel(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} días`
}

const ESTADO_C: Record<string, { bg: string; color: string }> = {
  DRAFT:          { bg: 'rgba(90,90,114,0.2)',  color: '#9090aa' },
  COTIZACION:     { bg: 'rgba(108,99,255,0.2)', color: '#6c63ff' },
  CONFIRMADA:     { bg: 'rgba(251,191,36,0.2)', color: '#fbbf24' },
  ACTIVA:         { bg: 'rgba(184,240,0,0.15)', color: '#b8f000' },
  COMPLETADA:     { bg: 'rgba(90,90,114,0.2)',  color: '#9090aa' },
  CANCELADA:      { bg: 'rgba(255,95,95,0.15)', color: '#ff5f5f' },
  LISTA_FACTURAR: { bg: 'rgba(184,240,0,0.25)', color: '#b8f000' },
}

function KpiCard({ label, value, sub, accent, animate }: {
  label: string; value: string | number; sub?: string; accent?: string; animate?: boolean
}) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: accent ?? 'var(--fg)', animation: animate ? 'kpi-pulse 2s infinite' : 'none' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  )
}

function Panel({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, padding: 0 }}>{action} →</button>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>{children}</div>
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8125rem' }}>{text}</div>
}

export default function AdminDashboard() {
  const router = useRouter()

  const results = useQueries({
    queries: [
      { queryKey: ['admin-sitios'],       queryFn: () => apiFetch<any>('/sitios?limit=1') },
      { queryKey: ['admin-activas'],       queryFn: () => apiFetch<any>('/campanas?estadoComercial=ACTIVA&limit=1') },
      { queryKey: ['admin-facturar'],      queryFn: () => apiFetch<any>('/campanas?estadoComercial=LISTA_FACTURAR&limit=10') },
      { queryKey: ['admin-ots-pend'],      queryFn: () => apiFetch<any>('/ordenes-trabajo?estatus=PENDIENTE&limit=5') },
      { queryKey: ['admin-incidencias'],   queryFn: () => apiFetch<any>('/incidencias?estatusResolucion=ABIERTA&limit=5') },
      { queryKey: ['admin-alertas'],       queryFn: () => apiFetch<any>('/alertas/vencimientos?diasUmbral=7') },
      { queryKey: ['admin-campanas-rec'],  queryFn: () => apiFetch<any>('/campanas?limit=5') },
      { queryKey: ['admin-ots-urg'],       queryFn: () => apiFetch<any>('/ordenes-trabajo?prioridad=URGENTE&limit=5') },
      { queryKey: ['admin-audit'],         queryFn: () => apiFetch<any>('/admin/audit-log?limit=10') },
    ],
  })

  const [sitiosR, activasR, facturarR, otsPendR, incidenciasR, alertasR, campanasRecR, otsUrgR, auditR] = results

  const totalSitios     = sitiosR.data?.meta?.total ?? '—'
  const totalActivas    = activasR.data?.meta?.total ?? '—'
  const facturarList: any[] = facturarR.data?.data ?? []
  const totalFacturar   = facturarR.data?.meta?.total ?? 0
  const totalOtsPend    = otsPendR.data?.meta?.total ?? (Array.isArray(otsPendR.data) ? otsPendR.data.length : 0)
  const totalIncidencias = incidenciasR.data?.meta?.total ?? '—'
  const alertasData     = alertasR.data ?? {}
  const totalAlertas    = (alertasData.contratos?.length ?? 0) + (alertasData.licencias?.length ?? 0) + (alertasData.pagos?.length ?? 0)
  const campanasRec: any[] = campanasRecR.data?.data ?? []
  const otsUrg: any[]   = Array.isArray(otsUrgR.data) ? otsUrgR.data : (otsUrgR.data?.data ?? [])
  const auditLog: any[] = auditR.data?.data ?? []

  const alertasMixed = [
    ...((alertasData.contratos ?? []).slice(0, 3).map((a: any) => ({ tipo: 'Contrato', sitio: a.sitio?.nombre, dias: a.diasRestantes, nivel: a.nivel }))),
    ...((alertasData.licencias ?? []).slice(0, 3).map((a: any) => ({ tipo: 'Licencia', sitio: a.sitio?.nombre, dias: a.diasRestantes, nivel: a.nivel }))),
    ...((incidenciasR.data?.data ?? []).slice(0, 2).map((i: any) => ({ tipo: 'Incidencia', sitio: i.sitio?.nombre, dias: null, nivel: 'critico', desc: i.descripcion }))),
  ].slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`@keyframes kpi-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>

      {/* Row 1 — KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
        <KpiCard label="Sitios activos"      value={totalSitios} />
        <KpiCard label="Campañas activas"    value={totalActivas} accent="#b8f000" />
        <KpiCard label="Listas p/ facturar"  value={totalFacturar} accent={totalFacturar > 0 ? '#b8f000' : undefined} animate={totalFacturar > 0} sub={totalFacturar > 0 ? 'Requieren atención' : undefined} />
        <KpiCard label="OTs pendientes"      value={totalOtsPend} accent={Number(totalOtsPend) > 0 ? '#fbbf24' : undefined} />
        <KpiCard label="Incidencias abiertas" value={totalIncidencias} accent={Number(totalIncidencias) > 0 ? '#ff5f5f' : undefined} />
        <KpiCard label="Alertas críticas"    value={totalAlertas} sub="Próx. 7 días" accent={totalAlertas > 0 ? '#ff5f5f' : undefined} />
      </div>

      {/* Row 2 — Billing + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Panel title="Campañas listas para facturar" action="Ver todas" onAction={() => router.push('/comercial/campanas')}>
          {facturarList.length === 0
            ? <Empty text="Sin campañas pendientes de facturación" />
            : facturarList.map((c: any) => (
              <Row key={c.id}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--muted)', flexShrink: 0 }}>{c.folio}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente?.nombre ?? '—'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', flexShrink: 0 }}>{fmt(c.fechaFin)}</span>
                <span style={{ background: 'rgba(184,240,0,0.15)', color: '#b8f000', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>🔒</span>
              </Row>
            ))
          }
        </Panel>

        <Panel title="Alertas que requieren atención" action="Ver todas" onAction={() => router.push('/inmuebles/alertas')}>
          {alertasMixed.length === 0
            ? <Empty text="Sin alertas críticas" />
            : alertasMixed.map((a: any, i: number) => (
              <Row key={i}>
                <span style={{ background: a.nivel === 'critico' ? 'rgba(255,75,75,0.12)' : 'rgba(251,191,36,0.12)', color: a.nivel === 'critico' ? '#ff4b4b' : '#fbbf24', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>{a.tipo.toUpperCase()}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sitio ?? '—'}</span>
                <span style={{ fontSize: '0.75rem', color: a.nivel === 'critico' ? '#ff4b4b' : '#fbbf24', flexShrink: 0 }}>{a.dias != null ? `${a.dias}d` : (a.desc ?? '').slice(0, 20)}</span>
              </Row>
            ))
          }
        </Panel>
      </div>

      {/* Row 3 — Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <Panel title="Últimas campañas" action="Ver todas" onAction={() => router.push('/comercial/campanas')}>
          {campanasRec.length === 0 ? <Empty text="Sin campañas" /> : campanasRec.map((c: any) => {
            const ec = ESTADO_C[c.estadoComercial] ?? ESTADO_C.DRAFT
            return (
              <Row key={c.id}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>{c.folio}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente?.nombre ?? '—'}</span>
                <span style={{ background: ec.bg, color: ec.color, padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600, flexShrink: 0 }}>{c.estadoComercial.replace(/_/g, ' ')}</span>
              </Row>
            )
          })}
        </Panel>

        <Panel title="OTs urgentes" action="Ver todas" onAction={() => router.push('/operaciones/ordenes')}>
          {otsUrg.length === 0 ? <Empty text="Sin OTs urgentes" /> : otsUrg.map((ot: any) => (
            <Row key={ot.id}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#ff5f5f', flexShrink: 0 }}>{ot.folio}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ot.tipo?.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', flexShrink: 0 }}>{ot.fechaProgramada ? fmt(ot.fechaProgramada) : '—'}</span>
            </Row>
          ))}
        </Panel>

        <Panel title="Actividad reciente" action="Ver log" onAction={() => router.push('/admin/audit-log')}>
          {auditLog.length === 0 ? <Empty text="Sin actividad reciente" /> : auditLog.map((e: any) => (
            <Row key={e.id}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.usuario?.email?.split('@')[0] ?? '—'} · {e.accion}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{e.entidadTipo}</div>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>{fmtRel(e.timestamp)}</span>
            </Row>
          ))}
        </Panel>
      </div>
    </div>
  )
}
