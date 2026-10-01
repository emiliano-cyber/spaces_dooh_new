'use client'

import { Languages } from 'lucide-react'
import { IDIOMAS, type Idioma } from '@/lib/i18n/idiomas'
import { useIdioma } from '@/lib/i18n/contexto'

// ============================================================================
//  SelectorIdioma — el cambio a mano.
// ----------------------------------------------------------------------------
//  La deteccion automatica acierta casi siempre y aun asi no basta: un
//  navegador en ingles es una preferencia del sistema operativo, no una
//  decision de la persona que esta delante. Muchas maquinas de oficina vienen
//  en ingles de fabrica y quien las usa prefiere trabajar en espanol.
//
//  En cuanto se toca esto, la cookie `spaces_idioma` gana a la cabecera PARA
//  SIEMPRE (`lib/i18n/idiomas.ts`, `resolverIdioma`). Es la respuesta a «quien
//  manda cuando las dos senales se contradicen»: manda la persona.
//
//  ─── DETALLES QUE PARECEN MENORES Y NO LO SON ──────────────────────────────
//
//  · Cada idioma se nombra EN SI MISMO —«Espanol», «English»— y no traducido.
//    Es la regla de cualquier selector de idioma que funcione: quien no
//    entiende la pantalla en la que esta tiene que poder reconocer el suyo.
//  · Es un `<select>` nativo y no un menu propio. Con dos opciones, un menu a
//    medida solo anade superficie que puede romperse; el nativo ya es accesible
//    con teclado, ya se lee bien en un lector de pantalla y en movil abre la
//    rueda del sistema.
//  · No se pinta bandera. Una bandera nombra un PAIS, no un idioma: la de
//    Estados Unidos deja fuera a media docena de paises que hablan ingles, y la
//    de Espana le dice a un mexicano que ese no es su idioma.
// ============================================================================

export function SelectorIdioma({ className = '' }: { className?: string }) {
  const { idioma, t, cambiarIdioma } = useIdioma()

  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <Languages className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      {/* El rotulo visible sobra —el icono y las opciones ya lo dicen— pero un
          lector de pantalla necesita saber que es este desplegable. */}
      <span className="sr-only">{t('idioma.etiqueta')}</span>
      <select
        value={idioma}
        onChange={(e) => cambiarIdioma(e.target.value as Idioma)}
        aria-label={t('idioma.cambiar')}
        className="cursor-pointer rounded border border-border bg-surface px-1.5 py-0.5 text-[11.5px] text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {IDIOMAS.map((i) => (
          <option key={i} value={i}>
            {t(`idioma.${i}` as 'idioma.es' | 'idioma.en')}
          </option>
        ))}
      </select>
    </label>
  )
}
