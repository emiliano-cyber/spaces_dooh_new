import { describe, it, expect } from 'vitest'
import { ES_OPERACIONES, EN_OPERACIONES, PT_OPERACIONES } from './operaciones'
import { ES_OPERACIONES2, EN_OPERACIONES2, PT_OPERACIONES2 } from './operaciones2'
import { ES_INVENTARIO, EN_INVENTARIO, PT_INVENTARIO } from './inventario'
import { ES_ARRENDADORES, EN_ARRENDADORES, PT_ARRENDADORES } from './arrendadores'

// ============================================================================
//  PORTUGUES · lote L3 (inventario, arrendadores y operaciones) · LA PRUEBA
//  ESTATICA DEL DICCIONARIO.
// ----------------------------------------------------------------------------
//  La del L5 (`portugues-l5.test.ts`) y la del italiano L3 (`italiano-l3.test.ts`).
//  Lo que falta del portugues cae al ESPANOL, asi que una clave copiada del
//  espanol no se distingue en pantalla de una sin traducir. Se mira el
//  diccionario entero, clave por clave, sin depender de lo que rinda una
//  prueba de pantalla:
//
//    · cada clave del lote TIENE portugues;
//    · el portugues no es IGUAL al espanol ni al ingles, salvo los cognados
//      declarados abajo;
//    · el singular de un plural no es igual a su plural, salvo invariables;
//    · comillas curvas “ ”, nunca « »;
//    · ninguna fecha en hueco con preposicion delante (la regla comun la mira
//      `portugues-l5.test.ts` sobre todo `PT_PARCIAL`; aqui con los huecos de
//      fecha PROPIOS del lote, que aquella no conoce);
//    · el glosario propio del lote: ni «OT», ni «pantalla», ni «tela» para el
//      inventario en general, ni «outdoor» para el espectacular.
// ============================================================================

type Dic = Record<string, string>
type DicP = Partial<Record<string, string>>
const AMBITOS: ReadonlyArray<readonly [string, Dic, Dic, DicP]> = [
  ['operaciones', ES_OPERACIONES, EN_OPERACIONES, PT_OPERACIONES],
  ['operaciones2', ES_OPERACIONES2, EN_OPERACIONES2, PT_OPERACIONES2],
  ['inventario', ES_INVENTARIO, EN_INVENTARIO, PT_INVENTARIO],
  ['arrendadores', ES_ARRENDADORES, EN_ARRENDADORES, PT_ARRENDADORES],
]

