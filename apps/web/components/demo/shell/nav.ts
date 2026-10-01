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
  Handshake,
  Eye,
  LineChart,
  Type,
  CalendarClock,
  Megaphone,
  BadgeCheck,
  TriangleAlert,
} from 'lucide-react'
import { ROLES_ASIGNABLES, rolLabel } from '@/lib/roles'
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
export type GrupoNav = 'inicio' | 'patrimonio' | 'ojos' | 'vender' | 'entregar' | 'cobrar' | 'sistema'

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
  { key: 'ojos', titulo: 'Space Eyes' },
  { key: 'vender', titulo: 'Comercial' },
  { key: 'entregar', titulo: 'Operaciones' },
  { key: 'cobrar', titulo: 'Finanzas' },
  { key: 'sistema', titulo: 'Sistema' },
]

// --- Los tres repartos que se repiten (ADR 0040, 2026-09-29) ----------------
//
// No son azucar sintactico: la lista literal repetida veinticinco veces es
// exactamente como un rol se queda fuera de una pantalla sin que nadie lo note
// -- y con cuatro roles entrando de golpe, veinticinco oportunidades.
//
//   MANDO ....... quien administra la instancia. El ADR 0040 dice que el
//                 administrador «puede hacer las mismas cosas» que el Dueno, y
//                 en el menu eso es literal: no hay una sola entrada que vea uno
//                 y no vea el otro. Lo que NO copia son los cuatro sitios donde
//                 'DUENO' esta escrito a mano fuera de `rol_permisos`.
//   VENTA ....... los tres roles de venta. Ven el ciclo comercial entero.
//   JEFES_VENTA . los dos que ademas DEFINEN el catalogo de precio. El vendedor
//                 aplica codigos y paquetes; no los crea, asi que no ve sus
//                 pantallas de gestion. Ensenarselas seria el «encierro» que
//                 este repositorio ya documento dos veces: el servidor niega lo
//                 que la pantalla ofrece.
const MANDO: RolDemo[] = ['DUENO', 'ADMINISTRADOR']
const VENTA: RolDemo[] = ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']
const JEFES_VENTA: RolDemo[] = ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS']

