import { describe, it, expect } from 'vitest'
import { ES_COMERCIAL, EN_COMERCIAL, PT_COMERCIAL } from './comercial'
import { ES_CODIGOS, EN_CODIGOS, PT_CODIGOS } from './codigos'
import { ES_PROPUESTAS, EN_PROPUESTAS, PT_PROPUESTAS } from './propuestas'
import { ES_CATALOGOS, EN_CATALOGOS, PT_CATALOGOS } from './catalogos'

// ============================================================================
//  PORTUGUES · lote L2 «Comercial y propuestas» · LA PRUEBA ESTATICA.
// ----------------------------------------------------------------------------
//  La del L5 (`portugues-l5.test.ts`) mas el glosario del italiano L2
//  (`italiano-l2.test.ts`). En portugues hace MAS falta que en italiano: lo
//  que falta cae al ESPANOL (decision del dueno, 05/11), asi que una clave
//  copiada del espanol no se distingue en pantalla de una sin traducir. Se
//  mira el diccionario entero, clave por clave:
//
//    · cada clave de los cuatro ambitos TIENE portugues;
//    · no es IGUAL al espanol ni al ingles, salvo los cognados declarados;
//    · los huecos `{x}` y los espacios de los bordes son los del espanol;
//    · el singular no es igual a su plural, salvo invariables declarados;
//    · comillas curvas “ ”, porcentaje pegado («20%»), ni ñ ni ¿ ¡, ni las
//      palabras espanolas que el portugues no tiene, ni moneda;
//    · y el GLOSARIO obedecido (§2 bis de `portugues-olas.md` y el del lote):
//      si el espanol dice «propuesta», el portugues dice «proposta».
//
//  Las reglas de TODO el portugues —fechas sin preposicion delante y el
//  registro «voce»— ya las vigila `portugues-l5.test.ts` sobre `PT_PARCIAL`,
//  que incluye estos cuatro ambitos.
// ============================================================================

type Dic = Record<string, string>
type DicP = Partial<Record<string, string>>
const AMBITOS: ReadonlyArray<readonly [string, Dic, Dic, DicP]> = [
  ['comercial', ES_COMERCIAL, EN_COMERCIAL, PT_COMERCIAL],
  ['codigos', ES_CODIGOS, EN_CODIGOS, PT_CODIGOS],
  ['propuestas', ES_PROPUESTAS, EN_PROPUESTAS, PT_PROPUESTAS],
  ['catalogos', ES_CATALOGOS, EN_CATALOGOS, PT_CATALOGOS],
]

const todas = () =>
  AMBITOS.flatMap(([, es, en, pt]) => Object.keys(es).map((k) => ({ k, es: es[k], en: en[k], pt: pt[k] ?? '' })))
const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
const sinHuecos = (s: string) => s.replace(/\{\w+\}/g, '')

