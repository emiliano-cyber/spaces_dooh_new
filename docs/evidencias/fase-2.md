# Instancias Soberanas · Fase 2 — Expediente de cierre **PARCIAL**

Rama: `feat/servidor-padre-instancias` (worktree `.claude/worktrees/servidor-padre`)
Fecha: **2026-08-14** · HEAD al levantar el expediente: `42c0f4e`
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 2 (`:675-915`)

> [!danger] La Fase 2 **NO está completa**. Esto es un cierre parcial.
> De sus **seis** tareas, **dos siguen BLOQUEADAS por una decisión de negocio
> abierta**: **F2.3** (workflow de release) y **F2.4** (promoción a `estable`)
> esperan **P4 · el nombre del registry**. Sin ese valor no hay canal `beta`, no
> hay canal `estable` y **ninguna instancia puede jalar nada**: la fase entrega
> una imagen que hoy solo existe en la máquina donde se construyó.
> Verificado al escribir esto: `.github/workflows/` contiene `ci.yml`,
> `deploy.yml` y `lockfile-check.yml` — **no existen `release.yml` ni
> `promover.yml`**; `git tag -l` no devuelve ningún `v*.*.*`; y `grep -rn REGISTRY
> .github/` no devuelve nada.

> [!important] Alcance: **ejecución LOCAL**. No incluye servidor.
> Todo lo que este expediente da por probado se probó en esta máquina: `docker
> build` local, contenedores en `localhost:3000` y Postgres del
> `db/docker-compose.yml` (5433). **No se tocó el droplet `209.97.146.136`, ni
> `spaces_prod`, ni ningún registry.** No hay TLS, no hay nginx, no hay dominio y
> no hay imagen publicada. Nada de la Fase 2 está desplegado: la rama no está
> mergeada a `main`.

Este documento es histórico: registra lo que era cierto el 2026-08-14. La
descripción de cómo funciona el sistema hoy vive en `vault/` y caduca; esto no.

---

## 1. Qué se hizo — el cuadro de la fase

| Tarea | Tipo | Estado final | Commit | Veredicto |
|---|---|---|---|---|
| **F2.1** · El build produce un artefacto autocontenido | código | COMPLETADA_LOCAL | `8ae8f77` | AMARILLO |
| **F2.2** · `Dockerfile` de `apps/web` | infra → código | COMPLETADA_LOCAL | `3f16386` | **VERDE** |
| **F2.3** · Workflow de release → canal `beta` | release | **BLOQUEADA por P4** | — | — |
| **F2.4** · Promoción manual a `estable` | release | **BLOQUEADA** (arrastre de F2.3) | — | — |
| **F2.5** · Smoke de la imagen | verificación | **ENSAYADA_LOCAL ×2** | — (el ensayo no produce commit) | — |
| **F2.6** · La bandera del autoregistro sale del build | código | COMPLETADA_LOCAL | `70ca3f0` | AMARILLO |

*«Veredicto» no es lo mismo que «zona de riesgo».* El veredicto dice si la tarea se
acepta; la zona dice si el commit necesita visto bueno humano antes del merge.
**`70ca3f0` es ROJO por zona** — ver §12.

El hilo narrativo de la fase es la secuencia **F2.5 → F2.6 → F2.5**: el primer
ensayo de F2.5 destapó un defecto que ninguna tarea había previsto, F2.6 lo arregló,
y el segundo ensayo lo confirmó con la misma imagen. Está contado en §5, §6 y §7.

Rango de commits, verificado hoy con `git log --format='%h %ad %s' --date=short` y
`git rev-list --count fef7499..42c0f4e` (= 15, más el propio `fef7499` = **16**): de
`fef7499` (13/08, P4-bis resuelta) a `42c0f4e` (14/08). De esos 16, **12 son de la
Fase 2** —tres de código (los de la tabla) y nueve de orquestación, bóveda o
entorno— y **4 son de otra cosa**: el cierre de la Fase 1 (`fb09b91`, `13e0a53`) y
la infraestructura del agente documentalista (`2091646`, `3634a75`).

---

## 2. Qué se creó y qué se tocó (verificado con `git show --stat`)

| Commit | Archivos | Alcance |
|---|---|---|
| `8ae8f77` (F2.1) | `apps/web/next.config.mjs` (+11), y 6 notas de bóveda | **7 archivos, 60 inserciones / 11 borrados.** Ningún archivo nuevo |
| `3f16386` (F2.2) | **`Dockerfile` (nuevo, 107 líneas)**, **`.dockerignore` (nuevo, 58 líneas)**, `vault/01-Arquitectura/entorno-y-despliegue.md`, `tablero.md` | 4 archivos, 214 inserciones |
| `70ca3f0` (F2.6) | **`apps/web/lib/entorno.ts` (nuevo, 28)**, **`apps/web/lib/entorno.test.ts` (nuevo, 39)**, `login/page.tsx`, `api/auth/metodos/route.ts`, `api/signup/route.ts`, `lib/server/google-oauth.ts`, `lib/test/servidor-e2e.ts`, `lib/test/google-oauth.e2e.test.ts`, `.env.example`, `.env.production.example`, **`docs/Registro_Cambios.md`**, y 7 notas de bóveda | **18 archivos**, 294 inserciones / 92 borrados |

Commits de acompañamiento, todos de documentación salvo donde se dice:

| Commit | Qué hizo |
|---|---|
| `fef7499` | Registra **P4-bis resuelta** hacia la salida (b), lo que desbloquea F2.6 |
| `97d6eef` | Corrige en `CLAUDE.md` el conteo de las e2e: `12 archivos, 136 + 1 saltada` → **`13, 140 + 1`**, y añade «**crecen**: remídelas, no las copies» |
| `bc261e0` · `e8b0980` · `d5557bc` · `6e119e5` | Actas de F2.1, F2.5, F2.2 y del reensayo, en `ejecucion-plan-v3.md` |
| `0dbccb8` | **Toca `.env.example`**: `AUTOREGISTRO` baja de `1` a `0` (decisión P3b-bis) |
| `39379bf` | **Toca `.env.production.example`**: la DEMO también cerrada |
| `42c0f4e` | Mueve los expedientes a `docs/evidencias/` (renombra `fase-1.md`, 0 cambios de contenido) |

Los archivos citados existen hoy en el árbol y su contenido corresponde al que
describen los commits. Comprobado archivo por archivo, no por el reporte.

---

## 3. Evidencia — F2.1, el artefacto autocontenido

