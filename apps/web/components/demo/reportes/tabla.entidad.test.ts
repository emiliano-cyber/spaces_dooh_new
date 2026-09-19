import { describe, it, expect } from 'vitest'
import {
  columnasDeDimension,
  ordenInicialDe,
  ordenarFilas,
  avisosDelReporte,
  notaDeArrendador,
  subtituloDeConteo,
  type FilaOrdenable,
} from './tabla'
import { DIMENSIONES_UI, sustantivoFila } from './consulta'

// ============================================================================
//  La tabla de la dimensión `entidad`, y lo que NO pinta.
// ----------------------------------------------------------------------------
//  Las dos propiedades que estas pruebas fijan son las dos que protegen al
//  usuario de leer un número que no es:
//
//   1. NO HAY COLUMNA DE MARGEN. La operación y la luz no se pueden repartir
//      entre razones sociales, así que un margen aquí le faltarían dos de las
//      cuatro fuentes de costo y saldría MEJOR QUE EL REAL. Lo que se pinta es
//      el SALDO ATRIBUIDO, con ese nombre.
//
//   2. «SIN ASIGNAR» SE QUEDA AL FINAL aunque el usuario ordene. No es un
//      competidor del ranking: es un hueco de captura. Un clic en «Ingreso» que
//      lo subiera a la primera fila lo haría leer como la sociedad que más
//      factura — que es justo lo que no es.
// ============================================================================

const fila = (over: Partial<FilaOrdenable> & { clave: string }): FilaOrdenable =>
  ({
    etiqueta: over.clave || 'Sin asignar',
    detalle: '',
    ingreso: 0,
    costoEspacio: 0,
    costoOperacion: 0,
    costoEnergia: 0,
    costoTotal: 0,
    margen: 0,
    margenPct: null,
    tieneContrato: false,
    visitas: 0,
    ...over,
  }) as FilaOrdenable

describe('la dimension existe en el selector', () => {
  it('«Por razon social» es una opcion de Agrupar', () => {
    expect(DIMENSIONES_UI.map((d) => d.valor)).toContain('entidad')
  })

  it('el sustantivo de sus filas es «razon social», no «pantalla»', () => {
    // La cabecera dice «N pantallas con movimiento». Sobre filas que son
    // sociedades seria la clase de mentira que no da ningun error y que hace
    // leer la tabla entera al reves.
    expect(sustantivoFila('entidad').singular).toMatch(/raz[oó]n social/i)
  })
})

describe('las columnas: lo que se pinta y lo que NO', () => {
  // Dentro de cada prueba y no en el cuerpo del `describe`: ahi una dimension
  // que todavia no existe reventaria al RECOLECTAR, y un rojo por excepcion de
  // carga no dice lo mismo que un rojo por asercion.
  const claves = () => (columnasDeDimension('entidad') ?? []).map((c) => c.clave)

  it('la primera columna se llama «Razon social»', () => {
    expect(columnasDeDimension('entidad')?.[0]?.label ?? '').toMatch(/raz[oó]n social/i)
  })

  it('pinta el ingreso y el costo del espacio, que son lo atribuible', () => {
    expect(claves()).toContain('ingreso')
    expect(claves()).toContain('costoEspacio')
  })

  it('NO pinta margen ni margen %: le faltarian dos fuentes de costo', () => {
    expect(claves()).not.toContain('margen')
    expect(claves()).not.toContain('margenPct')
  })

  it('NO pinta operacion, luz ni costo total: en esta dimension no se atribuyen', () => {
    expect(claves()).not.toContain('costoOperacion')
    expect(claves()).not.toContain('costoEnergia')
    expect(claves()).not.toContain('costoTotal')
  })

  it('pinta el saldo atribuido, y NO se llama margen', () => {
    expect(claves()).toContain('saldoAtribuido')
    const col = (columnasDeDimension('entidad') ?? []).find((c) => c.clave === 'saldoAtribuido')
    expect(col?.label ?? '').not.toMatch(/margen/i)
    expect(col?.label ?? '').toMatch(/saldo/i)
  })

  it('pinta que parte de la facturacion emite cada una', () => {
    expect(claves()).toContain('pctDelIngreso')
  })
})

