'use client'

import { useEffect, useId, useState } from 'react'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { formatNumero } from '@/lib/formato-numero'
import { nombreProporcion } from '@/lib/proporcion-pantalla'
import {
  colocarArte,
  valorarArte,
  umbralesDe,
  type Lona,
  type Modo,
  type Semaforo,
  type Valoracion,
} from '@/lib/valoracion-arte'
import { REQUISITOS_RESPALDO, type Requisitos } from '@/lib/requisitos-impresion'
import { IMAGEN_CREATIVO_MAX_MB } from '@/lib/creativo-html'
import type { CreativoDeImpresion } from '@/lib/data/types'
import { ArteEnSitio, decimalesDe, medidaEnIdioma } from './ArteEnSitio'

// ============================================================================
//  ValoracionArte — la lona a escala con el arte puesto, y si sirve o no.
// ----------------------------------------------------------------------------
//  IMP-VAL (18/11). Pedido del dueño: «dejar en claro y mostrar el ejemplo de
//  cómo se vería el arte en el tamaño de la lona». Se usa en DOS sitios de
//  Imprenta: al elegir el archivo (antes de subirlo) y al abrir un arte ya
//  subido para aprobarlo. Las cuentas viven en `lib/valoracion-arte.ts`; aquí
//  solo se dibujan, en METROS (el `viewBox` del SVG es la lona en metros), para
//  que la persona de 1,70 m y el margen de 5 cm salgan a escala de verdad.
// ============================================================================

const PERSONA_M = 1.7

const TONO: Record<Semaforo, { punto: string; texto: string; fondo: string }> = {
  verde: { punto: 'bg-success', texto: 'text-[#146c39]', fondo: 'bg-success-soft' },
  ambar: { punto: 'bg-warning', texto: 'text-[#9a6700]', fondo: 'bg-warning-soft' },
  rojo: { punto: 'bg-error', texto: 'text-[#b42318]', fondo: 'bg-error-soft' },
}

/** Ancho × alto en píxeles de una imagen, leídos en el navegador. null si no se puede. */
export async function pixelesDeImagen(fuente: Blob | string): Promise<{ ancho: number; alto: number } | null> {
  try {
    if (typeof fuente !== 'string' && typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(fuente)
      const r = { ancho: bmp.width, alto: bmp.height }
      bmp.close?.()
      return r.ancho > 0 && r.alto > 0 ? r : null
    }
    const src = typeof fuente === 'string' ? fuente : URL.createObjectURL(fuente)
    return await new Promise((ok) => {
      const im = new Image()
      im.onload = () => ok(im.naturalWidth > 0 ? { ancho: im.naturalWidth, alto: im.naturalHeight } : null)
      im.onerror = () => ok(null)
      im.src = src
    })
  } catch {
    return null
  }
}

/**
 * La lona dibujada en su proporción real, rotulada, con el arte puesto como
 * saldría. A sangre: lo que sobra se ve atenuado y rayado FUERA de la lona
 * (se pierde). Sin recortar: el arte entero y las franjas en blanco rayadas.
 */
