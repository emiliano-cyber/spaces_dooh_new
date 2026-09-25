'use client'

import type { Sitio, ImportSummary } from './types'
import { refrescarEstado } from './estado-api'
import { esErrorDeDesbloqueo } from '@/lib/cambios-candado'
import type { ResultadoLote } from '@/lib/cambios-lote'

// ============================================================================
//  lib/data/sitios-api.ts — Sitios contra la BD (route handlers /api/sitios).
//  Tras cada escritura refresca el ESTADO completo (sitios + campañas + …) para
//  que mapa, lista, network y dashboard reaccionen. basePath + trailingSlash.
// ============================================================================

const BASE = '/spaces-dooh/api/sitios'

// Refresco: recarga todo el estado persistido al store.
export const refrescarSitios = refrescarEstado

export async function altaSitioApi(input: unknown): Promise<Sitio> {
  const r = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el sitio')
  await refrescarSitios()
  return d
}

export async function importarSitiosApi(args: {
  filas: unknown[]
  // Arrendador dueño de todas las pantallas del archivo (ADR 0002).
  arrendadorId: string
  // Opcional: todas en el mismo predio. Existente o nuevo (ADR 0004).
  predio?: { id: string } | { nombre: string; direccion?: string | null } | null
  modoDuplicado: 'ACTUALIZAR' | 'NUEVA_VERSION'
  precioM2: number | null
  // Imágenes por código de proveedor (clave en minúsculas) → data URL base64.
  imagenes?: Record<string, string>
}): Promise<ImportSummary> {
  const r = await fetch(`${BASE}/import/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  // .catch evita "Unexpected end of JSON input" si el server respondió vacío (500).
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as any).error ?? 'No se pudo importar')
  await refrescarSitios()
  return d
}

export async function toggleNetworkApi(id: string): Promise<void> {
  await fetch(`${BASE}/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toggleNetwork: true }),
  })
  await refrescarSitios()
}

// B38 · ESTE `r.ok` NO SE BORRA, y conviene saber por qué.
//
// Hasta el 2026-09-25 esta función hacía `await fetch(...)` a secas y no miraba
// la respuesta. Un 403 del control de cambios —`PATCH /api/sitios/:id` lo exige
// cuando el cuerpo trae tarifa, costo, arrendador o predio
// (`app/api/sitios/[id]/route.ts:15-19`)— se RESOLVÍA como si hubiera guardado.
// No es que el mensaje se perdiera: la celda del inventario cantaba «Tarifa de
// "X" actualizada» con la tarifa intacta. Callarse es malo; mentir es peor,
// porque nadie va a comprobar lo que la pantalla acaba de dar por hecho.
//
// El mensaje se devuelve TAL CUAL lo manda el servidor porque el candado lo
// reconoce por texto (`lib/cambios-candado.ts`, `esErrorDeDesbloqueo`): si aquí
// se sustituyera por uno propio, el 403 volvería a pintarse como error rojo y
// no abriría el cuadro con el campo.
export async function actualizarSitioApi(id: string, cambios: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${BASE}/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo guardar la pantalla')
  }
  await refrescarSitios()
}

// Cambio MASIVO de tarifa: aplica una tarifa nueva a varios sitios a la vez
// (mantiene sincronizadas mensual y publicada, igual que la ficha). Hace los
// PATCH en paralelo y refresca el estado UNA sola vez al final (no por sitio).
// B38 · devuelve además QUÉ quedó sin aplicar y SI fue por el candado.
//
// `ok`/`fallidas` siguen ahí para quien solo cuente. Lo que se añadió es lo que
// hace posible la política del lote (`lib/cambios-lote.ts`): antes cada fallo se
// convertía en un `Error('patch falló')` idéntico para todos, así que era
// imposible distinguir «el servidor pide la contraseña» de «se cayó la base», y
// también imposible saber CUÁLES habían quedado fuera para reintentar solo esas.
// El mensaje del servidor se conserva tal cual, que es como lo reconoce
// `esErrorDeDesbloqueo`.
export async function actualizarTarifasApi(
  items: { id: string; tarifa: number }[],
): Promise<ResultadoLote<{ id: string; tarifa: number }>> {
  const res = await Promise.allSettled(
    items.map((it) =>
      fetch(`${BASE}/${it.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarifaMensual: it.tarifa, tarifaPublicada: it.tarifa }),
      }).then(async (r) => {
        if (r.ok) return
        const d = await r.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'No se pudo guardar la pantalla')
      }),
    ),
  )
  const ok = res.filter((r) => r.status === 'fulfilled').length
  await refrescarSitios()
  return {
    ok,
    fallidas: items.length - ok,
    pendientes: items.filter((_, i) => res[i].status === 'rejected'),
    requiereDesbloqueo: res.some((r) => r.status === 'rejected' && esErrorDeDesbloqueo(r.reason)),
  }
}

// B38 · mismo arreglo que `actualizarSitioApi`, y aquí era todavía más mudo:
// `DELETE /api/sitios/:id` exige desbloqueo SIEMPRE
// (`app/api/sitios/[id]/route.ts:47-48`), y esta función ni miraba `r.ok`. El
// 403 no llegaba al `catch` de la ficha, así que el `toast.error` que la ficha
// tenía escrito no se disparaba nunca: la pantalla seguía ahí y nadie decía nada.
export async function borrarSitioApi(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}/`, { method: 'DELETE' })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo eliminar la pantalla')
  }
  await refrescarSitios()
}

// Pausa legal: saca la pantalla de la disponibilidad comercial con un motivo.
export async function pausarSitioLegalApi(id: string, motivo: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}/pausa-legal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo pausar')
  }
  await refrescarSitios()
}

export async function reanudarSitioLegalApi(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}/pausa-legal/`, { method: 'DELETE' })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as { error?: string }).error ?? 'No se pudo reanudar')
  }
  await refrescarSitios()
}

// Reubica la pantalla a otro predio y dispara una OT de reubicación.
export async function reubicarSitioApi(id: string, predioId: string): Promise<{ otFolio: string | null }> {
  const r = await fetch(`${BASE}/${id}/reubicar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ predioId }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo reubicar')
  await refrescarSitios()
  return d as { otFolio: string | null }
}
