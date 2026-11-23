import { NextResponse } from 'next/server'
import { enviarCreativoClienteCtrl } from '@/lib/server/envio-cliente-publico-controller'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { ENVIO_MAX_MB } from '@/lib/envio-creativo-cliente'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// El cuerpo trae la imagen en base64 (4/3 de su peso) más unos campos: con
// esto cabe la imagen más grande que se acepta, y lo que pase de aquí se corta
// ANTES de parsear el JSON.
const MAX_CUERPO = Math.ceil((ENVIO_MAX_MB * 1024 * 1024 * 4) / 3) + 64 * 1024

// POST /api/propuestas/publica/:token/creativos  { archivo, nombre?, sitioId?, ancho?, alto? }
// ENVIO-CLIENTE (18/11) → el cliente manda su creativo desde la liga. SIN auth
// a propósito, como la liga misma: el token es la autorización. Queda
// PENDIENTE en `envios_creativo_cliente`; no es un creativo hasta que un Dueño
// o Administrador lo aprueba en la ficha de la campaña.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Más corto que las lecturas (60/min): una subida pesa megas y un humano
  // manda unas pocas. El tope por campaña y día va aparte, en el controller.
  const lim = limitar(`envio-creativo:${ipDe(req)}`, 10, 10 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
  try {
    const texto = await req.text()
    if (texto.length > MAX_CUERPO) {
      return NextResponse.json({ error: `La imagen supera ${ENVIO_MAX_MB} MB` }, { status: 413 })
    }
    let body: unknown
    try {
      body = JSON.parse(texto)
    } catch {
      return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
    }
    const r = await enviarCreativoClienteCtrl(params.id, body, ipDe(req))
    return NextResponse.json(r, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
