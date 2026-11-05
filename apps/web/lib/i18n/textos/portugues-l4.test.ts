import { describe, it, expect } from 'vitest'
import { ES_CAMPANAS, EN_CAMPANAS, PT_CAMPANAS } from './campanas'
import { ES_FINANZAS, EN_FINANZAS, PT_FINANZAS } from './finanzas'
import { ES_CLIENTES, EN_CLIENTES, PT_CLIENTES } from './clientes'
import { ES_REPORTES, EN_REPORTES, PT_REPORTES } from './reportes'
import { ES_INICIO, EN_INICIO, PT_INICIO } from './inicio'

// ============================================================================
//  PORTUGUES · lote L4 (Campanas, Finanzas, Clientes, Reportes y Dashboard) ·
//  LA PRUEBA ESTATICA DEL DICCIONARIO.
// ----------------------------------------------------------------------------
//  La del L5 (`portugues-l5.test.ts`), sobre los cinco ambitos del lote. En
//  portugues lo que falta cae al ESPANOL (decision del dueno, 05/11): una
//  clave copiada del espanol no se distingue en pantalla de una sin traducir,
//  asi que se mira el diccionario entero, clave por clave:
//
//    · cada clave del lote TIENE portugues;
//    · el portugues no es IGUAL al espanol ni al ingles, salvo los cognados
//      declarados abajo, uno por uno y con su texto;
//    · el singular de un plural no es igual a su plural, salvo invariables;
//    · comillas curvas “ ”, nunca « »;
//    · ninguna fecha en hueco con preposicion delante («em/no/do/ao/pelo»),
//      con los huecos de fecha propios del lote ({corte}, {periodo}, …);
//    · ninguna palabra que solo existe en espanol («campaña», «factura», «y»…):
//      un portugues A MEDIAS que ninguna de las de arriba ve;
//    · el glosario comun (§2 bis de `portugues-olas.md`) donde se puede medir:
//      OS y no OT, PC y no OC, «ocorrência» y no «incidente», «código de
//      negociação» y no «cupom», «Titular» y no «Proprietário».
// ============================================================================

type Dic = Record<string, string>
type DicP = Partial<Record<string, string>>
const AMBITOS: ReadonlyArray<readonly [string, Dic, Dic, DicP]> = [
  ['campanas', ES_CAMPANAS, EN_CAMPANAS, PT_CAMPANAS],
  ['finanzas', ES_FINANZAS, EN_FINANZAS, PT_FINANZAS],
  ['clientes', ES_CLIENTES, EN_CLIENTES, PT_CLIENTES],
  ['reportes', ES_REPORTES, EN_REPORTES, PT_REPORTES],
  ['inicio', ES_INICIO, EN_INICIO, PT_INICIO],
]

// Iguales al espanol o al ingles A PROPOSITO: se escriben asi en portugues.
export const COGNADOS_PT_L4 = new Set<string>([])

// Singular igual al plural A PROPOSITO (frase que no depende de la cifra).
const PLURALES_INVARIABLES = new Set<string>([])

// Los huecos de fecha del lote (los del L5 y los propios).
const HUECO_FECHA = '\\{(?:fecha|fin|desde|inicio|hasta|vence|corte|cuando|dia)\\}'
const PREPOSICION_ANTE_FECHA = new RegExp(`(?:^|\\s)(?:em|no|na|do|da|ao|à|pelo|pela|dia)\\s+${HUECO_FECHA}`, 'i')

// Palabras que existen en espanol y NO en portugues (las comunes a los dos
// —«desde», «está», «tarifa», «vencida», «pago»— no estan).
const SOLO_ESPANOL = [
  'y', 'el', 'los', 'las', 'del', 'pero', 'hay', 'aquí', 'están', 'todavía', 'ningún', 'ninguna', 'hasta', 'cuando',
  'según', 'fecha', 'fechas', 'pantalla', 'pantallas', 'campaña', 'campañas', 'factura', 'facturas', 'cobranza',
  'renta', 'rentas', 'monto', 'montos', 'reporte', 'reportes', 'sitio', 'sitios', 'guardar', 'borrar', 'nuevo', 'nueva',
  'días', 'año', 'años', 'luz', 'sin', 'cuota', 'cuotas', 'arrendador', 'predio', 'propuesta', 'propuestas', 'llave',
  'también', 'aún', 'quitar', 'agregar', 'eliminar', 'subir', 'bajar', 'cargando', 'guardando', 'cerrar',
]
const PALABRA_ESPANOLA = new RegExp(`(?:^|[^\\p{L}{])(${SOLO_ESPANOL.join('|')})(?=$|[^\\p{L}}])`, 'iu')

