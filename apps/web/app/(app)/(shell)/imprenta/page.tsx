'use client'

import { toast } from 'sonner'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Ruler, Plus, ChevronRight, Upload, ImageOff, Check, X, Printer, CalendarClock } from 'lucide-react'
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
  asignarImprentaApi,
  fijarFechaEspecialApi,
  type ImprentaApi,
} from '@/lib/data/estado-api'
import { MandarAImpresionDialog, OrigenCreativoBadge, usePendientes } from '@/components/operaciones/PendientesCreativo'
import type { Pendiente } from '@/lib/pendientes-creativo'
import { formatFecha } from '@/lib/data/client'
import {
  useOrdenesImpresion,
  useCampanas,
  useSitios,
  useCreatividades,
  useConfigNegocio,
  type EstOrdenImpresion,
} from '@/lib/data/client'
import type { OrdenImpresion, CreativoDeImpresion, EstValidacionCreatividad } from '@/lib/data/types'
import { cuerpoArte, topeArteMb } from '@/lib/arte-impresion'
import {
  priorizarImpresion,
  conteoPorGrupo,
  diaLocal,
  ORDEN_GRUPOS,
  type GrupoPrioridad,
  type Priorizada,
} from '@/lib/prioridad-imprenta'
import { medidaDeOrden } from '@/lib/proporcion-pantalla'
import { ArteEnSitio, MiniaturaArte, TextoMedida, esHtml, medidaEnIdioma } from '@/components/operaciones/ArteEnSitio'
import { RevisionArte, pixelesDeImagen } from '@/components/operaciones/ValoracionArte'
import { valorarArte } from '@/lib/valoracion-arte'
import { resolverRequisitos, type Requisitos } from '@/lib/requisitos-impresion'
import { ImprentasCard, useImprentas } from '@/components/operaciones/Imprentas'

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
  // IMP-REQ (18/11) · los requisitos de arte que mandan para esta orden:
  // los de su imprenta, si no los de la empresa, si no las constantes.
  requisitos: Requisitos
}

export default function ImprentaPage() {
  const t = useTexto()
  const ois = useOrdenesImpresion()
  const campanas = useCampanas()
  const sitios = useSitios()
  const creatividades = useCreatividades()
  const config = useConfigNegocio()
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
  // IMP-VAL (18/11) · el archivo elegido espera aquí a que se revise su
  // valoración contra la lona; no se sube hasta confirmar.
  const [porSubir, setPorSubir] = useState<ArchivoPorSubir | null>(null)
  // IMP-REQ (18/11) · las imprentas de la organización, para elegirlas en la
  // orden y gestionarlas con sus requisitos.
  const { imprentas, recargar: recargarImprentas } = useImprentas(true)
  // FLUJO-CREA (20/11) · «Por mandar a impresión»: sitios fijos con creativo
  // aprobado y sin orden. Derivado en el servidor; nada se crea solo.
  const { pendientes, recargar: recargarPendientes } = usePendientes('impresion')
  const [mandando, setMandando] = useState<Pendiente | null>(null)
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
            requisitos: resolverRequisitos(o.imprentaRequisitos, config?.requisitosImpresion),
          }
        })
        .filter((o) => o.tipoCampana !== 'DOOH'),
    [ois, campanas, sitios, creatividades, config],
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

  // IMP-VAL (18/11) · al elegir el archivo NO se sube: se lee (data URL y
  // píxeles) y se abre la revisión contra la lona. El tope de peso ya no corta
  // aquí con un aviso suelto: sale en rojo en la valoración y deja el botón
  // apagado, que dice lo mismo y además enseña cómo se vería.
  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    const o = destinoSubida.current
    if (!f || !o) return
    const reader = new FileReader()
    reader.onerror = () => toast.error(t('operaciones.imprenta.valoracion.confirmar.no-leer'))
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const pixeles = await pixelesDeImagen(f)
      setPorSubir({ orden: o, archivo: f, dataUrl, pixeles })
    }
    reader.readAsDataURL(f)
  }

  // Hasta 4 MB el arte se guarda como el de Creativos (`imagenAHtml`): así una
  // campaña híbrida no estrena un formato que el player DOOH no conoce. Una
  // OOH puede subir hasta 15 MB y, por encima de 4, la imagen va SOLA en
  // `archivoUrl` (`lib/arte-impresion.ts` explica por qué: memoria y respaldos).
  async function subirArte(p: ArchivoPorSubir) {
    const tope = topeArteMb(p.orden.tipoCampana)
    if (p.archivo.size > tope * 1024 * 1024) {
      toast.error(t('operaciones2.creativos.imagen-supera', { mb: tope }))
      return
    }
    setPorSubir(null)
    setSubiendoPara(p.orden.id)
    try {
      await crearCreatividadApi(
        cuerpoArte({
          campanaId: p.orden.campanaId,
          nombre: p.archivo.name,
          dataUrl: p.dataUrl,
          tipo: p.archivo.type,
          bytes: p.archivo.size,
        }),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('operaciones.imprenta.arte.no-subir'))
    }
    setSubiendoPara(null)
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

      {/* FLUJO-CREA (20/11) · la «tarea 1»: lo aprobado que falta mandar a
          imprimir, arriba de todo. Solo aparece si hay algo. */}
      {pendientes && pendientes.length > 0 && (
        <PendientesImpresionCard pendientes={pendientes} puedeCrear={puedeCrear} onMandar={setMandando} />
      )}

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

      {/* IMP-REQ (18/11) · imprentas y requisitos del arte. */}
      <ImprentasCard imprentas={imprentas} recargar={recargarImprentas} requisitosEmpresa={config?.requisitosImpresion} />

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
                      imprentas={imprentas}
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

      <ConfirmarArteDialog porSubir={porSubir} onCancelar={() => setPorSubir(null)} onSubir={subirArte} />

      <VerArteDialog
        key={verArte?.creativoId ?? 'cerrado'}
        orden={abierta}
        creativo={creativoAbierto}
        puedeArte={puedeArte}
        onClose={() => setVerArte(null)}
        onElegir={(creativoId) => abierta && setVerArte({ ordenId: abierta.id, creativoId })}
      />

      <NuevaOrdenDialog open={nueva} onClose={() => setNueva(false)} imprentas={imprentas} />

      <MandarAImpresionDialog
        pendiente={mandando}
        imprentas={imprentas}
        onClose={() => setMandando(null)}
        onHecho={recargarPendientes}
      />
    </div>
  )
}

