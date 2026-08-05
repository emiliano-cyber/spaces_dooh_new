# ADR 0009: Reautenticación individual en vez de contraseña compartida

- **Fecha:** 2026-08-04
- **Estado:** Aceptada

> Aprobada el 2026-08-04. Se confirmaron los tres puntos con coste operativo:
> **sin exención para el Dueño**, y **contraseña temporal de un solo uso** para el
> restablecimiento de terceros mientras no haya correo saliente.
>
> **Orden de despliegue obligatorio:** primero la migración
> `db/migrations/20260804_reautenticacion_individual.sql` (como `postgres`),
> después el código. Al revés, `desbloquear()` lee columnas que no existirían.

Responde al hallazgo **A7** de la auditoría QA del 04/08/2026 («Gestión de
contraseñas débil en Administración», severidad ALTA).

## Contexto

Hoy conviven **tres** mecanismos de contraseña, y dos de ellos rompen la
identidad individual.

### 1. La contraseña de login — correcta

`usuarios.password_hash`, bcrypt costo 10, verificada en `auth.ts`. Por usuario.
Nada que objetar.

### 2. El «Control de cambios» — un secreto COMPARTIDO

`lib/server/cambios.ts` implementa un candado para operaciones sensibles (dinero
y catálogo). La mecánica es sólida en todo menos en una cosa:

| Pieza | Dónde | Estado |
|---|---|---|
| Dónde vive la contraseña | `tenants.cambios_password_hash` | bcrypt, nunca viaja al cliente ✅ |
| Dónde vive el desbloqueo | `sesiones.desbloqueo_expira_en` | en el SERVIDOR, no manipulable ✅ |
| Duración | 15 min (`DESBLOQUEO_MINUTOS`) | razonable ✅ |
| Exención | `ROL_SIN_CANDADO = 'DUENO'` (`cambios.ts:31`) | ⚠️ |
| **A quién pertenece la contraseña** | **al TENANT, no al usuario** | ❌ |

El defecto está en la última fila. Es **una sola contraseña que todos los roles
no-Dueño teclean**. De ahí se siguen tres cosas:

- **No hay identidad.** La bitácora registra que *Ana* facturó, pero lo que el
  sistema verificó es que *alguien que conoce el secreto del equipo* facturó. La
  atribución del registro de auditoría es más fuerte de lo que la evidencia
  sostiene, que es la peor propiedad que puede tener una bitácora.
- **No se puede revocar a una persona.** Si Ana se va, la única forma de quitarle
  el acceso a cambios sensibles es rotar la contraseña **de todo el equipo**.
- **Se propaga.** Un secreto que cinco personas teclean a diario acaba en un
  post-it, un WhatsApp o un gestor compartido.

### 3. El reset de contraseña de terceros — impersonación

`PATCH /api/usuarios/:id` con `{ password }` (`usuarios-controller.ts:54-69`,
ruta en `app/api/usuarios/[id]/route.ts:11-27`) deja que cualquier `DUENO` fije
la contraseña de **otro** usuario. Requisitos: solo `exigir('administracion',
'crear')`. **No** pide reautenticación, **no** invalida las sesiones del
afectado, y **no** avisa al afectado.

El resultado es impersonación limpia: el actor fija la contraseña, entra como esa
persona, y todo lo que haga queda registrado a nombre de ella. La bitácora anota
«Cambió la contraseña de X» — deja rastro del reset, pero no de la suplantación
posterior, que es indistinguible de actividad legítima.

### Cuatro restricciones que condicionan el diseño

**1. No hay correo saliente.** `emailHabilitado()`
(`lib/server/email.ts:14`) exige `RESEND_API_KEY` **y** `EMAIL_FROM`; en
producción **las dos están vacías**, y por eso
`NEXT_PUBLIC_RECUPERAR_PASSWORD=0`. La recomendación natural de la auditoría
—«cambio de contraseña de terceros solo mediante liga de restablecimiento por
correo»— **hoy no es implementable**. Cualquier diseño que dependa del correo
nace apagado.

**2. En G500 los tres usuarios son `DUENO`** (verificado en `spaces_prod`). En el
tenant que se va a demostrar, la exención de `ROL_SIN_CANDADO` aplica a todos:
el control de cambios no le pide nada a nadie, y los tres pueden cambiarse la
contraseña entre sí. El candado existe pero no está tocando a nadie.

**3. Ya existe la infraestructura del desbloqueo por sesión.**
`sesiones.desbloqueo_expira_en` y `exigirDesbloqueo()` funcionan y están cableados
en 8 rutas. El cambio puede reusar la fontanería y tocar solo *contra qué se
compara la contraseña*.

**4. `sinExenciones` ya existe** (`cambios.ts:135-141`) y se usa en los datos
bancarios del arrendador. El concepto de «esto se reconfirma incluso siendo
Dueño» está admitido en el diseño; falta generalizarlo.

## Decisión

**La reautenticación pasa a ser individual: cada quien teclea SU PROPIA
contraseña de login.** Concretamente:

