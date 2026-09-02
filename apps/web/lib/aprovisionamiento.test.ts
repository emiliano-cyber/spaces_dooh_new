import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
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
