import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { IndicadorCarga } from '@/components/demo/ui/IndicadorCarga'
import './demo.css'

// Layout raíz de la demo. Aquí viven: los tokens SET (vía .demo-root) y el
// aislamiento respecto a la app de producción. El chrome (sidebar/topbar) lo
// añade (shell)/layout.tsx; m/ y portal/ van sin chrome.
// Las fuentes NO se cargan aquí: las dos familias institucionales las declara
// el root layout sobre <html>, para que también alcancen a `not-found.tsx`,
// que se pinta fuera de este grupo de rutas.

export const metadata: Metadata = {
  title: 'Spaces — Demo',
  // Sin nombre de empresa: el layout es común a todas las organizaciones y el
  // título/descripción se resuelven antes de saber de cuál eres (M5). Además
  // llevaba el prefijo «Demo», que se colaba en la pestaña del navegador.
  description: 'Gestión de espacios publicitarios DOOH',
}

export default function DemoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="demo-root min-h-screen">
      <IndicadorCarga />
      {children}
      <Toaster position="bottom-right" richColors closeButton expand />
    </div>
  )
}
