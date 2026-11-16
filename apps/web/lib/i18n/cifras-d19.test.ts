import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, useState, type ReactElement } from 'react'
import { ProveedorIdioma } from './contexto'
import { traducir } from './diccionario'
import type { Idioma } from './idiomas'
import { montar, reiniciarTienda, textoDe } from '@/lib/test/formulario-sin-dom'


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
vi.mock('@/components/demo/shell/SesionContext', () => ({
  usePuede: () => true,
  useSesionCtx: () => ({ sesion: { usuario: { id: 'u1', rol: 'DUENO', nombre: 'Dueño' }, tenant: { id: 't1' } }, refrescar: async () => {} }),
}))
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

const { api, apunta, AGENCIA, PROPUESTA } = vi.hoisted(() => {
  const api = { llamadas: [] as Array<{ que: string; cuerpo: unknown }> }
  const apunta = (que: string) => async (...args: unknown[]) => {
    api.llamadas.push({ que, cuerpo: args.length === 1 ? args[0] : args })
    return { id: 'nuevo', ...(args[args.length - 1] as object) }
  }
  const AGENCIA = {
    id: 'ag1', nombre: 'Agencia Uno', tipo: 'AGENCIA', comisionAgenciaPct: 10, tieneNegociacion: false,
    negociacionValidada: false, contacto: {}, ivaPct: 16,
  }
  const PROPUESTA = {
    id: 'p1', folio: 'PR-0001', tokenPublico: 'tok', clienteId: 'ag1', agenciaId: null, nombre: 'Campaña Uno',
    fecha: '2026-10-01', estatus: 'BORRADOR', comisionPct: 0, descuentoPct: 0, version: 1, notas: null,
    creadoEn: '2026-10-01', condiciones: '', vigenteHasta: '2099-12-01', vencida: false, items: [],
    bruto: 0, descuentoVolumenPct: 0, descuentoVolumenMonto: 0, paquete: null, brutoConVolumen: 0, descuentoMonto: 0,
    codigoTexto: null, codigoDescuentoPct: 0, codigoDescuentoMonto: 0, codigoEstado: null, baseComercial: 0, base: 0,
    divisor: 1, neto: 0, iva: 0, total: 0, itemsAprobados: 0, brutoAprobado: 0, descuentoVolumenMontoAprobado: 0,
    codigoDescuentoMontoAprobado: 0, baseAprobado: 0, netoAprobado: 0, ivaAprobado: 0, totalAprobado: 0,
  }
  return { api, apunta, AGENCIA, PROPUESTA }
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
  actualizarPropuestaApi: vi.fn(apunta('actualizarPropuesta')),
  refrescarEstado: vi.fn(async () => {}),
}))
vi.mock('@/lib/data/paquetes-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  paquetesApi: vi.fn(async () => []),
}))
vi.mock('@/components/demo/codigos/BloqueCodigoPropuesta', () => ({ BloqueCodigoPropuesta: () => null }))
vi.mock('@/components/demo/propuestas/ElegirClienteDialog', () => ({ ElegirClienteDialog: () => null }))
vi.mock('@/components/demo/propuestas/BloqueCondicionesVigencia', () => ({ BloqueCondicionesVigencia: () => null }))
vi.mock('@/components/demo/propuestas/EnviarPropuestaDialog', () => ({ EnviarPropuestaDialog: () => null }))
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
  usePropuestas: () => [PROPUESTA],
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

vi.mock('@/lib/data/admin-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listarUsuariosApi: vi.fn(async () => []),
  getPermisosMatrizApi: vi.fn(async () => null),
  getConfigApi: vi.fn(async () => ({ ...CONFIG })),
  actualizarConfigApi: vi.fn(async (c: object) => {
    await apunta('actualizarConfig')(c)
    return { ...CONFIG, ...c }
  }),
}))
vi.mock('@/components/demo/admin/OrganizacionesPanel', () => ({ OrganizacionesPanel: () => null }))
vi.mock('@/components/demo/admin/ControlCambiosPanel', () => ({ ControlCambiosPanel: () => null }))
vi.mock('@/components/demo/admin/ActualizacionesPanel', () => ({ ActualizacionesPanel: () => null }))
vi.mock('@/components/demo/admin/TicketsPanel', () => ({ TicketsPanel: () => null }))

