import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import {
  planDelCuestionario,
  faltaContestarCuestionario,
  resumenParaBitacora,
  LIMITE_RAZON_SOCIAL,
  type RolCatalogo,
  type EntidadConRoles,
} from '@/lib/cuestionario-entidades'
import {
  catalogoRolesConEtiqueta,
  contarEntidadesDelTenant,
  listarEntidadesConRoles,
  crearEntidadesDelCuestionario,
} from './bienvenida-repo'

// ============================================================================
//  lib/server/bienvenida-controller.ts — El cuestionario de bienvenida: valida
//  las respuestas, decide si se puede escribir, y materializa.
// ----------------------------------------------------------------------------
//  Por qué se valida aquí y no solo en la pantalla: la auditoría de caja negra
//  del 26/08 sobre el alta de clientes encontró tres huecos y los tres eran lo
//  mismo — la UI validaba y el servidor se fiaba de ella. Un `curl` se salta la
//  UI entera, y estas tres respuestas deciden a nombre de quién paga y factura
//  el negocio.
//
//  La traducción de las respuestas al conjunto de entidades NO está aquí: vive
//  en `lib/cuestionario-entidades.ts`, que es puro y sí se puede probar caso a
//  caso. Este archivo es el pegamento: forma de la entrada, permiso de
//  escritura, y traducción a HTTP.
// ============================================================================

// Un sí/no llega como booleano y nada más. `z.coerce.boolean()` convertiría la
// cadena "no" en `true`, que es el peor tipo de fallo: silencioso y con el
// sentido invertido. `nullish` porque «sin contestar» es un estado legítimo que
// el módulo puro distingue de «no».
const siNo = z.boolean().nullish()

const razonSocialSchema = z.string().trim().max(LIMITE_RAZON_SOCIAL)

const respuestasSchema = z.object({
  variasRazonesSociales: siNo,
  operacionYVentasJuntas: siNo,
  razonSocialUnica: razonSocialSchema.nullish(),
  // Las claves son roles y se comprueban contra el CATÁLOGO DE LA BASE, no
  // contra una lista escrita aquí: un `record` con claves libres es lo único
  // que deja que añadir un rol siga siendo un `insert` y no un despliegue.
  razonSocialPorRol: z.record(z.string(), razonSocialSchema.nullish()).nullish(),
})

export interface ResultadoCuestionario {
  entidades: EntidadConRoles[]
  /** El texto para `registrarAccion`: cuántas razones sociales y con qué roles. */
  resumen: string
}

export interface EstadoCuestionario {
  pendiente: boolean
  totalEntidades: number
  roles: RolCatalogo[]
  entidades: EntidadConRoles[]
}

const YA_CONTESTADO =
  'Tu organizacion ya tiene razones sociales registradas, asi que el cuestionario ya se ' +
  'contesto. Para cambiarlas, usa la pantalla de Administracion.'

/**
 * Qué hay que preguntar y si hace falta preguntarlo.
 *
 * `pendiente` se DERIVA del recuento: no hay columna en `tenants` ni en
 * `config_negocio`, y por tanto no hay migración ni un estado que pueda quedar
 * desincronizado del hecho que describe. Las entidades viajan también para que
 * quien VUELVA al cuestionario vea lo que ya contestó en vez de una pantalla
 * vacía.
 */
export async function estadoCuestionarioCtrl(): Promise<EstadoCuestionario> {
  const [total, roles, entidades] = await Promise.all([
    contarEntidadesDelTenant(),
    catalogoRolesConEtiqueta(),
    listarEntidadesConRoles(),
  ])
  return {
    pendiente: faltaContestarCuestionario(total),
    totalEntidades: total,
    roles,
    entidades,
  }
}

/**
 * Contesta el cuestionario y crea las razones sociales con sus roles.
 *
 * El orden importa y no es casual: primero la forma, luego «¿ya está
 * contestado?», luego el catálogo, y solo al final se escribe. Cualquier fallo
 * antes de la última línea deja la base exactamente como estaba.
 */
export async function contestarCuestionarioCtrl(body: unknown): Promise<ResultadoCuestionario> {
  const d = validar(respuestasSchema, body)

  // Se comprueba ANTES de traducir para que quien ya lo contestó reciba un 409
  // claro en vez de un 400 sobre una respuesta que da igual. El cerrojo de
  // verdad contra el duplicado está dentro de la transacción (ver el repo): esto
  // es la puerta de cortesía, no la cerradura.
  if (!faltaContestarCuestionario(await contarEntidadesDelTenant())) {
    throw new AppError(YA_CONTESTADO, 409)
  }

  // El catálogo se CONSULTA. Una constante aquí devolvería la lista de roles al
  // código y anularía el motivo de que `rol` sea texto con catálogo y no un
  // enum: que cambiarla sea un `insert` y no una migración con su despliegue.
  const catalogo = await catalogoRolesConEtiqueta()
  const plan = planDelCuestionario(d, catalogo.map((c) => c.rol))
  if (!plan.ok) throw new AppError(plan.error, 400)

  // UNA sola llamada con el plan completo: la atomicidad la da `withTenantTx`
  // dentro del repo. Repartirlo en una llamada por entidad es cómo se acaba con
  // media identidad fiscal escrita y el cuestionario ya «contestado».
  const alta = await crearEntidadesDelCuestionario(plan.entidades)
  if (!alta.ok) {
    // Perdió la carrera contra otra petición: la otra ya escribió. No es un
    // error del servidor, es un conflicto — y el resultado que el usuario
    // quería ya existe.
    throw new AppError(YA_CONTESTADO, 409)
  }

  return { entidades: alta.entidades, resumen: resumenParaBitacora(plan.entidades) }
}
