'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { ShieldCheck, Send, Check, X, Clock, Images, Code2, Trash2, AlertTriangle, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  StatusBadge,
  VALIDACION_PUB_TONO,
  CREATIVIDAD_TONO,
} from '@/components/demo/StatusBadge'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useCampana, useCreatividades, formatFechaHora } from '@/lib/data/client'
import { enviarADominioApi, validarPublicacionApi, reintentarPublicacionApi, eliminarCreatividadApi } from '@/lib/data/estado-api'
import type { Creatividad } from '@/lib/data/types'
import { Button } from '@/components/demo/ui/Button'
import { resumirPublicacion, type ResumenPublicacion, type RespuestaPublicacion } from '@/lib/doohmain-resultado'
import { mostrarAvisoPantallaDoohmain } from '@/lib/doohmain-aviso'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { useIdioma, useTexto } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { ProgramacionDoohmain } from './ProgramacionDoohmain'
import { CLAVE_CREATIVIDAD, CLAVE_VALIDACION_PUB } from './etiquetas'

// El recordatorio de no tener la pantalla abierta en el sitio de DOOHmain
// (pedido del dueño, 22/10). Ámbar, como los demás avisos que piden hacer algo.
function AvisoPantalla({ className }: { className?: string }) {
  // El texto es el de `AVISO_PANTALLA_DOOHMAIN` (lib/doohmain-aviso.ts), con su
  // clave: `textos/campanas.test.ts` exige que el espanol sea identico.
  const t = useTexto()
  return (
    <p
      role="note"
      className={cn(
        'flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{t('campanas.validacion.aviso-pantalla')}</span>
    </p>
  )
}

// Panel de validación de publicación: se envía la campaña al dominio/CMS y un
// revisor verifica la información de los anuncios antes de que salga al aire.
export function ValidacionPanel({ campanaId }: { campanaId: string }) {
  const c = useCampana(campanaId)
  const creatividades = useCreatividades()
  const puede = usePuede('comercial', 'crear')
  const { t, idioma } = useIdioma()
  const [busy, setBusy] = useState(false)
  const [busyCr, setBusyCr] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<Creatividad | null>(null)
  const [confirmarAprobar, setConfirmarAprobar] = useState(false)
  // Lo que respondió DOOHmain en ESTA aprobación. No se guarda: al recargar
  // queda el renglón de Actividad, que nombra las pantallas que fallaron.
  const [publicacion, setPublicacion] = useState<ResumenPublicacion | null>(null)
  const [confirmarReintento, setConfirmarReintento] = useState(false)

  if (!c) return <div className="h-40 w-full animate-pulse rounded-md bg-surface-2" />

  const creas = (creatividades ?? []).filter((cr) => cr.campanaId === campanaId)
  const validadas = creas.filter((cr) => cr.estatusValidacion === 'VALIDADA' && !cr.retiradoEn)
  const requiereCreativos = c.tipoCampana === 'DOOH' || c.tipoCampana === 'HIBRIDA'
  const aprobada = c.validacionEstatus === 'APROBADA'

  async function enviar() {
    setBusy(true)
    try {
      await enviarADominioApi(campanaId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('campanas.validacion.no-enviar'))
    }
    setBusy(false)
  }

  async function validar(aprobar: boolean) {
    let motivo: string | undefined
    if (!aprobar) {
      motivo = window.prompt(t('campanas.validacion.motivo-prompt')) ?? undefined
      if (motivo === undefined) return // canceló el prompt
    }
    setBusy(true)
    try {
      const r = await validarPublicacionApi(campanaId, aprobar, motivo)
      // Antes se descartaba `r.doohmain` y la ficha decía «aprobada» aunque
      // ninguna pantalla recibiera nada (13/10). Solo aplica a lo que tiene
      // segmento digital: una OOH no pasa por DOOHmain.
      if (aprobar && requiereCreativos) mostrarPublicacion(r.doohmain)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('campanas.validacion.no-validar'))
    }
    setBusy(false)
  }

  function mostrarPublicacion(r: RespuestaPublicacion) {
    const res = resumirPublicacion(r)
    setPublicacion(res)
    // Las de otro CMS no cuentan: no fueron a DOOHmain.
    const publicadas = res.filas.length - res.omitidas
    if (res.tipo === 'ok' && res.filas.length === res.omitidas) toast.info(t('campanas.validacion.toast.ninguna'))
    else if (res.tipo === 'ok')
      toast.success(
        t(publicadas === 1 ? 'campanas.validacion.toast.publicada.uno' : 'campanas.validacion.toast.publicada.otros', {
          n: publicadas,
        }),
      )
    else if (res.tipo === 'parcial')
      toast.warning(
        t(res.fallidas === 1 ? 'campanas.validacion.toast.parcial.uno' : 'campanas.validacion.toast.parcial.otros', {
          n: res.fallidas,
        }),
      )
    else if (res.tipo === 'error') toast.error(t('campanas.validacion.toast.error'))
  }

  async function reintentar() {
    setBusy(true)
    try {
      mostrarPublicacion((await reintentarPublicacionApi(campanaId)).doohmain)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('campanas.validacion.no-republicar'))
    }
    setBusy(false)
  }

  // Baja un creativo desde la campaña: lo elimina y, si estaba publicado, lo
  // retira de DOOHmain. Confirmación con diálogo (no window.confirm).
  async function confirmarBajar() {
    const cr = confirmar
    if (!cr) return
    setBusyCr(cr.id)
    try {
      const res = await eliminarCreatividadApi(cr.id)
      toast.success(
        res?.pendienteEnDoohmain
          ? t('campanas.validacion.retirado.toast', { nombre: cr.nombre })
          : t('campanas.validacion.bajado.toast', { nombre: cr.nombre }),
      )
      setConfirmar(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('campanas.validacion.no-bajar'))
    }
    setBusyCr(null)
  }

  return (
    <div
      className={cn(
        'rounded-md border p-4',
        aprobada ? 'border-[#10b98140] bg-[#10b9810d]' : 'border-border bg-surface',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className={cn('h-4 w-4', aprobada ? 'text-success' : 'text-muted')}
            strokeWidth={1.75}
          />
          <span className="text-[13px] font-medium text-ink">{t('campanas.validacion.titulo')}</span>
        </div>
        <StatusBadge tono={VALIDACION_PUB_TONO[c.validacionEstatus]}>
          {t(CLAVE_VALIDACION_PUB[c.validacionEstatus])}
        </StatusBadge>
      </div>

      {/* Estado de envío al dominio */}
      <ul className="space-y-2">
        <Condicion ok={c.enviadaDominio} label={t('campanas.validacion.enviada')} />
        {requiereCreativos && (
          <Condicion
            ok={creas.length > 0}
            label={t('campanas.validacion.anuncios', { validadas: validadas.length, total: creas.length })}
          />
        )}
      </ul>

      {/* Información de los anuncios a verificar */}
      {creas.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[12px] font-medium text-muted">
            {t('campanas.validacion.informacion')}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {creas.map((cr) => (
              <div
                key={cr.id}
                className={`overflow-hidden rounded border border-border ${cr.retiradoEn ? 'opacity-60' : ''}`}
              >
                <Miniatura cr={cr} />
                <div className="space-y-1 p-1.5">
                  <div className="truncate text-[11px] text-ink" title={cr.nombre}>
                    {cr.nombre}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    {cr.retiradoEn ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b40] bg-warning-soft px-1.5 py-0 text-[10px] font-medium text-[#9a6700]"
                        title={t('campanas.validacion.retirado.title')}
                      >
                        <AlertTriangle className="h-2.5 w-2.5" /> {t('campanas.validacion.retirado')}
                      </span>
                    ) : (
                      <StatusBadge tono={CREATIVIDAD_TONO[cr.estatusValidacion]} className="px-1.5 py-0 text-[10px]">
                        {t(CLAVE_CREATIVIDAD[cr.estatusValidacion])}
                      </StatusBadge>
                    )}
                    {puede && !cr.retiradoEn && (
                      <button
                        type="button"
                        title={t('campanas.validacion.bajar.title')}
                        disabled={busyCr === cr.id}
                        onClick={() => setConfirmar(cr)}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-error transition-colors hover:bg-error-soft disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sello de validación / motivo de rechazo */}
      {c.validacionEstatus !== 'PENDIENTE' && c.validacionEn && (
        <div className="mt-3 flex items-start gap-2 rounded border border-border bg-surface-2 p-2 text-[11px]">
          {aprobada ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          ) : (
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
          )}
          <div className="text-muted">
            {interpolarNodos(t(aprobada ? 'campanas.validacion.sello.aprobada' : 'campanas.validacion.sello.rechazada'), {
              por: <span className="text-ink">{c.validacionPor ?? '—'}</span>,
              fecha: formatFechaHora(c.validacionEn, idioma),
            })}
            {!aprobada && c.validacionMotivo ? (
              <div className="mt-0.5 text-error">{t('campanas.validacion.motivo', { motivo: c.validacionMotivo })}</div>
            ) : null}
          </div>
        </div>
      )}

      {/* Lo que SE VA a mandar a DOOHmain, antes de mandarlo (22/10): horario de
          la franja si la hay y reproducciones por día y en total. */}
      {requiereCreativos && (
        <ProgramacionDoohmain
          campanaId={campanaId}
          clave={[
            c.validacionEstatus,
            c.enviadaDominio,
            creas.map((cr) => `${cr.id}:${cr.estatusValidacion}`).join(','),
          ].join('|')}
        />
      )}

      {/* Lo que respondió DOOHmain, pantalla por pantalla */}
      {publicacion && <ResultadoDoohmain r={publicacion} />}

      {/* Acciones */}
      {puede && (
        <div className="mt-3">
          {!c.enviadaDominio ? (
            <Button
              type="button"
              disabled={busy}
              onClick={enviar}
              size="sm"
              className="w-full"
            >
              <Send className="h-3.5 w-3.5" />
              {busy
                ? t('campanas.validacion.enviando')
                : c.validacionEstatus === 'RECHAZADA'
                  ? t('campanas.validacion.corregir')
                  : t('campanas.validacion.enviar')}
            </Button>
          ) : c.validacionEstatus === 'PENDIENTE' ? (
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => (requiereCreativos ? setConfirmarAprobar(true) : validar(true))}
                size="sm"
                className="flex-1"
              >
                <Check className="h-3.5 w-3.5" /> {t('campanas.validacion.aprobar')}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => validar(false)}
                size="sm"
                variant="danger"
                className="flex-1"
              >
                <X className="h-3.5 w-3.5" /> {t('campanas.validacion.rechazar')}
              </Button>
            </div>
          ) : aprobada && requiereCreativos ? (
            // Sin esto, una publicación que falló en DOOHmain no tenía vuelta
            // desde la aplicación (pedido del dueño, 13/10).
            <Button
              type="button"
              disabled={busy}
              onClick={() => setConfirmarReintento(true)}
              size="sm"
              variant="secondary"
              className="w-full"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {busy ? t('campanas.validacion.publicando') : t('campanas.validacion.republicar')}
            </Button>
          ) : null}
        </div>
      )}

      {mostrarAvisoPantallaDoohmain({
        puede,
        requiereCreativos,
        enviadaDominio: c.enviadaDominio,
        estatus: c.validacionEstatus,
      }) && <AvisoPantalla className="mt-3" />}

      {!c.enviadaDominio && c.validacionEstatus === 'PENDIENTE' && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t(
              validadas.length === 0
                ? 'campanas.validacion.pendiente.sin'
                : validadas.length === 1
                  ? 'campanas.validacion.pendiente.uno'
                  : 'campanas.validacion.pendiente.otros',
              { n: validadas.length },
            )}
          </span>
        </p>
      )}

      <ConfirmDialog
        open={confirmar !== null}
        onOpenChange={(v) => !v && setConfirmar(null)}
        title={t('campanas.validacion.bajar.titulo')}
        confirmLabel={t('campanas.validacion.bajar.si')}
        busy={busyCr !== null && busyCr === confirmar?.id}
        onConfirm={confirmarBajar}
      >
        {interpolarNodos(t('campanas.validacion.bajar.texto'), {
          nombre: <span className="font-medium text-ink">“{confirmar?.nombre}”</span>,
          arte: <span className="text-ink">{t('campanas.validacion.bajar.arte')}</span>,
        })}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmarAprobar}
        onOpenChange={setConfirmarAprobar}
        title={t('campanas.validacion.aprobar.titulo')}
        confirmLabel={t('campanas.validacion.aprobar.si')}
        busy={busy}
        onConfirm={async () => {
          await validar(true)
          setConfirmarAprobar(false)
        }}
      >
        {interpolarNodos(t('campanas.validacion.aprobar.texto'), {
          noSe: <span className="font-medium text-ink">{t('campanas.validacion.aprobar.no-se')}</span>,
          manual: <span className="text-ink">{t('campanas.validacion.aprobar.manual')}</span>,
        })}
        <AvisoPantalla className="mt-3" />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmarReintento}
        onOpenChange={setConfirmarReintento}
        title={t('campanas.validacion.republicar')}
        confirmLabel={t('campanas.validacion.republicar.si')}
        variant="primary"
        busy={busy}
        onConfirm={async () => {
          await reintentar()
          setConfirmarReintento(false)
        }}
      >
        {interpolarNodos(t('campanas.validacion.republicar.texto'), {
          hoy: <span className="font-medium text-ink">{t('campanas.validacion.republicar.hoy')}</span>,
        })}
        <AvisoPantalla className="mt-3" />
      </ConfirmDialog>
    </div>
  )
}

