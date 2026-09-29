import { describe, it, expect } from 'vitest'
import { rechazoDelCambio, rechazoDeNombrarDueno } from './guardas-usuarios'

// ============================================================================
//  ADR 0040 · Los dos guards que protegen al Dueño.
// ----------------------------------------------------------------------------
//  Aquí vive la DECISIÓN, no la lectura: esta función no sabe consultar nada.
//  Recibe el rol del actor, la fila del afectado y CUÁNTOS Dueños activos hay,
//  y contesta con el rechazo o con null. Es la misma separación que hizo la
//  Fase 3 del ADR 0039 con `lib/codigo-promocional.ts`: las reglas puras aquí,
//  y los datos que las alimentan —el conteo con las filas BLOQUEADAS— en el
//  repo.
//
//  Por qué importa que el conteo entre como parámetro: si esta función lo
//  consultara, la carrera sería inevitable. Contar aquí es contar sin bloquear.
// ============================================================================

const dueno = { rol: 'DUENO', activo: true }
const vendedor = { rol: 'VENDEDOR', activo: true }

describe('1 · un ADMINISTRADOR no toca a ningún DUEÑO', () => {
  it('no lo puede desactivar', () => {
    const r = rechazoDelCambio({
      actorRol: 'ADMINISTRADOR',
      objetivo: dueno,
      cambio: { activo: false },
      duenosActivos: 5,
    })
    expect(r?.mensaje).toMatch(/administrador/i)
    // 403 y no 409: esa acción no es suya, y no lo será por muchos Dueños que
    // haya. El 409 diría lo contrario — «prueba otra vez con dos Dueños».
    expect(r?.status).toBe(403)
  })

  it('no lo puede degradar a otro rol', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: dueno,
        cambio: { rol: 'VENDEDOR' },
        duenosActivos: 5,
      })?.mensaje,
    ).toMatch(/administrador/i)
  })

  it('tampoco lo puede ELIMINAR — borrar es más fuerte que desactivar', () => {
    // El dictado del 29/09 dice «desactivar ni degradar». Si el borrado se
    // quedara fuera, el guard sería decorativo: el mismo administrador
    // conseguiría el mismo resultado con DELETE en vez de PATCH.
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: dueno,
        cambio: { borrado: true },
        duenosActivos: 5,
      })?.mensaje,
    ).toMatch(/administrador/i)
  })

  it('y le da igual que el Dueño ya esté desactivado: degradarlo sigue prohibido', () => {
    // «ningún usuario con rol DUENO», no «ningún Dueño activo». Un Dueño
    // inactivo degradado a vendedor ya no se puede volver a activar como Dueño
    // por quien no debía tocarlo.
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: { rol: 'DUENO', activo: false },
        cambio: { rol: 'VENDEDOR' },
        duenosActivos: 3,
      })?.mensaje,
    ).toMatch(/administrador/i)
  })

  it('pero SÍ puede desactivar a cualquier otro rol', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: vendedor,
        cambio: { activo: false },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })

  it('y activar a un Dueño no es tocarlo en contra: se permite', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: { rol: 'DUENO', activo: false },
        cambio: { activo: true },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })

  it('renombrar a un Dueño tampoco es degradarlo', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: dueno,
        cambio: {},
        duenosActivos: 1,
      }),
    ).toBeNull()
  })
})

describe('2 · nadie deja la organización sin ningún Dueño activo', () => {
  it('el ÚLTIMO Dueño activo no se puede desactivar — ni por otro Dueño', () => {
    // Éste es el guard que nadie pidió, y el que evita que dos Dueños se
    // desactiven mutuamente y dejen la empresa sin quien reparta permisos.
    const r = rechazoDelCambio({
      actorRol: 'DUENO',
      objetivo: dueno,
      cambio: { activo: false },
      duenosActivos: 1,
    })
    expect(r).toBeTruthy()
    expect(r?.mensaje).toMatch(/sin ning/i)
    expect(r?.status).toBe(409)
    // Y NO por el motivo del otro guard: el actor es un Dueño, no un
    // administrador. Si la frase hablara del administrador, estaría pasando por
    // la rama equivocada y el caso de dos Dueños quedaría sin cubrir.
    expect(r?.mensaje).not.toMatch(/administrador/i)
  })

  it('tampoco se puede degradar', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: dueno,
        cambio: { rol: 'ADMINISTRADOR' },
        duenosActivos: 1,
      })?.mensaje,
    ).toMatch(/sin ning/i)
  })

  it('tampoco eliminar', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: dueno,
        cambio: { borrado: true },
        duenosActivos: 1,
      })?.mensaje,
    ).toMatch(/sin ning/i)
  })

  it('con DOS Dueños activos, desactivar a uno se permite', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: dueno,
        cambio: { activo: false },
        duenosActivos: 2,
      }),
    ).toBeNull()
  })

  it('un Dueño YA inactivo no cuenta: borrarlo no deja a nadie sin Dueño', () => {
    // El conteo es de Dueños ACTIVOS. Quitar a uno que ya no lo era no cambia
    // ese número, y prohibirlo sería cerrar la puerta de la limpieza.
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: { rol: 'DUENO', activo: false },
        cambio: { borrado: true },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })

  it('cambiarle el rol a DUENO (el mismo) no es degradar', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: dueno,
        cambio: { rol: 'DUENO' },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })

  it('desactivar al último VENDEDOR no tiene nada que ver: se permite', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: vendedor,
        cambio: { activo: false },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })
})

