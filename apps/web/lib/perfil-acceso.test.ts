import { describe, it, expect } from 'vitest'
import { puedeFijarPasswordSinAnterior } from './perfil-acceso'

// ============================================================================
//  ADR 0018, lado del navegador.
//
//  La regla vive en el servidor (`perfil-controller.ts`), y ESO es lo que
//  manda. Esta función existe porque la pantalla tiene que tomar la MISMA
//  decisión para no pedir un dato que el servidor no va a exigir:
//  `configuracion/page.tsx` cortaba el envío ANTES de llamar a la API, así que
//  la regla funcionaba y era inalcanzable desde la interfaz.
//
//  Se extrae en vez de escribirse dentro del componente porque este proyecto no
//  tiene arnés de pruebas de UI: una condición de seguridad metida en un `.tsx`
//  no se puede probar. Aquí sí — mismo motivo que `lib/entorno.ts` y
//  `lib/host.ts`.
//
//  ⚠️ Es OPTIMISTA a propósito: no puede comprobar la identidad vinculada, que
//  solo se sabe en el servidor. Si se equivoca, el servidor responde 401 y la
//  pantalla enseña el error. Nunca al revés.
// ============================================================================

const base = {
  debeCambiarPassword: true,
  metodoSesion: 'google' as const,
  cambiaEmail: false,
  cambiaPassword: true,
}

describe('ADR 0018 · la pantalla decide igual que el servidor', () => {
  it('NO pide la anterior cuando se cumple todo', () => {
    expect(puedeFijarPasswordSinAnterior(base)).toBe(true)
  })

  it('SÍ la pide si la sesión no vino de Google', () => {
    expect(puedeFijarPasswordSinAnterior({ ...base, metodoSesion: 'password' })).toBe(false)
  })

  it('SÍ la pide si el usuario ya tiene contraseña propia', () => {
    expect(puedeFijarPasswordSinAnterior({ ...base, debeCambiarPassword: false })).toBe(false)
  })

  it('SÍ la pide si además se cambia el correo', () => {
    expect(puedeFijarPasswordSinAnterior({ ...base, cambiaEmail: true })).toBe(false)
  })

  it('SÍ la pide si no se está cambiando la contraseña', () => {
    expect(puedeFijarPasswordSinAnterior({ ...base, cambiaPassword: false })).toBe(false)
  })

  it('SÍ la pide si el servidor no mandó el método — sesión vieja', () => {
    // Las sesiones abiertas antes de la migración no traen `metodoSesion`.
    // `undefined` NO puede leerse como «adelante»: es el caso en que no se sabe.
    expect(puedeFijarPasswordSinAnterior({ ...base, metodoSesion: undefined })).toBe(false)
  })

  it('SÍ la pide si el servidor no mandó la bandera', () => {
    expect(puedeFijarPasswordSinAnterior({ ...base, debeCambiarPassword: undefined })).toBe(false)
  })
})
