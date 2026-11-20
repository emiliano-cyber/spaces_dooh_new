'use client'

import { Monitor, CheckCircle2, FileWarning, Home, Layers, MonitorPlay, Signpost, MapPin, Columns3 } from 'lucide-react'
import { TONO } from '@/components/demo/admin/Chip'
import { cn } from '@/lib/cn'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { KPICard } from '@/components/demo/KPICard'
import { disponibilidadInventario, esDigital, type Tono } from '@/components/demo/StatusBadge'
import type { Sitio } from '@/lib/data/client'
import { useTexto } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// ============================================================================
//  Resumen del inventario: los cuatro indicadores y los chips de filtro que van
//  encima de la tabla (rediseño del 26/10, con el lenguaje del Dashboard).
//
//  Vive en SU archivo y no dentro de `InventarioTabla.tsx` a propósito:
//  `candado-inventario-y-fichas.test.ts` recorta cada celda de ese archivo
//  hasta la siguiente `function` y cuenta sus `return (`. Una pieza visual más
//  ahí dentro cambiaría esas cuentas sin cambiar nada de lo que vigilan.
//
//  Todo son cuentas sobre lo que la tabla YA tiene en memoria; no hay
//  endpoint nuevo ni cálculo de negocio. Los filtros solo deciden qué filas se
//  pintan: la tabla los aplica sobre su misma lista `filtrados`, así que la
//  descarga, «Seleccionar todo» y el cambio masivo siguen operando sobre lo
//  que se ve.
// ============================================================================

/** De quién depende el costo de la pantalla: contrato de renta, ninguno, o propia. */
export type ClaseContrato = 'con' | 'sin' | 'propia'
export type ClaseMedio = 'digital' | 'fija'

/**
 * Misma resolución que la columna Arrendador/Renta de la tabla: una pantalla
 * propia no tiene contrato a propósito (su costo es luz y operación); una que
 * no es propia y no tiene contrato es un pendiente.
 */
export function claseContrato(s: Pick<Sitio, 'propio'>, tieneContrato: boolean): ClaseContrato {
  if (s.propio) return 'propia'
  return tieneContrato ? 'con' : 'sin'
}

export function claseMedio(s: Sitio): ClaseMedio {
  return esDigital(s) ? 'digital' : 'fija'
}

/** El tono de `disponibilidadInventario` agrupa la disponibilidad que ya se pinta en la fila. */
export function tonoDisponibilidad(s: Sitio): Tono {
  return disponibilidadInventario(s).tono
}

// I18N (2026-11-02) · la clave de cada etiqueta; el espanol es el de siempre.
const ETIQUETA_DISP: Partial<Record<Tono, ClaveTexto>> = {
  verde: 'inventario.disp.verde',
  ambar: 'inventario.disp.ambar',
  rojo: 'inventario.disp.rojo',
  neutro: 'inventario.disp.neutro',
}

export type FiltrosInventario = {
  disp: Tono | null
  medio: ClaseMedio | null
  contrato: ClaseContrato | null
  // Zona (18/11): la ciudad y, dentro de ella, la alcaldía (el distrito en
  // Perú). Son DOS campos y no uno porque la alcaldía sola no identifica una
  // zona: «Centro» existe en muchas ciudades y mezclarlas sería filtrar mal.
  ciudad: string | null
  alcaldia: string | null
}
export const FILTROS_VACIOS: FiltrosInventario = {
  disp: null,
  medio: null,
  contrato: null,
  ciudad: null,
  alcaldia: null,
}

/** ¿Hay algún filtro puesto? Lo usan el «Quitar filtros» y el texto de tabla vacía. */
export function hayFiltros(f: FiltrosInventario): boolean {
  return !!(f.disp || f.medio || f.contrato || f.ciudad || f.alcaldia)
}

