'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Campo } from '@/components/demo/ui/Campo'
import { TONO } from '@/components/demo/admin/Chip'
import { cn } from '@/lib/cn'
import { useSitios, formatFecha } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { formatNumero } from '@/lib/formato-numero'
import type { Valla, GrupoVallas } from '@/lib/vallas/tipos'
import { armarPlano, rangoPorOmision, type OcupacionSitio, type SitioPlano, type CuadroPlano, type BloquePlano } from '@/lib/vallas/plano'
import { ocupacionVallasApi } from '@/lib/data/vallas-api'

// ============================================================================
//  PLANO DE LAS VALLAS (pedido del dueño, 20/11): «tiene que estar un mapa del
//  plano de las vallas». Un dibujo por sitio, cada cuadro con su número y su
//  medida, a escala (ancho y alto proporcionales a sus metros, con un mínimo
//  legible), los grupos marcados con un corchete debajo, y si están libres u
//  ocupados entre dos fechas (por omisión hoy → +30 días).
//
//  La forma la arma `lib/vallas/plano.ts` (pura, con prueba); aquí solo se
//  pinta. El estado va SIEMPRE en texto («Libre», la marca), no solo en color,
//  y cada cuadro lleva `aria-label` con número, medida y estado.
//
//  Móvil: el plano de cada sitio tiene su propio scroll horizontal; la página
//  no se ensancha.
// ============================================================================

const ENTRADA = 'w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink'

/** «6 × 3 m», con los decimales solo si los hay. */
export function useMedida() {
  const { t, idioma } = useIdioma()
  return (ancho: number, alto: number) =>
    t('vallas.medida', { ancho: formatNumero(ancho, ancho % 1 ? 2 : 0, idioma), alto: formatNumero(alto, alto % 1 ? 2 : 0, idioma) })
}

export function TarjetaPlano({ vallas, grupos }: { vallas: Valla[] | null; grupos: GrupoVallas[] }) {
  const { t } = useIdioma()
  return (
    <CardColapsable
      id="vallas.plano"
      titulo={t('vallas.plano.titulo')}
      resumen={<span className="text-[12px] text-muted">{t('vallas.plano.detalle')}</span>}
    >
      <PlanoVallas vallas={vallas} grupos={grupos} />
    </CardColapsable>
  )
}

/**
 * El cuerpo del plano: fechas, leyenda y un dibujo por sitio. Lo usan la
 * tarjeta de Vallas (todos los sitios, fechas elegibles) y «Dibujar plano» de
 * la propuesta (20/11 noche: `sitioIds` de la propuesta y `fechas` FIJAS, las
 * suyas, sin campos para cambiarlas). Un solo plano: no se duplica.
 */
