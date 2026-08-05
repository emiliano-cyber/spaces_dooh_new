'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Plus, FileSignature, Search, X, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { ContratoSheet } from '@/components/demo/arrendadores/ContratoSheet'
import { GestionRazonesSociales } from '@/components/demo/arrendadores/GestionRazonesSociales'
import { PagosRentaCard } from '@/components/demo/arrendadores/PagosRentaCard'
import { ContratoWizard } from '@/components/demo/inventario/ContratoWizard'
import {
  StatusBadge,
  CONTRATO_TONO,
  CONTRATO_LABEL,
  PAGO_TONO,
  PAGO_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { factorMensual, periodicidadLabel } from '@/lib/renta-periodicidad'
import {
  filtrarArrendadores,
  filtrarContratos,
  filtrarPagos,
  sitiosDeContratos,
  hayFiltro,
  FILTRO_VACIO,
  type FiltroArrendadores,
} from '@/lib/arrendadores-filtro'
import {
  useContratos,
  useArrendadores,
  useSitios,
  usePagosRenta,
  useMargenPorSitio,
  useRazonesSociales,
  usePredios,
  useReservas,
  useCampanas,
  formatMonto,
  formatFecha,
  faltaEnContratos,
  diasHasta,
  type ContratoArrendamiento,
  type MargenSitio,
} from '@/lib/data/client'
import { registrarPagoRentaApi, crearArrendadorApi, crearRazonSocialApi } from '@/lib/data/estado-api'
import { esRfcValido } from '@/lib/rfc'
import { descargarContratos } from '@/lib/contratos-export'
import { ConciliacionCard } from '@/components/demo/arrendadores/ConciliacionCard'

export default function ArrendadoresPage() {
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const sitios = useSitios()
  const pagos = usePagosRenta()
  const margenes = useMargenPorSitio()
  const razones = useRazonesSociales()
  const predios = usePredios()
  const reservas = useReservas()
  const campanas = useCampanas()

  // Genera el archivo en el navegador (no hay endpoint: los datos ya estan en
  // el store). Si falla —un tenant con miles de contratos agotando memoria— se
  // dice, en vez de dejar un boton que no hace nada.
  function descargarVigentes() {
    try {
      const n = descargarContratos(
        contratos ?? [],
        {
          arrendadores: arrendadores ?? [],
          razones: razones ?? [],
          sitios: sitios ?? [],
          predios: predios ?? [],
        },
        'xlsx',
      )
      setToast(
        n === 0
          ? 'No hay contratos vigentes que descargar'
          : `Descargados ${n} contrato${n === 1 ? '' : 's'} vigente${n === 1 ? '' : 's'}`,
      )
    } catch {
      setToast('No se pudo generar el archivo')
    }
  }

  const [sel, setSel] = useState<ContratoArrendamiento | null>(null)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [contratoOpen, setContratoOpen] = useState(false)
  const puedeCrear = usePuede('arrendadores', 'crear')

  // Contratos que facturan a cada razón social. Se calcula aquí y no dentro de
  // la tarjeta para no recorrer los contratos una vez por propietario.
  const contratosPorRazon = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of contratos ?? []) {
      if (c.razonSocialId) m.set(c.razonSocialId, (m.get(c.razonSocialId) ?? 0) + 1)
    }
    return m
  }, [contratos])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const nombreArr = (id: string) => arrendadores?.find((a) => a.id === id)?.nombre ?? '—'

  // Filtro ÚNICO del módulo. Las tres listas (arrendadores, contratos y pagos)
  // son la misma realidad vista desde distintos ángulos, y la pregunta habitual
  // es «enséñame todo lo de este arrendador». Con un filtro por tarjeta habría
  // que repetirlo tres veces y era fácil dejar dos desalineadas contando
  // historias distintas.
  const [filtro, setFiltro] = useState<FiltroArrendadores>(FILTRO_VACIO)
  const set = (p: Partial<FiltroArrendadores>) => setFiltro((f) => ({ ...f, ...p }))

  const contratosFiltrados = useMemo(
    () => (contratos ? filtrarContratos(contratos, filtro, nombreArr) : undefined),
    [contratos, filtro, arrendadores],
  )
  // Pantallas cubiertas por los contratos visibles (dos anclajes: predio o
  // pantalla suelta). Lo necesita Rentabilidad, que se lista por pantalla.
  const sitiosVisibles = useMemo(
    () => sitiosDeContratos(contratosFiltrados ?? [], sitios ?? []),
    [contratosFiltrados, sitios],
  )
  const margenesFiltrados = useMemo(
    () => (!margenes || !hayFiltro(filtro) ? margenes : margenes.filter((m) => sitiosVisibles.has(m.sitioId))),
    [margenes, filtro, sitiosVisibles],
  )
  const pagosFiltrados = useMemo(
    () => (pagos ? filtrarPagos(pagos, contratosFiltrados ?? [], filtro) : undefined),
    [pagos, contratosFiltrados, filtro],
  )
  // Depende de los contratos YA filtrados: un arrendador se queda si coincide él
  // o si alguno de sus contratos sobrevivió (ver filtrarArrendadores).
  const arrendadoresFiltrados = useMemo(
    () => (arrendadores ? filtrarArrendadores(arrendadores, filtro, contratosFiltrados ?? []) : undefined),
    [arrendadores, filtro, contratosFiltrados],
  )

  // Las razones sociales siguen a sus arrendadores visibles.
  const razonesFiltradas = useMemo(() => {
    if (!razones || !hayFiltro(filtro)) return razones
    const ids = new Set((arrendadoresFiltrados ?? []).map((a) => a.id))
    return razones.filter((r) => ids.has(r.arrendadorId))
  }, [razones, filtro, arrendadoresFiltrados])

  const sitioDe = (id: string) => sitios?.find((s) => s.id === id)

  // Campañas que tienen vendida esa pantalla. Un contrato incompleto lo creó una
  // venta (ADR 0001), y sin decir CUÁL la fila es irreconocible: se ve el nombre
  // del sitio, no el de la campaña que obliga a capturar el contrato.
  const campanasDelSitio = (sitioId: string) => {
    const ids = new Set(
      (reservas ?? []).filter((r) => r.sitioId === sitioId && r.estatus !== 'CANCELADA').map((r) => r.campanaId),
    )
    return (campanas ?? []).filter((c) => ids.has(c.id))
  }

  const porVencer = (contratos ?? []).filter((c) => c.estatus === 'POR_VENCER').length
  const rentaVencida = (pagos ?? []).filter((p) => p.estatus === 'VENCIDO').length

  // Renta mensual comprometida con los propietarios: suma del equivalente
  // mensual de los contratos activos (un contrato anual de 120 000 cuenta como
  // 10 000/mes). Los INCOMPLETO no suman porque su importe aún se desconoce
  // (ADR 0001) — se cuentan aparte para no dar el total por definitivo.
  const activos = (contratos ?? []).filter(
    (c) => c.estatus === 'VIGENTE' || c.estatus === 'POR_VENCER' || c.estatus === 'RENOVADO',
  )
  const rentaMensual = activos.reduce((s, c) => s + (c.montoMensualEquivalente ?? 0), 0)
  const contratosIncompletos = (contratos ?? []).filter((c) => c.estatus === 'INCOMPLETO')
  const incompletos = contratosIncompletos.length
  const faltaEnIncompletos = faltaEnContratos(contratosIncompletos)

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Arrendadores</h1>
          <p className="mt-1 text-[13px] text-muted">El otro lado de la red · contratos, rentas y vencimientos</p>
        </div>
        {puedeCrear && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setNuevoOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo arrendador
            </Button>
            <Button size="sm" onClick={() => setContratoOpen(true)}>
              <FileSignature className="h-3.5 w-3.5" /> Nuevo contrato
            </Button>
          </div>
        )}
      </div>

      {/* Filtro compartido: gobierna arrendadores, contratos y pagos a la vez. */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={filtro.texto}
              onChange={(e) => set({ texto: e.target.value })}
              placeholder="Buscar arrendador, pantalla o RFC…"
              className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <select
            value={filtro.arrendadorId}
            onChange={(e) => set({ arrendadorId: e.target.value })}
            className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Todos los arrendadores</option>
            {(arrendadores ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          <select
            value={filtro.estatus}
            onChange={(e) => set({ estatus: e.target.value })}
            className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Contratos: todos</option>
            {(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'RENOVADO', 'INCOMPLETO', 'CANCELADO'] as const).map((e) => (
              <option key={e} value={e}>{CONTRATO_LABEL[e]}</option>
            ))}
          </select>
          {/* Con un filtro puesto, lo que se ve es un subconjunto: sin decirlo,
              un total parcial se lee como el total. */}
          {hayFiltro(filtro) && (
            <>
              <span className="text-[12px] text-muted">
                {contratosFiltrados?.length ?? 0} de {contratos?.length ?? 0} contratos
              </span>
              <button
                type="button"
                onClick={() => setFiltro(FILTRO_VACIO)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> Limpiar
              </button>
            </>
          )}
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Mini label="Arrendadores" valor={`${arrendadores?.length ?? '—'}`} />
        <Mini label="Contratos" valor={`${contratos?.length ?? '—'}`} />
        {/* B4: la salvedad («no incluye N contratos incompletos») estaba solo en
            una nota al pie, así que el número se citaba fuera de contexto como si
            fuera la renta real. Va pegada al propio KPI: quien lo lea de reojo se
            entera igual. */}
        <Mini
          label="Renta mensual"
          valor={contratos ? formatMonto(rentaMensual) : '—'}
          nota={contratos && incompletos > 0 ? `+ ${incompletos} por capturar` : undefined}
        />
        <Mini label="Por vencer" valor={`${porVencer}`} tono={porVencer ? 'ambar' : undefined} />
        <Mini label="Renta vencida" valor={`${rentaVencida}`} tono={rentaVencida ? 'rojo' : undefined} />
      </div>
      {incompletos > 0 && (
        // El total de arriba NO es el definitivo mientras haya pendientes: si no
        // se dice, se lee como la renta real y se subestima el costo.
        <p className="-mt-1 text-[12px] text-muted">
          La renta mensual no incluye {incompletos} contrato{incompletos === 1 ? '' : 's'} incompleto
          {incompletos === 1 ? '' : 's'}
          {/* Qué falta se DERIVA de los contratos, no se supone: la mayoría de
              los incompletos llega del alta de la pantalla ya con el importe y
              sin vigencia, y el aviso fijo pedía capturar lo que ya estaba. */}
          {faltaEnIncompletos ? `: falta capturar ${faltaEnIncompletos}` : ''}, así que el costo real
          es mayor.
        </p>
      )}

      {/* Propietarios: lista de arrendadores dados de alta (aparecen aquí aunque
          todavía no tengan contrato) */}
      <PropietariosCard arrendadores={arrendadoresFiltrados} contratos={contratosFiltrados ?? []} filtrado={hayFiltro(filtro)} />

      {/* Alta/edición de razones sociales por propietario. Va pegada a la lista
          de propietarios porque es información SUYA; la tarjeta consolidada de
          más abajo es otra cosa: el reporte de lo que se le debe a cada una. */}
      <GestionRazonesSociales
        arrendadores={arrendadoresFiltrados ?? []}
        razones={razonesFiltradas ?? []}
        contratosPorRazon={contratosPorRazon}
        puedeEditar={puedeCrear}
      />

      {/* Rentabilidad por pantalla (P&L: ingreso de reservas activas − renta) */}
      <RentabilidadCard margenes={margenesFiltrados} filtrado={hayFiltro(filtro)} />

      {/* Cuadre de renta (R3.7): qué se le debe a cada propietario, desglosado
          por emplazamiento. Antes solo se podía saber contrato por contrato. */}
      <ConciliacionCard contratosVisibles={contratosFiltrados} />

      {/* Consolidado por razón social (un propietario puede tener varias) */}
      <RazonesSocialesCard
        razones={razonesFiltradas ?? []}
        contratos={contratosFiltrados ?? []}
        pagos={pagosFiltrados ?? []}
        nombreArr={nombreArr}
      />

      {/* Contratos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contratos de arrendamiento</CardTitle>
          {/* Descarga SOLO los vigentes, sin importar el filtro de pantalla: el
              reporte es «que tengo en curso», y un filtro visual no deberia
              cambiar lo que significa el archivo. Los INCOMPLETO quedan fuera a
              proposito (ADR 0001): todavia no son un acuerdo. */}
          <button
            onClick={descargarVigentes}
            disabled={!contratos}
            className="inline-flex items-center gap-1.5 rounded border border-border-strong px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
            title="Descargar los contratos vigentes en Excel"
          >
            <Download className="h-3.5 w-3.5" /> Vigentes en Excel
          </button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!contratosFiltrados ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Arrendador</th>
                    <th className="px-4 py-2 font-medium">Sitio</th>
                    <th className="px-4 py-2 text-right font-medium">Renta</th>
                    <th className="px-4 py-2 font-medium">Cada cuándo</th>
                    <th className="px-4 py-2 font-medium">Vence</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {contratosFiltrados.map((c) => {
                    // Un contrato INCOMPLETO no tiene aún arrendador, importe,
                    // periodicidad ni fecha de fin (ADR 0001): las celdas
                    // muestran «—» en vez de un cero o una fecha inventada.
                    const dias = c.fechaFin ? diasHasta(c.fechaFin) : 0
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSel(c)
                          setOpen(true)
                        }}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5 text-ink">
                          {c.arrendadorId ? nombreArr(c.arrendadorId) : <span className="text-muted">Por definir</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {sitioDe(c.sitioId)?.nombre ?? '—'}
                          {/* Para un pendiente, la campaña que lo originó es el
                              dato que lo hace reconocible y da la urgencia. */}
                          {c.estatus === 'INCOMPLETO' &&
                            (() => {
                              const cs = campanasDelSitio(c.sitioId)
                              if (!cs.length) return null
                              return (
                                <div className="mt-0.5 text-[11px] text-muted">
                                  Vendida en {cs.map((x) => `«${x.nombre}»`).join(', ')}
                                </div>
                              )
                            })()}
                        </td>
                        <td className="demo-num px-4 py-2.5 text-right text-ink">
                          {c.montoRenta != null ? formatMonto(c.montoRenta) : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted">{periodicidadLabel(c.periodicidad)}</td>
                        <td className="demo-num px-4 py-2.5 text-muted">
                          {c.fechaFin ? formatFecha(c.fechaFin) : '—'}
                          {c.estatus === 'POR_VENCER' && (
                            <span className="ml-1 text-[11px] text-warning">({dias}d)</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <StatusBadge tono={CONTRATO_TONO[c.estatus]}>{CONTRATO_LABEL[c.estatus]}</StatusBadge>
                            {/* El badge nombra el problema; esto lo resuelve. La
                                fila entera ya abría el detalle, pero eso había
                                que adivinarlo: un contrato podía quedarse meses
                                en «Incompleto» porque nadie sabía dónde se
                                completaba. */}
                            {c.estatus === 'INCOMPLETO' && (
                              <button
                                type="button"
                                className="rounded border border-border px-2 py-0.5 text-[11px] text-info hover:bg-surface-2"
                                onClick={(e) => {
                                  // La fila también abre el sheet; sin esto se
                                  // dispararían los dos manejadores.
                                  e.stopPropagation()
                                  setSel(c)
                                  setOpen(true)
                                }}
                              >
                                Completar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagos de renta (compartido con Finanzas: es a la vez contrato y
          salida de dinero, y no debe divergir entre las dos pantallas) */}
      <PagosRentaCard onToast={notify} contratosVisibles={contratosFiltrados} />

      <ContratoSheet contrato={sel} open={open} onOpenChange={setOpen} onToast={notify} />
      {nuevoOpen && (
        <NuevoPropietarioDialog onClose={() => setNuevoOpen(false)} onToast={notify} />
      )}
      {contratoOpen && (
        <Modal
          open
          onOpenChange={(v) => !v && setContratoOpen(false)}
          size="lg"
          title="Nuevo contrato de arrendamiento"
          subtitle="Arrendador → contrato (fechas pasadas permitidas) → pantalla"
        >
          <ContratoWizard
            bare
            onCreado={(s) => {
              notify(`Contrato y pantalla "${s.nombre}" creados`)
              setContratoOpen(false)
            }}
          />
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}

// Alta de propietario/arrendador
function NuevoPropietarioDialog({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const inputCls =
    'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'
  const [nombre, setNombre] = useState('')
  const [rfc, setRfc] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  // Datos fiscales: viven en `arrendador_razon_social`, no en el arrendador. Se
  // piden aquí porque es cuando se tienen a la mano; capturarlos después obliga
  // a volver a entrar. Opcionales: el ADR 0001 admite que el contrato nazca
  // pendiente, y exigir el RFC de entrada frenaría altas legítimas.
  const [razonSocial, setRazonSocial] = useState('')
  const [regimen, setRegimen] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El servidor rechaza el RFC mal formado con un 400, pero enterarse después de
  // enviar (y perder el resto del formulario de vista) es peor que verlo al
  // teclear. Misma expresión que usa el servidor: @/lib/rfc.
  const rfcMalo = rfc.trim() !== '' && !esRfcValido(rfc)
  // La razón social se guarda aparte, y sin ella el RFC fiscal no tiene dónde ir.
  const puedeGuardar = !!nombre.trim() && !rfcMalo && !guardando

  async function guardar() {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      const arr = await crearArrendadorApi({
        nombre: nombre.trim(),
        rfc: rfc.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
      })
      // La razón social es un segundo registro. Si falla, el arrendador YA se
      // creó: se avisa en vez de tragarse el error, porque quedaría un
      // arrendador sin datos fiscales y nadie sabría que faltó capturarlos.
      if (razonSocial.trim()) {
        try {
          await crearRazonSocialApi({
            arrendadorId: arr.id,
            razonSocial: razonSocial.trim(),
            // El RFC del arrendador y el de su razón social son el mismo dato
            // fiscal cuando solo hay una: se copia para no pedirlo dos veces.
            rfc: rfc.trim() || null,
            regimen: regimen.trim() || null,
          })
        } catch (e) {
          onToast(
            `Arrendador creado, pero su razón social no: ${
              e instanceof Error ? e.message : 'error desconocido'
            }. Agrégala desde su ficha.`,
          )
          onClose()
          return
        }
      }
      onToast('Propietario agregado')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo arrendador"
      subtitle="Alta de arrendador (dueño del predio)"
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!puedeGuardar} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Nombre / razón social</span>
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">RFC</span>
            <input
              className={cn(inputCls, rfcMalo && 'border-error focus-visible:ring-error')}
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              placeholder="XAXX010101000"
              aria-invalid={rfcMalo}
            />
            {rfcMalo && (
              <span className="mt-1 block text-[11px] text-error">
                Formato inválido. Son 3 letras (empresa) o 4 (persona), fecha AAMMDD y
                3 caracteres de homoclave.
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Teléfono</span>
            <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@arrendador.com" />
        </label>

        {/* Datos fiscales — opcionales. Van a `arrendador_razon_social`, que es
            quien factura la renta; un arrendador puede tener varias. */}
        <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3">
          <div>
            <div className="text-[12px] font-medium text-ink">Datos fiscales (opcional)</div>
            <div className="text-[11px] text-muted">
              Es a quien se le factura la renta. Si lo dejas en blanco, el arrendador
              queda dado de alta igual y puedes capturarlo después desde su ficha.
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Razón social</span>
            <input
              className={inputCls}
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Inmobiliaria Ejemplo SA de CV"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Régimen fiscal</span>
            <input
              className={inputCls}
              value={regimen}
              onChange={(e) => setRegimen(e.target.value)}
              placeholder="601 — General de Ley Personas Morales"
              disabled={!razonSocial.trim()}
            />
            {!razonSocial.trim() && regimen.trim() === '' && (
              <span className="mt-1 block text-[11px] text-muted">
                Se habilita al capturar la razón social: el régimen es de ella.
              </span>
            )}
          </label>
        </div>
      </div>
    </Modal>
  )
}

// Consolidado por razón social: un propietario puede facturar bajo varias
// razones sociales (varias gasolineras/inmuebles). Agrupa sus contratos, predios,
// renta mensual y pagos vencidos.
function RazonesSocialesCard({
  razones, contratos, pagos, nombreArr,
}: {
  razones: { id: string; razonSocial: string; rfc: string | null; arrendadorId: string }[]
  contratos: ContratoArrendamiento[]
  pagos: { contratoId: string; estatus: string }[]
  nombreArr: (id: string) => string
}) {
  const esActivo = (e: string) => e === 'VIGENTE' || e === 'POR_VENCER' || e === 'RENOVADO'
  // Un contrato INCOMPLETO aporta 0 al consolidado: su importe aún se desconoce
  // y `esActivo` ya lo excluye, pero el nulo tiene que ser seguro igualmente.
  const aMensual = (monto: number | null, per: string | null) =>
    monto == null ? 0 : monto * factorMensual(per)
  const filaDe = (id: string | null, nombre: string, rfc: string | null, arrId: string | null) => {
    const cs = contratos.filter((c) => (c.razonSocialId ?? null) === id)
    const activos = cs.filter((c) => esActivo(c.estatus))
    const predios = new Set(cs.map((c) => c.predioId).filter(Boolean)).size
    const rentaMensual = activos.reduce((s, c) => s + aMensual(c.montoRenta, c.periodicidad), 0)
    const cids = new Set(cs.map((c) => c.id))
    const vencidos = pagos.filter((p) => cids.has(p.contratoId) && p.estatus === 'VENCIDO').length
    return { id: id ?? 'sin', nombre, rfc, arr: arrId ? nombreArr(arrId) : '—', total: cs.length, activos: activos.length, predios, rentaMensual, vencidos }
  }
  const filas = razones.map((rs) => filaDe(rs.id, rs.razonSocial, rs.rfc, rs.arrendadorId))
  const sinRs = filaDe(null, 'Sin razón social', null, null)
  const todas = sinRs.total > 0 ? [...filas, sinRs] : filas
  if (todas.length === 0) return null

  return (
    <Card>
      <CardHeader><CardTitle>Por razón social</CardTitle></CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Razón social</th>
                <th className="px-4 py-2 font-medium">Arrendador</th>
                <th className="px-4 py-2 text-center font-medium">Contratos</th>
                <th className="px-4 py-2 text-center font-medium">Predios</th>
                <th className="px-4 py-2 text-right font-medium">Renta mensual</th>
                <th className="px-4 py-2 text-center font-medium">Pagos vencidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {todas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{f.nombre}</div>
                    {f.rfc && <div className="demo-num text-[11px] text-muted">{f.rfc}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{f.arr}</td>
                  <td className="px-4 py-2.5 text-center text-muted">
                    <span className="text-ink">{f.activos}</span> / {f.total}
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted">{f.predios}</td>
                  <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(Math.round(f.rentaMensual))}</td>
                  <td className="px-4 py-2.5 text-center">
                    {f.vencidos > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-[#ef444440] bg-[#ef44441a] px-2 py-0.5 text-[11px] font-medium text-error">{f.vencidos}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function Mini({ label, valor, tono, nota }: { label: string; valor: string; tono?: 'ambar' | 'rojo'; nota?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div
        className={cn(
          'demo-num mt-1 text-2xl font-semibold',
          tono === 'rojo' ? 'text-error' : tono === 'ambar' ? 'text-warning' : 'text-ink',
        )}
      >
        {valor}
      </div>
      {nota && <div className="mt-0.5 text-[11px] text-warning">{nota}</div>}
    </div>
  )
}

// P&L por pantalla: ingreso mensual de reservas activas − renta del arrendador.
function RentabilidadCard({
  margenes,
  filtrado,
}: {
  margenes: MargenSitio[] | undefined
  // Con filtro activo, una lista vacía significa «ninguna coincide», no
  // «no hay pantallas»: son mensajes distintos y confundirlos desorienta.
  filtrado?: boolean
}) {
  // Solo pantallas con contrato o con ingreso activo; peores márgenes primero.
  const filas = (margenes ?? [])
    .filter((m) => m.tieneContrato || m.activo)
    .sort((a, b) => a.margenMensual - b.margenMensual)
  const totalIngreso = filas.reduce((s, m) => s + m.ingresoMensual, 0)
  const totalRenta = filas.reduce((s, m) => s + m.rentaMensual, 0)
  const totalMargen = totalIngreso - totalRenta
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rentabilidad por pantalla</CardTitle>
        <p className="mt-0.5 text-[12px] text-muted">
          Margen mensual = ingreso de reservas vigentes − renta del arrendador. Las de margen negativo son candidatas a renegociar o dar de baja.
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!margenes ? (
          <div className="space-y-2 px-4 pb-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />)}
          </div>
        ) : filas.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">
            {filtrado
              ? 'Ninguna pantalla coincide con el filtro.'
              : 'Sin contratos ni reservas activas todavía.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">Pantalla</th>
                  <th className="px-4 py-2 font-medium">Arrendador</th>
                  <th className="px-4 py-2 text-right font-medium">Ingreso/mes</th>
                  <th className="px-4 py-2 text-right font-medium">Renta/mes</th>
                  <th className="px-4 py-2 text-right font-medium">Margen/mes</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.sitioId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink">{m.nombre}</div>
                      {!m.tieneContrato && <span className="text-[10px] text-muted">sin contrato de renta</span>}
                    </td>
                    <td className="px-4 py-2 text-muted">{m.arrendador ?? '—'}</td>
                    <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(m.ingresoMensual)}</td>
                    <td className="demo-num px-4 py-2 text-right text-muted">{m.rentaMensual ? formatMonto(m.rentaMensual) : '—'}</td>
                    <td className={cn('demo-num px-4 py-2 text-right font-semibold', m.margenMensual < 0 ? 'text-error' : m.margenMensual > 0 ? 'text-[#0f7a55]' : 'text-muted')}>
                      {formatMonto(m.margenMensual)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-2/40 font-medium">
                  <td className="px-4 py-2 text-ink" colSpan={2}>Total</td>
                  <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(totalIngreso)}</td>
                  <td className="demo-num px-4 py-2 text-right text-muted">{formatMonto(totalRenta)}</td>
                  <td className={cn('demo-num px-4 py-2 text-right', totalMargen < 0 ? 'text-error' : 'text-[#0f7a55]')}>{formatMonto(totalMargen)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Lista de propietarios (arrendadores) dados de alta. Se muestran aquí aunque
// aún no tengan contrato — así un alta reciente es visible de inmediato.
function PropietariosCard({
  arrendadores,
  contratos,
  filtrado,
}: {
  arrendadores: ReturnType<typeof useArrendadores>
  contratos: ContratoArrendamiento[]
  // Hay un filtro activo: cambia lo que significa una lista vacía.
  filtrado: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Arrendadores</CardTitle>
        <p className="mt-0.5 text-[12px] text-muted">Dueños de predio dados de alta.</p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {!arrendadores ? (
          <div className="space-y-2 px-4 pb-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        ) : arrendadores.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">
            {/* Distinguir «no hay ninguno» de «ninguno coincide» importa: el
                primer mensaje, mostrado con un filtro puesto, afirma algo falso
                y manda a dar de alta un arrendador que ya existe. */}
            {filtrado
              ? 'Ningún arrendador coincide con el filtro.'
              : (<>Aún no hay arrendadores. Usa <b>“Nuevo arrendador”</b> para dar de alta uno.</>)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Arrendador</th>
                  <th className="px-4 py-2 font-medium">RFC</th>
                  <th className="px-4 py-2 font-medium">Contacto</th>
                  <th className="px-4 py-2 text-right font-medium">Contratos</th>
                </tr>
              </thead>
              <tbody>
                {arrendadores.map((a) => {
                  const nContratos = contratos.filter((c) => c.arrendadorId === a.id).length
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-ink">{a.nombre}</td>
                      <td className="demo-num px-4 py-2.5 text-muted">{a.rfc || '—'}</td>
                      <td className="px-4 py-2.5 text-muted">
                        {a.email || a.telefono ? (
                          <span>{a.email ?? ''}{a.email && a.telefono ? ' · ' : ''}{a.telefono ?? ''}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="demo-num px-4 py-2.5 text-right text-ink">{nContratos}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