// La ciudad y la alcaldía se comparan RECORTADAS: el importador de Excel deja a
// veces un espacio al final, y «Lima » y «Lima» saldrían como dos zonas.
const limpio = (v: string | null | undefined) => (v ?? '').trim()

// Valor de la opción «Sin alcaldía» del selector (hallazgo C, 19/11). No es
// la cadena vacía porque `''` ya significa «todas las zonas», y no puede
// chocar con una alcaldía real: ninguna se llama así con los guiones bajos.
export const SIN_ALCALDIA = '__sin_alcaldia__'

/** ¿La pantalla cae en la zona elegida? Sin ciudad elegida, todas caen. */
export function enZona(
  s: Pick<Sitio, 'ciudad' | 'alcaldia'>,
  f: Pick<FiltrosInventario, 'ciudad' | 'alcaldia'>,
): boolean {
  if (f.ciudad && limpio(s.ciudad) !== f.ciudad) return false
  if (f.alcaldia === SIN_ALCALDIA) return !limpio(s.alcaldia)
  if (f.alcaldia && limpio(s.alcaldia) !== f.alcaldia) return false
  return true
}

// `sinAlcaldia`: las pantallas de la ciudad que no tienen alcaldía. Sin esta
// cuenta la ciudad decía «CDMX (9)» y sus zonas sumaban 5: las otras cuatro no
// se podían encontrar desde el filtro (hallazgo C, 19/11).
export type ZonaInventario = {
  nombre: string
  n: number
  alcaldias: { nombre: string; n: number }[]
  sinAlcaldia: number
}

/**
 * Las zonas que EXISTEN en el inventario, con cuántas pantallas tiene cada una,
 * de más a menos (la zona con más pantallas es la que más se busca). Las
 * pantallas sin ciudad no forman zona: no hay nada útil que elegir ahí.
 */
export function zonasInventario(sitios: Pick<Sitio, 'ciudad' | 'alcaldia'>[]): ZonaInventario[] {
  const porCiudad = new Map<string, Map<string, number>>()
  const sinAlcaldia = new Map<string, number>()
  for (const s of sitios) {
    const c = limpio(s.ciudad)
    if (!c) continue
    const m = porCiudad.get(c) ?? new Map<string, number>()
    porCiudad.set(c, m)
    const a = limpio(s.alcaldia)
    if (a) m.set(a, (m.get(a) ?? 0) + 1)
    else sinAlcaldia.set(c, (sinAlcaldia.get(c) ?? 0) + 1)
  }
  const total = cuenta(sitios.map((s) => limpio(s.ciudad)).filter(Boolean))
  const orden = (a: { nombre: string; n: number }, b: { nombre: string; n: number }) =>
    b.n - a.n || a.nombre.localeCompare(b.nombre)
  return [...porCiudad.entries()]
    .map(([nombre, m]) => ({
      nombre,
      n: total.get(nombre) ?? 0,
      alcaldias: [...m.entries()].map(([a, n]) => ({ nombre: a, n })).sort(orden),
      sinAlcaldia: sinAlcaldia.get(nombre) ?? 0,
    }))
    .sort(orden)
}