function FilaOrden({
  p,
  puedeCrear,
  puedeVerCampanas,
  puedeArte,
  imprentas,
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
  imprentas: ImprentaApi[] | null
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
            {/* FLUJO-CREA (20/11) · qué fecha manda en esta orden; la especial
                se pone o se quita aquí mismo. */}
            {p.grupo !== 'LISTA' && <FechaEspecial p={p} puedeCrear={puedeCrear} />}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" />
                {digital ? t('operaciones.imprenta.contenido-digital') : medidaEnIdioma(o.ancho, o.alto, idioma)}
              </span>
              {o.nombreSitio && <span>{o.nombreSitio}</span>}
              {o.proveedor && <span>· {o.proveedor}</span>}
              {/* IMP-REQ · la imprenta de la orden: sus requisitos valoran el arte. */}
              {puedeCrear && imprentas ? (
                <select
                  aria-label={t('operaciones.imprenta.imprentas.orden.imprenta')}
                  value={o.imprentaId ?? ''}
                  onChange={async (e) => {
                    try {
                      await asignarImprentaApi(o.id, e.target.value || null)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t('operaciones.imprenta.error'))
                    }
                  }}
                  className="max-w-[220px] rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] text-ink"
                >
                  <option value="">{t('operaciones.imprenta.imprentas.orden.sin')}</option>
                  {imprentas
                    .filter((im) => im.activo || im.id === o.imprentaId)
                    .map((im) => (
                      <option key={im.id} value={im.id}>{im.nombre}</option>
                    ))}
                </select>
              ) : (
                o.imprentaNombre && <span>· {o.imprentaNombre}</span>
              )}
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
  // Con fecha especial no «arranca»: «se requiere» ese día.
  const esp = p.base === 'ESPECIAL'
  const texto =
    p.dias === 0
      ? t(esp ? 'operaciones.imprenta.dias.especial.hoy' : 'operaciones.imprenta.dias.hoy')
      : p.dias > 0
        ? esp
          ? t(n === 1 ? 'operaciones.imprenta.dias.especial.falta.uno' : 'operaciones.imprenta.dias.especial.falta.otros', { n })
          : t(n === 1 ? 'operaciones.imprenta.dias.falta.uno' : 'operaciones.imprenta.dias.falta.otros', { n })
        : esp
          ? t(n === 1 ? 'operaciones.imprenta.dias.especial.paso.uno' : 'operaciones.imprenta.dias.especial.paso.otros', { n })
          : t(n === 1 ? 'operaciones.imprenta.dias.paso.uno' : 'operaciones.imprenta.dias.paso.otros', { n })
  return <span className={`demo-num text-[12px] font-medium ${color}`}>{texto}</span>
}

