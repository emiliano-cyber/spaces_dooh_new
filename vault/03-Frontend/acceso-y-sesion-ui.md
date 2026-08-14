---
tipo: modulo
estado: verificado
actualizado: 2026-08-14
tags: [frontend, login, sesion, rojo]
archivos:
  - apps/web/app/(app)/login/page.tsx
  - apps/web/lib/entorno.ts
  - apps/web/app/(app)/recuperar/[token]/page.tsx
  - apps/web/lib/auth-real.ts
  - apps/web/app/api/auth/metodos/route.ts
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
| `NEXT_PUBLIC_RECUPERAR_PASSWORD=0` | En el **build** | Oculta el enlace | `POST /api/auth/forgot` → apagado |

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
> `app/api/signup/route.ts:12-16` lo dice explícitamente: el mismo despliegue
> sirve la demo pública y producción, así que ocultar el botón dejaría el
> endpoint abierto y cualquiera con la URL crearía organizaciones y usuarios
> `DUENO` en la base real. **Toda bandera de UI necesita su gemela en servidor.**

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
> (`DESPLIEGUE_GOOGLE.txt:91-95`) o reiniciar el contenedor.

## Con sesión abierta, `/login` no se queda a la vista

Desde `e7c3517` (INC-08), la página **valida la sesión contra el servidor** y
redirige, en vez de decidirlo desde el cliente
(`app/(app)/login/page.tsx:87-95`).

> [!note] Por qué se ve el formulario un instante
> Es deliberado: se valida contra `/api/auth/me` en vez de fiarse de la mera
> presencia de la cookie, que es lo único que puede mirar el middleware. El coste
> es ese parpadeo; la ventaja es que una cookie caducada no te deja en una página
> que no lleva a ningún sitio.

## Recuperar contraseña

`/recuperar/[token]` — el token viaja en el enlace del correo. `GET
/api/auth/reset` lo valida antes de mostrar el formulario; `POST` lo aplica y
**borra todas las sesiones del usuario**.

Ruta pública en el middleware (`middleware.ts:94`).

## Contraseña temporal

Cuando un administrador restablece una contraseña, el usuario entra con
`debe_cambiar_password = true` y el servidor **cierra todo** salvo
`/api/auth/me` y `PATCH /api/perfil`.

> [!warning] El servidor exige algo y la pantalla tiene que ofrecer dónde hacerlo
> Este patrón ya falló tres veces (restablecimiento, desbloqueo y contraseña
> temporal): el usuario veía «No se pudieron cargar los datos» con un botón de
> reintentar **que no podía funcionar nunca**. Hoy se le lleva directo a su
> cuenta con un aviso (`docs/Registro_Cambios.md`, 06/08). **Si añades un corte
> en el servidor, añade la salida en la UI en el mismo commit.**

## Cliente de sesión

`lib/auth-real.ts` — `useSesion()` sobre `/spaces-dooh/api/auth`. Barra final
obligatoria por `trailingSlash`.

## Relacionadas
[[autenticacion-y-sesion]] · [[flujo-login]] · [[flujo-acceso-con-google]] ·
[[shell-y-navegacion]] · [[03-Frontend/_indice|Índice de Frontend]] ·
[[MOC-Proyecto]]
