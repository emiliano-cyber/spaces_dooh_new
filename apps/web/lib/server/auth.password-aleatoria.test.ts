import { describe, it, expect } from 'vitest'
import { passwordAleatoria, validarPassword } from './auth'

// ============================================================================
//  ADR 0012 · la contraseña que nadie ve, para las cuentas que entran con
//  Google.
//
//  Lo que hay que probar no es que sea aleatoria: es que SIEMPRE cumpla la
//  política. Si fallara una vez de cada tantas, el alta de usuario fallaría de
//  forma intermitente y sin motivo aparente — el peor tipo de fallo, porque no
//  se reproduce cuando lo buscas.
// ============================================================================

describe('passwordAleatoria', () => {
  it('siempre pasa validarPassword, en muchas generaciones', () => {
    // base64url puede salir sin letras o sin dígitos; por eso la contraseña se
    // CONSTRUYE cumpliendo la política en vez de confiar en el azar. Con 500
    // intentos, un fallo de 1 entre 100 saldría casi seguro.
    for (let i = 0; i < 500; i++) {
      const p = passwordAleatoria()
      expect(validarPassword(p), `falló con «${p}»`).toBeNull()
    }
  })

  it('no se repite', () => {
    const vistas = new Set(Array.from({ length: 200 }, () => passwordAleatoria()))
    expect(vistas.size).toBe(200)
  })

  it('es lo bastante larga como para no adivinarse', () => {
    // No es un secreto que alguien teclee, pero sigue siendo un hash en la
    // base: si fuera corta, un volcado la haría rompible por fuerza bruta.
    expect(passwordAleatoria().length).toBeGreaterThanOrEqual(24)
  })

  it('no lleva espacios, que la política rechaza', () => {
    for (let i = 0; i < 100; i++) {
      expect(passwordAleatoria()).not.toMatch(/\s/)
    }
  })
})
