# Plan de implementación v3 · Modelo de despliegue por instancias soberanas

> **Autoridad:** `2026-08-12-correccion-modelo-instancias-space-os.pdf` (y su
> extracción `.md`). Este plan **desarrolla** sus nueve fases (0–8); no las
> reordena ni las reinventa.
> **Sustituye a:** el **plan v2** (`Plan_Instancias_Soberanas_v2.md`, commit
> `9e244c7`), que queda archivado; y a
> `2026-08-11-subdominios-por-tenant-plan.md`.
> **Repo verificado:** worktree `…\.claude\worktrees\servidor-padre`, rama
> `feat/servidor-padre-instancias`, base `main` local = `emiliano/main` =
> `dfccd04`. Todas las rutas y líneas se abrieron con Read/Grep el 2026-08-12 y se
> reverificaron las de la Fase 1 el 2026-08-13.
> **No se ejecutó nada:** ni `ssh`, ni `curl` a producción, ni `doctl`, ni
> escritura fuera de este archivo. Los comandos contra servidores están escritos
> para que los corra una persona.

> [!] **Estado: aprobado para ejecución** (2026-08-13). Este es el plan que se
> ejecuta; no se replanea.
> **Lo aprobado es el plan, no las decisiones de negocio.** Las cuatro de la §8 del
> documento del 12 —destino del tenant `rgb` y del droplet actual, fecha de PIXELED,
> en qué cuenta nacen las instancias, nombre del registry— y la P4-bis siguen
> abiertas salvo aviso expreso de Jochelo. Las tareas que dependen de ellas están
> marcadas **BLOQUEADA** o **condicionada**: se detienen y se preguntan, no se
> resuelven sobre la marcha.

---

**Cómo se lee este plan.** Cada tarea es un commit con sentido. Lleva etiqueta
(`[código]`, `[migración]`, `[infra]`, `[release]`, `[verificación]`), **entorno**
(PADRE / DEMO / instancia de owner) y **quién** la ejecuta. Las de infra, release y
verificación no llevan prueba automatizada: llevan comando de smoke y las
respuestas posibles con su significado.

**El modelo, en una frase.** Un solo código, muchas instancias. Cada owner corre su
copia completa de SPACE OS en su propio droplet, con su base y su dominio. Los bugs
y las mejoras se trabajan una vez en el **PADRE**, se prueban en **DEMO**, y cada
instancia jala la versión estable. La RLS no desaparece: queda dentro de cada
instancia como defensa en profundidad, pero deja de ser el modelo de negocio.

---

# Paso 1 · Inventario

## 1.1 Hechos del repo que los documentos afirman — verificados hoy

| Lo que afirma el documento | Estado | Referencia real de hoy |
|---|---|---|
| `infra/scripts/new-tenant.sh` existe y es de la pista Prisma archivada | **Coincide** | `infra/scripts/new-tenant.sh` (5453 B, ejecutable): `CREATE SCHEMA tenant_<slug>` (`:71`), `prisma migrate deploy` (`:76-78`), `INSERT INTO public."Tenant"` (`:95-99`), URL inventada `https://admin.$slug.spaces.com` (`:110`) |
| `aislamiento.e2e.test.ts` existe y es intocable | **Coincide** | `apps/web/lib/test/aislamiento.e2e.test.ts`, 213 líneas, bloques 8–14 |
| El autoregistro se apaga solo con `NEXT_PUBLIC_AUTOREGISTRO='0'` y se incrusta en el build | **Coincide** | `apps/web/app/api/signup/route.ts:18`; `apps/web/app/(app)/login/page.tsx:30`; `apps/web/lib/server/google-oauth.ts:90`; el arnés lo fija en `apps/web/lib/test/servidor-e2e.ts:49`; la imposibilidad de probarlo, documentada en `aislamiento.e2e.test.ts:200-213` |
| `.env.example` trae la bandera en `1` | **Coincide, y en la línea que decía** | `.env.example:23` → `NEXT_PUBLIC_AUTOREGISTRO=1` |
| Los `DEFAULT` de `tenant_id` apuntando a `rgb` | **Coincide en el mecanismo, NO en el número: son 23, no 21** | `db/schema.sql:600-624` (bloque `do $$`); arreglo de tablas en `:604-609`; `alter … set default` en `:615`; el tenant es el de `slug='rgb'` |
| `config_negocio` va aparte y **sin** default (ADR 0011) | **Coincide** | `db/schema.sql:626` en adelante, con el comentario que explica que ese default «ha ido etiquetando como RGB filas de otras organizaciones» |
| `campanas-repo.ts:300` hace un `select … limit 1` sin filtro de tenant | **Coincide, línea exacta** | `apps/web/lib/server/campanas-repo.ts:300` — `select max_clientes_pantalla from config_negocio limit 1`, dentro de `cupoGlobalClientes(client)` (`:299-303`); único llamador en `:417` |
| `tenantActual()` no lee el `Host` | **Coincide** | `apps/web/lib/server/tenant.ts:32-41` |
| Las cookies no llevan `domain` | **Coincide** | `cookieSesion()` `apps/web/lib/server/auth.ts:191-201`, `cookieCsrf()` `:216-226`. Ninguna fija `domain`. `COOKIE_DOMAIN` aparece en `.env.example:4` pero **no lo usa ni una línea de `apps/`** |
| `qRaw` solo para tablas exentas; `config_negocio` es fail-closed | **Coincide** | `apps/web/lib/server/db.ts:44-52` (`qRaw`), `:80-102` (`qConTenant`), `:110-127` (`withTenantTx`); tabla de puertas en `vault/02-Backend/multi-tenancy-y-rls.md` |
| `extractSubdomain` trata una IP como subdominio | **Coincide** | `apps/web/middleware.ts:14-21` (`parts.length >= 3`); se usa en `:80-89` con `moduleMap = { portal: '/portal' }` (`:10-12`) |
| `crearOrgConDueno` son hoy dos llamadas sueltas | **Coincide** | `apps/web/lib/server/cuentas-controller.ts:41-62`; las dos llamadas en `:52-53` |
| Convención de migraciones `AAAAMMDD_nombre.sql`, transaccional e idempotente | **Coincide** | 66 archivos en `db/migrations/`; última `20260810_notificaciones_archivada_en.sql`. Estilo canónico: `db/migrations/20260810_arrendadores_rfc_unico.sql` (`begin;` → guard `do $$` que aborta nombrando lo que choca → cambio `if not exists` → ASSERT → `commit;` → consulta de verificación → rollback comentado) |
| Las ADR llegan a la 0013 | **Coincide** | `docs/adr/0013-altas-que-no-se-pueden-duplicar.md`. La nueva es la **0014** |
| Hay CI | **Coincide** | `.github/workflows/ci.yml` (typecheck → test → build), `deploy.yml` (manual), `lockfile-check.yml` |
| Las migraciones de producción van como `postgres` | **Coincide** | `.github/workflows/deploy.yml:138-149`; los comentarios `:12-19` explican por qué `apply-migration.mjs` no sirve allí (conecta como el rol de la app y una migración de datos vería CERO filas) |

## 1.2 Hechos nuevos que el repo aporta y los documentos no mencionan

Estos cambian tareas concretas. No son opinión: salen de abrir el archivo.

1. **`withTxBootstrap` NO existe.** `rg` sobre todo `*.ts`/`*.tsx`: cero resultados.
   El plan del 11 lo **proponía** (Tarea 5, paso 3); nunca se escribió. El documento
   del 12 lo llama «rescatado TAL CUAL» — no hay nada que rescatar: es **código
   nuevo** (tarea **F5.1**). Lo que hoy existe en `db.ts` es `qConTenant` (`:80-102`)
   y `withTenantTx` (`:110-127`), y ninguna sirve para el alta (la segunda fija el
   tenant *de la sesión*, que en un alta todavía no existe).
2. **No hay 21 tablas con `DEFAULT`: hay 23.** Contadas una a una en
   `db/schema.sql:604-609`: `usuarios, sitios, clientes, propuestas, propuesta_items,
   ordenes_compra, campanas, creatividades, reservas, ordenes_trabajo, evidencias_ot,
   ordenes_impresion, facturas, cobranzas, arrendadores, contratos_arrendamiento,
   pagos_renta, incidencias, notificaciones, acciones, sitio_modalidades, predios,
   arrendador_razon_social`. Las dos últimas se sumaron después de que se escribiera
   el «21». La Fase 1 usa **23** — y aun así la migración las descubre por catálogo,
   no por lista (F1.2).
3. **No existe `Dockerfile`, ni `.dockerignore`, ni `schema_migrations`, ni
   `/api/version`.** Las fases 2, 3 y 6 arrancan de cero. Lo único parecido a Docker
   son dos `docker-compose.yml` de **desarrollo** (`db/docker-compose.yml`, Postgres
   16 en 5433; `infra/docker-compose.yml`, del stack Fastify archivado).
4. **`next.config.mjs` no fija `output: 'standalone'`** (`apps/web/next.config.mjs:8`
   solo trae `basePath: '/spaces-dooh'`). Sin standalone, la imagen carga con todo el
   `node_modules` del monorepo. Es tarea aparte (F2.1) y va **antes** del Dockerfile.
5. **No hay tres scripts muertos de la pista Prisma: hay cuatro.** Además de
   `new-tenant.sh`:
   - `infra/scripts/setup-first-tenant.sh` **llama** a `new-tenant.sh` (`:28-31`) con
     datos reales quemados (`h3dm`, `hm28443@gmail.com`) → borrar solo `new-tenant.sh`
     lo deja roto;
   - `infra/scripts/migrate-all-tenants.sh` lee `public."Tenant"` (`:36-37`) y corre
     `prisma migrate deploy` por schema (`:65-67`);
   - `infra/scripts/deploy.sh` apunta a `/var/www/Marketplace/spaces-dooh` (`:22`) —la
     **ruta muerta** que `deploy.yml:8-10` documenta como defecto #1— y corre
     `prisma migrate deploy` (`:67`).
   Los cuatro se retiran juntos (F5.5).
6. **`recrearEsquema()` codifica un orden de migraciones que no es el lexicográfico
   puro.** `apps/web/lib/test/db-e2e.ts:145-155` mantiene un mapa `ANTES_DE` con dos
   excepciones reales (`20260720_hard1_usuarios_rls.sql` antes de
   `..._rls_todas_tablas.sql`; `20260727_contrato_incompleto_enum.sql` antes de
   `..._contrato_incompleto.sql`). **El runner de la Fase 3 tiene que reproducir ese
   orden o una instancia nueva no se levanta.** `deploy.yml:141` ordena hoy con `sort`
   a secas: funciona solo porque en producción se aplicaron a mano en el orden bueno.
7. **`db/schema.sql` es un SUBCONJUNTO de producción** — le faltan 143 columnas y
   tablas enteras, y por eso las pruebas aplican esquema **más** las 66 migraciones
   (`apps/web/lib/test/db-e2e.ts:100-118`). Consecuencia buena para el modelo: una
   **instancia nueva nace correcta** si se crea con `schema.sql` + todas las
   migraciones, que es justo lo que CI ejercita en cada corrida.
8. **`server-only` bloquea el atajo obvio de la Fase 5.** `db.ts:1` y `auth.ts:1`
   empiezan con `import 'server-only'`, y el propio repo documenta que ese paquete
   «lanza un error si se importa fuera de un React Server Component»
   (`apps/web/lib/test/server-only-stub.ts`, `apps/web/vitest.config.ts:11-14`). Un
   `script.mjs` de aprovisionamiento **no puede** importar `withTxBootstrap` ni
   `hashPassword` (`auth.ts:83-84`, bcrypt coste 10). Por eso F5.2 crea el Dueño por
   una ruta HTTP de un solo uso en vez de duplicar el hash en un script.
9. **La app ya pasa `tenant_id` explícito en todos sus INSERT.** Revisados
   `campanas-repo.ts:687-696`, `ot-repo.ts:158-165` y las semillas
   `semillas-e2e.ts:42-112`: todos lo mandan. Quitar el `DEFAULT` **no rompe código
   vivo**; solo deja de tapar los INSERT hechos a mano. Esto convierte a F1.2 en un
   `contract` seguro pese al invariante 8.
10. **`deploy.yml` contradice el invariante 2.** Entra por `ssh` como `root`, hace
    `git checkout`, `npm run build` y `pm2 reload`
    (`.github/workflows/deploy.yml:67-190`). Eso es **empujar desde el padre y
    compilar en el servidor de una instancia**: las dos cosas que el modelo prohíbe.
    No se puede borrar antes de que exista el canal (Fase 3) — se retira en **F3.6**.
11. **El panel de flota no puede vivir en `apps/web`.** El artefacto es idéntico para
    todas las instancias (invariante 3); meter el panel ahí lo enviaría al servidor de
    cada owner con la lista de la flota dentro. Va en un workspace aparte
    (`apps/flota`), fuera de la imagen (F6.2).
12. **`APP_URL` ya es el «dominio de acceso» del código.** Construye los enlaces
    absolutos en `app/api/auth/forgot/route.ts:50`,
    `app/api/auth/google/callback/route.ts:61,81`, `lib/server/google-oauth.ts:65` y
    `app/api/recordatorios/route.ts:65`. En el `.env` de cada instancia, esa variable
    **es** su dominio. No hace falta inventar una nueva.
13. **Ya hay deriva reconocida entre `main` y producción.** Commit `2f28be0`:
    «docs(boveda): aviso — main lleva una migracion que produccion no tiene». El censo
    de la Fase 4/7 parte de ahí, no de suponer que producción = `main`.
14. **El rol de la app no puede ser superusuario.** `db/dev-rol-app.sql` lo explica
    («el superusuario SALTA la RLS y entonces el aislamiento por tenant no se estaría
    probando de verdad») y los GRANT los da
    `db/migrations/20260715_arr_m6_rol_restringido.sql`. Toda base de instancia nueva
    necesita los dos roles: `postgres` para migrar, uno `NOSUPERUSER NOBYPASSRLS` para
    la app.

## 1.3 Referencias de los documentos que ya NO aplican

| Referencia citada | Qué pasa | Qué se hace |
|---|---|---|
| «`withTxBootstrap` se rescata TAL CUAL» (§4, T5) | **No existe en el repo.** Era una propuesta del plan del 11 | Se escribe de cero en **F5.1**. Aparece como código nuevo, no como rescate |
| «los 21 `DEFAULT` de `tenant_id`» (§4 y §5 Fase 1) | Son **23** en `db/schema.sql:604-609` | Se usa 23, y la migración los descubre por catálogo (F1.2) |
| «`auth.ts:191-228`» para las dos cookies (plan 11, restricción 1) | `cookieSesion` sigue en `:191`; `cookieCsrf` empieza hoy en **`:216`** | Se cita `auth.ts:191-201` y `auth.ts:216-226` |
| «`aislamiento.e2e.test.ts:199-213`» | El bloque del autoregistro empieza hoy en **`:200`** y el archivo termina en `:213` | Se cita `:200-213` |
| `prepararBase()` (plan 11, tareas 3-6) | **No existe.** La función real es `recrearEsquema()` (`db-e2e.ts:120`) | Toda prueba nueva usa `recrearEsquema()` + `asegurarPermisos()` + `sembrarTenant()` |
| `POST /api/tenants` «devuelve la URL del subdominio» | Descartado por §4 (T5 parcial) | La ruta sigue igual (`app/api/tenants/route.ts:21-31`) y **no** cambia su forma de retorno |
| `subdominioDe()`, `marca.ts`, candado de coherencia, wildcard DNS | Descartados por §2 y §4 | No aparecen en este plan. Si un paso los necesitara, el paso está mal |
| «`new-tenant.sh` solo se cita a sí mismo» (T8, paso 1 del plan del 11) | **Falso hoy:** `infra/scripts/setup-first-tenant.sh:28` lo invoca | El borrado se amplía a los cuatro scripts muertos (F5.5) |
| «hay que añadir `X-Forwarded-Host` a nginx» (T9) | **Ya está**: `infra/nginx/demo.space-os.io.conf:125` | Nada que hacer; la tarea estaba descartada de todos modos |
| «Se instala y ensaya primero en DEMO» (Fase 3) cuando DEMO aún no existe (Fase 4) | Tensión de orden **dentro del documento**, no contradicha por el repo | Se respeta el orden de fases y se explicita la dependencia: **F3.5 depende de F4.5**. Ver **P5** |

## 1.4 Hechos externos que NO se pueden verificar desde aquí

Ninguno se da por cierto. Cada uno es un paso de verificación con su comando y sus
respuestas.

| Hecho que los documentos o el contexto dan por bueno | Dónde se verifica |
|---|---|
| El autoregistro está apagado en el droplet actual (indicio: se aplicó el 2026-08-04) | **F0.1** |
| Qué corre hoy en `209.97.146.136`: versión desplegada, `pm2`, nginx, certificado, `COOKIE_SECURE`, `.env` | **F4.1** |
| Qué tenants viven en `spaces_prod`. El documento del 12 dice `rgb, g500, eyro, emis-pruebas`; el contexto operativo dice `g500, rgb, eyro, telcel, demo-owner`. **Son listas distintas** | **F7.1** (censo autoritativo) |
| Cuántas filas están mal etiquetadas como `rgb` (indicio: 15 modalidades de `g500`/`eyro`) | **F1.1** |
| Estado del proxy de Cloudflare sobre `space-os.io` (naranja/gris) y de la zona DNS | **F4.3 paso 1** |
| Existencia y nombre del registry de imágenes | **Bloqueado** — decisión §8.4 |
| En qué cuenta de DigitalOcean nacen las instancias | **Bloqueado** — decisión §8.3 |

---

# Paso 2 · Rescate del plan del 11, tarea por tarea

Los diez, sin omitir ninguno. «Se incorpora» dice en qué tarea nueva; «se descarta»
dice por qué.

