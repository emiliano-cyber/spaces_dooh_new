// ============================================================================
//  lib/data/usuarios.ts — Usuarios demo para el login mock (sin backend)
// ----------------------------------------------------------------------------
//  Cada usuario tiene un rol; al iniciar sesión, el store fija ese rol y el
//  shell renderiza solo lo que ese rol debe ver (RBAC sin auth real). El
//  password es cosmético: en la demo cualquier contraseña entra.
// ============================================================================

import type { UsuarioDemo, RolDemo } from './types'
import { TOKEN_TELCO } from './tokens'

export const USUARIOS_DEMO: UsuarioDemo[] = [
  { id: 'u-dueno', nombre: 'María Quispe', email: 'maria@billboardsperu.pe', cargo: 'Dueña', rol: 'DUENO' },
  { id: 'u-comercial', nombre: 'Carlos Mendoza', email: 'carlos@billboardsperu.pe', cargo: 'Ejecutivo comercial', rol: 'COMERCIAL' },
  { id: 'u-operaciones', nombre: 'Luis Paredes', email: 'luis@billboardsperu.pe', cargo: 'Jefe de operaciones', rol: 'OPERACIONES' },
  { id: 'u-imprenta', nombre: 'Rosa Inga', email: 'rosa@billboardsperu.pe', cargo: 'Coordinadora de imprenta', rol: 'IMPRENTA' },
  { id: 'u-finanzas', nombre: 'Andrea Salas', email: 'andrea@billboardsperu.pe', cargo: 'Finanzas', rol: 'FINANZAS' },
  { id: 'u-cliente', nombre: 'Telco Andina', email: 'mquispe@telcoandina.pe', cargo: 'Cliente externo', rol: 'CLIENTE' },
]

// A dónde aterriza cada rol tras iniciar sesión.
export function landingDeRol(rol: RolDemo): string {
  switch (rol) {
    case 'DUENO':
      return '/demo'
    case 'COMERCIAL':
      return '/demo/comercial'
    case 'OPERACIONES':
      return '/demo/operaciones'
    case 'IMPRENTA':
      return '/demo/imprenta'
    case 'FINANZAS':
      return '/demo/finanzas'
    case 'CLIENTE':
      return `/demo/portal/${TOKEN_TELCO}`
  }
}