// El glosario comun, donde una palabra lo delata.
const GLOSARIO: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:^|[^\p{L}])OTs?(?=$|[^\p{L}])/u, 'OT → OS (ordem de serviço)'],
  [/(?:^|[^\p{L}])OCs?(?=$|[^\p{L}])/u, 'OC → PC (pedido de compra)'],
  [/incident/i, 'incidencia → ocorrência'],
  [/cupo[mn]|cupão/i, 'cupón → código de negociação'],
  [/propriet[áa]ri/i, 'Dueño → Titular'],
  [/quinzenal/i, 'quincenal → duas vezes por mês; catorcena → bissemana'],
  [/[«»]/, 'comillas curvas “ ”'],
]

describe('portugues L4 · el diccionario entero, sin depender de lo que se rinde', () => {
  for (const [ambito, es, en, pt] of AMBITOS) {
    const claves = Object.keys(es)

    it(`${ambito} · cada clave tiene portugues`, () => {
      expect(claves.filter((k) => typeof pt[k] !== 'string' || pt[k] === '')).toEqual([])
    })

    it(`${ambito} · ninguna clave igual al espanol ni al ingles (salvo cognados declarados)`, () => {
      expect(claves.filter((k) => !COGNADOS_PT_L4.has(k) && (pt[k] === es[k] || pt[k] === en[k]))).toEqual([])
    })

    it(`${ambito} · cada singular dice algo distinto de su plural (salvo invariables declarados)`, () => {
      const iguales = claves
        .filter((k) => k.endsWith('.uno') && !PLURALES_INVARIABLES.has(k) && `${k.slice(0, -4)}.otros` in es)
        .filter((k) => pt[k] === pt[k.replace(/\.uno$/, '.otros')])
      expect(iguales).toEqual([])
    })

    it(`${ambito} · los mismos huecos {x} que el espanol`, () => {
      const huecos = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join()
      expect(claves.filter((k) => pt[k] !== undefined && huecos(pt[k] ?? '') !== huecos(es[k]))).toEqual([])
    })

    it(`${ambito} · ninguna fecha en hueco con preposicion delante`, () => {
      expect(claves.filter((k) => PREPOSICION_ANTE_FECHA.test(pt[k] ?? '')).map((k) => `${k}: ${pt[k]}`)).toEqual([])
    })

    it(`${ambito} · ninguna palabra que solo existe en espanol`, () => {
      expect(
        claves
          .filter((k) => !COGNADOS_PT_L4.has(k) && PALABRA_ESPANOLA.test(pt[k] ?? ''))
          .map((k) => `${k}: ${pt[k]}`),
      ).toEqual([])
    })

    it(`${ambito} · el glosario comun`, () => {
      const malas = claves.flatMap((k) =>
        GLOSARIO.filter(([re]) => re.test(pt[k] ?? '')).map(([, regla]) => `${k} · ${regla}: ${pt[k]}`),
      )
      expect(malas).toEqual([])
    })
  }

  it('los declarados siguen existiendo y siguen siendo iguales (si uno se traduce, se quita)', () => {
    const todo: Record<string, [string, string, string | undefined]> = {}
    for (const [, es, en, pt] of AMBITOS) for (const k of Object.keys(es)) todo[k] = [es[k], en[k], pt[k]]
    expect([...COGNADOS_PT_L4].filter((k) => !todo[k] || (todo[k][2] !== todo[k][0] && todo[k][2] !== todo[k][1]))).toEqual([])
    expect([...PLURALES_INVARIABLES].filter((k) => !todo[k] || todo[k][2] !== todo[k.replace(/\.uno$/, '.otros')]?.[2])).toEqual([])
  })

  it('y las comprobaciones MUERDEN', () => {
    for (const s of ['Vence em {fecha}', 'Saldo no {corte}', 'Pago ao {hasta}']) expect(PREPOSICION_ANTE_FECHA.test(s), s).toBe(true)
    for (const s of ['Vence: {fecha}', 'até {fin}', 'a partir de {desde}', '{desde} a {hasta}'])
      expect(PREPOSICION_ANTE_FECHA.test(s), s).toBe(false)
    for (const s of ['Nenhuma campaña', 'Sem dados y sem {n}', 'Fatura sin pagar', 'Data da factura'])
      expect(PALABRA_ESPANOLA.test(s), s).toBe(true)
    for (const s of ['Nenhuma campanha', 'Desde {desde}', 'Tarifa vencida', 'Está pago', '{sin}', 'sinal'])
      expect(PALABRA_ESPANOLA.test(s), s).toBe(false)
    const regla = (s: string) => GLOSARIO.filter(([re]) => re.test(s)).length
    for (const s of ['OT vencida', 'Número de OC', 'Sitio bloqueado por incidente', 'Visão de Proprietário', '«x»'])
      expect(regla(s), s).toBeGreaterThan(0)
    for (const s of ['OS atrasada', 'Número do PC', 'ocorrência', 'Titular', '“x”', 'COTAÇÃO', 'Total'])
      expect(regla(s), s).toBe(0)
  })
})
