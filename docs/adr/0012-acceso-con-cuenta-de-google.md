# ADR 0012: Acceso con cuenta de Google

- **Fecha:** 2026-08-06
- **Estado:** Aceptada (entrega 1; la reautenticación por Google queda fuera, ver decisión 4)
- **Enmendada:** 2026-08-07 — ver «Enmienda» al final. Se revierte parcialmente
  el rechazo de la alternativa C: el alta de organización con Google **sí** se
  implementa, pero colgada del interruptor que ya la gobierna.
- **En producción desde:** 2026-08-07. Entrar con Google **verificado por el
  usuario con su cuenta real**, sobre un usuario dado de alta desde
  Administración con la casilla «entra con su cuenta de Google» (enmienda E1).
  Cero rechazos en el log del servidor.

> **Lo que decide este ADR:** que Google sea una *puerta de entrada más* a la
> sesión que ya existe, no un sistema de sesión nuevo. Lo que **no** decide: el
> alta de organizaciones (sigue siendo `/api/signup`), ni el modelo de permisos
> (`rol_permisos`, ADR 0010).

## Contexto

### Cómo se autentica hoy

No hay librería de autenticación. Ni NextAuth/Auth.js, ni iron-session, ni JWT.
Las únicas dependencias de auth en `apps/web/package.json` son `pg` y `bcryptjs`.
Es un diseño propio, corto y coherente:

| Pieza | Dónde |
|---|---|
| Verificación de credencial | `app/api/auth/login/route.ts:41` — bcrypt contra `auth_usuario_por_email()` |
| Sesión | tabla `sesiones` (`db/schema.sql:83-89`), token opaco de 256 bits, 30 días |
| Cookie | `spaces_sesion`, httpOnly, sameSite lax, `Secure` por `cookieSecure()` (`lib/server/auth.ts:145-162`) |
| CSRF | double-submit `spaces_csrf` + header `x-csrf-token`, exigido en `middleware.ts:53-77` |
| Resolución de sesión | `usuarioActual()` (`auth.ts:69-83`) → `auth_usuario_por_sesion()`, `SECURITY DEFINER` |
| Guard | `exigir(modulo, accion)` (`auth.ts:107-139`), usado por 65 de 81 route handlers |
| Tenant | `usuarios.tenant_id` → GUC `app.tenant_id` por transacción → RLS fail-closed (`lib/server/db.ts:54-73`) |

El token de sesión **no está firmado**: su validez se resuelve contra la tabla,
no criptográficamente. Eso es una ventaja aquí — se puede revocar de verdad.

El resultado importante para esta decisión: **el punto de entrada al sistema es
`crearSesion(usuarioId)`**. Todo lo demás —RLS, CSRF, permisos, candado de
cambios— cuelga de ahí y es agnóstico de *cómo* se probó la identidad. Añadir
Google puede ser un cambio local si se enchufa en ese punto, o una reescritura
completa si se enchufa en cualquier otro.

### Seis restricciones que condicionan el diseño

**1. `usuarios.tenant_id` es `NOT NULL` y la RLS es fail-closed + FORCE.**
Google entrega un correo verificado; **no entrega un tenant**. Un usuario sin
tenant no puede leer ni escribir nada: la política
`tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid` no le
casaría ninguna fila. Cualquier diseño tiene que responder de dónde sale el
`tenant_id`, y "lo crea sobre la marcha" es una respuesta con consecuencias
(ver restricción 2).

**2. El auto-registro ya está apagado en producción a propósito.**
`NEXT_PUBLIC_AUTOREGISTRO=0` corta `/api/signup` en el servidor, y el comentario
de `app/api/signup/route.ts:12-16` explica por qué: *el mismo despliegue sirve la
demo pública y producción*, así que un endpoint público de alta deja a cualquiera
crear organizaciones y usuarios `DUENO` en la base real. Un "Continuar con
Google" que dé de alta al desconocido reabre exactamente ese agujero, y lo
reabre por una puerta que el interruptor actual no cubre.

