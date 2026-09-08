---
tipo: modulo
estado: verificado
actualizado: 2026-09-07
tags: [backend, auth, seguridad, rojo]
archivos:
  - apps/web/lib/server/auth.ts
  - apps/web/lib/server/cambios.ts
  - apps/web/lib/server/usuarios-repo.ts
  - apps/web/lib/server/password-reset-repo.ts
  - apps/web/middleware.ts
  - db/migrations/20260720_hard1_usuarios_rls.sql
  - db/migrations/20260819_semilla_rol_permisos.sql
  - db/migrations/20260825_sesion_metodo.sql
  - apps/web/lib/server/perfil-controller.ts
  - apps/web/lib/server/codigos-recuperacion.ts
  - apps/web/lib/server/codigos-recuperacion-repo.ts
  - apps/web/app/api/auth/codigo/route.ts
  - apps/web/app/api/perfil/codigos-recuperacion/route.ts
  - db/migrations/20260907_codigos_recuperacion.sql
  - db/migrations/20260907_codigos_vistos.sql
  - db/migrations/20260907_solo_google.sql
  - db/migrations/20260828_reautenticacion_por_defecto.sql
  - apps/web/components/demo/shell/Topbar.tsx
---

# Autenticación y sesión

> [!danger] ZONA ROJA
> Nada de este módulo se toca sin aprobación humana. Ver [[zonas-de-riesgo]].

## Mecanismo: propio, sin librería

Las únicas dependencias son `pg` y `bcryptjs` (`apps/web/package.json:37-38`).
No hay NextAuth, ni `jose`, ni iron-session.

| Pieza | Valor | Evidencia |
|---|---|---|
| Cookie de sesión | `spaces_sesion`, httpOnly, sameSite lax, 30 días | `lib/server/auth.ts:15-16,204-214` |
| Token | 256 bits aleatorios, **opaco y sin firma** | `lib/server/auth.ts:103-113` |
| **Método de la sesión** | `'password'` \| `'google'`, **obligatorio y sin default** (ADR 0018) | `lib/server/auth.ts:96,98-103` · `20260825_sesion_metodo.sql` |
| Validez | Fila viva en `sesiones` con `expira_en > now()` | `auth_usuario_por_sesion()` |
| Hash de contraseña | bcrypt costo 10 | `lib/server/auth.ts:87-89` |
| Contraseña generada (alta con Google) | `passwordAleatoria()`, cumple la política por construcción | `lib/server/auth.ts:59-62` |
| Cookie CSRF | `spaces_csrf`, **httpOnly:false a propósito** | `lib/server/auth.ts:222-239` |
| `Secure` | ON en producción salvo `COOKIE_SECURE=0` | `lib/server/auth.ts:197-201` |

> [!warning] Las seis citas de arriba habían derivado hasta 21 líneas — recalculadas el 27/08
> `auth.ts` pasó de 188 a **239** líneas entre el 10/08 y el 25/08 (`passwordAleatoria()`
> primero, el bloque del ADR 0018 después), y **ninguna** de esas citas daba error:
> mandaban al sitio equivocado en silencio. Ejemplo del daño: `:92-101` apuntaba a
> `crearSesion` y hoy `:92` es `return bcrypt.compare(...)` — o sea, quien buscara
> «cómo se genera el token» acababa leyendo la verificación de contraseña. Es
> exactamente el modo de fallo que describe [[convenciones]] §4.

> [!danger] El ADR 0018 abre una excepción a «para cambiar la contraseña hay que teclear la anterior»
> Desde el 25/08, quien entró con Google y **nunca** ha tenido contraseña puede
> fijar la primera **sin** teclear la anterior. La condición no es «entró con
> Google» a secas: es **esta sesión** se abrió con Google, y por eso hizo falta
> la columna `sesiones.metodo` — antes «no quedaba rastro de por dónde entró
> nadie» (`20260825_sesion_metodo.sql:5-8`).
>
> Tres decisiones que sostienen la excepción y **no se tocan a la ligera**:
> 1. `crearSesion(usuarioId, metodo)` **no tiene valor por omisión**, a propósito:
>    un default silencioso le regalaría la excepción a una tercera vía de entrada
>    que alguien añada sin pensarlo (`lib/server/auth.ts:98-103`).
> 2. Las sesiones que ya existían se marcaron **`'password'`**, no `'google'`: de
>    ellas no se puede afirmar el origen, y la opción segura es la que **cierra**
>    la excepción.
> 3. El alta con Google **sigue generando un `password_hash`**, así que
>    `cambios.ts` y `perfil-controller.ts` no cambian de invariante.
>
> Verificado en producción el 25/08. La ruta es `PATCH /api/perfil`, y la pantalla
> conocía la regla pero era inalcanzable hasta `113ffa4`.

