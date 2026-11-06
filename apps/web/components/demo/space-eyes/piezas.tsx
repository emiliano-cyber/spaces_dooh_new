'use client'

import { Battery, BatteryLow, SignalHigh, SignalLow, SignalMedium, Wifi } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { useTexto } from '@/lib/i18n/contexto'
import { traducir } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { formatFechaHora } from '@/lib/data/derive'
import { numeroEnIdioma } from '@/lib/i18n/formato-idioma'

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
// `idioma` va al final con 'es' por omision (lote del ingles, 2026-11-02): el
// español sale de las mismas claves y es letra por letra el de siempre.
export function hace(iso: string | null, idioma: Idioma = 'es'): string {
  if (!iso) return traducir(idioma, 'spaceeyes.hace.nunca')
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return traducir(idioma, 'spaceeyes.hace.segundos')
  if (min < 60) return traducir(idioma, 'spaceeyes.hace.min', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24) return traducir(idioma, 'spaceeyes.hace.h', { n: h })
  const d = Math.floor(h / 24)
  if (d < 14) return traducir(idioma, 'spaceeyes.hace.d', { n: d })
  return traducir(idioma, 'spaceeyes.hace.semanas', { n: Math.floor(d / 7) })
}

// Como se le quita el «hace» a cada idioma. El italiano («5 min fa») quita
// tambien el « ago»: mientras su lote no traduzca `spaceeyes.hace.*`, la
// frase le llega en ingles (caida al ingles, `diccionario.ts`).
const SIN_PREFIJO_HACE: Record<Idioma, (t: string) => string> = {
  es: (t) => t.replace('hace ', ''),
  en: (t) => t.replace(/ ago$/, ''),
  it: (t) => t.replace(/ (?:fa|ago)$/, ''),
  // Ola 0 del portugues (05/11): «há 5 min»; mientras su lote no traduzca
  // `spaceeyes.hace.*`, la frase le llega en ESPANOL («hace 5 min»).
  pt: (t) => t.replace(/^(?:há|hace) /, ''),
}

// Lo mismo sin el «hace» / «ago»: para un indicador que ya dice qué mide
// («Última captura · 30 min»). Antes era `hace(x).replace('hace ', '')`, que en
// ingles no quitaba nada.
export function haceSinPrefijo(iso: string | null, idioma: Idioma = 'es'): string {
  const t = hace(iso, idioma)
  return SIN_PREFIJO_HACE[idioma](t)
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
  const t = useTexto()
  const tono = tonoBateria(pct)
  const Icono = tono === 'rojo' ? BatteryLow : Battery
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-ink', className)}>
      <Icono className={cn('h-4 w-4', TINTA[tono])} strokeWidth={1.8} />
      {pct == null ? <span className="text-muted">{t('spaceeyes.comun.sin-dato')}</span> : `${pct}%`}
    </span>
  )
}

// ─── Señal ──────────────────────────────────────────────────────────────────
// dBm: más negativo es peor. −85 es el punto donde una foto de 2 MB empieza a
// tardar de verdad, y −100 donde ya no sube.
export function calidadSenal(
  dbm: number | null,
  idioma: Idioma = 'es',
): { texto: string; tono: 'verde' | 'ambar' | 'rojo' | 'neutro' } {
  if (dbm == null) return { texto: traducir(idioma, 'spaceeyes.comun.sin-dato'), tono: 'neutro' }
  if (dbm >= -75) return { texto: traducir(idioma, 'spaceeyes.senal.buena'), tono: 'verde' }
  if (dbm >= -90) return { texto: traducir(idioma, 'spaceeyes.senal.regular'), tono: 'ambar' }
  return { texto: traducir(idioma, 'spaceeyes.senal.debil'), tono: 'rojo' }
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
  const t = useTexto()
  const { tono } = calidadSenal(dbm)
  const esWifi = (tipo ?? '').toUpperCase().includes('WIFI')
  const Icono = esWifi ? Wifi : tono === 'rojo' ? SignalLow : tono === 'ambar' ? SignalMedium : SignalHigh
  const etiqueta = esWifi
    ? 'WiFi'
    : (tipo ?? '').toUpperCase() === 'CELLULAR'
      ? t('spaceeyes.senal.movil')
      : (tipo ?? t('spaceeyes.comun.sin-dato'))
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
  pendiente = false,
  sobreFoto = false,
  className,
}: {
  online: boolean
  /** Se dio de alta pero NUNCA se ha comunicado: falta terminar de vincularlo. */
  pendiente?: boolean
  sobreFoto?: boolean
  className?: string
}) {
  // Tres estados que un usuario sin conocimientos técnicos entiende. Un equipo
  // registrado no se da por funcionando: lo dice su última comunicación.
  const t = useTexto()
  const estado = online ? 'linea' : pendiente ? 'pendiente' : 'sin'
  const texto = t(
    ({ linea: 'spaceeyes.conexion.en-linea', pendiente: 'spaceeyes.conexion.pendiente', sin: 'spaceeyes.conexion.sin' } as const)[estado],
  )
  if (sobreFoto) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-white backdrop-blur-sm',
          className,
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            estado === 'linea' ? 'bg-[#35d07f]' : estado === 'pendiente' ? 'bg-[#fbbf24]' : 'bg-[#f87171]',
          )}
        />
        {texto.toUpperCase()}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        estado === 'linea'
          ? 'border-[#1da85040] bg-success-soft text-[#146c39]'
          : estado === 'pendiente'
            ? 'border-[#f59e0b40] bg-warning-soft text-[#92400e]'
            : 'border-[#dc262640] bg-error-soft text-[#b91c1c]',
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', estado === 'linea' ? 'bg-success' : estado === 'pendiente' ? 'bg-warning' : 'bg-error')}
      />
      {texto}
    </span>
  )
}

