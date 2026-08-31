---
tipo: arquitectura
estado: verificado
actualizado: 2026-08-31
tags: [despliegue, entorno, ci, env, instancias]
archivos:
  - infra/scripts/pruebas-update.sh
  - infra/scripts/pruebas-vuelta-atras-real.sh
  - .env.example
  - .env.production.example
  - apps/web/lib/entorno.test.ts
  - apps/web/package.json
  - apps/web/next.config.mjs
  - Dockerfile
  - .dockerignore
  - apps/web/scripts/bootstrap-auth.mjs
  - db/README.md
  - db/semilla-desarrollo.sql
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
  - infra/nginx/space-os.io.conf
  - infra/nginx/instancia.conf.tpl
  - infra/nginx/snippets/proxy-app.conf
  - infra/systemd/spaces-demo.service
  - infra/scripts/provision-instancia.sh
  - infra/env/instancia.env.example
  - db/docker-compose.yml
---

> [!danger] 2026-08-26 · CORRECCIÓN DOBLE — esta nota tenía DOS cosas falsas
> **① El acceso al droplet `209.97.146.136` NUNCA se perdió.** El aviso de abajo
> se escribió el 24/08 sobre esa premisa, y la premisa era falsa: el 25/08 se
> entró sin dificultad y se completó el censo entero
> (`docs/evidencias/f4-1-censo-resultado.md`). Sobre aquella conclusión se
> levantaron el ADR 0015, la 3.ª enmienda a P1 y **dos tareas declaradas
> imposibles**. Las cuatro se revisaron.
>
> **② DEMO ya NO va a servir `demo.space-os.io`.** El
> [ADR 0020](../../docs/adr/0020-no-hay-demo-publica.md) (26/08) retira ese
> nombre: no se le mueve el DNS, no se le emite certificado y ~~su registro A se
> borra~~ — tarjeta **TH-F4.5**. ⚠️ **REVERTIDO el 2026-08-26 por el
> [ADR 0021](../../docs/adr/0021-demo-space-os-io-se-queda.md): `demo.space-os.io`
> SE CONSERVA como demostración de las instancias hijas, y la tarjeta TH-F4.5
> queda cancelada.** El proceso del `3001` conserva su bloque de nginx en
> `infra/nginx/space-os.io.conf:188`.
>
> ⚠️ **Y HAY UNA TERCERA CAPA, del 2026-08-27:** el
> [ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md)
> **sustituyó al 0021**. `demo.space-os.io` **no «se conserva»: es solo la
> demostración ORIGINAL y se eliminará.** No se mueve al PADRE y no se le emite
> certificado. TH-F4.5 sigue cancelada —el registro A no se borra a mano— y
> `F4.3` queda sin objeto.
>
> Tres reversiones sobre la misma frase. **Lo que manda es el ADR con el número
> más alto, y hoy es el 0024.**
>
> Esa frase tachada estuvo escrita **con la fecha del 26/08 encima** y en tres
> notas a la vez. Si un agente la lee sin llegar al «REVERTIDO», propone borrar
> un registro DNS que hay que conservar. **Este punto cambió cuatro veces en
> cuatro días: pregúntalo, no lo infieras.**
>
> **Lo vigente:** el PADRE (`137.184.107.53`) es la **única máquina del modelo**
> y sirve `space-os.io` con certificado propio hasta el **2026-11-23**, con
> renovación automática —
> [ADR 0017](../../docs/adr/0017-todo-se-concentra-en-el-padre.md). Y la
> demostración de cara a cliente pasa a ser **el producto real con una o más
> instancias hijas**, que es lo que produce la Fase 5.
>
> **No se reescribe el cuerpo de abajo**: era correcto en su fecha. Reescribir
> historia para que cuadre con hoy es lo que hace que una nota deje de ser fiable.

> [!danger] 2026-08-24 · El droplet `209.97.146.136` SE PERDIO — esta nota lo daba por vivo
> **Se perdió el acceso a esa máquina.** Sigue encendida y sirviendo
> `demo.space-os.io`, pero **nadie la controla**: no se actualiza, no se parchea
> y no se apaga. Su certificado vence el **2026-10-26** y no se renovará.
>
> **La máquina viva es el PADRE, `137.184.107.53`** — Ubuntu 24.04, Postgres
> 16.15, `pm2 spaces-web` en el 3000 **como `root`**, rol de app **`spaces_app`**.
> Ahí van a convivir **el PADRE en `space-os.io`** y **DEMO en
> `demo.space-os.io`** (segundo proceso, puerto 3001, base `spaces_demo`) —
> decisión del día, con su precio escrito en
> [ADR 0015](../../docs/adr/0015-demo-dentro-del-padre.md).
>
> **Medido ese día:** el ápice `space-os.io` **no tiene registro A** (está libre),
> `demo.space-os.io` sigue apuntando a la máquina perdida, y el PADRE responde
> por IP `login 200 · raíz 302`.
>
> ⚠️ **CORREGIDO EL 2026-08-25: ese `login 200` NO era una prueba de vida.** El
> PADRE **no tenía conexión con su base** —le faltaba `DATABASE_URL`— y
> `db.ts:23-24` se cae a un valor por omisión de desarrollo, así que la app
> arrancaba, pintaba el login y devolvía 200 **sin poder autenticar a nadie**. El
> `POST` de login daba **500**. Arreglado el 25/08: ahora da **401**.
> Ver [[2026-08-25]].
>
> Todo lo que sigue en esta nota **describe el arreglo anterior**. Vale como
> historia; no como instrucción. Ver [[2026-08-24]] y `docs/Traspaso_20260824.md`.

---
# Entorno y despliegue

> [!important] 2026-08-28 · Cómo se despliega el PADRE, y ya no es con pm2
> La aplicación del 3000 la arranca **systemd** (`spaces-web.service`) como el
> usuario **`padre`**, no pm2 como root. La secuencia de despliegue pasa a ser:
>
> ```bash
> cd /var/www/Spaces && git pull
> npm install                            # si cambió el lockfile
> git checkout -- package-lock.json      # node 20 aquí, 22 en el CI: lo poda
> npm run build                          # lo hace root
> chown -R padre:padre apps/web/.next    # NUEVO — o falla al primer cacheo
> systemctl daemon-reload                # la unidad es symlink al repo
> systemctl restart spaces-web
> systemctl restart spaces-demo          # los dos comparten .next
> ```
>
> **El entorno del proceso es `/etc/space-os/padre.env`**, no
> `apps/web/.env.production` —que sigue en 600 root y lo lee el build—. Next
> avisará con `EACCES` al arrancar y **eso es correcto**: es lo mismo que ya
> hace DEMO. Cambiar un secreto son **los dos archivos**.
>
> Todo lo que este documento diga más abajo sobre `pm2 reload` describe cómo
> era, no cómo es. Evidencia:
> `docs/evidencias/padre-fuera-de-root-20260828.md`.


