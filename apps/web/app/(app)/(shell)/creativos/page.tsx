'use client'

import { toast } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Images, Upload, Check, X, Code2, Eye, Download, RefreshCw, Trash2, AlertTriangle, Search } from 'lucide-react'
import { KPICard } from '@/components/demo/KPICard'
import { StatusBadge, CREATIVIDAD_TONO } from '@/components/demo/StatusBadge'
import { conteo } from '@/lib/plural'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { EmptyState } from '@/components/demo/EmptyState'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  crearCreatividadApi,
  validarCreatividadApi,
  asignarCreativosApi,
  eliminarCreatividadApi,
  reemplazarCreatividadApi,
} from '@/lib/data/estado-api'
import { useCampanas, useCreatividades, useReservas, useSitios, useClientes } from '@/lib/data/client'
import { imagenAHtml, IMAGEN_CREATIVO_MAX_MB } from '@/lib/creativo-html'
import { soloDigitales } from '@/lib/creativos-digitales'
import type { Campana, Creatividad, Reserva, Sitio, EstValidacionCreatividad } from '@/lib/data/types'
import { formatNumero } from '@/lib/formato-numero'
import { rotacionEnSpot } from '@/lib/reparto-creativos'

// Si un creativo HTML es una imagen envuelta (ver imagenAHtml), devuelve su data
// URL para mostrarlo como imagen en previews/miniaturas; si no, null.
function imagenDeCodigo(codigo?: string | null): string | null {
  if (!codigo) return null
  const m = codigo.match(/<img[^>]+src="(data:image\/[^"]+)"/i)
  return m ? m[1] : null
}

