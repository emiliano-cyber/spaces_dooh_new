---
tipo: arquitectura
estado: verificado
actualizado: 2026-08-18
tags: [despliegue, entorno, ci, env, instancias]
archivos:
  - infra/scripts/pruebas-update.sh
  - .env.example
  - .env.production.example
  - apps/web/lib/entorno.test.ts
  - apps/web/package.json
  - apps/web/next.config.mjs
  - Dockerfile
  - .dockerignore
  - apps/web/scripts/bootstrap-auth.mjs
  - db/README.md
  - ecosystem.config.js
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .github/workflows/promover.yml
  - .github/workflows/deploy.yml
  - infra/scripts/update.sh
  - infra/scripts/respaldo.sh
  - infra/scripts/README.md
  - scripts/migrar.mjs
  - infra/nginx/demo.space-os.io.conf
  - db/docker-compose.yml
---

# Entorno y despliegue

## Local

```bash
# 1. Postgres (docker-compose expone el 5433, NO el 5432)
cd db && docker compose up -d

# 2. Aplicar esquema + migraciones
psql -d spaces -f db/schema.sql
# … y las 67 de db/migrations/ en orden lexicográfico ([[migraciones]])

# 3. Permisos por rol + usuario inicial (idempotente)
#    DATABASE_URL es OBLIGATORIA: el script no elige base por ti
cd apps/web && DATABASE_URL=postgresql://spaces:spaces@localhost:5433/spaces \
  node scripts/bootstrap-auth.mjs

# 4. La app
cd apps/web && npm run dev     # http://localhost:3000/spaces-dooh/
```

### El bootstrap del usuario inicial

`apps/web/scripts/bootstrap-auth.mjs` siembra la matriz de `rol_permisos` (36
filas) y el usuario dueño, con la contraseña de `SEED_PASSWORD` (por omisión
`spaces123`). Es el único consumidor de esa variable. Sin él una base recién
creada **no tiene por dónde entrar**: `db/schema.sql` crea las tablas y el tenant
`rgb`, pero ni un solo usuario.

**`DATABASE_URL` es obligatoria** (`bootstrap-auth.mjs:10-34`): sin ella el script
no arranca, imprime qué variable falta con un ejemplo en bash y en PowerShell, y
sale con código 1.

> [!danger] Estuvo roto y no lo dijo nadie — corregido el 13/08
> El script **fallaba siempre**, en cualquier base, por dos defectos del mismo
> `insert`. Ninguno se notó porque nadie volvió a correrlo tras cambiar el
> esquema:
>
> 1. **42P10.** Usaba `on conflict (email)`, pero la unicidad de correo es un
>    índice **funcional** sobre `lower(email)` (`db/schema.sql:72`), y Postgres no
>    lo infiere desde el nombre de la columna. El conflicto va por
>    `on conflict (lower(email))`.
> 2. **23502.** No fijaba `tenant_id`. Se apoyaba en el `DEFAULT` cableado por el
>    bucle de `db/schema.sql:600-624` — un uuid de otra base, y en retirada.
>
> Ahora la organización se resuelve **por slug** (`insert … select … from tenants
> where slug='rgb'`), nunca por uuid: el id se genera distinto en cada base.
>
> Y si esa organización **no existe**, el script **aborta con error y salida 1**.
> No es un detalle: con esa forma de `insert`, la ausencia del tenant hace que la
> consulta afecte 0 filas y **termine con éxito sin crear nada**. Es el mismo modo
> de fallo silencioso de [[zonas-de-riesgo]] R2, y aquí dejaría una base sin
> usuario con el operador convencido de haberla sembrado. Se detecta por
> `rowCount === 0`.

> [!danger] Ya no hay base por omisión — cerrado el 13/08 (T-02)
> Hasta hoy el script caía en `postgresql://spaces:spaces@localhost:5433/spaces`
> si nadie le pasaba `DATABASE_URL`: la base de desarrollo **con datos de
> verdad**, cuyo rol `spaces` es **superusuario con `rolbypassrls`** (comprobado
> contra `pg_roles`), así que además se salta la RLS `FORCE` que
> `db/migrations/20260720_hard1_usuarios_rls.sql` puso sobre `usuarios`.
>
> Ese destino era **inerte** mientras el insert moría con 42P10. Arreglarlo lo
> volvió operativo: el script pasó a **escribir**. Por eso `DATABASE_URL` es
> ahora obligatoria y el script aborta si falta, con el mismo criterio que aplica
> al tenant ausente — **antes negarse a arrancar que arrancar contra un destino
> que el operador no eligió**.
>
> Sigue siendo legítimo apuntarlo a `spaces` en local: lo que cambia es que hay
> que **decirlo**, no que ocurra solo.

Los mismos dos inserts de ejemplo de `db/README.md` llevaban el mismo defecto:
`usuarios` y `clientes` están las dos en el bucle de RLS, así que sin `tenant_id`
no entran.

| Script | Qué hace | Dónde |
|---|---|---|
| `npm run dev` | Next dev | `apps/web/package.json:6` |
| `npm run build` | Next build | `apps/web/package.json:7` |
| `npm start` | `next start -p 3000` | `apps/web/package.json:8` |
| `npm test` | Vitest unitarias — **el recuento crece; mídelo, no lo copies** | `apps/web/package.json:10` |
| `npm run test:e2e` | Vitest integración — **ídem** | `apps/web/package.json:11` |
| `npm run typecheck` | `tsc --noEmit` | `apps/web/package.json:12` |

Las e2e necesitan una base aparte cuyo nombre **debe** terminar en `_e2e` o
`_test` (`apps/web/lib/test/db-e2e.ts`, `exigirBaseDePrueba()`). Ver
[[convenciones]].

### Hay DOS formas de arrancar, y las dos son válidas (13/08, F2.1)

`apps/web/next.config.mjs` declara `output: 'standalone'`, así que un mismo
`npm run build` deja **dos** puntos de arranque. No es un reemplazo: mientras el
droplet actual siga vivo con pm2, romper el primero dejaría el servidor de
producción sin levantar.

| Forma | Comando | Quién la usa hoy |
|---|---|---|
| La de siempre | `npm start` → `next start -p 3000` (`apps/web/package.json:8`) | `ecosystem.config.js` en el droplet, y el arnés e2e (`lib/test/servidor-e2e.ts:31`, en el 3311) |
| La autocontenida | `node .next/standalone/apps/web/server.js` | La imagen de una instancia ([[modelo-instancias-soberanas]], F2.2) |

Comprobadas las dos el 13/08: `/spaces-dooh/login/` responde 200 en el 3000 y en
el standalone, y la raíz del `basePath` sigue dando el 307 a `/inicio`.

> [!important] El trazado parte de la RAIZ del monorepo, no de `apps/web`
> `experimental.outputFileTracingRoot` apunta a `../../`. Con npm workspaces
> (`apps/*`, `packages/*`) las dependencias quedan **hoisted** en el
> `node_modules` de la raíz: sin esa opción el artefacto sale incompleto y
> arranca sin la mitad de sus paquetes.

