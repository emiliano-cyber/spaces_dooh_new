---
tipo: modulo
estado: verificado
actualizado: 2026-08-07
tags: [frontend, login, sesion, rojo]
archivos:
  - apps/web/app/(app)/login/page.tsx
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

| Variable | Efecto en la UI | Y **también** en el servidor |
|---|---|---|
| `NEXT_PUBLIC_AUTOREGISTRO=0` | Oculta el alta | `POST /api/signup` → 503 |
| `NEXT_PUBLIC_RECUPERAR_PASSWORD=0` | Oculta el enlace | `POST /api/auth/forgot` → apagado |

> [!danger] El registro público está ABIERTO en producción desde el 07/08
> `NEXT_PUBLIC_AUTOREGISTRO` pasó de `0` a `1` **por decisión explícita del
> usuario**, con el riesgo registrado en la bitácora (`6dadc9d`). Significa que
> **cualquiera que llegue a `demo.space-os.io` puede crear una organización y un
> usuario Dueño en la base real**. Verificado en las dos capas: `/api/signup`
> pasó de 503 a 400, y el alta de empresa con Google de 503 a 302.
>
> Esa bandera **se hornea en el build**: cambiarla exige recompilar, no basta
> reiniciar.

> [!danger] Ocultar el botón no es apagar la función
> `app/api/signup/route.ts:12-16` lo dice explícitamente: el mismo despliegue
> sirve la demo pública y producción, así que ocultar el botón dejaría el
> endpoint abierto y cualquiera con la URL crearía organizaciones y usuarios
> `DUENO` en la base real. **Toda bandera de UI necesita su gemela en servidor.**

## Botón de Google

Lo pinta el **servidor** consultando `GET /api/auth/metodos`, que es
`force-dynamic` y devuelve `{"google": bool}`. Si las credenciales no están, el
botón no existe. Ver [[flujo-acceso-con-google]].

> [!note] `NEXT_PUBLIC_*` exige recompilar; las de Google no
> Next hornea las `NEXT_PUBLIC_*` en el build. `GOOGLE_CLIENT_ID` y compañía
> **no** llevan ese prefijo y se leen en tiempo de petición, por eso encender
> Google solo necesita `pm2 reload --update-env`
> (`DESPLIEGUE_GOOGLE.txt:91-95`).

## Recuperar contraseña

`/recuperar/[token]` — el token viaja en el enlace del correo. `GET
/api/auth/reset` lo valida antes de mostrar el formulario; `POST` lo aplica y
**borra todas las sesiones del usuario**.

Ruta pública en el middleware (`middleware.ts:100`).

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
