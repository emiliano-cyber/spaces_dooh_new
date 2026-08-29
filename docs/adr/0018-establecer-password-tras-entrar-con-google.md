# ADR 0018 — Establecer la contraseña tras entrar con Google, sin teclear la anterior

- **Fecha:** 2026-08-25
- **Estado:** Aceptada — **construida y verificada en producción el 2026-08-25**
- **Decide:** Emiliano
- **Relacionadas:** [ADR 0009](0009-reautenticacion-individual-en-vez-de-contrasena-compartida.md) (reautenticación
  individual) · [ADR 0012](0012-acceso-con-cuenta-de-google.md) · el modelo de
  acceso decidido el 2026-08-20 · `vault/07-Agentes/diario/2026-08-25.md`

---

## Contexto — un punto muerto medido, no hipotético

El 2026-08-25, el Dueño del PADRE entró con Google y **quedó encerrado**:

1. `bootstrap-auth.mjs` crea al Dueño con `debe_cambiar_password = true` y una
   contraseña temporal que **imprime una sola vez** (`bootstrap-auth.mjs:229`).
   La del 21/08 se perdió al cerrar la consola.
2. Google lo autentica sin problema.
3. Pero la bandera obliga a cambiar la contraseña, y el formulario **pide la
   anterior** — que nadie tiene.
4. Y no hay salida por correo: el `.env.production` del PADRE **no tiene
   configuración de envío**, así que el flujo de recuperación no puede entregar
   nada.

**No es un caso raro: es el camino por defecto** del modelo de acceso decidido el
20/08, donde *«las cuentas de máximo privilegio entran solo con Google»*. Toda
instancia nueva nacerá así.

### Por qué no vale simplemente quitar la bandera

`20260804_reautenticacion_individual.sql:18-22` dice para qué existe:

> *«`debe_cambiar_password` — lo activa el restablecimiento de terceros. Mientras
> esté en true el login deja entrar SOLO a cambiar la contraseña. Sin esto, la
> temporal que ve el administrador seguiría siendo válida indefinidamente y él
> podría entrar como esa persona cuando quisiera.»*

Quitarla dejaría **viva para siempre** la temporal que vio quien corrió el alta.

### Y por qué el Dueño sí necesita una contraseña

Porque `exigir_reautenticacion` (ADR 0009) pide **la contraseña de login del
propio usuario** para los cambios sensibles. Un Dueño sin contraseña no puede
reautenticarse. **«Entrar con Google» y «no tener contraseña» no son lo mismo.**

## Decisión

**Un usuario puede ESTABLECER su contraseña sin teclear la anterior si y solo si
se cumplen las tres condiciones a la vez:**

1. **`debe_cambiar_password = true`** — nunca ha puesto la suya.
2. **La sesión actual se abrió con Google.**
3. **Tiene una identidad de Google vinculada** en `identidades_externas`.
4. **La petición NO cambia también el correo.**

La condición 1 hace la excepción **autoextinguible**: aplica una vez y, en cuanto
el usuario pone su contraseña, deja de aplicar para siempre.

> **La 4.ª apareció al construirlo**, leyendo el controlador: la puerta de
> reautenticación cubre **correo y contraseña a la vez**
> (`perfil-controller.ts:12-16`). Dejarla abierta para el correo convertiría
> «poner tu primera contraseña» en **«apropiarse de la cuenta»** — justo el
> ataque que esa puerta existe para cerrar. Es la condición que el ADR no vio
> desde el diseño y sí desde el código.

### Lo que obliga a construir antes

**La sesión no registra hoy cómo se abrió.** Medido: `sesiones` tiene
`token`, `usuario_id` y `expira_en` (`db/schema.sql:83`), y
`crearSesion(usuarioId)` (`lib/server/auth.ts:92-101`) se llama **idéntica** desde
el login con contraseña y desde el callback de Google.

