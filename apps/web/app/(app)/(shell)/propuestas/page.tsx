'use client'

import { toast } from 'sonner'
import { conteo } from '@/lib/plural'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, FileText, Send, Check, X, ChevronDown, ChevronRight, Monitor, Square, List, Map as MapIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { AvisoFranjaCMS } from '@/components/demo/rejilla/AvisoFranjaCMS'
import { catalogoRejillaApi, type FranjaUI, type TemporadaUI } from '@/lib/data/rejilla-api'
import { modalidadesDeSitio, tarifaCalculada } from '@/lib/tarifa-calculada'
import {
  CALCULADORA_POR_OMISION,
  DIAS_DEL_MES,
  SEGUNDOS_POR_HORA,
  duracionSpotSeg,
  horasDeHorario,
  horasPorOmision,
  loopDeLaLinea,
  previsualizarCalculadora,
  rotacionesPorHora,
  tarifaBaseCalculadora,
  tarifaConPrima,
  tarifaMensualDeSitio,
} from '@/lib/calculadora-spots'
import { resolverVolumen } from '@/lib/volumen'
import { escalasVolumenApi, type TramoVolumenUI } from '@/lib/data/volumen-api'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { MapView } from '@/components/demo/MapView'
import { pinTono } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { TableroPropuestas } from '@/components/demo/propuestas/TableroPropuestas'
import {
  usePropuestas,
  useFunnelPropuestas,
  useClientes,
  useSitios,
  useCampanas,
  useContratos,
  useArrendadores,
  useReservas,
  useConfigNegocio,
  clientesEnPantalla,
  cupoDePantalla,
  formatMonto,
  formatMontoCorto,
  divisorDeComision,
  type Propuesta,
  type EstPropuesta,
  type FunnelPropuestas,
} from '@/lib/data/client'
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { withTrail } from '@/lib/nav-trail'
import { crearPropuestaApi, cambiarEstatusPropuestaApi, aprobarItemPropuestaApi, generarCampanaDesdePropuestaApi, ConfirmacionCeroError } from '@/lib/data/estado-api'
import {
  UNIDADES,
  unidadCorta,
  cantidadEfectiva,
  diasInclusivos,
  precioItem,
  periodosEnRango,
  fechaFinDesde,
  esCantidadManual,
  type Unidad,
} from '@/lib/periodos'
import { PERIODICIDADES, factorMensual } from '@/lib/renta-periodicidad'

// Periodicidades de la renta al propietario (enum `periodicidad_pago` en la BD)
// y su equivalencia a mensual: ambas vienen de lib/renta-periodicidad.ts, la
// misma tabla que usa el P&L. Aquí había una copia con MENSUAL y ANUAL al
// frente "porque son las que más se usan"; el precio de ese orden era que cada
// periodicidad nueva había que acordarse de añadirla también aquí.
const PERIODICIDADES_RENTA = PERIODICIDADES

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const EST: Record<EstPropuesta, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'border-border text-muted' },
  ENVIADA: { label: 'Enviada', cls: 'border-[#0a66ff40] text-info' },
  APROBADA: { label: 'Aprobada', cls: 'border-[#10b98140] text-[#0f7a55]' },
  RECHAZADA: { label: 'Rechazada', cls: 'border-[#ef444440] text-error' },
}

export default function PropuestasPage() {
  const propuestas = usePropuestas()
  const funnel = useFunnelPropuestas()
  const puedeEditar = usePuede('comercial', 'crear')
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Propuestas</h1>
          <p className="mt-1 text-[13px] text-muted">Cotizaciones con método del divisor (bruto / neto)</p>
        </div>
        {puedeEditar && (
          <Button variant="success" size="sm" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva propuesta
          </Button>
        )}
      </div>

      {/* Cómo va el periodo: generadas, aprobadas, rechazadas y ganancia (06/10). */}
      <TableroPropuestas />

      {funnel && funnel.total > 0 && <FunnelStrip f={funnel} />}

      {!propuestas ? (
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      ) : propuestas.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">Aún no hay propuestas.</p>
      ) : (
        <ul className="space-y-3">
          {propuestas.map((p) => (
            <PropuestaCard
              key={p.id}
              p={p}
              abierta={abierta === p.id}
              onToggle={() => setAbierta(abierta === p.id ? null : p.id)}
              puedeEditar={puedeEditar}
            />
          ))}
        </ul>
      )}

      {nuevoOpen && <NuevaPropuestaDialog onClose={() => setNuevoOpen(false)} />}
    </div>
  )
}

