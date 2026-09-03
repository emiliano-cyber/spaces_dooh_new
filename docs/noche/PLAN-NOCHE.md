# Plan de trabajo nocturno — Fases 5, 6 y 8 (solo repo, sin servidor)

**Autoridad:** `docs/Plan_Instancias_Soberanas_v3.md` (plan v3, modelo de despliegue por instancias
soberanas). La corrección del 12/08 (`2026-08-12-correccion-modelo-instancias-space-os.pdf`) **no
está en el repo**; sus cuatro decisiones de §8 se leen en la **§4.4 del v3**, que las resume con lo
que cambia según cada respuesta. Ningún agente la busca.
Este documento no reinventa nada: reparte las tareas que el v3 ya definió entre agentes
que pueden correr sin supervisión, y marca con una línea roja todo lo que necesita una persona.

**Rama de trabajo:** `feat/servidor-padre-instancias`, en **árbol único y olas secuenciales** (§5).

> [!important] Corrida **de día y SUPERVISADA** — 2026-08-26, reescrito a mediodía
> La corrida nocturna **nunca llegó a ejecutarse**. Este documento se reescribe para
> correrlo **ahora, con Jochelo delante**, y eso cambia tres reglas de fondo:
>
> 1. **Se pregunta.** El §7 original prohibía preguntar porque nadie estaba
>    despierto. Ahora sí lo está: una decisión bloqueante **se pregunta en el
>    momento**, no se aparca a un archivo que se lee por la mañana. Aparcar sigue
>    siendo válido para lo que no depende de una respuesta.
> 2. **`git push` está permitido** en esta corrida, porque hay quien la mira. Sigue
>    prohibido `git tag` y todo lo que toque infraestructura viva.
> 3. **La Ola 1 ya no está entera:** `altas-transaccionales` está **HECHA**. Ver §0.

---

## 0. Estado al arrancar esta corrida

Medido contra el repo el 2026-08-26 a mediodía, no recordado.

| Agente / tarea | Estado | Evidencia |
|---|---|---|
| `altas-transaccionales` · **F5.1** | ✅ **HECHA** | `0b1ce71` (rojo) + `eef43d1` — `withTxBootstrap` en `db.ts`; la organización y su Dueño nacen juntos o no nacen |
| `altas-transaccionales` · **F5.2** | ✅ **HECHA** | `3ad2cec` (rojo) + `653f992` + `0b7e10a` — `POST /api/bootstrap`, tres cerrojos, y la exención de CSRF acotada con pruebas |
| `plantillas-instancia` · F5.3 | ✅ **HECHA** | `2dace9a` (rojo) + `7aae6ae` + `09ac35d`. **DOS** plantillas de entorno, no una: `update.sh` ya separaba la suya de la de la app |
| `endpoint-flota` · F6.1, F5.8 | ✅ **HECHA** | `6c57ac1` (rojo) + `65b8ed1`. `SALUD_URL` pasa a tocar la base: la anterior contestaba 200 con Postgres muerto |
| `aprovisionamiento` · F5.4, F5.5 | ✅ **HECHA** | F5.4 en `92ebb41`. F5.5 **preparada y sin fusionar** en `chore/retirar-scripts-pista-archivada` (`ec25eb4`), porque depende de F3.6 |
| `panel-flota` · F6.2, F6.4 | 🚧 **en curso** | agente lanzado en modo automatico |
| `cierre-documental` · F8.1, F8.3 | 🚧 **en curso** | agente lanzado en modo automatico |
| `verificador-noche` | ⬜ al final | — |

**Quedaban 9 tareas. Hechas 5** (F5.3, F5.4, F5.5-preparada, F5.8-código, F6.1);
**4 en curso** con agentes (F6.2, F6.4, F8.1, F8.3).

> **Puertas 1 y 2 pasadas**, con su evidencia en `docs/noche/bitacora-2026-08-26.md`.

