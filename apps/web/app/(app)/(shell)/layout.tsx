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
// caso normal de media flota. Cualquier fallo de lectura (archivo ausente,
// JSON roto, lo que sea) sale por aqui como "no hay nada que avisar" y la
// banda no se pinta -- nunca como un error que detenga el layout.
//
// No se comprueba ninguna firma a proposito: ver la cabecera de
// `BandaLicencia.tsx` y de `lib/licencia.ts`.
async function leerAvisoDeLicencia() {
  try {
    const crudo = JSON.parse(await readFile(RUTA_LICENCIA, 'utf8'))
    return avisoDeLicencia(crudo, new Date())
  } catch {
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
