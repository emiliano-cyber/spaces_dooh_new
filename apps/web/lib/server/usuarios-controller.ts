import 'server-only'
import { z } from 'zod'
// El generador vive en un modulo aparte porque lo comparte con el alta de una
// instancia (`apps/web/scripts/bootstrap-auth.mjs`), que es un script suelto:
// dos copias del generador de contrasenas pueden divergir sin dar error.
import { generarPasswordTemporal } from '../password-temporal.mjs'
import { AppError, validar } from './errores'
import { validarPassword, hashPassword, passwordDeAlta } from './auth'
import { googleHabilitado } from './google-oauth'
import { esEmailValido } from '@/lib/validacion'
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  borrarUsuario,
  emailExiste,
  cerrarSesionesDeUsuario,
} from './usuarios-repo'

// ============================================================================
//  lib/server/usuarios-controller.ts — Capa controller de usuarios.
//  Valida y sanea la entrada (zod), aplica reglas de negocio y llama al model
//  (usuarios-repo). No conoce HTTP: lanza AppError, la ruta lo mapea.
// ============================================================================

// ADR 0010: 'CLIENTE' se retiró. El tipo `rol_demo` de la base todavía lo
// admite (quitar un valor de un enum de Postgres exige recrear el tipo, y no
// vale la pena), pero la API deja de aceptarlo: `rol_permisos` no tiene NI UNA
// fila para ese rol y `tienePermiso` es fail-closed, así que un usuario CLIENTE
// entraba y recibía 403 en todo, incluido el dashboard. Se podía crear, no
// servía para nada, y nada avisaba.
//
// El cliente externo NO necesita cuenta: su portal (`/portal/[token]` y
// `/p/[id]`) es público por token, exento en el middleware. Si algún día hace
// falta un login externo de verdad, será su propio ADR con su propio modelo —
// no este rol vacío heredado.
const ROLES = ['DUENO', 'COMERCIAL', 'OPERACIONES', 'IMPRENTA', 'FINANZAS'] as const

const crearSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().refine(esEmailValido, 'Correo inválido'),
  cargo: z.string().trim().optional(),
  rol: z.enum(ROLES).optional(),
  // Opcional desde el ADR 0012: con `entraConGoogle` no se manda ninguna.
  password: z.string().optional(),
  // El alta no comunica ninguna contraseña: la persona entra con su cuenta de
  // Google. Quita la fricción de inventar una y pasársela por chat.
  entraConGoogle: z.boolean().optional(),
})

// `.strict()` importa aquí: al retirar `password` del esquema, un cliente viejo
// que siga mandándolo recibe un 400 en vez de que el campo se ignore en
// silencio. Un reset que "parece funcionar" pero no cambia nada es peor que un
// error, porque el administrador cree que dejó a alguien fuera y no lo dejó.
const actualizarSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    cargo: z.string().trim().optional(),
    rol: z.enum(ROLES).optional(),
    activo: z.boolean().optional(),
    // `password` NO está aquí a propósito (ADR 0009). Fijar a mano la contraseña
    // de otro es impersonación: el actor entra como esa persona y todo lo que
    // haga queda registrado a nombre de ella. El restablecimiento va por
    // POST /api/usuarios/:id/restablecer, que exige reautenticación, genera una
    // temporal de un solo uso y corta las sesiones del afectado.
  })
  .strict()

export function listarUsuariosCtrl() {
  return listarUsuarios()
}

export async function crearUsuarioCtrl(body: unknown) {
  const d = validar(crearSchema, body)

  const r = passwordDeAlta({
    entraConGoogle: d.entraConGoogle,
    password: d.password,
    googleDisponible: googleHabilitado(),
  })
  if ('error' in r) throw new AppError(r.error, 400)
  const password = r.password

  if (await emailExiste(d.email)) throw new AppError('Ya existe un usuario con ese correo', 409)
  // Se pasa la contraseña resuelta y NO `d`: mandar el objeto entero colaría
  // `entraConGoogle` hasta el repo, que no sabe qué hacer con él.
  return crearUsuario({
    nombre: d.nombre,
    email: d.email,
    cargo: d.cargo,
    rol: d.rol,
    password,
  })
}

export async function actualizarUsuarioCtrl(id: string, actorId: string, body: unknown) {
  // No te puedes modificar a ti mismo (evita auto-bloqueo de rol/activo, y el
  // cambio de contraseña propio va por /api/perfil con la contraseña actual).
  if (id === actorId) throw new AppError('No puedes modificar tu propio usuario. Cambia tu contraseña en Configuración.', 400)
  const d = validar(actualizarSchema, body)
  const u = await actualizarUsuario(id, d)
  if (!u) throw new AppError('No encontrado', 404)
  return u
}

// Restablece la contraseña de OTRO usuario (ADR 0009).
//
// Devuelve la temporal EN CLARO una sola vez, para que quien la ejecuta se la
// entregue a la persona por el canal que sea. Es deuda reconocida: cuando haya
// correo saliente (`RESEND_API_KEY` + `EMAIL_FROM`, hoy vacías en producción)
// esto se sustituye por una liga de un solo uso y el administrador deja de ver
// ningún secreto. La forma de la función está pensada para que ese cambio toque
// solo la ENTREGA, no quién puede pedirlo ni qué se invalida.
//
// Tres cosas pasan a la vez, y las tres importan:
//   · la temporal queda marcada para cambio obligatorio, así que el
//     administrador no conserva una contraseña utilizable de forma duradera;
//   · se cierran las sesiones vivas del afectado, porque si el motivo del
//     reset es que le robaron la cuenta, dejar la sesión abierta no arregla nada;
//   · el afectado NOTA que se le cerró la sesión, que es la única señal de que
//     alguien tocó su acceso.
export async function restablecerPasswordCtrl(id: string, actorId: string) {
  if (id === actorId) {
    throw new AppError('Para cambiar tu propia contraseña usa Configuración.', 400)
  }
  const temporal = generarPasswordTemporal()
  const u = await actualizarUsuario(id, {
    passwordHash: await hashPassword(temporal),
    debeCambiarPassword: true,
  })
  if (!u) throw new AppError('No encontrado', 404)
  await cerrarSesionesDeUsuario(id)
  return { usuario: u, temporal }
}

export async function borrarUsuarioCtrl(id: string, actorId: string) {
  if (id === actorId) throw new AppError('No puedes eliminar tu propio usuario', 400)
  // 404 —no 403— cuando el usuario es de otro tenant: un 403 confirmaría que ese
  // id existe en otra organización.
  if (!(await borrarUsuario(id))) throw new AppError('No encontrado', 404)
}
