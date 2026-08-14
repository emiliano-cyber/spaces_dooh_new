# Instancias Soberanas · Fase 0 — Expediente de cierre

Rama: `feat/servidor-padre-instancias` (worktree `.claude/worktrees/servidor-padre`)
Fecha: **2026-08-14** · HEAD al levantar el expediente: `42c0f4e`
Plan de autoridad: `docs/Plan_Instancias_Soberanas_v3.md` §FASE 0 (`:249-369`)

> [!important] Alcance: **ejecución LOCAL**, y esta fase **no se ejecutó**
> Ninguna de las tres tareas de la Fase 0 tiene commit, ni verificador, ni veredicto.
> Dos de ellas (F0.1 y F0.2) solo pueden correrse contra el droplet
> `209.97.146.136`, y la regla de esta ejecución prohíbe `ssh`, `doctl` y `curl`
> contra servidores. La tercera (F0.3) es de código y **quedó sobrepasada por los
> hechos**: parte de su objetivo lo cumplió otra tarea, y su especificación literal
> quedó rota por el renombrado de la bandera.
>
> Este expediente no registra un cierre: registra **por qué esta fase dejó de ser
> ejecutable tal como está escrita**, qué se consiguió por otra vía y qué sigue
> pendiente de una persona.

Este documento es histórico: registra lo que era cierto el 2026-08-14. La
descripción de cómo funciona el sistema hoy vive en `vault/` y caduca; esto no.

---

## 1. El cuadro de la fase

| Tarea | Tipo | Estado final | Commit | Veredicto |
|---|---|---|---|---|
| **F0.1** · Averiguar si el autoregistro está abierto hoy (`:256`) | verificación | **NO EJECUTADA** → PENDIENTE_SERVIDOR | — | — (no hubo verificador) |
| **F0.2** · Apagarlo y recompilar, *solo si F0.1 dio 400* (`:289`) | infra | **NO EJECUTADA** (condicionada a F0.1) | — | — |
| **F0.3** · La regla «solo DEMO» deja de depender de la memoria (`:333`) | código | **NO EJECUTADA como tal · especificación rota · objetivo cumplido a medias por otra vía** | — (ver §5) | — |

**Comprobación de que no hay commits de Fase 0.** `git log --oneline --all --grep="F0"`
(corrido hoy) devuelve tres commits, y **ninguno ejecuta una tarea F0**: `0dbccb8` y
`6e119e5` la mencionan en el cuerpo para decir qué le pasa a F0.3, y `3c089aa`
(`fix(auditoria): M7, M8 y M12…`) es de otro trabajo y casa por accidente con el
patrón. No existe ningún `docs(deploy): el estado real del autoregistro…` ni ningún
`fix(seguridad): la plantilla de entorno nace con el autoregistro cerrado…`, que son
los commits sugeridos por el plan en `:284` y `:364`.

---

## 2. Por qué no se ejecutó — la razón es de contrato, no de dificultad

- **F0.1** son dos comandos contra máquinas ajenas: un `curl` a
  `https://demo.space-os.io/spaces-dooh/api/signup/` (plan `:267-271`) y un `ssh
  root@209.97.146.136` (plan `:275`). `CLAUDE.md §7` — *Reglas de esa ejecución* —
  dice literalmente: «**Nada de `ssh`, `doctl` ni `curl` contra producción.** Cuando
  una tarea pide un comando contra un servidor, se escribe para que lo corra una
  persona». Se escribió: es la tarjeta de §7.
- **F0.2** declara en su propio título «**solo si F0.1 dio 400**» (`:289`) y en su
  campo *Depende de* (`:292`). Sin la respuesta de F0.1 no tiene condición de
  arranque. Además toca `/var/www/Spaces/apps/web/.env` y recompila en el droplet:
  servidor otra vez.
- **F0.3** depende también de F0.1 (`:337`). Es la única de las tres que es de
  código y por tanto la única que un agente local podría haber hecho — y es la que
  quedó contradicha. Ver §4.

---

## 3. La premisa del título de la fase ya no es cierta

La fase se llama «**Cerrar el autoregistro fuera de DEMO**» (`:249`). Persigue una
asimetría: apagado en las instancias de owner, **encendido en DEMO**. Esa asimetría
**ya no existe**.

