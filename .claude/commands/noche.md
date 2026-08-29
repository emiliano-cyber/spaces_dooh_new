---
description: Orquesta el trabajo nocturno desatendido de las fases 5, 6 y 8 del plan v3 (solo repo, sin servidor)
argument-hint: [todo|ola1|ola2|ola3|ola4|continuar|informe] [hasta=HH:MM]
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(git worktree:*), Bash(git checkout:*), Bash(git merge:*), Bash(git stash:*), Bash(npm test:*), Bash(npm run:*), Bash(date:*), Task, TodoWrite, Write, Edit
---

# Orquestador de la noche

Eres el orquestador de una corrida **desatendida**. Nadie está despierto. Nadie va a contestar una
pregunta tuya. Todo lo que decidas por tu cuenta se queda sin revisar hasta la mañana, y por eso no
decides nada.

**No escribes código de producto.** Escribes tres archivos: la bitácora, el archivo de decisiones y
el informe.

## La regla que gobierna la noche

Cuando algo necesita una respuesta humana: **aparcas la tarea y sigues con la siguiente.** No paras
la corrida, no eliges «lo razonable», no dejas un archivo a medias. Lee la §7 del plan antes de
lanzar el primer agente; es el corazón de esta corrida.

## Antes de arrancar

1. Lee `docs/noche/PLAN-NOCHE.md` completo. Es tu contrato.
2. `git status` — el árbol tiene que estar limpio. Si no lo está, **no arrancas**: escribe el motivo
   en un informe de una línea y termina. No arrastras trabajo ajeno dentro de la noche.
3. `git log --oneline -5` y confirma la rama `feat/servidor-padre-instancias`.
4. **Estado de partida.** Busca `docs/noche/preflight-<fecha>.md` con la fecha de HOY (`date +%F`).
   Lo aceptas **si y solo si** se cumplen las **cuatro**:

   - el archivo es **de hoy**;
   - `git status` está **limpio**;
   - los **cuatro hashes de árbol** que registra coinciden con los de hoy:
     `git rev-parse HEAD:apps HEAD:db HEAD:package.json HEAD:package-lock.json`;
   - **`apps/web/.next/BUILD_ID` existe.**

   Si las cuatro se cumplen, tomas de ahí las dos cifras y **no corres las suites**: te ahorras unos
   quince minutos y el riesgo del rojo falso.

   **Si los hashes cuadran pero falta `BUILD_ID`** (alguien limpió `.next`), **no corras las
   suites**: rehaz **solo** el build (`cd apps/web && npm run build`) y acepta las cifras. El build
   no cambia lo que las pruebas miden; solo hace falta para que el servidor e2e arranque.

   **Si algún hash no cuadra**, el código, el esquema o las dependencias cambiaron desde la medición:
   corres **las dos suites** tú, con el build antes:

   ```
   cd apps/web && npm run build && npm run test:e2e   # 61 s con el build hecho
   ```

   > **Por qué cuatro hashes de árbol y no el de HEAD.** El de HEAD cambia con cualquier commit,
   > incluido uno que solo toque documentos — y el preflight vive en `docs/`, así que el commit que
   > lo guarda invalidaría su propia línea: **ningún archivo puede contener el hash del commit que
   > lo contiene.** Los cuatro hashes identifican lo que las pruebas de verdad miden. Un commit que
   > solo toca `docs/`, `.claude/` o `vault/` los deja intactos, y las cifras siguen valiendo.

   Corras lo que corras, anota el resultado. Si alguna está roja de entrada, no arrancas: nadie
   podría distinguir tu rojo del que ya estaba.

   **Las e2e exigen un build hecho ANTES, o mueren TODAS en falso.** `apps/web/lib/test/servidor-e2e.ts`
   arranca el servidor con `npx next start`, que **reutiliza el build existente y no construye nada**.
   Sin `.next/BUILD_ID` **todos** los archivos e2e fallan con «El servidor de pruebas no respondió … tras
   60 s» — y tardan **636 s** en hacerlo. El orden es:

   ```
   cd apps/web && npm run build && npm run test:e2e   # 61 s con el build hecho
   ```

   Si el worktree está recién creado, antes de eso hacen falta `npm install` y las copias de
   `apps/web/.env` y `apps/web/.env.local`. Sin ellas no corre ni la primera prueba.

   > **Si todos los archivos e2e fallan a la vez, la causa probable es el build ausente, no el código.**
   > (Un recuento caduca —eran 12, hoy son 20—; el patrón no: o caen todos, o el build está.)
   > Rehaz el build y repite **antes de concluir nada**. Ese rojo no dice nada del árbol: dice que
   > falta el build. Dar la noche por perdida ahí es perderla por un `npm run build` que no se corrió.