| # | Tarea del 11 | Veredicto del doc del 12 | **Qué se hace aquí** |
|---|---|---|---|
| **T0** | Verificar y cerrar el autoregistro | SE EJECUTA | **Se incorpora** en **F0.1**, **F0.2** y **F0.3**. Verificado: la bandera se lee en cuatro sitios de código (`signup/route.ts:18`, `login/page.tsx:30`, `google-oauth.ts:90`, arnés `servidor-e2e.ts:49`) y `.env.example:23` sigue en `1`. F0.3 añade lo que el plan del 11 no tenía: la regla «solo DEMO» queda **anclada por una prueba unitaria**, no por memoria |
| **T1** | `subdominioDe()` — parser de Host | SE DESCARTA | **Se descarta.** No hay subdominios que parsear: una instancia = un dominio, fijo en su `.env` (`APP_URL`). Reconstruirlo obligaría a que algo lea el `Host`, contra el invariante 4 |
| **T2** | Arnés e2e con cabecera `Host` | SE DESCARTA | **Se descarta.** Solo existía para probar T1 y T6. `servidor-e2e.ts` no se toca en todo este plan |
| **T3** | Slugs reservados con `CHECK` en la base | SE ADAPTA | **Se descarta como código y se incorpora como nota de infra** en **F8.1** (ADR 0014: en la zona `space-os.io` quedan reservados `demo`, `beta`, `panel`, `releases`, `status`, `www`). Motivo verificado: aquel `CHECK` prohibía slugs por ser etiquetas DNS, y el slug de un owner ya no es su URL. Además **habría abortado hoy**: `demo` estaba en su lista de reservados y el contexto operativo reporta un tenant `demo-owner` |
| **T4** | `marca.ts` — marca por subdominio | SE DESCARTA | **Se descarta.** Una instancia = una empresa = una marca, desde su `config_negocio`. El login ya la muestra |
| **T5** | Alta atómica (`withTxBootstrap`) + URL en la respuesta | SE EJECUTA (parcial) | **Se incorpora la mitad atómica** en **F5.1** (y su consumidor en F5.2). **Se descarta** la URL. **Corrección:** no es un rescate — `withTxBootstrap` no existe (grep sin resultados); el problema que arregla sí es real y está en `cuentas-controller.ts:52-53` |
| **T6** | Candado de coherencia en `exigir()` | SE DESCARTA | **Se descarta.** El aislamiento entre owners es físico. `auth.ts:146` no se toca |
| **T7** | Marca en el login | SE DESCARTA | **Se descarta.** Mismo motivo que T4 |
| **T8** | Borrar `new-tenant.sh` | SE EJECUTA | **Se incorpora ampliada** en **F5.5**: el repo tiene **cuatro** scripts de la pista archivada, y `setup-first-tenant.sh:28-31` invoca a `new-tenant.sh`, así que borrarlo solo dejaría una llamada rota |
| **T9** | Wildcard DNS + certificado wildcard + nginx `*.space-os.io` | SE DESCARTA | **Se descarta.** Pieza central del modelo equivocado. Lo que sobrevive es el **procedimiento** de certificado normal HTTP-01 ya probado en `docs/runbook-dominio-https.md`, que **F4.3** y **F5.4** reutilizan con el dominio de cada instancia |

**Rescate extra que el §4 nombra sin asignarle tarea:** el bug de `extractSubdomain`
con IPs («se corrige aunque el parser nuevo no se construya»). Verificado vivo en
`middleware.ts:14-21`. Se incorpora en **F1.4**, dentro de la Fase 1 por ser higiene
previa al clonado. Si Jochelo prefiere otra fase, es mover una tarea, no cambiar el
diseño.

**Lo descartado no se revive.** Si un paso de este plan necesitara parsear el `Host`,
resolver marca por subdominio o pedir un certificado comodín, ese paso está mal.

---

# Restricciones globales (aplican a todas las tareas)

1. **Nadie edita código en el servidor de una instancia.** Ni un `sed`, ni un
   `npm run build`. Todo nace en el PADRE.
2. **El update es pull.** El padre no empuja ni entra por SSH a una instancia.
   *Única excepción, por texto del propio documento (§5 Fase 5 y §6 paso 2):* el
   **aprovisionamiento inicial**, que crea la instancia desde el plano de control.
   Después de esa primera vez, nunca más.
3. **El artefacto es idéntico.** Lo que cambia por owner vive en su base y su `.env`.
4. `tenantActual()` no aprende a leer el `Host`; las cookies siguen sin `domain`.
5. `qRaw` solo sobre tablas exentas de RLS; lo que lee `config_negocio` usa
   `qConTenant`.
6. La RLS no se retira.
7. `aislamiento.e2e.test.ts` pasa **sin modificarlo**. Ninguna tarea de este plan lo
   abre.
8. Migraciones transaccionales, idempotentes, `expand → contract`. No se toca
   `db/schema.sql` directo.
9. **El autoregistro está CERRADO en toda la flota, DEMO incluida** (P8,
   2026-08-20). Solo `AUTOREGISTRO=1` enciende; ausente o cualquier otro valor deja
   cerrado (`lib/entorno.ts:23-26`, F2.6), y las plantillas nacen en `0`
   (`infra/env/app.env.example:80`) — anclado por prueba, no por memoria
   (`entorno.test.ts:143,197`). Una empresa nace por `/api/bootstrap`, **una sola vez
   por instancia**, y su Dueño da de alta a su equipo desde dentro
   (`/api/usuarios`, permiso `administracion:crear`). *(Hasta el 2026-09-03 decía
   «Autoregistro encendido solo en DEMO». Quedó desfasado el 20/08 —P8— y estuvo
   veinte días afirmando lo contrario de lo decidido, en un invariante que se lee
   ANTES de tocar altas. La fila T0 de §3 conserva la redacción del 13/08 como
   historia de aquella verificación.)*
10. Commits en español, `tipo(ámbito): descripción` en minúscula (estilo real del
    repo: `fix(contrato): el domicilio del arrendador no tenia donde teclearse`).
11. Al terminar cada tanda: entrada en `docs/Registro_Cambios.md` y revisión de
    `vault/`. Las correcciones de datos en producción van a `docs/datos/` con su
    rollback capturado **antes** (`docs/datos/README.md`).
12. Dos suites: `npm test` (unitarias, `apps/web/vitest.config.ts`) y
    `npm run test:e2e` (integración contra Postgres real,
    `apps/web/vitest.e2e.config.ts`).
13. **Ninguna tarea corre en la instancia de un owner sin haber pasado antes por
    DEMO.**
14. **Una instancia no le pregunta nada al padre para poder arrancar.** La
    configuración común —plantillas de correo, catálogos, textos— viaja **dentro de
    la imagen**; lo que cambia por owner vive en su base y su `.env`. Si un paso
    hiciera que la instancia consulte al padre para levantar, convierte al padre en
    una dependencia de arranque y rompe la promesa del modelo: una instancia tiene
    que seguir funcionando aunque el padre no exista.

---

# Paso 3 · Las fases, convertidas en tareas

## FASE 0 · Cerrar el autoregistro fuera de DEMO — *bloqueador*

**Entorno:** la instancia actual (droplet que hoy sirve `demo.space-os.io` **y** los
tenants reales) + PADRE. **Ejecuta:** Carlos.

---

### F0.1 · Averiguar si el autoregistro está abierto hoy `[verificación]`

- **Objetivo:** saber, con evidencia y no por memoria, si un desconocido puede crear
  hoy una organización en el droplet de producción.
- **Fase:** 0. **Depende de:** nada. **Bloqueante de:** F0.2 y de toda la Fase 4.
- **Archivos:** ninguno.
- **Prueba que falla primero:** no aplica (verificación). El repo ya explica por qué
  no se puede probar en la suite (`aislamiento.e2e.test.ts:200-213`: la bandera se
  hornea en el build).
- **Pasos:**
  1. Desde cualquier máquina con red, sin tocar el servidor:
     ```bash
     curl -s -w '\nHTTP %{http_code}\n' -X POST \
       https://demo.space-os.io/spaces-dooh/api/signup/ \
       -H 'Content-Type: application/json' -d '{}'
     ```
     Con cuerpo vacío no se crea nada: zod revienta antes de tocar la base.
  2. Confirmar la causa en el servidor (solo lectura):
     ```bash
     ssh root@209.97.146.136 "grep -rs AUTOREGISTRO /var/www/Spaces/.env /var/www/Spaces/apps/web/.env*; echo '[fin]'"
     ```
  3. Anotar el resultado con fecha en `docs/Registro_Cambios.md` (commit en el PADRE,
     sin tocar el servidor).
- **Criterio de aceptación:** hay una respuesta escrita, con fecha, a «¿está
  abierto?». **HTTP 503 = apagado** (sigue a F0.3). **HTTP 400 = abierto** (ejecuta
  F0.2 hoy mismo). Cualquier otro código (000, 429, 5xx) = **no concluyente**: no se
  sigue hasta saber por qué.
- **Comando de verificación:** el `curl` del paso 1.
- **Commit sugerido:** `docs(deploy): el estado real del autoregistro en el droplet, con fecha`
- **Riesgo y vuelta atrás:** ninguno, es lectura.

---

### F0.2 · Apagarlo y **recompilar** (solo si F0.1 dio 400) `[infra]`

- **Objetivo:** que `/api/signup` conteste 503 en el droplet actual.
- **Fase:** 0. **Depende de:** F0.1.
- **Archivos:** ninguno del repo. Se toca `/var/www/Spaces/apps/web/.env` en el
  servidor.
- **Prueba que falla primero:** no aplica. Smoke: el `curl` de F0.1 devuelve 400 antes
  y 503 después.
- **Pasos:**
  1. Respaldo del `.env` **antes** de tocarlo:
     ```bash
     ssh root@209.97.146.136 "cp /var/www/Spaces/apps/web/.env /root/env.web.bak.$(date +%F_%H%M%S) && ls -l /root/env.web.bak.*"
     ```
  2. Fijar la bandera (reiniciar pm2 no basta: `NEXT_PUBLIC_*` se hornea en el build):
     ```bash
     ssh root@209.97.146.136 "cd /var/www/Spaces && \
       (grep -q '^NEXT_PUBLIC_AUTOREGISTRO=' apps/web/.env \
         && sed -i 's/^NEXT_PUBLIC_AUTOREGISTRO=.*/NEXT_PUBLIC_AUTOREGISTRO=0/' apps/web/.env \
         || echo 'NEXT_PUBLIC_AUTOREGISTRO=0' >> apps/web/.env)"
     ```
  3. Compilar y recargar **como el usuario dueño de la app**, no como root (defectos 3
     y 4 documentados en `.github/workflows/deploy.yml:21-31`: pm2 es por usuario y su
     demonio vive en `/home/emiliano/.pm2`):
     ```bash
     ssh root@209.97.146.136 "su - emiliano -c 'cd /var/www/Spaces && npm --prefix apps/web run build && pm2 reload spaces-web'"
     ```
  4. Repetir el `curl` de F0.1.
- **Criterio de aceptación:** **el alta anónima falla**: `POST /api/signup/` devuelve
  **503**, y el botón «Crear cuenta» desaparece del login (lo decide el mismo build,
  `login/page.tsx:30`). Ninguna sesión existente se cae.
- **Comando de verificación:**
  ```bash
  curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
  curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
  ```
  Esperado: `503` y `200`.
- **Commit sugerido:** `docs(deploy): el autoregistro cerrado en el droplet, con el respaldo del env`
  (el cambio es de entorno; el commit solo registra la bitácora).
- **Riesgo y vuelta atrás:** el build puede fallar y dejar `.next` a medias. Durante el
  build, pm2 sigue sirviendo el bundle viejo, así que la ventana de caída es solo el
  `reload`. Vuelta atrás: restaurar `/root/env.web.bak.*`, recompilar y recargar.

---

### F0.3 · La regla «solo DEMO» deja de depender de la memoria `[código]`

- **Objetivo:** que la plantilla de entorno del repo nazca con el autoregistro apagado
  y que una prueba impida volver atrás.
- **Fase:** 0. **Depende de:** F0.1.
- **Archivos:** `.env.example` (líneas 17-23 y línea 4);
  `apps/web/lib/entorno.test.ts` (nuevo).
- **Prueba que falla primero:** `apps/web/lib/entorno.test.ts` lee `.env.example` desde
  la raíz del repo y afirma `NEXT_PUBLIC_AUTOREGISTRO=0`. **Falla hoy** porque
  `.env.example:23` dice `=1`.
- **Pasos:**
  1. Crear `apps/web/lib/entorno.test.ts` con dos casos:
     - «la plantilla de entorno nace con el autoregistro apagado» → busca
       `/^NEXT_PUBLIC_AUTOREGISTRO=0$/m` en `.env.example`;
     - «la plantilla no propone un dominio de cookie» → afirma que `.env.example` no
       contiene una línea `COOKIE_DOMAIN=` con valor (invariante 4; hoy
       `.env.example:4` trae `COOKIE_DOMAIN=localhost`, que además **ningún archivo de
       `apps/` lee**).
  2. Correr `npm test` y ver los dos casos en rojo.
  3. En `.env.example`, cambiar `NEXT_PUBLIC_AUTOREGISTRO=1` → `=0` y sustituir el
     comentario de arriba —que hoy describe el mundo viejo: «la demo pública y
     producción son el MISMO deploy sobre la misma base»— por la regla nueva: *apagado
     en toda instancia de owner; encendido ÚNICAMENTE en DEMO; se hornea en el build,
     así que cambiarlo exige recompilar.*
  4. Borrar la línea `COOKIE_DOMAIN=localhost` con un comentario de una línea que
     explique que las cookies son host-only a propósito (`auth.ts:191-201`, `:216-226`).
  5. `npm test` en verde.
- **Criterio de aceptación:** un clon limpio del repo **no puede** producir un build
  con autoregistro abierto por descuido; si alguien lo reactiva en la plantilla,
  `npm test` se pone rojo en CI (`ci.yml:74-75`).
- **Comando de verificación:** `cd apps/web && npx vitest run lib/entorno.test.ts && npm test`
- **Commit sugerido:** `fix(seguridad): la plantilla de entorno nace con el autoregistro cerrado, y una prueba lo sostiene`
- **Riesgo y vuelta atrás:** bajo. Efecto colateral: quien levante el proyecto en local
  copiando `.env.example` ya no verá «Crear cuenta»; queda dicho en el comentario.
  Vuelta atrás: `git revert`.

---

## FASE 1 · Migración de limpieza — los 23 `DEFAULT` de `tenant_id`

**Entorno:** PADRE (código y migración) + droplet actual (auditoría y aplicación).
**Ejecuta:** Carlos.

> **Urgencia real:** toda instancia nueva nace de estas migraciones. El esquema tiene
> que estar limpio **antes** de clonar la primera base.

---

### F1.1 · Auditoría: qué filas están mal etiquetadas como `rgb` `[verificación]`

- **Objetivo:** tener el censo exacto de filas que el `DEFAULT` etiquetó como `rgb` sin
  serlo, **antes** de quitar el default y antes de clonar nada.
- **Fase:** 1. **Depende de:** nada. **Bloqueante de:** F1.5 y de la Fase 7.
- **Archivos:** ninguno del repo (el SQL se guarda en `docs/datos/` solo si termina en
  corrección).
- **Prueba que falla primero:** no aplica.
- **Pasos:** correr en el droplet, **como `postgres` y en solo lectura**.
  1. Cuántas tablas tienen realmente el default (producción puede tener más que las 23
     del repo: el esquema desplegado difiere, §1.2 punto 7):
     ```sql
     select c.relname as tabla, pg_get_expr(d.adbin, d.adrelid) as por_defecto
       from pg_attrdef d
       join pg_class c on c.oid = d.adrelid
       join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and a.attname = 'tenant_id'
      order by 1;
     ```
  2. El caso conocido (15 modalidades de `g500`/`eyro` marcadas como `rgb`): una fila
     hija etiquetada distinto de su padre es, por definición, una fila mal etiquetada.
     ```sql
     select sm.tenant_id as tenant_modalidad, s.tenant_id as tenant_sitio, count(*)
       from sitio_modalidades sm join sitios s on s.id = sm.sitio_id
      where sm.tenant_id is distinct from s.tenant_id
      group by 1,2;
     ```
  3. El mismo patrón, generalizado a los enganches padre→hijo:
     ```sql
     select 'predios' t, p.tenant_id, a.tenant_id, count(*) from predios p join arrendadores a on a.id=p.arrendador_id where p.tenant_id is distinct from a.tenant_id group by 1,2,3
     union all select 'reservas', r.tenant_id, c.tenant_id, count(*) from reservas r join campanas c on c.id=r.campana_id where r.tenant_id is distinct from c.tenant_id group by 1,2,3
     union all select 'propuesta_items', pi.tenant_id, pr.tenant_id, count(*) from propuesta_items pi join propuestas pr on pr.id=pi.propuesta_id where pi.tenant_id is distinct from pr.tenant_id group by 1,2,3
     union all select 'contratos_arrendamiento', ca.tenant_id, s.tenant_id, count(*) from contratos_arrendamiento ca join sitios s on s.id=ca.sitio_id where ca.tenant_id is distinct from s.tenant_id group by 1,2,3
     union all select 'cobranzas', cb.tenant_id, f.tenant_id, count(*) from cobranzas cb join facturas f on f.id=cb.factura_id where cb.tenant_id is distinct from f.tenant_id group by 1,2,3;
     ```
     > Si alguna columna de enganche se llama distinto en producción, la consulta
     > **falla en seco** con `ON_ERROR_STOP` (no da falsos ceros): corregir el nombre y
     > repetir. **Un error de sintaxis es una respuesta mejor que un cero inventado.**
     > Los nombres de esas columnas no se verificaron desde aquí: `[SIN VERIFICAR]`.
  4. Escribir el resultado —tabla por tabla, con conteos— en
     `docs/Registro_Cambios.md` y, si hay filas que reparar, un par
     `docs/datos/20260812_<asunto>.sql` + `_rollback.sql` siguiendo
     `docs/datos/README.md` (**por id explícito, nunca por patrón**, con el rollback
     capturado leyendo los valores previos reales y una pasada en seco antes de
     aplicar).
- **Criterio de aceptación:** existe un censo escrito. **No queda ninguna fila con
  tenant distinto del de su padre sin decisión tomada** (reparar, o documentar por qué
  se deja). Si hay filas sospechosas, **no se corrigen en esta fase**: se anotan y se
  llevan a la Fase 7, donde se decide el destino de cada tenant. Quitar el DEFAULT
  sigue adelante igual: detiene la hemorragia aunque no cure la herida.
- **Comando de verificación:**
  ```bash
  ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f /tmp/auditoria_tenant.sql"
  ```
- **Commit sugerido:** `docs(datos): censo de filas etiquetadas como rgb por el default de tenant_id`
- **Riesgo y vuelta atrás:** ninguno si se respeta el solo lectura.

---

### F1.2 · La migración que quita los `DEFAULT` `[migración]`

- **Objetivo:** que un `INSERT` sin `tenant_id` **truene** en vez de etiquetar la fila
  como `rgb` en silencio.
- **Fase:** 1. **Depende de:** F1.1 (para aplicar en producción; no para escribirla).
- **Archivos:** `db/migrations/20260812_sin_default_tenant.sql` (nuevo);
  `apps/web/lib/test/tenant-sin-default.e2e.test.ts` (nuevo).
