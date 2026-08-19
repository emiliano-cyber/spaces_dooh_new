// ============================================================================
//  migrar.mjs — aplica las migraciones PENDIENTES, en orden, y las registra.
// ----------------------------------------------------------------------------
//  Uso:
//    DATABASE_URL=postgresql://usuario:clave@host:puerto/base node scripts/migrar.mjs
//    DATABASE_URL=...  node scripts/migrar.mjs --pendientes   # lista, no aplica
//    DATABASE_URL=...  node scripts/migrar.mjs --con-datos    # incluye @tipo: datos
//    DATABASE_URL=...  node scripts/migrar.mjs --instalacion-nueva
//                                       # la base acaba de nacer: no hay historia.
//                                       # Se comprueba: si la base la enseña, aborta
//    DATABASE_URL=...  node scripts/migrar.mjs --forzar-checksum=AAAAMMDD_x.sql
//                                       # ese archivo se reescribio a conciencia:
//                                       # acepta el contenido nuevo (repetible)
//
//  Lo invoca `update.sh` en cada instancia. Sustituye al bucle de
//  `.github/workflows/deploy.yml:141-148`, que reaplica TODAS las migraciones en
//  cada despliegue y confía en que sean idempotentes: con un solo servidor y una
//  persona mirando funciona, pero no deja registro y hace imposible saber en qué
//  versión de esquema está un droplet sin ir a mirarlo.
//
//  Códigos de salida (los mira el `set -e` de update.sh, y solo eso):
//    0  nada que aplicar, o todo aplicado y registrado
//    1  no se puede ni empezar: falta DATABASE_URL, argumento desconocido, no
//       se puede saber si la base es nueva o rezagada (ver el guard de abajo),
//       o una bandera afirma algo que la base desmiente (`--instalacion-nueva`
//       sobre una base con historia; `--forzar-checksum` sin nombre de archivo
//       o nombrando uno que no diverge)
//    2  una migración falló (se nombra), o se aplicaron y no se pudieron
//       registrar
//    3  el registro y la imagen NO cuentan la misma historia: una migración ya
//       aplicada tiene otro contenido en disco. Se nombra el archivo con los dos
//       checksums y no se aplica nada. Escape: `--forzar-checksum=<archivo>`
// ============================================================================
import pg from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// El directorio se resuelve desde el propio script y NO desde `process.cwd()`:
// en el droplet lo lanza `update.sh` desde donde le toque, y en la imagen las
// migraciones viven junto al esquema en `/app/db` (`Dockerfile:94-95`).
const AQUI = dirname(fileURLToPath(import.meta.url))
export const DIR_MIGRACIONES = join(AQUI, '..', 'db', 'migrations')
// El esquema base viaja al lado de las migraciones, tanto en el repo como en la
// imagen (`Dockerfile:94-95` copia los dos a `/app/db`). Se lee para DERIVAR la
// señal que verifica `--instalacion-nueva`; ver `testigosDeHistoria()`.
export const RUTA_ESQUEMA = join(AQUI, '..', 'db', 'schema.sql')

// ─── El orden, declarado UNA sola vez ──────────────────────────────────────
//
// Vive aquí y lo importa también el arnés de integración
// (`apps/web/lib/test/db-e2e.ts`), que antes tenía su propia copia. Dos copias
// divergen —el repo ya pagó esa lección— y aquí divergir significa que las
// pruebas apliquen en un orden y el droplet en otro, que es justo el escenario
// que ninguna prueba vería.
//
// El orden NO es lexicográfico puro. Las dos excepciones son reales y se
// corrigen aquí en vez de renombrar los archivos: renombrar migraciones ya
// aplicadas confunde a quien compare el repo con lo desplegado.
export const ANTES_DE = {
  // `..._rls_todas_tablas` comprueba que `usuarios` ya tenga RLS+FORCE, y eso
  // lo hace `..._usuarios_rls`, que por nombre va después (r < u).
  '20260720_hard1_usuarios_rls.sql': '20260720_hard1_rls_todas_tablas.sql',
  // `..._contrato_incompleto` USA el valor 'INCOMPLETO' del enum, y quien lo
  // añade es `..._contrato_incompleto_enum` — que va después porque '.' < '_'.
  '20260727_contrato_incompleto_enum.sql': '20260727_contrato_incompleto.sql',
}

