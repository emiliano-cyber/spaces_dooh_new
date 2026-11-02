import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'

// ============================================================================
//  I18N · LOTE PILOTO «PROPUESTAS», RENDIDO DE VERDAD EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  Mismo patron que `pantallas.test.ts` (login y menu): se monta el componente
//  REAL dentro del proveedor, se rinde a HTML con `renderToStaticMarkup` y se
//  comprueba el texto. Dos cosas por pantalla:
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  Va en archivo aparte, y no dentro de `pantallas.test.ts`, por una razon
//  concreta: aqui se sustituye `useState` (ver abajo) y ese truco no debe
//  alcanzar a las pruebas del login y del menu.
//
//  ─── POR QUE SE FUERZA `useState` ──────────────────────────────────────────
//
//  `renderToStaticMarkup` no ejecuta efectos ni clics: un dialogo que se abre
//  al pulsar «Nueva propuesta», una fila que se despliega o un tablero que pide
//  sus cifras en un `useEffect` NO se pintan nunca. Sin DOM (este repo no tiene
//  jsdom, a proposito: `vitest.config.ts`), la unica forma de rendir esas
//  ramas es arrancar el estado ya en el valor que tendrian tras el clic. Para
//  eso `useState` se envuelve: si hay un valor FORZADO en la cola y su
//  predicado casa con el valor inicial de la llamada, se usa ese. Todo lo demas
//  es el `useState` de React sin tocar.
//
//  ─── LO QUE NO VE, DICHO SIN ADORNOS ───────────────────────────────────────
//
//  Los textos que llegan de modulos COMPARTIDOS fuera del lote
//  (`lib/periodos.ts`, `lib/codigo-aprobacion.ts`, `AvisoFranjaCMS`,
//  `OPCIONES_PERIODO`…) siguen en espanol y NO se comprueban aqui: son de otro
//  lote. Los mensajes de error que manda el servidor van por I18N-05.
// ============================================================================

const forzado = vi.hoisted(() => ({
  cola: [] as Array<{ si: (inicial: unknown) => boolean; valor: unknown }>,
}))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const cabeza = forzado.cola[0]
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    if (cabeza && cabeza.si(valorInicial)) {
      forzado.cola.shift()
      return real.useState(cabeza.valor)
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/propuestas',
  notFound: () => {
    throw new Error('notFound')
  },
}))

const cabeceras = vi.hoisted(() => ({ cookie: null as string | null, accept: null as string | null }))
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (n: string) =>
      n === 'spaces_idioma' && cabeceras.cookie ? { value: cabeceras.cookie } : undefined,
  }),
  headers: () => ({
    get: (n: string) => (n === 'accept-language' ? cabeceras.accept : null),
  }),
}))

// El modal real va por un portal de Radix, que en el servidor no pinta nada.
// Se sustituye por su contenido en linea: lo que se mide es el TEXTO.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement(
          'div',
          null,
          createElement('h2', null, p.title),
          p.subtitle ? createElement('p', null, p.subtitle) : null,
          p.children as never,
          p.footer as never,
        )
      : null,
}))

// La tarjeta plegable recuerda su estado en el navegador y puede arrancar
// plegada: aqui se pinta siempre entera.
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; subtitulo?: unknown; resumen?: unknown; accion?: unknown; children?: unknown }) =>
    createElement(
      'section',
      null,
      createElement('h3', null, p.titulo),
      p.subtitulo as never,
      p.resumen as never,
      p.accion as never,
      p.children as never,
    ),
}))

// MapLibre no existe en node, y el mapa no lleva texto del lote.
vi.mock('@/components/demo/MapView', () => ({ MapView: () => createElement('div', null, '[mapa]') }))

vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => true }))

