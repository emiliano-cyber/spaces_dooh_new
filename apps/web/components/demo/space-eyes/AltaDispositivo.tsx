'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  Cpu,
  Download,
  Eye,
  Loader2,
  MonitorSmartphone,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { infoAltaApi, testigoDeAltaApi, type Descarga, type InfoAlta } from '@/lib/data/space-eyes-api'

// ============================================================================
//  Agregar un dispositivo a Space Eyes.
//
//  UN EQUIPO SE DA DE ALTA SOLO: se instala el agente, arranca, se registra y
//  aparece en la lista. Esta pantalla no «crea» nada — no hay un formulario que
//  invente un equipo que todavía no existe, porque un equipo inventado es una
//  fila que nunca reporta y que nadie sabe si está mal instalada o no existe.
//
//  Lo que sí resuelve son las dos cosas que no se resuelven solas: de dónde se
//  baja el instalador de cada tipo, y con qué credencial nace el equipo ya
//  asignado a esta empresa.
//
//  CADA TIPO DICE LA VERDAD DE SU FLUJO. Hoy el agente de PC y el de Raspberry
//  llevan testigo de alta y nacen con dueño; la APK de Android todavía no, así
//  que nace sin asignar y hay que asignarla. Enseñar los tres iguales sería más
//  bonito y mandaría a alguien a buscar un campo que no existe.
// ============================================================================

type Tipo = 'android' | 'pc' | 'pi'

const TIPOS: { id: Tipo; etiqueta: string; icono: typeof Smartphone }[] = [
  { id: 'android', etiqueta: 'Celular Android', icono: Smartphone },
  { id: 'pc', etiqueta: 'PC + cámara IP', icono: MonitorSmartphone },
  { id: 'pi', etiqueta: 'Raspberry Pi', icono: Cpu },
]