Así que la condición 2 **no se puede evaluar** sin añadir esa información:
una columna `sesiones.metodo` (`'password' | 'google'`), fijada al crear la
sesión. Es una **migración nueva**, no una modificación de las aplicadas.

## Consecuencias

### Lo que se gana

- **Se cierra el punto muerto** sin dejar viva ninguna contraseña temporal.
- **El Dueño acaba con contraseña propia**, así que la reautenticación del ADR
  0009 sigue funcionando.
- **Aplica a cualquier usuario en esa situación**, no solo al Dueño — ver la nota
  de alcance abajo.

### Lo que cuesta, y hay que decirlo claro

> **Debilita el efecto de robar una sesión.** Hoy, quien roba una sesión tiene
> acceso mientras la sesión viva; para conseguir acceso **permanente** necesita
> además la contraseña anterior. Con esta regla, si esa sesión cumple las tres
> condiciones, el atacante puede fijar una contraseña y **sobrevivir a la
> revocación de la sesión**.

Se acepta porque la exposición es estrecha y se cierra sola:

- Solo alcanza a cuentas que **nunca han puesto contraseña** (condición 1).
- Solo desde sesiones abiertas **con Google** (condición 2), donde el atacante ya
  tuvo que comprometer la cuenta de Google o robar la cookie.
- Y **desaparece en cuanto el usuario la usa una vez**.

Frente a la alternativa real —dejar la temporal del administrador válida para
siempre, o dejar al Dueño encerrado— es menos riesgo, no más.

### Nota de alcance: no se limita a DUEÑO

Se propuso restringirla a los Dueños. **La condición 2 ya hace ese trabajo mejor.**
El encierro no ocurre por ser Dueño: ocurre por **entrar con Google sin haber
recibido nunca la contraseña temporal**. A un usuario normal, el administrador le
entrega la temporal en mano, así que la conoce y no se encierra — y si además
entrara con Google, tendría exactamente el mismo derecho a salir del paso.

Restringir por rol añadiría una regla que no protege de nada y dejaría encerrado
a quien no sea Dueño.

## Alternativas descartadas

**Quitar `debe_cambiar_password` a los Dueños.** Deja viva la temporal que vio un
tercero — justo lo que la bandera existe para impedir.

**Dueños sin contraseña, solo Google.** Rompe la reautenticación del ADR 0009 para
los cambios sensibles, que es precisamente quien más los hace.

**Exigir una reautenticación fresca con Google antes de fijar la contraseña.** Es
**más seguro que lo decidido aquí** y sería lo correcto si esto protegiera algo
más ancho. Se descarta por coste frente a una excepción que solo aplica una vez
por usuario. ⚠️ **Es a lo que se vuelve** si la condición 1 se relajara alguna vez.

**Recuperación por correo.** No existe: el despliegue no tiene envío configurado.
Y aunque lo tuviera, añade el correo como segunda vía de acceso a la cuenta de
máximo privilegio, que es lo que el modelo del 20/08 quiso evitar al elegir
Google.

## Cómo se construye

**Es ROJO por partida doble** —toca sesión y lleva migración—, así que va con
prueba en rojo primero y en commits separados:

1. **Migración**: `sesiones.metodo`, con `default 'password'` para las filas que
   ya existen. Ninguna sesión viva podrá usar la excepción, y es lo correcto: no
   se puede afirmar de ellas que vinieran de Google.
2. **`crearSesion`** acepta el método y lo registra. Los dos llamadores —el login
   y el callback de Google— pasan el suyo.
3. **El endpoint de perfil** salta la comprobación de la contraseña anterior solo
   con las tres condiciones.
4. **Pruebas**, y las negativas son las que importan: sesión de contraseña →
   **se rechaza**; `debe_cambiar_password = false` → **se rechaza**; sin identidad
   vinculada → **se rechaza**.

### ✅ Verificado en el PADRE, 2026-08-25

