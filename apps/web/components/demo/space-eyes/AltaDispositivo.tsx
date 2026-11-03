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
import { seApi, ErrorSE, textoDeError } from '@/lib/data/space-eyes-se'
import { kitRaspberry } from '@/lib/space-eyes-kit-pi'
import { fechaHora } from './piezas'
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { interpolarNodos } from '@/lib/i18n/nodos'

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
//
//  VARIOS A LA VEZ: el mismo codigo (un QR, un archivo de microSD) sirve para
//  hasta N equipos, con tope, vencimiento y la lista de quien lo uso. Para
//  instalar 20 telefonos o 20 Raspberry en una jornada.
// ============================================================================

type Tipo = 'telefono' | 'raspberry' | 'pc'

interface Vinculacion {
  codigo: string
  tipo: Tipo
  nota: string | null
  estado: 'vigente' | 'usado' | 'agotado' | 'vencido' | 'cancelado'
  usos: number
  usos_max: number
  equipos: { id: number; nombre: string | null }[]
  creado_por: string | null
  creado_en: string
  expira_en: string
  usado_en: string | null
  equipo: { id: number; nombre: string | null } | null
  servidor?: string
  enlace?: string
}

const TIPOS: { id: Tipo; etiqueta: ClaveTexto; detalle: ClaveTexto; icono: typeof Smartphone }[] = [
  { id: 'telefono', etiqueta: 'spaceeyes.alta.tipo.telefono', detalle: 'spaceeyes.alta.tipo.telefono.detalle', icono: Smartphone },
  { id: 'raspberry', etiqueta: 'spaceeyes.alta.tipo.raspberry', detalle: 'spaceeyes.alta.tipo.raspberry.detalle', icono: Cpu },
  { id: 'pc', etiqueta: 'spaceeyes.alta.tipo.pc', detalle: 'spaceeyes.alta.tipo.pc.detalle', icono: MonitorSmartphone },
]

const NOMBRE_TIPO: Record<Tipo, ClaveTexto> = {
  telefono: 'spaceeyes.alta.nombre.telefono',
  raspberry: 'spaceeyes.alta.nombre.raspberry',
  pc: 'spaceeyes.alta.nombre.pc',
}

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

function mensaje(e: unknown, idioma: Idioma): string {
  if (e instanceof ErrorSE) {
    const c = (e.cuerpo as { error?: string } | null)?.error
    if (e.status === 403) return traducir(idioma, 'spaceeyes.alta.error.permiso')
    if (c) return traducir(idioma, 'spaceeyes.alta.error.no-se-pudo', { motivo: c })
  }
  return textoDeError(e, idioma) ?? traducir(idioma, 'spaceeyes.alta.error.completar')
}

function Copiar({ texto, etiqueta }: { texto: string; etiqueta?: string }) {
  const t = useIdioma().t
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
      {ok ? t('spaceeyes.alta.copiado') : (etiqueta ?? t('spaceeyes.alta.copiar'))}
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
  const { t, idioma } = useIdioma()
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
      <KeyRound className="h-4 w-4 text-muted" />
      <span className="font-mono text-[22px] font-semibold tracking-[0.12em] text-ink">{v.codigo}</span>
      <span className="text-[12px] text-muted">
        {v.usos_max > 1 ? t('spaceeyes.alta.sirve.varios', { n: v.usos_max }) : t('spaceeyes.alta.sirve.una')}
        {t('spaceeyes.alta.vence', { fecha: fechaHora(v.expira_en, idioma) })}
      </span>
      <span className="ml-auto">
        <Copiar texto={v.codigo} />
      </span>
    </div>
  )
}

