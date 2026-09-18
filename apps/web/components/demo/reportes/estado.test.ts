import { describe, it, expect } from 'vitest'
import { estadoDeReporte, debePedir, type EntradaEstado } from './estado'

// ============================================================================
//  La maquina de estados de la pantalla de reportes.
// ----------------------------------------------------------------------------
//  Tiene SEIS salidas. Tuvo siete: hubo una —`sin-motor`, el 501— que existia
//  porque tres de las cuatro dimensiones no tenian motor. Desde el 2026-09-18
//  las cuatro calculan y ese camino es INALCANZABLE, asi que se retiro; la
//  medicion que lo autoriza esta en el primer bloque.
//
//  Escrita dentro del `.tsx` no la probaria nadie (vitest no monta jsdom), y
//  sus dos modos de fallo son silenciosos: un spinner que no termina nunca, y
//  un «no hay datos» puesto sobre un fallo de red.
// ============================================================================

const listo: EntradaEstado = {
  motivoInvalido: null,
  cargando: false,
  respuesta: { status: 200, mensaje: null, filas: 4 },
}

describe('1 · el camino del 501 se RETIRO, y esta MEDIDO antes de borrarlo', () => {
  it('la fase `sin-motor` ya no existe', () => {
    // La medicion, hecha el 2026-09-18 ANTES de borrar el camino, porque
    // borrar un manejo de error que si puede ocurrir es peor que dejarlo:
    //
    //  · `grep -rn "status: 501|, 501)|501 }"` sobre `apps/web/lib` y
    //    `apps/web/app` (sin pruebas): CERO lineas.
    //  · `MOTORES` en `reportes-controller.ts:114` es un `Record` EXHAUSTIVO
    //    sobre el enum de dimensiones, asi que una dimension declarada sin
    //    motor NO COMPILA. Lo que el tipo garantiza no necesita un error en
    //    tiempo de ejecucion.
    //  · los demas caminos de error del endpoint estan enumerados: `AppError`
    //    (400 por omision), zod (400, o el status que pida el issue), los
    //    codigos de Postgres de `errores.ts:105-114` (400/403/409), el 500 de
    //    respaldo y el 401/403 de `exigir`. Ninguno devuelve 501.
    for (const filas of [0, 7]) {
      const e = estadoDeReporte({ ...listo, respuesta: { status: 501, mensaje: null, filas } })
      expect(e.fase, `filas ${filas}`).not.toBe('sin-motor')
    }
  })

  it('un 501 que llegara de todos modos es ERROR, y jamas `vacio`', () => {
    // Ya no podria venir de una dimension sin motor: seria un intermediario
    // —nginx, un proxy— diciendo que no implementa el metodo, y eso SI es un
    // fallo que hay que ver. Lo que no puede pasar nunca es que caiga en
    // `vacio`: cero filas encima de un 501 afirmaria que no hubo movimiento.
    const e = estadoDeReporte({ ...listo, respuesta: { status: 501, mensaje: null, filas: 0 } })
    expect(e.fase).toBe('error')
    expect(e.fase).not.toBe('vacio')
    expect((e.mensaje ?? '').length).toBeGreaterThan(10)
  })

  it('la fase ya no depende de la dimension', () => {
    // `dimension` salio de `EntradaEstado` con el 501: era su unico uso. Un
    // campo de entrada que nadie lee es lo primero que se queda desfasado.
    expect(Object.keys(listo)).not.toContain('dimension')
  })
})

describe('2 · nunca un spinner infinito', () => {
  it('con una respuesta ya recibida la fase JAMAS es `cargando`', () => {
    // El modo de fallo que este arnes existe para impedir. Se barre la matriz
    // entera en vez de un caso: el defecto aparece en la combinacion que nadie
    // escribio a mano.
    for (const status of [0, 200, 302, 400, 401, 403, 404, 500, 501]) {
      for (const filas of [0, 1, 250]) {
        for (const mensaje of [null, 'algo paso']) {
          const e = estadoDeReporte({ ...listo, cargando: false, respuesta: { status, mensaje, filas } })
          expect(e.fase, `status ${status} filas ${filas}`).not.toBe('cargando')
        }
      }
    }
  })

  it('mientras pide, `cargando`', () => {
    expect(estadoDeReporte({ ...listo, cargando: true, respuesta: null }).fase).toBe('cargando')
  })

  it('y al repetir la consulta sigue `cargando` aunque haya datos viejos en pantalla', () => {
    expect(estadoDeReporte({ ...listo, cargando: true }).fase).toBe('cargando')
  })
})