**Qué cambió** (`apps/web/next.config.mjs`, leído hoy):

- `:13` `output: 'standalone'`
- `:17` `outputFileTracingRoot: path.join(__dirname, '../../')` — la raíz del
  monorepo, porque con npm workspaces las dependencias quedan *hoisted* y desde
  `apps/web` el trazado saldría corto.
- `:19-20` `basePath: '/spaces-dooh'` y `trailingSlash: true` — **se desplazaron**
  desde `:8-9`, y eso rompió citas ajenas (§11).

**Lo que produce**, medido hoy sobre el build local (`apps/web/.next/`, marca de
tiempo 13:21 del 14/08):

```
apps/web/.next/standalone/apps/web/server.js        5 836 bytes
apps/web/.next/standalone/node_modules              33 paquetes hoisted
apps/web/.next/standalone/apps/web/.next/           BUILD_ID, manifests, server/
apps/web/.next/standalone/apps/web/public           No such file or directory
```

**El standalone NO trae los estáticos, y eso es correcto.** No hay `public/` ni
`.next/static/` dentro: `copyTracedFiles` de Next no los copia por diseño.
Copiarlos es paso del `Dockerfile` (`Dockerfile:88-89`), no un defecto de F2.1. La
auditoría lo confirmó por tres vías independientes (`ejecucion-plan-v3.md:231`).

### El hallazgo de F2.1 que sostiene toda la seguridad de F2.2

> [!danger] El artefacto standalone **se lleva el `.env` dentro**, y no avisa
> Reverificado por mí hoy:
>
> ```
> $ md5sum apps/web/.next/standalone/apps/web/.env apps/web/.env
> 6032654f128e31039ea277311315120c *apps/web/.next/standalone/apps/web/.env
> 6032654f128e31039ea277311315120c *apps/web/.env
> $ grep -c "^GOOGLE_CLIENT_SECRET=" apps/web/.next/standalone/apps/web/.env
> 1
> ```
>
> Byte a byte el mismo archivo, con `GOOGLE_CLIENT_SECRET` dentro. **No hay fuga a
> git** (`git ls-files apps/web/.env` → 0 archivos; `.gitignore:14` lo cubre) y no
> incumple ningún criterio de F2.1.
>
> **Consecuencia para F2.2:** si un `.env` entra al contexto de `docker build`,
> Next lo hornea en el standalone **sin decir nada**, y la imagen que corren todas
> las instancias saldría con las credenciales de una. Por eso la línea `**/.env*`
> del `.dockerignore` **no es opcional**, y por eso el criterio de F2.2 se comprueba
> **dentro de la imagen** y no leyendo el `.dockerignore`.

Ese razonamiento quedó escrito donde se va a leer: `.dockerignore:6-12`, encima de
la propia línea `**/.env*` (`:13`).

**Verificación de F2.1.** El comando exacto del plan (`:708`) es
`cd apps/web && npm run build && ls .next/standalone/apps/web/server.js && npm test
&& npm run test:e2e`. La auditoría lo corrió el 14/08 y además levantó **las dos
formas de arrancar** — `npm start` (la que usa `ecosystem.config.js` en el droplet)
y `node .next/standalone/apps/web/server.js` —, con **200** en `/spaces-dooh/login/`
y **307** en la raíz del `basePath` en ambas: producción no se queda sin arrancar
(`ejecucion-plan-v3.md:230`). Yo hoy reverifiqué la existencia del `server.js` y
volví a correr las unitarias (§14); **no re-corrí las e2e** (§15).

---

## 4. Evidencia — F2.2, la imagen, y cómo se probó que no lleva credenciales

**Qué es** (`Dockerfile`, leído hoy, 107 líneas): tres etapas sobre `node:20-alpine`.

| Etapa | Qué hace | Líneas |
|---|---|---|
| `deps` | `libc6-compat` (los binarios de SWC y turbo son glibc), solo los manifiestos, `npm ci` **y nunca `npm install`** | `:15-38` |
| `build` | Copia el árbol entero de `deps` —no solo `node_modules`, porque npm anida dentro de algunos workspaces— y `npx turbo run build --filter=web` | `:43-59` |
| `runtime` | `NODE_ENV=production`, `PORT`/`HOSTNAME=0.0.0.0`, `ARG VERSION` → `ENV SPACE_OS_VERSION`, el standalone, los estáticos, `public/`, **`db/`**, `USER node`, `EXPOSE 3000` | `:64-107` |

Las dos decisiones que importan al modelo de instancias:

- **`Dockerfile:94-95`** copia `db/schema.sql` y `db/migrations` a `/app/db`. Es lo
  que sostiene el invariante 1: en el servidor de una instancia **no hay repo
  clonado**, así que el runner de la Fase 3 lee las migraciones de ahí.
- **`Dockerfile:78-79`** sella la versión en el artefacto para `/api/version` (F6.1).

### Lo que verifiqué yo, dentro de la imagen

La imagen `space-os:dev` (`sha256:ce261aed…`, construida el 14/08 a las 12:13, **es
la de F2.2, anterior a F2.6**) sigue viva en esta máquina. Corrí sobre ella:

```
$ docker run --rm space-os:dev sh -c 'ls /app/db; ls /app/db/migrations | wc -l; whoami; echo $SPACE_OS_VERSION'
migrations
schema.sql
67
node
v0.0.0-dev

$ docker run --rm space-os:dev sh -c 'ls -a /app /app/apps/web' | grep -i '\.env' && echo 'FALLO' || echo 'ok: sin .env'
ok: sin .env
```

67 migraciones + `schema.sql` = **68 archivos**, y el plan (`:749`) pedía «66 o
más». Comprobé además que son **los mismos bytes** que los del repo, comparando el
md5 de cada archivo:

```
$ docker run --rm space-os:dev sh -c 'cd /app/db && (md5sum schema.sql; md5sum migrations/*.sql) | awk "{print \$1}" | sort | md5sum'
886ff521d2d75225d188291d0ed786ba
$ (cd db && (md5sum schema.sql; md5sum migrations/*.sql) | awk '{print $1}' | sort | md5sum)
886ff521d2d75225d188291d0ed786ba
```

Sin corrupción de finales de línea pese a construirse desde un host Windows.

### El control positivo — la diferencia entre «busqué y no encontré» y «probé que mi búsqueda funciona»

