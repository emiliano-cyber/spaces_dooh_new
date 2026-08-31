# SPACE OS — contexto del proyecto para agentes

Este archivo es lo primero que lee un agente que abre el repositorio. No explica el
producto: explica **dónde está escrito todo lo demás**, cómo está organizado y qué
reglas manda respetar antes de escribir la primera línea.

Si buscas cómo funciona el sistema, no lo busques aquí — está en la bóveda
(`vault/`), y este documento te dice cómo leerla.

---

## 1 · Las dos documentaciones, y para qué sirve cada una

El repositorio tiene **dos** cuerpos de documentación con propósitos distintos.
Confundirlos es el error más común al llegar.

| | `vault/` — la bóveda | `docs/` — los documentos |
|---|---|---|
| **Responde a** | ¿Cómo funciona esto **hoy**? | ¿Qué decidimos, qué cambió, cómo se opera? |
| **Naturaleza** | Descriptiva. Un espejo del código | Histórica y prescriptiva. Se acumula |
| **Caduca** | **Sí**, y rápido. Ver §5 | No: un ADR de julio sigue siendo válido como registro |
| **Formato** | Notas enlazadas entre sí, con frontmatter | Archivos sueltos: ADR, planes, runbooks, bitácora |
| **Se lee** | Antes de tocar código | Cuando necesitas el porqué de una decisión |

En `docs/` viven: los **ADR** (`docs/adr/`, van por la **0024**), los **planes**
(`docs/Plan_*.md`), los **runbooks**, las **correcciones de datos en producción**
(`docs/datos/`, cada una con su rollback capturado antes) y la **bitácora**
(`docs/Registro_Cambios.md`), que está escrita para quien no programa.

---

## 2 · La bóveda de Obsidian

### Qué es, técnicamente

**57 notas Markdown** en `vault/`, enlazadas entre sí con wikilinks. Está pensada
para abrirse con Obsidian, pero **no hay carpeta `.obsidian/` en el repositorio**:
no se versiona configuración de la herramienta. Consecuencia práctica: la bóveda es
Markdown puro y **se lee igual desde un editor, desde `cat` o desde un agente**. No
necesitas instalar nada.

Al 2026-08-28 tenía **753 enlaces internos, 0 rotos y 0 notas huérfanas** sobre
57 notas. Las mediciones previas daban 606 sobre 48 (17/08) y 395 sobre 43
(10/08): crece con el diario y con las notas de la ejecución del plan v3.

### La estructura

```
vault/
├── 00-Indice/        MOC-Proyecto · glosario · preguntas-abiertas
├── 00-Inventario/    inventario-2026-08-11 (base de los manuales)
├── 01-Arquitectura/  vision-general · stack-y-dependencias ·
│                     entorno-y-despliegue · decisiones ·
│                     modelo-instancias-soberanas
├── 02-Backend/       _indice + 10 notas: api-endpoints, autenticacion-y-sesion,
│                     multi-tenancy-y-rls, inventario-y-sitios,
│                     arrendadores-y-contratos, comercial-propuestas-campanas,
│                     operaciones-y-ot, finanzas-y-cobranza,
│                     integraciones-externas, infraestructura-servidor
├── 03-Frontend/      _indice + shell-y-navegacion · acceso-y-sesion-ui ·
│                     modulos-internos · paginas-publicas ·
│                     estado-y-data-fetching
├── 04-Datos/         esquema · migraciones
├── 05-Flujos/        flujo-login · flujo-acceso-con-google ·
│                     flujo-propuesta-a-campana ·
│                     flujo-facturacion-y-cobranza · flujo-orden-de-trabajo
├── 06-Operacion/     zonas-de-riesgo · convenciones ·
│                     verificacion-de-produccion
├── 07-Agentes/       AGENTES · tablero · diario/ (una nota por día)
└── 08-Manuales/      manual-tecnico
```

El prefijo numérico impone el orden de lectura natural: índice → arquitectura →
capas → datos → flujos → operación. Las carpetas con muchas notas llevan un
`_indice.md` propio.

