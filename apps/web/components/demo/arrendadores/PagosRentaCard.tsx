'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { StatusBadge, PAGO_TONO, PAGO_LABEL } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { usePagosRenta, useContratos, formatMonto, formatFecha } from '@/lib/data/client'
import { registrarPagoRentaApi } from '@/lib/data/estado-api'

// ============================================================================
//  Calendario de pagos de renta a los propietarios: cuánto toca pagar por cada
//  pantalla y cuándo vence. Un pago vencido es dinero que ya se debía.
//
//  Vive en DOS pantallas a propósito: es patrimonio de Arrendadores (nace del
//  contrato con el propietario) y de Finanzas (es una salida de dinero con
//  vencimiento). Por eso es un componente compartido y no una tabla duplicada:
//  cualquier cambio de reglas se aplica en los dos lados a la vez.
//
//  El nombre de la pantalla viaja denormalizado en el propio pago
//  (`sitioNombre`): el rol Finanzas ve los pagos pero NO el inventario ni los
//  contratos, así que no puede resolverlo por su cuenta.
// ============================================================================
export function PagosRentaCard({
  soloPendientes = false,
  titulo = 'Pagos de renta',
  onToast,
}: {
  // Finanzas trabaja sobre lo que falta por pagar; Arrendadores lleva el
  // histórico completo del contrato.
  soloPendientes?: boolean
  titulo?: string
  onToast?: (msg: string) => void
}) {
  const pagos = usePagosRenta()
  const contratos = useContratos()
  // Registrar el pago es una acción de Arrendadores. Quien solo tenga Finanzas
  // ve el calendario en modo lectura: puede planear la salida de dinero, pero no
  // dar por pagada la renta de un propietario.
  const puedeRegistrar = usePuede('arrendadores', 'crear')
  const [busy, setBusy] = useState<string | null>(null)

  if (!pagos) {
    return (
      <Card>
        <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const incompletos = (contratos ?? []).filter((c) => c.estatus === 'INCOMPLETO').length
  const visibles = soloPendientes ? pagos.filter((p) => p.estatus !== 'PAGADO') : pagos
  // Vencidos primero (es lo que urge), luego por fecha de vencimiento.
  const ordenados = [...visibles].sort(
    (a, b) =>
      Number(b.estatus === 'VENCIDO') - Number(a.estatus === 'VENCIDO') ||
      a.periodo.localeCompare(b.periodo),
  )
  const vencidos = pagos.filter((p) => p.estatus === 'VENCIDO')
  const porPagar = pagos.filter((p) => p.estatus !== 'PAGADO')
  const totalPorPagar = porPagar.reduce((s, p) => s + p.monto, 0)

  async function registrar(id: string) {
    setBusy(id)
    try {
      await registrarPagoRentaApi(id)
      onToast?.('Pago registrado')
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : 'No se pudo registrar el pago')
    }
    setBusy(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{titulo}</CardTitle>
        {porPagar.length > 0 && (
          <span className="demo-num text-[12px] text-muted">
            {vencidos.length > 0 && (
              <span className="font-medium text-error">{vencidos.length} vencido{vencidos.length === 1 ? '' : 's'} · </span>
            )}
            {formatMonto(totalPorPagar)} por pagar
          </span>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {ordenados.length === 0 ? (
          // Distinguir "no debes nada" de "no se sabe cuánto debes" es lo
          // importante aquí: sin importe capturado no hay cuotas que calcular, y
          // un "no hay pendientes" a secas se lee como que la renta está al día.
          incompletos > 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">
              No se puede calcular lo que hay que pagar: {incompletos} contrato
              {incompletos === 1 ? '' : 's'} sin importe capturado. Complétalo en
              Arrendadores y el calendario de pagos se genera solo.
            </p>
          ) : (
            <p className="px-4 pb-4 text-[13px] text-muted">
              {soloPendientes ? 'No hay rentas pendientes de pago.' : 'Sin pagos de renta registrados.'}
            </p>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Pantalla</th>
                  <th className="px-4 py-2 font-medium">Vence</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                  <th className="px-4 py-2 font-medium">Estatus</th>
                  <th className="px-4 py-2 font-medium">Pagado el</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-ink">{p.sitioNombre ?? '—'}</td>
                    <td className="demo-num px-4 py-2.5 text-muted">{formatFecha(p.periodo)}</td>
                    <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(p.monto)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tono={PAGO_TONO[p.estatus]}>{PAGO_LABEL[p.estatus]}</StatusBadge>
                    </td>
                    <td className="demo-num px-4 py-2.5 text-muted">
                      {p.fechaPago ? formatFecha(p.fechaPago) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.estatus !== 'PAGADO' && puedeRegistrar && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === p.id}
                          onClick={() => registrar(p.id)}
                        >
                          {busy === p.id ? 'Registrando…' : 'Registrar pago'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
