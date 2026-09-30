import { describe, it, expect } from 'vitest'
import { crearColaChecklist, type CambioPunto, type EstadoGuardado } from './checklist-autoguardado'

// ============================================================================
//  OT-CHECK-01 · la cola del autoguardado del checklist de una OT.
// ----------------------------------------------------------------------------
//  Pedido del dueño, 2026-09-30: «que todo lo de OT se guarde cada vez que se
//  tacha algo del checklist». Hasta hoy el checklist vivía SOLO en un
//  `useState` de `OTVista.tsx` y se perdía al recargar.
//
//  La lógica vive fuera del `.tsx` por la misma razón que `costo-ot-captura.ts`:
//  `vitest.config.ts` no monta jsdom, así que una decisión escrita dentro de un
//  componente no la prueba nadie.
//
//  Lo que de verdad se prueba aquí son los CLICS RÁPIDOS. La cuadrilla tacha
//  tres puntos en un segundo con el teléfono; si cada clic lanzara su propia
//  petición sin orden, la del «desmarcar» podría llegar antes que la del
//  «marcar» y el servidor se quedaría con lo contrario de lo que se ve.
// ============================================================================

/** Un `enviar` controlable: cada llamada queda en espera hasta resolverla. */
function enviarControlado() {
  const llamadas: { cambio: CambioPunto; ok: () => void; falla: (m: string) => void }[] = []
  const enviar = (cambio: CambioPunto) =>
    new Promise<void>((resolve, reject) => {
      llamadas.push({ cambio, ok: resolve, falla: (m) => reject(new Error(m)) })
    })
  return { enviar, llamadas }
}

// Deja correr las promesas encadenadas de la cola.
const tic = () => new Promise((r) => setTimeout(r, 0))

function crear() {
  const ctl = enviarControlado()
  const estados: { estado: EstadoGuardado; error: string | null }[] = []
  const cola = crearColaChecklist({
    enviar: ctl.enviar,
    alCambiar: (e) => estados.push({ estado: e.estado, error: e.error }),
  })
  return { cola, ...ctl, estados }
}

const p = (indice: number, hecho: boolean): CambioPunto => ({ indice, label: `punto ${indice}`, hecho })

describe('control · un clic se envía y queda guardado', () => {
  it('marca, envía una vez y termina en «guardado»', async () => {
    const { cola, llamadas, estados } = crear()
    expect(cola.estado()).toBe('inactivo')
    cola.marcar(p(0, true))
    expect(cola.estado()).toBe('guardando')
    await tic()
    expect(llamadas.map((l) => l.cambio)).toEqual([p(0, true)])
    llamadas[0].ok()
    await tic()
    expect(cola.estado()).toBe('guardado')
    expect(estados.at(-1)).toEqual({ estado: 'guardado', error: null })
    expect(cola.pendientes()).toBe(0)
  })
})

describe('clics rápidos · nunca hay dos peticiones a la vez', () => {
  it('el segundo clic espera a que termine el primero', async () => {
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    cola.marcar(p(1, true))
    await tic()
    // Serializado: solo UNA en vuelo.
    expect(llamadas).toHaveLength(1)
    llamadas[0].ok()
    await tic()
    expect(llamadas).toHaveLength(2)
    expect(llamadas[1].cambio).toEqual(p(1, true))
    llamadas[1].ok()
    await tic()
    expect(cola.estado()).toBe('guardado')
  })

  it('marcar y desmarcar el MISMO punto antes de enviarse manda solo lo último', async () => {
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true)) // en vuelo
    cola.marcar(p(1, true)) // en espera
    cola.marcar(p(1, false)) // sustituye al anterior: el usuario se arrepintió
    cola.marcar(p(1, true)) // y volvió a marcarlo
    await tic()
    llamadas[0].ok()
    await tic()
    llamadas[1].ok()
    await tic()
    // Tres clics sobre el punto 1 = UNA petición, con el último valor.
    expect(llamadas.map((l) => l.cambio)).toEqual([p(0, true), p(1, true)])
    expect(cola.estado()).toBe('guardado')
  })

  it('un cambio del punto EN VUELO se manda después, en orden', async () => {
    // El caso que un «último gana» mal hecho rompe: el clic que desmarca llega
    // mientras la marca está en camino, y tiene que ir DETRÁS, no perderse.
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    await tic()
    cola.marcar(p(0, false))
    llamadas[0].ok()
    await tic()
    expect(llamadas.map((l) => l.cambio)).toEqual([p(0, true), p(0, false)])
    llamadas[1].ok()
    await tic()
    expect(cola.locales().size).toBe(0)
  })

  it('`locales()` dice lo que aún no está confirmado, en vuelo incluido', async () => {
    // Lo usa la pantalla al recargar: sin esto, una recarga a mitad de un
    // guardado repintaría el punto con el valor viejo del servidor.
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    cola.marcar(p(2, false))
    await tic()
    expect([...cola.locales()]).toEqual([[0, true], [2, false]])
    llamadas[0].ok()
    await tic()
    expect([...cola.locales()]).toEqual([[2, false]])
  })
})

