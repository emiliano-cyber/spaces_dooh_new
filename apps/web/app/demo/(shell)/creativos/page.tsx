'use client'

import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { Images, Upload, Check, X, Clock, Code2, Eye, Download, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { EmptyState } from '@/components/demo/EmptyState'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  crearCreatividadApi,
  validarCreatividadApi,
  asignarCreativosApi,
  eliminarCreatividadApi,
  reemplazarCreatividadApi,
} from '@/lib/data/estado-api'
import { useCampanas, useCreatividades, useReservas, useSitios } from '@/lib/data/client'
import type { Campana, Creatividad, Reserva, Sitio, EstValidacionCreatividad } from '@/lib/data/types'

// Convierte una imagen subida (data URL) en un creativo HTML para el player DOOH.
// Adaptativo a cualquier pantalla: la imagen completa (contain) va al centro sin
// recorte, y las franjas se rellenan con la MISMA imagen difuminada de fondo → sin
// barras negras y sin perder nada. Responsivo (llena el contenedor a cualquier
// tamaño/proporción). El <img src="data:image…"> se conserva para que la extracción
// a DOOHmain y los previews sigan encontrando la imagen.
function imagenAHtml(dataUrl: string, nombre: string): string {
  const alt = (nombre || 'creativo').replace(/[<>&"]/g, ' ').trim()
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}' +
    '.dooh-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
    `.dooh-bg{position:absolute;inset:0;background:#000 center/cover no-repeat url("${dataUrl}");` +
    'filter:blur(28px) brightness(.55);transform:scale(1.15)}' +
    '.dooh-fg{position:relative;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}' +
    '</style></head>' +
    '<body><div class="dooh-wrap">' +
    '<div class="dooh-bg"></div>' +
    `<img class="dooh-fg" src="${dataUrl}" alt="${alt}"/>` +
    '</div></body></html>'
  )
}

// Si un creativo HTML es una imagen envuelta (ver imagenAHtml), devuelve su data
// URL para mostrarlo como imagen en previews/miniaturas; si no, null.
function imagenDeCodigo(codigo?: string | null): string | null {
  if (!codigo) return null
  const m = codigo.match(/<img[^>]+src="(data:image\/[^"]+)"/i)
  return m ? m[1] : null
}

