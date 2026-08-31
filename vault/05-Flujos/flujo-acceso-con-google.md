---
tipo: flujo
estado: verificado
actualizado: 2026-08-31
tags: [flujo, auth, google, oidc, rojo]
archivos:
  - docs/adr/0012-acceso-con-cuenta-de-google.md
  - docs/adr/0018-establecer-password-tras-entrar-con-google.md
  - db/migrations/20260825_sesion_metodo.sql
  - DESPLIEGUE_GOOGLE.txt
  - apps/web/lib/server/google-oauth.ts
  - apps/web/lib/server/identidades-repo.ts
  - apps/web/app/api/auth/google/inicio/route.ts
  - apps/web/app/api/auth/google/callback/route.ts
  - apps/web/lib/test/google-oauth.e2e.test.ts
  - db/migrations/20260806_identidades_externas.sql
---

# Flujo: acceso con cuenta de Google (ADR 0012)

> [!warning] Nota revisada la tarde del 07/08
> Esta nota se escribió a las 12:15 con el ADR original. Entre las 12:51 y las
> 17:43 otra sesión **enmendó el ADR 0012** y encendió Google en producción. Lo
> de abajo ya está actualizado, pero es el área que más se mueve del repo:
> confirma contra `docs/adr/0012-acceso-con-cuenta-de-google.md` antes de tocarla.

## Estado, tal como quedó el 07/08 por la tarde

| Pieza | Estado |
|---|---|
| Código en producción | Sí |
| Migración `identidades_externas` | **Aplicada** el 07/08 11:13 |
| Credenciales de Google Cloud | **Configuradas** |
| Verificado en producción | Sí (`f6e4132`) |
| Alta de usuarios y empresas con Google | **Sí** — enmienda al ADR (`4206ab2`) |

## Principio de diseño

Termina exactamente donde termina el login normal: `crearSesion()` + las dos
cookies. Cero cambios en `exigir()`, en el middleware o en los **90** handlers.

> [!important] Desde el 25/08 `crearSesion` sabe CÓMO se abrió la sesión
> Lleva un segundo argumento (`auth.ts:103`), y el callback de Google pasa
> `'google'` donde el login normal pasa `'password'`. La columna la añadió
> `20260825_sesion_metodo.sql`. No es telemetría: es lo que hace posible el
> ADR 0018, abajo.

**Google nunca decide a qué organización perteneces ni qué rol tienes.** Eso no
cambió con la enmienda.

## Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant L as login/page.tsx
    participant I as /api/auth/google/inicio
    participant G as accounts.google.com
    participant C as /api/auth/google/callback
    participant ID as identidades-repo
    participant PG as Postgres

    L->>I: clic en «Continuar con Google»
    Note over I: 503 si googleHabilitado() es false<br/>rate limit 10/5min por IP
    I->>I: genera state, nonce, code_verifier (PKCE S256)
    I-->>U: 302 a Google + 3 cookies httpOnly de un solo uso (10 min)
    U->>G: consentimiento (scopes: openid email profile)
    G-->>C: redirect con code + state
    C->>C: state recibido == cookie state
    C->>G: POST /token (code + code_verifier) — TLS directo
    G-->>C: id_token
    C->>C: validarClaims: iss, aud, exp, nonce, email_verified
    Note over C: email_verified TRUE estricto:<br/>es LA barrera de la vinculación
    C->>ID: buscar por (proveedor, sub)
    ID->>PG: auth_usuario_por_identidad('google', sub) · SECURITY DEFINER
    alt sub conocido
        PG-->>C: usuario
    else sub nuevo, correo existe
        C->>PG: auth_usuario_por_email(email) → vincula y anota en bitácora
    else correo desconocido
        C-->>U: «esa cuenta no está dada de alta» · NO crea nada
    end
    C->>C: crearSesion() + cookieSesion + cookieCsrf
    C->>C: borra las 3 cookies de un solo uso
    C-->>U: 302 al shell, ya con sesión
