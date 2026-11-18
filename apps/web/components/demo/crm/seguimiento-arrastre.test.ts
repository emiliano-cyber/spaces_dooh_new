import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { ES_CRM } from '@/lib/i18n/textos/crm'
import { ModalCambioEtapa } from './ModalCambioEtapa'
import { Seguimiento } from './Seguimiento'
import type { Oportunidad, PaginaOportunidades } from '@/lib/data/oportunidades-api'
import type { EtapaOportunidad } from '@/lib/crm'

// ============================================================================
//  18/11 · Arrastrar entre columnas de Seguimiento: el modal del cambio por
//  etapa y lo que la tarjeta lleva para poder arrastrarse.
// ----------------------------------------------------------------------------
//  Sin DOM no hay arrastre (vitest.config.ts): lo que decide vive en
//  `lib/seguimiento-arrastre.ts` y se prueba allí. Aquí se rinde a HTML el
//  modal de cada etapa destino, en los cuatro idiomas, y el tablero con y sin
//  permiso.
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/propuestas',
  useSearchParams: () => new URLSearchParams(),
}))
// El modal real va por un portal de Radix, que en el servidor no pinta nada.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; subtitle?: string; children: unknown; footer?: unknown }) =>
    p.open
      ? createElement('div', { 'data-modal': '' }, createElement('h2', null, p.title), createElement('p', null, p.subtitle ?? ''), p.children as never, p.footer as never)
      : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.children as never),
}))

const envolver = (idioma: Idioma, hijo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, hijo))

const OP = { id: 'o1', nombre: 'Navidad 2026', cliente: 'Refrescos del Norte', etapa: 'NECESIDAD' as EtapaOportunidad }

const modal = (destino: EtapaOportunidad | null, idioma: Idioma = 'es', api = vi.fn()) =>
  envolver(
    idioma,
    createElement(ModalCambioEtapa, {
      oportunidad: OP,
      destino,
      onCancelar: () => {},
      onGuardada: () => {},
      onError: () => {},
      api,
    }),
  )

describe('el modal del cambio de etapa', () => {
  it('cerrado (sin oportunidad) no pinta nada', () => {
    const h = envolver('es', createElement(ModalCambioEtapa, { oportunidad: null, destino: null, onCancelar: () => {}, onGuardada: () => {}, onError: () => {} }))
    expect(h).toBe('')
  })

  it('a una etapa abierta: de dónde a dónde y la nota; ni motivo ni confirmación', () => {
    const h = modal('COTIZANDO')
    expect(h).toContain('Mover a Cotizando')
    expect(h).toContain('Navidad 2026')
    expect(h).toContain('Necesidad')
    expect(h).toContain(ES_CRM['crm.arrastre.nota'])
    expect(h).not.toContain(ES_CRM['crm.ficha.motivo'])
    expect(h).not.toContain(ES_CRM['crm.arrastre.confirmar-ganada'])
    // Guardar habilitado: no falta nada.
    expect(h).toMatch(/<button[^>]*>Guardar<\/button>/)
    expect(h).not.toMatch(/<button[^>]*disabled=""[^>]*>Guardar<\/button>/)
  })

  it('a Perdida: el motivo, obligatorio, y Guardar deshabilitado hasta escribirlo', () => {
    const h = modal('PERDIDA')
    expect(h).toContain(ES_CRM['crm.ficha.motivo'])
    expect(h).toContain('required')
    expect(h).toContain(ES_CRM['crm.arrastre.aviso-cierre'])
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Guardar<\/button>/)
  })

  it('a Ganada: la confirmación, y Guardar deshabilitado hasta marcarla', () => {
    const h = modal('GANADA')
    expect(h).toContain(ES_CRM['crm.arrastre.confirmar-ganada'])
    expect(h).toContain('type="checkbox"')
    expect(h).toContain(ES_CRM['crm.arrastre.aviso-cierre'])
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Guardar<\/button>/)
  })

  it('desde el botón «Mover» (sin arrastrar): se elige la etapa en un selector, sin la propia', () => {
    const h = modal(null)
    expect(h).toContain('<select')
    expect(h).toContain(ES_CRM['crm.ficha.etapa'])
    expect(h).not.toContain('value="NECESIDAD"')
    expect(h).toContain('value="GANADA"')
    // Sin etapa elegida no se guarda.
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Guardar<\/button>/)
  })

  it('pintarlo no llama a la API (solo Guardar lo hace)', () => {
    const api = vi.fn()
    modal('PERDIDA', 'es', api)
    modal('COTIZANDO', 'es', api)
    expect(api).not.toHaveBeenCalled()
  })

  for (const idioma of ['en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} no se cuela español`, () => {
      for (const d of ['PERDIDA', 'GANADA', 'COTIZANDO', null] as (EtapaOportunidad | null)[]) {
        const h = modal(d, idioma)
        for (const k of ['crm.arrastre.nota', 'crm.arrastre.confirmar-ganada', 'crm.arrastre.aviso-cierre', 'crm.arrastre.guardar'] as const) {
          expect(h).not.toContain(ES_CRM[k])
        }
        expect(h).not.toContain('Mover a ')
      }
    })
  }
})

