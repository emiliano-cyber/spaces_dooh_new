import 'dotenv/config'
import * as bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { BUILTIN_ROLES } from '@spaces-dooh/utils'

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.+)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

function randomPassword(length: number): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function slugify(nombre: string): string {
  return nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function main() {
  const args = parseArgs()
  const schema = args['schema']
  const nombre = args['nombre']
  const ownerEmail = args['ownerEmail']

  if (!schema || !nombre || !ownerEmail) {
    console.error(
      'Usage: seed-tenant.ts --schema=tenant_westmedia --nombre="West Media" --ownerEmail=owner@westmedia.com',
    )
    process.exit(1)
  }

  const subdominioBase = schema.startsWith('tenant_')
    ? schema.replace('tenant_', '')
    : slugify(nombre)

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const client = new PrismaClient({
    adapter: new PrismaPg(pool, { schema: 'public' }),
  } as any)

  let tenant = await client.tenant.findUnique({ where: { subdominioBase } })
  if (!tenant) {
    tenant = await client.tenant.create({
      data: { nombre, subdominioBase, dbSchema: schema },
    })
  }

  let rolesCreated = 0
  for (const [rolNombre, permisos] of Object.entries(BUILTIN_ROLES)) {
    await client.role.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: rolNombre } },
      create: {
        tenantId: tenant.id,
        nombre: rolNombre,
        permisos: permisos as string[],
        esBuiltin: true,
      },
      update: {},
    })
    rolesCreated++
  }

  const tempPassword = randomPassword(12)
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  await client.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: ownerEmail } },
    create: {
      tenantId: tenant.id,
      nombre: 'Owner',
      email: ownerEmail,
      passwordHash,
      rolId: 'owner',
    },
    update: {},
  })

  console.log(`✓ Tenant creado: ${nombre}`)
  console.log(`✓ ${rolesCreated} roles creados`)
  console.log(`✓ Usuario owner: ${ownerEmail}`)
  console.log(`✓ Contraseña temporal: ${tempPassword}`)
  console.log(`✓ URL: https://admin.${subdominioBase}.spaces.com`)

  await client.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