export function PlanoVallas({
  vallas,
  grupos,
  sitioIds,
  fechas,
  textoVacio,
}: {
  vallas: Valla[] | null
  grupos: GrupoVallas[]
  /** Solo estos sitios; sin él, todos. */
  sitioIds?: readonly string[]
  /** Fechas fijas (las de la propuesta). Sin ellas, Desde/Hasta editables, hoy → +30 días. */
  fechas?: { desde: string; hasta: string }
  /** Lo que se dice si no hay nada que dibujar; por omisión, el de Vallas. */
  textoVacio?: string
}) {
  const { t, idioma } = useIdioma()
  const sitios = useSitios()
  const [rango] = useState(() => rangoPorOmision())
  const [desdeElegido, setDesde] = useState(rango.desde)
  const [hastaElegido, setHasta] = useState(rango.hasta)
  const desde = fechas ? fechas.desde : desdeElegido
  const hasta = fechas ? fechas.hasta : hastaElegido
  const [ocupaciones, setOcupaciones] = useState<OcupacionSitio[]>([])
  const fechasValidas = Boolean(desde && hasta && desde <= hasta)

  useEffect(() => {
    if (!fechasValidas) return
    let vigente = true
    ocupacionVallasApi(desde, hasta)
      .then((r) => vigente && setOcupaciones(r.ocupaciones))
      .catch((e) => vigente && toast.error(e instanceof Error ? e.message : t('vallas.error.cargar')))
    return () => {
      vigente = false
    }
  }, [desde, hasta, fechasValidas, t])

  const plano = useMemo(
    () =>
      armarPlano({
        vallas: vallas ?? [],
        grupos,
        sitios: (sitios ?? []).map((s) => ({ id: s.id, nombre: s.nombre })),
        ocupaciones: fechasValidas ? ocupaciones : [],
        sitioIds,
      }),
    [vallas, grupos, sitios, ocupaciones, fechasValidas, sitioIds],
  )

  return (
    <div className="space-y-4">
      {fechas ? (
        fechasValidas ? (
          <p className="text-[12px] text-muted">
            {t('vallas.plano.periodo', { desde: formatFecha(desde, idioma), hasta: formatFecha(hasta, idioma) })}
          </p>
        ) : (
          <p className="text-[12px] text-muted">{t('vallas.plano.sin-fechas')}</p>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Campo label={t('vallas.verificar.desde')}>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.verificar.hasta')}>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={ENTRADA} />
          </Campo>
        </div>
      )}
      {!fechasValidas && desde && hasta && (
        <p role="alert" className="text-[12px] text-error">
          {t('vallas.plano.fechas.invalidas')}
        </p>
      )}
      {vallas && plano.length === 0 ? (
        <p className="text-[12px] text-muted">{textoVacio ?? t('vallas.plano.vacio')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className={cn('rounded border px-2 py-0.5 text-ink', TONO.exito)}>{t('vallas.plano.libre')}</span>
          <span className={cn('rounded border px-2 py-0.5 text-ink', TONO.aviso)}>{t('vallas.plano.leyenda.ocupada')}</span>
          <span>{t('vallas.plano.nota')}</span>
        </div>
      )}
      {plano.map((s) => (
        <PlanoDeSitio key={s.sitioId} sitio={s} />
      ))}
    </div>
  )
}

/** El dibujo de un sitio. Exportado para la prueba de render. */
export function PlanoDeSitio({ sitio }: { sitio: SitioPlano }) {
  const { t } = useIdioma()
  const rotularCaras = sitio.filas.length > 1 || sitio.filas.some((f) => f.cara != null)
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <h4 className="mb-2 text-[13px] font-medium text-ink">
        {sitio.nombre ? t('vallas.plano.sitio', { nombre: sitio.nombre }) : t('vallas.plano.sitio.sin-nombre')}
      </h4>
      {/* Scroll PROPIO: si los cuadros no caben en un teléfono, se desliza el
          plano y no la página. */}
      <div className="overflow-x-auto pb-1">
        <div className="space-y-3">
          {sitio.filas.map((f) => (
            <div key={f.cara ?? 'sin-cara'}>
              {rotularCaras && f.cara != null && (
                <div className="mb-1 text-[11px] text-muted">{t('vallas.lista.cara', { n: f.cara })}</div>
              )}
              <div className="flex items-start gap-1" style={{ width: `${f.anchoRel * 100}%`, minWidth: 'max-content' }}>
                {f.bloques.map((b) => (
                  <Bloque key={b.grupo ? `g-${b.grupo.id}` : `v-${b.cuadros[0].id}`} bloque={b} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Bloque({ bloque }: { bloque: BloquePlano }) {
  const { t } = useIdioma()
  if (!bloque.grupo) return <Cuadro cuadro={bloque.cuadros[0]} />
  const g = bloque.grupo
  const etiqueta =
    t('vallas.plano.grupo', { numero: g.numero, modo: t(`vallas.modo.${g.modo}` as ClaveTexto) }) +
    (g.cruzaSitio ? ` · ${t('vallas.plano.grupo.cruza')}` : '')
  return (
    <div role="group" aria-label={etiqueta} className="flex min-w-max flex-col" style={{ flexGrow: bloque.ancho, flexBasis: 0 }}>
      <div className="flex items-start gap-1">
        {bloque.cuadros.map((c) => (
          <Cuadro key={c.id} cuadro={c} />
        ))}
      </div>
      {/* El corchete del boceto: └─ G-001 (una imagen) ─┘ */}
      <div className="mt-1 rounded-b border-x border-b border-accent px-1 pb-0.5 text-center">
        <span className="demo-num text-[11px] font-medium text-accent-hover">{etiqueta}</span>
      </div>
    </div>
  )
}

function Cuadro({ cuadro: c }: { cuadro: CuadroPlano }) {
  const { t } = useIdioma()
  const medida = useMedida()
  const m = medida(c.ancho, c.alto)
  const libre = c.estado === 'libre'
  const estado = libre ? t('vallas.plano.libre') : t('vallas.plano.ocupada', { quien: c.ocupantes.map((o) => o.etiqueta).join(', ') })
  return (
    <div
      className={cn('flex min-w-[5.5rem] flex-col justify-between rounded border px-2 py-1.5', libre ? TONO.exito : TONO.aviso)}
      style={{ flexGrow: c.ancho, flexBasis: 0, height: `${Math.round(48 + c.altoRel * 64)}px` }}
      aria-label={t('vallas.plano.cuadro', { numero: c.numero, medida: m, estado })}
    >
      <span className="demo-num text-[12px] font-medium text-ink">{c.numero}</span>
      <span className="demo-num text-[11px] text-muted">{m}</span>
      <span className="truncate text-[11px] text-ink">
        {libre ? (
          t('vallas.plano.libre')
        ) : (
          <>
            <span>{c.ocupantes[0].etiqueta}</span>
            {c.ocupantes.length > 1 && (
              <>
                {' '}
                <span className="text-muted">{t('vallas.plano.mas', { n: c.ocupantes.length - 1 })}</span>
              </>
            )}
          </>
        )}
      </span>
    </div>
  )
}
