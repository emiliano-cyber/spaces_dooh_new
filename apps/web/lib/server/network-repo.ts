import 'server-only'
import { qRaw, qConTenant } from './db'
import { periodosLibres, capacidadDe, type Periodo, type ReservaOcupa } from './network-disponibilidad'

// ============================================================================
//  lib/server/network-repo.ts — lo que la nueva app de Network ve de esta
//  instancia (decidido por el dueño el 11/11).
// ----------------------------------------------------------------------------
//  El switch «En la Network» de cada pantalla (`sitios.en_network`) existía
//  desde junio pero nadie de fuera lo leía. Esto es lo que lo vuelve real: una
//  pantalla con el switch encendido aparece aquí, con su ficha pública y sus
//  días libres; con el switch apagado NO existe para la app.
//
//  ─── Por qué se recorren las organizaciones una a una ─────────────────────
//  Quien pregunta es la app (token), no un usuario: no hay sesión ni tenant.
//  `sitios` y `reservas` tienen RLS fail-closed, así que un `qRaw` devolvería
//  CERO filas sin error —el modo de fallo R2—. Se lee la lista de `tenants`
//  (exenta de RLS) y se consulta cada una con `qConTenant`, más
//  `and tenant_id = $1` como segunda capa.
//
//  ─── Lo que NO sale, y es lo importante ───────────────────────────────────
//  Ni costo de compra, ni tarifa interna/mensual, ni impresión, ni precio por
//  m², ni notas, ni arrendador, ni contrato; y de las reservas solo las fechas
//  —ni campaña, ni cliente, ni precio—. Es lo mismo que `listarSitiosRed`
//  esconde a las otras organizaciones, y por la misma razón. El objeto se
//  construye CLAVE A CLAVE: una columna nueva en `sitios` no se cuela sola.
// ============================================================================

export interface EspacioNetwork {
  id: string
  organizacionId: string
  codigo: string | null
  nombre: string
  tipoMedio: string
  direccion: string | null
  ciudad: string | null
  estado: string | null
  pais: string
  lat: number | null
  lng: number | null
  ancho: number | null
  alto: number | null
  caras: number
  iluminado: boolean
  orientacion: string | null
  resolucionPx: string | null
  spotsPorHora: number | null
  duracionSpotSeg: number | null
  totalSpots: number | null
  horario: string | null
  comercializacion: string
  moneda: string
  tarifaPublicada: number | null
  modalidades: { unidad: string; tarifaPublicada: number }[]
  tieneFoto: boolean
  actualizadoEn: string
  disponibilidad: { desde: string; hasta: string; libres: Periodo[] }
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))
const fecha = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)

async function organizaciones(): Promise<{ id: string; moneda: string }[]> {
  // `tenants` está exenta de RLS: `qRaw` es lo correcto aquí, no el fallo R2.
  return qRaw<{ id: string; moneda: string }>(`select id, coalesce(moneda, 'MXN') as moneda from tenants order by id`)
}

async function sitiosEnNetwork(tenantId: string, id?: string): Promise<any[]> {
  return qConTenant(
    tenantId,
    `select s.id, s.tenant_id, s.clave_interna, s.nombre, s.tipo_medio,
            coalesce(s.direccion_comercial, s.direccion) as direccion,
            coalesce(s.ciudad, s.plaza_ciudad) as ciudad, s.estado, s.pais, s.lat, s.lng,
            s.ancho, s.alto, s.caras, s.iluminado, s.orientacion, s.resolucion_px,
            s.spots_por_hora, s.duracion_spot_seg, s.total_spots, s.horario,
            s.comercializacion, s.tarifa_publicada, s.actualizado_en,
            (pg_column_size(s.fotos) > 20 or s.imagen_promocional is not null) as tiene_foto
       from sitios s
      where s.tenant_id = $1 and s.en_network
        ${id ? 'and s.id = $2' : ''}
      order by s.nombre`,
    id ? [tenantId, id] : [tenantId],
  )
}