// ─── Datos de prueba ────────────────────────────────────────────────────────
const SITIO_DIGITAL = {
  id: 's1', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL', esRotativo: false,
  exhibicion: 'digital', estatusComercial: 'DISPONIBLE', lat: 19.4, lng: -99.1, alcaldia: 'Cuauhtémoc',
  propio: false, totalSpots: 8, spotsDisponibles: 6, duracionSpotSeg: 10, horario: 'basura',
  modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 1000 }], tarifaPublicada: 0,
  arrendadorId: null, predioId: null, cpm: null,
}
const SITIO_FIJO = {
  id: 's2', nombre: 'Muro Insurgentes', tipoMedio: 'ESPECTACULAR', esRotativo: false,
  exhibicion: 'fija', estatusComercial: 'DISPONIBLE', lat: 0, lng: 0, alcaldia: 'Benito Juárez',
  propio: true, totalSpots: null, spotsDisponibles: null, duracionSpotSeg: null, horario: '',
  modalidadesDetalle: [{ unidad: 'mensual', tarifaPublicada: 5000 }], tarifaPublicada: 5000,
  arrendadorId: null, predioId: null,
}
const ITEM_BASE = {
  propuestaId: 'p1', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', unidad: 'mensual', cantidad: 1,
  tarifaUnitaria: 1000, spotsPorDia: null, franjaId: null,
}
const PROPUESTA = {
  id: 'p1', folio: 'PR-0001', tokenPublico: 'tok', clienteId: 'c1', agenciaId: 'a1', nombre: 'Campaña Navidad',
  fecha: '2026-10-01', estatus: 'ENVIADA', comisionPct: 15, descuentoPct: 5, version: 2, notas: null,
  creadoEn: '2026-10-01', condiciones: 'Pago a 30 días.', vigenteHasta: '2026-12-01', vencida: false,
  items: [
    { ...ITEM_BASE, id: 'i1', sitioId: 's1', precio: 1000, aprobado: true, precioAjustadoPor: 'u1',
      tarifaCalculada: 900, precioAjustadoPorNombre: null },
    { ...ITEM_BASE, id: 'i2', sitioId: 's2', precio: 5000, aprobado: false },
  ],
  bruto: 6000, descuentoVolumenPct: 2.5, descuentoVolumenMonto: 150,
  paquete: { nombre: 'Combo', precio: 5500, admiteCodigo: false, avisoComposicion: null,
    sitios: [{ sitioId: 's1', parte: 1000 }] },
  brutoConVolumen: 5850, descuentoMonto: 100, codigoTexto: 'VERANO20', codigoDescuentoPct: 20,
  codigoDescuentoMonto: 50, codigoEstado: 'PENDIENTE', baseComercial: 5750, base: 5700, divisor: 0.85,
  neto: 4845, iva: 912, total: 6612, itemsAprobados: 1, brutoAprobado: 1000, descuentoVolumenMontoAprobado: 0,
  codigoDescuentoMontoAprobado: 0, baseAprobado: 1000, netoAprobado: 850, ivaAprobado: 160, totalAprobado: 1160,
}
const CLIENTES = [
  { id: 'c1', nombre: 'Refrescos del Norte', tipo: 'DIRECTO', ivaPct: 8, agenciaId: null,
    contacto: { email: 'compras@norte.mx' } },
  { id: 'a1', nombre: 'Agencia Uno', tipo: 'AGENCIA', ivaPct: 16, comisionAgenciaPct: 15,
    tieneNegociacion: true, negociacionValidada: false },
]
const FUNNEL = {
  total: 4, borrador: 1, enviadas: 1, aprobadas: 1, rechazadas: 1, pipelineValue: 12000,
  ganadoValue: 8000, perdidoValue: 3000, winRate: 0.5, conversion: 0.5,
}

const datos = vi.hoisted(() => ({ propuestas: [] as unknown[] }))
vi.mock('@/lib/data/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/data/client')>()
  return {
    ...real,
    usePropuestas: () => datos.propuestas,
    useFunnelPropuestas: () => FUNNEL,
    useClientes: () => CLIENTES,
    useSitios: () => [SITIO_DIGITAL, SITIO_FIJO],
    useCampanas: () => [],
    useContratos: () => [],
    useArrendadores: () => [{ id: 'ar1', nombre: 'Don Pepe' }],
    useReservas: () => [],
    useConfigNegocio: () => ({ topeDescuentoPct: 30, spotSeg: 10 }),
  }
})

