# ADR 0032 — El alta en droplet propio del cliente, y la licencia firmada

- **Fecha:** 2026-09-10
- **Estado:** Aceptada · **implementada, sin desplegar** (enmendado 2026-09-11 — ver Enmienda)
- **Decide:** Emiliano
- **Responde a:** la pregunta que el
  [ADR 0025](0025-acceso-de-soporte-a-una-instancia.md) dejó abierta **por su
  nombre** al descartar el break-glass, y la decisión **§8.3 del plan v3** («en
  qué cuenta de DigitalOcean nacen las instancias»), abierta desde el 13/08.
- **Relacionadas:** [ADR 0022](0022-instancia-dedicada-por-owner.md) ·
  [ADR 0027](0027-el-alta-de-una-instancia-desde-el-panel.md) ·
  [ADR 0029](0029-el-alta-desatendida-y-la-maquina-de-estados.md) ·
  `vault/01-Arquitectura/modelo-instancias-soberanas.md` ·
  `docs/superpowers/specs/2026-09-10-alta-en-droplet-propio-design.md`

---

## Enmienda del 2026-09-11 — implementada; y la línea de «cuándo apaga» cambió

El cuerpo de este ADR, más abajo, es el registro de lo que se decidió el 10/09
y **no se reescribe**. Esto es lo que cambió al construirlo, en las once tareas
que siguieron.

### a) El estado pasa a «Aceptada · implementada, sin desplegar»

Los dos caminos de alta, la licencia firmada, el apagado en `update.sh`, la
página de vencimiento en nginx, el aviso dentro de la aplicación y el
instalador con sus tarjetas — todo existe en la rama `feat/alta-droplet-propio`
y está probado con arneses locales.

**Lo que falta es humano, no código:** generar el par de llaves de verdad
(`docs/evidencias/llaves-de-licencia.txt`), firmar la primera licencia real y
correr el ensayo completo en DEMO
(`docs/evidencias/ensayo-licencia-demo.txt`) antes de que exista un primer
cliente en este camino. **Nada de esto está encendido en ninguna máquina**:
`LICENCIA_REQUERIDA` vale `0` por omisión (`infra/scripts/update.sh:829`) y
ninguna instancia hoy lo tiene en `1`.

### b) `invalida` se parte en dos, y la línea no es «qué se rompió»

El cuerpo original (punto 5 de la Decisión) dice que la instancia se apaga
cuando la licencia venció. Al construirlo apareció un caso que ese texto no
contemplaba: el código también apagaba cuando **no se podía comprobar la
firma** —por ejemplo si `openssl` falta o es anterior a la versión 3.0—, y eso
tiraba a un cliente al corriente de pago por un fallo de una herramienta
**nuestra**, no suya.

La regla que quedó, y que gobierna todo el bloque de licencia de
`infra/scripts/update.sh:954-994` (calcula el estado) y `:1075-1107` (decide
qué hacer con él): **¿tengo una afirmación del cliente que contradice su
derecho?**

| Situación | Qué es | Qué hace | Código |
|---|---|---|---|
| Firma que no valida | una afirmación falsa | **apaga** | 8 |
| Instancia o dominio que no cuadran con la licencia | una licencia de otro | **apaga** | 8 |
| Licencia ausente o ilegible | quitó su propio documento | **apaga** | 8 |
| `openssl` ausente o sin `pkeyutl -verify -rawin` | falta **nuestra** herramienta | **sigue sirviendo, y avisa** | 9 |

Las tres primeras filas caen en la rama `vencida|invalida` del `case` de
`update.sh:1077` (el estado lo decide `licencia_valida()`,
`update.sh:883-918`), y esa rama termina en `salir "$EX_LICENCIA" ...`
(`update.sh:1082`). La cuarta es la rama `no-comprobable` del **mismo** `case`
(`update.sh:986,1084-1095`): arranca el contenedor si estaba parado, devuelve
nginx a la normalidad, y sale con `EX_LICENCIA_NO_COMPROBABLE`
(`update.sh:396,1095`) sin seguir actualizando esa noche — se distingue de la
primera rama por lo que hace, no por vivir fuera del `case`.

