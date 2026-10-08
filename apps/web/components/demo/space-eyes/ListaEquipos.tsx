'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BatteryLow,
  Camera,
  CameraOff,
  Clock,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { listarEquiposApi, type EquipoResumen } from '@/lib/data/space-eyes-api'
import { Bateria, FotoGirada, PildoraConexion, Senal, estaEnLinea, hace, tonoBateria } from './piezas'
import { formatNumero } from '@/lib/formato-numero'

// ============================================================================
//  Space Eyes — el listado.
//
//  La pregunta que contesta esta pantalla no es «qué equipos tengo» sino «hay
//  algo que atender ahora mismo». Por eso lo primero son los cuatro números de
//  arriba, y por eso cada equipo enseña SU ÚLTIMA FOTO: un equipo que reporta
//  bien pero lleva una semana viendo una lona caída solo se nota mirando.
//
//  VISTE COMO INVENTARIO, no como un módulo invitado. El encabezado es el mismo
//  patrón —icono en cuadro de 40, título de 18 px, subtítulo de 13—, el selector
//  de filtros es el mismo segmentado con el que Inventario elige entre lista,
//  contrato y carga masiva, y los bordes, radios y tamaños salen de ahí. Lo
//  único que NO se copia es la tabla: aquí cada fila tiene una fotografía que
//  vale más que cualquier columna.
// ============================================================================

// 'manual': los que NO se actualizan solos (necesitan un toque o una visita):
// con esto se planea la vuelta antes de actualizar la flota.
type Filtro = 'todos' | 'linea' | 'atencion' | 'manual'

