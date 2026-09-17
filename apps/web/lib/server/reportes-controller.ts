import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { fechaZod, diaComparable } from './fechas'
import { datosRentabilidad } from './reportes-repo'
import { rentabilidadPorSitio, type ReporteRentabilidad } from '@/lib/data/reportes'

// ============================================================================
//  lib/server/reportes-controller.ts — La validación del límite.
// ----------------------------------------------------------------------------
//  `dimension` y `granularidad` acaban decidiendo POR QUÉ SE AGRUPA un reporte
//  de dinero. Por eso son ENUMS CERRADOS y se validan aquí, antes de tocar la
//  base: un agrupador que entre como texto libre es inyección por la puerta de
//  servicio, y no la ve ninguna prueba que solo mire el camino feliz.
//
//  Ni `dimension` ni `granularidad` llegan nunca al SQL. El `group by` lo hace
//  el motor puro en `lib/data/reportes.ts`, y `reportes-repo.ts` no interpola
//  nada —hay un guard que lo comprueba leyendo el archivo.
// ============================================================================

// Las cuatro dimensiones DECLARADAS. Solo `sitio` está implementada; las otras
// tres se declaran ya y devuelven 501, a propósito: el contrato del endpoint es
// lo que las pantallas consumen desde el día uno, y ampliarlo después sin
// romperlas es justo lo que este límite existe para permitir. Un 404 diría «esto
// no existe» y un 400 «lo pediste mal»; ninguna de las dos es verdad.
export const DIMENSIONES = ['sitio', 'trimestre', 'operacion', 'm2'] as const
export const GRANULARIDADES = ['mes', 'trimestre'] as const

export type DimensionRentabilidad = (typeof DIMENSIONES)[number]
export type GranularidadRentabilidad = (typeof GRANULARIDADES)[number]

export interface ConsultaRentabilidad {
  dimension: DimensionRentabilidad
  granularidad: GranularidadRentabilidad
  desde: string
  hasta: string
}

// `.strict()` para que un parámetro con typo —o un `tenantId` de más— dé 400 en
// vez de ignorarse en silencio. El tenant sale SIEMPRE de la sesión; que no haya
// por dónde mandarlo es parte del diseño, no una omisión.
//
// Las fechas son OBLIGATORIAS y no tienen valor por omisión: un rango por
// omisión sobre historia de años es una consulta sin límite disfrazada de
// comodidad, que es exactamente el problema del que este endpoint nace.
const consultaSchema = z
  .object({
    dimension: z.enum(DIMENSIONES, {
      errorMap: () => ({ message: 'Selecciona una dimensión válida: sitio, trimestre, operacion o m2' }),
    }),
    granularidad: z.enum(GRANULARIDADES, {
      errorMap: () => ({ message: 'Selecciona una granularidad válida: mes o trimestre' }),
    }),
    desde: fechaZod('Falta la fecha de inicio del reporte'),
    hasta: fechaZod('Falta la fecha de fin del reporte'),
  })
  .strict()
  .superRefine((v, ctx) => {
    const d = diaComparable(v.desde)
    const h = diaComparable(v.hasta)
    if (d == null || h == null) {
      // `esFechaValida` acepta formas que `diaComparable` no sabe ordenar
      // («March 3, 2026»). Si no se pueden comparar, no se puede garantizar que
      // el rango no esté invertido, así que se rechaza en vez de suponer.
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['desde'], message: 'Usa fechas con formato AAAA-MM-DD' })
      return
    }
    // Comparar fechas COMO TEXTO solo funciona con ceros a la izquierda:
    // '2026-9-1' < '2026-10-01' como cadenas y al revés en el calendario. Ese
    // defecto ya se pagó dos veces en este repo, y rechazaba periodos correctos
    // además de dejar pasar los invertidos. De ahí `diaComparable`.
    if (d > h) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hasta'],
        message: 'La fecha de fin no puede ser anterior a la de inicio',
      })
    }
  })

export function validarConsultaRentabilidad(params: unknown): ConsultaRentabilidad {
  return validar(consultaSchema, params)
}

// Nombre legible de cada dimensión, para el mensaje del 501. Se dice CUÁL falta,
// no «no implementado»: quien lo lea tiene que saber si pedir otra cosa o
// esperar.
const ETIQUETA_DIMENSION: Record<DimensionRentabilidad, string> = {
  sitio: 'pantalla',
  trimestre: 'trimestre',
  operacion: 'operación',
  m2: 'metro cuadrado',
}

export async function rentabilidadCtrl(params: unknown): Promise<ReporteRentabilidad> {
  const consulta = validarConsultaRentabilidad(params)

  // 501 y no 400: la dimensión ES parte del contrato del endpoint, solo que
  // todavía no tiene motor. Se corta ANTES de tocar la base — leer para no
  // usarlo sería pagar la consulta por nada.
  if (consulta.dimension !== 'sitio') {
    throw new AppError(
      `El reporte de rentabilidad por ${ETIQUETA_DIMENSION[consulta.dimension]} todavía no está disponible. Por ahora solo «sitio».`,
      501,
    )
  }

  const datos = await datosRentabilidad(consulta)
  return rentabilidadPorSitio(datos, consulta)
}
