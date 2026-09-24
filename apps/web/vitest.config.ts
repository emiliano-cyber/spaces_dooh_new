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
  // JSX para los `.tsx` que IMPORTA una prueba (23/09). No abre la puerta a
  // pruebas `.tsx`: el glob de abajo sigue siendo solo `.ts`. Lo que habilita es
  // poder importar un componente real —`components/demo/ui/Button.tsx`— desde
  // una prueba `.ts` y rendirlo con `react-dom/server`.
  //
  // El comentario de abajo decía que un `.tsx` «necesitaría jsdom y
  // dependencias que este repo no tiene». Medido el 23/09: es cierto para
  // simular clics o leer el DOM, y FALSO para rendir a markup.
  // `renderToStaticMarkup` corre en `node` a pelo, y `react-dom` ya es
  // dependencia de producción. Cero paquetes nuevos.
  oxc: { jsx: { runtime: 'automatic' } },
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
    // Sigue siendo solo `.ts`, y a propósito: añadir `.tsx` al glob por la
    // puerta de atrás es como se acaba con un arnés que nadie entiende. Una
    // prueba que necesite un componente lo IMPORTA y lo rinde con
    // `react-dom/server` (ver `oxc` arriba); lo que no se puede hacer sin DOM
    // —clics, foco, hidratación— no se finge aquí: se dice y se deja fuera.
    // `../../scripts/**` entra desde el 17/08 (F3.2): el runner de migraciones
    // vive en la RAÍZ del repo —lo invoca `update.sh` en el droplet, donde no
    // hay `apps/web` montado— pero su parte pura (el orden y el tipo) se prueba
    // igual que cualquier otra. Sin esta línea el fichero existe y no lo corre
    // nadie, que es peor que no tenerlo.
    // `middleware.test.ts` entra desde el 09/09: el middleware TIENE que vivir
    // en la raíz de apps/web (lo exige Next), así que su prueba también, y sin
    // esta entrada el archivo existe y no lo corre nadie — el mismo motivo por
    // el que se añadió `components/`.
    include: [
      'lib/**/*.test.ts',
      'components/**/*.test.ts',
      'middleware.test.ts',
      '../../scripts/**/*.test.ts',
    ],
    // Las de integración (*.e2e.test.ts) van en vitest.e2e.config.ts: necesitan
    // Postgres y el servidor levantados. Si entraran aquí, `npm test` fallaría
    // en cualquier máquina sin Docker y el rojo se acabaría ignorando.
    exclude: ['**/node_modules/**', '**/*.e2e.test.ts'],
  },
})
