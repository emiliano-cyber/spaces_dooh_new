import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { ES_CRM, EN_CRM, IT_CRM, PT_CRM } from '@/lib/i18n/textos/crm'
import {
  preguntarAlContactar,
  tieneOportunidadAbierta,
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

const base = {
  tipo: 'CLIENTE' as const,
  etapaActual: 'PROSPECTO' as const,
  etapaNueva: 'CONTACTADO' as const,
  tieneOportunidadAbierta: false,
  puedeConvertir: true,
}

describe('cuándo se pregunta (18/11: desde Contactado en adelante)', () => {
  it('un CLIENTE sin oportunidad abierta que entra a CONTACTADO: sí', () => {
    expect(preguntarAlContactar(base)).toBe(true)
  })
  it('y al entrar a cualquier etapa de Contactado en adelante: sí', () => {
    for (const e of ['CONTACTADO', 'VISITA', 'NEGOCIACION', 'EN_REVISION', 'APROBADO'] as const) {
      expect(preguntarAlContactar({ ...base, etapaNueva: e }), e).toBe(true)
    }
    // También al avanzar entre ellas (siguió como prospecto en Contactado).
    expect(preguntarAlContactar({ ...base, etapaActual: 'CONTACTADO', etapaNueva: 'VISITA' })).toBe(true)
  })
  it('a PROSPECTO, PERDIDO o RECHAZADO: nunca', () => {
    for (const e of ['PROSPECTO', 'PERDIDO', 'RECHAZADO'] as const) {
      expect(preguntarAlContactar({ ...base, etapaActual: 'CONTACTADO', etapaNueva: e }), e).toBe(false)
    }
  })
  it('si se queda en la misma etapa (solo una nota): no', () => {
    expect(preguntarAlContactar({ ...base, etapaActual: 'VISITA', etapaNueva: 'VISITA' })).toBe(false)
  })
  it('con una oportunidad ABIERTA: no', () => {
    expect(preguntarAlContactar({ ...base, tieneOportunidadAbierta: true })).toBe(false)
  })
  it('un prospecto de espacio (arrendador, predio, pantalla): no', () => {
    for (const tipo of ['ARRENDADOR', 'PREDIO', 'PANTALLA'] as const) {
      expect(preguntarAlContactar({ ...base, tipo })).toBe(false)
    }
  })
  it('quien no puede crear oportunidades: no (guarda como siempre)', () => {
    expect(preguntarAlContactar({ ...base, puedeConvertir: false })).toBe(false)
  })
  it('tieneOportunidadAbierta: solo cuentan las de ese prospecto que no están GANADA ni PERDIDA', () => {
    const ops = [
      { prospectoId: null, etapa: 'CONTACTO' as const },
      { prospectoId: 'p2', etapa: 'NEGOCIANDO' as const },
      { prospectoId: 'p3', etapa: 'GANADA' as const },
      { prospectoId: 'p3', etapa: 'PERDIDA' as const },
    ]
    expect(tieneOportunidadAbierta('p2', ops)).toBe(true)
    expect(tieneOportunidadAbierta('p3', ops)).toBe(false)
    expect(tieneOportunidadAbierta('p1', ops)).toBe(false)
  })
})

describe('lo que hace cada opción', () => {
  const llamadas = () => ({
    guardarAvance: vi.fn(async () => ({ id: 'p1', etapa: 'CONTACTADO' })),
    abrirFormulario: vi.fn(),
  })

  it('cancelar no llama nada', async () => {
    const a = llamadas()
    expect(await aplicarEleccion('cancelar', a)).toBeNull()
    expect(a.guardarAvance).not.toHaveBeenCalled()
    expect(a.abrirFormulario).not.toHaveBeenCalled()
  })

  it('«Seguir como prospecto» solo guarda el avance', async () => {
    const a = llamadas()
    expect(await aplicarEleccion('prospecto', a)).toEqual({ id: 'p1', etapa: 'CONTACTADO' })
    expect(a.abrirFormulario).not.toHaveBeenCalled()
  })

  it('«Convertir en oportunidad» abre el formulario y NO guarda el avance todavía', async () => {
    const a = llamadas()
    expect(await aplicarEleccion('oportunidad', a)).toBeNull()
    expect(a.abrirFormulario).toHaveBeenCalledOnce()
    expect(a.guardarAvance).not.toHaveBeenCalled()
  })

  it('si el avance falla, el error sube', async () => {
    const a = llamadas()
    a.guardarAvance.mockRejectedValueOnce(new Error('409'))
    await expect(aplicarEleccion('prospecto', a)).rejects.toThrow('409')
  })
})

const envolver = (idioma: Idioma, hijo: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, hijo))

describe('el cuadro', () => {
  const DIC = { es: ES_CRM, en: EN_CRM, it: IT_CRM, pt: PT_CRM } as const
  for (const idioma of ['es', 'en', 'it', 'pt'] as const) {
    it(`en ${idioma}: título, explicación y las tres salidas`, () => {
      const html = envolver(idioma, createElement(CuadroContactado, { abierto: true, nombre: 'Tacos', etapa: 'VISITA', ocupado: false, onElegir: () => {} }))
      const d = DIC[idioma]
      expect(html).toContain(d['crm.contactado.titulo'])
      // La etapa va con su nombre en el idioma: «Visita», «Visit»…
      const [antes, despues] = d['crm.contactado.texto'].replace('{nombre}', 'Tacos').split('{etapa}')
      expect(html).toContain(antes)
      expect(html).toContain(despues)
      expect(html).toContain({ es: 'Visita', en: 'Visit', it: 'Sopralluogo', pt: 'Visita' }[idioma])
      expect(html).toContain(d['crm.contactado.seguir'])
      expect(html).toContain(d['crm.contactado.convertir'])
    })
  }
  it('cerrado no pinta nada', () => {
    expect(envolver('es', createElement(CuadroContactado, { abierto: false, nombre: 'Tacos', etapa: 'VISITA', ocupado: false, onElegir: () => {} }))).toBe('')
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
