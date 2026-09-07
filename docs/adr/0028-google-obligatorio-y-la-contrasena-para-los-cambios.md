# ADR 0028: Google obligatorio para el PADRE y para el Dueño de cada instancia; la contraseña se reserva para los cambios

- **Fecha:** 2026-09-07
- **Estado:** Aceptada (2026-09-07, por Emiliano) — **con un punto abierto que bloquea a PIXELED**, ver §Consecuencias
- **Revisa y sustituye:** la decisión del **2026-08-20** («las cuentas de máximo privilegio entran solo con Google, más códigos de recuperación entregados en el alta, y el alta debe FALLAR si la instancia nace sin Google»)
- **Relacionada:** [ADR 0009](0009-reautenticacion-individual-en-vez-de-contrasena-compartida.md) · [ADR 0012](0012-acceso-con-cuenta-de-google.md) · [ADR 0018](0018-establecer-password-tras-entrar-con-google.md) · [ADR 0022](0022-instancia-dedicada-por-owner.md) · [ADR 0025](0025-acceso-de-soporte-a-una-instancia.md)

## Contexto

La decisión del 2026-08-20 quedó registrada como vigente y **el producto hace otra cosa**.
La auditoría del 01/09 lo marcó como 🟡 IMPORTANTE 3
(`docs/evidencias/auditoria-vender-el-servicio-20260901.md`), y el 2026-09-07 se volvió a
medir contra el árbol. Los hechos, no las intenciones:

- **Los códigos de recuperación no existen.** Cero coincidencias en todo el repositorio.
- **`/api/bootstrap` no menciona Google.** Sus tres cerrojos son token presente, token
  correcto y `tenants` vacía (`app/api/bootstrap/route.ts:26-27`). Crea la organización y
  su Dueño con una contraseña temporal.
- **Google está APAGADO por omisión en cada instancia**, y es por dominio:
  `infra/env/app.env.example:100` reparte `GOOGLE_OAUTH=0`, y `:112` exige un
  `GOOGLE_REDIRECT_URI` con el dominio dentro.
- **Y es fail-closed, que es lo único que ya está a favor:** `google-oauth.ts:45-46` apaga
  la función **en el servidor** con `GOOGLE_OAUTH=0`, y sin `CLIENT_ID`/`CLIENT_SECRET`
  también. No es un botón escondido.
- **No existe ningún candado «solo Google» por usuario.** Cero coincidencias. Hoy nada
  impide que una cuenta con Google vinculado entre igualmente con su contraseña.
- **La reautenticación para cambios existe, es individual y está APAGADA por omisión.**
  `cambios.ts` la comprueba contra `usuarios.password_hash`, y
  `db/migrations/20260804_reautenticacion_individual.sql:34` crea
  `tenants.exigir_reautenticacion` con `default false`.
- **El puente entre las dos mitades ya está construido**, y es de este repositorio:
  ADR 0018 permite **fijar la primera contraseña sin teclear la anterior** cuando la sesión
  se abrió con Google, bajo cuatro condiciones a la vez (`perfil-controller.ts:56-57`).
- **El correo saliente del PADRE no existe.** No hay recuperación por correo que sirva de
  red de seguridad.

Y lo que cambió el 04/09: el **defecto 22** dejó al Dueño naciendo con
`debe_cambiar_password` explícito (`usuarios-repo.ts:62-66`). O sea que el comportamiento
real de hoy es *contraseña temporal generada por el operador + cambio forzado* — que es
exactamente la alternativa que esta decisión descarta.

**Decidido por Emiliano el 2026-09-07**, tras plantearle las tres salidas y elegir una
cuarta, más precisa que la del 20/08.

## Decisión

Se adopta un modelo de **identidad federada para el privilegio y contraseña para la
mutación**. Google decide *quién entra*; la contraseña decide *quién cambia*. Son dos
preguntas distintas y se responden con dos factores distintos.

En concreto, cuatro puntos:

**1 · Toda cuenta del PADRE entra solo con Google.** El plano de control —ver la flota,
dar de alta instancias, el panel del 3000 y el de `/flota/`— no admite contraseña como
puerta de entrada. Es la máquina desde la que se alcanza toda la flota (ADR 0025 punto 3),
así que es la que menos puede depender de un secreto que alguien teclea.

**2 · El Dueño de empresa de cada dominio nuevo entra solo con Google.** Es la cuenta de
máximo privilegio de su instancia. Con esto **el alta deja de imprimir una contraseña en
la consola del operador**, que es el riesgo que ROJO-1 y el defecto 22 atacaron dos veces
sin retirarlo del todo: mientras el alta genere una contraseña conocida, existe una ventana
en la que alguien que no es el Dueño puede entrar como el Dueño.

**3 · Los usuarios normales de un dominio entran con código de contraseña o con Google, a
su elección.** No se les impone Google. Un instalador de pantallas o quien captura una
orden de trabajo no tiene por qué tener cuenta corporativa de Google, y convertir una
medida de seguridad en una barrera de alta es cambiar un riesgo por otro.

