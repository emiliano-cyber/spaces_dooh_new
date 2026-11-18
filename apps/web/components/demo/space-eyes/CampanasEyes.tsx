'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ImageIcon, Loader2, Plus, RefreshCw, ScanEye } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ErrorSE, fotoSE, seApi, textoDeError } from '@/lib/data/space-eyes-se'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { localeDe } from '@/lib/i18n/formato-idioma'

// ============================================================================
//  Space Eyes — campañas de verificación.
//
//  Port de `campaigns.html` de Space Eye. Una campaña aquí es la creatividad
//  de referencia que las cámaras comparan contra lo que aparece en la
//  pantalla, más los equipos donde debe verse y su vigencia. Sin creatividad
//  la verificación no puede hacer nada.
//
//  Desde oct-2026 las campañas comerciales llegan SOLAS desde Operaciones
//  (lib/server/space-eyes-campanas.ts): una por campaña y creativo, con los
//  equipos de sus pantallas. Esas se marcan «De Operaciones» y no se editan
//  aquí; las capturadas a mano siguen igual.
// ============================================================================

interface CampanaSE {
  id: number
  name: string
  advertiser: string | null
  start_date: string | null
  end_date: string | null
  active: boolean | number
  verification_enabled: boolean | number
  creative_path: string | null
  device_count: number
  photo_count: number
  // 'spaceos:<empresa>': llegó sola de Operaciones (sus reservas confirmadas).
  // Esas no se editan aquí: la siguiente sincronización desharía el cambio.
  origen?: string | null
}

interface EquipoSE {
  id: number
  name: string
  billboard_code: string | null
}

interface Formulario {
  id: number | null
  name: string
  advertiser: string
  start_date: string
  end_date: string
  verification_enabled: boolean
  device_ids: number[]
}

const formVacio = (): Formulario => ({
  id: null,
  name: '',
  advertiser: '',
  start_date: '',
  end_date: '',
  verification_enabled: false,
  device_ids: [],
})

const MAX_BYTES = 20 * 1024 * 1024

/** Los DATE llegan como ISO completo y el <input type="date"> solo acepta YYYY-MM-DD. */
const soloFecha = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '')

