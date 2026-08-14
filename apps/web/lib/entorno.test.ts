import { describe, it, expect, afterEach } from 'vitest'
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
