import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AVISO_FRANJA_NO_VIAJA_AL_CMS } from './rejilla'

// ============================================================================
//  EL AVISO NO SE PUEDE PASAR POR ALTO. Invariante 3 del encargo, ADR 0039.
// ----------------------------------------------------------------------------
//  El SDK de DOOHmain acepta `--version --anunciante --campana --fecha-inicio
//  --fecha-fin --filepath --screen --list --cant-dia`
//  (`doohmain_sdk/__main__.py:66-75`). NO hay `--hora` ni `--dias`. La franja se
//  vende y se cobra; la programa una persona a mano en el CMS.
//
//  Una pantalla que enseña «Prime 06:00–10:00» y no lo agenda MIENTE POR
//  OMISIÓN, y el día que un spot salga a las tres de la mañana nadie sabrá si
//  falló el sistema o el operador.
//
//  ─── QUÉ FIJA ESTA PRUEBA, Y POR QUÉ ASÍ ──────────────────────────────────
//  El mecanismo elegido no es «acordarse de escribir el aviso»: es que el texto
//  exista UNA vez (`lib/rejilla.ts`), que haya UN componente que lo pinte, y que
//  esta prueba nombre las SUPERFICIES que enseñan una franja. Añadir una sexta
//  sin el aviso no rompe nada por sí sola — pero quitárselo a una de éstas, sí.
//
//  ⚠️ Y esa es la LIMITACIÓN de esta prueba, dicha con todas las letras: vigila
//  una lista escrita a mano. Protege lo que hay, no lo que llegue.
//
//  La que más importa de las cinco es la LIGA PÚBLICA: es la que ve el cliente y
//  donde la acepta. Y la sexta no es una pantalla: es el `snapshot_economico`,
//  que es lo que dura cuando las cinco pantallas hayan cambiado.
//
//  ─── SE MIRA EL FUENTE SIN COMENTARIOS ────────────────────────────────────
//  Un `toContain` sobre el fuente crudo casa con la PROSA que explica por qué se
//  hace algo, y pasaría en verde con el código borrado. Le pasó a este
//  repositorio el 25/09 y otra vez el 28/09.
// ============================================================================

const RAIZ = join(__dirname, '..')

/** El fuente sin comentarios de línea ni de bloque. */
function sinComentarios(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // comentarios JSX
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n')
}

/**
 * Las superficies que enseñan una franja al usuario. Si mañana aparece una
 * quinta, se añade aquí — y si alguien le quita el aviso a una de éstas, la
 * prueba cae.
 */
const SUPERFICIES: [string, string][] = [
  ['donde se CONFIGURAN las franjas', 'components/demo/rejilla/GestionRejilla.tsx'],
  ['donde se VENDE (el cuadro de la propuesta)', 'app/(app)/(shell)/propuestas/page.tsx'],
  ['donde se LEE la propuesta', 'app/(app)/(shell)/propuestas/[id]/page.tsx'],
  ['donde se capturan las tarifas por franja', 'components/demo/rejilla/RejillaDialog.tsx'],
  // La que MÁS importa: la liga pública es la que ve el CLIENTE y donde acepta.
  ['la LIGA PÚBLICA que ve el cliente', 'app/(app)/p/[id]/page.tsx'],
  // PROG-01 (2026-09-30) · la franja PROGRAMADA —en qué horario se transmite—
  // tampoco viaja al CMS, y estas dos pantallas la enseñan y la cambian. Son
  // componentes y no páginas porque así se montan con UNA línea en páginas que
  // otras ramas tocan; que la página los MONTE se vigila en el bloque 5.
  ['donde se PROGRAMAN campañas por franja', 'components/demo/rejilla/ProgramacionPorFranja.tsx'],
  ['donde se PROGRAMA la franja de una campaña', 'components/demo/campanas/FranjaProgramadaCampana.tsx'],
]

describe('1 · el texto vive en UN solo sitio', () => {
  it('ninguna pantalla lo escribe a mano', () => {
    // Un texto copiado en cuatro sitios deja tres versiones viejas el día que
    // cambie, y la que quede mal será justo la que lea el cliente.
    const trozo = AVISO_FRANJA_NO_VIAJA_AL_CMS.slice(0, 40)
    for (const [donde, ruta] of SUPERFICIES) {
      expect(sinComentarios(ruta), `«${donde}» escribe el aviso a mano`).not.toContain(trozo)
    }
  })

  it('el componente que lo pinta lo IMPORTA de `lib/rejilla`, no lo repite', () => {
    const c = sinComentarios('components/demo/rejilla/AvisoFranjaCMS.tsx')
    expect(c).toMatch(/import \{ AVISO_FRANJA_NO_VIAJA_AL_CMS \} from '@\/lib\/rejilla'/)
    expect(c).not.toContain(AVISO_FRANJA_NO_VIAJA_AL_CMS.slice(0, 40))
  })
})

