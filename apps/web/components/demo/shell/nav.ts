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

export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/demo', icon: LayoutDashboard, roles: ['DUENO'] },
  { key: 'inventario', label: 'Agregar inventario', href: '/demo/inventario', icon: PackagePlus, roles: ['DUENO'] },
  { key: 'comercial', label: 'Comercial', href: '/demo/comercial', icon: Map, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'creativos', label: 'Creativos', href: '/demo/creativos', icon: Images, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'campanas', label: 'Campañas', href: '/demo/campanas', icon: GitBranch, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'network', label: 'Network', href: '/demo/network', icon: Network, roles: ['DUENO', 'COMERCIAL'] },
  { key: 'arrendadores', label: 'Arrendadores', href: '/demo/arrendadores', icon: Building2, roles: ['DUENO'] },
  { key: 'operaciones', label: 'Operaciones', href: '/demo/operaciones', icon: ClipboardList, roles: ['DUENO', 'OPERACIONES'] },
  { key: 'imprenta', label: 'Imprenta', href: '/demo/imprenta', icon: Printer, roles: ['DUENO', 'IMPRENTA'] },
  { key: 'finanzas', label: 'Finanzas', href: '/demo/finanzas', icon: Receipt, roles: ['DUENO', 'FINANZAS'] },
  { key: 'actividad', label: 'Actividad', href: '/demo/actividad', icon: History, roles: ['DUENO'] },
  { key: 'administracion', label: 'Administración', href: '/demo/administracion', icon: Settings, roles: ['DUENO'] },
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
