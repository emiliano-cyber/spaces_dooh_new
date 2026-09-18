import { describe, it, expect } from 'vitest'
import {
  ETIQUETA_SIN_ASIGNAR,
  ROL_COMPROBANTE,
  ROL_CONTRATO,
  SIN_ASIGNAR,
  entidadPreseleccionada,
  etiquetaAsignacion,
  opcionesDeAsignacion,
  sinAsignar,
} from './asignacion'
import type { EntidadUI } from './gestion'

// ============================================================================
//  Los dos selectores que ponen en uso `entidad_id` y `entidad_emisora_id`.
// ----------------------------------------------------------------------------
//  El corazon de este archivo son DOS reglas, y las dos son negativas:
//
//   1. Con DOS candidatas no se propone NINGUNA. Adivinar seria emitir a nombre
//      de la sociedad equivocada sin que nadie lo hubiera decidido.
//   2. Lo GUARDADO manda sobre la omision. La derivacion propone donde nadie
//      decidio; si ya hay una entidad asignada, cambiarla al abrir el
//      formulario reescribiria una decision tomada — y como el formulario
//      guarda lo que tiene en pantalla, lo haria SIN AVISAR.
// ============================================================================

const ent = (over: Partial<EntidadUI> & { id: string; razonSocial: string }): EntidadUI => ({
  rfc: null,
  regimen: null,
  cpFiscal: null,
  serieFolios: null,
  roles: [],
  activo: true,
  ...over,
})

const UNA_VENDE = [
  ent({ id: 'V1', razonSocial: 'Vende SA de CV', roles: ['VENTAS'] }),
  ent({ id: 'A1', razonSocial: 'Arrienda SA de CV', roles: ['ARRENDAMIENTOS'] }),
]

const DOS_VENDEN = [
  ...UNA_VENDE,
  ent({ id: 'V2', razonSocial: 'Vende Tambien SA de CV', roles: ['VENTAS'] }),
]

// ─── 1 · los dos roles son los que son ──────────────────────────────────────
describe('1 · los roles de cada documento', () => {
  it('el contrato lo paga ARRENDAMIENTOS y el comprobante lo emite VENTAS', () => {
    // Fijado a proposito: son los dos papeles del catalogo que estas dos
    // columnas significan, y confundirlos hace que la renta se pague con la
    // sociedad que vende.
    expect(ROL_CONTRATO).toBe('ARRENDAMIENTOS')
    expect(ROL_COMPROBANTE).toBe('VENTAS')
  })
})

// ─── 2 · «sin asignar» es un estado legitimo ────────────────────────────────
describe('2 · sinAsignar', () => {
  it('null, undefined y cadena vacia son «sin asignar»', () => {
    expect(sinAsignar(null)).toBe(true)
    expect(sinAsignar(undefined)).toBe(true)
    expect(sinAsignar('')).toBe(true)
    expect(sinAsignar('   ')).toBe(true)
  })

  it('un uuid no lo es', () => {
    expect(sinAsignar('V1')).toBe(false)
  })
})

// ─── 3 · la preseleccion ────────────────────────────────────────────────────
describe('3 · entidadPreseleccionada', () => {
  it('una sola con el papel: esa viene preseleccionada', () => {
    expect(entidadPreseleccionada(UNA_VENDE, ROL_COMPROBANTE, null)).toBe('V1')
    expect(entidadPreseleccionada(UNA_VENDE, ROL_CONTRATO, null)).toBe('A1')
  })

  it('NEGATIVO CLAVE · con DOS que venden no se propone NINGUNA', () => {
    expect(entidadPreseleccionada(DOS_VENDEN, ROL_COMPROBANTE, null)).toBe(SIN_ASIGNAR)
  })

  it('NEGATIVO CLAVE · lo GUARDADO manda sobre la omision', () => {
    // Aunque la derivacion propusiera V1, el documento ya dice A1 y eso es una
    // decision que alguien tomo. Sobrescribirla al abrir el formulario la
    // borraria al guardar, sin que nadie lo pidiera.
    expect(entidadPreseleccionada(UNA_VENDE, ROL_COMPROBANTE, 'A1')).toBe('A1')
  })

  it('una DADA DE BAJA no se propone: sostiene documentos viejos, no captura nuevos', () => {
    const e = [ent({ id: 'V1', razonSocial: 'Vende SA de CV', roles: ['VENTAS'], activo: false })]
    expect(entidadPreseleccionada(e, ROL_COMPROBANTE, null)).toBe(SIN_ASIGNAR)
  })

  it('pero si un documento YA apunta a una dada de baja, se conserva', () => {
    // Lo contrario seria cambiar en silencio a nombre de quien esta emitido un
    // comprobante ya existente.
    const e = [ent({ id: 'V1', razonSocial: 'Vende SA de CV', roles: ['VENTAS'], activo: false })]
    expect(entidadPreseleccionada(e, ROL_COMPROBANTE, 'V1')).toBe('V1')
  })

  it('sin entidades no propone nada, y no revienta', () => {
    expect(entidadPreseleccionada([], ROL_COMPROBANTE, null)).toBe(SIN_ASIGNAR)
    expect(entidadPreseleccionada(null, ROL_COMPROBANTE, null)).toBe(SIN_ASIGNAR)
    expect(entidadPreseleccionada(undefined, ROL_COMPROBANTE, undefined)).toBe(SIN_ASIGNAR)
  })
})