// Eran cinco hasta el 2026-09-30; PROG-01 añadió las dos de la franja
// programada y son siete. El título no las cuenta para no volver a caducar.
describe('2 · las superficies lo llevan', () => {
  for (const [donde, ruta] of SUPERFICIES) {
    it(`${donde} usa <AvisoFranjaCMS />`, () => {
      const c = sinComentarios(ruta)
      expect(c, `«${donde}» no importa el componente`).toMatch(/AvisoFranjaCMS/)
      // Importarlo y no pintarlo sería exactamente el mismo defecto con una
      // capa más: se comprueba que el JSX esté.
      expect(c, `«${donde}» lo importa pero no lo pinta`).toMatch(/<AvisoFranjaCMS/)
    })
  }
})

describe('3 · y la SEXTA superficie es el congelado, que es la que dura', () => {
  it('`congelarSnapshotEconomico` mete el aviso en el snapshot', () => {
    const c = sinComentarios('lib/server/propuestas-repo.ts')
    expect(c).toMatch(/AVISO_FRANJA_NO_VIAJA_AL_CMS/)
    expect(c).toMatch(/avisoFranja/)
  })
})

describe('5 · las pantallas de la franja PROGRAMADA montan su componente (PROG-01)', () => {
  // Un componente con el aviso que ninguna página monta protege una pantalla
  // que no existe. Se comprueba el JSX, no el import.
  const MONTAJES: [string, string, RegExp][] = [
    ['Franjas y temporadas', 'app/(app)/(shell)/franjas-y-temporadas/page.tsx', /<ProgramacionPorFranja\b/],
    ['el detalle de campaña', 'app/(app)/(shell)/campanas/[id]/page.tsx', /<FranjaProgramadaCampana\b/],
  ]
  for (const [donde, ruta, jsx] of MONTAJES) {
    it(`${donde} lo pinta`, () => {
      expect(sinComentarios(ruta)).toMatch(jsx)
    })
  }

  it('los dos AVISAN de la discrepancia con la regla pura, no con una copia', () => {
    // «Se vendió como X y se programa en Y» lo calcula `avisosDeProgramacion`
    // en el servidor y las pantallas lo PINTAN. Si una pantalla lo recalculara
    // a mano, un día avisaría una y la otra no.
    for (const ruta of [
      'components/demo/rejilla/ProgramacionPorFranja.tsx',
      'components/demo/campanas/FranjaProgramadaCampana.tsx',
    ]) {
      const c = sinComentarios(ruta)
      expect(c, ruta).toMatch(/\.avisos\b/)
      expect(c, ruta).not.toMatch(/Se vendió como/)
    }
  })
})

describe('4 · lo que el aviso NO puede decir', () => {
  it('no promete que la franja se programe sola', () => {
    expect(AVISO_FRANJA_NO_VIAJA_AL_CMS).not.toMatch(/autom[áa]tic/i)
    // TODA mención de enviar al CMS tiene que ir negada. Se comprueba contando,
    // que es lo único que no se puede satisfacer con un lookahead mal puesto:
    // una asercion de cadena mal acotada es el modo de fallo de esta familia y
    // este repositorio ya lleva varias.
    const menciones = AVISO_FRANJA_NO_VIAJA_AL_CMS.match(/env[íi]a al CMS/gi) ?? []
    const negadas = AVISO_FRANJA_NO_VIAJA_AL_CMS.match(/\bNO se env[íi]a al CMS/gi) ?? []
    expect(negadas.length).toBe(menciones.length)
    expect(menciones.length).toBeGreaterThan(0)
  })

  it('dice quién tiene que hacerlo, no solo que el sistema no lo hace', () => {
    // «No se envía al CMS» a secas deja al lector sin saber qué hacer. La frase
    // tiene que nombrar a la persona que lo programa.
    expect(AVISO_FRANJA_NO_VIAJA_AL_CMS).toMatch(/quien opere|operador|una persona|manualmente/i)
  })
})
