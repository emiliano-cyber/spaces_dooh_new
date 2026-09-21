# ADR 0036: Contraseña compartida de vuelta para el control de cambios

- **Fecha:** 2026-09-21
- **Estado:** Aceptada

Enmienda parcial al **ADR 0009**. Decisión explícita del dueño del producto, pedida
directamente en sesión: el candado de cambios sensibles (dinero y catálogo) vuelve a
aceptar una contraseña que el Dueño **asigna**, independiente de la contraseña de
acceso de cada persona.

## Contexto

El ADR 0009 (04/08/2026) retiró `tenants.cambios_password_hash` — una contraseña
única por tenant que todo el equipo tecleaba — y la sustituyó por reautenticación
individual: cada quien desbloquea con **su propia** contraseña de login. El motivo
fue de identidad: un secreto colectivo no prueba quién actuó, así que la bitácora
afirmaba «Ana facturó» cuando lo único verificado era «alguien que conoce el secreto
del equipo facturó».

El dueño del producto pidió revertir esa pieza puntual: quiere una contraseña
asignable de nuevo, distinta de la de acceso de cada quien, para el candado de
cambios. El propio ADR 0009 dejaba escrito cómo hacerlo en su sección «Cómo
revertir» — devolver la columna y fijar una contraseña **nueva**, porque los hashes
viejos se descartaron a propósito y no se recuperan.

### La pregunta que esto obliga a contestar, y que el ADR 0009 no tenía que hacerse

Este mecanismo no tiene un solo consumidor. Además del candado general de
dinero/catálogo (`exigirDesbloqueo`, sin exención por rol), existe
`exigirReautenticacionSiempre()`, que protege
`POST /api/usuarios/:id/restablecer` — resetear la contraseña de **otra** persona.
Si la contraseña compartida abriera esa puerta también, cualquiera que la supiera
podría resetear a un tercero sin probar que es quien dice ser: exactamente el hueco
de impersonación que el ADR 0009 cerró en su punto 3. La pregunta no es «¿volver a
la contraseña compartida sí o no?», es «¿compartida para qué, exactamente?».

## Decisión

**Dos contraseñas posibles, con alcance distinto.** `desbloquear(password)` prueba,
en orden:

1. La **propia** — `usuarios.password_hash` de quien pide el desbloqueo. Si
   coincide, el desbloqueo sirve para **todo**, incluido `exigirReautenticacionSiempre`.
2. La **compartida** — `tenants.cambios_password_hash`, que asigna el Dueño. Si
   coincide, el desbloqueo sirve **solo** para el candado general de cambios
   sensibles, **nunca** para tocar el acceso de otra persona.

La sesión guarda con cuál de las dos se concedió (`sesiones.desbloqueo_es_propio`),
y `exigirReautenticacionSiempre()` exige que sea `true`.

### Piezas

1. **`tenants.cambios_password_hash`** (`text`, nullable) vuelve, vía migración
   nueva (`20260921_restaura_contrasena_compartida_cambios.sql`) — la del ADR 0009
   está ya aplicada y no se edita. Null = todavía sin asignar; en ese caso el
   candado, si está activo, solo acepta la contraseña propia de cada quien, como
   quedó con el ADR 0009.
2. **`sesiones.desbloqueo_es_propio`** (`boolean`, default `false`), misma
   migración. Vive en el servidor, contra el token de sesión, igual que
   `desbloqueo_expira_en`.
3. **`fijarContrasenaCambios(tenantId, password)`** — nueva función, exclusiva del
   Dueño (`administracion:aprobar`). Valida con la misma regla que cualquier otra
   contraseña del sistema (`validarPassword`, mínimo 8 con letra y número) y guarda
   el hash. Independiente de `fijarExigirReautenticacion` (el interruptor de
   encendido/apagado): se puede asignar sin encender el candado, o encenderlo sin
   asignar ninguna.
4. **El interruptor no cambia** (`tenants.exigir_reautenticacion`, apagado por
   defecto, sin exención por rol — eso sigue del ADR 0009).
5. **`PUT /api/cambios/`** acepta ahora `{ activo?, password? }`, los dos campos
   independientes.
