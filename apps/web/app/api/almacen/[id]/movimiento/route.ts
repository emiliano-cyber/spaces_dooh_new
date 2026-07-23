import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarMovimiento } from '@/lib/server/almacen-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS = new Set(['ENTRADA', 'SALIDA', 'TRASLADO', 'BAJA'])
const ETIQUETA: Record<string, string> = {
  ENTRADA: 'Regresó a almacén',
  SALIDA: 'Instaló activo',
  TRASLADO: 'Puso en traslado',
  BAJA: 'Dio de baja activo',
}

// POST /api/almacen/[id]/movimiento { tipo, motivo?, sitioId? } → mueve el activo.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const tipo = typeof body.tipo === 'string' ? body.tipo : ''
    if (!TIPOS.has(tipo)) return NextResponse.json({ error: 'Tipo de movimiento inválido.' }, { status: 400 })
    if (tipo === 'SALIDA' && !(typeof body.sitioId === 'string' && body.sitioId)) {
      return NextResponse.json({ error: 'Para instalar (salida) indica la pantalla destino.' }, { status: 400 })
    }
    const activo = await registrarMovimiento(
      params.id,
      {
        tipo: tipo as 'ENTRADA' | 'SALIDA' | 'TRASLADO' | 'BAJA',
        motivo: typeof body.motivo === 'string' ? body.motivo.trim() || null : null,
        sitioId: typeof body.sitioId === 'string' ? body.sitioId : null,
      },
      g.usuario.id,
    )
    if (!activo) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
    await registrarAccion(g.usuario, ETIQUETA[tipo] ?? 'Movió activo', activo.etiqueta)
    return NextResponse.json(activo)
  } catch (e) {
    return respuestaError(e)
  }
}
