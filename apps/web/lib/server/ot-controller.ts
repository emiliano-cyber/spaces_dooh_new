import 'server-only'
import { z } from 'zod'
import { validar } from './errores'
import { crearOT, fijarCostoOT } from './ot-repo'

// ============================================================================
//  lib/server/ot-controller.ts — Alta de órdenes de trabajo.
//  Valida tipo/descripción y exige fecha compromiso (S1-5); prioridad acotada.
// ============================================================================

const PRIORIDAD = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const

const crearSchema = z.object({
  tipo: z.string().trim().min(1, 'El tipo es requerido'),
  descripcion: z.string().trim().min(1, 'La descripción es requerida'),
  // S1-5: sin fecha compromiso la alerta de OT vencida no puede operar.
  fechaProgramada: z.string().trim().min(1, 'La fecha compromiso es obligatoria'),
  sitioId: z.string().nullish(),
  campanaId: z.string().nullish(),
  instrucciones: z.string().trim().optional(),
  prioridad: z.enum(PRIORIDAD).optional(),
  asignadoA: z.string().nullish(),
  checklist: z.array(z.any()).optional(),
})

export async function crearOTCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  return crearOT({
    tipo: d.tipo,
    descripcion: d.descripcion,
    fechaProgramada: d.fechaProgramada,
    sitioId: d.sitioId ?? null,
    campanaId: d.campanaId ?? null,
    instrucciones: d.instrucciones,
    prioridad: d.prioridad,
    asignadoA: d.asignadoA ?? null,
    checklist: d.checklist,
  })
}

// ─── OT-COSTO-01 · el costo REAL de la visita ───────────────────────────────
//
// Esto es DINERO: entra directo al costo de operación del reporte de
// rentabilidad, restando del margen. La pantalla ya valida, pero un `curl` se
// salta la pantalla entera — el hallazgo que este repositorio ya pagó con el
// alta de clientes.
//
// Las tres decisiones del schema, y ninguna es cosmética:
//
//  1. `.nonnegative()`. Un costo negativo no da error en ninguna capa y **SUBE
//     el margen**, porque entra restando. Un número que mejora las cifras sin
//     que nadie lo note es el fallo que nadie reporta. Hay además un CHECK en
//     la base (`20260929_costo_real_ot.sql`), a propósito: esto protege a quien
//     pasa por la ruta, y el CHECK protege a la tabla de un `psql`.
//
//  2. `.nullable()` pero NO `.optional()`. `null` es «borra el costo capturado
//     y vuelve a la estimación», que hace falta para deshacer un 120000 tecleado
//     donde iban 12000. Un cuerpo SIN el campo es otra cosa —una petición mal
//     armada— y se rechaza: tratarlos igual haría que un fallo de la pantalla
//     borrara un costo capturado sin decir nada.
//
//  3. `z.number()` sin coerción. Un `'12000'` se rechaza en vez de convertirse:
//     la coerción también convertiría `''` en 0, y un cero es una AFIRMACIÓN
//     —«esta visita fue gratis»— que nadie quiso hacer.
const costoSchema = z.object({
  costoReal: z
    .number({ invalid_type_error: 'El costo debe ser un número' })
    .finite('El costo debe ser un número')
    .nonnegative('El costo no puede ser negativo')
    .nullable(),
})

export async function fijarCostoOTCtrl(id: string, body: unknown) {
  const d = validar(costoSchema, body)
  return fijarCostoOT(id, d.costoReal)
}
