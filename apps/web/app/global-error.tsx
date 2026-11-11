'use client'

import { useState } from 'react'
import { traducir } from '@/lib/i18n/diccionario'
import { normalizarIdioma, langDelHtml, IDIOMAS, IDIOMA_POR_OMISION, type Idioma } from '@/lib/i18n/idiomas'

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
//  en linea: ni la hoja global ni las fuentes del layout llegan hasta aqui.
//  No ensena el error: puede llevar detalles de la base.
//
//  EL IDIOMA (lote de administracion, cuenta y shell, 2026-11-02). Aqui no hay
//  proveedor de idioma: lo pone el layout, que es justo lo que fallo. Se lee
//  del `lang` del <html> que YA estaba pintado (`document.documentElement`),
//  que el layout raiz escribe con `idiomaDeLaPeticion()`: cuando el fallo
//  llega en el navegador (al navegar), ese <html> sigue ahi y dice el idioma
//  de la persona. Cuando el fallo es del primer pintado en el servidor no hay
//  `document` y sale en espanol, que es lo que salia siempre; la hidratacion
//  encuentra entonces este mismo <html lang="es"> y no cambia nada.
//  Se lee UNA vez, al montar (inicializador de `useState`): en cuanto este
//  componente pinta su propio <html>, el `lang` ya es el suyo.
// ============================================================================

function idiomaDelDocumento(): Idioma {
  if (typeof document === 'undefined') return IDIOMA_POR_OMISION
  // `IDIOMAS` a mano (lote L5 del italiano): el `lang` ya lo decidio el
  // servidor con sus interruptores, y en el navegador `IDIOMA_ITALIANO` no
  // existe, asi que la omision (`idiomasPorOmision`) rechazaria el italiano.
  return normalizarIdioma(document.documentElement?.lang, IDIOMAS) ?? IDIOMA_POR_OMISION
}

export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [idioma] = useState<Idioma>(idiomaDelDocumento)
  return (
    <html lang={langDelHtml(idioma)}>
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
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{traducir(idioma, 'shell.error-global.titulo')}</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#52525b', margin: '0 0 20px' }}>
            {traducir(idioma, 'shell.error-global.detalle')}
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
            {traducir(idioma, 'shell.error-global.reintentar')}
          </button>
        </main>
      </body>
    </html>
  )
}
