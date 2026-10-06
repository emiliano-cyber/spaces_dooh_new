'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import qrcode from 'qrcode-generator'
import {
  Cable,
  Check,
  ChevronLeft,
  Copy,
  Cpu,
  Download,
  Eye,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { infoAltaApi, type InfoAlta } from '@/lib/data/space-eyes-api'
import { seApi, ErrorSE } from '@/lib/data/space-eyes-se'
import { kitRaspberry } from '@/lib/space-eyes-kit-pi'
import { fechaHora } from './piezas'

// ============================================================================
//  Agregar un dispositivo a Space Eyes, sin saber de servidores ni comandos.
// ----------------------------------------------------------------------------
//  Un equipo NUEVO entra a la empresa solo con un CODIGO DE VINCULACION que se
//  genera aqui: de un solo uso, con vencimiento, cancelable, y con constancia
//  de quien lo genero y con que equipo se uso. El equipo no lleva credenciales
//  dentro: el codigo es su permiso de entrada, y al usarlo recibe su propia
//  llave. Sin codigo, el Space Eye de la empresa no lo deja entrar.
//
//    - Telefono: un QR que la app escanea (trae el servidor y el codigo, asi
//      la misma app sirve para cualquier empresa). Vence en 1 hora.
//    - Raspberry: el archivo para la microSD (se instala sola al encender) o,
//      si ya esta encendida, un comando. Vence en 14 dias: la tarjeta se
//      prepara en la oficina y se instala despues.
//    - PC: el codigo que pide el asistente de instalacion. 14 dias.
// ============================================================================

type Tipo = 'telefono' | 'raspberry' | 'pc'

interface Vinculacion {
  codigo: string
  tipo: Tipo
  nota: string | null
  estado: 'vigente' | 'usado' | 'vencido' | 'cancelado'
  creado_por: string | null
  creado_en: string
  expira_en: string
  usado_en: string | null
  equipo: { id: number; nombre: string | null } | null
  servidor?: string
  enlace?: string
}

const TIPOS: { id: Tipo; etiqueta: string; detalle: string; icono: typeof Smartphone }[] = [
  { id: 'telefono', etiqueta: 'Teléfono Android', detalle: 'Se vincula escaneando un QR', icono: Smartphone },
  { id: 'raspberry', etiqueta: 'Raspberry Pi', detalle: 'Se instala sola desde la microSD', icono: Cpu },
  { id: 'pc', etiqueta: 'PC con cámara IP', detalle: 'Con un código en el instalador', icono: MonitorSmartphone },
]

const NOMBRE_TIPO: Record<Tipo, string> = { telefono: 'Teléfono', raspberry: 'Raspberry', pc: 'PC' }

function descargar(nombre: string, datos: Uint8Array, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos as Uint8Array<ArrayBuffer>], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function mensaje(e: unknown): string {
  if (e instanceof ErrorSE) {
    const c = (e.cuerpo as { error?: string } | null)?.error
    if (e.status === 403) return 'No tienes permiso para agregar equipos.'
    if (c) return `No se pudo: ${c}`
  }
  return e instanceof Error ? e.message : 'No se pudo completar'
}

function Copiar({ texto, etiqueta = 'Copiar' }: { texto: string; etiqueta?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        void navigator.clipboard?.writeText(texto)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
    >
      {ok ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {ok ? 'Copiado' : etiqueta}
    </Button>
  )
}

function Qr({ texto }: { texto: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(texto)
    q.make()
    return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true })
  }, [texto])
  // El SVG lo arma la libreria con nuestro propio texto: no hay HTML ajeno.
  return <div className="mx-auto w-full max-w-[240px] rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] text-ink">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">{n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function CodigoGrande({ v }: { v: Vinculacion }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
      <KeyRound className="h-4 w-4 text-muted" />
      <span className="font-mono text-[22px] font-semibold tracking-[0.12em] text-ink">{v.codigo}</span>
      <span className="text-[12px] text-muted">Sirve una sola vez · vence {fechaHora(v.expira_en)}</span>
      <span className="ml-auto">
        <Copiar texto={v.codigo} />
      </span>
    </div>
  )
}

