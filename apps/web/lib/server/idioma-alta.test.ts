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

  it.each(['es', 'en', 'it'])('%s se acepta tal cual', (i) => {
    expect(idiomaDocumentosPedido(i)).toBe(i)
  })

  it.each(['fr', 'ES', 'En', 'es-MX', ' en', '', null, 1, {}, ['en']])(
    'NEGATIVO · %j se rechaza con 400 y el mensaje dice cuales valen',
    (malo) => {
      expect(error(() => idiomaDocumentosPedido(malo))).toMatchObject({
        status: 400,
        message: 'El idioma de los documentos debe ser es, en o it',
      })
    },
  )
})

describe('resolverIdiomaDocumentosDeAlta · la primera elige, las demas heredan', () => {
  it('instancia vacia y nadie elige: es, que es lo unico que existia', () => {
    expect(resolverIdiomaDocumentosDeAlta(undefined, null)).toBe('es')
  })

  it.each(['en', 'it'] as const)('instancia vacia y se pide %s: nace en %s', (i) => {
    expect(resolverIdiomaDocumentosDeAlta(i, null)).toBe(i)
  })

  it('instancia en ingles y nadie pide: hereda ingles (no cae al espanol)', () => {
    expect(resolverIdiomaDocumentosDeAlta(undefined, 'en')).toBe('en')
  })

  it('pedir el MISMO que la instancia pasa', () => {
    expect(resolverIdiomaDocumentosDeAlta('it', 'it')).toBe('it')
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
