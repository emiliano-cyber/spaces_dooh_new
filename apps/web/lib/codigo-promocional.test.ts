import { describe, it, expect } from 'vitest'
import {
  normalizarCodigo,
  motivoCodigoInvalido,
  motivoCanjeImposible,
  estadoDelCodigo,
  montoDescuentoCodigo,
  SIN_CODIGO,
  type CodigoPromocional,
} from './codigo-promocional'

// ============================================================================
//  COD-01 · las reglas del código promocional, probadas sin base de datos.
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  Este archivo prueba el MÓDULO PURO. Lo que NO puede probar —y por eso hay
//  e2e— es que la vigencia y el tope de usos los decida de verdad el servidor:
//  eso se demuestra contra Postgres, con dos conexiones a la vez.
// ============================================================================

const CUPON: CodigoPromocional = {
  codigo: 'VERANO20',
  descuentoPct: 20,
  vigenteDesde: '2026-09-01',
  vigenteHasta: '2026-09-30',
  usosMaximos: 100,
}

describe('1 · normalizarCodigo — el mismo cupón se teclea de siete maneras', () => {
  it('recorta los espacios y sube a mayúsculas', () => {
    expect(normalizarCodigo('  verano20 ')).toBe('VERANO20')
  })

  it('un código no tecleable se normaliza a cadena vacía, nunca a "UNDEFINED"', () => {
    // `String(undefined).toUpperCase()` daría 'UNDEFINED', que es un código
    // perfectamente buscable — y el día que alguien cree ese cupón, una
    // petición sin código canjearía uno.
    expect(normalizarCodigo(undefined)).toBe('')
    expect(normalizarCodigo(null)).toBe('')
    expect(normalizarCodigo(42)).toBe('')
    expect(normalizarCodigo({})).toBe('')
    expect(normalizarCodigo('   ')).toBe('')
  })

  it('los espacios interiores NO se borran: se rechazan en la captura', () => {
    // Borrarlos convertiría «VERANO 20» en «VERANO20» al canjear y NO al
    // capturar, así que el dueño creería que creó un cupón con espacio.
    expect(normalizarCodigo(' verano 20 ')).toBe('VERANO 20')
  })
})