| Fecha | Decisión | Ancla |
|---|---|---|
| 2026-08-10 | P3b: el registro público es «**abierto y permanente**» | `vault/00-Indice/preguntas-abiertas.md:71` («*Decisión anterior, del 10/08, ya no vigente*») |
| 2026-08-13 | **P4-bis resuelta**: la bandera sale del build y se decide en el `.env` al arrancar | `vault/07-Agentes/ejecucion-plan-v3.md:31`; ejecutada en `70ca3f0` |
| **2026-08-14** | **Jochelo: CERRADO en local y en producción**, revirtiendo P3b | `ejecucion-plan-v3.md:206`; commit `0dbccb8` |
| **2026-08-14** | **Jochelo lo confirma para DEMO: cerrado también ahí.** «Ninguna instancia lo abre» | `ejecucion-plan-v3.md:207`; commit `39379bf` |

Texto literal de la bóveda hoy (`preguntas-abiertas.md:49-56`), leído al levantar
este expediente:

> **El autorregistro va CERRADO en TODAS partes: local, producción y DEMO.** Decisión
> de Jochelo del **2026-08-14**, que sustituye a la del 10/08 («abierto y
> permanente»). […] **Ninguna instancia lo abre.** La bandera `AUTOREGISTRO` existe y
> funciona (F2.6), pero hoy nadie la enciende.

**Consecuencia sobre esta fase:** el «fuera de DEMO» del título ya no distingue nada.
La bandera va apagada en todas partes, así que lo que la Fase 0 quería *asegurar en
unas instancias y no en otras* es ahora una condición uniforme de la flota.

---

## 4. F0.3 quedó contradicha en cuatro puntos por F2.6 (`70ca3f0`)

`70ca3f0 · feat(entorno): el autoregistro se decide al arrancar, no al compilar`
renombró `NEXT_PUBLIC_AUTOREGISTRO` → `AUTOREGISTRO` (18 archivos, +294/−92,
`git show --stat 70ca3f0`). Los cuatro puntos los levantó la auditoría de F2.6
(`ejecucion-plan-v3.md:200` y `:214`). **Los comprobé uno a uno abriendo el plan y el
árbol de hoy**; los cuatro se confirman.

### (a) Su regex no puede casar nunca

Plan `:346`:

```
       `/^NEXT_PUBLIC_AUTOREGISTRO=0$/m` en `.env.example`;
```

`git grep -n "AUTOREGISTRO" -- . ':!node_modules'` (hoy) no devuelve **ninguna**
aparición de `NEXT_PUBLIC_AUTOREGISTRO` en `.env.example`. Lo que hay es
`.env.example:33` → `AUTOREGISTRO=0`. La regex, anclada con `^…$/m`, no puede casar
con esa línea. Quien ejecute F0.3 literalmente escribiría una prueba que falla
siempre y concluiría que la plantilla está mal cuando está bien.

### (b) Declara como *nuevo* un archivo que ya existe

Plan `:338-339`:

```
- **Archivos:** `.env.example` (líneas 17-23 y línea 4);
  `apps/web/lib/entorno.test.ts` (nuevo).
```

`apps/web/lib/entorno.test.ts` **existe desde `70ca3f0`** — aparece en su
`--stat` como archivo nuevo de 39 líneas. Hoy tiene 39 líneas y **dos casos**, y
ninguno de los dos es el que F0.3 describe: no leen `.env.example`, prueban la
función `autoregistroActivo()` contra `process.env` (`entorno.test.ts:22` y `:32`).

### (c) Su paso 3 manda cambiar una cadena que ya no está

Plan `:352`:

```
  3. En `.env.example`, cambiar `NEXT_PUBLIC_AUTOREGISTRO=1` → `=0` y sustituir el
```

Esa cadena no existe en `.env.example`. El cambio de valor ya lo hizo **`0dbccb8`**
por otra vía (§5), y el renombrado lo hizo `70ca3f0`.

### (d) Su campo `Archivos:` apunta a líneas que hoy son comentarios — *la mitad*

Plan `:338` dice `.env.example` «líneas 17-23 y línea 4».

