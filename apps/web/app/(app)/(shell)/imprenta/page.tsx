'use client'

import { toast } from 'sonner'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Ruler, Plus, ChevronRight, Upload, ImageOff, Check, X } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { cifraIlegible } from '@/lib/captura-cifra'
import { EmptyState } from '@/components/demo/EmptyState'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatNumero } from '@/lib/formato-numero'
import {
  StatusBadge,
  IMPRESION_TONO,
  CREATIVIDAD_TONO,
  type Tono,
} from '@/components/demo/StatusBadge'
import { CLAVE_IMPRESION } from '@/components/demo/campanas/etiquetas'
import { useIdioma, useTexto } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  crearOrdenImpresionApi,
  avanzarOrdenImpresionApi,
  aprobarPruebaColorApi,
  crearCreatividadApi,
  validarCreatividadApi,
} from '@/lib/data/estado-api'
import {
  useOrdenesImpresion,
  useCampanas,
  useSitios,
  useCreatividades,
  type EstOrdenImpresion,
} from '@/lib/data/client'
import type { OrdenImpresion, CreativoDeImpresion, EstValidacionCreatividad } from '@/lib/data/types'
import { imagenAHtml, IMAGEN_CREATIVO_MAX_MB } from '@/lib/creativo-html'
import {
  priorizarImpresion,
  conteoPorGrupo,
  diaLocal,
  ORDEN_GRUPOS,
  type GrupoPrioridad,
  type Priorizada,
} from '@/lib/prioridad-imprenta'
import { medidaDeOrden, proporcionDibujable, type Ajuste } from '@/lib/proporcion-pantalla'
import { ArteEnSitio, MiniaturaArte, TextoAjuste, TextoMedida, decimalesDe } from '@/components/operaciones/ArteEnSitio'

const PROCESO: EstOrdenImpresion[] = [
  'ARTE_RECIBIDO',
  'VALIDADO',
  'EN_PRODUCCION',
  'IMPRESO',
  'LISTO_MONTAJE',
]

// IMP-PRIO (17/11) · cada grupo de urgencia con su nombre, su tono y el color de
// su tramo en la franja. El color nunca va solo: el nombre y la cifra van en
// texto al lado.
const GRUPO: Record<GrupoPrioridad, { clave: ClaveTexto; tono: Tono; barra: string }> = {
  ATRASADA: { clave: 'operaciones.imprenta.grupo.atrasada', tono: 'rojo', barra: 'bg-error' },
  SEMANA: { clave: 'operaciones.imprenta.grupo.semana', tono: 'ambar', barra: 'bg-warning' },
  MES: { clave: 'operaciones.imprenta.grupo.mes', tono: 'azul', barra: 'bg-info' },
  DESPUES: { clave: 'operaciones.imprenta.grupo.despues', tono: 'neutro', barra: 'bg-border-strong' },
  SIN_FECHA: { clave: 'operaciones.imprenta.grupo.sin-fecha', tono: 'neutro', barra: 'bg-surface-2' },
  LISTA: { clave: 'operaciones.imprenta.grupo.lista', tono: 'verde', barra: 'bg-success' },
}

const CLAVE_ESTADO_ARTE: Record<EstValidacionCreatividad, ClaveTexto> = {
  PENDIENTE: 'operaciones2.creativos.kpi.por-aprobar',
  VALIDADA: 'operaciones2.creativos.estado.validada',
  RECHAZADA: 'operaciones2.creativos.estado.rechazada',
}

// Una orden con lo que le falta para pintarse, venga del servidor
// (`listarOrdenesImpresion`) o, en la demo en memoria, de los otros hooks.
type OrdenVista = OrdenImpresion & {
  inicioCampana: string | null
  arte: CreativoDeImpresion[]
  medida: ReturnType<typeof medidaDeOrden>
  nombreCampana: string | null
  nombreSitio: string | null
}

