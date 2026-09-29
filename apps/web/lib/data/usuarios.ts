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
  { id: 'u-rgb', nombre: 'Cliente_ RGB Catorce', email: 'jose@pixeled.com.mx', cargo: 'Dueño', rol: 'DUENO', activo: true },
  { id: 'u-dueno', nombre: 'María Quispe', email: 'maria@billboardsperu.pe', cargo: 'Dueña', rol: 'DUENO', activo: true },
  { id: 'u-comercial', nombre: 'Carlos Mendoza', email: 'carlos@billboardsperu.pe', cargo: 'Ejecutivo comercial', rol: 'COMERCIAL', activo: true },
  { id: 'u-operaciones', nombre: 'Luis Paredes', email: 'luis@billboardsperu.pe', cargo: 'Jefe de operaciones', rol: 'OPERACIONES', activo: true },
  { id: 'u-imprenta', nombre: 'Rosa Inga', email: 'rosa@billboardsperu.pe', cargo: 'Coordinadora de imprenta', rol: 'IMPRENTA', activo: true },
  { id: 'u-finanzas', nombre: 'Andrea Salas', email: 'andrea@billboardsperu.pe', cargo: 'Finanzas', rol: 'FINANZAS', activo: true },
  { id: 'u-cliente', nombre: 'Telco Andina', email: 'mquispe@telcoandina.pe', cargo: 'Cliente externo', rol: 'CLIENTE', activo: true },
]

// A dónde aterriza cada rol tras iniciar sesión.
//
// El `switch` NO lleva `default` a propósito: así el compilador obliga a
// contestar por cada valor nuevo de `RolDemo`. Sin eso, un rol añadido al tipo y
// olvidado aquí devolvería `undefined` y el usuario acabaría en una URL
// literalmente llamada «undefined» — el ADR 0040 lo anotó como riesgo antes de
// añadir cuatro valores de golpe.
export function landingDeRol(rol: RolDemo): string {
  switch (rol) {
    case 'DUENO':
    // ADR 0040 · el administrador hace lo mismo que el Dueño, así que empieza
    // donde él: en el tablero, no en una pantalla de trabajo.
    case 'ADMINISTRADOR':
      return '/inicio'
    // Los tres roles de venta aterrizan en el ciclo comercial. 'COMERCIAL' se
    // retiró de uso (ADR 0040) pero conserva su destino: si una instancia vieja
    // todavía tiene uno, es mejor que llegue a una pantalla que le contestará
    // 403 con una frase, a que se quede en un bucle de redirección.
    case 'COMERCIAL':
    case 'DIRECTOR_COMERCIAL':
    case 'GERENTE_VENTAS':
    case 'VENDEDOR':
      return '/comercial'
    case 'OPERACIONES':
      return '/operaciones'
    case 'IMPRENTA':
      return '/imprenta'
    case 'FINANZAS':
      return '/finanzas'
    case 'CLIENTE':
      return `/portal/${TOKEN_TELCO}`
  }
}
