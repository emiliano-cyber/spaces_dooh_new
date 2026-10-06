'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
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
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Estado de cuenta</CardTitle>
          <p className="mt-0.5 text-[12px] text-muted">{titular}{datos ? ` · ${datos.periodo.etiqueta}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['mes', 'mes-anterior'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMes(m)}
              aria-pressed={mes === m}
              className={cn(
                'rounded border px-2.5 py-1 text-[12px] font-medium',
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
            className="h-8 max-w-[14rem] rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
          >
            <option value="">Todos los clientes</option>
            {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <Button size="sm" variant="secondary" disabled={!datos} onClick={descargar}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {error ? (
          <p className="px-4 pb-4 text-[13px] text-error">{error}</p>
        ) : !r || !datos ? (
          <div className="mx-4 mb-4 h-24 animate-pulse rounded bg-surface-2" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-3 text-[13px] md:grid-cols-5">
              <Renglon k="Saldo al inicio" v={formatMonto(r.saldoInicial)} />
              <Renglon k="+ Facturado" v={formatMonto(r.facturado.monto)} />
              <Renglon k="− Cobrado" v={formatMonto(r.cobrado)} />
              <Renglon k="= Saldo al cierre" v={formatMonto(r.saldoFinal)} fuerte />
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
                        <td className="px-4 py-2 text-ink">{m.tipo === 'factura' ? 'Factura' : 'Pago recibido'}</td>
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
      </CardContent>
    </Card>
  )
}

function Renglon({ k, v, fuerte, tono }: { k: string; v: string; fuerte?: boolean; tono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className={cn('demo-num text-ink', fuerte && 'font-semibold', tono && 'text-error')}>{v}</dd>
    </div>
  )
}
