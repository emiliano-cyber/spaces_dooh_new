import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ============================================================================
//  Content-Security-Policy — BLOQUEANTE desde el 2026-08-28.
// ----------------------------------------------------------------------------
//  Hallazgo SEC-04 de la auditoría del 2026-08-26: no había ni CSP ni
//  Permissions-Policy.
//
//  ─── Nació en modo REPORTE, y pasó a bloquear dos días después ───────────
//  Una CSP mal puesta no da un error de servidor: devuelve 200 con la interfaz
//  ROTA, y eso solo se ve con un navegador abierto. Quien la escribió no tenía
//  uno, así que se entregó como `Content-Security-Policy-Report-Only`: el
//  navegador comprueba la política y ANOTA las violaciones sin impedir nada.
//
//  Ese modo hizo su trabajo. Lo que anotó, y que ninguna prueba podía ver
//  porque las suites no cargan un navegador:
//
//   · Las fuentes venían de `api.fontshare.com` — dos violaciones, `style-src`
//     y quince de `font-src`, en CADA carga de página. Se migraron a
//     `next/font`, servidas desde el propio origen (`lib/tipografia.test.ts`).
//   · Y de paso destapó algo que no era suyo: `app/providers.tsx` montaba el
//     `AuthProvider` del backend archivado, que hacía
//     `POST http://localhost:3001/auth/refresh` en cada visita — una página de
//     producción pidiéndole una identidad a la máquina del visitante. Retirado
//     el 27/08 (`lib/pista-archivada.test.ts`).
//
//  El 28/08, con la consola limpia, UNA PERSONA recorrió las cinco pantallas
//  que cargan algo distinto del resto —el mapa (MapTiler y Carto), el arte de
//  un creativo en iframe, el documento de un contrato, una propuesta pública y
//  el panel de inicio— sin un solo `[Report Only] Refused to`. Entonces, y solo
//  entonces, se quitó el `-Report-Only`.
//
//  > **Ese recorrido es lo que sostiene este cambio, y no una prueba.** Si algún
//  > día se añade una pantalla que cargue de un origen nuevo, la CSP la
//  > bloqueará EN SILENCIO: 200 y la interfaz a medias. Volver a reporte es
//  > quitar y poner una palabra en la clave de abajo.
//
//  NO se declara `report-uri` ni `report-to`: no hay endpoint que recoja los
//  informes y no se va a inventar uno. Las violaciones se leen en la consola.
//
//  ─── Cada directiva, y contra qué se comprobó ────────────────────────────
//  · script-src 'unsafe-inline' — Next 14 con App Router mete scripts EN LÍNEA
//    en cada página (`self.__next_f.push(...)`, la carga útil de Flight). La
//    alternativa —un nonce por petición— se genera en `middleware.ts` y obliga
//    a renderizar cada página bajo demanda; ese archivo es de alto contacto y
//    no se toca por esto. CONSECUENCIA HONESTA: con `'unsafe-inline'` en
//    scripts, esta política NO detiene un XSS reflejado o almacenado. Lo que sí
//    detiene está más abajo.
//  · style-src 'unsafe-inline' — Next inyecta `<style>` y atributos `style=`;
//    no hay forma de evitarlo sin nonce.
//  · connect-src — la lista de hosts sale de `components/demo/MapView.tsx:44`
//    y `:53-55`: MapTiler cuando hay `NEXT_PUBLIC_MAPTILER_KEY`, y los tres
//    subdominios de Carto como plan B sin clave. Todo lo demás de la aplicación
//    habla con su propio origen.
//  · img-src / media-src / frame-src `https:` — a propósito, y es la parte
//    floja. `lib/server/creativos-controller.ts:20` admite que el arte de un
//    creativo sea «una URL http(s) normal (arte ya hospedado)», o sea que el
//    origen lo elige el usuario al capturar la pieza; y el bucket de Spaces
//    llega por `DO_SPACES_ENDPOINT`/`DO_SPACES_CDN_URL`, que son de entorno.
//    Una lista cerrada de orígenes rompería creativos que hoy funcionan.
//  · worker-src blob: — MapLibre GL crea sus workers desde un blob.
//  · frame-ancestors 'none' — lo mismo que `X-Frame-Options: DENY`, pero en el
//    estándar vigente. Esta sí es defensa real contra clickjacking.
//  · object-src 'none' / base-uri 'self' / form-action 'self' — cierran tres
//    vías clásicas (plugins, secuestro de rutas relativas vía `<base>`, y
//    exfiltración por formulario) y no cuestan nada: nada de la aplicación las
//    usa.
//
//  ─── Lo que los creativos HEREDAN de esta política ───────────────────────
//  Un `<iframe srcDoc>` no tiene respuesta propia, así que HEREDA la CSP de la
//  página. La vista previa de creativos HTML5
//  (`components/demo/campanas/AgregarCreativo.tsx:142`) es un `srcDoc` con
//  `sandbox="allow-scripts"`. Con `'unsafe-inline'` en scripts sigue
//  funcionando; el día que se quite el `'unsafe-inline'`, esa vista previa se
//  queda en negro. Está anotado aquí para que no se descubra en producción.
//
//  El `sandbox="allow-scripts"` SIN `allow-same-origin` de ese iframe es lo que
//  de verdad aísla un creativo malicioso, y no depende de esta política. No se
//  toca.
// ============================================================================
const POLITICA_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "frame-src 'self' data: https:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://api.maptiler.com https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com https://c.basemaps.cartocdn.com https://tile.openstreetmap.org",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El build deja ademas un servidor autocontenido en .next/standalone, para que
  // la imagen de la instancia arranque sin el node_modules del monorepo.
  // No sustituye a `npm start` (`next start -p 3000`): las dos formas de arrancar
  // conviven mientras el droplet actual siga levantando la app con pm2.
  output: 'standalone',
  experimental: {
    // El trazado tiene que partir de la RAIZ del monorepo, no de apps/web: con
    // npm workspaces (`apps/*`, `packages/*`) las dependencias quedan hoisted en
    // el node_modules de la raiz, y sin esto el artefacto sale incompleto.
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  basePath: '/spaces-dooh',
  trailingSlash: true,
  transpilePackages: ['@spaces-dooh/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
      },
      {
        protocol: 'https',
        hostname: '*.cdn.digitaloceanspaces.com',
      },
    ],
  },
  async redirects() {
    // La raíz del basePath (/spaces-dooh/) no renderiza una página propia
    // (limitación de basePath + trailingSlash en el índice). El dashboard vive
    // en /inicio; mandamos la raíz ahí. La sesión la valida el middleware/gate
    // en /inicio (si no hay sesión, rebota a /login).
    return [{ source: '/', destination: '/inicio', permanent: false }]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS: fuerza HTTPS por 2 años. Se activa con HSTS=1 (solo cuando haya
          // TLS con dominio; NO usar con cert autofirmado ni sobre HTTP).
          //
          // OJO, y esto se midió el 2026-08-26: `HSTS` es una bandera de BUILD,
          // no de arranque. Next evalúa `headers()` UNA vez al construir y
          // congela el resultado en `.next/routes-manifest.json` — el build
          // vigente ese día traía las tres cabeceras de arriba resueltas y
          // ninguna de HSTS. Poner `HSTS=1` en el `.env` de una instancia no
          // hace nada. Quien la emite de verdad en la flota es nginx
          // (`infra/nginx/instancia.conf.tpl`, con `always`), y hay una prueba
          // que lo vigila (`lib/entorno.test.ts`, SEC-04). Esta rama se deja
          // como está: quitarla es un cambio de comportamiento para quien
          // construya su propia imagen, y no es lo que la auditoría pidió.
          ...(process.env.HSTS === '1'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
            : []),
          // ── Permissions-Policy (SEC-04) ────────────────────────────────────
          // Apaga capacidades del navegador que esta aplicación no usa. Va en
          // modo REAL (no hay «report-only» para esta cabecera) porque cada
          // permiso de la lista se comprobó contra el código antes de negarlo.
          //
          // `geolocation=(self)` es la EXCEPCIÓN y es deliberada: la auditoría
          // pedía negarla «porque no rompe nada», y sí rompe.
          // `components/demo/MapView.tsx:158` monta un `GeolocateControl` de
          // MapLibre —el botón «mi ubicación»— y ese mapa vive en cinco
          // pantallas, una de ellas la propuesta PÚBLICA que ve el cliente del
          // owner (`app/(app)/p/[id]/page.tsx:262`). Con `geolocation=()` el
          // botón sigue ahí y deja de funcionar, sin error visible. `(self)`
          // deja pedirla a nuestro origen y se la niega a cualquier iframe.
          //
          // Los creativos se muestran en `<iframe sandbox>` de origen opaco
          // (`components/demo/campanas/AgregarCreativo.tsx:142`), así que ni
          // siquiera con `(self)` heredan el permiso.
          //
          // Solo nombres que los navegadores reconocen hoy: un token
          // desconocido no bloquea nada y ensucia la consola con avisos, justo
          // donde hace falta leer las violaciones de la CSP de abajo.
          {
            key: 'Permissions-Policy',
            value: [
              'accelerometer=()',
              'camera=()',
              'display-capture=()',
              'geolocation=(self)',
              'gyroscope=()',
              'magnetometer=()',
              'microphone=()',
              'midi=()',
              'payment=()',
              'usb=()',
            ].join(', '),
          },
        ],
      },
      // ── Content-Security-Policy, BLOQUEANTE (SEC-04) ───────────────────────
      // Bloque aparte del de arriba porque su `source` EXCLUYE `/api/`: tres
      // rutas de ahí ya emiten su propia CSP, mucho más estricta, para el
      // contenido que sirven dentro de un iframe
      // (`api/creativos/[id]/arte/route.ts:71`, `api/logo/[token]/route.ts:78`,
      // `api/contratos/[id]/documento/route.ts:62`). Superponerles una de
      // reporte con `default-src 'self'` llenaba la consola de violaciones
      // falsas justo cuando una persona la estaba leyendo para decidir si la
      // política se podía activar.
      //
      // ⚠️ EN MODO BLOQUEANTE ESA EXCLUSIÓN IMPORTA MÁS, no menos. Dos CSP
      // sobre la misma respuesta se aplican como la INTERSECCIÓN de ambas: la
      // de aquí recortaría lo que esas tres rutas necesitan para pintar, y un
      // iframe de creativo se quedaría en blanco sin decir por qué.
      {
        source: '/:ruta((?!api/).*)',
        headers: [{ key: 'Content-Security-Policy', value: POLITICA_CSP }],
      },
    ]
  },
  webpack(config) {
    // Resolve styled-jsx to the local copy that matches this app's React version.
    // Without this, the monorepo root's styled-jsx (React 19) is used during
    // static prerendering of /_error pages while react-dom is still v18.
    config.resolve.alias['styled-jsx'] = path.resolve(
      __dirname,
      'node_modules/styled-jsx',
    )
    return config
  },
}

export default nextConfig
