import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Pedido del dueño el 2026-09-30: «en creativos quita el botón de repartir a
// todas». Se quita SOLO de la pantalla: la ruta `POST
// /api/campanas/:id/creativos/repartir` y `creativos-repo.ts` siguen, con sus
// pruebas, así que volver a ponerlo es revertir el commit que lo quitó.
it('la pantalla de Creativos ya no ofrece «Repartir a todas»', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '(app)', '(shell)', 'creativos', 'page.tsx'), 'utf8')
  expect(src).not.toMatch(/Repartir a todas/)
  expect(src).not.toMatch(/<RepartirCreativos\b/)
})