**3. El correo es único GLOBAL, en minúsculas.**
`usuarios_email_lower_uidx` (`db/schema.sql:71`). No es `(tenant_id, email)` como
en el Prisma archivado: es deliberado, porque el login es por correo sin pedir
tenant (`usuarios-repo.ts:163-171`). Para Google esto es una **ventaja**: el
correo identifica sin ambigüedad a un usuario y a su tenant. Y es también un
límite: una persona sigue sin poder pertenecer a dos organizaciones, igual que
hoy.

**4. La reautenticación del ADR 0009 exige una contraseña, y no hay plan B.**
Esta es la restricción que más forma le da a la decisión. Tres flujos vivos
asumen que **todo usuario tiene `password_hash`**:

- `desbloquear()` (`cambios.ts:168-170`): si el hash es `null` responde
  *«Tu usuario no tiene contraseña. Pide que te la restablezcan.»* Sin
  desbloqueo no hay cambios sensibles —dinero y catálogo— ni restablecimiento de
  contraseñas de terceros (`exigirReautenticacionSiempre()`).
- `actualizarPerfilCtrl()` (`perfil-controller.ts:37-43`): exige `passwordActual`
  y la verifica con bcrypt **antes de tocar nada**. Un usuario sin contraseña no
  puede cambiar ni su correo ni su contraseña.
- `exigir()` (`auth.ts:128-134`): con `debe_cambiar_password = true` corta
  **todo** salvo `/api/auth/me` y `PATCH /api/perfil`. Y la salida es
  precisamente `PATCH /api/perfil`, que pide la contraseña actual.

De ahí sale un estado terminal: **un usuario solo-Google al que un administrador
le aplique `POST /api/usuarios/:id/restablecer` queda encerrado**. Le ponen
`debe_cambiar_password = true`, le cierran las sesiones, y la única ruta abierta
para salir le pide una contraseña que nunca tuvo. No es una hipótesis remota: es
el flujo normal de administración del ADR 0009. Un diseño que no lo resuelva
introduce un bloqueo de cuenta irrecuperable desde la aplicación.

Nota lateral: `crearUsuario()` (`usuarios-repo.ts:41`) lanza si no le pasan
contraseña, así que hoy no existe ninguna fila con `password_hash = null` creada
por la aplicación. La columna es nullable en el esquema, pero el estado no se
alcanza. Google sería lo primero que lo alcance — y la decisión 4 es no
alcanzarlo todavía.

**5. La app vive bajo `basePath` detrás de nginx, y `trailingSlash` afecta a
`/api`.**
`basePath: '/spaces-dooh'` y `trailingSlash: true` en `next.config.mjs`, servida
en `https://demo.space-os.io` (`infra/nginx/demo.space-os.io.conf`) sobre pm2
`spaces-web` en `127.0.0.1:3000`.

Esto **no es una advertencia teórica**: se comprobó contra producción el
2026-08-06 y `trailingSlash` sí alcanza a las rutas de API.

```
/spaces-dooh/api/estado          -> 308  (Location: .../api/estado/)
/spaces-dooh/api/estado/         -> 401  (la respuesta real)
/spaces-dooh/api/auth/reset?token=x   -> 308  (query preservada)
/spaces-dooh/api/auth/reset/?token=x  -> 503  (la ruta se alcanza)
```

Google exige que el *redirect URI* coincida **carácter por carácter** con el
registrado en Cloud Console. Como la aplicación envía la versión **con barra
final**, ésa es la que hay que registrar:

```
https://demo.space-os.io/spaces-dooh/api/auth/google/callback/
```

**Corrección del 07/08.** La primera redacción justificaba la barra diciendo que
«Google no sigue redirecciones en el callback». Eso **no se verificó y
probablemente sea falso**: a la URL de callback llega el **navegador** —Google
solo emite un 302 hacia ella—, y un navegador sí sigue un 308 conservando la
query, como se comprobó con `/api/auth/reset`. La regla que sí importa, y que
vale igual, es la de arriba: **registrar exactamente lo que se envía**. No se
cambia lo que la aplicación manda; se corrige el motivo, para que nadie razone
sobre una premisa equivocada.

Registrar una URI distinta de la que se envía produce `redirect_uri_mismatch`,
que es lo que ocurrió al probar en local el 07/08 hasta registrar la de
`localhost`.

