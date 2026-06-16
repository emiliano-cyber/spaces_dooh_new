// ============================================================================
//  lib/data/seed.ts — Datos demo "Billboards Perú SA" (S/ PEN, Lima)
// ----------------------------------------------------------------------------
//  TODAS las fechas son relativas a `hoy` (new Date() + offsets). Nunca
//  hardcodeadas: la demo se ve viva cualquier día sin tocar el código.
//
//  HILO CONDUCTOR: la campaña "Telco Andina" (camp-telco) aparece consistente
//  en TODOS los módulos — mismos sitios, mismas fechas, mismos IDs:
//    · pipeline en etapa "en imprenta"
//    · orden de impresión EN PRODUCCION (oi-telco)
//    · tarea de cuadrilla de montaje PENDIENTE + OT móvil (ot-telco)
//    · portal token activo (telco-andina-2026)
//    · candado de facturación apagado (faltan fotos+reporte) → se enciende EN
//      VIVO al cerrar la OT con foto en el Acto 4.
// ============================================================================

import { USUARIOS_DEMO } from './usuarios'
import type {
  DemoState,
  Sitio,
  Arrendador,
  ContratoArrendamiento,
  PagoRenta,
  Incidencia,
  Cliente,
  Campana,
  Creatividad,
  Reserva,
  OrdenTrabajo,
  EvidenciaOT,
  OrdenImpresion,
  Factura,
  Cobranza,
  AccionLog,
} from './types'

// ─── Helpers de fecha relativa ──────────────────────────────────────────────

function offsetISO(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}
const hoy = () => offsetISO(0)

// ─── Sitios (14 avenidas de Lima, coords reales aproximadas) ────────────────
// Estatus comercial sembrado consistente con campañas e incidencias:
//   DISPONIBLE (verde) · RESERVADO (ámbar) · OCUPADO (vendido) · BLOQUEADO (rojo)

// Catálogo de estructura/dimensiones por tipo de medio (valores peruanos
// coherentes para la ficha de inventario). Declarado ANTES del array `sitios`
// porque éste invoca s() al evaluar el módulo (evita TDZ).
const PERFIL_MEDIO: Record<
  Sitio['tipoMedio'],
  { ancho: number; alto: number; estructura: string; exhibicion: string; unidad: string; digital: boolean }
> = {
  ESPECTACULAR: { ancho: 12.9, alto: 7.2, estructura: 'unipolar', exhibicion: 'fijo', unidad: 'catorcenal', digital: false },
  PANTALLA_DIGITAL: { ancho: 9.6, alto: 5.4, estructura: 'pantalla LED', exhibicion: 'rotativo', unidad: 'mensual', digital: true },
  VALLA: { ancho: 8.0, alto: 4.0, estructura: 'a piso', exhibicion: 'fijo', unidad: 'catorcenal', digital: false },
  MOBILIARIO_URBANO: { ancho: 1.2, alto: 1.8, estructura: 'mupi', exhibicion: 'fijo', unidad: 'catorcenal', digital: false },
  PUENTE_PEATONAL: { ancho: 10.0, alto: 2.5, estructura: 'puente peatonal', exhibicion: 'fijo', unidad: 'catorcenal', digital: false },
  MURAL: { ancho: 10.0, alto: 6.0, estructura: 'muro', exhibicion: 'fijo', unidad: 'mensual', digital: false },
  OTRO: { ancho: 6.0, alto: 3.0, estructura: 'otro', exhibicion: 'fijo', unidad: 'catorcenal', digital: false },
}

let _siteSeq = 0

