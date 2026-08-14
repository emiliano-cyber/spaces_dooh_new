# Instancias Soberanas · Fase 0 — Expediente de cierre **parcial**

Rama: `feat/servidor-padre-instancias` (worktree `.claude/worktrees/servidor-padre`)
Fecha: **2026-08-14** · HEAD al levantar el expediente: `38ace2f`
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 0 (`:249-369`)

> [!important] Alcance: **ejecución LOCAL**, y la fase queda **PARCIAL**
> De las tres tareas del plan, **solo F0.3 se ejecutó** (`6044732`). Las otras dos
> —F0.1 y F0.2— **no se han ejecutado y no pueden ejecutarse desde aquí**: son un
> `curl` a `demo.space-os.io` y un `ssh` al droplet `209.97.146.136`, y la regla de
> esta ejecución prohíbe tocar servidores. **F0.1 es la pregunta que da nombre a la
> fase y sigue sin respuesta.** Además se abrió y se cerró **T-03**, una tarea
> **fuera del plan**, autorizada por Jochelo el 14/08.
>
> Esta fase **no está cerrada**. Está cerrada en todo lo que no exige una persona,
> que no es lo mismo. Lo que falta es justamente lo que la motivaba.

> [!warning] Y además la fase **perdió su premisa por el camino**
> Se titula «cerrar el autoregistro **fuera de DEMO**» (`:249`) y persigue una
> asimetría: apagado en las instancias de owner, **encendido en DEMO**. El 14/08
> Jochelo lo cerró **en todas partes, DEMO incluida**, revirtiendo P3b del 10/08.
> La asimetría que la fase perseguía **ya no existe**. Ver §3.

Este documento es histórico: registra lo que era cierto el 2026-08-14 contra
`38ace2f`. La descripción de cómo funciona el sistema hoy vive en `vault/` y caduca;
esto no.

> **Este expediente sustituye a la versión de `29c6b9e`**, escrita unas horas antes,
> cuando F0.3 aún no se había ejecutado y la fase no tenía ni un commit. Lo que aquel
> expediente afirmaba —la premisa perdida, el estado de F0.1/F0.2, las correcciones
> de puntero— se conserva y se reverificó contra el árbol de hoy. Lo que cambió está
> marcado. Aquel documento decía «la mitad que impide volver atrás sigue **entera sin
> hacer**»: eso **ya no es cierto**, y §4 cuenta cómo se hizo.

---

## 1. El cuadro de la fase

| Tarea | Tipo | Estado final | Commit | Veredicto |
|---|---|---|---|---|
| **F0.1** · Averiguar si el autoregistro está abierto hoy (`:256`) | verificación | **NO EJECUTADA** → PENDIENTE_SERVIDOR | — | — (no hubo verificador) |
| **F0.2** · Apagarlo y recompilar, *solo si F0.1 dio 400* (`:289`) | infra | **NO EJECUTADA** (condicionada a F0.1) | — | — |
| **F0.3** · La regla «solo DEMO» deja de depender de la memoria (`:333`) | código | **COMPLETADA_LOCAL** | **`6044732`** | **AMARILLO** (aceptada) |
| **T-03** · La cookie comodín de la plantilla de producción · **fuera del plan** | código | **COMPLETADA_LOCAL** | **`ef70aa9`** | **AMARILLO** (aceptada) |

**Comprobado por mí** con `git show --stat` de los dos commits: existen, son de hoy
(14/08, 14:05 y 14:24) y tocan exactamente los archivos que dicen tocar.

### 1.1 Qué se creó y qué se cambió

| Archivo | Qué le pasó | Commit |
|---|---|---|
| `.env.example` | Fuera `COOKIE_DOMAIN=localhost` de `:4`; en su lugar 3 líneas de comentario que explican por qué no está | `6044732` |
| `.env.example:35` | `AUTOREGISTRO=0` — el **valor** ya lo había bajado `0dbccb8`; F0.3 no lo tocó | `0dbccb8` (previo) |
| `apps/web/lib/entorno.test.ts` | De **2 a 4 casos**: los dos nuevos leen `.env.example` **del disco** | `6044732` |
| `.env.production.example` | Fuera `COOKIE_DOMAIN=.{TENANT_SLUG}.spaces.com` de `:9`; en su lugar 11 líneas que cuentan qué era y por qué era la peor | `ef70aa9` |
| `apps/web/lib/entorno.test.ts` | De **4 a 6 casos**: los dos nuevos leen `.env.production.example`, y lo leen **dentro del `it`** | `ef70aa9` |
| `vault/01-Arquitectura/entorno-y-despliegue.md` | Los callouts de las plantillas y de la prueba, rehechos | `6044732`, `b7f3b5f`, `ef70aa9` |
| `vault/08-Manuales/manual-tecnico.md` · `vault/07-Agentes/tablero.md` | Actualizados **en el mismo commit** que el código (regla 4 de AGENTES) | `6044732`, `ef70aa9` |

**Ninguno de los dos commits escribió en `docs/Registro_Cambios.md`.** Comprobado:
`git log --oneline -- docs/Registro_Cambios.md` tiene como última entrada `70ca3f0`
(F2.6). Es defendible tarea a tarea —cambiar plantillas de `.env` y añadir pruebas no
se nota desde la aplicación— pero conviene que quede dicho: la Fase 0 **no dejó una
sola línea en la bitácora**, igual que la Fase 1.

