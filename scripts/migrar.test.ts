import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ordenar,
  tipoDeMigracion,
  ANTES_DE,
  tablasQueCrea,
  testigosDeHistoria,
  destinoSeguro,
  versionMinimaDeMigracion,
  versionMayor,
  versionLegible,
  migracionesQueExigenMas,
  mensajeVersionInsuficiente,
} from './migrar.mjs'

// ============================================================================
//  La parte PURA del runner de migraciones: el orden y el tipo.
// ----------------------------------------------------------------------------
//  Son las dos decisiones que el runner toma ANTES de tocar la base, y las dos
//  que, si se equivocan, no dan error: aplican en un orden que no levanta, o se
//  saltan un archivo en silencio. Por eso se prueban aquí, sin Postgres.
//
//  Se corren desde `apps/web` (`npm test`): el include de
//  `apps/web/vitest.config.ts` alcanza `../../scripts/**/*.test.ts` a propósito.
//  Un fichero de pruebas que no corre nadie es peor que no tenerlo.
// ============================================================================

const DIR_MIGRACIONES = join(__dirname, '..', 'db', 'migrations')

describe('ordenar()', () => {
  it('respeta las dos excepciones reales del repo', () => {
    // El orden NO es lexicográfico puro, y no es un capricho:
    //   · `..._rls_todas_tablas` comprueba que `usuarios` ya tenga RLS+FORCE, y
    //     eso lo hace `..._usuarios_rls`, que por nombre va DESPUÉS (r < u).
    //   · `..._contrato_incompleto` USA el valor 'INCOMPLETO' del enum, y quien
    //     lo añade es `..._contrato_incompleto_enum`, que va después ('.' < '_').
    // En producción se aplicaron a mano en el orden bueno y el desorden nunca se
    // notó. Una base nueva sí lo nota: no levanta.
    const ordenados = ordenar([
      '20260720_hard1_rls_todas_tablas.sql',
      '20260720_hard1_usuarios_rls.sql',
      '20260727_contrato_incompleto.sql',
      '20260727_contrato_incompleto_enum.sql',
    ])
    expect(ordenados.indexOf('20260720_hard1_usuarios_rls.sql')).toBeLessThan(
      ordenados.indexOf('20260720_hard1_rls_todas_tablas.sql'),
    )
    expect(ordenados.indexOf('20260727_contrato_incompleto_enum.sql')).toBeLessThan(
      ordenados.indexOf('20260727_contrato_incompleto.sql'),
    )
  })

  it('sobre el directorio real mantiene las dos excepciones y no pierde archivos', () => {
    // Contra el directorio de verdad, no contra una lista escrita aquí: si
    // mañana entra una migración nueva, esta prueba la incluye sola.
    const archivos = readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith('.sql'))
    const ordenados = ordenar(archivos)
    expect(ordenados.length).toBe(archivos.length)
    expect([...ordenados].sort()).toEqual([...archivos].sort())
    for (const [primero, segundo] of Object.entries(ANTES_DE)) {
      expect(ordenados.indexOf(primero)).toBeLessThan(ordenados.indexOf(segundo))
    }
  })

  it('no muta el array que recibe', () => {
    // `ordenar()` la llaman el runner y el arnés de e2e sobre listas que luego
    // reusan. Un `sort()` in situ ahí es de los fallos que aparecen lejos.
    const entrada = ['20260720_hard1_rls_todas_tablas.sql', '20260720_hard1_usuarios_rls.sql']
    const copia = [...entrada]
    ordenar(entrada)
    expect(entrada).toEqual(copia)
  })

  it('el resto va en orden lexicográfico, que es el cronológico', () => {
    expect(ordenar(['20260810_b.sql', '20260625_a.sql', '20260729_c.sql'])).toEqual([
      '20260625_a.sql',
      '20260729_c.sql',
      '20260810_b.sql',
    ])
  })
})

