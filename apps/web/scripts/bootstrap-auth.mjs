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
// El DUENO es superusuario (crear/aprobar en todos los módulos; facturar en
// finanzas). Los demás roles tienen permisos acotados a su función.
const MATRIZ = {
  dashboard:      { DUENO: ['ver'], COMERCIAL: ['ver'], FINANZAS: ['ver'] },
  comercial:      { DUENO: ['ver', 'crear', 'aprobar'], COMERCIAL: ['ver', 'crear'], OPERACIONES: ['ver'] },
  arrendadores:   { DUENO: ['ver', 'crear', 'aprobar'] },
  operaciones:    { DUENO: ['ver', 'crear', 'aprobar'], OPERACIONES: ['ver', 'crear'], IMPRENTA: ['ver'] },
  imprenta:       { DUENO: ['ver', 'crear', 'aprobar'], IMPRENTA: ['ver', 'crear'], OPERACIONES: ['ver'] },
  finanzas:       { DUENO: ['ver', 'crear', 'facturar'], FINANZAS: ['ver', 'crear', 'facturar'] },
  network:        { DUENO: ['ver', 'crear'], COMERCIAL: ['ver'] },
  administracion: { DUENO: ['ver', 'crear', 'aprobar'] },
}

// BD desde cero: solo el cliente/usuario RGB para hacer pruebas reales.
const USUARIOS = [
  { nombre: 'Cliente_ RGB Catorce', email: 'jose@pixeled.com.mx', cargo: 'Dueño', rol: 'DUENO' },
]

// La organización a la que pertenece el usuario inicial. Se resuelve SIEMPRE por
// slug y nunca por uuid: el id de `tenants` se genera en cada base, así que un
// uuid escrito aquí solo sería correcto en la base donde se copió.
const TENANT_SLUG = 'rgb'

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
  //
  // Dos detalles que este insert ya rompió antes, los dos silenciosos a su modo:
  //
  //  · El conflicto va por `lower(email)`, NO por `email`. La unicidad de correo
  //    es un índice FUNCIONAL (`usuarios_email_lower_uidx`, db/schema.sql:72) y
  //    Postgres no lo infiere desde `on conflict (email)`: contesta 42P10 y el
  //    script muere sin sembrar a nadie. Así estuvo desde que la unicidad pasó a
  //    ser insensible a mayúsculas y nadie volvió a correr el bootstrap.
  //
  //  · El `tenant_id` se fija aquí a propósito. Antes lo ponía el DEFAULT que
  //    db/schema.sql cablea en la tabla, pero ese default es un uuid de otra
  //    base y está en retirada: sin fijarlo, el insert cae con 23502.
  const hash = await bcrypt.hash(PASSWORD_DEFAULT, 10)
  for (const u of USUARIOS) {
    const r = await pool.query(
      `insert into usuarios (tenant_id, nombre, email, cargo, rol, password_hash, activo)
       select t.id, $1,$2,$3,$4,$5,true from tenants t where t.slug = $6
       on conflict (lower(email)) do update set
         nombre = excluded.nombre, cargo = excluded.cargo, rol = excluded.rol,
         password_hash = excluded.password_hash, activo = true`,
      [u.nombre, u.email, u.cargo, u.rol, hash, TENANT_SLUG],
    )
    // Si la organización no existe, el `select` no devuelve filas, el insert
    // afecta 0 y la consulta termina CON ÉXITO sin haber creado nada. Ese no-op
    // silencioso es el peor final posible para un bootstrap: la base queda sin
    // usuario y el operador cree que sembró. Se aborta ruidosamente.
    if (r.rowCount === 0) {
      throw new Error(
        `no existe la organización con slug "${TENANT_SLUG}", así que el usuario ` +
          `${u.email} no se pudo crear. Aplica db/schema.sql (crea el tenant "${TENANT_SLUG}") ` +
          `o inserta la organización antes de volver a correr este script.`,
      )
    }
  }

  console.log(`OK · permisos sembrados: ${permisos} · usuarios: ${USUARIOS.length} · organización: ${TENANT_SLUG}`)
  console.log(`Contraseña inicial para todos: "${PASSWORD_DEFAULT}" (cámbiala después)`)
  console.log('Admin: jose@pixeled.com.mx')
  await pool.end()
}

main().catch((e) => {
  console.error('ERROR bootstrap:', e.message)
  process.exit(1)
})
