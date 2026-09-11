import { readFile } from 'node:fs/promises'
import { Sidebar } from '@/components/demo/shell/Sidebar'
import { Topbar } from '@/components/demo/shell/Topbar'
import { AuthGate } from '@/components/demo/shell/AuthGate'
import { SesionProvider } from '@/components/demo/shell/SesionContext'
import { HidratarSitios } from '@/components/demo/shell/HidratarSitios'
import { MenuMovilProvider } from '@/components/demo/shell/MenuMovilContext'
import { SondeoNotificaciones } from '@/components/demo/shell/SondeoNotificaciones'
import { BandaLicencia } from '@/components/demo/shell/BandaLicencia'
import { avisoDeLicencia } from '@/lib/licencia'

const RUTA_LICENCIA = process.env.LICENCIA_JSON ?? '/etc/space-os/licencia/licencia.json'

// Un hijo ADMINISTRADO no tiene licencia montada, y eso no es un error: es el
// caso normal de media flota. Ningun fallo de lectura detiene el layout: todos
// salen por aqui como `null`, o sea "no hay nada que avisar".
//
// No se comprueba ninguna firma a proposito: ver la cabecera de
// `BandaLicencia.tsx` y de `lib/licencia.ts`.
//
// ─── POR QUE HAY DOS CAMINOS Y NO UN `catch` SOLO ──────────────────────────
//  Hasta el 2026-09-11 esto era un `try/catch` unico, y eso hacia que "no
//  tengo licencia" y "tengo licencia y NO PUEDO LEERLA" dieran el MISMO valor.
//  `instalar-hijo.sh` la instalaba en modo 600 de root y el contenedor corre
//  como `node`: el `readFile` daba EACCES, el `catch` devolvia `null`, y los
//  30 dias de aviso y los 15 de gracia pasaban mudos en TODA instancia de
//  droplet propio. No fallaba ningun gate, ninguna prueba y ningun log: el
//  primer cliente habria llegado a su vencimiento sin haber visto un aviso.
//
//  Los permisos ya estan arreglados en el instalador. Esto arregla la otra
//  mitad: que si vuelve a pasar, SE VEA.
//
//  La diferencia que decide si se registra algo es exactamente esta:
//   · ENOENT (y ENOTDIR, que es ENOENT con un tramo de la ruta de por medio)
//     = el archivo no esta. Es el hijo administrado, el caso normal. CALLA.
//     Y tiene que callar: este layout se renderiza en cada navegacion, asi que
//     un registro aqui llenaria el log de media flota cada vez que alguien
//     abre el sistema -- y un log que siempre grita no lo lee nadie.
//   · CUALQUIER OTRO codigo = el archivo esta ahi y no se pudo usar. Eso solo
//     puede ser un error de INSTALACION (permisos, montaje, JSON roto), y un
//     error de instalacion tiene que verse.
async function leerAvisoDeLicencia() {
  let crudo: string
  try {
    crudo = await readFile(RUTA_LICENCIA, 'utf8')
  } catch (error) {
    const codigo = (error as NodeJS.ErrnoException | null)?.code
    if (codigo !== 'ENOENT' && codigo !== 'ENOTDIR') {
      console.error(
        `[licencia] ${RUTA_LICENCIA} EXISTE pero no se pudo leer (${codigo ?? error}). ` +
          'Esto NO es "sin licencia": es un error de instalacion, y mientras dure ' +
          'la banda de aviso de vencimiento no se pinta. Revisa que el archivo sea ' +
          'legible para el usuario del contenedor (`node`): se instala en 644 a proposito ' +
          '(una licencia es una afirmacion firmada y publica, no un secreto).',
      )
    }
    return null
  }
  try {
    return avisoDeLicencia(JSON.parse(crudo), new Date())
  } catch (error) {
    // Hay archivo y se pudo leer, pero no se entiende. Mismo criterio: alguien
    // monto algo que no es una licencia, y callarse deja la banda muerta.
    console.error(
      `[licencia] ${RUTA_LICENCIA} se leyo pero no se pudo interpretar (${error}). ` +
        'La banda de aviso de vencimiento no se va a pintar hasta que se arregle.',
    )
    return null
  }
}

// Chrome del shell: sidebar + topbar. Envuelve los módulos internos. El módulo
// móvil (m/ot) y el portal del cliente NO usan este layout (van sin chrome).
// SesionProvider carga la sesión real (/api/auth/me) una vez para todo el shell.
//
// La banda de licencia se lee y se pinta SOLO aqui: las páginas públicas de
// propuesta las ve el cliente del cliente, y nuestras cuentas comerciales no
// son asunto suyo.
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const aviso = await leerAvisoDeLicencia()
  return (
    <SesionProvider>
      <MenuMovilProvider>
        <HidratarSitios />
        {/* Notificaciones en vivo. Solo dentro del shell: sin sesión no hay a
            quién avisar, y el sondeo pediría por nada. */}
        <SondeoNotificaciones />
        {/* Alto exacto de la ventana con overflow oculto: el sidebar queda fijo
            y el único que scrollea es <main>. `h-dvh` (no `h-screen`) para que
            la barra de direcciones móvil no recorte el pie del menú. */}
        <div className="flex h-dvh overflow-hidden">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <BandaLicencia aviso={aviso} />
            <Topbar />
            <main className="min-h-0 flex-1 overflow-y-auto bg-bg p-6">
              <AuthGate>{children}</AuthGate>
            </main>
          </div>
        </div>
      </MenuMovilProvider>
    </SesionProvider>
  )
}
