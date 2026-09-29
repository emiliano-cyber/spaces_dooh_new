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
import { ROLES_ASIGNABLES } from '@/lib/roles'
import { rechazoDeNombrarDueno } from '@/lib/guardas-usuarios'
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  borrarUsuario,
  emailExiste,
  cerrarSesionesDeUsuario,
  CambioDeUsuarioProhibido,
} from './usuarios-repo'

// ============================================================================
//  lib/server/usuarios-controller.ts — Capa controller de usuarios.
//  Valida y sanea la entrada (zod), aplica reglas de negocio y llama al model
//  (usuarios-repo). No conoce HTTP: lanza AppError, la ruta lo mapea.
// ============================================================================

// Los roles que la API acepta al dar de alta o al cambiar el de alguien. Salen
// de la lista canónica (`lib/roles.ts`) y NO de una copia escrita aquí: ésta era
// una de las cuatro listas de roles que podían divergir, y divergir significa
// que el desplegable ofrezca un rol que la API rechaza, o al revés.
//
// Quedan fuera dos valores que el enum `rol_demo` SÍ admite:
//
//  · 'CLIENTE', desde el ADR 0010. `rol_permisos` no tiene ni una fila suya y
//    `tienePermiso` es fail-closed, así que un usuario CLIENTE entraba y recibía
//    403 en todo, incluido el dashboard. Se podía crear, no servía para nada, y
//    nada avisaba. El cliente externo no necesita cuenta: su portal
//    (`/portal/[token]` y `/p/[id]`) es público por token.
//  · 'COMERCIAL', desde el ADR 0040, y por exactamente el mismo motivo: la
//    migración del 29/09 le quitó sus cinco filas. Los tres roles de venta lo
//    cubren.
//
// Quitar un valor de un enum de Postgres exige recrear el tipo entero, así que
// los dos siguen en la base. Lo que se cierra es la puerta de creación.
const ROLES = ROLES_ASIGNABLES.map((r) => r.value) as [string, ...string[]]

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

// El ALTA recibe el actor por lo mismo que el PATCH: el guard 3 del ADR 0040
// —«nadie nombra a un Dueño salvo un Dueño»— tiene que cubrir las DOS puertas.
// Prohibir el cambio de rol y dejar que se pueda dar de alta a alguien ya como
// Dueño sería la misma puerta con otro nombre.
//
// ⚠️ EL ARRANQUE NO PASA POR AQUÍ, y es deliberado: `crearOrgConDueno`
// (`cuentas-controller.ts`) llama al repo directamente, porque cuando nace la
// primera organización no hay ningún Dueño que pueda autorizar nada. La exención
// es una separación de caminos y no una bandera, y la fija
// `lib/arranque-sin-guard.test.ts`.
export async function crearUsuarioCtrl(body: unknown, actor: Actor) {
  const d = validar(crearSchema, body)

  const nombrar = rechazoDeNombrarDueno(actor.rol, d.rol)
  if (nombrar) throw new AppError(nombrar.mensaje, nombrar.status)

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

// El ACTOR entra entero —id y rol— y no solo su id. El rol lo necesitan los dos
// guards del ADR 0040, y viene de la SESIÓN del servidor: si entrara por el
// cuerpo, cualquiera se declararía Dueño para saltarse el guard del
// administrador, que es exactamente el tipo de agujero que este repo ya cerró
// con el `usuarioId` de las propuestas.
export interface Actor {
  id: string
  rol: string
}

// El repo no conoce HTTP y lanza su propio error con el status que decidió la
// regla pura; aquí se traduce a `AppError`, que es lo que `respuestaError` sabe
// mapear. Vive en una función y no repetido en tres `catch` porque los tres
// caminos de escritura tienen que contestar lo mismo: si uno devolviera un 500,
// la interfaz enseñaría «error del servidor» donde hay una regla con nombre.
function comoAppError(e: unknown): never {
  if (e instanceof CambioDeUsuarioProhibido) throw new AppError(e.message, e.status)
  throw e
}

export async function actualizarUsuarioCtrl(id: string, actor: Actor, body: unknown) {
  // No te puedes modificar a ti mismo (evita auto-bloqueo de rol/activo, y el
  // cambio de contraseña propio va por /api/perfil con la contraseña actual).
  if (id === actor.id) throw new AppError('No puedes modificar tu propio usuario. Cambia tu contraseña en Configuración.', 400)
  const d = validar(actualizarSchema, body)
  const u = await actualizarUsuario(id, d, actor.rol).catch(comoAppError)
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
export async function restablecerPasswordCtrl(id: string, actor: Actor) {
  if (id === actor.id) {
    throw new AppError('Para cambiar tu propia contraseña usa Configuración.', 400)
  }
  const temporal = generarPasswordTemporal()
  // Pasa por el mismo camino guardado que el PATCH aunque aquí los guards nunca
  // salten —un restablecimiento no cambia el rol ni el estado—: tener DOS
  // caminos de escritura sobre `usuarios` es exactamente como se cuela mañana
  // uno que sí los cambie sin pasar por el guard.
  const u = await actualizarUsuario(id, {
    passwordHash: await hashPassword(temporal),
    debeCambiarPassword: true,
  }, actor.rol).catch(comoAppError)
  if (!u) throw new AppError('No encontrado', 404)
  await cerrarSesionesDeUsuario(id)
  return { usuario: u, temporal }
}

export async function borrarUsuarioCtrl(id: string, actor: Actor) {
  if (id === actor.id) throw new AppError('No puedes eliminar tu propio usuario', 400)
  // 404 —no 403— cuando el usuario es de otro tenant: un 403 confirmaría que ese
  // id existe en otra organización.
  if (!(await borrarUsuario(id, actor.rol).catch(comoAppError))) {
    throw new AppError('No encontrado', 404)
  }
}