// Iguales al espanol o al ingles A PROPOSITO: se escriben asi en portugues.
export const COGNADOS_PT_L3 = new Set<string>([
  'operaciones.slots.total', // {total} slots
  'operaciones.slots.slots', // slots
  'operaciones.clientes-badge.clientes', // clientes
  'operaciones.calendario.confirmada', // confirmada
  'operaciones.disponibilidad.kpi.de', // {n} de {total}
  'operaciones.disponibilidad.digital', // digital
  'operaciones.disponibilidad.ocupante', // {campana} (confirmada)
  'operaciones.disponibilidad.ocupante-slots', // {campana} (confirmada, {spots} slots)
  'operaciones.disponibilidad.en-propuesta-spots', // , {n} spots
  'operaciones.almacen.estado.instalado', // Instalado
  'operaciones.almacen.tipo.lona', // Lona
  'operaciones.almacen.campo.marca', // Marca
  'operaciones.almacen.campo.modelo', // Modelo
  'operaciones.almacen.indicadores', // Indicadores
  'operaciones.almacen.kpi.instalados', // Instalados
  'operaciones.almacen.filtrar', // Filtrar por tipo
  'operaciones.almacen.todos', // Todos
  'operaciones.almacen.col.tipo', // Tipo
  'operaciones.almacen.alta.tipo', // Tipo
  'operaciones.imprenta.campo.material', // Material
  'operaciones2.comun.de', // {a} de {b}
  'operaciones2.comun.tipo', // Tipo
  'operaciones2.comun.ver-todas', // Ver todas
  'operaciones2.comun.ver-todas-n', // Ver todas ({n})
  'operaciones2.comun.ver-menos', // Ver menos
  'operaciones2.prioridad.normal', // Normal
  'operaciones2.prioridad.alta', // Alta
  'operaciones2.prioridad.urgente', // Urgente
  'operaciones2.ot.filtro.todas', // Todas
  'operaciones2.ot.nueva.opcion-digital', // · Digital
  'operaciones2.ficha.checklist', // Checklist
  'operaciones2.creativos.kpi.de-spots.uno', // de {n} spot reservado
  'operaciones2.creativos.kpi.de-spots.otros', // de {n} spots reservados
  'operaciones2.creativos.codigo', // Código
  'operaciones2.creativos.etiqueta-codigo', // código
  'operaciones2.creativos.ver-html', // Ver HTML
  'operaciones2.creativos.slots', // Slots reservados ({n})
  'operaciones2.creativos.fuente.caracteres', // {formato} · {n} caracteres
  'inventario.indicadores', // Indicadores
  'inventario.kpi.disponibles.sub', // de {total}
  'inventario.chips.contrato', // Contrato
  'inventario.medio.digital', // Digital
  'inventario.disponibilidad.ocupado', // Ocupado
  'inventario.lote.unidad.contrato', // contrato
  'inventario.lote.unidad.contratos', // contratos
  'inventario.tabla.de', // {n} de {total}
  'inventario.tabla.tarifa', // Tarifa
  'inventario.tabla.ajustar', // Ajustar %
  'inventario.tabla.aplicando', // Aplicando…
  'inventario.tabla.aplicar', // Aplicar
  'inventario.tabla.col.tipo', // Tipo
  'inventario.tabla.doohmain-servidor', //  · servidor
  'inventario.tarifa.title', // Editar tarifa
  'inventario.wizard.paso.contrato', // Contrato
  'inventario.wizard.existente', // Existente
  'inventario.wizard.rfc', // RFC
  'inventario.wizard.caras', // Faces
  'inventario.wizard.slots', // Slots (digital)
  'inventario.alta.tab.basico', // Básico
  'inventario.alta.tab.ia', // IA/Vision
  'inventario.alta.latitud', // Latitude
  'inventario.alta.longitud', // Longitude
  'inventario.carga.estado.valida', // válida
  'inventario.info.modalidades.otros', // {n} modalidades
  'arrendadores.comun.contratos', // Contratos
  'arrendadores.comun.estatus', // Status
  'arrendadores.comun.completar', // Completar
  'arrendadores.comun.motivo', // “{motivo}”
  'arrendadores.contratos-todos', // Contratos: todos
  'arrendadores.filtrados', // {n} de {total} contratos
  'arrendadores.contratos.vendida-item', // “{nombre}”
  'arrendadores.lista.falta', // Falta
  'arrendadores.razones.regimen', // Regime:
  'arrendadores.razones.falta', // falta
  'arrendadores.incidencia.vandalismo', // Vandalismo
  'arrendadores.incidencia.clima', // Clima
  'arrendadores.ficha.contrato', // Contrato
  'arrendadores.ficha.renovar', // Renovar
  'arrendadores.ficha.vencido', // Vencido
  'arrendadores.ficha.registrar', // Registrar
  'arrendadores.ficha.ruc', // RUC
  'arrendadores.completar.falta-rfc', // RFC
  'arrendadores.adjunto.ver', // Ver
  'arrendadores.metodo.cheque', // Cheque
  'arrendadores.incidencia.tipo', // Tipo
  'arrendadores.incidencia.bloqueado', // bloqueado
  'arrendadores.editar.motivo', // Motivo
  'arrendadores.licencias.vigente', // Vigente
  'arrendadores.cuadre.col.proximo', // Próximo
  'arrendadores.cuadre.contratos.uno', // {n} contrato
  'arrendadores.cuadre.contratos.otros', // {n} contratos
  'arrendadores.pagos.programado', // Programado
  'arrendadores.pagos.registrando', // Registrando…
  'arrendadores.compromiso.equivale', // Equivale a
  'arrendadores.firmas.congela', // congela
  'arrendadores.firmas.ip', // IP: {ip} · Navegador: {navegador}
  'arrendadores.revision.representante', // Representante legal
  'arrendadores.revision.rango', // {desde} a {hasta}
  'arrendadores.revision.fila', // {campo}: {valor}
  'arrendadores.revision.congelando', // Congelando…
  'arrendadores.constancia.navegador', // Navegador: {navegador}
])

