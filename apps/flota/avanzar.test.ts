import { describe, expect, it } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { avanzar, MAX_INTENTOS_CERT, VENTANA_CERT_MS } from './avanzar.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { ESPERANDO_DNS, EMITIENDO_CERT, LISTA, CERT_AGOTADO, FALLIDA } from './ejecutor.mjs'

// ============================================================================
//  La maquina de estados del alta.  (A2.2 y A2.3, ADR 0029)
// ----------------------------------------------------------------------------
//  Cada transicion es UNA pasada del temporizador, que despierta cada minuto.
//  Lo que se vigila aqui no es que avance: es que **NO avance cuando no debe**,
//  y que no gaste cuota de Let's Encrypt por reintentar a lo tonto.
//
//  Las dos reglas que sostienen el diseño:
//
//   · Si el DNS no resuelve, NO SE TOCA NADA. Ni una escritura, ni una linea de
//     registro. El coste de esperar tiene que ser cero, porque una solicitud
//     puede esperar DIAS a que el owner apunte su zona.
//   · La cuota vive EN EL ESTADO. Un limite que se pierde al reiniciar no es un
//     limite: es una intencion.
// ============================================================================

const DOM = 'prueba.ejemplo.com'
const IP = '203.0.113.10'

/** Registra lo que la maquina intenta hacer, sin hacer nada. */
function espia() {
  const marcados: Array<{ estado: string; extra: any }> = []
  const anotados: string[] = []
  const certs: string[] = []
  return {
    marcados,
    anotados,
    certs,
    marcar: async (estado: string, extra: any = {}) => {
      marcados.push({ estado, extra })
    },
    anotar: async (linea: string) => {
      anotados.push(linea)
    },
    certOk: async (d: string) => {
      certs.push(d)
      return true
    },
    certFalla: async (d: string) => {
      certs.push(d)
      return false
    },
  }
}

const enEsperaDns = (extra: any = {}) => ({ id: 'x', estado: ESPERANDO_DNS, dominio: DOM, ip: IP, ...extra })
const enCert = (extra: any = {}) => ({ id: 'x', estado: EMITIENDO_CERT, dominio: DOM, ip: IP, ...extra })

describe('esperando el DNS', () => {
  it('si NO resuelve, no se toca absolutamente nada', async () => {
    // El caso mas frecuente con diferencia: el owner todavia no lo ha apuntado.
    // Si esto escribiera algo, escribiria una vez por minuto durante dias.
    const e = espia()
    const r = await avanzar(enEsperaDns(), { ...e, resolver: async () => [] })
    expect(r.hecho).toBe(false)
    expect(e.marcados).toEqual([])
    expect(e.anotados).toEqual([])
  })

  it('si el resolutor REVIENTA, tampoco: un DNS caido no es un alta fallida', async () => {
    const e = espia()
    const r = await avanzar(enEsperaDns(), {
      ...e,
      resolver: async () => {
        throw new Error('ENOTFOUND')
      },
    })
    expect(r.hecho).toBe(false)
    expect(e.marcados).toEqual([])
  })

  it('si resuelve a OTRA IP no avanza, y eso evita pedir un certificado de la maquina de otro', async () => {
    const e = espia()
    const r = await avanzar(enEsperaDns(), { ...e, resolver: async () => ['198.51.100.9'] })
    expect(r.hecho).toBe(false)
    // No pasa a emitir el certificado...
    expect(e.marcados.map((m) => m.estado)).not.toContain(EMITIENDO_CERT)
    // ...pero SI se anota, porque esto no se arregla solo: alguien apunto mal.
    expect(e.anotados.join(' ')).toContain('198.51.100.9')
  })

  it('y esa anotacion se hace UNA vez, no una por minuto', async () => {
    const e = espia()
    const opciones = { ...e, resolver: async () => ['198.51.100.9'] }
    await avanzar(enEsperaDns(), opciones)
    const yaAnotado = e.marcados.find((m) => m.extra?.dnsOtraIp)?.extra
    // La segunda pasada ya lleva la marca, y se calla.
    await avanzar(enEsperaDns(yaAnotado), opciones)
    expect(e.anotados).toHaveLength(1)
  })

  it('si resuelve a la IP correcta, pasa a emitir el certificado', async () => {
    const e = espia()
    const r = await avanzar(enEsperaDns(), { ...e, resolver: async () => [IP] })
    expect(r.hecho).toBe(true)
    expect(e.marcados[0].estado).toBe(EMITIENDO_CERT)
    expect(e.marcados[0].extra.intentos).toBe(0)
  })

  it('sin IP anotada no hace nada: no se inventa a donde apuntar', async () => {
    const e = espia()
    const r = await avanzar(enEsperaDns({ ip: null }), { ...e, resolver: async () => [IP] })
    expect(r.hecho).toBe(false)
    expect(e.marcados).toEqual([])
  })
})