/**
 * Orden de aplicación: lexicográfico (= cronológico, por el prefijo AAAAMMDD)
 * con las excepciones de `ANTES_DE`. No muta la lista recibida.
 * @param {string[]} archivos
 * @returns {string[]}
 */
export function ordenar(archivos) {
  const orden = [...archivos].sort()
  for (const [primero, segundo] of Object.entries(ANTES_DE)) {
    const i = orden.indexOf(primero)
    const j = orden.indexOf(segundo)
    if (i > -1 && j > -1 && i > j) {
      orden.splice(i, 1)
      orden.splice(orden.indexOf(segundo), 0, primero)
    }
  }
  return orden
}

/**
 * `esquema` o `datos`, según la CABECERA del archivo.
 *
 * Se mira la PRIMERA línea, no el contenido, y la diferencia no es teórica:
 * `20260812_schema_migrations.sql` menciona la cadena `-- @tipo: datos` en su
 * prosa (`:44` y `:168`) para explicar a quién deja fuera del backfill. Un
 * filtro por «el archivo contiene la marca» daría por de datos —y se saltaría,
 * en silencio— justo la migración que crea la tabla de registro.
 * @param {string} contenido
 * @returns {'esquema' | 'datos'}
 */
export function tipoDeMigracion(contenido) {
  const primera = contenido.split('\n', 1)[0]
  // `\uFEFF?` porque un BOM al principio del archivo desplazaría la marca un
  // carácter y el ancla `^` no vería nada, sin dar el menor error.
  return /^\uFEFF?--\s*@tipo:\s*datos/i.test(primera) ? 'datos' : 'esquema'
}

// ─── La señal que VERIFICA `--instalacion-nueva` ───────────────────────────
//
// La bandera afirma un hecho —«esta base acaba de nacer»— y un hecho afirmado
// que nadie comprueba es una heurística con otro nombre. Aquí se comprueba.
//
// La señal se DERIVA del repositorio en vez de escribirse a mano: `schema.sql`
// dice qué tablas trae una instalación recién nacida (es lo ÚNICO que se le
// aplica, junto al rol de app), y las migraciones dicen cuáles añaden ellas. La
// diferencia son tablas que en una base recién nacida no pueden existir; si
// alguna existe, la base tiene historia y la bandera miente.
//
// Se derivan TABLAS y solo tablas, a propósito. Los índices darían más
// resolución y también falsos positivos: un `constraint … unique` declarado
// dentro de un `create table` de `schema.sql` crea un índice con ese nombre sin
// que aparezca ningún `create index`, así que se derivaría como testigo y una
// instalación legítima quedaría rechazada — justo lo que la bandera existe para
// permitir. Un nombre de TABLA, en cambio, solo puede venir de un `create
// table`, y eso se lee igual de bien en los dos lados.
//
// Límite, dicho en voz alta: la primera migración que crea tabla propia es
// `20260716_doohmain_playlogs.sql`, así que una base parada ANTES de esa fecha
// es indistinguible de una nueva por este criterio. La ventana peligrosa
// —`[20260723, 20260807)`, donde reaplicar aborta a mitad— empieza en
// `20260723_almacen.sql` y queda cubierta entera. Lo ancla
// `scripts/migrar.test.ts`, que además lleva un canario para que la señal no
// pierda cobertura en silencio el día que una de esas tablas se renombre.

// `create table [if not exists] [public.]nombre`, anclado a principio de línea:
// así una línea comentada (`--   drop table if exists …`, el rollback de
// `20260812_schema_migrations.sql:234`) no entra.
const RE_CREATE_TABLE =
  /^[ \t]*create[ \t]+table[ \t]+(?:if[ \t]+not[ \t]+exists[ \t]+)?(?:public\.)?"?([a-zA-Z_][\w$]*)"?/gim

/**
 * Nombres de tabla que un `.sql` crea explícitamente.
 * @param {string} sql
 * @returns {Set<string>}
 */
export function tablasQueCrea(sql) {
  const nombres = new Set()
  for (const m of sql.matchAll(RE_CREATE_TABLE)) nombres.add(m[1].toLowerCase())
  return nombres
}

/**
 * Las tablas que solo pueden existir si ya corrieron migraciones: las que crea
 * alguna migración y `schema.sql` NO.
 *
 * Devuelve lista vacía si no hay ninguna derivable, y quien la use tiene que
 * tratar esa lista vacía como «no se puede verificar» y negarse. Ante la duda
 * no se aplica nada.
 *
 * @param {string} sqlEsquema contenido de `db/schema.sql`
 * @param {{archivo: string, contenido: string}[]} migraciones
 * @returns {{tabla: string, archivo: string}[]}
 */
