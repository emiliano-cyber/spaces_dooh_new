import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'
import { idiomaDeLaPeticion } from '@/lib/i18n/servidor'
import { idiomasActivos, langDelHtml } from '@/lib/i18n/idiomas'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import { ProveedorMoneda } from '@/lib/i18n/moneda-cliente'
import { monedaDeLaInstancia } from '@/lib/server/moneda-instancia'
import { idiomaDeLaInstancia } from '@/lib/server/idioma-instancia'
import { idiomasDelServidor } from '@/lib/server/idiomas-servidor'
import { cssDePaleta, leerPaleta } from '@/lib/apariencia'
import { ProveedorIdiomaDocumentos } from '@/lib/i18n/idioma-documentos-cliente'
import { traducir } from '@/lib/i18n/diccionario'

// `generateMetadata` y no un `metadata` fijo: la descripcion sale en el idioma
// de la peticion (lote de administracion, cuenta y shell, 2026-11-02). Este
// layout ya lee la cookie para el <html lang>, asi que no se vuelve dinamico
// nada que no lo fuera. El titulo es la marca y no se traduce.
export function generateMetadata(): Metadata {
  return {
    title: 'Spaces DOOH',
    description: traducir(idiomaDeLaPeticion(), 'shell.meta.descripcion'),
  }
}

// ── El sistema Institucional: Source Serif 4 + Inter ────────────────────────
//
// Van en el layout RAIZ y no en `(app)/`: las paginas publicas —propuesta,
// portal— no cuelgan de ese grupo, y servirlas desde alli las dejaria sin
// tipografia. Este layout lo monta TODO.
//
// Los archivos viven EN EL REPOSITORIO (`app/fuentes/`) y `next/font/local` los
// sirve desde el propio origen. Antes habia un `<link>` a `api.fontshare.com`
// por Cabinet Grotesk y General Sans, y la CSP en modo reporte lo cazo el 27/08:
// dos violaciones —`style-src` y quince de `font-src`— en cada carga de
// pagina. Con esto la CSP puede pasar de aviso a ENCENDIDA sin ampliar nada.
//
// Y no `next/font/google`, aunque fue lo primero: esa variante DESCARGA las
// fuentes de Google EN CADA BUILD, y el 23/11 el CI del PR de integracion murio
// con «An error occurred in `next/font`. TypeError: Cannot read properties of
// null (reading '1')» (`google/loader.js:112`): Google contesto a la maquina
// del CI una direccion de fuente sin extension. El codigo no tenia nada; el
// build dependia de que un tercero contestara bien. Lo mismo valia para cada
// imagen que se construye para las instancias. Con los archivos en el repo el
// build no sale a la red por tipografia.
//
// Son los MISMOS archivos que servia Google (subconjunto latin, que cubre
// espanol, ingles, italiano y portugues), y los dos son VARIABLES: uno solo
// lleva todos los grosores. Inter de 100 a 900; Source Serif 4 se usa en 600
// (titulos) y 700 (el wordmark), y Google entregaba el mismo archivo para los
// dos. Para cambiar de version, sustituye el .woff2 y ya.
//
// `display: 'swap'` es deliberado: el texto se pinta con la fuente de respaldo
// y se cambia al llegar la buena. La alternativa —`block`— deja la pagina muda
// hasta 3 s si la descarga se atasca, y una instancia lenta se veria ROTA en
// vez de sencilla.
const serif = localFont({
  src: './fuentes/source-serif-4-latin.woff2',
  weight: '600 700',
  variable: '--font-source-serif',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  // Lo que hacia `next/font/google` para una serif: la fuente de respaldo se
  // ajusta con las metricas de Times New Roman, no las de Arial (el valor por
  // omision de `next/font/local`), para que el titulo no salte al cargar.
  adjustFontFallback: 'Times New Roman',
})

