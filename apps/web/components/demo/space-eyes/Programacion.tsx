'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { InlinePanel } from '@/components/demo/ui/InlinePanel'
import { ErrorSE, seApi, textoDeError } from '@/lib/data/space-eyes-se'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { formatFecha } from '@/lib/data/derive'
import { localeDe } from '@/lib/i18n/formato-idioma'
import { cifra, fijo } from './piezas'

// ============================================================================
//  Space Eyes — programación de fotos.
//
//  Port de scheduler.html/scheduler.js de Space Eye. Las fotos se toman solas,
//  a una hora impredecible dentro de las franjas que se definan. Todo lo que
//  aquí se escribe pasa por la puerta /api/space-eyes/se/schedules.
//
//  Un Space Eye en modo espejo contesta 409 `espejo_solo_lectura` a cualquier
//  escritura: el mensaje que manda se le enseña tal cual al usuario.
// ============================================================================

// Lo que pesa una foto en promedio, para estimar el consumo antes de crear la
// programación. Medido sobre las 91 fotos que ya subieron los equipos: 1.52 MB
// de promedio, 3.7 MB la más pesada.
const MB_POR_FOTO = 1.5

type Frecuencia = 'random_windows' | 'specific_times' | 'interval' | 'cron'
type Destino = 'todos' | 'device' | 'campaign'
type Ventana = { ini: string; fin: string }

type Programa = {
  id: number
  name: string
  device_id: number | null
  group_id: number | null
  campaign_id: number | null
  device_name?: string | null
  group_name?: string | null
  campaign_name?: string | null
  frequency_type: Frecuencia
  interval_minutes: number | null
  cron_expression: string | null
  specific_times: string[] | string | null
  windows: Ventana[] | string | null
  valid_from: string | null
  valid_until: string | null
  next_fire_at: string | null
  active: boolean | number
  fotos?: number
  fotos_semana?: number
}

type Equipo = { id: number; name: string; billboard_code?: string | null }
type Campana = { id: number; name: string; device_count?: number | null }

type Formulario = {
  id: number | null
  name: string
  destino: Destino
  device_id: number | null
  campaign_id: number | null
  frequency_type: Frecuencia
  interval_minutes: number
  specific_times: string[]
  windows: Ventana[]
  valid_from: string
  valid_until: string
}

function formVacio(): Formulario {
  return {
    id: null,
    name: '',
    destino: 'todos',
    device_id: null,
    campaign_id: null,
    frequency_type: 'random_windows',
    interval_minutes: 60,
    specific_times: ['12:00'],
    windows: [
      { ini: '08:00', fin: '10:00' },
      { ini: '13:00', fin: '15:00' },
      { ini: '18:00', fin: '20:00' },
    ],
    valid_from: '',
    valid_until: '',
  }
}

/** Los campos JSON pueden llegar como texto o ya parseados. */
function comoLista<T>(valor: unknown, porDefecto: T[]): T[] {
  if (!valor) return porDefecto
  if (Array.isArray(valor)) return valor.length ? (valor as T[]) : porDefecto
  try {
    const p = JSON.parse(String(valor))
    return Array.isArray(p) && p.length ? p : porDefecto
  } catch {
    return porDefecto
  }
}

/** Los DATE llegan como ISO completo y el <input type="date"> solo acepta YYYY-MM-DD. */
function soloFechaInput(v: string | null): string {
  return v ? String(v).slice(0, 10) : ''
}

const TEXTOS_ERROR: Record<string, ClaveTexto> = {
  faltan_franjas: 'spaceeyes.prog.error.franjas',
  faltan_horas: 'spaceeyes.prog.error.horas',
  falta_intervalo: 'spaceeyes.prog.error.intervalo',
  falta_cron: 'spaceeyes.prog.error.cron',
  invalid_input: 'spaceeyes.comun.dato-invalido',
}

