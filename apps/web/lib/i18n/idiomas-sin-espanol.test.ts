import { describe, it, expect, afterEach } from 'vitest'
import {
  fijarIdiomasDeLaInstancia,
  idiomasActivos,
  idiomasElegidosEnLaInstancia,
  idiomaDeRespaldo,
  resolverIdioma,
} from './idiomas'

// ============================================================================
//  IDIOMAS-SIN-ES (18/11) · el espanol deja de ser obligatorio en «Idiomas del
//  servidor». Decision del dueno: «tambien sin marcar y elegible». El espanol
//  sigue siendo el RESPALDO del diccionario (lo que falte de traducir), pero si
//  no esta elegido no se ofrece ni se pinta: manda el primero de los elegidos,
//  en el orden de `IDIOMAS`.
// ============================================================================

afterEach(() => fijarIdiomasDeLaInstancia(null))

describe('fijarIdiomasDeLaInstancia respeta la lista tal cual', () => {
  it('una lista sin espanol NO lo anade', () => {
    fijarIdiomasDeLaInstancia(['pt', 'en'])
    expect(idiomasElegidosEnLaInstancia()).toEqual(['en', 'pt'])
    expect(idiomasActivos()).toEqual(['en', 'pt'])
  })

  it('con espanol, sigue igual que antes', () => {
    fijarIdiomasDeLaInstancia(['en', 'es'])
    expect(idiomasActivos()).toEqual(['es', 'en'])
  })

  it('null devuelve el mando a las variables', () => {
    fijarIdiomasDeLaInstancia(['en'])
    fijarIdiomasDeLaInstancia(null)
    expect(idiomasElegidosEnLaInstancia()).toBeNull()
    expect(idiomasActivos()).toContain('es')
  })
})

describe('el idioma que se pinta cuando la preferencia no esta activa', () => {
  it('idiomaDeRespaldo: el primero de los permitidos en el orden de IDIOMAS', () => {
    expect(idiomaDeRespaldo(['pt', 'en'])).toBe('en')
    expect(idiomaDeRespaldo(['it'])).toBe('it')
    expect(idiomaDeRespaldo(['pt', 'es'])).toBe('es')
    // Sin lista (no deberia pasar): el espanol de siempre.
    expect(idiomaDeRespaldo([])).toBe('es')
  })

  it('sin cuenta, cookie ni cabecera: el primero de los elegidos, NO el espanol', () => {
    expect(resolverIdioma({ permitidos: ['en', 'pt'] })).toBe('en')
    expect(resolverIdioma({ permitidos: ['pt'] })).toBe('pt')
  })

  it('NEGATIVO · una cookie o un navegador en espanol no lo cuelan si no esta elegido', () => {
    expect(resolverIdioma({ cookie: 'es', cabecera: 'es-MX,es;q=0.9', permitidos: ['en', 'pt'] })).toBe('en')
    expect(resolverIdioma({ cuenta: 'es', permitidos: ['it'] })).toBe('it')
  })

  it('la precedencia de siempre entre los elegidos', () => {
    expect(resolverIdioma({ cookie: 'pt', cabecera: 'en', permitidos: ['en', 'pt'] })).toBe('pt')
    expect(resolverIdioma({ cabecera: 'fr, pt-BR;q=0.8', permitidos: ['en', 'pt'] })).toBe('pt')
  })

  it('con el espanol elegido, el respaldo sigue siendo el espanol (sin cambio)', () => {
    expect(resolverIdioma({ cabecera: 'fr', permitidos: ['es', 'en'] })).toBe('es')
  })
})
