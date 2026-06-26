'use client'

import { cn } from '@/lib/cn'
import type {
  EstComercial,
  EstCobranza,
  EstContrato,
  EstPagoRenta,
  EstOT,
  EstOrdenImpresion,
  EstComercialCampana,
  EstReserva,
  EstValidacionCreatividad,
  EstValidacionPublicacion,
} from '@/lib/data/types'

// ============================================================================
//  StatusBadge — ÚNICO componente de semáforo de toda la demo (sección 2).
//  Plano, 1px, punto de color + texto en sentence case. Los mapeos de enum a
//  tono viven aquí para que el color de un estatus sea consistente en todas
//  las pantallas (mapa, listas, pipeline, finanzas).
// ============================================================================

export type Tono = 'verde' | 'ambar' | 'rojo' | 'azul' | 'neutro'

const TONO_STYLE: Record<Tono, { dot: string; text: string; bg: string; border: string }> = {
  verde: { dot: 'bg-success', text: 'text-[#0f7a55]', bg: 'bg-[#10b9811a]', border: 'border-[#10b98140]' },
  ambar: { dot: 'bg-warning', text: 'text-[#9a6700]', bg: 'bg-[#f59e0b1a]', border: 'border-[#f59e0b40]' },
  rojo: { dot: 'bg-error', text: 'text-[#b91c1c]', bg: 'bg-[#ef44441a]', border: 'border-[#ef444440]' },
  azul: { dot: 'bg-info', text: 'text-[#0a4fcc]', bg: 'bg-[#0a66ff1a]', border: 'border-[#0a66ff40]' },
  neutro: { dot: 'bg-muted', text: 'text-muted', bg: 'bg-surface-2', border: 'border-border' },
}

export function StatusBadge({
  tono,
  children,
  className,
}: {
  tono: Tono
  children: React.ReactNode
  className?: string
}) {
  const s = TONO_STYLE[tono]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-none',
        s.bg,
        s.text,
        s.border,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {children}
    </span>
  )
}

// ─── Mapeos de dominio → {tono, label} (sentence case) ──────────────────────

// Estatus comercial de sitio (mapa/inventario). Esquema de color unificado con
// los pines del mapa (ver pinTono):
//   verde = disponible/libre · ámbar = reservado · rojo = ocupado/bloqueado.
export const SITIO_TONO: Record<EstComercial, Tono> = {
  DISPONIBLE: 'verde',
  RESERVADO: 'ambar',
  OCUPADO: 'rojo',
  BLOQUEADO: 'rojo',
  EN_MANTENIMIENTO: 'neutro',
  BAJA: 'neutro',
}
// Color del PIN en los mapas (dashboard y comercial). Distinto de SITIO_TONO
// (que es para badges de estatus): aquí el medio digital se resalta en azul.
//   azul = digital · verde = disponible · rojo = ocupado · ámbar = reservado.
export function pinTono(s: {
  tipoMedio: string; esRotativo: boolean; exhibicion: string; estatusComercial: EstComercial
}): Tono {
  const digital =
    s.tipoMedio === 'PANTALLA_DIGITAL' || s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
  if (digital) return 'azul'
  if (s.estatusComercial === 'OCUPADO') return 'rojo'
  if (s.estatusComercial === 'DISPONIBLE') return 'verde'
  return SITIO_TONO[s.estatusComercial] // reservado=ámbar, etc.
}

export const SITIO_LABEL: Record<EstComercial, string> = {
  DISPONIBLE: 'Disponible',
  // Un sitio RESERVADO corresponde a una reserva TENTATIVA: se anota para que
  // ambos vocabularios (sitio vs reserva) cuadren a la vista.
  RESERVADO: 'Reservado · tentativo',
  OCUPADO: 'Ocupado',
  BLOQUEADO: 'Bloqueado',
  EN_MANTENIMIENTO: 'En mantenimiento',
  BAJA: 'Baja',
}

// ─── Estado de RESERVA (fuente única). Nomenclatura canónica en femenino,
//     concuerda con "reserva": Tentativa / Confirmada / Cancelada. ────────────
export const RESERVA_TONO: Record<EstReserva, Tono> = {
  TENTATIVA: 'ambar',
  CONFIRMADA: 'verde',
  CANCELADA: 'neutro',
}
export const RESERVA_LABEL: Record<EstReserva, string> = {
  TENTATIVA: 'Tentativa',
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
}