const inter = localFont({
  src: './fuentes/inter-latin.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
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

// ── Y la MONEDA, tambien aqui (ADR 0048, 02/11) ──────────────────────────────
//
// Es de la INSTANCIA —se elige al crearla y la base no deja cambiarla— y este
// layout es el unico sitio por el que pasa TODA pagina, incluidas las publicas
// (la propuesta que ve el cliente, el comprobante). `ProveedorMoneda` la fija
// antes del primer `formatMonto` de cualquier pantalla.
//
// Si la base no contesta, la pagina FALLA en vez de caer a MXN. Se penso lo
// contrario —no tumbar /login por esto— y se descarto: el valor que fija este
// layout se queda en el navegador toda la sesion, y los importes llegan
// DESPUES por la API. Un tropiezo de la base en este instante, con la API
// sana un segundo despues, dejaria una instancia en dolares pintando pesos
// hasta recargar, sin ningun error. Sin base tampoco se puede iniciar sesion,
// asi que el fallo no quita nada que funcionara.

let avisoPaletaDado = false

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // IDIOMAS-SERVIDOR (10/11) · PRIMERO: deja fijados los idiomas elegidos en
  // Administracion, y `idiomaDeLaPeticion()` / `idiomasActivos()` de abajo ya
  // tienen que verlos. Sin eleccion guardada, mandan las variables `IDIOMA_*`.
  await idiomasDelServidor()
  const idioma = idiomaDeLaPeticion()
  const moneda = await monedaDeLaInstancia()
  // ADR 0049 · el idioma de los DOCUMENTOS de la instancia, para los papeles
  // que se pintan en el navegador (el comprobante). Fail-closed como la
  // moneda: si la base no contesta, la pagina falla en vez de suponer espanol.
  const idiomaDocumentos = await idiomaDeLaInstancia()
  // Los idiomas ENCENDIDOS (ola 0 del italiano, 2026-11-03). Con uno solo no
  // hay nada que elegir y el selector no se pinta. Desde el 18/11
  // (IDIOMAS-SIN-ES) puede no incluir el espanol; `idiomaDeLaPeticion()` de
  // arriba ya elige siempre uno de ESTA lista, asi que `idioma` y
  // `disponibles` no se contradicen.
  const disponibles = idiomasActivos()
  // PALETA-01 (10/11) · el color de la instancia, que se elige AL INSTALAR
  // (`--paleta` del alta → `PALETA` en `app.env`) y no desde la aplicacion.
  // Se lee aqui, en tiempo de ejecucion y sin `NEXT_PUBLIC_`: la imagen es la
  // misma para toda la flota y cada servidor pone su color.
  const paleta = leerPaleta(process.env.PALETA)
  if (!paleta.ok && !avisoPaletaDado) {
    avisoPaletaDado = true // una vez por proceso, no en cada pagina
    console.warn(`[paleta] ${paleta.motivo}; se usa el azul de SPACE OS`)
  }
  const cssPaleta = cssDePaleta(paleta.color)
  return (
    <html lang={langDelHtml(idioma)} className={`${serif.variable} ${inter.variable}`}>
      <body>
        {/* Pintada YA en el HTML: sin parpadeo del azul al color de la
            instancia. Vacia con la paleta de siempre. Solo admite `#rrggbb`
            validados (`leerPaleta`): no hay texto libre que inyectar. */}
        {cssPaleta && <style id="paleta-instancia" dangerouslySetInnerHTML={{ __html: cssPaleta }} />}
        <ProveedorMoneda moneda={moneda}>
          <ProveedorIdioma idioma={idioma} puedeElegir={disponibles.length > 1} disponibles={disponibles}>
            <ProveedorIdiomaDocumentos idioma={idiomaDocumentos}>
              <Providers>{children}</Providers>
            </ProveedorIdiomaDocumentos>
          </ProveedorIdioma>
        </ProveedorMoneda>
      </body>
    </html>
  )
}
