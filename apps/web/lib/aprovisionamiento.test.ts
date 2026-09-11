import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

// ============================================================================
//  El camino de aprovisionamiento tiene que poder FUNCIONAR, no solo describirse.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-09-01, al preparar F5.6 (el ensayo del alta en un droplet
//  desechable). `provision-instancia.sh` figuraba como HECHO y su `--dry-run`
//  salía en verde... porque el dry-run **imprime los comandos ssh, no comprueba
//  que funcionarían**. Cinco defectos, y ninguno se veía desde el dry-run:
//
//   ① `setup-droplet.sh` NO instalaba Docker, e instalaba nvm + pm2 — el modelo
//      viejo. `update.sh` es enteramente `docker pull` y `docker run`, así que la
//      instancia no habría arrancado la aplicación jamás.
//   ② La primera migración corría contra `/var/www/Spaces` con `node`: un repo
//      clonado y un intérprete que una instancia NO TIENE — es el sentido de que
//      exista la imagen.
//   ③ La imagen no llevaba `scripts/migrar.mjs`, así que `update.sh` montaba una
//      copia del anfitrión (su AVISO 1) y el runner quedaba versionado con el
//      aprovisionamiento en vez de con la imagen que migra.
//   ④ NO HABÍA AUTENTICACIÓN contra el registro. Ni `docker login`, ni credencial
//      en `instancia.env`. Una instancia de cliente no podía bajar la imagen.
//   ⑤ Y la `DATABASE_URL` de la instancia era un SOCKET UNIX, que un contenedor
//      no ve. El paso de migraciones de `update.sh` tampoco habría conectado.
//
//  Estas pruebas leen los scripts porque es donde consta lo que va a pasar en un
//  servidor. No sustituyen al ensayo real (F5.6) — atrapan el olvido en
//  `npm test`, que es donde sale barato.
// ============================================================================

const RAIZ = join(__dirname, '..', '..', '..')
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8')

const DOCKERFILE = leer('Dockerfile')
const SETUP = leer('infra', 'scripts', 'setup-droplet.sh')
const PROVISION = leer('infra', 'scripts', 'provision-instancia.sh')
const INSTALAR_HIJO = leer('infra', 'scripts', 'instalar-hijo.sh')
const BASE_INSTANCIA = leer('infra', 'scripts', 'base-instancia.sh')
const UPDATE = leer('infra', 'scripts', 'update.sh')
const INSTANCIA_ENV = leer('infra', 'env', 'instancia.env.example')

/**
 * Las líneas EJECUTABLES de un guion, sin comentarios.
 *
 * Existe por una lección propia: la primera versión de la prueba de «no hay
 * repo clonado» se ponía roja **por el comentario que explica que ese `cd` se
 * quitó**. Una prueba que se caza a sí misma no mide el código: mide su
 * documentación. `convenciones.md` ya tenía esa trampa anotada.
 */
function ejecutable(guion: string): string {
  return guion
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('#'))
    .join(' ')
}

// ============================================================================
//  EL CAMINO DE ALTA SON TRES GUIONES, y estas pruebas leen los TRES.
// ----------------------------------------------------------------------------
//  Hasta el 2026-09-11 leian UNO (`provision-instancia.sh`). Entonces `aa124cb`
//  saco el SQL de los roles y las recetas de Docker a `base-instancia.sh` -- un
//  refactor CORRECTO, que existe justamente para que los dos caminos de alta no
//  vuelvan a divergir-- y seis de estas pruebas se quedaron leyendo el archivo
//  viejo. Tres de esas seis son las que custodian R2 (`nobypassrls` del rol de
//  la aplicacion, `bypassrls` del migrador, y que sean dos roles distintos).
//
//  Se pusieron ROJAS, que fue una suerte: buscaban una cadena que ya no estaba.
//  Una comprobacion por AUSENCIA en el mismo sitio (`not.toMatch`) se habria
//  quedado en VERDE sin medir nada, y nadie se habria enterado nunca. Esa es la
//  leccion que fija esta constante:
//
//    una prueba que lee un archivo por su ruta afirma DOS cosas a la vez -- lo
//    que busca, y donde vive. La segunda caduca sola, sin avisar.
//
//  Asi que se busca en el CAMINO entero y no en un archivo, y cada ayudante de
//  abajo devuelve TAMBIEN donde encontro lo que buscaba, para que el rojo diga
//  "no esta en ninguno de los tres" y no "cadena vacia".
const GUIONES_DEL_ALTA: ReadonlyArray<readonly [string, string]> = [
  ['infra/scripts/base-instancia.sh', BASE_INSTANCIA],
  ['infra/scripts/provision-instancia.sh', PROVISION],
  ['infra/scripts/instalar-hijo.sh', INSTALAR_HIJO],
]

