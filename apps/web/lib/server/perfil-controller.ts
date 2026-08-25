import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { hashPassword, validarPassword, verifyPassword } from './auth'
import { esEmailValido } from '@/lib/validacion'
import {
  emailExiste,
  actualizarPerfil,
  passwordHashDe,
  tieneIdentidadVinculada,
} from './usuarios-repo'

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

// ADR 0018 — la ÚNICA excepción a la puerta de reautenticación.
//
// Sin ella hay un punto muerto real, medido en el PADRE el 2026-08-25: el alta
// crea al Dueño con `debe_cambiar_password` puesto y una contraseña temporal que
// se imprime UNA vez; si entra con Google y esa temporal se perdió, el
// formulario le pide algo que nadie tiene, y `exigir()` le cierra el resto.
//
// Las CUATRO condiciones van juntas, y cada una tapa un abuso distinto:
//
//   · `debeCambiarPassword` — la excepción es de UN SOLO USO por cuenta. En
//     cuanto pone la suya, deja de aplicar para siempre.
//   · `metodoSesion === 'google'` — no basta con poder usar Google: tiene que
//     haber entrado por ahí EN ESTA sesión.
//   · identidad vinculada — defensa en profundidad. Hoy la implica la anterior,
//     pero no queremos que una tercera vía de entrada futura herede la
//     excepción por descuido.
//   · `!cambiaEmail` — poner tu primera contraseña, no apropiarte de la cuenta.
//     Con el correo abierto, una sesión robada se quedaría con la cuenta entera,
//     que es justo el ataque que esta puerta cierra.
async function puedeFijarSinAnterior(
  usuario: ContextoPerfil,
  cambiaPassword: boolean,
  cambiaEmail: boolean,
): Promise<boolean> {
  if (!cambiaPassword || cambiaEmail) return false
  if (!usuario.debeCambiarPassword) return false
  if (usuario.metodoSesion !== 'google') return false
  return tieneIdentidadVinculada(usuario.id, 'google')
}

export type ContextoPerfil = {
  id: string
  email: string
  debeCambiarPassword: boolean
  metodoSesion: 'password' | 'google'
}

export async function actualizarPerfilCtrl(usuario: ContextoPerfil, body: unknown) {
  const d = validar(perfilSchema, body)
  const cambios: { email?: string; passwordHash?: string } = {}

  const nuevoEmail = (d.email ?? '').trim()
  const cambiaEmail = !!nuevoEmail && nuevoEmail.toLowerCase() !== usuario.email.toLowerCase()
  const cambiaPassword = !!d.password

  if (!cambiaEmail && !cambiaPassword) throw new AppError('No hay cambios que guardar', 400)

  // Puerta de re-autenticación: exigir y verificar la contraseña actual ANTES de
  // tocar nada. 401 (no 400/403): es un fallo de credencial, no de forma.
  //
  // La excepción del ADR 0018 se evalúa aquí y no antes: así el camino normal
  // queda intacto y la excepción es visiblemente lo que es, un desvío acotado.
  if (!(await puedeFijarSinAnterior(usuario, cambiaPassword, cambiaEmail))) {
    if (!d.passwordActual) {
      throw new AppError('Debes ingresar tu contraseña actual para confirmar el cambio', 401)
    }
    const hashActual = await passwordHashDe(usuario.id)
    if (!(await verifyPassword(d.passwordActual, hashActual))) {
      throw new AppError('La contraseña actual no es correcta', 401)
    }
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