export function testigosDeHistoria(sqlEsquema, migraciones) {
  const delEsquema = tablasQueCrea(sqlEsquema)
  const testigos = []
  const vistas = new Set()
  for (const m of migraciones) {
    for (const tabla of tablasQueCrea(m.contenido)) {
      if (delEsquema.has(tabla) || vistas.has(tabla)) continue
      vistas.add(tabla)
      testigos.push({ tabla, archivo: m.archivo })
    }
  }
  return testigos
}

/** sha256 del contenido tal cual está en disco. */
export function checksumDe(contenido) {
  return createHash('sha256').update(contenido).digest('hex')
}

// ─── Integridad de lo YA aplicado ──────────────────────────────────────────
//
// El registro guarda el sha256 de lo que se aplicó. Si el archivo que trae la
// imagen ya no es ese, el registro y la imagen no cuentan la misma historia: lo
// que se aplique encima parte de un estado que nadie sabe describir. La
// instancia se niega a actualizarse (salida 3) y nombra el archivo.
//
// El valor literal `'backfill'` NO es un checksum y las filas que lo llevan se
// saltan la comprobación a conciencia — así lo declara quien las escribe
// (`db/migrations/20260812_schema_migrations.sql:51-56`): son las migraciones
// aplicadas a mano antes del 2026-08-12, de las que nadie guardó el hash de
// origen. Inventarlo hoy afirmaría que lo aplicado coincide con lo que hay en
// disco, que es precisamente lo que no sabemos. Y no es un caso teórico: T-04
// editó dos de esos archivos para volver reaplicable la cadena, así que sin
// esta excepción el runner se negaría a actualizar TODA la flota.
export const MARCA_SIN_CHECKSUM = 'backfill'

/**
 * Migraciones registradas cuyo contenido en disco ya no es el que se aplicó.
 *
 * Solo mira las que están en los dos lados. Una fila registrada cuyo archivo NO
 * viaja en la imagen también es una discrepancia —y una que haría daño: sería
 * una instancia por delante de su propia imagen— pero queda FUERA de F3.3, que
 * es sobre contenido alterado; hacerla abortar aquí rechazaría de paso el día
 * que se retire una migración del repositorio, y eso merece su propia decisión.
 *
 * @param {Map<string,string>} registradas archivo → checksum guardado
 * @param {{archivo: string, checksum: string}[]} enDisco
 * @returns {{archivo: string, registrado: string, enDisco: string}[]}
 */
export function divergencias(registradas, enDisco) {
  const fuera = []
  for (const m of enDisco) {
    const registrado = registradas.get(m.archivo)
    if (registrado === undefined) continue // pendiente: no hay con qué comparar
    if (registrado === MARCA_SIN_CHECKSUM) continue
    if (registrado === m.checksum) continue
    fuera.push({ archivo: m.archivo, registrado, enDisco: m.checksum })
  }
  return fuera
}

/** Destino SIN credenciales: host/puerto/base. Esto se imprime; la URL no. */
export function destinoSeguro(u) {
  try {
    const x = new URL(u)
    return `${x.hostname}:${x.port || '5432'}${x.pathname}`
  } catch {
    return '(url no parseable)'
  }
}

/** Los .sql del directorio, ya en orden de aplicación, con tipo y checksum. */
export function leerMigraciones(dir = DIR_MIGRACIONES) {
  const archivos = ordenar(readdirSync(dir).filter((f) => f.endsWith('.sql')))
  return archivos.map((archivo) => {
    const contenido = readFileSync(join(dir, archivo), 'utf8')
    return { archivo, contenido, tipo: tipoDeMigracion(contenido), checksum: checksumDe(contenido) }
  })
}

async function tablaDeRegistroExiste(cli) {
  const { rows } = await cli.query("select to_regclass('public.schema_migrations') as t")
  return rows[0].t !== null
}

/**
 * ¿La base ya tiene historia? El criterio es el MISMO que usa el backfill de
 * `db/migrations/20260812_schema_migrations.sql:99-110`: existe `tenants` y
 * tiene filas. Se reutiliza a propósito en vez de inventar otro — si los dos
 * criterios divergieran, el runner y el backfill discreparían sobre qué es una
 * instancia nueva, y esa discrepancia no da error: deja un registro que miente.
 */
