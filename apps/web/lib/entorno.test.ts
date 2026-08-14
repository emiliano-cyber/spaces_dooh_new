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
