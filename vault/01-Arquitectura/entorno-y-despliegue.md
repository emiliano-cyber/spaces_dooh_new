---
tipo: arquitectura
estado: verificado
actualizado: 2026-08-14
tags: [despliegue, entorno, ci, env, instancias]
archivos:
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
  - .github/workflows/deploy.yml
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
| `lockfile-check.yml` | push + PR | `npm ci --dry-run` (Node 22) |
| `deploy.yml` | **`workflow_dispatch` manual** | backup → build → migraciones → `pm2 reload` |

> [!warning] No hay despliegue continuo
> `deploy.yml` solo corre a mano y **está desactualizado**. El despliegue real es
> manual por SSH. `ci.yml:1-30` documenta que el disparador es `pull_request` y
> **no** `pull_request_target` a propósito: el segundo daría secretos a código de
> un fork. No cambiarlo.

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
| `NODE_ENV` | Modo, default de `Secure`, pool en dev | `lib/server/auth.ts:191` |
| `COOKIE_SECURE` | Fuerza/apaga `Secure` en cookies | `lib/server/auth.ts:188-192` |
| `APP_URL` | Base de enlaces en correos | `app/api/auth/forgot/route.ts:50` |
| `HSTS` | Activa Strict-Transport-Security | `next.config.mjs:51` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo saliente | `lib/server/email.ts` |
| `RECORDATORIOS_TOKEN` | Autentica el cron; sin él la ruta da 503 | `app/api/recordatorios/route.ts` |
| **`AUTOREGISTRO`** | **solo `'1'` enciende** el alta pública; **ausente = apagado**. Se lee en cada petición, no se hornea (F2.6, 14/08) | `lib/entorno.ts` · `app/api/signup/route.ts:19-20` |
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
