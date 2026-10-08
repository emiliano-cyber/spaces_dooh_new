import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { spaceEyeHabilitado, urlAbsolutaDeFoto } from '@/lib/server/space-eye'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/foto?p=/storage/... — las fotos, servidas por nosotros.
// ----------------------------------------------------------------------------
//  POR QUÉ EXISTE, Y NO ES UN LUJO
//
//  Esta aplicación se sirve por HTTPS y Space Eye, hoy, por HTTP plano. Un
//  navegador NO carga una imagen `http://` dentro de una página `https://`: la
//  bloquea como contenido mixto, sin pedir permiso y sin más señal que una línea
//  en la consola. O sea que apuntar el `<img>` directo a Space Eye deja el
//  módulo entero sin fotos EN PRODUCCIÓN, funcionando perfecto en local. Es el
//  fallo que no avisa.
//
//  Sirviéndolas desde aquí van por el mismo dominio y el mismo certificado que
//  la página, así que funcionan con Space Eye en HTTPS y también mientras siga
//  en HTTP. Y de paso el navegador del cliente nunca habla directo con Space
//  Eye: no aprende su dirección ni sus rutas de almacenamiento.
//
//  LO QUE SE ACEPTA COMO `p`
//
//  Solo una ruta de almacenamiento de Space Eye, con su firma. Nunca una URL
//  completa: si esta ruta aceptara `http://loquesea`, sería un proxy abierto
//  desde dentro del droplet —el clásico SSRF, con el que se leen las credenciales
//  del metadata del proveedor—. La dirección del servidor la pone SIEMPRE este
//  servidor, y de `p` solo se toma el camino.
//
//  La firma la comprueba Space Eye, no nosotros: las fotos caducan a las 6 h y
//  una ruta sin firma válida se contesta con lo que él conteste.
// ============================================================================

// `/storage/...` con su firma opcional. Sin `..`, sin `//`, sin esquema, sin
// host: lo que no case con esto no se pide a nadie.
const RUTA_VALIDA = /^\/storage\/[A-Za-z0-9/_.-]+\.(jpg|jpeg|png|webp)(\?[A-Za-z0-9=&_.-]*)?$/i

export async function GET(req: Request) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  const p = new URL(req.url).searchParams.get('p') ?? ''
  if (!RUTA_VALIDA.test(p) || p.includes('..')) {
    return NextResponse.json({ error: 'Ruta de foto inválida' }, { status: 400 })
  }

  try {
    const r = await fetch(urlAbsolutaDeFoto(p), { cache: 'no-store' })
    if (!r.ok) {
      // Se repite el código de Space Eye tal cual: un 403 por firma caducada
      // tiene que llegar como 403 y no disfrazado de error nuestro.
      return NextResponse.json({ error: 'No se pudo leer la foto' }, { status: r.status })
    }

    // Se transmite el cuerpo sin juntarlo entero en memoria: son fotos de 2 MB y
    // varias a la vez en una galería.
    return new NextResponse(r.body, {
      status: 200,
      headers: {
        'Content-Type': r.headers.get('content-type') ?? 'image/jpeg',
        // Privada: es la foto de la pantalla de un cliente detrás de sesión, y
        // no puede quedar en una caché compartida. Cinco minutos evitan la
        // ráfaga de abrir y cerrar la ficha sin servir nada rancio.
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo leer la foto' }, { status: 502 })
  }
}
