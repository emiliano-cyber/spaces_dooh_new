'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  creativosApi,
  fallasApi,
  type CreativosEquipo,
  type Falla,
  type PantallaEquipo,
} from '@/lib/data/space-eyes-api'
import { fechaHora, hace } from './piezas'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { dondeDeFallaEnIdioma, nombreDeFallaEnIdioma } from '@/lib/i18n/donde-falla'

// ============================================================================
//  Lo que el equipo descubre mirando SU pantalla, en la ficha del equipo.
// ----------------------------------------------------------------------------
//  Dos cosas que hace el propio teléfono (APK 0.15 en adelante), sin mandar
//  video ni fotos mientras todo está bien:
//
//    · FALLAS: gabinetes apagados o congelados, pantalla apagada en horario,
//      cámara movida. Avisa cuando lo confirma y cuando se arregla, con foto.
//    · CREATIVOS: reconoce cada anuncio que pasa y solo sube foto del que no
//      conocía. Es la prueba de qué estuvo al aire en esa pantalla.
//
//  Se piden aparte de la ficha (como el histórico) para no retrasar la foto,
//  que es lo que la gente viene a ver. Aquí solo se mira: cerrar una falla o
//  encender la vigilancia se hace en Space Eye.
// ============================================================================

// Las mismas claves que las fallas de la flota (`FallasFlota`).
const ESTADO: Record<Falla['estado'], { texto: ClaveTexto; clase: string }> = {
  abierta: { texto: 'spaceeyes.falla.estado.abierta', clase: 'bg-error-soft text-error' },
  recuperada: { texto: 'spaceeyes.falla.estado.recuperada', clase: 'bg-success-soft text-success' },
  descartada: { texto: 'spaceeyes.falla.estado.descartada', clase: 'bg-surface-2 text-muted' },
}