> [!warning] El standalone **no** trae los estáticos — los copia la imagen
> Next nunca mete `.next/static` ni `public/` dentro de `.next/standalone`. Se
> comprobó: el CSS que la propia página de login pide
> (`/spaces-dooh/_next/static/css/…`) responde **404** si se arranca el
> standalone tal cual, y `apps/web/public` no existe dentro del artefacto.
> **No es un defecto del trazado**: copiarlos es paso explícito del `Dockerfile`,
> que desde F2.2 (14/08) los copia — el CSS del login ya responde **200** dentro
> del contenedor. El smoke formal sigue siendo F2.5.

## La imagen de la instancia (`Dockerfile`, 14/08, F2.2)

Un solo artefacto para todas las instancias. Se construye **desde la raíz** del
monorepo, nunca desde `apps/web`: el trazado de Next parte de ahí
(`next.config.mjs:17`) porque npm workspaces deja las dependencias *hoisted* en
el `node_modules` de la raíz.

| Etapa | Qué hace |
|---|---|
| `deps` | Solo los manifiestos + `npm ci`. Capa cacheada mientras el lockfile no cambie |
| `build` | `npx turbo run build --filter=web` sobre `node:20-alpine` |
| `runtime` | `.next/standalone` + `.next/static` + `public` + **`db/schema.sql` y `db/migrations/`** en `/app/db`; `USER node`, `EXPOSE 3000`, `CMD node apps/web/server.js` |

Medido el 14/08 sobre `space-os:dev`: **240 MB**, **67 migraciones** dentro de
`/app/db/migrations`, `SPACE_OS_VERSION` sellada desde `--build-arg VERSION`, y
el contenedor levanta en **68 ms** dando 200 en `/spaces-dooh/login/` con su CSS.

> [!danger] El `.env` es el riesgo real de esta imagen, y no avisa
> `**/.env*` en `.dockerignore` **no es opcional**. El artefacto standalone se
> lleva el `.env` dentro: al construir F2.1 se comprobó que
> `.next/standalone/apps/web/.env` salía **byte a byte idéntico** a
> `apps/web/.env` (mismo md5), con `GOOGLE_CLIENT_SECRET` incluido. Si un `.env`
> entra al contexto de build, Next lo hornea **sin decir nada** y la copia que
> corren todos los owners sale con las credenciales de uno.
>
> Por eso la verificación **no se fía del `.dockerignore`** y busca dentro de la
> imagen ya construida. El 14/08: `find / -name '.env*'` no devolvió **nada**, y
> `grep -rl 'GOOGLE_CLIENT_SECRET=' /app` tampoco.

> [!tip] Los patrones de extensión del `.dockerignore` son de RAÍZ a propósito
> `*.xlsx`, `*.pdf`, `*.csv`, `*.png` van sin `**` porque en Docker un patrón
> sin barra solo casa en la raíz del contexto. Convertir `*.xlsx` en `**/*.xlsx`
> se llevaría por delante `apps/web/public/plantilla-sitios-set.xlsx`, que la app
> sirve como plantilla de importación de inventario
> (`components/demo/inventario/ImportarInventarioDialog.tsx`). Se verificó que
> sigue dentro de la imagen.

Nada más escribe en disco: solo `apps/web/.next/cache`, que la imagen crea y
entrega al usuario `node` para que `next/image` pueda optimizar remotas. **La
instancia no necesita volumen.**

## CI

| Workflow | Disparo | Qué corre |
|---|---|---|
| `ci.yml` | `pull_request` + push a `main` | typecheck → test → build (Node 20) |
| `release.yml` | **push de un tag `v*.*.*`** | typecheck → unitarias → build → **e2e** → imagen a `beta` |
| `promover.yml` | **`workflow_dispatch` manual** | comprobar que la versión **es** `beta` → smoke en DEMO → **reetiquetar** `estable` |
| `lockfile-check.yml` | push + PR | `npm ci --dry-run` (Node 22) |
| `deploy.yml` | **`workflow_dispatch` manual** | backup → build → migraciones → `pm2 reload` |

> [!warning] No hay despliegue continuo
> `deploy.yml` solo corre a mano y **está desactualizado**. El despliegue real es
> manual por SSH. `ci.yml:1-30` documenta que el disparador es `pull_request` y
> **no** `pull_request_target` a propósito: el segundo daría secretos a código de
> un fork. No cambiarlo.

### `release.yml` — un tag publica en `beta` (17/08, F2.3)

**Escrito, NUNCA corrido.** No puede correrse todavía: el destino sale de dos
variables del repositorio que aún no existen (**TH-P4**), y hacerlo exige empujar
un tag, que es cosa de una persona.

Dos jobs, y el orden **es** el mecanismo de seguridad:

| Job | Qué hace | Por qué está antes/después |
|---|---|---|
| `pruebas` | `npm ci` → typecheck → unitarias → **build** → e2e contra `postgres:16` | Es lo que `ci.yml:74-75` no llega a correr: allí `turbo run test` son **solo unitarias** y las e2e no corren en ningún CI |
| `imagen` | `docker build --build-arg VERSION=<tag>` y push con **dos** etiquetas: la versión y `beta` | `needs: pruebas`, y el push es el **último** paso del **último** job |

- **El build de Next dentro de `pruebas` no es un extra**: `lib/test/servidor-e2e.ts:31`
  arranca con `npx next start`, que **reutiliza el build y no construye**. Un runner
  parte de un clon limpio, o sea sin `.next/BUILD_ID`: sin ese paso fallan **todas**
  las e2e por timeout y el rojo no dice nada del código.
- **La base del runner la monta el propio arnés.** El servicio solo crea `spaces_e2e`
  (el guard de `db-e2e.ts:43-60` exige que el nombre acabe en `_e2e`/`_test`); el rol
  `spaces_app` lo crea `recrearEsquema()` aplicando `db/dev-rol-app.sql` **antes** que
  nada, que es lo que salva el `raise exception` de
  `20260729_licencias_permisos.sql:96-97` — 13 migraciones exigen ese rol. Montar la
  base por otro camino sería una segunda copia del procedimiento, y dos copias
  divergen.
- **Dos conexiones**, como en local: `DATABASE_URL_TEST` con el superusuario
  (`postgres` en el runner, `spaces` en local) y `DATABASE_URL_TEST_APP` con
  `spaces_app`, que **sí** respeta la RLS.
- **El destino es un parámetro, nunca un literal**: `vars.REGISTRY` dice a dónde y
  `vars.REGISTRY_TIPO` (`docr` | `ghcr`) con qué credencial se entra. Si falta
  cualquiera de las dos, el job se para **antes** de construir, con el comando que
  hay que correr escrito en el error.
- **`estable` no se toca aquí.** Promover es decisión humana y vive en
  `promover.yml` (F2.4): reetiqueta **sin** reconstruir, así el digest no cambia.
- `concurrency` **sin** cancelación, al revés que `ci.yml`: cada corrida publica un
  artefacto, y cortarla a medias podría dejar la etiqueta de versión subida y `beta`
  apuntando a otra cosa.