const { CONFIG } = vi.hoisted(() => ({
  CONFIG: {
    ivaTasas: [16], plazosCobranza: [30], topeDescuentoPct: 100, maxClientesPantalla: null, costosOt: {},
    tiposOt: [], moneda: 'MXN',
  } as Record<string, unknown>,
}))

import ComisionesPage from '@/app/(app)/(shell)/comisiones/page'
import ClientesPage from '@/app/(app)/(shell)/clientes/page'
import AdministracionPage from '@/app/(app)/(shell)/administracion/page'
import PropuestaDetallePage from '@/app/(app)/(shell)/propuestas/[id]/page'
import { GestionCodigos } from '@/components/demo/codigos/GestionCodigos'
import { GestionVolumen } from '@/components/demo/volumen/GestionVolumen'
import { Ficha } from '@/components/demo/comercial-opex/ComercialOpex'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { leerCifra, motivoCifraMalEscrita, cifraMalEscrita } from '@/lib/captura-cifra'

// ============================================================================
//  D19 (decisión del dueño del 2026-11-05, opción b) · EN ESPAÑOL E INGLÉS,
//  LOS CAMPOS DE PORCENTAJE Y DE DINERO QUE SON `EntradaCifra` AVISAN DE LO
//  QUE NO ES UNA CIFRA Y NO LO GUARDAN.
// ----------------------------------------------------------------------------
//  Hasta ese día, «12,5» en la comisión de una agencia se guardaba como 0 %
//  sin un aviso (`Number('12,5') || 0`), la tasa de IVA nueva se borraba sin
//  agregarse y el presupuesto de una negociación viajaba como `null` y BORRABA
//  el guardado. Con una cifra bien escrita, el `<input>` y su HTML son los de
//  siempre. Se teclea TECLA A TECLA y se pega; se pulsa el botón aunque esté
//  apagado y se prueba Enter donde lo hay.
// ============================================================================

function en(idioma: Idioma, hijo: ReactElement) {
  return createElement(ProveedorIdioma, { idioma, puedeElegir: true, disponibles: ['es', 'en', 'it'] }, hijo)
}
const t = (idioma: Idioma, clave: Parameters<typeof traducir>[1], v?: Record<string, string | number>) =>
  traducir(idioma, clave, v)
const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
type Montado = ReturnType<typeof montar>
type El = { props: Record<string, unknown> }

/** Teclea `valor` carácter a carácter en el input que devuelve `buscar` (se busca de nuevo en cada render). */
function teclearCadaTecla(f: Montado, buscar: () => El, valor: string) {
  for (const ch of valor) {
    const e = buscar()
    const nuevo = String(e.props.value ?? '') + ch
    ;(e.props.onChange as (ev: unknown) => void)({ target: { value: nuevo, selectionStart: nuevo.length }, nativeEvent: { inputType: 'insertText' } })
    f.rendir()
  }
}
function pegarEn(f: Montado, e: El, valor: string) {
  ;(e.props.onChange as (ev: unknown) => void)({ target: { value: valor, selectionStart: valor.length }, nativeEvent: { inputType: 'insertFromPaste' } })
  f.rendir()
}
async function pulsarAunqueApagado(f: Montado, e: El | undefined) {
  if (!e) throw new Error('no hay botón')
  await (e.props.onClick as (ev: unknown) => unknown)?.({ preventDefault() {} })
  f.rendir()
}
async function enter(f: Montado, e: El) {
  await (e.props.onKeyDown as (ev: unknown) => unknown)?.({ key: 'Enter', preventDefault() {} })
  f.rendir()
}
/** El aviso que tiene que salir en el campo con `texto`. */
const aviso = (texto: string, idioma: Idioma) => escapar(motivoCifraMalEscrita(texto, idioma) ?? '«sin aviso»')

