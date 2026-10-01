'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE } from 'react'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { seApi, fotoSE, ErrorSE } from '@/lib/data/space-eyes-se'
import {
  HORA,
  celdaEn,
  contorno,
  lineas,
  numeroGabinete,
  ordenar,
  type Celda,
  type Punto,
} from '@/lib/space-eyes-pantalla'
import { fechaHora } from './piezas'

// ============================================================================
//  PantallaConfig — la tarjeta «Pantalla y fallas» de la ficha, en su parte de
//  AJUSTES (la lista y el historial de fallas los pinta `PantallaYCreativos`).
// ----------------------------------------------------------------------------
//  Props:
//    equipoId     id del equipo en Space Eye.
//    puedeOperar  false = solo mirar: ni marcar la pantalla ni tocar la
//                 vigilancia.
//    onCambio?    opcional; se llama después de guardar algo (pantalla o
//                 vigilancia), para que quien la integra refresque lo demás
//                 (los creativos, por ejemplo, se reinician al cambiar las
//                 esquinas).
//
//  Qué hace: dónde está la pantalla en la última foto (4 esquinas que se
//  arrastran), cuántos gabinetes tiene (filas × columnas), su horario y las
//  zonas tapadas; y la vigilancia de fallas: encendida, cuánto aprende, cada
//  cuánto revisa, la última vuelta y los gabinetes que nunca cambian.
//
//  Habla con Space Eye por su puerta: GET/PUT devices/:id/pantalla, PUT
//  devices/:id/salud, GET devices/:id (versión del agente) y GET photos (la
//  foto sobre la que se marca).
// ============================================================================

type Horario = { inicio: string; fin: string }
type Pantalla = { esquinas: Punto[]; filas: number; columnas: number; excluir?: Celda[]; horario?: Horario }
type Salud = {
  vigilar: boolean
  desde: string | null
  aprendizaje_min: number
  aprendiendo: boolean
  cada_min: number
}
type Ultimo = {
  ts?: string
  recibido?: string
  pantalla?: string
  camara?: string
  vistazos?: number
  cambios?: number
  interrumpida?: boolean
  vistazos_usados?: number
  aprendiendo?: boolean
  camara_permitida?: boolean
  excluidas?: Celda[]
}
type RespPantalla = { pantalla: Pantalla | null; salud: Salud | null; ultimo: Ultimo | null }
type Foto = { id: number; source?: string; storage_path?: string | null; thumbnail_path?: string | null }

type Edicion = { esquinas: Punto[]; filas: number | ''; columnas: number | ''; excluir: Celda[]; horario: Horario }
type Modo = 'esquinas' | 'excluir'

const HORARIO_BASE: Horario = { inicio: '06:00', fin: '24:00' }

const APRENDIZAJE = [
  { v: 0, t: 'Solo la primera vuelta (pruebas)' },
  { v: 30, t: '30 minutos' },
  { v: 120, t: '2 horas' },
  { v: 360, t: '6 horas' },
  { v: 1440, t: '24 horas' },
]
const FRECUENCIA = [
  { v: 5, t: 'Cada 5 min (pruebas)' },
  { v: 15, t: 'Cada 15 min (pruebas)' },
  { v: 30, t: 'Cada 30 min' },
  { v: 60, t: 'Cada hora' },
  { v: 120, t: 'Cada 2 horas' },
  { v: 180, t: 'Cada 3 horas' },
]

const CAMPO =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-surface-2 disabled:text-muted'

// Solo la APK 0.15.0+ usa la pantalla marcada y busca fallas. La Raspberry y el
// agente de PC todavía no.
function usaPantalla(version: string | null | undefined): boolean {
  const v = String(version || '')
  if (/^(pi|pc)-agent/i.test(v)) return false
  const [a, b] = v.split('.').map(Number)
  return a > 0 || (a === 0 && b >= 15)
}

function mensaje(e: unknown): string {
  if (e instanceof ErrorSE && e.status === 403) return 'No tienes permiso para cambiar esto.'
  return e instanceof Error ? e.message : String(e)
}

