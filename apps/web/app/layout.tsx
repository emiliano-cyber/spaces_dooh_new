import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { idiomaDeLaPeticion } from '@/lib/i18n/servidor'
import { ProveedorIdioma } from '@/lib/i18n/contexto'

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

// ── El idioma se decide AQUI, en el servidor, antes del primer byte ─────────
//
// I18N-01 (2026-09-30). Este layout lo monta TODO —incluidas las paginas
// publicas, que no cuelgan de `(app)`—, asi que es el unico sitio desde el que
// una sola decision alcanza a la aplicacion entera.
//
// Que se gana haciendolo aqui y no en el cliente: el HTML sale ya en el idioma
// correcto y la hidratacion coincide, asi que NO HAY PARPADEO. Leer
// `navigator.language` en el navegador obligaria a pintar espanol primero y
// corregirlo despues, y ese salto se ve — en una demostracion, fatal.
//
// Y que se evita: `middleware.ts` no se toca. Es archivo de alto contacto, ahi
// viven la sesion y el CSRF, y no hace falta para esto porque no se desvia
// ninguna peticion: la misma URL responde en los dos idiomas.
//
// `lang` en el `<html>` no es decoracion: es lo que usan los lectores de
// pantalla para elegir voz y el navegador para ofrecer la traduccion. Hasta hoy
// decia `es` fijo, y para un usuario en ingles eso era una afirmacion falsa.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const idioma = idiomaDeLaPeticion()
  return (
    <html lang={idioma} className={`${serif.variable} ${inter.variable}`}>
      <body>
        <ProveedorIdioma idioma={idioma}>
          <Providers>{children}</Providers>
        </ProveedorIdioma>
      </body>
    </html>
  )
}
