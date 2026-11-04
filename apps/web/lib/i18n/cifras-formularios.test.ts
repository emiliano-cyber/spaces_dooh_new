import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { ProveedorIdioma } from './contexto'
import { traducir } from './diccionario'
import type { Idioma } from './idiomas'
import { montar, reiniciarTienda, textoDe } from '@/lib/test/formulario-sin-dom'

// ============================================================================
//  P-L2-1 (04/11) · LOS FORMULARIOS GUARDAN LA CIFRA DEL IDIOMA DE LA PERSONA.
// ----------------------------------------------------------------------------
//  Cada formulario que pasó de `Number(texto)` (o de un `type="number"`) a
//  `EntradaCifra` se monta de verdad, se teclea en él y se pulsa su botón; lo
//  que se mira es lo que llega a la API (mockeada):
//
//   · en ITALIANO, «12,9» → 12.9 y «1.500,50» → 1500.5; lo que no se
//     entiende («12.9», «1,500») NO se manda;
//   · en ESPAÑOL e INGLÉS, lo de siempre: «12.9» → 12.9, y «12,9» hace lo que
//     hacía antes (`Number('12,9') || 0` = 0 en el alta, que es el defecto que
//     este cambio NO toca en es/en: allí la coma nunca fue decimal).
//
//  El arnés (`lib/test/formulario-sin-dom.ts`) finge el estado entre renders y
//  los manejadores, sin DOM.
// ============================================================================

vi.mock('react', async (importOriginal) =>
  (await import('@/lib/test/formulario-sin-dom')).reactConEstado(await importOriginal()),
)
vi.mock('react/jsx-runtime', async (importOriginal) =>
  (await import('@/lib/test/formulario-sin-dom')).jsxQueApunta(await importOriginal()),
)
vi.mock('react/jsx-dev-runtime', async (importOriginal) =>
  (await import('@/lib/test/formulario-sin-dom')).jsxQueApunta(await importOriginal()),
)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
// Los cuadros van por portales de Radix, que en el servidor no pintan nada.
vi.mock('@/components/demo/ui/Modal', async () => {
  const { createElement: ce } = await import('react')
  return {
    Modal: (p: { open: boolean; children: unknown; footer?: unknown }) =>
      p.open ? ce('div', null, p.children as never, p.footer as never) : null,
  }
})
// El botón real no devuelve la promesa del `onClick` (su guarda de clic en
// vuelo); aquí hace falta esperarla.
vi.mock('@/components/demo/ui/Button', async () => {
  const { createElement: ce } = await import('react')
  const { tienda } = await import('@/lib/test/formulario-sin-dom')
  return {
    Button: (p: { onClick?: () => unknown; disabled?: boolean; children?: unknown }) => {
      tienda.elementos.push({ tipo: 'button', props: p as Record<string, unknown> })
      return ce('button', { disabled: p.disabled }, p.children as never)
    },
  }
})

