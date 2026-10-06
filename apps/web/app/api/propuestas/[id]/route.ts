import { NextResponse } from 'next/server'
import { AppError } from '@/lib/server/errores'
import { exigir } from '@/lib/server/auth'
import {
  cambiarEstatusPropuesta,
  actualizarPropuesta,
  PropuestaError,
  PropuestaCeroError,
  CodigoPendienteError,
  TopeVigenteError,
} from '@/lib/server/propuestas-repo'
import { generarCampanaDesdePropuesta, PropuestaCampanaError } from '@/lib/server/campanas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'
import { textoBitacoraPropuesta } from '@/lib/descuento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/propuestas/[id] → cambia el estatus (enviar/aprobar/rechazar).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))

  // Actualización de campos editables (descuento comercial / nombre / notas),
  // sin cambio de estatus. Sube versión si renegocia una propuesta ya enviada.
  if (body.estatus == null && (body.descuentoPct != null || body.nombre != null || body.notas !== undefined)) {
    try {
      const res = await actualizarPropuesta(params.id, {
        descuentoPct: body.descuentoPct,
        nombre: body.nombre,
        notas: body.notas,
      })
      if (!res) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      const prop = res.propuesta
      // TOPE-02 · la bitácora dice CUÁNTO descuento se puso, no solo que alguien
      // «actualizó». Con esta línea, Actividad filtrada por persona enseña
      // «Fulana puso 22 % de descuento en la propuesta X», que es un dato de
      // dinero y hasta hoy no quedaba en ninguna parte: al APROBAR sí queda el
      // importe (abajo, :62-63), pero para entonces el descuento ya está puesto
      // y no se sabe quién lo puso.
      //
      // `descuentoAplicado` es null cuando el guardado NO tocó el descuento, y
      // entonces el texto es el de siempre. No es un detalle: anotarlo en cada
      // guardado llenaría la pantalla de descuentos que nadie cambió y haría
      // inútil el filtro que se quiere poder enseñar.
      await registrarAccion(
        g.usuario,
        textoBitacoraPropuesta(prop.version, res.descuentoAplicado),
        prop.nombre,
      )
      return NextResponse.json(prop)
    } catch (e) {
      const status = e instanceof PropuestaError ? 409 : 400
      return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo actualizar' }, { status })
    }
  }

  try {
    const prop = await cambiarEstatusPropuesta(params.id, body.estatus, { confirmarCero: body.confirmarCero })
    if (!prop) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    // S0-1/S1-2: al aprobar se congela el snapshot económico; queda en bitácora
    // con versión y total (y la marca de $0 si aplica el guardarraíl).
    const totalTxt = `$${Math.round(prop.total).toLocaleString('es-MX')}`
    const accionTxt =
      prop.estatus !== 'APROBADA'
        ? `Propuesta → ${prop.estatus}`
        : prop.total <= 0
          ? `Aprobó propuesta en $0 (confirmado) · snapshot v${prop.version}`
          : `Aprobó propuesta · snapshot económico v${prop.version} (total ${totalTxt})`
    await registrarAccion(g.usuario, accionTxt, prop.nombre)
    if (prop.estatus === 'APROBADA' || prop.estatus === 'RECHAZADA') {
      await notificar({
        tipo: 'PROPUESTA',
        nivel: prop.estatus === 'APROBADA' ? 'ok' : 'warn',
        titulo: prop.estatus === 'APROBADA' ? 'Propuesta aprobada' : 'Propuesta rechazada',
        detalle: `${prop.folio} · ${prop.nombre}`,
        link: '/propuestas',
      })
    }

    // Al aprobar: genera automáticamente la campaña con la info de la propuesta
    // (sus pantallas, fechas, cliente y precios netos). Idempotente.
    let campana = null
    if (prop.estatus === 'APROBADA') {
      try {
        const res = await generarCampanaDesdePropuesta(params.id)
        campana = res.campana
        // Igual que en /generar-campana: la bitácora y el aviso solo cuando de
        // verdad se creó. Aprobar ya genera la campaña aquí, así que si además
        // se pulsa "Generar campaña" el segundo paso es un no-op idempotente y
        // anotarlo dejaba dos entradas para una sola campaña (A-5).
        if (!res.yaExistia) {
          await registrarAccion(g.usuario, 'Generó campaña desde propuesta', campana.nombre)
          await notificar({
            tipo: 'CAMPANA', nivel: 'ok', titulo: 'Campaña generada desde propuesta',
            detalle: `${campana.folio} · ${campana.nombre}`, link: `/campanas/${campana.id}`,
          })
        }
      } catch (e) {
        // No bloquea la aprobación (p. ej. falta cliente); se puede generar luego.
        //
        // Y el `if (!(e instanceof PropuestaCampanaError)) throw e` que habia
        // aqui SI la bloqueaba, con un 500, en el caso mas comun de todos: el
        // guard del ADR 0003 -«esta pantalla no se puede vender: su contrato de
        // arrendamiento esta incompleto»- lanza AppError, no
        // PropuestaCampanaError. O sea que aprobar una propuesta con UNA
        // pantalla de contrato incompleto reventaba la aprobacion ENTERA,
        // cuando el proposito declarado de este catch es justamente que no la
        // bloquee.
        //
        // Medido el 2026-09-29 con una reproduccion en vivo. Ahora los dos
        // errores de dominio se avisan igual y la aprobacion sigue.
        if (!(e instanceof PropuestaCampanaError) && !(e instanceof AppError)) throw e
        await notificar({
          tipo: 'CAMPANA', nivel: 'warn', titulo: 'No se pudo generar la campaña',
          detalle: (e as Error).message, link: '/propuestas',
        })
      }
    }

    return NextResponse.json({ ...prop, campanaGenerada: campana })
  } catch (e) {
    // S1-2: total $0 sin confirmar → aviso para que el UI reconfirme.
    if (e instanceof PropuestaCeroError) {
      return NextResponse.json({ error: e.message, requiereConfirmacionCero: true }, { status: 409 })
    }
    // COD-03 · aprobar con el cupón PENDIENTE: 409, conflicto de ESTADO, con la
    // frase que dice qué hacer. No es un 400: la petición está bien formada.
    if (e instanceof CodigoPendienteError) {
      return NextResponse.json({ error: e.message, codigoPendiente: true }, { status: 409 })
    }
    // TOPE-03 · el descuento guardado ya no cabe en el tope VIGENTE: 409 con la
    // frase que dice los dos números y qué hacer. Conflicto de estado, como el
    // de arriba: la petición está bien formada, lo que cambió fue el tope.
    if (e instanceof TopeVigenteError) {
      return NextResponse.json({ error: e.message, descuentoSobreTope: true }, { status: 409 })
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo actualizar' },
      { status: 400 },
    )
  }
}