// FLUJO-CREA (20/11) · «Por inicio de campaña» o «Por fecha especial: …», y
// con `imprenta.crear` un campo de fecha para ponerla o quitarla
// (`PATCH /api/impresion/[id]/fecha-especial`). La cola se reordena sola al
// refrescar el estado.
function FechaEspecial({ p, puedeCrear }: { p: Priorizada<OrdenVista>; puedeCrear: boolean }) {
  const { t, idioma } = useIdioma()
  const o = p.orden
  const [valor, setValor] = useState(o.fechaEspecial ?? '')
  const [guardando, setGuardando] = useState(false)
  async function guardar(fecha: string | null) {
    setGuardando(true)
    try {
      await fijarFechaEspecialApi(o.id, fecha)
      toast.success(t(fecha ? 'operaciones.imprenta.fecha-especial.guardada' : 'operaciones.imprenta.fecha-especial.quitada'))
      if (!fecha) setValor('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.error'))
    }
    setGuardando(false)
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
      <span className="inline-flex items-center gap-1">
        <CalendarClock className="h-3.5 w-3.5" />
        {o.fechaEspecial
          ? t('operaciones.imprenta.fecha-especial.por-especial', { fecha: formatFecha(o.fechaEspecial, idioma) })
          : t('operaciones.imprenta.fecha-especial.por-inicio')}
      </span>
      {puedeCrear && (
        <>
          <input
            type="date"
            aria-label={t('operaciones.imprenta.fecha-especial.poner')}
            title={t('operaciones.imprenta.fecha-especial.ayuda')}
            value={valor}
            disabled={guardando}
            onChange={(e) => {
              setValor(e.target.value)
              if (e.target.value && e.target.value !== o.fechaEspecial) void guardar(e.target.value)
            }}
            className="demo-num rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] text-ink"
          />
          {o.fechaEspecial && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => guardar(null)}
              className="font-medium text-info hover:underline disabled:opacity-50"
            >
              {t('operaciones.imprenta.fecha-especial.quitar')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// FLUJO-CREA (20/11) · «Por mandar a impresión». Cada sitio fijo con creativo
// aprobado y sin orden, con quién subió el arte y el botón para confirmarlo.
// Sin `imprenta.crear` se ve la lista sin botón (y el servidor daría 403).
function PendientesImpresionCard({
  pendientes,
  puedeCrear,
  onMandar,
}: {
  pendientes: Pendiente[]
  puedeCrear: boolean
  onMandar: (p: Pendiente) => void
}) {
  const { t, idioma } = useIdioma()
  return (
    <CardColapsable
      id="imprenta.pendientes"
      titulo={t('operaciones.imprenta.pendientes.titulo')}
      resumen={
        <span className="demo-num text-[12px] text-muted">
          {t(pendientes.length === 1 ? 'operaciones.imprenta.pendientes.uno' : 'operaciones.imprenta.pendientes.otros', { n: pendientes.length })}
        </span>
      }
    >
      <p className="mb-2 text-[12px] text-muted">{t('operaciones.imprenta.pendientes.detalle')}</p>
      <ul className="m-0 list-none divide-y divide-border p-0">
        {pendientes.map((p) => (
          <li key={p.clave} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[14px] font-medium text-ink">{p.sitioNombre}</span>
                {p.sitioAncho && p.sitioAlto ? (
                  <span className="demo-num text-[12px] text-muted">{medidaEnIdioma(p.sitioAncho, p.sitioAlto, idioma)}</span>
                ) : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                <span>{t('operaciones.imprenta.campana', { nombre: p.campanaNombre })}</span>
                {p.campanaInicio && (
                  <span className="demo-num">{t('operaciones.imprenta.pendientes.arranca', { fecha: formatFecha(p.campanaInicio, idioma) })}</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {p.creativos.map((cr, i) => (
                  <span key={cr.id ?? i} className="inline-flex items-center gap-1.5 text-[12px] text-ink">
                    {cr.nombre} <OrigenCreativoBadge origen={cr.origen} subidoPorNombre={cr.subidoPorNombre} />
                  </span>
                ))}
              </div>
            </div>
            {puedeCrear && (
              <Button size="sm" variant="primary" className="shrink-0" onClick={() => onMandar(p)}>
                <Printer className="h-3.5 w-3.5" /> {t('operaciones.imprenta.pendientes.mandar')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </CardColapsable>
  )
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
  const [enviando, setEnviando] = useState(false)
  if (!orden || !creativo) return null
  const proporcion = orden.medida ? orden.medida.ancho / orden.medida.alto : null
  // `esImagen` manda, como en `ArteEnSitio`: una imagen envuelta en HTML se
  // sirve como imagen por `/arte/` y se puede medir.
  const imagen = creativo.esImagen || !esHtml(creativo)

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge tono={CREATIVIDAD_TONO[creativo.estatusValidacion]}>
            {t(CLAVE_ESTADO_ARTE[creativo.estatusValidacion])}
          </StatusBadge>
          <TextoMedida medida={orden.medida} />
        </div>
        {/* IMP-VAL · la lona a escala con el arte puesto y si sirve. */}
        <RevisionArte
          medida={orden.medida}
          src={creativo.archivoUrl ?? null}
          imagen={imagen}
          creativo={creativo}
          requisitos={orden.requisitos}
        />
        {orden.imprentaNombre && (
          <p className="text-[11px] text-muted">
            {t('operaciones.imprenta.imprentas.orden.valora', { nombre: orden.imprentaNombre })}
          </p>
        )}
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

type ArchivoPorSubir = {
  orden: OrdenVista
  archivo: File
  dataUrl: string
  pixeles: { ancho: number; alto: number } | null
}

// IMP-VAL (18/11) · el paso que faltaba entre elegir el archivo y subirlo: la
// lona a escala con el arte puesto y la valoración. Rojo no impide subir —quién
// aprueba y el flujo de estatus no cambian—, pero el botón dice «de todos
// modos». Lo único que bloquea es el peso, porque el servidor lo rechazaría.
function ConfirmarArteDialog({
  porSubir,
  onCancelar,
  onSubir,
}: {
  porSubir: ArchivoPorSubir | null
  onCancelar: () => void
  onSubir: (p: ArchivoPorSubir) => void
}) {
  const t = useTexto()
  if (!porSubir) return null
  const { orden, archivo, dataUrl, pixeles } = porSubir
  const tope = topeArteMb(orden.tipoCampana)
  const v = valorarArte(
    orden.medida,
    { anchoPx: pixeles?.ancho ?? null, altoPx: pixeles?.alto ?? null, tipo: archivo.type, bytes: archivo.size },
    tope,
    orden.requisitos,
  )
  const pesoExcedido = v.peso?.semaforo === 'rojo'
  return (
    <Modal
      open
      size="lg"
      onOpenChange={(abierto) => !abierto && onCancelar()}
      title={t('operaciones.imprenta.valoracion.confirmar.titulo')}
      subtitle={[archivo.name, orden.folio, orden.nombreSitio].filter(Boolean).join(' · ')}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancelar}>{t('comun.cancelar')}</Button>
          <Button variant="success" size="sm" disabled={pesoExcedido} onClick={() => onSubir(porSubir)}>
            <Upload className="h-3.5 w-3.5" />
            {v.general === 'rojo' && !pesoExcedido
              ? t('operaciones.imprenta.valoracion.confirmar.subir-igual')
              : t('operaciones.imprenta.arte.subir')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <TextoMedida medida={orden.medida} />
        <RevisionArte
          medida={orden.medida}
          src={dataUrl}
          imagen
          pixeles={pixeles}
          tipo={archivo.type}
          bytes={archivo.size}
          maxMb={tope}
          requisitos={orden.requisitos}
        />
        {orden.imprentaNombre && (
          <p className="text-[11px] text-muted">
            {t('operaciones.imprenta.imprentas.orden.valora', { nombre: orden.imprentaNombre })}
          </p>
        )}
      </div>
    </Modal>
  )
}

function NuevaOrdenDialog({
  open,
  onClose,
  imprentas,
}: {
  open: boolean
  onClose: () => void
  imprentas: ImprentaApi[] | null
}) {
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
  const [imprentaId, setImprentaId] = useState('')
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
        imprentaId: imprentaId || null,
      })
      setCampanaId(''); setSitioId(''); setMaterial(''); setAncho(''); setAlto(''); setProveedor(''); setImprentaId('')
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
        {imprentas && imprentas.some((im) => im.activo) && (
          <Campo label={t('operaciones.imprenta.imprentas.orden.imprenta')}>
            <select
              value={imprentaId}
              onChange={(e) => setImprentaId(e.target.value)}
              className="w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink"
            >
              <option value="">{t('operaciones.imprenta.imprentas.orden.sin')}</option>
              {imprentas
                .filter((im) => im.activo)
                .map((im) => (
                  <option key={im.id} value={im.id}>{im.nombre}</option>
                ))}
            </select>
          </Campo>
        )}
        <p className="text-[11px] text-muted">{t('operaciones.imprenta.digital-ayuda')}</p>
      </div>
    </Modal>
  )
}
