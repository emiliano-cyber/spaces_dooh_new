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
    // `components/` entra desde el 11/08: el orden del menú vive en
    // `components/demo/shell/nav.ts` y es un dato PURO —una lista de objetos—,
    // así que se prueba en `node` sin montar React. Con el patrón anterior el
    // fichero existía y no lo corría nadie, que es peor que no tenerlo.
    //
    // Sigue siendo solo `.ts`: un `.tsx` necesitaría jsdom y dependencias que
    // este repo no tiene, y añadirlas por la puerta de atrás con un glob es
    // como se acaba con un arnés que nadie entiende.
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts'],
    // Las de integración (*.e2e.test.ts) van en vitest.e2e.config.ts: necesitan
    // Postgres y el servidor levantados. Si entraran aquí, `npm test` fallaría
    // en cualquier máquina sin Docker y el rojo se acabaría ignorando.
    exclude: ['**/node_modules/**', '**/*.e2e.test.ts'],
  },
})
