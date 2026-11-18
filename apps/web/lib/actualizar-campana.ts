// ============================================================================
//  «Actualizar campaña» (pedido del dueño, 18/11).
// ----------------------------------------------------------------------------
//  Cambiar los creativos de una campaña ya publicada costaba cuatro sitios:
//  subir el nuevo en la ficha, ir a Creativos a aprobarlo, volver a Validación
//  a borrar los viejos uno por uno y pulsar «Volver a publicar». Ahora es una
//  ventana: se marca qué se conserva y qué se elimina, se suben los nuevos con
//  «¿Apruebas este creativo?» al lado, y un botón hace todo y manda a DOOHmain.
//
//  No hay endpoint nuevo A PROPÓSITO: cada paso reusa la ruta que ya existe y
//  ya trae sus guardas (la baja que retira de DOOHmain antes de borrar, la
//  aprobación que autoasigna la rotación, la republicación que exige que toda
//  pantalla tenga creativo). Lo que vive aquí es el ORDEN, que es lo que hace
//  que funcione, y qué se le dice a la persona si algo falla a la mitad.
//
//  El orden, y por qué:
//    1. SUBIR los nuevos. Si un archivo falla, todavía no se ha borrado nada.
//    2. ELIMINAR los que se quitan.
//    3. APROBAR. Después de eliminar y no antes: la autoasignación
//       (`autollenadoDeSpot`) llena con TODOS los aprobados los spots que
//       quedaron VACÍOS, así que el nuevo entra en las pantallas del que se
//       fue. Al revés, un spot ajustado a mano que solo tenía al viejo se
//       quedaría vacío y la republicación lo rechazaría.
//    4. PUBLICAR en DOOHmain (la misma republicación de «Volver a publicar»).
//  Al primer fallo se para: lo hecho queda hecho y se dice qué fue.
// ============================================================================

export type EstatusCreativo = 'PENDIENTE' | 'VALIDADA' | 'RECHAZADA'

export interface CreativoActual {
  id: string
  nombre: string
  estatus: EstatusCreativo
}

export interface CreativoNuevo {
  nombre: string
  // El HTML del creativo, ya convertido (una imagen pasa por `imagenAHtml`).
  codigo: string
  // «¿Apruebas este creativo?» — sin la palomita se guarda PENDIENTE y no se
  // manda a DOOHmain.
  aprobar: boolean
}

export interface PlanActualizacion {
  // Ids de los creativos de antes que se eliminan. Los demás se conservan.
  eliminar: string[]
  // Ids de creativos de antes, todavía sin aprobar, que se aprueban aquí.
  aprobarExistentes: string[]
  nuevos: CreativoNuevo[]
}

export type ProblemaPlan = 'sin-cambios' | 'sin-aprobados'

// Antes de mandar nada: ¿hay algo que hacer, y quedará al menos un creativo
// aprobado? Sin ninguno, la republicación fallaría con todas las pantallas
// «sin creativo» DESPUÉS de haber borrado los viejos — mejor no empezar.
export function revisarPlan(actuales: CreativoActual[], plan: PlanActualizacion): ProblemaPlan | null {
  const quitados = new Set(plan.eliminar)
  const aprobarAqui = new Set(plan.aprobarExistentes)
  const hayCambios =
    plan.eliminar.length > 0 ||
    plan.nuevos.length > 0 ||
    plan.aprobarExistentes.some((id) => !quitados.has(id))
  if (!hayCambios) return 'sin-cambios'
  const quedanAprobados =
    actuales.filter((c) => !quitados.has(c.id) && (c.estatus === 'VALIDADA' || aprobarAqui.has(c.id))).length +
    plan.nuevos.filter((n) => n.aprobar).length
  return quedanAprobados > 0 ? null : 'sin-aprobados'
}

export interface ApiActualizacion {
  subir(nuevo: CreativoNuevo): Promise<{ id: string }>
  eliminar(id: string): Promise<void>
  aprobar(id: string): Promise<void>
  publicar(): Promise<unknown>
}

export type PasoActualizacion = 'subir' | 'eliminar' | 'aprobar' | 'publicar'

export interface ResultadoActualizacion {
  ok: boolean
  hechos: { subidos: number; eliminados: number; aprobados: number }
  // Lo que respondió la republicación (resultado por pantalla de DOOHmain).
  publicacion?: unknown
  // `nombre` es el del creativo nuevo al subir, y el id al eliminar o aprobar
  // (quien llama lo traduce al nombre que conoce).
  fallo?: { paso: PasoActualizacion; nombre?: string; error: string }
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function ejecutarActualizacion(
  plan: PlanActualizacion,
  api: ApiActualizacion,
): Promise<ResultadoActualizacion> {
  const hechos = { subidos: 0, eliminados: 0, aprobados: 0 }
  const quitados = new Set(plan.eliminar)
  const porAprobar = plan.aprobarExistentes.filter((id) => !quitados.has(id))

  for (const n of plan.nuevos) {
    try {
      const { id } = await api.subir(n)
      hechos.subidos += 1
      if (n.aprobar) porAprobar.push(id)
    } catch (e) {
      return { ok: false, hechos, fallo: { paso: 'subir', nombre: n.nombre, error: mensaje(e) } }
    }
  }
  for (const id of plan.eliminar) {
    try {
      await api.eliminar(id)
      hechos.eliminados += 1
    } catch (e) {
      return { ok: false, hechos, fallo: { paso: 'eliminar', nombre: id, error: mensaje(e) } }
    }
  }
  for (const id of porAprobar) {
    try {
      await api.aprobar(id)
      hechos.aprobados += 1
    } catch (e) {
      return { ok: false, hechos, fallo: { paso: 'aprobar', nombre: id, error: mensaje(e) } }
    }
  }
  try {
    const publicacion = await api.publicar()
    return { ok: true, hechos, publicacion }
  } catch (e) {
    return { ok: false, hechos, fallo: { paso: 'publicar', error: mensaje(e) } }
  }
}