5. Crea los tres archivos del día, con `date +%F`:
   - `docs/noche/bitacora-<fecha>.md` desde `BITACORA-plantilla.md`
   - `docs/noche/DECISIONES-<fecha>.md` desde `DECISIONES-plantilla.md`
   - el informe se escribe al final
6. Registra la cola con `TodoWrite`: **una entrada por tarea**, no por ola. Necesitas poder marcar
   una sola tarea como aparcada sin tocar las demás.
7. **Fija tu hora de cierre.** `date +%H:%M` para saber qué hora es, y calcula el cierre: la que
   venga en `hasta=HH:MM` dentro de `$ARGUMENTS`, o **seis horas después** si no viene ninguna.
   Anótala en la bitácora, en la primera línea: *«Arranque HH:MM · cierre previsto HH:MM»*. A partir
   de ahí gobierna el reloj, no la cola.

## El presupuesto de reloj

La corrida tiene una hora de cierre y **se respeta**. Tres reglas, y ninguna es negociable:

- **Antes de lanzar cada agente, mira el reloj.** Si queda **menos de una hora** hasta el cierre,
  **no lo lanzas**: marcas su tarea como **«no alcanzada por tiempo»** en `TodoWrite` y en la
  bitácora, y **pasas directo al cierre**. Una tarea sin empezar es un renglón en el informe; una
  tarea reventada a medias es una mañana de arqueología.
- **Si llega la hora de cierre con un agente en marcha, lo dejas terminar la tarea EN CURSO** y no
  le das otra. **Nunca interrumpes una tarea a medias.** Un agente cortado deja archivos a medio
  escribir, y el árbol sucio es lo único que detiene la corrida de verdad — el paso 2 de «Antes de
  arrancar» no arranca con él así, ni esta noche ni la siguiente.
- **Lo último que haces, siempre, es el `verificador-noche` y el informe.** Si el reloj te obliga a
  sacrificar algo, **sacrificas una ola, nunca el informe**. Una corrida sin informe es una corrida
  que nadie puede revisar: todo lo que hiciste queda sin poder juzgarse, y vale lo mismo que si no
  lo hubieras hecho. Resérvale su tiempo desde el principio y trátalo como parte del presupuesto,
  no como lo que queda al final.

Y anota en el informe **qué no se alcanzó por reloj**, separado de lo que se aparcó por una
decisión: son dos motivos distintos y se arreglan de forma distinta —uno con más noche, el otro con
una respuesta tuya—. Confundirlos hace que parezca que faltó tiempo cuando faltó una respuesta.

## Cómo despachas

Argumento recibido: **$ARGUMENTS** (vacío = `todo`). Puede traer un `hasta=HH:MM`: eso es la hora de
cierre, no una ola. Lo que quede tras quitarlo es el modo (`todo`, `ola1`, `continuar`…).

- Ola 1 → `altas-transaccionales`, `plantillas-instancia`, `endpoint-flota`. **Uno detrás de otro**,
  en árbol único: es el modo por defecto (§5 del plan). El paralelismo se habilita a mano, y solo
  cuando la corrida haya funcionado una noche entera.
- Ola 2 → `aprovisionamiento`. Ola 3 → `panel-flota`. Ola 4 → `cierre-documental`.
- Ola 5 → **retirada.** F2.6 ya está aplicada en el código (ver §4 y §8 del plan). No la despachas.
- Ola 6 → `verificador-noche`.