6. **UI:** `ControlCambiosPanel` (Administración) gana el formulario para asignar o
   rotar la contraseña compartida, sin mostrarla nunca de vuelta — el `GET` solo
   informa `tieneContrasenaCompartida: boolean`. `DesbloqueoCambios` (el modal que
   ve cualquier rol) deja de decir «contraseña del Dueño» — texto que ya estaba
   desactualizado respecto al ADR 0009 y fue la causa original de esta
   conversación — y pasa a decir que sirve la propia o la del control de cambios.

## Alternativas consideradas

### A. Una sola contraseña compartida para todo, como antes del ADR 0009

**Qué es:** volver exactamente al modelo pre-0009, sin distinguir el candado
general de la reautenticación de acceso de terceros.
**Por qué se descarta:** reabre el hueco de impersonación del punto 3 del ADR
0009 — cualquiera con la contraseña de equipo podría resetear la contraseña de
otra persona y aparentar ser el Dueño haciéndolo. El dueño del producto pidió la
contraseña asignable para el candado de cambios; no pidió (ni se le preguntó
querer) debilitar el reseteo de terceros, así que ensanchar el alcance sin
preguntarlo habría sido una decisión de seguridad tomada por el agente, no por él.

### B. La compartida como ÚNICA contraseña (retirar la propia)

**Qué es:** que el candado solo acepte la contraseña asignada, no la de login de
cada quien.
**Por qué se descarta:** un usuario dado de alta sin contraseña propia (alta
solo con Google, ver ADR 0018) quedaría dependiendo enteramente de que el Dueño
haya asignado una compartida. Mantener la propia como primera opción es
estrictamente más flexible y no cuesta nada adicional.

## Consecuencias

**Positivas**

- El dueño del producto obtiene lo que pidió: una contraseña de equipo,
  independiente del login de cada persona, para el candado de cambios.
- El reseteo de contraseña de terceros conserva la garantía de identidad del ADR
  0009 intacta — no se tocó su mecanismo, solo se le exigió explícitamente que el
  desbloqueo sea de los que prueban identidad.
- Un usuario sin contraseña propia (alta solo con Google) puede ahora desbloquear
  el candado general si el Dueño asignó una compartida — antes quedaba sin
  ninguna vía.

**Negativas**

- Vuelve, en parte, el defecto que el ADR 0009 documentaba: quien conoce la
  contraseña compartida puede desbloquear cambios de dinero/catálogo a nombre de
  la sesión de otra persona si la deja abierta y desatendida. La bitácora seguirá
  registrando el `usuario_id` de esa sesión (se necesita sesión propia para
  llegar al endpoint), pero ya no prueba que fue esa persona quien tecleó.
- Migración de esquema (dos columnas aditivas).
- Una contraseña más que el Dueño tiene que recordar y, eventualmente, rotar.

**Implicaciones de seguridad**

- **Superficie que se agrega:** un secreto compartido por tenant, otra vez. Su
  alcance queda deliberadamente acotado al candado general — nunca al reseteo de
  contraseñas de terceros.
- **Dónde vive:** `tenants.cambios_password_hash`, bcrypt, nunca viaja al
  cliente. El `GET` solo informa si existe, no el hash.
- **Autenticación/autorización:** el modelo de permisos por rol no cambia. Lo que
  cambia es, otra vez, la prueba de presencia para el candado general — de «es
  esta persona» a «es esta persona, o alguien que conoce el secreto del equipo» —
  pero **solo** para ese candado, no para tocar el acceso de terceros.
- **Auditoría:** cada desbloqueo sigue exigiendo sesión propia ya autenticada para
  llegar al endpoint, así que la bitácora conserva el `usuario_id` de quien lo
  pidió en todos los casos. Lo que se pierde es la prueba de que fue esa persona
  *tecleando*, no de quién estaba en la sesión.

## Cómo revertir

Simétrico al «Cómo revertir» del ADR 0009: dejar `desbloquear()` sin la rama de la
compartida (solo la propia), y `exigirReautenticacionSiempre` vuelve a no necesitar
distinguir `desbloqueo_es_propio` porque todo desbloqueo sería ya de ese tipo. Las
dos columnas nuevas son aditivas: dejarlas sin usar no rompe nada. Ninguna
información de usuarios ni de auditoría se pierde al revertir.
