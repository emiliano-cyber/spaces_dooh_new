import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// ============================================================================
//  El alta de una instancia tiene que validar el correo del Dueño.
// ----------------------------------------------------------------------------
//  Defecto ⑥ del arranque del PADRE (2026-08-21). Se pegó el bloque del runbook
//  con los marcadores todavía puestos y `bootstrap-auth.mjs` creó al Dueño con
//  el correo literal `<el correo de Google del Dueño>`. Comprobaba que las
//  variables no estuvieran VACÍAS, pero no que el correo lo pareciera.
//
//  Lo que lo vuelve grave es la asimetría: `lib/validacion.ts` ya tiene
//  `esEmailValido` y la aplicación SÍ la usa al dar de alta desde
//  Administración. O sea que por la pantalla no se podía crear un usuario con
//  correo inválido, y por el alta de una instancia sí — y es la cuenta de
//  máximo privilegio, la única que puede entrar el primer día.
//
//  Esta prueba corre SIN base de datos a propósito: el guard tiene que actuar
//  antes de conectar. Si algún día alguien lo mueve detrás de la conexión, el
//  caso de control de abajo se pondrá rojo.
// ============================================================================

const APPS_WEB = process.cwd()

/** Corre el alta con el entorno mínimo y devuelve lo que imprimió. */
function correrAlta(extra: Record<string, string>) {
  return spawnSync(process.execPath, [join('scripts', 'bootstrap-auth.mjs')], {
    cwd: APPS_WEB,
    env: {
      ...process.env,
      // Un destino que NO existe: si el guard del correo funciona, no se llega
      // a usar. Es lo que separa «rechazó el correo» de «no pudo conectar».
      DATABASE_URL: 'postgresql://nadie:nada@127.0.0.1:1/base_que_no_existe',
      ORG_SLUG: 'alta-correo',
      ORG_NOMBRE: 'Organizacion de prueba',
      ADMIN_EMAIL: 'duenia@alta.test',
      ADMIN_NOMBRE: 'Duena de prueba',
      ...extra,
    },
    encoding: 'utf8',
    timeout: 20_000,
  })
}

// El presupuesto de vitest tiene que ser MAYOR que el del `spawnSync` de arriba,
// y no es cosmético: cada caso arranca un proceso Node entero. Con la suite en
// paralelo ese arranque se queda sin CPU y se pasa de los 5000 ms que vitest da
// por omisión — medido el 2026-09-02: este archivo solo tarda 879 ms, y dentro
// de la suite completa el primer caso murió a los 5456 ms.
//
// Es la MISMA intermitente que `tipografia.test.ts` el 01/09, y el mensaje
// tampoco decía nada del código: «Test timed out in 5000ms». Por eso el arreglo
// va al presupuesto y no a la prueba — si el spawn puede tardar 20 s, el caso
// que lo espera no puede cortar a los 5. Dejarlos así hace que el resultado
// dependa de lo ocupada que esté la máquina, no del código.
const ESPERA = 25_000

describe('el alta de una instancia valida el correo del Dueño', () => {
  it('rechaza el marcador que se coló el 21/08, sin tocar la base', () => {
    const r = correrAlta({ ADMIN_EMAIL: '<el correo de Google del Dueño>' })

    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/ADMIN_EMAIL/)
    // El mensaje tiene que decir QUÉ está mal, no solo que algo lo está.
    expect(r.stderr).toMatch(/correo/i)
    // Y no puede haber intentado conectar: eso sería el guard en el sitio malo.
    expect(r.stderr).not.toMatch(/ECONNREFUSED|ENOTFOUND/)
  }, ESPERA)

  it.each([
    ['sin arroba', 'duenia.alta.test'],
    ['sin dominio', 'duenia@'],
    ['con espacio', 'due nia@alta.test'],
    ['sin punto en el dominio', 'duenia@alta'],
  ])('rechaza un correo %s', (_caso, email) => {
    const r = correrAlta({ ADMIN_EMAIL: email })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/ADMIN_EMAIL/)
  }, ESPERA)

  // ─── El contrafactual: sin él la prueba pasaría con un guard que rechaza
  // TODO, que es el otro modo de fallar y no daría error nunca.
  it('un correo válido pasa el guard y falla más adelante, al conectar', () => {
    const r = correrAlta({ ADMIN_EMAIL: 'duenia@alta.test' })
    expect(r.stderr).not.toMatch(/ADMIN_EMAIL/)
  }, ESPERA)
})

describe('la regla del correo existe UNA sola vez', () => {
  // Misma lección que `password-temporal.test.ts`: lo que impide que dos
  // validaciones divergan no es que hoy coincidan, es que solo exista una.
  it('validacion.ts no lleva su propia expresión regular', () => {
    const fuente = readFileSync(join(APPS_WEB, 'lib', 'validacion.ts'), 'utf8')
    expect(fuente).toMatch(/validacion-email/)
    expect(fuente).not.toMatch(/EMAIL_RE\s*=\s*\//)
  })

  it('el alta importa la validación compartida y no una copia', () => {
    const fuente = readFileSync(join(APPS_WEB, 'scripts', 'bootstrap-auth.mjs'), 'utf8')
    expect(fuente).toMatch(/validacion-email/)
    expect(fuente).not.toMatch(/EMAIL_RE\s*=\s*\//)
  })
})