function cuenta<T extends string>(lista: T[]): Map<T, number> {
  const m = new Map<T, number>()
  for (const k of lista) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

// ─── Indicadores ────────────────────────────────────────────────────────────

export const IndicadoresInventario = ({
  sitios,
  tieneContrato,
}: {
  sitios: Sitio[]
  tieneContrato: (s: Sitio) => boolean
}) => {
  const t = useTexto()
  const medios = cuenta(sitios.map(claseMedio))
  const disp = cuenta(sitios.map(tonoDisponibilidad))
  const contratos = cuenta(sitios.map((s) => claseContrato(s, tieneContrato(s))))
  const total = sitios.length
  const disponibles = disp.get('verde') ?? 0
  const parciales = disp.get('ambar') ?? 0
  const sinContrato = contratos.get('sin') ?? 0
  const propias = contratos.get('propia') ?? 0
  return (
    <CardColapsable id="inventario.indicadores" titulo={t('inventario.indicadores')}>
      {/* Misma rejilla que el Dashboard: 4 columnas solo desde xl, porque entre
          1024 y 1279 el sidebar deja cada tarjeta demasiado angosta. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label={t('inventario.kpi.pantallas')}
          value={String(total)}
          sub={t('inventario.kpi.medios', { digitales: medios.get('digital') ?? 0, fijas: medios.get('fija') ?? 0 })}
          icon={<Monitor className="h-4 w-4" />}
        />
        {/* Disponibles = las que se venden enteras hoy. Una digital con parte
            de sus slots vendidos sigue siendo vendible, pero no «disponible»:
            se cuenta aparte en la aclaración para no esconderla. */}
        <KPICard
          label={t('inventario.kpi.disponibles')}
          value={String(disponibles)}
          sub={
            parciales
              ? t('inventario.kpi.disponibles.sub-parciales', { total, n: parciales })
              : t('inventario.kpi.disponibles.sub', { total })
          }
          tono={disponibles > 0 ? 'verde' : 'neutro'}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KPICard
          label={t('inventario.kpi.sin-contrato')}
          value={String(sinContrato)}
          sub={sinContrato > 0 ? t('inventario.kpi.sin-contrato.sub') : t('inventario.kpi.sin-contrato.ninguno')}
          tono={sinContrato > 0 ? 'ambar' : 'neutro'}
          icon={<FileWarning className="h-4 w-4" />}
        />
        <KPICard
          label={t('inventario.kpi.propias')}
          value={String(propias)}
          sub={t('inventario.kpi.propias.sub')}
          icon={<Home className="h-4 w-4" />}
        />
      </div>
    </CardColapsable>
  )
}

// ─── Chips de filtro ────────────────────────────────────────────────────────

const Chip = ({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    className={cn(
      // `bg-transparent` explícito en el inactivo: sin preflight, un <button>
      // sin fondo hereda el gris del sistema operativo (ver inventario/page.tsx).
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      activo
        ? 'border-accent bg-accent-soft font-medium text-ink'
        : 'border-border bg-transparent text-muted hover:text-ink',
    )}
  >
    {children}
  </button>
)

const Grupo = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-[11px] text-muted">{titulo}:</span>
    {children}
  </div>
)

/**
 * Los chips cuentan sobre el inventario COMPLETO, no sobre lo ya filtrado: así
 * el número dice cuántas hay de cada cosa, y no cambia de valor al pulsar otro
 * chip. Pulsar el chip activo lo quita.
 */
export const ChipsFiltroInventario = ({
  sitios,
  tieneContrato,
  filtros,
  onCambio,
}: {
  sitios: Sitio[]
  tieneContrato: (s: Sitio) => boolean
  filtros: FiltrosInventario
  onCambio: (f: FiltrosInventario) => void
}) => {
  const t = useTexto()
  const disp = cuenta(sitios.map(tonoDisponibilidad))
  const contratos = cuenta(sitios.map((s) => claseContrato(s, tieneContrato(s))))
  const alternar = <K extends keyof FiltrosInventario>(k: K, v: FiltrosInventario[K]) =>
    onCambio({ ...filtros, [k]: filtros[k] === v ? null : v })
  const ORDEN_DISP: Tono[] = ['verde', 'ambar', 'rojo', 'neutro']
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <Grupo titulo={t('inventario.chips.disponibilidad')}>
        {/* Solo los grupos que existen: un chip con (0) no filtra nada útil. */}
        {ORDEN_DISP.filter((tono) => (disp.get(tono) ?? 0) > 0).map((tono) => (
          <Chip key={tono} activo={filtros.disp === tono} onClick={() => alternar('disp', tono)}>
            {t(ETIQUETA_DISP[tono]!)} <span className="demo-num">({disp.get(tono)})</span>
          </Chip>
        ))}
      </Grupo>
      <Grupo titulo={t('inventario.chips.contrato')}>
        <Chip activo={filtros.contrato === 'con'} onClick={() => alternar('contrato', 'con')}>
          {t('inventario.chips.con-contrato')} <span className="demo-num">({contratos.get('con') ?? 0})</span>
        </Chip>
        <Chip activo={filtros.contrato === 'sin'} onClick={() => alternar('contrato', 'sin')}>
          {t('inventario.kpi.sin-contrato')} <span className="demo-num">({contratos.get('sin') ?? 0})</span>
        </Chip>
        <Chip activo={filtros.contrato === 'propia'} onClick={() => alternar('contrato', 'propia')}>
          {t('inventario.chips.propia')} <span className="demo-num">({contratos.get('propia') ?? 0})</span>
        </Chip>
      </Grupo>
    </div>
  )
}