## El camino de una petición autenticada

```mermaid
sequenceDiagram
    participant N as Navegador
    participant M as middleware.ts
    participant R as route.ts
    participant A as auth.ts
    participant PG as Postgres

    N->>M: petición con cookie spaces_sesion
    M->>M: ¿mutación /api/? → header x-csrf-token == cookie spaces_csrf
    Note over M: solo comprueba PRESENCIA de la cookie de sesión
    M->>R: next()
    R->>A: exigir('modulo','accion')
    A->>PG: auth_usuario_por_sesion($token) · SECURITY DEFINER
    PG-->>A: usuario o nada
    A->>A: ¿activo? ¿debeCambiarPassword? ¿tienePermiso?
    A-->>R: {ok:true, usuario} | {ok:false, 401|403}
```

## Las seis funciones `SECURITY DEFINER`

`usuarios` es RLS **fail-closed + FORCE** (`20260720_hard1_usuarios_rls.sql:136-141`),
y el login ocurre **antes** de conocer el tenant. Una lectura directa devolvería
cero filas. Por eso hay funciones acotadas, una por cada pregunta que hay que
poder responder **sin sesión**:

| Función | Para qué | Llegó con |
|---|---|---|
| `auth_usuario_por_email(text)` | Login con contraseña | Hardening 1 |
| `auth_usuario_por_sesion(text)` | Resolver la sesión en cada petición | Hardening 1 |
| `auth_email_existe(text)` | Unicidad global de correo | Hardening 1 |
| `auth_usuario_por_identidad(text,text)` | Login con Google | ADR 0012 |
| `auth_reset_por_token(text)` | Recuperación por correo | Restablecer contraseña |
| `auth_codigo_recuperacion(text)` | Entrar con un código (B1) | ADR 0028 |

> [!warning] Esta nota dijo «exactamente cuatro» hasta el 07/09, y eran seis
> El recuento se escribió el 27/08 y **no se movió cuando llegaron dos funciones
> más**. Medido el 07/09 contra la base, no contra la prosa:
> `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
> where n.nspname='public' and p.prosecdef` devuelve **diez**, de las cuales seis
> son `auth_*` y las otras cuatro resuelven tenant por token público
> (`portal_`, `firma_`, `propuesta_`, `config_`). Es el mismo modo de fallo que
> §5 del CLAUDE.md: una cifra que envejece sin dar error.

Con `revoke execute … from public` y `grant` solo al rol de la app, más un
`ASSERT` que hace fallar la migración si ese rol tiene `SUPERUSER`/`BYPASSRLS`
(`20260720_hard1_usuarios_rls.sql:146-157`).

> [!note] La creación de `auth_usuario_por_sesion` va guardada desde T-04 (17/08)
> `20260720_hard1_usuarios_rls.sql:78-101` solo la crea si no existe ya
> (`to_regprocedure`), porque su forma vigente la fija
> `20260804_reautenticacion_individual.sql:70-71` —la que añade
> `debe_cambiar_password`— y reaplicar la cadena la degradaría a la versión de
> julio. Con eso, **quien manda sobre la firma de esta función es la migración de
> agosto**, no la de julio. Ver [[migraciones]].

## Las tres llaves del Dueño — ADR 0028 (B1, B2, B3)

Desde el 07/09 una cuenta puede tener **cerrada la puerta de la contraseña**, y
por eso hicieron falta las tres piezas a la vez. Cerrar una sin abrir la otra
habría dejado al Dueño con Google como llave única.

| Pieza | Dónde | Qué hace |
|---|---|---|
| `usuarios.solo_google` | `20260907_solo_google.sql` | Nace en `false` para todos. En `true`, esa cuenta **no entra** con contraseña |
| Códigos de recuperación | `codigos_recuperacion` + `auth_codigo_recuperacion()` | Diez por lote, de un solo uso, `sha256`. Se muestran **una vez** |
| `usuarios.codigos_vistos_en` | `20260907_codigos_vistos.sql` | Hasta que se confirma, `exigir()` corta: no se puede usar la aplicación sin haber guardado los códigos |

