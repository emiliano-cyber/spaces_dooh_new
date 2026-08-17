// ============================================================================
//  migrar.mjs — aplica las migraciones PENDIENTES, en orden, y las registra.
// ----------------------------------------------------------------------------
//  Uso:
//    DATABASE_URL=postgresql://usuario:clave@host:puerto/base node scripts/migrar.mjs
//    DATABASE_URL=...  node scripts/migrar.mjs --pendientes   # lista, no aplica
//    DATABASE_URL=...  node scripts/migrar.mjs --con-datos    # incluye @tipo: datos
//    DATABASE_URL=...  node scripts/migrar.mjs --instalacion-nueva
//                                       # la base acaba de nacer: no hay historia
//
//  Lo invoca `update.sh` en cada instancia. Sustituye al bucle de
//  `.github/workflows/deploy.yml:141-148`, que reaplica TODAS las migraciones en
//  cada despliegue y confía en que sean idempotentes: con un solo servidor y una
//  persona mirando funciona, pero no deja registro y hace imposible saber en qué
//  versión de esquema está un droplet sin ir a mirarlo.
//
//  Códigos de salida (los mira el `set -e` de update.sh, y solo eso):
//    0  nada que aplicar, o todo aplicado y registrado
//    1  no se puede ni empezar: falta DATABASE_URL, argumento desconocido, o no
//       se puede saber si la base es nueva o rezagada (ver el guard de abajo)
//    2  una migración falló (se nombra), o se aplicaron y no se pudieron
//       registrar
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

/** sha256 del contenido tal cual está en disco. */
export function checksumDe(contenido) {
  return createHash('sha256').update(contenido).digest('hex')
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

const USO = `uso: DATABASE_URL=postgresql://usuario:clave@host:puerto/base node scripts/migrar.mjs [--pendientes] [--con-datos] [--instalacion-nueva]
  --pendientes         lista lo que falta y NO aplica nada
  --con-datos          incluye también las migraciones marcadas "-- @tipo: datos"
  --instalacion-nueva  declara que la base acaba de nacer (rol de app + schema.sql
                       y nada más): sin registro y sin historia que respetar`

export async function main(argv = process.argv) {
  const args = argv.slice(2)
  const banderas = ['--pendientes', '--con-datos', '--instalacion-nueva']
  const desconocidos = args.filter((a) => !banderas.includes(a))
  if (desconocidos.length) {
    console.error(`ERROR migrar: argumento desconocido: ${desconocidos.join(' ')}\n${USO}`)
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
    // Y no se puede distinguir de una instalación recién nacida: después de
    // `schema.sql` las dos tienen el tenant 'rgb' (`db/schema.sql:598`) y
    // ninguna tiene registro. Las dos salidas equivocadas hacen daño en
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
          'Ojo con cruzarlos: aplicar 20260812_schema_migrations.sql a una instalacion\n' +
          'nueva daria por aplicadas 65 migraciones que nunca corrieron.',
      )
      return 1
    }

    if (hayRegistro && instalacionNueva) {
      // La bandera afirma un hecho, y el hecho es falso: esta base ya tiene
      // registro, o sea que no es nueva. Se para en vez de ignorarla, porque
      // quien la teclea cree estar hablando de otra base.
      console.error(
        'ERROR migrar: --instalacion-nueva sobre una base que YA tiene `schema_migrations`.\n' +
          'Esa bandera declara que la base acaba de nacer, y el registro dice que no.\n' +
          'Corre el comando SIN la bandera: aplicara solo lo pendiente.',
      )
      return 1
    }

    const aplicadas = hayRegistro
      ? new Set(
          (await cli.query('select archivo from schema_migrations')).rows.map((r) => r.archivo),
        )
      : new Set()

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