const sitios: Sitio[] = [
  s('sitio-javierprado', 'BP-001', 'Espectacular Javier Prado Este', 'ESPECTACULAR',
    -12.0905, -77.0220, 'Av. Javier Prado Este 1234', 'San Isidro', 'OCUPADO', 18500),
  s('sitio-arequipa', 'BP-002', 'Valla Av. Arequipa', 'VALLA',
    -12.0853, -77.0360, 'Av. Arequipa 2050', 'Lince', 'DISPONIBLE', 8200),
  s('sitio-larco', 'BP-003', 'Pantalla digital José Larco', 'PANTALLA_DIGITAL',
    -12.1230, -77.0300, 'Av. José Larco 345', 'Miraflores', 'OCUPADO', 26000),
  s('sitio-lamarina', 'BP-004', 'Espectacular La Marina', 'ESPECTACULAR',
    -12.0772, -77.0920, 'Av. La Marina 2500', 'San Miguel', 'DISPONIBLE', 16800),
  s('sitio-benavides', 'BP-005', 'Valla Av. Benavides', 'VALLA',
    -12.1330, -77.0150, 'Av. Benavides 1800', 'Santiago de Surco', 'OCUPADO', 9400),
  s('sitio-brasil', 'BP-006', 'Mobiliario urbano Av. Brasil', 'MOBILIARIO_URBANO',
    -12.0950, -77.0640, 'Av. Brasil 1450', 'Magdalena del Mar', 'DISPONIBLE', 5600),
  s('sitio-salaverry', 'BP-007', 'Espectacular Salaverry', 'ESPECTACULAR',
    -12.0870, -77.0480, 'Av. Salaverry 2100', 'Jesús María', 'BLOQUEADO', 15200),
  s('sitio-angamos', 'BP-008', 'Pantalla digital Angamos Este', 'PANTALLA_DIGITAL',
    -12.1110, -77.0080, 'Av. Angamos Este 1650', 'Surquillo', 'OCUPADO', 24500),
  s('sitio-viaexpresa', 'BP-009', 'Puente Vía Expresa', 'PUENTE_PEATONAL',
    -12.1050, -77.0260, 'Paseo de la República km 4', 'Lima', 'DISPONIBLE', 12000),
  s('sitio-primavera', 'BP-010', 'Valla Av. Primavera', 'VALLA',
    -12.1100, -76.9800, 'Av. Primavera 980', 'Santiago de Surco', 'DISPONIBLE', 8800),
  s('sitio-aviacion', 'BP-011', 'Espectacular Aviación', 'ESPECTACULAR',
    -12.1010, -76.9990, 'Av. Aviación 2700', 'San Borja', 'OCUPADO', 17200),
  s('sitio-universitaria', 'BP-012', 'Mobiliario urbano Universitaria', 'MOBILIARIO_URBANO',
    -11.9900, -77.0780, 'Av. Universitaria 5400', 'Los Olivos', 'RESERVADO', 5200),
  s('sitio-panamericana', 'BP-013', 'Espectacular grande Panamericana Sur', 'ESPECTACULAR',
    -12.2200, -76.9300, 'Panamericana Sur km 28 (salida sur)', 'Lima', 'DISPONIBLE', 21000),
  s('sitio-faucett', 'BP-014', 'Pantalla digital Faucett', 'PANTALLA_DIGITAL',
    -12.0350, -77.1080, 'Av. Elmer Faucett 3500 (rumbo aeropuerto)', 'Callao', 'RESERVADO', 23000),
]

function s(
  id: string, claveInterna: string, nombre: string, tipoMedio: Sitio['tipoMedio'],
  lat: number, lng: number, direccion: string, distrito: string,
  estatusComercial: Sitio['estatusComercial'], tarifaMensual: number,
): Sitio {
  _siteSeq += 1
  const p = PERFIL_MEDIO[tipoMedio]
  return {
    id, claveInterna, nombre, tipoMedio, lat, lng, direccion,
    alcaldia: distrito, ciudad: 'Lima', estado: 'Lima', pais: 'PE',
    alto: p.alto,
    ancho: p.ancho,
    iluminado: true,
    orientacion: 'Norte',
    fotos: [],
    estatusComercial,
    estatusLegal: estatusComercial === 'BLOQUEADO' ? 'SUSPENDIDO' : 'EN_ORDEN',
    estatusOperativo: estatusComercial === 'BLOQUEADO' ? 'EN_MANTENIMIENTO' : 'ACTIVO',
    notas: null,
    tarifaMensual,
    // ─── Ficha de inventario ──────────────────────────────────────────────
    codigoProveedor: `056${String(_siteSeq).padStart(2, '0')}-${p.digital ? 'D' : 'E'}0${((_siteSeq % 3) + 1)}`,
    exhibicion: p.exhibicion,
    unidad: p.unidad,
    esRotativo: p.digital,
    plazaCiudad: 'Lima',
    caras: tipoMedio === 'MOBILIARIO_URBANO' ? 2 : 1,
    tipoEstructura: p.estructura,
    vista: _siteSeq % 2 === 0 ? 'N-S' : 'E-O',
    tramo: `tramo ${10 + _siteSeq}`,
    tarifaPublicada: tarifaMensual,
    // costo de compra ~62% de la tarifa → margen ~38% (verde por regla SET)
    costoCompra: Math.round(tarifaMensual * 0.62),
    spotsPorHora: p.digital ? 6 : null,
    duracionSpotSeg: p.digital ? 10 : null,
    horario: p.digital ? '06:00–24:00' : null,
    creadoEn: offsetISO(-400),
  }
}

