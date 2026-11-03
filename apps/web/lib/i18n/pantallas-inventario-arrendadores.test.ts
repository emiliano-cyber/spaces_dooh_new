import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import { huellasDeFormatoEspanol } from './guardias-ingles'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE «INVENTARIO Y ARRENDADORES», RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El patron de `pantallas-comercial.test.ts`: se monta el componente REAL
//  dentro del proveedor, se rinde con `renderToStaticMarkup` y se mira el texto
//  en dos sentidos —(a) en ESPANOL sale lo de siempre; (b) en INGLES no queda
//  ninguna frase espanola del lote— y al final se barren los diccionarios del
//  lote enteros contra el HTML ingles de todas las pantallas.
//
//  Pantallas: Inventario (`/inventario`: la tabla, los indicadores, los chips,
//  el cambio masivo, el asistente de contrato + pantalla, el alta manual y la
//  carga masiva), Arrendadores (`/arrendadores` con la ficha del contrato y sus
//  cuadros, los cambios al contrato, licencias, cuadre, pagos de renta y
//  razones sociales), el documento del contrato (`/contrato/[id]`: solo lo que
//  lo RODEA), la firma publica (`/firmar/[token]`) y `/razones-sociales`.
//
//  ─── POR QUE SE FUERZA `useState`, Y COMO ──────────────────────────────────
//  `renderToStaticMarkup` no ejecuta efectos ni clics. Para pintar lo que sale
//  tras un clic (un cuadro abierto, un paso del asistente) se arranca el estado
//  en el valor que tendria. A diferencia de los otros lotes, cada valor forzado
//  dice DE QUE COMPONENTE es la llamada (el nombre de la funcion que llama a
//  `useState`, leido de la pila): aqui hay muchos `useState(false)` seguidos y
//  el orden de render no basta para acertarle a uno.
//
//  ─── EL ESPANOL IDENTICO ───────────────────────────────────────────────────
//  Con `I18N_VOLCAR=<carpeta>` se escribe el HTML ESPANOL de cada estado. Se
//  volco con los componentes de antes del lote y con los de despues, y se
//  compararon con `diff -rq` (ver `docs/i18n/revision-inventario.md` y `revision-arrendadores.md`).
//
//  ─── LO QUE NO SE TRADUCE, A PROPOSITO ─────────────────────────────────────
//  El documento del contrato (`lib/contrato-documento.ts`), su cantidad con
//  letra, lo que entra en el hash de las firmas y lo que forma parte del texto
//  impreso (encabezados, bloque de firmas con sus sellos, aviso de borrador):
//  es un documento legal en espanol. Lo que lo rodea si se traduce: la barra,
//  el panel de firmas, la firma publica y —decision del dueño, 2026-11-02— la
//  constancia de firma electronica, que no entra en ningun hash.
// ============================================================================

const forzado = vi.hoisted(() => ({
  cola: [] as Array<{ quien: string; n: number; valor: unknown }>,
  // Cuantas llamadas a `useState` lleva cada funcion en ESTE render.
  cuenta: new Map<string, number>(),
}))

// El nombre de la funcion que llamo a `useState`: la segunda linea util de la
// pila (la primera es este envoltorio).
function quienLlama(): string {
  const lineas = (new Error().stack ?? '').split('\n').slice(1)
  for (const l of lineas) {
    const m = l.match(/at (?:Object\.)?([\w$.]+) /)
    if (!m) continue
    const nombre = m[1].split('.').pop() ?? ''
    if (nombre === 'useState' || nombre === 'quienLlama') continue
    return nombre
  }
  return ''
}

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    if (forzado.cola.length) {
      const quien = quienLlama()
      const n = forzado.cuenta.get(quien) ?? 0
      forzado.cuenta.set(quien, n + 1)
      const i = forzado.cola.findIndex((f) => f.quien === quien && f.n === n)
      if (i >= 0) {
        const [f] = forzado.cola.splice(i, 1)
        return real.useState(f.valor)
      }
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/arrendadores',
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

// Los cuadros reales van por portales de Radix, que en el servidor no pintan
// nada: se sustituyen por su contenido en linea. Lo que se mide es el TEXTO.
// Una fabrica de componentes de prueba: sin nombre propio a proposito. Sin esta
// linea, `next build` para en el lint (react/display-name) aunque sea un .test.ts.
// eslint-disable-next-line react/display-name
const caja = (tag: string) => (p: { open?: boolean; title: string; subtitle?: string; children?: unknown; footer?: unknown }) =>
  p.open === false
    ? null
    : createElement(tag, null, createElement('h2', null, p.title), p.subtitle ? createElement('p', null, p.subtitle) : null, p.children as never, p.footer as never)
vi.mock('@/components/demo/ui/Modal', () => ({ Modal: caja('div') }))
vi.mock('@/components/demo/ui/Sheet', () => ({ Sheet: caja('aside') }))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.subtitulo as never, p.resumen as never, p.accion as never, p.children as never),
}))
// Las pestanas de Radix solo pintan la activa: aqui se pintan todas.
vi.mock('@/components/demo/ui/Tabs', () => ({
  Tabs: (p: { tabs: { value: string; label: string }[]; children?: unknown }) =>
    createElement('div', null, ...p.tabs.map((t) => createElement('button', { key: t.value }, t.label)), p.children as never),
  TabPanel: (p: { children?: unknown }) => createElement('div', null, p.children as never),
}))
// La ficha del sitio es del lote de Comercial y aqui va cerrada.
vi.mock('@/components/demo/comercial/SiteFicha', () => ({ SiteFicha: () => null }))
// `/razones-sociales` monta la gestion de las entidades del owner, que no es de
// este lote: se sustituye para medir solo la pagina.
vi.mock('@/components/demo/razones-sociales/GestionEntidadesFiscales', () => ({
  GestionEntidadesFiscales: () => createElement('div', null, '[entidades]'),
}))

const sesion = vi.hoisted(() => ({ rol: 'DUENO' as string, puede: true }))
vi.mock('@/components/demo/shell/SesionContext', () => ({
  usePuede: () => sesion.puede,
  useSesionCtx: () => ({ sesion: { usuario: { rol: sesion.rol } } }),
}))

// La cercania de un predio la calcula un modulo puro con sus propias pruebas:
// aqui solo hace falta que diga que una pantalla queda lejos.
vi.mock('@/lib/predio-cercania', () => ({
  pantallasFueraDelGrupo: (xs: { clave: string }[]) => (xs.length > 1 ? [{ clave: xs[1].clave, motivo: 'a 900 m' }] : []),
}))

// ─── Servidor (las dos paginas que son Server Components) ───────────────────
const servidor = vi.hoisted(() => ({ idioma: 'es' as 'es' | 'en' | 'it', permiso: true, firma: null as unknown }))
vi.mock('@/lib/i18n/servidor', () => ({ idiomaDeLaPeticion: () => servidor.idioma }))
vi.mock('@/lib/server/auth', () => ({
  exigir: async () => (servidor.permiso ? { ok: true, usuario: { rol: 'DUENO' } } : { ok: false }),
  tienePermiso: async () => true,
}))
vi.mock('@/lib/server/config-repo', () => ({ obtenerConfig: async () => ({ logoUrl: null }) }))
vi.mock('@/lib/server/contrato-expediente', () => ({
  datosContrato: async () => REVISION.datos,
  expedienteContrato: async () => ({
    titulo: 'CONTRATO DE ARRENDAMIENTO',
    preambulo: 'Contrato que celebran las partes.',
    declaraciones: [{ encabezado: 'I. Declara EL ARRENDADOR', incisos: ['a) Ser mayor de edad.'] }],
    clausulas: [{ ordinal: 'PRIMERA', titulo: 'Objeto', parrafos: ['EL ARRENDADOR da en arrendamiento EL ESPACIO.'] }],
    lugarYFecha: 'Ciudad de México, a 2 de noviembre de 2026.',
    firmas: [{ rol: 'EL ARRENDADOR', nombre: 'Don Pepe' }, { rol: 'EL ARRENDATARIO', nombre: 'Medios SA' }],
    faltantes: [{ etiqueta: 'RFC del arrendador', donde: 'Arrendadores › ficha del arrendador' }],
  }),
}))
vi.mock('@/lib/server/firmas-repo', () => ({
  firmasDeContrato: async () => ESTADO_FIRMAS_FIRMADO,
  huellaDatosContrato: () => 'huella-1',
  firmaPorToken: async () => servidor.firma,
}))

// ─── Datos de prueba ────────────────────────────────────────────────────────
const AHORA = new Date('2026-11-02T18:00:00.000Z')

