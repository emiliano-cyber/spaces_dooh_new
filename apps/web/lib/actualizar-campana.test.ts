import { describe, it, expect } from 'vitest'
import {
  revisarPlan,
  ejecutarActualizacion,
  type CreativoActual,
  type PlanActualizacion,
  type ApiActualizacion,
} from './actualizar-campana'

// ============================================================================
//  «Actualizar campaña» (pedido del dueño, 18/11): en UN solo paso, desde la
//  ficha, conservar o eliminar los creativos de antes, subir nuevos, aprobarlos
//  ahí mismo («¿Apruebas este creativo?») y volver a mandar a DOOHmain. Antes
//  eran cuatro sitios: subir en la ficha, aprobar en Creativos, borrar uno por
//  uno en Validación y «Volver a publicar».
//
//  Lo que se prueba aquí es lo que el componente no deja ver: QUÉ se manda, EN
//  QUÉ ORDEN, y qué pasa cuando un paso falla a la mitad.
// ============================================================================

const actuales: CreativoActual[] = [
  { id: 'viejo-1', nombre: 'Verano A', estatus: 'VALIDADA' },
  { id: 'viejo-2', nombre: 'Verano B', estatus: 'VALIDADA' },
  { id: 'pend-1', nombre: 'Pendiente', estatus: 'PENDIENTE' },
]

function plan(p: Partial<PlanActualizacion>): PlanActualizacion {
  return { eliminar: [], aprobarExistentes: [], nuevos: [], ...p }
}

function apiFalsa(fallaEn?: string) {
  const llamadas: string[] = []
  let n = 0
  const api: ApiActualizacion = {
    async subir(nuevo) {
      llamadas.push(`subir:${nuevo.nombre}`)
      if (fallaEn === `subir:${nuevo.nombre}`) throw new Error('el archivo pesa demasiado')
      n += 1
      return { id: `nuevo-${n}` }
    },
    async eliminar(id) {
      llamadas.push(`eliminar:${id}`)
      if (fallaEn === `eliminar:${id}`) throw new Error('DOOHmain no respondió')
    },
    async aprobar(id) {
      llamadas.push(`aprobar:${id}`)
      if (fallaEn === `aprobar:${id}`) throw new Error('no se pudo validar')
    },
    async publicar() {
      llamadas.push('publicar')
      if (fallaEn === 'publicar') throw new Error('Hay pantallas sin creativo aprobado asignado: Reforma 1')
      return { ok: true }
    },
  }
  return { api, llamadas }
}

describe('revisarPlan', () => {
  it('sin ningún cambio no hay nada que actualizar', () => {
    expect(revisarPlan(actuales, plan({}))).toBe('sin-cambios')
  })

  it('no deja la campaña sin ningún creativo aprobado: las pantallas se quedarían a oscuras', () => {
    expect(revisarPlan(actuales, plan({ eliminar: ['viejo-1', 'viejo-2'] }))).toBe('sin-aprobados')
    // Un nuevo subido pero SIN aprobar tampoco cuenta: no se manda a DOOHmain.
    expect(
      revisarPlan(actuales, plan({ eliminar: ['viejo-1', 'viejo-2'], nuevos: [{ nombre: 'Otoño', codigo: '<p/>', aprobar: false }] })),
    ).toBe('sin-aprobados')
  })

  it('cuenta como aprobado lo que se conserva, lo pendiente que se aprueba aquí y lo nuevo marcado', () => {
    expect(revisarPlan(actuales, plan({ eliminar: ['viejo-1', 'viejo-2'], aprobarExistentes: ['pend-1'] }))).toBeNull()
    expect(
      revisarPlan(actuales, plan({ eliminar: ['viejo-1', 'viejo-2'], nuevos: [{ nombre: 'Otoño', codigo: '<p/>', aprobar: true }] })),
    ).toBeNull()
    expect(revisarPlan(actuales, plan({ eliminar: ['viejo-1'] }))).toBeNull()
  })

  it('aprobar uno que también se elimina no cuenta como aprobado', () => {
    expect(
      revisarPlan(actuales, plan({ eliminar: ['viejo-1', 'viejo-2', 'pend-1'], aprobarExistentes: ['pend-1'] })),
    ).toBe('sin-aprobados')
  })
})

