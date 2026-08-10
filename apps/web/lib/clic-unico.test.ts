import { describe, it, expect, vi } from 'vitest'
import { guardaEnVuelo } from './clic-unico'

// ============================================================================
//  A5 / INC-07 · lo que impide que un doble clic mande dos altas.
//
//  Se prueba la guarda y no el botón porque el repo corre vitest en `node`, sin
//  jsdom: montar React exigiría dependencias nuevas, que el plan prohíbe. La
//  guarda ES lo que usa el botón —no una copia—, así que lo que aquí queda
//  fijado es su comportamiento real.
// ============================================================================

// Simula el clic tal y como lo hace el botón: pregunta si está ocupado y, si
// no, ejecuta el manejador y le pasa el resultado a la guarda.
function clic(g: ReturnType<typeof guardaEnVuelo>, manejador: () => unknown): 'ejecutado' | 'ignorado' {
  if (g.ocupado()) return 'ignorado'
  g.seguir(manejador())
  return 'ejecutado'
}

describe('1 · el segundo clic mientras el primero vuela', () => {
  it('se ignora, y el manejador corre UNA vez', async () => {
    // El caso entero de A5. Sin la guarda, esto son dos POST y dos filas.
    let resolver!: () => void
    const enVuelo = new Promise<void>((r) => { resolver = r })
    const manejador = vi.fn(() => enVuelo)
    const g = guardaEnVuelo()

    expect(clic(g, manejador)).toBe('ejecutado')
    expect(clic(g, manejador)).toBe('ignorado')
    expect(clic(g, manejador)).toBe('ignorado')
    expect(manejador).toHaveBeenCalledTimes(1)

    resolver()
    await enVuelo
  })

  it('es SÍNCRONO: bloquea en el mismo instante, sin esperar a un render', async () => {
    // Aquí está la diferencia con el `useState` de cada formulario. `setState`
    // no bloquea hasta el render siguiente, y entre medias cabe el segundo
    // clic. Esto se comprueba sin ceder el turno al bucle de eventos ni una
    // sola vez: no hay `await` entre los dos clics.
    let resolver!: () => void
    const enVuelo = new Promise<void>((r) => { resolver = r })
    const g = guardaEnVuelo()

    g.seguir(enVuelo)
    expect(g.ocupado()).toBe(true)

    resolver()
    await enVuelo
  })
})

describe('2 · vuelve a aceptar cuando termina', () => {
  it('tras resolverse', async () => {
    const g = guardaEnVuelo()
    const p = Promise.resolve('ok')
    g.seguir(p)
    await p
    await Promise.resolve() // deja correr el `then` interno de la guarda
    expect(g.ocupado()).toBe(false)
  })

  it('tras FALLAR — si no, el formulario quedaría muerto al primer error', async () => {
    // El modo de fallo que más duele: guardas con un error de validación, lo
    // corriges y el botón ya no responde. Se suelta igual en los dos casos.
    const g = guardaEnVuelo()
    const p = Promise.reject(new Error('el servidor dijo que no'))
    p.catch(() => {}) // el formulario captura lo suyo, como en la app
    g.seguir(p)
    await p.catch(() => {})
    await Promise.resolve()
    expect(g.ocupado()).toBe(false)
  })
})

describe('3 · un manejador que no es asíncrono no se bloquea nunca', () => {
  it('devuelve false y deja el botón libre', () => {
    // Si no, cualquier botón corriente —cerrar, cambiar de pestaña— quedaría
    // inservible después del primer clic.
    const g = guardaEnVuelo()
    expect(g.seguir(undefined)).toBe(false)
    expect(g.ocupado()).toBe(false)

    const manejador = vi.fn(() => 42)
    expect(clic(g, manejador)).toBe('ejecutado')
    expect(clic(g, manejador)).toBe('ejecutado')
    expect(manejador).toHaveBeenCalledTimes(2)
  })

  it('un objeto cualquiera tampoco cuenta como promesa', () => {
    const g = guardaEnVuelo()
    expect(g.seguir({ then: 'esto no es una función' })).toBe(false)
    expect(g.ocupado()).toBe(false)
  })
})

describe('4 · avisa del cambio para que el botón se repinte', () => {
  it('true al empezar y false al acabar, en ese orden', async () => {
    const cambios: boolean[] = []
    const g = guardaEnVuelo((v) => cambios.push(v))
    const p = Promise.resolve()
    g.seguir(p)
    expect(cambios).toEqual([true])
    await p
    await Promise.resolve()
    expect(cambios).toEqual([true, false])
  })

  it('no avisa cuando el manejador es síncrono: no hay nada que pintar', () => {
    const cambios: boolean[] = []
    const g = guardaEnVuelo((v) => cambios.push(v))
    g.seguir('un valor cualquiera')
    expect(cambios).toEqual([])
  })
})

describe('5 · no se inventa rechazos por el camino', () => {
  it('el fallo lo sigue viendo quien llamó, y la guarda no crea uno nuevo', async () => {
    // Con `finally` en vez de `then(soltar, soltar)`, la guarda devolvería una
    // promesa rechazada que nadie escucha: un «unhandled rejection» por cada
    // guardado fallido, con Node avisando en el log de producción.
    const sueltos: unknown[] = []
    const cazar = (e: unknown) => sueltos.push(e)
    process.on('unhandledRejection', cazar)
    try {
      const g = guardaEnVuelo()
      const fallo = new Error('400 del servidor')
      const p = Promise.reject(fallo)
      let visto: unknown = null
      p.catch((e) => { visto = e }) // lo que hace el formulario
      g.seguir(p)
      await new Promise((r) => setTimeout(r, 10))
      expect(visto).toBe(fallo)
      expect(sueltos).toEqual([])
    } finally {
      process.off('unhandledRejection', cazar)
    }
  })
})
