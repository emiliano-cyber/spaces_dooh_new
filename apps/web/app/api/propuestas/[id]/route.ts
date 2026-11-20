import { NextResponse } from 'next/server'
import { siNoEsSuya } from '@/lib/server/propuestas-visibilidad'
import { z } from 'zod'
import { AppError, respuestaError } from '@/lib/server/errores'
import { soloDe as soloDeOportunidades } from '@/lib/server/oportunidades-controller'
import { exigir } from '@/lib/server/auth'
import {
  cambiarEstatusPropuesta,
  actualizarPropuesta,
  borrarPropuestaBorrador,
  ligarPropuestaAOportunidad,
  PropuestaError,
  PropuestaCeroError,
  CodigoPendienteError,
  TopeVigenteError,
} from '@/lib/server/propuestas-repo'
import { generarCampanaDesdePropuesta, PropuestaCampanaError } from '@/lib/server/campanas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { monedaDeLaInstancia } from '@/lib/server/moneda-instancia'
import { simboloMoneda } from '@/lib/i18n/dinero'
import { traducirError } from '@/lib/i18n/errores-servidor'
import { idiomaDeLaPeticion } from '@/lib/i18n/servidor'
import { notificar } from '@/lib/server/notificaciones-repo'
import { textoBitacoraPropuesta } from '@/lib/descuento'
import { marcaPropuesta } from '@/lib/propuesta-marca'
import { avisosDePropuesta } from '@/lib/server/propuestas-competencia'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PROP-COMPLETA (29/10) · forma de los dos campos del documento. La fecha va
// como `AAAA-MM-DD` (lo que da un <input type=date>) y se valida que exista: un
// «2026-02-31» llegaría a Postgres como un 500 en vez de una frase.
const camposDocumento = z.object({
  condiciones: z.string().max(8000, 'Las condiciones no pueden pasar de 8000 caracteres').nullish(),
  vigenteHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La vigencia debe ser una fecha AAAA-MM-DD')
    .refine((s) => {
      const [a, m, d] = s.split('-').map(Number)
      const f = new Date(a, m - 1, d)
      return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d
    }, 'La fecha de vigencia no existe')
    .nullish(),
})