function PropuestaCard({
  p, abierta, onToggle, puedeEditar,
}: { p: Propuesta; abierta: boolean; onToggle: () => void; puedeEditar: boolean }) {
  const clientes = useClientes()
  const sitios = useSitios()
  const campanas = useCampanas()
  const cliente = clientes?.find((c) => c.id === p.clienteId)
  const agencia = clientes?.find((c) => c.id === p.agenciaId)
  // Campaña ya generada desde esta propuesta (si existe): deshabilita el botón
  // de crear campaña y ofrece verla.
  const campanaGenerada = campanas?.find((c) => c.propuestaId === p.id) ?? null
  const est = EST[p.estatus]
  const router = useRouter()
  const [generando, setGenerando] = useState(false)

  // ADR 0008 · pantallas de esta propuesta que ya tienen su cupo de clientes
  // lleno en las fechas propuestas, para un cliente que no está entre ellos.
  // Mismo cálculo que aplica el servidor al reservar (`clientesEnPantalla`).
  const reservas = useReservas()
  const config = useConfigNegocio()
  const sinCupo = useMemo(() => {
    const m = new Map<string, string>()
    if (!sitios || !reservas || !campanas || !clientes) return m
    const nombrePorCliente = new Map(clientes.map((c) => [c.id, c.nombre]))
    for (const it of p.items) {
      const s = sitios.find((x) => x.id === it.sitioId)
      if (!s) continue
      const cupo = cupoDePantalla(s, config)
      if (cupo == null) continue
      // Las fechas van POR ITEM: cada pantalla de la propuesta puede ir en un
      // periodo distinto, y el cupo se mide contra el suyo.
      const desde = new Date(it.fechaInicio).getTime()
      const hasta = new Date(it.fechaFin).getTime()
      if (isNaN(desde) || isNaN(hasta)) continue
      const ocupantes = clientesEnPantalla({ reservas, campanas }, s.id, desde, hasta)
      if (ocupantes.includes(p.clienteId ?? '')) continue // el cliente ya está: cabe
      if (ocupantes.length >= cupo) {
        m.set(it.sitioId, ocupantes.map((id) => nombrePorCliente.get(id) ?? '—').join(', '))
      }
    }
    return m
  }, [p, sitios, reservas, campanas, clientes, config])

  async function cambiar(estatus: EstPropuesta, confirmarCero = false) {
    try {
      await cambiarEstatusPropuestaApi(p.id, estatus, confirmarCero)
    } catch (e) {
      if (e instanceof ConfirmacionCeroError) {
        if (window.confirm(`${e.message}\n\n¿Aprobar de todas formas?`)) return cambiar(estatus, true)
        return
      }
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }
  async function generarCampana() {
    setGenerando(true)
    try {
      const camp = await generarCampanaDesdePropuestaApi(p.id)
      if (camp?.id) router.push(`/campanas/${camp.id}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    setGenerando(false)
  }
  async function aprobar(itemId: string, aprobado: boolean) {
    try { await aprobarItemPropuestaApi(itemId, aprobado) } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
            {abierta ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="demo-num text-[12px] text-muted">{p.folio}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${est.cls}`}>{est.label}</span>
                {p.version > 1 && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted">v{p.version}</span>
                )}
                {p.descuentoPct > 0 && (
                  <span className="rounded-full border border-[#f59e0b40] px-1.5 py-0.5 text-[10px] font-medium text-[#9a6700]">−{p.descuentoPct}%</span>
                )}
                {/* COD-03 · la marca de la lista: hay un cupón esperando a que
                    alguien con `comercial.aprobar` lo decida. Sin ella, el
                    gerente tendría que abrir propuesta por propuesta para saber
                    qué le toca aprobar — y mientras tanto el cliente ve la
                    cotización sin el descuento que el vendedor le ofreció. */}
                {p.codigoEstado === 'PENDIENTE' && (
                  <span
                    title={`El código ${p.codigoTexto ?? ''} espera aprobación; el cliente todavía no lo ve`}
                    className="rounded-full border border-[#f59e0b40] bg-[#f59e0b14] px-1.5 py-0.5 text-[10px] font-medium text-[#9a6700]"
                  >
                    Cupón pendiente
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[14px] font-medium text-ink">{p.nombre}</div>
              <div className="text-[12px] text-muted">
                {cliente?.nombre ?? 'Sin cliente'}
                {agencia ? <> · vía <span className="text-ink">{agencia.nombre}</span></> : ''}
                {' '}· {conteo(p.items.length, 'sitio')}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="demo-num text-[15px] font-semibold text-ink">{formatMonto(p.total)}</div>
              <div className="text-[11px] text-muted">total c/IVA</div>
            </div>
            <Link
              href={withTrail(`/propuestas/${p.id}`, [{ label: 'Propuestas', href: '/propuestas' }])}
              className="inline-flex items-center gap-1 rounded border border-border-strong px-2.5 py-1.5 text-[12px] font-medium text-info hover:bg-surface-2"
            >
              Abrir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {abierta && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {/* Presupuesto (método del divisor) */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
              <Dato label="Bruto (lista)" valor={formatMonto(p.bruto)} />
              <Dato label={`Comisión ${(100 - p.divisor * 100).toFixed(0)}% · divisor ${p.divisor.toFixed(2)}`} valor={`× ${p.divisor.toFixed(2)}`} />
              <Dato label="Neto propuesto" valor={formatMonto(p.neto)} />
              <Dato label={`IVA ${p.bruto ? Math.round((p.iva / p.bruto) * 100) : 16}%`} valor={formatMonto(p.iva)} />
            </div>
            {/* Neto vs aprobado (aprobación granular) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#10b98133] bg-[#10b9810d] px-3 py-2 text-[12px]">
              <span className="font-medium text-ink">Aprobado · {p.itemsAprobados}/{conteo(p.items.length, 'sitio')}</span>
              <span className="text-muted">
                Neto aprobado <b className="demo-num text-[#0f7a55]">{formatMonto(p.netoAprobado)}</b>
                {' '}de {formatMonto(p.neto)} · Total <b className="demo-num text-ink">{formatMonto(p.totalAprobado)}</b>
              </span>
            </div>
            {/* Items con aprobación sitio por sitio */}
            <ul className="divide-y divide-border rounded-md border border-border">
              {p.items.map((it) => {
                const s = sitios?.find((x) => x.id === it.sitioId)
                return (
                  <li key={it.id} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                    <label className="flex min-w-0 items-center gap-2">
                      {puedeEditar && (
                        <input
                          type="checkbox"
                          checked={it.aprobado}
                          onChange={(e) => aprobar(it.id, e.target.checked)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      )}
                      <span className={`truncate ${it.aprobado ? 'text-ink' : 'text-muted'}`}>{s?.nombre ?? it.sitioId}</span>
                      {it.aprobado && (
                        <span className="rounded-full border border-[#10b98140] px-1.5 text-[10px] text-[#0f7a55]">aprobado</span>
                      )}
                      {/* ADR 0008: AVISO, no bloqueo. Una propuesta es una
                          intención comercial y el inventario puede liberarse
                          antes de cerrarla; el bloqueo duro vive en la reserva.
                          Pero saberlo aquí evita prometer una pantalla que no
                          se va a poder entregar. */}
                      {sinCupo.has(it.sitioId) && (
                        <span
                          className="rounded-full border border-[#f59e0b66] bg-warning-soft px-1.5 text-[10px] text-[#9a6700]"
                          title={`La pantalla ya tiene su cupo de clientes en estas fechas (${sinCupo.get(it.sitioId)}). Al reservar se rechazará salvo que se libere o se suba el cupo.`}
                        >
                          cupo lleno
                        </span>
                      )}
                    </label>
                    <span className="demo-num text-muted">{formatMonto(it.precio)}</span>
                  </li>
                )
              })}
            </ul>
            {/* Acciones de estatus */}
            {puedeEditar && (
              <div className="flex flex-wrap gap-2">
                {p.estatus === 'BORRADOR' && (
                  <Button size="sm" variant="primary" onClick={() => cambiar('ENVIADA')}><Send className="h-3.5 w-3.5" /> Enviar</Button>
                )}
                {(p.estatus === 'ENVIADA' || p.estatus === 'BORRADOR') && (
                  <>
                    <Button size="sm" onClick={() => cambiar('APROBADA')}><Check className="h-3.5 w-3.5" /> Aprobar</Button>
                    <Button size="sm" variant="danger" onClick={() => cambiar('RECHAZADA')}><X className="h-3.5 w-3.5" /> Rechazar</Button>
                  </>
                )}
                {p.estatus === 'APROBADA' && (
                  campanaGenerada ? (
                    <>
                      <Button size="sm" disabled title="Esta propuesta ya generó su campaña">
                        <Check className="h-3.5 w-3.5" /> Campaña generada
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/campanas/${campanaGenerada.id}`)}>
                        Ver campaña
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" disabled={generando} onClick={generarCampana}>
                      <ChevronRight className="h-3.5 w-3.5" /> {generando ? 'Generando…' : 'Generar campaña'}
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </li>
  )
}

// ─── Nueva propuesta (builder con divisor en vivo) ───────────────────────────
function NuevaPropuestaDialog({ onClose }: { onClose: () => void }) {
  const clientes = useClientes()
  const sitios = useSitios()
  // Para la captura de renta: saber qué pantalla ya tiene contrato y a qué
  // propietarios se puede asignar.
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const [clienteId, setClienteId] = useState('')
  const [agenciaId, setAgenciaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [comision, setComision] = useState('0')

  // Agencias = clientes tipo AGENCIA (una agencia se asocia a un cliente directo).
  const agencias = (clientes ?? []).filter((c) => c.tipo === 'AGENCIA')

  // La comisión viene de la AGENCIA seleccionada (no del cliente).
  function aplicarAgencia(agId: string) {
    setAgenciaId(agId)
    const ag = clientes?.find((c) => c.id === agId)
    setComision(String(ag?.comisionAgenciaPct ?? 0))
  }
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  // Duración de la campaña: N + unidad. Con la fecha "Desde" completa la fecha
  // "Hasta" automáticamente, con la MISMA cuenta que el precio: meses de
  // calendario desde el 2026-10-02 (`lib/periodos.ts`), semanas de 7 y catorcenas de 14.
  const [duracionN, setDuracionN] = useState('1')
  const [duracionUnidad, setDuracionUnidad] = useState<Unidad>('mensual')
  const [sel, setSel] = useState<Set<string>>(new Set())
  // Cómo elegir los sitios: lista (por default) o mapa. Se alterna con el switch.
  const [vistaSitios, setVistaSitios] = useState<'lista' | 'mapa'>('lista')
  // Zona dibujada en el mapa (polígono [lng,lat][]) o null si no hay. Cuando hay
  // zona, el mapa solo muestra las pantallas de dentro (y las autoselecciona).
  const [zona, setZona] = useState<[number, number][] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Completa "Hasta" cuando cambia "Desde" o la duración.
  // Con duración inválida (0 o negativa) se LIMPIA "Hasta" en vez de dejar el
  // valor anterior. El `if (fin)` de antes solo asignaba cuando el cálculo daba
  // algo, así que al teclear -2 la fecha vieja se quedaba en pantalla y parecía
  // que el sistema había aceptado la duración negativa (C-2 de la auditoría).
  useEffect(() => {
    const n = parseInt(duracionN, 10)
    if (!fechaInicio || !Number.isFinite(n) || n <= 0) {
      setFechaFin('')
      return
    }
    setFechaFin(fechaFinDesde(fechaInicio, duracionUnidad, n))
  }, [fechaInicio, duracionN, duracionUnidad])

  // Al cerrar una zona en el mapa, la selección pasa a ser EXACTAMENTE las
  // pantallas de dentro del polígono: se descartan todas las de fuera.
  useEffect(() => {
    if (!zona) return
    const dentro = (sitios ?? [])
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && puntoEnPoligono([s.lng, s.lat], zona))
      .map((s) => s.id)
    setSel(new Set(dentro))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona])

  // Configuración por sitio: unidad de contratación, cantidad manual (spot/hora)
  // y programación de spots/día. Todo por sitioId; los que no estén aquí usan su
  // primera modalidad publicada (o mensual).
  // `renta*`: lo que se le paga al PROPIETARIO por esa pantalla (el costo).
  // Capturarlo aquí hace que el contrato nazca completo al generar la campaña,
  // en vez de como pendiente sin importe (ADR 0001).
  type CfgSitio = {
    unidad: Unidad; cantidadManual: number; spotsPorDia: string
    rentaMonto: string; rentaPeriodicidad: string; rentaArrendadorId: string
    // REJILLA-01 · la franja CONTRATADA (ADR 0039, Fase 1). Cadena vacía = sin
    // franja, que es como se ha vendido todo hasta hoy y como se sigue
    // vendiendo por omisión.
    franjaId: string
    // PRECIO-01 · el precio por unidad que pone A MANO un gerente o superior.
    // Cadena vacía = a la tarifa calculada, que es el caso normal y el ÚNICO
    // posible para un vendedor.
    tarifaManual: string
    // ADR 0042 · la CALCULADORA DE SPOTS, solo para pantalla digital por spot.
    // `manual` = el vendedor la apagó y captura la cantidad a mano, como antes.
    // `espacios` y `horasDia` son texto porque son lo que se teclea; `horasDia`
    // vacío = las de la franja o el horario. `prima` solo la toca un gerente.
    manual: boolean
    espacios: string
    horasDia: string
    roadblock: boolean
    prima: string
  }
  const [cfg, setCfg] = useState<Record<string, CfgSitio>>({})

  // REJILLA-01 · el catálogo de la organización. Se pide UNA vez al abrir el
  // cuadro, no por pantalla: es el mismo para todo el inventario.
  //
  // Si la petición falla o el dueño no ha capturado ninguna franja, esto se
  // queda vacío y el selector NO SE PINTA — vender sigue funcionando igual.
  // Es el invariante 1: la rejilla no puede ser un requisito para vender.
  const [franjas, setFranjas] = useState<FranjaUI[]>([])
  const [temporadas, setTemporadas] = useState<TemporadaUI[]>([])
  useEffect(() => {
    let vivo = true
    catalogoRejillaApi()
      .then((d) => {
        if (!vivo) return
        setFranjas(d.franjas)
        setTemporadas(d.temporadas)
      })
      .catch(() => {
        /* Sin catálogo se vende como siempre: no es un error que deba verse. */
      })
    return () => {
      vivo = false
    }
  }, [])

  // VOL-01 · la escala de volumen, SOLO para PREVISTA (ADR 0039, Fase 2).
  //
  // Quien decide el descuento que se guarda es el SERVIDOR: lo resuelve al
  // crear la propuesta leyendo `escalas_volumen` bajo RLS, y nada de lo que
  // salga de esta pantalla puede cambiarlo. Esto está aquí para que quien vende
  // vea el número ANTES de cerrar — cotizar de viva voz un total y guardar otro
  // es la peor manera de enterarse de que hay un descuento.
  //
  // Se usa la MISMA función que el servidor (`resolverVolumen`), así que las
  // dos no pueden divergir salvo por los datos; y si divergieran, manda lo que
  // se guardó.
  const [escalaVolumen, setEscalaVolumen] = useState<TramoVolumenUI[]>([])
  useEffect(() => {
    let vivo = true
    escalasVolumenApi()
      .then((t) => {
        if (vivo) setEscalaVolumen(t)
      })
      .catch(() => {
        /* Sin escala se vende como siempre: no es un error que deba verse. */
      })
    return () => {
      vivo = false
    }
  }, [])

  // Modalidades publicadas de un sitio: [{unidad, tarifa}]. Si no tiene, ofrece
  // una mensual sintética con su tarifa publicada, para no bloquear. Vive en
  // `lib/tarifa-calculada.ts` desde PRECIO-01: el servidor usa la misma.
  const modalidadesDe = (s: any) => modalidadesDeSitio(s)

  // PRECIO-01 · solo `comercial.aprobar` (gerente de ventas y superiores) puede
  // poner un precio distinto de la tarifa calculada. El servidor lo exige igual
  // (`propuestas-controller.ts`) y es quien manda; esto solo evita ofrecerle a
  // un vendedor un campo cuyo valor el servidor le iba a rechazar.
  const puedeAjustarTarifa = usePuede('comercial', 'aprobar')

  const cfgDe = (s: any): CfgSitio => cfg[s.id] ?? {
    unidad: modalidadesDe(s)[0].unidad,
    cantidadManual: 1,
    spotsPorDia: '',
    // Sin franja POR OMISIÓN, y es deliberado: preseleccionar «la primera»
    // haría que toda venta saliera con una franja que nadie eligió, y encima
    // con la advertencia del CMS encima.
    franjaId: '',
    tarifaManual: '',
    ...CALC_POR_OMISION,
    ...(({ monto, per, arr }) => ({
      rentaMonto: monto, rentaPeriodicidad: per, rentaArrendadorId: arr,
    }))(rentaPrevia(s)),
  }

  /**
   * La tarifa CALCULADA de una pantalla para una unidad, ya resuelta por la
   * rejilla. La temporada se DEDUCE de la fecha de inicio de la propuesta, no
   * se elige: es una propiedad del calendario, no del trato.
   *
   * PRECIO-01 · es `tarifaCalculada()` de `lib/tarifa-calculada.ts`, la MISMA
   * función con la que el servidor comprueba el precio. Antes la regla estaba
   * escrita aquí dentro y el servidor no la conocía; si ahora se escribiera
   * aquí con una regla y allí con otra, el vendedor vería un número, lo
   * mandaría, y recibiría «solo un gerente puede cambiar la tarifa» sin haber
   * tocado nada. `tarifa-calculada.test.ts` fija que da lo mismo que daba esto.
   *
   * Sin rejilla capturada devuelve la tarifa base, o sea lo de siempre.
   */
  const tarifaCalculadaDe = (s: any, unidad: Unidad, franjaId?: string) =>
    tarifaCalculada({ sitio: s, unidad, franjaId: franjaId || null, temporadas, fechaInicio })

  // PRECIO-01 · la tarifa que de verdad se COTIZA: la manual del gerente si la
  // puso, la calculada en cualquier otro caso. Un vendedor no tiene campo, así
  // que para él es siempre la calculada.
  const tarifaManualDe = (c: CfgSitio): number | null => {
    if (!puedeAjustarTarifa || c.tarifaManual.trim() === '') return null
    const n = Number(c.tarifaManual)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  // ─── ADR 0042 · la CALCULADORA DE SPOTS ─────────────────────────────────
  // La cuenta es `previsualizarCalculadora()` de `lib/calculadora-spots.ts`, la
  // MISMA con la que el servidor recalcula la cantidad y rechaza la que no
  // cuadre. Aquí solo se enseña antes de mandar; quien decide es el servidor.
  const config = useConfigNegocio()
  // `tipo_medio`, no `exhibicion`: es el criterio con el que el servidor y la
  // campaña deciden si una pantalla tiene loop (`spotsDeLaReserva`).
  const conLoop = (s: any) => s.tipoMedio === 'PANTALLA_DIGITAL'
  const usaCalcDe = (s: any) => {
    const c = cfgDe(s)
    return conLoop(s) && c.unidad === 'spot' && !c.manual
  }
  const franjaDe = (c: CfgSitio) => (c.franjaId ? franjas.find((f) => f.id === c.franjaId) ?? null : null)
  // La prima solo cuenta si la pone alguien con `comercial.aprobar`: para el
  // vendedor el campo está deshabilitado y la prima es 0, que es lo único que
  // el servidor le acepta.
  const primaDe = (s: any): number => {
    const c = cfgDe(s)
    if (!usaCalcDe(s) || !c.roadblock || !puedeAjustarTarifa) return 0
    const n = Number(c.prima)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  // ADR 0043 · los anunciantes de HOY: las campañas vigentes. El inventario da
  // libres = total − campañas (`listarSitios`), así que total − libres es el
  // MISMO conteo que lee el servidor (`datosDelLoop.campanasActivas`). Con otro,
  // el loop saldría distinto y el servidor rechazaría la cantidad.
  const ocupadosDe = (s: any): number | null =>
    s.totalSpots != null && s.spotsDisponibles != null ? Math.max(0, Number(s.totalSpots) - Number(s.spotsDisponibles)) : null
  const calcDe = (s: any) => {
    if (!usaCalcDe(s)) return null
    const c = cfgDe(s)
    const num = (t: string) => (t.trim() === '' ? null : Number(t))
    return previsualizarCalculadora({
      digital: true,
      unidad: 'spot',
      totalSpots: s.totalSpots ?? null,
      duracionSeg: duracionSpotSeg(s.duracionSpotSeg, config?.spotSeg),
      horasMaximas: horasPorOmision({ franja: franjaDe(c), horario: s.horario }),
      // Lo que enseña el inventario: total − campañas vigentes.
      libres: s.spotsDisponibles ?? null,
      ocupados: ocupadosDe(s),
      dias: diasInclusivos(fechaInicio, fechaFin),
      espaciosComprados: c.roadblock ? null : num(c.espacios),
      horasDia: num(c.horasDia),
      roadblock: c.roadblock,
      primaRoadblockPct: c.roadblock ? primaDe(s) : null,
    })
  }

  // ADR 0043 · la tarifa BASE de una línea: con calculadora, la tarifa mensual
  // repartida entre los spots del loop (`tarifaBaseCalculadora`, la MISMA que
  // usa el servidor); sin ella, la de la modalidad, como siempre.
  //
  // El loop se cuenta aquí aunque falten las fechas: el precio por spot no
  // depende de los días, y sin esto la línea diría «sin tarifa» cuando lo
  // único que falta es el periodo.
  const tarifaBaseDe = (s: any): { tarifa: number; calculable: boolean } => {
    const c = cfgDe(s)
    if (!usaCalcDe(s)) return tarifaCalculadaDe(s, c.unidad, c.franjaId)
    const total = Number(s.totalSpots ?? 0)
    const loop = loopDeLaLinea({
      totalSpots: total,
      ocupados: ocupadosDe(s),
      espacios: c.roadblock ? total : Math.max(1, Math.floor(Number(c.espacios) || 1)),
      roadblock: c.roadblock,
    })
    return tarifaBaseCalculadora({
      sitio: s,
      franjaId: c.franjaId || null,
      temporadas,
      fechaInicio,
      loop,
      duracionSeg: duracionSpotSeg(s.duracionSpotSeg, config?.spotSeg),
      horasOperacion: horasDeHorario(s.horario).horas,
      roadblock: c.roadblock,
    })
  }

  const tarifaCotizadaDe = (s: any): number => {
    const c = cfgDe(s)
    const manual = tarifaManualDe(c)
    if (manual != null) return manual
    const base = tarifaBaseDe(s).tarifa
    // ADR 0042 · un Roadblock con prima: calculada × (1 + prima), una vez. El
    // servidor espera exactamente este número (`decidirPrecioCalculadora`).
    const prima = primaDe(s)
    return prima > 0 ? tarifaConPrima(base, prima) : base
  }

  // Cantidad efectiva (periodos del rango para unidades de tiempo; manual para
  // spot/hora; la de la calculadora para una digital por spot) y precio
  // (tarifa × cantidad) de un sitio con su configuración.
  const cantidadDe = (s: any): number => {
    const calc = calcDe(s)
    if (calc) return calc.ok ? calc.cantidad : 0
    const c = cfgDe(s)
    return cantidadEfectiva(c.unidad, fechaInicio, fechaFin, c.cantidadManual)
  }
  const precioDe = (s: any): number => {
    return precioItem(tarifaCotizadaDe(s), cantidadDe(s))
  }
  // Contrato REAL que ya cubre esa pantalla. Ojo: la renta se pacta por INMUEBLE
  // y se reparte entre las pantallas del predio (derive.ts ·
  // rentaAtribuidaPorSitio), así que hay que mirar también el contrato del
  // predio — buscar solo por sitio_id haría que a una pantalla cuyo predio ya
  // tiene contrato se le volviera a pedir la renta, invitando a contradecir lo
  // pactado. Un contrato INCOMPLETO no cuenta: es el hueco que esto viene a
  // cerrar.
  const contratoVigenteDe = (s: any) =>
    (contratos ?? []).find(
      (c) =>
        (c.sitioId === s.id || (s.predioId && c.predioId === s.predioId)) &&
        c.estatus !== 'INCOMPLETO' &&
        c.estatus !== 'CANCELADO',
    )
  const tieneContrato = (s: any) => !!contratoVigenteDe(s)

  // Autollenado de la renta, por orden de fiabilidad:
  //   1. Lo ya capturado en su propio contrato incompleto (alguien avanzó).
  //   2. Los campos directos del sitio (renta_arrendador/periodicidad_renta):
  //      están DEPRECADOS a favor del contrato, pero siguen con datos en varias
  //      pantallas y es mejor proponerlos que dejar el campo vacío.
  //   3. Vacío, con el arrendador del sitio si lo tiene.
  // Siempre es una PROPUESTA editable: nada se guarda sin que el usuario lo vea.
  const rentaPrevia = (s: any): { monto: string; per: string; arr: string } => {
    const inc = (contratos ?? []).find((c) => c.sitioId === s.id && c.estatus === 'INCOMPLETO')
    if (inc?.montoRenta != null) {
      return {
        monto: String(inc.montoRenta),
        per: inc.periodicidad ?? 'MENSUAL',
        arr: inc.arrendadorId ?? s.arrendadorId ?? '',
      }
    }
    if (s.rentaArrendador != null && Number(s.rentaArrendador) > 0) {
      return {
        monto: String(s.rentaArrendador),
        per: String(s.periodicidadRenta ?? 'MENSUAL').toUpperCase(),
        arr: s.arrendadorId ?? '',
      }
    }
    // Con un único propietario en la organización, proponerlo: obligar a
    // elegirlo de una lista de uno solo invita a dejarlo vacío, y sin él el
    // contrato nace pendiente aunque el importe sí se haya capturado.
    const unico = (arrendadores ?? []).length === 1 ? arrendadores![0].id : ''
    return { monto: '', per: 'MENSUAL', arr: s.arrendadorId ?? unico }
  }

  // Renta capturada a medias: hay importe pero falta el propietario (o al revés).
  // Con eso el contrato no puede nacer completo.
  const rentaIncompleta = (s: any) => {
    const c = cfgDe(s)
    const monto = Number(c.rentaMonto) || 0
    return (monto > 0 && !c.rentaArrendadorId) || (monto <= 0 && !!c.rentaArrendadorId)
  }
  // Señal de que el campo se entendió mal: si la renta que se paga al
  // propietario iguala o supera lo que se le cobra al cliente, la campaña sale a
  // pérdida. En la práctica suele ser que se tecleó ahí el precio de la campaña.
  const rentaSospechosa = (s: any) => {
    const c = cfgDe(s)
    const renta = Number(c.rentaMonto) || 0
    return renta > 0 && renta >= precioDe(s)
  }

  const rentaMensualDe = (s: any) => {
    const c = cfgDe(s)
    return Math.round((Number(c.rentaMonto) || 0) * factorMensual(c.rentaPeriodicidad))
  }

  const setCfgSitio = (id: string, patch: Partial<CfgSitio>) => {
    const s = (sitios ?? []).find((x) => x.id === id)
    const base = s ? cfgDe(s) : { unidad: 'mensual' as Unidad, cantidadManual: 1, spotsPorDia: '', rentaMonto: '', rentaPeriodicidad: 'MENSUAL', rentaArrendadorId: '', franjaId: '', tarifaManual: '', ...CALC_POR_OMISION }
    setCfg((prev) => ({ ...prev, [id]: { ...base, ...prev[id], ...patch } }))
  }

  const seleccionados = (sitios ?? []).filter((s) => sel.has(s.id))
  const bruto = seleccionados.reduce((acc, s) => acc + precioDe(s), 0)
  // VOL-01 · la PREVISTA del volumen, línea a línea y con el mismo redondeo que
  // el servidor (`volumenDeLineas`). Con la escala vacía da 0 y el total de
  // abajo es exactamente el de antes de esta fase.
  const volumenMonto = seleccionados.reduce((acc, s) => {
    const c = cfgDe(s)
    const v = resolverVolumen(
      escalaVolumen.filter((t) => t.unidad === c.unidad),
      cantidadDe(s),
    )
    return acc + (v.descuentoPct > 0 ? Math.round(precioDe(s) * (v.descuentoPct / 100)) : 0)
  }, 0)
  const brutoConVolumen = bruto - volumenMonto
  const divisor = divisorDeComision(Number(comision))
  const neto = Math.round(brutoConVolumen * divisor)
  const ivaPctSel = clientes?.find((c) => c.id === clienteId)?.ivaPct ?? 16
  const iva = Math.round(brutoConVolumen * (ivaPctSel / 100))
  const total = brutoConVolumen + iva
  // Gate de negociación: si la agencia tiene negociación sin validar, se bloquea.
  const agenciaSel = clientes?.find((c) => c.id === agenciaId)
  const negociacionPendiente = !!agenciaSel?.tieneNegociacion && !agenciaSel?.negociacionValidada

  // Validación de dominio en el CLIENTE, con el mismo criterio que el servidor
  // (propuestas-controller: comisión 0–100, fechaFin ≥ fechaInicio). El servidor
  // ya rechazaba estos casos, pero el formulario los aceptaba y dejaba el botón
  // habilitado: el usuario solo se enteraba al guardar (C-2 de la auditoría).
  const comisionNum = Number(comision)
  const errComision =
    comision.trim() === '' || !Number.isFinite(comisionNum)
      ? 'Escribe un porcentaje de comisión (0 si no hay).'
      : comisionNum < 0
        ? 'La comisión no puede ser negativa.'
        : comisionNum >= 100
          ? 'La comisión debe ser menor que 100%: al 100% el neto de la propuesta sería cero.'
          : null
  const duracionNum = parseInt(duracionN, 10)
  const errDuracion =
    !Number.isFinite(duracionNum) || duracionNum <= 0 ? 'La duración debe ser de al menos 1 periodo.' : null
  const errFechas =
    fechaInicio && fechaFin && new Date(fechaFin) < new Date(fechaInicio)
      ? 'La fecha de fin no puede ser anterior a la de inicio.'
      : null
  // ADR 0042 · una línea de la calculadora que el servidor rechazaría (más
  // espacios que los libres, horas de más, un Roadblock sin el loop entero…) se
  // avisa AQUÍ y deja el botón inerte, con el MISMO motivo que daría él: la
  // misma función produce los dos textos.
  const errCalculadora =
    fechaInicio && fechaFin && !errFechas
      ? (() => {
          for (const s of seleccionados) {
            const p = calcDe(s)
            if (p && !p.ok) return `${s.nombre}: ${p.motivo}`
          }
          return null
        })()
      : null
  const errFormulario = errComision ?? errDuracion ?? errFechas ?? errCalculadora

  const valido =
    !!nombre.trim() && !!fechaInicio && !!fechaFin && sel.size > 0 && !negociacionPendiente && !errFormulario

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function guardar() {
    if (!valido) return
    setGuardando(true)
    setError(null)
    try {
      await crearPropuestaApi({
        clienteId: clienteId || null,
        agenciaId: agenciaId || null,
        nombre: nombre.trim(),
        comisionPct: Number(comision) || 0,
        fechaInicio,
        fechaFin,
        items: seleccionados.map((s) => {
          const c = cfgDe(s)
          const spots = parseInt(c.spotsPorDia, 10)
          const renta = Number(c.rentaMonto) || 0
          // ADR 0042 · la línea de la calculadora manda sus parámetros y la
          // cantidad que salió de ellos; el servidor la vuelve a calcular y
          // rechaza una distinta.
          const pc = calcDe(s)
          const calc = pc && pc.ok ? pc : null
          return {
            sitioId: s.id,
            unidad: c.unidad,
            // PRECIO-01 · la calculada, o la del gerente. El servidor la vuelve
            // a calcular y rechaza una distinta si quien la manda no puede.
            tarifaUnitaria: tarifaCotizadaDe(s),
            // REJILLA-01 · la franja CONTRATADA. `null` y no cadena vacía: el
            // servidor la valida contra el catálogo activo de la organización y
            // una cadena vacía no es un identificador, es «no hay».
            franjaId: c.franjaId || null,
            // Solo relevante para spot/hora; el servidor la ignora en unidades de tiempo.
            cantidad: calc ? calc.cantidad : c.cantidadManual,
            spotsPorDia: calc ? calc.spotsDia : Number.isFinite(spots) && spots > 0 ? spots : null,
            ...(calc
              ? {
                  espaciosComprados: calc.espaciosComprados,
                  horasDia: calc.horasDia,
                  roadblock: calc.roadblock,
                  primaRoadblockPct: calc.primaRoadblockPct,
                }
              : {}),
            // Renta al propietario. Solo viaja si hay importe: el servidor exige
            // importe y periodicidad juntos, y sin arrendador el contrato no
            // puede salir de INCOMPLETO.
            rentaMonto: renta > 0 ? renta : null,
            rentaPeriodicidad: renta > 0 ? c.rentaPeriodicidad : null,
            rentaArrendadorId: renta > 0 && c.rentaArrendadorId ? c.rentaArrendadorId : null,
          }
        }),
      })
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear la propuesta'
      setError(msg)
      toast.error(msg) // notificación (sonner), además del aviso en el pie del modal
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Nueva propuesta"
      subtitle="Selecciona sitios; el método del divisor calcula bruto → neto"
      footer={
        <div className="flex items-center justify-between">
          {/* El error del servidor manda; si no lo hay, se avisa del problema de
              validación local antes de que el usuario pulse un botón inerte. */}
          {error ? <span className="text-[12px] text-error">{error}</span> : errFormulario ? (
            <span className="text-[12px] text-error">{errFormulario}</span>
          ) : (
            <span className="text-[12px] text-muted">
              {/* El renglón del volumen aparece SOLO cuando lo hay, y tiene que
                  aparecer: sin él, el total no cuadra con la suma de los
                  renglones de arriba y se lee como un defecto. */}
              {volumenMonto > 0 && (
                <>
                  Volumen: <b className="demo-num text-ink">− {formatMonto(volumenMonto)}</b>
                  {' · '}
                </>
              )}
              Total c/IVA: <b className="demo-num text-ink">{formatMonto(total)}</b>
            </span>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="success" size="sm" disabled={!valido || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Crear propuesta'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Nombre de la propuesta">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Cliente">
            <select
              className={inputCls}
              value={clienteId}
              onChange={(e) => {
                const id = e.target.value
                setClienteId(id)
                // Precarga la agencia asociada al cliente; la comisión viene de ella.
                const c = clientes?.find((x) => x.id === id)
                if (c?.agenciaId) aplicarAgencia(c.agenciaId)
              }}
            >
              <option value="">— Sin cliente —</option>
              {/* Solo clientes directos como anunciante; las agencias van aparte. */}
              {clientes?.filter((c) => c.tipo !== 'AGENCIA').map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Agencia">
            {agencias.length === 0 ? (
              <div className="flex h-9 items-center rounded border border-dashed border-border-strong px-3 text-[12px] text-muted">
                Crea un cliente tipo «Agencia» para asociarla
              </div>
            ) : (
              <select className={inputCls} value={agenciaId} onChange={(e) => aplicarAgencia(e.target.value)}>
                <option value="">— Sin agencia (directo) —</option>
                {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            )}
          </Campo>
        </div>
        {/* Aviso de negociación sin validar (bloquea crear la propuesta) */}
        {negociacionPendiente && (
          <div className="flex items-start gap-2 rounded-md border border-[#f59e0b40] bg-[#f59e0b0d] p-2.5 text-[12px]">
            <span className="mt-0.5 text-[#9a6700]">⚠</span>
            <div>
              <div className="font-medium text-ink">
                La negociación con «{agenciaSel?.nombre}» no está validada
              </div>
              <div className="text-muted">
                Valida la negociación de la agencia en Clientes para poder crear la propuesta.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Desde"><input type="date" className={inputCls} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Campo>
          <Campo label="Duración de la campaña">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className={`${inputCls} w-20`}
                value={duracionN}
                onChange={(e) => setDuracionN(e.target.value)}
              />
              <select className={inputCls} value={duracionUnidad} onChange={(e) => setDuracionUnidad(e.target.value as Unidad)}>
                {UNIDADES.filter((u) => !esCantidadManual(u.unidad)).map((u) => {
                  const n = parseInt(duracionN, 10) || 1
                  return (
                    <option key={u.unidad} value={u.unidad}>
                      {unidadCorta(u.unidad, n)}
                    </option>
                  )
                })}
              </select>
            </div>
          </Campo>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Hasta (se calcula de la duración)">
            <input type="date" className={inputCls} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </Campo>
          <Campo label="Comisión de la agencia (%)"><input className={inputCls} value={comision} onChange={(e) => setComision(e.target.value)} /></Campo>
        </div>

        {/* Selección de sitios: dos vistas alternables (lista / mapa) */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-ink">Sitios ({sel.size})</span>
            {/* Switch de vista */}
            <div className="inline-flex overflow-hidden rounded-md border border-border-strong text-[11px]">
              <button
                type="button"
                onClick={() => { setVistaSitios('lista'); setZona(null) }}
                className={`inline-flex items-center gap-1 px-2 py-1 font-medium transition-colors ${
                  vistaSitios === 'lista' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'
                }`}
              >
                <List className="h-3 w-3" /> Lista
              </button>
              <button
                type="button"
                onClick={() => setVistaSitios('mapa')}
                className={`inline-flex items-center gap-1 border-l border-border-strong px-2 py-1 font-medium transition-colors ${
                  vistaSitios === 'mapa' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'
                }`}
              >
                <MapIcon className="h-3 w-3" /> Mapa
              </button>
            </div>
          </div>

          {vistaSitios === 'lista' ? (
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              {(sitios ?? []).map((s) => {
                const digital =
                  s.tipoMedio === 'PANTALLA_DIGITAL' ||
                  s.esRotativo ||
                  s.exhibicion === 'digital' ||
                  s.exhibicion === 'rotativo'
                return (
                  <label key={s.id} className="flex cursor-pointer items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[12px] last:border-0 hover:bg-surface-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
                      <span className="truncate text-ink">{s.nombre}</span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                          digital
                            ? 'border-[#0a66ff40] bg-accent-soft text-[#0a4fcc]'
                            : 'border-border bg-surface-2 text-muted'
                        }`}
                      >
                        {digital ? <Monitor className="h-2.5 w-2.5" /> : <Square className="h-2.5 w-2.5" />}
                        {digital ? 'Digital' : 'Fija'}
                      </span>
                    </span>
                    <span className="demo-num shrink-0 text-muted">{sel.has(s.id) ? formatMonto(precioDe(s)) : ''}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <>
              {/* Mapa: clic en un pin agrega/quita el sitio. Un ✓ en el nombre y
                  el aro azul marcan los ya elegidos. */}
              <div className="h-72 overflow-hidden rounded-md border border-border">
                <MapView
                  points={(sitios ?? [])
                    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
                    // Con una zona dibujada, solo se muestran las pantallas de dentro.
                    .filter((s) => !zona || puntoEnPoligono([s.lng, s.lat], zona))
                    .map((s) => ({
                      id: s.id,
                      lat: s.lat,
                      lng: s.lng,
                      tono: sel.has(s.id) ? 'azul' : pinTono(s),
                      label: `${sel.has(s.id) ? '✓ ' : ''}${s.nombre}`,
                    }))}
                  onSelect={toggle}
                  zoom={11}
                  permitirDibujo
                  onZonaChange={setZona}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Toca un punto para agregar o quitar el sitio. O usa <b className="text-ink">Dibujar zona</b> para
                quedarte solo con las pantallas de esa área (se descartan las demás).
              </p>
            </>
          )}
        </div>

        {/* Configuración por tiempo de cada sitio seleccionado */}
        {seleccionados.length > 0 && (
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink">Contratación por sitio</span>
            {/* REJILLA-01 · el aviso va PEGADO al selector y solo cuando alguien
                ya eligió una franja: es el momento en que sirve. Puesto siempre,
                se convertiría en decorado y dejaría de leerse. */}
            {seleccionados.some((s) => cfgDe(s).franjaId) && (
              <div className="mb-2">
                <AvisoFranjaCMS compacto />
              </div>
            )}
            <div className="space-y-2 rounded-md border border-border p-2">
              {seleccionados.map((s) => {
                const c = cfgDe(s)
                const mods = modalidadesDe(s)
                const periodos = periodosEnRango(c.unidad, fechaInicio, fechaFin)
                const esManual = periodos === null // spot (CPS) / hora / cpm
                // Los spots/día (programación) solo aplican a pantallas DIGITALES;
                // las fijas no tienen spots.
                const digital =
                  s.tipoMedio === 'PANTALLA_DIGITAL' || s.esRotativo ||
                  s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-[12px] last:border-0 last:pb-0">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.nombre}</span>
                    {/* Unidad (de las modalidades publicadas del sitio) */}
                    <select
                      className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                      value={c.unidad}
                      // Cambiar la unidad cambia la tarifa calculada: un precio
                      // manual puesto para «mensual» no vale para «spot».
                      onChange={(e) => setCfgSitio(s.id, { unidad: e.target.value as Unidad, tarifaManual: '' })}
                    >
                      {mods.map((m) => (
                        <option key={m.unidad} value={m.unidad}>
                          {UNIDADES.find((u) => u.unidad === m.unidad)?.label ?? m.unidad}
                        </option>
                      ))}
                    </select>
                    {/* REJILLA-01 · la FRANJA contratada. El selector SOLO se
                        pinta si el dueño capturó franjas: sin catálogo, vender
                        tiene exactamente la misma forma que antes de que esto
                        existiera (invariante 1). «Todo el día» es la opción por
                        omisión y no un hueco: es lo que se ha vendido siempre. */}
                    {franjas.length > 0 && (
                      <select
                        className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                        value={c.franjaId}
                        onChange={(e) => setCfgSitio(s.id, { franjaId: e.target.value, tarifaManual: '' })}
                        title="Franja horaria contratada. Es un compromiso comercial: no se envía al CMS."
                      >
                        <option value="">Todo el día</option>
                        {franjas.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nombre} · {f.horaInicio}–{f.horaFin}
                          </option>
                        ))}
                      </select>
                    )}
                    {/* Cantidad: auto (periodos del rango), de la calculadora
                        (digital por spot) o manual (spot/hora/cpm) */}
                    {usaCalcDe(s) ? (
                      <span className="demo-num whitespace-nowrap text-muted" title="Salidas que salen de la calculadora de abajo">
                        {calcDe(s)?.ok ? `${cantidadDe(s).toLocaleString('es-MX')} salidas` : '— salidas'}
                      </span>
                    ) : esManual ? (
                      <input
                        type="number"
                        min={1}
                        className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                        value={c.cantidadManual}
                        onChange={(e) => setCfgSitio(s.id, { cantidadManual: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        title={c.unidad === 'cpm' ? 'Millares de impactos contratados (1 millar = 1,000 impactos)' : `Nº de ${unidadCorta(c.unidad, 2)}`}
                      />
                    ) : (
                      <span className="whitespace-nowrap text-muted" title="Periodos calculados del rango de fechas">
                        {periodos} {unidadCorta(c.unidad, periodos)}
                      </span>
                    )}
                    {/* CPS-CPM · el CPM se captura en MILLARES. Se escribe a cuántos
                        impactos equivale para que nadie teclee 2,500,000 donde
                        van 2,500: cobraría mil veces de más. */}
                    {esManual && !usaCalcDe(s) && c.unidad === 'cpm' && (
                      <span className="demo-num whitespace-nowrap text-muted">
                        millares = {(c.cantidadManual * 1000).toLocaleString('es-MX')} impactos
                      </span>
                    )}
                    {/* Programación: spots por día — solo pantallas digitales.
                        Con la calculadora sale de la misma cuenta. */}
                    {usaCalcDe(s) ? (
                      <span className="demo-num w-24 text-center text-[11px] text-muted" title="Programación que sale de la calculadora">
                        {(() => {
                          const p = calcDe(s)
                          return p?.ok ? `${p.spotsDia.toLocaleString('es-MX')} pases/día` : '—'
                        })()}
                      </span>
                    ) : digital ? (
                      <input
                        type="number"
                        min={1}
                        placeholder="spots/día"
                        className="h-8 w-24 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                        value={c.spotsPorDia}
                        onChange={(e) => setCfgSitio(s.id, { spotsPorDia: e.target.value })}
                        title="Programación: cuántas veces al día se muestra (opcional)"
                      />
                    ) : (
                      <span className="w-24 text-center text-[11px] text-muted" title="Las pantallas fijas no manejan spots">Fija · sin spots</span>
                    )}
                    {/* PRECIO-01 · la TARIFA por unidad. Calculada por el
                        sistema; solo un gerente o superior la puede cambiar.
                        Para el vendedor es un texto, no un campo: el servidor
                        rechazaría cualquier otro número que mandara. */}
                    {(() => {
                      const calc = tarifaBaseDe(s)
                      const manual = tarifaManualDe(c)
                      const ajustada = manual != null && Math.round(manual * 100) !== Math.round(calc.tarifa * 100)
                      return puedeAjustarTarifa ? (
                        <span className="flex items-center gap-1" title="Tarifa por unidad. Déjala vacía para usar la calculada.">
                          <span className="text-[11px] text-muted">Tarifa</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={`Tarifa por unidad de ${s.nombre}`}
                            placeholder={calc.calculable ? String(calc.tarifa) : 'sin tarifa'}
                            className={`h-8 w-24 rounded border bg-surface px-2 text-[12px] text-ink ${
                              ajustada ? 'border-[#f59e0b]' : 'border-border-strong'
                            }`}
                            value={c.tarifaManual}
                            onChange={(e) => setCfgSitio(s.id, { tarifaManual: e.target.value })}
                          />
                          {ajustada && (
                            <span className="text-[10px] font-medium text-[#9a6700]">
                              calculada {calc.calculable ? formatMonto(calc.tarifa) : '—'}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span
                          className="whitespace-nowrap text-[11px] text-muted"
                          title="Tarifa calculada por el sistema. Solo un gerente o superior puede cambiarla."
                        >
                          {calc.calculable
                            ? `Tarifa ${formatMonto(calc.tarifa)}`
                            : 'Sin tarifa · pide a un gerente'}
                        </span>
                      )
                    })()}
                    <span className="demo-num w-24 text-right font-medium text-ink">{formatMonto(precioDe(s))}</span>

                    {/* ADR 0042 · la CALCULADORA DE SPOTS. Solo en pantalla
                        digital vendida por spot. Da la CANTIDAD y, desde el ADR
                        0043, también el PRECIO por spot (tarifa mensual ÷
                        spots del loop), como la calculadora HTML. */}
                    {conLoop(s) && c.unidad === 'spot' && (
                      <CalculadoraSpotsLinea
                        sitio={s}
                        cfg={c}
                        franja={franjaDe(c)}
                        duracionSeg={duracionSpotSeg(s.duracionSpotSeg, config?.spotSeg)}
                        resultado={calcDe(s)}
                        dias={diasInclusivos(fechaInicio, fechaFin)}
                        conFechas={!!fechaInicio && !!fechaFin}
                        tarifaMensual={tarifaMensualDeSitio({ sitio: s, franjaId: c.franjaId || null, temporadas, fechaInicio })}
                        tarifaSpot={tarifaBaseDe(s)}
                        prima={primaDe(s)}
                        puedePrima={puedeAjustarTarifa}
                        cambiar={(patch) => setCfgSitio(s.id, patch)}
                      />
                    )}

                    {/* Renta al propietario (el COSTO). Solo se pide para las
                        pantallas que aún no tienen contrato: si ya lo tienen, el
                        importe pactado manda y preguntarlo aquí invitaría a
                        contradecirlo. Capturarla hace que el contrato nazca
                        completo con la campaña (ADR 0001); si se deja vacía,
                        nace como pendiente igual que hasta ahora. */}
                    {tieneContrato(s) && (() => {
                      // La renta ya está pactada: se muestra para que el
                      // comercial vea el costo, pero no se pide ni se toca.
                      const cv = contratoVigenteDe(s)!
                      const mes = Math.round((cv.montoRenta ?? 0) * factorMensual(cv.periodicidad))
                      return (
                        <div className="flex w-full items-center gap-2 rounded bg-surface-2 px-2 py-1.5 text-[11px] text-muted">
                          <span className="font-medium">Renta al arrendador</span>
                          <span className="text-ink">
                            {formatMonto(cv.montoRenta ?? 0)} {String(cv.periodicidad ?? '').toLowerCase()}
                          </span>
                          <span className="ml-auto">
                            ya pactada en el contrato{cv.predioId ? ' del predio' : ''} · costo {formatMonto(mes)}/mes
                          </span>
                        </div>
                      )
                    })()}
                    {!tieneContrato(s) && (
                      <div className="flex w-full flex-wrap items-center gap-2 rounded bg-surface-2 px-2 py-1.5">
                        <span className="text-[11px] font-medium text-muted">Renta al arrendador</span>
                        <select
                          className="h-8 min-w-[9rem] rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                          value={c.rentaArrendadorId}
                          onChange={(e) => setCfgSitio(s.id, { rentaArrendadorId: e.target.value })}
                          title="A quién se le paga"
                        >
                          <option value="">Arrendador…</option>
                          {(arrendadores ?? []).map((a) => (
                            <option key={a.id} value={a.id}>{a.nombre}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          placeholder="importe"
                          className="h-8 w-28 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                          value={c.rentaMonto}
                          onChange={(e) => setCfgSitio(s.id, { rentaMonto: e.target.value })}
                        />
                        <select
                          className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                          value={c.rentaPeriodicidad}
                          onChange={(e) => setCfgSitio(s.id, { rentaPeriodicidad: e.target.value })}
                          title="Cada cuándo se paga"
                        >
                          {PERIODICIDADES_RENTA.map((x) => (
                            <option key={x.value} value={x.value}>{x.label}</option>
                          ))}
                        </select>
                        {/* El aviso iba en gris al final de la fila y pasaba
                            desapercibido: se han creado propuestas con importe
                            pero sin propietario, que dejan el contrato pendiente
                            sin que nadie se entere. Ahora los avisos van en
                            ámbar y ocupan su propia línea. */}
                        <span className="w-full text-[11px]">
                          {rentaSospechosa(s) ? (
                            <span className="font-medium text-warning">
                              ⚠ La renta ({formatMonto(Number(c.rentaMonto))}) iguala o supera lo que
                              le cobras al cliente ({formatMonto(precioDe(s))}): la campaña saldría a
                              pérdida. Aquí va lo que le pagas al PROPIETARIO, no el precio de venta.
                            </span>
                          ) : rentaIncompleta(s) ? (
                            <span className="font-medium text-warning">
                              ⚠ Falta {!c.rentaArrendadorId ? 'elegir el propietario' : 'el importe'}:
                              el contrato nacerá pendiente y no se generará el calendario de pagos.
                            </span>
                          ) : Number(c.rentaMonto) > 0 ? (
                            <span className="text-muted">
                              Costo {formatMonto(rentaMensualDe(s))}/mes · el contrato nacerá completo
                              y con su calendario de pagos
                            </span>
                          ) : (
                            <span className="text-muted">
                              Opcional · sin esto el contrato nace pendiente y habrá que capturarlo
                              después en Arrendadores
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {!fechaInicio || !fechaFin ? (
              <p className="mt-1 text-[11px] text-muted">Elige las fechas para calcular los periodos y el precio.</p>
            ) : null}
          </div>
        )}

        {/* Resumen del divisor en vivo */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-border bg-surface-2 p-3 text-[12px] sm:grid-cols-4">
          <Dato label="Bruto" valor={formatMonto(bruto)} />
          <Dato label={`Divisor (${comision || 0}%)`} valor={`× ${divisor.toFixed(2)}`} />
          <Dato label="Neto" valor={formatMonto(neto)} />
          <Dato label={`IVA ${ivaPctSel}%`} valor={formatMonto(iva)} />
        </div>
      </div>
    </Modal>
  )
}

// ¿El punto [lng,lat] cae dentro del polígono (lista de [lng,lat])? Algoritmo de
// ray-casting clásico; el polígono no necesita venir "cerrado".
function puntoEnPoligono(p: [number, number], poly: [number, number][]): boolean {
  const [x, y] = p
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (cruza) dentro = !dentro
  }
  return dentro
}

// ADR 0042 · lo que una línea arranca teniendo de la calculadora. APAGADA desde
// el 2026-10-01 por decisión del dueño: el porqué vive junto a la constante, en
// `lib/calculadora-spots.ts`, que es donde lo vigila su prueba.
const CALC_POR_OMISION = { ...CALCULADORA_POR_OMISION }

const fmtNum = (n: number, dec = 2) => n.toLocaleString('es-MX', { maximumFractionDigits: dec })

type CfgCalculadora = { manual: boolean; espacios: string; horasDia: string; roadblock: boolean; prima: string }

/**
 * ADR 0042 · la calculadora de una línea. Es solo PRESENTACIÓN: la cuenta llega
 * hecha en `resultado` (`previsualizarCalculadora`), y el servidor la repite.
 */
function CalculadoraSpotsLinea({
  sitio,
  cfg,
  franja,
  duracionSeg,
  resultado,
  dias,
  conFechas,
  tarifaMensual,
  tarifaSpot,
  prima,
  puedePrima,
  cambiar,
}: {
  sitio: any
  cfg: CfgCalculadora
  franja: FranjaUI | null
  duracionSeg: number
  resultado: ReturnType<typeof previsualizarCalculadora> | null
  dias: number
  conFechas: boolean
  /** La tarifa mensual con la que se cuenta (`tarifaMensualDeSitio`). */
  tarifaMensual: number
  /** La tarifa base por spot, sin prima (`tarifaBaseCalculadora`). */
  tarifaSpot: { tarifa: number; calculable: boolean }
  prima: number
  puedePrima: boolean
  cambiar: (patch: Partial<CfgCalculadora>) => void
}) {
  const total = Number(sitio.totalSpots ?? 0)
  const libres = sitio.spotsDisponibles
  const horasMax = horasPorOmision({ franja, horario: sitio.horario })
  const horario = horasDeHorario(sitio.horario)
  // ADR 0043 · el desglose de la calculadora HTML. Solo enseña: las cifras que
  // cuentan ya vienen hechas en `resultado` y `tarifaSpot`, y el servidor las
  // repite con las mismas funciones.
  const horasMes = horario.horas * DIAS_DEL_MES
  const ingresoHora = resultado?.ok && horasMes > 0 ? (tarifaMensual * resultado.loop) / horasMes : null
  const spotsHoraRB = Math.floor(SEGUNDOS_POR_HORA / duracionSeg)
  const inputCls =
    'h-7 w-16 rounded border border-border-strong bg-surface px-1.5 text-[12px] text-ink disabled:opacity-50'
  return (
    <div className="w-full rounded bg-surface-2 px-2 py-1.5 text-[11px] text-muted">
      <label className="inline-flex items-center gap-1.5 font-medium text-ink">
        <input type="checkbox" checked={!cfg.manual} onChange={(e) => cambiar({ manual: !e.target.checked })} />
        Calculadora de spots
      </label>
      {cfg.manual ? (
        <span className="ml-2">Apagada: la cantidad de spots se captura a mano.</span>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1" title="Cuántos espacios del loop compra esta línea">
              Espacios del loop
              <input
                type="number"
                min={1}
                max={total || undefined}
                step={1}
                aria-label={`Espacios del loop de ${sitio.nombre}`}
                className={inputCls}
                value={cfg.roadblock ? String(total) : cfg.espacios}
                disabled={cfg.roadblock}
                onChange={(e) => cambiar({ espacios: e.target.value })}
              />
              <span className="demo-num">
                de {total || '—'} · {libres != null ? `${libres} libres` : 'libres sin dato'}
              </span>
            </label>
            <label
              className="inline-flex items-center gap-1"
              title={
                franja
                  ? `Las horas de la franja ${franja.nombre}; se pueden bajar`
                  : 'Las horas del horario de la pantalla; se pueden bajar'
              }
            >
              Horas al día
              <input
                type="number"
                min={0.25}
                max={horasMax}
                step={0.25}
                aria-label={`Horas al día de ${sitio.nombre}`}
                placeholder={fmtNum(horasMax)}
                className={inputCls}
                value={cfg.horasDia}
                onChange={(e) => cambiar({ horasDia: e.target.value })}
              />
            </label>
            <label
              className="inline-flex items-center gap-1"
              title="Compra TODOS los espacios del loop; exige que estén libres"
            >
              <input
                type="checkbox"
                checked={cfg.roadblock}
                onChange={(e) => cambiar({ roadblock: e.target.checked })}
              />
              Roadblock
            </label>
            <label
              className="inline-flex items-center gap-1"
              title={
                puedePrima
                  ? 'Porcentaje encima de la tarifa por spot. Queda como ajuste a tu nombre.'
                  : 'Solo un gerente o superior puede poner prima a un Roadblock.'
              }
            >
              Prima %
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                aria-label={`Prima de Roadblock de ${sitio.nombre}`}
                placeholder="0"
                className={inputCls}
                value={puedePrima ? cfg.prima : ''}
                disabled={!cfg.roadblock || !puedePrima}
                onChange={(e) => cambiar({ prima: e.target.value })}
              />
            </label>
          </div>
          {resultado?.ok ? (
            <>
              <div className="demo-num mt-1">
                Loop de {resultado.loop} {resultado.loop === 1 ? 'anunciante' : 'anunciantes'}
                {!resultado.roadblock && resultado.loop < total && ` (${resultado.loop - resultado.espaciosComprados} hoy + esta línea)`}
                {' · '}
                {Math.floor((resultado.loop * duracionSeg) / 60)}:
                {String((resultado.loop * duracionSeg) % 60).padStart(2, '0')} min
              </div>
              <div className="demo-num text-ink">
                {resultado.roadblock
                  ? `${spotsHoraRB.toLocaleString('es-MX')} spots/h`
                  : `${fmtNum(resultado.rotacionesHora)} rotaciones/h`}{' '}
                · {fmtNum(resultado.spotsDiaExactos)} spots/día × {dias} {dias === 1 ? 'día' : 'días'} ={' '}
                <b>{resultado.cantidad.toLocaleString('es-MX')} spots</b>
              </div>
              {tarifaSpot.calculable && (
                <div className="demo-num">
                  {resultado.roadblock && ingresoHora != null ? (
                    <>
                      Hora del loop: {formatMonto(tarifaMensual)} × {resultado.loop} ÷ {fmtNum(horasMes)} h ={' '}
                      {formatMonto(ingresoHora)}
                      {prima > 0 && ` + prima ${fmtNum(prima)} % = ${formatMonto(ingresoHora * (1 + prima / 100))}`} ÷{' '}
                      {spotsHoraRB} spots ={' '}
                      <b className="text-ink">{formatMonto(prima > 0 ? tarifaConPrima(tarifaSpot.tarifa, prima) : tarifaSpot.tarifa)} por spot</b>
                    </>
                  ) : (
                    <>
                      Tarifa mensual {formatMonto(tarifaMensual)} ÷{' '}
                      {fmtNum(rotacionesPorHora(resultado.loop, duracionSeg) * horario.horas * DIAS_DEL_MES, 0)} spots de un
                      anunciante al mes = <b className="text-ink">{formatMonto(tarifaSpot.tarifa)} por spot</b>
                    </>
                  )}
                </div>
              )}
            </>
          ) : resultado && conFechas ? (
            <div className="mt-1 text-error">{resultado.motivo}</div>
          ) : !conFechas ? (
            <div className="mt-1">Pon las fechas para calcular los spots.</div>
          ) : null}
          {!franja && !horario.reconocido && (
            <div className="mt-0.5 text-[#9a6700]">
              No se entiende el horario de la pantalla («{sitio.horario || 'vacío'}»): se toman 18 h al día.
            </div>
          )}
          {!tarifaSpot.calculable && (
            <div className="mt-0.5 text-[#9a6700]">
              La pantalla no tiene tarifa mensual: el precio por spot sale de ella. Pide a un gerente que lo ponga.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="demo-num text-[13px] text-ink">{valor}</div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

// Tira de funnel comercial: enviadas → aprobadas → perdidas, win rate y pipeline.
function FunnelStrip({ f }: { f: FunnelPropuestas }) {
  const winPct = f.winRate != null ? Math.round(f.winRate * 100) : null
  const enPipeline = f.borrador + f.enviadas
  // Ancho relativo del embudo (enviadas alguna vez = base).
  const base = Math.max(1, f.enviadas + f.aprobadas + f.rechazadas)
  const barra = (n: number, cls: string) => (
    <div className="h-2 rounded-full bg-surface-2">
      <div className={`h-2 rounded-full ${cls}`} style={{ width: `${Math.round((n / base) * 100)}%` }} />
    </div>
  )
  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 py-1 lg:grid-cols-4">
          <Tile label="En pipeline" valor={formatMontoCorto(f.pipelineValue)} sub={`${enPipeline} propuesta${enPipeline === 1 ? '' : 's'} (borrador + enviada)`} />
          <Tile label="Ganado" tono="text-[#0f7a55]" valor={formatMontoCorto(f.ganadoValue)} sub={`${f.aprobadas} aprobada${f.aprobadas === 1 ? '' : 's'}`} />
          <Tile label="Perdido" tono="text-error" valor={formatMontoCorto(f.perdidoValue)} sub={`${f.rechazadas} rechazada${f.rechazadas === 1 ? '' : 's'}`} />
          <Tile label="Win rate" valor={winPct != null ? `${winPct}%` : '—'} sub={winPct != null ? `sobre ${f.aprobadas + f.rechazadas} cerradas` : 'sin cierres aún'} />
        </div>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <FunnelRow label="Enviadas" n={f.enviadas + f.aprobadas + f.rechazadas} bar={barra(f.enviadas + f.aprobadas + f.rechazadas, 'bg-info')} />
          <FunnelRow label="Aprobadas" n={f.aprobadas} bar={barra(f.aprobadas, 'bg-[#10b981]')} />
          <FunnelRow label="Perdidas" n={f.rechazadas} bar={barra(f.rechazadas, 'bg-[#ef4444]')} />
        </div>
      </CardContent>
    </Card>
  )
}

function Tile({ label, valor, sub, tono }: { label: string; valor: string; sub?: string; tono?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`demo-num text-[20px] font-semibold ${tono ?? 'text-ink'}`}>{valor}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

function FunnelRow({ label, n, bar }: { label: string; n: number; bar: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[12px] text-muted">{label}</span>
      <span className="flex-1">{bar}</span>
      <span className="demo-num w-8 shrink-0 text-right text-[12px] font-medium text-ink">{n}</span>
    </div>
  )
}