```

## Por qué `sub` y no correo

El correo de Google **no es estable**: se puede cambiar en un Workspace y una
dirección liberada puede reasignarse. El `sub` es inmutable. Solo la **primera**
vez se resuelve por correo, y a partir de ahí por `sub`.

## Sin dependencias nuevas

`lib/server/google-oauth.ts:5-17`: el `id_token` llega por canal directo
servidor-a-servidor, y OIDC Core §3.1.3.7 punto 6 permite no verificar la firma.

> [!danger] La exención vale SOLO para ese canal
> Si algún día se añade el botón One Tap (alternativa B del ADR), el `id_token`
> llega **por el navegador** y hay que verificar la firma contra el JWKS. **No
> reutilizar `validarClaims()` para eso** sin añadir la verificación.

## Lo que las 18 pruebas cubren

`apps/web/lib/test/google-oauth.e2e.test.ts` contra un doble local del endpoint
de token (`lib/test/doble-google.ts`). Casi todo son casos **negativos**:

| Grupo | Casos |
|---|---|
| Arranque | state/nonce/PKCE presentes; no pide más permisos que la identidad; cambian en cada intento |
| Primera entrada | entra, deja sesión **utilizable**, graba el vínculo, lo anota en bitácora; manda el `code_verifier`; borra las 3 cookies |
| No da de alta | correo desconocido no crea usuario; usuario desactivado no entra |
| Protecciones | state que no coincide; sin cookies; nonce distinto (replay); state reutilizado |
| Claims | `email_verified:false`; `aud` de otra app; token expirado |
| Fallos | canje rechazado; usuario que cancela ve «cancelado», no una avería |

Verificado por **mutación**: quitando la comparación de `state` cae exactamente
la prueba que lo cubre.

## La enmienda del 07/08: dar de alta con Google

Commit `4206ab2`. Dos formas nuevas de que una cuenta **nazca** ligada a Google.

### 1 · Alta de usuario «entra con Google»

En Administración → Usuarios, `entraConGoogle: true` y **no se manda
contraseña**: el servidor genera una que nadie ve. Quita la fricción de inventar
una y pasarla por chat, donde queda escrita en el historial de alguien.

> [!important] La fila CONSERVA `password_hash`, y eso es lo que hace que funcione
> Sin hash, esa persona no podría desbloquear operaciones de dinero ni cambiar su
> perfil, y un restablecimiento la dejaría **encerrada**. Con hash, `cambios.ts`
> y `perfil-controller.ts` no se tocan. **Es la restricción 4 del ADR resuelta
> por construcción, no por excepción — no la quites.**

La contraseña se **construye** cumpliendo la política, no se confía al azar:
base64url puede salir sin letra o sin dígito y el alta fallaría una vez de cada
tantas — «el peor tipo de fallo, porque no se reproduce cuando lo buscas». Hay
prueba con 500 generaciones. Y se rechaza el alta si Google no está habilitado en
ese servidor: crearía a alguien que no puede entrar de ninguna forma.

### 2 · Alta de organización con Google

**Revierte en parte el rechazo de la alternativa C** del ADR, y por eso va con
enmienda escrita.

El motivo del rechazo sigue siendo correcto (el mismo despliegue sirve la demo y
producción sobre la misma base), pero ese riesgo **ya lo gobierna
`AUTOREGISTRO`** para `/api/signup`. Se cuelga del **mismo interruptor**,
comprobado en el servidor.

> [!important] La bandera se renombró y cambió de polaridad el 14/08 (F2.6)
> Era `NEXT_PUBLIC_AUTOREGISTRO` y se horneaba en el build. Ahora es
> `AUTOREGISTRO`, sin prefijo, y `autoregistroHabilitado()`
> (`google-oauth.ts`) delega en `autoregistroActivo()` de `lib/entorno.ts` para
> que las dos puertas —`/api/signup` y el alta con Google— **no puedan
> divergir**: mientras cada una leía `process.env` por su cuenta, bastaba
> corregir una para dejar la otra abierta sin que nada avisara.
>
> **Solo `AUTOREGISTRO=1` enciende.** Ausente = apagado, al revés que antes.

El nombre de la organización se pide **antes** de ir a Google y viaja en **cookie
httpOnly**:

- **No** en el `state`, que va y vuelve por la URL, donde cualquiera lo vería y
  podría cambiarlo;
- y su **presencia** es lo que distingue «entrar» de «darse de alta», así que
  decidirlo desde la URL de vuelta sería dejar que el visitante eligiera qué
  operación ejecuta el servidor.

Mecánica: la UI llama a `/api/auth/google/inicio?alta=1&organizacion=…`, el
servidor lo guarda en `COOKIE_ALTA_ORG` (corta, httpOnly) y el callback lo lee de
ahí (`inicio/route.ts:72-113`, `callback/route.ts:165-169`). El callback además
vuelve a comprobar `autoregistroHabilitado()` — no se fía de que `/inicio` ya lo
hiciera.

## El punto muerto del 25/08, y el ADR 0018

> [!danger] Entrar con Google y no tener contraseña dejó al Dueño ENCERRADO
> Medido en el PADRE el 2026-08-25, y **es el camino por defecto**, no un caso
> raro: toda instancia nueva nace así.
>
> 1. `bootstrap-auth.mjs:229` crea al Dueño con `debe_cambiar_password = true` y
>    una temporal que **imprime una sola vez**. La del 21/08 se perdió al cerrar
>    la consola.
> 2. Google lo autentica sin problema.
> 3. Pero la bandera obliga a cambiar la contraseña, y el formulario **pide la
>    anterior** — que nadie tiene.
> 4. Y no había salida por correo: el `.env.production` del PADRE no tiene
>    configuración de envío.
>
> **Quitar la bandera no valía**: existe para que la temporal que vio quien corrió
> el alta no siga siendo válida para siempre
> (`20260804_reautenticacion_individual.sql:18-22`).
>
> **Y el Dueño sí necesita contraseña**, porque `exigir_reautenticacion` (ADR
> 0009) pide **la contraseña de login del propio usuario** para los cambios
> sensibles. *«Entrar con Google» y «no tener contraseña» no son lo mismo.*
>
> La salida es el **ADR 0018**: establecer la contraseña tras entrar con Google
> **sin teclear la anterior**, y lo que autoriza esa excepción es precisamente
> `sesiones.metodo = 'google'` — la sesión prueba que Google acaba de
> autenticar a esa persona. Aceptada y **verificada en producción el 25/08**.

## Lo que sigue fuera

1. **Reautenticación por Google** para dinero: sigue siendo la contraseña propia
   (ADR 0009). Ya no es un bloqueo, porque todos los usuarios tienen hash — y
   desde el ADR 0018 también quien entró con Google puede establecerla.
2. **`GOOGLE_HD`** (restringir a un dominio): es global y solo admite uno.

   > La razón que decía esta nota —«aquí conviven cinco organizaciones»— es del
   > modelo anterior al 12/08. Con **una instancia por owner** ya no conviven, así
   > que el argumento tendría que replantearse por instancia. Queda anotado, no
   > resuelto. Ver [[modelo-instancias-soberanas]].

## Para encenderlo

1. Crear el cliente OAuth en Google Cloud desde una **cuenta de empresa**.
2. Redirect URI **con barra final**, y **con el dominio de la instancia**:
   `https://<dominio>/spaces-dooh/api/auth/google/callback/`.

   > [!warning] Aquí decía `demo.space-os.io`, y ese nombre se elimina
   > El ADR 0024 lo dejó como la demostración **original**, servida por la máquina
   > vieja. DEMO es `pruebas.space-os.io` desde el 31/08, y cada instancia de
   > owner lleva el suyo. La plantilla no debe traer ningún dominio quemado:
   > `infra/env/app.env.example:104` es donde vive `GOOGLE_REDIRECT_URI`.
3. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` en el
   entorno del proceso. **No hace falta recompilar.**

   > [!danger] `pm2 reload spaces-web --update-env` YA NO VALE
   > Decía eso hasta hoy. El PADRE sirve el 3000 con **systemd** desde el 28/08:
   > `systemctl restart spaces-web`. Y si se toca un secreto van **dos** archivos
   > —`apps/web/.env.production`, que lee el build, y `/etc/space-os/padre.env`,
   > que lee el proceso—; si divergen, manda el segundo.
   > Ver [[entorno-y-despliegue]].
4. Apagar es inmediato: `GOOGLE_OAUTH=0` + reinicio del servicio.

## Relacionadas
[[autenticacion-y-sesion]] · [[flujo-login]] · [[acceso-y-sesion-ui]] ·
[[decisiones]] · [[migraciones]] · [[preguntas-abiertas]] · [[MOC-Proyecto]]
