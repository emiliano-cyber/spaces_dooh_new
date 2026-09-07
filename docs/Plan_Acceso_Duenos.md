# Plan — cómo entra el Dueño de una instancia

> **Qué implementa:** el [ADR 0028](adr/0028-google-obligatorio-y-la-contrasena-para-los-cambios.md).
> **Estado:** propuesto el 2026-09-07, tras cerrarse su punto abierto.
> **Desbloquea:** el §5 del [ADR 0029](adr/0029-el-alta-desatendida-y-la-maquina-de-estados.md) — la Fase 3 del alta desatendida.

---

## Lo que hace que esto merezca la pena

No es «añadir Google». Es **quitar el último secreto que AS OOH ve de un cliente.**

Hoy el alta genera la contraseña del Dueño, la imprime en la consola del operador, y de
ahí sale a un chat, un correo o un ticket. **Pasó el mismo 2026-09-07, dos veces.** Con
este plan:

- el Dueño entra con Google, así que **el alta no genera ninguna contraseña**;
- sus códigos de recuperación **los genera y los ve él**, en su navegador;
- y con eso el bootstrap deja de tener nada que entregar → **el alta se automatiza entera**.

> [!danger] TODO esto es Z1 · Auth, zona ROJA
> `crearSesion()` es el punto único por el que se entra al sistema, y de la sesión cuelga
> todo el aislamiento multi-tenant. **Cada tarea de aquí necesita `npm run test:e2e`**, no
> solo unitarias: las unitarias simulan la base y **no ven los fallos de RLS**.
>
> Y una tarea toca migración (B1), así que son **dos** disparadores de los cuatro.

---

## B1 · Los códigos de recuperación `[código + migración]` — ✅ **HECHA**

- **Objetivo:** que exista un secreto de un solo uso con el que un Dueño entra sin Google.
- **El patrón ya está en el repo y no hay que inventarlo:** `password-reset-repo.ts`. Es
  otro secreto **pre-sesión** —se usa justo cuando no puedes entrar— y por eso su lectura
  va por una función `SECURITY DEFINER`: al resolver el código **todavía no se sabe de qué
  organización es quien pregunta**, así que la RLS no puede ayudar aún.
- **Forma:** 10 códigos por usuario, **guardados con `sha256`** —nunca en claro—, cada uno
  de un solo uso y con su `usado_en`.

> [!warning] Corrección al implementar: **sha256, no bcrypt**
> Esta tarea decía «con `bcrypt` como las contraseñas», y estaba mal. Una contraseña la
> elige una persona y tiene poca entropía: bcrypt existe para que probarlas salga caro. Un
> código de aquí es aleatorio y de **~74 bits**, así que la fuerza bruta ya es inviable y el
> hash lento **no compra nada**.
>
> Y sí costaría: bcrypt lleva sal, así que el mismo código da hashes distintos y **no se
> puede buscar**. Habría que traer los diez códigos del usuario y compararlos uno a uno —
> casi **un segundo de CPU por cada intento fallido**, en la ruta que se usa justo cuando
> alguien no puede entrar. Un vector de denegación de servicio regalado.
>
> Es el mismo razonamiento con el que F5.8 eligió un token opaco en vez de un JWT firmado.
- **Prueba que falla primero, y los negativos son el grueso:**
  - un código usado **no vale una segunda vez**;
  - un código de **otro usuario** no entra en esta cuenta;
  - un código de **otro tenant** no resuelve (es el caso que la RLS no puede cubrir sola);
  - consumir uno **no invalida los demás** —a diferencia de un reset de contraseña—, porque
    si no, el primer uso dejaría al Dueño con una sola vida;
  - y **no se guardan en claro**: la prueba lee la fila y comprueba que no está el valor.
- **Criterio:** con un código válido se abre sesión; con uno usado, no; y la tabla no
  contiene ningún código legible.

### Cerrada el 2026-09-07, con e2e

`codigos-recuperacion.ts` (puro, **16 casos**), `codigos-recuperacion-repo.ts`,
`db/migrations/20260907_codigos_recuperacion.sql` y **12 e2e contra Postgres real**.
**1089 unitarias · 308 e2e en 30 archivos**, typecheck limpio.