// Las pestañas de Radix solo pintan la activa; aquí se pintan todas.
vi.mock('@/components/demo/ui/Tabs', async () => {
  const { createElement: ce } = await import('react')
  return {
    Tabs: (p: { children?: unknown }) => ce('div', null, p.children as never),
    TabPanel: (p: { children?: unknown }) => ce('div', null, p.children as never),
  }
})
vi.mock('@/components/demo/ui/CardColapsable', async () => {
  const { createElement: ce } = await import('react')
  return {
    CardColapsable: (p: { titulo?: string; accion?: unknown; children?: unknown }) =>
      ce('section', null, ce('h3', null, p.titulo), p.accion as never, p.children as never),
  }
})
vi.mock('@/components/demo/shell/SesionContext', () => ({ usePuede: () => true }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const { api, apunta, AGENCIA } = vi.hoisted(() => {
  const api = { llamadas: [] as Array<{ que: string; cuerpo: unknown }> }
  const apunta = (que: string) => async (...args: unknown[]) => {
    api.llamadas.push({ que, cuerpo: args.length === 1 ? args[0] : args })
    return { id: 'nuevo', ...(args[args.length - 1] as object) }
  }
  const AGENCIA = {
    id: 'ag1', nombre: 'Agencia Uno', tipo: 'AGENCIA', comisionAgenciaPct: 10, tieneNegociacion: false,
    negociacionValidada: false, contacto: {}, ivaPct: 16,
  }
  return { api, apunta, AGENCIA }
})
vi.mock('@/lib/data/sitios-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  altaSitioApi: vi.fn(apunta('altaSitio')),
}))
vi.mock('@/lib/data/estado-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  crearOrdenImpresionApi: vi.fn(apunta('crearOrdenImpresion')),
  crearClienteApi: vi.fn(apunta('crearCliente')),
  actualizarClienteApi: vi.fn(apunta('actualizarCliente')),
}))
vi.mock('@/lib/data/codigos-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  codigosApi: vi.fn(async () => []),
  guardarCodigoApi: vi.fn(apunta('guardarCodigo')),
}))
vi.mock('@/lib/data/volumen-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  escalasVolumenApi: vi.fn(async () => []),
  guardarTramoVolumenApi: vi.fn(apunta('guardarTramo')),
}))
vi.mock('@/lib/data/client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useArrendadores: () => [{ id: 'a1', nombre: 'Arrendador Uno' }],
  useSitios: () => [],
  useCampanas: () => [{ id: 'c1', nombre: 'Campaña Uno', clienteId: 'x', estatus: 'ACTIVA' }],
  useOrdenesImpresion: () => [],
  useClientes: () => [AGENCIA],
  usePropuestas: () => [],
}))
// `FileReader` no existe en node: la imagen promocional del alta manual.
class LectorFalso {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL() {
    this.result = 'data:image/png;base64,AAAA'
    this.onload?.()
  }
}
;(globalThis as { FileReader?: unknown }).FileReader = LectorFalso

import { AltaSitioDialog } from '@/components/demo/comercial/AltaSitioDialog'
import { NuevaPantallaForm } from '@/components/demo/inventario/NuevaPantallaForm'
import ImprentaPage from '@/app/(app)/(shell)/imprenta/page'
import ComisionesPage from '@/app/(app)/(shell)/comisiones/page'
import { GestionCodigos } from '@/components/demo/codigos/GestionCodigos'
import { GestionVolumen } from '@/components/demo/volumen/GestionVolumen'

function en(idioma: Idioma, hijo: ReactElement) {
  return createElement(ProveedorIdioma, { idioma, puedeElegir: true, disponibles: ['es', 'en', 'it'] }, hijo)
}
const t = (idioma: Idioma, clave: Parameters<typeof traducir>[1], v?: Record<string, string | number>) =>
  traducir(idioma, clave, v)

beforeEach(() => {
  reiniciarTienda()
  api.llamadas.length = 0
})