export function AltaDispositivo() {
  const puedeCrear = usePuede('inventario', 'crear')
  const [tipo, setTipo] = useState<Tipo>('telefono')
  const [info, setInfo] = useState<InfoAlta | null>(null)
  const [lista, setLista] = useState<Vinculacion[] | null>(null)
  const [generado, setGenerado] = useState<Vinculacion | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Raspberry
  const [modoPi, setModoPi] = useState<'sola' | 'encendida'>('sola')
  const [nombre, setNombre] = useState('')
  const [conexion, setConexion] = useState<'cable' | 'wifi'>('wifi')
  const [red, setRed] = useState('')
  const [clave, setClave] = useState('')
  const [kitListo, setKitListo] = useState(false)

  const recargar = useCallback(async () => {
    try {
      const r = await seApi<{ vinculaciones: Vinculacion[] }>('vinculaciones')
      setLista(r.vinculaciones)
    } catch {
      setLista([])
    }
  }, [])

  useEffect(() => {
    void infoAltaApi().then(setInfo).catch(() => setInfo(null))
    void recargar()
  }, [recargar])

  useEffect(() => {
    setGenerado(null)
    setError(null)
    setKitListo(false)
  }, [tipo, modoPi])

  async function generar(nota?: string): Promise<Vinculacion | null> {
    setTrabajando(true)
    setError(null)
    try {
      const v = await seApi<Vinculacion>('vinculaciones', { method: 'POST', body: { tipo, ...(nota ? { nota } : {}) } })
      setGenerado(v)
      void recargar()
      return v
    } catch (e) {
      setError(mensaje(e))
      return null
    } finally {
      setTrabajando(false)
    }
  }

  async function descargarKit() {
    if (conexion === 'wifi' && !red.trim()) {
      setError('Escribe el nombre de la red WiFi del sitio, o elige "Cable o módem".')
      return
    }
    const v = await generar(nombre.trim() || undefined)
    if (!v || !v.servidor) return
    const datos = kitRaspberry({
      servidor: v.servidor,
      codigo: v.codigo,
      nombre: nombre.trim(),
      wifi: conexion === 'wifi' ? { red: red.trim(), clave } : null,
    })
    descargar(`space-eye-raspberry-${v.codigo}.zip`, datos, 'application/zip')
    setKitListo(true)
    // La clave del WiFi no se queda en la pantalla: ya va en el archivo.
    setClave('')
  }

  async function cancelar(codigo: string) {
    try {
      await seApi(`vinculaciones/${codigo}`, { method: 'DELETE' })
    } catch {
      /* si ya no estaba vigente, la lista lo dira */
    }
    if (generado?.codigo === codigo) setGenerado(null)
    void recargar()
  }

  const comandoPi = generado?.servidor
    ? `curl -fsSL ${generado.servidor}/instalar-pi.sh | sudo bash -s -- --servidor ${generado.servidor} --codigo ${generado.codigo}`
    : ''

  const botonGenerar = (
    <div>
      <Button variant="primary" size="md" onClick={() => void generar()} disabled={trabajando}>
        {trabajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        Generar código
      </Button>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-6 sm:px-6">
      <Link href="/space-eyes" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Space Eyes
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-ink">Agregar dispositivo</h1>
          <p className="text-[13px] text-muted">
            Cada equipo nuevo entra con un código de un solo uso que se genera aquí. Elige qué equipo vas a instalar.
          </p>
        </div>
      </div>

      {/* Tipo de equipo */}
      <div className="grid gap-2 sm:grid-cols-3">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTipo(t.id)}
            className={cn(
              'flex items-center gap-3 rounded-md border p-3 text-left transition-colors',
              tipo === t.id ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <t.icono className={cn('h-5 w-5 shrink-0', tipo === t.id ? 'text-accent' : 'text-muted')} strokeWidth={1.7} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{t.etiqueta}</span>
              <span className="block text-[12px] text-muted">{t.detalle}</span>
            </span>
          </button>
        ))}
      </div>

      {!puedeCrear && (
        <p className="rounded-md border border-border bg-surface p-3 text-[13px] text-muted">
          Para agregar equipos necesitas permiso de edición en Inventario. Pídeselo a un administrador de tu empresa.
        </p>
      )}
      {error && <p className="rounded-md border border-[#dc262640] bg-error-soft p-3 text-[13px] text-[#b91c1c]">{error}</p>}

      {/* ── Teléfono ── */}
      {tipo === 'telefono' && puedeCrear && (
        <section className="grid gap-4 rounded-md border border-border bg-surface p-4 lg:grid-cols-[1fr_300px]">
          <ol className="flex flex-col gap-3">
            <Paso n={1}>
              Instala la app <strong>Space Eye</strong> en el teléfono
              {info?.apk ? (
                <>
                  {' '}
                  (
                  <a href={info.apk.url} className="text-accent hover:underline">
                    descargar la app {info.apk.version}
                  </a>
                  )
                </>
              ) : null}
              .
            </Paso>
            <Paso n={2}>Genera el código y ábrelo junto al teléfono.</Paso>
            <Paso n={3}>
              En la app, toca <strong>Vincular</strong> y escanea el QR. Si la cámara no lo lee, escribe el código.
            </Paso>
            <Paso n={4}>El teléfono aparece en Equipos en unos segundos. Ahí le pones el nombre del sitio.</Paso>
            {generado ? <CodigoGrande v={generado} /> : botonGenerar}
          </ol>
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-3">
            {generado?.enlace ? (
              <>
                <Qr texto={generado.enlace} />
                <span className="text-center text-[12px] text-muted">Escanéalo desde la app Space Eye</span>
              </>
            ) : (
              <span className="text-center text-[12px] text-muted">Aquí aparecerá el QR</span>
            )}
          </div>
        </section>
      )}

      {/* ── Raspberry ── */}
      {tipo === 'raspberry' && puedeCrear && (
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
          <div className="inline-flex w-fit rounded-md border border-border bg-surface p-0.5 text-[13px]">
            {(
              [
                ['sola', 'Se instala sola (recomendado)'],
                ['encendida', 'Ya está encendida'],
              ] as const
            ).map(([id, txt]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModoPi(id)}
                className={cn('rounded px-3 py-1.5', modoPi === id ? 'bg-accent text-white' : 'text-muted hover:text-ink')}
              >
                {txt}
              </button>
            ))}
          </div>

          {modoPi === 'sola' ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-muted">
                  Nombre del sitio (opcional)
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Av. Juárez 120 · Cara A"
                    maxLength={80}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                  />
                </label>
                <div className="flex flex-col gap-1 text-[12px] text-muted">
                  ¿Cómo se conecta a internet en el sitio?
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['wifi', 'WiFi', Wifi],
                        ['cable', 'Cable o módem', Cable],
                      ] as const
                    ).map(([id, txt, Icono]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setConexion(id)}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 text-[13px]',
                          conexion === id ? 'border-accent bg-accent-soft text-ink' : 'border-border text-muted hover:text-ink',
                        )}
                      >
                        <Icono className="h-4 w-4" /> {txt}
                      </button>
                    ))}
                  </div>
                </div>
                {conexion === 'wifi' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[12px] text-muted">
                      Nombre de la red
                      <input
                        value={red}
                        onChange={(e) => setRed(e.target.value)}
                        maxLength={64}
                        className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-muted">
                      Contraseña
                      <input
                        type="password"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                        maxLength={64}
                        autoComplete="new-password"
                        className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                      />
                    </label>
                    <p className="text-[11.5px] text-muted sm:col-span-2">
                      La contraseña solo se guarda dentro del archivo que descargas; no se envía a ningún servidor.
                    </p>
                  </div>
                )}
                <div>
                  <Button variant="primary" size="md" onClick={() => void descargarKit()} disabled={trabajando}>
                    {trabajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Descargar archivo para la microSD
                  </Button>
                </div>
                {kitListo && generado && (
                  <p className="text-[12.5px] text-success">
                    Listo: se descargó <strong>space-eye-raspberry-{generado.codigo}.zip</strong> con el código {generado.codigo}.
                    Sirve para una sola Raspberry y vence en 14 días.
                  </p>
                )}
              </div>
              <ol className="flex flex-col gap-3">
                <Paso n={1}>
                  En tu computadora, graba la microSD con <strong>Raspberry Pi Imager</strong>: Raspberry Pi OS Lite (64-bit).
                  Cuando pregunte si quieres personalizar, elige <strong>No</strong>.
                </Paso>
                <Paso n={2}>
                  Sin sacar la microSD, ábrela en el explorador (se llama <strong>bootfs</strong>) y copia ahí{' '}
                  <strong>user-data</strong> y <strong>network-config</strong> del archivo descargado. Reemplaza los que trae.
                </Paso>
                <Paso n={3}>Pon la microSD en la Raspberry, conecta la cámara, el cable o módem si se usa, y la fuente de 5V/3A.</Paso>
                <Paso n={4}>
                  En 5 a 15 minutos aparece sola en <strong>Equipos</strong>. Nadie tiene que conectarse a ella.
                </Paso>
              </ol>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-3">
                <Paso n={1}>Genera el código.</Paso>
                <Paso n={2}>En la Raspberry (con internet), abre una terminal y pega el comando.</Paso>
                <Paso n={3}>Aparece en Equipos en uno o dos minutos.</Paso>
              </ol>
              {!generado ? (
                botonGenerar
              ) : (
                <>
                  <CodigoGrande v={generado} />
                  <div className="flex flex-col gap-2 rounded-md bg-[#12100e] p-3">
                    <code className="break-all font-mono text-[12px] text-[#e7e5e4]">{comandoPi}</code>
                    <div>
                      <Copiar texto={comandoPi} etiqueta="Copiar comando" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── PC ── */}
      {tipo === 'pc' && puedeCrear && (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <ol className="flex flex-col gap-3">
            <Paso n={1}>
              Descarga el instalador en la PC del sitio
              {info?.agentePc ? (
                <>
                  {' '}
                  (
                  <a href={info.agentePc.url} className="text-accent hover:underline">
                    SpaceEyeAgente {info.agentePc.version}
                  </a>
                  )
                </>
              ) : null}{' '}
              y ábrelo.
            </Paso>
            <Paso n={2}>Genera el código y escríbelo cuando el asistente te lo pida, junto con la cámara IP.</Paso>
            <Paso n={3}>La PC aparece en Equipos al terminar el asistente.</Paso>
          </ol>
          {generado ? <CodigoGrande v={generado} /> : botonGenerar}
          {generado?.servidor && (
            <p className="text-[12px] text-muted">
              Dirección del servidor de tu empresa (el asistente la pide): <span className="font-mono text-ink">{generado.servidor}</span>
            </p>
          )}
        </section>
      )}

      {/* ── Códigos generados ── */}
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border p-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Códigos de vinculación</h2>
            <p className="text-[12px] text-muted">Los de los últimos 30 días. Uno vigente que ya no vayas a usar, cancélalo.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void recargar()} aria-label="Actualizar">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </header>
        {lista === null ? (
          <div className="flex items-center gap-2 p-3 text-[12px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
          </div>
        ) : lista.length === 0 ? (
          <p className="p-3 text-[12px] text-muted">Todavía no se ha generado ninguno.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2">Sitio</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Generó</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((v) => (
                  <tr key={v.codigo}>
                    <td className="px-3 py-2 font-mono text-ink">{v.codigo}</td>
                    <td className="px-3 py-2 text-ink">{NOMBRE_TIPO[v.tipo]}</td>
                    <td className="px-3 py-2 text-muted">{v.nota || '—'}</td>
                    <td className="px-3 py-2">
                      {v.estado === 'usado' && v.equipo ? (
                        <Link href={`/space-eyes/${v.equipo.id}`} className="text-success hover:underline">
                          Usado · {v.equipo.nombre || `equipo ${v.equipo.id}`}
                        </Link>
                      ) : v.estado === 'vigente' ? (
                        <span className="text-ink">Vigente hasta {fechaHora(v.expira_en)}</span>
                      ) : (
                        <span className="text-muted">
                          {v.estado === 'vencido' ? 'Vencido' : v.estado === 'cancelado' ? 'Cancelado' : 'Usado'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{(v.creado_por || '').replace(/^SPACE OS · /, '')}</td>
                    <td className="px-3 py-2 text-right">
                      {v.estado === 'vigente' && puedeCrear && (
                        <Button variant="ghost" size="sm" onClick={() => void cancelar(v.codigo)}>
                          <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