**El argumento que lo zanjó, para que quede escrito:** fallar cerrado sólo se
defiende si cerrar impide algo, y en este modelo el cliente tiene root — puede
poner `LICENCIA_REQUERIDA=0`, o apuntar las rutas de nginx a donde quiera,
porque salen de su propio `instancia.env`. Apagar por una herramienta rota no
añade ninguna disuasión; sólo añade caídas a quien no está atacando nada. Lo
que sostiene el mecanismo, como ya decía el cuerpo de este ADR, es que el
sabotaje deja huella — no que cerrar sea siempre la respuesta.

**Lo que se descartó en esa misma discusión, con su razón:** un contador de
noches seguidas en `no-comprobable` antes de apagar de todos modos. Se
descartó porque necesita estado persistente entre corridas y compra poco: quien
quiera saltárselo edita una línea de su propio `instancia.env`, que es más
fácil que borrar `openssl` y esperar dos semanas a que el contador se cumpla.
**Su disparador para retomarlo, escrito de antemano:** el día que exista un
tercero con root sobre ese droplet que no sea el cliente.

### c) Un valor de configuración que no se entiende aborta; no apaga

`LICENCIA_REQUERIDA` con cualquier valor que no sea `0` ni `1` **detiene el
update con un error de configuración** (`EX_CONFIG`,
`infra/scripts/update.sh:840`) y no toca el contenedor ni nginx. Hasta la
ronda de corrección que cerró esto, un valor raro se trataba como «encendido» y
se registraba sin más — con el apagado ya construido, eso significa que un
dedazo en la configuración de un hijo **administrado** (que nunca debería
llevar licencia) podía terminar apagándolo. Un valor que este guion no entiende
no puede decidir si se apaga la instancia de un cliente.

### Lo que no cambia

Los ocho puntos de la Decisión y el riesgo aceptado siguen como se escribieron
el 10/09. Esta enmienda corrige un matiz de **cuándo** apaga `update.sh`, no
**que** apague, ni el resto del diseño.

## Contexto

### Lo que este ADR viene a contestar, y no es una pregunta nueva

El ADR 0025 (02/09) eligió **servicio administrado**: el contrato autoriza
nuestro acceso de antemano. Al descartar la alternativa —el break-glass, donde
el cliente concede el acceso incidente a incidente— dejó escrito esto:

> **«Queda descartada, no aplazada.** Si algún día se quiere vender soberanía en
> sentido estricto, hay que volver aquí — y entonces **la cuenta de DO también
> tiene que dejar de ser de la casa**, porque sin eso el break-glass es teatro.
> Eso sería otro ADR y una decisión de negocio, no de infraestructura.»

**Este es ese ADR.** Y la decisión de negocio la tomó Emiliano el 2026-09-10:
existe un modelo de venta en el que **el cliente crea y paga su propio droplet**,
y nosotros le entregamos SPACE OS encima.

### El hecho que ordena todo lo demás, otra vez

El ADR 0025 lo nombró y sigue siendo cierto: **la cuenta de DigitalOcean es la
joya, no la llave SSH.** Quien controla la cuenta tiene consola web con root
sobre cualquier droplet, sin pasar por `sshd`, sin tocar `ufw` y sin dejar rastro
en la máquina.

En el modelo administrado eso juega a nuestro favor: podemos entrar siempre. En
el modelo nuevo se invierte con todas sus consecuencias — **la cuenta es del
cliente, así que el root de última instancia es suyo.** No es un detalle
contractual: es el eje del que cuelgan la licencia, el apagado y lo que se puede
prometer por escrito.

### Lo que ya estaba preparado sin saberlo

`provision-instancia.sh` lleva los dos modos desde que se escribió, y su cabecera
dice por qué no eligió uno:

```
--crear-droplet   lo crea con `doctl` en la cuenta ya configurada
--host <ip|dns>   usa un servidor que ya existe (el caso «cuenta del owner»)

Lo que NO se decide aqui es cual es el de por defecto: no hay ninguno. Hay
que elegir uno en cada corrida, a proposito.
```

Esa abstención era correcta y hoy se cobra: **el camino existe y está probado**
(`pruebas-provision.sh`). Lo que no existe es el instalador que corre **dentro**
del droplet del cliente.

---

## Decisión

