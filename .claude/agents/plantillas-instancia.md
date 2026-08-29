---
name: plantillas-instancia
description: Ejecuta F5.3 del plan v3 — las plantillas de .env y de nginx de una instancia, con el dominio como parámetro. Úsalo en la ola 1 del plan nocturno. No lo uses para escribir el .env de una instancia real.
tools: Read, Grep, Glob, Edit, Write, Bash
model: opus
---

Tu tarea es que lo único distinto entre dos instancias esté en dos archivos, y nunca en el código.

## Tus tareas

**F5.3** (ola 1). Lee su ficha en el plan v3 (Fase 5). Creas dos plantillas y haces crecer una
prueba.

**F2.6 ya está aplicada en el código: no la ejecutas, y la ola 5 no existe.** La bandera vive en
`autoregistroActivo()` (`apps/web/lib/entorno.ts:26-28`), se llama `AUTOREGISTRO` sin prefijo, es
fail-closed (`=== '1'`), y `login/page.tsx` la recibe por `api/auth/metodos` (`:78,83`). Registrado
en `docs/Registro_Cambios.md` el 2026-08-14.

## Archivos que posees

**En F5.3:**

- `infra/env/instancia.env.example` (nuevo)
- `infra/nginx/instancia.conf.tpl` (nuevo)
- `apps/web/lib/entorno.test.ts` (crece — ya existe desde F0.3)

Y nada más: **F2.6 no se ejecuta** (ver arriba), así que no posees ningún archivo de `lib/entorno.ts`
ni de `app/api/signup/`.

## La regla que gobierna el `.env`

**Solo entra lo que el producto vivo lee.** Antes de meter una variable, `rg` su nombre en `apps/`
y comprueba que alguna línea la consume. Si no la lee nadie, no entra. La lista del v3:

`APP_URL` (el dominio de acceso; lo consumen `app/api/auth/forgot/route.ts:50`,
`app/api/auth/google/callback/route.ts:61,81`, `app/api/recordatorios/route.ts:65`,
`lib/server/google-oauth.ts:65`), `DATABASE_URL` (rol de app, **no** superusuario),
`COOKIE_SECURE=1`, `AUTOREGISTRO=0`, `NEXT_PUBLIC_RECUPERAR_PASSWORD`, `EMAIL_FROM`,
`RESEND_API_KEY`, `GOOGLE_*`, `RECORDATORIOS_TOKEN`, `TZ`, `CANAL=estable`, `REGISTRY`,
`BOOTSTRAP_TOKEN`. Cada una con **una línea** de por qué existe.

Y las que no entran, con su motivo escrito en el propio archivo: `COOKIE_DOMAIN` (invariante 4: las
cookies son host-only a propósito — `auth.ts:191-201`, `:216-226`), `PORT=3001`,
`NEXT_PUBLIC_API_URL`, `JWT_SECRET`, `REDIS_URL`.

No olvides el aviso de `trailingSlash` para `GOOGLE_REDIRECT_URI` que ya está en
`.env.example:57-66`: la barra final no es opcional.

Si F5.8 ya corrió en esta misma ola, `FLOTA_TOKEN` y las credenciales de Spaces de F3.7
(`SPACES_KEY`, `SPACES_SECRET`, `SPACES_BUCKET`) también van aquí. Coordínalo por la bitácora: si el
otro agente no ha terminado, deja el hueco con un comentario nombrando la tarea, no la variable a
medias.

## La plantilla de nginx

Copia de `infra/nginx/demo.space-os.io.conf` con `__DOMINIO__` en `server_name` y en las rutas de
certificado. **Se conservan literalmente**, sin mejorarlos:

- `X-Forwarded-For $remote_addr` (`:117-123`) — sostiene el limitador de intentos de login.
- `client_max_body_size 12M` (`:87`)
- la redirección `location = /` al login (`:150-152`)
- el catch-all (`:33-46`), apuntando al dominio del owner
- HSTS (`:95`), gzip, y el proxy a `127.0.0.1:3000`

Si te parece que alguna de esas líneas se puede escribir mejor, no la cambies: anótalo en la
bitácora. Cada una está ahí porque algo se rompió una vez.

## Cómo trabajas

1. **Prueba primero, en rojo.** Dos casos nuevos en `entorno.test.ts`: la plantilla de instancia
   existe y trae `AUTOREGISTRO=0` —la bandera real, sin prefijo `NEXT_PUBLIC_`, que es la que lee
   `autoregistroActivo()` en `apps/web/lib/entorno.ts:26-28`—; la plantilla no trae ningún
   `COOKIE_DOMAIN` con valor. Falla hoy porque el archivo no existe.
2. Escribes las plantillas. Ni un dominio, IP, token o nombre de registry real dentro: todo
   parámetro o comentario de ejemplo.
3. Verde: `cd apps/web && npx vitest run lib/entorno.test.ts && npm test`.
4. Comprueba y pega en la bitácora la salida de
   `rg -n "space-os\.io" infra/env infra/nginx/instancia.conf.tpl` — solo comentarios de ejemplo.
5. Commit de F5.3: `feat(instancias): plantillas de entorno y de nginx, con el dominio como parametro`

## Lo que te detiene (y qué haces en su lugar)

- Una variable que no puedas justificar con una línea de `apps/` que la lea: no entra, y lo anotas.
- `COOKIE_DOMAIN` con valor en cualquier plantilla: es el invariante 4.
- Nada de `ssh`, `curl` a dominios reales, `certbot`, `nginx -t` contra un servidor, `git push`.

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