### El punto de entrada

**`vault/00-Indice/MOC-Proyecto.md`** es el mapa de contenidos. Su promesa de diseño
es que **desde ahí se llega a cualquier nota en un salto**. Empieza siempre por él.

Trae además la tabla de identidad del producto — cada dato con su evidencia en
código, no de memoria:

| Dato | Valor | Evidencia |
|---|---|---|
| Producto vivo | Una sola app Next.js con BFF integrado | `ecosystem.config.js:1-3` |
| Framework | Next.js 14.2.29, App Router | `apps/web/package.json:17` |
| Base de datos | PostgreSQL, `pg` directo (sin ORM) | `apps/web/lib/server/db.ts:2` |
| Aislamiento | RLS de Postgres por `app.tenant_id` | `apps/web/lib/server/db.ts:54-69` |
| Endpoints | **90** route handlers | `apps/web/app/api/**/route.ts` |
| Tablas | **39** | `vault/04-Datos/esquema.md` |
| Migraciones | **74** | `vault/04-Datos/migraciones.md` |

> Esos recuentos llevan fecha de validación **2026-08-28**. Trátalos como una
> afirmación con fecha, no como una verdad permanente — §5 explica cómo
> reverificarlos.
>
> **Este archivo ya los tuvo mal, y por eso conviene decirlo aquí:** entre el
> 10/08 y el 28/08 arrastró seis cifras desfasadas —endpoints, tablas,
> migraciones, notas, enlaces y el número de ADR— **mientras la bóveda estaba
> al día**. Es el sitio que más caro cuesta tener mal: es lo primero que lee un
> agente, y arranca con seis números falsos antes de abrir una sola nota.

### Cómo está escrita cada nota

Todas llevan **frontmatter** YAML con la misma forma:

```yaml
---
tipo: arquitectura        # moc · arquitectura · operacion · contrato · tablero · ...
estado: verificado        # verificado | en-curso
actualizado: 2026-08-13   # fecha de la última validación contra el código
tags: [instancias, despliegue, flota]
archivos:                 # los archivos reales que la nota describe
  - db/schema.sql
  - apps/web/middleware.ts
---
```

El campo **`actualizado:`** es el que da o quita autoridad a la nota: dice hasta
cuándo se comprobó contra el código. El campo **`archivos:`** permite el camino
inverso — saber qué nota describe el archivo que estás por tocar.

Dentro del cuerpo:

- **Wikilinks** entre notas, con dobles corchetes y el nombre del archivo sin
  extensión. Los que apuntan a subcarpeta llevan la ruta (`02-Backend/_indice`).
- **Citas con `archivo.ts:línea`** por todas partes. Es la convención más valiosa de
  la bóveda y también la más frágil: ver el aviso de §5.
- **Callouts de Obsidian** (`> [!warning]`, `> [!danger]`, `> [!important]`,
  `> [!tip]`, `> [!note]`) para separar lo obligatorio de lo informativo. Se leen
  bien en texto plano aunque no los renderice nada.

---

## 3 · Lectura obligatoria antes de escribir código

El propio MOC lo marca como obligatorio, en este orden:

1. **`vault/07-Agentes/AGENTES.md`** — el contrato de trabajo en paralelo.
2. **`vault/06-Operacion/zonas-de-riesgo.md`** — qué es ROJO, AMARILLO y VERDE.
3. **`vault/07-Agentes/tablero.md`** — qué zonas están tomadas ahora mismo.

### AGENTES — las cinco reglas

1. **Reclama tu zona en el tablero antes de escribir.** Si está tomada, elige otra
   tarea; no esperes.
2. **Una rama por agente.** Nunca commitees en la rama de otro, nunca rebases
   trabajo ajeno.
3. **Commits pequeños.** Uno por cambio coherente.
4. **La nota de la bóveda se actualiza en el MISMO commit que cambia el código.**
5. **Si tu cambio toca sesión, tenant, migración o dinero → es ROJO.** Para y pide
   aprobación humana.