### `promover.yml` — `estable` se mueve a mano y sin reconstruir (17/08, F2.4)

**Escrito, NUNCA corrido.** Necesita tres variables del repositorio que aún no
existen (`REGISTRY`, `REGISTRY_TIPO` y `DEMO_URL`, tarjeta **TH-P4**) y una imagen
en el canal `beta`, que sale de `release.yml`. Además, **`workflow_dispatch` solo se
puede disparar cuando el archivo está en la rama por omisión**: mientras viva solo en
`feat/servidor-padre-instancias`, ni aparece en la pestaña Actions.

Un solo job, y **sin `checkout`**: este workflow no lee ni una línea del repositorio.
No es un ahorro — no tener el código delante es lo que impide reconstruir por
descuido, y reconstruir daría un binario distinto del validado (invariante 3).

**Las tres puertas, en orden:**

| Puerta | Qué exige | Por qué |
|---|---|---|
| 1 | La versión existe **y es la que lleva `beta` hoy** | `estable` nunca recibe algo que no esté ahora mismo en el canal que prueba DEMO |
| 2 | DEMO contesta 200 en `/login/` y en `/api/auth/metodos/` | Restricción global 13: nada llega a un owner sin pasar por DEMO |
| 3 | Tras reetiquetar, **el digest de `estable` es el mismo** | El criterio de aceptación de F2.4 es medible, así que se mide en el propio run |

> [!important] Reetiquetar es `imagetools create`, no `pull` + `tag` + `push`
> `docker buildx imagetools create --tag …:estable …@sha256:…` trabaja sobre el
> **manifiesto** en el registry: no baja capas y conserva el digest. La ruta que
> *parece* equivalente —`docker pull`, `docker tag`, `docker push`— pasa por el
> demonio local, que guarda **una** plataforma y **vuelve a serializar** el
> manifiesto al empujar: el digest cambia, y con él la promesa de que `estable` es
> exactamente el artefacto que se probó.
>
> El origen es el **digest**, no la etiqueta `beta`: entre la comprobación y el
> reetiquetado puede entrar un release nuevo y mover `beta`.

- **El patrón de la versión es ESTRICTO** (`^v[0-9]+\.[0-9]+\.[0-9]+$`), **al revés
  que `release.yml`**, que sí admite sufijo. La diferencia es deliberada y no se debe
  unificar: una `-rc1` es material de `beta`, y en `estable` sería una precandidata
  corriendo en la flota entera.
- **Consecuencia operativa de la puerta 1:** si ya salió una `beta` más nueva, la
  versión vieja **ya no se puede promover por aquí**. Devolver la flota a una versión
  anterior es un *rollback*, no una promoción, y va a mano con el comando que el
  propio resumen del run deja escrito.
- **El resumen del run** trae versión, quién, cuándo, motivo, digest, a dónde
  apuntaba `estable` antes y el resultado del smoke. Ese digest anterior es el punto
  de vuelta atrás y se captura **antes** de mover nada.
- `environment: flota` es el gancho para exigir aprobación humana. **Hoy no frena
  nada** —un entorno sin reglas se crea al vuelo y deja pasar—; ponerle revisores es
  una orden aparte, escrita en el propio archivo.

> [!warning] El smoke dice que DEMO responde, **no** que DEMO corra esa versión
> Saber qué versión corre una instancia es `/api/version`, que **no existe todavía**
> (F6.1) y que, cuando exista, no la dirá sin `X-Flota-Token`. El workflow ya manda
> la cabecera si hay secreto `FLOTA_TOKEN` y **compara**; mientras no haya ruta, deja
> escrito en el resumen, con todas sus letras, que ese punto **no está comprobado**.
> Un smoke verde que se leyera como «DEMO corre esta versión» sería peor que no
> tenerlo.

> [!danger] Promover manda a **toda la flota** a jalar esa imagen
> Y las instancias que ya jalaron **no vuelven solas** por sí mismas: dependen de su
> rollback local, que es `update.sh` (F3.4, abajo). Desde el 17/08 ese rollback
> **existe escrito**, pero **no se ha corrido en ningún servidor** — el ensayo es
> F3.5. Hasta entonces, debajo de este botón sigue sin haber red probada.

### `update.sh` — la instancia jala su versión (17/08, F3.4)

**Escrito, NUNCA corrido en un servidor.** Vive en `infra/scripts/update.sh`, se
instala en `/opt/space-os/update.sh` y lo lanza el cron de la propia instancia. Su
manual completo —configuración, códigos de salida, cron— está en
`infra/scripts/README.md`.

> [!important] El padre no aparece por ningún lado
> El script habla con el **registry** y con **su propia base**. Con nadie más. No hay
> SSH entrante, no hay repositorio clonado, no hay compilación en el servidor: la
> instancia **jala**, el padre no empuja.

El orden importa y está elegido para que cada paso falle antes de haber hecho daño:
`pull` y comparar digest (igual → sale 0 sin tocar nada) → **respaldo** `pg_dump -Fc`
**que se poda a 3 y se sube a Spaces** → anotar la versión anterior → **migrar** →
**solo entonces** conmutar el tráfico → health check → vuelta atrás si no responde.

**Un respaldo vacío detiene el update**, y el archivo de 0 bytes **se borra** al
abortar. El criterio se copió de `.github/workflows/deploy.yml:117-125`: un `pg_dump`
que falla deja un archivo de 0 bytes y su salida se ve casi igual que la de uno bueno,
así que se mira el tamaño y no el código de salida. En el log aparece como
`BACKUP VACIO`. Se borra porque, si se quedara, en un `ls` del directorio de respaldos
parecería uno más —y el **más reciente**, que es justo el que alguien elegiría para
restaurar a mano bajo presión.

**El health check va contra `/spaces-dooh/api/auth/metodos/`** y no contra
`/api/version`, que todavía no existe (F6.1). Es la misma ruta que usa el smoke de
`promover.yml`, y por el mismo motivo: pública, sin sesión y sin datos de negocio. Su
URL vive en **una** variable, `SALUD_URL`, para que F6.1 la cambie en una línea.

**Qué se reintenta, y qué no (18/08, F3.8).** El `pull` se reintenta **3 veces**,
esperando **1 s, 5 s y 30 s**; si a la cuarta tampoco llega, aborta con código `1`
**antes de tocar nada** —no hay respaldo, ni contenedor parado, ni una sentencia
contra la base— y el log lo dice literal. Una **migración** que falla **no se
reintenta nunca**: es la mitad importante de la política, porque una migración que
murió a la mitad deja la base en un estado que su segunda corrida no espera, y
repetirla a ciegas es como se corrompe una base. El health check conserva sus 10 × 3 s
de F3.4. Cada reintento sale **numerado** en el log (`reintento 2/3`), así que se
cuenta desde fuera con `grep -c reintento /var/log/space-os/update.log`. Las esperas
se cambian con `PULL_ESPERAS` en `instancia.env`.

