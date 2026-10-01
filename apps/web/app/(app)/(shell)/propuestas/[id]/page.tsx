'use client'


import { toast } from 'sonner'
import { conteo } from '@/lib/plural'
import { resumenContratacion, etiquetaFrecuencia } from '@/lib/periodos'
import { AvisoFranjaCMS } from '@/components/demo/rejilla/AvisoFranjaCMS'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Wallet,
  Coins,
  Receipt,
  MapPin,
  Monitor,
  Square,
  Building2,
  Send,
  Check,
  X,
  ChevronRight,
  CalendarDays,
  Link2,
  FileDown,
  Check as CheckIcon,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Breadcrumbs, type Crumb } from '@/components/demo/ui/Breadcrumbs'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { pinTono } from '@/components/demo/StatusBadge'
import { trailFromLocation } from '@/lib/nav-trail'
import { usePuede } from '@/components/demo/shell/SesionContext'
import {
  cambiarEstatusPropuestaApi,
  aprobarItemPropuestaApi,
  generarCampanaDesdePropuestaApi,
  actualizarPropuestaApi,
  refrescarEstado,
  ConfirmacionCeroError,
} from '@/lib/data/estado-api'
import { BloqueCodigoPropuesta } from '@/components/demo/codigos/BloqueCodigoPropuesta'
import {
  paquetesApi,
  aplicarPaqueteApi,
  quitarPaqueteApi,
  type PaqueteUI,
} from '@/lib/data/paquetes-api'
import {
  usePropuestas,
  useClientes,
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

const EST: Record<EstPropuesta, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'border-border text-muted' },
  ENVIADA: { label: 'Enviada', cls: 'border-[#0a66ff40] text-info' },
  APROBADA: { label: 'Aprobada', cls: 'border-[#10b98140] text-[#0f7a55]' },
  RECHAZADA: { label: 'Rechazada', cls: 'border-[#ef444440] text-error' },
}

