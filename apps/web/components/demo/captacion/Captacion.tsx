'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Sheet } from '@/components/demo/ui/Sheet'
import {
  ETAPAS,
  ETAPAS_DE_TRABAJO,
  ETIQUETA_ETAPA,
  ETIQUETA_TIPO,
  TIPOS_PROSPECTO,
  etapaCerrada,
  faltantesParaRevision,
  motivoAvanceInvalido,
  type Etapa,
  type TipoProspecto,
} from '@/lib/captacion'
import {
  ErrorApi,
  aprobarApi,
  avanceApi,
  crearProspectoApi,
  editarProspectoApi,
  prospectoApi,
  prospectosApi,
  rechazarApi,
  type PaginaProspectos,
  type Prospecto,
  type ProspectoDetalle,
  type ProspectoForm,
} from '@/lib/data/captacion-api'

// ============================================================================
//  La bitácora de captación.  CAP-01.
// ----------------------------------------------------------------------------
//  Una lista, un formulario y un panel. Todo lo que decide si algo se puede
//  —cambiar de etapa, enviar a revisión— sale de `lib/captacion.ts`, la MISMA
//  regla que aplica el servidor: la pantalla la usa para no ofrecer un botón
//  que el servidor va a negar, y el servidor la vuelve a aplicar.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
const labelCls = 'block text-xs font-medium text-ink-muted'

const COLOR_ETAPA: Record<Etapa, string> = {
  PROSPECTO: 'bg-neutral-100 text-neutral-700',
  CONTACTADO: 'bg-sky-50 text-sky-800',
  VISITA: 'bg-indigo-50 text-indigo-800',
  NEGOCIACION: 'bg-violet-50 text-violet-800',
  EN_REVISION: 'bg-amber-50 text-amber-900',
  APROBADO: 'bg-emerald-50 text-emerald-800',
  RECHAZADO: 'bg-red-50 text-red-800',
  PERDIDO: 'bg-neutral-100 text-neutral-500',
}

