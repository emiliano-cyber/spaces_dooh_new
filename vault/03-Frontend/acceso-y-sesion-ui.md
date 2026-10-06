---
tipo: modulo
estado: verificado
actualizado: 2026-10-06
tags: [frontend, login, sesion, rojo]
archivos:
  - apps/web/app/(app)/login/page.tsx
  - apps/web/lib/entorno.ts
  - apps/web/app/(app)/recuperar/[token]/page.tsx
  - apps/web/lib/auth-real.ts
  - apps/web/app/api/auth/metodos/route.ts
  - apps/web/components/demo/shell/AuthGate.tsx
  - apps/web/components/demo/shell/compuerta.ts
  - apps/web/app/api/auth/login/route.ts
  - apps/web/lib/server/errores.ts
  - apps/web/components/demo/ui/SelectorIdioma.tsx
  - apps/web/middleware.ts
---

# Acceso y sesión (UI)

> [!danger] ZONA ROJA
> La pantalla de acceso es la puerta del sistema. Ver [[zonas-de-riesgo]].

## Una sola página con tres modos

`app/(app)/login/page.tsx` contiene login, autoregistro y «olvidé mi
contraseña». Los dos últimos se apagan por variable:

| Variable | Cuándo se decide | Efecto en la UI | Y **también** en el servidor |
|---|---|---|---|
| `AUTOREGISTRO` (solo `1` enciende) | **Al arrancar** | Oculta el alta | `POST /api/signup` → 503 |
| `NEXT_PUBLIC_RECUPERAR_PASSWORD=0` | En el **build** | Oculta el enlace | `POST /api/auth/forgot` → apagado. **No** `/api/auth/reset` desde el 06/10 (ADR 0044): la invitación lo usa |

> [!important] La bandera del autoregistro salió del build el 14/08 (F2.6)
> Se llamaba `NEXT_PUBLIC_AUTOREGISTRO` y el prefijo la hacía **hornearse en el
> build**: cambiarla exigía recompilar. Ahora se llama **`AUTOREGISTRO`**, se lee
> en cada petición (`lib/entorno.ts`) y **una sola imagen** sirve a DEMO y a cada
> instancia de owner.
>
> **Cambió la polaridad, y esto muerde:** antes *ausente = encendido*
> (`!== '0'`); ahora **solo `AUTOREGISTRO=1` enciende** y cualquier otra cosa
> —incluida la ausencia— deja el registro cerrado. Es fail-closed a propósito: un
> `.env` que se quedó corto no abre el registro por descuido. Consecuencia
> directa: **un `.env` que siga diciendo `NEXT_PUBLIC_AUTOREGISTRO=1` ya no tiene
> efecto y esa instancia se queda con el registro CERRADO.**
>
> Verificado con la MISMA imagen sin recompilar (`space-os:f26`, 14/08): sin la
> variable → 503, `=0` → 503, `=1` → 400.

> [!danger] El botón «Crear cuenta» venía horneado, y horneado ENCENDIDO
> Hasta el 14/08 la página leía la bandera con `process.env` en el componente, y
> `/login` **se prerrenderiza en el build**: el HTML de fábrica traía el botón
> dentro pasara lo que pasara. Medido en la imagen de F2.5:
> `.next/server/app/login.html`, 15 234 bytes, con el botón. Resultado: cada
> instancia habría enseñado un «Crear cuenta» que al pulsarse contestaba **503**.
>
> Se arregló preguntando al servidor, no pasando props desde el layout: los props
> se resolverían **en el mismo render de build** y caerían en el defecto por otra
> puerta. Tras el cambio ese HTML tiene **0 apariciones** de «Crear cuenta»: el
> botón lo decide la respuesta de `/api/auth/metodos/`.

