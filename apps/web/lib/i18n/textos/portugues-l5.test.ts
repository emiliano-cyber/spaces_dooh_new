import { describe, it, expect } from 'vitest'
import { DICCIONARIOS, PT_PARCIAL } from '../diccionario'
import { clavesBasePortugues } from '../cobertura-portugues'
import { espanolPendienteDeOtrosLotes } from '../../test/barrido-portugues'
import { ES_SHELL, EN_SHELL, PT_SHELL } from './shell'
import { ES_CUENTA, EN_CUENTA, PT_CUENTA } from './cuenta'
import { ES_ADMIN, EN_ADMIN, PT_ADMIN } from './admin'
import { ES_COMPARTIDOS, EN_COMPARTIDOS, PT_COMPARTIDOS } from './compartidos'
import { ES_NOTIFICACIONES, EN_NOTIFICACIONES, PT_NOTIFICACIONES } from './notificaciones'
import { ES_SERVIDOR, EN_SERVIDOR, PT_SERVIDOR } from './servidor'
import {
  CATALOGO_ERRORES,
  CATALOGO_ERRORES_PT,
  CAMPO_EN,
  CAMPO_PT,
  FALTA_FIRMA_EN,
  FALTA_FIRMA_PT,
  PATRONES_ERROR,
  PERIODICIDAD_EN,
  PERIODICIDAD_PT,
  ETAPA_EN,
  ETAPA_PT,
  FALTA_REVISION_EN,
  FALTA_REVISION_PT,
  traducirError,
} from '../errores-servidor'

// ============================================================================
//  PORTUGUES · lote L5 (armazon, cuenta, administracion, compartidos,
//  servidor) · LA PRUEBA ESTATICA DEL DICCIONARIO.
// ----------------------------------------------------------------------------
//  La del italiano L3 (`italiano-l3.test.ts`), y aqui hace MAS falta: lo que
//  falta del portugues cae al ESPANOL (decision del dueno, 05/11), asi que una
//  clave copiada del espanol no se distingue en pantalla de una sin traducir.
//  Se mira el diccionario entero, clave por clave, sin depender de lo que
//  rinda una prueba de pantalla:
//
//    · cada clave del lote TIENE portugues (la cobertura lo cuenta; aqui se
//      exige, con el nombre de la que falte);
//    · el portugues no es IGUAL al espanol ni al ingles, salvo los cognados
//      declarados abajo (palabras que en portugues se escriben igual, siglas,
//      marcas, huecos sueltos);
//    · el singular de un plural no es igual a su plural, salvo invariables;
//    · ninguna fecha en hueco lleva «em», «no», «do», «ao» o «pelo» delante
//      (regla del glosario: el hueco no sabe que cifra caera);
//    · comillas curvas “ ”: Brasil no usa « »;
//    · los catalogos del servidor, igual: cada mensaje con portugues y
//      distinto del espanol y del ingles salvo cognados.
// ============================================================================

const ES_BASE = DICCIONARIOS.es as Record<string, string>
const EN_BASE = DICCIONARIOS.en as Record<string, string>
const PT_BASE_PARCIAL = PT_PARCIAL as Partial<Record<string, string>>
const BASE_ES = Object.fromEntries(clavesBasePortugues().map((k) => [k, ES_BASE[k]]))
const BASE_EN = Object.fromEntries(clavesBasePortugues().map((k) => [k, EN_BASE[k]]))
const BASE_PT = Object.fromEntries(clavesBasePortugues().map((k) => [k, PT_BASE_PARCIAL[k]]))

type Dic = Record<string, string>
type DicP = Partial<Record<string, string>>
const AMBITOS: ReadonlyArray<readonly [string, Dic, Dic, DicP]> = [
  ['base', BASE_ES, BASE_EN, BASE_PT],
  ['shell', ES_SHELL, EN_SHELL, PT_SHELL],
  ['cuenta', ES_CUENTA, EN_CUENTA, PT_CUENTA],
  ['admin', ES_ADMIN, EN_ADMIN, PT_ADMIN],
  ['compartidos', ES_COMPARTIDOS, EN_COMPARTIDOS, PT_COMPARTIDOS],
  ['notificaciones', ES_NOTIFICACIONES, EN_NOTIFICACIONES, PT_NOTIFICACIONES],
  ['servidor', ES_SERVIDOR, EN_SERVIDOR, PT_SERVIDOR],
]