describe('2 · motivoCodigoInvalido — lo que NO se puede capturar', () => {
  it('un cupón bien formado se puede guardar', () => {
    expect(motivoCodigoInvalido(CUPON, [])).toBeNull()
  })

  it('sin código, no hay cupón', () => {
    expect(motivoCodigoInvalido({ ...CUPON, codigo: '  ' }, [])).toMatch(/codigo/i)
  })

  it('el formato admite letras, números y guiones; nada más', () => {
    expect(motivoCodigoInvalido({ ...CUPON, codigo: 'VERANO 20' }, [])).toMatch(/letras/i)
    expect(motivoCodigoInvalido({ ...CUPON, codigo: 'VER;DROP' }, [])).toMatch(/letras/i)
    expect(motivoCodigoInvalido({ ...CUPON, codigo: 'AB' }, [])).toMatch(/letras/i)
    expect(motivoCodigoInvalido({ ...CUPON, codigo: 'A'.repeat(33) }, [])).toMatch(/letras/i)
    expect(motivoCodigoInvalido({ ...CUPON, codigo: 'VERANO-20' }, [])).toBeNull()
  })

  it('un cupón al 0 % es una regla que no hace nada y hace creer que sí', () => {
    expect(motivoCodigoInvalido({ ...CUPON, descuentoPct: 0 }, [])).toMatch(/mayor que 0/i)
    expect(motivoCodigoInvalido({ ...CUPON, descuentoPct: -5 }, [])).toMatch(/mayor que 0/i)
    expect(motivoCodigoInvalido({ ...CUPON, descuentoPct: 101 }, [])).toMatch(/100/)
    expect(motivoCodigoInvalido({ ...CUPON, descuentoPct: NaN }, [])).toMatch(/numero/i)
    expect(motivoCodigoInvalido({ ...CUPON, descuentoPct: 100 }, [])).toBeNull()
  })

  it('la vigencia necesita las dos fechas, en orden y con forma de fecha', () => {
    expect(motivoCodigoInvalido({ ...CUPON, vigenteDesde: '' }, [])).toMatch(/fecha/i)
    expect(motivoCodigoInvalido({ ...CUPON, vigenteHasta: '' }, [])).toMatch(/fecha/i)
    expect(motivoCodigoInvalido({ ...CUPON, vigenteHasta: '30/09/2026' }, [])).toMatch(/fecha/i)
    expect(motivoCodigoInvalido({ ...CUPON, vigenteHasta: '2026-08-31' }, [])).toMatch(
      /anterior a la de inicio/i,
    )
    // Un solo día es una vigencia válida: los cupones de un evento existen.
    expect(
      motivoCodigoInvalido({ ...CUPON, vigenteDesde: '2026-09-01', vigenteHasta: '2026-09-01' }, []),
    ).toBeNull()
  })

  it('UNA FECHA QUE NO EXISTE EN EL CALENDARIO se rechaza, no se corre', () => {
    // Nació del mutante M05. `2026-02-30` tiene la FORMA de una fecha, y
    // `new Date('2026-02-30')` la acepta devolviendo el 2 de MARZO sin quejarse
    // de nada. Sin esta comprobación el dueño capturaría una vigencia y el
    // sistema usaría otra — dos días de promoción que nadie autorizó, y
    // ningún error por ninguna parte.
    expect(motivoCodigoInvalido({ ...CUPON, vigenteHasta: '2026-02-30' }, [])).toMatch(/fecha/i)
    expect(motivoCodigoInvalido({ ...CUPON, vigenteDesde: '2026-13-01' }, [])).toMatch(/fecha/i)
    expect(motivoCodigoInvalido({ ...CUPON, vigenteHasta: '2026-09-31' }, [])).toMatch(/fecha/i)
    // Y el 29 de febrero de un año bisiesto SÍ existe: no se rechaza de más.
    expect(
      motivoCodigoInvalido({ ...CUPON, vigenteDesde: '2028-02-29', vigenteHasta: '2028-03-01' }, []),
    ).toBeNull()
  })

  it('el tope de usos es un entero >= 1, o "sin tope" (null)', () => {
    expect(motivoCodigoInvalido({ ...CUPON, usosMaximos: 0 }, [])).toMatch(/al menos una vez/i)
    expect(motivoCodigoInvalido({ ...CUPON, usosMaximos: -3 }, [])).toMatch(/al menos una vez/i)
    expect(motivoCodigoInvalido({ ...CUPON, usosMaximos: 2.5 }, [])).toMatch(/entero/i)
    expect(motivoCodigoInvalido({ ...CUPON, usosMaximos: null }, [])).toBeNull()
    expect(motivoCodigoInvalido({ ...CUPON, usosMaximos: 1 }, [])).toBeNull()
  })

  it('DOS CUPONES CON EL MISMO CÓDIGO son dos descuentos para la misma palabra', () => {
    const otros = [{ ...CUPON, id: 'C1' }]
    // Y la comparación es INSENSIBLE a mayúsculas: si «verano20» y «VERANO20»
    // fueran dos cupones, el descuento dependería de cómo lo tecleó el cliente.
    expect(motivoCodigoInvalido({ ...CUPON, id: 'C2', codigo: 'verano20' }, otros)).toMatch(
      /ya existe/i,
    )
    // Editarse a sí mismo no es un choque.
    expect(motivoCodigoInvalido({ ...CUPON, id: 'C1', descuentoPct: 30 }, otros)).toBeNull()
  })

  it('y el choque se detecta aunque EL YA GUARDADO esté en minúsculas', () => {
    // Nació del mutante M12. El caso de arriba no bastaba: el candidato ya se
    // normaliza, así que comparar `otro.codigo === codigo` a secas lo seguía
    // rechazando. La comparación tiene que normalizar LOS DOS LADOS — y hay
    // filas en minúsculas de verdad: cualquiera insertada por `psql`, o por
    // cualquier camino anterior a que el controller normalizara al guardar.
    //
    // Lo que costaría: dos cupones `verano20` y `VERANO20` con porcentajes
    // distintos. El `unique` de la base los rechaza —va sobre `upper(codigo)`—
    // así que el dueño no vería una frase sino un error de restricción.
    const guardadoEnMinusculas = [{ ...CUPON, id: 'C1', codigo: 'verano20' }]
    expect(
      motivoCodigoInvalido({ ...CUPON, id: 'C2', codigo: 'VERANO20' }, guardadoEnMinusculas),
    ).toMatch(/ya existe/i)
    expect(
      motivoCodigoInvalido({ ...CUPON, id: 'C2', codigo: '  Verano20 ' }, guardadoEnMinusculas),
    ).toMatch(/ya existe/i)
  })
})

