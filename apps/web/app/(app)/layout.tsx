import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { IndicadorCarga } from '@/components/demo/ui/IndicadorCarga'
import { nombreDeMarca } from '@/lib/entorno'
import './demo.css'

// Layout raíz de la demo. Aquí viven: los tokens SET (vía .demo-root), la fuente
// y el aislamiento respecto a la app de producción. La tipografía la sirve el
// layout RAÍZ con next/font, para que las páginas públicas también la tengan.
// El chrome
// (sidebar/topbar) lo añade (shell)/layout.tsx; m/ y portal/ van sin chrome.

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
// > **RESUELTO el 2026-08-26.** Jochelo decidió sacar el subárbol del render
// > estático — ver `dynamic` justo abajo. Este aviso se conserva porque explica
// > POR QUÉ está esa línea: sin ella, `ORG_NOMBRE` se leía de verdad en cada
// > arranque y aun así no servía de nada en 22 rutas.

// El subárbol `(app)` se renderiza POR PETICIÓN, y esa es la única forma de que
// la marca de la instancia gane en todas sus rutas y no solo en las dinámicas.
//
// Lo que cuesta, medido y no supuesto: las páginas de `(app)` son todas
// `'use client'`, así que lo que Next renderiza en el servidor es la cáscara y
// nada más — el trabajo por petición es escribir un `<html>` con su `<title>`.
// Lo que se pierde es el HTML prerenderizado de 22 rutas, que se vuelve a
// generar en cada visita en vez de servirse desde disco.
//
// Y se gana algo que no es solo el título: mientras esas rutas se horneaban,
// CUALQUIER decisión tomada al arrancar quedaba congelada en ellas. Es la misma
// puerta por la que el botón «Crear cuenta» apareció en un `/login` construido
// con el autoregistro apagado (`app/api/auth/metodos/route.ts:29-38`). Esa
// puerta se cierra aquí para todo el subárbol, no solo para la marca.
export const dynamic = 'force-dynamic'

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
    <div className="demo-root min-h-screen">
      <IndicadorCarga />
      {children}
      <Toaster position="bottom-right" richColors closeButton expand />
    </div>
  )
}
