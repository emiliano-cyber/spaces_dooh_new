import { describe, it, expect } from 'vitest'
import {
  descuentoDentroDelTope,
  topeDescuentoValido,
  textoBitacoraPropuesta,
  DescuentoSobreTope,
  DescuentoInvalido,
  TOPE_DESCUENTO_RESPALDO,
  descuentoDePropuestaDentroDelTope,
  mensajeTopeVigente,
  MSJ_TOPE_VIGENTE_PUBLICO,
  comercialMaximoDentroDelTope,
} from './descuento'

// ============================================================================
//  TOPE-01 · el descuento de una propuesta tiene un techo POR ORGANIZACIÓN.
// ----------------------------------------------------------------------------
//  El agujero, tal como estaba el 2026-09-28: el único límite de
//  `descuentoValido` era `Math.max(0, Math.min(100, n))`. O sea que **el 90 %
//  pasaba liso**, lo podía poner cualquier rol COMERCIAL
//  (`app/api/propuestas/[id]/route.ts:13`) y **sin la contraseña** —propuestas
//  no está entre las rutas con `exigirCambioSensible`—. El único freno era el
//  100 % exacto, y ése no lo pone la validación sino `PropuestaCeroError`, que
//  mira el TOTAL y no el porcentaje.
//
//  Dicho de otro modo: cambiar la renta de una pantalla pedía contraseña;
//  regalar el 80 % de una venta, no.
//
//  ─── Por qué el tope NO se mete dentro de `descuentoValido` ───────────────
//  Porque `descuentoValido` RECORTA (250 → 100) y el tope tiene que RECHAZAR.
//  Recortar en silencio a 40 % una propuesta que se pidió al 70 % guardaría un
//  número que nadie tecleó, sobre dinero, y con 200 OK — que es exactamente la
//  familia de fallo que este archivo persigue. Son dos verbos distintos y por
//  eso son dos funciones distintas.
//
//  ─── Y por qué el tope viaja como ARGUMENTO ───────────────────────────────
//  `lib/descuento.ts` es puro a propósito (ver su cabecera): si leyera la
//  configuración él mismo arrastraría `db.ts` y dejaría de poder probarse sin
//  Postgres. Quien lo lee CON contexto de tenant es
//  `config-repo.topeDescuentoDelTenant()`, y el aislamiento entre
//  organizaciones se demuestra en `lib/test/tope-descuento.e2e.test.ts`: aquí
//  no se puede ver, porque aquí no hay base.
// ============================================================================

describe('topeDescuentoValido — el techo que guarda la organización', () => {
  it('acepta el rango completo, incluidos los dos extremos', () => {
    expect(topeDescuentoValido(0)).toBe(0)
    expect(topeDescuentoValido(25)).toBe(25)
    expect(topeDescuentoValido(100)).toBe(100)
    // `numeric(5,2)`: el tope admite decimales, como el descuento.
    expect(topeDescuentoValido(12.5)).toBe(12.5)
    // Llega como texto desde un formulario y desde `numeric` de `pg`.
    expect(topeDescuentoValido('30')).toBe(30)
    expect(topeDescuentoValido('30.50')).toBe(30.5)
  })

  it('recorta lo que se sale del rango, en los DOS sentidos', () => {
    expect(topeDescuentoValido(250)).toBe(100)
    expect(topeDescuentoValido(-5)).toBe(0)
  })

  it('la BASURA cae al respaldo del 100 %, NUNCA a 0', () => {
    // Es la misma decisión que `PLAZOS_COBRANZA_RESPALDO` (`config-repo.ts:80`)
    // y por el mismo motivo: si una columna corrupta, una base sin la migración
    // aplicada todavía o un `null` se interpretaran como «tope 0», esa
    // organización no podría aplicar NI UN descuento y la venta se pararía
    // entera. Apagar el negocio de alguien por un dato ilegible es peor fallo
    // que el que se está corrigiendo.
    for (const basura of [null, undefined, NaN, Infinity, -Infinity, 'abc', '', {}, []]) {
      expect(topeDescuentoValido(basura as never), `respaldo para ${JSON.stringify(basura)}`)
        .toBe(TOPE_DESCUENTO_RESPALDO)
    }
    // Y el respaldo es 100, que es exactamente el comportamiento de antes de
    // que el tope existiera: una base sin migrar no cambia de conducta.
    expect(TOPE_DESCUENTO_RESPALDO).toBe(100)
  })
})