// ─── Arrendadores + contratos + pagos de renta ──────────────────────────────

const arrendadores: Arrendador[] = [
  a('arr-sanisidro', 'Inmobiliaria San Isidro SAC', '20512345671', 'contacto@inmsanisidro.pe'),
  a('arr-predial', 'Grupo Predial Lima EIRL', '20512345672', 'rentas@predial-lima.pe'),
  a('arr-urbanas', 'Rentas Urbanas del Perú SA', '20512345673', 'cobranza@rentasurbanas.pe'),
]
function a(id: string, nombre: string, rfc: string, email: string): Arrendador {
  return { id, nombre, rfc, telefono: '+51 1 234 5678', email, notas: null, creadoEn: offsetISO(-500) }
}

const contratos: ContratoArrendamiento[] = [
  // 1. Sano (verde) — vigente, renta al corriente
  c('con-sanisidro', 'sitio-javierprado', 'arr-sanisidro', -300, 430, 6500, 'VIGENTE', true),
  // por terminar en 45 días → renovación pendiente
  c('con-sanisidro-2', 'sitio-larco', 'arr-sanisidro', -320, 45, 9000, 'POR_VENCER', false),
  // 2. Pago de renta por vencer en 10 días (ámbar)
  c('con-predial', 'sitio-benavides', 'arr-predial', -200, 530, 4200, 'VIGENTE', true),
  // 3. Renta vencida + incidencia activa → sitio ROJO en Comercial
  c('con-urbanas', 'sitio-salaverry', 'arr-urbanas', -250, 480, 5800, 'VIGENTE', false),
]
function c(
  id: string, sitioId: string, arrendadorId: string,
  inicioOffset: number, finOffset: number, montoRenta: number,
  estatus: ContratoArrendamiento['estatus'], autoRenovable: boolean,
): ContratoArrendamiento {
  return {
    id, sitioId, arrendadorId,
    fechaInicio: offsetISO(inicioOffset), fechaFin: offsetISO(finOffset),
    montoRenta, periodicidad: 'MENSUAL', moneda: 'PEN', autoRenovable,
    documentoUrl: null, estatus, creadoEn: offsetISO(inicioOffset),
  }
}

const pagosRenta: PagoRenta[] = [
  // Contrato sano: últimos pagos PAGADOS, próximo aún lejano
  { id: 'pago-1', contratoId: 'con-sanisidro', periodo: mesEtiqueta(-1), monto: 6500, fechaPago: offsetISO(-28), facturaUrl: null, estatus: 'PAGADO', creadoEn: offsetISO(-30) },
  { id: 'pago-2', contratoId: 'con-sanisidro', periodo: mesEtiqueta(0), monto: 6500, fechaPago: offsetISO(-2), facturaUrl: null, estatus: 'PAGADO', creadoEn: offsetISO(-5) },
  // Predial: pago por vencer en 10 días (ámbar)
  { id: 'pago-3', contratoId: 'con-predial', periodo: mesEtiqueta(0), monto: 4200, fechaPago: null, facturaUrl: null, estatus: 'PENDIENTE', creadoEn: offsetISO(-3) },
  // Urbanas: renta VENCIDA (rojo) — venció hace 12 días
  { id: 'pago-4', contratoId: 'con-urbanas', periodo: mesEtiqueta(-1), monto: 5800, fechaPago: null, facturaUrl: null, estatus: 'VENCIDO', creadoEn: offsetISO(-42) },
]
function mesEtiqueta(offsetMeses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMeses)
  return d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
}

// ─── Incidencia que pone Salaverry en ROJO (Acto 2 — acople Arrendadores) ───

