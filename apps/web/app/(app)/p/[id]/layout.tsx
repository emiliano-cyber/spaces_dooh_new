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
//  se ofrece elegir idioma.
//
//  B68 · `lang`. El del <html> lo pone el layout RAIZ con el de la peticion, y
//  desde alli no se sabe en que ruta se esta sin tocar `middleware.ts` (que es
//  de alto contacto: sesion y CSRF). Asi que el contenido declara su propio
//  idioma en un envoltorio con `lang` (WCAG 3.1.2, «idioma de las partes»):
//  los lectores de pantalla leen el papel con la voz de la instancia.
//  `display: contents` para que el envoltorio no cambie ninguna maquetacion.
// ============================================================================

export const dynamic = 'force-dynamic'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const idioma = await idiomaDeLaInstancia()
  return (
    <ProveedorIdioma idioma={idioma} puedeElegir={false}>
      <div lang={idioma} style={{ display: 'contents' }}>
        {children}
      </div>
    </ProveedorIdioma>
  )
}
