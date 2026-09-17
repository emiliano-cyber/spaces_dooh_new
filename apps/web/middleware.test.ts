import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

// ============================================================================
//  Las redirecciones del middleware no pueden llevar el origen del SERVIDOR.
//
//  ── El fallo que estas pruebas cierran (medido en produccion el 2026-09-09) ─
//  En la instancia `g500` una ruta interna sin sesion contestaba:
//
//    HTTP/2 307
//    location: https://localhost:3000/spaces-dooh/login/
//
//  y el navegador se iba a `localhost`. No era nginx: la misma peticion directa
//  al contenedor CON la cabecera `Host` correcta daba lo mismo, y `APP_URL`
//  estaba bien puesta. La redireccion de `next.config.mjs` (que no pasa por el
//  middleware) salia relativa y correcta.
//
//  ── El mecanismo ───────────────────────────────────────────────────────────
//  `request.nextUrl` NO toma su origen de la cabecera `Host`: lo toma de la
//  direccion donde escucha el propio servidor -- `HOSTNAME` y `PORT` de la
//  imagen (`Dockerfile:72-73`), que Next presenta como `localhost:3000`. Asi que
//  `NextResponse.redirect(request.nextUrl.clone())` manda al cliente a la
//  direccion INTERNA del contenedor.
//
//  ── Por que la respuesta es una `Location` RELATIVA ────────────────────────
//  Se descartaron las dos alternativas evidentes:
//    · leer la cabecera `Host` -- la controla quien hace la peticion, y eso
//      convierte el gate de sesion en un open redirect;
//    · usar `process.env.APP_URL` -- el middleware corre en el runtime edge,
//      donde `process.env` puede quedar horneado en el BUILD. Seria el mismo
//      error que `HSTS` y `NEXT_PUBLIC_AUTOREGISTRO`: un valor por instancia
//      congelado en el artefacto de toda la flota.
//  Una `Location` relativa la resuelve el navegador contra la URL que ya tiene,
//  asi que sale correcta en cualquier dominio sin que la app sepa cual es. El
//  RFC 7231 §7.1.2 las permite, y es lo que ya hace `next.config.mjs`.
//
//  ── 2026-09-17 · LA RELATIVA TAMPOCO VALIA, Y ESTAS PRUEBAS NO LO VIERON ────
//  El parrafo de arriba es correcto sobre HTTP y equivocado sobre Next. Medido
//  en g500 y en DEMO el 17/09, con `v0.5.0` ya sirviendo:
//
//    HTTP/2 500
//    TypeError: Invalid URL ... code: 'ERR_INVALID_URL',
//                               input: '/spaces-dooh/login/'
//
//  El mecanismo, verificado en el propio Next y no deducido
//  (`node_modules/next/dist/server/web/adapter.js:242-248`): el adaptador de
//  middleware SIEMPRE parsea la cabecera `Location` que devuelve el middleware
//  --`new NextURL(redirect, ...)`, que pasa por `new URL()` SIN base--. Una ruta
//  relativa no es una URL absoluta, asi que revienta antes de llegar al
//  navegador. En Next 14.2.29 un middleware NO PUEDE devolver `Location`
//  relativa: no es una preferencia de estilo, es que no existe ese camino.
//
//  ── POR QUE ESTE ARCHIVO DIO VERDE CON EL FALLO DENTRO ─────────────────────
//  Porque llama a `middleware()` A PELO. El `new URL()` que revienta NO esta en
//  el middleware: esta en el adaptador que Next pone por encima, y una prueba
//  unitaria no lo atraviesa. De ahi la regla que ordena el bloque de abajo:
//  **toda prueba de una redireccion comprueba que su `Location` SOBREVIVE a
//  `new URL()`**, que es exactamente lo que hace el adaptador. Sin eso, este
//  archivo puede volver a dar verde sobre una aplicacion que devuelve 500.
//
//  ── Y POR QUE VUELVE LA CABECERA `Host`, QUE ARRIBA SE DESCARTA ────────────
//  Decidido por Emiliano el 17/09 (ADR 0033) tras quedarse sin alternativas:
//  `process.env` sigue sin servir por lo que dice el parrafo de arriba, y la
//  relativa resulta imposible. El riesgo de open redirect que motivo aquel
//  descarte es real y se acota en dos capas: nginx ya filtra por `server_name`,
//  y `origenPublico()` solo admite un `Host` con forma de nombre de maquina.
//  El destino, ademas, es SIEMPRE una ruta interna fija (`/login/`): lo unico
//  que el `Host` decide es el origen, nunca a donde se va.
// ============================================================================

/** Petición como la que llega en producción: URL interna, `Host` público. */
function peticion(ruta: string, cookies?: Record<string, string>) {
  const req = new NextRequest(`http://localhost:3000${ruta}`, {
    headers: {
      host: 'g500.space-os.io',
      'x-forwarded-proto': 'https',
      ...(cookies
        ? {
            cookie: Object.entries(cookies)
              .map(([k, v]) => `${k}=${v}`)
              .join('; '),
          }
        : {}),
    },
  })
  return req
}

