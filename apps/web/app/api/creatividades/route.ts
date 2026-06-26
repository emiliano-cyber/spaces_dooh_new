import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearCreatividad, CreatividadError } from '@/lib/server/creativos-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/creatividades  { campanaId, nombre, archivoUrl, formato?, resolucion? }
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.campanaId || !body?.nombre) {
    return NextResponse.json({ error: 'Campaña y nombre requeridos' }, { status: 400 })
  }
  if (!body?.archivoUrl && !body?.codigo) {
    return NextResponse.json({ error: 'Falta la imagen o el código del creativo' }, { status: 400 })
  }
  try {
    const crea = await crearCreatividad({
      campanaId: body.campanaId,
      nombre: body.nombre,
      archivoUrl: body.archivoUrl ?? null,
      codigo: body.codigo ?? null,
      formato: body.formato ?? null,
      resolucion: body.resolucion ?? null,
    })
    await registrarAccion(g.usuario, 'Subió creativo', body.nombre)
    return NextResponse.json(crea, { status: 201 })
  } catch (e) {
    // Transición inválida (p. ej. OOH → creatividad) → 409 con mensaje claro.
    if (e instanceof CreatividadError) return NextResponse.json({ error: e.message }, { status: 409 })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo crear' }, { status: 500 })
  }
}
