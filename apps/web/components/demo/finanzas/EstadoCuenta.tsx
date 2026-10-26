'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { useCobranzas, useFacturas, usePagosRenta, formatMonto, formatFecha, useClientes } from '@/lib/data/client'
import { resumenFinanzasApi, type RespuestaResumen } from '@/lib/data/finanzas-periodo-api'
import { csvEstadoCuenta } from './estado-cuenta-csv'

// ============================================================================
//  Estado de cuenta: este mes y el mes pasado (06/10, ADR 0046).
// ----------------------------------------------------------------------------
//  De la EMPRESA (todos los clientes) o de UN cliente. Saldo al inicio, lo
//  facturado, lo cobrado y el saldo al cierre, con cada movimiento —factura o
//  pago— y el saldo corrido. Se descarga en CSV, que abre en Excel.
// ============================================================================

type Mes = 'mes' | 'mes-anterior'

export function EstadoCuenta() {
  const clientes = useClientes()
  const [mes, setMes] = useState<Mes>('mes')
  const [cliente, setCliente] = useState<string>('')
  const [datos, setDatos] = useState<RespuestaResumen | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Se recalcula cuando cambian la cobranza, las facturas o la renta (un pago
  // recién registrado refresca el store): si no, las cifras se quedarían en las
  // de antes del pago hasta cambiar de periodo.
  const cobranzas = useCobranzas()
  const facturas = useFacturas()
  const rentas = usePagosRenta()

  useEffect(() => {
    let vivo = true
    setError(null)
    resumenFinanzasApi({ periodo: mes, cliente: cliente || null })
      .then((d) => { if (vivo) setDatos(d) })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudo calcular el estado de cuenta') })
    return () => { vivo = false }
  }, [mes, cliente, cobranzas, facturas, rentas])

  const nombreCliente = useMemo(() => {
    const m = new Map((clientes ?? []).map((c) => [c.id, c.nombre]))
    return (id: string) => m.get(id) ?? '—'
  }, [clientes])

  const titular = cliente ? nombreCliente(cliente) : 'Todos los clientes'

  function descargar() {
    if (!datos) return
    const csv = csvEstadoCuenta(datos, titular, nombreCliente, !cliente)
    // BOM para que Excel lea los acentos como UTF-8.
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `estado-de-cuenta-${datos.periodo.desde.slice(0, 7)}${cliente ? '-cliente' : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const r = datos?.resumen

  return (
    // Mes, cliente y CSV van en `accion`, fuera de lo que se pliega: su estado
    // vive en este componente, así que plegar no pierde lo elegido.
    <CardColapsable
      id="finanzas.estado-cuenta"
      titulo="Estado de cuenta"
      subtitulo={`${titular}${datos ? ` · ${datos.periodo.etiqueta}` : ''}`}
      contentClassName="px-0 pb-0"
      accion={
        <div className="flex flex-wrap items-center gap-1.5">
          {/* En un teléfono los dos botones, el selector de 14rem y el CSV no
              cabían en la cabecera y empujaban el chevrón fuera de la pantalla
              (medido a 390 px el 2026-10-26). Ahí el mes va en un `<select>`
              con los MISMOS dos valores y el MISMO `setMes`, y el de cliente
              se angosta; desde `sm`, como siempre. */}
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value as Mes)}
            aria-label="Mes"
            className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink sm:hidden"
          >
            <option value="mes">Este mes</option>
            <option value="mes-anterior">Mes pasado</option>
          </select>
          {(['mes', 'mes-anterior'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMes(m)}
              aria-pressed={mes === m}
              className={cn(
                'hidden rounded border px-2.5 py-1 text-[12px] font-medium sm:inline-block',
                mes === m ? 'border-accent bg-accent text-white' : 'border-border-strong bg-surface text-ink hover:bg-surface-2',
              )}
            >
              {m === 'mes' ? 'Este mes' : 'Mes pasado'}
            </button>
          ))}
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            aria-label="Cliente"
            className="h-8 max-w-[8.5rem] rounded border border-border-strong bg-surface px-2 text-[12px] text-ink sm:max-w-[14rem]"
          >
            <option value="">Todos los clientes</option>
            {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <Button size="sm" variant="secondary" disabled={!datos} onClick={descargar}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      }
    >
        {error ? (
          <p className="px-4 pb-4 text-[13px] text-error">{error}</p>
        ) : !r || !datos ? (
          <div className="mx-4 mb-4 h-24 animate-pulse rounded bg-surface-2" />
        ) : (
          <>
            {/* Rediseño del 2026-10-26 · la cuenta se lee como una ecuación en
                la franja secundaria del Dashboard: inicio + facturado − cobrado
                = cierre. Son las mismas cinco cifras del servidor; aquí no se
                suma nada, solo se ponen en una línea. */}
            <dl className="mx-4 mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
              <Renglon k="Saldo al inicio" v={formatMonto(r.saldoInicial)} />
              <Renglon k="+ Facturado" v={formatMonto(r.facturado.monto)} />
              <Renglon k="− Cobrado" v={formatMonto(r.cobrado)} />
              <Renglon k="= Saldo al cierre" v={formatMonto(r.saldoFinal)} fuerte />
              {/* `div` y no `span`: dentro de un `dl` solo valen `div`, `dt` y `dd`. */}
              <div className="hidden text-muted sm:block" aria-hidden>·</div>
              <Renglon k={`Vencido al ${formatFecha(r.corte)}`} v={formatMonto(r.vencido.monto)} tono={r.vencido.monto > 0} />
            </dl>
            {datos.movimientos.length === 0 ? (
              <p className="border-t border-border px-4 py-4 text-[13px] text-muted">Sin facturas ni pagos en {datos.periodo.etiqueta.toLowerCase()}.</p>
            ) : (
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Movimiento</th>
                      <th className="px-4 py-2 font-medium">Folio</th>
                      {!cliente && <th className="px-4 py-2 font-medium">Cliente</th>}
                      <th className="px-4 py-2 text-right font-medium">Cargo</th>
                      <th className="px-4 py-2 text-right font-medium">Abono</th>
                      <th className="px-4 py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.movimientos.map((m, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="demo-num px-4 py-2 text-muted">{formatFecha(m.fecha)}</td>
                        <td className="px-4 py-2 text-ink">
                          {m.tipo === 'factura' ? 'Factura' : 'Pago recibido'}
                          {m.aproximado && (
                            <span className="block text-[10px] text-muted" title="Pago anterior a que el sistema guardara fechas: lleva la fecha de su factura">
                              fecha aproximada
                            </span>
                          )}
                        </td>
                        <td className="demo-num px-4 py-2 text-ink">{m.folio}</td>
                        {!cliente && <td className="px-4 py-2 text-muted">{nombreCliente(m.clienteId)}</td>}
                        <td className="demo-num px-4 py-2 text-right text-ink">{m.cargo ? formatMonto(m.cargo) : ''}</td>
                        <td className="demo-num px-4 py-2 text-right text-success">{m.abono ? formatMonto(m.abono) : ''}</td>
                        <td className="demo-num px-4 py-2 text-right text-ink">{formatMonto(m.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
    </CardColapsable>
  )
}

function Renglon({ k, v, fuerte, tono }: { k: string; v: string; fuerte?: boolean; tono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className="text-muted">{k}</dt>
      <dd className={cn('demo-num text-ink', fuerte && 'font-semibold', tono && 'text-error')}>{v}</dd>
    </div>
  )
}
