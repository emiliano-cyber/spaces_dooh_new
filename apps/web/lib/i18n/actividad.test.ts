import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { traducirAccion, traducirEntidadAccion, traducirQuienAccion } from './actividad'
import { ES_ACTIVIDAD, EN_ACTIVIDAD, IT_ACTIVIDAD, PT_ACTIVIDAD } from './textos/actividad'
import { fijarMonedaInstancia } from './dinero'
import { IDIOMAS } from './idiomas'
import { textoBitacoraPropuesta } from '../descuento'
import { textoAccionPublicacion } from '../doohmain-resultado'
import { textoBitacoraAjusteTarifa } from '../tarifa-calculada'
import { textoAccionProgramacion } from '../franja-programada'
import { textoAprobacion, textoReactivacion, textoRechazo, textoQuitadoAlAceptar } from '../codigo-aprobacion'

// ============================================================================
//  LA BITACORA DE ACTIVIDAD, EN INGLES (revision del 18/11).
// ----------------------------------------------------------------------------
//  Con la interfaz en ingles, la pantalla de Actividad salia entera en
//  espanol: el servidor guarda cada renglon en espanol y la pantalla lo
//  pintaba tal cual. Estas pruebas atan las plantillas de
//  `textos/actividad.ts` al CODIGO que escribe la bitacora:
//
//   · cada literal de un `registrarAccion(...)` del arbol se reconoce;
//   · los trozos fijos de cada plantilla `...${x}...` existen en el catalogo;
//   · lo que arman las funciones de texto de verdad (`textoBitacoraPropuesta`,
//     `textoAccionPublicacion`, …) sale en ingles.
//
//  Un renglon nuevo de la bitacora sin plantilla pone esto en rojo.
// ============================================================================

const RAIZ = path.resolve(__dirname, '../..')

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, fuera)
    else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) fuera.push(p)
  }
  return fuera
}

/** El segundo argumento de cada `registrarAccion(`, como texto fuente. */
function segundosArgumentos(): { donde: string; arg: string }[] {
  const out: { donde: string; arg: string }[] = []
  for (const f of [...archivos(path.join(RAIZ, 'app')), ...archivos(path.join(RAIZ, 'lib'))]) {
    if (f.endsWith('acciones-repo.ts')) continue
    const s = readFileSync(f, 'utf8')
    const re = /registrarAccion\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) {
      let j = m.index + m[0].length
      let prof = 1
      let comilla: string | null = null
      let actual = ''
      const args: string[] = []
      while (j < s.length && prof > 0) {
        const c = s[j]
        if (comilla) {
          actual += c
          if (c === '\\') actual += s[++j]
          else if (c === comilla) comilla = null
        } else if (c === "'" || c === '"' || c === '`') {
          comilla = c
          actual += c
        } else if ('([{'.includes(c)) {
          prof++
          actual += c
        } else if (')]}'.includes(c)) {
          prof--
          if (prof > 0) actual += c
        } else if (c === ',' && prof === 1) {
          args.push(actual.trim())
          actual = ''
        } else actual += c
        j++
      }
      args.push(actual.trim())
      out.push({ donde: `${path.relative(RAIZ, f)}:${s.slice(0, m.index).split('\n').length}`, arg: args[1] ?? '' })
    }
  }
  return out
}

/**
 * Parte el argumento en lo que va FUERA de plantillas `...` (donde viven los
 * literales '...' que llegan tal cual a la bitacora) y los trozos fijos de
 * cada plantilla de primer nivel. Lo de dentro de un `${}` no cuenta: son
 * datos (`conteo(n, 'pantalla')`) o subplantillas como « (v${n})».
 */
