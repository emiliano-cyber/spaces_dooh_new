'use client'

import { fijarMonedaInstancia, type Moneda } from './dinero'

// ============================================================================
//  lib/i18n/moneda-cliente.tsx — LA MONEDA DE LA INSTANCIA, EN EL NAVEGADOR.
// ----------------------------------------------------------------------------
//  ADR 0048. El layout raiz la lee de la base (`monedaDeLaInstancia()`) y la
//  pasa aqui. Este componente la fija en `lib/i18n/dinero.ts` DURANTE EL
//  RENDER, no en un efecto, y es a proposito:
//
//    · React pinta al padre antes que a los hijos, asi que cuando el primer
//      `formatMonto(n)` de cualquier pantalla se ejecuta la moneda ya esta
//      puesta — en el render del servidor (SSR) y en la hidratacion por igual.
//      El HTML y la hidratacion coinciden, y no hay un primer pintado en pesos
//      que luego salte a dolares.
//    · Un `useEffect` llegaria TARDE: despues del primer pintado de los hijos.
//
//  Fijar un valor de modulo durante el render solo es correcto porque el
//  valor es el MISMO para todas las peticiones de la instancia (la base lo
//  hace inmutable y unico). Con algo que cambiara por peticion —el idioma—
//  seria un error, y por eso el idioma va por contexto.
// ============================================================================

export function ProveedorMoneda({ moneda, children }: { moneda: Moneda; children?: React.ReactNode }) {
  fijarMonedaInstancia(moneda)
  return <>{children}</>
}
