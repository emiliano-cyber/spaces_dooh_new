'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Warehouse, Plus, ArrowLeftRight, Loader2, MonitorCheck, Package, Truck } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { StatusBadge, type Tono } from '@/components/demo/StatusBadge'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useSitios } from '@/lib/data/client'
import {
  getAlmacenApi,
  crearActivoApi,
  moverActivoApi,
  type Activo,
  type EstadoActivo,
  type TipoMovAlmacen,
} from '@/lib/data/almacen-api'
import {
  TIPOS_ACTIVO,
  camposDelTipo,
  contarPorTipo,
  etiquetaTipoActivo,
  filtrarPorTipo,
  type CampoTipo,
  type TipoActivo,
} from '@/lib/almacen-tipos'
import { useTexto } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

type T = ReturnType<typeof useTexto>

// Espejos (ingles, 2026-11-02): las etiquetas de `lib/almacen-tipos.ts` siguen
// siendo la verdad en espanol; aqui solo se dice que clave traduce cada una, y
// `textos/operaciones.test.ts` exige que el espanol sea IDENTICO (no se
// exportan: un `page.tsx` de Next solo admite sus exportaciones propias).
const CLAVE_TIPO_ACTIVO: Record<TipoActivo, ClaveTexto> = {
  VEHICULO: 'operaciones.almacen.tipo.vehiculo',
  HERRAMIENTA: 'operaciones.almacen.tipo.herramienta',
  PANTALLA: 'operaciones.almacen.tipo.pantalla',
  EQUIPO: 'operaciones.almacen.tipo.equipo',
  CAMARA: 'operaciones.almacen.tipo.camara',
  ESTRUCTURA: 'operaciones.almacen.tipo.estructura',
  LONA: 'operaciones.almacen.tipo.lona',
  OTRO: 'operaciones.almacen.tipo.otro',
}
const CLAVE_CAMPO_ACTIVO: Record<CampoTipo, ClaveTexto> = {
  marca: 'operaciones.almacen.campo.marca',
  modelo: 'operaciones.almacen.campo.modelo',
  numeroSerie: 'operaciones.almacen.campo.numero-serie',
  placas: 'operaciones.almacen.campo.placas',
}

/** `etiquetaTipoActivo` con su clave: un tipo libre que no es del catalogo se pinta tal cual (es dato). */
function tipoActivoTexto(tipo: string | null | undefined, t: T): string {
  if (tipo && tipo in CLAVE_TIPO_ACTIVO) return t(CLAVE_TIPO_ACTIVO[tipo as TipoActivo])
  return tipo && tipo.trim() ? etiquetaTipoActivo(tipo) : t(CLAVE_TIPO_ACTIVO.OTRO)
}

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// 26/10 · el tono de `StatusBadge` en vez de clases con hex sueltos: el mismo
// semáforo que el resto de la aplicación.
const ESTADO: Record<EstadoActivo, { label: ClaveTexto; tono: Tono }> = {
  EN_ALMACEN: { label: 'operaciones.almacen.estado.en-almacen', tono: 'neutro' },
  INSTALADO: { label: 'operaciones.almacen.estado.instalado', tono: 'verde' },
  EN_TRASLADO: { label: 'operaciones.almacen.estado.en-traslado', tono: 'ambar' },
  BAJA: { label: 'operaciones.almacen.estado.baja', tono: 'rojo' },
}

// Movimientos permitidos según el estado actual del activo.
const MOVS: Record<EstadoActivo, TipoMovAlmacen[]> = {
  EN_ALMACEN: ['SALIDA', 'TRASLADO', 'BAJA'],
  INSTALADO: ['ENTRADA', 'TRASLADO', 'BAJA'],
  EN_TRASLADO: ['ENTRADA', 'SALIDA', 'BAJA'],
  BAJA: [],
}
const MOV_LABEL: Record<TipoMovAlmacen, ClaveTexto> = {
  ENTRADA: 'operaciones.almacen.mov.entrada',
  SALIDA: 'operaciones.almacen.mov.salida',
  TRASLADO: 'operaciones.almacen.mov.traslado',
  BAJA: 'operaciones.almacen.mov.baja',
}

