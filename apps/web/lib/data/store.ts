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
import type { DemoState, RolDemo, UsuarioDemo } from './types'
import { buildSeed } from './seed'

export interface DemoStore extends DemoState {
  // Sesión del login mock. usuarioActivo = null => sin sesión (muestra login).
  usuarioActivo: UsuarioDemo | null
  rolActivo: RolDemo
  iniciarSesion: (usuario: UsuarioDemo) => void
  cerrarSesion: () => void
  // Administración: cambia el rol de un usuario. Si es el usuario en sesión,
  // actualiza también rolActivo en vivo.
  cambiarRolUsuario: (usuarioId: string, rol: RolDemo) => void
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
      return {
        usuarios,
        usuarioActivo: esActivo ? { ...state.usuarioActivo!, rol } : state.usuarioActivo,
        rolActivo: esActivo ? rol : state.rolActivo,
      }
    }),
  setRol: (rol) => set({ rolActivo: rol }),
  reiniciarDemo: () => set({ ...buildSeed(), usuarioActivo: null, rolActivo: 'DUENO' }),
  mutate: (fn) => set((state) => fn(state)),
}))

// Acceso imperativo (para adapters / lógica fuera de React).
export const getDemoState = (): DemoState => useDemoStore.getState()
export const mutateDemo = (fn: (state: DemoState) => Partial<DemoState>) =>
  useDemoStore.getState().mutate(fn)