describe('4 · NADIE nombra a un Dueño salvo un Dueño (dictado del 29/09)', () => {
  // «nadie puede promover a nadie a dueno, solo el dueno». No es solo el
  // administrador: es TODO rol. Y cubre las DOS puertas —cambiar el rol de
  // alguien y darlo de alta ya como Dueño—, porque prohibir una y dejar la otra
  // es la misma puerta con otro nombre.

  it('un ADMINISTRADOR no puede nombrar Dueño a nadie', () => {
    const r = rechazoDeNombrarDueno('ADMINISTRADOR', 'DUENO')
    expect(r?.mensaje).toMatch(/due[ñn]o/i)
    expect(r?.status).toBe(403)
  })

  it('tampoco un DIRECTOR_COMERCIAL al que le hayan dado `administracion`', () => {
    // `rol_permisos` es DATOS: un Dueño puede conceder `administracion.crear` a
    // cualquier rol sin tocar código. Si el guard mirara el permiso en vez del
    // ROL, esta puerta quedaría abierta sin que nadie lo decidiera.
    expect(rechazoDeNombrarDueno('DIRECTOR_COMERCIAL', 'DUENO')?.status).toBe(403)
  })

  it('un DUENO sí puede', () => {
    expect(rechazoDeNombrarDueno('DUENO', 'DUENO')).toBeNull()
  })

  it('y pedir cualquier otro rol no lo mira nadie', () => {
    for (const rol of ['ADMINISTRADOR', 'VENDEDOR', 'FINANZAS', undefined]) {
      expect(rechazoDeNombrarDueno('ADMINISTRADOR', rol), String(rol)).toBeNull()
    }
  })

  it('el PATCH pasa por el mismo guard: promover a Dueño se rechaza', () => {
    const r = rechazoDelCambio({
      actorRol: 'ADMINISTRADOR',
      objetivo: { rol: 'VENDEDOR', activo: true },
      cambio: { rol: 'DUENO' },
      duenosActivos: 3,
    })
    expect(r?.status).toBe(403)
    expect(r?.mensaje).toMatch(/due[ñn]o/i)
  })

  it('pero dejar a un Dueño como Dueño NO es promover, y no se rechaza', () => {
    // Un PATCH que no cambia nada no es una promoción. Rechazarlo haría que
    // editarle el cargo a un Dueño fallara por un guard que no viene al caso.
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: { rol: 'DUENO', activo: true },
        cambio: { rol: 'DUENO' },
        duenosActivos: 3,
      }),
    ).toBeNull()
  })

  it('un DUENO promoviendo por PATCH sí pasa', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'DUENO',
        objetivo: { rol: 'VENDEDOR', activo: true },
        cambio: { rol: 'DUENO' },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })
})

describe('3 · cuando los dos guards aplican, manda el del administrador', () => {
  it('con un solo Dueño y un administrador, la frase nombra al administrador', () => {
    // No es cosmética: al administrador hay que decirle que ESO no es cosa
    // suya, no que «falta otro Dueño» — porque eso le haría creer que con dos
    // Dueños sí podría, y no puede.
    const r = rechazoDelCambio({
      actorRol: 'ADMINISTRADOR',
      objetivo: dueno,
      cambio: { activo: false },
      duenosActivos: 1,
    })
    expect(r?.mensaje).toMatch(/administrador/i)
    expect(r?.status).toBe(403)
  })
})