export default function PropuestaDetallePage({ params }: { params: { id: string } }) {
  const id = params.id
  const propuestas = usePropuestas()
  const clientes = useClientes()
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
  const router = useRouter()
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [descInput, setDescInput] = useState('')
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
    if (pActual) setDescInput(String(pActual.descuentoPct))
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
      toast.error('Descuento inválido (0–100)')
      return
    }
    // TOPE-01 · el mensaje DICE EL TOPE, no «valor inválido». Quien vende tiene
    // que saber qué número sí puede teclear sin preguntarle a nadie. El servidor
    // lo rechaza igualmente (`descuentoDentroDelTope`): esto solo evita el viaje.
    if (d > topeDescuento) {
      toast.error(`El descuento máximo que autoriza tu organización es ${topeDescuento} %`)
      return
    }
    setGuardandoDesc(true)
    try {
      await actualizarPropuestaApi(id, { descuentoPct: d })
      toast.success('Descuento actualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
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
      toast.error('Elige un paquete')
      return
    }
    setGuardandoPaq(true)
    try {
      const r = await aplicarPaqueteApi(id, paqSel)
      toast.success(
        `Paquete ${r.nombre} aplicado: ${formatMonto(r.precio)} por el conjunto`,
      )
      setPaqSel('')
      await refrescarEstado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardandoPaq(false)
    }
  }

  /** Quita el paquete y devuelve la propuesta a los precios de línea. */
  async function quitarPaquete() {
    setGuardandoPaq(true)
    try {
      await quitarPaqueteApi(id)
      toast.success('Paquete quitado; vuelven los precios de lista de cada pantalla')
      await refrescarEstado()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardandoPaq(false)
    }
  }

  async function copiar(texto: string, marcar: (v: boolean) => void, mensaje = 'Copiado') {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success(mensaje)
    } catch {
      window.prompt('Copia esto:', texto)
    }
    marcar(true)
    setTimeout(() => marcar(false), 2200)
  }

  // Copia la liga pública (solo lectura) con el token aleatorio (S1-3): solo
  // quien tenga este link exacto puede abrir/aceptar la propuesta.
  function copiarLiga() {
    if (!p?.tokenPublico) {
      toast.error('Esta propuesta aún no tiene liga; vuelve a guardarla.')
      return
    }
    void copiar(`${window.location.origin}/spaces-dooh/p/${p.tokenPublico}`, setCopiado, 'Liga de la propuesta copiada')
  }

  // Generar PDF: por ahora no hace nada (placeholder de UI).
  function generarPdf() {
    /* TODO: generación de PDF de la propuesta */
  }

  // Rastro de navegación (cómo llegué); por defecto, Propuestas.
  const [trail, setTrail] = useState<Crumb[]>([])
  useEffect(() => {
    const t = trailFromLocation()
    setTrail(t.length ? t : [{ label: 'Propuestas', href: '/propuestas' }])
  }, [])
  const volver = trail.length ? trail[trail.length - 1] : { label: 'Propuestas', href: '/propuestas' }

  if (!propuestas) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }
  const p = propuestas.find((x) => x.id === id)
  if (!p) {
    return (
      <div className="w-full">
        <p className="text-[13px] text-muted">Propuesta no encontrada.</p>
        <Link href="/propuestas" className="mt-2 inline-flex items-center gap-1 text-[13px] text-info">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a propuestas
        </Link>
      </div>
    )
  }

  const cliente = clientes?.find((c) => c.id === p.clienteId)
  const agencia = clientes?.find((c) => c.id === p.agenciaId)
  const est = EST[p.estatus]
  const ivaPct = p.base ? Math.round((p.iva / p.base) * 100) : 16
  const comisionPct = Math.round(100 - p.divisor * 100)
  const editable = p.estatus !== 'APROBADA' && p.estatus !== 'RECHAZADA'

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
        if (window.confirm(`${e.message}\n\n¿Aprobar de todas formas?`)) return cambiar(estatus, true)
        return
      }
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }
  async function aprobar(itemId: string, aprobado: boolean) {
    try { await aprobarItemPropuestaApi(itemId, aprobado) } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }
  async function generarCampana() {
    setGenerando(true)
    try {
      const camp = await generarCampanaDesdePropuestaApi(id)
      if (camp?.id) router.push(`/campanas/${camp.id}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    setGenerando(false)
  }

  return (
    <div className="w-full space-y-4">
      {/* Migas */}
      <div className="flex flex-wrap items-center gap-2">
        {volver.href && (
          <Link href={volver.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> {volver.label}
          </Link>
        )}
        <span className="text-muted/50">·</span>
        <Breadcrumbs items={[...trail, { label: p.nombre }]} />
      </div>

      {/* Encabezado: nombre de la campaña/propuesta + estatus + acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl text-ink">{p.nombre}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${est.cls}`}>{est.label}</span>
            {p.version > 1 && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted" title="Versión (sube en cada renegociación)">
                v{p.version}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-muted">
            Folio interno: <span className="demo-num font-medium text-ink">{p.folio}</span>
            <span className="ml-1 text-muted">· el cliente accede solo por la liga (token)</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Compartir + PDF (visibles siempre) */}
          <Button size="sm" variant="secondary" onClick={copiarLiga}>
            {copiado ? <><CheckIcon className="h-3.5 w-3.5 text-success" /> ¡Copiado!</> : <><Link2 className="h-3.5 w-3.5" /> Copiar liga</>}
          </Button>
          <Button size="sm" variant="secondary" onClick={generarPdf}>
            <FileDown className="h-3.5 w-3.5" /> Generar PDF
          </Button>

          {/* Acciones de estatus (solo edición) */}
          {puedeEditar && p.estatus === 'BORRADOR' && (
            <Button size="sm" variant="primary" onClick={() => cambiar('ENVIADA')}><Send className="h-3.5 w-3.5" /> Enviar</Button>
          )}
          {puedeEditar && (p.estatus === 'ENVIADA' || p.estatus === 'BORRADOR') && (
            <>
              <Button size="sm" onClick={() => cambiar('APROBADA')}><Check className="h-3.5 w-3.5" /> Aprobar</Button>
              <Button size="sm" variant="danger" onClick={() => cambiar('RECHAZADA')}><X className="h-3.5 w-3.5" /> Rechazar</Button>
            </>
          )}
          {puedeEditar && p.estatus === 'APROBADA' && (
            <Button size="sm" disabled={generando} onClick={generarCampana}>
              <ChevronRight className="h-3.5 w-3.5" /> {generando ? 'Generando…' : 'Generar campaña'}
            </Button>
          )}
        </div>
      </div>

      {/* Barra de metadatos (fechas / anunciante / agencia / comisión) */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          <Meta icon={<CalendarDays className="h-4 w-4" />} label="Fechas"
            value={desde && hasta ? `${formatFecha(desde)} – ${formatFecha(hasta)}` : '—'} />
          <Meta label="Anunciante" value={cliente?.nombre ?? 'Sin cliente'} />
          <Meta label="Agencia" value={agencia?.nombre ?? 'Directa'} />
          <Meta label="Comisión" value={`${comisionPct}%`} />
        </div>
      </Card>

      {/* Resumen económico (KPIs) */}
      <Card>
        <CardHeader><CardTitle>Resumen económico</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={<Wallet className="h-4 w-4" />} tono="info" label="Total c/IVA" value={formatMonto(p.total)} />
            <Kpi icon={<Coins className="h-4 w-4" />} tono="success" label="Neto propuesto" value={formatMonto(p.neto)} />
            <Kpi icon={<Receipt className="h-4 w-4" />} tono="ambar" label={`IVA ${ivaPct}%`} value={formatMonto(p.iva)} />
            <Kpi icon={<Building2 className="h-4 w-4" />} tono="neutro" label="Sitios" value={`${p.items.length}`} />
          </div>

          {/* Desglose con descuento comercial + editor */}
          <div className="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
            <dl className="space-y-1.5 text-[13px]">
              <Fila label="Bruto (tarifa de lista)" valor={formatMonto(p.bruto)} />
              {/* PAQ-01 · EL PAQUETE VA PRIMERO Y NO ES UN DESCUENTO. Se pinta
                  como «precio del conjunto» y con el importe en positivo, no
                  como una resta: llamarlo descuento haría creer que el bruto de
                  arriba sigue mandando, y lo que pasa es que deja de mandar.
                  Sin este renglón la escalera no cuadra en pantalla, y una
                  cuenta que no da se lee como un defecto del sistema.
                  Va en LOS DOS desgloses de esta página: el de «Resumen
                  económico» y el de «Costo · método del divisor». */}
              {p.paquete && (
                <Fila
                  label={`Paquete "${p.paquete.nombre}" — precio del conjunto`}
                  valor={formatMonto(p.paquete.precio)}
                />
              )}
              {/* VOL-01 · el renglón aparece SOLO cuando hay volumen, y tiene que
                  aparecer: sin él la escalera no cuadra en pantalla —bruto menos
                  descuento comercial no daría la base— y una cuenta que no da se
                  lee como un defecto del sistema. */}
              {p.descuentoVolumenMonto > 0 && (
                <Fila
                  label={`Descuento por volumen (${Math.round(p.descuentoVolumenPct * 10) / 10}%)`}
                  valor={`− ${formatMonto(p.descuentoVolumenMonto)}`}
                  tono="text-error"
                />
              )}
              <Fila label={`Descuento comercial (${p.descuentoPct}%)`} valor={p.descuentoMonto ? `− ${formatMonto(p.descuentoMonto)}` : '—'} tono={p.descuentoMonto ? 'text-error' : undefined} />
              {/* COD-01 · el renglón aparece SOLO cuando hay código, y tiene que
                  aparecer con SU NOMBRE: un descuento sin decir de qué cupón salió
                  no se puede explicar seis meses después, y sin él la escalera no
                  cuadra en pantalla. */}
              {p.codigoDescuentoMonto > 0 && (
                <Fila
                  label={`Código ${p.codigoTexto ?? ''} (${p.codigoDescuentoPct}%)${
                    // COD-03 · el total INTERNO cuenta el cupón aunque esté
                    // pendiente (es lo que se ofrece); el renglón avisa de que
                    // el cliente todavía no lo ve.
                    p.codigoEstado === 'PENDIENTE' ? ' · cupón pendiente de aprobación' : ''
                  }`}
                  valor={`− ${formatMonto(p.codigoDescuentoMonto)}`}
                  tono="text-error"
                />
              )}
              <Fila label="Base con descuento" valor={formatMonto(p.base)} />
              <Fila label={`Comisión de agencia (${comisionPct}%)`} valor={`− ${formatMonto(p.base - p.neto)}`} />
              <Fila label="Neto (para el medio)" valor={formatMonto(p.neto)} />
              <Fila label={`IVA ${ivaPct}%`} valor={formatMonto(p.iva)} />
              <div className="border-t border-border pt-1.5">
                <Fila label="Total que paga el cliente" valor={formatMonto(p.total)} fuerte />
              </div>
            </dl>

            {puedeEditar && (
              <div className="rounded-md border border-border bg-surface-2/40 p-3">
                <div className="text-[12px] font-medium text-ink">Descuento comercial</div>
                <p className="mt-0.5 text-[11px] text-muted">
                  Rebaja sobre la tarifa de lista (distinta de la comisión de agencia).
                  {' '}Cambiarlo en una propuesta ya <b>Enviada</b> sube la versión (renegociación).
                  {/* TOPE-01 · el techo solo se anuncia cuando de verdad limita
                      algo. Escribir «máximo 100 %» en una organización sin tope
                      sería ruido, y peor: enseñaría un límite donde no lo hay. */}
                  {topeDescuento < 100 && (
                    <> Tu organización autoriza hasta <b>{topeDescuento} %</b>; para más, Administración tiene que subir el tope.</>
                  )}
                </p>
                {editable ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number" min={0} max={topeDescuento} step={1}
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        className="h-9 w-24 rounded border border-border-strong bg-surface pl-3 pr-6 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                    </div>
                    <Button size="sm" onClick={aplicarDescuento} disabled={guardandoDesc || Number(descInput) === p.descuentoPct}>
                      {guardandoDesc ? 'Guardando…' : 'Aplicar'}
                    </Button>
                    {p.version > 1 && <span className="text-[11px] text-muted">versión actual: v{p.version}</span>}
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-muted">La propuesta ya está {est.label.toLowerCase()}; el descuento quedó fijo.</p>
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
              <div className="rounded-md border border-border bg-surface-2/40 p-3">
                <div className="text-[12px] font-medium text-ink">Paquete cerrado</div>
                {p.paquete ? (
                  <>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Esta propuesta se vende como el paquete{' '}
                      <b>{p.paquete.nombre}</b> por <b>{formatMonto(p.paquete.precio)}</b>, que ya
                      está congelado: si el paquete cambia o se borra, este precio no se mueve.
                      {' '}
                      {p.paquete.admiteCodigo
                        ? 'Admite código promocional encima.'
                        : 'Es precio final: no admite descuento por volumen ni código promocional.'}
                    </p>
                    {/* La frase que responde a «¿y si alguien quita una
                        pantalla?». Se enseña en cuanto la propuesta deja de
                        cuadrar con lo que se cotizó, porque el precio NO baja y
                        eso es sorprendente. Callarlo sería mentir por omisión. */}
                    {p.paquete.avisoComposicion && (
                      <p className="mt-1 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-ink">
                        {p.paquete.avisoComposicion}
                      </p>
                    )}
                    <ul className="mt-1 text-[11px] text-muted">
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
                          {guardandoPaq ? 'Quitando…' : 'Quitar paquete'}
                        </Button>
                        <span className="text-[11px] text-muted">
                          Quitarlo devuelve los precios de lista de cada pantalla.
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-muted">
                        La propuesta ya está {est.label.toLowerCase()}; el paquete quedó fijo.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-0.5 text-[11px] text-muted">
                      El precio del paquete <b>sustituye</b> la suma de las tarifas de lista: no la
                      descuenta, la reemplaza. Y se reparte entre sus pantallas a prorrata, que es
                      el ingreso que el reporte le atribuye a cada una. Solo se puede aplicar si
                      esta propuesta tiene <b>exactamente</b> las pantallas del paquete.
                    </p>
                    {editable && catalogoPaq.length > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          aria-label="Paquete cerrado"
                          value={paqSel}
                          onChange={(e) => setPaqSel(e.target.value)}
                          className="h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <option value="">Elige un paquete…</option>
                          {catalogoPaq.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nombre} — {formatMonto(x.precioCerrado)} · {x.sitios.length} pantallas
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={aplicarPaquete} disabled={guardandoPaq || !paqSel}>
                          {guardandoPaq ? 'Aplicando…' : 'Aplicar'}
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-muted">
                        {!editable
                          ? `La propuesta ya está ${est.label.toLowerCase()}; no admite paquete.`
                          : 'No hay paquetes activos en el catálogo.'}
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
        </CardContent>
      </Card>

      {/* Sitios y renta (publishers) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sitios y renta</CardTitle>
          <span className="text-[12px] text-muted">
            Renta total ref. <b className="demo-num text-ink">{formatMonto(rentaTotal)}</b>
          </span>
        </CardHeader>
        <CardContent>
          {p.items.length === 0 ? (
            <p className="text-[13px] text-muted">Esta propuesta no tiene sitios.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Sitio</th>
                    <th className="py-2 pr-3 font-medium">Arrendador · renta</th>
                    {/* QUÉ se vendió, no solo cuánto. Se podían vender 50 spots
                        y el 50 no aparecía en ninguna pantalla posterior: esta
                        tabla enseñaba sitio, renta y precio, y un importe sin su
                        unidad no dice nada — «$60,000» puede ser un mes o
                        cincuenta spots. */}
                    <th className="py-2 pr-3 font-medium">Contratación</th>
                    <th className="py-2 pr-3 text-right font-medium">Precio propuesta</th>
                    <th className="py-2 pl-3 text-right font-medium">Aprobado</th>
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
                                {digital ? 'Digital' : 'Fija'}
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
                            <span className="text-muted">Sin contrato de renta</span>
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
        </CardContent>
      </Card>

      {/* Mapa con la ubicación de las pantallas */}
      <Card>
        <CardHeader><CardTitle>Ubicación de las pantallas</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[360px] w-full overflow-hidden rounded border border-border">
            {puntos.length ? (
              <MapView points={puntos} zoom={11} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-muted">
                {sitios === undefined
                  ? 'Cargando ubicaciones…'
                  : `Ninguna de las ${p.items.length} pantalla${p.items.length === 1 ? '' : 's'} de esta propuesta tiene coordenadas capturadas.`}
              </div>
            )}
          </div>
          {puntos.length > 0 && sinCoords > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              {sinCoords} de {conteo(p.items.length, 'pantalla')} no tienen coordenadas y no aparecen en el mapa.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Costo (método del divisor) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Costo · método del divisor</CardTitle>
          <span className="text-[12px] text-muted">
            Aprobado {p.itemsAprobados}/{conteo(p.items.length, 'sitio')}
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Desglose */}
            <dl className="space-y-2 text-[13px]">
              <Fila label="Bruto (tarifa de lista)" valor={formatMonto(p.bruto)} />
              {/* PAQ-01 · EL PAQUETE VA PRIMERO Y NO ES UN DESCUENTO. Se pinta
                  como «precio del conjunto» y con el importe en positivo, no
                  como una resta: llamarlo descuento haría creer que el bruto de
                  arriba sigue mandando, y lo que pasa es que deja de mandar.
                  Sin este renglón la escalera no cuadra en pantalla, y una
                  cuenta que no da se lee como un defecto del sistema.
                  Va en LOS DOS desgloses de esta página: el de «Resumen
                  económico» y el de «Costo · método del divisor». */}
              {p.paquete && (
                <Fila
                  label={`Paquete "${p.paquete.nombre}" — precio del conjunto`}
                  valor={formatMonto(p.paquete.precio)}
                />
              )}
              {/* VOL-01 · el renglón aparece SOLO cuando hay volumen, y tiene que
                  aparecer: sin él la escalera no cuadra en pantalla —bruto menos
                  descuento comercial no daría la base— y una cuenta que no da se
                  lee como un defecto del sistema. */}
              {p.descuentoVolumenMonto > 0 && (
                <Fila
                  label={`Descuento por volumen (${Math.round(p.descuentoVolumenPct * 10) / 10}%)`}
                  valor={`− ${formatMonto(p.descuentoVolumenMonto)}`}
                  tono="text-error"
                />
              )}
              {/* La comisión se mide desde el bruto YA con el volumen quitado.
                  Con `p.bruto` a secas, el descuento por volumen se contaría dos
                  veces en esta columna: una en el renglón de arriba y otra
                  dentro de éste. (Este bloque tampoco desglosa el descuento
                  comercial — eso viene de antes y no se toca aquí.) */}
              {p.codigoDescuentoMonto > 0 && (
                <Fila
                  label={`Código ${p.codigoTexto ?? ''} (${p.codigoDescuentoPct}%)${
                    // COD-03 · el total INTERNO cuenta el cupón aunque esté
                    // pendiente (es lo que se ofrece); el renglón avisa de que
                    // el cliente todavía no lo ve.
                    p.codigoEstado === 'PENDIENTE' ? ' · cupón pendiente de aprobación' : ''
                  }`}
                  valor={`− ${formatMonto(p.codigoDescuentoMonto)}`}
                  tono="text-error"
                />
              )}
              {/* Y la comisión se mide QUITANDO también el código, por el mismo
                  motivo por el que la Fase 2 cambió `p.bruto` por
                  `p.brutoConVolumen`: con el bruto a secas, el descuento del
                  cupón se contaría DOS VECES en esta columna — una en el renglón
                  de arriba y otra dentro de éste. */}
              <Fila label={`Comisión de agencia (${comisionPct}%) · divisor ×${p.divisor.toFixed(2)}`} valor={`− ${formatMonto(p.brutoConVolumen - p.codigoDescuentoMonto - p.neto)}`} />
              <Fila label="Neto (lo que recibe el medio)" valor={formatMonto(p.neto)} />
              <Fila label={`IVA ${ivaPct}%`} valor={formatMonto(p.iva)} />
              <div className="mt-1 border-t border-border pt-2">
                <Fila label="Total que paga el cliente" valor={formatMonto(p.total)} fuerte />
              </div>
            </dl>
            {/* Aprobado */}
            <div className="rounded-md border border-[#10b98133] bg-[#10b9810d] p-3">
              <div className="mb-2 text-[12px] font-medium text-ink">Sobre lo aprobado</div>
              <dl className="space-y-2 text-[13px]">
                <Fila label="Bruto aprobado" valor={formatMonto(p.brutoAprobado)} />
                <Fila label="Neto aprobado" valor={formatMonto(p.netoAprobado)} />
                <Fila label="Total aprobado" valor={formatMonto(p.totalAprobado)} fuerte />
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>
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

const KPI_TONO: Record<string, string> = {
  info: 'bg-[#0a66ff1a] text-info',
  success: 'bg-[#10b9811a] text-[#0f7a55]',
  ambar: 'bg-[#f59e0b1a] text-[#9a6700]',
  neutro: 'bg-surface-2 text-muted',
}
function Kpi({ icon, tono, label, value }: { icon: React.ReactNode; tono: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${KPI_TONO[tono] ?? KPI_TONO.neutro}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="demo-num truncate text-[16px] font-semibold text-ink">{value}</div>
      </div>
    </div>
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
