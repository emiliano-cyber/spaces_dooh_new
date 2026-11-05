import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// IDIOMA-USUARIO (03/11) · el controlador de «Mi cuenta → Idioma». La base va
// simulada: el aislamiento de verdad lo prueba `idioma-por-usuario.e2e.test.ts`.

const repo = vi.hoisted(() => ({
  guardado: null as string | null,
  filas: 1,
  llamadas: [] as Array<[string, string | null]>,
}))

vi.mock('./usuarios-repo', () => ({
  idiomaPreferidoPropio: async () => repo.guardado,
  guardarIdiomaPreferido: async (id: string, idioma: string | null) => {
    repo.llamadas.push([id, idioma])
    if (repo.filas) repo.guardado = idioma
    return repo.filas > 0
  },
}))

import { leerIdiomaCtrl, guardarIdiomaCtrl } from './idioma-controller'

beforeEach(() => {
  repo.guardado = null
  repo.filas = 1
  repo.llamadas = []
  process.env.IDIOMA_INGLES = '1'
  delete process.env.IDIOMA_ITALIANO
})
afterEach(() => {
  delete process.env.IDIOMA_INGLES
  delete process.env.IDIOMA_ITALIANO
})

describe('leerIdiomaCtrl', () => {
  it('sin preferencia: null, y los idiomas encendidos', async () => {
    expect(await leerIdiomaCtrl('u1')).toEqual({ preferido: null, disponibles: ['es', 'en'] })
  })
  it('una preferencia ENCENDIDA se devuelve', async () => {
    repo.guardado = 'en'
    expect((await leerIdiomaCtrl('u1')).preferido).toBe('en')
  })
  it('una preferencia APAGADA se lee como null, sin error', async () => {
    repo.guardado = 'it'
    expect(await leerIdiomaCtrl('u1')).toEqual({ preferido: null, disponibles: ['es', 'en'] })
  })
})

describe('guardarIdiomaCtrl', () => {
  it('guarda un idioma encendido en la cuenta de la SESIÓN', async () => {
    expect(await guardarIdiomaCtrl('u1', { idioma: 'en' })).toEqual({ preferido: 'en', disponibles: ['es', 'en'] })
    expect(repo.llamadas).toEqual([['u1', 'en']])
  })
  it('«navegador» y null guardan null (seguir al navegador)', async () => {
    await guardarIdiomaCtrl('u1', { idioma: 'navegador' })
    await guardarIdiomaCtrl('u1', { idioma: null })
    expect(repo.llamadas).toEqual([['u1', null], ['u1', null]])
  })
  it('un idioma APAGADO se rechaza con 400 y no toca la base', async () => {
    await expect(guardarIdiomaCtrl('u1', { idioma: 'it' })).rejects.toMatchObject({ status: 400 })
    expect(repo.llamadas).toEqual([])
  })
  it('sin campo, basura o sin cuerpo: 400 y no toca la base', async () => {
    for (const b of [{}, { idioma: 'fr' }, { idioma: 3 }, null, 'en', { idioma: undefined }]) {
      await expect(guardarIdiomaCtrl('u1', b), JSON.stringify(b)).rejects.toMatchObject({ status: 400 })
    }
    expect(repo.llamadas).toEqual([])
  })
  it('si la fila no es de la sesión (0 filas), 404', async () => {
    repo.filas = 0
    await expect(guardarIdiomaCtrl('u1', { idioma: 'en' })).rejects.toMatchObject({ status: 404 })
  })
})

// Ola 0 del portugues (2026-11-05) · `usuarios.idioma_preferido` tiene un CHECK
// es/en/it. Con el portugues ENCENDIDO, la cuenta no lo ofrece ni lo guarda:
// un `pt` llegaria al UPDATE y el CHECK lo tumbaria con un 500. La tarea roja
// que abre la columna cambiara esta prueba a proposito.
describe('el portugues encendido no llega a la base', () => {
  beforeEach(() => {
    process.env.IDIOMA_PORTUGUES = '1'
  })
  afterEach(() => {
    delete process.env.IDIOMA_PORTUGUES
  })

  it('leer: «disponibles» no lo incluye', async () => {
    expect(await leerIdiomaCtrl('u1')).toEqual({ preferido: null, disponibles: ['es', 'en'] })
  })
  it('NEGATIVO · guardar pt: 400 y la base ni se toca', async () => {
    await expect(guardarIdiomaCtrl('u1', { idioma: 'pt' })).rejects.toMatchObject({
      status: 400,
      message: 'Ese idioma no está disponible en este servidor.',
    })
    expect(repo.llamadas).toEqual([])
  })
  it('lo demas, como siempre', async () => {
    expect(await guardarIdiomaCtrl('u1', { idioma: 'en' })).toEqual({ preferido: 'en', disponibles: ['es', 'en'] })
  })
})