> [!danger] 2026-08-27 · EL DROPLET VIEJO SE RETIRA — lo de abajo sobre él caduca
> **`209.97.146.136` ya no se usa** (decisión de Jochelo, 27/08) y **sus datos
> eran de prueba**: no hay organizaciones reales que rescatar. El plan v3 se
> escribió el 13/08, seis días antes de la corrección del 19/08 sobre
> `spaces_prod`, y por eso arrastraba tres censos y una migración contra datos
> que nunca fueron reales.
>
> **SEIS tareas quedan SIN OBJETO:** `F0.2`, `F1.1`, `F1.5`, `F7.1`, `F7.2`,
> `F7.3`. **La Fase 7 entera.** El plan pasa de **46 tareas a 40 con objeto**.
> (**`F0.1` no entra**: ya estaba CERRADA el 24/08 con medición — `signup 503`
> más `login 200`, que descarta que el 503 fuera una caída.)
>
> Todo lo que esta nota diga más abajo sobre **el destino de `rgb`, el censo de
> `spaces_prod`, migrar PIXELED o desenredar la Fase 7** describe un problema que
> **ya no existe**. Se conserva como historia; no es trabajo pendiente.
>
> **Y `demo.space-os.io` queda CERRADO por el [ADR 0024](../../docs/adr/0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md),
> que sustituye al 0021:** ese nombre **es solo la demostración original y se
> eliminará**. No se mueve al PADRE, no se le emite certificado y no se le busca
> máquina. **`F4.3` queda SIN OBJETO** y el plan baja a **39 tareas con objeto**.
> Su certificado (26/10) pasa a ser **caducidad natural, no plazo**.
> **Ya no se pregunta.**
> Contexto: [[modelo-instancias-soberanas]] · `vault/07-Agentes/diario/2026-08-27`


## Local

```bash
# 1. Postgres (docker-compose expone el 5433, NO el 5432)
cd db && docker compose up -d

# 2. Aplicar esquema + migraciones
psql -d spaces -f db/schema.sql
# … y las 67 de db/migrations/ en orden lexicográfico ([[migraciones]])

# 2b. La organización de PRUEBAS (solo en local; el esquema ya no siembra ninguna)
psql -d spaces -f db/semilla-desarrollo.sql

# 3. Permisos por rol + organización + su Dueño (idempotente)
#    Ninguna variable tiene valor por omisión: el script no elige base por ti
#    ni adivina de quién es la instancia
cd apps/web && DATABASE_URL=postgresql://spaces:spaces@localhost:5433/spaces \
  ORG_SLUG=rgb ORG_NOMBRE='RGB Catorce' \
  ADMIN_EMAIL=jose@pixeled.com.mx ADMIN_NOMBRE='Cliente_ RGB Catorce' \
  node scripts/bootstrap-auth.mjs

# 4. La app
cd apps/web && npm run dev     # http://localhost:3000/spaces-dooh/
```

> [!danger] 🔴 Tras el merge, el PRIMER despliegue ABORTA a mitad — medido el 2026-08-20
> `deploy.yml:141-148` recorre **todas** las migraciones de esquema en orden
> lexicográfico y las aplica como `postgres` con `ON_ERROR_STOP=1`. No lleva
> registro: reaplica el juego entero en cada despliegue.
>
> Tras fusionar `feat/servidor-padre-instancias` encontrará **siete archivos que el
> droplet no ha visto**, y el séptimo —`20260820_grants_rol_app.sql`— **exige que
> exista el rol `spaces_app`**. El droplet corre con **`spaces_user`**
> (`20260715_arr_m6_rol_restringido.sql:3-5` lo dice literal).
>
> **Qué pasa entonces:** `ON_ERROR_STOP=1` corta el despliegue en el **paso 3 de 5**.
> El `pm2 reload` está en el paso 5 (`deploy.yml:171`), así que **no llega a correr**:
> la base queda con las seis primeras migraciones aplicadas y **la aplicación sigue
> sirviendo el código viejo sobre un esquema nuevo**. Es exactamente el modo de fallo
> que D1 describe para `update.sh`.
>
> **Se evita con un comando previo**, y no tocando la migración: crear `spaces_app` en
> el droplet con una contraseña propia, **sin cambiar todavía** a qué usuario se conecta
> la aplicación. Son dos cosas distintas y separarlas es lo que hace el paso seguro.
> Receta completa, con respuestas esperadas y vuelta atrás, en
> `docs/Runbook_Merge_y_Produccion_20260820.md`.

> [!warning] 🟡 Y dos tarjetas humanas dejarían de ser una decisión
> En ese mismo bucle van `20260812_schema_migrations.sql` (**TH-F3.1**) y
> `20260812_sin_default_tenant.sql` (**F1.5**), que existen para aplicarse **a
> conciencia**, con su ritual. `deploy.yml` las aplicaría **sin preguntar**, como una
> más. Hoy importa menos de lo que parece —P1 decidió que los datos del droplet se
> recrean— pero **tiene que ser una decisión, no una sorpresa**.

### El bootstrap del usuario inicial

`apps/web/scripts/bootstrap-auth.mjs` crea **la organización de la instancia y su
Dueño**, y nada más. Sin él una base recién creada **no tiene por dónde entrar**:
`db/schema.sql` crea las tablas y **ninguna organización**, así que tampoco un
solo usuario.

> [!important] Desde el 2026-08-20 ya NO siembra permisos — había dos catálogos
> Hasta ese día el script llevaba su propia `MATRIZ` de **36 filas** y la
> sembraba, mientras `20260819_semilla_rol_permisos.sql` sembraba otras **25**.
> Eran dos catálogos que podían divergir, y **la política de acceso efectiva de
> una instancia la fijaba el último script que corrió** — sin un error y sin un
> aviso. En el re-ensayo de la Fase 4 el Dueño pasó de 19 permisos a 24 solo por
> el orden. Es **ROJO-2**.
>
> El catálogo es **configuración de producto** —igual para toda la flota— así que
> vive en las migraciones, que además lo llevan a las instancias que ya existan
> cuando se actualicen. Este script crea la **identidad** de cada instancia, que
> es justo lo contrario: lo único que no debe ser igual en dos droplets.
>
> Lo que hace ahora en su lugar: **comprobar que el catálogo esté**, y negarse si
> no. Y comprueba una puerta concreta —que `DUENO` tenga `administracion.ver`— y
> no el total, porque un `count(*) > 0` lo cumpliría una base con solo las cinco
> filas de `inventario`, que es exactamente el estado inservible.

> [!danger] Y desde el 2026-08-20 la contraseña del Dueño se GENERA — ROJO-1
> Hasta ese día el alta sembraba `SEED_PASSWORD ?? 'spaces123'` y **la imprimía**.
> En el re-ensayo de la Fase 4 se entró con ella y el correo público del Dueño:
> **HTTP 200, sesión válida y los nueve módulos**, incluidos `administracion` y
> `finanzas`. La misma en toda la flota, y bcrypt no protege de eso — **no hay
> que romperla, hay que teclearla**.
>
> Peor todavía: el `insert` **no tocaba `debe_cambiar_password`**, cuya columna es
> `not null default false` (`20260804_reautenticacion_individual.sql:35`). O sea
> que el Dueño nacía con una contraseña conocida **y sin obligación de
> cambiarla**: la peor combinación de las dos.
>
> Lo que hace hoy:
>
> 1. **Genera** la temporal con `lib/password-temporal.mjs` — cuatro grupos de
>    cuatro sobre un alfabeto sin caracteres ambiguos, pensado para dictarse.
> 2. La guarda con **`debe_cambiar_password = true`**, así que `exigir()`
>    (`lib/server/auth.ts:167`) corta con **403** hasta que la cambie. Las dos
>    puertas de salida —`/api/auth/me` y `/api/perfil`— siguen abiertas a
>    propósito.
> 3. La **imprime una sola vez**, y **solo si de verdad creó la cuenta**.
>
> **`SEED_PASSWORD` se retiró entera**, no solo su valor por omisión: una variable
> que fija la contraseña es el mismo riesgo en cuanto el aprovisionamiento la
> escriba una vez para toda la flota.
>
> **El `on conflict` ya no reescribe `password_hash`.** Con una contraseña fija
> daba igual; con una generada, repetir el alta dejaría al Dueño fuera de su
> propia instancia — y el script se anuncia como idempotente. `xmax = 0` distingue
> el alta real de la repetición.