// ─── Alta de pantalla desde Comercial: el ancho y el alto ────────────────────
describe('AltaSitioDialog · el ancho y el alto en el idioma de la persona', () => {
  async function alta(idioma: Idioma, ancho: string, alto: string) {
    const f = montar(() => en(idioma, createElement(AltaSitioDialog, { open: true, onOpenChange: () => {}, onCreado: () => {} })))
    // Pantalla propia: sin arrendador que elegir.
    f.teclearEn(f.elementos('input').find((e) => e.props.type === 'checkbox')!, 'true')
    const textos = f.elementos('input').filter((e) => e.props.autoFocus)
    f.teclearEn(textos[0], 'Pantalla Uno')
    f.teclear('Miraflores', 'Centro')
    f.teclear(t(idioma, 'comercial.alta.direccion-mostrada'), 'Av. Siempre Viva 1')
    const decimal = idioma === 'it' ? ',' : '.'
    f.teclear(`12${decimal}9`, ancho)
    f.teclear(`7${decimal}2`, alto)
    const deshabilitado = f.botonDeshabilitado(t(idioma, 'comercial.alta.crear'))
    // Se pulsa AUNQUE esté apagado: la guardia de `submit` tiene que parar sola.
    await f.pulsar(t(idioma, 'comercial.alta.crear'), { aunqueApagado: true })
    return { f, deshabilitado, cuerpo: api.llamadas[0]?.cuerpo as Record<string, unknown> | undefined }
  }

  it('ITALIANO · «12,9» y «1.500,50» se guardan como 12.9 y 1500.5', async () => {
    const r = await alta('it', '12,9', '1.500,50')
    expect(r.cuerpo).toMatchObject({ ancho: 12.9, alto: 1500.5 })
  })

  it('ITALIANO · el campo pinta lo tecleado a la italiana y lleva el ejemplo italiano', async () => {
    const r = await alta('it', '12,9', '7,2')
    expect(r.f.html).toContain('placeholder="Es. 12,9"')
    expect(r.f.html).toContain('type="text"')
  })

  it('ITALIANO · NEGATIVO: «12.9» (punto a la inglesa) no se manda y lo dice', async () => {
    const r = await alta('it', '12.9', '7,2')
    expect(r.deshabilitado).toBe(true)
    expect(api.llamadas).toHaveLength(0)
    expect(r.f.html).toContain('role="alert"')
  })

  it('ITALIANO · NEGATIVO: «1,500» (¿mil quinientos a la inglesa?) no se manda', async () => {
    const r = await alta('it', '1,500', '7,2')
    expect(r.deshabilitado).toBe(true)
    expect(api.llamadas).toHaveLength(0)
  })

  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · «12.9» se guarda como 12.9, como siempre`, async () => {
      const r = await alta(idioma, '12.9', '7.2')
      expect(r.cuerpo).toMatchObject({ ancho: 12.9, alto: 7.2 })
      expect(r.f.html).not.toContain('role="alert"')
    })

    it(`${idioma.toUpperCase()} · «12,9» hace lo de antes (Number → NaN → 0) y «1.500,50» también`, async () => {
      const r = await alta(idioma, '12,9', '1.500,50')
      expect(r.deshabilitado).toBe(false)
      expect(r.cuerpo).toMatchObject({ ancho: 0, alto: 0 })
    })
  }
})

// ─── Alta manual de Inventario: las caras y los segundos del slot ───────────
describe('NuevaPantallaForm · las caras y los segundos del slot', () => {
  async function alta(idioma: Idioma, caras: string, segundos: string) {
    const f = montar(() =>
      en(idioma, createElement(NuevaPantallaForm, { open: true, onOpenChange: () => {}, onCreado: () => {}, inline: true })),
    )
    f.teclearEn(f.elementos('input').find((e) => e.props.type === 'checkbox')!, 'true') // propia
    f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Pantalla Uno')
    f.teclear(t(idioma, 'comercial.comun.ej', { valor: '19.4326' }), '19.4326', true)
    f.teclear(t(idioma, 'comercial.comun.ej', { valor: '-99.1332' }), '-99.1332', true)
    const archivo = f.elementos('input').find((e) => e.props.type === 'file')!
    ;(archivo.props.onChange as (ev: unknown) => void)({ target: { files: [{ size: 10, name: 'a.png' }] } })
    f.rendir()
    f.teclear(t(idioma, 'comercial.comun.ej', { valor: '1' }), caras, true)
    f.teclear(t(idioma, 'comercial.comun.ej', { valor: '20' }), segundos, true)
    const boton = t(idioma, 'inventario.alta.guardar')
    const deshabilitado = f.botonDeshabilitado(boton)
    await f.pulsar(boton, { aunqueApagado: true })
    return { f, deshabilitado, cuerpo: api.llamadas[0]?.cuerpo as Record<string, unknown> | undefined }
  }

  it('ITALIANO · «1.500» caras son mil quinientas (no 1,5)', async () => {
    const r = await alta('it', '1.500', '20')
    expect(r.cuerpo).toMatchObject({ caras: 1500 })
  })

  it('ITALIANO · NEGATIVO: «12,9» caras (decimal en un entero) no se manda', async () => {
    const r = await alta('it', '12,9', '20')
    expect(r.deshabilitado).toBe(true)
    expect(api.llamadas).toHaveLength(0)
    expect(r.f.html).toContain('Solo cifre intere, senza decimali')
  })

  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · «1.500» sigue siendo Number('1.500') = 1.5, como siempre`, async () => {
      const r = await alta(idioma, '1.500', '20')
      expect(r.cuerpo).toMatchObject({ caras: 1.5 })
    })
  }
})

