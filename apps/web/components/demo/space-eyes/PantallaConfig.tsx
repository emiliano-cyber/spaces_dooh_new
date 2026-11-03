'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE } from 'react'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { seApi, fotoSE, ErrorSE, textoDeError } from '@/lib/data/space-eyes-se'
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
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { interpolarNodos } from '@/lib/i18n/nodos'

// ============================================================================
//  PantallaConfig — la tarjeta «Pantalla y fallas» de la ficha, en su parte de
//  AJUSTES (la lista y el historial de fallas los pinta `PantallaYCreativos`).
// ----------------------------------------------------------------------------
//  Props:
//    equipoId     id del equipo en Space Eye.
//    puedeOperar  false = solo mirar: no se toca la vigilancia (interruptor,
//                 frecuencia, umbrales).
//    puedeEncuadrar  marcar la pantalla es ENCUADRAR: las 4 esquinas son lo que
//                 el equipo mira, y cambiarlas tira el catalogo de creativos
//                 que aprendio. Solo el Dueno (`lib/roles.ts`, 19/10/2026).
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
  // La pantalla completa apagada avisa en menos de un minuto. Space Eye viejo
  // no lo manda: cuenta como encendido, que es lo que hace el equipo.
  aviso_rapido?: boolean
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
type Foto = {
  id: number
  source?: string
  storage_path?: string | null
  thumbnail_path?: string | null
  display_rotation?: number | null
}