> [!warning] El ADR que la Ola 4 iba a crear tiene el número ocupado
> El plan dice `docs/adr/0014-instancia-dedicada-por-owner.md`. **El 0014 ya existe**
> y es `0014-postgres-en-el-droplet-o-base-administrada.md`. Entre anoche y hoy se
> escribieron además el 0018, 0019, 0020 y 0021. **F8.1 usa el `0022`.**

> [!note] Dos notas de la bóveda que la Ola 4 toca cambiaron esta mañana
> `vault/01-Arquitectura/entorno-y-despliegue.md` se editó hoy (ADR 0021, la
> reversión de `demo.space-os.io`). El agente de la Ola 4 **lee su estado actual
> antes de escribir**, no el que este plan suponía anoche.

---

## 1. Línea roja — lo que ningún agente hace jamás

Estas prohibiciones no son consejos. Un agente que las cruce se detiene y escribe en la bitácora.

| Prohibido | Por qué |
|---|---|
| `ssh`, `scp`, `rsync` a cualquier host | El v3 no ejecutó nada contra servidores y esta corrida tampoco |
| `curl` / `wget` contra producción, DEMO o cualquier dominio real | Igual |
| `doctl`, `aws`, `s3cmd`, `certbot`, `nginx -s`, `pm2` | Infraestructura viva |
| ~~`git push`~~, `git tag`, `gh workflow run`, `gh run` | **`git push` PERMITIDO en esta corrida** (es supervisada). El resto sigue prohibido |
| `docker push`, tocar el registry | §8.4 sin decidir |
| Abrir `apps/web/lib/test/aislamiento.e2e.test.ts` | Invariante 7. Ni para leer y editar: si una tarea obliga a editarlo, **esa tarea rompió el comportamiento de hoy** → detenerse |
| Tocar `db/schema.sql` | Invariante 8: los cambios de esquema van por migración |
| Tocar `apps/web/lib/test/servidor-e2e.ts` | El v3 lo dice explícito: no se toca en todo el plan |
| Escribir un valor real de registry, dominio, IP o token en una plantilla | Van como parámetro (`REGISTRY`, `__DOMINIO__`) |
| Decidir P1, P2, P3, P4 o P4-bis | Las decide Jochelo. El agente las señala |

`git commit` **sí** está permitido y es obligatorio: una tarea = un commit con sentido.
**`git push` también, en esta corrida**, porque Jochelo la está mirando — no es la
regla general del repo.

- **Alternativas a lo denegado:** en vez de `find … | xargs rg`, usa `rg` directo, `find -exec` o
  `git ls-files`. En vez de `env VAR=x cmd`, exporta la variable en una línea aparte. `xargs` y
  `env` están denegados a propósito y no se piden de vuelta.
- **Un permiso denegado NO se rodea.** Ni con otra forma del comando, ni metiéndolo en un script,
  ni con `bash -c`. Un deny es la línea roja hablando: se aparca esa parte de la tarea, se escribe
  la entrada de decisión si hace falta, y se sigue con el resto.

---

## 2. Fuera de alcance esta noche (las hace la persona)

- **F3.5** ensayo de update en DEMO — necesita servidor.
- **F3.6** retirar `deploy.yml` — es el único mecanismo de despliegue mientras el droplet actual
  siga siendo la producción de los tenants reales.
- **F4.5** smoke de DEMO y cierre del riesgo.
- **F5.6** ensayo de aprovisionamiento en droplet desechable.
- **F5.7** alta de la primera instancia de owner — bloqueada por §8.2 y §8.3.
- **F6.3** smoke del panel — necesita DEMO viva.
- **F7.x** Fase 7 completa.

F2.6 **ya no está aquí ni en ninguna ola**: está aplicada en el código desde el 2026-08-14. Ver
la ola 5 (retirada) y la nota de P4-bis en §8.

Todo lo demás de las fases 5, 6 y 8 es código, plantillas o documentos: se hace esta noche.

---

## 3. Invariantes que todo agente respeta (v3, «Restricciones globales»)