function partir(arg: string): { fuera: string; trozos: string[] } {
  let fuera = ''
  const trozos: string[] = []
  let i = 0
  // Salta una expresion `${...}` (con comillas y plantillas anidadas dentro).
  const saltarExpresion = () => {
    let prof = 1
    i += 2
    while (i < arg.length && prof > 0) {
      const c = arg[i]
      if (c === '`') saltarPlantilla()
      else if (c === "'" || c === '"') {
        const q = c
        i++
        while (i < arg.length && arg[i] !== q) i += arg[i] === '\\' ? 2 : 1
        i++
      } else {
        if (c === '{') prof++
        else if (c === '}') prof--
        i++
      }
    }
  }
  const saltarPlantilla = () => {
    i++
    while (i < arg.length && arg[i] !== '`') {
      if (arg[i] === '$' && arg[i + 1] === '{') saltarExpresion()
      else i += arg[i] === '\\' ? 2 : 1
    }
    i++
  }
  while (i < arg.length) {
    if (arg[i] !== '`') {
      fuera += arg[i++]
      continue
    }
    i++
    let actual = ''
    while (i < arg.length && arg[i] !== '`') {
      if (arg[i] === '$' && arg[i + 1] === '{') {
        trozos.push(actual)
        actual = ''
        saltarExpresion()
      } else actual += arg[i++]
    }
    trozos.push(actual)
    i++
  }
  return { fuera, trozos: trozos.map((t) => t.trim()).filter((t) => t.length >= 4) }
}

const ES = Object.values(ES_ACTIVIDAD)

describe('bitacora · cada renglon que escribe el servidor tiene su plantilla', () => {
  const args = segundosArgumentos()

  it('se encontraron las llamadas (si esto baja a cero, el barrido dejo de ver el codigo)', () => {
    expect(args.length).toBeGreaterThan(100)
  })

  it('todo literal entre comillas simples se reconoce y sale en ingles', () => {
    const sueltos: string[] = []
    for (const { donde, arg } of args) {
      // Solo los literales que SON el resultado: el argumento entero o una rama
      // de `? :` / `??`. Los de una comparacion (`=== 'APROBADO'`) o los que se
      // pasan a una funcion (`textoAccionPublicacion(x, 'reintento')`) no llegan
      // a la bitacora.
      for (const m of partir(arg).fuera.matchAll(/(?:^|\?\??\s*|:\s*)'((?:[^'\\]|\\.)*)'/g)) {
        const lit = m[1]
        if (!/[a-záéíóúñ]{3}/i.test(lit)) continue
        if (traducirAccion(lit, 'en') === lit) sueltos.push(`${donde} · ${lit}`)
      }
    }
    expect(sueltos).toEqual([])
  })

  it('los trozos fijos de cada plantilla `...${x}...` estan en el catalogo', () => {
    const sueltos: string[] = []
    for (const { donde, arg } of args) {
      for (const trozo of partir(arg).trozos) {
        if (!ES.some((es) => es.includes(trozo))) sueltos.push(`${donde} · «${trozo}»`)
      }
    }
    expect(sueltos).toEqual([])
  })

  it('los mapas de etiquetas que van a la bitacora (almacen, ordenes de Space Eyes) se reconocen', () => {
    const sueltos: string[] = []
    for (const [rel, nombre] of [
      ['app/api/almacen/[id]/movimiento/route.ts', 'ETIQUETA'],
      ['app/api/space-eyes/se/[...ruta]/route.ts', 'ACCION_DE_ORDEN'],
    ]) {
      const s = readFileSync(path.join(RAIZ, rel), 'utf8')
      const bloque = new RegExp(`const ${nombre}[^=]*= \\{([\\s\\S]*?)\\n\\}`).exec(s)
      expect(bloque, `${rel}: no se encontro ${nombre}`).not.toBeNull()
      for (const m of bloque![1].matchAll(/:\s*'([^']+)'/g)) {
        if (traducirAccion(m[1], 'en') === m[1]) sueltos.push(`${rel} · ${m[1]}`)
      }
    }
    expect(sueltos).toEqual([])
  })
})