> [!important] La contraseña deja de ABRIR, pero sigue haciendo falta para CAMBIAR
> Son dos preguntas distintas y se responden por separado. El punto 4 del ADR
> 0028 exige teclear la contraseña para los cambios **aunque se haya entrado con
> Google**, así que `solo_google` no borra el hash ni lo invalida: solo dice que
> con él no se entra. `cambios.ts` y `perfil-controller.ts` no cambian.

Tres decisiones de este bloque que **no son de estilo**:

1. **El candado se comprueba DESPUÉS de verificar la contraseña**
   (`app/api/auth/login/route.ts`). Antes sería enumeración gratis: bastaría
   probar correos para saber cuáles existen. Puesto después, el mensaje solo lo
   oye quien ya demostró tener la credencial.
2. **`solo_google` NO viaja en `auth_usuario_por_email()`.** El primer intento
   fue añadirle la columna, como hizo `20260825_sesion_metodo.sql` con la de
   sesión — y rompió `reaplicacion.e2e.test.ts`, porque
   `20260720_hard1_usuarios_rls.sql:40` la crea con `create or replace` **sin la
   guarda de `to_regprocedure`** que sí lleva su vecina. Ponérsela habría sido
   editar una migración ya aplicada en producción (R3) y romper el guard de
   checksums de toda la flota. Se lee aparte, por `qConTenant`: cuando hace falta
   el tenant ya se conoce.
3. **Los códigos van con `sha256`, no bcrypt.** Un código es de 74 bits
   aleatorios: no hay diccionario que atacar, y bcrypt ahí solo compra latencia
   en la puerta donde menos conviene tenerla.

Y una que manda sobre las demás, con su e2e: **una cuenta desactivada no entra ni
con código**. Un código es una llave, no un permiso — si a alguien se le retiró
el acceso, se le retiró por todas las puertas.

### Regenerar: la misma ruta, dos operaciones (B6)

`POST /api/perfil/codigos-recuperacion` hace dos cosas distintas y la frontera es
`codigos_vistos_en`:

| Caso | Pide contraseña | Por qué |
|---|---|---|
| Primer lote (`codigos_vistos_en is null`) | **No** | Es la SALIDA del cerrojo. Pedirla encerraría a quien entró con Google y todavía no tiene ninguna |
| Regenerar (ya confirmó uno) | **Sí**, `exigirReautenticacionSiempre()` | Es un cambio: invalida en silencio los códigos que su dueño tiene en papel |

El guard es el **incondicional**, no `exigirDesbloqueo()`: el interruptor del
tenant no puede decidir esto. Y queda en la bitácora **sin los códigos dentro** —
regenerar es lo primero que haría quien se llevara una sesión abierta, así que el
dueño legítimo tiene que poder reconocer el «yo no hice eso».

> [!important] El orden importa, y hay una e2e que solo vigila eso
> Un 403 que ya hubiera borrado el lote sería **peor** que no tener candado: el
> atacante no entra y el dueño se queda fuera igualmente. El guard corre antes
> del `delete`, y `regenerar-codigos.e2e.test.ts` lo comprueba entrando con un
> código de los viejos después del rechazo.

### Los DOS cerrojos de `exigir()` van en un orden, y la interfaz en el otro

Encontrado el 07/09 al recorrer la cadena completa:

- El servidor corta **primero** por la contraseña temporal (`auth.ts:204`) y
  **después** por los códigos (`auth.ts:230`).
- El `AuthGate` lleva al usuario **primero** a los códigos.

**No es un fallo:** las dos pantallas están exentas del guard a propósito, así que
ninguna se bloquea a sí misma. Pero tiene una consecuencia práctica que conviene
saber: **confirmar los códigos NO abre la aplicación**. Sigue cerrada, ahora por
la otra razón, y las dos contestan 403. Quien depure esto por el código de estado
y no por el mensaje va a mirar el cerrojo equivocado.

### Cómo nace el Dueño de una instancia (A3.1)

Desde el 07/09 `/api/bootstrap` **no recibe ninguna contraseña**, y si se la mandan
responde **400**. El Dueño nace así:

| Columna | Valor | Por qué |
|---|---|---|
| `password_hash` | aleatorio, `passwordAleatoria()` | **NO nulo, y es deliberado.** Un usuario sin hash queda encerrado: no puede desbloquear dinero ni tocar su perfil (`auth.ts:48-62`) |
| `solo_google` | `true` | La contraseña no abre la puerta (ADR 0028) |
| `debe_cambiar_password` | `true` | Es lo que le abre la excepción del ADR 0018 para fijar **la suya** sin teclear la anterior — que no sabe |

