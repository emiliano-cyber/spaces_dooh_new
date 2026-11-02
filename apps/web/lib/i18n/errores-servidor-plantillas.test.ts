import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { CATALOGO_ERRORES, FALTA_FIRMA_EN, PATRONES_ERROR, traducirError } from './errores-servidor'
import { EN_COMPARTIDOS } from './textos/compartidos'
import { ETIQUETA_ETAPA, faltantesParaRevision } from '../captacion'
import { PERIODICIDAD_VALUES } from '../renta-periodicidad'

// ============================================================================
//  LOTE SERVIDOR (ola 4, 2026-11-02) · LAS PLANTILLAS DE ERROR CON HUECOS.
// ----------------------------------------------------------------------------
//  I18N-05 dejo fuera, contadas, las `new AppError(`...${x}...`)`: un catalogo
//  de frases no las cubre porque el mensaje ya llega ARMADO —«Son 41 archivos
//  y el maximo por tanda es 40»— y la frase exacta no existe en ningun sitio.
//
//  Se cubren como ya se cubrian los motivos de zod con un numero dentro: un
//  PATRON con huecos que reconoce el mensaje armado y lo rearma en ingles,
//  conservando los valores. Asi el español sigue siendo la fuente, no se toca
//  ni una letra de los 44 sitios, y `lib/server/errores.ts` —archivo de alto
//  contacto— no cambia.
//
//  La otra via —que `AppError` aceptara una clave y sus valores— obligaba a
//  tocar los 44 sitios, `errores.ts` y el embudo, y a reescribir el español
//  como plantilla del diccionario. Esta toca UN archivo.
//
//  ─── LA GUARDIA ─────────────────────────────────────────────────────────
//  Como la de literales de `errores-servidor.test.ts`, pero para plantillas:
//  recorre el arbol, saca cada `new AppError(` cuyo primer argumento lleva
//  `${…}`, ARMA un mensaje de ejemplo rellenando los huecos, y exige que en
//  español salga identico y en ingles salga traducido. Una plantilla nueva sin
//  patron pone esto EN ROJO.
// ============================================================================

const RAIZ = path.resolve(__dirname, '..', '..')
const PODAR = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git'])

/**
 * Plantillas que NO se traducen por patron, cada una con su motivo. Una
 * entrada nueva aqui es una decision, no un descuido.
 */
const DECLARADAS: Record<string, string> = {
  'lib/server/errores.ts':
    'es `validar()`: compone «Campo: motivo» y se traduce POR PARTES (CAMPO_EN + catalogo), no por patron',
}

function fuentes(dir: string = RAIZ, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (PODAR.has(e.name)) continue
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) fuentes(abs, acc)
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(abs)
  }
  return acc
}

function sinComentarios(src: string): string {
  const blanquear = (m: string) => m.replace(/[^\n]/g, ' ')
  return src.replace(/\/\*[\s\S]*?\*\//g, blanquear).replace(/\/\/[^\n]*/g, blanquear)
}

// El primer argumento de la llamada, hasta la coma de nivel 0. Sabe saltar
// cadenas, plantillas (con sus `${…}` anidados) y parentesis.
function primerArgumento(s: string, i: number): string {
  let nivel = 0
  let j = i
  while (j < s.length) {
    const c = s[j]
    if (c === "'" || c === '"') {
      j++
      while (j < s.length && s[j] !== c) j += s[j] === '\\' ? 2 : 1
      j++
      continue
    }
    if (c === '`') {
      j++
      let dentro = 0
      while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue }
        if (s[j] === '`' && dentro === 0) break
        if (s[j] === '$' && s[j + 1] === '{') { dentro++; j += 2; continue }
        if (s[j] === '}' && dentro > 0) { dentro--; j++; continue }
        j++
      }
      j++
      continue
    }
    if ('([{'.includes(c)) nivel++
    else if (')]}'.includes(c)) {
      if (nivel === 0) break
      nivel--
    } else if (c === ',' && nivel === 0) break
    j++
  }
  return s.slice(i, j).trim()
}