**6. No hay correo saliente.**
`RESEND_API_KEY` y `EMAIL_FROM` están vacías en producción, y por eso
`NEXT_PUBLIC_RECUPERAR_PASSWORD=0` (hallazgo **M11** de la auditoría QA, todavía
abierto). Hoy, quien olvida su contraseña depende de que un administrador se la
restablezca a mano. Google **mejora** esto de rebote: quien tenga cuenta
vinculada entra sin depender del correo saliente ni del administrador. Y en el
otro sentido, esta misma restricción es la que empuja la decisión 4: sin correo
saliente, un usuario encerrado no tiene **ninguna** vía de vuelta.

### Lo que NO hay que tocar

`lib/auth-context.tsx` es un cliente JWT+Bearer contra
`NEXT_PUBLIC_API_URL` (el backend Fastify archivado, que no existe). Sigue
montado en `app/providers.tsx:34` y sus fetch fallan en silencio, así que `user`
queda siempre `null`. **Es código muerto y no es el sistema de sesión.** Vale la
pena retirarlo, pero en su propio commit: confundirlo con la auth real sería el
error más caro que se puede cometer aquí.

## Decisión

**Google será un proveedor de identidad adicional que termina en la MISMA sesión
de siempre. No autoriza, no crea cuentas y no reemplaza nada.**

### 1. El flujo termina exactamente donde termina el login

El callback de Google, tras validar, hace lo mismo que
`app/api/auth/login/route.ts:46-56`: `crearSesion(u.id)`, `cookieSesion(token)`,
`cookieCsrf(nuevoCsrfToken())`. A partir de ese punto la sesión es
indistinguible de una nacida con contraseña — mismo RLS, mismo CSRF, mismos
guards, misma revocación. **Cero cambios en `exigir()`, en `middleware.ts` o en
los 65 handlers.**

Dos rutas nuevas, ambas bajo `/api/`, que el middleware ya trata como públicas
(`middleware.ts:95`) y que por ser `GET` no pasan por el filtro CSRF
(`middleware.ts:54`): no hace falta añadir ninguna exención.

- `GET /api/auth/google/inicio/` → redirige al consentimiento de Google.
- `GET /api/auth/google/callback/` → canjea el código y abre la sesión.

Las barras finales no son un descuido de escritura: ver restricción 5.

### 2. Authorization Code + PKCE, sin dependencias nuevas

Flujo servidor a servidor. El `code` se canjea contra
`https://oauth2.googleapis.com/token` desde el droplet, por TLS directo.

Como el `id_token` llega por ese canal directo y autenticado, **OIDC Core
§3.1.3.7 (punto 6) permite omitir la verificación de la firma JWT**: basta
decodificar el payload y validar sus campos. Eso ahorra `jose` o
`google-auth-library`, y con ellas una dependencia nueva que mantener y auditar
—coherente con la disciplina de `docs/DEPENDENCIAS.md`—. Se valida a mano, sin
excepciones:

| Campo | Regla |
|---|---|
| `iss` | `accounts.google.com` o `https://accounts.google.com` |
| `aud` | igual a `GOOGLE_CLIENT_ID` |
| `exp` | en el futuro |
| `nonce` | igual al emitido en `/inicio` |
| `email_verified` | **`true` estricto.** Ver implicaciones de seguridad |

`state` y `nonce` viajan en cookies httpOnly de vida corta (10 min), y el
`code_verifier` de PKCE con ellos. Se borran en el callback, se usen o no.

### 3. Vinculación explícita, por `sub`, en tabla aparte

Se añade `identidades_externas (proveedor, sub, usuario_id, tenant_id, ...)` con
`primary key (proveedor, sub)`, y una función
`auth_usuario_por_identidad(proveedor, sub)` `SECURITY DEFINER` —el mismo patrón
exacto que `auth_usuario_por_email()` y `auth_usuario_por_sesion()`
(`db/migrations/20260720_hard1_usuarios_rls.sql:40-114`), por la misma razón: la
resolución ocurre **antes** de saber el tenant, y `usuarios` es fail-closed.

