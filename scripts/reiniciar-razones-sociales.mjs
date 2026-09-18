#!/usr/bin/env node
// ============================================================================
//  reiniciar-razones-sociales.mjs — volver a poder enseñar el cuestionario.
// ----------------------------------------------------------------------------
//  Uso (Windows PowerShell):
//
//    $env:DATABASE_URL="postgresql://spaces:spaces@localhost:5433/spaces_ver2"
//    node scripts/reiniciar-razones-sociales.mjs --base=spaces_ver2 --org=demo-rentabilidad
//    node scripts/reiniciar-razones-sociales.mjs --base=spaces_ver2 --org=demo-rentabilidad --borrar
//
//  Sin `--borrar` NO toca nada: cuenta lo que hay y dice exactamente qué se
//  llevaría por delante. Es el modo por omisión a propósito.
//
//  ─── Por qué existe ───────────────────────────────────────────────────────
//  El cuestionario de bienvenida aparece SOLO si la organización no tiene
//  ninguna razón social: la condición es un `count(*)` sobre
//  `entidades_fiscales` (`lib/server/bienvenida-repo.ts:70`), y cuenta también
//  las dadas de baja porque haber contestado es un hecho histórico. En cuanto
//  se contesta, no vuelve a salir.
//
//  Eso es CORRECTO —si se filtrara por `activo`, quien desactivara todas sus
//  razones sociales volvería a ver el cuestionario y crearía el duplicado que
//  ese módulo existe para evitar— y a la vez es una trampa para una
//  demostración en vivo: **no se pueden enseñar el cuestionario y los reportes
//  con historia en la misma base**. O se tienen dos bases y hay que cerrar
//  sesión en mitad de la presentación, o se enseña una de las dos cosas.
//
//  Este guion es la tercera salida, y la que el guion del Summit marca como
//  buena: borrar SOLO las razones sociales y sus asignaciones, dejar intacto
//  todo lo demás —inventario, contratos, campañas, reservas, órdenes,
//  comprobantes, recibos de luz— y volver a sembrarlas después con
//  `scripts/semilla-demo.mjs`.
//
//  ─── Qué borra, exactamente ───────────────────────────────────────────────
//    · `entidades_fiscales` de ESA organización
//    · `entidad_roles`, que se van solas por `on delete cascade`
//    · y con ellas, las dos asignaciones: `contratos_arrendamiento.entidad_id`
//      y `facturas.entidad_emisora_id` quedan en NULL, que es lo que hacen las
//      claves ajenas `on delete set null (columna)` de
//      `20260918_entidad_tenant_compuesto.sql`.
//
//  NO borra contratos, NO borra comprobantes, NO borra cobranzas. Que la
//  factura se quede sin emisora es precisamente el estado «sin asignar» que el
//  producto sabe pintar, y volver a sembrar la vuelve a poner.
//
//  ─── Por qué es tan incómodo de disparar ──────────────────────────────────
//  Porque es un borrado, se corre a mano y se corre el día del ensayo, que es
//  el peor día para equivocarse de base. Hacen falta TRES cosas a la vez:
//
//    1. `DATABASE_URL` apuntando a la base;
//    2. `--base=<nombre>` repitiendo el nombre, que tiene que COINCIDIR con el
//       de la URL — escribir el nombre dos veces es lo único que convierte un
//       «me equivoqué de terminal» en un error en vez de en un borrado;
//    3. `--borrar`, que sin él solo cuenta.
//
//  Y además se niega POR NOMBRE a cualquier base que no sea desechable, con el
//  mismo criterio con el que `semilla-demo.mjs` se niega a sembrar `spaces_e2e`.
// ============================================================================
import pg from 'pg'

const USO = `uso:
  DATABASE_URL=postgresql://usuario:clave@host:puerto/base \\
    node scripts/reiniciar-razones-sociales.mjs --base=<nombre> --org=<slug> [--borrar]

  --base=<nombre>   nombre de la base. OBLIGATORIO y sin valor por omision; tiene
                    que coincidir con el de DATABASE_URL
  --org=<slug>      organizacion cuyas razones sociales se borran. OBLIGATORIO:
                    la organizacion no se da por supuesta nunca
  --borrar          ejecuta de verdad. Sin esto solo cuenta y no toca nada`

