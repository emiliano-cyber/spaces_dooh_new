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
  // Leidos uno por uno (05/11): en portugues se escriben igual que en espanol
  // (Fotos, Comparar, Ampliar, Nitidez, Obturador, Pausar, Próxima foto…) o
  // que en ingles (Latitude, Total, Normal). Y a proposito, aunque no sean
  // portugues: cifras con unidad («38 °C», «312 MB», «{n}%»), nombres de
  // producto (Raspberry Pi, PC), el boton «Vincular» de la app Android, que
  // solo esta en espanol (dueno, 02/11), y el «No» del Raspberry Pi Imager,
  // que sale en ingles.
  'spaceeyes.hace.nunca', // «nunca»
  'spaceeyes.demo.anuncio.b1', // «OFERTA»
  'spaceeyes.demo.estado.temperatura', // «Temperatura»
  'spaceeyes.demo.estado.temperatura.v', // «38 °C» (=en)
  'spaceeyes.demo.estado.datos.v', // «312 MB» (=en)
  'spaceeyes.lista.kpi.ultima', // «Última captura»
  'spaceeyes.lista.filtro.todos', // «Todos · {n}»
  'spaceeyes.lista.empresa', // «Empresa»
  'spaceeyes.lista.alt-captura', // «Última captura de {nombre}»
  'spaceeyes.comun.modelo', // «Modelo»
  'spaceeyes.ficha.tab.fotos', // «Fotos»
  'spaceeyes.ficha.comparar', // «Comparar»
  'spaceeyes.ficha.barra.captura', // «Última captura {valor}»
  'spaceeyes.ficha.ampliar', // «Ampliar»
  'spaceeyes.ficha.ampliar-sello', // «Ampliar: {sello}»
  'spaceeyes.historial.hora', // «Hora»
  'spaceeyes.comun.estado', // «Estado»
  'spaceeyes.falla.detectada', // «Detectada»
  'spaceeyes.pyc.gabinetes', // «{n} gabinetes»
  'spaceeyes.pyc.apagada', // «Apagada»
  'spaceeyes.creativos.descartando', // «Descartando…»
  'spaceeyes.pconfig.aprendizaje.30', // «30 minutos»
  'spaceeyes.pconfig.aprendizaje.120', // «2 horas»
  'spaceeyes.pconfig.aprendizaje.360', // «6 horas»
  'spaceeyes.pconfig.aprendizaje.1440', // «24 horas»
  'spaceeyes.pconfig.gabinetes', // «{n} gabinetes {medida}»
  'spaceeyes.pconfig.revision.apagada', // «apagada»
  'spaceeyes.pconfig.revision.congelada', // «congelada»
  'spaceeyes.balance.cloudy', // «Nublado»
  'spaceeyes.balance.fluorescent', // «Fluorescente»
  'spaceeyes.admin.control.centro-x', // «Centro horizontal»
  'spaceeyes.admin.control.centro-y', // «Centro vertical»
  'spaceeyes.admin.control.contraste', // «Contraste»
  'spaceeyes.admin.control.nitidez', // «Nitidez»
  'spaceeyes.admin.medicion.matrix', // «Por zonas»
  'spaceeyes.admin.balance.auto', // «Automático»
  'spaceeyes.admin.estado-region', // «Estado»
  'spaceeyes.admin.latitud', // «Latitude» (=en)
  'spaceeyes.admin.longitud', // «Longitude» (=en)
  'spaceeyes.admin.instalada', // «Instalada»
  'spaceeyes.admin.publicada', // «Publicada»
  'spaceeyes.admin.nada-publicado', // «nada publicado»
  'spaceeyes.admin.boton.reiniciar', // «Reiniciar app»
  'spaceeyes.admin.reiniciar.boton', // «Reiniciar»
  'spaceeyes.admin.ocultar', // «Ocultar»
  'spaceeyes.admin.mostrar', // «Mostrar»
  'spaceeyes.admin.obturador', // «Obturador»
  'spaceeyes.admin.azul', // «Azul»
  'spaceeyes.comun.descartar', // «Descartar»
  'spaceeyes.vivo.balance.incandescent', // «Incandescente»
  'spaceeyes.vivo.foto', // «Foto»
  'spaceeyes.vivo.iniciar', // «Iniciar»
  'spaceeyes.vivo.conectando', // «Conectando…»
  'spaceeyes.vivo.lente', // «Lente»
  'spaceeyes.vivo.lente.normal', // «Lente normal»
  'spaceeyes.vivo.ver-nitido', // «Ver nítido»
  'spaceeyes.vivo.aplicando', // «Aplicando…»
  'spaceeyes.comun.anterior', // «Anterior»
  'spaceeyes.comun.pagina', // «Página {pagina}»
  'spaceeyes.comun.pagina-de', // «Página {pagina} de {paginas}»
  'spaceeyes.galeria.origen.manual', // «Manual» (=en)
  'spaceeyes.galeria.origen.scheduled', // «Programada»
  'spaceeyes.galeria.verif.running', // «Verificando»
  'spaceeyes.galeria.verif.verified', // «Verificada»
  'spaceeyes.galeria.preparando', // «Preparando…»
  'spaceeyes.galeria.total.otros', // «{n} fotos»
  'spaceeyes.galeria.filtradas', // «Fotos filtradas»
  'spaceeyes.galeria.alt', // «Foto {id} de {nombre}»
  'spaceeyes.galeria.foto-de', // «Foto de {nombre}»
  'spaceeyes.galeria.anterior', // «Foto anterior»
  'spaceeyes.comun.opcional', // «(opcional)»
  'spaceeyes.fallas.filtro.todas', // «Todas»
  'spaceeyes.fallas.donde.gabinetes.otros', // «Gabinetes {lista}»
  'spaceeyes.fallas.donde.de', // « ({n} de {total})»
  'spaceeyes.fallas.zona', // «Zona»
  'spaceeyes.comun.editar', // «Editar»
  'spaceeyes.campanas.anunciante', // «Anunciante»
  'spaceeyes.prog.destino.grupo', // «Grupo: {nombre}»
  'spaceeyes.prog.estado.pausada', // «Pausada»
  'spaceeyes.prog.linea.otros', // «Próxima: {proxima} · {n} fotos {semana}»
  'spaceeyes.prog.pausar', // «Pausar»
  'spaceeyes.prog.proxima-foto', // «Próxima foto»
  'spaceeyes.prog.aplicar-a', // «Aplicar a»
  'spaceeyes.verif.resultado', // «Resultado»
  'spaceeyes.verif.pagina-anterior', // «Página anterior»
  'spaceeyes.graficas.semana', // «Semana»
  'spaceeyes.graficas.periodo.custom', // «Personalizado»
  'spaceeyes.graficas.total', // «Total» (=en)
  'spaceeyes.graficas.exportar', // «Exportar CSV»
  'spaceeyes.graficas.dispositivo', // «Dispositivo»
  'spaceeyes.graficas.aplicar', // «Aplicar»
  'spaceeyes.graficas.nd', // «n/d»
  'spaceeyes.graficas.pct', // «{n}%» (=en)
  'spaceeyes.texto.capturando', // «Capturando…»
  'spaceeyes.texto.normal', // «Normal» (=en)
  'spaceeyes.texto.centro', // «Centro»
  'spaceeyes.texto.sombra', // «Sombra»
  'spaceeyes.alta.tipo.raspberry', // «Raspberry Pi» (=en)
  'spaceeyes.alta.nombre.raspberry', // «Raspberry» (=en)
  'spaceeyes.alta.nombre.pc', // «PC» (=en)
  'spaceeyes.alta.copiado', // «Copiado»
  'spaceeyes.alta.copiar', // «Copiar»
  'spaceeyes.alta.copiar-comando', // «Copiar comando»
  'spaceeyes.alta.tel.vincular', // «Vincular» (=en)
  'spaceeyes.alta.pi.1.no', // «No» (=en)
  'spaceeyes.alta.col.codigo', // «Código»
  'spaceeyes.alta.lote.cancelado', // « · cancelado»
  'spaceeyes.alta.lote.vencido', // « · vencido»
  'spaceeyes.alta.usado-por', // «Usado · {nombre}»
  'spaceeyes.alta.estado.vencido', // «Vencido»
  'spaceeyes.alta.estado.cancelado', // «Cancelado»
  'spaceeyes.alta.estado.usado', // «Usado»
  'energia.meses.otros', // «{n} meses»
  'energia.resumen', // «{meses} · {puntos}» (=en)
  'energia.kpi.de', // «{a} de {b}»
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
    // Sin los huecos: «{pantalla}» o «{toca}» son nombres de variable, no texto.
    const textos = () => entradas().map(([k, v]) => [k, v.replace(/\{\w+\}/g, '')] as const)

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
      expect(textos().filter(([, v]) => /\b(?:toque|toca|tocar|aperte|pressione)\b/i.test(v)).map(([k]) => k)).toEqual([])
    })

    it(`${ambito} · glosario: Titular, nunca Dono/Proprietário; nada de palabras espanolas sueltas`, () => {
      expect(textos().filter(([, v]) => /\bDono\b|propriet[áa]ri/i.test(v)).map(([k]) => k)).toEqual([])
      // Restos espanoles frecuentes que no son portugues.
      const RESTOS = /\b(?:pantalla|equipo|falla|gabinetes? de|recibo|predio|renglón|guardar|eliminar|también|todavía|después|aquí|ningún)\b/i
      expect(textos().filter(([, v]) => RESTOS.test(v)).map(([k]) => k)).toEqual([])
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
