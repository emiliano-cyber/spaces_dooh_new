import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import {
  estadoCuestionarioCtrl,
  contestarCuestionarioCtrl,
} from '@/lib/server/bienvenida-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/bienvenida — el cuestionario de las razones sociales del owner.
// ----------------------------------------------------------------------------
//  Las tres preguntas que pidió el dueño el 2026-09-17, y su efecto: crear las
//  razones sociales del negocio con sus papeles. No es una encuesta — de aquí
//  salen filas en `entidades_fiscales` y `entidad_roles`.
//
//  ─── Por qué esto es una ruta propia y NO parte del alta ──────────────────
//  El cuestionario va DESPUÉS del alta, a propósito. El bootstrap de una
//  organización es de UN SOLO USO: `hayAlgunTenant()` cierra la puerta para
//  siempre en cuanto existe una organización, así que meter aquí un paso más
//  deja instancias que no pueden nacer. El flujo de alta no se toca.
//
//  ─── Permiso `administracion`, como el módulo de entidades ────────────────
//  Es la identidad fiscal del negocio —a nombre de quién paga y factura—, no un
//  dato operativo. Quien captura contratos no decide con qué sociedad se firma.
//  Mismo guard que `/api/entidades`, y por el mismo motivo.
// ============================================================================

// GET /api/bienvenida → si hace falta preguntarlo, qué preguntar, y qué ya hay.
//
// `pendiente` se DERIVA del recuento de entidades: no hay columna que lo guarde
// ni migración que aplicar. Las entidades ya creadas viajan también para que
// quien VUELVA vea lo que contestó en vez de una pantalla en blanco.
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await estadoCuestionarioCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/bienvenida → contesta el cuestionario y crea las razones sociales.
//
// O quedan todas con sus roles, o ninguna: la transacción vive en el repo
// (`withTenantTx`). A medias es peor que no haberlo contestado, porque el
// estado se deriva de que exista alguna entidad y el cuestionario ya no se
// volvería a ofrecer.
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await contestarCuestionarioCtrl(await req.json().catch(() => ({})))
    // La bitácora nombra CUÁNTAS razones sociales y con QUÉ roles, no solo que
    // se contestó: el papel es la parte que decide qué documentos salen a
    // nombre de cada entidad, y quien revise después necesita poder leerlo sin
    // abrir la base.
    await registrarAccion(g.usuario, 'Contestó el cuestionario de bienvenida', r.resumen)
    return NextResponse.json({ entidades: r.entidades, resumen: r.resumen }, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
