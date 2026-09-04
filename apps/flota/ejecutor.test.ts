import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { ejecutarAlta, PENDIENTE, EN_CURSO, TERMINADA, FALLIDA } from './ejecutor.mjs'

// ============================================================================
//  El ejecutor del alta.  (ADR 0027)
//
//  Es el unico proceso con los tokens de DigitalOcean y Cloudflare, y no escucha
//  en ningun puerto. Lee una solicitud escrita por el panel y aprovisiona una
//  maquina con ella.
//
//  Lo que estas pruebas defienden, por orden de lo que costaria caro:
//
//   1. Que un dato de la solicitud NO acabe siendo un comando.
//   2. Que un alta a medias NO se reintente sola: reintentar crea un SEGUNDO
//      droplet, y el primero se queda cobrandose sin que nadie lo sepa.
//   3. Que el registro que el panel enseña no lleve secretos dentro.
// ============================================================================

const buena = { instancia: 'pixeled', dominio: 'space-os.pixeled.mx', email: 'jefe@pixeled.mx' }
const ENTORNO = { DO_REGION: 'nyc1', DO_TAMANO: 's-1vcpu-1gb', DO_SSH_KEYS: 'aa:bb', REGISTRY: 'r', REGISTRY_TOKEN: 'SECRETISIMO' }

function deps(opciones: any = {}) {
  const lanzamientos: any[] = []
  const marcas: any[] = []
  const registro: string[] = []
  return {
    lanzamientos,
    marcas,
    registro,
    d: {
      entorno: ENTORNO,
      lanzar: async (orden: any) => {
        lanzamientos.push(orden)
        orden.onLinea?.('aprovisionando…')
        if (opciones.fallo) throw new Error(opciones.fallo)
        return { codigo: opciones.codigo ?? 0 }
      },
      marcar: async (id: string, estado: string, extra?: any) => {
        marcas.push({ id, estado, extra })
      },
      anotar: (linea: string) => registro.push(linea),
    },
  }
}

describe('una solicitud invalida no llega a ejecutarse', () => {
  it('no se lanza NADA si el dominio trae un comando dentro', async () => {
    const dd = deps()
    const r = await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena, dominio: 'a.mx; rm -rf /' }, dd.d)
    expect(r.ok).toBe(false)
    expect(dd.lanzamientos, 'no se puede lanzar nada con una solicitud invalida').toHaveLength(0)
    expect(dd.marcas.at(-1)).toMatchObject({ estado: FALLIDA })
  })

  it('y el motivo queda escrito, para que se pueda arreglar', async () => {
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena, email: 'no-es-correo' }, dd.d)
    expect(dd.registro.join('\n')).toMatch(/email/)
  })
})

describe('nunca por un shell', () => {
  it('los argumentos van como lista y sin shell', async () => {
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    const orden = dd.lanzamientos[0]
    expect(Array.isArray(orden.argumentos)).toBe(true)
    expect(orden.shell, 'jamas con shell').toBeFalsy()
    expect(orden.argumentos).toContain('space-os.pixeled.mx')
  })

  it('el canal no viaja: el guion usa `estable` por omision', async () => {
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena, canal: 'beta' }, dd.d)
    expect(JSON.stringify(dd.lanzamientos[0])).not.toContain('beta')
  })
})

describe('un alta a medias NO se reintenta sola', () => {
  it('se marca EN CURSO antes de lanzar, no despues', async () => {
    // Si se marcara despues y el proceso muriera a mitad, la pasada siguiente
    // la veria PENDIENTE y crearia un SEGUNDO droplet -- con el primero ya
    // creado y cobrandose. Marcar antes hace que un alta interrumpida se quede
    // parada esperando a una persona, que es lo correcto.
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    expect(dd.marcas[0]).toMatchObject({ id: 's1', estado: EN_CURSO })
    expect(dd.marcas.findIndex((m) => m.estado === EN_CURSO)).toBeLessThan(1)
  })

  it('una que ya esta EN CURSO se ignora', async () => {
    const dd = deps()
    const r = await ejecutarAlta({ id: 's1', estado: EN_CURSO, ...buena }, dd.d)
    expect(r.ok).toBe(false)
    expect(dd.lanzamientos).toHaveLength(0)
  })

  it('una que ya termino, tambien', async () => {
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: TERMINADA, ...buena }, dd.d)
    expect(dd.lanzamientos).toHaveLength(0)
  })

  it('si el guion sale con error, queda FALLIDA y no se relanza', async () => {
    const dd = deps({ codigo: 1 })
    const r = await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    expect(r.ok).toBe(false)
    expect(dd.marcas.at(-1)).toMatchObject({ estado: FALLIDA })
  })

  it('y si revienta al lanzar, igual: FALLIDA, no pendiente otra vez', async () => {
    const dd = deps({ fallo: 'ENOENT' })
    const r = await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    expect(r.ok).toBe(false)
    expect(dd.marcas.at(-1)).toMatchObject({ estado: FALLIDA })
    expect(dd.marcas.map((m: any) => m.estado)).not.toContain(PENDIENTE)
  })
})

describe('el registro lo va a leer el panel', () => {
  it('NO lleva secretos dentro', async () => {
    // El panel enseña este registro en una pagina web. El token del registro de
    // imagenes viaja en el entorno del alta, y no puede acabar ahi.
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    const todo = dd.registro.join('\n')
    expect(todo).not.toContain('SECRETISIMO')
    expect(todo).not.toMatch(/REGISTRY_TOKEN\s*=/)
  })

  it('pero si lleva lo que dijo el guion', async () => {
    const dd = deps()
    await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    expect(dd.registro.join('\n')).toContain('aprovisionando')
  })

  it('cuando sale bien, queda TERMINADA', async () => {
    const dd = deps()
    const r = await ejecutarAlta({ id: 's1', estado: PENDIENTE, ...buena }, dd.d)
    expect(r.ok).toBe(true)
    expect(dd.marcas.at(-1)).toMatchObject({ estado: TERMINADA })
  })
})