> [!success] Confirmado por Emiliano el 2026-09-07
> **Google está disponible para el perfil de CUALQUIER usuario.** Lo que este ADR añade no
> es la disponibilidad, es la **obligatoriedad** — y solo para las cuentas del PADRE y para
> el Dueño. Un usuario normal elige: código de contraseña o Google, y puede vincular Google
> a su perfil cuando quiera.
>
> **Y esa parte ya está construida**, no hay que hacerla: `identidades-repo.ts:62`
> (`vincularIdentidad`) **no tiene ninguna restricción por rol**, y las rutas
> `/api/auth/google/inicio` y `/callback` existen desde el [ADR 0012](0012-acceso-con-cuenta-de-google.md).
> Lo único que la apaga por instancia es `GOOGLE_OAUTH`.

**4 · Para los cambios, siempre contraseña.** Haber entrado con Google no autoriza a
mutar. Toda operación sensible exige la contraseña del propio usuario, y
`tenants.exigir_reautenticacion` **pasa a nacer en `true`** en una instancia nueva, en vez
del `false` de hoy.

De 2 y 4 juntos sale la consecuencia que hay que decir en voz alta: **el Dueño entra con
Google y luego fija una contraseña que solo usa para cambiar cosas.** Eso no obliga a
construir nada nuevo — es literalmente el caso de uso para el que se escribió el ADR 0018.

## Alternativas consideradas

**A · Revocar la del 20/08 y vender con contraseña temporal + cambio forzado.**
Era la recomendación de la auditoría y la mía: coste cero, ya está construida, y desbloquea
a PIXELED hoy. **Descartada por Emiliano por seguridad**: deja la cuenta de máximo
privilegio de cada cliente detrás de un secreto que el operador genera, ve e imprime.
Reafirmada la objeción, se descarta.

**B · La del 20/08, literal.** Google solo para máximo privilegio, códigos de recuperación
en el alta, y el alta falla sin Google. **Se conserva su núcleo y se descarta su forma**:
no distinguía el PADRE de una instancia, no decía nada de cómo se hacen los cambios cuando
no hay contraseña, y ataba el primer cliente a construir códigos de recuperación antes de
poder dar de alta a nadie. Este ADR precisa esas tres cosas; los códigos quedan como punto
abierto, no como requisito de forma.

**C · Google obligatorio para todos los usuarios de una instancia.** Más simple de explicar
y de auditar: una sola puerta. **Descartada** por el punto 3 — el perfil real de los
usuarios de operaciones e imprenta no lo soporta, y una instancia que no puede dar de alta
a su gente no se usa.

**D · Un IdP propio o SAML genérico.** Quita la dependencia de Google y serviría a un
cliente que traiga su propio directorio. **Descartada por ahora**: es un despliegue y una
dependencia más **por instancia**, en un modelo cuya promesa es que el artefacto es
idéntico para toda la flota (invariante 3), y hoy nadie lo pide. Se reabre el día que un
owner traiga su directorio.

## Consecuencias

**Positivas**

- **Se retira el riesgo que dos correcciones no lograron cerrar.** Si el alta no genera
  contraseña, no hay contraseña conocida, no hay ventana de suplantación, y el defecto 22 y
  ROJO-1 dejan de tener superficie en lugar de quedar mitigados.
- **Dos factores de hecho para las mutaciones**, sin construir un segundo factor: identidad
  federada para entrar, secreto propio para cambiar.
- **Queda rastro de por dónde entró cada sesión.** `sesiones.metodo` existe desde la
  migración 73 y se exige sin default a propósito, así que la auditoría de «entró con
  Google o con contraseña» ya es respondible.
- El punto 4 es un cambio de valor por omisión sobre un mecanismo probado, no código nuevo.

**Negativas**

- **El alta gana un paso manual en la consola de Google, y es por dominio.**
  `GOOGLE_REDIRECT_URI` lleva el dominio dentro (`app.env.example:112`), así que cada
  instancia nueva exige registrar su URI de retorno en un cliente OAuth. **El ejecutor de
  altas no puede hacerlo solo**: es del mismo tipo que el paso de Cloudflare, y el alta ya
  se detiene en `esperando-dns` por una razón parecida.
- **Hay que invertir el valor por omisión de la plantilla** (`GOOGLE_OAUTH=0` → `1`) y hacer
  que `/api/bootstrap` **falle** sin Google configurado. Es un fail-closed nuevo sobre la
  ruta de alta, en zona ROJA (Z1 · Auth).
- **Hay que construir el candado «solo Google» por usuario**, que hoy no existe. Sin él,
  los puntos 1 y 2 son una intención: la contraseña seguiría sirviendo de puerta.
- **Y el coste grande: el riesgo de quedarse fuera.** Si el Dueño pierde el acceso a su
  cuenta de Google y todavía no fijó contraseña, **no hay puerta**. La decisión del 20/08
  cubría justamente esto con códigos de recuperación, y esta no los menciona. El correo
  saliente del PADRE tampoco existe, así que no hay red de seguridad por correo.

