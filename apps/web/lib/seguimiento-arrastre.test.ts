import { describe, it, expect, vi } from 'vitest'
import {
  aceptaColumna,
  aplicarPendiente,
  camposDeEtapa,
  cuerpoCambioEtapa,
  esArrastre,
  faltaParaGuardar,
  guardarCambioEtapa,
  moverTrasCrear,
  resultadoAlSoltar,
  sePuedeArrastrar,
  velocidadAutoScroll,
  UMBRAL_ARRASTRE_PX,
  type Arrastrable,
} from './seguimiento-arrastre'
import type { EtapaOportunidad } from './crm'

// ============================================================================
//  18/11 · «En Seguimiento dentro de Propuestas, que se pueda mover y se vea
//  la animación arrastrando entre cada columna, y solo al terminar de moverlo
//  abrir un modal con los campos para llenar el cambio.»
// ----------------------------------------------------------------------------
//  Sin DOM no hay arrastre que simular (vitest.config.ts): lo que DECIDE el
//  arrastre —qué columna acepta, qué pide cada etapa, qué se manda y cuándo NO
//  se manda nada— vive puro en `lib/seguimiento-arrastre.ts` y se prueba aquí.
// ============================================================================

const op = (etapa: EtapaOportunidad): Arrastrable => ({ tipo: 'oportunidad', id: 'o1', etapa })
const pr: Arrastrable = { tipo: 'prospecto', id: 'p1' }
const vacio = { nota: '', motivo: '', confirmado: false }

describe('qué se puede arrastrar', () => {
  it('solo con permiso (comercial.crear, el mismo que exige POST …/etapa)', () => {
    expect(sePuedeArrastrar(op('CONTACTO'), true)).toBe(true)
    expect(sePuedeArrastrar(op('CONTACTO'), false)).toBe(false)
    expect(sePuedeArrastrar(pr, false)).toBe(false)
  })
  it('una cerrada (GANADA o PERDIDA) no se arrastra: el servidor ya no la mueve', () => {
    expect(sePuedeArrastrar(op('GANADA'), true)).toBe(false)
    expect(sePuedeArrastrar(op('PERDIDA'), true)).toBe(false)
    expect(sePuedeArrastrar(op('NEGOCIANDO'), true)).toBe(true)
    expect(sePuedeArrastrar(pr, true)).toBe(true)
  })
  it('clic contra arrastre: hace falta pasar el umbral', () => {
    expect(esArrastre(2, 2)).toBe(false)
    expect(esArrastre(UMBRAL_ARRASTRE_PX, 0)).toBe(true)
    expect(esArrastre(0, -10)).toBe(true)
  })
})

describe('qué columna acepta', () => {
  it('una abierta acepta cualquier otra etapa (ir y volver), no la suya', () => {
    expect(aceptaColumna(op('COTIZANDO'), 'CONTACTO')).toBe(true)
    expect(aceptaColumna(op('COTIZANDO'), 'GANADA')).toBe(true)
    expect(aceptaColumna(op('COTIZANDO'), 'PERDIDA')).toBe(true)
    expect(aceptaColumna(op('COTIZANDO'), 'COTIZANDO')).toBe(false)
  })
  it('una cerrada no acepta ninguna', () => {
    for (const e of ['CONTACTO', 'NECESIDAD', 'GANADA', 'PERDIDA'] as EtapaOportunidad[]) {
      expect(aceptaColumna(op('GANADA'), e)).toBe(false)
      expect(aceptaColumna(op('PERDIDA'), e)).toBe(false)
    }
  })
  it('un prospecto va a las abiertas fuera de Contacto (su columna); nunca a Ganada ni Perdida', () => {
    expect(aceptaColumna(pr, 'NECESIDAD')).toBe(true)
    expect(aceptaColumna(pr, 'NEGOCIANDO')).toBe(true)
    expect(aceptaColumna(pr, 'CONTACTO')).toBe(false)
    expect(aceptaColumna(pr, 'GANADA')).toBe(false)
    expect(aceptaColumna(pr, 'PERDIDA')).toBe(false)
  })
})

describe('al soltar', () => {
  it('fuera de una columna o en la misma: nada (vuelve)', () => {
    expect(resultadoAlSoltar(op('NECESIDAD'), null)).toBe('nada')
    expect(resultadoAlSoltar(op('NECESIDAD'), 'NECESIDAD')).toBe('nada')
    expect(resultadoAlSoltar(pr, 'CONTACTO')).toBe('nada')
  })
  it('en una columna que no acepta: rechazada (vuelve)', () => {
    expect(resultadoAlSoltar(op('GANADA'), 'CONTACTO')).toBe('rechazada')
    expect(resultadoAlSoltar(pr, 'GANADA')).toBe('rechazada')
  })
  it('una oportunidad en otra columna abre el cambio; un prospecto, el alta', () => {
    expect(resultadoAlSoltar(op('NECESIDAD'), 'PERDIDA')).toBe('cambio-etapa')
    expect(resultadoAlSoltar(pr, 'COTIZANDO')).toBe('crear-oportunidad')
  })
})

