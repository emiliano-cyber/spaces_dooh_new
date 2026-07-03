'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { InlinePanel } from '@/components/demo/ui/InlinePanel'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { altaSitioApi } from '@/lib/data/sitios-api'
import { type Sitio, type TipoMedio } from '@/lib/data/client'

// Formulario manual de "Nueva pantalla" con 5 tabs (Básico, Especificaciones,
// IA/Vision, Precios, Imágenes). Crea la pantalla vía data.altaSitio.

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Imagen de muestra de la detección por Computer Vision (vive en /public; el
// basePath /spaces-dooh la sirve aquí). Solo se usa en el demo.
const IA_DEMO_IMG = '/spaces-dooh/demo/ia-deteccion.jpg'

// Tipos de la lista validada (parabús/mupi/publitienda → mobiliario urbano).
const TIPO_PANTALLA: { v: TipoMedio; label: string }[] = [
  { v: 'ESPECTACULAR', label: 'Espectacular' },
  { v: 'MURAL', label: 'Muro' },
  { v: 'VALLA', label: 'Valla' },
  { v: 'MOBILIARIO_URBANO', label: 'Mobiliario urbano (parabús/mupi/publitienda)' },
  { v: 'PUENTE_PEATONAL', label: 'Puente' },
  { v: 'OTRO', label: 'Otro' },
]
const ESTADOS: { v: Sitio['estatusComercial']; label: string }[] = [
  { v: 'DISPONIBLE', label: 'Disponible' },
  { v: 'OCUPADO', label: 'Ocupada' },
  { v: 'EN_MANTENIMIENTO', label: 'Mantenimiento' },
]
// El alta manual crea pantallas fijas → solo se comercializan por periodo:
// mensual o catorcenal (misma regla que la importación).
const MODALIDADES = ['Mensual', 'Catorcenal']

export function NuevaPantallaForm({
  open,
  onOpenChange,
  onCreado,
  inline = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreado: (s: Sitio) => void
  // En `inline` se renderiza dentro de la página (sin modal/overlay).
  inline?: boolean
}) {
  // Tab 1
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>('ESPECTACULAR')
  const [exhibicion, setExhibicion] = useState<'fijo' | 'digital'>('fijo')
  const [estado, setEstado] = useState<Sitio['estatusComercial']>('DISPONIBLE')
  // Tab 2
  const [resAncho, setResAncho] = useState('')
  const [resAlto, setResAlto] = useState('')
  const [caras, setCaras] = useState('')
  const [modalidades, setModalidades] = useState<string[]>(['Mensual'])
  const [duracionSpot, setDuracionSpot] = useState('')
  const [totalSpots, setTotalSpots] = useState('')
  const [spotsDisp, setSpotsDisp] = useState('')
  // Tab 3
  const [cv, setCv] = useState(false)
  const [admobilizeId, setAdmobilizeId] = useState('')
  const [verIA, setVerIA] = useState(false)
  // Tab 4
  const [tarifa, setTarifa] = useState('')
  const [costo, setCosto] = useState('')
  const [precioM2, setPrecioM2] = useState('')
  // Tab 5
  const [imagen, setImagen] = useState<string | null>(null)
  const [imagenNombre, setImagenNombre] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cvInvalido = cv && !admobilizeId.trim()
  // Para el alta de UNA sola pantalla, la imagen promocional es obligatoria.
  const valido = !!nombre.trim() && !cvInvalido && !!imagen

  function toggleModalidad(m: string) {
    setModalidades((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }
  function onImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB')
      return
    }
    // Se guarda como data URL (base64), NO como blob URL: el blob solo vive en
    // esta pestaña y desaparecería al recargar. El base64 persiste en la BD.
    const reader = new FileReader()
    reader.onload = () => {
      setImagen(reader.result as string)
      setImagenNombre(f.name)
    }
    reader.onerror = () => toast.error('No se pudo leer la imagen')
    reader.readAsDataURL(f)
  }

  async function submit() {
    if (!valido) return
    setEnviando(true)
    const digital = exhibicion === 'digital'
    const s = await altaSitioApi({
      nombre: nombre.trim(),
      tipoMedio,
      exhibicion,
      esRotativo: digital,
      direccionPredio: direccion.trim(),
      direccionComercial: direccion.trim(),
      distrito: '',
      lat: Number(lat) || 19.4326,
      lng: Number(lng) || -99.1332,
      ancho: 12.9,
      alto: 7.2,
      iluminado: true,
      tarifaPublicada: Number(tarifa) || 0,
      comercializacion: 'TRADICIONAL',
      enNetwork: false,
      cms: null,
      resolucionPx: resAncho && resAlto ? `${resAncho}x${resAlto}` : '',
      tipoContenido: null,
      estatusComercial: estado,
      costoCompra: Number(costo) || 0,
      caras: Number(caras) || 1,
      modalidades,
      duracionSpotSeg: Number(duracionSpot) || (digital ? 20 : null),
      totalSpots: Number(totalSpots) || (digital ? 12 : null),
      spotsDisponibles: Number(spotsDisp) || (digital ? 12 : null),
      computerVision: cv,
      admobilizeId: cv ? admobilizeId.trim() : null,
      precioM2: precioM2 ? Number(precioM2) : null,
      imagenPromocional: imagen,
    })
    setEnviando(false)
    onCreado(s)
    onOpenChange(false)
  }

  const footer = (
    <div className="flex items-center justify-between">
      {cvInvalido ? (
        <span className="text-[12px] text-error">ID AdMobilize requerido</span>
      ) : !imagen ? (
        <span className="text-[12px] text-error">Imagen obligatoria (pestaña Imágenes)</span>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        {!inline && (
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
        )}
        <Button size="sm" disabled={!valido || enviando} onClick={submit}>
          {enviando ? 'Guardando…' : 'Guardar pantalla'}
        </Button>
      </div>
    </div>
  )
  const cuerpo = (
    <div className={inline ? 'pr-1' : 'max-h-[62vh] overflow-y-auto pr-1'}>
        <Tabs
          defaultValue="basico"
          tabs={[
            { value: 'basico', label: 'Básico' },
            { value: 'specs', label: 'Especificaciones' },
            { value: 'ia', label: 'IA/Vision' },
            { value: 'precios', label: 'Precios' },
            { value: 'imagenes', label: 'Imágenes' },
          ]}
        >
          <TabPanel value="basico" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Información básica</h3>
            <Campo label="Nombre de la pantalla">
              <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </Campo>
            <Campo label="Dirección">
              <input className={inputCls} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </Campo>
            <Campo label="Exhibición">
              <select className={inputCls} value={exhibicion} onChange={(e) => setExhibicion(e.target.value as 'fijo' | 'digital')}>
                <option value="fijo">Fija (impresa)</option>
                <option value="digital">Digital (pantalla)</option>
              </select>
              <span className="mt-1 block text-[11px] text-muted">
                {exhibicion === 'digital'
                  ? 'Pantalla digital: se comercializa por slots (ver pestaña Especificaciones).'
                  : 'Pantalla fija: se imprime y se comercializa por periodo.'}
              </span>
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Latitud"><input className={inputCls} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Ej. 19.4326" /></Campo>
              <Campo label="Longitud"><input className={inputCls} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Ej. -99.1332" /></Campo>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Tipo de pantalla">
                <select className={inputCls} value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value as TipoMedio)}>
                  {TIPO_PANTALLA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </Campo>
              <Campo label="Estado">
                <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as Sitio['estatusComercial'])}>
                  {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
                </select>
              </Campo>
            </div>
          </TabPanel>

          <TabPanel value="specs" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Especificaciones técnicas</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Resolución ancho (px)"><input className={inputCls} inputMode="numeric" value={resAncho} onChange={(e) => setResAncho(e.target.value)} placeholder="Ej. 1920" /></Campo>
              <Campo label="Resolución alto (px)"><input className={inputCls} inputMode="numeric" value={resAlto} onChange={(e) => setResAlto(e.target.value)} placeholder="Ej. 1080" /></Campo>
            </div>
            <Campo label="Caras"><input className={inputCls} inputMode="numeric" value={caras} onChange={(e) => setCaras(e.target.value)} placeholder="Ej. 1" /></Campo>
            <div>
              <span className="mb-1 block text-[12px] font-medium text-ink">Modalidades de contratación</span>
              <div className="grid grid-cols-2 gap-1.5">
                {MODALIDADES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-[13px] text-ink">
                    <input type="checkbox" checked={modalidades.includes(m)} onChange={() => toggleModalidad(m)} className="h-4 w-4 accent-[var(--accent)]" />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <div className="mb-2 text-[12px] font-medium text-ink">Configuración de slots</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo label="Duración por slot (s)"><input className={inputCls} inputMode="numeric" value={duracionSpot} onChange={(e) => setDuracionSpot(e.target.value)} placeholder="Ej. 20" /></Campo>
                <Campo label="Total slots"><input className={inputCls} inputMode="numeric" value={totalSpots} onChange={(e) => setTotalSpots(e.target.value)} placeholder="Ej. 12" /></Campo>
                <Campo label="Slots disponibles"><input className={inputCls} inputMode="numeric" value={spotsDisp} onChange={(e) => setSpotsDisp(e.target.value)} placeholder="Ej. 12" /></Campo>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="ia" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Computer Vision / AdMobilize</h3>
            <div className="rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] p-3 text-[12px] text-muted">
              <b className="text-info">AdMobilize</b> permite detectar y contabilizar vehículos y
              personas que pasan frente a la pantalla utilizando tecnología de Computer Vision.
            </div>
            <div className="rounded-md border border-border p-3">
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={cv} onChange={(e) => setCv(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                <span>
                  Esta pantalla cuenta con tecnología de Computer Vision (IA)
                  <span className="block text-[12px] text-muted">Actívala si tu pantalla usa AdMobilize para el conteo de audiencia</span>
                </span>
              </label>
            </div>
            {cv && (
              <>
                <Campo label="ID del dispositivo AdMobilize">
                  <input className={cn(inputCls, cvInvalido && 'border-error')} value={admobilizeId} onChange={(e) => setAdmobilizeId(e.target.value)} placeholder="p. ej. ADM-00123" />
                  <span className="mt-1 block text-[11px] text-muted">Identificador único del dispositivo instalado en esta pantalla.</span>
                </Campo>
                <div className="rounded-md border border-border p-3">
                  <div className="mb-2 text-[12px] font-medium text-ink">Vista de detección en vivo</div>
                  <p className="mb-2 text-[11px] text-muted">
                    Vista previa de la detección de vehículos y personas por Computer Vision.
                  </p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setVerIA(true)}>
                    <Eye className="h-4 w-4" /> Ver imagen de detección IA
                  </Button>
                </div>
              </>
            )}
          </TabPanel>

          <TabPanel value="precios" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Precios</h3>
            <Campo label="Tarifa publicada"><input className={inputCls} inputMode="numeric" value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="Ej. 15000" /></Campo>
            <Campo label="Costo de compra"><input className={inputCls} inputMode="numeric" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Ej. 9000" /></Campo>
            <Campo label="Precio por m² (estáticas)">
              <input className={inputCls} value={precioM2} onChange={(e) => setPrecioM2(e.target.value)} placeholder="Se aplica a las estáticas del lote" />
            </Campo>
          </TabPanel>

          <TabPanel value="imagenes" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Imágenes</h3>
            <span className="block text-[12px] font-medium text-ink">
              Imagen promocional <span className="text-error">*</span>
            </span>
            <p className="text-[11px] text-muted">Obligatoria · JPG o PNG · máximo 5MB</p>
            {imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen} alt="preview" className="max-h-48 w-full rounded border border-border object-contain" />
            )}
            {imagenNombre && <p className="demo-num text-[11px] text-muted">{imagenNombre}</p>}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-border-strong px-3 py-2 text-[13px] text-ink hover:bg-surface-2">
              {imagen ? 'Cambiar imagen' : 'Subir imagen'}
              <input type="file" accept="image/jpeg,image/png" onChange={onImagen} className="hidden" />
            </label>
          </TabPanel>
        </Tabs>
      </div>
  )

  // Visor de la imagen de detección IA (se monta en ambos modos).
  const iaViewer = (
    <Modal
      open={verIA}
      onOpenChange={setVerIA}
      size="xl"
      title="Detección por Computer Vision"
      subtitle="Vista de muestra del conteo de vehículos y personas (AdMobilize)"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IA_DEMO_IMG}
        alt="Detección de vehículos y personas por IA"
        className="w-full rounded border border-border object-contain"
      />
      <p className="mt-2 text-[11px] text-muted">
        Las cajas y métricas (velocidad, conteo por zona) las genera el módulo de Computer Vision en tiempo real.
      </p>
    </Modal>
  )

  if (inline) {
    return (
      <>
        <InlinePanel title="Nueva pantalla" subtitle="Alta manual de una sola pantalla" footer={footer}>
          {cuerpo}
        </InlinePanel>
        {iaViewer}
      </>
    )
  }
  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title="Nueva pantalla"
        subtitle="Alta manual de una sola pantalla"
        footer={footer}
      >
        {cuerpo}
      </Modal>
      {iaViewer}
    </>
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