Esto es lo mejor que hizo la fase, y por eso F2.2 es el único **VERDE**. La
auditoría no se limitó a buscar secretos en la imagen: **montó un control positivo**
(`ejecucion-plan-v3.md:217`). Extrajo los valores literales de `apps/web/.env` y
`.env.local`, comprobó que ese juego de patrones **sí acierta** sobre un artefacto
donde el `.env` sí está —el `standalone` local— y **solo entonces** afirmó que en la
imagen no aparece ninguno. También materializó el stage `build` para ver que el
`.env` **nunca entra al contexto**, en vez de conformarse con que no esté al final.

**Lo reproduje hoy, de forma independiente**, con este método (el archivo de
patrones se creó fuera del repositorio y se borró al terminar; ningún valor se
transcribe aquí):

| Paso | Resultado |
|---|---|
| Extraer de `apps/web/.env` + `.env.local` los valores de ≥ 8 caracteres | **11 patrones** — el mismo número que reportó la auditoría |
| **Control positivo:** cuántos de esos 11 aparecen en `apps/web/.env` | **4** (los otros 7 son de `.env.local`) |
| **Control positivo:** cuántos aparecen en `.next/standalone/apps/web/.env` | **4** — el método detecta el `.env` cuando lo hay |
| **Negativo:** `grep -r -a -l -F -f patrones /app` dentro de `space-os:dev` | **0 coincidencias** |

Un cero **con** control positivo detrás es una afirmación; un cero sin él es un
cero vacuo. Este tiene el control positivo.

### Lo que la imagen NO se lleva, y sí hace falta

`db/dev-rol-app.sql` **no viaja** (el `COPY` es de `schema.sql` y `migrations/`, y
el `ls /app/db` de arriba lo confirma). Aunque viajara, no serviría: se declara
«SOLO DESARROLLO» en `:2`, crea el rol `spaces_app` con contraseña en claro, y en
producción el rol es `spaces_user` (`:4`). Esto es la raíz del hallazgo de §8.1.

---

## 5. Evidencia — F2.5, primer ensayo: el 503 salía por el motivo contrario

El smoke literal del plan (`:853-857`) dio en verde a la primera:

```
login   200
metodos 200
signup  503
estado  401
```

Y lo que más importaba de F2.1: **el login carga con estilos**. Los activos que la
página pide responden 200 y el CSS grande trae **707 reglas** con las utilidades del
login dentro — no es un 200 vacío. El `COPY` de `.next/static` y `public` está bien
hecho: **no hay que volver a F2.1** (`ejecucion-plan-v3.md:221`). La app además
habló de verdad con la base como `spaces_app`, un rol **sin `bypassrls`**: un login
con credenciales falsas devolvió 401 desde una consulta real.

> Estas cifras son del ensayo del 14/08, no mías. Ver §15.

### Y entonces el ensayo midió la imagen por dentro

> [!danger] El 503 salía, pero **por el motivo contrario al que dice el plan**
> El criterio de F2.5 (`Plan_Instancias_Soberanas_v3.md:849`) justifica el 503 con
> «el autoregistro viene apagado **horneado**, invariante 9». **Falso en esta
> imagen**: el `.dockerignore` excluye `**/.env*`, así que la variable no existía
> durante el build y Next no sustituyó ningún literal. Medido en el compilado,
> `signup/route.js` y el chunk de `google-oauth` **leen el entorno en tiempo de
> ejecución** — comprobado con la **misma imagen sin recompilar**: `=0` → 503,
> `=1` → 400 (`ejecucion-plan-v3.md:223`).
>
> **Lo horneado era la otra mitad, y estaba horneado ENCENDIDO.**
> `.next/server/app/login.html` es un prerender de build que **ya traía dentro el
> botón «Crear cuenta»**, y ningún valor de entorno lo cambiaba. Consecuencia
> operativa para toda la flota: **cada instancia de owner habría enseñado un botón
> que al pulsarse devuelve `503 «El registro de cuentas nuevas está
> deshabilitado»`** (`:224`). Una puerta pintada en la pared.

**Verifiqué esa medición yo mismo**, sobre la imagen pre-F2.6 que sigue en esta
máquina:

```
$ docker run --rm space-os:dev sh -c 'ls -l apps/web/.next/server/app/login.html; grep -o "Crear cuenta" apps/web/.next/server/app/login.html | wc -l'
-rw-r--r-- 1 node node 15234 Aug 14 18:13 apps/web/.next/server/app/login.html
1
```

**15 234 bytes, 1 aparición.** La cifra del ejecutor es cierta al byte.

El ensayo resolvió de paso el `[SIN VERIFICAR]` del paso 3 de F2.6: la vía de props
desde el layout **queda descartada por evidencia** —la página se prerrenderiza, así
que sería el mismo render de build y el mismo defecto por otra puerta—, y el valor
tiene que llegar por `GET /api/auth/metodos/` (`:225`).

---

## 6. Evidencia — F2.6, la bandera sale del build

**La decisión que la habilita.** F2.6 estaba *condicionada* a P4-bis. Se resolvió el
**13/08** hacia la salida **(b)**: la bandera sale del build, un solo artefacto por
versión (`ejecucion-plan-v3.md:31` y `:195`). El precedente resultó más fuerte de lo
que decía el plan: el propio código ya lo dejaba escrito en
`apps/web/lib/server/google-oauth.ts` — «apaga la función EN EL SERVIDOR, no solo
escondiendo el botón — **misma lección que AUTOREGISTRO**. Y NO lleva prefijo
NEXT_PUBLIC_» (leído hoy en `:35-39`). Alguien ya había aprendido esto y dejó
apuntado que esta bandera era el siguiente caso.

**Qué se hizo** (leído hoy, no del reporte):

- **`apps/web/lib/entorno.ts:26-27`** — `autoregistroActivo()` devuelve
  `process.env.AUTOREGISTRO === '1'`. Sin prefijo `NEXT_PUBLIC_`, a propósito.
- **`apps/web/lib/entorno.test.ts`** — dos casos, `:22-30` (cambia de valor entre
  llamadas, sin recompilar) y `:32-38` (sin la variable → `false`). Su cabecera
  `:7-11` explica por qué el archivo no podía existir antes: con el prefijo, Next
  inlinea el valor y cambiar `process.env` entre dos llamadas no cambiaba nada.
- **`apps/web/app/api/signup/route.ts:21-26`** — el guard, con 503.
- **`apps/web/app/api/auth/metodos/route.ts:41-48`** — la ruta pública devuelve
  ahora `{ google, autoregistro }`, `force-dynamic` (`:7`) y `cache-control:
  no-store` (`:47`).
