import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { autoregistroActivo } from './entorno'

// ============================================================================
//  Banderas del entorno que se deciden AL ARRANCAR, no al compilar.
// ----------------------------------------------------------------------------
//  Que este fichero pueda existir es el punto entero de F2.6. Con la bandera
//  vieja (`NEXT_PUBLIC_AUTOREGISTRO`) esta prueba era IMPOSIBLE de escribir:
//  Next inlinea las variables con prefijo NEXT_PUBLIC_ en tiempo de build, así
//  que cambiar `process.env` entre dos llamadas no cambiaba nada — el valor ya
//  no se leía de `process.env`, estaba escrito en el bundle.
// ============================================================================

const original = process.env.AUTOREGISTRO

afterEach(() => {
  if (original === undefined) delete process.env.AUTOREGISTRO
  else process.env.AUTOREGISTRO = original
})

describe('autoregistroActivo', () => {
  it('cambia de valor entre llamadas, sin recompilar', () => {
    // Las dos afirmaciones van en el MISMO caso a propósito: lo que se prueba
    // no es cada valor por separado, sino que el segundo cambio surta efecto.
    process.env.AUTOREGISTRO = '1'
    expect(autoregistroActivo()).toBe(true)

    process.env.AUTOREGISTRO = '0'
    expect(autoregistroActivo()).toBe(false)
  })

  it('sin la variable definida, viene APAGADO', () => {
    // Fail-closed, y es una inversión deliberada respecto al comportamiento
    // anterior (`!== '0'`, o sea encendido si faltaba). Una instancia cuyo
    // `.env` se quedó corto no abre el registro público por descuido.
    delete process.env.AUTOREGISTRO
    expect(autoregistroActivo()).toBe(false)
  })
})

// ============================================================================
//  La PLANTILLA de entorno del repo (F0.3).
// ----------------------------------------------------------------------------
//  `autoregistroActivo()` es fail-closed, pero eso solo protege a quien NO
//  declara la variable. Quien levanta el proyecto copiando `.env.example` se
//  lleva lo que la plantilla diga, y hasta hoy nada vigilaba ese valor: el
//  14/08 se bajó a `=0` por decisión de Jochelo (`0dbccb8`) y devolverlo a `=1`
//  habría dejado la suite en verde y al CI mudo. Esta es la mitad de F0.3 que
//  faltaba: «que una prueba impida volver atrás».
//
//  La ruta se resuelve desde `__dirname` y NO desde el directorio de trabajo:
//  vitest se invoca desde `apps/web`, pero un `npx vitest` lanzado desde la
//  raíz encontraría el archivo igual. `lib` → `apps/web` → `apps` → raíz.
// ============================================================================

const PLANTILLA = readFileSync(join(__dirname, '..', '..', '..', '.env.example'), 'utf8')

describe('.env.example', () => {
  it('la plantilla de entorno nace con el autoregistro apagado', () => {
    // Se exige el valor EXPLÍCITO `=0`, no solo la ausencia de `=1`: la
    // plantilla es además el sitio donde se documenta la decisión, y una
    // variable ausente no la documenta.
    expect(PLANTILLA).toMatch(/^AUTOREGISTRO=0$/m)
  })

  it('la plantilla no propone un dominio de cookie', () => {
    // Invariante 4 del modelo de instancias: las cookies son host-only. Un
    // `COOKIE_DOMAIN` con valor en la plantilla invita a compartir sesión
    // entre dominios, que es justo lo que el modelo por instancia prohíbe —
    // y encima ningún archivo de `apps/` lo lee, así que sería una promesa
    // que nada cumple.
    expect(PLANTILLA).not.toMatch(/^COOKIE_DOMAIN=.+$/m)
  })
})

// ============================================================================
//  La plantilla de PRODUCCIÓN (T-03).
// ----------------------------------------------------------------------------
//  F0.3 puso bajo llave `.env.example`, pero esa no es la plantilla que se
//  copia para montar una instancia real: esa es `.env.production.example`, y
//  quedó fuera del candado con los dos mismos problemas.
//
//  El de la cookie era el grave. Declaraba
//  `COOKIE_DOMAIN=.{TENANT_SLUG}.spaces.com`, una cookie comodín de segundo
//  nivel del modelo de subdominios por tenant, muerto desde el 2026-08-12.
//  Hoy es inocuo —`apps/web` no lee la variable— pero es LATENTE: el código
//  que sí la consume sigue en el repo
//  (`_archive/api/src/core/auth/auth.routes.ts:17` hace
//  `domain: process.env.COOKIE_DOMAIN`), así que el día que alguien haga
//  configurable el `domain` de `cookieSesion()`, todos los `.env` nacidos de
//  esta plantilla comparten sesión por `*.spaces.com`: fuga entre instancias
//  soberanas, y del tipo que no da error.
// ============================================================================

// A diferencia de la constante de arriba, la plantilla se lee DENTRO de cada
// caso. Si el archivo desapareciera, debe caer el caso que lo mira y solo ese:
// leerlo al cargar el módulo convierte un archivo ausente en un error de
// importación que tumba también los casos de `autoregistroActivo()`, que no
// tienen nada que ver con las plantillas.
function plantillaProduccion(): string {
  return readFileSync(join(__dirname, '..', '..', '..', '.env.production.example'), 'utf8')
}

describe('.env.production.example', () => {
  it('la plantilla de produccion no propone un dominio de cookie', () => {
    // Invariante 4 del plan v3 (`docs/Plan_Instancias_Soberanas_v3.md:219`):
    // «las cookies siguen sin `domain`». `cookieSesion()`
    // (`lib/server/auth.ts:191-201`) y `cookieCsrf()` (`:216-226`) no lo fijan,
    // y la plantilla que lee el operador no puede decir lo contrario.
    expect(plantillaProduccion()).not.toMatch(/^COOKIE_DOMAIN=.+$/m)
  })

  it('la plantilla de produccion nace con el autoregistro apagado', () => {
    // El mismo candado que F0.3 puso en la plantilla de desarrollo: se exige
    // el valor EXPLÍCITO `=0` y no la mera ausencia, porque la plantilla es
    // además donde se documenta la decisión del 14/08 (cerrado en TODA la
    // flota) y una variable ausente no la documenta.
    expect(plantillaProduccion()).toMatch(/^AUTOREGISTRO=0$/m)
  })
})
