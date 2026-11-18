import { redirect } from 'next/navigation'

// ============================================================================
//  /crm — ya no es una pantalla: redirige a Propuestas.
// ----------------------------------------------------------------------------
//  El 17/11 (ADR 0051, Fase 4) esto era «CRM comercial», con Propuestas como
//  cuarta pestaña. El 18/11 el dueño pidió lo contrario: «en el CRM no se debe
//  de llamar CRM sino Propuestas; además corrígelo porque debe de ser similar
//  al que ya existía de Propuestas». El embudo, las oportunidades y los
//  prospectos son ahora pestañas de `/propuestas?vista=…`.
//
//  La dirección se conserva redirigiendo, y no se borra, porque ya estuvo un
//  día en el menú: un marcador o una liga de `/crm?vista=oportunidades` caen en
//  la MISMA pestaña. Sin `vista` va al embudo, que es lo que `/crm` enseñaba.
//  La ficha de una oportunidad sigue en `/crm/oportunidades/[id]` (su ruta no
//  se ve en ningún rótulo y la enciende «Propuestas» en el menú: `nav.ts`).
// ============================================================================

export default function CrmPage({ searchParams }: { searchParams: { vista?: string | string[] } }) {
  const v = Array.isArray(searchParams.vista) ? searchParams.vista[0] : searchParams.vista
  const vista = v === 'oportunidades' || v === 'prospectos' ? v : 'embudo'
  redirect(`/propuestas?vista=${vista}`)
}