const SITIO_BASE = {
  claveInterna: 'K', lat: 19.4, lng: -99.1, direccion: 'Reforma 222', estado: 'CDMX', pais: 'MX', alto: 3, ancho: 6,
  iluminado: true, orientacion: null, fotos: [], estatusLegal: 'EN_ORDEN', estatusOperativo: 'ACTIVO', pausaLegal: false,
  motivoPausaLegal: null, pausaLegalEn: null, notas: null, unidad: 'mensual', plazaCiudad: 'CDMX', caras: 1,
  tipoEstructura: 'unipolar', vista: 'Norte', tramo: 'Centro', costoCompra: 0, spotsPorHora: null, duracionSpotSeg: null,
  horario: null, direccionPredio: 'Reforma 222 int', direccionComercial: 'Reforma 222', resolucionPx: null,
  tipoContenido: null, comercializacion: 'TRADICIONAL', enNetwork: false, cms: null, modalidades: ['Mensual'],
}
const SITIOS = [
  { ...SITIO_BASE, id: 's1', nombre: 'Torre Reforma', codigoProveedor: 'PR-001', tipoMedio: 'PANTALLA_DIGITAL', esRotativo: true,
    exhibicion: 'digital', alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', estatusComercial: 'DISPONIBLE', tarifaMensual: 30000,
    tarifaPublicada: 30000, totalSpots: 8, spotsDisponibles: 6, predioId: 'pr1', arrendadorId: 'ar1', propio: false,
    doohmainEfectiva: 'scr_9', doohmainOrigen: 'mapa', computerVision: true,
    modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 100, costoCompra: 0 }] },
  { ...SITIO_BASE, id: 's2', nombre: 'Muro Insurgentes', codigoProveedor: 'PR-002', tipoMedio: 'ESPECTACULAR', esRotativo: false,
    exhibicion: 'fijo', alcaldia: 'Benito Juárez', ciudad: 'CDMX', estatusComercial: 'OCUPADO', tarifaMensual: 50000,
    tarifaPublicada: 50000, totalSpots: null, spotsDisponibles: null, predioId: null, arrendadorId: null, propio: false },
  { ...SITIO_BASE, id: 's3', nombre: 'Azotea Propia', codigoProveedor: 'PR-003', tipoMedio: 'MURAL', esRotativo: false,
    exhibicion: 'fijo', alcaldia: null, ciudad: 'CDMX', estatusComercial: 'EN_MANTENIMIENTO', tarifaMensual: 20000,
    tarifaPublicada: 20000, totalSpots: null, spotsDisponibles: null, predioId: null, arrendadorId: null, propio: true,
    pendienteVerificacion: true },
  { ...SITIO_BASE, id: 's4', nombre: 'Valla Sur', codigoProveedor: 'PR-004', tipoMedio: 'VALLA', esRotativo: false,
    exhibicion: 'fijo', alcaldia: 'Coyoacán', ciudad: 'CDMX', estatusComercial: 'DISPONIBLE', tarifaMensual: 9000,
    tarifaPublicada: 9000, totalSpots: null, spotsDisponibles: null, predioId: 'pr1', arrendadorId: null, propio: false },
  // Sin contrato, sin arrendador y sin predio: el pendiente de «Sin contrato».
  { ...SITIO_BASE, id: 's5', nombre: 'Mupi Centro', codigoProveedor: 'PR-005', tipoMedio: 'MOBILIARIO_URBANO', esRotativo: false,
    exhibicion: 'fijo', alcaldia: 'Centro', ciudad: 'CDMX', estatusComercial: 'BLOQUEADO', tarifaMensual: 3000,
    tarifaPublicada: 3000, totalSpots: null, spotsDisponibles: null, predioId: null, arrendadorId: null, propio: false },
]
const CONTRATO_BASE = { moneda: 'MXN', autoRenovable: false, documentoUrl: null, creadoEn: '2026-01-01', deposito: null }
const CONTRATOS = [
  { ...CONTRATO_BASE, id: 'c1', sitioId: 's1', predioId: 'pr1', arrendadorId: 'ar1', fechaInicio: '2026-01-01', fechaFin: '2026-12-01',
    montoRenta: 10000, periodicidad: 'MENSUAL', montoMensualEquivalente: 10000, estatus: 'POR_VENCER', razonSocialId: 'rs1',
    entidadId: null, sitioNombre: 'Torre Reforma', autoRenovable: true, documentoUrl: 'data:application/pdf;base64,AA' },
  { ...CONTRATO_BASE, id: 'c2', sitioId: 's2', predioId: null, arrendadorId: null, fechaInicio: '2026-03-01', fechaFin: null,
    montoRenta: null, periodicidad: null, estatus: 'INCOMPLETO', sitioNombre: 'Muro Insurgentes' },
  { ...CONTRATO_BASE, id: 'c3', sitioId: 's4', predioId: null, arrendadorId: 'ar2', fechaInicio: '2024-01-01', fechaFin: '2025-01-01',
    montoRenta: 60000, periodicidad: 'ANUAL', montoMensualEquivalente: 5000, estatus: 'VENCIDO', sitioNombre: 'Valla Sur' },
]
const ARRENDADORES = [
  { id: 'ar1', nombre: 'Don Pepe', rfc: 'PEPE800101AB1', telefono: '555 0101', email: 'pepe@ejemplo.mx', direccion: 'Calle 1', notas: null, creadoEn: '2026-01-01' },
  { id: 'ar2', nombre: 'Doña Rosa', rfc: null, telefono: null, email: null, direccion: null, notas: null, creadoEn: '2026-01-01' },
]
const PREDIOS = [{ id: 'pr1', arrendadorId: 'ar1', nombre: 'Predio Reforma', direccion: 'Reforma 222', lat: null, lng: null }]
const PAGOS = [
  { id: 'pg1', contratoId: 'c1', periodo: '2026-10-01', monto: 10000, fechaPago: '2026-10-02', tieneFactura: true,
    tieneComprobante: true, metodoPago: 'TRANSFERENCIA', observaciones: null, estatus: 'PAGADO', sitioNombre: 'Torre Reforma', creadoEn: '2026-01-01' },
  { id: 'pg2', contratoId: 'c1', periodo: '2026-10-25', monto: 10000, fechaPago: null, tieneFactura: false,
    tieneComprobante: false, estatus: 'VENCIDO', sitioNombre: 'Torre Reforma', creadoEn: '2026-01-01' },
  { id: 'pg3', contratoId: 'c1', periodo: '2026-11-04', monto: 10000, fechaPago: null, tieneFactura: false,
    tieneComprobante: false, estatus: 'PENDIENTE', sitioNombre: 'Torre Reforma', creadoEn: '2026-01-01' },
  { id: 'pg4', contratoId: 'c1', periodo: '2027-01-01', monto: 10000, fechaPago: null, tieneFactura: false,
    tieneComprobante: false, estatus: 'PENDIENTE', sitioNombre: 'Torre Reforma', creadoEn: '2026-01-01' },
]
const MARGENES = [
  { sitioId: 's1', nombre: 'Torre Reforma', clave: 'K', rentaMensual: 10000, ingresoMensual: 25000, margenMensual: 15000, tieneContrato: true, arrendador: 'Don Pepe', activo: true },
  { sitioId: 's2', nombre: 'Muro Insurgentes', clave: 'K', rentaMensual: 0, ingresoMensual: 4000, margenMensual: 4000, tieneContrato: false, arrendador: null, activo: true },
]
const RAZONES = [{ id: 'rs1', arrendadorId: 'ar1', razonSocial: 'Inmuebles Pepe SA', rfc: 'IPE800101AB1', regimen: null, creadoEn: '2026-01-01' }]
const ENTIDADES = [
  { id: 'e1', razonSocial: 'Medios SA', rfc: 'MED800101AB1', regimen: '601', cpFiscal: '06000', serieFolios: 'A', roles: ['ARRENDAMIENTOS'], activo: true },
  { id: 'e2', razonSocial: 'Vieja SA', rfc: null, regimen: null, cpFiscal: null, serieFolios: null, roles: [], activo: false },
]
const LICENCIAS = [
  { id: 'l1', predioId: 'pr1', sitioId: null, tipo: 'MUNICIPAL', folio: 'LM-9', autoridad: 'Alcaldía', fechaExpedicion: '2025-01-01', fechaVencimiento: '2026-11-20', documentoUrl: null, notas: null, creadoEn: '2026-01-01' },
  { id: 'l2', predioId: 'pr1', sitioId: null, tipo: 'AMBIENTAL', folio: null, autoridad: null, fechaExpedicion: null, fechaVencimiento: '2026-10-01', documentoUrl: null, notas: null, creadoEn: '2026-01-01' },
  { id: 'l3', predioId: 'pr1', sitioId: null, tipo: 'ESTRUCTURAL', folio: null, autoridad: null, fechaExpedicion: null, fechaVencimiento: '2027-06-01', documentoUrl: null, notas: null, creadoEn: '2026-01-01' },
]
const CAMPANAS = [{ id: 'k1', nombre: 'Navidad', clienteId: 'c1' }]
const RESERVAS = [{ sitioId: 's2', campanaId: 'k1', estatus: 'CONFIRMADA' }]

const datos = vi.hoisted(() => ({
  sitios: [] as unknown[] | undefined,
  contratos: [] as unknown[] | undefined,
  arrendadores: [] as unknown[] | undefined,
  pagos: [] as unknown[] | undefined,
  licencias: [] as unknown[],
}))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    useSitios: () => datos.sitios,
    useContratos: () => datos.contratos,
    useArrendadores: () => datos.arrendadores,
    usePredios: () => PREDIOS,
    usePagosRenta: () => datos.pagos,
    useMargenPorSitio: () => MARGENES,
    useRazonesSociales: () => RAZONES,
    useEntidadesFiscales: () => ENTIDADES,
    useReservas: () => RESERVAS,
    useCampanas: () => CAMPANAS,
    useLicencias: () => datos.licencias,
  }
})