describe('3 · motivoCanjeImposible — el corazón: lo que el SERVIDOR rechaza', () => {
  it('dentro de la vigencia y con usos libres, se canjea', () => {
    expect(motivoCanjeImposible(CUPON, '2026-09-15', 3)).toBeNull()
  })

  it('un cupón que no existe no dice por qué: no existe y ya', () => {
    // Es lo que ve quien teclea el cupón de OTRA organización. Decir «existe
    // pero no es tuyo» ya cuenta algo de la otra empresa (R2).
    expect(motivoCanjeImposible(null, '2026-09-15', 0)).toMatch(/no existe/i)
    expect(motivoCanjeImposible(undefined, '2026-09-15', 0)).toMatch(/no existe/i)
  })

  it('LOS DOS EXTREMOS DE LA VIGENCIA SON INCLUSIVOS', () => {
    // El día que empieza y el día que acaba valen. Quien configura «hasta el
    // 30» espera poder canjear el 30; excluirlo regala un día de confusión.
    expect(motivoCanjeImposible(CUPON, '2026-09-01', 0)).toBeNull()
    expect(motivoCanjeImposible(CUPON, '2026-09-30', 0)).toBeNull()
  })

  it('un cupón VENCIDO no aplica, y el mensaje dice cuándo venció', () => {
    const m = motivoCanjeImposible(CUPON, '2026-10-01', 0)
    expect(m).toMatch(/vencio/i)
    expect(m).toContain('2026-09-30')
  })

  it('un cupón que TODAVÍA no empieza no aplica', () => {
    const m = motivoCanjeImposible(CUPON, '2026-08-31', 0)
    expect(m).toMatch(/todavia no/i)
    expect(m).toContain('2026-09-01')
  })

  it('un cupón AGOTADO no aplica, y el mensaje dice la cuenta', () => {
    const m = motivoCanjeImposible({ ...CUPON, usosMaximos: 3 }, '2026-09-15', 3)
    expect(m).toMatch(/se uso/i)
    expect(m).toContain('3')
  })

  it('el tope de usos es ESTRICTO: con 2 de 3 todavía se puede', () => {
    expect(motivoCanjeImposible({ ...CUPON, usosMaximos: 3 }, '2026-09-15', 2)).toBeNull()
    expect(motivoCanjeImposible({ ...CUPON, usosMaximos: 3 }, '2026-09-15', 4)).toMatch(/se uso/i)
  })

  it('SIN TOPE (null) nunca se agota', () => {
    expect(motivoCanjeImposible({ ...CUPON, usosMaximos: null }, '2026-09-15', 9_999)).toBeNull()
  })

  it('un conteo de usos ILEGIBLE se trata como AGOTADO, no como cero', () => {
    // El lado prudente. Un `?? 0` aquí convertiría «no sé cuántas veces se usó»
    // en «no se ha usado nunca», que es regalar el cupón sin límite. Cobrar de
    // más se corrige; regalar ya se regaló (ADR 0039 §1).
    expect(motivoCanjeImposible(CUPON, '2026-09-15', NaN)).toMatch(/se uso/i)
    expect(motivoCanjeImposible(CUPON, '2026-09-15', undefined as any)).toMatch(/se uso/i)
  })

  it('una VIGENCIA ilegible no se salta: se rechaza', () => {
    // Una fecha corrupta comparada con `>=` daría `false` y dejaría el cupón
    // eternamente válido. Es el mismo molde que `NaN > tope` de lib/descuento.
    expect(motivoCanjeImposible({ ...CUPON, vigenteHasta: 'ayer' }, '2026-09-15', 0)).toMatch(
      /vigencia/i,
    )
    expect(motivoCanjeImposible(CUPON, 'hoy' as any, 0)).toMatch(/vigencia/i)
  })

  it('un PORCENTAJE ilegible en el cupón lo hace incanjeable', () => {
    // Si pasara, la propuesta se congelaría con un descuento NaN y contestaría
    // 200 OK: `numeric` de Postgres admite NaN y lo propaga.
    expect(motivoCanjeImposible({ ...CUPON, descuentoPct: NaN }, '2026-09-15', 0)).toMatch(
      /descuento/i,
    )
    expect(motivoCanjeImposible({ ...CUPON, descuentoPct: 0 }, '2026-09-15', 0)).toMatch(
      /descuento/i,
    )
  })
})