export function ListaEquipos() {
  const [equipos, setEquipos] = useState<EquipoResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noConfigurado, setNoConfigurado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [empresa, setEmpresa] = useState<string>('todas')

  const sincronizar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const d = await listarEquiposApi()
      setNoConfigurado(!d.disponible)
      setEquipos(d.equipos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar Space Eyes')
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    void sincronizar()
  }, [sincronizar])

  const conEstado = useMemo(
    () => (equipos ?? []).map((e) => ({ ...e, enLinea: estaEnLinea(e.online, e.ultimaConexion) })),
    [equipos],
  )

  // «Atención» no es solo estar caído: una batería por debajo de 20% en un sitio
  // sin corriente es el aviso que llega DÍAS antes de que el equipo se apague.
  const necesitaAtencion = useCallback(
    (e: { enLinea: boolean; bateriaPct: number | null }) => !e.enLinea || tonoBateria(e.bateriaPct) === 'rojo',
    [],
  )

  const empresas = useMemo(
    () => Array.from(new Set(conEstado.map((e) => e.empresa).filter((x): x is string => !!x))).sort(),
    [conEstado],
  )

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    return conEstado.filter((e) => {
      if (filtro === 'linea' && !e.enLinea) return false
      if (filtro === 'atencion' && !necesitaAtencion(e)) return false
      if (filtro === 'manual' && e.actualizacion?.sola !== false) return false
      if (empresa !== 'todas' && e.empresa !== empresa) return false
      if (!t) return true
      return (
        e.nombre.toLowerCase().includes(t) ||
        (e.codigoPantalla ?? '').toLowerCase().includes(t) ||
        (e.pantalla?.nombre ?? '').toLowerCase().includes(t)
      )
    })
  }, [conEstado, filtro, empresa, busqueda, necesitaAtencion])

  const enLinea = conEstado.filter((e) => e.enLinea).length
  const caidos = conEstado.length - enLinea
  const bateriaBaja = conEstado.filter((e) => tonoBateria(e.bateriaPct) === 'rojo').length
  const ultimaCaptura = conEstado
    .map((e) => e.ultimaFoto?.tomadaEn)
    .filter((x): x is string => !!x)
    .sort()
    .pop()

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      {/* El encabezado de Inventario, exacto. En celular los botones bajan a
          su propia fila: a 390 px el título quedaba en una columna de una
          palabra por renglón. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-lg font-semibold text-ink">Space Eyes</h1>
          <p className="text-[13px] text-muted">
            Los equipos que vigilan tus pantallas: qué están viendo y cómo están.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void sincronizar()} disabled={cargando}>
            {cargando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>
          <Link href="/space-eyes/nuevo">
            <Button variant="primary" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar dispositivo
            </Button>
          </Link>
        </div>
      </div>

      {noConfigurado ? (
        <div className="rounded-md border border-border bg-surface-2 p-4 text-[13px] text-muted">
          La integración con Space Eyes no está configurada en este entorno.
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudo consultar Space Eyes</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : (
        <>
          {/* Los cuatro números que deciden si hay que hacer algo hoy */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="En línea" valor={enLinea} pie={`de ${formatNumero(conEstado.length)} equipos`} punto="bg-success" />
            <Indicador titulo="Sin comunicación" valor={caidos} pie="más de 10 min" punto="bg-error" />
            <Indicador
              titulo="Batería crítica"
              valor={bateriaBaja}
              pie="bajo 20%"
              icono={<BatteryLow className="h-3.5 w-3.5 text-warning" strokeWidth={1.8} />}
            />
            <Indicador
              titulo="Última captura"
              valor={ultimaCaptura ? hace(ultimaCaptura).replace('hace ', '') : '—'}
              pie={ultimaCaptura ? 'de toda la flota' : 'sin fotos todavía'}
              icono={<Camera className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />}
            />
          </div>

          {/* Filtros: el mismo segmentado de Inventario */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
              <Pestana activa={filtro === 'todos'} onClick={() => setFiltro('todos')}>
                Todos · {formatNumero(conEstado.length)}
              </Pestana>
              <Pestana activa={filtro === 'linea'} onClick={() => setFiltro('linea')}>
                En línea · {enLinea}
              </Pestana>
              <Pestana activa={filtro === 'atencion'} onClick={() => setFiltro('atencion')}>
                Con atención · {formatNumero(conEstado.filter(necesitaAtencion).length)}
              </Pestana>
              <Pestana activa={filtro === 'manual'} onClick={() => setFiltro('manual')}>
                Se actualizan a mano · {conEstado.filter((e) => e.actualizacion?.sola === false).length}
              </Pestana>
            </div>

            {empresas.length > 1 && (
              <>
                <label className="sr-only" htmlFor="se-empresa">
                  Empresa
                </label>
                <select
                  id="se-empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="todas">Todas las empresas</option>
                  {empresas.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="relative ml-auto w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                strokeWidth={1.8}
              />
              <label className="sr-only" htmlFor="se-buscar">
                Buscar equipo o pantalla
              </label>
              <input
                id="se-buscar"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar equipo o pantalla"
                className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          {/* Rejilla */}
          {cargando && !equipos ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1900px]:grid-cols-5 min-[2400px]:grid-cols-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-60 animate-pulse rounded-md bg-surface-2" />
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <div className="rounded-md border border-border bg-surface-2 px-3 py-10 text-center text-[13px] text-muted">
              {conEstado.length === 0
                ? 'Todavía no hay equipos Space Eyes dados de alta para esta cuenta.'
                : 'Ningún equipo coincide con el filtro.'}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1900px]:grid-cols-5 min-[2400px]:grid-cols-6">
              {visibles.map((e) => (
                <TarjetaEquipo key={e.id} equipo={e} enLinea={e.enLinea} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Indicador({
  titulo,
  valor,
  pie,
  punto,
  icono,
}: {
  titulo: string
  valor: number | string
  pie: string
  punto?: string
  icono?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
        {punto ? <span className={cn('h-1.5 w-1.5 rounded-full', punto)} /> : icono}
        {titulo}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold leading-none text-ink">{valor}</span>
        <span className="text-[12px] text-muted">{pie}</span>
      </div>
    </div>
  )
}

// El mismo selector de vía que usa Inventario. Antes eran pastillas negras, que
// en esta casa no existen en ningún otro módulo.
function Pestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors duration-150',
        activa ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function TarjetaEquipo({ equipo: e, enLinea }: { equipo: EquipoResumen; enLinea: boolean }) {
  return (
    <Link
      href={`/space-eyes/${e.id}`}
      className="group block overflow-hidden rounded-md border border-border bg-surface transition-colors duration-150 hover:border-border-strong"
    >
      {/* La última captura manda: es lo que se viene a ver */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        {e.ultimaFoto ? (
          <FotoGirada src={e.ultimaFoto.url} alt={`Última captura de ${e.nombre}`} giro={e.ultimaFoto.giro} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted">
            <CameraOff className="h-5 w-5" strokeWidth={1.4} />
            <span className="text-[12px]">Sin capturas todavía</span>
          </div>
        )}
        <PildoraConexion online={enLinea} pendiente={!e.ultimaConexion} sobreFoto className="absolute left-2 top-2" />
        {e.ultimaFoto?.tomadaEn && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white backdrop-blur-sm">
            <Clock className="h-3 w-3" strokeWidth={2} />
            {hace(e.ultimaFoto.tomadaEn)}
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="line-clamp-2 break-words text-[13px] font-medium leading-snug text-ink" title={e.nombre}>
          {e.nombre}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          {e.empresa && <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-ink">{e.empresa}</span>}
          {e.pantalla ? (
            <span className="truncate">{e.pantalla.nombre}</span>
          ) : e.codigoPantalla ? (
            <span className="demo-num">{e.codigoPantalla}</span>
          ) : (
            <span className="italic">sin pantalla asignada</span>
          )}
        </div>

        {e.actualizacion && !e.actualizacion.sola && (
          <div
            className={cn(
              'mt-1.5 text-[11.5px]',
              e.actualizacion.tono === 'visita' ? 'text-error' : 'text-warning',
            )}
            title={e.actualizacion.texto}
          >
            {e.actualizacion.tono === 'visita' ? 'Para actualizar necesita una visita' : 'Para actualizar pide un toque'}
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-3 border-t border-border pt-2.5">
          <Bateria pct={e.bateriaPct} />
          <Senal dbm={e.senalDbm} tipo={e.redTipo} />
          <span className={cn('ml-auto text-[12px]', enLinea ? 'text-muted' : 'font-medium text-error')}>
            {hace(e.ultimaConexion)}
          </span>
        </div>
      </div>
    </Link>
  )
}