- **Líneas 17-23 hoy: todo comentario.** `:17-19` explican el prefijo `NEXT_PUBLIC_`;
  `:20` está en blanco; `:21-23` describen qué hace el auto-registro. La línea con
  valor está en **`:33`**. El plan `:51` lo dice aún más explícito y también está
  desfasado: «`.env.example` trae la bandera en `1` … **Coincide, y en la línea que
  decía** … `.env.example:23` → `NEXT_PUBLIC_AUTOREGISTRO=1`». Hoy `.env.example:23`
  es `# expuesto a internet: un registro anónimo aterriza en datos reales.`
- **Línea 4 sigue siendo correcta**, y esto es una precisión que el reporte de la
  auditoría no hacía: `.env.example:4` es todavía `COOKIE_DOMAIN=localhost`. El paso
  4 de F0.3 (`:357`, borrar esa línea) **sigue pendiente y sigue siendo aplicable**.

---

## 5. Lo que F0.3 quería, y qué parte está hecha hoy

Su objetivo (`:335-336`): «que la plantilla de entorno del repo nazca con el
autoregistro apagado **y** que una prueba impida volver atrás». Son dos cosas y hoy
está hecha **una**.

### 5.1 Hecho — la plantilla nace apagada (`0dbccb8`)

`.env.example:33` → `AUTOREGISTRO=0`, con seis líneas de comentario encima
(`:25-32`) que fechan la decisión y dicen dónde poner el `1` si alguien lo necesita
en su máquina:

```
# Decisión de Jochelo del 14/08/2026: CERRADO en local y en producción. Deja de
# ser cierto lo que decía P3b el 10/08 («abierto y permanente»). Si necesitas el
# alta para probar algo en tu máquina, pon 1 en tu `.env` — que no se versiona —
# y no aquí.
AUTOREGISTRO=0
```

El cuerpo de `0dbccb8` nombra el agujero por su nombre: «La plantilla del repo dejaba
el registro abierto en cualquier clon, **que era justo el agujero que F0.3 iba a
cerrar**».

`.env.production.example:39` ya estaba en `0` y hoy lleva además el aviso de que la
decisión alcanza a DEMO (`:36-38`, escrito por `39379bf`).

### 5.2 Hecho — la bandera está centralizada y probada (`70ca3f0`)

- `apps/web/lib/entorno.ts:26-27` es el único lugar que la lee:
  `return process.env.AUTOREGISTRO === '1'`. **Fail-closed**, y sus 25 líneas de
  cabecera explican por qué la polaridad se invirtió a propósito.
- Sus dos consumidores delegan, no releen: `apps/web/app/api/signup/route.ts:21`
  (`if (!autoregistroActivo())` → 503) y
  `apps/web/lib/server/google-oauth.ts:93-94` (`autoregistroHabilitado()` devuelve
  `autoregistroActivo()`), con el comentario `:90-92` que dice el porqué: «para que
  las dos puertas no puedan divergir».
- `apps/web/app/(app)/login/page.tsx:26-31` documenta que la página **ya no lee la
  variable**: pregunta a `/api/auth/metodos/`, que es `force-dynamic`
  (`apps/web/app/api/auth/metodos/route.ts:7`).
- El arnés e2e la fija explícita en `apps/web/lib/test/servidor-e2e.ts:57`
  (`AUTOREGISTRO: '0'`), con el razonamiento en `:50-56`.

**Corrido por mí hoy** (`cd apps/web && npx vitest run lib/entorno.test.ts`):

```
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  360ms
```

### 5.3 NO hecho — la prueba que impide volver atrás

Este es el punto que hay que dejar escrito sin adornos: **el criterio de aceptación
de F0.3 (`:360-362`) no se cumple hoy.**

> «un clon limpio del repo **no puede** producir un build con autoregistro abierto por
> descuido; si alguien lo reactiva en la plantilla, `npm test` se pone rojo en CI
> (`ci.yml:74-75`).»

Comprobado con `git grep -n "env.example" -- apps ':!node_modules'`: la única
aparición es un **comentario** en `apps/web/lib/server/integraciones.ts:16`. **Ningún
test lee `.env.example`.** Si alguien edita hoy `.env.example` y pone
`AUTOREGISTRO=1`, la suite sigue verde y el CI —`.github/workflows/ci.yml:74-75`,
`npx turbo run test --filter=web`— no dice nada.

