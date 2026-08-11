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
//   Lo que tienes ..... el patrimonio que se vende: pantallas, sus dueños, y
//                       lo que se comparte con terceros.
//   Vender ............ el ciclo comercial, en su orden: a quién, dónde, si
//                       está libre, y la propuesta.
//   Entregar .......... lo vendido se ejecuta. Campañas ABRE el tramo porque
//                       es lo que sale de la propuesta aprobada.
//   Cobrar ............ el dinero, después de entregar.
//   Sistema ........... lo que no es el proceso: conexiones, historial y
//                       ajustes.
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
  { key: 'patrimonio', titulo: 'Lo que tienes' },
  { key: 'vender', titulo: 'Vender' },
  { key: 'entregar', titulo: 'Entregar' },
  { key: 'cobrar', titulo: 'Cobrar' },
  { key: 'sistema', titulo: 'Sistema' },
]

export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/inicio', icon: LayoutDashboard, roles: ['DUENO'], grupo: 'inicio' },

  // ─── Lo que tienes ───────────────────────────────────────────────────────
  // B3: se llamaba «Agregar inventario» pero abre el módulo entero —consulta,
  // carga masiva, exportación—, no solo el alta. El nombre prometía menos de lo
  // que hay y escondía la consulta a quien no entraba a curiosear.
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: PackagePlus, roles: ['DUENO'], grupo: 'patrimonio' },
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

  // ─── Entregar ────────────────────────────────────────────────────────────
  // Campañas ABRE el tramo: es lo que nace al aprobar una propuesta. Antes
  // estaba tercera en el menú, tres puestos por ENCIMA de Propuestas, que es de
  // donde sale.
  { key: 'campanas', label: 'Campañas', href: '/campanas', icon: GitBranch, roles: ['DUENO', 'COMERCIAL'], grupo: 'entregar' },
  { key: 'creativos', label: 'Creativos', href: '/creativos', icon: Images, roles: ['DUENO', 'COMERCIAL'], grupo: 'entregar' },
  { key: 'imprenta', label: 'Imprenta', href: '/imprenta', icon: Printer, roles: ['DUENO', 'IMPRENTA'], grupo: 'entregar' },
  { key: 'operaciones', label: 'Operaciones', href: '/operaciones', icon: ClipboardList, roles: ['DUENO', 'OPERACIONES'], grupo: 'entregar' },
  { key: 'almacen', label: 'Almacén', href: '/almacen', icon: Warehouse, roles: ['DUENO', 'OPERACIONES'], grupo: 'entregar' },

  // ─── Cobrar ──────────────────────────────────────────────────────────────
  { key: 'finanzas', label: 'Finanzas', href: '/finanzas', icon: Receipt, roles: ['DUENO', 'FINANZAS'], grupo: 'cobrar' },
  { key: 'comisiones', label: 'Comisiones', href: '/comisiones', icon: Percent, roles: ['DUENO', 'COMERCIAL'], grupo: 'cobrar' },

  // ─── Sistema ─────────────────────────────────────────────────────────────
  // Actividad y Administración cierran el menú SIEMPRE: son el historial y los
  // ajustes, no un paso del proceso.
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: Plug, roles: ['DUENO'], grupo: 'sistema' },
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