// El valor con que se rellena un hueco para armar el ejemplo. `campo` es el
// prefijo «Campo: » de `uploads.ts` (vacio cuando no hay campo); un ternario
// de plural toma la rama del plural; lo demas, un numero, que casa con un
// hueco de texto y con uno de cifras.
function rellenar(expr: string): string {
  const e = expr.trim()
  if (e === 'campo') return ''
  const ternario = /\?\s*'([^']*)'\s*:\s*'([^']*)'\s*$/.exec(e)
  if (ternario) return ternario[2]
  return '7'
}

// Arma el mensaje de ejemplo de una concatenacion de literales y plantillas.
function armarEjemplo(arg: string): string {
  let out = ''
  let i = 0
  while (i < arg.length) {
    const c = arg[i]
    if (c === "'" || c === '"') {
      let j = i + 1
      while (arg[j] !== c) {
        out += arg[j] === '\\' ? arg[++j] : arg[j]
        j++
      }
      i = j + 1
      continue
    }
    if (c === '`') {
      let j = i + 1
      while (arg[j] !== '`') {
        if (arg[j] === '\\') { out += arg[j + 1]; j += 2; continue }
        if (arg[j] === '$' && arg[j + 1] === '{') {
          let k = j + 2
          let prof = 1
          while (prof > 0) {
            if (arg[k] === '{') prof++
            else if (arg[k] === '}') prof--
            k++
          }
          out += rellenar(arg.slice(j + 2, k - 1))
          j = k
          continue
        }
        out += arg[j]
        j++
      }
      i = j + 1
      continue
    }
    i++
  }
  return out
}

type Plantilla = { sitio: string; archivo: string; ejemplo: string }

function plantillas(): Plantilla[] {
  const out: Plantilla[] = []
  for (const abs of fuentes()) {
    const archivo = path.relative(RAIZ, abs).replace(/\\/g, '/')
    const src = sinComentarios(readFileSync(abs, 'utf8'))
    const re = /new AppError\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      const arg = primerArgumento(src, m.index + m[0].length)
      if (!arg.includes('`')) continue
      const linea = src.slice(0, m.index).split('\n').length
      out.push({ sitio: `${archivo}:${linea}`, archivo, ejemplo: armarEjemplo(arg) })
    }
  }
  return out
}

// Lo que delata español en una traduccion: acentos, eñes, signos de apertura
// y las palabras funcionales que el ingles no tiene.
const RASTRO_ESPANOL = /[áéíóúñ¿¡]|\b(de|del|la|las|los|el|que|una|por|para|con|esta|está|ya|antes)\b/i

describe('GUARDIA · las plantillas de AppError con huecos', () => {
  const todas = plantillas()

  it('el arnes encuentra plantillas (no mira al vacio)', () => {
    // 45 el 02/11: 44 mensajes + la composicion de `validar()`.
    expect(todas.length).toBeGreaterThanOrEqual(44)
    expect(todas.map((p) => p.ejemplo)).toContain('Son 7 archivos y el maximo por tanda es 7.')
  })

  it('en español TODAS salen identicas, letra por letra', () => {
    for (const p of todas) expect(traducirError(p.ejemplo, 'es')).toBe(p.ejemplo)
  })

  it('en ingles NINGUNA se queda en español, salvo las declaradas con motivo', () => {
    const sinTraducir: string[] = []
    for (const p of todas) {
      if (p.archivo in DECLARADAS) continue
      const en = traducirError(p.ejemplo, 'en')
      if (en === p.ejemplo || RASTRO_ESPANOL.test(en)) {
        sinTraducir.push(`${p.sitio} · ${JSON.stringify(p.ejemplo)} → ${JSON.stringify(en)}`)
      }
    }
    expect(sinTraducir).toEqual([])
  })

  it('los valores de los huecos se CONSERVAN en el ingles', () => {
    const perdidos: string[] = []
    for (const p of todas) {
      if (p.archivo in DECLARADAS) continue
      const enEs = (p.ejemplo.match(/7/g) ?? []).length
      const enEn = (traducirError(p.ejemplo, 'en').match(/7/g) ?? []).length
      if (enEn !== enEs) perdidos.push(`${p.sitio} · ${enEs} → ${enEn}`)
    }
    expect(perdidos).toEqual([])
  })

  it('las declaradas existen de verdad (una lista con fantasmas miente)', () => {
    for (const archivo of Object.keys(DECLARADAS)) {
      expect(todas.some((p) => p.archivo === archivo)).toBe(true)
    }
  })
})

