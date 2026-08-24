// ============================================================================
//  bootstrap-auth.mjs — Crea la organización de la instancia y su Dueño
//  (bcrypt). Idempotente. Correr desde apps/web:
//
//    DATABASE_URL=postgresql://usuario:clave@host:puerto/base \
//    ORG_SLUG=mi-org ORG_NOMBRE='Mi Organizacion SA' \
//    ADMIN_EMAIL=duena@mi-org.mx ADMIN_NOMBRE='Nombre de la duena' \
//    node scripts/bootstrap-auth.mjs
//
//  Las cinco variables son OBLIGATORIAS y ninguna tiene valor por omisión: el
//  script no elige la base por ti (ver abajo) ni de quién es la instancia.
//
//  Los PERMISOS ya no se siembran aquí: viajan en las migraciones desde el
//  2026-08-20 (ROJO-2). Este script comprueba que estén y se niega si no.
//
//  La CONTRASEÑA del Dueño la genera el script y la imprime UNA vez, solo si de
//  verdad creó la cuenta. Ya no existe `SEED_PASSWORD` ni contraseña por
//  omisión (ROJO-1), y el Dueño nace obligado a cambiarla.
// ============================================================================
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { generarPasswordTemporal } from '../lib/password-temporal.mjs'
import { esEmailValido } from '../lib/validacion-email.mjs'

// El destino NO tiene valor por omisión, y eso es deliberado.
//
// Antes caía en `postgresql://spaces:spaces@localhost:5433/spaces`: la base de
// desarrollo del docker-compose, que tiene DATOS REALES, y cuyo rol `spaces` es
// superusuario con BYPASSRLS — o sea que ni siquiera la RLS `FORCE` sobre
// `usuarios` (`db/migrations/20260720_hard1_usuarios_rls.sql`) lo frenaría.
// Mientras el insert moría con 42P10 ese destino era inerte; al arreglarlo, el
// script pasó a escribir de verdad y un `node scripts/bootstrap-auth.mjs` sin
// variables habría sembrado credenciales en una base que nadie eligió.
//
// Mismo criterio que con el tenant ausente unas líneas más abajo: es preferible
// que el script se niegue a arrancar y diga qué le falta, a que arranque contra
// un destino por omisión.
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error(
    'ERROR bootstrap: falta la variable DATABASE_URL.\n' +
      'Este script siembra credenciales, así que no adivina la base: tienes que\n' +
      'decirle explícitamente contra cuál corre.\n' +
      '  bash:        DATABASE_URL=postgresql://spaces:spaces@localhost:5433/mi_base node scripts/bootstrap-auth.mjs\n' +
      '  PowerShell:  $env:DATABASE_URL="postgresql://spaces:spaces@localhost:5433/mi_base"; node scripts/bootstrap-auth.mjs\n' +
      'Ojo: la base "spaces" del 5433 es de pruebas, pero es la del demo local.',
  )
  process.exit(1)
}

// ─── De quién es esta instancia: se PREGUNTA, no se hereda ─────────────────
//
// Hasta el 2026-08-19 la organización venía horneada ('rgb') y el Dueño también
// ('Cliente_ RGB Catorce' / jose@pixeled.com.mx). Con el modelo de instancias
// soberanas eso es un defecto de identidad: cada instancia que se aprovisionara
// —la de PIXELED, la de Telcel— habría nacido con la organización de otro owner
// y con una cuenta DUENO ajena capaz de entrar. `db/schema.sql` dejó de sembrar
// el tenant el mismo día; esto es la otra mitad.
//
// Sin valores por omisión, y por el mismo motivo que `DATABASE_URL` (T-02): un
// default aquí es exactamente el dato horneado que se acaba de retirar, y el
// día que alguien corriera el script sin variables volvería a sembrarlo.
const ORG_SLUG = (process.env.ORG_SLUG ?? '').trim()
const ORG_NOMBRE = (process.env.ORG_NOMBRE ?? '').trim()
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim()
const ADMIN_NOMBRE = (process.env.ADMIN_NOMBRE ?? '').trim()

