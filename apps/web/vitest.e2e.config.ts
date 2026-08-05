import { defineConfig } from 'vitest/config'
import path from 'node:path'

// ============================================================================
//  Config de las pruebas de INTEGRACIÓN (`*.e2e.test.ts`).
// ----------------------------------------------------------------------------
//  Aparte de la config normal a propósito: éstas necesitan Postgres levantado
//  (`cd db && docker compose up -d`) y el servidor de Next construido y
//  corriendo. Mezclarlas con las unitarias haría que `npm test` fallara en
//  cualquier máquina sin Docker, y entonces se acabaría ignorando el rojo — que
//  es la forma más rápida de quedarse sin pruebas.
//
//  Corren en SERIE (`fileParallelism: false`): comparten una única base y cada
//  fichero recrea el esquema. En paralelo se pisarían entre sí.
//
//  El timeout es alto porque recrear el esquema y sembrar cuesta segundos, no
//  milisegundos. Un timeout corto aquí produce fallos intermitentes, que son
//  peores que no tener la prueba.
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
    include: ['lib/**/*.e2e.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
