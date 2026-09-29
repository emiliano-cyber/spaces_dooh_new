import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { guardarTemporadaCtrl } from '@/lib/server/rejilla-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/rejilla/temporadas — alta de una TEMPORADA (ADR 0039, Fase 1).
// ----------------------------------------------------------------------------
//  No hay GET propio: el catálogo entero —franjas y temporadas— sale por
//  `GET /api/rejilla/franjas`, porque la pantalla que lo administra necesita las
//  dos a la vez y dos rutas de lectura serían dos viajes para pintar una tabla.
//
//  Mismo candado que las franjas y por el mismo motivo: una temporada es una
//  dimensión del precio de venta. Mover el «Buen Fin» dos días cambia lo que se
//  cobra en todo el inventario sin tocar una sola tarifa.
//
//  EL SOLAPE ESTÁ PROHIBIDO, y conviene saber qué cuesta: «Diciembre» y «Buen
//  Fin» no pueden convivir tal cual. Es deliberado — obliga al dueño a decir qué
//  precio manda esos cuatro días, que es una decisión de negocio. Si dos
//  temporadas pudieran cubrir el mismo día, el precio de ese spot dependería de
//  un desempate que nadie decidió, y congelarlo no salvaría de nada: congelaría
//  un precio inexplicable.
// ============================================================================
export async function POST(req: Request) {
  const g = await exigirCambioSensible('precios', 'crear')
  if (!g.ok) return g.res
  try {
    const t = await guardarTemporadaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó una temporada', t.nombre)
    return NextResponse.json(t, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
