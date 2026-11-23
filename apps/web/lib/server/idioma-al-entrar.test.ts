import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// IDIOMA-AL-ENTRAR (18/11) · el idioma de la cuenta al iniciar sesion.
//
// El defecto que esto fija: las tres entradas (contrasena, codigo y Google)
// escribian la cookie del idioma de la cuenta con `normalizarIdioma(valor)` a
// secas, que por omision acepta solo lo que encienden las VARIABLES
// (`IDIOMA_*`). En g500 el portugues se encendio desde la BASE
// (`apariencia_instancia`, «Idiomas del servidor»), sin variable, asi que al
// entrar la preferencia «pt» se tiraba y la app salia en espanol. Lo
// encontro el dueno el 18/11: el selector ofrecia Português y no cambiaba
// nada.

const base = vi.hoisted(() => ({ idiomas: null as string[] | null, lecturas: 0 }))

vi.mock('./db', () => ({
  qRaw1: async () => {
    base.lecturas++
    return { idiomas: base.idiomas }
  },
  qRaw: async () => [],
}))

import { idiomaDeLaCuentaAlEntrar } from './idioma-al-entrar'
import { fijarIdiomasDeLaInstancia } from '@/lib/i18n/idiomas'

const VARIABLES = ['IDIOMA_INGLES', 'IDIOMA_ITALIANO', 'IDIOMA_PORTUGUES'] as const
const antes: Record<string, string | undefined> = {}

function olvidarLoLeido() {
  // Lo que `idiomas-servidor.ts` recuerda por proceso. Sin borrarlo, una
  // prueba heredaria lo que leyo la anterior.
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('space-os.idiomas-servidor-leidos')]
  fijarIdiomasDeLaInstancia(null)
}

beforeEach(() => {
  for (const v of VARIABLES) {
    antes[v] = process.env[v]
    delete process.env[v]
  }
  base.idiomas = null
  base.lecturas = 0
  olvidarLoLeido()
})
afterEach(() => {
  for (const v of VARIABLES) {
    if (antes[v] === undefined) delete process.env[v]
    else process.env[v] = antes[v]
  }
  olvidarLoLeido()
})

describe('idiomaDeLaCuentaAlEntrar', () => {
  it('el caso de g500: portugues encendido en la BASE, sin variable → se respeta «pt»', async () => {
    base.idiomas = ['es', 'en', 'it', 'pt']
    expect(await idiomaDeLaCuentaAlEntrar('pt')).toBe('pt')
    expect(await idiomaDeLaCuentaAlEntrar('it')).toBe('it')
    expect(await idiomaDeLaCuentaAlEntrar('en')).toBe('en')
  })

  it('lee la base aunque nadie la haya leido antes en este proceso (login justo tras reiniciar)', async () => {
    base.idiomas = ['es', 'pt']
    expect(await idiomaDeLaCuentaAlEntrar('pt')).toBe('pt')
    expect(base.lecturas).toBe(1)
  })

  it('NEGATIVO: un idioma que la base NO enciende se descarta aunque la variable si', async () => {
    base.idiomas = ['es', 'pt']
    process.env.IDIOMA_ITALIANO = '1'
    expect(await idiomaDeLaCuentaAlEntrar('it')).toBeNull()
  })

  it('sin eleccion en la base mandan las variables, como hasta hoy', async () => {
    base.idiomas = null
    process.env.IDIOMA_PORTUGUES = '1'
    expect(await idiomaDeLaCuentaAlEntrar('pt')).toBe('pt')
  })

  it('NEGATIVO: sin base ni variable, «pt» esta apagado y no se escribe', async () => {
    base.idiomas = null
    expect(await idiomaDeLaCuentaAlEntrar('pt')).toBeNull()
  })

  it('NEGATIVO: sin preferencia o con basura no hay idioma de cuenta', async () => {
    base.idiomas = ['es', 'en', 'it', 'pt']
    expect(await idiomaDeLaCuentaAlEntrar(null)).toBeNull()
    expect(await idiomaDeLaCuentaAlEntrar('fr')).toBeNull()
  })
})

describe('las tres entradas usan la misma regla', () => {
  // Una prueba de fuente, a proposito: el defecto era que cada ruta repetia la
  // llamada y en la cookie se le olvidaba la lista. Si una vuelve a llamar a
  // `normalizarIdioma` por su cuenta, puede volver a olvidarla.
  const RUTAS = [
    'app/api/auth/login/route.ts',
    'app/api/auth/codigo/route.ts',
    'app/api/auth/google/callback/route.ts',
  ]
  for (const ruta of RUTAS) {
    it(`${ruta} toma el idioma de idiomaDeLaCuentaAlEntrar y no de normalizarIdioma`, () => {
      const fuente = readFileSync(join(__dirname, '..', '..', ruta), 'utf8')
      expect(fuente).toContain('idiomaDeLaCuentaAlEntrar(')
      expect(fuente).not.toMatch(/normalizarIdioma\(/)
    })
  }
})