---

## 2. Por qué F0.1 y F0.2 siguen sin ejecutarse — es de contrato, no de dificultad

- **F0.1** son dos comandos contra máquinas ajenas: un `curl` a
  `https://demo.space-os.io/spaces-dooh/api/signup/` (plan `:267-271`) y un
  `ssh root@209.97.146.136` (plan `:275`). `CLAUDE.md §7` dice literalmente: «**Nada
  de `ssh`, `doctl` ni `curl` contra producción.** Cuando una tarea pide un comando
  contra un servidor, se escribe para que lo corra una persona». Se escribió: es la
  tarjeta **TH-F0.1** de §8.
- **F0.2** declara en su propio título «**solo si F0.1 dio 400**» (`:289`) y en su
  campo *Depende de* (`:292`). Sin la respuesta de F0.1 no tiene condición de
  arranque. Además toca `/var/www/Spaces/apps/web/.env` y recompila en el droplet.

### 2.1 Hallazgo de proceso: **F0.3 se ejecutó fuera del orden de dependencias**

El plan dice en `:337`, línea abierta y leída hoy:

```
- **Fase:** 0. **Depende de:** F0.1.
```

**F0.1 no se ejecutó**, y F0.3 sí. La regla de ejecución de `CLAUDE.md §7` —«en el
orden del plan, **respetando su campo “Depende de”**»— quedó saltada.

En sustancia no cambia nada: lo que F0.3 hace es sobre archivos del repositorio y su
resultado no depende de si el droplet contesta 400 o 503. Pero es una desviación
real, nadie la declaró en la bitácora de orquestación, y este expediente es el sitio
donde debe constar. Si alguien mide la ejecución del plan por su DAG, esta tarea
está fuera de él.

---

## 3. La premisa del título de la fase ya no es cierta

| Fecha | Decisión | Ancla |
|---|---|---|
| 2026-08-10 | P3b: el registro público es «**abierto y permanente**» | `vault/00-Indice/preguntas-abiertas.md:71-72` («*Decisión anterior, del 10/08, ya no vigente*») |
| 2026-08-13 | **P4-bis resuelta**: la bandera sale del build y se decide en el `.env` al arrancar | `vault/07-Agentes/ejecucion-plan-v3.md:31`; ejecutada en `70ca3f0` |
| **2026-08-14** | **Jochelo: CERRADO en local y en producción**, revirtiendo P3b | `ejecucion-plan-v3.md:262`; commit `0dbccb8` |
| **2026-08-14** | **Confirmado para DEMO: cerrado también ahí.** «Ninguna instancia lo abre» | `ejecucion-plan-v3.md:283`; commit `39379bf` |

Texto literal de la bóveda hoy (`preguntas-abiertas.md:50-56`), leído al levantar
este expediente:

> **El autorregistro va CERRADO en TODAS partes: local, producción y DEMO.** Decisión
> de Jochelo del **2026-08-14**, que sustituye a la del 10/08 («abierto y
> permanente»). […] **Ninguna instancia lo abre.** La bandera `AUTOREGISTRO` existe y
> funciona (F2.6), pero hoy nadie la enciende.

**Consecuencia sobre esta fase:** el «fuera de DEMO» del título ya no distingue nada.
La bandera va apagada en todas partes, así que lo que la Fase 0 quería *asegurar en
unas instancias y no en otras* es hoy una condición uniforme de la flota. La fase se
ejecutó igual porque su **objetivo material** —que la plantilla del repo no reparta
un registro abierto— sigue siendo válido, y de hecho pasó a ser **más** importante:
es el único sitio donde la decisión del 14/08 queda anclada por algo que no sea la
memoria de quien la tomó.

---

## 4. F0.3 · Su objetivo tenía dos mitades, y solo una llegó cuando tocaba

El objetivo, literal (`:335-336`): «que la plantilla de entorno del repo nazca con el
autoregistro apagado **y** que una prueba impida volver atrás».

### 4.1 La primera mitad llegó **de rebote**, y por otra vía

El valor `AUTOREGISTRO=0` de `.env.example` **no lo puso F0.3**. Lo puso `0dbccb8`
—`docs(entorno): el autoregistro va cerrado, y la tabla que decia lo contrario`—, un
commit cuyo propósito era **registrar una decisión de negocio**, no ejecutar una
tarea del plan. Su propio cuerpo nombra el agujero: «La plantilla del repo dejaba el
registro abierto en cualquier clon, **que era justo el agujero que F0.3 iba a
cerrar**».

Hoy, `.env.example:31-35`, abierto y copiado:

```
# Decisión de Jochelo del 14/08/2026: CERRADO en local y en producción. Deja de
# ser cierto lo que decía P3b el 10/08 («abierto y permanente»). Si necesitas el
# alta para probar algo en tu máquina, pon 1 en tu `.env` — que no se versiona —
# y no aquí.
AUTOREGISTRO=0
```

### 4.2 La segunda mitad tardó, y ese hueco es el dato

