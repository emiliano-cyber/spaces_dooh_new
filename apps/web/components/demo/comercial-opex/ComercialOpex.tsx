'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Clock,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Swords,
  Users,
  Wallet,
} from 'lucide-react'
import {
  DOCUMENTOS_EMPRESA,
  ESPACIOS,
  ETAPAS_RESPONSABLE,
  ETIQUETA_ESTADO,
  diasSinContacto,
  espacioElegido,
  resumen,
  ultimoAvance,
  iniciales,
  type Espacio,
  type EstadoEspacio,
} from '@/lib/comercial-opex'

// ============================================================================
//  Comercial OPEX · prospección de arrendadores. MAQUETA, acomodada.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30: «acomoda de mejor manera el comercial opex».
//  Lista de espacios a la izquierda, detalle del elegido a la derecha.
//
//  SIGUE SIENDO MAQUETA: «por ahora solo será html sin funciones». Elegir qué
//  espacio mirar no guarda nada ni llama a la API; no hay formularios ni mapa.
//  Las cuentas (días sin contacto, a quién retomar) siguen en
//  `lib/comercial-opex.ts`, con pruebas.
//
//  ⚠️ `preflight` de Tailwind está DESACTIVADO en este proyecto
//  (`tailwind.config.ts:23`), así que un <ul> o un <ol> sale con las viñetas,
//  los números y la sangría del navegador. La primera versión de esta pantalla
//  no lo tuvo en cuenta y el dueño lo vio: números «1. 2.» encima de la línea
//  de tiempo y puntos sueltos fuera de los recuadros. TODA lista de aquí lleva
//  `LISTA`; si añades una, también.
// ============================================================================

const LISTA = 'm-0 list-none p-0'

const pesos = (n: number) => '$' + n.toLocaleString('es-MX')
const fecha = (f: string) =>
  new Date(f + 'T00:00:00Z').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const COLOR_ESTADO: Record<EstadoEspacio, string> = {
  negociacion: 'bg-amber-50 text-amber-900 border-amber-200',
  activo: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  inactivo: 'bg-surface-2 text-muted border-border',
}

