import { Sidebar } from '@/components/demo/shell/Sidebar'
import { Topbar } from '@/components/demo/shell/Topbar'
import { AuthGate } from '@/components/demo/shell/AuthGate'
import { SesionProvider } from '@/components/demo/shell/SesionContext'

// Chrome del shell: sidebar + topbar. Envuelve los módulos internos. El módulo
// móvil (m/ot) y el portal del cliente NO usan este layout (van sin chrome).
// SesionProvider carga la sesión real (/api/auth/me) una vez para todo el shell.
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <SesionProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-bg p-6">
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </div>
    </SesionProvider>
  )
}