// Iguales al espanol o al ingles A PROPOSITO: se escriben asi en portugues
// (cognados), anglicismos del sector que se quedan (D-P4), marcas, datos de
// ejemplo y plantillas sin texto.
export const COGNADOS_PT_L2 = new Set<string>([
  'comercial.unidad.resultado', // "resultado"
  'comercial.unidad.resultados', // "resultados"
  'comercial.comun.editar', // "Editar"
  'comercial.comun.tradicional', // "Tradicional"
  'comercial.comun.programatico', // "Programático"
  'comercial.comun.caracteristicas', // "Características"
  'comercial.sitio-estatus.ocupado', // "Ocupado"
  'comercial.sitio-estatus.bloqueado', // "Bloqueado"
  'comercial.tipo-medio.mural', // "Mural"
  'comercial.contrato-estatus.vigente', // "Vigente"
  'comercial.contrato-estatus.vencido', // "Vencido"
  'comercial.contrato-estatus.renovado', // "Renovado"
  'comercial.contrato-estatus.cancelado', // "Cancelado"
  'comercial.contrato-estatus.incompleto', // "Incompleto"
  'comercial.pagina.titulo', // "Comercial"
  'comercial.pagina.kpi.libres.sub', // "de {pantallas}"
  'comercial.pagina.vacio.busqueda', // "“{q}”" (= ingles)
  'comercial.pagina.contrato-incompleto', // "Contrato incompleto"
  'comercial.pagina.slots-hora', // " slots/h"
  'comercial.pagina.reservar', // "Reservar"
  'comercial.pagina.mapa', // "Mapa"
  'comercial.pagina.leyenda.digital', // "Digital"
  'comercial.ficha.pausada.desde', // " · desde {fecha}"
  'comercial.ficha.tipo', // "Tipo"
  'comercial.ficha.medidas', // "Medidas"
  'comercial.ficha.caras', // "Faces" (= ingles)
  'comercial.ficha.exhibicion.digital', // "digital"
  'comercial.ficha.exhibicion.rotativo', // "rotativo"
  'comercial.ficha.exhibicion.rotativa', // " · rotativo"
  'comercial.ficha.iluminado', // "Iluminado"
  'comercial.ficha.total-slots', // "Total de slots"
  'comercial.ficha.slots-hora', // "Slots por hora"
  'comercial.ficha.tarifa-publicada', // "Tarifa publicada ({unidad})"
  'comercial.ficha.renovacion.automatica', // "Automática"
  'comercial.ficha.renovacion.manual', // "Manual"
  'comercial.ficha.proximo', // "Próximo:"
  'comercial.ficha.coordenadas', // "Coordenadas"
  'comercial.ficha.pausar.motivo', // "Motivo"
  'comercial.ficha.pausar.pausando', // "Pausando…"
  'comercial.ficha.pausar.boton', // "Pausar"
  'comercial.vista.norte', // "Norte"
  'comercial.vista.oeste', // "Oeste"
  'comercial.vista.noroeste', // "Noroeste"
  'comercial.tarifas.tarifa', // "Tarifa"
  'comercial.editar.estatus.reservado', // "Reservado"
  'comercial.editar.estatus.ocupado', // "Ocupado"
  'comercial.editar.estatus.bloqueado', // "Bloqueado"
  'comercial.alta.tipo', // "Tipo / formato"
  'comercial.alta.latitud', // "Latitude" (= ingles)
  'comercial.alta.longitud', // "Longitude" (= ingles)
  'comercial.alta.tarifa', // "Tarifa publicada ({simbolo})"
  'comercial.reserva.tipo.dooh', // "Digital"
  'comercial.reserva.tipo.hibrida', // "Híbrida"
  'comercial.reserva.slots', // " · {n} slots"
  'comercial.reserva.reservando', // "Reservando…"
  'comercial.reserva.cliente', // "Cliente"
  'comercial.reserva.cliente-ej', // "Seguros Andinos"
  'comercial.reserva.loop', // "Loop de {loop} · slot de {slot} → {n} slots por loop"
  'comercial.eye.sincronizar', // "Sincronizar"
  'comercial.eye.desconectado', // "Desconectado"
  'comercial.eye.foto', // "foto"
  'comercial.negociacion.canal.whatsapp', // "WhatsApp"
  'comercial.negociacion.oferta.enviada', // "Enviada"
  'comercial.negociacion.etapa.prospecto', // "Prospect" (= ingles)
  'comercial.negociacion.etapa.visita', // "Visita"
  'comercial.negociacion.etapa.perdido', // "Perdido"
  'comercial.negociacion.ficha', // "Ficha técnica"
  'comercial.negociacion.ubicacion.por', // " por {nombre}"
  'comercial.negociacion.contactos.papel', // "Papel"
  'comercial.negociacion.ofertas.meses.otros', // "{n} meses"
  'comercial.negociacion.ofertas.meses-ph', // "Meses"
  'comercial.negociacion.competencia.desde', // "desde {fecha}"
  'comercial.negociacion.competencia.desde-etiqueta', // "Desde"
  'comercial.negociacion.historial.canal', // "Canal"
  'comercial.negociacion.historial.canal-ph', // "Canal…"
  'comercial.negociacion.historial.etapa', // "Etapa"
  'comercial.negociacion.lista.de', // "{n} de {total}"
  'comercial.negociacion.lista.todos', // "Todos"
  'codigos.estado.vigente', // "Vigente"
  'codigos.estado.vencido', // "Vencido"
  'codigos.estados.vigentes', // "Vigentes"
  'codigos.estados.vencidos', // "Vencidos"
  'codigos.col.codigo', // "Código"
  'codigos.col.usos', // "Usos"
  'codigos.pct', // "{pct}%" (= ingles)
  'codigos.usos', // "{usos} de {tope}"
  'codigos.nuevo.codigo', // "Código"
  'propuestas.estatus.enviada', // "Enviada"
  'propuestas.comun.cliente', // "Cliente"
  'propuestas.comun.via', // " · via {agencia}" (= ingles)
  'propuestas.comun.iva', // "IVA {pct}%"
  'propuestas.comun.bruto', // "Bruto"
  'propuestas.comun.total', // "Total"
  'propuestas.comun.codigo-pct', // "Código {codigo} ({pct}%)"
  'propuestas.comun.pct', // "{pct}%" (= ingles)
  'propuestas.comun.enviar', // "Enviar"
  'propuestas.comun.reenviar', // "Reenviar"
  'propuestas.comun.enviando', // "Enviando…"
  'propuestas.comun.aplicar', // "Aplicar"
  'propuestas.comun.aplicando', // "Aplicando…"
  'propuestas.comun.digital', // "Digital"
  'propuestas.lista.resumen', // "{total} {propuestas}"
  'propuestas.lista.resumen.filtrado', // "{n} de {total} {propuestas}"
  'propuestas.lista.filtro.estatus', // "Status" (= ingles)
  'propuestas.lista.filtro.todas', // "Todas"
  'propuestas.lista.sin-resultados.cliente', // " de {cliente}"
  'propuestas.fila.abrir', // "Abrir"
  'propuestas.alta.pie.volumen', // "Volume: {monto}" (= ingles)
  'propuestas.alta.vista.lista', // "Lista"
  'propuestas.alta.vista.mapa', // "Mapa"
  'propuestas.alta.tarifa', // "Tarifa"
  'propuestas.alta.tarifa.calculada', // "calculada {monto}"
  'propuestas.alta.tarifa.monto', // "Tarifa {monto}"
  'propuestas.alta.divisor', // "Divisor ({pct}%)"
  'propuestas.calc.titulo', // "Calculadora de spots"
  'propuestas.calc.de-total', // "de {total} · {libres}"
  'propuestas.calc.loop', // "Loop de {n} {anunciantes}"
  'propuestas.calc.anunciante', // "anunciante"
  'propuestas.calc.anunciantes', // "anunciantes"
  'propuestas.calc.rotaciones', // "{n} loops/h" (= ingles)
  'propuestas.calc.spots-hora', // "{n} spots/h"
  'propuestas.calc.spots-sufijo', // " spots"
  'propuestas.calc.por-spot', // "{monto} por spot"
  'propuestas.embudo.enviadas', // "Enviadas"
  'propuestas.embudo.perdidas', // "Perdidas"
  'propuestas.ficha.copiado', // "Copiado"
  'propuestas.ficha.duplicar', // "Duplicar"
  'propuestas.ficha.meta.anunciante', // "Anunciante"
  'propuestas.ficha.aprobado.bruto', // "Bruto {monto}"
  'propuestas.ficha.aprobado.total', // "Total {monto}"
  'propuestas.ficha.descuento.enviada', // "Enviada"
  'propuestas.ficha.tabla.tarifa-calculada', // "Tarifa calculada {monto}"
  'propuestas.ficha.tabla.ajustada', // "{tarifa} · ajustada por {quien}"
  'propuestas.codigo.opcion', // "{codigo} — {pct}% · {usos}" (= ingles)
  'propuestas.tablero.subtitulo', // "{periodo} · {desde} a {hasta}"
  'propuestas.tablero.col.vendedor', // "Vendedor"
  'propuestas.publica.verificando', // "Verificando…"
  'propuestas.documento.para', // "Para"
  'catalogos.comun.temporada', // "Temporada"
  'catalogos.comun.tarifa', // "Tarifa"
  'catalogos.paquetes.admite-codigo', // "Admite código"
  'catalogos.rejilla.franjas.explicacion.exclusivo', // "exclusivo"
  'catalogos.rejilla.temporadas.titulo', // "Temporadas"
  'catalogos.programacion.marcadas.uno', // " ({n} marcada)"
  'catalogos.programacion.marcadas.otros', // " ({n} marcadas)"
  'catalogos.tarifas.tarifa-de.aria', // "Tarifa de {unidad}"
  'catalogos.volumen.aviso.compone.pct', // "64%" (= ingles)
  'catalogos.volumen.col.a-partir', // "A partir de"
  'catalogos.volumen.pct', // "→ {pct}%" (= ingles)
])

