import 'server-only'
import { z } from 'zod'
import { validar } from './errores'
import { crearActivo, listarActivos, listarMovimientos } from './almacen-repo'
import { TIPOS_ACTIVO, type TipoActivo } from '@/lib/almacen-tipos'

// ============================================================================
//  lib/server/almacen-controller.ts — Validación del almacén.
// ----------------------------------------------------------------------------
//  Existe desde el 2026-09-30. Antes la ruta validaba a mano y guardaba en
//  `tipo_activo` cualquier texto: el catálogo de tipos vivía solo en la
//  pantalla, y un `curl` se lo saltaba. Ahora el catálogo lo aplica el
//  servidor (`lib/almacen-tipos.ts`), igual para el alta que para el filtro.
// ============================================================================

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)

const altaSchema = z
  .object({
    etiqueta: texto(120).min(1, 'La etiqueta es obligatoria'),
    descripcion: texto(300).min(1, 'La descripción es obligatoria'),
    // Sin tipo sigue siendo PANTALLA: es el DEFAULT de la columna y lo que
    // hacía la ruta antes de hoy, así que ningún cliente viejo cambia de
    // comportamiento.
    tipoActivo: z.enum(TIPOS_ACTIVO, { errorMap: () => ({ message: 'Tipo de artículo inválido' }) }).default('PANTALLA'),
    notas: texto(2000).nullish().transform((v) => (v ? v : null)),
  })
  // `.strict()`: un `tenantId` de más da 400 en vez de ignorarse. El tenant
  // sale SIEMPRE de la sesión (`tenantActual()` en el repo).
  .strict()

export async function crearActivoCtrl(body: unknown) {
  const d = validar(altaSchema, body) as z.output<typeof altaSchema>
  return crearActivo({ etiqueta: d.etiqueta, descripcion: d.descripcion, tipoActivo: d.tipoActivo, notas: d.notas })
}

const filtroSchema = z
  .object({
    tipo: z.enum(TIPOS_ACTIVO, { errorMap: () => ({ message: 'Tipo de artículo inválido' }) }).nullish(),
  })
  .strict()

// Un `?tipo=` mal escrito da 400 y NO una lista vacía: la vacía diría «no
// tienes camionetas» cuando lo que pasó es que el filtro venía mal.
export async function listarAlmacenCtrl(params: URLSearchParams) {
  const f = validar(filtroSchema, Object.fromEntries(params)) as z.output<typeof filtroSchema>
  const tipo: TipoActivo | null = f.tipo ?? null
  const [activos, movimientos] = await Promise.all([listarActivos({ tipo }), listarMovimientos()])
  return { activos, movimientos }
}
