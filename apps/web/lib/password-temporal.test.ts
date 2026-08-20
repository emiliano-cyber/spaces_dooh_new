import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALFABETO_TEMPORAL, generarPasswordTemporal } from './password-temporal.mjs'

// ============================================================================
//  La contraseña temporal, en UN solo sitio.
// ----------------------------------------------------------------------------
//  Vivía dentro de `lib/server/usuarios-controller.ts`, sin exportar, y el alta
//  de una instancia (`apps/web/scripts/bootstrap-auth.mjs`) no podía usarla: es
//  un script suelto que no importa nada de la aplicación. Por eso el alta
//  sembraba `spaces123` — la misma contraseña en toda la flota (ROJO-1).
//
//  Se extrae en vez de reimplementarla porque este repositorio ya tiene la
//  lección escrita más de una vez: el mapa `ANTES_DE` duplicado entre el runner
//  y el arnés, y las dos matrices de permisos que cerró ROJO-2. Dos generadores
//  pueden divergir, y la divergencia de un generador de contraseñas no da error.
// ============================================================================

describe('generarPasswordTemporal()', () => {
  it('son cuatro grupos de cuatro, separados por guion', () => {
    // El formato existe para poder DICTARLA por teléfono.
    expect(generarPasswordTemporal()).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('no usa ninguno de los caracteres que se confunden al dictar', () => {
    // 0/O y 1/l/I. Si alguien «completara» el alfabeto, esto se pone rojo.
    for (const c of 'O0Il1') expect(ALFABETO_TEMPORAL).not.toContain(c)
    // Y en el resultado, medido sobre muchas: un alfabeto correcto no puede
    // producirlos, pero la prueba mide la salida y no la constante.
    const muestra = Array.from({ length: 200 }, generarPasswordTemporal).join('')
    expect(muestra).not.toMatch(/[O0Il1]/)
  })

  it('no repite: dos altas seguidas no comparten contraseña', () => {
    // El corazón de ROJO-1. Con `spaces123` no había que romper el bcrypt: había
    // que teclearla, y servía en toda la flota.
    const cien = new Set(Array.from({ length: 100 }, generarPasswordTemporal))
    expect(cien.size).toBe(100)
  })

  it('el controlador de usuarios NO tiene su propia copia', () => {
    // Lo que impide que diverjan no es que hoy coincidan: es que solo haya una.
    const fuente = readFileSync(join(__dirname, 'server', 'usuarios-controller.ts'), 'utf8')
    expect(fuente).not.toMatch(/function\s+generarPasswordTemporal/)
    expect(fuente).toMatch(/password-temporal/)
  })

  it('el alta de una instancia tampoco', () => {
    const fuente = readFileSync(join(__dirname, '..', 'scripts', 'bootstrap-auth.mjs'), 'utf8')
    expect(fuente).not.toMatch(/function\s+generarPasswordTemporal/)
    expect(fuente).toMatch(/password-temporal/)
  })
})