// Singular igual al plural A PROPOSITO.
const PLURALES_INVARIABLES = new Set<string>([])

describe('portugues L2 · completo y bien formado', () => {
  for (const [ambito, es, , pt] of AMBITOS) {
    it(`${ambito} · cada clave tiene portugues, y ninguna sobra`, () => {
      expect(Object.keys(es).filter((k) => typeof pt[k] !== 'string' || pt[k] === '')).toEqual([])
      expect(Object.keys(pt).filter((k) => !(k in es))).toEqual([])
    })
  }

  it('los huecos son los del espanol', () => {
    expect(todas().filter((x) => x.pt && huecos(x.pt) !== huecos(x.es)).map((x) => x.k)).toEqual([])
  })

  it('los espacios de los bordes son los del espanol (la frase va pegada a otro nodo)', () => {
    const borde = (s: string) => `${/^\s/.test(s)}${/\s$/.test(s)}`
    expect(todas().filter((x) => x.pt && borde(x.pt) !== borde(x.es)).map((x) => x.k)).toEqual([])
  })

  it('ninguna clave igual al espanol ni al ingles (salvo cognados declarados)', () => {
    expect(todas().filter((x) => !COGNADOS_PT_L2.has(x.k) && (x.pt === x.es || x.pt === x.en)).map((x) => x.k)).toEqual([])
  })

  it('cada singular dice algo distinto de su plural (salvo invariables declarados)', () => {
    const t = Object.fromEntries(todas().map((x) => [x.k, x.pt]))
    const iguales = Object.keys(t)
      .filter((k) => k.endsWith('.uno') && !PLURALES_INVARIABLES.has(k) && `${k.slice(0, -4)}.otros` in t)
      .filter((k) => t[k] === t[k.replace(/\.uno$/, '.otros')])
    expect(iguales).toEqual([])
  })

  it('los declarados siguen existiendo y siguen siendo iguales (si uno se traduce, se quita)', () => {
    const t = Object.fromEntries(todas().map((x) => [x.k, x]))
    expect([...COGNADOS_PT_L2].filter((k) => !t[k] || (t[k].pt !== t[k].es && t[k].pt !== t[k].en))).toEqual([])
    expect(
      [...PLURALES_INVARIABLES].filter((k) => !t[k] || t[k].pt !== t[k.replace(/\.uno$/, '.otros')]?.pt),
    ).toEqual([])
  })
})

