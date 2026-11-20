import 'server-only'
import { estadoDelModulo, deteccionesDeCampanas, MAX_DETECCIONES_REPORTE } from '@/lib/server/space-eye'
import { listarSitios } from '@/lib/server/sitios-repo'
import { zonaDelNegocio } from '@/lib/propuesta-vigencia'
import type { Idioma } from '@/lib/i18n/idiomas'
import {
  rangoDelReporte,
  limitesUTC,
  armarDetecciones,
  construirLibroDetecciones,
  deteccionesDeDemostracion,
  nombreArchivoReporte,
} from '@/lib/space-eyes-reporte-campanas'

// ============================================================================
//  El reporte en Excel de Space Eyes → Campañas: lo que los equipos detectaron.
// ----------------------------------------------------------------------------
//  POR QUÉ EN EL SERVIDOR y no con lo que la pantalla ya tiene cargado. La
//  pantalla solo tiene la LISTA de campañas con un conteo de fotos; las
//  detecciones una por una no las carga nunca, y pedirlas desde el navegador
//  serían decenas de vueltas por la puerta `/api/space-eyes/se/...` (Space Eye
//  pagina, y su `total` no sirve para saber cuándo parar: ver
//  `deteccionesDeCampanas`). Aquí, además, se sabe lo que el navegador no:
//  la zona del negocio (`TZ`), si la instancia tiene Space Eye o le toca la
//  demostración, y los nombres de los sitios del tenant.
//
//  DE DÓNDE SALEN LOS DATOS, con el mismo criterio que el layout del módulo
//  (`app/(app)/(shell)/space-eyes/layout.tsx`):
//    · 'no_contratado' (sin SPACE_EYE_BASE_URL/SPACE_EYE_KEY, o la licencia lo
//      apaga) → la DEMOSTRACIÓN, y la hoja lo dice en mayúsculas;
//    · 'sin_respuesta' → 503: un Excel vacío diría «no se detectó nada», que es
//      mentira;
//    · 'activo' → Space Eye de verdad.
//
//  Sin SQL nuevo: el sitio de cada equipo sale de `listarSitios()` (el mismo
//  emparejamiento de siempre, `sitios.codigo_proveedor == billboard_code`).
// ============================================================================

export type ResultadoReporte =
  | { ok: true; bytes: Uint8Array; nombre: string; demostracion: boolean }
  | { ok: false; status: number; error: string }

function idPositivo(v: string | null | undefined): number | null | false {
  if (v == null || v.trim() === '') return null
  return /^\d{1,9}$/.test(v.trim()) && Number(v) > 0 ? Number(v) : false
}

export async function reporteDeCampanasDetectadas(p: {
  desde?: string | null
  hasta?: string | null
  equipo?: string | null
  campana?: string | null
  idioma: Idioma
  ahora?: Date
}): Promise<ResultadoReporte> {
  const ahora = p.ahora ?? new Date()
  const zona = zonaDelNegocio()
  const rango = rangoDelReporte({ desde: p.desde, hasta: p.hasta }, ahora, zona)
  if (!rango.ok) return { ok: false, status: 400, error: rango.error }
  const equipo = idPositivo(p.equipo)
  const campana = idPositivo(p.campana)
  if (equipo === false || campana === false) return { ok: false, status: 400, error: 'Equipo o campaña no válidos' }

  const estado = await estadoDelModulo()
  if (estado === 'sin_respuesta') {
    return { ok: false, status: 503, error: 'Space Eye no responde ahora; inténtalo en unos minutos' }
  }
  const demostracion = estado === 'no_contratado'

  let datos: Awaited<ReturnType<typeof deteccionesDeCampanas>>
  let sitiosPorCodigo = new Map<string, string>()
  if (demostracion) {
    datos = { ...deteccionesDeDemostracion(rango, zona, p.idioma, ahora, { equipo, campana }), truncado: false }
  } else {
    try {
      datos = await deteccionesDeCampanas({ ...limitesUTC(rango, zona), equipo, campana })
    } catch {
      return { ok: false, status: 502, error: 'No se pudo hablar con Space Eye' }
    }
    // El sitio es un dato de cortesía: si no se puede leer, el reporte sale sin
    // esa columna llena en vez de no salir.
    try {
      for (const s of await listarSitios()) {
        const c = String(s.codigoProveedor ?? '').trim().toLowerCase()
        if (c) sitiosPorCodigo.set(c, String(s.nombre ?? ''))
      }
    } catch {
      sitiosPorCodigo = new Map()
    }
  }

  const filas = armarDetecciones(datos.fotos, { campanas: datos.campanas, equipos: datos.equipos, sitiosPorCodigo, zona })
  const bytes = construirLibroDetecciones({
    filas,
    rango,
    ahora,
    zona,
    idioma: p.idioma,
    demostracion,
    truncado: datos.truncado,
    maximo: MAX_DETECCIONES_REPORTE,
    filtros: {
      equipo: equipo ? (datos.equipos.find((e) => e.id === equipo)?.name ?? `#${equipo}`) : undefined,
      campana: campana ? (datos.campanas.find((c) => c.id === campana)?.name ?? `#${campana}`) : undefined,
    },
  })
  return { ok: true, bytes, nombre: nombreArchivoReporte(rango, demostracion), demostracion }
}
