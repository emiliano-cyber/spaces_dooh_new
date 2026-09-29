import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Map,
  GitBranch,
  Building2,
  ClipboardList,
  Printer,
  Receipt,
  Settings,
  History,
  Network,
  PackagePlus,
  Images,
  Users,
  FileText,
  Plug,
  Percent,
  CalendarRange,
  Warehouse,
  Zap,
  TrendingUp,
  Clock,
  Layers,
  Ticket,
  Package,
} from 'lucide-react'
import type { RolDemo } from '@/lib/data/types'

// Módulos del shell (sección 5). `roles` controla qué se RENDERIZA por rol:
// lo que un rol no debe ver, no se monta en el DOM (regla SET, no `disabled`).

// ─── El menú cuenta el proceso, en el orden en que ocurre ───────────────────
//
// Antes era una lista plana de dieciocho entradas y el orden no decía nada:
// **Campañas salía tercera**, antes que Clientes, Comercial y Propuestas — pero
// una campaña NACE de una propuesta aprobada, no al revés. Quien entraba nuevo
// leía el menú de arriba abajo y no encontraba por dónde se empieza.
//
// Ahora va por fases, y cada fase es un tramo real del negocio:
//
//   Dashboard ......... dónde estás. Va solo y sin título: es la portada.
//   Inventario ........ el patrimonio que se vende: pantallas, sus dueños, y
//                       lo que se comparte con terceros.
//   Comercial ......... el ciclo comercial, en su orden: a quién, dónde, si
//                       está libre, y la propuesta.
//   Operaciones ....... lo vendido se ejecuta. Campañas ABRE el tramo porque
//                       es lo que sale de la propuesta aprobada.
//   Finanzas .......... el dinero, después de entregar.
//   Sistema ........... lo que no es el proceso: conexiones, historial y
//                       ajustes.
//
// Ese grupo se ha rotulado de tres formas. Fue «Vender» hasta el 2026-08-26 y
// pasó a «Ventas» a petición de Jochelo, por sonar más amable: un menú no le da
// órdenes a quien lo usa, le dice dónde están las cosas. Desde el 2026-09-08 es
// «Comercial», y «Entregar» es «Operaciones», también a petición suya: los dos
// grupos toman el nombre del área que hace ese trabajo, no del verbo.
//
// Los títulos de los grupos son ROTULOS y las claves (`vender`, `entregar`,
// `patrimonio`, `cobrar`) son internas: se dejan como están a propósito.
// Renombrar las claves obligaría a tocar las dieciocho entradas para no cambiar
// nada de lo que se ve, y sería un diff largo donde el cambio real son dos
// palabras. **Las claves no son los rótulos y no tienen que coincidir**: si
// buscas el grupo «Comercial» en el código, su clave es `vender`.
//
// CUATRO grupos se llaman igual que una de sus entradas —Inventario, Finanzas y
// desde el 08/09 también Comercial y Operaciones—. Es a propósito: el encabezado
// nombra la fase y la entrada es la pantalla principal de esa fase.
//
// Los títulos NO son decoración: sin ellos el reordenamiento es invisible y
// pasa por un cambio arbitrario. Con ellos, el menú enseña el proceso.
//
// Un grupo sin ítems visibles no pinta su título (lo resuelve el Sidebar): un
// rol de Operaciones ve dos entradas, no seis encabezados vacíos.
export type GrupoNav = 'inicio' | 'patrimonio' | 'vender' | 'entregar' | 'cobrar' | 'sistema'

export interface NavItem {
  key: string
  label: string
  href: string
  icon: LucideIcon
  roles: RolDemo[]
  grupo: GrupoNav
}

// El orden de este arreglo ES el orden de las fases en el menú. `inicio` va sin
// título porque un encabezado sobre una sola entrada llamada «Dashboard» es
// ruido: ya se explica sola.
export const GRUPOS: { key: GrupoNav; titulo: string | null }[] = [
  { key: 'inicio', titulo: null },
  { key: 'patrimonio', titulo: 'Inventario' },
  { key: 'vender', titulo: 'Comercial' },
  { key: 'entregar', titulo: 'Operaciones' },
  { key: 'cobrar', titulo: 'Finanzas' },
  { key: 'sistema', titulo: 'Sistema' },
]

