import { describe, it, expect } from 'vitest'
import {
  IDIOMAS,
  COOKIE_IDIOMA_CUENTA,
  resolverIdioma,
  valorCookieIdiomaCuenta,
  idiomaDeCookieCuenta,
  preferenciaDeIdioma,
  cambiaIdiomaAlEntrar,
  type Idioma,
} from './idiomas'

// ============================================================================
//  IDIOMA-USUARIO (03/11) · LA PREFERENCIA DE LA CUENTA EN LA PRECEDENCIA.
// ----------------------------------------------------------------------------
//  Decisión del dueño: «el idioma de lo demás se debe poder configurar por
//  usuario y navegador». La regla queda:
//
//      cuenta  >  cookie del navegador  >  Accept-Language  >  español
//
//  siempre filtrada por los idiomas ENCENDIDOS. Las negativas son las que
//  importan: una preferencia de un idioma apagado se ignora SIN error, una
//  cookie de cuenta de OTRA sesión no vale, y sin preferencia todo sale
//  exactamente como antes de esta tarea.
// ============================================================================

const TODOS: readonly Idioma[] = IDIOMAS
const HUELLA = 'a'.repeat(32)
const OTRA_HUELLA = 'b'.repeat(32)

describe('resolverIdioma · la cuenta va PRIMERO', () => {
  it('la cuenta gana a la cookie y a la cabecera', () => {
    expect(resolverIdioma({ cuenta: 'it', cookie: 'en', cabecera: 'en-US', permitidos: TODOS })).toBe('it')
    expect(resolverIdioma({ cuenta: 'es', cookie: 'en', cabecera: 'en-US', permitidos: TODOS })).toBe('es')
    expect(resolverIdioma({ cuenta: 'en', cookie: 'es', cabecera: 'es-MX', permitidos: TODOS })).toBe('en')
  })

  it('una cuenta en un idioma APAGADO se ignora sin error y manda la cookie', () => {
    expect(resolverIdioma({ cuenta: 'it', cookie: 'en', cabecera: 'es', permitidos: ['es', 'en'] })).toBe('en')
  })

  it('…y sin cookie, la cabecera; y sin nada, el español', () => {
    expect(resolverIdioma({ cuenta: 'it', cabecera: 'en-GB', permitidos: ['es', 'en'] })).toBe('en')
    expect(resolverIdioma({ cuenta: 'en', permitidos: ['es'] })).toBe('es')
  })

  it('una cuenta con basura se comporta como si no hubiera cuenta', () => {
    for (const basura of ['fr', '', '  ', 'xx-YY', null, undefined]) {
      expect(resolverIdioma({ cuenta: basura, cookie: 'en', permitidos: TODOS }), String(basura)).toBe('en')
    }
  })

  it('SIN preferencia de cuenta, EXACTAMENTE la regla de antes', () => {
    // Recorre todas las combinaciones de cookie y cabecera: con `cuenta`
    // ausente o null el resultado es el mismo que sin el campo.
    const cookies = [null, 'es', 'en', 'it', 'fr', '']
    const cabeceras = [null, 'es-MX', 'en-US,en;q=0.9', 'it-IT', 'fr-FR', 'de;q=1, en;q=0.5', '']
    const listas: readonly Idioma[][] = [['es'], ['es', 'en'], ['es', 'it'], ['es', 'en', 'it']]
    for (const permitidos of listas)
      for (const cookie of cookies)
        for (const cabecera of cabeceras) {
          const antes = resolverIdioma({ cookie, cabecera, permitidos })
          expect(resolverIdioma({ cuenta: null, cookie, cabecera, permitidos })).toBe(antes)
          expect(resolverIdioma({ cuenta: undefined, cookie, cabecera, permitidos })).toBe(antes)
        }
  })
})