> [!warning] Consecuencia para los scripts de humo locales
> `smoke-e2e.mjs`, `a1-concurrencia.mjs`, `a2-candado-digital.mjs`,
> `a3-moneda.mjs`, `a4-candado-banco.mjs`, `n1-candado-dueno.mjs` y
> `e2e-prod-review.mjs` llevan `spaces123` escrito dentro y entran como el Dueño.
> Contra una base recién dada de alta **ya no valen por dos motivos**: la
> contraseña es otra, y aunque acertaran, el 403 de `debe_cambiar_password` les
> cerraría todo. Hay que cambiar la contraseña del Dueño desde la aplicación
> antes de correrlos. **No es un defecto de esos scripts: es el precio de que el
> Dueño ya no nazca con una contraseña que sirve en toda la flota.**

**`DATABASE_URL` es obligatoria**: sin ella el script no arranca, imprime qué
variable falta con un ejemplo en bash y en PowerShell, y sale con código 1.

> [!important] Y desde el 19/08 la identidad también se pregunta
> El script **crea** la organización de la instancia en vez de buscar una
> sembrada por el esquema, y la pide por entorno: **`ORG_SLUG`, `ORG_NOMBRE`,
> `ADMIN_EMAIL` y `ADMIN_NOMBRE`**. Ninguna tiene valor por omisión, por el mismo
> motivo que `DATABASE_URL`: **un default aquí es exactamente el dato horneado que
> se acaba de retirar**. Antes venían escritos en el archivo —la organización
> `rgb` y la cuenta `jose@pixeled.com.mx` con rol DUENO—, así que toda instancia
> nueva habría nacido con la organización de otro owner y con un acceso ajeno
> capaz de entrar. Si falta alguna, sale con código 1 nombrando las que faltan.
>
> El guard de abajo **no se tocó**, y ahora cubre un caso más: que el `insert` de
> `tenants` no llegue a dejar fila. Sigue siendo lo único que distingue «se creó»
> de «pareció crearse».

> [!danger] Estuvo roto y no lo dijo nadie — corregido el 13/08
> El script **fallaba siempre**, en cualquier base, por dos defectos del mismo
> `insert`. Ninguno se notó porque nadie volvió a correrlo tras cambiar el
> esquema:
>
> 1. **42P10.** Usaba `on conflict (email)`, pero la unicidad de correo es un
>    índice **funcional** sobre `lower(email)` (`db/schema.sql:72`), y Postgres no
>    lo infiere desde el nombre de la columna. El conflicto va por
>    `on conflict (lower(email))`.
> 2. **23502.** No fijaba `tenant_id`. Se apoyaba en el `DEFAULT` que cableaba el
>    bucle multi-tenant de `db/schema.sql` — un uuid de otra base. Ese `DEFAULT`
>    ya no existe: el bucle dejó de ponerlo el 19/08, con el mismo cambio que
>    sacó del esquema el tenant sembrado.
>
> Ahora la organización se resuelve **por slug** (`insert … select … from tenants
> where slug = $6`, el de `ORG_SLUG`), nunca por uuid: el id se genera distinto en
> cada base.
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

> [!warning] No hay despliegue continuo — y `deploy.yml` está en retirada
> `deploy.yml` solo corre a mano y **está desactualizado**. En el modelo de
> instancias **no debería existir**: entra por `ssh` como `root` y compila en el
> servidor. Lo retira **F3.6**, que a 2026-08-26 **no está hecha**. Ver
> «Producción ya no es un droplet: es una FLOTA», más abajo.
>
> `ci.yml:1-30` documenta que el disparador es `pull_request` y **no**
> `pull_request_target` a propósito: el segundo daría secretos a código de un
> fork. No cambiarlo.

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

**Escrito, NUNCA corrido.** Necesita tres variables del repositorio y una imagen en
el canal `beta`, que sale de `release.yml`. Al **2026-08-31** las dos primeras ya
tienen valor —el registry se creó ese día, ver abajo— y **`DEMO_URL` sigue sin
decidirse**, que es lo único que hoy separa a `promover.yml` de poder correr.
Lo de `workflow_dispatch` dejó de aplicar: **el archivo vive en `main` desde el
28/08**, así que ya aparece en la pestaña Actions.

> [!success] 2026-08-31 · el registry existe
> **`registry.digitalocean.com/registryspaces`**, región **NYC3** —la misma que los
> droplets, para que la imagen no cruce región al desplegar— y **plan gratuito: 500
> MiB, un repositorio**. Ese límite de un repositorio **no estorba**: `release.yml`
> publica uno solo, `$REGISTRY/space-os`, y los canales `beta` y `estable` son
> **etiquetas sobre la misma imagen**, no repositorios aparte.
>
> Lo que **no** se sabe todavía es cuánto pesa la imagen: nunca se ha construido.
> Se mide en el primer `release.yml` mirando `STORAGE USAGE` en el panel, y de ahí
> sale cuántas versiones caben antes de necesitar *Garbage Collection*.
>
> El **nombre no se quema en ningún workflow ni script**: sigue entrando por
> `vars.REGISTRY`. Tarjeta: `docs/evidencias/registry-TH-P4b.txt`.

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
se cambian con `PULL_ESPERAS` en `instancia.env`, y **dejarla vacía apaga los
reintentos** — cierto desde el **20/08** y no antes: la asignación usaba
`${PULL_ESPERAS:-…}` y los dos puntos sustituyen también el valor **vacío**, así que
`PULL_ESPERAS=""` dejaba los tres de siempre (medido: 3 reintentos) mientras el
comentario del código y `infra/scripts/README.md` afirmaban lo contrario. Sólo un
**espacio** los apagaba, y eso no estaba escrito en ningún sitio. Hoy es
`${PULL_ESPERAS-…}`: ausente = los tres, vacío = ninguno. Lo fija **E88**.

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
`102 escenarios · 664 comprobaciones · 0 rojas` (medido el 20/08 al cerrar los cuatro
hallazgos de las auditorías; venía de `95 · 619` con D1, y de
`88 · 557` al cerrar el ciclo de
los cinco mensajes que decían algo que no era verdad; venía de `85 · 532` el 19/08 al
cerrar M3, la
conexión que dejó de viajar como URL; de `79 · 399` ese mismo día al cerrar la
credencial de la **consulta**, de `73 · 358` al unificar el parseo, de
`63 · 300` el 18/08 tras corregir la auditoría de F3.9, de
`58 · 278` con F3.9, de `51 · 236` tras corregir F3.7, de `48 · 218` y, antes de F3.7,
de `37 · 165`). Los mutantes son **52** —**43** sobre `update.sh` y **9** sobre
`respaldo.sh`, contados con `grep -c` el 20/08, no recordados: la cifra de **44** que
estuvo aquí dos días era la de antes de D1, que añadió ocho—.
La barrida completa **no se ha corrido entera** ni el 18/08, ni el 19/08, ni el 20/08
—los 52 pasan de las quince horas en esta máquina— y en su lugar se corren **aislados
los que tocan el cambio**: siete en el ciclo del 18/08, **cinco** en el ciclo 2 del 19/08,
**cinco** en el ciclo 3, **siete** en M3 y **cuatro** el 20/08, todos cazados. Los cuatro
del 20/08 se corrieron contra una copia **reducida** del arnés (9 escenarios, 74
comprobaciones, 33 s por corrida) y no contra los 88, que es lo que hicieron los ciclos
anteriores: basta para decir que **esas** comprobaciones muerden, pero no dice nada de
si el mutante rompía además otro escenario. Queda declarado porque la diferencia importa
al comparar. Tres mutantes del ciclo 3
**se retiraron sin sustituto**: apuntaban a la línea que reconstruía la URL, que ya no
existe, así que esas tres formas de equivocarse ya no se pueden escribir. Está escrito porque la decisión M1 obliga a declararlo, no a suponerlo. Desde F3.7 los mutantes muerden **también en `respaldo.sh`**, no solo en
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
| **D3** | los dos códigos `5` de la restauración no decían que la instancia quedaba **caída** ni cómo levantarla | dicen «La instancia queda SIN servicio» y traen el comando de rescate, **calculado** según si el `rename` llegó a hacerse. **Completado el 20/08 (H1)**: la frase que va delante también se calcula (`estado_del_viejo`), porque afirmaba sin condición que el viejo estaba «aparcado como `-anterior`» y con el `rename` fallido eso manda a mirar un contenedor **que no existe** |
| **D4** | el respaldo vacío se quedaba en disco junto a los buenos, **y el directorio no se podaba nunca** | se borra al abortar; y desde F3.7 la retención local es de **3** (arriba). **D4 queda cerrada entera** |
| **D5** | el código `2` con la base intacta **adivinaba** la causa («típicamente no pudo conectar») y en el caso medido era otra | remite al mensaje del runner, que va impreso justo encima |

