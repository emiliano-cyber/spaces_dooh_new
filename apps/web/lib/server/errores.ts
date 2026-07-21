import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

// ============================================================================
//  lib/server/errores.ts — Fundación de la capa por capas (ruta → controller →
//  model). Un error de dominio con status HTTP + validación de entrada con zod
//  + un mapeador único de errores a respuesta HTTP. Los controllers lanzan
//  AppError; las rutas solo llaman respuestaError() en el catch.
// ============================================================================

// Error de dominio con código HTTP. Ej.: throw new AppError('No encontrado', 404).
export class AppError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

// Valida `data` contra un schema zod. Si falla, lanza AppError(400) con un
// mensaje legible (campo + motivo). Devuelve el dato ya tipado y saneado.
//
// Un issue custom puede pedir otro status vía `params.status` (p. ej. las
// validaciones de subida usan 422 para distinguir "archivo inválido" de un
// error de forma). Ver lib/server/uploads.ts.
export function validar<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) {
    const i = r.error.issues[0]
    const campo = i?.path?.length ? `${i.path.join('.')}: ` : ''
    const status = (i as { params?: { status?: number } })?.params?.status ?? 400
    throw new AppError(`${campo}${i?.message ?? 'Datos inválidos'}`, status)
  }
  return r.data
}

// Errores de Postgres que en realidad son culpa de la petición, no del servidor:
// sin esto salían como 500 con el texto crudo del driver (uuid mal formado, fecha
// basura, choque de índice único...). Mensaje propio: el de Postgres filtra
// nombres de tablas, columnas y constraints al cliente.
const ERRORES_PG: Record<string, { status: number; mensaje: string }> = {
  '22P02': { status: 400, mensaje: 'Dato con formato inválido' },            // uuid/enum mal formado
  '22007': { status: 400, mensaje: 'Fecha inválida' },                       // invalid_datetime_format
  '22008': { status: 400, mensaje: 'Fecha fuera de rango' },
  '22001': { status: 400, mensaje: 'Un valor excede la longitud permitida' },
  '23502': { status: 400, mensaje: 'Falta un dato obligatorio' },            // not_null_violation
  '23514': { status: 400, mensaje: 'Un valor no cumple las reglas de la tabla' },
  '23505': { status: 409, mensaje: 'El registro ya existe' },                // unique_violation
  '23503': { status: 409, mensaje: 'El registro está referenciado por otro' },
  '42501': { status: 403, mensaje: 'Sin acceso a ese registro' },            // RLS
}

function codigoPg(e: unknown): string | null {
  const c = (e as { code?: unknown })?.code
  return typeof c === 'string' && /^[0-9A-Z]{5}$/.test(c) ? c : null
}

// Mapea cualquier error a una respuesta HTTP. AppError/ZodError → 4xx con
// mensaje; errores de Postgres atribuibles a la petición → 4xx genérico; lo
// demás → 500 sin filtrar internals (el detalle va al log del servidor).
export function respuestaError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  if (e instanceof ZodError) {
    const i = e.issues[0]
    const campo = i?.path?.length ? `${i.path.join('.')}: ` : ''
    // Un issue custom puede pedir otro status (las subidas usan 422); ver validar().
    const status = (i as { params?: { status?: number } })?.params?.status ?? 400
    return NextResponse.json({ error: `${campo}${i?.message ?? 'Datos inválidos'}` }, { status })
  }
  const pg = codigoPg(e)
  if (pg && ERRORES_PG[pg]) {
    const { status, mensaje } = ERRORES_PG[pg]
    console.error(`[api] Postgres ${pg}:`, e)
    return NextResponse.json({ error: mensaje }, { status })
  }
  // Inesperado: se registra completo del lado del servidor y al cliente solo le
  // llega que fue un error interno (el mensaje puede contener detalles del
  // esquema, de la conexión o de la consulta).
  console.error('[api] Error no controlado:', e)
  return NextResponse.json({ error: 'Error interno' }, { status: 500 })
}
