import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  I18N-06 · LEER EL IDIOMA DE LA PETICION SIN QUE SE CAIGA NADA.
// ----------------------------------------------------------------------------
//  El caso que importa y que es facil de no ver:
//
//      `cookies()` y `headers()` LANZAN fuera de una peticion.
//
//  Medido el 2026-09-30 contra Next 14.2.29:
//
//      Error: `cookies` was called outside a request scope.
//
//  Y eso convierte una lectura inocente en un defecto grave, porque quien lee
//  el idioma es `respuestaError()` -- que corre EN EL `catch` de cada ruta. Sin
//  guardia, un error lanzado desde un script, un trabajo de fondo o una prueba
//  deja de ser «500 con mensaje» y pasa a ser una excepcion DISTINTA lanzada
//  por el propio manejador de errores. El manejador se convierte en el error, y
//  el original se pierde.
//
//  Por eso la lectura va envuelta y cae al espanol. Esta prueba es la que lo
//  sostiene.
// ============================================================================

const estado = {
  modo: 'fuera' as 'fuera' | 'peticion',
  cookie: null as string | null,
  accept: null as string | null,
}

vi.mock('next/headers', () => {
  const fuera = (nombre: string) => {
    throw new Error(`\`${nombre}\` was called outside a request scope.`)
  }
  return {
    cookies: () => {
      if (estado.modo === 'fuera') fuera('cookies')
      return {
        get: (n: string) =>
          n === 'spaces_idioma' && estado.cookie ? { value: estado.cookie } : undefined,
      }
    },
    headers: () => {
      if (estado.modo === 'fuera') fuera('headers')
      return { get: (n: string) => (n === 'accept-language' ? estado.accept : null) }
    },
  }
})

async function idioma() {
  const { idiomaDeLaPeticion } = await import('./servidor')
  return idiomaDeLaPeticion()
}

beforeEach(() => {
  estado.modo = 'peticion'
  estado.cookie = null
  estado.accept = null
})

describe('dentro de una peticion', () => {
  it('con el navegador en ingles, ingles', async () => {
    estado.accept = 'en-US,en;q=0.9'
    expect(await idioma()).toBe('en')
  })

  it('sin ninguna senal, espanol', async () => {
    expect(await idioma()).toBe('es')
  })

  it('LA COOKIE MANDA, igual que en la interfaz', async () => {
    // Es la misma regla, y es la misma funcion: `resolverIdioma`. Si aqui se
    // escribiera otra vez la precedencia, habria dos sitios que decidir el
    // idioma y acabarian diciendo cosas distintas.
    estado.cookie = 'es'
    estado.accept = 'en-US,en;q=0.9'
    expect(await idioma()).toBe('es')

    estado.cookie = 'en'
    estado.accept = 'es-MX,es;q=0.9'
    expect(await idioma()).toBe('en')
  })

  it('una cookie con basura no secuestra la decision', async () => {
    estado.cookie = 'fr'
    estado.accept = 'en-US'
    expect(await idioma()).toBe('en')
  })
})

describe('FUERA de una peticion · el caso que mas facil se escapa', () => {
  it('NO LANZA, y cae al espanol', async () => {
    estado.modo = 'fuera'
    await expect(idioma()).resolves.toBe('es')
  })

  it('no lanza aunque se llame muchas veces seguidas', async () => {
    // Un trabajo de fondo que falle en bucle no puede ir dejando excepciones
    // nuevas en cada vuelta.
    estado.modo = 'fuera'
    for (let i = 0; i < 20; i++) {
      await expect(idioma()).resolves.toBe('es')
    }
  })
})