- **Prueba que falla primero:** en el archivo nuevo (no se toca
  `aislamiento.e2e.test.ts`):
  - **caso negativo, el que importa:** `insert into clientes (nombre) values ('Sin dueño')`
    **sin** `tenant_id` debe **rechazarse** con `23502` (not null violation). Hoy pasa:
    la fila se crea y nace etiquetada como `rgb`.
  - **no regresión:** el mismo insert **con** `tenant_id` explícito sigue funcionando.
  - **catálogo:** `pg_attrdef` no devuelve ninguna columna `tenant_id` con default en
    `public`. Hoy devuelve 23.
  - **idempotencia:** aplicar el archivo dos veces seguidas no lanza.
- **Pasos:**
  1. Escribir la prueba y verla en rojo. `recrearEsquema()` aplica esquema + 66
     migraciones, así que la prueba mide el esquema real del repo.
  2. Escribir la migración con el estilo de
     `db/migrations/20260810_arrendadores_rfc_unico.sql`:
     ```sql
     -- ========================================================================
     --  El DEFAULT de tenant_id se retira: un insert sin tenant debe TRONAR.
     --  Ese default (db/schema.sql:615) es lo que ha etiquetado como RGB filas de
     --  otras organizaciones cuando alguien olvidaba fijar el tenant.
     --  `config_negocio` ya nació sin él a propósito (db/schema.sql:626+, ADR
     --  0011); esto extiende ese criterio a las 23 tablas del bucle.
     --
     --  Se recorre el CATÁLOGO y no una lista copiada a mano: producción tiene
     --  tablas que schema.sql no trae (db-e2e.ts:100-118 lo documenta), y una
     --  lista se queda vieja el día que alguien añada una tabla.
     --
     --  Compatibilidad: ninguna versión del código depende del default —todos los
     --  repos pasan tenant_id explícito—, así que una instancia rezagada sigue
     --  funcionando igual. Transaccional e idempotente.
     -- ========================================================================
     begin;

     -- 1) Guard: no se quita el default donde sea lo único que sostiene la
     --    columna. Si aparece una así, aborta nombrándola.
     do $$
     declare faltan text;
     begin
       select string_agg(c.relname, ', ') into faltan
         from pg_attrdef d
         join pg_class c on c.oid = d.adrelid
         join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname='public' and a.attname='tenant_id' and a.attnotnull = false;
       if faltan is not null then
         raise exception 'Estas tablas tienen tenant_id con DEFAULT y SIN NOT NULL: %. Ponles NOT NULL antes.', faltan;
       end if;
     end $$;

     -- 2) Quitar el default de todas las que lo tengan.
     do $$
     declare t text;
     begin
       for t in
         select c.relname from pg_attrdef d
           join pg_class c on c.oid=d.adrelid
           join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
           join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and a.attname='tenant_id'
       loop
         execute format('alter table %I alter column tenant_id drop default', t);
       end loop;
     end $$;

     -- 3) ASSERT: no queda ni uno.
     do $$
     begin
       if exists (select 1 from pg_attrdef d
                    join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
                    join pg_class c on c.oid=d.adrelid
                    join pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and a.attname='tenant_id')
       then raise exception 'Quedaron columnas tenant_id con DEFAULT'; end if;
     end $$;

     commit;

     -- Verificación (debe devolver 0 filas):
     --   select c.relname from pg_attrdef d join pg_class c on c.oid=d.adrelid
     --     join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
     --    where a.attname='tenant_id';
     --
     -- ROLLBACK de emergencia (REINTRODUCE LA DERIVA — pensarlo dos veces):
     --   do $$ declare t text; def uuid; begin
     --     select id into def from tenants where slug='rgb';
     --     foreach t in array array['usuarios','sitios', ...] loop
     --       execute format('alter table %I alter column tenant_id set default %L', t, def);
     --     end loop; end $$;
     ```
  3. Correr la prueba en verde.
  4. **No tocar `db/schema.sql`.** El bloque `:600-624` se queda: el esquema base sigue
     creando el default y la migración lo retira — que es exactamente cómo se comporta
     cualquier instalación nueva (`db-e2e.ts:120-170`).
  5. **No** aplicarla a mano en producción aquí: eso es F1.5.
- **Criterio de aceptación:** **el insert descuidado falla**; ninguna fila nueva puede
  nacer atribuida a `rgb` por omisión; `npm run test:e2e` completo en verde **incluido
  `aislamiento.e2e.test.ts` sin editarlo**; correrla dos veces seguidas no lanza.
- **Comando de verificación:**
  ```bash
  cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/tenant-sin-default.e2e.test.ts && npm run test:e2e
  ```
- **Commit sugerido:** `fix(multi-tenant): un insert sin organizacion truena en vez de etiquetarse como rgb`
- **Riesgo y vuelta atrás:** el riesgo real no es la migración: es lo que descubre.
  Cualquier ruta que hoy inserte sin fijar tenant dejará de funcionar, y hasta ahora
  fallaba en silencio etiquetando mal. Comprobado que **no hay ninguna**
  (`campanas-repo.ts:687-696`, `ot-repo.ts:158-165`, `semillas-e2e.ts:42-112`);
  repetir la comprobación antes de aplicar con:
  ```bash
  rg -n --multiline "insert\s+into\s+(usuarios|sitios|clientes|propuestas|propuesta_items|ordenes_compra|campanas|creatividades|reservas|ordenes_trabajo|evidencias_ot|ordenes_impresion|facturas|cobranzas|arrendadores|contratos_arrendamiento|pagos_renta|incidencias|notificaciones|acciones|sitio_modalidades|predios|arrendador_razon_social)\b" apps/web
  ```
  y confirmar que cada uno nombra `tenant_id`. Vuelta atrás: el rollback comentado.
  **`expand → contract`:** es un `contract`, y es seguro justamente porque ninguna
  versión del código depende del default.

---

### F1.3 · `campanas-repo.ts:300` gana la segunda capa `[código]`

- **Objetivo:** que el cupo global de clientes no dependa **solo** de la RLS.
- **Fase:** 1. **Depende de:** nada.
- **Archivos:** `apps/web/lib/server/campanas-repo.ts:299-303` y `:417`;
  `apps/web/lib/server/campanas-repo.cupo-clientes.test.ts:22-26,92-104`.
- **Estado verificado hoy:** `cupoGlobalClientes(client)` corre dentro de una
  transacción en la que el llamador (`:417`) ya fijó el tenant, así que **hoy lo salva
  la RLS**. Lo que falta es la segunda capa que el resto del repo aplica: el `limit 1`
  sin `where` es una bomba de relojería para el día que alguien llame a esa función
  desde otra transacción.
- **Prueba que falla primero:** en el `describe('cupoGlobalClientes')` que ya existe,
  ampliar el `fakeClient` de `:22-26` para que registre `(text, params)` y añadir el
  caso *«la consulta filtra por tenant de forma explícita»*. **Falla hoy**: el SQL de
  `:300` no tiene `where`.
- **Pasos:**
  1. Ampliar `fakeClient` y añadir el caso nuevo. Verlo en rojo.
  2. Cambiar el SQL **sin cambiar la firma** —las tres unitarias de `:92-104` la llaman
     con un cliente falso y cambiarla obligaría a tocar pruebas que no tienen nada que
     ver:
     ```ts
     const v = (await client.query(
       `select max_clientes_pantalla from config_negocio
         where tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
         limit 1`,
     )).rows[0]?.max_clientes_pantalla
     ```
  3. Dos líneas de comentario: el filtro explícito es la segunda capa; la primera (RLS)
     sigue ahí.
  4. `npm test` y `npm run test:e2e` en verde.
- **Criterio de aceptación:** con el GUC de una organización, la consulta **no puede**
  devolver la fila de otra ni aunque la RLS se desactivara; si no hay GUC devuelve
  `null` = «sin límite», que es como nace la instalación según el ADR 0008
  (`campanas-repo.ts:301-303`).
- **Comando de verificación:**
  `cd apps/web && npx vitest run lib/server/campanas-repo.cupo-clientes.test.ts && npm run test:e2e`
- **Commit sugerido:** `fix(campanas): el cupo global se lee con el filtro de organizacion, no solo con la RLS`
- **Riesgo y vuelta atrás:** bajo; un solo llamador. Vuelta atrás: `git revert`.

---

### F1.4 · Una IP deja de parecer un subdominio `[código]`

- **Objetivo:** cerrar el bug que el documento manda corregir «aunque el parser nuevo
  no se construya».
- **Fase:** 1. **Depende de:** nada.
- **Archivos:** `apps/web/middleware.ts:14-21` y `:80-89`; `apps/web/lib/host.ts`
  (nuevo); `apps/web/lib/host.test.ts` (nuevo).
- **Prueba que falla primero:** unitarias sobre la función pura extraída:
  `209.97.146.136` → `null`; `127.0.0.1:3000` → `null`;
  `portal.space-os.pixeled.com.mx` → `'portal'`; `space-os.io` → `null`;
  `localhost:3000` → `null`. **El primer caso falla hoy**: `parts.length >= 3` devuelve
  `'209'`.
- **Pasos:**
  1. Crear `apps/web/lib/host.ts` con `etiquetaDeHost(host: string): string | null`
     —módulo **puro**, sin `server-only`, mismo patrón que `lib/validacion.ts`— que
     descarta IPv4/IPv6 literales y primeros segmentos numéricos.
     > **Alcance deliberado:** esto **no** resuelve marcas ni tenants ni mete el `Host`
     > en la cadena de datos. Solo decide si el rewrite a `/portal`
     > (`middleware.ts:80-89`, `moduleMap` `:10-12`) debe dispararse. Sigue siendo la
     > única función del sistema que mira el host, y no concede nada.
  2. Escribir `host.test.ts`; verlo en rojo.
  3. Sustituir `extractSubdomain` en `middleware.ts` por la función nueva. Borrar la
     vieja.
  4. `npm test` en verde.
- **Criterio de aceptación:** **entrar por la IP desnuda ya no reescribe la ruta al
  portal**; el rewrite de `portal` sigue igual; ninguna ruta cambia de comportamiento
  para `demo.space-os.io`.
- **Comando de verificación:**
  `cd apps/web && npx vitest run lib/host.test.ts && npm test && npm run test:e2e`
- **Commit sugerido:** `fix(rutas): una direccion IP dejaba de ser IP y parecia subdominio`
- **Riesgo y vuelta atrás:** el middleware toca **todas** las peticiones. La prueba de
  que no rompió nada es `npm run test:e2e` completo (el arnés entra por HTTP y pasa por
  el middleware). Vuelta atrás: `git revert`.

---

### F1.5 · Aplicar la limpieza al droplet actual `[verificación]`

- **Objetivo:** que la base de la que van a salir las instancias esté limpia.
- **Fase:** 1. **Depende de:** F1.1, F1.2. **Bloqueante de:** F4.2 y F5.6.
- **Archivos:** ninguno.
- **Prueba que falla primero:** no aplica; el gate es la auditoría F1.1.
- **Pasos:**
  1. **Respaldo primero, y comprobar que no está vacío** (patrón ya probado en
     `deploy.yml:117-125`, que existe porque un dump fallido se ve casi igual que uno
     bueno):
     ```bash
     ssh root@209.97.146.136 "BK=/root/spaces_$(date +%Y%m%d_%H%M%S).dump; sudo -u postgres pg_dump -d spaces_prod -Fc -f \$BK; [ -s \$BK ] && ls -lh \$BK || echo 'BACKUP VACIO — ABORTAR'"
     ```
  2. Ensayo en seco: aplicar la migración con `commit` cambiado por `rollback` y
     comprobar que el ASSERT pasa.
  3. Aplicar de verdad, **como `postgres`**:
     ```bash
     ssh root@209.97.146.136 "cd /var/www/Spaces && sudo -u postgres psql -d spaces_prod -v ON_ERROR_STOP=1 -f db/migrations/20260812_sin_default_tenant.sql"
     ```
  4. Verificar por catálogo que no queda ningún default.
- **Criterio de aceptación:** la consulta de `pg_attrdef` devuelve **0 filas**; la app
  sigue operando (login 200 y `/api/estado` autenticado 200).
- **Comando de verificación:**
  ```bash
  ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -Atc \"select count(*) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where a.attname='tenant_id'\""
  curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
  ```
  Esperado: `0` y `200`.
- **Commit sugerido:** `docs(deploy): la migracion sin_default_tenant aplicada en produccion, con respaldo previo`
- **Riesgo y vuelta atrás:** si algún proceso externo insertaba sin `tenant_id`,
  empezará a fallar en voz alta — que es el objetivo, pero conviene mirar los logs una
  hora. Vuelta atrás: el rollback comentado; el respaldo solo si algo peor ocurre.

---

## FASE 2 · Release versionado (el artefacto)

**Entorno:** PADRE. **Ejecuta:** Emiliano.
**Parcialmente bloqueada** por §8.4 (nombre del registry): todo se escribe con el
registry como **parámetro** (`vars.REGISTRY`), así que las tareas se hacen hoy; lo
único que espera es el valor.

---

### F2.1 · El build produce un artefacto autocontenido `[código]`

- **Objetivo:** que `npm run build` deje un servidor que arranca sin el `node_modules`
  del monorepo.
- **Fase:** 2. **Depende de:** nada. **Bloqueante de:** F2.2.
- **Archivos:** `apps/web/next.config.mjs`.
- **Prueba que falla primero:** no hay prueba unitaria razonable de un artefacto de
  build. El gate es el comando de verificación, que **falla hoy**:
  `apps/web/.next/standalone` no existe (verificado: `next.config.mjs` no declara
  `output`).
- **Pasos:**
  1. Añadir `output: 'standalone'` y
     `experimental: { outputFileTracingRoot: path.join(__dirname, '../../') }`. Es un
     monorepo con workspaces (`package.json` raíz: `apps/*`, `packages/*`): sin la
     raíz, el trazado deja fuera paquetes hoisted.
  2. `npm --prefix apps/web run build` y comprobar
     `apps/web/.next/standalone/apps/web/server.js`.
  3. Comprobar que `npm start` (`next start -p 3000`, `apps/web/package.json:8`)
     **sigue funcionando**: `ecosystem.config.js` lo usa hoy y no debe romperse
     mientras el droplet actual siga vivo.
- **Criterio de aceptación:** existen **las dos** formas de arrancar (la de hoy y la
  standalone) y ninguna prueba cambia de resultado.
- **Comando de verificación:**
  ```bash
  cd apps/web && npm run build && ls .next/standalone/apps/web/server.js && npm test && npm run test:e2e
  ```
- **Commit sugerido:** `feat(build): el build produce un servidor autocontenido para la imagen`
- **Riesgo y vuelta atrás:** el trazado puede olvidar assets (`public/`, fuentes). Se
  detecta en F2.5 (el login tiene que verse con estilos). Vuelta atrás: quitar `output`
  del config.

---

### F2.2 · `Dockerfile` de `apps/web` `[infra]`

- **Objetivo:** una imagen que corre la app y **lleva dentro** el esquema y las
  migraciones.
- **Fase:** 2. **Depende de:** F2.1.
- **Archivos:** `Dockerfile` (raíz, nuevo), `.dockerignore` (raíz, nuevo).
- **Prueba que falla primero:** no aplica. Smoke en F2.5.
- **Hechos del repo que la imagen respeta (verificados):** contexto de build en la
  **raíz** (monorepo con turbo); `basePath: '/spaces-dooh'` y `trailingSlash: true`
  (`next.config.mjs:8-9`); Node **20** (`ci.yml:60`); **sin volumen**: el proceso no
  escribe en disco (`ecosystem.config.js` solo declara logs).
- **Pasos:**
  1. `.dockerignore`: `node_modules`, `.next`, `.git`, `_archive`, `docs`, `vault`,
     `manuales`, `*.pdf`, `*.xlsx`, `.claude`, `**/.env*`.
     > **`**/.env*` no es opcional:** el `.env` de un owner nunca puede quedar horneado
     > en una imagen que corren todos.
  2. `Dockerfile` multi-stage sobre `node:20-alpine`:
     - *deps*: `npm ci` con el lockfile (nunca `npm install`, por el motivo que
       `ci.yml:63-68` documenta);
     - *build*: `npx turbo run build --filter=web`;
     - *runtime*: copia `.next/standalone`, `.next/static`, `public`, **y
       `db/schema.sql` + `db/migrations/`** a `/app/db` (el runner de la Fase 3 las lee
       de ahí — es lo que permite que nadie tenga que clonar el repo en el servidor de
       una instancia, invariante 1); `USER node`; `EXPOSE 3000`;
       `CMD ["node","apps/web/server.js"]`.
  3. Sellar la versión: `ARG VERSION` → `ENV SPACE_OS_VERSION=$VERSION` (lo consume
     `/api/version`, F6.1).
- **Criterio de aceptación:** la imagen levanta contra una base vacía; **no contiene
  ningún `.env`** ni credenciales.
- **Comando de verificación:**
  ```bash
  docker build --build-arg VERSION=v0.0.0-dev -t space-os:dev .
  docker run --rm space-os:dev sh -c 'ls /app/db/migrations | wc -l'   # esperado: 66 o más
  docker run --rm space-os:dev sh -c 'ls -a /app /app/apps/web' | grep -i '\.env' && echo 'FALLO: hay un .env dentro' || echo 'ok: sin .env'
  ```
- **Commit sugerido:** `feat(release): la imagen de space-os, con su esquema y sus migraciones dentro`
- **Riesgo y vuelta atrás:** ninguno sobre lo desplegado (nadie usa la imagen todavía).
  Si el build falla dentro del contenedor por algo del monorepo —modo de fallo real,
  `ci.yml:11-15` cuenta que una rama no compilaba en un clon limpio— se arregla en el
  Dockerfile, no en el código. Vuelta atrás: borrar los dos archivos.

---

### F2.3 · Workflow de release: tag → suite completa → canal `beta` `[release]`

- **Objetivo:** que taggear `vX.Y.Z` publique una imagen probada como `beta`, y que un
  tag con la suite en rojo **no** publique nada.
- **Fase:** 2. **Depende de:** F2.2. **Bloqueada parcialmente por §8.4.**
- **Archivos:** `.github/workflows/release.yml` (nuevo).
- **Prueba que falla primero:** no aplica. El gate es que el workflow **corra la suite
  completa** antes de publicar.
- **Lo que hay hoy y lo que falta (verificado):** `ci.yml:74-75` corre
  `turbo run test --filter=web` = **solo unitarias**. Las e2e no corren en CI. El arnés
  ya está preparado: `apps/web/lib/test/db-e2e.ts:30-32` toma `DATABASE_URL_TEST` («en
  CI, al Postgres del runner») y exige que el nombre de la base diga que es de pruebas
  (`_e2e`/`_test`).