export function AltaDispositivo() {
  const [tipo, setTipo] = useState<Tipo>('android')
  const [info, setInfo] = useState<InfoAlta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setInfo(await infoAltaApi())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo consultar Space Eyes')
      }
      setCargando(false)
    })()
  }, [])

  return (
    <div className="w-full space-y-4 p-6">
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
            Instala el agente en el equipo y aparecerá solo en la lista. Elige de qué tipo es.
          </p>
        </div>
      </div>

      {/* El mismo selector de vía de Inventario */}
      <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[13px]">
        {TIPOS.map((t) => {
          const Icono = t.icono
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors duration-150',
                tipo === t.id ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <Icono className="h-3.5 w-3.5" /> {t.etiqueta}
            </button>
          )
        })}
      </div>

      {cargando ? (
        <div className="h-64 animate-pulse rounded-md bg-surface-2" />
      ) : error ? (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudo preparar el alta</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-md border border-border bg-surface">
            {tipo === 'android' && <Android info={info!} />}
            {tipo === 'pc' && <Pc info={info!} />}
            {tipo === 'pi' && <Pi info={info!} />}
          </div>

          <div className="space-y-3">
            <TestigoDeAlta info={info!} />
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted">¿Falta quién lo instale?</div>
              <p className="mt-2 text-[12px] text-muted">
                Las cuentas de quienes entran a SPACE OS se dan de alta en Administración. Para instalar un equipo en
                sitio no hace falta cuenta: el agente se registra solo.
              </p>
              <Link
                href="/administracion"
                className="mt-2 inline-flex text-[12px] font-medium text-accent hover:underline"
              >
                Ir a Administración →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── El testigo: la credencial que hace que el equipo nazca con dueño ───────
function TestigoDeAlta({ info }: { info: InfoAlta }) {
  const [completo, setCompleto] = useState<string | null>(null)
  const [pidiendo, setPidiendo] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const revelar = useCallback(async () => {
    setPidiendo(true)
    try {
      const d = await testigoDeAltaApi()
      setCompleto(d.testigoCompleto ?? '')
    } catch {
      setCompleto('')
    }
    setPidiendo(false)
  }, [])

  async function copiar() {
    if (!completo) return
    try {
      await navigator.clipboard.writeText(completo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      /* si el navegador no deja, queda a la vista para copiar a mano */
    }
  }

  if (!info.testigo.hay) {
    return (
      <div className="rounded-md border border-[#f59e0b40] bg-warning-soft p-3">
        <div className="text-[11px] uppercase tracking-wide text-ink">Sin testigo de alta</div>
        <p className="mt-2 text-[12px] text-ink">
          Esta instancia no tiene testigo configurado, así que los equipos nuevos van a nacer <b>sin empresa
          asignada</b> y habrá que asignarlos a mano. No es un error: los equipos funcionan igual.
        </p>
        <p className="mt-2 text-[12px] text-muted">
          Para cerrarlo hace falta un testigo de alta de Space Eye en la variable{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5">SPACE_EYE_PROVISION_TOKEN</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">Testigo de alta</div>
      <p className="mt-2 text-[12px] text-muted">
        Es lo que hace que el equipo nazca ya asignado{info.empresa ? ` a ${info.empresa}` : ''}. No sirve para leer
        nada: solo para que un equipo nuevo diga de quién es.
      </p>

      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-surface-2 px-2 py-1.5 text-[12px] text-ink">
          {completo ? completo : `${info.testigo.prefijo}…`}
        </code>
        {completo ? (
          <Button variant="secondary" size="sm" onClick={copiar} aria-label="Copiar el testigo">
            {copiado ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={revelar} disabled={pidiendo}>
            {pidiendo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Ver
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Trátalo como una contraseña: viaja dentro del instalador y se revoca desde Space Eye si se filtra.
      </p>
    </div>
  )
}

// ─── Los tres flujos ────────────────────────────────────────────────────────
function Android({ info }: { info: InfoAlta }) {
  return (
    <>
      <Cabecera
        titulo="Celular Android"
        pie="Un teléfono con la APK de Space Eyes. Es el equipo más común de la flota."
      />
      <ol className="divide-y divide-border">
        <Paso n={1} titulo="Descarga la APK en el teléfono">
          <p>
            Abre esta dirección desde el navegador del propio teléfono, o pásala por un cable. Android va a pedir
            permiso para instalar de un origen desconocido; es normal.
          </p>
          <Bajar d={info.apk} nombre="space-eye.apk" />
        </Paso>
        <Paso n={2} titulo="Instálala y ábrela una vez">
          <p>
            La aplicación ya trae dentro la dirección del servidor, así que <b>no pregunta nada</b>: al abrirla se
            registra sola y se queda trabajando en segundo plano. Conviene dejar el teléfono conectado a la corriente y
            quitarle el ahorro de energía.
          </p>
        </Paso>
        <Paso n={3} titulo="Asígnalo a la empresa">
          <div className="flex items-start gap-2 rounded-md border border-[#f59e0b40] bg-warning-soft p-2.5 text-ink">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.9} />
            <div>
              <b>Este paso todavía es a mano para los teléfonos.</b> La APK{' '}
              {info.apk?.version ? `(v${info.apk.version})` : ''} aún no lleva el testigo de alta, así que el equipo
              aparece <b>sin empresa</b> y hay que asignarlo desde el panel de Space Eye. Los agentes de PC y de
              Raspberry sí lo llevan y nacen asignados.
            </div>
          </div>
        </Paso>
        <Paso n={4} titulo="Compruébalo aquí">
          <p>
            En menos de un minuto debe aparecer en la lista de Space Eyes, en línea y con su primera foto.
          </p>
          <Link href="/space-eyes" className="inline-flex text-[12px] font-medium text-accent hover:underline">
            Volver a la lista →
          </Link>
        </Paso>
      </ol>
    </>
  )
}

function Pc({ info }: { info: InfoAlta }) {
  return (
    <>
      <Cabecera
        titulo="PC + cámara IP"
        pie="Para sitios donde en lugar de un teléfono hay una cámara fija (HiLook / Hikvision) y una PC encendida."
      />
      <ol className="divide-y divide-border">
        <Paso n={1} titulo="Copia los tres archivos a la PC, en la misma carpeta">
          <p>
            El programa, <code>ffmpeg.exe</code> —solo lo necesita la vista en vivo— y un archivo de texto llamado{' '}
            <code>testigo.txt</code> con el testigo de alta dentro, en una sola línea.
          </p>
          <Bajar d={info.agentePc} nombre="SpaceEyeAgente.exe" />
          <a
            // Por esta aplicación, no directo a Space Eye: ver `INSTALADORES` en
            // lib/server/space-eye.ts (descarga bloqueada en HTTPS y binario
            // cambiable en la wifi del sitio).
            href="/spaces-dooh/api/space-eyes/descarga/ffmpeg/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> ffmpeg.exe
          </a>
        </Paso>
        <Paso n={2} titulo="Clic derecho → Ejecutar como administrador">
          <p>
            Se abre solo un formulario en el navegador: IP de la cámara, usuario y clave. El botón «Probar cámara»
            enseña la foto ahí mismo, para confirmar el encuadre sin ir a buscar ningún archivo.
          </p>
        </Paso>
        <Paso n={3} titulo="Instalar">
          <p>
            El instalador recoge el testigo solo y lo dice en pantalla antes de instalar. Al terminar deja el arranque
            automático puesto: si se reinicia la PC, el agente vuelve solo.
          </p>
        </Paso>
        <Paso n={4} titulo="Compruébalo aquí">
          <p>El equipo aparece en la lista ya asignado{info.empresa ? ` a ${info.empresa}` : ''}.</p>
          <Link href="/space-eyes" className="inline-flex text-[12px] font-medium text-accent hover:underline">
            Volver a la lista →
          </Link>
        </Paso>
      </ol>
    </>
  )
}

function Pi({ info }: { info: InfoAlta }) {
  return (
    <>
      <Cabecera
        titulo="Raspberry Pi + cámara"
        pie="Para espectaculares sin teléfono ni PC: una Pi con su cámara, pensada para estar a la intemperie."
      />
      <ol className="divide-y divide-border">
        <Paso n={1} titulo="Copia el agente a la Pi">
          <Bajar d={info.agentePi} nombre="space-eye-pi-agent.tar.gz" />
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 px-2.5 py-2 text-[11px] text-ink">
            {`scp space-eye-pi-agent.tar.gz pi@<la-pi>:~/\nssh pi@<la-pi>\ntar xzf space-eye-pi-agent.tar.gz && cd pi-agent && npm install`}
          </pre>
        </Paso>
        <Paso n={2} titulo="Escribe su configuración">
          <p>
            Copia <code>config.example.json</code> a <code>config.json</code> y pega el testigo en{' '}
            <code>testigo_de_alta</code>. Si el sitio sale a internet por un módem con SIM, pon también{' '}
            <code>&quot;enlace&quot;: &quot;lte&quot;</code> para que su consumo se cuente como datos móviles.
          </p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 px-2.5 py-2 text-[11px] text-ink">
            {`{\n  "server_url": "${info.servidor}",\n  "testigo_de_alta": "${info.testigo.prefijo || 'se_'}…"\n}`}
          </pre>
        </Paso>
        <Paso n={3} titulo="Arráncalo y déjalo como servicio">
          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 px-2.5 py-2 text-[11px] text-ink">
            {`npm run probar-camara   # dice qué cámara encontró\nnpm start               # arranca el agente`}
          </pre>
          <p>
            Si la Pi reporta falta de voltaje al arrancar, cámbiale la fuente antes de dejarla: es la causa más común
            de que se comporte raro.
          </p>
        </Paso>
        <Paso n={4} titulo="Compruébalo aquí">
          <p>El equipo aparece en la lista ya asignado{info.empresa ? ` a ${info.empresa}` : ''}.</p>
          <Link href="/space-eyes" className="inline-flex text-[12px] font-medium text-accent hover:underline">
            Volver a la lista →
          </Link>
        </Paso>
      </ol>
    </>
  )
}

// ─── Piezas ─────────────────────────────────────────────────────────────────
function Cabecera({ titulo, pie }: { titulo: string; pie: string }) {
  return (
    <div className="border-b border-border px-3 py-2.5">
      <div className="text-[13px] font-medium text-ink">{titulo}</div>
      <p className="text-[12px] text-muted">{pie}</p>
    </div>
  )
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-3 py-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-medium text-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{titulo}</div>
        <div className="mt-1 flex flex-col items-start gap-2 text-[12px] text-muted [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-ink">
          {children}
        </div>
      </div>
    </li>
  )
}

function Bajar({ d, nombre }: { d: Descarga | null; nombre: string }) {
  if (!d) {
    return (
      <span className="text-[12px] text-muted">
        {nombre}: no está publicado en este servidor todavía.
      </span>
    )
  }
  const mb = d.bytes != null ? `${(d.bytes / 1024 ** 2).toFixed(1)} MB` : null
  // La huella se ENSEÑA. Space Eye la publicaba en el manifiesto y la pantalla
  // la leía sin pintarla: un hash que no se ve no protege nada. Con ella, quien
  // instala puede comprobar que el archivo que tiene es el publicado.
  return (
    <div className="flex flex-col gap-1">
      <a
        href={d.url}
        className="inline-flex w-fit items-center gap-1.5 rounded border border-border-strong bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2"
      >
        <Download className="h-3.5 w-3.5 text-accent" />
        {nombre}
        <span className="font-normal text-muted">
          {d.version ? `v${d.version}` : ''}
          {mb ? ` · ${mb}` : ''}
        </span>
      </a>
      {d.sha256 && (
        <span className="text-[11px] text-muted">
          SHA-256: <code className="break-all font-mono text-ink">{d.sha256}</code>
          <span className="block">
            Para comprobarlo en Windows: <code className="font-mono">certutil -hashfile {nombre} SHA256</code>
          </span>
        </span>
      )}
    </div>
  )
}