// PATCH /api/propuestas/[id] → cambia el estatus (enviar/aprobar/rechazar).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // ADR 0051 · el vendedor solo toca SUS propuestas; una ajena es 404.
  const ajena = await siNoEsSuya(g.usuario, params.id)
  if (ajena) return ajena
  const body = await req.json().catch(() => ({}))

  // ADR 0051 §3 · ligar o desligar la oportunidad. Va SOLO: no se mezcla con
  // editar ni con cambiar el estatus, porque se puede en cualquier estatus
  // (también aprobada) y las otras dos ramas no. Mezclarlas haría que una
  // propuesta aprobada se «editara» por la puerta de ligar.
  if (body && typeof body === 'object' && 'oportunidadId' in body) {
    const otras = Object.keys(body).filter((k) => k !== 'oportunidadId')
    const v = (body as { oportunidadId: unknown }).oportunidadId
    const valido = v === null || (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v))
    if (otras.length || !valido) {
      return NextResponse.json({ error: traducirError('Datos inválidos', idiomaDeLaPeticion()) }, { status: 400 })
    }
    try {
      const ok = await ligarPropuestaAOportunidad(
        params.id,
        v as string | null,
        await soloDeOportunidades(g.usuario),
      )
      if (!ok) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      await registrarAccion(
        g.usuario,
        v ? 'Ligó la propuesta a una oportunidad' : 'Desligó la propuesta de su oportunidad',
        params.id,
      )
      return NextResponse.json({ ok: true, oportunidadId: v })
    } catch (e) {
      return respuestaError(e)
    }
  }

  // Actualización de campos editables (descuento comercial / nombre / notas),
  // sin cambio de estatus. Sube versión si renegocia una propuesta ya enviada.
  // PROP-COMPLETA (29/10) · y las condiciones y la vigencia de ESTA propuesta.
  if (
    body.estatus == null &&
    (body.descuentoPct != null || body.nombre != null || body.notas !== undefined ||
      body.condiciones !== undefined || body.vigenteHasta !== undefined || body.marca !== undefined)
  ) {
    const extra = camposDocumento.safeParse({ condiciones: body.condiciones, vigenteHasta: body.vigenteHasta })
    if (!extra.success) {
      return NextResponse.json({ error: extra.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }
    // PROP-MARCA (20/11) · la marca solo se toca si viene: `marcaPropuesta`
    // convierte «ausente» en null, y eso BORRARÍA la marca al editar el nombre.
    const marca = body.marca === undefined ? undefined : marcaPropuesta.safeParse(body.marca)
    if (marca && !marca.success) {
      return NextResponse.json(
        { error: traducirError(marca.error.issues[0]?.message ?? 'Datos inválidos', idiomaDeLaPeticion()) },
        { status: 400 },
      )
    }
    try {
      const res = await actualizarPropuesta(params.id, {
        descuentoPct: body.descuentoPct,
        nombre: body.nombre,
        notas: body.notas,
        // Vaciar el cuadro es QUITAR las condiciones, no guardar espacios.
        condiciones:
          extra.data.condiciones === undefined ? undefined : extra.data.condiciones?.trim() || null,
        vigenteHasta: extra.data.vigenteHasta,
        marca: marca ? marca.data : undefined,
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
      // PROP-MARCA (20/11) · cambiar la marca puede crear o quitar un choque.
      // Solo avisa; solo se calcula si la marca vino en el cuerpo.
      return NextResponse.json(
        body.marca !== undefined ? { ...prop, avisosCompetencia: await avisosDePropuesta(params.id) } : prop,
      )
    } catch (e) {
      const status = e instanceof PropuestaError ? 409 : 400
      // I18N (ola 6) · esta respuesta tampoco pasa por `respuestaError()`: la
      // frase del tope al EDITAR el descuento (`DescuentoSobreTope`) salia en
      // español con la pantalla en inglés. Se traduce aquí, como el 409 del
      // tope vigente de abajo. En español devuelve el mensaje tal cual.
      return NextResponse.json(
        { error: traducirError(e instanceof Error ? e.message : 'No se pudo actualizar', idiomaDeLaPeticion()) },
        { status },
      )
    }
  }

  try {
    const prop = await cambiarEstatusPropuesta(params.id, body.estatus, { confirmarCero: body.confirmarCero })
    if (!prop) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    // S0-1/S1-2: al aprobar se congela el snapshot económico; queda en bitácora
    // con versión y total (y la marca de $0 si aplica el guardarraíl).
    // ADR 0048 · el importe de la bitacora lleva el simbolo de la moneda de la
    // instancia; en servidor hay que pedirla antes de escribirlo.
    await monedaDeLaInstancia()
    const totalTxt = `${simboloMoneda()}${Math.round(prop.total).toLocaleString('es-MX')}`
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
    //
    // I18N (2026-11-02) · esta respuesta no pasa por `respuestaError()`, así que
    // la frase se traduce aquí, con el mismo `traducirError` del embudo. En
    // español devuelve el mensaje tal cual; el status y la bandera no cambian.
    if (e instanceof TopeVigenteError) {
      return NextResponse.json(
        { error: traducirError(e.message, idiomaDeLaPeticion()), descuentoSobreTope: true },
        { status: 409 },
      )
    }
    // I18N (ola 6) · el 400 genérico de aprobar, donde cae la negociación con
    // la agencia sin validar (`PropuestaError`). Mismo `traducirError`.
    return NextResponse.json(
      { error: traducirError(e instanceof Error ? e.message : 'No se pudo actualizar', idiomaDeLaPeticion()) },
      { status: 400 },
    )
  }
}

// DELETE /api/propuestas/[id] → borra un BORRADOR (PROP-COMPLETA, 29/10, R5
// aprobado por el dueño). Enviada o aprobada → 409 con la frase que dice qué
// hacer. Ver `borrarPropuestaBorrador`.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // ADR 0051 · el vendedor solo toca SUS propuestas; una ajena es 404.
  const ajena = await siNoEsSuya(g.usuario, params.id)
  if (ajena) return ajena
  try {
    const b = await borrarPropuestaBorrador(params.id)
    if (!b) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    await registrarAccion(g.usuario, `Borró el borrador de propuesta ${b.folio}`, b.nombre)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof PropuestaError) return NextResponse.json({ error: e.message }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo borrar la propuesta' }, { status: 500 })
  }
}