> [!success] D1 CERRADO el 20/08: la vuelta atrás restaura sobre un esquema limpio
> `pg_restore --clean --if-exists` solo suelta los objetos **que están en el dump**,
> así que los que creó el release fallido **sobrevivían** a la restauración. Aprobado
> el arreglo de fondo por Jochelo el 18/08, hecho el 20/08: se tira `public` y se
> rehace desde el respaldo, y **la huella se relee después para comprobarlo**. Ahora
> un `4` sí significa «la base volvió tal cual estaba» — y cuando no, sale `6`.
> Abajo, «La vuelta atrás devuelve la base como estaba».

**La conexión ya no viaja como URL** (decisión **M3**, 19/08). `pg_dump`/`pg_restore`
reciben **cuatro banderas sueltas** —`-h`, `-p`, `-U`, `-d`— y **todo lo demás por
variables `PG*`**: la contraseña por `PGPASSWORD`, y `sslmode`, `sslrootcert`,
`sslcert`, `sslkey`, `application_name`, `options`, `connect_timeout` y
`target_session_attrs` por la suya, **decodificadas**. Antes la URL entera era visible
en `ps` para cualquier usuario local. `deploy.yml:119` se libra de esto con
`sudo -u postgres`; aquí la conexión es por red.

El invariante, y lo que hay que mirar en cualquier revisión de `correr_pg`: **en `argv`
no aparece nada que venga del `userinfo` ni de la consulta, bajo ninguna codificación**.
Lo fija `argv_sin_marca`, una comprobación **global** que corre en los 88 escenarios del
arnés: toda credencial lleva dentro una cadena marcadora y ninguna puede acabar en la
línea de comandos de ninguna llamada doblada.

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
> archivo que viaja (E53 y E62-E72)—.
>
> Lo que **sí** sale, dicho con nombres: el **destino de la base**
> (`base=localhost:5433/spaces`, sin el `usuario:clave@`), la **URL de la imagen** en
> el registry y la **ruta local del dump**. Nombres de tabla no salen porque la huella
> es un hash, pero eso es una consecuencia, no una promesa. Todo ello está **dentro**
> de lo que el plan permite —«nombres y conteos, sí; filas, no»—; lo que estaba de más
> era la redacción anterior, «ni siquiera un nombre de tabla», que sugería una asepsia
> mayor que la real. Corregida el 18/08.