const FALTAN = [
  ['ORG_SLUG', ORG_SLUG],
  ['ORG_NOMBRE', ORG_NOMBRE],
  ['ADMIN_EMAIL', ADMIN_EMAIL],
  ['ADMIN_NOMBRE', ADMIN_NOMBRE],
]
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (FALTAN.length) {
  console.error(
    `ERROR bootstrap: faltan variables de entorno: ${FALTAN.join(', ')}.\n` +
      'Este script crea la organización de la instancia y su Dueño, así que no\n' +
      'los adivina: antes venían horneados (la organización "rgb" y la cuenta\n' +
      'jose@pixeled.com.mx) y eso hacía que toda instancia nueva naciera con la\n' +
      'identidad de otro owner dentro.\n' +
      '  bash:        ORG_SLUG=mi-org ORG_NOMBRE="Mi Organizacion SA" \\\n' +
      '               ADMIN_EMAIL=duena@mi-org.mx ADMIN_NOMBRE="Nombre de la duena" \\\n' +
      '               DATABASE_URL=... node scripts/bootstrap-auth.mjs\n' +
      '  PowerShell:  $env:ORG_SLUG="mi-org"; $env:ORG_NOMBRE="Mi Organizacion SA"; ...\n' +
      'En desarrollo local, la organización de siempre es\n' +
      '  ORG_SLUG=rgb ORG_NOMBRE="RGB Catorce" (db/semilla-desarrollo.sql).',
  )
  process.exit(1)
}

// ─── Y que el correo lo PAREZCA, no solo que esté ──────────────────────────
//
// Defecto ⑥ del arranque del PADRE (2026-08-21): se pegó el bloque del runbook
// con los marcadores todavía puestos y el Dueño nació con el correo literal
// `<el correo de Google del Dueño>`. La comprobación de arriba lo dejó pasar
// porque no está vacío.
//
// La asimetría era el problema: `lib/validacion.ts` ya tenía `esEmailValido` y
// la aplicación SÍ la usa al dar de alta desde Administración. Por la pantalla
// no se podía crear un usuario con correo inválido; por el alta de una
// instancia, sí — y es la cuenta de máximo privilegio, la única que entra el
// primer día. Se reutiliza la misma función, no una copia.
//
// Va ANTES de conectar, a propósito: un correo inválido no debe llegar a abrir
// una conexión ni a escribir media fila.
if (!esEmailValido(ADMIN_EMAIL)) {
  console.error(
    `ERROR bootstrap: ADMIN_EMAIL no parece un correo: "${ADMIN_EMAIL}".\n` +
      'Se espera el formato ejemplo@correo.com.\n' +
      'Si estás copiando un runbook, revisa que no hayan quedado los marcadores\n' +
      'puestos: el 2026-08-21 este script creó al Dueño del PADRE con el correo\n' +
      'literal "<el correo de Google del Dueño>", y es la cuenta de máximo\n' +
      'privilegio de la instancia.',
  )
  process.exit(1)
}

// ─── La contraseña del Dueño se GENERA, y solo se ve una vez ───────────────
//
// Hasta el 2026-08-20 esto era `process.env.SEED_PASSWORD ?? 'spaces123'`, y en
// el re-ensayo de la Fase 4 se entró con ella y el correo público del Dueño:
// HTTP 200, sesión válida y los nueve módulos, incluidos `administracion` y
// `finanzas`. Idéntica en toda la flota. Bcrypt no protege de eso: no hay que
// romperla, hay que teclearla. Es ROJO-1.
//
// `SEED_PASSWORD` se retira ENTERA y no solo su valor por omisión: una variable
// que fija la contraseña es exactamente el mismo riesgo en cuanto el
// aprovisionamiento la escriba una vez para toda la flota. Nadie la elige y
// nadie la repite.
//
// El generador es el mismo que usa el restablecimiento desde la aplicación
// (`lib/server/usuarios-controller.ts`), extraído a `lib/password-temporal.mjs`
// para que no haya dos.
const PASSWORD_TEMPORAL = generarPasswordTemporal()

