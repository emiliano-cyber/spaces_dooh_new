import { describe, it, expect } from 'vitest'
import { ROLES_ASIGNABLES, rolLabel, VALORES_ROL } from './roles'
import { landingDeRol } from './data/usuarios'
import type { RolDemo } from './data/types'

// ============================================================================
//  ADR 0040 · Los cuatro roles nuevos, declarados UNA sola vez.
// ----------------------------------------------------------------------------
//  Antes de esto la lista de roles vivía en CUATRO sitios —el enum de zod de
//  `usuarios-controller`, el `ROLES` de `nav.ts`, el `ROL_LABEL` de
//  `usuarios-repo` y el `switch` de `landingDeRol`— y nada obligaba a que
//  coincidieran. Con cuatro roles nuevos entrando de golpe, eso son cuatro
//  oportunidades de que uno se quede fuera y el síntoma sea «creo el usuario y
//  no puede entrar a ninguna pantalla», que no señala la causa.
//
//  Es la misma lección del mapa `ANTES_DE` duplicado: lo que impide que dos
//  listas diverjan no es que hoy coincidan, es que solo exista una.
// ============================================================================

const NUEVOS = ['ADMINISTRADOR', 'DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']

describe('1 · el catálogo de roles asignables', () => {
  it('trae los cuatro roles nuevos del ADR 0040', () => {
    const valores = ROLES_ASIGNABLES.map((r) => r.value)
    for (const nuevo of NUEVOS) expect(valores).toContain(nuevo)
  })

  it('NO ofrece ya COMERCIAL: se retira de uso (no del enum)', () => {
    // Un valor de enum de Postgres no se puede quitar sin recrear el tipo, así
    // que `rol_demo` conserva 'COMERCIAL' para siempre. Lo que se retira es la
    // PUERTA: nadie nuevo nace con él, y la migración le quita sus filas de
    // `rol_permisos`. Misma decisión que el ADR 0010 tomó con 'CLIENTE'.
    expect(ROLES_ASIGNABLES.map((r) => r.value)).not.toContain('COMERCIAL')
  })

  it('tampoco CLIENTE (ADR 0010), y sigue sin ofrecerse', () => {
    expect(ROLES_ASIGNABLES.map((r) => r.value)).not.toContain('CLIENTE')
  })

  it('cada rol asignable tiene etiqueta, y ninguna se repite', () => {
    const etiquetas = ROLES_ASIGNABLES.map((r) => r.label)
    expect(etiquetas.every((l) => l.trim().length > 0)).toBe(true)
    expect(new Set(etiquetas).size).toBe(etiquetas.length)
  })

  it('`rolLabel` cae al propio valor si el rol no está en la lista', () => {
    // COMERCIAL sigue existiendo en la base. Una pantalla que pinte un usuario
    // viejo no debe romperse ni enseñar «undefined».
    expect(rolLabel('COMERCIAL' as RolDemo)).toBe('COMERCIAL')
    expect(rolLabel('VENDEDOR')).toBe('Vendedor')
  })
})

describe('2 · el tipo y el enum de la base no divergen', () => {
  it('VALORES_ROL enumera TODO lo que `rol_demo` admite, retirados incluidos', () => {
    // Los retirados siguen en el enum de Postgres y pueden llegar en una fila
    // vieja. Dejarlos fuera del tipo obligaría a un `as` en cada sitio que lea
    // un rol de la base, que es como se cuela un valor sin manejar.
    expect([...VALORES_ROL].sort()).toEqual(
      [
        'ADMINISTRADOR',
        'CLIENTE',
        'COMERCIAL',
        'DIRECTOR_COMERCIAL',
        'DUENO',
        'FINANZAS',
        'GERENTE_VENTAS',
        'IMPRENTA',
        'OPERACIONES',
        'VENDEDOR',
      ].sort(),
    )
  })

  it('todo rol asignable está en VALORES_ROL', () => {
    for (const r of ROLES_ASIGNABLES) expect(VALORES_ROL).toContain(r.value)
  })
})

describe('3 · cada rol aterriza en una pantalla que puede abrir', () => {
  it('los cuatro nuevos tienen landing, y ninguno cae en undefined', () => {
    // `landingDeRol` es un `switch` SIN `default`: añadir un valor al tipo y
    // olvidarse de él devuelve `undefined` y el usuario acaba en una URL
    // literalmente llamada «undefined». El compilador lo caza, y esto también.
    for (const rol of NUEVOS) {
      const destino = landingDeRol(rol as RolDemo)
      expect(typeof destino, rol).toBe('string')
      expect(destino.startsWith('/'), `${rol} → ${destino}`).toBe(true)
    }
  })

  it('el administrador aterriza donde el Dueño: hace lo mismo que él', () => {
    expect(landingDeRol('ADMINISTRADOR')).toBe(landingDeRol('DUENO'))
  })

  it('los tres roles de venta aterrizan en el ciclo comercial', () => {
    for (const rol of ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']) {
      expect(landingDeRol(rol as RolDemo), rol).toBe('/comercial')
    }
  })
})
