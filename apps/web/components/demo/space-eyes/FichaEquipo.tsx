'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Eye,
  Columns2,
  Download,
  Loader2,
  MapPin,
  Maximize2,
  Monitor,
  RefreshCw,
  Upload,
  UserRound,
  XCircle,
  Radio,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { actualizarSitioApi } from '@/lib/data/sitios-api'
import {
  equipoApi,
  pedirCapturaApi,
  type FichaEquipoDatos,
  type FotoEquipo,
} from '@/lib/data/space-eyes-api'
import { Bateria, FotoGirada, PildoraConexion, VisorFoto, Senal, calidadSenal, estaEnLinea, fechaHora, gigas, hace } from './piezas'
import { Historial } from './Historial'
import { PantallaYCreativos } from './PantallaYCreativos'
import { VistaEnVivo } from './VistaEnVivo'
import { PantallaConfig } from './PantallaConfig'
import { CreativosConfig } from './CreativosConfig'
import { EquipoAdmin } from './EquipoAdmin'
import { Tabs, TabPanel } from '@/components/demo/ui/Tabs'
import { usePuede } from '@/components/demo/shell/SesionContext'

// ============================================================================
//  Space Eyes — la ficha de un equipo.
//
//  ORDEN DE LECTURA, de arriba abajo: qué equipo es y si está vivo; QUÉ ESTÁ
//  VIENDO (la fotografía, que ocupa la mitad de la pantalla); y recién después
//  lo técnico. Alguien que entra por primera vez tiene que poder decir «éste es
//  mi equipo, está en línea y ésta es la última foto que tomó» sin que nadie se
//  lo explique.
//
//  LOS DOS ORÍGENES DE IMAGEN no se mezclan nunca: la captura del equipo y la
//  foto que subió el cliente viven en pestañas separadas y cada una lleva su
//  sello encima. Confundirlas sería el peor error posible de esta pantalla: la
//  foto del cliente es lo que se PROMETIÓ y la captura es lo que HAY.
// ============================================================================

type Vista = 'equipo' | 'cliente' | 'comparar' | 'vivo'
type Captura = 'quieto' | 'pidiendo' | 'esperando' | 'llegó' | 'encolada'

// Cada cuánto se vuelve a preguntar mientras se espera una foto, y por cuánto
// tiempo. Un minuto cubre de sobra lo que tarda un teléfono en despertar, abrir
// la cámara y subir 2 MB; pasado eso se deja de insistir y se dice la verdad en
// vez de girar para siempre.
const SONDEO_MS = 4000
const SONDEOS_MAX = 15

