import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

// ============================================================================
//  Tipografía institucional. Las dos familias se cargan con next/font, que las
//  descarga EN EL BUILD y las sirve desde /_next/static/media: en ejecución no
//  sale ni una petición a un CDN. Es requisito del modelo de instancias
//  soberanas —cada instancia corre sola, sin depender de terceros— y de paso
//  quita el destello de texto sin fuente que traían los <link> al CDN externo
//  que había aquí antes, que además bloqueaban el primer pintado.
//
//  Las variables que publica cada familia (--font-display y --font-sans) son
//  las MISMAS que ya consumían los tokens de demo.css y las claves de
//  tailwind.config, así que el cambio de familia se hace aquí y en ningún
//  componente.
// ============================================================================

const display = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  // Solo los pesos de titular. Los cuerpos de texto no son serif.
  weight: ['600', '700'],
  variable: '--font-display',
  fallback: ['Georgia', 'serif'],
})

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Spaces DOOH',
  description: 'Gestión de espacios publicitarios DOOH',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Las variables van en <html> y no en <body> porque `not-found.tsx` se
    // pinta fuera del grupo (app) y necesita las mismas fuentes.
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
