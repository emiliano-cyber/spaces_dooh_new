import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { registrarCuentaCtrl } from '@/lib/server/cuentas-controller'
import { hayAlgunTenant } from '@/lib/server/tenant'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  POST /api/bootstrap — la PRIMERA organización de una instancia recién
//  aprovisionada. De un solo uso.
//
//  Una instancia nueva nace con la base vacía: nadie dentro, y por tanto nadie
//  que pueda entrar a crear a nadie. Sin esta puerta, aprovisionar un owner
//  obliga a abrir `psql` en su droplet a mano.
//
//  ─── Por qué es peligrosa, y qué la sujeta ────────────────────────────────
//  Esta ruta viaja DENTRO DEL ARTEFACTO DE TODA LA FLOTA: está en la imagen de
//  cada instancia de cada owner, para siempre, no solo el día del alta. Crea una
//  organización y un usuario DUEÑO. Por eso lleva tres cerrojos independientes,
//  y hacen falta LOS TRES a la vez:
//
//    1. `BOOTSTRAP_TOKEN` presente en el entorno — ausente = la ruta no existe.
//    2. El token de la petición coincide.
//    3. `tenants` está vacía.
//
//  El (3) es el que la hace irrepetible: en cuanto nace la primera
//  organización, ningún token vuelve a abrirla. El operador puede además
//  retirar la variable del `.env` tras el alta, pero NO tiene que acordarse:
//  la puerta ya se cerró sola.
//
//  ─── Por qué TODO responde 404 y nunca 401 ────────────────────────────────
//  Un 401 confirmaría que la ruta existe, y con ella que las instancias de
//  SPACE OS se aprovisionan por aquí — información que orienta a quien busca.
//  En una instancia ya montada, esto tiene que ser indistinguible de una URL
//  que no existe. Se paga un precio: un script de aprovisionamiento con el
//  token mal escrito recibe el mismo 404 que uno que llega tarde, y no puede
//  distinguirlos. Es deliberado; el diagnóstico se hace mirando los registros
//  del servidor, no la respuesta.
// ============================================================================

/** Respuesta única para los cuatro motivos de rechazo. Sin cuerpo: no dice nada. */
function noExiste() {
  return new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store' } })
}

// Comparación en tiempo constante. Se comparan los SHA-256 y no las cadenas
// directas porque `timingSafeEqual` revienta si los buffers miden distinto —y
// esa excepción, o el `length` que hubiera que comprobar antes, filtraría por
// tiempo la longitud del token. El hash siempre mide 32 bytes.
function tokenCoincide(recibido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recibido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  // El limitador va ANTES del token y responde 404, no 429: un 429 sería la
  // confirmación de existencia que todo lo demás evita. Es lo que acota el
  // ataque por fuerza bruta sobre el token.
  if (!limitar(`bootstrap:${ipDe(req)}`, 10, 60 * 60_000).ok) return noExiste()

  // (1) Ausente = APAGADA, igual que el autoregistro. Una instancia que ya se
  // arrancó y limpió su `.env` no tiene esta ruta, y una a la que nunca se le
  // puso el token tampoco: no se abre por descuido.
  const esperado = process.env.BOOTSTRAP_TOKEN
  if (!esperado) return noExiste()

  // (2) El token de la petición.
  const recibido = req.headers.get('x-bootstrap-token')
  if (!recibido || !tokenCoincide(recibido, esperado)) return noExiste()

  // (3) Y la base tiene que estar vacía. Este es el cerrojo de un solo uso.
  if (await hayAlgunTenant()) return noExiste()

  try {
    // Misma alta que `/api/signup`, distinta puerta: se reutiliza el
    // controlador a propósito, para que las tres entradas al alta (signup,
    // /api/tenants y esta) no diverjan. La transacción de F5.1 aplica igual:
    // si el Dueño falla, no queda organización huérfana.
    // `debeCambiarPassword: true` — la contrasena del Dueno de una instancia la
    // GENERA el operador del alta y se imprime UNA vez en su consola. Sin esto
    // vale para siempre y se queda en su historial. Medido asi (con `f`) el
    // 2026-09-04 en el ensayo de F5.6, contra una instancia de verdad.
    const res = await registrarCuentaCtrl(await req.json().catch(() => ({})), {
      debeCambiarPassword: true,
    })
    return NextResponse.json(res, { status: 201, headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    // Aquí SÍ se devuelve el error real (400 de validación, 409 de correo
    // repetido). A este punto solo llega quien ya presentó el token correcto
    // sobre una base vacía: ya no hay nada que ocultarle, y un 404 mudo dejaría
    // al operador sin saber por qué falló su alta.
    return respuestaError(e)
  }
}
