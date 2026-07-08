import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarSitios, listarSitiosRed } from '@/lib/server/sitios-repo'
import {
  listarClientes,
  listarCampanas,
  listarReservas,
  listarCreatividades,
  barrerReservasVencidas,
} from '@/lib/server/campanas-repo'
import { listarOT, listarEvidencias, notificarOTsVencidas } from '@/lib/server/ot-repo'
import { listarFacturas, listarCobranzas, recordarCobranzasVencidas } from '@/lib/server/finanzas-repo'
import { listarOrdenesImpresion } from '@/lib/server/impresion-repo'
import { listarAcciones } from '@/lib/server/acciones-repo'
import {
  listarArrendadores,
  listarContratos,
  listarPagosRenta,
  listarIncidencias,
} from '@/lib/server/arrendadores-repo'
import { listarPropuestas } from '@/lib/server/propuestas-repo'
import { listarOrdenesCompra } from '@/lib/server/ordenes-compra-repo'
import { listarNotificaciones } from '@/lib/server/notificaciones-repo'
import { obtenerConfig } from '@/lib/server/config-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/estado → slices persistidas para hidratar el store del front.
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // Caduca las reservas tentativas vencidas antes de leer (libera inventario).
  await barrerReservasVencidas()
  // Genera alertas in-app de OT vencidas (idempotente; no repite por OT).
  await notificarOTsVencidas()
  // Recordatorios de cobro (por vencer / vencidas), con cadencia (sin spam).
  await recordarCobranzasVencidas()
  const [sitios, sitiosRed, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias, facturas, cobranzas, ordenesImpresion, acciones, arrendadores, contratos, pagosRenta, incidencias, propuestas, ordenesCompra, notificaciones, configNegocio] =
    await Promise.all([
      listarSitios(),
      listarSitiosRed(),
      listarClientes(),
      listarCampanas(),
      listarReservas(),
      listarCreatividades(),
      listarOT(),
      listarEvidencias(),
      listarFacturas(),
      listarCobranzas(),
      listarOrdenesImpresion(),
      listarAcciones(),
      listarArrendadores(),
      listarContratos(),
      listarPagosRenta(),
      listarIncidencias(),
      listarPropuestas(),
      listarOrdenesCompra(),
      listarNotificaciones(),
      obtenerConfig(),
    ])
  return NextResponse.json({
    sitios, sitiosRed, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias, facturas, cobranzas, ordenesImpresion, acciones, arrendadores, contratos, pagosRenta, incidencias, propuestas, ordenesCompra, notificaciones, configNegocio,
  })
}
