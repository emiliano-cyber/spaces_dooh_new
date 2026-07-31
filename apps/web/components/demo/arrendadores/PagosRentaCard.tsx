'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { StatusBadge, type Tono } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { usePagosRenta, useContratos, formatMonto, formatFecha, diasHasta } from '@/lib/data/client'
import { registrarPagoRentaApi } from '@/lib/data/estado-api'
import {
  clasificarVencimiento, textoVencimiento, periodicidadLabel,
  type EstadoVencimiento,
} from '@/lib/renta-periodicidad'

// ============================================================================
//  Calendario de pagos de renta a los propietarios: cuánto toca pagar por cada
//  pantalla, cuándo vence y cuánto falta para ello.
//
//  Vive en DOS pantallas a propósito: es patrimonio de Arrendadores (nace del
//  contrato con el propietario) y de Finanzas (es una salida de dinero con
//  vencimiento). Por eso es un componente compartido y no una tabla duplicada:
//  cualquier cambio de reglas se aplica en los dos lados a la vez.
//
//  El nombre de la pantalla viaja denormalizado en el propio pago
//  (`sitioNombre`): ninguno de los dos roles ve necesariamente el inventario, así
//  que no puede resolverlo por su cuenta. Los CONTRATOS sí llegan a ambos
//  (`siAlguno(['arrendadores','finanzas'], listarContratos)` en /api/estado), y
//  de ahí sale la periodicidad que gradúa cuándo un pago pasa a estar "cerca":
//  15 días son mucha antelación para una renta semanal y poca para una anual.
// ============================================================================