// ─── Fecha y hora larga, para los pies de foto ──────────────────────────────
// En ingles, el formato del resto de la aplicacion («Dec 1, 2026, 3:45 PM»);
// el español es el de siempre («02 nov 2026, 18:00»).
export function fechaHora(iso: string | null, idioma: Idioma = 'es'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  if (idioma !== 'es') return formatFechaHora(iso, idioma)
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Cifras con decimales, en el idioma de quien lee ────────────────────────
// Lote L1 del italiano (2026-11-03). En es y en es `toFixed` / `String` tal
// cual —lo de siempre, letra por letra: sin agrupar y con punto—; el italiano
// escribe coma decimal y punto de millar («63,3 GB», «1.440»). Sin esto, cada
// `toFixed` del modulo pintaba «1.2» o «3.10 GB» en la pantalla italiana, que
// es justo lo que la guardia (`guardias-italiano.ts`) caza como huella.
export function fijo(n: number, decimales: number, idioma: Idioma = 'es'): string {
  if (idioma === 'es' || idioma === 'en') return n.toFixed(decimales)
  return numeroEnIdioma(n, idioma, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

/** Una cifra tal cual (`String(n)` en es y en), con los separadores del italiano. */
export function cifra(n: number, idioma: Idioma = 'es'): string {
  if (idioma === 'es' || idioma === 'en') return String(n)
  return numeroEnIdioma(n, idioma, { maximumFractionDigits: 10 })
}

// Bytes a algo legible. El consumo llega en bytes y "1521483776" no le dice
// nada a nadie.
export function gigas(bytes: number | null, idioma: Idioma = 'es'): string {
  if (bytes == null) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${fijo(gb, 2, idioma)} GB`
  return `${fijo(bytes / 1024 ** 2, 0, idioma)} MB`
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
//
// `previa`: la miniatura (400 px, ya en caché casi siempre) que se pinta al
// instante mientras baja la foto completa del celular (2-5 MB); al llegar esta,
// la reemplaza. Sin ella, abrir una ficha era ver un recuadro negro varios
// segundos (g500, 11/10/2026).
export function FotoGirada({
  src,
  alt,
  giro = 0,
  className,
  onError,
  previa,
}: {
  src: string
  alt: string
  giro?: number
  className?: string
  onError?: () => void
  previa?: string
}) {
  const g = ((Math.round(giro) % 360) + 360) % 360
  const acostada = g === 90 || g === 270
  const [vertical, setVertical] = useState(false)
  const [cargada, setCargada] = useState<string | null>(null)
  const esperando = !!previa && previa !== src && cargada !== src
  const caja = { width: acostada ? '100cqh' : '100cqw', height: acostada ? '100cqw' : '100cqh' }
  const girar = `translate(-50%, -50%)${g ? ` rotate(${g}deg)` : ''}`
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#12100e]" style={{ containerType: 'size' }}>
      {esperando && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previa}
          alt=""
          aria-hidden
          className="absolute left-1/2 top-1/2 max-w-none object-contain"
          style={{ ...caja, transform: girar }}
        />
      )}
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
          setCargada(src)
        }}
        className={cn(
          'absolute left-1/2 top-1/2 max-w-none',
          vertical ? 'object-contain' : 'object-cover',
          esperando && 'opacity-0',
          className,
        )}
        style={{ ...caja, transform: girar }}
      />
    </div>
  )
}

// ─── La foto en grande (ampliar, evidencia de una falla) ───────────────────
// Entera siempre (contain: una falla en una esquina no se puede recortar) pero
// cabiendo en la pantalla: en un teléfono una vertical de 3264 px de alto ya
// no obliga a desplazarse para verla. Para el detalle, el tamaño completo.
export function VisorFoto({ src, alt }: { src: string; alt: string }) {
  const t = useTexto()
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="mx-auto block h-auto max-h-[60vh] w-auto max-w-full rounded border border-border object-contain sm:max-h-[65vh]"
      />
      <div className="text-center text-[12px]">
        <a href={src} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {t('spaceeyes.visor.completo')}
        </a>
      </div>
    </div>
  )
}
