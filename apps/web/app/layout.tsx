import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Spaces DOOH',
  description: 'Gestión de espacios publicitarios DOOH',
}

// ── El sistema Institucional: Source Serif 4 + Inter ────────────────────────
//
// Van en el layout RAIZ y no en `(app)/`: las paginas publicas —propuesta,
// portal— no cuelgan de ese grupo, y servirlas desde alli las dejaria sin
// tipografia. Este layout lo monta TODO.
//
// `next/font/google` descarga los archivos EN EL BUILD y los sirve desde el
// propio origen. Antes habia un `<link>` a `api.fontshare.com` por Cabinet
// Grotesk y General Sans, y la CSP en modo reporte lo cazo el 27/08: dos
// violaciones —`style-src` y quince de `font-src`— en cada carga de pagina.
// Con esto la CSP puede pasar de aviso a ENCENDIDA sin ampliar nada.
//
// `display: 'swap'` es deliberado: el texto se pinta con la fuente de respaldo
// y se cambia al llegar la buena. La alternativa —`block`— deja la pagina muda
// hasta 3 s si la descarga se atasca, y una instancia lenta se veria ROTA en
// vez de sencilla.
const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  // Solo los grosores que se usan: 600 en titulos, 700 en el wordmark. Pedir la
  // familia entera son cientos de kB que nadie llega a ver.
  weight: ['600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${serif.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