`entorno.test.ts` prueba que **la función** obedece a la variable. No prueba que **la
plantilla** venga apagada. Son cosas distintas y solo una está cubierta.

### 5.4 NO hecho — el paso 4, `COOKIE_DOMAIN`

`.env.example:4` sigue siendo `COOKIE_DOMAIN=localhost`. La afirmación en que se apoya
F0.3 (`:348-350`, y también el plan `:56`) la reverifiqué y **se sostiene**:
`git grep -n "COOKIE_DOMAIN"` no devuelve ni un archivo de `apps/`; la única lectura
real está en `_archive/api/src/core/auth/auth.routes.ts:17`, que es la pista muerta.
`apps/web/lib/server/auth.ts:191` (`cookieSesion`) y `:216` (`cookieCsrf`) siguen sin
fijar `domain` — grep de `domain` sobre ese archivo: cero apariciones.

---

## 6. Lo que quedó probado, y con qué

| Afirmación | Comando que corrí hoy | Resultado |
|---|---|---|
| La bandera se lee al arrancar y obedece | `cd apps/web && npx vitest run lib/entorno.test.ts` | 1 archivo, 2 casos, verde, 360 ms |
| `NEXT_PUBLIC_AUTOREGISTRO` ya no existe como variable viva | `git grep -n "AUTOREGISTRO" -- . ':!node_modules'` | Solo aparece en comentarios, en los dos planes (`v2`, `v3`) y en dos `.txt` de despliegue antiguos |
| Ningún test ancla `.env.example` | `git grep -n "env.example" -- apps ':!node_modules'` | 1 resultado, y es un comentario |
| Los tres commits que sobrepasan la fase existen y tocan lo que dicen | `git show --stat 70ca3f0 0dbccb8 39379bf` | 18 / 6 / 4 archivos respectivamente |
| No hay commits de Fase 0 | `git log --oneline --all --grep="F0"` | 3 aciertos, ninguno ejecuta una tarea F0 |
| Cada `archivo:línea` citado arriba | abierto uno a uno con `cat -n` / `git grep -n` | ver §4 y §5 |

**Lo que NO corrí:** `npm test` completo ni `npm run test:e2e`. No hay ningún cambio
de esta fase que verificar con ellas —esta fase no cambió nada— y la suite e2e usa la
única base `spaces_e2e` con `drop schema public cascade`, con otro documentalista
trabajando en el mismo worktree. Las cifras vigentes vienen del cuerpo de `70ca3f0`
(**801 unitarias en 73 archivos**; e2e **13 archivos, 140 pasadas + 1 saltada**),
corrida del **2026-08-14**, y no las remedí.

---

## 7. Lo que NO quedó probado — con el mismo tamaño de letra

### 7.1 No sabemos si el autoregistro está abierto en el droplet. Esa es la fase entera.

F0.1 es toda la pregunta de la Fase 0 y **sigue sin respuesta**. El plan lo advierte
en su propia tabla de supuestos, `:171`:

| Hecho que los documentos o el contexto dan por bueno | Dónde se verifica |
|---|---|
| El autoregistro está apagado en el droplet actual (indicio: se aplicó el 2026-08-04) | **F0.1** |

«Indicio» es la palabra del plan, y sigue siendo eso: un indicio. Nadie ha mirado.

### 7.2 Aquí lo local no puede sustituir a producción, ni siquiera un poco

En otras fases la brecha es que la base del 5433 es *fixture* y sus ceros son
**ceros vacuos**. Aquí la brecha es peor y más simple: **el objeto de la verificación
no existe en local.** Lo que F0.1 pregunta es el contenido de
`/var/www/Spaces/apps/web/.env` en `209.97.146.136` y qué contesta un endpoint
público servido desde ahí. Ningún experimento en esta máquina lo aproxima:

- El `.env` local **no tiene la variable** (`ejecucion-plan-v3.md:206`), o sea que
  local está cerrado por fail-closed — dato que **no dice nada** del droplet.
- El droplet corre un build **anterior** a `70ca3f0`. Lee `NEXT_PUBLIC_AUTOREGISTRO`
  horneada, no `AUTOREGISTRO`. Ninguna prueba local ejercita ese código: en este árbol
  ya no existe.

### 7.3 El bloque que documenta esa imposibilidad ya envejeció