export function LonaAEscala({
  lona,
  src,
  proporcionArte,
  modo,
  margenM = REQUISITOS_RESPALDO.margenCm / 100,
}: {
  lona: Lona
  src: string
  proporcionArte: number
  modo: Modo
  // Margen de seguridad en metros: el de la imprenta, o el de la empresa.
  margenM?: number
}) {
  const { t, idioma } = useIdioma()
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const lado = Math.max(lona.ancho, lona.alto)
  const arte = colocarArte(lona, proporcionArte, modo)
  // Lo que sobresale se enseña, pero acotado a media lona por lado: un 16:9 en
  // un muro de 3 × 9 m sobresale 13 m y dejaría la lona como una raya.
  const tope = { x: lona.ancho * 0.5, y: lona.alto * 0.5 }
  const vista = {
    x0: Math.max(arte.x, -tope.x),
    y0: Math.max(arte.y, -tope.y),
    x1: Math.min(arte.x + arte.ancho, lona.ancho + tope.x),
    y1: Math.min(arte.y + arte.alto, lona.alto + tope.y),
  }
  const fs = lado * 0.045 // tamaño de letra, en metros
  const pad = fs * 2.2
  const persona = { x: Math.max(lona.ancho, vista.x1) + pad * 0.6, ancho: PERSONA_M * 0.32 }
  const minX = Math.min(0, vista.x0) - pad
  const minY = Math.min(0, vista.y0, lona.alto - PERSONA_M) - pad
  const maxX = persona.x + persona.ancho + pad * 0.4
  const maxY = Math.max(lona.alto, vista.y1) + pad * 0.6
  const margen = margenM
  const conMargen = margen > 0 && margen * 4 < Math.min(lona.ancho, lona.alto)
  const ancho = formatNumero(lona.ancho, decimalesDe(lona.ancho), idioma)
  const alto = formatNumero(lona.alto, decimalesDe(lona.alto), idioma)
  const trazo = { vectorEffect: 'non-scaling-stroke' as const }

  return (
    <svg
      role="img"
      aria-label={t('operaciones.imprenta.valoracion.figura', { medida: medidaEnIdioma(lona.ancho, lona.alto, idioma) })}
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-auto max-h-[360px] w-full"
    >
      <defs>
        <clipPath id={`${id}-lona`}>
          <rect x={0} y={0} width={lona.ancho} height={lona.alto} />
        </clipPath>
        <clipPath id={`${id}-vista`}>
          <rect x={vista.x0} y={vista.y0} width={vista.x1 - vista.x0} height={vista.y1 - vista.y0} />
        </clipPath>
        <pattern id={`${id}-rayas`} patternUnits="userSpaceOnUse" width={lado * 0.03} height={lado * 0.03} patternTransform="rotate(45)">
          <rect width={lado * 0.03} height={lado * 0.03} fill="rgba(255,255,255,0)" />
          <line x1={0} y1={0} x2={0} y2={lado * 0.03} stroke="rgba(180,35,24,.55)" strokeWidth={lado * 0.008} />
        </pattern>
        <pattern id={`${id}-blanco`} patternUnits="userSpaceOnUse" width={lado * 0.03} height={lado * 0.03} patternTransform="rotate(45)">
          <rect width={lado * 0.03} height={lado * 0.03} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={lado * 0.03} stroke="#c9ccd1" strokeWidth={lado * 0.008} />
        </pattern>
      </defs>

      {modo === 'cover' ? (
        <>
          {/* Lo que se pierde: el arte entero, atenuado y rayado, fuera de la lona. */}
          <g clipPath={`url(#${id}-vista)`}>
            <image href={src} x={arte.x} y={arte.y} width={arte.ancho} height={arte.alto} preserveAspectRatio="none" opacity={0.3} />
            <path
              d={`M${arte.x},${arte.y}h${arte.ancho}v${arte.alto}h${-arte.ancho}z M0,0v${lona.alto}h${lona.ancho}v${-lona.alto}z`}
              fill={`url(#${id}-rayas)`}
              fillRule="evenodd"
            />
          </g>
          <image
            href={src}
            x={arte.x}
            y={arte.y}
            width={arte.ancho}
            height={arte.alto}
            preserveAspectRatio="none"
            clipPath={`url(#${id}-lona)`}
          />
        </>
      ) : (
        <>
          <rect x={0} y={0} width={lona.ancho} height={lona.alto} fill={`url(#${id}-blanco)`} />
          <image href={src} x={arte.x} y={arte.y} width={arte.ancho} height={arte.alto} preserveAspectRatio="none" />
        </>
      )}

      {/* El borde de la lona y el margen de seguridad orientativo. */}
      <rect x={0} y={0} width={lona.ancho} height={lona.alto} fill="none" stroke="currentColor" strokeWidth={2} className="text-ink" style={trazo} />
      {/* Blanco punteado sobre una sombra oscura: se lee sobre arte claro y oscuro. */}
      {conMargen &&
        (['rgba(0,0,0,.55)', '#ffffff'] as const).map((color, i) => (
          <rect
            key={color}
            x={margen}
            y={margen}
            width={lona.ancho - margen * 2}
            height={lona.alto - margen * 2}
            fill="none"
            stroke={color}
            strokeWidth={i === 0 ? 3 : 1.5}
            strokeDasharray={i === 0 ? undefined : '5 4'}
            style={trazo}
          />
        ))}

      {/* Cotas: el ancho arriba y el alto a la izquierda. */}
      <g className="text-muted" fill="currentColor" stroke="currentColor">
        <line x1={0} x2={lona.ancho} y1={minY + pad * 0.75} y2={minY + pad * 0.75} strokeWidth={1} style={trazo} />
        <line x1={0} x2={0} y1={minY + pad * 0.55} y2={minY + pad * 0.95} strokeWidth={1} style={trazo} />
        <line x1={lona.ancho} x2={lona.ancho} y1={minY + pad * 0.55} y2={minY + pad * 0.95} strokeWidth={1} style={trazo} />
        <text x={lona.ancho / 2} y={minY + pad * 0.6} fontSize={fs} textAnchor="middle" stroke="none" className="demo-num">
          {`${ancho} m`}
        </text>
        <line x1={minX + pad * 0.75} x2={minX + pad * 0.75} y1={0} y2={lona.alto} strokeWidth={1} style={trazo} />
        <line x1={minX + pad * 0.55} x2={minX + pad * 0.95} y1={0} y2={0} strokeWidth={1} style={trazo} />
        <line x1={minX + pad * 0.55} x2={minX + pad * 0.95} y1={lona.alto} y2={lona.alto} strokeWidth={1} style={trazo} />
        <text
          x={minX + pad * 0.6}
          y={lona.alto / 2}
          fontSize={fs}
          textAnchor="middle"
          stroke="none"
          transform={`rotate(-90 ${minX + pad * 0.6} ${lona.alto / 2})`}
          className="demo-num"
        >
          {`${alto} m`}
        </text>
      </g>

      {/* Una persona de 1,70 m de pie a la altura del borde de abajo, para la escala. */}
      <g className="text-muted" fill="currentColor" aria-hidden>
        <circle cx={persona.x + persona.ancho / 2} cy={lona.alto - PERSONA_M + PERSONA_M * 0.07} r={PERSONA_M * 0.07} />
        <rect
          x={persona.x + persona.ancho * 0.15}
          y={lona.alto - PERSONA_M + PERSONA_M * 0.16}
          width={persona.ancho * 0.7}
          height={PERSONA_M * 0.42}
          rx={persona.ancho * 0.25}
        />
        <rect x={persona.x + persona.ancho * 0.22} y={lona.alto - PERSONA_M * 0.45} width={persona.ancho * 0.24} height={PERSONA_M * 0.45} rx={persona.ancho * 0.1} />
        <rect x={persona.x + persona.ancho * 0.54} y={lona.alto - PERSONA_M * 0.45} width={persona.ancho * 0.24} height={PERSONA_M * 0.45} rx={persona.ancho * 0.1} />
      </g>
    </svg>
  )
}

