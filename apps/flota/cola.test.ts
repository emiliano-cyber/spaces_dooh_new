import { mkdtemp, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { crearSolicitud, listar, siguientePendiente, siguienteQueAvanza, marcar, anotarEn } from './cola.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { PENDIENTE, EN_CURSO, TERMINADA, FALLIDA, ESPERANDO_DNS, EMITIENDO_CERT, CERT_AGOTADO, LISTA } from './ejecutor.mjs'

// ============================================================================
//  La cola de solicitudes de alta, en disco.  (ADR 0027)
//
//  Es lo único que comparten el panel (que escribe) y el ejecutor (que lee). Sin
//  base de datos a propósito: son unas pocas altas al mes, y una base seria una
//  dependencia y una credencial más en el proceso expuesto.
// ============================================================================

const buena = { instancia: 'pixeled', dominio: 'space-os.pixeled.mx', email: 'jefe@pixeled.mx' }

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cola-'))
})

describe('crear una solicitud', () => {
  it('guarda quién la pidió y cuándo, que hoy no consta en ningún sitio', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    const [s] = await listar(dir)
    expect(s.id).toBe(id)
    expect(s.estado).toBe(PENDIENTE)
    expect(s.pedidaPor).toBe('jefa@asnetwork.io')
    expect(s.cuando).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('una invalida no llega a escribirse', async () => {
    await expect(crearSolicitud(dir, { ...buena, dominio: 'a.mx; id' }, 'x@y.co')).rejects.toThrow()
    expect(await readdir(dir)).toHaveLength(0)
  })

  it('el id lo pone el servidor, NO quien la pide', async () => {
    // Si el id viniera de fuera, dos cosas: se podria pisar una solicitud ya
    // aprobada, y se podria salir del directorio con `../`. Se ignora.
    const id = await crearSolicitud(dir, { ...buena, id: '../../fuera' }, 'x@y.co')
    expect(id).not.toContain('..')
    expect(id).not.toContain('/')
    const archivos = await readdir(dir)
    expect(archivos).toHaveLength(1)
    expect(archivos[0]).toContain(id)
  })

  it('el estado tampoco se acepta de fuera', async () => {
    // Colar `estado: terminada` seria una forma de meter basura en el historial;
    // colar `en-curso` seria bloquear la cola entera.
    await crearSolicitud(dir, { ...buena, estado: TERMINADA }, 'x@y.co')
    const [s] = await listar(dir)
    expect(s.estado).toBe(PENDIENTE)
  })
})

describe('UNA a la vez, y la más antigua primero', () => {
  it('devuelve la más antigua de las pendientes', async () => {
    const a = await crearSolicitud(dir, { ...buena, instancia: 'uno' }, 'x@y.co')
    await new Promise((r) => setTimeout(r, 5))
    await crearSolicitud(dir, { ...buena, instancia: 'dos' }, 'x@y.co')
    expect((await siguientePendiente(dir))?.id).toBe(a)
  })

  it('si hay una EN CURSO, no devuelve ninguna', async () => {
    // Esta es la regla que impide que dos pasadas del temporizador aprovisionen
    // a la vez. Dos altas en paralelo compiten por el mismo `doctl`, la misma
    // clave y el mismo nombre de droplet.
    const a = await crearSolicitud(dir, { ...buena, instancia: 'uno' }, 'x@y.co')
    await crearSolicitud(dir, { ...buena, instancia: 'dos' }, 'x@y.co')
    await marcar(dir, a, EN_CURSO)
    expect(await siguientePendiente(dir)).toBeNull()
  })

  it('cuando la de en curso acaba, sigue la siguiente', async () => {
    const a = await crearSolicitud(dir, { ...buena, instancia: 'uno' }, 'x@y.co')
    await new Promise((r) => setTimeout(r, 5))
    const b = await crearSolicitud(dir, { ...buena, instancia: 'dos' }, 'x@y.co')
    await marcar(dir, a, EN_CURSO)
    await marcar(dir, a, TERMINADA)
    expect((await siguientePendiente(dir))?.id).toBe(b)
  })

  it('una FALLIDA no bloquea la cola, pero tampoco se reintenta', async () => {
    const a = await crearSolicitud(dir, { ...buena, instancia: 'uno' }, 'x@y.co')
    await new Promise((r) => setTimeout(r, 5))
    const b = await crearSolicitud(dir, { ...buena, instancia: 'dos' }, 'x@y.co')
    await marcar(dir, a, FALLIDA)
    const sig = await siguientePendiente(dir)
    expect(sig?.id).toBe(b)
    expect(sig?.id).not.toBe(a)
  })
})

describe('la cola aguanta lo que le echen', () => {
  it('un archivo ilegible no la tumba', async () => {
    // Un JSON a medio escribir no puede dejar el alta sin funcionar: se salta.
    await crearSolicitud(dir, buena, 'x@y.co')
    await writeFile(join(dir, 'roto.json'), '{ esto no es json', 'utf8')
    const todas = await listar(dir)
    expect(todas).toHaveLength(1)
    expect(await siguientePendiente(dir)).not.toBeNull()
  })

  it('un directorio que no existe es una cola vacia, no un error', async () => {
    expect(await listar(join(dir, 'no-existe'))).toEqual([])
    expect(await siguientePendiente(join(dir, 'no-existe'))).toBeNull()
  })

  it('marcar con un id raro no escribe fuera del directorio', async () => {
    await expect(marcar(dir, '../fuera', EN_CURSO)).rejects.toThrow()
    await expect(marcar(dir, 'a/b', EN_CURSO)).rejects.toThrow()
  })
})

// ============================================================================
//  Escrituras concurrentes sobre la MISMA solicitud.
//
//  Es lo que pasó en el PADRE el 2026-09-07: el ejecutor llama a `anotar()` sin
//  esperarlo (`ejecutor.mjs:64`, `:88` y el `onLinea` de `:78`), así que varias
//  lecturas-modificación-escritura quedan en vuelo a la vez. Con el temporal
//  derivado solo del id, una renombra primero y la otra muere con ENOENT — y
//  con ella se perdió la línea que decía por qué había fallado el alta.
//
//  Estos casos son negativos: comprueban que NO se pierde nada y que NO revienta.
// ============================================================================
describe('dos escrituras a la vez sobre la misma solicitud', () => {
  it('dos lineas de registro simultaneas no revientan y se conservan las DOS', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await Promise.all([anotarEn(dir, id, 'primera'), anotarEn(dir, id, 'segunda')])
    const [s] = await listar(dir)
    expect(s.registro).toContain('primera')
    expect(s.registro).toContain('segunda')
  })

  it('marcar el estado a la vez que se anota conserva el estado Y la linea', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await Promise.all([marcar(dir, id, FALLIDA, { codigo: 1 }), anotarEn(dir, id, 'el alta termino con codigo 1')])
    const [s] = await listar(dir)
    expect(s.estado).toBe(FALLIDA)
    expect(s.registro).toContain('el alta termino con codigo 1')
  })

  it('muchas lineas de golpe llegan todas, que es lo que hace un alta de verdad', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    const lineas = Array.from({ length: 25 }, (_, i) => `paso ${i}`)
    await Promise.all(lineas.map((l) => anotarEn(dir, id, l)))
    const [s] = await listar(dir)
    expect(s.registro).toHaveLength(25)
    for (const l of lineas) expect(s.registro).toContain(l)
  })

  it('no deja ningun .tmp tirado', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await Promise.all([anotarEn(dir, id, 'a'), anotarEn(dir, id, 'b'), marcar(dir, id, EN_CURSO)])
    expect((await readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })
})

