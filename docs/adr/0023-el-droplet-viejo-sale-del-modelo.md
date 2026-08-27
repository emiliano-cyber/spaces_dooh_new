# ADR 0023 — El droplet viejo sale del modelo, y sus datos no se rescatan

- **Fecha:** 2026-08-27
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Extiende:** [ADR 0017](0017-todo-se-concentra-en-el-padre.md) — que ya lo
  sacó del **modelo objetivo**; esto lo saca también del **trabajo**
- **Relacionadas:** [ADR 0021](0021-demo-space-os-io-se-queda.md) ·
  [ADR 0022](0022-instancia-dedicada-por-owner.md) ·
  `docs/Plan_Instancias_Soberanas_v3.md` ·
  `docs/evidencias/f4-1-censo-resultado.md` ·
  `docs/evidencias/padre-flota-y-rfc-20260827.md`

> [!important] Por qué este ADR existe
> Esta decisión ya se había tomado en conversación **cinco veces en cinco días**,
> en direcciones distintas (ADR 0015 → 0016 → 0017 → 0020 → 0021). Cada giro fue
> razonable; el costo no vino de cambiar de idea, sino de que las partes que
> **no** se decidían se rellenaban por deducción. Este documento existe para que
> la sexta no haga falta.

---

## Contexto

`209.97.146.136` es el droplet de julio. El censo de `F4.1`
(`docs/evidencias/f4-1-censo-resultado.md`, 25/08) lo midió entero:

| Dato | Valor |
|---|---|
| Hostname | `PIXELED-ubuntu-s-2vcpu-4gb-nyc3` |
| Commit desplegado | **`504b4fc`, del 2026-08-11** |
| Dominio servido | `demo.space-os.io` |
| Certificado | vence el **2026-10-26** |
| Base | `spaces_prod`, con cinco slugs: `rgb`, `telcel`, `g500`, `eyro`, `demo-owner` |

Tres hechos que hoy son ciertos y que el plan v3 no pudo conocer:

1. **Esos datos son de prueba.** Lo confirmó Jochelo el 27/08, en línea con la
   corrección del 19/08 sobre `spaces_prod`. **El plan v3 se escribió el 13/08**,
   seis días antes de esa corrección, y por eso encargaba tres censos (`F1.1`,
   `F7.1`) y una migración (`F1.5`) contra datos que se creían de clientes.