// ─── Pestañas Todos / Fijos / Digitales (18/11) ─────────────────────────────
//
// El medio era un grupo de chips de 11 px escondido entre los otros dos, y es
// el corte que más se usa: quien vende digital no quiere ver espectaculares, y
// al revés. Sube a pestañas grandes, con el mismo lenguaje que el selector de
// vía de la página (pastilla BLANCA sobre riel crema, contorno por `ring-*`;
// el porqué de las dos cosas está en `inventario/page.tsx`).
//
// Los números cuentan sobre el inventario completo, igual que los chips: dicen
// cuántas hay de cada medio y no cambian al tocar otro filtro.

function clasePestana(activa: boolean): string {
  return cn(
    'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded px-3 py-2 text-[13px] sm:flex-none sm:px-4',
    'transition-[background-color,box-shadow,color] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    activa
      ? 'bg-surface font-medium text-ink shadow-sm ring-1 ring-border-strong'
      : 'bg-transparent text-muted hover:bg-surface hover:text-ink',
  )
}

export const PestanasMedio = ({
  sitios,
  medio,
  onCambio,
  vallas,
}: {
  sitios: Sitio[]
  medio: ClaseMedio | null
  onCambio: (m: ClaseMedio | null) => void
  /**
   * 20/11 · el dueño pidió Vallas también DENTRO de Inventario (el menú la
   * lleva una sola vez, en Comercial). Es opcional: solo la pantalla
   * Inventario la ofrece. No es un filtro de la tabla sino otra vista, así que
   * con `activa` ninguna pestaña de medio queda marcada a la vez.
   */
  vallas?: { activa: boolean; onElegir: () => void }
}) => {
  const enVallas = vallas?.activa === true
  const t = useTexto()
  const medios = cuenta(sitios.map(claseMedio))
  const opciones: { valor: ClaseMedio | null; etiqueta: string; n: number; icono: React.ReactNode }[] = [
    { valor: null, etiqueta: t('inventario.pestana.todos'), n: sitios.length, icono: <Layers className="h-4 w-4" /> },
    { valor: 'fija', etiqueta: t('inventario.pestana.fijos'), n: medios.get('fija') ?? 0, icono: <Signpost className="h-4 w-4" /> },
    { valor: 'digital', etiqueta: t('inventario.pestana.digitales'), n: medios.get('digital') ?? 0, icono: <MonitorPlay className="h-4 w-4" /> },
  ]
  return (
    <div
      role="tablist"
      aria-label={t('inventario.chips.medio')}
      className="flex w-full gap-1 rounded-md border border-border bg-surface-2 p-1 sm:w-auto"
    >
      {opciones.map((o) => (
        <button
          key={o.valor ?? 'todos'}
          type="button"
          role="tab"
          aria-selected={!enVallas && medio === o.valor}
          onClick={() => onCambio(o.valor)}
          className={clasePestana(!enVallas && medio === o.valor)}
        >
          {o.icono}
          {o.etiqueta}
          <span
            className={cn(
              'demo-num rounded-full px-1.5 text-[11px]',
              !enVallas && medio === o.valor ? 'bg-accent-soft text-ink' : 'bg-surface text-muted',
            )}
          >
            {o.n}
          </span>
        </button>
      ))}
      {vallas && (
        <button
          type="button"
          role="tab"
          aria-selected={enVallas}
          onClick={vallas.onElegir}
          className={clasePestana(enVallas)}
        >
          <Columns3 className="h-4 w-4" />
          {t('nav.vallas')}
          <span className={cn('whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none', TONO.aviso)}>
            {t('nav.insignia.en-proceso')}
          </span>
        </button>
      )}
    </div>
  )
}