export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/inicio', icon: LayoutDashboard, roles: [...MANDO, ...VENTA], grupo: 'inicio' },

  // ─── Inventario ──────────────────────────────────────────────────────────
  // B3: se llamaba «Agregar inventario» pero abre el módulo entero —consulta,
  // carga masiva, exportación—, no solo el alta. El nombre prometía menos de lo
  // que hay y escondía la consulta a quien no entraba a curiosear.
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: PackagePlus, roles: [...MANDO], grupo: 'patrimonio' },
  // Arrendadores va pegado a Inventario y no suelto en medio del ciclo
  // comercial: una pantalla no es tuya, es de alguien que te la renta, y el
  // contrato con ese alguien es lo que te deja venderla (ADR 0003).
  { key: 'arrendadores', label: 'Arrendadores', href: '/arrendadores', icon: Building2, roles: [...MANDO], grupo: 'patrimonio' },
  { key: 'network', label: 'Network', href: '/network', icon: Network, roles: [...MANDO, ...VENTA], grupo: 'patrimonio' },
  // ALMACEN va en Inventario y no en Operaciones (decidido el 2026-09-29):
  // lo que guarda son BIENES -- lonas, herrajes, material--, y un inventario de
  // cosas propias pertenece al mismo sitio que el inventario de pantallas. Que
  // lo MUEVA operaciones no lo convierte en una tarea de operaciones, igual que
  // el almacen de una tienda no es del repartidor.
  { key: 'almacen', label: 'Almacén', href: '/almacen', icon: Warehouse, roles: [...MANDO, 'OPERACIONES'], grupo: 'patrimonio' },

  // ─── Space Eyes ──────────────────────────────────────────────────────────
  // Va DESPUES de Inventario y ANTES de Comercial, y con grupo propio, por la
  // misma regla con la que esta ordenado el resto del menu: el encabezado
  // nombra la fase y la entrada es su pantalla principal. Colgarlo de
  // Inventario lo haria parecer un accesorio de la ficha de una pantalla, que
  // es justo lo que dejo de ser: aqui se entra a mirar la flota de equipos,
  // no una pantalla.
  //
  // Lo ven mando y venta (los mismos que Comercial): quien ensena una pantalla
  // a un cliente es quien primero necesita saber si la camara de ese sitio esta
  // viva y que enseno ayer.
  { key: 'space-eyes', label: 'Equipos', href: '/space-eyes', icon: Eye, roles: [...MANDO, ...VENTA], grupo: 'ojos' },
  // El resto del panel de Space Eye, dentro de SPACE OS (ADR 0041): lo que antes
  // se operaba en el dashboard propio de Space Eye vive aqui, con los mismos
  // roles. Todo habla con el Space Eye de ESTA instancia por /api/space-eyes/se.
  { key: 'space-eyes-galeria', label: 'Galería', href: '/space-eyes/galeria', icon: Images, roles: [...MANDO, ...VENTA], grupo: 'ojos' },
  { key: 'space-eyes-graficas', label: 'Gráficas', href: '/space-eyes/graficas', icon: LineChart, roles: [...MANDO, ...VENTA], grupo: 'ojos' },
  { key: 'space-eyes-texto', label: 'Ajustar texto', href: '/space-eyes/texto', icon: Type, roles: [...MANDO], grupo: 'ojos' },
  { key: 'space-eyes-programacion', label: 'Programación', href: '/space-eyes/programacion', icon: CalendarClock, roles: [...MANDO], grupo: 'ojos' },
  { key: 'space-eyes-campanas', label: 'Campañas', href: '/space-eyes/campanas', icon: Megaphone, roles: [...MANDO, ...VENTA], grupo: 'ojos' },
  { key: 'space-eyes-verificacion', label: 'Verificación', href: '/space-eyes/verificacion', icon: BadgeCheck, roles: [...MANDO, ...VENTA], grupo: 'ojos' },
  { key: 'space-eyes-fallas', label: 'Fallas', href: '/space-eyes/fallas', icon: TriangleAlert, roles: [...MANDO, ...VENTA], grupo: 'ojos' },

  // ─── Vender ──────────────────────────────────────────────────────────────
  // En el orden en que se hace: a quién le vendes, qué le enseñas, si está
  // libre en esas fechas, y la propuesta que sale de ahí.
  { key: 'clientes', label: 'Clientes', href: '/clientes', icon: Users, roles: [...MANDO, ...VENTA], grupo: 'vender' },
  { key: 'comercial', label: 'Comercial', href: '/comercial', icon: Map, roles: [...MANDO, ...VENTA], grupo: 'vender' },
  { key: 'disponibilidad', label: 'Disponibilidad', href: '/disponibilidad', icon: CalendarRange, roles: [...MANDO, ...VENTA], grupo: 'vender' },
  { key: 'propuestas', label: 'Propuestas', href: '/propuestas', icon: FileText, roles: [...MANDO, ...VENTA], grupo: 'vender' },
  // CAP-01 · la bitacora de captacion: OCULTA del menu desde el 2026-09-30.
  // Pedido del dueno: «elimina captacion por ahora u ocultalo»; se solapaba con
  // Comercial OPEX, que es la forma que prefiere. Solo se quita la ENTRADA: las
  // tablas, la API y el modulo `captacion` de permisos siguen, asi que volver a
  // ponerla es restaurar esta linea:
  //   { key: 'captacion', label: 'Captación', href: '/captacion', icon: Target, roles: [...MANDO, ...VENTA], grupo: 'vender' },
  // Maqueta pedida el 2026-09-30: la prospección de arrendadores. Sin base y
  // sin formularios todavía. SE SOLAPA con Captación —que sí tiene base— y la
  // decisión de si se construye encima de `prospectos` o aparte está abierta.
  { key: 'comercial-opex', label: 'Comercial OPEX', href: '/comercial-opex', icon: Handshake, roles: [...MANDO, ...VENTA], grupo: 'vender' },
  // ─── Las cuatro de la CADENA DE PRECIO, en Comercial ──────────────────────
  //
  // Van en este orden a proposito: primero de donde sale la tarifa, y luego lo
  // que se le aplica encima. Es la cadena del ADR 0039 leida de arriba abajo.
  //
  // REJILLA-01 · las dos dimensiones de la tarifa (ADR 0039, Fase 1).
  // Estuvo en «patrimonio» hasta el 2026-09-29 con este argumento: son precios
  // DE LAS PANTALLAS, asi que viven con la pantalla. El dueno decidio lo
  // contrario y tiene mejor razon: un precio de venta es del oficio de vender,
  // aunque cuelgue de una pantalla. Su modulo sigue siendo `inventario`, que es
  // el de sus endpoints -- el permiso dice quien puede tocarla, no de quien es
  // el trabajo, que fue justo el error que puso aqui a las otras tres.
  { key: 'franjas-y-temporadas', label: 'Franjas y temporadas', href: '/franjas-y-temporadas', icon: Clock, roles: [...MANDO, ...JEFES_VENTA], grupo: 'vender' },
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
  { key: 'descuentos-por-volumen', label: 'Descuentos por volumen', href: '/descuentos-por-volumen', icon: Layers, roles: [...MANDO, ...JEFES_VENTA], grupo: 'vender' },
  // COD-01 · los codigos promocionales (ADR 0039, Fase 3). Pantalla PROPIA y no
  // una seccion de la de arriba: el volumen es una regla interna que se aplica
  // sola, y un codigo es una CAMPANA que se le promete a un cliente por su
  // nombre, con fecha de caducidad y cupo. Mismo grupo y mismo modulo
  // --`inventario`, como su endpoint-- por el mismo razonamiento.
  { key: 'codigos-promocionales', label: 'Codigos promocionales', href: '/codigos-promocionales', icon: Ticket, roles: [...MANDO, ...JEFES_VENTA], grupo: 'vender' },
  // PAQ-01 · los paquetes cerrados (ADR 0039, Fase 4). Pantalla PROPIA, y aqui
  // el motivo es mas fuerte que en las dos de arriba: aquellas son DESCUENTOS
  // sobre un precio, y un paquete SUSTITUYE el precio. Ponerlo con ellas haria
  // creer que es una rebaja mas, y esa confusion se paga al leer un reporte de
  // descuentos donde el paquete no aparece. Mismo grupo y mismo modulo
  // --`inventario`, como su endpoint-- por el mismo razonamiento.
  { key: 'paquetes', label: 'Paquetes cerrados', href: '/paquetes', icon: Package, roles: [...MANDO, ...JEFES_VENTA], grupo: 'vender' },
  // Creativos estuvo AQUÍ del 2026-09-28 al 2026-09-30; volvió a «Operaciones»
  // (ver el porqué allí).

  // ─── Entregar ────────────────────────────────────────────────────────────
  // Campañas ABRE el tramo: es lo que nace al aprobar una propuesta. Antes
  // estaba tercera en el menú, tres puestos por ENCIMA de Propuestas, que es de
  // donde sale.
  { key: 'campanas', label: 'Campañas', href: '/campanas', icon: GitBranch, roles: [...MANDO, ...VENTA], grupo: 'entregar' },
  // Creativos va justo después de Campañas: sus pautas se arman sobre una
  // campaña ya creada, y desde el 2026-09-30 solo lista campañas de pantallas
  // digitales (`lib/creativos-digitales.ts`).
  //
  // Historia, porque ya se movió dos veces. Vivía aquí hasta el 2026-09-28; un
  // dueño preguntó «¿puedo programar las pautas desde el módulo de ventas?» y
  // se pasó al grupo «Comercial», porque colgaba de un encabezado de otra área y
  // ni Propuestas ni Comercial lo enlazaban. El 2026-09-30 el dueño pidió
  // literalmente «el menu de creativo muevelo a operaciones», y volvió.
  //
  // Lo que NO cambió al moverlo: los ROLES. Sigue siendo [...MANDO, ...VENTA],
  // porque `lib/modulos.ts` lo autoriza con el módulo `comercial`; un rol
  // OPERACIONES no lo ve, y darle la entrada sin el permiso sería ofrecerle una
  // pantalla que responde 403. Quien vende lo encuentra igual, ahora bajo el
  // encabezado «Operaciones», donde ya ve Campañas.
  //
  // Se MUEVE, nunca se duplica: `nav.test.ts` exige claves y rutas únicas, y
  // `AuthGate` empareja por `href`, así que dos entradas con la misma ruta se
  // encenderían las dos a la vez.
  { key: 'creativos', label: 'Creativos', href: '/creativos', icon: Images, roles: [...MANDO, ...VENTA], grupo: 'entregar' },
  { key: 'imprenta', label: 'Imprenta', href: '/imprenta', icon: Printer, roles: [...MANDO, 'IMPRENTA'], grupo: 'entregar' },
  { key: 'operaciones', label: 'Operaciones', href: '/operaciones', icon: ClipboardList, roles: [...MANDO, 'OPERACIONES', 'FINANZAS'], grupo: 'entregar' },
  // Sin esta entrada la ruta NO TIENE PUERTA: `moduloDe()` devuelve null para
  // lo que el NAV no conoce, y `AuthGate` deja pasar a cualquier rol interno.
  // El dato sigue protegido —el endpoint exige `operaciones`— pero el rol
  // equivocado veria la pantalla y se comeria un 403 sin saber por que, que es
  // el encierro que este repo ya documento dos veces. No es cosmetica.
  { key: 'energia', label: 'Consumo de luz', href: '/energia', icon: Zap, roles: [...MANDO, 'OPERACIONES'], grupo: 'entregar' },

  // ─── Finanzas ────────────────────────────────────────────────────────────
  { key: 'finanzas', label: 'Finanzas', href: '/finanzas', icon: Receipt, roles: [...MANDO, 'FINANZAS', 'DIRECTOR_COMERCIAL'], grupo: 'cobrar' },
  // Reportes va PEGADO a Finanzas y con sus MISMOS roles, porque la autoriza el
  // mismo módulo (`finanzas`, ver `lib/modulos.ts`). Si los roles divergieran,
  // un rol vería la entrada y se comería el 403 de `exigir('finanzas','ver')`
  // sin saber por qué — el encierro que este repo ya documentó dos veces.
  { key: 'reportes', label: 'Reportes', href: '/reportes', icon: TrendingUp, roles: [...MANDO, 'FINANZAS', 'DIRECTOR_COMERCIAL'], grupo: 'cobrar' },
  { key: 'comisiones', label: 'Comisiones', href: '/comisiones', icon: Percent, roles: [...MANDO, ...VENTA], grupo: 'cobrar' },

  // ─── Sistema ─────────────────────────────────────────────────────────────
  // Actividad y Administración cierran el menú SIEMPRE: son el historial y los
  // ajustes, no un paso del proceso.
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: Plug, roles: [...MANDO], grupo: 'sistema' },
  // Las razones sociales del propio owner. Sin esta entrada nadie llega solo:
  // la pantalla existe y solo se alcanza por URL.
  //
  // Apuntaba a `/bienvenida` —el cuestionario— y desde el 2026-09-18 apunta a la
  // pantalla de GESTIÓN. El cuestionario es de una sola vez: contestado, responde
  // 409 y solo enseña lo que se contestó, así que un menú que lleve ahí manda a
  // una pantalla que ya no hace nada. El propio cuestionario enlaza aquí, y esta
  // pantalla enlaza al cuestionario mientras no haya ninguna razón social.
  { key: 'razones-sociales', label: 'Razones sociales', href: '/razones-sociales', icon: Building2, roles: [...MANDO], grupo: 'sistema' },
  // Va aqui y no junto a Administracion: `nav.test.ts` exige que Actividad y
  // Administracion sean SIEMPRE los dos ultimos, en ese orden. La prueba lo
  // cazo al primer intento.
  { key: 'actividad', label: 'Actividad', href: '/actividad', icon: History, roles: [...MANDO], grupo: 'sistema' },
  { key: 'administracion', label: 'Administración', href: '/administracion', icon: Settings, roles: [...MANDO], grupo: 'sistema' },
]

// --- El catalogo de roles se MUDO a `lib/roles.ts` (ADR 0040) ---------------
//
// Vivia aqui, y aqui tenia un problema: `nav.ts` importa iconos de lucide, o sea
// que un modulo de servidor no puede leer esta lista sin arrastrarse media
// libreria de iconos. Por eso `usuarios-controller.ts` tenia su PROPIA copia en
// un `z.enum`, y las dos podian divergir -- que es justo lo que el ADR 0010 ya
// habia pagado con 'CLIENTE': el desplegable lo ofrecia y la matriz de permisos
// no tenia ni una fila suya.
//
// Se reexportan para no tocar a quien ya los importaba de aqui.
export { ROLES_ASIGNABLES as ROLES, rolLabel }