beforeEach(() => {
  reiniciarTienda()
  api.llamadas.length = 0
})

// ─── La regla, pura ──────────────────────────────────────────────────────────
describe('D19 · motivoCifraMalEscrita y cifraMalEscrita', () => {
  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · lo que Number() lee tal cual no tiene aviso`, () => {
      for (const ok of ['', '  ', '12.5', '0', '100', '-3', '.5', '12.', ' 7 ']) {
        expect(motivoCifraMalEscrita(ok, idioma), ok).toBeNull()
        expect(cifraMalEscrita(ok, idioma), ok).toBe(false)
      }
    })
    it(`${idioma.toUpperCase()} · «12,5» avisa con el motivo de las comas (el mismo de pegarlo en un importe)`, () => {
      const r = leerCifra('12,5', { decimales: 2, idioma })
      expect(r.ok).toBe(false)
      expect(motivoCifraMalEscrita('12,5', idioma)).toBe(!r.ok && r.error)
      expect(cifraMalEscrita('12,5', idioma)).toBe(true)
    })
    it(`${idioma.toUpperCase()} · lo que sería una cifra con comas o signo pide escribirla sola`, () => {
      expect(motivoCifraMalEscrita('1,500', idioma)).toBe(t(idioma, 'compartidos.cifra.sin-signos', { ejemplo: '1500' }))
      expect(motivoCifraMalEscrita('$12', idioma)).toBe(t(idioma, 'compartidos.cifra.sin-signos', { ejemplo: '12' }))
    })
    it(`${idioma.toUpperCase()} · letras, «1e5» y el 'NaN' de un campo numérico que el navegador no entiende avisan`, () => {
      for (const mal of ['abc', '1e5', '0x10', 'Infinity', 'NaN', '12 5']) {
        expect(cifraMalEscrita(mal, idioma), mal).toBe(true)
        expect(motivoCifraMalEscrita(mal, idioma), mal).toBeTruthy()
      }
    })
  }
  it('ITALIANO · no cambia: solo el NaN de CampoCifra es ilegible, y sin aviso aquí (lo da CampoCifra)', () => {
    expect(cifraMalEscrita('NaN', 'it')).toBe(true)
    expect(cifraMalEscrita('12.5', 'it')).toBe(false)
    expect(motivoCifraMalEscrita('12,5', 'it')).toBeNull()
  })
})

// ─── El campo: el mismo <input> cuando está bien; aviso cuando no ────────────
describe('D19 · EntradaCifra con avisaMalEscrita', () => {
  function campo(idioma: Idioma, extra: Record<string, unknown> = {}) {
    function F() {
      const [v, setV] = useState('')
      return createElement(EntradaCifra, {
        className: 'x', type: 'number', valor: v, onCambio: setV, placeholder: 'pct', decimales: 2, minimo: 0, idioma, ...extra,
      })
    }
    return montar(() => createElement(F))
  }
  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma.toUpperCase()} · con una cifra bien escrita, el HTML es el mismo que sin la propiedad`, () => {
      const a = campo(idioma, { avisaMalEscrita: true })
      a.teclear('pct', '12.5')
      reiniciarTienda()
      const b = campo(idioma)
      b.teclear('pct', '12.5')
      expect(a.html).toBe(b.html)
      expect(a.html).not.toContain('role="alert"')
    })
    it(`${idioma.toUpperCase()} · «12,5» tecleado avisa, se ve tal cual y marca el campo`, () => {
      const f = campo(idioma, { avisaMalEscrita: true })
      teclearCadaTecla(f, () => f.campo('pct'), '12,5')
      expect(f.campo('pct').props.value).toBe('12,5')
      expect(f.campo('pct').props['aria-invalid']).toBe(true)
      expect(f.html).toContain(aviso('12,5', idioma))
    })
    it(`${idioma.toUpperCase()} · sin la propiedad (medidas, caras…) no avisa: lo de siempre`, () => {
      const f = campo(idioma)
      f.teclear('pct', '12,5')
      expect(f.html).not.toContain('role="alert"')
    })
    it(`${idioma.toUpperCase()} · un campo numérico con texto que el navegador no entiende (badInput) avisa y entrega 'NaN'`, () => {
      const recibidos: string[] = []
      function F() {
        const [v, setV] = useState('')
        return createElement(EntradaCifra, {
          type: 'number', valor: v, onCambio: (c: string) => { recibidos.push(c); setV(c) }, placeholder: 'pct', decimales: 2, minimo: 0, idioma, avisaMalEscrita: true,
        })
      }
      const f = montar(() => createElement(F))
      ;(f.campo('pct').props.onChange as (ev: unknown) => void)({ target: { value: '', validity: { badInput: true } } })
      f.rendir()
      expect(recibidos).toEqual(['NaN'])
      // El campo no pinta «NaN»: deja lo que el navegador tiene escrito.
      expect(f.campo('pct').props.value).toBe('')
      expect(f.html).toContain('role="alert"')
      expect(f.html).toContain(escapar(motivoCifraMalEscrita('NaN', idioma)!))
    })
  }
})