describe('las plantillas con valores REALES', () => {
  const en = (m: string) => traducirError(m, 'en')

  it('plurales: uno y varios no se dicen igual', () => {
    expect(en('No se puede eliminar: 1 contrato factura a esta razón social. Cámbiala en esos contratos primero.')).toBe(
      'Cannot delete: 1 contract bills to this legal entity. Change it in that contract first.',
    )
    expect(en('No se puede eliminar: 3 contratos facturan a esta razón social. Cámbiala en esos contratos primero.')).toBe(
      'Cannot delete: 3 contracts bill to this legal entity. Change it in those contracts first.',
    )
    expect(en('El PDF tiene 1 paginas y un recibo de CFE tiene 2. Sube los recibos por separado.')).toBe(
      'The PDF has 1 page and a CFE bill has 2. Upload the bills separately.',
    )
    expect(en('El PDF tiene 5 paginas y un recibo de CFE tiene 2. Sube los recibos por separado.')).toBe(
      'The PDF has 5 pages and a CFE bill has 2. Upload the bills separately.',
    )
  })

  it('la periodicidad del hueco sale en ingles y en letra', () => {
    const m = (p: string) =>
      `La vigencia del contrato genera más de 600 pagos con periodicidad ${p}. Revisa la fecha de fin: ` +
      'con esa cadencia el calendario no puede cubrir un plazo tan largo.'
    expect(en(m('catorcenal'))).toBe(
      'The contract term generates more than 600 payments billed every two weeks. Check the end date: ' +
        'at that frequency the schedule cannot cover such a long term.',
    )
    expect(en(m('mensual'))).toContain('payments billed monthly.')
    expect(en(m('quincenal'))).toContain('payments billed twice a month.')
  })

  it('la etapa del prospecto y la lista de lo que falta', () => {
    expect(en('No se puede editar un prospecto aprobado')).toBe('This prospect cannot be edited: it is approved')
    expect(en('No se puede editar un prospecto en revisión')).toBe('This prospect cannot be edited: it is in review')
    expect(en('Para enviarlo a revisión falta: la dirección, el dueño: un arrendador existente o el nombre y teléfono del contacto')).toBe(
      'To send it for review, this is missing: the address, the owner: an existing landlord or the contact’s name and phone number',
    )
  })

  it('lo que bloquea el borrado de un cliente, pieza por pieza', () => {
    expect(en('No se puede borrar: el cliente tiene 1 campaña y 2 facturas. Quítalos o reasígnalos antes de borrarlo.')).toBe(
      'Cannot delete: the client has 1 campaign and 2 invoices. Remove or reassign them before deleting it.',
    )
    expect(
      en(
        'No se puede borrar: el cliente tiene 3 clientes que lo tienen como agencia y 1 propuesta que lo tienen como agencia. ' +
          'Quítalos o reasígnalos antes de borrarlo.',
      ),
    ).toBe(
      'Cannot delete: the client has 3 clients that have it as their agency and 1 proposal that has it as its agency. ' +
        'Remove or reassign them before deleting it.',
    )
  })

  it('los datos que faltan para firmar, con sus etiquetas', () => {
    expect(en('No se puede enviar a firma: faltan 2 datos por capturar (RFC del arrendador, Importe de la renta).')).toBe(
      'Cannot send for signature: 2 fields are still missing (Landlord’s RFC, Rent amount).',
    )
    expect(en('No se puede enviar a firma: faltan 1 datos por capturar (Fecha de fin).')).toBe(
      'Cannot send for signature: 1 field is still missing (End date).',
    )
  })

  it('la pantalla lejos del predio', () => {
    const cola =
      '. Un predio es un solo inmueble y su renta se reparte entre las pantallas que cuelgan de él, así que una ' +
      'que está lejos abarataría a las demás. Revisa la dirección o las coordenadas, o dale su propio predio. ' +
      '(El límite son 300 m.)'
    const colaEn =
      '. A property is a single premises and its rent is split among the screens attached to it, so one that is ' +
      'far away would lower the cost for the others. Check the address or the coordinates, or give it its own ' +
      'property. (The limit is 300 m.)'
    expect(en(`La pantalla está a 1.2 km de el predio "Centro"${cola}`)).toBe(`The screen is 1.2 km from the property “Centro”${colaEn}`)
    expect(en(`"Norte 2" está a 450 m de "Norte 1", que ya está en el predio "Centro"${cola}`)).toBe(
      `“Norte 2” is 450 m from “Norte 1”, which is already on the property “Centro”${colaEn}`,
    )
  })

  it('las subidas: con campo conocido, desconocido y sin campo', () => {
    expect(en('El archivo está vacío')).toBe('The file is empty')
    expect(en('Logo: El archivo está vacío')).toBe('Logo: The file is empty')
    // `arte` es el nombre de la propiedad, no una etiqueta: se conserva.
    expect(en('arte: El archivo supera el límite de 10 MB')).toBe('arte: The file exceeds the 10 MB limit')
    expect(en('imagen: Tipo de archivo no permitido aquí. Se aceptan: JPG, PNG')).toBe(
      'imagen: File type not allowed here. Accepted: JPG, PNG',
    )
  })

  it('un periodo pagado «sin fecha» no deja el hueco en español', () => {
    expect(en('Este periodo ya está pagado (sin fecha). Cancélalo antes de volver a registrarlo.')).toBe(
      'This period is already paid (no date). Cancel it before recording it again.',
    )
  })

  it('la calculadora sin cantidad enviada: «ninguna» no se queda en español', () => {
    expect(
      en('La cantidad de spots no cuadra con la calculadora: con 3 espacios, 2 h al día y 10 días son 60 spots, no ninguna.'),
    ).toBe('The spot quantity does not match the calculator: with 3 slots, 2 h a day and 10 days it is 60 spots, not none.')
  })
})

