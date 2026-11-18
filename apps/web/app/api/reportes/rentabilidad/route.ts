import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { rentabilidadCtrl } from '@/lib/server/reportes-controller'
import { respuestaError } from '@/lib/server/errores'
import { monedaDeLaInstancia } from '@/lib/server/moneda-instancia'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/reportes/rentabilidad?dimension=&granularidad=&desde=&hasta=
//   → el reporte de rentabilidad del tenant, YA AGREGADO.
//
// ─── Este endpoint es un LÍMITE, y eso es lo que aporta ─────────────────────
// Hoy la analítica de SPACE OS se calcula en el NAVEGADOR: `/api/estado`
// devuelve 24 rebanadas de tablas completas (`app/api/estado/route.ts:98-130`)
// y el front deriva los márgenes con `useStoreMemo` (`lib/data/client.ts:329`).
// Ese endpoint ya llegó a 6.12 MB con una pantalla en blanco de 6–12 segundos
// —lo cuenta su propio código, `app/api/estado/route.ts:146-156`— y los
// reportes de rentabilidad verán historia de AÑOS.
//
// Las pantallas de reportes hablan con esta ruta desde el día uno. Detrás, esta
// primera versión reusa la lógica que ya existía (`rentaAtribuidaPorSitio`,
// derive.ts:1252) ejecutándola en el SERVIDOR, así que el porte a agregación
// SQL real no tocará ni una pantalla. Si el límite no naciera ahora costaría
// rehacer las cinco pantallas después — y entonces ya no se haría.
//
// ─── Por qué `finanzas` y no `dashboard` ────────────────────────────────────
// Porque un reporte de rentabilidad es DINERO: enseña lo que se cobra por cada
// pantalla y lo que se le paga a cada arrendador. No es un indicador de
// vitrina, y con `dashboard` lo vería cualquier rol que pueda abrir el tablero.
export async function GET(req: Request) {
  const g = await exigir('finanzas', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    // ADR 0048 · las notas de cobertura del reporte escriben importes
    // (`lib/data/reportes.ts`). La fija tambien `tenantActual()`, pero aqui se
    // pide antes de armar nada: es la ruta que el validador encontro sin ella.
    await monedaDeLaInstancia()
    // `Object.fromEntries` y no lectura campo a campo: el schema es `.strict()`,
    // así que un parámetro de más da 400 en vez de ignorarse en silencio. Un
    // `?granularidadd=mes` con typo devolvería el reporte por omisión —otro
    // periodo del que se pidió— y nadie lo notaría mirando la pantalla.
    const params = Object.fromEntries(new URL(req.url).searchParams)
    return NextResponse.json(await rentabilidadCtrl(params))
  } catch (e) {
    return respuestaError(e)
  }
}
