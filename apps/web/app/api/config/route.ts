import { NextResponse } from 'next/server'
import { z } from 'zod'
import { exigir } from '@/lib/server/auth'
import { q } from '@/lib/server/db'
import { tenantActual } from '@/lib/server/tenant'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { obtenerConfigRow, obtenerConfigAdmin } from '@/lib/server/config-repo'
import { respuestaError, validar } from '@/lib/server/errores'
import { LIMITES, uploadZod } from '@/lib/server/uploads'
import { rfcTenant, textoTenant } from '@/lib/server/config-fiscal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// El logo entraba como escritura cruda: cualquier cadena iba directa a
// `config_negocio.logo_url`, sin tipo ni tamaño (Bloque D). Ahora pasa por el
// helper compartido; un SVG con `<script>` se rechaza en vez de servirse desde
// nuestro dominio. `null` sigue permitido: es "quitar el logo".
const logo = uploadZod(LIMITES.logoEmpresa.allowlist, LIMITES.logoEmpresa.maxMB)

// Schema del PATCH: campos opcionales (es un parche), pero cada uno tipado.
// `.strict()` evita que un campo con typo se ignore en silencio.
const configSchema = z
  .object({
    nombreTenant: z.string().trim().min(1).max(120),
    moneda: z.string().trim().min(1).max(10),
    plazosCobranza: z.array(z.coerce.number().int().min(0).max(365)),
    // `tiposTarea` se retiró (M15): la columna `config_negocio.tipos_tarea`
    // sigue en la base pero NADIE la lee — los tipos de OT salen del enum de
    // @/lib/tipos-ot, con sus reglas por tipo de pantalla. Aceptar escrituras
    // aquí era ofrecer un ajuste que no ajustaba nada. Con `.strict()`, un
    // cliente viejo que lo mande recibe 400 en vez de creer que guardó.
    logoUrl: logo.nullable(),
    ivaTasas: z.array(z.coerce.number().min(0).max(100)),
    loopSeg: z.coerce.number().int().min(1).max(3600),
    spotSeg: z.coerce.number().int().min(1).max(3600),
    // ADR 0008: cupo de clientes por defecto. `null` = sin límite, que es como
    // nace la instalación; la regla se enciende capturando un número.
    maxClientesPantalla: z.coerce
      .number()
      .int('El cupo de clientes debe ser un número entero')
      .min(1, 'El cupo de clientes debe ser al menos 1')
      .max(999, 'El cupo de clientes no puede pasar de 999')
      .nullable(),
    razonSocial: z.string().trim().max(200).nullable(),
    nombreComercial: z.string().trim().max(200).nullable(),
    // Datos fiscales de la parte ARRENDATARIA (los recita el contrato).
    rfc: rfcTenant,
    domicilioFiscal: textoTenant(300),
    representanteLegal: textoTenant(200),
    datosConstitucion: textoTenant(600),
  })
  .partial()
  .strict()

// GET /api/config → configuración del negocio (global) + razón social / nombre
// comercial del tenant actual.
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await obtenerConfigAdmin())
}

// PATCH /api/config → ajustes de negocio del tenant (config_negocio) e
// identidad y datos fiscales del tenant (tabla tenants).
//
// Hasta el ADR 0011 la primera parte escribía sobre una fila GLOBAL: el Dueño
// de cualquier organización que cambiara su IVA, su moneda o su logo se los
// cambiaba a TODAS las demás. Ahora `obtenerConfigRow()` devuelve la fila de
// este tenant y el `update` va contra su id, con RLS detrás.
export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
  const b = validar(configSchema, await req.json().catch(() => ({}))) as Record<string, unknown>

  // Ajustes de negocio → la fila de config_negocio de ESTE tenant.
  //
  // `nombreTenant` ya no está aquí: el nombre de la organización es
  // `tenants.nombre` y se escribe abajo, con el resto de su identidad. Tenerlo
  // en las dos tablas es lo que hacía que el sidebar y Configuración dijeran
  // cosas distintas (M5).
  const map: Record<string, string> = {
    moneda: 'moneda',
    plazosCobranza: 'plazos_cobranza',
    logoUrl: 'logo_url', ivaTasas: 'iva_tasas', loopSeg: 'loop_seg', spotSeg: 'spot_seg',
    maxClientesPantalla: 'max_clientes_pantalla',
  }
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) {
      vals.push(b[k])
      sets.push(`${col} = $${vals.length}`)
    }
  }
  if (sets.length) {
    const row = await obtenerConfigRow()
    vals.push(row.id)
    await q(`update config_negocio set ${sets.join(', ')} where id = $${vals.length}`, vals)
  }

  // Identidad y datos fiscales → tabla tenants (organización actual).
  // `nombreTenant` entra aquí desde el ADR 0011: es el nombre de la
  // organización y su única fuente.
  const tenantMap: Record<string, string> = {
    nombreTenant: 'nombre',
    razonSocial: 'razon_social', nombreComercial: 'nombre_comercial',
    rfc: 'rfc', domicilioFiscal: 'domicilio_fiscal',
    representanteLegal: 'representante_legal', datosConstitucion: 'datos_constitucion',
  }
  const tSets: string[] = []
  const tVals: unknown[] = []
  for (const [k, col] of Object.entries(tenantMap)) {
    if (b[k] !== undefined) {
      tVals.push(b[k])
      tSets.push(`${col} = $${tVals.length}`)
    }
  }
  if (tSets.length) {
    tVals.push(await tenantActual())
    await q(`update tenants set ${tSets.join(', ')} where id = $${tVals.length}`, tVals)
  }

  if (sets.length || tSets.length) {
    await registrarAccion(g.usuario, 'Actualizó configuración', 'Negocio')
  }
  return NextResponse.json(await obtenerConfigAdmin())
  } catch (e) {
    return respuestaError(e)
  }
}