describe('tipoDeMigracion()', () => {
  it('lee la CABECERA, no el cuerpo: la marca es la primera línea', () => {
    // La trampa concreta, y está en el repo: `20260812_schema_migrations.sql`
    // MENCIONA la cadena `-- @tipo: datos` en su prosa (`:44` y `:168`) para
    // explicar por qué deja fuera del backfill a la migración de datos. Un
    // filtro por «el archivo contiene @tipo: datos» daría esa migración por de
    // datos y se saltaría, en silencio, justo la que crea la tabla de registro.
    const datos = readFileSync(join(DIR_MIGRACIONES, '20260731_calendario_meses_cortos.sql'), 'utf8')
    const registro = readFileSync(join(DIR_MIGRACIONES, '20260812_schema_migrations.sql'), 'utf8')
    expect(datos).toMatch(/@tipo: *datos/)
    expect(registro).toMatch(/@tipo: *datos/) // la menciona, pero en prosa
    expect(tipoDeMigracion(datos)).toBe('datos')
    expect(tipoDeMigracion(registro)).toBe('esquema')
  })

  it('una migración sin marca es de esquema', () => {
    expect(tipoDeMigracion('alter table sitios add column if not exists x int;\n')).toBe('esquema')
  })

  it('acepta la marca con espacios y mayúsculas, como el grep del despliegue', () => {
    // `deploy.yml:141-148` usa `grep -qiE '^-- *@tipo: *datos'`. Mismo criterio,
    // para que runner y despliegue no discrepen sobre qué es una migración de
    // datos mientras los dos convivan.
    expect(tipoDeMigracion('--   @TIPO:  datos\nupdate x set y = 1;\n')).toBe('datos')
  })

  it('la marca en una línea que no es la primera NO cuenta', () => {
    expect(tipoDeMigracion('begin;\n-- @tipo: datos\ncommit;\n')).toBe('esquema')
  })
})

// ============================================================================
//  La señal que VERIFICA `--instalacion-nueva`.
// ----------------------------------------------------------------------------
//  La bandera afirma un hecho —«esta base acaba de nacer»— y hasta ahora nadie
//  comprobaba que fuera verdad en la dirección peligrosa: sobre el droplet de
//  hoy (historia aplicada a mano, sin registro) el runner se la creía y le
//  reaplicaba las 67 migraciones.
//
//  La señal se DERIVA del repositorio en vez de escribirse a mano: las tablas
//  que crean las migraciones y que `db/schema.sql` NO crea. Una instalación
//  recién nacida es rol de app + `schema.sql` y nada más, así que ninguna de
//  esas tablas puede existir en ella; si existe alguna, la base tiene historia.
//
//  Estas pruebas son el aviso de caducidad de esa señal. Si se derivara a cero
//  el runner se niega (fail-closed) y nadie se enteraría del porqué; aquí sí.
// ============================================================================

const RUTA_ESQUEMA = join(__dirname, '..', 'db', 'schema.sql')

function migracionesDelRepo() {
  return readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((archivo) => ({
      archivo,
      contenido: readFileSync(join(DIR_MIGRACIONES, archivo), 'utf8'),
    }))
}

