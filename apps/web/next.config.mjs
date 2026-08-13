import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
          ...(process.env.HSTS === '1'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
            : []),
        ],
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