/** Todas las pantallas con el switch encendido, con sus días libres en el rango. */
export async function listarEspaciosNetwork(desde: string, hasta: string): Promise<EspacioNetwork[]> {
  const fuera: EspacioNetwork[] = []
  for (const org of await organizaciones()) {
    const sitios = await sitiosEnNetwork(org.id)
    if (sitios.length === 0) continue
    const ids = sitios.map((s) => s.id)

    const [mods, reservas] = await Promise.all([
      qConTenant(
        org.id,
        `select m.sitio_id, m.unidad, m.tarifa_publicada
           from sitio_modalidades m join sitios s on s.id = m.sitio_id
          where s.tenant_id = $1 and m.sitio_id = any($2::uuid[])
          order by m.unidad`,
        [org.id, ids],
      ),
      // Las MISMAS reservas que mira el alta: todas menos las canceladas
      // (`campanas-repo.ts`). Solo las que pisan el rango.
      qConTenant(
        org.id,
        `select r.sitio_id, r.campana_id, r.fecha_inicio, r.fecha_fin
           from reservas r join sitios s on s.id = r.sitio_id
          where s.tenant_id = $1 and r.sitio_id = any($2::uuid[])
            and r.estatus <> 'CANCELADA'
            and r.fecha_inicio <= $4::date and r.fecha_fin >= $3::date`,
        [org.id, ids, desde, hasta],
      ),
    ])

    const modsPor = new Map<string, { unidad: string; tarifaPublicada: number }[]>()
    for (const m of mods) {
      const l = modsPor.get(m.sitio_id) ?? []
      l.push({ unidad: m.unidad, tarifaPublicada: Number(m.tarifa_publicada) })
      modsPor.set(m.sitio_id, l)
    }
    const resPor = new Map<string, ReservaOcupa[]>()
    for (const r of reservas) {
      const l = resPor.get(r.sitio_id) ?? []
      l.push({ campanaId: r.campana_id, desde: fecha(r.fecha_inicio), hasta: fecha(r.fecha_fin) })
      resPor.set(r.sitio_id, l)
    }

    for (const s of sitios) {
      fuera.push({
        id: s.id,
        organizacionId: s.tenant_id,
        codigo: s.clave_interna ?? null,
        nombre: s.nombre,
        tipoMedio: s.tipo_medio,
        direccion: s.direccion ?? null,
        ciudad: s.ciudad ?? null,
        estado: s.estado ?? null,
        pais: s.pais,
        lat: num(s.lat),
        lng: num(s.lng),
        ancho: num(s.ancho),
        alto: num(s.alto),
        caras: Number(s.caras ?? 1),
        iluminado: !!s.iluminado,
        orientacion: s.orientacion ?? null,
        resolucionPx: s.resolucion_px ?? null,
        spotsPorHora: num(s.spots_por_hora),
        duracionSpotSeg: num(s.duracion_spot_seg),
        totalSpots: num(s.total_spots),
        horario: s.horario ?? null,
        comercializacion: s.comercializacion,
        moneda: org.moneda,
        tarifaPublicada: num(s.tarifa_publicada),
        modalidades: modsPor.get(s.id) ?? [],
        tieneFoto: !!s.tiene_foto,
        actualizadoEn: new Date(s.actualizado_en).toISOString(),
        disponibilidad: {
          desde,
          hasta,
          libres: periodosLibres(desde, hasta, resPor.get(s.id) ?? [], capacidadDe(s.tipo_medio, num(s.total_spots))),
        },
      })
    }
  }
  return fuera
}

/**
 * La foto principal de UNA pantalla en la Network: la promocional y, si no hay,
 * la primera de la galería. `null` si no existe, si tiene el switch apagado o si
 * no tiene foto — las tres se contestan igual (404) para no confirmar ids.
 */
export async function fotoDeEspacioNetwork(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  for (const org of await organizaciones()) {
    const r = (
      await qConTenant<{ fotos: string[] | null; imagen_promocional: string | null }>(
        org.id,
        `select fotos, imagen_promocional from sitios
          where tenant_id = $1 and id = $2 and en_network`,
        [org.id, id],
      )
    )[0]
    if (r) return r.imagen_promocional ?? r.fotos?.[0] ?? null
  }
  return null
}
