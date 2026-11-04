import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { DICCIONARIOS } from './diccionario'
import { etiquetaDePapel } from './papeles'
import { nombreDeFallaEnIdioma } from './donde-falla'
import { avisoDeEnlaceEnviado } from './errores-acceso'
import { Paginacion } from '@/components/demo/ui/Paginacion'
import { EtiquetaCarga } from '@/components/demo/ui/IndicadorCarga'
import { IndicadorCarga as IndicadorProcesando } from '@/components/IndicadorCarga'
import { importeDeRevision } from '@/components/demo/arrendadores/PanelFirmas'

// ============================================================================
//  Recorrido del italiano en el navegador (2026-11-04).
// ----------------------------------------------------------------------------
//  Cada caso es un texto que el recorrido vio salir en espanol o en ingles con
//  la interfaz en italiano, o una cifra con formato ajeno. La regla de esta
//  pasada: el ESPANOL y el INGLES salen identicos a como salian (por eso cada
//  caso fija tambien los dos), y solo cambia el italiano. Donde el ingles
//  tiene el mismo defecto se dice en `docs/i18n/revision-italiano-recorrido.md`
//  y queda para que lo decida el dueno.
// ============================================================================

vi.mock('@/lib/loading-fetch', () => ({ useCargando: () => true, instalarIndicadorCarga: () => {} }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/finanzas',
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  process.env.IDIOMA_ITALIANO = '1'
})

const en = (idioma: Idioma, nodo: ReactElement) =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma }, nodo))
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim()

describe('Paginacion: «Anterior / Siguiente» y «de» salian en espanol', () => {
  const props = { pagina: 1, paginas: 13, desde: 1, hasta: 20, total: 260, irA: () => {}, etiqueta: 'pagos' }
  it('en italiano dice «di», «Precedente» y «Avanti»', () => {
    const t = texto(en('it', createElement(Paginacion, props)))
    expect(t).toBe('1–20 di 260 pagos Precedente 1 / 13 Avanti')
  })
  it('en espanol y en ingles, el texto de siempre', () => {
    for (const idioma of ['es', 'en'] as const) {
      expect(texto(en(idioma, createElement(Paginacion, props)))).toBe('1–20 de 260 pagos Anterior 1 / 13 Siguiente')
    }
  })
})

describe('Indicadores de carga: «Cargando…» y «Procesando…» escritos a mano', () => {
  it('el aviso para lector de pantalla de la barra de carga', () => {
    expect(texto(en('it', createElement(EtiquetaCarga)))).toBe('Caricamento…')
    expect(texto(en('es', createElement(EtiquetaCarga)))).toBe('Cargando…')
    expect(texto(en('en', createElement(EtiquetaCarga)))).toBe('Cargando…')
  })
  it('la pastilla de «Procesando…» de las peticiones que escriben', () => {
    expect(texto(en('it', createElement(IndicadorProcesando)))).toBe('Elaborazione…')
    expect(texto(en('es', createElement(IndicadorProcesando)))).toBe('Procesando…')
    expect(texto(en('en', createElement(IndicadorProcesando)))).toBe('Procesando…')
  })
})

describe('Papeles de las razones sociales: la base los guarda CON acentos', () => {
  // `20260921_corrige_acentos_catalogo_roles_entidad.sql` les puso los acentos
  // en la base; el diccionario espanol los tiene sin acento. La comparacion
  // exacta fallaba y LICENCIAS y OPERACION salian en espanol.
  it('en italiano se traducen los cinco, con o sin acento', () => {
    expect(etiquetaDePapel('Trámites y licencias con gobierno', 'it')).toBe(
      DICCIONARIOS.it['admin.papel.licencias'],
    )
    expect(etiquetaDePapel('Operación y nómina', 'it')).toBe(DICCIONARIOS.it['admin.papel.operacion'])
    expect(etiquetaDePapel('Operacion y nomina', 'it')).toBe(DICCIONARIOS.it['admin.papel.operacion'])
  })
  it('en espanol, el dato tal cual; en ingles, lo de siempre', () => {
    expect(etiquetaDePapel('Operación y nómina', 'es')).toBe('Operación y nómina')
    expect(etiquetaDePapel('Operación y nómina', 'en')).toBe('Operación y nómina')
    expect(etiquetaDePapel('Operacion y nomina', 'en')).toBe(DICCIONARIOS.en['admin.papel.operacion'])
  })
  it('una etiqueta que no es de los cinco no se toca', () => {
    expect(etiquetaDePapel('Papel inventado', 'it')).toBe('Papel inventado')
  })
})

