'use client'

import { toast } from 'sonner'
import { Fragment, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, FileText, Lock, Receipt } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { EmptyState } from '@/components/demo/EmptyState'
import type { Cobranza, Factura, EstCobranza } from '@/lib/data/types'
import {
  StatusBadge,
  COBRANZA_TONO,
  COBRANZA_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { armarListaFacturas, cuentaPorEstatus } from '@/components/demo/finanzas/facturas-lista'
import { etiquetaVencimiento, type TonoVencimiento } from '@/components/demo/finanzas/vencimiento-cuota'
import { ComprobanteDialog } from '@/components/demo/finanzas/ComprobanteDialog'
import { TableroPeriodo } from '@/components/demo/finanzas/TableroPeriodo'
import { ChipConteo } from '@/components/demo/finanzas/ChipConteo'
import { EstadoCuenta } from '@/components/demo/finanzas/EstadoCuenta'
import { CampoComprobante, PagosCobranzaModal } from '@/components/demo/finanzas/ComprobantePago'
import { generarFacturaApi, recordarCobranzaApi, pagarCobranzaApi } from '@/lib/data/estado-api'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useCandado, PasoContrasena } from '@/components/demo/ui/candado'
import { PagosRentaCard } from '@/components/demo/arrendadores/PagosRentaCard'
import { CompromisoRentaCard } from '@/components/demo/arrendadores/CompromisoRentaCard'
import {
  repartirCuotas, PERIODICIDAD_LABEL, duracionMeses, opcionesParcialidad,
  type PeriodicidadCuota,
} from '@/lib/finanzas-calculo'
import {
  useCampanasResumen,
  useFacturas,
  useCobranzas,
  useClientes,
  useConfigNegocio,
  useEntidadesFiscales,
  estadoCobranza,
  saldoCobranza,
  formatMonto,
  formatFecha,
  diasHasta,
  type Campana,
} from '@/lib/data/client'
import type { EntidadUI } from '@/components/demo/razones-sociales/gestion'
import {
  ROL_COMPROBANTE,
  SIN_ASIGNAR,
  entidadPreseleccionada,
  etiquetaAsignacion,
  opcionesDeAsignacion,
} from '@/components/demo/razones-sociales/asignacion'

