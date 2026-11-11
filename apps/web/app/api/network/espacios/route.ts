import { NextResponse } from 'next/server'
import { esLaAppNetwork } from '@/lib/server/network-token'
import { listarEspaciosNetwork } from '@/lib/server/network-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/network/espacios?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   (11/11)
// ----------------------------------------------------------------------------
//  Lo que la nueva app de Network consulta para sincronizar los espacios
//  disponibles. Decidido por el dueño: la app CONSULTA (la instancia no empuja
//  nada), y recibe ficha pública + días libres de cada pantalla con el switch
//  «En la Network» encendido. Apagar el switch la saca de aquí en la siguiente
//  consulta, sin más pasos.
//
//  Credencial: cabecera `x-network-token` igual a `NETWORK_TOKEN` del entorno.
//  Sin token, o con uno equivocado, 401 sin cuerpo útil. Sin `NETWORK_TOKEN`
//  configurado la ruta está cerrada para todos.
//
//  Rango: por omisión de hoy a +90 días; como mucho 366 días, para que una
//  petición no pueda pedir diez años de calendario por pantalla.
// ============================================================================

const SIN_CACHE = { 'cache-control': 'no-store' }
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 366

function sumarDias(f: string, n: number): string {
  return new Date(Date.parse(`${f}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}
function valida(f: string): boolean {
  return FECHA.test(f) && !Number.isNaN(Date.parse(`${f}T00:00:00Z`)) && new Date(`${f}T00:00:00Z`).toISOString().startsWith(f)
}

export async function GET(req: Request) {
  if (!esLaAppNetwork(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: SIN_CACHE })
  }

  const url = new URL(req.url)
  const hoy = new Date().toISOString().slice(0, 10)
  const desde = url.searchParams.get('desde') ?? hoy
  // `desde` se valida ANTES de calcular el `hasta` por omisión: con una fecha
  // imposible (`2027-13-01`) `sumarDias` hace `toISOString()` de NaN y lanza,
  // y eso salía como 500 en vez de 400. Lo cazó la e2e.
  if (!valida(desde)) {
    return NextResponse.json({ error: 'desde y hasta van como YYYY-MM-DD' }, { status: 400, headers: SIN_CACHE })
  }
  const hasta = url.searchParams.get('hasta') ?? sumarDias(desde, 90)
  if (!valida(hasta)) {
    return NextResponse.json({ error: 'desde y hasta van como YYYY-MM-DD' }, { status: 400, headers: SIN_CACHE })
  }
  if (hasta < desde) {
    return NextResponse.json({ error: 'hasta no puede ser anterior a desde' }, { status: 400, headers: SIN_CACHE })
  }
  if (hasta > sumarDias(desde, MAX_DIAS - 1)) {
    return NextResponse.json({ error: `el rango no puede pasar de ${MAX_DIAS} días` }, { status: 400, headers: SIN_CACHE })
  }

  try {
    const espacios = await listarEspaciosNetwork(desde, hasta)
    return NextResponse.json(
      { generadoEn: new Date().toISOString(), desde, hasta, espacios },
      { headers: SIN_CACHE },
    )
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el inventario' }, { status: 503, headers: SIN_CACHE })
  }
}
