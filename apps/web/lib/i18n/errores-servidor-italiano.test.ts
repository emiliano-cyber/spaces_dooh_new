import { describe, it, expect, afterEach } from 'vitest'
import {
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_IT,
  CAMPO_EN,
  ETAPA_EN,
  ETAPA_IT,
  FALTA_REVISION_EN,
  FALTA_REVISION_IT,
  PERIODICIDAD_EN,
  PERIODICIDAD_IT,
  CAMPO_IT,
  FALTA_FIRMA_EN,
  FALTA_FIRMA_IT,
  PATRONES_ERROR,
  patronesItSinPatron,
  traducirError,
  type PatronError,
} from './errores-servidor'

// ============================================================================
//  Los errores del servidor en italiano.
//  Ola 0 (2026-11-03): los catalogos aceptan `it` y, mientras falte una
//  entrada, el error sale en INGLES —igual que la interfaz— y nunca a medias.
//  Lote L5 (2026-11-03): los catalogos estan COMPLETOS. La caida se sigue
//  probando quitando a mano la pieza que se quiere ver faltar.
// ============================================================================

const limpiar: Array<() => void> = []
afterEach(() => {
  while (limpiar.length) limpiar.pop()!()
})
function quitarIt(tabla: Partial<Record<string, string>>, es: string) {
  const antes = tabla[es]
  delete tabla[es]
  limpiar.push(() => {
    if (antes !== undefined) tabla[es] = antes
  })
}
function quitarPatronIt(p: PatronError) {
  const { it: antes, huecosIt } = p
  delete p.it
  limpiar.push(() => {
    p.it = antes
    p.huecosIt = huecosIt
  })
}
const patron = (msg: string) => PATRONES_ERROR.find((x) => x.re.test(msg)) as PatronError

describe('sin la pieza italiana, el mensaje ENTERO cae al ingles', () => {
  it('una frase del catalogo', () => {
    quitarIt(CATALOGO_ERRORES_IT, 'No encontrado')
    expect(traducirError('No encontrado', 'it')).toBe('Not found')
  })
  it('un patron', () => {
    quitarPatronIt(patron('Debe tener al menos 3 caracteres'))
    expect(traducirError('Debe tener al menos 3 caracteres', 'it')).toBe('Must be at least 3 characters')
  })
  // V9 del validador de la ola 0: con el motivo en italiano y el campo sin
  // el, salia «Email (ingles): motivo italiano». Tiene que salir ENTERO en ingles.
  it('«Campo: motivo» sin el campo italiano', () => {
    const msg = 'Correo: Este dato es obligatorio'
    quitarIt(CAMPO_IT, 'Correo')
    expect(CATALOGO_ERRORES_IT['Este dato es obligatorio']).toBeDefined()
    expect(traducirError(msg, 'it')).toBe(traducirError(msg, 'en'))
    expect(traducirError(msg, 'it')).toBe('Email: This field is required')
  })
  it('«Campo: motivo» sin el motivo italiano', () => {
    const msg = 'Correo: Este dato es obligatorio'
    quitarIt(CATALOGO_ERRORES_IT, 'Este dato es obligatorio')
    expect(traducirError(msg, 'it')).toBe(traducirError(msg, 'en'))
  })
  it('un patron cuyo hueco traducido no se reconoce (el tope dentro de quitar el paquete)', () => {
    const msg =
      'No se puede quitar el paquete "P1": sin el paquete vuelve a aplicarse el descuento por volumen de las lineas. ' +
      'Algo que nadie tradujo Baja primero el descuento comercial y vuelve a quitar el paquete.'
    expect(traducirError(msg, 'it')).toBe(traducirError(msg, 'en'))
  })
  it('un patron con hueco traducido en ingles y sin su funcion italiana', () => {
    const p = patron('No se puede editar un prospecto perdido')
    const huecosIt = p.huecosIt
    delete p.huecosIt
    limpiar.push(() => (p.huecosIt = huecosIt))
    expect(traducirError('No se puede editar un prospecto perdido', 'it')).toBe('This prospect cannot be edited: it is lost')
  })
  it('lo desconocido sale tal cual', () => {
    expect(traducirError('Algo que nadie tradujo', 'it')).toBe('Algo que nadie tradujo')
  })
})

