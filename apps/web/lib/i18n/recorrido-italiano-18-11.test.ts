import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { DICCIONARIOS, type ClaveTexto } from './diccionario'
import { FichaOportunidad } from '@/components/demo/crm/FichaOportunidad'
import { valorDeCambio } from '@/components/demo/crm/etiquetas'
import { medidaEnIdioma } from '@/components/operaciones/ArteEnSitio'
import { etiquetaModulo } from '@/components/demo/admin/etiqueta-modulo'
import type { FichaOportunidad as Ficha } from '@/lib/data/oportunidades-api'
import type { Propuesta } from '@/lib/data/client'

// ============================================================================
//  Recorrido del italiano en el navegador (2026-11-18).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «no todo está traducido: hay pedazos en español». Las
//  pruebas de cobertura pasaban (6438/6438 claves en italiano), así que lo que
//  se colaba no era una clave sin traducir sino un VALOR pintado tal cual o
//  una cifra con el formato de otro idioma. Cada caso es algo que el recorrido
//  con `it@hoy.test` vio salir así, y fija también el español, que no cambia.
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/crm/oportunidades/o1',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  process.env.IDIOMA_ITALIANO = '1'
  process.env.IDIOMA_PORTUGUES = '1'
})

const t = (idioma: Idioma) => (k: ClaveTexto) => DICCIONARIOS[idioma][k]

// ─── La ficha de una oportunidad (Propuestas → Seguimiento) ─────────────────

const FICHA: Ficha = {
  id: 'o1',
  etapa: 'COTIZANDO',
  nombre: 'Verano 2027',
  prospectoId: null,
  prospectoNombre: null,
  clienteId: 'c1',
  clienteNombre: 'Cervecería del Norte',
  usuarioId: 'u1',
  vendedorNombre: 'Ana',
  presupuestoMin: 75000,
  presupuestoMax: 80000,
  fechaInicioDeseada: '2027-06-01',
  fechaFinDeseada: '2027-06-30',
  fechaDecision: null,
  plazas: 'Tijuana',
  tiposMedio: ['PANTALLA_DIGITAL'],
  objetivo: 'Temporada',
  motivoPerdida: null,
  ganadaEn: null,
  perdidaEn: null,
  cotizaciones: 1,
  ultimaActividadEn: null,
  creadoEn: '2026-11-18T18:00:00.000Z',
  actualizadoEn: '2026-11-18T18:00:00.000Z',
  actividades: [],
  propuestas: [{ id: 'p1', folio: 'PR-2026-0017', nombre: 'Verano', estatus: 'ENVIADA', version: 1, creadoEn: '2026-11-18T18:00:00.000Z' }],
  // Los tres cambios que el recorrido vio en la línea de tiempo: el estatus y
  // la vigencia al enviarla, y un descuento con decimales.
  cambios: [
    { id: 'c1', propuestaId: 'p1', folio: 'PR-2026-0017', version: 1, usuarioNombre: 'Ana', origen: 'APP', accion: 'ENVIAR', campo: 'estatus', valorAnterior: 'BORRADOR', valorNuevo: 'ENVIADA', creadoEn: '2026-11-18T19:00:00.000Z' },
    { id: 'c2', propuestaId: 'p1', folio: 'PR-2026-0017', version: 1, usuarioNombre: 'Ana', origen: 'APP', accion: 'ENVIAR', campo: 'vigente_hasta', valorAnterior: null, valorNuevo: '2026-12-18', creadoEn: '2026-11-18T19:00:00.000Z' },
    { id: 'c3', propuestaId: 'p1', folio: 'PR-2026-0017', version: 1, usuarioNombre: 'Ana', origen: 'APP', accion: 'EDITAR', campo: 'descuento_pct', valorAnterior: 0, valorNuevo: 12.5, creadoEn: '2026-11-18T20:00:00.000Z' },
  ],
  avancesProspecto: [],
} as unknown as Ficha

// 83 592 con IVA contra un máximo de 80 000: 3 592 arriba, 4.5 %.
const PROP = {
  id: 'p1', folio: 'PR-2026-0017', nombre: 'Verano', clienteId: 'c1', agenciaId: null, estatus: 'ENVIADA', version: 1,
  creadoEn: '2026-11-18T18:00:00.000Z', aprobadaEn: null, rechazadaEn: null, vendedorNombre: 'Ana',
  oportunidadId: 'o1', base: 77400, iva: 6192, ivaPct: 8, total: 83592, totalAprobado: 0,
  items: [{ fechaInicio: '2027-06-01', fechaFin: '2027-06-30' }],
} as unknown as Propuesta

