import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { tokenDeCookies, decideAcceso, verificarAcceso } from './acceso.mjs'

// ============================================================================
//  El guardián del panel de flota (ADR 0026).
//
//  El panel NO valida sesiones: le pregunta al PADRE. Eso es lo que le permite
//  no tener credenciales de base, ni usuarios, ni sesiones propias -- y que un
//  `logout` en el PADRE lo apague también.
//
//  Estas pruebas son el corazón de la cosa, y casi todas son NEGATIVAS: lo que
//  hay que demostrar de un guardián es lo que IMPIDE. Lo que enseña la pantalla
//  es la lista de clientes con sus dominios, que es exactamente lo que el modelo
//  de instancias soberanas protege.
// ============================================================================

const CONSTA = { usuario: { email: 'a@b.co' }, permisos: { administracion: ['ver', 'crear'] } }

/** Un PADRE de mentira: responde lo que se le diga y apunta lo que le llegó. */
function padreFalso(respuesta: { status: number; datos?: unknown } | Error) {
  const llamadas: Array<{ url: string; opciones: any }> = []
  const fetchFalso = async (url: string, opciones: any) => {
    llamadas.push({ url, opciones })
    if (respuesta instanceof Error) throw respuesta
    return {
      status: respuesta.status,
      ok: respuesta.status < 400,
      json: async () => respuesta.datos ?? {},
    }
  }
  return { fetchFalso, llamadas }
}

describe('la cookie de sesión se saca de la cabecera, y solo esa', () => {
  it('sin cabecera no hay token', () => {
    expect(tokenDeCookies(undefined)).toBeNull()
    expect(tokenDeCookies('')).toBeNull()
  })

  it('la encuentra entre otras', () => {
    expect(tokenDeCookies('otra=1; spaces_sesion=abc123; tercera=x')).toBe('abc123')
  })

  it('aguanta espacios y el orden', () => {
    expect(tokenDeCookies('spaces_sesion=abc123')).toBe('abc123')
    expect(tokenDeCookies('  spaces_sesion=abc123  ; z=1')).toBe('abc123')
  })

  it('NO se traga una cookie cuyo nombre solo TERMINA igual', () => {
    // `x_spaces_sesion=robada` no es la cookie de sesión. Un prefijo mal
    // comparado aquí sería una forma de colar un token cualquiera.
    expect(tokenDeCookies('x_spaces_sesion=robada')).toBeNull()
    expect(tokenDeCookies('no_spaces_sesion=robada; spaces_sesion=buena')).toBe('buena')
  })
})

describe('quién entra: lo decide el PADRE, no el panel', () => {
  it('sin token, ni se pregunta', async () => {
    const { fetchFalso, llamadas } = padreFalso({ status: 200, datos: CONSTA })
    const r = await verificarAcceso(undefined, { fetch: fetchFalso, urlPadre: 'http://127.0.0.1:3000' })
    expect(r.permitido).toBe(false)
    expect(llamadas, 'no hay que molestar al PADRE sin cookie').toHaveLength(0)
  })

  it('si el PADRE dice 401, el panel dice que no', async () => {
    const { fetchFalso } = padreFalso({ status: 401, datos: { error: 'Sin sesión' } })
    const r = await verificarAcceso('spaces_sesion=loquesea', { fetch: fetchFalso, urlPadre: 'http://127.0.0.1:3000' })
    expect(r.permitido).toBe(false)
  })

  it('con sesión válida pero SIN administracion, tampoco', () => {
    // Un comercial del PADRE tiene sesión perfectamente válida. La lista de
    // clientes no es para él.
    expect(decideAcceso(200, { usuario: {}, permisos: { inventario: ['ver'] } }).permitido).toBe(false)
  })

  it('con administracion pero sin `ver`, tampoco', () => {
    expect(decideAcceso(200, { usuario: {}, permisos: { administracion: [] } }).permitido).toBe(false)
    expect(decideAcceso(200, { usuario: {}, permisos: { administracion: ['crear'] } }).permitido).toBe(false)
  })

  it('con administracion:ver, entra', () => {
    expect(decideAcceso(200, CONSTA).permitido).toBe(true)
  })

  it('si el PADRE no contesta, NO entra nadie', async () => {
    // Fail-closed y a propósito: el panel depende de que el 3000 este vivo, y
    // eso esta aceptado en el ADR 0026. Lo que NO puede pasar es que una caida
    // del PADRE abra la puerta.
    const { fetchFalso } = padreFalso(new Error('ECONNREFUSED'))
    const r = await verificarAcceso('spaces_sesion=abc', { fetch: fetchFalso, urlPadre: 'http://127.0.0.1:3000' })
    expect(r.permitido).toBe(false)
    expect(r.motivo).toMatch(/padre/i)
  })

  it('un cuerpo raro del PADRE no abre la puerta', async () => {
    // 200 con basura dentro: si `permisos` no es lo que se espera, se deniega.
    for (const datos of [null, {}, { permisos: null }, { permisos: 'administracion' }, { permisos: { administracion: 'ver' } }]) {
      expect(decideAcceso(200, datos).permitido, JSON.stringify(datos)).toBe(false)
    }
  })
})

describe('lo que se le manda al PADRE, y nada mas', () => {
  it('reenvia SOLO la cookie de sesion, reconstruida', async () => {
    // No se pasa la cabecera del navegador tal cual: se reconstruye con el
    // unico valor que hace falta. Asi ninguna otra cookie del visitante viaja
    // al PADRE por el camino de autenticacion.
    const { fetchFalso, llamadas } = padreFalso({ status: 200, datos: CONSTA })
    await verificarAcceso('sesion_de_otra_cosa=zzz; spaces_sesion=abc; rastreo=si', {
      fetch: fetchFalso,
      urlPadre: 'http://127.0.0.1:3000',
    })
    expect(llamadas).toHaveLength(1)
    const cookieEnviada = llamadas[0].opciones.headers.cookie
    expect(cookieEnviada).toBe('spaces_sesion=abc')
    expect(cookieEnviada).not.toMatch(/rastreo|sesion_de_otra_cosa/)
  })

  it('pregunta por loopback y a la ruta de la aplicacion', async () => {
    const { fetchFalso, llamadas } = padreFalso({ status: 200, datos: CONSTA })
    await verificarAcceso('spaces_sesion=abc', { fetch: fetchFalso, urlPadre: 'http://127.0.0.1:3000' })
    expect(llamadas[0].url).toBe('http://127.0.0.1:3000/spaces-dooh/api/auth/me/')
  })
})
