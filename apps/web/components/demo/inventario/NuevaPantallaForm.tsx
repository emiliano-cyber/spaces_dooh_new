'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { InlinePanel } from '@/components/demo/ui/InlinePanel'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { CRUDO_INVALIDO, cifraIlegible } from '@/lib/captura-cifra'
import { cn } from '@/lib/cn'
import { altaSitioApi } from '@/lib/data/sitios-api'
import { useArrendadores, type Sitio, type TipoMedio } from '@/lib/data/client'
import { puntoUtil } from '@/lib/coordenadas'
import { useIdioma, useTexto } from '@/lib/i18n/contexto'
import { numeroEnIdioma } from '@/lib/i18n/formato-idioma'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { ClaveTexto } from '@/lib/i18n/diccionario'

// Formulario manual de "Nueva pantalla" con 5 tabs (Básico, Especificaciones,
// IA/Vision, Precios, Imágenes). Crea la pantalla vía data.altaSitio.

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Imagen de muestra de la detección por Computer Vision (vive en /public; el
// basePath /spaces-dooh la sirve aquí). Solo se usa en el demo.
const IA_DEMO_IMG = '/spaces-dooh/ia-deteccion.jpg'

// Tipos de la lista validada (parabús/mupi/publitienda → mobiliario urbano).
// I18N (2026-11-02) · las etiquetas son claves; su espanol es el de siempre.
const TIPO_PANTALLA: { v: TipoMedio; label: ClaveTexto }[] = [
  { v: 'ESPECTACULAR', label: 'inventario.tipo.espectacular' },
  { v: 'MURAL', label: 'inventario.tipo.muro' },
  { v: 'VALLA', label: 'inventario.tipo.valla' },
  { v: 'MOBILIARIO_URBANO', label: 'inventario.tipo.mobiliario-detalle' },
  { v: 'PUENTE_PEATONAL', label: 'inventario.tipo.puente' },
  { v: 'OTRO', label: 'inventario.tipo.otro' },
]
const ESTADOS: { v: Sitio['estatusComercial']; label: ClaveTexto }[] = [
  { v: 'DISPONIBLE', label: 'inventario.alta.estado.disponible' },
  { v: 'OCUPADO', label: 'inventario.alta.estado.ocupada' },
  { v: 'EN_MANTENIMIENTO', label: 'inventario.alta.estado.mantenimiento' },
]
// El alta manual crea pantallas fijas → solo se comercializan por periodo:
// mensual o catorcenal (misma regla que la importación).
const MODALIDADES = ['Mensual', 'Catorcenal']
// El VALOR se guarda tal cual (es un dato); solo se traduce lo que se pinta.
const CLAVE_MODALIDAD: Record<string, ClaveTexto> = {
  Mensual: 'inventario.alta.modalidad.mensual',
  Catorcenal: 'inventario.alta.modalidad.catorcenal',
}

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
  const t = useTexto()
  // La cifra de la renta en el idioma de quien lee: con `'es-MX'` fijo salia
  // «45,000» en italiano (lote L3 del italiano). En es y en no cambia nada.
  const { idioma } = useIdioma()
  const arrendadores = useArrendadores()
  const [arrendadorId, setArrendadorId] = useState('')
  // v0.12.3 · pantalla PROPIA: sin arrendador ni renta; su costo es luz + operación.
  const [propio, setPropio] = useState(false)
  const [renta, setRenta] = useState('')
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
  const [precioM2, setPrecioM2] = useState('')
  // Tab 5
  const [imagen, setImagen] = useState<string | null>(null)
  const [imagenNombre, setImagenNombre] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cvInvalido = cv && !admobilizeId.trim()
  // La ubicación es obligatoria en el alta manual, y esto ANTES no era así.
  //
  // El formulario hacía `Number(lat) || 19.4326`: una pantalla sin coordenadas
  // no quedaba vacía, quedaba EN EL ZÓCALO — y sin marca de pendiente, así que
  // nadie volvía a mirarla nunca. Un dato inventado que parece real es peor que
  // un hueco: el hueco se ve y se rellena, el dato falso se cree.
  //
  // Aquí se exige y en la carga masiva NO, y la diferencia es deliberada: un
  // Excel de cien filas rara vez trae coordenadas y bloquearlo sería fricción
  // sin motivo, por eso el importador pone el default pero MARCA la fila como
  // pendiente de verificación (`lib/inventario-import.ts:211-218`). Dando de
  // alta UNA pantalla tienes la dirección delante.
  const ubicacion = puntoUtil(lat, lng)
  // Un importe que no se entiende llega como 'NaN' (CampoCifra). Sin esto,
  // `Number(tarifa) || 0` daría de alta la pantalla con tarifa CERO, y la renta
  // y el precio por m² se quedarían en «sin capturar» sin que nadie lo pidiera.
  // Los slots también: `Number(x) || 12` pondría el valor por omisión en vez
  // del tecleado.
  //
  // P-L2-1 · las caras y los segundos del slot son `EntradaCifra`: en italiano
  // llegan canónicos o como 'NaN', y el 'NaN' también para aquí (si no,
  // `Number(caras) || 1` lo cambiaría por el valor por omisión sin decirlo).
  // En español e inglés `cifraIlegible` es siempre `false`.
  const cifraInvalida =
    [renta, tarifa, precioM2, totalSpots, spotsDisp].includes(CRUDO_INVALIDO) ||
    cifraIlegible(caras, idioma) ||
    cifraIlegible(duracionSpot, idioma)
  // OBLIG-01: lo que falta se pinta en rojo al pulsar Guardar, en vez de dejar
  // el botón muerto sin decir qué campo lo bloquea. El nombre lo exige el
  // servidor (`app/api/sitios/route.ts`, «Falta nombre») y el arrendador
  // `crearSitio` (ADR 0002); la ubicación, la imagen y el ID de AdMobilize los
  // exige esta pantalla.
  const ob = useObligatorios({ arrendadorId, nombre, lat, lng, imagen, admobilizeId }, [
    // Una pantalla propia no tiene arrendador que elegir.
    { campo: 'arrendadorId', si: !propio },
    'nombre',
    'lat',
    'lng',
    'imagen',
    { campo: 'admobilizeId', si: cv },
  ])
  // Las dos coordenadas escritas pero que no son un lugar (fuera de rango, 0,0):
  // es formato, no un hueco, así que lleva su propio mensaje y sí bloquea el botón.
  const ubicacionInvalida = !!lat.trim() && !!lng.trim() && !ubicacion

  function toggleModalidad(m: string) {
    setModalidades((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }
  function onImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error(t('inventario.alta.imagen-tamano'))
      return
    }
    // Se guarda como data URL (base64), NO como blob URL: el blob solo vive en
    // esta pestaña y desaparecería al recargar. El base64 persiste en la BD.
    const reader = new FileReader()
    reader.onload = () => {
      setImagen(reader.result as string)
      setImagenNombre(f.name)
    }
    reader.onerror = () => toast.error(t('inventario.alta.imagen-leer'))
    reader.readAsDataURL(f)
  }

  async function submit() {
    if (!ob.validar()) return
    if (!ubicacion || cifraInvalida) return
    setEnviando(true)
    const digital = exhibicion === 'digital'
    const s = await altaSitioApi({
      nombre: nombre.trim(),
      ...(propio
        ? { propio: true }
        : {
            arrendadorId,
            // Solo se manda si es un importe usable. Un 0 lo rechaza
            // `contrato_monto_ck` y, peor, se leería como «este espacio es gratis».
            rentaArrendador: Number(renta) > 0 ? Number(renta) : null,
          }),
      tipoMedio,
      exhibicion,
      esRotativo: digital,
      direccionPredio: direccion.trim(),
      direccionComercial: direccion.trim(),
      distrito: '',
      // `ubicacion` no puede ser null aquí: `submit` sale antes sin ella. El
      // `??` es para el compilador, no una ruta viva.
      lat: ubicacion?.lat ?? 0,
      lng: ubicacion?.lng ?? 0,
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
      // Espejo de la renta, no un dato propio (ADR 0006): el costo de la pantalla
      // es lo que se le paga al arrendador. Se manda para que los lectores que
      // todavía leen `sitios.costo_compra` no vean un cero; la Fase 2 lo quita.
      costoCompra: !propio && Number(renta) > 0 ? Number(renta) : 0,
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
      {/* Los obligatorios viven en pestañas distintas y el rojo de una pestaña
          cerrada no se ve: el pie dice en cuál está el que falta. */}
      {ob.intento && cvInvalido ? (
        <span className="text-[12px] text-error">{t('inventario.alta.falta-admobilize')}</span>
      ) : ob.intento && !imagen ? (
        <span className="text-[12px] text-error">{t('inventario.alta.falta-imagen')}</span>
      ) : ob.intento && (!nombre.trim() || (!propio && !arrendadorId)) ? (
        <span className="text-[12px] text-error">{t('inventario.alta.falta-basico')}</span>
      ) : (ob.intento && !ubicacion) || ubicacionInvalida ? (
        <span className="text-[12px] text-error">
          {t('inventario.alta.falta-ubicacion')}
        </span>
      ) : cifraInvalida ? (
        <span className="text-[12px] text-error">{t('inventario.alta.cifra-roja')}</span>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        {!inline && (
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>{t('comun.cancelar')}</Button>
        )}
        <Button size="sm" disabled={enviando || cifraInvalida || ubicacionInvalida} onClick={submit}>
          {enviando ? t('comercial.comun.guardando') : t('inventario.alta.guardar')}
        </Button>
      </div>
    </div>
  )
  const cuerpo = (
    <div className={inline ? 'pr-1' : 'max-h-[62vh] overflow-y-auto pr-1'}>
        <Tabs
          defaultValue="basico"
          tabs={[
            { value: 'basico', label: t('inventario.alta.tab.basico') },
            { value: 'specs', label: t('inventario.alta.tab.specs') },
            { value: 'ia', label: t('inventario.alta.tab.ia') },
            { value: 'precios', label: t('inventario.alta.tab.precios') },
            { value: 'imagenes', label: t('inventario.alta.tab.imagenes') },
          ]}
        >
          <TabPanel value="basico" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">{t('inventario.alta.info-basica')}</h3>
            <label className="flex items-start gap-2 rounded border border-border bg-surface-2 p-2 text-[13px] text-ink">
              <input type="checkbox" className="mt-0.5" checked={propio} onChange={(e) => setPropio(e.target.checked)} />
              <span>
                <span className="font-medium">{t('comercial.comun.pantalla-propia')}</span>
                <span className="block text-[11px] text-muted">
                  {t('comercial.alta.propia.ayuda')}
                </span>
              </span>
            </label>
            {!propio && (<>
            <Campo label={t('inventario.alta.arrendador')} obligatorio falta={ob.falta('arrendadorId')}>
              <select
                className={inputCls}
                value={arrendadorId}
                onChange={(e) => setArrendadorId(e.target.value)}
              >
                <option value="">{t('inventario.alta.elige-arrendador')}</option>
                {(arrendadores ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </Campo>
            {/* Va JUNTO al arrendador y no en la pestaña "Precios" a propósito:
                ahí vive la tarifa, que es lo que ENTRA del cliente. Aquí la
                pregunta es «¿a quién y cuánto le pago por este espacio?», que se
                responde de una vez. Es el único costo de la pantalla (ADR 0006). */}
            <Campo label={t('inventario.alta.renta')}>
              <CampoCifra
                className={`demo-num ${inputCls}`}
                valor={renta}
                onCambio={(crudo) => setRenta(crudo)}
                placeholder={t('comercial.comun.ej', { valor: '45000' })}
              />
              <span className="mt-1 block text-[11px] text-muted">
                {t('inventario.alta.renta-ayuda')}
              </span>
            </Campo>
            </>)}
            <Campo label={t('inventario.wizard.nombre-pantalla')} obligatorio falta={ob.falta('nombre')}>
              <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </Campo>
            <Campo label={t('inventario.wizard.direccion')}>
              <input className={inputCls} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </Campo>
            <Campo label={t('inventario.alta.exhibicion')}>
              <select className={inputCls} value={exhibicion} onChange={(e) => setExhibicion(e.target.value as 'fijo' | 'digital')}>
                <option value="fijo">{t('inventario.alta.fija')}</option>
                <option value="digital">{t('inventario.alta.digital')}</option>
              </select>
              <span className="mt-1 block text-[11px] text-muted">
                {exhibicion === 'digital'
                  ? t('inventario.alta.ayuda-digital')
                  : t('inventario.alta.ayuda-fija')}
              </span>
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label={t('inventario.alta.latitud')} obligatorio falta={ob.falta('lat')} error={ubicacionInvalida ? t('inventario.alta.fuera-rango') : null}><input className={inputCls} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder={t('comercial.comun.ej', { valor: '19.4326' })} /></Campo>
              <Campo label={t('inventario.alta.longitud')} obligatorio falta={ob.falta('lng')}><input className={inputCls} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder={t('comercial.comun.ej', { valor: '-99.1332' })} /></Campo>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label={t('inventario.alta.tipo-pantalla')}>
                <select className={inputCls} value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value as TipoMedio)}>
                  {TIPO_PANTALLA.map((x) => <option key={x.v} value={x.v}>{t(x.label)}</option>)}
                </select>
              </Campo>
              <Campo label={t('inventario.alta.estado')}>
                <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as Sitio['estatusComercial'])}>
                  {ESTADOS.map((e) => <option key={e.v} value={e.v}>{t(e.label)}</option>)}
                </select>
              </Campo>
            </div>
          </TabPanel>

          <TabPanel value="specs" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">{t('inventario.alta.specs')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label={t('inventario.alta.res-ancho')}><input className={inputCls} inputMode="numeric" value={resAncho} onChange={(e) => setResAncho(e.target.value)} placeholder={t('comercial.comun.ej', { valor: '1920' })} /></Campo>
              <Campo label={t('inventario.alta.res-alto')}><input className={inputCls} inputMode="numeric" value={resAlto} onChange={(e) => setResAlto(e.target.value)} placeholder={t('comercial.comun.ej', { valor: '1080' })} /></Campo>
            </div>
            <Campo label={t('inventario.wizard.caras')}><EntradaCifra className={inputCls} inputMode="numeric" valor={caras} onCambio={setCaras} decimales={0} minimo={0} placeholder={t('comercial.comun.ej', { valor: '1' })} /></Campo>
            <div>
              <span className="mb-1 block text-[12px] font-medium text-ink">{t('inventario.alta.modalidades')}</span>
              <div className="grid grid-cols-2 gap-1.5">
                {MODALIDADES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-[13px] text-ink">
                    <input type="checkbox" checked={modalidades.includes(m)} onChange={() => toggleModalidad(m)} className="h-4 w-4 accent-[var(--accent)]" />
                    {t(CLAVE_MODALIDAD[m])}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <div className="mb-2 text-[12px] font-medium text-ink">{t('inventario.alta.config-slots')}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo label={t('inventario.wizard.duracion-slot')}><EntradaCifra className={inputCls} inputMode="numeric" valor={duracionSpot} onCambio={setDuracionSpot} decimales={0} minimo={0} placeholder={t('comercial.comun.ej', { valor: '20' })} /></Campo>
                <Campo label={t('inventario.alta.total-slots')}><CampoCifra decimales={0} className={inputCls} valor={totalSpots} onCambio={(crudo) => setTotalSpots(crudo)} placeholder={t('comercial.comun.ej', { valor: '12' })} /></Campo>
                <Campo label={t('inventario.alta.slots-disponibles')}><CampoCifra decimales={0} className={inputCls} valor={spotsDisp} onCambio={(crudo) => setSpotsDisp(crudo)} placeholder={t('comercial.comun.ej', { valor: '12' })} /></Campo>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="ia" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">Computer Vision / AdMobilize</h3>
            <div className="rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] p-3 text-[12px] text-muted">
              {interpolarNodos(t('inventario.alta.admobilize'), { marca: <b className="text-info">AdMobilize</b> })}
            </div>
            <div className="rounded-md border border-border p-3">
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={cv} onChange={(e) => setCv(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                <span>
                  {t('inventario.alta.cv')}
                  <span className="block text-[12px] text-muted">{t('inventario.alta.cv-ayuda')}</span>
                </span>
              </label>
            </div>
            {cv && (
              <>
                <Campo label={t('inventario.alta.admobilize-id')} obligatorio falta={ob.falta('admobilizeId')}>
                  <input className={inputCls} value={admobilizeId} onChange={(e) => setAdmobilizeId(e.target.value)} placeholder={t('comercial.comun.p-ej', { valor: 'ADM-00123' })} />
                  <span className="mt-1 block text-[11px] text-muted">{t('inventario.alta.admobilize-id-ayuda')}</span>
                </Campo>
                <div className="rounded-md border border-border p-3">
                  <div className="mb-2 text-[12px] font-medium text-ink">{t('inventario.alta.deteccion-vivo')}</div>
                  <p className="mb-2 text-[11px] text-muted">
                    {t('inventario.alta.deteccion-previa')}
                  </p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setVerIA(true)}>
                    <Eye className="h-4 w-4" /> {t('inventario.alta.ver-ia')}
                  </Button>
                </div>
              </>
            )}
          </TabPanel>

          <TabPanel value="precios" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">{t('inventario.alta.tab.precios')}</h3>
            <Campo label={t('inventario.wizard.tarifa-publicada')}><CampoCifra className={inputCls} valor={tarifa} onCambio={(crudo) => setTarifa(crudo)} placeholder={t('comercial.comun.ej', { valor: '15000' })} /></Campo>
            {/* El costo NO se captura aquí (ADR 0006). Una pantalla tiene un solo
                costo —la renta al arrendador— y se captura en la pestaña Básico,
                junto a quién es ese arrendador. Tener aquí un "costo de compra"
                producía dos números distintos para el mismo espacio. */}
            <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
              {interpolarNodos(t('inventario.alta.costo'), {
                renta: <b className="text-ink">{t('inventario.alta.costo-renta')}</b>,
                basico: <b className="text-ink">{t('inventario.alta.tab.basico')}</b>,
                estado:
                  Number(renta) > 0
                    ? t('inventario.alta.costo-actual', { n: numeroEnIdioma(Number(renta), idioma) })
                    : t('inventario.alta.costo-sin'),
              })}
            </div>
            <Campo label={t('inventario.alta.precio-m2')}>
              <CampoCifra className={inputCls} valor={precioM2} onCambio={(crudo) => setPrecioM2(crudo)} placeholder={t('inventario.alta.precio-m2-ph')} />
            </Campo>
          </TabPanel>

          <TabPanel value="imagenes" className="space-y-3 pt-3">
            <h3 className="text-base font-semibold text-ink">{t('inventario.alta.tab.imagenes')}</h3>
            <Campo label={t('inventario.alta.imagen')} obligatorio falta={ob.falta('imagen')} como="div" className="space-y-3">
              <p className="text-[11px] text-muted">{t('inventario.alta.imagen-formato')}</p>
              {imagen && (
                // Pulido del italiano (04/11): el `alt` iba escrito a mano en
                // ingles. En italiano, del diccionario; en espanol y en ingles,
                // el literal de siempre (cambiarlo es decision aparte). El
                // portugues (lote L3, 05/11), como el italiano: del diccionario.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagen} alt={idioma === 'it' || idioma === 'pt' ? t('inventario.carga.vista-previa') : 'preview'} className="max-h-48 w-full rounded border border-border object-contain" />
              )}
              {imagenNombre && <p className="demo-num text-[11px] text-muted">{imagenNombre}</p>}
              {/* El <input> va oculto, así que el borde rojo de `[data-falta]` no
                  lo vería nadie: se pinta el botón que sí se ve. */}
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded border border-border-strong px-3 py-2 text-[13px] text-ink hover:bg-surface-2',
                  ob.falta('imagen') && 'border-error',
                )}
              >
                {imagen ? t('inventario.alta.cambiar-imagen') : t('inventario.alta.subir-imagen')}
                <input type="file" accept="image/jpeg,image/png" onChange={onImagen} className="hidden" />
              </label>
            </Campo>
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
      title={t('inventario.alta.ia-titulo')}
      subtitle={t('inventario.alta.ia-sub')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IA_DEMO_IMG}
        alt={t('inventario.alta.ia-alt')}
        className="w-full rounded border border-border object-contain"
      />
      <p className="mt-2 text-[11px] text-muted">
        {t('inventario.alta.ia-nota')}
      </p>
    </Modal>
  )

  if (inline) {
    return (
      <>
        <InlinePanel title={t('inventario.alta.titulo')} subtitle={t('inventario.alta.sub')} footer={footer}>
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
        title={t('inventario.alta.titulo')}
        subtitle={t('inventario.alta.sub')}
        footer={footer}
      >
        {cuerpo}
      </Modal>
      {iaViewer}
    </>
  )
}