> [!danger] Ocultar el botón no es apagar la función
> `app/api/signup/route.ts:34-36` lo dice explícitamente: la misma imagen sirve a
> toda la flota, así que ocultar el botón dejaría el endpoint abierto y cualquiera
> con la URL crearía organizaciones y usuarios `DUENO` en la base de esa instancia.
> **Toda bandera de UI necesita su gemela en servidor.**
>
> Ojo al leer ese comentario: llama a DEMO «la única con el registro abierto», y
> desde el **14/08 eso ya no es cierto** — va cerrado en toda la flota, DEMO
> incluida. El punto que defiende sigue en pie; el ejemplo caducó.
>
> **2026-10-05:** el comentario ya está corregido en el código —se reescribió el
> 03/09 y hoy deja constancia del error en `signup/route.ts:28-32`—. Lo de arriba
> queda como historia de por qué se corrigió.

## Qué ofrece este despliegue: `GET /api/auth/metodos`

Ruta **pública**, `force-dynamic`, `cache-control: no-store`. Desde el 14/08
responde **dos** banderas, no una:

```json
{ "google": false, "autoregistro": false }
```

El login la consulta **una sola vez** al montar y pinta según lo que conteste: el
botón de Google y el enlace «Crear cuenta». Las dos empiezan en `false` en el
cliente, así que **si la consulta falla no se pinta nada** — ofrecer una entrada
que responde 503 es peor que no ofrecerla. Ver [[flujo-acceso-con-google]].

> [!note] `NEXT_PUBLIC_*` exige recompilar; `GOOGLE_OAUTH` y `AUTOREGISTRO` no
> Next hornea las `NEXT_PUBLIC_*` en el build. `GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH`
> y —desde F2.6— `AUTOREGISTRO` **no** llevan ese prefijo y se leen en tiempo de
> petición, por eso encenderlas solo necesita `pm2 reload --update-env`
> (`DESPLIEGUE_GOOGLE.txt:89-93`) o reiniciar el contenedor.

## Con sesión abierta, `/login` no se queda a la vista

Desde `e7c3517` (INC-08), la página **valida la sesión contra el servidor** y
redirige, en vez de decidirlo desde el cliente
(`app/(app)/login/page.tsx:115-128`).

> [!note] Por qué se ve el formulario un instante
> Es deliberado: se valida contra `/api/auth/me` en vez de fiarse de la mera
> presencia de la cookie, que es lo único que puede mirar el middleware. El coste
> es ese parpadeo; la ventaja es que una cookie caducada no te deja en una página
> que no lleva a ningún sitio.

## La base caída da 503 con mensaje, no una pantalla rota

> [!note] 2026-10-05 · `35f7ad1d` (30/09)
> Con Postgres apagado, `POST /api/auth/login` devolvía un **500 con el cuerpo
> vacío** y la pantalla enseñaba «Unexpected end of JSON input». Hoy las rutas de
> `app/api/auth/**` pasan por `respuestaError()`, que reconoce una base que no
> responde con `esBaseNoDisponible()` (`lib/server/errores.ts:160`) y contesta
> **503 con un mensaje en el idioma del cliente** (`errores.ts:215-222`); el
> detalle técnico va solo al log. En el cliente, `apiLogin()`
> (`lib/auth-real.ts:53-76`) ya no hace `res.json()` a ciegas: un 5xx sin JSON
> se muestra como «El servicio no está disponible…», y un fallo de red, en
> español.

## Selector de idioma en el login

Bajo la tarjeta del formulario va `<SelectorIdioma />`
(`app/(app)/login/page.tsx:395`): es la primera pantalla que ve cualquiera, así
que es el sitio donde corregir la detección automática antes de teclear nada.
Ver [[idiomas-es-en]].

## Recuperar contraseña

`/recuperar/[token]` — el token viaja en el enlace del correo. `GET
/api/auth/reset` lo valida antes de mostrar el formulario; `POST` lo aplica y
**borra todas las sesiones del usuario**.

Con `?bienvenida=1` es una **invitación** (ADR 0044): mismos token y servidor,
otros textos —«Elige tu contraseña», y si venció, «pide a quien te dio de alta que
te envíe otra»—. Desde el 06/10 valida con `validarPassword`, la regla del
servidor, y no solo la longitud.