describe('ejecutarActualizacion', () => {
  it('sube, elimina, aprueba y publica — en ese orden', async () => {
    const { api, llamadas } = apiFalsa()
    const r = await ejecutarActualizacion(
      plan({
        eliminar: ['viejo-1'],
        aprobarExistentes: ['pend-1'],
        nuevos: [
          { nombre: 'Otoño', codigo: '<p/>', aprobar: true },
          { nombre: 'Borrador', codigo: '<p/>', aprobar: false },
        ],
      }),
      api,
    )
    // Subir primero: si un archivo falla, todavía no se ha borrado nada.
    // Eliminar ANTES de aprobar: la autoasignación llena los spots que quedaron
    // vacíos con TODOS los aprobados, así que el nuevo entra en las pantallas
    // que tenían al que se fue. Al revés, un spot ajustado a mano se quedaría
    // vacío y DOOHmain lo rechazaría.
    expect(llamadas).toEqual([
      'subir:Otoño',
      'subir:Borrador',
      'eliminar:viejo-1',
      'aprobar:pend-1',
      'aprobar:nuevo-1',
      'publicar',
    ])
    expect(r.ok).toBe(true)
    expect(r.hechos).toEqual({ subidos: 2, eliminados: 1, aprobados: 2 })
    expect(r.publicacion).toEqual({ ok: true })
  })

  it('el nuevo SIN aprobar se sube pero no se aprueba', async () => {
    const { api, llamadas } = apiFalsa()
    await ejecutarActualizacion(plan({ nuevos: [{ nombre: 'Borrador', codigo: '<p/>', aprobar: false }] }), api)
    expect(llamadas).toEqual(['subir:Borrador', 'publicar'])
  })

  it('si falla una subida NO se borra nada: se para ahí y dice dónde', async () => {
    const { api, llamadas } = apiFalsa('subir:Otoño')
    const r = await ejecutarActualizacion(
      plan({ eliminar: ['viejo-1'], nuevos: [{ nombre: 'Otoño', codigo: '<p/>', aprobar: true }] }),
      api,
    )
    expect(llamadas).toEqual(['subir:Otoño'])
    expect(r.ok).toBe(false)
    expect(r.fallo).toEqual({ paso: 'subir', nombre: 'Otoño', error: 'el archivo pesa demasiado' })
    expect(r.hechos).toEqual({ subidos: 0, eliminados: 0, aprobados: 0 })
  })

  it('si falla la publicación, lo hecho antes queda hecho y se dice', async () => {
    const { api } = apiFalsa('publicar')
    const r = await ejecutarActualizacion(
      plan({ eliminar: ['viejo-1'], nuevos: [{ nombre: 'Otoño', codigo: '<p/>', aprobar: true }] }),
      api,
    )
    expect(r.ok).toBe(false)
    expect(r.fallo?.paso).toBe('publicar')
    expect(r.fallo?.error).toMatch(/Reforma 1/)
    expect(r.hechos).toEqual({ subidos: 1, eliminados: 1, aprobados: 1 })
  })

  it('si falla una baja, no se aprueba ni se publica nada después', async () => {
    const { api, llamadas } = apiFalsa('eliminar:viejo-2')
    const r = await ejecutarActualizacion(plan({ eliminar: ['viejo-1', 'viejo-2'], aprobarExistentes: ['pend-1'] }), api)
    expect(llamadas).toEqual(['eliminar:viejo-1', 'eliminar:viejo-2'])
    expect(r.fallo).toEqual({ paso: 'eliminar', nombre: 'viejo-2', error: 'DOOHmain no respondió' })
    expect(r.hechos.eliminados).toBe(1)
  })
})
