import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as authService from './auth.service'

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function setCookie(reply: FastifyReply, token: string, maxAge: number): void {
  reply.setCookie('spaces_rt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: process.env.COOKIE_DOMAIN,
    maxAge,
  })
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const loginRateLimit = process.env.NODE_ENV === 'production'
    ? { max: 5, timeWindow: '1 minute' }
    : { max: 100, timeWindow: '1 minute' }

  fastify.post('/auth/login', { config: { rateLimit: loginRateLimit } }, async (request, reply) => {
    const body = loginBody.parse(request.body)
    const result = await authService.login(body.email, body.password, request.tenant.id)
    setCookie(reply, result.refreshToken, 604800)
    return reply.send({ accessToken: result.accessToken, user: result.user })
  })

  fastify.post('/auth/refresh', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const cookie = request.cookies['spaces_rt']
    if (!cookie) return reply.code(401).send({ error: 'Unauthorized' })
    const result = await authService.refresh(cookie)
    setCookie(reply, result.refreshToken, 604800)
    return reply.send({ accessToken: result.accessToken })
  })

  fastify.post('/auth/logout', async (request, reply) => {
    const cookie = request.cookies['spaces_rt']
    if (cookie) await authService.logout(cookie)
    setCookie(reply, '', 0)
    return reply.code(200).send()
  })

  fastify.get('/auth/me', async (request) => {
    return request.user
  })
}

export default fp(authRoutes, { name: 'auth-routes' })