El alta de usuario (`administracion/page.tsx`, `InvitarModal`) ofrece tres formas
de acceso, una por alta: **enviar invitación** (por omisión), fijar la contraseña,
o Google si está habilitado. Si el correo no salió, el modal enseña el enlace
**una vez** para copiarlo.

Ruta pública en el middleware (`middleware.ts:170`).

## Contraseña temporal

Cuando un administrador restablece una contraseña, el usuario entra con
`debe_cambiar_password = true` y el servidor **cierra todo** salvo
`/api/auth/me` y `PATCH /api/perfil`.

> [!warning] El servidor exige algo y la pantalla tiene que ofrecer dónde hacerlo
> Este patrón ya falló **cuatro** veces (restablecimiento, desbloqueo,
> contraseña temporal y los códigos de recuperación): el usuario veía «No se
> pudieron cargar los datos» con un botón de reintentar **que no podía funcionar
> nunca**. Hoy se le lleva directo a su cuenta con un aviso
> (`docs/Registro_Cambios.md`, 06/08). **Si añades un corte en el servidor,
> añade la salida en la UI en el mismo commit.**

## La compuerta del shell, y por qué la decisión salió del `.tsx`

`AuthGate.tsx` envuelve TODO lo que está dentro de `(app)/(shell)`, y decide dos
cosas con dos mecanismos distintos: **adónde manda** al usuario
(`router.replace()` en un efecto) y **qué pinta** mientras tanto. Escritas por
separado, esas dos decisiones divergen.

Desde el 2026-09-08 las dos salen de una sola declaración,
`salidaObligatoria()` en `components/demo/shell/compuerta.ts`: la lista de
estados en los que `exigir()` responde 403 a todo, con la pantalla que saca de
cada uno. **Añadir un estado bloqueante ahí cubre los dos lados a la vez** — la
redirección y la exención de render.

> [!danger] La cuarta vez fue por no tener eso, y dejó el PADRE inaccesible
> El ADR 0028 · B2 añadió el corte de los códigos en `auth.ts:230` y la
> redirección en el efecto, **pero no la exención de render**. Con el Dueño del
> PADRE entrando por Google y `codigos_vistos_en` en null, `/api/estado` daba
> 403, el store quedaba en `error` y `AuthGate` pintaba «No se pudieron cargar
> los datos» **también dentro de `/codigos-recuperacion`** — que vive en
> `(shell)` y por tanto pasa por la misma compuerta. La aplicación entera
> inaccesible, sin decir por qué.
>
> Medido en el PADRE el 08/09: 403 simultáneo en `/api/estado`, `/api/cambios` y
> `/api/notificaciones/nuevas`. El supuesto que lo dejó pasar está escrito en
> `20260907_solo_google.sql` — «en producción todavía nadie entra con Google» —
> y era falso para el PADRE.
>
> **Desbloqueo sin desplegar**: entrar con contraseña. `login/route.ts:107` abre
> la sesión con `metodo = 'password'` y `debeGuardarCodigos()` solo mira a quien
> entró con Google. Solo falla si la cuenta tiene `solo_google` encendido: en ese
> caso `login/route.ts:89-105` responde **403** con `soloGoogle: true` —después
> de verificar la contraseña, para no regalar enumeración—.

La decisión vive en un `.ts` y no dentro del componente por una razón concreta:
`vitest.config.ts` **no monta jsdom a propósito**, así que una decisión de
render escrita en el `.tsx` no la prueba nadie — y ésta era una decisión de
render. `compuerta.test.ts` la cubre con 15 casos, incluidos los negativos: que
sin estado bloqueante el error **sí** se pinte (hallazgo C1), y que la exención
compare la ruta ya normalizada, sin `basePath`.

## Cliente de sesión

`lib/auth-real.ts` — `useSesion()` sobre `/spaces-dooh/api/auth`. Barra final
obligatoria por `trailingSlash`.

## Relacionadas
[[autenticacion-y-sesion]] · [[flujo-login]] · [[flujo-acceso-con-google]] ·
[[shell-y-navegacion]] · [[03-Frontend/_indice|Índice de Frontend]] ·
[[MOC-Proyecto]]
