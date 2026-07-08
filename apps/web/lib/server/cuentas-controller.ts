import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { validarPassword } from './auth'
import { esEmailValido } from '@/lib/validacion'
import { crearTenant } from './tenant'
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
    password: z.string(),
    cargo: z.string().trim().optional(),
  }),
})

async function crearOrgConDueno(args: {
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
  const tenant = await crearTenant(args.org, args.slug ?? args.org)
  const usuario = await crearUsuario({
    nombre: args.nombre,
    email: args.email,
    cargo: args.cargo ?? 'Dueño',
    rol: 'DUENO',
    password: args.password,
    tenantId: tenant.id,
  })
  return { tenant, usuario }
}

// Auto-registro público (body plano).
export async function registrarCuentaCtrl(body: unknown) {
  const d = validar(signupSchema, body)
  return crearOrgConDueno({ org: d.organizacion, nombre: d.nombre, email: d.email, password: d.password })
}

// Alta de CRM por super-admin (nombre/slug + objeto admin).
export async function crearOrganizacionCtrl(body: unknown) {
  const d = validar(orgSchema, body)
  return crearOrgConDueno({
    org: d.nombre,
    slug: d.slug,
    nombre: d.admin.nombre,
    email: d.admin.email,
    password: d.admin.password,
    cargo: d.admin.cargo,
  })
}
