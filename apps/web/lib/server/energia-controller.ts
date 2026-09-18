import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { fechaZod, diaComparable } from './fechas'
import { mesesDelRango, puntoDeMedicion } from '@/lib/data/reportes'
import {
  crearConsumo,
  eliminarConsumo,
  listarConsumos,
  puntosDeMedicion,
  type ConsumoEnergia,
  type PuntoDeMedicion,
} from './energia-repo'

// ============================================================================
//  lib/server/energia-controller.ts — La captura mensual del recibo de luz.
// ----------------------------------------------------------------------------
//  Quién teclea esto y cada cuánto lo decidió el dueño el 2026-09-18: «se
//  captura una vez por predio y por mes, la hace operaciones». De ahí sale todo
//  lo de este archivo, incluido lo que NO hace.
//
//  LO QUE HACE ESTA PANTALLA Y NO HACE NINGUNA OTRA: enseñar LO QUE FALTA. Una
//  lista de lo capturado deja invisible el mes que nadie tecleó, y ese mes no
//  sale como un error en ningún sitio — sale como un costo de luz de cero en el
//  reporte, indistinguible de una pantalla que no gasta luz. Por eso la
//  respuesta trae la REJILLA COMPLETA de punto de medición × mes, con sus
//  huecos, y no solo las filas que existen.
//
//  Y por eso `mesesDelRango()` y `puntoDeMedicion()` se importan del motor en
//  vez de reescribirse: si la captura contara los meses o los puntos de otra
//  forma que el reporte, el usuario rellenaría todas las celdas y el reporte
//  seguiría diciendo que le falta un recibo, sin que nada explicara cuál.
// ============================================================================

// ─── Lectura ────────────────────────────────────────────────────────────────

const consultaSchema = z
  .object({
    desde: fechaZod('Falta la fecha de inicio'),
    hasta: fechaZod('Falta la fecha de fin'),
  })
  // `.strict()` para que un parámetro con typo —o un `tenantId` de más— dé 400
  // en vez de ignorarse en silencio. El tenant sale SIEMPRE de la sesión.
  .strict()
  .superRefine((v, ctx) => {
    const d = diaComparable(v.desde)
    const h = diaComparable(v.hasta)
    if (d == null || h == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['desde'], message: 'Usa fechas con formato AAAA-MM-DD' })
      return
    }
    // Por CALENDARIO y no comparando texto: '2026-9-1' va antes que
    // '2026-10-01' en el calendario y después como cadena. Ese defecto ya se
    // pagó dos veces en este repo.
    if (d > h) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hasta'],
        message: 'La fecha de fin no puede ser anterior a la de inicio',
      })
    }
  })

/** Una celda de la rejilla: un punto de medición en un mes. */
export interface CeldaCaptura {
  punto: string
  /** `YYYY-MM`. */
  mes: string
  /** Los recibos capturados de ese punto y ese mes. Vacío = HUECO. */
  recibos: ConsumoEnergia[]
}

export interface TableroConsumos {
  desde: string
  hasta: string
  /** `YYYY-MM-01`, uno por mes del rango, en orden. */
  meses: string[]
  puntos: PuntoDeMedicion[]
  celdas: CeldaCaptura[]
  /** Cuántas celdas se esperaban y cuántas están vacías. */
  esperados: number
  faltantes: number
  /**
   * Recibos capturados que NO cuelgan de ningún punto de medición vigente: su
   * predio se quedó sin pantallas, o la pantalla se borró. Se devuelven aparte
   * porque su importe SÍ está capturado y NO llega a ninguna fila del reporte —
   * si no se enseñaran aquí, no habría ninguna pantalla desde la que borrarlos.
   */
  huerfanos: ConsumoEnergia[]
}

export async function tableroConsumosCtrl(params: unknown): Promise<TableroConsumos> {
  const { desde, hasta } = validar(consultaSchema, params)

  const [puntos, consumos] = await Promise.all([
    puntosDeMedicion(),
    // El rango de la consulta se estira al mes completo: un recibo se guarda con
    // el día 1 de su mes, así que pedir «del 10 de febrero al 20 de marzo» sin
    // estirar dejaría fuera el recibo de febrero, que es justo el que se está
    // mirando.
    listarConsumos(primerDiaDelMes(desde), primerDiaDelMes(hasta)),
  ])

  const meses = mesesDelRango({ desde, hasta })
  const clavesVigentes = new Set(puntos.map((p) => p.clave))

  // Los recibos, indexados por (punto, mes). Un punto puede tener VARIOS en el
  // mismo mes: son sus distintos medidores, y los dos son recibos de verdad.
  const porCelda = new Map<string, ConsumoEnergia[]>()
  const huerfanos: ConsumoEnergia[] = []
  for (const c of consumos) {
    const punto = puntoDeMedicion(c.predioId, c.sitioId ?? '')
    if (!clavesVigentes.has(punto)) {
      huerfanos.push(c)
      continue
    }
    const clave = `${punto}|${c.periodo.slice(0, 7)}`
    const lista = porCelda.get(clave)
    if (lista) lista.push(c)
    else porCelda.set(clave, [c])
  }

  const celdas: CeldaCaptura[] = []
  let faltantes = 0
  for (const p of puntos) {
    for (const mes of meses) {
      const clave = `${p.clave}|${mes.slice(0, 7)}`
      const recibos = porCelda.get(clave) ?? []
      if (recibos.length === 0) faltantes += 1
      celdas.push({ punto: p.clave, mes: mes.slice(0, 7), recibos })
    }
  }

  return {
    desde,
    hasta,
    meses,
    puntos,
    celdas,
    esperados: puntos.length * meses.length,
    faltantes,
    huerfanos,
  }
}

