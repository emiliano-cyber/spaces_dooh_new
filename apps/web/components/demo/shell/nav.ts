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

export interface NavItem {
  key: string
  label: string
  href: string
  icon: LucideIcon
  roles: RolDemo[]
}

// Orden = flujo real de creación:
//   1) Dashboard · 2) Agregar inventario · 3) Campañas (fijos, arriba)
//   Base de inventario → ciclo comercial → producción → operación → cobranza
//   Últimos 3 (Integraciones · Actividad · Administración) se mantienen al final.
export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/inicio', icon: LayoutDashboard, roles: ['DUENO'] },
  { key: 'inventario', label: 'Agregar inventario', href: '/inventario', icon: PackagePlus, roles: ['DUENO'] },
  { key: 'campanas', label: 'Campañas', href: '/campanas', icon: GitBranch, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'arrendadores', label: 'Arrendadores', href: '/arrendadores', icon: Building2, roles: ['DUENO'] },
  { key: 'network', label: 'Network', href: '/network', icon: Network, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'clientes', label: 'Clientes', href: '/clientes', icon: Users, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'comercial', label: 'Comercial', href: '/comercial', icon: Map, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'disponibilidad', label: 'Disponibilidad', href: '/disponibilidad', icon: CalendarRange, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'propuestas', label: 'Propuestas', href: '/propuestas', icon: FileText, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'creativos', label: 'Creativos', href: '/creativos', icon: Images, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'imprenta', label: 'Imprenta', href: '/imprenta', icon: Printer, roles: ['DUENO', 'IMPRENTA'] },
  { key: 'operaciones', label: 'Operaciones', href: '/operaciones', icon: ClipboardList, roles: ['DUENO', 'OPERACIONES'] },
  { key: 'almacen', label: 'Almacén', href: '/almacen', icon: Warehouse, roles: ['DUENO', 'OPERACIONES'] },
  { key: 'finanzas', label: 'Finanzas', href: '/finanzas', icon: Receipt, roles: ['DUENO', 'FINANZAS'] },
  { key: 'comisiones', label: 'Comisiones', href: '/comisiones', icon: Percent, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: Plug, roles: ['DUENO'] },
  { key: 'actividad', label: 'Actividad', href: '/actividad', icon: History, roles: ['DUENO'] },
  { key: 'administracion', label: 'Administración', href: '/administracion', icon: Settings, roles: ['DUENO'] },
]

export const ROLES: { value: RolDemo; label: string }[] = [
  { value: 'DUENO', label: 'Dueño' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'OPERACIONES', label: 'Operaciones' },
  { value: 'IMPRENTA', label: 'Imprenta' },
  { value: 'FINANZAS', label: 'Finanzas' },
  { value: 'CLIENTE', label: 'Cliente externo' },
]

export function rolLabel(rol: RolDemo): string {
  return ROLES.find((r) => r.value === rol)?.label ?? rol
}
