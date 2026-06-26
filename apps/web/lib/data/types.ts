// ============================================================================
//  lib/data/types.ts — Tipos de la demo "Billboards Perú SA"
// ----------------------------------------------------------------------------
//  CONTRATO DE DESACOPLE (léelo antes de tocar nada):
//
//  Estos tipos ESPEJAN el schema de Prisma en `apps/api/prisma/schema.prisma`
//  (modelos del schema `tenant_template`). Los nombres de campos y enums se
//  mantienen idénticos a Prisma a propósito: cuando el backend Fastify se
//  conecte (vía `adapters/http.ts`), el cableado es 1:1 y no hay que renombrar.
//
//  Entidades marcadas con  // [DEMO — no existe en Prisma todavía]  son nuevas
//  para esta demo (OrdenImpresion, Factura, Cobranza, Reserva). Están nombradas
//  en el mismo estilo de Prisma para que crear el modelo real sea trivial.
//
//  Notas de localización Perú: pais 'PE', ciudad/estado 'Lima', `alcaldia` se
//  usa como *distrito* (San Isidro, Miraflores...), moneda 'PEN'. En Prisma los
//  defaults son MX/MXN pero son sólo defaults — no requieren cambio de schema.
// ============================================================================

// ─── Enums (verbatim de Prisma) ─────────────────────────────────────────────

export type TipoMedio =
  | 'ESPECTACULAR'
  | 'PANTALLA_DIGITAL'
  | 'PUENTE_PEATONAL'
  | 'MOBILIARIO_URBANO'
  | 'MURAL'
  | 'VALLA'
  | 'OTRO'

export type EstComercial =
  | 'DISPONIBLE'
  | 'RESERVADO'
  | 'OCUPADO'
  | 'BLOQUEADO'
  | 'EN_MANTENIMIENTO'
  | 'BAJA'

export type EstLegal =
  | 'EN_ORDEN'
  | 'PERMISO_VENCIDO'
  | 'EN_TRAMITE'
  | 'SUSPENDIDO'
  | 'SIN_PERMISO'

export type EstOperativo = 'ACTIVO' | 'EN_MANTENIMIENTO' | 'APAGADO' | 'DAÑADO' | 'BAJA'

export type EstContrato = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'RENOVADO' | 'CANCELADO'

export type TipoIncidencia =
  | 'CLIMA'
  | 'MANTENIMIENTO'
  | 'LEGAL'
  | 'VANDALISMO'
  | 'SUSPENSION_OPERATIVA'
  | 'ACCIDENTE'
  | 'OTRO'

export type EstIncidencia = 'ABIERTA' | 'EN_PROCESO' | 'RESUELTA' | 'CERRADA'

export type Prioridad = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'

export type TipoOT =
  | 'MONTAJE_LONA'
  | 'MONTAJE_DIGITAL'
  | 'DESMONTAJE'
  | 'MANTENIMIENTO_PREVENTIVO'
  | 'MANTENIMIENTO_CORRECTIVO'
  | 'HERRERIA'
  | 'ELECTRICO'
  | 'INSPECCION'
  | 'OTRO'

export type EstOT =
  | 'PENDIENTE'
  | 'ASIGNADA'
  | 'EN_PROCESO'
  | 'BLOQUEADA'
  | 'EN_REVISION'
  | 'COMPLETADA'
  | 'RECHAZADA'
  | 'CANCELADA'

export type TipoCampana = 'OOH' | 'DOOH' | 'HIBRIDA'

export type EstComercialCampana =
  | 'DRAFT'
  | 'COTIZACION'
  | 'CONFIRMADA'
  | 'ACTIVA'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'LISTA_FACTURAR'

export type TipoVenta =
  | 'SPOT_UNIT'
  | 'DAY_PACK'
  | 'HOUR_PACK'
  | 'SOV'
  | 'TAKEOVER'
  | 'FIXED_PKG'
  | 'PROG_DIRECT'
  | 'PROG_PMP'
  | 'PROG_OPEN'
  | 'MAKEGOOD'
  | 'HOUSE_AD'