export function PantallaConfig({
  equipoId,
  puedeOperar,
  onCambio,
}: {
  equipoId: number
  puedeOperar: boolean
  onCambio?: () => void
}) {
  const [datos, setDatos] = useState<RespPantalla | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [guardandoSalud, setGuardandoSalud] = useState(false)

  const [edit, setEdit] = useState<Edicion | null>(null)
  const [modo, setModo] = useState<Modo>('esquinas')
  const [guardandoPant, setGuardandoPant] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const arrastre = useRef<number | null>(null)

  const cargarPantalla = useCallback(async () => {
    const p = await seApi<RespPantalla>(`devices/${equipoId}/pantalla`)
    setDatos(p)
    return p
  }, [equipoId])

  useEffect(() => {
    let vivo = true
    setError(null)
    Promise.all([
      seApi<RespPantalla>(`devices/${equipoId}/pantalla`),
      seApi<{ device: { app_version: string | null } }>(`devices/${equipoId}`),
      // Varias, no una: la más reciente puede ser una evidencia de falla, que
      // trae dibujos encima y no sirve para marcar.
      seApi<{ photos: Foto[] }>(`photos?device_id=${equipoId}&limit=8`).catch(() => ({ photos: [] as Foto[] })),
    ])
      .then(([p, d, f]) => {
        if (!vivo) return
        setDatos(p)
        setVersion(d.device?.app_version ?? null)
        const ref = (f.photos ?? []).find((x) => x.source !== 'falla')
        setFoto(ref ? fotoSE(ref.storage_path || ref.thumbnail_path) : null)
      })
      .catch((e) => vivo && setError(mensaje(e)))
    return () => {
      vivo = false
    }
  }, [equipoId])

  const sabe = usaPantalla(version)
  const pantalla = datos?.pantalla ?? null
  const salud = datos?.salud ?? null
  const ultimo = datos?.ultimo ?? null

  // ─── Vigilancia ──────────────────────────────────────────────────────────
  async function guardarSalud(cambios: Partial<Pick<Salud, 'vigilar' | 'aprendizaje_min' | 'cada_min'>>) {
    setGuardandoSalud(true)
    setAviso(null)
    try {
      await seApi(`devices/${equipoId}/salud`, { method: 'PUT', body: cambios })
      await cargarPantalla()
      onCambio?.()
    } catch (e) {
      setAviso({ tipo: 'error', texto: `No se pudo guardar: ${mensaje(e)}` })
    } finally {
      setGuardandoSalud(false)
    }
  }

  // ─── Editor de la pantalla ───────────────────────────────────────────────
  function empezar() {
    setEdit(
      pantalla
        ? {
            esquinas: pantalla.esquinas.map((q) => [q[0], q[1]] as Punto),
            filas: pantalla.filas,
            columnas: pantalla.columnas,
            excluir: (pantalla.excluir ?? []).map((c) => [c[0], c[1]] as Celda),
            horario: { ...(pantalla.horario ?? HORARIO_BASE) },
          }
        : { esquinas: [], filas: 1, columnas: 1, excluir: [], horario: { ...HORARIO_BASE } },
    )
    setModo('esquinas')
    setAviso(null)
  }

  const num = useMemo(() => {
    if (!edit) return null
    return {
      esquinas: edit.esquinas,
      filas: Math.min(20, Math.max(1, Number(edit.filas) || 1)),
      columnas: Math.min(40, Math.max(1, Number(edit.columnas) || 1)),
    }
  }, [edit])

  const completa = !!edit && edit.esquinas.length === 4
  const lineasEdit = completa && num ? lineas(num) : []
  const excluidasEdit =
    completa && num && edit
      ? edit.excluir.filter(([f, c]) => f < num.filas && c < num.columnas).map(([f, c]) => contorno(num, f, c))
      : []

  const filasOk = !!edit && Number.isInteger(Number(edit.filas)) && Number(edit.filas) >= 1 && Number(edit.filas) <= 20
  const columnasOk =
    !!edit && Number.isInteger(Number(edit.columnas)) && Number(edit.columnas) >= 1 && Number(edit.columnas) <= 40
  const horarioOk = !!edit && HORA.test(edit.horario.inicio || '06:00') && HORA.test(edit.horario.fin || '24:00')
  const sePuedeGuardar = completa && filasOk && columnasOk && horarioOk && !guardandoPant

  function puntoFoto(e: PE<HTMLDivElement>): Punto | null {
    const img = imgRef.current
    if (!img) return null
    const caja = img.getBoundingClientRect()
    if (!caja.width || !caja.height) return null
    return [
      Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width)),
      Math.min(1, Math.max(0, (e.clientY - caja.top) / caja.height)),
    ]
  }

  function abajo(e: PE<HTMLDivElement>) {
    if (!edit || !puedeOperar || !num) return
    const p = puntoFoto(e)
    if (!p) return
    e.preventDefault()
    const [x, y] = p
    if (modo === 'excluir' && edit.esquinas.length === 4) {
      const celda = celdaEn(num, x, y)
      if (!celda) return
      const k = edit.excluir.findIndex(([f, c]) => f === celda[0] && c === celda[1])
      setEdit({
        ...edit,
        excluir: k >= 0 ? edit.excluir.filter((_, i) => i !== k) : [...edit.excluir, celda],
      })
      return
    }
    // Cerca de una esquina: se arrastra. Si faltan esquinas: se agrega.
    const caja = imgRef.current!.getBoundingClientRect()
    const q = edit.esquinas
    const cerca = q.findIndex(([qx, qy]) => Math.hypot((qx - x) * caja.width, (qy - y) * caja.height) < 18)
    if (cerca >= 0) arrastre.current = cerca
    else if (q.length < 4) {
      setEdit({ ...edit, esquinas: [...q, [x, y]] })
      arrastre.current = q.length
    } else return
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function mueve(e: PE<HTMLDivElement>) {
    const k = arrastre.current
    if (k == null) return
    const p = puntoFoto(e)
    if (!p) return
    setEdit((ed) => (ed ? { ...ed, esquinas: ed.esquinas.map((q, i) => (i === k ? p : q)) } : ed))
  }

  function arriba() {
    arrastre.current = null
  }

  // Otras esquinas u otra cuadrícula son otra imagen: el equipo olvida lo
  // aprendido. Se avisa ANTES de guardar.
  function pedirGuardar() {
    if (!edit || !num || !sePuedeGuardar) return
    const esq = ordenar(edit.esquinas)
    const cambia =
      !!pantalla &&
      (JSON.stringify(pantalla.esquinas) !== JSON.stringify(esq.map(([x, y]) => [redondea(x), redondea(y)])) ||
        pantalla.filas !== num.filas ||
        pantalla.columnas !== num.columnas)
    if (cambia) setConfirmar(true)
    else void guardarPantalla()
  }

  async function guardarPantalla() {
    if (!edit || !num) return
    const esq = ordenar(edit.esquinas)
    setGuardandoPant(true)
    setAviso(null)
    try {
      const r = await seApi<{ ok: boolean; reiniciado?: boolean }>(`devices/${equipoId}/pantalla`, {
        method: 'PUT',
        body: {
          esquinas: esq.map(([x, y]) => [redondea(x), redondea(y)]),
          filas: num.filas,
          columnas: num.columnas,
          excluir: edit.excluir.filter(([f, c]) => f < num.filas && c < num.columnas),
          horario: { inicio: edit.horario.inicio || '06:00', fin: edit.horario.fin || '24:00' },
        },
      })
      setEdit(null)
      setConfirmar(false)
      await cargarPantalla()
      onCambio?.()
      setAviso({
        tipo: 'ok',
        texto: r?.reiniciado ? 'Pantalla guardada. El equipo vuelve a aprenderla desde cero.' : 'Pantalla guardada.',
      })
    } catch (e) {
      setConfirmar(false)
      setAviso({ tipo: 'error', texto: `No se pudo guardar la pantalla: ${mensaje(e)}` })
    } finally {
      setGuardandoPant(false)
    }
  }

  // ─── Resúmenes ───────────────────────────────────────────────────────────
  const resumen = useMemo(() => ultimaRevision(ultimo), [ultimo])
  const quietas = useMemo(() => {
    const ex = ultimo?.excluidas ?? []
    if (!ex.length || !pantalla) return ''
    return ex.map((c) => numeroGabinete(pantalla.columnas, c)).join(', ')
  }, [ultimo, pantalla])
  const finAprendizaje = useMemo(() => {
    if (!salud?.desde) return ''
    const min = Number(salud.aprendizaje_min ?? 120)
    return fechaHora(new Date(new Date(salud.desde).getTime() + min * 60_000).toISOString())
  }, [salud])

  if (error) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        No se pudo leer la pantalla del equipo: {error}
      </div>
    )
  }
  if (!datos) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo la pantalla del equipo…
      </div>
    )
  }

  const vigilar = !!salud?.vigilar
  const aprendiendo = !!salud?.aprendiendo || !!ultimo?.aprendiendo
  const interruptorApagado = !puedeOperar || !sabe || !pantalla || guardandoSalud

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-ink">Pantalla y fallas</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            El equipo revisa su pantalla por sí mismo y solo avisa cuando confirma una falla o cuando se arregla. No
            manda video ni fotos mientras todo está bien.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              !vigilar ? 'bg-surface-2 text-muted' : aprendiendo ? 'bg-accent-soft text-accent' : 'bg-success-soft text-success',
            )}
          >
            {!vigilar ? 'Vigilancia apagada' : aprendiendo ? 'Aprendiendo' : 'Vigilando'}
          </span>
          <Interruptor
            etiqueta="Vigilar fallas"
            activo={vigilar}
            deshabilitado={interruptorApagado}
            onCambio={(v) => guardarSalud({ vigilar: v })}
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {!sabe && (
          <Aviso tono="alerta">
            La vigilancia de fallas necesita la app 0.15.0 o posterior en el celular. La Raspberry y el agente de PC
            todavía no la tienen.
          </Aviso>
        )}
        {sabe && !pantalla && (
          <Aviso tono="alerta">
            Falta marcar dónde está la pantalla en la foto: sin eso el equipo no vigila fallas ni creativos.
          </Aviso>
        )}
        {aviso && <Aviso tono={aviso.tipo === 'ok' ? 'info' : 'falla'}>{aviso.texto}</Aviso>}

        {/* Tres decisiones, cada una en su recuadro */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">Pantalla</p>
            {pantalla ? (
              <div className="mt-1.5">
                <p className="text-[13px] text-ink">
                  <span className="font-semibold tabular-nums">{pantalla.filas * pantalla.columnas}</span> gabinetes{' '}
                  <span className="text-muted tabular-nums">
                    ({pantalla.filas} × {pantalla.columnas})
                  </span>
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Encendida de <span className="tabular-nums text-ink">{pantalla.horario?.inicio || '06:00'}</span> a{' '}
                  <span className="tabular-nums text-ink">{pantalla.horario?.fin || '24:00'}</span>
                </p>
              </div>
            ) : (
              <p className="mt-1.5 text-[13px] text-muted">Sin marcar</p>
            )}
            {puedeOperar && !edit && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={empezar}>
                {pantalla ? 'Cambiar pantalla' : 'Marcar la pantalla'}
              </Button>
            )}
          </div>

          <label
            className="block rounded-md border border-border p-3"
            title="Antes de avisar, el equipo aprende cómo se ve la pantalla normalmente. Siempre aprende al menos su primera vuelta con la pantalla funcionando."
          >
            <span className="block text-[11px] uppercase tracking-wide text-muted">Aprendizaje</span>
            <span className="mb-2 mt-1.5 block text-[12px] text-muted">Cuánto observa antes de empezar a avisar.</span>
            <select
              className={cn(CAMPO, 'w-full')}
              value={salud?.aprendizaje_min ?? 120}
              disabled={!puedeOperar || guardandoSalud}
              onChange={(e) => guardarSalud({ aprendizaje_min: Number(e.target.value) })}
            >
              {opciones(APRENDIZAJE, salud?.aprendizaje_min)}
            </select>
          </label>

          <label className="block rounded-md border border-border p-3">
            <span className="block text-[11px] uppercase tracking-wide text-muted">Frecuencia</span>
            <span className="mb-2 mt-1.5 block text-[12px] text-muted">
              Cada cuánto revisa la pantalla (dentro del horario).
            </span>
            <select
              className={cn(CAMPO, 'w-full')}
              value={salud?.cada_min ?? 60}
              disabled={!puedeOperar || !vigilar || guardandoSalud}
              onChange={(e) => guardarSalud({ cada_min: Number(e.target.value) })}
            >
              {opciones(FRECUENCIA, salud?.cada_min)}
            </select>
          </label>
        </div>

        {/* ── Editor: 4 esquinas + gabinetes + zonas tapadas + horario ── */}
        {edit && (
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
              <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
                {(['esquinas', 'excluir'] as Modo[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={m === 'excluir' && !completa}
                    onClick={() => setModo(m)}
                    className={cn(
                      'rounded px-2.5 py-1 transition-colors duration-150 disabled:text-muted disabled:opacity-60',
                      modo === m ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
                    )}
                  >
                    {m === 'esquinas' ? 'Esquinas' : 'Zonas tapadas'}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-1.5 text-muted">
                Filas
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={edit.filas}
                  onChange={(e) => setEdit({ ...edit, filas: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={cn(CAMPO, 'w-16', !filasOk && 'border-error')}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-muted">
                Columnas
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={edit.columnas}
                  onChange={(e) => setEdit({ ...edit, columnas: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={cn(CAMPO, 'w-16', !columnasOk && 'border-error')}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-muted">
                Encendida de
                <input
                  type="time"
                  value={edit.horario.inicio}
                  onChange={(e) => setEdit({ ...edit, horario: { ...edit.horario, inicio: e.target.value } })}
                  className={CAMPO}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-muted">
                a
                {/* Texto y no `time`: el fin puede ser 24:00, que un selector de hora no acepta. */}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="24:00"
                  value={edit.horario.fin}
                  onChange={(e) => setEdit({ ...edit, horario: { ...edit.horario, fin: e.target.value } })}
                  className={cn(CAMPO, 'w-20 tabular-nums', !HORA.test(edit.horario.fin || '24:00') && 'border-error')}
                />
              </label>
            </div>
            {!horarioOk && <p className="mb-2 text-[12px] text-error">El horario va en HH:MM, de 00:00 a 24:00.</p>}

            <p className="mb-2 text-[12px] text-muted">
              {modo === 'esquinas' ? (
                <>
                  Toca las 4 esquinas de la pantalla en orden:{' '}
                  <span className="font-medium text-ink">
                    arriba izquierda, arriba derecha, abajo derecha, abajo izquierda
                  </span>
                  . Después puedes arrastrarlas. Pon filas y columnas de gabinetes para que las líneas coincidan con las
                  uniones. Si cambias el zoom o el lente del equipo, hay que volver a marcarla.
                </>
              ) : (
                <>
                  Toca los gabinetes que algo tapa siempre (una barda, un árbol, un poste): no se revisan. El equipo
                  también las aprende solo en sus primeras 24 horas.
                </>
              )}
            </p>

            {!foto ? (
              <p className="py-4 text-[12px] text-muted">Toma primero una foto del equipo para poder marcar la pantalla.</p>
            ) : (
              <div
                className="relative inline-block max-w-full cursor-crosshair touch-none select-none"
                onPointerDown={abajo}
                onPointerMove={mueve}
                onPointerUp={arriba}
                onPointerCancel={arriba}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={foto}
                  alt="Última foto del equipo"
                  draggable={false}
                  className="block max-h-[65vh] max-w-full"
                />
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {excluidasEdit.map((poli, k) => (
                    <polygon key={`x${k}`} points={poli} fill="rgba(0,0,0,0.45)" />
                  ))}
                  {edit.esquinas.length >= 2 && (
                    <polygon
                      points={edit.esquinas.map((p) => p.join(',')).join(' ')}
                      // Por `style` y no por atributo: un atributo de SVG no
                      // resuelve var(); el estilo sí.
                      style={{ fill: 'var(--accent)', fillOpacity: 0.08, stroke: 'var(--accent)' }}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {lineasEdit.map((l, k) => (
                    <line
                      key={`l${k}`}
                      x1={l[0]}
                      y1={l[1]}
                      x2={l[2]}
                      y2={l[3]}
                      style={{ stroke: 'var(--accent)' }}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
                {edit.esquinas.map((q, k) => (
                  <span
                    key={`e${k}`}
                    className="pointer-events-none absolute -ml-2.5 -mt-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-accent bg-surface text-[10px] font-bold text-accent"
                    style={{ left: `${q[0] * 100}%`, top: `${q[1] * 100}%` }}
                  >
                    {k + 1}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={!sePuedeGuardar || !puedeOperar} onClick={pedirGuardar}>
                {guardandoPant ? 'Guardando…' : 'Guardar pantalla'}
              </Button>
              <Button size="sm" variant="secondary" disabled={guardandoPant} onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={guardandoPant}
                onClick={() => {
                  setEdit({ ...edit, esquinas: [], excluir: [] })
                  setModo('esquinas')
                }}
              >
                Volver a empezar
              </Button>
            </div>
          </div>
        )}

        {/* ── Última revisión y avisos ── */}
        {vigilar && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Última revisión</p>
            <p className="text-[13px] text-ink">{resumen}</p>
            {salud?.aprendiendo && (
              <Aviso tono="info">
                Aprendiendo la pantalla hasta <span className="font-medium">{finAprendizaje}</span>: en este plazo no
                avisa de fallas.
              </Aviso>
            )}
            {!salud?.aprendiendo && ultimo?.aprendiendo && (
              <Aviso tono="info">Aprendiendo con su primera vuelta: la siguiente ya vigila.</Aviso>
            )}
            {ultimo?.camara_permitida === false && (
              <Aviso tono="falla">
                Android no le deja usar la cámara en segundo plano, así que no está revisando la pantalla. Abre la app
                Space Eye en el celular una vez y se arregla sola. Pasa tras reiniciar el celular, salvo que la app sea
                dueña del dispositivo.
              </Aviso>
            )}
            {quietas && (
              <Aviso tono="alerta">
                Gabinetes que nunca cambian (no se revisan): <span className="font-medium tabular-nums">{quietas}</span>.
                Suelen estar tapados por algo; si no hay nada delante, revísalos: podrían llevar tiempo apagados.
              </Aviso>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Cambió el encuadre de la pantalla"
        confirmLabel="Guardar de todos modos"
        busy={guardandoPant}
        onConfirm={() => void guardarPantalla()}
      >
        Cambiaron las esquinas o los gabinetes, así que el equipo olvida lo que había aprendido. Vuelve a aprender
        antes de poder avisar de fallas.
      </ConfirmDialog>
    </section>
  )
}

function redondea(v: number) {
  return Math.round(v * 1000) / 1000
}

// Un valor guardado que no está en la lista (puesto desde otro sitio) se
// muestra igual, en vez de que el selector mienta enseñando el primero.
function opciones(lista: { v: number; t: string }[], actual: number | undefined) {
  const todas = actual != null && !lista.some((o) => o.v === actual) ? [...lista, { v: actual, t: `${actual} min` }] : lista
  return todas.map((o) => (
    <option key={o.v} value={o.v}>
      {o.t}
    </option>
  ))
}

// Resumen de la última vuelta, en una línea.
function ultimaRevision(u: Ultimo | null): string {
  if (!u) return 'El equipo todavía no ha hecho ninguna revisión.'
  const cuando = fechaHora(u.ts || u.recibido || null)
  const estados: Record<string, string> = {
    OK: 'se ve bien',
    APAGADA: 'apagada',
    CONGELADA: 'congelada',
    INCONCLUSO: 'no se pudo juzgar',
  }
  const pantalla = (u.pantalla && estados[u.pantalla]) || u.pantalla || 'sin dato'
  const camara = ({ MOVIDA: ' · la cámara se movió', SIN_IMAGEN: ' · sin imagen' } as Record<string, string>)[u.camara ?? ''] ?? ''
  // Si alguien abrió la vista en vivo o pidió una foto a mitad de la vuelta,
  // solo se juzgó con el tramo más largo: se dice, para que no sorprenda.
  const corte =
    u.interrumpida && u.vistazos_usados != null
      ? ` La vuelta se interrumpió (vista en vivo o una foto): se usaron ${u.vistazos_usados} de ${u.vistazos} vistazos.`
      : ''
  return `${cuando} · pantalla ${pantalla}${camara} (${u.vistazos ?? 0} vistazos, ${u.cambios ?? 0} cambios de anuncio).${corte}`
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