function mensajeDeError(e: unknown, porDefecto: string, idioma: Idioma): string {
  if (e instanceof ErrorSE) {
    const clave = (e.cuerpo as { error?: string } | null)?.error
    if (clave === 'espejo_solo_lectura') return e.message
    if (clave && TEXTOS_ERROR[clave]) return traducir(idioma, TEXTOS_ERROR[clave])
    return textoDeError(e, idioma) || porDefecto
  }
  return e instanceof Error ? e.message : porDefecto
}

// ─── Textos de la tabla ─────────────────────────────────────────────────────

function destinoTexto(s: Programa, idioma: Idioma): string {
  if (s.device_name) return s.device_name
  if (s.campaign_name) return traducir(idioma, 'spaceeyes.prog.destino.campana', { nombre: s.campaign_name })
  if (s.group_name) return traducir(idioma, 'spaceeyes.prog.destino.grupo', { nombre: s.group_name })
  return traducir(idioma, 'spaceeyes.comun.todos-equipos')
}

function cuandoTexto(s: Programa, idioma: Idioma): string {
  if (s.frequency_type === 'random_windows') {
    const v = comoLista<Ventana>(s.windows, [])
    if (!v.length) return traducir(idioma, 'spaceeyes.prog.sin-franjas')
    return traducir(idioma, 'spaceeyes.prog.al-azar', { lista: v.map((x) => `${x.ini}-${x.fin}`).join(', ') })
  }
  if (s.frequency_type === 'specific_times') return comoLista<string>(s.specific_times, []).join(', ')
  if (s.frequency_type === 'interval') {
    const m = s.interval_minutes ?? 0
    return m >= 60 && m % 60 === 0
      ? traducir(idioma, 'spaceeyes.prog.cada-h', { n: m / 60 })
      : traducir(idioma, 'spaceeyes.frecuencia.otra', { n: m })
  }
  return s.cron_expression || s.frequency_type
}

// ─── Estado REAL de una programación ────────────────────────────────────────
//
// El estado mira `active` Y la vigencia. Una programación con `valid_from` en
// el futuro no toma ninguna foto: el worker la excluye por fecha
// (`valid_from <= CURDATE()`). Se compara contra la fecha UTC a propósito: es
// la que usa CURDATE() en el servidor.