describe('middleware · el origen de las redirecciones', () => {
  it('el gate de sesión NO manda al cliente al origen interno del servidor', () => {
    const res = middleware(peticion('/spaces-dooh/inicio/'))
    const location = res.headers.get('location') ?? ''

    expect(location).not.toContain('localhost')
    expect(location).not.toContain(':3000')
  })

  it('el gate de sesión redirige al login del host público', () => {
    const res = middleware(peticion('/spaces-dooh/inicio/'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://g500.space-os.io/spaces-dooh/login/')
  })

  it('conserva la query al rebotar al login', () => {
    const res = middleware(peticion('/spaces-dooh/inicio/?desde=correo'))

    expect(res.headers.get('location')).toBe(
      'https://g500.space-os.io/spaces-dooh/login/?desde=correo',
    )
  })

  it('la compatibilidad de /demo tampoco lleva el origen interno', () => {
    const res = middleware(peticion('/spaces-dooh/demo/'))
    const location = res.headers.get('location') ?? ''

    expect(res.status).toBe(308)
    expect(location).not.toContain('localhost')
    expect(location).toBe('https://g500.space-os.io/spaces-dooh/inicio/')
  })

  it('la compatibilidad de /demo conserva la subruta', () => {
    const res = middleware(peticion('/spaces-dooh/demo/sitios/'))

    expect(res.headers.get('location')).toBe('https://g500.space-os.io/spaces-dooh/sitios/')
  })

  it('con sesión no redirige: deja pasar', () => {
    const res = middleware(peticion('/spaces-dooh/inicio/', { spaces_sesion: 'x' }))

    expect(res.headers.get('location')).toBeNull()
  })

  it('el login es público y no rebota sobre sí mismo', () => {
    const res = middleware(peticion('/spaces-dooh/login/'))

    expect(res.headers.get('location')).toBeNull()
  })
})

// ============================================================================
//  EL 500 DEL 2026-09-17, REPRODUCIDO
//
//  Estas son las pruebas que faltaban. No comprueban el texto de la cabecera:
//  comprueban que SOBREVIVE a lo que Next le hace despues
//  (`adapter.js:242-248`, `new NextURL(redirect)` -> `new URL()` sin base).
//
//  `new URL(location)` es esa misma operacion. Si tira, la aplicacion devuelve
//  500 en produccion: no es una comprobacion de estilo, es EL fallo.
// ============================================================================

/** Lo que hace el adaptador de Next con la `Location` del middleware. */
function comoLaParseaNext(location: string) {
  return new URL(location)
}

describe('middleware · la Location sobrevive al adaptador de Next', () => {
  const RUTAS_QUE_REDIRIGEN = [
    ['el gate de sesión', '/spaces-dooh/inicio/'],
    ['el gate con query', '/spaces-dooh/inicio/?desde=correo'],
    ['la compatibilidad de /demo', '/spaces-dooh/demo/'],
    ['la compatibilidad de /demo con subruta', '/spaces-dooh/demo/sitios/'],
  ] as const

  it.each(RUTAS_QUE_REDIRIGEN)('%s emite una Location que es URL absoluta', (_, ruta) => {
    const res = middleware(peticion(ruta))
    const location = res.headers.get('location') ?? ''

    expect(location).not.toBe('')
    // Esto es lo que reventaba con ERR_INVALID_URL e input '/spaces-dooh/login/'.
    expect(() => comoLaParseaNext(location)).not.toThrow()
  })

  it.each(RUTAS_QUE_REDIRIGEN)('%s apunta al host público, no al interno', (_, ruta) => {
    const url = comoLaParseaNext(middleware(peticion(ruta)).headers.get('location') ?? '')

    expect(url.host).toBe('g500.space-os.io')
    expect(url.protocol).toBe('https:')
  })

  it('respeta el esquema que anuncia el proxy', () => {
    const req = new NextRequest('http://localhost:3000/spaces-dooh/inicio/', {
      headers: { host: 'interno.local:8080', 'x-forwarded-proto': 'http' },
    })
    const url = comoLaParseaNext(middleware(req).headers.get('location') ?? '')

    expect(url.protocol).toBe('http:')
    expect(url.host).toBe('interno.local:8080')
  })

  // ── El lado que importa de la decisión: el `Host` NO decide el destino ────
  //
  // Se admite como ORIGEN un nombre de máquina con forma de tal, y nada más. Un
  // `Host` con basura no puede sacar al usuario del sitio ni colar otro origen:
  // en el peor caso se cae al origen interno, que rompe la redirección pero NO
  // manda a nadie a donde el atacante quiera.
  const HOSTS_QUE_NO_SON_NOMBRES = [
    'evil.com/@robado.com',
    'evil.com\\@robado.com',
    'usuario:clave@evil.com',
    'evil.com?x=1',
    'evil.com#x',
    '',
  ]

  it.each(HOSTS_QUE_NO_SON_NOMBRES)('un Host que no es un nombre (%j) no cuela otro origen', (host) => {
    const req = new NextRequest('http://localhost:3000/spaces-dooh/inicio/', {
      headers: { host, 'x-forwarded-proto': 'https' },
    })
    const location = middleware(req).headers.get('location') ?? ''

    // Siga el camino que siga, jamás acaba en el dominio del atacante...
    expect(location).not.toContain('evil.com')
    expect(location).not.toContain('robado.com')
    // ...y jamás deja de ser una URL que Next pueda parsear.
    expect(() => comoLaParseaNext(location)).not.toThrow()
  })

  it('la ruta de destino no la decide nunca el Host', () => {
    const req = new NextRequest('http://localhost:3000/spaces-dooh/inicio/', {
      headers: { host: 'otra-instancia.space-os.io', 'x-forwarded-proto': 'https' },
    })
    const url = comoLaParseaNext(middleware(req).headers.get('location') ?? '')

    expect(url.pathname).toBe('/spaces-dooh/login/')
  })
})
