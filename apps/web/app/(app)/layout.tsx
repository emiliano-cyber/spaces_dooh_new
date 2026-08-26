import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { IndicadorCarga } from '@/components/demo/ui/IndicadorCarga'
import { nombreDeMarca } from '@/lib/entorno'
import './demo.css'

// Layout raíz de la demo. Aquí viven: los tokens SET (vía .demo-root), la fuente
// mono (JetBrains) y el aislamiento respecto a la app de producción. El chrome
// (sidebar/topbar) lo añade (shell)/layout.tsx; m/ y portal/ van sin chrome.

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

// UI-01 (auditoría del 2026-08-26): esto era un `metadata` fijo con el título
// «Spaces — Demo». Se veía en la pestaña del navegador Y en la liga pública de
// propuesta que el owner manda a su cliente, en producción, en una instancia
// que no es ninguna demo.
//
// Pasa a ser `generateMetadata` para que el nombre salga del ENTORNO de la
// instancia (`ORG_NOMBRE`, vía `lib/entorno.ts`) y no del artefacto, que es
// idéntico para toda la flota. Sin la variable, cae a «SPACE OS», que es cierto
// en cualquier instancia — nunca a «Demo».
//
// > [!warning] Para las 22 páginas prerenderizadas esto se resuelve en el BUILD
// > Medido el 2026-08-26: `next build` deja `.next/server/app/login.html`,
// > `inicio.html` y 20 más con el `<title>` ya escrito dentro. `ORG_NOMBRE` se
// > lee de verdad en cada arranque, pero en esas rutas el valor que gana es el
// > que hubiera al construir — o sea el de omisión. Es la misma trampa que
// > `app/api/auth/metodos/route.ts:29-38` documenta para el botón «Crear
// > cuenta», por la misma puerta.
// >
// > Que mande en TODAS las rutas exige sacar este subárbol del render estático
// > (`export const dynamic = 'force-dynamic'` aquí). Es barato —las páginas de
// > `(app)` son todas `'use client'`, así que el render de servidor es la
// > cáscara y nada más— pero cambia el modo de renderizado de la aplicación
// > entera, y eso lo decide una persona, no el arreglo de un título.
export function generateMetadata(): Metadata {
  const marca = nombreDeMarca()
  return {
    // Sin nombre de la ORGANIZACIÓN: el layout es común a todas las del
    // despliegue y el título se resuelve antes de saber de cuál eres (M5). Lo
    // que sí puede saber es de qué instancia es (M5 no lo contemplaba porque
    // entonces había una sola instancia para todos).
    title: marca,
    description: 'Gestión de espacios publicitarios DOOH',
  }
}

export default function DemoRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`demo-root ${jetbrains.variable} min-h-screen`}>
      <IndicadorCarga />
      {children}
      <Toaster position="bottom-right" richColors closeButton expand />
    </div>
  )
}