describe('descuentoDentroDelTope — el caso negativo es el corazón', () => {
  it('POR ENCIMA DEL TOPE NO SE GUARDA: revienta, no recorta', () => {
    // LA prueba de la tarea. Si esto se rompiera, el 70 % se guardaría como 40
    // (recorte) o como 70 (sin tope), y las dos cosas son dinero regalado sin
    // que nadie lo aprobara.
    //
    // ⚠️ Se comprueba el TIPO del error y no solo que reviente. Un
    // `.toThrow()` a secas lo satisface también un `TypeError: ... is not a
    // function`, así que pasaría en verde con la función sin escribir — que es
    // exactamente el falso verde que se quiere evitar aquí.
    for (const [pedido, tope] of [[70, 40], [90, 40], [80, 25], [40.01, 40]]) {
      expect(() => descuentoDentroDelTope(pedido, tope), `${pedido} sobre tope ${tope}`)
        .toThrow(DescuentoSobreTope)
      expect(() => descuentoDentroDelTope(pedido, tope), `${pedido} sobre tope ${tope}`)
        .toThrow(/autoriza tu organización/)
    }
  })

  it('EL TOPE EXACTO SÍ PASA — el límite es inclusivo', () => {
    // Mata el mutante `>` → `>=`. Un tope del 40 % significa «hasta 40», no
    // «menos de 40»: quien configura 40 espera poder cerrar una venta al 40.
    expect(descuentoDentroDelTope(40, 40)).toBe(40)
    expect(descuentoDentroDelTope(12.5, 12.5)).toBe(12.5)
  })

  it('por debajo del tope pasa, y devuelve el valor tal cual', () => {
    expect(descuentoDentroDelTope(22, 40)).toBe(22)
    expect(descuentoDentroDelTope(0, 40)).toBe(0)
    expect(descuentoDentroDelTope('22.5', 40)).toBe(22.5)
  })

  it('el mensaje DICE CUÁL ES EL TOPE, no un «valor inválido» genérico', () => {
    // Quien recibe el error tiene que poder actuar: el número que le falta es
    // el techo de su organización, no el que acaba de teclear.
    let msg = ''
    try {
      descuentoDentroDelTope(70, 40)
    } catch (e) {
      msg = e instanceof Error ? e.message : ''
    }
    expect(msg).toContain('40')
    expect(msg).toContain('70')
    // Y no es el texto genérico de `DescuentoInvalido`.
    expect(msg).not.toContain('entre 0 y 100')
  })

  it('el error lleva los dos números en el objeto, no solo en la frase', () => {
    // Para que la UI pueda pintar el tope sin parsear una cadena.
    try {
      descuentoDentroDelTope(70, 40)
      throw new Error('deberia haber reventado')
    } catch (e) {
      expect(e).toBeInstanceOf(DescuentoSobreTope)
      expect((e as DescuentoSobreTope).tope).toBe(40)
      expect((e as DescuentoSobreTope).pedido).toBe(70)
    }
  })

  it('un tope de 100 se comporta EXACTAMENTE como antes de que el tope existiera', () => {
    // Es el valor por omisión de la migración. Ninguna propuesta viva puede
    // volverse inválida por desplegar esto.
    expect(descuentoDentroDelTope(0, 100)).toBe(0)
    expect(descuentoDentroDelTope(90, 100)).toBe(90)
    expect(descuentoDentroDelTope(100, 100)).toBe(100)
    // Y el recorte de `descuentoValido` sigue vivo debajo: 250 → 100, que con
    // tope 100 pasa. Antes pasaba igual.
    expect(descuentoDentroDelTope(250, 100)).toBe(100)
  })

  it('un tope de 0 significa CERO descuentos, y eso es configurable', () => {
    expect(descuentoDentroDelTope(0, 0)).toBe(0)
    expect(() => descuentoDentroDelTope(1, 0)).toThrow(DescuentoSobreTope)
  })

  it('sigue RECHAZANDO la basura antes de mirar el tope', () => {
    // No se pierde la guarda de `descuentoValido`: `NaN` contra un tope de 100
    // no puede colarse por «NaN > 100 es false».
    // Y se exige `DescuentoInvalido`, no «algo que revienta»: con un
    // `.toThrow()` pelado este caso pasaría en verde con la función sin
    // escribir, porque `TypeError` también revienta.
    for (const basura of ['abc', '', {}, [], true, NaN, Infinity]) {
      expect(() => descuentoDentroDelTope(basura as never, 100), `basura ${JSON.stringify(basura)}`)
        .toThrow(DescuentoInvalido)
    }
  })

  it('un TOPE ilegible no bloquea la venta: cae al respaldo del 100 %', () => {
    // Si la columna viniera corrupta o la migración no estuviera aplicada, el
    // comercial tiene que poder seguir trabajando como ayer.
    expect(descuentoDentroDelTope(90, null)).toBe(90)
    expect(descuentoDentroDelTope(90, undefined)).toBe(90)
    expect(descuentoDentroDelTope(90, 'abc')).toBe(90)
  })
})