describe('la cookie de la cuenta va ATADA a la sesión', () => {
  it('se arma como <idioma>.<huella de la sesión>', () => {
    expect(valorCookieIdiomaCuenta('en', HUELLA)).toBe(`en.${HUELLA}`)
    expect(COOKIE_IDIOMA_CUENTA).toBe('spaces_idioma_cuenta')
  })

  it('con la huella de ESTA sesión, se lee', () => {
    for (const i of IDIOMAS) {
      expect(idiomaDeCookieCuenta(valorCookieIdiomaCuenta(i, HUELLA), HUELLA)).toBe(i)
    }
  })

  it('con la huella de OTRA sesión (otra persona en el mismo navegador), no vale', () => {
    expect(idiomaDeCookieCuenta(valorCookieIdiomaCuenta('en', OTRA_HUELLA), HUELLA)).toBeNull()
  })

  it('sin sesión (huella null), no vale aunque la cookie esté', () => {
    expect(idiomaDeCookieCuenta(valorCookieIdiomaCuenta('en', HUELLA), null)).toBeNull()
  })

  it('una cookie mal formada no vale', () => {
    for (const v of [null, undefined, '', 'en', `en.`, `.${HUELLA}`, `fr.${HUELLA}`, `en.${HUELLA}x`, `en.${HUELLA}.x`]) {
      expect(idiomaDeCookieCuenta(v, HUELLA), String(v)).toBeNull()
    }
  })

  it('una huella vacía no casa con una cookie de huella vacía', () => {
    expect(idiomaDeCookieCuenta('en.', '')).toBeNull()
  })
})

describe('preferenciaDeIdioma · lo que acepta «Mi cuenta»', () => {
  it('null o «navegador» = seguir al navegador', () => {
    expect(preferenciaDeIdioma(null, TODOS)).toEqual({ ok: true, idioma: null })
    expect(preferenciaDeIdioma('navegador', TODOS)).toEqual({ ok: true, idioma: null })
  })
  it('un idioma ENCENDIDO se acepta', () => {
    expect(preferenciaDeIdioma('en', ['es', 'en'])).toEqual({ ok: true, idioma: 'en' })
    expect(preferenciaDeIdioma('es', ['es'])).toEqual({ ok: true, idioma: 'es' })
  })
  it('un idioma APAGADO se rechaza (la pantalla no lo ofrece)', () => {
    expect(preferenciaDeIdioma('it', ['es', 'en'])).toEqual({ ok: false })
  })
  it('basura se rechaza: ni regiones, ni mayúsculas, ni otros tipos', () => {
    for (const v of ['fr', 'en-US', 'EN', '', ' en', 1, true, {}, [], undefined]) {
      expect(preferenciaDeIdioma(v, TODOS), JSON.stringify(v)).toEqual({ ok: false })
    }
  })
})

describe('cambiaIdiomaAlEntrar · ¿la pantalla de entrar tiene que recargar?', () => {
  // La navegación de Next no vuelve a pintar el layout raíz, que es quien lleva
  // el idioma: sin una carga completa, quien entra con preferencia «inglés»
  // desde un login en español seguiría viendo español hasta recargar a mano.
  it('sí, si la cuenta pide un idioma encendido distinto del actual', () => {
    expect(cambiaIdiomaAlEntrar('en', 'es', ['es', 'en'])).toBe(true)
  })
  it('no, si ya está en ese idioma', () => {
    expect(cambiaIdiomaAlEntrar('en', 'en', ['es', 'en'])).toBe(false)
  })
  it('no, sin preferencia (lo de siempre: navegación suave)', () => {
    expect(cambiaIdiomaAlEntrar(null, 'es', ['es', 'en'])).toBe(false)
    expect(cambiaIdiomaAlEntrar(undefined, 'en', ['es', 'en'])).toBe(false)
  })
  it('no, si el idioma de la cuenta está apagado o es basura', () => {
    expect(cambiaIdiomaAlEntrar('it', 'es', ['es', 'en'])).toBe(false)
    expect(cambiaIdiomaAlEntrar('fr', 'es', ['es', 'en'])).toBe(false)
  })
})
