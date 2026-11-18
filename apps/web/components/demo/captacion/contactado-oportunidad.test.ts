import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { ES_CRM, EN_CRM, IT_CRM, PT_CRM } from '@/lib/i18n/textos/crm'
import {
  preguntarAlContactar,
  tieneOportunidad,
  altaDesdeProspecto,
  aplicarEleccion,
} from '@/lib/prospecto-contactado'
import { CuadroContactado } from './CuadroContactado'
import { Seguimiento } from '@/components/demo/crm/Seguimiento'
import type { Prospecto } from '@/lib/data/captacion-api'

// ============================================================================
//  18/11 · «Si el prospecto ya entró a Contactado se convierte; si no, sigue
//  como prospecto.» Y al preguntarle cómo, el dueño: «darle la opción al
//  vendedor de ponerlo como prospecto o dejarlo solo como oportunidad».
// ----------------------------------------------------------------------------
//  Sin DOM no hay clics (vitest.config.ts): la DECISIÓN de preguntar y lo que
//  hace cada opción viven en `lib/prospecto-contactado.ts`, puras, y aquí se
//  prueban con llamadas falsas. El cuadro se rinde a HTML en los cuatro idiomas.
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/propuestas',
  useSearchParams: () => new URLSearchParams(),
}))
// El modal real va por un portal de Radix, que en el servidor no pinta nada.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: (p: { open: boolean; title: string; children: unknown; footer?: unknown }) =>
    p.open ? createElement('div', null, createElement('h2', null, p.title), p.children as never, p.footer as never) : null,
}))
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.children as never),
}))

const base = { tipo: 'CLIENTE' as const, etapaActual: 'PROSPECTO' as const, etapaNueva: 'CONTACTADO' as const, tieneOportunidad: false, puedeConvertir: true }

describe('cuándo se pregunta', () => {
  it('un CLIENTE sin oportunidad que pasa a CONTACTADO: sí', () => {
    expect(preguntarAlContactar(base)).toBe(true)
  })
  it('con oportunidad ya ligada: no', () => {
    expect(preguntarAlContactar({ ...base, tieneOportunidad: true })).toBe(false)
  })
  it('a cualquier otra etapa: no', () => {
    for (const e of ['PROSPECTO', 'VISITA', 'NEGOCIACION', 'EN_REVISION', 'PERDIDO'] as const) {
      expect(preguntarAlContactar({ ...base, etapaNueva: e })).toBe(false)
    }
  })
  it('si ya estaba en CONTACTADO (solo una nota): no', () => {
    expect(preguntarAlContactar({ ...base, etapaActual: 'CONTACTADO' })).toBe(false)
  })
  it('un prospecto de espacio (arrendador, predio, pantalla): no', () => {
    for (const tipo of ['ARRENDADOR', 'PREDIO', 'PANTALLA'] as const) {
      expect(preguntarAlContactar({ ...base, tipo })).toBe(false)
    }
  })
  it('quien no puede crear oportunidades: no (guarda como siempre)', () => {
    expect(preguntarAlContactar({ ...base, puedeConvertir: false })).toBe(false)
  })
  it('tieneOportunidad mira el prospectoId de las oportunidades', () => {
    const ops = [{ prospectoId: null }, { prospectoId: 'p2' }]
    expect(tieneOportunidad('p2', ops)).toBe(true)
    expect(tieneOportunidad('p1', ops)).toBe(false)
  })
})