describe('abre por quien factura mas', () => {
  it('el orden de apertura es por ingreso descendente', () => {
    // No «peor margen primero»: aqui no hay margen. La pregunta es «cuanto pasa
    // por cada una de mis sociedades».
    expect(ordenInicialDe('entidad')).toEqual({ columna: 'ingreso', direccion: 'desc' })
  })
})

describe('«Sin asignar» se queda al final, ordene el usuario lo que ordene', () => {
  const FILAS = [
    fila({ clave: 'E1', etiqueta: 'Publicidad Uno', ingreso: 100 }),
    fila({ clave: '', etiqueta: 'Sin asignar', ingreso: 900 }),
    fila({ clave: 'E2', etiqueta: 'Inmuebles Dos', ingreso: 500 }),
  ]

  it('por ingreso descendente NO lo sube a la primera fila', () => {
    const r = ordenarFilas(FILAS, { columna: 'ingreso', direccion: 'desc' }, 'entidad')
    expect(r.map((f) => f.clave)).toEqual(['E2', 'E1', ''])
  })

  it('tampoco lo sube al invertir la direccion', () => {
    const r = ordenarFilas(FILAS, { columna: 'ingreso', direccion: 'asc' }, 'entidad')
    expect(r.map((f) => f.clave)).toEqual(['E1', 'E2', ''])
  })

  it('en las otras dimensiones no cambia nada: ahi ninguna fila tiene clave vacia', () => {
    const porSitio = [
      fila({ clave: 'S1', ingreso: 100 }),
      fila({ clave: 'S2', ingreso: 900 }),
    ]
    const r = ordenarFilas(porSitio, { columna: 'ingreso', direccion: 'desc' }, 'sitio')
    expect(r.map((f) => f.clave)).toEqual(['S2', 'S1'])
  })
})

describe('el aviso de lo que no se atribuye', () => {
  const base = {
    dimension: 'entidad' as const,
    desde: '2026-02-01',
    hasta: '2026-02-28',
    hoy: new Date('2026-09-18T12:00:00Z'),
    filas: [fila({ clave: 'E1', ingreso: 100 })],
  }

  it('sale en AMBAR y con la nota que redacta el motor, verbatim', () => {
    const nota = 'La operación (X) y la luz (Y) NO se reparten: por eso no hay margen.'
    const avisos = avisosDelReporte({
      ...base,
      atribucion: {
        reservasSinEmisora: 0,
        contratosSinEntidad: 0,
        costoOperacionSinRepartir: 10,
        costoEnergiaSinRepartir: 20,
        nota,
      },
    })
    const a = avisos.find((x) => x.clave === 'entidad-atribucion')
    expect(a?.tono).toBe('alerta')
    // Verbatim: volver a escribir la frase aqui seria la segunda
    // implementacion de la misma cosa, y divergir significaria decirle al
    // usuario que falta algo distinto de lo que falta.
    expect(a?.texto).toBe(nota)
  })

  it('es el PRIMER aviso: cambia como se lee toda la tabla', () => {
    const avisos = avisosDelReporte({
      ...base,
      atribucion: {
        reservasSinEmisora: 2,
        contratosSinEntidad: 1,
        costoOperacionSinRepartir: 10,
        costoEnergiaSinRepartir: 20,
        nota: 'nota',
      },
    })
    expect(avisos[0].clave).toBe('entidad-atribucion')
  })

  it('no sale el aviso de «sin contrato»: una razon social sin contrato es lo normal', () => {
    // El texto de ese aviso habla de pantallas sin contrato de arrendamiento.
    // Sobre una sociedad que solo vende, seria falso y alarmante.
    const avisos = avisosDelReporte({
      ...base,
      filas: [fila({ clave: 'E1', ingreso: 100, tieneContrato: false })],
      atribucion: {
        reservasSinEmisora: 0,
        contratosSinEntidad: 0,
        costoOperacionSinRepartir: 10,
        costoEnergiaSinRepartir: 20,
        nota: 'nota',
      },
    })
    expect(avisos.map((a) => a.clave)).not.toContain('sin-contrato')
  })

  it('no sale el de «sin ingreso»: una sociedad que solo paga rentas no vende, y esta bien', () => {
    const avisos = avisosDelReporte({
      ...base,
      filas: [fila({ clave: 'E2', ingreso: 0, costoEspacio: 500 })],
      atribucion: {
        reservasSinEmisora: 0,
        contratosSinEntidad: 0,
        costoOperacionSinRepartir: 10,
        costoEnergiaSinRepartir: 20,
        nota: 'nota',
      },
    })
    expect(avisos.map((a) => a.clave)).not.toContain('sin-ingreso')
  })
})

