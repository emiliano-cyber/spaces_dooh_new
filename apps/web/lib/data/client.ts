// ============================================================================
//  lib/data/client.ts — API PÚBLICA que consumen las pantallas
// ----------------------------------------------------------------------------
//  EL ÚNICO punto de entrada para las pantallas. Nunca importes seed.ts ni
//  store.ts desde una pantalla: todo pasa por aquí.
//
//  Dos mitades:
//   1) `data` — API imperativa async (lecturas + mutaciones). Es el adapter
//      seleccionado por entorno (mock hoy, http post-junta). MISMAS firmas en
//      ambos, así que cambiar de backend no toca pantallas.
//   2) Hooks de lectura EN VIVO (useSitios, useDashboard, ...). Se suscriben al
//      store en memoria vía zustand para que las mutaciones se reflejen al
//      instante en mapa/dashboard/pipeline. Hoy son mock-bound; con backend se
//      reimplementan sobre react-query SIN cambiar su firma para las pantallas.
//
//  Los hooks devuelven `undefined` antes de montar en el cliente: así la UI
//  pinta skeletons y evitamos desajustes de hidratación por las fechas
//  relativas a hoy.
// ============================================================================

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDemoStore, type DemoStore } from './store'
import { mockAdapter } from './adapters/mock'
import { httpAdapter } from './adapters/http'
import {
  dashboardMetrics,
  pipelineStage,
  candadoFacturacion,
  estadoCobranza,
  ocupacionSerie,
  fechasPipeline,
  etapaIndex,
  ETAPAS_PIPELINE,
  ETAPA_LABEL,
  type DashboardMetrics,
  type Granularidad,
  type SerieOcupacion,
} from './derive'
import type { Campana, EtapaPipeline, RolDemo, UsuarioDemo } from './types'

// ─── Selección de adapter por flag de entorno ───────────────────────────────
const USE_HTTP = process.env.NEXT_PUBLIC_DEMO_HTTP === '1'

/** API imperativa (lecturas + mutaciones). Mismas firmas mock/http. */
export const data = USE_HTTP ? httpAdapter : mockAdapter

// Re-export de derivaciones y formato para que las pantallas tengan una sola
// fuente de import.
export {
  dashboardMetrics,
  pipelineStage,
  candadoFacturacion,
  estadoCobranza,
  ocupacionSerie,
  fechasPipeline,
  ETAPAS_PIPELINE,
  ETAPA_LABEL,
  etapaIndex,
  diasHasta,
  formatMonto,
  formatMontoCorto,
  formatFecha,
  formatFechaHora,
} from './derive'
export type {
  DashboardMetrics,
  Alerta,
  Granularidad,
  SerieOcupacion,
  PuntoOcupacion,
} from './derive'
export type * from './types'

// ─── Hooks de lectura en vivo (suscritos al store) ──────────────────────────

function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}

// IMPORTANTE (zustand v5): un selector que construye un objeto/array NUEVO en
// cada llamada hace que el snapshot de useSyncExternalStore sea inestable y
// dispara "Maximum update depth exceeded". Para lecturas DERIVADAS seleccionamos
// el estado completo (referencia estable entre renders) y derivamos con useMemo.
// Para lecturas que devuelven una rebanada cruda del store (s.sitios, etc.) o un
// `.find()` (referencia existente), el selector directo es seguro.
function useStoreMemo<T>(compute: (s: DemoStore) => T, deps: unknown[]): T {
  const state = useDemoStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => compute(state), [state, ...deps])
}

export function useSitios() {
  const m = useMounted()
  const v = useDemoStore((s) => s.sitios)
  return m ? v : undefined
}
export function useSitio(id: string) {
  const m = useMounted()
  const v = useDemoStore((s) => s.sitios.find((x) => x.id === id) ?? null)
  return m ? v : undefined
}
export function useArrendadores() {
  const m = useMounted()
  const v = useDemoStore((s) => s.arrendadores)
  return m ? v : undefined
}
export function useContratos() {
  const m = useMounted()
  const v = useDemoStore((s) => s.contratos)
  return m ? v : undefined
}
export function usePagosRenta() {
  const m = useMounted()
  const v = useDemoStore((s) => s.pagosRenta)
  return m ? v : undefined
}
export function useIncidencias() {
  const m = useMounted()
  const v = useDemoStore((s) => s.incidencias)
  return m ? v : undefined
}
export function useClientes() {
  const m = useMounted()
  const v = useDemoStore((s) => s.clientes)
  return m ? v : undefined
}
export function useCampanas() {
  const m = useMounted()
  const v = useDemoStore((s) => s.campanas)
  return m ? v : undefined
}
export function useCampana(id: string) {
  const m = useMounted()
  const v = useDemoStore((s) => s.campanas.find((x) => x.id === id) ?? null)
  return m ? v : undefined
}
export interface CampanaResumen {
  campana: Campana
  clienteNombre: string
  etapa: EtapaPipeline
  index: number
  totalPasos: number
  candado: boolean
}

/** Lista de campañas enriquecida con su etapa de pipeline y candado, en vivo. */
export function useCampanasResumen(): CampanaResumen[] | undefined {
  const m = useMounted()
  const v = useStoreMemo(
    (s) =>
      s.campanas.map((c) => ({
        campana: c,
        clienteNombre: s.clientes.find((cl) => cl.id === c.clienteId)?.nombre ?? '—',
        etapa: pipelineStage(c, s),
        index: etapaIndex(pipelineStage(c, s)),
        totalPasos: ETAPAS_PIPELINE.length,
        candado: candadoFacturacion(c),
      })),
    [],
  )
  return m ? v : undefined
}

