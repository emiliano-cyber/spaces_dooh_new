import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import { traducir } from '@/lib/i18n/diccionario'
import { montar, reiniciarTienda } from '@/lib/test/formulario-sin-dom'

// ============================================================================
//  CAMPOS-PANTALLA (11/11) · cada empresa quita del alta de pantalla lo que no
//  usa, al instalar su servidor. Lo que se defiende:
//   · un campo oculto NO se pinta y NO bloquea el alta;
//   · sin la ubicación, la pantalla nace SIN coordenadas y pendiente de
//     verificar — nunca con un punto inventado;
//   · sin el arrendador, la pantalla nace PROPIA (si no, el servidor pediría un
//     arrendador que ya no se puede elegir);
//   · y el negativo: sin nada oculto, los obligatorios siguen bloqueando.
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
    Tabs: (p: { children?: unknown; tabs?: { value: string }[] }) =>
      ce('div', { 'data-pestanas': (p.tabs ?? []).map((x) => x.value).join(',') }, p.children as never),
    TabPanel: (p: { children?: unknown }) => ce('div', null, p.children as never),
  }
})
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const { llamadas, ocultos } = vi.hoisted(() => ({
  llamadas: [] as unknown[],
  ocultos: { valor: [] as string[] },
}))
vi.mock('@/lib/data/sitios-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  altaSitioApi: vi.fn(async (cuerpo: unknown) => {
    llamadas.push(cuerpo)
    return { id: 'nuevo', ...(cuerpo as object) }
  }),
}))
vi.mock('@/lib/data/client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useArrendadores: () => [{ id: 'a1', nombre: 'Arrendador Uno' }],
}))
vi.mock('@/lib/data/campos-pantalla-api', () => ({ useCamposOcultosPantalla: () => ocultos.valor }))

const { NuevaPantallaForm } = await import('./NuevaPantallaForm')

const GUARDAR = traducir('es', 'inventario.alta.guardar')
function montarForm() {
  return montar(() =>
    createElement(
      ProveedorIdioma,
      { idioma: 'es', puedeElegir: false, disponibles: ['es'] },
      createElement(NuevaPantallaForm, { open: true, onOpenChange: () => {}, onCreado: () => {}, inline: true }),
    ) as ReactElement,
  )
}

beforeEach(() => {
  reiniciarTienda()
  llamadas.length = 0
  ocultos.valor = []
})

describe('NuevaPantallaForm · campos ocultos por la instancia', () => {
  it('con ubicación, imagen y arrendador ocultos, basta el NOMBRE: nace propia, sin coordenadas y pendiente', async () => {
    ocultos.valor = ['ubicacion', 'imagen', 'arrendador']
    const f = montarForm()
    // Ni la casilla «propia», ni el selector de arrendador, ni la latitud, ni el archivo.
    expect(f.elementos('input').some((e) => e.props.type === 'checkbox' && e.props.className === 'mt-0.5')).toBe(false)
    expect(f.elementos('input').some((e) => e.props.type === 'file')).toBe(false)
    expect(f.html).not.toContain(traducir('es', 'inventario.alta.latitud'))
    expect(f.html).not.toContain(traducir('es', 'inventario.alta.elige-arrendador'))
    expect(f.html).toContain('data-pestanas="basico,specs,ia,precios"')

    f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Pantalla Uno')
    expect(f.botonDeshabilitado(GUARDAR)).toBe(false)
    await f.pulsar(GUARDAR)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]).toMatchObject({
      nombre: 'Pantalla Uno',
      propio: true,
      lat: null,
      lng: null,
      pendienteVerificacion: true,
      imagenPromocional: null,
    })
    expect(llamadas[0]).not.toHaveProperty('arrendadorId')
  })

  it('una pestaña con TODOS sus campos ocultos desaparece', () => {
    ocultos.valor = ['resolucion', 'caras', 'modalidades', 'slots', 'vision', 'tarifa', 'precio-m2']
    const f = montarForm()
    expect(f.html).toContain('data-pestanas="basico,imagenes"')
  })

  it('NEGATIVO · sin nada oculto, solo el nombre NO da de alta: faltan ubicación, imagen y arrendador', async () => {
    const f = montarForm()
    f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Pantalla Uno')
    await f.pulsar(GUARDAR, { aunqueApagado: true })
    expect(llamadas).toHaveLength(0)
  })
})

describe('AltaSitioDialog (Comercial) · campos ocultos por la instancia', () => {
  const CREAR = traducir('es', 'comercial.alta.crear')
  async function montarAlta() {
    const { AltaSitioDialog } = await import('@/components/demo/comercial/AltaSitioDialog')
    return montar(() =>
      createElement(
        ProveedorIdioma,
        { idioma: 'es', puedeElegir: false, disponibles: ['es'] },
        createElement(AltaSitioDialog, { open: true, onOpenChange: () => {}, onCreado: () => {} }),
      ) as ReactElement,
    )
  }

  it('sin arrendador, distrito, dirección ni ubicación, basta el nombre: nace propia y pendiente', async () => {
    ocultos.valor = ['arrendador', 'distrito', 'direccion', 'ubicacion']
    const f = await montarAlta()
    expect(f.html).not.toContain(traducir('es', 'comercial.alta.distrito'))
    expect(f.html).not.toContain(traducir('es', 'comercial.comun.ubicacion'))
    f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Pantalla Dos')
    await f.pulsar(CREAR)
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]).toMatchObject({ nombre: 'Pantalla Dos', propio: true, lat: null, lng: null, pendienteVerificacion: true })
  })

  it('NEGATIVO · sin nada oculto, solo el nombre NO crea: faltan arrendador, distrito y dirección', async () => {
    const f = await montarAlta()
    f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Pantalla Dos')
    await f.pulsar(CREAR, { aunqueApagado: true })
    expect(llamadas).toHaveLength(0)
  })
})