> [!danger] La contraseña de Postgres: **dos recortes distintos, los dos mal, y una tercera vía que no miraba nadie**
> Cada línea que nombra la conexión pasa por `destino_de_url` —su salida es la
> **primera línea de todo log que viaja**— y el `--dbname` de `pg_dump`/`pg_restore`
> pasaba por **otro** recorte, escrito aparte, 36 líneas más abajo. Dos
> implementaciones del mismo corte, cada una equivocada a su manera. Medido el 19/08
> **antes** de tocar nada, con el arnés espiando el archivo que sube y el `argv` que
> reciben los dobles:
>
> | `DATABASE_URL` | lo que viajaba al bucket | lo que llegaba a `argv` | `PGPASSWORD` |
> |---|---|---|---|
> | `…spaces:cl%40ve@localhost:5433/spaces` | `localhost:5433/spaces` ✅ | `…spaces@localhost:5433/spaces` ✅ | `cl@ve` ✅ |
> | `…spaces:p@ssw0rd@localhost:5433/spaces` | `localhost:5433/spaces` ✅ | `…spaces@ssw0rd@localhost:…` — **trozo de la clave** | solo `p` |
> | `…spaces:pa/ss@localhost:5433/spaces` | `localhost:5433/spaces` ✅ | **la URL entera, clave incluida** | vacía |
> | `…spaces:cl?ve@localhost:5433/spaces` | `spaces:cl` — **usuario y prefijo de la clave** | `…spaces@localhost:5433/spaces` ✅ | `cl?ve` ✅ |
> | `…spaces:a@b@c@localhost:5433/spaces` | `localhost:5433/spaces` ✅ | `…spaces@b@c@localhost:…` | solo `a` |
> | `host=localhost … password=…` (no es URL) | **la cadena entera, con la contraseña** | la cadena entera | vacía |
>
> El de `argv` es **visible con `ps` para cualquier proceso del droplet**, y además
> **impide actualizar**: libpq corta por el primer `@` igual que él, así que
> `…spaces@ssw0rd@localhost` no conecta —`could not translate host name "ssw0rd@…"`—,
> el respaldo aborta y **esa instancia no puede actualizarse nunca**. Es
> disponibilidad, no solo confidencialidad. El del log era una **regresión**: la
> versión anterior a `70b8cc5` acertaba con el `?`, y el `sed` nuevo quitaba la
> consulta **antes** de cortar por el último `@`, con lo que decapitaba la cadena.
>
> Desde el 19/08 hay **un solo parseo**, `partir_url`, y de él cuelgan los dos
> consumidores. Corta por el **último** `@`; el usuario y el host tienen que parecerlo;
> y si la cadena no se entiende **falla cerrado**: no publica `(url no parseable)` —las
> mismas palabras que `destinoSeguro()` en `scripts/migrar.mjs:225-232`— y el update se
> para con salida 1 antes de tocar nada, porque pasarla entera a `--dbname` sería la
> fuga que se acaba de quitar. Con eso desaparece también la excepción de la **barra
> invertida**, que dejaba la URL completa en `argv` a propósito: ahora se duplica antes
> del `printf '%b'` y se decodifica sin corromperla. **E62 a E72** lo cubren caso por
> caso —`@`, `/`, `?`, `@` repetida, `%40`, `\`, sin clave, sin `@`, `@` al final, lo
> que no es una URL— y **cada uno afirma las dos cosas**: qué sale al archivo que viaja
> y qué llega a `argv`.
>
> **Y quedaba una TERCERA vía, que se cerró el mismo día (ciclo 3):** la
> **consulta**. `partir_url` desarmaba el `usuario:clave@` pero la consulta se
> conservaba entera —a propósito, «quitarla cambiaría cómo se conecta»—, así que
> `postgresql://spaces@host:5433/spaces?password=secreto` llegaba **entero** al
> `--dbname`. No es una forma inventada: libpq la acepta —medido con `psql` 16— y
> `pg-connection-string` 2.14.0 —el parser de la app y de `scripts/migrar.mjs`— la lee
> **como la contraseña**. Y hay más: **gana sobre la del `userinfo`** en los dos
> clientes (medido contra un Postgres efímero: con la del `userinfo` mala y la de la
> consulta buena, la conexión entra; al revés, «password authentication failed»).
>
> > [!warning] «Gana la de la consulta en los dos clientes» **no vale para el valor vacío**
> > Con `?password=` **vacío los dos clientes se separan**: libpq se queda con la vacía
> > de la consulta —y falla la autenticación— mientras que `pg-connection-string` 2.14.0
> > conserva la del `userinfo`. Medido el 19/08 contra los dos. Se sigue a **libpq**,
> > que es quien va a conectar. **E79** lo fija.
>
> Por eso se separan `password` y `sslpassword` —los dos
> únicos parámetros de libpq cuyo valor es un secreto; `passfile` y `sslkey` son
> **rutas**—. La contraseña viaja por `PGPASSWORD`; la de `sslpassword` **no viaja**,
> y ahí hubo otro error propio: se escribió mandándola por `PGSSLPASSWORD`, que
> **no existe**. Medido sobre `libpq.so.5` de `postgres:16-alpine`: `PGSSLMODE`,
> `PGSSLKEY`, `PGSSLCERT` y `PGSSLROOTCERT` están en el binario y `PGSSLPASSWORD`
> tiene **cero apariciones** — y «funcionaba» porque una variable que nadie lee
> tampoco estorba. Así que se **descarta y se dice en el log**: con la llave del
> cliente cifrada el respaldo fallará y el update se parará en `BACKUP VACIO` sin
> tocar nada, y la salida es dejar esa llave sin cifrar. Un descarte silencioso
> habría dejado a esa instancia sin respaldo y sin explicación. **El resto de la consulta
> no se pierde**: `sslmode`, `sslrootcert`, `options`, `application_name`,
> `connect_timeout` o `target_session_attrs` deciden **cómo** se conecta, y perderlos
> dejaría sin poder actualizarse a instancias que hoy funcionan — el error opuesto y
> peor. **E74 a E77 y E79**, y los dos mutantes que son los dos errores opuestos.
>
> > [!danger] Y el arreglo introdujo la misma fuga por otra puerta — se cazó **leyendo
> > el diff**, no con el arnés
> > La primera versión de este cambio pasaba los secretos con
> > `env PGPASSWORD="$PG_CLAVE" pg_dump …`. Eso deja la asignación **en el `argv` de
> > `env`**, o sea la contraseña otra vez en `ps`: exactamente lo que el bloque existe
> > para cerrar. El prefijo de asignación de bash (`PGPASSWORD=… pg_dump …`) no, porque
> > entra en el entorno del hijo y no aparece en ninguna línea de comandos. **El arnés
> > pasó en verde**: los dobles ven su propio `argv`, no el del proceso que los lanza,
> > así que esta clase de defecto **no la puede ver** y no hay mutante que valga.
> > `correr_pg` conserva el prefijo de asignación de bash —ni `env`, ni un `PGPASSWORD=""`
> > incondicional, que no es lo mismo que no definirla y rompería `peer`, `trust` y
> > `.pgpass`— y el porqué está escrito ahí mismo, que es lo único que impide que
> > alguien lo "simplifique" mañana. Y de la misma clase, cazado igual —escribiendo el
> > arreglo, no auditándolo—: decidir si la URL se reescribe mirando **«hay
> > contraseña»** en vez de **«había algo que quitar»** deja la URL entera en `argv`
> > cuando la consulta trae `?password=` **vacío**, porque esa consulta vacía **pisa**
> > la clave del `userinfo`. **E79** lo fija, y se vio en rojo contra una copia con la
> > condición anterior. **Tres defectos propios en el mismo cambio** —éste, el de
> > `?password=` vacío y el de `PGSSLPASSWORD` (arriba)—, los tres del ejecutor y
> > ninguno de la auditoría, y **ninguno de los tres lo vio el arnés en verde**:
> > escribir el arreglo de una fuga resultó tan peligroso como la fuga.
>
> **Y aun así seguía abierta — M3, el mismo día, y esta vez cambiando el MÉTODO.**
> El ciclo 3 filtró `password` y `sslpassword` **por su nombre literal**. Pero libpq
> **percent-decodifica el nombre del parámetro antes de mirarlo**, así que
> `?%70assword=`, `?passwor%64=` y `?%70%61%73%73%77%6f%72%64=` son las tres
> `password` — y las tres **conectan**. Medido contra un Postgres efímero con
> `scram-sha-256` **forzado** y con control negativo; `pg-connection-string` 2.14.0
> hace lo mismo, o sea que **una instancia escrita así funciona hoy**. Van **tres
> ciclos y tres codificaciones**: `?password=`, `?PASSWORD=` y ahora estas.
>
> El fondo no era que faltara un caso: **una lista negra sobre un espacio de nombres
> que se decodifica no se puede demostrar completa**. Siempre queda otra codificación.
> Por eso M3 no añade un caso: quita la URL de `argv`. Cuatro banderas —`-h`, `-p`,
> `-U`, `-d`— y todo lo demás por variables `PG*`, con **lista blanca**: lo que no
> tiene equivalente **para el update con salida 1**, nombrando el parámetro y sin tocar
> nada. `?PASSWORD=` cae por ahí y deja de ser un «límite aceptado» (**E83**).
>
> Las ocho equivalencias están **medidas una a una** contra libpq 16, no leídas de la
> documentación: cinco por su efecto observable, y `PGSSLROOTCERT`, `PGSSLCERT` y
> `PGSSLKEY` **levantando TLS de verdad** en el servidor efímero, porque sin eso
> cualquier valor da el mismo *«server does not support SSL»* y no se aíslan. Y en la
> tabla `PQconninfoOptions` del binario cada palabra clave está pegada a su variable
> —`sslcert` en el byte 212560 y `PGSSLCERT` en el 212568— mientras que `sslpassword`
> está y `PGSSLPASSWORD` no aparece ni una vez: eso es lo que lo hace el único que se
> descarta.
>
> Y el contrapunto en las pruebas, que es la otra mitad de M3: el arnés probaba
> **codificación por codificación**, y por eso se le escaparon tres. Ahora hay una
> afirmación **global** —`argv_sin_marca`, en los 88 escenarios— que cierra la clase
> también del lado de las pruebas. **E80 a E83** cazan las cuatro codificaciones, y
> **E84-E85** fijan los dos límites que M3 **no** arregla —multi-host y URL de socket
> unix— para saber que no empeoran: siguen parando en seco con salida 1, comprobado
> contra la versión anterior del script.
>
> **Y una promesa que rompía instancias, borrada:** el README y la cabecera decían que
> la contraseña podía llevar `@`, `/`, `?` o `\` **sin codificar**. Medido: de los
> cuatro, sólo la barra invertida la aceptan los dos clientes —y en `instancia.env`
> tampoco, que lo *sourcea* bash—. `pa/ss` y `cl?ve` hacen que
> `pg-connection-string` lance `Invalid URL`; `@` y `/` los rechaza libpq. Quien
> siguiera esa instrucción se quedaba con una instancia **cuyo respaldo corría y cuya
> aplicación y cuyas migraciones no**. Ahora los dos documentos dicen lo mismo:
> **percent-encoded siempre** (`%40`, `%2F`, `%3F`, `%5C`).
>
> **Y la ambigüedad estaba mal descrita, en los dos sitios:** «ante una URL ambigua el
> update se para con salida 1» sólo es cierto **si la URL no lleva puerto**. Con
> puerto (`…:5433/spaces?application_name=space-os@demo`) `localhost` cuela como
> usuario, `demo` cuela como host, se publica un **`base=demo` falso** y el update
> muere cuatro pasos después como **`BACKUP VACIO`** — o sea que un fallo de **parseo**
> se presenta como un fallo de **respaldo** y manda a una persona a mirar el sitio
> equivocado. Arreglar el parseo quedó **fuera de alcance por decisión de Jochelo**;
> lo que sí cambió es que ese mensaje ahora manda a mirar el **`base=`** antes que
> `pg_dump`, y que **E78 fija el comportamiento medido** para que el día que se toque
> se entere alguien. Siguen fuera, y sin tocar: el **multi-host** (`host1,host2`) y la
> URL de **socket**, que son parada dura.
>
> **Y un comentario que decía lo contrario de lo medido**, corregido: `update.sh`
> afirmaba que cortar por el primer `@` «ni siquiera es lo que hace libpq». **Sí lo
> hace** —`psql 'postgresql://spaces:p@ssw0rd@host/spaces'` se queja de
> `could not translate host name "ssw0rd@host"`—. La regla implementada, la del
> **último** `@`, es la de WHATWG y node-pg; y esa discrepancia entre los dos clientes
> es justo **lo que hace correcta** la decisión de mandar la clave por el entorno. El
> comentario, al decirlo al revés, socavaba la razón del diseño.
>
> **Y un defecto propio, que salió de remedir:** documentar todo esto en la cabecera
> del script **descuadró el `--help`**, que imprime un rango de líneas **fijo**
> (`sed -n '2,121p' "$0"`, y era `2,113p` hasta el ciclo 3) y se comió las cuatro
> últimas sin decir nada. Corregido y
> fijado por **E73**, que lo comprueba por los **dos** extremos —la última línea que le
> toca y la primera que ya no—; hasta el 19/08 no había nada que lo mirara.

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

### Los cinco sitios donde `update.sh` decía algo que no era verdad (20/08)

Un ciclo entero sin una línea de lógica nueva: **cinco cosas que no eran verdad** —dos en
mensajes del código, dos en comentarios y documentación, y una laguna del arnés—.
Todas comparten el mismo defecto de fondo: el script **calcula bien** y luego **cuenta
mal** lo que hizo. Lo que un operador lee a las cuatro de la mañana es texto, no código.

| | Dónde | Qué decía | Qué pasa de verdad |
|---|---|---|---|
| **H1** | los dos `salir "$EX_VUELTA_FALLO"` de «VUELTA ATRAS A MEDIAS» | «el contenedor de la version anterior esta PARADO y **aparcado como `-anterior`**», sin condición | si el `rename` de 5b falló, el viejo **conserva su nombre** y `-anterior` **no existe** —lo borró el `docker rm -f` del propio 5b—. El **comando** que iba dos líneas después ya era correcto en las dos ramas: el mensaje se contradecía a sí mismo. Ahora la frase sale de `estado_del_viejo()`, hermana de `comando_rescate()` |
| **H2** | el arnés | ningún escenario ejercitaba la rama `else` de `comando_rescate()` | un mutante que invirtiera esa condición **escapaba entero**. Lo cubren **E86** y **E87** |
| **H-1** | `PULL_ESPERAS="${PULL_ESPERAS:-1 5 30}"` | «vacío = ningún reintento», en el comentario del código y en el README | los dos puntos sustituyen **también** el valor vacío: `PULL_ESPERAS=""` daba **3 reintentos** (medido). Sólo un **espacio** los apagaba. Se arregló el **código**, no la documentación: `${PULL_ESPERAS-…}`. Lo fija **E88** |
| **H-B** | el comentario del `source` de `respaldo.sh` | «esos **tres** lo DICEN» —las tres salidas que no pueden subir su log— | son **dos**. Con `flock` ausente el log trae **sólo** `ERROR update: falta flock…`: sale **antes** del candado, así que `subir_log_remoto` se rinde en su primer guard y no llega a emitir el aviso. Ni siquiera existe el archivo publicable (medido) |
| **H-C** | el AVISO 5 y el README | «por esa puerta pasan **seis de los siete** códigos», excepcionando sólo el `75` | `exit` pelados hay **tres**: el `75`, `--help` (`0`) y un argumento desconocido (`1`). Los dos últimos son del parseo de argumentos, anteriores al candado, así que la frase es cierta para el cron y falsa al pie de la letra. Precisión, no defecto |

> [!warning] Lo que aquí **no** se puede comprobar con el arnés
> El caso de `flock` ausente (**H-B**) exigiría que `flock` **no estuviera en el
> `PATH` del sistema**, y el arnés monta dobles, no los quita. Está **medido a mano**
> (20/08) y escrito, no fijado por una prueba. Es la segunda defensa de este archivo
> en esa situación: la otra es el `env VAR=… cmd` de `correr_pg`, que filtra por el
> `argv` de `env` y ninguna prueba puede ver porque los dobles reciben su propio `argv`.

> [!note] D1 se cerró en el ciclo siguiente, ese mismo día
> Aquel ciclo cambió el **texto** de los dos mensajes de la vuelta atrás, nada de su
> comportamiento. La restauración sobre un esquema limpio es lo que viene ahora.

### La vuelta atrás devuelve la base como estaba (20/08, D1) 🔴

**El defecto, medido:** `pg_restore --clean --if-exists` solo suelta **los objetos
que están dentro del dump**. Lo que creó la migración del release fallido no está
ahí, así que **sobrevivía a la vuelta atrás**. Contra Postgres 16.14: tras una
«VUELTA ATRAS COMPLETA» la tabla del ensayo seguía existiendo (`existe? t`) y
`schema_migrations` había vuelto a sus filas de antes **sin ella** (`registrada? f`).
El registro volvía; el esquema, a medias. Y el propio instrumento del script lo
denunciaba sin que nadie lo mirase: **la huella de después de restaurar no era la de
antes de migrar**.

**La consecuencia, reproducida de punta a punta** con una migración no idempotente:
el primer intento aplica, la salud falla, restaura y sale **4** dejando la tabla
dentro sin registrar; el segundo muere con `relation … already exists` y sale **2**.
Ese release **no se puede volver a aplicar nunca** y el `cron` lo reintenta cada
noche.

**Lo que se midió ANTES de escribir una línea**, porque el arreglo es un `drop`:
que el dump BASTE para reconstruir. La duda era razonable —`20260729_licencias_permisos.sql:96-97`
aborta si falta el rol de la aplicación y **13 migraciones lo referencian**—. Medido
con base desechable, rol privilegiado **no superusuario** y rol de app restringido:

| Lo que se preguntó | Lo que se midió |
|---|---|
| ¿el rol de la app sobrevive al `drop schema`? | **sí**: vive en el **servidor**, no dentro del esquema |
| ¿vuelven sus `GRANT` y los `alter default privileges`? | **sí**, los dos: viajan en el dump |
| ¿vuelven RLS, políticas y `force row level security`? | **sí**, las 24 políticas y el `force` de `config_negocio` |
| ¿vuelve `pgcrypto`, que el `drop` se lleva? | **sí** — y es **trusted** desde PG13, así que hasta el dueño no superusuario puede recrearla |
| ¿la app sigue aislada? | **sí**: ve su fila con el tenant fijado, **0** sin él, no toca las de otro y **no puede** desactivar la RLS ni tirar la política |
| ¿la huella vuelve a ser la de antes? | **sí**, idéntica (`88a9fd76…`) |
| ¿el release descartado se puede reaplicar? | **sí** — eso es justo lo que antes era imposible |

> [!warning] Lo único que el dump NO trae: `CREATE SCHEMA public`
> `pg_dump` emite los `GRANT` del esquema pero **no** su creación. Sin recrearlo a
> mano, la restauración moriría con «schema public does not exist». Se crea con
> `authorization` al dueño leído antes del `drop` (medido: `pg_database_owner`);
> crearlo sin él cambiaría el dueño **en silencio**.

**Cómo quedó**, en `limpiar_esquema()` de `update.sh` — el único `drop` del guion, y
con cuatro cerrojos porque corre en **todas** las instancias:

1. **No se dispara fuera de la vuelta atrás**: mira `VUELTA_ATRAS_EN_CURSO`, que
   solo se pone a 1 en §7a. Si se llama desde otro sitio, se **niega** y lo escribe.
2. **Exige respaldo verificado**: que el archivo exista y **no esté vacío** —esto
   cierra de paso el viejo `pg_restore` sin guarda `-s "$BK"`— y que **se pueda
   leer** (`pg_restore --list`; medido: un dump truncado pesa y sale 1).
3. **Si algo falla antes del `drop`, la base no se toca** y el mensaje trae el
   comando de rescate, como sus vecinos.
4. **El peor caso tiene código y mensaje propios**: `drop` bien + restauración mal =
   **base vacía**, código **7**, con los dos comandos **en orden** (primero la base,
   después el contenedor).

Y **se comprueba a sí mismo**: al terminar se relee la huella y se compara con la de
antes de migrar. Coincide → **4** («y la base volvió a su huella, comprobado
releyéndola»). No coincide → **6**, gritando los dos valores. No se puede releer →
**6** también, pero diciendo **«no consta»**, que no es lo mismo que «cambió» — la
lección de H1: lo que no se sabe no se afirma.

> [!important] Dos códigos de salida nuevos: `6` y `7`
> `6` = la instancia **sirve** pero la base no volvió (o no consta). `7` = **la base
> quedó vacía**. Estaban en 7 códigos y ahora son 9; `infra/scripts/README.md` los
> documenta en su tabla.

> [!danger] Dos hallazgos del camino, MEDIDOS y NO arreglados (fuera de alcance)
> Los dos son del mismo sitio —qué rol corre el update— y los dos deciden si una
> instancia puede actualizarse:
>
> 1. **`pg_dump` falla si el rol privilegiado no salta la RLS.** `config_negocio`
>    tiene `force row level security`, así que un rol que sea dueño pero **no**
>    superusuario ni `BYPASSRLS` no puede volcarla: *«query would be affected by
>    row-level security policy»*, **salida 1** y —ojo— un archivo de **110 092
>    bytes**, o sea **no vacío**. Lo caza el guard por **código de salida**, no el
>    de tamaño. Efecto: `BACKUP VACIO` y **esa instancia no se actualiza nunca**.
>    Le toca al aprovisionamiento (Fase 5) dar `BYPASSRLS` al rol de las
>    migraciones, o usar el superusuario.
> 2. **Si `pgcrypto` la instaló OTRO rol, la vuelta atrás de HOY no restauraba
>    nada.** `pg_restore --clean` empieza con `DROP EXTENSION IF EXISTS pgcrypto`;
>    si el rol no es su dueño, *«must be owner of extension pgcrypto»*, y con
>    `--single-transaction` **se revierte todo**: código 5 con la base intacta y
>    a medio migrar. **El arreglo de D1 quita esa vía de fallo de paso**: sobre un
>    esquema limpio no hay extensión que tirar, y `CREATE EXTENSION` la puede
>    hacer el dueño de la base porque `pgcrypto` es **trusted** desde PG13
>    (medido). Aun así, el aprovisionamiento debería crearla con el mismo rol que
>    corre las migraciones.

**Lo que se comprueba de que las comprobaciones muerden:** **ocho mutantes** de una
línea, todos **CAZADOS** y contra el arnés **entero** (102 escenarios, ~6 min por
corrida), no contra una copia reducida. Dos no salieron a la primera y por eso vale
la pena dejarlo escrito: uno era **inválido** —`\?` en GNU `sed` es cuantificador y
el patrón no casaba— y otro **escapaba** porque, enganchado al paso 3,
`limpiar_esquema` **aún no está definida** y el `|| true` se tragaba el «command not
found». Y **tres más contra la base de verdad**, que es lo que los dobles no pueden
ver: crear el esquema sin `authorization` (1 roja), una limpieza que aborta antes del
`drop` (**4 rojas**, incluida la de punta a punta) y sustituir el `drop`, que el
**guard anti-deriva** del propio ensayo para en seco. El único mutante que **no se
puede escribir** es quitar el guard de `VUELTA_ATRAS_EN_CURSO`: hoy nada lo llama
fuera de sitio, que es justo lo que ese guard vigila.

**El ensayo que lo prueba está en el repositorio**: `infra/scripts/pruebas-vuelta-atras-real.sh`,
contra un Postgres de verdad y una base desechable —**27 comprobaciones · 0 rojas**—.
Reproduce el defecto, la consecuencia, el arreglo y el aislamiento del rol
restringido. **Extrae el SQL de limpieza y la consulta de la huella de `update.sh`**
en vez de copiarlos: una copia se habría quedado vieja sin que nadie se enterase. Su
guard es el de las e2e — se niega si la base no acaba en `_test` o `_e2e`.

### El actualizador contaba mal lo suyo (20/08) 🟡

Cuatro hallazgos de las dos auditorías del día, y **uno solo de fondo**: *algo del
actualizador afirmaba o contaba lo que ya no era cierto*. Ninguno cambia lo que el
guion **hace**; los cuatro cambian lo que **dice de sí mismo**, que es de lo que vive
quien lo diagnostica sin entrar al servidor.

| # | Dónde | Qué decía | Qué se hizo |
|---|---|---|---|
| ① | los dos mutantes de `PULL_ESPERAS` en `pruebas-update.sh` | mutaban `${PULL_ESPERAS:-1 5 30}`, **con** los dos puntos, que es la forma que H-1 quitó ese mismo día | reescritos contra la línea de hoy, **conservando lo que cada uno sabotea**, y los dos vuelven a salir **CAZADOS** |
| ② | la tabla de códigos de la **cabecera de `update.sh`** | `0,1,2,3,4,5,75`: **ni el 6 ni el 7**, dos días después de que D1 los añadiera | añadidos con su explicación; y el `--help`, que imprime un rango **fijo** de esa cabecera, se remidió a `2,131p` |
| ③ | el ejemplo de registro publicable del README | `7a · base restaurada (esquema Y registro de migraciones)` — **cadena que D1 borró del código** — y un `VUELTA ATRAS COMPLETA` sin la coletilla de la base | **regenerado de una corrida real** (escenario E13), no escrito a mano |
| ④ | dos afirmaciones de `update.sh` | «`pg_restore --list` rechaza un dump truncado» y «La base NO se vacio» | **acotadas**: ver abajo |

> [!danger] ①  no era «la barrida no se ha corrido», era «la barrida **no se podía correr**»
> El validador del propio arnés daba esos dos mutantes por
> `INVALIDO … toco 0 lineas, no una`, y con eso `--mutantes` **salía con 1** al llegar
> ahí: la barrida completa era **imposible** desde el commit anterior. Se comprobó
> además que **ningún otro** hubiera derivado, pasando los **52** por las tres
> comprobaciones de validez: **52 válidos, 0 inválidos** (20/08).

**②  importa por dónde vive la tabla.** La cabecera de `update.sh` dice de sí misma que
es el archivo que se instala en `/opt/space-os/update.sh`: quien abre un fallo a las
cuatro de la mañana tiene **el guion** delante, no el README. Y el que faltaba era el
**7 · LA BASE QUEDO VACIA**, el estado más urgente que este guion puede producir. De
paso se corrigió el «pasan seis de los **siete** códigos» del AVISO 5, que llevaba dos
días diciendo siete cuando ya eran **nueve**.

**④, las dos acotaciones**, que son la misma lección de H1 —*lo que no se sabe no se
afirma*—:

- `pg_restore --list` **valida el índice del dump, no los bloques de datos**. Medido en
  la auditoría: un dump truncado al **99,5 %** pasa el guard, el `drop` se ejecuta y la
  restauración muere dejando la base vacía. El camino **está cubierto** —tiene su
  código 7 y sus dos comandos en orden—, pero la prosa prometía una garantía que el
  guard no da. Lo que sí caza: el archivo que no es un dump, el cortado por arriba y el
  ilegible.
- «La base NO se vacio» se afirmaba **también** cuando lo que murió fue el cliente
  `psql` **después** de que el servidor confirmara la limpieza — y en ese caso el
  esquema está recreado y **vacío**. Desde este lado solo se ve un código de salida, así
  que ahora el mensaje dice lo que sabe («este script NO lo comprobo», «Mira la base
  ANTES de decidir») y trae **los dos** comandos según lo que se encuentre. **E95 exige
  ahora lo contrario de lo que exigía**: que la frase incondicional **no** esté.

> [!warning] Un sexto sitio del mismo patrón, medido y **no** arreglado
> `update.sh` registra `5b · parando … y guardandolo como space-os-anterior`
> **antes** de intentar el `rename`, así que en la rama en la que el `rename` falla el
> log conserva esa frase. Está **mitigado** —el `AVISO` que sale justo después la
> desmiente, y `estado_del_viejo()` decide por la variable, no por el log—, pero es el
> mismo defecto que los cinco de la mañana: **el log cuenta el plan, no el resultado**.
> Queda declarado, no corregido.

> [!note] Y una limpieza pendiente del arnés real
> `pruebas-vuelta-atras-real.sh` destruye su base al terminar pero **no los roles que
> creó**: `d1r_mig_test` y `d1r_app_test` se quedan en el clúster. No estorban —son
> `nosuperuser` y sin objetos una vez cae la base— pero el ensayo no deja el clúster
> como lo encontró. Otro ciclo.

**Verificado:** `bash infra/scripts/pruebas-update.sh` →
`102 escenarios · 664 comprobaciones · 0 rojas`. Los **dos** mutantes reparados,
corridos contra el arnés **entero**, **CAZADOS**.

## Producción ya no es un droplet: es una FLOTA

> [!important] 2026-08-26 · Esta sección se reescribió entera (F8.3)
> Hasta hoy describía producción como **un** droplet con **un** proceso pm2
> sirviendo `demo.space-os.io`, y daba `deploy.yml` por el mecanismo de
> despliegue. Ese texto describía el mundo anterior al
> [modelo de instancias soberanas](../../docs/adr/0022-instancia-dedicada-por-owner.md).
> Lo que sigue describe el de hoy.

**Un solo código, muchas máquinas.** Se trabaja en el PADRE, se prueba en DEMO,
y cada instancia **jala** su versión del canal al que está suscrita. El padre no
empuja: ver [[modelo-instancias-soberanas]] y
[ADR 0022](../../docs/adr/0022-instancia-dedicada-por-owner.md).

| Entorno | Qué es | Cómo corre | Base | Dominio |
|---|---|---|---|---|
| **PADRE** | Plano de control de AS OOH y sitio institucional. **No sirve a ningún owner** | pm2 `spaces-web`, puerto **3000** | `spaces_prod` | `space-os.io` — `infra/nginx/space-os.io.conf:124` |
| **DEMO** | Banco de pruebas. Segundo proceso **dentro del PADRE** ([ADR 0015](../../docs/adr/0015-demo-dentro-del-padre.md), [ADR 0017](../../docs/adr/0017-todo-se-concentra-en-el-padre.md)) | **systemd**, unidad `infra/systemd/spaces-demo.service`, usuario `demo`, puerto **3001** — pm2 no le alcanza ([ADR 0019](../../docs/adr/0019-demo-arranca-con-systemd.md)) | `spaces_demo` | `demo.space-os.io` — `infra/nginx/space-os.io.conf:188`. El nombre **se conserva** ([ADR 0021](../../docs/adr/0021-demo-space-os-io-se-queda.md)); **qué máquina lo sirve no está decidido** |
| **Instancia de un owner** | Su copia completa: droplet, base y dominio propios | Contenedor Docker, lo levanta `infra/scripts/update.sh` | La suya | El **suyo**, en **su** zona DNS — plantilla `infra/nginx/instancia.conf.tpl` |
| **Droplet de julio** | La máquina montada a mano en julio. **Fuera del modelo** ([ADR 0017](../../docs/adr/0017-todo-se-concentra-en-el-padre.md)) | pm2 `spaces-web`, usuario `emiliano`, `/var/www/Spaces` | `spaces_prod` propia, con cinco organizaciones dentro | Hoy sigue sirviendo `demo.space-os.io`. Su destino es **decisión abierta** |

> [!warning] Dos bases distintas se llaman igual: `spaces_prod`
> La del PADRE (`docs/Runbook_Padre_Droplet_Nuevo.md:201`, creada el 24/08) y la
> del droplet de julio, con las cinco organizaciones dentro. **Están en máquinas
> distintas y no tienen nada que ver.** Un comando copiado de un runbook al otro
> apunta a la base equivocada sin dar error. Mira siempre en qué máquina estás
> antes de correr nada contra `spaces_prod`.

**Cómo llega el código a cada sitio:**

| Camino | Quién lo usa | Mecanismo |
|---|---|---|
| Tag `v*.*.*` → imagen en el canal `beta` | La flota | `.github/workflows/release.yml` (ver arriba) |
| `beta` → `estable`, reetiquetando y **sin reconstruir** | La flota | `.github/workflows/promover.yml` (ver arriba) |
| La instancia jala su canal, respalda, migra y conmuta | Cada instancia, sola | `infra/scripts/update.sh`, por cron a las **04:17** (`infra/scripts/provision-instancia.sh:359`) |
| Alta de una instancia nueva | Una persona, **una sola vez** por owner | `infra/scripts/provision-instancia.sh` + `docs/runbook-alta-de-owner.md` |

> [!warning] `deploy.yml` SIGUE en el repo — F3.6 no está hecha
> El plan retira `.github/workflows/deploy.yml` en **F3.6**, porque entra por
> `ssh` como `root` y compila en el servidor: las dos cosas que el modelo
> prohíbe. **A 2026-08-26 el archivo sigue ahí** (`.github/workflows/deploy.yml`,
> comprobado con `ls`). Mientras exista, sigue siendo un camino que contradice
> el modelo, y **la nota no puede decir lo contrario**. El PADRE y DEMO hoy **no**
> se despliegan con él.

> [!danger] `X-Forwarded-For $remote_addr` es deliberado, y ahora está en tres sitios
> `infra/nginx/snippets/proxy-app.conf:30`, `infra/nginx/demo.space-os.io.conf:123`
> y la plantilla de instancia `infra/nginx/instancia.conf.tpl:155`
> **reemplazan** la cabecera en vez de añadir a la que mande el cliente. Eso es
> lo que impide que alguien elija su propio cubo de rate limit. Si se cambiara a
> `$proxy_add_x_forwarded_for`, el limitador del login se vuelve burlable
> mandando una IP inventada. **Al copiar una configuración de nginx a una
> instancia nueva, esta línea se copia tal cual.**

`infra/nginx/spaces.conf` y `infra/apache/spaces.conf` están **obsoletos**
(asumen el API Fastify archivado). `spaces.conf:39` conserva además el
`$proxy_add_x_forwarded_for` que el resto ya no usa: una razón más para no
tomarlo de modelo.

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
`GOOGLE_AUTH_ENDPOINT`, `GOOGLE_TOKEN_ENDPOINT`, `SMOKE_BASE`.

> **`SEED_PASSWORD` ya no existe** — retirada el 2026-08-20 al cerrar ROJO-1.
> El alta genera la contraseña del Dueño y la imprime una vez.

### Declaradas pero **no leídas** por `apps/web`

`JWT_SECRET`, `REDIS_URL`, `LOG_LEVEL`, `NEXT_PUBLIC_TENANT_SLUG` y
`NEXT_PUBLIC_API_URL` (esta última **ya no la lee nadie**: el `auth-context.tsx`
que la usaba se retiró el 27/08 con la pista archivada).
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
