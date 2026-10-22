'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Clock,
  MapPin,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Swords,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Sheet } from '@/components/demo/ui/Sheet'
import { SelectorUbicacion, type Punto } from './SelectorUbicacion'
import {
  buscarDireccionApi,
  borrarCompetidorApi,
  borrarContactoApi,
  crearCompetidorApi,
  crearContactoApi,
  crearNotaApi,
  crearOfertaApi,
  crearProspectoApi,
  editarContactoApi,
  editarOfertaApi,
  fichaApi,
  avanceApi,
  prospectoApi,
  prospectosApi,
  type CandidatoDireccion,
  type FichaForm,
  type Prospecto,
  type ProspectoDetalle,
} from '@/lib/data/captacion-api'
import { ETAPAS_DE_TRABAJO, ETIQUETA_ETAPA, etapaCerrada, type Etapa } from '@/lib/captacion'
import { diasSinContacto, espacioElegido, iniciales, resumen } from '@/lib/comercial-opex'
import {
  CANALES,
  ESTADOS_OFERTA,
  ETAPAS_RESPONSABLE,
  ETIQUETA_CANAL,
  ETIQUETA_OFERTA,
  ETIQUETA_VISIBILIDAD,
  VISIBILIDADES,
  areaM2,
  estadoEspacio,
  motivoCambioOferta,
  motivoEdicion,
  motivoEtapaResponsable,
  type Canal,
  type EstadoEspacio,
  type EstadoOferta,
  type Visibilidad,
} from '@/lib/negociacion'

// ============================================================================
//  Comercial negociación · prospección de arrendadores.  NEG-01.
// ----------------------------------------------------------------------------
//  Fue maqueta del 30/09 al 22/10. Ahora cada espacio es un PROSPECTO de tipo
//  PREDIO o PANTALLA (decisión del dueño: encima de Captación, una sola
//  bitácora) y todo se guarda: la ficha —tipo, visibilidad cercana/media/lejana,
//  medidas, presupuesto—, la ubicación, los contactos, las ofertas al dueño, la
//  competencia, la bitácora con canal y las notas con autor y fecha.
//
//  La forma es la de la maqueta: lista a la izquierda, detalle a la derecha.
//  Las cuentas viven en `lib/comercial-opex.ts` y las reglas en
//  `lib/negociacion.ts`, las dos con pruebas: aquí solo se pinta y se llama a la
//  API. La pantalla usa las reglas para no ofrecer lo que el servidor negaría;
//  el servidor las vuelve a aplicar, y lo que diga él es lo que se pinta.
//
//  La ubicación: un buscador de direcciones (por el servidor) propone un punto
//  y la persona lo confirma o lo arrastra en el mapa. El GPS del teléfono quedó
//  PENDIENTE por decisión del dueño (22/10).
//
//  ⚠️ `preflight` de Tailwind está DESACTIVADO en este proyecto, así que un
//  <ul> o un <ol> sale con las viñetas y la sangría del navegador. TODA lista de
//  aquí lleva `LISTA`; si añades una, también.
// ============================================================================

const LISTA = 'm-0 list-none p-0'
const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
const labelCls = 'block text-[11px] font-medium text-muted'

const pesos = (n: number) => '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 2 })
const fecha = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: iso.length === 10 ? 'UTC' : undefined,
  })
const numeroO = (v: string): number | null => (v.trim() === '' ? null : Number(v))

const COLOR_ESTADO: Record<EstadoEspacio, string> = {
  negociacion: 'bg-amber-50 text-amber-900 border-amber-200',
  activo: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  inactivo: 'bg-surface-2 text-muted border-border',
}
const ETIQUETA_ESTADO: Record<EstadoEspacio, string> = {
  negociacion: 'En negociación',
  activo: 'Activo',
  inactivo: 'Inactivo',
}

