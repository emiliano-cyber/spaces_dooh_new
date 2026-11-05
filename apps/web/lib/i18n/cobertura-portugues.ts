import { AMBITOS_PORTUGUES, CLAVES, DICCIONARIOS, PT_PARCIAL } from './diccionario'
import {
  CAMPO_EN,
  CAMPO_PT,
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_PT,
  FALTA_FIRMA_EN,
  FALTA_FIRMA_PT,
  PATRONES_ERROR,
} from './errores-servidor'
import type { FilaCobertura } from './cobertura-italiano'

// ============================================================================
//  lib/i18n/cobertura-portugues.ts — CUANTO PORTUGUES FALTA, POR AMBITO.
// ----------------------------------------------------------------------------
//  Ola 0 del portugues (2026-11-05). La hermana de `cobertura-italiano.ts`,
//  con una diferencia que la hace MAS necesaria: lo que falta del portugues se
//  pinta en ESPANOL (decision del dueno del 05/11), asi que una pantalla a
//  medias no se distingue de una pantalla de la version espanola. Esta tabla
//  es lo unico que dice cuanto falta: una fila por ambito con sus claves, las
//  que ya tienen portugues y las pendientes. Y comprueba que lo escrito este
//  bien formado (sin vacios, con los mismos huecos `{…}` que el espanol).
//
//  Lo usa `cobertura-portugues.test.ts`, que imprime la tabla. Al cerrar el
//  ultimo lote, todas las filas tienen que dar 0 pendientes y el tipo de cada
//  `PT_<AMBITO>` pasa a `Record` completo.
// ============================================================================

export type { FilaCobertura }

const escrita = (v: unknown) => typeof v === 'string' && v !== ''

function fila(ambito: string, claves: string[], pt: Partial<Record<string, string>>): FilaCobertura {
  const traducidas = claves.filter((k) => escrita(pt[k])).length
  return { ambito, claves: claves.length, traducidas, pendientes: claves.length - traducidas }
}

/** Las claves de `diccionario.ts` que no son de ningun `textos/<ambito>.ts`. */
export function clavesBasePortugues(): string[] {
  const deAmbito = new Set(AMBITOS_PORTUGUES.flatMap((a) => Object.keys(a.es)))
  return CLAVES.filter((k) => !deAmbito.has(k))
}

/** La interfaz (`textos/` y la base) y los catalogos del servidor, fila a fila. */
export function coberturaPortugues(): FilaCobertura[] {
  return [
    fila('base (diccionario.ts)', clavesBasePortugues(), PT_PARCIAL as Partial<Record<string, string>>),
    // Contra TODO lo escrito (`PT_PARCIAL`) y no solo el `PT_<AMBITO>` del
    // lote: desde P3 (05/11) las claves de los papeles viven aparte
    // (`textos/papeles-portugues.ts`) y tambien cuentan como traducidas.
    ...AMBITOS_PORTUGUES.map((a) =>
      fila(a.ambito, Object.keys(a.es), { ...(PT_PARCIAL as Partial<Record<string, string>>), ...a.pt }),
    ),
    fila('errores · catalogo', Object.keys(CATALOGO_ERRORES), CATALOGO_ERRORES_PT),
    fila('errores · campos', Object.keys(CAMPO_EN), CAMPO_PT),
    fila('errores · firma', Object.keys(FALTA_FIRMA_EN), FALTA_FIRMA_PT),
    {
      ambito: 'errores · patrones',
      claves: PATRONES_ERROR.length,
      traducidas: PATRONES_ERROR.filter((p) => escrita(p.pt)).length,
      pendientes: PATRONES_ERROR.filter((p) => !escrita(p.pt)).length,
    },
  ]
}

const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

// Los huecos que el portugues de `k` tiene que llevar. Como en italiano, una
// variante `.cero` puede no llevar `{n}` («vence hoje»).
function esperados(k: string, es: string, pt: string): string[] {
  const todos = huecos(es)
  if (k.endsWith('.cero') && !huecos(pt).includes('n')) return todos.filter((h) => h !== 'n')
  return todos
}

/**
 * Lo que esta MAL en el portugues ya escrito. Vacio = bien formado.
 *
 *  · una clave portuguesa que el espanol no tiene;
 *  · una cadena vacia (no cuenta como traducida y esconde la caida);
 *  · huecos `{n}` distintos de los del espanol.
 */
export function problemasPortugues(): string[] {
  const es = DICCIONARIOS.es as Record<string, string>
  const problemas: string[] = []
  for (const [k, v] of Object.entries(PT_PARCIAL as Record<string, string | undefined>)) {
    if (!(k in es)) problemas.push(`clave sin espanol: ${k}`)
    else if (v === '') problemas.push(`vacia: ${k}`)
    else if (typeof v === 'string' && huecos(v).join() !== esperados(k, es[k], v).join())
      problemas.push(`huecos distintos en ${k}: es {${huecos(es[k])}} · pt {${huecos(v)}}`)
  }
  for (const [tabla, nombre, en] of [
    [CATALOGO_ERRORES_PT, 'errores', CATALOGO_ERRORES],
    [CAMPO_PT, 'campos', CAMPO_EN],
    [FALTA_FIRMA_PT, 'firma', FALTA_FIRMA_EN],
  ] as const) {
    for (const [k, v] of Object.entries(tabla)) {
      if (!(k in en)) problemas.push(`${nombre}: entrada sin espanol canonico: ${k}`)
      else if (v === '') problemas.push(`${nombre}: vacia: ${k}`)
    }
  }
  return problemas
}

/** La tabla en Markdown, para el tablero (`vault/03-Frontend/portugues-olas.md`). */
export function tablaCoberturaPortugues(filas: FilaCobertura[] = coberturaPortugues()): string {
  const total = filas.reduce(
    (a, f) => ({ claves: a.claves + f.claves, traducidas: a.traducidas + f.traducidas }),
    { claves: 0, traducidas: 0 },
  )
  return [
    '| Ambito | Claves | Con portugues | Pendientes |',
    '|---|---:|---:|---:|',
    ...filas.map((f) => `| ${f.ambito} | ${f.claves} | ${f.traducidas} | ${f.pendientes} |`),
    `| **Total** | **${total.claves}** | **${total.traducidas}** | **${total.claves - total.traducidas}** |`,
  ].join('\n')
}
