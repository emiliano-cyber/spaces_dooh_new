'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Radio,
  MapPin,
  Check,
  CheckCircle2,
  Loader2,
  LockOpen,
  ArrowLeft,
} from 'lucide-react'
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
import { getOTApi, cerrarOTApi } from '@/lib/data/estado-api'
import type { FotoMeta, EstOT, ChecklistItem } from '@/lib/data/types'

// blob: URL → data URL (base64) para que la foto persista en la BD.
async function blobADataUrl(blobUrl: string): Promise<string> {
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
  campana: { id: string; nombre: string; ocRecibida: boolean; fotosComprobatorias: boolean; reportePublicacion: boolean } | null
  evidencias: any[]
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
  // Rastro de navegación ("cómo llegué aquí"). Por defecto, Operaciones.
  const [trail, setTrail] = useState<Crumb[]>([])
  useEffect(() => {
    const t = trailFromLocation()
    setTrail(t.length ? t : [{ label: 'Operaciones', href: '/demo/operaciones' }])
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: 'Operaciones', href: '/demo/operaciones' }

  const recargar = useCallback(async () => {
    const d = await getOTApi(id)
    setData(d ?? null)
    if (d?.ot) setChecks(d.ot.checklist.map((c: any) => !!c.hecho))
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
        <Link href="/demo/login" className="text-[13px] font-medium text-info hover:underline">
          Inicia sesión para continuar
        </Link>
      </div>
    )
  }

  const { ot, sitio, campana, evidencias } = data
  const completada = ot.estatus === 'COMPLETADA'
  const puedeChecklist = ot.checklist.length > 0
  const todoListo = checks.every(Boolean) && fotos.length > 0 && !!geo

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

  // ─── Piezas de contenido (reutilizadas por la vista móvil y la de escritorio) ─
  const cabecera = (
    <div>
      <h1 className="text-lg font-semibold text-ink">{ot.descripcion}</h1>
      {campana && <p className="mt-0.5 text-[12px] text-muted">Campaña: {campana.nombre}</p>}
      {sitio && (
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
          <MapPin className="h-3.5 w-3.5" /> {sitio.direccion}
        </p>
      )}
    </div>
  )

  const completadaView = (
    <CompletadaView
      candado={!!campana && campana.ocRecibida && campana.fotosComprobatorias && campana.reportePublicacion}
      evidenciaUrls={(evidencias ?? []).map((e) => e.fotoUrl)}
    />
  )

  const checklistSection = puedeChecklist ? (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-ink">Checklist</h2>
      <ul className="space-y-1.5">
        {ot.checklist.map((c: ChecklistItem, i: number) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-150',
                checks[i] ? 'border-success/40 bg-[#10b9810d]' : 'border-border bg-surface',
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
      <Button className="w-full" disabled={!todoListo || cerrando} onClick={cerrar}>
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
        </div>
      </div>
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
