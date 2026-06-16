// ============================================================================
//  lib/data/store.ts — Estado en memoria mutable + suscripción (zustand)
// ----------------------------------------------------------------------------
//  El store guarda el DemoState completo más el rol activo de la demo. Es la
//  ÚNICA fuente de verdad en memoria. Las pantallas NO lo tocan directo: pasan
//  por `client.ts`, que delega en `adapters/mock.ts`, que lee/escribe aquí.
//
//  Cualquier escritura vía `setState` dispara las suscripciones de zustand, así
//  que mapa, dashboard, pipeline y listas re-renderizan solos. Eso ES la demo.
//
//  Sin persistencia: un refresh reinicia el store al seed (decisión de diseño).
//  El botón "Reiniciar demo" llama a `reiniciarDemo()`.
// ============================================================================

import { create } from 'zustand'
import type { DemoState, RolDemo, UsuarioDemo, ConfigNegocio, AccionLog } from './types'
import { buildSeed } from './seed'

// Crea una entrada de bitácora con el usuario en sesión.
function accion(state: { usuarioActivo: UsuarioDemo | null }, accion: string, entidad: string): AccionLog {
  return {
    id: `acc-${Date.now().toString(36)}-${Math.round(performance.now())}`,
    accion,
    entidad,
    usuarioId: state.usuarioActivo?.id ?? null,
    usuarioNombre: state.usuarioActivo?.nombre ?? 'Sistema',
    timestamp: new Date().toISOString(),
  }
}

export interface DemoStore extends DemoState {
  // Sesión del login mock. usuarioActivo = null => sin sesión (muestra login).
  usuarioActivo: UsuarioDemo | null
  rolActivo: RolDemo
  iniciarSesion: (usuario: UsuarioDemo) => void
  cerrarSesion: () => void
  // Administración: cambia el rol de un usuario. Si es el usuario en sesión,
  // actualiza también rolActivo en vivo.
  cambiarRolUsuario: (usuarioId: string, rol: RolDemo) => void
  toggleUsuarioActivo: (usuarioId: string) => void
  invitarUsuario: (datos: Omit<UsuarioDemo, 'id' | 'activo'>) => void
  actualizarConfig: (cambios: Partial<ConfigNegocio>) => void
  setRol: (rol: RolDemo) => void
  reiniciarDemo: () => void
  // Mutador transaccional: recibe el estado actual y devuelve el siguiente.
  // Los adapters lo usan para escribir sin acoplarse a la forma del store.
  mutate: (fn: (state: DemoState) => Partial<DemoState>) => void
}

export const useDemoStore = create<DemoStore>((set) => ({
  ...buildSeed(),
  usuarioActivo: null,
  rolActivo: 'DUENO',
  iniciarSesion: (usuario) => set({ usuarioActivo: usuario, rolActivo: usuario.rol }),
  cerrarSesion: () => set({ usuarioActivo: null }),
  cambiarRolUsuario: (usuarioId, rol) =>
    set((state) => {
      const usuarios = state.usuarios.map((u) => (u.id === usuarioId ? { ...u, rol } : u))
      const esActivo = state.usuarioActivo?.id === usuarioId
      const obj = state.usuarios.find((u) => u.id === usuarioId)
      return {
        usuarios,
        usuarioActivo: esActivo ? { ...state.usuarioActivo!, rol } : state.usuarioActivo,
        rolActivo: esActivo ? rol : state.rolActivo,
        acciones: [accion(state, 'Cambió rol', obj?.nombre ?? 'usuario'), ...state.acciones],
      }
    }),
  toggleUsuarioActivo: (usuarioId) =>
    set((state) => {
      const obj = state.usuarios.find((u) => u.id === usuarioId)
      return {
        usuarios: state.usuarios.map((u) => (u.id === usuarioId ? { ...u, activo: !u.activo } : u)),
        acciones: [
          accion(state, obj?.activo ? 'Desactivó usuario' : 'Activó usuario', obj?.nombre ?? 'usuario'),
          ...state.acciones,
        ],
      }
    }),
  invitarUsuario: (datos) =>
    set((state) => ({
      usuarios: [
        ...state.usuarios,
        { ...datos, id: `u-${Date.now().toString(36)}`, activo: true },
      ],
      acciones: [accion(state, 'Invitó usuario', datos.nombre), ...state.acciones],
    })),
  actualizarConfig: (cambios) =>
    set((state) => ({ configNegocio: { ...state.configNegocio, ...cambios } })),
  setRol: (rol) => set({ rolActivo: rol }),
  reiniciarDemo: () => set({ ...buildSeed(), usuarioActivo: null, rolActivo: 'DUENO' }),
  mutate: (fn) => set((state) => fn(state)),
}))

// Acceso imperativo (para adapters / lógica fuera de React).
export const getDemoState = (): DemoState => useDemoStore.getState()
export const getUsuarioActivo = (): UsuarioDemo | null => useDemoStore.getState().usuarioActivo
export const mutateDemo = (fn: (state: DemoState) => Partial<DemoState>) =>
  useDemoStore.getState().mutate(fn)
