import { NextResponse } from 'next/server'
import { exigir, permisosDeRol } from '@/lib/server/auth'
import { listarSitios, listarSitiosRed } from '@/lib/server/sitios-repo'
import {
  listarClientes,
  listarCampanas,
  listarReservas,
  listarCreatividades,
  barrerReservasVencidas,
  recomputarEstadoCampanas,
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
  listarLicencias,
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
  // Igual, pero basta con poder ver CUALQUIERA de los módulos. Se usa solo para
  // los pagos de renta, que son a la vez patrimonio de Arrendadores (el contrato
  // con el propietario) y de Finanzas (una salida de dinero con vencimiento).
  const siAlguno = <T>(modulos: string[], consulta: () => Promise<T[]>): Promise<T[]> =>
    modulos.some(puede) ? consulta() : Promise.resolve([])

  const verComercial = puede('comercial')
  const verOperaciones = puede('operaciones')
  const verFinanzas = puede('finanzas')

  // Barridos de mantenimiento: solo los dispara quien puede ver el módulo que
  // tocan, para que un rol ajeno no provoque escrituras que no le corresponden.
  //
  // EN PARALELO, no uno detrás de otro. Antes eran cuatro `await` seguidos, así
  // que para un Dueño —que puede verlo todo— la petición esperaba las cuatro
  // ESCRITURAS en fila antes de empezar siquiera a leer, en CADA carga de
  // página. No son un caso raro: este endpoint hidrata el shell entero, no solo
  // el dashboard.
  //
  // Se pueden solapar porque tocan dominios distintos y ninguno lee lo que otro
  // escribe: reservas vencidas, avisos de OT, recordatorios de cobranza y
  // estatus de contratos. Si algún día uno pasara a depender de otro, hay que
  // volver a encadenarlos — y entonces el orden sería una regla, no una
  // casualidad como lo era antes.
  //
  // `Promise.all` y no `allSettled`: si un barrido falla, la petición debe
  // fallar igual que fallaba antes. Tragarse el error dejaría datos rancios sin
  // que nada lo dijera, que es justo el modo de fallo silencioso que este repo
  // viene arrastrando (`refrescarEstado` con su `if (!r.ok) return`).
  await Promise.all([
    verComercial ? barrerReservasVencidas() : null,       // libera inventario reservado
    // Sincroniza el estado de la campaña con el calendario (INC-03), como el
    // de contratos de abajo. Mismo criterio por permiso que el resto: lo
    // dispara quien puede ver comercial, para que un rol ajeno no provoque
    // escrituras que no le corresponden.
    verComercial ? recomputarEstadoCampanas() : null,
    verOperaciones ? notificarOTsVencidas() : null,       // alertas de OT vencidas
    verFinanzas ? recordarCobranzasVencidas() : null,     // recordatorios de cobro
    // Sincroniza el estatus de contratos y pagos con la fecha de hoy (vigente /
    // por vencer a 3 meses / vencido), para que el P&L y las alertas no usen un
    // estatus congelado.
    puede('arrendadores') ? recomputarEstatusArrendadores() : null,
  ])

  const [sitios, sitiosRed, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias, facturas, cobranzas, ordenesImpresion, acciones, arrendadores, contratos, pagosRenta, incidencias, propuestas, ordenesCompra, notificaciones, configNegocio, predios, razonesSociales, licencias] =
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
      siAlguno(['arrendadores', 'finanzas'], listarContratos),
      siAlguno(['arrendadores', 'finanzas'], listarPagosRenta),
      si('arrendadores', listarIncidencias),
      si('comercial', listarPropuestas),
      si('comercial', listarOrdenesCompra),
      // Notificaciones y config no son de módulo: las primeras son del propio
      // usuario y la segunda es la identidad del tenant que pinta el shell.
      listarNotificaciones(),
      obtenerConfig(),
      si('arrendadores', listarPredios),
      si('arrendadores', listarRazonesSociales),
      si('arrendadores', listarLicencias),
    ])
  const cuerpo = {
    sitios, sitiosRed, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias, facturas, cobranzas, ordenesImpresion, acciones, arrendadores, contratos, pagosRenta, incidencias, propuestas, ordenesCompra, notificaciones, configNegocio, predios, razonesSociales, licencias,
  }
  if (process.env.MEDIR_ESTADO === '1') medirRebanadas(cuerpo)
  return NextResponse.json(cuerpo)
}

// Peso de cada rebanada, en bytes serializados. DETRÁS DE BANDERA a propósito:
// medir es volver a serializar TODO el cuerpo una segunda vez, y esta es la
// petición que hidrata el shell en cada carga — dejarlo encendido cambiaría el
// coste de la ruta que existe para abaratar.
//
// Existe porque esta ruta ya se descontroló una vez sin que nada avisara: llegó
// a 6.12 MB (contratos 3.95 · sitios 1.0 · sitiosRed 1.0) y el síntoma fue una
// pantalla en blanco de 6–12 s, no un error. Un `SELECT *` con una columna
// nueva y grande basta para repetirlo, así que conviene tener con qué mirarlo.
//
//   MEDIR_ESTADO=1 npm run dev
function medirRebanadas(cuerpo: Record<string, unknown>): void {
  const filas = Object.entries(cuerpo)
    .map(([clave, valor]) => ({
      rebanada: clave,
      kB: +(Buffer.byteLength(JSON.stringify(valor ?? null), 'utf8') / 1024).toFixed(1),
      filas: Array.isArray(valor) ? valor.length : 1,
    }))
    .sort((a, b) => b.kB - a.kB)
  const total = filas.reduce((s, f) => s + f.kB, 0)
  console.log(`[estado] total ${total.toFixed(1)} kB`)
  console.table(filas.filter((f) => f.kB >= 1))
}