Tabla y no columna en `usuarios` porque el `sub` de Google no es el último
proveedor que va a existir (Microsoft es el candidato obvio en este mercado), y
porque una tabla deja la vinculación como un hecho auditable y borrable sin
tocar la fila del usuario.

La resolución en el callback tiene exactamente tres caminos:

1. **Hay `sub` conocido** → ese usuario. Es el camino normal, y el único que se
   usa después de la primera vez. El `sub` es el identificador estable de Google;
   el correo no lo es.
2. **No hay `sub`, pero `lower(email)` existe en `usuarios`** → se graba la
   vinculación y se entra. Es la única vez que se decide por correo.
3. **Ninguna de las dos** → **401 y a la pantalla de login**, con un mensaje que
   diga qué pasó: *«Esa cuenta de Google no está dada de alta. Pide a tu
   administrador que te agregue.»*

El caso 3 es la decisión de fondo: **Google autentica, no da de alta.** No crea
usuarios, no crea tenants, no adivina a qué organización pertenece nadie. El
alta sigue siendo `/api/signup` (organización nueva) o Administración (usuario
dentro de una organización existente).

### 4. Todo usuario conserva su contraseña. Google es un atajo de entrada, no un sustituto

**Esta entrega NO toca `cambios.ts` ni `perfil-controller.ts`.** La
reautenticación de los flujos de dinero sigue pidiendo la contraseña, como hoy,
y vincular una cuenta de Google no exime de tenerla.

Se elige así, y no la reautenticación por Google, por tres razones:

- **Evita de raíz el estado terminal de la restricción 4.** Si nadie es
  solo-Google, nadie puede quedar encerrado por un restablecimiento. El problema
  no se resuelve: no se crea.
- **La restricción 6 lo agrava.** Sin correo saliente (M11 abierto), un usuario
  encerrado no tiene ninguna vía de vuelta desde la aplicación — haría falta que
  alguien le tocara la fila en la base.
- **`cambios.ts` gobierna las ocho rutas de dinero.** Abrir un segundo camino
  ahí es la fuente natural del próximo hueco: una rama que se olvide de
  comprobar el desbloqueo. Es trabajo que merece su propia entrega y sus propias
  pruebas, no un añadido a la primera.

Lo que se pierde y hay que decir en voz alta: **esta entrega no elimina la
contraseña**, que era parte de la promesa. Un usuario seguirá teniendo que
tenerla aunque entre siempre por Google. Lo que gana es entrar sin recordarla.

**Entrega 2 (fuera de este ADR):** `desbloquear()` acepta re-probar identidad
con Google (`prompt=login`, `max_age=0`, verificando que el `sub` es el del
usuario en sesión), y `actualizarPerfilCtrl()` acepta un desbloqueo vigente como
sustituto de `passwordActual`. Solo entonces tiene sentido permitir usuarios sin
`password_hash`.

### 5. Apagable, y sin trato preferente en el estado de la cuenta

- `GOOGLE_OAUTH=0` apaga la función **en el servidor**, no solo escondiendo el
  botón — misma lección que `NEXT_PUBLIC_AUTOREGISTRO` (`signup/route.ts:12-16`).
  Y **no** lleva prefijo `NEXT_PUBLIC_`: eso lo hornearía en el build y apagarlo
  exigiría recompilar, que es la trampa documentada para M11 en
  `HABILITAR_M11_RECUPERAR_PASSWORD.txt`. El botón del login se pinta según lo
  que diga el servidor, no una constante de build.
- **Sin `GOOGLE_HD`.** Es una variable global y solo admite un dominio de
  Workspace, pero en producción hay cinco organizaciones —`rgb`, `g500`, `eyro`,
  `telcel`, `demo-owner`— que no comparten dominio: restringir dejaría fuera a
  cuatro. El riesgo de vinculación lo cubren `email_verified: true` estricto y
  que Google no dé de alta a nadie. Si algún día se quiere, el sitio correcto es
  una columna por tenant, no una variable de entorno.
- Rate limit en `/callback` con `limitar()` (`lib/server/rate-limit.ts`), igual
  que el login.
