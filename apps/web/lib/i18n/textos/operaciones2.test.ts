import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_OPERACIONES2, EN_OPERACIONES2 } from './operaciones2'
import { TIPO_OT_LABEL } from '@/lib/tipos-ot'
import { CLAVE_PRIORIDAD, CLAVE_TIPO_OT } from '@/components/operaciones/claves'
import { avisoAntesDeCerrar, leerCostoOt, textoCostoDeCerrada } from '@/lib/costo-ot-captura'
import { traducir } from '../diccionario'

// ============================================================================
//  EL DICCIONARIO DE OPERACIONES (parte 2), CONGELADO — y atado a sus fuentes.
// ----------------------------------------------------------------------------
//  Mismo patron que `catalogos.test.ts` y `finanzas.test.ts`: una instantanea
//  de los dos idiomas y las mismas guardias de forma. Y, como las gemelas de
//  Finanzas y Comercial, lee del FUENTE que clave usa cada aviso que no se
//  rinde (toasts, `alert`, `prompt`, `mensajeSiFalla`).
// ============================================================================

const ES = ES_OPERACIONES2 as Record<string, string>
const EN = EN_OPERACIONES2 as Record<string, string>

describe('diccionario de OPERACIONES (parte 2) · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_OPERACIONES2).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_OPERACIONES2).toMatchSnapshot()
  })
})

