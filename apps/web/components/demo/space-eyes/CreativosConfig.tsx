'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { seApi, fotoSE, ErrorSE, textoDeError } from '@/lib/data/space-eyes-se'
import { fechaHora, gigas, hace } from './piezas'
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { interpolarNodos } from '@/lib/i18n/nodos'

// ============================================================================
//  CreativosConfig — la vigilancia de creativos de un equipo, en su parte de
//  AJUSTES: encenderla, cada cuánto mira (o en continuo), cuándo manda las
//  fotos nuevas (al momento o juntas cada 2/4/8/12 h), los datos del mes contra
//  el tope de 4 GB, volver a aprender y descartar un hallazgo que no era un
//  creativo nuevo («No es nuevo»).
// ----------------------------------------------------------------------------
//  Props:
//    equipoId     id del equipo en Space Eye.
//    puedeOperar  false = solo mirar: sin interruptor, sin frecuencia, sin
//                 «Volver a aprender» ni «No es nuevo».
//    onAmpliar?   opcional; recibe la URL de la foto de un creativo para verla
//                 en grande (el visor de la ficha). Sin ella, la miniatura no
//                 es un botón.
//    onCambio?    opcional; se llama después de guardar algo, para que quien la
//                 integra refresque la vista de solo lectura de los creativos.
//
//  Habla con Space Eye por su puerta: GET/PUT devices/:id/creativos, POST
//  devices/:id/creativos/reaprender, PUT creativos/:id, GET devices/:id (versión
//  del agente) y GET devices/:id/pantalla (si ya se marcó la pantalla).
// ============================================================================

type Config = {
  vigilar: boolean
  aprendiendo: boolean
  aprendizaje_min: number
  desde: string | null
  max_dia: number
  cada_min: number
  // 0 = al momento; si no, juntas cada N minutos (una por creativo, la más
  // nítida). Space Eye viejo no lo manda: cuenta como «al momento».
  envio_min?: number
}
type Creativo = {
  id: number
  photo_id: number | null
  descartado: number | boolean
  primera_vez: string
  ultima_vez: string
  vistas: number
  thumbnail_path: string | null
  storage_path: string | null
}
type Resp = { config: Config | null; fotos_hoy: number; creativos: Creativo[] }

// Cuándo manda las fotos nuevas. Mirar no cambia: el equipo sigue mirando
// todo el tiempo y no se le escapa un creativo que sale una sola vez.
const ENVIO: { v: number; t: ClaveTexto }[] = [
  { v: 0, t: 'spaceeyes.creativos.envio.0' },
  { v: 120, t: 'spaceeyes.creativos.envio.120' },
  { v: 240, t: 'spaceeyes.creativos.envio.240' },
  { v: 480, t: 'spaceeyes.creativos.envio.480' },
  { v: 720, t: 'spaceeyes.creativos.envio.720' },
]

// El tope de datos del chip por equipo y mes (plan contratado hoy).
const TOPE_MES = 4 * 1024 ** 3

const FRECUENCIA: { v: number; t: ClaveTexto }[] = [
  { v: 0, t: 'spaceeyes.creativos.frecuencia.0' },
  { v: 30, t: 'spaceeyes.frecuencia.30' },
  { v: 60, t: 'spaceeyes.frecuencia.60' },
  { v: 120, t: 'spaceeyes.frecuencia.120' },
  { v: 180, t: 'spaceeyes.frecuencia.180' },
  { v: 360, t: 'spaceeyes.frecuencia.360' },
  { v: 720, t: 'spaceeyes.frecuencia.720' },
]

// La APK desde la 0.15.0 y la Raspberry saben vigilar; el agente de PC no.
function sabeVigilar(version: string | null | undefined): boolean {
  const v = String(version || '')
  if (/^pi-agent/i.test(v)) return true
  if (/^pc-agent/i.test(v)) return false
  const [a, b] = v.split('.').map(Number)
  return a > 0 || (a === 0 && b >= 15)
}
// Solo la APK usa la pantalla marcada; la Raspberry mira la foto entera.
function usaPantalla(version: string | null | undefined): boolean {
  return sabeVigilar(version) && !/^pi-agent/i.test(String(version || ''))
}

