import { qRaw1, qConTenant } from '@/lib/server/db'
import { decodificarDataUrl } from '@/lib/data-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/logo/:token — El logo de una organización, como imagen.
// ----------------------------------------------------------------------------
//  SIN auth a propósito, igual que la liga pública de propuestas: quien recibe
//  un correo o abre el portal del cliente no tiene sesión, y un logo corporativo
//  no es un secreto — es lo que la empresa pone en su membrete.
//
//  POR QUÉ EXISTE: el logo se guarda como `data:` URL en `config_negocio`. Para
//  el menú lateral eso vale, pero Gmail y la mayoría de clientes de correo
//  DESCARTAN las imágenes embebidas en base64. Sin una URL http de verdad, el
//  logo en el correo se ve como un hueco.
//
//  POR TOKEN Y NO POR `tenant_id`: `/api/logo/<uuid>` sería enumerable y el
//  200/404 convertiría la ruta en un oráculo de qué tenants existen. El repo ya
//  evita eso en la liga pública de propuestas (S1-3) y aquí se sigue el mismo
//  criterio.
// ============================================================================

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = (params.token ?? '').trim()
  if (!token) return new Response(null, { status: 404 })

  // Ruta PÚBLICA: sin sesión no hay tenant que fijar, y `config_negocio` es
  // fail-closed + FORCE desde el ADR 0011 — una lectura sin `app.tenant_id`
  // devuelve CERO filas, no un error. La función es SECURITY DEFINER y devuelve
  // solo el tenant; los datos se leen debajo ya bajo la RLS.
  const t = await qRaw1<{ tenant: string | null }>(
    'select config_tenant_por_logo_token($1) as tenant',
    [token],
  )
  const tenantId = t?.tenant
  if (!tenantId) return new Response(null, { status: 404 })

  const filas = await qConTenant<{ logo_url: string | null }>(
    tenantId,
    'select logo_url from config_negocio where logo_token = $1 limit 1',
    [token],
  )
  const img = decodificarDataUrl(filas[0]?.logo_url)
  // Sin logo cargado, logo ilegible o tipo no servible: 404. La organización
  // existe, pero no hay imagen que devolver — y el membrete del correo ya
  // contempla que no haya (no pinta el `<img>`).
  if (!img) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(img.bytes), {
    status: 200,
    headers: {
      'Content-Type': img.tipo,
      'Content-Length': String(img.bytes.length),

      // ── Blindaje del SVG ──────────────────────────────────────────────────
      // El formulario admite SVG, y un SVG es un documento: puede llevar
      // <script>. Servido desde NUESTRO origen, abrir esta URL directamente
      // ejecutaría ese script con nuestras cookies delante — XSS almacenado por
      // la puerta de un logo.
      //
      // `validarUpload` YA rechaza al subir los SVG con script, `onload=` o
      // `javascript:`. Esto no lo duplica: aquella es una lista de patrones
      // peligrosos, y las listas de patrones se esquivan (entidades XML,
      // codificaciones raras, un vector que todavía no está en la lista).
      // Además la columna es un `text` sin restricción, así que un logo escrito
      // por otra vía —una corrección a mano en la base— nunca pasó por ese
      // filtro. La defensa que no depende de adivinar el vector es la del
      // navegador. Las tres cabeceras juntas lo cierran:
      //   · CSP `default-src 'none'` + `sandbox`: aunque el SVG traiga script,
      //     no corre ni puede pedir nada.
      //   · `nosniff`: el navegador no reinterpreta el tipo por su cuenta.
      //   · `Content-Disposition: inline` con nombre fijo: no hereda un nombre
      //     de archivo controlado por quien subió la imagen.
      // Se aplican a todos los tipos, no solo a SVG: una cabecera condicional
      // es una rama más donde equivocarse, y a un PNG no le estorban.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="logo"',

      // Una hora. El token es estable, así que la URL no cambia aunque cambie
      // la imagen: un logo recién cambiado puede tardar ese rato en verse en
      // los correos ya enviados, que es exactamente lo que uno quiere (el
      // correo debe seguir viéndose como cuando se mandó). Para la app no
      // aplica: el menú lateral pinta el data URL del store, no esta ruta.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
