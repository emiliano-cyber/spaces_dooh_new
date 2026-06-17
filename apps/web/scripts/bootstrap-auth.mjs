// ============================================================================
//  bootstrap-auth.mjs — Crea permisos por rol + usuarios iniciales (bcrypt).
//  Idempotente. Correr desde apps/web:  node scripts/bootstrap-auth.mjs
//  Usa DATABASE_URL o el Postgres local del docker-compose (5433).
// ============================================================================
import pg from 'pg'
import bcrypt from 'bcryptjs'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const PASSWORD_DEFAULT = process.env.SEED_PASSWORD ?? 'spaces123'

// Matriz roles × módulos × acciones (espejo de components/demo/admin/permisos.ts)
const MATRIZ = {
  dashboard:      { DUENO: ['ver'], COMERCIAL: ['ver'], FINANZAS: ['ver'] },
  comercial:      { DUENO: ['ver', 'crear', 'aprobar'], COMERCIAL: ['ver', 'crear'], OPERACIONES: ['ver'] },
  arrendadores:   { DUENO: ['ver', 'crear', 'aprobar'] },
  operaciones:    { DUENO: ['ver', 'aprobar'], OPERACIONES: ['ver', 'crear'], IMPRENTA: ['ver'] },
  imprenta:       { DUENO: ['ver', 'aprobar'], IMPRENTA: ['ver', 'crear'], OPERACIONES: ['ver'] },
  finanzas:       { DUENO: ['ver', 'facturar'], FINANZAS: ['ver', 'crear', 'facturar'] },
  network:        { DUENO: ['ver', 'crear'], COMERCIAL: ['ver'] },
  administracion: { DUENO: ['ver', 'crear', 'aprobar'] },
}

const USUARIOS = [
  { nombre: 'Cliente_ RGB Catorce', email: 'jose@pixeled.com.mx', cargo: 'Dueño', rol: 'DUENO' },
  { nombre: 'María Quispe', email: 'maria@billboardsperu.pe', cargo: 'Dueña', rol: 'DUENO' },
  { nombre: 'Carlos Mendoza', email: 'carlos@billboardsperu.pe', cargo: 'Ejecutivo comercial', rol: 'COMERCIAL' },
  { nombre: 'Luis Paredes', email: 'luis@billboardsperu.pe', cargo: 'Jefe de operaciones', rol: 'OPERACIONES' },
  { nombre: 'Rosa Inga', email: 'rosa@billboardsperu.pe', cargo: 'Coordinadora de imprenta', rol: 'IMPRENTA' },
  { nombre: 'Andrea Salas', email: 'andrea@billboardsperu.pe', cargo: 'Finanzas', rol: 'FINANZAS' },
]

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function main() {
  // 1) Permisos por rol
  let permisos = 0
  for (const [modulo, porRol] of Object.entries(MATRIZ)) {
    for (const [rol, acciones] of Object.entries(porRol)) {
      for (const accion of acciones) {
        await pool.query(
          `insert into rol_permisos (rol, modulo, accion) values ($1,$2,$3)
           on conflict (rol, modulo, accion) do nothing`,
          [rol, modulo, accion],
        )
        permisos++
      }
    }
  }

  // 2) Usuarios con contraseña encriptada
  const hash = await bcrypt.hash(PASSWORD_DEFAULT, 10)
  for (const u of USUARIOS) {
    await pool.query(
      `insert into usuarios (nombre, email, cargo, rol, password_hash, activo)
       values ($1,$2,$3,$4,$5,true)
       on conflict (email) do update set
         nombre = excluded.nombre, cargo = excluded.cargo, rol = excluded.rol,
         password_hash = excluded.password_hash, activo = true`,
      [u.nombre, u.email, u.cargo, u.rol, hash],
    )
  }

  console.log(`OK · permisos sembrados: ${permisos} · usuarios: ${USUARIOS.length}`)
  console.log(`Contraseña inicial para todos: "${PASSWORD_DEFAULT}" (cámbiala después)`)
  console.log('Admin: jose@pixeled.com.mx')
  await pool.end()
}

main().catch((e) => {
  console.error('ERROR bootstrap:', e.message)
  process.exit(1)
})