// Iguales al espanol o al ingles A PROPOSITO: se escriben asi en portugues.
export const COGNADOS_PT_L5 = new Set<string>([
  'comun.cancelar',                                  // "Cancelar"
  'idioma.etiqueta',                                 // "Idioma"
  'idioma.es',                                       // "Español"
  'idioma.en',                                       // "English"
  'idioma.it',                                       // "Italiano"
  'idioma.pt',                                       // "Português"
  'idioma.cuenta.titulo',                            // "Idioma"
  'login.boton.entrar',                              // "Entrar"
  'login.boton.entrando',                            // "Entrando…"
  'login.boton.enviando',                            // "Enviando…"
  'sidebar.logo-alt',                                // "logo"
  'sidebar.abrir-portal',                            // "Abrir portal"
  'nav.grupo.ojos',                                  // "Space Eyes"
  'nav.grupo.vender',                                // "Comercial"
  'nav.grupo.sistema',                               // "Sistema"
  'nav.dashboard',                                   // "Dashboard"
  'nav.network',                                     // "Network"
  'nav.clientes',                                    // "Clientes"
  'nav.comercial',                                   // "Comercial"
  'compartidos.unidad.mensual.otros',                // "meses"
  'compartidos.unidad.semanal',                      // "Semanal"
  'compartidos.unidad.semanal.uno',                  // "semana"
  'compartidos.unidad.semanal.otros',                // "semanas"
  'compartidos.unidad.hora',                         // "Por hora"
  'compartidos.unidad.hora.uno',                     // "hora"
  'compartidos.unidad.hora.otros',                   // "horas"
  'compartidos.periodicidad.semanal',                // "Semanal"
  'compartidos.periodicidad.bimestral',              // "Bimestral"
  'compartidos.periodicidad.trimestral',             // "Trimestral"
  'compartidos.periodicidad.semestral',              // "Semestral"
  'compartidos.periodicidad.anual',                  // "Anual"
  'compartidos.periodo.etiqueta.rango',              // "{desde} a {hasta}"
  'compartidos.periodo.a',                           // "a"
  'compartidos.dia.0',                               // "dom"
  'compartidos.dia.6',                               // "sáb"
  'compartidos.candado.confirmar',                   // "Confirmar"
  'compartidos.plegar.expandir',                     // "Expandir {titulo}"
  'compartidos.paginacion.de',                       // "de"
  'compartidos.paginacion.anterior',                 // "Anterior"
  'shell.candado.desbloquear',                       // "Desbloquear"
  'shell.confirmar.confirmar',                       // "Confirmar"
  'cuenta.codigos.verificando',                      // "Verificando…"
  'cuenta.codigos.copiar',                           // "Copiar"
  'cuenta.codigos.continuar',                        // "Continuar"
  'cuenta.codigos.copiados',                         // "Copiados"
  'notificaciones.correo.resumen.vencido.uno',       // "{n} vencido"
  'notificaciones.correo.resumen.vencido.otros',     // "{n} vencidos"
  'notificaciones.contrato.vencido',                 // "Contrato vencido: {contrato}"
  'notificaciones.ver',                              // "Ver"
  'servidor.franja.vendida',                         // "“{nombre}”"
  'servidor.periodo.cliente-invalido',               // "Cliente inválido"
  'admin.rol.administrador',                         // "Administrador"
  'admin.rol.vendedor',                              // "Vendedor"
  'admin.cap.ver',                                   // "Ver"
  'admin.modulo.dashboard',                          // "Dashboard"
  'admin.modulo.comercial',                          // "Comercial"
  'admin.modulo.network',                            // "Network"
  'admin.comun.n-de',                                // "{n} de {total}"
  'admin.usuarios.col.estatus',                      // "Status"
  'admin.password.confirmando',                      // "Confirmando…"
  'admin.alta.copiado',                              // "Copiado"
  'admin.alta.cargo',                                // "Cargo"
  'admin.cfg.familia.empresa',                       // "Empresa"
  'admin.cfg.familia.comercial',                     // "Comercial"
  'admin.loop.slots',                                // "Slots por loop"
  'admin.fiscal.representante',                      // "Representante legal"
  'admin.act.nunca',                                 // "nunca"
  'admin.act.instalada',                             // "Instalada:"
  'admin.act.modo',                                  // "Modo"
  'admin.act.instalar-version',                      // "Instalar {version}"
  'admin.act.instalar',                              // "Instalar"
  'admin.tickets.prioridad.normal',                  // "Normal"
  'admin.tickets.prioridad.alta',                    // "Alta"
  'admin.tickets.prioridad.urgente',                 // "Urgente"
  'admin.tickets.abrir',                             // "Abrir ticket"
  'admin.novedades.tipo.ajustado',                   // "Ajustado"
  'admin.novedades.instalada',                       // "Instalada"
  'admin.novedades.n-ajustes.uno',                   // "{n} ajuste"
  'admin.novedades.n-ajustes.otros',                 // "{n} ajustes"
  'admin.cuenta.empresa.titulo',                     // "Empresa"
  'admin.cuenta.para-confirmar',                     // "(para confirmar)"
  'admin.integ.simulados',                           // "simulados"
  'admin.integ.conectores',                          // "Conectores"
  'admin.integ.conectados.uno',                      // "{cifras} conectado"
  'admin.integ.conectados.otros',                    // "{cifras} conectados"
  'admin.integ.conector.cms.nombre',                 // "CMS / players DOOH"
  'admin.integ.conectado',                           // "Conectado"
  'admin.integ.consultando',                         // "Consultando…"
  'admin.integ.consultar',                           // "Consultar métricas"
  'admin.network.indicadores',                       // "Indicadores"
  'admin.network.programaticos',                     // "Programáticos"
  'admin.network.tradicional',                       // "Tradicional"
  'admin.network.col.estatus',                       // "Status"
  'admin.network.col.operador',                      // "Operador"
  'admin.network.col.tipo',                          // "Tipo"
  'admin.network.col.tarifa',                        // "Tarifa"
  'admin.actividad.todos',                           // "Todos"
  'admin.razones.n-avisos.uno',                      // "{n} aviso"
  'admin.razones.n-avisos.otros',                    // "{n} avisos"
  'admin.razones.principal',                         // "Principal"
  'admin.razones.editar',                            // "Editar"
])

