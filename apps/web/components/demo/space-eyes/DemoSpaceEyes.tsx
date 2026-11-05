'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Battery,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  ImageIcon,
  Loader2,
  MapPin,
  ShieldCheck,
  SignalHigh,
  Sparkles,
  Truck,
  Wifi,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { crearTicketApi } from '@/lib/data/tickets-api'
import { useTexto } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { interpolarNodos } from '@/lib/i18n/nodos'

// ============================================================================
//  Space Eyes para una empresa que todavía no lo tiene.
// ----------------------------------------------------------------------------
//  En vez de una sección vacía o con errores, una demostración de lo que haría
//  por ella. TODO lo de aquí es de ejemplo y lo dice en cada tarjeta: no hay
//  ninguna llamada a Space Eye, ningún dato real ni foto de un cliente (las
//  imágenes son ilustraciones dibujadas aquí mismo). Nadie puede creer que ya
//  tiene equipos conectados.
//
//  "Solicitar activación" abre un ticket de soporte (el mismo canal que lee el
//  panel de SPACE OS). Al activarse, el layout del módulo deja de mostrar esto
//  y aparece la funcionalidad real, sin rehacer nada de la empresa.
// ============================================================================

function Ejemplo({ className }: { className?: string }) {
  const t = useTexto()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded bg-[#7c3aed] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.07em] text-white',
        className,
      )}
    >
      {t('spaceeyes.demo.ejemplo')}
    </span>
  )
}

// Un espectacular dibujado: cielo, poste y una pantalla de 5 x 3 gabinetes con
// un anuncio. Con `falla`, dos gabinetes apagados marcados como en la
// evidencia real (recuadro rojo y franja con el texto).
function Espectacular({ anuncio, falla = false, noche = false }: { anuncio: 'a' | 'b' | 'c'; falla?: boolean; noche?: boolean }) {
  const colores = { a: ['#0ea5e9', '#f59e0b'], b: ['#16a34a', '#facc15'], c: ['#db2777', '#f97316'] }[anuncio]
  const t = useTexto()
  const textos = (
    {
      a: ['spaceeyes.demo.anuncio.a1', 'spaceeyes.demo.anuncio.a2'],
      b: ['spaceeyes.demo.anuncio.b1', 'spaceeyes.demo.anuncio.b2'],
      c: ['spaceeyes.demo.anuncio.c1', 'spaceeyes.demo.anuncio.c2'],
    } as const
  )[anuncio].map((k) => t(k))
  const x0 = 70, y0 = 30, w = 260, h = 130, cols = 5, filas = 3
  const apagados = falla ? [[0, 3], [1, 3]] : []
  return (
    <svg viewBox="0 0 400 225" className="h-full w-full" role="img" aria-label={t('spaceeyes.demo.ilustracion')}>
      <defs>
        <linearGradient id={`cielo-${anuncio}-${noche}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={noche ? '#0f172a' : '#93c5fd'} />
          <stop offset="1" stopColor={noche ? '#1e293b' : '#e0f2fe'} />
        </linearGradient>
        <linearGradient id={`anuncio-${anuncio}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={colores[0]} />
          <stop offset="1" stopColor={colores[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#cielo-${anuncio}-${noche})`} />
      <rect y="190" width="400" height="35" fill={noche ? '#334155' : '#a3a3a3'} />
      <rect x="192" y="160" width="16" height="40" fill="#525252" />
      <rect x={x0 - 6} y={y0 - 6} width={w + 12} height={h + 12} rx="3" fill="#262626" />
      <rect x={x0} y={y0} width={w} height={h} fill={`url(#anuncio-${anuncio})`} />
      <text x={x0 + w / 2} y={y0 + 62} textAnchor="middle" fontSize="30" fontWeight="800" fill="white">{textos[0]}</text>
      <text x={x0 + w / 2} y={y0 + 95} textAnchor="middle" fontSize="18" fontWeight="600" fill="white">{textos[1]}</text>
      {/* La cuadricula de gabinetes */}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line key={`c${i}`} x1={x0 + ((i + 1) * w) / cols} x2={x0 + ((i + 1) * w) / cols} y1={y0} y2={y0 + h} stroke="#00000022" />
      ))}
      {Array.from({ length: filas - 1 }, (_, i) => (
        <line key={`f${i}`} x1={x0} x2={x0 + w} y1={y0 + ((i + 1) * h) / filas} y2={y0 + ((i + 1) * h) / filas} stroke="#00000022" />
      ))}
      {apagados.map(([f, c]) => (
        <rect key={`${f}-${c}`} x={x0 + (c * w) / cols} y={y0 + (f * h) / filas} width={w / cols} height={h / filas} fill="#0a0a0a" stroke="#ef4444" strokeWidth="3" />
      ))}
      {falla && (
        <>
          <rect x={x0 - 6} y={y0 - 6} width={w + 12} height={h + 12} rx="3" fill="none" stroke="white" strokeWidth="2" />
          <rect width="400" height="22" fill="#dc2626" opacity="0.92" />
          <text x="8" y="15" fontSize="11" fontWeight="600" fill="white">{t('spaceeyes.demo.falla-franja')}</text>
        </>
      )}
    </svg>
  )
}

