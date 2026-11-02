// ============================================================================
//  lib/i18n/textos/operaciones.ts — LOS TEXTOS DEL AMBITO OPERACIONES.
// ----------------------------------------------------------------------------
//  3.ª oleada del ingles (2026-11-02), lote «operaciones y clientes». Mismas
//  reglas que `textos/propuestas.ts`: claves en espanol, espanol LITERAL (la
//  copia exacta de lo que pintaba el componente), `EN_OPERACIONES` como
//  `Record` (una clave que falte no compila), ni dinero ni moneda, y las
//  frases con un trozo con formato van ENTERAS, con huecos.
//
//  Pantallas hechas en este lote: `/disponibilidad` y las tres piezas
//  compartidas que pinta tambien Comercial (`SlotsBadge`, `ClientesBadge`,
//  `CalendarioDisponibilidad`). Lo que queda del ambito (almacen, imprenta,
//  OT, creativos, Dashboard, consumo de luz y reportes) esta sin
//  traducir: ver la subseccion del lote en `vault/03-Frontend/idiomas-es-en.md`.
//
//  GLOSARIO de este archivo (ademas del comun): disponibilidad → availability
//  · almacen → warehouse · imprenta → printing (el proveedor: print shop) ·
//  catorcena → two-week period · hueco libre → free space · cupo de clientes
//  → client cap · dar de baja (un articulo del almacen) → retire, igual que la
//  baja logica de franjas y temporadas: el articulo deja de contar y su
//  historial se queda.
// ============================================================================