describe('Fallas de Space Eyes: el backend manda nombres cortos', () => {
  // `space-eye/backend/src/controllers/monitoreo.controller.ts` (NOMBRES):
  // «Pantalla congelada», «Cámara movida», «Sin imagen». El diccionario tiene
  // los largos de la app Android y solo esos se traducian.
  it('en italiano se traducen tambien los cortos', () => {
    expect(nombreDeFallaEnIdioma('Pantalla congelada', 'it')).toBe(
      DICCIONARIOS.it['spaceeyes.fallas.nombre.pantalla-congelada'],
    )
    expect(nombreDeFallaEnIdioma('Cámara movida', 'it')).toBe(DICCIONARIOS.it['spaceeyes.fallas.nombre.camara-movida'])
    expect(nombreDeFallaEnIdioma('Sin imagen', 'it')).toBe(DICCIONARIOS.it['spaceeyes.fallas.nombre.sin-imagen'])
  })
  it('en espanol y en ingles, como antes', () => {
    expect(nombreDeFallaEnIdioma('Pantalla congelada', 'es')).toBe('Pantalla congelada')
    expect(nombreDeFallaEnIdioma('Pantalla congelada', 'en')).toBe('Pantalla congelada')
  })
})

describe('Recuperar contrasena: el aviso del servidor llega en espanol', () => {
  const servidor = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.'
  it('en italiano se pinta el aviso del diccionario', () => {
    expect(avisoDeEnlaceEnviado(servidor, 'it')).toBe(DICCIONARIOS.it['login.aviso-generico'])
  })
  it('en espanol y en ingles, el del servidor (como siempre); sin el, el del diccionario', () => {
    expect(avisoDeEnlaceEnviado(servidor, 'es')).toBe(servidor)
    expect(avisoDeEnlaceEnviado(servidor, 'en')).toBe(servidor)
    expect(avisoDeEnlaceEnviado(undefined, 'en')).toBe(DICCIONARIOS.en['login.aviso-generico'])
  })
})

describe('Revision antes de enviar a firma: el importe con formato mexicano', () => {
  it('en italiano, como lo recita el contrato italiano: «6.000,00 MXN»', () => {
    expect(importeDeRevision(6000, 'MXN', 'it')).toBe('6.000,00 MXN')
    expect(importeDeRevision(1234567.891, 'USD', 'it')).toBe('1.234.567,89 USD')
  })
  it('en espanol y en ingles, el de siempre', () => {
    expect(importeDeRevision(6000, 'MXN', 'es')).toBe('$6,000.00 MXN')
    expect(importeDeRevision(6000, 'MXN', 'en')).toBe('$6,000.00 MXN')
    expect(importeDeRevision(null, 'MXN', 'it')).toBeNull()
  })
})

describe('Registrar un abono: «acconto» es un anticipo, no un pago parcial', () => {
  // La costura (italiano-olas §7) fijo «Abono registrado» = «Pagamento parziale
  // registrato»: un abono es un pago parcial. El dialogo seguia con «acconto».
  it('ninguna clave de finanzas dice «acconto»', () => {
    const conAcconto = Object.entries(DICCIONARIOS.it).filter(([, v]) => /(^|[\s’'])accont/i.test(v))
    expect(conAcconto).toEqual([])
  })
})