for (const idioma of ['es', 'en'] as const) {
  const I = idioma.toUpperCase()

  // ─── Comisiones: alta de agencia y la fila de cada una ───────────────────
  describe(`D19 · ${I} · Comisiones`, () => {
    async function altaAgencia(comision: string, modo: 'teclear' | 'pegar') {
      const f = montar(() => en(idioma, createElement(ComisionesPage)))
      await pulsarAunqueApagado(f, f.elementos('button').find((b) => b.props.variant === 'success'))
      const textos = f.elementos('input').filter((e) => e.props.type !== 'checkbox' && e.props.placeholder !== '0' && !e.props['aria-label'])
      f.teclearEn(textos[0], 'Agencia Dos')
      const buscar = () => f.elementos('input').filter((e) => e.props.placeholder === '0').pop()!
      if (modo === 'teclear') teclearCadaTecla(f, buscar, comision)
      else pegarEn(f, buscar(), comision)
      await pulsarAunqueApagado(f, f.elementos('button').filter((b) => b.props.variant === 'success').pop())
      return { f, cuerpo: api.llamadas.find((l) => l.que === 'crearCliente')?.cuerpo as Record<string, unknown> | undefined }
    }
    for (const modo of ['teclear', 'pegar'] as const) {
      it(`alta · NEGATIVO · «12,5» ${modo === 'teclear' ? 'tecleado' : 'pegado'} no se guarda (antes 0 %) y avisa`, async () => {
        const r = await altaAgencia('12,5', modo)
        expect(r.cuerpo).toBeUndefined()
        expect(r.f.html).toContain(aviso('12,5', idioma))
      })
    }
    it('alta · «12.5» se guarda como 12.5, sin aviso', async () => {
      const r = await altaAgencia('12.5', 'teclear')
      expect(r.cuerpo).toMatchObject({ comisionAgenciaPct: 12.5 })
      expect(r.f.html).not.toContain('role="alert"')
    })

    async function fila(comision: string) {
      const f = montar(() => en(idioma, createElement(ComisionesPage)))
      const buscar = () => f.campo('Agencia Uno')
      teclearCadaTecla(f, () => { const e = buscar(); return e }, '\b'.repeat(0))
      pegarEn(f, buscar(), '')
      teclearCadaTecla(f, buscar, comision)
      const guardar = f.elementos('button').find((b) => textoDe(b.props.children) === t(idioma, 'comun.guardar'))!
      const apagado = !!guardar.props.disabled
      await pulsarAunqueApagado(f, guardar)
      await enter(f, buscar())
      return { f, apagado, llamadas: api.llamadas.filter((l) => l.que === 'actualizarCliente') }
    }
    it('fila · NEGATIVO · «12,5» no se guarda ni con el botón ni con Enter, y avisa', async () => {
      const r = await fila('12,5')
      expect(r.apagado).toBe(true)
      expect(r.llamadas).toHaveLength(0)
      expect(r.f.html).toContain(aviso('12,5', idioma))
    })
    it('fila · «12.5» se guarda como 12.5', async () => {
      const r = await fila('12.5')
      expect(r.llamadas[0]?.cuerpo).toEqual(['ag1', { comisionAgenciaPct: 12.5 }])
    })
  })

  // ─── Clientes: alta de una agencia con su comisión ───────────────────────
  describe(`D19 · ${I} · Clientes (comisión de la agencia)`, () => {
    async function cliente(comision: string, modo: 'teclear' | 'pegar') {
      const f = montar(() => en(idioma, createElement(ClientesPage)))
      await pulsarAunqueApagado(f, f.elementos('button').find((b) => b.props.variant === 'success'))
      f.teclearEn(f.elementos('input').find((e) => e.props.autoFocus)!, 'Agencia Tres')
      f.teclearEn(f.elementos('select').find((e) => e.props.value === 'DIRECTO')!, 'AGENCIA')
      const buscar = () => f.elementos('input').filter((e) => e.props.placeholder === '0').pop()!
      if (modo === 'teclear') teclearCadaTecla(f, buscar, comision)
      else pegarEn(f, buscar(), comision)
      const guardar = f.elementos('button').filter((b) => textoDe(b.props.children) === t(idioma, 'comun.guardar')).pop()
      await pulsarAunqueApagado(f, guardar)
      return { f, cuerpo: api.llamadas.find((l) => l.que === 'crearCliente')?.cuerpo as Record<string, unknown> | undefined }
    }
    for (const modo of ['teclear', 'pegar'] as const) {
      it(`NEGATIVO · «12,5» ${modo === 'teclear' ? 'tecleado' : 'pegado'} no se guarda (antes 0 %) y avisa`, async () => {
        const r = await cliente('12,5', modo)
        expect(r.cuerpo).toBeUndefined()
        expect(r.f.html).toContain(aviso('12,5', idioma))
      })
    }
    it('«12.5» se guarda como 12.5', async () => {
      expect((await cliente('12.5', 'teclear')).cuerpo).toMatchObject({ comisionAgenciaPct: 12.5 })
    })
  })

  // ─── Catálogos: el porcentaje del código y del tramo ─────────────────────
  describe(`D19 · ${I} · Códigos y descuento por volumen`, () => {
    async function codigo(pct: string, modo: 'teclear' | 'pegar') {
      const f = montar(() => en(idioma, createElement(GestionCodigos)), { efectos: true })
      await f.asentar()
      f.teclear('VERANO20', 'OTONO26')
      const etiqueta = t(idioma, 'codigos.nuevo.descuento-etiqueta')
      if (modo === 'teclear') f.teclearTeclaATecla(etiqueta, pct)
      else f.teclear(etiqueta, pct)
      f.teclear(t(idioma, 'codigos.nuevo.hasta'), '2099-12-31')
      await f.pulsarBoton(f.elementos('button').find((b) => b.props.variant === 'success')!)
      return { f, cuerpo: api.llamadas.find((l) => l.que === 'guardarCodigo')?.cuerpo as Record<string, unknown> | undefined }
    }
    async function tramo(pct: string, modo: 'teclear' | 'pegar') {
      const f = montar(() => en(idioma, createElement(GestionVolumen)), { efectos: true })
      await f.asentar()
      f.teclear(t(idioma, 'catalogos.volumen.cantidad.placeholder'), '50')
      const etiqueta = t(idioma, 'catalogos.volumen.pct.aria')
      if (modo === 'teclear') f.teclearTeclaATecla(etiqueta, pct)
      else f.teclear(etiqueta, pct)
      await f.pulsarBoton(f.elementos('button').find((b) => b.props.variant === 'success')!)
      return { f, cuerpo: api.llamadas.find((l) => l.que === 'guardarTramo')?.cuerpo as Record<string, unknown> | undefined }
    }
    for (const modo of ['teclear', 'pegar'] as const) {
      it(`NEGATIVO · «12,5» ${modo === 'teclear' ? 'tecleado' : 'pegado'} no se guarda (ya no lo hacía) y ahora el campo avisa`, async () => {
        const c = await codigo('12,5', modo)
        expect(c.cuerpo).toBeUndefined()
        expect(c.f.html).toContain(aviso('12,5', idioma))
        reiniciarTienda()
        const v = await tramo('12,5', modo)
        expect(v.cuerpo).toBeUndefined()
        expect(v.f.html).toContain(aviso('12,5', idioma))
      })
    }
    it('«12.5» se guarda como 12.5, sin aviso', async () => {
      const c = await codigo('12.5', 'teclear')
      expect(c.cuerpo).toMatchObject({ descuentoPct: 12.5 })
      expect(c.f.html).not.toContain('role="alert"')
      reiniciarTienda()
      expect((await tramo('12.5', 'teclear')).cuerpo).toMatchObject({ descuentoPct: 12.5 })
    })
  })

  // ─── Negociación: el presupuesto (dinero) ────────────────────────────────
  describe(`D19 · ${I} · Negociación (presupuesto de la ficha)`, () => {
    const P = { id: 'pr1', tipoEspacio: '', visibilidad: '', anchoM: 6, altoM: 3, superficieM2: null, presupuestoMin: 9000, presupuestoMax: null, presupuestoAutoriza: '' }
    async function ficha(min: string, modo: 'teclear' | 'pegar' | 'navegador') {
      const accion = async (fn: () => Promise<unknown>) => {
        await fn()
        return true
      }
      const f = montar(() => en(idioma, createElement(Ficha, { p: P as never, accion: accion as never, puede: true })))
      const buscar = () => f.elementos('input').filter((e) => e.props.type === 'number')[3]
      pegarEn(f, buscar(), '')
      if (modo === 'teclear') teclearCadaTecla(f, buscar, min)
      else if (modo === 'pegar') pegarEn(f, buscar(), min)
      else {
        ;(buscar().props.onChange as (ev: unknown) => void)({ target: { value: '', validity: { badInput: true } } })
        f.rendir()
      }
      await f.pulsar(t(idioma, 'comercial.negociacion.ficha.guardar'), { aunqueApagado: true })
      return { f, cuerpo: api.llamadas.find((l) => l.que === 'ficha')?.cuerpo as unknown[] | undefined }
    }
    for (const modo of ['teclear', 'pegar'] as const) {
      it(`NEGATIVO · «12,5» ${modo === 'teclear' ? 'tecleado' : 'pegado'} no se manda (antes viajaba como null y BORRABA el presupuesto)`, async () => {
        const r = await ficha('12,5', modo)
        expect(r.cuerpo).toBeUndefined()
        expect(r.f.html).toContain(aviso('12,5', idioma))
      })
    }
    it('NEGATIVO · lo que el navegador no entiende en el campo numérico tampoco se manda', async () => {
      const r = await ficha('', 'navegador')
      expect(r.cuerpo).toBeUndefined()
      expect(r.f.html).toContain('role="alert"')
    })
    it('«12000.5» se manda como 12000.5', async () => {
      expect((await ficha('12000.5', 'teclear')).cuerpo?.[1]).toMatchObject({ presupuestoMin: 12000.5 })
    })
  })

  // ─── Administración: la tasa de IVA nueva y el tope de descuento ─────────
  describe(`D19 · ${I} · Administración (IVA y tope de descuento)`, () => {
    async function admin() {
      const f = montar(() => en(idioma, createElement(AdministracionPage)), { efectos: true })
      await f.asentar()
      return f
    }
    for (const modo of ['teclear', 'pegar'] as const) {
      it(`IVA · NEGATIVO · «10,5» ${modo === 'teclear' ? 'tecleado' : 'pegado'} no se agrega ni se borra del campo (antes se borraba en silencio), y avisa`, async () => {
        const f = await admin()
        const buscar = () => f.campo('%', true)
        if (modo === 'teclear') teclearCadaTecla(f, buscar, '10,5')
        else pegarEn(f, buscar(), '10,5')
        const agregar = f.elementos('button').filter((b) => b.props.variant === 'success' && textoDe(b.props.children).includes(t(idioma, 'admin.comun.agregar')))[0]
        await pulsarAunqueApagado(f, agregar)
        expect(api.llamadas.filter((l) => l.que === 'actualizarConfig')).toHaveLength(0)
        expect(f.campo('%', true).props.value).toBe('10,5')
        expect(f.html).toContain(aviso('10,5', idioma))
      })
    }
    it('IVA · «10.5» se agrega', async () => {
      const f = await admin()
      teclearCadaTecla(f, () => f.campo('%', true), '10.5')
      const agregar = f.elementos('button').filter((b) => b.props.variant === 'success' && textoDe(b.props.children).includes(t(idioma, 'admin.comun.agregar')))[0]
      await pulsarAunqueApagado(f, agregar)
      expect(api.llamadas.find((l) => l.que === 'actualizarConfig')?.cuerpo).toMatchObject({ ivaTasas: [10.5, 16] })
    })
    it('tope · NEGATIVO · «12,5» con Enter y con el botón no se guarda, se queda a la vista y avisa', async () => {
      const f = await admin()
      const buscar = () => f.elementos('input').filter((e) => e.props.type === 'number' && e.props.max === 100 && e.props.min === 0)[0]
      pegarEn(f, buscar(), '')
      teclearCadaTecla(f, buscar, '12,5')
      await enter(f, buscar())
      await pulsarAunqueApagado(f, f.elementos('button').find((b) => textoDe(b.props.children).includes(t(idioma, 'admin.tope.guardar'))))
      expect(api.llamadas.filter((l) => l.que === 'actualizarConfig')).toHaveLength(0)
      expect(buscar().props.value).toBe('12,5')
      expect(f.html).toContain(aviso('12,5', idioma))
    })
  })

  // ─── La ficha de una propuesta: el descuento comercial ───────────────────
  describe(`D19 · ${I} · Propuesta (descuento comercial)`, () => {
    async function descuento(texto: string, como: 'boton' | 'enter') {
      const f = montar(() => en(idioma, createElement(PropuestaDetallePage, { params: { id: 'p1' } })), { efectos: true })
      await f.asentar()
      const buscar = () => f.elementos('input').filter((e) => e.props.type === 'number' && e.props.step === 0.01)[0]
      pegarEn(f, buscar(), '')
      teclearCadaTecla(f, buscar, texto)
      if (como === 'enter') await enter(f, buscar())
      else await pulsarAunqueApagado(f, f.elementos('button').find((b) => textoDe(b.props.children) === t(idioma, 'propuestas.comun.aplicar')))
      return { f, valor: buscar().props.value, llamadas: api.llamadas.filter((l) => l.que === 'actualizarPropuesta') }
    }
    it('NEGATIVO · «12,5» no se aplica, se queda a la vista y el campo avisa (antes, un «descuento inválido» suelto)', async () => {
      const r = await descuento('12,5', 'boton')
      expect(r.llamadas).toHaveLength(0)
      expect(r.valor).toBe('12,5')
      expect(r.f.html).toContain(aviso('12,5', idioma))
    })
    it('«12.5» se aplica como 12.5', async () => {
      const r = await descuento('12.5', 'boton')
      expect(r.llamadas[0]?.cuerpo).toEqual(['p1', { descuentoPct: 12.5 }])
    })
  })
}