// Singular igual al plural A PROPOSITO (sustantivo invariable o frase sin numero).
const PLURALES_INVARIABLES = new Set<string>([])

describe('portugues L3 · el diccionario entero, sin depender de lo que se rinde', () => {
  for (const [ambito, es, en, pt] of AMBITOS) {
    const claves = Object.keys(es)

    it(`${ambito} · cada clave tiene portugues`, () => {
      expect(claves.filter((k) => typeof pt[k] !== 'string' || pt[k] === '')).toEqual([])
    })

    it(`${ambito} · ninguna clave igual al espanol ni al ingles (salvo cognados declarados)`, () => {
      const copias = claves.filter((k) => !COGNADOS_PT_L3.has(k) && (pt[k] === es[k] || pt[k] === en[k]))
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
    expect([...COGNADOS_PT_L3].filter((k) => !todo[k] || (todo[k][2] !== todo[k][0] && todo[k][2] !== todo[k][1]))).toEqual([])
    expect([...PLURALES_INVARIABLES].filter((k) => !todo[k] || todo[k][2] !== todo[k.replace(/\.uno$/, '.otros')]?.[2])).toEqual([])
  })
})

// Los huecos de fecha de este lote (mas que los de la regla comun): `{cuando}`,
// `{hasta}`, `{fin}`, `{inicio}`, `{fechaFin}`… Se sacan del propio espanol:
// cualquier hueco cuyo nombre diga fecha, dia, vence, desde o hasta.
// `periodo` tambien (validacion H4): en Disponibilidad es «mar. de 2026» o «1/3–14/3».
const NOMBRE_DE_FECHA = /^(?:fecha\w*|\w*Fecha|fin\w*|inicio\w*|desde|hasta|vence\w*|cuando|dia|periodo)$/i
const PREPOSICION = /(?:^|\s)(?:em|no|na|do|da|ao|à|pelo|pela|dia)\s+\{(\w+)\}/gi

describe('portugues L3 · ninguna fecha en hueco con preposicion delante', () => {
  it('en las cuatro tablas del lote', () => {
    const malas: string[] = []
    for (const [, , , pt] of AMBITOS)
      for (const [k, v] of Object.entries(pt))
        for (const m of (v ?? '').matchAll(PREPOSICION)) if (NOMBRE_DE_FECHA.test(m[1])) malas.push(`${k}: ${v}`)
    expect(malas).toEqual([])
  })
  it('y la comprobacion MUERDE', () => {
    const muerde = (s: string) => [...s.matchAll(PREPOSICION)].some((m) => NOMBRE_DE_FECHA.test(m[1]))
    for (const s of ['Pago em {fechaPago}', 'Encerrada no {fecha}', 'locado até o dia {fin}', 'assinado pelo {cuando}', 'não lotados em {periodo}'])
      expect(muerde(s), s).toBe(true)
    for (const s of ['Encerrada: {fecha}', 'até {fin}', 'a partir de {desde}', 'no {sitio}', 'em {donde}'])
      expect(muerde(s), s).toBe(false)
  })
})

describe('portugues L3 · el glosario propio del lote', () => {
  const todo = AMBITOS.flatMap(([, , , pt]) => Object.entries(pt)) as [string, string][]
  it('la OT es «OS»: ninguna «OT» suelta en portugues', () => {
    expect(todo.filter(([, v]) => /\bOTs?\b/.test(v)).map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })
  // Los huecos `{renta}`, `{arrendadores}`… son nombres de variable, no texto.
  const sinHuecos = (v: string) => v.replace(/\{\w+\}/g, '')
  it('ni «pantalla» ni «espectacular» en portugues', () => {
    expect(todo.filter(([, v]) => /pantalla|espectacular/i.test(sinHuecos(v))).map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })
  it('el espectacular es «Painel», la valla «Outdoor» (el cartel de papel brasileño) y la pantalla digital «Tela digital»', () => {
    expect(PT_INVENTARIO['inventario.tipo.espectacular']).toBe('Painel')
    expect(PT_INVENTARIO['inventario.tipo.valla']).toBe('Outdoor')
    expect(PT_INVENTARIO['inventario.tipo.pantalla-digital']).toBe('Tela digital')
    // «outdoor» solo como tipo: en cualquier otro sitio un espectacular no es un outdoor.
    expect(todo.filter(([k, v]) => k !== 'inventario.tipo.valla' && /outdoor/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('ni «arrendador» ni «renta» ni «predio» (locador, aluguel, imovel)', () => {
    expect(todo.filter(([, v]) => /arrendador|\brentas?\b|\bpredios?\b/i.test(sinHuecos(v))).map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })
  it('la constancia es un papel (P3): las partes del contrato y la intro sin fecha en hueco', () => {
    // P3 la escribio tambien en `papeles-portugues.ts`; la costura (05/11)
    // retiro ese archivo y la constancia vive solo aqui. Los papeles los
    // vigila `papeles-portugues.test.ts`; aqui se fija lo nuestro.
    expect(PT_ARRENDADORES['arrendadores.constancia.titulo']).toBe('Comprovante de assinatura eletrônica')
    expect(PT_ARRENDADORES['arrendadores.constancia.parte.arrendador']).toBe('O LOCADOR')
    expect(PT_ARRENDADORES['arrendadores.constancia.parte.arrendatario']).toBe('O LOCATÁRIO')
    expect(PT_ARRENDADORES['arrendadores.constancia.intro']).not.toMatch(/\bem \{fecha\}/)
  })
})

// ─── Validacion del lote (AMBAR, 05/11) ─────────────────────────────────────
// Lo que el validador encontro y ninguna prueba fijaba.
describe('portugues L3 · los hallazgos del validador (ambar, 05/11)', () => {
  it('H1 · al cerrar la OS el candado se ABRE: la facturacion queda liberada, no bloqueada', () => {
    // `OTVista.tsx` lo pinta en verde con `LockOpen` («Billing lock open»,
    // «Fatturazione sbloccata»). «Bloqueio de faturamento ativado» decia lo contrario.
    const abierto = PT_OPERACIONES2['operaciones2.ficha.candado-encendido']
    expect(abierto).toBe('Faturamento liberado')
    expect(abierto).not.toMatch(/bloque|ativad/i)
    // Y las que hablan del candado CERRADO (una OS atrasada lo retiene) siguen diciendolo.
    expect(PT_OPERACIONES2['operaciones2.ot.kpi.frenan']).toBe('mantêm o faturamento bloqueado')
    expect(PT_OPERACIONES2['operaciones2.ot.banner.explica']).toMatch(/mantém o faturamento bloqueado\.$/)
  })
  it('H2 · la ayuda fiscal del alta no dice quien emite ni a quien se emite: el nombre de la fatura', () => {
    expect(PT_ARRENDADORES['arrendadores.alta.fiscales-ayuda']).toMatch(/^É o nome que aparece na fatura do aluguel\. /)
  })
  it('H3 · las rentas atrasadas llevan su sustantivo (aluguel es masculino)', () => {
    expect(PT_ARRENDADORES['arrendadores.pagos.vencidas.uno']).toBe('{n} parcela atrasada ({monto}) · ')
    expect(PT_ARRENDADORES['arrendadores.pagos.vencidas.otros']).toBe('{n} parcelas atrasadas ({monto}) · ')
  })
  it('H4 · el periodo de Disponibilidad sin «em» delante', () => {
    expect(PT_OPERACIONES['operaciones.disponibilidad.kpi.en-periodo']).toBe('no período {periodo}')
    expect(PT_OPERACIONES['operaciones.disponibilidad.kpi.no-llenas']).toBe('não lotados no período {periodo}')
  })
  it('H5 · el ejemplo de domicilio dice CEP (glosario comun)', () => {
    expect(PT_ARRENDADORES['arrendadores.alta.domicilio-ph']).toBe('Rua, número, bairro, CEP, cidade, estado')
    expect(PT_ARRENDADORES['arrendadores.lista.domicilio-ph']).toBe('Rua, número, bairro, CEP, cidade')
  })
  it('H6 · los dias del calendario van de lunes a domingo, como el espanol (la rejilla empieza en lunes)', () => {
    const es = ES_OPERACIONES['operaciones.calendario.dias'].split(',')
    const pt = PT_OPERACIONES['operaciones.calendario.dias'].split(',')
    expect(es).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D'])
    expect(pt).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D'])
  })
})