**Entre `0dbccb8` y `6044732` la decisión del 14/08 la sostenía un valor que nada
vigilaba.** Ninguna prueba leía `.env.example`: devolverla a `=1` dejaba `npm test`
en verde y al CI (`.github/workflows/ci.yml:74-75`, `npx turbo run test --filter=web`
— líneas abiertas y confirmadas hoy) completamente mudo.

Ese hueco lo detectó el documentalista de la versión anterior de este expediente
(`ejecucion-plan-v3.md:279`) y lo cerró `6044732` el mismo día. Es la razón por la que
esta fase, que parecía sobrepasada por los hechos, tenía todavía trabajo real dentro:
**una decisión escrita en un archivo que nadie vigila no es una decisión ejecutada.**

### 4.3 Lo que quedó en el árbol

`apps/web/lib/entorno.test.ts`, 122 líneas, **6 casos**, abiertos uno a uno:

| Caso | Línea | Qué afirma | Origen |
|---|---|---|---|
| «cambia de valor entre llamadas, sin recompilar» | `:24` | La función obedece a `process.env` sin recompilar | F2.6 (`70ca3f0`) |
| «sin la variable definida, viene APAGADO» | `:34` | Fail-closed | F2.6 (`70ca3f0`) |
| «la plantilla de entorno nace con el autoregistro apagado» | `:61` | `/^AUTOREGISTRO=0$/m` en `.env.example` | **F0.3** |
| «la plantilla no propone un dominio de cookie» | `:68` | `.env.example` **no** casa `/^COOKIE_DOMAIN=.+$/m` | **F0.3** |
| «la plantilla de produccion no propone un dominio de cookie» | `:107` | Ídem sobre `.env.production.example` | **T-03** |
| «la plantilla de produccion nace con el autoregistro apagado» | `:115` | Ídem | **T-03** |

Y el **paso 4** de F0.3 (`:357`), que sí aplicaba tal cual: fuera
`COOKIE_DOMAIN=localhost` de `.env.example:4`. Diff verificado con
`git show 6044732 -- .env.example`:

```
-COOKIE_DOMAIN=localhost
+# Sin COOKIE_DOMAIN a propósito: las cookies son host-only y ninguna instancia
+# comparte sesión con otro dominio (`lib/server/auth.ts:191-201` y `:216-226` no
+# fijan `domain`; además ningún archivo de `apps/` lee la variable).
```

Reverifiqué la afirmación en que se apoya: `grep -n "domain" apps/web/lib/server/auth.ts`
**no devuelve ni una línea**, y leí `cookieSesion()` (`:191-201`) y `cookieCsrf()`
(`:216-226`) completos: ninguna fija `domain`. La única lectura real de la variable en
todo el repo está en `_archive/api/src/core/auth/auth.routes.ts:17`, que es la pista
muerta.

### 4.4 Lo que F0.3 **no** hizo, y está bien que no lo hiciera

El **paso 3** del plan (`:352`) manda cambiar `NEXT_PUBLIC_AUTOREGISTRO=1` → `=0` y
escribir un comentario que diga «*encendido ÚNICAMENTE en DEMO; se hornea en el
build*». **Las dos mitades de esa frase son falsas hoy**: no se hornea nada desde
`70ca3f0`, y DEMO también va cerrada desde `39379bf`. El ejecutor lo declaró y no lo
escribió. **El plan no se tocó**, por la regla «no se replanea»; la evidencia vive
aquí y en §12.

---

## 5. T-03 · La cookie comodín — una tarea **fuera del plan**

### 5.1 De dónde salió

De la auditoría de F0.3. El auditor aceptó la tarea **y a la vez** encontró que el
propio commit `6044732` había escrito **dos afirmaciones falsas en la bóveda**:
`entorno-y-despliegue.md` decía que `COOKIE_DOMAIN` «ya no está en la plantilla … sigue
viva solo en `_archive/`», y `manual-tecnico.md` prometía que la prueba «impide que
vuelva». Las dos ignoraban que **`.env.production.example:9` la seguía declarando**:
la prueba de F0.3 lee **una sola** plantilla. Ese hallazgo se commiteó primero como
corrección de bóveda (`b7f3b5f`) y luego se convirtió en tarea (`ef70aa9`), autorizada
por Jochelo.

### 5.2 Qué decía la línea, y por qué importa

```
COOKIE_DOMAIN=.{TENANT_SLUG}.spaces.com
```

Una **cookie comodín de segundo nivel**, del modelo de subdominios por tenant que
murió el 2026-08-12. Contradice de frente el **invariante 4** del plan v3 (`:219`,
abierto hoy): «*`tenantActual()` no aprende a leer el `Host`; las cookies siguen sin
`domain`*».

**El riesgo, dimensionado — y esto es lo que separa el hallazgo del adorno:**

- **Inocuo HOY.** Ninguna línea de `apps/` lee `COOKIE_DOMAIN`; lo comprobé con
  `git grep -n "COOKIE_DOMAIN"` sobre todo el repo: fuera de comentarios y de los dos
  planes, la única lectura viva es la de `_archive/`.