El código está particionado en **12 zonas** (`Z1 · Auth` … `Z12 · Docs`), derivadas
de qué archivos cambian juntos, con **dueño único a la vez**. Aparte hay una lista
de **archivos de alto contacto** que se reclaman por separado aunque estés en otra
zona, porque tocarlos bloquea a los demás: `middleware.ts`, `next.config.mjs`,
`lib/server/db.ts`, `lib/server/auth.ts`, `lib/server/errores.ts`, `lib/modulos.ts`,
`components/demo/shell/nav.ts`, `db/schema.sql`, `package.json` y
`docs/Registro_Cambios.md`, entre otros.

### Zonas de riesgo — la regla de oro

> Si el cambio toca **sesión, tenant, migración o dinero**, es ROJO aunque parezca
> de una línea.

Las seis zonas rojas son: autenticación y sesión (R1), aislamiento entre
organizaciones por RLS (R2), migraciones ya aplicadas en producción (R3), dinero
irreversible (R4), borrados en cascada (R5) y configuración de nginx y del proceso
(R6).

**R2 merece atención especial porque su modo de fallo no da error**: usar `qRaw`
donde tocaba `q` hace que una consulta devuelva cero filas en silencio, o datos de
otra empresa. Ya pasó dos veces, y una dejó el desbloqueo de usuarios inservible un
despliegue entero.

> **Las pruebas unitarias no ven los fallos de RLS**: simulan la base. Los dos
> peores fallos de aislamiento del proyecto pasaron las unitarias sin despeinarse.
> Todo lo que toque tenant o sesión necesita `cd apps/web && npm run test:e2e`.

---

## 4 · Convenciones que el código da por supuestas

Están completas en `vault/06-Operacion/convenciones.md`. Lo mínimo:

- **Todo en español**: archivos, funciones, variables, columnas, comentarios y
  mensajes de error. Los únicos anglicismos son los del framework (`page.tsx`,
  `route.ts`) y los del dominio (DOOH, spot).
- **Capas fijas**: `route.ts` → `*-controller.ts` → `*-repo.ts` → `db.ts`. El SQL
  vive en el repo, nunca en el route, y siempre parametrizado. Toda operación por
  `id` lleva `and tenant_id = $n` como segunda capa sobre la RLS.
- **Los comentarios explican el porqué, no el qué**, y documentan el fallo que
  motivó la decisión. Media docena de comentarios de este repo son lo único que
  impide que el mismo error vuelva: no se borran al refactorizar.
- **Commits convencionales en español y sin acentos**:
  `fix(seguridad): el desbloqueo leia usuarios sin contexto de tenant`. El cuerpo se
  usa de verdad: explica el porqué, lo que apareció al hacerlo y qué se verificó.
- **Dos suites, y las dos se corren desde `apps/web/`**: `cd apps/web && npm test`
  (unitarias, sin Docker) y `cd apps/web && npm run test:e2e` (integración contra
  Postgres real en el 5433, en serie, contra un Next real en el puerto 3311).

> [!warning] No copies de aquí un recuento de pruebas — mídelo
> **Crecen con cada tarea.** De 789 el 12/08 a **1005 en 94 archivos** el 28/08,
> y las e2e de 12 a **29 archivos**. Cualquier cifra escrita aquí caduca al
> siguiente commit, y **este archivo ya la tuvo mal tres veces** — la última
> arrastró seis recuentos desfasados durante dieciocho días **mientras la bóveda
> estaba al día**. Si necesitas el número, córrelo:
> `cd apps/web && npm test`.
>
> **Y ojo con dónde lo corres:** cada worktree está en una rama distinta y da un
> recuento distinto. Mídelo en el mismo árbol donde vas a trabajar, no en otro.
- **Migraciones** `YYYYMMDD_descripcion.sql`, transaccionales e idempotentes. **No
  se edita una ya aplicada** y **no se toca `db/schema.sql` directo**.
