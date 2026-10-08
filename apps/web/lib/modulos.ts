// ============================================================================
//  lib/modulos.ts — Qué área de la interfaz gobierna cada módulo de permiso.
// ----------------------------------------------------------------------------
//  ADR 0010. La matriz de Administración mostraba 8 módulos y parecía completa,
//  pero el producto tiene 18 áreas: marcar `comercial` abría además Clientes,
//  Propuestas y Campañas sin que nada lo dijera. Quien administra permisos no
//  tenía forma de saber qué estaba concediendo.
//
//  La unidad de autorización SIGUE siendo el módulo — esto no añade permisos
//  nuevos, solo deja de esconder qué abre cada casilla.
//
//  Sobre `apiPropia`: cuatro áreas (Disponibilidad, Creativos, Comisiones,
//  Actividad) no tienen endpoints propios; leen todo de `/api/estado`. Su
//  entrada aquí sirve para decir de quién dependen, pero ocultarles el menú NO
//  protegería el dato — lo protege el permiso con el que `/api/estado` filtra.
//  Se marca explícitamente para que nadie confunda «no aparece en el menú» con
//  «está protegido».
// ============================================================================

export interface AreaProducto {
  clave: string
  label: string
  // Módulo de `rol_permisos` que la autoriza.
  modulo: string
  // ¿Tiene endpoints propios bajo /api? Si no, se sirve de /api/estado.
  apiPropia: boolean
}

