import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { hashPassword, validarPassword, verifyPassword } from './auth'
import { esEmailValido } from '@/lib/validacion'
import { emailExiste, actualizarPerfil, passwordHashDe } from './usuarios-repo'

// ============================================================================
//  lib/server/perfil-controller.ts — El usuario en sesión cambia su propio
//  correo y/o contraseña. Valida formato/unicidad de correo y política de
//  contraseña; hashea antes de tocar el model.
//
//  Re-autenticación (Hardening 1 · Bloque E): cambiar correo o contraseña exige
//  la CONTRASEÑA ACTUAL, verificada server-side con bcrypt. Sin esto, una sesión
//  robada (o una pestaña abierta) podía apropiarse de la cuenta cambiando el
//  correo/clave sin conocer la contraseña vigente.
// ============================================================================

const perfilSchema = z.object({
  email: z.string().trim().optional(),
  password: z.string().optional(),
  passwordActual: z.string().optional(),
})

export async function actualizarPerfilCtrl(usuario: { id: string; email: string }, body: unknown) {
  const d = validar(perfilSchema, body)
  const cambios: { email?: string; passwordHash?: string } = {}

  const nuevoEmail = (d.email ?? '').trim()
  const cambiaEmail = !!nuevoEmail && nuevoEmail.toLowerCase() !== usuario.email.toLowerCase()
  const cambiaPassword = !!d.password

  if (!cambiaEmail && !cambiaPassword) throw new AppError('No hay cambios que guardar', 400)

  // Puerta de re-autenticación: exigir y verificar la contraseña actual ANTES de
  // tocar nada. 401 (no 400/403): es un fallo de credencial, no de forma.
  if (!d.passwordActual) {
    throw new AppError('Debes ingresar tu contraseña actual para confirmar el cambio', 401)
  }
  const hashActual = await passwordHashDe(usuario.id)
  if (!(await verifyPassword(d.passwordActual, hashActual))) {
    throw new AppError('La contraseña actual no es correcta', 401)
  }

  if (cambiaEmail) {
    if (!esEmailValido(nuevoEmail)) throw new AppError('Correo inválido', 400)
    if (await emailExiste(nuevoEmail)) throw new AppError('Ese correo ya está en uso', 409)
    cambios.email = nuevoEmail
  }
  if (cambiaPassword) {
    const errPass = validarPassword(d.password)
    if (errPass) throw new AppError(errPass, 400)
    cambios.passwordHash = await hashPassword(d.password as string)
  }

  const hubo = await actualizarPerfil(usuario.id, cambios)
  if (!hubo) throw new AppError('No hay cambios que guardar', 400)
  return { ok: true }
}
