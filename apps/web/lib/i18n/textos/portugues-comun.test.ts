import { describe, it, expect } from 'vitest'
import { DICCIONARIOS, PT_PARCIAL } from '../diccionario'
import {
  CATALOGO_ERRORES_PT,
  CATALOGO_LIB_PT,
  CAMPO_PT,
  FALTA_FIRMA_PT,
  PERIODICIDAD_PT,
  ETAPA_PT,
  FALTA_REVISION_PT,
  PATRONES_ERROR,
  traducirError,
} from '../errores-servidor'

// ============================================================================
//  PORTUGUES · LO COMUN A LOS CINCO LOTES (costura, 2026-11-05).
// ----------------------------------------------------------------------------
//  Cada lote (L1 Space Eyes y luz, L2 comercial, L3 inventario, L4 campanas,
//  L5 armazon) tiene su prueba estatica (`portugues-l<n>.test.ts`) y vigila
//  SUS claves. Lo que vale para todo el portugues —las decisiones del dueno
//  que cruzan lotes y las guardias de forma— vive aqui y mira todo
//  `PT_PARCIAL` y los catalogos del servidor juntos. Glosario comun final en
//  `vault/03-Frontend/portugues-olas.md` §2 bis.
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>
const PT = PT_PARCIAL as Record<string, string>

