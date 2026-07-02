'use client'

import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { Images, Upload, Check, X, Clock, Code2 } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { EmptyState } from '@/components/demo/EmptyState'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  crearCreatividadApi,
  validarCreatividadApi,
  asignarCreativosApi,
} from '@/lib/data/estado-api'
import { useCampanas, useCreatividades, useReservas, useSitios } from '@/lib/data/client'
import type { Campana, Creatividad, Reserva, Sitio, EstValidacionCreatividad } from '@/lib/data/types'

// Convierte una imagen subida (data URL) en un creativo HTML para el player
// DOOH: incrusta el <img> a pantalla completa (contain, fondo negro). Así todas
// las imágenes se guardan/sirven como HTML (formato text/html), no como imagen.
function imagenAHtml(dataUrl: string, nombre: string): string {
  const alt = (nombre || 'creativo').replace(/[<>&"]/g, ' ').trim()
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;height:100%;background:#000}</style></head>' +
    '<body><div style="width:100%;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
    `<img src="${dataUrl}" alt="${alt}" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block"/>` +
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
  const [subiendo, setSubiendo] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeNombre, setCodeNombre] = useState('')
  const [codigo, setCodigo] = useState('')

  const aprobados = creativos.filter((cr) => cr.estatusValidacion === 'VALIDADA')

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
              <div key={cr.id} className="overflow-hidden rounded-md border border-border">
                {cr.archivoUrl || imagenDeCodigo(cr.codigo) ? (
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
                  <EstadoCrea estatus={cr.estatusValidacion} motivo={cr.rechazadoMotivo} />
                  {puede && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={cr.estatusValidacion === 'VALIDADA' ? 'secondary' : 'primary'}
                        disabled={busy === cr.id}
                        onClick={() => validar(cr.id, true)}
                      >
                        <Check className="h-3 w-3" /> Aprobar
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy === cr.id} onClick={() => validar(cr.id, false)}>
                        <X className="h-3 w-3" /> Rechazar
                      </Button>
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
    </Card>
  )
}

// Miniatura de un creativo: imagen si la hay, icono de código si es código,
// o placeholder si no hay nada asignado.
function Thumb({ cr, className }: { cr?: Creatividad; className: string }) {
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