// ─── Enums [DEMO] (no existen en Prisma; nombrados en su estilo) ────────────

export type EstPagoRenta = 'PENDIENTE' | 'PAGADO' | 'VENCIDO'

export type EstOrdenImpresion =
  | 'ARTE_RECIBIDO'
  | 'VALIDADO'
  | 'EN_PRODUCCION'
  | 'IMPRESO'
  | 'LISTO_MONTAJE'

export type EstReserva = 'TENTATIVA' | 'CONFIRMADA' | 'CANCELADA'

export type EstFactura = 'EMITIDA' | 'PAGADA' | 'ANULADA'

export type EstCobranza = 'AL_CORRIENTE' | 'POR_VENCER' | 'VENCIDA' | 'PAGADA'

export type EstValidacionCreatividad = 'PENDIENTE' | 'VALIDADA' | 'RECHAZADA'

// Validación de publicación a nivel CAMPAÑA: se revisa la información de los
// anuncios una vez enviada al dominio/CMS, antes de salir al aire.
export type EstValidacionPublicacion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

// Etapas del pipeline de campaña (sección 7.4). Derivadas, no almacenadas.
export type EtapaPipeline =
  | 'reservada'
  | 'confirmada'
  | 'oc_recibida'
  | 'creativo_recibido'
  | 'creativo_validado'
  | 'en_imprenta'
  | 'en_produccion'
  | 'instalada'
  | 'reporte_generado'
  | 'lista_facturar'

// Rol de la demo. No es auth real.
export type RolDemo =
  | 'DUENO'
  | 'COMERCIAL'
  | 'OPERACIONES'
  | 'IMPRENTA'
  | 'FINANZAS'
  | 'CLIENTE'

// Usuario demo para el login mock (sin backend). La "sesión" vive en el store.
export interface UsuarioDemo {
  id: string
  nombre: string
  email: string
  cargo: string
  rol: RolDemo
  activo: boolean
}

// ─── Modelos espejo de Prisma ───────────────────────────────────────────────

export interface Sitio {
  id: string
  claveInterna: string
  nombre: string
  tipoMedio: TipoMedio
  lat: number
  lng: number
  direccion: string
  alcaldia: string | null // usado como distrito en Perú
  ciudad: string
  estado: string
  pais: string
  alto: number | null
  ancho: number | null
  iluminado: boolean
  orientacion: string | null
  fotos: string[] // espeja fotosJson
  estatusComercial: EstComercial
  estatusLegal: EstLegal
  estatusOperativo: EstOperativo
  notas: string | null
  // [DEMO] no en Prisma — tarifa de lista para filtro de precio (7.2)
  tarifaMensual: number
  // ─── Ficha de inventario (esquema del proveedor) ──────────────────────────
  codigoProveedor: string // codigo_proveedor (p. ej. 05605-E01)
  exhibicion: string // exhibicion: fijo / rotativo / digital
  unidad: string // unidad de contratación (catorcenal, mensual…)
  esRotativo: boolean // es_rotativo
  plazaCiudad: string // plaza_ciudad (mercado)
  caras: number // n.º de caras
  tipoEstructura: string // unipolar, bipolar, piso, mupi…
  vista: string // orientación de la vista (N-S, E-O…)
  tramo: string // tramo de vialidad
  tarifaPublicada: number // tarifa_publicada
  costoCompra: number // costo_compra (interno — para margen)
  spotsPorHora: number | null // DOOH
  duracionSpotSeg: number | null // DOOH
  horario: string | null // horario de exhibición (DOOH)
  // ─── Alta de inventario / Network (puntos 6 y 7 de la reunión) ────────────
  direccionPredio: string // dirección física del predio
  direccionComercial: string // dirección comercial (la que se muestra)
  resolucionPx: string | null // resolución en píxeles (DOOH), p. ej. 1920x1080
  tipoContenido: TipoContenido | null // video / imagen (DOOH)
  comercializacion: Comercializacion // programático vs tradicional
  enNetwork: boolean // compartido a la Network
  cms: CMS | null // CMS que opera la pantalla
  // ─── Agregar inventario (importador / formulario manual) ──────────────────
  modalidades: string[] // modalidades de contratación
  // Detalle por modalidad (una por fila del Excel agrupada por codigo_proveedor)
  modalidadesDetalle?: { unidad: string; tarifaPublicada: number; costoCompra: number }[]
  totalSpots: number | null // total de spots por pantalla (DOOH)
  spotsDisponibles: number | null // spots disponibles
  precioM2: number | null // precio por m² (estáticas)
  tarifaImpresion: number | null // ancho × alto × precioM2 (estáticas)
  computerVision: boolean // tecnología AdMobilize
  admobilizeId: string | null // ID del dispositivo AdMobilize
  imagenPromocional: string | null // url/nombre de la imagen promocional
  pendienteVerificacion: boolean // coords default → verificar
  creadoEn: string
}