describe('diccionario de OPERACIONES (parte 2) · el ingles no esta en espanol', () => {
  // Textos que se escriben igual en los dos idiomas, cada uno con su motivo.
  const IGUALES = new Set<string>([
    'operaciones2.prioridad.normal', // «Normal» es la misma palabra
    'operaciones2.ot.nueva.opcion-digital', // «· Digital» es la misma palabra
    'operaciones2.ficha.checklist', // «Checklist» ya es un anglicismo en espanol
  ])

  it('ninguna entrada inglesa es igual a la espanola, salvo las declaradas', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k] && !IGUALES.has(k))).toEqual([])
  })

  it('las declaradas siguen siendo iguales (si una se traduce, se quita de la lista)', () => {
    expect([...IGUALES].filter((k) => ES[k] !== EN[k])).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('en ingles ningun porcentaje lleva espacio antes del «%»', () => {
    expect(Object.entries(EN).filter(([, v]) => /\s%/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('apostrofo tipografico, comillas curvas y nunca «Tap» ni «press»', () => {
    expect(Object.entries(EN).filter(([, v]) => /[A-Za-z]'[A-Za-z]|(^|[\s(])"|\b(tap|press)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => huecos(ES[k]) !== huecos(EN[k]))).toEqual([])
  })

  it('todo plural lleva sus dos formas', () => {
    const sueltas = Object.keys(ES).filter(
      (k) => (k.endsWith('.uno') && !(k.replace(/\.uno$/, '.otros') in ES)) || (k.endsWith('.otros') && !(k.replace(/\.otros$/, '.uno') in ES)),
    )
    expect(sueltas).toEqual([])
  })

  it('ninguna cifra de dinero ni simbolo de moneda', () => {
    expect(Object.entries({ ...ES, ...EN }).filter(([, v]) => /\$|MXN|USD|\d,\d{3}/.test(v)).map(([k]) => k)).toEqual([])
  })
})

describe('operaciones (parte 2) · espejos de las tablas espanolas', () => {
  it('cada tipo de OT tiene su clave, y su espanol es IDENTICO a `TIPO_OT_LABEL`', () => {
    expect(Object.keys(CLAVE_TIPO_OT).sort()).toEqual(Object.keys(TIPO_OT_LABEL).sort())
    for (const [tipo, etiqueta] of Object.entries(TIPO_OT_LABEL)) {
      expect(traducir('es', CLAVE_TIPO_OT[tipo as keyof typeof CLAVE_TIPO_OT])).toBe(etiqueta)
    }
  })

  it('las prioridades dicen en espanol lo mismo que las dos tablas de las pantallas', () => {
    const tabla = { BAJA: 'Baja', NORMAL: 'Normal', ALTA: 'Alta', URGENTE: 'Urgente' }
    for (const [p, etiqueta] of Object.entries(tabla)) {
      expect(traducir('es', CLAVE_PRIORIDAD[p as keyof typeof CLAVE_PRIORIDAD])).toBe(etiqueta)
    }
    for (const f of ['app/(app)/(shell)/operaciones/page.tsx', 'components/operaciones/OTVista.tsx']) {
      const s = readFileSync(path.join(__dirname, '../../..', f), 'utf8')
      for (const etiqueta of Object.values(tabla)) expect(s).toContain(`: '${etiqueta}',`)
    }
  })
})

describe('operaciones (parte 2) · `lib/costo-ot-captura.ts` en los dos idiomas', () => {
  it('en espanol devuelve el literal de siempre, que es el espanol del diccionario', () => {
    expect(avisoAntesDeCerrar(null)).toBe(ES['operaciones2.ot.costo.aviso-sin'])
    expect(textoCostoDeCerrada(null)).toBe(ES['operaciones2.ot.costo.cerrada-sin'])
    expect(avisoAntesDeCerrar(1500)).toBe(ES['operaciones2.ot.costo.aviso-con'].replace('{importe}', '$ 1,500.00'))
    expect(textoCostoDeCerrada(1500)).toBe(ES['operaciones2.ot.costo.cerrada-con'].replace('{importe}', '$ 1,500.00'))
    expect(leerCostoOt('-5')).toEqual({ ok: false, error: ES['operaciones2.ot.costo.negativo'] })
    expect(leerCostoOt('-5', 'es')).toEqual(leerCostoOt('-5'))
  })

  it('en ingles sale el ingles, con el importe en el simbolo de la instancia', () => {
    expect(avisoAntesDeCerrar(null, 'en')).toBe(EN['operaciones2.ot.costo.aviso-sin'])
    expect(textoCostoDeCerrada(null, 'en')).toBe(EN['operaciones2.ot.costo.cerrada-sin'])
    expect(avisoAntesDeCerrar(1500, 'en')).toBe('Once closed, the cost of MX$ 1,500.00 is final: it can’t be changed.')
    expect(textoCostoDeCerrada(1500, 'en')).toBe('Recorded cost: MX$ 1,500.00. The work order is closed and can no longer be changed.')
    expect(leerCostoOt('-5', 'en')).toEqual({ ok: false, error: 'The cost cannot be negative' })
  })

  it('el veredicto NO cambia con el idioma: solo el texto del motivo', () => {
    for (const x of ['', '12', '12,000', '1,5', '1.234', 'abc', '-3', '12.345', '0']) {
      const es = leerCostoOt(x)
      const en = leerCostoOt(x, 'en')
      expect(en.ok).toBe(es.ok)
      if (es.ok && en.ok) expect(en.valor).toBe(es.valor)
      if (!es.ok && !en.ok && x !== '-3') expect(en.error).not.toBe(es.error)
    }
  })
})

// ============================================================================
//  LOS AVISOS QUE NO SE RINDEN. Un toast, un `alert` o un `mensajeSiFalla` no
//  sale en ningun estado de `pantallas-operaciones2.test.ts`; lo que se fija es
//  la RAMA: que cada uno use SU clave (el gemelo de Finanzas mato asi un
//  mutante que cambiaba un aviso por el de al lado).
// ============================================================================
describe('operaciones (parte 2) · los avisos que no se rinden usan su clave', () => {
  const leer = (f: string) => readFileSync(path.join(__dirname, '../../..', f), 'utf8')

  it('la lista de OT: el fallo al crear', () => {
    const s = leer('app/(app)/(shell)/operaciones/page.tsx')
    expect(s).toMatch(/toast\.error\(e instanceof Error \? e\.message : t\('operaciones2\.ot\.nueva\.no-crear'\)\)/)
  })

  it('la ficha: cerrar, sin cambios, borrado ↔ guardado y el fallo del costo', () => {
    const s = leer('components/operaciones/OTVista.tsx')
    expect(s).toMatch(/alert\(e instanceof Error \? e\.message : t\('operaciones2\.ficha\.no-cerrar'\)\)/)
    expect(s).toMatch(/setCostoAviso\(t\('operaciones2\.ficha\.sin-cambios'\)\)/)
    expect(s).toMatch(/leido\.valor == null\s*\n\s*\? t\('operaciones2\.ficha\.costo-borrado'\)\s*\n\s*: t\('operaciones2\.ficha\.costo-guardado'\)/)
    expect(s).toMatch(/mensajeSiFalla: t\('operaciones2\.ficha\.no-guardar-costo'\)/)
    expect(s).toMatch(/leerCostoOt\(costoTexto, idioma\)/)
  })

  it('creativos: cada toast, el `prompt` y su rama', () => {
    const s = leer('app/(app)/(shell)/creativos/page.tsx')
    expect(s.match(/toast\.error\(t\('operaciones2\.creativos\.imagen-supera', \{ mb: IMAGEN_CREATIVO_MAX_MB \}\)\)/g)).toHaveLength(2)
    expect(s).toMatch(/err\.message : t\('operaciones2\.creativos\.no-subir'\)/)
    expect(s).toMatch(/err\.message : t\('operaciones2\.creativos\.no-guardar'\)/)
    expect(s).toMatch(/window\.prompt\(t\('operaciones2\.creativos\.motivo-rechazo'\)\)/)
    expect(s).toMatch(/e\.message : t\('operaciones2\.creativos\.no-validar'\)/)
    expect(s).toMatch(/pendienteEnDoohmain\s*\n\s*\? t\('operaciones2\.creativos\.retirado-doohmain', \{ nombre: cr\.nombre \}\)\s*\n\s*: t\('operaciones2\.creativos\.eliminado', \{ nombre: cr\.nombre \}\)/)
    expect(s).toMatch(/e\.message : t\('operaciones2\.creativos\.no-eliminar'\)/)
    expect(s).toMatch(/estado === 'retirado'\s*\n\s*\? t\('operaciones2\.creativos\.reemplazado-doohmain'\)\s*\n\s*: t\('operaciones2\.creativos\.reemplazado'\)/)
    expect(s).toMatch(/err\.message : t\('operaciones2\.creativos\.no-reemplazar'\)/)
    expect(s).toMatch(/e\.message : t\('operaciones2\.creativos\.no-asignar'\)/)
    // El nombre por omision de un creativo por codigo es un DATO: no se traduce.
    expect(s).toContain("codeNombre.trim() || 'Creativo (código)'")
  })

  it('creativos: el espanol de los estados es el de la tabla `label` de la pantalla', () => {
    expect([ES['operaciones2.creativos.estado.pendiente'], ES['operaciones2.creativos.estado.validada'], ES['operaciones2.creativos.estado.rechazada']])
      .toEqual(['Pendiente', 'Aprobado', 'Rechazado'])
  })
})