A cada subagente le pasas: sus identificadores de tarea (F5.1, F5.2…), la ruta del plan v3 para que
lea la ficha él mismo, la ruta de la bitácora, la ruta del archivo de decisiones, y la lista exacta
de archivos que posee. **No le parafrasees la tarea**: el v3 la describe mejor, con sus criterios de
aceptación y sus comandos. Le dices dónde leerla.

Y le repites, en su prompt, la frase que más importa esta noche: *no preguntes, aparca y escribe la
entrada de decisión.*

Entre olas invocas al `verificador-noche` con la puerta correspondiente. Una puerta en rojo no abre la ola
siguiente — pero tampoco cierra la noche: **saltas a la ola siguiente que no dependa de la fallida**
y lo anotas. Las olas 2 y 3 dependen de la 1; la 4 depende de que exista algo que documentar.

## Cuando un agente aparca

1. Comprueba que dejó el árbol limpio (`git status`). Si dejó basura, la mandas a un stash nombrado
   `aparcada/<FX.Y>` tú mismo.
2. Comprueba que su entrada en `DECISIONES-<fecha>.md` está **completa**: las dos opciones con sus
   consecuencias, dónde muerde, qué desbloquea, y el `TU RESPUESTA: ____`. Una entrada a medias es
   una mañana perdida. Si está incompleta, se la devuelves al agente una vez.
3. Marca la tarea como aparcada en `TodoWrite` y **aparca su cascada**: no lanzas ningún agente cuya
   dependencia quedó aparcada. Anota la cascada con palabras: «F5.4 aparcada ⇒ F5.5 sin preparar ⇒
   `infra/scripts/README.md` sin escribir».
4. Sigues. Inmediatamente.

## Lo que no haces

- **No preguntas nada al usuario.** Ni una vez, ni «por seguridad». No hay nadie.
- No editas archivos de producto. Ni una línea. Para eso están los agentes.
- No corres nada contra un servidor. Revisa la §1 del plan.
- No haces `git push`, `git tag`, ni `gh` de ningún tipo.
- No decides P1, P2, P3, P4, P4-bis ni P6. Ni «provisionalmente». Ni «para desbloquear».
- No fusionas `chore/retirar-scripts-pista-archivada` (espera a F3.6, que la hace la persona).
- No inflas el archivo de decisiones. Una pregunta que puedas resolver leyendo el repo **no es una
  decisión**: es trabajo. Cinco entradas bien escritas son útiles; veinte son ruido y no se leen.

## Modo `continuar`

Si `$ARGUMENTS` es `continuar`:

1. Lee el `DECISIONES-<fecha>.md` más reciente. Toma solo las entradas con `TU RESPUESTA` rellenada.
2. Recupera las ramas y stashes `aparcada/*` que esa respuesta desbloquea.
3. Relanza el agente dueño de cada tarea desbloqueada, pasándole **la respuesta textual** de
   Jochelo, no tu interpretación de ella.
4. Las entradas sin responder se quedan aparcadas. No se adivinan, no se recuerdan dos veces.
5. Cierras con el `verificador-noche` y un informe nuevo.

## Al cerrar

El informe, `docs/noche/informe-<fecha>.md`, lo escribe el `verificador-noche`. Tú le pasas: el estado de
partida de las dos suites, la lista de tareas con su estado final, las cascadas de las aparcadas, la
hora de inicio, la de cierre **previsto** y la **real**, y la lista de tareas **no alcanzadas por
tiempo**. Él lo redacta y audita.

**El cierre no es opcional ni se recorta.** Si vas justo de reloj, entras aquí antes y con una ola
menos: mejor cuatro olas con informe que cinco sin él.

Lo último que haces es una comprobación tonta que salva mañanas: `git status` limpio,
`git log --oneline` legible, y los tres archivos del día existen y no están vacíos. Si el archivo de
decisiones está vacío porque no hubo ninguna, escribe la línea que lo dice. Su ausencia es ambigua;
su presencia vacía no lo es.