describe('bitacora · lo que arman las funciones de texto, en ingles', () => {
  beforeAll(() => fijarMonedaInstancia('MXN'))

  it('propuestas: version, descuento y tarifa', () => {
    expect(traducirAccion(textoBitacoraPropuesta(3, null), 'en')).toBe('Updated a proposal (v3)')
    expect(traducirAccion(textoBitacoraPropuesta(2, 0), 'en')).toBe('Removed the discount from the proposal (v2)')
    expect(traducirAccion(textoBitacoraPropuesta(4, 12.5), 'en')).toBe('Set a 12.5% discount on the proposal (v4)')
    expect(
      traducirAccion(textoBitacoraAjusteTarifa({ sitioNombre: 'Reforma 222', unidad: 'MES', tarifaCalculada: 1200, tarifa: 1500, primaRoadblockPct: 25 }), 'en'),
    ).toBe('Changed the rate of “Reforma 222” (MES) from MX$1,200 to MX$1,500 for a Roadblock with a 25% premium on the proposal')
    expect(
      traducirAccion(textoBitacoraAjusteTarifa({ sitioNombre: 'Reforma 222', unidad: 'MES', tarifaCalculada: null, tarifa: 900.5 }), 'en'),
    ).toBe('Set the rate of “Reforma 222” (MES) to MX$900.5, with no calculated rate, on the proposal')
  })

  it('DOOHmain: publicacion y reintento, con plural ingles', () => {
    const una = [{ sitio: 'Reforma', ok: false, error: 'sin pantalla' }]
    const dos = [...una, { sitio: 'Sur', ok: false, error: 'timeout' }]
    expect(traducirAccion(textoAccionPublicacion([]), 'en')).toBe('Published a campaign in DOOHmain')
    expect(traducirAccion(textoAccionPublicacion(una as never), 'en')).toBe('Published in DOOHmain with 1 error: Reforma (sin pantalla)')
    expect(traducirAccion(textoAccionPublicacion(dos as never, 'reintento'), 'en')).toBe(
      'Retried publishing in DOOHmain with 2 errors: Reforma (sin pantalla); Sur (timeout)',
    )
    expect(traducirAccion(textoAccionPublicacion([], 'reintento'), 'en')).toBe('Retried publishing in DOOHmain with no errors')
  })

  it('franja programada y codigos de negociacion', () => {
    const una = textoAccionProgramacion({ franja: { id: 'f', nombre: 'Noche' } as never, campanas: [{ folio: 'C-1', nombre: 'x' }] })
    const tres = textoAccionProgramacion({ franja: null, campanas: [{ folio: 'a', nombre: 'a' }, { folio: 'b', nombre: 'b' }, { folio: 'c', nombre: 'c' }] })
    expect(traducirAccion(una.accion, 'en')).toBe('Scheduled the “Noche” daypart in 1 campaign')
    expect(traducirAccion(tres.accion, 'en')).toBe('Removed the scheduled daypart from 3 campaigns')
    expect(traducirAccion(textoAprobacion('VERANO20', 20), 'en')).toBe('Approved negotiation code VERANO20 (20%)')
    expect(traducirAccion(textoReactivacion('VERANO20'), 'en')).toBe('Reactivated the proposal with negotiation code VERANO20')
    expect(traducirAccion(textoRechazo('VERANO20', 'muy alto'), 'en')).toBe('Rejected negotiation code VERANO20 — reason: muy alto')
    expect(traducirAccion(textoQuitadoAlAceptar('VERANO20'), 'en')).toMatch(/^The client accepted the proposal without negotiation code VERANO20:/)
  })

  it('los renglones con estatus, importe y cifra que se ven en la base de pruebas', () => {
    const casos: [string, string][] = [
      ['Propuesta → ENVIADA (el correo no está configurado: la liga se manda a mano)', 'Proposal → Sent (email isn’t set up: the link is sent by hand)'],
      ['Propuesta → RECHAZADA', 'Proposal → Rejected'],
      ['Avanzó impresión → EN_PRODUCCION', 'Moved printing forward → In production'],
      ['Registró pago $12,000 (liquidado)', 'Recorded payment MX$12,000 (paid in full)'],
      ['Aprobó propuesta · snapshot económico v2 (total $83,592)', 'Approved a proposal · financial snapshot v2 (total MX$83,592)'],
      ['Se asignó automáticamente a 1 pantalla: los creativos aprobados rotan en partes iguales', 'Automatically assigned to 1 screen: approved creatives rotate in equal parts'],
      ['Agregó 2 sitios a la propuesta (v3)', 'Added 2 sites to the proposal (v3)'],
      ['Fijó el horario en DOOHmain: 08:00 a 12:00 (días 1,2,3)', 'Set the schedule in DOOHmain: 08:00 to 12:00 (days 1,2,3)'],
      ['Cambio los idiomas del servidor: es, en, it, pt', 'Changed the server languages: es, en, it, pt'],
    ]
    expect(casos.map(([es]) => traducirAccion(es, 'en'))).toEqual(casos.map(([, en]) => en))
  })
})

