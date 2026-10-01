'use client'

import { Battery, BatteryLow, SignalHigh, SignalLow, SignalMedium, Wifi } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
//  Piezas compartidas del módulo Space Eyes: las mismas reglas de color y las
//  mismas palabras en la lista y en la ficha.
//
//  Viven aquí y no en cada pantalla porque un equipo con 18% de batería tiene
//  que verse igual de mal en los dos sitios. Dos copias de estos umbrales se
//  separan en cuanto alguien toque una.
// ============================================================================

// ─── Cuánto hace ────────────────────────────────────────────────────────────
// "hace 4 min", "hace 3 h", "hace 8 d". Aproximado a propósito: para decidir si
// hay que ir al sitio, el minuto exacto no cambia nada.
export function hace(iso: string | null): string {
  if (!iso) return 'nunca'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'hace segundos'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 14) return `hace ${d} d`
  return `hace ${Math.floor(d / 7)} semanas`
}

// Un equipo se da por caído a los 10 minutos sin reportar: es el mismo umbral
// que usa Space Eye, y si aquí fuera otro, las dos pantallas se contradirían.
const MINUTOS_CAIDO = 10

export function estaEnLinea(online: boolean, ultimaConexion: string | null): boolean {
  if (!online) return false
  if (!ultimaConexion) return false
  return Date.now() - new Date(ultimaConexion).getTime() < MINUTOS_CAIDO * 60_000
}

// ─── Batería ────────────────────────────────────────────────────────────────
export function tonoBateria(pct: number | null): 'verde' | 'ambar' | 'rojo' | 'neutro' {
  if (pct == null) return 'neutro'
  if (pct >= 50) return 'verde'
  if (pct >= 20) return 'ambar'
  return 'rojo'
}

const TINTA = {
  verde: 'text-success',
  ambar: 'text-warning',
  rojo: 'text-error',
  neutro: 'text-muted',
} as const

export function Bateria({ pct, className }: { pct: number | null; className?: string }) {
  const tono = tonoBateria(pct)
  const Icono = tono === 'rojo' ? BatteryLow : Battery
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-ink', className)}>
      <Icono className={cn('h-4 w-4', TINTA[tono])} strokeWidth={1.8} />
      {pct == null ? <span className="text-muted">sin dato</span> : `${pct}%`}
    </span>
  )
}

// ─── Señal ──────────────────────────────────────────────────────────────────
// dBm: más negativo es peor. −85 es el punto donde una foto de 2 MB empieza a
// tardar de verdad, y −100 donde ya no sube.
export function calidadSenal(dbm: number | null): { texto: string; tono: 'verde' | 'ambar' | 'rojo' | 'neutro' } {
  if (dbm == null) return { texto: 'sin dato', tono: 'neutro' }
  if (dbm >= -75) return { texto: 'buena', tono: 'verde' }
  if (dbm >= -90) return { texto: 'regular', tono: 'ambar' }
  return { texto: 'débil', tono: 'rojo' }
}

export function Senal({
  dbm,
  tipo,
  operador,
  className,
}: {
  dbm: number | null
  tipo: string | null
  operador?: string | null
  className?: string
}) {
  const { tono } = calidadSenal(dbm)
  const esWifi = (tipo ?? '').toUpperCase().includes('WIFI')
  const Icono = esWifi ? Wifi : tono === 'rojo' ? SignalLow : tono === 'ambar' ? SignalMedium : SignalHigh
  const etiqueta = esWifi ? 'WiFi' : (tipo ?? '').toUpperCase() === 'CELLULAR' ? 'Móvil' : (tipo ?? 'sin dato')
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-ink', className)}>
      <Icono className={cn('h-4 w-4', TINTA[tono])} strokeWidth={1.8} />
      {etiqueta}
      {operador ? <span className="text-muted">· {operador}</span> : null}
    </span>
  )
}

// ─── Pastilla de conexión ───────────────────────────────────────────────────
// La misma en la lista, en la ficha y encima de la fotografía. `sobreFoto` la
// pasa a fondo oscuro: sobre una imagen, un badge claro desaparece.
export function PildoraConexion({
  online,
  sobreFoto = false,
  className,
}: {
  online: boolean
  sobreFoto?: boolean
  className?: string
}) {
  if (sobreFoto) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-white backdrop-blur-sm',
          className,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-[#35d07f]' : 'bg-[#f87171]')} />
        {online ? 'EN LÍNEA' : 'SIN REPORTAR'}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        online
          ? 'border-[#1da85040] bg-success-soft text-[#146c39]'
          : 'border-[#dc262640] bg-error-soft text-[#b91c1c]',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-success' : 'bg-error')} />
      {online ? 'En línea' : 'Sin reportar'}
    </span>
  )
}

// ─── Fecha y hora larga, para los pies de foto ──────────────────────────────
export function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Bytes a algo legible. El consumo llega en bytes y "1521483776" no le dice
// nada a nadie.
export function gigas(bytes: number | null): string {
  if (bytes == null) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

// ─── Una foto dentro de su marco, derecha y pareja ─────────────────────────
// Los equipos de campo toman fotos horizontales; el teléfono de pruebas está
// parado y las toma verticales (2448×3264). Recortada para llenar un marco
// horizontal, una vertical enseña solo una tira del centro y se ve ampliada,
// "muy grande" junto a las demás. Así que:
//   · horizontal → llena el marco (cover), como siempre;
//   · vertical   → entera al centro, sobre ella misma desenfocada de fondo.
// Todas ocupan el mismo marco y ninguna se ve con zoom.
//
// Algunas fotos llegan acostadas con el giro aparte (`display_rotation`): la
// caja se acuesta ANTES de girar (unidades de contenedor) para no salirse.
//
// El padre pone el tamaño (`relative aspect-…`); esto lo llena entero. Sin
// `loading="lazy"`: dentro de un contenedor de tamaño Chrome nunca la carga.
export function FotoGirada({
  src,
  alt,
  giro = 0,
  className,
  onError,
}: {
  src: string
  alt: string
  giro?: number
  className?: string
  onError?: () => void
}) {
  const g = ((Math.round(giro) % 360) + 360) % 360
  const acostada = g === 90 || g === 270
  const [vertical, setVertical] = useState(false)
  const caja = { width: acostada ? '100cqh' : '100cqw', height: acostada ? '100cqw' : '100cqh' }
  const girar = `translate(-50%, -50%)${g ? ` rotate(${g}deg)` : ''}`
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#12100e]" style={{ containerType: 'size' }}>
      {vertical && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute left-1/2 top-1/2 max-w-none object-cover opacity-60 blur-xl"
          style={{ ...caja, transform: `${girar} scale(1.15)` }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onError={onError}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          // Vertical tal como se ve: con un giro de 90° se intercambian.
          setVertical(acostada ? w > h : h > w)
        }}
        className={cn(
          'absolute left-1/2 top-1/2 max-w-none',
          vertical ? 'object-contain' : 'object-cover',
          className,
        )}
        style={{ ...caja, transform: girar }}
      />
    </div>
  )
}