function Estado({ estado }: { estado: EstadoEspacio }) {
  return (
    <span className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
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

function Antiguedad({ e, hoy }: { e: Espacio; hoy: Date }) {
  const d = diasSinContacto(e, hoy)
  // Sin bitácora NO se pinta un cero: se dice que no hay contacto.
  if (d === null) return <span className="text-muted">Sin contacto</span>
  const frio = e.estado === 'negociacion' && d > 30
  return (
    <span className={frio ? 'font-semibold text-red-600' : 'text-muted'}>
      {d === 0 ? 'hoy' : `hace ${d} d`}
    </span>
  )
}

function Bloque({
  titulo,
  icono: Icono,
  cuenta,
  children,
  className = '',
}: {
  titulo: string
  icono: typeof Users
  cuenta?: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-md border border-border bg-surface p-3 ${className}`}>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icono className="h-4 w-4 text-muted" strokeWidth={1.75} /> {titulo}
        {cuenta !== undefined && <span className="font-normal text-muted">({cuenta})</span>}
      </h3>
      {children}
    </section>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[13px] text-muted">{children}</p>
}

function Pasos({ etapa }: { etapa: number }) {
  return (
    <ol className={`${LISTA} flex flex-wrap items-start gap-y-2`} aria-label="Búsqueda del responsable">
      {ETAPAS_RESPONSABLE.map((nombre, i) => {
        const hecho = i < etapa
        const actual = i === etapa
        return (
          <li key={nombre} className="flex items-start">
            <div className="flex w-24 flex-col items-center text-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  hecho
                    ? 'border-success bg-success text-white'
                    : actual
                      ? 'border-accent bg-accent-soft text-ink'
                      : 'border-border bg-surface text-muted'
                }`}
              >
                {hecho ? '✓' : i + 1}
              </span>
              <span className={`mt-1 text-[11px] leading-tight ${actual ? 'font-medium text-ink' : hecho ? 'text-ink' : 'text-muted'}`}>
                {nombre}
              </span>
            </div>
            {i < ETAPAS_RESPONSABLE.length - 1 && (
              <span className={`mt-3 h-0.5 w-4 shrink-0 rounded-full ${hecho ? 'bg-success' : 'bg-border'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Contactos({ s }: { s: Espacio }) {
  return (
    <Bloque titulo="Responsables y contactos" icono={Users} cuenta={s.contactos.length}>
      {s.contactos.length === 0 ? (
        <Vacio>Todavía no se sabe con quién hablar.</Vacio>
      ) : (
        <ul className={`${LISTA} divide-y divide-border`}>
          {s.contactos.map((c) => (
            <li key={c.nombre} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-ink">
                {iniciales(c.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium text-ink">{c.nombre}</span>
                  {c.legal && (
                    <span className="rounded bg-ink px-1.5 text-[10px] font-medium text-surface">firma</span>
                  )}
                </div>
                <div className="text-[12px] text-muted">{c.papel}</div>
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
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  )
}

function Competencia({ s }: { s: Espacio }) {
  return (
    <Bloque titulo="Competencia" icono={Swords} cuenta={s.competencia.length}>
      {s.competencia.length === 0 ? (
        <Vacio>Sin competencia identificada.</Vacio>
      ) : (
        <ul className={`${LISTA} space-y-2`}>
          {s.competencia.map((c) => (
            <li key={c.nombre} className="rounded border-l-2 border-red-300 bg-surface-2 px-2.5 py-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-[13px] font-medium text-ink">{c.nombre}</span>
                <span className="text-[11px] text-muted">desde {fecha(c.desde)}</span>
              </div>
              <p className="m-0 text-[12px] text-ink">{c.nota}</p>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  )
}

function Historial({ s }: { s: Espacio }) {
  return (
    <Bloque titulo="Historial" icono={MessageSquare} cuenta={s.bitacora.length}>
      {s.bitacora.length === 0 ? (
        <Vacio>Sin contactos registrados.</Vacio>
      ) : (
        <ol className={`${LISTA} relative`}>
          {s.bitacora.map((a, i) => (
            <li key={a.fecha + a.contacto} className="relative pb-4 pl-6 last:pb-0">
              {/* La línea que une los puntos: no se pinta tras el último. */}
              {i < s.bitacora.length - 1 && (
                <span className="absolute bottom-0 left-[7px] top-4 w-px bg-border" aria-hidden="true" />
              )}
              <span
                className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 ${
                  i === 0 ? 'border-accent bg-accent' : 'border-border bg-surface'
                }`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-ink">{fecha(a.fecha)}</span>
                <Etiqueta>{a.canal}</Etiqueta>
                <span className="text-muted">con {a.contacto}</span>
              </div>
              <p className="m-0 mt-0.5 text-[13px] text-ink">{a.resumen}</p>
              {a.siguiente && (
                <p className="m-0 mt-1 inline-flex items-start gap-1 text-[12px] text-muted">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" /> {a.siguiente}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Bloque>
  )
}

function Documentos() {
  return (
    <Bloque titulo="Documentos de la empresa" icono={FileText} cuenta={DOCUMENTOS_EMPRESA.length}>
      <ul className={`${LISTA} divide-y divide-border`}>
        {DOCUMENTOS_EMPRESA.map((d) => (
          <li key={d.nombre} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
            <FileText className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={d.nombre}>
              {d.nombre}
            </span>
            <Etiqueta>{d.tipo}</Etiqueta>
            <span className="w-20 shrink-0 text-right text-[11px] text-muted">{fecha(d.actualizado)}</span>
          </li>
        ))}
      </ul>
    </Bloque>
  )
}

function Multimedia({ s }: { s: Espacio }) {
  return (
    <Bloque titulo="Fotos y videos del espacio" icono={ImageIcon} cuenta={s.multimedia.length}>
      {s.multimedia.length === 0 ? (
        <Vacio>Sin material todavía.</Vacio>
      ) : (
        <ul className={`${LISTA} grid grid-cols-2 gap-2 sm:grid-cols-3`}>
          {s.multimedia.map((m) => (
            <li
              key={m.nombre}
              className="flex aspect-video flex-col items-center justify-center gap-1 rounded border border-border bg-surface-2 px-2 text-center text-[11px] text-muted"
            >
              <span className="text-base leading-none">{m.tipo === 'video' ? '▶' : '▣'}</span>
              {m.nombre}
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  )
}

function Detalle({ s, hoy }: { s: Espacio; hoy: Date }) {
  const u = ultimoAvance(s)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-lg font-semibold text-ink">{s.nombre}</h2>
          <p className="m-0 text-[12px] text-muted">
            {s.tipo} · {s.direccion} · en seguimiento desde {fecha(s.desde)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Estado estado={s.estado} />
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted" /> <Antiguedad e={s} hoy={hoy} />
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-3">
        <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-muted" strokeWidth={1.75} /> Búsqueda del responsable
        </h3>
        <div className="overflow-x-auto pb-1">
          <Pasos etapa={s.etapa} />
        </div>
      </div>

      {u && (
        <div className="rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-[13px]">
          <div className="font-medium text-ink">
            Último contacto: {u.contacto}{' '}
            <span className="font-normal text-muted">
              · {fecha(u.fecha)} · {u.canal}
            </span>
          </div>
          <p className="m-0 mt-0.5 text-ink">{u.resumen}</p>
          {u.siguiente && (
            <p className="m-0 mt-1 text-ink">
              <strong>Siguiente paso:</strong> {u.siguiente}
            </p>
          )}
        </div>
      )}

      {/* Ficha y Competencia apiladas a la izquierda: así la columna de los
          contactos —la más larga— no deja un hueco vacío al lado. */}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <Bloque titulo="Ficha técnica" icono={Building2}>
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
              {(
                [
                  ['Medidas', s.medidas],
                  ['Negociante', s.negociante],
                  ['Renta autorizada', `${pesos(s.presupuesto.min)} – ${pesos(s.presupuesto.max)}`],
                  ['Autoriza', s.presupuesto.autoriza],
                ] as const
              ).map(([dt, dd]) => (
                <div key={dt}>
                  <dt className="text-[11px] text-muted">{dt}</dt>
                  <dd className="m-0 text-ink">{dd}</dd>
                </div>
              ))}
            </dl>
          </Bloque>
          <Competencia s={s} />
        </div>
        <Contactos s={s} />
      </div>

      <Bloque titulo="Ofertas de renta al arrendador" icono={Wallet} cuenta={s.ofertas.length}>
        {s.ofertas.length === 0 ? (
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
                {s.ofertas.map((o) => (
                  <tr key={o.version} className="border-t border-border align-top">
                    <td className="py-1.5 text-ink">v{o.version}</td>
                    <td className="py-1.5 text-muted">{fecha(o.fecha)}</td>
                    <td className="py-1.5 font-medium text-ink">{pesos(o.importe)}/mes</td>
                    <td className="py-1.5 text-muted">{o.plazoMeses} meses</td>
                    <td className="py-1.5 text-ink">
                      {o.estado}
                      {o.notas && <div className="text-[11px] text-muted">{o.notas}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloque>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Historial s={s} />
        <div className="space-y-3">
          <Multimedia s={s} />
          <Documentos />
        </div>
      </div>
    </div>
  )
}

export function ComercialOpex({ hoyIso }: { hoyIso: string }) {
  // La fecha llega del servidor para que «hace N días» salga igual en el HTML y
  // al hidratar: calcularla dos veces podía diferir por un día a medianoche.
  const hoy = useMemo(() => new Date(hoyIso), [hoyIso])
  const r = resumen(ESPACIOS, hoy)
  const [elegido, setElegido] = useState<string | null>(null)
  const s = espacioElegido(ESPACIOS, elegido)

  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-2">
          <h2 className="m-0 text-[13px] font-semibold text-ink">Espacios en seguimiento</h2>
          <ul className={`${LISTA} space-y-1.5`}>
            {ESPACIOS.map((e) => {
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
                      <Estado estado={e.estado} />
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted">
                      {e.tipo} · {e.direccion}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted">{e.negociante}</span>
                      <Antiguedad e={e} hoy={hoy} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Un <div> y no <main>: la pantalla ya vive dentro del <main> del shell. */}
        <div className="min-w-0">{s ? <Detalle s={s} hoy={hoy} /> : null}</div>
      </div>
    </div>
  )
}
