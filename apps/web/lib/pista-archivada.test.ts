import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// ============================================================================
//  La pista archivada NO se ejecuta.  (hallazgo del 2026-08-27)
// ----------------------------------------------------------------------------
//  El 27/08, la CSP en modo reporte destapó que `app/layout.tsx` montaba —vía
//  `app/providers.tsx`— el `AuthProvider` de `lib/auth-context.tsx`, que es del
//  backend Fastify archivado en `_archive/api`. Consecuencia medida en el PADRE,
//  en CADA carga de página:
//
//      POST http://localhost:3001/auth/refresh   credentials: 'include'
//                                                -> ERR_CONNECTION_REFUSED
//
//  El efecto visible era ruido. Pero la rama de éxito de ese provider tomaba el
//  `accessToken` de la respuesta, lo instalaba, pedía `/auth/me` con ese Bearer
//  y hacía `setUser()`. Es decir: **una página de producción pidiéndole una
//  identidad a la máquina del visitante.**
//
//  ─── POR QUÉ ESTA PRUEBA ES ESTÁTICA, Y NO DE COMPORTAMIENTO ──────────────
//  Lo que falló no es una función: es que un árbol de archivos siguiera
//  enganchado al layout raíz. Ninguna prueba de comportamiento lo vio —las 997
//  unitarias y las 294 e2e estaban en verde con el defecto dentro— porque **las
//  suites no cargan un navegador** y nada del lado servidor pasa por ahí.
//
//  Lo único que puede afirmarlo es leer el árbol, igual que hace
//  `entorno.test.ts` con las plantillas de `.env`. La prueba muerde donde
//  ocurrió el fallo: en la existencia y el enganche, no en la ejecución.
// ============================================================================

const RAIZ_WEB = join(__dirname, '..')

/** Los archivos de la pista archivada. Ninguno debe volver a `apps/web`. */
const RETIRADOS = [
  'lib/auth-context.tsx',
  'lib/api-client.ts',
  'components/operaciones/OTMovil.tsx',
  'components/campanas/ReporteVisual.tsx',
  'components/campanas/ReadinessPanel.tsx',
  'components/shared/PermissionGuard.tsx',
  'app/_legacy',
]

/** Recorre `app/`, `lib/` y `components/` y devuelve las rutas de código. */
function archivosDeCodigo(): string[] {
  const encontrados: string[] = []
  const recorrer = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entrada of readdirSync(dir)) {
      if (entrada === 'node_modules' || entrada === '.next') continue
      const ruta = join(dir, entrada)
      if (statSync(ruta).isDirectory()) {
        recorrer(ruta)
      } else if (/\.(ts|tsx)$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
        encontrados.push(ruta)
      }
    }
  }
  for (const sub of ['app', 'lib', 'components']) recorrer(join(RAIZ_WEB, sub))
  return encontrados
}

describe('la pista archivada no se ejecuta', () => {
  it('el layout raiz no monta el AuthProvider del backend archivado', () => {
    // `providers.tsx` lo montaba en `<AuthProvider>{children}</AuthProvider>`,
    // y `app/layout.tsx` monta `<Providers>`. Ese era el enganche entero.
    const providers = readFileSync(join(RAIZ_WEB, 'app/providers.tsx'), 'utf8')
    expect(providers).not.toMatch(/auth-context/)
    expect(providers).not.toMatch(/AuthProvider/)
  })

  it('ningun archivo vivo apunta al backend archivado', () => {
    // `localhost:3001` era el valor por omisión de `NEXT_PUBLIC_API_URL` en
    // `api-client.ts:1` y `auth-context.tsx:16`. En una página de producción,
    // ese `localhost` es la máquina de QUIEN VISITA, no el servidor.
    const culpables = archivosDeCodigo()
      .filter((ruta) => /localhost:3001|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_TENANT_SLUG/.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(RAIZ_WEB, ruta).split(sep).join('/'))
    expect(culpables).toEqual([])
  })

  it('los archivos de la pista archivada ya no estan en apps/web', () => {
    // Se retiran los SIETE juntos y no solo el provider: `_legacy/(auth)/auth/
    // login/page.tsx` importaba `useAuth`, y `tsconfig.json` no excluye nada
    // salvo `node_modules`. La pista archivada es un bloque conectado — dejar
    // la mitad rompe el typecheck. Su historia sigue en git y en `_archive/`.
    const presentes = RETIRADOS.filter((r) => existsSync(join(RAIZ_WEB, r)))
    expect(presentes).toEqual([])
  })
})
