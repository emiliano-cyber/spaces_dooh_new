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

En `docs/` viven: los **ADR** (`docs/adr/`, van por la 0013), los **planes**
(`docs/Plan_*.md`), los **runbooks**, las **correcciones de datos en producción**
(`docs/datos/`, cada una con su rollback capturado antes) y la **bitácora**
(`docs/Registro_Cambios.md`), que está escrita para quien no programa.

---

## 2 · La bóveda de Obsidian

### Qué es, técnicamente

**48 notas Markdown** en `vault/`, enlazadas entre sí con wikilinks. Está pensada
para abrirse con Obsidian, pero **no hay carpeta `.obsidian/` en el repositorio**:
no se versiona configuración de la herramienta. Consecuencia práctica: la bóveda es
Markdown puro y **se lee igual desde un editor, desde `cat` o desde un agente**. No
necesitas instalar nada.

Al 2026-08-17 tenía **606 enlaces internos, 0 rotos y 0 notas huérfanas**.
La medición del 10/08 daba 395 enlaces sobre 43 notas: crecio con el diario y
con las notas de la ejecucion del plan v3.

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
| Endpoints | 88 route handlers | `apps/web/app/api/**/route.ts` |
| Tablas | 38 | `vault/04-Datos/esquema.md` |
| Migraciones | 66 | `vault/04-Datos/migraciones.md` |

> Esos recuentos llevan fecha de validación **2026-08-10**. Trátalos como una
> afirmación con fecha, no como una verdad permanente — §5 explica cómo
> reverificarlos.

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
> **Crecen con cada tarea.** En `feat/servidor-padre-instancias` pasaron de 789 a
> **803** unitarias en dos días, y las e2e de 12 a 13 archivos. Cualquier cifra
> escrita aquí caduca al siguiente commit, y **este archivo ya la tuvo mal dos
> veces** — la segunda con la fecha de hoy encima, que es peor que no ponerla.
> Si necesitas el número, córrelo: `cd apps/web && npm test`.
>
> Y ojo con dónde lo corres: la raíz del repo y `.claude/worktrees/servidor-padre`
> son **ramas distintas con recuentos distintos** (796 y 803 el 14/08).
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
> Comprobado el 2026-08-13 al montar el worktree `servidor-padre`.

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

El trabajo del modelo de instancias **no va en la rama principal**. Va en su propia
rama, dentro de su propio worktree, para poder probar servidores sin arrastrar al
resto del proyecto.

| Rama | Worktree | Para qué |
|---|---|---|
| `main` | — | Base estable. Protegida por `ci.yml` (typecheck + test + build) |
| **`feat/servidor-padre-instancias`** | **`.claude/worktrees/servidor-padre`** | **Modelo de instancias soberanas: pruebas de servidores, releases, aprovisionamiento** |
| `feat/ui-base-404-atajos` | raíz del repo | UI base y atajos del 404 |
| `docs/manual-usuario-y-reglas-agentes` | — | Ya absorbida por la anterior; redundante |

### La rama de servidores

Es donde se ejecuta el plan de instancias soberanas, y está aislada a propósito:
toca `Dockerfile`, workflows de release, scripts de aprovisionamiento, el runner de
migraciones y `update.sh`. Nada de eso debe filtrarse a `main` a medio hacer.

Trabajar ahí es entrar al worktree, no cambiar de rama en la raíz:

```powershell
cd C:\Users\Server\spaces_doohmain_nueva\.claude\worktrees\servidor-padre
npm install
copy ..\..\..\apps\web\.env       apps\web\.env
copy ..\..\..\apps\web\.env.local apps\web\.env.local
cd db; docker compose up -d      # Postgres de desarrollo en el 5433
```

Sin `node_modules` ni `.env` no corre ni la primera prueba.

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

### Lo que está detenido

**F5.7, F7.2 y F7.3 están BLOQUEADAS** por decisiones de negocio abiertas, y **F2.6
está condicionada**. De la Fase 7 solo se puede hacer el censo (**F7.1**), que es de
solo lectura. Las cuatro decisiones pendientes son: destino del tenant `rgb` y del
droplet actual, fecha de migración de PIXELED, en qué cuenta de DigitalOcean nacen
las instancias, y el nombre del registry de imágenes.

Y una contradicción que hay que resolver antes de la Fase 2 (**P4-bis**): DEMO
necesita el autoregistro encendido, esa bandera **se hornea en el build**, y la regla
dice que el artefacto es idéntico para todas las instancias. Las dos cosas no pueden
ser ciertas a la vez. Las salidas son publicar dos imágenes por versión, o sacar la
bandera del build y decidirla en el servidor — como ya se hizo con `GOOGLE_OAUTH`.

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
  persona. Las tareas de servidor (F3.5, F3.6, F4.5, F5.6, F5.7, F6.3, Fase 7) son de Carlos.
- **Las cuatro decisiones de §8 (P1–P4) y P4-bis no las decide Claude.** En modo desatendido se
  aparca la tarea y se escribe la entrada en `docs/noche/DECISIONES-<fecha>.md`. Aparcar la tarea,
  nunca la noche. Y nunca elegir "lo razonable" para no perder tiempo.
- **Ningún valor real quemado** en archivos versionados: ni dominios, ni IPs, ni tokens, ni el
  nombre del registry. Van como parámetro (`REGISTRY`, `__DOMINIO__`).