describe('tablasQueCrea()', () => {
  it('lee los `create table`, con o sin `if not exists` y con o sin `public.`', () => {
    const sql = [
      'create table usuarios (',
      'create table if not exists almacen_activos (',
      'CREATE TABLE public."comillada" (',
    ].join('\n')
    expect([...tablasQueCrea(sql)].sort()).toEqual(['almacen_activos', 'comillada', 'usuarios'])
  })

  it('no se traga un `create table` comentado ni un `drop table`', () => {
    // `20260812_schema_migrations.sql:234` lleva `--   drop table if exists
    // schema_migrations;` como rollback comentado. Un parser que lo contara
    // daría por testigo una tabla que ese archivo NO crea.
    const sql = '--   drop table if exists schema_migrations;\n-- create table fantasma (\n'
    expect([...tablasQueCrea(sql)]).toEqual([])
  })

  it('solo mira TABLAS: un índice o un tipo con ese nombre no cuenta', () => {
    // Es la razón de que la señal sean tablas y no índices. Un índice puede
    // nacer de un `constraint … unique` declarado dentro del `create table` de
    // `schema.sql`, con el MISMO nombre y sin un `create index` que lo delate:
    // se derivaría como testigo y una instalación legítima sería rechazada.
    // Con las tablas eso no pasa — un nombre de tabla solo llega de un
    // `create table`.
    const sql = 'create index almacen_activos on x(y);\ncreate type est_activo as enum (\'A\');\n'
    expect([...tablasQueCrea(sql)]).toEqual([])
  })
})

describe('testigosDeHistoria()', () => {
  it('una tabla que también crea schema.sql NO es testigo', () => {
    // `folios_consecutivos` está en los dos sitios (`schema.sql:95` y
    // `20260804_folios_consecutivos.sql:26`): existe en una instalación recién
    // nacida, así que no prueba nada.
    const testigos = testigosDeHistoria('create table folios_consecutivos (\n', [
      { archivo: '20260804_folios_consecutivos.sql', contenido: 'create table if not exists folios_consecutivos (\n' },
      { archivo: '20260723_almacen.sql', contenido: 'create table if not exists almacen_activos (\n' },
    ])
    expect(testigos).toEqual([{ tabla: 'almacen_activos', archivo: '20260723_almacen.sql' }])
  })

  it('sin testigos derivables devuelve lista vacía — y el runner se niega', () => {
    // El caso fail-closed: si `schema.sql` acabara creándolas todas, la señal
    // deja de separar nada. La lista vacía es lo que el runner mira para
    // negarse en vez de creerse la bandera a ciegas.
    expect(testigosDeHistoria('create table sitios (\n', [])).toEqual([])
  })

  it('sobre el repo real la señal existe y es amplia', () => {
    const testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), migracionesDelRepo())
    expect(testigos.length).toBeGreaterThanOrEqual(10)
    // Ninguna de ellas puede estar en `schema.sql`: es la definición misma de
    // testigo, y comprobarlo aquí atrapa un parser que lea mal cualquiera de
    // los dos lados.
    const esquema = readFileSync(RUTA_ESQUEMA, 'utf8')
    for (const t of testigos) {
      expect([...tablasQueCrea(esquema)]).not.toContain(t.tabla)
    }
  })

  it('CANARIO: `almacen_activos` sigue siendo testigo — si esto cae, la señal caducó', () => {
    // Escrito a mano a propósito, y es lo ÚNICO escrito a mano de toda la
    // señal. El runner no cablea este nombre: lo deriva. Pero si algún día
    // `almacen_activos` se renombra, se retira o entra en `schema.sql`, la
    // señal pierde cobertura EN SILENCIO — y este caso rojo es el aviso.
    // Quien lo vea: revisar que sigan quedando testigos suficientes y volver a
    // elegir el canario, no borrar la prueba.
    const testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), migracionesDelRepo())
    expect(testigos).toContainEqual({ tabla: 'almacen_activos', archivo: '20260723_almacen.sql' })
  })

  it('la señal cubre la ventana [20260723, 20260807) desde su PRIMER archivo', () => {
    // Es la ventana en la que reaplicar la historia aborta a mitad y deja la
    // base con migraciones aplicadas y cero registradas. Empieza justo en
    // `20260723_almacen.sql`, que es testigo: cualquier base parada dentro de
    // esa ventana enseña historia y el runner la rechaza.
    //
    // Lo que la señal NO cubre, dicho en voz alta: una base parada ANTES de
    // `20260716_doohmain_playlogs.sql` —la primera migración que crea una tabla
    // propia— es indistinguible de una recién nacida por este criterio. Ninguna
    // instancia real está ahí (el droplet va por 20260810) y la ventana
    // peligrosa queda entera dentro de la cobertura.
    const testigos = testigosDeHistoria(readFileSync(RUTA_ESQUEMA, 'utf8'), migracionesDelRepo())
    const primero = testigos.map((t) => t.archivo).sort()[0]
    expect(primero < '20260723').toBe(true)
    expect(testigos.some((t) => t.archivo >= '20260723' && t.archivo < '20260807')).toBe(true)
  })
})

