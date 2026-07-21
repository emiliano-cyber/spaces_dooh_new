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

import { getDemoState, getUsuarioActivo, mutateDemo } from '../store'
import { candadoFacturacion } from '../derive'
import type {
  Campana,
  Incidencia,
  Factura,
  OrdenTrabajo,
  Reserva,
  TipoIncidencia,
  AccionLog,
  Sitio,
  TipoMedio,
  TipoCampana,
  Comercializacion,
  CMS,
  TipoContenido,
  ImportSummary,
  ImportResultRow,
  ModoDuplicado,
} from '../types'
import type { FilaValidada } from '../../inventario-import'

// tipo_medio del archivo (lista validada) → enum TipoMedio.
const MAPEO_TIPO: Record<string, TipoMedio> = {
  espectacular: 'ESPECTACULAR',
  muro: 'MURAL',
  valla: 'VALLA',
  parabus: 'MOBILIARIO_URBANO',
  mupi: 'MOBILIARIO_URBANO',
  publitienda: 'MOBILIARIO_URBANO',
  puente: 'PUENTE_PEATONAL',
  otro: 'OTRO',
}

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

// Entrada de bitácora con el usuario en sesión. Se antepone a state.acciones.
function acc(accion: string, entidad: string): AccionLog {
  const u = getUsuarioActivo()
  return {
    id: uid('acc'),
    accion,
    entidad,
    usuarioId: u?.id ?? null,
    usuarioNombre: u?.nombre ?? 'Sistema',
    timestamp: nowISO(),
  }
}

export interface ReservarInput {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
  // Tipo manual; si se omite se deriva del medio de los sitios reservados.
  tipoCampana?: TipoCampana
}

export interface AltaSitioInput {
  nombre: string
  tipoMedio: TipoMedio
  direccionPredio: string
  direccionComercial: string
  distrito: string
  lat: number
  lng: number
  ancho: number
  alto: number
  iluminado: boolean
  tarifaPublicada: number
  comercializacion: Comercializacion
  enNetwork: boolean
  cms: CMS | null
  resolucionPx: string | null
  tipoContenido: TipoContenido | null
  // Opcionales del formulario de 5 tabs / importador.
  exhibicion?: string // fijo | digital | rotativo
  codigoProveedor?: string
  estatusComercial?: Sitio['estatusComercial']
  costoCompra?: number
  caras?: number
  modalidades?: string[]
  duracionSpotSeg?: number | null
  totalSpots?: number | null
  spotsDisponibles?: number | null
  computerVision?: boolean
  admobilizeId?: string | null
  precioM2?: number | null
  imagenPromocional?: string | null
  pendienteVerificacion?: boolean
  modalidadesDetalle?: { unidad: string; tarifaPublicada: number; costoCompra: number }[]
}

// Perfiles para autollenar campos técnicos al dar de alta una pantalla.
const ESTRUCTURA_POR_MEDIO: Record<TipoMedio, string> = {
  ESPECTACULAR: 'unipolar',
  PANTALLA_DIGITAL: 'pantalla LED',
  VALLA: 'a piso',
  MOBILIARIO_URBANO: 'mupi',
  PUENTE_PEATONAL: 'puente peatonal',
  MURAL: 'muro',
  OTRO: 'otro',
}

