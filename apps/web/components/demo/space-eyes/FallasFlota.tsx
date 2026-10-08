'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, MonitorX, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { seApi, fotoSE, ErrorSE } from '@/lib/data/space-eyes-se'
import { VisorFoto, fechaHora } from './piezas'
import { formatNumero } from '@/lib/formato-numero'

// ============================================================================
//  Space Eyes — fallas de pantalla de TODA la flota.
//
//  Lo que cada equipo detectó por sí mismo al revisar su pantalla (APK 0.15 en
//  adelante): gabinetes apagados o congelados, pantalla apagada en horario,
//  cámara movida. Arriba lo que hay que atender, abajo el historial.
//
//  Los indicadores cuentan el TOTAL que da el servidor (`cuentas`): la lista
//  trae como mucho 500 y no puede contar sola. El filtro de estado es solo de
//  la tabla; el de equipo sí se pide al servidor.
//
//  Space Eye avisa de cada falla nueva por socket; aquí no hay socket, así que
//  la lista se vuelve a pedir cada minuto y con el botón «Actualizar».
// ============================================================================

type Estado = 'abierta' | 'recuperada' | 'descartada'

interface FallaSE {
  id: number
  device_id: number
  equipo: string
  tipo: string
  nombre: string
  fila: number | null
  columna: number | null
  gabinete: number | null
  confianza: number
  estado: Estado
  detectada_en: string
  recuperada_en: string | null
  cerrada_por: 'equipo' | 'usuario' | null
  nota: string | null
  detalle: { gabinetes?: number[]; total?: number } | null
  evidencia: string | null
  evidencia_mini: string | null
  evidencia_recuperacion: string | null
  evidencia_recuperacion_mini: string | null
}

interface RespuestaFallas {
  abiertas: number
  cuentas: Partial<Record<Estado, number>> | null
  fallas: FallaSE[]
}

const ESTADO: Record<Estado, { texto: string; clase: string }> = {
  abierta: { texto: 'Abierta', clase: 'bg-error-soft text-error' },
  recuperada: { texto: 'Recuperada', clase: 'bg-success-soft text-success' },
  descartada: { texto: 'No era falla', clase: 'bg-surface-2 text-muted' },
}

const FILTROS: [Estado | '', string][] = [
  ['', 'Todas'],
  ['abierta', 'Abiertas'],
  ['recuperada', 'Recuperadas'],
  ['descartada', 'No eran falla'],
]

/** Dónde falló, como lo diría una persona. Igual que Pantalla.donde de Space Eye. */
function donde(f: FallaSE): string {
  if (f.gabinete) return `Gabinete ${f.gabinete} (fila ${(f.fila ?? 0) + 1}, columna ${(f.columna ?? 0) + 1})`
  const g = f.detalle?.gabinetes
  if (g && g.length) return `Gabinetes ${g.join(', ')}` + (f.detalle?.total ? ` (${g.length} de ${f.detalle.total})` : '')
  if (f.tipo === 'camara_movida') return 'Cámara (hay que volver a marcar la pantalla)'
  if (f.tipo === 'sin_imagen') return 'Lente tapada, o pantalla apagada de noche'
  return 'Toda la pantalla'
}

const RECARGA_MS = 60_000

