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

/** ADR 0042 · lo que la calculadora de spots necesita saber de una pantalla. */
export type LoopDeSitio = {
  /** `tipo_medio = 'PANTALLA_DIGITAL'`: el mismo criterio que la campaña usa para retener slots. */
  digital: boolean
  totalSpots: number | null
  duracionSpotSeg: number | null
  horario: string | null
  /** El contador guardado, `sitios.spots_disponibles`. */
  spotsDisponibles: number | null
  /** Campañas distintas con reserva vigente, igual que `listarSitios`. */
  campanasActivas: number
}

export type DatosDelLoop = {
  /** Por id de pantalla. Una pantalla ausente —de otra organización— no tiene loop. */
  sitios: Map<string, LoopDeSitio>
  /** `config_negocio.spot_seg` de ESTA organización: el respaldo de la duración. */
  spotSegOrganizacion: number | null
}

/**
 * ADR 0042 · el loop de cada pantalla de la propuesta, en DOS consultas para
 * toda la propuesta. Solo se llama si alguna línea usa la calculadora: toda la
 * base instalada cotiza sin ella y no tiene por qué pagar el viaje.
 *
 * Misma doble capa que `datosParaTarifar` (RLS + `and tenant_id`), y por lo
 * mismo: una pantalla de otra organización NO APARECE, así que no tiene loop
 * y la calculadora la rechaza. Y el conteo de campañas va también con
 * `r.tenant_id = s.tenant_id`: una reserva ajena colgada de esta pantalla no
 * puede ni ocuparla ni liberarla.
 *
 * El conteo es el de `listarSitios` (`sitios-repo.ts`) a propósito, con su
 * misma limitación: cuenta CAMPAÑAS, no slots retenidos. Así lo que el
 * servidor acepta es lo que el vendedor ve en la pantalla.
 */
export async function datosDelLoop(sitioIds: string[]): Promise<DatosDelLoop> {
  const tenant = await tenantActual()
  const ids = [...new Set(sitioIds.filter((s) => UUID_RE.test(s)))]
  const cfg = await q<any>('select spot_seg from config_negocio where tenant_id = $1', [tenant])
  const spotSegOrganizacion = cfg[0]?.spot_seg != null ? Number(cfg[0].spot_seg) : null
  const sitios = new Map<string, LoopDeSitio>()
  if (!ids.length) return { sitios, spotSegOrganizacion }
  const filas = await q<any>(
    `select s.id, (s.tipo_medio = 'PANTALLA_DIGITAL') as digital, s.total_spots, s.duracion_spot_seg,
            s.horario, s.spots_disponibles,
            (select count(distinct r.campana_id) from reservas r
              where r.sitio_id = s.id and r.tenant_id = s.tenant_id
                and r.estatus <> 'CANCELADA' and r.fecha_fin >= current_date) as campanas_activas
       from sitios s
      where s.id = any($1::uuid[]) and s.tenant_id = $2`,
    [ids, tenant],
  )
  const n = (v: unknown) => (v == null || v === '' ? null : Number(v))
  for (const s of filas) {
    sitios.set(String(s.id), {
      digital: !!s.digital,
      totalSpots: n(s.total_spots),
      duracionSpotSeg: n(s.duracion_spot_seg),
      horario: s.horario ?? null,
      spotsDisponibles: n(s.spots_disponibles),
      campanasActivas: Number(s.campanas_activas ?? 0),
    })
  }
  return { sitios, spotSegOrganizacion }
}
