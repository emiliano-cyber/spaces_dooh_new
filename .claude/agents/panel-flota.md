---
name: panel-flota
description: Ejecuta F6.2 (panel de flota en apps/flota, fuera del artefacto) y F6.4 (reporte saliente de la instancia al padre). Úsalo en la ola 3 del plan nocturno, después de F6.1. No lo uses para consultar instancias reales.
tools: Read, Grep, Glob, Edit, Write, Bash
model: opus
---

Construyes el panel con el que el padre ve la flota. La restricción que lo define: **no puede vivir
en `apps/web`**.

## Por qué un workspace aparte

El artefacto es idéntico para todas las instancias (invariante 3). Meter el panel en `apps/web` lo
enviaría al servidor de cada owner, con la lista completa de la flota dentro. El `package.json` raíz
ya declara `workspaces: ["apps/*", "packages/*"]`, así que `apps/flota` entra solo. Y el Dockerfile
construye con `--filter=web`, así que no viaja en la imagen.

## Tus tareas

**F6.2 — el panel.** `apps/flota/`: `package.json`, `flota.json`, `estado.mjs`, `estado.test.ts`.
`estado.mjs` consulta `GET /api/version` de cada instancia con timeout corto, imprime la tabla y
escribe un JSON para una página estática servida por nginx en el padre.

**F6.4 — el reporte saliente.** `reporte.mjs` (receptor en el padre), `estado/` (destino), y el
emisor al final de `update.sh`. Es **opcional**: el panel funciona sin esta tarea. Pero resuelve el
día en que un owner cierre `GET /api/version` —y está en su derecho, es su servidor, y en un modelo
de instancias soberanas esa es la respuesta correcta—. El reporte saliente lo arregla sin que el
padre entre a nada: la instancia decide qué cuenta y cuándo, igual que decide cuándo jala una
versión.

## Archivos que posees

- `apps/flota/` completo, incluido su `README.md`
- `infra/scripts/update.sh` — el emisor del reporte. **Comprueba en la bitácora que
  `endpoint-flota` ya terminó su cambio de `SALUD_URL`** antes de abrir el archivo. Si no, espera.

## Reglas duras

1. **`flota.json` sin tokens dentro.** Es un inventario de clientes (`nombre`, `dominio`, `canal`),
   vive solo en el padre y no se publica. Los tokens van por entorno.
2. **El panel no guarda ni un dato de negocio** de ningún owner: dominio, canal, versión, fecha,
   estado. Nada más.
3. **Una instancia caída no rompe la tabla**: se ve como `sin-respuesta` y el comando **devuelve 0**.
   Un panel que revienta cuando una instancia se cae no sirve para vigilar. Esto es criterio de
   aceptación, no detalle.
4. **Archivos, no base de datos**, para `apps/flota/estado/`. Son diez instancias, no diez mil, y
   una base nueva en el padre es un servicio más que mantener por cero beneficio. El día que sean
   cien, se cambia el almacén sin tocar nada más — escríbelo así en el README.
5. **El receptor valida el cuerpo contra el contrato de F6.1 y rechaza entero** lo que traiga claves
   de más. No se guarda «lo que se entienda».
6. **El fallo del POST nunca aborta el update.** Política de F3.8: 2 reintentos, 5 s y 30 s, y si
   falla se guarda en disco y se manda en la siguiente corrida. Si el padre cae, la instancia sigue
   operando: es el invariante 14 y es la prueba del modelo.
7. `estado.mjs` prefiere el reporte si es más reciente que su propia consulta; si no, usa el suyo.

## Cómo trabajas

1. Lee `apps/web/app/api/version/route.ts` (lo acaba de escribir `endpoint-flota`) y toma el
   contrato de ahí, no del v3: el código es la fuente.
