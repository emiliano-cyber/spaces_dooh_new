'use client'

import { useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import {
  data,
  type Sitio,
  type TipoMedio,
  type Comercializacion,
  type CMS,
  type TipoContenido,
} from '@/lib/data/client'

// Alta de inventario (puntos 4, 6 y 7 de la reunión). Captura ubicación,
// características físicas, datos DOOH y la regla de comercialización; crea la
// pantalla en el inventario en vivo (aparece en mapa y lista como disponible).

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const TIPOS: { v: TipoMedio; label: string }[] = [
  { v: 'ESPECTACULAR', label: 'Espectacular' },
  { v: 'PANTALLA_DIGITAL', label: 'Pantalla digital' },
  { v: 'VALLA', label: 'Valla' },
  { v: 'MOBILIARIO_URBANO', label: 'Mobiliario urbano' },
  { v: 'PUENTE_PEATONAL', label: 'Puente peatonal' },
  { v: 'MURAL', label: 'Mural' },
  { v: 'OTRO', label: 'Otro' },
]
const CMS_OPC: { v: CMS; label: string }[] = [
  { v: 'BROADSIGN', label: 'Broadsign' },
  { v: 'INVIDIS', label: 'Invidis' },
  { v: 'DOOHMAIN', label: 'Doohmain' },
  { v: 'OTRO', label: 'Otros' },
]

export function AltaSitioDialog({
  open,
  onOpenChange,
  onCreado,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreado: (s: Sitio) => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>('ESPECTACULAR')
  const [distrito, setDistrito] = useState('')
  const [direccionPredio, setDireccionPredio] = useState('')
  const [direccionComercial, setDireccionComercial] = useState('')
  const [lat, setLat] = useState('-12.0900')
  const [lng, setLng] = useState('-77.0400')
  const [ancho, setAncho] = useState('12.9')
  const [alto, setAlto] = useState('7.2')
  const [iluminado, setIluminado] = useState(true)
  const [tarifa, setTarifa] = useState('15000')
  const [comercializacion, setComercializacion] = useState<Comercializacion>('TRADICIONAL')
  const [enNetwork, setEnNetwork] = useState(false)
  const [cms, setCms] = useState<CMS>('DOOHMAIN')
  const [resolucionPx, setResolucionPx] = useState('1920x1080')
  const [tipoContenido, setTipoContenido] = useState<TipoContenido>('VIDEO')
  const [enviando, setEnviando] = useState(false)

  const digital = tipoMedio === 'PANTALLA_DIGITAL'
  const valido = nombre.trim() && distrito.trim() && direccionComercial.trim()

  async function submit() {
    if (!valido) return
    setEnviando(true)
    const s = await data.altaSitio({
      nombre: nombre.trim(),
      tipoMedio,
      distrito: distrito.trim(),
      direccionPredio: direccionPredio.trim() || direccionComercial.trim(),
      direccionComercial: direccionComercial.trim(),
      lat: Number(lat) || -12.09,
      lng: Number(lng) || -77.04,
      ancho: Number(ancho) || 0,
      alto: Number(alto) || 0,
      iluminado,
      tarifaPublicada: Number(tarifa) || 0,
      comercializacion,
      enNetwork,
      cms: digital ? cms : null,
      resolucionPx: digital ? resolucionPx.trim() || null : null,
      tipoContenido: digital ? tipoContenido : null,
    })
    setEnviando(false)
    onCreado(s)
    onOpenChange(false)
    setNombre('')
    setDistrito('')
    setDireccionPredio('')
    setDireccionComercial('')
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Alta de pantalla"
      subtitle="Registra una nueva ubicación en tu inventario"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!valido || enviando} onClick={submit}>
            {enviando ? 'Creando…' : 'Crear pantalla'}
          </Button>
        </div>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <Seccion titulo="Identificación">
          <Campo label="Nombre">
            <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="p. ej. Espectacular Av. Brasil" autoFocus />
          </Campo>
          <Campo label="Tipo / formato">
            <select className={inputCls} value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value as TipoMedio)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </Campo>
        </Seccion>

        <Seccion titulo="Ubicación">
          <Campo label="Distrito / plaza">
            <input className={inputCls} value={distrito} onChange={(e) => setDistrito(e.target.value)} placeholder="p. ej. Miraflores" />
          </Campo>
          <Campo label="Dirección del predio">
            <input className={inputCls} value={direccionPredio} onChange={(e) => setDireccionPredio(e.target.value)} placeholder="Dirección física" />
          </Campo>
          <Campo label="Dirección comercial">
            <input className={inputCls} value={direccionComercial} onChange={(e) => setDireccionComercial(e.target.value)} placeholder="Dirección que se muestra" />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Latitud"><input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} /></Campo>
            <Campo label="Longitud"><input className={inputCls} value={lng} onChange={(e) => setLng(e.target.value)} /></Campo>
          </div>
        </Seccion>

        <Seccion titulo="Características del espacio">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Ancho (m)"><input className={inputCls} value={ancho} onChange={(e) => setAncho(e.target.value)} /></Campo>
            <Campo label="Alto (m)"><input className={inputCls} value={alto} onChange={(e) => setAlto(e.target.value)} /></Campo>
          </div>
          {digital && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Resolución (px)"><input className={inputCls} value={resolucionPx} onChange={(e) => setResolucionPx(e.target.value)} placeholder="1920x1080" /></Campo>
              <Campo label="Tipo de contenido">
                <select className={inputCls} value={tipoContenido} onChange={(e) => setTipoContenido(e.target.value as TipoContenido)}>
                  <option value="VIDEO">Video</option>
                  <option value="IMAGEN">Imagen</option>
                </select>
              </Campo>
            </div>
          )}
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={iluminado} onChange={(e) => setIluminado(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Cuenta con iluminación
          </label>
        </Seccion>

        <Seccion titulo="Comercialización">
          <Campo label="Tarifa publicada (S/)">
            <input className={inputCls} value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
          </Campo>
          <Campo label="Regla de comercialización">
            <div className="flex gap-2">
              {(['TRADICIONAL', 'PROGRAMATICO'] as Comercializacion[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setComercializacion(c)}
                  className={cn(
                    'flex-1 rounded border px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                    comercializacion === c ? 'border-accent bg-[#f59e0b1a] text-ink' : 'border-border-strong text-muted hover:bg-surface-2',
                  )}
                >
                  {c === 'TRADICIONAL' ? 'Tradicional' : 'Programático'}
                </button>
              ))}
            </div>
          </Campo>
          {digital && (
            <Campo label="CMS">
              <select className={inputCls} value={cms} onChange={(e) => setCms(e.target.value as CMS)}>
                {CMS_OPC.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </Campo>
          )}
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={enNetwork} onChange={(e) => setEnNetwork(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Compartir a la Network (inventario no vendido)
          </label>
        </Seccion>
      </div>
    </Modal>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">{titulo}</h4>
      {children}
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