1. Nadie edita código en el servidor de una instancia. Todo nace en el PADRE.
2. El update es pull. El padre no empuja ni entra por SSH (excepción: aprovisionamiento inicial).
3. El artefacto es idéntico para todas las instancias. Lo que cambia vive en su base y su `.env`.
4. `tenantActual()` no aprende a leer el `Host`; las cookies siguen sin `domain`.
5. `qRaw` solo sobre tablas exentas de RLS; lo que lee `config_negocio` usa `qConTenant`.
6. La RLS no se retira.
7. `aislamiento.e2e.test.ts` pasa sin modificarlo.
8. Migraciones transaccionales, idempotentes, expand → contract.
9. **El autoregistro esta CERRADO en toda la flota, DEMO incluida** (P8, 2026-08-20).
   Solo `AUTOREGISTRO=1` enciende; ausente o cualquier otro valor deja cerrado
   (`lib/entorno.ts:23-26`, F2.6), y las plantillas nacen en `0`
   (`infra/env/app.env.example:80`), anclado por prueba y no por memoria
   (`entorno.test.ts:143,197`). Una empresa nace por `/api/bootstrap`, **una sola vez
   por instancia**, y su Dueno da de alta a su equipo desde dentro. *(Hasta el
   2026-09-03 este invariante decia «Autoregistro encendido solo en DEMO»: quedo
   desfasado el 20/08 y estuvo veinte dias diciendo lo contrario de lo decidido.)*
10. Commits en español, `tipo(ámbito): descripción en minúscula`.
11. Al terminar cada tanda: entrada en `docs/Registro_Cambios.md` y revisión de `vault/`.
12. Dos suites: `npm test` y `npm run test:e2e`.
13. Ninguna tarea corre en la instancia de un owner sin pasar antes por DEMO.
14. Una instancia no le pregunta nada al padre para arrancar.

**Disciplina de prueba, sin excepción:** primero se escribe la prueba, se corre y **se ve en rojo**;
solo entonces se implementa. Un agente que no puede mostrar el rojo en la bitácora no ha hecho la
tarea. Los casos negativos son el corazón: el insert que debe truncar, el tenant huérfano que no
debe existir, el bootstrap que no debe crear una segunda organización, el token que no debe revelar
la versión.

**Regla de honestidad:** si al abrir un archivo el repo no dice lo que el v3 afirma que dice
(línea distinta, función renombrada, columna con otro nombre), el agente **no adivina**: anota el
hallazgo en la bitácora con la referencia real, marca `[SIN VERIFICAR]` lo que no pudo comprobar y
sigue solo si el cambio no altera el diseño. Si lo altera, se detiene.

---

## 4. La cola, por olas

Las olas existen por dependencia real y por propiedad de archivos. Dentro de una ola los conjuntos
de archivos son **disjuntos**, así que los agentes *podrían* correr en paralelo — pero **el modo por
defecto es secuencial** (§5): van uno detrás de otro en un solo árbol. Entre olas hay una puerta.

### Ola 1 — cimientos (~~3~~ **2 agentes**: el primero ya está hecho)

| Agente | Tareas | Archivos que posee |
|---|---|---|
| ~~`altas-transaccionales`~~ ✅ **HECHA** | ~~F5.1, F5.2~~ | `apps/web/lib/server/db.ts` (añadir al final), `usuarios-repo.ts`, `cuentas-controller.ts`, `app/api/bootstrap/route.ts` (nuevo), `middleware.ts` (solo la lista de exentas de CSRF, `:55-65`), `lib/test/alta-organizacion.e2e.test.ts` (nuevo), `lib/test/bootstrap.e2e.test.ts` (nuevo) |
| `plantillas-instancia` | F5.3 | `infra/env/instancia.env.example` (nuevo), `infra/nginx/instancia.conf.tpl` (nuevo), `apps/web/lib/entorno.test.ts` (crece) |
| `endpoint-flota` | F6.1, F5.8 (lado código) | `app/api/version/route.ts` (nuevo), `lib/test/version.e2e.test.ts` (nuevo), `infra/scripts/update.sh` (**solo** la línea `SALUD_URL`) |