1. **Se elimina el secreto compartido.** `tenants.cambios_password_hash`
   (`text`) se sustituye por `tenants.exigir_reautenticacion` (`boolean`),
   migrando `true` donde hoy hay hash y `false` donde es `null`, para que ningún
   tenant cambie de comportamiento al desplegar.

2. **`desbloquear(password)` verifica contra `usuarios.password_hash` del usuario
   de la sesión**, no contra el hash del tenant. El resto de la mecánica
   (`sesiones.desbloqueo_expira_en`, 15 minutos, desbloqueo por sesión) no
   cambia.

3. **Deja de haber exención por rol.** `ROL_SIN_CANDADO` desaparece. Con la
   contraseña propia el coste para el Dueño es el mismo que para los demás
   —teclear lo que ya sabe—, así que la exención dejó de comprar comodidad y solo
   compraba riesgo: es justo la sesión del Dueño la que más daño hace si queda
   desatendida. `sinExenciones` se vuelve redundante y se retira.

4. **El reset de contraseña de terceros deja de fijar una contraseña elegida por
   el administrador.** `PATCH /api/usuarios/:id` ya no acepta `password`. En su
   lugar, `POST /api/usuarios/:id/restablecer`:
   - exige reautenticación del actor (punto 2);
   - genera una contraseña temporal aleatoria que **se muestra una sola vez** a
     quien la ejecuta;
   - marca `usuarios.debe_cambiar_password = true`, y el login obliga a
     cambiarla antes de dejar entrar a ninguna otra ruta;
   - **invalida todas las sesiones vivas** del usuario afectado;
   - registra en bitácora quién la restableció y sobre quién.

5. **Cuando haya correo saliente, la temporal se sustituye por una liga de un
   solo uso** y el administrador deja de ver ningún secreto. El punto 4 está
   diseñado para que ese cambio afecte solo a cómo se entrega el secreto, no a
   quién puede pedirlo ni a qué se invalida.

### Nota de implementación (2026-08-04)

La revisión de código sobre la propia implementación encontró tres formas en que
la decisión **no se cumplía en la realidad desplegada**. No cambian lo decidido;
lo hacen cierto. Se dejan escritas porque las tres son fáciles de reintroducir:

1. **La reautenticación del punto 4 era inerte.** Se apoyaba en
   `exigirDesbloqueo()`, que respeta `tenants.exigir_reautenticacion` — y ese
   interruptor está **apagado en los cinco tenants de producción**. El
   restablecimiento habría seguido sin pedir nada. Se añadió
   `exigirReautenticacionSiempre()`, que no consulta el interruptor: tocar el
   ACCESO de otra persona no es algo que deba depender de una preferencia del
   tenant. Como efecto, `desbloquear()` deja de exigir que el candado esté
   encendido — si no, la operación pedía una contraseña y el endpoint para
   dársela respondía que no hacía falta.

2. **El forzado de cambio no cubría `/api/estado`.** Estaba condicionado a que
   la ruta declarase módulo, y esa ruta llama a `exigir()` a secas y devuelve
   **todo** el conjunto de datos del tenant. Quien tuviera la temporal podía
   leerlo entero sin cambiarla: justo la ventana de suplantación que el punto 4
   venía a cerrar. Ahora el corte es incondicional. No hace falta lista de
   excepciones porque las dos rutas que deben seguir vivas —`/api/auth/me` y
   `PATCH /api/perfil`— resuelven con `usuarioActual()` y nunca pasan por el
   guard; queda anotado en ambas.

3. **Encender el candado no cerraba los desbloqueos vivos.** La consulta iba por
   `qRaw`, que no fija `app.tenant_id`, y su subconsulta lee `usuarios`, que es
   fail-closed + FORCE: devolvía cero filas y el `update` quedaba en un **no-op
   silencioso**. Quien estuviera desbloqueado seguía operando hasta 15 minutos
   después de encenderlo. El defecto venía heredado de `fijarPasswordCambios` y
   se arrastró al reescribir. Ahora va por `qConTenant`.

## Alternativas consideradas

### A. Dejar la contraseña compartida y solo documentarla

**Qué es:** aceptar el secreto de equipo, exigir que se rote periódicamente.
**A favor:** cero trabajo; el flujo actual no se toca.
**Por qué se descarta:** no arregla nada de lo que hace grave al hallazgo. La
bitácora seguiría atribuyendo a personas acciones que solo prueban conocimiento
de un secreto colectivo, que es el problema de fondo en un sistema donde esas
acciones mueven dinero.

### B. Liga de restablecimiento por correo, y nada más

**Qué es:** lo que recomienda literalmente la auditoría.
**A favor:** es el estándar; el administrador nunca conoce el secreto.
**Por qué se descarta como solución única:** **no hay correo saliente** (ver
restricción 1). Adoptarla hoy dejaría el restablecimiento *inoperante*, y con él
a cualquier usuario que olvide su contraseña — un bloqueo operativo real a cambio
de una mejora de seguridad que no llegaría a existir. Se adopta como paso 5, no
como paso 1.

### C. 2FA/TOTP para las operaciones sensibles