`apps/web/lib/test/aislamiento.e2e.test.ts:200-213` —citado por F0.1 en `:263` como
la razón de que esto no se pueda probar en la suite— **sigue exactamente en esas
líneas** (lo abrí), pero su contenido **ya es falso**: dice que la bandera «la INLINEA
Next en tiempo de BUILD, también en el código de servidor», y tras `70ca3f0` no se
inlinea nada. El propio commit lo reconoce y decide no tocarlo: «su bloque `:200-213`
queda obsoleto pero se retira en un release posterior (expand → contract)». El
`it.skip` de `:212` sigue ahí. **Es cobertura que sigue ausente por una razón que ya
no es la razón.**

### 7.4 F0.3 tiene descendencia, y la descendencia hereda el hueco

`Plan_Instancias_Soberanas_v3.md:1493` — **F5.3 depende de F0.3**. Y `:1496-1498` dice
que sus dos casos nuevos irán en `entorno.test.ts` afirmando que la plantilla de
instancia trae `NEXT_PUBLIC_AUTOREGISTRO=0` y ningún `COOKIE_DOMAIN`
(`:1504` y `:1510` repiten el nombre muerto). El recuento de pruebas del plan
(`:2037`) presupone **6 casos** en `entorno.test.ts` entre F0.3, F5.3 y F2.6; hoy hay
**2**. Quien llegue a F5.3 se encuentra con una dependencia declarada sobre una tarea
no ejecutada y con la misma variable muerta escrita tres veces.

---

## 8. Tarjeta humana viva — **TH-F0.1**

**Solo lectura.** La corre una persona. Es lo único que puede cerrar la Fase 0 de
verdad, y bloquea a F0.2 y —según `:260`— a **toda la Fase 4**.

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
| **400** | **Abierto** — un desconocido puede crear una organización en producción hoy | F0.2 «hoy mismo», con la corrección de §8.1 |
| 000, 429, 5xx | **No concluyente** | No se sigue hasta saber por qué |

**Paso 3** del plan (`:277-278`): anotar el resultado **con fecha** en
`docs/Registro_Cambios.md`, commit en el PADRE, sin tocar el servidor.

### 8.1 Si sale 400, F0.2 **no** se ejecuta como está escrita

Su `sed` (`:302-307`) opera sobre `^NEXT_PUBLIC_AUTOREGISTRO=`. Eso es correcto
**solo mientras el droplet siga corriendo el build anterior a `70ca3f0`**, y deja de
serlo el día que se despliegue la versión nueva. La orquestación ya registró el
cambio de sentido (`ejecucion-plan-v3.md:206`):

> «**La tarjeta humana del droplet cambia de sentido: ya no hay que poner
> `AUTOREGISTRO=1`, sino borrar la línea vieja y no poner nada.**»

Con el código de hoy, **ausente = cerrado** (`entorno.ts:26-27`), así que la acción
correcta sobre un droplet ya actualizado es **eliminar** cualquier
`NEXT_PUBLIC_AUTOREGISTRO=…` y no añadir nada. El respaldo previo del `.env` (`:298-301`)
y la recarga como el usuario dueño de la app, no como root (`:309-313`), siguen
siendo válidos tal cual.

**El plan NO se ha tocado.** Esta corrección vive aquí y en la bitácora de
orquestación, por la regla «no se replanea».

---

## 9. Commits ROJO pendientes de visto bueno humano

**De la Fase 0: ninguno**, porque no produjo commits.

Pero conviene que quien lea este expediente sepa que el trabajo que la sobrepasó sí
tiene uno esperando: **`70ca3f0` (F2.6) está marcado ROJO y pendiente de visto bueno
humano antes del merge** (`ejecucion-plan-v3.md:71`). Toca la puerta de entrada
pública y cambia la polaridad de una bandera de seguridad, así que cae de lleno en la
regla de oro de `zonas-de-riesgo`. `0dbccb8` y `39379bf` son de documentación y
plantillas (`.env.example`, `.env.production.example` y bóveda); no cambian código.

---

## 10. Decisiones de negocio de esta fase

### Tomadas

