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
  return (
    <span
      className={cn(
        'inline-flex items-center rounded bg-[#7c3aed] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.07em] text-white',
        className,
      )}
    >
      EJEMPLO
    </span>
  )
}

// Un espectacular dibujado: cielo, poste y una pantalla de 5 x 3 gabinetes con
// un anuncio. Con `falla`, dos gabinetes apagados marcados como en la
// evidencia real (recuadro rojo y franja con el texto).
function Espectacular({ anuncio, falla = false, noche = false }: { anuncio: 'a' | 'b' | 'c'; falla?: boolean; noche?: boolean }) {
  const colores = { a: ['#0ea5e9', '#f59e0b'], b: ['#16a34a', '#facc15'], c: ['#db2777', '#f97316'] }[anuncio]
  const textos = { a: ['TU MARCA', 'AQUÍ'], b: ['OFERTA', 'DE TEMPORADA'], c: ['NUEVO', 'LANZAMIENTO'] }[anuncio]
  const x0 = 70, y0 = 30, w = 260, h = 130, cols = 5, filas = 3
  const apagados = falla ? [[0, 3], [1, 3]] : []
  return (
    <svg viewBox="0 0 400 225" className="h-full w-full" role="img" aria-label="Ilustración de un espectacular de ejemplo">
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
          <text x="8" y="15" fontSize="11" fontWeight="600" fill="white">Varios gabinetes apagados · Gabinetes 4, 9 (2 de 15)</text>
        </>
      )}
    </svg>
  )
}

const EQUIPOS = [
  { nombre: 'Av. Principal 120 · Cara A', ciudad: 'Ciudad de ejemplo', anuncio: 'a' as const, online: true, bateria: 92, senal: 'buena', hace: 'hace 2 min', red: 'Móvil' },
  { nombre: 'Blvd. del Parque · Cara B', ciudad: 'Ciudad de ejemplo', anuncio: 'b' as const, online: true, bateria: 71, senal: 'regular', hace: 'hace 5 min', red: 'WiFi' },
  { nombre: 'Glorieta Norte', ciudad: 'Ciudad de ejemplo', anuncio: 'c' as const, online: false, bateria: 38, senal: '—', hace: 'hace 2 h', red: 'Móvil' },
]

const HISTORIAL = [
  { hora: '08:12', icono: Camera, texto: 'Foto programada tomada', tono: 'text-muted' },
  { hora: '10:47', icono: Sparkles, texto: 'Creativo nuevo detectado en la pantalla: se guardó su foto', tono: 'text-accent' },
  { hora: '11:05', icono: AlertTriangle, texto: 'Falla: 2 gabinetes apagados (con foto de evidencia)', tono: 'text-error' },
  { hora: '11:40', icono: CheckCircle2, texto: 'Falla recuperada: el equipo vio la pantalla completa otra vez', tono: 'text-success' },
  { hora: '14:00', icono: Camera, texto: 'Foto pedida desde la oficina, recibida en 9 segundos', tono: 'text-muted' },
]

const BENEFICIOS = [
  { icono: ShieldCheck, titulo: 'Prueba de exhibición', texto: 'Fotos con fecha, hora y ubicación de cada anuncio al aire, listas para enviar al cliente.' },
  { icono: AlertTriangle, titulo: 'Fallas antes que el cliente', texto: 'El equipo detecta gabinetes apagados o una pantalla congelada y avisa con la foto del problema.' },
  { icono: Truck, titulo: 'Menos visitas al sitio', texto: 'Foto o vista en vivo desde la oficina cuando la necesites, sin mandar a nadie.' },
  { icono: Sparkles, titulo: 'Qué estuvo al aire', texto: 'Cada creativo nuevo que aparece en la pantalla queda registrado con su foto.' },
]

