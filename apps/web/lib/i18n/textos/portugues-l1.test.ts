import { describe, it, expect } from 'vitest'
import { ES_SPACEEYES, EN_SPACEEYES, PT_SPACEEYES } from './spaceeyes'
import { ES_ENERGIA, EN_ENERGIA, PT_ENERGIA } from './energia'

// ============================================================================
//  PORTUGUES · lote L1 (Space Eyes y luz) · LA PRUEBA ESTATICA DEL DICCIONARIO.
// ----------------------------------------------------------------------------
//  La del L5 (`portugues-l5.test.ts`) aplicada a `spaceeyes` y `energia`. Lo
//  que falta del portugues cae al ESPANOL (decision del dueno, 05/11): una
//  clave copiada del espanol no se distingue en pantalla de una sin traducir,
//  asi que se mira el diccionario entero, clave por clave:
//
//    · cada clave TIENE portugues, y ninguna sobra;
//    · el portugues no es IGUAL al espanol ni al ingles, salvo los cognados
//      declarados abajo;
//    · los huecos son los mismos que en espanol;
//    · el singular de un plural no es igual a su plural, salvo invariables;
//    · comillas curvas “ ”, sin espacio antes de «%», sin cifras con punto
//      decimal (salvo versiones), sin signos espanoles (¿ ¡ ñ);
//    · las frecuencias fijas en letra («A cada duas horas», nunca «A cada 2»);
//    · en la web se «clica», nunca «toque»/«toca» (el telefono «confirma»);
//    · el glosario del lote (ver `portugues-olas.md`, lote L1).
//  La regla de fechas en hueco y la de tuteo de los cinco lotes viven en
//  `portugues-l5.test.ts` sobre TODO `PT_PARCIAL`: tambien cubren este lote.
//  Aqui se repite la de fechas sobre el lote, con los huecos de fecha propios.
// ============================================================================

type Dic = Record<string, string>
type DicP = Partial<Record<string, string>>
const AMBITOS: ReadonlyArray<readonly [string, Dic, Dic, DicP]> = [
  ['spaceeyes', ES_SPACEEYES, EN_SPACEEYES, PT_SPACEEYES],
  ['energia', ES_ENERGIA, EN_ENERGIA, PT_ENERGIA],
]

