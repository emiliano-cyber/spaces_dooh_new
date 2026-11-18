import type { Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/parte-en-idioma.tsx — UN PAPEL QUE DECLARA SU PROPIO IDIOMA (B72).
// ----------------------------------------------------------------------------
//  ADR 0049: los papeles (la propuesta imprimible, el contrato, el comprobante)
//  salen en el idioma de los documentos de la instancia, y la pantalla que los
//  rodea en el de la persona. El `<html lang>` es el de la persona, asi que un
//  lector de pantalla leia un papel italiano con voz espanola. WCAG 3.1.2
//  («idioma de las partes»): la parte declara el suyo.
//
//  Como en `/p` y el portal (B68), un `<div lang>` con `display: contents`,
//  que no cambia ninguna maquetacion. La diferencia: aqui SOLO se pone cuando
//  los dos idiomas difieren. Cuando coinciden —hoy, en todas las instancias,
//  que son espanolas con la persona en espanol— el HTML queda como era, byte a
//  byte: el envoltorio no aporta nada y cambiaria el volcado de las pruebas.
//
//  Sin hooks ni 'use client': sirve igual en un Server Component (la propuesta
//  y el contrato) que dentro de uno de cliente (el comprobante).
// ============================================================================

export function ParteEnIdioma({
  idioma,
  de,
  children,
}: {
  /** El idioma de la parte (el del papel). */
  idioma: Idioma
  /** El idioma de lo que la rodea (el de la persona). */
  de: Idioma
  children?: React.ReactNode
}) {
  if (idioma === de) return <>{children}</>
  return (
    <div lang={idioma} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
