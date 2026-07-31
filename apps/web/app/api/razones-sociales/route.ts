import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearRazonSocialCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/razones-sociales → alta de razón social de un arrendador.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const { razonSocial, contratosAdoptados } = await crearRazonSocialCtrl(
      await req.json().catch(() => ({})),
    )
    // El audit distingue las dos cosas: crear la razón social y, de paso, haber
    // reatribuido contratos que estaban sin ninguna. Quien revise la bitácora
    // después necesita ver que ese alta movió datos de otros registros.
    await registrarAccion(
      g.usuario,
      contratosAdoptados > 0
        ? `Creó razón social y la asignó a ${contratosAdoptados} contrato(s) sin razón social`
        : 'Creó razón social',
      razonSocial.razonSocial,
    )
    // Se devuelve la razón social en la raíz (como antes, para no romper a quien
    // ya la consume) más el conteo, que la UI usa para avisar del efecto.
    return NextResponse.json({ ...razonSocial, contratosAdoptados }, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
