import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, useState, type ReactElement } from 'react'
import { ProveedorIdioma } from './contexto'
import { traducir } from './diccionario'
import type { Idioma } from './idiomas'
import { montar, reiniciarTienda } from '@/lib/test/formulario-sin-dom'
import { leerCifra } from '@/lib/captura-cifra'

// ============================================================================
//  D18 (decisión del dueño del 2026-11-05, opción b) · EN LOS FORMULARIOS DE
//  VERDAD, lo mal puesto TECLEADO no se manda, y lo bien puesto llega con su
//  valor. En español y en inglés.
// ----------------------------------------------------------------------------
//  Hasta ese día, «2,5» tecleado en la tarifa del alta de Comercial daba de
//  alta la pantalla con tarifa 25, sin un aviso; pegado, se rechazaba. Aquí se
//  teclea TECLA A TECLA (`teclearTeclaATecla`, como una persona) en tres
//  formularios con `CampoCifra` —dos de dinero y uno de pesos enteros— y se
//  mira lo que llega a la API (mockeada), pulsando el botón AUNQUE esté
//  apagado: la guardia de dentro tiene que parar sola.
//
//  Los campos que en español e inglés son el `<input>` de siempre
//  (`EntradaCifra`: comisiones, el descuento de la propuesta, medidas) NO
//  reagrupaban nada, así que no tenían la diferencia entre teclear y pegar que
//  decide D18; los fija `cifras-formularios.test.ts` y no cambian.
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
vi.mock('@/components/demo/ui/Modal', async () => {
  const { createElement: ce } = await import('react')
  return {
    Modal: (p: { open: boolean; children: unknown; footer?: unknown }) =>
      p.open ? ce('div', null, p.children as never, p.footer as never) : null,
  }
})
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
vi.mock('@/components/demo/comercial-opex/SelectorUbicacion', () => ({ SelectorUbicacion: () => null }))
vi.mock('@/components/demo/MapView', () => ({ MapView: () => null }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const { api, apunta } = vi.hoisted(() => {
  const api = { llamadas: [] as Array<{ que: string; cuerpo: unknown }> }
  const apunta = (que: string) => async (...args: unknown[]) => {
    api.llamadas.push({ que, cuerpo: args.length === 1 ? args[0] : args })
    return { id: 'nuevo', ...(args[args.length - 1] as object) }
  }
  return { api, apunta }
})
vi.mock('@/lib/data/sitios-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  altaSitioApi: vi.fn(apunta('altaSitio')),
}))
vi.mock('@/lib/data/paquetes-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  paquetesApi: vi.fn(async () => []),
  guardarPaqueteApi: vi.fn(apunta('guardarPaquete')),
}))
vi.mock('@/lib/data/client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useArrendadores: () => [{ id: 'a1', nombre: 'Arrendador Uno' }],
  useSitios: () => [
    { id: 's1', nombre: 'Pantalla Uno', tarifaMensual: 1000 },
    { id: 's2', nombre: 'Pantalla Dos', tarifaMensual: 2000 },
  ],
  useCampanas: () => [],
  useClientes: () => [],
  usePropuestas: () => [],
  usePredios: () => [],
  useContratos: () => [],
  useConfigNegocio: () => ({ ivaTasas: [16], maxClientesPantalla: null, topeDescuentoPct: 100 }),
}))
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
import { GestionPaquetes } from '@/components/demo/paquetes/GestionPaquetes'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'

function en(idioma: Idioma, hijo: ReactElement) {
  return createElement(ProveedorIdioma, { idioma, puedeElegir: true, disponibles: ['es', 'en', 'it'] }, hijo)
}
const t = (idioma: Idioma, clave: Parameters<typeof traducir>[1], v?: Record<string, string | number>) =>
  traducir(idioma, clave, v)
/** El motivo que da el mismo texto PEGADO: el aviso tiene que ser ese. */
const motivoAlPegar = (texto: string, idioma: Idioma, decimales = 2) => {
  const r = leerCifra(texto, { decimales, minimo: 0, idioma })
  if (r.ok) throw new Error(`«${texto}» se lee bien`)
  return r.error
}
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

beforeEach(() => {
  reiniciarTienda()
  api.llamadas.length = 0
})

