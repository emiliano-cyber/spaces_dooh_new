import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'
import { equipoDetalle, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/:id — la ficha de un equipo.
// ----------------------------------------------------------------------------
//  Devuelve el equipo, su estado más reciente, su consumo, sus últimas fotos y
//  —si su código empareja con una pantalla del tenant— la pantalla y la foto
//  que el cliente subió a su galería.
//
//  LA «FOTO DEL CLIENTE» NO ES UNA TABLA NUEVA. Es la primera de la galería de
//  la pantalla (`sitios.fotos`), que ya existe y que el cliente ya sube desde la
//  ficha de Inventario. Inventarle almacenamiento propio a este módulo habría
//  dejado dos galerías de la misma pantalla que se contradicen entre sí.
//
//  Un equipo que no es de esta instancia da 404 en Space Eye, y aquí se
//  convierte en el mismo 404: la ficha dice «no encontrado», nunca «no es tuyo».
// ============================================================================

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Equipo inválido' }, { status: 400 })
  }

  try {
    const equipo = await equipoDetalle(id)
    if (!equipo) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

    // La pantalla del tenant que vigila este equipo, y su galería. Va bajo RLS,
    // así que una pantalla de otro tenant sencillamente no aparece.
    let pantalla: { id: string; nombre: string; fotoCliente: string | null } | null = null
    const codigo = (equipo.codigoPantalla ?? '').trim()
    if (codigo) {
      const s = await q1<{ id: string; nombre: string; fotos: string[] | null }>(
        'select id, nombre, fotos from sitios where lower(codigo_proveedor) = lower($1) limit 1',
        [codigo],
      )
      if (s) pantalla = { id: s.id, nombre: s.nombre, fotoCliente: s.fotos?.[0] ?? null }
    }

    return NextResponse.json({ equipo, pantalla })
  } catch (e) {
    return respuestaError(e)
  }
}
