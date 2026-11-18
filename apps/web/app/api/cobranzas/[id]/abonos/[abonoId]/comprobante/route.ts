import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { obtenerComprobanteAbonoCtrl } from '@/lib/server/finanzas-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cobranzas/[id]/abonos/[abonoId]/comprobante → el archivo del pago,
// con su Content-Type para que el navegador lo abra. Mismo trato que el
// comprobante de un pago de renta (`app/api/pagos-renta/[id]/adjunto/[tipo]`).
export async function GET(_req: Request, { params }: { params: { id: string; abonoId: string } }) {
  const g = await exigir('finanzas', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const dataUrl = await obtenerComprobanteAbonoCtrl(params.id, params.abonoId)
    const coma = dataUrl.indexOf(',')
    const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
    const bytes = Buffer.from(dataUrl.slice(coma + 1), 'base64')
    const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1]
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename="comprobante-${params.abonoId.slice(0, 8)}.${ext}"`,
        // Documento privado de un tenant: que no quede en caches compartidas.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
