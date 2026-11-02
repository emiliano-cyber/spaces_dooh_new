'use client'

import { toast } from 'sonner'
import { pctConDosDecimales } from '@/lib/descuento-comercial'
import { conteo } from '@/lib/plural'
import { useIdioma, useTexto } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { resumenContratacion, etiquetaFrecuencia } from '@/lib/periodos'
import { etiquetaCalculadora } from '@/lib/calculadora-spots'
import { AvisoFranjaCMS } from '@/components/demo/rejilla/AvisoFranjaCMS'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KPICard } from '@/components/demo/KPICard'
import { EST, CLAVE_ESTATUS } from '@/components/demo/propuestas/estatus'
import { cn } from '@/lib/cn'
import {
  ArrowLeft,
  Wallet,
  Coins,
  MapPin,
  Monitor,
  Square,
  Building2,
  CheckCircle2,
  Send,
  Check,
  X,
  ChevronRight,
  CalendarDays,
  Link2,
  FileDown,
  Check as CheckIcon,
  Trash2,
  Copy,
  Plus,
} from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Breadcrumbs, type Crumb } from '@/components/demo/ui/Breadcrumbs'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { pinTono } from '@/components/demo/StatusBadge'
import { trailFromLocation } from '@/lib/nav-trail'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  cambiarEstatusPropuestaApi,
  borrarPropuestaApi,
  quitarSitioPropuestaApi,
  aprobarItemPropuestaApi,
  generarCampanaDesdePropuestaApi,
  actualizarPropuestaApi,
  refrescarEstado,
  ConfirmacionCeroError,
} from '@/lib/data/estado-api'
import { BloqueCodigoPropuesta } from '@/components/demo/codigos/BloqueCodigoPropuesta'
import { ElegirClienteDialog } from '@/components/demo/propuestas/ElegirClienteDialog'
import { BloqueCondicionesVigencia } from '@/components/demo/propuestas/BloqueCondicionesVigencia'
import { EnviarPropuestaDialog } from '@/components/demo/propuestas/EnviarPropuestaDialog'
import {
  paquetesApi,
  aplicarPaqueteApi,
  quitarPaqueteApi,
  type PaqueteUI,
} from '@/lib/data/paquetes-api'
import {
  usePropuestas,
  useClientes,
  useCampanas,
  useSitios,
  useContratos,
  useArrendadores,
  useConfigNegocio,
  formatMonto,
  formatFecha,
  type EstPropuesta,
} from '@/lib/data/client'

// Una coordenada sirve para el mapa si es finita y no es el (0,0) que usa
// sitios-repo como relleno cuando el sitio no tiene ubicación capturada.
function coordUtil(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
}

// La tabla de estatus (etiqueta y tono del chip) vive en
// `components/demo/propuestas/estatus.ts`, compartida con la lista.

