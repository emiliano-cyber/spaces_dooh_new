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
export const COGNADOS_PT_L4 = new Set<string>([
  'campanas.comun.ver-menos',                          // "Ver menos"
  'campanas.comun.ver-todas',                          // "Ver todas ({n})"
  'campanas.comun.minimizar',                          // "Minimizar"
  'campanas.comun.total',                              // "Total"
  'campanas.comun.ver-contrato',                       // "Ver contrato"
  'campanas.comun.rango-horas',                        // "{inicio} a {fin}"
  'campanas.estado.confirmada',                        // "Confirmada"
  'campanas.estado.cancelada',                         // "Cancelada"
  'campanas.etapa.reservada',                          // "Reservada"
  'campanas.etapa.confirmada',                         // "Confirmada"
  'campanas.etapa.publicada',                          // "Publicada"
  'campanas.creatividad.validada',                     // "Validada"
  'campanas.reserva.confirmada',                       // "Confirmada"
  'campanas.reserva.cancelada',                        // "Cancelada"
  'campanas.ot.bloqueada',                             // "Bloqueada"
  'campanas.ot.cancelada',                             // "Cancelada"
  'campanas.remoto.finished',                          // "Finalizada"
  'campanas.remoto.programada',                        // "Programada"
  'campanas.tipo.ooh',                                 // "OOH"
  'campanas.tipo.dooh',                                // "DOOH"
  'campanas.lista.validar',                            // "Validar"
  'campanas.lista.conteo',                             // "{visibles} de {total}"
  'campanas.lista.ver-pipeline',                       // "Ver pipeline"
  'campanas.ficha.pipeline',                           // "Pipeline"
  'campanas.ficha.comercial',                          // "Comercial"
  'campanas.ficha.iva-pct',                            // "IVA ({pct}%)"
  'campanas.ficha.total-contratado',                   // "Total contratado (cliente)"
  'campanas.ficha.snapshot',                           // "snapshot"
  'campanas.ficha.estimado',                           // "estimado"
  'campanas.ficha.documento',                          // "Documento"
  'campanas.ficha.seccion.completo',                   // "Completo"
  'campanas.ficha.seccion.expandir',                   // "Expandir"
  'campanas.menu.boton.ocultar',                       // "Ocultar"
  'campanas.creativo.codigo',                          // "Código"
  'campanas.candado.registrando',                      // "Registrando…"
  'campanas.doohmain-ahora.pausar',                    // "Pausar"
  'campanas.facturacion.cliente',                      // "Cliente"
  'campanas.facturacion.rfc',                          // "RFC"
  'campanas.facturacion.iva',                          // "IVA"
  'campanas.facturacion.clientes',                     // "Clientes"
  'campanas.facturacion.falta',                        // "— falta —"
  'campanas.evidencia.foto',                           // "foto"
  'campanas.playlogs.rango',                           // "{desde} a {hasta}"
  'campanas.playlogs.anteriores',                      // "Consultas anteriores ({n})"
  'campanas.doohmain.dia.6',                           // "Sáb"
  'campanas.doohmain.dia.0',                           // "Dom"
  'campanas.doohmain.horario.de',                      // "De"
  'campanas.doohmain.horario.a',                       // "a"
  'campanas.doohmain.cliente',                         // "Cliente:"
  'campanas.doohmain.lista',                           // " · lista {lista}"
  'campanas.validacion.retirado',                      // "Retirado"
  'campanas.validacion.motivo',                        // "Motivo: {motivo}"
  'campanas.validacion.enviando',                      // "Enviando…"
  'campanas.validacion.publicando',                    // "Publicando…"
  'campanas.validacion.resultado.publicada',           // "Publicada"
  'finanzas.comun.ver-menos',                          // "Ver menos"
  'finanzas.comun.ver-todas',                          // "Ver todas ({n})"
  'finanzas.comun.cliente',                            // "Cliente"
  'finanzas.comun.iva-pct',                            // "IVA ({pct}%)"
  'finanzas.comun.total',                              // "Total"
  'finanzas.comun.enviando',                           // "Enviando…"
  'finanzas.cobranza.vencida',                         // "Vencida"
  'finanzas.vence.dias',                               // "{n}d"
  'finanzas.cobranza.chip.vencidas',                   // "Vencidas"
  'finanzas.cobranza.col.estatus',                     // "Status"
  'finanzas.cobranza.saldo',                           // "saldo {monto}"
  'finanzas.cobranza.ultimo',                          // "Último: {fecha}"
  'finanzas.cobranza.enviados.uno',                    // "{n} enviado"
  'finanzas.cobranza.enviados.otros',                  // "{n} enviados"
  'finanzas.facturas.chip.emitidas',                   // "Emitidas"
  'finanzas.facturas.col.emitida',                     // "Emitida"
  'finanzas.facturas.estatus.emitida',                 // "Emitida"
  'finanzas.pago.subtitulo',                           // "{folio} · saldo {saldo}"
  'finanzas.estado-cuenta.col.saldo',                  // "Saldo"
  'finanzas.csv.archivo.cliente',                      // "cliente"
  'finanzas.periodo.subtitulo',                        // "{etiqueta} · {desde} a {hasta}"
  'finanzas.comprobante.imprimir',                     // "Imprimir"
  'finanzas.comprobante.uso',                          // "Uso: {uso}"
  'finanzas.comprobante.subtotal',                     // "Subtotal"
  'finanzas.comprobante.iva',                          // "IVA"
  'clientes.titulo',                                   // "Clientes"
  'clientes.lista.titulo',                             // "Lista de clientes"
  'clientes.lista.de',                                 // "{n} de {total}"
  'clientes.lista.cliente.uno',                        // "cliente"
  'clientes.lista.cliente.otros',                      // "clientes"
  'clientes.lista.tipo',                               // "Tipo de cliente"
  'clientes.col.cliente',                              // "Cliente"
  'clientes.col.rfc',                                  // "RFC"
  'clientes.col.tipo',                                 // "Tipo"
  'clientes.editar.nombre',                            // "Editar {nombre}"
  'clientes.editar',                                   // "Editar cliente"
  'clientes.form.cp-invalido',                         // "Código postal inválido (5 dígitos)"
  'clientes.form.tipo',                                // "Tipo"
  'clientes.form.iva',                                 // "IVA (%)"
  'clientes.pipeline.titulo',                          // "Pipeline"
  'clientes.pipeline.etapa.enviada',                   // "Enviada"
  'clientes.comisiones.col.clientes',                  // "Clientes"
  'clientes.comisiones.col.cliente',                   // "Cliente"
  'clientes.comisiones.validada',                      // "Validada"
  'clientes.comisiones.validar',                       // "Validar"
  'clientes.captacion.vista.todos',                    // "Todos"
  'clientes.captacion.tipo.cliente',                   // "Cliente"
  'clientes.captacion.campo.rfc',                      // "RFC"
  'clientes.captacion.campo.tipo-pantalla',            // "Tipo"
  'clientes.captacion.campo.caras',                    // "Faces"
  'clientes.captacion.estatica',                       // "Estática"
  'clientes.captacion.digital',                        // "Digital"
  'clientes.captacion.detalle.etapa',                  // "Etapa"
  'clientes.captacion.detalle.vendedor',               // "Vendedor"
  'clientes.captacion.prospectos',                     // "Prospects"
  'clientes.captacion.col.tipo',                       // "Tipo"
  'clientes.captacion.col.etapa',                      // "Etapa"
  'clientes.captacion.col.vendedor',                   // "Vendedor"
  'clientes.captacion.vencido',                        // "vencido"
  'clientes.captacion.anterior',                       // "Anterior"
  'reportes.resultado',                                // "Resultado"
  'reportes.periodos',                                 // "{n} {periodos}"
  'reportes.filtro.agrupar',                           // "Agrupar"
  'reportes.dim.trimestre',                            // "Por trimestre"
  'reportes.dim.vendedor',                             // "Por vendedor"
  'reportes.gran.trimestre',                           // "Trimestral"
  'reportes.col.trimestre',                            // "Trimestre"
  'reportes.col.vendedor',                             // "Vendedor"
  'reportes.col.visitas',                              // "Visitas"
  'reportes.col.consumo',                              // "Consumo"
  'reportes.tabla.total',                              // "Total ({n})"
  'reportes.tabla.horas-de',                           // "de {n} {visitas}"
  'reportes.tabla.visitas.uno',                        // "visita"
  'reportes.tabla.visitas.otros',                      // "visitas"
  'reportes.cuenta.trimestre.uno',                     // "{n} trimestre"
  'reportes.cuenta.trimestre.otros',                   // "{n} trimestres"
  'reportes.cuenta.vendedor.uno',                      // "{n} vendedor"
  'reportes.cuenta.vendedor.otros',                    // "{n} vendedores"
  'inicio.pipeline-sub',                               // "{propuestas} · {enviadas}"
  'inicio.enviadas.uno',                               // "{n} enviada"
  'inicio.enviadas.otros',                             // "{n} enviadas"
  'inicio.costo.total',                                // "Total"
  'inicio.gran.semana',                                // "Semana"
  'inicio.pipeline',                                   // "Pipeline comercial"
  'inicio.alertas',                                    // "Alertas"
  'inicio.urgentes.uno',                               // "{n} urgente"
  'inicio.urgentes.otros',                             // "{n} urgentes"
  'inicio.ver-menos',                                  // "Ver menos"
  'inicio.ver-todas',                                  // "Ver todas ({n})"
  'inicio.ver-todos',                                  // "Ver todos ({n})"
  'inicio.config-alertas',                             // "Configurar alertas"
  'inicio.leyenda.digital',                            // "Digital"
  'inicio.grafica.confirmadas',                        // "Confirmadas"
  'inicio.alerta.contrato-incompleto',                 // "Contrato incompleto"
  'inicio.alerta.contrato-vencido',                    // "Contrato vencido"
  'inicio.incidencia.clima',                           // "clima"
  'inicio.incidencia.legal',                           // "legal"
  'inicio.incidencia.vandalismo',                      // "vandalismo"
])

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
  'días', 'año', 'años', 'sin', 'cuota', 'cuotas', 'arrendador', 'predio', 'propuesta', 'propuestas', 'llave',
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