> [!tip] `--simular-fallo-pull` ensaya la política sin cortarle la red al droplet
> Falla el `pull` a propósito —ni llama a `docker`, así que tampoco depende del
> registry—, enseña los tres reintentos con sus esperas y sale `1` sin respaldar, sin
> migrar y sin tocar el contenedor. Tarda los 36 s del backoff. Es el comando de
> verificación de F3.8, y **corrido en local** el 18/08 dio `salida: 1` y
> `grep -c reintento` = **3**, con el directorio de estado vacío.
>
> La cuarta fila de la política del plan —el **reporte al padre**, 2 reintentos, que
> nunca aborta— es **F6.4** y **no está implementada**: solo documentada.

> [!warning] El código HTTP de la salud es el que decide si se restaura la base
> `curl -w '%{http_code}'` imprime un código **pase lo que pase** —`000` si no hubo
> respuesta—, así que el `|| echo 000` que había detrás **concatenaba un segundo
> código**. Con un fallo de conexión solo se veía feo en el log
> (`intento 1/5 -> 000000`); pero con un `curl` que alcanza a leer el **200** y luego
> sale ≠ 0 —un `--max-time` agotado a mitad del cuerpo, un contenedor recién arrancado
> y lento— la variable valía `200000`, no casaba con `200` y **tiraba un release sano**
> con una vuelta atrás que además pierde lo escrito desde el respaldo. Corregido el
> 18/08: la salida y el código de salida de `curl` se recogen **por separado**, y solo
> se cae a `000` si no imprimió nada.

> [!warning] Los cuatro códigos del runner **no** son intercambiables
> `scripts/migrar.mjs:21-32` distingue **1** (no puede empezar) · **2** (aplicó y no
> pudo registrar) · **3** (una migración aplicada cambió de contenido). `update.sh`
> los propaga uno a uno en vez de aplanarlos en «falló», que es lo que hace un `set -e`
> distraído. La diferencia decide si hay que ir a mirar la base: con un **2** la base
> ya cambió; con un **3** no se aplicó nada. Y cuando el runner **se niega a arrancar**
> —base con datos y sin `schema_migrations`, que es el estado del droplet de hoy— su
> mensaje, que dice el comando exacto que falta, se vuelca al log en vez de tragárselo.

> [!danger] El runner de migraciones **no viaja en la imagen**
> El paso 5 de F3.4 manda correr `node scripts/migrar.mjs` dentro de la imagen nueva,
> pero `Dockerfile:94-95` copia `db/schema.sql` y `db/migrations` y **no** `scripts/`.
> Comprobado contra la imagen real: `/app` tiene `apps db node_modules package.json`.
> Mientras siga así, `update.sh` **monta** el runner de la instancia en
> `/app/scripts/migrar.mjs`; funciona porque el runner resuelve rutas desde su propio
> archivo (`scripts/migrar.mjs:43-48`), así que lee **las migraciones de la imagen**
> (medido: `67 pendientes`, las de la imagen, con 68 en el repositorio).
>
> **El costo:** el runner queda versionado con el *aprovisionamiento* y no con la
> imagen — una instancia aprovisionada antes de F3.3 migraría sin comprobación de
> checksum aunque jale imágenes nuevas. El arreglo duradero es una línea `COPY` en el
> `Dockerfile`, que es **F2.2 y ya está auditada**: no se toca desde aquí. El script
> ya lo prevé — si la imagen trae el runner, no monta nada.

> [!danger] La primera versión no restauraba la base — corregido el 17/08
> Auditada en **rojo** y arreglada en el segundo ciclo de F3.4. El script decidía si
> restaurar leyendo la **prosa** del runner con un `sed` que exigía un punto pegado a
> «aplicadas». Y `scripts/migrar.mjs:694-696` imprime
> `67 aplicadas, 1 de datos pendientes.` en cuanto hay una migración `@tipo: datos`
> pendiente — y la hay: `db/migrations/20260731_calendario_meses_cortos.sql`. El
> patrón no casaba, la cuenta caía a **0** y la vuelta atrás **dejaba la base con el
> esquema nuevo bajo la aplicación vieja**, en silencio y sin que nada lo denunciara
> después. Reproducido de punta a punta contra la imagen real y una base desechable.
>
> El mismo `sed` hacía que el código **2** mintiera: con
> `se aplicaron 66 migraciones y no se pudieron registrar` (`migrar.mjs:687-692`,
> alcanzable hoy porque la imagen no lleva `20260812_schema_migrations.sql`), el log
> escribía *«no consta ninguna migración aplicada; suele ser que no pudo conectar»*
> cuatro líneas debajo del mensaje que decía lo contrario — y esa es **la única
> pregunta que el 2 existe para responder**.

**Cómo sabe hoy si la base cambió: preguntándoselo a la base.** No cuenta migraciones
leyendo texto. Toma una **huella** —columnas con sus `DEFAULT`, índices,
restricciones, políticas RLS, funciones, más el contenido de `schema_migrations`—
**antes y después** de migrar, y compara. Tres propiedades que la hacen válida, las
tres medidas contra Postgres real: funciona **aunque `schema_migrations` no exista**
(el hash del esquema ya difiere, que es justo el caso de `migrar.mjs:687-692`); **no
se mueve con el tráfico normal** de la versión anterior, que sigue sirviendo entre las
dos lecturas; y si la huella **no se puede leer antes** de migrar, el update **se para
sin migrar** (código 1). Si no se puede releer después, se **restaura igual**, por
prudencia. El número de migraciones que sale en el log es la diferencia de filas de
`schema_migrations` y es informativo: la decisión cuelga de la huella.

> [!warning] Conmutar es `stop` + `run`: hay corte, y se mide en minutos
> ~10-20 s con un release bueno; **hasta ~3 min** con uno malo (80 s de sondeo de
> salud + el `pg_restore` + otros 80 s sobre la versión anterior). El «el owner no se
> entera» del criterio de F3.4 hay que leerlo como *se queda en la versión anterior y
> no pierde datos*, **no** como *no hay corte*. Cerrarla de verdad —puerto nuevo y
> nginx moviéndose cuando ya conteste— es otra tarea.

**La vuelta atrás y el registro de migraciones.** El dump es de la base entera, así
que `schema_migrations` viaja dentro: restaurarlo devuelve esquema **y** registro al
mismo instante, y la instancia vuelve a afirmar exactamente lo que la imagen anterior
lleva dentro. Si la restauración no llega a correr, el registro nombra migraciones que
la imagen anterior no tiene, y eso **no aborta nada** a propósito ([[migraciones]]):
una imagen anterior carece por definición de las migraciones nuevas que su registro
afirma, y abortar ahí rompería la propia vuelta atrás. Restaurar **solo** se hace si
la huella dice que la base cambió, y **nunca** con la versión anterior sirviendo: un
`pg_restore --clean` sobre una base viva tumbaría una instancia que funciona.