export default function ImprentaPage() {
  const t = useTexto()
  const ois = useOrdenesImpresion()
  const campanas = useCampanas()
  const sitios = useSitios()
  const creatividades = useCreatividades()
  const puedeCrear = usePuede('imprenta', 'crear')
  const puedeVerCampanas = usePuede('comercial', 'crear')
  // Subir y aprobar arte es de Comercial (`POST`/`PATCH /api/creatividades`
  // exigen `comercial.crear`): Imprenta lo VE, pero no lo decide.
  const puedeArte = usePuede('comercial', 'crear')

  const [nueva, setNueva] = useState(false)
  const [avanzando, setAvanzando] = useState<string | null>(null)
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoPrioridad | null>(null)
  const [verArte, setVerArte] = useState<{ ordenId: string; creativoId: string } | null>(null)
  const [subiendoPara, setSubiendoPara] = useState<string | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  const destinoSubida = useRef<OrdenVista | null>(null)

  // Imprenta solo aplica a campañas que imprimen: OOH (fija) e HÍBRIDA. Las
  // campañas 100% digitales (DOOH) no llevan impresión, así que sus órdenes no
  // se muestran aquí.
  const oisVisibles: OrdenVista[] = useMemo(
    () =>
      (ois ?? [])
        .map((o) => {
          const camp = campanas?.find((c) => c.id === o.campanaId)
          const sitio = sitios?.find((s) => s.id === o.sitioId)
          return {
            ...o,
            tipoCampana: o.tipoCampana ?? camp?.tipoCampana ?? null,
            inicioCampana: o.campanaInicio ?? camp?.fechaInicio ?? null,
            nombreCampana: o.campanaNombre ?? camp?.nombre ?? null,
            nombreSitio: o.sitioNombre ?? sitio?.nombre ?? null,
            arte:
              o.creativos ??
              (creatividades ?? [])
                .filter((cr) => cr.campanaId === o.campanaId && !cr.retiradoEn)
                .map((cr) => ({
                  id: cr.id,
                  nombre: cr.nombre,
                  archivoUrl: cr.archivoUrl,
                  esImagen: cr.esImagen,
                  formato: cr.formato,
                  resolucion: cr.resolucion,
                  estatusValidacion: cr.estatusValidacion,
                })),
            medida: medidaDeOrden(o, {
              ancho: o.sitioAncho ?? sitio?.ancho ?? null,
              alto: o.sitioAlto ?? sitio?.alto ?? null,
            }),
          }
        })
        .filter((o) => o.tipoCampana !== 'DOOH'),
    [ois, campanas, sitios, creatividades],
  )

  // IMP-PRIO · la cola por fecha de inicio de la campaña (`lib/prioridad-imprenta.ts`).
  const hoy = diaLocal(new Date())
  const priorizadas = useMemo(() => priorizarImpresion(oisVisibles, hoy), [oisVisibles, hoy])
  const porGrupo = conteoPorGrupo(priorizadas)
  const listadas = filtroGrupo ? priorizadas.filter((p) => p.grupo === filtroGrupo) : priorizadas

  // Conteos para los indicadores y la franja de reparto (solo presentación).
  const conteoPorEtapa = Object.fromEntries(
    PROCESO.map((p) => [p, oisVisibles.filter((o) => o.estatus === p).length]),
  ) as Record<EstOrdenImpresion, number>
  const pruebasPendientes = oisVisibles.filter((o) => !o.pruebaColorAprobada).length

  async function avanzar(id: string) {
    setAvanzando(id)
    try {
      await avanzarOrdenImpresionApi(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.no-avanzar'))
    }
    setAvanzando(null)
  }

  function elegirArte(o: OrdenVista) {
    destinoSubida.current = o
    archivoRef.current?.click()
  }

  // El arte se guarda como el de Creativos (`imagenAHtml`): así una campaña
  // híbrida no estrena un formato que el player DOOH no conoce, y `/arte/`
  // sirve la imagen de dentro para la vista previa.
  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    const o = destinoSubida.current
    if (!f || !o) return
    if (f.size > IMAGEN_CREATIVO_MAX_MB * 1024 * 1024) {
      toast.error(t('operaciones2.creativos.imagen-supera', { mb: IMAGEN_CREATIVO_MAX_MB }))
      return
    }
    setSubiendoPara(o.id)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await crearCreatividadApi({
          campanaId: o.campanaId,
          nombre: f.name,
          codigo: imagenAHtml(reader.result as string, f.name),
          formato: 'text/html',
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('operaciones.imprenta.arte.no-subir'))
      }
      setSubiendoPara(null)
    }
    reader.readAsDataURL(f)
  }

  const abierta = verArte ? oisVisibles.find((o) => o.id === verArte.ordenId) ?? null : null
  const creativoAbierto = abierta?.arte.find((cr) => cr.id === verArte?.creativoId) ?? null

  return (
    <div className="w-full space-y-4">
      {/* El botón principal arriba a la derecha, alineado con el título
          (`items-start`), como Operaciones; con `items-end` quedaba descolgado. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl text-ink">{t('operaciones.imprenta.titulo')}</h1>
          <p className="mt-1 text-[13px] text-muted">{t('operaciones.imprenta.descripcion')}</p>
        </div>
        {puedeCrear && (
          <Button variant="success" size="sm" onClick={() => setNueva(true)}>
            <Plus className="h-3.5 w-3.5" /> {t('operaciones.imprenta.nueva')}
          </Button>
        )}
      </div>

      {/* Dónde está el trabajo, de un vistazo (lenguaje del Dashboard). Sale
          de `oisVisibles`, la misma lista de abajo: sin endpoint nuevo. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!ois ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label={t('operaciones.imprenta.kpi.en-proceso')}
              value={formatNumero(oisVisibles.filter((o) => o.estatus !== 'LISTO_MONTAJE').length)}
              sub={t('operaciones.imprenta.kpi.en-proceso-sub')}
            />
            <KPICard
              label={t('operaciones.imprenta.kpi.prueba')}
              value={formatNumero(pruebasPendientes)}
              sub={t('operaciones.imprenta.kpi.sin-aprobar')}
              tono={pruebasPendientes > 0 ? 'ambar' : 'neutro'}
            />
            <KPICard
              label={t('operaciones.imprenta.kpi.en-produccion')}
              value={formatNumero(conteoPorEtapa.EN_PRODUCCION + conteoPorEtapa.IMPRESO)}
              sub={t('operaciones.imprenta.kpi.en-produccion-sub')}
            />
            <KPICard
              label={t('operaciones.imprenta.kpi.listas')}
              value={formatNumero(conteoPorEtapa.LISTO_MONTAJE)}
              sub={t('operaciones.imprenta.kpi.listas-sub')}
              tono={conteoPorEtapa.LISTO_MONTAJE > 0 ? 'verde' : 'neutro'}
            />
          </>
        )}
      </div>

      {/* Reparto por etapa: la franja secundaria del Dashboard, con la etiqueta
          y el número en texto. */}
      {ois && oisVisibles.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
          {PROCESO.map((p) => (
            <span key={p} className="text-muted">
              {t(CLAVE_IMPRESION[p])} <span className="demo-num font-medium text-ink">{formatNumero(conteoPorEtapa[p])}</span>
            </span>
          ))}
        </div>
      )}

      {/* IMP-PRIO · el mapa de prioridad: una franja con un tramo por grupo de
          urgencia, del más próximo al último. Cada tramo filtra la lista. */}
      {ois && oisVisibles.length > 0 && (
        <CardColapsable
          id="imprenta.prioridad"
          titulo={t('operaciones.imprenta.prioridad.titulo')}
          resumen={<span className="text-[12px] text-muted">{t('operaciones.imprenta.prioridad.detalle')}</span>}
        >
          <div className="space-y-3">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
              {ORDEN_GRUPOS.filter((g) => porGrupo[g] > 0).map((g) => (
                <span
                  key={g}
                  className={`${GRUPO[g].barra} h-full border-r border-surface last:border-r-0`}
                  style={{ width: `${(porGrupo[g] / priorizadas.length) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ORDEN_GRUPOS.map((g) => {
                const activo = filtroGrupo === g
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={porGrupo[g] === 0}
                    aria-pressed={activo}
                    onClick={() => setFiltroGrupo(activo ? null : g)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-40 ${
                      activo ? 'border-ink bg-ink text-surface' : 'border-border bg-surface text-ink hover:bg-surface-2'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${GRUPO[g].barra} ${g === 'SIN_FECHA' ? 'ring-1 ring-border-strong' : ''}`} />
                    {t(GRUPO[g].clave)}
                    <span className="demo-num font-medium">{formatNumero(porGrupo[g])}</span>
                  </button>
                )
              })}
              {filtroGrupo && (
                <button
                  type="button"
                  onClick={() => setFiltroGrupo(null)}
                  className="text-[12px] font-medium text-info hover:underline"
                >
                  {t('operaciones2.comun.ver-todas')}
                </button>
              )}
            </div>
          </div>
        </CardColapsable>
      )}

      {/* PLEG-01 · la página es una sola lista: se pliega entera, como las
          secciones de Arrendadores. */}
      <CardColapsable
        id="imprenta.ordenes"
        titulo={t('operaciones.imprenta.ordenes')}
        resumen={
          ois ? (
            <span className="demo-num text-[12px] text-muted">
              {t(oisVisibles.length === 1 ? 'operaciones.imprenta.orden.uno' : 'operaciones.imprenta.orden.otros', { n: oisVisibles.length })}
            </span>
          ) : undefined
        }
      >
      {!ois ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : oisVisibles.length === 0 ? (
        <EmptyState
          icon={Ruler}
          titulo={t('operaciones.imprenta.vacia')}
          detalle={t('operaciones.imprenta.vacia-detalle')}
          accion={
            puedeCrear ? (
              <Button variant="success" onClick={() => setNueva(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('operaciones.imprenta.nueva')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        // IMP-PRIO · en orden de urgencia y agrupada: un encabezado por grupo,
        // y debajo una fila por orden (`divide-y`) con su arte en la proporción
        // del sitio.
        <div className="space-y-5">
          {ORDEN_GRUPOS.filter((g) => listadas.some((p) => p.grupo === g)).map((g) => (
            <section key={g}>
              <h3 className="mb-1 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-muted">
                <span className={`h-2 w-2 rounded-full ${GRUPO[g].barra} ${g === 'SIN_FECHA' ? 'ring-1 ring-border-strong' : ''}`} />
                {t(GRUPO[g].clave)}
                <span className="demo-num">{formatNumero(porGrupo[g])}</span>
              </h3>
              <ul className="m-0 list-none divide-y divide-border p-0">
                {listadas
                  .filter((p) => p.grupo === g)
                  .map((p) => (
                    <FilaOrden
                      key={p.orden.id}
                      p={p}
                      puedeCrear={puedeCrear}
                      puedeVerCampanas={puedeVerCampanas}
                      puedeArte={puedeArte}
                      avanzando={avanzando}
                      subiendo={subiendoPara === p.orden.id}
                      onAvanzar={avanzar}
                      onSubirArte={elegirArte}
                      onAbrirArte={(creativoId) => setVerArte({ ordenId: p.orden.id, creativoId })}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </CardColapsable>

      <input
        ref={archivoRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onArchivo}
      />

      <VerArteDialog
        key={verArte?.creativoId ?? 'cerrado'}
        orden={abierta}
        creativo={creativoAbierto}
        puedeArte={puedeArte}
        onClose={() => setVerArte(null)}
        onElegir={(creativoId) => abierta && setVerArte({ ordenId: abierta.id, creativoId })}
      />

      <NuevaOrdenDialog open={nueva} onClose={() => setNueva(false)} />
    </div>
  )
}

function FilaOrden({
  p,
  puedeCrear,
  puedeVerCampanas,
  puedeArte,
  avanzando,
  subiendo,
  onAvanzar,
  onSubirArte,
  onAbrirArte,
}: {
  p: Priorizada<OrdenVista>
  puedeCrear: boolean
  puedeVerCampanas: boolean
  puedeArte: boolean
  avanzando: string | null
  subiendo: boolean
  onAvanzar: (id: string) => void
  onSubirArte: (o: OrdenVista) => void
  onAbrirArte: (creativoId: string) => void
}) {
  const t = useTexto()
  const { idioma } = useIdioma()
  const o = p.orden
  const idx = PROCESO.indexOf(o.estatus)
  const digital = o.alto === 0 && o.ancho === 0
  const enFinal = idx >= PROCESO.length - 1
  const proporcion = o.medida ? o.medida.ancho / o.medida.alto : null
  return (
    <li className="flex flex-col gap-3 py-3 first:pt-1 last:pb-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        {/* Izquierda: lugar en la cola, qué se imprime, dónde y para qué campaña. */}
        <div className="flex min-w-0 gap-3">
          <span
            className={`demo-num mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold ${
              p.lugar == null ? 'bg-success-soft text-[#146c39]' : p.grupo === 'ATRASADA' ? 'bg-error-soft text-[#b42318]' : p.grupo === 'SEMANA' ? 'bg-warning-soft text-[#9a6700]' : 'bg-surface-2 text-ink'
            }`}
            title={p.lugar == null ? t('operaciones.imprenta.grupo.lista') : t('operaciones.imprenta.prioridad.lugar', { n: p.lugar })}
          >
            {p.lugar == null ? <Check className="h-3.5 w-3.5" /> : p.lugar}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="demo-num text-[12px] text-muted">{o.folio}</span>
              <span className="text-[14px] font-medium text-ink">{o.material || t('operaciones.imprenta.sin-material')}</span>
              <TextoDias p={p} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" />
                {/* 18/11 · con `formatNumero` y el idioma: el literal pintaba «12.9 × 7.2 m»
                    con punto en portugués e italiano, al lado del «12,9 × 7,2 m» de la arte. */}
                {digital
                  ? t('operaciones.imprenta.contenido-digital')
                  : `${formatNumero(o.ancho, decimalesDe(o.ancho), idioma)} × ${formatNumero(o.alto, decimalesDe(o.alto), idioma)} m`}
              </span>
              {o.nombreSitio && <span>{o.nombreSitio}</span>}
              {o.proveedor && <span>· {o.proveedor}</span>}
              {o.nombreCampana ? (
                puedeVerCampanas ? (
                  <Link
                    href={`/campanas/${o.campanaId}`}
                    className="inline-flex items-center gap-1 font-medium text-info hover:underline"
                  >
                    {t('operaciones.imprenta.campana', { nombre: o.nombreCampana })} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span>{t('operaciones.imprenta.campana', { nombre: o.nombreCampana })}</span>
                )
              ) : (
                <span>{t('operaciones.imprenta.sin-campana')}</span>
              )}
            </div>
            {/* Progreso: una barra de un solo color y el paso en texto
                (el color no carga el significado solo). */}
            <div className="mt-1.5 flex items-center gap-2" title={PROCESO.map((x) => t(CLAVE_IMPRESION[x])).join(' → ')}>
              <div className="flex w-28 gap-0.5" aria-hidden>
                {PROCESO.map((x, i) => (
                  <span key={x} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-info' : 'bg-surface-2'}`} />
                ))}
              </div>
              <span className="demo-num text-[11px] text-muted">
                {t('operaciones.imprenta.paso', { n: idx + 1, total: PROCESO.length })}
              </span>
            </div>
          </div>
        </div>

        {/* Derecha: prueba de color, estado y las acciones de siempre. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              o.pruebaColorAprobada
                ? 'border-transparent bg-success-soft text-[#0f7a55]'
                : 'border-border text-muted'
            }`}
          >
            {o.pruebaColorAprobada ? t('operaciones.imprenta.prueba-aprobada') : t('operaciones.imprenta.prueba-pendiente')}
          </span>
          <StatusBadge tono={IMPRESION_TONO[o.estatus]}>
            {t(CLAVE_IMPRESION[o.estatus])}
          </StatusBadge>
          {puedeCrear && !o.pruebaColorAprobada && (
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                try { await aprobarPruebaColorApi(o.id, true) } catch (e) { toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.error')) }
              }}
            >
              {t('operaciones.imprenta.aprobar-prueba')}
            </Button>
          )}
          {puedeCrear && !enFinal && (
            <Button
              size="sm"
              variant="secondary"
              disabled={avanzando === o.id}
              onClick={() => onAvanzar(o.id)}
            >
              {avanzando === o.id ? t('operaciones.imprenta.avanzando') : t('operaciones.imprenta.avanzar')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* IMP-CREA · el arte de la campaña, cada pieza en la proporción del
          sitio de esta orden. */}
      <div className="ml-10 rounded-md border border-border bg-surface-2/50 px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[12px] font-medium text-ink">{t('operaciones.imprenta.arte.titulo')}</span>
            <TextoMedida medida={o.medida} />
          </div>
          {puedeArte && o.campanaId && (
            <Button size="sm" variant="secondary" disabled={subiendo} onClick={() => onSubirArte(o)}>
              <Upload className="h-3.5 w-3.5" />
              {subiendo ? t('operaciones.imprenta.arte.subiendo') : t('operaciones.imprenta.arte.subir')}
            </Button>
          )}
        </div>
        {o.arte.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <ImageOff className="h-3.5 w-3.5" /> {t('operaciones.imprenta.arte.sin')}
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-3">
            {o.arte.map((cr) => (
              <div key={cr.id} className="flex flex-col gap-1">
                <MiniaturaArte creativo={cr} proporcion={proporcion} onAbrir={() => onAbrirArte(cr.id)} />
                <div className="flex max-w-[180px] items-center gap-1">
                  <StatusBadge tono={CREATIVIDAD_TONO[cr.estatusValidacion]}>
                    {t(CLAVE_ESTADO_ARTE[cr.estatusValidacion])}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

// «Arranca en 3 días» / «Arrancó hace 2 días» / «Arranca hoy», en el tono de su
// grupo. Una orden ya lista no dice nada: dejó de correr.
function TextoDias({ p }: { p: Priorizada<OrdenVista> }) {
  const t = useTexto()
  if (p.grupo === 'LISTA') return null
  if (p.dias == null) return <span className="text-[12px] text-muted">{t('operaciones.imprenta.dias.sin')}</span>
  const color =
    p.grupo === 'ATRASADA' ? 'text-[#b42318]' : p.grupo === 'SEMANA' ? 'text-[#9a6700]' : 'text-muted'
  const n = Math.abs(p.dias)
  const texto =
    p.dias === 0
      ? t('operaciones.imprenta.dias.hoy')
      : p.dias > 0
        ? t(n === 1 ? 'operaciones.imprenta.dias.falta.uno' : 'operaciones.imprenta.dias.falta.otros', { n })
        : t(n === 1 ? 'operaciones.imprenta.dias.paso.uno' : 'operaciones.imprenta.dias.paso.otros', { n })
  return <span className={`demo-num text-[12px] font-medium ${color}`}>{texto}</span>
}

// El arte en grande, en el marco del sitio: a sangre (como sale la lona) o
// completo (para ver qué se pierde). Desde aquí Comercial lo aprueba o rechaza,
// porque el arte de una campaña fija no sale en la pantalla de Creativos.
function VerArteDialog({
  orden,
  creativo,
  puedeArte,
  onClose,
  onElegir,
}: {
  orden: OrdenVista | null
  creativo: CreativoDeImpresion | null
  puedeArte: boolean
  onClose: () => void
  onElegir: (creativoId: string) => void
}) {
  const t = useTexto()
  const [modo, setModo] = useState<'cover' | 'contain'>('cover')
  const [ajuste, setAjuste] = useState<Ajuste | null>(null)
  const [enviando, setEnviando] = useState(false)
  if (!orden || !creativo) return null
  const proporcion = orden.medida ? orden.medida.ancho / orden.medida.alto : null
  // Que quepa en el modal: hasta 360 px de alto y 640 de ancho.
  const alto = Math.round(Math.min(360, 640 / proporcionDibujable(proporcion ?? 16 / 9)))

  async function validar(aprobar: boolean) {
    if (!creativo) return
    setEnviando(true)
    try {
      await validarCreatividadApi(creativo.id, aprobar)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.arte.no-validar'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      size="lg"
      onOpenChange={(v) => !v && onClose()}
      title={creativo.nombre}
      subtitle={[orden.folio, orden.nombreSitio, orden.nombreCampana].filter(Boolean).join(' · ')}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {puedeArte && creativo.estatusValidacion !== 'RECHAZADA' && (
            <Button variant="secondary" size="sm" disabled={enviando} onClick={() => validar(false)}>
              <X className="h-3.5 w-3.5" /> {t('operaciones2.creativos.rechazar')}
            </Button>
          )}
          {puedeArte && creativo.estatusValidacion !== 'VALIDADA' && (
            <Button variant="success" size="sm" disabled={enviando} onClick={() => validar(true)}>
              <Check className="h-3.5 w-3.5" /> {t('operaciones.imprenta.arte.aprobar')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cerrar')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge tono={CREATIVIDAD_TONO[creativo.estatusValidacion]}>
              {t(CLAVE_ESTADO_ARTE[creativo.estatusValidacion])}
            </StatusBadge>
            <TextoMedida medida={orden.medida} />
            <TextoAjuste ajuste={ajuste} />
          </div>
          <div className="inline-flex rounded border border-border p-0.5 text-[12px]" role="group">
            {(['cover', 'contain'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={`rounded px-2 py-0.5 ${modo === m ? 'bg-ink text-surface' : 'text-muted hover:text-ink'}`}
              >
                {t(m === 'cover' ? 'operaciones.imprenta.arte.a-sangre' : 'operaciones.imprenta.arte.completo')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-center rounded-md bg-surface-2 p-4">
          <ArteEnSitio
            key={`${creativo.id}-${modo}`}
            creativo={creativo}
            proporcion={proporcion}
            alto={alto}
            modo={modo}
            onAjuste={setAjuste}
          />
        </div>
        {orden.arte.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {orden.arte.map((cr) => (
              <button
                key={cr.id}
                type="button"
                onClick={() => onElegir(cr.id)}
                className={`rounded-sm ${cr.id === creativo.id ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100'}`}
                title={cr.nombre}
              >
                <ArteEnSitio creativo={cr} proporcion={proporcion} alto={40} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function NuevaOrdenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTexto()
  const { idioma } = useIdioma()
  const campanas = useCampanas()
  const sitios = useSitios()
  const [campanaId, setCampanaId] = useState('')
  const [sitioId, setSitioId] = useState('')
  const [material, setMaterial] = useState('')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [enviando, setEnviando] = useState(false)

  // OBLIG-01 · la campaña es lo único que exige el servidor
  // (`impresion-controller.ts:13`).
  const ob = useObligatorios({ campanaId }, ['campanaId'])

  async function guardar() {
    if (!ob.validar()) return
    // P-L2-1 · en italiano las medidas van por `EntradaCifra` («12,9»); lo
    // ilegible llega como 'NaN' (en rojo en el campo) y no se manda. En
    // español e inglés `cifraIlegible` es `false`.
    if (cifraIlegible(ancho, idioma) || cifraIlegible(alto, idioma)) return
    setEnviando(true)
    try {
      await crearOrdenImpresionApi({
        campanaId,
        sitioId: sitioId || null,
        material: material.trim(),
        ancho: ancho ? Number(ancho) : 0,
        alto: alto ? Number(alto) : 0,
        proveedor: proveedor.trim(),
      })
      setCampanaId(''); setSitioId(''); setMaterial(''); setAncho(''); setAlto(''); setProveedor('')
      ob.reiniciar()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.no-crear'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={t('operaciones.imprenta.nueva-titulo')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button variant="success" size="sm" disabled={enviando} onClick={guardar}>
            {enviando ? t('operaciones.imprenta.creando') : t('operaciones.imprenta.crear')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('operaciones.imprenta.campo.campana')} obligatorio falta={ob.falta('campanaId')}>
          <select
            value={campanaId}
            onChange={(e) => setCampanaId(e.target.value)}
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          >
            <option value="">{t('operaciones.imprenta.selecciona-campana')}</option>
            {(campanas ?? [])
              .filter((c) => c.tipoCampana !== 'DOOH') // digital no imprime
              .map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
          </select>
        </Campo>
        <Campo label={t('operaciones.imprenta.campo.sitio')}>
          <select
            value={sitioId}
            onChange={(e) => setSitioId(e.target.value)}
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          >
            <option value="">—</option>
            {(sitios ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </Campo>
        <Campo label={t('operaciones.imprenta.campo.material')}>
          <input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder={t('operaciones.imprenta.campo.material-ej')}
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label={t('operaciones.imprenta.campo.ancho')}>
            <EntradaCifra
              type="number" inputMode="decimal" valor={ancho}
              onCambio={setAncho} placeholder="0" decimales={2} minimo={0}
              className="demo-num w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
            />
          </Campo>
          <Campo label={t('operaciones.imprenta.campo.alto')}>
            <EntradaCifra
              type="number" inputMode="decimal" valor={alto}
              onCambio={setAlto} placeholder="0" decimales={2} minimo={0}
              className="demo-num w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
            />
          </Campo>
        </div>
        <Campo label={t('operaciones.imprenta.campo.proveedor')}>
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder={t('operaciones.imprenta.campo.proveedor-ej')}
            className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
          />
        </Campo>
        <p className="text-[11px] text-muted">{t('operaciones.imprenta.digital-ayuda')}</p>
      </div>
    </Modal>
  )
}
