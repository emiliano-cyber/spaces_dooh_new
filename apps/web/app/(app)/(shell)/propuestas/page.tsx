'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileText, Send, Check, X, ChevronDown, ChevronRight, Monitor, Square, List, Map as MapIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { MapView } from '@/components/demo/MapView'
import { pinTono } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  usePropuestas,
  useFunnelPropuestas,
  useClientes,
  useSitios,
  useCampanas,
  useContratos,
  useArrendadores,
  formatMonto,
  formatMontoCorto,
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
  UNIDAD_CORTA,
  cantidadEfectiva,
  precioItem,
  periodosEnRango,
  fechaFinDesde,
  type Unidad,
} from '@/lib/periodos'

// Periodicidades de la renta al propietario (enum `periodicidad_pago` en la BD).
// Las dos primeras son las que se usan casi siempre; el resto están porque el
// contrato con el propietario puede pactarse en cualquiera de ellas.
const PERIODICIDADES_RENTA = [
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'ANUAL', label: 'Anual' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'CATORCENAL', label: 'Catorcenal' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'BIMESTRAL', label: 'Bimestral' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'SEMESTRAL', label: 'Semestral' },
] as const

// Equivalencia a mensual, igual que en el P&L (derive.ts · rentaAMensual): un
// contrato anual de 60 000 cuesta 5 000/mes.
const A_MENSUAL: Record<string, number> = {
  SEMANAL: 30 / 7, CATORCENAL: 30 / 14, QUINCENAL: 2, MENSUAL: 1,
  BIMESTRAL: 1 / 2, TRIMESTRAL: 1 / 3, SEMESTRAL: 1 / 6, ANUAL: 1 / 12,
}

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
          <Button size="sm" onClick={() => setNuevoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva propuesta
          </Button>
        )}
      </div>

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
              </div>
              <div className="mt-0.5 text-[14px] font-medium text-ink">{p.nombre}</div>
              <div className="text-[12px] text-muted">
                {cliente?.nombre ?? 'Sin cliente'}
                {agencia ? <> · vía <span className="text-ink">{agencia.nombre}</span></> : ''}
                {' '}· {p.items.length} sitios
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
              <span className="font-medium text-ink">Aprobado · {p.itemsAprobados}/{p.items.length} sitios</span>
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
                  <Button size="sm" variant="secondary" onClick={() => cambiar('ENVIADA')}><Send className="h-3.5 w-3.5" /> Enviar</Button>
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
  // "Hasta" automáticamente (misma equivalencia que el precio: mes=30, etc.).
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
  useEffect(() => {
    const n = parseInt(duracionN, 10)
    const fin = fechaInicio && n > 0 ? fechaFinDesde(fechaInicio, duracionUnidad, n) : ''
    if (fin) setFechaFin(fin)
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
  }
  const [cfg, setCfg] = useState<Record<string, CfgSitio>>({})

  // Modalidades publicadas de un sitio: [{unidad, tarifa}]. Si no tiene, ofrece
  // una mensual sintética con su tarifa publicada, para no bloquear.
  const modalidadesDe = (s: any): { unidad: Unidad; tarifa: number }[] => {
    const det = (s.modalidadesDetalle ?? []) as { unidad: string; tarifaPublicada: number }[]
    const validas = det
      .filter((m) => UNIDADES.some((u) => u.unidad === m.unidad))
      .map((m) => ({ unidad: m.unidad as Unidad, tarifa: Number(m.tarifaPublicada) || 0 }))
    if (validas.length) return validas
    return [{ unidad: 'mensual', tarifa: Number(s.tarifaPublicada || s.tarifaMensual || 0) }]
  }

  const cfgDe = (s: any): CfgSitio => cfg[s.id] ?? {
    unidad: modalidadesDe(s)[0].unidad,
    cantidadManual: 1,
    spotsPorDia: '',
    ...(({ monto, per, arr }) => ({
      rentaMonto: monto, rentaPeriodicidad: per, rentaArrendadorId: arr,
    }))(rentaPrevia(s)),
  }
  const tarifaDe = (s: any, unidad: Unidad): number =>
    modalidadesDe(s).find((m) => m.unidad === unidad)?.tarifa ?? modalidadesDe(s)[0].tarifa

  // Cantidad efectiva (periodos del rango para unidades de tiempo; manual para
  // spot/hora) y precio (tarifa × cantidad) de un sitio con su configuración.
  const cantidadDe = (s: any): number => {
    const c = cfgDe(s)
    return cantidadEfectiva(c.unidad, fechaInicio, fechaFin, c.cantidadManual)
  }
  const precioDe = (s: any): number => {
    const c = cfgDe(s)
    return precioItem(tarifaDe(s, c.unidad), cantidadDe(s))
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
    return Math.round((Number(c.rentaMonto) || 0) * (A_MENSUAL[c.rentaPeriodicidad] ?? 1))
  }

  const setCfgSitio = (id: string, patch: Partial<CfgSitio>) => {
    const s = (sitios ?? []).find((x) => x.id === id)
    const base = s ? cfgDe(s) : { unidad: 'mensual' as Unidad, cantidadManual: 1, spotsPorDia: '', rentaMonto: '', rentaPeriodicidad: 'MENSUAL', rentaArrendadorId: '' }
    setCfg((prev) => ({ ...prev, [id]: { ...base, ...prev[id], ...patch } }))
  }

  const seleccionados = (sitios ?? []).filter((s) => sel.has(s.id))
  const bruto = seleccionados.reduce((acc, s) => acc + precioDe(s), 0)
  const divisor = 1 - (Number(comision) || 0) / 100
  const neto = Math.round(bruto * divisor)
  const ivaPctSel = clientes?.find((c) => c.id === clienteId)?.ivaPct ?? 16
  const iva = Math.round(bruto * (ivaPctSel / 100))
  const total = bruto + iva
  // Gate de negociación: si la agencia tiene negociación sin validar, se bloquea.
  const agenciaSel = clientes?.find((c) => c.id === agenciaId)
  const negociacionPendiente = !!agenciaSel?.tieneNegociacion && !agenciaSel?.negociacionValidada
  const valido = !!nombre.trim() && !!fechaInicio && !!fechaFin && sel.size > 0 && !negociacionPendiente

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
          return {
            sitioId: s.id,
            unidad: c.unidad,
            tarifaUnitaria: tarifaDe(s, c.unidad),
            // Solo relevante para spot/hora; el servidor la ignora en unidades de tiempo.
            cantidad: c.cantidadManual,
            spotsPorDia: Number.isFinite(spots) && spots > 0 ? spots : null,
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
          {error ? <span className="text-[12px] text-error">{error}</span> : (
            <span className="text-[12px] text-muted">Total c/IVA: <b className="demo-num text-ink">{formatMonto(total)}</b></span>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!valido || guardando} onClick={guardar}>
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
                {UNIDADES.filter((u) => u.unidad !== 'spot' && u.unidad !== 'hora').map((u) => {
                  const n = parseInt(duracionN, 10) || 1
                  return (
                    <option key={u.unidad} value={u.unidad}>
                      {UNIDAD_CORTA[u.unidad]}{n !== 1 ? 's' : ''}
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
            <div className="space-y-2 rounded-md border border-border p-2">
              {seleccionados.map((s) => {
                const c = cfgDe(s)
                const mods = modalidadesDe(s)
                const periodos = periodosEnRango(c.unidad, fechaInicio, fechaFin)
                const esManual = periodos === null // spot / hora
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
                      onChange={(e) => setCfgSitio(s.id, { unidad: e.target.value as Unidad })}
                    >
                      {mods.map((m) => (
                        <option key={m.unidad} value={m.unidad}>
                          {UNIDADES.find((u) => u.unidad === m.unidad)?.label ?? m.unidad}
                        </option>
                      ))}
                    </select>
                    {/* Cantidad: auto (periodos del rango) o manual (spot/hora) */}
                    {esManual ? (
                      <input
                        type="number"
                        min={1}
                        className="h-8 w-20 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                        value={c.cantidadManual}
                        onChange={(e) => setCfgSitio(s.id, { cantidadManual: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        title={`Nº de ${UNIDAD_CORTA[c.unidad]}s`}
                      />
                    ) : (
                      <span className="whitespace-nowrap text-muted" title="Periodos calculados del rango de fechas">
                        {periodos} {UNIDAD_CORTA[c.unidad]}{periodos !== 1 ? 's' : ''}
                      </span>
                    )}
                    {/* Programación: spots por día — solo pantallas digitales */}
                    {digital ? (
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
                    <span className="demo-num w-24 text-right font-medium text-ink">{formatMonto(precioDe(s))}</span>

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
                      const mes = Math.round((cv.montoRenta ?? 0) * (A_MENSUAL[cv.periodicidad ?? 'MENSUAL'] ?? 1))
                      return (
                        <div className="flex w-full items-center gap-2 rounded bg-surface-2 px-2 py-1.5 text-[11px] text-muted">
                          <span className="font-medium">Renta al propietario</span>
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
                        <span className="text-[11px] font-medium text-muted">Renta al propietario</span>
                        <select
                          className="h-8 min-w-[9rem] rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                          value={c.rentaArrendadorId}
                          onChange={(e) => setCfgSitio(s.id, { rentaArrendadorId: e.target.value })}
                          title="A quién se le paga"
                        >
                          <option value="">Propietario…</option>
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