const ficha = (idioma: Idioma) =>
  renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma, puedeElegir: true },
      createElement(FichaOportunidad, { id: 'o1', inicial: FICHA, propuestasInicial: [PROP], ahora: new Date('2026-11-18T21:00:00.000Z') })),
  ).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('Ficha de la oportunidad: la línea de tiempo pintaba el valor de la base', () => {
  it('en italiano: «Bozza → Inviata» y la fecha a la italiana, no «BORRADOR → ENVIADA» ni «2026-12-18»', () => {
    const txt = ficha('it')
    expect(txt).not.toContain('BORRADOR')
    expect(txt).not.toContain('ENVIADA')
    expect(txt).not.toContain('2026-12-18')
    expect(txt).toContain(`${DICCIONARIOS.it['propuestas.estatus.borrador']} → ${DICCIONARIOS.it['propuestas.estatus.enviada']}`)
    expect(txt).toContain('— → 18 dic 2026')
    expect(txt).toContain('0 → 12,5')
  })
  it('en italiano, el porcentaje del cotejo lleva coma: «(4,5%)», no «(4.5%)»', () => {
    const txt = ficha('it')
    expect(txt).toContain('(4,5%)')
    expect(txt).not.toContain('4.5%')
  })
  it('en español, lo de siempre', () => {
    const txt = ficha('es')
    expect(txt).toContain('BORRADOR → ENVIADA')
    expect(txt).toContain('— → 2026-12-18')
    expect(txt).toContain('0 → 12.5')
    expect(txt).toContain('(4.5 %)')
  })
  it('el valor, uno por uno', () => {
    expect(valorDeCambio('APROBADA', 'estatus', 'it', t('it'))).toBe(DICCIONARIOS.it['propuestas.estatus.aprobada'])
    expect(valorDeCambio('2026-12-18T00:00:00.000Z', 'vigente_hasta', 'it', t('it'))).toBe('18 dic 2026')
    expect(valorDeCambio('49400.00', 'precio', 'it', t('it'))).toBe('49.400')
    expect(valorDeCambio('Verano', 'nombre', 'it', t('it'))).toBe('Verano')
    expect(valorDeCambio(null, 'nombre', 'it', t('it'))).toBe('—')
    // Un estatus solo se traduce en su columna: un nombre que diga «ENVIADA» es dato.
    expect(valorDeCambio('ENVIADA', 'nombre', 'it', t('it'))).toBe('ENVIADA')
    for (const v of ['BORRADOR', '2026-12-18', '49400.00', 12.5]) {
      expect(valorDeCambio(v, 'estatus', 'es', t('es'))).toBe(String(v))
    }
  })
})

// ─── Imprenta: la medida de la orden ────────────────────────────────────────

describe('Imprenta: la fila de la orden decía «12.9 × 7.2 m» junto al «12,9 × 7,2 m» del arte', () => {
  it('en italiano, coma decimal', () => {
    expect(medidaEnIdioma(12.9, 7.2, 'it')).toBe('12,9 × 7,2 m')
    expect(medidaEnIdioma(3.25, 4, 'it')).toBe('3,25 × 4 m')
  })
  it('en español e inglés, idéntico a la plantilla de antes (`${ancho} × ${alto} m`)', () => {
    for (const [a, h] of [[12.9, 7.2], [3.25, 4], [10, 5]]) {
      expect(medidaEnIdioma(a, h, 'es')).toBe(`${a} × ${h} m`)
      expect(medidaEnIdioma(a, h, 'en')).toBe(`${a} × ${h} m`)
    }
  })
})

// ─── Administración → Roles y permisos ─────────────────────────────────────

describe('Matriz de permisos: el módulo «Captacion» salía en español', () => {
  it('en italiano, el rótulo del menú cuando el módulo no tiene `admin.modulo.*`', () => {
    expect(etiquetaModulo('captacion', 'Captacion', 'it', t('it'))).toBe(DICCIONARIOS.it['nav.captacion'])
    expect(etiquetaModulo('captacion', 'Captacion', 'it', t('it'))).not.toBe('Captacion')
    expect(etiquetaModulo('inventario', 'Inventario', 'it', t('it'))).toBe(DICCIONARIOS.it['nav.inventario'])
  })
  it('los que sí tienen clave propia, igual que antes', () => {
    expect(etiquetaModulo('comercial', 'Comercial', 'it', t('it'))).toBe(DICCIONARIOS.it['admin.modulo.comercial'])
  })
  it('en español, la etiqueta del servidor tal cual', () => {
    expect(etiquetaModulo('captacion', 'Captacion', 'es', t('es'))).toBe('Captacion')
  })
  it('un módulo que no conoce nadie, con su etiqueta', () => {
    expect(etiquetaModulo('nuevo', 'Nuevo', 'it', t('it'))).toBe('Nuevo')
  })
})