> [!success] CERRADO el 2026-09-07, tarde · **códigos que se ve el propio Dueño**
> **Qué pasa cuando el Dueño pierde su cuenta de Google.** Decidido por Emiliano:
>
> **Al entrar por primera vez con Google, la aplicación le enseña UNA vez sus códigos de
> recuperación y le obliga a confirmar que los guardó.** Con uno de ellos entra sin Google.
>
> **Y resuelve dos problemas con la misma pieza, que es lo que la hace la buena.** El
> evidente es el bloqueo. El otro es la **entrega**: si los códigos los genera y los ve el
> propio Dueño en su navegador, **nadie de AS OOH ve nunca un secreto suyo**. Con eso el
> alta deja de tener que entregar nada — y el último tramo del [ADR 0029](0029-el-alta-desatendida-y-la-maquina-de-estados.md)
> (§5, el bootstrap sin persona) **deja de estar bloqueado**, porque desaparece la razón
> por la que lo estaba.
>
> Las otras dos salidas se descartan y conviene decir por qué:
>
> - **Revincular desde el PADRE con rastro** le daría a AS OOH el poder de entrar como el
>   Dueño de cualquier cliente. Es defendible en un servicio administrado, pero **el rastro
>   que lo haría aceptable no existe**: es el punto 4 del ADR 0025, sin construir.
> - **El trámite manual de soporte** depende del camino de soporte del ADR 0025, que
>   tampoco existe — y hoy **ninguna persona puede siquiera entrar a una instancia creada
>   por el panel**, porque solo la alcanza `altas`.
>
> Lo construye el `docs/Plan_Acceso_Duenos.md`.

> [!warning] Y una consecuencia que hay que construir con cuidado
> Los códigos se enseñan **una vez y en el navegador del Dueño**. Si se pierde esa pantalla
> —cierra la pestaña, se le va la luz— **no hay segunda oportunidad sin volver a
> generarlos**. Así que la pantalla tiene que exigir una confirmación explícita antes de
> continuar, y tiene que existir un «generar otros» desde el perfil, con la sesión abierta.
>
> Es el mismo error que se paga en todos los sitios que hacen esto mal: enseñar el secreto
> y dejar que el usuario navegue.

**Implicaciones de seguridad**

- **Superficie que se quita:** la contraseña como puerta de entrada al máximo privilegio, en
  el PADRE y en cada instancia. Con ella se va el vector de ROJO-1 (contraseña impresa en la
  consola del operador) y el del defecto 22.
- **Superficie que se agrega:** una dependencia de terceros en el camino de entrada. Una
  caída o un cambio de política de Google es una caída de acceso al plano de control de toda
  la flota. Y aparece un secreto obligatorio nuevo en cada instancia,
  `GOOGLE_CLIENT_SECRET`, donde hoy es opcional y va vacío.
- **Dónde viven los secretos y quién los rota:** en el `.env` de cada instancia, `600` y
  con dueño el usuario de la aplicación, como el resto. **Y aquí hay una decisión de diseño
  que no se puede tomar por descuido:** si toda la flota comparte un solo cliente OAuth,
  entonces **el mismo `GOOGLE_CLIENT_SECRET` se reparte a todos los droplets**, y cualquiera
  con acceso a su propia máquina —el owner, su proveedor, quien le administre el servidor—
  lo tiene. **Es exactamente la objeción con la que F5.8 rechazó el JWT firmado**: repartir
  una llave a la flota es la única puerta que las vuelve a conectar. Lo coherente con ese
  razonamiento es **un cliente OAuth por instancia**; compartirlo exige escribirlo y
  aceptarlo, no dejarlo pasar.
- **Modelo de autenticación/autorización:** entrada federada, mutación con secreto local.
  La autorización por permisos no cambia — `exigir()` y los permisos de módulo siguen igual.
- **Datos sensibles:** no se añade ningún dato personal nuevo más allá de la identidad
  externa, que ya se guarda (`20260806_identidades_externas.sql`). No se guarda ningún token
  de Google de larga duración.
- **Dependencias nuevas:** ninguna librería. `google-oauth.ts` ya está escrito y probado, y
  esta decisión no añade un paquete npm.
- **Superficie de auditoría:** queda registrado el método de cada sesión (`sesiones.metodo`)
  y la identidad vinculada. **No queda registrado** quién registró la URI de retorno de una
  instancia en la consola de Google ni cuándo — es un paso en una consola de terceros, igual
  que Cloudflare, y no lo ve ningún log nuestro.

## Cómo revertir

Volver atrás es barato mientras el candado «solo Google» sea una comprobación y no una
migración destructiva, y por eso se construye así:

1. `GOOGLE_OAUTH=0` en el `.env` de la instancia la devuelve al comportamiento de hoy, y
   `google-oauth.ts:45` ya lo respeta en el servidor.
2. Apagar el candado por usuario devuelve la contraseña como puerta.
3. `update tenants set exigir_reautenticacion = false` deshace el punto 4.

**Lo que no se revierte con un interruptor:** las cuentas de Dueño que nazcan sin
contraseña. Si se revoca esta decisión, esas cuentas necesitan un camino para fijar una
—que es el del ADR 0018— o quedan dependiendo de Google igualmente. Eso es deuda, no
configuración, y va aquí dicho a propósito.