| Fecha | Decisión | Efecto sobre la Fase 0 |
|---|---|---|
| 2026-08-13 | **P4-bis: la bandera sale del build** (salida *b*), como ya se hizo con `GOOGLE_OAUTH` | Deja obsoleto el vocabulario entero de la fase: F0.2 hablaba de «recompilar» porque no había alternativa |
| 2026-08-14 | **P3b-bis: cerrado en local y en producción**, revirtiendo P3b del 10/08 | Ejecuta por otra vía la mitad del objetivo de F0.3 |
| 2026-08-14 | **P3b-bis, segunda mitad: cerrado también en DEMO** | Deja sin objeto el «fuera de DEMO» del título de la fase |

### Abiertas, y bloquean lo siguiente

- **P1 · destino del tenant `rgb` y del droplet actual.** Ver §11: con el registro
  cerrado en toda la flota, esta pregunta deja de ser de limpieza y pasa a ser la
  única vía de alta de organizaciones.
- **P4 · nombre del registry.** Bloquea F2.3 y F2.4 (`ejecucion-plan-v3.md:68-69`).
- **P2 · fecha de migración de PIXELED** y **P3 · cuenta de DigitalOcean**
  (`ejecucion-plan-v3.md:28-29`).
- **P6 · `/api/version` con token de flota o pública** (Fase 6, fuera de alcance).

---

## 11. La consecuencia que la fase no previó

Registrada el 14/08 en `ejecucion-plan-v3.md:208` y en
`preguntas-abiertas.md:62-69`. Con el registro cerrado en **todas** las instancias:

1. **`POST /api/signup` queda sin uso en toda la flota.** Su primera línea es
   `if (!autoregistroActivo())` → 503 (`apps/web/app/api/signup/route.ts:21-26`), y
   nadie enciende la bandera. `GET /api/auth/metodos/` devolverá siempre
   `autoregistro: false`.
2. **El alta de una organización nueva ya no tiene camino por la aplicación.** Lo
   único que queda es:
   - `db/schema.sql:598` →
     `insert into tenants (nombre, slug) values ('RGB Catorce','rgb') on conflict (slug) do nothing;`
   - `apps/web/scripts/bootstrap-auth.mjs:60` → `const TENANT_SLUG = 'rgb'`, resuelto
     **por slug y nunca por uuid** (el comentario de `:57-59` explica por qué), y con
     **aborto ruidoso si el tenant falta**: `bootstrap-auth.mjs:107-113` lanza
     «no existe la organización con slug "rgb"…» cuando el insert afecta 0 filas.
     Ese aborto es la decisión T-01b del 13/08 (`ejecucion-plan-v3.md:36`).
3. Por tanto **cada instancia nueva nacería con una organización llamada `rgb`** —
   el nombre de un cliente concreto convertido en valor por omisión de todo el
   producto. Enlaza directo con **P1**, que sigue abierta.

También queda un comentario caducado que nadie tocó por ser código:
`apps/web/app/api/signup/route.ts:15` sigue llamando a DEMO «la única con el registro
abierto». El punto que defiende (comprobar en el servidor y no solo en la UI) sigue
en pie; el ejemplo ya no. Declarado en el cuerpo de `39379bf`.

---

## 12. Lo que el plan afirmaba y el repositorio desmiente

Todo verificado hoy contra el árbol. **Ninguna de estas líneas del plan se ha
corregido**, por la regla «no se replanea»; la evidencia vive aquí.

