/**
 * Custom Pages Router error page — overrides Next.js default _error.
 * Must NOT use any context hooks (React context is unavailable during
 * static prerendering of /_error pages).
 */
import type { NextPageContext } from 'next'

interface ErrorProps {
  statusCode?: number
}

function Error({ statusCode }: ErrorProps) {
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
          {statusCode === 404 ? 'Página no encontrada' : 'Error del servidor'}
        </p>
        <a href="/" style={{ color: '#6c63ff', fontSize: '0.875rem', textDecoration: 'none' }}>
          ← Volver al inicio
        </a>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode : 404
  return { statusCode }
}

export default Error
