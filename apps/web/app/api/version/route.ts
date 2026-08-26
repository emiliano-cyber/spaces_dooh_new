import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { qRaw1 } from '@/lib/server/db'

export const runtime = 'nodejs'
// EN TIEMPO DE PETICIÓN, no de build. Una versión horneada mentiría en cuanto
// la instancia se actualizara.
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/version — qué versión corre esta instancia, y nada más.  (F6.1)
// ----------------------------------------------------------------------------
//  Dos respuestas distintas según quién pregunte:
//
//   • Sin token  → `{ ok }`. Es la comprobación de salud del actualizador y de
//                  cualquiera que quiera saber si la instancia está en pie.
//   • Con token  → `{ ok, version, ultimaMigracion, base, canal, uptime }`,
//                  que es lo que el panel de flota necesita.
//
//  ─── Por qué la versión va tras token ─────────────────────────────────────
//  Publicar la versión exacta le ahorra el trabajo a quien busca una
//  vulnerabilidad conocida de esa versión: le dice si merece la pena intentarlo
//  antes de intentarlo. El plan deja abierto hacerla pública (P6); mientras no
//  se decida, va cerrada. Cambiarlo es una línea.
//
//  ─── LO QUE ESTA RUTA NO DICE, Y ES LO IMPORTANTE ─────────────────────────
//  Ni cuántas organizaciones hay, ni cómo se llaman, ni cuántos usuarios, ni
//  una sola cifra del negocio del owner. El panel de flota es de AS OOH y la
//  instancia es del owner: la promesa comercial es que un owner no es una fila
//  en la base de otro, y una ruta de telemetría es justo por donde esa promesa
//  se erosiona sin que nadie lo note.
//
//  La prueba afirma las CLAVES EXACTAS del cuerpo, no la ausencia de unas
//  cuantas: una clave nueva rompe la prueba en vez de colarse.
//
//  ─── Por qué `ok` toca la base ────────────────────────────────────────────
//  Esta ruta es el `SALUD_URL` de `update.sh`. La anterior era
//  `/api/auth/metodos/`, que solo lee variables de entorno y contesta 200
//  aunque Postgres esté muerto.
//
//  El PADRE estuvo CUATRO DÍAS sirviendo un login perfecto sin poder
//  autenticar a nadie —le faltaba `DATABASE_URL`— y las cinco comprobaciones
//  que se hacían salían verdes. Un actualizador con esa salud aprobaría un
//  despliegue roto y seguiría adelante.
//
//  Así que `ok:true` significa «la base me contesta». Si no, 503. Eso no
//  filtra nada: arriba o abajo se ve igual desde fuera.
// ============================================================================

interface FilaMigracion {
  archivo: string
}

/** Igual que en `/api/bootstrap`: SHA-256 para que los buffers midan siempre lo mismo. */
function tokenCoincide(recibido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recibido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

function esElPanel(req: Request): boolean {
  const esperado = process.env.FLOTA_TOKEN
  // Sin token configurado, NADIE es el panel. Ausente = cerrado, igual que el
  // autoregistro y que el arranque: un `.env` que se quedó corto no abre nada.
  if (!esperado) return false
  const recibido = req.headers.get('x-flota-token')
  if (!recibido) return false
  return tokenCoincide(recibido, esperado)
}

const SIN_CACHE = { 'cache-control': 'no-store' }

export async function GET(req: Request) {
  // `schema_migrations` es infraestructura y está exenta de RLS, igual que
  // `folios_consecutivos`. `qRaw` es lo correcto aquí y no el fallo R2: no hay
  // sesión ni tenant en juego, y la tabla no tiene columna `tenant_id`.
  let ultimaMigracion: string | null = null
  let baseViva = false
  try {
    const fila = await qRaw1<FilaMigracion>(
      'select archivo from schema_migrations order by aplicada_en desc, archivo desc limit 1',
    )
    ultimaMigracion = fila?.archivo ?? null
    baseViva = true
  } catch {
    baseViva = false
  }

  if (!baseViva) {
    // 503 y no 200: el actualizador tiene que poder distinguir «viva» de
    // «arrancó pero no sirve». El cuerpo sigue sin contar nada.
    return NextResponse.json({ ok: false }, { status: 503, headers: SIN_CACHE })
  }

  if (!esElPanel(req)) {
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE })
  }

  return NextResponse.json(
    {
      ok: true,
      version: process.env.SPACE_OS_VERSION ?? 'desconocida',
      ultimaMigracion,
      base: 'ok',
      // `CANAL` se lee del entorno del proceso y NO del archivo
      // `/etc/space-os/instancia.env`, que es lo que decía la tarea.
      //
      // Es una desviación deliberada: ese archivo lleva la conexión
      // privilegiada de Postgres y las llaves de Spaces. Abrirlo desde la
      // aplicación —que corre con otro usuario y no lo necesita para nada—
      // para sacar un campo que no es secreto es un mal cambio. El
      // aprovisionamiento escribe `CANAL` también en `app.env`.
      canal: process.env.CANAL ?? 'desconocido',
      uptime: Math.round(process.uptime()),
    },
    { headers: SIN_CACHE },
  )
}