- **Pasos:**
  1. `on: push: tags: ['v*.*.*']`, `permissions: contents: read, packages: write`,
     `concurrency: release-${{ github.ref }}` sin cancelación.
  2. Job `pruebas`: `services: postgres:16`, crear `spaces_e2e`, `npm ci`,
     `npx turbo run typecheck --filter=web`, `npx turbo run test --filter=web`, y
     `DATABASE_URL_TEST=… npm --prefix apps/web run test:e2e`.
     > `ci.yml` **no se toca**: sigue cubriendo los PR. `release.yml` es su hermano para
     > tags, con el añadido de las e2e y la publicación.
  3. Job `imagen` (`needs: pruebas`): build con
     `--build-arg VERSION=${GITHUB_REF_NAME}` y push con **dos** etiquetas:
     `${VERSION}` y `beta`. Destino desde `vars.REGISTRY`, **nunca** un literal.
  4. **No** publicar `estable` aquí: eso es F2.4.
  5. El login del registry va con `secrets.DO_REGISTRY_TOKEN` o con el `GITHUB_TOKEN`
     según `vars.REGISTRY_TIPO`, para no reescribir el workflow cuando se decida §8.4.
- **Criterio de aceptación:** **una suite en rojo impide publicar** (el push es el
  último paso y depende de los anteriores); `beta` siempre corresponde a un tag que
  pasó las dos suites.
- **Comando de verificación:**
  ```bash
  git tag v0.0.1-rc1 && git push emiliano v0.0.1-rc1
  gh run list --workflow=release.yml --limit 3
  gh run view <id> --log | grep -E "test:e2e|beta"
  ```
  Respuestas: **verde + imagen publicada** = listo; **verde sin imagen** = falta permiso
  de escritura en el registry; **rojo en e2e** = el servicio de Postgres no quedó bien
  configurado (revisar `DATABASE_URL_TEST`).
- **Commit sugerido:** `feat(release): un tag construye, prueba entera y publica la imagen en el canal beta`
- **Riesgo y vuelta atrás:** publicar una imagen mala. Mitigación: `beta` solo lo
  consume DEMO. Vuelta atrás: mover `beta` a la imagen anterior y borrar el tag.

---

### F2.4 · Promoción manual a `estable` `[release]`

- **Objetivo:** que ninguna instancia de owner reciba nada que no se haya validado en
  DEMO.
- **Fase:** 2. **Depende de:** F2.3. **Bloqueada parcialmente por §8.4.**
- **Archivos:** `.github/workflows/promover.yml` (nuevo).
- **Prueba que falla primero:** no aplica.
- **Pasos:**
  1. `on: workflow_dispatch` con entrada `version`, validada contra
     `^v[0-9]+\.[0-9]+\.[0-9]+$` **antes** de usarse y pasada como variable de entorno,
     nunca interpolada en el texto del script: `deploy.yml:70-102` documenta exactamente
     esta trampa.
  2. Comprobar que esa versión existe y que hoy es la que lleva `beta`.
  3. **Reetiquetar sin reconstruir.** Reconstruir produciría un binario distinto del
     validado, que es justo lo que el invariante 3 prohíbe.
  4. Dejar en el resumen del run: versión, quién y cuándo, y el resultado del smoke en
     DEMO.
- **Criterio de aceptación:** `estable` **nunca** apunta a una imagen que no estuvo
  antes en `beta`; promover **no** cambia el digest.
- **Comando de verificación:**
  ```bash
  gh workflow run promover.yml -f version=v0.1.0 && gh run watch
  docker buildx imagetools inspect "$REGISTRY/space-os:estable" | head -5
  docker buildx imagetools inspect "$REGISTRY/space-os:v0.1.0"  | head -5   # mismo digest
  ```
- **Commit sugerido:** `feat(release): promover a estable reetiqueta la imagen validada, no la reconstruye`
- **Riesgo y vuelta atrás:** promover por error manda a toda la flota a jalarla. Vuelta
  atrás: reetiquetar `estable` a la anterior — y aun así cada instancia necesita su
  rollback local (F3.4), porque las que ya jalaron no vuelven solas.

---

### F2.5 · Smoke de la imagen `[verificación]`

- **Objetivo:** comprobar que la imagen sirve la aplicación de verdad.
- **Fase:** 2. **Depende de:** F2.2.
- **Pasos:**
  1. Postgres local: `cd db && docker compose up -d` (expone **5433**).
  2. Base vacía + aplicar `schema.sql` y migraciones **desde dentro de la imagen**
     (prueba de que van incluidas).
  3. Correr el contenedor con `DATABASE_URL`, `APP_URL=http://localhost:3000`,
     `COOKIE_SECURE=0`, `NEXT_PUBLIC_AUTOREGISTRO=0`.
- **Criterio de aceptación:** `GET /spaces-dooh/login/` → **200** con estilos;
  `GET /spaces-dooh/api/auth/metodos/` → **200**; `POST /spaces-dooh/api/signup/` →
  **503** (el autoregistro viene apagado horneado, invariante 9);
  `GET /spaces-dooh/api/estado/` sin sesión → **401**.
- **Comando de verificación:**
  ```bash
  curl -s -o /dev/null -w 'login %{http_code}\n'   http://localhost:3000/spaces-dooh/login/
  curl -s -o /dev/null -w 'metodos %{http_code}\n' http://localhost:3000/spaces-dooh/api/auth/metodos/
  curl -s -o /dev/null -w 'signup %{http_code}\n' -X POST http://localhost:3000/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
  curl -s -o /dev/null -w 'estado %{http_code}\n'  http://localhost:3000/spaces-dooh/api/estado/
  ```
  Esperado: `200`, `200`, `503`, `401`. Un `500` en login casi siempre es
  `DATABASE_URL`; un login sin estilos es trazado de ficheros (volver a F2.1).
- **Commit sugerido:** `docs(release): smoke de la imagen, con las cuatro respuestas esperadas`
- **Riesgo y vuelta atrás:** ninguno (local).

---

### F2.6 · La bandera del autoregistro sale del build `[código]` — **condicionada a P4-bis**

- **Objetivo:** que `AUTOREGISTRO` se decida en el `.env` al arrancar y no al
  compilar, para que **una sola imagen** sirva a DEMO y a los owners.
- **Fase:** 2. **Depende de:** F2.1. **Condicionada a:** que Jochelo elija la salida
  (b) de **P4-bis**. Si elige la (a) —dos imágenes por versión—, esta tarea no se
  hace y F2.3 publica dos artefactos.
- **Archivos:** `apps/web/lib/entorno.ts`; `apps/web/lib/entorno.test.ts`;
  `apps/web/app/api/signup/route.ts:18`; `apps/web/app/(app)/login/page.tsx:30`;
  `apps/web/lib/server/google-oauth.ts:90`; `.env.example:23`;
  `.env.production.example`.
- **Precedente en el repo:** `GOOGLE_OAUTH` ya hace exactamente esto —se decide en
  el servidor, no en el build— por decisión 5 de la ADR 0012 (`.env.example:38-46`).
  Esta tarea le aplica el mismo tratamiento al autoregistro.
- **Prueba que falla primero:** dos casos en `entorno.test.ts`, uno negativo.
  - `autoregistroActivo()` devuelve `true` con `AUTOREGISTRO=1` y `false` con `=0`,
    **cambiando la variable entre llamadas** (hoy imposible: el valor está horneado);
  - **sin la variable definida → `false`.** El valor por defecto es *apagado*: una
    instancia cuyo `.env` se quedó corto no abre el registro por descuido.
- **Pasos:**
  1. Escribir las dos pruebas; verlas en rojo.
  2. `autoregistroActivo()` en `lib/entorno.ts`, leyendo `AUTOREGISTRO` **sin** el
     prefijo `NEXT_PUBLIC_`, con el patrón de `GOOGLE_OAUTH`.
  3. Sustituir los tres usos de producto. El de `login/page.tsx` necesita que el
     valor llegue del servidor: o por props desde el layout, o por la ruta pública
     `api/auth/metodos` que ya existe y ya se consulta ahí. **`[SIN VERIFICAR]` cuál
     de los dos aplica**: abrir el archivo antes de elegir.
  4. Renombrar la variable en `.env.example` y `.env.production.example`, con
     comentario de una línea explicando que ya no se hornea.
  5. Verde.
- **Criterio de aceptación:** la **misma imagen**, arrancada con `AUTOREGISTRO=0`,
  contesta **503** en `/api/signup`; arrancada con `=1`, contesta 400 con cuerpo
  vacío — **sin recompilar**. Sin la variable, 503. Y
  `apps/web/lib/test/aislamiento.e2e.test.ts` **pasa sin tocarlo**: si esta tarea lo
  rompe, se detiene y se consulta (invariante 7). Su bloque `:200-213` documenta la
  imposibilidad de probar la bandera; cuando esta tarea la elimine, ese bloque queda
  obsoleto y se retira **en un release posterior** (expand → contract), no aquí.
- **Comando de verificación:**
  ```bash
  docker run --rm -e AUTOREGISTRO=0 -p 3000:3000 $REGISTRY/space-os:beta &
  curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/spaces-dooh/api/signup/ -d '{}'   # 503
  docker rm -f $!; docker run --rm -e AUTOREGISTRO=1 -p 3000:3000 $REGISTRY/space-os:beta &
  curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/spaces-dooh/api/signup/ -d '{}'   # 400
  ```
- **Commit sugerido:** `feat(entorno): el autoregistro se decide al arrancar, no al compilar`
- **Riesgo y vuelta atrás:** cambia el comportamiento de una bandera de seguridad; el
  fail-closed del paso 2 es lo que evita que el cambio abra un registro por olvido.
  Vuelta atrás: `git revert` y recompilar con la bandera vieja — pero entonces vuelve
  la contradicción de P4-bis.

---

## FASE 3 · `update.sh` + runner de migraciones (el corazón)

**Entorno:** PADRE (se escribe) → DEMO (se ensaya). **Ejecuta:** Carlos + Emiliano.

---

### F3.1 · Tabla `schema_migrations` y su backfill `[migración]`

- **Objetivo:** que cada instancia sepa qué migraciones ya corrió.
- **Fase:** 3. **Depende de:** nada. **Bloqueante de:** F3.2.
- **Archivos:** `db/migrations/20260812_schema_migrations.sql` (nuevo);
  `apps/web/lib/test/migraciones.e2e.test.ts` (nuevo).
- **Verificado:** hoy no existe ninguna tabla de control. El despliegue actual reaplica
  **todas** las migraciones en cada corrida y confía en que sean idempotentes
  (`deploy.yml:141-148`). Funciona, pero no deja registro y hace imposible saber en qué
  versión de esquema está una instancia.
- **Prueba que falla primero:** «existe `schema_migrations` con
  `(archivo pk, checksum, aplicada_en, tipo)`». Hoy revienta con
  `relation "schema_migrations" does not exist`.
- **Pasos:**
  1. Escribir la prueba; verla en rojo.
  2. Migración transaccional e idempotente que crea la tabla y su ASSERT. **Exenta de
     RLS a propósito**: es infraestructura de la instancia, no dato de negocio — misma
     categoría que `folios_consecutivos`
     (`vault/02-Backend/infraestructura-servidor.md`).
  3. **Backfill:** insertar como aplicadas, con `on conflict do nothing`, todas las
     migraciones que ya existan en `db/migrations/` **cuando la base no esté vacía**
     (heurística explícita: existe `tenants` con filas), con `checksum='backfill'` y un
     comentario diciendo que las anteriores al 2026-08-12 no tienen checksum de origen.
     Sin esto, la primera corrida del runner en el droplet actual «aplicaría» sesenta y
     seis migraciones históricas: son idempotentes y no romperían, pero el registro
     nacería mintiendo.
- **Criterio de aceptación:** aplicar la migración dos veces no cambia el número de
  filas; **una base ya en producción no reejecuta su historia**; una base vacía queda
  con `schema_migrations` vacía y lista para aplicarlas todas.
- **Comando de verificación:**
  `cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/migraciones.e2e.test.ts`
- **Commit sugerido:** `feat(migraciones): cada instancia lleva registro de lo que ya aplico`
- **Riesgo y vuelta atrás:** el backfill mal hecho reejecuta migraciones. Son
  idempotentes por convención, pero no se apuesta: la prueba de F3.2 cubre el caso.
  Vuelta atrás: `drop table schema_migrations`.

---

### F3.2 · Runner idempotente, con el orden correcto `[código]`

- **Objetivo:** aplicar las migraciones pendientes, en orden, dentro de transacción, y
  registrarlas.
- **Fase:** 3. **Depende de:** F3.1.
- **Archivos:** `scripts/migrar.mjs` (nuevo); `scripts/migrar.test.ts` (nuevo, unitario
  sobre la parte pura); `apps/web/lib/test/migraciones.e2e.test.ts` (crece);
  `apps/web/lib/test/db-e2e.ts:145-155` (pasa a consumir la tabla de orden compartida).
- **Prueba que falla primero:** tres casos.
  - *unitario*: `ordenar(archivos)` respeta las dos excepciones reales del repo
    (`20260720_hard1_usuarios_rls.sql` **antes** de
    `20260720_hard1_rls_todas_tablas.sql`; `20260727_contrato_incompleto_enum.sql`
    **antes** de `20260727_contrato_incompleto.sql`). Falla hoy: la función no existe.
  - *e2e*: contra una base vacía, el runner deja las 66+ migraciones registradas y el
    esquema idéntico al de `recrearEsquema()`.
  - *e2e*: correrlo dos veces no aplica nada la segunda y devuelve 0.
- **Pasos:**
  1. Escribir las pruebas; verlas en rojo.
  2. `scripts/migrar.mjs`, con la misma resolución de `DATABASE_URL` que
     `scripts/apply-migration.mjs:17-26` (entorno → `.env` → default local), el mismo
     log de destino **sin credenciales** (`:29-37`) y la misma disciplina de fallar con
     código ≠0.
  3. La tabla `ANTES_DE` se declara **una sola vez** y se importa desde el runner;
     `db-e2e.ts` deja de tener su copia. Dos copias divergen, y el repo ya documenta esa
     lección (`cuentas-controller.ts:36-40`).
  4. Cada archivo en su propia transacción; al terminar, `insert into
     schema_migrations`. Si uno falla, aborta **sin** registrar y con un mensaje que
     nombra el archivo (igual que `db-e2e.ts:163-167`).
  5. Las migraciones marcadas `-- @tipo: datos` se **omiten** por defecto, como hace
     `deploy.yml:141-148`, y se listan como pendientes.
- **Criterio de aceptación:** una base vacía llega al esquema correcto; **una instancia
  rezagada no truena** (aplica solo lo que le falta); correrlo dos veces no hace nada la
  segunda.
- **Comando de verificación:**
  ```bash
  cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/migraciones.e2e.test.ts
  node scripts/migrar.mjs --pendientes    # lista sin aplicar
  ```
- **Commit sugerido:** `feat(migraciones): un runner que aplica lo pendiente, en el orden que de verdad funciona`
- **Riesgo y vuelta atrás:** el orden es la parte frágil; por eso la unitaria lo ancla.
  Vuelta atrás: el runner no borra nada; se puede seguir aplicando a mano con `psql`
  como hoy.

---

### F3.3 · Una migración alterada aborta el update `[código]`

- **Objetivo:** que nadie edite una migración ya aplicada y se entere tarde.
- **Fase:** 3. **Depende de:** F3.2.
- **Archivos:** `scripts/migrar.mjs`; `apps/web/lib/test/migraciones.e2e.test.ts`.
- **Prueba que falla primero:** «si el contenido de un archivo ya registrado cambia, el
  runner **aborta** y no aplica nada más». Falla hoy: no hay checksum.
- **Pasos:**
  1. Escribir el caso: aplicar, modificar el contenido en disco, volver a correr.
  2. Implementar `sha256` del contenido; si difiere del registrado, `exit 3` nombrando
     el archivo y los dos checksums. Las filas de `backfill` se saltan esta comprobación
     (no tienen checksum de origen).
  3. Añadir `--forzar-checksum`, documentado como escape para el día que haya que
     reescribir una migración a conciencia.
- **Criterio de aceptación:** **la instancia se niega a actualizarse** cuando su
  historia no coincide con la de la imagen; el mensaje dice qué archivo.
- **Comando de verificación:**
  `cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/migraciones.e2e.test.ts`
- **Commit sugerido:** `feat(migraciones): reescribir una migracion aplicada detiene la actualizacion`
- **Riesgo y vuelta atrás:** un cambio inocente de comentario aborta el update. Es el
  precio; el escape está en `--forzar-checksum`.

---

### F3.4 · `update.sh` — el pull de la instancia `[infra]`

- **Objetivo:** que una instancia se actualice sola, con respaldo y rollback, sin que
  nadie entre por SSH desde el padre.
- **Fase:** 3. **Depende de:** F3.2, F3.3, F2.4.
- **Archivos:** `infra/scripts/update.sh` (nuevo); `infra/scripts/README.md`.
- **Prueba que falla primero:** no aplica (bash contra Docker). El gate es F3.5.
- **Pasos (lo que el script hace, en este orden):**
  1. Lee su canal y su registry de `/etc/space-os/instancia.env`
     (`CANAL=estable|beta`).
  2. `docker pull $REGISTRY/space-os:$CANAL`; compara el **digest** con el que corre.
     Igual → sale 0 sin tocar nada.
  3. **Respaldo** con `pg_dump -Fc` y verificación de que el archivo **no está vacío**
     (`[ -s "$BK" ] || exit 1`), criterio copiado de `deploy.yml:117-125`.
  4. Guarda el digest actual en `/var/lib/space-os/version-anterior`.
  5. Levanta el contenedor nuevo, corre `node scripts/migrar.mjs` **dentro de la imagen
     nueva**, y solo entonces conmuta el tráfico.
  6. **Health check** con reintentos (10 × 3 s) contra
     `http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/`.
     > Se usa esa ruta y no `/api/version` porque `/api/version` **todavía no existe**
     > (llega en F6.1). `metodos` es pública, sin sesión y sin datos de negocio
     > (`app/api/auth/metodos/route.ts:29-37`). La URL vive en `SALUD_URL` para que
     > F6.1 la cambie en una línea.
  7. Si el health falla: vuelve al digest anterior, restaura el dump **solo si
     corrieron migraciones**, y sale ≠0 dejando el motivo en
     `/var/log/space-os/update.log`.
  8. `cron` diario a hora fija, con `flock` para que no haya dos updates a la vez (mismo
     criterio que `concurrency: deploy-produccion`, `deploy.yml:56-58`).
- **Criterio de aceptación:** **el padre no aparece por ningún lado**: el script solo
  habla con el registry y con su propia base. Un release malo deja la instancia en la
  versión anterior y **el owner no se entera**. Un respaldo vacío **detiene** el update.
- **Comando de verificación:** (en el droplet de la instancia, lo corre su operador)
  ```bash
  /opt/space-os/update.sh --dry-run
  tail -n 40 /var/log/space-os/update.log
  ```
  Respuestas: `sin cambios` = al día; `pull v0.4.2 → 3 migraciones pendientes` = hay
  actualización; cualquier mención a `BACKUP VACIO` = **no seguir**.
