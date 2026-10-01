import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { infoDeAlta, testigoCompleto, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/alta — lo que hace falta para dar de alta un equipo.
// ----------------------------------------------------------------------------
//  Devuelve de dónde se baja el instalador de cada tipo de equipo, con su
//  versión y su huella, y si esta instancia tiene testigo de alta configurado.
//
//  EL TESTIGO COMPLETO SOLO CON `?testigo=1`, y solo para quien puede dar de
//  alta (`inventario.crear`). Por omisión viaja únicamente el prefijo, que es
//  lo que se puede enseñar en una pantalla sin repartir la credencial: pintarlo
//  entero al cargar la página lo dejaría en el historial del navegador, en
//  cualquier captura de pantalla y en la consola de red de quien pase por ahí.
//  Se pide a propósito, con un clic, y el registro de esa petición queda.
// ============================================================================

export async function GET(req: Request) {
  const quiereTestigo = new URL(req.url).searchParams.get('testigo') === '1'

  // Ver los instaladores es parte de consultar el inventario; llevarse la
  // credencial que asigna un equipo a la empresa, no.
  const g = await exigir('inventario', quiereTestigo ? 'crear' : 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  try {
    const info = await infoDeAlta()
    if (!quiereTestigo) return NextResponse.json(info)
    return NextResponse.json({ ...info, testigoCompleto: testigoCompleto() })
  } catch (e) {
    return respuestaError(e)
  }
}