// ─── Selector de zona (18/11) ───────────────────────────────────────────────
//
// Dos listas encadenadas: ciudad y, dentro de ella, alcaldía. Las zonas salen
// del propio inventario —no hay catálogo de zonas en la base—, así que solo se
// ofrecen las que tienen pantallas. Las cuentas respetan el medio elegido:
// «Digitales» + «Guadalajara (4)» tiene que decir cuántas DIGITALES hay ahí, o
// el número promete filas que la tabla no va a enseñar.

const claseSelect =
  'h-9 min-w-0 max-w-[220px] rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:text-muted'

export const SelectorZona = ({
  sitios,
  filtros,
  onCambio,
}: {
  sitios: Sitio[]
  filtros: FiltrosInventario
  onCambio: (f: FiltrosInventario) => void
}) => {
  const t = useTexto()
  const base = filtros.medio ? sitios.filter((s) => claseMedio(s) === filtros.medio) : sitios
  const zonas = zonasInventario(base)
  // Si la ciudad elegida se quedó sin pantallas al cambiar de medio, se sigue
  // ofreciendo con (0): quitarla de la lista dejaría el <select> mostrando otra.
  const ciudades =
    filtros.ciudad && !zonas.some((z) => z.nombre === filtros.ciudad)
      ? [...zonas, { nombre: filtros.ciudad, n: 0, alcaldias: [], sinAlcaldia: 0 }]
      : zonas
  const actual = ciudades.find((z) => z.nombre === filtros.ciudad)
  const alcaldias = actual?.alcaldias ?? []
  const sinAlcaldia = actual?.sinAlcaldia ?? 0
  if (ciudades.length === 0) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <select
        aria-label={t('inventario.zona.ciudad')}
        value={filtros.ciudad ?? ''}
        // Cambiar de ciudad SIEMPRE limpia la alcaldía: la de antes no existe
        // en la ciudad nueva y dejaría la tabla vacía sin razón visible.
        onChange={(e) => onCambio({ ...filtros, ciudad: e.target.value || null, alcaldia: null })}
        className={claseSelect}
      >
        <option value="">{t('inventario.zona.todas-ciudades')}</option>
        {ciudades.map((z) => (
          <option key={z.nombre} value={z.nombre}>
            {z.nombre} ({z.n})
          </option>
        ))}
      </select>
      <select
        aria-label={t('inventario.zona.alcaldia')}
        value={filtros.alcaldia ?? ''}
        disabled={!filtros.ciudad || (alcaldias.length === 0 && sinAlcaldia === 0)}
        onChange={(e) => onCambio({ ...filtros, alcaldia: e.target.value || null })}
        title={!filtros.ciudad ? t('inventario.zona.elige-ciudad') : undefined}
        className={claseSelect}
      >
        <option value="">{t('inventario.zona.todas-alcaldias')}</option>
        {alcaldias.map((a) => (
          <option key={a.nombre} value={a.nombre}>
            {a.nombre} ({a.n})
          </option>
        ))}
        {/* Al final, y solo si hay alguna: es el resto, no una zona más. */}
        {sinAlcaldia > 0 && (
          <option value={SIN_ALCALDIA}>
            {t('inventario.zona.sin-alcaldia')} ({sinAlcaldia})
          </option>
        )}
      </select>
    </div>
  )
}