- `activo = false` y `debe_cambiar_password` siguen aplicando idénticos a una
  sesión abierta por Google. Entrar por Google **no** es un rodeo para saltarse
  el corte del ADR 0009.

### 6. El proyecto de Google Cloud lo posee una cuenta de empresa

No una cuenta personal. El proyecto está en el camino crítico de entrada al
sistema: si lo posee una persona a título individual, su baja o su olvido de
contraseña se convierte en una caída de la autenticación de todos. Se crea con
una cuenta de empresa dedicada y con al menos dos propietarios en Cloud Console.

## Alternativas consideradas

### A. Adoptar NextAuth / Auth.js con el proveedor de Google

**Qué es:** la respuesta de manual. `next-auth` v5 con el adaptador de Postgres.
**A favor:** trae PKCE, `state`, `nonce`, rotación y verificación del `id_token`
ya resueltos y auditados por terceros. Menos criptografía escrita en casa.
**Por qué se descarta:** su modelo de sesión no es el de aquí. NextAuth quiere
gestionar sus propias tablas y su propia cookie —JWT o base de datos—, y aquí la
sesión es la clave que enciende **todo el aislamiento multi-tenant**: la cadena
`spaces_sesion` → `auth_usuario_por_sesion()` → `usuarioActual()` →
`tenantActual()` → `set_config('app.tenant_id')` → RLS. Sustituirla obliga a
reescribir `exigir()`, el double-submit del middleware, el candado de
`sesiones.desbloqueo_expira_en` y la resolución de tenant, y a revalidar los 65
handlers que dependen de ello. Se cambiaría una superficie pequeña y entendida
por una grande y ajena, a cambio de ahorrar unas 150 líneas de OIDC. El cálculo
no sale — y lo que se pondría en riesgo es justamente lo que más caro costó
(Hardening 1).

### B. Google Identity Services en el cliente (botón "One Tap", token al BFF)

**Qué es:** el botón de Google en el navegador devuelve un `id_token`; el front
lo manda al BFF, que lo verifica y abre sesión.
**A favor:** es lo más rápido de montar y da la mejor experiencia (One Tap).
**Por qué se descarta:** el `id_token` llega **por el cliente**, no por un canal
directo con Google, así que hay que verificar la firma de verdad contra el JWKS
—con caché, rotación de claves y sus fallos— y con ello entra la dependencia que
la opción elegida evitaba. Además el `nonce` se vuelve más difícil de atar a una
petición concreta del servidor. Es más superficie de ataque por menos código
propio. Se puede añadir después **encima** del flujo del servidor, como atajo de
UI, sin cambiar nada de lo decidido.

### C. Google crea la cuenta y su organización al vuelo

**Qué es:** si el correo no existe, se crea tenant + usuario `DUENO`, como hace
`crearOrgConDueno()` (`cuentas-controller.ts:33-54`).
**A favor:** cero fricción, "entra y ya"; resuelve por sí solo el problema del
`tenant_id`.
**Por qué se descarta:** es el agujero que `NEXT_PUBLIC_AUTOREGISTRO=0` cerró a
propósito, reabierto por otra puerta. Cualquiera con una cuenta de Gmail se daría
de alta como `DUENO` de una organización nueva en la base **de producción**, que
es la misma que sirve la demo pública. Y sobra un dato que no se puede inventar:
el nombre de la organización, que `signupSchema` exige (`cuentas-controller.ts:16`).

### D. Vincular por correo en cada entrada, sin guardar el `sub`

**Qué es:** el callback busca `lower(email)` cada vez y no persiste nada. Cero
migración.
**A favor:** es la implementación más corta posible; encaja con que el correo ya
sea único global.
**Por qué se descarta:** el correo de Google **no es un identificador estable**.
Se puede cambiar en un Workspace, y una dirección liberada puede reasignarse a
otra persona — momento en que el titular nuevo hereda la cuenta del anterior en
silencio. El `sub` es inmutable y es lo que Google documenta como clave. La
migración que ahorra son dos columnas; lo que arriesga es una toma de cuenta que
no dejaría rastro.

### E. Dejar solo contraseña y no hacer nada