async function baseConHistoria(cli) {
  const { rows } = await cli.query("select to_regclass('public.tenants') as t")
  if (rows[0].t === null) return false
  const { rows: hay } = await cli.query('select exists (select 1 from tenants) as hay')
  return hay[0].hay
}

/**
 * Cuáles de esas tablas testigo existen de verdad en la base. Una sola basta
 * para desmentir `--instalacion-nueva`.
 */
async function testigosPresentes(cli, tablas) {
  const { rows } = await cli.query(
    `select t from unnest($1::text[]) as t
      where to_regclass('public.' || quote_ident(t)) is not null`,
    [tablas],
  )
  return rows.map((r) => r.t)
}

const FORZAR = '--forzar-checksum'

const USO = `uso: DATABASE_URL=postgresql://usuario:clave@host:puerto/base node scripts/migrar.mjs [--pendientes] [--con-datos] [--instalacion-nueva] [--forzar-checksum=<archivo>]
  --pendientes         lista lo que falta y NO aplica nada
  --con-datos          incluye también las migraciones marcadas "-- @tipo: datos"
  --instalacion-nueva  declara que la base acaba de nacer (rol de app + schema.sql
                       y nada más): sin registro y sin historia que respetar. Se
                       VERIFICA contra la base — si enseña historia, no aplica nada
  --forzar-checksum=<archivo>
                       acepta que ESE archivo se reescribió a conciencia: pone al
                       día su checksum registrado en vez de abortar. Se repite una
                       vez por archivo; no reaplica nada. Se VERIFICA: si el
                       archivo no diverge, se rechaza`

