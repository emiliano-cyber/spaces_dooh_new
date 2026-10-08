import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q } from '@/lib/server/db'
import { listarEquipos, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes — los equipos Space Eyes de esta instancia.
// ----------------------------------------------------------------------------
//  DE DÓNDE SALE EL ALCANCE. De la llave de servicio, no de aquí: Space Eye
//  responde con los equipos de su dueño y nada más. Esta ruta no puede ampliar
//  lo que se ve, solo emparejarlo con las pantallas del tenant.
//
//  EL PERMISO ES `inventario.ver`. Un equipo Space Eyes vigila una pantalla del
//  inventario, así que quien puede ver el inventario puede ver quién lo está
//  mirando. Se reutiliza a propósito en vez de crear un módulo nuevo: el
//  catálogo de permisos viaja en las migraciones, y un módulo `space_eyes` sin
//  su fila en `rol_permisos` dejaría la pantalla en 403 para todo el mundo
//  —`tienePermiso` es fail-closed—.
//
//  EL EMPAREJAMIENTO pantalla↔equipo es el mismo de siempre:
//  `sitios.codigo_proveedor == device.billboard_code`. Se hace aquí, con una
//  sola consulta bajo RLS, en vez de una por equipo. Un equipo cuyo código no
//  empareje sale igual, marcado como sin pantalla: un equipo que no aparece es
//  un equipo que nadie repara.
// ============================================================================

export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ disponible: false, motivo: 'no_configurado', equipos: [] })
  }

  try {
    const equipos = await listarEquipos()

    // Las pantallas del tenant, bajo RLS. Solo lo que hace falta para enlazar.
    const sitios = await q<{ id: string; nombre: string; codigo_proveedor: string | null }>(
      'select id, nombre, codigo_proveedor from sitios where codigo_proveedor is not null',
    )
    const porCodigo = new Map<string, { id: string; nombre: string }>()
    for (const s of sitios) {
      const c = (s.codigo_proveedor ?? '').trim().toLowerCase()
      if (c) porCodigo.set(c, { id: s.id, nombre: s.nombre })
    }

    return NextResponse.json({
      disponible: true,
      equipos: equipos.map((e) => ({
        ...e,
        pantalla: porCodigo.get((e.codigoPantalla ?? '').trim().toLowerCase()) ?? null,
      })),
    })
  } catch (e) {
    return respuestaError(e)
  }
}
