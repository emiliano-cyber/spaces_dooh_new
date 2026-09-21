import 'server-only'
import { z } from 'zod'
import { validar } from './errores'
import { fechaZod, diaComparable } from './fechas'
import { datosRentabilidad } from './reportes-repo'
import {
  rentabilidadPorSitio,
  rentabilidadPorTrimestre,
  rentabilidadPorOperacion,
  rentabilidadPorM2,
  rentabilidadPorLuz,
  rentabilidadPorEntidad,
  DIMENSIONES_REPORTE,
  type DatosRentabilidad,
  type GranularidadReporte,
  type RangoReporte,
  type ReporteRentabilidad,
} from '@/lib/data/reportes'

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

// Las CINCO dimensiones DECLARADAS del contrato del endpoint. Se declaran en
// el MOTOR (`lib/data/reportes.ts`) y aquí solo se reexportan para que zod
// valide contra la misma lista: dos declaraciones dejarían un enum que acepta
// una dimensión sin motor, o un motor que nadie puede pedir.
//
// Nacieron las cuatro el 17/09 aunque solo `sitio` tenía cálculo, y las otras
// tres contestaban 501 —no 404 ni 400: la dimensión ERA parte del contrato, solo
// que no tenía implementación—. Desde el 18/09 las cuatro calculan, y el 501
// desapareció por donde tenía que desaparecer: `MOTORES` es un `Record`
// exhaustivo, así que añadir una dimensión al enum sin escribir su motor ya no
// compila. Lo que el tipo garantiza no necesita un error en tiempo de ejecución.
export const DIMENSIONES = DIMENSIONES_REPORTE
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
      errorMap: () => ({
        message: 'Selecciona una dimensión válida: sitio, trimestre, operacion, m2 o luz',
      }),
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

type MotorRentabilidad = (
  datos: DatosRentabilidad,
  opts: RangoReporte & { granularidad: GranularidadReporte },
) => ReporteRentabilidad

// El despacho por dimensión. Es un `Record` EXHAUSTIVO sobre el enum a
// propósito: es lo que hace imposible declarar una dimensión y olvidarse de su
// motor —o al revés— sin que el typecheck lo diga. Un `switch` con `default`
// habría dejado ese hueco abierto en tiempo de ejecución.
//
// Las CINCO leen los MISMOS datos y con la misma consulta: la diferencia entre
// dimensiones está en cómo se pivota la matriz sitio × periodo, no en qué se
// lee. Por eso la dimensión no llega nunca al SQL.
//
// `luz` se añadió el 2026-09-18 y no cambió ni una línea de este despacho más
// que su propia entrada: fue el `Record` exhaustivo el que obligó a escribirla.
const MOTORES: Record<DimensionRentabilidad, MotorRentabilidad> = {
  sitio: rentabilidadPorSitio,
  trimestre: rentabilidadPorTrimestre,
  operacion: rentabilidadPorOperacion,
  m2: rentabilidadPorM2,
  luz: rentabilidadPorLuz,
  entidad: rentabilidadPorEntidad,
}

export async function rentabilidadCtrl(params: unknown): Promise<ReporteRentabilidad> {
  const consulta = validarConsultaRentabilidad(params)
  // La dimensión ya pasó por `z.enum`, así que aquí es una de las cinco claves
  // del `Record` y no hay forma de que el índice salga vacío.
  const motor = MOTORES[consulta.dimension]
  const datos = await datosRentabilidad(consulta)
  return motor(datos, consulta)
}