**El arnés está en el repositorio** (`infra/scripts/pruebas-update.sh`), y esa es la
diferencia con la primera versión, que afirmaba «18 escenarios y 58 comprobaciones»
sin que existieran en ningún sitio. Hoy se corre y lo imprime:
`63 escenarios · 300 comprobaciones · 0 rojas` (medido el 18/08 tras corregir la
auditoría de F3.9; venía de `58 · 278` con F3.9, de `51 · 236` tras corregir F3.7, de
`48 · 218` y, antes de F3.7, de `37 · 165`). Los mutantes son **28**; la barrida
completa **no se corrió entera** en el ciclo del 18/08 —a ~25 min por mutante en esta
máquina pasa de diez horas— y en su lugar se corrieron **siete aislados**: los tres
nuevos y los cuatro de F3.9, todos cazados. Está escrito porque la decisión M1 obliga
a declararlo, no a suponerlo. Desde F3.7 los mutantes muerden **también en `respaldo.sh`**, no solo en
`update.sh`. Cada mutante se **valida antes de correrlo** —una sola línea de diff, mismo número de líneas, `bash -n` limpio—
porque un ciclo anterior tuvo un falso verde por un `sed` que dejó el archivo vacío y
«pasó». Entre ellos está **reintentar la migración fallida**, que es el mutante que
corrompería bases, y también los que el arnés no veía en su momento: quitar
`export DATABASE_URL` (rompería **todas** las migraciones de la flota), quitar
`--clean --if-exists --single-transaction` del `pg_restore` (la vuelta atrás moriría
objeto por objeto) y devolver el `|| echo 000` al `curl` de la salud.

### El ensayo local del 18/08: cuatro defectos corregidos y uno pendiente

El ensayo de F3.4 —sin servidor, contra los dobles y con la imagen local— salió
**DEMOSTRADO en los nueve puntos** y dejó **cinco defectos**. Cuatro se arreglaron en
el mismo ciclo, con su escenario en rojo antes del arreglo:

| | Qué pasaba | Cómo quedó |
|---|---|---|
| **D2** | el `\|\| echo 000` concatenaba un segundo código HTTP: `200000` tiraba un release **sano** con `pg_restore` | salida y código de salida de `curl` por separado; `000` solo si no imprimió nada |
| **D3** | los dos códigos `5` de la restauración no decían que la instancia quedaba **caída** ni cómo levantarla | dicen «La instancia queda SIN servicio» y traen el comando de rescate, **calculado** según si el `rename` llegó a hacerse |
| **D4** | el respaldo vacío se quedaba en disco junto a los buenos, **y el directorio no se podaba nunca** | se borra al abortar; y desde F3.7 la retención local es de **3** (arriba). **D4 queda cerrada entera** |
| **D5** | el código `2` con la base intacta **adivinaba** la causa («típicamente no pudo conectar») y en el caso medido era otra | remite al mensaje del runner, que va impreso justo encima |

> [!danger] D1 sigue abierto: la vuelta atrás **no devuelve el esquema entero**
> `pg_restore --clean --if-exists` solo suelta los objetos **que están en el dump**,
> así que los que creó el release fallido **sobreviven** a la restauración. Con una
> migración no idempotente encima, la instancia se queda atascada en **código 2** en
> cada corrida del cron. Toca migraciones —es **ROJO**— y exige una decisión de
> diseño: **no se arregló**, está esperando a Jochelo. Mientras tanto, un `4` significa
> «la instancia volvió», no «la base volvió tal cual estaba».

**La contraseña ya no viaja en `argv`.** `pg_dump`/`pg_restore` reciben la URL sin
credenciales y la clave por `PGPASSWORD`: antes era visible en `ps` para cualquier
usuario local. `deploy.yml:119` lo evita con `sudo -u postgres`; aquí la conexión es
por red, así que se parte la URL.

### El respaldo sale del droplet (18/08, F3.7)

Hasta hoy el `pg_dump` se quedaba en `/var/lib/space-os/respaldos/` y **nadie lo
podaba**. Las dos mitades del problema se cierran aquí, y la lógica vive en un archivo
propio, **`infra/scripts/respaldo.sh`**, que `update.sh` *sourcea*: si no está al lado,
**el update se para antes del `pull`** en vez de actualizar sin red.

El respaldo se sube a
`s3://space-os-respaldos/<instancia>/<AAAA-MM-DD-HHMM>.dump` con `s3cmd put` o, si no
hay `s3cmd`, con `aws s3 cp --endpoint-url https://<region>.digitaloceanspaces.com`.
**`gsutil` no**: es de Google Cloud Storage y no habla con Spaces. Las credenciales
salen de `instancia.env` (`SPACES_KEY`, `SPACES_SECRET`, `SPACES_BUCKET`), son **una
llave por instancia con permiso solo sobre su prefijo** —nunca la maestra de la
cuenta— y **no viajan en `argv`**: con `s3cmd`, en un archivo temporal `chmod 600`
antes de escribirle el secreto dentro **y borrado también si el script muere por una
señal** (`trap`, corregido el 18/08); con la CLI de AWS, por el entorno. Es el mismo
criterio que sacó la contraseña de Postgres de `ps`.

> [!important] La retención es **asimétrica**, y eso es lo importante de la tarea
> **3 respaldos locales**, podados por el script. **30 días en Spaces, podados por la
> regla de ciclo de vida del bucket** — en `respaldo.sh` **no hay un solo borrado
> remoto**, y no es un olvido: *un `rm` mal escrito en un script que corre en todas las
> instancias es una forma elegante de perderlo todo a la vez*. La regla del bucket se
> configura una vez, a mano, y la revisa una persona: **es tarjeta humana, no código**.

La poda local tampoco es un `rm` con glob: `find -maxdepth 1 -type f -name
'spaces_*.dump'` **ordenado por la fecha del archivo** (`-printf '%T@'`), nunca
subdirectorios, nunca menos de 1, y **después** de comprobar que el dump nuevo es
bueno (podar antes sería tirar un respaldo viejo a cambio de nada). Con eso queda
cerrada la **segunda mitad de D4**.

> [!danger] Ordenaba por NOMBRE, y con eso podía borrar el respaldo de la corrida en marcha
> **H1 de la auditoría de `f369b4c`, corregido el 18/08.** `sort` ordena **la ruta**,
> no la antigüedad, así que basta un dump con otro nombre —`spaces_x.dump`, el que
> el propio script documenta para el uso a mano— para que ordene **después** de
> `spaces_2026…` y cuente como «de los más recientes». El que sobraba pasaba a ser
> **el de la corrida en marcha**.
>
> Lo grave es la cadena: la poda va **antes** de la subida, así que sin ese archivo
> la subida se salta, el log escribe `RESPALDO REMOTO FALLIDO` sin que haya fallado
> ninguna subida, y si el release sale malo el `pg_restore` de la vuelta atrás
> apunta a un archivo que ya no existe —instancia **sin servicio, sin respaldo
> local y sin respaldo remoto**—. Nadie lo había visto porque el arnés **solo
> sembraba nombres con formato de fecha**; ahora lo cazan **E49** y un mutante
> propio, y las cinco defensas que ya estaban bien —solo archivos regulares que
> casen el patrón, `LEEME.txt`, subdirectorios que casen el patrón, nombres que
> empiezan por guion y rutas con espacios— se reverificaron una a una.
>
> Dos más del mismo repaso: la línea de resumen contaba lo que **iba** a retirar
> —con los `rm` fallando decía «3 retirados» con los 6 dumps intactos— y ahora
> cuenta lo retirado, devolviendo **!= 0** si no pudo con todos; eso además hace
> **alcanzable** el `if !` de `update.sh`, que la auditoría había marcado como rama
> muerta. Y el temporal con la llave de Spaces tenía `rm -f` **solo** en el camino
> feliz: con un SIGTERM a media subida sobrevivía en el disco (H4). Ahora hay
> `trap` para `TERM`, `INT`, `HUP` y `EXIT`, y lo comprueba **E51** matando al
> script de verdad a media subida. Un detalle que salió de medirlo: **bash corre el
> `trap` de `EXIT` también cuando lo mata una señal**, así que el borrado ya lo
> garantiza ese solo; los de `TERM`/`INT`/`HUP` estan por la línea de log y por el
> código de salida. Se comprueban por separado porque el primer mutante que quitaba
> uno **escapaba**.