describe('NEGATIVO · un fallo no pierde el cambio', () => {
  it('si falla, queda en «error» con el mensaje y el cambio sigue pendiente', async () => {
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    await tic()
    llamadas[0].falla('Sin conexión')
    await tic()
    expect(cola.estado()).toBe('error')
    expect(cola.error()).toBe('Sin conexión')
    expect(cola.pendientes()).toBe(1)
    expect([...cola.locales()]).toEqual([[0, true]])
  })

  it('tras un fallo NO sigue enviando lo de detrás por su cuenta', async () => {
    // Si siguiera, el orden se rompería: lo de detrás llegaría antes que lo que
    // falló, que es justo lo que la cola existe para impedir.
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    cola.marcar(p(1, true))
    await tic()
    llamadas[0].falla('500')
    await tic()
    expect(llamadas).toHaveLength(1)
    expect(cola.pendientes()).toBe(2)
  })

  it('`reintentar()` reenvía lo que falló, en su orden original', async () => {
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    cola.marcar(p(1, true))
    await tic()
    llamadas[0].falla('500')
    await tic()
    cola.reintentar()
    expect(cola.estado()).toBe('guardando')
    expect(cola.error()).toBeNull()
    await tic()
    expect(llamadas[1].cambio).toEqual(p(0, true))
    llamadas[1].ok()
    await tic()
    expect(llamadas[2].cambio).toEqual(p(1, true))
    llamadas[2].ok()
    await tic()
    expect(cola.estado()).toBe('guardado')
    expect(cola.pendientes()).toBe(0)
  })

  it('un clic nuevo tras el fallo es también un reintento', async () => {
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    await tic()
    llamadas[0].falla('500')
    await tic()
    cola.marcar(p(1, true))
    await tic()
    expect(llamadas.map((l) => l.cambio)).toEqual([p(0, true), p(0, true)])
  })

  it('si durante el fallo el usuario cambió ESE punto, se manda el valor nuevo y no el viejo', async () => {
    const { cola, llamadas } = crear()
    cola.marcar(p(0, true))
    await tic()
    cola.marcar(p(0, false)) // llega mientras la primera está en vuelo
    llamadas[0].falla('500')
    await tic()
    expect([...cola.locales()]).toEqual([[0, false]])
    cola.reintentar()
    await tic()
    expect(llamadas[1].cambio).toEqual(p(0, false))
    llamadas[1].ok()
    await tic()
    // El valor viejo (`true`) NO se reenvía detrás: se habría quedado marcado.
    expect(llamadas).toHaveLength(2)
    expect(cola.estado()).toBe('guardado')
  })

  it('`reintentar()` sin nada pendiente no hace nada', async () => {
    const { cola, llamadas } = crear()
    cola.reintentar()
    await tic()
    expect(llamadas).toHaveLength(0)
    expect(cola.estado()).toBe('inactivo')
  })
})
