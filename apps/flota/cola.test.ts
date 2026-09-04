import { mkdtemp, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { crearSolicitud, listar, siguientePendiente, marcar } from './cola.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { PENDIENTE, EN_CURSO, TERMINADA, FALLIDA } from './ejecutor.mjs'

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