- **La bitácora es parte del trabajo**: si el cambio se nota desde la aplicación,
  tiene entrada en `docs/Registro_Cambios.md`, en lenguaje llano.

> [!warning] Los scripts de pruebas NO existen en la raíz del repo
> `test`, `test:e2e` y `typecheck` viven en `apps/web/package.json`. Corridos desde
> la raíz devuelven `npm error Missing script`, que es fácil de confundir con «el
> entorno está roto». La raíz solo tiene `build`, `dev`, `lint`, `format` y
> `check-types` (este último delega en turbo). **Antepón siempre `cd apps/web`.**

> [!danger] Las e2e exigen un build de Next hecho ANTES, o fallan las 12 en falso
> `apps/web/lib/test/servidor-e2e.ts:31` arranca el servidor con `npx next start`,
> que **reutiliza el build existente y no construye nada**. En un worktree recién
> clonado no hay `.next/BUILD_ID`, así que **todos** los archivos e2e mueren con «El
> servidor de pruebas no respondió … tras 60 s» — y tardan **636 s** en hacerlo.
> El rojo no dice nada del código: dice que falta el build.
>
> ```
> cd apps/web && npm run build && npm run test:e2e   # 61 s con el build hecho
> ```
>
> Comprobado el 2026-08-13, y otra vez el 28/08 al abrir un worktree nuevo
> desde `main`: el síntoma es idéntico y sigue sin decir nada del código.

### La trampa del orden de migraciones

El orden **no es lexicográfico puro**. El mapa `ANTES_DE` con las dos excepciones
reales vive en **`scripts/migrar.mjs:61`** desde el 17/08 (F3.2) y se declara una
sola vez: `apps/web/lib/test/db-e2e.ts` tenía una copia y ahora importa
`ordenar()` de ahí (`db-e2e.ts:165`). Cualquier cosa que aplique migraciones tiene que reproducir
ese orden o una base nueva no levanta.

### Las bases son de PRUEBAS — incluida la de producción

> **Corregido el 2026-08-19 por Jochelo.** Hasta esa fecha este apartado afirmaba que
> el 5433 tenía «datos reales» y prohibía borrar. **Era falso**, y esa frase hizo que
> media docena de ensayos se ataran las manos sin necesidad.

`db/docker-compose.yml` levanta Postgres en el **5433** con la base `spaces`. Esa base,
la de integración (`spaces_e2e`) y **también `spaces_prod` en el droplet** son **datos de
prueba**: se pueden reiniciar y borrar si conviene, y **preguntar antes ya no hace falta**.

Consecuencia práctica más importante: **una migración contra producción no arriesga datos
de clientes**, así que se puede ensayar contra ella. Lo que sí sigue costando es el tiempo
de dejar el servicio caído, y eso no lo cambia nada de esto.

> [!warning] El guard del arnés se queda, y no es una contradicción
> El arnés **sigue negándose a apuntar a una base cuyo nombre no acabe en `_e2e` o
> `_test`**, porque `recrearEsquema()` hace `drop schema public cascade` y ese guard evita
> el borrado **accidental** —el que nadie decidió—. Que los datos sean de prueba no
> significa que convenga perderlos a mitad de una corrida sin enterarse. **No lo
> desactives**: si quieres reiniciar una base, hazlo a propósito y por su nombre.

---

## 5 · La bóveda caduca — y cómo comprobarlo

Es su propiedad más importante y la que más fácil se olvida. Se escribió el 07/08 y
**en cinco horas quedaron obsoletas cuatro afirmaciones**. Última validación
completa contra el código: **2026-08-10**.

`convenciones.md` documenta cuatro chequeos mecánicos, que hay que correr al retomar
el proyecto tras unos días y siempre después de un lote grande de commits:

1. **Los recuentos cuadran** — endpoints, migraciones y tablas contra lo que afirman
   el MOC, `api-endpoints`, `esquema` y `migraciones`.
