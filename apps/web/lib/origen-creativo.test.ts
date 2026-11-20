import { describe, it, expect } from 'vitest'
import { origenInterno, origenCliente, subidoPor } from './origen-creativo'

// CREA-ORIGEN (20/11) · quién subió cada creativo, como DATO.

describe('origenInterno · lo que se guarda al subir alguien de la organización', () => {
  it('INTERNO, con el id y el nombre de la sesión', () => {
    expect(origenInterno({ id: 'u1', nombre: 'Ana López' })).toEqual({
      origen: 'INTERNO',
      subidoPor: 'u1',
      subidoPorNombre: 'Ana López',
    })
  })

  it('un nombre en blanco no se guarda como nombre', () => {
    expect(origenInterno({ id: 'u1', nombre: '   ' })).toEqual({ origen: 'INTERNO', subidoPor: 'u1', subidoPorNombre: null })
  })

  it('sin sesión (no debería pasar) sigue siendo INTERNO, sin usuario', () => {
    expect(origenInterno(null)).toEqual({ origen: 'INTERNO', subidoPor: null, subidoPorNombre: null })
  })
})

describe('origenCliente · lo que se guarda al aprobar el envío de la liga', () => {
  it('CLIENTE, nunca con un usuario interno', () => {
    expect(origenCliente()).toEqual({ origen: 'CLIENTE', subidoPor: null, subidoPorNombre: null })
  })

  it('con el nombre que dio el cliente, recortado', () => {
    expect(origenCliente('  Paty Ruiz ')).toEqual({ origen: 'CLIENTE', subidoPor: null, subidoPorNombre: 'Paty Ruiz' })
  })
})

describe('subidoPor · el texto «Subido por: …» (clave y variables)', () => {
  it('el cliente con nombre → «Subido por: el cliente (Nombre)»', () => {
    expect(subidoPor({ origen: 'CLIENTE', subidoPorNombre: 'Paty Ruiz' })).toEqual({
      clave: 'operaciones2.creativos.origen.cliente-nombre',
      vars: { nombre: 'Paty Ruiz' },
    })
  })

  it('el cliente sin nombre → «Subido por: el cliente»', () => {
    expect(subidoPor({ origen: 'CLIENTE', subidoPorNombre: null })).toEqual({ clave: 'operaciones2.creativos.origen.cliente', vars: {} })
  })

  it('alguien de la organización → «Subido por: Ana López»', () => {
    expect(subidoPor({ origen: 'INTERNO', subidoPorNombre: 'Ana López' })).toEqual({
      clave: 'operaciones2.creativos.origen.interno-nombre',
      vars: { nombre: 'Ana López' },
    })
  })

  it('interno sin nombre → «Subido por: nuestro equipo»', () => {
    expect(subidoPor({ origen: 'INTERNO', subidoPorNombre: '' })).toEqual({ clave: 'operaciones2.creativos.origen.interno', vars: {} })
  })

  it('sin origen (lo anterior al 20/11) → «Origen desconocido», nunca se adivina', () => {
    expect(subidoPor({ origen: null, subidoPorNombre: null })).toEqual({ clave: 'operaciones2.creativos.origen.desconocido', vars: {} })
    // Aunque traiga un nombre: sin origen no se sabe si fue cliente o equipo.
    expect(subidoPor({ origen: null, subidoPorNombre: 'Alguien' })).toEqual({ clave: 'operaciones2.creativos.origen.desconocido', vars: {} })
    expect(subidoPor({})).toEqual({ clave: 'operaciones2.creativos.origen.desconocido', vars: {} })
  })
})
