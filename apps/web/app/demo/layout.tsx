import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './demo.css'

// Layout raíz de la demo. Aquí viven: los tokens SET (vía .demo-root), la fuente
// mono (JetBrains) y el aislamiento respecto a la app de producción. El chrome
// (sidebar/topbar) lo añade (shell)/layout.tsx; m/ y portal/ van sin chrome.

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Spaces — Demo',
  description: 'Demo Billboards Perú SA',
}

export default function DemoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`demo-root ${jetbrains.variable} min-h-screen`}>{children}</div>
  )
}