> [!important] Es el único sitio que enciende `solo_google`
> B3 construyó el candado y nada lo ponía. Lo pone el bootstrap, y solo ahí: las
> altas normales (`/api/signup`, `/api/tenants`) lo dejan en `false`, porque el
> punto 3 del ADR 0028 dice que los demás usuarios eligen.

> [!warning] El correo del alta pasa a ser crítico
> Ya no hay clave que entregar, así que **ese correo ES la forma de entrar**: tiene
> que ser la cuenta de Google del Dueño. Con uno equivocado nace una organización
> a la que no puede entrar nadie, y la puerta del bootstrap se cierra detrás.

### La cadena completa, medida una vez (B5)

`lib/test/primer-dia-dueno.e2e.test.ts` recorre el primer día del Dueño de una
instancia nueva: entra con Google → guarda sus códigos → fija su primera
contraseña sin teclear la temporal (ADR 0018) → desbloquea los cambios con ella →
y toca el dinero.

Existe porque **cada eslabón tenía prueba y la cadena no**. Y el eslabón que la
sostiene es el tercero: la contraseña que generó el operador del alta **el Dueño
no la conoce**, así que sin la excepción del ADR 0018 el desbloqueo le pediría
algo que para él no existe — y con `exigir_reautenticacion` en `true` por omisión
desde el 28/08, eso significaría que **el Dueño de cada instancia nueva no puede
facturar**. La cadena está entera; lo que no estaba era la prueba de que lo
estaba.

> [!warning] El arnés tiene DOS puertos auxiliares, y compartirlos rompe en diferido
> `servidor-e2e.ts` usa el **3311**, el doble de Google el **3312**
> (`doble-google.ts:21`) y el servidor sin Google de las pruebas del bootstrap el
> **3313**. Los tres distintos a propósito: el 07/09 el último estrenó el 3312 y
> no se notó, porque el único archivo con doble corría ANTES. Al aparecer el
> segundo, CI murió en un archivo que no tenía nada que ver, once ficheros
> después, con un mensaje que mandaba a buscar un doble suelto inexistente.
>
> Y el que dejó el puerto tomado fue el otro defecto del mismo sitio: las
> opciones del `spawn` escritas EN LÍNEA, sin `detached`. Sin él el hijo no
> lidera su grupo, `process.kill(-pid)` se va en ESRCH y el `next start`
> sobrevive con el puerto. Es exactamente el fallo que `proceso-e2e.ts` existe
> para no repetir — **y se repitió en cuanto alguien volvió a escribirlas a
> mano**. Si lanzas un proceso en una prueba: `opcionesDeProceso()`,
> `vigilarErrores()` y `esperarMuerte()`, los tres.

Cobertura del bloque: `lib/test/codigos-recuperacion.e2e.test.ts`,
`lib/test/codigos-vistos.e2e.test.ts`, `lib/test/solo-google.e2e.test.ts`,
`lib/test/regenerar-codigos.e2e.test.ts` y `lib/test/primer-dia-dueno.e2e.test.ts`.

## CSRF — double-submit

`middleware.ts:45-72`. En `POST/PUT/PATCH/DELETE` sobre `/api/`, si hay cookie de
sesión, exige `x-csrf-token == spaces_csrf`. El front parcha `window.fetch` para
reenviarlo (`lib/csrf-client.ts:36-66`).

**Exentos** (no dependen de la cookie): `/api/auth/login`, `/auth/forgot`,
`/auth/reset`, `/auth/logout`, `/api/signup`, `/api/portal/`, `/api/firma/`,
`/api/propuestas/publica/` y, desde el 26/08, **`/api/bootstrap`**
(`middleware.ts:58-61`).

> [!important] La exención de `/api/bootstrap` no es su protección
> Se exime porque **no hay sesión que proteger**: la base está vacía, no existe
> cookie. Su cerrojo real es triple y **ninguno es el CSRF**: `BOOTSTRAP_TOKEN`
> presente y coincidente, `tenants` vacía, y 10/h por IP; si falla cualquiera
> contesta **404, nunca 401** — para no confirmar que la ruta existe. Hay una
> prueba dedicada a que esa exención **no se derrame** a rutas vecinas
> (`0b7e10a`).

> [!tip] Las rutas de Google no necesitan exención
> Son `GET`, y el filtro solo mira mutaciones.

## Permisos (RBAC)