function Etiqueta({ etapa }: { etapa: Etapa }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${COLOR_ETAPA[etapa]}`}>
      {ETIQUETA_ETAPA[etapa]}
    </span>
  )
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

// Las pestañas agrupan etapas: lo que el vendedor trabaja, lo que espera a
// quien aprueba, y lo cerrado.
const VISTAS = [
  { clave: 'curso', label: 'En curso', etapas: [...ETAPAS_DE_TRABAJO, 'RECHAZADO'] as Etapa[] },
  { clave: 'revision', label: 'Por aprobar', etapas: ['EN_REVISION'] as Etapa[] },
  { clave: 'cerrados', label: 'Cerrados', etapas: ['APROBADO', 'PERDIDO'] as Etapa[] },
  { clave: 'todos', label: 'Todos', etapas: [...ETAPAS] as Etapa[] },
] as const

// ─── Los campos propios de cada tipo ──────────────────────────────────────────
// Son los mismos que acepta `captacion-controller.ts` (esquemas `.strict()`):
// un campo de más sería un 400.
type Campo = { clave: string; label: string; tipo: 'texto' | 'numero' | 'opciones'; opciones?: string[] }
const CAMPOS: Record<TipoProspecto, Campo[]> = {
  CLIENTE: [
    { clave: 'rfc', label: 'RFC', tipo: 'texto' },
    { clave: 'razonSocial', label: 'Razón social', tipo: 'texto' },
    { clave: 'giro', label: 'Giro', tipo: 'texto' },
    { clave: 'presupuesto', label: 'Presupuesto estimado (MXN)', tipo: 'numero' },
  ],
  ARRENDADOR: [{ clave: 'rfc', label: 'RFC', tipo: 'texto' }],
  PREDIO: [
    { clave: 'tipoUbicacion', label: 'Tipo de ubicación (azotea, terreno…)', tipo: 'texto' },
    { clave: 'm2', label: 'Metros cuadrados', tipo: 'numero' },
    { clave: 'rentaPedida', label: 'Renta que piden (MXN / mes)', tipo: 'numero' },
  ],
  PANTALLA: [
    { clave: 'tipoPantalla', label: 'Tipo', tipo: 'opciones', opciones: ['DIGITAL', 'ESTATICA'] },
    { clave: 'anchoM', label: 'Ancho (m)', tipo: 'numero' },
    { clave: 'altoM', label: 'Alto (m)', tipo: 'numero' },
    { clave: 'caras', label: 'Caras', tipo: 'numero' },
    { clave: 'rentaPedida', label: 'Renta que piden (MXN / mes)', tipo: 'numero' },
  ],
}

const formVacio = (tipo: TipoProspecto = 'CLIENTE'): ProspectoForm => ({
  tipo,
  nombre: '',
  contacto: { nombre: '', telefono: '', email: '' },
  direccion: '',
  datos: {},
  siguientePaso: '',
  siguientePasoFecha: '',
  nota: '',
})

function aForm(p: Prospecto): ProspectoForm {
  return {
    tipo: p.tipo,
    nombre: p.nombre,
    contacto: { nombre: p.contacto.nombre ?? '', telefono: p.contacto.telefono ?? '', email: p.contacto.email ?? '' },
    direccion: p.direccion ?? '',
    datos: { ...p.datos },
    siguientePaso: p.siguientePaso ?? '',
    siguientePasoFecha: p.siguientePasoFecha ?? '',
  }
}

// Lo que viaja: solo los campos del tipo, y los números vacíos como null — un
// '' convertido a número sería un 0 que nadie tecleó.
function limpiar(f: ProspectoForm): ProspectoForm {
  const datos: Record<string, unknown> = {}
  for (const c of CAMPOS[f.tipo]) {
    const v = f.datos[c.clave]
    if (v === undefined || v === null || String(v).trim() === '') continue
    datos[c.clave] = c.tipo === 'numero' ? Number(v) : v
  }
  if (f.tipo === 'PREDIO' && f.datos.arrendadorId) datos.arrendadorId = f.datos.arrendadorId
  if (typeof f.datos.notas === 'string' && f.datos.notas.trim()) datos.notas = f.datos.notas
  return { ...f, datos }
}

// ─── El formulario de alta y edición ─────────────────────────────────────────
function FormularioProspecto({
  valor,
  onChange,
  editando,
}: {
  valor: ProspectoForm
  onChange: (f: ProspectoForm) => void
  editando: boolean
}) {
  const set = (parcial: Partial<ProspectoForm>) => onChange({ ...valor, ...parcial })
  const setContacto = (k: string, v: string) => set({ contacto: { ...valor.contacto, [k]: v } })
  const setDato = (k: string, v: unknown) => set({ datos: { ...valor.datos, [k]: v } })
  const conDireccion = valor.tipo === 'PREDIO' || valor.tipo === 'PANTALLA'

  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>¿Qué estás captando?</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {TIPOS_PROSPECTO.map((t) => (
            <button
              key={t}
              type="button"
              disabled={editando}
              onClick={() => set({ tipo: t, datos: {} })}
              className={`rounded border px-3 py-1.5 text-sm ${
                valor.tipo === t ? 'border-accent bg-accent-soft text-ink' : 'border-border-strong text-ink-muted'
              } disabled:opacity-60`}
            >
              {ETIQUETA_TIPO[t]}
            </button>
          ))}
        </div>
        {editando && <p className="mt-1 text-[11px] text-ink-muted">El tipo no se cambia: decide qué registro se crea al aprobar.</p>}
      </div>

      <label className="block">
        <span className={labelCls}>Nombre *</span>
        <input className={inputCls} value={valor.nombre} maxLength={200}
          placeholder={valor.tipo === 'CLIENTE' ? 'Empresa o marca' : valor.tipo === 'PANTALLA' ? 'Nombre de la ubicación' : 'Nombre'}
          onChange={(e) => set({ nombre: e.target.value })} />
      </label>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <legend className={`${labelCls} mb-1`}>
          {valor.tipo === 'PREDIO' ? 'Dueño del terreno (se dará de alta como arrendador al aprobar)' : 'Contacto'}
        </legend>
        <input aria-label="Nombre del contacto" className={inputCls} placeholder="Nombre"
          value={valor.contacto.nombre ?? ''} onChange={(e) => setContacto('nombre', e.target.value)} />
        <input aria-label="Teléfono" className={inputCls} placeholder="Teléfono"
          value={valor.contacto.telefono ?? ''} onChange={(e) => setContacto('telefono', e.target.value)} />
        <input aria-label="Correo" type="email" className={inputCls} placeholder="Correo"
          value={valor.contacto.email ?? ''} onChange={(e) => setContacto('email', e.target.value)} />
      </fieldset>

      {(conDireccion || valor.tipo === 'ARRENDADOR') && (
        <label className="block">
          <span className={labelCls}>Dirección{conDireccion ? ' *' : ''}</span>
          <input className={inputCls} value={valor.direccion ?? ''} maxLength={400}
            onChange={(e) => set({ direccion: e.target.value })} />
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAMPOS[valor.tipo].map((c) => (
          <label key={c.clave} className="block">
            <span className={labelCls}>{c.label}</span>
            {c.tipo === 'opciones' ? (
              <select className={inputCls} value={String(valor.datos[c.clave] ?? '')}
                onChange={(e) => setDato(c.clave, e.target.value || null)}>
                <option value="">—</option>
                {c.opciones!.map((o) => (
                  <option key={o} value={o}>{o === 'ESTATICA' ? 'Estática' : 'Digital'}</option>
                ))}
              </select>
            ) : (
              <input className={inputCls} type={c.tipo === 'numero' ? 'number' : 'text'} min={0}
                value={String(valor.datos[c.clave] ?? '')} onChange={(e) => setDato(c.clave, e.target.value)} />
            )}
          </label>
        ))}
      </div>

      <label className="block">
        <span className={labelCls}>Notas</span>
        <textarea className={`${inputCls} h-20 py-2`} maxLength={2000} value={String(valor.datos.notas ?? '')}
          onChange={(e) => setDato('notas', e.target.value)} />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
        <label className="block">
          <span className={labelCls}>Siguiente paso</span>
          <input className={inputCls} value={valor.siguientePaso ?? ''} maxLength={300} placeholder="Ej. llamar para agendar visita"
            onChange={(e) => set({ siguientePaso: e.target.value })} />
        </label>
        <label className="block">
          <span className={labelCls}>¿Para cuándo?</span>
          <input type="date" className={inputCls} value={valor.siguientePasoFecha ?? ''}
            onChange={(e) => set({ siguientePasoFecha: e.target.value })} />
        </label>
      </div>

      {!editando && (
        <label className="block">
          <span className={labelCls}>Primera nota de la bitácora</span>
          <input className={inputCls} value={valor.nota ?? ''} maxLength={2000} placeholder="Cómo surgió este prospecto"
            onChange={(e) => set({ nota: e.target.value })} />
        </label>
      )}
    </div>
  )
}

// ─── El panel de un prospecto ────────────────────────────────────────────────
function Detalle({
  p,
  puedeAprobar,
  onCambio,
  onEditar,
}: {
  p: ProspectoDetalle
  puedeAprobar: boolean
  onCambio: (p: ProspectoDetalle) => void
  onEditar: () => void
}) {
  const [etapa, setEtapa] = useState<Etapa>(p.etapa)
  const [nota, setNota] = useState('')
  const [siguiente, setSiguiente] = useState(p.siguientePaso ?? '')
  const [fecha, setFecha] = useState(p.siguientePasoFecha ?? '')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [duplicado, setDuplicado] = useState(false)

  useEffect(() => {
    setEtapa(p.etapa)
    setSiguiente(p.siguientePaso ?? '')
    setFecha(p.siguientePasoFecha ?? '')
  }, [p])

  const cerrado = etapaCerrada(p.etapa)
  // Las etapas que la regla deja elegir desde aquí. La misma que aplica el
  // servidor: lo que no sale en la lista, el servidor lo negaría.
  const posibles = ETAPAS.filter((e) => motivoAvanceInvalido(p.etapa, e) === null)
  const faltan = faltantesParaRevision(p)

  async function avanzar() {
    setError(null)
    if (etapa === 'EN_REVISION' && p.etapa !== 'EN_REVISION' && faltan.length) {
      return setError(`Para enviarlo a revisión falta: ${faltan.join(', ')}`)
    }
    try {
      onCambio(await avanceApi(p.id, { etapa, nota, siguientePaso: siguiente || null, siguientePasoFecha: fecha || null }))
      setNota('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el avance')
    }
  }

  async function aprobar(confirma: boolean) {
    setError(null)
    try {
      onCambio(await aprobarApi(p.id, confirma))
      setDuplicado(false)
    } catch (e) {
      // 409 con «Ya existe…»: hay un cliente o arrendador con ese nombre. Se
      // enseña la frase y se ofrece confirmar que es otro.
      if (e instanceof ErrorApi && e.status === 409 && /Ya existe/.test(e.message)) setDuplicado(true)
      setError(e instanceof Error ? e.message : 'No se pudo aprobar')
    }
  }

  async function rechazar() {
    setError(null)
    try {
      onCambio(await rechazarApi(p.id, motivo))
      setMotivo('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo rechazar')
    }
  }

  const d = p.datos as Record<string, unknown>
  const datosVisibles = CAMPOS[p.tipo].filter((c) => d[c.clave] != null && d[c.clave] !== '')

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><span className={labelCls}>Etapa</span><Etiqueta etapa={p.etapa} /></div>
        <div><span className={labelCls}>Vendedor</span>{p.vendedorNombre ?? '—'}</div>
        <div><span className={labelCls}>Contacto</span>
          {[p.contacto.nombre, p.contacto.telefono, p.contacto.email].filter(Boolean).join(' · ') || '—'}
        </div>
        <div><span className={labelCls}>Dirección</span>{p.direccion ?? '—'}</div>
        {datosVisibles.map((c) => (
          <div key={c.clave}><span className={labelCls}>{c.label}</span>{String(d[c.clave])}</div>
        ))}
        {p.siguientePaso && (
          <div className="col-span-2"><span className={labelCls}>Siguiente paso</span>
            {p.siguientePaso}{p.siguientePasoFecha ? ` · para el ${p.siguientePasoFecha}` : ''}
          </div>
        )}
        {typeof d.notas === 'string' && d.notas && (
          <div className="col-span-2 whitespace-pre-wrap"><span className={labelCls}>Notas</span>{d.notas}</div>
        )}
        {p.etapa === 'RECHAZADO' && p.motivoRechazo && (
          <div className="col-span-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-800">
            <b>Rechazado{p.decididoPorNombre ? ` por ${p.decididoPorNombre}` : ''}:</b> {p.motivoRechazo}
          </div>
        )}
        {p.etapa === 'APROBADO' && (
          <div className="col-span-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900">
            <b>Aprobado{p.decididoPorNombre ? ` por ${p.decididoPorNombre}` : ''}.</b>{' '}
            {p.tipo === 'PANTALLA'
              ? 'Falta darla de alta en Inventario con sus medidas y tarifas.'
              : `El ${ETIQUETA_TIPO[p.tipo].toLowerCase()} ya existe en el sistema.`}
          </div>
        )}
      </section>

      {!cerrado && p.etapa !== 'EN_REVISION' && (
        <Button variant="secondary" size="sm" onClick={onEditar}>Editar datos</Button>
      )}

      {puedeAprobar && p.etapa === 'EN_REVISION' && (
        <section className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-950">Revisión</h3>
          <p className="text-xs text-amber-900">
            Al aprobar se da de alta{' '}
            {p.tipo === 'PREDIO' ? 'el predio (y su arrendador, si es nuevo)' : p.tipo === 'PANTALLA' ? 'nada todavía: la pantalla se completa en Inventario' : `el ${ETIQUETA_TIPO[p.tipo].toLowerCase()}`}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => aprobar(false)}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
            </Button>
            {duplicado && (
              <Button size="sm" variant="secondary" onClick={() => aprobar(true)}>
                Es otro distinto: aprobar de todos modos
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Motivo del rechazo (lo lee el vendedor)" value={motivo}
              onChange={(e) => setMotivo(e.target.value)} maxLength={1000} />
            <Button size="sm" variant="danger" disabled={motivo.trim().length < 3} onClick={rechazar}>
              <XCircle className="mr-1 h-4 w-4" /> Rechazar
            </Button>
          </div>
        </section>
      )}

      {!cerrado && (
        <section className="space-y-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold">Registrar avance</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
            <select aria-label="Etapa" className={inputCls} value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>
              {posibles.map((e) => (
                <option key={e} value={e}>{e === p.etapa ? `${ETIQUETA_ETAPA[e]} (solo una nota)` : ETIQUETA_ETAPA[e]}</option>
              ))}
            </select>
            <input aria-label="Qué pasó" className={inputCls} placeholder="Qué pasó" value={nota} maxLength={2000}
              onChange={(e) => setNota(e.target.value)} />
          </div>
          {p.etapa !== 'EN_REVISION' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
              <input aria-label="Siguiente paso" className={inputCls} placeholder="Siguiente paso" value={siguiente}
                maxLength={300} onChange={(e) => setSiguiente(e.target.value)} />
              <input aria-label="Fecha del siguiente paso" type="date" className={inputCls} value={fecha}
                onChange={(e) => setFecha(e.target.value)} />
            </div>
          )}
          {etapa === 'EN_REVISION' && p.etapa !== 'EN_REVISION' && faltan.length > 0 && (
            <p className="text-xs text-amber-800">Para enviarlo a revisión falta: {faltan.join(', ')}.</p>
          )}
          <Button size="sm" disabled={!nota.trim()} onClick={avanzar}>Guardar avance</Button>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Bitácora</h3>
        <ol className="space-y-3 border-l border-border pl-4">
          {[...p.avances].reverse().map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span>{fechaHora(a.creadoEn)}</span>
                <span>· {a.usuarioNombre ?? 'Usuario eliminado'}</span>
                {a.etapaAnterior && a.etapaAnterior !== a.etapaNueva ? (
                  <span>· {ETIQUETA_ETAPA[a.etapaAnterior]} → <Etiqueta etapa={a.etapaNueva} /></span>
                ) : !a.etapaAnterior ? (
                  <span>· <Etiqueta etapa={a.etapaNueva} /></span>
                ) : null}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{a.nota}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

// ─── La pantalla ─────────────────────────────────────────────────────────────
export function Captacion() {
  const [vista, setVista] = useState<(typeof VISTAS)[number]['clave']>('curso')
  const [tipo, setTipo] = useState<TipoProspecto | ''>('')
  const [pagina, setPagina] = useState<PaginaProspectos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<ProspectoDetalle | null>(null)
  const [form, setForm] = useState<{ valor: ProspectoForm; id?: string } | null>(null)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const [numPagina, setNumPagina] = useState(1)

  const cargar = useCallback(async () => {
    try {
      // La pestaña se filtra EN EL SERVIDOR y los contadores también salen de
      // allí (`porEtapa`). Filtrar aquí una sola página escondía prospectos en
      // cuanto había más de los que caben en ella.
      const v = VISTAS.find((x) => x.clave === vista)!
      setPagina(await prospectosApi({ tipo: tipo || null, etapas: v.clave === 'todos' ? null : v.etapas, pagina: numPagina }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los prospectos')
    }
  }, [tipo, vista, numPagina])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = pagina?.prospectos ?? []

  const cuenta = (clave: string) => {
    const v = VISTAS.find((x) => x.clave === clave)!
    return v.etapas.reduce((n, e) => n + (pagina?.porEtapa[e] ?? 0), 0)
  }
  const paginas = pagina ? Math.max(1, Math.ceil(pagina.total / pagina.porPagina)) : 1

  async function abrir(id: string) {
    try {
      setAbierto(await prospectoApi(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el prospecto')
    }
  }

  async function guardar() {
    if (!form) return
    setErrorForm(null)
    try {
      const limpio = limpiar(form.valor)
      const p = form.id ? await editarProspectoApi(form.id, limpio) : await crearProspectoApi(limpio)
      setForm(null)
      setAbierto(p)
      await cargar()
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist">
          {VISTAS.map((v) => (
            <button key={v.clave} role="tab" aria-selected={vista === v.clave} type="button" onClick={() => { setVista(v.clave); setNumPagina(1) }}
              className={`rounded px-3 py-1.5 text-sm ${vista === v.clave ? 'bg-accent-soft font-medium text-ink' : 'text-ink-muted hover:bg-surface-2'}`}>
              {v.label} <span className="text-xs text-ink-muted">({cuenta(v.clave)})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select aria-label="Tipo" className={`${inputCls} w-40`} value={tipo} onChange={(e) => { setTipo(e.target.value as TipoProspecto | ''); setNumPagina(1) }}>
            <option value="">Todos los tipos</option>
            {TIPOS_PROSPECTO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
          <Button onClick={() => { setErrorForm(null); setForm({ valor: formVacio() }) }}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo prospecto
          </Button>
        </div>
      </div>

      {vista === 'revision' && pagina && !pagina.puedeAprobar && (
        <p className="text-xs text-ink-muted">Estos esperan a que un gerente, director o administrador los revise.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-ink-muted">
              <th className="py-2">Nombre</th>
              <th>Tipo</th>
              <th>Etapa</th>
              <th>Siguiente paso</th>
              {pagina?.puedeAprobar && <th>Vendedor</th>}
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {pagina && visibles.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-ink-muted">
                {vista === 'curso' ? 'No hay prospectos en curso. Da de alta el primero con «Nuevo prospecto».' : 'Nada por aquí.'}
              </td></tr>
            )}
            {visibles.map((p) => {
              const vencido = p.siguientePasoFecha && p.siguientePasoFecha < hoy && !etapaCerrada(p.etapa)
              return (
                <tr key={p.id} className="cursor-pointer border-b hover:bg-surface-2" onClick={() => void abrir(p.id)}>
                  <td className="py-2 font-medium text-ink">{p.nombre}</td>
                  <td>{ETIQUETA_TIPO[p.tipo]}</td>
                  <td><Etiqueta etapa={p.etapa} /></td>
                  <td className={vencido ? 'text-red-700' : undefined}>
                    {p.siguientePaso ?? '—'}
                    {p.siguientePasoFecha && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs"><Clock className="h-3 w-3" />{p.siguientePasoFecha}</span>
                    )}
                  </td>
                  {pagina?.puedeAprobar && <td>{p.vendedorNombre ?? '—'}</td>}
                  <td className="text-xs text-ink-muted">{fechaHora(p.actualizadoEn)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {paginas > 1 && (
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-ink-muted">
            <Button size="sm" variant="secondary" disabled={numPagina <= 1} onClick={() => setNumPagina(numPagina - 1)}>Anterior</Button>
            <span>Página {numPagina} de {paginas} · {pagina!.total} prospectos</span>
            <Button size="sm" variant="secondary" disabled={numPagina >= paginas} onClick={() => setNumPagina(numPagina + 1)}>Siguiente</Button>
          </div>
        )}
      </div>

      <Sheet
        open={!!form}
        onOpenChange={(v) => !v && setForm(null)}
        title={form?.id ? 'Editar prospecto' : 'Nuevo prospecto'}
        subtitle="Captura lo que tengas; lo mínimo para enviarlo a revisión se pide al enviarlo."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={!form?.valor.nombre.trim()} onClick={guardar}>Guardar</Button>
          </div>
        }
      >
        {errorForm && (
          <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{errorForm}</p>
        )}
        {form && (
          <FormularioProspecto valor={form.valor} editando={!!form.id} onChange={(valor) => setForm({ ...form, valor })} />
        )}
      </Sheet>

      <Sheet
        open={!!abierto && !form}
        onOpenChange={(v) => !v && setAbierto(null)}
        title={abierto?.nombre ?? ''}
        subtitle={abierto ? ETIQUETA_TIPO[abierto.tipo] : undefined}
      >
        {abierto && (
          <Detalle
            p={abierto}
            puedeAprobar={!!pagina?.puedeAprobar}
            onCambio={(p) => { setAbierto(p); void cargar() }}
            onEditar={() => { setErrorForm(null); setForm({ valor: aForm(abierto), id: abierto.id }) }}
          />
        )}
      </Sheet>
    </div>
  )
}