// Singular igual al plural A PROPOSITO (sustantivo invariable o frase sin numero).
const PLURALES_INVARIABLES = new Set<string>([])

// Mensajes del servidor que en portugues se escriben igual que en espanol o ingles.
const COGNADOS_SERVIDOR = new Set<string>([
  'CURP inválida',
  'RFC inválido',
  'RFC',
  'Cliente',
  'Tarifa',
  'Contrato',
  'Documento',
  'Logo',
  'Código',
])

// «em {fecha}», «no {fecha}», «do {fecha}», «ao {fecha}», «pelo {fecha}»…
const HUECO_FECHA = '\\{(?:fecha|fin|desde|inicio|hasta|vence|finGracia|cuando|dia)\\}'
const ARTICULO_ANTE_FECHA = new RegExp(`(?:^|\\s)(?:em|no|na|do|da|ao|à|pelo|pela|dia)\\s+${HUECO_FECHA}`, 'i')

describe('portugues L5 · el diccionario entero, sin depender de lo que se rinde', () => {
  for (const [ambito, es, en, pt] of AMBITOS) {
    const claves = Object.keys(es)

    it(`${ambito} · cada clave tiene portugues`, () => {
      expect(claves.filter((k) => typeof pt[k] !== 'string' || pt[k] === '')).toEqual([])
    })

    it(`${ambito} · ninguna clave igual al espanol ni al ingles (salvo cognados declarados)`, () => {
      const copias = claves.filter((k) => !COGNADOS_PT_L5.has(k) && (pt[k] === es[k] || pt[k] === en[k]))
      expect(copias).toEqual([])
    })

    it(`${ambito} · cada singular dice algo distinto de su plural (salvo invariables declarados)`, () => {
      const iguales = claves
        .filter((k) => k.endsWith('.uno') && !PLURALES_INVARIABLES.has(k) && `${k.slice(0, -4)}.otros` in es)
        .filter((k) => pt[k] === pt[k.replace(/\.uno$/, '.otros')])
      expect(iguales).toEqual([])
    })

    it(`${ambito} · comillas curvas, nunca « »`, () => {
      expect(claves.filter((k) => /[«»]/.test(pt[k] ?? ''))).toEqual([])
    })
  }

  it('los declarados siguen existiendo y siguen siendo iguales (si uno se traduce, se quita)', () => {
    const todo: Record<string, [string, string, string | undefined]> = {}
    for (const [, es, en, pt] of AMBITOS) for (const k of Object.keys(es)) todo[k] = [es[k], en[k], pt[k]]
    expect([...COGNADOS_PT_L5].filter((k) => !todo[k] || (todo[k][2] !== todo[k][0] && todo[k][2] !== todo[k][1]))).toEqual([])
    expect([...PLURALES_INVARIABLES].filter((k) => !todo[k] || todo[k][2] !== todo[k.replace(/\.uno$/, '.otros')]?.[2])).toEqual([])
  })
})