// El documento imprimible es un Server Component con sesion y base: se le dan
// las respuestas que necesita para pintar.
vi.mock('@/lib/server/auth', () => ({ exigir: async () => ({ ok: true }) }))
vi.mock('@/lib/server/db', () => ({ q1: async () => ({ token_publico: 'tok' }) }))
vi.mock('@/lib/server/tenant', () => ({ tenantActual: async () => 't1' }))
// ADR 0048 · el documento imprimible pide la moneda de la instancia a la base.
vi.mock('@/lib/server/moneda-instancia', () => ({ monedaDeLaInstancia: async () => 'MXN' }))
vi.mock('@/lib/server/propuestas-repo', () => ({
  obtenerPropuestaPublica: async () => ({
    ...PROPUESTA, orgNombre: 'Medios SA', orgLogoUrl: null, clienteNombre: 'Refrescos del Norte',
    agenciaNombre: 'Agencia Uno', aceptadoEn: null, aceptadoPor: null,
    items: [
      { sitioNombre: 'Pantalla Reforma', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 1000,
        lat: 19.4, lng: -99.1, alcaldia: 'Cuauhtémoc', ciudad: 'CDMX', estado: null, direccion: 'Reforma 1',
        tipoMedio: 'PANTALLA_DIGITAL', franjaId: 'f1', franjaNombre: null, franjaHorario: null },
      { sitioNombre: 'Muro', fechaInicio: '2026-11-01', fechaFin: '2026-11-30', precio: 5000,
        lat: null, lng: null, tipoMedio: 'ESPECTACULAR', franjaId: null },
    ],
  }),
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  datos.propuestas = [PROPUESTA]
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}

// El HTML escapa comillas y apostrofos; se comparan textos, no marcado.
function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const forzar = (si: (v: unknown) => boolean, valor: unknown) => forzado.cola.push({ si, valor })
const esNull = (v: unknown) => v === null
const esFalse = (v: unknown) => v === false

// ─── Las pantallas ──────────────────────────────────────────────────────────
type Pantalla = {
  nombre: string
  pintar: (idioma: Idioma) => Promise<string>
  /** Texto espanol que TIENE que salir en `es` (y no en `en`). */
  espanol: string[]
  /** Texto ingles que tiene que salir en `en`. */
  ingles: string[]
}

const PANTALLAS: Pantalla[] = [
  {
    nombre: 'lista de propuestas (con una fila desplegada)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, null) // modo
      forzar(esNull, 'p1') // abierta
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Cotizaciones con método del divisor (bruto / neto)',
      'Nueva propuesta',
      'En pipeline',
      '2 propuestas en borrador o enviadas · total c/IVA',
      'Enviadas sin respuesta',
      'esperan que el cliente apruebe o rechace',
      'Ganado (histórico)',
      '1 aprobada · perdido',
      'en 1 rechazada',
      'Tasa de cierre histórica',
      'aprobadas sobre 2 cerradas, desde siempre',
      'Lista de propuestas',
      'Todos los clientes',
      'Folio o nombre…',
      'Embudo histórico',
      'Perdidas',
      'Cupón pendiente',
      'El código VERANO20 espera aprobación; el cliente todavía no lo ve',
      ' · vía ',
      '2 sitios',
      'total c/IVA',
      'Abrir',
      'Bruto (lista)',
      'Comisión 15% · divisor 0.85',
      'Neto propuesto',
      'Aprobado · 1/2 sitios',
      'Neto aprobado',
      'aprobado',
      'Rechazar',
      'Resumen de propuestas',
    ],
    ingles: ['New proposal', 'Proposal list', 'All clients', 'Historical funnel', 'Negotiation code pending', 'Nov 1, 2026 – Nov 30, 2026'],
  },
  {
    nombre: 'nueva propuesta (el dialogo de alta)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esFalse, true) // nuevoOpen
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Selecciona sitios; el método del divisor calcula bruto → neto',
      'Nombre de la propuesta',
      '— Sin cliente —',
      '— Sin agencia (directo) —',
      'Duración de la campaña',
      'Hasta (se calcula de la duración, o escríbela)',
      'Comisión de la agencia (%)',
      'Sitios (0)',
      'Lista',
      'Mapa',
      'Fija',
      'Crear propuesta',
      'Total c/IVA:',
      'Divisor (0%)',
    ],
    ingles: ['Create proposal', 'Proposal name', 'Campaign duration'],
  },
  {
    nombre: 'duplicar propuesta (con la contratacion por sitio)',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Duplicar propuesta',
      'Mismos sitios y contratación; los precios se calculan con la tarifa de hoy.',
      'La negociación con «Agencia Uno» no está validada',
      'Valida la negociación de la agencia en Clientes para poder crear la propuesta.',
      'Contratación por sitio',
      'Calculadora de spots',
      'Apagada: la cantidad de spots se captura a mano.',
      'Renta al arrendador',
      'Arrendador…',
      '⚠ Falta el importe: el contrato nacerá pendiente y no se generará el calendario de pagos.',
      'Pantalla propia',
      'sin renta · su costo es luz y operación',
      'Fija · sin spots',
      'Sitios (2)',
    ],
    ingles: ['Duplicate proposal', 'Per-site booking', 'Spot calculator', 'Rent to landlord'],
  },
  {
    nombre: 'agregar sitios a una propuesta',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'agregar', propuesta: PROPUESTA })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Agregar sitios a «Campaña Navidad»',
      'Ya está enviada: agregar sitios sube la versión (renegociación).',
      'Periodo de la propuesta:',
      'Los sitios nuevos se cotizan con esas fechas y con la tarifa de hoy.',
      'Agregar sitios',
    ],
    ingles: ['Add sites to “Campaña Navidad”', 'Proposal period:'],
  },
  {
    nombre: 'ficha de la propuesta',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      'Válida hasta 01/12/2026',
      'Folio interno:',
      '· el cliente accede solo por la liga (token)',
      'Copiar liga',
      'Duplicar',
      'Generar PDF',
      'Reenviar',
      'Aprobar',
      'Rechazar',
      'Fechas',
      'Anunciante',
      'Agencia</div>', // el rotulo, no el nombre del cliente «Agencia Uno»
      'Comisión',
      'Resumen económico',
      'Total c/IVA',
      'lo que paga el cliente · 2 sitios',
      'Neto para el medio',
      'después de 15% de comisión de agencia',
      'Renta de referencia',
      'ninguna pantalla tiene renta capturada',
      'total c/IVA · 1 de 2 sitios',
      'Bruto (tarifa de lista)',
      'Paquete "Combo" — precio del conjunto',
      'Descuento por volumen (2.5%)',
      'Descuento comercial (5.00%)',
      'Código VERANO20 (20%) · cupón pendiente de aprobación',
      'Base con descuento',
      'Comisión de agencia (15%) · divisor ×0.85',
      'Neto (para el medio)',
      'Total que paga el cliente',
      'Sobre lo aprobado · 1/2 sitios',
      'Descuento comercial',
      'Rebaja sobre la tarifa de lista (distinta de la comisión de agencia).',
      'sube la versión (renegociación).',
      'Tu organización autoriza hasta',
      'Administración tiene que subir el tope.',
      'versión actual: v2',
      'Paquete cerrado',
      'Esta propuesta se vende como el paquete',
      'Es precio final: no admite descuento por volumen ni código de negociación.',
      'Quitar paquete',
      'Quitarlo devuelve los precios de lista de cada pantalla.',
      'Sitios y renta',
      'Renta total ref.',
      'Ya está enviada: agregar o quitar sitios sube la versión.',
      'Arrendador · renta',
      'Contratación',
      'Precio propuesta',
      'Sin contrato de renta',
      'Tarifa calculada',
      ' · ajustada por ',
      'un usuario dado de baja',
      'Quitar de la propuesta',
      'Condiciones y vigencia',
      'Ubicación de las pantallas',
      '1 de 2 pantallas no tienen coordenadas y no aparecen en el mapa.',
      'Borrador',
      'Enviada',
    ],
    ingles: [
      'Internal ref.:',
      'Copy link',
      'Financial summary',
      'Sites and rent',
      'Draft',
      'Sent',
      // Fecha en formato ingles, sin ambiguedad (decision del dueno, 2026-11-02).
      'Valid until Dec 1, 2026',
      'Negotiation code VERANO20 (20%) · pending approval',
      'to go higher, an admin has to raise the cap in Settings',
      'Screens without coordinates (not shown on the map): 1 of 2 screens.',
    ],
  },
  {
    nombre: 'bloque del codigo promocional, pendiente',
    pintar: async (idioma) => {
      const { BloqueCodigoPropuesta } = await import('../../components/demo/codigos/BloqueCodigoPropuesta')
      return pintar(
        idioma,
        createElement(BloqueCodigoPropuesta, {
          propuestaId: 'p1', estatus: 'ENVIADA', codigoTexto: 'VERANO20', codigoDescuentoPct: 20,
          codigoEstado: 'PENDIENTE', puedeEditar: true,
        }),
      )
    },
    espanol: [
      'Código de negociación',
      'Esta propuesta lleva el código',
      'que ya está congelado: si el código cambia o se borra, este precio no se mueve.',
      'El cliente todavía no lo ve:',
      'Mientras esté pendiente, la propuesta no se puede aprobar por dentro.',
      'Quitar código',
      'Quitarlo devuelve su uso al cupón.',
    ],
    ingles: ['Negotiation code', 'Remove code', '<b>20%</b> off, locked in'],
  },
  {
    nombre: 'bloque del codigo promocional, sin codigo y rechazada',
    pintar: async (idioma) => {
      const { BloqueCodigoPropuesta } = await import('../../components/demo/codigos/BloqueCodigoPropuesta')
      return pintar(
        idioma,
        createElement(BloqueCodigoPropuesta, {
          propuestaId: 'p1', estatus: 'RECHAZADA', codigoTexto: null, codigoDescuentoPct: 0,
          codigoEstado: null, puedeEditar: true,
        }),
      )
    },
    espanol: [
      'Se aplica',
      'del descuento comercial y se',
      'con él: un 20 % y un 20 % dejan al cliente pagando el 64 %, no el 60 %.',
      'pendiente de aprobación',
      'Esta propuesta está rechazada:',
      'aplicar un cupón la reactiva a borrador.',
      'Aplicar',
    ],
    ingles: ['Apply'],
  },
  {
    nombre: 'condiciones y vigencia',
    pintar: async (idioma) => {
      const { BloqueCondicionesVigencia } = await import('../../components/demo/propuestas/BloqueCondicionesVigencia')
      return pintar(
        idioma,
        createElement(BloqueCondicionesVigencia, {
          propuestaId: 'p1', condiciones: null, vigenteHasta: '2026-12-01', vencida: false, editable: true,
        }),
      )
    },
    espanol: [
      'Vigencia',
      'El cliente puede aceptarla hasta el 01/12/2026 (ese día incluido).',
      'Términos y condiciones',
      'Salen al final del documento y en la liga del cliente.',
      'Sin condiciones: el documento no lleva este bloque.',
      'Guardar',
    ],
    ingles: ['Validity', 'Terms and conditions', 'The client can accept it until Dec 1, 2026 (inclusive).'],
  },
  {
    nombre: 'enviar propuesta',
    pintar: async (idioma) => {
      const { EnviarPropuestaDialog } = await import('../../components/demo/propuestas/EnviarPropuestaDialog')
      return pintar(
        idioma,
        createElement(EnviarPropuestaDialog, {
          open: true, onOpenChange: () => {}, propuestaId: 'p1', correoCliente: null, reenvio: true,
          onSinCorreo: () => {},
        }),
      )
    },
    espanol: [
      'Reenviar propuesta',
      'El cliente recibe la liga para revisarla y aceptarla. Tú recibes copia.',
      'Correo del cliente',
      'Mensaje (opcional)',
      'Unas líneas para el cliente; van antes del botón de la liga.',
      'Si la propuesta ya venció, reenviarla le da una vigencia nueva.',
    ],
    ingles: ['Resend proposal', 'Client email'],
  },
  {
    nombre: 'elegir cliente',
    pintar: async (idioma) => {
      const { ElegirClienteDialog } = await import('../../components/demo/propuestas/ElegirClienteDialog')
      return pintar(
        idioma,
        createElement(ElegirClienteDialog, {
          open: true, onOpenChange: () => {}, clientes: CLIENTES as never, onElegir: async () => {},
        }),
      )
    },
    espanol: [
      '¿A qué cliente se le factura?',
      'La propuesta se aprobó sin cliente. Elígelo para generar la campaña; después ya no se cambia.',
      'Poner cliente y generar campaña',
      '— Elige el cliente —',
      'Refrescos del Norte (IVA 8 %)',
    ],
    ingles: ['Which client should be billed?', 'Set client and generate campaign'],
  },
  {
    nombre: 'tablero de propuestas por periodo',
    pintar: async (idioma) => {
      const { TableroPropuestas } = await import('../../components/demo/propuestas/TableroPropuestas')
      forzar(esNull, {
        periodo: { etiqueta: 'Este mes', desde: '2026-11-01', hasta: '2026-11-30' },
        conGanancia: true,
        resumen: {
          generadas: 3, rechazadas: 1, tasaCierre: 0.5,
          aprobadas: { n: 2, venta: 0, ganancia: null, margenPct: null, gananciaPromedio: null, sinCosto: 2 },
          porVendedor: [{ vendedor: 'Ana', generadas: 3, aprobadas: 2, rechazadas: 1, venta: 0, ganancia: 0 }],
          lista: [{ id: 'p1', folio: 'PR-0001', nombre: 'Campaña Navidad', vendedor: null, aprobada: '2026-11-02',
            venta: null, costoRenta: null, ganancia: null }],
        },
      })
      return pintar(idioma, createElement(TableroPropuestas))
    },
    espanol: [
      'Resumen de propuestas',
      'Generadas',
      'creadas en el periodo',
      'venta —, sin calcular en estas propuestas',
      'Tasa de cierre del periodo',
      'aprobadas de las decididas en este periodo',
      'Ganancia por aprobada',
      'sin calcular: falta la venta o la renta',
      'venta − renta de las pantallas',
      '2 aprobadas tienen alguna pantalla sin contrato de renta vigente: cuentan en la venta, pero no en la ganancia.',
      'Vendedor',
      'Venta sin IVA',
      'Aprobadas del periodo',
      'sin contrato',
    ],
    ingles: ['Proposal summary', 'Sales rep', 'Sales excl. VAT', 'Approved on', 'Nov 2, 2026', 'Internal ref.'],
  },
  {
    nombre: 'entrada publica por codigo',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/propuesta/page')
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Propuestas comerciales',
      'Ver tu propuesta',
      'Ingresa el código que te compartimos para ver tu propuesta.',
      'p. ej. PR-A0BC4F',
      'Ver propuesta',
      'Spaces · propuestas comerciales · acceso de solo lectura por código',
    ],
    ingles: ['View your proposal', 'View proposal'],
  },
  {
    nombre: 'barra y QR del documento imprimible',
    pintar: async (idioma) => {
      const { BarraDocumentoPropuesta, LigaConQr } = await import(
        '../../components/demo/propuestas/DocumentoPropuestaCliente'
      )
      forzar((v) => v === '', 'https://ejemplo.mx/spaces-dooh/p/tok/') // liga
      return pintar(
        idioma,
        createElement(
          'div',
          null,
          createElement(BarraDocumentoPropuesta, { volverA: '/propuestas/p1' }),
          createElement(LigaConQr, { token: 'tok', aceptable: true }),
        ),
      )
    },
    espanol: [
      'Volver a la propuesta',
      'Imprimir o guardar como PDF',
      'En el diálogo de impresión elige «Guardar como PDF». Espera a que cargue el mapa antes de imprimir.',
      'Acéptala en línea',
      'Escanea el código o abre esta dirección para revisar la propuesta y aceptarla:',
    ],
    ingles: ['Back to the proposal', 'Accept it online'],
  },
  {
    nombre: 'documento imprimible (Server Component)',
    pintar: async (idioma) => {
      // El idioma de un Server Component lo decide `idiomaDeLaPeticion()`,
      // como en el layout raiz: aqui entra por la cookie.
      cabeceras.cookie = idioma
      const { default: Documento } = await import('../../app/(app)/propuesta/[id]/page')
      const el = await Documento({ params: { id: 'p1' } })
      // Las piezas de cliente del documento (la barra, el QR) leen el idioma
      // del proveedor que pone el layout raiz; aqui se pone igual.
      return pintar(idioma, el)
    },
    espanol: [
      'PROPUESTA COMERCIAL',
      'Para',
      ' · vía Agencia Uno',
      'Periodo',
      'Vigencia',
      'Válida hasta el 01/12/2026',
      'PANTALLAS',
      'Pantalla y ubicación',
      'Importe',
      'Sin foto',
      '· Franja',
      'UBICACIÓN',
      '1 pantalla(s) sin coordenadas; su dirección está en la tabla.',
      'IMPORTE',
      'Bruto (tarifa de lista)',
      'Descuento (5%)',
      'Comisión de agencia (15%)',
      'TÉRMINOS Y CONDICIONES',
      'ACEPTA EL CLIENTE',
      'Nombre, firma y fecha',
    ],
    ingles: ['COMMERCIAL PROPOSAL', 'SCREENS', 'CLIENT ACCEPTANCE', 'Valid until Dec 1, 2026', 'Prepared for'],
  },
  {
    nombre: 'lista filtrada sin resultados',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      const esVacio = (v: unknown) => v === ''
      forzar(esVacio, 'APROBADA') // filtroEstatus
      forzar(esVacio, 'c1') // filtroCliente
      forzar(esVacio, 'xyz') // busqueda
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Ninguna propuesta aprobada de Refrescos del Norte que coincida con «xyz». Quita el filtro para ver las 1.'],
    ingles: ['Clear the filter'],
  },
  {
    nombre: 'lista vacia',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      datos.propuestas = []
      return pintar(idioma, createElement(Pagina))
    },
    espanol: ['Aún no hay propuestas. Arma la primera con «Nueva propuesta».'],
    ingles: ['No proposals yet.'],
  },
  {
    nombre: 'calculadora de spots encendida',
    pintar: async (idioma) => {
      const { default: Pagina } = await import('../../app/(app)/(shell)/propuestas/page')
      forzar(esNull, { tipo: 'duplicar', propuesta: PROPUESTA })
      forzar((v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0, {
        s1: {
          unidad: 'spot', cantidadManual: 1, spotsPorDia: '', rentaMonto: '500', rentaPeriodicidad: 'MENSUAL',
          rentaArrendadorId: '', franjaId: '', tarifaManual: '', manual: false, espacios: '2', horasDia: '',
          roadblock: false, prima: '',
        },
      })
      return pintar(idioma, createElement(Pagina))
    },
    espanol: [
      'Espacios del loop',
      'libres',
      'Horas al día',
      'Prima %',
      'Porcentaje encima de la tarifa por spot. Queda como ajuste a tu nombre.',
      'No se entiende el horario de la pantalla («basura»): se toman 18 h al día.',
      'La pantalla no tiene tarifa mensual: el precio por spot sale de ella. Pide a un gerente que lo ponga.',
      '⚠ La renta ($ 500.00) iguala o supera lo que le cobras al cliente ($ 0.00): la campaña saldría a pérdida. Aquí va lo que le pagas al PROPIETARIO, no el precio de venta.',
      'Programación que sale de la calculadora',
      'Salidas que salen de la calculadora de abajo',
    ],
    ingles: ['Loop slots', 'Hours per day', 'loops/h'],
  },
  {
    nombre: 'ficha de un borrador vencido, con catalogo de paquetes',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      datos.propuestas = [
        { ...PROPUESTA, estatus: 'BORRADOR', vencida: true, paquete: null, codigoTexto: null, codigoEstado: null,
          codigoDescuentoMonto: 0, descuentoVolumenMonto: 0, itemsAprobados: 0, agenciaId: null, comisionPct: 0,
          divisor: 1 },
      ]
      forzar((v) => Array.isArray(v) && v.length === 0, [
        { id: 'k1', nombre: 'Combo', precioCerrado: 5000, sitios: [{}, {}], activo: true },
      ])
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      'Vencida el 01/12/2026',
      'Directa',
      'venta directa, sin comisión',
      'ningún sitio aprobado de 2',
      'Aún no se aprueba ningún sitio: marca las casillas de la tabla «Sitios y renta».',
      'sustituye',
      'la suma de las tarifas de lista: no la descuenta, la reemplaza.',
      'Elige un paquete…',
      'Combo — ',
      ' · 2 pantallas',
      'Solo los borradores se pueden borrar',
      'Borrar',
      'Enviar',
    ],
    ingles: ['Expired on', 'Choose a bundle…'],
  },
  {
    nombre: 'ficha de una aprobada',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      datos.propuestas = [{ ...PROPUESTA, estatus: 'APROBADA', paquete: null, codigoTexto: null, codigoEstado: null }]
      return pintar(idioma, createElement(Ficha, { params: { id: 'p1' } }))
    },
    espanol: [
      'La propuesta ya está aprobada; el descuento quedó fijo.',
      'La propuesta ya está aprobada; no admite paquete.',
      'Generar campaña',
      'Aprobada',
    ],
    ingles: ['Generate campaign', 'Approved'],
  },
  {
    nombre: 'ficha de una propuesta que no existe',
    pintar: async (idioma) => {
      const { default: Ficha } = await import('../../app/(app)/(shell)/propuestas/[id]/page')
      return pintar(idioma, createElement(Ficha, { params: { id: 'nada' } }))
    },
    espanol: ['Propuesta no encontrada.', 'Volver a propuestas'],
    ingles: ['Proposal not found.'],
  },
]