function Linea({ s, children }: { s: Semaforo; children: React.ReactNode }) {
  return (
    <li className={`flex items-start gap-2 text-[12px] ${TONO[s].texto}`}>
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TONO[s].punto}`} aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** El semáforo general y una línea por criterio, en lenguaje llano. */
export function PanelValoracion({
  v,
  lona,
  pixeles,
  html,
  maxMb = IMAGEN_CREATIVO_MAX_MB,
  requisitos = REQUISITOS_RESPALDO,
}: {
  v: Valoracion
  lona: Lona | null
  pixeles: { ancho: number; alto: number } | null
  html?: boolean
  // Tope de subida para este arte (`topeArteMb`): 15 MB una OOH, 4 el resto.
  maxMb?: number
  // IMP-REQ (18/11) · los de la imprenta de la orden, o los de la empresa
  // (`resolverRequisitos`). Sin ellos, las constantes de siempre.
  requisitos?: Requisitos
}) {
  const { t, idioma } = useIdioma()
  const n = (x: number, d = 0) => formatNumero(x, d, idioma)
  const px = (a: number, h: number) => `${n(a)} × ${n(h)}`
  const general: Record<Semaforo, ClaveTexto> = {
    verde: 'operaciones.imprenta.valoracion.general.verde',
    ambar: 'operaciones.imprenta.valoracion.general.ambar',
    rojo: 'operaciones.imprenta.valoracion.general.rojo',
  }
  const p = v.proporcion
  const r = v.resolucion
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-ink">{t('operaciones.imprenta.valoracion.titulo')}</span>
        {v.general && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${TONO[v.general].fondo} ${TONO[v.general].texto}`}>
            <span className={`h-2 w-2 rounded-full ${TONO[v.general].punto}`} aria-hidden />
            {t(general[v.general])}
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {p && lona && (
          <Linea s={p.semaforo}>
            {p.semaforo === 'verde'
              ? t('operaciones.imprenta.valoracion.proporcion.ajusta', { prop: nombreProporcion(lona.ancho / lona.alto) ?? '' })
              : p.semaforo === 'rojo'
                ? t('operaciones.imprenta.valoracion.proporcion.no-ajusta', {
                    pct: n(Math.round(p.pierde * 100)),
                    cm: n(Math.round(p.cmPorLado)),
                    prop: nombreProporcion(lona.ancho / lona.alto) ?? '',
                  })
                : t(
                    p.por === 'costados'
                      ? 'operaciones.imprenta.valoracion.proporcion.recorta-costados'
                      : 'operaciones.imprenta.valoracion.proporcion.recorta-arriba',
                    { cm: n(Math.round(p.cmPorLado)), pct: n(Math.round(p.pierde * 100)) },
                  )}
            {p.semaforo !== 'verde' && p.rellenoCmPorLado > 0.5 && (
              <span className="block text-muted">
                {t('operaciones.imprenta.valoracion.proporcion.relleno', { cm: n(Math.round(p.rellenoCmPorLado)) })}
              </span>
            )}
          </Linea>
        )}
        {r && pixeles && (
          <Linea s={r.semaforo}>
            {t(
              r.semaforo === 'verde'
                ? 'operaciones.imprenta.valoracion.resolucion.verde'
                : r.semaforo === 'ambar'
                  ? 'operaciones.imprenta.valoracion.resolucion.ambar'
                  : 'operaciones.imprenta.valoracion.resolucion.rojo',
              {
                dpi: n(r.dpi, r.dpi < 10 ? 1 : 0),
                px: px(pixeles.ancho, pixeles.alto),
                min: px(r.minimoPx.ancho, r.minimoPx.alto),
              },
            )}
            <span className="block text-muted">
              {t(
                r.escala === 'gran'
                  ? 'operaciones.imprenta.valoracion.resolucion.criterio-gran'
                  : 'operaciones.imprenta.valoracion.resolucion.criterio-cercana',
                { verde: n(umbralesDe(requisitos)[r.escala].verde) },
              )}
            </span>
          </Linea>
        )}
        {v.formato && (
          <Linea s={v.formato.semaforo}>
            {/* Tres textos para tres colores. Antes el rojo caía en el texto
                del ámbar y la pantalla decía «revísalo con la imprenta» de un
                formato que esa imprenta ya dijo que no recibe (hallazgo D,
                19/11). El rojo solo existe con la lista de la imprenta. */}
            {t(
              v.formato.semaforo === 'verde'
                ? 'operaciones.imprenta.valoracion.formato.verde'
                : v.formato.semaforo === 'rojo'
                  ? 'operaciones.imprenta.valoracion.formato.rojo'
                  : 'operaciones.imprenta.valoracion.formato.ambar',
              { nombre: v.formato.nombre, acepta: (requisitos.formatos ?? []).join(', ') },
            )}
          </Linea>
        )}
        {v.peso && (
          <Linea s={v.peso.semaforo}>
            {t(
              v.peso.semaforo === 'verde' ? 'operaciones.imprenta.valoracion.peso.verde' : 'operaciones.imprenta.valoracion.peso.rojo',
              { mb: n(v.peso.mb, 1), max: n(maxMb) },
            )}
          </Linea>
        )}
      </ul>
      {!lona && <p className="text-[12px] text-muted">{t('operaciones.imprenta.valoracion.sin-medida')}</p>}
      {lona && html && <p className="text-[12px] text-muted">{t('operaciones.imprenta.arte.html')}</p>}
      {lona && !html && !pixeles && <p className="text-[12px] text-muted">{t('operaciones.imprenta.valoracion.sin-pixeles')}</p>}
    </div>
  )
}