// ─── El catálogo de permisos NO vive aquí, y es una decisión ───────────────
//
// Hasta el 2026-08-20 este archivo llevaba su propia MATRIZ de 36 filas y la
// sembraba. La migración `20260819_semilla_rol_permisos.sql` sembraba otras 25.
// Eran DOS catálogos que podían divergir, y de hecho divergían: la política de
// acceso efectiva de una instancia la fijaba EL ÚLTIMO SCRIPT QUE CORRIÓ, sin un
// error y sin un aviso. En el re-ensayo de la Fase 4 el Dueño pasó de 19
// permisos a 24 solo por el orden. Eso fue ROJO-2.
//
// El catálogo es configuración de PRODUCTO —igual para toda la flota— así que
// viaja en las migraciones, que además lo llevan a las instancias que YA existan
// cuando se actualicen. Este script crea la IDENTIDAD de cada instancia, que es
// justo lo contrario: lo único que no debe ser igual en dos droplets.
//
// Lo que queda aquí es la comprobación de que el catálogo está: ver el paso 1.

// El Dueño de la instancia. Uno solo: los demás usuarios los da de alta él
// desde la aplicación.
const USUARIOS = [
  { nombre: ADMIN_NOMBRE, email: ADMIN_EMAIL, cargo: 'Dueño', rol: 'DUENO' },
]