// Construye un Sitio completo a partir del input (formulario o importador),
// rellenando defaults coherentes. No muta el store.
function construirSitio(input: AltaSitioInput): Sitio {
  const digital =
    input.tipoMedio === 'PANTALLA_DIGITAL' ||
    input.exhibicion === 'rotativo' ||
    input.exhibicion === 'digital'
  const esEstatica = !digital
  const precioM2 = input.precioM2 ?? null
  // tarifa de impresión por m² solo para estáticas con precio configurado
  const tarifaImpresion =
    esEstatica && precioM2 ? Math.round(input.ancho * input.alto * precioM2) : null
  return {
    id: uid('sitio'),
    claveInterna: `BP-${String(100 + _seq).padStart(3, '0')}`,
    nombre: input.nombre,
    tipoMedio: input.tipoMedio,
    lat: input.lat,
    lng: input.lng,
    direccion: input.direccionComercial,
    alcaldia: input.distrito,
    ciudad: input.distrito || 'Lima',
    estado: input.distrito || 'Lima',
    pais: 'PE',
    alto: input.alto,
    ancho: input.ancho,
    iluminado: input.iluminado,
    orientacion: 'Norte',
    fotos: [],
    estatusComercial: input.estatusComercial ?? 'DISPONIBLE',
    estatusLegal: 'EN_ORDEN',
    estatusOperativo: 'ACTIVO',
    notas: null,
    tarifaMensual: input.tarifaPublicada,
    codigoProveedor: input.codigoProveedor || `056${String(_seq).padStart(2, '0')}-${digital ? 'D' : 'E'}01`,
    exhibicion: digital ? 'rotativo' : 'fijo',
    unidad: (input.modalidades && input.modalidades[0]?.toLowerCase()) || (digital ? 'mensual' : 'catorcenal'),
    esRotativo: digital,
    plazaCiudad: input.distrito || 'Lima',
    caras: input.caras ?? (input.tipoMedio === 'MOBILIARIO_URBANO' ? 2 : 1),
    tipoEstructura: ESTRUCTURA_POR_MEDIO[input.tipoMedio],
    vista: 'N-S',
    tramo: 'tramo nuevo',
    tarifaPublicada: input.tarifaPublicada,
    costoCompra: input.costoCompra ?? Math.round(input.tarifaPublicada * 0.62),
    spotsPorHora: digital ? 6 : null,
    duracionSpotSeg: input.duracionSpotSeg ?? (digital ? 10 : null),
    horario: digital ? '06:00–24:00' : null,
    direccionPredio: input.direccionPredio,
    direccionComercial: input.direccionComercial,
    resolucionPx: input.resolucionPx,
    tipoContenido: input.tipoContenido,
    comercializacion: input.comercializacion,
    enNetwork: input.enNetwork,
    cms: input.cms,
    modalidades: input.modalidades ?? [digital ? 'Mensual' : 'Catorcenal'],
    modalidadesDetalle: input.modalidadesDetalle,
    totalSpots: input.totalSpots ?? (digital ? 100 : null),
    spotsDisponibles: input.spotsDisponibles ?? (digital ? 85 : null),
    precioM2,
    tarifaImpresion,
    computerVision: input.computerVision ?? false,
    admobilizeId: input.admobilizeId ?? null,
    imagenPromocional: input.imagenPromocional ?? null,
    pendienteVerificacion: input.pendienteVerificacion ?? false,
    creadoEn: nowISO(),
  }
}

export interface CerrarOTInput {
  fotoUrl: string
  tomadaEn?: string // fecha de creación de la imagen (EXIF/archivo)
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

  // ALTA DE PANTALLA: crea un sitio nuevo en el inventario (mapa + lista en vivo).
  async altaSitio(input: AltaSitioInput): Promise<Sitio> {
    const sitio = construirSitio(input)
    mutateDemo((state) => ({
      sitios: [...state.sitios, sitio],
      acciones: [acc('Dio de alta pantalla', sitio.nombre), ...state.acciones],
    }))
    return delay(sitio)
  },

