import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible, exigirReautenticacionSiempre, respuestaDesbloqueo } from '@/lib/server/cambios'
import { editarArrendadorCtrl, borrarArrendadorCtrl } from '@/lib/server/arrendadores-controller'
import { datosBancariosArrendador } from '@/lib/server/arrendadores-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Datos bancarios: a DÓNDE se paga la renta. Cambiarlos es un movimiento de
// dinero, así que exige el candado del Dueño (igual que pagar/cancelar contrato).
// El esquema de arrendadores solo tiene estos dos campos de pago (verificado).
const CAMPOS_BANCARIOS = ['cuentaBancaria', 'formaPago']

// PATCH /api/arrendadores/[id] → editar propietario/arrendador.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const tocaBanco =
      body && typeof body === 'object' && CAMPOS_BANCARIOS.some((c) => c in (body as object))
    // A-4 + N-1: cambiar la cuenta/forma de pago es el cambio MÁS sensible de
    // dinero (a dónde se paga la renta), así que exige reautenticación. El resto
    // de campos (nombre, RFC, contacto…) siguen igual que antes.
    //
    // Antes esto pedía el modo ESTRICTO (`sinExenciones`) porque el Dueño estaba
    // exento del candado por defecto. Desde el ADR 0009 NO hay exención para
    // nadie, así que el guard normal ya da la garantía que aquí se quería: ni
    // una sesión de Dueño desatendida puede redirigir pagos sin reautenticar.
    let previo: { cuentaBancaria: string | null; formaPago: string | null } | null = null
    if (tocaBanco) {
      const gc = await exigirCambioSensible('arrendadores', 'crear')
      if (!gc.ok) return gc.res
      // Snapshot del valor ANTERIOR antes de sobrescribirlo (para el audit).
      previo = await datosBancariosArrendador(params.id)
    }
    const arr = await editarArrendadorCtrl(params.id, body)
    if (tocaBanco) {
      // Audit inmutable (tabla acciones, append-only): quién cambió a dónde se
      // paga la renta, con valor anterior → nuevo por cada campo que cambió.
      const cambios: string[] = []
      const b = body as Record<string, unknown>
      const fmt = (v: string | null) => (v && v.length ? `"${v}"` : '∅')
      if ('cuentaBancaria' in b && (previo?.cuentaBancaria ?? null) !== (arr.cuentaBancaria ?? null)) {
        cambios.push(`cuenta bancaria ${fmt(previo?.cuentaBancaria ?? null)}→${fmt(arr.cuentaBancaria ?? null)}`)
      }
      if ('formaPago' in b && (previo?.formaPago ?? null) !== (arr.formaPago ?? null)) {
        cambios.push(`forma de pago ${fmt(previo?.formaPago ?? null)}→${fmt(arr.formaPago ?? null)}`)
      }
      const detalle = cambios.length ? `${arr.nombre} · ${cambios.join('; ')}` : arr.nombre
      await registrarAccion(g.usuario, 'Cambió datos bancarios del propietario', detalle)
    } else {
      await registrarAccion(g.usuario, 'Editó propietario', arr.nombre)
    }
    return NextResponse.json(arr)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/arrendadores/[id] → soft-delete (bloquea si tiene predios/contratos activos).
// Catálogo: dar de baja a un propietario es sensible.
//
// ─── Por qué NO usa `exigirCambioSensible`, desde el 2026-08-26 ─────────────
// Lo usaba, y la reautenticación que prometía NO OCURRÍA. `exigirCambioSensible`
// llama a `exigirDesbloqueo()`, que consulta el interruptor
// `tenants.exigir_reautenticacion` (`cambios.ts:202`) y deja pasar sin pedir
// nada si está apagado — como está por defecto y como está en los cinco tenants
// de producción (`cambios.ts:214`).
//
// Ese interruptor es opt-in A PROPÓSITO para la fricción de negocio: el Dueño
// decide si quiere que su equipo teclee la contraseña al cancelar un contrato.
// Pero dar de baja a un propietario no debería depender de esa preferencia, y
// se descubrió al comparar con el borrado de clientes: ese es irreversible y
// pide la contraseña siempre, así que el catálogo espejo pedía MENOS para algo
// parecido. Se igualan por arriba.
//
// Mismo camino que restablecer la contraseña de un tercero
// (`usuarios/[id]/restablecer/route.ts:38`), donde ya se decidió lo mismo.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // El permiso primero: no se le pide la contraseña a quien de todas formas no
  // puede dar de baja.
  const g = await exigir('arrendadores', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const d = await exigirReautenticacionSiempre()
  if (!d.ok) return respuestaDesbloqueo(d)
  try {
    const arr = await borrarArrendadorCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró propietario (soft-delete)', arr.nombre)
    return NextResponse.json({ ok: true, arrendador: arr })
  } catch (e) {
    return respuestaError(e)
  }
}
