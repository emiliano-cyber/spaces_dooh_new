import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { hashPassword, validarPassword } from './auth'
import { esEmailValido } from '@/lib/validacion'
import { emailExiste, actualizarPerfil } from './usuarios-repo'

// ============================================================================
//  lib/server/perfil-controller.ts — El usuario en sesión cambia su propio
//  correo y/o contraseña. Valida formato/unicidad de correo y política de
//  contraseña; hashea antes de tocar el model.
// ============================================================================

const perfilSchema = z.object({
  email: z.string().trim().optional(),
  password: z.string().optional(),
})

export async function actualizarPerfilCtrl(usuario: { id: string; email: string }, body: unknown) {
  const d = validar(perfilSchema, body)
  const cambios: { email?: string; passwordHash?: string } = {}

  const nuevoEmail = (d.email ?? '').trim()
  if (nuevoEmail && nuevoEmail.toLowerCase() !== usuario.email.toLowerCase()) {
    if (!esEmailValido(nuevoEmail)) throw new AppError('Correo inválido', 400)
    if (await emailExiste(nuevoEmail)) throw new AppError('Ese correo ya está en uso', 409)
    cambios.email = nuevoEmail
  }
  if (d.password) {
    const errPass = validarPassword(d.password)
    if (errPass) throw new AppError(errPass, 400)
    cambios.passwordHash = await hashPassword(d.password)
  }

  const hubo = await actualizarPerfil(usuario.id, cambios)
  if (!hubo) throw new AppError('No hay cambios que guardar', 400)
  return { ok: true }
}
