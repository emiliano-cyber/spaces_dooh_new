import { NextResponse } from 'next/server'
import { exigir, permisosDeRol } from '@/lib/server/auth'
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
  listarPredios,
  listarRazonesSociales,
  recomputarEstatusArrendadores,
} from '@/lib/server/arrendadores-repo'
import { listarPropuestas } from '@/lib/server/propuestas-repo'
import { listarOrdenesCompra } from '@/lib/server/ordenes-compra-repo'
import { listarNotificaciones } from '@/lib/server/notificaciones-repo'
import { obtenerConfig } from '@/lib/server/config-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/estado → slices persistidas para hidratar el store del front.
//
// Caso especial del Bloque C: esta ruta agrega datos de VARIOS módulos, así que
// no puede exigir uno solo. En vez de eso filtra su respuesta contra los permisos
// del rol: cada slice se consulta únicamente si el rol tiene `ver` en su módulo.
// Lo que el rol no puede ver ni siquiera se consulta a la BD.
//
// Las secciones denegadas viajan como arreglo vacío (no como clave ausente) para
// no romper la forma del store del front, que espera todas las claves. El efecto
// de seguridad es el mismo: cero filas de módulos ajenos.
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const permisos = await permisosDeRol(g.usuario.rol)
  const puede = (modulo: string) => (permisos[modulo] ?? []).includes('ver')
  // Corre la consulta solo si el rol puede ver el módulo; si no, arreglo vacío.
  const si = <T>(modulo: string, consulta: () => Promise<T[]>): Promise<T[]> =>
    puede(modulo) ? consulta() : Promise.resolve([])

  const verComercial = puede('comercial')
  const verOperaciones = puede('operaciones')
  const verFinanzas = puede('finanzas')

  // Barridos de mantenimiento: solo los dispara quien puede ver el módulo que
  // tocan, para que un rol ajeno no provoque escrituras que no le corresponden.
  if (verComercial) await barrerReservasVencidas() // libera inventario reservado
  if (verOperaciones) await notificarOTsVencidas() // alertas de OT vencidas
  if (verFinanzas) await recordarCobranzasVencidas() // recordatorios de cobro
  // Sincroniza el estatus de contratos y pagos con la fecha de hoy (vigente /
  // por vencer a 3 meses / vencido), para que el P&L y las alertas no usen un
  // estatus congelado.
  if (puede('arrendadores')) await recomputarEstatusArrendadores()

  const [sitios, sitiosRed, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias, facturas, cobranzas, ordenesImpresion, acciones, arrendadores, contratos, pagosRenta, incidencias, propuestas, ordenesCompra, notificaciones, configNegocio, predios, razonesSociales] =
    await Promise.all([
      si('network', listarSitios),
      si('network', listarSitiosRed),
      si('comercial', listarClientes),
      si('comercial', listarCampanas),
      si('comercial', listarReservas),
      si('comercial', listarCreatividades),
      si('operaciones', listarOT),
      si('operaciones', listarEvidencias),
      si('finanzas', listarFacturas),
      si('finanzas', listarCobranzas),
      si('imprenta', listarOrdenesImpresion),
      si('administracion', listarAcciones),
      si('arrendadores', listarArrendadores),
      si('arrendadores', listarContratos),
      si('arrendadores', listarPagosRenta),
      si('arrendadores', listarIncidencias),
      si('comercial', listarPropuestas),
      si('comercial', listarOrdenesCompra),
      // Notificaciones y config no son de módulo: las primeras son del propio
      // usuario y la segunda es la identidad del tenant que pinta el shell.
      listarNotificaciones(),
      obtenerConfig(),
      si('arrendadores', listarPredios),
      si('arrendadores', listarRazonesSociales),
    ])
  return NextResponse.json({
    sitios, sitiosRed, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias, facturas, cobranzas, ordenesImpresion, acciones, arrendadores, contratos, pagosRenta, incidencias, propuestas, ordenesCompra, notificaciones, configNegocio, predios, razonesSociales,
  })
}
