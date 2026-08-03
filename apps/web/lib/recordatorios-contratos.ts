// ============================================================================
//  lib/recordatorios-contratos.ts — Qué contratos merecen un recordatorio HOY.
// ----------------------------------------------------------------------------
//  Puro: recibe contratos y una fecha, devuelve avisos. Sin BD, sin correo y
//  sin `new Date()` dentro, para que se pueda probar el día que quieras.
//
//  Tres motivos, y son distintos entre sí:
//
//   · INCOMPLETO — la pantalla se cargó o se vendió y su contrato nació sin
//     importe (ADR 0001). Mientras siga así no cuenta como costo en el P&L, no
//     genera calendario de pagos y la pantalla no se puede reservar. No tiene
//     fecha: es una deuda de captura que envejece en silencio, y por eso hace
//     falta que alguien la recuerde.
//   · POR VENCER — se acaba en los próximos días. La ventana es CORTA (3 días)
//     a propósito: ya existe un aviso a 90 días en pantalla, y este otro es el
//     de "esto se te va encima mañana".
//   · VENCIDO — ya pasó su fecha de fin y nadie lo renovó. Se sigue avisando
//     mientras siga así: dejar de hacerlo cuando más falta hace sería justo al
//     revés.
// ============================================================================

export const DIAS_AVISO_VENCIMIENTO = 3

export type MotivoRecordatorio = 'INCOMPLETO' | 'POR_VENCER' | 'VENCIDO'

export interface ContratoParaAviso {
  id: string
  estatus: string
  // `Date` además de `string` a propósito: cuando esto se alimenta desde el
  // store del navegador la fecha viaja como texto (pasó por JSON), pero cuando
  // lo llama el barrido del cron viene directa del driver de Postgres, que
  // convierte `date`/`timestamptz` en un Date de JS. Tipar solo `string` hacía
  // que `.slice()` reventara justo en el único camino que importa —el del
  // cron—, y las pruebas no lo veían porque construían las fechas a mano.
  fechaFin: string | Date | null
  arrendadorNombre?: string | null
  sitioNombre?: string | null
  predioNombre?: string | null
}

export interface Recordatorio {
  contratoId: string
  motivo: MotivoRecordatorio
  // Días hasta el vencimiento: negativo si ya venció, null si no tiene fecha.
  dias: number | null
  titulo: string
  detalle: string
  nivel: 'info' | 'warn' | 'error'
}

// Un Date se descompone por sus partes LOCALES, no con toISOString(): una fecha
// `date` de Postgres llega como medianoche local, y pasarla por UTC la correría
// un día entero en cualquier huso al oeste de Greenwich — que es el nuestro.
function soloFecha(v: string | Date): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  return String(v).slice(0, 10)
}

// Días de `hoy` a `fechaFin`, contando días completos y no milisegundos: un
// contrato vence un día entero, no a las 00:00:00.
export function diasHasta(fechaFin: string | Date, hoy: Date): number | null {
  const fin = new Date(`${soloFecha(fechaFin)}T00:00:00`)
  if (Number.isNaN(fin.getTime())) return null
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((fin.getTime() - base.getTime()) / 86_400_000)
}

// Cómo se nombra el contrato en el aviso. El predio manda cuando lo hay porque
// es el inmueble del que se habla al negociar; si no, la pantalla.
function queEs(c: ContratoParaAviso): string {
  const cual = c.predioNombre || c.sitioNombre || 'un espacio'
  return c.arrendadorNombre ? `${cual} · ${c.arrendadorNombre}` : cual
}

export function recordatoriosDeContratos(
  contratos: ContratoParaAviso[],
  hoy: Date,
): Recordatorio[] {
  const avisos: Recordatorio[] = []

  for (const c of contratos) {
    if (c.estatus === 'CANCELADO') continue

    if (c.estatus === 'INCOMPLETO') {
      avisos.push({
        contratoId: c.id,
        motivo: 'INCOMPLETO',
        dias: null,
        nivel: 'warn',
        titulo: `Contrato sin capturar: ${queEs(c)}`,
        detalle:
          'Le falta el arrendador, el importe de la renta, la periodicidad o la fecha de fin. ' +
          'Mientras siga así no cuenta como costo, no genera calendario de pagos y la pantalla no se puede reservar.',
      })
      continue
    }

    // Sin fecha de fin no se puede decir nada sobre su vencimiento, y el resto
    // de estatus ya afirman un acuerdo real: no hay aviso que dar.
    if (!c.fechaFin) continue
    const dias = diasHasta(c.fechaFin, hoy)
    if (dias == null) continue

    if (dias < 0) {
      avisos.push({
        contratoId: c.id,
        motivo: 'VENCIDO',
        dias,
        nivel: 'error',
        titulo: `Contrato vencido: ${queEs(c)}`,
        detalle:
          `Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'} y nadie lo ha renovado. ` +
          'El espacio se sigue ocupando sin acuerdo vigente que lo respalde.',
      })
    } else if (dias <= DIAS_AVISO_VENCIMIENTO) {
      avisos.push({
        contratoId: c.id,
        motivo: 'POR_VENCER',
        dias,
        nivel: 'warn',
        titulo:
          dias === 0
            ? `Contrato vence HOY: ${queEs(c)}`
            : `Contrato vence en ${dias} día${dias === 1 ? '' : 's'}: ${queEs(c)}`,
        detalle: 'Si se va a renovar, conviene moverlo antes de que caduque.',
      })
    }
  }

  // Primero lo más urgente: vencidos (más antiguos arriba), luego lo que está a
  // punto, y al final los incompletos, que no tienen fecha.
  const orden: Record<MotivoRecordatorio, number> = { VENCIDO: 0, POR_VENCER: 1, INCOMPLETO: 2 }
  return avisos.sort(
    (a, b) => orden[a.motivo] - orden[b.motivo] || (a.dias ?? 0) - (b.dias ?? 0),
  )
}

// Resumen para el asunto del correo. Se arma aquí y no en la plantilla para
// poder probarlo sin generar HTML.
export function resumenRecordatorios(avisos: Recordatorio[]): string {
  const n = (m: MotivoRecordatorio) => avisos.filter((a) => a.motivo === m).length
  const partes = [
    n('VENCIDO') ? `${n('VENCIDO')} vencido${n('VENCIDO') === 1 ? '' : 's'}` : '',
    n('POR_VENCER') ? `${n('POR_VENCER')} por vencer` : '',
    n('INCOMPLETO') ? `${n('INCOMPLETO')} sin capturar` : '',
  ].filter(Boolean)
  return partes.join(' · ')
}