- **`apps/web/lib/server/google-oauth.ts:95-97`** — `autoregistroHabilitado()`
  delega en `lib/entorno.ts` «para que las dos puertas no puedan divergir».
- **`apps/web/app/(app)/login/page.tsx:78-83`** — el cliente pregunta y solo
  enciende el botón si la respuesta trae `autoregistro === true`.

### La polaridad se invirtió, y es deliberado

Antes: `NEXT_PUBLIC_AUTOREGISTRO !== '0'`, o sea **encendido si la variable
faltaba**. Ahora: **solo `'1'` enciende**. El comentario de `lib/entorno.ts:19-25`
explica el porqué mejor de lo que lo haría yo: «la flota son muchas instancias con
`.env` escritos a mano, y la que se quede corta tiene que quedarse sin registro
público, no con la puerta abierta».

**Efecto que no se puede perder de vista:** un `.env` que conserve el nombre viejo
`NEXT_PUBLIC_AUTOREGISTRO=1` **amanece con el registro cerrado**. Está avisado en
`docs/Registro_Cambios.md:29-31`, en lenguaje llano y para quien no programa.

### El invariante 7 se respetó

`apps/web/lib/test/aislamiento.e2e.test.ts` **no aparece en el `git show --stat` de
`70ca3f0`**: pasó sin tocarse. Su bloque `:200-213` —leído hoy— sigue diciendo que
`NEXT_PUBLIC_AUTOREGISTRO` «la INLINEA Next en tiempo de BUILD», lo cual **ya es
falso**; el propio plan (`:898-901`) manda retirarlo en un release posterior
(expand → contract), no aquí. Queda como deuda declarada.

Lo que sí cambió del arnés es `lib/test/servidor-e2e.ts`, que fijaba
`NEXT_PUBLIC_AUTOREGISTRO='0'` y pasa a `AUTOREGISTRO='0'`. El cuerpo del commit lo
razona bien: sin ese cambio «las e2e habrían seguido en verde **por casualidad**
(ausente = apagado) y el arnés estaría mintiendo».

### Honestidad sobre el TDD

El segundo rojo de F2.6 —poner la polaridad vieja a propósito para verlo fallar—
**no es verificable desde el repositorio**: no hay commit intermedio ni reflog que
lo conserve. El auditor lo dijo él mismo y lo dio «por creíble, no por probado»
(`ejecucion-plan-v3.md:211`). Lo dejo aquí con la misma etiqueta.

---

## 7. Evidencia — F2.5, segundo ensayo: la confirmación

Tras `70ca3f0` se reensayó con **una sola construcción y tres arranques**:

| Arranque | `POST /api/signup/` | `GET /api/auth/metodos/` |
|---|---|---|
| Sin la variable | **503** | `autoregistro: false` |
| `AUTOREGISTRO=0` | **503** | `autoregistro: false` |
| `AUTOREGISTRO=1` | **400** (cuerpo vacío) | `autoregistro: true` |

Misma imagen (`sha256:12de895f…`), **sin recompilar**. Y el smoke literal siguió en
verde: `200 · 200 · 503 · 401` (`ejecucion-plan-v3.md:70`, `:198`, `:201`).

**El botón, medido dentro de las dos imágenes** (`:210`):

| Imagen | `login.html` | Apariciones de «Crear cuenta» |
|---|---|---|
| `space-os:dev` (pre-F2.6) | **15 234 bytes** | **1** |
| la de `70ca3f0` | **15 104 bytes** | **0** |

> **La primera fila la reverifiqué yo hoy** (§5): 15 234 y 1, exactas.
> **La segunda no puedo reverificarla**: la imagen post-F2.6 **ya no existe en esta
> máquina** (`docker images -a` solo devuelve `space-os:dev sha256:ce261aed…`, de
> las 12:13). Lo que sí medí es el **build local** posterior a F2.6 (13:21):
> `apps/web/.next/server/app/login.html` = **14 594 bytes** y **0 apariciones**. La
> conclusión coincide —el botón no se hornea—; el número de bytes no, y no tiene por
> qué: es otro artefacto (el build local sí lleva `.env`, el de la imagen no). Los
> **15 104** vienen de la auditoría del 14/08, no de mí.

### La cadena de evidencia del botón, y dónde se corta

«0 apariciones en el HTML» prueba que **no se hornea**, no que **se pinte cuando
toca**. El ensayista cerró el eslabón que faltaba yendo al bundle de cliente
servido por la imagen (`ejecucion-plan-v3.md:202`). **Lo reproduje sobre el bundle
local de hoy**, `apps/web/.next/static/chunks/app/(app)/login/page-7d0b869b1d67121c.js`
(17 330 bytes):

```
Crear cuenta   : 3 apariciones   → el JSX del botón SÍ viaja al cliente
autoregistro   : 1 aparición
auth/metodos   : 1 aparición

…then(t=>{e&&((null==t?void 0:t.google)===!0&&B(!0),(null==t?void 0:t.autoregistro)===!0&&I(!0))})…
```

Es decir: el botón viaja, y su **única** puerta es un setter que solo dispara un
`autoregistro === true` venido de esa ruta. El estado arranca en `false`
(`login/page.tsx:65-66`), y ese detalle de diseño no lo pidió nadie: si la consulta
a `/api/auth/metodos/` falla, **no se pinta nada**. Ofrecer una entrada que contesta
503 es peor que no ofrecerla (`ejecucion-plan-v3.md:199`).

**Dónde se corta la cadena:** en la hidratación. Ver §8.2.

---

## 8. Lo que NO quedó probado — y por qué

Esta sección pesa lo mismo que las anteriores.

### 8.1 La imagen **no puede levantar una base virgen ella sola**

Es el hallazgo gordo de F2.5 (`ejecucion-plan-v3.md:222`), y sigue vigente.

`db/migrations/20260729_licencias_permisos.sql:96-97`, leído hoy:

```sql
  if n = 0 then
    raise exception 'No se encontró el rol de la aplicación. Sin GRANT, la tabla queda inaccesible para la app.';
```

En una base recién creada **no hay rol de aplicación**, así que la cadena se corta
en la migración `20260729`. **13 de las 67 migraciones** referencian ese rol
(`grep -l` sobre `db/migrations/*.sql`, contado hoy). Y la imagen **no trae nada que
lo cree**: `Dockerfile:94-95` copia solo `schema.sql` y `migrations/`, y
`db/dev-rol-app.sql` no viaja —ni serviría, es de desarrollo (§4).