// ─── Órdenes de impresión: el ancho y el alto de la lona ────────────────────
describe('Imprenta · el ancho y el alto de la orden', () => {
  async function orden(idioma: Idioma, ancho: string, alto: string) {
    const f = montar(() => en(idioma, createElement(ImprentaPage)))
    const nueva = f.elementos('button').filter((b) => b.props.variant === 'success')[0]
    await (nueva.props.onClick as () => unknown)()
    f.rendir()
    f.teclearEn(f.elementos('select')[0], 'c1')
    f.teclearEn(f.elementos('input').filter((e) => e.props.placeholder === '0')[0], ancho)
    f.teclearEn(f.elementos('input').filter((e) => e.props.placeholder === '0')[1], alto)
    const crear = f.elementos('button').filter((b) => b.props.variant === 'success').pop()!
    if (!crear.props.disabled) await (crear.props.onClick as () => unknown)()
    f.rendir()
    return { f, cuerpo: api.llamadas.find((l) => l.que === 'crearOrdenImpresion')?.cuerpo as Record<string, unknown> | undefined }
  }

  it('ITALIANO · «12,9» × «1.500,50» se manda como 12.9 × 1500.5', async () => {
    const r = await orden('it', '12,9', '1.500,50')
    expect(r.cuerpo).toMatchObject({ ancho: 12.9, alto: 1500.5 })
  })

  it('ITALIANO · NEGATIVO: «12.9» no se manda', async () => {
    const r = await orden('it', '12.9', '3')
    expect(r.cuerpo).toBeUndefined()
  })

  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · «12.9» × «3» como siempre`, async () => {
      const r = await orden(idioma, '12.9', '3')
      expect(r.cuerpo).toMatchObject({ ancho: 12.9, alto: 3 })
    })
  }
})

// ─── Comisiones de agencia: el alta y la fila ───────────────────────────────
describe('Comisiones · el porcentaje de la agencia', () => {
  async function altaAgencia(idioma: Idioma, comision: string) {
    const f = montar(() => en(idioma, createElement(ComisionesPage)))
    const nueva = f.elementos('button').find((b) => b.props.variant === 'success')!
    await (nueva.props.onClick as () => unknown)()
    f.rendir()
    const textos = f.elementos('input').filter((e) => e.props.type !== 'checkbox' && e.props.placeholder !== '0' && !e.props['aria-label'])
    f.teclearEn(textos[0], 'Agencia Dos')
    f.teclearEn(f.elementos('input').filter((e) => e.props.placeholder === '0').pop()!, comision)
    const crear = f.elementos('button').filter((b) => b.props.variant === 'success').pop()!
    await (crear.props.onClick as () => unknown)()
    f.rendir()
    return { f, cuerpo: api.llamadas.find((l) => l.que === 'crearCliente')?.cuerpo as Record<string, unknown> | undefined }
  }

  async function filaAgencia(idioma: Idioma, comision: string) {
    const f = montar(() => en(idioma, createElement(ComisionesPage)))
    f.teclear('Agencia Uno', comision)
    const guardar = f.elementos('button').find((b) => textoDe(b.props.children) === t(idioma, 'comun.guardar'))!
    const cambiado = !guardar.props.disabled
    if (cambiado) await (guardar.props.onClick as () => unknown)()
    f.rendir()
    return { cambiado, cuerpo: api.llamadas.find((l) => l.que === 'actualizarCliente')?.cuerpo as unknown[] | undefined }
  }

  it('ITALIANO · el alta guarda «12,5» como 12.5', async () => {
    const r = await altaAgencia('it', '12,5')
    expect(r.cuerpo).toMatchObject({ comisionAgenciaPct: 12.5 })
  })

  it('ITALIANO · NEGATIVO: el alta con «12.5» no se manda (antes guardaba 0)', async () => {
    const r = await altaAgencia('it', '12.5')
    expect(r.cuerpo).toBeUndefined()
  })

  it('ITALIANO · la fila guarda «12,5» como 12.5, y «12.5» no cuenta como cambio', async () => {
    expect((await filaAgencia('it', '12,5')).cuerpo).toEqual(['ag1', { comisionAgenciaPct: 12.5 }])
    reiniciarTienda()
    api.llamadas.length = 0
    const mal = await filaAgencia('it', '12.5')
    expect(mal.cambiado).toBe(false)
    expect(mal.cuerpo).toBeUndefined()
  })

  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · alta y fila como siempre: «12.5» es 12.5 y «12,5» es 0`, async () => {
      expect((await altaAgencia(idioma, '12.5')).cuerpo).toMatchObject({ comisionAgenciaPct: 12.5 })
      reiniciarTienda()
      api.llamadas.length = 0
      expect((await altaAgencia(idioma, '12,5')).cuerpo).toMatchObject({ comisionAgenciaPct: 0 })
      reiniciarTienda()
      api.llamadas.length = 0
      expect((await filaAgencia(idioma, '12.5')).cuerpo).toEqual(['ag1', { comisionAgenciaPct: 12.5 }])
    })
  }
})

