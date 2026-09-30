import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { avisosDeProgramacion, textoAccionProgramacion } from '@/lib/franja-programada'
import { asignarFranjaProgramada, listarProgramacion } from './programacion-repo'

// ============================================================================
//  lib/server/programacion-controller.ts — la forma de entrada de la franja
//  PROGRAMADA y la aplicación de su regla.   PROG-01.
// ----------------------------------------------------------------------------
//  `.strict()` A PROPÓSITO. Un campo de más se rechaza con 400 en vez de
//  ignorarse, por dos motivos concretos:
//   · `tenantId` en el cuerpo haría creer que se puede elegir la organización;
//     no se puede —sale de la sesión—, y ignorarlo en silencio esconde el
//     intento.
//   · cualquier cosa que suene a lo CONTRATADO (`franjaContratadaId`, un
//     precio) no tiene sitio aquí. Programar no vende.
//
//  Ids con `uuid()`: van a un `any($1::uuid[])`, y un id mal formado haría que
//  Postgres lo descubriera con un 22P02 a mitad de la transacción.
// ============================================================================

const ID = z.string().trim().uuid('Identificador no válido')

// Tope por operación: la pantalla ofrece las campañas vigentes de UNA
// organización, que son decenas. 500 da holgura y evita que un cuerpo desmedido
// convierta un `for update` en un bloqueo de media tabla.
const MAX_CAMPANAS = 500

const asignacionSchema = z
  .object({
    // OBLIGATORIO aunque sea null: `null` significa «quitar la franja», y que
    // falte el campo no puede significar lo mismo por accidente.
    franjaId: ID.nullable(),
    campanaIds: z
      .array(ID)
      .min(1, 'Elige al menos una campaña')
      .max(MAX_CAMPANAS, `No se pueden programar más de ${MAX_CAMPANAS} campañas a la vez`),
  })
  .strict()

const lecturaSchema = z.object({ campanaId: ID.optional() }).strict()

/**
 * Programa (o quita) una franja en una o varias campañas, atómico.
 *
 * El 404 dice que NO se programó NINGUNA, y es la frase que importa: quien
 * elige diez campañas y ve «una no existe» tiene que saber que las otras nueve
 * tampoco cambiaron.
 */
export async function asignarFranjaProgramadaCtrl(body: unknown) {
  const d = validar(asignacionSchema, body)
  const ids = [...new Set(d.campanaIds.map((x) => x.toLowerCase()))]
  const r = await asignarFranjaProgramada(ids, d.franjaId)
  if (!r.ok) {
    if (r.motivo === 'franja') {
      throw new AppError('Esa franja no existe en esta organización o está dada de baja.', 404)
    }
    throw new AppError(
      'Alguna de las campañas elegidas no existe en esta organización; no se programó ninguna.',
      404,
    )
  }
  return {
    franja: r.franja,
    campanas: r.campanas,
    bitacora: textoAccionProgramacion({ franja: r.franja, campanas: r.campanas }),
  }
}

/**
 * La programación de la organización —o de una campaña— con los avisos
 * «se vendió como X y se programa en Y» ya calculados con la regla pura.
 *
 * Se calculan en el SERVIDOR y no solo en la pantalla: así las dos superficies
 * reciben el mismo resultado y no puede haber una que avise y otra que no.
 */
export async function programacionCtrl(op?: { campanaId?: string | null }) {
  const d = validar(lecturaSchema, op?.campanaId ? { campanaId: op.campanaId } : {})
  const { franjas, campanas } = await listarProgramacion(
    d.campanaId ? { campanaId: d.campanaId } : undefined,
  )
  const porId = new Map(franjas.map((f) => [f.id, f]))
  return {
    franjas,
    campanas: campanas.map((c) => ({
      ...c,
      avisos: avisosDeProgramacion({
        programada: c.franjaProgramadaId ? porId.get(c.franjaProgramadaId) ?? null : null,
        contratadas: c.contratadas,
      }),
    })),
  }
}