const incidencias: Incidencia[] = [
  {
    id: 'inc-salaverry',
    sitioId: 'sitio-salaverry',
    tipo: 'LEGAL',
    descripcion: 'Renta vencida y suspensión municipal del permiso. Sitio bloqueado para comercialización hasta regularizar pago con Rentas Urbanas del Perú SA.',
    fechaInicio: offsetISO(-9),
    fechaResolucion: null,
    impactaComercial: true,
    estatus: 'ABIERTA',
    fotos: [],
    reportadoPorUserId: 'user-arrendadores',
    notas: 'Reportada desde el módulo de Arrendadores.',
    creadoEn: offsetISO(-9),
  },
]

// ─── Clientes (marcas genéricas) ────────────────────────────────────────────

const clientes: Cliente[] = [
  cli('cli-telco', 'Telco Andina', { nombre: 'María Quispe', email: 'mquispe@telcoandina.pe', telefono: '+51 999 111 222' }),
  cli('cli-banca', 'Banca del Sol', { nombre: 'Jorge Ramírez', email: 'jramirez@bancadelsol.pe', telefono: '+51 999 333 444' }),
  cli('cli-retail', 'Retail Lima', { nombre: 'Lucía Torres', email: 'ltorres@retaillima.pe', telefono: '+51 999 555 666' }),
  cli('cli-bebidas', 'Bebidas Pacífico', { nombre: 'Andrés Soto', email: 'asoto@bebidaspacifico.pe', telefono: '+51 999 777 888' }),
]
function cli(id: string, nombre: string, contacto: Cliente['contacto']): Cliente {
  return { id, nombre, rfc: null, tipo: 'DIRECTO', contacto, activo: true, creadoEn: offsetISO(-365) }
}

// ─── Campañas ───────────────────────────────────────────────────────────────