describe('bitacora · lo que no es de la plantilla no se toca', () => {
  it('en espanol todo sale tal cual', () => {
    for (const es of ES) expect(traducirAccion(es, 'es')).toBe(es)
    expect(traducirQuienAccion('Sistema', 'es')).toBe('Sistema')
  })
  it('un texto desconocido, y los nombres de la entidad, se pintan como estan', () => {
    expect(traducirAccion('Algo que nadie escribio', 'en')).toBe('Algo que nadie escribio')
    expect(traducirEntidadAccion('Caso · Pantalla Reforma 222', 'en')).toBe('Caso · Pantalla Reforma 222')
  })
  it('la entidad y quien, cuando son frases del servidor', () => {
    expect(traducirEntidadAccion('Intento fallido de desbloqueo', 'en')).toBe('Failed unlock attempt')
    expect(traducirEntidadAccion('equipo 12', 'en')).toBe('device 12')
    // «Movió una oportunidad» guarda la etapa en mayusculas tras el nombre.
    expect(traducirEntidadAccion('Caso C9 · Cuesta de enero · GANADA', 'en')).toBe('Caso C9 · Cuesta de enero · Won')
    expect(traducirEntidadAccion('Caso C9 · Cuesta de enero · GANADA', 'es')).toBe('Caso C9 · Cuesta de enero · GANADA')
    expect(traducirEntidadAccion('Algo · NO_ES_ETAPA', 'en')).toBe('Algo · NO_ES_ETAPA')
    // Las entidades que arman las rutas de precios (codigos, paquetes, volumen).
    expect(traducirEntidadAccion('CASO-INVIERNO10: 10 % · del 2026-11-01 al 2027-12-31 · 20 usos', 'en')).toBe(
      'CASO-INVIERNO10: 10% · from 2026-11-01 to 2027-12-31 · 20 uses',
    )
    expect(traducirEntidadAccion('VERANO20: 20 %', 'en')).toBe('VERANO20: 20%')
    expect(traducirEntidadAccion('Combo Sur: $250,000 por 1 pantalla(s) · precio final, sin códigos', 'en')).toBe(
      'Combo Sur: MX$250,000 for 1 screen · final price, no negotiation codes',
    )
    expect(traducirEntidadAccion('3 pantalla(s)', 'en')).toBe('3 screens')
    expect(traducirEntidadAccion('MES: desde 3 → 5 %', 'en')).toBe('MES: from 3 → 5%')
    expect(traducirQuienAccion('Sistema', 'en')).toBe('System')
    expect(traducirQuienAccion('Cliente (liga pública): Laura', 'en')).toBe('Client (public link): Laura')
  })
})

describe('bitacora · el catalogo', () => {
  const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  it('los cuatro idiomas tienen los mismos huecos', () => {
    const malos: string[] = []
    for (const [nombre, dic] of [['en', EN_ACTIVIDAD], ['it', IT_ACTIVIDAD], ['pt', PT_ACTIVIDAD]] as const) {
      for (const k of Object.keys(ES_ACTIVIDAD) as (keyof typeof ES_ACTIVIDAD)[]) {
        if (huecos(ES_ACTIVIDAD[k]) !== huecos(dic[k])) malos.push(`${nombre} · ${k}`)
      }
    }
    expect(malos).toEqual([])
  })
  it('el ingles no lleva acentos, ñ, signos de apertura ni apostrofo recto', () => {
    expect(Object.entries(EN_ACTIVIDAD).filter(([, v]) => /[áéíóúñ¿¡«»]|[A-Za-z]'[A-Za-z]/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('ninguna entrada inglesa es la espanola (salvo los nombres propios)', () => {
    expect(Object.keys(ES_ACTIVIDAD).filter((k) => ES_ACTIVIDAD[k as keyof typeof ES_ACTIVIDAD] === EN_ACTIVIDAD[k as keyof typeof EN_ACTIVIDAD])).toEqual([])
  })
  it('todos los idiomas existen', () => {
    expect([...IDIOMAS].sort()).toEqual(['en', 'es', 'it', 'pt'])
  })
})