export type TipoContenido = 'VIDEO' | 'IMAGEN'
export type Comercializacion = 'PROGRAMATICO' | 'TRADICIONAL'
export type CMS = 'BROADSIGN' | 'INVIDIS' | 'DOOHMAIN' | 'OTRO'

// ─── Importación masiva de inventario (Excel/CSV) ───────────────────────────
export type ImportStatus = 'creado' | 'actualizado' | 'error' | 'advertencia'
export type ModoDuplicado = 'ACTUALIZAR' | 'NUEVA_VERSION' // A | B

export interface ImportResultRow {
  codigo_proveedor: string
  status: ImportStatus
  mensaje: string
}
export interface ImportSummary {
  total_filas: number
  creadas: number
  actualizadas: number
  con_advertencias: number
  errores: number
  detalle: ImportResultRow[]
}

export interface Arrendador {
  id: string
  nombre: string
  rfc: string | null
  telefono: string | null
  email: string | null
  notas: string | null
  creadoEn: string
}

export interface ContratoArrendamiento {
  id: string
  sitioId: string
  arrendadorId: string
  fechaInicio: string
  fechaFin: string
  montoRenta: number
  periodicidad: string
  moneda: string
  autoRenovable: boolean
  documentoUrl: string | null
  estatus: EstContrato
  creadoEn: string
}

export interface PagoRenta {
  id: string
  contratoId: string
  periodo: string
  monto: number
  fechaPago: string | null
  facturaUrl: string | null
  estatus: EstPagoRenta
  creadoEn: string
}

export interface Incidencia {
  id: string
  sitioId: string
  tipo: TipoIncidencia
  descripcion: string
  fechaInicio: string
  fechaResolucion: string | null
  impactaComercial: boolean
  estatus: EstIncidencia
  fotos: string[]
  reportadoPorUserId: string
  notas: string | null
  creadoEn: string
}

export interface Cliente {
  id: string
  nombre: string
  rfc: string | null
  // Datos fiscales (para facturar). Una identidad fiscal por cliente; varias
  // (N RFC por cliente, estilo SET) queda como mejora futura.
  razonSocial: string | null
  regimenFiscal: string | null
  cpFiscal: string | null
  usoCfdi: string | null
  ivaPct: number              // IVA configurado para el cliente (default 16)
  comisionAgenciaPct: number  // comisión (divisor). Aplica a la AGENCIA (tipo AGENCIA)
  agenciaId: string | null    // agencia asociada al cliente (otro cliente tipo AGENCIA)
  // Negociación con la agencia (solo aplica a clientes tipo AGENCIA):
  tieneNegociacion: boolean   // ¿hay negociación con la agencia? sí/no
  negociacionValidada: boolean // si la hay, ¿está validada? (gate para propuestas)
  negociacionNota: string | null // términos negociados
  tipo: string
  contacto: { nombre?: string; email?: string; telefono?: string }
  activo: boolean
  creadoEn: string
}