- **Latente MAÑANA, por tres vías.** (a) El código que sí la consume **existe en el
  repositorio**: `_archive/api/src/core/auth/auth.routes.ts:17` hace
  `domain: process.env.COOKIE_DOMAIN`. El día que alguien haga configurable el
  `domain` de `cookieSesion()`, cada instancia nacida de esa plantilla comparte sesión
  por todo `*.spaces.com`: **fuga entre instancias soberanas, R1 y R2 a la vez, y del
  tipo que no da error**. (b) Es una instrucción explícita al operador, que tomaría
  decisiones de DNS y certificados comodín sobre un modelo muerto. (c) **Ninguna tarea
  del plan la limpiaba**: F5.3 crea una plantilla *nueva* (`infra/env/instancia.env.example`,
  `:1494`) sin la variable, pero **no toca esta**. Quedaba huérfana.
- Y es **la plantilla que se copia para montar una instancia real**, no la de
  desarrollo. El candado de F0.3 protegía la que menos daño podía hacer.

### 5.3 Lo que quedó en el árbol

`.env.production.example:9-19` — donde estaba la variable hay ahora once líneas que
cuentan qué era y por qué salió, para que nadie la reponga creyendo que faltaba. Y
`:49` sigue en `AUTOREGISTRO=0`, ahora vigilado.

---

## 6. Que las pruebas **muerden** — reproducido por mí, no citado

Una prueba que nunca se ha visto fallar no está probada. Los auditores lo comprobaron
y **yo lo repetí desde cero**, porque es la afirmación central de esta fase.

**Experimento 1 — poner las dos plantillas en `=1`:**

```
sed -i 's/^AUTOREGISTRO=0$/AUTOREGISTRO=1/' .env.example .env.production.example
cd apps/web && npx vitest run lib/entorno.test.ts
```

```
     × la plantilla de entorno nace con el autoregistro apagado 4ms
     × la plantilla de produccion nace con el autoregistro apagado 1ms
 FAIL  lib/entorno.test.ts > .env.example > la plantilla de entorno nace con el autoregistro apagado
AssertionError: expected 'DATABASE_URL=postgresql://postgres:pa…' to match /^AUTOREGISTRO=0$/m
 FAIL  lib/entorno.test.ts > .env.production.example > la plantilla de produccion nace con el autoregistro apagado
AssertionError: expected '# ════ BASE DE DATOS ════\nDATABASE_U…' to match /^AUTOREGISTRO=0$/m
 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
```

**Experimento 2 — reponer un `COOKIE_DOMAIN` en cada plantilla:**

```
printf 'COOKIE_DOMAIN=.rgb.spaces.com\n' >> .env.production.example
printf 'COOKIE_DOMAIN=localhost\n'       >> .env.example
```

```
     × la plantilla no propone un dominio de cookie 8ms
     × la plantilla de produccion no propone un dominio de cookie 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
```

**Los cuatro casos de plantilla muerden.** Tras cada experimento restauré con
`git checkout -- .env.example .env.production.example` y comprobé `git status --short`
**vacío**. El árbol queda como estaba.

> Nota de detalle que el auditor de F0.3 levantó y confirmo: `.env.example` tiene
> finales **CRLF** en el árbol y la regex `/^AUTOREGISTRO=0$/m` casa igual, porque en
> JavaScript el `$` con flag `m` ancla antes del `\r`. **No hay un falso rojo esperando
> a un clon en Windows.** Mis dos experimentos corrieron en Windows y los 4 casos
> pasan en verde en el estado normal del árbol, que es la comprobación práctica.

---

## 7. El hallazgo de arquitectura de pruebas — también reproducido

Los dos casos de T-03 leen su plantilla **dentro del `it`**
(`entorno.test.ts:102-104`, función `plantillaProduccion()`); los dos de F0.3 la leen
en una **constante de módulo** (`:58`, `const PLANTILLA = readFileSync(...)`). No es
cosmético, y se demuestra borrando cada archivo:

**A) sin `.env.production.example`** (patrón nuevo):

```
     × la plantilla de produccion no propone un dominio de cookie 3ms
     × la plantilla de produccion nace con el autoregistro apagado 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
```

**B) sin `.env.example`** (constante de módulo):

```
Error: ENOENT: no such file or directory, open '…\servidor-padre\.env.example'
 Test Files  1 failed (1)
      Tests  no tests
```

Falla lo que tiene que fallar en (A). En (B) **no se ejecuta ninguno de los 6**: el
error revienta en la importación y se lleva por delante hasta los dos casos de F2.6,
que no tienen nada que ver con plantillas.

**Consecuencia que hay que dejar escrita:** mientras `PLANTILLA` se lea al cargar el
módulo, **la protección que aportó T-03 sigue siendo rehén de la otra plantilla**. Si
`.env.example` desapareciera, los casos de producción tampoco correrían. El candado a
rehacer es el de F0.3, no el de T-03 — y T-03 tenía prohibido tocar los 4 casos que ya
pasaban, restricción que declaró. **Es mejora pendiente, y es pequeña.**

(Los dos archivos se movieron al scratchpad y se devolvieron en el mismo comando;
`git status --short` quedó vacío después.)

---

## 8. Verificación global — lo que corrí yo hoy

