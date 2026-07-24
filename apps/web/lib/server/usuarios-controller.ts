import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { validarPassword, hashPassword } from './auth'
import { esEmailValido } from '@/lib/validacion'
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  borrarUsuario,
  emailExiste,
} from './usuarios-repo'

// ============================================================================
//  lib/server/usuarios-controller.ts — Capa controller de usuarios.
//  Valida y sanea la entrada (zod), aplica reglas de negocio y llama al model
//  (usuarios-repo). No conoce HTTP: lanza AppError, la ruta lo mapea.
// ============================================================================

const ROLES = ['DUENO', 'COMERCIAL', 'OPERACIONES', 'IMPRENTA', 'FINANZAS', 'CLIENTE'] as const

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().refine(esEmailValido, 'Correo inválido'),
  cargo: z.string().trim().optional(),
  rol: z.enum(ROLES).optional(),
  password: z.string(),
})

const actualizarSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    cargo: z.string().trim().optional(),
    rol: z.enum(ROLES).optional(),
    activo: z.boolean().optional(),
    // Reset de contraseña por el Dueño (para OTROS usuarios; el cambio propio va
    // por /api/perfil con la contraseña actual).
    password: z.string().optional(),
  })
  .strict()

export function listarUsuariosCtrl() {
  return listarUsuarios()
}

export async function crearUsuarioCtrl(body: unknown) {
  const d = validar(crearSchema, body)
  const errPass = validarPassword(d.password)
  if (errPass) throw new AppError(errPass, 400)
  if (await emailExiste(d.email)) throw new AppError('Ya existe un usuario con ese correo', 409)
  return crearUsuario(d)
}

export async function actualizarUsuarioCtrl(id: string, actorId: string, body: unknown) {
  // No te puedes modificar a ti mismo (evita auto-bloqueo de rol/activo, y el
  // reset de contraseña propio debe ir por /api/perfil con la contraseña actual).
  if (id === actorId) throw new AppError('No puedes modificar tu propio usuario. Cambia tu contraseña en Configuración.', 400)
  const d = validar(actualizarSchema, body)
  const { password, ...resto } = d
  const cambios: { nombre?: string; cargo?: string; rol?: string; activo?: boolean; passwordHash?: string } = { ...resto }
  if (password !== undefined) {
    const errPass = validarPassword(password)
    if (errPass) throw new AppError(errPass, 400)
    cambios.passwordHash = await hashPassword(password)
  }
  const u = await actualizarUsuario(id, cambios)
  if (!u) throw new AppError('No encontrado', 404)
  return u
}

export async function borrarUsuarioCtrl(id: string, actorId: string) {
  if (id === actorId) throw new AppError('No puedes eliminar tu propio usuario', 400)
  // 404 —no 403— cuando el usuario es de otro tenant: un 403 confirmaría que ese
  // id existe en otra organización.
  if (!(await borrarUsuario(id))) throw new AppError('No encontrado', 404)
}