2. **Todo wikilink resuelve y ninguna nota queda huérfana.**
3. **Toda ruta citada existe** — ojo: las rutas se escriben relativas al repo *o* a
   `apps/web`, hay que probar las dos bases; y `Test-Path` trata `[id]` como comodín,
   así que hace falta `-LiteralPath` o dan falsos negativos todas las rutas
   dinámicas de Next.
4. **Los números de línea no han derivado** — el que más deriva encuentra y el único
   que no es binario.

> **Un archivo que crece invalida todas sus citas de golpe.** `lib/server/auth.ts`
> pasó de 188 a 230 líneas al añadir una función, y con eso **ocho citas de cinco
> notas distintas** apuntaron a la línea equivocada. Ninguna daba error: solo
> mandaban al sitio erróneo.

Y lo que ningún script detecta: que una nota describa correctamente algo que **ya se
decidió de otra forma**. Para eso, `git log --since` y la bitácora desde la fecha
del último `actualizado:`.

### Aviso vigente sobre otra documentación

`README.md` en la raíz **está desactualizado**: describe un backend Fastify
(`apps/api`), rutas `/var/www/spaces-dooh` y despliegue automático en cada push.
Nada de eso es cierto. La pista Fastify/Prisma está archivada en `_archive/api`.
Hay **una sola pista viva**: `apps/web`, Next con BFF integrado sobre `db/schema.sql`.

---

## 6 · Ramas: dónde se trabaja qué