/**
 * Los tres guiones del alta aplanados, uno por linea. El `\n` entre ellos no
 * es cosmetico: `ejecutable()` convierte cada guion en UNA linea, asi que un
 * patron con `[^\n]*` dentro no puede cruzar de un archivo al siguiente y
 * fabricar una coincidencia que no existe en ninguno de los dos.
 */
const ALTA = GUIONES_DEL_ALTA.map(([, guion]) => ejecutable(guion)).join('\n')

/**
 * La sentencia SQL que crea un rol, buscada por el nombre de su RECETA en los
 * tres guiones del alta.
 *
 * Se busca por la receta y no por el nombre del rol porque el nombre ya no
 * aparece en la sentencia: `base-instancia.sh` lo pasa por `%s` desde
 * `PG_ROL_APP`, que es lo que impide tener dos nombres distintos en dos
 * caminos. Buscar `create role spaces_app` volveria a dejar esto mudo.
 */
function sqlDeRol(receta: string): { sql: string; donde: string } {
  for (const [archivo, guion] of GUIONES_DEL_ALTA) {
    const m = ejecutable(guion).match(new RegExp(`${receta}\\(\\)[\\s\\S]{0,400}?(create role[^"\\\\]*)`))
    if (m) return { sql: m[1], donde: archivo }
  }
  return { sql: '', donde: 'NINGUNO de los guiones del alta' }
}

describe('la imagen trae lo que la instancia necesita para migrar', () => {
  it('lleva `scripts/migrar.mjs`, y no una copia montada desde el anfitrión', () => {
    // Con el runner dentro, `update.sh:1313` toma su primera rama sola y el
    // runner viaja versionado CON la imagen que migra, que es lo que el plan
    // pedía desde F3.4 paso 5.
    expect(DOCKERFILE).toMatch(/COPY[^\n]*scripts\/migrar\.mjs/)
  })
})

describe('el servidor de una instancia se prepara para el modelo de HOY', () => {
  it('instala Docker, que es lo único con lo que `update.sh` sabe trabajar', () => {
    expect(ejecutable(SETUP)).toMatch(/docker-ce|install[^\n]*docker/i)
  })

  it('NO instala pm2: esa es la pieza que en el PADRE se peleó con systemd', () => {
    expect(ejecutable(SETUP)).not.toMatch(/npm install -g pm2|pm2 startup/)
  })

  it('NO instala Node: una instancia no corre código, corre una imagen', () => {
    expect(ejecutable(SETUP)).not.toMatch(/nvm install|npm install -g/)
  })

  // ── El cliente de S3, y por qué su ausencia no daba ningún error ──────────
  //  `respaldo.sh` sube el dump y `update.sh` sube el log a Spaces, y los dos
  //  resuelven el cliente con `respaldo_cliente()`, que exige `s3cmd` o `aws`
  //  en el PATH. `setup-droplet.sh` no instalaba ninguno de los dos, así que
  //  toda instancia nacía SIN PODER SUBIR NADA — y el camino falla ABIERTO
  //  (`respaldo.sh:241-244` registra y devuelve 1), o sea que el update seguía
  //  en verde y nadie se enteraba hasta necesitar el respaldo.
  //
  //  Es la misma forma que el defecto de DOOHmain del 01/09: el código estaba,
  //  la dependencia no estaba en la máquina.
  it('instala un cliente de S3, o el respaldo y el log no salen del droplet', () => {
    expect(ejecutable(SETUP)).toMatch(/install[^\n]*\bs3cmd\b|install[^\n]*awscli/)
  })
})