> `infra/scripts/update.sh` lo toca `endpoint-flota` en esta ola y `panel-flota` en la ola 3.
> Nunca los dos a la vez. Si `panel-flota` lo encuentra bloqueado, espera.

**Puerta 1:** `npm test` y `npm run test:e2e` en verde, `aislamiento.e2e.test.ts` intacto
(`git diff --stat` no lo menciona), ~~tres~~ **dos** commits nuevos en el log.

> El verde de partida, medido hoy antes de arrancar: **858 unitarias en 79 archivos**
> y **e2e 22 archivos, 227 pruebas + 1 omitida**. Cualquier cifra por debajo de esa
> al cerrar la puerta significa que algo se rompió, no que «faltan pruebas».

### Ola 2 — aprovisionamiento (1 agente)

| Agente | Tareas | Archivos |
|---|---|---|
| `aprovisionamiento` | F5.4, F5.5 (**preparada, no aplicada**) | `infra/scripts/provision-instancia.sh` (nuevo), `docs/runbook-alta-de-owner.md` (nuevo), `infra/scripts/README.md` (nuevo), `infra/scripts/setup-droplet.sh` (solo el bloque final `:82-106`) |

F5.4 depende de F5.2 y F5.3 (ola 1). Depende también de F3.4 y F2.4, que ya existen.
F5.5 depende de **F3.6, que la hace la persona**: el borrado de los cuatro scripts se deja en una
rama aparte `chore/retirar-scripts-pista-archivada`, sin fusionar, con el `rg` de comprobación ya
corrido y su salida pegada en la bitácora. No se borra nada de `main` esta noche.

**Puerta 2:** el script pasa `bash -n` y `shellcheck` si está disponible; `--dry-run` no ejecuta
nada; `rg -n "space-os\.io" infra/env infra/nginx/instancia.conf.tpl` devuelve solo comentarios.

### Ola 3 — panel de flota (1 agente)

| Agente | Tareas | Archivos |
|---|---|---|
| `panel-flota` | F6.2, F6.4 | `apps/flota/` completo (`package.json`, `flota.json`, `estado.mjs`, `estado.test.ts`, `reporte.mjs`, `estado/`, `README.md`), `infra/scripts/update.sh` (el emisor del reporte) |

**Puerta 3:** `cd apps/flota && npx vitest run estado.test.ts` en verde;
`node estado.mjs` con una instancia inventada e inalcanzable devuelve **salida 0**;
`rg -n "token" apps/flota/flota.json` sin resultados.

### Ola 4 — cierre documental (1 agente)

| Agente | Tareas | Archivos |
|---|---|---|
| `cierre-documental` | F8.1, F8.3 | `docs/adr/0022-instancia-dedicada-por-owner.md` (nuevo — **el 0014 está ocupado**, ver §0), `vault/02-Backend/multi-tenancy-y-rls.md`, `vault/01-Arquitectura/entorno-y-despliegue.md`, `docs/Registro_Cambios.md` |

