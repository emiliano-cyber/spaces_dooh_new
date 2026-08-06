import { exigir } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'
import { decodificarDataUrl } from '@/lib/data-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/creativos/:id/arte — El arte del creativo, servido como archivo.
// ----------------------------------------------------------------------------
//  POR QUÉ EXISTE: hasta ahora el arte viajaba INCRUSTADO en `/api/estado`, el
//  endpoint que hidrata todo el shell. Medido en producción: 2,977 kB en cuatro
//  creativos de G500, sobre una base de datos que entera pesa 21 MB. O sea que
//  cada carga de página se traía casi 3 MB de imágenes para pintar unos KPI que
//  no usan ninguna. Las consultas nunca fueron el problema —la más pesada tarda
//  0.077 ms—, el problema era el peso de la respuesta.
//
//  Ahora `archivoUrl` apunta AQUÍ y el navegador pide el arte solo en la
//  pantalla que lo enseña, en paralelo y con caché. Mismo patrón que el logo.
//
//  CON sesión, al revés que el logo: un logo es la marca que la empresa enseña,
//  pero el arte de una campaña es material del cliente y no tiene por qué poder
//  verlo cualquiera con el id. Va por `comercial.ver`, que es el permiso que ya
//  exige la pantalla de Creativos, y la RLS acota el tenant por debajo.
// ============================================================================

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return new Response(null, { status: g.status })

  const r = await q1<{ archivo_url: string | null; codigo: string | null }>(
    'select archivo_url, codigo from creatividades where id = $1',
    [params.id],
  )
  if (!r) return new Response(null, { status: 404 })

  // Dos formas de guardar lo mismo, por historia: `archivo_url` es un data URL
  // (imagen o HTML) y `codigo` es HTML en texto plano. Un creativo tiene uno de
  // los dos. Se intenta primero el data URL porque es el caso de las imágenes,
  // que es lo que pesa.
  const img = decodificarDataUrl(r.archivo_url)
  const cuerpo: BodyInit | null = img
    ? new Uint8Array(img.bytes)
    : (r.codigo ?? htmlDeDataUrl(r.archivo_url))
  if (!cuerpo) return new Response(null, { status: 404 })

  const tipo = img ? img.tipo : 'text/html; charset=utf-8'

  return new Response(cuerpo, {
    status: 200,
    headers: {
      'Content-Type': tipo,

      // El mismo blindaje que la ruta del logo, y aquí importa MÁS: un creativo
      // HTML es código que sube una persona, y servirlo desde nuestro origen
      // sin esto sería ejecutarlo con nuestras cookies delante al abrir la URL
      // directa. La pantalla ya lo mete en un <iframe sandbox>, pero eso protege
      // el iframe, no a quien pegue la URL en la barra de direcciones.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',

      // PRIVADA, no `public`: lleva material de un cliente y va detrás de
      // sesión. `public` autorizaría a un proxy compartido a guardarlo y
      // servírselo a otro. El arte de un creativo no cambia —para reemplazarlo
      // se sube otro y cambia el id—, así que una hora es holgado y seguro.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

// Un `data:text/html,...` sin base64 (se guardaron así algunos creativos de
// código). `decodificarDataUrl` los rechaza a propósito —solo sirve imágenes—
// así que el texto se saca aquí.
function htmlDeDataUrl(dataUrl: string | null): string | null {
  if (!dataUrl) return null
  const m = /^data:text\/html[^,]*,([\s\S]*)$/i.exec(dataUrl.trim())
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    // Un `%` suelto sin escapar hace estallar `decodeURIComponent`. El
    // contenido crudo sigue siendo mejor que un 500.
    return m[1]
  }
}