**Todo el trabajo de instancias soberanas está en `main` desde el 2026-08-28**
(PR #10, 310 commits). La rama `feat/servidor-padre-instancias` y su worktree
`.claude/worktrees/servidor-padre` **ya no existen**: se retiraron al aterrizar.

> Si un documento te manda entrar a ese worktree, está viejo. Y si te dice que el
> trabajo de instancias «no va en la rama principal», eso era cierto hasta el
> 28/08: se aisló mientras estaba a medio hacer, y se fusionó cuando dejó de
> estarlo.

| Rama | Worktree | Para qué |
|---|---|---|
| **`main`** | — | **La base, y donde vive el trabajo de instancias.** Protegida por `ci.yml` (typecheck + test + build) y `lockfile-check.yml` |
| `feat/ui-base-404-atajos` | raíz del repo | UI base y atajos del 404 |
| **`chore/retirar-scripts-pista-archivada`** | — | **F5.5, preparada y SIN FUSIONAR.** Depende de F3.6, que espera el registry. **No la borres** |
| `docs/manual-usuario-y-reglas-agentes` | — | Ya absorbida; redundante |

### Cómo se trabaja ahora

Una rama por tarea, salida de `main`, y **PR en vez de fusión local**. El motivo
no es ceremonia: `ci.yml` corre typecheck, pruebas y build **en una máquina
limpia**, que es una verificación independiente de la que hagas tú aquí. Los dos
merges del 28/08 se hicieron así.

```powershell
cd C:/Users/Server/spaces_doohmain_nueva
git fetch emiliano main:main
git worktree add -b <tipo>/<asunto> .claude/worktrees/<asunto> main
cd .claude/worktrees/<asunto>
npm install
copy ../../../apps/web/.env       apps/web/.env
copy ../../../apps/web/.env.local apps/web/.env.local
cd db; docker compose up -d      # Postgres de desarrollo en el 5433
```

Sin `node_modules` ni `.env` no corre ni la primera prueba.

> [!warning] El worktree raíz está en `feat/ui-base-404-atajos`, no en `main`
> No cambies de rama ahí para trabajar: abre un worktree. Y como `main` no está
> desplegado en ninguno, para actualizarlo se usa `git fetch emiliano main:main`,
> que no necesita checkout.

### El PADRE despliega desde `main`

Desde el 28/08, `/var/www/Spaces` en `137.184.107.53` está en `main`. Antes
seguía a `feat/servidor-padre-instancias`, y dejarlo así habría hecho que sus
`git pull` no trajeran nada **sin dar ningún error**.

Y la secuencia de despliegue **ya no es `pm2 restart`**: la aplicación la arranca
systemd como el usuario `padre`. Está en
`vault/01-Arquitectura/entorno-y-despliegue.md` y en
`docs/evidencias/padre-fuera-de-root-20260828.md` §5.

### Remotos — cuidado con este

| Remoto | URL | Estado |
|---|---|---|
| **`emiliano`** | `emiliano-cyber/spaces_dooh_new` | **El vivo.** Aquí se empuja |
| `origin` | `CarlosMend87/spaces-dooh` | **Muerto: 408 commits atrás.** No empujar |

---

## 7 · Estado del trabajo de instancias soberanas

El modelo aprobado el 2026-08-12 sustituyó al diseño anterior de subdominios por
tenant. **Un solo código, muchas instancias**: cada owner corre su copia completa en
su propio droplet, con su base y su dominio. Se trabaja una vez en el **PADRE**, se
prueba en **DEMO**, y cada instancia jala la versión estable. La RLS no desaparece:
queda como defensa en profundidad dentro de cada instancia, pero deja de ser el
modelo de negocio.

El contexto completo —qué cambió, qué costó, qué está bloqueado y por quién— está en
**`vault/01-Arquitectura/modelo-instancias-soberanas.md`**.

### Cuál es el plan vigente

> **Ojo, hay dos y solo uno manda.** `docs/Plan_Instancias_Soberanas_v3.md` es el
> vigente: **46 tareas**, marcado *aprobado para ejecución* el 2026-08-13, y declara
> en su cabecera que **sustituye al v2**, que queda archivado. El v2
> (`Plan_Instancias_Soberanas_v2.md`, 40 tareas, commit `9e244c7`) sigue en `docs/`
> como historia. Si una instrucción cita 40 tareas, viene del plan viejo.

`docs/prompt-ejecucion-plan-v3.md` trae cómo se arranca una sesión de ejecución.

### Reglas de esa ejecución

- **Una tarea = un commit**, en el orden del plan, respetando su campo «Depende de».
- **TDD literal**: primero la prueba que la tarea describe, **en rojo y a la vista**;
  la implementación va en un paso separado.
- Al terminar, se corre el **comando de verificación exacto** de la tarea. No se
  parafrasea ni se sustituye.
- **Nada de `ssh`, `doctl` ni `curl` contra producción.** Cuando una tarea pide un
  comando contra un servidor, se escribe para que lo corra una persona.
- **`apps/web/lib/test/aislamiento.e2e.test.ts` tiene que pasar sin tocarse.** Si una
  tarea obliga a abrirlo, esa tarea está mal.
- **No se replanea.** Si el repositorio contradice una tarea, se para y se muestra la
  evidencia con `archivo:línea`.

### Lo que está detenido — al 2026-08-31

**El proyecto ya no está limitado por trabajo, sino por decisiones.** De las 10
tareas que quedaban con objeto, **9 esperaban el nombre del registry de imágenes**.
Ese nombre llegó el 31/08 y **F2.3 se cerró el mismo día, con imagen publicada**.
Y la auditoría de esa tarde encontró que **F5.3 y F5.4 ya estaban hechas** —el
trabajo se hizo en las siete semanas de la rama larga y el tablero no lo recogió—:
**quedan 7**, y la Fase 5 va por **5 de 8**, no 3. Evidencia medida en
`docs/evidencias/auditoria-f5-31-agosto.md`. Y con **F8.2** hecha esa misma tarde,
**la Fase 8 queda completa** y bajan a **6**.

> [!success] 2026-08-31 · el registry existe
> **`registry.digitalocean.com/registryspaces`**, NYC3, **plan gratuito** (500 MiB,
> un repositorio). Lo que queda de esas 9 no es decidir: es que **una persona ponga
> las tres claves y empuje la primera etiqueta** —
> `docs/evidencias/registry-TH-P4b.txt`, que **sustituye a `registry-TH-P4.txt`**.
>
> El nombre **no se quema en ningún workflow ni script**: entra por `vars.REGISTRY`.
> Los workflows ya están escritos y **paran en seco cuando faltan las variables, a
> propósito** (`release.yml:183-189`).
>
> **Y ya está medido**: con `v0.0.1-rc2` dentro, el registro marca **11 %** de
> 500 MiB, o sea **~55 MiB** la primera versión completa. **El plan gratuito
> sobra y no hay que subir a Basic.** Lo que falta por saber es el **coste
> incremental**, que es el número que manda: las versiones comparten capas, así
> que la segunda dirá si cada release cuesta ~6 % (caben ~15) o ~11 % (caben ~9).
> Se lee en el mismo sitio tras el próximo `release.yml`.

> [!success] 2026-08-31 · F2.3 CERRADA — la primera imagen existe
> `v0.0.1-rc2` publicada en el canal `beta`, digest `sha256:12089fb4…`, con
> **1009 unitarias y 295 e2e en verde**. Detalle del recorrido en
> [[01-Arquitectura/entorno-y-despliegue]].
>
> **La Fase 2 pasa a 5 de 6.** Lo único que le falta es **F2.4**, y esa no la
> desbloquea el registry: espera la decisión de qué dirección representa a DEMO.

Fases cerradas: **0, 1, 4, 6 y 8**. La 2 en 5 de 6, la 3 **completa** y la 5 en 6 de 8
tras cerrarse **F3.6** y **F5.5** el 31/08. **Quedan 4**: F2.4, F3.5, F5.6 y F5.7 —
y las cuatro dependen, directa o indirectamente, de convertir DEMO en una instancia.

> [!tip] El siguiente paso concreto es un censo de solo lectura
> `docs/evidencias/censo-demo-en-el-padre.txt`. Comprueba en el servidor lo que la
> revisión del 31/08 dedujo del repositorio. **Sin esa confirmación no se diseña la
> conversión de DEMO**: sería construir sobre una premisa sin medir.

> [!important] Antes de tomar la siguiente tarea, lee la revisión del 31/08
> `docs/evidencias/revision-fases-31-agosto.md`. **El plan v3 es del 13 de agosto y
> describe una arquitectura que cambió el 27 y el 28**: tres de las seis tareas que
> quedan tienen la ficha desalineada con el repositorio.
>
> Lo más importante que encontró: **el cuello de botella es uno solo, y no es una
> decisión.** DEMO **no es una instancia** —corre `next start` desde el repo
> clonado (`infra/systemd/spaces-demo.service:77`), no desde la imagen—, y por eso
> **F3.5 no se puede ejecutar** (`update.sh` actualiza contenedores) y **F2.4
> tampoco** (`promover.yml:127-129` exige una `DEMO_URL` con `https`, y DEMO no
> tiene nombre desde el ADR 0024). **Las dos se destraban con el mismo trabajo.**

> **De las 6 que quedan, ninguna es trabajo de codigo en la maquina de desarrollo.**
> Cuatro son de servidor (F3.5, F3.6, F5.6, F5.7), una espera la decision de DEMO
> (F2.4) y **F5.5** es una rama ya preparada (`chore/retirar-scripts-pista-archivada`)
> que solo espera a F3.6.

> [!danger] La Fase 7 ya no existe, y seis tareas más quedaron sin objeto
> El **ADR 0023** (27/08) sacó el droplet viejo del modelo al confirmarse que
> **sus datos eran de prueba**. Con eso `F0.2`, `F1.1`, `F1.5`, `F7.1`, `F7.2` y
> `F7.3` dejaron de tener sentido — no se cancelaron, perdieron su objeto. Y el
> **ADR 0024** dejó sin objeto `F4.3`. **El plan pasa de 46 tareas a 39.**
>
> Si un documento te habla del censo de `spaces_prod`, del destino del tenant
> `rgb` o de migrar PIXELED, describe un problema que **ya no existe**.

**Queda UNA decisión abierta** — la primera se cerró el 31/08:

1. ~~**El nombre del registry.**~~ **CERRADA el 2026-08-31**: `registryspaces`,
   NYC3, plan gratuito. Tarjeta vigente:
   `docs/evidencias/registry-TH-P4b.txt`.
2. **Qué dirección representa a DEMO** para el smoke de promoción. Y ojo, porque
   es fácil darla por resuelta con la anterior: `promover.yml:120-134` exige
   `DEMO_URL` y valida contra ella **antes** de promover. Apuntarla a
   `demo.space-os.io` haría que el smoke **validara la máquina equivocada**, que
   corre código del 11/08. **`F2.4` no se desbloquea con el registry.**

> **P4-bis quedó resuelta** el 14/08: la bandera del autoregistro salió del build
> (`F2.6`) y cambió de polaridad — ahora **solo `AUTOREGISTRO=1` enciende**, y
> ausente significa apagado. El artefacto vuelve a ser idéntico para toda la
> flota, que era la contradicción.

---

## 8 · Antes de pedir un merge

La lista está en `AGENTES.md`:

- [ ] Zona liberada en el tablero
- [ ] `cd apps/web && npm run typecheck` limpio
- [ ] `cd apps/web && npm test` en verde
- [ ] `cd apps/web && npm run test:e2e` si tocaste auth, tenant, dinero o migraciones
- [ ] Nota de la bóveda actualizada **en el mismo commit**
- [ ] Entrada en la bitácora, si se nota desde la aplicación
- [ ] Ningún secreto en el diff

---

## Corridas nocturnas — modelo de instancias soberanas

El plan vigente es el v3 (`docs/Plan_Instancias_Soberanas_v3.md`). El reparto de trabajo nocturno
vive en `docs/noche/PLAN-NOCHE.md`; se lanza con `/noche` y se reanuda con `/noche continuar`.

Reglas que aplican a cualquier sesión en este repo, no solo de noche:

- **Nadie edita código en el servidor de una instancia.** Todo nace en el PADRE. El update es pull.
- **No se toca** `apps/web/lib/test/aislamiento.e2e.test.ts` (invariante 7), ni
  `apps/web/lib/test/servidor-e2e.ts`, ni `db/schema.sql` directo (los cambios van por migración).
  Si una tarea obliga a abrirlos, esa tarea rompió el comportamiento de hoy: se para y se dice.
- **Los 14 invariantes** están en la §3 de `docs/noche/PLAN-NOCHE.md`. Se leen antes de tocar
  código de multi-tenancy, altas, migraciones o infraestructura.
- **Prueba primero, en rojo.** Una tarea sin su rojo demostrado no está hecha. Los casos negativos
  son el corazón: el aislamiento se demuestra por lo que impide.
- **Commits en español**, `tipo(ámbito): descripción en minúscula`. Uno por tarea con sentido.
- **Nunca** `ssh`, `curl` a producción, `doctl`, `psql` contra un servidor, `certbot`, `pm2`,
  `git push`, `git tag`, `gh`. Los comandos contra servidores se escriben para que los corra una
  persona. Las tareas de servidor que quedan (**F3.5, F3.6, F5.6, F5.7**) las corre una persona.
  `F4.5` y `F6.3` ya se cerraron, y la **Fase 7 dejó de existir** (ADR 0023).
- **Las decisiones de negocio no las decide Claude.** Quedan dos abiertas: el **nombre del
  registry** y **qué dirección representa a DEMO** para el smoke de promoción (§7). En modo
  desatendido se aparca la tarea y se escribe la entrada en `docs/noche/DECISIONES-<fecha>.md`.
  Aparcar la tarea, nunca la noche. Y nunca elegir "lo razonable" para no perder tiempo.
- **Ningún valor real quemado** en archivos versionados: ni dominios, ni IPs, ni tokens, ni el
  nombre del registry. Van como parámetro (`REGISTRY`, `__DOMINIO__`).
