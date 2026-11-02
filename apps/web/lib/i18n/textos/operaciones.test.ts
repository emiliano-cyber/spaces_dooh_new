import { describe, it, expect } from 'vitest'
import { ES_OPERACIONES, EN_OPERACIONES } from './operaciones'
import { DICCIONARIOS } from '../diccionario'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ============================================================================
//  EL DICCIONARIO DE OPERACIONES, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo patron que `propuestas.test.ts` y `codigos.test.ts`: una instantanea
//  de los dos idiomas, para que ni el espanol (copia literal) ni el ingles
//  cambien sin que el diff de `__snapshots__/` lo enseñe, y las mismas
//  guardias de forma que los otros lotes.
// ============================================================================

const ES = ES_OPERACIONES as Record<string, string>
const EN = EN_OPERACIONES as Record<string, string>

describe('diccionario de OPERACIONES · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_OPERACIONES).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_OPERACIONES).toMatchSnapshot()
  })
})

describe('diccionario de OPERACIONES · el ingles no esta en espanol', () => {
  // Iguales en los dos idiomas, cada una con su motivo.
  const IGUALES = new Set<string>([
    'operaciones.slots.total', // «{total} slots»: slots no se traduce
    'operaciones.slots.slots', // idem
    'operaciones.disponibilidad.digital', // «digital» es igual en ingles
    'operaciones.disponibilidad.en-propuesta-spots', // «, {n} spots»: spot no se traduce
    'operaciones.imprenta.error', // «Error» es igual en ingles
    'operaciones.imprenta.campo.material', // «Material» tambien
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\S %/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(
      Object.entries(EN)
        .filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|«|»|\b(tap|press)\b/i.test(v))
        .map(([k]) => k),
    ).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })

  it('todo plural lleva sus dos formas', () => {
    const sueltas = Object.keys(ES).filter(
      (k) =>
        (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) ||
        (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
  })

  it('esta dentro del diccionario de la aplicacion', () => {
    for (const k of Object.keys(ES)) {
      expect((DICCIONARIOS.es as Record<string, string>)[k]).toBe(ES[k])
      expect((DICCIONARIOS.en as Record<string, string>)[k]).toBe(EN[k])
    }
  })
})

describe('diccionario de OPERACIONES · los espejos reproducen EXACTAMENTE su modulo', () => {
  // `almacen/page.tsx` traduce `ETIQUETA_TIPO_ACTIVO` y `ETIQUETA_CAMPO` con
  // claves que siguen el nombre del valor (VEHICULO → `tipo.vehiculo`,
  // numeroSerie → `campo.numero-serie`). Los mapas no se exportan (un
  // `page.tsx` de Next no puede), asi que la regla se comprueba aqui.
  it('los tipos de articulo y sus campos (`lib/almacen-tipos.ts`)', async () => {
    const { ETIQUETA_TIPO_ACTIVO, ETIQUETA_CAMPO } = await import('../../almacen-tipos')
    for (const [k, v] of Object.entries(ETIQUETA_TIPO_ACTIVO)) {
      expect(ES[`operaciones.almacen.tipo.${k.toLowerCase()}`]).toBe(v)
    }
    for (const [k, v] of Object.entries(ETIQUETA_CAMPO)) {
      expect(ES[`operaciones.almacen.campo.${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`]).toBe(v)
    }
  })
})

// ============================================================================
//  QUE CLAVE usa cada aviso que NO se rinde (toasts y errores de un `catch`).
// ----------------------------------------------------------------------------
//  Mismo patron que `textos/clientes.test.ts` y `finanzas.test.ts`. La
//  validacion del lote demostro que sin esto sobrevivian M4a (el toast de
//  mover usaba el de registrar) y M4c (el de avanzar una orden usaba el de
//  crearla). Se lee el fuente: cada llamada a la API y, en su `then` o en el
//  `catch` que la sigue, su clave, sin otra API en medio.
// ============================================================================
describe('operaciones · los avisos que no se rinden usan su clave', () => {
  const leer = (r: string) => readFileSync(path.join(__dirname, '../../..', r), 'utf8')
  const fija = (f: string, api: string, clave: string) => {
    const re = new RegExp(`\\b${api}\\((?:(?!Api\\()[\\s\\S])*?t\\('${clave.replace(/\./g, '\\.')}'\\)`)
    expect(f, `${api} → ${clave}`).toMatch(re)
  }

  it('almacen: cargar, registrar y mover avisan cada uno lo suyo, al lograrlo y al fallar', () => {
    const f = leer('app/(app)/(shell)/almacen/page.tsx')
    fija(f, 'getAlmacenApi', 'operaciones.almacen.no-cargar')
    // Exito y fallo, en ese orden: el toast de exito va antes que el del catch.
    expect(f).toMatch(/await crearActivoApi\([\s\S]*?\}\)\s*\n\s*toast\.success\(t\('operaciones\.almacen\.alta\.registrado'\)\)[\s\S]*?toast\.error\(e instanceof Error \? e\.message : t\('operaciones\.almacen\.alta\.no-registrar'\)\)/)
    expect(f).toMatch(/await moverActivoApi\([^\n]*\)\s*\n\s*toast\.success\(t\('operaciones\.almacen\.mover\.registrado'\)\)\s*\n\s*onHecho\(\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('operaciones\.almacen\.mover\.no-mover'\)\)/)
  })

  it('imprenta: avanzar, aprobar la prueba y crear la orden', () => {
    const f = leer('app/(app)/(shell)/imprenta/page.tsx')
    expect(f).toMatch(/await avanzarOrdenImpresionApi\(id\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('operaciones\.imprenta\.no-avanzar'\)\)/)
    expect(f).toMatch(/await aprobarPruebaColorApi\(o\.id, true\) \} catch \(e\) \{ toast\.error\(e instanceof Error \? e\.message : t\('operaciones\.imprenta\.error'\)\)/)
    fija(f, 'crearOrdenImpresionApi', 'operaciones.imprenta.no-crear')
  })
})