**El orden obligatorio es: crear el rol de aplicación → `schema.sql` → las 67
migraciones con el mapa `ANTES_DE` de `db-e2e.ts`.** Hoy nada en la imagen hace el
primer paso. Le cae encima al runner de **F3.2/F3.3** y al aprovisionamiento de la
**Fase 5**. Dicho de otro modo: el criterio de aceptación de F2.2 —«la imagen
levanta contra una base vacía» (`Plan…v3.md:744`)— **se cumplió con el rol creado a
mano por fuera**, no por la imagen.

### 8.2 Nadie prueba que el botón **se pinte de verdad**

La evidencia del botón es de **tres capas** —HTML sin el botón, chunk de cliente con
el literal bajo su bandera, API contestando `true`/`false`— y **ninguna de las tres
es el DOM**. Falta la hidratación en un navegador real: que React monte, que el
`fetch` resuelva y que el enlace aparezca.

Se acepta porque el modo de fallo **cae del lado seguro** (si algo falla, el botón
no aparece), pero es **cobertura perdida, no cobertura equivalente**. La alternativa
cara —prueba de regresión permanente— se descartó con motivo: `apps/web` no trae
`jsdom`, ni `@testing-library/react`, ni Playwright, y `vitest.config.ts:19` fija
`environment: 'node'`; exigiría devDeps nuevas, y **eso no es decisión de un ensayo**
(`ejecucion-plan-v3.md:203`).

**La salida acordada:** añadir «se ve el botón *Crear cuenta*» a la tarjeta de
**F4.5**, que ya está prevista. Queda escrito aquí para que no se pierda.

### 8.3 **Ningún test ejerce `GET /api/auth/metodos/`**

Comprobado hoy: `grep -rn "auth/metodos" --include=*.test.ts apps/web` **no devuelve
nada**. La ruta la consumen tres piezas de producto —`login/page.tsx:78`,
`administracion/page.tsx:387` y `components/demo/admin/OrganizacionesPanel.tsx:168`—
y ninguna prueba.

El nombre del campo `autoregistro` en ese JSON es hoy **la única atadura** entre el
servidor y el botón. Si alguien lo renombra, **el botón desaparece en silencio**:
fail-closed, no rompe nada y no avisa nadie (`ejecucion-plan-v3.md:215`).

### 8.4 Lo que el entorno del ensayo no reproduce

- **Los ensayos usaron caché de `docker build`** — 19 de 25 capas reutilizadas,
  según el reporte del ensayo. **Un build en frío no está demostrado**, y es
  precisamente el que correría el CI de F2.3. *(Este dato no lo puedo reverificar:
  no queda log de build en el repositorio.)*
- **Sin TLS, sin nginx, sin dominio.** `COOKIE_SECURE=0` en el smoke; toda la
  configuración de borde de una instancia real está sin tocar.
- **Sin registry.** La imagen nunca se empujó ni se jaló de ningún sitio, así que
  no se ha probado que un tercero pueda descargarla ni que las etiquetas funcionen.
- **La imagen no se ha ejercitado con datos.** El smoke son cuatro códigos HTTP y
  un login fallido; nadie navegó la aplicación dentro del contenedor.

### 8.5 La distinción que tiene que sobrevivir al expediente

**`COMPLETADA_LOCAL` ≠ hecho.** F2.1, F2.2 y F2.6 están escritas, probadas y
commiteadas **en una rama que no está mergeada**. Producción sigue corriendo el
build viejo: allí `NEXT_PUBLIC_AUTOREGISTRO` **todavía manda**, porque la mitad
horneada solo cambia cuando se despliegue el build nuevo.

**`ENSAYADA_LOCAL` significa que la parte real sigue sin hacerse.** De F2.5 se
ensayó la forma del smoke contra una imagen construida en esta máquina; el smoke que
importa es el que se corra contra la imagen **publicada** en el canal `beta`,
tirando de un registry, en un droplet con dominio. Eso no existe todavía y depende
de P4.

---

## 9. F2.3 y F2.4 — lo que no se hizo, y por qué

**Ninguna de las dos se escribió.** No hay `release.yml` ni `promover.yml`, no hay
ningún tag `v*.*.*`, y `REGISTRY` no aparece en ningún workflow (verificado hoy,
§cabecera).

El plan dice que la Fase 2 está «parcialmente bloqueada» y que todo se escribe con
el registry **como parámetro** (`vars.REGISTRY`), «así que las tareas se hacen hoy;
lo único que espera es el valor» (`Plan…v3.md:678-680`). **Eso no se siguió**: se
optó por no escribir los workflows hasta tener P4. El orquestador lo registró así
(`ejecucion-plan-v3.md:68-69`, `:197`), y es una decisión defendible —un workflow de
release sin destino no se puede correr ni una vez, y F2.3 se acepta justamente
comprobando que **una suite en rojo impide publicar**, que solo se ve corriéndolo—
pero conviene que quede dicho: **el plan permitía escribirlas y no se escribieron**.

Lo que P4 bloquea, textualmente (`Plan…v3.md:2085-2089`): el valor de
`vars.REGISTRY` en F2.3/F2.4 y el `REGISTRY` del `.env` de cada instancia (F5.3). Si
es DigitalOcean Container Registry, login con `secrets.DO_REGISTRY_TOKEN` y hay que
mirar el límite de almacenamiento del plan; si es GHCR, login con el `GITHUB_TOKEN`
del propio workflow más un token de solo lectura para que cada instancia jale.

**Sin F2.3 y F2.4 no hay canal, y sin canal la Fase 3 no tiene de dónde jalar**:
`update.sh` (F3.4) existe para bajar una imagen de un registry.

---

## 10. Decisiones de negocio tomadas durante la fase

| Decisión | Fecha | Resolución | Ancla |
|---|---|---|---|
| **P4-bis · ¿dos imágenes por versión, o la bandera fuera del build?** | **2026-08-13** | **Salida (b): la bandera sale del build.** Un solo artefacto por versión; el autoregistro se decide en el `.env` al arrancar, como ya se hizo con `GOOGLE_OAUTH` | `ejecucion-plan-v3.md:31` · commit `fef7499` · ejecutada en `70ca3f0` |
| **P3b-bis · ¿el registro va abierto o cerrado?** | **2026-08-14** | **CERRADO en todas partes: local, producción y DEMO.** Ninguna instancia lo abre. Revierte P3b del 10/08 («abierto y permanente») | `ejecucion-plan-v3.md:32`, `:206`, `:207` · commits `0dbccb8` y `39379bf` |

