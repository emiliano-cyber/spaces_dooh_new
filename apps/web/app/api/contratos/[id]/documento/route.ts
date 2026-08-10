import { exigir, tienePermiso } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'
import { decodificarDataUrl, TIPOS_DOCUMENTO } from '@/lib/data-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/contratos/:id/documento — El PDF del contrato, servido como archivo.
// ----------------------------------------------------------------------------
//  POR QUÉ EXISTE: `listarContratos()` hacía `select c.*` y el mapper exponía
//  `documentoUrl` tal cual, así que el documento —un PDF escaneado en data URL—
//  viajaba entero dentro de `/api/estado`, la petición que hidrata todo el
//  shell. Medido en producción: la rebanada `contratos` pesaba 3.95 MB con 13
//  filas, ~300 kB cada una. Se descargaba en cada F5 para pintar una tabla que
//  solo necesita saber si hay documento o no.
//
//  Mismo patrón que `/api/creativos/:id/arte` y `/api/logo/:token`.
//
//  EL PERMISO NO ES `arrendadores` A SECAS, y es deliberado: en `/api/estado` la
//  rebanada va con `siAlguno(['arrendadores','finanzas'])` porque un contrato es
//  a la vez patrimonio (Arrendadores) y un compromiso de dinero (Finanzas).
//  Exigir solo `arrendadores` aquí le enseñaría a Finanzas un enlace que le
//  responde 403 — el fallo clásico de este repo: el servidor niega algo que la
//  pantalla sí ofrece.
// ============================================================================

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir()
  if (!g.ok) return new Response(null, { status: g.status })
  const puede =
    (await tienePermiso(g.usuario.rol, 'arrendadores', 'ver')) ||
    (await tienePermiso(g.usuario.rol, 'finanzas', 'ver'))
  if (!puede) return new Response(null, { status: 403 })

  // `q1` (no `qRaw`): `contratos_arrendamiento` lleva `tenant_id` y la RLS acota
  // el tenant por debajo. Sin el GUC esto devolvería cero filas en silencio.
  const r = await q1<{ documento_url: string | null }>(
    'select documento_url from contratos_arrendamiento where id = $1',
    [params.id],
  )
  if (!r?.documento_url) return new Response(null, { status: 404 })

  // La columna admite las DOS formas (`uploadOUrlZod`): un data URL subido desde
  // el formulario, o una URL http de un documento ya hospedado fuera. La segunda
  // no se puede servir desde aquí sin convertir esta ruta en un proxy de
  // salida —que es una superficie que nadie pidió—, así que se redirige.
  if (/^https?:\/\//i.test(r.documento_url)) {
    return Response.redirect(r.documento_url, 307)
  }

  const doc = decodificarDataUrl(r.documento_url, TIPOS_DOCUMENTO)
  if (!doc) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(doc.bytes), {
    status: 200,
    headers: {
      'Content-Type': doc.tipo,
      // El mismo blindaje que el arte: es un archivo que sube una persona y se
      // sirve desde nuestro origen. `sandbox` evita que un PDF con JavaScript
      // corra con nuestras cookies delante si alguien abre la URL directa.
      'Content-Security-Policy': "default-src 'none'; img-src data:; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      // PRIVADA: es documentación contractual detrás de sesión. `public`
      // autorizaría a un proxy compartido a guardarla y servírsela a otro.
      // Para reemplazar el documento se sube otro sobre el mismo contrato, así
      // que se deja corto: cinco minutos bastan para abrirlo e imprimirlo.
      'Cache-Control': 'private, max-age=300',
    },
  })
}