describe('con italiano, sale en italiano (y es/en no cambian)', () => {
  it('una frase exacta', () => {
    expect(traducirError('No encontrado', 'it')).toBe('Non trovato')
    expect(traducirError('No encontrado', 'en')).toBe(CATALOGO_ERRORES['No encontrado'])
    expect(traducirError('No encontrado', 'es')).toBe('No encontrado')
  })
  it('un patron y un «Campo: motivo»', () => {
    expect(traducirError('Debe tener al menos 3 caracteres', 'it')).toBe('Deve avere almeno 3 caratteri')
    expect(traducirError('Correo: Este dato es obligatorio', 'it')).toBe('Email: Dato obbligatorio')
    expect(traducirError('Contraseña: Debe tener al menos 8 caracteres', 'it')).toBe('Password: Deve avere almeno 8 caratteri')
  })
  it('las cifras a la mexicana salen a la italiana', () => {
    expect(traducirError('Debe ser mayor que 2.5', 'it')).toBe('Deve essere maggiore di 2,5')
    expect(traducirError('No puede ser mayor que 1000', 'it')).toBe('Non può essere maggiore di 1000')
    expect(
      traducirError(
        'El descuento por volumen (12.5 %) ya supera el tope (10 %): deja el descuento comercial en 0 % o pide a Administración que suba el tope.',
        'it',
      ),
    ).toBe(
      'Lo sconto per volume (12,5%) supera già il tetto (10%): lascia lo sconto commerciale allo 0% oppure chiedi a un amministratore di alzare il tetto in Impostazioni.',
    )
  })
  it('los plurales con contador', () => {
    expect(traducirError('El PDF tiene 1 paginas y un recibo de CFE tiene 2. Sube los recibos por separado.', 'it')).toBe(
      'Il PDF ha 1 pagina e una bolletta CFE ne ha 2. Carica le bollette separatamente.',
    )
    expect(traducirError('No se puede enviar a firma: faltan 2 datos por capturar (RFC de tu empresa, Nombre del arrendador).', 'it')).toBe(
      'Non si può inviare alla firma: mancano ancora 2 dati (RFC della tua azienda, Nome del locatore).',
    )
    expect(traducirError('No se puede enviar a firma: faltan 1 datos por capturar (Fecha de fin).', 'it')).toBe(
      'Non si può inviare alla firma: manca ancora 1 dato (Data di fine).',
    )
  })
  it('los huecos con espanol armado por el servidor', () => {
    expect(
      traducirError(
        'La vigencia del contrato genera más de 500 pagos con periodicidad catorcenal. Revisa la fecha de fin: con esa cadencia el calendario no puede cubrir un plazo tan largo.',
        'it',
      ),
    ).toContain('(periodicità: ogni due settimane)')
    expect(traducirError('No se puede editar un prospecto en revisión', 'it')).toBe('Non si può modificare questo prospect: è in revisione')
    expect(traducirError('No se puede borrar: el cliente tiene 1 campaña y 3 clientes que lo tienen como agencia. Quítalos o reasígnalos antes de borrarlo.', 'it')).toBe(
      'Non si può eliminare: il cliente ha 1 campagna e 3 clienti che lo hanno come agenzia. Rimuovili o riassegnali prima di eliminarlo.',
    )
    expect(traducirError('Para enviarlo a revisión falta: la dirección, un teléfono o un correo de contacto', 'it')).toBe(
      'Per inviarlo in revisione manca ancora: l’indirizzo, un telefono o un’email di contatto',
    )
  })
  it('el tope envuelto en quitar el paquete, entero en italiano', () => {
    const msg =
      'No se puede quitar el paquete "P1": sin el paquete vuelve a aplicarse el descuento por volumen de las lineas. ' +
      'El descuento por volumen (12 %) ya supera el tope (10 %): deja el descuento comercial en 0 % o pide a Administración que suba el tope. ' +
      'Baja primero el descuento comercial y vuelve a quitar el paquete.'
    const it_ = traducirError(msg, 'it')
    expect(it_).toContain('Non si può rimuovere il pacchetto «P1»')
    expect(it_).toContain('Lo sconto per volume (12%) supera già il tetto (10%)')
  })
})

