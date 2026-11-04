'use client'

import { createContext, useContext } from 'react'
import { ProveedorIdioma, useIdioma } from './contexto'
import { ParteEnIdioma } from './parte-en-idioma'
import type { Idioma } from './idiomas'

// ============================================================================
//  lib/i18n/idioma-documentos-cliente.tsx — LOS PAPELES, EN EL IDIOMA DE LA
//  INSTANCIA (ADR 0049).
// ----------------------------------------------------------------------------
//  Decision del dueno (03/11): «todo debe salir en el idioma que se configuro
//  el programa». La interfaz es de cada persona (cookie, navegador,
//  preferencia), pero lo que sale hacia un tercero —la propuesta, su liga, el
//  portal del cliente, el comprobante— va en el idioma de los DOCUMENTOS de la
//  instancia (`tenants.idioma_documentos`), el mismo que el contrato.
//
//  El layout raiz lo lee en el servidor (`idiomaDeLaInstancia()`) y lo deja
//  aqui con `ProveedorIdiomaDocumentos`. Un papel se envuelve en
//  `EnIdiomaDeLosDocumentos`, que RE-PROVEE `ProveedorIdioma` con ese idioma:
//  todo lo que hay dentro —`t`, fechas, cifras— sale en el idioma de la
//  instancia sin que el componente del papel cambie una linea.
//
//  Sin `ProveedorIdiomaDocumentos` encima (una prueba que rinde un componente
//  suelto) NO impone nada: deja el idioma que hubiera. En la aplicacion el
//  layout raiz lo pone siempre.
// ============================================================================

const Contexto = createContext<Idioma | null>(null)

export function ProveedorIdiomaDocumentos({ idioma, children }: { idioma: Idioma; children?: React.ReactNode }) {
  return <Contexto.Provider value={idioma}>{children}</Contexto.Provider>
}

/** El idioma de los documentos de la instancia, o `null` si nadie lo proveyo. */
export function useIdiomaDocumentos(): Idioma | null {
  return useContext(Contexto)
}

/**
 * Lo que envuelve se pinta en el idioma de los documentos. Dentro no se ofrece
 * elegir idioma (`puedeElegir: false`): el papel no es de quien lo mira.
 *
 * B72 (04/11): y declara ese idioma con `lang` cuando no es el de la persona
 * (`ParteEnIdioma`). Si coinciden, el HTML de siempre.
 */
export function EnIdiomaDeLosDocumentos({ children }: { children?: React.ReactNode }) {
  const idioma = useIdiomaDocumentos()
  const { idioma: idiomaPersona } = useIdioma()
  if (!idioma) return <>{children}</>
  return (
    <ProveedorIdioma idioma={idioma} puedeElegir={false}>
      <ParteEnIdioma idioma={idioma} de={idiomaPersona}>
        {children}
      </ParteEnIdioma>
    </ProveedorIdioma>
  )
}