> [!important] Las e2e corren con el rol de la APLICACIÓN, no con el administrador
> Y es la decisión que las hace valer algo. `lib/server/db.ts` construye su pool **al
> cargarse**, leyendo `DATABASE_URL` una vez — así que importar el repo arriba lo conectaba
> a la base de desarrollo (`spaces`) en vez de a la de integración, y el primer intento dio
> `relation "codigos_recuperacion" does not exist`.
>
> Se carga tarde y apuntando a **`URL_APP`**. Con el administrador la RLS **no se aplica**,
> así que un `qRaw` mal puesto pasaría inadvertido — que es exactamente el fallo que estas
> pruebas existen para cazar.

**Y no cambia el comportamiento de hoy:** no hay ruta, ni pantalla, ni nadie que llame al
repo. Es cimiento.

**De paso, otra prueba hizo su trabajo:** `esquema-sin-owner` fija el número de tablas de la
receta completa y se puso roja sola al pasar de **39 a 40**. Su comentario ya decía qué
hacer —«se actualiza a conciencia»— y ahí queda la historia de la cifra.

**Dos cosas que el código decide y conviene no deshacer sin leer por qué:**

- **Consumir un código no invalida los demás** —a diferencia de un reset de contraseña—, o
  el primer uso dejaría al Dueño con una sola vida.
- **El `update` lleva `and usado_en is null`**, no solo la comprobación previa: entre leer y
  escribir cabe otra petición, y dos simultáneas con el mismo código lo gastarían las dos.

## B2 · La pantalla que los enseña UNA vez `[código]`

- **Objetivo:** que los códigos lleguen al Dueño **sin pasar por nadie**.
- **Cuándo:** en su primera entrada con Google, antes de dejarle usar la aplicación.
- **Lo que hay que hacer bien, y es donde esto se hace mal en todas partes:** la pantalla
  **exige una confirmación explícita** antes de continuar. Enseñar el secreto y dejar que
  el usuario navegue es cómo se pierde.
- **Prueba que falla primero:** que **no se pueda saltar** —una petición a otra ruta con la
  sesión recién creada y los códigos sin confirmar redirige de vuelta—, y que **una segunda
  visita no los vuelva a enseñar**.
- **Depende de:** B1.

## B3 · El candado «solo Google» por usuario `[código]`

- **Objetivo:** que las cuentas del PADRE y el Dueño de cada instancia **no puedan entrar
  con contraseña**. Hoy **no existe**: cero coincidencias en el repo.
- **Prueba que falla primero, todos negativos:** con el candado puesto, `login` con la
  contraseña correcta **falla igual**; sigue funcionando el cambio de contraseña estando
  dentro (que hace falta para el punto 4 del ADR); y **quitar el candado es explícito**, no
  un efecto colateral de editar el usuario.
- **Depende de:** B1 y B2 — **el candado va DESPUÉS**, o alguien se queda fuera antes de
  tener con qué volver a entrar.

## B4 · `/api/bootstrap` falla sin Google configurado `[código]` — ✅ **HECHA**

- **Objetivo:** que no nazca una instancia cuyo Dueño no pueda entrar nunca.
- **Hoy:** sus tres cerrojos son token presente, token correcto y `tenants` vacía. No mira
  Google (`app/api/bootstrap/route.ts:26-27`).
- **Prueba que falla primero:** sin `GOOGLE_OAUTH=1` y sin `CLIENT_ID`/`SECRET`, el
  bootstrap **devuelve error y no crea nada** — ni la organización ni el usuario. Que no
  cree «la mitad» es lo que hay que probar.
- **Y hay un paso de operación que esto obliga:** `GOOGLE_REDIRECT_URI` lleva el dominio
  dentro, así que **cada instancia nueva exige registrar su URI en un cliente OAuth**. Va a
  la tarjeta del alta.

### Cerrada el 2026-09-07 — 4 e2e en verde

**13/13** en `bootstrap.e2e.test.ts`, y los otros 29 archivos verdes en la corrida de CI.