// El estado de vencimiento NO es el `estatus` de la BD: añade POR_VENCER, que
// es lo que separa "vence mañana" de "vence en seis meses" (ambos PENDIENTE).
const VENC_TONO: Record<EstadoVencimiento, Tono> = {
  PAGADO: 'verde',
  VENCIDO: 'rojo',
  POR_VENCER: 'ambar',
  PROGRAMADO: 'neutro',
}
const VENC_LABEL: Record<EstadoVencimiento, string> = {
  PAGADO: 'Pagado',
  VENCIDO: 'Vencido',
  POR_VENCER: 'Por vencer',
  PROGRAMADO: 'Programado',
}
// Vencidos primero y, dentro de ellos, el más atrasado arriba; luego lo que está
// por vencer, y al final lo programado. Es el orden en que hay que actuar.
const ORDEN: Record<EstadoVencimiento, number> = {
  VENCIDO: 0, POR_VENCER: 1, PROGRAMADO: 2, PAGADO: 3,
}
export function PagosRentaCard({
  soloPendientes = false,
  titulo = 'Pagos de renta',
  onToast,
  contratosVisibles,
}: {
  // Finanzas trabaja sobre lo que falta por pagar; Arrendadores lleva el
  // histórico completo del contrato.
  soloPendientes?: boolean
  titulo?: string
  onToast?: (msg: string) => void
  // Contratos que sobrevivieron al filtro de la página. Un pago no conoce a su
  // arrendador —cuelga del CONTRATO—, así que filtrar por contratos es lo que
  // mantiene esta tarjeta contando la misma historia que las de arriba.
  // `undefined` = sin filtro (es como lo usa Finanzas, que no tiene barra).
  contratosVisibles?: { id: string }[]
}) {
  const todosLosPagos = usePagosRenta()
  const contratos = useContratos()
  // Registrar el pago es una acción de Arrendadores. Quien solo tenga Finanzas
  // ve el calendario en modo lectura: puede planear la salida de dinero, pero no
  // dar por pagada la renta de un propietario.
  const puedeRegistrar = usePuede('arrendadores', 'crear')
  // Completar un contrato es una acción de Arrendadores, no de Finanzas.
  const puedeCompletar = usePuede('arrendadores', 'ver')
  const [busy, setBusy] = useState<string | null>(null)

  if (!todosLosPagos) {
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

  // Filtro de la página, si lo hay. Se aplica ANTES que todo lo demás para que
  // los contadores del encabezado también hablen del subconjunto visible: un
  // «3 vencidas» calculado sobre todo el universo, junto a una tabla filtrada,
  // se lee como si esas tres estuvieran ahí abajo.
  const visiblesIds = contratosVisibles ? new Set(contratosVisibles.map((c) => c.id)) : null
  const pagos = visiblesIds ? todosLosPagos.filter((p) => visiblesIds.has(p.contratoId)) : todosLosPagos

  // Se cuenta sobre lo VISIBLE cuando hay filtro: junto a una tabla filtrada,
  // un «7 contratos sin importe» calculado sobre todo el universo se lee como si
  // esos 7 fueran los de abajo.
  const contratosDelAlcance = visiblesIds
    ? (contratos ?? []).filter((c) => visiblesIds.has(c.id))
    : (contratos ?? [])
  const incompletos = contratosDelAlcance.filter((c) => c.estatus === 'INCOMPLETO').length
  // Periodicidad y vigencia por contrato: la primera gradúa el aviso de cada
  // cuota; la segunda responde "hasta cuándo estoy comprometido con este pago".
  const contratoDe = new Map((contratos ?? []).map((c) => [c.id, c]))

  const visibles = (soloPendientes ? pagos.filter((p) => p.estatus !== 'PAGADO') : pagos).map((p) => {
    const con = contratoDe.get(p.contratoId)
    const dias = diasHasta(p.periodo)
    return {
      pago: p,
      dias,
      estado: clasificarVencimiento(dias, con?.periodicidad ?? null, p.estatus === 'PAGADO'),
      periodicidad: con?.periodicidad ?? null,
      contratoHasta: con?.fechaFin ?? null,
    }
  })

  const ordenados = [...visibles].sort(
    (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.pago.periodo.localeCompare(b.pago.periodo),
  )

  // Los contadores del encabezado se calculan sobre TODOS los pagos, no sobre
  // los visibles: en Finanzas la tabla oculta los pagados, y contar solo lo
  // visible daría la misma cifra por casualidad hoy y una distinta el día que
  // se filtre por otra cosa.
  const estadoDe = (p: (typeof pagos)[number]) =>
    clasificarVencimiento(
      diasHasta(p.periodo),
      contratoDe.get(p.contratoId)?.periodicidad ?? null,
      p.estatus === 'PAGADO',
    )
  const vencidos = pagos.filter((p) => estadoDe(p) === 'VENCIDO')
  const porVencer = pagos.filter((p) => estadoDe(p) === 'POR_VENCER')
  const porPagar = pagos.filter((p) => p.estatus !== 'PAGADO')
  const totalPorPagar = porPagar.reduce((s, p) => s + p.monto, 0)
  const totalVencido = vencidos.reduce((s, p) => s + p.monto, 0)

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
            {/* El importe vencido va junto al conteo: "3 vencidas" no dice si
                son 900 o 90 000, y es el número con el que se decide qué se
                paga primero. */}
            {vencidos.length > 0 && (
              <span className="font-medium text-error">
                {vencidos.length} vencida{vencidos.length === 1 ? '' : 's'} ({formatMonto(totalVencido)}) ·{' '}
              </span>
            )}
            {porVencer.length > 0 && (
              <span className="font-medium text-warning">{porVencer.length} por vencer · </span>
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
              {incompletos === 1 ? '' : 's'} sin importe capturado.{' '}
              {/* El enlace solo se ofrece a quien puede completarlo de verdad:
                  Finanzas ve estos pagos pero no necesariamente tiene permiso
                  sobre Arrendadores, y mandarlo a una pantalla que le va a dar
                  403 es peor que no ofrecer nada. */}
              {puedeCompletar ? (
                <Link href="/arrendadores" className="text-info hover:underline">
                  Complétalo en Arrendadores
                </Link>
              ) : (
                'Complétalo en Arrendadores'
              )}{' '}
              y el calendario de pagos se genera solo.
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
                  <th className="px-4 py-2 font-medium">Renta</th>
                  <th className="px-4 py-2 font-medium">Vence</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                  <th className="px-4 py-2 font-medium">Estatus</th>
                  <th className="px-4 py-2 font-medium">Contrato hasta</th>
                  <th className="px-4 py-2 font-medium">Pagado el</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {ordenados.map(({ pago: p, dias, estado, periodicidad, contratoHasta }) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-ink">{p.sitioNombre ?? '—'}</td>
                    {/* Cada cuánto se paga esta renta: sin esto, "vence en 5
                        días" no dice si el siguiente pago llega en una semana o
                        en un año. */}
                    <td className="px-4 py-2.5 text-muted">{periodicidadLabel(periodicidad)}</td>
                    <td className="demo-num px-4 py-2.5 text-muted">
                      {formatFecha(p.periodo)}
                      {/* La fecha sola obliga a restar mentalmente contra hoy.
                          Este es el dato que responde "cuál está cerca". */}
                      {estado !== 'PAGADO' && (
                        <span
                          className={
                            estado === 'VENCIDO'
                              ? 'ml-1.5 font-medium text-error'
                              : estado === 'POR_VENCER'
                                ? 'ml-1.5 font-medium text-warning'
                                : 'ml-1.5 text-muted'
                          }
                        >
                          {textoVencimiento(dias)}
                        </span>
                      )}
                    </td>
                    <td className="demo-num px-4 py-2.5 text-right text-ink">{formatMonto(p.monto)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tono={VENC_TONO[estado]}>{VENC_LABEL[estado]}</StatusBadge>
                    </td>
                    {/* Hasta cuándo corre el contrato del que sale esta cuota:
                        dice si habrá más pagos después de este o si toca
                        renovar. Vacío mientras el contrato esté INCOMPLETO. */}
                    <td className="demo-num px-4 py-2.5 text-muted">
                      {contratoHasta ? formatFecha(contratoHasta) : '—'}
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
