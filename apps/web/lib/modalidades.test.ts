import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  UNIDADES_VENTA,
  UNIDADES_FIJO,
  esFijo,
  motivoModalidadInvalida,
} from './modalidades'
import { validarFila } from './inventario-import'

// ============================================================================
//  Las reglas de una modalidad, en UN solo sitio.
// ----------------------------------------------------------------------------
//  EL DEFECTO QUE ESTO PREVIENE, y no es hipotético: hasta el 2026-09-28 las
//  siete unidades válidas y la regla «una pantalla FIJA solo se vende por
//  mensual o catorcenal» vivían dentro de `inventario-import.ts`, privadas, y
//  eran el único guardián porque el ÚNICO camino de escritura era el archivo.
//  Al abrir la captura desde la ficha aparece un segundo camino, y dos caminos
//  con dos copias de la misma regla divergen — es exactamente cómo se cuela un
//  spot en una lona.
//
//  Por eso la regla se extrajo aquí y el importador la IMPORTA. §3 comprueba
//  que sigue haciéndolo: si alguien vuelve a escribir la lista a mano en el
//  importador, esa sección cae.
// ============================================================================

describe('1 · las ocho unidades de venta', () => {
  // `cpm` entró el 07/10 (CPS-CPM): costo por millar de impactos. CPS no es
  // una unidad aparte, es `spot` con el nombre de ventas.
  it('son exactamente las ocho que admite la plantilla', () => {
    expect([...UNIDADES_VENTA]).toEqual([
      'mensual', 'catorcenal', 'semanal', 'diaria', 'spot', 'hora', 'programatico', 'cpm',
    ])
  })

  it('CPM se vende en una digital, y en una FIJA no', () => {
    expect(motivoModalidadInvalida('cpm', 'digital')).toBeNull()
    expect(motivoModalidadInvalida('CPM', 'rotativo')).toBeNull()
    expect(motivoModalidadInvalida('cpm', 'fijo')).toMatch(/mensual/)
  })

  it('una pantalla FIJA solo admite las dos de periodo', () => {
    expect([...UNIDADES_FIJO]).toEqual(['mensual', 'catorcenal'])
  })
})

describe('2 · qué se rechaza, que es lo que hay que demostrar', () => {
  it('una unidad que no existe se rechaza, diga lo que diga la pantalla', () => {
    for (const exhibicion of ['fijo', 'digital', 'rotativo']) {
      expect(motivoModalidadInvalida('quincenal', exhibicion)).toMatch(/unidad/i)
      expect(motivoModalidadInvalida('', exhibicion)).toMatch(/unidad/i)
    }
  })

  it('una pantalla FIJA con unidad «spot» se rechaza, y el mensaje dice por qué', () => {
    const motivo = motivoModalidadInvalida('spot', 'fijo')
    expect(motivo).toBeTruthy()
    // No vale un «dato inválido»: quien lo lee tiene que saber qué SÍ puede.
    expect(motivo).toMatch(/mensual/)
    expect(motivo).toMatch(/catorcenal/)
  })

  it('las seis unidades que una FIJA no admite se rechazan TODAS', () => {
    const prohibidas = UNIDADES_VENTA.filter((u) => !UNIDADES_FIJO.includes(u as never))
    expect(prohibidas).toHaveLength(6)
    for (const u of prohibidas) {
      expect(motivoModalidadInvalida(u, 'fijo'), `«${u}» coló en una pantalla fija`).toBeTruthy()
    }
  })

  it('pero una DIGITAL las admite las siete', () => {
    for (const u of UNIDADES_VENTA) {
      expect(motivoModalidadInvalida(u, 'digital'), u).toBeNull()
      expect(motivoModalidadInvalida(u, 'rotativo'), u).toBeNull()
    }
  })
})

describe('3 · la regla NO está copiada: el importador usa ESTA', () => {
  // La prueba de verdad es de comportamiento (abajo); ésta mira el fuente para
  // que, si alguien vuelve a escribir la lista a mano allí, el rojo señale el
  // archivo exacto en vez de dejar un mutante vivo en un caso no cubierto.
  const fuenteImport = readFileSync(join(__dirname, 'inventario-import.ts'), 'utf8')

  it('`inventario-import.ts` importa las listas de `modalidades`', () => {
    expect(fuenteImport).toMatch(/import\s*\{[^}]*UNIDADES_VENTA[^}]*\}\s*from\s*'\.\/modalidades'/)
  })

  it('y sus dos listas SE ASIGNAN de las compartidas, sin intermediario', () => {
    // Ésta es la aserción que muerde, y la primera versión NO mordía: decía
    // `not.toMatch(/'programatico'/)` —con comillas SIMPLES— y el mutante que
    // recreaba la lista a mano con comillas DOBLES SOBREVIVIÓ. Van tres ramas
    // seguidas con un mutante vivo por una aserción de cadena mal acotada; es el
    // modo de fallo de esta familia de pruebas.
    //
    // La forma que aguanta es afirmar la ASIGNACIÓN, que no depende de cómo se
    // escriban las comillas: si `UNIDAD_OK` deja de venir de `UNIDADES_VENTA`,
    // esto cae venga de donde venga.
    expect(fuenteImport).toMatch(/const\s+UNIDAD_OK\s*:[^=]*=\s*UNIDADES_VENTA\b/)
    expect(fuenteImport).toMatch(/const\s+UNIDAD_FIJO_OK\s*:[^=]*=\s*UNIDADES_FIJO\b/)
  })

  it('y NO vuelve a escribir las siete unidades a mano, con NINGÚN tipo de comilla', () => {
    // El literal más raro de la lista, en las tres formas en que se puede
    // escribir una cadena en TypeScript.
    expect(fuenteImport).not.toMatch(/['"`]programatico['"`]/)
  })

  it('el importador sigue rechazando una FIJA con spot — el comportamiento, no el fuente', () => {
    const fila = validarFila(
      { nombre: 'Lona centro', exhibicion: 'fijo', unidad: 'spot', tarifa_publicada: '1000' },
      0,
    )
    expect(fila.status).toBe('error')
    expect(fila.datos).toBeNull()
    expect(fila.mensaje).toMatch(/mensual/)
  })

  it('y sigue aceptando una DIGITAL con spot', () => {
    const fila = validarFila(
      { nombre: 'Pantalla Reforma', exhibicion: 'digital', unidad: 'spot', tarifa_publicada: '250' },
      0,
    )
    expect(fila.status).not.toBe('error')
    expect(fila.datos?.unidad).toBe('spot')
  })
})

describe('4 · qué cuenta como «fija»', () => {
  it('solo «fijo», en cualquier caja y con espacios', () => {
    expect(esFijo('fijo')).toBe(true)
    expect(esFijo('FIJO')).toBe(true)
    expect(esFijo(' Fijo ')).toBe(true)
  })

  it('digital y rotativo NO son fijas', () => {
    expect(esFijo('digital')).toBe(false)
    expect(esFijo('rotativo')).toBe(false)
  })

  it('sin dato se trata como FIJA, igual que la ficha', () => {
    // `sitios-repo.ts` (rowToSitio) pinta `r.exhibicion ?? 'fijo'`. Si aquí se
    // tratara como digital, la ficha diría «fijo» y el servidor aceptaría un
    // spot: lo que se ve y lo que se guarda dirían cosas distintas, que es el
    // peor de los dos errores posibles.
    expect(esFijo(null)).toBe(true)
    expect(esFijo(undefined)).toBe(true)
    expect(esFijo('')).toBe(true)
  })
})