| Afirmación | Comando | Resultado |
|---|---|---|
| Los 6 casos de `entorno.test.ts` están en verde | `cd apps/web && npx vitest run lib/entorno.test.ts` | `Test Files 1 passed (1)` · `Tests 6 passed (6)` · 366 ms |
| La suite unitaria completa está en verde | `cd apps/web && npm test` | `Test Files 73 passed (73)` · `Tests 805 passed (805)` · 7,06 s |
| Los cuatro casos de plantilla muerden | §6, dos experimentos con restauración | 2+2 rojos, tree restaurado |
| El patrón de lectura importa | §7, borrado de cada plantilla | 2 fallan / **ninguno corre** |
| Los dos commits existen y tocan lo que dicen | `git show --stat 6044732 ef70aa9` | 5 archivos cada uno; coinciden |
| `COOKIE_DOMAIN` no la lee `apps/` | `git grep -n "COOKIE_DOMAIN" -- . ':!node_modules'` | Solo comentarios, planes, `MANUAL.md:428` y `_archive/api/…:17` |
| `cookieSesion` / `cookieCsrf` no fijan `domain` | `grep -n "domain" apps/web/lib/server/auth.ts` | **cero líneas** |
| El árbol quedó limpio tras mis experimentos | `git status --short` | vacío |
| Cada `archivo:línea` citado en este expediente | abierto uno a uno con `sed -n` / `grep -n` | ver §4, §5, §12 |

> Sobre la cifra **805 en 73**: la medí yo hoy, 14/08, en **este worktree** y en este
> HEAD. Coincide con la que declara el cuerpo de `ef70aa9`. **No la conviertas en una
> constante**: los recuentos globales se están retirando de la documentación a
> propósito (`703649e`) porque crecen y envejecen. Vale como «hoy la suite pasa
> entera», no como número de referencia.

**Lo que NO corrí:** `npm run test:e2e`. Ni F0.3 ni T-03 tocan código de la app, ni
auth, ni tenant, ni migraciones, y **ningún arnés lee estas plantillas** — lo verifiqué
con el grep de `env.example` sobre `apps/`. Además la suite e2e usa la única base
`spaces_e2e` con `drop schema public cascade` y había otros agentes en el worktree.

---

## 9. Lo que NO quedó probado — con el mismo tamaño de letra

### 9.1 No sabemos si el autoregistro está abierto **hoy** en el droplet. Eso es la fase entera.

F0.1 es toda la pregunta de la Fase 0 y **sigue sin respuesta**. El plan lo advierte
en su propia tabla de supuestos, `:171`, leída hoy:

| Hecho que los documentos o el contexto dan por bueno | Dónde se verifica |
|---|---|
| El autoregistro está apagado en el droplet actual (indicio: se aplicó el 2026-08-04) | **F0.1** |

«Indicio» es la palabra del plan, y sigue siendo eso. **Nadie ha mirado.** Todo lo que
esta fase consiguió —dos plantillas bajo llave y una cookie muerta fuera— ocurre en el
repositorio, no en la máquina que sirve a los clientes.

### 9.2 Aquí lo local no aproxima nada, y la razón no es el fixture

En otras fases la brecha es que la base del 5433 es *fixture* —33 filas, tablas
vacías, tenants que allá no existen— y sus ceros son **ceros vacuos**. Aquí la brecha
es distinta y peor: **el objeto de la verificación no existe en local.**

- Lo que F0.1 pregunta es el contenido de `/var/www/Spaces/apps/web/.env` en
  `209.97.146.136` y qué contesta un endpoint público servido desde ahí.
- El `.env` local **no tiene la variable** (`ejecucion-plan-v3.md:262`), o sea que local
  está cerrado por fail-closed — dato que **no dice nada** del droplet.
- **El droplet corre un build anterior a `70ca3f0`**, que lee `NEXT_PUBLIC_AUTOREGISTRO`
  horneada en el bundle. Ese código **ya no está en este árbol**. Ninguna prueba local
  puede ejercitarlo, ni con fixture ni con datos reales.

### 9.3 Los `.env` ya desplegados siguen sin revisar

T-03 limpió **la plantilla**. Los `.env` que ya se copiaron de ella, **no**. Si el
droplet declara `COOKIE_DOMAIN`, ahí sigue. Es **TH-T03** (§10.2), y es el mismo
riesgo latente que motivó T-03, pero sobre un archivo vivo.

### 9.4 El bloque e2e que documenta la imposibilidad **ya envejeció**

`apps/web/lib/test/aislamiento.e2e.test.ts:200-213` —citado por F0.1 en `:263` como la
razón de que esto no se pueda probar en la suite— **sigue exactamente en esas líneas**
(lo abrí; el `it.skip` está en `:212` y el archivo tiene 213 líneas), pero su contenido
**ya es falso**: `:203` dice que la bandera «la INLINEA Next en tiempo de BUILD, también
en el código de servidor», y tras `70ca3f0` no se inlinea nada. El propio commit lo
reconoce y decide no tocarlo: «su bloque `:200-213` queda obsoleto pero se retira en un
release posterior (expand → contract)». **Es cobertura que sigue ausente por una razón
que ya no es la razón.**

---

## 10. Tarjetas humanas vivas

### 10.1 **TH-F0.1** — la que desbloquea la fase y la Fase 4 entera

**Solo lectura.** La corre una persona. Es lo único que puede cerrar la Fase 0 de
verdad, y bloquea a F0.2 y —según `:260`, abierto y confirmado hoy: «**Bloqueante
de:** F0.2 y de toda la Fase 4»— a **toda la Fase 4**.