// «01/11 – 30/11» en español (dia/mes, como siempre); en ingles el mes va
// primero y con nombre, «Nov 1 – Nov 30»: «01/11» un lector de EE. UU. lo lee
// como 11 de enero.
function periodo(c: CampanaSE, idioma: Idioma): string {
  const f = (v: string | null) => {
    if (!v) return '—'
    if (idioma !== 'es') {
      const [a, m, d] = String(v).slice(0, 10).split('-').map(Number)
      const fecha = new Date(Date.UTC(a, m - 1, d))
      if (Number.isNaN(fecha.getTime())) return '—'
      return new Intl.DateTimeFormat(localeDe(idioma), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(fecha)
    }
    return String(v).slice(0, 10).split('-').reverse().slice(0, 2).join('/')
  }
  return `${f(c.start_date)} – ${f(c.end_date)}`
}

const TEXTOS_ERROR: Record<string, ClaveTexto> = {
  sin_archivo: 'spaceeyes.campanas.error.sin-archivo',
  not_found: 'spaceeyes.campanas.error.not-found',
  invalid_input: 'spaceeyes.comun.dato-invalido',
  forbidden: 'spaceeyes.campanas.error.forbidden',
}

// El modo espejo trae su propio `mensaje`, y ErrorSE ya lo pone como message.
function mensajeDeError(e: unknown, porDefecto: string, idioma: Idioma): string {
  if (e instanceof ErrorSE) {
    const cuerpo = (e.cuerpo ?? {}) as { error?: string; mensaje?: string }
    if (cuerpo.mensaje) return cuerpo.mensaje
    if (e.status === 403) return traducir(idioma, TEXTOS_ERROR.forbidden)
    if (cuerpo.error && TEXTOS_ERROR[cuerpo.error]) return traducir(idioma, TEXTOS_ERROR[cuerpo.error])
    return textoDeError(e, idioma) || porDefecto
  }
  return e instanceof Error ? e.message : porDefecto
}

const CAMPO =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent'

type Aviso = { tono: 'ok' | 'error'; texto: string } | null

export function CampanasEyes() {
  const { t, idioma } = useIdioma()
  const [campanas, setCampanas] = useState<CampanaSE[] | null>(null)
  const [equipos, setEquipos] = useState<EquipoSE[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<Formulario>(formVacio)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [cargandoEquiposAsignados, setCargandoEquiposAsignados] = useState(false)
  // La imagen elegida todavía no subida, y su vista previa.
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [creativoActual, setCreativoActual] = useState<string | null>(null)

  const inputArchivo = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  // Si se abre otra campaña mientras llega el detalle de la anterior, esa
  // respuesta ya no debe pisar el formulario.
  const edicionEnCurso = useRef<number | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const d = await seApi<{ campaigns: CampanaSE[] }>('campaigns')
      setCampanas(d.campaigns ?? [])
    } catch (e) {
      setErrorCarga(mensajeDeError(e, t('spaceeyes.campanas.error.cargar'), idioma))
    }
    setCargando(false)
  }, [t, idioma])

  const cargarEquipos = useCallback(async () => {
    try {
      const d = await seApi<{ devices: EquipoSE[] }>('devices')
      setEquipos(d.devices ?? [])
    } catch {
      setEquipos([])
    }
  }, [])

  useEffect(() => {
    void Promise.all([cargar(), cargarEquipos()])
  }, [cargar, cargarEquipos])

  // La vista previa local es un object URL: hay que soltarlo al cambiarla.
  useEffect(() => {
    return () => {
      if (vistaPrevia?.startsWith('blob:')) URL.revokeObjectURL(vistaPrevia)
    }
  }, [vistaPrevia])

  const llevarAlFormulario = () => {
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const abrirNueva = () => {
    edicionEnCurso.current = null
    setForm(formVacio())
    setArchivoNuevo(null)
    setVistaPrevia(null)
    setCreativoActual(null)
    setErrorForm(null)
    setAviso(null)
    setMostrarForm(true)
    llevarAlFormulario()
  }

  const editar = async (c: CampanaSE) => {
    edicionEnCurso.current = c.id
    setForm({
      id: c.id,
      name: c.name ?? '',
      advertiser: c.advertiser ?? '',
      start_date: soloFecha(c.start_date),
      end_date: soloFecha(c.end_date),
      verification_enabled: !!c.verification_enabled,
      device_ids: [],
    })
    setArchivoNuevo(null)
    setCreativoActual(c.creative_path)
    setVistaPrevia(fotoSE(c.creative_path))
    setErrorForm(null)
    setAviso(null)
    setMostrarForm(true)
    llevarAlFormulario()

    // Los equipos asignados vienen en el detalle, no en la lista.
    setCargandoEquiposAsignados(true)
    try {
      const d = await seApi<{ devices: EquipoSE[] }>(`campaigns/${c.id}`)
      if (edicionEnCurso.current === c.id) {
        setForm((f) => (f.id === c.id ? { ...f, device_ids: (d.devices ?? []).map((x) => x.id) } : f))
      }
    } catch {
      if (edicionEnCurso.current === c.id) {
        setErrorForm(t('spaceeyes.campanas.error.asignados'))
      }
    }
    if (edicionEnCurso.current === c.id) setCargandoEquiposAsignados(false)
  }

  const alternarEquipo = (id: number) => {
    setForm((f) => ({
      ...f,
      device_ids: f.device_ids.includes(id) ? f.device_ids.filter((x) => x !== id) : [...f.device_ids, id],
    }))
  }

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > MAX_BYTES) {
      setErrorForm(t('spaceeyes.campanas.error.pesada'))
      return
    }
    setErrorForm(null)
    setArchivoNuevo(f)
    // Vista previa local: no se sube nada hasta pulsar Guardar.
    setVistaPrevia(URL.createObjectURL(f))
  }

  const cancelar = () => {
    edicionEnCurso.current = null
    setMostrarForm(false)
    setErrorForm(null)
  }

  const guardar = async () => {
    const f = form
    if (!f.name.trim()) return setErrorForm(t('spaceeyes.campanas.error.nombre'))
    if (!f.start_date || !f.end_date) return setErrorForm(t('spaceeyes.campanas.error.fechas'))
    if (f.end_date < f.start_date) return setErrorForm(t('spaceeyes.campanas.error.fin-antes'))

    setGuardando(true)
    setErrorForm(null)
    const eraNueva = !f.id
    try {
      const anunciante = f.advertiser.trim()
      const base = {
        name: f.name.trim(),
        start_date: f.start_date,
        end_date: f.end_date,
        verification_enabled: !!f.verification_enabled,
        device_ids: f.device_ids,
      }

      let id = f.id
      if (id) {
        // Al editar, null borra el anunciante.
        await seApi(`campaigns/${id}`, { method: 'PUT', body: { ...base, advertiser: anunciante || null } })
      } else {
        // Al crear, Space Eye no acepta null: se omite si está vacío.
        const r = await seApi<{ campaign_id: number }>('campaigns', {
          method: 'POST',
          body: anunciante ? { ...base, advertiser: anunciante } : base,
        })
        id = r.campaign_id
        // Si la subida de la imagen falla, reintentar debe editar esta campaña,
        // no crear otra igual.
        edicionEnCurso.current = id
        setForm((x) => ({ ...x, id }))
      }

      // La imagen va aparte: es un archivo, no cabe en el JSON.
      if (archivoNuevo && id) {
        const fd = new FormData()
        fd.append('creative', archivoNuevo)
        try {
          const r = await seApi<{ creative_path: string }>(`campaigns/${id}/creative`, { method: 'POST', form: fd })
          setCreativoActual(r.creative_path)
          setArchivoNuevo(null)
        } catch (e) {
          await cargar()
          setErrorForm(
            t('spaceeyes.campanas.error.creatividad', {
              motivo: mensajeDeError(e, t('spaceeyes.comun.error-desconocido'), idioma),
            }),
          )
          return
        }
      }

      edicionEnCurso.current = null
      setMostrarForm(false)
      setAviso({ tono: 'ok', texto: eraNueva ? t('spaceeyes.campanas.creada') : t('spaceeyes.campanas.actualizada') })
      await cargar()
    } catch (e) {
      setErrorForm(mensajeDeError(e, t('spaceeyes.campanas.error.guardar'), idioma))
    } finally {
      setGuardando(false)
    }
  }

  const lista = campanas ?? []

  return (
    <div className="w-full space-y-4">
      {/* Encabezado: el mismo patrón que el listado de equipos */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <ScanEye className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-2xl text-ink">{t('spaceeyes.campanas.titulo')}</h1>
          <p className="text-[13px] text-muted">{t('spaceeyes.campanas.descripcion')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('spaceeyes.comun.actualizar')}
          </Button>
          <Button variant="success" size="sm" onClick={abrirNueva}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('spaceeyes.campanas.nueva')}
          </Button>
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className={cn(
            'rounded-md border p-2.5 text-[12px] text-ink',
            aviso.tono === 'ok' ? 'border-[#1da85040] bg-success-soft' : 'border-[#dc262640] bg-error-soft',
          )}
        >
          {aviso.texto}
        </div>
      )}

      {/* ================= Formulario ================= */}
      {mostrarForm && (
        <div ref={formRef} className="scroll-mt-4 rounded-md border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            {form.id ? t('spaceeyes.campanas.editar') : t('spaceeyes.campanas.nueva')}
          </h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Datos */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo etiqueta={t('spaceeyes.comun.nombre')} htmlFor="sec-nombre">
                  <input
                    id="sec-nombre"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('spaceeyes.campanas.nombre-ej')}
                    className={CAMPO}
                  />
                </Campo>
                <Campo etiqueta={t('spaceeyes.campanas.anunciante')} htmlFor="sec-anunciante">
                  <input
                    id="sec-anunciante"
                    value={form.advertiser}
                    onChange={(e) => setForm((f) => ({ ...f, advertiser: e.target.value }))}
                    placeholder={t('spaceeyes.campanas.anunciante-ej')}
                    className={CAMPO}
                  />
                </Campo>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo etiqueta={t('spaceeyes.campanas.inicio')} htmlFor="sec-inicio">
                  <input
                    id="sec-inicio"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className={CAMPO}
                  />
                </Campo>
                <Campo etiqueta={t('spaceeyes.campanas.fin')} htmlFor="sec-fin">
                  <input
                    id="sec-fin"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className={CAMPO}
                  />
                </Campo>
              </div>

              <div>
                <div className="mb-1.5 text-[12px] font-medium text-ink">{t('spaceeyes.campanas.equipos')}</div>
                <div className="max-h-44 divide-y divide-border overflow-y-auto rounded border border-border-strong">
                  {equipos.length === 0 ? (
                    <p className="px-3 py-2 text-[13px] text-muted">{t('spaceeyes.campanas.sin-equipos')}</p>
                  ) : (
                    equipos.map((d) => (
                      <label
                        key={d.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-ink hover:bg-surface-2"
                      >
                        <input
                          type="checkbox"
                          checked={form.device_ids.includes(d.id)}
                          onChange={() => alternarEquipo(d.id)}
                          className="accent-[var(--accent)]"
                        />
                        <span className="truncate">{d.name}</span>
                        {d.billboard_code && <span className="demo-num text-[11px] text-muted">{d.billboard_code}</span>}
                      </label>
                    ))
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                  {cargandoEquiposAsignados && <Loader2 className="h-3 w-3 animate-spin" />}
                  {cargandoEquiposAsignados
                    ? t('spaceeyes.campanas.leyendo-asignados')
                    : t(form.device_ids.length === 1 ? 'spaceeyes.campanas.seleccionados.uno' : 'spaceeyes.campanas.seleccionados.otros', {
                        n: formatNumero(form.device_ids.length, 0, idioma),
                      })}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={form.verification_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, verification_enabled: e.target.checked }))}
                    className="accent-[var(--accent)]"
                  />
                  {t('spaceeyes.campanas.verificar')}
                </label>
                <p className="ml-6 mt-0.5 text-[11px] text-muted">{t('spaceeyes.campanas.verificar.texto')}</p>
              </div>
            </div>

            {/* Creatividad */}
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ink">{t('spaceeyes.campanas.creatividad')}</div>
              <div
                className={cn(
                  'rounded-md border p-4 text-center',
                  vistaPrevia ? 'border-border' : 'border-2 border-dashed border-border-strong',
                )}
              >
                {vistaPrevia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vistaPrevia} alt={t('spaceeyes.campanas.creatividad')} className="mx-auto max-h-56 rounded" />
                ) : (
                  <div className="py-8">
                    <ImageIcon className="mx-auto mb-2 h-10 w-10 text-muted" strokeWidth={1.3} />
                    <p className="text-[13px] text-muted">{t('spaceeyes.campanas.sube')}</p>
                    <p className="mt-1 text-[11px] text-muted">{t('spaceeyes.campanas.formatos')}</p>
                  </div>
                )}

                <input
                  ref={inputArchivo}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={elegirArchivo}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => inputArchivo.current?.click()}
                >
                  {vistaPrevia ? t('spaceeyes.campanas.cambiar-imagen') : t('spaceeyes.campanas.elegir-imagen')}
                </Button>
              </div>

              <p className="mt-2 text-[11px] text-muted">
                {t('spaceeyes.campanas.creatividad.texto')}
              </p>
              {form.id && !archivoNuevo && creativoActual && (
                <p className="mt-1 text-[11px] text-success">{t('spaceeyes.campanas.ya-tiene')}</p>
              )}
              {archivoNuevo && (
                <p className="mt-1 text-[11px] text-muted">{t('spaceeyes.campanas.se-sube')}</p>
              )}
            </div>
          </div>

          {errorForm && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-2.5 text-[12px] text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              {errorForm}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {/* Verde al crear, azul al editar: el color lo decide la etiqueta
                (convenciones.md, «Color de los botones»). El boton que abre
                este formulario, «Nueva campana», ya era verde. */}
            <Button variant={form.id ? 'primary' : 'success'} onClick={guardar} disabled={guardando}>
              {guardando
                ? t('spaceeyes.comun.guardando')
                : form.id
                  ? t('spaceeyes.comun.guardar-cambios')
                  : t('spaceeyes.campanas.crear')}
            </Button>
            <Button variant="ghost" onClick={cancelar} disabled={guardando}>
              {t('comun.cancelar')}
            </Button>
          </div>
        </div>
      )}

      {/* ================= Lista ================= */}
      {errorCarga ? (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">{t('spaceeyes.campanas.error.cargar')}</div>
            <div className="text-muted">{errorCarga}</div>
          </div>
        </div>
      ) : cargando && !campanas ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-10 text-center">
          <p className="text-[13px] text-ink">{t('spaceeyes.campanas.vacio')}</p>
          <p className="mt-1 text-[12px] text-muted">{t('spaceeyes.campanas.vacio.texto')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {lista.map((c) => (
            <TarjetaCampana key={c.id} campana={c} onEditar={() => void editar(c)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Campo({ etiqueta, htmlFor, children }: { etiqueta: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-ink">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

function TarjetaCampana({ campana: c, onEditar }: { campana: CampanaSE; onEditar: () => void }) {
  const { t, idioma } = useIdioma()
  const img = fotoSE(c.creative_path)
  const verifica = !!c.verification_enabled
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      {/* La caja manda, el arte se acomoda dentro: todas las tarjetas miden lo
          mismo venga el creativo horizontal o vertical. `aspect-video` sola no
          alcanzaba —un creativo vertical estiraba la caja a su altura y esa
          tarjeta salia del doble de alto que las demas—, porque el contenido
          con altura propia le gana al alto que marca la proporcion. Por eso el
          arte va `absolute`: deja de aportar altura. Y `object-contain` y no
          `cover` porque es la imagen de REFERENCIA contra la que comparan las
          camaras: recortarla seria ensenar algo que no es. */}
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={t('spaceeyes.campanas.alt', { nombre: c.name })}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center text-warning">
            <ImageIcon className="h-5 w-5" strokeWidth={1.4} />
            <span className="text-[12px]">{t('spaceeyes.campanas.sin-creatividad')}</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Un `div` y no un `h3`: la regla `.demo-root h1,h2,h3` del sistema
              pone la serif de titulos en negrita y le gana a `font-medium`, asi
              que el nombre salia en una tipografia que no usa ninguna otra
              tarjeta del modulo. El nombre de una campana es una etiqueta de
              ficha, como el de un equipo, no un titulo de seccion: mismas
              clases que esas. */}
          <div className="truncate text-[13px] font-medium text-ink">{c.name}</div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              c.active
                ? 'border-[#1da85040] bg-success-soft text-[#146c39]'
                : 'border-border bg-surface-2 text-muted',
            )}
          >
            {c.active ? t('spaceeyes.comun.activa') : t('spaceeyes.campanas.inactiva')}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {c.advertiser || t('spaceeyes.campanas.sin-anunciante')}
          {c.origen && <span className="text-accent">{t('spaceeyes.campanas.de-operaciones')}</span>}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <Dato titulo={t('spaceeyes.comun.equipos')} valor={c.device_count} />
          <Dato titulo={t('spaceeyes.ficha.tab.fotos')} valor={c.photo_count} />
          <Dato titulo={t('spaceeyes.comun.periodo')} valor={periodo(c, idioma)} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          {verifica && c.creative_path ? (
            <span className="text-[12px] text-accent">{t('spaceeyes.campanas.verif.activa')}</span>
          ) : verifica ? (
            <span className="text-[12px] text-warning">{t('spaceeyes.campanas.verif.sin-creatividad')}</span>
          ) : (
            <span className="text-[12px] text-muted">{t('spaceeyes.campanas.verif.sin')}</span>
          )}
          {c.origen ? (
            <span
              className="text-[12px] text-muted"
              title={t('spaceeyes.campanas.operaciones.ayuda')}
            >
              {t('spaceeyes.campanas.operaciones')}
            </span>
          ) : (
            <Button variant="tertiary" size="sm" onClick={onEditar}>
              {t('spaceeyes.comun.editar')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: number | string }) {
  const { idioma } = useIdioma()
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{titulo}</div>
      <div className="demo-num truncate font-medium text-ink">{typeof valor === 'number' ? formatNumero(valor, 0, idioma) : valor}</div>
    </div>
  )
}