/** El primer día del mes de una fecha, sin pasar por `Date` ni por zonas. */
function primerDiaDelMes(iso: string): string {
  const [a, m] = iso.slice(0, 10).split('-')
  return `${a}-${String(Number(m)).padStart(2, '0')}-01`
}

// ─── Alta ───────────────────────────────────────────────────────────────────

// El importe y los kWh se aceptan como número o como texto: el formulario manda
// lo que hay en un `<input>`, y un `z.number()` a secas rechazaría "3000" con un
// mensaje que habla de tipos y no de recibos.
const cifra = (mensaje: string) =>
  z.coerce
    .number({ invalid_type_error: mensaje })
    .finite(mensaje)
    // No negativos, igual que el CHECK de la base. Un importe negativo es una
    // nota de crédito, no un consumo: entrarlo aquí RESTARÍA costo y mejoraría
    // el margen sin que nada lo dijera.
    .min(0, 'No puede ser negativo')

const consumoSchema = z
  .object({
    predioId: z.string().uuid().nullish(),
    sitioId: z.string().uuid().nullish(),
    // El periodo llega como `AAAA-MM` desde un `<input type="month">`, o como
    // `AAAA-MM-DD`. Se normaliza al día 1 aquí, que es lo que la base exige.
    periodo: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{1,2}(-\d{1,2})?$/, 'Usa el mes en formato AAAA-MM'),
    // Se recorta y se convierte a `null` si queda vacío: un medidor `''` y un
    // medidor ausente son el mismo hecho —«no se anotó el número»— y guardarlos
    // distinto rompería el índice único, que compara `coalesce(medidor,'')`.
    medidor: z
      .string()
      .trim()
      .max(60, 'El número de medidor es demasiado largo')
      .nullish()
      .transform((v) => (v ? v : null)),
    kwh: cifra('Captura los kWh del recibo'),
    importe: cifra('Captura el importe del recibo'),
    notas: z.string().trim().max(500).nullish().transform((v) => (v ? v : null)),
  })
  .strict()
  .superRefine((v, ctx) => {
    // ANCLAJE EXCLUYENTE, la misma regla que el CHECK de la base. Se valida
    // también aquí porque el mensaje del CHECK no dice qué hacer, y quien
    // captura tiene un recibo en la mano y ninguna forma de saber qué es un
    // `consumo_energia_anclaje_ck`.
    const tiene = [v.predioId, v.sitioId].filter(Boolean).length
    if (tiene !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['predioId'],
        message: 'Elige a qué corresponde el recibo: un predio o una pantalla suelta, no los dos',
      })
    }
  })

export async function crearConsumoCtrl(body: unknown, usuarioId: string | null): Promise<ConsumoEnergia> {
  const d = validar(consumoSchema, body)
  const periodo = normalizarPeriodo(d.periodo)
  // Un recibo del futuro es casi siempre un año mal tecleado, y su efecto no se
  // ve: entra en un periodo que nadie mira todavía y aparece meses después
  // inflando el costo de un mes que ya se daba por cerrado.
  if (periodo > primerDiaDelMes(hoyIso())) {
    throw new AppError('Ese mes todavía no ha terminado: no puede haber recibo.', 400)
  }
  return crearConsumo({
    predioId: d.predioId ?? null,
    sitioId: d.sitioId ?? null,
    periodo,
    medidor: d.medidor ?? null,
    kwh: d.kwh,
    importe: d.importe,
    notas: d.notas ?? null,
    creadoPor: usuarioId,
  })
}

/** `2026-2` o `2026-02-17` → `2026-02-01`. El día 1 es lo que exige la base. */
export function normalizarPeriodo(v: string): string {
  const [a, m] = v.trim().split('-')
  return `${a}-${String(Number(m)).padStart(2, '0')}-01`
}

// Se lee con las partes LOCALES y no con `toISOString()`: en México (UTC−6) el
// día 1 a medianoche local sale como el último día del mes anterior en UTC, y
// el recibo de este mes quedaría rechazado por «del futuro» justo el día 1.
function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Baja ───────────────────────────────────────────────────────────────────

export async function eliminarConsumoCtrl(id: string): Promise<void> {
  if (!id) throw new AppError('Falta el recibo a borrar', 400)
  const borrado = await eliminarConsumo(id)
  // 404 y no un `ok` silencioso: sin esto, borrar el recibo de otra
  // organización —que la RLS no deja tocar— devolvería «listo» y quien lo pidió
  // creería que lo borró.
  if (!borrado) throw new AppError('Recibo no encontrado', 404)
}
