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
vi.mock('@/components/demo/ui/Sheet', async () => {
  const { createElement: ce } = await import('react')
  return {
    Sheet: (p: { open: boolean; children: unknown; footer?: unknown }) =>
      p.open ? ce('aside', null, p.children as never, p.footer as never) : null,
  }
})
vi.mock('@/components/demo/comercial-opex/SelectorUbicacion', () => ({ SelectorUbicacion: () => null }))
vi.mock('@/components/demo/MapView', () => ({ MapView: () => null }))
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
  actualizarSitioApi: vi.fn(apunta('actualizarSitio')),
}))
vi.mock('@/lib/data/captacion-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fichaApi: vi.fn(apunta('ficha')),
  // Se apunta y se rechaza: la ficha del prospecto creado (con su historia)
  // no es lo que se mide aquí.
  crearProspectoApi: vi.fn(async (cuerpo: unknown) => {
    await apunta('crearProspecto')(cuerpo)
    throw new Error('prueba: no se abre la ficha')
  }),
  prospectosApi: vi.fn(async () => ({ prospectos: [], total: 0, porEtapa: {} })),
}))
vi.mock('@/lib/data/estado-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  crearOrdenImpresionApi: vi.fn(apunta('crearOrdenImpresion')),
  crearClienteApi: vi.fn(apunta('crearCliente')),
  actualizarClienteApi: vi.fn(apunta('actualizarCliente')),
  agregarPantallaAPredioApi: vi.fn(apunta('agregarPantallaAPredio')),
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
  useCampanasResumen: () => [],
  usePredios: () => [{ id: 'p1', nombre: 'Predio Uno', arrendadorId: 'a1', direccion: null }],
  useContratos: () => [
    { id: 'k1', predioId: 'p1', arrendadorId: 'a1', estatus: 'VIGENTE', fechaInicio: '2026-01-01', fechaFin: '2027-12-31', montoRenta: 1000 },
  ],
  useConfigNegocio: () => ({ ivaTasas: [16], maxClientesPantalla: null, topeDescuentoPct: 100 }),
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
import { EditarSitioDialog } from '@/components/demo/comercial/SiteFicha'
import { ContratoWizard } from '@/components/demo/inventario/ContratoWizard'
import { Captacion, CLAVE_TIPO_PROSPECTO } from '@/components/demo/captacion/Captacion'
import { Ficha } from '@/components/demo/comercial-opex/ComercialOpex'
import ClientesPage from '@/app/(app)/(shell)/clientes/page'

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
  async function alta(idioma: Idioma, ancho: string, alto: string, modo: 'pegar' | 'teclear' = 'pegar') {
    const f = montar(() => en(idioma, createElement(AltaSitioDialog, { open: true, onOpenChange: () => {}, onCreado: () => {} })))
    // Pantalla propia: sin arrendador que elegir.
    f.teclearEn(f.elementos('input').find((e) => e.props.type === 'checkbox')!, 'true')
    const textos = f.elementos('input').filter((e) => e.props.autoFocus)
    f.teclearEn(textos[0], 'Pantalla Uno')
    f.teclear('Miraflores', 'Centro')
    f.teclear(t(idioma, 'comercial.alta.direccion-mostrada'), 'Av. Siempre Viva 1')
    const decimal = idioma === 'it' ? ',' : '.'
    const escribir = modo === 'pegar' ? f.teclear.bind(f) : f.teclearTeclaATecla.bind(f)
    escribir(`12${decimal}9`, ancho)
    escribir(`7${decimal}2`, alto)
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

  // B77 · tecleado tecla a tecla, que es como escribe una persona: el punto
  // a la inglesa no puede tragarse y convertir 12.9 m en 129 m.
  it('ITALIANO · TECLEADO tecla a tecla: «12,9» y «1.500,50» se guardan como 12.9 y 1500.5', async () => {
    const r = await alta('it', '12,9', '1.500,50', 'teclear')
    expect(r.cuerpo).toMatchObject({ ancho: 12.9, alto: 1500.5 })
  })

  it('ITALIANO · TECLEADO · NEGATIVO: «12.9» y «2.5» no se mandan (antes salían 129 y 25)', async () => {
    const r = await alta('it', '12.9', '2.5', 'teclear')
    expect(r.deshabilitado).toBe(true)
    expect(api.llamadas).toHaveLength(0)
    expect(r.f.html).toContain('value="12.9"')
    expect(r.f.html).toContain('value="2.5"')
  })

  it('ITALIANO · TECLEADO · «15000,50» se pinta 15.000,50 y se guarda 15000.5', async () => {
    const r = await alta('it', '15000,50', '7,2', 'teclear')
    expect(r.f.html).toContain('value="15.000,50"')
    expect(r.cuerpo).toMatchObject({ ancho: 15000.5, alto: 7.2 })
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

// ─── B79 (supervisión, 04/11) · las guardias que ninguna prueba defendía ─────
// En italiano, una cifra que no se entiende llega como 'NaN'. Cada formulario
// tiene que NO mandarla —tampoco como `null` en JSON, que BORRARÍA el dato
// guardado—, aunque se pulse el botón apagado. Y lo que sí se entiende se
// manda con su valor. Se pega «12.9» (ilegible en italiano) y «12,9».
const pulsarAunqueApagado = async (f: ReturnType<typeof montar>, e: { props: Record<string, unknown> } | undefined) => {
  if (!e) throw new Error('no hay botón')
  await (e.props.onClick as (ev: unknown) => unknown)?.({ preventDefault() {} })
  f.rendir()
}
const cifrasDe = (f: ReturnType<typeof montar>, idioma: Idioma) =>
  f.elementos('input').filter((e) => (idioma === 'it' ? e.props.inputMode === 'decimal' || e.props.inputMode === 'numeric' : e.props.type === 'number'))

describe('B79 · Editar sitio (ancho)', () => {
  const SITIO = {
    id: 's1', nombre: 'Pantalla Uno', tipoMedio: 'ESPECTACULAR', exhibicion: 'fijo', esRotativo: false,
    estatusComercial: 'DISPONIBLE', ancho: 6, alto: 3, caras: 1, tarifaPublicada: 1000, iluminado: true,
    arrendadorId: 'a1', maxClientes: null, propio: false,
  }
  async function editar(idioma: Idioma, ancho: string) {
    const f = montar(() => en(idioma, createElement(EditarSitioDialog, { sitio: SITIO as never, open: true, onClose: () => {} })))
    f.teclearEn(cifrasDe(f, idioma)[0], ancho)
    const guardar = f.elementos('button').find((b) => textoDe(b.props.children).includes(t(idioma, 'comercial.editar.guardar')))
    await pulsarAunqueApagado(f, guardar)
    return api.llamadas.find((l) => l.que === 'actualizarSitio')?.cuerpo as unknown[] | undefined
  }
  it('ITALIANO · «12,9» se manda como 12.9', async () => {
    expect((await editar('it', '12,9'))?.[1]).toMatchObject({ ancho: 12.9 })
  })
  it('ITALIANO · NEGATIVO: «12.9» no se manda (ni como null que borre el ancho)', async () => {
    expect(await editar('it', '12.9')).toBeUndefined()
  })
  it('ESPAÑOL · «12.9» se manda como 12.9, como siempre', async () => {
    expect((await editar('es', '12.9'))?.[1]).toMatchObject({ ancho: 12.9 })
  })
})

describe('B79 · Asistente de contrato (caras de una pantalla nueva en un predio con contrato)', () => {
  async function asistente(idioma: Idioma, caras: string) {
    const f = montar(() => en(idioma, createElement(ContratoWizard, { bare: true })))
    f.teclearEn(f.elementos('select')[0], 'a1')
    await f.pulsar(t(idioma, 'inventario.wizard.predio-existente'))
    f.teclearEn(f.elementos('select')[1], 'p1')
    await f.pulsar(t(idioma, 'inventario.wizard.siguiente'))
    await f.pulsar(t(idioma, 'inventario.wizard.pantalla-nueva'))
    f.teclearEn(f.elementos('input').find((e) => String(e.props.placeholder ?? '').startsWith(t(idioma, 'comercial.comun.ej', { valor: 'Patr' }).slice(0, 3)) && e.props.value === '')!, 'Pantalla Nueva')
    f.teclearEn(f.elementos('input').find((e) => e.props.placeholder === '1')!, caras)
    await pulsarAunqueApagado(f, f.elementos('button').filter((b) => b.props.variant === 'success').pop())
    return api.llamadas.find((l) => l.que === 'agregarPantallaAPredio')?.cuerpo as unknown[] | undefined
  }
  it('ITALIANO · «1.500» caras se mandan como 1500', async () => {
    expect((await asistente('it', '1.500'))?.[1]).toMatchObject({ caras: 1500 })
  })
  it('ITALIANO · NEGATIVO: «12,9» caras no se manda (antes caía a 1 en silencio)', async () => {
    expect(await asistente('it', '12,9')).toBeUndefined()
  })
  it('ESPAÑOL · «3» caras como siempre', async () => {
    expect((await asistente('es', '3'))?.[1]).toMatchObject({ caras: 3 })
  })
})

describe('B79 · Captación (ancho de una pantalla prospecto)', () => {
  async function prospecto(idioma: Idioma, ancho: string) {
    const f = montar(() => en(idioma, createElement(Captacion)))
    await pulsarAunqueApagado(f, f.elementos('button').find((b) => b.props.variant === 'success'))
    await f.pulsar(t(idioma, CLAVE_TIPO_PROSPECTO.PANTALLA))
    f.teclearEn(f.elementos('input').find((e) => e.props.maxLength === 200)!, 'Azotea Norte')
    f.teclearEn(cifrasDe(f, idioma)[0], ancho)
    const guardar = f.elementos('button').filter((b) => textoDe(b.props.children) === t(idioma, 'comun.guardar')).pop()
    await pulsarAunqueApagado(f, guardar)
    return api.llamadas.find((l) => l.que === 'crearProspecto')?.cuerpo as Record<string, unknown> | undefined
  }
  it('ITALIANO · «12,9» se manda como 12.9', async () => {
    expect((await prospecto('it', '12,9'))?.datos).toMatchObject({ anchoM: 12.9 })
  })
  it('ITALIANO · NEGATIVO: «12.9» no se manda (ni como null)', async () => {
    expect(await prospecto('it', '12.9')).toBeUndefined()
  })
  it('ESPAÑOL · «12.9» como siempre', async () => {
    expect((await prospecto('es', '12.9'))?.datos).toMatchObject({ anchoM: 12.9 })
  })
})

describe('B79 · Negociación (la ficha del espacio)', () => {
  const P = { id: 'pr1', tipoEspacio: '', visibilidad: '', anchoM: 6, altoM: 3, superficieM2: null, presupuestoMin: null, presupuestoMax: null, presupuestoAutoriza: '' }
  async function ficha(idioma: Idioma, ancho: string) {
    const accion = async (fn: () => Promise<unknown>) => {
      await fn()
      return true
    }
    const f = montar(() => en(idioma, createElement(Ficha, { p: P as never, accion: accion as never, puede: true })))
    f.teclearEn(cifrasDe(f, idioma)[0], ancho)
    await f.pulsar(t(idioma, 'comercial.negociacion.ficha.guardar'))
    return api.llamadas.find((l) => l.que === 'ficha')?.cuerpo as unknown[] | undefined
  }
  it('ITALIANO · «12,9» se manda como 12.9', async () => {
    expect((await ficha('it', '12,9'))?.[1]).toMatchObject({ anchoM: 12.9, altoM: 3 })
  })
  it('ITALIANO · NEGATIVO: «12.9» no se manda (antes viajaba como null y borraba el ancho)', async () => {
    expect(await ficha('it', '12.9')).toBeUndefined()
  })
  it('ESPAÑOL · «12.9» como siempre', async () => {
    expect((await ficha('es', '12.9'))?.[1]).toMatchObject({ anchoM: 12.9 })
  })
})

describe('B79 · Clientes (alta de una agencia con su comisión)', () => {
  async function cliente(idioma: Idioma, comision: string) {
    const f = montar(() => en(idioma, createElement(ClientesPage)))
    await pulsarAunqueApagado(f, f.elementos('button').find((b) => b.props.variant === 'success'))
    f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Agencia Tres')
    f.teclearEn(f.elementos('select').find((e) => e.props.value === 'DIRECTO')!, 'AGENCIA')
    f.teclearEn(f.elementos('input').filter((e) => e.props.placeholder === '0').pop()!, comision)
    const guardar = f.elementos('button').filter((b) => textoDe(b.props.children) === t(idioma, 'comun.guardar')).pop()
    await pulsarAunqueApagado(f, guardar)
    return api.llamadas.find((l) => l.que === 'crearCliente')?.cuerpo as Record<string, unknown> | undefined
  }
  it('ITALIANO · «12,5» % se manda como 12.5', async () => {
    expect(await cliente('it', '12,5')).toMatchObject({ comisionAgenciaPct: 12.5 })
  })
  it('ITALIANO · NEGATIVO: «12.5» no se manda (antes se guardaba 0)', async () => {
    expect(await cliente('it', '12.5')).toBeUndefined()
  })
  it('ESPAÑOL · «12.5» como siempre, y «12,5» es 0 como siempre', async () => {
    expect(await cliente('es', '12.5')).toMatchObject({ comisionAgenciaPct: 12.5 })
    reiniciarTienda()
    api.llamadas.length = 0
    expect(await cliente('es', '12,5')).toMatchObject({ comisionAgenciaPct: 0 })
  })
})