// Un creativo es HTML si su formato es HTML o su archivo es un data:text/html /
// .html — se renderiza en <iframe> (un <img> no puede pintar HTML).
function esCreativoHtml(cr?: { formato?: string | null; archivoUrl?: string | null } | null): boolean {
  const url = cr?.archivoUrl ?? ''
  return cr?.formato === 'HTML' || url.startsWith('data:text/html') || /\.html?(\?|#|$)/i.test(url)
}

// Fuente HTML de un creativo, venga como texto en `codigo` o embebida en un
// data: URL (base64 o percent-encoded). null si no hay HTML que enseñar (imagen
// remota, PDF, o un .html que vive en el bucket y habría que descargar aparte).
function htmlDeCreativo(cr?: Creatividad | null): string | null {
  if (cr?.codigo) return cr.codigo
  const m = (cr?.archivoUrl ?? '').match(/^data:text\/html([^,]*),([\s\S]*)$/i)
  if (!m) return null
  try {
    if (/;base64/i.test(m[1])) {
      const bin = atob(m[2])
      return new TextDecoder('utf-8').decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    }
    return decodeURIComponent(m[2])
  } catch {
    return null // data: URL corrupto
  }
}

// Descarga el HTML como archivo. Un Blob descargado no se ejecuta, así que es
// seguro incluso con creativos subidos por clientes externos.
function descargarHtml(nombre: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const base = (nombre || 'creativo').replace(/[^\w.-]+/g, '_').replace(/\.html?$/i, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// Pantalla de creativos (debajo de Comercial): subir/aprobar imágenes por
// campaña y asignar cuál se exhibe en cada spot reservado.
export default function CreativosPage() {
  const campanas = useCampanas()
  const creatividades = useCreatividades()
  const reservas = useReservas()
  const sitios = useSitios()
  const puede = usePuede('comercial', 'crear')

  if (!campanas || !creatividades || !reservas || !sitios) {
    return (
      <div className="w-full space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    )
  }

  // Solo campañas con spots reservados o con creativos (algo que gestionar).
  const visibles = campanas.filter(
    (c) =>
      reservas.some((r) => r.campanaId === c.id) ||
      creatividades.some((cr) => cr.campanaId === c.id),
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Creativos</h1>
        <p className="mt-1 text-[13px] text-muted">
          Sube y aprueba las imágenes de cada campaña, y asigna cuál va en cada slot reservado.
        </p>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          icon={Images}
          titulo="Sin campañas con slots o creativos"
          detalle="Reserva sitios en Comercial o sube un creativo para gestionarlos aquí."
        />
      ) : (
        visibles.map((c) => (
          <CampanaCard
            key={c.id}
            campana={c}
            creativos={creatividades.filter((cr) => cr.campanaId === c.id)}
            reservas={reservas.filter((r) => r.campanaId === c.id)}
            sitios={sitios}
            puede={puede}
          />
        ))
      )}
    </div>
  )
}

function CampanaCard({
  campana,
  creativos,
  reservas,
  sitios,
  puede,
}: {
  campana: Campana
  creativos: Creatividad[]
  reservas: Reserva[]
  sitios: Sitio[]
  puede: boolean
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const reemplazarRef = useRef<HTMLInputElement | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeNombre, setCodeNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  // Creativo cuyo HTML se está viendo en el modal (null = cerrado).
  const [verFuente, setVerFuente] = useState<Creatividad | null>(null)
  // Creativo que se está reemplazando (para el input de archivo).
  const [reemplazarId, setReemplazarId] = useState<string | null>(null)
  // Creativo cuya eliminación se está confirmando (null = cerrado).
  const [confirmarEliminar, setConfirmarEliminar] = useState<Creatividad | null>(null)

  // Aprobados y asignables: excluye los retirados (siguen en DOOHmain, pero ya no
  // se pueden asignar a spots desde aquí).
  const aprobados = creativos.filter((cr) => cr.estatusValidacion === 'VALIDADA' && !cr.retiradoEn)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB')
      return
    }
    setSubiendo(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        // Toda imagen subida se convierte a un creativo HTML (no se guarda como imagen).
        const dataUrl = reader.result as string
        await crearCreatividadApi({
          campanaId: campana.id,
          nombre: f.name,
          codigo: imagenAHtml(dataUrl, f.name),
          formato: 'text/html',
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo subir')
      }
      setSubiendo(false)
    }
    reader.readAsDataURL(f)
  }

  async function guardarCodigo() {
    if (!codigo.trim()) return
    setSubiendo(true)
    try {
      await crearCreatividadApi({
        campanaId: campana.id,
        nombre: codeNombre.trim() || 'Creativo (código)',
        codigo,
        formato: 'text/html',
      })
      setCodigo('')
      setCodeNombre('')
      setCodeOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    }
    setSubiendo(false)
  }

  async function validar(id: string, aprobar: boolean) {
    let motivo: string | undefined
    if (!aprobar) motivo = window.prompt('Motivo de rechazo (opcional):') ?? undefined
    setBusy(id)
    try {
      await validarCreatividadApi(id, aprobar, motivo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo validar')
    }
    setBusy(null)
  }

  // Elimina un creativo (confirmado por diálogo). Si estaba publicado, el backend
  // lo retira de DOOHmain.
  async function confirmarEliminarDo() {
    const cr = confirmarEliminar
    if (!cr) return
    setBusy(cr.id)
    try {
      const res = await eliminarCreatividadApi(cr.id)
      toast.success(
        res?.pendienteEnDoohmain
          ? `“${cr.nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel`
          : `“${cr.nombre}” se eliminó`,
      )
      setConfirmarEliminar(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
    setBusy(null)
  }

  // Reemplaza el arte de un creativo: abre el selector de imagen.
  function pedirReemplazo(cr: Creatividad) {
    setReemplazarId(cr.id)
    reemplazarRef.current?.click()
  }

  function onReemplazoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    const id = reemplazarId
    if (!f || !id) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB')
      return
    }
    setBusy(id)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string
        const res = await reemplazarCreatividadApi(id, {
          nombre: f.name,
          codigo: imagenAHtml(dataUrl, f.name),
          formato: 'text/html',
        })
        toast.success(
          res?.doohmain?.estado === 'retirado'
            ? 'Arte reemplazado. El anterior se retiró de DOOHmain; apruébalo de nuevo para publicar el nuevo.'
            : 'Arte reemplazado. Apruébalo de nuevo para publicarlo.',
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo reemplazar')
      }
      setBusy(null)
      setReemplazarId(null)
    }
    reader.readAsDataURL(f)
  }

  // Guarda los creativos (con veces) de un spot.
  async function guardarCreativos(reserva: Reserva, creativos: { creatividadId: string; veces: number }[]) {
    setBusy(reserva.id)
    try {
      await asignarCreativosApi(reserva.id, creativos)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar')
    }
    setBusy(null)
  }

  // Spot DIGITAL: ajusta cuántas veces se reproduce un creativo (0 = lo quita).
  function setVeces(reserva: Reserva, creatividadId: string, veces: number) {
    const otros = reserva.creativos.filter((c) => c.creatividadId !== creatividadId)
    const next = veces > 0 ? [...otros, { creatividadId, veces }] : otros
    void guardarCreativos(reserva, next)
  }

  // Spot FIJO: una sola imagen (o ninguna).
  function setUnico(reserva: Reserva, creatividadId: string) {
    void guardarCreativos(reserva, creatividadId ? [{ creatividadId, veces: 1 }] : [])
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-ink">{campana.nombre}</div>
          <div className="demo-num text-[12px] text-muted">
            {campana.folio} · {campana.tipoCampana}
          </div>
        </div>
        {puede && (
          <div className="flex shrink-0 gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <input ref={reemplazarRef} type="file" accept="image/*" className="hidden" onChange={onReemplazoFile} />
            <Button size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Imagen
            </Button>
            <Button size="sm" variant="secondary" disabled={subiendo} onClick={() => setCodeOpen((v) => !v)}>
              <Code2 className="h-3.5 w-3.5" /> Código
            </Button>
          </div>
        )}
      </div>

      {/* Alta por código (HTML/UTF) */}
      {puede && codeOpen && (
        <div className="space-y-2 rounded-md border border-border bg-surface-2 p-2.5">
          <input
            value={codeNombre}
            onChange={(e) => setCodeNombre(e.target.value)}
            placeholder="Nombre del creativo (opcional)"
            className="h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <textarea
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Pega aquí el código del creativo (HTML/UTF)…"
            rows={5}
            className="w-full rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCodeOpen(false)}>Cancelar</Button>
            <Button size="sm" disabled={!codigo.trim() || subiendo} onClick={guardarCodigo}>
              {subiendo ? 'Guardando…' : 'Guardar código'}
            </Button>
          </div>
        </div>
      )}

      {/* Creativos */}
      <div>
        <div className="mb-2 text-[12px] font-medium text-muted">Creativos ({creativos.length})</div>
        {creativos.length === 0 ? (
          <p className="text-[12px] text-muted">Sin creativos. Sube una imagen para aprobarla.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {creativos.map((cr) => (
              <div
                key={cr.id}
                className={`overflow-hidden rounded-md border border-border ${cr.retiradoEn ? 'opacity-60' : ''}`}
              >
                {esCreativoHtml(cr) ? (
                  <iframe
                    title={cr.nombre}
                    src={cr.archivoUrl!}
                    sandbox=""
                    className="h-28 w-full border-0 bg-white"
                  />
                ) : cr.archivoUrl || imagenDeCodigo(cr.codigo) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cr.archivoUrl ?? imagenDeCodigo(cr.codigo)!} alt={cr.nombre} className="h-28 w-full object-cover" />
                ) : cr.codigo ? (
                  <iframe
                    title={cr.nombre}
                    srcDoc={cr.codigo}
                    sandbox=""
                    className="h-28 w-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-surface-2 text-muted">
                    <Images className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-1.5 p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12px] text-ink" title={cr.nombre}>{cr.nombre}</div>
                    {cr.codigo && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1 text-[10px] text-muted">
                        <Code2 className="h-2.5 w-2.5" /> código
                      </span>
                    )}
                  </div>
                  {cr.retiradoEn ? (
                    <div
                      className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b40] bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-[#9a6700]"
                      title="Retirado del sistema; su arte sigue en DOOHmain (quítalo en su panel)"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> Retirado · pendiente en DOOHmain
                    </div>
                  ) : (
                    <EstadoCrea estatus={cr.estatusValidacion} motivo={cr.rechazadoMotivo} />
                  )}
                  {/* Sólo si hay fuente que enseñar (codigo o data:text/html). */}
                  {htmlDeCreativo(cr) !== null && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-[12px]"
                      onClick={() => setVerFuente(cr)}
                    >
                      <Eye className="h-3 w-3" /> Ver HTML
                    </Button>
                  )}
                  {puede && !cr.retiradoEn && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant={cr.estatusValidacion === 'VALIDADA' ? 'secondary' : 'primary'}
                          disabled={busy === cr.id}
                          onClick={() => validar(cr.id, true)}
                        >
                          <Check className="h-3 w-3" /> Aprobar
                        </Button>
                        {/* Aprobar es definitivo: una vez validado ya no se puede rechazar. */}
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy === cr.id || cr.estatusValidacion === 'VALIDADA'}
                          title={cr.estatusValidacion === 'VALIDADA' ? 'El creativo ya fue aprobado' : undefined}
                          onClick={() => validar(cr.id, false)}
                        >
                          <X className="h-3 w-3" /> Rechazar
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 gap-1 px-2 text-[12px]"
                          disabled={busy === cr.id}
                          onClick={() => pedirReemplazo(cr)}
                        >
                          <RefreshCw className="h-3 w-3" /> Reemplazar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[12px] text-error hover:bg-error-soft"
                          disabled={busy === cr.id}
                          onClick={() => setConfirmarEliminar(cr)}
                        >
                          <Trash2 className="h-3 w-3" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spots reservados */}
      <div className="border-t border-border pt-3">
        <div className="mb-2 text-[12px] font-medium text-muted">Slots reservados ({reservas.length})</div>
        {reservas.length === 0 ? (
          <p className="text-[12px] text-muted">Sin slots reservados todavía.</p>
        ) : (
          <ul className="space-y-3">
            {reservas.map((r) => {
              const sitio = sitios.find((s) => s.id === r.sitioId)
              const digital = r.spotsReservados != null
              const usados = r.creativos.reduce((a, c) => a + c.veces, 0)
              const excede = r.spotsReservados != null && usados > r.spotsReservados
              const unico = aprobados.find((cr) => cr.id === r.creativos[0]?.creatividadId)
              return (
                <li key={r.id} className="rounded border border-border bg-surface p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-medium text-ink">{sitio?.nombre ?? 'Sitio'}</div>
                    {digital && (
                      <div className="demo-num text-[11px] text-muted">
                        <span className={excede ? 'font-semibold text-error' : 'text-ink'}>{usados}</span>
                        /{r.spotsReservados} spots asignados
                      </div>
                    )}
                  </div>

                  {aprobados.length === 0 ? (
                    <p className="mt-1 text-[11px] text-muted">Aprueba un creativo para asignarlo aquí.</p>
                  ) : digital ? (
                    // Spot digital: cada creativo con cuántas veces se reproduce.
                    <div className="mt-2 space-y-1.5">
                      {aprobados.map((cr) => {
                        const veces = r.creativos.find((x) => x.creatividadId === cr.id)?.veces ?? 0
                        return (
                          <div key={cr.id} className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <Thumb cr={cr} className="h-7 w-7" />
                              <span className="truncate text-[12px] text-ink">{cr.nombre}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={r.spotsReservados ?? undefined}
                                value={veces}
                                disabled={!puede || busy === r.id}
                                onChange={(e) =>
                                  setVeces(r, cr.id, Math.max(0, Math.round(Number(e.target.value) || 0)))
                                }
                                className="demo-num h-7 w-16 rounded border border-border-strong bg-surface px-2 text-right text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              />
                              <span className="text-[11px] text-muted">veces</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    // Spot fijo: una sola imagen.
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Thumb cr={unico} className="h-8 w-8" />
                        <span className="text-[12px] text-muted">Creativo del sitio</span>
                      </div>
                      {puede && (
                        <select
                          value={r.creativos[0]?.creatividadId ?? ''}
                          disabled={busy === r.id}
                          onChange={(e) => setUnico(r, e.target.value)}
                          className="h-8 max-w-[180px] rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                        >
                          <option value="">Sin asignar</option>
                          {aprobados.map((cr) => (
                            <option key={cr.id} value={cr.id}>{cr.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {aprobados.length === 0 && reservas.length > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Aprueba al menos un creativo para poder asignarlo a los slots.
          </p>
        )}
      </div>

      {/* Fuente HTML del creativo. Se pinta como texto ({fuente} en un <pre>, que
          React escapa), nunca como HTML: los creativos pueden venir de clientes
          externos y ejecutarlos en nuestro origen sería un XSS. */}
      <Modal
        open={verFuente !== null}
        onOpenChange={(v) => !v && setVerFuente(null)}
        title={verFuente?.nombre ?? 'Creativo'}
        subtitle={verFuente ? `${verFuente.formato ?? 'HTML'} · ${(htmlDeCreativo(verFuente) ?? '').length.toLocaleString('es-MX')} caracteres` : undefined}
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const fuente = htmlDeCreativo(verFuente)
                if (fuente) descargarHtml(verFuente!.nombre, fuente)
              }}
            >
              <Download className="h-3.5 w-3.5" /> Descargar .html
            </Button>
            <Button size="sm" onClick={() => setVerFuente(null)}>Cerrar</Button>
          </div>
        }
      >
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-ink">
          {htmlDeCreativo(verFuente) ?? ''}
        </pre>
      </Modal>

      <ConfirmDialog
        open={confirmarEliminar !== null}
        onOpenChange={(v) => !v && setConfirmarEliminar(null)}
        title="Eliminar creativo"
        confirmLabel="Sí, eliminar"
        busy={busy !== null && busy === confirmarEliminar?.id}
        onConfirm={confirmarEliminarDo}
      >
        ¿Seguro que quieres bajar{' '}
        <span className="font-medium text-ink">“{confirmarEliminar?.nombre}”</span>? Si ya está
        publicado, su campaña se finaliza, pero <span className="text-ink">el arte no se puede
        quitar de DOOHmain</span> (su API no lo permite): quedará marcado como “pendiente en DOOHmain”
        para que lo quites en su panel.
      </ConfirmDialog>
    </Card>
  )
}

// Miniatura de un creativo: imagen si la hay, icono de código si es código,
// o placeholder si no hay nada asignado.
function Thumb({ cr, className }: { cr?: Creatividad; className: string }) {
  if (esCreativoHtml(cr)) {
    return (
      <iframe
        title={cr?.nombre ?? 'creativo'}
        src={cr!.archivoUrl!}
        sandbox=""
        className={`${className} shrink-0 rounded border border-border bg-white`}
      />
    )
  }
  const img = cr?.archivoUrl ?? imagenDeCodigo(cr?.codigo)
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" className={`${className} shrink-0 rounded border border-border object-cover`} />
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-muted`}
    >
      {cr?.codigo ? <Code2 className="h-4 w-4" /> : <Images className="h-4 w-4" />}
    </span>
  )
}

function EstadoCrea({ estatus, motivo }: { estatus: EstValidacionCreatividad; motivo: string | null }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof Check }> = {
    PENDIENTE: { label: 'Pendiente', cls: 'text-warning', Icon: Clock },
    VALIDADA: { label: 'Aprobado', cls: 'text-success', Icon: Check },
    RECHAZADA: { label: 'Rechazado', cls: 'text-error', Icon: X },
  }
  const m = map[estatus] ?? map.PENDIENTE
  const Icon = m.Icon
  return (
    <div className={`inline-flex items-center gap-1 text-[11px] font-medium ${m.cls}`} title={motivo ?? ''}>
      <Icon className="h-3 w-3" /> {m.label}
      {estatus === 'RECHAZADA' && motivo ? ` · ${motivo}` : ''}
    </div>
  )
}
