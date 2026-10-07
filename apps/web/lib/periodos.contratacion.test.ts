import { describe, it, expect } from 'vitest'
import {
  resumenContratacion,
  etiquetaFrecuencia,
  etiquetaCantidad,
  resumenReserva,
} from './periodos'

// ============================================================================
//  Que se vea QUÉ se vendió, no solo CUÁNTO.
// ----------------------------------------------------------------------------
//  Se pueden vender 50 spots: en Propuestas eliges «Por spot», tecleas 50 y el
//  precio sale `tarifa_spot × 50`. El 50 llega a `propuesta_items` y a
//  `reservas`… y no se ve en ninguna pantalla posterior. El detalle de la
//  propuesta muestra sitio, renta y precio; la lectura de la reserva ni siquiera
//  exponía los campos. El importe sin su unidad no dice nada: «$60,000» puede
//  ser un mes o cincuenta spots.
//
//  ─── EL MATIZ QUE YA COSTÓ UN DEFECTO, y es el corazón de estas pruebas ──
//
//  `cantidad` y `spots_por_dia` son DOS NÚMEROS DISTINTOS:
//
//    · `cantidad`      → cuántas unidades se contratan. Es lo que multiplica la
//                        tarifa: 50 spots × $1,200 = $60,000. Es PRECIO.
//    · `spots_por_dia` → cuántas veces al día se muestra la pieza. Es
//                        PROGRAMACIÓN, y no entra en ningún precio.
//
//  Confundirlos fue el defecto DATA-02 (auditoría del 26/08): se escribía el
//  mismo valor en las dos columnas, así que una propuesta mensual normal dejaba
//  `spots_reservados` en null y `reparto-creativos.ts:51-68` leía ese null como
//  «es una lona» — una pantalla digital repartida como si fuera impresa. El
//  arreglo vive en `campanas-repo.ts:712-718`.
//
//  Por eso son DOS funciones con DOS vocabularios que no se parecen: una dice
//  «spots» y la otra «pases al día». Un usuario que vea «50 spots · 12 pases al
//  día» no puede confundirlos; con «50 spots · 12 spots» sí.
//
//  Y están aquí, en un módulo PURO, y no dentro de un `.tsx`: `vitest.config.ts`
//  no monta jsdom a propósito, así que una decisión escrita en un componente no
//  la prueba nadie — la misma lección que sacó `components/demo/reportes/tabla.ts`.
// ============================================================================

describe('resumenContratacion — el QUÉ junto al CUÁNTO', () => {
  it('50 spots se leen como 50 spots por su tarifa', () => {
    expect(
      resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 1200 }),
    ).toBe('50 salidas × $ 1,200.00')
  })

  it('concuerda el singular, que es donde ya se escribió «2 mess»', () => {
    // `unidadCorta` existe justo por esto (M10 de la auditoría del 04/08): en
    // español «mes» pluraliza en «meses», no en «mess».
    expect(resumenContratacion({ unidad: 'spot', cantidad: 1, tarifaUnitaria: 1200 })).toBe('1 salida × $ 1,200.00')
    expect(resumenContratacion({ unidad: 'mensual', cantidad: 1, tarifaUnitaria: 9000 })).toBe('1 mes × $ 9,000.00')
    expect(resumenContratacion({ unidad: 'mensual', cantidad: 3, tarifaUnitaria: 9000 })).toBe('3 meses × $ 9,000.00')
  })

  // CPS-CPM (07/10): «spot» se lee «salidas» (CPS) y entra CPM, en millares.
  it('las siete unidades tienen nombre propio; ninguna sale con su clave cruda', () => {
    const vistos = (['mensual', 'catorcenal', 'semanal', 'diaria', 'spot', 'hora', 'cpm'] as const).map(
      (u) => resumenContratacion({ unidad: u, cantidad: 2, tarifaUnitaria: 100 }),
    )
    expect(vistos).toEqual([
      '2 meses × $ 100.00',
      '2 catorcenas × $ 100.00',
      '2 semanas × $ 100.00',
      '2 días × $ 100.00',
      '2 salidas × $ 100.00',
      '2 horas × $ 100.00',
      '2 millares × $ 100.00',
    ])
  })

  it('NEGATIVA · `spotsPorDia` NO entra en el resumen del precio', () => {
    // El defecto DATA-02, escrito como prueba: si el resumen leyera la
    // programación, «50 spots» se convertiría en «12 spots» y el importe dejaría
    // de cuadrar con la multiplicación que lo produjo.
    const r = resumenContratacion({
      unidad: 'spot',
      cantidad: 50,
      tarifaUnitaria: 1200,
      // @ts-expect-error la programación NO es un parámetro de esta función, y
      // que el typecheck lo diga es la mitad del guard.
      spotsPorDia: 12,
    })
    expect(r).toBe('50 salidas × $ 1,200.00')
    expect(r).not.toContain('12')
  })

  it('NEGATIVA · sin tarifa unitaria no se inventa un «× $ 0.00»', () => {
    // Un «× $ 0.00» afirma que la unidad es gratis. Los ítems anteriores al
    // 21/07 pueden traer `tarifa_unitaria` en 0 (el backfill solo rellenó los
    // que tenían precio), así que este caso existe en datos reales.
    expect(resumenContratacion({ unidad: 'spot', cantidad: 50, tarifaUnitaria: 0 })).toBe('50 salidas')
    expect(resumenContratacion({ unidad: 'mensual', cantidad: 2, tarifaUnitaria: null })).toBe('2 meses')
  })

  it('NEGATIVA · una unidad desconocida no rompe la fila', () => {
    // `reservas.unidad` es `text` sin CHECK: un valor viejo o importado no puede
    // tumbar el detalle de una campaña.
    expect(resumenContratacion({ unidad: 'quincenal', cantidad: 2, tarifaUnitaria: 100 })).toBe(
      '2 quincenal × $ 100.00',
    )
  })

  it('etiquetaCantidad da el QUÉ sin el precio, para donde no cabe el importe', () => {
    expect(etiquetaCantidad('spot', 50)).toBe('50 salidas')
    expect(etiquetaCantidad('mensual', 1)).toBe('1 mes')
  })
})