export function FichaEquipo({ id }: { id: number }) {
  const [datos, setDatos] = useState<FichaEquipoDatos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('equipo')
  const [ampliada, setAmpliada] = useState<string | null>(null)
  // Quien puede operar el equipo (pedir fotos, vivo, cambiar ajustes): el mismo
  // permiso que exige la puerta /api/space-eyes/se para escribir.
  const puedeOperar = usePuede('inventario', 'crear')
  // Al guardar ajustes de pantalla o creativos, la vista de solo lectura se recarga.
  const [version, setVersion] = useState(0)
  const [captura, setCaptura] = useState<Captura>('quieto')
  const [avisoCaptura, setAvisoCaptura] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [fotoElegida, setFotoElegida] = useState(0)
  const archivoRef = useRef<HTMLInputElement | null>(null)
  const sondeo = useRef<ReturnType<typeof setInterval> | null>(null)

  const traer = useCallback(async () => {
    const d = await equipoApi(id)
    setDatos(d)
    return d
  }, [id])

  const sincronizar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      await traer()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar Space Eyes')
    }
    setCargando(false)
  }, [traer])

  useEffect(() => {
    void sincronizar()
  }, [sincronizar])

  // Un sondeo abierto al cambiar de pantalla seguiría pidiendo para siempre.
  useEffect(() => () => { if (sondeo.current) clearInterval(sondeo.current) }, [])

  const equipo = datos?.equipo
  const pantalla = datos?.pantalla ?? null
  const enLinea = equipo ? estaEnLinea(equipo.online, equipo.ultimaConexion) : false
  const fotos = equipo?.fotos ?? []
  const fotoEquipo: FotoEquipo | null = fotos[fotoElegida] ?? fotos[0] ?? null
  const fotoCliente = pantalla?.fotoCliente ?? null

  /**
   * Pedir una foto y ESPERARLA.
   *
   * Que la orden salga no es lo que el usuario vino a ver: vino a ver la foto.
   * Así que al aceptar la orden se queda sondeando hasta que aparezca una foto
   * más nueva que la que ya había, y entonces la muestra sola. Sin esto habría
   * que decirle a la gente «ahora recarga a ver si llegó», que es exactamente el
   * trabajo que la pantalla debería hacer por ella.
   */
  async function tomarFoto() {
    if (!equipo) return
    setAvisoCaptura(null)
    setCaptura('pidiendo')
    const referencia = fotos[0]?.tomadaEn ?? null
    try {
      const r = await pedirCapturaApi(equipo.id)
      if (!r.enLinea) {
        setCaptura('encolada')
        setAvisoCaptura(r.mensaje)
        return
      }
      setCaptura('esperando')
      setAvisoCaptura(r.mensaje)
      setVista('equipo')

      let vueltas = 0
      if (sondeo.current) clearInterval(sondeo.current)
      sondeo.current = setInterval(async () => {
        vueltas += 1
        try {
          const d = await traer()
          const nueva = d.equipo.fotos[0]?.tomadaEn ?? null
          if (nueva && nueva !== referencia) {
            if (sondeo.current) clearInterval(sondeo.current)
            setFotoElegida(0)
            setCaptura('llegó')
            // Se dice que llegó, y el aviso se va solo: la foto nueva ya está
            // en pantalla, así que dejarlo fijo sería ruido sobre la evidencia.
            setAvisoCaptura('Llegó la foto: es la que estás viendo.')
            setTimeout(() => {
              setAvisoCaptura((a) => (a === 'Llegó la foto: es la que estás viendo.' ? null : a))
              setCaptura((c) => (c === 'llegó' ? 'quieto' : c))
            }, 6000)
            return
          }
        } catch {
          /* una vuelta fallida no cancela la espera: la siguiente lo reintenta */
        }
        if (vueltas >= SONDEOS_MAX) {
          if (sondeo.current) clearInterval(sondeo.current)
          setCaptura('quieto')
          setAvisoCaptura(
            'La foto no ha llegado todavía. La orden sigue en pie: el equipo la subirá en cuanto pueda.',
          )
        }
      }, SONDEO_MS)
    } catch (e) {
      setCaptura('quieto')
      setAvisoCaptura(e instanceof Error ? e.message : 'No se pudo pedir la foto')
    }
  }

  /**
   * Subir la foto del cliente.
   *
   * Se guarda en la GALERÍA DE LA PANTALLA (`sitios.fotos`), que es donde ya
   * viven las fotos que sube el cliente desde Inventario, y queda de primera
   * —la primera de la galería es la imagen principal de esa pantalla, regla que
   * ya existía—. Inventarle un almacén propio a este módulo habría dejado dos
   * galerías de la misma pantalla contradiciéndose.
   */
  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !pantalla) return
    setSubiendo(true)
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = () => rej(new Error('No se pudo leer la imagen'))
        r.readAsDataURL(file)
      })
      // La galería actual, para no pisarla al agregar.
      const r = await fetch(`/spaces-dooh/api/sitios/${pantalla.id}/media/`, { cache: 'no-store' })
      const actuales = r.ok ? (((await r.json()) as { fotos?: string[] }).fotos ?? []) : []
      const nuevas = [dataUrl, ...actuales]
      await actualizarSitioApi(pantalla.id, { fotos: nuevas, imagenPromocional: dataUrl })
      await traer()
      setVista('cliente')
    } catch (err) {
      setAvisoCaptura(err instanceof Error ? err.message : 'No se pudo subir la foto')
    }
    setSubiendo(false)
  }

  if (cargando && !datos) {
    return (
      <div className="w-full p-5 lg:p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-2" />
        <div className="mt-4 h-[420px] animate-pulse rounded-lg bg-surface-2" />
      </div>
    )
  }

  if (error || !equipo) {
    return (
      <div className="w-full p-5 lg:p-6">
        <Link href="/space-eyes" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
          <ChevronLeft className="h-3.5 w-3.5" /> Space Eyes
        </Link>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudo abrir el equipo</div>
            <div className="text-muted">{error ?? 'Equipo no encontrado'}</div>
          </div>
        </div>
      </div>
    )
  }

  const senal = calidadSenal(equipo.senalDbm)

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 p-4 sm:p-6">
      {/* Migas */}
      <Link href="/space-eyes" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Space Eyes
      </Link>

      {/* El encabezado de Inventario, exacto: icono en cuadro de 40, titulo de
          18 px y subtitulo de 13. El nombre de un equipo no manda mas que el de
          un modulo; antes era un serif de 24 px y se veia de otra casa. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-lg font-semibold text-ink">{equipo.nombre}</h1>
            <PildoraConexion online={enLinea} pendiente={!equipo.ultimaConexion} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
            {equipo.empresa && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink">{equipo.empresa}</span>
            )}
            {pantalla ? (
              <Link href={`/comercial?sitio=${pantalla.id}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Monitor className="h-3.5 w-3.5" strokeWidth={1.7} />
                {pantalla.nombre}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 italic">
                <Monitor className="h-3.5 w-3.5" strokeWidth={1.7} />
                sin pantalla asignada
              </span>
            )}
            {equipo.codigoPantalla && <span className="tabular-nums">· {equipo.codigoPantalla}</span>}
            {equipo.direccion && <span className="truncate">· {equipo.direccion}</span>}
          </div>
        </div>

        {/* Acciones: las dos importantes, a la vista */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={tomarFoto}
            disabled={captura === 'pidiendo' || captura === 'esperando'}
          >
            {captura === 'pidiendo' || captura === 'esperando' ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="mr-2 h-3.5 w-3.5" />
            )}
            {captura === 'esperando' ? 'Esperando la foto…' : captura === 'pidiendo' ? 'Pidiendo…' : 'Tomar foto'}
          </Button>

          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={subirFoto}
            aria-hidden
            tabIndex={-1}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => archivoRef.current?.click()}
            disabled={!pantalla || subiendo}
            title={pantalla ? undefined : 'Este equipo no tiene una pantalla asignada donde guardar la foto'}
          >
            {subiendo ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
            Subir foto
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void sincronizar()} aria-label="Actualizar estado">
            <RefreshCw className={cn('h-3.5 w-3.5', cargando && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {avisoCaptura && (
        <div
          className={cn(
            'rounded-md border p-2.5 text-[12px]',
            captura === 'encolada'
              ? 'border-[#f59e0b40] bg-warning-soft text-ink'
              : captura === 'llegó'
                ? 'border-[#1da85040] bg-success-soft text-ink'
                : 'border-border bg-surface-2 text-muted',
          )}
        >
          {avisoCaptura}
        </div>
      )}

      {/* Las pestañas de la ficha: lo mismo que el panel de Space Eye, aqui. */}
      <Tabs
        defaultValue="fotos"
        tabs={[
          { value: 'fotos', label: 'Fotos' },
          { value: 'pantalla', label: 'Pantalla y fallas' },
          { value: 'creativos', label: 'Creativos' },
          { value: 'equipo', label: 'Equipo' },
        ]}
      >
      <TabPanel value="fotos" className="pt-4">
      <div className="flex flex-col gap-4 xl:flex-row">
        {/* ── La fotografía ── */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-surface">
          {/* Selector de origen */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
            <div className="flex flex-wrap gap-0.5 rounded-md border border-border bg-surface p-0.5 text-[13px]">
            <Pestana activa={vista === 'vivo'} onClick={() => setVista('vivo')} icono={<Radio className="h-3.5 w-3.5" />}>
              En vivo
            </Pestana>
            <Pestana activa={vista === 'equipo'} onClick={() => setVista('equipo')} icono={<Camera className="h-3.5 w-3.5" />}>
              Captura Space Eyes
            </Pestana>
            <Pestana activa={vista === 'cliente'} onClick={() => setVista('cliente')} icono={<UserRound className="h-3.5 w-3.5" />}>
              Foto del cliente
            </Pestana>
            <Pestana
              activa={vista === 'comparar'}
              onClick={() => setVista('comparar')}
              icono={<Columns2 className="h-3.5 w-3.5" />}
              disabled={!fotoCliente || !fotoEquipo}
            >
              Comparar
            </Pestana>
            </div>
          </div>

          {/* Imagen + barra de estado encima; o el vivo, en el mismo marco */}
          {vista === 'vivo' ? (
            <VistaEnVivo
              embebida
              equipo={{ id: equipo.id, nombre: equipo.nombre, appVersion: equipo.versionApp, online: equipo.online }}
              puedeOperar={puedeOperar}
              onFoto={() => { void traer() }}
            />
          ) : vista === 'comparar' ? (
            <div className="grid gap-px bg-border sm:grid-cols-2">
              <Panel
                sello="FOTO DEL CLIENTE"
                selloClase="bg-[#7c3aed]"
                url={fotoCliente}
                pie="Subida a la galería de la pantalla"
                onAmpliar={setAmpliada}
                alt={`Foto del cliente de ${equipo.nombre}`}
              />
              <Panel
                sello="CAPTURA SPACE EYES"
                selloClase="bg-accent"
                url={fotoEquipo?.url ?? null}
                giro={fotoEquipo?.giro ?? 0}
                pie={fotoEquipo ? fechaHora(fotoEquipo.tomadaEn) : 'sin capturas'}
                onAmpliar={setAmpliada}
                alt={`Captura de Space Eyes de ${equipo.nombre}`}
              />
            </div>
          ) : (
            <div className="relative aspect-[16/10] max-h-[70vh] w-full bg-[#12100e]">
              {vista === 'equipo' ? (
                fotoEquipo ? (
                  <FotoGirada src={fotoEquipo.url} alt={`Captura de Space Eyes de ${equipo.nombre}`} giro={fotoEquipo.giro} />
                ) : (
                  <Vacio texto="Este equipo todavía no ha subido ninguna foto." />
                )
              ) : fotoCliente ? (
                <FotoGirada src={fotoCliente} alt={`Foto del cliente de ${equipo.nombre}`} />
              ) : (
                <Vacio
                  texto={
                    pantalla
                      ? 'Nadie ha subido todavía una foto de esta pantalla. Usa «Subir foto».'
                      : 'Este equipo no tiene una pantalla asignada, así que no hay galería donde guardar la foto del cliente.'
                  }
                />
              )}

              {/* La barra de estado, SOBRE la fotografía */}
              <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-gradient-to-b from-black/80 via-black/45 to-transparent p-3">
                <PildoraConexion online={enLinea} pendiente={!equipo.ultimaConexion} sobreFoto />
                <span className="text-[12px] text-white/85">
                  Última conexión <strong className="font-semibold text-white">{hace(equipo.ultimaConexion)}</strong>
                </span>
                <span className="text-[12px] text-white/85">
                  Batería <strong className="font-semibold text-white">{equipo.bateriaPct != null ? `${equipo.bateriaPct}%` : '—'}</strong>
                </span>
                <span className="text-[12px] text-white/85">
                  {equipo.redOperador ?? (equipo.redTipo === 'WIFI' ? 'WiFi' : 'Red')}{' '}
                  <strong className="font-semibold text-white">{senal.texto}</strong>
                  {equipo.senalDbm != null && <span className="text-white/60"> · {equipo.senalDbm} dBm</span>}
                </span>
                {fotoEquipo?.tomadaEn && vista === 'equipo' && (
                  <span className="ml-auto text-[12px] text-white/85">
                    Última captura <strong className="font-semibold text-white">{hace(fotoEquipo.tomadaEn)}</strong>
                  </span>
                )}
              </div>

              {/* Sello de origen y acciones sobre la imagen */}
              {((vista === 'equipo' && fotoEquipo) || (vista === 'cliente' && fotoCliente)) && (
                <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/75 to-transparent p-3">
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.07em] text-white',
                        vista === 'equipo' ? 'bg-accent' : 'bg-[#7c3aed]',
                      )}
                    >
                      {vista === 'equipo' ? 'CAPTURA SPACE EYES' : 'FOTO DEL CLIENTE'}
                    </span>
                    <div className="mt-1.5 text-[12px] tabular-nums text-white/90">
                      {vista === 'equipo'
                        ? `${fechaHora(fotoEquipo?.tomadaEn ?? null)}${fotoEquipo?.origen ? ` · ${fotoEquipo.origen === 'on_demand' ? 'a demanda' : 'programada'}` : ''}`
                        : 'Subida a la galería de la pantalla'}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Ampliar"
                    onClick={() => setAmpliada(vista === 'equipo' ? (fotoEquipo?.url ?? null) : fotoCliente)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/25 bg-black/45 text-white hover:bg-black/65"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  {vista === 'equipo' && fotoEquipo && (
                    <a
                      href={fotoEquipo.url}
                      download
                      aria-label="Descargar"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/25 bg-black/45 text-white hover:bg-black/65"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Velo mientras el equipo va por la foto */}
              {(captura === 'pidiendo' || captura === 'esperando') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                  <Loader2 className="h-9 w-9 animate-spin text-white" strokeWidth={1.5} />
                  <div className="text-[14px] font-medium text-white">Pidiéndole la foto al equipo…</div>
                  <div className="text-[12px] text-white/70">Suele tardar entre 5 y 20 segundos</div>
                </div>
              )}
            </div>
          )}

          {/* Veredicto de IA + capturas recientes */}
          {vista !== 'vivo' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border p-3">
            {fotoEquipo ? <Veredicto foto={fotoEquipo} /> : <span className="text-[12px] text-muted">Sin capturas</span>}
            {fotoEquipo?.ancho && (
              <>
                <span className="h-4 w-px bg-border" />
                <span className="text-[12px] tabular-nums text-muted">
                  {fotoEquipo.ancho} × {fotoEquipo.alto}
                </span>
              </>
            )}
            {fotoEquipo?.gps && (
              <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-muted">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.7} />
                {fotoEquipo.gps.lat.toFixed(5)}, {fotoEquipo.gps.lng.toFixed(5)}
              </span>
            )}

            {fotos.length > 1 && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-muted">Recientes</span>
                {fotos.slice(0, 5).map((f, i) => (
                  <button
                    key={`${f.url}-${i}`}
                    type="button"
                    onClick={() => {
                      setFotoElegida(i)
                      setVista('equipo')
                    }}
                    aria-label={`Captura del ${fechaHora(f.tomadaEn)}`}
                    className={cn(
                      'relative h-9 w-14 overflow-hidden rounded border',
                      i === fotoElegida ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-border-strong',
                    )}
                  >
                    <FotoGirada src={f.url} alt="" giro={f.giro} />
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        {/* ── Lo técnico ── */}
        <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[340px]">
          <Tarjeta titulo="Energía">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold leading-none text-ink">
                {equipo.bateriaPct != null ? `${equipo.bateriaPct}%` : '—'}
              </span>
              {equipo.cargando != null && (
                <span className={cn('text-[12px]', equipo.cargando ? 'text-success' : 'text-muted')}>
                  {equipo.cargando ? 'cargando' : 'sin cargar'}
                </span>
              )}
            </div>
            {equipo.bateriaPct != null && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    'h-full',
                    equipo.bateriaPct >= 50 ? 'bg-success' : equipo.bateriaPct >= 20 ? 'bg-warning' : 'bg-error',
                  )}
                  style={{ width: `${Math.max(2, equipo.bateriaPct)}%` }}
                />
              </div>
            )}
            <div className="mt-3 flex gap-5">
              <Dato etiqueta="Temp. batería" valor={equipo.bateriaTemp != null ? `${equipo.bateriaTemp} °C` : null} />
              <Dato etiqueta="Temp. equipo" valor={equipo.equipoTemp != null ? `${equipo.equipoTemp} °C` : null} />
            </div>
          </Tarjeta>

          <Tarjeta titulo="Conexión">
            <div className="flex items-center gap-2.5">
              <Senal dbm={equipo.senalDbm} tipo={equipo.redTipo} operador={equipo.redOperador} className="text-[13px]" />
              <span className="text-[12px] text-muted">
                {senal.texto}
                {equipo.senalDbm != null ? ` · ${equipo.senalDbm} dBm` : ''}
              </span>
            </div>
            {equipo.datos && (equipo.datos.movilMes != null || equipo.datos.wifiMes != null) && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-muted">Datos de este mes</span>
                  <span className="tabular-nums text-ink">
                    {gigas((equipo.datos.movilMes ?? 0) + (equipo.datos.wifiMes ?? 0))}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-[11px] text-muted">
                  <span>Móvil {gigas(equipo.datos.movilMes)}</span>
                  <span>WiFi {gigas(equipo.datos.wifiMes)}</span>
                </div>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Pantalla asociada">
            {pantalla ? (
              <div className="flex gap-3">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {fotoCliente ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoCliente} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{pantalla.nombre}</div>
                  <div className="text-[11px] tabular-nums text-muted">{equipo.codigoPantalla}</div>
                  <Link href={`/comercial?sitio=${pantalla.id}`} className="text-[12px] font-medium text-accent hover:underline">
                    Abrir la ficha →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-muted">
                Ningún sitio de tu inventario tiene el código{' '}
                <span className="tabular-nums text-ink">{equipo.codigoPantalla ?? '—'}</span>, así que este equipo no está
                enlazado a una pantalla.
              </p>
            )}
          </Tarjeta>

          {/* Secundario y plegado: la ficha no espera por el histórico */}
          <Historial id={equipo.id} />

          <Tarjeta titulo="Detalles del equipo">
            <dl className="flex flex-col gap-2">
              <Fila etiqueta="Modelo" valor={[equipo.fabricante, equipo.modelo].filter(Boolean).join(' ') || null} />
              <Fila etiqueta="Versión del agente" valor={equipo.versionApp} />
              <Fila etiqueta="Almacenamiento libre" valor={equipo.almacenamientoLibreMb != null ? `${equipo.almacenamientoLibreMb} MB` : null} />
              <Fila etiqueta="Capturas guardadas" valor={`${fotos.length}`} />
            </dl>
          </Tarjeta>
        </div>
      </div>

      </TabPanel>

      <TabPanel value="pantalla" className="flex flex-col gap-4 pt-4">
        <PantallaConfig equipoId={equipo.id} puedeOperar={puedeOperar} onCambio={() => setVersion((v) => v + 1)} />
        {/* Lo que el equipo vio en su pantalla: fallas e historial (APK 0.15+) */}
        <PantallaYCreativos key={version} id={equipo.id} onAmpliar={setAmpliada} soloFallas />
      </TabPanel>

      <TabPanel value="creativos" className="pt-4">
        <CreativosConfig equipoId={equipo.id} puedeOperar={puedeOperar} onAmpliar={setAmpliada} onCambio={() => setVersion((v) => v + 1)} />
      </TabPanel>

      <TabPanel value="equipo" className="pt-4">
        <EquipoAdmin equipoId={equipo.id} puedeOperar={puedeOperar} onCambio={() => { void traer() }} />
      </TabPanel>
      </Tabs>

      {/* Lightbox */}
      <Modal open={!!ampliada} onOpenChange={(v) => !v && setAmpliada(null)} size="lg" title={equipo.nombre}>
        {ampliada && <VisorFoto src={ampliada} alt={`Fotografía de ${equipo.nombre}`} />}
      </Modal>
    </div>
  )
}

function Pestana({
  activa,
  onClick,
  icono,
  disabled,
  children,
}: {
  activa: boolean
  onClick: () => void
  icono: React.ReactNode
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[12px] font-medium transition-colors',
        activa
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border-strong bg-surface text-ink hover:bg-surface-2',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-surface',
      )}
    >
      {icono}
      {children}
    </button>
  )
}

function Panel({
  sello,
  selloClase,
  url,
  giro = 0,
  pie,
  alt,
  onAmpliar,
}: {
  sello: string
  selloClase: string
  url: string | null
  giro?: number
  pie: string
  alt: string
  onAmpliar: (url: string) => void
}) {
  return (
    <div className="bg-surface">
      <div className="flex items-center gap-2 p-2.5">
        <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.07em] text-white', selloClase)}>{sello}</span>
        <span className="truncate text-[11px] text-muted">{pie}</span>
      </div>
      <div className="relative aspect-[4/3] max-h-[60vh] w-full bg-[#12100e]">
        {url ? (
          <button type="button" onClick={() => onAmpliar(url)} className="relative block h-full w-full" aria-label={`Ampliar: ${sello}`}>
            <FotoGirada src={url} alt={alt} giro={giro} />
          </button>
        ) : (
          <Vacio texto="Sin fotografía" />
        )}
      </div>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <CameraOff className="h-7 w-7 text-white/35" strokeWidth={1.4} />
      <span className="text-[12px] text-white/60">{texto}</span>
    </div>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{titulo}</div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{etiqueta}</div>
      <div className={cn('text-[13px] tabular-nums', valor ? 'text-ink' : 'text-muted')}>{valor ?? 'sin dato'}</div>
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <dt className="text-muted">{etiqueta}</dt>
      <dd className={cn('text-right', valor ? 'text-ink' : 'text-muted')}>{valor ?? 'sin dato'}</dd>
    </div>
  )
}

// Dictamen de IA de la captura. Mismos tres estados que la ficha comercial, para
// que una foto no signifique una cosa en una pantalla y otra en la de al lado.
function Veredicto({ foto }: { foto: FotoEquipo }) {
  const pct = foto.score != null ? `${Math.round(foto.score * 100)}%` : null
  if (foto.esCorrecta === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0f7a55]">
        <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} /> Anuncio correcto{pct ? ` · confianza ${pct}` : ''}
      </span>
    )
  }
  if (foto.esCorrecta === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-error">
        <XCircle className="h-4 w-4" strokeWidth={1.8} /> No coincide con la creatividad{pct ? ` · ${pct}` : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <CircleHelp className="h-4 w-4" strokeWidth={1.8} /> Verificación de IA pendiente
    </span>
  )
}