// Los datos del chip en el mes contra el tope de 4 GB. Las fotos son lo de
// menos: casi todo se va en la vista en vivo.
function MedidorMes({ bytes }: { bytes: number | null }) {
  const t = useIdioma().t
  const pct = bytes == null ? 0 : Math.min(100, (bytes / TOPE_MES) * 100)
  const tono = pct >= 90 ? 'bg-error' : pct >= 70 ? 'bg-warning' : 'bg-success'
  return (
    <div
      className="col-span-2 rounded-md border border-border p-3"
      title={t('spaceeyes.creativos.mes.ayuda')}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.creativos.mes')}</p>
      {bytes == null ? (
        <p className="mt-1.5 text-[12px] text-muted">{t('spaceeyes.creativos.mes.sin')}</p>
      ) : (
        <>
          <p className="mt-1 text-lg tabular-nums text-ink">
            {gigas(bytes)}
            <span className="text-muted"> / 4 GB</span>
          </p>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="meter"
            aria-label={t('spaceeyes.creativos.mes')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <div className={cn('h-full rounded-full', tono)} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  )
}

function mensaje(e: unknown, idioma: Idioma): string {
  if (e instanceof ErrorSE && e.status === 403) return traducir(idioma, 'spaceeyes.comun.sin-permiso-cambiar')
  return textoDeError(e, idioma) ?? String(e)
}

export function CreativosConfig({
  equipoId,
  puedeOperar,
  onAmpliar,
  onCambio,
}: {
  equipoId: number
  puedeOperar: boolean
  onAmpliar?: (url: string) => void
  onCambio?: () => void
}) {
  const { t, idioma } = useIdioma()
  const [datos, setDatos] = useState<Resp | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  // Bytes del chip en el mes (lo reporta el equipo con su telemetría).
  const [datosMes, setDatosMes] = useState<number | null>(null)
  const [marcada, setMarcada] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [reaprender, setReaprender] = useState(false)
  const [reaprendiendo, setReaprendiendo] = useState(false)
  const [descartando, setDescartando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const r = await seApi<Resp>(`devices/${equipoId}/creativos`)
    setDatos(r)
    return r
  }, [equipoId])

  useEffect(() => {
    let vivo = true
    setError(null)
    Promise.all([
      seApi<Resp>(`devices/${equipoId}/creativos`),
      seApi<{
        device: { app_version: string | null }
        data_usage?: { mobile_month?: number | string | null } | null
      }>(`devices/${equipoId}`),
      seApi<{ pantalla: unknown }>(`devices/${equipoId}/pantalla`).catch(() => ({ pantalla: true })),
    ])
      .then(([c, d, p]) => {
        if (!vivo) return
        setDatos(c)
        setVersion(d.device?.app_version ?? null)
        const mes = d.data_usage?.mobile_month
        setDatosMes(mes == null || mes === '' ? null : Number(mes))
        setMarcada(!!p.pantalla)
      })
      .catch((e) => vivo && setError(mensaje(e, idioma)))
    return () => {
      vivo = false
    }
  }, [equipoId, idioma])

  async function guardar(cambios: Partial<Pick<Config, 'vigilar' | 'cada_min' | 'envio_min'>>) {
    setGuardando(true)
    setAviso(null)
    try {
      await seApi(`devices/${equipoId}/creativos`, { method: 'PUT', body: cambios })
      await cargar()
      onCambio?.()
    } catch (e) {
      setAviso(t('spaceeyes.comun.no-guardar', { motivo: mensaje(e, idioma) }))
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarReaprender() {
    setReaprendiendo(true)
    setAviso(null)
    try {
      await seApi(`devices/${equipoId}/creativos/reaprender`, { method: 'POST', body: {} })
      await cargar()
      onCambio?.()
      setReaprender(false)
    } catch (e) {
      setReaprender(false)
      setAviso(t('spaceeyes.creativos.no-reiniciar', { motivo: mensaje(e, idioma) }))
    } finally {
      setReaprendiendo(false)
    }
  }

  async function descartar(c: Creativo) {
    setDescartando(c.id)
    setAviso(null)
    try {
      await seApi(`creativos/${c.id}`, { method: 'PUT', body: { descartado: true } })
      await cargar()
      onCambio?.()
    } catch (e) {
      setAviso(t('spaceeyes.creativos.no-descartar', { motivo: mensaje(e, idioma) }))
    } finally {
      setDescartando(null)
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        {t('spaceeyes.creativos.error', { error })}
      </div>
    )
  }
  if (!datos) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('spaceeyes.creativos.leyendo')}
      </div>
    )
  }

  const cfg = datos.config
  const sabe = sabeVigilar(version)
  const vigilar = !!cfg?.vigilar
  // Los que tienen foto son los hallazgos; los demás son el loop que se
  // aprendió (o huellas sin foto por el tope diario).
  const hallazgos = (datos.creativos ?? []).filter((c) => c.photo_id && !c.descartado)
  const finAprendizaje =
    cfg?.desde != null
      ? fechaHora(new Date(new Date(cfg.desde).getTime() + Number(cfg.aprendizaje_min ?? 120) * 60_000).toISOString(), idioma)
      : ''

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.creativos.titulo')}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.creativos.descripcion')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              !vigilar
                ? 'bg-surface-2 text-muted'
                : cfg?.aprendiendo
                  ? 'bg-accent-soft text-accent'
                  : 'bg-success-soft text-success',
            )}
          >
            {!vigilar
              ? t('spaceeyes.comun.apagado')
              : cfg?.aprendiendo
                ? t('spaceeyes.vigilancia.aprendiendo')
                : cfg?.cada_min === 0
                  ? t('spaceeyes.creativos.continuo')
                  : t('spaceeyes.vigilancia.vigilando')}
          </span>
          <Interruptor
            etiqueta={t('spaceeyes.creativos.vigilar')}
            activo={vigilar}
            deshabilitado={!puedeOperar || !sabe || guardando}
            onCambio={(v) => guardar({ vigilar: v })}
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {!sabe && (
          <Aviso tono="alerta">
            {t('spaceeyes.creativos.no-sabe')}
          </Aviso>
        )}
        {usaPantalla(version) && !marcada && (
          <Aviso tono="alerta">
            {t('spaceeyes.creativos.sin-marcar')}
          </Aviso>
        )}
        {aviso && <Aviso tono="falla">{aviso}</Aviso>}

        {vigilar && cfg && (
          <>
            {cfg.aprendiendo && (
              <Aviso tono="info">
                {interpolarNodos(t('spaceeyes.creativos.aprendiendo'), {
                  fin: <span className="font-medium">{finAprendizaje}</span>,
                })}
              </Aviso>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.creativos.fotos-hoy')}</p>
                <p className="mt-1 text-lg tabular-nums text-ink">
                  {datos.fotos_hoy}
                  <span className="text-muted"> / {cfg.max_dia}</span>
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.creativos.catalogo')}</p>
                <p className="mt-1 text-lg tabular-nums text-ink">{(datos.creativos ?? []).length}</p>
              </div>
              <div
                className="col-span-2 rounded-md border border-border p-3"
                title={t('spaceeyes.creativos.frecuencia.ayuda')}
              >
                <label htmlFor={`cre-frec-${equipoId}`} className="text-[11px] uppercase tracking-wide text-muted">
                  {t('spaceeyes.comun.frecuencia')}
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <select
                    id={`cre-frec-${equipoId}`}
                    value={cfg.cada_min}
                    disabled={!puedeOperar || guardando}
                    onChange={(e) => guardar({ cada_min: Number(e.target.value) })}
                    className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-surface-2 disabled:text-muted"
                  >
                    {(FRECUENCIA.some((o) => o.v === cfg.cada_min)
                      ? FRECUENCIA.map((o) => ({ v: o.v, t: t(o.t) }))
                      : [...FRECUENCIA.map((o) => ({ v: o.v, t: t(o.t) })), { v: cfg.cada_min, t: t('spaceeyes.frecuencia.otra', { n: cfg.cada_min }) }]
                    ).map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.t}
                      </option>
                    ))}
                  </select>
                  {puedeOperar && (
                    <Button size="sm" variant="danger" onClick={() => setReaprender(true)}>
                      {t('spaceeyes.creativos.reaprender')}
                    </Button>
                  )}
                </div>
              </div>

              <div
                className="col-span-2 rounded-md border border-border p-3"
                title={t('spaceeyes.creativos.envio.ayuda')}
              >
                <label htmlFor={`cre-envio-${equipoId}`} className="text-[11px] uppercase tracking-wide text-muted">
                  {t('spaceeyes.creativos.envio')}
                </label>
                <div className="mt-1.5">
                  <select
                    id={`cre-envio-${equipoId}`}
                    value={cfg.envio_min ?? 0}
                    disabled={!puedeOperar || guardando}
                    onChange={(e) => guardar({ envio_min: Number(e.target.value) })}
                    className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-surface-2 disabled:text-muted"
                  >
                    {(ENVIO.some((o) => o.v === (cfg.envio_min ?? 0))
                      ? ENVIO.map((o) => ({ v: o.v, t: t(o.t) }))
                      : [
                          ...ENVIO.map((o) => ({ v: o.v, t: t(o.t) })),
                          { v: cfg.envio_min ?? 0, t: t('spaceeyes.creativos.envio.otra', { n: cfg.envio_min ?? 0 }) },
                        ]
                    ).map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.t}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {t('spaceeyes.creativos.envio.pie')}
                  </p>
                </div>
              </div>

              <MedidorMes bytes={datosMes} />
            </div>

            {cfg.cada_min > 0 && (
              <Aviso tono="info">
                {t('spaceeyes.creativos.intervalos')}
              </Aviso>
            )}

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.creativos.nuevos')}</p>
              {hallazgos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                  {hallazgos.map((c) => {
                    const mini = fotoSE(c.thumbnail_path || c.storage_path)
                    const grande = fotoSE(c.storage_path || c.thumbnail_path)
                    const imagen = mini ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mini} alt={t('spaceeyes.creativo.alt')} className="h-full w-full object-contain" />
                    ) : null
                    return (
                      <div key={c.id} className="overflow-hidden rounded-md border border-border">
                        {onAmpliar && grande ? (
                          <button
                            type="button"
                            onClick={() => onAmpliar(grande)}
                            className="block aspect-[4/3] w-full bg-surface-2"
                            title={t('spaceeyes.comun.ver-grande')}
                          >
                            {imagen}
                          </button>
                        ) : (
                          <div className="aspect-[4/3] bg-surface-2">{imagen}</div>
                        )}
                        <div className="border-t border-border px-2 py-1.5 text-[11px]">
                          <div className="text-ink">{t('spaceeyes.creativo.aparecio', { fecha: fechaHora(c.primera_vez, idioma) })}</div>
                          <div className="text-muted">
                            {interpolarNodos(t(c.vistas === 1 ? 'spaceeyes.creativo.visto.uno' : 'spaceeyes.creativo.visto.otros'), {
                              n: <span className="tabular-nums">{c.vistas}</span>,
                              hace: hace(c.ultima_vez, idioma),
                            })}
                          </div>
                          {puedeOperar && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="mt-1.5 w-full"
                              disabled={descartando === c.id}
                              title={t('spaceeyes.creativos.no-nuevo.ayuda')}
                              onClick={() => descartar(c)}
                            >
                              {descartando === c.id ? t('spaceeyes.creativos.descartando') : t('spaceeyes.creativos.no-nuevo')}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border-strong py-6 text-center text-[12px] text-muted">
                  {t('spaceeyes.creativo.ninguno')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={reaprender}
        onOpenChange={setReaprender}
        title={t('spaceeyes.creativos.reaprender.titulo')}
        confirmLabel={t('spaceeyes.creativos.reaprender')}
        busy={reaprendiendo}
        onConfirm={() => void confirmarReaprender()}
      >
        {t('spaceeyes.creativos.reaprender.texto')}
      </ConfirmDialog>
    </section>
  )
}

function Interruptor({
  etiqueta,
  activo,
  deshabilitado,
  onCambio,
}: {
  etiqueta: string
  activo: boolean
  deshabilitado?: boolean
  onCambio: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => onCambio(!activo)}
      className="inline-flex items-center gap-2 text-[13px] text-ink disabled:pointer-events-none disabled:text-muted"
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150',
          activo ? 'border-accent bg-accent' : 'border-border-strong bg-surface-2',
          deshabilitado && 'opacity-60',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-surface transition-transform duration-150',
            activo ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </span>
      {etiqueta}
    </button>
  )
}

function Aviso({ tono, children }: { tono: 'info' | 'alerta' | 'falla'; children: React.ReactNode }) {
  const estilo = {
    info: 'border-l-accent bg-accent-soft',
    alerta: 'border-l-warning bg-warning-soft',
    falla: 'border-l-error bg-error-soft',
  }[tono]
  const Icono = tono === 'info' ? Info : AlertTriangle
  const color = { info: 'text-accent', alerta: 'text-warning', falla: 'text-error' }[tono]
  return (
    <div className={cn('flex items-start gap-2 rounded-md border border-border border-l-[3px] p-2.5 text-[12px] text-ink', estilo)}>
      <Icono className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', color)} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