// ─── El tablero ─────────────────────────────────────────────────────────────

const op = (o: Partial<Oportunidad> & Pick<Oportunidad, 'id' | 'etapa'>): Oportunidad => ({
  nombre: `Oportunidad ${o.id}`,
  prospectoId: null,
  prospectoNombre: null,
  clienteId: 'c1',
  clienteNombre: 'Refrescos del Norte',
  usuarioId: 'u1',
  vendedorNombre: 'Ana',
  presupuestoMin: 100000,
  presupuestoMax: 200000,
  fechaInicioDeseada: null,
  fechaFinDeseada: null,
  fechaDecision: null,
  plazas: null,
  tiposMedio: [],
  objetivo: null,
  motivoPerdida: null,
  ganadaEn: null,
  perdidaEn: null,
  cotizaciones: 0,
  ultimaActividadEn: null,
  creadoEn: '2026-11-01T18:00:00.000Z',
  actualizadoEn: '2026-11-02T18:00:00.000Z',
  ...o,
})

const PAG: PaginaOportunidades = {
  oportunidades: [
    op({ id: 'o1', etapa: 'NECESIDAD', nombre: 'Abierta uno' }),
    op({ id: 'o2', etapa: 'GANADA', nombre: 'Ganada dos', ganadaEn: '2026-11-05T18:00:00.000Z' }),
  ],
  total: 2,
  porEtapa: { NECESIDAD: 1, GANADA: 1 },
  pagina: 1,
  porPagina: 100,
  veTodas: false,
}
const AHORA = new Date('2026-11-10T18:00:00.000Z')

const tablero = (puedeCrear: boolean, idioma: Idioma = 'es', extra: Record<string, unknown> = {}) =>
  envolver(idioma, createElement(Seguimiento, { inicial: PAG, prospectosInicial: [], ahora: AHORA, puedeCrear, ...extra }))

const columna = (h: string, etapa: string) => h.match(new RegExp(`<section[^>]*data-columna="${etapa}"[\\s\\S]*?</section>`))?.[0] ?? ''

describe('el tablero se puede arrastrar', () => {
  it('con permiso: la ayuda, las columnas marcadas y la abierta arrastrable con su botón «Mover»', () => {
    const h = tablero(true)
    expect(h).toContain(ES_CRM['crm.arrastre.ayuda'])
    for (const e of ['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO', 'GANADA']) expect(h).toContain(`data-columna="${e}"`)
    const nec = columna(h, 'NECESIDAD')
    expect(nec).toContain('data-tarjeta="o1"')
    expect(nec).toContain('data-arrastrable="true"')
    expect(nec).toContain(`aria-label="${ES_CRM['crm.arrastre.mover']}: Abierta uno"`)
    // El clic sigue abriendo la ficha.
    expect(nec).toContain('href="/crm/oportunidades/o1')
  })

  it('una ganada no se arrastra ni tiene «Mover»', () => {
    const gan = columna(tablero(true), 'GANADA')
    expect(gan).toContain('data-tarjeta="o2"')
    expect(gan).not.toContain('data-arrastrable="true"')
    expect(gan).not.toContain(ES_CRM['crm.arrastre.mover'])
  })

  it('sin comercial.crear: ni ayuda, ni arrastre, ni «Mover»', () => {
    const h = tablero(false)
    expect(h).not.toContain(ES_CRM['crm.arrastre.ayuda'])
    expect(h).not.toContain('data-arrastrable="true"')
    expect(h).not.toContain(ES_CRM['crm.arrastre.mover'])
  })

  it('con el modal abierto la tarjeta se ve en la columna destino, «pendiente»', () => {
    const h = tablero(true, 'es', { pendienteInicial: { tipo: 'oportunidad', id: 'o1', destino: 'COTIZANDO' } })
    const cot = columna(h, 'COTIZANDO')
    expect(cot).toContain('data-tarjeta="o1"')
    expect(cot).toContain(ES_CRM['crm.arrastre.pendiente'])
    expect(columna(h, 'NECESIDAD')).not.toContain('data-tarjeta="o1"')
  })

  for (const idioma of ['en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} la ayuda y «Mover» no dicen nada en español`, () => {
      const h = tablero(true, idioma, { pendienteInicial: { tipo: 'oportunidad', id: 'o1', destino: 'COTIZANDO' } })
      expect(h).toContain('data-arrastrable="true"')
      expect(h).not.toContain(ES_CRM['crm.arrastre.ayuda'])
      expect(h).not.toContain(ES_CRM['crm.arrastre.mover'])
      expect(h).not.toContain(ES_CRM['crm.arrastre.pendiente'])
    })
  }
})
