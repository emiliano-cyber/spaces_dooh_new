import { NextResponse } from 'next/server'
import { z } from 'zod'
import { exigir } from '@/lib/server/auth'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { respuestaError, validar } from '@/lib/server/errores'
import {
  obtenerFilaActualizacion,
  fijarModo,
  aprobarDigest,
  type FilaActualizacion,
} from '@/lib/server/actualizaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET/PATCH /api/actualizaciones — ADR 0037: el dueño de la instancia ve qué
// versión hay disponible y decide si la toma.
//
// Los modos se declaran AQUÍ, sueltos, y NO se importan de
// `scripts/actualizaciones.mjs` (donde vive `decidirActualizacion`, ya
// probada). Ese archivo está fuera de `apps/web`, y con `output: 'standalone'`
// Next solo empaqueta lo que traza: un import cruzado puede faltar en la
// imagen de Docker sin fallar en local, que es el peor sitio para enterarse.
// El `check (modo in (...))` de la columna en la migración es el respaldo
// real; este enum solo evita que un typo llegue como 500 de Postgres en vez
// de un 400 legible.
const MODOS = ['automatica', 'aprobacion'] as const

// `.strict()`: un campo con typo, o uno que le toca al actualizador
// (`digestDisponible`, `versionInstalada`...), da 400 en vez de ignorarse en
// silencio — el mismo criterio que `configSchema` en `app/api/config/route.ts`.
//
// El `.refine()` de abajo hace XOR: exactamente uno de los dos campos, nunca
// los dos ni ninguno. No es un capricho de forma: son DOS ACCIONES distintas
// (cambiar el modo, o aprobar una version) y el tipo del brief —
// `{ modo? } | { aprobarDigest: string }` — ya las trataba como alternativas.
//
// Elegido sobre "envolver las dos escrituras en una transaccion" (ronda de
// revision 1) porque el producto no le encuentra sentido a pedir las dos
// cosas en una sola peticion real de la UI (un interruptor de modo y un boton
// de "instalar ahora" son dos gestos distintos), y el XOR es mas honesto:
// rechaza ANTES de tocar la base, en vez de escribir y decidir si revertir.
// Con una transaccion la peticion combinada seguiria siendo ambigua -- ¿que
// se le informa al dueno si el modo se guarda pero la aprobacion revienta,
// todo dentro de una transaccion que al final SI hace commit del modo? -- y
// el propio revisor senalo que el fallo real era justo esa ambiguedad.
const patchSchema = z
  .object({
    modo: z.enum(MODOS).optional(),
    aprobarDigest: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((b) => (b.modo !== undefined) !== (b.aprobarDigest !== undefined), {
    message: 'Manda `modo` o `aprobarDigest`, no los dos a la vez ni ninguno',
  })

function aEstado(fila: FilaActualizacion) {
  return {
    modo: fila.modo,
    versionInstalada: fila.version_instalada,
    versionDisponible: fila.version_disponible,
    digestDisponible: fila.digest_disponible,
    migracionesPendientes: fila.migraciones_pendientes,
    comprobadoEn: fila.comprobado_en instanceof Date ? fila.comprobado_en.toISOString() : fila.comprobado_en,
    aprobadoDigest: fila.aprobado_digest,
    // Hay novedad si lo disponible existe y es distinto de lo instalado. Un
    // digest disponible IGUAL al instalado es "ya lo tienes", no una novedad
    // — así lo define el ADR 0037 en la tabla misma.
    hayNovedad: fila.digest_disponible != null && fila.digest_disponible !== fila.digest_instalado,
  }
}

export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(aEstado(await obtenerFilaActualizacion()))
  } catch (e) {
    return respuestaError(e)
  }
}

// PATCH: el dueño cambia el modo, O aprueba el digest disponible — nunca las
// dos en la misma petición (el `.refine()` del schema lo impone y ya rechazó
// cualquier otra combinación antes de llegar aquí). La comprobación del
// digest va EN EL SERVIDOR (`aprobarDigest()` en el repo): aprobar algo que
// ya no es lo disponible da 409, nunca se guarda.
export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const b = validar(patchSchema, await req.json().catch(() => ({})))

    if (b.modo !== undefined) {
      await fijarModo(b.modo)
      await registrarAccion(g.usuario, `Cambio el modo de actualizacion a "${b.modo}"`, 'Actualizaciones')
    }
    if (b.aprobarDigest !== undefined) {
      await aprobarDigest(b.aprobarDigest, g.usuario.id)
      await registrarAccion(g.usuario, 'Aprobo instalar la version disponible', b.aprobarDigest)
    }

    return NextResponse.json(aEstado(await obtenerFilaActualizacion()))
  } catch (e) {
    return respuestaError(e)
  }
}
