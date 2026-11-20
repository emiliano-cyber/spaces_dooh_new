import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { avisosCompetenciaCtrl } from '@/lib/server/propuestas-competencia'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas/competencia { marca?, clienteId?, fechaInicio, fechaFin,
// sitioIds } → { avisosCompetencia } (PROP-MARCA, 20/11).
//
// La vista previa de la pantalla de alta: corre la competencia de marcas de
// Vallas (la MISMA regla que `POST /api/vallas/verificar`) mientras se eligen
// marca, fechas y sitios, antes de guardar. Solo informa: no guarda ni reserva.
//
// Permiso `comercial.crear` —el de crear propuestas— y NO `inventario.ver`: el
// aviso tiene que salirle a quien vende aunque no vea el inventario. A cambio,
// la respuesta no lleva la campaña rival (ni id, ni nombre, ni cliente): solo
// la marca, la categoría, el sitio y las fechas (ver `propuestas-competencia.ts`).
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await avisosCompetenciaCtrl(await req.json().catch(() => ({}))))
  } catch (e) {
    return respuestaError(e)
  }
}