describe('el barrido de pantallas portuguesas no esconde nada del lote', () => {
  // `espanolPendienteDeOtrosLotes()` se pasa como `ignorar` en los barridos de
  // `pantallas-admin` y `pantallas-cuenta-shell`: si trajera un trozo del
  // lote L5, ese trozo podria quedarse en espanol sin que nadie lo viera.
  it('ningun trozo ignorado es el espanol de una clave del lote', () => {
    const delLote = new Set(AMBITOS.flatMap(([, es]) => Object.values(es)))
    expect(espanolPendienteDeOtrosLotes().filter((t) => [...delLote].some((v) => v.trim() === t))).toEqual([])
  })
  it('y si una clave del lote perdiera su portugues, su espanol pasaria a ignorarse (por eso lo de arriba)', () => {
    const pt = PT_PARCIAL as Record<string, string | undefined>
    const antes = pt['shell.carga.detalle']
    delete pt['shell.carga.detalle']
    try {
      expect(espanolPendienteDeOtrosLotes()).toContain('La información no llegó del servidor. No es que no existan datos: no se pudieron leer.')
    } finally {
      pt['shell.carga.detalle'] = antes
    }
  })
})

describe('portugues · regla comun: ninguna fecha en hueco con preposicion delante', () => {
  it('en TODO el portugues escrito (los cinco lotes)', () => {
    const malas = Object.entries(PT_BASE_PARCIAL).filter(([, v]) => ARTICULO_ANTE_FECHA.test(v ?? ''))
    expect(malas).toEqual([])
  })

  it('y la comprobacion MUERDE', () => {
    for (const s of ['Vence em {fecha}', 'Aceita no {fecha}.', 'até o dia {fin}', 'Pago ao {hasta}'])
      expect(ARTICULO_ANTE_FECHA.test(s), s).toBe(true)
    for (const s of ['Vence: {fecha}', 'até {fin}', 'a partir de {desde}', '{desde} a {hasta}'])
      expect(ARTICULO_ANTE_FECHA.test(s), s).toBe(false)
  })
})