describe('portugues · decisiones del dueno del 05/11 (costura)', () => {
  it('Captacion se llama «Captação» a secas: menu y titulo de la pagina', () => {
    // Sustituye a «Captação de pontos» del glosario de la tarde: la pagina
    // lleva tambien clientes, no solo pontos (validacion del L4, duda 1).
    expect(PT['nav.captacion']).toBe('Captação')
    expect(PT['clientes.captacion.titulo']).toBe('Captação')
  })

  it('la reserva tentativa es «Pré-reserva», en todos los lotes (L2, L4)', () => {
    // Sustituye a «Provisória». Lo que se oye en la mídia brasileña.
    expect(PT['campanas.reserva.tentativa']).toBe('Pré-reserva')
    expect(PT['inicio.grafica.tentativas']).toBe('Pré-reservas')
    expect(PT['comercial.reserva.reservar']).toBe('Pré-reservar')
    const tentativas = Object.keys(ES).filter((k) => /tentativ/i.test(ES[k]))
    expect(tentativas.length).toBeGreaterThanOrEqual(3)
    for (const k of tentativas) expect(PT[k], k).toMatch(/pré-reserv/i)
    expect(Object.entries(PT).filter(([, v]) => /provis[óo]ri/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('el dueno del terreno que se capta es «o dono do terreno», en la pantalla y en el error del servidor', () => {
    // El mismo texto lo arma el cliente (`faltantesParaRevision`, L4) y el
    // servidor (`FALTA_REVISION_PT`, L5). Decia «o proprietário» en el
    // servidor; «proprietário» ademas chocaba con el rol Dueño = Titular.
    const es = 'el dueño: un arrendador existente o el nombre y teléfono del contacto'
    expect(FALTA_REVISION_PT[es]).toBe(PT['clientes.captacion.falta.dueno'])
    expect(PT['clientes.captacion.falta.dueno']).toMatch(/^o dono do terreno: /)
  })

  it('el CP fiscal es «CEP» en el rotulo y en el error, en la pantalla y en el servidor (H9 del L4)', () => {
    // El rotulo decia «CEP fiscal» y el error «Código postal inválido»: la
    // misma cosa con dos nombres. Queda «CEP» en los dos; «(5 dígitos)» dice
    // que es el codigo mexicano, no el CEP brasileño de 8.
    expect(PT['clientes.form.cp']).toBe('CEP fiscal')
    expect(PT['clientes.form.cp-invalido']).toBe('CEP inválido (5 dígitos)')
    expect(CATALOGO_ERRORES_PT['Código postal inválido (5 dígitos)']).toBe(PT['clientes.form.cp-invalido'])
    expect(traducirError('Código postal inválido (5 dígitos)', 'pt')).toBe('CEP inválido (5 dígitos)')
  })

  it('«o app», en masculino (validacion del L1): nunca «a app», que es de Portugal', () => {
    const malas = Object.entries(PT).filter(([, v]) => /\b(a|da|na|pela|à) app\b/i.test(v)).map(([k]) => k)
    expect(malas).toEqual([])
    expect(Object.values(PT).some((v) => /\b(o|do|no|pelo|ao) app\b/i.test(v))).toBe(true)
  })
})

// ─── Guardias de forma sobre TODO el portugues ──────────────────────────────
// Cada lote tenia la suya y solo miraba sus claves (la de Portugal, el L1; el
// tuteo ampliado y las palabras solo espanolas, el L4; las fechas, cada uno a
// su manera). Aqui se aplican a todo `PT_PARCIAL` y a los catalogos del
// servidor juntos, para que un lote no se salte la regla de otro.

/** Todo el portugues escrito: el diccionario y las tablas del servidor. */
function todoElPortugues(): Array<[string, string]> {
  const tablas: Array<[string, Partial<Record<string, string>>]> = [
    ['catalogo', CATALOGO_ERRORES_PT], ['lib', CATALOGO_LIB_PT], ['campo', CAMPO_PT], ['firma', FALTA_FIRMA_PT],
    ['periodicidad', PERIODICIDAD_PT], ['etapa', ETAPA_PT], ['falta', FALTA_REVISION_PT],
  ]
  return [
    ...Object.entries(PT),
    ...tablas.flatMap(([n, t]) => Object.entries(t).map(([k, v]): [string, string] => [`servidor/${n}: ${k}`, v ?? ''])),
    ...PATRONES_ERROR.map((p): [string, string] => [`servidor/patron: ${p.en}`, p.pt ?? '']),
  ]
}
const sinHuecos = (v: string) => v.replace(/\{\w+\}/g, '')

// Portugues de Portugal (L1): ecrã, aplicação, telemóvel, ficheiro,
// utilizador, registo, «a app», «já não».
const PT_DE_PORTUGAL =
  /(?:^|[^\p{L}])(ecrãs?|aplicaç(?:ão|ões)|telemóve(?:l|is)|ficheiros?|utilizador(?:es|as?)?|registos?|(?:a|da|na|pela|à|uma) app|já não)(?=$|[^\p{L}])/iu

// El tuteo: el del L5 (pronombres y «Tenta/Escolhe/Digita/Clica») y el del
// L4 (imperativos de 2.a con mayuscula o con enclitico: «Revisa», «revisa-o»).
const TUTEO =
  /(?:^|[^\p{L}{])(?:tu|teu|tua|teus|tuas|contigo|tens|podes|queres|Tenta|Escolhe|Digita|Clica|Revisa|Usa|Completa|Verifica|Ajusta)(?=$|[^\p{L}}-])|(?:^|[^\p{L}])(?:[Rr]evisa|[Uu]sa|[Cc]ompleta|[Vv]erifica|[Aa]justa)-(?:o|a|os|as|lhe|lhes|se)(?=$|[^\p{L}])/u

// Palabras que existen en espanol y NO en portugues (la lista del L4). Sin
// «alta» ni «pago»: tambien son portugues («em alta», «está pago», «Quitado»
// al lado de «pago»), y en todo el diccionario darian falsos positivos; el L4
// las sigue vigilando en su lote, donde se leyeron una por una. Por lo mismo
// salen «fecha» (en portugues, «fecha sozinho»: cierra), «subir» («subir
// criativos», «subir o teto») y «guardar» («guardar uma cópia»), que el L4
// si conserva en su lote.
const SOLO_ESPANOL = [
  'y', 'el', 'los', 'las', 'del', 'pero', 'hay', 'aquí', 'están', 'todavía', 'ningún', 'ninguna', 'hasta', 'cuando',
  'según', 'fechas', 'pantalla', 'pantallas', 'campaña', 'campañas', 'factura', 'facturas', 'cobranza',
  'renta', 'rentas', 'monto', 'montos', 'reporte', 'reportes', 'sitio', 'sitios', 'borrar', 'nuevo', 'nueva',
  'días', 'año', 'años', 'sin', 'cuota', 'cuotas', 'arrendador', 'predio', 'propuesta', 'propuestas', 'llave',
  'también', 'aún', 'quitar', 'agregar', 'eliminar', 'bajar', 'cargando', 'guardando', 'cerrar',
  'libre', 'libres', 'cobro',
]
// Ni detras de un guion: «lê-los», «alterá-las» llevan el pronombre enclitico
// portugues, que se escribe igual que el articulo espanol.
const PALABRA_ESPANOLA = new RegExp(`(?:^|[^\\p{L}{-])(${SOLO_ESPANOL.join('|')})(?=$|[^\\p{L}}])`, 'iu')

// Fechas en hueco (§2 bis): ninguna preposicion ni «dia» delante de un hueco
// cuyo NOMBRE diga fecha (la regla del L3, la mas amplia: `{fechaPago}`,
// `{finGracia}`, `{periodo}`, `{corte}`…).
const NOMBRE_DE_FECHA = /^(?:fecha\w*|\w*Fecha|fin\w*|inicio\w*|desde|hasta|vence\w*|cuando|dia|periodo|corte)$/i
const PREPOSICION = /(?:^|\s)(?:em|no|na|do|da|ao|à|pelo|pela|dia)\s+\{(\w+)\}/gi
const fechaConPreposicion = (v: string) => [...v.matchAll(PREPOSICION)].some((m) => NOMBRE_DE_FECHA.test(m[1]))

// Excepciones legitimas, con su porque. Clave → regla que se salta.
const EXCEPCIONES: Record<string, string> = {
  // «Usa o valor padrão»: el ESTADO de un costo (3.a persona, «Uses the
  // fallback»), no una orden; el espanol dice lo mismo («Usa el respaldo»).
  'admin.costos.respaldo': 'tuteo',
  // Cita una RUTA de la API (`/api/sitios/:id/modalidades`): es un dato, no texto.
  'servidor/catalogo: Las tarifas por unidad se guardan en su propia ruta (PATCH /api/sitios/:id/modalidades), que siempre pide la contraseña.':
    'espanol',
}

// Cada regla por su nombre, para que una excepcion diga cual se salta.
const REGLAS: Record<string, (v: string) => boolean> = {
  portugal: (v) => PT_DE_PORTUGAL.test(sinHuecos(v)),
  tuteo: (v) => TUTEO.test(v),
  espanol: (v) => PALABRA_ESPANOLA.test(v),
  fecha: fechaConPreposicion,
}

/** Las excepciones que sobran: la clave no existe, la regla no existe o su texto ya no la dispara. */
function excepcionesSobrantes(excepciones: Record<string, string>, todo: Array<[string, string]>): string[] {
  const valor = new Map(todo)
  return Object.entries(excepciones)
    .filter(([k, regla]) => !valor.has(k) || !REGLAS[regla] || !REGLAS[regla](valor.get(k)!))
    .map(([k, regla]) => `${k} (${regla})`)
}

describe('portugues · guardias comunes sobre TODO el portugues (costura)', () => {
  const malas = (regla: (v: string) => boolean, nombre: string) =>
    todoElPortugues()
      .filter(([k, v]) => EXCEPCIONES[k] !== nombre && regla(v))
      .map(([k, v]) => `${k}: ${v}`)

  it('mira algo: el diccionario entero y los catalogos del servidor', () => {
    expect(todoElPortugues().length).toBeGreaterThan(5900)
  })
  it('nada del portugues de Portugal', () => {
    expect(malas((v) => PT_DE_PORTUGAL.test(sinHuecos(v)), 'portugal')).toEqual([])
  })
  it('el registro es «você»: ni tuteo de pronombre ni imperativo de 2.a', () => {
    expect(malas((v) => TUTEO.test(v), 'tuteo')).toEqual([])
  })
  it('ninguna palabra que solo existe en espanol', () => {
    expect(malas((v) => PALABRA_ESPANOLA.test(v), 'espanol')).toEqual([])
  })
  it('ninguna fecha en hueco con preposicion delante', () => {
    expect(malas(fechaConPreposicion, 'fecha')).toEqual([])
  })
  // Validacion de la costura (H4): antes solo se miraba que la clave
  // existiera. Si su texto se corrige y deja de disparar la regla, la
  // excepcion sobra y apartaria esa clave de la guardia en silencio.
  it('las excepciones declaradas existen y SIGUEN disparando su regla (si una sobra, se quita)', () => {
    expect(excepcionesSobrantes(EXCEPCIONES, todoElPortugues())).toEqual([])
  })
  it('y esa comprobacion muerde: una excepcion cuyo texto ya no dispara su regla sobra', () => {
    const todo: Array<[string, string]> = [['a', 'Usa o filtro'], ['b', 'Use o filtro']]
    expect(excepcionesSobrantes({ a: 'tuteo' }, todo)).toEqual([])
    expect(excepcionesSobrantes({ b: 'tuteo', a: 'fecha', c: 'tuteo', ...{ a2: 'x' } }, [...todo, ['a2', 'Usa']])).toEqual([
      'b (tuteo)', 'a (fecha)', 'c (tuteo)', 'a2 (x)',
    ])
  })

  it('y las guardias MUERDEN (y dejan pasar el portugues de Brasil)', () => {
    for (const s of ['Toque no ecrã', 'Reinicie a aplicação', 'o ficheiro', 'Abra a app', 'já não existe', 'utilizadores'])
      expect(PT_DE_PORTUGAL.test(s), s).toBe(true)
    for (const s of ['Versão do app', 'Reiniciar o aplicativo', 'Aplicar', 'registro', 'Usuário', 'não existe mais'])
      expect(PT_DE_PORTUGAL.test(s), s).toBe(false)
    for (const s of ['Tenta de novo', 'Escolhe a tua senha', 'Revisa-o antes', 'Usa o filtro', 'e ajusta-os', 'Se tens dúvidas'])
      expect(TUTEO.test(s), s).toBe(true)
    for (const s of ['Tente de novo', 'Escolha sua senha', 'Revise-o', 'Use o filtro', 'a lista completa', 'Revisão', 'usado', '{tu}', 'Usuário'])
      expect(TUTEO.test(s), s).toBe(false)
    for (const s of ['Nada fica libre', 'o cobro', 'Nenhuma campaña', 'Fatura sin pagar'])
      expect(PALABRA_ESPANOLA.test(s), s).toBe(true)
    for (const s of ['Livre hoje', 'pagamento', 'Está pago', 'em alta', 'Desde {desde}', '{sin}', 'sinal', 'lê-los', 'alterá-las', 'fecha sozinho', 'subir o teto', 'guardar uma cópia'])
      expect(PALABRA_ESPANOLA.test(s), s).toBe(false)
    for (const s of ['Vence em {fecha}', 'Pago no {fechaPago}', 'até o dia {fin}', 'saldo ao {corte}', 'não lotados em {periodo}'])
      expect(fechaConPreposicion(s), s).toBe(true)
    for (const s of ['Vence: {fecha}', 'até {fin}', 'a partir de {desde}', '{desde} a {hasta}', 'no {sitio}', 'em {donde}'])
      expect(fechaConPreposicion(s), s).toBe(false)
  })
})