describe('resumenReserva — en la campaña la multiplicación YA NO CUADRA', () => {
  it('NEGATIVA · no escribe la multiplicación, porque en una reserva es falsa', () => {
    // Y este es el matiz que separa las dos funciones. En `propuesta_items`,
    // `precio = tarifa_unitaria × cantidad` (`lib/periodos.ts` → `precioItem`),
    // así que «50 spots × $ 1,200.00» cuadra con el importe de al lado.
    //
    // En `reservas` NO: la reserva nacida de una propuesta guarda el NETO
    // —`lista × (1−descuento) × (1−comisión)`, ver la inserción desde propuesta
    // en `campanas-repo.ts`— mientras `tarifa_unitaria` se copia tal cual de la
    // propuesta, que es la de LISTA. Escribir ahí «50 spots × $ 1,200.00» al
    // lado de «$ 54,000.00» enseñaría una multiplicación que no da, y se leería
    // como un defecto del sistema cuando es el descuento haciendo su trabajo.
    const r = resumenReserva({ unidad: 'spot', cantidad: 50, precio: 54_000 })
    expect(r).toBe('50 salidas · $ 54,000.00')
    expect(r).not.toContain('×')
  })

  it('NEGATIVA · una reserva mensual ya no dice «/mes» a ciegas', () => {
    // La ficha de campaña pintaba `{precio}/mes` para TODA reserva, incluidas
    // las vendidas por spot: un sufijo fijo sobre un campo variable.
    expect(resumenReserva({ unidad: 'mensual', cantidad: 3, precio: 27_000 })).toBe(
      '3 meses · $ 27,000.00',
    )
    expect(resumenReserva({ unidad: 'spot', cantidad: 50, precio: 54_000 })).not.toContain('/mes')
  })
})

describe('etiquetaFrecuencia — la programación, con OTRO vocabulario', () => {
  it('se lee como pases al día, no como spots', () => {
    // Deliberadamente NO dice «spots»: es lo único que impide que «50 spots» y
    // «12 spots» convivan en la misma ficha significando cosas distintas.
    expect(etiquetaFrecuencia(12)).toBe('12 pases al día')
    expect(etiquetaFrecuencia(1)).toBe('1 pase al día')
    expect(etiquetaFrecuencia(12)).not.toMatch(/spot/i)
  })

  it('NEGATIVA · sin programación capturada no se pinta nada', () => {
    // `spots_por_dia` está en NULL en toda la producción de hoy. Un «0 pases al
    // día» afirmaría que la pieza no sale nunca, que es lo contrario de «no se
    // capturó».
    expect(etiquetaFrecuencia(null)).toBeNull()
    expect(etiquetaFrecuencia(undefined)).toBeNull()
    expect(etiquetaFrecuencia(0)).toBeNull()
  })
})