describe('las tablas de los huecos estan COMPLETAS contra el codigo que las produce', () => {
  it('cada etiqueta de `exigir(...)` de contrato-documento.ts tiene su ingles', () => {
    // Una etiqueta nueva sin traducir dejaria media lista en español. Se leen
    // del fuente, con comentarios tachados, igual que la guardia de arriba.
    const src = sinComentarios(readFileSync(path.join(RAIZ, 'lib/contrato-documento.ts'), 'utf8'))
    const etiquetas = [...src.matchAll(/exigir\([^,]+,\s*'([^']+)'/g)].map((m) => m[1])
    expect(etiquetas.length).toBeGreaterThanOrEqual(12)
    expect(etiquetas.filter((e) => !(e in FALTA_FIRMA_EN))).toEqual([])
  })

  it('cada faltante de `faltantesParaRevision` sale en ingles', () => {
    const vacios = (['CLIENTE', 'ARRENDADOR', 'PREDIO', 'PANTALLA'] as const).flatMap((tipo) =>
      faltantesParaRevision({ tipo, nombre: 'x', contacto: {}, direccion: null, datos: {} }),
    )
    expect(vacios.length).toBeGreaterThanOrEqual(3)
    const msg = `Para enviarlo a revisión falta: ${[...new Set(vacios)].join(', ')}`
    expect(traducirError(msg, 'en')).not.toMatch(RASTRO_ESPANOL)
  })

  it('cada etapa de captacion sale en ingles', () => {
    for (const etiqueta of Object.values(ETIQUETA_ETAPA)) {
      const en = traducirError(`No se puede editar un prospecto ${etiqueta.toLowerCase()}`, 'en')
      expect(en).not.toMatch(RASTRO_ESPANOL)
    }
  })

  it('cada periodicidad de renta sale en ingles', () => {
    for (const p of PERIODICIDAD_VALUES) {
      const en = traducirError(
        `La vigencia del contrato genera más de 9 pagos con periodicidad ${p.toLowerCase()}. Revisa la fecha de fin: ` +
          'con esa cadencia el calendario no puede cubrir un plazo tan largo.',
        'en',
      )
      expect(en).not.toMatch(RASTRO_ESPANOL)
      // Y en letra, como la periodicidad de la interfaz (costura).
      const letra = (EN_COMPARTIDOS as Record<string, string>)[`compartidos.periodicidad.${p.toLowerCase()}`]
      expect(en).toContain(`billed ${letra.toLowerCase()}.`)
    }
  })
})

describe('el ESPAÑOL del catalogo entero sale identico', () => {
  it('traducirError(m, "es") === m para cada clave del catalogo', () => {
    for (const m of Object.keys(CATALOGO_ERRORES)) expect(traducirError(m, 'es')).toBe(m)
  })

  it('ningun patron nuevo se come un mensaje del catalogo (el exacto gana)', () => {
    for (const [es, enEsperado] of Object.entries(CATALOGO_ERRORES)) {
      expect(traducirError(es, 'en')).toBe(enEsperado)
    }
  })

  it('cada patron tiene al menos un hueco', () => {
    for (const p of PATRONES_ERROR) expect(p.en).toMatch(/\$\d/)
  })
})
