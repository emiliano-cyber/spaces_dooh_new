import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { crearSolicitud, listar, marcar, anotarEn } from './cola.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { avanzar } from './avanzar.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { ESPERANDO_DNS, EMITIENDO_CERT, CERT_AGOTADO, LISTA } from './ejecutor.mjs'

// ============================================================================
//  La COSTURA entre `marcar()` y `avanzar()`.  (ADR 0029)
// ----------------------------------------------------------------------------
//  `avanzar.test.ts` ya prueba la máquina de estados, y `cola.test.ts` ya prueba
//  la escritura en disco. Las dos pasaban en verde el 2026-09-08 mientras la
//  máquina estaba MUERTA en producción, y por eso existe este archivo.
//
//  El motivo es que `avanzar.test.ts:35` sustituye `marcar` por un grabador:
//
//      marcar: async (estado, extra) => { marcados.push({ estado, extra }) }
//
//  Ese doble apunta la llamada en un arreglo y **nunca escribe en una solicitud
//  que la llamada siguiente vuelva a leer**. Así que afirma que `avanzar` PIDE
//  guardar `ip` e `intentos`, y no puede decir nada sobre si el que guarda los
//  deja donde el que lee los busca. No los dejaba: `marcar()` los metía solo en
//  la entrada del historial, y `avanzar` los lee de la RAÍZ de la solicitud.
//
//  Resultado medido en el PADRE: `ensayo4` llevaba 22 horas contestando
//  «sin ip anotada: no se inventa a donde apuntar» **con la ip anotada**, y el
//  contador de intentos de certificado no contaba — o sea que el tope de tres
//  por hora no existía, justo el que evita quemar la cuota de Let's Encrypt.
//
//  Estas pruebas usan el `marcar` DE VERDAD, contra un directorio temporal, y
//  releen la solicitud del disco entre paso y paso. Es lo único que ve la
//  costura: un doble, por definición, no la ve.
// ============================================================================

const buena = { instancia: 'ensayo9', dominio: 'ensayo9.space-os.io', email: 'jefe@ejemplo.mx' }
const IP = '203.0.113.10' // TEST-NET-3 (RFC 5737): no existe ni puede existir.

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'costura-'))
})

/** La solicitud como la lee el ejecutor: recién traída del disco. */
async function delDisco(id: string) {
  const todas = await listar(dir)
  return todas.find((s: { id: string }) => s.id === id)
}

/** Las dependencias de `avanzar`, cableadas al `marcar` y `anotarEn` reales. */
function reales(id: string, extra: Record<string, unknown> = {}) {
  return {
    marcar: (estado: string, e?: Record<string, unknown>) => marcar(dir, id, estado, e),
    anotar: (linea: string) => anotarEn(dir, id, linea),
    ...extra,
  }
}

describe('marcar() deja los datos donde avanzar() los busca', () => {
  it('la ip sobrevive a la escritura y llega a la RAIZ, no solo al historial', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, ESPERANDO_DNS, { ip: IP })

    const s = await delDisco(id)
    // El historial la tenía desde el principio; la raíz es lo que faltaba.
    expect(s.historial.at(-1)).toMatchObject({ estado: ESPERANDO_DNS, ip: IP })
    expect(s.ip).toBe(IP)
  })

  it('con el DNS apuntando bien, esperando-dns AVANZA a emitiendo-cert', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, ESPERANDO_DNS, { ip: IP })

    const r = await avanzar(await delDisco(id), {
      ...reales(id),
      resolver: async () => [IP],
      emitirCert: async () => true,
    })

    // Antes de arreglar `marcar()` esto contestaba
    // `sin ip anotada: no se inventa a donde apuntar`, cada minuto, para siempre.
    expect(r.motivo).toBeUndefined()
    expect(r.hecho).toBe(true)
    expect((await delDisco(id)).estado).toBe(EMITIENDO_CERT)
  })

  it('el contador de intentos de certificado CUENTA de una pasada a la siguiente', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, EMITIENDO_CERT, { ip: IP, intentos: 0 })

    // Tres pasadas con el certificado fallando.
    for (let i = 0; i < 3; i++) {
      await avanzar(await delDisco(id), { ...reales(id), emitirCert: async () => false })
    }

    // Si el contador no persiste, esto sigue en 0 y el tope no existe.
    expect((await delDisco(id)).intentos).toBe(3)
  })

  it('al cuarto intento se para en cert-agotado y NO se pide otro certificado', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, EMITIENDO_CERT, { ip: IP, intentos: 0 })

    const pedidos: string[] = []
    const emitirCert = async (d: string) => {
      pedidos.push(d)
      return false
    }
    for (let i = 0; i < 4; i++) {
      await avanzar(await delDisco(id), { ...reales(id), emitirCert })
    }

    // TRES peticiones, no cuatro: Let's Encrypt permite cinco por hora y por
    // dominio, y sin este tope el temporizador las gasta en cinco minutos.
    expect(pedidos).toHaveLength(3)
    expect((await delDisco(id)).estado).toBe(CERT_AGOTADO)
  })

  it('un DNS que apunta a otra maquina se anota UNA vez, no una por minuto', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, ESPERANDO_DNS, { ip: IP })

    const otra = '203.0.113.99'
    for (let i = 0; i < 3; i++) {
      await avanzar(await delDisco(id), { ...reales(id), resolver: async () => [otra] })
    }

    const s = await delDisco(id)
    expect(s.dnsOtraIp).toBe(otra)
    // Sin persistir `dnsOtraIp` se anotaba en cada pasada: el ruido que el
    // propio comentario de `avanzar.mjs` dice estar evitando.
    expect(s.registro.filter((l: string) => l.includes(otra))).toHaveLength(1)
    expect(s.estado).toBe(ESPERANDO_DNS)
  })

  it('el recorrido entero: esperando-dns -> emitiendo-cert -> lista', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, ESPERANDO_DNS, { ip: IP })

    const deps = { ...reales(id), resolver: async () => [IP], emitirCert: async () => true }
    await avanzar(await delDisco(id), deps)
    expect((await delDisco(id)).estado).toBe(EMITIENDO_CERT)
    await avanzar(await delDisco(id), deps)
    expect((await delDisco(id)).estado).toBe(LISTA)
  })

  it('`extra` NO puede pisar el estado ni el historial', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    // Un `extra` malicioso o descuidado no debe reescribir lo que manda.
    await marcar(dir, id, ESPERANDO_DNS, { estado: LISTA, historial: [], ip: IP })

    const s = await delDisco(id)
    expect(s.estado).toBe(ESPERANDO_DNS)
    expect(s.historial.length).toBeGreaterThan(0)
    expect(s.ip).toBe(IP)
  })

  it('no inventa a donde apuntar cuando de verdad no hay ip', async () => {
    const id = await crearSolicitud(dir, buena, 'jefa@asnetwork.io')
    await marcar(dir, id, ESPERANDO_DNS, { ip: null })

    const r = await avanzar(await delDisco(id), { ...reales(id), resolver: async () => [IP] })

    // El mensaje se queda: sin ip, pedir un certificado sería pedirlo a ciegas.
    expect(r.hecho).toBe(false)
    expect(r.motivo).toMatch(/sin ip anotada/)
  })
})
