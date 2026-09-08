import { describe, it, expect } from 'vitest'
import { decidirPantalla, salidaObligatoria, type SituacionUsuario } from './compuerta'

// ============================================================================
//  La compuerta no puede encerrar al usuario.
// ----------------------------------------------------------------------------
//  Lo que estas pruebas protegen: que cuando el servidor CORTA la aplicación y
//  exige una acción, la pantalla que resuelve esa acción se pueda ver.
//
//  El fallo que las motiva se midió en el PADRE el 2026-09-08. El Dueño entra
//  con Google, `codigos_vistos_en` está en null, y `exigir()` responde 403 en
//  TODAS las rutas (`lib/server/auth.ts:230`). Con eso `/api/estado` falla, el
//  store queda en `estadoCarga: 'error'` (`lib/data/estado-api.ts:32`) y
//  `AuthGate` pintaba «No se pudieron cargar los datos» — también estando ya en
//  `/codigos-recuperacion`, que vive DENTRO de `(shell)` y por tanto pasa por
//  la misma compuerta. La aplicación entera inaccesible, sin decir por qué, con
//  un botón de reintentar incapaz de cambiar nada.
//
//  Es la SEGUNDA vez que ocurre el mismo defecto. La contraseña temporal del
//  ADR 0009 lo tuvo hasta `3865c4e`, y su arreglo —la exención de render para
//  `/configuracion`— no se generalizó: cuando el ADR 0028 añadió un segundo
//  estado bloqueante, solo le puso la redirección. Por eso lo que se prueba
//  aquí no es un caso, es la regla: **todo estado bloqueante tiene salida, y su
//  salida se renderiza aunque el store esté en error.**
// ============================================================================

const LIBRE: SituacionUsuario = {
  debeGuardarCodigos: false,
  debeCambiarPassword: false,
  ruta: '/inicio',
  noAutorizado: false,
  estadoCarga: 'listo',
}

const situacion = (cambios: Partial<SituacionUsuario>): SituacionUsuario => ({
  ...LIBRE,
  ...cambios,
})

describe('salidaObligatoria — la pantalla que saca de un estado bloqueante', () => {
  it('sin nada pendiente no hay salida obligatoria', () => {
    expect(salidaObligatoria({ debeGuardarCodigos: false, debeCambiarPassword: false })).toBeNull()
  })

  it('códigos sin guardar → /codigos-recuperacion', () => {
    expect(salidaObligatoria({ debeGuardarCodigos: true, debeCambiarPassword: false })).toBe(
      '/codigos-recuperacion',
    )
  })

  it('contraseña temporal → /configuracion', () => {
    expect(salidaObligatoria({ debeGuardarCodigos: false, debeCambiarPassword: true })).toBe(
      '/configuracion',
    )
  })

  // El orden no es preferencia: quien entra con Google no tiene contraseña que
  // cambiar, así que mandarlo a Configuración lo dejaría dando vueltas en una
  // pantalla que no le sirve. Mismo orden que el efecto de `AuthGate`.
  it('con los dos puestos gana el de los códigos', () => {
    expect(salidaObligatoria({ debeGuardarCodigos: true, debeCambiarPassword: true })).toBe(
      '/codigos-recuperacion',
    )
  })
})

describe('decidirPantalla — lo que no puede pasar', () => {
  // ─── El defecto del 08/09, en rojo ─────────────────────────────────────────
  it('códigos pendientes y YA en su pantalla → la renderiza, aunque el store esté en error', () => {
    expect(
      decidirPantalla(
        situacion({
          debeGuardarCodigos: true,
          ruta: '/codigos-recuperacion',
          estadoCarga: 'error',
        }),
      ),
    ).toBe('contenido')
  })

  it('códigos pendientes y en su pantalla → la renderiza aunque el store no haya cargado', () => {
    expect(
      decidirPantalla(
        situacion({
          debeGuardarCodigos: true,
          ruta: '/codigos-recuperacion',
          estadoCarga: 'pendiente',
        }),
      ),
    ).toBe('contenido')
  })

  it('códigos pendientes FUERA de su pantalla → espera la redirección, no pinta el error', () => {
    expect(
      decidirPantalla(
        situacion({ debeGuardarCodigos: true, ruta: '/inicio', estadoCarga: 'error' }),
      ),
    ).toBe('cargando')
  })

  it('con los dos puestos manda el de los códigos: en /configuracion todavía espera', () => {
    expect(
      decidirPantalla(
        situacion({
          debeGuardarCodigos: true,
          debeCambiarPassword: true,
          ruta: '/configuracion',
          estadoCarga: 'error',
        }),
      ),
    ).toBe('cargando')
  })

  // ─── Lo que ya funcionaba y no se puede romper de paso ─────────────────────
  it('contraseña temporal y ya en Configuración → la renderiza aunque el store esté en error', () => {
    expect(
      decidirPantalla(
        situacion({
          debeCambiarPassword: true,
          ruta: '/configuracion',
          estadoCarga: 'error',
        }),
      ),
    ).toBe('contenido')
  })

  it('contraseña temporal fuera de Configuración → espera la redirección', () => {
    expect(
      decidirPantalla(situacion({ debeCambiarPassword: true, ruta: '/inicio' })),
    ).toBe('cargando')
  })

  // Sin estado bloqueante el error SÍ se pinta: es el hallazgo C1 de la
  // auditoría del 04/08 y no se toca. Un "0 de 0" silencioso manda al usuario a
  // buscar el problema en sus filtros.
  it('sin nada bloqueante, un store en error SÍ pinta el error', () => {
    expect(decidirPantalla(situacion({ estadoCarga: 'error' }))).toBe('error-de-carga')
  })

  it('sin nada bloqueante, un store pendiente espera', () => {
    expect(decidirPantalla(situacion({ estadoCarga: 'pendiente' }))).toBe('cargando')
  })

  it('todo en orden → renderiza la página pedida', () => {
    expect(decidirPantalla(LIBRE)).toBe('contenido')
  })

  it('rol sin acceso al módulo → espera su redirección, no pinta nada suyo', () => {
    expect(decidirPantalla(situacion({ noAutorizado: true }))).toBe('cargando')
  })

  // La ruta llega ya normalizada; con `basePath` sin quitar, la exención no
  // reconocería su propia pantalla y el encierro volvería por la puerta de al
  // lado. `AuthGate` normaliza antes de llamar aquí.
  it('la exención compara la ruta normalizada, sin basePath', () => {
    expect(
      decidirPantalla(
        situacion({
          debeGuardarCodigos: true,
          ruta: '/spaces-dooh/codigos-recuperacion',
          estadoCarga: 'error',
        }),
      ),
    ).toBe('cargando')
  })
})