Se adoptan **dos caminos de alta**, los dos vigentes, para el mismo software.

Un hijo es un hijo: `g500`, `DEMO` y los que vengan corren **la misma imagen**.
Lo que los distingue no es lo que son, sino **por qué camino nacieron**.

| | **Alta administrada** (existe) | **Alta en droplet propio** (nueva) |
|---|---|---|
| Crea la máquina | nosotros, con `doctl` | el cliente, en su cuenta |
| Paga a DigitalOcean | nosotros | el cliente |
| Instala | nosotros, por SSH (`remoto()`) | el cliente, con nuestro paquete |
| Consola web con root | nuestra | **suya** |
| Nuestro acceso | SSH `soporte` + cuenta de DO | **SSH `soporte` y nada más** |
| Respaldos y logs | bucket de la casa | **bucket del cliente, con sus claves** |
| Licencia | **no** (`LICENCIA_REQUERIDA=0`) | **sí** (`=1`) |
| Cómo sabemos que salió bien | **lo vimos hacerlo** | **nos lo cuenta el hijo** |

Y ocho puntos concretos:

**1 · La cuenta de DigitalOcean es del cliente, y con ella el root de última
instancia.** No pedimos acceso a la cuenta. Nuestro único camino a esa máquina es
SSH al usuario `soporte` del ADR 0025, y **el cliente lo puede cerrar cuando
quiera**. La disponibilidad que se puede prometer por contrato cambia de forma:
depende de que él mantenga esa puerta abierta.

**2 · El alta la corre el cliente con un paquete que fabricamos nosotros.** Son
cuatro cosas: el **nombre** con el que aparecerá en flota, su **token de flota**,
su **licencia firmada**, y el **instalador con su tarjeta**. El instalador no se
pega desde un `curl | bash`: se descarga, se compara su `sha256`, y sin
`--confirmar` se comporta como `--dry-run` — la misma disciplina que
`provision-instancia.sh`.

**3 · El token de flota ES el registro.** No hay dos altas. Se crea la entrada en
el inventario del PADRE, sale un token, y ese token es lo que hace aparecer la
máquina en el panel. A partir de ahí **todo lo demás lo cuenta el hijo solo**:
versión, canal, salud, y con qué código acabó su última actualización. Igual que
cualquier otro hijo, porque el reporte de flota es **saliente** y sobrevive a que
nos cierren el SSH.

**4 · La licencia es un archivo firmado, y se comprueba sin salir a internet.**
El PADRE firma con su llave privada; la imagen lleva la pública dentro, idéntica
para toda la flota. La instancia comprueba **firma y fecha en local**. El PADRE
sólo hace falta para **renovar**, nunca para funcionar: si nuestro servidor se
cae, ningún cliente se queda fuera de su propio sistema.

La licencia lleva dentro **el nombre de la instancia y su dominio**, y la firma
los cubre. Copiarla a un segundo droplet no funciona.

**5 · Dos capas: `update.sh` apaga, la aplicación avisa.** Y la separación no es
estética.

- **`update.sh` es la autoridad del apagado.** Comprueba firma y fecha con
  `openssl`, fuera del contenedor. Si pasó la gracia, no levanta el contenedor y
  nginx sirve una página que explica y da el teléfono. Que alguien parchee el
  JavaScript de la aplicación **no cambia nada**: el que decide no es la
  aplicación.
- **La aplicación sólo avisa**, nunca bloquea: banda discreta semanas antes,
  imposible de ignorar durante la gracia.

La comprobación **no puede vivir en `middleware.ts`**, y no es una preferencia:
ese archivo corre en el runtime edge, donde `process.env` puede quedar horneado
en el build (`middleware.ts:33-34`, un aviso que este repositorio ya se ganó). La
imagen es idéntica para toda la flota, así que un dato **por instancia** no puede
leerse desde ahí.

**6 · Aviso, gracia y apagado — en ese orden.** Semanas de aviso antes del
vencimiento; un periodo de gracia en el que el sistema funciona con el aviso ya
imposible de ignorar; y después, no deja entrar. Nadie se queda tirado sin
haberlo visto venir, y un error de facturación no cierra una empresa un lunes por
la mañana.

