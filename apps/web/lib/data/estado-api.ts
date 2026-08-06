'use client'

import { useDemoStore } from './store'
import type { Campana } from './types'

// ============================================================================
//  lib/data/estado-api.ts — Estado persistido (BD) → store, y mutaciones de
//  campañas/reservas. Tras cada escritura refresca todo el estado.
// ============================================================================

const API = '/spaces-dooh/api'

// Hidrata el store con lo que vive en la BD (sitios, clientes, campañas, ...).
//
// Marca `estadoCarga` para que el shell sepa distinguir "todavía no llega" de
// "llegó y está vacío". Antes devolvía en silencio si la petición fallaba y el
// store se quedaba con el seed VACÍO: la app mostraba "0 de 0" en todos los
// módulos, indistinguible de no tener datos (hallazgo C1 de la auditoría QA).
export async function refrescarEstado(): Promise<void> {
  let r: Response
  try {
    r = await fetch(`${API}/estado/`, { cache: 'no-store' })
  } catch (err) {
    console.error('[estado] no se pudo cargar el estado:', err)
    useDemoStore.setState({ estadoCarga: 'error' })
    return
  }
  if (!r.ok) {
    console.error('[estado] /api/estado respondió', r.status)
    // 401 = la sesión caducó; el AuthGate se encarga de mandar al login. Para
    // cualquier otro fallo mostramos el error en vez de un sistema vacío.
    useDemoStore.setState({ estadoCarga: r.status === 401 ? 'pendiente' : 'error' })
    return
  }
  const e = await r.json()
  useDemoStore.setState({
    estadoCarga: 'listo',
    sitios: e.sitios ?? [],
    sitiosRed: e.sitiosRed ?? [],
    clientes: e.clientes ?? [],
    campanas: e.campanas ?? [],
    reservas: e.reservas ?? [],
    creatividades: e.creatividades ?? [],
    ordenesTrabajo: e.ordenesTrabajo ?? [],
    evidencias: e.evidencias ?? [],
    facturas: e.facturas ?? [],
    cobranzas: e.cobranzas ?? [],
    ordenesImpresion: e.ordenesImpresion ?? [],
    acciones: e.acciones ?? [],
    arrendadores: e.arrendadores ?? [],
    predios: e.predios ?? [],
    razonesSociales: e.razonesSociales ?? [],
    licencias: e.licencias ?? [],
    contratos: e.contratos ?? [],
    pagosRenta: e.pagosRenta ?? [],
    incidencias: e.incidencias ?? [],
    propuestas: e.propuestas ?? [],
    ordenesCompra: e.ordenesCompra ?? [],
    notificaciones: e.notificaciones ?? [],
    ...(e.configNegocio ? { configNegocio: e.configNegocio } : {}),
  })
}

// Hidrata el store SOLO con los datos públicos de una campaña (por token), sin
// sesión. Se usa en la liga pública del portal de campaña (/demo/portal/:token).
// Devuelve el membrete de la organización (o null si la liga no vale). No se
// mete en el store como el resto: el store es del SHELL, que en el portal no
// existe — ahí no hay sesión ni menú lateral de donde sacar la marca.
export interface OrgPortal {
  orgNombre: string | null
  orgLogoUrl: string | null
}

export async function hidratarPortalPublico(token: string): Promise<OrgPortal | null> {
  const r = await fetch(`${API}/portal/${token}/`, { cache: 'no-store' })
  if (!r.ok) return null
  const e = await r.json()
  useDemoStore.setState({
    campanas: e.campanas ?? [],
    reservas: e.reservas ?? [],
    sitios: e.sitios ?? [],
    ordenesTrabajo: e.ordenesTrabajo ?? [],
    evidencias: e.evidencias ?? [],
    creatividades: e.creatividades ?? [],
    ordenesImpresion: e.ordenesImpresion ?? [],
  })
  return { orgNombre: e.orgNombre ?? null, orgLogoUrl: e.orgLogoUrl ?? null }
}

