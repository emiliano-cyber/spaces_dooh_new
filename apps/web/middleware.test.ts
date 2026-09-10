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

  it('el gate de sesión redirige al login con una Location relativa', () => {
    const res = middleware(peticion('/spaces-dooh/inicio/'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('/spaces-dooh/login/')
  })

  it('conserva la query al rebotar al login', () => {
    const res = middleware(peticion('/spaces-dooh/inicio/?desde=correo'))

    expect(res.headers.get('location')).toBe('/spaces-dooh/login/?desde=correo')
  })

  it('la compatibilidad de /demo tampoco lleva el origen interno', () => {
    const res = middleware(peticion('/spaces-dooh/demo/'))
    const location = res.headers.get('location') ?? ''

    expect(res.status).toBe(308)
    expect(location).not.toContain('localhost')
    expect(location).toBe('/spaces-dooh/inicio/')
  })

  it('la compatibilidad de /demo conserva la subruta', () => {
    const res = middleware(peticion('/spaces-dooh/demo/sitios/'))

    expect(res.headers.get('location')).toBe('/spaces-dooh/sitios/')
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