// La organización a la que pertenece el usuario inicial. Se resuelve SIEMPRE por
// slug y nunca por uuid: el id de `tenants` se genera en cada base, así que un
// uuid escrito aquí solo sería correcto en la base donde se copió.
const TENANT_SLUG = ORG_SLUG

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function main() {
  // 0) La organización de la instancia.
  //
  // Antes la creaba `db/schema.sql` sembrando 'rgb', y este script se limitaba
  // a buscarla. Ahora el esquema nace sin ninguna —una instancia no hereda la
  // identidad de otro owner— así que quien la crea es el aprovisionamiento, y
  // esto es el aprovisionamiento.
  //
  // `on conflict (slug) do nothing` para que correrlo dos veces no cambie nada
  // ni pise el nombre que la organización tenga hoy. Ojo: eso significa que
  // esta consulta puede afectar 0 filas legítimamente, así que NO se usa su
  // `rowCount` para concluir nada — quien comprueba que la organización existe
  // de verdad es el insert del Dueño, unas líneas más abajo.
  await pool.query(
    `insert into tenants (nombre, slug) values ($1, $2) on conflict (slug) do nothing`,
    [ORG_NOMBRE, TENANT_SLUG],
  )

  // 1) El catálogo de permisos tiene que ESTAR — no se siembra aquí
  //
  // Fail-closed, mismo criterio que T-01b (13/08): el no-op silencioso es el
  // modo de fallo que ya costó un despliegue. `permisosDeRol` y `tienePermiso`
  // (`lib/server/auth.ts:126-142`) son consultas directas a `rol_permisos`, SIN
  // excepción para el Dueño, y `exigir()` es fail-closed. Un alta que terminara
  // «bien» sobre una base sin catálogo entregaría una instancia en la que el
  // Dueño entra y no puede abrir nada — ni Administración, desde donde daría de
  // alta a su equipo. Entregar eso es peor que no entregar.
  //
  // Se comprueba una puerta CONCRETA y no el total: un `count(*) > 0` lo
  // cumpliría una base con las cinco filas de `inventario` que siembra
  // `20260804_modulo_inventario.sql`, que es exactamente el estado inservible.
  const { rows: puerta } = await pool.query(
    `select exists (
       select 1 from rol_permisos
        where rol = 'DUENO' and modulo = 'administracion' and accion = 'ver'
     ) as hay`,
  )
  if (!puerta[0].hay) {
    const { rows: cuenta } = await pool.query('select count(*)::int as n from rol_permisos')
    throw new Error(
      `esta base no tiene el catálogo de permisos: rol_permisos tiene ${cuenta[0].n} fila(s) y ` +
        `ninguna deja al Dueño abrir Administración. El catálogo lo siembran las migraciones ` +
        `(20260819_semilla_rol_permisos.sql y 20260820_catalogo_permisos_completo.sql), no este ` +
        `script. Corre primero "node scripts/migrar.mjs" contra esta base y repite el alta: si ` +
        `siguiera, la instancia se entregaría con el Dueño sin poder abrir ni Administración.`,
    )
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
  const hash = await bcrypt.hash(PASSWORD_TEMPORAL, 10)
  const creados = []
  for (const u of USUARIOS) {
    const r = await pool.query(
      // `debe_cambiar_password = true` en el alta, no despues: la columna es
      // `not null default false` (`20260804_reautenticacion_individual.sql:35`),
      // asi que sin ponerlo el Dueno nacia con una contrasena conocida Y sin
      // obligacion de cambiarla — la peor combinacion de las dos. Con la marca,
      // `exigir()` (`lib/server/auth.ts:167`) corta con 403 hasta que la cambie,
      // dejando abiertas a proposito `/api/auth/me` y `/api/perfil` para que
      // pueda salir del estado.
      //
      // Y el `on conflict` ya NO reescribe `password_hash`. Con una contrasena
      // fija daba igual: la reescribia con la misma. Con una generada, repetir
      // el alta dejaria al Dueno fuera de su propia instancia — y este script se
      // anuncia como idempotente. `xmax = 0` distingue el insert real de la
      // actualizacion, que es lo unico que decide si hay contrasena que
      // entregar.
      `insert into usuarios (tenant_id, nombre, email, cargo, rol, password_hash, activo, debe_cambiar_password)
       select t.id, $1,$2,$3,$4,$5,true,true from tenants t where t.slug = $6
       on conflict (lower(email)) do update set
         nombre = excluded.nombre, cargo = excluded.cargo, rol = excluded.rol,
         activo = true
       returning (xmax = 0) as creado`,
      [u.nombre, u.email, u.cargo, u.rol, hash, TENANT_SLUG],
    )
    // Si la organización no existe, el `select` no devuelve filas, el insert
    // afecta 0 y la consulta termina CON ÉXITO sin haber creado nada. Ese no-op
    // silencioso es el peor final posible para un bootstrap: la base queda sin
    // usuario y el operador cree que sembró. Se aborta ruidosamente.
    //
    // El guard NO sobra ahora que el paso 0 crea la organización: sigue siendo
    // lo único que distingue «se creó» de «pareció crearse». Si el insert de
    // `tenants` no dejó fila —un trigger, una política, una réplica en solo
    // lectura— aquí es donde se nota, y es el motivo de T-01b (13/08).
    if (r.rowCount === 0) {
      throw new Error(
        `la organización con slug "${TENANT_SLUG}" no existe ni quedó creada, así que ` +
          `el usuario ${u.email} no se pudo crear. La base no acepta el alta de la ` +
          `organización: revísala antes de volver a correr este script.`,
      )
    }
    if (r.rows[0]?.creado) creados.push(u.email)
  }

  console.log(`OK · usuarios: ${USUARIOS.length} · organización: ${TENANT_SLUG}`)
  console.log(`Dueño: ${ADMIN_EMAIL}`)
  // La contraseña se enseña UNA vez y solo si de verdad se creó la cuenta. Si el
  // Dueño ya existía, la suya no se ha tocado: imprimir la generada aquí sería
  // entregar una que no funciona, que es peor que no entregar ninguna.
  if (creados.length) {
    console.log(`Contraseña temporal (se muestra UNA sola vez): ${PASSWORD_TEMPORAL}`)
    console.log('Entrégasela al Dueño por un canal aparte. La aplicación le exigirá')
    console.log('cambiarla antes de dejarle hacer nada: hasta entonces todo responde 403.')
  } else {
    console.log('El Dueño ya existía: su contraseña NO se ha tocado. Si la perdió, se')
    console.log('restablece desde Administración, no repitiendo este script.')
  }
  await pool.end()
}

main().catch((e) => {
  console.error('ERROR bootstrap:', e.message)
  process.exit(1)
})
