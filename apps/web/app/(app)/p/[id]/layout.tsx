import { ProveedorIdioma } from '@/lib/i18n/contexto'
import { idiomaDeLaInstancia } from '@/lib/server/idioma-instancia'

// ============================================================================
//  /p/[id] · la liga publica de la propuesta — en el idioma de los DOCUMENTOS de la instancia (ADR 0049).
// ----------------------------------------------------------------------------
//  Decision del dueno (03/11): «todo debe salir en el idioma que se configuro
//  el programa». La liga que recibe el cliente no la elige el navegador de quien abre el enlace: va
//  en el idioma de la instancia, el mismo que el contrato y la propuesta
//  impresa. Este layout re-provee el idioma para toda la pagina (que es de
//  cliente y lee `useIdioma()`), sin que la pagina cambie una linea. Dentro no
//  se ofrece elegir idioma. El `lang` del <html> lo sigue poniendo el layout
//  raiz con el de la peticion.
// ============================================================================

export const dynamic = 'force-dynamic'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const idioma = await idiomaDeLaInstancia()
  return (
    <ProveedorIdioma idioma={idioma} puedeElegir={false}>
      {children}
    </ProveedorIdioma>
  )
}
