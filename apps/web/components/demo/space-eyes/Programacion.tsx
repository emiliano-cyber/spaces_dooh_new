'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { InlinePanel } from '@/components/demo/ui/InlinePanel'
import { ErrorSE, seApi } from '@/lib/data/space-eyes-se'

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

const TEXTOS_ERROR: Record<string, string> = {
  faltan_franjas: 'Revisa las franjas: alguna tiene una hora inválida',
  faltan_horas: 'Agrega al menos una hora',
  falta_intervalo: 'Falta el intervalo en minutos',
  falta_cron: 'Falta la expresión de programación',
  invalid_input: 'Hay un dato inválido en el formulario',
}

function mensajeDeError(e: unknown, porDefecto: string): string {
  if (e instanceof ErrorSE) {
    const clave = (e.cuerpo as { error?: string } | null)?.error
    if (clave === 'espejo_solo_lectura') return e.message
    if (clave && TEXTOS_ERROR[clave]) return TEXTOS_ERROR[clave]
    return e.message || porDefecto
  }
  return e instanceof Error ? e.message : porDefecto
}

// ─── Textos de la tabla ─────────────────────────────────────────────────────

function destinoTexto(s: Programa): string {
  if (s.device_name) return s.device_name
  if (s.campaign_name) return `Campaña: ${s.campaign_name}`
  if (s.group_name) return `Grupo: ${s.group_name}`
  return 'Todos los equipos'
}