export const ES_OPERACIONES = {
  // ── SlotsBadge / ClientesBadge / CalendarioDisponibilidad ──
  'operaciones.slots.libres-de': '{disp} de {total} slots libres',
  'operaciones.slots.total': '{total} slots',
  'operaciones.slots.slots': 'slots',
  'operaciones.clientes-badge.libres': '{libres} de {cupo} lugares de cliente libres',
  'operaciones.clientes-badge.lleno': 'Cupo lleno: {cupo} clientes. Solo admite campañas de los que ya están.',
  'operaciones.clientes-badge.clientes': 'clientes',
  'operaciones.calendario.anterior': 'Mes anterior',
  'operaciones.calendario.siguiente': 'Mes siguiente',
  // Las iniciales de los dias, de lunes a domingo, separadas por coma.
  'operaciones.calendario.dias': 'L,M,M,J,V,S,D',
  'operaciones.calendario.confirmada': 'confirmada',
  'operaciones.calendario.en-propuesta': 'en propuesta',

  // ── Disponibilidad ──
  'operaciones.disponibilidad.titulo': 'Disponibilidad',
  'operaciones.disponibilidad.descripcion':
    'Ocupación futura por catorcena o mes: cruza las reservas confirmadas contra el inventario para ver qué tienes libre más adelante, y avisa qué está en una propuesta abierta.',
  'operaciones.disponibilidad.kpi.estaticas': 'Estáticas libres',
  'operaciones.disponibilidad.kpi.de': '{n} de {total}',
  'operaciones.disponibilidad.kpi.en-periodo': 'en {periodo}',
  'operaciones.disponibilidad.kpi.digitales': 'Digitales con lugar',
  'operaciones.disponibilidad.kpi.no-llenas': 'no llenas en {periodo}',
  'operaciones.disponibilidad.kpi.slots': 'Slots libres',
  'operaciones.disponibilidad.kpi.sumando': 'sumando las digitales con lugar',
  'operaciones.disponibilidad.kpi.ninguna-digital': 'ninguna digital con lugar en el periodo',
  'operaciones.disponibilidad.kpi.en-propuesta': 'En propuesta',
  'operaciones.disponibilidad.kpi.piden.uno': 'pantallas que piden {n} propuesta abierta · no bloquean',
  'operaciones.disponibilidad.kpi.piden.otros': 'pantallas que piden {n} propuestas abiertas · no bloquean',
  'operaciones.disponibilidad.kpi.ninguna-pide': 'ninguna propuesta abierta las pide',
  'operaciones.disponibilidad.desde': 'Desde',
  'operaciones.disponibilidad.vista': 'Vista',
  'operaciones.disponibilidad.catorcena': 'Catorcena',
  'operaciones.disponibilidad.mes': 'Mes',
  'operaciones.disponibilidad.periodos': 'Periodos',
  'operaciones.disponibilidad.periodos-title': 'Periodos a mostrar',
  'operaciones.disponibilidad.n-periodos': '{n} periodos',
  'operaciones.disponibilidad.buscar-aria': 'Buscar pantalla',
  'operaciones.disponibilidad.buscar': 'Buscar pantalla: nombre o clave…',
  'operaciones.disponibilidad.solo-hueco': 'Solo con hueco libre',
  'operaciones.disponibilidad.calendario': 'Calendario por pantalla',
  'operaciones.disponibilidad.calendario-sub':
    'Cada celda dice su estado; pasa el cursor para ver qué campaña la ocupa.',
  'operaciones.disponibilidad.cargando': 'Cargando disponibilidad…',
  'operaciones.disponibilidad.sin-coincidencias': 'Sin pantallas que coincidan.',
  'operaciones.disponibilidad.pantalla': 'Pantalla',
  'operaciones.disponibilidad.digital': 'digital',
  'operaciones.disponibilidad.libres-de': '{n} de {total} libres',
  'operaciones.disponibilidad.ocupante': '{campana} (confirmada)',
  'operaciones.disponibilidad.ocupante-slots': '{campana} (confirmada, {spots} slots)',
  'operaciones.disponibilidad.quedan': 'Quedan {libres} de {total} slots',
  'operaciones.disponibilidad.libre-slots': 'Libre: {n} slots',
  'operaciones.disponibilidad.libre': 'Libre',
  'operaciones.disponibilidad.en-propuesta-titulo': 'En propuesta {folio}{cliente} ({desde} a {hasta}{spots})',
  'operaciones.disponibilidad.en-propuesta-spots': ', {n} spots',
  'operaciones.disponibilidad.celda.libres.uno': '{n} libre',
  'operaciones.disponibilidad.celda.libres.otros': '{n} libres',
  'operaciones.disponibilidad.celda.lleno': 'Lleno',
  'operaciones.disponibilidad.celda.en-propuesta': 'En propuesta',
  'operaciones.disponibilidad.celda.usados': '{n} usados',
  'operaciones.disponibilidad.celda.ocupada': 'Ocupada',
  'operaciones.disponibilidad.leyenda.libre': 'Libre',
  'operaciones.disponibilidad.leyenda.en-propuesta': 'En propuesta (libre, pero una propuesta abierta la pide)',
  'operaciones.disponibilidad.leyenda.parcial': 'Parcial (digital: el número son los slots que quedan libres)',
  'operaciones.disponibilidad.leyenda.ocupada': 'Ocupada',
} as const

export type ClaveOperaciones = keyof typeof ES_OPERACIONES