export const COBRANZA_TONO: Record<EstCobranza, Tono> = {
  AL_CORRIENTE: 'verde',
  POR_VENCER: 'ambar',
  VENCIDA: 'rojo',
  PAGADA: 'verde',
}
export const COBRANZA_LABEL: Record<EstCobranza, string> = {
  AL_CORRIENTE: 'Al corriente',
  POR_VENCER: 'Por vencer',
  VENCIDA: 'Vencida',
  PAGADA: 'Pagada',
}

export const CONTRATO_TONO: Record<EstContrato, Tono> = {
  VIGENTE: 'verde',
  POR_VENCER: 'ambar',
  VENCIDO: 'rojo',
  RENOVADO: 'azul',
  CANCELADO: 'neutro',
}
export const CONTRATO_LABEL: Record<EstContrato, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
  CANCELADO: 'Cancelado',
}

export const PAGO_TONO: Record<EstPagoRenta, Tono> = {
  PAGADO: 'verde',
  PENDIENTE: 'ambar',
  VENCIDO: 'rojo',
}
export const PAGO_LABEL: Record<EstPagoRenta, string> = {
  PAGADO: 'Pagado',
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
}

export const OT_TONO: Record<EstOT, Tono> = {
  PENDIENTE: 'neutro',
  ASIGNADA: 'azul',
  EN_PROCESO: 'ambar',
  BLOQUEADA: 'rojo',
  EN_REVISION: 'ambar',
  COMPLETADA: 'verde',
  RECHAZADA: 'rojo',
  CANCELADA: 'neutro',
}
export const OT_LABEL: Record<EstOT, string> = {
  PENDIENTE: 'Pendiente',
  ASIGNADA: 'Asignada',
  EN_PROCESO: 'En proceso',
  BLOQUEADA: 'Bloqueada',
  EN_REVISION: 'En revisión',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
}

export const CAMPANA_TONO: Record<EstComercialCampana, Tono> = {
  DRAFT: 'neutro',
  COTIZACION: 'ambar',
  CONFIRMADA: 'azul',
  ACTIVA: 'verde',
  COMPLETADA: 'neutro',
  CANCELADA: 'neutro',
  LISTA_FACTURAR: 'verde',
}
export const CAMPANA_LABEL: Record<EstComercialCampana, string> = {
  DRAFT: 'Borrador',
  COTIZACION: 'Cotización',
  CONFIRMADA: 'Confirmada',
  ACTIVA: 'Activa',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  LISTA_FACTURAR: 'Lista para facturar',
}

// Validación de publicación a nivel campaña (antes de salir al aire).
export const VALIDACION_PUB_TONO: Record<EstValidacionPublicacion, Tono> = {
  PENDIENTE: 'ambar',
  APROBADA: 'verde',
  RECHAZADA: 'rojo',
}
export const VALIDACION_PUB_LABEL: Record<EstValidacionPublicacion, string> = {
  PENDIENTE: 'Pendiente de validar',
  APROBADA: 'Publicación aprobada',
  RECHAZADA: 'Publicación rechazada',
}

export const CREATIVIDAD_TONO: Record<EstValidacionCreatividad, Tono> = {
  PENDIENTE: 'ambar',
  VALIDADA: 'verde',
  RECHAZADA: 'rojo',
}
export const CREATIVIDAD_LABEL: Record<EstValidacionCreatividad, string> = {
  PENDIENTE: 'Pendiente',
  VALIDADA: 'Validada',
  RECHAZADA: 'Rechazada',
}

export const IMPRESION_TONO: Record<EstOrdenImpresion, Tono> = {
  ARTE_RECIBIDO: 'neutro',
  VALIDADO: 'azul',
  EN_PRODUCCION: 'ambar',
  IMPRESO: 'azul',
  LISTO_MONTAJE: 'verde',
}
export const IMPRESION_LABEL: Record<EstOrdenImpresion, string> = {
  ARTE_RECIBIDO: 'Arte recibido',
  VALIDADO: 'Validado',
  EN_PRODUCCION: 'En producción',
  IMPRESO: 'Impreso',
  LISTO_MONTAJE: 'Listo para montaje',
}