- **Commit sugerido:** `feat(instancias): update.sh jala el canal, respalda, migra y se devuelve solo si falla`
- **Riesgo y vuelta atrás:** es la pieza que puede tirar una instancia. Por eso se
  ensaya primero en DEMO (F3.5) y el `--dry-run` es obligatorio la primera vez en cada
  instancia. Vuelta atrás: el propio script; a mano, el digest guardado y el dump.

---

### F3.5 · Ensayo completo en DEMO `[verificación]`

- **Objetivo:** ver el ciclo entero —release → beta → update → rollback— en un servidor
  de verdad, antes de que exista una instancia de owner.
- **Fase:** 3. **Depende de:** F3.4 **y F4.5** (DEMO tiene que existir como instancia
  separada; ver **P5**).
- **Pasos:**
  1. Publicar una versión de prueba en `beta` (F2.3).
  2. En DEMO: `update.sh --dry-run`, luego `update.sh`.
  3. Publicar una versión **deliberadamente rota** en `beta` (por ejemplo con el health
     check apuntando a un puerto que no escucha) y volver a correr `update.sh`.
- **Criterio de aceptación:** en el caso bueno, DEMO queda en la versión nueva y
  `schema_migrations` crece. En el caso malo, **DEMO se queda en la versión anterior**,
  el sitio sigue sirviendo 200 y el log dice por qué. Ese segundo resultado es el que
  valida la fase: sin él, `update.sh` no está probado.
- **Comando de verificación:**
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/   # 200 en los dos casos
  ssh <demo> "docker ps --format '{{.Image}}'; tail -n 20 /var/log/space-os/update.log"
  ```
- **Commit sugerido:** `docs(release): el ensayo de update en DEMO, incluido el release roto a proposito`
- **Riesgo y vuelta atrás:** se rompe DEMO, que es exactamente para lo que está («puede
  romperse sin que duela», §3). **Ninguna instancia de owner participa.**

---

### F3.6 · Retirar el despliegue por SSH `[release]`

- **Objetivo:** que no quede en el repo un camino que compile código en el servidor de
  una instancia.
- **Fase:** 3. **Depende de:** F3.5. **Debe** hacerse antes de la primera instancia de
  owner.
- **Archivos:** `.github/workflows/deploy.yml` (se retira);
  `docs/runbook-actualizar-instancia.md` (nuevo);
  `vault/01-Arquitectura/entorno-y-despliegue.md`.
- **Prueba que falla primero:** no aplica.
- **Pasos:**
  1. Comprobar que nadie lo referencia:
     `rg -n "deploy\.yml|deploy\.sh" --glob '!node_modules' .`
  2. Retirar `deploy.yml`. En su lugar, un runbook de diez líneas: *la instancia jala;
     el padre no empuja.*
  3. Actualizar la bóveda, que hoy describe `deploy.yml` como el mecanismo de
     despliegue.
- **Criterio de aceptación:** **no queda en el repo ningún camino que entre por SSH a
  una instancia a compilar**; lo único que queda con `ssh` es el aprovisionamiento
  inicial (F5.4).
- **Comando de verificación:** `rg -n "appleboy/ssh-action|pm2 reload" .github/` → sin
  resultados.
- **Commit sugerido:** `chore(release): fuera el despliegue por ssh, la instancia jala su version`
- **Riesgo y vuelta atrás:** **alto si se hace antes de tiempo**: mientras el droplet
  actual siga siendo la producción de los tenants reales, `deploy.yml` es el único
  mecanismo que hay. **Por eso depende de F3.5 y va después de la Fase 4.** Vuelta
  atrás: `git revert` (el workflow vuelve tal cual).

---

### F3.7 · El respaldo sale del droplet `[infra]`

- **Objetivo:** que el respaldo previo a una actualización **sobreviva a la muerte
  del droplet que lo generó**.
- **Fase:** 3. **Depende de:** F3.4. **Bloqueante de:** nada.
- **Archivos:** `infra/scripts/update.sh` (el paso 3 crece);
  `infra/scripts/respaldo.sh` (nuevo); la plantilla `.env` de F5.3.
- **Por qué:** el `update.sh` de F3.4 guarda el `pg_dump` en el propio droplet. Sirve
  para el rollback de un release malo, que es su trabajo, pero **no sirve para nada
  si el droplet desaparece** — y ese es justo el escenario que el modelo de instancias
  hace más probable, porque ahora son muchos droplets pequeños en vez de uno cuidado.
- **Prueba que falla primero:** no aplica (infra). El gate es F3.5.
- **Pasos:**
  1. Después del `pg_dump -Fc` y de la comprobación de que **no está vacío**, subir a
     Spaces. Spaces es compatible con S3: `s3cmd put` o
     `aws s3 cp --endpoint-url https://<region>.digitaloceanspaces.com`.
     > **No** `gsutil`: eso es Google Cloud Storage y no habla con Spaces.
  2. Ruta: `s3://space-os-respaldos/<instancia>/<AAAA-MM-DD-HHMM>.dump`.
  3. Credenciales en el `.env` de la instancia (`SPACES_KEY`, `SPACES_SECRET`,
     `SPACES_BUCKET`), **una llave por instancia y con permiso solo a su prefijo**.
     Nunca la llave maestra de la cuenta.
  4. Retención: 3 respaldos locales; 30 días en Spaces **por regla de ciclo de vida
     del bucket**, no por un `rm` dentro del script (un `rm` mal escrito en un script
     que corre en todas las instancias es una forma elegante de perderlo todo).
  5. Si la subida falla, **el update sigue** —el respaldo local ya existe y basta para
     el rollback— pero se escribe `RESPALDO REMOTO FALLIDO` en el log y en el reporte
     de flota.
- **Criterio de aceptación:** si el droplet desaparece, **el último respaldo sigue
  existiendo** fuera de él. Y una subida fallida **no** detiene la actualización, pero
  **no pasa desapercibida**.
- **Comando de verificación:**
  ```bash
  s3cmd ls s3://space-os-respaldos/demo/ | tail -3
  ```
- **Commit sugerido:** `feat(instancias): el respaldo viaja a spaces, no se queda en el droplet que puede morir`
- **Riesgo y vuelta atrás:** las llaves viven en el `.env` de la instancia; si se
  filtran, dan escritura sobre **su** prefijo y nada más. Vuelta atrás: quitar el
  bloque de subida; el respaldo local sigue igual.

---

### F3.8 · Reintentos con backoff, y un límite `[infra]`

- **Objetivo:** que una red intermitente no deje a una instancia sin actualizar ni,
  peor, a medio actualizar.
- **Fase:** 3. **Depende de:** F3.4.
- **Archivos:** `infra/scripts/update.sh`.
- **Prueba que falla primero:** no aplica. Se ejercita en F3.5 con la red cortada.
- **Pasos:** la política, escrita en el script y en su README.

  | Paso que falla | Reintentos | Espera | Qué pasa al agotarse |
  |---|---|---|---|
  | `docker pull` | 3 | 1 s, 5 s, 30 s | Aborta **antes de tocar la base**; sale ≠0 |
  | Migración | **0** | — | Rollback inmediato. Reintentar una migración a medias es como se corrompe una base |
  | Health check | 10 | 3 s (ya está en F3.4) | Rollback al digest anterior |
  | Reporte al padre (F6.4) | 2 | 5 s, 30 s | Se guarda en disco y se manda en la siguiente corrida. **Nunca aborta el update** |

- **Criterio de aceptación:** **ningún reintento sobre una migración fallida**; un
  `pull` que no llega deja la instancia exactamente como estaba; cada reintento queda
  numerado en el log.
- **Comando de verificación:**
  ```bash
  /opt/space-os/update.sh --simular-fallo-pull; echo "salida: $?"
  grep -c "reintento" /var/log/space-os/update.log     # 3
  ```
- **Commit sugerido:** `feat(instancias): el pull reintenta con backoff, la migracion no reintenta nunca`
- **Riesgo y vuelta atrás:** bajo. Vuelta atrás: `git revert`.

---

### F3.9 · El log del update se puede leer sin entrar al servidor `[infra]`

- **Objetivo:** diagnosticar una actualización fallida de la instancia de un owner
  **sin entrar por SSH** — que es justo lo que el modelo prohíbe.
- **Fase:** 3. **Depende de:** F3.7 (reutiliza credenciales y bucket).
- **Archivos:** `infra/scripts/update.sh`; `infra/scripts/README.md`.
- **Prueba que falla primero:** no aplica.
- **Pasos:**
  1. Al terminar —salga bien o mal—, subir `/var/log/space-os/update.log` a
     `s3://space-os-logs/<instancia>/<AAAA-MM-DD-HHMM>.log`.
  2. Retención 90 días, otra vez por regla de ciclo de vida del bucket.
  3. **Filtrar antes de subir:** la salida de `psql` puede arrastrar nombres de tabla
     y conteos. Nombres de tabla y conteos son aceptables; **cualquier fila, no**. El
     script sube solo las líneas que él mismo emite más los códigos de salida, no la
     salida cruda de las herramientas.
- **Criterio de aceptación:** una actualización fallida se diagnostica leyendo el
  bucket, sin abrir una sesión en el servidor del owner. Y **ni un dato de negocio
  aparece en el log**: la primera subida de cada instancia se revisa a ojo y se anota
  en `docs/Registro_Cambios.md` qué se filtró.
- **Comando de verificación:**
  ```bash
  s3cmd get s3://space-os-logs/demo/$(date +%F)*.log - | head -40
  ```
- **Commit sugerido:** `feat(instancias): el log del update viaja al bucket, sin datos de negocio dentro`
- **Riesgo y vuelta atrás:** un log es una vía de fuga clásica; por eso el criterio va
  en negativo y la primera revisión es manual. Vuelta atrás: quitar la subida.

---

## FASE 4 · Separar DEMO como instancia real

**Entorno:** cuenta DO de AS OOH. **Ejecuta:** Emiliano.
No está bloqueada por §8: la autoridad dice que DEMO vive en la cuenta de AS OOH junto
al padre (§3).

---

### F4.1 · Censo del droplet actual `[verificación]`

- **Objetivo:** saber exactamente qué se está separando antes de separarlo.
- **Fase:** 4. **Depende de:** nada. **Bloqueante de:** F4.2, F7.1.
- **Pasos:** todo solo lectura.
  ```bash
  ssh root@209.97.146.136 "
    echo '— commit desplegado —';    cd /var/www/Spaces && git log --oneline -1
    echo '— proceso —';              su - emiliano -c 'pm2 describe spaces-web | grep -iE \"status|uptime|restarts|script\"'
    echo '— nginx —';                nginx -T 2>/dev/null | grep -E 'server_name|ssl_certificate ' | sort -u
    echo '— certificado —';          certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'
    echo '— env (sin secretos) —';   grep -E '^(APP_URL|COOKIE_SECURE|NEXT_PUBLIC_|NODE_ENV|PORT)' apps/web/.env apps/web/.env.production 2>/dev/null
    echo '— tenants —';              sudo -u postgres psql -d spaces_prod -Atc \"select slug, creado_en from tenants order by creado_en\"
    echo '— migraciones en disco —'; ls db/migrations/*.sql | wc -l
  "
  ```
- **Criterio de aceptación:** hay un documento con: commit desplegado, lista de tenants
  con fecha, dominios servidos, certificados y vencimiento, y el valor de
  `COOKIE_SECURE` y `APP_URL`. **Si el commit desplegado no está en `main`, se para y se
  avisa** (ya hay precedente: commit `2f28be0`).
- **Commit sugerido:** `docs(deploy): censo del droplet actual antes de separar DEMO`
- **Riesgo y vuelta atrás:** ninguno.

---

### F4.2 · Droplet y base de DEMO `[infra]`

- **Objetivo:** que `demo.space-os.io` deje de compartir servidor y base con datos
  reales.
- **Fase:** 4. **Depende de:** F4.1, F1.5.
- **Pasos:**
  1. Droplet Ubuntu en la cuenta DO de AS OOH; firewall de DO abierto solo a **80, 443
     y SSH** (§5 Fase 4), y `ufw` con lo mismo
     (`infra/scripts/setup-droplet.sh:66-72` ya lo hace así).
  2. Postgres con **dos roles**: `postgres` para migraciones y uno de app
     `NOSUPERUSER NOBYPASSRLS` — **no es opcional**: con un superusuario la RLS no se
     aplica y el aislamiento interno desaparece.

     > **ENMIENDA 2026-08-20 (ROJO-3).** El rol de la app de una instancia nueva se
     > llama **`spaces_app`** y se crea **con una contraseña propia de esa
     > instancia**. El droplet actual se queda con **`spaces_user`** y **no se le
     > cambia**. Son los dos únicos nombres, y **no es una preferencia: es lo que las
     > migraciones saben conceder** — ver el límite medido, más abajo.
     >
     > ```sql
     > create role spaces_app login password '<clave propia de esta instancia>'
     >   nosuperuser nobypassrls;
     > ```
     >
     > **`db/dev-rol-app.sql` es solo la plantilla de la instrucción, NO la fuente**:
     > su propio encabezado dice *«SOLO DESARROLLO — NO APLICAR EN PRODUCCIÓN: la
     > contraseña está aquí en claro»*, y crea el rol con la clave `spaces_app_dev`
     > **visible en el repositorio**. Citarlo como paso de una instalación real le
     > pedía a una persona que publicara una credencial.
     >
     > **La contraseña sí es propia de cada instancia.** Trece migraciones conceden
     > sus GRANT a una lista blanca de dos nombres, guardados por existencia
     > (`20260715_arr_m6_rol_restringido.sql:21` y `:38`, y el `foreach` de otras
     > once): con cualquier otro nombre **no conceden nada y no dan error**. Lo cierra
     > por los dos lados `20260820_grants_rol_app.sql` —concede sin lista blanca y
     > **aborta** si no hay ningún rol— y el candado de `scripts/migrar.mjs`, que se
     > niega a aplicar nada sin rol de aplicación. **Lo que cierra el agujero no es el
     > nombre: es el aborte.**
     >
     > ⚠️ **Límite medido el 2026-08-20, y por eso los nombres son dos y no libres.**
     > Una base **virgen** cuyo rol lleve un nombre nuevo **no llega** a esa migración:
     > la cadena aborta antes, en `20260729_licencias_permisos.sql:88-97`, que deriva
     > el rol de quién tiene grants sobre `contratos_arrendamiento` — y con un nombre
     > fuera de la lista blanca nadie se los concedió. Reproducido con `pixeled_app`:
     > **aborta en el archivo 52 de 70 y deja 33 tablas**.
     >
     > Hubo un ajuste (`ROL_APP` / `space_os.rol_app`) para declarar otro nombre, y
     > **se retiró el mismo día**: no funcionaba por ninguna vía. `update.sh` ni
     > siquiera lo reenviaba —corre el runner con `--env DATABASE_URL` y nada más— y
     > sobre una base ya migrada **no hacía nada y salía con 0**, dejando el rol con
     > cero permisos. Para que un nombre libre sea posible hay que arreglar antes
     > `licencias_permisos` (zona R3) o reordenar la cadena.
  3. Base vacía + `db/schema.sql` + `node scripts/migrar.mjs` (F3.2).
  4. Correr la imagen (F2.2) con canal **`beta`**.
- **Criterio de aceptación:** **la base de DEMO no contiene ni una fila de ningún
  owner**; el rol de la app **no** puede saltarse la RLS.
- **Comando de verificación:**
  ```bash
  ssh <demo> "sudo -u postgres psql -d spaces_demo -Atc \"select rolname, rolsuper, rolbypassrls from pg_roles where rolcanlogin\"; sudo -u postgres psql -d spaces_demo -Atc 'select count(*) from tenants'"
  ```
  Esperado: el rol de app con `f | f`, y `0` tenants antes de sembrar.
- **Commit sugerido:** `docs(infra): DEMO nace con droplet y base propios`
- **Riesgo y vuelta atrás:** ninguno sobre lo existente mientras no se mueva el DNS
  (F4.3). Vuelta atrás: destruir el droplet.

---

### F4.3 · Dominio y certificado de DEMO `[infra]`

- **Objetivo:** que `demo.space-os.io` apunte al droplet nuevo, con HTTPS.
- **Fase:** 4. **Depende de:** F4.2.
- **Pasos:**
  1. **Verificar primero el estado de Cloudflare** (no se asume):
     ```bash
     dig +short demo.space-os.io
     curl -sI https://demo.space-os.io | grep -iE '^server:|^cf-ray:'
     ```
     **Con `cf-ray`** = proxy naranja encendido: hay que ponerlo en gris para emitir por
     HTTP-01, o usar un certificado Origin CA. **Sin `cf-ray`** = gris, y HTTP-01
     funciona directo, que es el caso documentado en
     `docs/runbook-dominio-https.md:20-26` («emitir primero, encender el proxy
     después»).
  2. Copiar `infra/nginx/demo.space-os.io.conf` al droplet nuevo tal cual: ya trae el
     proxy a `127.0.0.1:3000`, HSTS (`:95`), gzip, `client_max_body_size 12M` (`:87`),
     la redirección de `/` al login (`:150-152`) y el `X-Forwarded-For $remote_addr`
     deliberado (`:117-123`) que sostiene el limitador de intentos. **No cambiar esa
     línea.**
  3. Emitir el certificado con
     `certbot certonly --webroot -w /var/www/html -d demo.space-os.io` (receta ya
     probada en `docs/runbook-dominio-https.md`).
  4. Bajar el TTL en Cloudflare, cambiar el registro A a la IP nueva, esperar
     propagación, restaurar TTL.
  5. Instalar `infra/nginx/cloudflare-realip.sh` si el proxy queda en naranja. Sin él,
     «TODO el tráfico parece venir de una sola IP y el limitador de intentos de login
     bloquearía a todos a la vez» (`demo.space-os.io.conf:9-12`).
- **Criterio de aceptación:** `https://demo.space-os.io/spaces-dooh/login/` sirve desde
  el droplet **nuevo**, con certificado válido, y **el droplet viejo ya no responde a
  ese nombre**.
- **Comando de verificación:**
  ```bash
  dig +short demo.space-os.io
  curl -s -o /dev/null -w '%{http_code}\n' https://demo.space-os.io/spaces-dooh/login/
  echo | openssl s_client -connect demo.space-os.io:443 -servername demo.space-os.io 2>/dev/null | openssl x509 -noout -dates
  ```