export default function PropuestaDetallePage({ params }: { params: { id: string } }) {
  const id = params.id
  const { t, idioma } = useIdioma()
  // Los conteos («2 sitios») con las palabras del idioma vigente. `conteo()`
  // pone la cifra y elige singular o plural; el espanol sale identico.
  const nSitios = (n: number) => conteo(n, t('propuestas.unidad.sitio'), t('propuestas.unidad.sitios'))
  const propuestas = usePropuestas()
  const clientes = useClientes()
  // Solo para pintar el paso «Campaña generada» de la barra de estado. No
  // cambia qué botones se ofrecen (eso es el defecto D, decisión del dueño).
  const campanas = useCampanas()
  const sitios = useSitios()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const config = useConfigNegocio()
  // TOPE-01 · el techo que autoriza la organización. Mientras el estado no ha
  // hidratado se usa 100, que es el valor con el que nace toda organización: el
  // formulario NO puede empezar más restrictivo de lo que manda el servidor, o
  // bloquearía descuentos legítimos durante el primer segundo de la pantalla.
  // Quien decide de verdad es el servidor (`descuentoDentroDelTope`); esto solo
  // adelanta el aviso.
  const topeDescuento = config?.topeDescuentoPct ?? 100
  const puedeEditar = usePuede('comercial', 'crear')
  const veRentas = usePuede('arrendadores', 'ver')
  const router = useRouter()
  const [generando, setGenerando] = useState(false)
  const [elegirCliente, setElegirCliente] = useState(false)
  const [enviarAbierto, setEnviarAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [descInput, setDescInput] = useState('0.00')
  const [guardandoDesc, setGuardandoDesc] = useState(false)
  // PAQ-01 (ADR 0039, Fase 4) · el paquete que se está por aplicar. Solo el ID
  // viaja al servidor: el precio sale del catálogo bajo RLS y NUNCA del
  // navegador. Ver la cabecera de `app/api/propuestas/[id]/paquete/route.ts`.
  const [paqSel, setPaqSel] = useState('')
  const [guardandoPaq, setGuardandoPaq] = useState(false)
  const [catalogoPaq, setCatalogoPaq] = useState<PaqueteUI[]>([])

  const pActual = propuestas?.find((x) => x.id === id)
  // Sincroniza el input de descuento con el valor actual al cargar/cambiar.
  useEffect(() => {
    if (pActual) setDescInput(pctConDosDecimales(pActual.descuentoPct))
  }, [pActual?.id, pActual?.descuentoPct])

  // PAQ-01 · el catálogo de paquetes, para el selector. Se lee UNA vez y con el
  // fallo TRAGADO a propósito: un rol COMERCIAL puede no tener `inventario.ver`,
  // y en ese caso la lista sale vacía y el bloque no se pinta. Reventar aquí
  // dejaría la propuesta entera sin abrir por un catálogo que quizá no se use.
  useEffect(() => {
    let vivo = true
    void paquetesApi()
      .then((ps) => { if (vivo) setCatalogoPaq(ps.filter((x) => x.activo)) })
      .catch(() => { if (vivo) setCatalogoPaq([]) })
    return () => { vivo = false }
  }, [])

  async function aplicarDescuento() {
    const d = Number(descInput)
    if (descInput.trim() === '' || isNaN(d) || d < 0) {
      toast.error(t('propuestas.ficha.descuento.invalido'))
      return
    }
    // TOPE-01 · el mensaje DICE EL TOPE, no «valor inválido». Quien vende tiene
    // que saber qué número sí puede teclear sin preguntarle a nadie. El servidor
    // lo rechaza igualmente (`descuentoDentroDelTope`): esto solo evita el viaje.
    if (d > topeDescuento) {
      toast.error(t('propuestas.ficha.descuento.tope', { tope: topeDescuento }))
      return
    }
    setGuardandoDesc(true)
    try {
      await actualizarPropuestaApi(id, { descuentoPct: d })
      toast.success(t('propuestas.ficha.descuento.actualizado'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    } finally {
      setGuardandoDesc(false)
    }
  }

  /**
   * PAQ-01 · aplica un paquete cerrado. **Aquí no se manda ningún precio.**
   *
   * Lo único que viaja es el ID. El precio, el nombre y la bandera de si admite
   * códigos salen de `paquetes` bajo RLS. Si el precio saliera de aquí, cerrar
   * cinco pantallas en un peso sería editar un JSON en las herramientas del
   * navegador — y la propuesta quedaría coherente consigo misma, sin ningún
   * error que lo delatara.
   *
   * Tampoco se valida nada: que el paquete esté activo, que sea de esta
   * organización, que la propuesta no esté aprobada y que sus pantallas sean
   * exactamente las del paquete lo comprueba el servidor dentro de la
   * transacción. El mensaje se enseña TAL CUAL porque distingue los cinco
   * motivos, y cada uno se arregla de forma distinta.
   */
  async function aplicarPaquete() {
    if (!paqSel) {
      toast.error(t('propuestas.ficha.paquete.elige'))
      return
    }
    setGuardandoPaq(true)
    try {
      const r = await aplicarPaqueteApi(id, paqSel)
      toast.success(t('propuestas.ficha.paquete.aplicado', { nombre: r.nombre, precio: formatMonto(r.precio) }))
      setPaqSel('')
      await refrescarEstado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    } finally {
      setGuardandoPaq(false)
    }
  }

  /** Quita el paquete y devuelve la propuesta a los precios de línea. */
  async function quitarPaquete() {
    setGuardandoPaq(true)
    try {
      await quitarPaqueteApi(id)
      toast.success(t('propuestas.ficha.paquete.quitado'))
      await refrescarEstado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    } finally {
      setGuardandoPaq(false)
    }
  }

  async function copiar(texto: string, marcar: (v: boolean) => void, mensaje = t('propuestas.ficha.copiado')) {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success(mensaje)
    } catch {
      window.prompt(t('propuestas.ficha.copia-esto'), texto)
    }
    marcar(true)
    setTimeout(() => marcar(false), 2200)
  }

  // Copia la liga pública (solo lectura) con el token aleatorio (S1-3): solo
  // quien tenga este link exacto puede abrir/aceptar la propuesta.
  function copiarLiga() {
    if (!p?.tokenPublico) {
      toast.error(t('propuestas.ficha.sin-liga'))
      return
    }
    void copiar(`${window.location.origin}/spaces-dooh/p/${p.tokenPublico}`, setCopiado, t('propuestas.ficha.liga-copiada'))
  }

  // PROP-COMPLETA (29/10) · «Generar PDF» abre el documento imprimible en otra
  // pestaña (`app/(app)/propuesta/[id]`): la vista del CLIENTE con membrete,
  // fotos, mapa, QR y condiciones, lista para «Imprimir → Guardar como PDF».
  // Hasta hoy el botón no hacía nada.
  function generarPdf() {
    window.open(`${window.location.origin}/spaces-dooh/propuesta/${id}/`, '_blank', 'noopener')
  }

  // Rastro de navegación (cómo llegué); por defecto, Propuestas.
  const [trail, setTrail] = useState<Crumb[]>([])
  useEffect(() => {
    const rastro = trailFromLocation()
    setTrail(rastro.length ? rastro : [{ label: t('propuestas.lista.titulo'), href: '/propuestas' }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: t('propuestas.lista.titulo'), href: '/propuestas' }

  if (!propuestas) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }
  const p = propuestas.find((x) => x.id === id)
  if (!p) {
    return (
      <div className="w-full">
        <p className="text-[13px] text-muted">{t('propuestas.ficha.no-encontrada')}</p>
        <Link href="/propuestas" className="mt-2 inline-flex items-center gap-1 text-[13px] text-info">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('propuestas.ficha.volver')}
        </Link>
      </div>
    )
  }

  const cliente = clientes?.find((c) => c.id === p.clienteId)
  const agencia = clientes?.find((c) => c.id === p.agenciaId)
  const est = EST[p.estatus]
  // El rotulo del chip en el idioma vigente; en minusculas cuando va dentro de
  // una frase («La propuesta ya está aprobada»), igual que hacia `est.label`.
  const etiquetaEst = t(CLAVE_ESTATUS[p.estatus])
  const ivaPct = p.base ? Math.round((p.iva / p.base) * 100) : 16
  const comisionPct = Math.round(100 - p.divisor * 100)
  const editable = p.estatus !== 'APROBADA' && p.estatus !== 'RECHAZADA'
  // PROP-COMPLETA · las pantallas se agregan o quitan en BORRADOR y ENVIADA.
  const sitiosEditables = p.estatus === 'BORRADOR' || p.estatus === 'ENVIADA'

  // Fechas de la propuesta (min/max de los items).
  const fechas = p.items.map((i) => i.fechaInicio).filter(Boolean).sort()
  const fines = p.items.map((i) => i.fechaFin).filter(Boolean).sort()
  const desde = fechas[0]
  const hasta = fines.at(-1)

  // Info de renta por sitio: contrato vigente del sitio → arrendador + monto.
  // Un contrato INCOMPLETO (ADR 0001) no tiene importe todavía: se trata igual
  // que "sin contrato" para el costo de la propuesta, porque suponerle un monto
  // falsearía el margen tanto como ignorarlo.
  const rentaDe = (sitioId: string) => {
    const con = (contratos ?? []).find((c) => c.sitioId === sitioId)
    if (!con || con.montoRenta == null) return null
    const arr = (arrendadores ?? []).find((a) => a.id === con.arrendadorId)
    return { monto: con.montoRenta, periodicidad: con.periodicidad ?? '—', propietario: arr?.nombre ?? '—' }
  }
  const rentaTotal = p.items.reduce((s, it) => s + (rentaDe(it.sitioId)?.monto ?? 0), 0)
  // Cuántas pantallas no tienen renta capturada: las mismas filas que la tabla
  // de «Sitios y renta» pinta como «Sin contrato de renta».
  const sinContratoRenta = p.items.filter((it) => rentaDe(it.sitioId) === null).length

  // Puntos del mapa: ubicación de cada pantalla de la propuesta.
  // Los sitios sin coordenadas llegan como (0,0) desde sitios-repo (`n(r.lat) ?? 0`),
  // no como null. Sin este filtro MapLibre planta un pin en el golfo de Guinea y
  // el encuadre automático se va con él, dejando el mapa "vacío" sobre el océano.
  const puntos: MapPoint[] = p.items.flatMap((it) => {
    const s = sitios?.find((x) => x.id === it.sitioId)
    if (!s || !coordUtil(s.lat, s.lng)) return []
    return [{ id: s.id, lat: s.lat, lng: s.lng, tono: pinTono(s), label: s.nombre }]
  })
  const sinCoords = p.items.length - puntos.length

  async function cambiar(estatus: EstPropuesta, confirmarCero = false) {
    try {
      await cambiarEstatusPropuestaApi(id, estatus, confirmarCero)
    } catch (e) {
      if (e instanceof ConfirmacionCeroError) {
        if (window.confirm(`${e.message}\n\n${t('propuestas.comun.aprobar-igual')}`)) return cambiar(estatus, true)
        return
      }
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    }
  }
  // PROP-COMPLETA · borrar un BORRADOR (decisión del dueño). Se confirma porque
  // no tiene vuelta atrás; el servidor rechaza cualquier otro estatus.
  async function borrar() {
    if (!window.confirm(t('propuestas.ficha.borrar.confirmar', { nombre: p!.nombre }))) return
    try {
      await borrarPropuestaApi(id)
      toast.success(t('propuestas.ficha.borrar.hecho'))
      router.push('/propuestas')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    }
  }
  // PROP-COMPLETA · quitar un sitio (BORRADOR o ENVIADA; nunca el último). En
  // una enviada sube la versión, y se dice antes de hacerlo.
  async function quitarSitio(itemId: string, nombreSitio: string) {
    const aviso = p!.estatus === 'ENVIADA' ? t('propuestas.ficha.quitar-sitio.aviso') : ''
    if (!window.confirm(t('propuestas.ficha.quitar-sitio.confirmar', { sitio: nombreSitio, aviso }))) return
    try {
      await quitarSitioPropuestaApi(itemId)
      toast.success(t('propuestas.ficha.quitar-sitio.hecho'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('propuestas.comun.error'))
    }
  }
  async function aprobar(itemId: string, aprobado: boolean) {
    try { await aprobarItemPropuestaApi(itemId, aprobado) } catch (e) { toast.error(e instanceof Error ? e.message : t('propuestas.comun.error')) }
  }
  // Sin cliente no se genera: primero se elige (ElegirClienteDialog).
  async function generarCampana(clienteId?: string) {
    if (!p!.clienteId && !clienteId) {
      setElegirCliente(true)
      return
    }
    setGenerando(true)
    try {
      const camp = await generarCampanaDesdePropuestaApi(id, clienteId)
      setElegirCliente(false)
      if (camp?.id) router.push(`/campanas/${camp.id}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : t('propuestas.comun.error')) }
    setGenerando(false)
  }

  return (
    <div className="w-full space-y-4">
      {/* Migas. Cuando el rastro es solo «Propuestas», las migas repetían el
          enlace de volver («← Propuestas · Propuestas › …»): con un solo paso
          basta el enlace. */}
      <div className="flex flex-wrap items-center gap-2">
        {volver.href && (
          <Link href={volver.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> {volver.label}
          </Link>
        )}
        {trail.length > 1 && (
          <>
            <span className="text-muted">·</span>
            <Breadcrumbs items={[...trail, { label: p.nombre }]} />
          </>
        )}
      </div>

      {/* Encabezado: nombre de la campaña/propuesta + estatus + acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl text-ink">{p.nombre}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${est.cls}`}>{etiquetaEst}</span>
            {p.version > 1 && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted" title={t('propuestas.ficha.version.titulo')}>
                v{p.version}
              </span>
            )}
            {/* PROP-COMPLETA · la vigencia solo importa mientras el cliente
                puede aceptar: en una aprobada o rechazada sería ruido. */}
            {p.vigenteHasta && (p.estatus === 'ENVIADA' || p.estatus === 'BORRADOR') && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  p.vencida ? 'border-[#ef444440] text-error' : 'border-border text-muted',
                )}
              >
                {p.vencida
                  ? t('propuestas.ficha.vencida', { fecha: formatFecha(p.vigenteHasta, idioma) })
                  : t('propuestas.ficha.valida-hasta', { fecha: formatFecha(p.vigenteHasta, idioma) })}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {t('propuestas.ficha.folio')} <span className="demo-num font-medium text-ink">{p.folio}</span>
            <span className="ml-1 text-muted">{t('propuestas.ficha.folio.nota')}</span>
          </p>
          <PasosEstatus estatus={p.estatus} conCampana={!!campanas?.some((c) => c.propuestaId === p.id)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Compartir + PDF (visibles siempre) */}
          <Button size="sm" variant="secondary" onClick={copiarLiga}>
            {copiado ? (
              <><CheckIcon className="h-3.5 w-3.5 text-success" /> {t('propuestas.ficha.copiado-boton')}</>
            ) : (
              <><Link2 className="h-3.5 w-3.5" /> {t('propuestas.ficha.copiar-liga')}</>
            )}
          </Button>
          {/* PROP-COMPLETA · duplicar abre el formulario de alta precargado
              (mismos sitios y contratación, tarifa de hoy, sin cupón). */}
          {puedeEditar && (
            <Button size="sm" variant="secondary" onClick={() => router.push(`/propuestas?duplicar=${p.id}`)}>
              <Copy className="h-3.5 w-3.5" /> {t('propuestas.ficha.duplicar')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={generarPdf}>
            <FileDown className="h-3.5 w-3.5" /> {t('propuestas.ficha.generar-pdf')}
          </Button>

          {/* Acciones de estatus (solo edición) */}
          {/* PROP-COMPLETA · «Enviar» manda la liga por correo (y la deja
              ENVIADA); en una ya enviada es «Reenviar» (decisión del dueño). */}
          {puedeEditar && (p.estatus === 'BORRADOR' || p.estatus === 'ENVIADA') && (
            <Button size="sm" variant={p.estatus === 'BORRADOR' ? 'primary' : 'secondary'} onClick={() => setEnviarAbierto(true)}>
              <Send className="h-3.5 w-3.5" />{' '}
              {p.estatus === 'BORRADOR' ? t('propuestas.comun.enviar') : t('propuestas.comun.reenviar')}
            </Button>
          )}
          {puedeEditar && (p.estatus === 'ENVIADA' || p.estatus === 'BORRADOR') && (
            <>
              <Button size="sm" onClick={() => cambiar('APROBADA')}><Check className="h-3.5 w-3.5" /> {t('propuestas.comun.aprobar')}</Button>
              <Button size="sm" variant="danger" onClick={() => cambiar('RECHAZADA')}><X className="h-3.5 w-3.5" /> {t('propuestas.comun.rechazar')}</Button>
            </>
          )}
          {puedeEditar && p.estatus === 'BORRADOR' && (
            <Button size="sm" variant="ghost" onClick={borrar} title={t('propuestas.ficha.borrar.titulo')}>
              <Trash2 className="h-3.5 w-3.5" /> {t('propuestas.ficha.borrar')}
            </Button>
          )}
          {puedeEditar && p.estatus === 'APROBADA' && (
            <Button size="sm" disabled={generando} onClick={() => void generarCampana()}>
              <ChevronRight className="h-3.5 w-3.5" />{' '}
              {generando ? t('propuestas.comun.generando') : t('propuestas.comun.generar-campana')}
            </Button>
          )}
        </div>
      </div>

      <EnviarPropuestaDialog
        open={enviarAbierto}
        onOpenChange={setEnviarAbierto}
        propuestaId={p.id}
        correoCliente={cliente?.contacto?.email ?? null}
        reenvio={p.estatus === 'ENVIADA'}
        onSinCorreo={copiarLiga}
      />

      <ElegirClienteDialog
        open={elegirCliente}
        onOpenChange={setElegirCliente}
        clientes={clientes}
        onElegir={(clienteId) => generarCampana(clienteId)}
      />

      {/* Barra de metadatos (fechas / anunciante / agencia / comisión) */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <Meta icon={<CalendarDays className="h-4 w-4" />} label={t('propuestas.ficha.meta.fechas')}
            value={desde && hasta ? `${formatFecha(desde, idioma)} – ${formatFecha(hasta, idioma)}` : '—'} />
          <Meta label={t('propuestas.ficha.meta.anunciante')} value={cliente?.nombre ?? t('propuestas.comun.sin-cliente')} />
          <Meta label={t('propuestas.comun.agencia')} value={agencia?.nombre ?? t('propuestas.ficha.meta.directa')} />
          <Meta label={t('propuestas.ficha.meta.comision')} value={`${comisionPct}%`} />
        </div>
      </Card>

      {/* Resumen económico (KPIs). PLEG-02 · el descuento tecleado vive en
          esta página y sobrevive a plegar; lo que se esté escribiendo en el
          bloque del código de negociación, no (es estado de ese componente). */}
      <CardColapsable id="propuesta.resumen-economico" titulo={t('propuestas.ficha.resumen')}>
          {/* KPIs con la `KPICard` del Dashboard (26/10). Mismas cifras que ya
              estaban en la página: el total y el neto de la propuesta, la renta
              de referencia que enseñaba «Sitios y renta» en su encabezado, y lo
              aprobado de «Sobre lo aprobado». El IVA sigue en la escalera.
              NO hay tarjeta de margen a propósito: la renta es la del contrato
              en su propia periodicidad, sin prorratear a las fechas de la
              propuesta, y restarla del neto daría una cifra nueva y engañosa. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              label={t('propuestas.ficha.kpi.total')}
              value={formatMonto(p.total)}
              sub={t('propuestas.ficha.kpi.total.sub', { sitios: nSitios(p.items.length) })}
              tono="azul"
              icon={<Wallet className="h-4 w-4" />}
            />
            <KPICard
              label={t('propuestas.ficha.kpi.neto')}
              value={formatMonto(p.neto)}
              sub={
                comisionPct > 0
                  ? t('propuestas.ficha.kpi.neto.sub', { pct: comisionPct })
                  : t('propuestas.ficha.kpi.neto.directa')
              }
              icon={<Coins className="h-4 w-4" />}
            />
            {/* Sin `arrendadores:ver` los contratos llegan vacíos de
                `/api/estado`: decirle a un vendedor «ninguna pantalla tiene renta
                capturada» sería afirmar algo falso (lo cazó la validación del
                26/10 con la propuesta PR-2026-0007, que sí tiene renta). */}
            <KPICard
              label={t('propuestas.ficha.kpi.renta')}
              value={!veRentas || sinContratoRenta === p.items.length ? '—' : formatMonto(rentaTotal)}
              sub={
                !veRentas
                  ? t('propuestas.ficha.kpi.renta.sin-permiso')
                  : sinContratoRenta === p.items.length
                  ? t('propuestas.ficha.kpi.renta.ninguna')
                  : t('propuestas.ficha.kpi.renta.suma', {
                      sin: sinContratoRenta ? t('propuestas.ficha.kpi.renta.sin-contrato', { n: sinContratoRenta }) : '',
                    })
              }
              icon={<Building2 className="h-4 w-4" />}
            />
            <KPICard
              label={t('propuestas.ficha.kpi.aprobado')}
              value={p.itemsAprobados === 0 ? '—' : formatMonto(p.totalAprobado)}
              sub={
                p.itemsAprobados === 0
                  ? t('propuestas.ficha.kpi.aprobado.ninguno', { n: p.items.length })
                  : t('propuestas.ficha.kpi.aprobado.sub', { aprobados: p.itemsAprobados, sitios: nSitios(p.items.length) })
              }
              tono={p.itemsAprobados === 0 ? 'neutro' : 'verde'}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>

          {/* Desglose con descuento comercial + editor */}
          {/* Desde el 26/10 esta es la ÚNICA escalera de bruto a total de la
              página: la de «Costo · método del divisor» repetía la cuenta, y
              además sin el descuento comercial, así que se leían dos versiones
              distintas de lo mismo. Esta es la completa. */}
          <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
            <div className="space-y-3">
            <dl className="space-y-1.5 text-[13px]">
              <Fila label={t('propuestas.comun.bruto-lista')} valor={formatMonto(p.bruto)} />
              {/* PAQ-01 · EL PAQUETE VA PRIMERO Y NO ES UN DESCUENTO. Se pinta
                  como «precio del conjunto» y con el importe en positivo, no
                  como una resta: llamarlo descuento haría creer que el bruto de
                  arriba sigue mandando, y lo que pasa es que deja de mandar.
                  Sin este renglón la escalera no cuadra en pantalla, y una
                  cuenta que no da se lee como un defecto del sistema.
                  Iba en LOS DOS desgloses de esta página hasta el 26/10, cuando
                  quedó uno solo: el de «Resumen
                  económico» (ver la nota de «Costo · método del divisor»). */}
              {p.paquete && (
                <Fila
                  label={t('propuestas.comun.paquete-conjunto', { nombre: p.paquete.nombre })}
                  valor={formatMonto(p.paquete.precio)}
                />
              )}
              {/* VOL-01 · el renglón aparece SOLO cuando hay volumen, y tiene que
                  aparecer: sin él la escalera no cuadra en pantalla —bruto menos
                  descuento comercial no daría la base— y una cuenta que no da se
                  lee como un defecto del sistema. */}
              {p.descuentoVolumenMonto > 0 && (
                <Fila
                  label={t('propuestas.comun.descuento-volumen', { pct: Math.round(p.descuentoVolumenPct * 10) / 10 })}
                  valor={`− ${formatMonto(p.descuentoVolumenMonto)}`}
                  tono="text-error"
                />
              )}
              <Fila label={t('propuestas.ficha.descuento-comercial-pct', { pct: pctConDosDecimales(p.descuentoPct) })} valor={p.descuentoMonto ? `− ${formatMonto(p.descuentoMonto)}` : '—'} tono={p.descuentoMonto ? 'text-error' : undefined} />
              {/* COD-01 · el renglón aparece SOLO cuando hay código, y tiene que
                  aparecer con SU NOMBRE: un descuento sin decir de qué cupón salió
                  no se puede explicar seis meses después, y sin él la escalera no
                  cuadra en pantalla. */}
              {p.codigoDescuentoMonto > 0 && (
                <Fila
                  label={`${t('propuestas.comun.codigo-pct', { codigo: p.codigoTexto ?? '', pct: p.codigoDescuentoPct })}${
                    // COD-03 · el total INTERNO cuenta el cupón aunque esté
                    // pendiente (es lo que se ofrece); el renglón avisa de que
                    // el cliente todavía no lo ve.
                    p.codigoEstado === 'PENDIENTE' ? t('propuestas.ficha.codigo-pendiente') : ''
                  }`}
                  valor={`− ${formatMonto(p.codigoDescuentoMonto)}`}
                  tono="text-error"
                />
              )}
              <Fila label={t('propuestas.ficha.base')} valor={formatMonto(p.base)} />
              <Fila label={t('propuestas.ficha.comision', { pct: comisionPct, divisor: p.divisor.toFixed(2) })} valor={`− ${formatMonto(p.base - p.neto)}`} />
              <Fila label={t('propuestas.ficha.neto')} valor={formatMonto(p.neto)} />
              <Fila label={t('propuestas.comun.iva', { pct: ivaPct })} valor={formatMonto(p.iva)} />
              <div className="border-t border-border pt-1.5">
                <Fila label={t('propuestas.ficha.total')} valor={formatMonto(p.total)} fuerte />
              </div>
            </dl>
            {/* «Sobre lo aprobado», que vivía en la tarjeta del método del
                divisor, como franja secundaria bajo la escalera. Mismas tres
                cifras; con nada aprobado se dice en vez de pintar tres ceros. */}
            <div className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="font-medium text-ink">
                  {t('propuestas.ficha.aprobado', { aprobados: p.itemsAprobados, sitios: nSitios(p.items.length) })}
                </span>
                {p.itemsAprobados === 0 ? (
                  <span className="text-muted">
                    {t('propuestas.ficha.ninguno-aprobado', {
                      marca: puedeEditar ? t('propuestas.ficha.ninguno-aprobado.marca') : '',
                    })}
                  </span>
                ) : (
                  <>
                    <span className="text-muted">
                      {interpolarNodos(t('propuestas.ficha.aprobado.bruto'), {
                        monto: <span className="demo-num text-ink">{formatMonto(p.brutoAprobado)}</span>,
                      })}
                    </span>
                    <span className="text-muted">
                      {interpolarNodos(t('propuestas.ficha.aprobado.neto'), {
                        monto: <span className="demo-num text-ink">{formatMonto(p.netoAprobado)}</span>,
                      })}
                    </span>
                    <span className="text-muted">
                      {interpolarNodos(t('propuestas.ficha.aprobado.total'), {
                        monto: <span className="demo-num font-semibold text-ink">{formatMonto(p.totalAprobado)}</span>,
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
            </div>

            {puedeEditar && (
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <div className="text-[12px] font-medium text-ink">{t('propuestas.ficha.descuento')}</div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {interpolarNodos(t('propuestas.ficha.descuento.ayuda'), {
                    enviada: <b>{t('propuestas.ficha.descuento.enviada')}</b>,
                  })}
                  {/* TOPE-01 · el techo solo se anuncia cuando de verdad limita
                      algo. Escribir «máximo 100 %» en una organización sin tope
                      sería ruido, y peor: enseñaría un límite donde no lo hay. */}
                  {topeDescuento < 100 && (
                    <>{interpolarNodos(t('propuestas.ficha.descuento.tope-aviso'), {
                      tope: <b>{t('propuestas.comun.pct', { pct: topeDescuento })}</b>,
                    })}</>
                  )}
                </p>
                {editable ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number" min={0} max={topeDescuento} step={0.01}
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        onBlur={() => { if (descInput.trim() === '') setDescInput('0.00') }}
                        className="h-9 w-24 rounded border border-border-strong bg-surface pl-3 pr-6 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                    </div>
                    <Button size="sm" onClick={aplicarDescuento} disabled={guardandoDesc || Number(descInput) === p.descuentoPct}>
                      {guardandoDesc ? t('propuestas.comun.guardando') : t('propuestas.comun.aplicar')}
                    </Button>
                    {p.version > 1 && <span className="text-[11px] text-muted">{t('propuestas.ficha.version-actual', { n: p.version })}</span>}
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-muted">{t('propuestas.ficha.descuento.fijo', { estatus: etiquetaEst.toLowerCase() })}</p>
                )}
              </div>
            )}

            {/* PAQ-01 · EL PAQUETE CERRADO (ADR 0039, Fase 4).
                Bloque aparte, y el motivo es más fuerte que en los otros dos:
                un paquete NO es un descuento. El comercial y el código
                multiplican un precio ya resuelto; el paquete lo SUSTITUYE. Por
                eso este bloque no tiene ningún campo de porcentaje ni de
                importe: solo se ELIGE uno del catálogo, y el precio sale de
                ahí, del servidor y bajo RLS. */}
            {puedeEditar && (
              <div className="rounded-md border border-border bg-surface-2 p-3">
                <div className="text-[12px] font-medium text-ink">{t('propuestas.ficha.paquete')}</div>
                {p.paquete ? (
                  <>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {interpolarNodos(t('propuestas.ficha.paquete.vendido'), {
                        nombre: <b>{p.paquete.nombre}</b>,
                        precio: <b>{formatMonto(p.paquete.precio)}</b>,
                      })}
                      {' '}
                      {p.paquete.admiteCodigo
                        ? t('propuestas.ficha.paquete.admite-codigo')
                        : t('propuestas.ficha.paquete.precio-final')}
                    </p>
                    {/* La frase que responde a «¿y si alguien quita una
                        pantalla?». Se enseña en cuanto la propuesta deja de
                        cuadrar con lo que se cotizó, porque el precio NO baja y
                        eso es sorprendente. Callarlo sería mentir por omisión. */}
                    {p.paquete.avisoComposicion && (
                      <p className="mt-1 rounded border border-[#f59e0b40] bg-warning-soft px-2 py-1 text-[11px] text-ink">
                        {p.paquete.avisoComposicion}
                      </p>
                    )}
                    <ul className="m-0 mt-1 list-none p-0 text-[11px] text-muted">
                      {p.paquete.sitios.map((s) => (
                        <li key={s.sitioId}>
                          {sitios?.find((x) => x.id === s.sitioId)?.nombre ?? s.sitioId}:{' '}
                          {formatMonto(s.parte)}
                        </li>
                      ))}
                    </ul>
                    {editable ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={quitarPaquete} disabled={guardandoPaq}>
                          {guardandoPaq ? t('propuestas.comun.quitando') : t('propuestas.ficha.paquete.quitar')}
                        </Button>
                        <span className="text-[11px] text-muted">
                          {t('propuestas.ficha.paquete.quitar.ayuda')}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-muted">
                        {t('propuestas.ficha.paquete.fijo', { estatus: etiquetaEst.toLowerCase() })}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {interpolarNodos(t('propuestas.ficha.paquete.ayuda'), {
                        sustituye: <b>{t('propuestas.ficha.paquete.sustituye')}</b>,
                        exactamente: <b>{t('propuestas.ficha.paquete.exactamente')}</b>,
                      })}
                    </p>
                    {editable && catalogoPaq.length > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          aria-label={t('propuestas.ficha.paquete')}
                          value={paqSel}
                          onChange={(e) => setPaqSel(e.target.value)}
                          className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <option value="">{t('propuestas.ficha.paquete.elige-opcion')}</option>
                          {catalogoPaq.map((x) => (
                            <option key={x.id} value={x.id}>
                              {t(x.sitios.length === 1 ? 'propuestas.ficha.paquete.opcion.uno' : 'propuestas.ficha.paquete.opcion.otros', {
                                nombre: x.nombre,
                                precio: formatMonto(x.precioCerrado),
                                n: x.sitios.length,
                              })}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={aplicarPaquete} disabled={guardandoPaq || !paqSel}>
                          {guardandoPaq ? t('propuestas.comun.aplicando') : t('propuestas.comun.aplicar')}
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-muted">
                        {!editable
                          ? t('propuestas.ficha.paquete.no-admite', { estatus: etiquetaEst.toLowerCase() })
                          : t('propuestas.ficha.paquete.sin-catalogo')}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* COD-01 / COD-03 · EL CÓDIGO PROMOCIONAL. Vive en su propio
                componente desde que necesita aprobación: estado, selector de
                vigentes y decisión del gerente. Ver la cabecera de
                `BloqueCodigoPropuesta`. Se ofrece también en RECHAZADA, que
                `editable` excluye: un cupón la reactiva (decisión 1 del dueño). */}
            <BloqueCodigoPropuesta
              propuestaId={p.id}
              estatus={p.estatus}
              codigoTexto={p.codigoTexto}
              codigoDescuentoPct={p.codigoDescuentoPct}
              codigoEstado={p.codigoEstado}
              puedeEditar={puedeEditar}
            />
          </div>
      </CardColapsable>

      {/* Sitios y renta (publishers) */}
      <CardColapsable
        id="propuesta.sitios"
        titulo={t('propuestas.ficha.sitios')}
        resumen={
          <span className="text-[12px] text-muted">
            {interpolarNodos(t('propuestas.ficha.sitios.renta-total'), {
              monto: <b className="demo-num text-ink">{formatMonto(rentaTotal)}</b>,
            })}
          </span>
        }
      >
          {/* PROP-COMPLETA · agregar sitios (BORRADOR o ENVIADA). Abre el
              formulario de alta en modo «agregar», con el periodo de la propuesta. */}
          {puedeEditar && sitiosEditables && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => router.push(`/propuestas?agregar=${p.id}`)}>
                <Plus className="h-3.5 w-3.5" /> {t('propuestas.comun.agregar-sitios')}
              </Button>
              {p.estatus === 'ENVIADA' && (
                <span className="text-[11px] text-muted">{t('propuestas.ficha.sitios.enviada')}</span>
              )}
            </div>
          )}
          {p.items.length === 0 ? (
            <p className="text-[13px] text-muted">{t('propuestas.ficha.sitios.vacia')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">{t('propuestas.ficha.tabla.sitio')}</th>
                    <th className="py-2 pr-3 font-medium">{t('propuestas.ficha.tabla.arrendador')}</th>
                    {/* QUÉ se vendió, no solo cuánto. Se podían vender 50 spots
                        y el 50 no aparecía en ninguna pantalla posterior: esta
                        tabla enseñaba sitio, renta y precio, y un importe sin su
                        unidad no dice nada — «$60,000» puede ser un mes o
                        cincuenta spots. */}
                    <th className="py-2 pr-3 font-medium">{t('propuestas.ficha.tabla.contratacion')}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t('propuestas.ficha.tabla.precio')}</th>
                    <th className="py-2 pl-3 text-right font-medium">{t('propuestas.ficha.tabla.aprobado')}</th>
                    {puedeEditar && sitiosEditables && p.items.length > 1 && (
                      <th className="py-2 pl-2" aria-label={t('propuestas.ficha.tabla.quitar')} />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.items.map((it) => {
                    const s = sitios?.find((x) => x.id === it.sitioId)
                    const renta = rentaDe(it.sitioId)
                    const digital =
                      !!s &&
                      (s.tipoMedio === 'PANTALLA_DIGITAL' ||
                        s.esRotativo ||
                        s.exhibicion === 'digital' ||
                        s.exhibicion === 'rotativo')
                    return (
                      <tr key={it.id} className={it.aprobado ? '' : 'opacity-70'}>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-ink">{s?.nombre ?? it.sitioId}</span>
                            {s && (
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                                  digital
                                    ? 'border-[#0a66ff40] bg-accent-soft text-[#0a4fcc]'
                                    : 'border-border bg-surface-2 text-muted'
                                }`}
                              >
                                {digital ? <Monitor className="h-2.5 w-2.5" /> : <Square className="h-2.5 w-2.5" />}
                                {digital ? t('propuestas.comun.digital') : t('propuestas.comun.fija')}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                            <MapPin className="h-3 w-3" /> {s?.alcaldia ?? '—'}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {renta ? (
                            <>
                              <div className="text-ink">{renta.propietario}</div>
                              <div className="demo-num text-[11px] text-muted">
                                {formatMonto(renta.monto)} · {renta.periodicidad}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted">{t('propuestas.ficha.tabla.sin-contrato')}</span>
                          )}
                        </td>
                        {/* La multiplicación que produjo el importe de al lado,
                            escrita: «50 spots × $ 1,200.00». Y debajo, la
                            frecuencia — con OTRO vocabulario («pases al día»)
                            porque `cantidad` y `spotsPorDia` son dos números
                            distintos y confundirlos fue DATA-02. Los textos los
                            arma `lib/periodos.ts`, que sí se prueba: sin jsdom,
                            una decisión escrita aquí dentro no la ve nadie. */}
                        <td className="py-2.5 pr-3">
                          <div className="demo-num text-ink">
                            {resumenContratacion({
                              unidad: it.unidad,
                              cantidad: it.cantidad,
                              tarifaUnitaria: it.tarifaUnitaria,
                            })}
                          </div>
                          {/* PRECIO-01 · la tarifa se apartó de la calculada.
                              Solo en esta pantalla INTERNA: la liga del
                              cliente enseña el precio final y nada más. Las
                              dos cifras y el nombre, porque «ajustada» a secas
                              no deja saber cuánto se movió ni quién lo movió. */}
                          {it.precioAjustadoPor && (
                            <div className="text-[11px] font-medium text-[#9a6700]">
                              {t('propuestas.ficha.tabla.ajustada', {
                                tarifa:
                                  it.tarifaCalculada != null
                                    ? t('propuestas.ficha.tabla.tarifa-calculada', { monto: formatMonto(it.tarifaCalculada) })
                                    : t('propuestas.ficha.tabla.sin-tarifa-calculada'),
                                quien: it.precioAjustadoPorNombre ?? t('propuestas.ficha.tabla.usuario-baja'),
                              })}
                            </div>
                          )}
                          {/* ADR 0042 · con qué se calculó la cantidad: espacios
                              del loop, horas al día y, si lo es, Roadblock y su
                              prima. Solo aquí, en la pantalla INTERNA: la liga
                              del cliente enseña el precio final. */}
                          {etiquetaCalculadora(it) && (
                            <div className="text-[11px] text-muted">{etiquetaCalculadora(it)}</div>
                          )}
                          {etiquetaFrecuencia(it.spotsPorDia) && (
                            <div className="text-[11px] text-muted">{etiquetaFrecuencia(it.spotsPorDia)}</div>
                          )}
                          {/* REJILLA-01 · la franja CONTRATADA. Se pinta el
                              nombre CON su horario a propósito: «Prime» a secas
                              obliga a ir a buscar qué horas son, y el día que
                              alguien mueva esa franja el documento diría otra
                              cosa de lo que se vendió. Si el nombre no viajó
                              —consulta sin el join—, se enseña el identificador
                              antes que inventar una etiqueta. */}
                          {it.franjaId && (
                            <div className="text-[11px] font-medium text-amber-800">
                              {it.franjaNombre ?? it.franjaId}
                              {it.franjaHorario ? ` · ${it.franjaHorario}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="demo-num py-2.5 pr-3 text-right text-ink">{formatMonto(it.precio)}</td>
                        <td className="py-2.5 pl-3 text-right">
                          {puedeEditar ? (
                            <input
                              type="checkbox"
                              checked={it.aprobado}
                              onChange={(e) => aprobar(it.id, e.target.checked)}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                          ) : it.aprobado ? (
                            <Check className="ml-auto h-4 w-4 text-success" />
                          ) : (
                            <X className="ml-auto h-4 w-4 text-muted" />
                          )}
                        </td>
                        {/* Nunca el último: sin sitios no hay periodo ni importe. */}
                        {puedeEditar && sitiosEditables && p.items.length > 1 && (
                          <td className="py-2.5 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => quitarSitio(it.id, s?.nombre ?? t('propuestas.ficha.tabla.este-sitio'))}
                              className="rounded p-1 text-muted hover:bg-surface-2 hover:text-error"
                              aria-label={t('propuestas.ficha.tabla.quitar-sitio', {
                                sitio: s?.nombre ?? t('propuestas.ficha.tabla.sitio-generico'),
                              })}
                              title={t('propuestas.ficha.tabla.quitar.titulo')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {/* REJILLA-01 · el aviso solo aparece si esta propuesta vendió
                  alguna franja, y entonces no se puede pasar por alto: va
                  debajo de la tabla que la enseña. Una propuesta sin franjas no
                  tiene nada que advertir, y un aviso puesto siempre se vuelve
                  decorado. El mismo texto queda CONGELADO dentro del
                  `snapshot_economico` al aprobar (`avisoFranja`), que es lo que
                  sobrevive cuando esta pantalla haya cambiado. */}
              {p.items.some((it: any) => it.franjaId) && (
                <div className="mt-3">
                  <AvisoFranjaCMS />
                </div>
              )}
            </div>
          )}
      </CardColapsable>

      {/* PROP-COMPLETA (29/10) · lo que el cliente lee además de los
          importes: hasta cuándo puede aceptar y en qué términos. */}
      <CardColapsable id="propuesta.condiciones" titulo={t('propuestas.ficha.condiciones')}>
        <BloqueCondicionesVigencia
          propuestaId={p.id}
          condiciones={p.condiciones ?? null}
          vigenteHasta={p.vigenteHasta ?? null}
          vencida={!!p.vencida}
          editable={puedeEditar && p.estatus !== 'APROBADA'}
        />
      </CardColapsable>

      {/* Mapa con la ubicación de las pantallas. PLEG-02 · plegado, el mapa se
          desmonta: al volver a abrirlo se redibuja con el encuadre inicial. */}
      <CardColapsable id="propuesta.mapa" titulo={t('propuestas.ficha.mapa')}>
          <div className="h-[360px] w-full overflow-hidden rounded border border-border">
            {puntos.length ? (
              <MapView points={puntos} zoom={11} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-muted">
                {sitios === undefined
                  ? t('propuestas.ficha.mapa.cargando')
                  : p.items.length === 1
                    ? t('propuestas.ficha.mapa.sin-coords.uno')
                    : t('propuestas.ficha.mapa.sin-coords.otros', { n: p.items.length })}
              </div>
            )}
          </div>
          {puntos.length > 0 && sinCoords > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              {t('propuestas.ficha.mapa.parcial', {
                n: sinCoords,
                pantallas: conteo(p.items.length, t('propuestas.unidad.pantalla'), t('propuestas.unidad.pantallas')),
              })}
            </p>
          )}
      </CardColapsable>

      {/* «Costo · método del divisor» se retiró el 26/10 (rediseño de módulos):
          repetía la escalera de bruto a total de «Resumen económico», y su
          «Sobre lo aprobado» pasó como franja debajo de aquella. Si alguien la
          resucita, que lea lo que dejaron escrito sus comentarios: la comisión
          se medía como `p.brutoConVolumen - p.codigoDescuentoMonto - p.neto`
          porque con `p.bruto` a secas el descuento por volumen (VOL-01) y el
          del cupón (COD-01) se contaban DOS VECES —una en su renglón y otra
          dentro de la comisión—, y aun así NO quitaba el descuento comercial,
          que es por qué no coincidía con la de arriba (`p.base - p.neto`). */}
    </div>
  )
}

function Meta({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        {icon}{label}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-ink" title={value}>{value}</div>
    </div>
  )
}

// Barra de estado tipo «Path» (Salesforce/Pipedrive): en qué paso del ciclo va
// la propuesta, de un vistazo. Pasos NO clicables a propósito: los cambios de
// estatus siguen siendo los botones de arriba, con sus permisos y sus
// confirmaciones. Solo pinta `p.estatus` y si ya existe la campaña.
function PasosEstatus({ estatus, conCampana }: { estatus: EstPropuesta; conCampana: boolean }) {
  const t = useTexto()
  const cerrada = estatus === 'APROBADA' || estatus === 'RECHAZADA'
  const pasos: { label: string; hecho: boolean; actual: boolean; tono?: string }[] = [
    { label: t(CLAVE_ESTATUS.BORRADOR), hecho: estatus !== 'BORRADOR', actual: estatus === 'BORRADOR' },
    { label: t(CLAVE_ESTATUS.ENVIADA), hecho: cerrada, actual: estatus === 'ENVIADA' },
    estatus === 'RECHAZADA'
      ? { label: t(CLAVE_ESTATUS.RECHAZADA), hecho: false, actual: true, tono: 'border-[#ef444440] text-error' }
      : { label: t(CLAVE_ESTATUS.APROBADA), hecho: conCampana, actual: estatus === 'APROBADA' && !conCampana },
  ]
  if (estatus === 'APROBADA') pasos.push({ label: t('propuestas.comun.campana-generada'), hecho: false, actual: conCampana })
  return (
    <ol className="m-0 mt-2 flex list-none flex-wrap items-center gap-1 p-0 text-[11px]" aria-label={t('propuestas.ficha.pasos')}>
      {pasos.map((x, i) => (
        <li key={x.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted" />}
          <span
            aria-current={x.actual ? 'step' : undefined}
            className={cn(
              'rounded-full border px-2 py-0.5',
              x.actual
                ? x.tono ?? 'border-accent bg-accent-soft font-medium text-ink'
                : x.hecho
                  ? 'border-border text-ink'
                  : 'border-border text-muted',
            )}
          >
            {x.hecho && <CheckIcon className="mr-0.5 inline h-3 w-3 text-[#0f7a55]" />}
            {x.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Fila({ label, valor, fuerte, tono }: { label: string; valor: string; fuerte?: boolean; tono?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`demo-num ${tono ?? (fuerte ? 'font-semibold text-ink' : 'text-ink')}`}>{valor}</dd>
    </div>
  )
}