// Iguales al espanol o al ingles A PROPOSITO.
export const COGNADOS_PT_L1 = new Set<string>([
  // Cifras con unidad, nombres de producto, siglas.
  'spaceeyes.demo.estado.temperatura.v', // «38 °C»
  'spaceeyes.demo.estado.datos.v', // «312 MB»
  'spaceeyes.alta.tipo.raspberry', // «Raspberry Pi»
  'spaceeyes.alta.nombre.raspberry', // «Raspberry»
  'spaceeyes.alta.nombre.pc', // «PC»
  'spaceeyes.graficas.pct', // «{n}%»: sin espacio (D4), como el ingles
  'spaceeyes.graficas.nd', // «n/d»
  'energia.resumen', // solo huecos
  'energia.kpi.de', // «{a} de {b}»
  // El boton «Vincular» de la app Android, que solo esta en espanol (dueno,
  // 02/11): se nombra como en la app. Y el «No» del Raspberry Pi Imager, que
  // en la version que se usa sale en ingles.
  'spaceeyes.alta.tel.vincular', // «Vincular»
  'spaceeyes.alta.pi.1.no', // «No»
  // Palabras que en portugues se escriben igual que en espanol.
  'spaceeyes.demo.estado.temperatura', // «Temperatura»
  'spaceeyes.demo.aviso.demo', // «demo»: igual al ingles
  'spaceeyes.balance.fluorescent', // «Fluorescente»
  'spaceeyes.vivo.balance.incandescent', // «Incandescente»
  'spaceeyes.vivo.foto', // «Foto»
  'spaceeyes.vivo.lente', // «Lente»
  'spaceeyes.vivo.iniciar', // «Iniciar»
  'spaceeyes.vivo.conectando', // «Conectando…»
  'spaceeyes.vivo.aplicando', // «Aplicando…»
  'spaceeyes.fallas.zona', // «Zona»
  'spaceeyes.graficas.dispositivo', // «Dispositivo»
  'spaceeyes.graficas.total', // «Total»
  'spaceeyes.texto.centro', // «Centro»
  'spaceeyes.texto.normal', // «Normal»
  'spaceeyes.texto.sombra', // «Sombra»
  'spaceeyes.galeria.origen.manual', // «Manual»
  'spaceeyes.galeria.verif.verified', // «Verificada»
  'spaceeyes.comun.modelo', // «Modelo»
  'spaceeyes.comun.estado', // «Estado»
  'spaceeyes.comun.editar', // «Editar»
  'spaceeyes.comun.descartar', // «Descartar»
  'spaceeyes.comun.anterior', // «Anterior»
  'spaceeyes.comun.opcional', // «(opcional)»
  'spaceeyes.admin.operador', // «Operador»
  'spaceeyes.admin.estado-region', // «Estado»
  'spaceeyes.admin.control.contraste', // «Contraste»
  'spaceeyes.admin.mostrar', // «Mostrar»
  'spaceeyes.admin.instalada', // «Instalada»
  'spaceeyes.admin.publicada', // «Publicada»
  'spaceeyes.admin.reiniciar.boton', // «Reiniciar»
  'spaceeyes.campanas.anunciante', // «Anunciante»
  'spaceeyes.verif.resultado', // «Resultado»
  'spaceeyes.alta.copiar', // «Copiar»
  'spaceeyes.alta.copiado', // «Copiado»
  'spaceeyes.alta.estado.cancelado', // «Cancelado»
  'spaceeyes.alta.estado.vencido', // «Vencido»
  'spaceeyes.alta.estado.usado', // «Usado»
  'spaceeyes.alta.lote.cancelado', // « · cancelado»
  'spaceeyes.alta.lote.vencido', // « · vencido»
  'energia.medidor', // «Medidor»
])

// Singular igual al plural A PROPOSITO (frase que no depende de la cifra).
const PLURALES_INVARIABLES = new Set<string>([])

// Los huecos que reciben una fecha (o un rango de fechas).
const HUECO_FECHA = '\\{(?:fecha|fin|desde|hasta|mes)\\}'
const PREPOSICION_ANTE_FECHA = new RegExp(`(?:^|\\s)(?:em|no|na|do|da|ao|à|pelo|pela|dia)\\s+${HUECO_FECHA}`, 'i')

const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const sinVersiones = (v: string) => v.replace(/\d+\.\d+\.\d+/g, '').replace(/(?:\bapp |\bv|\bagente )\d+\.\d+/g, '')