`rol_permisos (rol, modulo, accion)` — `ver | crear | aprobar | facturar`.

> [!warning] La matriz de permisos es GLOBAL
> `rol_permisos` **no tiene `tenant_id` ni RLS** (`db/schema.sql:75-80`). El RBAC
> es de la instalación entera, no por organización. Ver [[preguntas-abiertas]].

> [!danger] No hay atajo para el Dueño: si la tabla está vacía, no ve nada
> `permisosDeRol` y `tienePermiso` (`auth.ts:139-157`) son consultas directas a
> `rol_permisos`, **sin excepción por rol**, y `exigir()` es fail-closed. Ningún
> rol —tampoco `DUENO`— tiene privilegio implícito.
>
> Eso convierte el contenido de la tabla en parte del producto, y hasta el
> 19/08 **no viajaba con él**: `db/schema.sql:75-80` la crea vacía y lo único
> que la sembraba era `20260804_modulo_inventario.sql:22`, cinco filas de un
> módulo. Una instancia recién aprovisionada nacía con el Dueño encerrado fuera
> de su propia aplicación. Lo siembra
> `db/migrations/20260819_semilla_rol_permisos.sql` — 25 filas · 8 módulos ·
> 3 roles — y **al día siguiente** lo completa
> `20260820_catalogo_permisos_completo.sql`: **41 filas · 9 módulos · 5 perfiles**
> (`:2`, `:126-127`). Esa es la cifra vigente. El detalle, en [[migraciones]].
>
> Las dos migraciones existen porque **había DOS catálogos y ganaba el que
> corriera último**, sin error y sin aviso: en el ensayo el Dueño pasó de 19 a 24
> permisos solo por el orden. Lo que impide que dos listas diverjan no es que hoy
> coincidan — es que **solo exista una**.

> [!warning] ~~Dos roles del enum siguen sin una sola fila~~ — RESUELTO el 20/08, y con dinero de por medio
> Esta nota afirmó hasta el **27/08** que `IMPRENTA` y `FINANZAS` entraban y
> recibían 403 en todo. **Dejó de ser cierto el 20/08**, siete días antes, con
> `20260820_catalogo_permisos_completo.sql`: `IMPRENTA` pasó de 0 a **3**
> permisos (`:117-119`) y `FINANZAS` de 0 a **4** (`:120-123`).
>
> Lo que hay que mirar dos veces es el cuarto de `FINANZAS`: **`facturar`**, que
> es acción de **dinero irreversible — zona R4** ([[zonas-de-riesgo]]). Fue una
> decisión expresa, no un efecto colateral, y la migración **es aditiva**: al
> actualizarse, una instancia que ya existía **gana** esas filas. Quien dé de
> alta un usuario `FINANZAS` le está dando la facturación.
>
> Los roles siguen ofreciéndose en `components/demo/shell/nav.ts:136-137`, y
> `CLIENTE` sigue retirado de esa lista por el ADR 0010 (`nav.ts:138-141`) — esas
> tres citas también habían derivado.

## Reautenticación para cambios sensibles (ADR 0009)

Para tocar dinero o catálogo hay que reescribir **la propia contraseña de
login**; eso desbloquea esa sesión 15 minutos.

| Pieza | Dónde |
|---|---|
| Interruptor por organización | `tenants.exigir_reautenticacion` (**apagado por defecto**) |
| Estado del desbloqueo | `sesiones.desbloqueo_expira_en` — **en el servidor** |
| Duración | `DESBLOQUEO_MINUTOS = 15` (`cambios.ts:49`) |
| Sin exención por rol | Retirada a propósito (`cambios.ts:41-44`) |

`exigirReautenticacionSiempre()` (`cambios.ts:221-226`) ignora el interruptor:
tocar el **acceso** de otra persona no debe depender de una preferencia del
tenant. Es lo que protege `/api/usuarios/[id]/restablecer`.

> [!danger] INVARIANTE: todo usuario tiene `password_hash`
> `cambios.ts:168-170` responde *«Tu usuario no tiene contraseña»* y
> `perfil-controller.ts:83-88` exige `passwordActual`. Un usuario con
> `password_hash = null` **no puede** desbloquear, ni cambiar su correo, ni salir
> de `debe_cambiar_password`: queda encerrado sin salida desde la aplicación.
>
> El invariante se sostiene en dos sitios: `crearUsuario()` lanza si no recibe
> contraseña (`usuarios-repo.ts:49-50`), y el alta «entra con Google» **genera una
> que nadie ve** en vez de dejar el campo vacío (`4206ab2`). Es la solución por
> construcción a la restricción 4 del ADR 0012.
>
> **No introduzcas un camino de alta que deje el hash nulo.** Ver
> [[flujo-acceso-con-google]].