| Línea del plan | Lo que afirma | Lo que hay hoy |
|---|---|---|
| `:51` | «`.env.example` trae la bandera en `1` … `.env.example:23` → `NEXT_PUBLIC_AUTOREGISTRO=1`» | `:23` es un comentario; la línea con valor es `:33` → `AUTOREGISTRO=0` |
| `:188` | La bandera se lee en `signup/route.ts:18`, `login/page.tsx:30`, `google-oauth.ts:90`, `servidor-e2e.ts:49` | Las cuatro citas derivaron y una desapareció: `signup/route.ts:21`, `google-oauth.ts:93-94`, `servidor-e2e.ts:57`, y **`login/page.tsx` ya no la lee** (`:26-31`) |
| `:338` | `Archivos: .env.example` líneas **17-23** | Hoy son comentario. La *línea 4* del mismo campo **sí** sigue vigente |
| `:339` | `apps/web/lib/entorno.test.ts` **(nuevo)** | Existe desde `70ca3f0`, con 2 casos que no son los de F0.3 |
| `:346` | regex `/^NEXT_PUBLIC_AUTOREGISTRO=0$/m` | No puede casar: la variable no existe con ese nombre |
| `:352` | cambiar `NEXT_PUBLIC_AUTOREGISTRO=1` → `=0` | Esa cadena no está en el archivo |
| `:302-307` | `sed` sobre `^NEXT_PUBLIC_AUTOREGISTRO=` en el droplet | Válido solo mientras el droplet corra el build viejo (§8.1) |
| `:1345` (F4.4) | `.env` de DEMO con `NEXT_PUBLIC_AUTOREGISTRO=1`, «la única instancia de toda la flota que lo lleva» | Doblemente contradicha: variable muerta **y** decisión revertida — DEMO va cerrada |
| `:1497`, `:1504` (F5.3) | La plantilla de instancia trae `NEXT_PUBLIC_AUTOREGISTRO=0` | Grabaría una variable muerta en el `.env` de todas las instancias |
| `:2037` | `entorno.test.ts` tendrá **6** casos (F0.3 + F5.3 + F2.6) | Tiene **2** |
| `:263` / `aislamiento.e2e.test.ts:200-213` | «la bandera se hornea en el build» | Falso desde `70ca3f0`; el bloque sigue en pie, marcado para retirarse |

---

## 13. Pendientes declarados al cerrar el expediente de la Fase 0

- [ ] **TH-F0.1** — el `curl` y el `grep` por `ssh` del §8. **Desbloquea F0.2 y, según
      el plan `:260`, toda la Fase 4.** Es lo único que puede responder la pregunta que
      da nombre a la fase.
- [ ] **F0.2**, solo si TH-F0.1 devuelve 400, y **con la corrección de §8.1**: no
      poner `AUTOREGISTRO=1`, sino borrar la línea vieja.
- [ ] **La prueba que impide volver atrás (§5.3).** Es lo único de F0.3 que sigue sin
      hacerse y sin sustituto: hoy nadie impide que `.env.example` vuelva a `=1`.
      Su forma correcta hoy sería `/^AUTOREGISTRO=0$/m`, no la del plan.
- [ ] **Paso 4 de F0.3 (§5.4)** — borrar `COOKIE_DOMAIN=localhost` de `.env.example:4`
      con el comentario de por qué las cookies son host-only.
- [ ] **Visto bueno humano de `70ca3f0`** (ROJO), sin el cual no se mergea el trabajo
      que sobrepasó esta fase.
- [ ] **Retirar `aislamiento.e2e.test.ts:200-213`** en el release de *contract*, tal
      como anunció `70ca3f0`.
- [ ] **Decidir P1** antes de aprovisionar la primera instancia nueva: hoy nacería
      llamándose `rgb` (§11).

---

## 14. Nota de entorno

- Worktree `.claude/worktrees/servidor-padre` sobre `feat/servidor-padre-instancias`,
  HEAD `42c0f4e`. Todo lo de este expediente se comprobó **en este árbol**.
- **No se tocó ningún servidor.** Cero `ssh`, cero `curl` remoto, cero `doctl`. Esa
  es, literalmente, la razón de que la Fase 0 no se ejecutara.
- **No se consultó la base `spaces` del 5433** al levantar este expediente: esta fase
  no tiene ninguna afirmación que dependa de datos. La única suite que corrí
  (`lib/entorno.test.ts`) es unitaria y no toca Postgres.
- **Sin capturas.** No hay pantalla que enseñar: la evidencia de esta fase son
  salidas de comando y líneas de archivo. El único efecto visible —el botón «Crear
  cuenta» desapareciendo del login— es de F2.6 y su evidencia está medida al byte en
  el expediente de esa fase, no aquí.
- Mientras se levantaba este expediente había **otro documentalista trabajando en el
  mismo worktree** (`docs/evidencias/fase-2.md`). Por eso este commit stagea **solo
  `docs/evidencias/fase-0.md`**, por ruta explícita.

---

*Levantado el 2026-08-14 contra `42c0f4e`. La Fase 0 la declara —o la da por
sobrepasada— el orquestador en `vault/07-Agentes/ejecucion-plan-v3.md`, no este
documento.*
