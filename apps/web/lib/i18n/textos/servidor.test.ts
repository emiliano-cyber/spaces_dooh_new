import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_SERVIDOR, EN_SERVIDOR } from './servidor'
import { traducir } from '../diccionario'
import { CATALOGO_ERRORES, traducirError } from '../errores-servidor'
import {
  motivoCambioOferta,
  motivoEdicion,
  motivoEtapaResponsable,
  motivoPresupuesto,
  motivoQuitarLegal,
} from '../../negociacion'
import { motivoHorarioInvalido } from '../../doohmain-programacion'
import { interpretarUbicacion } from '../../interpretar-ubicacion'
import { avisosDeProgramacion } from '../../franja-programada'
import { MSJ_APROBAR_CON_PENDIENTE } from '../../codigo-aprobacion'
import { periodoDe } from '../../finanzas-periodo'

// ============================================================================
//  LOTE SERVIDOR · LOS MOTIVOS QUE COMPARTEN SERVIDOR Y PANTALLA, CONGELADOS.
// ----------------------------------------------------------------------------
//  Tres cosas, como los demas archivos de `textos/`:
//   1. la instantanea de los dos idiomas;
//   2. el español del diccionario es LITERALMENTE el que devuelve el modulo
//      (que lo conserva: el servidor y los registros no cambian);
//   3. y lo propio de este lote: el servidor dice en ingles LO MISMO que la
//      pantalla, porque el catalogo de errores sale de aqui.
// ============================================================================

const ES = ES_SERVIDOR as Record<string, string>
const EN = EN_SERVIDOR as Record<string, string>

describe('diccionario servidor · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_SERVIDOR).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_SERVIDOR).toMatchSnapshot()
  })
})

