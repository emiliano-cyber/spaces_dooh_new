'use client'

// ============================================================================
//  SeguimientoCampana — el rastreo de la campaña en la liga pública (`/p/[id]`).
// ----------------------------------------------------------------------------
//  Pedido del dueño (17/11): «tipo Mercado Libre». Lo lee el CLIENTE final, sin
//  sesión, casi siempre desde el teléfono. El orden sigue la investigación de
//  diseño del 17/11 (Baymard, parcelLab): primero el mensaje grande con la fecha
//  que le importa («¿cuándo sale?»), después la línea de pasos y al final el
//  detalle de su material (lonas / anuncios).
//
//  Reglas que no son de estilo:
//  · Los pasos y el mensaje llegan como CLAVE (`lib/seguimiento-campana.ts`); el
//    texto vive en `cuenta.seguimiento.*`, porque la liga se abre en el idioma
//    del navegador del cliente.
//  · El estado de un paso nunca se dice solo con color: lleva icono distinto y
//    palabra («Ahora», «Requiere atención»; «Completado»/«Pendiente» para el
//    lector de pantalla). Exactamente un `aria-current="step"`.
//  · Nada interno: ni folios de la orden de imprenta, ni siglas, ni importes, ni
//    el motivo de un rechazo (el motivo lo escribió el equipo para el equipo).
//  · El NOMBRE de la imprenta está oculto por omisión (decisión del dueño, 17/11:
//    revela que imprime un tercero); el servidor manda `proveedor: null` salvo
//    que el vendedor lo encienda. Ese es el caso NORMAL: sin «Imprime: —» ni
//    hueco; cuando llega el nombre, se dice una vez.
// ============================================================================

import { Check, AlertTriangle, CircleSlash, ChevronDown, Printer, MonitorPlay } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/client'
import { formatNumero } from '@/lib/formato-numero'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type {
  ClavePaso,
  EstadoPaso,
  EstatusCreativo,
  EstatusImprenta,
  PasoSeguimiento,
  Seguimiento,
  TipoCampanaSeg,
} from '@/lib/seguimiento-campana'

// El mensaje llega como texto libre desde el servidor: se traduce solo si es
// una clave conocida. Uno desconocido (servidor más nuevo que la página) cae en
// un genérico en vez de pintar la clave cruda.
const MENSAJES: Record<string, ClaveTexto> = {
  al_aire: 'cuenta.seguimiento.mensaje.al_aire',
  finalizada: 'cuenta.seguimiento.mensaje.finalizada',
  cancelada: 'cuenta.seguimiento.mensaje.cancelada',
  'material.rechazado': 'cuenta.seguimiento.mensaje.material.rechazado',
  'material.esperando-arte': 'cuenta.seguimiento.mensaje.material.esperando-arte',
  'material.imprenta': 'cuenta.seguimiento.mensaje.material.imprenta',
  'material.revision': 'cuenta.seguimiento.mensaje.material.revision',
  'material.hibrida': 'cuenta.seguimiento.mensaje.material.hibrida',
  'instalacion.montaje': 'cuenta.seguimiento.mensaje.instalacion.montaje',
  'instalacion.publicacion': 'cuenta.seguimiento.mensaje.instalacion.publicacion',
  'instalacion.hibrida': 'cuenta.seguimiento.mensaje.instalacion.hibrida',
}

// La etiqueta de «material» e «instalación» depende de lo que el cliente
// compró: a una campaña de pantallas no se le habla de imprenta.
const SUFIJO_TIPO: Record<TipoCampanaSeg, 'ooh' | 'dooh' | 'hibrida'> = { OOH: 'ooh', DOOH: 'dooh', HIBRIDA: 'hibrida' }
function clavePaso(clave: ClavePaso, tipo: TipoCampanaSeg): ClaveTexto {
  const s = SUFIJO_TIPO[tipo] ?? 'hibrida'
  if (clave === 'material') return `cuenta.seguimiento.paso.material.${s}`
  if (clave === 'instalacion') return `cuenta.seguimiento.paso.instalacion.${s}`
  return `cuenta.seguimiento.paso.${clave}`
}

