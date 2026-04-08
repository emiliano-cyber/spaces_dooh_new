import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

function makePool(): pg.Pool {
  const url = new URL(process.env.DATABASE_URL!)
  return new pg.Pool({ connectionString: url.toString() })
}

function makePrisma(schema: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(makePool(), { schema }),
  } as any)
}

// ─── public schema singleton (lazy) ──────────────────────────────────────────

let _publicPrisma: PrismaClient | null = null

function getPublicPrisma(): PrismaClient {
  if (!_publicPrisma) _publicPrisma = makePrisma('public')
  return _publicPrisma
}

export const publicPrisma = new Proxy({} as PrismaClient, {
  get(_, prop, receiver) {
    const client = getPublicPrisma()
    const val = Reflect.get(client, prop, receiver)
    return typeof val === 'function' ? (val as Function).bind(client) : val
  },
})

// ─── per-tenant cache (lazy) ──────────────────────────────────────────────────

const tenantClients = new Map<string, PrismaClient>()

export function getPrismaForTenant(dbSchema: string): PrismaClient {
  const cached = tenantClients.get(dbSchema)
  if (cached) return cached
  const client = makePrisma(dbSchema)
  tenantClients.set(dbSchema, client)
  return client
}

export async function disconnectAll(): Promise<void> {
  if (_publicPrisma) await _publicPrisma.$disconnect()
  await Promise.all([...tenantClients.values()].map((c) => c.$disconnect()))
  tenantClients.clear()
  _publicPrisma = null
}
