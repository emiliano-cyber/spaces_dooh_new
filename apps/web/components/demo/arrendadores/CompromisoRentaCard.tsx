'use client'

import Link from 'next/link'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { StatusBadge, CONTRATO_TONO } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useContratos, formatMonto, formatFecha, diasHasta } from '@/lib/data/client'
import { periodicidadLabel } from '@/lib/renta-periodicidad'
import { useIdioma } from '@/lib/i18n/contexto'
import { CLAVE_CONTRATO_ESTATUS } from '@/components/demo/comercial/claves'
import { textoFaltaEnContratos, textoVencimientoRel } from '@/components/demo/arrendadores/etiquetas'

// ============================================================================
//  Compromiso de renta con los propietarios: cuánto se paga por cada pantalla,
//  cada cuánto y hasta cuándo. Es lo COMPROMETIDO (el contrato), distinto de
//  PagosRentaCard, que muestra las cuotas concretas y su vencimiento.
//
//  Hacen falta las dos: un contrato anual de 60 000 se ve aquí como "60 000
//  anual = 5 000/mes", y allá como la cuota única del año. Sin esta tarjeta,
//  Finanzas no puede responder "¿cuánto me cuesta la renta al mes?" hasta que
//  existan cuotas generadas.
// ============================================================================
const ACTIVOS = ['VIGENTE', 'POR_VENCER', 'RENOVADO']

