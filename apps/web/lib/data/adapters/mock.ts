// ============================================================================
//  lib/data/adapters/mock.ts — Implementación MOCK del DataAdapter
// ----------------------------------------------------------------------------
//  Lee/escribe en el store en memoria (store.ts). Las mutaciones de escritura
//  cambian el estado y zustand notifica a todas las vistas suscritas: ESA
//  propagación (mapa, dashboard, pipeline, listas) es la demo en vivo.
//
//  `adapters/http.ts` expone EXACTAMENTE las mismas firmas pero contra el
//  backend Fastify. `client.ts` decide cuál usar con un flag de entorno, así
//  que las pantallas no cambian una línea cuando llegue el backend.
// ============================================================================

import { getDemoState, mutateDemo } from '../store'
import { candadoFacturacion } from '../derive'
import type {
  Campana,
  Incidencia,
  Factura,
  OrdenTrabajo,
  Reserva,
  TipoIncidencia,
} from '../types'

// ─── util: id único en runtime (no usamos persistencia) ─────────────────────
let _seq = 0
function uid(prefix: string): string {
  _seq += 1
  return `${prefix}-${Date.now().toString(36)}-${_seq}`
}
function nowISO(): string {
  return new Date().toISOString()
}
function offsetISO(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// Pequeña latencia simulada para que los skeletons se vean (sección 2).
function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export interface ReservarInput {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
}

export interface CerrarOTInput {
  fotoUrl: string
  lat?: number
  lng?: number
}

export interface ReportarIncidenciaInput {
  sitioId: string
  tipo: TipoIncidencia
  descripcion: string
}

export const mockAdapter = {
  // ─── Lecturas ─────────────────────────────────────────────────────────────
  async getSitios() {
    return delay(getDemoState().sitios)
  },
  async getSitio(id: string) {
    return delay(getDemoState().sitios.find((s) => s.id === id) ?? null)
  },
  async getArrendadores() {
    return delay(getDemoState().arrendadores)
  },
  async getContratos() {
    return delay(getDemoState().contratos)
  },
  async getPagosRenta() {
    return delay(getDemoState().pagosRenta)
  },
  async getIncidencias() {
    return delay(getDemoState().incidencias)
  },
  async getClientes() {
    return delay(getDemoState().clientes)
  },
  async getCampanas() {
    return delay(getDemoState().campanas)
  },
  async getCampana(id: string) {
    return delay(getDemoState().campanas.find((c) => c.id === id) ?? null)
  },
  async getCampanaPorToken(token: string) {
    return delay(
      getDemoState().campanas.find((c) => c.portalToken === token && c.portalActivo) ?? null,
    )
  },
  async getReservas() {
    return delay(getDemoState().reservas)
  },
  async getOrdenesTrabajo() {
    return delay(getDemoState().ordenesTrabajo)
  },
  async getOT(id: string) {
    return delay(getDemoState().ordenesTrabajo.find((o) => o.id === id) ?? null)
  },
  async getEvidencias(otId?: string) {
    const evs = getDemoState().evidencias
    return delay(otId ? evs.filter((e) => e.otId === otId) : evs)
  },
  async getOrdenesImpresion() {
    return delay(getDemoState().ordenesImpresion)
  },
  async getCreatividades() {
    return delay(getDemoState().creatividades)
  },
  async getFacturas() {
    return delay(getDemoState().facturas)
  },
  async getCobranzas() {
    return delay(getDemoState().cobranzas)
  },
  async getReadiness(campanaId: string) {
    const c = getDemoState().campanas.find((x) => x.id === campanaId)
    if (!c) return null
    return delay({
      ocRecibida: c.ocRecibida,
      fotosComprobatorias: c.fotosComprobatorias,
      reportePublicacion: c.reportePublicacion,
      candado: candadoFacturacion(c),
    })
  },

  // ─── Escrituras (mutan el store → re-render en vivo) ───────────────────────

  // Acto 3 — RESERVAR: crea (o reutiliza) campaña + reservas TENTATIVA y pone
  // los sitios en RESERVADO (ámbar).
  async reservar(input: ReservarInput): Promise<Campana> {
    let campanaId = input.campanaId
    const nuevasReservas: Reserva[] = []

    mutateDemo((state) => {
      let campanas = state.campanas
      let clientes = state.clientes

      // Cliente nuevo + campaña nueva si no se pasa campanaId
      if (!campanaId) {
        const cliId = uid('cli')
        clientes = [
          ...clientes,
          {
            id: cliId,
            nombre: input.clienteNombre ?? 'Cliente nuevo',
            rfc: null,
            tipo: 'DIRECTO',
            contacto: {},
            activo: true,
            creadoEn: nowISO(),
          },
        ]
        campanaId = uid('camp')
        campanas = [
          ...campanas,
          {
            id: campanaId,
            folio: `CAM-${new Date().getFullYear()}-${String(900 + _seq).padStart(4, '0')}`,
            nombre: input.nombreCampana ?? `${input.clienteNombre ?? 'Campaña'} — nueva`,
            clienteId: cliId,
            agencia: null,
            marca: input.clienteNombre ?? null,
            tipoCampana: 'OOH',
            fechaInicio: input.fechaInicio,
            fechaFin: input.fechaFin,
            presupuestoBruto: null,
            presupuestoNeto: null,
            moneda: 'PEN',
            estadoComercial: 'COTIZACION',
            ocRecibida: false,
            fotosComprobatorias: false,
            reportePublicacion: false,
            ocUrl: null,
            reportePublicacionUrl: null,
            portalToken: null,
            portalActivo: false,
            notas: null,
            creadoEn: nowISO(),
          },
        ]
      }

      const reservas = [...state.reservas]
      const sitios = state.sitios.map((s) => {
        if (!input.sitioIds.includes(s.id)) return s
        const precio = s.tarifaMensual
        const res: Reserva = {
          id: uid('res'),
          campanaId: campanaId!,
          sitioId: s.id,
          fechaInicio: input.fechaInicio,
          fechaFin: input.fechaFin,
          precio,
          tipoVenta: 'FIXED_PKG',
          estatus: 'TENTATIVA',
          creadoEn: nowISO(),
        }
        reservas.push(res)
        nuevasReservas.push(res)
        return { ...s, estatusComercial: 'RESERVADO' as const }
      })

      return { campanas, clientes, reservas, sitios }
    })

    const c = getDemoState().campanas.find((x) => x.id === campanaId)!
    return delay(c)
  },

  // Acto 3 — CONFIRMAR: reservas TENTATIVA → CONFIRMADA, sitios → OCUPADO,
  // campaña → CONFIRMADA. El dashboard recalcula ocupación solo.
  async confirmarReserva(campanaId: string): Promise<Campana> {
    mutateDemo((state) => {
      const sitiosConfirmados = new Set(
        state.reservas
          .filter((r) => r.campanaId === campanaId && r.estatus === 'TENTATIVA')
          .map((r) => r.sitioId),
      )
      return {
        reservas: state.reservas.map((r) =>
          r.campanaId === campanaId && r.estatus === 'TENTATIVA'
            ? { ...r, estatus: 'CONFIRMADA' as const }
            : r,
        ),
        sitios: state.sitios.map((s) =>
          sitiosConfirmados.has(s.id) ? { ...s, estatusComercial: 'OCUPADO' as const } : s,
        ),
        campanas: state.campanas.map((c) =>
          c.id === campanaId ? { ...c, estadoComercial: 'CONFIRMADA' as const } : c,
        ),
      }
    })
    return delay(getDemoState().campanas.find((x) => x.id === campanaId)!)
  },

  async extenderCampana(campanaId: string, nuevaFechaFin: string): Promise<Campana> {
    mutateDemo((state) => ({
      campanas: state.campanas.map((c) =>
        c.id === campanaId ? { ...c, fechaFin: nuevaFechaFin } : c,
      ),
      reservas: state.reservas.map((r) =>
        r.campanaId === campanaId ? { ...r, fechaFin: nuevaFechaFin } : r,
      ),
    }))
    return delay(getDemoState().campanas.find((x) => x.id === campanaId)!)
  },

  // Acto 4 — CERRAR OT con foto: OT COMPLETADA + evidencia, y la campaña recibe
  // fotos comprobatorias + reporte → el CANDADO se enciende en vivo.
  async cerrarOT(otId: string, input: CerrarOTInput): Promise<OrdenTrabajo> {
    mutateDemo((state) => {
      const ot = state.ordenesTrabajo.find((o) => o.id === otId)
      const evidencias = [...state.evidencias]
      if (ot) {
        evidencias.push({
          id: uid('ev'),
          otId,
          fotoUrl: input.fotoUrl,
          formato: 'image/jpeg',
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          precision: 8,
          tipo: 'INSTALACION',
          uploadedBy: 'user-cuadrilla-1',
          timestamp: nowISO(),
        })
      }
      const ordenesTrabajo = state.ordenesTrabajo.map((o) =>
        o.id === otId
          ? {
              ...o,
              estatus: 'COMPLETADA' as const,
              checklist: o.checklist.map((i) => ({ ...i, hecho: true })),
              fechaInicio: o.fechaInicio ?? nowISO(),
              fechaCompletada: nowISO(),
            }
          : o,
      )
      // Encender candado de la campaña ligada (fotos + reporte).
      const campanas = ot?.campanaId
        ? state.campanas.map((c) =>
            c.id === ot.campanaId
              ? {
                  ...c,
                  fotosComprobatorias: true,
                  reportePublicacion: true,
                  reportePublicacionUrl: c.reportePublicacionUrl ?? 'mock://reporte/auto.pdf',
                  estadoComercial:
                    c.ocRecibida ? ('LISTA_FACTURAR' as const) : c.estadoComercial,
                }
              : c,
          )
        : state.campanas
      return { evidencias, ordenesTrabajo, campanas }
    })
    return delay(getDemoState().ordenesTrabajo.find((o) => o.id === otId)!)
  },

  // Acto 2 — REPORTAR INCIDENCIA: nueva incidencia abierta + sitio BLOQUEADO
  // (rojo en Comercial al instante).
  async reportarIncidencia(input: ReportarIncidenciaInput): Promise<Incidencia> {
    const inc: Incidencia = {
      id: uid('inc'),
      sitioId: input.sitioId,
      tipo: input.tipo,
      descripcion: input.descripcion,
      fechaInicio: nowISO(),
      fechaResolucion: null,
      impactaComercial: true,
      estatus: 'ABIERTA',
      fotos: [],
      reportadoPorUserId: 'user-arrendadores',
      notas: 'Reportada desde el módulo de Arrendadores.',
      creadoEn: nowISO(),
    }
    mutateDemo((state) => ({
      incidencias: [...state.incidencias, inc],
      sitios: state.sitios.map((s) =>
        s.id === input.sitioId
          ? { ...s, estatusComercial: 'BLOQUEADO' as const, estatusLegal: 'SUSPENDIDO' as const }
          : s,
      ),
    }))
    return delay(inc)
  },

  // Acto 5 — GENERAR FACTURA desde campaña con candado: factura EMITIDA +
  // cobranza AL_CORRIENTE con el plazo elegido.
  async generarFactura(campanaId: string, plazoDias: 60 | 90 | 120 = 90): Promise<Factura> {
    const c = getDemoState().campanas.find((x) => x.id === campanaId)
    if (!c) throw new Error('Campaña no encontrada')
    if (!candadoFacturacion(c)) throw new Error('La campaña no tiene el candado completo')

    const monto = c.presupuestoBruto ?? 0
    const factura: Factura = {
      id: uid('fac'),
      folio: `F001-${String(300 + _seq).padStart(8, '0')}`,
      campanaId,
      clienteId: c.clienteId,
      monto,
      moneda: 'PEN',
      fechaEmision: nowISO(),
      estatus: 'EMITIDA',
      creadoEn: nowISO(),
    }
    mutateDemo((state) => ({
      facturas: [...state.facturas, factura],
      cobranzas: [
        ...state.cobranzas,
        {
          id: uid('cob'),
          facturaId: factura.id,
          plazoDias,
          fechaVencimiento: offsetISO(plazoDias),
          estatus: 'AL_CORRIENTE' as const,
          montoPagado: 0,
          creadoEn: nowISO(),
        },
      ],
      campanas: state.campanas.map((x) =>
        x.id === campanaId ? { ...x, estadoComercial: 'COMPLETADA' as const } : x,
      ),
    }))
    return delay(factura)
  },

  async registrarPagoRenta(pagoId: string): Promise<void> {
    mutateDemo((state) => ({
      pagosRenta: state.pagosRenta.map((p) =>
        p.id === pagoId ? { ...p, estatus: 'PAGADO' as const, fechaPago: nowISO() } : p,
      ),
    }))
    return delay(undefined)
  },

  async iniciarRenovacion(contratoId: string): Promise<void> {
    mutateDemo((state) => ({
      contratos: state.contratos.map((c) =>
        c.id === contratoId
          ? { ...c, estatus: 'RENOVADO' as const, fechaFin: offsetISO(365) }
          : c,
      ),
    }))
    return delay(undefined)
  },
}

export type MockAdapter = typeof mockAdapter
