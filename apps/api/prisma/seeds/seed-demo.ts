/**
 * Seed de demo — datos realistas para demostración del MVP.
 * Se ejecuta DESPUÉS de seed-tenant.ts sobre un schema ya migrado.
 *
 * DATABASE_URL="postgresql://postgres:password@localhost:5432/spaces?schema=tenant_template" \
 *   npx ts-node apps/api/prisma/seeds/seed-demo.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

// ─── Connect ──────────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL!
const schemaMatch = dbUrl.match(/[?&]schema=([^&]+)/)
const schema = schemaMatch?.[1] ?? 'tenant_template'

const pool = new pg.Pool({ connectionString: dbUrl })
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { schema }) as any,
} as any) as any

// ─── Helpers ──────────────────────────────────────────────────────────────────
const now = new Date()
const days = (n: number) => new Date(now.getTime() + n * 86400_000)
const DEMO_PASSWORD = 'Demo2025!'

async function hashPwd(p: string) {
  return bcrypt.hash(p, 10)
}

// Read tenant info from public schema (for owner email display)
async function getTenantInfo() {
  const publicPool = new pg.Pool({ connectionString: dbUrl.replace(/\?.*$/, '') })
  try {
    const res = await publicPool.query(
      `SELECT t.nombre, t."subdominioBase", u.email
       FROM public."Tenant" t
       LEFT JOIN public."User" u ON u."tenantId" = t.id AND u."rolId" = 'owner'
       WHERE t."dbSchema" = $1
       LIMIT 1`,
      [schema],
    )
    return res.rows[0] ?? { nombre: 'Demo', subdominioBase: 'demo', email: 'owner@demo.com' }
  } finally {
    await publicPool.end()
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n→ Creando datos de demo en schema: ${schema}\n`)

  // ── Limpieza previa (idempotente) ──────────────────────────────────────────
  const s = schema
  await pool.query(`
    TRUNCATE TABLE
      "${s}"."AuditLog",
      "${s}"."EvidenciaOT",
      "${s}"."OrdenTrabajo",
      "${s}"."TrafficOrder",
      "${s}"."CampaignLine",
      "${s}"."Creatividad",
      "${s}"."Campana",
      "${s}"."Cliente",
      "${s}"."ContratoArrendamiento",
      "${s}"."Sitio",
      "${s}"."Arrendador"
    RESTART IDENTITY CASCADE
  `)
  console.log('  ✓ Tablas limpiadas\n')

  // ── Arrendadores ────────────────────────────────────────────────────────────
  const arr1 = await prisma.arrendador.create({
    data: { nombre: 'Inmuebles del Centro SA', rfc: 'ICS800101AAA', telefono: '5512345678', email: 'contratos@inmueblescentro.mx' },
  })
  const arr2 = await prisma.arrendador.create({
    data: { nombre: 'Propiedades Metropolitanas', rfc: 'PME900615BBB', telefono: '5598765432', email: 'admin@propmetro.mx' },
  })
  const arr3 = await prisma.arrendador.create({
    data: { nombre: 'Arrendadora Norte', rfc: 'ANO750320CCC', telefono: '8181234567', email: 'norte@arrendadora.mx' },
  })

  // ── Sitios ──────────────────────────────────────────────────────────────────
  // CDMX espectaculares
  const s1 = await prisma.sitio.create({ data: {
    claveInterna: 'CDMX-001', nombre: 'Reforma & Insurgentes', tipoMedio: 'ESPECTACULAR',
    lat: 19.4326, lng: -99.1332, direccion: 'Paseo de la Reforma 350', alcaldia: 'Cuauhtémoc',
    ciudad: 'Ciudad de México', estado: 'CDMX', iluminado: true, orientacion: 'Norte',
    alto: 7.5, ancho: 12.0, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})
  const s2 = await prisma.sitio.create({ data: {
    claveInterna: 'CDMX-002', nombre: 'Insurgentes Sur Periférico', tipoMedio: 'ESPECTACULAR',
    lat: 19.3430, lng: -99.1780, direccion: 'Insurgentes Sur 3700', alcaldia: 'Tlalpan',
    ciudad: 'Ciudad de México', estado: 'CDMX', iluminado: true, orientacion: 'Sur',
    alto: 8.0, ancho: 14.0, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})
  // Espectacular por vencer (contrato a 10 días)
  const s3 = await prisma.sitio.create({ data: {
    claveInterna: 'CDMX-003', nombre: 'Viaducto Piedad', tipoMedio: 'ESPECTACULAR',
    lat: 19.4012, lng: -99.1580, direccion: 'Viaducto Miguel Alemán 520', alcaldia: 'Benito Juárez',
    ciudad: 'Ciudad de México', estado: 'CDMX', iluminado: false, orientacion: 'Poniente',
    alto: 6.0, ancho: 10.0, estatusComercial: 'OCUPADO', estatusOperativo: 'ACTIVO',
  }})

  // Monterrey pantallas digitales
  const s4 = await prisma.sitio.create({ data: {
    claveInterna: 'MTY-001', nombre: 'San Pedro Garza García Centro', tipoMedio: 'PANTALLA_DIGITAL',
    lat: 25.6572, lng: -100.4038, direccion: 'Av. Vasconcelos 150', alcaldia: 'San Pedro',
    ciudad: 'Monterrey', estado: 'Nuevo León', iluminado: true, orientacion: 'Este',
    alto: 3.0, ancho: 5.5, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})
  const s5 = await prisma.sitio.create({ data: {
    claveInterna: 'MTY-002', nombre: 'Monterrey Centro Histórico', tipoMedio: 'PANTALLA_DIGITAL',
    lat: 25.6714, lng: -100.3090, direccion: 'Av. Constitución 300', alcaldia: 'Centro',
    ciudad: 'Monterrey', estado: 'Nuevo León', iluminado: true, orientacion: 'Norte',
    alto: 2.5, ancho: 4.0, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})

  // CDMX puente peatonal en mantenimiento
  const s6 = await prisma.sitio.create({ data: {
    claveInterna: 'CDMX-004', nombre: 'Puente Pedregal Xochimilco', tipoMedio: 'PUENTE_PEATONAL',
    lat: 19.3151, lng: -99.1620, direccion: 'Calzada del Hueso 1200', alcaldia: 'Coyoacán',
    ciudad: 'Ciudad de México', estado: 'CDMX', iluminado: false,
    alto: 2.0, ancho: 8.0, estatusComercial: 'BLOQUEADO', estatusOperativo: 'EN_MANTENIMIENTO',
  }})

  // Guadalajara mobiliario urbano
  const s7 = await prisma.sitio.create({ data: {
    claveInterna: 'GDL-001', nombre: 'Andares Zapopan MUB-1', tipoMedio: 'MOBILIARIO_URBANO',
    lat: 20.7304, lng: -103.4145, direccion: 'Blvd. Puerta de Hierro 4965', alcaldia: 'Zapopan',
    ciudad: 'Guadalajara', estado: 'Jalisco', iluminado: true, orientacion: 'Sur',
    alto: 1.8, ancho: 1.2, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})
  const s8 = await prisma.sitio.create({ data: {
    claveInterna: 'GDL-002', nombre: 'Plaza del Sol MUB-2', tipoMedio: 'MOBILIARIO_URBANO',
    lat: 20.6470, lng: -103.3894, direccion: 'Av. López Mateos Sur 2375', alcaldia: 'Guadalajara',
    ciudad: 'Guadalajara', estado: 'Jalisco', iluminado: true, orientacion: 'Oriente',
    alto: 1.8, ancho: 1.2, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})

  // Pantalla digital con incidencia abierta
  const s9 = await prisma.sitio.create({ data: {
    claveInterna: 'CDMX-005', nombre: 'Santa Fe Torre Arcos', tipoMedio: 'PANTALLA_DIGITAL',
    lat: 19.3617, lng: -99.2601, direccion: 'Prolongación Paseo de la Reforma 1015', alcaldia: 'Álvaro Obregón',
    ciudad: 'Ciudad de México', estado: 'CDMX', iluminado: true,
    alto: 4.0, ancho: 7.0, estatusComercial: 'DISPONIBLE', estatusOperativo: 'DAÑADO',
  }})

  // DOOH para campaña digital
  const s10 = await prisma.sitio.create({ data: {
    claveInterna: 'MTY-003', nombre: 'Cintermex Monterrey', tipoMedio: 'PANTALLA_DIGITAL',
    lat: 25.7219, lng: -100.2983, direccion: 'Av. Fundidora 501', alcaldia: 'Monterrey',
    ciudad: 'Monterrey', estado: 'Nuevo León', iluminado: true,
    alto: 5.0, ancho: 8.0, estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
  }})

  const sitios = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10]

  // ── Contratos ────────────────────────────────────────────────────────────────
  const contratos = [
    { sitio: s1, arr: arr1, monto: 35000, fechaInicio: days(-365), fechaFin: days(365) },
    { sitio: s2, arr: arr1, monto: 40000, fechaInicio: days(-180), fechaFin: days(185) },
    { sitio: s3, arr: arr1, monto: 22000, fechaInicio: days(-355), fechaFin: days(10) }, // ← por vencer
    { sitio: s4, arr: arr2, monto: 18000, fechaInicio: days(-90),  fechaFin: days(275) },
    { sitio: s5, arr: arr2, monto: 15000, fechaInicio: days(-60),  fechaFin: days(300) },
    { sitio: s6, arr: arr2, monto: 8000,  fechaInicio: days(-200), fechaFin: days(165) },
    { sitio: s7, arr: arr3, monto: 5000,  fechaInicio: days(-120), fechaFin: days(240) },
    { sitio: s8, arr: arr3, monto: 5500,  fechaInicio: days(-75),  fechaFin: days(285) },
    { sitio: s9, arr: arr3, monto: 28000, fechaInicio: days(-200), fechaFin: days(160) },
    { sitio: s10,arr: arr2, monto: 32000, fechaInicio: days(-150), fechaFin: days(215) },
  ]

  for (const c of contratos) {
    const diasRestantes = Math.round((c.fechaFin.getTime() - now.getTime()) / 86400_000)
    const estatus = diasRestantes <= 30 ? 'POR_VENCER' : 'VIGENTE'
    await prisma.contratoArrendamiento.create({
      data: {
        sitioId: c.sitio.id, arrendadorId: c.arr.id,
        fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
        montoRenta: c.monto, periodicidad: 'MENSUAL', moneda: 'MXN',
        estatus,
      },
    })
  }

  // ── Incidencia abierta en s9 ────────────────────────────────────────────────
  await prisma.incidencia.create({
    data: {
      sitioId: s9.id, tipo: 'MANTENIMIENTO',
      descripcion: 'Pantalla con píxeles muertos en cuadrante inferior derecho. Requiere reemplazo de módulo LED.',
      fechaInicio: days(-3), impactaComercial: true, estatus: 'ABIERTA',
      reportadoPorUserId: 'system',
    },
  })

  // ── Clientes ─────────────────────────────────────────────────────────────────
  const cAgencia = await prisma.cliente.create({
    data: { nombre: 'Agencia Creativa MX', rfc: 'ACM180615JKL', tipo: 'AGENCIA' },
  })
  const cFemsa = await prisma.cliente.create({
    data: { nombre: 'Coca-Cola FEMSA', rfc: 'CCF910101MNO', tipo: 'DIRECTO' },
  })
  const cSoriana = await prisma.cliente.create({
    data: { nombre: 'Soriana', rfc: 'SOR800510PQR', tipo: 'DIRECTO' },
  })

  // ── Usuarios adicionales (en schema público, mismo tenant) ───────────────────
  // We'll use the public Prisma client for users
  const publicPool = new pg.Pool({ connectionString: dbUrl.replace(/\?.*$/, '') })
  const publicClient = new PrismaClient({
    adapter: new PrismaPg(publicPool, { schema: 'public' }) as any,
  } as any) as any

  const tenantRow = await publicClient.tenant.findFirst({ where: { dbSchema: schema } })
  if (tenantRow) {
    const usersToCreate = [
      { email: 'vendedor@demo.com',    nombre: 'Carlos Vendedor',    rolId: 'seller' },
      { email: 'operaciones@demo.com', nombre: 'Diana Operaciones',  rolId: 'operaciones_manager' },
      { email: 'trafico@demo.com',     nombre: 'Luis Tráfico',       rolId: 'trafficker' },
    ]
    for (const u of usersToCreate) {
      const hash = await hashPwd(DEMO_PASSWORD)
      await publicClient.user.upsert({
        where: { tenantId_email: { tenantId: tenantRow.id, email: u.email } },
        create: { tenantId: tenantRow.id, nombre: u.nombre, email: u.email, passwordHash: hash, rolId: u.rolId },
        update: { passwordHash: hash },
      })
    }
  }
  await publicClient.$disconnect()
  await publicPool.end()

  // ── Helper: generate folio ───────────────────────────────────────────────────
  async function nextFolio() {
    const count = await prisma.campana.count()
    return `CAMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
  }

  // ── Campaña 1: Soriana Verano — ACTIVA con OT completada ────────────────────
  const folio1 = await nextFolio()
  const camp1 = await prisma.campana.create({ data: {
    folio: folio1, nombre: 'Soriana Verano 2025', clienteId: cSoriana.id,
    tipoCampana: 'OOH', estadoComercial: 'ACTIVA',
    fechaInicio: days(-15), fechaFin: days(45),
    presupuestoBruto: 450000, moneda: 'MXN',
    ocRecibida: true, fotosComprobatorias: true,
  }})
  for (const sitio of [s1, s2, s4]) {
    await prisma.campaignLine.create({ data: {
      campanaId: camp1.id, sitioId: sitio.id, pantallasIds: [],
      fechaInicio: days(-15), fechaFin: days(45),
      tipoVenta: 'DAY_PACK', precio: 150000, cantidad: 60, unidad: 'DIA',
    }})
  }
  // OT completada con evidencia
  const folio1OT = await prisma.ordenTrabajo.count()
  const ot1 = await prisma.ordenTrabajo.create({ data: {
    folio: `OT-${new Date().getFullYear()}-${String(folio1OT + 1).padStart(4, '0')}`,
    campanaId: camp1.id, tipo: 'MONTAJE_LONA', prioridad: 'ALTA', estatus: 'COMPLETADA',
    fechaProgramada: days(-14), descripcion: 'Instalación campaña Soriana Verano',
    asignadoAUserId: 'system',
    fechaCompletada: days(-13),
  }})
  await prisma.evidenciaOT.create({ data: {
    otId: ot1.id, fotoUrl: 'https://demo.spaces.com/fotos/soriana-1.jpg',
    storageKey: 'demo/soriana/foto1.jpg', tipo: 'FOTO', lat: 19.4326, lng: -99.1332,
    uploadedBy: 'system',
  }})

  // ── Campaña 2: FEMSA Digital — COTIZACION DOOH ──────────────────────────────
  const folio2 = await nextFolio()
  const camp2 = await prisma.campana.create({ data: {
    folio: folio2, nombre: 'FEMSA Digital Q1 2026', clienteId: cFemsa.id,
    tipoCampana: 'DOOH', estadoComercial: 'COTIZACION',
    fechaInicio: days(15), fechaFin: days(75),
    presupuestoBruto: 280000, moneda: 'MXN',
  }})
  for (const sitio of [s4, s5]) {
    await prisma.campaignLine.create({ data: {
      campanaId: camp2.id, sitioId: sitio.id, pantallasIds: [],
      fechaInicio: days(15), fechaFin: days(75),
      tipoVenta: 'PROG_DIRECT', precio: 140000, cantidad: 1, unidad: 'PAQUETE',
      duracionSpot: 15, frecuencia: 12,
    }})
  }

  // ── Campaña 3: Agencia — LISTA_FACTURAR ─────────────────────────────────────
  const folio3 = await nextFolio()
  const camp3 = await prisma.campana.create({ data: {
    folio: folio3, nombre: 'Agencia Creativa — Lanzamiento Verano', clienteId: cAgencia.id,
    tipoCampana: 'OOH', estadoComercial: 'LISTA_FACTURAR',
    fechaInicio: days(-30), fechaFin: days(-1),
    presupuestoBruto: 320000, moneda: 'MXN',
    ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true,
    portalToken: randomUUID(), portalActivo: true,
  }})
  for (const sitio of [s7, s8]) {
    await prisma.campaignLine.create({ data: {
      campanaId: camp3.id, sitioId: sitio.id, pantallasIds: [],
      fechaInicio: days(-30), fechaFin: days(-1),
      tipoVenta: 'DAY_PACK', precio: 160000, cantidad: 29, unidad: 'DIA',
    }})
  }

  // ── Campaña 4: Completada el mes pasado ─────────────────────────────────────
  const folio4 = await nextFolio()
  await prisma.campana.create({ data: {
    folio: folio4, nombre: 'Soriana Navidad 2025', clienteId: cSoriana.id,
    tipoCampana: 'OOH', estadoComercial: 'COMPLETADA',
    fechaInicio: days(-75), fechaFin: days(-31),
    presupuestoBruto: 500000, moneda: 'MXN',
    ocRecibida: true, fotosComprobatorias: true, reportePublicacion: true,
  }})

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const info = await getTenantInfo()

  const sitioCount  = await prisma.sitio.count()
  const arrCount    = await prisma.arrendador.count()
  const campCount   = await prisma.campana.count()
  const clientCount = await prisma.cliente.count()

  console.log('\n' + '='.repeat(43))
  console.log('  SPACES for D/OOH — Datos de Demo')
  console.log('='.repeat(43))
  console.log(`  Tenant  : ${info.nombre}`)
  console.log(`  URL     : https://admin.${info.subdominioBase}.spaces.com`)
  console.log('')
  console.log('  Usuarios:')
  console.log(`    ${info.email} / (contraseña inicial del seed-tenant)`)
  console.log(`    vendedor@demo.com / ${DEMO_PASSWORD}`)
  console.log(`    operaciones@demo.com / ${DEMO_PASSWORD}`)
  console.log(`    trafico@demo.com / ${DEMO_PASSWORD}`)
  console.log('')
  console.log('  Datos creados:')
  console.log(`    ✓ ${sitioCount} sitios`)
  console.log(`    ✓ ${arrCount} arrendadores con contratos`)
  console.log(`    ✓ ${clientCount} clientes`)
  console.log(`    ✓ ${campCount} campañas (1 activa, 1 cotización, 1 lista facturar, 1 archivada)`)
  console.log('    ✓ OTs de ejemplo con evidencias')
  console.log('    ✓ 1 incidencia abierta (pantalla dañada)')
  console.log('='.repeat(43) + '\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