describe('lo que hace cada opción', () => {
  const llamadas = () => {
    const orden: string[] = []
    return {
      orden,
      guardarAvance: vi.fn(async () => { orden.push('avance'); return { id: 'p1', etapa: 'CONTACTADO' } }),
      crearOportunidad: vi.fn(async () => { orden.push('oportunidad'); return { id: 'o9' } }),
    }
  }

  it('cancelar no llama nada', async () => {
    const a = llamadas()
    const r = await aplicarEleccion('cancelar', a)
    expect(a.guardarAvance).not.toHaveBeenCalled()
    expect(a.crearOportunidad).not.toHaveBeenCalled()
    expect(r).toEqual({ prospecto: null, oportunidad: null, errorOportunidad: null })
  })

  it('«Seguir como prospecto» solo guarda el avance', async () => {
    const a = llamadas()
    const r = await aplicarEleccion('prospecto', a)
    expect(a.orden).toEqual(['avance'])
    expect(r.prospecto).toEqual({ id: 'p1', etapa: 'CONTACTADO' })
    expect(r.oportunidad).toBeNull()
  })

  it('«Convertir en oportunidad» guarda el avance y DESPUÉS crea la oportunidad', async () => {
    const a = llamadas()
    const r = await aplicarEleccion('oportunidad', a)
    expect(a.orden).toEqual(['avance', 'oportunidad'])
    expect(r.oportunidad).toEqual({ id: 'o9' })
    expect(r.errorOportunidad).toBeNull()
  })

  it('si el avance falla, no se crea la oportunidad (y el error sube)', async () => {
    const a = llamadas()
    a.guardarAvance.mockRejectedValueOnce(new Error('409'))
    await expect(aplicarEleccion('oportunidad', a)).rejects.toThrow('409')
    expect(a.crearOportunidad).not.toHaveBeenCalled()
  })

  it('si la oportunidad falla, el avance queda guardado y se dice', async () => {
    const a = llamadas()
    a.crearOportunidad.mockRejectedValueOnce(new Error('Sin permiso'))
    const r = await aplicarEleccion('oportunidad', a)
    expect(r.prospecto).not.toBeNull()
    expect(r.oportunidad).toBeNull()
    expect(r.errorOportunidad).toBe('Sin permiso')
  })

  it('la oportunidad nace del prospecto, con su nombre y sin datos inventados', () => {
    expect(altaDesdeProspecto({ id: 'p1', nombre: '  Tacos El Güero  ' })).toEqual({
      nombre: 'Tacos El Güero',
      presupuestoMin: null,
      presupuestoMax: null,
      fechaInicioDeseada: null,
      fechaFinDeseada: null,
      fechaDecision: null,
      plazas: null,
      tiposMedio: [],
      objetivo: null,
      clienteId: null,
      prospectoId: 'p1',
      nota: null,
    })
    // El servidor limita el nombre a 200.
    expect(altaDesdeProspecto({ id: 'p1', nombre: 'x'.repeat(250) }).nombre).toHaveLength(200)
  })
})

const envolver = (idioma: Idioma, hijo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, hijo))

describe('el cuadro', () => {
  const DIC = { es: ES_CRM, en: EN_CRM, it: IT_CRM, pt: PT_CRM } as const
  for (const idioma of ['es', 'en', 'it', 'pt'] as const) {
    it(`en ${idioma}: título, explicación y las tres salidas`, () => {
      const html = envolver(idioma, createElement(CuadroContactado, { abierto: true, nombre: 'Tacos', ocupado: false, onElegir: () => {} }))
      const d = DIC[idioma]
      expect(html).toContain(d['crm.contactado.titulo'])
      expect(html).toContain(d['crm.contactado.texto'].replace('{nombre}', 'Tacos'))
      expect(html).toContain(d['crm.contactado.seguir'])
      expect(html).toContain(d['crm.contactado.convertir'])
    })
  }
  it('cerrado no pinta nada', () => {
    expect(envolver('es', createElement(CuadroContactado, { abierto: false, nombre: 'Tacos', ocupado: false, onElegir: () => {} }))).toBe('')
  })
})

describe('Seguimiento: el prospecto que siguió como prospecto dice su etapa', () => {
  const pr = (o: Partial<Prospecto> & Pick<Prospecto, 'id' | 'nombre' | 'etapa'>) =>
    ({ tipo: 'CLIENTE', contacto: {}, datos: {}, usuarioId: 'u1', vendedorNombre: 'Ana', creadoEn: '2026-11-10T12:00:00.000Z', ...o }) as Prospecto
  const PAGINA = { oportunidades: [], total: 0, porEtapa: {}, pagina: 1, porPagina: 100, veTodas: true } as never
  const html = (idioma: Idioma) =>
    envolver(idioma, createElement(Seguimiento, {
      inicial: PAGINA,
      prospectosInicial: [pr({ id: 'a', nombre: 'Nuevo', etapa: 'PROSPECTO' }), pr({ id: 'b', nombre: 'Llamado', etapa: 'CONTACTADO' })],
      puedeCrear: true,
      ahora: new Date('2026-11-18T12:00:00.000Z'),
    }))

  it('el CONTACTADO lleva «Contactado»; el recién captado no', () => {
    const h = html('es')
    const tarjeta = (nombre: string) => h.slice(h.lastIndexOf('<li', h.indexOf(nombre)), h.indexOf('</li>', h.indexOf(nombre)))
    expect(tarjeta('Llamado')).toContain('Contactado')
    expect(tarjeta('Nuevo')).not.toContain('Contactado')
    // «Crear oportunidad» sigue en las dos.
    expect(h.split(ES_CRM['crm.form.crear']).length - 1).toBe(2)
  })
  it('en inglés, «Contacted»', () => {
    expect(html('en')).toContain('Contacted')
  })
})