for (const idioma of ['es', 'en'] as const) {
  const I = idioma.toUpperCase()

  // ─── Alta de pantalla desde Comercial: la tarifa ─────────────────────────
  describe(`D18 · ${I} · Alta de Comercial (la tarifa, tecleada tecla a tecla)`, () => {
    async function alta(tarifa: string) {
      const f = montar(() => en(idioma, createElement(AltaSitioDialog, { open: true, onOpenChange: () => {}, onCreado: () => {} })))
      f.teclearEn(f.elementos('input').find((e) => e.props.type === 'checkbox')!, 'true') // propia
      f.teclearEn(f.elementos('input').filter((e) => e.props.autoFocus)[0], 'Pantalla Uno')
      f.teclear('Miraflores', 'Centro')
      f.teclear(t(idioma, 'comercial.alta.direccion-mostrada'), 'Av. Siempre Viva 1')
      const campo = t(idioma, 'comercial.comun.ej', { valor: '15000' })
      f.teclearTeclaATecla(campo, tarifa, true)
      const valor = String(f.campo(campo, true).props.value)
      const htmlTecleando = f.html
      f.salir(campo, true)
      const deshabilitado = f.botonDeshabilitado(t(idioma, 'comercial.alta.crear'))
      await f.pulsar(t(idioma, 'comercial.alta.crear'), { aunqueApagado: true })
      return { f, valor, htmlTecleando, deshabilitado, cuerpo: api.llamadas[0]?.cuerpo as Record<string, unknown> | undefined }
    }

    for (const malo of ['2,5', '12,34', '1,5000', '15000,50']) {
      it(`NEGATIVO · «${malo}» no se manda, se ve como se tecleó y avisa con el motivo de pegarlo`, async () => {
        const r = await alta(malo)
        expect(api.llamadas).toHaveLength(0)
        expect(r.deshabilitado).toBe(true)
        expect(r.valor).toBe(malo === '15000,50' ? '15,000,50' : malo)
        expect(r.f.html).toContain(escapar(motivoAlPegar(r.valor, idioma)))
      })
    }

    it('a media escritura NO avisa: «1,5» no pinta el motivo hasta salir del campo', async () => {
      const r = await alta('1,5')
      expect(r.htmlTecleando).not.toContain('role="alert"')
      expect(r.f.html).toContain('role="alert"')
      expect(api.llamadas).toHaveLength(0)
    })

    for (const [bueno, valor] of [['1,500', 1500], ['12,500.50', 12500.5], ['2.5', 2.5], ['1500', 1500]] as const) {
      it(`«${bueno}» llega como ${valor}`, async () => {
        const r = await alta(bueno)
        expect(r.cuerpo).toMatchObject({ tarifaPublicada: valor })
        expect(r.f.html).not.toContain('role="alert"')
      })
    }
  })

  // ─── Alta manual de Inventario: la tarifa publicada ──────────────────────
  describe(`D18 · ${I} · Alta manual de Inventario (la tarifa publicada)`, () => {
    async function alta(tarifa: string) {
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
      const campo = t(idioma, 'comercial.comun.ej', { valor: '15000' })
      f.teclearTeclaATecla(campo, tarifa, true)
      f.salir(campo, true)
      const boton = t(idioma, 'inventario.alta.guardar')
      await f.pulsar(boton, { aunqueApagado: true })
      return { f, cuerpo: api.llamadas[0]?.cuerpo as Record<string, unknown> | undefined }
    }

    for (const malo of ['2,5', '12,34', '1,5000']) {
      it(`NEGATIVO · «${malo}» no se manda`, async () => {
        const r = await alta(malo)
        expect(api.llamadas).toHaveLength(0)
        expect(r.f.html).toContain(escapar(motivoAlPegar(malo, idioma)))
      })
    }
    for (const [bueno, valor] of [['1,500', 1500], ['12,500.50', 12500.5], ['2.5', 2.5]] as const) {
      it(`«${bueno}» llega como ${valor}`, async () => {
        expect((await alta(bueno)).cuerpo).toMatchObject({ tarifaPublicada: valor })
      })
    }
  })

  // ─── Paquetes cerrados: el precio, en pesos ENTEROS ──────────────────────
  describe(`D18 · ${I} · Paquete cerrado (el precio, sin decimales)`, () => {
    async function paquete(precio: string) {
      const f = montar(() => en(idioma, createElement(GestionPaquetes)), { efectos: true })
      await f.asentar()
      f.teclear(t(idioma, 'catalogos.paquetes.nombre.aria'), 'Paquete Uno', true)
      // Las dos pantallas, una a una: cada `onChange` cierra sobre el estado de su render.
      for (const i of [0, 1]) f.teclearEn(f.elementos('input').filter((x) => x.props.type === 'checkbox' && !x.props['aria-label'])[i], 'true')
      const campo = t(idioma, 'catalogos.paquetes.precio.aria')
      f.teclearTeclaATecla(campo, precio, true)
      f.salir(campo, true)
      await f.pulsar(t(idioma, 'catalogos.paquetes.crear'), { aunqueApagado: true })
      return { f, cuerpo: api.llamadas.find((l) => l.que === 'guardarPaquete')?.cuerpo as Record<string, unknown> | undefined }
    }

    for (const malo of ['2,5', '180,00', '1,5000']) {
      it(`NEGATIVO · «${malo}» no se manda (antes ${malo.replace(/,/g, '')})`, async () => {
        const r = await paquete(malo)
        expect(r.cuerpo).toBeUndefined()
        expect(r.f.html).toContain(escapar(motivoAlPegar(malo, idioma, 0)))
      })
    }
    it('«180,000» llega como 180000', async () => {
      expect((await paquete('180,000')).cuerpo).toMatchObject({ precioCerrado: 180000, sitios: ['s1', 's2'] })
    })
    it('«180000» se pinta «180,000» y llega como 180000, como siempre', async () => {
      const r = await paquete('180000')
      expect(r.f.campo(t(idioma, 'catalogos.paquetes.precio.aria'), true).props.value).toBe('180,000')
      expect(r.cuerpo).toMatchObject({ precioCerrado: 180000 })
    })
  })

  // ─── El campo solo: Enter también enseña el aviso; y lo que repinta el padre ──
  describe(`D18 · ${I} · CampoCifra suelto`, () => {
    function campo(opciones: { guardaUltimoValido?: boolean } = {}) {
      const recibidos: string[] = []
      function F() {
        const [v, setV] = useState('')
        return createElement(CampoCifra, {
          valor: v,
          placeholder: 'importe',
          idioma,
          onCambio: (crudo, lectura) => {
            recibidos.push(crudo)
            if (!opciones.guardaUltimoValido || lectura.ok) setV(crudo)
          },
        })
      }
      return { f: montar(() => createElement(F), { efectos: true, refs: true }), recibidos }
    }

    it('Enter enseña el aviso de lo que se dejó a medias', () => {
      const { f } = campo()
      f.teclearTeclaATecla('importe', '2,5')
      expect(f.html).not.toContain('role="alert"')
      expect(f.campo('importe').props['aria-invalid']).toBeUndefined()
      f.pulsarTecla('importe', 'Enter')
      expect(f.html).toContain('role="alert"')
      expect(f.campo('importe').props['aria-invalid']).toBe(true)
    })

    it('lo PEGADO no va a medias: «2,5» pegado avisa en el acto, como siempre', () => {
      const { f } = campo()
      f.teclear('importe', '2,5')
      expect(f.html).toContain('role="alert"')
      expect(f.campo('importe').props['aria-invalid']).toBe(true)
    })

    it('mientras se teclea, el formulario recibe NaN (no 2 ni 25) y al final la cifra', () => {
      const { f, recibidos } = campo()
      f.teclearTeclaATecla('importe', '2,500')
      expect(recibidos).toEqual(['2', 'NaN', 'NaN', 'NaN', '2500'])
      expect(f.campo('importe').props.value).toBe('2,500')
    })

    it('un padre que se queda con el último valor válido NO borra la coma a media escritura: «1,000» se puede teclear', () => {
      const { f, recibidos } = campo({ guardaUltimoValido: true })
      f.teclearTeclaATecla('importe', '1,000')
      expect(f.campo('importe').props.value).toBe('1,000')
      expect(recibidos.at(-1)).toBe('1000')
    })

    it('…y si lo deja mal puesto, al salir enseña lo que el padre guardó (nunca otra cifra)', () => {
      const { f } = campo({ guardaUltimoValido: true })
      f.teclearTeclaATecla('importe', '2,5')
      expect(f.campo('importe').props.value).toBe('2,5')
      f.salir('importe')
      f.rendir() // el efecto que repinta corre tras el render, como en React
      expect(f.campo('importe').props.value).toBe('2')
    })
  })
}