F8.2 (poner el aviso de ARCHIVADO en los dos documentos del 11) **no se hace**: viven fuera del
repo, en `C:\Users\Server\Downloads\server padre\`. El agente deja el texto exacto a pegar en la
bitácora, para que la persona lo copie.

**Puerta 4:** `rg -n "una sola base|UN proceso|todas las empresas a la vez|21 tablas" vault/` sin
resultados fuera de secciones marcadas como historia.

### Ola 5 — retirada

**No existe.** Su única tarea era F2.6, y F2.6 **ya está aplicada en el código**: la bandera
se llama `AUTOREGISTRO` (sin prefijo `NEXT_PUBLIC_`), la lee `autoregistroActivo()` en
`apps/web/lib/entorno.ts:26-28`, es fail-closed (`=== '1'`) y `login/page.tsx` la recibe por
`api/auth/metodos` (`:78,83`) — no por props. Registrado en `docs/Registro_Cambios.md` el
2026-08-14. Ver §8 sobre lo que eso implica para P4-bis.

### Ola 6 — auditoría (1 agente, solo lectura)

| Agente | Tarea |
|---|---|
| `verificador-noche` | Corre las dos suites completas, audita los 14 invariantes contra el diff de la noche, cuenta las pruebas nuevas y sus negativos, revisa que el archivo de decisiones esté bien escrito, y escribe el informe de la mañana |

El `verificador-noche` **no escribe código**. Solo lee, corre pruebas y escribe
`docs/noche/informe-<fecha>.md`. También se invoca en cada puerta.

---

## 5. Aislamiento entre agentes

**El modo por defecto es árbol único con olas estrictamente secuenciales.** Un solo árbol, un agente
detrás de otro, sin worktrees y sin paralelismo. Más lento y **cero conflictos**.

Es lo que corre esta noche salvo que una persona diga lo contrario. El motivo es que la corrida
todavía no ha funcionado nunca de principio a fin: un conflicto de fusión a las tres de la mañana,
sin nadie mirando, no lo resuelve nadie hasta el desayuno, y deja el árbol sucio — que es lo único
que detiene la corrida de verdad. La velocidad es lo primero que se sacrifica mientras no haya
noches en verde detrás.

**El paralelismo se habilita a mano, y solo cuando la corrida haya funcionado una noche entera.**
La forma, para cuando llegue ese día:

- **Worktree por ola** (el repo ya trabaja así: `.claude\worktrees\servidor-padre`).
  `git worktree add ../noche-ola1 -b noche/ola1` y así. La fusión la hace el orquestador al pasar
  cada puerta, con `--no-ff` para que la ola quede legible en el log.
- Solo la **ola 1** tiene tres agentes con archivos disjuntos; las demás llevan uno solo, así que el
  paralelismo no les cambia nada. Lo que se gana es el tiempo de una ola, no el de la noche.
- Y aun entonces, `middleware.ts` y `update.sh` los rozan varias tareas: el plan les asigna dueño
  único por ola justamente para esto.

Dentro de una ola, el orquestador nunca lanza dos agentes que compartan un archivo. Si la cola se
altera y aparece un solapamiento, el orquestador serializa: es más barato esperar que resolver un
conflicto a las tres de la mañana sin nadie mirando.

---

## 6. Bitácora

Cada agente escribe en `docs/noche/bitacora-<fecha>.md`, **añadiendo al final, nunca reescribiendo**,
un bloque por tarea:

```
## F5.1 — withTxBootstrap  [agente: altas-transaccionales]  [hh:mm]
Rojo: <comando> → <N casos fallando, cuál y por qué>
Verde: <comando> → <N pasando>
Archivos: <lista>
Commit: <hash corto> <mensaje>
Hallazgos: <lo que el repo dice y el v3 no, o [SIN VERIFICAR]>
Para la persona: <nada | lo que hay que revisar antes de empujar>
```

Un bloque sin la línea `Rojo:` es una tarea no hecha, aunque el código esté escrito.

---

## 7. Modo supervisado: preguntar en el momento, aparcar solo lo que sobra

> [!important] Esta sección se reescribió el 2026-08-26. La corrida es **de día y
> con Jochelo delante**, no desatendida.

La versión original prohibía preguntar porque nadie estaba despierto. Hoy sí lo está, y eso
invierte la primera regla. Las tres que gobiernan esta corrida:

1. **Lo que bloquea, se pregunta AHORA.** Una pregunta contestada en dos minutos vale más que
   una entrada perfecta en un archivo que se lee mañana. La pregunta va con sus opciones y con
   lo que el repo ya dice al respecto, igual de bien escrita que si fuera al archivo — solo que
   se hace en voz alta.
2. **Sigue prohibido elegir por Jochelo.** Esto NO cambia. Que haya alguien delante no autoriza a
   decidir P1–P4 ni P4-bis sin preguntar; autoriza a preguntarlas antes, no a saltárselas.
3. **Se aparca lo que no depende de una respuesta humana** —una dependencia técnica que aún no
   existe, una tarea de servidor— y se sigue. Aparcar por falta de respuesta ya no aplica: la
   respuesta se pide.

**El archivo de decisiones (§8) se sigue escribiendo**, con las que se hayan preguntado y su
respuesta anotada. Es el registro de qué se decidió y cuándo, no un buzón.

### Aparcar una tarea

Cuando una tarea necesita una respuesta humana, el agente:

1. **Deja el árbol limpio.** Lo que ya esté completo y verde se commitea. Lo que esté a medias se va
   a una rama `aparcada/<FX.Y>-<motivo-corto>` o a un `git stash push -m "aparcada/<FX.Y>"`. Nunca
   se deja un archivo a medias en la rama de trabajo.
2. **Escribe la entrada en `docs/noche/DECISIONES-<fecha>.md`** con el formato de §8. Esa entrada es
   el producto de la tarea aparcada: si está mal escrita, la mañana se pierde igual.
3. **Anota el bloque en la bitácora** con `Estado: APARCADA` y el motivo en una línea.
4. **Devuelve el control al orquestador y sigue con la siguiente tarea suya**, si tiene otra.

### Qué se aparca y qué no

| Situación | Qué hace el agente |
|---|---|
| Hace falta una de las decisiones de §8 (P1–P4, P4-bis) o P5/P6 | **Aparca** y escribe la entrada. No elige camino |
| El repo contradice el v3 en algo que **cambia el diseño** | **Aparca** y escribe la entrada con la referencia real de hoy |
| El repo contradice el v3 en una **línea o un nombre** | **Sigue**, usa la referencia real y lo anota como hallazgo |
| Una suite se pone roja y dos intentos no la arreglan | **Revierte su propio commit**, aparca la tarea, y deja el diagnóstico en la entrada. El árbol vuelve al verde de partida |
| La tarea obligaría a editar `aislamiento.e2e.test.ts` o `db/schema.sql` | **Aparca de inmediato.** No es una decisión que se pueda tomar por la mañana con un sí: es señal de que la tarea rompió el comportamiento de hoy, y eso va en la entrada como hallazgo grave |
| Aparece la tentación de tocar un servidor | **Aparca** la parte que lo necesite y sigue con la parte que no. Nunca se cruza la línea roja, ni «solo para comprobar» |

### La cascada de dependencias

Aparcar una tarea aparca **automáticamente** las que dependían de ella. El orquestador no lanza un
agente cuya entrada no existe. La cascada se escribe explícita en el informe: «F5.4 aparcada ⇒ F5.5
no se preparó ⇒ el README de `infra/scripts/` queda sin escribir». Sin esa línea, por la mañana
parece que faltó tiempo cuando faltó una respuesta.

Si una ola entera queda aparcada, el orquestador **salta a la siguiente** y lo dice. No se queda
esperando.

### La noche solo se detiene por una razón

Que el árbol no se pueda dejar limpio: un conflicto de fusión que el orquestador no sepa resolver,
o un `git` en estado raro. En ese caso commitea lo que esté completo, deja lo demás en un stash
nombrado, y escribe el motivo **en la primera línea del informe**. Todo lo demás se aparca y la
corrida continúa.

---

## 8. El archivo de decisiones

> [!warning] P4-bis quedó resuelta **de hecho**, hacia la salida (b)
> Nadie la contestó: el código la contestó. La bandera del autoregistro salió del build el
> 2026-08-14 (`AUTOREGISTRO`, fail-closed, en `apps/web/lib/entorno.ts:26-28`; el login la recibe
> por `api/auth/metodos`). Eso **es** la salida (b), y ningún agente debe volver a plantearla.
>
> **Lo que arrastra, y conviene que Jochelo lo confirme aunque el código ya lo haya decidido:** la
> salida (b) implica **UNA sola imagen por versión** en F2.3 — no dos. Si en algún momento se
> quisiera volver a la salida (a), habría que deshacer trabajo ya hecho y publicado, no solo elegir
> otra opción. Una decisión tomada por el código sigue siendo una decisión, y esta no pasó por él.

`docs/noche/DECISIONES-<fecha>.md`. Es el único documento que se escribe pensando en que alguien lo
contesta. Se lee de pie, con el teléfono en la mano, antes del café. Por eso: **una entrada por
decisión, ordenadas por cuánto desbloquean, y respondibles con una palabra.**

Formato obligatorio de cada entrada:

```
### D<n> · <la pregunta, en una línea>
Bloquea:      <FX.Y, FX.Z…> y en cascada <…>
Dónde muerde: <archivo:línea o paso exacto del script>
Referencia:   <§8.3 del documento del 12 | P4-bis del v3 | nueva>

