import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  ADR 0049 · idiomaDeLaInstancia(): de donde sale el idioma de los documentos.
//  Fail-closed: si la base no contesta, LANZA. Caer al espanol en silencio
//  redactaria un contrato en otro idioma que el de la instancia, y su hash no
//  coincidiria con lo firmado: firmas «alteradas» por una caida de la base.
// ============================================================================

const db = vi.hoisted(() => ({ fila: null as null | { idioma_documentos: string }, falla: false, llamadas: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('./db', () => ({
  qRaw1: async () => {
    db.llamadas++
    if (db.falla) throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
    return db.fila
  },
}))

async function cargar() {
  vi.resetModules()
  // La cache vive en `globalThis` (una por proceso, como la moneda): se limpia
  // entre pruebas para que cada una empiece sin leer.
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('space-os.idioma-documentos-instancia')]
  return import('./idioma-instancia')
}

beforeEach(() => {
  db.fila = null
  db.falla = false
  db.llamadas = 0
})

describe('idiomaDeLaInstancia', () => {
  it('lee el de la base', async () => {
    db.fila = { idioma_documentos: 'it' }
    const { idiomaDeLaInstancia } = await cargar()
    expect(await idiomaDeLaInstancia()).toBe('it')
  })

  it('sin ninguna organizacion: es, y NO se cachea (el bootstrap puede elegir otro)', async () => {
    const { idiomaDeLaInstancia } = await cargar()
    expect(await idiomaDeLaInstancia()).toBe('es')
    db.fila = { idioma_documentos: 'en' }
    expect(await idiomaDeLaInstancia()).toBe('en')
  })

  it('con organizacion se cachea: es inmutable, basta leerlo una vez por proceso', async () => {
    db.fila = { idioma_documentos: 'en' }
    const { idiomaDeLaInstancia } = await cargar()
    await idiomaDeLaInstancia()
    await idiomaDeLaInstancia()
    expect(db.llamadas).toBe(1)
  })

  it('el alta lo recuerda al crear la primera organizacion', async () => {
    const { idiomaDeLaInstancia, recordarIdiomaDeLaInstancia } = await cargar()
    recordarIdiomaDeLaInstancia('it')
    expect(await idiomaDeLaInstancia()).toBe('it')
    expect(db.llamadas).toBe(0)
  })

  it('NEGATIVO · FAIL-CLOSED: si la base no contesta, lanza (no cae al espanol)', async () => {
    db.falla = true
    const { idiomaDeLaInstancia } = await cargar()
    await expect(idiomaDeLaInstancia()).rejects.toThrow(/ECONNREFUSED/)
  })

  it('P3 · una instancia en portugues se lee como tal', async () => {
    db.fila = { idioma_documentos: 'pt' }
    const { idiomaDeLaInstancia } = await cargar()
    expect(await idiomaDeLaInstancia()).toBe('pt')
  })

  it('NEGATIVO · un valor fuera de es/en/it/pt en la base lanza', async () => {
    db.fila = { idioma_documentos: 'fr' }
    const { idiomaDeLaInstancia } = await cargar()
    await expect(idiomaDeLaInstancia()).rejects.toThrow(/no soportado/)
  })
})
