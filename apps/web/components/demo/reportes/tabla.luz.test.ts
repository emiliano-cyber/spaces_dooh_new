import { describe, it, expect } from 'vitest'
import {
  COLUMNAS,
  COLUMNAS_DESGLOSE,
  avisosDelReporte,
  columnasDeDimension,
  formatoCelda,
  ordenInicialDe,
  type FilaOrdenable,
} from './tabla'
import { DIMENSIONES_UI, cuenta, sustantivoFila } from './consulta'

// ============================================================================
//  La dimensión `luz` en la tabla, y el costo de la energía en TODAS.
// ----------------------------------------------------------------------------
//  Dos cosas distintas, y conviene no confundirlas:
//
//   1. **`costoEnergia` es una columna COMÚN**, como el costo del espacio y el
//      de operación. Entra en `costoTotal` y en el margen de toda dimensión, así
//      que si no se pintara, la tabla enseñaría `Espacio + Operación` y un
//      `Costo total` MAYOR que su suma — una resta que no cuadra, sin dar
//      ningún error. Es el peor defecto posible en una tabla de dinero.
//   2. **`kwh` y `costoPorKwh` son columnas PROPIAS de `luz`**, como las visitas
//      lo son de `operacion`. Son campos opcionales de `FilaRentabilidad`, y un
//      campo opcional que nadie lee no da error de tipos ni de ejecución: da una
//      tabla que calcula bien y no contesta su propia pregunta. Ese defecto ya
//      pasó el 2026-09-18 con `operacion` y `m2`, y solo lo vio un navegador.
// ============================================================================

const HOY = new Date(2026, 8, 18)
const CERRADO = { desde: '2026-04-01', hasta: '2026-06-30', hoy: HOY }

function fila(p: Partial<FilaOrdenable> & { clave: string }): FilaOrdenable {
  return {
    etiqueta: p.clave,
    ingreso: 0,
    costoEspacio: 0,
    costoOperacion: 0,
    costoEnergia: 0,
    costoTotal: 0,
    margen: 0,
    margenPct: null,
    tieneContrato: true,
    visitas: 0,
    ...p,
  }
}

describe('1 · `luz` esta en el selector y sus filas son pantallas', () => {
  it('el selector ofrece «por consumo de luz»', () => {
    const luz = DIMENSIONES_UI.find((d) => d.valor === 'luz')
    expect(luz, 'la dimension luz no esta en el selector').toBeTruthy()
    expect(luz!.label).toMatch(/luz|energ/i)
  })

  it('NINGUNA dimension se ofrece «en preparacion»', () => {
    // La etiqueta «(en preparación)» sobrevivió a la ola 2 sobre tres
    // dimensiones que ya calculaban: el selector mentía sobre su propia
    // aplicación y no lo vio nada automático, porque una etiqueta de más no
    // rompe ninguna prueba. `luz` no puede repetirlo.
    for (const d of DIMENSIONES_UI) {
      expect(d.label, d.valor).not.toMatch(/preparaci|pr[oó]ximamente|pendiente/i)
      expect(d.ayuda, d.valor).not.toMatch(/preparaci|pr[oó]ximamente/i)
    }
  })

  it('sus filas son PANTALLAS, y el sustantivo lo dice', () => {
    // El sustantivo se declara una vez y lo leen la cabecera, la tabla y los
    // avisos: «4 pantallas con movimiento» decía «4 pantallas» en trimestral,
    // donde las filas son trimestres.
    expect(sustantivoFila('luz')).toEqual({ singular: 'pantalla', plural: 'pantallas' })
    expect(cuenta(1, 'luz')).toBe('1 pantalla')
    expect(cuenta(3, 'luz')).toBe('3 pantallas')
  })

  it('la primera columna se llama «Pantalla»', () => {
    expect(columnasDeDimension('luz')[0].label).toMatch(/pantalla/i)
  })
})