describe('textoBitacoraPropuesta — la bitácora dice CUÁNTO', () => {
  it('SOLO menciona el descuento cuando cambió de verdad', () => {
    // `null` = este guardado no tocó el descuento (se editó el nombre o las
    // notas). El texto tiene que quedarse como estaba: inventar un «puso 0 %»
    // en cada guardado llenaría Actividad de ruido y haría inútil el filtro
    // por persona, que es justo lo que se quiere poder enseñar.
    expect(textoBitacoraPropuesta(2, null)).toBe('Actualizó propuesta (v2)')
    expect(textoBitacoraPropuesta(1, null)).toBe('Actualizó propuesta (v1)')
  })

  it('dice el porcentaje, legible por alguien que no programa', () => {
    expect(textoBitacoraPropuesta(2, 22)).toBe('Puso 22 % de descuento en la propuesta (v2)')
    expect(textoBitacoraPropuesta(3, 12.5)).toBe('Puso 12.5 % de descuento en la propuesta (v3)')
  })

  it('bajar el descuento a 0 se cuenta como QUITARLO, no como «puso 0 %»', () => {
    expect(textoBitacoraPropuesta(4, 0)).toBe('Quitó el descuento de la propuesta (v4)')
  })

  it('no escribe la basura decimal del coma flotante', () => {
    // `0.1 * 3` es `0.30000000000000004` en JavaScript, y ese número puede
    // salir de dividir o multiplicar por el camino. Escribir «Puso
    // 30.000000000000004 % de descuento» en una pantalla que lee gente de
    // negocio no es un detalle estético: es lo que hace que dejen de leerla.
    //
    // La aserción es SOBRE EL TEXTO COMPLETO, no un `toContain`: con
    // `toContain('0.3')` el mutante que quita el redondeo sobrevive, porque
    // «30.000000000000004» también contiene «0.3».
    expect(textoBitacoraPropuesta(2, 0.1 * 3))
      .toBe('Puso 0.3 % de descuento en la propuesta (v2)')
    // Y un decimal legítimo NO se redondea a entero.
    expect(textoBitacoraPropuesta(2, 12.5))
      .toBe('Puso 12.5 % de descuento en la propuesta (v2)')
  })
})

describe('TOPE-03 · la cuenta del tope de UNA propuesta, la misma en las tres puertas', () => {
  const sinPaquete = { paquete_nombre: null, paquete_precio: null, codigo_descuento_pct: 0 }
  const conVolumen = [{ precio: 100_000, descuento_volumen_pct: 10 }]

  it('el volumen de las líneas cuenta: 10 % + 25 % = 32,5 % no cabe en 30', () => {
    expect(() => descuentoDePropuestaDentroDelTope(25, 30, sinPaquete, conVolumen)).toThrow(
      DescuentoSobreTope,
    )
    expect(descuentoDePropuestaDentroDelTope(20, 30, sinPaquete, conVolumen)).toBe(20)
  })

  it('con paquete vivo el volumen NO cuenta (PAQ-01)', () => {
    const paq = { paquete_nombre: 'Combo', paquete_precio: 90_000, codigo_descuento_pct: 0 }
    expect(descuentoDePropuestaDentroDelTope(25, 30, paq, conVolumen)).toBe(25)
  })

  it('el cupón no cuenta mientras CODIGO_CUENTA_CONTRA_TOPE sea false (COD-02)', () => {
    expect(
      descuentoDePropuestaDentroDelTope(30, 30, { ...sinPaquete, codigo_descuento_pct: 50 }, []),
    ).toBe(30)
  })

  it('el mensaje interno dice el descuento, el total con volumen, el tope y qué hacer', () => {
    let e: DescuentoSobreTope | null = null
    try {
      descuentoDePropuestaDentroDelTope(25, 30, sinPaquete, conVolumen)
    } catch (x) {
      e = x as DescuentoSobreTope
    }
    const m = mensajeTopeVigente(e!)
    expect(m).toContain('25 %')
    expect(m).toContain('32.5 %')
    expect(m).toContain('30 %')
    expect(m).toMatch(/Ajusta el descuento/)
  })

  it('el mensaje al CLIENTE no lleva ningún porcentaje', () => {
    expect(MSJ_TOPE_VIGENTE_PUBLICO).not.toMatch(/%/)
  })
})