function fechaIso(v: string | null): string | null {
  if (!v) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  if (m) return m[1]
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso: string, idioma: Idioma): string {
  // En ingles, el formato del resto de la aplicacion («Dec 1, 2026»).
  if (idioma !== 'es') return formatFecha(iso, idioma)
  const [a, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] || m} ${a}`
}

/** null si dispara hoy; el motivo por el que no, si no. */
function fueraDeVigencia(s: Programa): { tipo: 'espera' | 'vencida'; fecha: string } | null {
  const hoy = new Date().toISOString().slice(0, 10)
  const desde = fechaIso(s.valid_from)
  const hasta = fechaIso(s.valid_until)
  if (desde && desde > hoy) return { tipo: 'espera', fecha: desde }
  if (hasta && hasta < hoy) return { tipo: 'vencida', fecha: hasta }
  return null
}

function estado(s: Programa, idioma: Idioma): { texto: string; clase: string } {
  if (!s.active) return { texto: traducir(idioma, 'spaceeyes.prog.estado.pausada'), clase: 'border-border bg-surface-2 text-muted' }
  const f = fueraDeVigencia(s)
  if (f?.tipo === 'espera') {
    return {
      texto: traducir(idioma, 'spaceeyes.prog.estado.empieza', { fecha: fechaCorta(f.fecha, idioma) }),
      clase: 'border-warning bg-warning-soft text-ink',
    }
  }
  if (f?.tipo === 'vencida') {
    return {
      texto: traducir(idioma, 'spaceeyes.prog.estado.vencio', { fecha: fechaCorta(f.fecha, idioma) }),
      clase: 'border-[#dc262640] bg-error-soft text-[#b91c1c]',
    }
  }
  return { texto: traducir(idioma, 'spaceeyes.comun.activa'), clase: 'border-[#1da85040] bg-success-soft text-[#146c39]' }
}

function proximaTexto(s: Programa, idioma: Idioma): string {
  if (!s.active) return '—'
  // Fuera de vigencia el worker no la mira, así que next_fire_at se queda
  // clavado en el pasado. Decir "en cola" ahí se leería como "está por
  // dispararse".
  const f = fueraDeVigencia(s)
  if (f?.tipo === 'espera') return traducir(idioma, 'spaceeyes.prog.proxima.espera', { fecha: fechaCorta(f.fecha, idioma) })
  if (f?.tipo === 'vencida') return traducir(idioma, 'spaceeyes.prog.proxima.vencida')
  if (!s.next_fire_at) return traducir(idioma, 'spaceeyes.prog.proxima.sin-calcular')
  const d = new Date(s.next_fire_at)
  const faltan = d.getTime() - Date.now()
  // En ingles, como el resto de la aplicacion: «Nov 2, 11:30 AM» (dia sin
  // cero y reloj de 12 h). El español es el de siempre.
  const fecha =
    idioma !== 'es'
      ? new Intl.DateTimeFormat(localeDe(idioma), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d)
      : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  if (faltan < 0) return traducir(idioma, 'spaceeyes.prog.proxima.cola', { fecha })
  const horas = Math.floor(faltan / 3_600_000)
  if (horas < 1) return traducir(idioma, 'spaceeyes.prog.proxima.min', { fecha, n: Math.max(1, Math.round(faltan / 60_000)) })
  if (horas < 24) return traducir(idioma, 'spaceeyes.prog.proxima.h', { fecha, n: horas })
  return fecha
}

// ─── Estimación de consumo ──────────────────────────────────────────────────
// El costo de datos móviles es la razón por la que esto se configura con
// cuidado, así que se muestra ANTES de guardar, no después de la factura.

function fotosPorDia(f: Formulario): number {
  if (f.frequency_type === 'random_windows') return f.windows.length
  if (f.frequency_type === 'specific_times') return f.specific_times.filter(Boolean).length
  if (f.frequency_type === 'interval') return f.interval_minutes > 0 ? 1440 / f.interval_minutes : 0
  return 0
}

function fotosPorDiaTexto(f: Formulario, idioma: Idioma): string {
  const n = fotosPorDia(f)
  if (!n) return traducir(idioma, 'spaceeyes.prog.sin-fotos')
  const r = Math.round(n * 10) / 10
  return traducir(idioma, r === 1 ? 'spaceeyes.prog.fotos-dia.uno' : 'spaceeyes.prog.fotos-dia.otros', { n: cifra(r, idioma) })
}

function consumoMesTexto(f: Formulario, idioma: Idioma): string {
  const mb = fotosPorDia(f) * 30 * MB_POR_FOTO
  if (!mb) return '—'
  return mb >= 1024
    ? traducir(idioma, 'spaceeyes.prog.gb-mes', { n: fijo(mb / 1024, 1, idioma) })
    : traducir(idioma, 'spaceeyes.prog.mb-mes', { n: Math.round(mb) })
}

// ─── Estilos compartidos de los campos ──────────────────────────────────────
const CAMPO =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent'
const CAMPO_HORA =
  'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
const ETIQUETA = 'mb-1 block text-[12px] font-medium text-ink'

export function Programacion() {
  const { t, idioma } = useIdioma()
  const [programas, setProgramas] = useState<Programa[] | null>(null)
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Formulario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState<Programa | null>(null)
  const [borrando, setBorrando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const d = await seApi<{ schedules: Programa[] }>('schedules')
      setProgramas(d.schedules ?? [])
    } catch (e) {
      setError(mensajeDeError(e, t('spaceeyes.prog.error.cargar'), idioma))
    }
    setCargando(false)
  }, [t, idioma])

  // Si falla un catálogo, el formulario sigue sirviendo para el resto.
  const cargarCatalogos = useCallback(async () => {
    try {
      setEquipos((await seApi<{ devices: Equipo[] }>('devices')).devices ?? [])
    } catch {
      setEquipos([])
    }
    try {
      setCampanas((await seApi<{ campaigns: Campana[] }>('campaigns')).campaigns ?? [])
    } catch {
      setCampanas([])
    }
  }, [])

  useEffect(() => {
    void cargar()
    void cargarCatalogos()
  }, [cargar, cargarCatalogos])

  const cambiar = (parche: Partial<Formulario>) => setForm((f) => (f ? { ...f, ...parche } : f))

  const editar = (s: Programa) => {
    setForm({
      id: s.id,
      name: s.name || '',
      destino: s.device_id ? 'device' : s.campaign_id ? 'campaign' : 'todos',
      device_id: s.device_id || null,
      campaign_id: s.campaign_id || null,
      frequency_type: s.frequency_type || 'random_windows',
      interval_minutes: s.interval_minutes || 60,
      specific_times: comoLista<string>(s.specific_times, ['12:00']),
      windows: comoLista<Ventana>(s.windows, [{ ini: '08:00', fin: '10:00' }]),
      valid_from: soloFechaInput(s.valid_from),
      valid_until: soloFechaInput(s.valid_until),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const guardar = async () => {
    if (!form) return
    const f = form
    if (!f.name.trim()) return void toast.error(t('spaceeyes.prog.toast.nombre'))
    if (f.destino === 'device' && !f.device_id) return void toast.error(t('spaceeyes.prog.toast.equipo'))
    if (f.destino === 'campaign' && !f.campaign_id) return void toast.error(t('spaceeyes.prog.toast.campana'))
    if (f.frequency_type === 'random_windows') {
      if (!f.windows.length) return void toast.error(t('spaceeyes.prog.toast.franja'))
      if (f.windows.some((v) => !v.ini || !v.fin || v.ini === v.fin)) {
        return void toast.error(t('spaceeyes.prog.toast.franja-mal'))
      }
    }
    if (f.frequency_type === 'specific_times' && !f.specific_times.filter(Boolean).length) {
      return void toast.error(t('spaceeyes.prog.error.horas'))
    }
    if (f.frequency_type === 'interval' && (!f.interval_minutes || f.interval_minutes < 5)) {
      return void toast.error(t('spaceeyes.prog.toast.intervalo'))
    }

    const cuerpo: Record<string, unknown> = {
      name: f.name.trim(),
      frequency_type: f.frequency_type,
      device_id: f.destino === 'device' ? f.device_id : null,
      campaign_id: f.destino === 'campaign' ? f.campaign_id : null,
      group_id: null,
      valid_from: f.valid_from || null,
      valid_until: f.valid_until || null,
    }
    if (f.frequency_type === 'random_windows') cuerpo.windows = f.windows
    if (f.frequency_type === 'specific_times') cuerpo.specific_times = f.specific_times.filter(Boolean)
    if (f.frequency_type === 'interval') cuerpo.interval_minutes = f.interval_minutes

    setGuardando(true)
    try {
      if (f.id) {
        await seApi(`schedules/${f.id}`, { method: 'PUT', body: cuerpo })
        toast.success(t('spaceeyes.prog.toast.actualizada'))
      } else {
        await seApi('schedules', { method: 'POST', body: cuerpo })
        toast.success(t('spaceeyes.prog.toast.creada'))
      }
      setForm(null)
      await cargar()
    } catch (e) {
      toast.error(mensajeDeError(e, t('spaceeyes.prog.toast.no-guardar'), idioma))
    } finally {
      setGuardando(false)
    }
  }

  const alternar = async (s: Programa) => {
    try {
      await seApi(`schedules/${s.id}`, { method: 'PUT', body: { active: !s.active } })
      toast.success(s.active ? t('spaceeyes.prog.toast.pausada') : t('spaceeyes.prog.toast.activada'))
      await cargar()
    } catch (e) {
      toast.error(mensajeDeError(e, t('spaceeyes.prog.toast.no-estado'), idioma))
    }
  }

  const eliminar = async () => {
    if (!aBorrar) return
    setBorrando(true)
    try {
      await seApi(`schedules/${aBorrar.id}`, { method: 'DELETE' })
      toast.success(t('spaceeyes.prog.toast.eliminada'))
      setABorrar(null)
      await cargar()
    } catch (e) {
      toast.error(mensajeDeError(e, t('spaceeyes.prog.toast.no-eliminar'), idioma))
    } finally {
      setBorrando(false)
    }
  }

  const lista = programas ?? []

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-lg font-semibold text-ink">{t('spaceeyes.prog.titulo')}</h1>
          <p className="text-[13px] text-muted">{t('spaceeyes.prog.descripcion')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            {t('spaceeyes.comun.actualizar')}
          </Button>
          <Button variant="success" size="sm" onClick={() => setForm(formVacio())}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('spaceeyes.prog.nueva')}
          </Button>
        </div>
      </div>

      {form && (
        <FormularioProgramacion
          form={form}
          cambiar={cambiar}
          equipos={equipos}
          campanas={campanas}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={() => setForm(null)}
        />
      )}

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">{t('spaceeyes.prog.error.cargar')}</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : cargando && !programas ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : lista.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-6 py-12 text-center">
          <p className="text-[13px] text-ink">{t('spaceeyes.prog.vacio')}</p>
          <p className="mt-1 text-[13px] text-muted">{t('spaceeyes.prog.vacio.texto')}</p>
        </div>
      ) : (
        <>
        {/* Hasta 1280 px, tarjetas: la tabla mide 820 y quedaba cortada. */}
        <ul className="divide-y divide-border rounded-md border border-border bg-surface xl:hidden">
          {lista.map((s) => {
            const est = estado(s, idioma)
            const sinFotosSemana = !!s.active && !fueraDeVigencia(s) && !(Number(s.fotos_semana) > 0)
            return (
              <li key={s.id} className={cn('space-y-1.5 p-3 text-[13px]', !s.active && 'opacity-60')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className={cn('whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', est.clase)}>
                    {est.texto}
                  </span>
                </div>
                <div className="text-[12px] text-muted">
                  {destinoTexto(s, idioma)} · {cuandoTexto(s, idioma)}
                </div>
                <div className="text-[12px] text-ink">
                  {interpolarNodos(t((s.fotos || 0) === 1 ? 'spaceeyes.prog.linea.uno' : 'spaceeyes.prog.linea.otros'), {
                    proxima: proximaTexto(s, idioma),
                    n: <span className="demo-num">{s.fotos || 0}</span>,
                    semana: (
                      <span className={cn('whitespace-nowrap', sinFotosSemana ? 'font-medium text-error' : 'text-muted')}>
                        {t('spaceeyes.prog.semana', { n: s.fotos_semana || 0 })}
                      </span>
                    ),
                  })}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => editar(s)}>
                    {t('spaceeyes.comun.editar')}
                  </Button>
                  <Button size="sm" variant="tertiary" onClick={() => alternar(s)}>
                    {s.active ? t('spaceeyes.prog.pausar') : t('spaceeyes.prog.activar')}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setABorrar(s)}>
                    {t('spaceeyes.comun.eliminar')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-md border border-border bg-surface xl:block">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="border-b border-border bg-surface-2 text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t('spaceeyes.comun.nombre')}</th>
                <th className="px-4 py-2.5 font-medium">{t('spaceeyes.prog.aplica-a')}</th>
                <th className="px-4 py-2.5 font-medium">{t('spaceeyes.prog.cuando')}</th>
                <th className="px-4 py-2.5 font-medium">{t('spaceeyes.prog.proxima-foto')}</th>
                <th className="px-4 py-2.5 font-medium">{t('spaceeyes.ficha.tab.fotos')}</th>
                <th className="px-4 py-2.5 font-medium">{t('spaceeyes.comun.estado')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('spaceeyes.prog.acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => {
                const est = estado(s, idioma)
                // Se muestra SIEMPRE, también en cero: el número que delata el
                // problema no puede desaparecer justo cuando hay problema. En
                // rojo cuando debería estar disparando y no tomó ninguna en 7 días.
                const sinFotosSemana = !!s.active && !fueraDeVigencia(s) && !(Number(s.fotos_semana) > 0)
                return (
                  <tr key={s.id} className={cn('border-b border-border last:border-0', !s.active && 'opacity-60')}>
                    <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-4 py-3 text-muted">{destinoTexto(s, idioma)}</td>
                    <td className="px-4 py-3 text-muted">{cuandoTexto(s, idioma)}</td>
                    <td className="px-4 py-3 text-ink">{proximaTexto(s, idioma)}</td>
                    <td className="px-4 py-3 text-ink">
                      <span className="demo-num">{s.fotos || 0}</span>{' '}
                      <span className={cn('whitespace-nowrap text-[12px]', sinFotosSemana ? 'font-medium text-error' : 'text-muted')}>
                        {t('spaceeyes.prog.semana', { n: s.fotos_semana || 0 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', est.clase)}>
                        {est.texto}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => editar(s)}>
                          {t('spaceeyes.comun.editar')}
                        </Button>
                        <Button size="sm" variant="tertiary" onClick={() => alternar(s)}>
                          {s.active ? t('spaceeyes.prog.pausar') : t('spaceeyes.prog.activar')}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setABorrar(s)}>
                          {t('spaceeyes.comun.eliminar')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <ConfirmDialog
        open={!!aBorrar}
        onOpenChange={(v) => !v && setABorrar(null)}
        title={t('spaceeyes.prog.eliminar')}
        confirmLabel={t('spaceeyes.comun.eliminar')}
        busy={borrando}
        confirmarEscribiendo={t('spaceeyes.prog.eliminar.palabra')}
        onConfirm={() => void eliminar()}
      >
        <p className="text-ink">{t('spaceeyes.prog.eliminar.pregunta', { nombre: aBorrar?.name ?? '' })}</p>
        <p className="mt-1">{t('spaceeyes.prog.eliminar.texto')}</p>
      </ConfirmDialog>
    </div>
  )
}

// ─── Formulario ─────────────────────────────────────────────────────────────

function FormularioProgramacion({
  form: f,
  cambiar,
  equipos,
  campanas,
  guardando,
  onGuardar,
  onCancelar,
}: {
  form: Formulario
  cambiar: (p: Partial<Formulario>) => void
  equipos: Equipo[]
  campanas: Campana[]
  guardando: boolean
  onGuardar: () => Promise<void>
  onCancelar: () => void
}) {
  const { t, idioma } = useIdioma()
  const destinos: [Destino, ClaveTexto][] = [
    ['todos', 'spaceeyes.comun.todos-equipos'],
    ['device', 'spaceeyes.prog.destino.un-equipo'],
    ['campaign', 'spaceeyes.prog.destino.una-campana'],
  ]

  return (
    <InlinePanel
      title={f.id ? t('spaceeyes.prog.editar') : t('spaceeyes.prog.nueva')}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancelar} disabled={guardando}>
            {t('comun.cancelar')}
          </Button>
          <Button size="sm" variant="primary" onClick={onGuardar} disabled={guardando}>
            {guardando
              ? t('spaceeyes.comun.guardando')
              : f.id
                ? t('spaceeyes.comun.guardar-cambios')
                : t('spaceeyes.prog.crear')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna izquierda: qué y a quién */}
        <div className="space-y-4">
          <div>
            <label className={ETIQUETA} htmlFor="prog-nombre">
              {t('spaceeyes.comun.nombre')}
            </label>
            <input
              id="prog-nombre"
              value={f.name}
              onChange={(e) => cambiar({ name: e.target.value })}
              placeholder={t('spaceeyes.prog.nombre-ej')}
              className={CAMPO}
            />
          </div>

          <div>
            <span className={ETIQUETA}>{t('spaceeyes.prog.aplicar-a')}</span>
            <div className="mb-2 inline-flex flex-wrap rounded-md border border-border bg-surface p-0.5 text-[13px]">
              {destinos.map(([clave, texto]) => (
                <button
                  key={clave}
                  type="button"
                  onClick={() => cambiar({ destino: clave, device_id: null, campaign_id: null })}
                  className={cn(
                    'rounded px-3 py-1.5 transition-colors duration-150',
                    f.destino === clave ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {t(texto)}
                </button>
              ))}
            </div>

            {f.destino === 'todos' && (
              <p className="text-[12px] text-muted">
                {t(equipos.length === 1 ? 'spaceeyes.prog.todos.texto.uno' : 'spaceeyes.prog.todos.texto.otros', {
                  n: formatNumero(equipos.length, 0, idioma),
                })}
              </p>
            )}
            {f.destino === 'device' && (
              <select
                aria-label={t('spaceeyes.comun.equipo')}
                value={f.device_id ?? ''}
                onChange={(e) => cambiar({ device_id: e.target.value ? Number(e.target.value) : null })}
                className={CAMPO}
              >
                <option value="">{t('spaceeyes.prog.elegir-equipo')}</option>
                {equipos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name + (d.billboard_code ? ` (${d.billboard_code})` : '')}
                  </option>
                ))}
              </select>
            )}
            {f.destino === 'campaign' && (
              <select
                aria-label={t('spaceeyes.prog.campana')}
                value={f.campaign_id ?? ''}
                onChange={(e) => cambiar({ campaign_id: e.target.value ? Number(e.target.value) : null })}
                className={CAMPO}
              >
                <option value="">{t('spaceeyes.prog.elegir-campana')}</option>
                {campanas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t((c.device_count || 0) === 1 ? 'spaceeyes.prog.campana-equipos.uno' : 'spaceeyes.prog.campana-equipos.otros', {
                      nombre: c.name,
                      n: c.device_count || 0,
                    })}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ETIQUETA} htmlFor="prog-desde">
                {t('spaceeyes.comun.desde')} <span className="font-normal text-muted">{t('spaceeyes.comun.opcional')}</span>
              </label>
              <input
                id="prog-desde"
                type="date"
                value={f.valid_from}
                onChange={(e) => cambiar({ valid_from: e.target.value })}
                className={CAMPO}
              />
            </div>
            <div>
              <label className={ETIQUETA} htmlFor="prog-hasta">
                {t('spaceeyes.comun.hasta')} <span className="font-normal text-muted">{t('spaceeyes.comun.opcional')}</span>
              </label>
              <input
                id="prog-hasta"
                type="date"
                value={f.valid_until}
                onChange={(e) => cambiar({ valid_until: e.target.value })}
                className={CAMPO}
              />
            </div>
          </div>
        </div>

        {/* Columna derecha: cuándo */}
        <div className="space-y-4">
          <div>
            <label className={ETIQUETA} htmlFor="prog-cuando">
              {t('spaceeyes.prog.cuando')}
            </label>
            <select
              id="prog-cuando"
              value={f.frequency_type}
              onChange={(e) => cambiar({ frequency_type: e.target.value as Frecuencia })}
              className={CAMPO}
            >
              <option value="random_windows">{t('spaceeyes.prog.tipo.franjas')}</option>
              <option value="specific_times">{t('spaceeyes.prog.tipo.horas')}</option>
              <option value="interval">{t('spaceeyes.prog.tipo.intervalo')}</option>
              {f.frequency_type === 'cron' && <option value="cron">{t('spaceeyes.prog.tipo.cron')}</option>}
            </select>
          </div>

          {f.frequency_type === 'random_windows' && (
            <div className="space-y-3">
              <div className="rounded-md border border-accent bg-accent-soft p-3 text-[12px] text-ink">
                {t('spaceeyes.prog.franjas.texto')}
              </div>
              {f.windows.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-[12px] text-muted">{t('spaceeyes.prog.franja', { n: i + 1 })}</span>
                  <input
                    type="time"
                    aria-label={t('spaceeyes.prog.franja.inicio', { n: i + 1 })}
                    value={v.ini}
                    onChange={(e) =>
                      cambiar({ windows: f.windows.map((w, j) => (j === i ? { ...w, ini: e.target.value } : w)) })
                    }
                    className={CAMPO_HORA}
                  />
                  <span className="text-[13px] text-muted">{t('spaceeyes.pconfig.editor.a')}</span>
                  <input
                    type="time"
                    aria-label={t('spaceeyes.prog.franja.fin', { n: i + 1 })}
                    value={v.fin}
                    onChange={(e) =>
                      cambiar({ windows: f.windows.map((w, j) => (j === i ? { ...w, fin: e.target.value } : w)) })
                    }
                    className={CAMPO_HORA}
                  />
                  <Button
                    size="sm"
                    variant="icon"
                    aria-label={t('spaceeyes.prog.franja.quitar', { n: i + 1 })}
                    title={t('spaceeyes.prog.quitar')}
                    onClick={() => cambiar({ windows: f.windows.filter((_, j) => j !== i) })}
                    className="text-error hover:bg-error-soft hover:text-error"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="tertiary"
                onClick={() => cambiar({ windows: [...f.windows, { ini: '12:00', fin: '14:00' }] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('spaceeyes.prog.franja.agregar')}
              </Button>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[12px] text-muted">{t('spaceeyes.prog.rapido')}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    cambiar({
                      windows: [
                        { ini: '08:00', fin: '10:00' },
                        { ini: '13:00', fin: '15:00' },
                        { ini: '18:00', fin: '20:00' },
                      ],
                    })
                  }
                >
                  {t('spaceeyes.prog.rapido.tres')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => cambiar({ windows: [{ ini: '07:00', fin: '21:00' }] })}>
                  {t('spaceeyes.prog.rapido.una')}
                </Button>
              </div>
            </div>
          )}

          {f.frequency_type === 'specific_times' && (
            <div className="space-y-3">
              <div className="rounded-md border border-warning bg-warning-soft p-3 text-[12px] text-ink">
                {t('spaceeyes.prog.horas.texto')}
              </div>
              {f.specific_times.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={t('spaceeyes.prog.hora', { n: i + 1 })}
                    value={h}
                    onChange={(e) =>
                      cambiar({ specific_times: f.specific_times.map((x, j) => (j === i ? e.target.value : x)) })
                    }
                    className={CAMPO_HORA}
                  />
                  <Button
                    size="sm"
                    variant="icon"
                    aria-label={t('spaceeyes.prog.hora.quitar', { n: i + 1 })}
                    title={t('spaceeyes.prog.quitar')}
                    onClick={() => cambiar({ specific_times: f.specific_times.filter((_, j) => j !== i) })}
                    className="text-error hover:bg-error-soft hover:text-error"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="tertiary" onClick={() => cambiar({ specific_times: [...f.specific_times, '12:00'] })}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('spaceeyes.prog.hora.agregar')}
              </Button>
            </div>
          )}

          {f.frequency_type === 'interval' && (
            <div className="space-y-3">
              <div>
                <label className={ETIQUETA} htmlFor="prog-intervalo">
                  {t('spaceeyes.prog.intervalo')}
                </label>
                <input
                  id="prog-intervalo"
                  type="number"
                  min={5}
                  value={Number.isFinite(f.interval_minutes) ? f.interval_minutes : ''}
                  onChange={(e) => cambiar({ interval_minutes: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className={CAMPO}
                />
              </div>
              <div className="rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px] text-ink">
                {interpolarNodos(t('spaceeyes.prog.intervalo.ojo'), { fotos: <strong>{fotosPorDiaTexto(f, idioma)}</strong> })}
              </div>
            </div>
          )}

          {/* Costo estimado */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-1 text-[12px] text-muted">{t('spaceeyes.prog.consumo')}</div>
            <div className="text-[13px] text-ink">
              {fotosPorDiaTexto(f, idioma)}
              <span className="text-muted"> · </span>
              <span className="font-medium">{consumoMesTexto(f, idioma)}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted">{t('spaceeyes.prog.consumo.texto')}</div>
          </div>
        </div>
      </div>
    </InlinePanel>
  )
}