export default function FinanzasPage() {
  const resumen = useCampanasResumen()
  const entidades = useEntidadesFiscales()
  const facturas = useFacturas()
  const cobranzas = useCobranzas()
  const clientes = useClientes()
  const puedeFacturar = usePuede('finanzas', 'facturar')
  const puedeCobrar = usePuede('finanzas', 'crear')

  const [facturar, setFacturar] = useState<Campana | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [recordando, setRecordando] = useState<string | null>(null)
  const [pagoCob, setPagoCob] = useState<{ id: string; folio: string; saldo: number } | null>(null)
  const [pagosDe, setPagosDe] = useState<{ id: string; folio: string } | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  async function recordar(id: string) {
    setRecordando(id)
    try {
      await recordarCobranzaApi(id)
      notify('Recordatorio de cobro enviado')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo enviar el recordatorio')
    } finally {
      setRecordando(null)
    }
  }

  const cliNombre = (id: string) => clientes?.find((c) => c.id === id)?.nombre ?? '—'

  // ─── Cobranza agrupada por factura (M7) ────────────────────────────────────
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const alternar = (id: string) =>
    setExpandidas((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const grupos = useMemo(() => {
    if (!cobranzas || !facturas) return []
    // Índice por id: `facturas.find(...)` dentro del map recorría el arreglo
    // entero por cada cuota — con 12 cuotas de 30 facturas son 360 barridos.
    const porId = new Map(facturas.map((fx) => [fx.id, fx]))
    const acc = new Map<string, { factura: typeof facturas[number] | undefined; cuotas: typeof cobranzas }>()
    for (const c of cobranzas) {
      const g = acc.get(c.facturaId) ?? { factura: porId.get(c.facturaId), cuotas: [] }
      g.cuotas.push(c)
      acc.set(c.facturaId, g)
    }
    return [...acc.values()]
      .map((g) => {
        const cuotas = [...g.cuotas].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
        const pendientes = cuotas.filter((c) => estadoCobranza(c) !== 'PAGADA')
        // El estado del grupo es el PEOR de sus cuotas: una factura con once
        // cuotas al corriente y una vencida está vencida, y mostrarla en verde
        // sería justo el semáforo mentiroso que la auditoría reprocha.
        const estados = cuotas.map(estadoCobranza)
        const estado: EstCobranza = estados.includes('VENCIDA') ? 'VENCIDA'
          : estados.includes('POR_VENCER') ? 'POR_VENCER'
          : estados.every((e) => e === 'PAGADA') ? 'PAGADA'
          : 'AL_CORRIENTE'
        return {
          factura: g.factura,
          cuotas,
          estado,
          total: cuotas.reduce((a, c) => a + (c.monto ?? g.factura?.monto ?? 0), 0),
          pagadas: cuotas.length - pendientes.length,
          proxima: pendientes[0]?.fechaVencimiento ?? null,
        }
      })
      // Primero lo que vence antes; las totalmente pagadas, al final.
      .sort((a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999'))
  }, [cobranzas, facturas])

  // ─── Facturas emitidas ──────────────────────────────────────────────────────
  // Hasta el 2026-09-29 una factura emitida solo se veia dentro de «Cobranza»,
  // que se lee como cuentas por cobrar: quien acababa de emitir una y buscaba
  // «Facturas» concluia que no se habia guardado. El armado vive en
  // `components/demo/finanzas/facturas-lista.ts` para poder probarlo sin DOM.
  const filasFactura = useMemo(
    () =>
      armarListaFacturas(
        facturas,
        clientes,
        (resumen ?? []).map((r) => r.campana),
        // `EntidadFiscal` guarda el nombre en `razonSocial`, no en `nombre`:
        // lo delato el typecheck al enchufarlo. Se traduce aqui y no se
        // ensancha el tipo del modulo, que asi sirve para cualquier catalogo.
        (entidades ?? []).map((e) => ({ id: e.id, nombre: e.razonSocial })),
      ),
    [facturas, clientes, resumen, entidades],
  )
  const cuentaFactura = useMemo(() => cuentaPorEstatus(facturas), [facturas])
  const [verFactura, setVerFactura] = useState<string | null>(null)


  // Listas para facturar: candado encendido y sin factura todavía.
  const listas =
    resumen?.filter(
      (r) => r.candado && !(facturas ?? []).some((f) => f.campanaId === r.campana.id),
    ) ?? []

  // Conteo de semáforo de cobranza.
  const cuenta = { AL_CORRIENTE: 0, POR_VENCER: 0, VENCIDA: 0, PAGADA: 0 }
  for (const c of cobranzas ?? []) cuenta[estadoCobranza(c)]++

  // «Ver todas (N)» como el Dashboard, en vez de una tabla que crece sin
  // aviso. Es solo cuántas filas se PINTAN: la lista y su orden son los de
  // `armarListaFacturas`.
  const [todasLasFacturas, setTodasLasFacturas] = useState(false)
  const facturasVisibles = todasLasFacturas ? filasFactura : filasFactura.slice(0, FACTURAS_A_LA_VISTA)

  // Rediseño del 2026-10-26 · «Listas para facturar» VACÍA ocupaba un
  // EmptyState de ~200 px por encima de lo accionable (cobrar lo vencido).
  // Con campañas listas se queda arriba, que es donde hay que actuar; vacía,
  // baja al final y se reduce a una línea. Mismo contenido y mismo botón.
  const hayListas = !resumen || listas.length > 0
  const tarjetaListas = (
    <CardColapsable
      id="finanzas.listas-para-facturar"
      titulo="Listas para facturar"
      icono={<Lock className="h-4 w-4 text-muted" />}
    >
        {!resumen ? (
          <div className="h-16 animate-pulse rounded bg-surface-2" />
        ) : listas.length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <FileText className="h-4 w-4 shrink-0" />
            Nada por facturar ahora. Cuando una campaña complete su candado (OC + fotos + reporte) aparecerá aquí.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {listas.map((r) => (
              <li
                key={r.campana.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{r.campana.nombre}</div>
                  <div className="demo-num text-[11px] text-muted">
                    {r.clienteNombre} ·{' '}
                    {r.campana.presupuestoBruto ? `${formatMonto(r.campana.presupuestoBruto)} · IVA inc.` : '—'}
                  </div>
                </div>
                {puedeFacturar ? (
                  <Button size="sm" onClick={() => setFacturar(r.campana)}>
                    <Receipt className="h-3.5 w-3.5" /> Generar factura
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted">Lista · requiere Finanzas</span>
                )}
              </li>
            ))}
          </ul>
        )}
    </CardColapsable>
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Finanzas</h1>
        <p className="mt-1 text-[13px] text-muted">Facturación, cobranza y renta a arrendadores</p>
      </div>

      {/* Lo primero que se ve: cómo va el periodo (06/10, ADR 0046). */}
      <TableroPeriodo />

      {/* Listas para facturar, solo arriba cuando hay algo que facturar. */}
      {hayListas && tarjetaListas}

      {/* Cobranza. Desde el 2026-10-26 va ANTES que «Facturas»: es lo que pide
          una acción hoy (cobrar lo vencido), y «Facturas» es consulta. */}
      <CardColapsable
        id="finanzas.cobranza"
        titulo="Cobranza"
        contentClassName="px-0 pb-0"
        resumen={
          // Los conteos son de CUOTAS, no de facturas: una factura en tres
          // parcialidades cuenta tres. El resumen del periodo cuenta FACTURAS,
          // y sin decirlo las dos cifras parecían contradecirse.
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted">Cuotas</span>
            <ChipConteo label="Vencidas" n={cuenta.VENCIDA} tono={cuenta.VENCIDA > 0 ? 'error' : 'neutro'} />
            <ChipConteo label="Por vencer" n={cuenta.POR_VENCER} tono={cuenta.POR_VENCER > 0 ? 'ambar' : 'neutro'} />
            <ChipConteo label="Al corriente" n={cuenta.AL_CORRIENTE} />
          </div>
        }
      >
          {!cobranzas || !facturas ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : cobranzas.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">Sin facturas en cobranza.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className={CABECERA}>
                    <th className="px-4 py-2 font-medium">Folio</th>
                    {/* Folio fiscal y RFC solo en pantallas anchas: en cada fila
                        apilaban tres renglones de 10 px y partían el folio.
                        Quién EMITE sigue visible siempre, bajo el folio. */}
                    <th className="hidden px-4 py-2 font-medium xl:table-cell">Folio fiscal</th>
                    <th className="hidden px-4 py-2 font-medium md:table-cell">Cliente</th>
                    <th className="px-4 py-2 text-right font-medium">Monto</th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">Plazo</th>
                    <th className="px-4 py-2 font-medium">Vence</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {/* M7: la misma factura salía repetida una vez por cuota —la
                      auditoría contó F001-CDE401E1 doce veces—, así que la tabla
                      no dejaba ver cuántas facturas hay realmente. Ahora una
                      fila por FACTURA, y sus cuotas se despliegan al pulsarla.
                      Una factura de cuota única no se agrupa: sería un
                      desplegable de un solo elemento. */}
                  {grupos.map((g) => {
                    const abierta = expandidas.has(g.factura?.id ?? '')
                    if (g.cuotas.length === 1) {
                      return <FilaCuota key={g.cuotas[0].id} cob={g.cuotas[0]} fac={g.factura} entidades={entidades ?? []} cliNombre={cliNombre} puedeCobrar={puedeCobrar} recordando={recordando} onPagar={setPagoCob} onVerPagos={setPagosDe} onRecordar={recordar} />
                    }
                    return (
                      <Fragment key={g.factura?.id ?? g.cuotas[0].id}>
                        <tr
                          className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                          onClick={() => alternar(g.factura?.id ?? '')}
                        >
                          <td className="px-4 py-2.5 align-top">
                            <span className="demo-num inline-flex items-center gap-1.5 whitespace-nowrap text-ink">
                              <ChevronRight className={cn('h-3.5 w-3.5 text-muted transition-transform', abierta && 'rotate-90')} />
                              {g.factura?.folio ?? '—'}
                            </span>
                            <div className="text-[11px] text-muted md:hidden">{g.factura ? cliNombre(g.factura.clienteId) : '—'}</div>
                            {/* Quién EMITIÓ el comprobante: una de MIS razones
                                sociales, no la del cliente (ésa es `rfc` y va
                                arriba). Se PINTA el hueco — las facturas
                                anteriores al 2026-09-17 están «sin asignar» y
                                no se sabe a nombre de quién salieron. */}
                            <div className="text-[11px] text-muted">
                              Emite: {etiquetaAsignacion(entidades ?? [], g.factura?.entidadEmisoraId)}
                            </div>
                          </td>
                          <td className="hidden px-4 py-2.5 align-top xl:table-cell">
                            <div className="demo-num whitespace-nowrap text-[11px] text-muted" title={g.factura?.folioFiscal ?? ''}>
                              {g.factura?.folioFiscal ? `${g.factura.folioFiscal.slice(0, 13)}…` : '—'}
                            </div>
                            {g.factura?.rfc && <div className="demo-num text-[11px] text-muted">{g.factura.rfc}</div>}
                          </td>
                          <td className="hidden px-4 py-2.5 align-top text-muted md:table-cell">{g.factura ? cliNombre(g.factura.clienteId) : '—'}</td>
                          <td className="demo-num whitespace-nowrap px-4 py-2.5 text-right align-top text-ink">
                            {formatMonto(g.total)}
                            <div className="text-[11px] text-muted">
                              {g.pagadas} de {g.cuotas.length} cuotas pagadas
                            </div>
                          </td>
                          <td className="demo-num hidden whitespace-nowrap px-4 py-2.5 align-top text-muted lg:table-cell">{g.cuotas[0].plazoDias} días</td>
                          <td className="demo-num whitespace-nowrap px-4 py-2.5 align-top text-muted">
                            {/* La fecha del GRUPO es la de la próxima cuota sin
                                pagar: es la que dice cuándo hay que actuar. */}
                            {g.proxima ? formatFecha(g.proxima) : '—'}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <StatusBadge tono={COBRANZA_TONO[g.estado]}>{COBRANZA_LABEL[g.estado]}</StatusBadge>
                          </td>
                        </tr>
                        {abierta && g.cuotas.map((c) => <FilaCuota key={c.id} cob={c} fac={g.factura} entidades={entidades ?? []} sangrada cliNombre={cliNombre} puedeCobrar={puedeCobrar} recordando={recordando} onPagar={setPagoCob} onVerPagos={setPagosDe} onRecordar={recordar} />)}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </CardColapsable>

      {/* Facturas emitidas */}
      <CardColapsable
        id="finanzas.facturas"
        titulo="Facturas"
        contentClassName="px-0 pb-0"
        resumen={
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipConteo label="Emitidas" n={cuentaFactura.EMITIDA} />
            <ChipConteo label="Pagadas" n={cuentaFactura.PAGADA} tono={cuentaFactura.PAGADA > 0 ? 'verde' : 'neutro'} />
            <ChipConteo label="Anuladas" n={cuentaFactura.ANULADA} />
          </div>
        }
      >
          {!facturas ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : filasFactura.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState
                icon={FileText}
                titulo="Todavía no hay facturas"
                detalle="Aquí aparecerán en cuanto emitas la primera desde «Listas para facturar»."
              />
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className={CABECERA}>
                    <th className="px-4 py-2 font-medium">Folio</th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">Folio fiscal</th>
                    <th className="px-4 py-2 font-medium">Emitida</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Campaña</th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">La emite</th>
                    <th className="px-4 py-2 text-right font-medium">Monto</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasVisibles.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setVerFactura(f.id)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2"
                      title="Ver el comprobante"
                    >
                      {/* `whitespace-nowrap` en folio y monto: sin él el monto
                          se partía en dos renglones («$» arriba, cifra abajo),
                          visto en pantalla el 2026-10-26. */}
                      <td className="demo-num whitespace-nowrap px-4 py-2.5 font-medium text-ink">{f.folio}</td>
                      <td className="demo-num hidden px-4 py-2.5 text-[11px] text-muted lg:table-cell">{f.folioFiscal}</td>
                      {/* Formateada: llegaba cruda del servidor (`2026-10-01T06:00:00.000Z`), visto en el navegador el 06/10. */}
                      <td className="demo-num whitespace-nowrap px-4 py-2.5 text-muted">{formatFecha(f.fechaEmision)}</td>
                      <td className="px-4 py-2.5 text-muted">{f.cliente}</td>
                      <td className="px-4 py-2.5 text-muted">{f.campana}</td>
                      <td className="hidden px-4 py-2.5 text-muted lg:table-cell">{f.emisora}</td>
                      <td className="demo-num whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatMonto(f.monto)}</td>
                      <td className="px-4 py-2.5">
                        {/* El semáforo único de la app (`StatusBadge`) en vez de
                            un chip con hex propios. La anulada conserva el
                            tachado: el texto ya lo dice, el tachado lo subraya. */}
                        <StatusBadge
                          tono={f.estatus === 'PAGADA' ? 'verde' : f.estatus === 'ANULADA' ? 'neutro' : 'azul'}
                          className={cn('whitespace-nowrap', f.estatus === 'ANULADA' && 'line-through')}
                        >
                          {f.estatus === 'PAGADA' ? 'Pagada' : f.estatus === 'ANULADA' ? 'Anulada' : 'Emitida'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filasFactura.length > FACTURAS_A_LA_VISTA && (
              <div className="border-t border-border px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setTodasLasFacturas((v) => !v)}
                  className="text-[12px] font-medium text-info hover:underline"
                >
                  {todasLasFacturas ? 'Ver menos' : `Ver todas (${filasFactura.length})`}
                </button>
              </div>
            )}
            </>
          )}
      </CardColapsable>

      <ComprobanteDialog
        factura={(facturas ?? []).find((f) => f.id === verFactura) ?? null}
        campanas={(resumen ?? []).map((r) => r.campana)}
        entidades={entidades ?? []}
        onOpenChange={(v) => !v && setVerFactura(null)}
        formatMonto={formatMonto}
      />

      {/* Lo COMPROMETIDO: cuánto se paga por cada pantalla y cada cuánto, con
          todo normalizado a mes para poder compararlo y sumarlo. Va antes que
          las cuotas porque responde la pregunta de arriba: cuánto cuesta la
          renta al mes. */}
      {/* Estado de cuenta de este mes y del pasado, de la empresa o de un
          cliente (06/10, ADR 0046). Va después de la cobranza, que es de
          donde salen sus movimientos. */}
      <EstadoCuenta />

      <CompromisoRentaCard />

      {/* Renta a los propietarios: la otra mitad del flujo de caja. Cobranza
          es lo que ENTRA; esto es lo que SALE y cuándo vence. Mismo componente
          que en Arrendadores para que las reglas no diverjan; aquí se listan
          solo las pendientes, que es lo que Finanzas tiene que programar. */}
      <PagosRentaCard
        soloPendientes
        titulo="Renta por pagar a propietarios"
        onToast={notify}
      />

      {/* Vacía, «Listas para facturar» va al final y en una línea. */}
      {!hayListas && tarjetaListas}

      <GenerarFacturaDialog
        // `key` con la campaña: obliga a REMONTAR el diálogo cada vez que se
        // elige una. Sin esto monta con la página —vive fuera del `&&` y solo
        // devuelve `null` cuando no hay campaña—, así que su estado inicial se
        // calculaba cuando el store todavía no había hidratado: `entidades`
        // llegaba vacío y la razón social emisora salía «sin asignar» AUNQUE
        // hubiera una sola que vende. MEDIDO el 2026-09-18 mirando la pantalla:
        // el selector marcaba la recomendada en la lista y no la preseleccionaba.
        //
        // La alternativa —recalcular en cada render— sobrescribiría la que quien
        // factura hubiera elegido a mano, que es peor: emitiría a nombre de otra
        // sociedad sin avisar.
        key={facturar?.id ?? 'ninguna'}
        campana={facturar}
        entidades={entidades ?? []}
        onClose={() => setFacturar(null)}
        onDone={() => notify('Factura generada')}
      />

      {pagoCob && (
        <PagoModal
          cob={pagoCob}
          onClose={() => setPagoCob(null)}
          onDone={(msg) => { notify(msg); setPagoCob(null) }}
        />
      )}

      {pagosDe && (
        <PagosCobranzaModal
          cobranzaId={pagosDe.id}
          folio={pagosDe.folio}
          puedeAdjuntar={puedeCobrar}
          onClose={() => setPagosDe(null)}
        />
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

// Cuántas facturas se pintan antes de «Ver todas (N)». Diez, como pide el
// rediseño del 2026-10-26; el Dashboard usa el mismo gesto con sus listas.
const FACTURAS_A_LA_VISTA = 10

// Cabecera de tabla común a las tablas de Finanzas (rediseño 2026-10-26): hasta
// entonces «Facturas» iba sin mayúsculas y «Cobranza» con ellas.
const CABECERA = 'border-b border-border text-[11px] uppercase tracking-wide text-muted'

function GenerarFacturaDialog({
  campana,
  entidades,
  onClose,
  onDone,
}: {
  campana: Campana | null
  /** Las razones sociales del OWNER: cuál de ellas EMITE este comprobante. */
  entidades: EntidadUI[]
  onClose: () => void
  onDone: (folio: string) => void
}) {
  // CFG-01 · los plazos los pone la ORGANIZACIÓN, no el código. Estaban a fuego
  // (`([60, 90, 120] as const).map(...)`) mientras Administración dejaba
  // capturarlos: quien configuraba 45 días no veía el botón, y si llegaba a
  // mandarlo el servidor se lo rechazaba. Se arreglan los dos lados a la vez —
  // dejar solo el servidor daría una pantalla que sigue sin ofrecer lo suyo.
  //
  // El respaldo cuando la lista viene vacía y la regla del plazo por omisión son
  // LOS MISMOS del servidor (`lib/server/config-repo.ts` →
  // `PLAZOS_COBRANZA_RESPALDO` / `plazoPorDefecto`). Están duplicados aquí a
  // propósito: aquel módulo es `server-only` y no se puede importar desde un
  // componente de cliente. Si uno cambia, cambia el otro — o la pantalla vuelve
  // a ofrecer un plazo que el servidor rechaza.
  const config = useConfigNegocio()
  const plazos = useMemo(() => {
    const suyos = (config?.plazosCobranza ?? [])
      .map(Number)
      .filter((p) => Number.isFinite(p) && p >= 0)
    return suyos.length ? suyos : [60, 90, 120]
  }, [config])
  const [plazoElegido, setPlazoElegido] = useState<number | null>(null)
  // No se guarda el default en el useState: `useConfigNegocio()` devuelve
  // `undefined` hasta que hidrata, así que un estado inicial se quedaría con el
  // valor de la semilla aunque después llegara la config de verdad.
  const plazo =
    plazoElegido != null && plazos.includes(plazoElegido)
      ? plazoElegido
      : plazos.includes(90)
        ? 90
        : Math.min(...plazos)
  // B38 · `POST /api/campanas/:id/facturar` pasa por `exigirCambioSensible`
  // (`app/api/campanas/[id]/facturar/route.ts:15`) y este cuadro pintaba el 403
  // como un `toast.error` cualquiera, sin ningún sitio donde teclear la clave.
  // Aquí SÍ había cuadro, así que el campo va DENTRO —no se abre otro encima—:
  // es la misma regla que en «Renovar», con distinto envase. Ver el encabezado
  // de `components/demo/ui/candado.tsx`.
  const candado = useCandado()
  // QUIÉN EMITE el comprobante. La preselección sale de `entidadPreseleccionada`
  // con el papel de VENTAS: si una sola sociedad vende, ésa; si venden dos,
  // NINGUNA — adivinar sería emitir a nombre de la sociedad equivocada, y un
  // comprobante emitido no se deshace.
  //
  // Inicialización perezosa y sin recalcular en cada render: el store hidrata
  // después del primer montaje y recalcular sobrescribiría lo que quien factura
  // ya hubiera elegido a mano.
  const [emisoraId, setEmisoraId] = useState<string>(() =>
    entidadPreseleccionada(entidades, ROL_COMPROBANTE, null),
  )
  // Cobro en parcialidades. Apagado por defecto: el comportamiento de siempre es
  // una sola exhibición, y activarlo tiene que ser una decisión explícita.
  const [enCuotas, setEnCuotas] = useState(false)
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadCuota | ''>('')
  const [primerVenc, setPrimerVenc] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  // Duración de la campaña → qué reparto admite. Sin campaña aún, nada.
  const meses = campana ? duracionMeses(campana.fechaInicio, campana.fechaFin) : 0
  const opciones = opcionesParcialidad(meses)
  const nCuotas = opciones.find((o) => o.periodicidad === periodicidad)?.cuotas ?? 0
  // OBLIG-01 · con parcialidades, el servidor exige periodicidad y primer
  // vencimiento (`finanzas-controller.ts:64` y `:69`). Sin cuotas no hay nada
  // obligatorio: la emisora puede quedar «sin asignar» y el plazo siempre trae
  // uno elegido. Va ANTES del `return null` porque es un hook.
  const ob = useObligatorios({ periodicidad, primerVenc }, [
    { campo: 'periodicidad', si: enCuotas },
    { campo: 'primerVenc', si: enCuotas },
  ])

  if (!campana) return null

  // El primer intento va SIN contraseña: el candado está apagado por defecto en
  // los tenants y preguntar siempre sería fricción inventada. Si el servidor la
  // pide, el paso aparece abajo con lo ya elegido intacto — plazo, emisora y
  // parcialidades se conservan, que es lo que hacía caro el rodeo viejo.
  function emitir() {
    if (!ob.validar()) return
    return candado.ejecutar({
      guardar: () =>
        generarFacturaApi(
          campana!.id,
          // El cast es de tipos, no de valor: `generarFacturaApi` aún declara
          // la unión `60 | 90 | 120` heredada de cuando la lista estaba a
          // fuego, y ensancharla toca `estado-api.ts` y `lib/data/types.ts`,
          // que no son de este cambio. El plazo que viaja ya salió de la
          // configuración del tenant y el servidor lo vuelve a validar.
          plazo as 60 | 90 | 120,
          enCuotas && periodicidad ? { periodicidad, primerVencimiento: primerVenc } : null,
          // Cadena vacía = «sin asignar», y viaja como `null`: el servidor NO
          // adivina cuál de mis sociedades emite.
          emisoraId || null,
        ),
      alLograr: () => {
        onDone('generada')
        onClose()
      },
      // Un fallo que NO es el candado sigue yéndose por el toast de siempre: el
      // cuadro se queda abierto y el error no compite con el campo.
      alFallar: (m) => toast.error(m),
      mensajeSiFalla: 'No se pudo generar la factura',
    })
  }

  return (
    <Modal
      open={!!campana}
      onOpenChange={(v) => !v && onClose()}
      title="Generar factura"
      subtitle={campana.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            // Segunda barrera, la visible. La primera —y la que de verdad
            // corta— es `confirmarConCandado`, que con la clave en blanco
            // devuelve «falta-contrasena» sin llamar a nada.
            disabled={candado.enviando || (candado.reautenticando && !candado.pass)}
            // Confirmar REPITE la emisión que el servidor rechazó, no una
            // nueva: un comprobante emitido no se deshace, así que lo que se
            // confirma tiene que ser exactamente lo que se pidió. Por eso los
            // campos de arriba quedan en solo lectura durante este paso.
            onClick={() => void (candado.reautenticando ? candado.reintentar() : emitir())}
          >
            {candado.reautenticando
              ? 'Confirmar y emitir'
              : candado.enviando
                ? 'Generando…'
                : 'Emitir factura'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Subtotal (neto)</span>
            <span className="demo-num text-ink">
              {campana.presupuestoNeto ? formatMonto(campana.presupuestoNeto) : '—'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted">
              IVA ({campana.presupuestoNeto
                ? Math.round((((campana.presupuestoBruto ?? 0) - campana.presupuestoNeto) / campana.presupuestoNeto) * 100)
                : 16}%)
            </span>
            <span className="demo-num text-ink">
              {campana.presupuestoNeto != null && campana.presupuestoBruto != null
                ? formatMonto(campana.presupuestoBruto - campana.presupuestoNeto)
                : '—'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
            <span className="font-medium text-ink">Total</span>
            <span className="demo-num font-semibold text-ink">
              {campana.presupuestoBruto ? formatMonto(campana.presupuestoBruto) : '—'}
            </span>
          </div>
        </div>
        {/* QUIÉN EMITE el comprobante — una de MIS razones sociales, no la del
            cliente. Va DEBAJO de los importes y no los toca: cambiar el emisor
            no cambia ni el subtotal, ni el IVA, ni el total, que los deriva el
            servidor del presupuesto de la campaña y de la tasa del cliente.
            Emitir es zona R4 y lo único que este selector decide es el nombre
            que va arriba del documento. */}
        <Campo label="Con cuál de tus razones sociales se emite">
          <select
            className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={emisoraId}
            onChange={(e) => setEmisoraId(e.target.value)}
            // En solo lectura mientras se teclea la contraseña: lo que se va a
            // confirmar es la emisión que el servidor rechazó, no otra.
            disabled={candado.reautenticando}
          >
            {opcionesDeAsignacion(entidades, ROL_COMPROBANTE).map((o) => (
              <option key={o.valor || 'sin-asignar'} value={o.valor}>
                {o.etiqueta}
                {o.recomendada ? ' — la que vende' : ''}
              </option>
            ))}
          </select>
          {entidades.length === 0 ? (
            <p className="mt-1 text-[11.5px] text-muted">
              Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales;
              la factura se emite igual y queda «sin asignar».
            </p>
          ) : emisoraId === SIN_ASIGNAR ? (
            <p className="mt-1 text-[11.5px] text-muted">
              Sin elegir, el comprobante queda «sin asignar». No se inventa: hay más de una
              razón social que vende, o ninguna la tiene marcada.
            </p>
          ) : null}
        </Campo>

        {/* Cobro en parcialidades. Las opciones y el nº de cuotas se DERIVAN de
            la duración de la campaña: solo se ofrece lo que da un número entero
            de cuotas y al menos 2. Cobrar en "una parcialidad" no es fraccionar
            nada — eso es el cobro único, que es no marcar la casilla. */}
        <div className="rounded-md border border-border px-3 py-2.5">
          {opciones.length === 0 ? (
            <p className="text-[12px] text-muted">
              Esta campaña dura {meses} {meses === 1 ? 'mes' : 'meses'}: no admite un
              reparto en cuotas iguales, así que se cobra en una sola exhibición.
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={enCuotas}
                  disabled={candado.reautenticando}
                  onChange={(e) => {
                    setEnCuotas(e.target.checked)
                    if (e.target.checked && !periodicidad) setPeriodicidad(opciones[0].periodicidad)
                  }}
                />
                Cobrar en parcialidades
                <span className="text-[11px] text-muted">· campaña de {meses} {meses === 1 ? 'mes' : 'meses'}</span>
              </label>
              {enCuotas && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <Campo label="Cuotas" obligatorio falta={ob.falta('periodicidad')}>
                      <select
                        value={periodicidad}
                        disabled={candado.reautenticando}
                        onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadCuota)}
                        className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink"
                      >
                        {opciones.map((o) => (
                          <option key={o.periodicidad} value={o.periodicidad}>
                            {o.cuotas} cuotas {PERIODICIDAD_LABEL[o.periodicidad]}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Primer vencimiento" obligatorio falta={ob.falta('primerVenc')}>
                      <input
                        type="date" value={primerVenc}
                        disabled={candado.reautenticando}
                        onChange={(e) => setPrimerVenc(e.target.value)}
                        className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink"
                      />
                    </Campo>
                  </div>
                  {campana.presupuestoBruto != null && nCuotas > 0 && (
                    <p className="text-[12px] text-muted">
                      {nCuotas} cuotas de{' '}
                      <span className="demo-num font-medium text-ink">
                        {formatMonto(repartirCuotas(campana.presupuestoBruto, nCuotas)[0])}
                      </span>
                      {' '}(la última ajusta el redondeo) · suman{' '}
                      <span className="demo-num text-ink">{formatMonto(campana.presupuestoBruto)}</span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-ink">
            Plazo de cobranza{enCuotas ? ' (informativo con parcialidades)' : ''}
          </span>
          {/* `flex-wrap` porque la lista ya no son tres botones fijos: una
              organización puede tener seis plazos capturados y sin esto se
              salen del diálogo. `min-w` mantiene legible el que quede solo. */}
          <div className="flex flex-wrap gap-2">
            {plazos.map((p) => (
              <button
                key={p}
                type="button"
                disabled={candado.reautenticando}
                onClick={() => setPlazoElegido(p)}
                className={cn(
                  'min-w-[5rem] flex-1 rounded border px-3 py-2 text-[13px] font-medium transition-colors duration-150 disabled:opacity-60',
                  plazo === p
                    ? 'border-accent bg-[#f59e0b1a] text-ink'
                    : 'border-border-strong text-muted hover:bg-surface-2',
                )}
              >
                {p} días
              </button>
            ))}
          </div>
        </div>

        {/* B38 · el paso de la contraseña, DENTRO del cuadro y debajo de lo que
            se va a confirmar. No pinta nada mientras el servidor no la pida. */}
        <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />
      </div>
    </Modal>
  )
}

// S0-2: registrar pago/abono sobre una cobranza (parcial o total) con saldo.
// Hoy en la hora del NAVEGADOR (la de quien registra), como AAAA-MM-DD.
// `toISOString()` daría el día en UTC: a las 19:00 en México ya sería mañana.
function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function PagoModal({
  cob,
  onClose,
  onDone,
}: {
  cob: { id: string; folio: string; saldo: number }
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [monto, setMonto] = useState(String(Math.round(cob.saldo * 100) / 100))
  // El DÍA en que entró el dinero (ADR 0046): por omisión hoy, y se puede
  // poner el de la transferencia de ayer. El servidor rechaza una fecha futura.
  const [fecha, setFecha] = useState(hoyLocal())
  // COB-COMP · el recibo o la transferencia, opcional. Viaja en el MISMO
  // registro del pago: o entran los dos o ninguno.
  const [comprobante, setComprobante] = useState<{ url: string; nombre: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // B38 · `POST /api/cobranzas/:id/pagar` pasa por `exigirCambioSensible`
  // (`app/api/cobranzas/[id]/pagar/route.ts:15`). Este cuadro pintaba el 403 en
  // el hueco de error de abajo, que decía «vuelve a teclear tu contraseña» sin
  // ningún sitio donde hacerlo. El campo va DENTRO, como en los tres cuadros
  // arreglados el 25/09 por la mañana.
  const candado = useCandado()
  const num = Number(monto)
  const excede = num > cob.saldo + 0.005

  function pagar(total: boolean) {
    setError(null)
    return candado.ejecutar({
      // total → liquida el saldo; parcial → el monto ingresado (el backend lo acota al saldo)
      guardar: () => pagarCobranzaApi(cob.id, total ? undefined : num, fecha || undefined, comprobante?.url ?? null),
      alLograr: () => onDone(total || num >= cob.saldo ? 'Cobranza liquidada' : 'Abono registrado'),
      alFallar: setError,
      mensajeSiFalla: 'No se pudo registrar el pago',
    })
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Registrar pago"
      subtitle={`${cob.folio} · saldo ${formatMonto(cob.saldo)}`}
      footer={
        <div className="flex items-center justify-between">
          {error ? <span className="text-[12px] text-error">{error}</span> : <span />}
          {/* Durante el paso de la contraseña los dos botones de acción se
              retiran y queda UNO solo, que repite la acción pendiente.
              «Liquidar total» y «Registrar abono» NO son lo mismo: si el paso
              dejara elegir otra vez, se podría confirmar un movimiento de
              dinero distinto del que el servidor rechazó. */}
          {candado.reautenticando ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={candado.enviando}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={candado.enviando || (candado.reautenticando && !candado.pass)}
                onClick={() => void candado.reintentar()}
              >
                Confirmar y registrar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={candado.enviando}
                onClick={() => void pagar(true)}
              >
                Liquidar total
              </Button>
              <Button
                size="sm"
                disabled={candado.enviando || !num || num <= 0}
                onClick={() => void pagar(false)}
              >
                {candado.enviando ? 'Guardando…' : 'Registrar abono'}
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        {/* Sin asterisco a propósito: el servidor no exige monto ni fecha
            (`finanzas-controller.ts:21` y `:25`, ausente = liquidar y hoy), y
            los dos llegan ya rellenos con el saldo y la fecha de hoy. */}
        <Campo label="Monto del abono">
          {/* Con coma de miles al teclear (CampoCifra). `monto` sigue siendo la
              cifra sin comas; si no se entiende llega 'NaN' y «Registrar
              abono» queda deshabilitado por el mismo `!num` de siempre. */}
          <CampoCifra
            valor={monto}
            // En solo lectura mientras se teclea la contraseña: lo que se
            // confirma es el importe que el servidor rechazó, no otro.
            disabled={candado.reautenticando}
            onCambio={(crudo) => setMonto(crudo)}
            className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          />
        </Campo>
        <Campo label="Fecha en que se recibió">
          <input
            type="date"
            value={fecha}
            max={hoyLocal()}
            disabled={candado.reautenticando}
            onChange={(e) => setFecha(e.target.value)}
            className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          />
        </Campo>
        <CampoComprobante
          nombre={comprobante?.nombre ?? null}
          // Igual que el importe: mientras se teclea la contraseña se confirma
          // lo que el servidor rechazó, no otra cosa.
          disabled={candado.reautenticando}
          onCambio={(url, nombre) => setComprobante({ url, nombre })}
          onQuitar={() => setComprobante(null)}
        />
        {excede && (
          <p className="text-[12px] text-warning">
            ⚠ El monto excede el saldo ({formatMonto(cob.saldo)}). Solo se aplicará el saldo pendiente.
          </p>
        )}
        <p className="text-[11px] text-muted">
          Al cubrir el saldo total, la cobranza pasa a <b>Pagada</b> y se detienen los recordatorios.
        </p>

        {/* B38 · el paso de la contraseña, DENTRO del cuadro. No pinta nada
            mientras el servidor no la pida. */}
        <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />
      </div>
    </Modal>
  )
}

// Clases escritas enteras: Tailwind solo genera las que encuentra literales.
// Desde el 2026-10-26 pintan la pastilla de días del Dashboard: borde y texto
// con los mismos valores que «Huecos y renovaciones» (`inicio/page.tsx`).
const PASTILLA_TONO: Record<TonoVencimiento, string> = {
  error: 'border-[#ef444440] text-error',
  warning: 'border-[#f59e0b40] text-[#9a6700]',
  muted: 'border-border text-muted',
}

// Una fila de CUOTA: las mismas celdas de siempre, con sangría si va dentro de
// una factura desplegada.
//
// Va en el nivel SUPERIOR del módulo, no dentro de FinanzasPage. Definida
// dentro, React ve un tipo de componente nuevo en cada render del padre y
// desmonta y vuelve a montar TODAS las filas — el DOM entero de la tabla, en
// cada tecla del filtro. Sería justo lo contrario de lo que busca M7. Cuesta
// cinco props y las vale.
function FilaCuota({
cob, fac, entidades, sangrada, cliNombre, puedeCobrar, recordando, onPagar, onVerPagos, onRecordar,
}: {
cob: Cobranza
fac?: Factura
/** Las razones sociales del OWNER, para poder nombrar la que emitio. */
entidades: EntidadUI[]
sangrada?: boolean
cliNombre: (id: string) => string
puedeCobrar: boolean
recordando: string | null
onPagar: (c: { id: string; folio: string; saldo: number }) => void
onVerPagos: (c: { id: string; folio: string }) => void
onRecordar: (id: string) => void
}) {
  const est = estadoCobranza(cob)
  const venc = etiquetaVencimiento(est, diasHasta(cob.fechaVencimiento))
  return (
    <tr className={cn('border-b border-border last:border-0', sangrada && 'bg-surface-2/40')}>
      <td className={cn('px-4 py-2.5 align-top', sangrada && 'pl-10')}>
        <div className={cn('demo-num whitespace-nowrap', sangrada ? 'text-muted' : 'text-ink')}>
          {sangrada ? `Cuota ${cob.numero ?? '—'} de ${cob.totalCuotas ?? '—'}` : fac?.folio ?? '—'}
        </div>
        {!sangrada && (
          <>
            {/* El cliente, bajo el folio, solo donde su columna no cabe. */}
            <div className="text-[11px] text-muted md:hidden">{fac ? cliNombre(fac.clienteId) : '—'}</div>
            {/* Quién EMITIÓ el comprobante. Va tambien AQUI y no solo en la
                fila agrupada: una factura de cuota unica —el caso normal— no se
                agrupa y se pinta por este camino, asi que sin esto el dato solo
                se veia en las de parcialidades. MEDIDO el 2026-09-18 mirando la
                pantalla, no leyendo el codigo. */}
            <div className="text-[11px] text-muted">
              Emite: {etiquetaAsignacion(entidades, fac?.entidadEmisoraId)}
            </div>
          </>
        )}
      </td>
      <td className="hidden px-4 py-2.5 align-top xl:table-cell">
        {!sangrada && (
          <>
            <div className="demo-num whitespace-nowrap text-[11px] text-muted" title={fac?.folioFiscal ?? ''}>
              {fac?.folioFiscal ? `${fac.folioFiscal.slice(0, 13)}…` : '—'}
            </div>
            {fac?.rfc && <div className="demo-num text-[11px] text-muted">{fac.rfc}</div>}
          </>
        )}
      </td>
      <td className="hidden px-4 py-2.5 align-top text-muted md:table-cell">{!sangrada && (fac ? cliNombre(fac.clienteId) : '—')}</td>
      <td className="demo-num whitespace-nowrap px-4 py-2.5 text-right align-top text-ink">
        {/* Con parcialidades, el importe de la fila es el de LA CUOTA, no el
            de la factura entera. */}
        {cob.monto != null ? formatMonto(cob.monto) : fac ? formatMonto(fac.monto) : '—'}
        {cob.montoPagado > 0 && est !== 'PAGADA' && fac && (
          <div className="text-[11px] text-warning">saldo {formatMonto(saldoCobranza(cob, fac))}</div>
        )}
      </td>
      <td className="demo-num hidden whitespace-nowrap px-4 py-2.5 align-top text-muted lg:table-cell">{cob.plazoDias} días</td>
      <td className="demo-num whitespace-nowrap px-4 py-2.5 align-top text-muted">
        {/* El espacio es un carácter de verdad, no solo el margen: `ml-1`
            separa a la vista pero al copiar la celda salía «27/08/2026(24d)»
            pegado, que es lo que reportó M8. */}
        {formatFecha(cob.fechaVencimiento)}{' '}
        {/* El ESTADO manda, no la fecha: una cuota pagada no dice «vencida»
            aunque su fecha haya pasado (06/10, `vencimiento-cuota.ts`).
            Desde el 2026-10-26 es la pastilla de días del Dashboard («Huecos y
            renovaciones»), con el MISMO texto de `etiquetaVencimiento`. */}
        <span className={cn('rounded-full border px-1.5 py-0.5 text-[11px] font-medium', PASTILLA_TONO[venc.tono])}>
          {venc.texto}
        </span>
      </td>
      <td className="px-4 py-2.5 align-top">
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge tono={COBRANZA_TONO[est]} className="whitespace-nowrap">{COBRANZA_LABEL[est]}</StatusBadge>
          {/* COB-COMP · los pagos ya recibidos y su comprobante. Se ve también
              en una cobranza PAGADA: es justo cuando se busca el recibo. */}
          {cob.montoPagado > 0 && (
            <button
              type="button"
              onClick={() => onVerPagos({ id: cob.id, folio: fac?.folio ?? cob.id })}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-info hover:underline"
            >
              <Receipt className="h-3 w-3" /> Pagos y comprobantes
            </button>
          )}
          {est !== 'PAGADA' && puedeCobrar && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* Mismo botón y mismo manejador; solo cambia el color: era un
                  verde con hex sueltos y ahora es el azul de «aceptar» del
                  sistema (convenciones, «Color de los botones»). */}
              <button
                type="button"
                onClick={() => onPagar({ id: cob.id, folio: fac?.folio ?? cob.id, saldo: saldoCobranza(cob, fac) })}
                className="whitespace-nowrap rounded border border-accent bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-fg hover:border-accent-hover hover:bg-accent-hover"
              >
                Registrar pago
              </button>
              <button
                type="button"
                onClick={() => onRecordar(cob.id)}
                disabled={recordando === cob.id}
                className="whitespace-nowrap rounded border border-border-strong bg-surface px-2 py-0.5 text-[11px] text-ink hover:bg-surface-2 disabled:opacity-50"
              >
                {recordando === cob.id ? 'Enviando…' : 'Recordar'}
              </button>
              {cob.recordatoriosEnviados > 0 && (
                <span className="whitespace-nowrap text-[11px] text-muted" title={cob.recordatorioEn ? `Último: ${formatFecha(cob.recordatorioEn)}` : ''}>
                  {cob.recordatoriosEnviados} enviado{cob.recordatoriosEnviados === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
