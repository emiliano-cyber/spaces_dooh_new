import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
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