// ─── Catálogos: el porcentaje del código y del tramo de volumen ──────────────
describe('Códigos y descuento por volumen · el porcentaje', () => {
  async function codigo(idioma: Idioma, pct: string) {
    const f = montar(() => en(idioma, createElement(GestionCodigos)), { efectos: true })
    await f.asentar()
    f.teclear('VERANO20', 'OTONO26')
    f.teclear(t(idioma, 'codigos.nuevo.descuento-etiqueta'), pct)
    f.teclear(t(idioma, 'codigos.nuevo.hasta'), '2099-12-31')
    await f.pulsarBoton(f.elementos('button').find((b) => b.props.variant === 'success')!)
    return api.llamadas.find((l) => l.que === 'guardarCodigo')?.cuerpo as Record<string, unknown> | undefined
  }
  async function tramo(idioma: Idioma, desde: string, pct: string) {
    const f = montar(() => en(idioma, createElement(GestionVolumen)), { efectos: true })
    await f.asentar()
    f.teclear(t(idioma, 'catalogos.volumen.cantidad.placeholder'), desde)
    f.teclear(t(idioma, 'catalogos.volumen.pct.aria'), pct)
    await f.pulsarBoton(f.elementos('button').find((b) => b.props.variant === 'success')!)
    return api.llamadas.find((l) => l.que === 'guardarTramo')?.cuerpo as Record<string, unknown> | undefined
  }

  it('ITALIANO · «12,5» % se guarda como 12.5 (código y tramo; el tramo desde «1.500»)', async () => {
    expect(await codigo('it', '12,5')).toMatchObject({ descuentoPct: 12.5 })
    reiniciarTienda()
    expect(await tramo('it', '1.500', '12,5')).toMatchObject({ desdeCantidad: 1500, descuentoPct: 12.5 })
  })

  it('ITALIANO · NEGATIVO: «12.5» no se manda', async () => {
    expect(await codigo('it', '12.5')).toBeUndefined()
    reiniciarTienda()
    expect(await tramo('it', '50', '12.5')).toBeUndefined()
  })

  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · «12.5» se guarda como 12.5 y «12,5» no se manda, como siempre`, async () => {
      expect(await codigo(idioma, '12.5')).toMatchObject({ descuentoPct: 12.5 })
      reiniciarTienda()
      api.llamadas.length = 0
      expect(await codigo(idioma, '12,5')).toBeUndefined()
      reiniciarTienda()
      expect(await tramo(idioma, '1,500', '12.5')).toMatchObject({ desdeCantidad: 1500, descuentoPct: 12.5 })
    })
  }
})