export const EN_OPERACIONES: Record<ClaveOperaciones, string> = {
  'operaciones.slots.libres-de': '{disp} of {total} slots free',
  'operaciones.slots.total': '{total} slots',
  'operaciones.slots.slots': 'slots',
  'operaciones.clientes-badge.libres': '{libres} of {cupo} client places open',
  'operaciones.clientes-badge.lleno':
    'Client cap reached: {cupo} clients. Only campaigns from the clients already on it are accepted.',
  'operaciones.clientes-badge.clientes': 'clients',
  'operaciones.calendario.anterior': 'Previous month',
  'operaciones.calendario.siguiente': 'Next month',
  'operaciones.calendario.dias': 'M,T,W,T,F,S,S',
  'operaciones.calendario.confirmada': 'confirmed',
  'operaciones.calendario.en-propuesta': 'in a proposal',

  'operaciones.disponibilidad.titulo': 'Availability',
  'operaciones.disponibilidad.descripcion':
    'Future occupancy by two-week period or month: it checks confirmed bookings against the inventory to show what you have free ahead, and flags what is in an open proposal.',
  'operaciones.disponibilidad.kpi.estaticas': 'Free static sites',
  'operaciones.disponibilidad.kpi.de': '{n} of {total}',
  'operaciones.disponibilidad.kpi.en-periodo': 'in {periodo}',
  'operaciones.disponibilidad.kpi.digitales': 'Digital screens with room',
  'operaciones.disponibilidad.kpi.no-llenas': 'not full in {periodo}',
  'operaciones.disponibilidad.kpi.slots': 'Free slots',
  'operaciones.disponibilidad.kpi.sumando': 'across the digital screens with room',
  'operaciones.disponibilidad.kpi.ninguna-digital': 'no digital screen has room in the period',
  'operaciones.disponibilidad.kpi.en-propuesta': 'In a proposal',
  'operaciones.disponibilidad.kpi.piden.uno': 'screens requested by {n} open proposal · they don’t block',
  'operaciones.disponibilidad.kpi.piden.otros': 'screens requested by {n} open proposals · they don’t block',
  'operaciones.disponibilidad.kpi.ninguna-pide': 'no open proposal requests them',
  'operaciones.disponibilidad.desde': 'From',
  'operaciones.disponibilidad.vista': 'View',
  'operaciones.disponibilidad.catorcena': 'Two-week period',
  'operaciones.disponibilidad.mes': 'Month',
  'operaciones.disponibilidad.periodos': 'Periods',
  'operaciones.disponibilidad.periodos-title': 'Periods to show',
  'operaciones.disponibilidad.n-periodos': '{n} periods',
  'operaciones.disponibilidad.buscar-aria': 'Search screen',
  'operaciones.disponibilidad.buscar': 'Search screen: name or code…',
  'operaciones.disponibilidad.solo-hueco': 'Only with free space',
  'operaciones.disponibilidad.calendario': 'Calendar by screen',
  'operaciones.disponibilidad.calendario-sub':
    'Each cell shows its status; hover over it to see which campaign takes it.',
  'operaciones.disponibilidad.cargando': 'Loading availability…',
  'operaciones.disponibilidad.sin-coincidencias': 'No matching screens.',
  'operaciones.disponibilidad.pantalla': 'Screen',
  'operaciones.disponibilidad.digital': 'digital',
  'operaciones.disponibilidad.libres-de': '{n} of {total} free',
  'operaciones.disponibilidad.ocupante': '{campana} (confirmed)',
  'operaciones.disponibilidad.ocupante-slots': '{campana} (confirmed, {spots} slots)',
  'operaciones.disponibilidad.quedan': '{libres} of {total} slots left',
  'operaciones.disponibilidad.libre-slots': 'Free: {n} slots',
  'operaciones.disponibilidad.libre': 'Free',
  'operaciones.disponibilidad.en-propuesta-titulo': 'In proposal {folio}{cliente} ({desde} to {hasta}{spots})',
  'operaciones.disponibilidad.en-propuesta-spots': ', {n} spots',
  'operaciones.disponibilidad.celda.libres.uno': '{n} free',
  'operaciones.disponibilidad.celda.libres.otros': '{n} free',
  'operaciones.disponibilidad.celda.lleno': 'Full',
  'operaciones.disponibilidad.celda.en-propuesta': 'In a proposal',
  'operaciones.disponibilidad.celda.usados': '{n} used',
  'operaciones.disponibilidad.celda.ocupada': 'Occupied',
  'operaciones.disponibilidad.leyenda.libre': 'Free',
  'operaciones.disponibilidad.leyenda.en-propuesta': 'In a proposal (free, but an open proposal requests it)',
  'operaciones.disponibilidad.leyenda.parcial': 'Partial (digital: the number is the slots still free)',
  'operaciones.disponibilidad.leyenda.ocupada': 'Occupied',
}