export type EstPropuesta = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA'
export interface PropuestaItem {
  id: string
  propuestaId: string
  sitioId: string
  fechaInicio: string
  fechaFin: string
  precio: number // tarifa bruta de lista
  aprobado: boolean // aprobación granular (sitio por sitio)
}
export interface Propuesta {
  id: string
  folio: string
  clienteId: string | null
  agenciaId: string | null // agencia con la que se arma la propuesta (cliente AGENCIA)
  nombre: string
  fecha: string
  estatus: EstPropuesta
  comisionPct: number // comisión de agencia → divisor
  notas: string | null
  creadoEn: string
  items: PropuestaItem[]
  // Calculados con el método del divisor (server-side):
  bruto: number   // Σ precio de los items
  divisor: number // 1 − comisión/100
  neto: number    // bruto × divisor (lo que recibe el medio)
  iva: number     // bruto × 16%
  total: number   // bruto + iva (lo que paga el cliente)
  // Aprobación granular (sitio por sitio): presupuesto sobre lo aprobado.
  itemsAprobados: number
  brutoAprobado: number
  netoAprobado: number
  ivaAprobado: number
  totalAprobado: number
}

export type EstOdc = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA'
export interface OrdenCompra {
  id: string
  folio: string
  campanaId: string
  monto: number
  fecha: string
  estatus: EstOdc
  documentoUrl: string | null
  notas: string | null
  creadoEn: string
}

export interface Campana {
  id: string
  folio: string
  nombre: string
  clienteId: string
  propuestaId: string | null // propuesta de la que se derivó (null si es manual)
  agencia: string | null
  marca: string | null
  tipoCampana: TipoCampana
  fechaInicio: string
  fechaFin: string
  presupuestoBruto: number | null
  presupuestoNeto: number | null
  moneda: string
  estadoComercial: EstComercialCampana
  // Validación de publicación: la campaña se envía al dominio/CMS y un revisor
  // verifica los anuncios antes de salir al aire. Al aprobar → estado ACTIVA.
  enviadaDominio: boolean
  enviadaDominioEn: string | null
  validacionEstatus: EstValidacionPublicacion
  validacionMotivo: string | null
  validacionPor: string | null
  validacionEn: string | null
  // Las tres banderas del CANDADO de facturación (todas existen en Prisma):
  ocRecibida: boolean
  fotosComprobatorias: boolean
  reportePublicacion: boolean
  ocUrl: string | null
  reportePublicacionUrl: string | null
  portalToken: string | null
  portalActivo: boolean
  notas: string | null
  creadoEn: string
}

export interface Creatividad {
  id: string
  campanaId: string
  nombre: string
  archivoUrl: string | null
  codigo: string | null // creativo como código (HTML/UTF) en vez de imagen
  formato: string | null
  resolucion: string | null
  estatusValidacion: EstValidacionCreatividad
  rechazadoMotivo: string | null
  creadoEn: string
}

export interface ChecklistItem {
  label: string
  hecho: boolean
}

export interface OrdenTrabajo {
  id: string
  folio: string
  tipo: TipoOT
  sitioId: string | null
  descripcion: string
  instrucciones: string | null
  checklist: ChecklistItem[]
  prioridad: Prioridad
  asignadoAUserId: string | null
  supervisorUserId: string | null
  fechaProgramada: string | null
  fechaInicio: string | null
  fechaCompletada: string | null
  campanaId: string | null
  estatus: EstOT
  requiereRevision: boolean
  notas: string | null
  creadoEn: string
}

export interface EvidenciaOT {
  id: string
  otId: string
  fotoUrl: string
  fotoKey?: string | null // key en Spaces si la imagen se subió a storage
  formato: string
  lat: number | null
  lng: number | null
  precision: number | null
  tipo: string
  uploadedBy: string
  tomadaEn: string // fecha de creación de la imagen (EXIF / archivo)
  timestamp: string // fecha de subida
}

