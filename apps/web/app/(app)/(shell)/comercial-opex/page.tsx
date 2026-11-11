import { ComercialOpex } from '@/components/demo/comercial-opex/ComercialOpex'

// ============================================================================
//  Comercial negociación · prospección de arrendadores.  NEG-01.
// ----------------------------------------------------------------------------
//  Fue MAQUETA del 30/09 al 22/10 («por ahora solo será html sin funciones»).
//  Desde NEG-01 guarda de verdad: cada espacio es un prospecto PREDIO o
//  PANTALLA de Captación, con su ficha, ubicación, contactos, ofertas al dueño,
//  competencia, bitácora y notas. Ver `components/demo/comercial-opex/` y
//  `vault/03-Frontend/comercial-opex.md`.
//
//  Se queda como Server Component para fijar AQUÍ la fecha de hoy: si la
//  calcularan el servidor y el navegador por separado, «hace N días» podía
//  salir distinto a medianoche y React avisaría de una hidratación rota.
//
//  El encabezado (título y «Nuevo espacio») lo pinta `ComercialOpex` desde el
//  rediseño del 26/10: el botón abre un Sheet cuyo estado vive ahí, y con el
//  patrón del resto de módulos va arriba a la derecha, junto al título.
// ============================================================================

export default function ComercialOpexPage() {
  return <ComercialOpex hoyIso={new Date().toISOString()} />
}
