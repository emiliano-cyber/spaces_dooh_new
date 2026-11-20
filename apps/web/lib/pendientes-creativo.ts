// ============================================================================
//  lib/pendientes-creativo.ts — La «tarea 1» del flujo del creativo (20/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño (20/11): «se cierra venta → se recibe el creativo → tarea 1:
//  se manda a impresión o se programa → impresión va a la cola con prioridad».
//
//  Cuando una campaña vendida tiene un creativo APROBADO, cada sitio suyo queda
//  PENDIENTE de que una persona lo confirme:
//   · sitio FIJO    → «Mandar a impresión» (crea la orden de impresión).
//   · sitio DIGITAL → «Programar» (la acción de siempre: enviar al dominio).
//  Nada se crea solo: el sistema solo dice qué falta.
//
//  SIN TABLA DE TAREAS, a propósito: el pendiente se DERIVA de lo que ya hay.
//   · IMPRIMIR  = campaña OOH/HÍBRIDA, CONFIRMADA o ACTIVA, con un creativo
//                 aprobado (no retirado), y un sitio fijo reservado que NO tiene
//                 orden de impresión de esa campaña. Crear la orden lo quita.
//                 Una orden sin sitio (alta manual de antes) no tapa a ninguno.
//   · PROGRAMAR = campaña DOOH/HÍBRIDA, CONFIRMADA o ACTIVA, una pantalla
//                 digital con un creativo aprobado ASIGNADO
//                 (`reservas.creativos`), y la campaña sin enviar al dominio
//                 (`campanas.enviada_dominio`). Enviarla lo quita; si la
//                 publicación se rechaza, la bandera baja y vuelve a salir.
//   · POR_APROBAR = un envío del cliente por la liga aún PENDIENTE, o un
//                 creativo nuestro PENDIENTE. Se enseña con su origen y sin
//                 botón de imprimir: primero se aprueba.
//  Una tabla de tareas habría que mantenerla al día en cada alta, baja,
//  rechazo y reemplazo, y se desincronizaría en el primero que se olvide.
//
//  Puro: el repo (`lib/server/pendientes-creativo-repo.ts`) lee las filas del
//  tenant y esto decide. Así la regla se prueba sin base.
// ============================================================================

export type OrigenCreativo = 'CLIENTE' | 'INTERNO'
export type AccionPendiente = 'IMPRIMIR' | 'PROGRAMAR' | 'POR_APROBAR'
export type EstatusCreativo = 'PENDIENTE' | 'VALIDADA' | 'RECHAZADA'

export interface DatosPendientes {
  campanas: {
    id: string
    nombre: string
    folio: string | null
    tipo: string
    estado: string
    inicio: string | null
    enviadaDominio: boolean
  }[]
  // Solo reservas vivas (no CANCELADA). `creativos` = ids asignados al spot.
  reservas: {
    campanaId: string
    sitioId: string
    sitioNombre: string | null
    digital: boolean
    ancho: number | null
    alto: number | null
    creativos: string[]
  }[]
  creativos: {
    id: string
    campanaId: string
    nombre: string
    estatus: EstatusCreativo
    origen: OrigenCreativo
    retirado?: boolean
  }[]
  // Envíos del cliente por la liga que siguen PENDIENTES (aún no son creativo).
  envios: { id: string; campanaId: string; sitioId: string | null; sitioNombre?: string | null; nombreArchivo: string }[]
  ordenes: { campanaId: string; sitioId: string | null }[]
}

export interface CreativoDelPendiente {
  // null en un envío del cliente: todavía no es creativo.
  id: string | null
  nombre: string
  estatus: EstatusCreativo
  origen: OrigenCreativo
}

export interface Pendiente {
  // Estable y única: `ACCION:campaña:sitio` (o el id del creativo/envío en POR_APROBAR).
  clave: string
  accion: AccionPendiente
  campanaId: string
  campanaNombre: string
  campanaFolio: string | null
  campanaTipo: string
  campanaInicio: string | null
  sitioId: string | null
  sitioNombre: string | null
  sitioAncho: number | null
  sitioAlto: number | null
  creativos: CreativoDelPendiente[]
}

// «Se cierra venta»: una campaña CONFIRMADA o ya ACTIVA. Un borrador o una
// cotización todavía no se imprimen; una completada, cancelada o lista para
// facturar ya no.
const ESTADOS_VIVOS = new Set(['CONFIRMADA', 'ACTIVA'])
const IMPRIMEN = new Set(['OOH', 'HIBRIDA'])
const PROGRAMAN = new Set(['DOOH', 'HIBRIDA'])
const ORDEN_ACCION: AccionPendiente[] = ['IMPRIMIR', 'PROGRAMAR', 'POR_APROBAR']

