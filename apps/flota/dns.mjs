// ============================================================================
//  dns.mjs — el registro A en Cloudflare.  (ADR 0027)
// ----------------------------------------------------------------------------
//  Solo se toca el DNS de una zona que AS OOH controla. Si el dominio es del
//  owner, el alta se para y espera a que lo apunte él: esa es la parte
//  «soberana» del modelo, y no se automatiza porque no es nuestra.
//
//  ─── La lección que vive dentro de este archivo ───────────────────────────
//  El 2026-09-03 se perdieron dos horas esperando un registro que no existía, y
//  al crearlo apareció la trampa de verdad: **Cloudflare enciende el proxy por
//  omisión**. Con el proxy encendido el nombre resuelve a direcciones de
//  Cloudflare y no a la máquina del owner — el certificado se pediría sobre otra
//  cosa. Por eso `proxied: false` está aquí, en el código, y no en la cabeza de
//  quien rellena un formulario.
//
//  El token se usa SOLO el día del alta. No entra en la renovación de ningún
//  certificado, que es lo que hizo retirar el token de Cloudflare anterior
//  (ADR 0016/0017): allí, si caducaba, mataba un certificado vivo. Aquí, si
//  caduca, un alta falla una vez y en voz alta.
//
//  Sin dependencias: `fetch` y nada más.
// ============================================================================

const API = 'https://api.cloudflare.com/client/v4'

/** IPv4 y solo IPv4. Cuatro octetos de 0 a 255, sin nada más pegado. */
const RE_IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

/**
 * La zona nuestra a la que pertenece el dominio, o `null`.
 *
 * Se compara con **punto delante** (`.space-os.io`) o igualdad exacta. Comparar
 * por sufijo pelado haría que `space-os.io.malo.com` pareciera nuestro, y eso
 * sería regalarle a cualquiera un registro en nuestra cuenta.
 */
export function zonaDe(dominio, zonas = {}) {
  const d = String(dominio ?? '').toLowerCase()
  for (const [zona, id] of Object.entries(zonas)) {
    const z = zona.toLowerCase()
    if (d === z || d.endsWith(`.${z}`)) return id
  }
  return null
}

export function esDeNuestraZona(dominio, zonas = {}) {
  return zonaDe(dominio, zonas) !== null
}

/**
 * ¿Existe alguna zona DNS que pueda contener este nombre?  (defecto 39)
 *
 * ─── Qué evita, y cuánto cuesta no tenerlo ─────────────────────────────────
 *
 * El 2026-09-08 se dio de alta `g500-space-os.com`, un dominio **que no está
 * registrado**. El alta creó el droplet, lo configuró entero, y se quedó en
 * `esperando-dns` — correctamente, porque el ejecutor no puede inventarse una
 * delegación. Pero **para siempre**, y con una máquina cobrándose.
 *
 * `validarSolicitud()` comprueba la FORMA del dominio. La forma era impecable.
 *
 * ─── Por qué se pregunta por el SOA, y subiendo etiqueta a etiqueta ────────
 *
 * Preguntar por el nombre completo no sirve: `ensayo4.space-os.io` **también**
 * daba NXDOMAIN antes de que se le creara su registro A, igual que un dominio
 * inexistente. Los dos casos son indistinguibles mirando el FQDN, y uno es
 * legítimo.
 *
 * Lo que los separa es si existe una zona **por encima**. Así que se sube
 * etiqueta a etiqueta buscando un SOA:
 *
 *   `ensayo4.space-os.io`  → `ensayo4.space-os.io` (nada) → `space-os.io` ✓
 *   `g500-space-os.com`    → `g500-space-os.com` (nada) → se acabó ✗
 *
 * Se para **antes del TLD**: `com` tiene SOA y aceptarlo daría por bueno
 * cualquier nombre inventado bajo un TLD que existe, que es todo el problema.
 * Por eso el último candidato tiene dos etiquetas.
 *
 * Y esto **no** exige que el nombre ya resuelva. Un dominio registrado al que
 * el owner aún no ha puesto el registro A pasa: su zona existe. Es la diferencia
 * entre «todavía no lo ha apuntado» —que es normal y se espera— y «no puede
 * apuntarlo nunca».
 *
 * El resolutor entra por parámetro para poder probarlo sin salir a la red.
 */
export async function zonaQueLoContiene(dominio, resolverSoa) {
  const partes = String(dominio ?? '')
    .toLowerCase()
    .split('.')
    .filter(Boolean)
  if (partes.length < 2) return null

  for (let i = 0; i <= partes.length - 2; i++) {
    const candidato = partes.slice(i).join('.')
    try {
      if (await resolverSoa(candidato)) return candidato
    } catch {
      // Un NXDOMAIN o un NODATA en un nivel no dice nada del siguiente: se
      // sigue subiendo. Solo agotar los niveles significa «no hay zona».
    }
  }
  return null
}

/**
 * Crea el registro `A`. Lanza si no puede — y el alta lo trata como un fallo,
 * que es lo correcto: sin DNS no hay certificado.
 */
export async function crearRegistroA(dominio, ip, opciones = {}) {
  const { zonas = {}, token = '', pedir = globalThis.fetch, ttl = 1 } = opciones

  // Todo lo que puede decidirse sin red, se decide antes de tocar la red.
  const zona = zonaDe(dominio, zonas)
  if (!zona) {
    throw new Error(`el dominio ${dominio} no cuelga de ninguna zona nuestra: el DNS lo pone el owner`)
  }
  if (!token) {
    throw new Error('falta CLOUDFLARE_TOKEN en el entorno del ejecutor')
  }
  if (!RE_IPV4.test(String(ip))) {
    throw new Error(`la IP ${JSON.stringify(ip)} no es una IPv4`)
  }

  let respuesta
  try {
    respuesta = await pedir(`${API}/zones/${zona}/dns_records`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'A',
        name: dominio,
        content: ip,
        ttl,
        // NO SE TOCA. Ver la cabecera.
        proxied: false,
      }),
    })
  } catch (e) {
    // El mensaje de red puede traer la URL, pero nunca la cabecera. Aun así se
    // recorta: esto acaba en el registro que el panel enseña.
    throw new Error(`Cloudflare no contesto: ${e.message}`)
  }

  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok || !datos?.success) {
    const motivo = datos?.errors?.map((e) => e.message).join('; ') || `HTTP ${respuesta.status}`
    // Se construye el error con el motivo de Cloudflare y NADA del entorno: el
    // token no puede acabar en una pagina web.
    throw new Error(`Cloudflare rechazo el registro de ${dominio}: ${motivo}`)
  }

  return { id: datos.result?.id ?? null, dominio, ip }
}
