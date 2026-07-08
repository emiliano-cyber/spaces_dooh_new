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
export function validar<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data)
  if (!r.success) {
    const i = r.error.issues[0]
    const campo = i?.path?.length ? `${i.path.join('.')}: ` : ''
    throw new AppError(`${campo}${i?.message ?? 'Datos inválidos'}`, 400)
  }
  return r.data
}

// Mapea cualquier error a una respuesta HTTP. AppError/ZodError → 4xx con
// mensaje; lo demás → 500 genérico (sin filtrar internals).
export function respuestaError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const msg = e instanceof Error ? e.message : 'Error interno'
  return NextResponse.json({ error: msg }, { status: 500 })
}