// Todo es de ejemplo, y por eso tambien se traduce: el nombre del sitio y la
// ciudad son parte de la ilustracion, no datos de nadie.
const EQUIPOS: {
  id: string
  nombre: ClaveTexto
  anuncio: 'a' | 'b' | 'c'
  online: boolean
  bateria: number
  senal: ClaveTexto | null
  hace: ClaveTexto
  red: 'movil' | 'wifi'
}[] = [
  { id: 'a', nombre: 'spaceeyes.demo.equipo.a', anuncio: 'a', online: true, bateria: 92, senal: 'spaceeyes.senal.buena', hace: 'spaceeyes.demo.hace.2min', red: 'movil' },
  { id: 'b', nombre: 'spaceeyes.demo.equipo.b', anuncio: 'b', online: true, bateria: 71, senal: 'spaceeyes.senal.regular', hace: 'spaceeyes.demo.hace.5min', red: 'wifi' },
  { id: 'c', nombre: 'spaceeyes.demo.equipo.c', anuncio: 'c', online: false, bateria: 38, senal: null, hace: 'spaceeyes.demo.hace.2h', red: 'movil' },
]

const HISTORIAL: { hora: string; icono: typeof Camera; texto: ClaveTexto; tono: string }[] = [
  { hora: '08:12', icono: Camera, texto: 'spaceeyes.demo.historial.1', tono: 'text-muted' },
  { hora: '10:47', icono: Sparkles, texto: 'spaceeyes.demo.historial.2', tono: 'text-accent' },
  { hora: '11:05', icono: AlertTriangle, texto: 'spaceeyes.demo.historial.3', tono: 'text-error' },
  { hora: '11:40', icono: CheckCircle2, texto: 'spaceeyes.demo.historial.4', tono: 'text-success' },
  { hora: '14:00', icono: Camera, texto: 'spaceeyes.demo.historial.5', tono: 'text-muted' },
]

const BENEFICIOS: { icono: typeof Camera; titulo: ClaveTexto; texto: ClaveTexto }[] = [
  { icono: ShieldCheck, titulo: 'spaceeyes.demo.beneficio.1.titulo', texto: 'spaceeyes.demo.beneficio.1.texto' },
  { icono: AlertTriangle, titulo: 'spaceeyes.demo.beneficio.2.titulo', texto: 'spaceeyes.demo.beneficio.2.texto' },
  { icono: Truck, titulo: 'spaceeyes.demo.beneficio.3.titulo', texto: 'spaceeyes.demo.beneficio.3.texto' },
  { icono: Sparkles, titulo: 'spaceeyes.demo.beneficio.4.titulo', texto: 'spaceeyes.demo.beneficio.4.texto' },
]