export function derivarPendientes(d: DatosPendientes): Pendiente[] {
  const out: Pendiente[] = []
  const conOrden = new Set(d.ordenes.filter((o) => o.sitioId).map((o) => `${o.campanaId}:${o.sitioId}`))

  for (const c of d.campanas) {
    if (!ESTADOS_VIVOS.has(c.estado)) continue
    const suyos = d.creativos.filter((cr) => cr.campanaId === c.id && !cr.retirado)
    const aprobados = suyos.filter((cr) => cr.estatus === 'VALIDADA')
    const comun = {
      campanaId: c.id,
      campanaNombre: c.nombre,
      campanaFolio: c.folio,
      campanaTipo: c.tipo,
      campanaInicio: c.inicio,
    }
    const vistos = new Set<string>()
    for (const r of d.reservas) {
      if (r.campanaId !== c.id || vistos.has(r.sitioId)) continue
      const sitio = { sitioId: r.sitioId, sitioNombre: r.sitioNombre, sitioAncho: r.ancho, sitioAlto: r.alto }
      if (!r.digital) {
        if (!IMPRIMEN.has(c.tipo) || aprobados.length === 0 || conOrden.has(`${c.id}:${r.sitioId}`)) continue
        vistos.add(r.sitioId)
        out.push({ clave: `IMPRIMIR:${c.id}:${r.sitioId}`, accion: 'IMPRIMIR', ...comun, ...sitio, creativos: aprobados.map(vista) })
      } else {
        if (!PROGRAMAN.has(c.tipo) || c.enviadaDominio) continue
        const asignados = aprobados.filter((cr) => r.creativos.includes(cr.id))
        if (asignados.length === 0) continue
        vistos.add(r.sitioId)
        out.push({ clave: `PROGRAMAR:${c.id}:${r.sitioId}`, accion: 'PROGRAMAR', ...comun, ...sitio, creativos: asignados.map(vista) })
      }
    }

    const medidas = (sitioId: string | null) => d.reservas.find((r) => r.campanaId === c.id && r.sitioId === sitioId)
    for (const e of d.envios) {
      if (e.campanaId !== c.id) continue
      const r = medidas(e.sitioId)
      out.push({
        clave: `POR_APROBAR:${e.id}`,
        accion: 'POR_APROBAR',
        ...comun,
        sitioId: e.sitioId,
        sitioNombre: e.sitioNombre ?? r?.sitioNombre ?? null,
        sitioAncho: r?.ancho ?? null,
        sitioAlto: r?.alto ?? null,
        creativos: [{ id: null, nombre: e.nombreArchivo, estatus: 'PENDIENTE', origen: 'CLIENTE' }],
      })
    }
    for (const cr of suyos.filter((x) => x.estatus === 'PENDIENTE')) {
      out.push({
        clave: `POR_APROBAR:${cr.id}`,
        accion: 'POR_APROBAR',
        ...comun,
        sitioId: null,
        sitioNombre: null,
        sitioAncho: null,
        sitioAlto: null,
        creativos: [vista(cr)],
      })
    }
  }

  // Lo que arranca antes, primero; sin fecha, al final. Luego por tarea y sitio.
  return out.sort(
    (a, b) =>
      (a.campanaInicio ?? '9999').localeCompare(b.campanaInicio ?? '9999') ||
      a.campanaNombre.localeCompare(b.campanaNombre) ||
      ORDEN_ACCION.indexOf(a.accion) - ORDEN_ACCION.indexOf(b.accion) ||
      (a.sitioNombre ?? '').localeCompare(b.sitioNombre ?? '') ||
      a.clave.localeCompare(b.clave),
  )
}

function vista(cr: DatosPendientes['creativos'][number]): CreativoDelPendiente {
  return { id: cr.id, nombre: cr.nombre, estatus: cr.estatus, origen: cr.origen }
}

/** Lo que ve Imprenta: solo lo que hay que mandar a imprimir. */
export function soloImpresion(lista: Pendiente[]): Pendiente[] {
  return lista.filter((p) => p.accion === 'IMPRIMIR')
}

/** 'YYYY-MM-DD' de un día que existe (el 30 de febrero, no). */
export function esFechaReal(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}