export async function main(argv = process.argv) {
  const args = argv.slice(2)
  const banderas = ['--pendientes', '--con-datos', '--instalacion-nueva']
  // `--forzar-checksum` EXIGE nombre de archivo, y eso es la decisión: una
  // bandera suelta desactivaría la comprobación entera —justo lo que existe para
  // impedir— y se quedaría puesta para siempre en el `update.sh` de alguien.
  // Nombrando el archivo, perdonar es una decisión sobre un archivo concreto y
  // el runner puede comprobarla, que es la lección que costó dos ciclos con
  // `--instalacion-nueva`.
  const forzados = []
  const desconocidos = []
  let forzarSinNombre = false
  for (const a of args) {
    if (banderas.includes(a)) continue
    if (a === FORZAR || a === `${FORZAR}=`) {
      forzarSinNombre = true
      continue
    }
    if (a.startsWith(`${FORZAR}=`)) {
      forzados.push(a.slice(FORZAR.length + 1).trim())
      continue
    }
    desconocidos.push(a)
  }
  if (desconocidos.length) {
    console.error(`ERROR migrar: argumento desconocido: ${desconocidos.join(' ')}\n${USO}`)
    return 1
  }
  if (forzarSinNombre) {
    console.error(
      `ERROR migrar: ${FORZAR} necesita el nombre del archivo: ${FORZAR}=AAAAMMDD_lo_que_sea.sql\n` +
        'Sin nombre perdonaria a bulto cualquier migracion alterada, presente y futura,\n' +
        'y esta bandera existe para lo contrario: aceptar UNA reescritura concreta,\n' +
        'hecha a conciencia, que el runner pueda comprobar. Repitela si son varias.\n' +
        `${USO}`,
    )
    return 1
  }
  const soloListar = args.includes('--pendientes')
  const conDatos = args.includes('--con-datos')
  const instalacionNueva = args.includes('--instalacion-nueva')

  // ─── El destino NO tiene valor por omisión, y es una decisión ────────────
  //
  // `scripts/apply-migration.mjs:16-24` sí lo tiene (entorno → .env → default
  // local) y aquí se hace distinto A PROPÓSITO. Ese default es
  // `postgresql://spaces:spaces@localhost:5433/spaces`: la base de DESARROLLO,
  // que tiene datos reales, y cuyo rol `spaces` es superusuario con BYPASSRLS.
  // Es exactamente lo que se le quitó a `bootstrap-auth.mjs`
  // (`apps/web/scripts/bootstrap-auth.mjs:10-22`), y aquí pesa más: aquel
  // sembraba filas, éste ejecuta DDL sobre la base que le pongan delante. Un
  // `node scripts/migrar.mjs` tecleado en el directorio equivocado no puede
  // acabar migrando la base del demo local.
  //
  // Quien lo invoca de verdad es `update.sh`, que le pasa la variable.
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error(
      'ERROR migrar: falta la variable DATABASE_URL.\n' +
        'Este script ejecuta DDL, asi que no adivina la base: tienes que decirle\n' +
        'explicitamente contra cual corre.\n' +
        '  bash:        DATABASE_URL=postgresql://usuario:clave@host:5432/base node scripts/migrar.mjs\n' +
        '  PowerShell:  $env:DATABASE_URL="postgresql://usuario:clave@host:5432/base"; node scripts/migrar.mjs\n' +
        'Ojo: la base "spaces" del 5433 tiene datos reales.',
    )
    return 1
  }

  const todas = leerMigraciones()
  const cli = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 8000 })
  console.log(`destino: ${destinoSeguro(DATABASE_URL)}`)

  try {
    await cli.connect()
  } catch (e) {
    console.error(`ERROR migrar: no se pudo conectar a ${destinoSeguro(DATABASE_URL)}: ${e.message}`)
    return 2
  }

  try {
    // ─── Sin registro NO significa «instancia nueva» ─────────────────────
    //
    // Esto es lo que este runner suponía y era exactamente al revés en el único
    // servidor que hoy existe: el droplet lleva meses con las migraciones
    // aplicadas A MANO y `schema_migrations` todavía sin crear, porque la crea
    // una migración escrita el 14/08 que nadie ha aplicado. Suponiendo «nueva»,
    // el runner le reaplicaba su historia entera.
    //
    // Y la heurística que se mira aquí —la del backfill: existe `tenants` y
    // tiene filas— es la que separa los dos casos. Hasta el 19/08 NO los
    // separaba, porque `schema.sql` sembraba el tenant 'rgb' y una instalación
    // recién nacida enseñaba organización igual que el droplet; desde que el
    // esquema nace sin owner, una base recién creada tiene `tenants` vacía y
    // este guard ya no le sale al paso. La pregunta explícita se queda de todas
    // formas —una heurística que hoy acierta no es una respuesta— y sigue
    // habiendo una segunda señal, la de `testigosDeHistoria()`, que es la que
    // VERIFICA la bandera más abajo. Las dos salidas equivocadas hacen daño en
    // silencio, por lados opuestos:
    //
    //   · tratar la rezagada como nueva → reaplica la historia. Hoy la cadena
    //     aguanta una segunda pasada (T-04), pero una base parada en la ventana
    //     [20260723, 20260807) aborta a mitad, y queda con migraciones
    //     aplicadas y CERO registradas — un estado que nadie sabe diagnosticar.
    //   · tratar la nueva como rezagada (aplicarle el backfill antes de nada) →
    //     da por aplicadas 65 migraciones que nunca corrieron, y `schema.sql` es
    //     un SUBCONJUNTO de lo desplegado (le faltan 143 columnas, medidas en
    //     `apps/web/lib/test/db-e2e.ts:107-112`). El esquema queda incompleto
    //     sin dar ni un error.
    //
    // Así que no se adivina: se para y se pregunta. Fail-closed.
    //
    // La tabla la sigue creando `20260812_schema_migrations.sql` — el runner no
    // duplica ese DDL aquí, porque una segunda copia es la forma de que las dos
    // dejen de coincidir.
    const hayRegistro = await tablaDeRegistroExiste(cli)

    if (!hayRegistro && !instalacionNueva && (await baseConHistoria(cli))) {
      console.error(
        'ERROR migrar: esta base no tiene `schema_migrations` pero YA tiene datos.\n' +
          'No se puede saber si es una instancia CON HISTORIA (aplicada a mano durante\n' +
          'meses, sin registro) o una instalacion RECIEN CREADA, y equivocarse no da\n' +
          'error, hace dano en silencio:\n' +
          '  · si es rezagada y aplico todo, le reaplico su historia entera;\n' +
          '  · si es nueva y doy la historia por aplicada, el esquema queda incompleto.\n' +
          'Asi que no lo adivino. Dime cual es:\n' +
          '  · Instancia CON historia (el droplet de hoy): aplicale primero el registro,\n' +
          '    que hace el backfill de lo ya aplicado, y repite este comando:\n' +
          '      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20260812_schema_migrations.sql\n' +
          '  · Instalacion RECIEN creada (rol de app + schema.sql y nada mas):\n' +
          '      node scripts/migrar.mjs --instalacion-nueva\n' +
          '    (la bandera NO se cree a ciegas: si la base ensena tablas que solo crean\n' +
          '     las migraciones, se niega y te lo dice)\n' +
          'Ojo con cruzarlos: aplicar 20260812_schema_migrations.sql a una instalacion\n' +
          'nueva daria por aplicadas 65 migraciones que nunca corrieron.',
      )
      return 1
    }

    // ─── La bandera afirma un hecho, y el hecho se COMPRUEBA ─────────────
    //
    // Las dos direcciones, porque las dos hacen daño y solo una estaba cerrada:
    //   · sobre una base CON registro, la bandera se contradice sola;
    //   · sobre una base con historia y sin registro —el droplet de hoy— la
    //     bandera se la creía a ciegas y le reaplicaba las 67 migraciones con
    //     salida 0. Y el mensaje del guard de arriba le pone al operador esa
    //     línea exacta para copiar, así que no es un caso rebuscado: es el
    //     siguiente comando que va a teclear.
    if (instalacionNueva) {
      if (hayRegistro) {
        console.error(
          'ERROR migrar: --instalacion-nueva sobre una base que YA tiene `schema_migrations`.\n' +
            'Esa bandera declara que la base acaba de nacer, y el registro dice que no.\n' +
            'Corre el comando SIN la bandera: aplicara solo lo pendiente.',
        )
        return 1
      }

      // Fail-closed en las tres formas de no poder verificar: sin esquema que
      // leer, sin señal derivable, o sin poder preguntárselo a la base. En
      // ninguna se aplica nada — una verificación que ante la duda deja pasar
      // no verifica, decora.
      let testigos
      try {
        testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), todas)
      } catch (e) {
        console.error(
          `ERROR migrar: --instalacion-nueva no se puede verificar sin ${RUTA_ESQUEMA}: ${e.message}\n` +
            'Esa bandera afirma que la base acaba de nacer y eso se comprueba comparando\n' +
            'las tablas de schema.sql con las que crean las migraciones. Sin el esquema no\n' +
            'hay con que comparar, asi que no se aplica nada.',
        )
        return 1
      }
      if (!testigos.length) {
        console.error(
          'ERROR migrar: --instalacion-nueva no se puede verificar: ninguna migracion crea\n' +
            'una tabla que schema.sql no cree ya, asi que no hay forma de ver si esta base\n' +
            'tiene historia. Antes de tocar nada, revisa scripts/migrar.test.ts (la senal\n' +
            'lleva un canario) y aplica el registro a mano si la instancia es rezagada.',
        )
        return 1
      }
      let presentes
      try {
        presentes = await testigosPresentes(
          cli,
          testigos.map((t) => t.tabla),
        )
      } catch (e) {
        console.error(
          `ERROR migrar: --instalacion-nueva no se pudo verificar contra la base: ${e.message}`,
        )
        return 1
      }
      if (presentes.length) {
        const porQuien = new Map(testigos.map((t) => [t.tabla, t.archivo]))
        console.error(
          'ERROR migrar: --instalacion-nueva sobre una base que SI tiene historia.\n' +
            'Esa bandera declara que la base acaba de nacer (rol de app + schema.sql y nada\n' +
            'mas), y estas tablas no las crea schema.sql: solo pueden estar ahi porque ya se\n' +
            'aplicaron migraciones.\n' +
            presentes.map((t) => `  · ${t}   (la crea ${porQuien.get(t)})`).join('\n') +
            '\nNo se aplico nada. Si es la instancia rezagada, aplicale primero el registro y\n' +
            'repite SIN la bandera:\n' +
            '  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20260812_schema_migrations.sql\n' +
            '  node scripts/migrar.mjs',
        )
        return 1
      }
      console.log(
        `--instalacion-nueva verificada: ninguna de las ${testigos.length} tablas que solo ` +
          'crean las migraciones existe en esta base.',
      )
    }

    const registradas = hayRegistro
      ? new Map(
          (await cli.query('select archivo, checksum from schema_migrations')).rows.map((r) => [
            r.archivo,
            r.checksum,
          ]),
        )
      : new Map()
    const aplicadas = new Set(registradas.keys())

    // ─── La historia de la base contra la de la imagen ───────────────────
    //
    // Va ANTES de todo lo demás —incluido `--pendientes`, que es la orden que se
    // teclea justo antes de actualizar— y antes de aplicar el primer archivo:
    // «aborta» tiene que significar sin tocar nada, no a mitad.
    const diferentes = divergencias(registradas, todas)

    // La bandera afirma que ESE archivo se reescribió a conciencia, y eso se
    // comprueba: si el archivo no diverge, o ni siquiera está registrado, quien
    // la teclea está hablando de otra cosa —o la dejó puesta de una vez
    // anterior, que es cómo un escape se vuelve un agujero permanente.
    const impostoras = forzados.filter((f) => !diferentes.some((d) => d.archivo === f))
    if (impostoras.length) {
      console.error(
        `ERROR migrar: ${FORZAR} nombra archivos que NO divergen:\n` +
          impostoras
            .map(
              (f) =>
                `  · ${f}   (${
                  !registradas.has(f)
                    ? 'no esta registrado en esta base'
                    : registradas.get(f) === MARCA_SIN_CHECKSUM
                      ? "registrado como 'backfill': ya se salta la comprobacion, no hay nada que forzar"
                      : 'su contenido en disco coincide con lo registrado'
                })`,
            )
            .join('\n') +
          `\nEsta bandera acepta una reescritura CONCRETA, no se deja puesta por si acaso:\n` +
          'mientras siga ahi, desactiva la comprobacion de ese archivo el dia que si\n' +
          'divergiera. Quitala y repite el comando. No se aplico nada.',
      )
      return 1
    }

    const perdonadas = new Set(forzados)
    const alarma = diferentes.filter((d) => !perdonadas.has(d.archivo))
    if (alarma.length) {
      console.error(
        'ERROR migrar: una migracion YA APLICADA tiene otro contenido en disco.\n' +
          'El registro de esta base y los archivos de esta imagen no cuentan la misma\n' +
          'historia, asi que nadie sabe describir el estado sobre el que se aplicaria lo\n' +
          'pendiente. NO se aplico nada.\n' +
          alarma
            .map(
              (d) =>
                `  · ${d.archivo}\n      registrado: ${d.registrado}\n      en disco:   ${d.enDisco}`,
            )
            .join('\n') +
          '\nQue hacer:\n' +
          '  · si la imagen es la equivocada (una version distinta de la que toca),\n' +
          '    actualizala y repite: el archivo volvera a ser el registrado;\n' +
          '  · si la migracion se reescribio A CONCIENCIA y esta base ya tiene aplicado\n' +
          '    lo que el archivo nuevo describe, aceptalo archivo por archivo:\n' +
          alarma.map((d) => `      node scripts/migrar.mjs ${FORZAR}=${d.archivo}`).join('\n') +
          '\n    (no reaplica nada: solo pone al dia lo que el registro AFIRMA)',
      )
      return 3
    }

    if (forzados.length) {
      for (const d of diferentes.filter((x) => perdonadas.has(x.archivo))) {
        if (soloListar) {
          console.log(
            `  ${FORZAR} ${d.archivo}: se pondria al dia ${d.registrado} -> ${d.enDisco} ` +
              '(nada se escribio: --pendientes solo lista)',
          )
          continue
        }
        // Se actualiza el checksum y NO `aplicada_en`: la fecha dice cuando se
        // aplico el archivo, y forzar el checksum no lo aplica. Refrescarla
        // borraria el unico dato que cuenta cuando se puso al dia la instancia.
        await cli.query('update schema_migrations set checksum = $1 where archivo = $2', [
          d.enDisco,
          d.archivo,
        ])
        console.log(
          `${FORZAR} aceptado para ${d.archivo}: el registro pasa de ${d.registrado} a ` +
            `${d.enDisco}. El archivo NO se reaplica —la base conserva lo que se le aplico en ` +
            'su dia—; lo que cambia es lo que el registro afirma sobre el.',
        )
      }
    }

    const pendientes = todas.filter((m) => !aplicadas.has(m.archivo))
    const deDatos = pendientes.filter((m) => m.tipo === 'datos')
    const aAplicar = conDatos ? pendientes : pendientes.filter((m) => m.tipo === 'esquema')

    if (soloListar) {
      for (const m of pendientes) console.log(`  pendiente [${m.tipo}]  ${m.archivo}`)
      console.log(
        `${pendientes.length} pendientes (${pendientes.length - deDatos.length} de esquema, ` +
          `${deDatos.length} de datos). Aplicadas: ${aplicadas.size}. Nada se aplico: --pendientes solo lista.`,
      )
      return 0
    }

    // Las de datos reescriben filas y no se deshacen solas, así que se piden a
    // mano — mismo criterio que `deploy.yml:151-159`. Pero se NOMBRAN: una
    // migración que no se aplica y que nadie menciona es una que se olvida.
    if (!conDatos) {
      for (const m of deDatos) {
        console.log(`  omitida (migracion de DATOS, pidela con --con-datos): ${m.archivo}`)
      }
    }

    // Registrar en cuanto se pueda, y no antes. En una instalación nueva la
    // tabla no existe hasta que se aplica `20260812_schema_migrations.sql`, que
    // va en mitad de la lista; lo aplicado antes se guarda aquí y se vuelca en
    // cuanto la tabla aparece.
    const porRegistrar = []
    let hayTabla = hayRegistro

    async function volcarRegistro() {
      while (porRegistrar.length) {
        const m = porRegistrar[0]
        await cli.query(
          `insert into schema_migrations (archivo, checksum, tipo) values ($1, $2, $3)
             on conflict (archivo) do update
               set checksum = excluded.checksum, aplicada_en = now()`,
          [m.archivo, m.checksum, m.tipo],
        )
        porRegistrar.shift()
      }
    }

    let aplicadasAhora = 0
    for (const m of aAplicar) {
      console.log(`== ${m.archivo}`)
      try {
        // El archivo trae su propia transacción (`begin; … commit;`), así que
        // NO se envuelve en otra: un `begin` dentro de un bloque ya abierto
        // avisa y no anida, y el `commit` del archivo cerraría el bloque de
        // fuera. Las que no la traen viajan igual en una sola sentencia simple,
        // que Postgres ejecuta en su transacción implícita. En los dos casos, si
        // el archivo falla no queda aplicado a medias.
        await cli.query(m.contenido)
      } catch (e) {
        // Se nombra el archivo: sin esto el error de Postgres llega sin decir
        // cuál de las 68 lo provocó. Y se sale ANTES de registrar nada: el
        // registro solo contiene hechos.
        await cli.query('rollback').catch(() => {})
        console.error(`ERROR migrar: fallo la migracion ${m.archivo}: ${e.message}`)
        console.error(`  ${aplicadasAhora} aplicadas antes del fallo. Abortado sin registrar esta.`)
        return 2
      }
      porRegistrar.push(m)
      aplicadasAhora++
      if (!hayTabla) hayTabla = await tablaDeRegistroExiste(cli)
      if (hayTabla) {
        try {
          await volcarRegistro()
        } catch (e) {
          // El insert del registro también puede fallar (permisos sobre la
          // tabla, disco, una réplica en solo lectura), y este era el único
          // camino que se escapaba de `main()`: sin este catch, el error salía
          // como excepción no capturada, o sea código 1 —«no se pudo ni
          // empezar»— y un volcado de pila, sobre una base que SÍ cambió. El
          // contrato de arriba dice 2, y 2 es lo que un `set -e` necesita
          // distinguir para saber si hay que ir a mirar esa base.
          console.error(
            `ERROR migrar: se aplicaron ${aplicadasAhora} migraciones y no se pudieron ` +
              `registrar: ${e.message}`,
          )
          console.error(`  sin registrar: ${porRegistrar.map((x) => x.archivo).join(', ')}`)
          console.error(
            '  la base SI cambio. La proxima corrida las daria por pendientes y las reaplicaria.',
          )
          return 2
        }
      }
    }

    if (porRegistrar.length) {
      // Solo puede pasar si `20260812_schema_migrations.sql` no está en el
      // directorio. Se aplicó todo pero no consta, y la próxima corrida lo
      // reaplicaría entero: eso se dice en voz alta, no se deja pasar.
      console.error(
        `ERROR migrar: se aplicaron ${porRegistrar.length} migraciones y no se pudieron registrar: ` +
          'falta `schema_migrations` (la crea 20260812_schema_migrations.sql).',
      )
      return 2
    }

    console.log(
      `${aplicadasAhora} aplicadas${deDatos.length && !conDatos ? `, ${deDatos.length} de datos pendientes` : ''}.`,
    )
    return 0
  } finally {
    await cli.end().catch(() => {})
  }
}

// Solo cuando se ejecuta como programa: el arnés de pruebas y `db-e2e.ts`
// importan `ordenar()` y no deben abrir ninguna conexión al hacerlo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
