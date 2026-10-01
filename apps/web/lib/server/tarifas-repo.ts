import 'server-only'
import { q } from './db'
import { tenantActual } from './tenant'
import type { SitioTarifable } from '@/lib/tarifa-calculada'
import type { Temporada } from '@/lib/rejilla'

// ============================================================================
//  lib/server/tarifas-repo.ts — Lo que el SERVIDOR necesita para calcular la
//  tarifa de cada línea de una propuesta.  PRECIO-01 (hallazgo B40).
// ----------------------------------------------------------------------------
//  La cuenta vive en `lib/tarifa-calculada.ts`, la misma que usa la pantalla.
//  Aquí solo se leen los datos, con la MISMA forma que la pantalla recibe de
//  `rowToSitio` (`sitios-repo.ts`): si la forma divergiera, divergiría el
//  precio, y el vendedor recibiría un «solo un gerente puede cambiar la
//  tarifa» sin haber cambiado nada.
//
//  ─── R2 · LA SEGUNDA CAPA AQUÍ NO ES DECORADO ─────────────────────────────
//  Todo corre por `q`, o sea bajo RLS con el tenant de la sesión, Y cada
//  consulta lleva además `and tenant_id = $n`. El modo de fallo de R2 no da
//  error: cero filas de rejilla no se lee como «error», se lee como «esta
//  pantalla se vende a su tarifa base». Con esta doble capa, una pantalla de
//  otra organización simplemente NO APARECE, y entonces no tiene tarifa
//  calculable: un vendedor no la puede tarifar, y la tarifa nunca sale de los
//  datos de otro.
// ============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DatosParaTarifar = {
  /** Por id de pantalla. Una pantalla ausente es una pantalla sin tarifa. */
  sitios: Map<string, SitioTarifable & { nombre: string }>
  /** Las temporadas ACTIVAS, en el mismo orden que `listarTemporadas()`. */
  temporadas: Temporada[]
}

/**
 * Pantallas, modalidades, rejilla y temporadas, en CUATRO consultas para toda
 * la propuesta y no cuatro por línea.
 *
 * Los ids que no son un uuid se descartan ANTES de la consulta: un
 * `any($1::uuid[])` con un texto cualquiera revienta con un 500, y una pantalla
 * que no existe ya tiene su respuesta —«no tiene tarifa»— sin preguntarle a la
 * base.
 */
export async function datosParaTarifar(sitioIds: string[]): Promise<DatosParaTarifar> {
  const tenant = await tenantActual()
  const ids = [...new Set(sitioIds.filter((s) => UUID_RE.test(s)))]
  // Mismo `where activo` y mismo orden que `listarTemporadas()` de
  // `rejilla-repo.ts`, que es de donde la pantalla saca las suyas: con el
  // solape prohibido no puede haber dos que cubran una fecha, pero si datos
  // viejos las trajeran, tiene que ganar la misma en los dos lados.
  const temporadas = (
    await q<any>(
      `select id, nombre, to_char(desde,'YYYY-MM-DD') as desde, to_char(hasta,'YYYY-MM-DD') as hasta
         from temporadas
        where activo = true and tenant_id = $1
        order by desde asc, nombre asc`,
      [tenant],
    )
  ).map((t) => ({ id: String(t.id), nombre: String(t.nombre), desde: String(t.desde), hasta: String(t.hasta) }))

  const sitios = new Map<string, SitioTarifable & { nombre: string }>()
  if (!ids.length) return { sitios, temporadas }

  const filas = await q<any>(
    `select id, nombre, tarifa_publicada, tarifa_mensual
       from sitios where id = any($1::uuid[]) and tenant_id = $2`,
    [ids, tenant],
  )
  const mods = await q<any>(
    `select sitio_id, unidad, tarifa_publicada
       from sitio_modalidades where sitio_id = any($1::uuid[]) and tenant_id = $2`,
    [ids, tenant],
  )
  const rej = await q<any>(
    `select sitio_id, unidad, franja_id, temporada_id, tarifa_publicada
       from sitio_tarifas where sitio_id = any($1::uuid[]) and tenant_id = $2`,
    [ids, tenant],
  )
  // `numeric` llega como cadena: se convierte igual que `rowToSitio` (`n(x) ?? 0`).
  const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v))
  for (const s of filas) {
    sitios.set(String(s.id), {
      nombre: String(s.nombre ?? s.id),
      tarifaPublicada: num(s.tarifa_publicada),
      tarifaMensual: num(s.tarifa_mensual),
      modalidadesDetalle: mods
        .filter((m) => String(m.sitio_id) === String(s.id))
        .map((m) => ({ unidad: String(m.unidad), tarifaPublicada: num(m.tarifa_publicada) })),
      rejilla: rej
        .filter((t) => String(t.sitio_id) === String(s.id))
        .map((t) => ({
          unidad: String(t.unidad),
          franjaId: t.franja_id ?? null,
          temporadaId: t.temporada_id ?? null,
          tarifa: num(t.tarifa_publicada),
        })),
    })
  }
  return { sitios, temporadas }
}
