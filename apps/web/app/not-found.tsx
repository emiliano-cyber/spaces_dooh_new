export default function NotFound() {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a14', color: '#e8e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 600, margin: '0 0 0.5rem', color: '#6c63ff' }}>404</h1>
          <p style={{ color: '#9090aa', margin: '0 0 1.5rem' }}>Página no encontrada</p>
          <a href="/" style={{ color: '#6c63ff', fontSize: '0.875rem' }}>← Volver al inicio</a>
        </div>
      </body>
    </html>
  )
}