describe('los campos de cada etapa', () => {
  it('toda etapa pide la nota; Perdida el motivo; Ganada la confirmación', () => {
    expect(camposDeEtapa('NECESIDAD')).toEqual({ motivo: false, confirmar: false, cierra: false })
    expect(camposDeEtapa('PERDIDA')).toEqual({ motivo: true, confirmar: false, cierra: true })
    expect(camposDeEtapa('GANADA')).toEqual({ motivo: false, confirmar: true, cierra: true })
  })
  it('Perdida sin motivo (o solo espacios) no se guarda', () => {
    expect(faltaParaGuardar('PERDIDA', vacio)).toBe('motivo')
    expect(faltaParaGuardar('PERDIDA', { ...vacio, motivo: '   ' })).toBe('motivo')
    expect(faltaParaGuardar('PERDIDA', { ...vacio, motivo: 'Precio' })).toBeNull()
  })
  it('Ganada sin confirmar no se guarda', () => {
    expect(faltaParaGuardar('GANADA', vacio)).toBe('confirmar')
    expect(faltaParaGuardar('GANADA', { ...vacio, confirmado: true })).toBeNull()
    expect(faltaParaGuardar('COTIZANDO', vacio)).toBeNull()
  })
  it('el cuerpo: solo lo que acepta el esquema estricto del servidor', () => {
    expect(cuerpoCambioEtapa('COTIZANDO', { nota: '  Pidió precios ', motivo: 'colado', confirmado: false })).toEqual({
      etapa: 'COTIZANDO',
      nota: 'Pidió precios',
      motivoPerdida: null,
    })
    expect(cuerpoCambioEtapa('PERDIDA', { nota: '', motivo: ' Precio ', confirmado: false })).toEqual({
      etapa: 'PERDIDA',
      nota: null,
      motivoPerdida: 'Precio',
    })
    expect(Object.keys(cuerpoCambioEtapa('GANADA', { ...vacio, confirmado: true })).sort()).toEqual(['etapa', 'motivoPerdida', 'nota'])
  })
})

describe('guardar y cancelar', () => {
  it('Guardar llama al endpoint existente con el cuerpo', async () => {
    const api = vi.fn().mockResolvedValue({ id: 'o1', etapa: 'PERDIDA' })
    const r = await guardarCambioEtapa('o1', 'PERDIDA', { ...vacio, motivo: 'Precio' }, api)
    expect(api).toHaveBeenCalledWith('o1', { etapa: 'PERDIDA', nota: null, motivoPerdida: 'Precio' })
    expect(r).toEqual({ ok: true, ficha: { id: 'o1', etapa: 'PERDIDA' } })
  })
  it('sin lo obligatorio NO llama a la API', async () => {
    const api = vi.fn()
    expect(await guardarCambioEtapa('o1', 'PERDIDA', vacio, api)).toEqual({ ok: false, falta: 'motivo' })
    expect(await guardarCambioEtapa('o1', 'GANADA', vacio, api)).toEqual({ ok: false, falta: 'confirmar' })
    expect(api).not.toHaveBeenCalled()
  })
  it('el 409/400 del servidor vuelve tal cual, con su status', async () => {
    const err = Object.assign(new Error('La oportunidad ya está cerrada'), { status: 409 })
    const api = vi.fn().mockRejectedValue(err)
    expect(await guardarCambioEtapa('o1', 'NECESIDAD', vacio, api)).toEqual({
      ok: false,
      error: 'La oportunidad ya está cerrada',
      status: 409,
    })
  })
  it('cancelar = quitar lo pendiente; la tarjeta vuelve y no se manda nada', () => {
    const ops = [{ id: 'o1', etapa: 'NECESIDAD' as EtapaOportunidad }, { id: 'o2', etapa: 'CONTACTO' as EtapaOportunidad }]
    const conPendiente = aplicarPendiente(ops, { id: 'o1', destino: 'GANADA' })
    expect(conPendiente.map((o) => o.etapa)).toEqual(['GANADA', 'CONTACTO'])
    // El original no se toca: cancelar es simplemente pintar sin pendiente.
    expect(ops[0].etapa).toBe('NECESIDAD')
    expect(aplicarPendiente(ops, null)).toBe(ops)
  })
})

describe('prospecto arrastrado: se crea y luego se mueve', () => {
  it('a Contacto no hace falta mover', async () => {
    const api = vi.fn()
    expect(await moverTrasCrear('o9', 'CONTACTO', api)).toEqual({ ok: true, movida: false })
    expect(api).not.toHaveBeenCalled()
  })
  it('a otra etapa abierta: el alta nace en Contacto y se mueve con POST …/etapa', async () => {
    const api = vi.fn().mockResolvedValue({})
    expect(await moverTrasCrear('o9', 'COTIZANDO', api)).toEqual({ ok: true, movida: true })
    expect(api).toHaveBeenCalledWith('o9', { etapa: 'COTIZANDO', nota: null, motivoPerdida: null })
  })
  it('si el movimiento falla, la oportunidad queda creada y se dice el error', async () => {
    const api = vi.fn().mockRejectedValue(new Error('No se pudo cambiar la etapa'))
    expect(await moverTrasCrear('o9', 'NEGOCIANDO', api)).toEqual({ ok: false, error: 'No se pudo cambiar la etapa' })
  })
})

describe('desplazamiento automático en el borde del tablero', () => {
  it('cerca del borde se desplaza hacia ese lado; en medio, nada', () => {
    expect(velocidadAutoScroll(500, 0, 1000)).toBe(0)
    expect(velocidadAutoScroll(5, 0, 1000)).toBeLessThan(0)
    expect(velocidadAutoScroll(995, 0, 1000)).toBeGreaterThan(0)
    // Más cerca del borde, más rápido.
    expect(velocidadAutoScroll(1, 0, 1000)).toBeLessThan(velocidadAutoScroll(30, 0, 1000))
  })
})