**Si la subida falla, el update sigue** —el respaldo local ya existe y con él se vuelve
atrás— pero el log escribe `RESPALDO REMOTO FALLIDO`, pensado para buscarse con
`grep`. Que además salga en el **reporte de flota** es **F6.4**, que no existe todavía:
hoy solo está en el log de la instancia. Y si no hay credenciales, no es un fallo sino
una instancia sin respaldo remoto configurado: el log lo dice así
(`respaldo remoto NO CONFIGURADO`).

> [!warning] Escrito y probado contra dobles; **el bucket no existe todavía**
> Crear el bucket, emitir **una llave por instancia limitada a su prefijo** y poner la
> **regla de ciclo de vida de 30 días** son pasos de servidor: salen como tarjeta
> humana en `infra/scripts/README.md` §7, con su comando y su respuesta esperada. El
> comando de verificación de F3.7 —`s3cmd ls s3://space-os-respaldos/demo/ | tail -3`—
> **no se ha corrido**, y no puede correrse desde aquí.

### El log sale del droplet, y va filtrado (18/08, F3.9)

El modelo prohíbe entrar por SSH a la máquina de un owner, así que una actualización
fallida hay que poder diagnosticarla **desde fuera**. Al terminar —**salga bien o
mal**— `update.sh` sube su registro a
`s3://space-os-logs/<instancia>/<AAAA-MM-DD-HHMM>.log`, con **90 días** de retención
por **regla de ciclo de vida del bucket** (aquí tampoco hay un solo borrado remoto,
por la misma razón que en F3.7). Reutiliza el cliente y la disciplina de credenciales
de `respaldo.sh` —la llave no viaja en `argv`— pero **es otro bucket**: `space-os-logs`
no es `space-os-respaldos`, y son dos reglas de retención y posiblemente dos permisos.

> [!danger] El criterio de aceptación va en **negativo**, y el archivo que ya existía **no lo cumplía**
> «**Ni un dato de negocio aparece en el log.**» Y en `update.log` cae, por `eco`, la
> salida **cruda** de las herramientas: el runner de migraciones —un error de Postgres
> arrastra **la fila que lo provocó**: `Ya existe la llave (tenant_id, rfc)=(…)`—,
> `pg_dump`, `pg_restore`, la sonda de huella y, la peor, **`docker logs --tail 30`
> del contenedor nuevo** en el paso 7, que son los registros de **la aplicación**:
> rutas, cuerpos, correos, importes.
>
> Así que la tarea **no era «añadir una subida»**: era **separar lo que el script
> emite de lo que emiten sus herramientas**. Se midió antes de diseñar.

Hay **dos** logs, y una sola regla los separa:

| Archivo | Qué lleva | Quién lo escribe | Dónde vive |
|---|---|---|---|
| `/var/log/space-os/update.log` | **todo**, crudo, acumulado desde que nació la instancia | `registrar` **y `eco`** | solo el droplet |
| `/var/log/space-os/update-publicable.log` | **solo esta corrida**, y solo las líneas del propio script **más su código de salida** | `registrar`, y nadie más | **es lo que viaja al bucket** |

Toda la separación cabe en las dos funciones de la «Bitácora» de `update.sh`:
`registrar` escribe en los dos archivos, `eco` **solo en el local**. No hay lista de
palabras prohibidas ni filtro por expresión regular —un filtro se olvida de un caso y
nadie se entera—: **lo que no se emite no puede filtrarse.** El publicable se **vacía
al empezar**, ya dentro del candado; subir el acumulado sería mandar al bucket, cada
noche, todo lo que la instancia registró desde siempre.

> [!tip] Filtrar no es perder
> Lo crudo **sigue entero en el droplet** para quien tenga que entrar; lo que cambia es
> que ya casi nunca hace falta. Una vuelta atrás completa, leída **solo desde el
> bucket** (medido con el arnés el 18/08): pull, respaldo, huella previa, los dos
> intentos de salud con su `500`, `7 · VUELTA ATRAS`, la restauración y `salida: 4`.
> **Ni una fila y ni una credencial** —eso es el criterio, y se comprueba abriendo el
> archivo que viaja (E53, E62, E63)—.
>
> Lo que **sí** sale, dicho con nombres: el **destino de la base**
> (`base=localhost:5433/spaces`, sin el `usuario:clave@`), la **URL de la imagen** en
> el registry y la **ruta local del dump**. Nombres de tabla no salen porque la huella
> es un hash, pero eso es una consecuencia, no una promesa. Todo ello está **dentro**
> de lo que el plan permite —«nombres y conteos, sí; filas, no»—; lo que estaba de más
> era la redacción anterior, «ni siquiera un nombre de tabla», que sugería una asepsia
> mayor que la real. Corregida el 18/08.

> [!danger] La contraseña de Postgres: la promesa era cierta **y la función que la
> sostiene no lo era**
> Cada línea que nombra la conexión pasa por `destino_de_url`, que corta el
> `usuario:clave@` —el mismo criterio que sacó `PGPASSWORD` de `ps`—, y su salida es la
> **primera línea de todo log que viaja**. Pero cortaba por el **primer `@`** y daba por
> hecha una URL bien formada. Medido el 18/08, con la función tal como estaba:
>
> | `DATABASE_URL` | lo que viajaba |
> |---|---|
> | `…spaces:cl%40ve@localhost:5433/spaces` | `localhost:5433/spaces` ✅ |
> | `…spaces:p@ssw0rd@localhost:5433/spaces` | `ssw0rd@localhost:5433/spaces` — **trozo de la clave** |
> | `…spaces:pa/ss@localhost:5433/spaces` | `spaces:pa/ss@localhost:5433/…` — **usuario y clave enteros** |
>
> La función es anterior a F3.9; lo que F3.9 le cambió fue **el perfil de riesgo**: lo
> que se quedaba en el droplet pasó a salir a un bucket. Ahora corta por el **último**
> `@` y después de quitar la consulta, y **E62 y E63** cubren los dos casos que el arnés
> no ejercitaba —solo probaba el `%40`, que era el que ya funcionaba—.