2. **El [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ya la sacó del modelo
   objetivo** el 25/08: el PADRE es la única máquina. Lo que quedó sin cerrar es
   si seguía habiendo trabajo pendiente *sobre* ella.
3. **Su acceso nunca se perdió.** El 24/08 se concluyó lo contrario y sobre esa
   premisa falsa se levantaron el ADR 0015, la 3ª enmienda a P1 y dos tareas
   declaradas «imposibles». El censo del 25/08 lo desmintió. **La máquina es
   perfectamente alcanzable: no se toca por decisión, no por impedimento.**

## Decisión

**El droplet `209.97.146.136` sale del modelo y del trabajo. Sus datos no se
rescatan.**

1. **No se ejecuta ninguna tarea sobre esa máquina.** Ni censos, ni migraciones,
   ni despliegues, ni `git pull`. Un comando contra ella exige justificarse
   antes, igual que pedía el ADR 0017 — y ahora, además, no hay ninguno previsto.
2. **No se exporta ni se respalda su base.** `rgb`, `telcel`, `g500`, `eyro` y
   `demo-owner` son datos de prueba. No hay organización real que migrar a una
   instancia (`F7.2`) ni destino que decidir para `rgb` (`F7.3`).
3. **La máquina permanece encendida**, sirviendo `demo.space-os.io` como manda el
   [ADR 0021](0021-demo-space-os-io-se-queda.md), hasta que se decida quién sirve
   ese nombre.

### Las seis tareas que quedan sin objeto

| Tarea | Qué pedía | Por qué deja de tener objeto |
|---|---|---|
| `F0.2` | Apagar el autoregistro y recompilar allí | Estaba **condicionada a un HTTP 400** que nunca llegó: `F0.1` midió **503** el 24/08 |
| `F1.1` | Censo de filas mal etiquetadas como `rgb` | No hay datos reales que censar |
| `F1.5` | Aplicar `20260812_sin_default_tenant.sql` allí | No se limpia una base de prueba que se abandona |
| `F7.1` | Censo autoritativo de `spaces_prod` | idem |
| `F7.2` | Exportar un owner a su instancia | No hay ningún owner real que exportar |
| `F7.3` | Destino del tenant `rgb` y del droplet | **Es esta decisión** |

**La Fase 7 desaparece entera.** El plan v3 pasa de **46 tareas a 40 con
objeto**.

> [!warning] `F0.1` **NO** entra en esa lista
> No queda sin objeto: **ya estaba CERRADA el 2026-08-24** con medición —
> `POST /api/signup/` → **503** y `GET /login/` → **200**, que descarta que el
> 503 fuera el servicio caído en vez de la bandera
> (`vault/07-Agentes/ejecucion-plan-v3.md:77`). Se dijo lo contrario en los
> documentos de la tarde del 27/08 y **quedó corregido**.

## Lo que esta decisión NO dice

> Se escribe aparte, siguiendo el patrón del ADR 0021, porque los huecos
> rellenados por deducción son lo que ha costado caro en este expediente.

**Qué máquina servirá `demo.space-os.io` sigue sin decidirse.** Aplazado a
propósito el 27/08. El ADR 0021 conserva el nombre; quién lo sirve queda abierto,
y con ello `F4.3` **sigue pendiente y es correcto que lo esté**.

**Tampoco se decide cuándo se destruye el droplet.** Retirarlo del trabajo no es
apagarlo. Mientras sirva ese nombre, sigue encendido.

## Alternativas consideradas

### A · Censar y volcar antes de retirarla

Correr `F7.1` y `F1.1` en solo lectura y bajarse un `pg_dump` completo. Quince
minutos, sin escribir nada en la máquina, y conservaba la opción de `F7.2`.

**Se descarta porque su premisa es falsa.** Preservar datos de prueba tiene valor
cero, y el censo solo servía para decidir el destino de organizaciones que no
existen como clientes. Era la recomendación por defecto **mientras se creyó que
había datos reales**; dejó de serlo cuando eso se aclaró.

### B · Convertirla en la primera instancia hija

Ya sirve `demo.space-os.io` con certificado válido y su propia base: sobre el
papel es una instancia hija hecha. Habría ahorrado un droplet y cerrado `F4.3`
de una vez.

**Se descarta por dos razones independientes**, y basta cualquiera de las dos:

1. **El [ADR 0017](0017-todo-se-concentra-en-el-padre.md)** ya decidió que el
   droplet viejo no forma parte del modelo. Reabrirlo sería el **sexto** giro
   sobre la misma pieza.
2. **No hay forma de actualizarla.** Corre código del 11/08. Ponerla al día
   exige `update.sh` y el canal de release, que **no existen hasta que haya
   registry (TH-P4)**. Y un `git pull` a mano metería 16 días de código sin
   probar en la única máquina que sirve un nombre público — exactamente lo que
   el modelo de instancias existe para evitar.

### C · Apagarla o destruirla hoy

La opción más limpia en superficie de ataque: una máquina pública menos.

**Se descarta porque contradice el [ADR 0021](0021-demo-space-os-io-se-queda.md)**,
que conserva `demo.space-os.io`, y hoy la sirve ella. Apagarla ahora tira el
nombre sin haber decidido quién lo recoge. **Es la opción correcta el día que se
resuelva `F4.3`, no antes.**

## Consecuencias

### Positivas

- **Seis tareas menos, y una fase entera.** El plan queda en 40 con objeto, y de
  las 12 que faltan **10 dependen de un solo dato** (el registry). El estado del
  proyecto deja de arrastrar trabajo contra un problema que no existe.
- **Se acaba la ambigüedad más cara del expediente.** «No se toca salvo
  justificación» (ADR 0017) convivía con seis tareas del plan que mandaban
  tocarla. Ya no.
- **Ningún dato real en riesgo**, porque no hay ninguno.

### Negativas

- **Queda una instalación pública que nadie va a parchear, y eso ahora es
  política.** Es el costo real de esta decisión y se escribe sin suavizar: ver
  las implicaciones de seguridad.
- **El censo se pierde si algún día se echa de menos.** Si mañana apareciera un
  motivo para saber qué había en `spaces_prod`, la respuesta es apagarla sin
  saberlo. Se acepta a sabiendas: son datos de prueba.
- **`F4.3` sigue abierta con fecha de caducidad ajena.** El certificado vence el
  **2026-10-26**; ese día `demo.space-os.io` deja de servir por HTTPS, se haya
  decidido o no.

### Implicaciones de seguridad

**Lo que se quita:** nada, todavía. La superficie solo baja el día que la máquina
se apague, y esta decisión **no la apaga**.

**Lo que se queda, y es lo que hay que mirar:**

- **Una instancia pública congelada en `504b4fc` (11/08).** No tiene ninguna de
  las correcciones desplegadas el 27/08: ni los **diez hallazgos de la auditoría
  externa**, ni las **siete guardas de entrada** del censo de endpoints, ni la
  CSP en modo reporte, ni la validación de RFC, ni el borrado con contraseña.
  Antes esto era «una máquina que no hemos actualizado»; **desde este ADR es una
  máquina que no se va a actualizar**, y conviene llamarlo por su nombre.
- **Sus secretos siguen vivos en una máquina que nadie vigila.**
  `/var/www/Spaces/apps/web/.env` contiene al menos `DATABASE_URL` y las
  credenciales de Google OAuth. **Acción concreta, y no se puede resolver desde
  el repositorio:** comprobar si `GOOGLE_CLIENT_SECRET` es el mismo valor que
  usa el PADRE. Si lo es, **rotarlo**, porque un secreto compartido con una
  máquina sin mantenimiento es un secreto del que ya no se responde. No se
  verificó al escribir este ADR: exige leer esa máquina, y esta decisión dice
  que no se toca.

  > **APLAZADO POR DECISIÓN (27/08, Emiliano): la rotación espera a que exista
  > la credencial oficial de Google.** No es un olvido ni una tarjeta pendiente:
  > rotar ahora obligaría a rehacerlo al emitir la oficial, y el acceso con
  > Google del PADRE se caería **dos veces en vez de una**.
  >
  > **Lo que se acepta mientras tanto**, dicho una vez y sin volver a
  > plantearlo: si ese secreto es compartido, una máquina sin mantenimiento
  > conserva credenciales de la aplicación viva. El alcance real está acotado
  > por `GOOGLE_REDIRECT_URI`, que se declara **por instancia** en la consola de
  > Google: quien tenga el secreto no puede redirigir a un destino que no esté
  > dado de alta ahí.
  >
  > **Se cierra al emitir la credencial oficial**, y entonces la rotación no es
  > trabajo extra: es el mismo trabajo que la emisión — un valor nuevo en el
  > `.env.production` del PADRE y un reinicio. **La máquina vieja no recibe el
  > nuevo, que es justamente el punto.**
- **Su tenant `demo-owner` puede tener el autoregistro cerrado pero el registro
  abierto por otra vía.** `F0.1` midió `signup 503` el 24/08 y ese sigue siendo
  el último dato conocido; no se volverá a medir.
- **`DOOHMAIN_PUBLISH_ENABLED=1` según el tablero del 10/08.** Si esa bandera
  sigue puesta, esa instalación **puede publicar a pantallas reales**. Nunca se
  comprobó, y con este ADR ya no se comprobará: queda escrito aquí para que la
  próxima persona que se plantee apagarla sepa que ese es un motivo para hacerlo
  **antes** y no después.

**Autenticación y autorización:** sin cambios. Ninguna credencial del PADRE
depende de esa máquina, y ninguna instancia futura nace de ella.

**Superficie de auditoría:** los accesos a esa máquina dejan de mirarse. No hay
alerta, no hay revisión de logs y no la habrá.

## Cómo revertir

**Trivial mientras siga encendida.** Volver a incluirla en el modelo es una
decisión, no una migración: la máquina está entera, es alcanzable y sus datos
siguen ahí. Se escribiría un ADR que reemplace a este.

**Irreversible el día que se destruya el droplet.** Ahí se pierden a la vez la
base, el censo que nunca se hizo y el certificado. El costo real de esa pérdida
es bajo —datos de prueba— pero **es el punto de no retorno**, y por eso destruir
la máquina **no se decide en este ADR**.

## Cuándo revisar

**El 2026-10-26 como muy tarde**, cuando venza su certificado: ese día
`demo.space-os.io` deja de servir por HTTPS y `F4.3` se resuelve sola en la peor
dirección si nadie la ha resuelto antes.

Y antes de eso, en cuanto se decida quién sirve `demo.space-os.io`: ahí se puede
apagar esta máquina, y esa sí es la decisión que baja la superficie de ataque.