Y lo que hace defendible el apagado en este modelo concreto: **los datos del
cliente están en SU Postgres, en SU droplet.** Apagar retira lo nuestro; no
retiene nada suyo. Le basta un `pg_dump`.

**7 · La llave privada se guarda cifrada, y firmar es un acto de una persona.**
Quien tenga esa llave puede fabricar licencias eternas para cualquiera: es el
secreto de más valor del sistema, por encima del token del registro. Se guarda
cifrada y **la frase de paso no vive en ningún archivo**: la teclea una persona
al firmar.

Firmar **no entra en la máquina de estados desatendida del ADR 0029**, por la
misma razón que su punto 5 dejó fuera el bootstrap: firmar una licencia dice
*«este cliente pagó, hasta esta fecha»*, y eso es un acto comercial. Con
licencias mensuales o anuales son un puñado de firmas al año.

**8 · Los respaldos y los logs van al bucket del cliente, con sus claves.**
Mandar el volcado de su base comercial a un bucket nuestro contradice
exactamente lo que se le vende. En el alta administrada no cambia nada.

---

## Lo que esta decisión NO dice

- **No sustituye al modelo administrado.** `g500` sigue como está, en la cuenta
  de la casa. Los dos caminos conviven, y el ADR 0025 sigue vigente entero para
  el administrado.
- **No dice que la licencia sea un candado técnico.** Ver el riesgo aceptado, más
  abajo. Se diseña para que saltársela sea un **acto deliberado y visible**, no
  para que sea imposible.
- **No resuelve la credencial del registro.** Ver «lo que queda abierto».
- **No cambia el invariante del plano de flota.** El PADRE sigue sin consultar a
  las instancias: todo llega por reporte saliente.
- **No pone licencia a los hijos administrados.** `LICENCIA_REQUERIDA=0` por
  omisión. El código es uno solo; lo que cambia es un valor de configuración.

---

## Consecuencias

### Lo que se gana

- **La palabra «soberanas» deja de ser una metáfora** en el nombre del modelo.
  Un cliente puede comprobar su propio aislamiento, su propia cuenta y su propio
  respaldo, y puede despedirnos sin perder nada.
- **Un argumento de venta que se puede demostrar, no prometer.** La lista blanca
  del panel de flota (`CLAVES_FILA`) fija en **siete campos** lo que sale de su
  máquina, y hay una prueba que falla si alguien añade uno. Se le enseña la lista
  y se le enseña el guard.
- **El costo del droplet sale de nuestra cuenta de resultados** y pasa a la suya.
- **La mitad del trabajo ya existe**: el modo `--host`, el panel de flota con
  diagnóstico, el usuario `soporte`, la lista blanca y el reporte saliente.

### Lo que cuesta

- **Un mecanismo de licencia que hoy no existe**: par de llaves, firma, la
  comprobación en `update.sh`, la página de vencimiento en nginx y el aviso
  dentro de la aplicación.
- **Un instalador que corre dentro del droplet**, que es la dirección contraria a
  la de `provision-instancia.sh` y no se puede reutilizar tal cual.
- **Un secreto nuevo de máximo valor** que custodiar, con su procedimiento de
  rotación y su respuesta a «se filtró».
- **Soporte con un pie fuera.** Cuando su sistema esté caído a las 3 de la
  mañana, puede hacer falta que él exista para dejarnos entrar. Es el costo que
  el ADR 0025 ya midió al descartar el break-glass, y aquí se acepta a cambio de
  lo que se gana.

### El riesgo aceptado, escrito para que nadie lo descubra después

**Ninguna licencia sobrevive a root, y en este modelo el cliente tiene root.** Su
máquina, su disco, su reloj. Puede editar la configuración, atrasar la fecha, o
parchear `update.sh`, que es un archivo de texto suyo.

Se acepta **a sabiendas**, porque el objetivo no es el que parece:

> **No podemos impedirlo. Podemos hacer que no se pueda esconder.**

Lo que sí sujeta el diseño:

1. **Copiar la licencia a otra máquina no funciona** — va firmada con el nombre y
   el dominio dentro.
2. **Parchear la aplicación no sirve** — quien apaga es `update.sh`, fuera del
   contenedor.
