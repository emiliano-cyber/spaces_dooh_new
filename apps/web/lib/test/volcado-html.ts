import { vi, expect } from 'vitest'
import { isValidElement } from 'react'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// ============================================================================
//  lib/test/volcado-html.ts — TODO EL HTML QUE RINDEN LAS PRUEBAS, A DISCO.
// ----------------------------------------------------------------------------
//  Ola 0 del italiano (2026-11-03). Solo entra en la corrida si se pide
//  (`vitest.config.ts` lo anade a `setupFiles` cuando hay `I18N_VOLCAR_TODO`,
//  `I18N_VOLCAR_IT` o `I18N_VOLCAR_PT`); en un `npm test` normal no existe.
//
//  ─── POR QUE ENVOLVER `renderToStaticMarkup` Y NO TOCAR CADA PRUEBA ────────
//
//  La regla dura del italiano es que el espanol y el ingles salgan IDENTICOS
//  byte a byte antes y despues de abrir la puerta a un tercer idioma. Las
//  pruebas de pantallas ya traian volcados (`I18N_VOLCAR`, `VOLCAR_HTML`,
//  `I18N_VOLCAR_EN`), pero cada una a su manera y casi todas solo del
//  espanol. Envolver la funcion que TODAS usan da el volcado completo —es, en y
//  lo que haya— sin editar dieciocho archivos, y lo que se compara es lo que
//  las pruebas ya afirman, no una copia.
//
//      I18N_VOLCAR_TODO=<carpeta>  → <carpeta>/<archivo>/<prueba>/<n>.html
//
//  El nombre sale de la prueba que esta corriendo y de un contador por prueba:
//  las pruebas de un archivo corren en serie, asi que dos corridas del mismo
//  arbol dan los mismos nombres y `diff -rq antes despues` sale vacio.
//
//  ─── EL ESPEJO ITALIANO ────────────────────────────────────────────────────
//
//      I18N_VOLCAR_IT=<carpeta>    → <carpeta>/<archivo>/<prueba>/<n>.html
//                                    + <carpeta>/_guardias.jsonl
//
//  Cada vez que una prueba rinde un arbol envuelto en `ProveedorIdioma` en
//  INGLES, se rinde ademas el mismo arbol en ITALIANO y se pasa por la guardia
//  de formatos (`guardias-idioma.ts`). Asi todos los estados que las pruebas
//  ya construyen —los mismos que se revisaron en ingles— se pueden mirar en
//  italiano sin escribir un solo dato de prueba nuevo. Lo que la guardia
//  encuentra va a `_guardias.jsonl` y NO tumba la prueba: hasta que los lotes
//  terminen, el italiano cae al ingles y es un informe, no un veredicto.
//
//  ─── LOS ESTADOS ITALIANOS DEL VOLCADO COMPLETO ────────────────────────────
//
//  Pulido del italiano (04/11): con `I18N_VOLCAR_TODO`, cada arbol que la
//  prueba rinde con `idioma: 'it'` en la raiz (un `ProveedorIdioma` italiano o
//  un componente con esa propiedad) se apunta en `<carpeta>/_italiano.txt`.
//  Es la lista que barre `barrido-italiano.test.ts`, junto al espejo. No
//  cambia ningun `.html` del volcado.
//
//  ─── EL ESPEJO PORTUGUES (ola 0 del portugues, 2026-11-05) ────────────────
//
//      I18N_VOLCAR_PT=<carpeta>    → <carpeta>/<archivo>/<prueba>/<n>.html
//                                    + <carpeta>/_guardias.jsonl
//
//  Lo mismo con el portugues (`espejo-portugues.ts`, guardia pt-BR). Y con
//  `I18N_VOLCAR_TODO`, los arboles rendidos con `idioma: 'pt'` en la raiz se
//  apuntan en `<carpeta>/_portugues.txt`, como los italianos. Tampoco cambia
//  ningun `.html` del volcado.
//
//  El espejo se rinde DESPUES del original, a proposito: algunas pruebas
//  fuerzan estados que se consumen durante el render (`pantallas-admin`), y si
//  el espejo fuera primero se los comeria. El original sale intacto.
// ============================================================================

const dirTodo = process.env.I18N_VOLCAR_TODO
const dirIt = process.env.I18N_VOLCAR_IT
const dirPt = process.env.I18N_VOLCAR_PT

const contadores = new Map<string, number>()

function limpio(s: string): string {
  return s.replace(/[^\w.-]+/g, '_').slice(0, 120) || '_'
}

/** `<archivo>/<prueba>/<n>`, estable entre corridas del mismo arbol. */
function rutaRelativa(): string {
  const estado = expect.getState()
  // La ruta relativa y no el nombre: `textos/servidor.test.ts` e
  // `i18n/servidor.test.ts` se pisarian.
  const archivo = limpio(relative(process.cwd(), estado.testPath ?? 'sin-archivo'))
  const prueba = limpio(estado.currentTestName ?? 'fuera-de-prueba')
  const clave = `${archivo}/${prueba}`
  const n = (contadores.get(clave) ?? 0) + 1
  contadores.set(clave, n)
  return join(archivo, prueba, `${String(n).padStart(3, '0')}.html`)
}

function escribir(raiz: string, rel: string, html: string): void {
  const ruta = join(raiz, rel)
  mkdirSync(join(ruta, '..'), { recursive: true })
  writeFileSync(ruta, html)
}

vi.mock('react-dom/server', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-dom/server')>()
  const original = real.renderToStaticMarkup
  // Se importa solo si se pide el espejo: una corrida que solo vuelca no
  // carga la guardia ni la app.
  const espejoItaliano = dirIt ? (await import('./espejo-italiano')).espejoItaliano : null
  const espejoPortugues = dirPt ? (await import('./espejo-portugues')).espejoPortugues : null

  function envuelto(el: Parameters<typeof original>[0], opciones?: Parameters<typeof original>[1]): string {
    const html = original(el, opciones)
    const rel = rutaRelativa()
    if (dirTodo) {
      escribir(dirTodo, rel, html)
      if (isValidElement(el) && (el.props as { idioma?: unknown }).idioma === 'it') {
        appendFileSync(join(dirTodo, '_italiano.txt'), `${rel}\n`)
      }
      if (isValidElement(el) && (el.props as { idioma?: unknown }).idioma === 'pt') {
        appendFileSync(join(dirTodo, '_portugues.txt'), `${rel}\n`)
      }
    }
    if (dirIt && espejoItaliano) {
      const espejo = espejoItaliano(el, (e) => original(e, opciones))
      if (espejo) {
        escribir(dirIt, rel, espejo.html)
        if (espejo.hallazgos.length) {
          mkdirSync(dirIt, { recursive: true })
          writeFileSync(join(dirIt, '_guardias.jsonl'), JSON.stringify({ rel, hallazgos: espejo.hallazgos }) + '\n', {
            flag: 'a',
          })
        }
      }
    }
    if (dirPt && espejoPortugues) {
      const espejo = espejoPortugues(el, (e) => original(e, opciones))
      if (espejo) {
        escribir(dirPt, rel, espejo.html)
        if (espejo.hallazgos.length) {
          mkdirSync(dirPt, { recursive: true })
          writeFileSync(join(dirPt, '_guardias.jsonl'), JSON.stringify({ rel, hallazgos: espejo.hallazgos }) + '\n', {
            flag: 'a',
          })
        }
      }
    }
    return html
  }

  return { ...real, renderToStaticMarkup: envuelto, default: { ...real, renderToStaticMarkup: envuelto } }
})
