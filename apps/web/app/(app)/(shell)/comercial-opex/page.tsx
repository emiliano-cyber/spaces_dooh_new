import { Handshake } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import {
  DOCUMENTOS_EMPRESA,
  ESPACIOS,
  ETAPAS_RESPONSABLE,
  ETIQUETA_ESTADO,
  diasSinContacto,
  resumen,
  ultimoAvance,
  type Espacio,
} from '@/lib/comercial-opex'

// ============================================================================
//  Comercial OPEX · prospección de arrendadores. MAQUETA.
// ----------------------------------------------------------------------------
//  Pedido por Jochelo el 2026-09-30 desde un prototipo suyo: «por ahora solo
//  será html sin funciones» y «el mapa ese no lo añadas». Así que aquí NO hay
//  formularios, NO hay guardado, NO hay llamadas a la API y NO hay mapa.
//
//  Los datos y las dos cuentas que tiene —días sin contacto y a quién hay que
//  retomar— viven en `lib/comercial-opex.ts` CON PRUEBAS, porque dentro de un
//  `.tsx` no las comprobaría nadie: el arnés no monta DOM.
//
//  Se detalla el primer espacio porque una maqueta sin detalle no enseña la
//  forma. Sin interactividad no hay forma de elegir otro, y añadirla sería
//  justamente la «función» que se pidió dejar fuera.
// ============================================================================

const HOY = new Date()
const pesos = (n: number) => '$' + n.toLocaleString('es-MX')
const fecha = (f: string) =>
  new Date(f + 'T00:00:00Z').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })

function Antiguedad({ e }: { e: Espacio }) {
  const d = diasSinContacto(e, HOY)
  // Sin bitácora NO se pinta un cero: se dice que no hay contacto.
  if (d === null) return <span className="text-neutral-400">Sin contacto</span>
  const frio = e.estado === 'negociacion' && d > 30
  return (
    <span className={frio ? 'font-semibold text-red-600' : ''}>
      {d === 0 ? 'hoy' : `hace ${d} d`}
    </span>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-neutral-700">{titulo}</h3>
      {children}
    </section>
  )
}