// ============================================================================
//  `destinoSeguro()` — el mensaje que el runner imprime antes de conectar.
// ----------------------------------------------------------------------------
//  Defecto ③ del arranque del PADRE (2026-08-21). La URL del paso 4 del runbook
//  no servía —el runner corre como root y `peer` rechaza al usuario `postgres`—
//  y en vez de decirlo, el runner contestó `destino: (url no parseable)`. El
//  problema real no se vio hasta media línea después.
//
//  «No parseable» es verdad y no sirve de nada: no dice qué esperaba ni qué
//  recibió. Y es la ÚLTIMA línea que se lee antes de un error de conexión, o
//  sea justo donde alguien va a buscar la causa.
//
//  Lo que NO puede hacer el arreglo: imprimir la cadena. Esta función existe
//  para que la URL —con su contraseña dentro— no salga nunca por el log, y en
//  este proyecto un fragmento de credencial en un log es criterio invalidante
//  (M2). Por eso la prueba comprueba las dos cosas a la vez.
// ============================================================================
describe('destinoSeguro()', () => {
  it('de una URL normal saca host, puerto y base — y NUNCA la contraseña', () => {
    const d = destinoSeguro('postgresql://spaces_app:secreto@10.0.0.5:5432/spaces_demo')
    expect(d).toBe('10.0.0.5:5432/spaces_demo')
    expect(d).not.toMatch(/secreto/)
  })

  it('supone el 5432 cuando la URL no trae puerto', () => {
    expect(destinoSeguro('postgresql://u:c@localhost/base')).toBe('localhost:5432/base')
  })

  it('ante algo que no es una URL, DICE qué esperaba', () => {
    // El caso real del 21/08: una cadena `clave=valor` de libpq.
    const d = destinoSeguro('host=/var/run/postgresql dbname=spaces_prod user=postgres')
    expect(d).toMatch(/no tiene forma de URL/i)
    expect(d).toMatch(/postgresql:\/\//)
  })

  it('y sigue sin filtrar nada de lo que recibió', () => {
    const d = destinoSeguro('host=/var/run/postgresql dbname=spaces_prod password=secreto')
    expect(d).not.toMatch(/secreto/)
    expect(d).not.toMatch(/spaces_prod/)
    expect(d).not.toMatch(/var\/run/)
  })
})

// ============================================================================
//  La version de PostgreSQL que una migracion EXIGE — `-- @pg-min: N`.
// ----------------------------------------------------------------------------
//  El incidente que la motiva, medido el 2026-09-23 en `g500` —la unica
//  instancia con datos reales—: al subirla de `v0.5.1` a `v0.7.0` el runner
//  aplico TRES migraciones y murio en la cuarta con
//
//      syntax error at or near "("
//
//  Ese parentesis es la LISTA DE COLUMNAS de
//  `20260918_entidad_tenant_compuesto.sql:139` y `:171`
//  (`on delete set null (entidad_id)`), que existe desde PostgreSQL 15. `g500`
//  corre 14.24; el PADRE y DEMO corren 16.15, asi que ahi nunca fallo y nadie
//  lo vio venir.
//
//  El dano NO fue el fallo: fue el MOMENTO del fallo. Tres migraciones ya
//  aplicadas, la base a medio migrar y el despliegue abortado. Con este guard
//  no se habria aplicado ninguna, que es la unica diferencia que importa.
//
//  La anotacion sigue la convencion que ya existe (`-- @tipo: datos`,
//  `migrar.mjs:7`) en vez de inventar otra, y vive en la CABECERA de
//  anotaciones: el bloque de lineas `-- @clave: valor` con las que empieza el
//  archivo. Se para en la primera linea que no lo es, y eso no es un detalle —
//  es lo que impide que una mencion en prosa cuente como declaracion, que es el
//  fallo exacto que `tipoDeMigracion()` documenta en su cabecera.
// ============================================================================

describe('versionMinimaDeMigracion()', () => {
  it('lee la anotacion cuando es la primera linea', () => {
    expect(versionMinimaDeMigracion('-- @pg-min: 15\nalter table x add column y int;\n')).toBe(15)
  })

  it('convive con `@tipo: datos`: las dos anotaciones caben en la misma cabecera', () => {
    // No son excluyentes y nada garantiza que no coincidan manana: una
    // migracion de datos puede usar sintaxis nueva igual que una de esquema.
    // Si la convencion fuera «solo la primera linea» habria que elegir una.
    const sql = '-- @tipo: datos\n-- @pg-min: 15\nupdate x set y = 1;\n'
    expect(tipoDeMigracion(sql)).toBe('datos')
    expect(versionMinimaDeMigracion(sql)).toBe(15)
  })

  it('una migracion SIN anotacion no exige nada', () => {
    expect(versionMinimaDeMigracion('alter table sitios add column if not exists x int;\n')).toBe(
      null,
    )
  })

  it('una mencion en PROSA no cuenta: la cabecera acaba en la primera linea que no es anotacion', () => {
    // La trampa real del repositorio, y ya cobro una vez con `@tipo`:
    // `20260812_schema_migrations.sql` MENCIONA `-- @tipo: datos` en su prosa
    // (`:44` y `:168`). Aqui pasaria lo mismo al reves y seria peor: una
    // migracion que solo HABLA de la version minima quedaria declarada como si
    // la exigiera, y el guard bloquearia una actualizacion que si podia correr.
    const sql = [
      '-- ============================================================',
      '--  Prosa larga explicando la migracion.',
      '--  Aqui se menciona `-- @pg-min: 15` para explicar por que NO se usa.',
      '-- ============================================================',
      'alter table x add column y int;',
    ].join('\n')
    expect(versionMinimaDeMigracion(sql)).toBe(null)
  })

  it('y tampoco cuenta una anotacion LITERAL enterrada en el cuerpo', () => {
    // El caso de arriba es suave: la mencion va dentro de una frase y ni siquiera
    // empieza la linea. Este es el que muerde, y no es rebuscado — las
    // migraciones de este repositorio escriben su ROLLBACK como un bloque de
    // comentarios para copiar y pegar (`20260812_schema_migrations.sql:234`), asi
    // que una linea que empieza exactamente por `-- @pg-min:` puede acabar
    // enterrada en cualquier sitio. Si se leyera el archivo entero en vez de la
    // cabecera, esa linea declararia por todo el archivo y el guard bloquearia
    // una actualizacion que si podia correr.
    const sql = [
      '-- ============================================================',
      '--  Migracion que corre en cualquier version.',
      '-- ============================================================',
      'alter table x add column y int;',
      '',
      '-- Rollback, para copiar y pegar:',
      '--   alter table x drop column y;',
      '-- (la variante compuesta de esta clave, que si lo exigiria, llevaria:)',
      '-- @pg-min: 15',
    ].join('\n')
    expect(versionMinimaDeMigracion(sql)).toBe(null)
  })

  it('acepta espacios, mayusculas y un BOM delante, como `@tipo`', () => {
    // El BOM por el mismo motivo que `tipoDeMigracion()`: desplaza la marca un
    // caracter y el ancla `^` deja de verla, sin dar el menor error.
    expect(versionMinimaDeMigracion('﻿--   @PG-MIN:  16\nselect 1;\n')).toBe(16)
  })

  it('tolera CRLF — el arbol de esta maquina lo tiene', () => {
    // 30 de 86 migraciones estaban en CRLF el 21/09 en un arbol que `git
    // status` daba por limpio. Una anotacion que solo se leyera con LF seria
    // invisible justo en las maquinas donde ese problema ya muerde.
    expect(versionMinimaDeMigracion('-- @pg-min: 15\r\nselect 1;\r\n')).toBe(15)
  })
})

describe('versionMayor() y versionLegible()', () => {
  it('traducen `server_version_num` a lo que dice una persona', () => {
    // Se compara el entero y no el texto de `version()` a proposito: `version()`
    // devuelve una frase entera («PostgreSQL 14.24 on x86_64-pc-linux-musl…»)
    // que hay que parsear, y parsear una frase para decidir si se aplica DDL es
    // como se cuelan los fallos que nadie ve.
    expect(versionMayor(140024)).toBe(14) // g500, medido el 2026-09-23
    expect(versionMayor(160015)).toBe(16) // PADRE y DEMO
    expect(versionLegible(140024)).toBe('14.24')
    expect(versionLegible(160015)).toBe('16.15')
  })
})

describe('migracionesQueExigenMas()', () => {
  const pendientes = [
    { archivo: '20260917_entidades_fiscales.sql', contenido: 'alter table x add column y int;\n' },
    { archivo: '20260918_consumos_energia.sql', contenido: 'create table z (a int);\n' },
    {
      archivo: '20260918_entidad_tenant_compuesto.sql',
      contenido: '-- @pg-min: 15\nalter table x add constraint c foreign key (a) references b (a);\n',
    },
  ]

  it('con PostgreSQL 14 senala la que exige mas, y solo esa', () => {
    const bloqueantes = migracionesQueExigenMas(pendientes, 140024)
    expect(bloqueantes).toEqual([{ archivo: '20260918_entidad_tenant_compuesto.sql', exige: 15 }])
  })

  it('con version SUFICIENTE no bloquea nada — el guard no cambia lo que hoy funciona', () => {
    // Es la prueba que de verdad importa. El PADRE, DEMO, el 5433 y el arnes de
    // integracion corren 15 o mas: si este guard alterara su comportamiento,
    // habria cambiado la flota entera para arreglar una sola maquina.
    expect(migracionesQueExigenMas(pendientes, 160015)).toEqual([])
    expect(migracionesQueExigenMas(pendientes, 150000)).toEqual([])
  })

  it('una migracion sin anotacion NUNCA bloquea, ni contra un motor antiguo', () => {
    // 87 de las 88 migraciones del repositorio no llevan anotacion. Si la
    // ausencia significara «exige lo ultimo», este guard pararia la flota
    // entera el dia que alguien corriera un motor viejo.
    const sinAnotar = pendientes.slice(0, 2)
    expect(migracionesQueExigenMas(sinAnotar, 90604)).toEqual([])
  })

  it('sobre una lista vacia no inventa nada', () => {
    expect(migracionesQueExigenMas([], 140024)).toEqual([])
  })
})

describe('mensajeVersionInsuficiente()', () => {
  // El liston es explicito: tiene que servirle a alguien a las tres de la
  // manana. El mensaje que salio hoy en g500 fue `syntax error at or near "("`,
  // que no dice ni que migracion, ni que version pide, ni cual hay, ni si la
  // base quedo tocada.
  // Se construye DENTRO de cada prueba y no en el cuerpo del `describe`: ahi
  // arriba, el dia que la funcion no exista o reviente, se cae la recoleccion
  // del archivo entero y las otras veinte pruebas desaparecen del informe en
  // vez de fallar una.
  const texto = () =>
    mensajeVersionInsuficiente([{ archivo: '20260918_entidad_tenant_compuesto.sql', exige: 15 }], 140024)

  it('nombra la migracion, lo que pide y lo que hay', () => {
    expect(texto()).toContain('20260918_entidad_tenant_compuesto.sql')
    expect(texto()).toMatch(/PostgreSQL 15/)
    expect(texto()).toContain('14.24')
  })

  it('dice en voz alta que NO se aplico ninguna', () => {
    // Lo primero que necesita saber quien lee esto de madrugada no es que
    // migracion fallo: es si tiene que ir a mirar la base.
    expect(texto()).toMatch(/ninguna/i)
  })

  it('no filtra la URL ni credenciales', () => {
    expect(texto()).not.toMatch(/postgresql:\/\//)
  })
})

// ============================================================================
//  El canario: sintaxis de PostgreSQL 15+ sin declarar.
// ----------------------------------------------------------------------------
//  Esta es la prueba que habria cazado el incidente del 2026-09-23 antes de
//  salir del repositorio. Recorre TODAS las migraciones —no una lista escrita
//  aqui, que caduca— y exige que la que usa sintaxis nueva lo declare.
//
//  Se comparan los archivos SIN comentarios a proposito:
//  `20260918_consumos_energia.sql:121` menciona `nulls not distinct` en su prosa
//  justo para explicar por que NO lo usa. Contar esa mencion obligaria a anotar
//  una migracion que corre perfectamente en PostgreSQL 14.
//
//  Limite dicho en voz alta: quitar comentarios con una expresion regular no
//  entiende de literales de cadena, asi que un `--` dentro de una cadena
//  cortaria la linea antes de tiempo. Hoy no ocurre en ninguna de las 88; si un
//  dia ocurre, el efecto es un falso NEGATIVO (deja pasar), no un falso
//  positivo que pararia la flota.
// ============================================================================

const SINTAXIS_PG15 = [
  // `on delete set null (columna)` — la lista de columnas en la accion
  // referencial. PostgreSQL 15. Es la que rompio g500.
  {
    patron: /on\s+delete\s+set\s+(?:null|default)\s*\(/i,
    desde: 15,
    nombre: 'on delete set null/default (columnas)',
  },
  { patron: /nulls\s+not\s+distinct/i, desde: 15, nombre: 'nulls not distinct' },
  { patron: /^\s*merge\s+into\b/im, desde: 15, nombre: 'merge into' },
  { patron: /security_invoker/i, desde: 15, nombre: 'security_invoker' },
]

function sinComentarios(sql: string): string {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
}

describe('canario: toda migracion con sintaxis de PostgreSQL 15+ la DECLARA', () => {
  it('ninguna usa sintaxis nueva sin `-- @pg-min`', () => {
    const sinDeclarar: string[] = []
    for (const archivo of readdirSync(DIR_MIGRACIONES).filter((f) => f.endsWith('.sql'))) {
      const contenido = readFileSync(join(DIR_MIGRACIONES, archivo), 'utf8')
      const codigo = sinComentarios(contenido)
      for (const s of SINTAXIS_PG15) {
        if (!s.patron.test(codigo)) continue
        const exige = versionMinimaDeMigracion(contenido)
        if (exige === null || exige < s.desde) {
          sinDeclarar.push(
            `${archivo} usa «${s.nombre}» (PostgreSQL ${s.desde}+) y declara ${exige}`,
          )
        }
      }
    }
    expect(sinDeclarar).toEqual([])
  })

  it('y la del 18/09 sigue siendo la unica que lo necesita hoy', () => {
    // Si manana entra otra, esta prueba cae y obliga a mirarla, no a borrarla.
    const declaradas = readdirSync(DIR_MIGRACIONES)
      .filter((f) => f.endsWith('.sql'))
      .filter(
        (f) => versionMinimaDeMigracion(readFileSync(join(DIR_MIGRACIONES, f), 'utf8')) !== null,
      )
    expect(declaradas).toEqual(['20260918_entidad_tenant_compuesto.sql'])
  })
})