export function FallasFlota() {
  const [fallas, setFallas] = useState<FallaSE[]>([])
  const [cuentas, setCuentas] = useState<RespuestaFallas['cuentas']>(null)
  const [equipos, setEquipos] = useState<{ id: number; name: string }[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [estado, setEstado] = useState<Estado | ''>('')
  const [listo, setListo] = useState(false) // ya se leyó la URL
  const [cargado, setCargado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null)
  const [verFoto, setVerFoto] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState<{ falla: FallaSE; estado: 'recuperada' | 'descartada' } | null>(null)

  // Como en Space Eye: ?estado= y ?device_id= en la URL abren la pantalla ya filtrada.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const e = p.get('estado')
    if (e === 'abierta' || e === 'recuperada' || e === 'descartada') setEstado(e)
    setDeviceId(p.get('device_id') ?? '')
    setListo(true)
    seApi<{ devices?: { id: number; name: string }[] }>('devices')
      .then((r) => setEquipos(r.devices ?? []))
      .catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    const q = new URLSearchParams()
    if (deviceId) q.set('device_id', deviceId)
    q.set('limit', '500')
    try {
      const r = await seApi<RespuestaFallas>(`fallas?${q.toString()}`)
      setFallas(r.fallas ?? [])
      setCuentas(r.cuentas ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar Space Eye')
    }
    setCargado(true)
    setCargando(false)
  }, [deviceId])

  useEffect(() => {
    if (!listo) return
    void cargar()
    const t = setInterval(() => void cargar(), RECARGA_MS)
    return () => clearInterval(t)
  }, [listo, cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const abiertas = useMemo(() => fallas.filter((f) => f.estado === 'abierta'), [fallas])
  const lista = useMemo(() => (estado ? fallas.filter((f) => f.estado === estado) : fallas), [fallas, estado])
  const cuenta = (e: Estado) => cuentas?.[e] ?? fallas.filter((f) => f.estado === e).length

  async function confirmarCierre(nota: string) {
    if (!cerrando) return
    const descartar = cerrando.estado === 'descartada'
    try {
      await seApi(`fallas/${cerrando.falla.id}`, {
        method: 'PUT',
        body: { estado: cerrando.estado, nota: nota.trim() || undefined },
      })
      setCerrando(null)
      setAviso({ tono: 'ok', texto: descartar ? 'Falla descartada.' : 'Falla marcada como arreglada.' })
      await cargar()
    } catch (e) {
      const msg =
        e instanceof ErrorSE && e.status === 403
          ? 'No tienes permiso para cerrar fallas.'
          : e instanceof ErrorSE && e.status === 404
            ? 'Esta falla ya no está abierta.'
            : e instanceof Error
              ? e.message
              : String(e)
      setCerrando(null)
      setAviso({ tono: 'error', texto: `No se pudo cerrar: ${msg}` })
      await cargar()
    }
  }

  return (
    <div className="w-full space-y-4 p-6">
      {/* Encabezado: el mismo patrón que el listado */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <MonitorX className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-lg font-semibold text-ink">Fallas de pantalla</h1>
          <p className="text-[13px] text-muted">
            Lo que cada equipo detectó por sí mismo al revisar su pantalla. Se actualiza cada minuto.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="se-fallas-equipo">
            Equipo
          </label>
          <select
            id="se-fallas-equipo"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64 sm:flex-none"
          >
            <option value="">Todos los equipos</option>
            {equipos.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>
        </div>
      </div>

      {aviso && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-md border p-3 text-[12px]',
            aviso.tono === 'ok'
              ? 'border-[#1da85040] bg-success-soft text-success'
              : 'border-[#dc262640] bg-error-soft text-error',
          )}
        >
          {aviso.tono === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {aviso.texto}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudieron leer las fallas</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      )}

      {/* Indicadores: los cuenta el servidor */}
      <div className="grid grid-cols-3 gap-3">
        <Indicador titulo="Abiertas" valor={cuenta('abierta')} punto="bg-error" resaltar={cuenta('abierta') > 0} />
        <Indicador titulo="Recuperadas" valor={cuenta('recuperada')} punto="bg-success" />
        <Indicador titulo="No eran falla" valor={cuenta('descartada')} punto="bg-border-strong" />
      </div>

      {/* Abiertas: es lo que hay que atender */}
      {abiertas.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] uppercase tracking-wide text-muted">
            Requieren atención · <span className="tabular-nums">{formatNumero(abiertas.length)}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {abiertas.map((f) => {
              const mini = fotoSE(f.evidencia_mini)
              return (
                <div
                  key={f.id}
                  className="flex gap-3 rounded-md border border-border border-l-[3px] border-l-error bg-surface p-3"
                >
                  {mini && (
                    <button
                      type="button"
                      onClick={() => setVerFoto(fotoSE(f.evidencia ?? f.evidencia_mini))}
                      className="aspect-[4/3] w-24 shrink-0 self-start overflow-hidden rounded bg-surface-2 sm:w-40"
                      title="Ver la foto de evidencia"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mini} alt="Evidencia de la falla" className="h-full w-full object-cover" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1 text-[12px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-error-soft px-2 py-0.5 text-[11px] font-medium text-error">
                      <AlertTriangle className="h-3 w-3" /> Falla detectada
                    </span>
                    <p className="mt-1.5 text-[13px] font-semibold text-ink">{f.nombre}</p>
                    <dl className="mt-1 space-y-0.5">
                      <Dato titulo="Equipo">
                        <Link href={`/space-eyes/${f.device_id}`} className="text-accent hover:underline">
                          {f.equipo}
                        </Link>
                      </Dato>
                      <Dato titulo="Zona">
                        <span className="break-words text-ink">{donde(f)}</span>
                      </Dato>
                      <Dato titulo="Detectada">
                        <span className="tabular-nums text-ink">{fechaHora(f.detectada_en)}</span>
                      </Dato>
                      <Dato titulo="Confianza">
                        <span className="tabular-nums text-ink">{Math.round(f.confianza * 100)}%</span>
                      </Dato>
                    </dl>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setCerrando({ falla: f, estado: 'recuperada' })}>
                        Ya se arregló
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCerrando({ falla: f, estado: 'descartada' })}>
                        No es falla
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Historial */}
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <h2 className="text-[14px] font-semibold text-ink">Historial</h2>
          <div className="inline-flex flex-wrap rounded-md border border-border bg-surface p-0.5 text-[13px]">
            {FILTROS.map(([valor, texto]) => (
              <button
                key={valor || 'todas'}
                type="button"
                onClick={() => setEstado(valor)}
                className={cn(
                  'rounded px-3 py-1.5 transition-colors duration-150',
                  estado === valor ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {texto}
              </button>
            ))}
          </div>
        </header>

        {!cargado ? (
          <div className="flex items-center gap-2 p-4 text-[12px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo las fallas…
          </div>
        ) : lista.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-muted">Sin fallas con este filtro.</p>
        ) : (
          <>
          {/* Hasta 1280 px, tarjetas: la tabla mide 820 y en celular o con el
              menu abierto quedaba cortada (se deslizaba de lado). */}
          <ul className="divide-y divide-border xl:hidden">
            {lista.map((f) => (
              <li key={f.id} className="space-y-1.5 p-3 text-[12px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{f.nombre}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px]', ESTADO[f.estado]?.clase)}>
                    {ESTADO[f.estado]?.texto ?? f.estado}
                  </span>
                </div>
                <div className="text-muted">{donde(f)}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                  <Link href={`/space-eyes/${f.device_id}`} className="text-accent hover:underline">
                    {f.equipo}
                  </Link>
                  <span className="tabular-nums">{fechaHora(f.detectada_en)}</span>
                  {f.recuperada_en && (
                    <span className="tabular-nums">
                      → {fechaHora(f.recuperada_en)}
                      {f.cerrada_por === 'usuario' ? ' · a mano' : ''}
                    </span>
                  )}
                </div>
                {f.nota && <div className="text-[11px] text-muted">{f.nota}</div>}
                {(f.evidencia || f.evidencia_recuperacion) && (
                  <div className="flex gap-3">
                    {f.evidencia && (
                      <button type="button" onClick={() => setVerFoto(fotoSE(f.evidencia))} className="text-accent hover:underline">
                        Foto al detectar
                      </button>
                    )}
                    {f.evidencia_recuperacion && (
                      <button
                        type="button"
                        onClick={() => setVerFoto(fotoSE(f.evidencia_recuperacion))}
                        className="text-accent hover:underline"
                      >
                        Foto al recuperar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[820px] text-[12px]">
              <thead className="border-b border-border text-left text-[11px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Detectada</th>
                  <th className="px-3 py-2 font-medium">Equipo</th>
                  <th className="px-3 py-2 font-medium">Falla</th>
                  <th className="px-3 py-2 font-medium">Zona</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Recuperación</th>
                  <th className="px-3 py-2 font-medium">Evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((f) => (
                  <tr key={f.id} className="hover:bg-surface-2">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fechaHora(f.detectada_en)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/space-eyes/${f.device_id}`} className="text-accent hover:underline">
                        {f.equipo}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink">{f.nombre}</td>
                    <td className="px-3 py-2 text-muted">{donde(f)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px]', ESTADO[f.estado]?.clase)}>
                        {ESTADO[f.estado]?.texto ?? f.estado}
                      </span>
                      {f.nota && <span className="mt-1 block text-[11px] text-muted">{f.nota}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">
                      {f.recuperada_en
                        ? `${fechaHora(f.recuperada_en)}${f.cerrada_por === 'usuario' ? ' · a mano' : ''}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {f.evidencia && (
                        <button type="button" onClick={() => setVerFoto(fotoSE(f.evidencia))} className="text-accent hover:underline">
                          al detectar
                        </button>
                      )}
                      {f.evidencia_recuperacion && (
                        <button
                          type="button"
                          onClick={() => setVerFoto(fotoSE(f.evidencia_recuperacion))}
                          className="ml-2 text-accent hover:underline"
                        >
                          al recuperar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      {/* Evidencia en grande */}
      <Modal open={!!verFoto} onOpenChange={(v) => !v && setVerFoto(null)} size="lg" title="Evidencia">
        {verFoto && <VisorFoto src={verFoto} alt="Evidencia de la falla" />}
      </Modal>

      <DialogoCierre cierre={cerrando} onCancelar={() => setCerrando(null)} onConfirmar={confirmarCierre} />
    </div>
  )
}

// ─── Cerrar una falla a mano, con una nota opcional ────────────────────────
// En Space Eye era el diálogo de la casa (antes `prompt()`); aquí, el Modal.
function DialogoCierre({
  cierre,
  onCancelar,
  onConfirmar,
}: {
  cierre: { falla: FallaSE; estado: 'recuperada' | 'descartada' } | null
  onCancelar: () => void
  onConfirmar: (nota: string) => Promise<void>
}) {
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    if (cierre) setNota('')
  }, [cierre])

  const descartar = cierre?.estado === 'descartada'
  const enviar = async () => {
    setEnviando(true)
    try {
      await onConfirmar(nota)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={!!cierre}
      onOpenChange={(v) => !v && !enviando && onCancelar()}
      title={descartar ? 'No es una falla' : 'Marcar como arreglada'}
      subtitle={cierre ? `${cierre.falla.nombre} · ${cierre.falla.equipo}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={enviando} onClick={onCancelar}>
            Cancelar
          </Button>
          <Button size="sm" variant="primary" disabled={enviando} onClick={() => void enviar()}>
            {enviando ? 'Guardando…' : descartar ? 'Descartar' : 'Marcar arreglada'}
          </Button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        {descartar
          ? 'El equipo no volverá a avisar de esta zona durante 7 días.'
          : 'Se cierra sin esperar a que el equipo lo compruebe en su próxima foto.'}
      </p>
      <label className="mt-3 block">
        <span className="block text-[12px] text-ink">
          Qué se hizo <span className="text-muted">(opcional)</span>
        </span>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !enviando) void enviar()
          }}
          maxLength={500}
          disabled={enviando}
          autoFocus
          placeholder={descartar ? 'Por ejemplo: es un reflejo del sol' : 'Por ejemplo: se cambió la fuente'}
          className="mt-1 h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
    </Modal>
  )
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{titulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function Indicador({
  titulo,
  valor,
  punto,
  resaltar = false,
}: {
  titulo: string
  valor: number
  punto: string
  resaltar?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
        <span className={cn('h-1.5 w-1.5 rounded-full', punto)} />
        {titulo}
      </div>
      <div
        className={cn(
          'mt-1.5 text-lg font-semibold leading-none tabular-nums',
          resaltar ? 'text-error' : valor ? 'text-ink' : 'text-muted',
        )}
      >
        {valor}
      </div>
    </div>
  )
}
