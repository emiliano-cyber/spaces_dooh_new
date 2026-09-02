# ADR 0025 — El acceso de soporte a la instancia de un owner

- **Fecha:** 2026-09-02
- **Estado:** **Aceptada** — las dos decisiones abiertas se cerraron el 2026-09-02
- **Decide:** Emiliano
- **Relacionadas:** [ADR 0022](0022-instancia-dedicada-por-owner.md) — el modelo
  que crea el problema · [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  `docs/evidencias/auditoria-vender-el-servicio-20260901.md` (🔴 BLOQUEANTE 2) ·
  `docs/evidencias/f3-5-demo-instancia-20260902.md` §avisos ·
  P3 del tablero (2026-08-20)

> [!important] Por qué este ADR existe
> El modelo se vende como **«cada organización tiene su servidor, y AS OOH solo
> aparece si algo se rompe»**. La primera mitad está construida. La segunda **no
> está construida ni escrita**, y la auditoría del 01/09 la marcó como bloqueante
> del **contrato**, no del alta: se puede dar de alta a PIXELED mañana y que
> funcione; lo que no se puede es responder *«¿quién puede entrar a mis datos, y
> cuándo lo hizo?»*.
>
> Se escribe **antes** de la primera instancia a propósito. Después, cada decisión
> de estas se toma con un cliente esperando y una avería delante.

---

## Contexto

### Lo que el modelo garantiza hoy, y está construido

El plano de flota es **de solo lectura por diseño, y en un solo sentido**: la
instancia **reporta hacia fuera** al terminar cada actualización
(`update.sh:589-639`, `FLOTA_REPORTE_URL`) y el padre **nunca abre una conexión
hacia ella**. `apps/flota/estado.mjs:64` lo dice de sí mismo: el padre no puede
deducir nada *«de una conexión que no abrió él»*.

Ese invariante es deliberado y **este ADR no lo toca**. Lo que sigue es sobre el
camino excepcional: cuando algo se rompe y una persona tiene que entrar.

### Lo que hay hoy para ese camino excepcional — medido, no supuesto

| Hecho | Dónde se comprueba |
|---|---|
| El aprovisionamiento entra como **`ssh root@HOST`** | `provision-instancia.sh:164,178,185` |
| El firewall abre **22 al mundo** | `setup-droplet.sh:84-87` (`ufw allow 22/tcp`) |
| **No** se crea ningún usuario, ni se endurece `sshd` | `setup-droplet.sh` — no hay `PermitRootLogin`, ni `PasswordAuthentication`, ni `adduser` |
| **No** hay inventario de llaves, ni rotación, ni caducidad | no existe el archivo |
| **No** queda rastro de cuándo entró nadie | `grep` sobre `docs/*.md`: cero runbooks de incidente, guardia o soporte |
| Las instancias nacen en **la cuenta de DigitalOcean de la casa** | P3, 2026-08-20 |
| El respaldo **no sale del droplet** | `f3-5-demo-instancia-20260902.md`: *«si la máquina desaparece, el dump desaparece con ella»* |
| El log **no sale del droplet** | mismo sitio: *«diagnosticarla exige entrar al servidor del owner»* |

### El hecho incómodo que ordena todo lo demás

**Una política de llaves SSH no acota el acceso, porque no es el único camino.**
Las instancias viven en la cuenta de DigitalOcean de la casa, y esa cuenta ofrece
**consola web con root** sobre cualquier droplet, desde el navegador, sin pasar
por `sshd`, sin tocar `ufw` y sin dejar rastro en la máquina.

Consecuencia: **quien controla la cuenta de DO tiene root en toda la flota, hagamos
lo que hagamos con las llaves.** Cualquier promesa contractual sobre acceso que se
apoye solo en SSH es falsa. P3 ya lo anotó como riesgo concentrado; aquí se nombra
como lo que es: **la cuenta de DO es la joya, no la llave SSH.**

### La restricción de escala, que evita sobrediseñar

La flota es de **cero instancias de cliente** hoy, y será de **una** (PIXELED). Hay
**un** operador. Un modelo con bastión, sesiones grabadas y rotación automática
sería correcto para veinte instancias y un equipo de guardia, y sería una obra
inacabada para una.

---

## Decisión

Se adopta un modelo de **acceso nominal, sin cuentas compartidas, con el rastro
fuera de la máquina** — y se declara explícitamente que **la frontera real es la
cuenta de DigitalOcean**, no la llave SSH.

En concreto, seis puntos:

**1 · Nadie entra como `root`.** `setup-droplet.sh` crea un usuario **`soporte`**
con `sudo`, y `sshd` queda con `PermitRootLogin no` y
`PasswordAuthentication no`. El aprovisionamiento deja de usar `root@` y pasa a
`soporte@` con `sudo`.

**2 · Una llave por persona, nunca una llave por instancia.** Las
`authorized_keys` de `soporte` se generan desde un **inventario versionado**
(`infra/acceso/personas.yml`: nombre, huella de la llave pública, fecha de alta).
Dar de baja a alguien es **un commit y una pasada del script**, no acordarse de
qué máquinas tocó.

**3 · El puerto 22 no está abierto al mundo.** `ufw` pasa a permitir 22 **solo
desde el PADRE**, que ya tiene IP fija y conocida. El PADRE deja de ser solo el
plano de control y es también **la puerta de entrada** — no porque se quiera un
bastión, sino porque ya existe, ya es la máquina de la casa y ya tiene su acceso
restringido.

> ⚠️ **Y esto NO viola el invariante del plano de flota.** Ese invariante dice que
> el padre **no consulta** a las instancias para saber su estado: eso sigue
> llegando por reporte saliente. Aquí el padre solo es el sitio desde el que una
> **persona** salta cuando hay una avería. La distinción es la que importa: el
> plano automático sigue en un sentido; el camino humano es explícito y excepcional.

**4 · El rastro sale de la máquina, o no existe.** Un registro de acceso que vive
en el droplet del cliente lo puede borrar quien entró, y desaparece con la
máquina. Se usa el mismo bucket de Spaces que ya está previsto para respaldos y
logs (`SPACES_KEY`, `LOGS_BUCKET`, hoy vacíos): cada sesión de `soporte` escribe
**quién, cuándo, desde dónde y cuánto duró**, y se envía fuera. **Sin esto, los
puntos 1 a 3 son higiene, no una respuesta contractual.**

Y con las dos decisiones del 02/09, el punto 4 queda cerrado así:

- **Retención: un año.** Cubre un ciclo contractual completo. Son kilobytes, así
  que el costo no es el almacenamiento: es que **hay que poder producirlo un año
  después**, y eso obliga a que el bucket no se vacíe «por limpiar».
- **El cliente puede consultarlo.** No es un registro interno: es suyo si lo pide.
  Se le entrega el tramo que le corresponde — **solo sus accesos**, nunca el
  registro de la flota.
- **No hay aviso automático.** Se evaluó y se descartó por ahora: el mecanismo es
  *consulta a petición*, no notificación.

**5 · La cuenta de DigitalOcean se trata como el secreto de mayor valor del
negocio.** 2FA obligatorio para toda persona con acceso; ninguna cuenta
compartida; el token de API con el permiso mínimo y rotación anotada. Y se
**escribe en el contrato** que existe ese camino: prometer que solo se entra con
llave nominal, teniendo consola web, sería una afirmación falsa.

**6 · Y se escribe el runbook de incidente**, que es lo que hoy no existe:
`docs/runbook-incidente-instancia.md`, con el orden que ya usa el resto del
proyecto — primero lo que se mide sin entrar (el reporte de flota, `/api/version`,
el log remoto), y **entrar sólo cuando eso no alcanza**, dejando dicho qué se
tocó.

### Las dos decisiones que faltaban — cerradas el 2026-09-02

**① El contrato autoriza el acceso de antemano.** No hay consentimiento por
sesión: AS OOH puede entrar cuando hace falta, y el cliente lo acepta al firmar.
Es un **servicio administrado**, no una custodia. Con eso la alternativa **C**
(break-glass) queda descartada, no aplazada.

**② El rastro se guarda un año y el cliente puede consultarlo.** Detalle en el
punto 4 de arriba.

> [!danger] Y de ahí sale una corrección al texto del contrato, que no es un matiz
> El mecanismo elegido es **consulta a petición**, no aviso. Así que el contrato
> **no puede decir que el cliente está «consciente de cada acceso»**: con este
> mecanismo el cliente se entera **si pregunta**.
>
> La redacción correcta es *«el cliente puede consultar en cualquier momento el
> registro de accesos de soporte a su instancia, que se conserva un año»*.
>
> **Por qué se escribe aquí en vez de dejarlo al abogado:** es exactamente el modo
> de fallo que este repositorio lleva media docena de veces documentado —un
> documento que afirma algo que nadie construyó—, y el 02/09 costó una mañana con
> el cierre falso de F2.4. La diferencia es que aquí el documento sería el
> contrato, y quien lo descubre es el cliente en una disputa.
>
> Si se quiere de verdad la frase «consciente de cada acceso», hace falta el aviso
> automático, y eso es **otra decisión y otro trabajo** — no está en este ADR.

---

## Alternativas consideradas

### A · Formalizar lo que hay: llave de root compartida

Documentar el estado actual —una llave, `root@`, 22 abierto— y añadir una hoja de
cálculo con quién la tiene.

**Qué la haría buena:** cero trabajo, y con un operador el riesgo real es bajo hoy.

**Por qué se descarta:** no responde la pregunta que bloquea el contrato. Con una
llave compartida **no se puede decir quién entró**, y darla de baja significa
rotarla en toda la flota a la vez. Además deja 22 expuesto a internet en máquinas
que contienen la base de un cliente, lo que convierte cualquier CVE de `sshd` en un
incidente de todos los clientes el mismo día.

### B · Bastión dedicado con sesiones grabadas

Un droplet aparte, endurecido, único origen permitido, que graba cada sesión.

**Qué la haría buena:** es el modelo correcto a escala, y el rastro es
inmanipulable porque no vive en la máquina visitada.

**Por qué se descarta *ahora*:** una máquina más que mantener, actualizar y pagar,
para una flota de una instancia y un operador. Y **el PADRE ya hace de puerta**
—IP fija, acceso restringido, es la máquina de la casa—, así que un bastión aparte
sería una segunda puerta sin cerrar la primera. Se deja anotado como **el paso
siguiente natural cuando la flota pase de unas pocas instancias**: el punto 3 de la
decisión ya deja el camino hecho, porque restringir 22 al PADRE hoy es la misma
operación que restringirlo a un bastión mañana.

### C · Sin acceso permanente — «break-glass» con consentimiento

Ninguna llave instalada. Para entrar, el cliente corre una orden que añade una
llave nominal con caducidad, o el actualizador la baja sólo mientras hay un ticket
abierto.

**Qué la haría buena:** es la respuesta **más fuerte** a *«¿quién puede entrar a mis
datos?»* — la respuesta es *nadie, hasta que tú lo autorices*, y eso es un argumento
de venta de verdad para un producto que se llama «instancias soberanas».

**Por qué se descarta — decidido el 2026-09-02:** el negocio elige que **el
contrato autorice el acceso de antemano**, o sea servicio administrado. Y las dos
razones técnicas apuntaban al mismo lado: el costo operativo cae sobre el cliente
en el peor momento —su sistema está caído y hace falta *su* acción para poder
mirarlo—, y con la consola web de DO disponible la garantía sería **parcialmente
falsa** de todos modos.

**Queda descartada, no aplazada.** Si algún día se quiere vender soberanía en
sentido estricto, hay que volver aquí — y entonces **la cuenta de DO también tiene
que dejar de ser de la casa**, porque sin eso el break-glass es teatro. Eso sería
otro ADR y una decisión de negocio, no de infraestructura.

---

## Consecuencias

### Positivas

- Existe una respuesta escrita a *«¿quién entra, cuándo y con qué permiso?»*, que es
  lo que bloqueaba el contrato.
- Dar de baja a una persona pasa a ser un commit, no un recuerdo.
- El puerto 22 deja de estar expuesto a internet en las máquinas que contienen datos
  de clientes.
- El rastro sobrevive tanto al borrado como a la pérdida de la máquina.
- **Se nombra el riesgo que estaba sin nombrar** (la cuenta de DO), en vez de
  taparlo con una política de llaves que no lo cubre.

### Negativas

- **Tres piezas nuevas que mantener**: el inventario de personas, el envío del
  rastro y el runbook. Un inventario que nadie actualiza es peor que no tenerlo,
  porque da confianza falsa.
- **El PADRE gana importancia**: pasa a ser la puerta de entrada además del plano de
  control. Si el PADRE cae, entrar a una instancia exige abrir `ufw` a mano — y hay
  que dejarlo escrito en el runbook, porque es justo el momento en que nadie quiere
  leer documentación.
- `setup-droplet.sh` cambia, y con él el camino de alta, que **es la parte del
  sistema con más defectos encontrados** (doce, seis de ellos sólo al ejecutar). Se
  toca antes de F5.6 o después, pero no a la vez.
- **Depende de Spaces**, que hoy está sin configurar (`SPACES_KEY` vacío). Mientras
  no lo esté, el punto 4 no existe y esta decisión está a medias.
- **Un año de retención es una obligación, no una intención.** Hay que poder
  producir el registro doce meses después, lo que significa que ese bucket **no se
  puede vaciar «por limpiar»** y que su borrado por ciclo de vida hay que
  configurarlo a propósito, no dejarlo por omisión.
- **Entregar el rastro al cliente exige separarlo por instancia.** Si el registro
  de toda la flota está en un solo sitio, atender una petición obliga a filtrar a
  mano, y filtrar a mano es como se filtra de más. El envío tiene que escribir
  **una ruta por instancia** desde el primer día — corregirlo después es reprocesar
  un año de líneas.

### Implicaciones de seguridad

**Superficie que se quita:** `sshd` deja de escuchar a internet en cada instancia
(hoy `ufw allow 22/tcp` sin origen); desaparece el acceso directo como `root`;
desaparece la autenticación por contraseña.

**Superficie que se agrega:** el PADRE se vuelve un objetivo de mayor valor, porque
comprometerlo da camino a la flota. Y `soporte` tiene `sudo`, así que el
aislamiento entre él y `root` es de auditoría, no de privilegio.

**Dónde viven los secretos y quién los rota:** las llaves **privadas** no viven en
ninguna máquina de la flota ni en el repositorio — sólo las **públicas**, en
`infra/acceso/personas.yml`. Las credenciales de Spaces viven en
`/etc/space-os/instancia.env` (modo 600, root) y en el PADRE. El token de DO vive
en la cuenta, y **su rotación no tiene hoy dueño ni periodicidad**: eso queda como
deuda declarada de este ADR.

**Modelo de autenticación/autorización:** llave pública nominal → `soporte` →
`sudo`. No hay autorización por recurso: quien entra a una instancia lo puede todo
dentro de ella. Eso es aceptable porque el aislamiento entre clientes es **la
máquina**, no un permiso — que es el punto entero del ADR 0022.

**Datos sensibles:** la base del cliente vive en el droplet, sin cifrado en reposo
más allá del que da DigitalOcean por volumen. Los respaldos van a Spaces cifrados
en tránsito (HTTPS); **el cifrado en reposo de esos dumps no está decidido** y
debería estarlo antes de que salgan datos de un cliente real de su máquina.

**Dependencias nuevas:** ninguna biblioteca. Sólo `openssh` y `ufw`, ya presentes,
y el cliente de S3 que el respaldo ya usa.

**Superficie de auditoría — qué queda registrado y qué NO:**

| Queda | No queda |
|---|---|
| Cada sesión de `soporte`: quién, cuándo, desde dónde, cuánto | **Qué hizo dentro.** No hay grabación de sesión (eso es la alternativa B) |
| El reporte saliente de cada actualización | **El acceso por la consola web de DO**, que no pasa por `sshd`. Sólo lo registra DigitalOcean, en su cuenta |
| Los logs de `update.sh`, enviados fuera | Las consultas a la base hechas a mano |

> **Ese hueco de la derecha es la parte honesta de este ADR.** Se puede decir «cada
> acceso por SSH queda registrado»; **no** se puede decir «sabemos todo lo que se
> hizo». Si el contrato necesita la segunda frase, hace falta la alternativa B.

---

## Cómo revertir

Barato, y a propósito. No hay migración de datos ni cambio de esquema: es
configuración de máquina y un inventario en texto.

- Volver a `root@` y a 22 abierto: dos líneas en `setup-droplet.sh` y un
  `ufw allow 22/tcp` por instancia.
- Retirar el envío del rastro: vaciar `LOGS_BUCKET`. El código ya trata la ausencia
  como «no configurado» y sigue (`update.sh:608`).
- El inventario de personas se borra sin consecuencias: las `authorized_keys` ya
  instaladas siguen funcionando hasta que alguien las quite, **lo cual es en sí
  mismo un argumento para el punto 2** — el estado real vive en las máquinas, y el
  inventario sólo vale si algo lo aplica de verdad.

Lo que **no** es reversible por este ADR es lo que ya era cierto antes: quien haya
tenido acceso a la cuenta de DigitalOcean pudo haber entrado a cualquier droplet, y
de eso no hay rastro en las máquinas.
