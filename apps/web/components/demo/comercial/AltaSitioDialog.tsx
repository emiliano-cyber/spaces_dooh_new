'use client'

import { useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { CRUDO_INVALIDO, cifraIlegible, ejemploCifra } from '@/lib/captura-cifra'
import { cn } from '@/lib/cn'
import { altaSitioApi } from '@/lib/data/sitios-api'
import { useIdioma, useTexto } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { CLAVE_TIPO_MEDIO } from '@/components/demo/comercial/claves'
import { useCamposOcultosPantalla } from '@/lib/data/campos-pantalla-api'
import type { CampoPantalla } from '@/lib/campos-pantalla'
import {
  useArrendadores,
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

// Los mismos textos que `TIPO_MEDIO_LABEL`, por sus claves de traducción
// (`components/demo/comercial/claves.ts`); el orden es el de este alta.
const TIPOS: { v: TipoMedio; label: ClaveTexto }[] = [
  { v: 'ESPECTACULAR', label: CLAVE_TIPO_MEDIO.ESPECTACULAR },
  { v: 'PANTALLA_DIGITAL', label: CLAVE_TIPO_MEDIO.PANTALLA_DIGITAL },
  { v: 'VALLA', label: CLAVE_TIPO_MEDIO.VALLA },
  { v: 'MOBILIARIO_URBANO', label: CLAVE_TIPO_MEDIO.MOBILIARIO_URBANO },
  { v: 'PUENTE_PEATONAL', label: CLAVE_TIPO_MEDIO.PUENTE_PEATONAL },
  { v: 'MURAL', label: CLAVE_TIPO_MEDIO.MURAL },
  { v: 'OTRO', label: CLAVE_TIPO_MEDIO.OTRO },
]
// Las marcas no se traducen; «Otros» sí.
const CMS_OPC: { v: CMS; label: string | ClaveTexto; clave?: boolean }[] = [
  { v: 'BROADSIGN', label: 'Broadsign' },
  { v: 'INVIDIS', label: 'Invidis' },
  { v: 'DOOHMAIN', label: 'Doohmain' },
  { v: 'OTRO', label: 'comercial.comun.cms-otro', clave: true },
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
  const t = useTexto()
  const { idioma } = useIdioma()
  const arrendadores = useArrendadores()
  // CAMPOS-PANTALLA (11/11): lo que esta instancia quitó del alta al instalarse.
  // Un campo oculto no se pinta y deja de ser obligatorio. Mientras llega la
  // lista se enseña todo (es lo de antes).
  const ocultos = useCamposOcultosPantalla() ?? []
  const ve = (c: CampoPantalla) => !ocultos.includes(c)
  const [arrendadorId, setArrendadorId] = useState('')
  // v0.12.3 · pantalla PROPIA: sin arrendador ni renta, igual que en el alta de
  // Inventario (`NuevaPantallaForm`). Esta era la única alta que no la ofrecía,
  // así que desde Comercial una pantalla de la empresa solo podía nacer rentada.
  const [propioMarcado, setPropio] = useState(false)
  // Sin el campo «arrendador», esta empresa no renta espacios: toda pantalla
  // nace PROPIA, o el servidor pediría un arrendador que ya no se puede elegir.
  const propio = propioMarcado || !ve('arrendador')
  const [nombre, setNombre] = useState('')
  const [tipoMedio, setTipoMedio] = useState<TipoMedio>('ESPECTACULAR')
  const [distrito, setDistrito] = useState('')
  const [direccionPredio, setDireccionPredio] = useState('')
  const [direccionComercial, setDireccionComercial] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  const [iluminado, setIluminado] = useState(true)
  const [tarifa, setTarifa] = useState('')
  const [comercializacion, setComercializacion] = useState<Comercializacion>('TRADICIONAL')
  const [enNetwork, setEnNetwork] = useState(false)
  const [cms, setCms] = useState<CMS>('DOOHMAIN')
  const [resolucionPx, setResolucionPx] = useState('')
  const [tipoContenido, setTipoContenido] = useState<TipoContenido>('VIDEO')
  const [enviando, setEnviando] = useState(false)

  const digital = tipoMedio === 'PANTALLA_DIGITAL'
  // ADR 0002: sin arrendador no hay contrato que abrir, y el alta se rechaza.
  // La tarifa que no se entiende llega como 'NaN' (CampoCifra). Sin la última
  // condición, `Number(tarifa) || 0` daría de alta la pantalla con tarifa CERO
  // — que es lo que pasaba antes con «15,000» tecleado en este campo de texto.
  const tarifaInvalida = tarifa === CRUDO_INVALIDO
  // P-L2-1 · en italiano el ancho y el alto pasan por `EntradaCifra`: «12,9»
  // llega como 12.9, y lo que no se entiende como 'NaN', que aquí se para (si
  // no, `Number(ancho) || 0` daría de alta una pantalla de cero metros). En
  // español e inglés es siempre `false`: el campo hace lo de siempre.
  const medidaIlegible = cifraIlegible(ancho, idioma) || cifraIlegible(alto, idioma)
  // OBLIG-01: el nombre lo exige el servidor (`app/api/sitios/route.ts`, «Falta
  // nombre») y el arrendador `crearSitio` (ADR 0002); el distrito y la
  // dirección comercial los exigía ya esta pantalla para habilitar «Crear».
  const ob = useObligatorios({ arrendadorId, nombre, distrito, direccionComercial }, [
    // Una pantalla propia no tiene arrendador que elegir.
    { campo: 'arrendadorId', si: !propio },
    'nombre',
    { campo: 'distrito', si: ve('distrito') },
    { campo: 'direccionComercial', si: ve('direccion') },
  ])

  async function submit() {
    if (!ob.validar() || tarifaInvalida || medidaIlegible) return
    setEnviando(true)
    const s = await altaSitioApi({
      nombre: nombre.trim(),
      ...(propio ? { propio: true } : { arrendadorId }),
      tipoMedio,
      distrito: distrito.trim(),
      direccionPredio: direccionPredio.trim() || direccionComercial.trim(),
      direccionComercial: direccionComercial.trim(),
      // Con la ubicación oculta (CAMPOS-PANTALLA) va vacía y PENDIENTE de
      // verificar, como la carga masiva. Visible, se queda como estaba.
      ...(ve('ubicacion')
        ? { lat: Number(lat) || -12.09, lng: Number(lng) || -77.04 }
        : { lat: null, lng: null, pendienteVerificacion: true }),
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
    setArrendadorId('')
    setPropio(false)
    setNombre('')
    setDistrito('')
    setDireccionPredio('')
    setDireccionComercial('')
    ob.reiniciar()
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('comercial.alta.titulo')}
      subtitle={t('comercial.alta.subtitulo')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            {t('comun.cancelar')}
          </Button>
          <Button variant="success" size="sm" disabled={tarifaInvalida || medidaIlegible || enviando} onClick={submit}>
            {enviando ? t('comercial.alta.creando') : t('comercial.alta.crear')}
          </Button>
        </div>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <Seccion titulo={t('comercial.alta.identificacion')}>
          {ve('arrendador') && (
          <label className="flex items-start gap-2 rounded border border-border bg-surface-2 p-2 text-[13px] text-ink">
            <input type="checkbox" className="mt-0.5" checked={propioMarcado} onChange={(e) => setPropio(e.target.checked)} />
            <span>
              <span className="font-medium">{t('comercial.comun.pantalla-propia')}</span>
              <span className="block text-[11px] text-muted">
                {t('comercial.alta.propia.ayuda')}
              </span>
            </span>
          </label>
          )}
          {!propio && (
            <Campo label={t('comercial.alta.arrendador')} obligatorio falta={ob.falta('arrendadorId')}>
              <select className={inputCls} value={arrendadorId} onChange={(e) => setArrendadorId(e.target.value)}>
                <option value="">{t('comercial.alta.elige-arrendador')}</option>
                {(arrendadores ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </Campo>
          )}
          <Campo label={t('comercial.comun.nombre')} obligatorio falta={ob.falta('nombre')}>
            <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('comercial.comun.p-ej', { valor: t('comercial.alta.nombre-ej') })} autoFocus />
          </Campo>
          {ve('tipo') && (
          <Campo label={t('comercial.alta.tipo')}>
            <select className={inputCls} value={tipoMedio} onChange={(e) => setTipoMedio(e.target.value as TipoMedio)}>
              {TIPOS.map((tm) => <option key={tm.v} value={tm.v}>{t(tm.label)}</option>)}
            </select>
          </Campo>
          )}
        </Seccion>

        {(ve('distrito') || ve('direccion') || ve('ubicacion')) && (
        <Seccion titulo={t('comercial.comun.ubicacion')}>
          {ve('distrito') && (
          <Campo label={t('comercial.alta.distrito')} obligatorio falta={ob.falta('distrito')}>
            <input className={inputCls} value={distrito} onChange={(e) => setDistrito(e.target.value)} placeholder={t('comercial.comun.p-ej', { valor: 'Miraflores' })} />
          </Campo>
          )}
          {ve('direccion') && (<>
          <Campo label={t('comercial.comun.direccion-predio')}>
            <input className={inputCls} value={direccionPredio} onChange={(e) => setDireccionPredio(e.target.value)} placeholder={t('comercial.alta.direccion-fisica')} />
          </Campo>
          <Campo label={t('comercial.comun.direccion-comercial')} obligatorio falta={ob.falta('direccionComercial')}>
            <input className={inputCls} value={direccionComercial} onChange={(e) => setDireccionComercial(e.target.value)} placeholder={t('comercial.alta.direccion-mostrada')} />
          </Campo>
          </>)}
          {ve('ubicacion') && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label={t('comercial.alta.latitud')}><input className={inputCls} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder={t('comercial.comun.ej', { valor: '-12.0900' })} /></Campo>
            <Campo label={t('comercial.alta.longitud')}><input className={inputCls} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder={t('comercial.comun.ej', { valor: '-77.0400' })} /></Campo>
          </div>
          )}
        </Seccion>
        )}

        {(ve('medidas') || ve('iluminado') || (digital && (ve('resolucion') || ve('cms')))) && (
        <Seccion titulo={t('comercial.alta.caracteristicas')}>
          {ve('medidas') && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label={t('comercial.comun.ancho')}><EntradaCifra className={inputCls} inputMode="decimal" valor={ancho} onCambio={setAncho} decimales={2} minimo={0} placeholder={t('comercial.comun.ej', { valor: ejemploCifra('12.9', idioma) })} /></Campo>
            <Campo label={t('comercial.comun.alto')}><EntradaCifra className={inputCls} inputMode="decimal" valor={alto} onCambio={setAlto} decimales={2} minimo={0} placeholder={t('comercial.comun.ej', { valor: ejemploCifra('7.2', idioma) })} /></Campo>
          </div>
          )}
          {digital && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ve('resolucion') && <Campo label={t('comercial.comun.resolucion-px')}><input className={inputCls} value={resolucionPx} onChange={(e) => setResolucionPx(e.target.value)} placeholder="1920x1080" /></Campo>}
              {ve('cms') && (
              <Campo label={t('comercial.alta.tipo-contenido')}>
                <select className={inputCls} value={tipoContenido} onChange={(e) => setTipoContenido(e.target.value as TipoContenido)}>
                  <option value="VIDEO">{t('comercial.comun.video')}</option>
                  <option value="IMAGEN">{t('comercial.comun.imagen')}</option>
                </select>
              </Campo>
              )}
            </div>
          )}
          {ve('iluminado') && (
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={iluminado} onChange={(e) => setIluminado(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            {t('comercial.alta.iluminacion')}
          </label>
          )}
        </Seccion>
        )}

        {(ve('tarifa') || ve('comercializacion') || ve('network') || (digital && ve('cms'))) && (
        <Seccion titulo={t('comercial.comun.comercializacion')}>
          {ve('tarifa') && (
          <Campo label={t('comercial.alta.tarifa', { simbolo: '$' })}>
            <CampoCifra className={inputCls} valor={tarifa} onCambio={(crudo) => setTarifa(crudo)} placeholder={t('comercial.comun.ej', { valor: '15000' })} />
          </Campo>
          )}
          {ve('comercializacion') && (
          <Campo label={t('comercial.alta.regla')} como="div">
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
                  {c === 'TRADICIONAL' ? t('comercial.comun.tradicional') : t('comercial.comun.programatico')}
                </button>
              ))}
            </div>
          </Campo>
          )}
          {digital && ve('cms') && (
            <Campo label="CMS">
              <select className={inputCls} value={cms} onChange={(e) => setCms(e.target.value as CMS)}>
                {CMS_OPC.map((c) => <option key={c.v} value={c.v}>{c.clave ? t(c.label as ClaveTexto) : c.label}</option>)}
              </select>
            </Campo>
          )}
          {ve('network') && (
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={enNetwork} onChange={(e) => setEnNetwork(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            {t('comercial.alta.network')}
          </label>
          )}
        </Seccion>
        )}
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
