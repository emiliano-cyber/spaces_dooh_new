'use client'

import { useState } from 'react'
import { Network, Share2, Cpu, CheckCircle2, Handshake } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import {
  StatusBadge,
  SITIO_TONO,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { toggleNetworkApi } from '@/lib/data/sitios-api'
import { useSitios, useSitiosRed, formatMonto, type CMS } from '@/lib/data/client'
import { etiquetaTipoMedio } from '@/lib/tipo-medio'
import { formatNumero } from '@/lib/formato-numero'

const CMS_LABEL: Record<CMS, string> = {
  BROADSIGN: 'Broadsign',
  INVIDIS: 'Invidis',
  DOOHMAIN: 'Doohmain',
  OTRO: 'Otros',
}

export default function NetworkPage() {
  const sitios = useSitios()
  const sitiosRed = useSitiosRed()
  const [toast, setToast] = useState<string | null>(null)
  // Filtros de pantalla de la tabla de reglas (26/10). Solo deciden qué filas
  // se pintan; no tocan el dato.
  const [fRed, setFRed] = useState<'si' | 'no' | null>(null)
  const [fCom, setFCom] = useState<'PROGRAMATICO' | 'TRADICIONAL' | null>(null)
  const [verRedPropia, setVerRedPropia] = useState(false)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  const total = sitios?.length ?? 0
  const enNetwork = sitios?.filter((s) => s.enNetwork) ?? []
  const programaticos = sitios?.filter((s) => s.comercializacion === 'PROGRAMATICO').length ?? 0
  const tradicionales = sitios?.filter((s) => s.comercializacion === 'TRADICIONAL').length ?? 0

  // Conteo por CMS (solo de los compartidos a la Network).
  const porCms = new Map<CMS, number>()
  for (const s of enNetwork) {
    if (s.cms) porCms.set(s.cms, (porCms.get(s.cms) ?? 0) + 1)
  }

  const visibles = (sitios ?? []).filter(
    (s) =>
      (fRed === null || (fRed === 'si') === s.enNetwork) &&
      (fCom === null || s.comercializacion === fCom),
  )
  const todasPropias = !!sitiosRed && sitiosRed.every((s) => s.esPropio)

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Network</h1>
        <p className="mt-1 text-[13px] text-muted">
          Inventario sin vender compartible a la Network · decides qué espacios incluir
        </p>
      </div>

      {/* Indicadores — 26/10: la rejilla del Dashboard (4 columnas solo desde
          xl) y sin redundancia. Antes «Espacios totales» y «En la Network»
          contaban lo mismo dos veces; ahora las dos primeras se reparten el
          total (compartidos / sin compartir) y cada tarjeta tiene su icono. */}
      <CardColapsable id="network.indicadores" titulo="Indicadores" contentClassName="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!sitios ? (
          <>
            <KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard label="En la Network" value={formatNumero(enNetwork.length)} sub={`de ${formatNumero(total)} espacios`} tono="verde" icon={<Share2 className="h-4 w-4" />} />
            <KPICard label="Sin compartir" value={formatNumero(total - enNetwork.length)} sub="disponibles para la Network" icon={<Network className="h-4 w-4" />} />
            <KPICard label="Programáticos" value={formatNumero(programaticos)} sub="venta automatizada" tono="ambar" icon={<Cpu className="h-4 w-4" />} />
            <KPICard label="Tradicionales" value={formatNumero(tradicionales)} sub="venta directa" tono="neutro" icon={<Handshake className="h-4 w-4" />} />
          </>
        )}
      </div>

      {/* CMS utilizado — 26/10: franja secundaria dentro de los indicadores en
          vez de una tarjeta propia, que casi siempre era una sola línea vacía. */}
      {!sitios ? (
        <div className="h-8 animate-pulse rounded-md bg-surface-2" />
      ) : (
        <div className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted">
          <span className="font-medium text-ink">CMS en la Network:</span>{' '}
          {porCms.size === 0
            ? '— ningún espacio digital compartido aún.'
            : (['BROADSIGN', 'INVIDIS', 'DOOHMAIN', 'OTRO'] as CMS[])
                .filter((c) => porCms.get(c))
                .map((c, i) => (
                  <span key={c}>
                    {i > 0 && ' · '}
                    {CMS_LABEL[c]} <span className="demo-num text-ink">{porCms.get(c)}</span>
                  </span>
                ))}
        </div>
      )}
      </CardColapsable>

      {/* Inventario y reglas de comercialización */}
      <CardColapsable id="network.reglas" titulo="Reglas de comercialización por pantalla" contentClassName="px-0 pb-0">
          {!sitios ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />)}
            </div>
          ) : (
            <>
            {/* Filtro de pantalla (26/10): solo decide qué filas se pintan. El
                interruptor de cada fila sigue haciendo exactamente lo mismo. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-border px-4 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip activo={fRed === null} onClick={() => setFRed(null)}>
                  Todas <span className="demo-num">({sitios.length})</span>
                </Chip>
                <Chip activo={fRed === 'si'} onClick={() => setFRed(fRed === 'si' ? null : 'si')}>
                  En la Network <span className="demo-num">({enNetwork.length})</span>
                </Chip>
                <Chip activo={fRed === 'no'} onClick={() => setFRed(fRed === 'no' ? null : 'no')}>
                  Sin compartir <span className="demo-num">({total - enNetwork.length})</span>
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip activo={fCom === 'PROGRAMATICO'} onClick={() => setFCom(fCom === 'PROGRAMATICO' ? null : 'PROGRAMATICO')}>
                  Programático <span className="demo-num">({programaticos})</span>
                </Chip>
                <Chip activo={fCom === 'TRADICIONAL'} onClick={() => setFCom(fCom === 'TRADICIONAL' ? null : 'TRADICIONAL')}>
                  Tradicional <span className="demo-num">({tradicionales})</span>
                </Chip>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Pantalla</th>
                    <th className="px-4 py-2 font-medium">Comercialización</th>
                    <th className="px-4 py-2 font-medium">CMS</th>
                    <th className="px-4 py-2 font-medium">Estatus</th>
                    <th className="px-4 py-2 text-center font-medium">En Network</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        Ninguna pantalla coincide con el filtro.
                      </td>
                    </tr>
                  )}
                  {visibles.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="text-ink">{s.nombre}</div>
                        <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {/* 26/10 · `StatusBadge` en vez de los hex sueltos. */}
                        {s.comercializacion === 'PROGRAMATICO' ? (
                          <StatusBadge tono="ambar">Programático</StatusBadge>
                        ) : (
                          <StatusBadge tono="neutro">Tradicional</StatusBadge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{s.cms ? CMS_LABEL[s.cms] : '—'}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tono={SITIO_TONO[s.estatusComercial]}>{SITIO_LABEL[s.estatusComercial]}</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {/* 26/10 · con nombre accesible y el estado en texto al
                            lado: el color solo no dice si está compartida. El
                            `onClick` no cambia (ver la nota de decisión humana
                            en el informe: no comprueba permiso ni captura el
                            error, y eso es comportamiento). */}
                        <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={s.enNetwork}
                          aria-label={`Compartir ${s.nombre} a la Network`}
                          onClick={async () => {
                            await toggleNetworkApi(s.id)
                            notify(s.enNetwork ? `${s.nombre} quitada de la Network` : `${s.nombre} compartida a la Network`)
                          }}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150',
                            s.enNetwork ? 'bg-success' : 'bg-border-strong',
                          )}
                        >
                          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150', s.enNetwork ? 'translate-x-4' : 'translate-x-0.5')} />
                        </button>
                        <span className={cn('w-16 text-left text-[11px]', s.enNetwork ? 'text-ink' : 'text-muted')}>
                          {s.enNetwork ? 'Compartida' : 'No'}
                        </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
      </CardColapsable>

      {/* Red de pantallas · catálogo de toda la plataforma (propias + de otros
          operadores). Solo lectura para las ajenas; los costos internos no se
          muestran. Las operaciones (propuestas/reservas) usan solo las propias. */}
      <CardColapsable
        id="network.red"
        titulo="Red de pantallas · toda la plataforma"
        subtitulo="Catálogo de todas las pantallas registradas. Solo el operador dueño puede editarlas."
        contentClassName="px-0 pb-0"
      >
          {!sitiosRed ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />)}
            </div>
          ) : sitiosRed.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">Aún no hay pantallas en la red.</p>
          ) : todasPropias && !verRedPropia ? (
            // 26/10 · si toda la red es tuya, la tabla repetía nombre y código
            // de la de arriba. Se dice en una línea, y la tabla sigue a un clic.
            <p className="flex flex-wrap items-center gap-2 px-4 pb-4 text-[13px] text-muted">
              Todas las pantallas de la red son tuyas ({sitiosRed.length}); aquí aparecerán las de otros operadores.
              <button
                type="button"
                onClick={() => setVerRedPropia(true)}
                className="rounded bg-transparent px-1 text-[12px] font-medium text-info hover:underline"
              >
                Ver todas ({sitiosRed.length}) →
              </button>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Pantalla</th>
                    <th className="px-4 py-2 font-medium">Operador</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Ubicación</th>
                    <th className="px-4 py-2 text-right font-medium">Tarifa</th>
                  </tr>
                </thead>
                <tbody>
                  {sitiosRed.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="text-ink">{s.nombre}</div>
                        <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {s.esPropio ? (
                          <StatusBadge tono="verde">Tuya</StatusBadge>
                        ) : (
                          <span className="text-muted">{s.duenoTenant ?? 'Otro operador'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{etiquetaTipoMedio(s.tipoMedio)}</td>
                      <td className="px-4 py-2.5 text-muted">{s.alcaldia || s.plazaCiudad || '—'}</td>
                      <td className="demo-num px-4 py-2.5 text-right text-ink">
                        {s.tarifaPublicada ? formatMonto(s.tarifaPublicada) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </CardColapsable>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {toast}</span>
        </div>
      )}
    </div>
  )
}

// Chip de filtro con el patrón del Dashboard (`rounded-full border px-2 py-0.5
// text-[11px]`). `bg-transparent` explícito en el inactivo: sin preflight, un
// <button> sin fondo hereda el gris del sistema operativo.
function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        activo
          ? 'border-accent bg-accent-soft font-medium text-ink'
          : 'border-border bg-transparent text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