export function AltaDispositivo() {
  // `tr` y no `t`: el listado de tipos ya usa `t` como variable del map.
  const { t, idioma } = useIdioma()
  const tr = t
  const puedeCrear = usePuede('inventario', 'crear')
  const [tipo, setTipo] = useState<Tipo>('telefono')
  const [info, setInfo] = useState<InfoAlta | null>(null)
  const [lista, setLista] = useState<Vinculacion[] | null>(null)
  const [generado, setGenerado] = useState<Vinculacion | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  // Cuantos equipos se instalan con el mismo codigo, y cuantos dias dura si son varios.
  const [cuantos, setCuantos] = useState(1)
  const [dias, setDias] = useState(1)
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
  }, [tipo, modoPi, cuantos, dias])

  // Un lote de telefonos se instala en una jornada; Raspberry y PC se preparan
  // antes de ir: por omision 1 dia y 14 dias.
  useEffect(() => {
    setDias(tipo === 'telefono' ? 1 : 14)
  }, [tipo])
  const lote = cuantos > 1

  async function generar(nota?: string): Promise<Vinculacion | null> {
    setTrabajando(true)
    setError(null)
    try {
      const v = await seApi<Vinculacion>('vinculaciones', {
        method: 'POST',
        body: { tipo, ...(nota ? { nota } : {}), ...(lote ? { usos: cuantos, horas: dias * 24 } : {}) },
      })
      setGenerado(v)
      void recargar()
      return v
    } catch (e) {
      setError(mensaje(e, idioma))
      return null
    } finally {
      setTrabajando(false)
    }
  }

  async function descargarKit() {
    if (conexion === 'wifi' && !red.trim()) {
      setError(t('spaceeyes.alta.error.red'))
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
    descargar(`space-eye-raspberry-${v.codigo}${lote ? `-para-${cuantos}` : ''}.zip`, datos, 'application/zip')
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

  // La direccion que el equipo tiene que escribir sale de Space Eye
  // (PUBLIC_BASE_URL de su pila, https://<EYES_DOMINIO>). Si esa instancia la
  // tiene mal puesta llega una de loopback -127.0.0.1-, que es la que usan
  // entre si las dos aplicaciones del droplet y NO sirve desde un sitio:
  // dictarsela al tecnico es mandarlo a su propia PC. Paso en G500 el 13-oct,
  // con el instalador del agente ya descargado y el tecnico delante.
  //
  // No se arregla aqui, que seria inventarse una segunda fuente para el mismo
  // dato; se dice que falta, para que se corrija donde esta.
  const servidorUtil =
    !!generado?.servidor && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])([:/]|$)/i.test(generado.servidor)

  const comandoPi = servidorUtil
    ? `curl -fsSL ${generado!.servidor}/instalar-pi.sh | sudo bash -s -- --servidor ${generado!.servidor} --codigo ${generado!.codigo}`
    : ''

  const botonGenerar = (
    <div>
      <Button variant="primary" size="md" onClick={() => void generar()} disabled={trabajando}>
        {trabajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        {t('spaceeyes.alta.generar')}
      </Button>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-6 sm:px-6">
      <Link href="/space-eyes" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Space Eyes
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-lg font-semibold text-ink">{t('spaceeyes.alta.titulo')}</h1>
          <p className="text-[13px] text-muted">{t('spaceeyes.alta.descripcion')}</p>
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
              <span className="block text-[13px] font-semibold text-ink">{tr(t.etiqueta)}</span>
              <span className="block text-[12px] text-muted">{tr(t.detalle)}</span>
            </span>
          </button>
        ))}
      </div>

      {!puedeCrear && (
        <p className="rounded-md border border-border bg-surface p-3 text-[13px] text-muted">
          {tr('spaceeyes.alta.sin-permiso')}
        </p>
      )}
      {puedeCrear && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            {tr('spaceeyes.alta.cuantos')}
            <input
              type="number"
              min={1}
              max={200}
              value={cuantos}
              onChange={(e) => setCuantos(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-24 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
            />
          </label>
          {lote && (
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              {tr('spaceeyes.alta.dura')}
              <select
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
              >
                {[1, 3, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {tr(d === 1 ? 'spaceeyes.alta.dias.uno' : 'spaceeyes.alta.dias.otros', { n: d })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="min-w-0 flex-1 text-[12px] text-muted">
            {lote
              ? tr(
                  tipo === 'telefono'
                    ? 'spaceeyes.alta.lote.qr'
                    : tipo === 'raspberry'
                      ? 'spaceeyes.alta.lote.archivo'
                      : 'spaceeyes.alta.lote.codigo',
                  { n: cuantos, siguiente: cuantos + 1 },
                )
              : tr('spaceeyes.alta.uno-solo')}
          </p>
        </div>
      )}
      {error && <p className="rounded-md border border-[#dc262640] bg-error-soft p-3 text-[13px] text-[#b91c1c]">{error}</p>}

      {/* ── Teléfono ── */}
      {tipo === 'telefono' && puedeCrear && (
        <section className="grid gap-4 rounded-md border border-border bg-surface p-4 lg:grid-cols-[1fr_300px]">
          <ol className="flex flex-col gap-3">
            <Paso n={1}>
              {interpolarNodos(tr('spaceeyes.alta.tel.1'), {
                app: <strong>Space Eye</strong>,
                enlace: info?.apk ? (
                  <>
                    {' '}
                    (
                    <a href={info.apk.url} className="text-accent hover:underline">
                      {tr('spaceeyes.alta.tel.descargar', { version: info.apk.version ?? '' })}
                    </a>
                    )
                  </>
                ) : null,
              })}
            </Paso>
            <Paso n={2}>{tr('spaceeyes.alta.tel.2')}</Paso>
            <Paso n={3}>
              {interpolarNodos(tr('spaceeyes.alta.tel.3'), { vincular: <strong>{tr('spaceeyes.alta.tel.vincular')}</strong> })}
            </Paso>
            <Paso n={4}>{tr('spaceeyes.alta.tel.4')}</Paso>
            {generado ? <CodigoGrande v={generado} /> : botonGenerar}
          </ol>
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-3">
            {generado?.enlace ? (
              <>
                <Qr texto={generado.enlace} />
                <span className="text-center text-[12px] text-muted">{tr('spaceeyes.alta.tel.escanea')}</span>
              </>
            ) : (
              <span className="text-center text-[12px] text-muted">{tr('spaceeyes.alta.tel.qr')}</span>
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
                ['sola', 'spaceeyes.alta.pi.sola'],
                ['encendida', 'spaceeyes.alta.pi.encendida'],
              ] as const
            ).map(([id, txt]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModoPi(id)}
                className={cn('rounded px-3 py-1.5', modoPi === id ? 'bg-accent text-white' : 'text-muted hover:text-ink')}
              >
                {tr(txt)}
              </button>
            ))}
          </div>

          {modoPi === 'sola' ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-muted">
                  {tr('spaceeyes.alta.pi.nombre')}
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={lote ? tr('spaceeyes.alta.pi.nombre.vacio') : tr('spaceeyes.alta.pi.nombre.ej')}
                    maxLength={80}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                  />
                  {lote && (
                    <span className="text-[11.5px]">{tr('spaceeyes.alta.pi.mismo-archivo', { n: cuantos })}</span>
                  )}
                </label>
                <div className="flex flex-col gap-1 text-[12px] text-muted">
                  {tr('spaceeyes.alta.pi.conexion')}
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['wifi', 'WiFi', Wifi],
                        ['cable', tr('spaceeyes.alta.pi.cable'), Cable],
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
                      {tr('spaceeyes.alta.pi.red')}
                      <input
                        value={red}
                        onChange={(e) => setRed(e.target.value)}
                        maxLength={64}
                        className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-muted">
                      {tr('spaceeyes.alta.pi.clave')}
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
                      {tr('spaceeyes.alta.pi.clave.texto')}
                    </p>
                  </div>
                )}
                <div>
                  <Button variant="primary" size="md" onClick={() => void descargarKit()} disabled={trabajando}>
                    {trabajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {tr('spaceeyes.alta.pi.descargar')}
                  </Button>
                </div>
                {kitListo && generado && (
                  <p className="text-[12.5px] text-success">
                    {tr('spaceeyes.alta.pi.listo', { codigo: generado.codigo })}{' '}
                    {generado.usos_max > 1
                      ? tr('spaceeyes.alta.pi.listo.varias', { n: generado.usos_max })
                      : tr('spaceeyes.alta.pi.listo.una')}{' '}
                    {tr('spaceeyes.alta.pi.listo.vence', { fecha: fechaHora(generado.expira_en, idioma) })}
                  </p>
                )}
              </div>
              <ol className="flex flex-col gap-3">
                <Paso n={1}>
                  {interpolarNodos(tr('spaceeyes.alta.pi.1'), {
                    imager: <strong>Raspberry Pi Imager</strong>,
                    no: <strong>{tr('spaceeyes.alta.pi.1.no')}</strong>,
                  })}
                </Paso>
                <Paso n={2}>
                  {interpolarNodos(tr('spaceeyes.alta.pi.2'), {
                    bootfs: <strong>bootfs</strong>,
                    userdata: <strong>user-data</strong>,
                    network: <strong>network-config</strong>,
                  })}
                </Paso>
                <Paso n={3}>{tr('spaceeyes.alta.pi.3')}</Paso>
                <Paso n={4}>
                  {interpolarNodos(tr('spaceeyes.alta.pi.4'), { equipos: <strong>{tr('spaceeyes.comun.equipos')}</strong> })}
                </Paso>
              </ol>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-3">
                <Paso n={1}>{tr('spaceeyes.alta.enc.1')}</Paso>
                <Paso n={2}>{tr('spaceeyes.alta.enc.2')}</Paso>
                <Paso n={3}>{tr('spaceeyes.alta.enc.3')}</Paso>
              </ol>
              {!generado ? (
                botonGenerar
              ) : (
                <>
                  <CodigoGrande v={generado} />
                  {/* Sin direccion util el comando saldria a medias y la
                      Raspberry quedaria instalada apuntando a ningun sitio. */}
                  {servidorUtil ? (
                    <div className="flex flex-col gap-2 rounded-md bg-[#12100e] p-3">
                      <code className="break-all font-mono text-[12px] text-[#e7e5e4]">{comandoPi}</code>
                      <div>
                        <Copiar texto={comandoPi} etiqueta={tr('spaceeyes.alta.copiar-comando')} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-warning">{tr('spaceeyes.alta.sin-direccion.pi')}</p>
                  )}
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
              {interpolarNodos(tr('spaceeyes.alta.pc.1'), {
                enlace: info?.agentePc ? (
                  <>
                    {' '}
                    (
                    <a href={info.agentePc.url} className="text-accent hover:underline">
                      SpaceEyeAgente {info.agentePc.version}
                    </a>
                    )
                  </>
                ) : null,
              })}
            </Paso>
            <Paso n={2}>{tr('spaceeyes.alta.pc.2')}</Paso>
            <Paso n={3}>{tr('spaceeyes.alta.pc.3')}</Paso>
          </ol>
          {generado ? <CodigoGrande v={generado} /> : botonGenerar}
          {generado && servidorUtil && (
            <p className="text-[12px] text-muted">
              {interpolarNodos(tr('spaceeyes.alta.pc.servidor'), {
                servidor: <span className="font-mono text-ink">{generado.servidor}</span>,
              })}
            </p>
          )}
          {generado && !servidorUtil && (
            <p className="text-[12px] text-warning">{tr('spaceeyes.alta.sin-direccion.pc')}</p>
          )}
        </section>
      )}

      {/* ── Códigos generados ── */}
      <section className="overflow-hidden rounded-md border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border p-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">{tr('spaceeyes.alta.codigos')}</h2>
            <p className="text-[12px] text-muted">{tr('spaceeyes.alta.codigos.texto')}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void recargar()} aria-label={tr('spaceeyes.comun.actualizar')}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </header>
        {lista === null ? (
          <div className="flex items-center gap-2 p-3 text-[12px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tr('comun.cargando')}
          </div>
        ) : lista.length === 0 ? (
          <p className="p-3 text-[12px] text-muted">{tr('spaceeyes.alta.codigos.vacio')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">{tr('spaceeyes.alta.col.codigo')}</th>
                  <th className="px-3 py-2">{tr('spaceeyes.comun.equipo')}</th>
                  <th className="hidden px-3 py-2 sm:table-cell">{tr('spaceeyes.admin.sitio')}</th>
                  <th className="px-3 py-2">{tr('spaceeyes.comun.estado')}</th>
                  <th className="hidden px-3 py-2 md:table-cell">{tr('spaceeyes.alta.col.genero')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((v) => (
                  <tr key={v.codigo}>
                    <td className="px-3 py-2 font-mono text-ink">{v.codigo}</td>
                    <td className="px-3 py-2 text-ink">{NOMBRE_TIPO[v.tipo] ? tr(NOMBRE_TIPO[v.tipo]) : v.tipo}</td>
                    <td className="hidden px-3 py-2 text-muted sm:table-cell">{v.nota || '—'}</td>
                    <td className="px-3 py-2">
                      {v.usos_max > 1 ? (
                        <span className={v.estado === 'vigente' ? 'text-ink' : 'text-muted'}>
                          {tr('spaceeyes.alta.usos', { usos: v.usos, max: v.usos_max })}
                          {v.estado === 'vigente'
                            ? tr('spaceeyes.alta.lote.vigente', { fecha: fechaHora(v.expira_en, idioma) })
                            : v.estado === 'agotado'
                              ? tr('spaceeyes.alta.lote.completo')
                              : v.estado === 'cancelado'
                                ? tr('spaceeyes.alta.lote.cancelado')
                                : tr('spaceeyes.alta.lote.vencido')}
                          {v.equipos.length > 0 && (
                            <span className="block text-[11.5px] text-muted">
                              {v.equipos.map((e, i) => (
                                <span key={e.id}>
                                  {i > 0 && ', '}
                                  <Link href={`/space-eyes/${e.id}`} className="text-success hover:underline">
                                    {e.nombre || tr('spaceeyes.alta.equipo-n', { id: e.id })}
                                  </Link>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      ) : v.estado === 'usado' && v.equipo ? (
                        <Link href={`/space-eyes/${v.equipo.id}`} className="text-success hover:underline">
                          {tr('spaceeyes.alta.usado-por', { nombre: v.equipo.nombre || tr('spaceeyes.alta.equipo-n', { id: v.equipo.id }) })}
                        </Link>
                      ) : v.estado === 'vigente' ? (
                        <span className="text-ink">{tr('spaceeyes.alta.vigente-hasta', { fecha: fechaHora(v.expira_en, idioma) })}</span>
                      ) : (
                        <span className="text-muted">
                          {v.estado === 'vencido'
                            ? tr('spaceeyes.alta.estado.vencido')
                            : v.estado === 'cancelado'
                              ? tr('spaceeyes.alta.estado.cancelado')
                              : tr('spaceeyes.alta.estado.usado')}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-muted md:table-cell">{(v.creado_por || '').replace(/^SPACE OS · /, '')}</td>
                    <td className="px-3 py-2 text-right">
                      {v.estado === 'vigente' && puedeCrear && (
                        <Button variant="ghost" size="sm" onClick={() => void cancelar(v.codigo)}>
                          <X className="mr-1 h-3.5 w-3.5" /> {tr('comun.cancelar')}
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
