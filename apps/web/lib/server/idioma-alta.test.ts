import { describe, it, expect } from 'vitest'
import { idiomaDocumentosPedido, resolverIdiomaDocumentosDeAlta } from './idioma-alta'

// ============================================================================
//  ADR 0049 · con que idioma de DOCUMENTOS nace una organizacion.
//
//  El mismo patron que la moneda (ADR 0048, `moneda-alta.test.ts`): la primera
//  de la instancia lo ELIGE (es por omision), las siguientes lo heredan, y
//  pedir otro es un error que no se ignora.
// ============================================================================

const error = (f: () => unknown): unknown => {
  try {
    f()
  } catch (e) {
    return e
  }
  return null
}

describe('idiomaDocumentosPedido · lo que llega en el cuerpo del alta', () => {
  it('sin idioma, no se pidio ninguno', () => {
    expect(idiomaDocumentosPedido(undefined)).toBeUndefined()
  })

  it.each(['es', 'en', 'it', 'pt'])('%s se acepta tal cual', (i) => {
    expect(idiomaDocumentosPedido(i)).toBe(i)
  })

  it.each(['fr', 'ES', 'En', 'es-MX', ' en', '', null, 1, {}, ['en'], 'PT', 'pt-BR', 'pt_BR', 'br'])(
    'NEGATIVO · %j se rechaza con 400 y el mensaje dice cuales valen',
    (malo) => {
      expect(error(() => idiomaDocumentosPedido(malo))).toMatchObject({
        status: 400,
        message: 'El idioma de los documentos debe ser es, en, it o pt',
      })
    },
  )
})

describe('resolverIdiomaDocumentosDeAlta · la primera elige, las demas heredan', () => {
  it('instancia vacia y nadie elige: es, que es lo unico que existia', () => {
    expect(resolverIdiomaDocumentosDeAlta(undefined, null)).toBe('es')
  })

  it.each(['en', 'it', 'pt'] as const)('instancia vacia y se pide %s: nace en %s', (i) => {
    expect(resolverIdiomaDocumentosDeAlta(i, null)).toBe(i)
  })

  it('instancia en ingles y nadie pide: hereda ingles (no cae al espanol)', () => {
    expect(resolverIdiomaDocumentosDeAlta(undefined, 'en')).toBe('en')
  })

  it('pedir el MISMO que la instancia pasa', () => {
    expect(resolverIdiomaDocumentosDeAlta('it', 'it')).toBe('it')
    expect(resolverIdiomaDocumentosDeAlta('pt', 'pt')).toBe('pt')
  })

  it('P3 · instancia en portugues y nadie pide: hereda portugues', () => {
    expect(resolverIdiomaDocumentosDeAlta(undefined, 'pt')).toBe('pt')
  })

  it('NEGATIVO P3 · pedir pt en una instancia espanola es el 400 de siempre', () => {
    expect(error(() => resolverIdiomaDocumentosDeAlta('pt', 'es'))).toMatchObject({ status: 400 })
  })

  it('NEGATIVO · pedir otro distinto al de la instancia es un 400, no se ignora', () => {
    expect(error(() => resolverIdiomaDocumentosDeAlta('en', 'es'))).toMatchObject({
      status: 400,
      message: 'El idioma de los documentos de la instancia ya está fijado: una organización nueva nace en el mismo que las demás',
    })
  })

  it('NEGATIVO · una base con un idioma fuera de es/en/it lanza en vez de adivinar', () => {
    expect(error(() => resolverIdiomaDocumentosDeAlta(undefined, 'fr'))).toBeInstanceOf(Error)
  })
})
