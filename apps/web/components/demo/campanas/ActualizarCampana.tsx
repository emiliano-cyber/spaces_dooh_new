'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Upload, Code2, X, Trash2, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { StatusBadge, CREATIVIDAD_TONO } from '@/components/demo/StatusBadge'
import { usePuede, useSesionCtx } from '@/components/demo/shell/SesionContext'
import { puedeAprobarEnCampana } from '@/lib/roles'
import { useCampana, useCreatividades } from '@/lib/data/client'
import {
  crearCreatividadApi,
  eliminarCreatividadApi,
  validarCreatividadApi,
  reintentarPublicacionApi,
  refrescarEstado,
} from '@/lib/data/estado-api'
import { imagenAHtml, IMAGEN_CREATIVO_MAX_MB } from '@/lib/creativo-html'
import { resumirPublicacion, type ResumenPublicacion } from '@/lib/doohmain-resultado'
import {
  revisarPlan,
  ejecutarActualizacion,
  type CreativoNuevo,
  type ResultadoActualizacion,
  type PasoActualizacion,
} from '@/lib/actualizar-campana'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { useTexto } from '@/lib/i18n/contexto'
import { AvisoPantalla, Miniatura, ResultadoDoohmain } from './ValidacionPanel'
import { CLAVE_CREATIVIDAD } from './etiquetas'

// ============================================================================
//  «Actualizar campaña» (pedido del dueño, 18/11): cambiar los creativos de una
//  campaña YA PUBLICADA en una sola ventana — conservar o eliminar los de antes,
//  subir nuevos con «¿Apruebas este creativo?» al lado, y mandar a DOOHmain.
//  Antes eran cuatro sitios (ficha, Creativos, Validación, «Volver a publicar»).
//
//  El orden de los pasos y qué pasa si uno falla viven en
//  `lib/actualizar-campana.ts`, con prueba; aquí solo se arma el plan.
//
//  Solo para campañas digitales con la publicación APROBADA: es lo único que
//  se «actualiza». Una que aún no sale al aire sigue su camino de siempre
//  (enviar al dominio → aprobar), que es donde se decide salir al aire.
// ============================================================================

type Nuevo = CreativoNuevo & { clave: number }

const CLAVE_PASO: Record<PasoActualizacion, ClaveTexto> = {
  subir: 'campanas.actualizar.fallo.subir',
  eliminar: 'campanas.actualizar.fallo.eliminar',
  aprobar: 'campanas.actualizar.fallo.aprobar',
  publicar: 'campanas.actualizar.fallo.publicar',
}

