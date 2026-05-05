/**
 * Agrega usuarios específicos a un tenant existente.
 *
 * Usage (desde la raíz del proyecto):
 *   DATABASE_URL="postgresql://postgres:password@localhost:5432/spaces" \
 *     npx ts-node apps/api/prisma/seeds/seed-add-users.ts
 *
 * Opcional: --slug=dev  para apuntar a un tenant específico (por subdominioBase)
 * Si no se pasa --slug, usa el primer tenant encontrado.
 */
import 'dotenv/config'
import * as bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.+)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

const USERS_TO_CREATE = [
  {
    nombre: 'Luis Garcia',
    email: 'luis@h3dm.com.mx',
    password: 'Luis.123',
    rolId: 'admin',
  },
  {
    nombre: 'Fernando Venegas',
    email: 'fer@h3dm.com.mx',
    password: 'Fer.123',
    rolId: 'field_worker',
  },
]

async function main() {
  const args = parseArgs()

  // Strip ?schema= from URL if present — we always write to public schema
  const dbUrl = (process.env.DATABASE_URL ?? '').replace(/\?.*$/, '')
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL no definida')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: dbUrl })
  const publicClient = new PrismaClient({
    adapter: new PrismaPg(pool, { schema: 'public' }) as any,
  } as any) as any

  // Encontrar el tenant
  const tenantWhere = args['slug']
    ? { subdominioBase: args['slug'] }
    : undefined

  const tenant = tenantWhere
    ? await publicClient.tenant.findFirst({ where: tenantWhere })
    : await publicClient.tenant.findFirst()

  if (!tenant) {
    console.error('ERROR: No se encontró ningún tenant. Ejecuta seed-tenant.ts primero.')
    process.exit(1)
  }

  console.log(`\n→ Tenant: ${tenant.nombre} (${tenant.subdominioBase})\n`)

  for (const u of USERS_TO_CREATE) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await publicClient.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      create: {
        tenantId: tenant.id,
        nombre: u.nombre,
        email: u.email,
        passwordHash,
        rolId: u.rolId,
        activo: true,
      },
      update: {
        nombre: u.nombre,
        passwordHash,
        rolId: u.rolId,
        activo: true,
      },
    })
    console.log(`  ✓ ${u.nombre} <${u.email}>  rol: ${u.rolId}`)
  }

  console.log('\n' + '─'.repeat(48))
  console.log('  Credenciales de acceso:')
  console.log('─'.repeat(48))
  for (const u of USERS_TO_CREATE) {
    console.log(`  ${u.nombre.padEnd(20)}  ${u.email}  /  ${u.password}`)
  }
  console.log('─'.repeat(48) + '\n')

  await publicClient.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