describe('diccionario servidor · el ingles no esta en español', () => {
  it('ninguna entrada inglesa es igual a la española', () => {
    expect(Object.keys(ES).filter((k) => ES[k] === EN[k])).toEqual([])
  })
  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡º]/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('comillas curvas y nada de comillas rectas ni angulares en ingles', () => {
    expect(Object.entries(EN).filter(([, v]) => /["«»]/.test(v)).map(([k]) => k)).toEqual([])
  })
  it('apostrofo tipografico, sin espacio antes de %, y nunca «Tap» ni «press»', () => {
    const malas = Object.entries(EN).filter(([, v]) => /'|\s%|\btap\b|\bpress\b/i.test(v)).map(([k]) => k)
    expect(malas).toEqual([])
  })
  it('las mismas llaves {…} en los dos idiomas', () => {
    const llaves = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    expect(Object.keys(ES).filter((k) => llaves(ES[k]) !== llaves(EN[k]))).toEqual([])
  })
})

describe('diccionario servidor · el español es el del modulo, letra por letra', () => {
  const contactos = [{ id: 'a', esLegal: true }]
  it('lib/negociacion.ts', () => {
    expect(motivoEtapaResponsable(9, [])).toBe(ES['servidor.negociacion.etapa-no-existe'])
    expect(motivoEtapaResponsable(5, [])).toBe(ES['servidor.negociacion.falta-quien-firma'])
    expect(motivoQuitarLegal(5, contactos, 'a')).toBe(ES['servidor.negociacion.quitar-quien-firma'])
    expect(motivoPresupuesto(5, 1)).toBe(ES['servidor.negociacion.presupuesto'])
    expect(motivoCambioOferta('ACEPTADA', 'ENVIADA')).toBe(ES['servidor.negociacion.oferta-cerrada.aceptada'])
    expect(motivoCambioOferta('RECHAZADA', 'ENVIADA')).toBe(ES['servidor.negociacion.oferta-cerrada.rechazada'])
    expect(motivoEdicion('PERDIDO', 'ficha')).toBe(ES['servidor.negociacion.perdido'])
    expect(motivoEdicion('EN_REVISION', 'ficha')).toBe(ES['servidor.negociacion.en-revision'])
  })

  it('motivoHorarioInvalido', () => {
    expect(motivoHorarioInvalido({ horaInicio: '7', horaFin: '09:00', dias: null })).toBe(ES['servidor.horario.formato'])
    expect(motivoHorarioInvalido({ horaInicio: '09:00', horaFin: '09:00', dias: null })).toBe(ES['servidor.horario.iguales'])
    expect(motivoHorarioInvalido({ horaInicio: '07:00', horaFin: '09:00', dias: [] })).toBe(ES['servidor.horario.sin-dias'])
    expect(motivoHorarioInvalido({ horaInicio: '07:00', horaFin: '09:00', dias: [9] })).toBe(ES['servidor.horario.dia-no-existe'])
    expect(motivoHorarioInvalido({ horaInicio: '07:00', horaFin: '09:00', dias: [1, 1] })).toBe(ES['servidor.horario.dia-repetido'])
  })

  it('interpretarUbicacion: cada motivo es una entrada del diccionario', () => {
    const motivos = [
      '',
      '91.5, -99.1',
      '19.5, -181.5',
      '0.0, 0.0',
      `19°61'00"N 99°07'59.5"W`,
      `99°07'59.5"W 19°25'57.4"N`,
      'https://evil.example/maps/@1.5,2.5,3z',
      'https://maps.app.goo.gl/',
      'https://www.google.com/maps/place/Z%C3%B3calo/',
    ].map((c) => {
      const r = interpretarUbicacion(c)
      return r.tipo === 'invalido' ? r.motivo : '(no invalido)'
    })
    const ubicacion = Object.keys(ES).filter((k) => k.startsWith('servidor.ubicacion.')).map((k) => ES[k])
    expect(new Set(motivos)).toEqual(new Set(ubicacion))
  })

  it('el aviso de la franja (con nombre, sin nombre, una y varias pantallas)', () => {
    const [con] = avisosDeProgramacion({
      programada: { id: 'p', nombre: 'Noche' } as never,
      contratadas: [{ franjaId: 'x', franjaNombre: 'Prime', pantallas: 1 } as never],
    })
    expect(con.texto).toBe(
      traducir('es', 'servidor.franja.aviso', {
        vendida: traducir('es', 'servidor.franja.vendida', { nombre: 'Prime' }),
        pantallas: traducir('es', 'servidor.franja.pantallas.uno', { n: 1 }),
        programada: 'Noche',
      }),
    )
    const [sin] = avisosDeProgramacion({
      programada: { id: 'p', nombre: 'Noche' } as never,
      contratadas: [{ franjaId: 'x', franjaNombre: null, pantallas: 3 } as never],
    })
    expect(sin.texto).toBe(
      traducir('es', 'servidor.franja.aviso', {
        vendida: ES['servidor.franja.otra'],
        pantallas: traducir('es', 'servidor.franja.pantallas.otros', { n: 3 }),
        programada: 'Noche',
      }),
    )
  })

  it('MSJ_APROBAR_CON_PENDIENTE', () => {
    expect(ES['servidor.codigo.aprobar-con-pendiente']).toBe(MSJ_APROBAR_CON_PENDIENTE)
  })

  it('el periodo: el rango sin fechas y los mensajes de los esquemas', () => {
    expect(() => periodoDe('rango', '2026-11-02', {})).toThrow(ES['servidor.periodo.rango'])
    for (const archivo of ['lib/server/finanzas-controller.ts', 'lib/server/propuestas-resumen-controller.ts']) {
      const src = readFileSync(path.join(__dirname, '../../..', archivo), 'utf8')
      expect(src).toContain(`'${ES['servidor.periodo.invalido']}'`)
    }
    const fin = readFileSync(path.join(__dirname, '../../..', 'lib/server/finanzas-controller.ts'), 'utf8')
    expect(fin).toContain(`uuid('${ES['servidor.periodo.cliente-invalido']}')`)
  })

  it('y por el embudo: con la etiqueta de campo delante, como los arma validar()', () => {
    expect(traducirError('Periodo: Periodo inválido', 'en')).toBe('Period: Invalid period')
    expect(traducirError('Cliente: Cliente inválido', 'en')).toBe('Client: Invalid client')
    expect(traducirError('Periodo: Periodo inválido', 'es')).toBe('Periodo: Periodo inválido')
  })
})

describe('en INGLES, las funciones de lib/ devuelven el ingles del diccionario', () => {
  const contactos = [{ id: 'a', esLegal: true }]
  it('lib/negociacion.ts', () => {
    expect(motivoEtapaResponsable(9, [], 'en')).toBe(EN['servidor.negociacion.etapa-no-existe'])
    expect(motivoEtapaResponsable(5, [], 'en')).toBe(EN['servidor.negociacion.falta-quien-firma'])
    expect(motivoQuitarLegal(5, contactos, 'a', 'en')).toBe(EN['servidor.negociacion.quitar-quien-firma'])
    expect(motivoPresupuesto(5, 1, 'en')).toBe(EN['servidor.negociacion.presupuesto'])
    expect(motivoCambioOferta('ACEPTADA', 'ENVIADA', 'en')).toBe(EN['servidor.negociacion.oferta-cerrada.aceptada'])
    expect(motivoCambioOferta('RECHAZADA', 'ENVIADA', 'en')).toBe(EN['servidor.negociacion.oferta-cerrada.rechazada'])
    expect(motivoEdicion('PERDIDO', 'hijos', 'en')).toBe(EN['servidor.negociacion.perdido'])
    expect(motivoEdicion('EN_REVISION', 'ficha', 'en')).toBe(EN['servidor.negociacion.en-revision'])
    // Lo que se permite sigue siendo null en los dos idiomas.
    expect(motivoEdicion('EN_REVISION', 'notas', 'en')).toBeNull()
    expect(motivoEtapaResponsable(5, contactos, 'en')).toBeNull()
  })

  it('motivoHorarioInvalido', () => {
    expect(motivoHorarioInvalido({ horaInicio: '7', horaFin: '09:00', dias: null }, 'en')).toBe(EN['servidor.horario.formato'])
    expect(motivoHorarioInvalido({ horaInicio: '07:00', horaFin: '09:00', dias: [1, 1] }, 'en')).toBe(EN['servidor.horario.dia-repetido'])
    expect(motivoHorarioInvalido({ horaInicio: '07:00', horaFin: '09:00', dias: null }, 'en')).toBeNull()
  })

  it('interpretarUbicacion: el motivo en ingles; lo demas, igual', () => {
    const r = interpretarUbicacion('', 'en')
    expect(r).toEqual({ tipo: 'invalido', motivo: EN['servidor.ubicacion.vacio'] })
    const lat = interpretarUbicacion('91.5, -99.1', 'en')
    expect(lat).toEqual({ tipo: 'invalido', motivo: EN['servidor.ubicacion.latitud'] })
    expect(interpretarUbicacion('19.4326, -99.1332', 'en')).toEqual(interpretarUbicacion('19.4326, -99.1332'))
    expect(interpretarUbicacion('Av. Reforma 222', 'en')).toEqual(interpretarUbicacion('Av. Reforma 222'))
  })

  it('el aviso de la franja', () => {
    const [con] = avisosDeProgramacion(
      {
        programada: { id: 'p', nombre: 'Noche' } as never,
        contratadas: [{ franjaId: 'x', franjaNombre: 'Prime', pantallas: 1 } as never],
      },
      'en',
    )
    expect(con.texto).toBe(
      'Sold as “Prime” (1 screen) and scheduled in “Noche”. The price and what was contracted do not change; ' +
        'confirm with the client that the broadcast schedule is the one agreed.',
    )
    const [sin] = avisosDeProgramacion(
      {
        programada: { id: 'p', nombre: 'Noche' } as never,
        contratadas: [{ franjaId: 'x', franjaNombre: null, pantallas: 3 } as never],
      },
      'en',
    )
    expect(sin.texto).toMatch(/^Sold as another daypart \(3 screens\) and scheduled in “Noche”\./)
    // Lo demas del aviso (ids, nombre, cuenta) no depende del idioma.
    expect({ ...sin, texto: '' }).toEqual({ ...avisosDeProgramacion({
      programada: { id: 'p', nombre: 'Noche' } as never,
      contratadas: [{ franjaId: 'x', franjaNombre: null, pantallas: 3 } as never],
    })[0], texto: '' })
  })
})

describe('el SERVIDOR dice en ingles lo mismo que la pantalla', () => {
  it('cada motivo sin huecos sale del catalogo de errores con el ingles del diccionario', () => {
    const distintos: string[] = []
    for (const k of Object.keys(ES)) {
      if (/\{/.test(ES[k])) continue
      if (traducirError(ES[k], 'en') !== EN[k]) distintos.push(k)
    }
    expect(distintos).toEqual([])
  })

  it('y donde el catalogo de I18N-05 ya tenia la frase, dice lo mismo (no hay dos ingleses)', () => {
    const choques = Object.keys(ES).filter((k) => ES[k] in CATALOGO_ERRORES && CATALOGO_ERRORES[ES[k]] !== EN[k])
    expect(choques).toEqual([])
  })
})

// Los avisos que no salen en `renderToStaticMarkup` (toasts y `setAviso`): se
// lee el fuente y se fija QUE clave o QUE idioma usa cada uno, como
// `textos/comercial.test.ts`. Sin esto, quitar el `idioma` de una llamada
// dejaria la suite en verde y el aviso en español.
describe('servidor · los avisos que no se rinden usan su idioma o su clave', () => {
  const leer = (archivo: string) =>
    readFileSync(path.join(__dirname, '../../..', archivo), 'utf8').replace(/\r\n/g, '\n')

  it('Comercial negociacion: el buscador, los pasos y el aviso de la ficha', () => {
    const opex = leer('components/demo/comercial-opex/ComercialOpex.tsx')
    expect(opex).toMatch(/interpretarUbicacion\(q, idioma\)/)
    expect(opex).toMatch(/motivoEtapaResponsable\(n, p\.contactos, idioma\)/)
    expect(opex).toMatch(/\{motivoEdicion\(p\.etapa, 'ficha', idioma\)\}/)
  })

  it('el horario individual de DOOHmain', () => {
    expect(leer('components/demo/campanas/ProgramacionDoohmain.tsx')).toMatch(/motivoHorarioInvalido\(horario, idioma\)/)
  })

  it('el aviso de la franja lo arma el servidor en el idioma de la peticion', () => {
    expect(leer('lib/server/programacion-controller.ts')).toMatch(
      /avisosDeProgramacion\(\s*\{[\s\S]*?\},\s*idioma,?\s*\)/,
    )
  })

  it('aprobar con el cupon pendiente: el toast usa su clave en las dos pantallas', () => {
    for (const archivo of ['app/(app)/(shell)/propuestas/page.tsx', 'app/(app)/(shell)/propuestas/[id]/page.tsx']) {
      expect(leer(archivo)).toMatch(
        /e instanceof CodigoPendienteApiError\) return void toast\.error\(t\('servidor\.codigo\.aprobar-con-pendiente'\)\)/,
      )
    }
  })
})

describe('aprobar con el cupon pendiente: el cliente reconoce la bandera de la ruta', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('un 409 con `codigoPendiente` es un CodigoPendienteApiError (y el resto, un Error a secas)', async () => {
    const { cambiarEstatusPropuestaApi, CodigoPendienteApiError } = await import('../../data/estado-api')
    const responder = (cuerpo: object) =>
      vi.fn(async () => ({ ok: false, status: 409, json: async () => cuerpo }) as unknown as Response)

    vi.stubGlobal('fetch', responder({ error: MSJ_APROBAR_CON_PENDIENTE, codigoPendiente: true }))
    const e = await cambiarEstatusPropuestaApi('p1', 'APROBADA').catch((x) => x)
    expect(e).toBeInstanceOf(CodigoPendienteApiError)
    // El texto del servidor se conserva tal cual: es el que se registra.
    expect(e.message).toBe(MSJ_APROBAR_CON_PENDIENTE)

    vi.stubGlobal('fetch', responder({ error: 'Otra cosa' }))
    const otro = await cambiarEstatusPropuestaApi('p1', 'APROBADA').catch((x) => x)
    expect(otro).not.toBeInstanceOf(CodigoPendienteApiError)
    expect(otro.message).toBe('Otra cosa')
  })
})

// ─── Pantalla y servidor: el MISMO español lleva el MISMO inglés ────────────
//
// Encontrado desde la tarea de «pesos» (rama `feat/pesos-neutral`): los
// motivos de la calculadora salían con un inglés en la pantalla
// (`compartidos.calc.motivo.*`, validado por los lotes de compartidos y
// propuestas) y con OTRO en el servidor (el catálogo y los patrones de
// I18N-05 / ADR 0042). Manda el de la pantalla. Se rellenan los huecos con
// valores de ejemplo y se compara con lo que da `traducirError`.
describe('pantalla y servidor dicen el mismo ingles para el mismo español', () => {
  it('cada clave del diccionario cuyo español lanza el servidor', async () => {
    const { DICCIONARIOS } = await import('../diccionario')
    const es = DICCIONARIOS.es as Record<string, string>
    const en = DICCIONARIOS.en as Record<string, string>
    const valores = { total: 8, espacios: 3, libres: 2, max: '18', n: 4 }
    const rellenar = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => String((valores as Record<string, unknown>)[k] ?? `{${k}}`))
    const distintos: string[] = []
    for (const k of Object.keys(es)) {
      const frase = rellenar(es[k])
      if (/\{\w+\}/.test(frase)) continue
      const delServidor = traducirError(frase, 'en')
      if (delServidor === frase) continue // el servidor no la conoce: no hay dos ingleses
      // `.uno` y `.otros` llevan el mismo español en algunos motivos; con
      // varios, el bueno es el plural.
      if (k.endsWith('.uno') && es[k.replace(/\.uno$/, '.otros')] === es[k]) continue
      if (delServidor !== rellenar(en[k])) distintos.push(`${k}: «${rellenar(en[k])}» ≠ «${delServidor}»`)
    }
    expect(distintos).toEqual([])
  })

  it('y el plural de «pocos libres» lo elige el patron, como la pantalla', async () => {
    const { traducir } = await import('../diccionario')
    const uno = traducir('es', 'compartidos.calc.motivo.pocos-libres.uno', { espacios: 1, libres: 0 })
    expect(traducirError(uno, 'en')).toBe(traducir('en', 'compartidos.calc.motivo.pocos-libres.uno', { espacios: 1, libres: 0 }))
  })
})