function Miniatura({ cr }: { cr: Creatividad }) {
  // HTML (formato o data:text/html) → iframe; <img> no puede pintar HTML.
  const esHtml = cr.formato === 'HTML' || (cr.archivoUrl ?? '').startsWith('data:text/html')
  if (cr.archivoUrl && esHtml) {
    return <iframe title={cr.nombre} src={cr.archivoUrl} sandbox="" className="h-16 w-full border-0 bg-white" />
  }
  if (cr.archivoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cr.archivoUrl} alt={cr.nombre} className="h-16 w-full object-cover" />
  }
  if (cr.codigo) {
    return <iframe title={cr.nombre} srcDoc={cr.codigo} sandbox="" className="h-16 w-full border-0 bg-white" />
  }
  return (
    <div className="flex h-16 w-full items-center justify-center bg-surface-2 text-muted">
      {cr.codigo ? <Code2 className="h-5 w-5" /> : <Images className="h-5 w-5" />}
    </div>
  )
}

function Condicion({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full',
          ok ? 'bg-success text-white' : 'bg-surface-2 text-muted',
        )}
      >
        {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={ok ? 'text-ink' : 'text-muted'}>{label}</span>
    </li>
  )
}

const NOMBRE_CMS: Record<string, string> = { BROADSIGN: 'Broadsign', INVIDIS: 'Invidis' }