export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/inicio', icon: LayoutDashboard, roles: ['DUENO'], grupo: 'inicio' },

  // ─── Inventario ──────────────────────────────────────────────────────────
  // B3: se llamaba «Agregar inventario» pero abre el módulo entero —consulta,
  // carga masiva, exportación—, no solo el alta. El nombre prometía menos de lo
  // que hay y escondía la consulta a quien no entraba a curiosear.
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: PackagePlus, roles: ['DUENO'], grupo: 'patrimonio' },
  // REJILLA-01 · las dos dimensiones de la tarifa (ADR 0039, Fase 1). Va pegada
  // a Inventario y en «patrimonio», no en «sistema»: son PRECIOS DE VENTA de las
  // pantallas, no configuración administrativa. Y por eso su módulo es
  // `inventario` (`lib/modulos.ts`), igual que el guard de sus endpoints —
  // declararla en otro sería declarar una mentira en la matriz de permisos.
  { key: 'franjas-y-temporadas', label: 'Franjas y temporadas', href: '/franjas-y-temporadas', icon: Clock, roles: ['DUENO'], grupo: 'patrimonio' },
  // Arrendadores va pegado a Inventario y no suelto en medio del ciclo
  // comercial: una pantalla no es tuya, es de alguien que te la renta, y el
  // contrato con ese alguien es lo que te deja venderla (ADR 0003).
  { key: 'arrendadores', label: 'Arrendadores', href: '/arrendadores', icon: Building2, roles: ['DUENO'], grupo: 'patrimonio' },
  { key: 'network', label: 'Network', href: '/network', icon: Network, roles: ['DUENO', 'COMERCIAL'], grupo: 'patrimonio' },

  // ─── Vender ──────────────────────────────────────────────────────────────
  // En el orden en que se hace: a quién le vendes, qué le enseñas, si está
  // libre en esas fechas, y la propuesta que sale de ahí.
  { key: 'clientes', label: 'Clientes', href: '/clientes', icon: Users, roles: ['DUENO', 'COMERCIAL'], grupo: 'vender' },
  { key: 'comercial', label: 'Comercial', href: '/comercial', icon: Map, roles: ['DUENO', 'COMERCIAL'], grupo: 'vender' },
  { key: 'disponibilidad', label: 'Disponibilidad', href: '/disponibilidad', icon: CalendarRange, roles: ['DUENO', 'COMERCIAL'], grupo: 'vender' },
  { key: 'propuestas', label: 'Propuestas', href: '/propuestas', icon: FileText, roles: ['DUENO', 'COMERCIAL'], grupo: 'vender' },
  // ─── Las tres de abajo van en COMERCIAL, no en Inventario ──────────────────
  //
  // Decidido por el dueno el 2026-09-29: «todo lo de descuentos por volumen,
  // paquetes y codigos van en comercial, no inventario».
  //
  // Nacieron en `patrimonio` porque su endpoint pide el modulo `inventario`, y
  // ese fue el error de razonamiento: el PERMISO dice quien puede tocarlas, no
  // de quien es el trabajo. Un descuento por volumen, un cupon y un paquete son
  // decisiones de VENTA -- las usa quien cotiza, no quien da de alta pantallas.
  //
  // Lo que NO se movio es «Franjas y temporadas»: eso define de donde sale la
  // TARIFA de una pantalla, y una tarifa vive con la pantalla. Si tambien se
  // quiere en Comercial, es una linea.
  //
  // VOL-01 · la escala de volumen (ADR 0039, Fase 2). Pantalla PROPIA y no una
  // sección de la de arriba: aquélla declara de dónde sale el precio, ésta un
  // descuento que se aplica encima. Mismo grupo y mismo módulo —`inventario`,
  // como su endpoint— por el mismo razonamiento.
  { key: 'descuentos-por-volumen', label: 'Descuentos por volumen', href: '/descuentos-por-volumen', icon: Layers, roles: ['DUENO'], grupo: 'vender' },
  // COD-01 · los codigos promocionales (ADR 0039, Fase 3). Pantalla PROPIA y no
  // una seccion de la de arriba: el volumen es una regla interna que se aplica
  // sola, y un codigo es una CAMPANA que se le promete a un cliente por su
  // nombre, con fecha de caducidad y cupo. Mismo grupo y mismo modulo
  // --`inventario`, como su endpoint-- por el mismo razonamiento.
  { key: 'codigos-promocionales', label: 'Codigos promocionales', href: '/codigos-promocionales', icon: Ticket, roles: ['DUENO'], grupo: 'vender' },
  // PAQ-01 · los paquetes cerrados (ADR 0039, Fase 4). Pantalla PROPIA, y aqui
  // el motivo es mas fuerte que en las dos de arriba: aquellas son DESCUENTOS
  // sobre un precio, y un paquete SUSTITUYE el precio. Ponerlo con ellas haria
  // creer que es una rebaja mas, y esa confusion se paga al leer un reporte de
  // descuentos donde el paquete no aparece. Mismo grupo y mismo modulo
  // --`inventario`, como su endpoint-- por el mismo razonamiento.
  { key: 'paquetes', label: 'Paquetes cerrados', href: '/paquetes', icon: Package, roles: ['DUENO'], grupo: 'vender' },
  // Creativos cierra el tramo comercial desde el 2026-09-28, y venía de
  // «Operaciones». El cambio lo pidió un dueño con una pregunta literal:
  // «¿puedo programar las pautas desde el módulo de ventas?». La respuesta era
  // NO, y no por falta de función — la pantalla existe, funciona y la abren
  // DUEÑO y COMERCIAL— sino porque no había puerta: colgaba de un encabezado de
  // otra área y no la enlazaba ni Propuestas ni Comercial. Solo se llegaba desde
  // la ficha de una campaña.
  //
  // Se MOVIÓ en vez de duplicarse. Duplicar la entrada no es una opción cara,
  // es imposible: `nav.test.ts` exige claves y rutas únicas, y `AuthGate`
  // empareja por `href` (`path === n.href || path.startsWith(n.href + '/')`),
  // así que dos entradas con la misma ruta se encenderían las dos a la vez.
  //
  // Y encaja con quién la usa: `lib/modulos.ts:36` la autoriza con el módulo
  // `comercial`, no con `operaciones`. Un rol OPERACIONES nunca la vio.
  //
  // Lo que cuesta, dicho: el tramo «Operaciones» pierde el paso donde se sube
  // el arte, y el relato del menú —vender primero, entregar después— se estira
  // un poco, porque una pauta se arma sobre algo ya vendido. Se acepta: la
  // pauta se decide AL VENDER, y quien la arma es quien vende.
  { key: 'creativos', label: 'Creativos', href: '/creativos', icon: Images, roles: ['DUENO', 'COMERCIAL'], grupo: 'vender' },

  // ─── Entregar ────────────────────────────────────────────────────────────
  // Campañas ABRE el tramo: es lo que nace al aprobar una propuesta. Antes
  // estaba tercera en el menú, tres puestos por ENCIMA de Propuestas, que es de
  // donde sale.
  { key: 'campanas', label: 'Campañas', href: '/campanas', icon: GitBranch, roles: ['DUENO', 'COMERCIAL'], grupo: 'entregar' },
  // Creativos vivía AQUÍ hasta el 2026-09-28; se movió al grupo «Comercial»
  // (ver el porqué allí). La ficha de campaña sigue enlazándolo, que es el otro
  // camino y el más natural cuando ya hay campaña.
  { key: 'imprenta', label: 'Imprenta', href: '/imprenta', icon: Printer, roles: ['DUENO', 'IMPRENTA'], grupo: 'entregar' },
  { key: 'operaciones', label: 'Operaciones', href: '/operaciones', icon: ClipboardList, roles: ['DUENO', 'OPERACIONES'], grupo: 'entregar' },
  { key: 'almacen', label: 'Almacén', href: '/almacen', icon: Warehouse, roles: ['DUENO', 'OPERACIONES'], grupo: 'entregar' },
  // Sin esta entrada la ruta NO TIENE PUERTA: `moduloDe()` devuelve null para
  // lo que el NAV no conoce, y `AuthGate` deja pasar a cualquier rol interno.
  // El dato sigue protegido —el endpoint exige `operaciones`— pero el rol
  // equivocado veria la pantalla y se comeria un 403 sin saber por que, que es
  // el encierro que este repo ya documento dos veces. No es cosmetica.
  { key: 'energia', label: 'Consumo de luz', href: '/energia', icon: Zap, roles: ['DUENO', 'OPERACIONES'], grupo: 'entregar' },

  // ─── Finanzas ────────────────────────────────────────────────────────────
  { key: 'finanzas', label: 'Finanzas', href: '/finanzas', icon: Receipt, roles: ['DUENO', 'FINANZAS'], grupo: 'cobrar' },
  // Reportes va PEGADO a Finanzas y con sus MISMOS roles, porque la autoriza el
  // mismo módulo (`finanzas`, ver `lib/modulos.ts`). Si los roles divergieran,
  // un rol vería la entrada y se comería el 403 de `exigir('finanzas','ver')`
  // sin saber por qué — el encierro que este repo ya documentó dos veces.
  { key: 'reportes', label: 'Reportes', href: '/reportes', icon: TrendingUp, roles: ['DUENO', 'FINANZAS'], grupo: 'cobrar' },
  { key: 'comisiones', label: 'Comisiones', href: '/comisiones', icon: Percent, roles: ['DUENO', 'COMERCIAL'], grupo: 'cobrar' },

  // ─── Sistema ─────────────────────────────────────────────────────────────
  // Actividad y Administración cierran el menú SIEMPRE: son el historial y los
  // ajustes, no un paso del proceso.
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: Plug, roles: ['DUENO'], grupo: 'sistema' },
  // Las razones sociales del propio owner. Sin esta entrada nadie llega solo:
  // la pantalla existe y solo se alcanza por URL.
  //
  // Apuntaba a `/bienvenida` —el cuestionario— y desde el 2026-09-18 apunta a la
  // pantalla de GESTIÓN. El cuestionario es de una sola vez: contestado, responde
  // 409 y solo enseña lo que se contestó, así que un menú que lleve ahí manda a
  // una pantalla que ya no hace nada. El propio cuestionario enlaza aquí, y esta
  // pantalla enlaza al cuestionario mientras no haya ninguna razón social.
  { key: 'razones-sociales', label: 'Razones sociales', href: '/razones-sociales', icon: Building2, roles: ['DUENO'], grupo: 'sistema' },
  // Va aqui y no junto a Administracion: `nav.test.ts` exige que Actividad y
  // Administracion sean SIEMPRE los dos ultimos, en ese orden. La prueba lo
  // cazo al primer intento.
  { key: 'actividad', label: 'Actividad', href: '/actividad', icon: History, roles: ['DUENO'], grupo: 'sistema' },
  { key: 'administracion', label: 'Administración', href: '/administracion', icon: Settings, roles: ['DUENO'], grupo: 'sistema' },
]

export const ROLES: { value: RolDemo; label: string }[] = [
  { value: 'DUENO', label: 'Dueño' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'OPERACIONES', label: 'Operaciones' },
  { value: 'IMPRENTA', label: 'Imprenta' },
  { value: 'FINANZAS', label: 'Finanzas' },
  // 'CLIENTE' se retiró de esta lista (ADR 0010): `rol_permisos` no tiene NI UNA
  // fila para ese rol y `tienePermiso` es fail-closed, así que crear uno producía
  // un usuario que entraba y recibía 403 en todo. El cliente externo no necesita
  // cuenta: su portal va por token público.
  //
  // El tipo `RolDemo` y el manejo de 'CLIENTE' en AuthGate/landingDeRol SÍ se
  // conservan a propósito: el enum `rol_demo` de la base todavía admite el valor,
  // y si algún tenant tuviera un usuario así de antes, esa rama lo lleva a su
  // portal en vez de dejarlo en un bucle. Lo que se cierra es la puerta de
  // creación, no el manejo de lo que ya exista.
]

export function rolLabel(rol: RolDemo): string {
  return ROLES.find((r) => r.value === rol)?.label ?? rol
}