describe('el respaldo y el log SALEN del droplet, o no hay de donde restaurar', () => {
  const RESPALDO = leer('infra', 'scripts', 'respaldo.sh')

  it('el destino del dump lleva la instancia en la ruta, no un cajón común', () => {
    // Lo exige el ADR 0025: el cliente puede pedir su registro, y separarlo
    // después obligaría a filtrar a mano — que es como se filtra de más.
    expect(RESPALDO).toMatch(/s3:\/\/%s\/%s\//)
  })

  it('el log también, y por el mismo motivo', () => {
    expect(UPDATE).toMatch(/s3:\/\/%s\/%s\/%s\.log/)
  })

  it('el cliente que instala el alta es uno de los que el respaldo sabe usar', () => {
    // Guarda contra el desacople: si alguien cambia el instalador a `minio-cli`
    // o el resolvedor a otro nombre, esto se pone rojo en vez de descubrirse
    // el día del primer incidente.
    const instalado = /\bs3cmd\b/.test(ejecutable(SETUP)) ? 's3cmd' : 'awscli'
    expect(RESPALDO).toMatch(instalado === 's3cmd' ? /command -v s3cmd/ : /command -v aws/)
  })
})

describe('el alta migra dentro de un contenedor, no contra un repo', () => {
  it('no da por hecho un repo clonado en la instancia', () => {
    expect(ALTA).not.toMatch(/cd \/var\/www\/Spaces/)
  })

  it('corre el runner con `docker run`, igual que `update.sh`', () => {
    expect(ALTA).toMatch(/docker run[^\n]*--rm/)
  })

  it('y pasa `--instalacion-nueva`, que `update.sh` nunca pasa', () => {
    // `update.sh` llama al runner sin banderas (`:1511`), y el runner ABORTA si
    // no puede distinguir una base nueva de una rezagada. La primera migración
    // es del aprovisionamiento, sí o sí.
    expect(ALTA).toMatch(/--instalacion-nueva/)
  })

  it('la conexión que migra NO es un socket unix', () => {
    // Un contenedor no ve `/var/run/postgresql` del anfitrión, y montarlo no
    // bastaría: sin usuario en la URL, libpq usa el del SISTEMA, que dentro del
    // contenedor es `node` y no `postgres`, así que *peer* falla igual.
    expect(ALTA).not.toMatch(/postgresql:\/\/\/spaces\?host=/)
  })
})

describe('la aplicacion en contenedor puede ver su base', () => {
  // Medido el 2026-09-01 al convertir DEMO, y es una leccion cara:
  //
  //  El primer intento puso la app en red BRIDGE con `host.docker.internal`,
  //  porque ahi dentro `127.0.0.1` es el propio contenedor. Funcionaba... hasta
  //  que `update.sh` se planto: compara la DATABASE_URL de `app.env` con la de
  //  `instancia.env` y SE PARA si difieren, «migrar una y servir la otra no da
  //  error, deja dos bases a medias». Y difieren EN TEXTO aunque sean la misma:
  //  las migraciones corren con `--network host` y usan `127.0.0.1`.
  //
  //  El guard tiene razon y no se ablanda. Lo que se cambia es la red: con
  //  `--network host` hay UNA sola forma de nombrar la base en todo el sistema.

  const APP_ENV = leer('infra', 'env', 'app.env.example')

  it('todas las urls del alta apuntan al MISMO destino, o `update.sh` se para', () => {
    // Se miran los GUIONES y no las plantillas: `instancia.env.example` trae
    // `DATABASE_URL=` vacio a proposito -- lo rellena el alta --, asi que
    // comparar plantillas no mediria nada. Las urls nacen aqui.
    //
    // Hasta el 11/09 esto exigia DOS urls porque `provision-instancia.sh` las
    // escribia por separado. Hoy las dos salen de la MISMA `url_conexion()` de
    // `base-instancia.sh`, asi que ya no pueden diferir por construccion y
    // exigir dos seria exigir que se vuelvan a duplicar. Lo que sigue
    // importando -- y lo que esto afirma -- es que en TODO el camino de alta no
    // aparezca un segundo destino escrito a mano.
    const destinos = [...ALTA.matchAll(/postgresql:\/\/[^@\s'"]+@([^/\s'"]+)\//g)].map((m) => m[1])
    expect(destinos.length, 'ningun guion del alta escribe una url de Postgres').toBeGreaterThanOrEqual(1)
    expect(new Set(destinos).size, `destinos distintos: ${destinos.join(' vs ')}`).toBe(1)
  })

  it('comparte la red de la maquina, que es lo que hace posible lo anterior', () => {
    expect(INSTANCIA_ENV).toMatch(/DOCKER_OPCIONES_APP=.*--network host/)
  })

  it('y se ata al bucle local, o el puerto quedaria expuesto', () => {
    // Con `--network host` ya no hay `--publish` que limite la interfaz: lo unico
    // que mantiene el puerto fuera del exterior es que la app escuche en
    // 127.0.0.1. Sin esta linea, la imagen usa 0.0.0.0 y la unica defensa seria
    // el cortafuegos.
    expect(APP_ENV).toMatch(/^HOSTNAME=127\.0\.0\.1$/m)
  })
})

describe('los dos roles de la base, y cual puede saltarse la RLS', () => {
  // Medido el 2026-09-01 al convertir DEMO:
  //
  //   pg_dump: ERROR: query would be affected by row-level security policy
  //            for table "acciones"
  //
  //  `db/schema.sql` pone RLS con FORCE, que aplica INCLUSO AL DUEÑO. El rol que
  //  respalda tiene que ver todas las filas o el `pg_dump` de `update.sh` sale
  //  vacío y la primera actualización de cada instancia aborta. Un respaldo
  //  PARCIAL sería peor que ninguno.
  //
  //  Y lo contrario para el de la aplicación: ese NO puede saltársela nunca. Es
  //  la línea que sostiene el aislamiento entre organizaciones (R2), y su modo de
  //  fallo no da error — devuelve filas de otra empresa, o ninguna, en silencio.

  //  Y una tercera leccion, del 2026-09-11: estas tres comprobaciones pasaron
  //  DIAS apuntando al archivo del que el SQL ya se habia mudado. Por eso cada
  //  una empieza afirmando que ENCONTRO la sentencia, y por eso la ultima
  //  cuenta cuantas hay en todo el camino -- ver `sqlDeRol` arriba.

  const APP = sqlDeRol('sql_crear_rol_app')
  const MIGRADOR = sqlDeRol('sql_crear_rol_migrador')

  it('la sentencia de cada rol EXISTE en el camino de alta (si no, lo de abajo no mide nada)', () => {
    expect(APP.sql, `no se encontro \`sql_crear_rol_app\` en ${APP.donde}`).not.toBe('')
    expect(MIGRADOR.sql, `no se encontro \`sql_crear_rol_migrador\` en ${MIGRADOR.donde}`).not.toBe('')
  })

  it('el de la APLICACION no puede saltarse la RLS, y se dice explicito', () => {
    expect(APP.sql, `receta hallada en ${APP.donde}`).toMatch(/\bnobypassrls\b/)
  })

  it('el que MIGRA y RESPALDA si, o el respaldo saldria vacio', () => {
    expect(MIGRADOR.sql, `receta hallada en ${MIGRADOR.donde}`).toMatch(/\bbypassrls\b/)
    expect(MIGRADOR.sql, 'el migrador no debe ser superusuario').toMatch(/\bnosuperuser\b/)
  })

  it('y son DOS roles distintos: la aplicacion nunca usa el del respaldo', () => {
    expect(APP.sql).not.toBe(MIGRADOR.sql)
    // `\b` no casa dentro de `nobypassrls`, asi que esto afirma que al rol de
    // la aplicacion no se le concedio el privilegio suelto.
    expect(APP.sql).not.toMatch(/\bbypassrls\b/)
  })

  it('y el SQL esta escrito UNA sola vez en todo el camino de alta', () => {
    // `base-instancia.sh` existe precisamente porque esto estuvo escrito dos
    // veces y derivo en el mismo commit en que se copio. Si alguien vuelve a
    // pegar un `create role` en `provision-instancia.sh` o en
    // `instalar-hijo.sh`, el privilegio arreglado en un sitio dejaria de
    // llegar al otro -- y ese fallo NO da error: sirve datos de quien no toca.
    const sentencias = ALTA.match(/create role/g) ?? []
    expect(
      sentencias.length,
      `hay ${sentencias.length} sentencias \`create role\` en el camino de alta; deberian ser 2 (una por rol) y vivir solo en base-instancia.sh`,
    ).toBe(2)
  })
})

describe('una instancia puede bajar la imagen de un registro privado', () => {
  it('`update.sh` se autentica antes de jalar', () => {
    expect(ejecutable(UPDATE)).toMatch(/docker login/)
  })

  it('el alta también, porque migra con la imagen antes de que exista el cron', () => {
    expect(ejecutable(PROVISION)).toMatch(/docker login/)
  })

  it('la plantilla declara la credencial de solo lectura', () => {
    expect(INSTANCIA_ENV).toMatch(/^#?\s*REGISTRY_TOKEN=/m)
  })

  it('y el token NUNCA se pasa por la línea de comandos', () => {
    // `--password` deja la credencial en `ps` y en el historial. Va por stdin,
    // que es la disciplina que este repo ya aplica en `release.yml:241-242`.
    for (const [nombre, guion] of [
      ['update.sh', UPDATE],
      ['provision-instancia.sh', PROVISION],
    ] as const) {
      const conPassword = ejecutable(guion).match(/docker login[^\n]*--password(?!-stdin)/)
      expect(conPassword, `${nombre} pasa el token por argumento`).toBeNull()
    }
  })
})

describe('el droplet nace con la clave del PADRE dentro', () => {
  // Encontrado el 2026-09-03, LEYENDO, justo antes de correr F5.6 con
  // `--crear-droplet` por primera vez. Es el defecto 15 de este camino y el
  // primero que se caza sin gastar una maquina.
  //
  //  DigitalOcean NO añade las claves de la cuenta a un droplet nuevo: solo
  //  pone las que se le pasan EN LA CREACION. Sin `--ssh-keys`, la maquina nace
  //  con contraseña de root enviada por correo y sin ninguna clave — y la linea
  //  siguiente del alta es un `ssh` (`provision-instancia.sh:330`).
  //
  //  El modo de fallo es el caro: el droplet YA existe y ya se cobra cuando el
  //  alta se planta. La tarjeta TH-F5.6 mandaba comprobar que la clave del PADRE
  //  estuviera EN LA CUENTA, y eso es necesario pero NO suficiente.

  it('`droplet create` pasa `--ssh-keys`, o la maquina nace sin llave', () => {
    expect(ejecutable(PROVISION)).toMatch(/droplet create[\s\S]*?--ssh-keys/)
  })

  it('la clave entra por el entorno, sin ningun valor quemado', () => {
    // Un fingerprint es un valor de cuenta, como la region y el tamaño.
    expect(ejecutable(PROVISION)).toMatch(/DO_SSH_KEYS/)
    expect(PROVISION).not.toMatch(/SHA256:[A-Za-z0-9+/]{20,}/)
  })

  it('y falta la clave PARA antes de crear nada, no despues', () => {
    // Si se descubre despues del `create`, ya hay una maquina cobrandose.
    const antesDelCreate = ejecutable(PROVISION).split(/droplet create/)[0]
    expect(antesDelCreate).toMatch(/DO_SSH_KEYS/)
  })

  it('la SIMULACION imprime el mismo comando que se ejecutara', () => {
    // La puerta 1 de TH-F5.6 existe para leer lo que va a pasar. Un eco al que
    // le faltan banderas del comando real convierte esa puerta en un adorno:
    // hasta hoy el `--dry-run` no mostraba ni `--image`.
    const eco = ejecutable(PROVISION).match(/\$DRY_ETIQUETA doctl compute droplet create[^"]*/)
    expect(eco?.[0], 'no se encontro el eco del dry-run').toBeTruthy()
    for (const bandera of ['--region', '--size', '--image', '--ssh-keys']) {
      expect(eco![0], `al eco del --dry-run le falta ${bandera}`).toContain(bandera)
    }
  })
})

describe('los guiones que la documentacion invoca con `./` se pueden ejecutar', () => {
  // Encontrado el 2026-09-03 EN EL PADRE, con el droplet a punto de crearse:
  //
  //   $ ./infra/scripts/provision-instancia.sh --crear-droplet ... --dry-run
  //   -bash: ./infra/scripts/provision-instancia.sh: Permission denied
  //
  //  `provision-instancia.sh` estaba en el indice como 100644 mientras que
  //  `update.sh` y `respaldo.sh` estaban en 100755. En un clon limpio --que es
  //  lo que hay en el PADRE y lo que habra el dia del alta de un owner-- el
  //  guion del alta simplemente no arranca.
  //
  //  No se ve trabajando en Windows: ahi `core.filemode` es `false`, el bit no
  //  existe y `git status` no enseña nada. Solo aparece en el servidor, que es
  //  el peor sitio para descubrirlo.
  //
  //  La prueba mira el INDICE DE GIT y no el sistema de archivos, porque en
  //  Windows el modo del archivo no significa nada.

  const enGit = (ruta: string) =>
    execFileSync('git', ['ls-files', '-s', '--', ruta], { cwd: RAIZ, encoding: 'utf8' })
      .split(/\s+/)[0]

  /** Los guiones que la documentacion manda correr como `./ruta`, no con `bash ruta`. */
  const invocadosConPunto = [
    ...new Set(
      [
        leer('docs', 'runbook-alta-de-owner.md'),
        leer('docs', 'evidencias', 'TH-F5.6_ensayo-alta-droplet-desechable.txt'),
      ]
        .join('\n')
        .matchAll(/\.\/(infra\/scripts\/[a-z0-9._-]+\.sh)/g),
    ),
  ]
    .map((m) => m[1])
    // El `map` va ANTES de quitar duplicados: `matchAll` devuelve un objeto
    // distinto por aparicion, asi que agruparlos NO deduplica -- generaba
    // siete casos identicos para el mismo guion.
    .filter((v, i, a) => a.indexOf(v) === i)

  it('la documentacion invoca al menos un guion asi (si no, esta prueba no mide nada)', () => {
    expect(invocadosConPunto.length).toBeGreaterThan(0)
  })

  it.each(invocadosConPunto)('`%s` esta marcado 100755 en el indice de git', (ruta) => {
    expect(enGit(ruta), `${ruta} no arrancaria en un clon limpio`).toBe('100755')
  })
})

describe('el guion del servidor no puede quedarse esperando a nadie', () => {
  // Medido el 2026-09-03 en el ensayo de F5.6: colgado UNA HORA en la linea del
  // `apt-get upgrade`. En Ubuntu 22.04 --y las imagenes de DigitalOcean lo
  // traen-- ese upgrade abre el menu de `needrestart` («Which services should be
  // restarted?») y espera una respuesta que aqui NO puede llegar: el guion viaja
  // por `ssh root@host 'bash -s'`, asi que no hay terminal ni stdin libre.
  //
  //  Demostrado sin lugar a duda porque se repitio: el MISMO guion sobre la
  //  MISMA maquina, con las dos variables puestas, termino en minutos.
  //
  //  Van dentro del guion y no en quien lo lanza. Un aprovisionamiento que
  //  depende de que el operador se acuerde de dos variables de entorno se cuelga
  //  el dia que no se acuerde -- y colgado no da error: parece que va lento.

  const guion = ejecutable(SETUP)

  it('fija DEBIAN_FRONTEND=noninteractive', () => {
    expect(guion).toMatch(/export DEBIAN_FRONTEND=noninteractive/)
  })

  // Esta prueba pedia el valor EXACTO `a` hasta el 2026-09-08, y con eso se
  // convirtio en el guardian de una decision que resulto estar mal.
  //
  // `a` significa «reinicia los servicios afectados», y entre ellos esta
  // `cloud-final.service` --la fase final de cloud-init, que en las imagenes de
  // DigitalOcean instala paquetes por su cuenta--. Reiniciarla lanza un segundo
  // `apt-get`, y el alta de `g500` murio con codigo 100 al encontrarse el
  // candado puesto: «Could not get lock /var/lib/apt/lists/lock». Defecto 37.
  //
  // Lo que esta prueba SIEMPRE quiso proteger es que needrestart NO PREGUNTE,
  // porque preguntar aqui cuelga el guion sin dar error. `a` era una forma de
  // conseguirlo; `l` (listar) es otra, y ademas no reinicia nada. Asi que se
  // afirma la intencion y no el valor.
  //
  // La prohibicion de volver a `a` vive en `pruebas-provision.sh`, escenario 37,
  // que es donde estan las demas afirmaciones sobre el candado de apt. Aqui no
  // se duplica: dos sitios con la misma regla divergen.
  // Sin anclas `^…$`: `ejecutable()` aplana el guion a UNA linea --quita los
  // comentarios y junta el resto con espacios--, asi que un `/m` no tiene
  // lineas donde anclar y no casa nunca. Se cierra con `(?:\s|$)` para que
  // `=al` o `=algo` no cuelen.
  it('y NEEDRESTART_MODE en un modo que NO pregunta', () => {
    expect(guion).toMatch(/export NEEDRESTART_MODE=[al](?:\s|$)/)
  })

  it('las dos ANTES del primer apt-get, o no sirven de nada', () => {
    const primerApt = guion.indexOf('apt-get')
    expect(primerApt, 'el guion ya no llama a apt-get?').toBeGreaterThan(0)
    expect(guion.indexOf('DEBIAN_FRONTEND')).toBeLessThan(primerApt)
    expect(guion.indexOf('NEEDRESTART_MODE')).toBeLessThan(primerApt)
  })
})

describe('crear la maquina y entrar en ella son dos cosas distintas', () => {
  // Medido el 2026-09-03 en el ensayo de F5.6, con la maquina ya creada:
  //
  //   -- Base del servidor (Docker, nginx, certbot, ufw)
  //   ssh: connect to host 157.245.143.158 port 22: Connection refused
  //
  //  `doctl compute droplet create --wait` espera a que el droplet este ACTIVE,
  //  y `active` no quiere decir que `sshd` escuche: la maquina sigue arrancando.
  //  El alta encadenaba el `ssh` inmediatamente.
  //
  //  `Connection refused` no es un problema de llave --eso seria
  //  `Permission denied (publickey)`-- sino de que todavia no hay nadie
  //  escuchando. Y el precio es el de siempre en este trecho: el droplet YA
  //  existe y YA se cobra cuando el alta se planta.

  const guion = ejecutable(PROVISION)

  it('hay una espera explicita por el puerto 22', () => {
    expect(guion).toMatch(/esperar_ssh\(\)/)
  })

  it('y ocurre DESPUES de crear y ANTES de entrar', () => {
    const crear = guion.indexOf('droplet create')
    const esperar = guion.indexOf('esperar_ssh "$HOST"')
    const entrar = guion.indexOf('setup-droplet.sh')
    expect(crear, 'no se encontro el create').toBeGreaterThan(0)
    expect(esperar, 'no se llama a esperar_ssh con el host').toBeGreaterThan(crear)
    expect(esperar, 'la espera va antes de entrar por ssh').toBeLessThan(entrar)
  })

  it('se rinde con un limite, en vez de esperar para siempre', () => {
    // Un bucle sin techo deja el alta colgada sin decir nada, que es
    // exactamente el defecto 18 con otra cara.
    expect(guion).toMatch(/ESPERAS_SSH/)
  })
})

describe('el certificado no se puede pedir sin una cuenta', () => {
  // Medido el 2026-09-04 en el ensayo, con el DNS ya resolviendo:
  //
  //   You should register before running non-interactively, or provide
  //   --agree-tos and --email <email_address> flags.
  //
  //  La llamada llevaba `--agree-tos --no-eff-email` pero NINGUN correo, y con
  //  `-n` certbot no puede preguntarlo. En una maquina recien creada no hay
  //  cuenta de Let's Encrypt, asi que esto falla en la PRIMERA instancia de cada
  //  droplet -- o sea, en todas.
  //
  //  De quien es ese correo es una DECISION que no toma este guion: si es del
  //  owner, los avisos de caducidad le llegan a el y AS OOH no se entera; si es
  //  de AS OOH, se entera quien renueva. Por eso entra por entorno y el guion
  //  para si falta, en vez de inventarse uno.

  const guion = ejecutable(PROVISION)

  it('pasa un correo a certbot, y sale del entorno', () => {
    // Comillas simples dentro, como `-d '$DOMINIO'`: el argumento de `remoto` va
    // entre dobles, asi que la variable la expande el guion y las simples son
    // para el shell del otro lado.
    expect(guion).toContain('certbot certonly')
    expect(guion).toContain("-m '$CERTBOT_EMAIL'")
  })

  it('para ANTES de llamar a certbot si no lo tiene', () => {
    const guard = guion.indexOf('falta CERTBOT_EMAIL')
    const llamada = guion.indexOf('certbot certonly')
    expect(guard, 'no hay guard de CERTBOT_EMAIL').toBeGreaterThan(0)
    expect(guard).toBeLessThan(llamada)
  })

  it('y no quema ninguna direccion real', () => {
    expect(PROVISION).not.toMatch(/-m ['"]?[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  })
})

describe('nginx no puede tener dos sitios por omision', () => {
  // Medido el 2026-09-04, en el ultimo paso del alta:
  //
  //   nginx: [emerg] a duplicate default server for 0.0.0.0:80
  //          in /etc/nginx/sites-enabled/ensayo.space-os.io:66
  //
  //  `instancia.conf.tpl:66` trae su propio `default_server` A PROPOSITO --el
  //  bloque que atrapa las peticiones por IP-- y Ubuntu deja el suyo activo en
  //  `sites-enabled/default`. Dos, y nginx se niega.
  //
  //  Lo caro: el vhost roto YA esta en disco cuando `nginx -t` falla, asi que
  //  nginx sigue sirviendo la configuracion vieja que tenia cargada y **no
  //  arranca si la maquina se reinicia**. Un alta «casi terminada» deja una
  //  instancia que muere en el primer reinicio.
  //
  //  Y esto el proyecto YA lo sabia: `infra/nginx/padre-ip.conf:25` lo dice
  //  desde que se monto el PADRE. La leccion existia y estaba en otro archivo.

  it('el alta retira el sitio de ejemplo de Ubuntu', () => {
    expect(ejecutable(SETUP)).toMatch(/rm -f \/etc\/nginx\/sites-enabled\/default/)
  })

  it('y lo hace al instalar nginx, no despues de configurarlo', () => {
    const g = ejecutable(SETUP)
    expect(g.indexOf('sites-enabled/default')).toBeLessThan(g.indexOf('Configurando firewall'))
  })
})