// Un creativo es HTML si su formato lo dice, o si su archivo es un
// data:text/html / .html — se renderiza en <iframe> (un <img> no puede pintar
// HTML).
//
// EL `formato` MANDA, y esto dejó de ser un detalle: el arte ya no viaja en el
// payload —se sirve por `/api/creativos/<id>/arte/`— así que mirar el principio
// de `archivoUrl` ya no dice nada, porque ahora todos empiezan igual. Antes
// bastaba con `=== 'HTML'`; en producción conviven TRES formatos para lo mismo
// («HTML», «text/html» y las imágenes envueltas en HTML), así que se compara en
// minúsculas y por prefijo. Con `=== 'HTML'` a secas, los ocho creativos que
// tienen «text/html» se habrían intentado pintar en un <img>.
//
// Las dos comprobaciones sobre la URL se conservan: el portal público sigue
// mandando el arte incrustado y no pasa por aquí, pero un `.html` alojado fuera
// sí llegaría con su extensión.
function esCreativoHtml(cr?: { formato?: string | null; archivoUrl?: string | null } | null): boolean {
  const f = (cr?.formato ?? '').toLowerCase()
  if (f === 'html' || f.startsWith('text/html')) return true
  const url = cr?.archivoUrl ?? ''
  return url.startsWith('data:text/html') || /\.html?(\?|#|$)/i.test(url)
}

// Fuente HTML de un creativo, venga como texto en `codigo` o embebida en un
// data: URL (base64 o percent-encoded). null si no hay HTML que enseñar (imagen
// remota, PDF, o un .html que vive en el bucket y habría que descargar aparte).
function htmlDeCreativo(cr?: Creatividad | null): string | null {
  if (cr?.codigo) return cr.codigo
  const m = (cr?.archivoUrl ?? '').match(/^data:text\/html([^,]*),([\s\S]*)$/i)
  if (!m) return null
  try {
    if (/;base64/i.test(m[1])) {
      const bin = atob(m[2])
      return new TextDecoder('utf-8').decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    }
    return decodeURIComponent(m[2])
  } catch {
    return null // data: URL corrupto
  }
}

// Descarga el HTML como archivo. Un Blob descargado no se ejecuta, así que es
// seguro incluso con creativos subidos por clientes externos.
function descargarHtml(nombre: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const base = (nombre || 'creativo').replace(/[^\w.-]+/g, '_').replace(/\.html?$/i, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// Pantalla de creativos (debajo de Comercial): subir/aprobar imágenes por
// campaña y asignar cuál se exhibe en cada spot reservado.
export default function CreativosPage() {
  const campanas = useCampanas()
  const creatividades = useCreatividades()
  const reservas = useReservas()
  const sitios = useSitios()
  const clientes = useClientes()
  const puede = usePuede('comercial', 'crear')
  // Los hooks van antes del early-return del esqueleto: no pueden quedar detrás
  // de un return condicional.
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')

  if (!campanas || !creatividades || !reservas || !sitios) {
    return (
      <div className="w-full space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    )
  }

  // Solo pantallas DIGITALES (pedido del dueño, 2026-09-30: «en creativos no
  // deben de salir ninguna campaña de pantalla fija»). Una campaña toda fija no
  // sale; una mixta sale con sus reservas digitales. La regla, con pruebas, en
  // `lib/creativos-digitales.ts`.
  const { campanas: campanasDigitales, reservas: reservasDigitales } = soloDigitales(
    campanas,
    reservas,
    sitios,
  )

  // Solo campañas con spots reservados o con creativos (algo que gestionar).
  const gestionables = campanasDigitales.filter(
    (c) =>
      reservasDigitales.some((r) => r.campanaId === c.id) ||
      creatividades.some((cr) => cr.campanaId === c.id),
  )

  const term = q.trim().toLowerCase()
  const visibles = gestionables
    .filter((c) => {
      const crs = creatividades.filter((cr) => cr.campanaId === c.id)
      // El filtro de estado mira los creativos DE la campaña: la tarjeta
      // aparece si alguno está en ese estado. "SIN" son las campañas con slots
      // reservados que todavía no tienen ni un creativo — el pendiente real.
      if (filtro === 'SIN') {
        if (crs.length > 0) return false
      } else if (filtro && !crs.some((cr) => cr.estatusValidacion === filtro)) {
        return false
      }
      if (!term) return true
      const cliente = clientes?.find((x) => x.id === c.clienteId)?.nombre ?? ''
      return (
        c.nombre.toLowerCase().includes(term) ||
        c.folio.toLowerCase().includes(term) ||
        cliente.toLowerCase().includes(term) ||
        // También por nombre de archivo del creativo: estando en esta pantalla
        // es tan natural buscar "banner_home.html" como el nombre de la campaña.
        crs.some((cr) => cr.nombre.toLowerCase().includes(term))
      )
    })
    // Más recientes arriba, igual que el listado de Campañas. El store llega en
    // `creado_en asc`. Desempate por folio para que el orden sea estable.
    .sort(
      (a, b) =>
        b.creadoEn.localeCompare(a.creadoEn) || b.folio.localeCompare(a.folio),
    )

  // Indicadores de la red (solo presentación, sobre lo ya cargado): los
  // creativos y los spots de las campañas que esta pantalla gestiona. Un
  // creativo pendiente frena la publicación, y antes había que abrir campaña
  // por campaña para saber cuántos esperaban.
  const idsGestionables = new Set(gestionables.map((c) => c.id))
  const creasRed = creatividades.filter((cr) => idsGestionables.has(cr.campanaId))
  const porAprobar = creasRed.filter((cr) => cr.estatusValidacion === 'PENDIENTE' && !cr.retiradoEn).length
  const aprobadosRed = creasRed.filter((cr) => cr.estatusValidacion === 'VALIDADA' && !cr.retiradoEn).length
  const rechazados = creasRed.filter((cr) => cr.estatusValidacion === 'RECHAZADA' && !cr.retiradoEn).length
  const spotsRed = reservasDigitales.filter((r) => idsGestionables.has(r.campanaId))
  const spotsSin = spotsRed.filter((r) => r.creativos.length === 0).length

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Creativos</h1>
        <p className="mt-1 text-[13px] text-muted">
          Sube y aprueba las imágenes de cada campaña, y asigna cuál va en cada slot reservado.
        </p>
      </div>

      {gestionables.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            label="Por aprobar"
            value={formatNumero(porAprobar)}
            sub="frenan la publicación"
            tono={porAprobar > 0 ? 'ambar' : 'neutro'}
          />
          <KPICard label="Aprobados" value={formatNumero(aprobadosRed)} sub="listos para asignar" />
          <KPICard
            label="Rechazados"
            value={formatNumero(rechazados)}
            sub="hay que reemplazarlos"
            tono={rechazados > 0 ? 'rojo' : 'neutro'}
          />
          <KPICard
            label="Spots sin creativo"
            value={formatNumero(spotsSin)}
            sub={`de ${conteo(spotsRed.length, 'spot reservado', 'spots reservados')}`}
            tono={spotsSin > 0 ? 'ambar' : 'neutro'}
          />
        </div>
      )}

      {/* Filtro / búsqueda */}
      {gestionables.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              strokeWidth={1.75}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por campaña, folio, cliente o nombre del creativo…"
              className="h-9 w-full rounded border border-border-strong bg-surface pl-9 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-9 rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Todos los creativos</option>
            <option value="PENDIENTE">Con pendientes de aprobar</option>
            <option value="VALIDADA">Con aprobados</option>
            <option value="RECHAZADA">Con rechazados</option>
            <option value="SIN">Sin creativos todavía</option>
          </select>
          <span className="demo-num ml-auto text-[12px] text-muted">
            {visibles.length} de {gestionables.length}
          </span>
        </div>
      )}

      {gestionables.length === 0 ? (
        // Vacío honesto: si HAY campañas pero ninguna tiene pantallas
        // digitales, la razón es esa (esta pantalla solo gestiona digitales,
        // `soloDigitales`), y mandar a «reservar sitios» era inútil. El arte de
        // los medios fijos se lleva en Imprenta.
        campanas.length > 0 && campanasDigitales.length === 0 ? (
          <EmptyState
            icon={Images}
            titulo="Ninguna campaña tiene pantallas digitales"
            detalle={`Aquí solo se gestionan los creativos de pantallas digitales. Tus ${conteo(campanas.length, 'campaña', 'campañas')} son de medios fijos: su arte se lleva en Imprenta.`}
            accion={
              <Link href="/imprenta">
                <Button variant="secondary">Ir a Imprenta</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Images}
            titulo="Sin campañas con slots o creativos"
            detalle="Reserva sitios en Comercial o sube un creativo para gestionarlos aquí."
          />
        )
      ) : visibles.length === 0 ? (
        // Distinto del vacío de arriba: aquí SÍ hay campañas, solo que ninguna
        // pasa el filtro. Decirlo evita que parezca que se perdieron los datos.
        <EmptyState
          icon={Search}
          titulo="Ninguna campaña coincide"
          detalle="Prueba con otro texto de búsqueda o quita el filtro de estado."
          accion={
            <Button
              variant="secondary"
              onClick={() => {
                setQ('')
                setFiltro('')
              }}
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        visibles.map((c) => (
          <CampanaCard
            key={c.id}
            campana={c}
            creativos={creatividades.filter((cr) => cr.campanaId === c.id)}
            reservas={reservasDigitales.filter((r) => r.campanaId === c.id)}
            sitios={sitios}
            puede={puede}
          />
        ))
      )}
    </div>
  )
}

function CampanaCard({
  campana,
  creativos,
  reservas,
  sitios,
  puede,
}: {
  campana: Campana
  creativos: Creatividad[]
  reservas: Reserva[]
  sitios: Sitio[]
  puede: boolean
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const reemplazarRef = useRef<HTMLInputElement | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeNombre, setCodeNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  // OBLIG-01 · en el alta por código, el código es lo único obligatorio; el
  // nombre cae a «Creativo (código)» (el servidor sí lo exige, y lo recibe así).
  const ob = useObligatorios({ codigo }, ['codigo'])
  // Creativo cuyo HTML se está viendo en el modal (null = cerrado).
  const [verFuente, setVerFuente] = useState<Creatividad | null>(null)
  // La fuente se PIDE al abrir el modal. Antes venía dentro del payload de
  // hidratación, y por eso el shell se traía el arte de todos los creativos en
  // cada carga de página — casi 3 MB medidos en producción — para que alguien
  // pulsara «Ver HTML» en uno, de vez en cuando.
  const [fuente, setFuente] = useState<string | null>(null)
  const [cargandoFuente, setCargandoFuente] = useState(false)

  useEffect(() => {
    if (!verFuente) { setFuente(null); return }
    // Si el creativo TODAVÍA trae la fuente (recién subido, o el portal, que
    // sigue mandándola incrustada) no se pide nada: ya está aquí.
    const local = htmlDeCreativo(verFuente)
    if (local !== null) { setFuente(local); return }

    let vivo = true
    setCargandoFuente(true)
    setFuente(null)
    fetch(`/spaces-dooh/api/creativos/${verFuente.id}/arte/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => { if (vivo) setFuente(t) })
      .catch(() => { if (vivo) setFuente(null) })
      .finally(() => { if (vivo) setCargandoFuente(false) })
    return () => { vivo = false }
  }, [verFuente])
  // Creativo que se está reemplazando (para el input de archivo).
  const [reemplazarId, setReemplazarId] = useState<string | null>(null)
  // Creativo cuya eliminación se está confirmando (null = cerrado).
  const [confirmarEliminar, setConfirmarEliminar] = useState<Creatividad | null>(null)

  // Aprobados y asignables: excluye los retirados (siguen en DOOHmain, pero ya no
  // se pueden asignar a spots desde aquí).
  const aprobados = creativos.filter((cr) => cr.estatusValidacion === 'VALIDADA' && !cr.retiradoEn)
  // Para los chips del encabezado de la tarjeta (solo presentación).
  const pendientesAqui = creativos.filter((cr) => cr.estatusValidacion === 'PENDIENTE' && !cr.retiradoEn).length
  const spotsSinAqui = reservas.filter((r) => r.creativos.length === 0).length

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > IMAGEN_CREATIVO_MAX_MB * 1024 * 1024) {
      toast.error(`La imagen supera ${IMAGEN_CREATIVO_MAX_MB} MB`)
      return
    }
    setSubiendo(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        // Toda imagen subida se convierte a un creativo HTML (no se guarda como imagen).
        const dataUrl = reader.result as string
        await crearCreatividadApi({
          campanaId: campana.id,
          nombre: f.name,
          codigo: imagenAHtml(dataUrl, f.name),
          formato: 'text/html',
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo subir')
      }
      setSubiendo(false)
    }
    reader.readAsDataURL(f)
  }

  async function guardarCodigo() {
    if (!ob.validar()) return
    setSubiendo(true)
    try {
      await crearCreatividadApi({
        campanaId: campana.id,
        nombre: codeNombre.trim() || 'Creativo (código)',
        codigo,
        formato: 'text/html',
      })
      setCodigo('')
      setCodeNombre('')
      setCodeOpen(false)
      ob.reiniciar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    }
    setSubiendo(false)
  }

  async function validar(id: string, aprobar: boolean) {
    let motivo: string | undefined
    if (!aprobar) motivo = window.prompt('Motivo de rechazo (opcional):') ?? undefined
    setBusy(id)
    try {
      await validarCreatividadApi(id, aprobar, motivo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo validar')
    }
    setBusy(null)
  }

  // Elimina un creativo (confirmado por diálogo). Si estaba publicado, el backend
  // lo retira de DOOHmain.
  async function confirmarEliminarDo() {
    const cr = confirmarEliminar
    if (!cr) return
    setBusy(cr.id)
    try {
      const res = await eliminarCreatividadApi(cr.id)
      toast.success(
        res?.pendienteEnDoohmain
          ? `“${cr.nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel`
          : `“${cr.nombre}” se eliminó`,
      )
      setConfirmarEliminar(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
    setBusy(null)
  }

  // Reemplaza el arte de un creativo: abre el selector de imagen.
  function pedirReemplazo(cr: Creatividad) {
    setReemplazarId(cr.id)
    reemplazarRef.current?.click()
  }

  function onReemplazoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    const id = reemplazarId
    if (!f || !id) return
    if (f.size > IMAGEN_CREATIVO_MAX_MB * 1024 * 1024) {
      toast.error(`La imagen supera ${IMAGEN_CREATIVO_MAX_MB} MB`)
      return
    }
    setBusy(id)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string
        const res = await reemplazarCreatividadApi(id, {
          nombre: f.name,
          codigo: imagenAHtml(dataUrl, f.name),
          formato: 'text/html',
        })
        // v0.12.3 · el dueño vio en DOOHmain «las 3 imágenes»: el arte viejo
        // SIGUE en la lista de DOOHmain, porque su API no deja quitarlo; lo que
        // se hace es finalizar su campaña para que no se reproduzca. Se dice,
        // para que no parezca que se subió de más.
        toast.success(
          res?.doohmain?.estado === 'retirado'
            ? 'Arte reemplazado. En DOOHmain el anterior quedó finalizado (no se reproduce), pero sigue en la lista porque DOOHmain no deja quitarlo; bórralo a mano en su panel si quieres. Aprueba el nuevo para publicarlo.'
            : 'Arte reemplazado. Apruébalo de nuevo para publicarlo.',
          { duration: 10000 },
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo reemplazar')
      }
      setBusy(null)
      setReemplazarId(null)
    }
    reader.readAsDataURL(f)
  }

  // Guarda los creativos (con veces) de un spot.
  async function guardarCreativos(reserva: Reserva, creativos: { creatividadId: string; veces: number }[]) {
    setBusy(reserva.id)
    try {
      await asignarCreativosApi(reserva.id, creativos)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar')
    }
    setBusy(null)
  }

  // Spot DIGITAL (v0.12.3, pedido del dueño): se marca o se desmarca un creativo
  // y las veces se calculan solas —todos los marcados rotan en partes iguales,
  // `rotacionEnSpot`—. Antes había que escribir un número por creativo, y con
  // dos creativos en un spot de 1 la cuenta «2 de 1» salía en rojo.
  function alternarEnRotacion(reserva: Reserva, creatividadId: string) {
    const marcados = new Set(reserva.creativos.map((c) => c.creatividadId))
    if (marcados.has(creatividadId)) marcados.delete(creatividadId)
    else marcados.add(creatividadId)
    // El orden de los aprobados manda: así el reparto sale igual que el que hace
    // el servidor al aprobar, y se sigue reconociendo como automático.
    const ids = aprobados.map((cr) => cr.id).filter((id) => marcados.has(id))
    void guardarCreativos(reserva, rotacionEnSpot(ids, reserva.spotsPorDia ?? null))
  }

  // Spot FIJO: una sola imagen (o ninguna).
  function setUnico(reserva: Reserva, creatividadId: string) {
    void guardarCreativos(reserva, creatividadId ? [{ creatividadId, veces: 1 }] : [])
  }

  // PLEG-01 · cada campaña se pliega por separado y lo recuerda por su id. Los
  // `input` de archivo van en `accion`, que no se desmonta al plegar: el de
  // «Reemplazar» se dispara desde dentro del contenido. El alta por código
  // sobrevive al plegado porque su texto vive en el estado de este componente,
  // no en el contenido que se desmonta. Los diálogos quedan FUERA de la tarjeta.
  return (
    <>
    <CardColapsable
      id={`creativos.campana.${campana.id}`}
      titulo={campana.nombre}
      subtitulo={
        // Conteos de la campaña en chips (lenguaje del Dashboard), para ver lo
        // pendiente sin desplegar. `CardColapsable` no cambia: solo el nodo.
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="demo-num">{[campana.folio, campana.tipoCampana].filter(Boolean).join(' · ')}</span>
          {pendientesAqui > 0 && (
            <span className="rounded-full border border-transparent bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-[#9a6700]">
              {pendientesAqui} por aprobar
            </span>
          )}
          {reservas.length > 0 && (
            <span className="demo-num rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              {reservas.length - spotsSinAqui}/{reservas.length} spots con creativo
            </span>
          )}
        </span>
      }
      contentClassName="space-y-4"
      accion={
        puede ? (
          <div className="flex shrink-0 gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <input ref={reemplazarRef} type="file" accept="image/*" className="hidden" onChange={onReemplazoFile} />
            <Button variant="success" size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Imagen
            </Button>
            <Button size="sm" variant="secondary" disabled={subiendo} onClick={() => setCodeOpen((v) => !v)}>
              <Code2 className="h-3.5 w-3.5" /> Código
            </Button>
          </div>
        ) : undefined
      }
    >

      {/* Alta por código (HTML/UTF) */}
      {puede && codeOpen && (
        <div className="space-y-2 rounded-md border border-border bg-surface-2 p-2.5">
          <Campo label="Nombre del creativo">
            <input
              value={codeNombre}
              onChange={(e) => setCodeNombre(e.target.value)}
              className="h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </Campo>
          <Campo label="Código" obligatorio falta={ob.falta('codigo')}>
            <textarea
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Pega aquí el código del creativo (HTML/UTF)…"
              rows={5}
              className="w-full rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </Campo>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCodeOpen(false)
                ob.reiniciar()
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" disabled={subiendo} onClick={guardarCodigo}>
              {subiendo ? 'Guardando…' : 'Guardar código'}
            </Button>
          </div>
        </div>
      )}

      {/* Creativos */}
      <div>
        <div className="mb-2 text-[12px] font-medium text-muted">Creativos ({creativos.length})</div>
        {creativos.length === 0 ? (
          <p className="text-[12px] text-muted">Sin creativos. Sube una imagen para aprobarla.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {creativos.map((cr) => (
              <div
                key={cr.id}
                className={`overflow-hidden rounded-md border border-border ${cr.retiradoEn ? 'opacity-60' : ''}`}
              >
                {/* `esImagen` MANDA sobre `esCreativoHtml`, y el orden de estas
                    ramas es lo que hace la pantalla usable: la mayoría de los
                    creativos son una imagen ENVUELTA en HTML, y montarlos como
                    documento son ~1 MB y un desenfoque de 28 px cada uno. Con
                    once en la rejilla el navegador se queda colgado —medido—.
                    El servidor ya extrae la imagen para esos, así que aquí basta
                    un <img>. El <iframe> queda para el HTML de verdad. */}
                {cr.esImagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cr.archivoUrl!} alt={cr.nombre} className="h-28 w-full object-cover" />
                ) : esCreativoHtml(cr) ? (
                  <iframe
                    title={cr.nombre}
                    src={cr.archivoUrl!}
                    sandbox=""
                    className="h-28 w-full border-0 bg-white"
                  />
                ) : cr.archivoUrl || imagenDeCodigo(cr.codigo) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cr.archivoUrl ?? imagenDeCodigo(cr.codigo)!} alt={cr.nombre} className="h-28 w-full object-cover" />
                ) : cr.codigo ? (
                  <iframe
                    title={cr.nombre}
                    srcDoc={cr.codigo}
                    sandbox=""
                    className="h-28 w-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-surface-2 text-muted">
                    <Images className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-1.5 p-2">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12px] text-ink" title={cr.nombre}>{cr.nombre}</div>
                    {/* Por `formato` y no por `cr.codigo`: la fuente ya no
                        viaja en el payload, así que mirar `codigo` haría
                        desaparecer la etiqueta de TODOS los creativos de
                        código. */}
                    {esCreativoHtml(cr) && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1 text-[10px] text-muted">
                        <Code2 className="h-2.5 w-2.5" /> código
                      </span>
                    )}
                  </div>
                  {cr.retiradoEn ? (
                    <div
                      className="inline-flex items-center gap-1 rounded-full border border-transparent bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-[#9a6700]"
                      title="Retirado del sistema; su arte sigue en DOOHmain (quítalo en su panel)"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> Retirado · pendiente en DOOHmain
                    </div>
                  ) : (
                    <EstadoCrea estatus={cr.estatusValidacion} motivo={cr.rechazadoMotivo} />
                  )}
                  {/* Por `formato`, no por el contenido: la fuente ya no viaja
                      en el payload, así que preguntar por ella aquí escondería
                      el botón en todos los creativos de código. */}
                  {/* «Ver HTML» como enlace pequeño, junto a la etiqueta
                      «código» de arriba: no compite con las acciones. */}
                  {esCreativoHtml(cr) && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 bg-transparent text-[11px] font-medium text-info hover:underline"
                      onClick={() => setVerFuente(cr)}
                    >
                      <Eye className="h-3 w-3" /> Ver HTML
                    </button>
                  )}
                  {/* UNA fila de acciones (antes, cuatro botones en dos filas
                      bajo una miniatura de 112 px). Mismos handlers, mismo
                      `disabled` y mismo permiso; Reemplazar y Eliminar pasan a
                      iconos con su nombre en `aria-label` y `title`. */}
                  {puede && !cr.retiradoEn && (
                    <div className="flex flex-wrap items-center gap-1">
                      {/* Aprobar es definitivo: una vez aprobado, el botón queda
                          deshabilitado hasta que se reemplace o elimine el creativo
                          (al reemplazar vuelve a PENDIENTE). Se queda VISIBLE con su
                          explicación en `title`: el rediseño del 26/10 lo había
                          escondido y con él se perdía el porqué (lo cazó la
                          validación). */}
                      <Button
                        size="sm"
                        variant={cr.estatusValidacion === 'VALIDADA' ? 'secondary' : 'primary'}
                        className="px-2"
                        disabled={busy === cr.id || cr.estatusValidacion === 'VALIDADA'}
                        title={cr.estatusValidacion === 'VALIDADA' ? 'El creativo ya fue aprobado — reemplázalo o elimínalo para cambiarlo' : undefined}
                        onClick={() => validar(cr.id, true)}
                      >
                        <Check className="h-3 w-3" /> Aprobar
                      </Button>
                      {/* Rechazar: se quita cuando el creativo ya fue aprobado. */}
                      {cr.estatusValidacion !== 'VALIDADA' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-error hover:bg-error-soft"
                          disabled={busy === cr.id}
                          onClick={() => validar(cr.id, false)}
                        >
                          <X className="h-3 w-3" /> Rechazar
                        </Button>
                      )}
                      <span className="ml-auto inline-flex items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-1.5"
                          aria-label={`Reemplazar el arte de ${cr.nombre}`}
                          title="Reemplazar el arte"
                          disabled={busy === cr.id}
                          onClick={() => pedirReemplazo(cr)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-1.5 text-error hover:bg-error-soft"
                          aria-label={`Eliminar ${cr.nombre}`}
                          title="Eliminar"
                          disabled={busy === cr.id}
                          onClick={() => setConfirmarEliminar(cr)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spots reservados */}
      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[12px] font-medium text-muted">Slots reservados ({reservas.length})</div>
          {/* El botón de reparto masivo se quitó el 2026-09-30 a pedido del
              dueño. La ruta de reparto y su repo siguen; para volver, revertir
              ese commit. */}
        </div>
        {reservas.length === 0 ? (
          <p className="text-[12px] text-muted">Sin slots reservados todavía.</p>
        ) : (
          // Lista `divide-y` en vez de una caja con borde por spot (bordes
          // anidados dentro de la tarjeta), y lo que falta —«Sin creativo»— en
          // una pastilla a la derecha, no en gris pequeño.
          <ul className="m-0 list-none divide-y divide-border p-0">
            {reservas.map((r) => {
              const sitio = sitios.find((s) => s.id === r.sitioId)
              const digital = r.spotsReservados != null
              const unico = aprobados.find((cr) => cr.id === r.creativos[0]?.creatividadId)
              return (
                <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-medium text-ink">{sitio?.nombre ?? 'Sitio'}</div>
                    {digital && (
                      r.creativos.length === 0 ? (
                        <span className="shrink-0 rounded-full border border-transparent bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-[#9a6700]">
                          Sin creativo
                        </span>
                      ) : (
                        <span className="demo-num shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                          {r.creativos.length === 1 ? '1 creativo' : `${r.creativos.length} creativos rotan`}
                        </span>
                      )
                    )}
                  </div>

                  {aprobados.length === 0 ? (
                    <p className="mt-1 text-[11px] text-muted">Aprueba un creativo para asignarlo aquí.</p>
                  ) : digital ? (
                    // Spot digital: se marcan los creativos que van; rotan solos.
                    <div className="mt-2 space-y-1.5">
                      {aprobados.map((cr) => {
                        const veces = r.creativos.find((x) => x.creatividadId === cr.id)?.veces ?? 0
                        return (
                          <label key={cr.id} className="flex cursor-pointer items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={veces > 0}
                                disabled={!puede || busy === r.id}
                                onChange={() => alternarEnRotacion(r, cr.id)}
                                className="h-4 w-4 shrink-0"
                              />
                              <Thumb cr={cr} className="h-7 w-7" />
                              <span className="truncate text-[12px] text-ink">{cr.nombre}</span>
                            </div>
                            {veces > 0 && r.spotsPorDia != null && (
                              <span className="demo-num shrink-0 text-[11px] text-muted">×{formatNumero(veces)}</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    // Spot fijo: una sola imagen.
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Thumb cr={unico} className="h-8 w-8" />
                        <span className="text-[12px] text-muted">Creativo del sitio</span>
                      </div>
                      {puede && (
                        <select
                          value={r.creativos[0]?.creatividadId ?? ''}
                          disabled={busy === r.id}
                          onChange={(e) => setUnico(r, e.target.value)}
                          className="h-8 max-w-[180px] rounded border border-border-strong bg-surface px-2 text-[12px] text-ink"
                        >
                          <option value="">Sin asignar</option>
                          {aprobados.map((cr) => (
                            <option key={cr.id} value={cr.id}>{cr.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {aprobados.length === 0 && reservas.length > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            Aprueba al menos un creativo para poder asignarlo a los slots.
          </p>
        )}
      </div>
    </CardColapsable>

      {/* Fuente HTML del creativo. Se pinta como texto ({fuente} en un <pre>, que
          React escapa), nunca como HTML: los creativos pueden venir de clientes
          externos y ejecutarlos en nuestro origen sería un XSS. */}
      <Modal
        open={verFuente !== null}
        onOpenChange={(v) => !v && setVerFuente(null)}
        title={verFuente?.nombre ?? 'Creativo'}
        subtitle={
          verFuente
            ? cargandoFuente
              ? `${verFuente.formato ?? 'HTML'} · cargando…`
              : `${verFuente.formato ?? 'HTML'} · ${(fuente ?? '').length.toLocaleString('es-MX')} caracteres`
            : undefined
        }
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!fuente}
              onClick={() => {
                if (fuente && verFuente) descargarHtml(verFuente.nombre, fuente)
              }}
            >
              <Download className="h-3.5 w-3.5" /> Descargar .html
            </Button>
            <Button size="sm" onClick={() => setVerFuente(null)}>Cerrar</Button>
          </div>
        }
      >
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-ink">
          {cargandoFuente
            ? 'Cargando la fuente…'
            : fuente ?? 'No se pudo cargar la fuente de este creativo.'}
        </pre>
      </Modal>

      <ConfirmDialog
        open={confirmarEliminar !== null}
        onOpenChange={(v) => !v && setConfirmarEliminar(null)}
        title="Eliminar creativo"
        confirmLabel="Sí, eliminar"
        busy={busy !== null && busy === confirmarEliminar?.id}
        onConfirm={confirmarEliminarDo}
      >
        ¿Seguro que quieres bajar{' '}
        <span className="font-medium text-ink">“{confirmarEliminar?.nombre}”</span>? Si ya está
        publicado, su campaña se finaliza, pero <span className="text-ink">el arte no se puede
        quitar de DOOHmain</span> (su API no lo permite): quedará marcado como “pendiente en DOOHmain”
        para que lo quites en su panel.
      </ConfirmDialog>
    </>
  )
}

// Miniatura de un creativo: imagen si la hay, icono de código si es código,
// o placeholder si no hay nada asignado.
function Thumb({ cr, className }: { cr?: Creatividad; className: string }) {
  // Igual que en la rejilla, y aquí importa MÁS: esta miniatura se repite por
  // cada creativo Y por cada pantalla en la asignación de slots, así que un
  // <iframe> de 1 MB por pieza se multiplica rápido.
  if (cr?.esImagen && cr.archivoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cr.archivoUrl} alt="" className={`${className} shrink-0 rounded border border-border object-cover`} />
  }
  if (esCreativoHtml(cr)) {
    return (
      <iframe
        title={cr?.nombre ?? 'creativo'}
        src={cr!.archivoUrl!}
        sandbox=""
        className={`${className} shrink-0 rounded border border-border bg-white`}
      />
    )
  }
  const img = cr?.archivoUrl ?? imagenDeCodigo(cr?.codigo)
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" className={`${className} shrink-0 rounded border border-border object-cover`} />
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-muted`}
    >
      {cr?.codigo ? <Code2 className="h-4 w-4" /> : <Images className="h-4 w-4" />}
    </span>
  )
}

// El estado en el mismo chip (`StatusBadge` con `CREATIVIDAD_TONO`) que usa el
// detalle de la campaña: antes aquí era texto con icono y allá un chip, lo mismo
// dicho de dos formas. Se conservan las palabras de esta pantalla («Aprobado»),
// que son las de sus botones. El motivo de un rechazo va en su propia línea, a
// la vista, y no escondido en un `title`.
function EstadoCrea({ estatus, motivo }: { estatus: EstValidacionCreatividad; motivo: string | null }) {
  const label: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    VALIDADA: 'Aprobado',
    RECHAZADA: 'Rechazado',
  }
  const tono = CREATIVIDAD_TONO[estatus] ?? CREATIVIDAD_TONO.PENDIENTE
  return (
    <div className="space-y-1">
      <StatusBadge tono={tono}>{label[estatus] ?? label.PENDIENTE}</StatusBadge>
      {estatus === 'RECHAZADA' && motivo && <p className="m-0 text-[11px] text-error">{motivo}</p>}
    </div>
  )
}