describe('portugues L5 · los catalogos del servidor', () => {
  const TABLAS = [
    ['catalogo', CATALOGO_ERRORES, CATALOGO_ERRORES_PT],
    ['campos', CAMPO_EN, CAMPO_PT],
    ['firma', FALTA_FIRMA_EN, FALTA_FIRMA_PT],
  ] as const

  for (const [nombre, en, pt] of TABLAS) {
    it(`${nombre} · cada mensaje tiene portugues, distinto del espanol y del ingles (salvo cognados)`, () => {
      const es = Object.keys(en)
      expect(es.filter((k) => typeof pt[k] !== 'string' || pt[k] === '')).toEqual([])
      expect(es.filter((k) => !COGNADOS_SERVIDOR.has(k) && (pt[k] === k || pt[k] === en[k]))).toEqual([])
      expect(es.filter((k) => /[«»]/.test(pt[k] ?? ''))).toEqual([])
    })
  }

  it('patrones · cada patron tiene plantilla portuguesa con los mismos huecos $n que la inglesa', () => {
    const huecosDe = (s: string) => [...new Set(s.match(/\$\d/g) ?? [])].sort().join()
    expect(PATRONES_ERROR.filter((p) => !p.pt).map((p) => p.en)).toEqual([])
    expect(PATRONES_ERROR.filter((p) => p.pt && huecosDe(p.pt) !== huecosDe(p.en)).map((p) => p.en)).toEqual([])
    // Un hueco que en ingles pasa por una funcion necesita la suya en portugues.
    const sinFuncion = PATRONES_ERROR.filter((p) =>
      Object.keys(p.huecos ?? {}).some((n) => !p.huecosPt?.[Number(n)]),
    )
    expect(sinFuncion.map((p) => p.en)).toEqual([])
  })

  // `deTabla` cae al ESPANOL si falta una entrada («ele negociación»): la
  // leccion del validador del italiano L5 (V3, V6, V8). Clave por clave contra
  // la tabla inglesa, y distinta del espanol salvo cognados.
  it('las tablas de huecos: las mismas claves que el ingles y en portugues', () => {
    const tablas = [
      [PERIODICIDAD_EN, PERIODICIDAD_PT, new Set(['semanal', 'bimestral', 'trimestral', 'semestral', 'anual'])],
      [ETAPA_EN, ETAPA_PT, new Set<string>()],
      [FALTA_REVISION_EN, FALTA_REVISION_PT, new Set<string>()],
    ] as const
    for (const [en, pt, cognados] of tablas) {
      expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort())
      expect(Object.keys(pt).filter((k) => !cognados.has(k) && pt[k] === k)).toEqual([])
    }
  })

  it('los huecos con espanol dentro salen en portugues (y lo desconocido no sale a medias)', () => {
    expect(traducirError('No se puede editar un prospecto negociación', 'pt')).toBe(
      'Não é possível editar este prospect: ele está em negociação',
    )
    const cola =
      '. Un predio es un solo inmueble y su renta se reparte entre las pantallas que cuelgan de él, así que una que está lejos ' +
      'abarataría a las demás. Revisa la dirección o las coordenadas, o dale su propio predio. (El límite son 1000 m.)'
    expect(traducirError(`La pantalla está a 2.5 km de el predio "Norte"${cola}`, 'pt')).toMatch(
      /^A tela está a 2,5 km do imóvel “Norte”\. Um imóvel .*\(O limite é 1000 m\.\)$/,
    )
    expect(traducirError(`"P1" está a 800 m de "P2", que ya está en el predio "Sur"${cola}`, 'pt')).toMatch(
      /^“P1” está a 800 m de “P2”, que já está no imóvel “Sur”\./,
    )
    // Una etapa que la tabla no conoce: entero en espanol, nunca «ele inventada».
    expect(traducirError('No se puede editar un prospecto inventada', 'pt')).toBe('No se puede editar un prospecto inventada')
    expect(traducirError('No se puede borrar: el cliente tiene 1 campaña y 3 clientes que lo tienen como agencia. Quítalos o reasígnalos antes de borrarlo.', 'pt')).toBe(
      'Não é possível excluir: o cliente tem 1 campanha e 3 clientes que o têm como agência. Remova ou reatribua esses registros antes de excluí-lo.',
    )
  })

  it('los cognados declarados siguen siendo iguales', () => {
    const todas = { ...CATALOGO_ERRORES, ...CAMPO_EN, ...FALTA_FIRMA_EN } as Record<string, string>
    const pt = { ...CATALOGO_ERRORES_PT, ...CAMPO_PT, ...FALTA_FIRMA_PT }
    expect([...COGNADOS_SERVIDOR].filter((k) => !(k in todas) || (pt[k] !== k && pt[k] !== todas[k]))).toEqual([])
  })
})