- **Commit sugerido:** `docs(infra): demo.space-os.io servido por su propio droplet, con su certificado`
- **Riesgo y vuelta atrás:** ventana sin HTTPS si se pone el `server_name` antes del
  certificado — el error que el plan del 11 ya señalaba (T9): el navegador muestra error
  de certificado, no un 301. **Certificado primero.** Vuelta atrás: devolver el registro
  A a `209.97.146.136`.

---

### F4.4 · Datos de juguete y autoregistro encendido `[infra]`

- **Objetivo:** que DEMO sirva para vender y probar, sin datos de nadie.
- **Fase:** 4. **Depende de:** F4.2.
- **Pasos:**
  1. Crear la organización de demostración con el bootstrap de F5.2 (si ya existe) o,
     mientras tanto, con SQL documentado en `docs/datos/`.
  2. Sembrar inventario ficticio. **Nada exportado de `spaces_prod`**: los datos de DEMO
     son de juguete por definición (§3).
  3. `.env` de DEMO: `NEXT_PUBLIC_AUTOREGISTRO=1` (**la única instancia de toda la flota
     que lo lleva**), `COOKIE_SECURE=1`, `APP_URL=https://demo.space-os.io`,
     `CANAL=beta`.
     > **Aquí aparece un choque real entre dos invariantes.** La bandera se hornea en el
     > build, así que DEMO **no puede** usar exactamente la misma imagen que las
     > instancias de owner sin violar el invariante 3 o el 9. → **P4**.
- **Criterio de aceptación:** `POST /api/signup/` en DEMO devuelve **400** (abierto,
  correcto **aquí y solo aquí**) y en cualquier otra instancia **503**.
- **Comando de verificación:**
  ```bash
  curl -s -w '\nHTTP %{http_code}\n' -X POST https://demo.space-os.io/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
  ```
  Esperado en DEMO: `400`.
- **Commit sugerido:** `docs(infra): DEMO con datos de juguete y el unico autoregistro encendido de la flota`
- **Riesgo y vuelta atrás:** si por error se copian datos reales a DEMO, se crea una
  segunda copia sin dueño. Regla: **nada sale de `spaces_prod` hacia DEMO** salvo lo que
  la Fase 7 decida explícitamente.

---

### F4.5 · Smoke de DEMO y cierre del riesgo `[verificación]`

- **Objetivo:** dejar por escrito que «demo pública = producción» dejó de ser cierto.
- **Fase:** 4. **Depende de:** F4.3, F4.4. **Bloqueante de:** F3.5, F3.6, F6.3.
- **Criterio de aceptación:** las cuatro afirmaciones son verdaderas y están
  registradas:
  1. `demo.space-os.io` resuelve al droplet nuevo;
  2. la base de DEMO no contiene ningún tenant de `spaces_prod`;
  3. el droplet viejo sigue sirviendo a los tenants reales por otro nombre o por su IP
     (o se apaga: eso lo decide §8.1);
  4. DEMO está suscrita al canal `beta`.
- **Comando de verificación:**
  ```bash
  dig +short demo.space-os.io
  ssh <demo> "sudo -u postgres psql -d spaces_demo -Atc \"select string_agg(slug,',') from tenants\""
  ssh root@209.97.146.136 "sudo -u postgres psql -d spaces_prod -Atc \"select string_agg(slug,',') from tenants\""
  ```
  Las dos listas **no** deben tener ningún slug en común.
- **Commit sugerido:** `docs(deploy): demo deja de ser produccion — el riesgo se cierra con evidencia`
- **Riesgo y vuelta atrás:** ninguno; es constatación.

---

## FASE 5 · `provision-instancia.sh` (alta de un owner)

**Entorno:** PADRE (código y scripts) → droplet desechable (ensayo) → instancia de owner
(solo F5.7). **Ejecuta:** Carlos + Emiliano.
**Bloqueada parcialmente** por §8.3 (en qué cuenta nace la instancia) y §8.2 (fecha de
PIXELED). Lo que **no** está bloqueado se hace hoy.

---

### F5.1 · `withTxBootstrap`: la organización y su Dueño nacen juntos `[código]`

- **Objetivo:** que un fallo a mitad del alta no deje una organización sin Dueño.
- **Fase:** 5. **Depende de:** nada. **Bloqueante de:** F5.2.
- **Archivos:** `apps/web/lib/server/db.ts` (añadir al final);
  `apps/web/lib/server/usuarios-repo.ts:37-55`;
  `apps/web/lib/server/cuentas-controller.ts:41-62`;
  `apps/web/lib/test/alta-organizacion.e2e.test.ts` (nuevo).
- **Prueba que falla primero:** **el caso negativo**: se induce un fallo en el `INSERT`
  de `usuarios` (un trigger que revienta para un correo concreto) y se afirma que **no
  queda ninguna fila en `tenants` con ese slug**. Falla hoy:
  `cuentas-controller.ts:52-53` son dos llamadas sueltas y el tenant sobrevive al fallo
  del usuario.
- **Pasos:**
  1. Escribir la prueba en el archivo nuevo (**no** en `aislamiento.e2e.test.ts`), con
     `recrearEsquema()` + `asegurarPermisos()` + `sembrarTenant()`; verla en rojo.
  2. `db.ts`: añadir `withTxBootstrap<T>(fn)` — transacción que **empieza sin tenant** y
     expone `fijarTenant(id)` para fijar el GUC a mitad, cuando el id ya existe.
     `withTenantTx` (`:110-127`) no sirve: fija el tenant **de la sesión**, y en un alta
     todavía no hay sesión. El `set_config(..., true)` es transaction-local, así que el
     insert en `tenants` (tabla exenta) y el de `usuarios` (fail-closed, ya bajo su GUC)
     caben en la **misma** transacción.
  3. `usuarios-repo.ts`: `crearUsuario(input, client?)`. Con `client`, el INSERT va por
     esa transacción; sin él, todo sigue como hoy con `qConTenant`. **No se duplica la
     función** — el repo ya advierte que duplicar es «la forma segura de que las tres
     divergieran» (`cuentas-controller.ts:36-40`).
  4. `cuentas-controller.ts`: `crearOrgConDueno` hace el insert de `tenants`, el
     `fijarTenant` y el insert del Dueño dentro de una sola `withTxBootstrap`. **La
     forma de retorno no cambia** (`{ tenant, usuario }`): devolver la URL está
     descartado (§4, T5).
  5. `npm test` y `npm run test:e2e` en verde.
- **Criterio de aceptación:** **no queda tenant huérfano** cuando falla la creación del
  Dueño; `POST /api/tenants` sigue devolviendo 201 con el mismo cuerpo que hoy;
  `aislamiento.e2e.test.ts` pasa **sin tocarse**.
- **Comando de verificación:**
  ```bash
  cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/alta-organizacion.e2e.test.ts && npm run test:e2e && npm test
  ```
- **Commit sugerido:** `fix(altas): la organizacion y su dueno nacen juntos o no nacen`
- **Riesgo y vuelta atrás:** toca la ruta de alta, que usan `POST /api/tenants`
  (`app/api/tenants/route.ts:21-31`) y el signup. La prueba nueva más `npm test` cubren
  las dos entradas. Vuelta atrás: `git revert`.

---

### F5.2 · Bootstrap de un solo uso para la instancia recién creada `[código]`

- **Objetivo:** que el aprovisionamiento cree la organización inicial y su Dueño **sin
  duplicar** la lógica de contraseñas ni la transacción.
- **Fase:** 5. **Depende de:** F5.1.
- **Archivos:** `apps/web/app/api/bootstrap/route.ts` (nuevo);
  `apps/web/middleware.ts:55-65` (lista de exentas de CSRF);
  `apps/web/lib/test/bootstrap.e2e.test.ts` (nuevo).
- **Por qué así y no con un script `.mjs`:** `db.ts:1` y `auth.ts:1` empiezan con
  `import 'server-only'`, que **lanza un error fuera de un React Server Component**
  (`apps/web/lib/test/server-only-stub.ts`). Un script Node no puede importar
  `withTxBootstrap` ni `hashPassword` (`auth.ts:83-84`, bcrypt coste 10); replicarlos
  sería duplicar la parte más delicada del sistema. La ruta reusa el código real.
  *(Decisión técnica, no de producto: la alternativa está en «Riesgo».)*
- **Prueba que falla primero:** cuatro casos, tres negativos.
  - con `tenants` vacía y el token correcto → **201**, y el Dueño creado **puede iniciar
    sesión por la API real** (esto garantiza que el hash es el que espera el login);
  - **con un tenant ya existente → 404 y no crea nada**;
  - **sin token o con token equivocado → 404 y no crea nada** (404 y no 401: no confirma
    que la ruta exista);
  - **sin `BOOTSTRAP_TOKEN` en el entorno → 404** (nace apagada).
- **Pasos:**
  1. Escribir la prueba; verla en rojo.
  2. Implementar la ruta: `runtime='nodejs'`, `dynamic='force-dynamic'`,
     `cache-control: no-store`; token de cabecera comparado en tiempo constante;
     `select count(*) from tenants` **= 0**; llamada a `crearOrgConDueno`.
  3. **Exenta de CSRF**: añadirla a la lista de `middleware.ts:55-65` junto a
     `/api/signup`, con el comentario de por qué (no hay cookie de sesión que proteger;
     la credencial es el token de un solo uso).
  4. Rate limit por IP, como el resto de rutas públicas
     (`apps/web/lib/server/rate-limit.ts`).
- **Criterio de aceptación:** **no se puede crear una segunda organización por esta
  puerta**; sin token no se crea ninguna; en una instancia ya aprovisionada la ruta es
  indistinguible de una que no existe.
- **Comando de verificación:**
  `cd apps/web && npx vitest run --config vitest.e2e.config.ts lib/test/bootstrap.e2e.test.ts`
- **Commit sugerido:** `feat(instancias): el alta inicial de una instancia, de un solo uso y con token`
- **Riesgo y vuelta atrás:** es una ruta pública nueva en el artefacto de **toda** la
  flota; por eso las tres condiciones (token + base vacía + rate limit) y por eso las
  pruebas son negativas. **Alternativa si el riesgo no convence:**
  `scripts/bootstrap-organizacion.mjs` con `pg` + `bcryptjs` replicando la transacción,
  corrido con `docker run --rm` sin exponer puerto; el coste es duplicar el hash de
  contraseña, mitigable con una e2e que compruebe el login. Vuelta atrás: borrar la
  ruta — no deja rastro en la base.

---

### F5.3 · Plantillas de instancia: `.env` y nginx `[infra]`

- **Objetivo:** que lo único distinto entre dos instancias esté en dos archivos y nunca
  en el código.
- **Fase:** 5. **Depende de:** F0.3, F2.2.
- **Archivos:** `infra/env/instancia.env.example` (nuevo);
  `infra/nginx/instancia.conf.tpl` (nuevo); `apps/web/lib/entorno.test.ts` (crece).
- **Prueba que falla primero:** en `entorno.test.ts`, dos casos nuevos: la plantilla de
  instancia **existe**, trae `NEXT_PUBLIC_AUTOREGISTRO=0` y **no** trae ningún
  `COOKIE_DOMAIN`. Falla hoy: el archivo no existe.
- **Pasos:**
  1. `infra/env/instancia.env.example` con, y solo con, lo que la app viva lee:
     `APP_URL` (el dominio de acceso; lo consumen `app/api/auth/forgot/route.ts:50`,
     `app/api/auth/google/callback/route.ts:61,81`,
     `app/api/recordatorios/route.ts:65`), `DATABASE_URL` (rol de app, **no**
     superusuario), `COOKIE_SECURE=1`, `NEXT_PUBLIC_AUTOREGISTRO=0`,
     `NEXT_PUBLIC_RECUPERAR_PASSWORD`, `EMAIL_FROM`, `RESEND_API_KEY`, `GOOGLE_*`,
     `RECORDATORIOS_TOKEN`, `TZ`, `CANAL=estable`, `REGISTRY`, `BOOTSTRAP_TOKEN`. Cada
     una con una línea de por qué. Con el aviso de `trailingSlash` para
     `GOOGLE_REDIRECT_URI` que ya está en `.env.example:57-66` (la barra final no es
     opcional).
     **Nada de** `COOKIE_DOMAIN`, `PORT=3001`, `NEXT_PUBLIC_API_URL`, `JWT_SECRET` ni
     `REDIS_URL`: ninguna la lee el producto vivo, y la primera es justo la que el
     invariante 4 prohíbe.
  2. `infra/nginx/instancia.conf.tpl`: copia de `demo.space-os.io.conf` con
     `__DOMINIO__` en `server_name` y en las rutas de certificado. **Se conservan
     literalmente** el `X-Forwarded-For $remote_addr` (`:117-123`), el
     `client_max_body_size 12M` (`:87`), la redirección `location = /` al login
     (`:150-152`) y el catch-all (`:33-46`) apuntando al dominio del owner.
  3. Correr las pruebas.
- **Criterio de aceptación:** **ninguna plantilla contiene un dominio real quemado**;
  `rg -n "space-os\.io" infra/env infra/nginx/instancia.conf.tpl` devuelve solo
  comentarios de ejemplo.
- **Comando de verificación:** `cd apps/web && npx vitest run lib/entorno.test.ts` y el
  `rg` de arriba.
- **Commit sugerido:** `feat(instancias): plantillas de entorno y de nginx, con el dominio como parametro`
- **Riesgo y vuelta atrás:** bajo. Vuelta atrás: `git revert`.

---

### F5.4 · `provision-instancia.sh` `[infra]`

- **Objetivo:** un solo comando que deja una instancia lista, salvo el DNS del owner.
- **Fase:** 5. **Depende de:** F5.2, F5.3, F3.4, F2.4. **Bloqueada por §8.3** en un
  punto concreto.
- **Archivos:** `infra/scripts/provision-instancia.sh` (nuevo);
  `docs/runbook-alta-de-owner.md` (nuevo).
- **Prueba que falla primero:** no aplica. El gate es F5.6.
- **Base de partida:** `infra/scripts/setup-droplet.sh` es aprovechable en su parte
  genérica (Node 20 por nvm `:25-46`, pm2 `:48-52`, nginx `:54-59`, certbot `:61-64`,
  ufw 22/80/443 `:66-72`), pero su resumen final (`:82-106`) manda copiar
  `apps/api/.env`, usar `infra/nginx/spaces.conf` y emitir
  `certbot --nginx -d '*.{slug}.spaces.com'` — **todo de la pista archivada o del modelo
  equivocado**. Ese bloque se reescribe apuntando a las plantillas de F5.3.
- **Pasos (lo que el script hace):**
  1. **Modo de servidor** — aquí muerde §8.3. Se escribe con **dos modos** para no tener
     que reescribirlo cuando se decida: `--crear-droplet` (lo crea en la cuenta
     configurada) y `--host <ip|dns>` (usa un servidor existente, el caso «cuenta del
     owner»). Lo que **no** se decide aquí es cuál se usa por defecto.
  2. Base de datos: rol `postgres` para migraciones + rol de app
     `NOSUPERUSER NOBYPASSRLS`; base vacía; `db/schema.sql`; `scripts/migrar.mjs`.
  3. `.env` a partir de `infra/env/instancia.env.example`, con el dominio de acceso que
     entrega Comercial (§6 paso 1) y un `BOOTSTRAP_TOKEN` aleatorio.
  4. Instala el release **`estable`** (nunca `beta`: §3).
  5. nginx desde `instancia.conf.tpl` sustituyendo `__DOMINIO__`. **Sin certificado
     todavía.**
  6. Instala `update.sh` y su `cron` (F3.4).
  7. **Se detiene** y entrega: «apunta `<dominio>` a `<IP>` con un registro A en TU
     DNS». AS OOH nunca toca la zona del owner (§3).
  8. Cuando el owner confirma, `--emitir-certificado` corre
     `certbot certonly --webroot` (HTTP-01) y recarga nginx.
  9. `--bootstrap` llama a `POST /api/bootstrap` con el token y devuelve las credenciales
     del Dueño una sola vez.
- **Criterio de aceptación:** al terminar, el owner entra por **su** dominio, ve **su**
  marca (sale de su `config_negocio`, no de ninguna cabecera) y su instancia jala
  `estable` sola. **Ninguna otra instancia se entera de nada.**
- **Comando de verificación:**
  ```bash
  bash infra/scripts/provision-instancia.sh --host <ip> --dominio <dominio> --dry-run
  # tras el alta:
  curl -s -o /dev/null -w 'login %{http_code}\n'  https://<dominio>/spaces-dooh/login/
  curl -s -w '\nsignup HTTP %{http_code}\n' -X POST https://<dominio>/spaces-dooh/api/signup/ -H 'Content-Type: application/json' -d '{}'
  ```
  Esperado: `200` y **`503`** (autoregistro apagado y horneado, invariante 9).
- **Commit sugerido:** `feat(instancias): provision-instancia.sh deja una instancia lista salvo el DNS del owner`
- **Riesgo y vuelta atrás:** el paso del certificado falla si el DNS no propagó; el
  script debe reintentar sin dejar nginx roto (por eso el certificado va **después** del
  `server_name`, y el vhost HTTP responde mientras tanto). Vuelta atrás: destruir el
  droplet; nada se ha entregado al owner todavía.

---

### F5.5 · Retirar los cuatro scripts de la pista archivada `[infra]`

- **Objetivo:** que no quede en el repo un script capaz de tocar una base de producción
  con una arquitectura que ya no existe.
- **Fase:** 5 (ejecuta la T8 del plan del 11). **Depende de:** F5.4, F3.6.
- **Archivos:** se borran `infra/scripts/new-tenant.sh`,
  `infra/scripts/setup-first-tenant.sh`, `infra/scripts/migrate-all-tenants.sh`,
  `infra/scripts/deploy.sh`. Se añade `infra/scripts/README.md`.
- **Prueba que falla primero:** no aplica.
- **Pasos:**
  1. Confirmar que nadie los llama:
     ```bash
     rg -n "new-tenant|setup-first-tenant|migrate-all-tenants|infra/scripts/deploy\.sh" --glob '!node_modules' .
     ```
     Esperado: los propios archivos y menciones en documentación. **Si aparece en un
     workflow, parar y avisar.** *(Ojo: el plan del 11 decía que `new-tenant.sh` solo se
     cita a sí mismo. Hoy **no** es cierto: lo llama `setup-first-tenant.sh:28`.)*
  2. `git rm` los cuatro.
  3. `infra/scripts/README.md` con lo que sí existe: `provision-instancia.sh` (alta),
     `update.sh` (actualización, la corre la instancia), `setup-droplet.sh` (base del
     servidor) — y la frase que evita la recaída: *el alta de un owner es aprovisionar
     una instancia, no insertar una fila.*
  4. Reescribir el bloque final de `setup-droplet.sh:82-106` (ver F5.4).
- **Criterio de aceptación:** **no queda ningún script que hable de `public."Tenant"`,
  de `prisma migrate deploy` ni de `/var/www/Marketplace`**.