describe('3 · el rango invalido corta antes de pedir', () => {
  it('con motivo invalido la fase es `invalido` y arrastra el motivo', () => {
    const e = estadoDeReporte({ ...listo, motivoInvalido: 'La fecha de fin no puede ser anterior a la de inicio' })
    expect(e.fase).toBe('invalido')
    expect(e.mensaje).toMatch(/anterior/)
  })

  it('y manda incluso sobre `cargando`: no se pide un rango que se sabe malo', () => {
    const e = estadoDeReporte({ ...listo, cargando: true, motivoInvalido: 'Usa fechas con formato AAAA-MM-DD' })
    expect(e.fase).toBe('invalido')
  })

  it('debePedir es false con un rango invalido y true con uno bueno', () => {
    expect(debePedir({ dimension: 'sitio', granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31' })).toBe(true)
    expect(debePedir({ dimension: 'sitio', granularidad: 'mes', desde: '2026-03-31', hasta: '2026-01-01' })).toBe(false)
  })

  it('y pide las CUATRO dimensiones: solo el rango decide si se pide', () => {
    // Lo unico que corta es un rango que no se puede mandar. La dimension no
    // entra en la decision, y por eso el dia que se añada una quinta esta
    // pantalla no se toca.
    for (const dimension of ['sitio', 'trimestre', 'operacion', 'm2'] as const) {
      expect(debePedir({ dimension, granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31' }), dimension).toBe(
        true,
      )
    }
  })
})

describe('4 · cero filas no es un error, y un error no es cero filas', () => {
  it('200 con cero filas es `vacio`', () => {
    // Una pantalla sin ingreso, sin renta y sin OT en el rango no aparece, asi
    // que un rango sin movimiento da cero filas y no un error.
    expect(estadoDeReporte({ ...listo, respuesta: { status: 200, mensaje: null, filas: 0 } }).fase).toBe('vacio')
  })

  it('200 con filas es `datos`', () => {
    expect(estadoDeReporte(listo).fase).toBe('datos')
  })

  it('un 403 es `error` con el mensaje del servidor, no un «no hay datos»', () => {
    const e = estadoDeReporte({ ...listo, respuesta: { status: 403, mensaje: 'Sin permiso para finanzas', filas: 0 } })
    expect(e.fase).toBe('error')
    expect(e.mensaje).toBe('Sin permiso para finanzas')
  })

  it('una peticion que NO LLEGO (status 0) es `error`, jamas `vacio`', () => {
    // Aparecio al cablear la pantalla: un fallo de red no trae status HTTP, y
    // el `fetch` revienta antes de que haya cuerpo. Con el corte escrito como
    // `status >= 400`, ese caso caia por debajo y con cero filas se pintaba
    // «no hubo movimiento en el rango» — una afirmacion FALSA sobre el
    // negocio puesta encima de un cable desconectado. Es el mismo defecto que
    // el hallazgo C1 de la auditoria QA: el sistema vacio indistinguible del
    // sistema no cargado.
    const e = estadoDeReporte({ ...listo, respuesta: { status: 0, mensaje: 'No se pudo contactar al servidor', filas: 0 } })
    expect(e.fase).toBe('error')
    expect(e.mensaje).toContain('servidor')
  })

  it('un 3xx tampoco es un exito: solo el 2xx trae reporte', () => {
    expect(estadoDeReporte({ ...listo, respuesta: { status: 302, mensaje: null, filas: 0 } }).fase).toBe('error')
  })

  it('un error sin mensaje trae uno honesto, nunca vacio', () => {
    const e = estadoDeReporte({ ...listo, respuesta: { status: 500, mensaje: null, filas: 0 } })
    expect(e.fase).toBe('error')
    expect((e.mensaje ?? '').length).toBeGreaterThan(10)
  })

  it('sin haber pedido nada todavia, `inicial`', () => {
    expect(estadoDeReporte({ ...listo, cargando: false, respuesta: null }).fase).toBe('inicial')
  })
})