const campanas: Campana[] = [
  // 1. HILO CONDUCTOR — Telco Andina: confirmada, en imprenta, candado APAGADO
  {
    id: 'camp-telco', folio: 'CAM-2026-0042', nombre: 'Telco Andina — Lanzamiento 5G',
    clienteId: 'cli-telco', agencia: 'Andina Media', marca: 'Telco Andina',
    tipoCampana: 'OOH', fechaInicio: offsetISO(-6), fechaFin: offsetISO(54),
    presupuestoBruto: 204000, presupuestoNeto: 173000, moneda: 'PEN',
    estadoComercial: 'CONFIRMADA',
    ocRecibida: true, fotosComprobatorias: false, reportePublicacion: false,
    ocUrl: 'mock://oc/telco-andina.pdf', reportePublicacionUrl: null,
    portalToken: 'telco-andina-2026', portalActivo: true,
    notas: 'Lanzamiento 5G en 3 ubicaciones premium. En imprenta; montaje pendiente.',
    creadoEn: offsetISO(-12),
  },
  // 2. Banca del Sol — al aire, candado ENCENDIDO, lista para facturar (Acto 5)
  {
    id: 'camp-banca', folio: 'CAM-2026-0039', nombre: 'Banca del Sol — Crédito Hipotecario',
    clienteId: 'cli-banca', agencia: null, marca: 'Banca del Sol',
    tipoCampana: 'OOH', fechaInicio: offsetISO(-25), fechaFin: offsetISO(20),
    presupuestoBruto: 142000, presupuestoNeto: 121000, moneda: 'PEN',
    estadoComercial: 'ACTIVA',
    ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true,
    ocUrl: 'mock://oc/banca-del-sol.pdf', reportePublicacionUrl: 'mock://reporte/banca-del-sol.pdf',
    portalToken: 'banca-del-sol-2026', portalActivo: true,
    notas: 'Campaña al aire, evidencias y reporte completos. Lista para facturar.',
    creadoEn: offsetISO(-32),
  },
  // 3. Retail Lima — reserva tentativa (ámbar), sin confirmar
  {
    id: 'camp-retail', folio: 'CAM-2026-0044', nombre: 'Retail Lima — Cyber Days',
    clienteId: 'cli-retail', agencia: 'Performance Plus', marca: 'Retail Lima',
    tipoCampana: 'OOH', fechaInicio: offsetISO(14), fechaFin: offsetISO(44),
    presupuestoBruto: 56000, presupuestoNeto: 47000, moneda: 'PEN',
    estadoComercial: 'COTIZACION',
    ocRecibida: false, fotosComprobatorias: false, reportePublicacion: false,
    ocUrl: null, reportePublicacionUrl: null,
    portalToken: null, portalActivo: false,
    notas: 'Reserva tentativa a la espera de OC.',
    creadoEn: offsetISO(-4),
  },
  // 4. Bebidas Pacífico — finalizada, facturada, cobranza 90d POR VENCER (ámbar)
  {
    id: 'camp-bebidas', folio: 'CAM-2026-0021', nombre: 'Bebidas Pacífico — Verano',
    clienteId: 'cli-bebidas', agencia: null, marca: 'Bebidas Pacífico',
    tipoCampana: 'OOH', fechaInicio: offsetISO(-120), fechaFin: offsetISO(-78),
    presupuestoBruto: 98000, presupuestoNeto: 83000, moneda: 'PEN',
    estadoComercial: 'COMPLETADA',
    ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true,
    ocUrl: 'mock://oc/bebidas.pdf', reportePublicacionUrl: 'mock://reporte/bebidas.pdf',
    portalToken: 'bebidas-pacifico-2026', portalActivo: false,
    notas: 'Campaña finalizada y facturada.',
    creadoEn: offsetISO(-130),
  },
  // 5. Retail Lima Q1 — finalizada, facturada, cobranza VENCIDA (rojo)
  {
    id: 'camp-retail-q1', folio: 'CAM-2026-0008', nombre: 'Retail Lima — Temporada escolar',
    clienteId: 'cli-retail', agencia: 'Performance Plus', marca: 'Retail Lima',
    tipoCampana: 'OOH', fechaInicio: offsetISO(-160), fechaFin: offsetISO(-110),
    presupuestoBruto: 64000, presupuestoNeto: 54000, moneda: 'PEN',
    estadoComercial: 'COMPLETADA',
    ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true,
    ocUrl: 'mock://oc/retail-q1.pdf', reportePublicacionUrl: 'mock://reporte/retail-q1.pdf',
    portalToken: null, portalActivo: false,
    notas: 'Factura vencida — en gestión de cobranza.',
    creadoEn: offsetISO(-170),
  },
  // 6. Banca del Sol Q1 — finalizada, facturada, cobranza AL CORRIENTE (verde)
  {
    id: 'camp-banca-q1', folio: 'CAM-2026-0015', nombre: 'Banca del Sol — Ahorro Q1',
    clienteId: 'cli-banca', agencia: null, marca: 'Banca del Sol',
    tipoCampana: 'OOH', fechaInicio: offsetISO(-90), fechaFin: offsetISO(-48),
    presupuestoBruto: 110000, presupuestoNeto: 94000, moneda: 'PEN',
    estadoComercial: 'COMPLETADA',
    ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true,
    ocUrl: 'mock://oc/banca-q1.pdf', reportePublicacionUrl: 'mock://reporte/banca-q1.pdf',
    portalToken: null, portalActivo: false,
    notas: 'Factura emitida, dentro de plazo.',
    creadoEn: offsetISO(-100),
  },
]

// ─── Creatividades ──────────────────────────────────────────────────────────

const creatividades: Creatividad[] = [
  { id: 'crea-telco', campanaId: 'camp-telco', nombre: 'Telco Andina 5G — arte final v3', archivoUrl: 'mock://arte/telco-5g.pdf', formato: 'PDF/X-1a', resolucion: '12.9 x 7.2 m', estatusValidacion: 'VALIDADA', rechazadoMotivo: null, creadoEn: offsetISO(-9) },
  { id: 'crea-banca', campanaId: 'camp-banca', nombre: 'Banca del Sol — hipotecario', archivoUrl: 'mock://arte/banca.pdf', formato: 'PDF/X-1a', resolucion: '12.9 x 7.2 m', estatusValidacion: 'VALIDADA', rechazadoMotivo: null, creadoEn: offsetISO(-28) },
]

// ─── Reservas (sitio↔campaña). Telco CONFIRMADA, Retail TENTATIVA ───────────

