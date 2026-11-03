'use client'

import { useEffect, useState } from 'react'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import { Radio, CalendarDays, Wallet, Coins, Receipt, Building2, MapPin, CircleHelp, CheckCircle2, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { AvisoFranjaCMS } from '@/components/demo/rejilla/AvisoFranjaCMS'
import { Button } from '@/components/demo/ui/Button'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { formatMonto, formatFecha, formatFechaHora } from '@/lib/data/client'
import { ubicacion } from '@/lib/ubicacion'
import { claveTipoMedio } from '@/components/demo/comercial/claves'
import { etiquetaTipoMedio } from '@/lib/tipo-medio'

const API = '/spaces-dooh/api'

interface ItemPub {
  // REJILLA-01 · la franja contratada (ADR 0039, Fase 1). `null` en casi todo:
  // solo la llevan las ventas que la usan.
  franjaId?: string | null
  franjaNombre?: string | null
  franjaHorario?: string | null
  sitioNombre: string
  alcaldia: string | null
  tipoMedio: string | null
  lat: number | null
  lng: number | null
  direccion: string | null
  ciudad: string | null
  estado: string | null
  fechaInicio: string
  fechaFin: string
  precio: number
  aprobado: boolean
}
interface PropuestaPub {
  // Membrete de quien emite. Esta página es lo ÚNICO de la plataforma que ve el
  // cliente final, y hasta ahora llegaba con la marca genérica: una cotización
  // sin remite. `orgLogoUrl` apunta a /api/logo/<token>, no a un data URL.
  orgNombre: string | null
  orgLogoUrl: string | null
  folio: string
  nombre: string
  estatus: string
  aceptadoEn: string | null
  aceptadoPor: string | null
  version: number
  clienteNombre: string | null
  agenciaNombre: string | null
  comisionPct: number
  descuentoPct: number
  descuentoMonto: number
  // VOL-01 · opcionales porque una liga guardada de antes de esta fase, o una
  // respuesta de un servidor más viejo, no los trae. Con la escala vacía llegan
  // en 0 y el renglón no se pinta.
  descuentoVolumenMonto?: number
  descuentoVolumenPct?: number
  // COD-01 · el CÓDIGO PROMOCIONAL (ADR 0039, Fase 3). Opcionales por lo
  // mismo: una liga guardada de antes de esta fase no los trae. Sin cupón
  // llegan en null/0 y el renglón no se pinta.
  codigoTexto?: string | null
  codigoDescuentoMonto?: number
  codigoDescuentoPct?: number
  // PAQ-01 · el PAQUETE CERRADO (ADR 0039, Fase 4). Opcional por lo mismo, y
  // `null` en toda venta que no lo use, que es el caso normal.
  //
  // Es la capa que MÁS falta hace en este documento: las otras tres son
  // descuentos que se pueden intuir mirando la resta; un precio de conjunto no
  // se intuye. Sin él, el cliente leería «Bruto 250 000» junto a un total de
  // 208 800 y la diferencia no cuadraría con ningún renglón.
  paquete?: {
    nombre: string
    precio: number
    admiteCodigo: boolean
    aplicadoEn: string | null
    composicion: string[] | null
    sitios: { sitioId: string; parte: number }[]
    aviso: string
    avisoComposicion?: string | null
  } | null
  divisor: number
  bruto: number
  base: number
  neto: number
  iva: number
  total: number
  itemsAprobados: number
  // PROP-COMPLETA (29/10) · hasta cuándo se puede aceptar y en qué términos.
  // Opcionales: un servidor anterior no los manda, y entonces la liga se ve
  // como antes (sin vigencia ni condiciones).
  vigenteHasta?: string | null
  vencida?: boolean
  condiciones?: string | null
  items: ItemPub[]
}

export default function PropuestaPublicaPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PropuestaPub | null | undefined>(undefined)
  // Aceptación del cliente (liga pública).
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorAcep, setErrorAcep] = useState<string | null>(null)
  const [aceptadaLocal, setAceptadaLocal] = useState<{ aceptadoEn: string; aceptadoPor: string } | null>(null)
  // I18N (lote cuenta, 2026-11-02) · la liga la abre el CLIENTE, con el idioma
  // de su navegador; las cifras pasan el idioma a `formatMonto` (ADR 0048).
  const { t, idioma } = useIdioma()
  const tipoMedioIngles = (tipo: string) => {
    const clave = claveTipoMedio(tipo)
    return clave ? t(clave) : etiquetaTipoMedio(tipo)
  }

  useEffect(() => {
    let vivo = true
    fetch(`${API}/propuestas/publica/${params.id}/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setData(d ?? null))
      .catch(() => vivo && setData(null))
    return () => {
      vivo = false
    }
  }, [params.id])

  async function aceptar() {
    if (!nombre.trim()) {
      setErrorAcep(t('cuenta.publica.error.nombre'))
      return
    }
    setEnviando(true)
    setErrorAcep(null)
    try {
      const r = await fetch(`${API}/propuestas/publica/${params.id}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErrorAcep(j.error ?? t('cuenta.publica.error.aceptar'))
        return
      }
      setAceptadaLocal({ aceptadoEn: j.aceptadoEn ?? new Date().toISOString(), aceptadoPor: j.aceptadoPor ?? nombre.trim() })
    } catch {
      setErrorAcep(t('cuenta.publica.error.aceptar'))
    } finally {
      setEnviando(false)
    }
  }

  if (data === undefined) {
    return (
      <div className="w-full px-6 py-10">
        <div className="h-64 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <CircleHelp className="mb-3 h-8 w-8 text-muted" />
        <h1 className="text-xl text-ink">{t('cuenta.comun.enlace-invalido')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('cuenta.publica.no-corresponde')}</p>
      </div>
    )
  }

  const p = data
  const ivaPct = p.base ? Math.round((p.iva / p.base) * 100) : 16
  const comisionPct = Math.round(100 - p.divisor * 100)
  // Estado de aceptación: local (recién aceptada) o el que trae la propuesta.
  const aceptada =
    aceptadaLocal ?? (p.aceptadoEn ? { aceptadoEn: p.aceptadoEn, aceptadoPor: p.aceptadoPor ?? '' } : null)
  // PROP-COMPLETA · vencida, el botón no se ofrece: el servidor la rechazaría
  // igual (`aceptarPropuestaPublica`), y es mejor decirlo antes de que teclee.
  const vencida = !aceptada && p.estatus === 'ENVIADA' && !!p.vencida
  const puedeAceptar = !aceptada && p.estatus === 'ENVIADA' && !vencida
  const desde = p.items.map((i) => i.fechaInicio).filter(Boolean).sort()[0]
  const hasta = p.items.map((i) => i.fechaFin).filter(Boolean).sort().at(-1)

  // Ubicación de las pantallas en el mapa.
  const puntos: MapPoint[] = p.items
    .filter((it) => it.lat != null && it.lng != null)
    .map((it, i) => ({
      id: `p-${i}`,
      lat: it.lat as number,
      lng: it.lng as number,
      tono: it.tipoMedio === 'PANTALLA_DIGITAL' ? 'azul' : 'verde',
      label: it.sitioNombre,
    }))

  return (
    <div className="min-h-screen bg-bg">
      {/* Header público */}
      <header className="border-b border-border bg-surface">
        <div className="flex w-full items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            {/* El logo de la organización si lo tiene; si no, la marca genérica.
                No se inventa un cuadro vacío: una organización sin logo se ve
                igual que antes, no peor. */}
            {p.orgLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.orgLogoUrl}
                alt={p.orgNombre ?? ''}
                className="h-10 w-10 shrink-0 rounded object-contain"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-accent text-accent-fg">
                <Radio className="h-5 w-5" />
              </span>
            )}
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold text-ink">
                {p.orgNombre || 'Spaces'}
              </div>
              <div className="text-[10px] text-muted">{t('cuenta.publica.subtitulo')}</div>
            </div>
          </div>
          {aceptada ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#10b98140] bg-[#10b9810d] px-2.5 py-1 text-[12px] font-medium text-[#0f7a55]">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('cuenta.publica.aceptada')}
            </span>
          ) : (
            <span className="text-[12px] text-muted">
              {puedeAceptar ? t('cuenta.publica.pendiente') : vencida ? t('cuenta.publica.vencida') : t('cuenta.publica.solo-lectura')}
            </span>
          )}
        </div>
      </header>

      <main className="w-full space-y-4 px-6 py-6">
        {/* Nombre + folio */}
        <div>
          <h1 className="text-2xl text-ink">{p.nombre}</h1>
          <p className="demo-num mt-1 text-[12px] text-muted">
            {p.folio}
            {p.vigenteHasta && p.estatus === 'ENVIADA' && !aceptada && (
              <span className={vencida ? 'text-error' : ''}>
                {' · '}
                {vencida ? t('cuenta.publica.vencio-el', { fecha: formatFecha(p.vigenteHasta, idioma) }) : t('cuenta.publica.valida-hasta', { fecha: formatFecha(p.vigenteHasta, idioma) })}
              </span>
            )}
          </p>
        </div>

        {/* Metadatos */}
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <Meta icon={<CalendarDays className="h-4 w-4" />} label={t('propuestas.ficha.meta.fechas')}
              value={desde && hasta ? `${formatFecha(desde, idioma)} – ${formatFecha(hasta, idioma)}` : '—'} />
            <Meta label={t('propuestas.ficha.meta.anunciante')} value={p.clienteNombre ?? t('propuestas.comun.sin-cliente')} />
            <Meta label={t('propuestas.comun.agencia')} value={p.agenciaNombre ?? t('propuestas.ficha.meta.directa')} />
            <Meta label={t('propuestas.ficha.meta.comision')} value={`${comisionPct}%`} />
          </div>
        </Card>

        {/* KPIs */}
        <Card>
          <CardHeader><CardTitle>{t('propuestas.ficha.resumen')}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={<Wallet className="h-4 w-4" />} tono="info" label={t('propuestas.ficha.kpi.total')} value={formatMonto(p.total, idioma)} />
              <Kpi icon={<Coins className="h-4 w-4" />} tono="success" label={t('propuestas.comun.neto')} value={formatMonto(p.neto, idioma)} />
              <Kpi icon={<Receipt className="h-4 w-4" />} tono="ambar" label={t('propuestas.comun.iva', { pct: ivaPct })} value={formatMonto(p.iva, idioma)} />
              <Kpi icon={<Building2 className="h-4 w-4" />} tono="neutro" label={t('cuenta.publica.kpi.sitios')} value={`${p.items.length}`} />
            </div>
          </CardContent>
        </Card>

        {/* Sitios */}
        <Card>
          <CardHeader><CardTitle>{t('cuenta.publica.sitios')}</CardTitle></CardHeader>
          <CardContent>
            {p.items.length === 0 ? (
              <p className="text-[13px] text-muted">{t('propuestas.ficha.sitios.vacia')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {p.items.map((it, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-ink">{it.sitioNombre}</div>
                      {/* REJILLA-01 · la franja CONTRATADA, con su horario. Un
                          importe sin las horas que compró deja al cliente sin
                          saber qué aceptó — y esta pantalla es exactamente donde
                          lo acepta. */}
                      {it.franjaId && (
                        <div className="text-[11px] font-medium text-amber-800">
                          {it.franjaNombre ?? it.franjaId}
                          {it.franjaHorario ? ` · ${it.franjaHorario}` : ''}
                        </div>
                      )}
                      {/* Ubicación completa: dirección + zona. Redundante con el
                          mapa a propósito — el cliente que abre la liga debe poder
                          situar la pantalla aunque los tiles no carguen. */}
                      <div className="flex items-start gap-1 text-[11px] text-muted">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          {it.direccion ? <span className="text-ink">{it.direccion}</span> : null}
                          {it.direccion && zonaDe(it) ? <br /> : null}
                          {zonaDe(it) ?? (it.direccion ? null : t('cuenta.publica.sin-ubicacion'))}
                          {/* Ola 5: en español el tipo va como siempre (el codigo); en ingles,
                              su etiqueta, porque «ESPECTACULAR» es una palabra española. */}
                          {it.tipoMedio ? ` · ${idioma === 'es' ? it.tipoMedio : tipoMedioIngles(it.tipoMedio)}` : ''}
                        </span>
                      </div>
                      {it.lat != null && it.lng != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${it.lat},${it.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-info hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="demo-num">
                            {it.lat.toFixed(5)}, {it.lng.toFixed(5)}
                          </span>
                        </a>
                      )}
                    </div>
                    <span className="demo-num shrink-0 text-[13px] text-ink">{formatMonto(it.precio, idioma)}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* REJILLA-01 · y el aviso, en la superficie que MÁS importa: ésta
                es la que ve el cliente y donde acepta. Enseñarle «Prime
                06:00–10:00» y no decirle que la programación no viaja sola al
                CMS sería mentirle por omisión justo al firmar. */}
            {p.items.some((it) => it.franjaId) && (
              <div className="mt-3">
                <AvisoFranjaCMS />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mapa con la ubicación de las pantallas. Si ningún sitio tiene
            coordenadas lo decimos en vez de ocultar la tarjeta en silencio: la
            dirección de cada pantalla sigue estando en la lista de arriba. */}
        <Card>
          <CardHeader><CardTitle>{t('propuestas.ficha.mapa')}</CardTitle></CardHeader>
          <CardContent>
            {puntos.length > 0 ? (
              <>
                <div className="h-[340px] w-full overflow-hidden rounded border border-border">
                  <MapView points={puntos} zoom={11} />
                </div>
                {puntos.length < p.items.length && (
                  <p className="mt-2 text-[11px] text-muted">
                    {t(p.items.length === 1 ? 'cuenta.publica.mapa.parcial.uno' : 'cuenta.publica.mapa.parcial.otros', {
                      faltan: p.items.length - puntos.length,
                      n: formatNumero(p.items.length),
                    })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted">
                {t('cuenta.publica.mapa.ninguna')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total */}
        <Card>
          <CardContent>
            <dl className="space-y-2 text-[13px]">
              <Fila label={t('propuestas.comun.bruto-lista')} valor={formatMonto(p.bruto, idioma)} />
              {/* PAQ-01 · EL PAQUETE VA PRIMERO, y no es cosmético: es lo único
                  de la cadena que no descuenta sino que SUSTITUYE, así que
                  tiene que leerse antes que cualquier resta. Pintado como
                  «Precio del paquete» y no como un descuento, porque llamarlo
                  descuento haría creer que el bruto de arriba sigue mandando.

                  Este objeto se arma A MANO en `obtenerPropuestaPublica`, campo
                  por campo: añadirlo a `armarPropuesta` NO basta para que
                  llegue hasta aquí — es el defecto que la Fase 2 encontró en
                  este mismo sitio revisando el diff y que la Fase 3 volvió a
                  encontrar. Esta vez tiene prueba propia. */}
              {p.paquete && (
                <>
                  <Fila
                    label={t('propuestas.comun.paquete-conjunto', { nombre: p.paquete.nombre })}
                    valor={formatMonto(p.paquete.precio, idioma)}
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {p.paquete.aviso}
                  </p>
                </>
              )}
              {/* VOL-01 · en la liga PÚBLICA es donde más importa: es el
                  documento que el cliente lee y acepta, y si el descuento por
                  volumen no figura, la cuenta de la cotización no da. */}
              {(p.descuentoVolumenMonto ?? 0) > 0 && (
                <Fila
                  label={t('propuestas.comun.descuento-volumen', { pct: Math.round((p.descuentoVolumenPct ?? 0) * 10) / 10 })}
                  valor={`− ${formatMonto(p.descuentoVolumenMonto ?? 0, idioma)}`}
                />
              )}
              {p.descuentoMonto > 0 && (
                <Fila label={t('propuestas.documento.descuento', { pct: p.descuentoPct })} valor={`− ${formatMonto(p.descuentoMonto, idioma)}`} />
              )}
              {/* COD-01 · y el código, CON SU NOMBRE. Es la superficie que ve el
                  cliente y el documento que acepta: si el cupón que se le
                  prometió no figura aquí, la cotización enseña un total más
                  bajo que su propia cuenta y sin decir por qué. Este objeto se
                  arma A MANO en `obtenerPropuestaPublica`, campo por campo:
                  añadirlo a `armarPropuesta` NO basta para que llegue hasta
                  aquí — es el defecto que la Fase 2 encontró en este mismo
                  sitio revisando el diff, no corriendo pruebas. */}
              {(p.codigoDescuentoMonto ?? 0) > 0 && (
                <Fila
                  label={t('propuestas.comun.codigo-pct', { codigo: p.codigoTexto ?? '', pct: p.codigoDescuentoPct ?? 0 })}
                  valor={`− ${formatMonto(p.codigoDescuentoMonto ?? 0, idioma)}`}
                />
              )}
              <Fila label={t('propuestas.documento.comision', { pct: comisionPct })} valor={`− ${formatMonto(p.base - p.neto, idioma)}`} />
              <Fila label={t('propuestas.comun.neto')} valor={formatMonto(p.neto, idioma)} />
              <Fila label={t('propuestas.comun.iva', { pct: ivaPct })} valor={formatMonto(p.iva, idioma)} />
              <div className="mt-1 border-t border-border pt-2">
                <Fila label={t('propuestas.ficha.total')} valor={formatMonto(p.total, idioma)} fuerte />
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* PROP-COMPLETA (29/10) · los términos que el cliente acepta junto con
            el total. Antes del botón, a propósito: se aceptan después de leerlos. */}
        {p.condiciones && (
          <Card>
            <CardHeader>
              <CardTitle>{t('propuestas.condiciones.terminos')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-[13px] text-ink">{p.condiciones}</p>
            </CardContent>
          </Card>
        )}

        {/* Aceptación del cliente (cierra el loop de venta) */}
        {aceptada ? (
          <Card className="border-[#10b98140] bg-[#10b9810d]">
            <CardContent>
              <div className="flex items-start gap-3 py-1">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#0f7a55]" />
                <div>
                  <div className="text-[15px] font-semibold text-ink">{t('cuenta.publica.aceptada.titulo')}</div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    {aceptada.aceptadoPor
                      ? t('cuenta.publica.aceptada.detalle-por', { quien: aceptada.aceptadoPor, fecha: formatFechaHora(aceptada.aceptadoEn, idioma) })
                      : t('cuenta.publica.aceptada.detalle', { fecha: formatFechaHora(aceptada.aceptadoEn, idioma) })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : puedeAceptar ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('cuenta.publica.aceptas')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-muted">
                {t(p.items.length === 1 ? 'cuenta.publica.al-aceptar.uno' : 'cuenta.publica.al-aceptar.otros', {
                  n: p.items.length,
                  total: formatMonto(p.total, idioma),
                })}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={t('cuenta.publica.tu-nombre')}
                  className="h-10 flex-1 rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <Button onClick={aceptar} disabled={enviando} className="shrink-0">
                  <CheckCircle2 className="h-4 w-4" /> {enviando ? t('cuenta.publica.aceptando') : t('cuenta.publica.aceptar')}
                </Button>
              </div>
              {errorAcep && <p className="mt-2 text-[12px] text-error">{errorAcep}</p>}
            </CardContent>
          </Card>
        ) : vencida ? (
          <Card className="border-[#ef444440]">
            <CardContent>
              <p className="py-1 text-[13px] text-ink">
                {t('cuenta.publica.vencida.detalle', { fecha: formatFecha(p.vigenteHasta as string, idioma) })}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <p className="pb-4 text-center text-[11px] text-muted">
          {t('cuenta.publica.pie')}{puedeAceptar || aceptada ? '' : t('cuenta.publica.pie.solo-lectura')}
        </p>
      </main>
    </div>
  )
}

// "Alcaldía · Ciudad · Estado" sin separadores huérfanos cuando falta un campo
// y sin repetir la alcaldía cuando `ciudad` trae el mismo valor (plaza_ciudad).
// La regla vive en @/lib/ubicacion: nació aquí y la ficha interna la necesitaba
// igual, pero como estaba suelta en esta página aquélla imprimía "null".
function zonaDe(it: ItemPub): string | null {
  return ubicacion([it.alcaldia, it.ciudad, it.estado], ' · ') || null
}

function Meta({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        {icon}{label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-ink" title={value}>{value}</div>
    </div>
  )
}

const KPI_TONO: Record<string, string> = {
  info: 'bg-[#0a66ff1a] text-info',
  success: 'bg-[#10b9811a] text-[#0f7a55]',
  ambar: 'bg-[#f59e0b1a] text-[#9a6700]',
  neutro: 'bg-surface-2 text-muted',
}
function Kpi({ icon, tono, label, value }: { icon: React.ReactNode; tono: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${KPI_TONO[tono] ?? KPI_TONO.neutro}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="demo-num truncate text-[16px] font-semibold text-ink">{value}</div>
      </div>
    </div>
  )
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`demo-num ${fuerte ? 'font-semibold text-ink' : 'text-ink'}`}>{valor}</dd>
    </div>
  )
}