// Una foto tomada sin la vista en vivo llega acostada y trae su giro aparte
// (`display_rotation`). El equipo vigila la pantalla ya girada como en el vivo,
// así que las esquinas se marcan sobre la foto girada: se gira aquí en un lienzo
// (no con CSS) para que los toques caigan en las coordenadas de la foto derecha.
async function fotoDerecha(url: string, giro: number): Promise<string> {
  const g = ((Math.round(giro) % 360) + 360) % 360
  if (g !== 90 && g !== 180 && g !== 270) return url
  const img = new Image()
  img.src = url
  await img.decode()
  const lado = g === 180
  const lienzo = document.createElement('canvas')
  lienzo.width = lado ? img.naturalWidth : img.naturalHeight
  lienzo.height = lado ? img.naturalHeight : img.naturalWidth
  const ctx = lienzo.getContext('2d')
  if (!ctx) return url
  ctx.translate(lienzo.width / 2, lienzo.height / 2)
  ctx.rotate((g * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  return lienzo.toDataURL('image/jpeg', 0.9)
}

type Edicion = { esquinas: Punto[]; filas: number | ''; columnas: number | ''; excluir: Celda[]; horario: Horario }
type Modo = 'esquinas' | 'excluir'

const HORARIO_BASE: Horario = { inicio: '06:00', fin: '24:00' }

const APRENDIZAJE: { v: number; t: ClaveTexto }[] = [
  { v: 0, t: 'spaceeyes.pconfig.aprendizaje.0' },
  { v: 30, t: 'spaceeyes.pconfig.aprendizaje.30' },
  { v: 120, t: 'spaceeyes.pconfig.aprendizaje.120' },
  { v: 360, t: 'spaceeyes.pconfig.aprendizaje.360' },
  { v: 1440, t: 'spaceeyes.pconfig.aprendizaje.1440' },
]
const FRECUENCIA: { v: number; t: ClaveTexto }[] = [
  { v: 5, t: 'spaceeyes.pconfig.frecuencia.5' },
  { v: 15, t: 'spaceeyes.pconfig.frecuencia.15' },
  { v: 30, t: 'spaceeyes.frecuencia.30' },
  { v: 60, t: 'spaceeyes.frecuencia.60' },
  { v: 120, t: 'spaceeyes.frecuencia.120' },
  { v: 180, t: 'spaceeyes.frecuencia.180' },
]

const CAMPO =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-surface-2 disabled:text-muted'

// Usan la pantalla marcada y buscan fallas la APK 0.15.0+ y la Raspberry
// 0.7.0+ (pi-agent/vision). El agente de PC todavía no.
function usaPantalla(version: string | null | undefined): boolean {
  const v = String(version || '')
  if (/^pc-agent/i.test(v)) return false
  const pi = /^pi-agent/i.test(v)
  const [a, b] = v.replace(/^pi-agent[^\d]*/i, '').split('.').map(Number)
  if (pi) return a > 0 || (a === 0 && b >= 7)
  return a > 0 || (a === 0 && b >= 15)
}

function mensaje(e: unknown, idioma: Idioma): string {
  if (e instanceof ErrorSE && e.status === 403) return traducir(idioma, 'spaceeyes.comun.sin-permiso-cambiar')
  return textoDeError(e, idioma) ?? String(e)
}

export function PantallaConfig({
  equipoId,
  puedeOperar,
  puedeEncuadrar,
  onCambio,
}: {
  equipoId: number
  puedeOperar: boolean
  puedeEncuadrar: boolean
  onCambio?: () => void
}) {
  const { t, idioma } = useIdioma()
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
        if (!ref) return setFoto(null)
        const url = fotoSE(ref.storage_path || ref.thumbnail_path)
        if (!url) return setFoto(null)
        return fotoDerecha(url, ref.display_rotation ?? 0)
          .catch(() => url)
          .then((u) => vivo && setFoto(u))
      })
      .catch((e) => vivo && setError(mensaje(e, idioma)))
    return () => {
      vivo = false
    }
  }, [equipoId, idioma])

  const sabe = usaPantalla(version)
  const pantalla = datos?.pantalla ?? null
  const salud = datos?.salud ?? null
  const ultimo = datos?.ultimo ?? null

  // ─── Vigilancia ──────────────────────────────────────────────────────────
  async function guardarSalud(
    cambios: Partial<Pick<Salud, 'vigilar' | 'aprendizaje_min' | 'cada_min' | 'aviso_rapido'>>,
  ) {
    setGuardandoSalud(true)
    setAviso(null)
    try {
      await seApi(`devices/${equipoId}/salud`, { method: 'PUT', body: cambios })
      await cargarPantalla()
      onCambio?.()
    } catch (e) {
      setAviso({ tipo: 'error', texto: t('spaceeyes.comun.no-guardar', { motivo: mensaje(e, idioma) }) })
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
    if (!edit || !puedeEncuadrar || !num) return
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
        texto: r?.reiniciado ? t('spaceeyes.pconfig.guardada.reinicia') : t('spaceeyes.pconfig.guardada'),
      })
    } catch (e) {
      setConfirmar(false)
      setAviso({ tipo: 'error', texto: t('spaceeyes.pconfig.no-guardar', { motivo: mensaje(e, idioma) }) })
    } finally {
      setGuardandoPant(false)
    }
  }

  // ─── Resúmenes ───────────────────────────────────────────────────────────
  const resumen = useMemo(() => ultimaRevision(ultimo, idioma), [ultimo, idioma])
  const quietas = useMemo(() => {
    const ex = ultimo?.excluidas ?? []
    if (!ex.length || !pantalla) return ''
    return ex.map((c) => numeroGabinete(pantalla.columnas, c)).join(', ')
  }, [ultimo, pantalla])
  const finAprendizaje = useMemo(() => {
    if (!salud?.desde) return ''
    const min = Number(salud.aprendizaje_min ?? 120)
    return fechaHora(new Date(new Date(salud.desde).getTime() + min * 60_000).toISOString(), idioma)
  }, [salud, idioma])

  if (error) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        {t('spaceeyes.pconfig.error', { error })}
      </div>
    )
  }
  if (!datos) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('spaceeyes.pconfig.leyendo')}
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
          <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.pantalla.titulo')}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.pconfig.descripcion')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              !vigilar ? 'bg-surface-2 text-muted' : aprendiendo ? 'bg-accent-soft text-accent' : 'bg-success-soft text-success',
            )}
          >
            {!vigilar
              ? t('spaceeyes.pconfig.apagada')
              : aprendiendo
                ? t('spaceeyes.vigilancia.aprendiendo')
                : t('spaceeyes.vigilancia.vigilando')}
          </span>
          <Interruptor
            etiqueta={t('spaceeyes.pconfig.vigilar')}
            activo={vigilar}
            deshabilitado={interruptorApagado}
            onCambio={(v) => guardarSalud({ vigilar: v })}
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {!sabe && (
          <Aviso tono="alerta">
            {t('spaceeyes.pconfig.no-sabe')}
          </Aviso>
        )}
        {sabe && !pantalla && (
          <Aviso tono="alerta">
            {t('spaceeyes.pconfig.sin-marcar.aviso')}
          </Aviso>
        )}
        {aviso && <Aviso tono={aviso.tipo === 'ok' ? 'info' : 'falla'}>{aviso.texto}</Aviso>}

        {/* Tres decisiones, cada una en su recuadro */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.pconfig.pantalla')}</p>
            {pantalla ? (
              <div className="mt-1.5">
                <p className="text-[13px] text-ink">
                  {interpolarNodos(t('spaceeyes.pconfig.gabinetes'), {
                    n: <span className="font-semibold tabular-nums">{pantalla.filas * pantalla.columnas}</span>,
                    medida: (
                      <span className="text-muted tabular-nums">
                        ({pantalla.filas} × {pantalla.columnas})
                      </span>
                    ),
                  })}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {interpolarNodos(t('spaceeyes.comun.encendida'), {
                    inicio: <span className="tabular-nums text-ink">{pantalla.horario?.inicio || '06:00'}</span>,
                    fin: <span className="tabular-nums text-ink">{pantalla.horario?.fin || '24:00'}</span>,
                  })}
                </p>
              </div>
            ) : (
              <p className="mt-1.5 text-[13px] text-muted">{t('spaceeyes.pconfig.sin-marcar')}</p>
            )}
            {puedeEncuadrar && !edit && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={empezar}>
                {pantalla ? t('spaceeyes.pconfig.cambiar') : t('spaceeyes.pconfig.marcar')}
              </Button>
            )}
            {!puedeEncuadrar && (
              <p className="mt-2 text-[12px] text-muted">
                {t('spaceeyes.pconfig.solo-dueno')}
              </p>
            )}
          </div>

          <label
            className="block rounded-md border border-border p-3"
            title={t('spaceeyes.pconfig.aprendizaje.ayuda')}
          >
            <span className="block text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.pconfig.aprendizaje')}</span>
            <span className="mb-2 mt-1.5 block text-[12px] text-muted">{t('spaceeyes.pconfig.aprendizaje.texto')}</span>
            <select
              className={cn(CAMPO, 'w-full')}
              value={salud?.aprendizaje_min ?? 120}
              disabled={!puedeOperar || guardandoSalud}
              onChange={(e) => guardarSalud({ aprendizaje_min: Number(e.target.value) })}
            >
              {opciones(APRENDIZAJE.map((o) => ({ v: o.v, t: t(o.t) })), salud?.aprendizaje_min)}
            </select>
          </label>

          <label className="block rounded-md border border-border p-3">
            <span className="block text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.comun.frecuencia')}</span>
            <span className="mb-2 mt-1.5 block text-[12px] text-muted">{t('spaceeyes.pconfig.frecuencia.texto')}</span>
            <select
              className={cn(CAMPO, 'w-full')}
              value={salud?.cada_min ?? 60}
              disabled={!puedeOperar || !vigilar || guardandoSalud}
              onChange={(e) => guardarSalud({ cada_min: Number(e.target.value) })}
            >
              {opciones(FRECUENCIA.map((o) => ({ v: o.v, t: t(o.t) })), salud?.cada_min)}
            </select>
          </label>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
          title={t('spaceeyes.pconfig.rapido.ayuda')}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink">{t('spaceeyes.pconfig.rapido')}</p>
            <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.pconfig.rapido.texto')}</p>
          </div>
          <Interruptor
            etiqueta={salud?.aviso_rapido === false ? t('spaceeyes.comun.apagado') : t('spaceeyes.comun.encendido')}
            activo={salud?.aviso_rapido !== false}
            deshabilitado={!puedeOperar || !vigilar || guardandoSalud}
            onCambio={(v) => guardarSalud({ aviso_rapido: v })}
          />
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
                    {m === 'esquinas' ? t('spaceeyes.pconfig.esquinas') : t('spaceeyes.pconfig.zonas')}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-1.5 text-muted">
                {t('spaceeyes.pconfig.filas')}
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
                {t('spaceeyes.pconfig.columnas')}
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
                {t('spaceeyes.pconfig.editor.desde')}
                <input
                  type="time"
                  value={edit.horario.inicio}
                  onChange={(e) => setEdit({ ...edit, horario: { ...edit.horario, inicio: e.target.value } })}
                  className={CAMPO}
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-muted">
                {t('spaceeyes.pconfig.editor.a')}
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
            {!horarioOk && <p className="mb-2 text-[12px] text-error">{t('spaceeyes.pconfig.horario-mal')}</p>}

            <p className="mb-2 text-[12px] text-muted">
              {modo === 'esquinas' ? (
                interpolarNodos(t('spaceeyes.pconfig.ayuda.esquinas'), {
                  orden: <span className="font-medium text-ink">{t('spaceeyes.pconfig.ayuda.orden')}</span>,
                })
              ) : (
                t('spaceeyes.pconfig.ayuda.zonas')
              )}
            </p>

            {!foto ? (
              <p className="py-4 text-[12px] text-muted">{t('spaceeyes.pconfig.sin-foto')}</p>
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
                  alt={t('spaceeyes.pconfig.alt-foto')}
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
              <Button size="sm" disabled={!sePuedeGuardar || !puedeEncuadrar} onClick={pedirGuardar}>
                {guardandoPant ? t('spaceeyes.comun.guardando') : t('spaceeyes.pconfig.guardar')}
              </Button>
              <Button size="sm" variant="secondary" disabled={guardandoPant} onClick={() => setEdit(null)}>
                {t('comun.cancelar')}
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
                {t('spaceeyes.pconfig.empezar')}
              </Button>
            </div>
          </div>
        )}

        {/* ── Última revisión y avisos ── */}
        {vigilar && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">{t('spaceeyes.pconfig.ultima')}</p>
            <p className="text-[13px] text-ink">{resumen}</p>
            {salud?.aprendiendo && (
              <Aviso tono="info">
                {interpolarNodos(t('spaceeyes.pconfig.aprendiendo'), {
                  fin: <span className="font-medium">{finAprendizaje}</span>,
                })}
              </Aviso>
            )}
            {!salud?.aprendiendo && ultimo?.aprendiendo && (
              <Aviso tono="info">{t('spaceeyes.pconfig.primera-vuelta')}</Aviso>
            )}
            {ultimo?.camara_permitida === false && (
              <Aviso tono="falla">
                {t('spaceeyes.pconfig.camara-bloqueada')}
              </Aviso>
            )}
            {quietas && (
              <Aviso tono="alerta">
                {interpolarNodos(t('spaceeyes.pconfig.quietos'), {
                  lista: <span className="font-medium tabular-nums">{quietas}</span>,
                })}
              </Aviso>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={t('spaceeyes.pconfig.confirmar.titulo')}
        confirmLabel={t('spaceeyes.pconfig.confirmar.boton')}
        busy={guardandoPant}
        onConfirm={() => void guardarPantalla()}
      >
        {t('spaceeyes.pconfig.confirmar.texto')}
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
function ultimaRevision(u: Ultimo | null, idioma: Idioma): string {
  const tr = (clave: ClaveTexto, valores?: Record<string, string | number>) => traducir(idioma, clave, valores)
  if (!u) return tr('spaceeyes.pconfig.revision.ninguna')
  const cuando = fechaHora(u.ts || u.recibido || null, idioma)
  const estados: Record<string, ClaveTexto> = {
    OK: 'spaceeyes.pconfig.revision.ok',
    APAGADA: 'spaceeyes.pconfig.revision.apagada',
    CONGELADA: 'spaceeyes.pconfig.revision.congelada',
    INCONCLUSO: 'spaceeyes.pconfig.revision.inconcluso',
  }
  const pantalla = (u.pantalla && estados[u.pantalla] && tr(estados[u.pantalla])) || u.pantalla || tr('spaceeyes.comun.sin-dato')
  const camaras: Record<string, ClaveTexto> = {
    MOVIDA: 'spaceeyes.pconfig.revision.movida',
    SIN_IMAGEN: 'spaceeyes.pconfig.revision.sin-imagen',
  }
  const camara = camaras[u.camara ?? ''] ? tr(camaras[u.camara ?? '']) : ''
  // Si alguien abrió la vista en vivo o pidió una foto a mitad de la vuelta,
  // solo se juzgó con el tramo más largo: se dice, para que no sorprenda.
  const corte =
    u.interrumpida && u.vistazos_usados != null
      ? tr('spaceeyes.pconfig.revision.corte', { usados: u.vistazos_usados, total: String(u.vistazos) })
      : ''
  const n = u.vistazos ?? 0
  const c = u.cambios ?? 0
  return tr('spaceeyes.pconfig.revision', {
    cuando,
    pantalla,
    camara,
    vistazos: tr(n === 1 ? 'spaceeyes.pconfig.vistazos.uno' : 'spaceeyes.pconfig.vistazos.otros', { n }),
    cambios: tr(c === 1 ? 'spaceeyes.pconfig.cambios.uno' : 'spaceeyes.pconfig.cambios.otros', { n: c }),
    corte,
  })
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