> [!warning] «Encerrado sin salida» dejó de ser cierto el 25/08 — el ADR 0018 abre UNA puerta
> Este párrafo describía un punto muerto real: quien entra con Google recibe una
> contraseña que **nadie ve**, y `PATCH /api/perfil` le pedía justo esa para poder
> cambiarla. El ADR 0018 lo resolvió, y conviene leer la excepción entera antes de
> tocar nada de aquí: son **cuatro condiciones que van juntas**
> (`perfil-controller.ts:49-57`), y cada una tapa un abuso distinto.
>
> | Condición | Qué impide |
> |---|---|
> | `debeCambiarPassword` | La excepción es de **un solo uso por cuenta**: en cuanto pone la suya, deja de aplicar |
> | `metodoSesion === 'google'` | No basta con *poder* usar Google: hay que haber entrado por ahí **en esta sesión** (de ahí `sesiones.metodo`) |
> | Identidad vinculada | Defensa en profundidad: hoy la implica la anterior, pero una tercera vía de entrada no debe heredar la excepción por descuido |
> | `!cambiaEmail` | **La más importante.** Poner tu primera contraseña, no apropiarte de la cuenta: con el correo abierto, una sesión robada se quedaría con la cuenta entera |
>
> **El invariante de arriba no cambia**: el hash sigue sin ser nunca nulo. Lo que
> cambia es que ahora hay una forma legítima de sustituir el generado.

## Contraseñas

Política única (`apps/web/lib/password.ts:26-39`): ≥8 caracteres, al menos una
letra y un número, sin espacios. **Ya no vive en `auth.ts`** — salió a
`lib/password.ts` el 10/08 (`cde5f58`) y `auth.ts:36` solo la reexporta.
La comparten signup, alta de usuarios y cambio de perfil — y
`passwordAleatoria()` (`auth.ts:59-62`) la **construye** en vez de confiar en el
azar, porque base64url puede salir sin letra o sin dígito y el alta fallaría una
vez de cada tantas.

Restablecimiento por correo: `password_resets`, token de 256 bits, un solo uso,
60 minutos, y **borra todas las sesiones del usuario**
(`password-reset-repo.ts`). Está apagado en producción
(`NEXT_PUBLIC_RECUPERAR_PASSWORD`) porque no hay correo saliente.

> [!note] `password_resets` pasó a fail-closed el 07/08
> `20260807_password_resets_rls.sql` (`f703c1c`). Ya **no** es una tabla exenta
> de RLS: cumple el mismo invariante que el resto. Queda una parte pendiente,
> anotada por la propia sesión que lo hizo para el 10/08 (`ba8cb12`).

## Rate limiting

En memoria, ventana fija (`lib/server/rate-limit.ts`). **Por instancia**: si
algún día se escala a varias, deja de valer.

| Ruta | Límite |
|---|---|
| login | 10 / 5 min por IP |
| forgot | 5 / 15 min por IP + 3 / h por correo |
| reset | 10 / 15 min |
| signup | 5 / h por IP |
| google/inicio | 10 / 5 min por IP |
| desbloquear | 5 / 5 min por usuario+IP |
| bootstrap | 10 / h por IP (`app/api/bootstrap/route.ts:63`) — **pasarse contesta 404**, no 429 |

## Deuda conocida

1. `app/api/tenant-activo/route.ts:23` usa `process.env.COOKIE_SECURE === '1'`
   en vez de `cookieSecure()`. **Hoy no es un bug**: `COOKIE_SECURE=1` está
   puesta en el droplet (comprobado el 07/08). Es deuda: el día que falte esa
   variable, esta cookie perderá `Secure` **y las otras dos no**, porque
   `cookieSecure()` cae a `NODE_ENV === 'production'`. Ver [[preguntas-abiertas]] P9.
2. No hay purga de `sesiones` ni `password_resets` vencidos.
3. No hay rotación de sesión ni sliding expiration.

## Relacionadas
[[multi-tenancy-y-rls]] · [[flujo-login]] · [[flujo-acceso-con-google]] ·
[[api-endpoints]] · [[decisiones]] · [[zonas-de-riesgo]] · [[MOC-Proyecto]]
