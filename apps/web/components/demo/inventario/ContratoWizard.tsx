'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { UserRound, FileText, Monitor, Check, ChevronLeft, ChevronRight, Loader2, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { crearContratoConSitioApi, agregarPantallaAPredioApi } from '@/lib/data/estado-api'
import { useArrendadores, usePredios, useContratos, useSitios, formatMonto, medioLabel, type TipoMedio, type Sitio } from '@/lib/data/client'

// ============================================================================
//  ContratoWizard — alta guiada "arrendatario → contrato → pantalla".
//  El orden correcto del proceso: primero de quién se renta el espacio y en qué
//  condiciones (contrato, con fechas PASADAS permitidas para subir contratos ya
//  firmados), y al final se sube el inventario (pantalla o espectacular). Todo se
//  crea de forma atómica en el backend.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const TIPO_PANTALLA: { v: TipoMedio; label: string }[] = [
  { v: 'ESPECTACULAR', label: 'Espectacular' },
  { v: 'PANTALLA_DIGITAL', label: 'Pantalla digital' },
  { v: 'MURAL', label: 'Muro' },
  { v: 'VALLA', label: 'Valla' },
  { v: 'MOBILIARIO_URBANO', label: 'Mobiliario urbano' },
  { v: 'PUENTE_PEATONAL', label: 'Puente' },
  { v: 'OTRO', label: 'Otro' },
]
const PERIODICIDADES: { v: string; label: string }[] = [
  { v: 'SEMANAL', label: 'Semanal' },
  { v: 'CATORCENAL', label: 'Catorcenal (cada 14 días)' },
  { v: 'QUINCENAL', label: 'Quincenal' },
  { v: 'MENSUAL', label: 'Mensual' },
  { v: 'BIMESTRAL', label: 'Bimestral' },
  { v: 'TRIMESTRAL', label: 'Trimestral' },
  { v: 'SEMESTRAL', label: 'Semestral' },
  { v: 'ANUAL', label: 'Anual' },
]

const periodicidadLabel = (v: string) =>
  PERIODICIDADES.find((p) => p.v === v)?.label ?? v

const PASOS = [
  { n: 1, label: 'Arrendatario y predio', icon: UserRound },
  { n: 2, label: 'Contrato', icon: FileText },
  { n: 3, label: 'Pantalla', icon: Monitor },
]