describe('portugues L1 · el diccionario entero, sin depender de lo que se rinde', () => {
  for (const [ambito, es, en, pt] of AMBITOS) {
    const claves = Object.keys(es)
    const entradas = () => claves.map((k) => [k, pt[k] ?? ''] as const)

    it(`${ambito} · cada clave tiene portugues, y ninguna sobra`, () => {
      expect(claves.filter((k) => typeof pt[k] !== 'string' || pt[k] === '')).toEqual([])
      expect(Object.keys(pt).filter((k) => !(k in es))).toEqual([])
    })

    it(`${ambito} · ninguna clave igual al espanol ni al ingles (salvo cognados declarados)`, () => {
      expect(claves.filter((k) => !COGNADOS_PT_L1.has(k) && (pt[k] === es[k] || pt[k] === en[k]))).toEqual([])
    })

    it(`${ambito} · los huecos son los mismos que en espanol`, () => {
      expect(claves.filter((k) => pt[k] !== undefined && huecos(pt[k]!) !== huecos(es[k]))).toEqual([])
    })

    it(`${ambito} · cada singular dice algo distinto de su plural (salvo invariables declarados)`, () => {
      const iguales = claves
        .filter((k) => k.endsWith('.uno') && !PLURALES_INVARIABLES.has(k) && `${k.slice(0, -4)}.otros` in es)
        .filter((k) => pt[k] === pt[k.replace(/\.uno$/, '.otros')])
      expect(iguales).toEqual([])
    })

    it(`${ambito} · comillas curvas, sin espacio antes del «%», sin signos espanoles`, () => {
      expect(entradas().filter(([, v]) => /[«»"]/.test(v)).map(([k]) => k)).toEqual([])
      expect(entradas().filter(([, v]) => /\d %|\} %/.test(v)).map(([k]) => k)).toEqual([])
      expect(entradas().filter(([, v]) => /[¿¡ñ]/.test(v)).map(([k]) => k)).toEqual([])
    })

    it(`${ambito} · ninguna cifra con punto decimal (las versiones no son cifras)`, () => {
      expect(entradas().filter(([, v]) => /\d\.\d/.test(sinVersiones(v))).map(([k]) => k)).toEqual([])
    })

    it(`${ambito} · ninguna fecha en hueco con preposicion delante`, () => {
      expect(entradas().filter(([, v]) => PREPOSICION_ANTE_FECHA.test(v)).map(([k]) => k)).toEqual([])
    })

    it(`${ambito} · las frecuencias fijas van en letra: «A cada duas horas», nunca «A cada 2»`, () => {
      expect(entradas().filter(([, v]) => /\bcada \d/i.test(v)).map(([k]) => k)).toEqual([])
    })

    it(`${ambito} · en la web se clica: nunca «toque/toca/aperte/pressione»`, () => {
      expect(entradas().filter(([, v]) => /\b(?:toque|toca|tocar|aperte|pressione)\b/i.test(v)).map(([k]) => k)).toEqual([])
    })

    it(`${ambito} · glosario: Titular, nunca Dono/Proprietário; nada de palabras espanolas sueltas`, () => {
      expect(entradas().filter(([, v]) => /\bDono\b|propriet[áa]ri/i.test(v)).map(([k]) => k)).toEqual([])
      // Restos espanoles frecuentes que no son portugues.
      const RESTOS = /\b(?:pantalla|equipo|falla|gabinetes? de|recibo|predio|renglón|guardar|eliminar|también|todavía|después|aquí|ningún)\b/i
      expect(entradas().filter(([, v]) => RESTOS.test(v)).map(([k]) => k)).toEqual([])
    })
  }

  it('los declarados siguen existiendo y siguen siendo iguales (si uno se traduce, se quita)', () => {
    const todo: Record<string, [string, string, string | undefined]> = {}
    for (const [, es, en, pt] of AMBITOS) for (const k of Object.keys(es)) todo[k] = [es[k], en[k], pt[k]]
    expect([...COGNADOS_PT_L1].filter((k) => !todo[k] || (todo[k][2] !== todo[k][0] && todo[k][2] !== todo[k][1]))).toEqual([])
    expect([...PLURALES_INVARIABLES].filter((k) => !todo[k] || todo[k][2] !== todo[k.replace(/\.uno$/, '.otros')]?.[2])).toEqual([])
  })

  it('y las comprobaciones MUERDEN', () => {
    expect(PREPOSICION_ANTE_FECHA.test('Venceu em {fecha}')).toBe(true)
    expect(PREPOSICION_ANTE_FECHA.test('Início: {fecha}')).toBe(false)
    expect(/\bcada \d/i.test('A cada 2 horas')).toBe(true)
    expect(/\bcada \d/i.test('A cada {n} min')).toBe(false)
    expect(/\d\.\d/.test(sinVersiones('A 1.5 MB por foto'))).toBe(true)
    expect(/\d\.\d/.test(sinVersiones('precisa da app 0.15.0 ou posterior'))).toBe(false)
  })
})

// El boton de la app Android se nombra como en la app (solo esta en espanol).
describe('portugues L1 · lo que el usuario ve fuera de la web se nombra como alli', () => {
  it('«Vincular» es el boton de la app Space Eye, en espanol', () => {
    expect(PT_SPACEEYES['spaceeyes.alta.tel.vincular']).toBe('Vincular')
  })
  it('la CFE y su recibo se nombran como en el papel', () => {
    expect(PT_ENERGIA['energia.lectura.no-recibo.uno']).toContain('CFE')
    expect(PT_ENERGIA['energia.lectura.no-recibo.otros']).toContain('CFE')
  })
})