// ─── Bases que este guion NO toca, y por qué ───────────────────────────────
//
// `spaces_e2e` es la del arnés de integración: `recrearEsquema()` la rehace en
// cada corrida y tocarla a mano hace fallar suites ajenas con un rojo que no
// dice por qué. `spaces` es la base de desarrollo del 5433, que no es una base
// de demostración. Y cualquier cosa con «prod» en el nombre no se toca desde
// una máquina de desarrollo, punto.
const BASES_PROHIBIDAS = ['spaces', 'spaces_e2e', 'postgres', 'template0', 'template1']
const PATRON_PROHIBIDO = /prod/i

// Y además tiene que PARECER una base de este producto. Una lista blanca real
// no se puede escribir —las bases desechables se crean sobre la marcha—, pero
// exigir el prefijo descarta de golpe la clase de accidente que importa:
// apuntar a una base de otro proyecto que estaba abierta en la misma terminal.
const PREFIJO_EXIGIDO = 'spaces_'

export function motivoDelRechazo(base) {
  if (!base) return 'no se pudo leer el nombre de la base en DATABASE_URL'
  if (BASES_PROHIBIDAS.includes(base)) return `'${base}' esta en la lista de bases que no se tocan`
  if (PATRON_PROHIBIDO.test(base)) return `'${base}' lleva 'prod' en el nombre`
  if (!base.startsWith(PREFIJO_EXIGIDO)) return `'${base}' no empieza por '${PREFIJO_EXIGIDO}'`
  return null
}

