import { NextResponse } from 'next/server'
import { z } from 'zod'
import { exigir } from '@/lib/server/auth'
import { q } from '@/lib/server/db'
import { tenantActual } from '@/lib/server/tenant'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { obtenerConfigRow, obtenerConfigAdmin } from '@/lib/server/config-repo'
import { respuestaError, validar } from '@/lib/server/errores'
import { exigirDesbloqueo, respuestaDesbloqueo } from '@/lib/server/cambios'
import { LIMITES, uploadZod } from '@/lib/server/uploads'
import { rfcTenant, textoTenant } from '@/lib/server/config-fiscal'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'
import { sanearCostosOt } from '@/lib/costos-ot'
import { TODOS_TIPOS_OT } from '@/lib/tipos-ot'

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
    // TOPE-01: descuento comercial máximo que esta organización autoriza en una
    // propuesta. NO es nullable —al revés que el cupo de clientes— porque aquí
    // el 100 YA significa «sin tope»: `descuentoValido` nunca deja pasar más de
    // 100, así que un `null` sería una segunda forma de decir lo mismo y una
    // segunda forma de que la lectura se equivoque.
    //
    // El 0 SÍ es capturable: significa «en esta organización no se descuenta»,
    // que es una política comercial legítima y por eso el mínimo es 0 y no 1.
    topeDescuentoPct: z.coerce
      .number()
      .min(0, 'El tope de descuento no puede ser negativo')
      .max(100, 'El tope de descuento no puede pasar de 100 %'),
    // Correo de la organización para los avisos de OPERACIÓN (Reply-To).
    // `null` = quitarlo, igual que el logo. La cadena vacía se normaliza a null
    // más abajo: un input que se vacía manda '', y guardar '' haría que el
    // correo saliera con un Reply-To vacío en vez de sin Reply-To.
    emailRemitente: z
      .string()
      .trim()
      .max(254, 'El correo no puede pasar de 254 caracteres')
      .refine((v) => v === '' || esEmailValido(v), { message: EMAIL_INVALIDO })
      .nullable(),
    // Costo de mano de obra por TIPO de orden de trabajo. Las claves son el
    // enum `tipo_ot` (db/schema.sql:53) declarado como ENUM CERRADO, no texto
    // libre: un mapa con claves abiertas acabaría con importes colgados de
    // tipos que no existen, y el lector no podría distinguirlos de un tipo
    // retirado del catálogo.
    //
    // Un importe `null` es QUITAR ese tipo (vuelve al respaldo), igual que el
    // logo o el correo. El 0 NO es quitarlo: es un costo capturado de verdad
    // —una inspección que hace el propio dueño—, y `sanearCostosOt` lo
    // conserva. Distinguir los dos es el punto.
    costosOt: z
      .record(
        z.enum(TODOS_TIPOS_OT as [string, ...string[]]),
        z.coerce
          .number()
          .min(0, 'El costo de una orden de trabajo no puede ser negativo')
          .max(99_999_999, 'El costo de una orden de trabajo es demasiado grande')
          .nullable(),
      ),
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

  // ─── TOPE-01 · subir el techo de descuento PIDE LA CONTRASEÑA ─────────────
  //
  // El tope es el CONTROL, no el dato. Sin esto, quien puede administrar la
  // organización desactiva el límite con un clic y a continuación regala la
  // venta: el candado sobre el descuento no serviría de nada, porque bastaría
  // con quitarlo primero. Es el mismo criterio del ADR 0009, que ya exige
  // contraseña para tocar la renta de una pantalla o registrar un pago — y
  // proteger la renta mientras se deja abierto el techo de descuento era
  // justamente la asimetría que motivó esta tarea.
  //
  // Va DESPUÉS de `validar()` y AQUÍ DENTRO, no en la puerta de la ruta, y eso
  // es deliberado: el candado alcanza solo a este campo. Ponerlo a toda la
  // pantalla de Administración pediría la contraseña para cambiar el tamaño del
  // loop o añadir una tasa de IVA — veinte campos que nadie pidió proteger— y
  // convertiría esta tarea en otra mucho mayor.
  //
  // `exigeReautenticacion` es del TENANT y nace en `true`
  // (`20260828_reautenticacion_por_defecto.sql`), así que en una organización
  // que lo haya apagado esto no añade fricción ninguna.
  if (b.topeDescuentoPct !== undefined) {
    const d = await exigirDesbloqueo()
    if (!d.ok) return respuestaDesbloqueo(d)
  }

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
    topeDescuentoPct: 'tope_descuento_pct',
    emailRemitente: 'email_remitente',
    costosOt: 'costos_ot',
  }
  // Vaciar el campo es QUITAR el correo, no guardar una cadena vacía: un
  // Reply-To vacío es una cabecera rota, y el CHECK de la columna la rechaza
  // (acepta null o una dirección con forma, nada intermedio).
  if (b.emailRemitente === '') b.emailRemitente = null
  // El mapa de costos entra a una columna jsonb, así que viaja como texto JSON
  // y SANEADO: `sanearCostosOt` descarta las claves que no son del enum y los
  // importes no utilizables (null = «quitar este tipo»). Se sanea también aquí
  // y no solo al leer porque dejar basura entrar a la columna es arrastrarla en
  // cada respaldo y que el siguiente que lea el jsonb crudo se la crea.
  if (b.costosOt !== undefined) b.costosOt = JSON.stringify(sanearCostosOt(b.costosOt))
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
