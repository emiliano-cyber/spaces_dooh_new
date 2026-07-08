import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { validarPassword } from './auth'
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
  // No te puedes modificar a ti mismo (evita auto-bloqueo de rol/activo).
  if (id === actorId) throw new AppError('No puedes modificar tu propio usuario', 400)
  const d = validar(actualizarSchema, body)
  const u = await actualizarUsuario(id, d)
  if (!u) throw new AppError('No encontrado', 404)
  return u
}

export async function borrarUsuarioCtrl(id: string, actorId: string) {
  if (id === actorId) throw new AppError('No puedes eliminar tu propio usuario', 400)
  await borrarUsuario(id)
}
