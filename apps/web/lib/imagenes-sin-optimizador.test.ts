import { describe, it, expect } from 'vitest'
import nextConfig from '../next.config.mjs'

// ============================================================================
//  SEG-21OCT · A1 — el optimizador de imágenes de Next, APAGADO.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. Next 14.2.29 arrastra GHSA-2xp9-vwfh-vxw4
//  (crítico): ejecución remota de código SIN SESIÓN en `/_next/image` cuando
//  optimiza un AVIF, por `libheif` dentro de `sharp`. **No hay parche en la
//  rama 14**: el primero es 15.5.24, que es un salto de versión mayor.
//
//  Y estaba alcanzable: `/_next/image` es público (el `matcher` de
//  `middleware.ts` lo excluye) y `remotePatterns` aceptaba
//  `*.digitaloceanspaces.com` — o sea el bucket de CUALQUIERA. Basta crear uno
//  propio y pedir `/_next/image?url=https://<mio>.nyc3.digitaloceanspaces.com/x.avif`.
//
//  La aplicación no usa `next/image` (0 importaciones el 21/10), así que
//  apagarlo no le quita nada. Con `unoptimized`, Next contesta 404 ANTES de
//  validar parámetros o pedir nada (`next/dist/server/next-server.js`, el
//  `if (imagesConfig.loader !== "default" || imagesConfig.unoptimized)`).
//
//  Si algún día hace falta `next/image`, esto se vuelve a encender DESPUÉS de
//  subir a una versión con el parche, no antes.
// ============================================================================

describe('A1 · el optimizador de imágenes no está expuesto', () => {
  it('va apagado: `/_next/image` responde 404 sin pedir nada', () => {
    expect(nextConfig.images?.unoptimized).toBe(true)
  })

  it('y no acepta imágenes remotas de ningún host', () => {
    // Aunque alguien lo volviera a encender, sin `remotePatterns` no podría
    // pedirse un archivo de fuera. Son dos cerrojos y no uno.
    expect(nextConfig.images?.remotePatterns ?? []).toEqual([])
    expect((nextConfig.images as { domains?: string[] } | undefined)?.domains ?? []).toEqual([])
  })
})

describe('A1 · nadie depende del optimizador', () => {
  it('ningún archivo de la aplicación importa `next/image`', async () => {
    // Si esto se cae, alguien empezó a usar `next/image` con el optimizador
    // apagado: sus imágenes saldrían sin optimizar, que no rompe nada, pero
    // tiene que ser una decisión y no una sorpresa.
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const raiz = join(__dirname, '..')
    const encontrados: string[] = []
    const recorrer = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === 'node_modules' || n === '.next') continue
        const p = join(d, n)
        if (statSync(p).isDirectory()) recorrer(p)
        else if (/\.(tsx?|jsx?|mjs)$/.test(n) && !n.endsWith('.test.ts')) {
          if (/from\s+['"]next\/image['"]/.test(readFileSync(p, 'utf8'))) encontrados.push(p)
        }
      }
    }
    for (const d of ['app', 'components', 'lib']) recorrer(join(raiz, d))
    expect(encontrados).toEqual([])
  })
})