function Estado({ etapa }: { etapa: Etapa }) {
  const e = estadoEspacio(etapa)
  return (
    <span className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[e]}`}>
      {ETIQUETA_ESTADO[e]}
    </span>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded border border-border bg-surface-2 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  )
}

function Antiguedad({ p, hoy }: { p: Prospecto; hoy: Date }) {
  const d = diasSinContacto(p, hoy)
  // Sin bitácora NO se pinta un cero: se dice que no hay contacto.
  if (d === null) return <span className="text-muted">Sin contacto</span>
  const frio = estadoEspacio(p.etapa) === 'negociacion' && d > 30
  return <span className={frio ? 'font-semibold text-red-600' : 'text-muted'}>{d === 0 ? 'hoy' : `hace ${d} d`}</span>
}

// Cada bloque se pliega con un clic en su encabezado; el navegador recuerda
// cuáles dejó plegados la persona (el mismo id para todos los espacios).
function Bloque({
  id,
  titulo,
  icono: Icono,
  cuenta,
  children,
}: {
  id: string
  titulo: string
  icono: typeof Users
  cuenta?: number
  children: React.ReactNode
}) {
  return (
    <CardColapsable
      id={`comercial-opex.${id}`}
      titulo={cuenta !== undefined ? `${titulo} (${cuenta})` : titulo}
      icono={<Icono className="h-4 w-4 text-muted" strokeWidth={1.75} />}
      headerClassName="px-3 pt-3 pb-2.5"
      contentClassName="px-3 pb-3"
    >
      {children}
    </CardColapsable>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[13px] text-muted">{children}</p>
}

type Accion = (fn: () => Promise<ProspectoDetalle>) => Promise<boolean>

// ─── La búsqueda del responsable ────────────────────────────────────────────
function Pasos({ p, accion, puede }: { p: ProspectoDetalle; accion: Accion; puede: boolean }) {
  const etapa = p.etapaResponsable ?? 0
  return (
    <ol className={`${LISTA} flex flex-wrap items-start gap-y-2`} aria-label="Búsqueda del responsable">
      {ETAPAS_RESPONSABLE.map((nombre, i) => {
        const n = i + 1
        const hecho = n < etapa
        const actual = n === etapa
        const motivo = motivoEtapaResponsable(n, p.contactos)
        return (
          <li key={nombre} className="flex items-start">
            <button
              type="button"
              disabled={!puede || actual || !!motivo}
              title={motivo ?? (puede ? `Pasar a «${nombre}»` : undefined)}
              onClick={() => void accion(() => fichaApi(p.id, { etapaResponsable: n }))}
              className="flex w-24 flex-col items-center text-center disabled:cursor-default"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  hecho
                    ? 'border-success bg-success text-white'
                    : actual
                      ? 'border-accent bg-accent-soft text-ink'
                      : 'border-border bg-surface text-muted'
                }`}
              >
                {hecho ? '✓' : n}
              </span>
              <span className={`mt-1 text-[11px] leading-tight ${actual ? 'font-medium text-ink' : hecho ? 'text-ink' : 'text-muted'}`}>
                {nombre}
              </span>
            </button>
            {i < ETAPAS_RESPONSABLE.length - 1 && (
              <span className={`mt-3 h-0.5 w-4 shrink-0 rounded-full ${hecho ? 'bg-success' : 'bg-border'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── La ficha ───────────────────────────────────────────────────────────────
function Ficha({ p, accion, puede }: { p: ProspectoDetalle; accion: Accion; puede: boolean }) {
  const inicial = () => ({
    tipoEspacio: p.tipoEspacio ?? '',
    visibilidad: (p.visibilidad ?? '') as Visibilidad | '',
    anchoM: p.anchoM?.toString() ?? '',
    altoM: p.altoM?.toString() ?? '',
    superficieM2: p.superficieM2?.toString() ?? '',
    presupuestoMin: p.presupuestoMin?.toString() ?? '',
    presupuestoMax: p.presupuestoMax?.toString() ?? '',
    presupuestoAutoriza: p.presupuestoAutoriza ?? '',
  })
  const [f, setF] = useState(inicial)
  useEffect(() => setF(inicial()), [p]) // eslint-disable-line react-hooks/exhaustive-deps
  const area = areaM2(numeroO(f.anchoM), numeroO(f.altoM))
  const campo = (k: keyof typeof f) => ({
    value: f[k],
    disabled: !puede,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }),
  })

  async function guardar() {
    const cuerpo: FichaForm = {
      tipoEspacio: f.tipoEspacio.trim() || null,
      visibilidad: f.visibilidad || null,
      anchoM: numeroO(f.anchoM),
      altoM: numeroO(f.altoM),
      superficieM2: numeroO(f.superficieM2),
      presupuestoMin: numeroO(f.presupuestoMin),
      presupuestoMax: numeroO(f.presupuestoMax),
      presupuestoAutoriza: f.presupuestoAutoriza.trim() || null,
    }
    await accion(() => fichaApi(p.id, cuerpo))
  }

  return (
    <Bloque id="ficha" titulo="Ficha técnica" icono={Building2}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        <label className="col-span-2">
          <span className={labelCls}>Tipo de espacio</span>
          <input className={inputCls} maxLength={80} placeholder="Ej. espectacular en azotea, muro, unipolar" {...campo('tipoEspacio')} />
        </label>
        <label className="col-span-2">
          <span className={labelCls}>Visibilidad</span>
          <select className={inputCls} {...campo('visibilidad')}>
            <option value="">Sin definir</option>
            {VISIBILIDADES.map((v) => (
              <option key={v} value={v}>
                {ETIQUETA_VISIBILIDAD[v]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Ancho (m)</span>
          <input className={inputCls} type="number" min={0} step="0.01" {...campo('anchoM')} />
        </label>
        <label>
          <span className={labelCls}>Alto (m)</span>
          <input className={inputCls} type="number" min={0} step="0.01" {...campo('altoM')} />
        </label>
        <div>
          <span className={labelCls}>Área de la cara</span>
          <span className="block py-2 text-ink">{area == null ? '—' : `${area.toLocaleString('es-MX')} m²`}</span>
        </div>
        <label>
          <span className={labelCls}>Superficie del terreno (m²)</span>
          <input className={inputCls} type="number" min={0} step="0.01" {...campo('superficieM2')} />
        </label>
        <label>
          <span className={labelCls}>Renta autorizada, mínimo</span>
          <input className={inputCls} type="number" min={0} {...campo('presupuestoMin')} />
        </label>
        <label>
          <span className={labelCls}>Renta autorizada, máximo</span>
          <input className={inputCls} type="number" min={0} {...campo('presupuestoMax')} />
        </label>
        <label className="col-span-2">
          <span className={labelCls}>Quién autoriza</span>
          <input className={inputCls} maxLength={120} placeholder="Ej. Dirección comercial" {...campo('presupuestoAutoriza')} />
        </label>
      </div>
      {puede && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => void guardar()}>
            Guardar ficha
          </Button>
        </div>
      )}
    </Bloque>
  )
}

// ─── La ubicación ───────────────────────────────────────────────────────────
function Ubicacion({ p, accion, puede }: { p: ProspectoDetalle; accion: Accion; puede: boolean }) {
  const guardado: Punto | null = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null
  const [punto, setPunto] = useState<Punto | null>(guardado)
  const [origen, setOrigen] = useState<'PIN' | 'BUSCADOR'>('PIN')
  const [q, setQ] = useState(p.direccion ?? '')
  const [candidatos, setCandidatos] = useState<CandidatoDireccion[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    setPunto(guardado)
    setCandidatos(null)
    setAviso(null)
  }, [p.id, p.lat, p.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const cambiado = punto && (!guardado || punto.lat !== guardado.lat || punto.lng !== guardado.lng)

  async function buscar() {
    setAviso(null)
    try {
      const r = await buscarDireccionApi(q)
      setCandidatos(r.resultados)
      if (!r.resultados.length) setAviso('No se encontró esa dirección. Marca el punto directamente en el mapa.')
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo buscar')
    }
  }

  return (
    <Bloque id="ubicacion" titulo="Ubicación" icono={MapPin}>
      {puede && (
        <form
          className="mb-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void buscar()
          }}
        >
          <input
            aria-label="Buscar dirección"
            className={inputCls}
            value={q}
            maxLength={200}
            placeholder="Calle, número, colonia, ciudad"
            onChange={(e) => setQ(e.target.value)}
          />
          <Button size="sm" variant="secondary" type="submit" disabled={q.trim().length < 3}>
            <Search className="mr-1 h-3.5 w-3.5" /> Buscar
          </Button>
        </form>
      )}
      {aviso && <p className="m-0 mb-2 text-[12px] text-amber-800">{aviso}</p>}
      {candidatos && candidatos.length > 0 && (
        <ul className={`${LISTA} mb-2 divide-y divide-border rounded border border-border`}>
          {candidatos.map((c) => (
            <li key={`${c.lat},${c.lng}`}>
              <button
                type="button"
                className="w-full px-2.5 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2"
                onClick={() => {
                  setPunto({ lat: c.lat, lng: c.lng })
                  setOrigen('BUSCADOR')
                  setCandidatos(null)
                }}
              >
                {c.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      <SelectorUbicacion
        punto={punto}
        onCambio={(nuevo) => {
          if (!puede) return
          setPunto(nuevo)
          setOrigen('PIN')
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>
          {guardado
            ? `Guardada${p.ubicacionFijadaPorNombre ? ` por ${p.ubicacionFijadaPorNombre}` : ''}${
                p.ubicacionFijadaEn ? ` el ${fecha(p.ubicacionFijadaEn)}` : ''
              }${p.ubicacionOrigen === 'BUSCADOR' ? ' · desde el buscador' : p.ubicacionOrigen === 'PIN' ? ' · marcada en el mapa' : ''}`
            : 'Sin ubicación guardada'}
          {' · '}GPS del teléfono: pendiente
        </span>
        {puede && cambiado && (
          <Button
            size="sm"
            onClick={() =>
              void accion(() => fichaApi(p.id, { ubicacion: { lat: punto!.lat, lng: punto!.lng, origen, placeId: null } }))
            }
          >
            Guardar ubicación
          </Button>
        )}
      </div>
    </Bloque>
  )
}

// ─── Contactos ──────────────────────────────────────────────────────────────
function Contactos({ p, accion, puede }: { p: ProspectoDetalle; accion: Accion; puede: boolean }) {
  const vacio = { nombre: '', papel: '', telefono: '', email: '', esLegal: false }
  const [n, setN] = useState(vacio)
  return (
    <Bloque id="contactos" titulo="Responsables y contactos" icono={Users} cuenta={p.contactos.length}>
      {p.contactos.length === 0 ? (
        <Vacio>Todavía no se sabe con quién hablar.</Vacio>
      ) : (
        <ul className={`${LISTA} divide-y divide-border`}>
          {p.contactos.map((c) => (
            <li key={c.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-ink">
                {iniciales(c.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium text-ink">{c.nombre}</span>
                  {c.esLegal && <span className="rounded bg-ink px-1.5 text-[10px] font-medium text-surface">firma</span>}
                </div>
                {c.papel && <div className="text-[12px] text-muted">{c.papel}</div>}
                {(c.telefono || c.email) && (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-ink">
                    {c.telefono && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted" /> {c.telefono}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0 text-muted" /> <span className="truncate">{c.email}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              {puede && (
                <div className="flex shrink-0 items-start gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void accion(() => editarContactoApi(p.id, c.id, { esLegal: !c.esLegal }))}
                  >
                    {c.esLegal ? 'No firma' : 'Firma'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Quitar a ${c.nombre}`}
                    onClick={() => void accion(() => borrarContactoApi(p.id, c.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {puede && (
        <form
          className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await accion(() => crearContactoApi(p.id, n))) setN(vacio)
          }}
        >
          <input aria-label="Nombre del contacto" className={inputCls} placeholder="Nombre" maxLength={200} value={n.nombre} onChange={(e) => setN({ ...n, nombre: e.target.value })} />
          <input aria-label="Papel" className={inputCls} placeholder="Papel (dueño, vecina…)" maxLength={80} value={n.papel} onChange={(e) => setN({ ...n, papel: e.target.value })} />
          <input aria-label="Teléfono" className={inputCls} placeholder="Teléfono" maxLength={40} value={n.telefono} onChange={(e) => setN({ ...n, telefono: e.target.value })} />
          <input aria-label="Correo" type="email" className={inputCls} placeholder="Correo" maxLength={200} value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input type="checkbox" checked={n.esLegal} onChange={(e) => setN({ ...n, esLegal: e.target.checked })} /> Es quien firma
          </label>
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={!n.nombre.trim()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar contacto
            </Button>
          </div>
        </form>
      )}
    </Bloque>
  )
}

// ─── Ofertas al dueño ───────────────────────────────────────────────────────
function Ofertas({ p, accion, puede }: { p: ProspectoDetalle; accion: Accion; puede: boolean }) {
  const [n, setN] = useState({ importe: '', plazo: '36', notas: '' })
  return (
    <Bloque id="ofertas" titulo="Ofertas de renta al arrendador" icono={Wallet} cuenta={p.ofertas.length}>
      {p.ofertas.length === 0 ? (
        <Vacio>Todavía no se le ha ofrecido nada.</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="text-left text-[11px] text-muted">
              <tr>
                <th className="pb-1 font-medium">Versión</th>
                <th className="pb-1 font-medium">Fecha</th>
                <th className="pb-1 font-medium">Renta</th>
                <th className="pb-1 font-medium">Plazo</th>
                <th className="pb-1 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {p.ofertas.map((o) => (
                <tr key={o.id} className="border-t border-border align-top">
                  <td className="py-1.5 text-ink">v{o.version}</td>
                  <td className="py-1.5 text-muted">{fecha(o.fecha)}</td>
                  <td className="py-1.5 font-medium text-ink">{pesos(o.importeMensual)}/mes</td>
                  <td className="py-1.5 text-muted">{o.plazoMeses} meses</td>
                  <td className="py-1.5 text-ink">
                    {puede ? (
                      <select
                        aria-label={`Estado de la oferta v${o.version}`}
                        className={`${inputCls} h-7 w-36`}
                        value={o.estado}
                        onChange={(e) => void accion(() => editarOfertaApi(p.id, o.id, { estado: e.target.value as EstadoOferta }))}
                      >
                        {ESTADOS_OFERTA.map((s) => (
                          <option key={s} value={s} disabled={!!motivoCambioOferta(o.estado, s)}>
                            {ETIQUETA_OFERTA[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ETIQUETA_OFERTA[o.estado]
                    )}
                    {o.notas && <div className="text-[11px] text-muted">{o.notas}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {puede && (
        <form
          className="mt-3 grid grid-cols-[1fr_7rem] gap-2 border-t border-border pt-3 sm:grid-cols-[10rem_7rem_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await accion(() =>
              crearOfertaApi(p.id, { importeMensual: Number(n.importe), plazoMeses: Number(n.plazo), notas: n.notas.trim() || null }),
            )
            if (ok) setN({ importe: '', plazo: n.plazo, notas: '' })
          }}
        >
          <input aria-label="Renta mensual" type="number" min={1} className={inputCls} placeholder="Renta mensual" value={n.importe} onChange={(e) => setN({ ...n, importe: e.target.value })} />
          <input aria-label="Plazo en meses" type="number" min={1} max={240} className={inputCls} placeholder="Meses" value={n.plazo} onChange={(e) => setN({ ...n, plazo: e.target.value })} />
          <input aria-label="Notas de la oferta" className={inputCls} placeholder="Notas" maxLength={2000} value={n.notas} onChange={(e) => setN({ ...n, notas: e.target.value })} />
          <Button size="sm" type="submit" disabled={!(Number(n.importe) > 0 && Number(n.plazo) >= 1)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Nueva versión
          </Button>
        </form>
      )}
    </Bloque>
  )
}

// ─── Competencia ────────────────────────────────────────────────────────────
function Competencia({ p, accion, puede }: { p: ProspectoDetalle; accion: Accion; puede: boolean }) {
  const [n, setN] = useState({ nombre: '', nota: '', desde: '' })
  return (
    <Bloque id="competencia" titulo="Competencia" icono={Swords} cuenta={p.competencia.length}>
      {p.competencia.length === 0 ? (
        <Vacio>Sin competencia identificada.</Vacio>
      ) : (
        <ul className={`${LISTA} space-y-2`}>
          {p.competencia.map((c) => (
            <li key={c.id} className="flex gap-2 rounded border-l-2 border-red-300 bg-surface-2 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-[13px] font-medium text-ink">{c.nombre}</span>
                  {c.desde && <span className="text-[11px] text-muted">desde {fecha(c.desde)}</span>}
                </div>
                {c.nota && <p className="m-0 text-[12px] text-ink">{c.nota}</p>}
              </div>
              {puede && (
                <button
                  type="button"
                  aria-label={`Quitar a ${c.nombre}`}
                  className="shrink-0 text-muted hover:text-red-700"
                  onClick={() => void accion(() => borrarCompetidorApi(p.id, c.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puede && (
        <form
          className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await accion(() =>
              crearCompetidorApi(p.id, { nombre: n.nombre, nota: n.nota.trim() || null, desde: n.desde || null }),
            )
            if (ok) setN({ nombre: '', nota: '', desde: '' })
          }}
        >
          <input aria-label="Competidor" className={inputCls} placeholder="Quién" maxLength={200} value={n.nombre} onChange={(e) => setN({ ...n, nombre: e.target.value })} />
          <input aria-label="Desde" type="date" className={inputCls} value={n.desde} onChange={(e) => setN({ ...n, desde: e.target.value })} />
          <input aria-label="Qué ofrece" className={`${inputCls} col-span-2`} placeholder="Qué ofrece o qué se sabe" maxLength={2000} value={n.nota} onChange={(e) => setN({ ...n, nota: e.target.value })} />
          <div className="col-span-2 flex justify-end">
            <Button size="sm" type="submit" disabled={!n.nombre.trim()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
        </form>
      )}
    </Bloque>
  )
}

// ─── Bitácora ───────────────────────────────────────────────────────────────
function Historial({ p, accion }: { p: ProspectoDetalle; accion: Accion }) {
  // A qué etapas se puede mover desde aquí: las de trabajo, revisión y perdido
  // (aprobar y rechazar se deciden en Captación, por quien puede aprobar).
  const etapas: Etapa[] = p.etapa === 'EN_REVISION' ? ['EN_REVISION'] : [...ETAPAS_DE_TRABAJO, 'EN_REVISION', 'PERDIDO']
  // Un espacio RECHAZADO no puede quedarse en RECHAZADO con un avance (el
  // servidor lo niega: rechazar no es un avance), así que arranca en la primera
  // etapa que sí se puede elegir en vez de mandar una que dé 409.
  const etapaInicial = etapas.includes(p.etapa) ? p.etapa : etapas[0]
  const [n, setN] = useState<{ etapa: Etapa; canal: Canal | ''; contacto: string; nota: string; siguiente: string }>({
    etapa: etapaInicial,
    canal: '',
    contacto: '',
    nota: '',
    siguiente: '',
  })
  useEffect(() => setN((x) => ({ ...x, etapa: etapaInicial })), [etapaInicial])
  const avances = [...p.avances].reverse()
  const cerrado = etapaCerrada(p.etapa)
  return (
    <Bloque id="historial" titulo="Historial" icono={MessageSquare} cuenta={p.avances.length}>
      {!cerrado && (
        <form
          className="mb-3 grid grid-cols-2 gap-2 border-b border-border pb-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await accion(() =>
              avanceApi(p.id, {
                etapa: n.etapa,
                nota: n.nota,
                canal: n.canal || null,
                contactoNombre: n.contacto || null,
                ...(n.siguiente.trim() ? { siguientePaso: n.siguiente.trim() } : {}),
              }),
            )
            if (ok) setN({ ...n, nota: '', siguiente: '' })
          }}
        >
          <select aria-label="Canal" className={inputCls} value={n.canal} onChange={(e) => setN({ ...n, canal: e.target.value as Canal | '' })}>
            <option value="">Canal…</option>
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CANAL[c]}
              </option>
            ))}
          </select>
          <select aria-label="Con quién" className={inputCls} value={n.contacto} onChange={(e) => setN({ ...n, contacto: e.target.value })}>
            <option value="">Con quién…</option>
            {p.contactos.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input aria-label="Qué pasó" className={`${inputCls} col-span-2`} placeholder="Qué pasó" maxLength={2000} value={n.nota} onChange={(e) => setN({ ...n, nota: e.target.value })} />
          <input aria-label="Siguiente paso" className={inputCls} placeholder="Siguiente paso" maxLength={300} value={n.siguiente} onChange={(e) => setN({ ...n, siguiente: e.target.value })} />
          <select aria-label="Etapa" className={inputCls} value={n.etapa} onChange={(e) => setN({ ...n, etapa: e.target.value as Etapa })}>
            {etapas.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ETAPA[e]}
              </option>
            ))}
          </select>
          <div className="col-span-2 flex justify-end">
            <Button size="sm" type="submit" disabled={!n.nota.trim()}>
              Registrar contacto
            </Button>
          </div>
        </form>
      )}
      {avances.length === 0 ? (
        <Vacio>Sin contactos registrados.</Vacio>
      ) : (
        <ol className={`${LISTA} relative`}>
          {avances.map((a, i) => (
            <li key={a.id} className="relative pb-4 pl-6 last:pb-0">
              {i < avances.length - 1 && (
                <span className="absolute bottom-0 left-[7px] top-4 w-px bg-border" aria-hidden="true" />
              )}
              <span
                className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 ${
                  i === 0 ? 'border-accent bg-accent' : 'border-border bg-surface'
                }`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-ink">{fecha(a.creadoEn)}</span>
                {a.canal && <Etiqueta>{ETIQUETA_CANAL[a.canal]}</Etiqueta>}
                {a.contactoNombre && <span className="text-muted">con {a.contactoNombre}</span>}
                <span className="text-muted">· {a.usuarioNombre ?? 'Usuario eliminado'}</span>
                {a.etapaAnterior && a.etapaAnterior !== a.etapaNueva && (
                  <span className="text-muted">
                    · {ETIQUETA_ETAPA[a.etapaAnterior]} → {ETIQUETA_ETAPA[a.etapaNueva]}
                  </span>
                )}
              </div>
              <p className="m-0 mt-0.5 whitespace-pre-wrap text-[13px] text-ink">{a.nota}</p>
            </li>
          ))}
        </ol>
      )}
    </Bloque>
  )
}

// ─── Notas ──────────────────────────────────────────────────────────────────
function Notas({ p, accion }: { p: ProspectoDetalle; accion: Accion }) {
  const [texto, setTexto] = useState('')
  return (
    <Bloque id="notas" titulo="Notas adicionales" icono={NotebookPen} cuenta={p.notas.length}>
      <form
        className="mb-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await accion(() => crearNotaApi(p.id, texto))) setTexto('')
        }}
      >
        <textarea
          aria-label="Nota nueva"
          className={`${inputCls} h-20 py-2`}
          maxLength={4000}
          placeholder="Acceso, horarios, permisos, lo que haga falta recordar…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">Las notas no se editan ni se borran: quedan con su autor y su fecha.</span>
          <Button size="sm" type="submit" disabled={!texto.trim()}>
            Agregar nota
          </Button>
        </div>
      </form>
      {p.notas.length === 0 ? (
        <Vacio>Sin notas todavía.</Vacio>
      ) : (
        <ul className={`${LISTA} space-y-2`}>
          {p.notas.map((n) => (
            <li key={n.id} className="rounded bg-surface-2 px-2.5 py-1.5">
              <div className="text-[11px] text-muted">
                {n.autorNombre ?? 'Usuario eliminado'} · {fecha(n.creadoEn)}
              </div>
              <p className="m-0 whitespace-pre-wrap text-[13px] text-ink">{n.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  )
}

// ─── El detalle ─────────────────────────────────────────────────────────────
function Detalle({ p, hoy, onCambio }: { p: ProspectoDetalle; hoy: Date; onCambio: (p: ProspectoDetalle) => void }) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setError(null), [p.id])
  const accion: Accion = async (fn) => {
    setError(null)
    try {
      onCambio(await fn())
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      return false
    }
  }
  const puedeFicha = !motivoEdicion(p.etapa, 'ficha')
  const puedeHijos = !motivoEdicion(p.etapa, 'hijos')
  const ultimo = p.avances.length ? p.avances[p.avances.length - 1] : null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-lg font-semibold text-ink">{p.nombre}</h2>
          <p className="m-0 text-[12px] text-muted">
            {[p.tipoEspacio, p.direccion].filter(Boolean).join(' · ') || 'Sin dirección'} · en seguimiento desde{' '}
            {fecha(p.creadoEn)}
            {p.vendedorNombre ? ` · ${p.vendedorNombre}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Estado etapa={p.etapa} />
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted" /> <Antiguedad p={p} hoy={hoy} />
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      )}
      {!puedeFicha && (
        <p className="m-0 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
          {motivoEdicion(p.etapa, 'ficha')}
        </p>
      )}

      <Bloque id="responsable" titulo="Búsqueda del responsable" icono={ShieldCheck}>
        <div className="overflow-x-auto pb-1">
          <Pasos p={p} accion={accion} puede={puedeFicha} />
        </div>
      </Bloque>

      {ultimo && (
        <div className="rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-[13px]">
          <div className="font-medium text-ink">
            Último contacto{ultimo.contactoNombre ? `: ${ultimo.contactoNombre}` : ''}{' '}
            <span className="font-normal text-muted">
              · {fecha(ultimo.creadoEn)}
              {ultimo.canal ? ` · ${ETIQUETA_CANAL[ultimo.canal]}` : ''}
            </span>
          </div>
          <p className="m-0 mt-0.5 text-ink">{ultimo.nota}</p>
          {p.siguientePaso && (
            <p className="m-0 mt-1 inline-flex items-start gap-1 text-ink">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" /> <strong>Siguiente paso:</strong>&nbsp;{p.siguientePaso}
            </p>
          )}
        </div>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <Ficha p={p} accion={accion} puede={puedeFicha} />
          <Competencia p={p} accion={accion} puede={puedeHijos} />
        </div>
        <div className="space-y-3">
          <Contactos p={p} accion={accion} puede={puedeHijos} />
          <Ubicacion p={p} accion={accion} puede={puedeFicha} />
        </div>
      </div>

      <Ofertas p={p} accion={accion} puede={puedeHijos} />

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Historial p={p} accion={accion} />
        <Notas p={p} accion={accion} />
      </div>
    </div>
  )
}

// ─── El alta ────────────────────────────────────────────────────────────────
function Alta({ abierto, onCerrar, onCreado }: { abierto: boolean; onCerrar: () => void; onCreado: (p: ProspectoDetalle) => void }) {
  const vacio = { tipo: 'PREDIO' as 'PREDIO' | 'PANTALLA', nombre: '', direccion: '', contacto: '', telefono: '', nota: '' }
  const [f, setF] = useState(vacio)
  const [error, setError] = useState<string | null>(null)
  async function guardar() {
    setError(null)
    try {
      const p = await crearProspectoApi({
        tipo: f.tipo,
        nombre: f.nombre,
        direccion: f.direccion.trim() || null,
        contacto: { nombre: f.contacto.trim() || null, telefono: f.telefono.trim() || null },
        datos: {},
        siguientePaso: null,
        siguientePasoFecha: null,
        nota: f.nota.trim() || null,
      })
      setF(vacio)
      onCreado(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de alta')
    }
  }
  return (
    <Sheet
      open={abierto}
      onOpenChange={(v) => !v && onCerrar()}
      title="Nuevo espacio"
      subtitle="Lo mínimo para empezar a darle seguimiento. La ficha, la ubicación y los contactos se completan después."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={!f.nombre.trim()}>
            Guardar
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <label className="block">
          <span className={labelCls}>Qué es</span>
          <select className={inputCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as 'PREDIO' | 'PANTALLA' })}>
            <option value="PREDIO">Un predio (muro, azotea, terreno)</option>
            <option value="PANTALLA">Una pantalla que ya existe</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Nombre</span>
          <input className={inputCls} maxLength={200} placeholder="Ej. Azotea Insurgentes 1420" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </label>
        <label className="block">
          <span className={labelCls}>Dirección</span>
          <input className={inputCls} maxLength={400} value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={labelCls}>Primer contacto</span>
            <input className={inputCls} maxLength={200} placeholder="Nombre" value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
          </label>
          <label className="block">
            <span className={labelCls}>Teléfono</span>
            <input className={inputCls} maxLength={40} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>Cómo surgió</span>
          <input className={inputCls} maxLength={2000} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} />
        </label>
      </div>
    </Sheet>
  )
}

// ─── La pantalla ────────────────────────────────────────────────────────────
export function ComercialOpex({ hoyIso }: { hoyIso: string }) {
  // La fecha llega del servidor para que «hace N días» salga igual en el HTML y
  // al hidratar: calcularla dos veces podía diferir por un día a medianoche.
  const hoy = useMemo(() => new Date(hoyIso), [hoyIso])
  const [espacios, setEspacios] = useState<Prospecto[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<ProspectoDetalle | null>(null)
  const [alta, setAlta] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await prospectosApi({ tipos: ['PREDIO', 'PANTALLA'], porPagina: 100 })
      setEspacios(r.prospectos)
      setTotal(r.total)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los espacios')
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const s = espacios ? espacioElegido(espacios, elegido) : null

  useEffect(() => {
    if (!s) {
      setDetalle(null)
      return
    }
    let vivo = true
    prospectoApi(s.id)
      .then((d) => vivo && setDetalle(d))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se pudo abrir el espacio'))
    return () => {
      vivo = false
    }
  }, [s?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const r = resumen(espacios ?? [], hoy)

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <CardColapsable id="comercial-opex.resumen" titulo="Resumen">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['En seguimiento', r.total, 'text-ink'],
              ['En negociación', r.enNegociacion, 'text-ink'],
              ['Activos', r.activos, 'text-ink'],
              ['Sin contacto +30 días', r.enfriados, r.enfriados ? 'text-red-600' : 'text-ink'],
            ] as const
          ).map(([etiqueta, valor, cls]) => (
            <div key={etiqueta} className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="text-[11px] text-muted">{etiqueta}</div>
              <div className={`text-2xl font-semibold ${cls}`}>{valor}</div>
            </div>
          ))}
        </div>
        {total > (espacios?.length ?? 0) && (
          <p className="m-0 mt-2 text-[11px] text-muted">
            Se muestran los {espacios?.length} con algo más reciente de {total}.
          </p>
        )}
      </CardColapsable>

      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
        <CardColapsable id="comercial-opex.espacios" titulo="Espacios en seguimiento" headerClassName="px-3 pt-3 pb-2" contentClassName="px-3 pb-3">
          <div className="mb-2">
            <Button size="sm" variant="success" className="w-full" onClick={() => setAlta(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nuevo espacio
            </Button>
          </div>
          {espacios && espacios.length === 0 && <Vacio>Todavía no hay espacios. Da de alta el primero.</Vacio>}
          <ul className={`${LISTA} space-y-1.5`}>
            {(espacios ?? []).map((e) => {
              const activo = s?.id === e.id
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setElegido(e.id)}
                    aria-current={activo ? 'true' : undefined}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      activo ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">{e.nombre}</span>
                      <Estado etapa={e.etapa} />
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted">
                      {[e.tipoEspacio, e.direccion].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted">
                        {e.vendedorNombre ?? '—'}
                        {e.visibilidad ? ` · ${ETIQUETA_VISIBILIDAD[e.visibilidad]}` : ''}
                      </span>
                      <Antiguedad p={e} hoy={hoy} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </CardColapsable>

        {/* Un <div> y no <main>: la pantalla ya vive dentro del <main> del shell. */}
        <div className="min-w-0">
          {detalle && s && detalle.id === s.id ? (
            <Detalle
              p={detalle}
              hoy={hoy}
              onCambio={(d) => {
                setDetalle(d)
                void cargar()
              }}
            />
          ) : null}
        </div>
      </div>

      <Alta
        abierto={alta}
        onCerrar={() => setAlta(false)}
        onCreado={(p) => {
          setAlta(false)
          setElegido(p.id)
          setDetalle(p)
          void cargar()
        }}
      />
    </div>
  )
}