const ESTADO_EJEMPLO: [ClaveTexto, ClaveTexto][] = [
  ['spaceeyes.demo.estado.conexion', 'spaceeyes.demo.estado.conexion.v'],
  ['spaceeyes.demo.estado.ultima', 'spaceeyes.demo.hace.2min'],
  ['spaceeyes.demo.estado.bateria', 'spaceeyes.demo.estado.bateria.v'],
  ['spaceeyes.demo.estado.temperatura', 'spaceeyes.demo.estado.temperatura.v'],
  ['spaceeyes.demo.estado.datos', 'spaceeyes.demo.estado.datos.v'],
  ['spaceeyes.demo.estado.vigilancia', 'spaceeyes.demo.estado.vigilancia.v'],
]

export function DemoSpaceEyes() {
  const t = useTexto()
  const puedeSolicitar = usePuede('administracion', 'crear')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<'ok' | 'error' | null>(null)
  // El folio del ticket: prueba de que la solicitud SÍ se creó (y con qué
  // buscarla). El padre la ve arriba de su lista de empresas.
  const [folio, setFolio] = useState<string | null>(null)

  async function solicitar() {
    setEnviando(true)
    setResultado(null)
    try {
      // El ticket es un DATO que lee soporte en el padre: va en español siempre.
      const ticket = await crearTicketApi({
        asunto: 'Solicitud de activación de Space Eyes',
        cuerpo:
          'Nos interesa activar Space Eyes (cámaras que vigilan nuestras pantallas: fotos de exhibición, fallas y creativos). ' +
          'Solicitud enviada desde la demostración del módulo en SPACE OS.',
        prioridad: 'NORMAL',
      })
      setFolio(ticket?.folio ?? null)
      setResultado('ok')
    } catch {
      setResultado('error')
    } finally {
      setEnviando(false)
    }
  }

  const accion = (
    <div className="flex flex-col items-start gap-2">
      {puedeSolicitar ? (
        <Button variant="primary" size="md" onClick={() => void solicitar()} disabled={enviando || resultado === 'ok'}>
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          {resultado === 'ok' ? t('spaceeyes.demo.enviada') : t('spaceeyes.demo.solicitar')}
        </Button>
      ) : (
        <p className="text-[13px] text-muted">{t('spaceeyes.demo.sin-permiso')}</p>
      )}
      {resultado === 'ok' && (
        <p className="text-[12px] text-success">
          {folio ? t('spaceeyes.demo.listo.folio', { folio }) : t('spaceeyes.demo.listo')}
        </p>
      )}
      {resultado === 'error' && <p className="text-[12px] text-error">{t('spaceeyes.demo.error')}</p>}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Aviso permanente: esto es una demostración */}
      <div className="flex items-center gap-2 rounded-md border border-[#7c3aed40] bg-[#7c3aed12] px-3 py-2 text-[12px] text-ink">
        <Ejemplo />
        <span>
          {interpolarNodos(t('spaceeyes.demo.aviso'), { demo: <strong>{t('spaceeyes.demo.aviso.demo')}</strong> })}
        </span>
      </div>

      {/* Presentación */}
      <section className="grid items-center gap-6 rounded-md border border-border bg-surface p-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-accent">
            <Eye className="h-4 w-4" /> Space Eyes
          </div>
          <h1 className="text-[22px] font-semibold leading-tight text-ink sm:text-[26px]">{t('spaceeyes.demo.titulo')}</h1>
          <p className="text-[14px] leading-relaxed text-muted">
            {t('spaceeyes.demo.lema.1')}
            <br />
            {t('spaceeyes.demo.lema.2')}
          </p>
          {accion}
        </div>
        <div className="relative aspect-video overflow-hidden rounded-md border border-border">
          <Espectacular anuncio="a" />
          <Ejemplo className="absolute left-2 top-2" />
        </div>
      </section>

      {/* Lista de equipos de ejemplo */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{t('spaceeyes.demo.equipos')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPOS.map((e) => (
            <div key={e.id} className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="relative aspect-video">
                <Espectacular anuncio={e.anuncio} noche={!e.online} />
                <Ejemplo className="absolute right-2 top-2" />
                <span
                  className={cn(
                    'absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white',
                    e.online ? 'bg-[#16a34a]' : 'bg-black/70',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', e.online ? 'bg-white' : 'bg-error')} />
                  {(e.online ? t('spaceeyes.conexion.en-linea') : t('spaceeyes.conexion.sin')).toUpperCase()}
                </span>
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white">
                  <Clock className="h-3 w-3" /> {t(e.hace)}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="truncate text-[13px] font-semibold text-ink">{t(e.nombre)}</div>
                <div className="flex items-center gap-1 text-[12px] text-muted">
                  <MapPin className="h-3 w-3" /> {t('spaceeyes.demo.ciudad')}
                </div>
                <div className="flex items-center gap-4 border-t border-border pt-2 text-[12px] text-ink">
                  <span className="inline-flex items-center gap-1">
                    <Battery className="h-3.5 w-3.5 text-success" /> {e.bateria}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {e.red === 'wifi' ? <Wifi className="h-3.5 w-3.5" /> : <SignalHigh className="h-3.5 w-3.5" />} {e.red === 'wifi' ? 'WiFi' : t('spaceeyes.senal.movil')} · {e.senal ? t(e.senal) : '—'}
                  </span>
                </div>
                {!e.online && (
                  <p className="text-[11.5px] text-error">
                    {t('spaceeyes.demo.caido')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ficha de ejemplo: foto, evidencia, metricas e historial */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{t('spaceeyes.demo.detalle')}</h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="relative aspect-video">
                <Espectacular anuncio="b" />
                <Ejemplo className="absolute right-2 top-2" />
              </div>
              <figcaption className="flex items-center gap-2 p-2.5 text-[12px] text-muted">
                <ImageIcon className="h-3.5 w-3.5" /> {t('spaceeyes.demo.captura')}
              </figcaption>
            </figure>
            <figure className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="relative aspect-video">
                <Espectacular anuncio="b" falla />
                <Ejemplo className="absolute bottom-2 right-2" />
              </div>
              <figcaption className="flex items-center gap-2 p-2.5 text-[12px] text-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-error" /> {t('spaceeyes.demo.evidencia')}
              </figcaption>
            </figure>
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{t('spaceeyes.demo.estado')}</span>
              <Ejemplo />
            </div>
            <dl className="divide-y divide-border">
              {ESTADO_EJEMPLO.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-muted">{t(k)}</dt>
                  <dd className="text-right text-ink">{t(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">{t('spaceeyes.demo.historial')}</span>
            <Ejemplo />
          </div>
          <ol className="flex flex-col gap-2">
            {HISTORIAL.map((h) => (
              <li key={h.hora} className="flex items-start gap-3 text-[12.5px]">
                <span className="w-11 shrink-0 tabular-nums text-muted">{h.hora}</span>
                <h.icono className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', h.tono)} />
                <span className="text-ink">{t(h.texto)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Beneficios */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{t('spaceeyes.demo.beneficios')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-3">
              <b.icono className="h-5 w-5 text-accent" strokeWidth={1.7} />
              <div className="text-[13px] font-semibold text-ink">{t(b.titulo)}</div>
              <p className="text-[12.5px] leading-relaxed text-muted">{t(b.texto)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[15px] font-semibold text-ink">{t('spaceeyes.demo.cierre')}</div>
          <p className="mt-1 text-[13px] text-muted">
            {t('spaceeyes.demo.cierre.texto')}
          </p>
        </div>
        {accion}
      </section>
    </div>
  )
}