describe('las tablas italianas estan completas y casan', () => {
  it('cada patron tiene su italiano, y cada italiano su patron', () => {
    expect(PATRONES_ERROR.filter((p) => !p.it).map((p) => p.en)).toEqual([])
    expect(patronesItSinPatron()).toEqual([])
  })
  it('un hueco que el ingles traduce tiene su funcion italiana', () => {
    const faltan = PATRONES_ERROR.filter((p) => Object.keys(p.huecos ?? {}).some((n) => !p.huecosIt?.[Number(n)]))
    expect(faltan.map((p) => p.en)).toEqual([])
  })
  it('campos y datos de la firma, todos', () => {
    expect(Object.keys(CAMPO_EN).filter((k) => !CAMPO_IT[k])).toEqual([])
    expect(Object.keys(FALTA_FIRMA_EN).filter((k) => !FALTA_FIRMA_IT[k])).toEqual([])
  })
  it('ningun italiano con espacio antes de %, comillas rectas o apostrofo recto', () => {
    const textos = [...Object.values(CATALOGO_ERRORES_IT), ...PATRONES_ERROR.map((p) => p.it ?? '')] as string[]
    expect(textos.filter((t) => / %|"|\w'\w/.test(t))).toEqual([])
  })
})

// ============================================================================
//  Validacion del lote L5 (V3, V6, V8): las tablas de los huecos que el
//  servidor arma en espanol caen AL ESPANOL si les falta una entrada
//  (`deTabla`: `tabla[v] ?? v`). Clave por clave, contra su tabla inglesa.
// ============================================================================
describe('las tablas de huecos del servidor, completas y traducidas', () => {
  // Se dicen igual en espanol e italiano a proposito.
  const COGNADOS = new Set(['RFC', 'Cliente', 'Documento', 'Logo', 'Periodo'])
  const pares: Array<[string, Record<string, string>, Partial<Record<string, string>>]> = [
    ['periodicidad', PERIODICIDAD_EN, PERIODICIDAD_IT],
    ['etapa', ETAPA_EN, ETAPA_IT],
    ['revision', FALTA_REVISION_EN, FALTA_REVISION_IT],
    ['campos', CAMPO_EN, CAMPO_IT],
    ['firma', FALTA_FIRMA_EN, FALTA_FIRMA_IT],
  ]
  for (const [nombre, en, it_] of pares) {
    it(nombre, () => {
      expect(Object.keys(it_ ?? {}).sort()).toEqual(Object.keys(en).sort())
      expect(Object.entries(it_ ?? {}).filter(([es, v]) => v === es && !COGNADOS.has(es)).map(([es]) => es)).toEqual([])
    })
  }

  it('el predio lejano: los dos armados del servidor, en italiano', () => {
    const cola =
      '. Un predio es un solo inmueble y su renta se reparte entre las pantallas que cuelgan de él, así que una que está lejos ' +
      'abarataría a las demás. Revisa la dirección o las coordenadas, o dale su propio predio. (El límite son 500 m.)'
    expect(traducirError(`La pantalla está a 2.5 km de el predio "Norte"${cola}`, 'it')).toMatch(
      /^Lo schermo è a 2,5 km dall’immobile «Norte»\. Un immobile/,
    )
    expect(traducirError(`"P1" está a 800 m de "P2", que ya está en el predio "Sur"${cola}`, 'it')).toMatch(
      /^«P1» è a 800 m da «P2», che è già nell’immobile «Sur»\./,
    )
  })
})