La segunda se tomó **en dos tiempos**, y el matiz importa: `0dbccb8` (13:31) cerró
local y producción y dejó **expresamente sin decidir** la DEMO —«toda la
contradicción P4-bis se resolvió para que pudiera tenerlo abierto», dice su cuerpo—;
`39379bf` (13:34) la cerró también, al preguntárselo a Jochelo. Efecto medible en el
repositorio: `.env.example:33` → `AUTOREGISTRO=0` y `.env.production.example:39` →
`AUTOREGISTRO=0` (leídos hoy).

**Que nadie encienda la bandera no invalida F2.6** (`ejecucion-plan-v3.md:209`):
sacarla del build sigue siendo lo correcto —un solo artefacto para toda la flota— y
de paso arregló el botón horneado, que era un defecto real con el registro abierto
**o** cerrado.

### Las consecuencias de cerrar el registro en todas partes, ninguna resuelta

1. **F4.4 del plan (`:1345`) queda contradicha**: manda `.env` de DEMO con
   `NEXT_PUBLIC_AUTOREGISTRO=1`, «la única instancia de toda la flota que lo lleva».
2. **`POST /api/signup` pasa a ser código sin uso** en toda la flota, y
   `/api/auth/metodos/` devolverá siempre `autoregistro:false`.
3. **El alta de una organización nueva ya no tiene camino por la aplicación.** Queda
   el tenant `rgb` que siembra `db/schema.sql:598` más el usuario que crea
   `bootstrap-auth.mjs`, que resuelve **por slug `rgb` y aborta si falta**. O sea que
   **cada instancia nueva nacería con una organización llamada `rgb`** — lo cual
   enlaza directamente con **P1**, que sigue abierta.

### Decisiones abiertas que bloquean lo siguiente

| Decisión | Estado | Qué bloquea |
|---|---|---|
| **P4 · nombre del registry** | **ABIERTA** | **F2.3 y F2.4 de esta fase**, y el `REGISTRY` del `.env` de cada instancia (F5.3). Sin esto la Fase 2 no cierra |
| **P1 · destino del tenant `rgb` y del droplet actual** | ABIERTA | F7.2, F7.3, el cierre de la Fase 4 — y ahora también **cómo nace la organización de cada instancia** (consecuencia 3 de arriba) |
| **P2 · fecha de migración de PIXELED** | ABIERTA | F5.7 y F7.2 |
| **P3 · cuenta DO de las instancias** | ABIERTA | El modo por defecto de `provision-instancia.sh` (F5.4) y el runbook |
| **P6 · `/api/version` con token de flota o pública** | ABIERTA | Fase 6, fuera del alcance actual |

---

## 11. Lo que el plan afirmaba y el repositorio desmintió

**El plan no se tocó en ningún caso.** La evidencia vive aquí y en la bitácora.

| Dónde | Lo que dice el plan | Lo que es cierto hoy |
|---|---|---|
| **F2.5 `:849`** | El 503 sale porque «el autoregistro viene apagado **horneado**, invariante 9» | **Falso.** El servidor ya leía la variable en runtime; lo horneado era el botón. Tras `70ca3f0` no se hornea nada |
| **F2.5 `:846`** | Arrancar el contenedor con `NEXT_PUBLIC_AUTOREGISTRO=0` | **Variable que ya no lee nadie.** Quien lo copie literal obtendrá 503 igual, pero por la **ausencia** de `AUTOREGISTRO`, no por lo que cree |
| **F2.2 `:726`** | `basePath` y `trailingSlash` en `next.config.mjs:8-9`, dentro de «Hechos del repo **verificados**» | Tras F2.1 viven en **`:19-20`**; la `:8-9` es hoy un comentario. Lo desfasó el commit anterior de la propia fase |
| **F0.3 `:341-352`** | Prueba que busca `/^NEXT_PUBLIC_AUTOREGISTRO=0$/m` en `.env.example`, y que «falla hoy porque `.env.example:23` dice `=1`» | **Doblemente rota.** La regex no puede casar nunca tras el renombrado; y el valor ya está en `0` (`.env.example:33`, por `0dbccb8`), así que **su rojo de TDD tampoco es posible** |
| **F4.4 `:1345`** | `.env` de DEMO con `NEXT_PUBLIC_AUTOREGISTRO=1` | **La peor de las cuatro.** Copiado literal, **DEMO nacería con el registro CERRADO** — justo lo contrario de lo que P4-bis compró. Con la decisión del 14/08 eso ya es lo querido, pero **por accidente, no por la instrucción** |
| **F5.3 `:1497,:1504`** | La plantilla de instancia lleva `NEXT_PUBLIC_AUTOREGISTRO=0` | Grabaría **una variable muerta** en el `.env` de todas las instancias |
| **F0.2 `:302-307`** | `sed` sobre `NEXT_PUBLIC_AUTOREGISTRO` en el `.env` del droplet | Vale **solo mientras el droplet corra el build viejo**. En cuanto se despliegue el nuevo, esa línea no la lee nadie |

Las cuatro últimas son el mismo hecho: **el renombrado de F2.6 rompe cuatro tareas
del plan** (`ejecucion-plan-v3.md:200`, `:214`), y ninguna se ha tocado.

Fuera del plan, dos afirmaciones más que hoy no se sostienen y que verifiqué:

- **`CLAUDE.md` §4** (raíz y worktree) dice «789 unitarias en 71 archivos … medidas
  el 2026-08-14». **Corrí la suite hoy: 801 en 73 archivos** (§14). El desfase venía
  de antes (`:240` lo anotó como 799/72) y F2.6 sumó `+2` pruebas y `+1` archivo.
- **`next.config.mjs:58-66`** conserva un alias de webpack a
  `apps/web/node_modules/styled-jsx` que **no existe** (`ls` → *No such file or
  directory*), justificado por un comentario que habla de «styled-jsx (React 19) …
  while react-dom is still v18» cuando el árbol tiene styled-jsx **5.1.1** y
  react/react-dom **18.3.1**. Es **preexistente**, inocuo hoy, y dentro del stage
  `build` de la imagen ese directorio ni siquiera existe. Código muerto con una
  justificación falsa que alguien creerá: **merece tarea propia**
  (`ejecucion-plan-v3.md:219`, `:239`).

---