const ESTADO_PASO: Record<EstadoPaso, ClaveTexto> = {
  hecho: 'cuenta.seguimiento.estado.hecho',
  actual: 'cuenta.seguimiento.estado.actual',
  alerta: 'cuenta.seguimiento.estado.alerta',
  pendiente: 'cuenta.seguimiento.estado.pendiente',
}

const ESTATUS_IMPRENTA: Record<EstatusImprenta, ClaveTexto> = {
  ARTE_RECIBIDO: 'cuenta.seguimiento.imprenta.estatus.arte-recibido',
  VALIDADO: 'cuenta.seguimiento.imprenta.estatus.validado',
  EN_PRODUCCION: 'cuenta.seguimiento.imprenta.estatus.en-produccion',
  IMPRESO: 'cuenta.seguimiento.imprenta.estatus.impreso',
  LISTO_MONTAJE: 'cuenta.seguimiento.imprenta.estatus.listo-montaje',
}

const ESTATUS_CREATIVO: Record<EstatusCreativo, { clave: ClaveTexto; tono: string }> = {
  PENDIENTE: { clave: 'cuenta.seguimiento.creativos.estatus.pendiente', tono: 'border-border bg-surface-2 text-muted' },
  VALIDADA: { clave: 'cuenta.seguimiento.creativos.estatus.validada', tono: 'border-[#10b98140] bg-[#10b9810d] text-[#0f7a55]' },
  RECHAZADA: { clave: 'cuenta.seguimiento.creativos.estatus.rechazada', tono: 'border-[#f59e0b40] bg-[#f59e0b1a] text-[#9a6700]' },
}

