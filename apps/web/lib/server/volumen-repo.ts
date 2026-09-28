import 'server-only'
import { q, q1 } from './db'
import { tenantActual } from './tenant'
import type { TramoVolumen } from '@/lib/volumen'

// ============================================================================
//  lib/server/volumen-repo.ts — La escala de descuento por volumen de la
//  organización.  ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL vive
//  aquí, siempre parametrizado, y toda operación por `id` lleva
//  `and tenant_id = $n` como segunda capa sobre la RLS.
//
//  POR QUÉ ESA SEGUNDA CAPA IMPORTA ESPECIALMENTE AQUÍ. El modo de fallo de R2
//  no da error: una lectura sin contexto de tenant devuelve cero filas en
//  silencio, y cero tramos no significa «error», significa «esta organización
//  no descuenta por volumen». Nadie ve un fallo; se ve una venta más cara, y
//  quien la pierde no vuelve a preguntar por qué. Es el mismo molde que los dos
//  peores fallos de aislamiento del proyecto.
//
//  EL BORRADO ES REAL, y es lo contrario de lo que hace `rejilla-repo.ts`. Allí
//  la baja es lógica porque `propuesta_items_franja_fkey` es `on delete
//  restrict`: una franja contratada es un hecho. Aquí NADA referencia un tramo
//  —el ítem copia el porcentaje y el umbral, no apunta a la fila—, así que
//  borrar no pierde historia, y en cambio una baja lógica sobre una tabla con
//  `unique (tenant_id, unidad, desde_cantidad)` impediría volver a crear el
//  tramo de 50 mientras existiera el de 50 apagado.
// ============================================================================

export type TramoFila = TramoVolumen & { id: string }

// `pg` devuelve `numeric` como CADENA ('10.00') e `integer` como número. Sin
// esta conversión, `descuentoPct` llegaría al cálculo del precio como texto y
// `1 - '10.00'/100` funcionaría por coerción… hasta el primer sitio que use
// `===` o que lo compare con otro número.
const aTramo = (r: any): TramoFila => ({
  id: String(r.id),
  unidad: String(r.unidad),
  desdeCantidad: Number(r.desde_cantidad),
  descuentoPct: Number(r.descuento_pct),
})

/**
 * Los tramos de volumen de la organización, ordenados por unidad y umbral.
 *
 * NO acepta ningún argumento, y eso es el candado: el tenant sale de la RLS,
 * que la fija `db.ts` con el de la sesión. Si aceptara un `tenantId` se podría
 * leer la política comercial de otra organización, y eso además de una fuga
 * sería un precio ajeno aplicado a una venta propia.
 *
 * El orden lo sirve entero el índice único. Se pide explícito igual que en
 * `rejillaDeSitio`: sin `order by`, Postgres puede devolver otro orden el día
 * que el plan cambie, y aunque `resolverVolumen` no depende del orden, la
 * pantalla de captura sí — una escala que se reordena sola se lee como un fallo.
 */
export async function listarEscalasVolumen(): Promise<TramoFila[]> {
  const filas = await q<any>(
    `select id, unidad, desde_cantidad, descuento_pct
       from escalas_volumen
      order by unidad asc, desde_cantidad asc`,
  )
  return filas.map(aTramo)
}

/**
 * Alta o edición de un tramo. Devuelve `null` si el `id` no es de esta
 * organización — que es lo mismo que «no existe» desde aquí dentro, y por eso
 * el controller lo convierte en 404 y no en 403: decir «existe pero no es tuyo»
 * ya es contar algo de otra organización.
 *
 * El `tenant_id` sale SIEMPRE de `tenantActual()`, nunca del argumento: si
 * viajara en el cuerpo, cualquiera podría escribir la escala de otra
 * organización con un `curl`, y la fila escrita sería coherente consigo misma,
 * así que el `with check` de la RLS la aprobaría sin rechistar.
 *
 * La validación de formato, de umbral repetido y de MONOTONÍA vive en
 * `lib/volumen.ts` y la aplica el controller antes de llegar aquí. No se
 * duplica: dos copias de esa regla divergen, y aquí divergir significa una
 * escala en la que comprar más sale más caro.
 */
export async function guardarTramoVolumen(t: {
  id?: string
  unidad: string
  desdeCantidad: number
  descuentoPct: number
}): Promise<TramoFila | null> {
  const tenant = await tenantActual()
  const SEL = 'id, unidad, desde_cantidad, descuento_pct'
  if (t.id) {
    const fila = await q1<any>(
      `update escalas_volumen
          set unidad = $3, desde_cantidad = $4, descuento_pct = $5
        where id = $1 and tenant_id = $2
        returning ${SEL}`,
      [t.id, tenant, t.unidad, t.desdeCantidad, t.descuentoPct],
    )
    return fila ? aTramo(fila) : null
  }
  const fila = await q1<any>(
    `insert into escalas_volumen (tenant_id, unidad, desde_cantidad, descuento_pct)
     values ($1,$2,$3,$4) returning ${SEL}`,
    [tenant, t.unidad, t.desdeCantidad, t.descuentoPct],
  )
  return fila ? aTramo(fila) : null
}

/**
 * Borra un tramo. `false` = no existe en esta organización.
 *
 * Borrado REAL, no lógico. Ver la cabecera del archivo: nada referencia un
 * tramo, y el porcentaje que se aplicó ya está copiado en cada
 * `propuesta_items.descuento_volumen_pct`, así que ninguna venta se mueve al
 * borrarlo — ni la ya capturada, ni la ya aprobada, que además está congelada
 * en el snapshot.
 */
export async function borrarTramoVolumen(id: string): Promise<boolean> {
  const tenant = await tenantActual()
  const fila = await q1<any>(
    'delete from escalas_volumen where id = $1 and tenant_id = $2 returning id',
    [id, tenant],
  )
  return !!fila
}