const reservas: Reserva[] = [
  // Telco Andina — 3 sitios confirmados (Larco, Javier Prado, Angamos)
  r('res-telco-larco', 'camp-telco', 'sitio-larco', -6, 54, 26000, 'CONFIRMADA'),
  r('res-telco-jp', 'camp-telco', 'sitio-javierprado', -6, 54, 18500, 'CONFIRMADA'),
  r('res-telco-angamos', 'camp-telco', 'sitio-angamos', -6, 54, 24500, 'CONFIRMADA'),
  // Banca del Sol — al aire
  r('res-banca-benavides', 'camp-banca', 'sitio-benavides', -25, 20, 9400, 'CONFIRMADA'),
  r('res-banca-aviacion', 'camp-banca', 'sitio-aviacion', -25, 20, 17200, 'CONFIRMADA'),
  // Retail Lima — tentativa (ámbar)
  r('res-retail-univ', 'camp-retail', 'sitio-universitaria', 14, 44, 5200, 'TENTATIVA'),
  r('res-retail-faucett', 'camp-retail', 'sitio-faucett', 14, 44, 23000, 'TENTATIVA'),
]
function r(
  id: string, campanaId: string, sitioId: string,
  inicioOffset: number, finOffset: number, precio: number, estatus: Reserva['estatus'],
): Reserva {
  return {
    id, campanaId, sitioId,
    fechaInicio: offsetISO(inicioOffset), fechaFin: offsetISO(finOffset),
    precio, tipoVenta: 'FIXED_PKG', estatus, creadoEn: offsetISO(inicioOffset - 3),
  }
}

// ─── Órdenes de impresión ───────────────────────────────────────────────────

const ordenesImpresion: OrdenImpresion[] = [
  // Telco — EN PRODUCCION (parte del hilo conductor)
  { id: 'oi-telco', folio: 'IMP-2026-0061', campanaId: 'camp-telco', sitioId: 'sitio-javierprado', material: 'Lona front-lit 13 oz', alto: 7.2, ancho: 12.9, estatus: 'EN_PRODUCCION', proveedor: 'Gigantografías Lima', creadoEn: offsetISO(-5) },
  { id: 'oi-telco-2', folio: 'IMP-2026-0062', campanaId: 'camp-telco', sitioId: 'sitio-larco', material: 'Contenido digital 1080x1920', alto: 0, ancho: 0, estatus: 'VALIDADO', proveedor: 'Estudio Andino', creadoEn: offsetISO(-5) },
  // Retail — arte recién recibido
  { id: 'oi-retail', folio: 'IMP-2026-0064', campanaId: 'camp-retail', sitioId: 'sitio-universitaria', material: 'Vinil mobiliario', alto: 1.8, ancho: 1.2, estatus: 'ARTE_RECIBIDO', proveedor: 'Gigantografías Lima', creadoEn: offsetISO(-1) },
  // Banca — ya impreso y montado
  { id: 'oi-banca', folio: 'IMP-2026-0058', campanaId: 'camp-banca', sitioId: 'sitio-benavides', material: 'Lona front-lit 13 oz', alto: 7.2, ancho: 12.9, estatus: 'LISTO_MONTAJE', proveedor: 'Gigantografías Lima', creadoEn: offsetISO(-22) },
]

// ─── Órdenes de trabajo (cuadrillas) ────────────────────────────────────────

