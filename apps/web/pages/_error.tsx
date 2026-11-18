/**
 * Custom Pages Router error page — overrides Next.js default _error.
 * Must NOT use any context hooks (React context is unavailable during
 * static prerendering of /_error pages).
 */
import type { NextPageContext } from 'next'
import { traducir } from '@/lib/i18n/diccionario'
import {
  resolverIdioma,
  idiomasActivos,
  COOKIE_IDIOMA,
  IDIOMA_POR_OMISION,
  type Idioma,
} from '@/lib/i18n/idiomas'

// El idioma (lote de administracion, cuenta y shell, 2026-11-02). Sin contexto
// de React, se decide en `getInitialProps` con la MISMA regla que el layout
// raiz (`idiomas.ts`): cookie > Accept-Language > espanol, y espanol siempre
// con el ingles apagado. Sin peticion (prerender, o en el navegador) sale en
// espanol, que es lo que salia siempre.
function idiomaDeReq(req: NextPageContext['req']): Idioma {
  // Los idiomas ENCENDIDOS, como el layout (ola 0 del italiano, 2026-11-03).
  const permitidos = idiomasActivos()
  if (!req || permitidos.length === 1) return IDIOMA_POR_OMISION
  const cookie = String(req.headers?.cookie ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_IDIOMA}=`))
  const accept = req.headers?.['accept-language']
  return resolverIdioma({
    cookie: cookie ? cookie.slice(COOKIE_IDIOMA.length + 1) : null,
    cabecera: typeof accept === 'string' ? accept : null,
    permitidos,
  })
}

interface ErrorProps {
  statusCode?: number
  idioma?: Idioma
}

function Error({ statusCode, idioma = IDIOMA_POR_OMISION }: ErrorProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#0a0a14',
        color: '#e8e8f0',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 600, color: '#6c63ff', margin: '0 0 0.5rem' }}>
          {statusCode ?? 'Error'}
        </h1>
        <p style={{ color: '#9090aa', margin: '0 0 1.5rem' }}>
          {traducir(idioma, statusCode === 404 ? 'shell.error.no-encontrada' : 'shell.error.servidor')}
        </p>
        <a href="/" style={{ color: '#6c63ff', fontSize: '0.875rem', textDecoration: 'none' }}>
          {traducir(idioma, 'shell.error.volver')}
        </a>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err, req }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode : 404
  return { statusCode, idioma: idiomaDeReq(req) }
}

export default Error