export const AREAS: AreaProducto[] = [
  { clave: 'dashboard', label: 'Dashboard', modulo: 'dashboard', apiPropia: false },
  { clave: 'comercial', label: 'Comercial', modulo: 'comercial', apiPropia: true },
  { clave: 'clientes', label: 'Clientes', modulo: 'comercial', apiPropia: true },
  { clave: 'propuestas', label: 'Propuestas', modulo: 'comercial', apiPropia: true },
  { clave: 'campanas', label: 'Campañas', modulo: 'comercial', apiPropia: true },
  { clave: 'disponibilidad', label: 'Disponibilidad', modulo: 'comercial', apiPropia: false },
  { clave: 'creativos', label: 'Creativos', modulo: 'comercial', apiPropia: false },
  { clave: 'comisiones', label: 'Comisiones', modulo: 'comercial', apiPropia: false },
  // CAP-01 · modulo PROPIO y no `comercial`: aprobar un prospecto da de alta un
  // cliente, un arrendador o un predio, y eso no lo decide quien cotiza. Con
  // `comercial.aprobar` el permiso de aprobar propuestas y el de aprobar
  // captaciones serian el mismo, y la matriz no podria separarlos.
  { clave: 'captacion', label: 'Captación', modulo: 'captacion', apiPropia: true },
  // Maqueta del 2026-09-30: prospección de arrendadores. `apiPropia: false`
  // porque HOY NO TIENE API NI BASE -- se pidió «solo html sin funciones». El
  // día que la tenga, esto pasa a `true` y hay que decidir si su módulo sigue
  // siendo `comercial` o se va con `captacion`, con la que se solapa.
  { clave: 'comercial-opex', label: 'Comercial OPEX', modulo: 'comercial', apiPropia: false },
  { clave: 'inventario', label: 'Inventario', modulo: 'inventario', apiPropia: true },
  // Las ocho pantallas de Space Eyes (equipos, galería, vivo, programación,
  // campañas, verificación, fallas) exigen `inventario.ver` / `inventario.crear`.
  // Sin esta línea, quien marcaba «Inventario» abría las cámaras y las fotos de
  // los espectaculares sin que la matriz lo dijera: el defecto exacto de arriba.
  // Con `crear`, además, se reinicia o actualiza un equipo a distancia.
  { clave: 'space-eyes', label: 'Space Eyes (cámaras, fotos, vivo y órdenes a los equipos)', modulo: 'inventario', apiPropia: true },
  // ─── Las cuatro de la cadena de precio: modulo `precios` ──────────────────
  //
  // Han cambiado de modulo DOS VECES el mismo dia, el 2026-09-29, y las dos
  // veces por una razon distinta. Conviene que las dos queden escritas, porque
  // si no la segunda parece una vuelta atras de la primera y no lo es:
  //
  //  · Por la MANANA pasaron de `inventario` a `comercial`. El argumento que
  //    las tenia en `inventario` era circular y estaba escrito: «bajo
  //    `inventario` porque el guard de sus endpoints ya exige `inventario`».
  //    Eso no dice de quien es el TRABAJO, solo repite quien puede tocarlo hoy.
  //    Y el trabajo es de quien vende.
  //
  //  · Por la TARDE, con el ADR 0040, pasaron a `precios`, y eso responde otra
  //    pregunta: QUIEN PUEDE ESCRIBIRLO. El ADR pide que el VENDEDOR cotice y
  //    aplique codigos pero NO los cree, y con estas pantallas bajo `comercial`
  //    eso era literalmente inexpresable: crear una propuesta y crear un cupon
  //    eran el MISMO permiso (`comercial.crear`). Un vendedor que pueda cotizar
  //    podria emitir cupones, y ningun reparto de la matriz lo impide.
  //
  // Lo que NO se movio, ni por la manana ni por la tarde:
  // `/api/sitios/:id/rejilla`, la captura de tarifas DESDE LA FICHA de una
  // pantalla. Esa se hace sobre una pantalla concreta y sigue siendo inventario.
  //
  // El permiso `precios.ver` lo tienen los CUATRO roles de venta, y no es un
  // descuido: la pantalla de Propuestas lee el catalogo para poder aplicarlo
  // (`propuestas/page.tsx` pide franjas y escalas; `propuestas/[id]/page.tsx`,
  // paquetes). Sin `ver`, el vendedor no podria cotizar. Lo que le falta es
  // `crear`.
  { clave: 'franjas-y-temporadas', label: 'Franjas y temporadas', modulo: 'precios', apiPropia: true },
  { clave: 'descuentos-por-volumen', label: 'Descuentos por volumen', modulo: 'precios', apiPropia: true },
  { clave: 'codigos-promocionales', label: 'Codigos promocionales', modulo: 'precios', apiPropia: true },
  // PAQ-01 · y aqui importa mas que en las otras tres: quien pueda escribir
  // aqui fija el precio de una venta entera saltandose la rejilla y el tope de
  // descuento.
  { clave: 'paquetes', label: 'Paquetes cerrados', modulo: 'precios', apiPropia: true },
  { clave: 'arrendadores', label: 'Arrendadores', modulo: 'arrendadores', apiPropia: true },
  { clave: 'operaciones', label: 'Operaciones', modulo: 'operaciones', apiPropia: true },
  { clave: 'almacen', label: 'Almacén', modulo: 'operaciones', apiPropia: true },
  { clave: 'energia', label: 'Consumo de luz', modulo: 'operaciones', apiPropia: true },
  { clave: 'imprenta', label: 'Imprenta', modulo: 'imprenta', apiPropia: true },
  { clave: 'finanzas', label: 'Finanzas', modulo: 'finanzas', apiPropia: true },
  // Reportes de rentabilidad va bajo `finanzas` y NO bajo `dashboard`: enseña
  // lo que se cobra por cada pantalla y lo que se le paga a cada arrendador, o
  // sea dinero, no un indicador de vitrina. Con `dashboard` lo vería cualquier
  // rol que pueda abrir el tablero. El guard del endpoint ya exige
  // `finanzas.ver` (`app/api/reportes/rentabilidad/route.ts`), así que
  // declararla en otro módulo sería declarar una mentira.
  { clave: 'reportes', label: 'Reportes', modulo: 'finanzas', apiPropia: true },
  { clave: 'network', label: 'Network', modulo: 'network', apiPropia: true },
  { clave: 'integraciones', label: 'Integraciones', modulo: 'administracion', apiPropia: true },
  // Las razones sociales PROPIAS del owner van bajo `administracion` y NO bajo
  // `arrendadores`: son la identidad fiscal del negocio —a nombre de quién paga
  // y factura—, no un dato operativo del módulo de propietarios. Quien captura
  // contratos no decide con qué sociedad se firma. El guard de sus endpoints ya
  // exige `administracion` (`app/api/entidades/route.ts`), así que declararla en
  // otro módulo sería declarar una mentira — y quien marcara esa casilla en la
  // matriz de permisos creería estar concediendo otra cosa.
  { clave: 'razones-sociales', label: 'Razones sociales', modulo: 'administracion', apiPropia: true },
  { clave: 'actividad', label: 'Actividad', modulo: 'administracion', apiPropia: false },
  { clave: 'administracion', label: 'Administración', modulo: 'administracion', apiPropia: true },
]

// Áreas que abre un módulo dado, para explicarlo junto a la casilla.
export function areasDeModulo(modulo: string): AreaProducto[] {
  return AREAS.filter((a) => a.modulo === modulo)
}

// Los módulos que el producto usa de verdad, en orden de presentación. Sale del
// catálogo y no de una lista aparte: dos listas divergen, una no puede.
export const MODULOS: string[] = AREAS.reduce<string[]>((acc, a) => {
  if (!acc.includes(a.modulo)) acc.push(a.modulo)
  return acc
}, [])