> [!warning] Los límites, escritos para que nadie los descubra tarde. Son **seis**
> **La subida cuelga de `salir()`**, que es la única puerta de salida una vez tomado el
> candado. Si el proceso muere por una **señal** o por un error no previsto, **no hay
> log en el bucket**. Un `trap EXIT` parecía la respuesta y **no lo es**: `respaldo.sh`
> hace `trap - EXIT INT TERM HUP` al cerrar su subida, así que el trap quedaría
> **desarmado justo en la segunda mitad** del script —la mitad en la que las cosas salen
> mal—, y un trap que deja de existir a medias es peor que ninguno porque hace falsa la
> documentación. Cerrarlo de verdad exige tocar `respaldo.sh`, que está auditado:
> **reportado, no arreglado.**
>
> Por esa puerta pasan **seis de los siete** códigos, no los siete: el **`75`** lo
> devuelve el proceso de fuera del candado con un `exit` pelado, a propósito.
>
> **Antes de leer `instancia.env` no hay con qué subir**: el cliente de S3 sale de
> `respaldo.sh`, que se sourcea **justo después** de la configuración. Los dos únicos
> `salir` anteriores —falta `flock`, falta el propio archivo— se quedan en el droplet, y
> ahora el log **lo dice** en vez de callárselo (E61).
>
> Una subida que **falla** no cambia el código de salida, pero una **señal a media
> subida sí**: los `trap` de `respaldo.sh` salen con `130`/`129`/`143`. Esa ventana
> existía ya en el paso 3 y ahora existe en **todas** las salidas, incluida la buena.
> Mismo dueño que el punto anterior: `respaldo.sh`, **escrito y no arreglado**.
>
> Y el proceso de **fuera** del candado —el que se encuentra otro update en marcha y
> sale con `75`— no escribe ni sube nada: el publicable es de la corrida que **tiene**
> el candado.

> [!danger] Dos de esas afirmaciones eran **falsas cuando se escribieron**, y una se
> reprodujo
> La auditoría del 18/08 abrió los tres documentos que las sostienen y comprobó el
> código:
>
> - **«el proceso de fuera no escribe ni sube nada».** `SPACE_OS_UPDATE_EN_CANDADO=1`
>   se **exportaba** antes del `flock`, así que cuando `flock -n -E 75` devolvía 75 sin
>   ejecutar al hijo, el proceso de fuera **conservaba la variable** y su línea de «ya
>   hay otro update en marcha» acababa dentro del **`update-publicable.log` de la otra**
>   **corrida** — y viajaba al bucket dentro de su objeto. Reproducido con un doble de
>   `flock`. Ahora la marca se le pasa al hijo **en la misma línea** del `flock`.
> - **«al terminar —salga bien o mal— subir».** No se cumplía en **doce** salidas. Hoy
>   viajan **nueve** de ellas. Las tres que siguen sin poder no tienen con qué subir por
>   definición: falta `instancia.env` y falta `respaldo.sh` —esas dos **lo dicen** ahora
>   en el log local (E61)—, y falta `flock`, que sale **antes del candado** y por eso no
>   llega a tener log publicable propio. Las doce eran `salir "$EX_CONFIG"` que
>   caían **antes** de que `respaldo.sh` estuviera sourceado, y son
>   precisamente los fallos de una **instancia mal aprovisionada**, la clase que uno más
>   quiere diagnosticar sin entrar. Ahora `respaldo.sh` se sourcea justo después de
>   `instancia.env` — y no antes, porque deriva `SPACES_ENDPOINT` de `SPACES_REGION` al
>   sourcearse y se llevaría el endpoint equivocado.
>
> **El arnés no las veía**: su escenario del candado afirmaba `no_hubo s3cmd` —la mitad
> «no sube»— y **nunca abría el archivo que viaja**. De ahí E59, E60 y E61.

Una subida fallida **no cambia el código de salida** —sería cambiar lo que el cron lee
por un problema de red— pero deja `LOG REMOTO FALLIDO` en el log local. Sin
`SPACES_KEY`/`SPACES_SECRET` no es un fallo: es una instancia sin diagnóstico remoto
configurado, y se dice así (`log remoto NO CONFIGURADO`).

> [!warning] El bucket **no existe todavía**, y la primera revisión es **a ojo**
> Crear `space-os-logs`, dar a la llave de cada instancia permiso sobre su prefijo
> **también en este bucket** (con la de F3.7 a secas, la subida da `403`) y poner la
> **regla de 90 días** son pasos de servidor: tarjeta humana en
> `infra/scripts/README.md` §8. El comando de verificación de F3.9
> —`s3cmd get s3://space-os-logs/demo/$(date +%F)*.log - | head -40`— **no se ha
> corrido**. Y la última mitad del criterio es trabajo de una persona: **la primera
> subida de cada instancia se lee entera a ojo** y lo que se encontró se anota en
> `docs/Registro_Cambios.md`. Un log es una vía de fuga clásica, y la revisión mecánica
> solo cubre lo que alguien pensó en comprobar.

## Producción

| Pieza | Valor |
|---|---|
| Host | droplet DigitalOcean, IP vieja `209.97.146.136` (301 al dominio) |
| Dominio | `https://demo.space-os.io` |
| Ruta pública | `https://demo.space-os.io/spaces-dooh/` (`basePath`) |
| Directorio | `/var/www/Spaces` |
| Proceso | pm2 `spaces-web`, fork, 1 instancia, puerto 3000 |
| Usuario | `emiliano` (pm2 es por usuario: el daemon vive en `/home/emiliano/.pm2`) |
| Base | `spaces_prod`; las migraciones se aplican como `postgres` |
| Env | `apps/web/.env.production` (en el servidor, **no** en git) |
| Reverse proxy | nginx, `infra/nginx/demo.space-os.io.conf` |

> [!danger] `X-Forwarded-For $remote_addr` es deliberado
> `infra/nginx/demo.space-os.io.conf:123` **reemplaza** la cabecera en vez de
> añadir a la que mande el cliente. Eso es lo que impide que alguien elija su
> propio cubo de rate limit. Si se cambiara a `$proxy_add_x_forwarded_for`, el
> limitador del login se vuelve burlable mandando una IP inventada.

`infra/nginx/spaces.conf` y `infra/apache/spaces.conf` están **obsoletos**
(asumen el API Fastify archivado).

### `basePath` + `trailingSlash`: la trampa recurrente

`apps/web/next.config.mjs:19-20` fija `basePath: '/spaces-dooh'` y
`trailingSlash: true`. Toda URL absoluta que se registre en un tercero debe
llevar la barra final o la app responde 308 y el tercero no la sigue. Ya costó
un redespliegue con la ruta del logo, y `DESPLIEGUE_GOOGLE.txt:49-56` lo repite
para el redirect URI de Google.

## Variables de entorno

> Solo **nombres**. Los valores viven en `.env.production` del droplet y nunca
> deben copiarse aquí. `.gitignore:9-23` cubre `.env`, `.env.production` y los
> respaldos `.env*.bak*`.

### En uso por el código

