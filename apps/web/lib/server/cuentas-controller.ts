import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { validarPassword, passwordDeAlta } from './auth'
import { googleHabilitado } from './google-oauth'
import { esEmailValido } from '@/lib/validacion'
import { crearTenant } from './tenant'
import { withTxBootstrap } from './db'
import { crearUsuario, emailExiste } from './usuarios-repo'

// ============================================================================
//  lib/server/cuentas-controller.ts — Alta de organizaciones (CRM) + su Dueño.
//  Lo comparten el auto-registro público (signup) y la creación por super-admin
//  (tenants). Valida org/admin/contraseña, verifica correo y crea tenant+usuario.
// ============================================================================

const signupSchema = z.object({
  organizacion: z.string().trim().min(1, 'La organización es requerida'),
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().refine(esEmailValido, 'Correo inválido'),
  password: z.string(),
})

const orgSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre de la organización'),
  slug: z.string().trim().optional(),
  admin: z.object({
    nombre: z.string().trim().min(1, 'Falta el nombre del administrador'),
    email: z.string().trim().refine(esEmailValido, 'Correo inválido'),
    // Opcional desde el ADR 0012: con `entraConGoogle` no se manda ninguna.
    password: z.string().optional(),
    entraConGoogle: z.boolean().optional(),
    cargo: z.string().trim().optional(),
  }),
})

// Exportada desde el ADR 0012: el alta de empresa con Google la reutiliza en
// vez de reimplementar la creación. Es la MISMA función que usa `/api/signup` y
// el alta de CRM del super-admin, así que las tres crean organizaciones
// idénticas — con su Dueño, su rol y sus comprobaciones de correo repetido.
// Duplicarla habría sido la forma segura de que las tres divergieran.
export async function crearOrgConDueno(args: {
  org: string
  slug?: string
  nombre: string
  email: string
  password: string
  cargo?: string
}) {
  const errPass = validarPassword(args.password)
  if (errPass) throw new AppError(errPass, 400)
  if (await emailExiste(args.email)) throw new AppError('Ese correo ya está registrado', 409)
  // F5.1 — LOS DOS INSERT EN UNA SOLA TRANSACCIÓN.
  //
  // Antes eran dos llamadas sueltas, y si la segunda fallaba el tenant
  // sobrevivía: quedaba una organización sin nadie dentro, que nadie podía
  // administrar y que ocupaba su slug para siempre.
  //
  // `fijarTenant` va EN MEDIO, y ese es el punto: la transacción empieza sin
  // tenant —todavía no existe— y el GUC se fija en cuanto el id aparece, justo
  // antes del INSERT de `usuarios`, que es fail-closed y lo necesita.
  //
  // La forma de retorno NO cambia (`{ tenant, usuario }`): devolver la URL está
  // descartado (§4, T5 del plan).
  return withTxBootstrap(async ({ client, fijarTenant }) => {
    const tenant = await crearTenant(args.org, args.slug ?? args.org, client)
    await fijarTenant(tenant.id)
    const usuario = await crearUsuario(
      {
        nombre: args.nombre,
        email: args.email,
        cargo: args.cargo ?? 'Dueño',
        rol: 'DUENO',
        password: args.password,
        tenantId: tenant.id,
      },
      client,
    )
    return { tenant, usuario }
  })
}

// Auto-registro público (body plano).
export async function registrarCuentaCtrl(body: unknown) {
  const d = validar(signupSchema, body)
  return crearOrgConDueno({ org: d.organizacion, nombre: d.nombre, email: d.email, password: d.password })
}

// Alta de CRM por super-admin (nombre/slug + objeto admin).
export async function crearOrganizacionCtrl(body: unknown) {
  const d = validar(orgSchema, body)
  // El Dueño de la organización nueva puede nacer entrando con Google, igual
  // que un usuario suelto (ADR 0012, enmienda E1). Misma resolución para las
  // dos altas, para que no diverjan.
  const r = passwordDeAlta({
    entraConGoogle: d.admin.entraConGoogle,
    password: d.admin.password,
    googleDisponible: googleHabilitado(),
  })
  if ('error' in r) throw new AppError(r.error, 400)

  return crearOrgConDueno({
    org: d.nombre,
    slug: d.slug,
    nombre: d.admin.nombre,
    email: d.admin.email,
    password: r.password,
    cargo: d.admin.cargo,
  })
}
