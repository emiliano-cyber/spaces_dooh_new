// ============================================================================
//  lib/contrato-cambios.ts — Qué cambió en un contrato de arrendamiento.
//
//  Antes de firmarse, un contrato se negocia: el arrendador pide otra renta,
//  nosotros otra fecha. Cada edición deja un renglón en `contrato_cambios` con
//  QUIÉN lo propuso y QUÉ cambió, y este módulo es el que decide lo segundo.
//
//  Puro (sin base ni sesión) para que la regla de «qué cuenta como cambio» se
//  pruebe sin Postgres. Las tres decisiones que importan:
//
//   · Se compara NORMALIZADO. La fila trae fechas como Date y los importes como
//     texto de `numeric`; el patch, '2026-01-01' y 15000. Comparar en crudo
//     anotaría «15000.00 → 15000» en cada guardado, y un historial lleno de
//     cambios que no lo son es un historial que nadie lee.
//   · Los ids se anotan con el NOMBRE de ese momento. El historial se lee meses
//     después: un uuid no dice nada, y el nombre de hoy puede no ser el de
//     entonces.
//   · El PDF NO se copia. Pesa cientos de kB en data URL; se anota solo que
//     había uno y que se reemplazó.
// ============================================================================

export type PartePropone = 'ARRENDADOR' | 'ARRENDATARIO'

export interface CambioDeCampo {
  campo: string
  etiqueta: string
  antes: string | null
  despues: string | null
}

export interface PatchContrato {
  fechaInicio?: string
  fechaFin?: string
  montoRenta?: number
  periodicidad?: string
  moneda?: string
  deposito?: number | null
  documentoUrl?: string | null
  autoRenovable?: boolean
  razonSocialId?: string | null
  arrendadorId?: string
  entidadId?: string | null
}

type Tipo = 'fecha' | 'dinero' | 'texto' | 'si-no' | 'pdf' | 'id'

// El ORDEN de esta lista es el orden en que se muestran los cambios.
const CAMPOS: { campo: keyof PatchContrato; columna: string; etiqueta: string; tipo: Tipo }[] = [
  { campo: 'arrendadorId', columna: 'arrendador_id', etiqueta: 'Arrendador', tipo: 'id' },
  { campo: 'razonSocialId', columna: 'razon_social_id', etiqueta: 'Razón social del arrendador', tipo: 'id' },
  { campo: 'entidadId', columna: 'entidad_id', etiqueta: 'Razón social que paga', tipo: 'id' },
  { campo: 'fechaInicio', columna: 'fecha_inicio', etiqueta: 'Fecha de inicio', tipo: 'fecha' },
  { campo: 'fechaFin', columna: 'fecha_fin', etiqueta: 'Fecha de fin', tipo: 'fecha' },
  { campo: 'montoRenta', columna: 'monto_renta', etiqueta: 'Renta', tipo: 'dinero' },
  { campo: 'periodicidad', columna: 'periodicidad', etiqueta: 'Periodicidad', tipo: 'texto' },
  { campo: 'moneda', columna: 'moneda', etiqueta: 'Moneda', tipo: 'texto' },
  { campo: 'deposito', columna: 'deposito', etiqueta: 'Depósito', tipo: 'dinero' },
  { campo: 'autoRenovable', columna: 'auto_renovable', etiqueta: 'Renovación automática', tipo: 'si-no' },
  { campo: 'documentoUrl', columna: 'documento_url', etiqueta: 'PDF del contrato', tipo: 'pdf' },
]

// Los ids que un patch puede mencionar, antes y después: el repo los resuelve a
// nombre en la misma transacción y se los pasa a `diferenciasContrato`.
export function idsMencionados(fila: Record<string, unknown>, patch: PatchContrato): string[] {
  const ids = new Set<string>()
  for (const c of CAMPOS) {
    if (c.tipo !== 'id' || patch[c.campo] === undefined) continue
    for (const v of [fila[c.columna], patch[c.campo]]) if (typeof v === 'string' && v) ids.add(v)
  }
  return [...ids]
}

function normal(v: unknown, tipo: Tipo, nombres: Record<string, string>): string | null {
  if (v === null || v === undefined || v === '') return null
  switch (tipo) {
    case 'fecha':
      // Una Date de la base viene a medianoche de México en UTC (06:00Z): el
      // DÍA es lo que cuenta, y es lo primero de su ISO.
      return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10)
    case 'dinero': {
      const n = Number(v)
      return Number.isFinite(n) ? n.toFixed(2) : String(v)
    }
    case 'si-no':
      return v ? 'Sí' : 'No'
    case 'id':
      return nombres[String(v)] ?? String(v)
    default:
      return String(v).trim() || null
  }
}

export function diferenciasContrato(
  fila: Record<string, unknown>,
  patch: PatchContrato,
  nombres: Record<string, string> = {},
): CambioDeCampo[] {
  const cambios: CambioDeCampo[] = []
  for (const c of CAMPOS) {
    const nuevo = patch[c.campo]
    if (nuevo === undefined) continue
    const viejo = fila[c.columna]

    if (c.tipo === 'pdf') {
      // Se compara el contenido, pero se anota solo su presencia.
      const habia = typeof viejo === 'string' && viejo !== ''
      const hay = typeof nuevo === 'string' && nuevo !== ''
      if (habia === hay && (!hay || viejo === nuevo)) continue
      cambios.push({
        campo: c.campo,
        etiqueta: c.etiqueta,
        antes: habia ? 'PDF anterior' : null,
        despues: hay ? 'PDF nuevo' : null,
      })
      continue
    }

    // `auto_renovable` puede venir NULL de filas viejas; para la comparación es
    // «No», que es lo que la pantalla siempre mostró.
    const a = c.tipo === 'si-no' ? normal(!!viejo, c.tipo, nombres) : normal(viejo, c.tipo, nombres)
    const d = normal(nuevo, c.tipo, nombres)
    // Los ids se comparan por id, no por nombre: dos arrendadores pueden
    // llamarse igual.
    const igual = c.tipo === 'id' ? (viejo ?? null) === (nuevo ?? null) : a === d
    if (igual) continue
    cambios.push({ campo: c.campo, etiqueta: c.etiqueta, antes: a, despues: d })
  }
  return cambios
}
