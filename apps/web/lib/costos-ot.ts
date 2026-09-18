import type { TipoOT } from '@/lib/data/types'
import { TODOS_TIPOS_OT } from '@/lib/tipos-ot'

// ============================================================================
//  lib/costos-ot.ts — Cuánto cuesta una orden de trabajo, POR TIPO.
// ----------------------------------------------------------------------------
//  Hasta el 2026-09-17 esto era una constante en `lib/data/derive.ts:254`:
//
//      const COSTO_OPERATIVO_POR_OT = 1500
//      // Parámetro de demo; en producción vendría de ConfigNegocio o por tipo de OT.
//
//  Su propio comentario decía lo que le faltaba, y entretanto el margen de TODA
//  la aplicación —dashboard del dueño, P&L por campaña y ahora los reportes de
//  rentabilidad— cobraba lo mismo por montar una lona que por una inspección, e
//  igual para las cinco organizaciones. Ahora el importe vive en
//  `config_negocio.costos_ot` (una fila por tenant, ADR 0011) y esto es la
//  regla de lectura, compartida por el servidor y la UI.
//
//  Vive FUERA de `lib/server/` a propósito: `dashboardMetrics` y `margenCampana`
//  corren en el navegador sobre el store, y `reportes-repo` corre en el
//  servidor. Si cada lado tuviera su tabla, el dashboard y el reporte darían dos
//  márgenes distintos para el mismo mes — que es el error de raíz que este repo
//  documenta en `lib/server/tenant.ts:87-89`.
// ============================================================================

// ─── El respaldo: los NUEVE tipos, todos al valor de la constante vieja ─────
//
// Deliberadamente TODOS a 1500, que es lo que costaba cualquier OT antes de
// este cambio. No se inventan importes distintos por tipo: cuánto cuesta una
// herrería frente a una inspección es una decisión del dueño del negocio, no
// del código, y se captura en Configuración.
//
// Lo que este respaldo garantiza es que la migración NO MUEVA EL MARGEN: una
// organización que no configure nada obtiene exactamente las mismas cifras que
// enseñaba la aplicación ayer. Un cambio de esquema que además reescribe el
// margen sin avisar es imposible de verificar — no se sabría si la diferencia
// es el cambio o un fallo.
export const COSTOS_OT_RESPALDO: Record<TipoOT, number> = {
  MONTAJE_LONA: 1500,
  MONTAJE_DIGITAL: 1500,
  DESMONTAJE: 1500,
  MANTENIMIENTO_PREVENTIVO: 1500,
  MANTENIMIENTO_CORRECTIVO: 1500,
  HERRERIA: 1500,
  ELECTRICO: 1500,
  INSPECCION: 1500,
  OTRO: 1500,
}

// ¿Es un importe de costo utilizable? El 0 SÍ lo es: una inspección que hace el
// propio dueño no paga cuadrilla, y es capturable desde la pantalla. Filtrarlo
// —tratarlo como «sin configurar»— sería volver a decidir por el usuario, que
// es el mismo hallazgo de CFG-01 con los plazos de cobranza
// (`lib/server/config-repo.ts`).
function importeValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

// El costo de UNA orden de trabajo de este tipo, para este tenant.
//
// Cae al respaldo ante cualquier hueco: tenant sin fila de configuración,
// columna vacía, tipo sin capturar o valor basura en el jsonb. NUNCA devuelve 0
// por omisión, y esa es la decisión importante: un costo de 0 se suma sin que
// nada falle y deja el margen inflado en pantalla. Un fallo silencioso sobre
// dinero es justo lo que este módulo viene a evitar.
//
// Un `tipo` que no está en el enum cae al respaldo de OTRO —la casilla que el
// propio enum reserva para lo que no tiene casilla— y no a 0.
export function costoDeOt(tipo: string, costos?: Record<string, number> | null): number {
  const configurado = costos && typeof costos === 'object' ? costos[tipo] : undefined
  if (importeValido(configurado)) return configurado
  return COSTOS_OT_RESPALDO[tipo as TipoOT] ?? COSTOS_OT_RESPALDO.OTRO
}

// Lo que se puede GUARDAR en `config_negocio.costos_ot`: solo claves del enum y
// solo importes utilizables. Todo lo demás se descarta en silencio en vez de
// rechazar la petición entera, porque una clave desconocida no es un error del
// usuario —puede venir de una versión anterior de la pantalla, o de un tipo de
// OT retirado del catálogo— y tirar el PATCH completo por ella dejaría al dueño
// sin poder guardar los ocho importes que sí valen.
//
// Se aplica al ESCRIBIR además de al leer: `costoDeOt` ya tolera basura, pero
// dejarla entrar a la columna significa arrastrarla en cada respaldo y en cada
// migración, y que el siguiente que lea el jsonb crudo se la crea.
export function sanearCostosOt(valor: unknown): Partial<Record<TipoOT, number>> {
  const out: Partial<Record<TipoOT, number>> = {}
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return out
  for (const t of TODOS_TIPOS_OT) {
    const v = (valor as Record<string, unknown>)[t]
    if (importeValido(v)) out[t] = v
  }
  return out
}