  // IMPORTAR INVENTARIO: crea/actualiza pantallas desde filas validadas de un
  // Excel/CSV. Maneja duplicados según el modo elegido y asocia imágenes.
  async importarInventario(args: {
    filas: FilaValidada[]
    modoDuplicado: ModoDuplicado
    precioM2: number | null
    imagenes: Record<string, string>
  }): Promise<ImportSummary> {
    const { filas, modoDuplicado, precioM2, imagenes } = args
    const detalle: ImportResultRow[] = []
    let creadas = 0,
      actualizadas = 0,
      con_advertencias = 0,
      errores = 0

    mutateDemo((state) => {
      const sitios = [...state.sitios]
      const acciones = [...state.acciones]

      // Asocia imagen por código de proveedor (la plantilla no trae columna de
      // imagen; las imágenes se suben en bulk y se emparejan por nombre = código).
      const imagenDe = (codigo: string): string | null => {
        if (!codigo) return null
        const porCodigo = Object.keys(imagenes).find(
          (f) => f.replace(/\.[^.]+$/, '').toLowerCase() === codigo.toLowerCase(),
        )
        return porCodigo ? imagenes[porCodigo] : null
      }

      // 1) Errores por fila + agrupar filas válidas por codigo_proveedor.
      //    Cada fila = una modalidad; el sistema crea UN sitio por código.
      const grupos = new Map<string, FilaValidada[]>()
      let _sinCodigo = 0
      for (const fila of filas) {
        if (fila.status === 'error' || !fila.datos) {
          errores++
          detalle.push({ codigo_proveedor: fila.codigo_proveedor, status: 'error', mensaje: fila.mensaje })
          continue
        }
        const clave = fila.datos.codigo_proveedor || `__sin_codigo_${++_sinCodigo}`
        const g = grupos.get(clave)
        if (g) g.push(fila)
        else grupos.set(clave, [fila])
      }

      // 2) Un sitio por grupo, con una modalidad por fila.
      for (const [clave, rows] of grupos) {
        const principal = rows[0].datos!
        const tipoMedio = MAPEO_TIPO[principal.tipo_medio] ?? 'OTRO'
        const img = imagenDe(principal.codigo_proveedor)
        const modalidadesDetalle = rows.map((r) => ({
          unidad: r.datos!.unidad,
          tarifaPublicada: r.datos!.tarifa_publicada,
          costoCompra: r.datos!.costo_compra,
        }))
        const base: AltaSitioInput = {
          nombre: principal.nombre,
          tipoMedio,
          direccionPredio: principal.direccion,
          direccionComercial: principal.direccion,
          distrito: principal.plaza_ciudad,
          lat: principal.latitud,
          lng: principal.longitud,
          ancho: principal.ancho_m,
          alto: principal.alto_m,
          iluminado: principal.iluminacion,
          tarifaPublicada: principal.tarifa_publicada,
          comercializacion: principal.exhibicion === 'digital' ? 'PROGRAMATICO' : 'TRADICIONAL',
          enNetwork: false,
          cms: null,
          resolucionPx: null,
          tipoContenido: principal.exhibicion === 'digital' ? 'VIDEO' : null,
          exhibicion: principal.exhibicion,
          codigoProveedor: principal.codigo_proveedor,
          costoCompra: principal.costo_compra,
          caras: principal.caras,
          duracionSpotSeg: principal.duracion_spot_seg,
          precioM2,
          imagenPromocional: img,
          pendienteVerificacion: principal.pendienteVerificacion,
          modalidades: modalidadesDetalle.map((m) => m.unidad),
          modalidadesDetalle,
        }

        const codigoReal = principal.codigo_proveedor
        const existente = codigoReal ? sitios.find((s) => s.codigoProveedor === codigoReal) : undefined
        const conAdvertencia = rows.some((r) => r.status === 'advertencia')
        const sufijoMod = rows.length > 1 ? ` (${rows.length} modalidades)` : ''
        const advTxt = conAdvertencia
          ? ` · advertencias: ${rows.filter((r) => r.status === 'advertencia').map((r) => r.mensaje).join('; ')}`
          : ''

        if (existente && modoDuplicado === 'ACTUALIZAR') {
          const nuevo = construirSitio(base)
          const i = sitios.indexOf(existente)
          sitios[i] = {
            ...nuevo,
            id: existente.id,
            claveInterna: existente.claveInterna,
            imagenPromocional: img ?? existente.imagenPromocional,
            creadoEn: existente.creadoEn,
          }
          if (conAdvertencia) con_advertencias++
          else actualizadas++
          detalle.push({
            codigo_proveedor: codigoReal,
            status: conAdvertencia ? 'advertencia' : 'actualizado',
            mensaje: `Actualizado${sufijoMod}${advTxt}`,
          })
        } else {
          let codigo = codigoReal
          if (existente && modoDuplicado === 'NUEVA_VERSION') {
            let v = 2
            while (sitios.some((s) => s.codigoProveedor === `${codigoReal}-v${v}`)) v++
            codigo = `${codigoReal}-v${v}`
          }
          sitios.push(construirSitio({ ...base, codigoProveedor: codigo || undefined }))
          if (conAdvertencia) con_advertencias++
          else creadas++
          detalle.push({
            codigo_proveedor: codigo || clave,
            status: conAdvertencia ? 'advertencia' : 'creado',
            mensaje: `Creado${sufijoMod}${advTxt}`,
          })
        }
      }

      acciones.unshift(acc('Importó inventario', `${grupos.size} sitios · ${filas.length} filas`))
      return { sitios, acciones }
    })

    return delay({
      total_filas: filas.length,
      creadas,
      actualizadas,
      con_advertencias,
      errores,
      detalle,
    })
  },