export default function AlmacenPage() {
  const t = useTexto()
  const puedeEditar = usePuede('operaciones', 'crear')
  const sitios = useSitios()
  const [activos, setActivos] = useState<Activo[] | null>(null)
  const [altaOpen, setAltaOpen] = useState(false)
  const [mover, setMover] = useState<Activo | null>(null)
  // El filtro es de pantalla, sobre la lista completa: así las pastillas dan
  // su cuenta sin una petición por tipo. Cuenta y filtro usan la MISMA regla
  // (`tipoDeFiltro`) que el `?tipo=` del servidor.
  const [filtroTipo, setFiltroTipo] = useState<TipoActivo | null>(null)
  const cuentas = useMemo(() => contarPorTipo(activos ?? []), [activos])
  const visibles = useMemo(() => filtrarPorTipo(activos ?? [], filtroTipo), [activos, filtroTipo])
  // Conteo por estado para los indicadores. Solo cuenta lo ya cargado.
  const porEstado = useMemo(() => {
    const m: Record<EstadoActivo, number> = { EN_ALMACEN: 0, INSTALADO: 0, EN_TRASLADO: 0, BAJA: 0 }
    for (const a of activos ?? []) m[a.estado] = (m[a.estado] ?? 0) + 1
    return m
  }, [activos])

  const nombreSitio = useCallback(
    (id: string | null) => (id ? sitios?.find((s) => s.id === id)?.nombre ?? '—' : '—'),
    [sitios],
  )

  const [falloCarga, setFalloCarga] = useState<string | null>(null)
  const cargar = useCallback(async () => {
    try {
      const d = await getAlmacenApi()
      setFalloCarga(null)
      setActivos(d.activos)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.almacen.no-cargar'))
      // 26/10 · el fallo se guarda además para PINTARLO: con la lista vacía y
      // sin esto, la pantalla decía «Aún no hay artículos» —una afirmación
      // falsa— en cuanto el aviso se desvanecía. El toast y la lista vacía se
      // quedan como estaban.
      setFalloCarga(e instanceof Error ? e.message : t('operaciones.almacen.error-desconocido'))
      setActivos([])
    }
  }, [t])
  useEffect(() => { void cargar() }, [cargar])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* 26/10 · sin la caja del icono, como el encabezado del Dashboard. */}
        <div>
          <h1 className="text-2xl text-ink">{t('operaciones.almacen.titulo')}</h1>
          <p className="mt-1 text-[13px] text-muted">{t('operaciones.almacen.descripcion')}</p>
        </div>
        {puedeEditar && (
          <Button variant="success" size="sm" onClick={() => setAltaOpen(true)}><Plus className="h-3.5 w-3.5" /> {t('operaciones.almacen.registrar-articulo')}</Button>
        )}
      </div>

      {/* Indicadores (26/10): conteo por estado sobre la lista ya cargada.
          Con error de carga no se pintan: cuatro ceros afirmarían un almacén
          vacío que nadie ha comprobado. */}
      {!falloCarga && (
        <CardColapsable id="almacen.indicadores" titulo={t('operaciones.almacen.indicadores')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {!activos ? (
              <>
                <KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton />
              </>
            ) : (
              <>
                <KPICard
                  label={t('operaciones.almacen.kpi.articulos')}
                  value={String(activos.length)}
                  sub={
                    porEstado.BAJA
                      ? t(porEstado.BAJA === 1 ? 'operaciones.almacen.kpi.baja.uno' : 'operaciones.almacen.kpi.baja.otros', { n: porEstado.BAJA })
                      : t('operaciones.almacen.kpi.ninguno-baja')
                  }
                  icon={<Warehouse className="h-4 w-4" />}
                />
                <KPICard label={t('operaciones.almacen.kpi.instalados')} value={String(porEstado.INSTALADO)} sub={t('operaciones.almacen.kpi.en-pantalla')} tono={porEstado.INSTALADO ? 'verde' : 'neutro'} icon={<MonitorCheck className="h-4 w-4" />} />
                <KPICard label={t('operaciones.almacen.kpi.en-almacen')} value={String(porEstado.EN_ALMACEN)} sub={t('operaciones.almacen.kpi.guardados')} icon={<Package className="h-4 w-4" />} />
                <KPICard label={t('operaciones.almacen.kpi.en-traslado')} value={String(porEstado.EN_TRASLADO)} sub={t('operaciones.almacen.kpi.en-camino')} tono={porEstado.EN_TRASLADO ? 'ambar' : 'neutro'} icon={<Truck className="h-4 w-4" />} />
              </>
            )}
          </div>
        </CardColapsable>
      )}

      {/* Plegable (pedido del 20/10). El filtro por tipo vive en la página,
          fuera de la tarjeta: plegar y desplegar no lo pierde.
          26/10 · las pastillas se PINTAN dentro de la tarjeta, en la franja de
          arriba como el buscador de Inventario; el estado `filtroTipo` sigue en
          la página, así que plegar sigue sin perderlo. */}
      <CardColapsable id="almacen.articulos" titulo={t('operaciones.almacen.articulos')} className="overflow-hidden" contentClassName="px-0 pb-0">
        {!activos ? (
          <div className="h-40 animate-pulse rounded-md bg-surface-2" />
        ) : falloCarga ? (
          // Un error de carga NO es un almacén vacío.
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[13px]">
            <p className="text-error">{t('operaciones.almacen.fallo', { error: falloCarga })}</p>
            <Button size="sm" variant="secondary" onClick={() => void cargar()}>{t('operaciones.almacen.reintentar')}</Button>
          </div>
        ) : activos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[13px] text-muted">
            <p>
              {t('operaciones.almacen.vacio')}
            </p>
            {puedeEditar ? (
              <Button variant="success" size="sm" onClick={() => setAltaOpen(true)}><Plus className="h-3.5 w-3.5" /> {t('operaciones.almacen.registrar-articulo')}</Button>
            ) : (
              <p className="text-[12px]">{t('operaciones.almacen.pide')}</p>
            )}
          </div>
        ) : (
          <>
          <div className="flex flex-wrap gap-1.5 border-y border-border px-4 py-2" role="group" aria-label={t('operaciones.almacen.filtrar')}>
            <PastillaTipo activa={filtroTipo === null} onClick={() => setFiltroTipo(null)} label={t('operaciones.almacen.todos')} cuenta={activos.length} />
            {TIPOS_ACTIVO.filter((x) => cuentas[x] > 0).map((x) => (
              <PastillaTipo key={x} activa={filtroTipo === x} onClick={() => setFiltroTipo(x)} label={t(CLAVE_TIPO_ACTIVO[x])} cuenta={cuentas[x]} />
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">{t('operaciones.almacen.col.etiqueta')}</th>
                  <th className="px-4 py-2 font-medium">{t('operaciones.almacen.col.descripcion')}</th>
                  <th className="px-4 py-2 font-medium">{t('operaciones.almacen.col.tipo')}</th>
                  <th className="px-4 py-2 font-medium">{t('operaciones.almacen.col.datos')}</th>
                  <th className="px-4 py-2 font-medium">{t('operaciones.almacen.col.estado')}</th>
                  <th className="px-4 py-2 font-medium">{t('operaciones.almacen.col.ubicacion')}</th>
                  {puedeEditar && <th className="px-4 py-2 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibles.map((a) => (
                  <tr key={a.id}>
                    <td className="demo-num px-4 py-2.5 font-medium text-ink">{a.etiqueta}</td>
                    <td className="px-4 py-2.5 text-muted">{a.descripcion}</td>
                    <td className="px-4 py-2.5 text-muted">{tipoActivoTexto(a.tipoActivo, t)}</td>
                    <td className="px-4 py-2.5 text-muted">{datosDelArticulo(a, t)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tono={ESTADO[a.estado].tono}>{t(ESTADO[a.estado].label)}</StatusBadge>
                    </td>
                    {/* Instalado → la pantalla donde está; si no, dónde se guarda (bodega).
                        26/10 · con prefijo, porque las dos se veían igual y no
                        se sabía si «Reforma» era una pantalla o una bodega. */}
                    <td className="px-4 py-2.5 text-muted">
                      <span className="text-[11px] text-muted">{a.estado === 'INSTALADO' ? t('operaciones.almacen.en-pantalla') : t('operaciones.almacen.bodega')}</span>
                      <span className="text-ink">{a.estado === 'INSTALADO' ? nombreSitio(a.sitioId) : a.ubicacion ?? '—'}</span>
                    </td>
                    {puedeEditar && (
                      <td className="px-4 py-2.5 text-right">
                        {MOVS[a.estado].length > 0 && (
                          <button
                            type="button"
                            onClick={() => setMover(a)}
                            className="inline-flex items-center gap-1.5 rounded border border-border-strong px-2 py-1 text-[12px] text-ink hover:bg-surface-2"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-muted" /> {t('operaciones.almacen.mover')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </CardColapsable>

      {altaOpen && <AltaActivoModal onClose={() => setAltaOpen(false)} onCreado={() => { setAltaOpen(false); void cargar() }} />}
      {mover && (
        <MoverModal
          activo={mover}
          sitios={sitios ?? []}
          onClose={() => setMover(null)}
          onHecho={() => { setMover(null); void cargar() }}
        />
      )}
    </div>
  )
}

function AltaActivoModal({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const t = useTexto()
  const [etiqueta, setEtiqueta] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoActivo, setTipoActivo] = useState<TipoActivo>('PANTALLA')
  const [notas, setNotas] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [datos, setDatos] = useState<Record<CampoTipo, string>>({ marca: '', modelo: '', numeroSerie: '', placas: '' })
  const [busy, setBusy] = useState(false)
  const campos = camposDelTipo(tipoActivo)
  // OBLIG-01 · los dos que exige el servidor (`almacen-controller.ts:32-33`).
  // El tipo tiene DEFAULT allí y el selector nunca queda en blanco.
  const ob = useObligatorios({ etiqueta, descripcion }, ['etiqueta', 'descripcion'])

  async function guardar() {
    if (!ob.validar()) return
    setBusy(true)
    try {
      // Solo los campos que pide el tipo ELEGIDO: si alguien teclea placas y
      // luego cambia a «Cámara», el servidor rechazaría unas placas que ya no
      // se ven en pantalla.
      const propios = Object.fromEntries(campos.map((c) => [c, datos[c].trim() || null]))
      await crearActivoApi({
        etiqueta: etiqueta.trim(),
        descripcion: descripcion.trim(),
        tipoActivo,
        notas: notas.trim() || null,
        ubicacion: ubicacion.trim() || null,
        ...propios,
      })
      toast.success(t('operaciones.almacen.alta.registrado'))
      onCreado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.almacen.alta.no-registrar'))
    }
    setBusy(false)
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={t('operaciones.almacen.registrar-articulo')} subtitle={t('operaciones.almacen.alta.subtitulo')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button size="sm" disabled={busy} onClick={guardar}>
            {busy ? t('propuestas.comun.guardando') : t('operaciones.almacen.alta.registrar')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('operaciones.almacen.alta.etiqueta')} obligatorio falta={ob.falta('etiqueta')}><input className={inputCls} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder={t('operaciones.almacen.alta.etiqueta-ej')} autoFocus /></Campo>
        <Campo label={t('operaciones.almacen.alta.descripcion')} obligatorio falta={ob.falta('descripcion')}><input className={inputCls} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={t('operaciones.almacen.alta.descripcion-ej')} /></Campo>
        <Campo label={t('operaciones.almacen.alta.tipo')}>
          <select className={inputCls} value={tipoActivo} onChange={(e) => setTipoActivo(e.target.value as TipoActivo)}>
            {TIPOS_ACTIVO.map((x) => <option key={x} value={x}>{t(CLAVE_TIPO_ACTIVO[x])}</option>)}
          </select>
        </Campo>
        {campos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {campos.map((c) => (
              <Campo key={c} label={c === 'numeroSerie' && tipoActivo === 'VEHICULO' ? t('operaciones.almacen.campo.vin') : t(CLAVE_CAMPO_ACTIVO[c])}>
                <input
                  className={inputCls}
                  value={datos[c]}
                  maxLength={c === 'placas' ? 20 : 120}
                  onChange={(e) => setDatos((d) => ({ ...d, [c]: e.target.value }))}
                  placeholder={t('operaciones.almacen.ej', { ejemplo: EJEMPLO_CAMPO[c] })}
                />
              </Campo>
            ))}
          </div>
        )}
        <Campo label={t('operaciones.almacen.alta.donde')}><input className={inputCls} value={ubicacion} maxLength={200} onChange={(e) => setUbicacion(e.target.value)} placeholder={t('operaciones.almacen.alta.donde-ej')} /></Campo>
        <Campo label={t('operaciones.almacen.alta.notas')}><textarea className={inputCls} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}

function MoverModal({
  activo, sitios, onClose, onHecho,
}: { activo: Activo; sitios: { id: string; nombre: string }[]; onClose: () => void; onHecho: () => void }) {
  const t = useTexto()
  const opciones = MOVS[activo.estado]
  const [tipo, setTipo] = useState<TipoMovAlmacen>(opciones[0])
  const [motivo, setMotivo] = useState('')
  const [sitioId, setSitioId] = useState('')
  const [busy, setBusy] = useState(false)
  // OBLIG-01 · el movimiento siempre, y la pantalla destino solo al instalar:
  // es lo que exige la ruta (`api/almacen/[id]/movimiento/route.ts:25-27`).
  const ob = useObligatorios({ tipo, sitioId }, ['tipo', { campo: 'sitioId', si: tipo === 'SALIDA' }])

  async function guardar() {
    if (!ob.validar()) return
    setBusy(true)
    try {
      await moverActivoApi(activo.id, { tipo, motivo: motivo.trim() || null, sitioId: tipo === 'SALIDA' ? sitioId : null })
      toast.success(t('operaciones.almacen.mover.registrado'))
      onHecho()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.almacen.mover.no-mover'))
    }
    setBusy(false)
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={t('operaciones.almacen.mover.titulo')} subtitle={`${activo.etiqueta} · ${activo.descripcion}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button size="sm" disabled={busy} onClick={guardar}>{busy ? t('propuestas.comun.guardando') : t('operaciones.almacen.mover.registrar')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('operaciones.almacen.mover.movimiento')} obligatorio falta={ob.falta('tipo')}>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovAlmacen)}>
            {opciones.map((o) => <option key={o} value={o}>{t(MOV_LABEL[o])}</option>)}
          </select>
        </Campo>
        {tipo === 'SALIDA' && (
          <Campo label={t('operaciones.almacen.mover.destino')} obligatorio falta={ob.falta('sitioId')}>
            <select className={inputCls} value={sitioId} onChange={(e) => setSitioId(e.target.value)}>
              <option value="">{t('operaciones.almacen.mover.elige')}</option>
              {sitios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo label={t('operaciones.almacen.mover.motivo')}><textarea className={inputCls} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('operaciones.almacen.mover.motivo-ej')} /></Campo>
      </div>
    </Modal>
  )
}

// Los ejemplos son marcas, modelos y matriculas: iguales en los dos idiomas.
// Lo que se traduce es el «Ej.» que los presenta (`operaciones.almacen.ej`).
const EJEMPLO_CAMPO: Record<CampoTipo, string> = {
  marca: 'Nissan / Hikvision',
  modelo: 'NP300 / DS-2DE4425',
  numeroSerie: '3N6AD33A1KK123456',
  placas: 'ABC-1234',
}

// Lo que distingue a este artículo de otro igual, en una línea: marca y
// modelo, serie y placas. Solo lo que se capturó; nada → «—».
function datosDelArticulo(a: Activo, t: T): string {
  const partes = [
    [a.marca, a.modelo].filter(Boolean).join(' '),
    a.numeroSerie ? `S/N ${a.numeroSerie}` : '',
    a.placas ? t('operaciones.almacen.placas', { placas: a.placas }) : '',
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : '—'
}

function PastillaTipo({ activa, onClick, label, cuenta }: { activa: boolean; onClick: () => void; label: string; cuenta: number }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      // 26/10 · el chip del Dashboard; el activo en acento suave y no en negro
      // (`bg-ink`), un estilo que no existía en ningún otro módulo.
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${
        activa ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-border bg-transparent text-muted hover:text-ink'
      }`}
    >
      {label} <span className="demo-num">({cuenta})</span>
    </button>
  )
}
