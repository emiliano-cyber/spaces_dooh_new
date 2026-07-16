'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { ShieldCheck, Send, Check, X, Clock, Images, Code2, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  StatusBadge,
  VALIDACION_PUB_TONO,
  VALIDACION_PUB_LABEL,
  CREATIVIDAD_TONO,
  CREATIVIDAD_LABEL,
} from '@/components/demo/StatusBadge'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useCampana, useCreatividades, formatFechaHora } from '@/lib/data/client'
import { enviarADominioApi, validarPublicacionApi, eliminarCreatividadApi } from '@/lib/data/estado-api'
import type { Creatividad } from '@/lib/data/types'

// Panel de validación de publicación: se envía la campaña al dominio/CMS y un
// revisor verifica la información de los anuncios antes de que salga al aire.
export function ValidacionPanel({ campanaId }: { campanaId: string }) {
  const c = useCampana(campanaId)
  const creatividades = useCreatividades()
  const puede = usePuede('comercial', 'crear')
  const [busy, setBusy] = useState(false)
  const [busyCr, setBusyCr] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<Creatividad | null>(null)
  const [confirmarAprobar, setConfirmarAprobar] = useState(false)

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
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar al dominio')
    }
    setBusy(false)
  }

  async function validar(aprobar: boolean) {
    let motivo: string | undefined
    if (!aprobar) {
      motivo = window.prompt('Motivo del rechazo (qué corregir en los anuncios):') ?? undefined
      if (motivo === undefined) return // canceló el prompt
    }
    setBusy(true)
    try {
      await validarPublicacionApi(campanaId, aprobar, motivo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo validar la publicación')
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
          ? `“${cr.nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel`
          : `“${cr.nombre}” se bajó`,
      )
      setConfirmar(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo bajar el creativo')
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
          <span className="text-[13px] font-medium text-ink">Validación de publicación</span>
        </div>
        <StatusBadge tono={VALIDACION_PUB_TONO[c.validacionEstatus]}>
          {VALIDACION_PUB_LABEL[c.validacionEstatus]}
        </StatusBadge>
      </div>

      {/* Estado de envío al dominio */}
      <ul className="space-y-2">
        <Condicion ok={c.enviadaDominio} label="Enviada al dominio / CMS" />
        {requiereCreativos && (
          <Condicion
            ok={creas.length > 0}
            label={`Anuncios cargados (${validadas.length}/${creas.length} validados)`}
          />
        )}
      </ul>

      {/* Información de los anuncios a verificar */}
      {creas.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[12px] font-medium text-muted">
            Información de los anuncios
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
                        title="Retirado; su arte sigue en DOOHmain (quítalo en su panel)"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" /> Retirado
                      </span>
                    ) : (
                      <StatusBadge tono={CREATIVIDAD_TONO[cr.estatusValidacion]} className="px-1.5 py-0 text-[10px]">
                        {CREATIVIDAD_LABEL[cr.estatusValidacion]}
                      </StatusBadge>
                    )}
                    {puede && !cr.retiradoEn && (
                      <button
                        type="button"
                        title="Bajar creativo (finaliza su campaña en DOOHmain)"
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
            {aprobada ? 'Aprobada' : 'Rechazada'} por{' '}
            <span className="text-ink">{c.validacionPor ?? '—'}</span> ·{' '}
            {formatFechaHora(c.validacionEn)}
            {!aprobada && c.validacionMotivo ? (
              <div className="mt-0.5 text-error">Motivo: {c.validacionMotivo}</div>
            ) : null}
          </div>
        </div>
      )}

      {/* Acciones */}
      {puede && (
        <div className="mt-3">
          {!c.enviadaDominio ? (
            <button
              type="button"
              disabled={busy}
              onClick={enviar}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-border-strong px-3 py-2 text-[12px] font-medium text-ink transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {busy ? 'Enviando…' : c.validacionEstatus === 'RECHAZADA' ? 'Corregir y reenviar al dominio' : 'Enviar al dominio'}
            </button>
          ) : c.validacionEstatus === 'PENDIENTE' ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => (requiereCreativos ? setConfirmarAprobar(true) : validar(true))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded bg-success px-3 py-2 text-[12px] font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Aprobar publicación
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => validar(false)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-[#ef444466] px-3 py-2 text-[12px] font-medium text-error transition-colors duration-150 hover:bg-[#ef44440d] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Rechazar
              </button>
            </div>
          ) : null}
        </div>
      )}

      {!c.enviadaDominio && c.validacionEstatus === 'PENDIENTE' && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
          <Clock className="h-3.5 w-3.5" />
          Envía la campaña al dominio para que se valide antes de publicarse.
        </p>
      )}

      <ConfirmDialog
        open={confirmar !== null}
        onOpenChange={(v) => !v && setConfirmar(null)}
        title="Bajar creativo"
        confirmLabel="Sí, bajar"
        busy={busyCr !== null && busyCr === confirmar?.id}
        onConfirm={confirmarBajar}
      >
        ¿Seguro que quieres bajar{' '}
        <span className="font-medium text-ink">“{confirmar?.nombre}”</span>? Si estaba publicado, su
        campaña se finaliza, pero <span className="text-ink">el arte no se puede quitar de DOOHmain</span>
        (su API no lo permite): quedará marcado como “pendiente en DOOHmain”.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmarAprobar}
        onOpenChange={setConfirmarAprobar}
        title="Aprobar y publicar en DOOHmain"
        confirmLabel="Sí, publicar"
        busy={busy}
        onConfirm={async () => {
          await validar(true)
          setConfirmarAprobar(false)
        }}
      >
        Al aprobar, los anuncios se suben a DOOHmain.{' '}
        <span className="font-medium text-ink">
          Una vez publicados no se pueden eliminar ni reemplazar desde el sistema
        </span>{' '}
        (la API de DOOHmain no lo permite): cualquier cambio posterior deberá hacerse{' '}
        <span className="text-ink">manualmente en el panel de DOOHmain</span>. ¿Continuar?
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