El Dueño entró con Google y **guardó su contraseña sin teclear ninguna anterior**.
`debe_cambiar_password` pasó a `false` solo, así que la excepción **ya no le
aplica**: a partir de ahora entra por donde quiera, y tiene credencial para la
reautenticación del ADR 0009.

Cerrado el punto muerto que abrió este ADR, y en la única forma que lo demuestra:
usándolo.

### Lo construido, 2026-08-25

| | |
|---|---|
| Migración | `db/migrations/20260825_sesion_metodo.sql` — columna, `check`, y la función reescrita |
| Sesión | `crearSesion(usuarioId, metodo)` — **el método es obligatorio**, sin valor por omisión |
| Tipo | `UsuarioSesion.metodoSesion` |
| Repo | `tieneIdentidadVinculada(usuarioId, proveedor)` |
| Puerta | `perfil-controller.ts` · `puedeFijarSinAnterior()` |
| Pantalla | `lib/perfil-acceso.ts` · `puedeFijarPasswordSinAnterior()`, consumida por `configuracion/page.tsx` |
| Tipo del cliente | `UsuarioAuth.metodoSesion` |
| Pruebas | `perfil-controller.password-google.test.ts` — **9** · `perfil-acceso.test.ts` — **7** · `google-oauth.e2e.test.ts` — **3 de punta a punta** |

> [!danger] El tercer intento fue el que funcionó, y el fallo era R2
> `tieneIdentidadVinculada` se escribió con **`qRaw`**, que **no fija**
> `app.tenant_id`. `identidades_externas` tiene **RLS + FORCE** con política
> por ese GUC (`20260806_identidades_externas.sql:77-82`), así que la consulta
> devolvía **cero filas en silencio** y la excepción no se abría nunca.
>
> **Las 16 pruebas unitarias seguían en verde**, porque el repo está mockeado.
> Es exactamente lo que avisa `CLAUDE.md`: *«las pruebas unitarias no ven los
> fallos de RLS: simulan la base»*. Y es la **tercera** aparición de R2 en la
> historia del proyecto.
>
> El razonamiento equivocado —escrito en el propio comentario— era «se resuelve
> antes de que haya tenant»: **cierto para el callback de Google**, que por eso
> usa una función `SECURITY DEFINER`, y **falso aquí**, donde la sesión y el
> tenant ya están resueltos.
>
> Lo cerró una prueba **por HTTP contra Postgres de verdad**, la única capa
> donde la RLS participa.

> [!warning] La primera versión dejó la regla INALCANZABLE, y conviene no repetirlo
> Se implementó solo en el servidor. `configuracion/page.tsx:119` cortaba el
> envío **en el navegador** —`if (!passwordActual) { toast.error(...); return }`—
> así que la petición nunca salía. La regla era correcta y **no había forma de
> ejercerla desde la interfaz**.
>
> Es el mismo defecto que ya documenta `lib/auth-real.ts:21-26` sobre
> `debeCambiarPassword`: *«el servidor lo MANDA desde el ADR 0009, pero este tipo
> no lo declaraba y por tanto nadie lo miraba»*. **Un dato que el servidor envía
> y el cliente no declara es un dato que no existe.**
>
> La decisión se extrajo a `lib/perfil-acceso.ts` en vez de escribirla dentro del
> componente porque este proyecto **no tiene arnés de pruebas de UI**: una
> condición de seguridad metida en un `.tsx` no se puede probar.

**Verificado:** `typecheck` limpio · **858** unitarias en 79 archivos · `build`
limpio · e2e **20 archivos, 213 pruebas y 1 saltada**, con `aislamiento.e2e.test.ts`
**sin tocarse**. Migraciones **72 → 73**.

> **El método de sesión no tiene valor por omisión, y es deliberado.** Un default
> silencioso haría que una tercera vía de entrada heredara una decisión de
> seguridad sin que nadie la tomara. Que el compilador lo exija es lo único que
> obliga a pensarlo.