// ────────────────────────────────────────────────────────────────────────────
//  Los dos defectos que el NAVEGADOR encontró el 2026-09-18 con las 1691
//  unitarias en verde, y que estaban escritos dentro de un `.tsx` — donde
//  `vitest.config.ts` no monta jsdom y por tanto no los probaba nadie. Salen a
//  este módulo por la misma razón que salió el tono de los avisos.
// ────────────────────────────────────────────────────────────────────────────

describe('el subtitulo de la fila NO dice «sin contrato» sobre una razon social', () => {
  it('en `entidad` no dice nada del contrato', () => {
    // EL DEFECTO, visto en pantalla: «Vende publicidad · sin contrato». Una
    // sociedad que solo comercializa NO TIENE por que tener un contrato de
    // arrendamiento, asi que la frase señala un problema inexistente justo
    // debajo del nombre de la empresa.
    expect(notaDeArrendador('entidad', false, null)).toBeNull()
    expect(notaDeArrendador('entidad', true, 'Arrendador Uno')).toBeNull()
  })

  it('en `trimestre` tampoco, que ya era asi', () => {
    expect(notaDeArrendador('trimestre', false, null)).toBeNull()
  })

  it('donde la fila SI es una pantalla se conserva entero', () => {
    expect(notaDeArrendador('sitio', true, 'Arrendador Uno')).toBe('Arrendador Uno')
    expect(notaDeArrendador('sitio', false, null)).toBe('sin contrato')
    expect(notaDeArrendador('luz', false, null)).toBe('sin contrato')
  })
})

describe('el conteo de la cabecera no afirma «movimiento» donde no lo hay', () => {
  const conClave = (...claves: string[]) => claves.map((c) => fila({ clave: c }))

  it('en `entidad` NO dice «con movimiento»: sus filas salen aunque esten en cero', () => {
    // EL DEFECTO, visto en pantalla: «4 razones sociales con movimiento» con una
    // de ellas en cero de ingreso y cero de renta. La dimension las pinta todas
    // a proposito, asi que la cabecera no puede afirmar que todas se movieron.
    expect(subtituloDeConteo('entidad', conClave('E1', 'E2', 'E3'))).not.toMatch(/movimiento/)
  })

  it('y NO cuenta «Sin asignar» como una razon social', () => {
    // Es un hueco de captura, no una sociedad del cliente. Contarla inflaria
    // el numero de razones sociales que el dueño cree tener dadas de alta.
    expect(subtituloDeConteo('entidad', conClave('E1', 'E2', ''))).toBe('2 razones sociales')
  })

  it('con una sola, en singular', () => {
    expect(subtituloDeConteo('entidad', conClave('E1'))).toBe('1 razón social')
  })

  it('en las otras dimensiones sigue diciendo «con movimiento»', () => {
    expect(subtituloDeConteo('sitio', conClave('S1', 'S2'))).toBe('2 pantallas con movimiento')
    expect(subtituloDeConteo('trimestre', conClave('T1'))).toMatch(/con movimiento/)
  })
})