export function DemoSpaceEyes() {
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
          {resultado === 'ok' ? 'Solicitud enviada' : 'Solicitar activación'}
        </Button>
      ) : (
        <p className="text-[13px] text-muted">Para activarlo, pide a un administrador de tu empresa que lo solicite desde esta misma pantalla.</p>
      )}
      {resultado === 'ok' && (
        <p className="text-[12px] text-success">
          Listo: recibimos tu solicitud{folio ? ` (folio ${folio})` : ''} y te contactaremos. Puedes seguirla en
          Administración › Configuración › Soporte.
        </p>
      )}
      {resultado === 'error' && <p className="text-[12px] text-error">No se pudo enviar la solicitud. Inténtalo de nuevo en unos minutos.</p>}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Aviso permanente: esto es una demostración */}
      <div className="flex items-center gap-2 rounded-md border border-[#7c3aed40] bg-[#7c3aed12] px-3 py-2 text-[12px] text-ink">
        <Ejemplo />
        <span>
          Estás viendo una <strong>demostración</strong> con datos de ejemplo. Tu empresa todavía no tiene Space Eyes activado; ninguno de estos equipos es tuyo.
        </span>
      </div>

      {/* Presentación */}
      <section className="grid items-center gap-6 rounded-md border border-border bg-surface p-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-accent">
            <Eye className="h-4 w-4" /> Space Eyes
          </div>
          <h1 className="text-[22px] font-semibold leading-tight text-ink sm:text-[26px]">Tus pantallas, vistas desde el sitio, sin ir al sitio</h1>
          <p className="text-[14px] leading-relaxed text-muted">
            Un equipo pequeño junto a cada pantalla (teléfono, Raspberry o cámara IP) toma fotos de lo que está al aire, avisa
            cuando algo falla y te deja verla en vivo desde aquí. Todo queda dentro de SPACE OS, con los permisos de tu empresa.
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
        <h2 className="text-[15px] font-semibold text-ink">Así se ven tus equipos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPOS.map((e) => (
            <div key={e.nombre} className="overflow-hidden rounded-md border border-border bg-surface">
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
                  {e.online ? 'EN LÍNEA' : 'SIN COMUNICACIÓN'}
                </span>
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white">
                  <Clock className="h-3 w-3" /> {e.hace}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="truncate text-[13px] font-semibold text-ink">{e.nombre}</div>
                <div className="flex items-center gap-1 text-[12px] text-muted">
                  <MapPin className="h-3 w-3" /> {e.ciudad}
                </div>
                <div className="flex items-center gap-4 border-t border-border pt-2 text-[12px] text-ink">
                  <span className="inline-flex items-center gap-1">
                    <Battery className="h-3.5 w-3.5 text-success" /> {e.bateria}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {e.red === 'WiFi' ? <Wifi className="h-3.5 w-3.5" /> : <SignalHigh className="h-3.5 w-3.5" />} {e.red} · {e.senal}
                  </span>
                </div>
                {!e.online && (
                  <p className="text-[11.5px] text-error">
                    Sin comunicación desde hace 2 h. Así se ve cuando un equipo deja de reportar: nunca se da por funcionando solo
                    por estar registrado.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ficha de ejemplo: foto, evidencia, metricas e historial */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-ink">El detalle de un equipo</h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="relative aspect-video">
                <Espectacular anuncio="b" />
                <Ejemplo className="absolute right-2 top-2" />
              </div>
              <figcaption className="flex items-center gap-2 p-2.5 text-[12px] text-muted">
                <ImageIcon className="h-3.5 w-3.5" /> Captura · 08:12 · con fecha, hora y nombre del sitio
              </figcaption>
            </figure>
            <figure className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="relative aspect-video">
                <Espectacular anuncio="b" falla />
                <Ejemplo className="absolute bottom-2 right-2" />
              </div>
              <figcaption className="flex items-center gap-2 p-2.5 text-[12px] text-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-error" /> Evidencia de una falla, marcada por el propio equipo
              </figcaption>
            </figure>
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Estado del equipo</span>
              <Ejemplo />
            </div>
            <dl className="divide-y divide-border">
              {[
                ['Conexión', 'En línea · Móvil, señal buena'],
                ['Última comunicación', 'hace 2 min'],
                ['Batería', '92 % · cargando'],
                ['Temperatura', '38 °C'],
                ['Datos este mes', '312 MB'],
                ['Vigilancia de la pantalla', 'Encendida · 15 gabinetes'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Historial y alertas de un día</span>
            <Ejemplo />
          </div>
          <ol className="flex flex-col gap-2">
            {HISTORIAL.map((h) => (
              <li key={h.hora + h.texto} className="flex items-start gap-3 text-[12.5px]">
                <span className="w-11 shrink-0 tabular-nums text-muted">{h.hora}</span>
                <h.icono className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', h.tono)} />
                <span className="text-ink">{h.texto}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Beneficios */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Para qué le sirve a tu operación</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-3">
              <b.icono className="h-5 w-5 text-accent" strokeWidth={1.7} />
              <div className="text-[13px] font-semibold text-ink">{b.titulo}</div>
              <p className="text-[12.5px] leading-relaxed text-muted">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[15px] font-semibold text-ink">¿Lo quieres para tus pantallas?</div>
          <p className="mt-1 text-[13px] text-muted">
            Al activarlo, esta sección se convierte en la de tus equipos reales. No hay que configurar nada de tu empresa.
          </p>
        </div>
        {accion}
      </section>
    </div>
  )
}
