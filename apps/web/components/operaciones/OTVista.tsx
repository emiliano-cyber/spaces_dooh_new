'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Radio,
  MapPin,
  Check,
  CheckCircle2,
  Loader2,
  LockOpen,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'
import { candadoDeSegmentos } from '@/lib/data/derive'
import { FotoUploaderMock } from '@/components/demo/FotoUploaderMock'
import { Button } from '@/components/demo/ui/Button'
import { Breadcrumbs, type Crumb } from '@/components/demo/ui/Breadcrumbs'
import {
  StatusBadge,
  OT_TONO,
  OT_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { trailFromLocation } from '@/lib/nav-trail'
import { getOTApi, cerrarOTApi, fijarCostoOTApi, marcarPuntoChecklistApi } from '@/lib/data/estado-api'
import { crearColaChecklist, type ColaChecklist, type InfoGuardado } from '@/lib/checklist-autoguardado'
import { useCandado, DialogoCandado } from '@/components/demo/ui/candado'
import {
  leerCostoOt,
  hayQueGuardarCosto,
  textoDeCosto,
  avisoAntesDeCerrar,
  textoCostoDeCerrada,
} from '@/lib/costo-ot-captura'
import type { FotoMeta, EstOT, ChecklistItem } from '@/lib/data/types'

// blob: URL → data URL (base64) para que la foto persista en la BD.
//
// > [!danger] Si YA es un data: URL, se devuelve tal cual. NO se pasa por fetch.
// > `FotoUploaderMock` entrega la foto con `readAsDataURL` (`:55`, `:65`), o sea
// > **ya en base64**. Pasarla por `fetch` no solo era trabajo de balde: la CSP
// > tiene `connect-src 'self' …` sin `data:`, asi que el navegador lo RECHAZA
// > y subir la evidencia fotografica fallaba con
// > «Refused to connect because it violates the document's Content Security Policy».
// >
// > Medido el 2026-09-29 con el error en la consola del navegador. El arreglo
// > es este `if`, NO relajar la CSP: `connect-src data:` abriria la puerta a
// > exfiltrar datos por una URL que el navegador nunca ve salir.
export async function blobADataUrl(blobUrl: string): Promise<string> {
  if (blobUrl.startsWith('data:')) return blobUrl
  const blob = await (await fetch(blobUrl)).blob()
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

interface OTData {
  ot: any
  sitio: { id: string; nombre: string; direccion: string; lat: number | null; lng: number | null } | null
  campana: {
    id: string; nombre: string; tipoCampana: string
    ocRecibida: boolean; fotosComprobatorias: boolean; reportePublicacion: boolean
  } | null
  evidencias: any[]
  // Nombre del responsable (08/10). Una OT cerrada sin responsable ya trae a
  // quien la cerró. Ausente = servidor viejo; null = sin responsable.
  responsable?: string | null
  // OT-CHECK-01 · si este usuario puede tachar el checklist (mismo permiso que
  // la ruta: `operaciones.crear`). Ausente = servidor viejo → se asume que sí y
  // decide la ruta.
  puedeEditar?: boolean
}

// Vista de una orden de trabajo. `embedded` controla el chrome:
//   • false → vista móvil standalone (cuadrilla en campo): cabecera propia.
//   • true  → embebida en el shell (escritorio): conserva menú izquierdo y se
//     muestra dentro de Operaciones (la sección queda marcada en el sidebar).
export function OTVista({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const [data, setData] = useState<OTData | null | undefined>(undefined)
  const [checks, setChecks] = useState<boolean[]>([])
  const [fotos, setFotos] = useState<FotoMeta[]>([])
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [cerrando, setCerrando] = useState(false)
  // OT-COSTO-01 · el costo REAL de la visita. `costoTexto` es lo tecleado tal
  // cual (string y no number: el campo tiene que poder estar vacío, y un
  // `number | null` no distingue «vacío» de «todavía no escribo nada»).
  const [costoTexto, setCostoTexto] = useState('')
  const [costoError, setCostoError] = useState<string | null>(null)
  const [costoAviso, setCostoAviso] = useState<string | null>(null)
  const [guardandoCosto, setGuardandoCosto] = useState(false)
  // Sin contraseña de entrada: el candado está apagado por defecto en los
  // tenants y preguntarla siempre sería fricción inventada. Si el servidor la
  // pide, `DialogoCandado` se abre solo con esta misma acción dentro.
  const candado = useCandado()
  // Rastro de navegación ("cómo llegué aquí"). Por defecto, Operaciones.
  const [trail, setTrail] = useState<Crumb[]>([])
  useEffect(() => {
    const t = trailFromLocation()
    setTrail(t.length ? t : [{ label: 'Operaciones', href: '/operaciones' }])
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: 'Operaciones', href: '/operaciones' }

  // OT-CHECK-01 · autoguardado del checklist. Hasta el 30/09 `checks` vivía
  // SOLO aquí: se tachaba en memoria, lo único que escribía era «Cerrar OT» y
  // recargar perdía el avance. Ahora cada clic pasa por esta cola, que manda
  // UNA petición a la vez (ver `lib/checklist-autoguardado.ts`). Se crea una
  // vez por pantalla: una cola nueva por render perdería lo que espera.
  const [guardado, setGuardado] = useState<InfoGuardado>({ estado: 'inactivo', error: null, pendientes: 0 })
  // Atada al `id`: si el componente se reutilizara para OTRA orden, una cola
  // vieja mandaría sus puntos a la OT anterior (o, peor, a la nueva con índices
  // de la anterior). Con otro `id`, cola nueva.
  const colaRef = useRef<{ id: string; cola: ColaChecklist } | null>(null)
  if (!colaRef.current || colaRef.current.id !== id) {
    const otId = id
    colaRef.current = {
      id: otId,
      cola: crearColaChecklist({
        enviar: (c) => marcarPuntoChecklistApi(otId, c),
        alCambiar: setGuardado,
      }),
    }
  }
  const cola = colaRef.current.cola

  // Cerrar la pestaña con un cambio sin confirmar lo perdería: el navegador
  // pregunta antes. Solo mientras HAY algo pendiente, para no molestar siempre.
  useEffect(() => {
    if (guardado.pendientes === 0) return
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [guardado.pendientes])

  const recargar = useCallback(async () => {
    const d = await getOTApi(id)
    setData(d ?? null)
    if (d?.ot) {
      // Lo del servidor, MÁS lo que la cola aún no confirmó: recargar a mitad
      // de un guardado (p. ej. al guardar el costo) no debe repintar un punto
      // con su valor viejo.
      const base: boolean[] = d.ot.checklist.map((c: any) => !!c.hecho)
      colaRef.current?.cola.locales().forEach((hecho, i) => {
        if (i < base.length) base[i] = hecho
      })
      setChecks(base)
      // El campo se precarga con lo que hay guardado. `null` deja la caja
      // VACÍA y no en cero: un cero afirmaría que la visita fue gratis.
      setCostoTexto(textoDeCosto(d.ot.costoReal ?? null))
    }
  }, [id])
  useEffect(() => {
    recargar()
  }, [recargar])

  if (data === undefined) {
    return (
      <div className={embedded ? 'w-full' : 'mx-auto max-w-md px-4 py-10'}>
        <div className="h-72 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }
  if (data === null) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2 px-6 text-center', embedded ? 'py-16' : 'min-h-screen')}>
        <p className="text-[13px] text-muted">No se pudo cargar la orden de trabajo.</p>
        <Link href="/login" className="text-[13px] font-medium text-info hover:underline">
          Inicia sesión para continuar
        </Link>
      </div>
    )
  }

  const { ot, sitio, campana, evidencias, responsable } = data
  const completada = ot.estatus === 'COMPLETADA'
  const puedeChecklist = ot.checklist.length > 0
  const puedeEditar = data.puedeEditar !== false
  const todoListo = checks.every(Boolean) && fotos.length > 0 && !!geo

  function alternarPunto(i: number, label: string) {
    if (!puedeEditar) return
    const hecho = !checks[i]
    setChecks((prev) => prev.map((v, idx) => (idx === i ? hecho : v)))
    cola.marcar({ indice: i, label, hecho })
  }

  function capturarUbicacion() {
    if (sitio && sitio.lat != null && sitio.lng != null) setGeo({ lat: sitio.lat, lng: sitio.lng })
  }

  async function cerrar() {
    setCerrando(true)
    try {
      const fotoUrl = await blobADataUrl(fotos[0].url)
      await cerrarOTApi(ot.id, { fotoUrl, tomadaEn: fotos[0].tomadaEn, lat: geo?.lat, lng: geo?.lng })
      await recargar()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo cerrar la OT')
    }
    setCerrando(false)
  }

  // OT-COSTO-01 · guardar lo que de verdad costó la visita.
  //
  // Tres pasos, y cada uno existe por un modo de fallo distinto:
  //  1. Leer el texto — el vacío es BORRAR, no cero (`leerCostoOt`).
  //  2. No mandar lo que no cambió — si no, abrir y cerrar la ficha escribiría
  //     en la bitácora un movimiento de dinero que nadie hizo y pediría la
  //     contraseña del candado por nada.
  //  3. Pasar por el candado — es dinero, y la ruta lo exige.
  async function guardarCosto() {
    setCostoError(null)
    setCostoAviso(null)
    const leido = leerCostoOt(costoTexto)
    if (!leido.ok) {
      setCostoError(leido.error)
      return
    }
    const original: number | null = ot.costoReal ?? null
    if (!hayQueGuardarCosto(original, leido.valor)) {
      setCostoAviso('No hay ningún cambio que guardar.')
      return
    }
    setGuardandoCosto(true)
    await candado.ejecutar({
      guardar: () => fijarCostoOTApi(ot.id, leido.valor),
      alLograr: () => {
        setCostoAviso(
          leido.valor == null
            ? 'Costo borrado: esta visita vuelve a entrar al reporte con la estimación por tipo.'
            : 'Costo guardado. El reporte de rentabilidad usará este importe en vez de la estimación.',
        )
        recargar()
      },
      alFallar: (m) => setCostoError(m),
      mensajeSiFalla: 'No se pudo guardar el costo',
    })
    setGuardandoCosto(false)
  }

  // La tarjeta del costo real. Se pinta SOLO en la vista de escritorio
  // (`embedded`), y eso es deliberado: la vista móvil la usa la cuadrilla en la
  // calle para cerrar con la foto, y este campo pasa por el candado de cambios
  // —puede pedir una contraseña—. Teclear una contraseña en un teléfono a mitad
  // de un montaje es justo la fricción que la ruta separada evita.
  const costoSection = (
    <div className="space-y-2 rounded-md border border-border bg-surface p-3">
      <div className="text-[13px] font-semibold text-ink">Costo real de esta visita</div>
      <p className="text-[12px] text-muted">
        Lo que de verdad costó. <strong>Sustituye</strong> a la estimación por tipo de tarea que
        usa el reporte de rentabilidad, no se suma a ella. Déjalo vacío si no lo sabes: entonces
        el reporte sigue usando la estimación y te lo dice.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-muted">
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={costoTexto}
            onChange={(e) => {
              setCostoTexto(e.target.value)
              setCostoError(null)
              setCostoAviso(null)
            }}
            placeholder="Sin capturar"
            aria-label="Costo real de esta visita"
            className="demo-num w-40 rounded-md border border-border bg-surface py-1.5 pl-5 pr-2 text-[13px] text-ink"
          />
        </div>
        <Button onClick={guardarCosto} disabled={guardandoCosto || candado.enviando}>
          {guardandoCosto ? 'Guardando…' : 'Guardar costo'}
        </Button>
      </div>
      {/* El importe guardado se dice con todas las letras, incluido el CERO:
          una caja con un 0 dentro y nada más se lee como «no he escrito nada». */}
      {ot.costoReal != null && (
        <p className="text-[12px] text-muted">
          Guardado: <span className="demo-num">${Number(ot.costoReal).toLocaleString('es-MX')}</span>
          {Number(ot.costoReal) === 0 && ' — esta visita está capturada como que no costó nada.'}
        </p>
      )}
      {ot.costoReal == null && (
        <p className="text-[12px] text-muted">
          Sin capturar: el reporte usa la estimación por tipo de tarea.
        </p>
      )}
      {costoError && <p className="text-[12px] text-error">{costoError}</p>}
      {costoAviso && <p className="text-[12px] text-success">{costoAviso}</p>}
    </div>
  )

  // ─── Piezas de contenido (reutilizadas por la vista móvil y la de escritorio) ─
  const cabecera = (
    <div>
      <h1 className="text-lg font-semibold text-ink">{ot.descripcion}</h1>
      {campana && <p className="mt-0.5 text-[12px] text-muted">Campaña: {campana.nombre}</p>}
      {responsable !== undefined && (
        <p className="mt-0.5 text-[12px] text-muted">
          Responsable: <span className="text-ink">{responsable ?? 'Sin asignar'}</span>
        </p>
      )}
      {sitio && (
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
          <MapPin className="h-3.5 w-3.5" /> {sitio.direccion}
        </p>
      )}
    </div>
  )

  // Regla única por segmento (derive.ts), no el AND de las tres evidencias: una
  // DOOH no tiene segmento físico y nunca completaría el candado exigiendo fotos.
  const candadoOT =
    !!campana &&
    candadoDeSegmentos(campana.tipoCampana, {
      ocRecibida: campana.ocRecibida,
      evidenciaFisica: campana.fotosComprobatorias,
      evidenciaDigital: campana.reportePublicacion,
    })

  const completadaView = (
    <CompletadaView
      candado={candadoOT}
      evidenciaUrls={(evidencias ?? []).map((e) => e.fotoUrl)}
    />
  )

  // El estado del guardado se dice SIEMPRE con palabras, junto al título: la
  // cuadrilla tiene que saber si puede cerrar la app sin perder lo tachado.
  const indicadorGuardado = (
    <span aria-live="polite" className="text-[11px]">
      {guardado.estado === 'guardando' && (
        <span className="inline-flex items-center gap-1 text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
        </span>
      )}
      {guardado.estado === 'guardado' && (
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="h-3 w-3" strokeWidth={3} /> Guardado
        </span>
      )}
    </span>
  )

  const checklistSection = puedeChecklist ? (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-ink">Checklist</h2>
        {indicadorGuardado}
      </div>
      {guardado.estado === 'error' && (
        <div
          role="alert"
          className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-error/40 bg-surface px-3 py-2 text-[12px] text-error"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Error al guardar: {guardado.error}. Lo tachado se ve aquí pero aún NO está guardado.
          </span>
          <Button variant="secondary" onClick={() => cola.reintentar()}>
            Reintentar
          </Button>
        </div>
      )}
      {!puedeEditar && (
        <p className="mb-2 text-[12px] text-muted">
          Solo lectura: tu rol puede ver esta orden de trabajo, pero no marcar su checklist.
        </p>
      )}
      <ul className="space-y-1.5">
        {ot.checklist.map((c: ChecklistItem, i: number) => (
          <li key={i}>
            <button
              type="button"
              disabled={!puedeEditar}
              aria-pressed={!!checks[i]}
              onClick={() => alternarPunto(i, c.label)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-150',
                checks[i] ? 'border-success/40 bg-[#10b9810d]' : 'border-border bg-surface',
                !puedeEditar && 'cursor-not-allowed opacity-70',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  checks[i] ? 'border-success bg-success text-white' : 'border-border-strong',
                )}
              >
                {checks[i] && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={cn('text-[13px]', checks[i] ? 'text-ink' : 'text-muted')}>{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  ) : null

  const fotoSection = (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-ink">Fotografía comprobatoria</h2>
      <FotoUploaderMock fotos={fotos} onChange={setFotos} capture label="Tomar foto" />
    </section>
  )

  const geoSection = (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-ink">Sello de ubicación</h2>
      {geo ? (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-[#10b9810d] px-3 py-2.5 text-[13px]">
          <MapPin className="h-4 w-4 text-success" />
          <span className="demo-num text-ink">{geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</span>
          <span className="ml-auto text-[11px] text-muted">±8 m</span>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={capturarUbicacion}>
          <MapPin className="h-4 w-4" /> Capturar ubicación
        </Button>
      )}
    </section>
  )

  const cerrarBtn = !completada ? (
    <>
      {/* Una OT cerrada ya no admite costo (decisión del dueño, 08/10): se
          avisa AQUÍ, antes de cerrar, que es el último momento para capturarlo. */}
      <p className="mb-2 flex items-start gap-1.5 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-[12px] text-ink">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <span>{avisoAntesDeCerrar(ot.costoReal ?? null)}</span>
      </p>
      {/* Mientras un punto viaja, cerrar esperaría a nada y la petición del
          punto llegaría DESPUÉS del cierre, con un 409 que parecería un fallo. */}
      <Button className="w-full" disabled={!todoListo || cerrando || guardado.estado === 'guardando'} onClick={cerrar}>
        {cerrando ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Cerrando…</>
        ) : (
          <>Cerrar OT</>
        )}
      </Button>
      {!todoListo && (
        <p className="mt-1.5 text-center text-[11px] text-muted">
          Completa el checklist, toma una foto y captura la ubicación.
        </p>
      )}
    </>
  ) : null

  const cerrarBox = cerrarBtn ? (
    <div className="rounded-md border border-border bg-surface p-3">{cerrarBtn}</div>
  ) : null

  // ─── Contenido común (vista móvil: una sola columna) ─────────────────────────
  const contenido = (
    <>
      {cabecera}
      {completada ? (
        completadaView
      ) : (
        <>
          {checklistSection}
          {fotoSection}
          {geoSection}
        </>
      )}
    </>
  )

  // ─── Embebida en el shell (escritorio): ancho completo y responsive ─────────
  if (embedded) {
    return (
      <>
      <div className="w-full space-y-4">
        {/* Migas: sigues en Operaciones; muestra cómo llegaste */}
        <div className="flex flex-wrap items-center gap-2">
          {volver.href && (
            <Link href={volver.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> {volver.label}
            </Link>
          )}
          <span className="text-muted/50">·</span>
          <Breadcrumbs items={[...trail, { label: ot.folio }]} />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="demo-num text-[13px] font-semibold text-ink">{ot.folio}</div>
            <div className="truncate text-[12px] text-muted">{sitio?.nombre ?? '—'}</div>
          </div>
          <StatusBadge tono={OT_TONO[ot.estatus as EstOT]}>{OT_LABEL[ot.estatus as EstOT]}</StatusBadge>
        </div>

        {/* Ancho completo: en pantallas grandes se divide en dos columnas. */}
        <div className="w-full space-y-5">
          {cabecera}
          {completada ? (
            completadaView
          ) : puedeChecklist ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
              <div className="space-y-5">{checklistSection}</div>
              <div className="space-y-5">
                {fotoSection}
                {geoSection}
                {cerrarBox}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start">
              {fotoSection}
              <div className="space-y-5">
                {geoSection}
                {cerrarBox}
              </div>
            </div>
          )}
          {/* Hasta el 08/10 el costo se capturaba también DESPUÉS de cerrar
              (la cuadrilla factura días más tarde). El dueño decidió lo
              contrario: cerrada, el costo queda fijo y solo se muestra. El
              servidor lo rechaza igual (`fijarCostoOT`, 409). */}
          {completada ? (
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="text-[13px] font-semibold text-ink">Costo real de esta visita</div>
              <p className="mt-1 text-[12px] text-muted">{textoCostoDeCerrada(ot.costoReal ?? null)}</p>
            </div>
          ) : (
            costoSection
          )}
        </div>
      </div>
      <DialogoCandado
        candado={candado}
        titulo="Confirma con tu contraseña"
        subtitulo="Capturar el costo de una orden de trabajo cambia el margen del reporte de rentabilidad: tu organización pide que vuelvas a identificarte."
        etiquetaConfirmar="Confirmar y guardar el costo"
      />
      </>
    )
  }

  // ─── Vista móvil standalone (cuadrilla en campo) ────────────────────────────
  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-fg">
            <Radio className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="demo-num text-[13px] font-semibold text-ink">{ot.folio}</div>
            <div className="truncate text-[11px] text-muted">{sitio?.nombre ?? '—'}</div>
          </div>
          <StatusBadge tono={OT_TONO[ot.estatus as EstOT]}>{OT_LABEL[ot.estatus as EstOT]}</StatusBadge>
        </div>
      </header>

      {/* Migas: de dónde vengo y cómo llegué */}
      <div className="border-b border-border bg-surface-2/60">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
          {volver.href && (
            <Link href={volver.href} className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> {volver.label}
            </Link>
          )}
          <span className="text-muted/50">·</span>
          <Breadcrumbs items={[...trail, { label: ot.folio }]} />
        </div>
      </div>

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">{contenido}</main>

      {!completada && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface">
          <div className="mx-auto max-w-md px-4 py-3">{cerrarBtn}</div>
        </div>
      )}
    </div>
  )
}

function CompletadaView({ candado, evidenciaUrls }: { candado: boolean; evidenciaUrls: string[] }) {
  const real = evidenciaUrls.filter((u) => u.startsWith('blob:') || u.startsWith('http') || u.startsWith('data:'))
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center rounded-md border border-success/40 bg-[#10b9810d] px-4 py-6 text-center">
        <CheckCircle2 className="mb-2 h-9 w-9 text-success" />
        <p className="text-[15px] font-semibold text-ink">OT cerrada</p>
        <p className="mt-1 text-[13px] text-muted">La evidencia se envió al pipeline de la campaña.</p>
      </div>

      {candado && (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-[#10b9810d] px-3 py-3">
          <LockOpen className="h-4 w-4 text-success" />
          <span className="text-[13px] font-medium text-ink">Candado de facturación encendido</span>
        </div>
      )}

      {real.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={real[0]} alt="evidencia" className="w-full rounded-md border border-border object-cover" />
      )}

      <p className="text-center text-[12px] text-muted">
        Puedes cerrar esta ventana. La evidencia ya quedó registrada.
      </p>
    </div>
  )
}
