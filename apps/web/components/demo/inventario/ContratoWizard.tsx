'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { UserRound, FileText, Monitor, Check, ChevronLeft, ChevronRight, Loader2, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { crearContratoConSitioApi } from '@/lib/data/estado-api'
import { useArrendadores, formatMonto, type TipoMedio, type Sitio } from '@/lib/data/client'

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

const PASOS = [
  { n: 1, label: 'Arrendatario', icon: UserRound },
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

  // Paso 2 — contrato
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [renta, setRenta] = useState('')
  const [periodicidad, setPeriodicidad] = useState('MENSUAL')
  const [moneda, setMoneda] = useState('MXN')
  const [autoRenovable, setAutoRenovable] = useState(false)
  const [documento, setDocumento] = useState<string | null>(null) // PDF en base64 (data URL)
  const [docNombre, setDocNombre] = useState<string | null>(null)

  // Paso 3 — pantalla
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

  const paso1Ok =
    modoArr === 'existente' ? !!arrId : !!arrNombre.trim()
  const paso2Ok =
    !!fechaInicio && !!fechaFin && fechaFin >= fechaInicio && renta.trim() !== '' && Number(renta) >= 0
  const paso3Ok = !!nombre.trim()

  function siguiente() {
    setError(null)
    if (paso === 1 && !paso1Ok) return setError('Elige un arrendatario existente o captura el nombre de uno nuevo.')
    if (paso === 2) {
      if (!fechaInicio || !fechaFin) return setError('Captura el periodo del contrato (inicio y fin).')
      if (fechaFin < fechaInicio) return setError('La fecha de fin no puede ser anterior a la de inicio.')
      if (renta.trim() === '' || Number(renta) < 0) return setError('Captura la renta (no negativa).')
    }
    setPaso((p) => Math.min(3, p + 1))
  }
  function atras() {
    setError(null)
    setPaso((p) => Math.max(1, p - 1))
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
      await crearContratoConSitioApi({
        arrendador,
        contrato: {
          fechaInicio,
          fechaFin,
          montoRenta: Number(renta) || 0,
          periodicidad,
          moneda,
          autoRenovable,
          documentoUrl: documento,
        },
        sitio: {
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
        },
      })
      toast.success('Contrato y pantalla creados')
      onCreado?.({ nombre: nombre.trim() })
      reiniciar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el contrato')
    }
    setEnviando(false)
  }

  function reiniciar() {
    setPaso(1)
    setModoArr('existente'); setArrId(''); setArrNombre(''); setArrRfc(''); setArrTel(''); setArrEmail('')
    setFechaInicio(''); setFechaFin(''); setRenta(''); setPeriodicidad('MENSUAL'); setMoneda('MXN'); setAutoRenovable(false)
    setDocumento(null); setDocNombre(null)
    setNombre(''); setTipoMedio('ESPECTACULAR'); setExhibicion('fijo'); setDireccion(''); setAlcaldia(''); setCiudad('')
    setLat(''); setLng(''); setCaras(''); setTarifa(''); setCosto(''); setTotalSpots(''); setDuracionSpot('')
  }

  return (
    <div className={bare ? '' : 'rounded-md border border-border bg-surface'}>
      {/* Stepper */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {PASOS.map((p, i) => {
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
                <span>{p.n}. {p.label}</span>
              </div>
              {i < PASOS.length - 1 && <ChevronRight className="h-4 w-4 text-muted" />}
            </div>
          )
        })}
      </div>

      <div className="p-4">
        {/* ── Paso 1: arrendatario ── */}
        {paso === 1 && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">¿A quién le rentas este espacio? Elige un arrendatario ya registrado o da de alta uno nuevo.</p>
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
              <button type="button" onClick={() => setModoArr('existente')}
                className={cn('rounded px-3 py-1.5', modoArr === 'existente' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                Existente
              </button>
              <button type="button" onClick={() => setModoArr('nuevo')}
                className={cn('rounded px-3 py-1.5', modoArr === 'nuevo' ? 'bg-surface-2 font-medium text-ink' : 'text-muted')}>
                Nuevo
              </button>
            </div>

            {modoArr === 'existente' ? (
              <Campo label="Arrendatario">
                <select value={arrId} onChange={(e) => setArrId(e.target.value)} className={inputCls}>
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
            <p className="text-[13px] text-muted">Datos del inventario que ampara este contrato (pantalla o espectacular).</p>
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

            {/* Resumen */}
            <div className="mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
              Se creará el contrato ({fechaInicio || '—'} → {fechaFin || '—'}, renta {renta ? formatMonto(Number(renta)) : '—'} {periodicidad.toLowerCase()})
              y la pantalla “{nombre || '—'}”, ambos vinculados al arrendatario.
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
