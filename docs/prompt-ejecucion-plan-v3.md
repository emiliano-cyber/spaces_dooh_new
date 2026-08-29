# Prompt de ejecución — Plan de Instancias Soberanas v3

Cómo arrancar una sesión que ejecute el plan. Primero se prepara el entorno; el
texto de abajo se pega tal cual en la sesión nueva.

## Preparación (una sola vez por worktree)

```powershell
cd C:\Users\Server\spaces_doohmain_nueva\.claude\worktrees\servidor-padre
npm install
copy C:\Users\Server\spaces_doohmain_nueva\apps\web\.env       apps\web\.env
copy C:\Users\Server\spaces_doohmain_nueva\apps\web\.env.local apps\web\.env.local
cd db; docker compose up -d      # Postgres de desarrollo en el 5433
cd ..; claude
```

Sin `node_modules` ni `.env` no corre ni la primera prueba.

---

## El prompt

> Vas a ejecutar el **Plan de Instancias Soberanas v3**, que ya está aprobado.
> Estás en el worktree `.claude/worktrees/servidor-padre`, rama
> `feat/servidor-padre-instancias`. **No replanees nada**: el plan es lo que se
> hace, tal como está escrito.
>
> ### Antes de tocar una línea
>
> 1. Lee completo `docs/Plan_Instancias_Soberanas_v3.md` — 46 tareas, F0.1 a F8.3.
>    Es la única fuente de verdad sobre qué hay que hacer. Cada tarea trae objetivo,
>    dependencias, archivos con ruta real, la prueba que debe fallar primero, pasos,
>    criterio de aceptación, comando de verificación, mensaje de commit y vuelta
>    atrás. No te falta nada: no vayas a buscar los documentos de origen.
> 2. Lee `vault/01-Arquitectura/modelo-instancias-soberanas.md` para el contexto, y
>    desde `vault/00-Indice/MOC-Proyecto.md` sigue `AGENTES`, `zonas-de-riesgo` y
>    `tablero` antes de tocar código.
> 3. Lee las **restricciones globales** del plan (son 14) y los invariantes. Si un
>    paso tuyo roza uno, ese paso está mal.
> 4. Dime en qué tarea vas a empezar y espera mi visto bueno.
>
> ### Cómo se ejecuta una tarea
>
> - **Una tarea = un commit.** En el orden del plan, respetando el campo «Depende
>   de». Si no cabe en un commit con sentido, dímelo antes de partirla.
> - **TDD literal:** primero escribes la prueba que la tarea describe y **me la
>   enseñas en rojo**. Solo entonces implementas. La prueba y la implementación van
>   en pasos separados.
> - Al terminar, corres el **comando de verificación exacto** que trae la tarea y me
>   pegas la salida. No lo parafrasees ni lo sustituyas por otro.
> - Commit en español, con el mensaje sugerido de la tarea (estilo del repo:
>   `tipo(ambito): descripcion` en minúscula).
> - Si el criterio de aceptación no se cumple, **no cierres la tarea**: repórtalo con
>   la evidencia.
>
> ### Lo que no puedes hacer
>
> - **Nada de `ssh`, `doctl`, ni `curl` contra `demo.space-os.io` o cualquier cosa de
>   producción.** Cuando una tarea pida un comando contra un servidor, **me lo
>   escribes y lo corro yo**; me esperas con la respuesta antes de seguir.
> - **No borres datos de la base de desarrollo del 5433** más allá de lo que una
>   prueba necesita. Nada de borrados masivos: ahí hay datos reales míos.
> - **No edites `db/schema.sql` directo** (restricción 8: los cambios van como
>   migración) ni abras `apps/web/lib/test/aislamiento.e2e.test.ts` (restricción 7:
>   tiene que pasar sin tocarse). Si una tarea te obliga a cualquiera de las dos,
>   **esa tarea está mal**: detente y dímelo.
> - **No commitees en `main` ni empujes a `emiliano`** sin pedírmelo.
> - **No cambies el plan.** Si el repositorio contradice una tarea, no la reescribas
>   por tu cuenta: párate y muéstrame la evidencia con `archivo:línea`.
>
> ### Tareas que no se tocan sin hablar conmigo
>
> **F5.7, F7.2 y F7.3 están BLOQUEADAS** por decisiones de negocio que siguen
> abiertas, y **F2.6 está condicionada** a una decisión sobre la bandera del
> autoregistro. De la Fase 7 solo se puede hacer el censo (**F7.1**), que es de solo
> lectura. Si el camino te lleva a cualquiera de ellas, **detente y pregúntame**. Lo
> aprobado es el plan, no esas decisiones.
>
> ### Por dónde se empieza
>
> Por **F0.1**, que es una verificación que **corro yo**: dame el `curl` que trae la
> tarea y espera mi respuesta.
> - **HTTP 503** → el autoregistro está cerrado; sigues a **F0.3**.
> - **HTTP 400** → está abierto; **F0.2 el mismo día** (y ojo: apagar la bandera
>   exige recompilar, reiniciar el proceso no basta).
> - **Cualquier otro código** → no es concluyente y no se avanza hasta saber por qué.
>
> ### Al cerrar cada tanda
>
> Entrada en `docs/Registro_Cambios.md` con lo que se hizo, y revisa si algo de
> `vault/` quedó desactualizado por el cambio.
>
> ### Cadencia
>
> **Una tarea a la vez.** Al terminar cada una me reportas cuatro cosas: qué hiciste,
> la salida del comando de verificación, el commit que quedó, y cuál sigue. No
> encadenes varias tareas sin reportar.

---

## Recordatorio para quien lo lanza

El plan tiene **46 tareas**; **39 se pueden empezar hoy**. Las primeras dos fases
—cerrar el autoregistro y la migración de limpieza de los `DEFAULT`— no dependen de
ninguna decisión pendiente. La Fase 2 sí conviene arrancarla con la P4-bis ya
resuelta, porque se construye distinta según la respuesta.