export function CompromisoRentaCard() {
  const contratos = useContratos()
  // Finanzas ve los contratos pero completarlos es de Arrendadores: el enlace
  // solo se ofrece a quien puede llegar a esa pantalla.
  const puedeCompletar = usePuede('arrendadores', 'ver')
  const { idioma, t } = useIdioma()

  if (!contratos) {
    return (
      // Mismo `id` y título que la tarjeta ya cargada: si la persona la dejó
      // plegada, no debe abrirse mientras cargan los contratos.
      <CardColapsable
        id="finanzas.renta-comprometida"
        titulo={t('arrendadores.compromiso.titulo')}
        contentClassName="space-y-2"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
        ))}
      </CardColapsable>
    )
  }

  const activos = contratos.filter((c) => ACTIVOS.includes(c.estatus))
  const incompletos = contratos.filter((c) => c.estatus === 'INCOMPLETO')
  const faltaEnIncompletos = textoFaltaEnContratos(incompletos, t)
  // Los VENCIDOS se LISTAN pero no se SUMAN. Antes se filtraban por completo y
  // desaparecían de Finanzas: un contrato caducado dejaba de existir en la
  // pantalla justo cuando hay que decidir si se renueva o se deja morir, y si
  // arrastra cuotas impagas se sigue debiendo dinero sobre él. Fuera del total
  // porque ese número es el compromiso VIGENTE al mes; incluirlos lo inflaría
  // con renta que ya no se devenga. CANCELADO sí queda fuera: se rompió el
  // acuerdo, no hay nada que renovar ni que pagar.
  const vencidos = contratos.filter((c) => c.estatus === 'VENCIDO')
  const totalMes = activos.reduce((s, c) => s + (c.montoMensualEquivalente ?? 0), 0)
  // Los que vencen antes se atienden primero, así que arriba. Los vencidos
  // quedan al principio por su propia fecha, que es donde deben estar.
  const orden = [...activos, ...vencidos].sort((a, b) =>
    (a.fechaFin ?? '').localeCompare(b.fechaFin ?? ''),
  )

  return (
    <CardColapsable
      id="finanzas.renta-comprometida"
      titulo={t('arrendadores.compromiso.titulo')}
      contentClassName="px-0 pb-0"
      resumen={
        <span className="demo-num text-[13px] font-semibold text-ink">
          {formatMonto(totalMes, idioma)}<span className="text-[11px] font-normal text-muted">{t('arrendadores.comun.mes')}</span>
        </span>
      }
    >
        {orden.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-muted">
            {t('arrendadores.compromiso.vacio')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">{t('arrendadores.comun.pantalla')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('arrendadores.comun.renta')}</th>
                  <th className="px-4 py-2 font-medium">{t('arrendadores.comun.cada-cuando')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('arrendadores.compromiso.equivale')}</th>
                  <th className="px-4 py-2 font-medium">{t('arrendadores.comun.vence-contrato')}</th>
                  <th className="px-4 py-2 font-medium">{t('arrendadores.comun.estatus')}</th>
                </tr>
              </thead>
              <tbody>
                {orden.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-ink">{c.sitioNombre ?? '—'}</td>
                    <td className="demo-num px-4 py-2.5 text-right text-ink">
                      {c.montoRenta != null ? formatMonto(c.montoRenta, idioma) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{periodicidadLabel(c.periodicidad, '—', idioma)}</td>
                    {/* La columna que permite comparar peras con manzanas: un
                        contrato anual y uno mensual solo son comparables una vez
                        normalizados a mes. */}
                    <td className="demo-num px-4 py-2.5 text-right text-muted">
                      {c.montoMensualEquivalente != null
                        ? t('arrendadores.comun.monto-mes', { monto: formatMonto(c.montoMensualEquivalente, idioma) })
                        : '—'}
                    </td>
                    {/* Cuándo vence el CONTRATO (no la cuota). El "faltan N
                        días" es lo que convierte una fecha en una prioridad:
                        rojo si ya venció, ámbar dentro de los 90 días con los
                        que el sistema marca POR_VENCER, que es el margen con el
                        que se alcanza a renegociar con el propietario. */}
                    <td className="demo-num px-4 py-2.5 text-muted">
                      {c.fechaFin ? (
                        <>
                          {formatFecha(c.fechaFin, idioma)}
                          <span
                            className={
                              c.estatus === 'VENCIDO'
                                ? 'ml-1.5 font-medium text-error'
                                : c.estatus === 'POR_VENCER'
                                  ? 'ml-1.5 font-medium text-warning'
                                  : 'ml-1.5 text-muted'
                            }
                          >
                            {textoVencimientoRel(diasHasta(c.fechaFin), t)}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tono={CONTRATO_TONO[c.estatus]}>
                        {t(CLAVE_CONTRATO_ESTATUS[c.estatus])}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* El total y la tabla NO cubren lo mismo, y callarlo invita a sumar la
            columna "Equivale a" y no cuadrar. Se dice qué queda fuera y por qué
            lado falla la cuenta en cada caso. */}
        {incompletos.length > 0 && (
          // Sin esto el total se lee como el costo real y se subestima el gasto.
          <p className="px-4 py-2.5 text-[12px] text-muted">
            {/* Igual que en Arrendadores: qué falta se deriva, no se supone. */}
            {faltaEnIncompletos
              ? t(
                  incompletos.length === 1
                    ? 'arrendadores.compromiso.incompletos-falta.uno'
                    : 'arrendadores.compromiso.incompletos-falta.otros',
                  { n: incompletos.length, falta: faltaEnIncompletos },
                )
              : t(incompletos.length === 1 ? 'arrendadores.compromiso.incompletos.uno' : 'arrendadores.compromiso.incompletos.otros', {
                  n: incompletos.length,
                })}{' '}
            {puedeCompletar && (
              <Link href="/arrendadores" className="text-info hover:underline">
                {t('arrendadores.comun.completar-informacion')}
              </Link>
            )}
          </p>
        )}
        {vencidos.length > 0 && (
          <p className="px-4 py-2.5 text-[12px] text-muted">
            {t(vencidos.length === 1 ? 'arrendadores.compromiso.vencidos.uno' : 'arrendadores.compromiso.vencidos.otros', {
              n: vencidos.length,
            })}
          </p>
        )}
    </CardColapsable>
  )
}