export function ContratoWizard({
  onCreado,
  bare = false,
}: {
  onCreado?: (s: { nombre: string }) => void
  // `bare`: sin el marco exterior (para usarlo dentro de un Modal).
  bare?: boolean
}) {
  const arrendadores = useArrendadores()
  const predios = usePredios()
  const contratos = useContratos()
  const sitios = useSitios()
  const [paso, setPaso] = useState(1)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Paso 1 — arrendatario
  const [modoArr, setModoArr] = useState<'existente' | 'nuevo'>('existente')
  const [arrId, setArrId] = useState('')
  const [arrNombre, setArrNombre] = useState('')
  const [arrRfc, setArrRfc] = useState('')
  const [arrTel, setArrTel] = useState('')
  const [arrEmail, setArrEmail] = useState('')

  // Paso 1 — predio (obligatorio: el contrato cuelga del predio y su renta se
  // reparte entre las pantallas del predio).
  const [modoPredio, setModoPredio] = useState<'existente' | 'nuevo'>('nuevo')
  const [predioId, setPredioId] = useState('')
  const [predioNombre, setPredioNombre] = useState('')
  const [predioDireccion, setPredioDireccion] = useState('')

  // Solo los predios del arrendatario elegido (un predio es de un arrendador).
  const prediosDelArr =
    modoArr === 'existente' && arrId ? (predios ?? []).filter((p) => p.arrendadorId === arrId) : []

  // Un predio tiene UN contrato activo (la renta del predio es una sola). Si el
  // predio elegido ya lo tiene, no se firma otro: la pantalla se cuelga del
  // predio y comparte esa renta con las demás. El wizard omite el paso 2.
  const ESTATUS_ACTIVO = ['VIGENTE', 'POR_VENCER', 'RENOVADO']
  const contratoDelPredio =
    modoPredio === 'existente' && predioId
      ? (contratos ?? []).find((c) => c.predioId === predioId && ESTATUS_ACTIVO.includes(c.estatus))
      : undefined
  const soloPantalla = !!contratoDelPredio
  const pasosVisibles = soloPantalla ? PASOS.filter((p) => p.n !== 2) : PASOS

  // Un arrendatario nuevo no tiene predios: el predio solo puede ser nuevo.
  function onModoArr(m: 'existente' | 'nuevo') {
    setModoArr(m)
    if (m === 'nuevo') { setModoPredio('nuevo'); setPredioId('') }
  }
  function onArrId(id: string) {
    setArrId(id)
    setPredioId('')
    setModoPredio('nuevo')
  }

  // Paso 2 — contrato
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [renta, setRenta] = useState('')
  const [periodicidad, setPeriodicidad] = useState('MENSUAL')
  const [moneda, setMoneda] = useState('MXN')
  const [autoRenovable, setAutoRenovable] = useState(false)
  const [documento, setDocumento] = useState<string | null>(null) // PDF en base64 (data URL)
  const [docNombre, setDocNombre] = useState<string | null>(null)

  // Paso 3 — pantalla: una que el dueño ya tiene en el inventario, o una nueva.
  const [modoPantalla, setModoPantalla] = useState<'inventario' | 'nueva'>('inventario')
  const [sitioSelId, setSitioSelId] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>('ESPECTACULAR')
  const [exhibicion, setExhibicion] = useState<'fijo' | 'digital'>('fijo')
  const [direccion, setDireccion] = useState('')
  const [alcaldia, setAlcaldia] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [caras, setCaras] = useState('')
  const [tarifa, setTarifa] = useState('')
  const [costo, setCosto] = useState('')
  const [totalSpots, setTotalSpots] = useState('')
  const [duracionSpot, setDuracionSpot] = useState('')

  // Cuando el tipo es pantalla digital, la exhibición pasa a digital.
  function onTipo(v: TipoMedio) {
    setTipoMedio(v)
    setExhibicion(v === 'PANTALLA_DIGITAL' ? 'digital' : 'fijo')
  }
  const digital = exhibicion === 'digital' || tipoMedio === 'PANTALLA_DIGITAL'

  // Pantallas del inventario aún sin predio: son las que se pueden asignar a un
  // arrendador. Las que ya tienen predio pertenecen a otro contrato.
  const sitiosLibres = (sitios ?? []).filter((s) => !s.predioId)
  const sitioSel = sitiosLibres.find((s) => s.id === sitioSelId)

  const arrOk = modoArr === 'existente' ? !!arrId : !!arrNombre.trim()
  const predioOk = modoPredio === 'existente' ? !!predioId : !!predioNombre.trim()
  const paso1Ok = arrOk && predioOk
  // Sin contrato que capturar, el paso 2 no aplica.
  const paso2Aplica = !soloPantalla
  const paso2Ok =
    !paso2Aplica ||
    (!!fechaInicio && !!fechaFin && fechaFin >= fechaInicio && renta.trim() !== '' && Number(renta) >= 0)
  const paso3Ok = modoPantalla === 'inventario' ? !!sitioSelId : !!nombre.trim()

  function siguiente() {
    setError(null)
    if (paso === 1 && !arrOk) return setError('Elige un arrendatario existente o captura el nombre de uno nuevo.')
    if (paso === 1 && !predioOk) return setError('Elige el predio del contrato o captura el nombre de uno nuevo.')
    if (paso === 2) {
      if (!fechaInicio || !fechaFin) return setError('Captura el periodo del contrato (inicio y fin).')
      if (fechaFin < fechaInicio) return setError('La fecha de fin no puede ser anterior a la de inicio.')
      if (renta.trim() === '' || Number(renta) < 0) return setError('Captura la renta (no negativa).')
    }
    // El predio ya tiene contrato: no hay nada que capturar en el paso 2.
    setPaso((p) => (p === 1 && !paso2Aplica ? 3 : Math.min(3, p + 1)))
  }
  function atras() {
    setError(null)
    setPaso((p) => (p === 3 && !paso2Aplica ? 1 : Math.max(1, p - 1)))
  }

  // Lee el PDF del contrato como data URL base64 (persiste en documento_url).
  function onDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      toast.error('El documento debe ser un PDF')
      e.target.value = ''
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error('El PDF supera 8 MB')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => { setDocumento(reader.result as string); setDocNombre(f.name) }
    reader.onerror = () => toast.error('No se pudo leer el PDF')
    reader.readAsDataURL(f)
  }
  function quitarDocumento() {
    setDocumento(null)
    setDocNombre(null)
  }

  async function crear() {
    setError(null)
    if (!paso1Ok || !paso2Ok || !paso3Ok) return
    setEnviando(true)
    try {
      const arrendador =
        modoArr === 'existente'
          ? { id: arrId }
          : {
              nombre: arrNombre.trim(),
              rfc: arrRfc.trim() || null,
              telefono: arrTel.trim() || null,
              email: arrEmail.trim() || null,
            }
      const predio =
        modoPredio === 'existente'
          ? { id: predioId }
          : {
              nombre: predioNombre.trim(),
              direccion: predioDireccion.trim() || direccion.trim() || null,
              lat: lat ? Number(lat) : null,
              lng: lng ? Number(lng) : null,
            }
      const delInventario = modoPantalla === 'inventario'
      const nombrePantalla = delInventario ? sitioSel?.nombre ?? '' : nombre.trim()
      // Datos de una pantalla NUEVA. Si viene del inventario no se manda nada de
      // esto: sus datos ya están en la BD y re-mandarlos los sobrescribiría con
      // lo que tenga el formulario.
      const datosSitioNuevo: Record<string, unknown> = {
        nombre: nombre.trim(),
        tipoMedio,
        exhibicion,
        esRotativo: digital,
        direccion: direccion.trim(),
        direccionComercial: direccion.trim(),
        direccionPredio: direccion.trim(),
        alcaldia: alcaldia.trim() || null,
        distrito: alcaldia.trim() || null,
        ciudad: ciudad.trim() || null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        caras: Number(caras) || 1,
        tarifaPublicada: Number(tarifa) || 0,
        costoCompra: Number(costo) || 0,
        estatusComercial: 'DISPONIBLE' as Sitio['estatusComercial'],
        comercializacion: 'TRADICIONAL',
        enNetwork: false,
        cms: null,
        totalSpots: digital ? Number(totalSpots) || 12 : null,
        duracionSpotSeg: digital ? Number(duracionSpot) || 20 : null,
      }
      if (soloPantalla) {
        // El predio ya tiene contrato activo: se cuelga la pantalla y comparte
        // esa renta con las demás del predio. NO se firma un segundo contrato.
        // Esta ruta identifica la pantalla existente por `sitioId`.
        await agregarPantallaAPredioApi(
          predioId,
          delInventario ? { sitioId: sitioSelId } : datosSitioNuevo,
        )
        toast.success('Pantalla agregada al predio')
        onCreado?.({ nombre: nombrePantalla })
        reiniciar()
        return
      }
      await crearContratoConSitioApi({
        arrendador,
        predio,
        contrato: {
          fechaInicio,
          fechaFin,
          montoRenta: Number(renta) || 0,
          periodicidad,
          moneda,
          autoRenovable,
          documentoUrl: documento,
        },
        sitio: delInventario ? { id: sitioSelId } : datosSitioNuevo,
      })
      toast.success(delInventario ? 'Contrato creado y pantalla asignada' : 'Contrato y pantalla creados')
      onCreado?.({ nombre: nombrePantalla })
      reiniciar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el contrato')
    }
    setEnviando(false)
  }

  function reiniciar() {
    setPaso(1)
    setModoArr('existente'); setArrId(''); setArrNombre(''); setArrRfc(''); setArrTel(''); setArrEmail('')
    setModoPredio('nuevo'); setPredioId(''); setPredioNombre(''); setPredioDireccion('')
    setFechaInicio(''); setFechaFin(''); setRenta(''); setPeriodicidad('MENSUAL'); setMoneda('MXN'); setAutoRenovable(false)
    setDocumento(null); setDocNombre(null)
    setModoPantalla('inventario'); setSitioSelId('')
    setNombre(''); setTipoMedio('ESPECTACULAR'); setExhibicion('fijo'); setDireccion(''); setAlcaldia(''); setCiudad('')
    setLat(''); setLng(''); setCaras(''); setTarifa(''); setCosto(''); setTotalSpots(''); setDuracionSpot('')
  }

  return (
    <div className={bare ? '' : 'rounded-md border border-border bg-surface'}>
      {/* Stepper */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {pasosVisibles.map((p, i) => {
          const activo = paso === p.n
          const hecho = paso > p.n
          const Icon = p.icon
          return (
            <div key={p.n} className="flex items-center gap-2">
              <div
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors',
                  activo ? 'bg-accent text-white' : hecho ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted',
                )}
              >
                {hecho ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span>{i + 1}. {p.label}</span>
              </div>
              {i < pasosVisibles.length - 1 && <ChevronRight className="h-4 w-4 text-muted" />}
            </div>
          )
        })}
      </div>

      <div className="p-4">
        {/* ── Paso 1: arrendatario y predio ── */}
        {paso === 1 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">¿A quién le rentas este espacio? Elige un arrendatario ya registrado o da de alta uno nuevo.</p>
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
              <button type="button" onClick={() => onModoArr('existente')}
                className={cn('rounded px-3 py-1.5', modoArr === 'existente' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                Existente
              </button>
              <button type="button" onClick={() => onModoArr('nuevo')}
                className={cn('rounded px-3 py-1.5', modoArr === 'nuevo' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                Nuevo
              </button>
            </div>

            {modoArr === 'existente' ? (
              <Campo label="Arrendatario">
                <select value={arrId} onChange={(e) => onArrId(e.target.value)} className={inputCls}>
                  <option value="">— Selecciona —</option>
                  {(arrendadores ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                {(arrendadores ?? []).length === 0 && (
                  <span className="mt-1 block text-[11px] text-muted">No hay arrendatarios aún. Cambia a “Nuevo” para dar de alta uno.</span>
                )}
              </Campo>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Nombre / razón social"><input value={arrNombre} onChange={(e) => setArrNombre(e.target.value)} className={inputCls} placeholder="Ej. Inmuebles del Centro SA" /></Campo>
                <Campo label="RFC (opcional)"><input value={arrRfc} onChange={(e) => setArrRfc(e.target.value)} className={inputCls} placeholder="XAXX010101000" /></Campo>
                <Campo label="Teléfono (opcional)"><input value={arrTel} onChange={(e) => setArrTel(e.target.value)} className={inputCls} /></Campo>
                <Campo label="Correo (opcional)"><input value={arrEmail} onChange={(e) => setArrEmail(e.target.value)} className={inputCls} type="email" /></Campo>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <p className="text-[13px] text-muted">
                ¿Qué predio se renta? El contrato y la renta pertenecen al predio: si varias pantallas
                están en el mismo predio, elige el que ya existe y la renta se reparte entre ellas.
              </p>
              {prediosDelArr.length > 0 && (
                <div className="mt-2 inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
                  <button type="button" onClick={() => setModoPredio('existente')}
                    className={cn('rounded px-3 py-1.5', modoPredio === 'existente' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                    Predio existente
                  </button>
                  <button type="button" onClick={() => { setModoPredio('nuevo'); setPredioId('') }}
                    className={cn('rounded px-3 py-1.5', modoPredio === 'nuevo' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                    Predio nuevo
                  </button>
                </div>
              )}

              {modoPredio === 'existente' ? (
                <div className="mt-3">
                  <Campo label="Predio">
                    <select value={predioId} onChange={(e) => setPredioId(e.target.value)} className={inputCls}>
                      <option value="">— Selecciona —</option>
                      {prediosDelArr.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}{p.direccion ? ` — ${p.direccion}` : ''}</option>
                      ))}
                    </select>
                  </Campo>
                  {contratoDelPredio && (
                    <p className="mt-2 rounded border border-info/30 bg-info/10 p-2 text-[12px] text-ink">
                      Este predio ya tiene un contrato vigente de{' '}
                      <strong>{formatMonto(contratoDelPredio.montoRenta)}</strong>{' '}
                      ({periodicidadLabel(contratoDelPredio.periodicidad)}). No se firma otro: la pantalla se agrega al
                      predio y comparte esa renta con las demás. Para cambiar la renta, edita el contrato.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Nombre del predio">
                    <input value={predioNombre} onChange={(e) => setPredioNombre(e.target.value)} className={inputCls} placeholder="Ej. Azotea Reforma 222" />
                  </Campo>
                  <Campo label="Dirección del predio (opcional)">
                    <input value={predioDireccion} onChange={(e) => setPredioDireccion(e.target.value)} className={inputCls} placeholder="Se toma la de la pantalla si lo dejas vacío" />
                  </Campo>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Paso 2: contrato ── */}
        {paso === 2 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">
              Condiciones del arrendamiento. <span className="text-ink">Puedes usar fechas pasadas</span> para registrar contratos ya firmados.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Inicio de vigencia"><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} /></Campo>
              <Campo label="Fin de vigencia"><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inputCls} /></Campo>
              <Campo label="Renta">
                <input type="number" inputMode="decimal" value={renta} onChange={(e) => setRenta(e.target.value)} className={`demo-num ${inputCls}`} placeholder="Ej. 8000" />
              </Campo>
              <Campo label="Periodicidad del pago">
                <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)} className={inputCls}>
                  {PERIODICIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </Campo>
              <Campo label="Moneda">
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={inputCls}>
                  <option value="MXN">MXN (peso mexicano)</option>
                  <option value="USD">USD (dólar)</option>
                </select>
              </Campo>
              <label className="mt-6 inline-flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={autoRenovable} onChange={(e) => setAutoRenovable(e.target.checked)} />
                Renovación automática
              </label>
            </div>

            {/* Documento del contrato (PDF firmado) */}
            <Campo label="Documento del contrato (PDF, opcional)">
              {documento ? (
                <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-3 py-2 text-[13px]">
                  <FileText className="h-4 w-4 shrink-0 text-info" />
                  <span className="min-w-0 flex-1 truncate text-ink">{docNombre}</span>
                  <button type="button" onClick={quitarDocumento} title="Quitar" className="shrink-0 text-muted hover:text-error">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-border-strong bg-surface px-3 py-2 text-[13px] text-muted hover:border-accent hover:text-ink">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span>Adjuntar PDF del contrato firmado (máx. 8 MB)</span>
                  <input type="file" accept="application/pdf" onChange={onDocumento} className="hidden" />
                </label>
              )}
            </Campo>
          </div>
        )}

        {/* ── Paso 3: pantalla ── */}
        {paso === 3 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">
              ¿Qué pantalla ampara este contrato? Si ya está en tu inventario, elígela y no captures
              nada: se le asigna el arrendatario y el predio.
            </p>
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
              <button type="button" onClick={() => setModoPantalla('inventario')}
                className={cn('rounded px-3 py-1.5', modoPantalla === 'inventario' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                Del inventario
              </button>
              <button type="button" onClick={() => { setModoPantalla('nueva'); setSitioSelId('') }}
                className={cn('rounded px-3 py-1.5', modoPantalla === 'nueva' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                Pantalla nueva
              </button>
            </div>

            {modoPantalla === 'inventario' && (
              <div className="space-y-3">
                <Campo label={`Pantalla (${sitiosLibres.length} sin arrendatario)`}>
                  <select value={sitioSelId} onChange={(e) => setSitioSelId(e.target.value)} className={inputCls}>
                    <option value="">— Selecciona —</option>
                    {sitiosLibres.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{medioLabel(s)}] {s.nombre}{s.alcaldia ? ` — ${s.alcaldia}` : ''}
                      </option>
                    ))}
                  </select>
                  {sitiosLibres.length === 0 && (
                    <span className="mt-1 block text-[11px] text-muted">
                      Todas tus pantallas ya están asignadas a un predio. Cambia a “Pantalla nueva”.
                    </span>
                  )}
                </Campo>

                {/* Lo que ya se sabe de la pantalla: no se re-captura. */}
                {sitioSel && (
                  <div className="rounded-md border border-border bg-surface-2 p-3">
                    <div className="mb-2 text-[12px] font-medium text-ink">Datos que ya tiene</div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                      <Dato label="Tipo" valor={TIPO_PANTALLA.find((t) => t.v === sitioSel.tipoMedio)?.label ?? sitioSel.tipoMedio} />
                      <Dato label="Medio" valor={medioLabel(sitioSel)} />
                      <Dato label="Caras" valor={String(sitioSel.caras ?? 1)} />
                      <Dato label="Ubicación" valor={[sitioSel.alcaldia, sitioSel.ciudad].filter(Boolean).join(', ') || '—'} />
                      <Dato label="Tarifa publicada" valor={sitioSel.tarifaPublicada ? formatMonto(sitioSel.tarifaPublicada) : '—'} />
                      <Dato label="Dirección" valor={sitioSel.direccionPredio || sitioSel.direccion || '—'} ancho />
                    </dl>
                    <p className="mt-2 text-[11px] text-muted">
                      Se ligará al predio del contrato. Para cambiar estos datos, edita la pantalla en Inventario.
                    </p>
                  </div>
                )}
              </div>
            )}

            {modoPantalla === 'nueva' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Nombre de la pantalla"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} placeholder="Ej. Patriotismo y Pensilvania" /></Campo>
              <Campo label="Tipo de medio">
                <select value={tipoMedio} onChange={(e) => onTipo(e.target.value as TipoMedio)} className={inputCls}>
                  {TIPO_PANTALLA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </Campo>
              <Campo label="Dirección"><input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} /></Campo>
              <Campo label="Distrito / alcaldía"><input value={alcaldia} onChange={(e) => setAlcaldia(e.target.value)} className={inputCls} /></Campo>
              <Campo label="Ciudad"><input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputCls} /></Campo>
              <Campo label="Caras"><input type="number" inputMode="numeric" min={1} value={caras} onChange={(e) => setCaras(e.target.value)} className={`demo-num ${inputCls}`} placeholder="1" /></Campo>
              <Campo label="Tarifa publicada"><input type="number" inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className={`demo-num ${inputCls}`} placeholder="Ej. 15000" /></Campo>
              <Campo label="Costo de compra"><input type="number" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} className={`demo-num ${inputCls}`} placeholder="Ej. 9000" /></Campo>
              <Campo label="Lat (opcional)"><input value={lat} onChange={(e) => setLat(e.target.value)} className={`demo-num ${inputCls}`} placeholder="19.4326" /></Campo>
              <Campo label="Lng (opcional)"><input value={lng} onChange={(e) => setLng(e.target.value)} className={`demo-num ${inputCls}`} placeholder="-99.1332" /></Campo>
              {digital && (
                <>
                  <Campo label="Slots (digital)"><input type="number" inputMode="numeric" min={0} value={totalSpots} onChange={(e) => setTotalSpots(e.target.value)} className={`demo-num ${inputCls}`} placeholder="12" /></Campo>
                  <Campo label="Duración por slot (s)"><input type="number" inputMode="numeric" min={0} value={duracionSpot} onChange={(e) => setDuracionSpot(e.target.value)} className={`demo-num ${inputCls}`} placeholder="20" /></Campo>
                </>
              )}
            </div>
            )}

            {/* Resumen */}
            <div className="mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
              {soloPantalla ? (
                <>
                  La pantalla “{modoPantalla === 'inventario' ? sitioSel?.nombre ?? '—' : nombre || '—'}” se agregará
                  al predio, que ya tiene contrato vigente. Su renta se repartirá entre las pantallas del predio.
                </>
              ) : (
                <>
                  Se creará el contrato ({fechaInicio || '—'} → {fechaFin || '—'}, renta{' '}
                  {renta ? formatMonto(Number(renta)) : '—'} {periodicidad.toLowerCase()}) y se{' '}
                  {modoPantalla === 'inventario' ? 'asignará la pantalla' : 'creará la pantalla'} “
                  {modoPantalla === 'inventario' ? sitioSel?.nombre ?? '—' : nombre || '—'}”, todo vinculado al arrendatario.
                </>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[12px] text-error">{error}</p>}

        {/* Navegación */}
        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={atras} disabled={paso === 1 || enviando}>
            <ChevronLeft className="h-4 w-4" /> Atrás
          </Button>
          {paso < 3 ? (
            <Button size="sm" onClick={siguiente} disabled={(paso === 1 && !paso1Ok) || (paso === 2 && !paso2Ok)}>
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={crear} disabled={enviando || !paso3Ok}>
              {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><Check className="h-4 w-4" /> Crear contrato y pantalla</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

// Dato de solo lectura de una pantalla ya existente (no se re-captura).
function Dato({ label, valor, ancho = false }: { label: string; valor: string; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : undefined}>
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-ink">{valor}</dd>
    </div>
  )
}
