import { AMBITOS_ITALIANO, CLAVES, DICCIONARIOS, IT_PARCIAL } from './diccionario'
import {
  CAMPO_EN,
  CAMPO_IT,
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_IT,
  FALTA_FIRMA_EN,
  FALTA_FIRMA_IT,
  PATRONES_ERROR,
} from './errores-servidor'

// ============================================================================
//  lib/i18n/cobertura-italiano.ts — CUANTO ITALIANO FALTA, POR AMBITO.
// ----------------------------------------------------------------------------
//  Ola 0 del italiano (2026-11-03). Mientras los lotes trabajan, el italiano
//  es PARCIAL y lo que falta se pinta en ingles (`diccionario.ts`). Esa caida
//  es comoda y es peligrosa por lo mismo: no da ningun error. Esto es lo que
//  la hace visible — una fila por ambito con sus claves, las que ya tienen
//  italiano y las pendientes — y lo que comprueba que lo escrito este bien
//  formado (sin vacios, con los mismos huecos `{…}` que el espanol).
//
//  Lo usa `cobertura-italiano.test.ts`, que imprime la tabla. Al cerrar el
//  ultimo lote, todas las filas tienen que dar 0 pendientes y el tipo de cada
//  `IT_<AMBITO>` pasa a `Record` completo.
// ============================================================================

export interface FilaCobertura {
  ambito: string
  claves: number
  traducidas: number
  pendientes: number
}

const escrita = (v: unknown) => typeof v === 'string' && v !== ''

function fila(ambito: string, claves: string[], it: Partial<Record<string, string>>): FilaCobertura {
  const traducidas = claves.filter((k) => escrita(it[k])).length
  return { ambito, claves: claves.length, traducidas, pendientes: claves.length - traducidas }
}

/** Las claves de `diccionario.ts` que no son de ningun `textos/<ambito>.ts`. */
export function clavesBase(): string[] {
  const deAmbito = new Set(AMBITOS_ITALIANO.flatMap((a) => Object.keys(a.es)))
  return CLAVES.filter((k) => !deAmbito.has(k))
}

/** La interfaz (`textos/` y la base) y los catalogos del servidor, fila a fila. */
export function coberturaItaliano(): FilaCobertura[] {
  return [
    fila('base (diccionario.ts)', clavesBase(), IT_PARCIAL as Partial<Record<string, string>>),
    ...AMBITOS_ITALIANO.map((a) => fila(a.ambito, Object.keys(a.es), a.it)),
    fila('errores · catalogo', Object.keys(CATALOGO_ERRORES), CATALOGO_ERRORES_IT),
    fila('errores · campos', Object.keys(CAMPO_EN), CAMPO_IT),
    fila('errores · firma', Object.keys(FALTA_FIRMA_EN), FALTA_FIRMA_IT),
    {
      ambito: 'errores · patrones',
      claves: PATRONES_ERROR.length,
      traducidas: PATRONES_ERROR.filter((p) => escrita(p.it)).length,
      pendientes: PATRONES_ERROR.filter((p) => !escrita(p.it)).length,
    },
  ]
}

const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

/**
 * Lo que esta MAL en el italiano ya escrito. Vacio = bien formado.
 *
 *  · una clave italiana que el espanol no tiene (el tipo lo impide en
 *    `textos/`, pero no en un objeto armado a mano);
 *  · una cadena vacia (no cuenta como traducida y esconde la caida);
 *  · huecos `{n}` distintos de los del espanol: el ingles los respeta, y un
 *    italiano que pierde uno pinta la frase sin el dato. Salvo `{n}` en una
 *    variante `.cero` (lote L5): «scade oggi» no lleva la cifra, como el
 *    «due today» del ingles (ola 7). Cualquier otro hueco perdido cuenta.
 */
// Los huecos que el italiano de `k` tiene que llevar.
function esperados(k: string, es: string, it: string): string[] {
  const todos = huecos(es)
  if (k.endsWith('.cero') && !huecos(it).includes('n')) return todos.filter((h) => h !== 'n')
  return todos
}

export function problemasItaliano(): string[] {
  const es = DICCIONARIOS.es as Record<string, string>
  const problemas: string[] = []
  for (const [k, v] of Object.entries(IT_PARCIAL as Record<string, string | undefined>)) {
    if (!(k in es)) problemas.push(`clave sin espanol: ${k}`)
    else if (v === '') problemas.push(`vacia: ${k}`)
    else if (typeof v === 'string' && huecos(v).join() !== esperados(k, es[k], v).join())
      problemas.push(`huecos distintos en ${k}: es {${huecos(es[k])}} · it {${huecos(v)}}`)
  }
  for (const [tabla, nombre, en] of [
    [CATALOGO_ERRORES_IT, 'errores', CATALOGO_ERRORES],
    [CAMPO_IT, 'campos', CAMPO_EN],
    [FALTA_FIRMA_IT, 'firma', FALTA_FIRMA_EN],
  ] as const) {
    for (const [k, v] of Object.entries(tabla)) {
      if (!(k in en)) problemas.push(`${nombre}: entrada sin espanol canonico: ${k}`)
      else if (v === '') problemas.push(`${nombre}: vacia: ${k}`)
    }
  }
  return problemas
}

/** La tabla en Markdown, para el tablero (`vault/03-Frontend/italiano-olas.md`). */
export function tablaCobertura(filas: FilaCobertura[] = coberturaItaliano()): string {
  const total = filas.reduce(
    (a, f) => ({ claves: a.claves + f.claves, traducidas: a.traducidas + f.traducidas }),
    { claves: 0, traducidas: 0 },
  )
  return [
    '| Ambito | Claves | Con italiano | Pendientes |',
    '|---|---:|---:|---:|',
    ...filas.map((f) => `| ${f.ambito} | ${f.claves} | ${f.traducidas} | ${f.pendientes} |`),
    `| **Total** | **${total.claves}** | **${total.traducidas}** | **${total.claves - total.traducidas}** |`,
  ].join('\n')
}