## 12. Commits ROJO pendientes de visto bueno humano

| Commit | Tarea | Por qué es ROJO |
|---|---|---|
| **`70ca3f0`** | F2.6 | **Z1 · Auth 🔴.** Cambia una bandera de seguridad **y le invierte la polaridad**. Marcado explícitamente en `ejecucion-plan-v3.md:71` y en la fila de Z1 del tablero |

`8ae8f77` (F2.1) y `3f16386` (F2.2) **no se declararon ROJO**, y es defendible:
ninguno toca sesión, tenant, migración ni dinero. Dos matices que dejo anotados como
hallazgos, no como correcciones:

- `8ae8f77` toca **`apps/web/next.config.mjs`**, que es **archivo de alto contacto**
  (`AGENTES.md:61`) y se reclama en su propia fila del tablero. No consta que se
  reclamara — ver §13.
- `3f16386` crea **`Dockerfile` y `.dockerignore`**, que pasan a ser la
  configuración del proceso de toda la flota, y **`.dockerignore:13` (`**/.env*`) es
  hoy una línea de la que depende que no se horneen credenciales**. La zona R6
  «Configuración de nginx y del proceso» (`zonas-de-riesgo.md:112-114`) nombra solo
  `infra/nginx/demo.space-os.io.conf` y `ecosystem.config.js`: **los dos archivos
  nuevos no están clasificados en ninguna zona de riesgo**.

Con los cinco de la Fase 1 (`b976b54`, `3ac2bba`, `c50344a`, `65bf9b5`, `3671e8a`),
son **seis commits ROJO** esperando visto bueno humano en esta rama. Ninguno está
mergeado a `main`.

---

## 13. Lo que se rompió, se descubrió o costó por el camino

- **Dos orquestadores corrieron a la vez sobre esta rama, sin saberlo.** Una segunda
  sesión abrió el mismo worktree y **lanzó su propio verificador sobre F2.1**
  mientras el primero hacía lo mismo. Los dos veredictos coincidieron —AMARILLO, las
  dos formas de arranque comprobadas de verdad, diff limitado a `next.config.mjs`—,
  así que **F2.1 queda doblemente auditada por caminos independientes**, que es la
  única lectura buena del episodio. El resto es coste: trabajo pagado dos veces.
  Decisión de Jochelo (14/08): sigue la sesión que tenía el ejecutor de F2.2 a
  medias; la otra se retira. **Regla que faltaba y quedó escrita:** antes de lanzar a
  nadie, comprobar que no haya otra orquestación viva (`ejecucion-plan-v3.md:235`).
- **La primera auditoría de F2.1 murió a mitad por un login expirado** —no por el
  código— y hubo que relanzarla de cero (`:230`).
- **Z12 aparece `LIBRE` antes y después** de `8ae8f77` y de `3f16386`: no queda
  rastro de la reclamación ni de la liberación de zona, que es la regla 1 de
  AGENTES. **Lo verifiqué en los diffs del tablero de los dos commits.** Es
  costumbre de la tanda, no descuido puntual (`:220`).
- **El hallazgo de F2.1 sobre el `.env` en el standalone** (§3) no lo pedía ninguna
  tarea, y es lo que convirtió el criterio de F2.2 en algo comprobable en serio.
- **El hallazgo de F2.5 sobre el botón horneado** (§5) no lo pedía ninguna tarea, y
  es lo que dio contenido real a F2.6: sin él, F2.6 se habría limitado a renombrar
  una variable que el servidor ya leía bien, y **cada instancia habría nacido con la
  puerta pintada**.
- **`docs/Registro_Cambios.md` recibió por fin una entrada** (`:8-33`, del commit
  `70ca3f0`): la primera de toda la ejecución del plan v3. La Fase 1 entera no dejó
  una sola línea allí. El criterio es el correcto —este cambio **sí** se nota desde
  la aplicación— y el aviso duro está en la única forma en que alguien que no
  programa puede actuar sobre él.
- **Un comentario de producto quedó caduco a propósito, y está anotado:**
  `apps/web/app/api/signup/route.ts:15` sigue llamando a DEMO «la única con el
  registro abierto». El punto que defiende sigue en pie; el ejemplo, no. No se tocó
  por ser código (`39379bf`).

---

## 14. Verificación global — lo que corrí yo, hoy (2026-08-14)

Todo lo de esta tabla lo ejecuté al levantar el expediente, no lo copié de un
reporte.

| Comprobación | Comando | Resultado |
|---|---|---|
| Los tres commits existen y tocan lo que dicen | `git show --stat 8ae8f77 3f16386 70ca3f0` | 7, 4 y 18 archivos — coincide con §2 |
| Suite unitaria | `cd apps/web && npm test` | **73 archivos, 801 pruebas, todas en verde**, 6.82 s |
| El standalone existe | `ls -l apps/web/.next/standalone/apps/web/server.js` | 5 836 bytes |
| El standalone se lleva el `.env` | `md5sum` de los dos | **idénticos** (`6032654f…`), con `GOOGLE_CLIENT_SECRET` |
| El `.env` no está en git | `git ls-files apps/web/.env` | 0 archivos |
| La imagen lleva el esquema y las migraciones | `docker run --rm space-os:dev sh -c 'ls /app/db/migrations \| wc -l'` | **67** (+ `schema.sql` = 68) |
| …y son los mismos bytes | md5 de los 68, ordenados y rehasheados | **`886ff521…` a los dos lados** |
| La imagen no lleva `.env` | el comando exacto del plan (`:750`) | `ok: sin .env` |
| La imagen no lleva credenciales | 11 patrones del `.env`/`.env.local`, con **control positivo** | positivo **4/4**, imagen **0 coincidencias** |
| La imagen corre sin privilegios | `whoami` dentro | `node` |
| La versión va sellada | `echo $SPACE_OS_VERSION` | `v0.0.0-dev` |
| El botón estaba horneado (pre-F2.6) | `ls -l` + `grep -o "Crear cuenta" \| wc -l` sobre `login.html` en `space-os:dev` | **15 234 bytes, 1 aparición** |
| El botón ya no se hornea (post-F2.6) | lo mismo sobre el build local de las 13:21 | **14 594 bytes, 0 apariciones** |
| El botón sí viaja al cliente, bajo su bandera | `grep` sobre `static/chunks/app/(app)/login/page-7d0b869b1d67121c.js` | 3 «Crear cuenta», 1 `autoregistro`, gate `===!0&&I(!0)` |
| La migración que aborta sin rol | `sed -n '96,97p' db/migrations/20260729_licencias_permisos.sql` | `raise exception 'No se encontró el rol de la aplicación…'` |
| Cuántas migraciones necesitan el rol | `grep -l` sobre `db/migrations/*.sql` | **13** de 67 |
| Ningún test toca `/api/auth/metodos/` | `grep -rn "auth/metodos" --include=*.test.ts apps/web` | **sin resultados** |
| `aislamiento.e2e.test.ts` no se tocó | `git show --stat 70ca3f0` | no aparece en el diff |
| No hay workflows de release ni tags | `ls .github/workflows/`, `git tag -l` | `ci`, `deploy`, `lockfile-check`; ningún `v*.*.*` |
| Las citas de plan desfasadas | `sed -n` sobre `:302-310,:339-354,:724-728,:844-852,:1342-1348,:1494-1506` | las siete de §11, confirmadas |
| El alias muerto de styled-jsx | `ls apps/web/node_modules/styled-jsx` | *No such file or directory*; hoisted 5.1.1, react-dom 18.3.1 |