// ─── 4 · las opciones del selector ──────────────────────────────────────────
describe('4 · opcionesDeAsignacion', () => {
  it('«sin asignar» va PRIMERA y siempre esta: dejarlo vacio es una opcion', () => {
    const o = opcionesDeAsignacion(UNA_VENDE, ROL_COMPROBANTE)
    expect(o[0].valor).toBe(SIN_ASIGNAR)
    expect(o[0].etiqueta).toMatch(/sin asignar/i)
  })

  it('ofrece TODAS las activas, no solo las del papel', () => {
    // Un contrato lo puede pagar la sociedad que quiera el owner: el papel
    // decide la SUGERENCIA, no lo que se permite. Filtrar aqui obligaria a
    // cambiar los roles para poder asignar, que no es lo mismo.
    const o = opcionesDeAsignacion(UNA_VENDE, ROL_COMPROBANTE)
    expect(o.map((x) => x.valor)).toEqual([SIN_ASIGNAR, 'A1', 'V1'])
  })

  it('marca como recomendada la que la derivacion propone, y solo esa', () => {
    const o = opcionesDeAsignacion(UNA_VENDE, ROL_COMPROBANTE)
    expect(o.filter((x) => x.recomendada).map((x) => x.valor)).toEqual(['V1'])
  })

  it('con dos que venden NINGUNA sale recomendada', () => {
    const o = opcionesDeAsignacion(DOS_VENDEN, ROL_COMPROBANTE)
    expect(o.filter((x) => x.recomendada)).toEqual([])
  })

  it('las dadas de baja NO se ofrecen…', () => {
    const e = [...UNA_VENDE, ent({ id: 'X', razonSocial: 'Retirada SA', activo: false })]
    expect(opcionesDeAsignacion(e, ROL_COMPROBANTE).map((x) => x.valor)).not.toContain('X')
  })

  it('…salvo la que el documento YA tiene, y se dice que esta de baja', () => {
    // Si no apareciera, el selector pintaria «sin asignar» sobre un documento
    // que si la tiene, y el primer guardado la borraria sin que nadie lo pidiera.
    const e = [...UNA_VENDE, ent({ id: 'X', razonSocial: 'Retirada SA', activo: false })]
    const o = opcionesDeAsignacion(e, ROL_COMPROBANTE, 'X')
    const suya = o.find((x) => x.valor === 'X')
    expect(suya).toBeDefined()
    expect(suya!.etiqueta).toMatch(/baja/i)
  })
})

// ─── 5 · lo que se pinta en la fila ─────────────────────────────────────────
describe('5 · etiquetaAsignacion', () => {
  it('sin entidad se PINTA «Sin asignar», no se esconde', () => {
    // Las filas anteriores al 17/09 estan asi y no se sabe de quien son.
    // Esconder el hueco seria inventarse a quien pertenecen.
    expect(etiquetaAsignacion(UNA_VENDE, null)).toBe(ETIQUETA_SIN_ASIGNAR)
  })

  it('con entidad, su razon social', () => {
    expect(etiquetaAsignacion(UNA_VENDE, 'V1')).toBe('Vende SA de CV')
  })

  it('si esta dada de baja, lo dice', () => {
    const e = [ent({ id: 'X', razonSocial: 'Retirada SA', activo: false })]
    expect(etiquetaAsignacion(e, 'X')).toMatch(/Retirada SA.*baja/i)
  })

  it('un id que no esta en la lista NO se pinta como «sin asignar»', () => {
    // Pasa cuando el store todavia no hidrato las entidades. Decir «sin
    // asignar» ahi seria afirmar un hecho falso sobre el documento; se dice que
    // no se conoce.
    const t = etiquetaAsignacion(UNA_VENDE, 'FANTASMA')
    expect(t).not.toBe(ETIQUETA_SIN_ASIGNAR)
    expect(t).toMatch(/no disponible|desconocid/i)
  })
})