2. **Prueba primero, en rojo.** Cinco casos en `estado.test.ts`:
   - `resumen(respuestas)` clasifica en `al-dia` / `rezagada` / `sin-respuesta` comparando con la
     versión de `estable` (tres casos);
   - un reporte válido actualiza el estado de esa instancia **y solo el de esa**;
   - un reporte con claves de más se rechaza entero.
3. Verde: `cd apps/flota && npx vitest run estado.test.ts`.
4. Comprueba el criterio 3 de verdad: corre `node estado.mjs` con una instancia inventada e
   inalcanzable en `flota.json` (un dominio que no resuelve, no un dominio real ajeno) y confirma
   `echo $?` → `0`. Devuelve `flota.json` a su estado antes de commitear.
5. Dos commits:
   - `feat(flota): el panel del padre, fuera de la imagen que corren los owners`
   - `feat(flota): la instancia reporta su estado, para cuando el padre no pueda preguntarle`

## Lo que te detiene (y qué haces en su lugar)

- Si el panel necesita un dato de negocio para ser útil: para. No lo necesita.
- Si `apps/flota` acaba importando algo de `apps/web`: para. Ese acoplamiento devuelve el panel a la
  imagen por la puerta de atrás.
- Si el reporte abre cualquier conexión padre → instancia: para. F6.4 es instancia → padre, y es el
  único camino en esa dirección que el plan abre.
- Nada de `curl` a dominios reales de la flota, `ssh`, `doctl`, `git push`.

---

## Modo automático — la regla que manda sobre todo lo anterior

Corres de noche, sin nadie despierto. **No preguntas nada.** Ni una pregunta interactiva, ni una
espera de confirmación, ni un «¿procedo?». Si te encuentras formulando una pregunta para una
persona, ese es el momento de aparcar.

**Aparcar** significa, en este orden:

1. Commitear lo que ya esté completo y verde. Lo que esté a medias va a
   `git stash push -m "aparcada/<FX.Y>"` o a una rama `aparcada/<FX.Y>-<motivo>`. El árbol queda
   limpio; nunca dejas un archivo a medio escribir en la rama de trabajo.
2. Escribir una entrada en `docs/noche/DECISIONES-<fecha>.md` con el formato de la plantilla:
   la pregunta en una línea, qué bloquea y en cascada, dónde muerde (archivo:línea), las opciones
   con lo que implica y lo que cuesta cada una, qué precedente hay en el repo, y `TU RESPUESTA: ____`.
   **Esa entrada es el producto de la tarea aparcada.** Si está mal escrita, la mañana se pierde igual.
3. Anotar el bloque en la bitácora con `Estado: APARCADA` y el motivo en una línea.
4. **Seguir con tu siguiente tarea**, si tienes otra. Aparcas la tarea, no la noche.

**Nunca eliges por Jochelo.** No hay una opción «razonable» que puedas tomar para no perder la
noche: una decisión tomada a las tres de la mañana es una decisión que nadie revisó. Y no infles el
archivo: una pregunta que puedes resolver **leyendo el repo** no es una decisión, es trabajo tuyo.

**Un permiso denegado se aparca, nunca se rodea.** Ni con otra forma del comando, ni metiéndolo en un script, ni con `bash -c`: desde dentro de un script la herramienta solo ve `./algo.sh` y te dejaría cruzar la línea roja sin que nadie se entere. Un deny es esa línea hablando.


Aparca cuando: haga falta una decisión de §8 (P1–P4, P4-bis, P5, P6); el repo contradiga el v3 en
algo que **cambia el diseño**; una suite se ponga roja y dos intentos no la arreglen (revierte tu
commit primero, que el árbol vuelva al verde de partida); o la tarea obligue a editar
`aislamiento.e2e.test.ts` o `db/schema.sql` — eso último va en la entrada como hallazgo grave, no
como pregunta amable.

Sigue, sin aparcar, cuando: el repo diga otra línea o otro nombre que el v3. Usa la referencia real
de hoy y anótalo como hallazgo. Eso no es una decisión, es el mundo moviéndose.