export function useReservas() {
  const m = useMounted()
  const v = useDemoStore((s) => s.reservas)
  return m ? v : undefined
}
export function useOrdenesTrabajo() {
  const m = useMounted()
  const v = useDemoStore((s) => s.ordenesTrabajo)
  return m ? v : undefined
}
export function useOT(id: string) {
  const m = useMounted()
  const v = useDemoStore((s) => s.ordenesTrabajo.find((x) => x.id === id) ?? null)
  return m ? v : undefined
}
export function useEvidencias(otId?: string) {
  const m = useMounted()
  const v = useStoreMemo(
    (s) => (otId ? s.evidencias.filter((e) => e.otId === otId) : s.evidencias),
    [otId],
  )
  return m ? v : undefined
}
export function useOrdenesImpresion() {
  const m = useMounted()
  const v = useDemoStore((s) => s.ordenesImpresion)
  return m ? v : undefined
}
export function useCreatividades() {
  const m = useMounted()
  const v = useDemoStore((s) => s.creatividades)
  return m ? v : undefined
}
export function useFacturas() {
  const m = useMounted()
  const v = useDemoStore((s) => s.facturas)
  return m ? v : undefined
}
export function useCobranzas() {
  const m = useMounted()
  const v = useDemoStore((s) => s.cobranzas)
  return m ? v : undefined
}

/** Métricas del dashboard del dueño, recalculadas en vivo. */
export function useDashboard(): DashboardMetrics | undefined {
  const m = useMounted()
  const v = useStoreMemo((s) => dashboardMetrics(s), [])
  return m ? v : undefined
}

/** Serie de ocupación día/semana/mes, recalculada en vivo. */
export function useOcupacionSerie(gran: Granularidad): SerieOcupacion | undefined {
  const m = useMounted()
  const v = useStoreMemo((s) => ocupacionSerie(s, gran), [gran])
  return m ? v : undefined
}

/** Etapa de pipeline de una campaña, recalculada en vivo. */
export function usePipelineStage(campanaId: string): EtapaPipeline | undefined {
  const m = useMounted()
  const v = useDemoStore((s) => {
    const c = s.campanas.find((x) => x.id === campanaId)
    return c ? pipelineStage(c, s) : null
  })
  return m ? (v ?? undefined) : undefined
}

export interface PasoPipeline {
  key: EtapaPipeline
  label: string
  fecha?: string
}
export interface PipelineVista {
  etapa: EtapaPipeline
  index: number
  pasos: PasoPipeline[]
}

/** Pipeline completo (etapa actual + pasos con fecha) de una campaña, en vivo. */
export function usePipeline(campanaId: string): PipelineVista | undefined {
  const m = useMounted()
  const v = useStoreMemo((s) => {
    const c = s.campanas.find((x) => x.id === campanaId)
    if (!c) return null
    const etapa = pipelineStage(c, s)
    const fechas = fechasPipeline(c, s)
    const pasos: PasoPipeline[] = ETAPAS_PIPELINE.map((k) => ({
      key: k,
      label: ETAPA_LABEL[k],
      fecha: fechas[k] ? formatFechaLocal(fechas[k]!) : undefined,
    }))
    return { etapa, index: etapaIndex(etapa), pasos }
  }, [campanaId])
  return m ? (v ?? undefined) : undefined
}

function formatFechaLocal(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Estado del candado de facturación de una campaña, en vivo. */
export function useReadiness(campanaId: string) {
  const m = useMounted()
  const v = useStoreMemo((s) => {
    const c = s.campanas.find((x) => x.id === campanaId)
    if (!c) return null
    return {
      ocRecibida: c.ocRecibida,
      fotosComprobatorias: c.fotosComprobatorias,
      reportePublicacion: c.reportePublicacion,
      candado: candadoFacturacion(c),
    }
  }, [campanaId])
  return m ? v : undefined
}

// ─── Rol de la demo (selector del topbar) ───────────────────────────────────

export function useRol(): RolDemo {
  return useDemoStore((s) => s.rolActivo)
}
export function useSetRol() {
  return useDemoStore((s) => s.setRol)
}
export function useReiniciarDemo() {
  return useDemoStore((s) => s.reiniciarDemo)
}

// Constantes del hilo conductor y usuarios demo (definidos en módulos sin
// 'use client' para reutilizarlos desde server y client).
export { ID_TELCO, ID_OT_TELCO, TOKEN_TELCO } from './tokens'
export { USUARIOS_DEMO, landingDeRol } from './usuarios'

// ─── Sesión del login mock ──────────────────────────────────────────────────

/** Usuario en sesión: undefined antes de montar, null si no hay sesión. */
export function useUsuario(): UsuarioDemo | null | undefined {
  const m = useMounted()
  const v = useDemoStore((s) => s.usuarioActivo)
  return m ? v : undefined
}
export function useIniciarSesion() {
  return useDemoStore((s) => s.iniciarSesion)
}
export function useCerrarSesion() {
  return useDemoStore((s) => s.cerrarSesion)
}

/** Lista de usuarios demo (mutable vía Administración). */
export function useUsuarios(): UsuarioDemo[] | undefined {
  const m = useMounted()
  const v = useDemoStore((s) => s.usuarios)
  return m ? v : undefined
}
export function useCambiarRolUsuario() {
  return useDemoStore((s) => s.cambiarRolUsuario)
}
export function useToggleUsuarioActivo() {
  return useDemoStore((s) => s.toggleUsuarioActivo)
}
export function useInvitarUsuario() {
  return useDemoStore((s) => s.invitarUsuario)
}
export function useConfigNegocio() {
  const m = useMounted()
  const v = useDemoStore((s) => s.configNegocio)
  return m ? v : undefined
}
export function useActualizarConfig() {
  return useDemoStore((s) => s.actualizarConfig)
}