describe('portugues L2 · estilo', () => {
  it('comillas curvas “ ”: ni « » ni rectas (salvo las coordenadas de ejemplo, que son dato)', () => {
    const malas = todas()
      .filter((x) => x.k !== 'comercial.negociacion.buscar.ayuda')
      .filter((x) => /[«»"]/.test(x.pt))
    expect(malas.map((x) => x.k)).toEqual([])
  })

  it('porcentaje pegado a la cifra («20%», D4)', () => {
    expect(todas().filter((x) => /\d %|\} %/.test(x.pt)).map((x) => x.k)).toEqual([])
  })

  it('nada de ortografia espanola: ñ, ¿ ni ¡', () => {
    expect(todas().filter((x) => /[ñÑ¿¡]/.test(sinHuecos(x.pt))).map((x) => x.k)).toEqual([])
  })

  // Palabras que el portugues no tiene: si aparecen, se quedo espanol pegado.
  // Tras guion no cuentan: «alterá-las» es un pronombre portugues.
  const ESPANOL =
    /(?:^|[^\p{L}-])(pantallas?|sitios?|propuestas?|campañas?|arrendador(?:es)?|cupón|guardar|eliminar|quitar|agregar|todavía|aún|también|usuario|ningún|ninguna|después|el|los|las|del|y|Sí|hoy|cuando|cuándo|mismo|aquí)(?=$|[^\p{L}])/iu
  it('ninguna palabra espanola suelta', () => {
    expect(todas().filter((x) => ESPANOL.test(sinHuecos(x.pt))).map((x) => `${x.k}: ${x.pt}`)).toEqual([])
  })
  it('y la comprobacion MUERDE', () => {
    for (const s of ['Reservar sitios', 'Guardar', 'el cliente', 'Sí', 'Nueva propuesta']) expect(ESPANOL.test(s), s).toBe(true)
    for (const s of ['Reservar pontos', 'Salvar', 'o cliente', 'Sim', 'Nova proposta', 'alterá-las']) expect(ESPANOL.test(s), s).toBe(false)
  })

  it('ningun texto da por hecha la moneda (ADR 0048): ni pesos ni reales ni simbolos', () => {
    expect(
      todas()
        .filter((x) => /\bpesos?\b|\breais\b|\breal\b|\bd[óo]lar(?:es)?\b|\b(MXN|USD|BRL)\b|\$/i.test(sinHuecos(x.pt)))
        .map((x) => x.k),
    ).toEqual([])
  })
})

// ─── El glosario, obedecido ─────────────────────────────────────────────────
// §2 bis de `vault/03-Frontend/portugues-olas.md` (comun, lote L5) y el propio
// del lote (subseccion «Lote L2»). Si el espanol dice el termino, el portugues
// dice el suyo. Cada excepcion dice por que.
const GLOSARIO: [string, RegExp, RegExp][] = [
  ['propuesta → proposta', /propuesta/i, /propost/i],
  ['campaña → campanha', /campaña/i, /campanh/i],
  ['arrendador → locador', /arrendador/i, /locador/i],
  ['borrador → rascunho', /borrador/i, /rascunho/i],
  ['franja → faixa horária', /franja/i, /faixa|faixas/i],
  ['paquete → pacote', /paquete/i, /pacote/i],
  ['cupón / código de negociación → código de negociação', /cupón|código de negociación|códigos de negociación/i, /código/i],
  ['folio → Ref. interna', /\bfolio\b/i, /Ref\. interna/i],
  ['espectacular → painel', /espectacular/i, /painel|painéis/i],
  ['sitio → ponto', /\bsitios?\b/i, /\bpontos?\b/i],
  ['pantalla → ponto / tela', /pantalla/i, /\bpontos?\b|\btelas?\b/i],
  ['impactos → impressões', /impactos/i, /impress/i],
  ['salidas / pases → inserções', /\bsalidas\b|\bpases\b/i, /inserç/i],
  ['millar → milhar', /millar/i, /milhar/i],
  ['neto → líquido', /\bneto\b/i, /líquid/i],
  ['comisión → comissão', /comisi[óo]n/i, /comiss/i],
  ['renta → aluguel', /\brentas?\b/i, /alugu/i],
  ['OC → PC', /\bOC\b/, /\bPC\b/],
  ['prima (del Roadblock) → acréscimo', /\bprima\b/i, /acréscimo/i],
  ['rejilla → tabela de preços', /\brejilla\b/i, /tabela de preços/i],
  ['predio → imóvel', /predio/i, /imóve/i],
  ['incidencia → ocorrência', /incidencia/i, /ocorrência/i],
  ['tramo → patamar', /\btramos?\b/i, /patamar|patamares/i],
  ['horario de transmisión → grade de programação', /horario de transmisión|programar el horario/i, /grade de programação/i],
  ['Administración → Configurações', /Administración/, /Configurações/],
  ['Arrendadores (modulo) → Locadores', /Arrendadores/, /Locadores/],
  ['Reportes (modulo) → Relatórios', /Reportes/, /Relatórios/],
  // Costura (05/11), decision del dueno: «Pré-reserva» (era «provisória»).
  ['tentativa → pré-reserva', /tentativ/i, /pré-reserv/i],
  ['liga → link', /\bliga\b/i, /\blink\b/i],
  ['correo → e-mail', /\bcorreo\b/i, /e-mail/i],
  ['rotaciones/h → loops/h', /rotaciones\/h/, /loops\/h/],
  // Validacion del L2 (H6): la valla es el outdoor brasileño (la rama P3 la
  // llamaba «Painel», que es el espectacular).
  ['valla → outdoor', /\bvalla\b/i, /outdoor/i],
]

// Clave → por que no lleva el termino del glosario.
const SIN_TERMINO: Record<string, string> = {
  'comercial.ficha.tramo': '«Tramo» es el tramo de calle de la ficha («Trecho»), no un tramo de volumen',
  'comercial.negociacion.canal.visita': '«Visita en sitio» es ir al lugar («Visita ao local»), no un ponto del inventario',
  'propuestas.ficha.tabla.sin-contrato': '«contrato de renta» es «contrato de locação»: «aluguel» sobraria',
  'propuestas.tablero.sin-costo.uno': '«contrato de renta vigente» → «contrato de locação vigente»',
  'propuestas.tablero.sin-costo.otros': '«contrato de renta vigente» → «contrato de locação vigente»',
  // Costura (05/11), decision del dueno: en los papeles que ve el CLIENTE el
  // folio es «Nº» (el correo: «Nº P-1»); «Ref. interna» es solo dentro de la app.
  'propuestas.correo.folio': 'papel del cliente: «Nº {folio}», decision del dueno del 05/11',
}

describe('portugues L2 · el glosario, obedecido', () => {
  it('si el espanol dice el termino, el portugues dice el suyo', () => {
    const faltan: string[] = []
    for (const x of todas()) {
      if (x.k in SIN_TERMINO) continue
      for (const [nombre, es, pt] of GLOSARIO) {
        if (es.test(sinHuecos(x.es)) && !pt.test(sinHuecos(x.pt))) faltan.push(`${x.k} · ${nombre}`)
      }
    }
    expect(faltan).toEqual([])
  })

  it('las excepciones declaradas siguen siendo excepciones (sin sobrantes)', () => {
    const vivas = Object.keys(SIN_TERMINO).filter((k) => {
      const x = todas().find((y) => y.k === k)
      return x && GLOSARIO.some(([, es, pt]) => es.test(sinHuecos(x.es)) && !pt.test(sinHuecos(x.pt)))
    })
    expect(Object.keys(SIN_TERMINO).filter((k) => !vivas.includes(k))).toEqual([])
  })

  it('y muerde: una frase que traduce «propuesta» por «oferta» cae', () => {
    const [, es, pt] = GLOSARIO[0]
    expect(es.test('Nueva propuesta') && !pt.test('Nova oferta')).toBe(true)
  })
})

// ─── Validacion del L2 (H6): el SENTIDO de las reglas de precio ─────────────
// «20% e 20% deixam o cliente pagando 64%, não 60%» al reves («60%, não 64%»)
// o «não só sobre as que passam» sin el «não» pasaban todas las guardias: el
// texto seguia siendo portugues. Dos guardias baratas:
//
//   · las CIFRAS de cada texto, en el mismo orden que en el espanol (sin los
//     huecos). Compara solo los digitos: «51,2 %» y «51,2%» son la misma
//     secuencia;
//   · si el espanol NIEGA (no, nunca, ni, sin, ningun, nada, tampoco), el
//     portugues tambien niega.
const cifras = (s: string) => (sinHuecos(s).match(/\d+/g) ?? []).join(' ')
// Clave → por que sus cifras no son las del espanol.
const CIFRAS_DISTINTAS: Record<string, string> = {
  'propuestas.ficha.mapa.sin-coords.uno': '«Ninguna de las 1 pantalla» → «O único ponto»: el «1» del español es el plural forzado, no un dato',
}

const NIEGA_ES = /(?:^|[^\p{L}])(no|nunca|ni|sin|ningún|ninguna|ninguno|nada|tampoco|nadie)(?=$|[^\p{L}])/iu
const NIEGA_PT = /(?:^|[^\p{L}])(não|nunca|nem|sem|nenhum|nenhuma|nada|ninguém|tampouco)(?=$|[^\p{L}])/iu
// Clave → por que el portugues no lleva negacion aunque el espanol si.
const SIN_NEGACION: Record<string, string> = {
  'comercial.comun.no-disponible': '«No disponible» → «Indisponível»: niega el prefijo',
  'comercial.pagina.vacio.no-disponible': '«no disponible» → «indisponível»: niega el prefijo',
  'comercial.ficha.pausada.nota': '«No disponible comercialmente…» → «Indisponível para venda…»: niega el prefijo',
  'catalogos.motivo.franja.hora': '«Hora no válida» → «Hora inválida»: niega el prefijo',
  'catalogos.motivo.temporada.fecha': '«Fecha no válida» → «Data inválida»: niega el prefijo',
}

describe('portugues L2 · el sentido de las reglas (validacion, H6)', () => {
  it('las cifras de cada texto son las del espanol, en el mismo orden', () => {
    const malas = todas().filter((x) => !(x.k in CIFRAS_DISTINTAS) && cifras(x.pt) !== cifras(x.es))
    expect(malas.map((x) => `${x.k}: «${cifras(x.es)}» → «${cifras(x.pt)}»`)).toEqual([])
  })
  it('si el espanol niega, el portugues tambien', () => {
    const malas = todas().filter((x) => !(x.k in SIN_NEGACION) && NIEGA_ES.test(sinHuecos(x.es)) && !NIEGA_PT.test(sinHuecos(x.pt)))
    expect(malas.map((x) => `${x.k}: ${x.pt}`)).toEqual([])
  })
  it('las excepciones declaradas siguen siendo excepciones', () => {
    const t = Object.fromEntries(todas().map((x) => [x.k, x]))
    expect(Object.keys(CIFRAS_DISTINTAS).filter((k) => !t[k] || cifras(t[k].pt) === cifras(t[k].es))).toEqual([])
    expect(
      Object.keys(SIN_NEGACION).filter((k) => !t[k] || !NIEGA_ES.test(sinHuecos(t[k].es)) || NIEGA_PT.test(sinHuecos(t[k].pt))),
    ).toEqual([])
  })
  it('y las dos MUERDEN', () => {
    expect(cifras('20% e 20% deixam o cliente pagando 60%, não 64%')).not.toBe(cifras('un 20 % y un 20 % dejan al cliente pagando el 64 %, no el 60 %'))
    expect(cifras('pagando 64%, não 60%')).toBe(cifras('pagando el 64 %, no el 60 %'))
    expect(NIEGA_PT.test('O desconto é aplicado sobre TODAS as unidades, só sobre as que passam do patamar.')).toBe(false)
    expect(NIEGA_PT.test('não só sobre as que passam')).toBe(true)
    expect(NIEGA_ES.test('no solo sobre las que pasan')).toBe(true)
  })
})

describe('portugues L2 · decisiones del lote', () => {
  it('comision → «comissão» en todo el lote (en italiano, «provvigione»)', () => {
    const malas = todas().filter((x) => /comisi[óo]n/i.test(x.es) && !/comiss/i.test(x.pt))
    expect(malas.map((x) => x.k)).toEqual([])
  })
  it('«Network» es femenino: «a Network», nunca «o Network» ni «no Network»', () => {
    expect(todas().filter((x) => /\b(o|no|do|ao) Network\b/.test(x.pt)).map((x) => x.k)).toEqual([])
  })
})