  // NETWORK: el dueño decide qué espacios comparte con la Network.
  async toggleNetwork(sitioId: string): Promise<void> {
    mutateDemo((state) => {
      const sit = state.sitios.find((s) => s.id === sitioId)
      return {
        sitios: state.sitios.map((s) =>
          s.id === sitioId ? { ...s, enNetwork: !s.enNetwork } : s,
        ),
        acciones: [
          acc(sit?.enNetwork ? 'Quitó de Network' : 'Compartió a Network', sit?.nombre ?? sitioId),
          ...state.acciones,
        ],
      }
    })
    return delay(undefined)
  },

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
        // Tipo de campaña derivado del medio de los sitios reservados:
        // pantallas digitales → DOOH (su pipeline omite "En imprenta"),
        // estáticas → OOH, y mezcla → HIBRIDA.
        const sitiosSel = state.sitios.filter((s) => input.sitioIds.includes(s.id))
        const digitales = sitiosSel.filter(
          (s) =>
            s.tipoMedio === 'PANTALLA_DIGITAL' ||
            s.esRotativo ||
            s.exhibicion === 'digital' ||
            s.exhibicion === 'rotativo',
        ).length
        const tipoCampana: TipoCampana =
          input.tipoCampana ??
          (sitiosSel.length > 0 && digitales === sitiosSel.length
            ? 'DOOH'
            : digitales === 0
              ? 'OOH'
              : 'HIBRIDA')
        const cliId = uid('cli')
        clientes = [
          ...clientes,
          {
            id: cliId,
            nombre: input.clienteNombre ?? 'Cliente nuevo',
            rfc: null,
            razonSocial: null,
            regimenFiscal: null,
            cpFiscal: null,
            usoCfdi: null,
            ivaPct: 16,
            comisionAgenciaPct: 0,
            agenciaId: null,
            tieneNegociacion: false,
            negociacionValidada: false,
            negociacionNota: null,
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
            propuestaId: null,
            agencia: null,
            marca: input.clienteNombre ?? null,
            tipoCampana,
            fechaInicio: input.fechaInicio,
            fechaFin: input.fechaFin,
            presupuestoBruto: null,
            presupuestoNeto: null,
            moneda: 'PEN',
            estadoComercial: 'COTIZACION',
            enviadaDominio: false,
            enviadaDominioEn: null,
            validacionEstatus: 'PENDIENTE',
            validacionMotivo: null,
            validacionPor: null,
            validacionEn: null,
            ocRecibida: false,
            fotosComprobatorias: false,
            reportePublicacion: false,
            ocUrl: null,
            contratoUrl: null,
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
          spotsReservados: null,
          expiraEn: offsetISO(7),
          creativos: [],
          creadoEn: nowISO(),
        }
        reservas.push(res)
        nuevasReservas.push(res)
        return { ...s, estatusComercial: 'RESERVADO' as const }
      })

      return {
        campanas,
        clientes,
        reservas,
        sitios,
        acciones: [
          acc('Reservó (tentativa)', input.nombreCampana ?? input.clienteNombre ?? 'Campaña'),
          ...state.acciones,
        ],
      }
    })

    const c = getDemoState().campanas.find((x) => x.id === campanaId)!
    return delay(c)
  },

  // Acto 3 — CONFIRMAR: reservas TENTATIVA → CONFIRMADA, sitios → OCUPADO,
  // campaña → CONFIRMADA. El dashboard recalcula ocupación solo.
  async confirmarReserva(campanaId: string): Promise<Campana> {
    mutateDemo((state) => {
      const camp = state.campanas.find((c) => c.id === campanaId)
      const sitiosConfirmados = new Set(
        state.reservas
          .filter((r) => r.campanaId === campanaId && r.estatus === 'TENTATIVA')
          .map((r) => r.sitioId),
      )
      return {
        reservas: state.reservas.map((r) =>
          r.campanaId === campanaId && r.estatus === 'TENTATIVA'
            ? { ...r, estatus: 'CONFIRMADA' as const, expiraEn: null }
            : r,
        ),
        sitios: state.sitios.map((s) =>
          sitiosConfirmados.has(s.id) ? { ...s, estatusComercial: 'OCUPADO' as const } : s,
        ),
        campanas: state.campanas.map((c) =>
          c.id === campanaId ? { ...c, estadoComercial: 'CONFIRMADA' as const } : c,
        ),
        acciones: [acc('Confirmó reserva', camp?.nombre ?? campanaId), ...state.acciones],
      }
    })
    return delay(getDemoState().campanas.find((x) => x.id === campanaId)!)
  },

  async extenderCampana(campanaId: string, nuevaFechaFin: string): Promise<Campana> {
    mutateDemo((state) => {
      const camp = state.campanas.find((c) => c.id === campanaId)
      return {
        campanas: state.campanas.map((c) =>
          c.id === campanaId ? { ...c, fechaFin: nuevaFechaFin } : c,
        ),
        reservas: state.reservas.map((r) =>
          r.campanaId === campanaId ? { ...r, fechaFin: nuevaFechaFin } : r,
        ),
        acciones: [acc('Extendió campaña', camp?.nombre ?? campanaId), ...state.acciones],
      }
    })
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
          tomadaEn: input.tomadaEn ?? nowISO(),
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
      return {
        evidencias,
        ordenesTrabajo,
        campanas,
        acciones: [acc('Cerró OT con foto', ot?.folio ?? otId), ...state.acciones],
      }
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
    mutateDemo((state) => {
      const sit = state.sitios.find((s) => s.id === input.sitioId)
      return {
        incidencias: [...state.incidencias, inc],
        sitios: state.sitios.map((s) =>
          s.id === input.sitioId
            ? { ...s, estatusComercial: 'BLOQUEADO' as const, estatusLegal: 'SUSPENDIDO' as const }
            : s,
        ),
        acciones: [acc('Reportó incidencia', sit?.nombre ?? input.sitioId), ...state.acciones],
      }
    })
    return delay(inc)
  },

  // Acto 5 — GENERAR FACTURA desde campaña con candado: factura EMITIDA +
  // cobranza AL_CORRIENTE con el plazo elegido.
  async generarFactura(campanaId: string, plazoDias: 60 | 90 | 120 = 90): Promise<Factura> {
    const c = getDemoState().campanas.find((x) => x.id === campanaId)
    if (!c) throw new Error('Campaña no encontrada')
    if (!candadoFacturacion(c)) throw new Error('La campaña no tiene el candado completo')

    const subtotal = c.presupuestoNeto ?? 0
    const igv = Math.round(subtotal * 0.18 * 100) / 100
    const monto = c.presupuestoBruto ?? Math.round((subtotal + igv) * 100) / 100
    const factura: Factura = {
      id: uid('fac'),
      folio: `F001-${String(300 + _seq).padStart(8, '0')}`,
      campanaId,
      clienteId: c.clienteId,
      subtotal,
      igv,
      monto,
      moneda: 'PEN',
      fechaEmision: nowISO(),
      estatus: 'EMITIDA',
      serie: null,
      folioFiscal: null,
      rfc: null,
      razonSocial: null,
      usoCfdi: null,
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
          recordatorioEn: null,
          recordatoriosEnviados: 0,
          creadoEn: nowISO(),
        },
      ],
      campanas: state.campanas.map((x) =>
        x.id === campanaId ? { ...x, estadoComercial: 'COMPLETADA' as const } : x,
      ),
      acciones: [acc('Generó factura', `${factura.folio} · ${c.nombre}`), ...state.acciones],
    }))
    return delay(factura)
  },

  async registrarPagoRenta(pagoId: string): Promise<void> {
    mutateDemo((state) => {
      const pago = state.pagosRenta.find((p) => p.id === pagoId)
      return {
        pagosRenta: state.pagosRenta.map((p) =>
          p.id === pagoId ? { ...p, estatus: 'PAGADO' as const, fechaPago: nowISO() } : p,
        ),
        acciones: [acc('Registró pago de renta', pago?.periodo ?? pagoId), ...state.acciones],
      }
    })
    return delay(undefined)
  },

  async iniciarRenovacion(contratoId: string): Promise<void> {
    mutateDemo((state) => ({
      contratos: state.contratos.map((c) =>
        c.id === contratoId
          ? { ...c, estatus: 'RENOVADO' as const, fechaFin: offsetISO(365) }
          : c,
      ),
      acciones: [acc('Inició renovación de contrato', contratoId), ...state.acciones],
    }))
    return delay(undefined)
  },
}

export type MockAdapter = typeof mockAdapter
