import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { listarCatalogoCtrl, guardarFranjaCtrl } from '@/lib/server/rejilla-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/rejilla/franjas — el catálogo de FRANJAS HORARIAS de la organización.
//  ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  POR QUÉ POR ORGANIZACIÓN Y NO FIJAS PARA LA FLOTA: el prime de una pantalla
//  en un centro comercial no es el de una en carretera, y esto es un producto de
//  instancias soberanas — cada dueño corre su copia con su mercado. El motivo
//  completo, con el precedente de los dos lados que ya tiene el repositorio
//  (`catalogo_roles_entidad` es de la flota; `entidades_fiscales` es del owner),
//  está en la cabecera de `20260928_rejilla_franja_temporada.sql`.
//
//  ─── EL CANDADO: leer con `inventario.ver`, ESCRIBIR como cambio SENSIBLE ──
//  Una franja no es un dato descriptivo: es una dimensión del PRECIO DE VENTA.
//  Mover «Prime» de 06:00–10:00 a 06:00–14:00 cambia lo que se cobra en cuatro
//  horas de inventario entero, sin tocar una sola tarifa. Por eso escribir aquí
//  pide exactamente lo mismo que `PATCH /api/sitios/:id/modalidades`:
//  `exigirCambioSensible`, la ruta ENTERA, sin lista blanca de campos.
//
//  Y se usa `exigirCambioSensible` —o sea `exigirDesbloqueo`— y NO
//  `exigirReautenticacionSiempre`, por el mismo motivo escrito en la ruta de
//  modalidades: el trato tiene que ser EXACTAMENTE el de una tarifa, ni más
//  estricto ni más laxo, o la incoherencia se acaba resolviendo por el lado malo.
// ============================================================================

// GET → franjas y temporadas juntas. Van en una sola respuesta porque la
// pantalla de configuración necesita las dos para pintar una tabla, y pedirlas
// por separado son dos viajes. `?inactivas=1` incluye las apagadas: esa pantalla
// es la única que las necesita, para poder reactivarlas.
export async function GET(req: Request) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const incluirInactivas = new URL(req.url).searchParams.get('inactivas') === '1'
    return NextResponse.json(await listarCatalogoCtrl({ incluirInactivas }))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST → alta de una franja. El solape se rechaza en el controller con el
// nombre de la franja con la que choca.
export async function POST(req: Request) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const franja = await guardarFranjaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó una franja horaria', franja.nombre)
    return NextResponse.json(franja, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
