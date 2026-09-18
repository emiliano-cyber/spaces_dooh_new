import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { esRfcValido } from '@/lib/rfc'
import {
  crearEntidad,
  editarEntidad,
  desactivarEntidad,
  catalogoRolesEntidad,
} from './entidades-repo'

// ============================================================================
//  lib/server/entidades-controller.ts — Validación del alta y la edición de las
//  razones sociales PROPIAS del owner.
// ----------------------------------------------------------------------------
//  El repo parametriza el SQL y acota por `tenant_id`; aquí se valida la FORMA
//  de la entrada y se traducen los errores de la base a HTTP.
//
//  Por qué se valida aquí y no solo en la pantalla: la auditoría de caja negra
//  del 26/08 sobre el alta de clientes encontró tres huecos y los tres eran lo
//  mismo — la UI validaba y el servidor se fiaba de ella. Un `curl` se salta la
//  UI entera, y estos datos deciden a nombre de quién paga y factura el negocio.
// ============================================================================

// El CP fiscal son cinco dígitos y nada más. Se valida porque un CP con letras
// llega a la columna sin quejarse y reaparece dentro de un documento.
const cpSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'El codigo postal fiscal son cinco digitos')

const rolesSchema = z.array(z.string().trim().min(1, 'Un rol no puede venir vacio')).max(20)

const altaSchema = z.object({
  razonSocial: z.string().trim().min(1, 'La razon social es obligatoria').max(200),
  rfc: z.string().trim().max(13).nullish(),
  regimen: z.string().trim().max(120).nullish(),
  cpFiscal: z.union([z.null(), z.literal(''), cpSchema]).optional(),
  serieFolios: z.string().trim().max(20).nullish(),
  roles: rolesSchema.optional(),
})

// Todos los campos opcionales para poder COMPLETAR uno solo sin tocar el resto:
// es el caso normal cuando la entidad se capturó a medias. `razonSocial` no
// puede quedar VACÍA si viene — una entidad fiscal sin nombre no es nada.
const parcheSchema = z.object({
  razonSocial: z.string().trim().min(1, 'La razon social no puede quedar vacia').max(200).optional(),
  rfc: z.string().trim().max(13).nullish(),
  regimen: z.string().trim().max(120).nullish(),
  cpFiscal: z.union([z.null(), z.literal(''), cpSchema]).optional(),
  serieFolios: z.string().trim().max(20).nullish(),
  roles: rolesSchema.optional(),
  // REACTIVAR. El DELETE da de baja lógica y hasta hoy no había vuelta: una
  // entidad apagada se quedaba apagada, y la única salida era capturar otra con
  // el mismo nombre — el duplicado que este módulo existe para evitar, porque
  // entonces nadie sabe cuál de las dos pagan los contratos.
  //
  // `z.boolean()` y no `z.coerce.boolean()`: la cadena `"false"` coaccionada es
  // VERDADERA, así que un cliente que mandara texto reactivaría creyendo que
  // apaga. Es el mismo motivo por el que el cuestionario de bienvenida usa
  // `z.boolean()` en sus preguntas de sí/no.
  activo: z.boolean().optional(),
})

// Los roles se comprueban contra el CATÁLOGO DE LA BASE, no contra una lista
// escrita aquí. Es lo que hace que añadir un rol sea un `insert` y no un
// despliegue; una constante en este archivo devolvería la lista al código y
// anularía el motivo de que `rol` sea texto y no un enum.
//
// Y el duplicado se caza aquí aunque la base ya lo impida con
// `unique (entidad_id, rol)`: por ahí llega como un 23505 sin mensaje útil, y
// quien captura necesita saber CUÁL repitió.
async function revisarRoles(roles: string[] | undefined): Promise<string[] | undefined> {
  if (!roles) return undefined
  const normalizados = roles.map((r) => r.trim().toUpperCase())
  const vistos = new Set<string>()
  for (const rol of normalizados) {
    if (vistos.has(rol)) throw new AppError(`El rol ${rol} viene repetido`, 400)
    vistos.add(rol)
  }
  const catalogo = await catalogoRolesEntidad()
  const fuera = normalizados.filter((r) => !catalogo.includes(r))
  if (fuera.length) {
    throw new AppError(
      `Estos roles no existen en el catalogo: ${fuera.join(', ')}. ` +
        `Los disponibles son: ${catalogo.join(', ')}.`,
      400,
    )
  }
  return normalizados
}

// `null` explícito limpia el campo; `undefined` lo deja como estaba. Sin esta
// distinción no se puede vaciar un dato a propósito, que es un fallo real que
// este repositorio ya cerró en los arrendadores.
const vacioEsNulo = (v: string | null | undefined) => (v === undefined ? undefined : v || null)

// Traduce el último cerrojo de la base. Si un choque de unicidad llegara hasta
// aquí significa que dos peticiones simultáneas pidieron el mismo rol: no es un
// error del servidor, es un conflicto.
function traducirChoque(e: unknown): never {
  if ((e as { code?: string })?.code === '23505') {
    throw new AppError('Esa entidad ya tiene ese rol asignado.', 409)
  }
  if ((e as { code?: string })?.code === '23503') {
    throw new AppError('Ese rol no existe en el catalogo.', 400)
  }
  throw e
}

export async function crearEntidadCtrl(body: unknown) {
  const d = validar(altaSchema, body)
  if (d.rfc && !esRfcValido(d.rfc)) throw new AppError('RFC inválido', 400)
  const roles = await revisarRoles(d.roles)
  try {
    return await crearEntidad({
      razonSocial: d.razonSocial,
      rfc: vacioEsNulo(d.rfc),
      regimen: vacioEsNulo(d.regimen),
      cpFiscal: vacioEsNulo(d.cpFiscal),
      serieFolios: vacioEsNulo(d.serieFolios),
      roles,
    })
  } catch (e) {
    traducirChoque(e)
  }
}

export async function editarEntidadCtrl(id: string, body: unknown) {
  const d = validar(parcheSchema, body)
  if (d.rfc && !esRfcValido(d.rfc)) throw new AppError('RFC inválido', 400)
  const roles = await revisarRoles(d.roles)
  let entidad
  try {
    entidad = await editarEntidad(id, {
      razonSocial: d.razonSocial,
      rfc: vacioEsNulo(d.rfc),
      regimen: vacioEsNulo(d.regimen),
      cpFiscal: vacioEsNulo(d.cpFiscal),
      serieFolios: vacioEsNulo(d.serieFolios),
      roles,
      activo: d.activo,
    })
  } catch (e) {
    traducirChoque(e)
  }
  // Una entidad de otra organización llega aquí como `null`, igual que una que
  // no existe. Desde fuera tienen que ser indistinguibles: un 403 confirmaría
  // que ese id existe en alguna parte.
  if (!entidad) throw new AppError('No encontrada', 404)
  return entidad
}

export async function desactivarEntidadCtrl(id: string) {
  if (!(await desactivarEntidad(id))) throw new AppError('No encontrada', 404)
}