describe('lote PROPUESTAS · en ESPANOL sale el texto de siempre', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudo = await p.pintar('es')
      const html = texto(crudo)
      const faltan = p.espanol.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  }
})

describe('lote PROPUESTAS · en INGLES no queda ninguna frase espanola del lote', () => {
  for (const p of PANTALLAS) {
    it(p.nombre, async () => {
      const crudoEn = await p.pintar('en')
      const html = texto(crudoEn)
      // Las frases que coinciden en los dos idiomas (un «Roadblock», un folio,
      // un nombre de cliente) no cuentan: solo las que el ingles debe cambiar.
      const quedan = p.espanol.filter((f) => html.includes(f) && !COMUNES.has(f))
      expect(quedan).toEqual([])
      const faltan = p.ingles.filter((f) => !html.includes(f))
      expect(faltan).toEqual([])
    })
  }
})

describe('lote PROPUESTAS · barrido con el diccionario entero', () => {
  it('ninguna frase espanola del diccionario del lote aparece en las pantallas en ingles', async () => {
    // La lista de arriba es a mano y se puede quedar corta. Esta usa el
    // diccionario: de cada texto espanol del lote se sacan los trozos fijos
    // (lo que hay entre huecos) y se buscan en el HTML ingles de TODAS las
    // pantallas. Un `t()` olvidado deja su frase espanola a la vista y cae aqui.
    const { ES_PROPUESTAS, EN_PROPUESTAS } = await import('./textos/propuestas')
    // Solo lo que se LEE: nodos de texto y los atributos visibles. Las rutas
    // (`href="/propuestas/p1"`) y las clases no son texto de pantalla.
    let html = ''
    for (const p of PANTALLAS) {
      const crudo = await p.pintar('en')
      const visibles = [...crudo.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1])
      html += texto(crudo.replace(/<[^>]*>/g, '\n') + '\n' + visibles.join('\n'))
    }
    // El aviso de la franja sale de `lib/rejilla.ts`, que es de otro lote, y
    // dice «pantalla»: se quita para no confundirlo con un `t()` olvidado.
    const { AVISO_FRANJA_NO_VIAJA_AL_CMS } = await import('../rejilla')
    html = html.split(AVISO_FRANJA_NO_VIAJA_AL_CMS).join('\n')
    const culpables: string[] = []
    for (const [clave, es] of Object.entries(ES_PROPUESTAS)) {
      const en = EN_PROPUESTAS[clave as keyof typeof EN_PROPUESTAS]
      for (const trozo of es.split(/\{\w+\}/)) {
        const t = trozo.trim()
        // Trozos cortos («de», «Total») chocan con texto ingles o con datos.
        if (t.length < 8 || en.includes(t)) continue
        // El codigo de ejemplo coincide con el del dato de prueba.
        if (clave === 'propuestas.codigo.ejemplo') continue
        if (html.includes(t)) culpables.push(`${clave} · «${t}»`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('el espanol de los estatus reproduce EXACTAMENTE el label de `estatus.ts`', async () => {
    // Igual que el menu con `nav.ts`: `EST[e].label` sigue siendo la verdad en
    // espanol, y si alguien lo cambia alli esta prueba obliga a traerlo aqui.
    const { EST, CLAVE_ESTATUS, ORDEN_ESTATUS } = await import('../../components/demo/propuestas/estatus')
    const { DICCIONARIOS } = await import('./diccionario')
    for (const e of ORDEN_ESTATUS) expect(DICCIONARIOS.es[CLAVE_ESTATUS[e]]).toBe(EST[e].label)
  })
})

// Fragmentos de la lista espanola que son IGUALES en ingles a proposito: datos
// (nombres, folios) o palabras que el glosario deja sin traducir.
const COMUNES = new Set<string>([
  'Divisor (0%)', // «divisor» es el nombre del metodo, igual en los dos
  'Combo — ', // el nombre del paquete es un dato
])