describe('2 · el costo de la ENERGIA se pinta en TODAS las dimensiones', () => {
  it('`costoEnergia` es una columna comun, no propia de `luz`', () => {
    // EL DEFECTO QUE ESTO IMPIDE: con la energía dentro de `costoTotal` pero
    // sin columna, la tabla de `sitio` enseñaría Espacio 6 000 + Operación 0 y
    // un Costo total de 8 000. Una tabla de dinero cuyas columnas no suman su
    // propio total es peor que una tabla sin total.
    for (const d of DIMENSIONES_UI) {
      expect(columnasDeDimension(d.valor).map((c) => c.clave), d.valor).toContain('costoEnergia')
    }
  })

  it('va junto a las otras dos fuentes de costo', () => {
    // Las tres que suman el costo total, seguidas: quien lee la tabla tiene que
    // poder sumarlas con el ojo.
    const claves = columnasDeDimension('sitio').map((c) => c.clave)
    const i = claves.indexOf('costoEspacio')
    expect(claves.slice(i, i + 3)).toEqual(['costoEspacio', 'costoOperacion', 'costoEnergia'])
  })

  it('el pie la TOTALIZA, porque el servidor la trae en `totales`', () => {
    const col = COLUMNAS.find((c) => c.clave === 'costoEnergia')!
    expect(col.totalizable, 'sin total en el pie, el pie no cuadra con la tabla').toBe(true)
    expect(col.formato).toBe('dinero')
  })

  it('el desglose por periodo tambien la trae', () => {
    // `periodos[]` se despliega por fila con el ingreso, el espacio, la
    // operación y el margen de cada bucket. Sin la energía, el margen del bucket
    // no se podría reconstruir de sus columnas.
    expect(COLUMNAS_DESGLOSE.map((c) => c.clave)).toContain('costoEnergia')
  })
})

describe('3 · las columnas PROPIAS de `luz`', () => {
  it('trae los kWh y el costo por kWh', () => {
    // EL DEFECTO: son campos opcionales de `FilaRentabilidad`. Si no se leen, el
    // reporte «por consumo de luz» calcula perfectamente y no enseña ni un kWh,
    // que es justo lo que lo hace «por consumo de luz».
    const claves = columnasDeDimension('luz').map((c) => c.clave)
    expect(claves).toContain('kwh')
    expect(claves).toContain('costoPorKwh')
  })

  it('NEGATIVO: las otras dimensiones NO traen kWh', () => {
    // El motor no manda `kwh` fuera de `luz`, así que la columna saldría vacía
    // en todas las filas — y una columna en blanco se lee como un dato que
    // falta, no como uno que no aplica.
    for (const d of ['sitio', 'trimestre', 'operacion', 'm2'] as const) {
      const claves = columnasDeDimension(d).map((c) => c.clave)
      expect(claves, d).not.toContain('kwh')
      expect(claves, d).not.toContain('costoPorKwh')
    }
  })

  it('NEGATIVO: `luz` no trae las columnas de otra dimension', () => {
    const claves = columnasDeDimension('luz').map((c) => c.clave)
    for (const ajena of ['visitas', 'costoOperacionPct', 'horasEnSitio', 'm2', 'ingresoPorM2', 'margenPorM2']) {
      expect(claves, ajena).not.toContain(ajena)
    }
  })

  it('los kWh NO se totalizan en el pie, igual que la superficie', () => {
    // El pie solo totaliza lo que `Totales` trae del SERVIDOR: dos sumas de lo
    // mismo divergen, y la del servidor es la que cuadra con el desglose. Los
    // kWh son una magnitud de la dimensión, no del reporte — mismo trato que
    // `m2`. Y `costoPorKwh` es un COCIENTE: el promedio de los cocientes de las
    // filas no es el cociente del total, porque cada pantalla consume otra
    // cantidad. Sería una cifra que no es de nadie.
    expect(COLUMNAS.find((c) => c.clave === 'kwh')!.totalizable).toBe(false)
    expect(COLUMNAS.find((c) => c.clave === 'costoPorKwh')!.totalizable).toBe(false)
  })

  it('abre ordenada por MAS CONSUMO, y es el orden del motor', () => {
    // Si la tabla reordenara al recibir, discutiría con el servidor sobre la
    // misma pregunta. Y no es «peor margen»: una pantalla con margen horrible
    // por una renta cara no es un problema de luz, y saldría arriba tapando las
    // que sí lo son. Mismo razonamiento que `operacion`.
    expect(ordenInicialDe('luz')).toEqual({ columna: 'costoEnergia', direccion: 'desc' })
  })

  it('los kWh se pintan con su unidad, y el cero SI se pinta', () => {
    // «1,500» a secas no dice kWh, y esta columna convive con cinco de pesos.
    // Y un consumo de cero kWh capturado es un HECHO medido —un medidor que no
    // giró—, así que el cero es la verdad: la raya es para el dato que falta.
    expect(formatoCelda(1500, 'kwh')).toMatch(/1,500/)
    expect(formatoCelda(1500, 'kwh')).toMatch(/kWh/)
    expect(formatoCelda(0, 'kwh')).toMatch(/^0\b/)
    expect(formatoCelda(null, 'kwh')).toBe('—')
  })
})