// Metadata de una imagen cargada en el uploader mock: URL + dos fechas.
export interface FotoMeta {
  url: string
  tomadaEn: string // creación de la imagen (EXIF DateTimeOriginal / lastModified)
  subidaEn: string // momento de la carga
}

// ─── Modelos [DEMO — no existen en Prisma todavía] ──────────────────────────

// Generaliza CampaignLine de Prisma (sitio↔campaña + fechas + precio) con un
// estatus tentativa/confirmada que la demo muta en vivo (Acto 3).
export interface Reserva {
  id: string
  campanaId: string
  sitioId: string
  fechaInicio: string
  fechaFin: string
  precio: number
  tipoVenta: TipoVenta
  estatus: EstReserva
  spotsReservados: number | null // spots reservados (DOOH); null en estáticas
  creativos: SpotCreativo[] // creativos exhibidos en este spot + cuántas veces cada uno
  creadoEn: string
}

// Un creativo asignado a un spot reservado y cuántas veces se reproduce ahí.
export interface SpotCreativo {
  creatividadId: string
  veces: number
}

// No hay modelo de impresión física en Prisma (TrafficOrder es digital).
export interface OrdenImpresion {
  id: string
  folio: string
  campanaId: string
  sitioId: string
  material: string
  alto: number
  ancho: number
  estatus: EstOrdenImpresion
  proveedor: string | null
  pruebaColorUrl: string | null      // prueba de color (probatorio)
  pruebaColorAprobada: boolean
  creadoEn: string
}

// No hay modelo de facturación en Prisma.
export interface Factura {
  id: string
  folio: string
  campanaId: string
  clienteId: string
  subtotal: number // neto sin IGV
  igv: number // IGV/IVA
  monto: number // total = subtotal + igv
  moneda: string
  fechaEmision: string
  estatus: EstFactura
  // Datos fiscales (snapshot al emitir) + folio fiscal simulado (CFDI/UUID)
  serie: string | null
  folioFiscal: string | null
  rfc: string | null
  razonSocial: string | null
  usoCfdi: string | null
  creadoEn: string
}

// No hay modelo de cobranza en Prisma.
export interface Cobranza {
  id: string
  facturaId: string
  plazoDias: 60 | 90 | 120
  fechaVencimiento: string
  estatus: EstCobranza
  montoPagado: number
  creadoEn: string
}

// ─── Estado raíz del store ──────────────────────────────────────────────────

// Bitácora de acciones: cada proceso registra quién y cuándo (punto 2 de la
// reunión). Se alimenta desde las mutaciones del adapter y del store.
export interface AccionLog {
  id: string
  accion: string // etiqueta legible: "Confirmó reserva", "Cerró OT"…
  entidad: string // sobre qué: "Telco Andina", "OT-2026-0142"…
  usuarioId: string | null
  usuarioNombre: string
  timestamp: string
}

// Configuración del negocio (Administración → mock editable).
export interface ConfigNegocio {
  nombreTenant: string
  moneda: string
  plazosCobranza: number[]
  tiposTarea: string[]
}

export interface Notificacion {
  id: string
  tipo: string
  nivel: 'info' | 'ok' | 'warn'
  titulo: string
  detalle: string | null
  link: string | null
  leida: boolean
  creadoEn: string
}

export interface DemoState {
  usuarios: UsuarioDemo[]
  configNegocio: ConfigNegocio
  sitios: Sitio[]
  arrendadores: Arrendador[]
  contratos: ContratoArrendamiento[]
  pagosRenta: PagoRenta[]
  incidencias: Incidencia[]
  clientes: Cliente[]
  propuestas: Propuesta[]
  ordenesCompra: OrdenCompra[]
  campanas: Campana[]
  creatividades: Creatividad[]
  reservas: Reserva[]
  ordenesTrabajo: OrdenTrabajo[]
  evidencias: EvidenciaOT[]
  ordenesImpresion: OrdenImpresion[]
  facturas: Factura[]
  cobranzas: Cobranza[]
  acciones: AccionLog[]
  notificaciones: Notificacion[]
}