const ordenesTrabajo: OrdenTrabajo[] = [
  // OT del HILO CONDUCTOR — montaje de Telco, PENDIENTE, con OT móvil
  {
    id: 'ot-telco', folio: 'OT-2026-0142', tipo: 'MONTAJE_LONA',
    sitioId: 'sitio-javierprado', descripcion: 'Montaje de lona Telco Andina 5G en espectacular Javier Prado Este',
    instrucciones: 'Verificar tensado, alineación y registro fotográfico de evidencia.',
    checklist: [
      { label: 'Lona recibida de imprenta', hecho: true },
      { label: 'Estructura y herrajes inspeccionados', hecho: false },
      { label: 'Montaje y tensado de lona', hecho: false },
      { label: 'Foto comprobatoria con geolocalización', hecho: false },
    ],
    prioridad: 'ALTA', asignadoAUserId: 'user-cuadrilla-1', supervisorUserId: 'user-operaciones',
    fechaProgramada: offsetISO(1), fechaInicio: null, fechaCompletada: null,
    campanaId: 'camp-telco', estatus: 'ASIGNADA', requiereRevision: true,
    notas: 'Cierre de esta OT con foto enciende el candado de facturación de Telco Andina.',
    creadoEn: offsetISO(-2),
  },
  // Otras tareas variadas
  { id: 'ot-retail-insp', folio: 'OT-2026-0143', tipo: 'INSPECCION', sitioId: 'sitio-universitaria', descripcion: 'Inspección previa de mobiliario para Retail Lima', instrucciones: null, checklist: [{ label: 'Estado físico', hecho: false }, { label: 'Medidas confirmadas', hecho: false }], prioridad: 'NORMAL', asignadoAUserId: 'user-cuadrilla-2', supervisorUserId: 'user-operaciones', fechaProgramada: offsetISO(3), fechaInicio: null, fechaCompletada: null, campanaId: 'camp-retail', estatus: 'PENDIENTE', requiereRevision: false, notas: null, creadoEn: offsetISO(-1) },
  { id: 'ot-salaverry-mant', folio: 'OT-2026-0140', tipo: 'MANTENIMIENTO_CORRECTIVO', sitioId: 'sitio-salaverry', descripcion: 'Atención de incidencia legal/estructural en Salaverry', instrucciones: null, checklist: [{ label: 'Evaluación de daño', hecho: true }, { label: 'Reporte a legal', hecho: true }], prioridad: 'URGENTE', asignadoAUserId: 'user-cuadrilla-1', supervisorUserId: 'user-operaciones', fechaProgramada: offsetISO(-3), fechaInicio: offsetISO(-3), fechaCompletada: null, campanaId: null, estatus: 'EN_PROCESO', requiereRevision: false, notas: 'Ligada a incidencia inc-salaverry.', creadoEn: offsetISO(-8) },
  { id: 'ot-banca-mant', folio: 'OT-2026-0138', tipo: 'MANTENIMIENTO_PREVENTIVO', sitioId: 'sitio-aviacion', descripcion: 'Limpieza y revisión de iluminación — Banca del Sol', instrucciones: null, checklist: [{ label: 'Limpieza', hecho: true }, { label: 'Revisión eléctrica', hecho: true }], prioridad: 'BAJA', asignadoAUserId: 'user-cuadrilla-2', supervisorUserId: 'user-operaciones', fechaProgramada: offsetISO(-10), fechaInicio: offsetISO(-10), fechaCompletada: offsetISO(-10), campanaId: 'camp-banca', estatus: 'COMPLETADA', requiereRevision: false, notas: null, creadoEn: offsetISO(-14) },
  { id: 'ot-banca-montaje', folio: 'OT-2026-0131', tipo: 'MONTAJE_LONA', sitioId: 'sitio-benavides', descripcion: 'Montaje de lona Banca del Sol', instrucciones: null, checklist: [{ label: 'Montaje', hecho: true }, { label: 'Foto comprobatoria', hecho: true }], prioridad: 'NORMAL', asignadoAUserId: 'user-cuadrilla-1', supervisorUserId: 'user-operaciones', fechaProgramada: offsetISO(-24), fechaInicio: offsetISO(-24), fechaCompletada: offsetISO(-24), campanaId: 'camp-banca', estatus: 'COMPLETADA', requiereRevision: false, notas: null, creadoEn: offsetISO(-26) },
]

// ─── Evidencias (Banca ya tiene; Telco aún NO — se sube en el Acto 4) ───────

const evidencias: EvidenciaOT[] = [
  { id: 'ev-banca-1', otId: 'ot-banca-montaje', fotoUrl: 'mock://evidencia/banca-montaje.jpg', formato: 'image/jpeg', lat: -12.1330, lng: -77.0150, precision: 8, tipo: 'INSTALACION', uploadedBy: 'user-cuadrilla-1', tomadaEn: offsetISO(-24), timestamp: offsetISO(-24) },
]

// ─── Finanzas: facturas + cobranza (semáforo de 3 colores) ──────────────────