**Paso 1 — el comando de verificación exacto del plan** (`:267-271`), desde cualquier
máquina con red, sin tocar el servidor:

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  https://demo.space-os.io/spaces-dooh/api/signup/ \
  -H 'Content-Type: application/json' -d '{}'
```

Con cuerpo vacío no se crea nada: zod revienta antes de tocar la base.

**Paso 2 — confirmar la causa en el servidor** (`:275`), solo lectura:

```bash
ssh root@209.97.146.136 "grep -rs AUTOREGISTRO /var/www/Spaces/.env /var/www/Spaces/apps/web/.env*; echo '[fin]'"
```

**Cómo se lee la respuesta** (criterio de `:279-282`):

| Código | Significado | Qué sigue |
|---|---|---|
| **503** | Apagado | La Fase 0 queda respondida. F0.2 **no se ejecuta** |
| **400** | **Abierto** — un desconocido puede crear una organización en producción hoy | F0.2 «hoy mismo», **pero con la corrección de §10.1.1** |
| 000, 429, 5xx | **No concluyente** | No se sigue hasta saber por qué |

**Paso 3** (`:277-278`): anotar el resultado **con fecha** en `docs/Registro_Cambios.md`,
commit en el PADRE, sin tocar el servidor.

#### 10.1.1 Si sale 400, F0.2 **no** se ejecuta como está escrita

Su `sed` (`:302-307`, abierto hoy) opera sobre `^NEXT_PUBLIC_AUTOREGISTRO=`. Eso es
correcto **solo mientras el droplet siga corriendo el build anterior a `70ca3f0`**, y
deja de serlo el día que se despliegue la versión nueva. La orquestación ya registró el
cambio de sentido (`ejecucion-plan-v3.md:262`):

> «**La tarjeta humana del droplet cambia de sentido: ya no hay que poner
> `AUTOREGISTRO=1`, sino borrar la línea vieja y no poner nada.**»

Con el código de hoy, **ausente = cerrado** (`apps/web/lib/entorno.ts:26-27`,
`return process.env.AUTOREGISTRO === '1'`), así que sobre un droplet ya actualizado la
acción correcta es **eliminar** cualquier `NEXT_PUBLIC_AUTOREGISTRO=…` y no añadir
nada. El respaldo previo del `.env` (`:298-301`) y la recarga como el usuario dueño de
la app, no como root (`:309-313`), siguen siendo válidos tal cual.

**El plan NO se ha tocado.** Esta corrección vive aquí y en la bitácora de
orquestación.

### 10.2 **TH-T03** — la cookie comodín en los `.env` YA desplegados

Nueva, emitida el 2026-08-14 por el verificador de T-03
(`ejecucion-plan-v3.md:157-173`). **Solo lectura.**

```bash
grep -n '^COOKIE_DOMAIN' /var/www/Spaces/apps/web/.env.production
```

**Respuesta esperada:** sin resultados. Si aparece, **borrar la línea**: hoy es
inocua —`apps/web` no lee la variable, medido en §5.2— pero es el mismo riesgo latente
que motivó T-03, ahí sí sobre un archivo vivo.

**Qué desbloquea:** nada bloqueado. Es higiene antes de que el `domain` de la cookie
se vuelva configurable alguna vez.

---

## 11. Commits ROJO pendientes de visto bueno humano

Los dos commits de esta fase tocan **seguridad de sesión y la puerta de entrada
pública**, así que caen bajo la regla de oro de `zonas-de-riesgo` aunque su diff sea
pequeño:

| Commit | Tarea | Por qué es ROJO | Ancla |
|---|---|---|---|
| **`6044732`** | F0.3 | Ancla por prueba la decisión de negocio sobre el registro público | `ejecucion-plan-v3.md:57` |
| **`ef70aa9`** | T-03 | Retira una directiva de **cookie de sesión** de la plantilla de producción · «ROJO por tema: pendiente de visto bueno humano» | `ejecucion-plan-v3.md:58` y `tablero.md` Z11 |

Y arrastrado de fuera de la fase, porque sin él nada de esto tiene sentido:
**`70ca3f0` (F2.6) está marcado ROJO y pendiente de visto bueno humano**
(`ejecucion-plan-v3.md:106`). `0dbccb8`, `39379bf` y `b7f3b5f` son de documentación y
plantillas; no cambian código.

---

## 12. Lo que el plan afirmaba y el repositorio desmiente

Todo verificado hoy contra `38ace2f`. **Ninguna de estas líneas del plan se ha
corregido**, por la regla «no se replanea»; la evidencia vive aquí.

| Línea del plan | Lo que afirma | Lo que hay hoy |
|---|---|---|
| `:51` | «`.env.example` trae la bandera en `1` … `.env.example:23` → `NEXT_PUBLIC_AUTOREGISTRO=1`» | `:23` es un comentario; la línea con valor es **`:35`** → `AUTOREGISTRO=0` (era `:33` antes de que F0.3 añadiera el comentario de la cookie: **el puntero derivó otra vez en la misma jornada**) |
| `:56` | «`COOKIE_DOMAIN` aparece en `.env.example:4`» | `:4` es ahora el comentario que dice **por qué no está**. F0.3 la borró |
| `:171` | El autoregistro está apagado en el droplet «(indicio)» | Sigue siendo indicio. **Nadie ha mirado** |
| `:188` | La bandera se lee en `signup/route.ts:18`, `login/page.tsx:30`, `google-oauth.ts:90`, `servidor-e2e.ts:49` | Las cuatro citas derivaron y una desapareció: `signup/route.ts:21`, `google-oauth.ts:93-94`, `servidor-e2e.ts:57`, y **`login/page.tsx` ya no la lee** |
| `:337` | F0.3 **depende de F0.1** | F0.3 se ejecutó **sin** F0.1 (§2.1) |
| `:338` | `Archivos: .env.example` líneas **17-23** y línea 4 | `:17-23` eran comentario ya entonces; **la línea 4 sí aplicaba** y F0.3 la atendió |
| `:339` | `apps/web/lib/entorno.test.ts` **(nuevo)** | Existía desde `70ca3f0`. F0.3 lo hizo **crecer**, no nacer |
| `:346` | regex `/^NEXT_PUBLIC_AUTOREGISTRO=0$/m` | Imposible de casar. Se ejecutó como `/^AUTOREGISTRO=0$/m` (`entorno.test.ts:65`) |
| `:352` | cambiar `NEXT_PUBLIC_AUTOREGISTRO=1` → `=0`, y escribir «encendido ÚNICAMENTE en DEMO; se hornea en el build» | La cadena no estaba (`0dbccb8` ya lo había hecho) y **las dos mitades del comentario son falsas** (§4.4) |
| `:302-307` (F0.2) | `sed` sobre `^NEXT_PUBLIC_AUTOREGISTRO=` en el droplet | Válido solo mientras el droplet corra el build viejo (§10.1.1) |
| `:1345` (F4.4) | `.env` de DEMO con `NEXT_PUBLIC_AUTOREGISTRO=1`, «la única instancia de toda la flota que lo lleva» | Doblemente contradicha: variable muerta **y** decisión revertida — DEMO va cerrada |
| `:1497`, `:1504` (F5.3) | La plantilla de instancia trae `NEXT_PUBLIC_AUTOREGISTRO=0` | Grabaría una **variable muerta** en el `.env` de todas las instancias |
| `:1494` (F5.3) | Crea `infra/env/instancia.env.example` sin `COOKIE_DOMAIN` | Correcto, pero **no tocaba `.env.production.example`**: por eso hizo falta T-03 |
| `:2037` | `entorno.test.ts` tendrá **6** casos (F0.3 + F5.3 + F2.6) | Tiene **6**, pero **no esos**: son F2.6 (2) + F0.3 (2) + **T-03 (2)**. Los 2 de F5.3 siguen sin escribirse. El número coincide por casualidad |
| `:263` / `aislamiento.e2e.test.ts:200-213` | «la bandera se hornea en el build» | Falso desde `70ca3f0`; el bloque sigue en pie con su `it.skip` en `:212` |

---

## 13. Hallazgos propios de este expediente

1. **F0.3 se ejecutó fuera del orden de dependencias** (§2.1). Nadie lo declaró.
   Materialmente inocuo; formalmente, una desviación del contrato de ejecución.
2. **Puntero derivado en la bóveda, del mismo día.**
   `vault/01-Arquitectura/entorno-y-despliegue.md:244` —la **tabla canónica de
   variables**, la que lee quien prepara el `.env` de una instancia— cita
   `app/api/signup/route.ts:19-20` para `AUTOREGISTRO`. Abierto hoy: `:19` es la última
   línea de comentario y `:20` la firma de la función. **El guard está en `:21-26`.**
   No es peligroso —la fila dice lo correcto en las tres columnas— pero manda al sitio
   equivocado, que es exactamente el modo de fallo que `CLAUDE.md §5` describe.
3. **Comentario caducado en código vivo, todavía en pie.**
   `apps/web/app/api/signup/route.ts:15` sigue llamando a DEMO «**la única con el
   registro abierto**». Desde `39379bf` eso es falso: ninguna instancia lo abre. El
   punto que el comentario defiende —comprobar en el servidor y no solo en la UI— sigue
   en pie; el ejemplo no. Ya declarado en el cuerpo de `39379bf` y no corregido por ser
   código.
4. **La Fase 0 no dejó rastro en `docs/Registro_Cambios.md`** (§1.1). La última entrada
   es de `70ca3f0`. Defendible tarea a tarea, notable en agregado — y es la segunda fase
   consecutiva a la que le pasa.

---

## 14. Decisiones de negocio

### Tomadas

| Fecha | Decisión | Efecto sobre la Fase 0 |
|---|---|---|
| 2026-08-13 | **P4-bis: la bandera sale del build** (salida *b*), como ya se hizo con `GOOGLE_OAUTH` | Deja obsoleto el vocabulario de la fase: F0.2 hablaba de «recompilar» porque no había alternativa |
| 2026-08-14 | **P3b-bis: cerrado en local y en producción**, revirtiendo P3b del 10/08 | Ejecuta de rebote la primera mitad de F0.3 (`0dbccb8`) |
| 2026-08-14 | **P3b-bis, segunda mitad: cerrado también en DEMO** | Deja sin objeto el «fuera de DEMO» del título |
| 2026-08-14 | **T-03 autorizada por Jochelo**, fuera del plan | Añade la segunda plantilla al candado y retira la cookie comodín |

### Abiertas, y bloquean lo siguiente

- **P1 · destino del tenant `rgb` y del droplet actual.** Ver §15: con el registro
  cerrado en toda la flota, deja de ser una pregunta de limpieza y pasa a ser la
  **única vía de alta** de organizaciones.
- **P4 · nombre del registry.** Bloquea F2.3 y F2.4 (`ejecucion-plan-v3.md:30`).
- **P2 · fecha de migración de PIXELED** y **P3 · cuenta de DigitalOcean**.
- **P6 · `/api/version` con token de flota o pública** (Fase 6, fuera de alcance).

---

## 15. La consecuencia que la fase no previó

Registrada el 14/08 en `ejecucion-plan-v3.md:284` y en `preguntas-abiertas.md:62-69`.
Con el registro cerrado en **todas** las instancias:

1. **`POST /api/signup` queda sin uso en toda la flota.** Su primera línea es
   `if (!autoregistroActivo())` → 503 (`apps/web/app/api/signup/route.ts:21-26`), y
   nadie enciende la bandera. `GET /api/auth/metodos/` devolverá siempre
   `autoregistro: false`.
2. **El alta de una organización nueva ya no tiene camino por la aplicación.** Queda:
   - `db/schema.sql:598` →
     `insert into tenants (nombre, slug) values ('RGB Catorce','rgb') on conflict (slug) do nothing;`
   - `apps/web/scripts/bootstrap-auth.mjs:60` → `const TENANT_SLUG = 'rgb'`, resuelto
     **por slug y nunca por uuid**, con **aborto ruidoso si el tenant falta** (decisión
     T-01b del 13/08).
3. Por tanto **cada instancia nueva nacería con una organización llamada `rgb`** — el
   nombre de un cliente concreto convertido en valor por omisión de todo el producto.
   Enlaza directo con **P1**, que sigue abierta.

---

## 16. Pendientes declarados al cerrar este expediente

- [ ] **TH-F0.1** — el `curl` y el `grep` por `ssh` de §10.1. **Desbloquea F0.2 y,
      según el plan `:260`, toda la Fase 4.** Es lo único que puede responder la
      pregunta que da nombre a la fase.
- [ ] **F0.2**, solo si TH-F0.1 devuelve 400, y **con la corrección de §10.1.1**: no
      poner `AUTOREGISTRO=1`, sino **borrar la línea vieja**.
- [ ] **TH-T03** — comprobar `COOKIE_DOMAIN` en los `.env` ya desplegados (§10.2).
- [ ] **Visto bueno humano de `6044732` y `ef70aa9`** (ROJO), y del `70ca3f0` del que
      dependen, sin el cual no se mergea nada de esto.
- [ ] **Rehacer el candado de F0.3 para que lea dentro del `it`** (§7). Mejora pequeña;
      hoy la protección de T-03 es rehén de `.env.example`.
- [ ] **Retirar `aislamiento.e2e.test.ts:200-213`** en el release de *contract*, tal
      como anunció `70ca3f0`.
- [ ] **Corregir el puntero de `entorno-y-despliegue.md:244`** (`signup/route.ts:19-20`
      → `:21-26`) y el comentario caducado de `signup/route.ts:15` (§13).
- [ ] **Decidir P1** antes de aprovisionar la primera instancia nueva: hoy nacería
      llamándose `rgb` (§15).

---

## 17. Nota de entorno

- Worktree `.claude/worktrees/servidor-padre` sobre `feat/servidor-padre-instancias`,
  HEAD `38ace2f`. Todo lo de este expediente se comprobó **en este árbol**. Ojo:
  `cd apps/web && npm test` desde la **raíz** del repositorio mide otra rama y da otra
  cifra.
- **No se tocó ningún servidor.** Cero `ssh`, cero `curl` remoto, cero `doctl`. Esa es,
  literalmente, la razón de que F0.1 y F0.2 sigan sin ejecutarse.
- **No se consultó la base `spaces` del 5433.** Esta fase no tiene ninguna afirmación
  que dependa de datos; la única suite que corrí es unitaria y no toca Postgres.
- **Mutaciones temporales del árbol, todas revertidas.** Los experimentos de §6 y §7
  modificaron o movieron `.env.example` y `.env.production.example` durante segundos.
  Tras cada uno, `git checkout --` / restauración del archivo y `git status --short`
  **vacío**. No se ejecutó ninguna tarea ni se corrigió ningún hallazgo: los hallazgos
  están en §13 y se quedan ahí.
- **Sin capturas.** No hay pantalla que enseñar: la evidencia de esta fase son salidas
  de comando y líneas de archivo. El único efecto visible —el botón «Crear cuenta»
  desapareciendo del login— es de F2.6 y su evidencia está medida al byte en el
  expediente de esa fase, no aquí.
- Este commit stagea **solo `docs/evidencias/fase-0.md`**, por ruta explícita.

---

*Levantado el 2026-08-14 contra `38ace2f`, sustituyendo al expediente de `29c6b9e`.
La Fase 0 la declara —o la da por parcial— el orquestador en
`vault/07-Agentes/ejecucion-plan-v3.md`, no este documento.*
