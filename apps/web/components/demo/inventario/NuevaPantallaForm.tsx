'use client'

import { useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { data, type Sitio, type TipoMedio } from '@/lib/data/client'

// Formulario manual de "Nueva pantalla" con 5 tabs (Básico, Especificaciones,
// IA/Vision, Precios, Imágenes). Crea la pantalla vía data.altaSitio.

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

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
const MODALIDADES = ['Mensual', 'Catorcenal', 'Semanal', 'Por Día', 'Por Spot', 'Por Hora']

export function NuevaPantallaForm({
  open,
  onOpenChange,
  onCreado,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreado: (s: Sitio) => void
}) {
  // Tab 1
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [lat, setLat] = useState('19.4326')
  const [lng, setLng] = useState('-99.1332')
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>('ESPECTACULAR')
  const [estado, setEstado] = useState<Sitio['estatusComercial']>('DISPONIBLE')
  // Tab 2
  const [resAncho, setResAncho] = useState('1920')
  const [resAlto, setResAlto] = useState('1080')
  const [caras, setCaras] = useState('1')
  const [modalidades, setModalidades] = useState<string[]>(['Mensual'])
  const [duracionSpot, setDuracionSpot] = useState('10')
  const [totalSpots, setTotalSpots] = useState('100')
  const [spotsDisp, setSpotsDisp] = useState('85')
  // Tab 3
  const [cv, setCv] = useState(false)
  const [admobilizeId, setAdmobilizeId] = useState('')
  // Tab 4
  const [tarifa, setTarifa] = useState('15000')
  const [costo, setCosto] = useState('9000')
  const [precioM2, setPrecioM2] = useState('')
  // Tab 5
  const [imagen, setImagen] = useState<string | null>(null)
  const [imagenNombre, setImagenNombre] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cvInvalido = cv && !admobilizeId.trim()
  const valido = nombre.trim() && !cvInvalido

  function toggleModalidad(m: string) {
    setModalidades((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }
  function onImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      alert('La imagen supera 5MB')
      return
    }
    setImagen(URL.createObjectURL(f))
    setImagenNombre(f.name)
  }

  async function submit() {
    if (!valido) return
    setEnviando(true)
    const s = await data.altaSitio({
      nombre: nombre.trim(),
      tipoMedio,
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
      resolucionPx: `${resAncho}x${resAlto}`,
      tipoContenido: null,
      estatusComercial: estado,
      costoCompra: Number(costo) || 0,
      caras: Number(caras) || 1,
      modalidades,
      duracionSpotSeg: Number(duracionSpot) || null,
      totalSpots: Number(totalSpots) || null,
      spotsDisponibles: Number(spotsDisp) || null,
      computerVision: cv,
      admobilizeId: cv ? admobilizeId.trim() : null,
      precioM2: precioM2 ? Number(precioM2) : null,
      imagenPromocional: imagen,
    })
    setEnviando(false)
    onCreado(s)
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva pantalla"
      subtitle="Alta manual de una sola pantalla"
      footer={
        <div className="flex items-center justify-between">
          {cvInvalido ? (
            <span className="text-[12px] text-error">ID AdMobilize requerido</span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" disabled={!valido || enviando} onClick={submit}>
              {enviando ? 'Guardando…' : 'Guardar pantalla'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-h-[62vh] overflow-y-auto pr-1">
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
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Latitud"><input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} /></Campo>
              <Campo label="Longitud"><input className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Resolución ancho (px)"><input className={inputCls} value={resAncho} onChange={(e) => setResAncho(e.target.value)} /></Campo>
              <Campo label="Resolución alto (px)"><input className={inputCls} value={resAlto} onChange={(e) => setResAlto(e.target.value)} /></Campo>
            </div>
            <Campo label="Caras"><input className={inputCls} value={caras} onChange={(e) => setCaras(e.target.value)} /></Campo>
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
              <div className="mb-2 text-[12px] font-medium text-ink">Configuración de spots</div>
              <div className="grid grid-cols-3 gap-3">
                <Campo label="Duración spot (s)"><input className={inputCls} value={duracionSpot} onChange={(e) => setDuracionSpot(e.target.value)} /></Campo>
                <Campo label="Total spots"><input className={inputCls} value={totalSpots} onChange={(e) => setTotalSpots(e.target.value)} /></Campo>
                <Campo label="Disponibles"><input className={inputCls} value={spotsDisp} onChange={(e) => setSpotsDisp(e.target.value)} /></Campo>
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
              <Campo label="ID del dispositivo AdMobilize">
                <input className={cn(inputCls, cvInvalido && 'border-error')} value={admobilizeId} onChange={(e) => setAdmobilizeId(e.target.value)} placeholder="p. ej. ADM-00123" />
                <span className="mt-1 block text-[11px] text-muted">Identificador único del dispositivo instalado en esta pantalla.</span>
              </Campo>
            )}
          </TabPanel>

          <TabPanel value="precios" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Precios</h3>
            <Campo label="Tarifa publicada"><input className={inputCls} value={tarifa} onChange={(e) => setTarifa(e.target.value)} /></Campo>
            <Campo label="Costo de compra"><input className={inputCls} value={costo} onChange={(e) => setCosto(e.target.value)} /></Campo>
            <Campo label="Precio por m² (estáticas)">
              <input className={inputCls} value={precioM2} onChange={(e) => setPrecioM2(e.target.value)} placeholder="Se aplica a las estáticas del lote" />
            </Campo>
          </TabPanel>

          <TabPanel value="imagenes" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Imágenes</h3>
            <span className="block text-[12px] font-medium text-ink">Imagen promocional</span>
            <p className="text-[11px] text-muted">JPG o PNG · máximo 5MB</p>
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
    </Modal>
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
