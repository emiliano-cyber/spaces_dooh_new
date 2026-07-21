import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requirePermission } from '../../core/auth/rbac.guard'
import * as service from './portal-cliente.service'

const IMAGEN_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Middleware: verify portal cliente token
async function getPortalCliente(request: any, reply: any) {
  const auth = request.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'No autenticado' })
  try {
    const ctx = await service.verifyPortalToken(auth.slice(7))
    request.portalCliente = ctx
  } catch {
    return reply.code(401).send({ error: 'Sesión inválida o expirada' })
  }
}

const portalClienteRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Auth pública ────────────────────────────────────────────────────────────
  fastify.post('/portal/cliente/login', async (request, reply) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(request.body)

    const result = await service.loginCliente(request.prisma, email, password, request.tenant.id)
    return reply.send(result)
  })

  // ── Sitios del cliente ──────────────────────────────────────────────────────
  fastify.get('/portal/cliente/sitios', { preHandler: getPortalCliente }, async (request: any) => {
    return service.getSitiosCliente(request.prisma, request.portalCliente.clienteId)
  })

  fastify.get('/portal/cliente/sitios/:id', { preHandler: getPortalCliente }, async (request: any) => {
    const { id } = request.params as { id: string }
    return service.getSitioDetalle(request.prisma, request.portalCliente.clienteId, id)
  })

  // ── OT detalle ──────────────────────────────────────────────────────────────
  fastify.get('/portal/cliente/ots/:id', { preHandler: getPortalCliente }, async (request: any) => {
    const { id } = request.params as { id: string }
    return service.getOTDetalle(request.prisma, request.portalCliente.clienteId, id)
  })

  // ── Comentarios desde cliente ───────────────────────────────────────────────
  fastify.post('/portal/cliente/ots/:id/comentarios', { preHandler: getPortalCliente }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const { texto, storageKey } = z.object({
      texto: z.string().min(1).max(2000),
      storageKey: z.string().optional(),
    }).parse(request.body)

    const comentario = await service.addComentarioCliente(
      request.prisma, request.portalCliente.clienteId, id, texto, storageKey,
    )
    return reply.code(201).send(comentario)
  })

  fastify.post('/portal/cliente/ots/:id/comentarios/foto-url', { preHandler: getPortalCliente }, async (request: any) => {
    const { id } = request.params as { id: string }
    const { filename, contentType } = request.body as { filename: string; contentType: string }
    if (!IMAGEN_TYPES.includes(contentType)) {
      throw Object.assign(new Error('Formato no permitido'), { statusCode: 400 })
    }
    return service.getUploadUrl(request.tenant.id, id, filename)
  })

  // ── Comentarios desde staff (técnico/admin) ─────────────────────────────────
  fastify.post('/ordenes-trabajo/:id/comentarios-publicos',
    { ...requirePermission('ots:read') },
    async (request: any, reply: any) => {
      const { id } = request.params as { id: string }
      const { texto, storageKey } = z.object({
        texto: z.string().min(1).max(2000),
        storageKey: z.string().optional(),
      }).parse(request.body)

      const comentario = await service.addComentarioTecnico(
        request.prisma, request.user.id, request.user.nombre ?? request.user.email, id, texto, storageKey,
      )
      return reply.code(201).send(comentario)
    },
  )

  fastify.get('/ordenes-trabajo/:id/comentarios-publicos',
    { ...requirePermission('ots:read') },
    async (request: any) => {
      const { id } = request.params as { id: string }
      return service.getComentarios(request.prisma, id)
    },
  )

  fastify.post('/ordenes-trabajo/:id/comentarios-publicos/foto-url',
    { ...requirePermission('ots:read') },
    async (request: any) => {
      const { id } = request.params as { id: string }
      const { filename, contentType } = request.body as { filename: string; contentType: string }
      if (!IMAGEN_TYPES.includes(contentType)) {
        throw Object.assign(new Error('Formato no permitido'), { statusCode: 400 })
      }
      return service.getUploadUrl(request.tenant.id, id, filename)
    },
  )

  // ── Admin: gestión de portal clientes ──────────────────────────────────────
  fastify.get('/portal-admin/clientes', { ...requirePermission('users:manage') }, async (request: any) => {
    return service.listPortalClientes(request.prisma)
  })

  fastify.post('/portal-admin/clientes', { ...requirePermission('users:manage') }, async (request: any, reply: any) => {
    const data = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      nombre: z.string().min(1),
    }).parse(request.body)
    const cliente = await service.createPortalCliente(request.prisma, data)
    return reply.code(201).send(cliente)
  })

  fastify.put('/portal-admin/clientes/:id/sitios', { ...requirePermission('users:manage') }, async (request: any) => {
    const { id } = request.params as { id: string }
    const { sitioIds } = z.object({ sitioIds: z.array(z.string()) }).parse(request.body)
    return service.asignarSitios(request.prisma, id, sitioIds)
  })

  fastify.patch('/portal-admin/clientes/:id', { ...requirePermission('users:manage') }, async (request: any) => {
    const { id } = request.params as { id: string }
    const { activo } = z.object({ activo: z.boolean() }).parse(request.body)
    return service.toggleActivoCliente(request.prisma, id, activo)
  })
}

export default fp(portalClienteRoutes, { name: 'portal-cliente-routes' })