// ─── Notificaciones ──────────────────────────────────────────────────────────
export async function marcarNotificacionLeidaApi(id: string): Promise<void> {
  const r = await fetch(`${API}/notificaciones/${id}/leer/`, { method: 'POST' })
  if (r.ok) await refrescarEstado()
}
export async function marcarTodasNotificacionesApi(): Promise<void> {
  const r = await fetch(`${API}/notificaciones/leer-todas/`, { method: 'POST' })
  if (r.ok) await refrescarEstado()
}

// ─── Propuestas (método del divisor) ─────────────────────────────────────────
export async function crearPropuestaApi(input: {
  clienteId?: string | null
  agenciaId?: string | null
  nombre: string
  comisionPct?: number
  fechaInicio: string
  fechaFin: string
  items: {
    sitioId: string
    precio?: number
    unidad?: string
    tarifaUnitaria?: number
    cantidad?: number
    spotsPorDia?: number | null
  }[]
  notas?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/propuestas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la propuesta')
  await refrescarEstado()
}

// Error con bandera para que el UI reconfirme una aprobación en $0 (S1-2).
export class ConfirmacionCeroError extends Error {
  requiereConfirmacionCero = true
}

export async function cambiarEstatusPropuestaApi(
  id: string,
  estatus: string,
  confirmarCero = false,
): Promise<void> {
  const r = await fetch(`${API}/propuestas/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estatus, confirmarCero }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (d.requiereConfirmacionCero) throw new ConfirmacionCeroError(d.error ?? 'Confirma la aprobación en $0')
    throw new Error(d.error ?? 'No se pudo actualizar la propuesta')
  }
  await refrescarEstado()
}

// Actualiza el descuento comercial / nombre / notas (renegociación → sube versión).
export async function actualizarPropuestaApi(
  id: string,
  input: { descuentoPct?: number; nombre?: string; notas?: string | null },
): Promise<void> {
  const r = await fetch(`${API}/propuestas/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar la propuesta')
  await refrescarEstado()
}

// Genera una campaña a partir de una propuesta aprobada (solo sitios aprobados).
export async function generarCampanaDesdePropuestaApi(propuestaId: string): Promise<{ id: string }> {
  const r = await fetch(`${API}/propuestas/${propuestaId}/generar-campana/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo generar la campaña')
  await refrescarEstado()
  return d
}

// Aprobación granular: aprueba/desaprueba un sitio de la propuesta.
export async function aprobarItemPropuestaApi(itemId: string, aprobado: boolean): Promise<void> {
  const r = await fetch(`${API}/propuestas/items/${itemId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobado }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar el sitio')
  await refrescarEstado()
}

// ─── Clientes (CRUD con datos fiscales) ──────────────────────────────────────
export interface ClienteInput {
  nombre: string
  rfc?: string | null
  razonSocial?: string | null
  regimenFiscal?: string | null
  cpFiscal?: string | null
  usoCfdi?: string | null
  ivaPct?: number | null
  comisionAgenciaPct?: number | null
  agenciaId?: string | null
  tieneNegociacion?: boolean | null
  negociacionValidada?: boolean | null
  negociacionNota?: string | null
  tipo?: string
  contacto?: { nombre?: string; email?: string; telefono?: string }
}

export async function crearClienteApi(input: ClienteInput): Promise<void> {
  const r = await fetch(`${API}/clientes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el cliente')
  await refrescarEstado()
}

export async function actualizarClienteApi(id: string, input: Partial<ClienteInput>): Promise<void> {
  const r = await fetch(`${API}/clientes/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar el cliente')
  await refrescarEstado()
}

// ─── Arrendadores / incidencias (antes mock; ahora persisten en la BD) ───────
// Devuelve el arrendador creado. La ruta siempre lo respondió (201 + objeto);
// el tipo decía `void` y se tiraba, así que quien necesitara encadenar algo a su
// id —dar de alta su razón social en el mismo formulario, por ejemplo— no tenía
// de dónde sacarlo. Los llamadores que lo ignoran siguen igual.
export async function crearArrendadorApi(input: {
  nombre: string; rfc?: string | null; telefono?: string | null; email?: string | null; notas?: string | null
}): Promise<{ id: string; nombre: string }> {
  const r = await fetch(`${API}/arrendadores/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el propietario')
  await refrescarEstado()
  return { id: String(d?.id ?? ''), nombre: String(d?.nombre ?? input.nombre) }
}

// Alta unificada: arrendatario → contrato de arrendamiento → pantalla. El
// arrendador puede ser existente ({ id }) o nuevo ({ nombre, ... }). Fechas
// pasadas permitidas. Devuelve el id de la pantalla creada.
export async function crearContratoConSitioApi(input: {
  arrendador: { id: string } | { nombre: string; rfc?: string | null; telefono?: string | null; email?: string | null; notas?: string | null }
  // Predio obligatorio: {id} reusa uno del mismo arrendador (varias pantallas en
  // un predio comparten la renta), {nombre,...} da de alta uno nuevo.
  predio: { id: string } | { nombre: string; direccion?: string | null; lat?: number | null; lng?: number | null; tipoUbicacion?: string | null }
  contrato: {
    fechaInicio: string; fechaFin: string; montoRenta: number; periodicidad: string
    moneda?: string; autoRenovable?: boolean; documentoUrl?: string | null
  }
  // {id} asigna una pantalla que ya está en el inventario; si no, se crea una.
  sitio: { id: string } | Record<string, unknown>
}): Promise<{ sitioId: string; contratoId: string }> {
  const r = await fetch(`${API}/contratos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el contrato')
  await refrescarEstado()
  return { sitioId: d.sitio?.id, contratoId: d.contrato?.id }
}

// Cuelga una pantalla de un predio que YA tiene contrato: no se firma otro
// (la renta del predio es una sola y se reparte entre sus pantallas).
export async function agregarPantallaAPredioApi(
  predioId: string,
  sitio: Record<string, unknown>,
): Promise<{ sitioId: string }> {
  const r = await fetch(`${API}/predios/${predioId}/pantallas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sitio),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo agregar la pantalla al predio')
  await refrescarEstado()
  return { sitioId: d.sitioId }
}

// Registra el pago. Opcionalmente con fecha, método y adjuntos de una vez.
export async function registrarPagoRentaApi(
  pagoId: string,
  datos?: {
    fechaPago?: string | null; metodoPago?: string | null
    facturaUrl?: string | null; comprobanteUrl?: string | null; observaciones?: string | null
  },
): Promise<void> {
  const r = await fetch(`${API}/pagos-renta/${pagoId}/pagar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos ?? {}),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar el pago')
  await refrescarEstado()
}

// Adjunta/reemplaza factura y comprobante de un pago YA registrado (la factura
// suele llegar después). No re-sella el pago. `null` borra el adjunto.
export async function adjuntarAPagoApi(
  pagoId: string,
  datos: { facturaUrl?: string | null; comprobanteUrl?: string | null; observaciones?: string | null },
): Promise<void> {
  const r = await fetch(`${API}/pagos-renta/${pagoId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudieron guardar los adjuntos')
  await refrescarEstado()
}

// Liga para abrir un adjunto (no viaja en el estado; se sirve por su ruta).
export function urlAdjuntoPago(pagoId: string, tipo: 'factura' | 'comprobante'): string {
  return `${API}/pagos-renta/${pagoId}/adjunto/${tipo}/`
}

export async function iniciarRenovacionApi(contratoId: string): Promise<void> {
  const r = await fetch(`${API}/contratos/${contratoId}/renovar/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo iniciar la renovación')
  await refrescarEstado()
}

// Edita un contrato. Es también la vía por la que se COMPLETA uno INCOMPLETO
// (ADR 0001): se le fijan arrendador, importe, periodicidad y fecha de fin, y el
// servidor recalcula el estatus por fechas al guardarlos.
//
// La ruta trata este PATCH como cambio sensible y, si el contrato está
// incompleto, en modo estricto: puede responder 403 pidiendo desbloquear la
// sesión desde la barra superior. Ese mensaje viene del servidor y se propaga
// tal cual —no se reescribe aquí— para que quien lo lea sepa qué hacer.
// Cambio MASIVO de la renta, un contrato por elemento. Mismo patrón que
// `actualizarTarifasApi`: PATCH en paralelo y UN solo refresco al final, no uno
// por contrato.
//
// El llamador debe mandar contratos DEDUPLICADOS. No es un detalle de eficiencia:
// varias pantallas de un mismo predio comparten UN contrato, así que mandar uno
// por pantalla escribiría el mismo importe N veces y contaría N éxitos donde
// hubo un solo cambio — el resumen mentiría sobre cuánto se tocó.
//
// Cada PATCH pasa por el guard de cambio sensible y deja su propia entrada en la
// bitácora, que para un cambio de dinero es lo que se quiere. Si alguno falla
// (p. ej. expiró el desbloqueo a media tanda) el resto sí se aplica: se devuelve
// la cuenta para poder decirlo.
export async function actualizarRentasApi(
  items: { contratoId: string; montoRenta: number }[],
): Promise<{ ok: number; fallidas: number }> {
  const res = await Promise.allSettled(
    items.map((it) =>
      fetch(`${API}/contratos/${it.contratoId}/`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ montoRenta: it.montoRenta }),
      }).then((r) => {
        if (!r.ok) throw new Error('patch falló')
      }),
    ),
  )
  const ok = res.filter((r) => r.status === 'fulfilled').length
  await refrescarEstado()
  return { ok, fallidas: items.length - ok }
}

export async function editarContratoApi(
  contratoId: string,
  patch: {
    arrendadorId?: string
    montoRenta?: number
    periodicidad?: string
    fechaInicio?: string
    fechaFin?: string
    moneda?: string
    autoRenovable?: boolean
    razonSocialId?: string | null
    deposito?: number | null
    documentoUrl?: string | null
  },
): Promise<void> {
  const r = await fetch(`${API}/contratos/${contratoId}/`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar el contrato')
  await refrescarEstado()
}

export async function reportarIncidenciaApi(input: {
  sitioId: string; tipo: string; descripcion: string
}): Promise<void> {
  const r = await fetch(`${API}/incidencias/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo reportar la incidencia')
  await refrescarEstado()
}

// ─── Imprenta (órdenes de impresión + OC) ───────────────────────────────────
export async function crearOrdenImpresionApi(input: {
  campanaId: string; sitioId?: string | null; material?: string
  alto?: number; ancho?: number; proveedor?: string
}): Promise<void> {
  const r = await fetch(`${API}/impresion/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la orden de impresión')
  await refrescarEstado()
}

// Probatorio: aprobar la prueba de color de una orden de impresión.
export async function aprobarPruebaColorApi(id: string, aprobada: boolean): Promise<void> {
  const r = await fetch(`${API}/impresion/${id}/prueba-color/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobada }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la prueba de color')
  await refrescarEstado()
}

export async function avanzarOrdenImpresionApi(id: string): Promise<void> {
  const r = await fetch(`${API}/impresion/${id}/`, { method: 'PATCH' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo avanzar la orden')
  await refrescarEstado()
}

// Registra una Orden de Compra (ODC) del cliente como entidad real y abre el
// candado de facturación (oc_recibida). Reemplaza a marcarOCApi en el flujo.
export async function crearOrdenCompraApi(input: {
  campanaId: string; numeroOc?: string | null; monto?: number | null
  fecha?: string | null; documentoUrl?: string | null; notas?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/ordenes-compra/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la ODC')
  await refrescarEstado()
}

// Adjunta (o quita) el contrato firmado del cliente al expediente de la campaña.
export async function subirContratoCampanaApi(campanaId: string, contratoUrl: string | null): Promise<void> {
  const r = await fetch(`${API}/campanas/${campanaId}/contrato/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contratoUrl }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo adjuntar el contrato')
  await refrescarEstado()
}

export async function marcarOCApi(campanaId: string, ocUrl?: string): Promise<void> {
  const r = await fetch(`${API}/campanas/${campanaId}/oc/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocUrl: ocUrl ?? null }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la OC')
  await refrescarEstado()
}

// ─── Finanzas (facturación + cobranza) ──────────────────────────────────────
export interface PlanCuotasApi {
  periodicidad: 'QUINCENAL' | 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
  primerVencimiento: string
}

export async function generarFacturaApi(
  campanaId: string,
  plazoDias: 60 | 90 | 120,
  plan?: PlanCuotasApi | null,
): Promise<void> {
  const r = await fetch(`${API}/campanas/${campanaId}/facturar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plazoDias, plan: plan ?? null }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo generar la factura')
  await refrescarEstado()
}

export async function pagarCobranzaApi(cobranzaId: string, monto?: number): Promise<void> {
  const r = await fetch(`${API}/cobranzas/${cobranzaId}/pagar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto: monto ?? null }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar el pago')
  await refrescarEstado()
}

// Envía un recordatorio de cobro manual (notificación in-app al equipo).
export async function recordarCobranzaApi(cobranzaId: string): Promise<void> {
  const r = await fetch(`${API}/cobranzas/${cobranzaId}/recordar/`, { method: 'POST' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo enviar el recordatorio')
  await refrescarEstado()
}

// ─── Operaciones (OT + evidencias/testigos) ─────────────────────────────────
export async function crearOTApi(input: {
  tipo: string; sitioId?: string | null; campanaId?: string | null
  descripcion: string; prioridad?: string; asignadoA?: string | null
  fechaProgramada: string; checklist?: unknown[]
}): Promise<void> {
  const r = await fetch(`${API}/ot/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la OT')
  await refrescarEstado()
}

// Cierre desde la vista móvil (standalone): no refresca el store del shell.
export async function getOTApi(id: string) {
  const r = await fetch(`${API}/ot/${id}/`, { cache: 'no-store' })
  if (!r.ok) return null
  return r.json()
}
export async function cerrarOTApi(
  id: string,
  input: { fotoUrl: string; tomadaEn?: string; lat?: number; lng?: number },
): Promise<void> {
  const r = await fetch(`${API}/ot/${id}/cerrar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo cerrar la OT')
}

// ─── Creativos ──────────────────────────────────────────────────────────────
export async function crearCreatividadApi(input: {
  campanaId: string
  nombre: string
  archivoUrl?: string | null
  codigo?: string | null
  formato?: string | null
  resolucion?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/creatividades/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo subir el creativo')
  await refrescarEstado()
}

export async function validarCreatividadApi(
  id: string,
  aprobar: boolean,
  motivo?: string,
): Promise<void> {
  const r = await fetch(`${API}/creatividades/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobar, motivo }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo validar el creativo')
  await refrescarEstado()
}

// Elimina un creativo (y lo retira de DOOHmain si aplica). Devuelve la respuesta
// (incluye el resultado del retiro en `doohmain`).
export async function eliminarCreatividadApi(id: string): Promise<any> {
  const r = await fetch(`${API}/creatividades/${id}/`, { method: 'DELETE' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo eliminar el creativo')
  await refrescarEstado()
  return d
}

// Reemplaza el arte de un creativo (retira el anterior de DOOHmain y lo deja
// PENDIENTE para re-validar). Devuelve la respuesta.
export async function reemplazarCreatividadApi(
  id: string,
  input: { nombre?: string | null; archivoUrl?: string | null; codigo?: string | null; formato?: string | null },
): Promise<any> {
  const r = await fetch(`${API}/creatividades/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo reemplazar el creativo')
  await refrescarEstado()
  return d
}

export async function asignarCreativosApi(
  reservaId: string,
  creativos: { creatividadId: string; veces: number }[],
): Promise<void> {
  const r = await fetch(`${API}/reservas/${reservaId}/creativo/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativos }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo asignar el creativo')
  await refrescarEstado()
}

export interface ResultadoReparto {
  asignadas: number
  omitidasPorTenerYa: number
  sinSlots: string[]
}

// Reparte los creativos elegidos entre TODAS las pantallas digitales de la
// campaña, en una sola llamada. El orden de `creatividadIds` manda: cuando los
// spots no dividen exacto, el resto va a los primeros.
export async function repartirCreativosApi(
  campanaId: string,
  creatividadIds: string[],
  soloVacias: boolean,
): Promise<ResultadoReparto> {
  const r = await fetch(`${API}/campanas/${campanaId}/creativos/repartir/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creatividadIds, soloVacias }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudieron repartir los creativos')
  await refrescarEstado()
  return d as ResultadoReparto
}

export async function reservarApi(input: {
  campanaId?: string
  clienteNombre?: string
  nombreCampana?: string
  sitioIds: string[]
  fechaInicio: string
  fechaFin: string
  tipoCampana?: 'OOH' | 'DOOH' | 'HIBRIDA'
  spotsPorSitio?: Record<string, number>
}): Promise<Campana> {
  const r = await fetch(`${API}/reservar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo reservar')
  await refrescarEstado()
  return d
}

export async function confirmarReservaApi(campanaId: string): Promise<Campana> {
  const r = await fetch(`${API}/campanas/${campanaId}/confirmar/`, { method: 'POST' })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo confirmar')
  await refrescarEstado()
  return d
}

// ─── Validación de publicación ───────────────────────────────────────────────
// Envía la campaña al dominio/CMS (queda pendiente de validar la publicación).
export async function enviarADominioApi(campanaId: string): Promise<Campana> {
  const r = await fetch(`${API}/campanas/${campanaId}/enviar-dominio/`, { method: 'POST' })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo enviar al dominio')
  await refrescarEstado()
  return d
}

// Valida la publicación: aprobar (→ ACTIVA / al aire) o rechazar (con motivo).
export async function validarPublicacionApi(
  campanaId: string,
  aprobar: boolean,
  motivo?: string,
): Promise<Campana> {
  const r = await fetch(`${API}/campanas/${campanaId}/validar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobar, motivo }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo validar la publicación')
  await refrescarEstado()
  return d
}

export async function extenderCampanaApi(campanaId: string, fechaFin: string): Promise<Campana> {
  const r = await fetch(`${API}/campanas/${campanaId}/extender/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fechaFin }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo extender')
  await refrescarEstado()
  return d
}

// ─── Licencias y permisos ───────────────────────────────────────────────────
export async function crearLicenciaApi(input: {
  predioId?: string | null; sitioId?: string | null; tipo: string
  folio?: string | null; autoridad?: string | null
  fechaExpedicion?: string | null; fechaVencimiento: string; notas?: string | null
}): Promise<void> {
  const r = await fetch(`${API}/licencias/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la licencia')
  await refrescarEstado()
}

export async function editarLicenciaApi(id: string, cambios: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${API}/licencias/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar la licencia')
  await refrescarEstado()
}

export async function borrarLicenciaApi(id: string): Promise<void> {
  const r = await fetch(`${API}/licencias/${id}/`, { method: 'DELETE' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo borrar la licencia')
  await refrescarEstado()
}

// ─── Razones sociales del arrendador ────────────────────────────────────────
// Una razón social es a nombre de QUIÉN factura el arrendador. Un mismo
// arrendador puede tener varias (p. ej. una por inmueble), y el contrato ancla
// la suya.

// Devuelve cuántos contratos SIN razón social adoptó el alta. Si el arrendador
// no tenía ninguna —el caso normal cuando sus pantallas entraron por importación
// masiva—, sus contratos nacieron huérfanos y esta alta es la que los reclama.
// El número se devuelve para poder DECIRLO: reatribuir contratos en silencio es
// un cambio de dato fiscal que nadie pidió explícitamente.
export async function crearRazonSocialApi(input: {
  arrendadorId: string
  razonSocial: string
  rfc?: string | null
  regimen?: string | null
}): Promise<{ contratosAdoptados: number }> {
  const r = await fetch(`${API}/razones-sociales/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear la razón social')
  await refrescarEstado()
  return { contratosAdoptados: Number(d?.contratosAdoptados ?? 0) }
}

// Solo se mandan los campos presentes: así se puede COMPLETAR uno (el RFC que
// faltaba) sin reescribir los demás.
export async function editarRazonSocialApi(
  id: string,
  input: { razonSocial?: string; rfc?: string | null; regimen?: string | null },
): Promise<void> {
  const r = await fetch(`${API}/razones-sociales/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo actualizar la razón social')
  await refrescarEstado()
}

export async function borrarRazonSocialApi(id: string): Promise<void> {
  const r = await fetch(`${API}/razones-sociales/${id}/`, { method: 'DELETE' })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo eliminar la razón social')
  await refrescarEstado()
}