3. **Correr una imagen modificada se ve** — `update.sh` ya lee el digest de la
   imagen que corre y ya lo compara con el registro. Una imagen hecha a mano no
   coincide con ninguna que hayamos publicado.
4. **Y el silencio delata.** Para manipular sin que se note habría que apagar
   también el reporte de flota — y el silencio **ya es un estado** en el panel,
   con la fecha desde la que dura. Apagar lo que delata es la delación.

**Lo que esto compra de verdad es contractual, no técnico**: convierte «usarlo
sin pagar» de inercia en un acto deliberado de manipulación, que es lo que un
contrato necesita para poder reclamar. Vendido como candado técnico sería falso.

---

## Lo que queda abierto, con su disparador escrito

**La credencial del registro de imágenes.** Para bajar la imagen, cada instancia
guarda `REGISTRY_TOKEN` en disco (`provision-instancia.sh:631`,
`update.sh:1308`). El cliente tiene root, así que puede leerlo — y es un token de
**la cuenta**, o sea el mismo para toda la flota: dar de baja a uno obligaría a
rotárselo a todos.

**Se decide NO resolverlo ahora**, y por dos razones medidas:

1. Ese token sirve para **bajar** imágenes, no para correrlas: la licencia decide
   si arrancan. Quien se lo lleve puede descargarse el producto, no usarlo.
2. La alternativa —que el PADRE reparta las imágenes con una credencial por
   cliente— es un servicio nuevo con ancho de banda, disco y disponibilidad
   propios, en un droplet de seis dólares, **para cero clientes de este modelo**.

**Lo que sí se hace ahora**, porque cuesta casi nada y evita quedar atrapados:

- Que **de dónde sale la imagen** sea un único valor de configuración, para que
  mudarlo sea cambiar una línea y no reescribir `update.sh`.
- Escribir la **tarjeta de rotación** del token y probarla una vez. Un secreto
  que nadie ha rotado nunca no se sabe rotar.

**Y el disparador para construirlo de verdad, escrito de antemano para que no sea
una discusión:** el **segundo** cliente en este modelo, o el **primer final de
contrato en malos términos**.

---

## Alternativas consideradas

**Cuenta del cliente, pero con nosotros dentro también** (un token de API o un
usuario de equipo suyo para nosotros). Cómodo de operar: conservaríamos la
consola web y no dependeríamos de él para entrar. **Descartada porque deja la
promesa a medias**, y el ADR 0025 ya avisó de que una garantía de acceso apoyada
en SSH mientras existe la consola web es *«teatro»*. Vender soberanía y
conservar la joya es exactamente eso.

**Cuenta nuestra con el droplet refacturado.** Cero trabajo: sólo un cambio de
precio. **Descartada porque no es lo que se quiere vender** — el cliente no crea
nada y no gana ninguna garantía comprobable.

**Sin licencia: al irse, sólo deja de recibir actualizaciones.** Lo más honesto
con «es tu máquina» y cuesta cero código. **Descartada** porque significa que
quien pagó un mes puede usar el sistema para siempre.

**Licencia que sólo bloquea lo nuevo** (consultar y exportar sí; crear campañas,
propuestas o pantallas no). Menos agresiva y muy defendible. **Descartada** a
favor del apagado con aviso y gracia, que es más simple de explicar y de
construir — y cuyo daño real es bajo porque los datos nunca dejan de ser suyos.

**Comprobación de licencia contra el PADRE cada día.** Permitiría revocar en el
acto en vez de esperar a que caduque el archivo. **Descartada** porque convertiría
un droplet de seis dólares sin réplica en el punto único del que depende que
funcione el sistema de **todos** los clientes. «Nuestro servidor se cayó y por eso
tú no puedes trabajar» es el peor titular posible para un producto que se vende
como soberano.

**Licencia también en los hijos administrados**, para que el mecanismo se
estrenara en máquinas nuestras. **Descartada por Emiliano el 10/09**: en esas
máquinas mandamos nosotros y apagar es trivial. La reserva que la motivaba —que
un interruptor de apagado no debería estrenarse contra un cliente que paga— se
atiende de otra forma: **antes de que ningún cliente reciba una licencia se
ensaya en DEMO con una caducada a propósito**, y se vuelve a apagar el
interruptor. Probar el mecanismo no exige que DEMO viva con licencia.