| Variable | Para qué | Evidencia |
|---|---|---|
| `DATABASE_URL` | Conexión Postgres | `lib/server/db.ts:23` |
| `NODE_ENV` | Modo, default de `Secure`, pool en dev | `lib/server/auth.ts:187` |
| `COOKIE_SECURE` | Fuerza/apaga `Secure` en cookies | `lib/server/auth.ts:184-188` |
| `APP_URL` | Base de enlaces en correos | `app/api/auth/forgot/route.ts:50` |
| `HSTS` | Activa Strict-Transport-Security | `next.config.mjs:51` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo saliente | `lib/server/email.ts` |
| `RECORDATORIOS_TOKEN` | Autentica el cron; sin él la ruta da 503 | `app/api/recordatorios/route.ts` |
| **`AUTOREGISTRO`** | **solo `'1'` enciende** el alta pública; **ausente = apagado**. Se lee en cada petición, no se hornea (F2.6, 14/08) | `lib/entorno.ts` · `app/api/signup/route.ts:21-26` |
| `NEXT_PUBLIC_RECUPERAR_PASSWORD` | Apaga recuperar contraseña | `app/api/auth/forgot/route.ts:18` |
| `NEXT_PUBLIC_MAPTILER_KEY` | Mapas | `components/maps/SitiosMap.tsx` |
| `DO_SPACES_KEY/SECRET/ENDPOINT/BUCKET/CDN_URL` | Almacenamiento S3 | `lib/server/storage.ts:12-16` |
| `GOOGLE_OAUTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Acceso con Google | `lib/server/google-oauth.ts` |
| `SPACE_EYE_BASE_URL/USER/PASS` | Verificación por cámaras | `lib/server/space-eye.ts:20-22` |
| `DOOHMAIN_*` (5) | Publicación en pantallas vía SDK Python | `lib/server/doohmain.ts:8-13` |
| `ADMOBILIZE_API_KEY`, `CMS_API_TOKEN`, `CFDI_PAC_KEY` | Conectores en modo demo | `lib/server/integraciones.ts` |
| `TZ` | Zona horaria | — |

### Solo pruebas
`DATABASE_URL_TEST`, `DATABASE_URL_TEST_APP`, `PUERTO_E2E`,
`PUERTO_DOBLE_GOOGLE`, `GOOGLE_DOBLE_SUB`, `GOOGLE_DOBLE_EMAIL`,
`GOOGLE_AUTH_ENDPOINT`, `GOOGLE_TOKEN_ENDPOINT`, `SEED_PASSWORD`, `SMOKE_BASE`.

### Declaradas pero **no leídas** por `apps/web`

`JWT_SECRET`, `REDIS_URL`, `LOG_LEVEL`, `NEXT_PUBLIC_TENANT_SLUG` y
`NEXT_PUBLIC_API_URL` (esta última solo la lee el `auth-context.tsx` muerto).
Son restos del backend archivado.

**`COOKIE_DOMAIN` ya no la declara ninguna plantilla del repo.** Salió de
`.env.example:4` en F0.3 (14/08, valor `localhost`) y de `.env.production.example:9`
en T-03 (14/08, valor `.{TENANT_SLUG}.spaces.com`). No la lee ni una línea de
`apps/`. En las dos plantillas quedó un comentario diciendo **por qué** no va, que es
lo que impide que alguien la «reponga» creyendo que faltaba.

> [!danger] Lo que decía la plantilla de PRODUCCIÓN hasta el 14/08 — y por qué era lo peor
> `.env.production.example:9` declaraba `COOKIE_DOMAIN=.{TENANT_SLUG}.spaces.com`:
> una cookie **comodín de segundo nivel** del modelo de subdominios por tenant,
> **muerto desde el 2026-08-12**. Y es la plantilla que se copia para montar una
> instancia real, no la de desarrollo.
>
> Era inocuo porque `apps/web` no lee la variable. Era **latente** porque el
> código que sí la consume sigue en el repo
> (`_archive/api/src/core/auth/auth.routes.ts:17` hace
> `domain: process.env.COOKIE_DOMAIN`): el día que alguien hiciera configurable el
> `domain` de `cookieSesion()`, los `.env` nacidos de esa plantilla habrían
> convertido la sesión en compartida por todo `*.spaces.com` — **fuga entre
> instancias soberanas**, R1 y R2 a la vez, y en silencio. Además mandaba al
> operador a pedir DNS y certificados comodín para un modelo que ya no existe.
>
> **Ninguna tarea del plan la limpiaba**: F5.3 crea una plantilla *nueva*
> (`infra/env/instancia.env.example`) sin esa variable, pero no tocaba esta. Quedó
> huérfana hasta T-03, que es una tarea fuera del plan.

> [!important] Las DOS plantillas las vigila una prueba desde el 14/08
> `apps/web/lib/entorno.test.ts` lee `.env.example` **y** `.env.production.example`
> desde la raíz del repo, y exige de cada una lo mismo: que diga `AUTOREGISTRO=0` y
> que **no** declare un `COOKIE_DOMAIN` con valor. F0.3 puso los dos primeros casos
> (desarrollo) y T-03 los dos segundos (producción), porque el candado de F0.3
> **cubría una sola plantilla** y la otra guardaba la peor de las dos líneas.
>
> Antes no había nada así — la decisión del 14/08 («autoregistro cerrado en toda la
> flota») la sostenía un valor en una plantilla que nadie miraba, y devolverlo a
> `=1` dejaba `npm test` en verde y al CI mudo. Comprobado que muerde en las dos:
> con la plantilla en `=1`, sus casos se ponen rojos. `autoregistroActivo()` es
> fail-closed, pero eso solo salva a quien **no** declara la variable: quien copia
> una plantilla se lleva lo que diga.
>
> Los dos casos de producción leen el archivo **dentro** del `it`, no al cargar el
> módulo como los de F0.3: si la plantilla desapareciera debe caer el caso que la
> mira, no el fichero entero por un error de importación.
>
> Las cookies son **host-only a propósito** — `cookieSesion()`
> (`lib/server/auth.ts:191-201`) y `cookieCsrf()` (`:216-226`) no fijan
> `domain`, y es el **invariante 4** del plan v3
> (`docs/Plan_Instancias_Soberanas_v3.md:219`): cada instancia manda su cookie y
> ninguna sesión cruza de dominio. Ver [[modelo-instancias-soberanas]].

> [!note] Discrepancia `RESEND_FROM`/`EMAIL_FROM` — **corregida el 07/08**
> La plantilla declaraba `RESEND_FROM` y el código lee `EMAIL_FROM`. Se comprobó
> contra el `.env.production` real del droplet: gana **`EMAIL_FROM`**, y la
> plantilla ya lleva el nombre bueno más la advertencia de «las dos o ninguna»
> (`e7c3517`). Quien desplegara con la plantilla vieja se quedaba **sin correo y
> sin aviso**, porque `emailHabilitado()` exige las dos y devuelve `false` en
> silencio. Ver [[preguntas-abiertas]] P1.

## Relacionadas
[[vision-general]] · [[stack-y-dependencias]] · [[migraciones]] ·
[[zonas-de-riesgo]] · [[integraciones-externas]] · [[MOC-Proyecto]]