const facturas: Factura[] = [
  // Bebidas Pacífico — ámbar (por vencer)
  { id: 'fac-bebidas', folio: 'F001-00000231', campanaId: 'camp-bebidas', clienteId: 'cli-bebidas', monto: 98000, moneda: 'PEN', fechaEmision: offsetISO(-75), estatus: 'EMITIDA', creadoEn: offsetISO(-75) },
  // Retail Lima Q1 — rojo (vencida)
  { id: 'fac-retail-q1', folio: 'F001-00000198', campanaId: 'camp-retail-q1', clienteId: 'cli-retail', monto: 64000, moneda: 'PEN', fechaEmision: offsetISO(-100), estatus: 'EMITIDA', creadoEn: offsetISO(-100) },
  // Banca del Sol Q1 — verde (al corriente)
  { id: 'fac-banca-q1', folio: 'F001-00000210', campanaId: 'camp-banca-q1', clienteId: 'cli-banca', monto: 110000, moneda: 'PEN', fechaEmision: offsetISO(-20), estatus: 'EMITIDA', creadoEn: offsetISO(-20) },
]

const cobranzas: Cobranza[] = [
  // Bebidas: plazo 90, emitida hace 75 → vence en ~15 días → POR_VENCER (ámbar)
  { id: 'cob-bebidas', facturaId: 'fac-bebidas', plazoDias: 90, fechaVencimiento: offsetISO(15), estatus: 'POR_VENCER', montoPagado: 0, creadoEn: offsetISO(-75) },
  // Retail Q1: plazo 60, emitida hace 100 → venció hace 40 días → VENCIDA (rojo)
  { id: 'cob-retail-q1', facturaId: 'fac-retail-q1', plazoDias: 60, fechaVencimiento: offsetISO(-40), estatus: 'VENCIDA', montoPagado: 0, creadoEn: offsetISO(-100) },
  // Banca Q1: plazo 90, emitida hace 20 → vence en ~70 días → AL_CORRIENTE (verde)
  { id: 'cob-banca-q1', facturaId: 'fac-banca-q1', plazoDias: 90, fechaVencimiento: offsetISO(70), estatus: 'AL_CORRIENTE', montoPagado: 0, creadoEn: offsetISO(-20) },
]

// ─── Bitácora inicial (acciones históricas sembradas) ──────────────────────

const acciones: AccionLog[] = [
  { id: 'acc-seed-1', accion: 'Confirmó reserva', entidad: 'Banca del Sol — Crédito Hipotecario', usuarioId: 'u-comercial', usuarioNombre: 'Carlos Mendoza', timestamp: offsetISO(-25) },
  { id: 'acc-seed-2', accion: 'Generó factura', entidad: 'F001-00000210 · Banca del Sol — Ahorro Q1', usuarioId: 'u-finanzas', usuarioNombre: 'Andrea Salas', timestamp: offsetISO(-20) },
  { id: 'acc-seed-3', accion: 'Cerró OT con foto', entidad: 'OT-2026-0131', usuarioId: 'u-operaciones', usuarioNombre: 'Luis Paredes', timestamp: offsetISO(-24) },
  { id: 'acc-seed-4', accion: 'Reportó incidencia', entidad: 'Espectacular Salaverry', usuarioId: 'u-dueno', usuarioNombre: 'María Quispe', timestamp: offsetISO(-9) },
]

// ─── Estado inicial completo ────────────────────────────────────────────────

export function buildSeed(): DemoState {
  return {
    usuarios: clone(USUARIOS_DEMO),
    configNegocio: {
      nombreTenant: 'Billboards Perú SA',
      moneda: 'PEN',
      plazosCobranza: [60, 90, 120],
      tiposTarea: ['Montaje de lona', 'Pegado de lona', 'Mantenimiento', 'Desmontaje', 'Inspección'],
    },
    sitios: clone(sitios),
    arrendadores: clone(arrendadores),
    contratos: clone(contratos),
    pagosRenta: clone(pagosRenta),
    incidencias: clone(incidencias),
    clientes: clone(clientes),
    campanas: clone(campanas),
    creatividades: clone(creatividades),
    reservas: clone(reservas),
    ordenesTrabajo: clone(ordenesTrabajo),
    evidencias: clone(evidencias),
    ordenesImpresion: clone(ordenesImpresion),
    facturas: clone(facturas),
    cobranzas: clone(cobranzas),
    acciones: clone(acciones),
  }
}

// Copia profunda para que "Reiniciar demo" siempre parta de datos prístinos.
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
