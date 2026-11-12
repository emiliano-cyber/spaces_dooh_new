// ============================================================================
//  lib/avisos.ts — QUÉ AVISOS QUIERE CADA QUIEN, Y POR DÓNDE (AVISOS-CANAL).
// ----------------------------------------------------------------------------
//  Pedido del dueño (12/11): «hacer los avisos por correo y dejar sembrada la
//  opción de envío por WhatsApp; lo de olvidé contraseña, solo correo».
//
//  Puro, sin servidor: lo usan la pantalla (Mi cuenta → Avisos) y el
//  controlador, que así validan con la MISMA regla.
//
//  Lo que este archivo NO cubre, y es a propósito: recuperar la contraseña y
//  las invitaciones. Esos correos llevan un enlace para ENTRAR a la cuenta y
//  van siempre a la dirección de la cuenta, por correo, sin pasar por aquí. Un
//  canal elegido para enterarse de una factura no es un canal seguro para
//  mandar la llave de la cuenta.
// ============================================================================

/**
 * Los `notificaciones.tipo` que escribe `notificar()`
 * (`lib/server/notificaciones-repo.ts`) y que alguien puede querer por correo.
 * El orden es el de la pantalla: de la venta al cobro, y la operación al final.
 * Los avisos de contratos NO están: su correo diario ya va a los Dueños desde
 * `/api/recordatorios`, y meterlos aquí duplicaría el correo.
 */
export const TIPOS_AVISO = ['PROPUESTA', 'CAMPANA', 'ODC', 'FACTURA', 'PAGO', 'COBRANZA', 'OT'] as const
export type TipoAviso = (typeof TIPOS_AVISO)[number]

/** El orden es el de las columnas de la pantalla. Lo vigila el check de la migración. */
export const CANALES_AVISO = ['correo', 'whatsapp'] as const
export type CanalAviso = (typeof CANALES_AVISO)[number]

export interface PreferenciaAviso {
  tipo: TipoAviso
  canal: CanalAviso
}

// Los mensajes del servidor, una sola vez: los usa el controlador y los ata
// `errores-servidor.ts` a sus traducciones.
export const MSG_AVISO = {
  tipo: 'Ese tipo de aviso no existe.',
  canal: 'Ese canal de aviso no existe.',
  whatsapp: 'Los avisos por WhatsApp todavía no están disponibles en este servidor.',
  telefono: 'El teléfono de WhatsApp debe llevar el código de país, por ejemplo +52 55 1234 5678.',
  cuerpo: 'Las preferencias de avisos no son válidas.',
} as const

const esTipo = (v: unknown): v is TipoAviso => typeof v === 'string' && (TIPOS_AVISO as readonly string[]).includes(v)
const esCanal = (v: unknown): v is CanalAviso => typeof v === 'string' && (CANALES_AVISO as readonly string[]).includes(v)

/**
 * El teléfono en E.164 (`+` y de 8 a 15 cifras, sin cero inicial en el código
 * de país), que es lo único que acepta la API de WhatsApp de Meta. Se quitan
 * espacios, guiones, puntos y paréntesis porque así lo escribe la gente.
 *
 * `null` = vacío («no lo dio»); `false` = mal escrito. Sin `+` NO se adivina
 * el país: «55 1234 5678» es de México o de otro sitio según quién lo lea, y
 * un aviso al número equivocado le llega a un desconocido. Mismo patrón que el
 * check `usuarios_telefono_whatsapp_e164`.
 */
export function normalizarTelefono(v: unknown): string | null | false {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return false
  const limpio = v.replace(/[\s\-.()]/g, '')
  if (limpio === '') return null
  return /^\+[1-9][0-9]{7,14}$/.test(limpio) ? limpio : false
}

export type ResultadoPreferencias =
  | { ok: true; activos: PreferenciaAviso[]; telefono: string | null }
  | { ok: false; error: string }

/**
 * El cuerpo de `PUT /api/perfil/avisos`: `{ activos: [{tipo, canal}], telefono }`.
 *
 * `disponibles` son los canales que este servidor puede usar HOY. WhatsApp está
 * sembrado: el teléfono se guarda, pero una preferencia por WhatsApp se
 * rechaza hasta que el canal exista, para que nadie crea que la tiene puesta.
 */
export function validarPreferencias(body: unknown, disponibles: readonly CanalAviso[]): ResultadoPreferencias {
  const b = body as { activos?: unknown; telefono?: unknown } | null
  if (!b || typeof b !== 'object' || !Array.isArray(b.activos)) return { ok: false, error: MSG_AVISO.cuerpo }
  // Tope: hay 7 tipos × 2 canales. Una lista más larga solo puede venir de
  // alguien probando cuánto aguanta la ruta.
  if (b.activos.length > TIPOS_AVISO.length * CANALES_AVISO.length * 2) return { ok: false, error: MSG_AVISO.cuerpo }

  const vistos = new Set<string>()
  const activos: PreferenciaAviso[] = []
  for (const a of b.activos as unknown[]) {
    if (!a || typeof a !== 'object') return { ok: false, error: MSG_AVISO.cuerpo }
    const { tipo, canal } = a as { tipo?: unknown; canal?: unknown }
    if (!esTipo(tipo)) return { ok: false, error: MSG_AVISO.tipo }
    if (!esCanal(canal)) return { ok: false, error: MSG_AVISO.canal }
    if (!disponibles.includes(canal)) return { ok: false, error: canal === 'whatsapp' ? MSG_AVISO.whatsapp : MSG_AVISO.canal }
    const k = `${tipo}:${canal}`
    if (vistos.has(k)) continue
    vistos.add(k)
    activos.push({ tipo, canal })
  }

  const telefono = normalizarTelefono(b.telefono)
  if (telefono === false) return { ok: false, error: MSG_AVISO.telefono }
  return { ok: true, activos, telefono }
}