export function ActualizarCampana({ campanaId }: { campanaId: string }) {
  const c = useCampana(campanaId)
  const creatividades = useCreatividades()
  const puede = usePuede('comercial', 'crear')
  // «¿Apruebas este creativo?» solo lo ve el Dueño o un Administrador (18/11).
  // Los demás actualizan igual: lo que suben queda pendiente, como hoy.
  const { sesion } = useSesionCtx()
  const puedeAprobar = puedeAprobarEnCampana(sesion?.usuario?.rol)
  const t = useTexto()
  const fileRef = useRef<HTMLInputElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [eliminar, setEliminar] = useState<Set<string>>(new Set())
  const [aprobarExistentes, setAprobarExistentes] = useState<Set<string>>(new Set())
  const [nuevos, setNuevos] = useState<Nuevo[]>([])
  const [codigoAbierto, setCodigoAbierto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [codigoNombre, setCodigoNombre] = useState('')
  const [busy, setBusy] = useState(false)
  const [resultado, setResultado] = useState<ResultadoActualizacion | null>(null)
  const [publicacion, setPublicacion] = useState<ResumenPublicacion | null>(null)
  const sigClave = useRef(0)

  if (!c || !puede) return null
  if (!(c.tipoCampana === 'DOOH' || c.tipoCampana === 'HIBRIDA')) return null
  if (c.validacionEstatus !== 'APROBADA') return null

  // Los retirados ya no están en la campaña: su arte quedó en DOOHmain y no
  // hay nada que conservar ni eliminar.
  const actuales = (creatividades ?? []).filter((cr) => cr.campanaId === campanaId && !cr.retiradoEn)
  const plan = {
    eliminar: [...eliminar],
    aprobarExistentes: [...aprobarExistentes],
    nuevos: nuevos.map(({ nombre, codigo, aprobar }) => ({ nombre, codigo, aprobar })),
  }
  const problema = revisarPlan(
    actuales.map((cr) => ({ id: cr.id, nombre: cr.nombre, estatus: cr.estatusValidacion })),
    plan,
  )
  const terminado = resultado?.ok === true

  function reiniciar() {
    setEliminar(new Set())
    setAprobarExistentes(new Set())
    setNuevos([])
    setCodigoAbierto(false)
    setCodigo('')
    setCodigoNombre('')
    setResultado(null)
    setPublicacion(null)
  }

  function alternar(set: Set<string>, id: string, fijar: (s: Set<string>) => void) {
    const s = new Set(set)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    fijar(s)
  }

  function agregarNuevo(nombre: string, html: string) {
    sigClave.current += 1
    setNuevos((xs) => [...xs, { clave: sigClave.current, nombre, codigo: html, aprobar: false }])
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = [...(e.target.files ?? [])]
    e.target.value = ''
    for (const f of archivos) {
      if (f.size > IMAGEN_CREATIVO_MAX_MB * 1024 * 1024) {
        toast.error(`${f.name}: ${t('campanas.creativo.imagen-supera', { mb: IMAGEN_CREATIVO_MAX_MB })}`)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => agregarNuevo(f.name, imagenAHtml(reader.result as string, f.name))
      reader.readAsDataURL(f)
    }
  }

  function agregarCodigo() {
    if (!codigo.trim()) return
    agregarNuevo(codigoNombre.trim() || t('campanas.creativo.nombre-codigo'), codigo)
    setCodigo('')
    setCodigoNombre('')
    setCodigoAbierto(false)
  }

  function nombreDe(id?: string) {
    return actuales.find((cr) => cr.id === id)?.nombre ?? id ?? ''
  }

  async function actualizar() {
    if (problema) return
    setBusy(true)
    setResultado(null)
    setPublicacion(null)
    const r = await ejecutarActualizacion(plan, {
      subir: (n) =>
        crearCreatividadApi({ campanaId, nombre: n.nombre, codigo: n.codigo, formato: 'text/html' }, { refrescar: false }),
      eliminar: async (id) => {
        await eliminarCreatividadApi(id)
      },
      aprobar: (id) => validarCreatividadApi(id, true),
      publicar: async () => (await reintentarPublicacionApi(campanaId)).doohmain,
    })
    // Una subida sin refresco, o un fallo a la mitad: que la ficha muestre lo
    // que de verdad quedó.
    await refrescarEstado().catch(() => {})
    setResultado(r)
    if (r.ok) {
      const res = resumirPublicacion(r.publicacion as Parameters<typeof resumirPublicacion>[0])
      setPublicacion(res)
      if (res.tipo === 'ok' || res.tipo === 'apagada') toast.success(t('campanas.actualizar.listo'))
      else toast.warning(t('campanas.actualizar.listo-con-avisos'))
    } else {
      toast.error(t('campanas.actualizar.no-terminado'))
    }
    setBusy(false)
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          reiniciar()
          setAbierto(true)
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> {t('campanas.actualizar.boton')}
      </Button>

      <Modal
        open={abierto}
        onOpenChange={(v) => {
          if (!v && !busy) setAbierto(false)
        }}
        title={t('campanas.actualizar.titulo')}
        subtitle={c.nombre}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {problema && !terminado && (
              <span className="mr-auto text-[12px] text-muted">
                {t(problema === 'sin-cambios' ? 'campanas.actualizar.sin-cambios' : 'campanas.actualizar.sin-aprobados')}
              </span>
            )}
            {terminado ? (
              <Button size="sm" onClick={() => setAbierto(false)}>
                {t('campanas.actualizar.cerrar')}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAbierto(false)}>
                  {t('comun.cancelar')}
                </Button>
                <Button size="sm" disabled={busy || !!problema} onClick={actualizar}>
                  <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
                  {busy ? t('campanas.actualizar.actualizando') : t('campanas.actualizar.confirmar')}
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          {/* Creativos de antes: conservar o eliminar */}
          <section className="space-y-2">
            <h3 className="m-0 text-[13px] font-semibold text-ink">{t('campanas.actualizar.anteriores')}</h3>
            {actuales.length === 0 ? (
              <p className="text-[12px] text-muted">{t('campanas.actualizar.anteriores.vacio')}</p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                {actuales.map((cr) => {
                  const seVa = eliminar.has(cr.id)
                  return (
                    <li
                      key={cr.id}
                      className={cn(
                        'overflow-hidden rounded border',
                        seVa ? 'border-error/40 bg-error-soft opacity-70' : 'border-border',
                      )}
                    >
                      <Miniatura cr={cr} />
                      <div className="space-y-1.5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('truncate text-[12px] text-ink', seVa && 'line-through')} title={cr.nombre}>
                            {cr.nombre}
                          </span>
                          <StatusBadge tono={CREATIVIDAD_TONO[cr.estatusValidacion]} className="px-1.5 py-0 text-[10px]">
                            {t(CLAVE_CREATIVIDAD[cr.estatusValidacion])}
                          </StatusBadge>
                        </div>
                        <div className="flex gap-1" role="group" aria-label={cr.nombre}>
                          <button
                            type="button"
                            aria-pressed={!seVa}
                            disabled={busy || terminado}
                            onClick={() => seVa && alternar(eliminar, cr.id, setEliminar)}
                            className={cn(
                              'inline-flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] font-medium',
                              !seVa ? 'border-success bg-success-soft text-success' : 'border-border text-muted hover:bg-surface-2',
                            )}
                          >
                            <Check className="h-3 w-3" /> {t('campanas.actualizar.conservar')}
                          </button>
                          <button
                            type="button"
                            aria-pressed={seVa}
                            disabled={busy || terminado}
                            onClick={() => !seVa && alternar(eliminar, cr.id, setEliminar)}
                            className={cn(
                              'inline-flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] font-medium',
                              seVa ? 'border-error bg-error-soft text-error' : 'border-border text-muted hover:bg-surface-2',
                            )}
                          >
                            <Trash2 className="h-3 w-3" /> {t('campanas.actualizar.eliminar')}
                          </button>
                        </div>
                        {puedeAprobar && !seVa && cr.estatusValidacion === 'PENDIENTE' && (
                          <label className="flex items-center gap-1.5 text-[12px] text-ink">
                            <input
                              type="checkbox"
                              disabled={busy || terminado}
                              checked={aprobarExistentes.has(cr.id)}
                              onChange={() => alternar(aprobarExistentes, cr.id, setAprobarExistentes)}
                            />
                            {t('campanas.actualizar.apruebas')}
                          </label>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {eliminar.size > 0 && (
              <p className="text-[12px] text-muted">{t('campanas.actualizar.eliminar.nota')}</p>
            )}
          </section>

          {/* Creativos nuevos, con «¿Apruebas este creativo?» */}
          <section className="space-y-2">
            <h3 className="m-0 text-[13px] font-semibold text-ink">{t('campanas.actualizar.nuevos')}</h3>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
              <Button
                variant="success"
                size="sm"
                disabled={busy || terminado}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> {t('campanas.creativo.imagen')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || terminado}
                onClick={() => setCodigoAbierto((v) => !v)}
              >
                <Code2 className="h-3.5 w-3.5" /> {t('campanas.creativo.codigo')}
              </Button>
            </div>

            {codigoAbierto && (
              <div className="space-y-2 rounded-md border border-border bg-surface-2 p-2.5">
                <input
                  value={codigoNombre}
                  onChange={(e) => setCodigoNombre(e.target.value)}
                  placeholder={t('campanas.creativo.nombre')}
                  aria-label={t('campanas.creativo.nombre')}
                  className="h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <textarea
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder={t('campanas.creativo.pega')}
                  aria-label={t('campanas.creativo.codigo')}
                  rows={4}
                  className="w-full rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <div className="flex justify-end">
                  <Button size="sm" disabled={!codigo.trim()} onClick={agregarCodigo}>
                    {t('campanas.actualizar.agregar')}
                  </Button>
                </div>
              </div>
            )}

            {!puedeAprobar && (
              <p className="text-[12px] text-muted">{t('campanas.actualizar.solo-dueno-admin')}</p>
            )}
            {nuevos.length > 0 && (
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                {nuevos.map((n) => (
                  <li key={n.clave} className="overflow-hidden rounded border border-border">
                    {/* Vista previa real, aislada (sin same-origin), como en
                        `AgregarCreativo`: así se ve lo que va a la pantalla. */}
                    <iframe title={n.nombre} srcDoc={n.codigo} sandbox="allow-scripts" className="h-28 w-full border-0 bg-black" />
                    <div className="space-y-1.5 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] text-ink" title={n.nombre}>
                          {n.nombre}
                        </span>
                        <button
                          type="button"
                          title={t('campanas.actualizar.quitar')}
                          aria-label={t('campanas.actualizar.quitar')}
                          disabled={busy || terminado}
                          onClick={() => setNuevos((xs) => xs.filter((x) => x.clave !== n.clave))}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface-2 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {puedeAprobar && (
                        <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                          <input
                            type="checkbox"
                            disabled={busy || terminado}
                            checked={n.aprobar}
                            onChange={() =>
                              setNuevos((xs) => xs.map((x) => (x.clave === n.clave ? { ...x, aprobar: !x.aprobar } : x)))
                            }
                          />
                          {t('campanas.actualizar.apruebas')}
                        </label>
                      )}
                      {!n.aprobar && <p className="text-[11px] text-muted">{t('campanas.actualizar.sin-aprobar.nota')}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!terminado && <AvisoPantalla />}

          {/* Qué pasó: lo hecho, y dónde se paró si algo falló */}
          {resultado && !resultado.ok && resultado.fallo && (
            <div role="alert" className="rounded border border-error/40 bg-error-soft p-2 text-[12px]">
              <div className="flex items-start gap-1.5 font-medium text-ink">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                <span>
                  {t(CLAVE_PASO[resultado.fallo.paso], {
                    nombre:
                      resultado.fallo.paso === 'subir' ? resultado.fallo.nombre ?? '' : nombreDe(resultado.fallo.nombre),
                  })}
                </span>
              </div>
              <div className="mt-1 text-error">{resultado.fallo.error}</div>
              <div className="mt-1 text-muted">{t('campanas.actualizar.hechos', resultado.hechos)}</div>
            </div>
          )}
          {terminado && resultado && (
            <p className="text-[12px] text-muted">{t('campanas.actualizar.hechos', resultado.hechos)}</p>
          )}
          {publicacion && <ResultadoDoohmain r={publicacion} />}
        </div>
      </Modal>
    </>
  )
}