**Qué es:** segundo factor con app autenticadora en cada cambio sensible.
**A favor:** es lo más fuerte, y la auditoría lo pide para roles con poder
financiero.
**Por qué se descarta *ahora*:** resuelve un problema distinto (robo de
credenciales) y no el que nos ocupa (ausencia de identidad individual). Además
arrastra inscripción, códigos de recuperación y soporte a usuarios que pierden el
teléfono. Con la contraseña compartida en pie, añadir 2FA sería poner una puerta
blindada al lado de una ventana abierta. Queda como ADR posterior, **encima** de
esta base, no en su lugar.

### D. Aprobación por segundo par de ojos (maker-checker)

**Qué es:** el cambio sensible queda pendiente y lo confirma otro usuario.
**A favor:** control interno más fuerte que cualquier reautenticación; ideal para
facturación.
**Por qué se descarta ahora:** exige un modelo de solicitudes pendientes,
notificaciones y estados intermedios en cada flujo tocado — mucho más que un
rediseño de contraseñas. Y en G500, con **un solo rol** entre los tres usuarios,
no habría separación real de funciones que lo sustente. Vale la pena cuando los
tenants tengan roles diferenciados.

## Consecuencias

**Positivas**

- Cada desbloqueo prueba **quién** era. La bitácora pasa a estar respaldada por
  la evidencia que afirma.
- Revocar a una persona es desactivar su usuario. No hay que rotarle nada a nadie
  más.
- Desaparece un secreto que circulaba por canales informales.
- Un Dueño con la sesión abierta y desatendida ya no puede facturar ni tocar
  catálogo sin volver a identificarse.
- El reset ya no entrega una contraseña que el administrador conozca de forma
  duradera, y corta las sesiones vivas del afectado.
- Menos superficie de código: se retiran `ROL_SIN_CANDADO`, `sinExenciones`,
  `fijarPasswordCambios` y la columna del hash compartido.

**Negativas**

- **Más fricción para el Dueño**, que hoy no teclea nada. En G500 son los tres
  usuarios. Es deliberado, pero se va a notar y conviene avisarlo antes.
- La contraseña temporal **es un secreto que el administrador ve**. Es mejor que
  hoy (es de un solo uso y fuerza cambio) pero peor que una liga por correo. Es
  deuda explícita, saldada en el paso 5.
- `debe_cambiar_password` mete un estado nuevo en el login que hay que respetar en
  todas las rutas; olvidarlo en una deja un rodeo por el que se entra sin cambiar
  la temporal.
- Migración de esquema en una tabla (`tenants`) y una columna nueva en
  `usuarios`.

**Implicaciones de seguridad**

- **Superficie que se quita:** un secreto compartido por tenant, la exención de
  reautenticación por rol, y la posibilidad de fijar la contraseña de otro a
  voluntad. Los tres eran vías de impersonación.
- **Superficie que se agrega:** el endpoint de restablecimiento devuelve una
  contraseña temporal en la respuesta HTTP. Va sobre TLS (prod ya es HTTPS), se
  muestra una vez y no se persiste en claro — pero **queda en el historial del
  navegador de quien la ejecuta si se copia mal**, y aparecería en un log de
  proxy que registre cuerpos de respuesta. Hay que documentar que no se registren
  cuerpos en esa ruta.
- **Dónde viven los secretos:** todos como bcrypt costo 10 en
  `usuarios.password_hash`. Se elimina el único hash que no correspondía a una
  persona. Nadie «rota» nada centralmente: cada quien cambia la suya.
- **Autenticación/autorización:** el modelo de permisos por rol
  (`rol_permisos`) **no cambia** — esto es ortogonal, y se trata en el ADR 0010.
  Lo que cambia es la prueba de presencia: de «conoce el secreto del equipo» a
  «es esta persona».
- **Datos sensibles:** ninguno nuevo. La contraseña temporal es efímera y su
  hash es el único rastro persistido.
- **Dependencias nuevas:** ninguna. Se reutiliza `bcryptjs`, ya presente.
- **Superficie de auditoría:** mejora. Hoy se registra el reset pero la
  impersonación posterior es invisible; con la invalidación de sesiones, el
  afectado nota que se le cerró la sesión, y el forzado de cambio deja
  constancia. Queda **sin registrar**, a propósito, cada desbloqueo individual:
  anotar 15 desbloqueos por persona y día ahogaría la bitácora sin aportar —
  lo que importa es la acción sensible, que ya se registra.

## Cómo revertir

El grueso es reversible sin pérdida:

- `tenants.exigir_reautenticacion` → devolver la columna `cambios_password_hash`
  y volver a fijar una contraseña de equipo. **Los hashes viejos no se
  recuperan** (la migración los descarta), así que revertir significa que el
  Dueño teclea una contraseña nueva, no que vuelve la anterior.
- `usuarios.debe_cambiar_password` es una columna booleana aditiva: dejarla en
  `false` desactiva el forzado sin quitar nada.
- El endpoint de restablecimiento se puede retirar y devolver `password` al
  `PATCH`; ambos son código, no datos.

Nada aquí borra información de usuarios ni de auditoría, así que a los 6 meses la
vuelta atrás cuesta una migración pequeña y un despliegue. Lo que **no** se
recupera es el secreto compartido anterior, y eso es intencionado.