### Lo que **no** corrí, y por qué

- **`npm run test:e2e`.** La suite usa la única base `spaces_e2e` y el puerto 3311, y
  cada archivo la recrea con `drop schema public cascade`; había otro agente
  trabajando en este mismo worktree. La cifra vigente —**13 archivos, 140 pruebas +
  1 saltada**— viene del cuerpo del commit `70ca3f0` (corrida del 14/08) y la
  ratifica `CLAUDE.md §4`. **No es una medición mía.**
- **El smoke de F2.5 completo.** Exigiría levantar Postgres, crear el rol a mano y
  arrancar el contenedor tres veces. Los códigos `200 · 200 · 503 · 401`, los **22
  activos a 200**, las **707 reglas** de CSS y los tres arranques de la bandera son
  del ensayo del 14/08 (`ejecucion-plan-v3.md:70`, `:201`, `:221`), no míos.
- **La medición de 15 104 bytes.** La imagen post-F2.6 ya no existe localmente (§7).

---

## 15. Acciones humanas que la Fase 2 deja pendientes

> [!warning] **Ninguna de estas está formalizada como tarjeta humana** en
> `vault/07-Agentes/ejecucion-plan-v3.md`. Su sección «Tarjetas humanas emitidas»
> solo contiene **TH-01** y **TH-02**, las dos de la Fase 1 y las dos todavía
> vigentes. Estas cuatro quedan aquí, con su comando, para que no se pierdan.

**1 · Responder P4 — el nombre del registry.** Es lo único que separa a la Fase 2 de
estar cerrada. Desbloquea F2.3, F2.4 y el `REGISTRY` del `.env` de F5.3. Las dos
opciones y sus consecuencias están en `Plan…v3.md:2085-2089`.

**2 · El `.env` del droplet, cuando se despliegue el build nuevo.** La instrucción
**cambió de sentido** con la decisión del 14/08: ya no hay que poner
`AUTOREGISTRO=1`, sino **borrar la línea vieja y no poner nada**
(`ejecucion-plan-v3.md:206`). Hasta que ese build se despliegue, el droplet sigue
gobernado por la variable vieja y no hay urgencia; el día del despliegue, sí.

```bash
# solo lectura primero: ver qué tiene hoy
ssh root@209.97.146.136 "grep -n 'AUTOREGISTRO' /var/www/Spaces/apps/web/.env"
```

**3 · Añadir «se ve el botón *Crear cuenta*» a la tarjeta de F4.5.** Es el único
eslabón de la cadena del botón que no está probado (§8.2). Ojo con el valor
esperado: con el registro **cerrado en todas partes** (decisión del 14/08), F4.5
debe esperar **`signup` 503** y **el botón ausente**, no lo contrario. La nota
`:205` de la bitácora dice justo lo opuesto porque es **anterior** a `:207`; manda
la de las 13:34.

**4 · Visto bueno humano de `70ca3f0`** antes de cualquier merge (§12).

Y siguen vigentes de la Fase 1: **TH-01** (comprobar `config_negocio` en producción)
y **TH-02** (el censo real de los `DEFAULT`), completas en
`docs/evidencias/fase-1.md` §8.

---

## 16. Pendientes declarados al cerrar parcialmente la Fase 2

- [ ] **P4** respondida → escribir y correr **F2.3** y **F2.4**.
- [ ] Primer `docker build` **en frío** y primer push a un registry real.
- [ ] **F3.2/Fase 5:** el runner tiene que crear el rol de aplicación **antes** del
      `schema.sql`, o la imagen no levanta una base virgen (§8.1).
- [ ] **F0.3** hay que leerla traducida (`/^AUTOREGISTRO=0$/m`) y sabiendo que su
      rojo ya no es posible: el valor ya está en `0`.
- [ ] **F4.4** hay que leerla al revés de como está escrita: DEMO va **cerrada**.
- [ ] **F5.3** no debe grabar `NEXT_PUBLIC_AUTOREGISTRO` en la plantilla.
- [ ] Retirar el bloque `aislamiento.e2e.test.ts:200-213`, ya obsoleto, **en un
      release posterior** (expand → contract).
- [ ] Tarea propia para el alias muerto de `styled-jsx` (§11).
- [ ] Clasificar `Dockerfile` y `.dockerignore` en `zonas-de-riesgo.md` (§12).
- [ ] Corregir el conteo de unitarias de `CLAUDE.md`: son **801 en 73**.

---

## 17. Nota de entorno

Todo se hizo en el worktree `.claude/worktrees/servidor-padre`, sobre
`feat/servidor-padre-instancias`, en Windows 11 con Docker Desktop. La imagen se
construye desde un host Windows y aun así los 68 archivos de `/app/db` salen **byte
a byte idénticos** al repo: no hay corrupción de finales de línea (§14).

Las e2e exigen un build de Next hecho **antes**, o los 13 archivos mueren por
timeout en ~636 s sin decir nada del código (`CLAUDE.md §4`,
`servidor-e2e.ts` arranca con `npx next start`, que no construye).

Al levantar este expediente había **otro documentalista trabajando en el mismo
worktree** sobre `docs/evidencias/fase-0.md`. Por eso no se corrió la suite e2e ni se
tocó la base `spaces_e2e`, y por eso el `git add` de este expediente fue **por ruta
explícita**.

La base `spaces` del 5433 **no se tocó en esta fase**, ni para leer.
