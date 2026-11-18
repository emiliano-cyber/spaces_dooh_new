import { describe, it, expect } from 'vitest'
import { ES_CLIENTES, EN_CLIENTES } from './clientes'
import { DICCIONARIOS } from '../diccionario'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ============================================================================
//  EL DICCIONARIO DE CLIENTES, COMISIONES Y CAPTACION, CONGELADO.
// ----------------------------------------------------------------------------
//  Mismo patron que `propuestas.test.ts` y `codigos.test.ts`: una instantanea
//  de los dos idiomas, para que ni el espanol (copia literal) ni el ingles
//  cambien sin que el diff de `__snapshots__/` lo enseñe, y las mismas
//  guardias de forma que los otros lotes. Mas los ESPEJOS: las etiquetas que
//  viven en otro modulo (y que ese modulo sigue usando en espanol) tienen que
//  ser IDENTICAS a su clave.
// ============================================================================

const ES = ES_CLIENTES as Record<string, string>
const EN = EN_CLIENTES as Record<string, string>

describe('diccionario de CLIENTES · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_CLIENTES).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_CLIENTES).toMatchSnapshot()
  })
})

describe('diccionario de CLIENTES · el ingles no esta en espanol', () => {
  // Iguales en los dos idiomas, cada una con su motivo.
  const IGUALES = new Set<string>([
    'clientes.col.rfc', // RFC no se traduce (glosario)
    'clientes.captacion.campo.rfc', // idem
    'clientes.pipeline.titulo', // «Pipeline» tambien es ingles (lo usa campanas.ficha.pipeline)
    'clientes.captacion.digital', // «Digital» es igual en ingles
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

describe('diccionario de CLIENTES · los espejos reproducen EXACTAMENTE su modulo', () => {
  it('las columnas del pipeline del cliente (`ETAPA_CLIENTE_LABEL`)', async () => {
    const { ETAPA_CLIENTE_LABEL } = await import('../../cliente-pipeline')
    const { CLAVE_ETAPA_CLIENTE } = await import('../../../components/demo/clientes/PipelineCliente')
    expect(Object.keys(CLAVE_ETAPA_CLIENTE).sort()).toEqual(Object.keys(ETAPA_CLIENTE_LABEL).sort())
    for (const [k, v] of Object.entries(ETAPA_CLIENTE_LABEL)) {
      expect(ES[CLAVE_ETAPA_CLIENTE[k as keyof typeof CLAVE_ETAPA_CLIENTE]]).toBe(v)
    }
  })

  it('los tipos de prospecto (`ETIQUETA_TIPO` de `lib/captacion.ts`)', async () => {
    const { ETIQUETA_TIPO } = await import('../../captacion')
    const { CLAVE_TIPO_PROSPECTO } = await import('../../../components/demo/captacion/Captacion')
    expect(Object.keys(CLAVE_TIPO_PROSPECTO).sort()).toEqual(Object.keys(ETIQUETA_TIPO).sort())
    for (const [k, v] of Object.entries(ETIQUETA_TIPO)) {
      expect(ES[CLAVE_TIPO_PROSPECTO[k as keyof typeof CLAVE_TIPO_PROSPECTO]]).toBe(v)
    }
  })

  it('los mensajes de validacion que el formulario de cliente pinta con clave (`lib/validacion`)', async () => {
    const v = await import('../../validacion')
    expect(ES['clientes.form.cp-invalido']).toBe(v.CP_INVALIDO)
    expect(ES['clientes.form.telefono-invalido']).toBe(v.TELEFONO_INVALIDO)
    expect((DICCIONARIOS.es as Record<string, string>)['validacion.email']).toBe(v.EMAIL_INVALIDO)
  })

  it('`faltantesParaRevision` sigue contestando en espanol por omision, y en ingles si se le pide', async () => {
    const { faltantesParaRevision } = await import('../../captacion')
    const predio = { tipo: 'PREDIO' as const, nombre: 'X', contacto: {}, direccion: null, datos: {} }
    expect(faltantesParaRevision(predio)).toEqual([
      'la dirección',
      'el dueño: un arrendador existente o el nombre y teléfono del contacto',
    ])
    expect(faltantesParaRevision(predio, 'en')).toEqual([
      'the address',
      'the owner: an existing landlord or the contact’s name and phone',
    ])
    expect(faltantesParaRevision({ ...predio, tipo: 'CLIENTE' }, 'en')).toEqual(['a contact phone or email'])
  })
})

// ============================================================================
//  QUE CLAVE usa cada mensaje que NO se rinde (toasts y errores de un `catch`).
// ----------------------------------------------------------------------------
//  Mismo motivo que `finanzas.test.ts` (validacion de campanas y finanzas, M7):
//  la instantanea protege el VALOR de cada clave y las pantallas las que se
//  pintan, pero nada protege QUE clave elige un aviso que sale tras un fallo
//  de red. Se lee el fuente y se fija cada uno.
// ============================================================================
describe('clientes · los avisos que no se rinden usan su clave', () => {
  const leer = (r: string) => readFileSync(path.join(__dirname, '../../..', r), 'utf8')

  it('comisiones: guardar la comision y asignar la agencia avisan cada uno lo suyo', () => {
    const f = leer('app/(app)/(shell)/comisiones/page.tsx')
    expect(f).toMatch(/await actualizarClienteApi\(agencia\.id, input\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('clientes\.form\.no-se-pudo-guardar'\)\)/)
    expect(f).toMatch(/await actualizarClienteApi\(cliente\.id, \{ agenciaId \}\)\s*\n\s*\} catch \(e\) \{\s*\n\s*toast\.error\(e instanceof Error \? e\.message : t\('clientes\.comisiones\.no-se-pudo-asignar'\)\)/)
    expect(f).toMatch(/e\.message : t\('clientes\.comisiones\.no-se-pudo-crear'\)/)
  })

  it('clientes: borrar, guardar y la contrasena vacia', () => {
    const f = leer('app/(app)/(shell)/clientes/page.tsx')
    expect(f).toMatch(/if \(!pass\) \{ setError\(t\('compartidos\.candado\.falta'\)\)/)
    expect(f).toMatch(/e\.message : t\('clientes\.borrar\.no-se-pudo'\)/)
    expect(f).toMatch(/setError\(t\('clientes\.form\.revisa'\)\)/)
    expect(f).toMatch(/e\.message : t\('clientes\.form\.no-se-pudo-guardar'\)/)
  })

  it('captacion: cada fallo dice el suyo', () => {
    const f = leer('components/demo/captacion/Captacion.tsx')
    const pares: [string, string][] = [
      ['avanceApi', 'clientes.captacion.error.avance'],
      ['aprobarApi', 'clientes.captacion.error.aprobar'],
      ['rechazarApi', 'clientes.captacion.error.rechazar'],
      ['prospectosApi', 'clientes.captacion.error.leer'],
      ['prospectoApi', 'clientes.captacion.error.abrir'],
      ['crearProspectoApi', 'clientes.captacion.error.guardar'],
    ]
    for (const [api, clave] of pares) {
      // La llamada y, en el `catch` que la sigue, su clave (sin otra API en medio).
      const re = new RegExp(`\\b${api}\\((?:(?!Api\\()[\\s\\S])*?t\\('${clave.replace(/\./g, '\\.')}'\\)`)
      expect(f, `${api} → ${clave}`).toMatch(re)
    }
    expect(f).toMatch(/return setError\(t\('clientes\.captacion\.para-revision', \{ faltan: faltan\.join\(', '\) \}\)\)/)
  })
})