const REVISION = {
  huella: 'huella-1',
  datos: {
    arrendatario: { razonSocial: 'Medios SA', rfc: 'MED800101AB1', domicilioFiscal: null, representanteLegal: 'Ana' },
    arrendador: { nombre: 'Don Pepe', razonSocial: 'Inmuebles Pepe SA', rfc: 'IPE800101AB1', direccion: 'Calle 1' },
    espacio: { nombre: 'Torre Reforma', direccion: 'Reforma 222' },
    terminos: { montoRenta: 10000, periodicidad: 'MENSUAL', fechaInicio: '2026-01-01', fechaFin: '2026-12-01', deposito: null, moneda: 'MXN' },
  },
}
const FIRMA_BASE = { nombreEsperado: null, nombreFirmante: null, firmadoEn: null, ip: null, userAgent: null, documentoHash: null, invalidada: false, token: null, tokenExpiraEn: null }
const ESTADO_FIRMAS_SIN_ENVIAR = {
  firmas: [], hashActual: 'abc', hashCongelado: null, congeladoEn: null,
}
const ESTADO_FIRMAS_FIRMADO = {
  firmas: [
    { ...FIRMA_BASE, parte: 'ARRENDATARIO', estatus: 'FIRMADA', nombreFirmante: 'Ana López', firmadoEn: '2026-10-20T15:00:00Z',
      ip: '10.0.0.1', userAgent: 'Mozilla/5.0', documentoHash: 'h-viejo', invalidada: true },
    { ...FIRMA_BASE, parte: 'ARRENDADOR', estatus: 'PENDIENTE', nombreEsperado: 'Don Pepe', token: 'tok-1', tokenExpiraEn: '2026-11-30T15:00:00Z' },
  ],
  hashActual: 'h-nuevo', hashCongelado: 'h-viejo', congeladoEn: '2026-10-19T15:00:00Z',
}
const ESTADO_FIRMAS_PENDIENTE = {
  firmas: [
    { ...FIRMA_BASE, parte: 'ARRENDATARIO', estatus: 'PENDIENTE' },
    { ...FIRMA_BASE, parte: 'ARRENDADOR', estatus: 'FIRMADA', nombreFirmante: 'Don Pepe', firmadoEn: '2026-10-20T15:00:00Z', documentoHash: 'h1' },
  ],
  hashActual: 'h1', hashCongelado: 'h1', congeladoEn: '2026-10-19T15:00:00Z',
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  sesion.rol = 'DUENO'
  sesion.puede = true
  servidor.permiso = true
  servidor.firma = null
  datos.sitios = SITIOS
  datos.contratos = CONTRATOS
  datos.arrendadores = ARRENDADORES
  datos.pagos = PAGOS
  datos.licencias = LICENCIAS
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

function pintar(idioma: Idioma, el: ReactElement): string {
  forzado.cuenta = new Map()
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}
function texto(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

// `n` es el ordinal (desde 0) de la llamada a `useState` dentro de `quien`, en
// el orden en que estan escritas. Los hooks propios (`useObligatorios`,
// `useCandado`) cuentan aparte, con su nombre.
const forzar = (quien: string, n: number, valor: unknown) => forzado.cola.push({ quien, n, valor })

const inventarioPagina = async () => (await import('../../app/(app)/(shell)/inventario/page')).default
const tabla = async () => (await import('../../components/demo/inventario/InventarioTabla')).InventarioTabla
const wizard = async () => (await import('../../components/demo/inventario/ContratoWizard')).ContratoWizard
const alta = async () => (await import('../../components/demo/inventario/NuevaPantallaForm')).NuevaPantallaForm
const importar = async () => (await import('../../components/demo/inventario/ImportarInventarioDialog')).ImportarInventarioDialog
const arrendadoresPagina = async () => (await import('../../app/(app)/(shell)/arrendadores/page')).default
const hoja = async () => (await import('../../components/demo/arrendadores/ContratoSheet')).ContratoSheet
const cambios = async () => (await import('../../components/demo/arrendadores/CambiosContrato')).CambiosContrato
const panel = async () => (await import('../../components/demo/arrendadores/PanelFirmas')).PanelFirmas
const publica = async () => (await import('../../components/demo/arrendadores/FirmaPublica')).FirmaPublica

type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  espanol: string[]
  ingles: string[]
}

const FILA_OK = { codigo_proveedor: 'PR-001', status: 'ok', mensaje: '', datos: { nombre: 'Torre Reforma', latitud: 19.4, longitud: -99.1, direccion: 'Reforma 222', pendienteVerificacion: false, exhibicion: 'fijo' } }
const FILA_LEJOS = { codigo_proveedor: 'NV-1', status: 'advertencia', mensaje: '', datos: { nombre: 'Lejana', latitud: 19.5, longitud: -99.2, direccion: 'Otra 1', pendienteVerificacion: false, exhibicion: 'fijo' } }
const FILA_ERROR = { codigo_proveedor: 'NV-2', status: 'error', mensaje: 'falta tarifa', datos: null }
const RESUMEN = {
  total_filas: 3, creadas: 1, actualizadas: 1, con_advertencias: 1, errores: 1,
  detalle: [
    { codigo_proveedor: 'PR-001', status: 'actualizado', mensaje: 'tarifa cambiada' },
    { codigo_proveedor: 'NV-1', status: 'creado', mensaje: 'ok' },
    { codigo_proveedor: 'NV-2', status: 'error', mensaje: 'falta tarifa' },
  ],
}

const PANTALLAS: Pantalla[] = [
  // ─── INVENTARIO ────────────────────────────────────────────────────────────
  {
    nombre: 'inventario · la lista con indicadores y chips',
    pintar: async (idioma) => pintar(idioma, createElement(await inventarioPagina())),
    espanol: [
      'Inventario', 'Consulta el inventario completo, o agrega pantallas por carga masiva o alta manual.',
      'Contrato + pantalla', 'Carga masiva', 'Alta manual', 'Indicadores', 'Pantallas', '1 digitales · 4 fijas',
      'Disponibles', ' · 1 con slots vendidos', 'Sin contrato', 'captúralo en Arrendadores', 'Propias',
      'sin renta: su costo es luz y operación', 'Disponibilidad', 'Con slots vendidos', 'Fuera de venta o sin dato',
      'Medio', 'Con contrato', 'Buscar pantalla, código, distrito…', 'Descargar en Excel, con el mismo formato que la plantilla de carga',
      'Seleccionar todo', 'Tipo', 'Ubicación', 'Tarifa', 'Arrendador', 'Renta', '6 de 8 libres', 'Ocupado',
      'Pantalla propia: sin renta ni contrato; su costo es luz y operación', 'Sin arrendador', 'Editar tarifa',
      'Asignar arrendador', 'Renta del contrato del predio — la comparten 2 pantallas', 'Editar la renta que se le paga al arrendador',
      ' · servidor', 'Id en DOOHmain: scr_9 (lo pone el servidor; no está escrito en la ficha)', 'Mensual', 'Pantalla digital', 'Espectacular', 'Digital', 'Fija',
    ],
    ingles: [
      'Browse the full inventory, or add screens by bulk upload or manual entry.', 'Contract + screen', 'Bulk upload',
      'Manual entry', 'Indicators', '1 digital · 4 static', 'Available', 'No contract', 'add it in Landlords', 'Owned',
      'With slots sold', 'Search screen, code, district…', 'Select all', 'Location', 'Rate', 'Landlord', 'Rent',
      '6 of 8 free', 'No landlord', 'Edit rate', 'Assign landlord', 'DOOHmain ID: scr_9', 'Monthly', 'Digital screen',
      'Billboard', 'Static',
    ],
  },
  {
    nombre: 'inventario · sin permiso',
    pintar: async (idioma) => {
      sesion.rol = 'VENDEDOR'
      return pintar(idioma, createElement(await inventarioPagina()))
    },
    espanol: ['Esta sección es exclusiva del Dueño y del administrador.'],
    ingles: ['This section is only for the Owner and the administrator.'],
  },
  {
    nombre: 'inventario · el alta con contrato (vía elegida)',
    pintar: async (idioma) => {
      forzar('AgregarInventarioPage', 0, 'contrato')
      return pintar(idioma, createElement(await inventarioPagina()))
    },
    espanol: ['Alta de una pantalla junto con su contrato de arrendamiento.', 'Arrendador y predio'],
    ingles: ['Add a screen together with its lease agreement.', 'Landlord and property'],
  },
  {
    nombre: 'inventario · la carga masiva (vía elegida)',
    pintar: async (idioma) => {
      forzar('AgregarInventarioPage', 0, 'masiva')
      return pintar(idioma, createElement(await inventarioPagina()))
    },
    espanol: ['Carga masiva de pantallas desde la plantilla de Excel.', 'Carga masiva de inventario'],
    ingles: ['Bulk upload of screens from the Excel template.', 'Bulk inventory upload'],
  },
  {
    nombre: 'inventario · el alta manual (vía elegida)',
    pintar: async (idioma) => {
      forzar('AgregarInventarioPage', 0, 'manual')
      return pintar(idioma, createElement(await inventarioPagina()))
    },
    espanol: ['Alta manual de una pantalla.', 'Alta manual de una sola pantalla'],
    ingles: ['Manual entry of one screen.', 'Manual entry of a single screen'],
  },
  {
    nombre: 'inventario · selección y cambio masivo de tarifa',
    pintar: async (idioma) => {
      forzar('InventarioTabla', 5, new Set(['s1', 's2']))
      return pintar(idioma, createElement(await tabla()))
    },
    espanol: ['2 seleccionadas', 'Fijar tarifa', 'Ajustar %', 'Nueva tarifa', 'Aplicar', 'Limpiar'],
    ingles: ['2 selected', 'Set rate', 'Adjust (%)', 'New rate', 'Apply', 'Clear'],
  },
  {
    nombre: 'inventario · cambio masivo de renta por porcentaje',
    pintar: async (idioma) => {
      forzar('InventarioTabla', 5, new Set(['s1']))
      forzar('InventarioTabla', 6, 'ajustar')
      forzar('InventarioTabla', 7, 'renta')
      return pintar(idioma, createElement(await tabla()))
    },
    espanol: ['1 seleccionada', 'Fijar renta', 'p. ej. 10 o -5'],
    ingles: ['1 selected', 'Set rent', 'e.g. 10 or -5'],
  },
  {
    nombre: 'inventario · búsqueda sin resultados con filtros',
    pintar: async (idioma) => {
      forzar('InventarioTabla', 0, 'zzz')
      forzar('InventarioTabla', 1, { disp: 'verde', medio: null, contrato: null })
      return pintar(idioma, createElement(await tabla()))
    },
    espanol: ['Ningún sitio coincide con «zzz» y los filtros elegidos.', 'Quitar filtros'],
    ingles: ['No sites match “zzz” and the chosen filters.', 'Clear filters'],
  },
  {
    nombre: 'inventario · solo filtros sin resultados',
    pintar: async (idioma) => {
      forzar('InventarioTabla', 1, { disp: 'rojo', medio: 'digital', contrato: null })
      return pintar(idioma, createElement(await tabla()))
    },
    espanol: ['Ninguna pantalla coincide con los filtros elegidos.'],
    ingles: ['No screens match the chosen filters.'],
  },
  {
    nombre: 'inventario · vacío',
    pintar: async (idioma) => {
      datos.sitios = []
      return pintar(idioma, createElement(await tabla()))
    },
    espanol: ['Todavía no hay pantallas en el inventario. Agrégalas una a una o por carga masiva.', 'todas tienen contrato o son propias'],
    ingles: ['There are no screens in the inventory yet. Add them one by one or by bulk upload.', 'all have a contract or are owned'],
  },
  {
    nombre: 'inventario · sin permiso de edición',
    pintar: async (idioma) => {
      sesion.puede = false
      return pintar(idioma, createElement(await tabla()))
    },
    espanol: ['Sin arrendador', 'Don Pepe'],
    ingles: ['No landlord'],
  },
  {
    nombre: 'contrato + pantalla · paso 1, arrendador existente',
    pintar: async (idioma) => pintar(idioma, createElement(await wizard())),
    espanol: [
      '1. Arrendador y predio', '2. Contrato', '3. Pantalla',
      '¿A quién le rentas este espacio? Elige el arrendador ya registrado o da de alta uno nuevo.',
      'Existente', 'Nuevo', '— Selecciona —', 'Nombre del predio', 'Dirección del predio',
      'Se toma la de la pantalla si lo dejas vacío', 'Ej. Azotea Reforma 222', 'Atrás', 'Siguiente',
    ],
    ingles: ['1. Landlord and property', 'Who are you renting this space from?', 'Existing', 'New', '— Select —', 'Property name', 'Back', 'Next'],
  },
  {
    nombre: 'contrato + pantalla · paso 1, arrendador nuevo y sin arrendadores',
    pintar: async (idioma) => {
      forzar('ContratoWizard', 3, 'nuevo') // modoArr
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: ['Nombre / razón social', 'Ej. Inmuebles del Centro SA', 'Teléfono', 'Correo'],
    ingles: ['Name / legal name', 'Phone', 'Email'],
  },
  {
    nombre: 'contrato + pantalla · paso 1, sin arrendadores dados de alta',
    pintar: async (idioma) => {
      datos.arrendadores = []
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: ['No hay arrendadores aún. Cambia a “Nuevo” para dar de alta uno.'],
    ingles: ['No landlords yet. Switch to “New” to add one.'],
  },
  {
    nombre: 'contrato + pantalla · paso 1, predio con contrato vigente',
    pintar: async (idioma) => {
      forzar('ContratoWizard', 4, 'ar1') // arrId
      forzar('ContratoWizard', 9, 'existente') // modoPredio
      forzar('ContratoWizard', 10, 'pr1') // predioId
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: [
      'Predio existente', 'Predio nuevo', 'Este predio ya tiene un contrato vigente de',
      'No se firma otro: la pantalla se agrega al', 'Mensual',
    ],
    ingles: ['Existing property', 'New property', 'This property already has an active contract of', 'Monthly'],
  },
  {
    nombre: 'contrato + pantalla · paso 2 con historial del espacio',
    pintar: async (idioma) => {
      datos.contratos = [{ ...CONTRATOS[0], predioId: 'pr1', estatus: 'VENCIDO', fechaFin: '2026-06-30' }]
      forzar('ContratoWizard', 0, 2) // paso
      forzar('ContratoWizard', 4, 'ar1') // arrId
      forzar('ContratoWizard', 9, 'existente') // modoPredio
      forzar('ContratoWizard', 10, 'pr1') // predioId
      forzar('ContratoWizard', 13, '2026-06-15') // fechaInicio
      forzar('ContratoWizard', 14, '2026-06-01') // fechaFin
      forzar('ContratoWizard', 15, 'NaN') // renta
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: [
      'Condiciones del arrendamiento.', 'Puedes usar fechas pasadas', 'Inicio de vigencia', 'Este espacio estuvo arrendado hasta el',
      'Fin de vigencia', 'No puede ser anterior al inicio', 'No se entiende la cifra', 'Periodicidad del pago', 'Renovación automática',
      'Documento del contrato (PDF)', 'Adjuntar PDF del contrato firmado (máx. 8 MB)', 'Bimestral',
    ],
    ingles: ['Lease terms.', 'You can use past dates', 'Start date', 'End date', 'Payment frequency', 'Automatic renewal', 'Every two months'],
  },
  {
    nombre: 'contrato + pantalla · paso 2 con PDF adjunto',
    pintar: async (idioma) => {
      forzar('ContratoWizard', 0, 2)
      forzar('ContratoWizard', 18, 'data:application/pdf;base64,AA') // documento
      forzar('ContratoWizard', 19, 'acuerdo-firmado.pdf') // docNombre
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: ['acuerdo-firmado.pdf', 'Quitar'],
    ingles: ['Remove'],
  },
  {
    nombre: 'contrato + pantalla · paso 3 del inventario con historial',
    pintar: async (idioma) => {
      datos.contratos = [{ ...CONTRATOS[1], sitioId: 's2', estatus: 'VENCIDO', fechaFin: '2026-06-30', predioId: null }]
      forzar('ContratoWizard', 0, 3)
      forzar('ContratoWizard', 13, '2026-06-01') // fechaInicio
      forzar('ContratoWizard', 14, '2026-12-31') // fechaFin
      forzar('ContratoWizard', 15, '8000') // renta
      forzar('ContratoWizard', 21, 's2') // sitioSelId
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: [
      '¿Qué pantalla ampara este contrato?', 'Del inventario', 'Pantalla nueva', 'Pantalla (3 sin arrendador)',
      'Esta pantalla estuvo arrendada hasta el', 'Datos que ya tiene', 'Tarifa publicada', 'Dirección',
      'Se ligará al predio del contrato. Para cambiar estos datos, edita la pantalla en Inventario.',
      'Se creará el contrato', 'asignará la pantalla', 'Crear contrato y pantalla', 'Espectacular',
    ],
    ingles: ['Which screen does this contract cover?', 'From inventory', 'New screen', 'Screen (3 without landlord)', 'Data it already has', 'Published rate', 'Create contract and screen'],
  },
  {
    nombre: 'contrato + pantalla · paso 3 pantalla nueva digital',
    pintar: async (idioma) => {
      forzar('ContratoWizard', 0, 3)
      forzar('ContratoWizard', 20, 'nueva') // modoPantalla
      forzar('ContratoWizard', 23, 'PANTALLA_DIGITAL') // tipoMedio
      forzar('ContratoWizard', 24, 'digital') // exhibicion
      forzar('ContratoWizard', 31, 'NaN') // tarifa
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: [
      'Nombre de la pantalla', 'Ej. Patriotismo y Pensilvania', 'Tipo de medio', 'Distrito / alcaldía', 'Ciudad', 'Caras',
      'Slots (digital)', 'Duración por slot (s)', 'Muro', 'Valla', 'Mobiliario urbano', 'Puente', 'Otro', 'creará la pantalla',
    ],
    ingles: ['Screen name', 'Media type', 'District / borough', 'City', 'Faces', 'Slots (digital screen)', 'Slot length (s)', 'Wall', 'Poster panel'],
  },
  {
    nombre: 'contrato + pantalla · paso 3 solo pantalla (predio con contrato)',
    pintar: async (idioma) => {
      forzar('ContratoWizard', 0, 3)
      forzar('ContratoWizard', 4, 'ar1')
      forzar('ContratoWizard', 9, 'existente')
      forzar('ContratoWizard', 10, 'pr1')
      datos.sitios = [{ ...SITIOS[1], predioId: null }]
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: ['1. Arrendador y predio', '2. Pantalla', 'se agregará', 'al predio, que ya tiene contrato vigente.'],
    ingles: ['2. Screen', 'will be added to the property, which already has an active contract.'],
  },
  {
    nombre: 'contrato + pantalla · todas las pantallas con predio',
    pintar: async (idioma) => {
      forzar('ContratoWizard', 0, 3)
      datos.sitios = [{ ...SITIOS[0], predioId: 'pr1' }]
      return pintar(idioma, createElement(await wizard()))
    },
    espanol: ['Todas tus pantallas ya están asignadas a un predio. Cambia a “Pantalla nueva”.'],
    ingles: ['All your screens are already assigned to a property. Switch to “New screen”.'],
  },
  {
    nombre: 'alta manual · todas las pestañas',
    pintar: async (idioma) => {
      const A = await alta()
      return pintar(idioma, createElement(A, { open: true, inline: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: [
      'Nueva pantalla', 'Alta manual de una sola pantalla', 'Básico', 'Especificaciones', 'IA/Vision', 'Precios', 'Imágenes',
      'Información básica', 'Pantalla propia', 'Es de la empresa: no se le paga renta a nadie.',
      'Arrendador (dueño del espacio)', 'Elige un arrendador…', 'Renta al arrendador', 'Ej. 45000',
      'Lo que se le paga al arrendador, no lo que se le cobra al cliente.', 'Exhibición', 'Fija (impresa)', 'Digital (pantalla)',
      'Pantalla fija: se imprime y se comercializa por periodo.', 'Latitud', 'Longitud', 'Tipo de pantalla', 'Estado',
      'Mobiliario urbano (parabús/mupi/publitienda)', 'Ocupada', 'Mantenimiento', 'Especificaciones técnicas',
      'Resolución ancho (px)', 'Resolución alto (px)', 'Modalidades de contratación', 'Catorcenal', 'Configuración de slots',
      'Total slots', 'Slots disponibles', 'Computer Vision / AdMobilize', 'permite detectar y contabilizar vehículos',
      'Esta pantalla cuenta con tecnología de Computer Vision (IA)', 'El costo de esta pantalla es la', 'Aún sin capturar.',
      'Precio por m² (estáticas)', 'Se aplica a las estáticas del lote', 'Imagen promocional', 'JPG o PNG · máximo 5MB', 'Subir imagen',
      'Guardar pantalla',
    ],
    ingles: [
      'New screen', 'Basics', 'Specifications', 'Prices', 'Images', 'Basic information', 'Owned screen',
      'Landlord (space owner)', 'Choose a landlord…', 'Rent to landlord', 'Static (printed)', 'Latitude', 'Longitude',
      'Every two weeks', 'Total slots', 'Promotional image', 'Upload image', 'Save screen',
    ],
  },
  {
    nombre: 'alta manual · propia, digital, con IA y con el intento de guardar',
    pintar: async (idioma) => {
      forzar('NuevaPantallaForm', 1, true) // propio
      forzar('NuevaPantallaForm', 8, 'digital') // exhibicion
      forzar('NuevaPantallaForm', 17, true) // cv
      forzar('NuevaPantallaForm', 2, '45000') // renta (no se ve: es propia)
      forzar('useObligatorios', 0, true) // intento
      const A = await alta()
      return pintar(idioma, createElement(A, { open: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: [
      'Pantalla digital: se comercializa por slots (ver pestaña Especificaciones).', 'ID del dispositivo AdMobilize',
      'p. ej. ADM-00123', 'Vista de detección en vivo', 'Ver imagen de detección IA', 'ID AdMobilize requerido (pestaña IA/Vision)',
      'Cancelar',
    ],
    ingles: ['Digital screen: sold by slots (see the Specifications tab).', 'AdMobilize device ID', 'View AI detection image', 'Cancel'],
  },
  {
    nombre: 'alta manual · el visor de la detección',
    pintar: async (idioma) => {
      forzar('NuevaPantallaForm', 1, true) // propio
      forzar('NuevaPantallaForm', 17, true) // cv
      forzar('NuevaPantallaForm', 19, true) // verIA
      forzar('NuevaPantallaForm', 22, 'data:image/png;base64,AA') // imagen
      forzar('NuevaPantallaForm', 23, 'foto.png') // imagenNombre
      forzar('NuevaPantallaForm', 5, '19.4') // lat
      forzar('NuevaPantallaForm', 6, '200') // lng (fuera de rango)
      forzar('NuevaPantallaForm', 2, '45000') // renta
      const A = await alta()
      return pintar(idioma, createElement(A, { open: true, inline: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: [
      'Detección por Computer Vision', 'Vista de muestra del conteo de vehículos y personas (AdMobilize)',
      'Las cajas y métricas (velocidad, conteo por zona) las genera el módulo de Computer Vision en tiempo real.',
      'Cambiar imagen', 'Coordenadas fuera de rango', 'Latitud y longitud obligatorias (pestaña Ubicación)',
    ],
    ingles: ['Computer Vision detection', 'Change image', 'Coordinates out of range'],
  },
  {
    nombre: 'alta manual · faltan obligatorios del básico',
    pintar: async (idioma) => {
      forzar('NuevaPantallaForm', 22, 'data:image/png;base64,AA') // imagen
      forzar('useObligatorios', 0, true)
      const A = await alta()
      return pintar(idioma, createElement(A, { open: true, inline: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: ['Faltan datos obligatorios (pestaña Básico)'],
    ingles: ['Required fields missing (Basics tab)'],
  },
  {
    nombre: 'alta manual · falta la imagen, y una cifra que no se entiende',
    pintar: async (idioma) => {
      forzar('useObligatorios', 0, true)
      const A = await alta()
      return pintar(idioma, createElement(A, { open: true, inline: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: ['Imagen obligatoria (pestaña Imágenes)'],
    ingles: ['Image required (Images tab)'],
  },
  {
    nombre: 'alta manual · cifra en rojo',
    pintar: async (idioma) => {
      forzar('NuevaPantallaForm', 2, 'NaN') // renta
      const A = await alta()
      return pintar(idioma, createElement(A, { open: true, inline: true, onOpenChange: () => {}, onCreado: () => {} }))
    },
    espanol: ['Hay una cifra en rojo que no se entiende (renta, tarifa, precio por m² o slots)'],
    ingles: ['There is a figure in red that can’t be read (rent, rate, price per m² or slots)'],
  },
  {
    nombre: 'carga masiva · sin archivo',
    pintar: async (idioma) => {
      const I = await importar()
      return pintar(idioma, createElement(I, { open: true, inline: true, onOpenChange: () => {} }))
    },
    espanol: [
      '¿Primera vez cargando inventario?', 'Descarga la plantilla con el formato correcto', 'Descargar plantilla',
      'Son pantallas propias', 'Arrendador de estas pantallas', 'A cada pantalla se le abrirá un contrato pendiente con este arrendador',
      'Se requiere el arrendador.', 'Predio', 'Sin nombre entran como pantallas sueltas, cada una con su contrato.', 'Nombre del predio',
      'Sube el archivo usando la hoja', 'limpia automáticamente los encabezados', 'agrupa por código de proveedor',
      'El costo de una pantalla es', 'uno solo', 'Codificación del archivo', 'UTF-8 (Universal)',
      'El sistema intentará detectar automáticamente la codificación correcta si la seleccionada no funciona.', 'Archivo',
      'Arrastra un archivo o selecciónalo', '.xlsx o .csv', 'Imágenes (bulk)', 'Subir imágenes (JPG/PNG ≤5MB)', 'Nombra cada archivo con el',
      'Sin archivo', 'Limpiar', 'Procesar importación',
    ],
    ingles: [
      'First time uploading inventory?', 'Download template', 'They are owned screens', 'Landlord of these screens', 'Property',
      'File encoding', 'File', 'Drag a file or select it', 'No file', 'Clear', 'Process import',
    ],
  },
  {
    nombre: 'carga masiva · archivo leído con duplicados y un predio',
    pintar: async (idioma) => {
      forzar('ImportarInventarioDialog', 0, 'ar1') // arrendadorId
      forzar('ImportarInventarioDialog', 2, 'Predio Nuevo') // predioNombre
      forzar('ImportarInventarioDialog', 5, [FILA_OK, FILA_LEJOS, FILA_ERROR]) // filas
      forzar('ImportarInventarioDialog', 6, 'sitios.xlsx') // archivoNombre
      forzar('ImportarInventarioDialog', 3, 'NaN') // precioM2
      const I = await importar()
      return pintar(idioma, createElement(I, { open: true, onOpenChange: () => {} }))
    },
    espanol: [
      'Carga masiva de inventario', 'Sube tu inventario por archivo o agrega una sola pantalla',
      'El predio y su contrato se abrirán a nombre de este arrendador', 'Se creará el predio y todas compartirán UN solo contrato.',
      'Una pantalla no parece estar en este predio.', 'Un predio es un solo inmueble', 'Precio de impresión por m² (pantallas estáticas)',
      'Este valor se aplicará a todas las pantallas estáticas', 'El precio por m² no se entiende', '1 código(s) ya existen',
      'Elige cómo proceder antes de importar:', 'Actualizar', 'campos modificados', 'Crear nueva', 'con sufijo -v2, -v3…',
      'Vista previa', 'válida', 'advertencia', '3 filas leídas', 'Cerrar',
    ],
    ingles: ['One screen doesn’t seem to be on this property.', '1 code already exists', 'Preview', 'valid', 'warning', '3 rows read', 'Close'],
  },
  {
    nombre: 'carga masiva · predio existente, varias lejos',
    pintar: async (idioma) => {
      forzar('ImportarInventarioDialog', 0, 'ar1')
      forzar('ImportarInventarioDialog', 2, 'predio reforma')
      forzar('ImportarInventarioDialog', 5, [FILA_OK, FILA_LEJOS, FILA_LEJOS, FILA_LEJOS, FILA_LEJOS, FILA_LEJOS, FILA_LEJOS, FILA_LEJOS, FILA_LEJOS])
      return pintar(idioma, createElement(await importar(), { open: true, inline: true, onOpenChange: () => {} }))
    },
    espanol: ['Se añadirán al predio que ya existe, bajo su contrato.'],
    ingles: ['They will be added to the existing property, under its contract.'],
  },
  {
    nombre: 'carga masiva · el resumen tras importar',
    pintar: async (idioma) => {
      forzar('ImportarInventarioDialog', 1, true) // propio
      forzar('ImportarInventarioDialog', 5, [FILA_OK]) // filas
      forzar('ImportarInventarioDialog', 9, RESUMEN) // summary
      forzar('ImportarInventarioDialog', 7, { 'a.jpg': 'x', 'b.jpg': 'y' }) // imagenes
      return pintar(idioma, createElement(await importar(), { open: true, inline: true, onOpenChange: () => {} }))
    },
    espanol: [
      'Total', 'Creadas', 'Actualizadas', 'Advertencias', 'Errores', 'Ver información añadida (1)', 'actualizado', 'creado', 'error',
      '2 imágenes cargadas',
    ],
    ingles: ['Created', 'Updated', 'Warnings', 'Errors', 'View added information (1)', 'updated', 'created', '2 images uploaded'],
  },
  {
    nombre: 'carga masiva · sin arrendadores dados de alta',
    pintar: async (idioma) => {
      datos.arrendadores = []
      forzar('ImportarInventarioDialog', 5, [FILA_OK])
      return pintar(idioma, createElement(await importar(), { open: true, inline: true, onOpenChange: () => {} }))
    },
    espanol: ['No hay arrendadores dados de alta. Crea al menos uno en', 'Falta elegir el arrendador'],
    ingles: ['There are no landlords yet. Create at least one in', 'Choose the landlord'],
  },
  {
    nombre: 'información añadida',
    pintar: async (idioma) => {
      const { InfoAnadidaModal } = await import('../../components/demo/inventario/InfoAnadidaModal')
      return pintar(idioma, createElement(InfoAnadidaModal, { open: true, onOpenChange: () => {}, sitios: [SITIOS[0], SITIOS[2]] as never }))
    },
    espanol: ['Información añadida', '2 pantallas en el inventario', ' · coords por verificar', '1 modalidad', 'Pantalla digital', 'Mural'],
    ingles: ['Added information', '2 screens in the inventory', ' · coordinates to verify', '1 sales mode'],
  },
  {
    nombre: 'información añadida · vacía',
    pintar: async (idioma) => {
      const { InfoAnadidaModal } = await import('../../components/demo/inventario/InfoAnadidaModal')
      return pintar(idioma, createElement(InfoAnadidaModal, { open: true, onOpenChange: () => {}, sitios: [] }))
    },
    espanol: ['0 pantallas en el inventario', 'No hay pantallas para mostrar.'],
    ingles: ['0 screens in the inventory', 'There are no screens to show.'],
  },
  {
    nombre: 'agregar inventario (la tarjeta)',
    pintar: async (idioma) => {
      const { AgregarInventario } = await import('../../components/demo/inventario/AgregarInventario')
      return pintar(idioma, createElement(AgregarInventario))
    },
    espanol: ['Agregar inventario', 'Carga masiva por Excel/CSV con plantilla, o alta manual de una pantalla.', 'Alta manual', 'Carga masiva'],
    ingles: ['Add inventory', 'Manual entry', 'Bulk upload'],
  },

  // ─── ARRENDADORES ──────────────────────────────────────────────────────────
  {
    nombre: 'arrendadores · la página con datos',
    pintar: async (idioma) => pintar(idioma, createElement(await arrendadoresPagina())),
    espanol: [
      'Arrendadores', 'El otro lado de la red · contratos, rentas y vencimientos', 'Nuevo arrendador', 'Nuevo contrato',
      'Buscar arrendador, pantalla o RFC…', 'Todos los arrendadores', 'Contratos: todos', 'Por vencer', 'Incompleto',
      'Renta mensual', '+ 1 por capturar', 'Contratos', 'de 2 arrendadores', 'contratos que hay que renovar o terminar',
      'Renta vencida', 'pagos de renta vencidos', 'La renta mensual no incluye 1 contrato incompleto', ': falta capturar arrendador, vigencia, importe y periodicidad',
      'Contratos de arrendamiento', 'Vigentes en Excel', 'Descargar los contratos vigentes en Excel', 'Sitio', 'Cada cuándo', 'Vence',
      'Estatus', 'Por definir', 'Vendida en «Navidad»', 'en 29 d', 'hace 670 d', 'Completar', 'Mensual', 'Anual', 'Vencido',
      'Pagos de renta', '1 vencida', 'por pagar', 'Pantalla', 'Monto', 'Contrato hasta', 'Pagado el', 'hace 8 días', 'en 2 días',
      'Programado', 'Pagado', 'Registrar pago', 'Cuadre de renta por arrendador', 'Qué se le debe a cada uno y qué ya se le pagó.',
      'Arrendador / emplazamiento', 'Pendiente', 'Próximo', 'emplazamiento', 'Rentabilidad por pantalla', 'Margen mensual = ingreso',
      'Ingreso/mes', 'Renta/mes', 'Margen/mes', 'sin contrato de renta', 'Total', 'Dueños de predio dados de alta.', 'Domicilio',
      'Contacto', 'Predios', 'Falta', 'Editar', '1 activo(s) de 1. Solo los activos impiden dar de baja.',
      'Un propietario con predios a su nombre no se puede dar de baja.', 'Dar de baja', 'Dar de baja a Don Pepe',
      'Razones sociales', '1 sin razón social', 'Sin razón social, los contratos de estos arrendadores no podrán anclar',
      'Agregar →', 'Agregar', 'RFC: IPE800101AB1', 'Régimen: ', 'falta', '1 contrato factura aquí',
      'Hay contratos que facturan a esta razón social', 'Por razón social', 'Razón social', 'Pagos vencidos', 'Sin razón social',
    ],
    ingles: [
      'Landlords', 'New landlord', 'New contract', 'All landlords', 'Contracts: all', 'Expiring soon', 'Incomplete', 'Monthly rent',
      '+ 1 to enter', 'from 2 landlords', 'Overdue rent', 'Lease agreements', 'Export active (Excel)', 'Site', 'Frequency', 'Expires',
      'To be defined', 'Sold in “Navidad”', 'in 29 d', '670 d ago', 'Complete', 'Rent payments', '1 overdue', 'to pay',
      '8 days ago', 'in 2 days', 'Scheduled', 'Paid', 'Record payment', 'Rent reconciliation by landlord', 'Profitability by screen',
      'Revenue/mo', 'Rent/mo', 'Margin/mo', 'no rent contract', 'Address', 'Contact', 'Properties', 'Missing', 'Deactivate',
      'Legal entities', '1 without a legal entity', 'By legal entity', 'Overdue payments', 'No legal entity',
    ],
  },
  {
    nombre: 'arrendadores · con filtro y sin coincidencias',
    pintar: async (idioma) => {
      forzar('ArrendadoresPage', 5, { texto: 'zzz', arrendadorId: '', estatus: '' })
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: [
      '0 de 3 contratos', 'Limpiar', 'Ningún arrendador coincide con el filtro.', 'Ninguna pantalla coincide con el filtro.',
    ],
    ingles: ['0 of 3 contracts', 'Clear', 'No landlords match the filter.', 'No screens match the filter.'],
  },
  {
    nombre: 'arrendadores · vacía',
    pintar: async (idioma) => {
      datos.arrendadores = []
      datos.contratos = []
      datos.pagos = []
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: [
      '0 contratos activos', 'Aún no hay arrendadores. Usa', '“Nuevo arrendador”', 'para dar de alta uno.',
      'Aún no hay arrendadores dados de alta.', 'Sin pagos de renta registrados.',
      '— Sin pagos de renta generados todavía: se calculan al capturar el importe del contrato.',
    ],
    ingles: ['0 active contracts', 'There are no landlords yet. Use', 'There are no landlords yet.', 'No rent payments recorded.'],
  },
  {
    nombre: 'arrendadores · cargando',
    pintar: async (idioma) => {
      datos.contratos = undefined
      datos.pagos = undefined
      datos.arrendadores = undefined
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: ['Pagos de renta', 'Cuadre de renta por arrendador'],
    ingles: ['Rent payments', 'Rent reconciliation by landlord'],
  },
  {
    nombre: 'arrendadores · alta de arrendador con RFC malo y nombre repetido',
    pintar: async (idioma) => {
      forzar('ArrendadoresPage', 3, true) // nuevoOpen
      forzar('NuevoPropietarioDialog', 0, 'Don Pepe') // nombre
      forzar('NuevoPropietarioDialog', 1, 'MAL') // rfc
      forzar('NuevoPropietarioDialog', 8, 'Ya existe «Don Pepe».') // error
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: [
      'Alta de arrendador (dueño del predio)', 'Formato inválido. Son 3 letras (empresa) o 4 (persona), fecha AAMMDD y 3 caracteres de homoclave.',
      'contacto@arrendador.com', 'Calle, número, colonia, CP, ciudad, estado',
      'El contrato de arrendamiento lo necesita para las notificaciones.', 'Datos fiscales', 'Es a quien se le factura la renta.',
      'Régimen fiscal', '601 — General de Ley Personas Morales', 'Se habilita al capturar la razón social: el régimen es de ella.',
    ],
    ingles: ['Add a landlord (owner of the property)', 'Invalid format.', 'Tax details', 'Tax regime'],
  },
  {
    nombre: 'arrendadores · alta de arrendador, nombre repetido',
    pintar: async (idioma) => {
      forzar('ArrendadoresPage', 3, true)
      forzar('NuevoPropietarioDialog', 5, 'Inmuebles SA') // razonSocial
      forzar('NuevoPropietarioDialog', 9, 'Ya existe un propietario con ese nombre.') // nombreRepetido
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: ['Si te equivocaste, cierra y búscalo en la lista; si de verdad es otro propietario', 'Crear de todos modos'],
    ingles: ['If it was a mistake, close and look for it in the list', 'Create anyway'],
  },
  {
    nombre: 'arrendadores · dar de baja y su contraseña',
    pintar: async (idioma) => {
      forzar('PropietariosCard', 3, { id: 'ar1', nombre: 'Don Pepe' }) // baja
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: [
      'Deja de aparecer en la aplicación y no se puede reactivar desde aquí', 'dejará de aparecer en',
      'Sus contratos y pagos anteriores se conservan.',
    ],
    ingles: ['Stops appearing in the app and can’t be reactivated from here', 'Their past contracts and payments are kept.'],
  },
  {
    nombre: 'arrendadores · dar de baja pide la contraseña',
    pintar: async (idioma) => {
      forzar('PropietariosCard', 3, { id: 'ar1', nombre: 'Don Pepe' })
      forzar('BajaPropietarioDialog', 1, true) // reautenticando
      forzar('BajaPropietarioDialog', 0, idioma === 'es' ? 'Escribe tu contraseña para confirmar.' : 'Enter your password to confirm.') // error
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: ['Dar de baja a un propietario no se puede deshacer desde la aplicación', 'Tu contraseña', 'Confirmar y dar de baja'],
    ingles: ['Your password', 'Confirm and deactivate'],
  },
  {
    nombre: 'arrendadores · editar un arrendador en la fila',
    pintar: async (idioma) => {
      forzar('PropietariosCard', 0, 'ar2') // editando
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: ['Calle, número, colonia, CP, ciudad', 'Guardar', 'Cancelar'],
    ingles: ['Street, number, neighborhood, postal code, city', 'Save', 'Cancel'],
  },
  {
    nombre: 'arrendadores · el asistente de contrato en el cuadro',
    pintar: async (idioma) => {
      forzar('ArrendadoresPage', 4, true) // contratoOpen
      return pintar(idioma, createElement(await arrendadoresPagina()))
    },
    espanol: ['Nuevo contrato de arrendamiento', 'Arrendador → contrato (fechas pasadas permitidas) → pantalla'],
    ingles: ['New lease agreement', 'Landlord → contract (past dates allowed) → screen'],
  },
  {
    nombre: 'arrendadores · razones sociales, alta con RFC malo',
    pintar: async (idioma) => {
      forzar('GestionRazonesSociales', 1, 'ar2') // creandoEn
      forzar('GestionRazonesSociales', 2, { razonSocial: 'Rosa SA', rfc: 'MAL', regimen: '' })
      const { GestionRazonesSociales } = await import('../../components/demo/arrendadores/GestionRazonesSociales')
      return pintar(idioma, createElement(GestionRazonesSociales, { arrendadores: ARRENDADORES, razones: RAZONES, contratosPorRazon: new Map(), puedeEditar: true }))
    },
    espanol: [
      'A nombre de quién factura cada arrendador.', 'Nombre o denominación fiscal', '601 - General de Ley Personas Morales',
      'El RFC no tiene un formato válido (3–4 letras, 6 dígitos de fecha y 3 caracteres).',
      'Eliminar',
    ],
    ingles: ['Legal entities', 'The RFC doesn’t have a valid format', 'Delete'],
  },
  {
    nombre: 'arrendadores · razones sociales sin arrendadores',
    pintar: async (idioma) => {
      const { GestionRazonesSociales } = await import('../../components/demo/arrendadores/GestionRazonesSociales')
      return pintar(idioma, createElement(GestionRazonesSociales, { arrendadores: [], razones: [], contratosPorRazon: new Map(), puedeEditar: true }))
    },
    espanol: ['Aún no hay arrendadores dados de alta.'],
    ingles: ['There are no landlords yet.'],
  },
  {
    nombre: 'ficha del contrato · incompleto',
    pintar: async (idioma) => {
      const H = await hoja()
      return pintar(idioma, createElement(H, { contrato: CONTRATOS[1] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
    },
    espanol: [
      'Contrato', 'Reportar incidencia', 'Este contrato se abrió automáticamente al vender la pantalla', 'Completar información',
      'Incompleto', 'Ocupado', 'Contrato de arrendamiento', 'Renta mensual', 'Por definir', 'Periodicidad', 'Vigencia', 'por definir',
      'Tiempo restante', 'Renovación automática', 'No', 'La paga', 'Sin asignar', 'Cambiar', 'Generar contrato', 'Cambios al contrato',
      'Pagos de renta', 'Sin pagos registrados.', 'RUC', 'Correo', 'Teléfono',
    ],
    ingles: [
      'Lease', 'Report incident', 'Complete information', 'Monthly rent', 'To be defined', 'Frequency', 'Term', 'Time remaining',
      'Automatic renewal', 'Paid by', 'Unassigned', 'Change', 'Generate contract', 'Contract changes', 'No payments recorded.',
    ],
  },
  {
    nombre: 'ficha del contrato · por vencer, con pagos y documento',
    pintar: async (idioma) => {
      const H = await hoja()
      return pintar(idioma, createElement(H, { contrato: CONTRATOS[0] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
    },
    espanol: ['Renovar', 'Por vencer', 'Disponible', 'mensual', '29 días', 'Sí', 'Ver documento firmado (PDF)', 'Factura', 'Comprobante', 'Adjuntos', 'Registrar', 'Licencias y permisos', 'Amparan a todas las pantallas de este predio.', 'Licencia municipal', 'vence ', 'Vence en 18 d', 'Venció hace 32 d', 'Vigente', 'Dictamen estructural'],
    ingles: ['Renew', 'monthly', '29 days', 'Yes', 'View signed document (PDF)', 'Invoice', 'Proof of payment', 'Attachments', 'Permits and licenses', 'Municipal license', 'Expires in 18 d', 'Expired 32 d ago', 'Valid'],
  },
  {
    nombre: 'ficha del contrato · vencido',
    pintar: async (idioma) => {
      const H = await hoja()
      datos.licencias = []
      return pintar(idioma, createElement(H, { contrato: { ...CONTRATOS[2], predioId: null } as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
    },
    espanol: ['Vencido', 'anual', 'Sin licencias registradas. Al capturar la vigencia, el sistema avisa con'],
    ingles: ['Expired', 'No permits recorded.'],
  },
  {
    nombre: 'ficha del contrato · registrar un pago pendiente con contraseña',
    pintar: async (idioma) => {
      forzar('ContratoSheet', 3, PAGOS[1]) // pagoActivo
      forzar('PagoModal', 8, true) // reautenticando
      forzar('PagoModal', 7, idioma === 'es' ? 'Escribe tu contraseña para confirmar.' : 'Enter your password to confirm.') // error
      const H = await hoja()
      return pintar(idioma, createElement(H, { contrato: CONTRATOS[0] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
    },
    espanol: [
      'Registrar pago', 'Fecha de pago', 'Método de pago', 'Transferencia', 'Efectivo', 'Cheque', 'Tarjeta', 'Factura del arrendador',
      'Comprobante de pago', 'Adjuntar', 'Sin archivo', 'Observaciones', 'PDF o imagen, hasta 5 MB por archivo.',
      'Tu organización pide la contraseña para confirmar los cambios sensibles.', 'Confirmar y guardar',
    ],
    ingles: ['Record payment', 'Payment date', 'Payment method', 'Bank transfer', 'Cash', 'Check', 'Card', 'Landlord’s invoice', 'Proof of payment', 'Attach', 'Notes', 'Confirm and save'],
  },
  {
    nombre: 'ficha del contrato · adjuntos de un pago hecho',
    pintar: async (idioma) => {
      forzar('ContratoSheet', 3, PAGOS[0])
      forzar('AdjuntoInput', 0, idioma === 'es' ? 'El archivo supera 5 MB' : 'The file exceeds 5 MB')
      const H = await hoja()
      return pintar(idioma, createElement(H, { contrato: CONTRATOS[0] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
    },
    espanol: ['Adjuntos del pago', 'Pagado el 02/10/2026', ' · transferencia', 'Aquí solo se adjuntan los', 'Reemplazar', 'Ver', 'Quitar', 'Guardar adjuntos', 'El archivo supera 5 MB'],
    ingles: ['Payment attachments', 'Paid on Oct 2, 2026', 'Replace', 'View', 'Remove', 'Save attachments', 'The file exceeds 5 MB'],
  },
  {
    nombre: 'ficha del contrato · completar con un arrendador sin datos fiscales',
    pintar: async (idioma) => {
      forzar('ContratoSheet', 0, true) // incOpen
      forzar('ContratoSheet', 1, true) // completarOpen
      forzar('ContratoSheet', 2, true) // pagadoraOpen
      forzar('CompletarContratoModal', 0, 'ar2') // arrendadorId
      forzar('CompletarContratoModal', 3, '2026-01-01') // fechaFin < inicio
      forzar('CompletarContratoModal', 7, true) // reautenticando
      forzar('RazonSocialQuePagaModal', 3, true) // reautenticando
      forzar('useObligatorios', 1, true) // el de CompletarContratoModal (el 0 es el de la incidencia)
      const H = await hoja()
      return pintar(idioma, createElement(H, { contrato: CONTRATOS[1] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
    },
    espanol: [
      'Le falta razón social, RFC, régimen fiscal.', 'No puede ser anterior al inicio (01/03/2026)', 'Revisa los campos marcados en rojo.',
      'Con cuál de tus razones sociales se paga', 'Completar contrato de arrendamiento',
      'Los cuatro datos que faltan para que cuente como acuerdo real', 'Elige el arrendador…', 'Importe de la renta', 'Cada cuándo se paga',
      'Desde', 'Hasta', ' — la que arrienda', 'Al guardar, el contrato deja de estar incompleto', ' mensual', 'Reportar y bloquear sitio',
      'Legal / permiso', 'Vandalismo', 'Clima', 'Suspensión operativa', 'Accidente', 'Descripción', 'Describe la incidencia…',
      'Al reportar, el sitio pasa a', 'bloqueado', 'Solo cambia a nombre de quién sale esta renta. No toca el importe.',
      'Medios SA', 'Tu organización pide la contraseña para confirmar los cambios sensibles.',
    ],
    ingles: ['It’s missing legal name, RFC (tax ID), tax regime.', 'Review the fields marked in red.', 'Complete lease agreement', 'Rent amount',
      'Payment frequency', 'From', 'To', 'Report and block site', 'Describe the incident…'],
  },
  {
    nombre: 'ficha del contrato · sin razones sociales propias',
    pintar: async (idioma) => {
      forzar('ContratoSheet', 1, true)
      forzar('ContratoSheet', 2, true)
      forzar('CompletarContratoModal', 0, 'ar1')
      const ent = await import('@/lib/data/client')
      vi.spyOn(ent, 'useEntidadesFiscales').mockReturnValue([] as never)
      const H = await hoja()
      const html = pintar(idioma, createElement(H, { contrato: CONTRATOS[1] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
      vi.restoreAllMocks()
      return html
    },
    espanol: [
      'Todavía no tienes razones sociales capturadas. Se pueden dar de alta en Razones',
      'Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales.',
    ],
    ingles: ['You don’t have any legal entities yet.'],
  },
  {
    nombre: 'ficha del contrato · un arrendador con varias razones',
    pintar: async (idioma) => {
      forzar('ContratoSheet', 1, true)
      forzar('CompletarContratoModal', 0, 'ar1')
      forzar('CompletarContratoModal', 4, 'e1')
      const ent = await import('@/lib/data/client')
      vi.spyOn(ent, 'useRazonesSociales').mockReturnValue([...RAZONES, { ...RAZONES[0], id: 'rs2', razonSocial: 'Otra SA' }] as never)
      const H = await hoja()
      const html = pintar(idioma, createElement(H, { contrato: CONTRATOS[1] as never, open: true, onOpenChange: () => {}, onToast: () => {} }))
      vi.restoreAllMocks()
      return html
    },
    espanol: ['Tiene 2 razones sociales; se muestra la primera.'],
    ingles: ['It has 2 legal names; the first one is shown.'],
  },
  {
    nombre: 'cambios al contrato · historial, versiones y edición firmada',
    pintar: async (idioma) => {
      forzar('CambiosContrato', 0, [
        { id: 'h1', propuestoPor: 'ARRENDADOR', usuarioNombre: 'Ana', creadoEn: '2026-10-20T15:00:00Z', motivo: 'bajar renta',
          cambios: [{ campo: 'montoRenta', etiqueta: 'Importe', antes: '12000', despues: '10000' }, { campo: 'deposito', etiqueta: 'Garantía', antes: null, despues: null }],
          versionFirmada: 1, envioAnulado: false },
        { id: 'h2', propuestoPor: null, usuarioNombre: 'Luis', creadoEn: '2026-10-10T15:00:00Z', motivo: null,
          cambios: [], versionFirmada: null, envioAnulado: true },
      ])
      forzar('CambiosContrato', 1, { firmado: true, enviado: true })
      forzar('CambiosContrato', 2, [
        { version: 1, archivadoEn: '2026-10-20T15:00:00Z', motivo: 'bajar renta', usuarioNombre: 'Ana',
          firmas: [{ parte: 'ARRENDADOR', nombreFirmante: 'Don Pepe', firmadoEn: '2026-10-01T15:00:00Z' }, { parte: 'ARRENDATARIO', nombreFirmante: 'Ana', firmadoEn: null }] },
      ])
      forzar('CambiosContrato', 4, true) // editando
      forzar('VersionesFirmadas', 0, { version: 1, documentoHash: 'hhh', documento: 'TEXTO FIRMADO' })
      forzar('EditarTerminosModal', 5, true) // reautenticando
      forzar('useObligatorios', 0, true)
      const C = await cambios()
      return pintar(idioma, createElement(C, { contrato: CONTRATOS[0] as never, onToast: () => {} }))
    },
    espanol: [
      'Cambios al contrato', 'Editar términos', 'Ya está firmado. Si cambias sus términos', 'Lo propuso ', 'el arrendador',
      ' · lo registró Ana', '«bajar renta»', 'vacío', 'Estaba firmado: se archivó como versión firmada 1 y se anularon sus firmas.',
      'Captura interna', 'Ya se había enviado a firma: ese enlace dejó de servir y hubo que reenviarlo.', 'Versiones firmadas anteriores',
      'Versión 1', ' · archivada ', 'Ver texto firmado', 'El arrendador:', ' firmó ', 'Nosotros:', 'Versión firmada 1', 'Sello SHA-256: hhh',
      'TEXTO FIRMADO', 'Editar términos del contrato', 'Ya firmado: la versión firmada se archiva y se vuelve a firmar.', 'ya está firmado',
      '¿Quién propuso el cambio?', 'Motivo', 'Ej. pidió bajar la renta a cambio de un plazo más largo', 'Razón social del arrendador',
      'Sin razón social', 'Inicio', 'Fin', 'Moneda', 'Confirmar y guardar',
    ],
    ingles: [
      'Contract changes', 'Edit terms', 'Proposed by ', 'the landlord', ' · recorded by Ana', 'empty', 'Internal entry', 'Previous signed versions',
      'Version 1', 'View signed text', 'Signed version 1', 'SHA-256 seal: hhh', 'TEXTO FIRMADO', 'Edit contract terms', 'Who proposed the change?',
      'Reason', 'Landlord’s legal name', 'Start', 'End', 'Currency', 'Security deposit', 'Confirm and save',
    ],
  },
  {
    nombre: 'cambios al contrato · sin cambios y enviado sin firmar',
    pintar: async (idioma) => {
      forzar('CambiosContrato', 0, [])
      forzar('CambiosContrato', 1, { firmado: false, enviado: true })
      forzar('CambiosContrato', 4, true)
      forzar('EditarTerminosModal', 1, 'ARRENDADOR') // propuestoPor
      forzar('EditarTerminosModal', 0,
        { arrendadorId: 'ar1', razonSocialId: '', entidadId: '', fechaInicio: '2026-01-01', fechaFin: '2025-01-01', montoRenta: 'NaN', periodicidad: 'MENSUAL', moneda: 'MXN', deposito: '', autoRenovable: true })
      const C = await cambios()
      return pintar(idioma, createElement(C, { contrato: CONTRATOS[0] as never, onToast: () => {} }))
    },
    espanol: [
      'Sin cambios registrados desde que se dio de alta.', 'Antes de firmarse. Cada cambio queda en el historial con quién lo pidió.',
      'ya se envió a firma', 'el enlace que tiene el', 'No puede ser anterior al inicio', 'No se entiende la cifra',
      'Revisa los campos marcados en rojo.',
    ],
    ingles: ['No changes recorded since it was created.', 'Before signing.', 'Can’t be earlier than the start', 'The figure can’t be read'],
  },
  {
    nombre: 'licencias · alta con fechas invertidas',
    pintar: async (idioma) => {
      forzar('LicenciasCard', 0, true)
      const { LicenciasCard } = await import('../../components/demo/arrendadores/LicenciasCard')
      return pintar(idioma, createElement(LicenciasCard, { predioId: null, sitioId: 's9', onToast: () => {} }))
    },
    espanol: [
      'Sin licencias registradas.', 'Registrar licencia o permiso', 'La fecha de vencimiento es lo que dispara el aviso',
      'Permiso ambiental', 'Autoridad que la expide', 'Expedición', 'Vencimiento',
    ],
    ingles: ['Record a license or permit', 'Environmental permit', 'Issuing authority', 'Issue date', 'Expiration'],
  },
  {
    nombre: 'licencias · fechas invertidas',
    pintar: async (idioma) => {
      forzar('LicenciasCard', 0, true)
      forzar('AltaLicencia', 1, 'F-1') // folio
      forzar('AltaLicencia', 2, 'Alcaldía') // autoridad
      forzar('AltaLicencia', 3, '2026-05-01') // expedicion
      forzar('AltaLicencia', 4, '2026-01-01') // vencimiento
      const { LicenciasCard } = await import('../../components/demo/arrendadores/LicenciasCard')
      return pintar(idioma, createElement(LicenciasCard, { predioId: null, sitioId: 's9', onToast: () => {} }))
    },
    espanol: ['No puede ser anterior a la expedición', 'La licencia no puede vencer antes de expedirse.'],
    ingles: ['Cannot be earlier than the issue date', 'The permit cannot expire before it is issued.'],
  },
  {
    nombre: 'cuadre de renta · desplegado',
    pintar: async (idioma) => {
      forzar('ConciliacionCard', 0, new Set(['ar1']))
      const { ConciliacionCard } = await import('../../components/demo/arrendadores/ConciliacionCard')
      return pintar(idioma, createElement(ConciliacionCard))
    },
    espanol: ['Arrendador / emplazamiento', 'Predio', 'contrato', 'Vencido', 'Pendiente', 'Pagado', 'Próximo', 'Total'],
    ingles: ['Landlord / placement', '1 placement', 'Property', '1 contract', 'Overdue', 'Pending', 'Paid', 'Next'],
  },
  {
    nombre: 'pagos de renta · contratos sin importe',
    pintar: async (idioma) => {
      datos.pagos = []
      datos.contratos = [CONTRATOS[1], { ...CONTRATOS[1], id: 'c9' }]
      const { PagosRentaCard } = await import('../../components/demo/arrendadores/PagosRentaCard')
      return pintar(idioma, createElement(PagosRentaCard, { onToast: () => {} }))
    },
    espanol: ['No se puede calcular lo que hay que pagar: 2 contrato', 'sin importe capturado.', 'Complétalo en Arrendadores', 'y el calendario de pagos se genera solo.'],
    ingles: ['Can’t calculate what has to be paid: 2 contracts without an amount.', 'Complete it in Landlords'],
  },
  {
    nombre: 'pagos de renta · solo pendientes, sin pendientes',
    pintar: async (idioma) => {
      datos.pagos = [PAGOS[0]]
      datos.contratos = [CONTRATOS[0]]
      const { PagosRentaCard } = await import('../../components/demo/arrendadores/PagosRentaCard')
      return pintar(idioma, createElement(PagosRentaCard, { soloPendientes: true }))
    },
    espanol: ['No hay rentas pendientes de pago.'],
    ingles: ['There is no rent pending payment.'],
  },
  {
    nombre: 'renta comprometida (en Finanzas)',
    pintar: async (idioma) => {
      const { CompromisoRentaCard } = await import('../../components/demo/arrendadores/CompromisoRentaCard')
      return pintar(idioma, createElement(CompromisoRentaCard))
    },
    espanol: [
      'Renta comprometida a arrendadores', '/mes', 'Equivale a', 'en 29 días', 'hace 670 días', 'El total no incluye 1 contrato',
      'incompleto', ' (falta arrendador, vigencia, importe y periodicidad)', ': el costo real es mayor.', 'Completar información',
      'Se listan 1 contrato vencido', 'Renuévalos en Arrendadores o quedarán sin cobertura.',
    ],
    ingles: ['Rent committed to landlords', '/mo', 'Equivalent to', 'in 29 days', '670 days ago', 'The total doesn’t include 1 incomplete contract'],
  },
  {
    nombre: 'renta comprometida · sin contratos con importe',
    pintar: async (idioma) => {
      datos.contratos = []
      const { CompromisoRentaCard } = await import('../../components/demo/arrendadores/CompromisoRentaCard')
      return pintar(idioma, createElement(CompromisoRentaCard))
    },
    espanol: ['No hay contratos con importe capturado todavía.'],
    ingles: ['There are no contracts with an amount yet.'],
  },

  // ─── EL DOCUMENTO DEL CONTRATO Y LA FIRMA ─────────────────────────────────
  {
    nombre: 'panel de firmas · sin enviar, revisando',
    pintar: async (idioma) => {
      forzar('PanelFirmas', 2, true) // revisando
      const P = await panel()
      return pintar(idioma, createElement(P, { contratoId: 'c1', inicial: ESTADO_FIRMAS_SIN_ENVIAR as never, hayFaltantes: true, revision: REVISION as never }))
    },
    espanol: [
      'Firma del contrato', 'Al enviar a firma, el sistema', 'congela', 'No se puede enviar a firma mientras falten datos por capturar (ver arriba).',
      'Revisa los datos que llevará el contrato', 'Son los datos actuales.', 'Tu empresa (arrendataria)', 'Domicilio fiscal',
      'Representante legal', 'sin capturar', 'El arrendador', 'El espacio', 'Términos', '2026-01-01 a 2026-12-01', 'mensual',
      'Los datos son correctos, enviar a firma', 'Corregir antes',
    ],
    ingles: ['Contract signature', 'Review the data the contract will include', 'Your company (lessee)', 'Tax address', 'Legal representative', 'not entered', 'The space', 'Terms', 'The data is correct, send for signature', 'Fix it first',
      // Ola 7: la vigencia con la fecha inglesa, no la ISO del dato.
      'Jan 1, 2026 to Dec 1, 2026'],
  },
  {
    nombre: 'panel de firmas · sin enviar',
    pintar: async (idioma) => {
      const P = await panel()
      return pintar(idioma, createElement(P, { contratoId: 'c1', inicial: ESTADO_FIRMAS_SIN_ENVIAR as never, hayFaltantes: false, revision: REVISION as never }))
    },
    espanol: ['Enviar a firma'],
    ingles: ['Send for signature'],
  },
  {
    nombre: 'panel de firmas · firmado, desfasado y con enlace',
    pintar: async (idioma) => {
      const P = await panel()
      return pintar(idioma, createElement(P, { contratoId: 'c1', inicial: ESTADO_FIRMAS_FIRMADO as never, hayFaltantes: false, revision: REVISION as never }))
    },
    espanol: [
      'Documento congelado el', 'Sello SHA-256:', 'Este contrato ya tiene firmas.', 'El contrato cambió después de congelarse.',
      'Tu empresa (arrendataria)', 'Firma invalidada', '(el documento cambió)', 'Firmó: ', 'IP: 10.0.0.1 · Navegador: Mozilla/5.0',
      'Documento firmado: h-viejo', 'El arrendador (dueño del espacio)', 'Pendiente', ' — se espera la firma de Don Pepe',
      'Copiar enlace de firma', 'Envíaselo al arrendador. Vence el', 'Volver a enviar a firma (archiva las firmas actuales)',
    ],
    ingles: ['Document frozen on', 'SHA-256 seal:', 'This contract already has signatures.', 'Signature invalidated', 'Signed by: ', 'Pending', 'Copy signature link', 'Send it again for signature (archives the current signatures)'],
  },
  {
    nombre: 'panel de firmas · el arrendador firmó, falta la arrendataria',
    pintar: async (idioma) => {
      forzar('PanelFirmas', 2, true)
      const P = await panel()
      return pintar(idioma, createElement(P, { contratoId: 'c1', inicial: ESTADO_FIRMAS_PENDIENTE as never, hayFaltantes: false, revision: REVISION as never }))
    },
    espanol: ['Firmada', 'Firmar como arrendataria', 'Las firmas actuales se anulan. La versión firmada queda archivada tal como se firmó.'],
    ingles: ['Signed', 'Sign as lessee', 'The current signatures are voided.'],
  },
  {
    nombre: 'panel de firmas · enviado sin firmas',
    pintar: async (idioma) => {
      const P = await panel()
      return pintar(idioma, createElement(P, { contratoId: 'c1', inicial: { ...ESTADO_FIRMAS_PENDIENTE, firmas: [{ ...FIRMA_BASE, parte: 'ARRENDATARIO', estatus: 'PENDIENTE' }] } as never, hayFaltantes: false, revision: REVISION as never }))
    },
    espanol: ['Volver a enviar a firma (reinicia las firmas)'],
    ingles: ['Send it again for signature (restarts the signatures)'],
  },
  {
    nombre: 'barra del documento con faltantes',
    pintar: async (idioma) => {
      const { BarraDocumento } = await import('../../components/demo/arrendadores/BarraDocumento')
      return pintar(idioma, createElement(BarraDocumento, {
        faltantes: [
          { etiqueta: 'RFC del arrendador', donde: 'Arrendadores › ficha del arrendador' },
          { etiqueta: 'Domicilio del arrendador', donde: 'Arrendadores › ficha del arrendador' },
          // Uno que la barra no conoce: se pinta tal cual en los dos idiomas.
          { etiqueta: 'Otro dato', donde: 'Otra sección' },
        ],
      }))
    },
    espanol: ['Imprimir o guardar como PDF', 'En el diálogo de impresión elige «Guardar como PDF» como destino.', 'Faltan 3 datos por capturar.', 'El documento los deja marcados en blanco en vez de inventarlos.', 'En Arrendadores › ficha del arrendador:', 'Domicilio del arrendador'],
    ingles: ['Print or save as PDF', '3 fields are missing.', 'In Landlords › landlord profile:', 'Landlord’s RFC (tax ID)', 'Landlord’s address', 'In Otra sección:', 'Otro dato'],
  },
  {
    nombre: 'barra del documento con un faltante',
    pintar: async (idioma) => {
      const { BarraDocumento } = await import('../../components/demo/arrendadores/BarraDocumento')
      return pintar(idioma, createElement(BarraDocumento, { faltantes: [{ etiqueta: 'Domicilio fiscal de tu empresa', donde: 'Administración › Datos fiscales de la empresa' }] }))
    },
    espanol: ['Faltan 1 dato por capturar.'],
    ingles: ['1 field is missing.', 'In Settings › Company tax details:', 'Your company’s tax address'],
  },
  {
    nombre: 'documento del contrato (Server Component)',
    pintar: async (idioma) => {
      servidor.idioma = idioma
      const { default: Doc } = await import('../../app/(app)/contrato/[id]/page')
      return pintar(idioma, await Doc({ params: { id: 'c1' } }))
    },
    espanol: [
      'CONTRATO DE ARRENDAMIENTO', 'DECLARACIONES', 'CLÁUSULAS', 'FIRMA INVALIDADA', 'EL ARRENDADOR',
      'Documento generado automáticamente por SPACE OS', 'Imprimir o guardar como PDF', 'Firma del contrato',
      // La constancia (decision del dueño, 2026-11-02: en el idioma configurado)
      'Constancia de firma electrónica', 'ATENCIÓN: el contrato fue modificado después de firmarse.',
      ' — FIRMA INVALIDADA', 'Fecha y hora: ', 'Dirección IP: 10.0.0.1', 'Navegador: Mozilla/5.0',
      'Sello del documento firmado: h-viejo', 'Firma electrónica simple.', 'Este documento fue sellado el ',
    ],
    // El documento se queda en espanol; lo que lo rodea —la barra, el panel y
    // la constancia— cambia.
    ingles: [
      'CONTRATO DE ARRENDAMIENTO', 'DECLARACIONES', 'CLÁUSULAS', 'FIRMA INVALIDADA', 'Print or save as PDF', 'Contract signature',
      'Electronic signature certificate', 'WARNING: the contract was modified after it was signed.', 'THE LESSEE',
      ' — SIGNATURE INVALIDATED', 'Date and time: October 20, 2026', 'IP address: 10.0.0.1', 'Browser: Mozilla/5.0',
      'Seal of the signed document: h-viejo', 'Simple electronic signature.', 'This document was sealed on October 19, 2026',
    ],
  },
  {
    nombre: 'documento del contrato · sin permiso',
    pintar: async (idioma) => {
      servidor.idioma = idioma
      servidor.permiso = false
      const { default: Doc } = await import('../../app/(app)/contrato/[id]/page')
      return pintar(idioma, await Doc({ params: { id: 'c1' } }))
    },
    espanol: ['No tienes permiso para ver este contrato.'],
    ingles: ['You don’t have permission to view this contract.'],
  },
  {
    nombre: 'firma pública · enlace no válido (Server Component)',
    pintar: async (idioma) => {
      servidor.idioma = idioma
      const { default: Firmar } = await import('../../app/(app)/firmar/[token]/page')
      return pintar(idioma, await Firmar({ params: { token: 'x' } }))
    },
    espanol: ['Enlace no válido', 'Este enlace de firma no existe o fue reemplazado por uno nuevo.'],
    ingles: ['Invalid link', 'This signature link doesn’t exist or was replaced by a new one.'],
  },
  {
    nombre: 'firma pública · para firmar',
    pintar: async (idioma) => {
      servidor.idioma = idioma
      servidor.firma = { documento: 'CONTRATO DE ARRENDAMIENTO\nTexto legal.', nombreEsperado: 'Don Pepe', expirado: false, yaFirmada: false, logoUrl: null }
      const { default: Firmar } = await import('../../app/(app)/firmar/[token]/page')
      return pintar(idioma, await Firmar({ params: { token: 'x' } }))
    },
    espanol: [
      'Lee el contrato completo. Al final encontrarás el espacio para firmarlo', 'CONTRATO DE ARRENDAMIENTO', 'Firmar electrónicamente',
      'Este contrato se envió a firma de', 'Escribe tu nombre completo', 'Nombre y apellidos', 'He leído el contrato en su totalidad',
      'Firmar contrato', 'Al firmar se registrará la fecha y hora',
    ],
    ingles: ['Read the whole contract.', 'CONTRATO DE ARRENDAMIENTO', 'Texto legal.', 'Sign electronically', 'Type your full name', 'Sign contract'],
  },
  {
    nombre: 'firma pública · recién firmado',
    pintar: async (idioma) => {
      forzar('FirmaPublica', 1, true) // acepta
      forzar('FirmaPublica', 3, true) // firmado
      const F = await publica()
      return pintar(idioma, createElement(F, { token: 't', documento: 'TEXTO', nombreEsperado: null, expirado: false, yaFirmada: false }))
    },
    espanol: ['Contrato firmado.', 'Se registró tu firma con la fecha y hora de este'],
    ingles: ['Contract signed.'],
  },
  {
    nombre: 'firma pública · ya firmada',
    pintar: async (idioma) => {
      const F = await publica()
      return pintar(idioma, createElement(F, { token: 't', documento: 'TEXTO', nombreEsperado: null, expirado: false, yaFirmada: true }))
    },
    espanol: ['Este contrato ya fue firmado con este enlace.'],
    ingles: ['This contract was already signed with this link.'],
  },
  {
    nombre: 'firma pública · expirada',
    pintar: async (idioma) => {
      const F = await publica()
      return pintar(idioma, createElement(F, { token: 't', documento: null, nombreEsperado: null, expirado: true, yaFirmada: false }))
    },
    espanol: ['El enlace expiró.', 'Pide al remitente que te envíe uno nuevo.', 'El enlace expiró', 'Por seguridad, el texto del contrato ya no se muestra desde este enlace.'],
    ingles: ['The link expired.', 'For security, the contract text is no longer shown from this link.'],
  },
  {
    nombre: 'firma pública · con error',
    pintar: async (idioma) => {
      forzar('FirmaPublica', 4, idioma === 'es' ? 'No se pudo firmar' : 'Could not sign') // error
      const F = await publica()
      return pintar(idioma, createElement(F, { token: 't', documento: 'TEXTO', nombreEsperado: null, expirado: false, yaFirmada: false }))
    },
    espanol: ['No se pudo firmar'],
    ingles: ['Could not sign'],
  },
  {
    nombre: 'razones sociales · cargando',
    pintar: async (idioma) => {
      const { default: P } = await import('../../app/(app)/(shell)/razones-sociales/page')
      return pintar(idioma, createElement(P))
    },
    espanol: ['Razones sociales', 'Las de tu empresa · con cuál pagas las rentas, compras los activos, tramitas licencias y'],
    // La pagina la tradujeron dos lotes; manda `admin.razones.*` (costura 2).
    ingles: ['Legal entities', 'Your company’s legal entities · which one pays rent, buys assets, handles permits and sells'],
  },
  {
    nombre: 'razones sociales · con datos',
    pintar: async (idioma) => {
      forzar('RazonesSocialesPage', 0, { entidades: [], catalogo: [] })
      const { default: P } = await import('../../app/(app)/(shell)/razones-sociales/page')
      return pintar(idioma, createElement(P))
    },
    espanol: ['[entidades]'],
    ingles: ['[entidades]'],
  },
]

describe('lote INVENTARIO Y ARRENDADORES · en ESPANOL sale el texto de siempre', () => {
  PANTALLAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito.
const COMUNES = new Set<string>([
  'Don Pepe', 'Navidad', 'Medios SA', 'Total', 'Digital', 'No', 'RFC', 'Predio', 'Pantalla digital', 'acuerdo-firmado.pdf',
  'Computer Vision / AdMobilize', 'IA/Vision', 'Slots (digital)', '.xlsx o .csv', 'UTF-8 (Universal)', 'error', 'TEXTO FIRMADO',
  '[entidades]', 'Imágenes (bulk)', 'Sitio', 'Total slots',
  'Latitud', // esta dentro de «Latitude»
  'Longitud', // esta dentro de «Longitude»
  'Mural', // igual en ingles (decision del lote de Comercial)
  'RFC: IPE800101AB1', // «RFC» no se traduce
  'RUC', // esta dentro de «RUC (tax ID)»
  'contacto@arrendador.com', // ejemplo de correo
  '601 — General de Ley Personas Morales', // regimen del SAT: un dato
  '601 - General de Ley Personas Morales',
  // El documento del contrato y lo que se imprime con el: espanol en los dos idiomas.
  // (la constancia de firma ya no: se traduce, decision del dueño del 2026-11-02)
  'CONTRATO DE ARRENDAMIENTO', 'DECLARACIONES', 'CLÁUSULAS', 'FIRMA INVALIDADA', 'EL ARRENDADOR',
  'Documento generado automáticamente por SPACE OS',
  'Sello SHA-256: hhh',
])

describe('lote INVENTARIO Y ARRENDADORES · en INGLES no queda ninguna frase espanola del lote', () => {
  PANTALLAS.forEach((p, i) => {
    it(p.nombre, async () => {
      const crudo = await p.pintar('en')
      // Con `I18N_VOLCAR_EN=<carpeta>`, el HTML ingles: sirve para revisarlo a ojo.
      const dir = process.env.I18N_VOLCAR_EN
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-en.html`), crudo)
      }
      const html = texto(crudo)
      expect(p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))).toEqual([])
      expect(p.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

// Lo que va en espanol POR DISENO se quita antes de los barridos del ingles.
function sinLoQueEsEspanolPorDiseno(crudo: string): string {
  return (
    crudo
      // el texto congelado que se firma
      .replace(/<pre class="doc-congelado">[\s\S]*?<\/pre>/g, '')
      // el documento del contrato (texto, encabezados y bloque de firmas con sus
      // sellos) hasta la constancia o el panel de firmas, que SI se traducen
      .replace(/<article class="doc-hoja">[\s\S]*?(?=<section class="doc-(?:constancia|panel-firma))/g, '')
      // el aviso de borrador, que se imprime con el documento
      .replace(/<p class="doc-aviso">[\s\S]*?<\/p>/g, '')
      // el error de formato de `CampoCifra` (`lib/captura-cifra.ts`, otro lote)
      .replace(/Escribe solo cifras: la coma separa miles y el punto, decimales\. Ejemplo: [\d,.]+/g, '')
  )
}

async function pintarTodasEnIngles(): Promise<string[]> {
  const htmls: string[] = []
  for (const p of PANTALLAS) {
    forzado.cola = []
    sesion.rol = 'DUENO'
    sesion.puede = true
    servidor.permiso = true
    servidor.firma = null
    datos.sitios = SITIOS
    datos.contratos = CONTRATOS
    datos.arrendadores = ARRENDADORES
    datos.pagos = PAGOS
    datos.licencias = LICENCIAS
    htmls.push(sinLoQueEsEspanolPorDiseno(await p.pintar('en')))
  }
  return htmls
}

describe('lote INVENTARIO Y ARRENDADORES · en ingles, ninguna fecha, hora ni importe con formato espanol', () => {
  // Segunda vuelta (validador, medio 1, mutante 5): quitar el idioma a un
  // `formatMonto` o a un `formatFecha` no deja ninguna frase espanola, asi que
  // el barrido de frases no lo veia. Esta guardia (`lib/i18n/guardias-ingles.ts`,
  // comun a todos los lotes desde la costura 2) busca esas huellas y las demas:
  // la fecha larga del panel de firmas (mutante E), el mes corto, el «02-nov»
  // y el «a. m.», en el texto y en los atributos que se leen.
  it('ningun estado ingles las lleva, salvo lo declarado', async () => {
    const htmls = await pintarTodasEnIngles()
    const huellas = htmls.flatMap((h, i) =>
      huellasDeFormatoEspanol(h, {
        // El importe que recita el paso de revision de firmas («$10,000.00 MXN»)
        // es el DATO que se congela con el contrato, no un formato de la interfaz.
        permitidos: [/\$[\d,.]+ MXN/],
      }).map((x) => `${PANTALLAS[i].nombre}: ${x}`),
    )
    expect(huellas).toEqual([])
  })
})

async function htmlInglesDeTodas(): Promise<string> {
  let html = ''
  for (const p of PANTALLAS) {
    forzado.cola = []
    sesion.rol = 'DUENO'
    sesion.puede = true
    servidor.permiso = true
    servidor.firma = null
    datos.sitios = SITIOS
    datos.contratos = CONTRATOS
    datos.arrendadores = ARRENDADORES
    datos.pagos = PAGOS
    datos.licencias = LICENCIAS
    const crudo = await p.pintar('en')
    const sinDocumento = sinLoQueEsEspanolPorDiseno(crudo)
    const visibles = [...sinDocumento.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
    html += texto(sinDocumento.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
  }
  return html
}

describe('lote INVENTARIO Y ARRENDADORES · barrido con el diccionario entero', () => {
  it('ninguna frase espanola de `textos/inventario.ts` ni `textos/arrendadores.ts` aparece en ingles', async () => {
    const { ES_INVENTARIO, EN_INVENTARIO } = await import('./textos/inventario')
    const { ES_ARRENDADORES, EN_ARRENDADORES } = await import('./textos/arrendadores')
    const ES: Record<string, string> = { ...ES_INVENTARIO, ...ES_ARRENDADORES }
    const EN: Record<string, string> = { ...EN_INVENTARIO, ...EN_ARRENDADORES }
    const html = await htmlInglesDeTodas()
    // Palabra entera: una arroba, un punto o un guion bajo pegados (un correo de
    // ejemplo, un nombre de archivo o de columna) no cuentan como texto de la interfaz.
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES)) {
      const en = EN[clave]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 8 || en.includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}@._-])${escapar(t)}($|[^\\p{L}@._-])`, 'u').test(html)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('ni las de los modulos compartidos (`textos/compartidos.ts`)', async () => {
    const { ES_COMPARTIDOS, EN_COMPARTIDOS } = await import('./textos/compartidos')
    const html = await htmlInglesDeTodas()
    const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_COMPARTIDOS)) {
      const en = EN_COMPARTIDOS[clave as keyof typeof EN_COMPARTIDOS]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        if (t.length < 4 || en.includes(t)) continue
        if (new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(html)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })
})
