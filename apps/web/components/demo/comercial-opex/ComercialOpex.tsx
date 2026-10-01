'use client'

import { useMemo, useState } from 'react'
import {
  Building2,
  Clock,
  FileText,
  Image as ImageIcon,
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
  type Espacio,
  type EstadoEspacio,
} from '@/lib/comercial-opex'

// ============================================================================
//  Comercial OPEX · prospección de arrendadores. MAQUETA, acomodada.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30: «acomoda de mejor manera el comercial opex».
//  Antes era una sola columna con el detalle SOLO del primer espacio y ocho
//  secciones apiladas. Ahora: lista a la izquierda, detalle del elegido a la
//  derecha, la búsqueda del responsable como barra de pasos, y el detalle en
//  bloques lado a lado.
//
//  SIGUE SIENDO MAQUETA: «por ahora solo será html sin funciones». Elegir qué
//  espacio mirar no guarda nada ni llama a la API; no hay formularios ni mapa.
//  Las cuentas (días sin contacto, a quién retomar) siguen en
//  `lib/comercial-opex.ts`, con pruebas.
// ============================================================================

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
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
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
  children,
  className = '',
}: {
  titulo: string
  icono: typeof Users
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-md border border-border bg-surface p-3 ${className}`}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icono className="h-4 w-4 text-muted" strokeWidth={1.75} /> {titulo}
      </h3>
      {children}
    </section>
  )
}

function Pasos({ etapa }: { etapa: number }) {
  return (
    <ol className="flex flex-wrap items-start gap-y-2" aria-label="Búsqueda del responsable">
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

function Detalle({ s, hoy }: { s: Espacio; hoy: Date }) {
  const u = ultimoAvance(s)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{s.nombre}</h2>
          <p className="text-[12px] text-muted">
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
            Último contacto: {u.contacto} <span className="font-normal text-muted">· {fecha(u.fecha)} · {u.canal}</span>
          </div>
          <p className="mt-0.5 text-ink">{u.resumen}</p>
          {u.siguiente && (
            <p className="mt-1 text-ink">
              <strong>Siguiente paso:</strong> {u.siguiente}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Bloque titulo="Ficha técnica" icono={Building2}>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <div>
              <dt className="text-[11px] text-muted">Medidas</dt>
              <dd className="text-ink">{s.medidas}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Negociante</dt>
              <dd className="text-ink">{s.negociante}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Renta autorizada</dt>
              <dd className="text-ink">
                {pesos(s.presupuesto.min)} – {pesos(s.presupuesto.max)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Autoriza</dt>
              <dd className="text-ink">{s.presupuesto.autoriza}</dd>
            </div>
          </dl>
        </Bloque>

        <Bloque titulo="Responsables y contactos" icono={Users}>
          <ul className="space-y-2 text-[13px]">
            {s.contactos.map((c) => (
              <li key={c.nombre}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-ink">{c.nombre}</span>
                  {c.legal && (
                    <span className="rounded bg-ink px-1.5 text-[10px] font-medium text-surface">firma</span>
                  )}
                </div>
                <div className="text-[12px] text-muted">{c.papel}</div>
                {(c.telefono || c.email) && (
                  <div className="flex flex-wrap gap-x-3 text-[12px] text-muted">
                    {c.telefono && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.telefono}
                      </span>
                    )}
                    {c.email && <span>{c.email}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Bloque>

        <Bloque titulo="Ofertas de renta al arrendador" icono={Wallet} className="lg:col-span-2">
          {s.ofertas.length === 0 ? (
            <p className="text-[13px] text-muted">Todavía no se le ha ofrecido nada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] text-muted">
                  <tr>
                    <th className="pb-1">Versión</th>
                    <th className="pb-1">Fecha</th>
                    <th className="pb-1">Renta</th>
                    <th className="pb-1">Plazo</th>
                    <th className="pb-1">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.ofertas.map((o) => (
                    <tr key={o.version} className="border-t border-border">
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

        <Bloque titulo="Historial" icono={MessageSquare}>
          {s.bitacora.length === 0 ? (
            <p className="text-[13px] text-muted">Sin contactos registrados.</p>
          ) : (
            <ol className="space-y-3 border-l border-border pl-3">
              {s.bitacora.map((a) => (
                <li key={a.fecha + a.contacto} className="relative">
                  <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                  <div className="text-[11px] text-muted">
                    {fecha(a.fecha)} · {a.canal} · {a.contacto}
                  </div>
                  <p className="text-[13px] text-ink">{a.resumen}</p>
                  {a.siguiente && <p className="text-[12px] text-muted">Siguiente: {a.siguiente}</p>}
                </li>
              ))}
            </ol>
          )}
        </Bloque>

        <div className="space-y-3">
          <Bloque titulo="Competencia" icono={Swords}>
            {s.competencia.length === 0 ? (
              <p className="text-[13px] text-muted">Sin competencia identificada.</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {s.competencia.map((c) => (
                  <li key={c.nombre}>
                    <span className="font-medium text-ink">{c.nombre}</span>{' '}
                    <span className="text-muted">— {c.nota} ({fecha(c.desde)})</span>
                  </li>
                ))}
              </ul>
            )}
          </Bloque>

          <Bloque titulo="Fotos y videos del espacio" icono={ImageIcon}>
            {s.multimedia.length === 0 ? (
              <p className="text-[13px] text-muted">Sin material todavía.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 text-[12px]">
                {s.multimedia.map((m) => (
                  <li
                    key={m.nombre}
                    className="flex aspect-video items-center justify-center rounded border border-border bg-surface-2 px-2 text-center text-muted"
                  >
                    {m.tipo === 'video' ? '▶ ' : '▣ '}
                    {m.nombre}
                  </li>
                ))}
              </ul>
            )}
          </Bloque>

          <Bloque titulo="Documentos de la empresa" icono={FileText}>
            <ul className="space-y-1 text-[13px]">
              {DOCUMENTOS_EMPRESA.map((d) => (
                <li key={d.nombre} className="text-ink">
                  {d.nombre} <span className="text-[11px] text-muted">· {d.tipo} · {fecha(d.actualizado)}</span>
                </li>
              ))}
            </ul>
          </Bloque>
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
          <h2 className="text-[13px] font-semibold text-ink">Espacios en seguimiento</h2>
          <ul className="space-y-1.5">
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