- **Comando de verificación:**
  `rg -n "public\.\"Tenant\"|prisma migrate|Marketplace" infra/ .github/` → sin
  resultados.
- **Commit sugerido:** `chore(infra): fuera los scripts de la pista archivada, el alta es aprovisionar una instancia`
- **Riesgo y vuelta atrás:** `git revert` los recupera. El riesgo real es el contrario:
  dejarlos.

---

### F5.6 · Ensayo de aprovisionamiento en un droplet desechable `[verificación]`

- **Objetivo:** probar el alta completa sin un owner de por medio.
- **Fase:** 5. **Depende de:** F5.4, F3.5.
- **Pasos:** aprovisionar una instancia de mentira con un dominio de prueba de la zona
  `space-os.io`, recorrer el runbook §6 de punta a punta y destruirla.
- **Criterio de aceptación:** las seis casillas del runbook §6 se cumplen sin
  intervención manual fuera de lo previsto; **el autoregistro está cerrado**; el Dueño
  entra; `update.sh --dry-run` dice «sin cambios»; **el segundo intento de `--bootstrap`
  falla con 404** (la instancia ya está dada de alta).
- **Comando de verificación:** el bloque de F5.4 más
  `ssh <prueba> "/opt/space-os/update.sh --dry-run"`.
- **Commit sugerido:** `docs(instancias): ensayo completo del alta, con el runbook recorrido`
- **Riesgo y vuelta atrás:** ninguno: la instancia es desechable.

---

### F5.7 · Alta de la primera instancia de owner `[verificación]` — **BLOQUEADA**

- **Objetivo:** que el primer owner entre por su dominio.
- **Fase:** 5. **Depende de:** F5.6, y de la Fase 7 si el owner elegido ya tiene datos
  en `spaces_prod`.
- **Bloqueada por:** §8.2 (fecha objetivo de PIXELED) y §8.3 (en qué cuenta nace).
  Además, si el owner es `g500`/PIXELED, **sus datos viven hoy en `spaces_prod`** y el
  alta deja de ser un aprovisionamiento limpio para convertirse en una migración de
  datos → es la Fase 7, no ésta.
- **Qué cambia según la respuesta:** ver P2 y P3.

---

### F5.8 · Un token de flota por instancia, y el padre no reparte llaves `[código]`

- **Objetivo:** que el padre pueda identificar a una instancia —y la instancia al
  padre— **sin que una instancia pueda hacerse pasar por otra**.
- **Fase:** 5. **Depende de:** F5.4. **Bloqueante de:** F6.1 (que ya compara un token
  que hoy nadie escribe) y F6.4.
- **Archivos:** `infra/scripts/provision-instancia.sh`; la plantilla `.env` de F5.3;
  `apps/web/app/api/version/route.ts` (comparación); `apps/flota/README.md`.
- **Por qué un token opaco y no un JWT firmado:** un JWT obliga a que exista un
  secreto de firma, y ese secreto acaba en el `.env` de cada instancia para poder
  verificar. Repartir la llave de firma a toda la flota significa que cualquiera con
  acceso a su propio droplet —el owner, su proveedor, quien le administre el
  servidor— puede firmar un token válido de **cualquier otra** instancia. En un
  modelo cuya promesa es el aislamiento, sería la única puerta que las volvería a
  conectar.
- **El diseño:** **token opaco, aleatorio, uno por instancia.**
  `openssl rand -hex 32`, generado en el padre durante el aprovisionamiento. No hay
  nada que firmar, no hay secreto compartido, y revocar es borrar una línea.
- **Prueba que falla primero:** tres casos en `version.e2e.test.ts`, **dos
  negativos**.
  - token propio correcto → cuerpo completo;
  - **token de otra instancia → cuerpo reducido**, nunca la versión;
  - **token con el prefijo correcto y un carácter cambiado → cuerpo reducido**, y la
    comparación tarda lo mismo que con uno completamente distinto.
  Falla hoy: no existe el token.
- **Pasos:**
  1. Generarlo en el aprovisionamiento; escribirlo en el `.env` de la instancia con
     permisos `600` y dueño el usuario de la app.
  2. Guardarlo en el padre **fuera de `flota.json`**, que sí se versiona: en un
     archivo aparte no versionado, o en el `.env` del panel. `flota.json` sigue sin
     tokens dentro (F6.2, paso 2).
  3. En `/api/version`, comparar con `crypto.timingSafeEqual` sobre buffers de igual
     longitud — **no** con `===`, que revela el prefijo por el tiempo que tarda.
  4. Rotación: `provision-instancia.sh --rotar-token <instancia>` reescribe los dos
     lados y reinicia el proceso. Sin fecha de caducidad automática: un token que
     caduca solo deja al panel ciego un martes cualquiera sin que nadie sepa por qué.
- **Criterio de aceptación:** **con el token de una instancia no se obtiene nada de
  otra**; el padre no distribuye ningún secreto compartido; rotar un token no obliga a
  tocar código ni a recompilar.
- **Comando de verificación:**
  ```bash
  curl -s -H "X-Flota-Token: $TOKEN_DE_OTRA" https://<dominio>/spaces-dooh/api/version/
  # → {"ok":true} y nada más
  ```
- **Commit sugerido:** `feat(flota): un token opaco por instancia, sin llaves de firma repartidas`
- **Riesgo y vuelta atrás:** un token filtrado revela versión y última migración de
  **esa** instancia, nada más — por eso F6.1 no devuelve nada de negocio. Vuelta
  atrás: rotarlo.

---

## FASE 6 · Visibilidad de flota

**Entorno:** PADRE (panel) + el artefacto (endpoint). **Ejecuta:** Emiliano.

---

### F6.1 · `GET /api/version` `[código]`

- **Objetivo:** que una instancia pueda decir qué versión corre, sin contar nada de su
  negocio.
- **Fase:** 6. **Depende de:** F3.1, F2.2.
- **Archivos:** `apps/web/app/api/version/route.ts` (nuevo);
  `apps/web/lib/test/version.e2e.test.ts` (nuevo); `infra/scripts/update.sh` (cambia
  `SALUD_URL`).
- **Prueba que falla primero:** cuatro casos, dos negativos.
  - sin cabecera de flota → **200** con `{ ok: true }` **y nada más**;
  - con `X-Flota-Token` correcto → `{ ok, version, ultimaMigracion, base: 'ok' }`;
  - **con token incorrecto → el cuerpo reducido**, nunca la versión;
  - **el cuerpo no contiene ningún nombre de organización ni conteo de negocio** (se
    afirma que las claves devueltas son exactamente las esperadas).
  Falla hoy: la ruta no existe (`apps/web/app/api/` no tiene `version`).
- **Pasos:**
  1. Escribir la prueba; verla en rojo.
  2. Implementar con el patrón de `app/api/auth/metodos/route.ts:4-6,29-36`:
     `runtime='nodejs'`, `dynamic='force-dynamic'`, `cache-control: no-store`.
     `version` sale de `process.env.SPACE_OS_VERSION` (la hornea el Dockerfile, F2.2);
     `ultimaMigracion`, de
     `select archivo, aplicada_en from schema_migrations order by aplicada_en desc limit 1`
     con `qRaw` — **legítimo**: `schema_migrations` es infraestructura, exenta de RLS,
     igual que `folios_consecutivos` (invariante 5).
     **Contrato completo del cuerpo con token:**
     `{ ok, version, ultimaMigracion, base: 'ok'|'error', canal, uptime }`.
     `canal` sale de `/etc/space-os/instancia.env`; `uptime`, del proceso. **Nada
     más**: ni conteos, ni nombres de organización, ni número de usuarios.
  3. Cambiar `SALUD_URL` en `update.sh` (F3.4 paso 6) a esta ruta.
- **Criterio de aceptación:** **un desconocido no obtiene la versión**; el panel, con su
  token, sí; el cuerpo no contiene ni un dato de negocio.
- **Comando de verificación:**
  ```bash
  curl -s https://demo.space-os.io/spaces-dooh/api/version/
  curl -s -H "X-Flota-Token: $TOKEN" https://demo.space-os.io/spaces-dooh/api/version/
  ```
- **Commit sugerido:** `feat(flota): cada instancia dice su version y su ultima migracion, y nada mas`
- **Riesgo y vuelta atrás:** exponer la versión facilita el trabajo de quien busque una
  vulnerabilidad conocida; por eso va tras token. **Si se prefiere pública y sin token,
  es una línea** — pero cambia el criterio de aceptación (ver **P6**).

---

### F6.2 · Panel de flota, **fuera** del artefacto `[código]`

- **Objetivo:** ver de un vistazo quién va al corriente.
- **Fase:** 6. **Depende de:** F6.1.
- **Archivos:** `apps/flota/` (workspace nuevo: `package.json`, `flota.json`,
  `estado.mjs`, `estado.test.ts`). El `package.json` raíz ya declara
  `workspaces: ["apps/*", "packages/*"]`, así que entra solo.
- **Por qué un workspace aparte:** el artefacto es idéntico para todas las instancias
  (invariante 3). Meter el panel en `apps/web` lo enviaría al servidor de cada owner,
  con la lista de la flota dentro. **No puede vivir ahí.** Y el `Dockerfile` construye
  con `--filter=web`, así que no viaja.
- **Prueba que falla primero:** unitaria sobre la parte pura: `resumen(respuestas)`
  clasifica cada instancia en `al-dia | rezagada | sin-respuesta` comparando su versión
  con la de `estable`. Falla hoy: no existe.
- **Pasos:**
  1. Escribir `estado.test.ts` con tres casos (al día, rezagada, caída); rojo.
  2. `flota.json`: lista de instancias (`nombre`, `dominio`, `canal`). **Sin tokens
     dentro**: el token va por entorno.
  3. `estado.mjs`: consulta `GET /api/version` de cada una con timeout corto, imprime la
     tabla y escribe un JSON para una página estática servida por nginx en el padre.
  4. Verde.
- **Criterio de aceptación:** **el panel no guarda ni un dato de negocio de ningún
  owner** (solo dominio, canal, versión, fecha, estado); una instancia caída se ve como
  `sin-respuesta` y no rompe la tabla.
- **Comando de verificación:** `cd apps/flota && node estado.mjs` y
  `npx vitest run estado.test.ts`.
- **Commit sugerido:** `feat(flota): el panel del padre, fuera de la imagen que corren los owners`
- **Riesgo y vuelta atrás:** el `flota.json` es un inventario de clientes; vive **solo**
  en el padre y no se publica. Vuelta atrás: borrar el workspace.

---

### F6.3 · Smoke del panel `[verificación]`

- **Objetivo:** que el panel diga la verdad.
- **Fase:** 6. **Depende de:** F6.2, F4.5.
- **Criterio de aceptación:** con DEMO al día, la tabla lo muestra `al-dia`; tras
  promover una versión nueva a `estable` y antes de que DEMO jale, `rezagada`; con DEMO
  apagada, `sin-respuesta` **y el comando sigue devolviendo 0** (un panel que revienta
  cuando una instancia se cae no sirve para vigilar).
- **Comando de verificación:** `cd apps/flota && node estado.mjs; echo "salida: $?"`
- **Commit sugerido:** `docs(flota): smoke del panel con los tres estados`

---

### F6.4 · La instancia reporta, para el día que no se la pueda consultar `[código]`

- **Objetivo:** que el panel siga sabiendo de una instancia aunque el padre **no
  pueda alcanzarla**.
- **Fase:** 6. **Depende de:** F6.1, F5.8, F6.2. **Opcional:** el panel funciona sin
  esta tarea.
- **Archivos:** `apps/flota/reporte.mjs` (receptor); `apps/flota/estado/` (destino);
  `infra/scripts/update.sh` (emisor).
- **Por qué se añade:** F6.2 resuelve la visibilidad con el padre **consultando**
  `GET /api/version` de cada instancia. Funciona mientras el owner exponga esa ruta.
  El día que un owner la cierre —y está en su derecho, es su servidor, y en el modelo
  de instancias soberanas esa es la respuesta correcta— el padre se queda ciego. El
  reporte saliente lo arregla sin que el padre entre a nada: la instancia decide qué
  cuenta y cuándo, igual que decide cuándo jala una versión.
- **Prueba que falla primero:** dos casos en `apps/flota/estado.test.ts`, uno
  negativo.
  - un reporte válido actualiza el estado de esa instancia y **solo** el de esa;
  - **un reporte con claves de más —cualquier cosa que no sea el contrato de F6.1—
    se rechaza entero**, no se guarda «lo que se entienda».
- **Pasos:**
  1. Escribir las pruebas; rojo.
  2. Emisor: al final de `update.sh` y una vez al día por cron, `POST` al padre con
     el mismo cuerpo de F6.1 más `instancia`, y su `FLOTA_TOKEN` en la cabecera.
     Con la política de reintentos de F3.8: **si falla, se guarda en disco y se manda
     en la siguiente corrida; nunca aborta el update**.
  3. Receptor en el padre: valida el token contra su inventario, valida el cuerpo
     contra el contrato, y escribe `apps/flota/estado/<instancia>.json`.
     **Archivos, no base de datos:** son diez instancias, no diez mil, y una base
     nueva en el padre es un servicio más que mantener por cero beneficio. El día que
     sean cien, se cambia el almacén sin tocar nada más.
  4. `estado.mjs` (F6.2) prefiere el reporte si es más reciente que su propia
     consulta; si no, usa el suyo.
- **Criterio de aceptación:** **el cuerpo del reporte no lleva ni un dato de
  negocio**; una instancia que nunca reporta no rompe el panel; y **el padre no abre
  ni una conexión hacia la instancia** por causa de esta tarea.
- **Comando de verificación:**
  ```bash
  cat apps/flota/estado/demo.json
  npx vitest run apps/flota/estado.test.ts
  ```
- **Commit sugerido:** `feat(flota): la instancia reporta su estado, para cuando el padre no pueda preguntarle`
- **Riesgo y vuelta atrás:** es el único camino instancia → padre que este plan abre.
  Si el padre cae, la instancia sigue operando: por eso el fallo del POST **nunca**
  aborta el update. Vuelta atrás: borrar el emisor; el panel vuelve a solo consultar.

---

## FASE 7 · Desenredar `spaces_prod` — **BLOQUEADA**

**Entorno:** droplet actual. **Ejecuta:** Carlos, **con Jochelo decidiendo**.
Solo se desarrolla F7.1, que es lectura y hace falta **para poder preguntar bien**. F7.2
y F7.3 se dejan enunciadas: mueven datos reales y §8.1 no está resuelta.

---

### F7.1 · Censo autoritativo de `spaces_prod` `[verificación]`

- **Objetivo:** saber quién vive ahí y cuánto pesa cada quien, porque **las dos fuentes
  que tenemos no coinciden**.
- **Fase:** 7. **Depende de:** F4.1. **Bloqueante de:** F7.2, F7.3 y de la decisión
  §8.1.
- **El desfase, dicho sin adornos:** el documento del 12 (§5 Fase 7) dice que los
  tenants son `rgb`, `g500` (PIXELED), `eyro` y **`emis-pruebas`**. El contexto operativo
  de esta sesión dice `g500`, `rgb`, `eyro`, **`telcel`** y **`demo-owner`**. El repo
  aporta rastros de `eyro` como tenant de pruebas
  (`docs/datos/20260810_reset_tenant_eyro.sql`) y de `g500` como PIXELED
  (`docs/datos/20260810_inc05_residuos_demo_g500.sql`, que renombró «DEMO PIXELED.» →
  «PIXELED»), pero **no dice cuántos hay hoy**. `telcel` y `demo-owner` no aparecen en el
  documento del 12. **Ninguna de las dos listas se puede dar por buena.**
- **Pasos:**
  ```sql
  -- 1. quién existe, desde cuándo
  select t.slug, t.nombre, coalesce(t.nombre_comercial,'') as comercial, t.creado_en
    from tenants t order by t.creado_en;
  -- 2. cuánto pesa cada uno (ampliar la lista según el censo de F4.1)
  select 'usuarios' tabla, tenant_id, count(*) from usuarios group by 1,2
  union all select 'sitios', tenant_id, count(*) from sitios group by 1,2
  union all select 'clientes', tenant_id, count(*) from clientes group by 1,2
  union all select 'campanas', tenant_id, count(*) from campanas group by 1,2
  union all select 'contratos_arrendamiento', tenant_id, count(*) from contratos_arrendamiento group by 1,2
  union all select 'facturas', tenant_id, count(*) from facturas group by 1,2
  order by 1,2;
  -- 3. actividad reciente: quién está vivo de verdad
  select tenant_id, max(creado_en) from acciones group by 1 order by 2 desc;
  ```
- **Criterio de aceptación:** una tabla escrita, con fecha, que diga por cada tenant:
  slug, nombre, cuándo nació, cuántas filas tiene en seis tablas clave y cuándo fue su
  última actividad. **Con eso —y no antes— se le puede preguntar a Jochelo qué hacer con
  cada uno.**
- **Comando de verificación:** el bloque SQL, como `postgres`, en solo lectura.
- **Commit sugerido:** `docs(datos): censo de spaces_prod — quien vive ahi y cuanto pesa`
- **Riesgo y vuelta atrás:** ninguno.

---

### F7.2 · Exportar un owner a su instancia — **BLOQUEADA** `[migración]`

Depende de F7.1 y de **§8.1/§8.2**. Cuando se desbloquee, la forma será: `pg_dump`
filtrado por `tenant_id` → base limpia de la instancia nueva → verificar conteos tabla
por tabla → **criterio de aceptación en negativo**: *el tenant exportado ya no puede
leerse desde la instancia vieja y ninguna fila quedó sin dueño*. No se desarrolla más
hasta que haya censo y decisión.

### F7.3 · Destino del tenant `rgb` y del droplet actual — **BLOQUEADA**

Es la decisión §8.1 en persona. Ver P1.

---

## FASE 8 · Cierre documental

**Entorno:** PADRE. **Ejecuta:** Carlos.

---

### F8.1 · ADR 0014 `[código]`

- **Objetivo:** que la decisión quede donde el repo guarda las decisiones.
- **Fase:** 8. **Depende de:** F5.4 (para describir lo que de verdad se construyó).
- **Archivos:** `docs/adr/0014-instancia-dedicada-por-owner.md` (nuevo). La numeración se
  verificó: la última es `docs/adr/0013-altas-que-no-se-pueden-duplicar.md`.
