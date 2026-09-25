import { describe, it, expect, vi } from 'vitest'
import { confirmarConCandado, esErrorDeDesbloqueo } from './cambios-candado'
import { MENSAJE_DESBLOQUEO } from './cambios-mensajes'

// ============================================================================
//  El paso de la contrasena en un cambio sensible, sacado de los `.tsx`.
// ----------------------------------------------------------------------------
//  POR QUE EXISTE ESTE ARCHIVO. El cuadro «Con cual de tus razones sociales se
//  paga» pedia la contrasena y NO pintaba donde escribirla: el servidor
//  contestaba 403 con `requiereDesbloqueo`, el modal lo enseñaba como un error
//  rojo y ahi se acababa el camino. El arreglo no podia ser copiar a mano el
//  bailoteo de `BajaPropietarioDialog` una cuarta vez —cada copia es otra
//  ocasion de olvidarse del input— asi que la secuencia vive aqui, en un modulo
//  PURO, y se prueba.
//
//  EL CORAZON SON LOS NEGATIVOS. Lo que hay que demostrar no es que con la
//  contrasena correcta se guarde: es que SIN contrasena NO se guarda. Por eso
//  casi todas las aserciones de abajo son sobre `guardar` NO llamado.
//
//  LO QUE NO AFIRMA: nada sobre permisos. Quien decide si un cambio pasa es el
//  servidor (`lib/server/cambios.ts`). Esto es solo la cara del cliente, y un
//  cliente no protege nada — hace que el camino exista.
// ============================================================================

/** El 403 del servidor, tal y como llega a la UI: los clientes de `estado-api`
 *  lanzan `Error(d.error)` y por el camino se pierde `requiereDesbloqueo`; lo
 *  unico que sobrevive es el mensaje. */
const errorDelCandado = () => new Error(MENSAJE_DESBLOQUEO)

describe('1 · esErrorDeDesbloqueo — reconocer que falta la contrasena', () => {
  it('reconoce el mensaje que emite el servidor', () => {
    expect(esErrorDeDesbloqueo(errorDelCandado())).toBe(true)
  })

  it('NO confunde cualquier otro error con el candado', () => {
    // Si esto devolviera true de mas, un fallo real de guardado abriria el
    // cuadro de la contrasena y el usuario tecleria su clave para nada.
    expect(esErrorDeDesbloqueo(new Error('No se pudo guardar el contrato'))).toBe(false)
    expect(esErrorDeDesbloqueo('texto suelto')).toBe(false)
    expect(esErrorDeDesbloqueo(null)).toBe(false)
    expect(esErrorDeDesbloqueo(undefined)).toBe(false)
  })
})

describe('2 · SIN contrasena no se guarda — el negativo que importa', () => {
  it('ya pedida la contrasena, en blanco no intenta NADA', async () => {
    const desbloquear = vi.fn(async () => {})
    const guardar = vi.fn(async () => {})

    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: '',
      desbloquear,
      guardar,
    })

    expect(r).toEqual({ estado: 'falta-contrasena' })
    // Las dos aserciones son el corazon del arreglo: ni se desbloquea ni se
    // guarda. Si `guardar` llegara a correr, el cambio entraria sin que nadie
    // hubiera tecleado nada.
    expect(desbloquear).not.toHaveBeenCalled()
    expect(guardar).not.toHaveBeenCalled()
  })

  it('con la contrasena EQUIVOCADA no se guarda, y se sigue pidiendo', async () => {
    const desbloquear = vi.fn(async () => {
      throw new Error('Contrasena incorrecta')
    })
    const guardar = vi.fn(async () => {})

    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-que-no-es',
      desbloquear,
      guardar,
    })

    expect(desbloquear).toHaveBeenCalledTimes(1)
    // Lo que se prueba: el fallo del desbloqueo CORTA. No se guarda nada.
    expect(guardar).not.toHaveBeenCalled()
    expect(r).toEqual({ estado: 'pedir-contrasena', error: 'Contrasena incorrecta' })
  })

  it('el servidor pide la contrasena → se pide, y NO queda nada guardado', async () => {
    const desbloquear = vi.fn(async () => {})
    const guardar = vi.fn(async () => {
      throw errorDelCandado()
    })

    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear,
      guardar,
    })

    // Este es el camino del defecto: antes acababa en un error rojo sin salida.
    // Ahora devuelve «pidela», que es lo que hace aparecer el campo.
    expect(r).toEqual({ estado: 'pedir-contrasena', error: null })
    expect(desbloquear).not.toHaveBeenCalled()
    expect(guardar).toHaveBeenCalledTimes(1)
  })
})

describe('3 · el orden importa: primero desbloquear, luego guardar', () => {
  it('desbloquea ANTES de guardar, y guarda una sola vez', async () => {
    const orden: string[] = []
    const desbloquear = vi.fn(async () => {
      orden.push('desbloquear')
    })
    const guardar = vi.fn(async () => {
      orden.push('guardar')
    })

    const r = await confirmarConCandado({
      reautenticando: true,
      contrasena: 'la-buena',
      desbloquear,
      guardar,
    })

    expect(r).toEqual({ estado: 'hecho' })
    // Al reves el guardado volveria a chocar con el candado y el usuario veria
    // el cuadro dos veces con la contrasena ya puesta.
    expect(orden).toEqual(['desbloquear', 'guardar'])
    expect(guardar).toHaveBeenCalledTimes(1)
  })

  it('la contrasena viaja TAL CUAL, sin recortar espacios', async () => {
    // Una contrasena puede empezar o acabar en espacio. Un `.trim()` de
    // conveniencia la convertiria en otra y el desbloqueo fallaria sin que se
    // entendiera por que.
    const desbloquear = vi.fn(async () => {})
    await confirmarConCandado({
      reautenticando: true,
      contrasena: '  con espacios  ',
      desbloquear,
      guardar: async () => {},
    })
    expect(desbloquear).toHaveBeenCalledWith('  con espacios  ')
  })
})

describe('4 · un fallo que NO es el candado no pide contrasena', () => {
  it('un error cualquiera sale como error, no como «teclea tu clave»', async () => {
    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: async () => {
        throw new Error('El contrato ya no existe')
      },
    })
    expect(r).toEqual({ estado: 'error', error: 'El contrato ya no existe' })
  })

  it('algo lanzado que no es Error tampoco pide contrasena', async () => {
    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear: async () => {},
      guardar: async () => {
        throw 'vaya'
      },
      mensajeSiFalla: 'No se pudo guardar',
    })
    expect(r).toEqual({ estado: 'error', error: 'No se pudo guardar' })
  })
})

describe('5 · el camino feliz sin candado', () => {
  it('sin candado por medio, guarda y se acabo', async () => {
    const desbloquear = vi.fn(async () => {})
    const guardar = vi.fn(async () => {})
    const r = await confirmarConCandado({
      reautenticando: false,
      contrasena: '',
      desbloquear,
      guardar,
    })
    expect(r).toEqual({ estado: 'hecho' })
    expect(desbloquear).not.toHaveBeenCalled()
    expect(guardar).toHaveBeenCalledTimes(1)
  })
})