export default function ComercialOpexPage() {
  const r = resumen(ESPACIOS, HOY)
  const s = ESPACIOS[0]

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Handshake className="h-5 w-5" />
        <div>
          <h1 className="text-lg font-semibold">Comercial OPEX</h1>
          <p className="text-xs text-neutral-500">
            Prospección de arrendadores: los espacios que se están persiguiendo, quién manda en cada
            uno y cómo va la negociación de su renta.
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Esto es una maqueta.</strong> Los datos son de ejemplo, no se guarda nada y no
            hay formularios. Sirve para acordar la forma antes de construirla.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            {[
              ['En seguimiento', r.total, ''],
              ['En negociación', r.enNegociacion, ''],
              ['Activos', r.activos, ''],
              ['Sin contacto +30 días', r.enfriados, 'text-red-600'],
            ].map(([etiqueta, valor, cls]) => (
              <div key={String(etiqueta)} className="rounded border border-neutral-200 px-3 py-2">
                <div className="text-[11px] text-neutral-500">{etiqueta}</div>
                <div className={`text-xl font-semibold ${cls}`}>{valor}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Seccion titulo="Espacios en seguimiento">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr>
                    <th className="pb-2">Espacio</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Negociante</th>
                    <th className="pb-2">Último contacto</th>
                    <th className="pb-2">Etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {ESPACIOS.map((e) => (
                    <tr key={e.id} className="border-t border-neutral-100">
                      <td className="py-2">
                        <div className="font-medium">{e.nombre}</div>
                        <div className="text-xs text-neutral-500">{e.tipo} · {e.direccion}</div>
                      </td>
                      <td className="py-2">{ETIQUETA_ESTADO[e.estado]}</td>
                      <td className="py-2">{e.negociante}</td>
                      <td className="py-2"><Antiguedad e={e} /></td>
                      <td className="py-2 text-xs">{ETAPAS_RESPONSABLE[e.etapa]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div>
            <h2 className="text-base font-semibold">{s.nombre}</h2>
            <p className="text-xs text-neutral-500">
              {s.tipo} · {s.direccion} · en seguimiento desde {fecha(s.desde)}
            </p>
          </div>

          <Seccion titulo="Búsqueda del responsable">
            <ol className="space-y-1 text-sm">
              {ETAPAS_RESPONSABLE.map((etapa, i) => (
                <li key={etapa} className={i <= s.etapa ? 'text-neutral-900' : 'text-neutral-400'}>
                  {i <= s.etapa ? '✓' : '○'} {etapa}
                </li>
              ))}
            </ol>
          </Seccion>

          <Seccion titulo="Ficha técnica">
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-neutral-500">Medidas</dt><dd>{s.medidas}</dd></div>
              <div>
                <dt className="text-xs text-neutral-500">Renta autorizada</dt>
                <dd>{pesos(s.presupuesto.min)} – {pesos(s.presupuesto.max)}</dd>
              </div>
              <div><dt className="text-xs text-neutral-500">Autoriza</dt><dd>{s.presupuesto.autoriza}</dd></div>
            </dl>
          </Seccion>

          <Seccion titulo="Responsables y contactos">
            <ul className="space-y-1 text-sm">
              {s.contactos.map((c) => (
                <li key={c.nombre} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-neutral-500">{c.papel}</span>
                  {c.legal && (
                    <span className="rounded bg-neutral-900 px-1.5 text-[11px] text-white">firma</span>
                  )}
                  {c.telefono && <span className="text-neutral-500">{c.telefono}</span>}
                  {c.email && <span className="text-neutral-500">{c.email}</span>}
                </li>
              ))}
            </ul>
          </Seccion>

          {s.competencia.length > 0 && (
            <Seccion titulo="Competencia">
              <ul className="space-y-1 text-sm">
                {s.competencia.map((c) => (
                  <li key={c.nombre}>
                    <span className="font-medium">{c.nombre}</span>{' '}
                    <span className="text-neutral-500">— {c.nota} ({fecha(c.desde)})</span>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          <Seccion titulo="Historial">
            {(() => {
              const u = ultimoAvance(s)
              return u ? (
                <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                  <div className="font-medium">Último contacto: {u.contacto}</div>
                  <div className="text-xs text-neutral-500">{fecha(u.fecha)} · {u.canal}</div>
                  <p className="mt-1">{u.resumen}</p>
                  {u.siguiente && <p className="mt-1"><strong>Siguiente paso:</strong> {u.siguiente}</p>}
                </div>
              ) : null
            })()}
            <ul className="space-y-2 text-sm">
              {s.bitacora.map((a) => (
                <li key={a.fecha} className="border-t border-neutral-100 pt-2">
                  <div className="text-xs text-neutral-500">{fecha(a.fecha)} · {a.canal} · {a.contacto}</div>
                  <p>{a.resumen}</p>
                  {a.siguiente && <p className="text-xs text-neutral-500">Siguiente: {a.siguiente}</p>}
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion titulo="Ofertas de renta al arrendador">
            {s.ofertas.length === 0 ? (
              <p className="text-sm text-neutral-500">Todavía no se le ha ofrecido nada.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr><th className="pb-1">Versión</th><th className="pb-1">Fecha</th><th className="pb-1">Renta</th><th className="pb-1">Plazo</th><th className="pb-1">Estado</th></tr>
                </thead>
                <tbody>
                  {s.ofertas.map((o) => (
                    <tr key={o.version} className="border-t border-neutral-100">
                      <td className="py-1">v{o.version}</td>
                      <td className="py-1">{fecha(o.fecha)}</td>
                      <td className="py-1">{pesos(o.importe)}/mes</td>
                      <td className="py-1">{o.plazoMeses} meses</td>
                      <td className="py-1">{o.estado}<div className="text-xs text-neutral-500">{o.notas}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Seccion>

          <Seccion titulo="Documentos de la empresa">
            <ul className="space-y-1 text-sm">
              {DOCUMENTOS_EMPRESA.map((d) => (
                <li key={d.nombre} className="text-neutral-700">
                  {d.nombre} <span className="text-xs text-neutral-500">· {d.tipo} · {fecha(d.actualizado)}</span>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion titulo="Fotos y videos del espacio">
            {s.multimedia.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin material todavía.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {s.multimedia.map((m) => (
                  <li key={m.nombre} className="text-neutral-700">
                    {m.tipo === 'video' ? '▶' : '▣'} {m.nombre}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </CardContent>
      </Card>
    </div>
  )
}