describe('4 · LO QUE FALTA se dice ENCIMA de la tabla', () => {
  const filasLuz = [fila({ clave: 's1', costoEnergia: 3000, costoTotal: 3000, margen: -3000 })]

  function avisos(cobertura: unknown) {
    return avisosDelReporte({
      ...CERRADO,
      dimension: 'luz',
      filas: filasLuz,
      cobertura: cobertura as never,
    })
  }

  it('la nota del motor se pinta VERBATIM, no se vuelve a redactar', () => {
    // Igual que `notaDeExclusiones` en `m2`. Volver a escribirla aquí sería la
    // segunda implementación de la misma frase —el error de raíz de este repo
    // (`lib/server/tenant.ts:87-89`)—, y divergir significaría decirle al
    // usuario que falta otra cosa de la que falta.
    const nota = 'Faltan 2 de 3 recibos del periodo, asi que el costo de la luz sale INCOMPLETO.'
    const a = avisos({ faltantes: 2, esperados: 3, recibosSinDestino: 0, importeSinDestino: 0, nota })
    expect(a.map((x) => x.texto)).toContain(nota)
  })

  it('con TODOS los recibos capturados se dice IGUAL, no se calla', () => {
    // «No falta ninguno» y «no te lo digo» se ven idénticos si no hay texto. Es
    // el hallazgo C1 de la auditoría QA: el silencio indistinguible de la
    // ausencia. Mismo criterio que las exclusiones del m².
    const nota = 'No falta ningun recibo del periodo.'
    const a = avisos({ faltantes: 0, esperados: 3, recibosSinDestino: 0, importeSinDestino: 0, nota })
    expect(a.map((x) => x.texto)).toContain(nota)
  })

  it('el aviso de recibos que FALTAN va en AMBAR, y antes que la tabla', () => {
    // No es el mismo tipo de frase que «esta pantalla no tiene contrato»: ese
    // cuenta lo que el reporte no mide, y este dice que **las cifras que se
    // están viendo no son el total**. Un reporte de energía que suma solo lo
    // capturado y lo presenta como el total miente sin dar error.
    const a = avisos({ faltantes: 2, esperados: 3, recibosSinDestino: 0, importeSinDestino: 0, nota: 'x' })
    const aviso = a.find((x) => x.clave === 'luz-sin-recibo')
    expect(aviso, 'sin aviso de recibos que faltan').toBeTruthy()
    expect(aviso!.tono, 'un dato que falta en un reporte de dinero no es una «i» gris').toBe('alerta')
  })

  it('con cobertura COMPLETA el aviso deja de ser una alerta', () => {
    // La condición vale tanto como el aviso: uno que saliera siempre en ámbar
    // no lo leería nadie — la lección del ámbar que dejó de avisar por salir en
    // todo. Se sigue diciendo, pero en gris.
    const a = avisos({ faltantes: 0, esperados: 3, recibosSinDestino: 0, importeSinDestino: 0, nota: 'x' })
    expect(a.find((x) => x.clave === 'luz-sin-recibo')!.tono).toBe('info')
  })

  it('NEGATIVO: fuera de `luz` no aparece ningun aviso de recibos', () => {
    // El motor no manda `cobertura` fuera de `luz`. Un aviso de recibos encima
    // de un reporte por pantalla afirmaría que falta un dato que ese reporte no
    // usa.
    for (const d of ['sitio', 'trimestre', 'operacion', 'm2'] as const) {
      const a = avisosDelReporte({ ...CERRADO, dimension: d, filas: filasLuz })
      expect(a.map((x) => x.clave), d).not.toContain('luz-sin-recibo')
    }
  })

  it('el aviso esta escrito en lenguaje de NEGOCIO', () => {
    // Quien lo lee vende publicidad. La nota la redacta el motor, así que lo que
    // se vigila aquí es que la pantalla no le añada jerga por su cuenta.
    const a = avisos({ faltantes: 2, esperados: 3, recibosSinDestino: 1, importeSinDestino: 777, nota: 'x' })
    for (const x of a) {
      expect(x.texto, x.clave).not.toMatch(
        /consumos_energia|predio_id|sitio_id|tenant|null|undefined|kwh_|_id\b/i,
      )
    }
  })
})