- **Prueba que falla primero:** no aplica.
- **Contenido mínimo:**
  1. Decisión: instancia dedicada por owner, con dominio de acceso propio; el
     multi-tenant por RLS queda como **mecanismo interno y defensa en profundidad**, y
     como la puerta a que un owner tenga varias unidades de negocio.
  2. Vocabulario oficial (PADRE, DEMO, instancia, flota, canal, dominio de acceso) y la
     regla de que a un owner **no se le dice «tenant»**.
  3. La regla nueva y absoluta: **nadie edita código en el servidor de una instancia**.
  4. **Nota de infra rescatada de la T3 del plan del 11:** en la zona `space-os.io`
     quedan reservados `demo`, `beta`, `panel`, `releases`, `status`, `www`. Es una nota
     de operación, **no** un `CHECK` en la base: el slug de un owner ya no es su URL.
  5. Alternativas descartadas, con su razón: subdominios `*.space-os.io` con certificado
     comodín; resolver la marca por `Host`; el candado de coherencia en `exigir()`.
  6. **Qué se promete cuando algo se rompe.** Conviene que esta tabla exista antes
     de que haga falta. Los números salen de lo que este plan construye (F3.4,
     F3.7), no de un deseo:

     | Escenario | Cómo se sale | Tiempo hasta volver | Datos que se pierden |
     |---|---|---|---|
     | Migración fallida | Rollback automático al respaldo previo (F3.4) | 5–10 min | Ninguno |
     | Health check fallido | Rollback automático al digest anterior | 10–15 min | Ninguno |
     | Datos corrompidos por un bug | Restauración manual del último respaldo | 30–60 min | Hasta 24 h |
     | El droplet desaparece | Reaprovisionar (F5.4) + restaurar de Spaces (F3.7) | 1–2 h | Hasta 24 h |
     | El padre se cae | Nada: las instancias siguen operando solas | — | Ninguno; solo se pierde el panel |

     La última fila **es la prueba del modelo**: si el padre desaparece, ningún owner
     se entera. Si algún día deja de ser cierta, el modelo se rompió.
- **Criterio de aceptación:** alguien que llegue nuevo entiende el modelo sin leer los
  dos documentos del 11.
- **Comando de verificación:** `ls docs/adr/ | tail -3`
- **Commit sugerido:** `docs(adr): 0014 — una instancia dedicada por owner, y la RLS como defensa en profundidad`

---

### F8.2 · Archivar los dos documentos del 11 `[código]`

- **Objetivo:** conservar el contexto del error sin que nadie los ejecute por descuido.
- **Fase:** 8. **Depende de:** F8.1.
- **Archivos:**
  `C:\Users\Server\Downloads\server padre\2026-08-11-subdominios-por-tenant-design.md` y
  `...-plan.md` (**viven fuera del repo**; verificado: en esa carpeta solo hay esos dos
  `.md` del 11, sin PDF).
- **Pasos:**
  1. Insertar al inicio de cada uno, en negrita: *«ARCHIVADO — 2026-08-12. Diseñado para
     un modelo de base compartida que no es el de SPACE OS. No se ejecuta. Ver
     `2026-08-12-correccion-modelo-instancias-space-os.pdf` y
     `2026-08-12-plan-instancias-v2.md`.»*
  2. **No borrarlos** (§5 Fase 8): el contexto del error también es documentación.
  3. Referenciarlos desde la ADR 0014 como historia de la decisión.
- **Criterio de aceptación:** abrir cualquiera de los dos lleva, en la primera línea, al
  documento vigente.
- **Comando de verificación:**
  `head -3 "C:\Users\Server\Downloads\server padre\2026-08-11-subdominios-por-tenant-plan.md"`
- **Commit sugerido:** no hay commit: los archivos están fuera del repo. Se anota en
  `docs/Registro_Cambios.md`.

---

### F8.3 · Poner la bóveda al día `[código]`

- **Objetivo:** que `vault/` deje de describir el mundo viejo.
- **Fase:** 8. **Depende de:** F8.1.
- **Archivos:** `vault/02-Backend/multi-tenancy-y-rls.md`,
  `vault/01-Arquitectura/entorno-y-despliegue.md`, `docs/Registro_Cambios.md`.
- **Pasos:**
  1. `multi-tenancy-y-rls.md`: conservar entera la sección «Cómo se resuelve el tenant»
     —sigue siendo exacta: *«No es por subdominio ni por cabecera. Sale de la sesión»*— y
     añadir arriba el marco nuevo: **una instancia por owner; la RLS es defensa en
     profundidad dentro de la instancia**. Corregir de paso el «21» de las tablas con
     default: son **23**.
  2. `entorno-y-despliegue.md`: hoy describe producción como un droplet único con
     `deploy.yml`, y dice que `deploy.yml` «está desactualizado». Tras F3.6 y la Fase 4
     eso ya no es cierto de ninguna manera: reescribir «Producción» como **flota**
     (padre, DEMO, instancias) y la de CI con `release.yml` / `promover.yml`.
  3. Entrada en `docs/Registro_Cambios.md` con las fases aplicadas y sus fechas.
- **Criterio de aceptación:** ningún archivo de `vault/` afirma que todas las empresas
  comparten proceso y base.
- **Comando de verificación:**
  `rg -n "una sola base|UN proceso|todas las empresas a la vez|21 tablas" vault/` → sin
  resultados, o solo dentro de secciones marcadas como historia.
- **Commit sugerido:** `docs(boveda): el modelo de instancias entra en la boveda, y produccion deja de ser un droplet`

---

# Paso 4 · Autorrevisión

## 4.1 Cobertura fase → tareas

| Fase del documento del 12 | Tareas | Estado |
|---|---|---|
| **0** · Cerrar el autoregistro fuera de DEMO | F0.1, F0.2, F0.3 | Completa |
| **1** · Migración de limpieza (23 `DEFAULT`) | F1.1, F1.2, F1.3, F1.4, F1.5 | Completa. Cubre los tres encargos de la fase (migración, auditoría previa, `campanas-repo.ts:300`) más el bug de IP que §4 manda rescatar sin asignarle fase |
| **2** · Release versionado | F2.1, F2.2, F2.3, F2.4, F2.5, **F2.6** | Completa **con el registry como parámetro**. Bloqueado solo el valor → §8.4. F2.6 (bandera fuera del build) está **condicionada a P4-bis** |
| **3** · `update.sh` + runner | F3.1 – F3.6, **F3.7, F3.8, F3.9** | Completa. F3.5 depende de la Fase 4 (P5). F3.6 es un añadido obligado por el invariante 2. F3.7–F3.9 cubren lo que un pull automático necesita para ser seguro: respaldo fuera del droplet, backoff y logs legibles sin SSH |
| **4** · Separar DEMO | F4.1, F4.2, F4.3, F4.4, F4.5 | Completa |
| **5** · `provision-instancia.sh` | F5.1 – F5.6, **F5.7 bloqueada**, **F5.8** | Completa salvo el alta real → §8.2 y §8.3. F5.8 es el token con el que el padre y la instancia se identifican |
| **6** · Visibilidad de flota | F6.1, F6.2, F6.3, **F6.4** | Completa. F6.1 crece con el contrato de salud; F6.4 añade el reporte saliente, opcional |
| **7** · Desenredar `spaces_prod` | F7.1; **F7.2 y F7.3 bloqueadas** | **Fuera de alcance más allá del censo.** Mueve datos reales y §8.1 no está decidida. F7.1 se desarrolla porque sin censo no se puede ni preguntar |
| **8** · Cierre documental | F8.1, F8.2, F8.3 | Completa |

**Total: 46 tareas.** **39 se pueden empezar hoy**; 3
bloqueadas de raíz (F5.7, F7.2, F7.3); 2 bloqueadas solo en un valor (F2.3, F2.4
esperan el nombre del registry); 1 condicionada a una decisión (F2.6, según P4-bis);
4 con dependencia de orden (F3.5, F3.6, F6.3 y F6.4 esperan a la Fase 4).

**Lo que queda fuera de alcance, dicho a propósito:**
- El portal externo por subdominio (`middleware.ts:10-12`) sigue como está. En el modelo
  de instancias, `portal.<dominio-del-owner>` exigiría un DNS y un certificado más por
  owner. **No se toca**; solo se arregla el bug de IP (F1.4).
- Facturación, planes y cuotas por owner.
- Migrar `spaces_prod` (Fase 7 más allá del censo).
- Que una instancia viva en la nube del propio owner: el script lo contempla con
  `--host`, pero el runbook de ese caso no se escribe hasta §8.3.

## 4.2 Los diez veredictos del Paso 2, en una línea

T0 **se incorpora** (F0.1-F0.3) · T1 **se descarta** · T2 **se descarta** · T3 **se
descarta como código, se incorpora como nota** (F8.1) · T4 **se descarta** · T5 **se
incorpora a medias** (F5.1; la URL se descarta) · T6 **se descarta** · T7 **se
descarta** · T8 **se incorpora ampliado** (F5.5) · T9 **se descarta** (sobrevive el
procedimiento HTTP-01, F4.3 y F5.4). Ninguno omitido.

## 4.3 Recuento de pruebas nuevas

| Nivel | Dónde | Casos |
|---|---|---|
| Unitarias (`npm test`) | `lib/entorno.test.ts` (F0.3 + F5.3 + **F2.6**) | 6 |
| | `lib/host.test.ts` (F1.4) | 5 |
| | `lib/server/campanas-repo.cupo-clientes.test.ts` (F1.3) | 1 |
| | `scripts/migrar.test.ts` — orden (F3.2) | 3 |
| | `apps/flota/estado.test.ts` (F6.2 + **F6.4**) | 5 |
| **Subtotal unitarias** | | **20** |
| Integración (`npm run test:e2e`) | `tenant-sin-default.e2e.test.ts` (F1.2) | 4 |
| | `migraciones.e2e.test.ts` (F3.1-F3.3) | 5 |
| | `alta-organizacion.e2e.test.ts` (F5.1) | 2 |
| | `bootstrap.e2e.test.ts` (F5.2) | 4 |
| | `version.e2e.test.ts` (F6.1 + **F5.8**) | 7 |
| **Subtotal integración** | | **22** |
| **Total** | | **42** |

De esos 42, **18 son negativos** (el insert que debe fallar, el tenant huérfano que no
debe existir, el bootstrap que no debe crear una segunda organización, el token que no
debe revelar la versión, la migración alterada que debe abortar). Es lo correcto: el
aislamiento se demuestra por lo que impide.

`apps/web/lib/test/aislamiento.e2e.test.ts` **no se abre en ninguna tarea**. Si alguna
obliga a editarlo, esa tarea rompió el comportamiento de hoy.

## 4.4 Las cuatro decisiones de §8: qué bloquean

Ninguna está resuelta. **No se eligió ninguna por cuenta propia.**

**P1 · Destino del tenant `rgb` y del droplet actual.** *Bloquea:* F7.2, F7.3 y el
cierre completo de la Fase 4 (si `rgb` se retira, el droplet viejo se apaga; si se
queda, necesita instancia y dominio propios). *Si «RGB Catorce tiene su instancia»:* se
añade a la Fase 5 un aprovisionamiento más y un dominio que Comercial tiene que pedir.
*Si «se retira»:* la Fase 7 se simplifica a exportar `g500` y apagar — y hay que decidir
qué pasa con el super-admin, porque el tenant de plataforma es el **más antiguo**
(`tenant.ts:26-30`) y de él cuelga hoy la capacidad de administrar a los demás.

**P2 · Fecha de migración de PIXELED.** *Bloquea:* F5.7 y F7.2. *Si es dentro del sprint
de la Fase 5:* F5.7 deja de ser un aprovisionamiento limpio y pasa a ser F7.2 (migración
de datos), con su respaldo, su ensayo y su ventana. *Si se pospone:* la primera
instancia de owner tiene que ser un owner **nuevo, sin datos previos**, o no hay primera
instancia real y todo se queda en el ensayo de F5.6.

**P3 · ¿Las instancias nacen en la cuenta DO de AS OOH o en la del owner?** *Bloquea:*
el modo por defecto de `provision-instancia.sh` (F5.4) y todo el runbook de operación.
*Si es AS OOH:* `--crear-droplet` es el camino y el padre guarda las llaves. *Si es la
del owner:* `--host` es el camino, y hay que escribir qué se le pide exactamente
(versión de Ubuntu, accesos, quién renueva el certificado, quién mira el log de
`update.sh`). *Si es owner por owner:* se documentan los dos modos y Comercial pregunta
en el onboarding, junto al dominio.

**P4 · Nombre del registry.** *Bloquea:* el valor de `vars.REGISTRY` en F2.3/F2.4 y el
`REGISTRY` del `.env` de cada instancia (F5.3). *No bloquea escribir nada.* *Si es
DigitalOcean Container Registry:* login con `secrets.DO_REGISTRY_TOKEN`, y hay que mirar
el límite de almacenamiento del plan. *Si es GHCR:* login con el `GITHUB_TOKEN` del
propio workflow y un token de solo lectura para que cada instancia jale.

**P4-bis (cae de la misma decisión, y es la contradicción más incómoda del conjunto):**
DEMO lleva `NEXT_PUBLIC_AUTOREGISTRO=1` y esa bandera **se hornea en el build**
(`aislamiento.e2e.test.ts:200-213`). Con «el artefacto es idéntico para todas las
instancias» (invariante 3), **DEMO no puede usar exactamente la misma imagen**. Las
salidas son dos: (a) publicar dos imágenes por versión, una con la bandera encendida
para el canal `beta`; (b) sacar el autoregistro de `NEXT_PUBLIC_` y decidirlo en el
servidor —como ya se hizo con `GOOGLE_OAUTH` (`.env.example:38-46`, ADR 0012 decisión 5,
que existe **exactamente por esta razón**)— y entonces una sola imagen sirve para todos.
La (b) es más limpia y tiene precedente en el repo, pero cambia el comportamiento de la
bandera: se pregunta antes de escribirla.

> La salida (b) está escrita como tarea — **F2.6**, con su prueba, su fail-closed y
> su vuelta atrás — pero **condicionada**: se ejecuta el día que Jochelo elija (b).
> Si elige (a), F2.6 se descarta y F2.3 publica dos imágenes por versión. Lo que no
> puede seguir es sin respuesta, porque la Fase 2 se construye distinta según cuál
> sea.

## 4.5 Lo que este plan NO hizo, y por qué

- No ejecutó ningún comando contra un servidor, ni `doctl`, ni `curl` a producción.
  Todos los comandos están escritos para que otro los corra.
- No tocó ni un archivo de código. Lo único que el v3 escribe en el repo es este
  documento y la nota de bóveda que lo acompaña.
- No decidió ninguna de las cuatro de §8, ni la P4-bis.
- No revivió nada del modelo de subdominios: ningún paso parsea el `Host`, resuelve
  marca por subdominio ni pide un certificado comodín.

---

# Costo y calendario

## Calendario

| Fase | Estimación del documento del 12 | Lo que pide este plan |
|---|---|---|
| 2 · Release versionado | 2–3 días | +0.5 día si se ejecuta F2.6 |
| 3 · `update.sh` + runner | 3–4 días | **+1.5 días** (F3.7, F3.8, F3.9) |
| 5 · Aprovisionamiento | 2–3 días | +0.5 día (F5.8) |
| 6 · Visibilidad de flota | 1–2 días | +0.5 día (F6.4, opcional) |

Las estimaciones del documento del 12 suman **13 días hábiles en secuencia** y
suponen paralelismo perfecto entre dos personas. Con el detalle de estas 46 tareas y
los 2 a 3 días de las que se añaden, la cifra realista para las fases 0–6 es de
**3 a 4 semanas de calendario**, con dos personas dedicadas y las decisiones
respondidas desde el día uno. **La Fase 7 queda fuera de esa cuenta.**

## Costo mensual

Precios de lista de DigitalOcean, en dólares y sin impuestos. La cuenta no se
consultó desde aquí: los números reales salen de `doctl compute droplet list
--format Name,Memory,VCPUs,PriceMonthly` y de la factura del mes.

| Concepto | Mensual |
|---|---|
| Droplet PADRE (1 GB) + DEMO (2 GB) + backups de ambos | $21.60 |
| Container Registry Basic, 5 GB | $5 |
| Snapshot de la imagen base | ≈ $1.50 |
| Respaldos en Spaces (F3.7), 30 días de retención | $5 |
| Logs en Spaces (F3.9), 90 días | $0 — mismo bucket |
| Almacén del panel de flota | $0 — F6.4 guarda archivos JSON; diez instancias no necesitan un Postgres aparte |
| **Total, antes del primer owner** | **≈ $33** |

Cada instancia de owner añade **≈ $15** (droplet de 2 GB más backups). Su dominio y
su DNS los paga el owner; el certificado de Let's Encrypt es gratis. Los cinco
dólares del respaldo en Spaces son la mejor compra del plan: son los que hacen que
un respaldo sobreviva a la muerte de su droplet.

---

# Preguntas abiertas

**P1.** ¿Qué pasa con el tenant `rgb` y con el droplet actual? (§8.1) — *bloquea F7.2,
F7.3 y el cierre de la Fase 4.*

**P2.** ¿Fecha objetivo para migrar PIXELED? (§8.2) — *bloquea F5.7 y F7.2.*

**P3.** ¿Las instancias nacen en la cuenta DO de AS OOH o en la del owner, o se decide
caso por caso? (§8.3) — *bloquea el modo por defecto de F5.4 y el runbook de operación.*

**P4.** ¿Nombre del registry? (§8.4) — *no bloquea escribir F2.3/F2.4, solo su valor.*
**Y con ella:** ¿DEMO lleva una imagen propia con el autoregistro horneado, o se saca
`NEXT_PUBLIC_AUTOREGISTRO` del build y se decide en el servidor, como se hizo con
`GOOGLE_OAUTH`? Sin respuesta, «el artefacto es idéntico para todas las instancias» y
«el autoregistro solo en DEMO» no pueden ser ciertos a la vez.

**P5.** *(técnica, de seguridad)* La Fase 3 dice «se instala y ensaya primero en DEMO» y
la Fase 4 es la que **crea** DEMO. Confirmar que «DEMO» ahí significa el droplet
**nuevo** de la Fase 4 y **no** el actual —que hoy es también la producción de los
tenants reales—. Este plan lo asumió así (F3.5 depende de F4.5). Si fuera el actual, el
ensayo del release roto tocaría datos reales.

**P6.** *(técnica)* ¿`GET /api/version` va tras un token de flota (lo que este plan
propone) o completamente pública? Cambia el criterio de aceptación de F6.1 y el
`SALUD_URL` de `update.sh`.

**Además, dos desfases que hay que resolver con datos antes de la Fase 7:** la lista de
tenants del documento del 12 (`rgb, g500, eyro, emis-pruebas`) **no coincide** con la del
contexto operativo (`g500, rgb, eyro, telcel, demo-owner`); ninguna de las dos se puede
dar por buena y **F7.1 es lo que las sustituye**. Y el commit `2f28be0` avisa de que
`main` lleva una migración que producción no tiene: **F4.1 tiene que decir cuál**.