// ============================================================================
//  Que solicitudes puede AVANZAR el ejecutor solo.  (A2.1, ADR 0029)
//
//  Hasta hoy `esperando-dns` era un estado TERMINAL: `siguientePendiente()`
//  devolvia solo las `pendiente`, asi que una solicitud que llegaba ahi no la
//  volvia a mirar nadie jamas. El temporizador ya despertaba cada minuto y el
//  estado ya existia: lo que faltaba era un caso.
//
//  La regla de UNA A LA VEZ no cambia, y es la mas importante: sigue siendo
//  `en-curso` lo que bloquea la cola, porque dos altas en paralelo compiten por
//  el mismo `doctl` y la misma clave.
// ============================================================================
describe('las solicitudes que el ejecutor puede avanzar solo', () => {
  it('retoma una que espera DNS, que hasta hoy no retomaba nadie', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await marcar(dir, id, ESPERANDO_DNS, { ip: '203.0.113.7' })
    expect((await siguienteQueAvanza(dir))?.id).toBe(id)
  })

  it('tambien una que esta emitiendo el certificado', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await marcar(dir, id, EMITIENDO_CERT, { intentos: 1 })
    expect((await siguienteQueAvanza(dir))?.id).toBe(id)
  })

  it('NO retoma una fallida: no se reintenta un alta a medias', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await marcar(dir, id, FALLIDA, { codigo: 1 })
    expect(await siguienteQueAvanza(dir)).toBeNull()
  })

  it('NO retoma una lista: ya termino', async () => {
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await marcar(dir, id, LISTA, {})
    expect(await siguienteQueAvanza(dir)).toBeNull()
  })

  it('NO retoma una con el certificado agotado: esa espera a una PERSONA', async () => {
    // Reintentar contra una cuota agotada la mantiene agotada. Es el unico
    // estado que existe para que alguien mire.
    const id = await crearSolicitud(dir, buena, 'x@y.co')
    await marcar(dir, id, CERT_AGOTADO, { intentos: 3 })
    expect(await siguienteQueAvanza(dir)).toBeNull()
  })

  it('NO retoma NINGUNA si hay una en curso: la regla de UNA A LA VEZ', async () => {
    const a = await crearSolicitud(dir, { ...buena, instancia: 'uno' }, 'x@y.co')
    await new Promise((r) => setTimeout(r, 5))
    const b = await crearSolicitud(dir, { ...buena, instancia: 'dos' }, 'x@y.co')
    await marcar(dir, a, EN_CURSO)
    await marcar(dir, b, ESPERANDO_DNS, { ip: '203.0.113.7' })
    expect(await siguienteQueAvanza(dir)).toBeNull()
  })

  it('la mas antigua primero, igual que las pendientes', async () => {
    const a = await crearSolicitud(dir, { ...buena, instancia: 'uno' }, 'x@y.co')
    await new Promise((r) => setTimeout(r, 5))
    const b = await crearSolicitud(dir, { ...buena, instancia: 'dos' }, 'x@y.co')
    await marcar(dir, a, ESPERANDO_DNS, { ip: '203.0.113.7' })
    await marcar(dir, b, ESPERANDO_DNS, { ip: '203.0.113.8' })
    expect((await siguienteQueAvanza(dir))?.id).toBe(a)
  })

  it('y una PENDIENTE no entra por aqui: esa es del otro camino', async () => {
    // Si las dos funciones devolvieran lo mismo, el ejecutor podria empezar un
    // alta creyendo que continua otra.
    await crearSolicitud(dir, buena, 'x@y.co')
    expect(await siguienteQueAvanza(dir)).toBeNull()
    expect(await siguientePendiente(dir)).not.toBeNull()
  })
})