**Qué es:** el statu quo.
**A favor:** ninguna superficie nueva, ningún secreto nuevo, ningún tercero en el
camino crítico de entrada.
**Por qué se descarta:** con `NEXT_PUBLIC_RECUPERAR_PASSWORD=0` y sin correo
saliente (restricción 6), hoy el olvido de contraseña se resuelve pidiéndole a un
administrador que ejecute un restablecimiento y **lea una contraseña temporal**
—deuda que el propio ADR 0009 reconoce en sus consecuencias negativas—. Google
la salda para quien lo use, sin esperar a que haya SMTP.

### F. Reautenticación por Google en esta misma entrega

**Qué es:** la decisión 4 en su versión completa — `desbloquear()` y
`actualizarPerfilCtrl()` aceptan probar identidad con Google, y con ello pueden
existir usuarios sin contraseña.
**A favor:** cumple entera la promesa de dejar de necesitar contraseña, y es el
final al que se quiere llegar.
**Por qué se aplaza:** abre un segundo camino en `cambios.ts`, que gobierna las
ocho rutas de dinero, y en el controlador de perfil. Es la deuda más cara de esta
decisión y la que hay que cubrir con pruebas dedicadas. Aplazarla no bloquea nada
—el beneficio visible es entrar sin recordar la contraseña, y eso ya lo da la
entrega 1— y evita el estado de encierro mientras M11 siga abierto. Se retoma en
un ADR propio.

## Consecuencias

**Positivas**

- El mecanismo de sesión, el aislamiento por RLS y el CSRF **no se tocan**. El
  cambio es aditivo y cabe en dos rutas, una tabla y una función SQL.
- Una vía de entrada que no depende del correo saliente ni de que un
  administrador teclee una contraseña temporal.
- La vinculación queda registrada y es revocable por sí sola: borrar la fila de
  `identidades_externas` corta el acceso por Google sin desactivar al usuario.
- Al conservar todos la contraseña, **no hay ninguna cuenta que dependa solo de
  Google**: si Google falla, se entra como siempre. Es la propiedad que hace que
  esta entrega no añada un punto único de fallo.
- El botón resuelve además una molestia real de la demo: entrar a
  `demo.space-os.io` sin recordar `Prueba1234`.

**Negativas**

- **No elimina la contraseña**, que era parte de la promesa. Sigue habiendo una
  que custodiar, rotar y restablecer. Se gana comodidad de entrada, no se quita
  el secreto.
- Una tabla y una función `SECURITY DEFINER` más en el arranque pre-sesión, que
  es la parte del esquema donde un error se paga más caro.
- **Las pruebas e2e no pueden hablar con Google.** El arnés
  (`lib/test/servidor-e2e.ts`) levanta un Next real; para ejercer el callback hay
  que poder apuntar el endpoint de token a un doble local, o el flujo se queda
  sin cobertura de integración y solo con unitarias sobre la validación de
  claims.
- Alta operativa nueva: proyecto en Google Cloud Console, pantalla de
  consentimiento y sus URIs por entorno.

**Implicaciones de seguridad**

- **Superficie que se agrega:** dos endpoints públicos sin sesión previa. El
  `/callback` es el sensible: acepta parámetros de un tercero y termina emitiendo
  una cookie de sesión. Se protege con `state` (CSRF del propio OAuth), `nonce`
  (replay del `id_token`), PKCE (intercepción del código) y rate limit. Los tres
  primeros son obligatorios, no opcionales: sin `state`, el callback es un
  *login CSRF* que mete a la víctima en la cuenta del atacante.
- **El riesgo mayor es la toma de cuenta por vinculación.** El paso 2 del punto 3
  entrega una cuenta existente a quien demuestre controlar su correo en Google.
  Por eso `email_verified: true` es una condición **estricta y no negociable**:
  Google emite `id_token` con `email_verified: false` para direcciones no
  comprobadas, y aceptar uno equivale a dejar entrar a cualquiera que escriba el
  correo de la víctima al registrarse. Con la bandera exigida, el riesgo se
  reduce a que Google entregue mal un correo, que es el supuesto que se está
  aceptando al adoptar el proveedor. Al renunciar a `GOOGLE_HD` (decisión 5),
  `email_verified` queda como **la única** barrera de la vinculación: no se
  relaja por ningún motivo, y su prueba es obligatoria.
