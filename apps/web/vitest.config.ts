import { defineConfig } from 'vitest/config'
import path from 'node:path'

// ============================================================================
//  Config de pruebas de apps/web.
//  - `@/...` resuelve igual que en Next (tsconfig paths).
//  - `server-only` es un guard de Next que revienta fuera de un React Server
//    Component; en las pruebas se sustituye por un módulo vacío para poder
//    importar los controllers (su validación corre antes de tocar la BD).
// ============================================================================
export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'lib/test/server-only-stub.ts'),
      '@': __dirname,
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
