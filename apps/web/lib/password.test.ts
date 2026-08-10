import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarPassword, REGLA_PASSWORD } from './password'

// ============================================================================
//  La política de contraseñas, y que no haya dos.
// ----------------------------------------------------------------------------
//  El fallo real no era la función: era que vivía dentro de `server-only`, así
//  que ningún formulario podía importarla y cada uno la reimplementaba a ojo.
//  El registro PÚBLICO pedía 6 donde el servidor exige 8 — se tecleaba, se
//  pulsaba «Crear cuenta» y salía un 400.
//
//  Por eso la última prueba de este fichero no mira la función sino el REPO:
//  una regla duplicada no se detecta probando la regla.
// ============================================================================

describe('1 · qué se acepta y qué no', () => {
  it('acepta una contraseña con letra, número y ocho caracteres', () => {
    expect(validarPassword('Prueba1234')).toBeNull()
    expect(validarPassword('a1bcdefg')).toBeNull()
  })

  it('rechaza por debajo de ocho, y lo dice', () => {
    expect(validarPassword('Abc123')).toBe('La contraseña debe tener al menos 8 caracteres')
    expect(validarPassword('Abcdef1')).toContain('8 caracteres')
  })

  it('rechaza «aaaaaaaa»: ocho caracteres no bastan', () => {
    // El agujero de los formularios de administración, que solo miraban la
    // longitud: esto pasaba el filtro del navegador y rebotaba en el servidor.
    expect(validarPassword('aaaaaaaa')).toBe('La contraseña debe incluir al menos un número')
  })

  it('rechaza solo dígitos', () => {
    expect(validarPassword('12345678')).toBe('La contraseña debe incluir al menos una letra')
  })

  it('rechaza espacios', () => {
    expect(validarPassword('Prueba 1234')).toBe('La contraseña no puede contener espacios')
  })

  it('no revienta con lo que no es texto', () => {
    // Llega de `req.json()`: puede venir cualquier cosa.
    for (const v of [undefined, null, 42, {}, [], true]) {
      expect(validarPassword(v)).toBe('La contraseña debe tener al menos 8 caracteres')
    }
  })
})

describe('2 · lo que se le promete al usuario es lo que se le exige', () => {
  it('el texto de la regla menciona el mínimo real, la letra y el número', () => {
    // Un `placeholder` que promete menos de lo que se exige es la forma más
    // barata de hacer fallar a alguien en la primera pantalla.
    expect(REGLA_PASSWORD).toContain('8')
    expect(REGLA_PASSWORD).toMatch(/letra/i)
    expect(REGLA_PASSWORD).toMatch(/número|numero/i)
  })

  it('lo que promete la regla, la función lo acepta', () => {
    expect(validarPassword('abcdefg1')).toBeNull()
  })
})

describe('3 · nadie vuelve a escribir la regla por su cuenta', () => {
  const raiz = join(__dirname, '..')
  const archivos = [
    'app/(app)/login/page.tsx',
    'app/(app)/(shell)/administracion/page.tsx',
    'components/demo/admin/OrganizacionesPanel.tsx',
  ]

  it('ningún formulario de contraseña compara longitudes a mano', () => {
    // Esta es la prueba que habría cazado el fallo. Las otras pasaban con la
    // regla duplicada: la función estaba bien, el problema era que había copias.
    //
    // `_legacy/` queda fuera a propósito: no se sirve.
    const culpables: string[] = []
    for (const rel of archivos) {
      const src = readFileSync(join(raiz, rel), 'utf8')
      // Caza `password.length >= 6` o `.trim().length < 8` — un UMBRAL de
      // política escrito a mano.
      //
      // Contra 0 o 1 no cuenta: `password.length > 0` es «¿ya escribió algo?»,
      // que es lo que decide si enseñar el motivo del rechazo mientras teclea.
      // Eso no es una regla, y prohibirlo obligaría a rodearlo por rodearlo.
      if (/password[^\n]{0,30}\.length\s*[<>]=?\s*([2-9]|\d\d)/i.test(src)) culpables.push(rel)
    }
    expect(culpables, 'usa validarPassword() de @/lib/password en vez de contar caracteres').toEqual([])
  })

  it('los tres importan la política compartida', () => {
    for (const rel of archivos) {
      const src = readFileSync(join(raiz, rel), 'utf8')
      expect(src, rel).toContain("from '@/lib/password'")
    }
  })

  it('ninguno promete un mínimo escrito a mano en el placeholder', () => {
    for (const rel of archivos) {
      const src = readFileSync(join(raiz, rel), 'utf8')
      expect(src, rel).not.toMatch(/placeholder="mínimo \d/)
    }
  })
})
