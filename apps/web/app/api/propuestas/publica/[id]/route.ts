import { NextResponse } from 'next/server'
import { obtenerPropuestaPublica, aceptarPropuestaPublica, PropuestaError } from '@/lib/server/propuestas-repo'
import { planoVallasDeLiga } from '@/lib/server/vallas-publicas-controller'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/propuestas/publica/:id → datos de solo lectura de una propuesta para
// la liga compartible. SIN auth a propósito: cualquiera con la liga puede verla.
//
// `planoVallas` (dueño, 20/11) · solo si los sitios de la propuesta suman MÁS
// de una valla activa: con 0 o 1 el campo NO se añade y la respuesta es la de
// siempre. Va en esta misma respuesta, y no en una ruta aparte, para que la
// liga sin vallas no haga ni una petición de más. Se resuelve por el MISMO
// token y con el mismo mecanismo de tenant (`vallas-publicas-repo.ts`).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const data = await obtenerPropuestaPublica(params.id)
  if (!data) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  const planoVallas = await planoVallasDeLiga(params.id)
  return NextResponse.json(planoVallas ? { ...data, planoVallas } : data)
}

// POST /api/propuestas/publica/:id → el CLIENTE acepta la propuesta desde la
// liga pública (SIN auth; la liga es el secreto). Registra timestamp + nombre y
// mueve la propuesta a APROBADA. Idempotente.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const lim = limitar(`aceptar:${ipDe(req)}`, 20, 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
  let body: { nombre?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  try {
    const res = await aceptarPropuestaPublica(params.id, { nombre: body.nombre ?? '', ip: ipDe(req) })
    if (!res) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    return NextResponse.json(res)
  } catch (e) {
    // Regla de negocio (sin nombre, borrador, rechazada) → 409 con el mensaje.
    if (e instanceof PropuestaError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo aceptar la propuesta' }, { status: 500 })
  }
}