Opción A — <nombre>
  Qué implica:  <consecuencia técnica concreta>
  Qué cuesta:   <trabajo, dinero o riesgo>
  Qué se hace mañana: <la tarea concreta que se desbloquea>

Opción B — <nombre>
  (igual)

Lo que el repo ya dice al respecto: <precedente real, con referencia; o «nada»>
Lo que NO cambia según la respuesta: <para que la decisión se vea pequeña cuando es pequeña>

TU RESPUESTA: ____
```

Tres reglas sobre este archivo:

- **Nunca se escribe una recomendación disfrazada de opción.** Si un camino tiene precedente en el
  repo, eso va en «lo que el repo ya dice», con su referencia, y Jochelo saca su propia conclusión.
  El v3 hizo exactamente eso con P4-bis: dijo que la salida (b) tiene precedente en `GOOGLE_OAUTH`
  (`.env.example:38-46`, ADR 0012 decisión 5) y aun así no la eligió.
- **Ninguna entrada duplica otra.** Si dos tareas se aparcan por la misma pregunta, es **una**
  entrada con dos tareas en «Bloquea».
- **Si no hay decisiones, el archivo se crea igual**, con una sola línea: «Ninguna. Las N tareas
  previstas se completaron.» Su ausencia es ambigua; su presencia vacía no lo es.

### Reanudar por la mañana

Rellenas los `TU RESPUESTA:` y lanzas `/noche continuar`. El orquestador lee el archivo, recupera
las ramas y stashes `aparcada/*`, y ejecuta lo que la respuesta desbloquea. Una entrada sin
responder se queda aparcada; no se adivina.

---

## 9. Lo que la persona encuentra por la mañana

Por orden de lectura, y pensado para que los tres primeros se lean en cinco minutos:

1. **`docs/noche/DECISIONES-<fecha>.md`** — lo primero. Preguntas respondibles con una palabra, en
   orden de cuánto desbloquean. Se contesta, se lanza `/noche continuar`.
2. **`docs/noche/informe-<fecha>.md`** — el veredicto en la primera línea: qué olas cerraron, qué se
   aparcó y por qué, y la cascada de cada aparcada.
3. **`docs/noche/bitacora-<fecha>.md`** — el detalle, tarea por tarea, con el rojo y el verde de
   cada prueba.
4. Un log de commits en español, uno por tarea, **sin empujar**.
5. Las ramas y stashes que esperan: `chore/retirar-scripts-pista-archivada` (espera a F3.6),
   `feat/autoregistro-en-arranque` si se preparó (espera a P4-bis), y cualquier `aparcada/*`.
6. Las dos suites en el mismo verde en que las dejaste, o el motivo escrito de por qué no.

El árbol está limpio y `main` no cambió. Nada de lo que la noche hizo está a medias en la rama de
trabajo: o está commiteado y verde, o está en una rama aparcada con su entrada de decisión.