export function PantallaYCreativos({
  id,
  onAmpliar,
  soloFallas = false,
}: {
  id: number
  onAmpliar: (url: string) => void
  // En la ficha con pestañas los ajustes y los creativos tienen su lugar:
  // aquí solo queda el historial de fallas.
  soloFallas?: boolean
}) {
  const { t, idioma } = useIdioma()
  const [pantalla, setPantalla] = useState<PantallaEquipo | null>(null)
  const [creativos, setCreativos] = useState<CreativosEquipo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.all([fallasApi(id, idioma), creativosApi(id, idioma)])
      .then(([p, c]) => {
        if (!vivo) return
        setPantalla(p)
        setCreativos(c)
      })
      .catch((e: Error) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [id, idioma])

  if (error) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        {t('spaceeyes.pyc.error', { error })}
      </div>
    )
  }
  if (!pantalla || !creativos) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('spaceeyes.pyc.leyendo')}
      </div>
    )
  }

  const fallas = pantalla.fallas ?? []
  const abiertas = fallas.filter((f) => f.estado === 'abierta')
  const lista = creativos.creativos ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* ── Fallas ── */}
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-ink">{soloFallas ? t('spaceeyes.pyc.historial') : t('spaceeyes.pantalla.titulo')}</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {t('spaceeyes.pyc.descripcion')}
            </p>
          </div>
          <EstadoVigilancia
            disponible={pantalla.disponible}
            vigilando={!!pantalla.vigilando}
            aprendiendo={!!pantalla.aprendiendo}
          />
        </header>

        <div className="flex flex-col gap-3 p-3">
          {pantalla.disponible && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
              <span className="text-muted">
                {interpolarNodos(t('spaceeyes.pyc.pantalla'), {
                  valor: (
                    <span className="text-ink">
                      {pantalla.gabinetes
                        ? t('spaceeyes.pyc.gabinetes', { n: pantalla.gabinetes })
                        : t('spaceeyes.pyc.sin-marcar')}
                    </span>
                  ),
                })}
              </span>
              {pantalla.horario && (
                <span className="text-muted">
                  {interpolarNodos(t('spaceeyes.comun.encendida'), {
                    inicio: <span className="tabular-nums text-ink">{pantalla.horario.inicio}</span>,
                    fin: <span className="tabular-nums text-ink">{pantalla.horario.fin}</span>,
                  })}
                </span>
              )}
              <span className="text-muted">
                {interpolarNodos(t('spaceeyes.pyc.ultima-revision'), {
                  valor: (
                    <span className="text-ink">
                      {pantalla.ultimaRevision ? hace(pantalla.ultimaRevision.cuando, idioma) : t('spaceeyes.pyc.ninguna')}
                    </span>
                  ),
                })}
              </span>
            </div>
          )}

          {abiertas.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {abiertas.map((f) => (
                <div key={f.id} className="flex gap-3 rounded-md border border-border border-l-[3px] border-l-error p-2.5">
                  {f.evidenciaMini && (
                    <button
                      type="button"
                      onClick={() => onAmpliar(f.evidencia ?? f.evidenciaMini!)}
                      className="h-16 w-24 shrink-0 overflow-hidden rounded bg-surface-2"
                      title={t('spaceeyes.falla.ver-evidencia')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.evidenciaMini} alt={t('spaceeyes.falla.alt-evidencia')} className="h-full w-full object-cover" />
                    </button>
                  )}
                  <div className="min-w-0 text-[12px]">
                    <div className="flex items-center gap-1.5 font-semibold text-error">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {nombreDeFallaEnIdioma(f.nombre, idioma)}
                    </div>
                    <div className="mt-0.5 break-words text-ink">{dondeDeFallaEnIdioma(f.donde, idioma)}</div>
                    <div className="mt-0.5 text-muted">
                      {interpolarNodos(t('spaceeyes.pyc.detectada'), {
                        fecha: fechaHora(f.detectadaEn, idioma),
                        pct: <span className="tabular-nums">{Math.round(f.confianza * 100)}%</span>,
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            pantalla.disponible &&
            pantalla.vigilando && (
              <div className="flex items-center gap-2 text-[12px] text-success">
                <CheckCircle2 className="h-4 w-4" /> {t('spaceeyes.pyc.sin-abiertas')}
              </div>
            )
          )}

          {fallas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead className="border-b border-border text-left text-[11px] text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">{t('spaceeyes.falla.detectada')}</th>
                    <th className="pr-3 font-medium">{t('spaceeyes.falla.falla')}</th>
                    <th className="pr-3 font-medium">{t('spaceeyes.pyc.donde')}</th>
                    <th className="pr-3 font-medium">{t('spaceeyes.comun.estado')}</th>
                    <th className="pr-3 font-medium">{t('spaceeyes.pyc.cerrada')}</th>
                    <th className="font-medium">{t('spaceeyes.falla.evidencia')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fallas.map((f) => (
                    <tr key={f.id}>
                      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">{fechaHora(f.detectadaEn, idioma)}</td>
                      <td className="pr-3 text-ink">{nombreDeFallaEnIdioma(f.nombre, idioma)}</td>
                      <td className="pr-3 text-muted">{dondeDeFallaEnIdioma(f.donde, idioma)}</td>
                      <td className="pr-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px]', ESTADO[f.estado]?.clase)}>
                          {ESTADO[f.estado] ? t(ESTADO[f.estado].texto) : f.estado}
                        </span>
                      </td>
                      <td className="whitespace-nowrap pr-3 tabular-nums text-muted">
                        {f.recuperadaEn
                          ? `${fechaHora(f.recuperadaEn, idioma)}${f.cerradaPor === 'usuario' ? t('spaceeyes.falla.a-mano') : ''}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        {f.evidencia && (
                          <button type="button" onClick={() => onAmpliar(f.evidencia!)} className="text-accent hover:underline">
                            {t('spaceeyes.falla.al-detectar')}
                          </button>
                        )}
                        {f.evidenciaRecuperacion && (
                          <button
                            type="button"
                            onClick={() => onAmpliar(f.evidenciaRecuperacion!)}
                            className="ml-2 text-accent hover:underline"
                          >
                            {t('spaceeyes.falla.al-recuperar')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pantalla.disponible && !pantalla.vigilando && fallas.length === 0 && (
            <p className="text-[12px] text-muted">
              {t('spaceeyes.pyc.sin-vigilar')}
            </p>
          )}
          {!pantalla.disponible && <p className="text-[12px] text-muted">{t('spaceeyes.pyc.sin-datos')}</p>}
        </div>
      </section>

      {/* ── Creativos ── */}
      {!soloFallas && (
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.pyc.creativos')}</h2>
            <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.pyc.creativos.texto')}</p>
          </div>
          <EstadoVigilancia
            disponible={creativos.disponible}
            vigilando={!!creativos.vigilando}
            aprendiendo={!!creativos.aprendiendo}
          />
        </header>
        <div className="p-3">
          {lista.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {lista.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => c.foto && onAmpliar(c.foto)}
                  className="overflow-hidden rounded-md border border-border text-left hover:border-accent"
                >
                  <div className="aspect-[4/3] bg-surface-2">
                    {c.foto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.foto} alt={t('spaceeyes.creativo.alt')} className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="border-t border-border px-2 py-1.5 text-[11px]">
                    <div className="text-ink">{t('spaceeyes.creativo.aparecio', { fecha: fechaHora(c.primeraVez, idioma) })}</div>
                    <div className="text-muted">
                      {interpolarNodos(t(c.vistas === 1 ? 'spaceeyes.creativo.visto.uno' : 'spaceeyes.creativo.visto.otros'), {
                        n: <span className="tabular-nums">{c.vistas}</span>,
                        hace: hace(c.ultimaVez, idioma),
                      })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted">
              {creativos.vigilando ? t('spaceeyes.creativo.ninguno') : t('spaceeyes.pyc.sin-vigilar-creativos')}
            </p>
          )}
        </div>
      </section>
      )}
    </div>
  )
}

function EstadoVigilancia({ disponible, vigilando, aprendiendo }: { disponible: boolean; vigilando: boolean; aprendiendo: boolean }) {
  const t = useIdioma().t
  const [texto, clase]: [ClaveTexto, string] = !disponible
    ? ['spaceeyes.pyc.sin-datos-corto', 'bg-surface-2 text-muted']
    : !vigilando
      ? ['spaceeyes.pyc.apagada', 'bg-surface-2 text-muted']
      : aprendiendo
        ? ['spaceeyes.vigilancia.aprendiendo', 'bg-accent-soft text-accent']
        : ['spaceeyes.vigilancia.vigilando', 'bg-success-soft text-success']
  return <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium', clase)}>{t(texto)}</span>
}