- **Dónde viven los secretos:** `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en
  `apps/web/.env.production`, en el droplet, fuera de git y **no** con prefijo
  `NEXT_PUBLIC_`. Ese fichero se añadió a `.gitignore` el 2026-08-06 —no lo
  estaba, aunque nunca llegó a la historia—, junto con sus respaldos `.bak.*`. El
  `secret` lo rota quien administre el proyecto de Google Cloud; rotarlo exige
  reiniciar `pm2 spaces-web`. Ni el `id_token` ni el `access_token` de Google se
  persisten: se usan en la petición y se descartan. No se piden más *scopes* que
  `openid email profile`, y **ningún** *scope* de Gmail, Drive o Calendar —
  pedirlos convertiría un login en un acceso a los datos del usuario.
- **Modelo de autenticación/autorización:** cambia **solo la autenticación**. La
  autorización sigue siendo `rol_permisos` + RLS por `tenant_id`, sin tocar. El
  rol y el tenant salen de `usuarios`, **jamás** de nada que diga Google: aceptar
  el `hd` o el dominio del correo como criterio de tenant sería dejar que un
  tercero asigne permisos.
- **Datos sensibles:** se persisten el `sub` (opaco, sin PII) y el correo, que ya
  estaba. Cifrado en tránsito por TLS de nginx (HSTS 2 años ya configurado); en
  reposo, lo que dé el disco del droplet, igual que el resto — no cambia.
- **Dependencias nuevas:** ninguna, y es deliberado (ver decisión 2). Si en
  revisión se prefiere verificar la firma del JWT, la dependencia mínima es
  `jose`, y hay que pasarla por `docs/DEPENDENCIAS.md` con su lockfile.
- **Superficie de auditoría:** hay que registrar en bitácora el **primer
  vínculo** de una cuenta de Google a un usuario. Es el evento que, si se produce
  sin que el titular lo sepa, indica una toma de cuenta; los inicios de sesión
  posteriores no aportan lo mismo y ahogarían el registro. Los desbloqueos
  siguen sin registrarse, por la razón del ADR 0009.
- **Punto ciego conocido:** un usuario desactivado en Google (baja en el
  Workspace de la empresa) **conserva su sesión de 30 días** en Spaces, porque la
  sesión es local y nadie le pregunta a Google. Dar de baja a alguien exige
  seguir desactivándolo en Administración; Google no lo propaga.

## Cómo revertir

Barato, y esa es una de las razones para hacerlo así:

- Poner `GOOGLE_OAUTH=0` y reiniciar. El botón desaparece y los endpoints
  responden 503. Efecto inmediato, sin desplegar código y **sin recompilar**,
  porque la bandera no es `NEXT_PUBLIC_` (decisión 5).
- Retirar las rutas es borrar dos archivos: nada más depende de ellas.
- `identidades_externas` es una tabla **aditiva**; borrarla no toca ninguna fila
  de `usuarios`, `sesiones` ni nada existente.
- Las sesiones ya abiertas por Google no hay que distinguirlas ni purgarlas: son
  filas normales de `sesiones` y caducan solas a los 30 días. Si se quiere cortar
  antes, un `delete from sesiones` por `usuario_id`.

Al no implementarse la reautenticación por Google, **revertir no tiene ninguna
letra pequeña**: como todo usuario conserva contraseña, quitar Google no deja a
nadie sin forma de entrar. Ésa era la única parte cara de deshacer, y esta
entrega no la contrae.

## Preguntas abiertas

Ninguna bloqueante. Las cuatro del borrador previo quedaron resueltas el
2026-08-06: propietario del proyecto (decisión 6), `GOOGLE_HD` (decisión 5),
alcance de la reautenticación (decisión 4) y la barra final del *redirect URI*
(restricción 5, verificada contra producción).

Pendiente de operación, no de diseño: crear el proyecto en Google Cloud Console
con la cuenta de empresa y registrar las URIs de cada entorno.

---

## Enmienda · 2026-08-07

Se añaden dos formas de que una cuenta **nazca** ligada a Google. La decisión de
fondo del ADR no cambia —Google sigue sin decidir a qué organización pertenece
nadie, ni qué rol tiene— pero sí cambia el rechazo tajante de la alternativa C.

### E1. Alta de usuario «entra con Google» (no toca ninguna decisión previa)

En Administración → Usuarios, el alta acepta `entraConGoogle: true` y entonces
**no se manda ninguna contraseña**: el servidor genera una aleatoria que nadie
ve ni se comunica, y la persona entra con su cuenta de Google por el camino de
vinculación por correo que ya existía (decisión 3, paso 2).

Quita la fricción real del onboarding —inventar una contraseña y pasarla por
chat, que además la deja escrita en el historial de alguien— sin tocar nada del
modelo.

**La fila conserva `password_hash`, y es lo que hace que esto NO sea la entrega
2.** Un usuario sin hash no puede desbloquear las operaciones de dinero ni
cambiar su propio perfil, y si un administrador le restablece la contraseña
queda encerrado: la única salida le pide algo que nunca tuvo (restricción 4).
Con hash, `cambios.ts` y `perfil-controller.ts` **no se tocan** y no hay segundo
camino que mantener.

Lo que se hereda y hay que decir: esa persona sigue sin poder ejecutar las ocho
rutas de dinero si su tenant enciende la reautenticación, porque no conoce su
contraseña. La salida es un restablecimiento normal. Se cierra de verdad en la
entrega 2.

Se rechaza el alta si Google no está habilitado en ese servidor: crearía a
alguien que no puede entrar de ninguna forma, y una cuenta muerta sin motivo
aparente es peor que un error.

### E2. Alta de organización con Google (revierte en parte la alternativa C)

**Qué se mantiene del rechazo original.** El motivo era correcto y sigue siéndolo:
el mismo despliegue sirve la demo pública y producción sobre la misma base, así
que un alta pública deja a cualquiera con un Gmail crear una organización y un
usuario `DUENO` en datos reales.

**Qué cambia.** Ese riesgo no es nuevo ni exclusivo de Google: es exactamente el
que `NEXT_PUBLIC_AUTOREGISTRO=0` ya gobierna para `/api/signup`. Colgar el alta
con Google del **mismo interruptor**, comprobado en el **servidor**, no abre una
puerta nueva — le pone otra manija a una puerta que ya está cerrada con llave
donde importa. En producción responde 503 igual que `/api/signup`; en local,
donde el interruptor está abierto a propósito, funciona.

Lo que decidió el rechazo original y ya no aplica: «sobra un dato que no se puede
inventar, el nombre de la organización». Se resuelve pidiéndolo **antes** de ir a
Google. Viaja en cookie httpOnly de vida corta, con `state`, `nonce` y el
verifier de PKCE:

- **no en el `state`**, que va y vuelve por la URL y ahí lo vería —y podría
  cambiarlo— cualquiera que mire la barra de direcciones;
- y su **presencia es lo que distingue «entrar» de «darse de alta»**, así que
  decidirlo desde la URL de vuelta sería dejar que el visitante eligiera qué
  operación ejecuta el servidor.

La cookie se **borra** cuando el flujo no es un alta, no se deja estar: si no, un
intento de alta abandonado convertiría el siguiente inicio de sesión en la
creación de una organización que nadie pidió.

La organización se crea con `crearOrgConDueno()`, la MISMA función que usan
`/api/signup` y el alta de CRM del super-admin. Duplicarla habría sido la forma
segura de que las tres divergieran.

### Consecuencias de la enmienda

- El caso 3 de la decisión 3 («ninguna de las dos → 401») deja de ser absoluto:
  ahora tiene una excepción, y esa excepción **es** la superficie a vigilar. La
  prueba que importa no es que el alta funcione, sino que con el interruptor
  apagado responda 503 — verificado por mutación.
- `activo`, `debe_cambiar_password` y el modelo de permisos siguen intactos: una
  cuenta nacida con Google es indistinguible de una nacida con contraseña.
- Sigue sin implementarse lo que la entrega 2 debe: usuarios sin contraseña y
  reautenticación con Google.