describe('emitiendo el certificado, y la cuota', () => {
  it('si sale bien, queda lista', async () => {
    const e = espia()
    const r = await avanzar(enCert({ intentos: 0 }), { ...e, emitirCert: e.certOk })
    expect(r.hecho).toBe(true)
    expect(e.certs).toEqual([DOM])
    expect(e.marcados.map((m) => m.estado)).toContain(LISTA)
  })

  it('si falla, sigue emitiendo y el intento QUEDA CONTADO', async () => {
    const e = espia()
    const r = await avanzar(enCert({ intentos: 0 }), { ...e, emitirCert: e.certFalla })
    expect(r.hecho).toBe(false)
    const cont = e.marcados.find((m) => m.extra?.intentos === 1)
    expect(cont).toBeTruthy()
    expect(cont!.estado).toBe(EMITIENDO_CERT)
  })

  it('el intento se cuenta ANTES de llamar, para que un cuelgue no salga gratis', async () => {
    // Misma disciplina que marcar `en-curso` antes de lanzar el alta: si el
    // proceso muere a mitad, el intento ya esta contado y no se repite infinito.
    const e = espia()
    await avanzar(enCert({ intentos: 0 }), {
      ...e,
      emitirCert: async () => {
        // Cuando certbot se llama, el contador ya tiene que estar subido.
        expect(e.marcados.some((m) => m.extra?.intentos === 1)).toBe(true)
        return true
      },
    })
  })

  it('al pasarse de la cuota NO se llama a certbot, y pasa a cert-agotado', async () => {
    // Es el caso que evita quemar la hora entera: Let's Encrypt da cinco por
    // hora y por dominio, y aqui se para en tres.
    const e = espia()
    const ahora = Date.now()
    const r = await avanzar(enCert({ intentos: MAX_INTENTOS_CERT, intentosDesde: ahora }), {
      ...e,
      emitirCert: e.certOk,
      ahora: () => ahora,
    })
    expect(r.hecho).toBe(false)
    expect(e.certs).toEqual([])
    expect(e.marcados.map((m) => m.estado)).toContain(CERT_AGOTADO)
  })

  it('pero pasada la hora el contador se reinicia y vuelve a intentarlo', async () => {
    const e = espia()
    const ahora = Date.now()
    const viejo = ahora - VENTANA_CERT_MS - 1000
    const r = await avanzar(enCert({ intentos: MAX_INTENTOS_CERT, intentosDesde: viejo }), {
      ...e,
      emitirCert: e.certOk,
      ahora: () => ahora,
    })
    expect(r.hecho).toBe(true)
    expect(e.certs).toEqual([DOM])
  })

  it('se para en TRES y no en cinco, que es el limite real: quedan dos para una persona', async () => {
    expect(MAX_INTENTOS_CERT).toBe(3)
    expect(MAX_INTENTOS_CERT).toBeLessThan(5)
  })
})

describe('lo que la maquina NO toca', () => {
  it('un estado que no es reanudable no hace nada', async () => {
    const e = espia()
    for (const estado of [FALLIDA, LISTA, CERT_AGOTADO, 'pendiente', 'en-curso']) {
      const r = await avanzar({ id: 'x', estado, dominio: DOM, ip: IP }, { ...e, resolver: async () => [IP], emitirCert: e.certOk })
      expect(r.hecho).toBe(false)
    }
    expect(e.marcados).toEqual([])
    expect(e.certs).toEqual([])
  })
})