export function nombreDeBase(url) {
  try {
    return new URL(url).pathname.replace(/^\//, '')
  } catch {
    return ''
  }
}

export function opcionesDeArgv(args) {
  const o = { borrar: false }
  for (const a of args) {
    if (a === '--borrar') { o.borrar = true; continue }
    const m = /^--([a-z-]+)=(.*)$/.exec(a)
    if (!m) throw new Error(`argumento desconocido: ${a}\n\n${USO}`)
    const [, clave, valor] = m
    if (clave === 'base') o.base = valor
    else if (clave === 'org') o.org = valor
    else throw new Error(`opcion desconocida: --${clave}\n\n${USO}`)
  }
  // Sin valor por omisión NINGUNO de los dos: una base por omisión es una base
  // que alguien borra sin haberla elegido, y un tenant por omisión es la deriva
  // que este repositorio ya pagó etiquetando como 'rgb' filas de otras empresas.
  if (!o.base) throw new Error(`falta --base=<nombre>. No hay valor por omision.\n\n${USO}`)
  if (!o.org) throw new Error(`falta --org=<slug>. La organizacion no se da por supuesta.\n\n${USO}`)
  return o
}

// Las cuatro preguntas que hay que contestar ANTES de borrar. Se leen en la
// misma transacción que el borrado para que lo que se cuenta sea lo que se
// borra: entre un recuento fuera de la transacción y el `delete` cabe otra
// sesión escribiendo.
const SQL_INVENTARIO = `
select
  (select count(*)::int from entidades_fiscales where tenant_id = $1::uuid)            as entidades,
  (select count(*)::int from entidad_roles       where tenant_id = $1::uuid)            as papeles,
  (select count(*)::int from contratos_arrendamiento
     where tenant_id = $1::uuid and entidad_id is not null)                             as contratos,
  (select count(*)::int from facturas
     where tenant_id = $1::uuid and entidad_emisora_id is not null)                     as comprobantes`

export async function main(argv = process.argv) {
  let o
  try {
    o = opcionesDeArgv(argv.slice(2))
  } catch (e) {
    console.error(`ERROR reiniciar-razones-sociales: ${e.message}`)
    return 1
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(`ERROR reiniciar-razones-sociales: falta DATABASE_URL.\n\n${USO}`)
    return 1
  }

  const base = nombreDeBase(url)
  if (base !== o.base) {
    console.error(
      `ERROR reiniciar-razones-sociales: DATABASE_URL apunta a '${base}' y --base dice '${o.base}'.\n` +
        'Tienen que coincidir. El nombre se escribe dos veces a proposito: es lo unico\n' +
        'que convierte equivocarse de terminal en un error en vez de en un borrado.',
    )
    return 1
  }
  const rechazo = motivoDelRechazo(base)
  if (rechazo) {
    console.error(
      `ERROR reiniciar-razones-sociales: me niego a tocar esta base — ${rechazo}.\n` +
        'Este guion BORRA. Solo corre sobre una base desechable de demostracion.',
    )
    return 1
  }

  const cli = new pg.Client({ connectionString: url })
  await cli.connect()
  let salida = 0
  try {
    const { rows: orgs } = await cli.query('select id, nombre from tenants where slug = $1::text', [o.org])
    if (!orgs.length) {
      console.error(`ERROR reiniciar-razones-sociales: no existe la organizacion '${o.org}' en '${base}'.`)
      return 1
    }
    const tenantId = orgs[0].id

    await cli.query('begin')
    // R2: contexto de tenant TRANSACTION-LOCAL, igual que hace `q()`
    // (`lib/server/db.ts`). `entidades_fiscales` tiene FORCE ROW LEVEL
    // SECURITY: sin contexto, una lectura normal devuelve CERO filas y el
    // recuento diria «no hay nada que borrar» sobre una base llena.
    await cli.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId])

    const inv = (await cli.query(SQL_INVENTARIO, [tenantId])).rows[0]
    const detalle = (
      await cli.query(
        `select e.razon_social, e.activo,
                coalesce((select count(*)::int from entidad_roles r
                           where r.entidad_id = e.id and r.tenant_id = $1::uuid), 0) as papeles
           from entidades_fiscales e
          where e.tenant_id = $1::uuid
          order by e.razon_social asc`,
        [tenantId],
      )
    ).rows

    console.log(`\nbase          ${base}`)
    console.log(`organizacion  ${o.org} (${orgs[0].nombre}) → ${tenantId}`)
    console.log('\nSE BORRARIA:')
    console.log(`  ${String(inv.entidades).padStart(4)} razones sociales`)
    for (const d of detalle) {
      console.log(
        `       · ${d.razon_social}${d.activo ? '' : '  (dada de baja)'}` +
          `  —  ${d.papeles} papel(es)`,
      )
    }
    console.log(`  ${String(inv.papeles).padStart(4)} filas de entidad_roles (se van por cascade)`)
    console.log('\nSE QUEDARIA SIN ASIGNAR (las filas NO se borran):')
    console.log(`  ${String(inv.contratos).padStart(4)} contratos de arrendamiento`)
    console.log(`  ${String(inv.comprobantes).padStart(4)} comprobantes`)
    console.log('\nNO SE TOCA: inventario, contratos, campanas, reservas, ordenes de trabajo,')
    console.log('            comprobantes, cobranzas ni recibos de luz.')

    if (!o.borrar) {
      await cli.query('rollback')
      console.log('\nsin --borrar: no se toco nada. Anade --borrar para ejecutarlo de verdad.')
      return 0
    }

    if (inv.entidades === 0) {
      await cli.query('rollback')
      console.log('\nno hay ninguna razon social: el cuestionario de bienvenida YA sale. Nada que hacer.')
      return 0
    }

    // Un solo `delete`. Las tres consecuencias —los papeles por cascade y las
    // dos asignaciones a NULL por `on delete set null (columna)`— las hace la
    // BASE, no este guion: replicarlas aquí a mano sería una segunda copia de
    // una regla que ya está escrita en el esquema, y el día que cambie una
    // divergirían sin dar error.
    const borradas = await cli.query('delete from entidades_fiscales where tenant_id = $1::uuid', [tenantId])
    const despues = (await cli.query(SQL_INVENTARIO, [tenantId])).rows[0]
    await cli.query('commit')

    console.log(`\nBORRADO: ${borradas.rowCount} razones sociales.`)
    console.log(
      `comprobacion tras el commit — entidades ${despues.entidades} · papeles ${despues.papeles} · ` +
        `contratos con entidad ${despues.contratos} · comprobantes con emisora ${despues.comprobantes}`,
    )
    if (despues.entidades !== 0) {
      console.error('ERROR: quedaron razones sociales. El cuestionario NO va a salir.')
      salida = 2
    } else {
      console.log('el cuestionario de bienvenida vuelve a salir en esta organizacion.')
      console.log(
        'para volver a dejarlas sembradas:\n' +
          `  node scripts/semilla-demo.mjs --org=${o.org} --trimestres=4`,
      )
    }
  } catch (e) {
    await cli.query('rollback').catch(() => {})
    console.error(`\nERROR reiniciar-razones-sociales: ${e.message}`)
    salida = 2
  } finally {
    await cli.end()
  }
  return salida
}

// Solo corre cuando se invoca como programa. `process.argv[1]` puede venir con
// separadores de Windows, así que se compara por el nombre del archivo.
if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('/reiniciar-razones-sociales.mjs')
) {
  main().then((c) => process.exit(c))
}