/**
 * La revisión completa: el selector «A sangre / Sin recortar», la lona a escala
 * y la valoración. Para un arte ya subido mide los píxeles al cargar la imagen;
 * al subir, se los pasa quien leyó el archivo (`pixeles`).
 */
export function RevisionArte({
  medida,
  src,
  imagen,
  pixeles: pixelesDados,
  tipo,
  bytes,
  creativo,
  maxMb = IMAGEN_CREATIVO_MAX_MB,
  requisitos = REQUISITOS_RESPALDO,
}: {
  medida: { ancho: number; alto: number } | null
  src: string | null
  imagen: boolean
  pixeles?: { ancho: number; alto: number } | null
  tipo?: string | null
  bytes?: number | null
  // Para pintar un creativo en código con `ArteEnSitio` (no se puede medir).
  creativo?: CreativoDeImpresion
  maxMb?: number
  // IMP-REQ (18/11) · los de la imprenta de la orden, o los de la empresa
  // (`resolverRequisitos`). Sin ellos, las constantes de siempre.
  requisitos?: Requisitos
}) {
  const { t, idioma } = useIdioma()
  const [modo, setModo] = useState<Modo>('cover')
  const [medidos, setMedidos] = useState<{ ancho: number; alto: number } | null>(null)
  const pixeles = pixelesDados ?? medidos

  useEffect(() => {
    if (pixelesDados !== undefined || !imagen || !src) return
    let vivo = true
    pixelesDeImagen(src).then((p) => vivo && setMedidos(p))
    return () => {
      vivo = false
    }
  }, [src, imagen, pixelesDados])

  const lona = medida && medida.ancho > 0 && medida.alto > 0 ? { ancho: medida.ancho, alto: medida.alto } : null
  const v = valorarArte(
    lona,
    { anchoPx: imagen ? pixeles?.ancho ?? null : null, altoPx: imagen ? pixeles?.alto ?? null : null, tipo, bytes },
    maxMb,
    requisitos,
  )
  const recorta = v.proporcion != null && v.proporcion.semaforo !== 'verde'

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-ink">{t('operaciones.imprenta.valoracion.vista')}</span>
          <div className="inline-flex rounded border border-border p-0.5 text-[12px]" role="group">
            {(['cover', 'contain'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={`rounded px-2 py-0.5 ${modo === m ? 'bg-ink text-surface' : 'text-muted hover:text-ink'}`}
              >
                {t(m === 'cover' ? 'operaciones.imprenta.arte.a-sangre' : 'operaciones.imprenta.arte.completo')}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-md bg-surface-2 p-3">
          {lona && imagen && src && pixeles ? (
            <LonaAEscala
              lona={lona}
              src={src}
              proporcionArte={pixeles.ancho / pixeles.alto}
              modo={modo}
              margenM={requisitos.margenCm / 100}
            />
          ) : creativo ? (
            <div className="flex justify-center">
              <ArteEnSitio
                key={`${creativo.id}-${modo}`}
                creativo={creativo}
                proporcion={lona ? lona.ancho / lona.alto : null}
                alto={220}
                modo={modo}
              />
            </div>
          ) : src && imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="mx-auto max-h-[260px] max-w-full object-contain" />
          ) : null}
        </div>
        {lona && imagen && pixeles && (
          <ul className="space-y-0.5 text-[11px] text-muted">
            {modo === 'cover' && recorta && <li>{t('operaciones.imprenta.valoracion.leyenda.recorte')}</li>}
            {modo === 'contain' && recorta && <li>{t('operaciones.imprenta.valoracion.leyenda.relleno')}</li>}
            <li>{t('operaciones.imprenta.valoracion.leyenda.margen', { cm: formatNumero(requisitos.margenCm, requisitos.margenCm % 1 ? 1 : 0, idioma) })}</li>
            <li>{t('operaciones.imprenta.valoracion.leyenda.persona', { m: formatNumero(PERSONA_M, 2, idioma) })}</li>
          </ul>
        )}
      </div>
      <div className="min-w-0">
        <PanelValoracion v={v} lona={lona} pixeles={imagen ? pixeles : null} html={!imagen} maxMb={maxMb} requisitos={requisitos} />
      </div>
    </div>
  )
}