/** `YYYY-MM-DD` de hoy en la hora del navegador. */
function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SeguimientoCampana({
  seguimiento: s,
  hoy = hoyLocal(),
}: {
  seguimiento: Seguimiento
  /** Inyectable para que las pruebas no dependan del reloj (lección de `ocupacion-idioma`). */
  hoy?: string
}) {
  const { t, idioma } = useIdioma()
  const f = (iso: string) => formatFecha(iso, idioma)

  const alerta = s.pasos.some((p) => p.estado === 'alerta')
  const terminada = !s.cancelada && s.pasos.every((p) => p.estado === 'hecho')
  // Al aire = el paso «al aire» ya está hecho y el de «terminada» no.
  const alAire = !s.cancelada && !terminada && s.pasoActual === 'finalizada'
  // Instalada y esperando la fecha de arranque.
  const lista = !s.cancelada && s.pasoActual === 'al_aire'
  // Retraso DERIVADO, sin causa inventada: ya pasó el arranque y aún no está al
  // aire. Si el paso actual es el material detenido, manda el aviso del ajuste.
  const antesDelAire = !s.cancelada && ['aceptada', 'confirmada', 'material', 'instalacion', 'al_aire'].includes(s.pasoActual)
  const retraso = antesDelAire && !alerta && hoy > s.fechaInicio

  // En esos tres casos el banner se deriva de los PASOS y no de `s.mensaje`:
  // `armarSeguimiento` pone `mensaje = pasoActual`, así que con la campaña
  // corriendo (paso actual «finalizada») mandaría «terminó», y con la lona
  // montada esperando su fecha (paso actual «al_aire») mandaría «está al aire».
  // Los pasos no tienen esa ambigüedad.
  const mensaje = t(
    terminada
      ? 'cuenta.seguimiento.mensaje.finalizada'
      : alAire
        ? 'cuenta.seguimiento.mensaje.al_aire'
        : lista
          ? 'cuenta.seguimiento.mensaje.lista'
          : MENSAJES[s.mensaje] ?? 'cuenta.seguimiento.mensaje.preparando',
  )
  const sub = s.cancelada
    ? t('cuenta.seguimiento.sub.cancelada')
    : alerta
      ? t('cuenta.seguimiento.sub.rechazado')
      : terminada
        ? t('cuenta.seguimiento.sub.finalizada', { fecha: f(s.fechaFin) })
        : alAire
          ? t('cuenta.seguimiento.sub.al-aire', { fecha: f(s.fechaFin) })
          : retraso
            ? t('cuenta.seguimiento.sub.retraso', { fecha: f(s.fechaInicio) })
            : t('cuenta.seguimiento.sub.sale', { fecha: f(s.fechaInicio) })

  // Tono del banner: ámbar cuando algo espera al cliente o va tarde, verde al
  // aire o terminada, neutro en lo demás. Siempre con icono y texto: el color
  // solo refuerza.
  const tonoBanner = s.cancelada
    ? 'border-border bg-surface-2'
    : alerta || retraso
      ? 'border-[#f59e0b40] bg-[#f59e0b1a]'
      : alAire || terminada
        ? 'border-[#10b98140] bg-[#10b9810d]'
        : 'border-border bg-surface'

  const usaImprenta = s.tipo === 'OOH' || s.tipo === 'HIBRIDA'
  const usaCreativo = s.tipo === 'DOOH' || s.tipo === 'HIBRIDA'

  return (
    <section aria-labelledby="seguimiento-titulo" className="space-y-4">
      <div>
        <h1 id="seguimiento-titulo" className="text-2xl text-ink">{t('cuenta.seguimiento.titulo')}</h1>
        <p className="mt-1 text-[12px] text-muted">
          {/* El folio de CAMPAÑA sí se enseña: es el que el cliente cita al
              llamar. Los de la orden de imprenta o de trabajo, no. */}
          {s.folio ? <span className="demo-num">{t('cuenta.seguimiento.campana', { folio: s.folio })} · </span> : null}
          <span className="text-ink">{s.nombre}</span>
          {' · '}
          {t('reportes.rango', { desde: f(s.fechaInicio), hasta: f(s.fechaFin) })}
        </p>
      </div>

      {/* El banner: la respuesta a «¿cómo va?» en una línea y «¿cuándo?» en la
          segunda. `role="status"` para que el lector lo anuncie como estado. */}
      <div role="status" className={`flex items-start gap-3 rounded-md border p-4 ${tonoBanner}`}>
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            s.cancelada
              ? 'bg-surface text-muted'
              : alerta || retraso
                ? 'bg-surface text-[#9a6700]'
                : alAire || terminada
                  ? 'bg-surface text-[#0f7a55]'
                  : 'bg-accent text-accent-fg'
          }`}
        >
          {s.cancelada ? (
            <CircleSlash className="h-5 w-5" />
          ) : alerta || retraso ? (
            <AlertTriangle className="h-5 w-5" />
          ) : terminada ? (
            <Check className="h-5 w-5" />
          ) : usaImprenta && !usaCreativo ? (
            <Printer className="h-5 w-5" />
          ) : (
            <MonitorPlay className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold leading-snug text-ink">{mensaje}</p>
          <p className="mt-1 text-[13px] text-muted">{sub}</p>
        </div>
      </div>

      {/* Cancelada: estado terminal, sin pasos a medias. */}
      {!s.cancelada && (
        <Card>
          <CardHeader>
            <CardTitle>{t('cuenta.seguimiento.pasos')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineaPasos s={s} />
          </CardContent>
        </Card>
      )}

      {!s.cancelada && usaImprenta && <Lonas s={s} />}
      {!s.cancelada && usaCreativo && <Anuncios s={s} />}
    </section>
  )
}

// ─── La línea de pasos: vertical siempre ────────────────────────────────────
// Horizontal no cabe con seis pasos con texto a 375 px, y una sola forma en
// todos los anchos es más fácil de leer que dos.
function LineaPasos({ s }: { s: Seguimiento }) {
  const { t, idioma } = useIdioma()
  // Exactamente un paso «actual» para el lector de pantalla: el que el
  // servidor marca, o el último cuando todo terminó.
  const iActual = Math.max(0, s.pasos.findIndex((p) => p.clave === s.pasoActual))
  return (
    <ol role="list" className="relative">
      {s.pasos.map((p, i) => (
        <PasoFila
          key={p.clave}
          paso={p}
          etiqueta={t(clavePaso(p.clave, s.tipo))}
          estadoTexto={t(ESTADO_PASO[p.estado])}
          ultimo={i === s.pasos.length - 1}
          esActual={i === iActual}
          detalle={
            p.fecha
              ? formatFecha(p.fecha, idioma)
              : p.estado === 'alerta'
                ? t('cuenta.seguimiento.paso.alerta')
                : p.clave === 'al_aire'
                  ? t('cuenta.seguimiento.paso.previsto', { fecha: formatFecha(s.fechaInicio, idioma) })
                  : p.clave === 'finalizada'
                    ? t('cuenta.seguimiento.paso.previsto', { fecha: formatFecha(s.fechaFin, idioma) })
                    : null
          }
          extra={
            // El agregado de lonas va junto al paso en curso: es lo que contesta
            // «¿cuánto le falta?» sin abrir el detalle.
            p.clave === 'material' && p.estado !== 'hecho' && s.imprenta.length > 0 ? (
              <ResumenLonas listas={s.imprentaListas} total={s.imprenta.length} />
            ) : null
          }
        />
      ))}
    </ol>
  )
}

function PasoFila({
  paso,
  etiqueta,
  estadoTexto,
  detalle,
  extra,
  ultimo,
  esActual,
}: {
  paso: PasoSeguimiento
  etiqueta: string
  estadoTexto: string
  detalle: string | null
  extra: React.ReactNode
  ultimo: boolean
  esActual: boolean
}) {
  const e = paso.estado
  return (
    <li aria-current={esActual ? 'step' : undefined} className="relative flex gap-3 pb-5 last:pb-0">
      {/* El conector: sólido hasta donde se ha llegado, punteado lo que falta. */}
      {!ultimo && (
        <span
          aria-hidden="true"
          className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${
            e === 'hecho' ? 'bg-accent' : 'border-l-2 border-dotted border-border-strong bg-transparent'
          }`}
        />
      )}
      <span
        aria-hidden="true"
        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          e === 'hecho'
            ? 'bg-accent text-accent-fg'
            : e === 'actual'
              ? 'border-[3px] border-accent bg-surface'
              : e === 'alerta'
                ? 'border-2 border-[#d97706] bg-[#f59e0b1a] text-[#9a6700]'
                : 'border-2 border-border-strong bg-surface'
        }`}
      >
        {e === 'hecho' ? (
          <Check className="h-4 w-4" />
        ) : e === 'alerta' ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : e === 'actual' ? (
          <span className="h-2 w-2 rounded-full bg-accent" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[14px] ${e === 'actual' || e === 'alerta' ? 'font-semibold text-ink' : e === 'hecho' ? 'text-ink' : 'text-muted'}`}>
            {etiqueta}
          </span>
          {e === 'actual' || e === 'alerta' ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                e === 'alerta' ? 'border-[#f59e0b40] bg-[#f59e0b1a] text-[#9a6700]' : 'border-accent bg-surface text-ink'
              }`}
            >
              {estadoTexto}
            </span>
          ) : (
            <span className="sr-only">{estadoTexto}</span>
          )}
        </div>
        {detalle && (
          <div className={`mt-0.5 text-[12px] ${e === 'alerta' ? 'text-[#9a6700]' : 'text-muted'} ${e === 'pendiente' ? 'italic' : 'demo-num'}`}>
            {detalle}
          </div>
        )}
        {extra}
      </div>
    </li>
  )
}

/** «3 de 5 lonas impresas» con una barra segmentada: una muesca por lona. */
function ResumenLonas({ listas, total }: { listas: number; total: number }) {
  const { t, idioma } = useIdioma()
  return (
    <div className="mt-2 max-w-xs">
      <div className="text-[12px] font-medium text-ink">
        {t(total === 1 ? 'cuenta.seguimiento.imprenta.listas.uno' : 'cuenta.seguimiento.imprenta.listas.otros', {
          listas: formatNumero(listas, 0, idioma),
          n: formatNumero(total, 0, idioma),
        })}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-1">
        {Array.from({ length: Math.min(total, 20) }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < Math.round((listas / total) * Math.min(total, 20)) ? 'bg-accent' : 'bg-surface-2'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Las lonas (OOH / híbrida) ──────────────────────────────────────────────
function Lonas({ s }: { s: Seguimiento }) {
  const { t, idioma } = useIdioma()
  // Primero las más atrasadas: son las que explican por qué el paso no avanza.
  const ordenadas = [...s.imprenta].sort((a, b) => a.avance - b.avance)
  // El nombre de la imprenta llega solo si el vendedor lo encendió. Con UNA se
  // dice una vez arriba; con varias, en cada fila. Sin ninguna, nada.
  const unaSola = s.proveedores.length === 1 ? s.proveedores[0] : null
  const varias = s.proveedores.length > 1
  // Medidas como 12.9 × 7.2 m: sin decimales de relleno en las enteras.
  const num = (n: number) => formatNumero(n, Number.isInteger(n) ? 0 : Number.isInteger(n * 10) ? 1 : 2, idioma)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cuenta.seguimiento.imprenta.titulo')}</CardTitle>
        {unaSola && <p className="mt-0.5 text-[12px] text-muted">{t('cuenta.seguimiento.imprenta.proveedor', { proveedor: unaSola })}</p>}
      </CardHeader>
      <CardContent>
        {s.imprenta.length === 0 ? (
          <p className="text-[13px] text-muted">{t('cuenta.seguimiento.imprenta.vacia')}</p>
        ) : (
          <>
            <ResumenLonas listas={s.imprentaListas} total={s.imprenta.length} />
            <details className="group mt-3 rounded border border-border">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {s.imprenta.length === 1
                  ? t('cuenta.seguimiento.imprenta.ver.uno')
                  : t('cuenta.seguimiento.imprenta.ver.otros', { n: num(s.imprenta.length) })}
                <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {ordenadas.map((o, i) => {
                  const lista = o.estatus === 'IMPRESO' || o.estatus === 'LISTO_MONTAJE'
                  return (
                    <li key={i} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] text-ink">{o.sitioNombre || t('cuenta.seguimiento.imprenta.sin-sitio')}</div>
                          <div className="text-[11px] text-muted">
                            {[
                              o.ancho != null && o.alto != null
                                ? t('cuenta.seguimiento.imprenta.lona-medida', { ancho: num(o.ancho), alto: num(o.alto) })
                                : null,
                              o.material,
                              varias && o.proveedor ? t('cuenta.seguimiento.imprenta.proveedor', { proveedor: o.proveedor }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {o.pruebaColorAprobada && (
                            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#0f7a55]">
                              <Check aria-hidden="true" className="h-3 w-3" /> {t('cuenta.seguimiento.imprenta.prueba-color')}
                            </div>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            lista ? 'border-[#10b98140] bg-[#10b9810d] text-[#0f7a55]' : 'border-border bg-surface-2 text-muted'
                          }`}
                        >
                          {t(ESTATUS_IMPRENTA[o.estatus])}
                        </span>
                      </div>
                      <div aria-hidden="true" className="mt-2 h-1 w-full rounded-full bg-surface-2">
                        <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.round(o.avance * 100)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Los anuncios digitales (DOOH / híbrida) ────────────────────────────────
function Anuncios({ s }: { s: Seguimiento }) {
  const { t } = useIdioma()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cuenta.seguimiento.creativos.titulo')}</CardTitle>
      </CardHeader>
      <CardContent>
        {s.creativos.length === 0 ? (
          <p className="text-[13px] text-muted">{t('cuenta.seguimiento.creativos.vacia')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {s.creativos.map((c, i) => {
              const est = ESTATUS_CREATIVO[c.estatus] ?? ESTATUS_CREATIVO.PENDIENTE
              return (
                <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-ink">{c.nombre}</div>
                    {(c.formato || c.resolucion) && (
                      <div className="demo-num text-[11px] text-muted">{[c.formato, c.resolucion].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  {/* Rechazado se dice como «necesita un ajuste», en ámbar y sin
                      el motivo interno. */}
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${est.tono}`}>{t(est.clave)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