describe('4 · montoDescuentoCodigo — el dinero, con su guarda', () => {
  it('el 20 % de 10 000 son 2 000', () => {
    expect(montoDescuentoCodigo(10_000, 20)).toBe(2_000)
  })

  it('redondea a entero, como el resto de la cadena', () => {
    expect(montoDescuentoCodigo(3_333, 10)).toBe(333)
  })

  it('SIN CÓDIGO no descuenta nada, y ése es el invariante de la base instalada', () => {
    expect(montoDescuentoCodigo(10_000, 0)).toBe(0)
    expect(montoDescuentoCodigo(10_000, SIN_CODIGO.descuentoPct)).toBe(0)
  })

  it('un porcentaje ILEGIBLE se lee como CERO y NUNCA se propaga como NaN', () => {
    // El fallo de M15 de la Fase 2: los totales quedaban perfectos y solo se
    // envenenaba el importe que se factura.
    expect(montoDescuentoCodigo(10_000, NaN)).toBe(0)
    expect(montoDescuentoCodigo(10_000, 'abc')).toBe(0)
    expect(montoDescuentoCodigo(10_000, null)).toBe(0)
    expect(montoDescuentoCodigo(10_000, -20)).toBe(0)
    expect(montoDescuentoCodigo(NaN, 20)).toBe(0)
  })

  it('un porcentaje por encima de 100 se acota a 100, no regala de más', () => {
    expect(montoDescuentoCodigo(10_000, 250)).toBe(10_000)
  })
})

describe('estadoDelCodigo · la etiqueta de la lista (30/09)', () => {
  const C = (desde: string, hasta: string, usosMaximos: number | null, usos: number) => ({
    vigenteDesde: desde,
    vigenteHasta: hasta,
    usosMaximos,
    usos,
  })

  it('vigente: dentro de fechas y con usos', () => {
    expect(estadoDelCodigo(C('2026-09-01', '2026-12-31', 5, 1), '2026-09-30')).toBe('VIGENTE')
  })

  it('los dos extremos de la vigencia cuentan, igual que en el servidor', () => {
    expect(estadoDelCodigo(C('2026-09-30', '2026-09-30', null, 0), '2026-09-30')).toBe('VIGENTE')
  })

  it('próximo: todavía no empieza', () => {
    expect(estadoDelCodigo(C('2026-10-05', '2026-12-31', null, 0), '2026-09-30')).toBe('PROXIMO')
  })

  it('vencido: ya pasó la fecha de fin', () => {
    expect(estadoDelCodigo(C('2026-01-01', '2026-09-29', null, 0), '2026-09-30')).toBe('VENCIDO')
  })

  it('agotado gana a vencido: es lo primero que hay que saber de un cupón sin usos', () => {
    expect(estadoDelCodigo(C('2026-01-01', '2026-09-29', 2, 2), '2026-09-30')).toBe('AGOTADO')
  })

  it('sin tope de usos nunca se agota', () => {
    expect(estadoDelCodigo(C('2026-01-01', '2026-12-31', null, 999), '2026-09-30')).toBe('VIGENTE')
  })
})
