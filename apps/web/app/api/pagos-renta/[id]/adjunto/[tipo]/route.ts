import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { obtenerAdjuntoPagoCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pagos-renta/[id]/adjunto/[tipo] → sirve la factura o el comprobante.
// Los adjuntos NO viajan en /api/estado (pesan MB y ese endpoint trae todos los
// pagos tras cada mutación): se piden aquí, solo cuando alguien los abre.
export async function GET(_req: Request, { params }: { params: { id: string; tipo: string } }) {
  const g = await exigir('arrendadores', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const dataUrl = await obtenerAdjuntoPagoCtrl(params.id, params.tipo)
    // data:<mime>;base64,<datos> → binario con su Content-Type, así el navegador
    // lo abre en vez de descargar un blob opaco.
    const coma = dataUrl.indexOf(',')
    const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
    const bytes = Buffer.from(dataUrl.slice(coma + 1), 'base64')
    const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1]
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename="${params.tipo}-${params.id.slice(0, 8)}.${ext}"`,
        // Documento privado de un tenant: que no quede en caches compartidas.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
