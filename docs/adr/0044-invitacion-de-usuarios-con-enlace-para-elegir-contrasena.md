# ADR 0044: Invitación de usuarios con un enlace de 72 h para elegir contraseña

- **Fecha:** 2026-10-06
- **Estado:** Aceptada (2026-10-06). Las tres decisiones de forma las tomó el dueño en la
  sesión de ese día: enlace para elegir contraseña (no la contraseña en el correo), 72 h de
  vigencia, y conservar «fijar la contraseña yo» como opción.
- **Relacionado:** [ADR 0009](0009-reautenticacion-individual-en-vez-de-contrasena-compartida.md)
  (fijar a mano la contraseña de otro es impersonación),
  [ADR 0012](0012-acceso-con-cuenta-de-google.md) (el secreto que nadie ve).

## Contexto

Hasta el 06/10, dar de alta a un usuario era: el administrador escribe la contraseña y se la
pasa a la persona por otro medio. La bitácora de acciones lo registraba como «Invitó usuario»,
pero **no salía ninguna invitación**: en todo el código `enviarEmail` se llamaba en dos sitios,
la recuperación de contraseña y los recordatorios.

Y la recuperación tampoco llega a nadie en las instancias de hoy: nacen sin `RESEND_API_KEY` y
con `NEXT_PUBLIC_RECUPERAR_PASSWORD=0` (`infra/env/app.env.example`). Resend todavía no tiene
cuenta ni dominio verificado.

## Decisión

1. **El alta admite `invitar: true`.** La cuenta nace con `passwordAleatoria()` —el mismo
   secreto que nadie ve que usa Google desde el ADR 0012, y no sin hash, por la misma razón—, y
   se emite un token en `password_resets` con **72 h** de vigencia. La persona elige su
   contraseña en la página de siempre, `/recuperar/<token>?bienvenida=1`.
2. **Si hay correo, el enlace se manda y NO vuelve al administrador.** Si no lo hay —el caso de
   hoy—, o el envío falla, vuelve en la respuesta y la pantalla lo enseña **una vez** para que el
   administrador lo pase. Un fallo de envío no deshace el alta: la cuenta existe y el enlace sirve.
3. **Una sola forma de acceso por alta.** `invitar` con `password` o con `entraConGoogle` es un
   400. «Fijar la contraseña yo» se conserva a petición del dueño; la invitación es la opción por
   omisión del formulario.
4. **Sin migración.** Recuperar e invitar escriben la misma tabla; lo único que los distingue es
   `expira_en` (60 min contra 72 h). El `?bienvenida=1` solo cambia los textos de la página.
5. **`NEXT_PUBLIC_RECUPERAR_PASSWORD=0` apaga PEDIR un enlace, no USARLO.** Deja de comprobarse en
   `/api/auth/reset` y se queda en `/api/auth/forgot`.

## Por qué la 5, que es la que cambia una puerta

Con la bandera en `/api/auth/reset`, la invitación moría con 503 **en todas las instancias**,
porque todas nacen con la bandera en 0. Las alternativas eran dos:

| | Mover la bandera a `forgot` (elegida) | Columna `motivo` en `password_resets` |
|---|---|---|
| Migración | No | Sí (R3, aprobación de BD) |
| Qué queda abierto con la bandera en 0 | Usar un token que alguien con sesión emitió | Lo mismo, solo para invitaciones |
| Qué queda cerrado | Pedir un enlace sin sesión, que es el único emisor público | Igual, y además usar un enlace de recuperación |

La diferencia práctica es pequeña: con `forgot` apagado no existe ningún token de recuperación
que usar, porque el único otro emisor de `password_resets` es el alta, que exige
`administracion.crear`. La bandera nació para que nadie de fuera generara enlaces sin correo
saliente, y eso sigue cerrado.

## Implicaciones de seguridad

- **El administrador ve el enlace mientras no haya correo.** No es una escalada: con
  `administracion.crear` ya puede fijar la contraseña él mismo (decisión 3). Con correo, deja de
  verlo.
- **72 h es tres días con un enlace válido en un buzón.** Es un solo uso, se invalida al consumir
  (junto con cualquier otro token del usuario) y cierra las sesiones, igual que la recuperación.
- **El tenant de la invitación sale de la sesión**, nunca del cuerpo: `crearInvitacion` lo lee con
  `tenantActual()` y falla cerrado sin él. La e2e comprueba que una invitación hecha desde otra
  organización queda en esa organización.
- **El nombre se escapa** en el correo de invitación, y desde este cambio también en el de
  recuperación, que lo interpolaba crudo.
- **`APP_URL` sigue siendo la raíz del enlace**, con el origen de la petición como respaldo en
  local, igual que `forgot`. En una instancia la escribe el aprovisionamiento.

## Lo que NO resuelve

- **No hay correo saliente.** Para que la invitación y la recuperación lleguen solas hace falta
  una cuenta de Resend con el dominio verificado, y `RESEND_API_KEY` + `EMAIL_FROM` en el
  `app.env` de cada instancia. Lo pone una persona.
- **No hay «reenviar invitación».** Si el enlace vence, el administrador usa «Restablecer
  contraseña» (temporal) o la persona usa «¿Olvidaste tu contraseña?» cuando haya correo.