> [!important] Costó tres intentos, y los tres fallos valen para las próximas pruebas
> 1. **Apagar Google por entorno no llega al servidor del arnés:** `servidor-e2e.ts` fija
>    `GOOGLE_OAUTH: '1'` y las credenciales **después** del `...process.env`. Y ese archivo
>    no se toca.
> 2. **Importar el handler en proceso revienta:** `tenant.ts` usa `cache()` de React y
>    `cookies()` de `next/headers`, que solo existen dentro del runtime de Next.
> 3. **La solución —un `next start` propio con Google apagado— daba 404 en todo**, porque le
>    faltaba el `basePath: '/spaces-dooh'`. El aviso de `next start` sobre `output:
>    standalone` que sale por stderr **es ruido, no la causa**: el arnés usa el mismo
>    `next start` y funciona.
>
> Levantar un servidor propio **no viola el invariante**: éste dice que no se modifica
> `servidor-e2e.ts`, no que no se pueda arrancar un servidor.

**Y el cambio sigue sin ser inocuo, aunque esté verificado.** A partir de él, una instancia **sin Google configurado no
puede arrancar su primera organización** — y hoy **ninguna lo tiene**
(`app.env.example:100` reparte `GOOGLE_OAUTH=0`). Fusionar y desplegar esto antes de B2/B3
y del paso en la consola de Google **rompe el alta**.

> [!important] Hallazgo del camino, y afecta a toda prueba futura sobre Google
> `servidor-e2e.ts` fija `GOOGLE_OAUTH: '1'` y las dos credenciales **después** del
> `...process.env`, así que apagarlas desde una prueba **no llega al servidor**. Y ese
> archivo **no se toca** (invariante del proyecto).
>
> Por eso los casos de B4 llaman al handler **en el mismo proceso**. Se pierde la capa HTTP
> —ya cubierta por los otros casos— y se conserva lo único que aquí importa: **el orden**,
> que es lo que demuestra que no se crea media instancia.

## B5 · `exigir_reautenticacion` nace en `true` `[migración]`

- **Objetivo:** el punto 4 del ADR — para cambios, siempre contraseña.
- **Es cambiar un valor por omisión sobre un mecanismo ya probado**, no código nuevo:
  `cambios.ts` ya reautentica contra `usuarios.password_hash`, y
  `20260804_reautenticacion_individual.sql:34` lo crea en `false`.
- **Y ojo con el orden:** si el Dueño entra con Google y aún no ha fijado contraseña, esto
  le bloquearía los cambios. El puente es el **ADR 0018**, que ya existe: fijar la primera
  contraseña con la sesión abierta por Google. **Hay que comprobar que ese camino funciona
  antes de encender esto.**

## B6 · Regenerar los códigos desde el perfil `[código]`

- **Objetivo:** que perder la pantalla de B2 no sea perder la cuenta.
- Con la sesión abierta, «generar otros» invalida los anteriores y enseña los nuevos una
  vez. **Prueba negativa:** los viejos dejan de valer.

---

## Y cuando esto esté, se cierra solo lo de al lado

Con B1–B4 construidos, **el §5 del ADR 0029 deja de estar bloqueado**: el bootstrap ya no
produce ninguna contraseña que entregar, así que el ejecutor puede crear la primera
organización sin nadie delante. **La Fase 3 del `Plan_Alta_Desatendida.md` se convierte en
una tarea normal.**

## Lo que este plan NO hace

- **No toca `aislamiento.e2e.test.ts`** (invariante 7). Si alguna tarea obliga a abrirlo,
  esa tarea está mal.
- **No construye el correo saliente.** Sigue sin existir en el PADRE, y sigue bloqueando la
  recuperación de contraseña de un usuario normal — que es otro problema, no éste.
- **No decide qué pasa con los usuarios normales que ya existen.** Este plan es sobre el
  Dueño y las cuentas del PADRE; el punto 3 del ADR 0028 dice que los demás eligen, y eso
  ya funciona hoy.

## Una condición previa que sigue abierta

**Si `DO_SSH_KEYS` lleva también la clave de `padre`.** No bloquea este plan, pero sí lo
que viene después: una instancia creada por el panel **solo la alcanza `altas`**, y el
camino de soporte del ADR 0025 da por hecho que una persona salta desde el PADRE.
