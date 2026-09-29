import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { aplicarPaqueteCtrl, quitarPaqueteCtrl } from '@/lib/server/paquetes-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/propuestas/:id/paquete — APLICAR o QUITAR un paquete cerrado.
//  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  ⚠️ EL CUERPO LLEVA EL `paqueteId` Y NADA MÁS.
//
//  Ni el precio, ni el nombre, ni la bandera de si admite códigos. El servidor
//  busca el paquete bajo RLS y copia sus datos él. Es el invariante número uno
//  de esta fase: un paquete SUSTITUYE el precio de la venta entera, así que si
//  ese número viajara en el JSON, cerrar cinco pantallas en un peso sería un
//  `curl` — y sin ningún error, porque la propuesta quedaría perfectamente
//  coherente consigo misma.
//
//  El hallazgo B40 dice que la cadena de precio de la Fase 1 sí vive entera en
//  el navegador. Esta fase no lo arregla —es la decisión D11, del dueño— pero
//  tampoco lo amplía.
//
//  ─── POR QUÉ ES UNA RUTA APARTE Y NO UN CAMPO DEL PATCH DE LA PROPUESTA ───
//  Porque aplicar es una TRANSACCIÓN con cinco comprobaciones de estado dentro
//  —propuesta no aprobada, paquete de aquí, paquete activo, sin otro paquete,
//  sin cupón incompatible, pantallas que cuadran— y meterla en el PATCH general
//  la mezclaría con el guardado del nombre y las notas. Aparte, además, el
//  registro de Actividad puede decir qué pasó.
//
//  ─── EL PERMISO ES `comercial.crear`, Y NO EL DE ADMINISTRACIÓN ───────────
//  Aplicar un paquete es parte de vender. CREARLO es otra cosa y vive en
//  `/api/paquetes`, con `exigirCambioSensible('inventario', …)`.
// ============================================================================

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await aplicarPaqueteCtrl(params.id, await req.json().catch(() => ({})))
    // La bitácora DICE EL PRECIO. Es el número que sustituyó a la suma de las
    // tarifas, y sin él nadie podrá explicar la venta seis meses después.
    await registrarAccion(
      g.usuario,
      'Aplicó un paquete cerrado a la propuesta',
      `${r.nombre}: $${r.precio.toLocaleString('es-MX')} por ${r.composicion.length} pantalla(s)` +
        ' — el precio del paquete SUSTITUYE la suma de las tarifas de lista',
    )
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await quitarPaqueteCtrl(params.id)
    await registrarAccion(
      g.usuario,
      'Quitó el paquete cerrado de la propuesta',
      `${params.id} — vuelve a los precios de lista de cada pantalla`,
    )
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