const ESTADO_PUBLICACION: Record<string, ClaveTexto> = {
  published: 'campanas.validacion.resultado.publicada',
  already_published: 'campanas.validacion.resultado.ya-publicada',
  otro_cms: 'campanas.validacion.resultado.otro-cms',
}

function ResultadoDoohmain({ r }: { r: ResumenPublicacion }) {
  const t = useTexto()
  const tono =
    r.tipo === 'ok' ? 'border-success/40 bg-success-soft'
    : r.tipo === 'parcial' || r.tipo === 'apagada' ? 'border-warning/40 bg-warning-soft'
    : r.tipo === 'error' ? 'border-error/40 bg-error-soft'
    : 'border-border bg-surface-2'
  const titulo =
    r.tipo === 'apagada' ? t('campanas.validacion.resultado.apagada')
    : r.tipo === 'sin-pantallas' ? t('campanas.validacion.resultado.sin-pantallas')
    : r.tipo === 'error' && !r.filas.length
      ? t('campanas.validacion.resultado.error-detalle', { error: r.error ?? t('campanas.validacion.resultado.sin-detalle') })
    : r.tipo === 'error' ? t('campanas.validacion.resultado.error')
    : r.tipo === 'parcial'
      ? t(r.fallidas === 1 ? 'campanas.validacion.resultado.parcial.uno' : 'campanas.validacion.resultado.parcial.otros', {
          n: r.fallidas,
        })
    : r.filas.length === r.omitidas ? t('campanas.validacion.resultado.todas-otro-cms')
    : t('campanas.validacion.resultado.ok')
  return (
    <div className={cn('mt-3 rounded border p-2 text-[12px]', tono)} role="status">
      <div className="flex items-start gap-1.5 font-medium text-ink">
        {r.tipo === 'ok' ? (
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        )}
        <span>{titulo}</span>
      </div>
      {r.filas.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {r.filas.map((f, i) => (
            <li key={`${f.sitio}-${f.creativoNombre ?? ''}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5 break-words">
              {f.ok ? <Check className="h-3 w-3 shrink-0 text-success" /> : <X className="h-3 w-3 shrink-0 text-error" />}
              <span className="font-mono text-[11px] text-ink">{f.sitio}</span>
              <span className="text-muted">
                →{' '}
                {f.estado === 'otro_cms'
                  ? t('campanas.validacion.resultado.la-opera', {
                      cms: NOMBRE_CMS[f.cms ?? ''] ?? t('campanas.validacion.resultado.otro-cms-nombre'),
                    })
                  : f.screen ?? t('campanas.validacion.resultado.sin-pantalla')}
              </span>
              {f.creativoNombre ? <span className="text-muted">· {f.creativoNombre}</span> : null}
              <span className={f.ok ? 'text-success' : 'text-error'}>
                ·{' '}
                {f.ok
                  ? ESTADO_PUBLICACION[f.estado ?? '']
                    ? t(ESTADO_PUBLICACION[f.estado ?? ''])
                    : f.estado ?? t('campanas.validacion.resultado.publicada')
                  : f.error ?? t('campanas.comun.error')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
