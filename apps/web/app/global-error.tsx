'use client'

// ============================================================================
//  app/global-error.tsx — la pagina cuando falla el LAYOUT RAIZ.
// ----------------------------------------------------------------------------
//  ADR 0048. El layout raiz lee de la base la moneda de la instancia, y si la
//  base no contesta FALLA en vez de pintar pesos en una instancia en dolares
//  (fail-closed, confirmado por el dueno el 02/11). Sin este archivo, ese fallo
//  —y cualquier otro del layout— enseñaba la pagina 500 generica de Next, en
//  ingles y sin decir nada, tambien en /login y en el 404.
//
//  Sustituye al layout entero, asi que lleva su propio <html> y <body> y estilos
//  en linea: ni la hoja global ni las fuentes del layout llegan hasta aqui. Va en
//  espanol fijo: el idioma lo decide el layout, que es justo lo que fallo.
//  No ensena el error: puede llevar detalles de la base.
// ============================================================================

export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f7f5',
          color: '#18181b',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>El sistema no está disponible en este momento</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#52525b', margin: '0 0 20px' }}>
            No pudimos conectar con la base de datos. Tus datos no se han perdido: vuelve a
            intentarlo en unos minutos. Si sigue igual, avisa a quien administra el sistema.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              fontSize: 14,
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #d4d4d8',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  )
}