// ============================================================================
//  TOPE-04 · el VOLUMEN SOLO ya pasa el tope (2026-10-05)
// ----------------------------------------------------------------------------
//  Administración baja el tope al 5 % y la escala de la organización da 10 %
//  de volumen. Hasta hoy la EDICIÓN rechazaba incluso guardar 0 % comercial
//  —`componerDescuentos(10, 0)` = 10 > 5—, mientras que aprobar, la liga y
//  quitar un paquete NO revisaban con 0 % comercial (criterio TOPE-PAQ). La
//  aprobación decía «Ajusta el descuento» y el vendedor no podía ajustarlo a
//  nada. Ahora el criterio vive en `descuentoDentroDelTope`, una sola vez.
// ============================================================================
describe('TOPE-04 · con el volumen solo por encima del tope, 0 % comercial SÍ se guarda', () => {
  const sinPaquete = { paquete_nombre: null, paquete_precio: null, codigo_descuento_pct: 0 }
  const vol10 = [{ precio: 100_000, descuento_volumen_pct: 10 }]
  const SALIDA =
    'El descuento por volumen (10 %) ya supera el tope (5 %): deja el descuento comercial ' +
    'en 0 % o pide a Administración que suba el tope.'

  it('tope 5, volumen 10, comercial 0 → se acepta (el vendedor no controla la escala)', () => {
    expect(descuentoDentroDelTope(0, 5, 10)).toBe(0)
    expect(descuentoDePropuestaDentroDelTope(0, 5, sinPaquete, vol10)).toBe(0)
  })

  it('tope 5, volumen 10, comercial 5 → SIGUE rechazando', () => {
    expect(() => descuentoDePropuestaDentroDelTope(5, 5, sinPaquete, vol10)).toThrow(
      DescuentoSobreTope,
    )
    // Y cualquier cosa por encima de 0, por pequeña que sea.
    expect(() => descuentoDentroDelTope(0.01, 5, 10)).toThrow(DescuentoSobreTope)
  })

  it('el mensaje dice la salida REAL: comercial en 0 % o subir el tope', () => {
    let e: DescuentoSobreTope | null = null
    try {
      descuentoDePropuestaDentroDelTope(5, 5, sinPaquete, vol10)
    } catch (x) {
      e = x as DescuentoSobreTope
    }
    expect(e).toBeInstanceOf(DescuentoSobreTope)
    expect(e!.message).toBe(SALIDA)
    // Y la aprobación dice lo mismo, no «Ajusta el descuento» a secas.
    const m = mensajeTopeVigente(e!)
    expect(m).toContain(SALIDA)
    expect(m).not.toMatch(/Ajusta el descuento/)
  })

  it('si el volumen cabe, el mensaje dice el MÁXIMO comercial que cabe', () => {
    // tope 20, volumen 15: 1 − 0,80 / 0,85 = 5,882… → cabe hasta 5,88 %.
    let e: DescuentoSobreTope | null = null
    try {
      descuentoDentroDelTope(10, 20, 15)
    } catch (x) {
      e = x as DescuentoSobreTope
    }
    expect(e!.message).toMatch(/hasta 5\.88 % comercial/)
    expect(mensajeTopeVigente(e!)).toMatch(/hasta 5\.88 % comercial/)
    // Sin volumen el máximo es el tope mismo.
    expect(() => descuentoDentroDelTope(70, 40)).toThrow(/hasta 40 % comercial/)
  })

  it('el máximo anunciado CABE de verdad, y una centésima más ya no', () => {
    for (const [tope, vol] of [[20, 15], [30, 10], [40, 0], [5, 4.99], [100, 50], [12.5, 3]]) {
      const m = comercialMaximoDentroDelTope(tope, vol)
      expect(descuentoDentroDelTope(m, tope, vol)).toBe(m)
      if (m < 100) expect(() => descuentoDentroDelTope(m + 0.01, tope, vol)).toThrow(DescuentoSobreTope)
    }
    // Con el volumen por encima no cabe nada: 0.
    expect(comercialMaximoDentroDelTope(5, 10)).toBe(0)
  })
})