function cuandoTexto(s: Programa): string {
  if (s.frequency_type === 'random_windows') {
    const v = comoLista<Ventana>(s.windows, [])
    if (!v.length) return 'Sin franjas'
    return v.map((x) => `${x.ini}-${x.fin}`).join(', ') + ' (al azar)'
  }
  if (s.frequency_type === 'specific_times') return comoLista<string>(s.specific_times, []).join(', ')
  if (s.frequency_type === 'interval') {
    const m = s.interval_minutes ?? 0
    return m >= 60 && m % 60 === 0 ? `Cada ${m / 60} h` : `Cada ${m} min`
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
function fechaCorta(iso: string): string {
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

function estado(s: Programa): { texto: string; clase: string } {
  if (!s.active) return { texto: 'Pausada', clase: 'border-border bg-surface-2 text-muted' }
  const f = fueraDeVigencia(s)
  if (f?.tipo === 'espera') {
    return { texto: `Empieza el ${fechaCorta(f.fecha)}`, clase: 'border-warning bg-warning-soft text-ink' }
  }
  if (f?.tipo === 'vencida') {
    return { texto: `Venció el ${fechaCorta(f.fecha)}`, clase: 'border-[#dc262640] bg-error-soft text-[#b91c1c]' }
  }
  return { texto: 'Activa', clase: 'border-[#1da85040] bg-success-soft text-[#146c39]' }
}

function proximaTexto(s: Programa): string {
  if (!s.active) return '—'
  // Fuera de vigencia el worker no la mira, así que next_fire_at se queda
  // clavado en el pasado. Decir "en cola" ahí se leería como "está por
  // dispararse".
  const f = fueraDeVigencia(s)
  if (f?.tipo === 'espera') return `No dispara hasta el ${fechaCorta(f.fecha)}`
  if (f?.tipo === 'vencida') return 'No dispara: vencida'
  if (!s.next_fire_at) return 'Sin calcular'
  const d = new Date(s.next_fire_at)
  const faltan = d.getTime() - Date.now()
  const fecha = d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  if (faltan < 0) return `${fecha} (en cola)`
  const horas = Math.floor(faltan / 3_600_000)
  if (horas < 1) return `${fecha} (en ${Math.max(1, Math.round(faltan / 60_000))} min)`
  if (horas < 24) return `${fecha} (en ${horas} h)`
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

function fotosPorDiaTexto(f: Formulario): string {
  const n = fotosPorDia(f)
  if (!n) return 'sin fotos'
  const r = Math.round(n * 10) / 10
  return `${r} ${r === 1 ? 'foto' : 'fotos'} al día`
}

function consumoMesTexto(f: Formulario): string {
  const mb = fotosPorDia(f) * 30 * MB_POR_FOTO
  if (!mb) return '—'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB al mes` : `${Math.round(mb)} MB al mes`
}

// ─── Estilos compartidos de los campos ──────────────────────────────────────
const CAMPO =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent'
const CAMPO_HORA =
  'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
const ETIQUETA = 'mb-1 block text-[12px] font-medium text-ink'

export function Programacion() {
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
      setError(mensajeDeError(e, 'No se pudieron cargar las programaciones'))
    }
    setCargando(false)
  }, [])

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
    if (!f.name.trim()) return void toast.error('Ponle un nombre a la programación')
    if (f.destino === 'device' && !f.device_id) return void toast.error('Elige el equipo')
    if (f.destino === 'campaign' && !f.campaign_id) return void toast.error('Elige la campaña')
    if (f.frequency_type === 'random_windows') {
      if (!f.windows.length) return void toast.error('Agrega al menos una franja de horario')
      if (f.windows.some((v) => !v.ini || !v.fin || v.ini === v.fin)) {
        return void toast.error('Hay una franja sin horas o con la misma hora de inicio y fin')
      }
    }
    if (f.frequency_type === 'specific_times' && !f.specific_times.filter(Boolean).length) {
      return void toast.error('Agrega al menos una hora')
    }
    if (f.frequency_type === 'interval' && (!f.interval_minutes || f.interval_minutes < 5)) {
      return void toast.error('El intervalo mínimo es de 5 minutos')
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
        toast.success('Programación actualizada')
      } else {
        await seApi('schedules', { method: 'POST', body: cuerpo })
        toast.success('Programación creada')
      }
      setForm(null)
      await cargar()
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo guardar la programación'))
    } finally {
      setGuardando(false)
    }
  }

  const alternar = async (s: Programa) => {
    try {
      await seApi(`schedules/${s.id}`, { method: 'PUT', body: { active: !s.active } })
      toast.success(s.active ? 'Programación pausada' : 'Programación activada')
      await cargar()
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo cambiar el estado'))
    }
  }

  const eliminar = async () => {
    if (!aBorrar) return
    setBorrando(true)
    try {
      await seApi(`schedules/${aBorrar.id}`, { method: 'DELETE' })
      toast.success('Programación eliminada')
      setABorrar(null)
      await cargar()
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo eliminar'))
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
          <h1 className="text-lg font-semibold text-ink">Programación de fotos</h1>
          <p className="text-[13px] text-muted">
            Las fotos se toman solas, a una hora impredecible dentro de las franjas que definas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void cargar()} disabled={cargando}>
            {cargando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Actualizar
          </Button>
          <Button variant="success" size="sm" onClick={() => setForm(formVacio())}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva programación
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
            <div className="font-medium text-ink">No se pudieron cargar las programaciones</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : cargando && !programas ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : lista.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-6 py-12 text-center">
          <p className="text-[13px] text-ink">Todavía no hay ninguna programación.</p>
          <p className="mt-1 text-[13px] text-muted">Hoy las fotos solo se toman cuando alguien las pide a mano.</p>
        </div>
      ) : (
        <>
        {/* Hasta 1280 px, tarjetas: la tabla mide 820 y quedaba cortada. */}
        <ul className="divide-y divide-border rounded-md border border-border bg-surface xl:hidden">
          {lista.map((s) => {
            const est = estado(s)
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
                  {destinoTexto(s)} · {cuandoTexto(s)}
                </div>
                <div className="text-[12px] text-ink">
                  Próxima: {proximaTexto(s)} ·{' '}
                  <span className="demo-num">{s.fotos || 0}</span> fotos{' '}
                  <span className={cn('whitespace-nowrap', sinFotosSemana ? 'font-medium text-error' : 'text-muted')}>
                    ({s.fotos_semana || 0} esta semana)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => editar(s)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="tertiary" onClick={() => alternar(s)}>
                    {s.active ? 'Pausar' : 'Activar'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setABorrar(s)}>
                    Eliminar
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
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Aplica a</th>
                <th className="px-4 py-2.5 font-medium">Cuándo</th>
                <th className="px-4 py-2.5 font-medium">Próxima foto</th>
                <th className="px-4 py-2.5 font-medium">Fotos</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => {
                const est = estado(s)
                // Se muestra SIEMPRE, también en cero: el número que delata el
                // problema no puede desaparecer justo cuando hay problema. En
                // rojo cuando debería estar disparando y no tomó ninguna en 7 días.
                const sinFotosSemana = !!s.active && !fueraDeVigencia(s) && !(Number(s.fotos_semana) > 0)
                return (
                  <tr key={s.id} className={cn('border-b border-border last:border-0', !s.active && 'opacity-60')}>
                    <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-4 py-3 text-muted">{destinoTexto(s)}</td>
                    <td className="px-4 py-3 text-muted">{cuandoTexto(s)}</td>
                    <td className="px-4 py-3 text-ink">{proximaTexto(s)}</td>
                    <td className="px-4 py-3 text-ink">
                      <span className="demo-num">{s.fotos || 0}</span>{' '}
                      <span className={cn('whitespace-nowrap text-[12px]', sinFotosSemana ? 'font-medium text-error' : 'text-muted')}>
                        ({s.fotos_semana || 0} esta semana)
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
                          Editar
                        </Button>
                        <Button size="sm" variant="tertiary" onClick={() => alternar(s)}>
                          {s.active ? 'Pausar' : 'Activar'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setABorrar(s)}>
                          Eliminar
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
        title="Eliminar programación"
        confirmLabel="Eliminar"
        busy={borrando}
        confirmarEscribiendo="ELIMINAR"
        onConfirm={() => void eliminar()}
      >
        <p className="text-ink">Se eliminará «{aBorrar?.name}».</p>
        <p className="mt-1">Las fotos que ya se tomaron se conservan; lo que se pierde es la programación futura.</p>
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
  const destinos: [Destino, string][] = [
    ['todos', 'Todos los equipos'],
    ['device', 'Un equipo'],
    ['campaign', 'Una campaña'],
  ]

  return (
    <InlinePanel
      title={f.id ? 'Editar programación' : 'Nueva programación'}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" variant="primary" onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : f.id ? 'Guardar cambios' : 'Crear programación'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna izquierda: qué y a quién */}
        <div className="space-y-4">
          <div>
            <label className={ETIQUETA} htmlFor="prog-nombre">
              Nombre
            </label>
            <input
              id="prog-nombre"
              value={f.name}
              onChange={(e) => cambiar({ name: e.target.value })}
              placeholder="Ej. Evidencia diaria de la ruta norte"
              className={CAMPO}
            />
          </div>

          <div>
            <span className={ETIQUETA}>Aplicar a</span>
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
                  {texto}
                </button>
              ))}
            </div>

            {f.destino === 'todos' && (
              <p className="text-[12px] text-muted">
                Aplica a los {equipos.length} equipos de la flota, incluyendo los que se den de alta después.
              </p>
            )}
            {f.destino === 'device' && (
              <select
                aria-label="Equipo"
                value={f.device_id ?? ''}
                onChange={(e) => cambiar({ device_id: e.target.value ? Number(e.target.value) : null })}
                className={CAMPO}
              >
                <option value="">— Elegir equipo —</option>
                {equipos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name + (d.billboard_code ? ` (${d.billboard_code})` : '')}
                  </option>
                ))}
              </select>
            )}
            {f.destino === 'campaign' && (
              <select
                aria-label="Campaña"
                value={f.campaign_id ?? ''}
                onChange={(e) => cambiar({ campaign_id: e.target.value ? Number(e.target.value) : null })}
                className={CAMPO}
              >
                <option value="">— Elegir campaña —</option>
                {campanas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.name} · ${c.device_count || 0} equipos`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ETIQUETA} htmlFor="prog-desde">
                Desde <span className="font-normal text-muted">(opcional)</span>
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
                Hasta <span className="font-normal text-muted">(opcional)</span>
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
              Cuándo
            </label>
            <select
              id="prog-cuando"
              value={f.frequency_type}
              onChange={(e) => cambiar({ frequency_type: e.target.value as Frecuencia })}
              className={CAMPO}
            >
              <option value="random_windows">Hora al azar dentro de franjas (recomendado)</option>
              <option value="specific_times">Horas exactas</option>
              <option value="interval">Cada cierto tiempo</option>
              {f.frequency_type === 'cron' && <option value="cron">Expresión cron (no editable aquí)</option>}
            </select>
          </div>

          {f.frequency_type === 'random_windows' && (
            <div className="space-y-3">
              <div className="rounded-md border border-accent bg-accent-soft p-3 text-[12px] text-ink">
                Una foto por franja, en un minuto sorteado cada día. La hora no se repite, así que la evidencia no se
                puede acomodar de antemano.
              </div>
              {f.windows.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 shrink-0 text-[12px] text-muted">Franja {i + 1}</span>
                  <input
                    type="time"
                    aria-label={`Inicio de la franja ${i + 1}`}
                    value={v.ini}
                    onChange={(e) =>
                      cambiar({ windows: f.windows.map((w, j) => (j === i ? { ...w, ini: e.target.value } : w)) })
                    }
                    className={CAMPO_HORA}
                  />
                  <span className="text-[13px] text-muted">a</span>
                  <input
                    type="time"
                    aria-label={`Fin de la franja ${i + 1}`}
                    value={v.fin}
                    onChange={(e) =>
                      cambiar({ windows: f.windows.map((w, j) => (j === i ? { ...w, fin: e.target.value } : w)) })
                    }
                    className={CAMPO_HORA}
                  />
                  <Button
                    size="sm"
                    variant="icon"
                    aria-label={`Quitar la franja ${i + 1}`}
                    title="Quitar"
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
                Agregar franja
              </Button>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[12px] text-muted">Rápido:</span>
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
                  Mañana, tarde y noche
                </Button>
                <Button size="sm" variant="secondary" onClick={() => cambiar({ windows: [{ ini: '07:00', fin: '21:00' }] })}>
                  Una al día
                </Button>
              </div>
            </div>
          )}

          {f.frequency_type === 'specific_times' && (
            <div className="space-y-3">
              <div className="rounded-md border border-warning bg-warning-soft p-3 text-[12px] text-ink">
                Siempre al mismo minuto. Sirve para un reporte fijo, pero como evidencia es débil: una hora predecible se
                puede preparar.
              </div>
              {f.specific_times.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={`Hora ${i + 1}`}
                    value={h}
                    onChange={(e) =>
                      cambiar({ specific_times: f.specific_times.map((x, j) => (j === i ? e.target.value : x)) })
                    }
                    className={CAMPO_HORA}
                  />
                  <Button
                    size="sm"
                    variant="icon"
                    aria-label={`Quitar la hora ${i + 1}`}
                    title="Quitar"
                    onClick={() => cambiar({ specific_times: f.specific_times.filter((_, j) => j !== i) })}
                    className="text-error hover:bg-error-soft hover:text-error"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="tertiary" onClick={() => cambiar({ specific_times: [...f.specific_times, '12:00'] })}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar hora
              </Button>
            </div>
          )}

          {f.frequency_type === 'interval' && (
            <div className="space-y-3">
              <div>
                <label className={ETIQUETA} htmlFor="prog-intervalo">
                  Cada cuántos minutos
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
                Ojo con los datos móviles: a este ritmo son <strong>{fotosPorDiaTexto(f)}</strong>.
              </div>
            </div>
          )}

          {/* Costo estimado */}
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="mb-1 text-[12px] text-muted">Consumo estimado por equipo</div>
            <div className="text-[13px] text-ink">
              {fotosPorDiaTexto(f)}
              <span className="text-muted"> · </span>
              <span className="font-medium">{consumoMesTexto(f)}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted">
              A 1.5 MB por foto, que es lo que pesan hoy. Cada equipo gasta ~20 MB al mes sin fotos programadas.
            </div>
          </div>
        </div>
      </div>
    </InlinePanel>
  )
}
