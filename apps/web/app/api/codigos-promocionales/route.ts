import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { listarCodigosCtrl, guardarCodigoCtrl } from '@/lib/server/codigos-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/codigos-promocionales — los CÓDIGOS PROMOCIONALES de la organización.
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  CADA EMPRESA PONE LOS SUYOS. Es la regla 3 del ADR 0039, dictada por el
//  dueño el 2026-09-28: «las promociones las debe de poner cada empresa». No es
//  una preferencia de configuración, es el modelo de negocio — esto es un
//  producto de instancias soberanas y una promoción es una decisión comercial
//  del dueño, no una regla del producto. Por eso la tabla nace con `tenant_id`
//  y RLS `enable` + `force`, cerrada por los dos lados.
//
//  ─── EL CANDADO: leer con `inventario.ver`, ESCRIBIR como cambio SENSIBLE ──
//  Crear un cupón es decidir cuánto dinero se regala y a cuánta gente. Un
//  `VERANO90` sin tope de usos rebaja la cartera entera hasta que alguien se dé
//  cuenta. Por eso escribir aquí pide exactamente lo mismo que una tarifa y que
//  la escala de volumen: `exigirCambioSensible`, la ruta ENTERA, sin lista
//  blanca de campos.
//
//  ⚠️ CREAR UN CUPÓN Y CANJEARLO SON DOS PERMISOS DISTINTOS, Y ES EL PUNTO.
//  Aquí se pide `inventario` —Administración—; canjear vive en
//  `/api/propuestas/:id/codigo` y pide `comercial.crear`. Si fueran el mismo,
//  quien vende podría crearse su propio cupón del 50 % y aplicárselo, y el
//  cupón dejaría de ser una decisión del dueño para ser un descuento comercial
//  sin tope. Es también la razón por la que COD-02 decide que el cupón NO
//  cuenta contra el tope: lo autoriza otra persona.
// ============================================================================

// GET → los cupones de la organización, con su cuenta de canjes.
export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarCodigosCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}

// POST → alta de un cupón. El código repetido y el formato inválido se rechazan
// en el controller, con la frase que dice qué hacer.
export async function POST(req: Request) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const cod = await guardarCodigoCtrl(await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      'Creó un código promocional',
      `${cod.codigo}: ${cod.descuentoPct} % · del ${cod.vigenteDesde} al ${cod.vigenteHasta} · ${
        cod.usosMaximos == null ? 'sin tope de usos' : `${cod.usosMaximos} usos`
      }`,
    )
    return NextResponse.json(cod, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
