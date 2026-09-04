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
    expect(ejecutable(PROVISION)).not.toMatch(/cd \/var\/www\/Spaces/)
  })

  it('corre el runner con `docker run`, igual que `update.sh`', () => {
    expect(ejecutable(PROVISION)).toMatch(/docker run[^\n]*--rm/)
  })

  it('y pasa `--instalacion-nueva`, que `update.sh` nunca pasa', () => {
    // `update.sh` llama al runner sin banderas (`:1511`), y el runner ABORTA si
    // no puede distinguir una base nueva de una rezagada. La primera migración
    // es del aprovisionamiento, sí o sí.
    expect(ejecutable(PROVISION)).toMatch(/--instalacion-nueva/)
  })

  it('la conexión que migra NO es un socket unix', () => {
    // Un contenedor no ve `/var/run/postgresql` del anfitrión, y montarlo no
    // bastaría: sin usuario en la URL, libpq usa el del SISTEMA, que dentro del
    // contenedor es `node` y no `postgres`, así que *peer* falla igual.
    expect(ejecutable(PROVISION)).not.toMatch(/postgresql:\/\/\/spaces\?host=/)
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

  it('el alta escribe las DOS urls con el MISMO destino, o `update.sh` se para', () => {
    // Se mira el SCRIPT y no las plantillas: `instancia.env.example` trae
    // `DATABASE_URL=` vacio a proposito -- lo rellena el alta --, asi que
    // comparar plantillas no mediria nada. Las dos urls nacen aqui.
    const destinos = [...ejecutable(PROVISION).matchAll(/postgresql:\/\/[^@\s'"]+@([^/\s'"]+)\//g)]
      .map((m) => m[1])
    expect(destinos.length, 'el alta deberia escribir dos urls').toBeGreaterThanOrEqual(2)
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

  const creaRol = (nombre: string) =>
    ejecutable(PROVISION).match(new RegExp(`create role ${nombre}[^"\\\\]*`))?.[0] ?? ''

  it('el de la APLICACION no puede saltarse la RLS, y se dice explicito', () => {
    expect(creaRol('spaces_app')).toMatch(/\bnobypassrls\b/)
  })

  it('el que MIGRA y RESPALDA si, o el respaldo saldria vacio', () => {
    const migrador = creaRol('spaces_migrador')
    expect(migrador).toMatch(/\bbypassrls\b/)
    expect(migrador, 'el migrador no debe ser superusuario').toMatch(/\bnosuperuser\b/)
  })

  it('y son DOS roles distintos: la aplicacion nunca usa el del respaldo', () => {
    expect(creaRol('spaces_app')).not.toBe('')
    expect(creaRol('spaces_migrador')).not.toBe('')
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

  it('y NEEDRESTART_MODE=a, que es el que colgo el ensayo', () => {
    expect(guion).toMatch(/export NEEDRESTART_MODE=a/)
  })

  it('las dos ANTES del primer apt-get, o no sirven de nada', () => {
    const primerApt = guion.indexOf('apt-get')
    expect(primerApt, 'el guion ya no llama a apt-get?').toBeGreaterThan(0)
    expect(guion.indexOf('DEBIAN_FRONTEND')).toBeLessThan(primerApt)
    expect(guion.indexOf('NEEDRESTART_MODE')).toBeLessThan(primerApt)
  })
})
