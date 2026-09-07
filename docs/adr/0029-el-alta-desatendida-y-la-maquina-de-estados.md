# ADR 0029: El ejecutor de altas pasa de «una pasada, un alta» a una máquina de estados

- **Fecha:** 2026-09-07
- **Estado:** Propuesta
- **Amplía:** [ADR 0027](0027-el-alta-de-una-instancia-desde-el-panel.md) · [ADR 0026](0026-panel-de-flota-con-pantalla-propia.md)
- **Depende de:** [ADR 0028](0028-google-obligatorio-y-la-contrasena-para-los-cambios.md) para su último tramo (ver §Decisión, punto 5)

## Contexto

El **2026-09-07** se recorrió el primer alta real desde el panel, de punta a punta. Lo que
quedó medido, y que manda sobre este diseño:

- **El alta automática llega hasta `esperando-dns` en 6 min 02 s** y ahí para. Todo lo que
  falta después son **cuatro pasos a mano**: comprobar el DNS, emitir el certificado, crear
  la primera empresa y comprobar que responde. Más un quinto que nunca se había hecho:
  registrar el token de flota de la instancia en el panel.
- **La maquinaria para continuar ya existe y está encendida.** `flota-altas.timer` despierta
  al ejecutor **cada minuto** (`OnUnitActiveSec=1min`), y `ejecutor.mjs:31` ya define un
  estado llamado `esperando-dns`.
- **Pero ese estado es TERMINAL.** `cola.mjs:174-178` devuelve solo las `pendiente`:

  ```js
  if (todas.some((s) => s.estado === EN_CURSO)) return null
  return todas.find((s) => s.estado === PENDIENTE) ?? null
  ```

  Así que una solicitud que llega a `esperando-dns` **no la vuelve a mirar nadie, nunca**.
  El hueco no es de diseño ni de infraestructura: es un caso que falta.
- **De los cuatro pasos manuales, dos no necesitan a nadie**: el certificado (solo depende
  de que el DNS resuelva) y las comprobaciones. Un tercero, el **DNS del owner**, no es
  nuestro y no se puede automatizar — es la parte comprobable de «soberana». El cuarto, el
  **bootstrap**, produce la contraseña del Dueño, y eso no es un problema técnico.
- **Let's Encrypt permite cinco intentos por hora y por dominio.** Un bucle que reintente
  mal no falla: bloquea el dominio una hora.
- 🔴 **Y `provision-instancia.sh` no tiene arnés de pruebas.** Medido: `update.sh` (119 KB)
  tiene `pruebas-update.sh` (**126 KB**, más grande que el propio guion) y
  `pruebas-vuelta-atras-real.sh`; `provision-instancia.sh` (36 KB) **no tiene ninguno**, y
  `pruebas-update.sh` no lo menciona ni una vez. **Los seis defectos del 07/09 vivían ahí**
  —los de `update.sh` los cazó su arnés antes de producción; estos los cazó un droplet
  cobrándose.

## Decisión

El ejecutor deja de ser «una pasada, un alta» y pasa a **avanzar solicitudes por estados**,
manteniendo su forma actual: un proceso corto que el temporizador despierta, sin nada
residente y sin dependencias npm.

**1 · `esperando-dns` deja de ser terminal.** `siguientePendiente()` gana un hermano:
`siguienteQueAvanza()`, que devuelve la solicitud más antigua en un estado *reanudable*.
La regla de **UNA A LA VEZ** se conserva tal cual — sigue siendo `en-curso` lo que bloquea
la cola, por la misma razón de siempre: dos altas en paralelo compiten por el mismo `doctl`
y la misma clave.

Los estados quedan así, y **cada transición es una pasada del temporizador**:

```
pendiente ──> en-curso ──> esperando-dns ──> emitiendo-cert ──> lista
                  │              │                  │
                  └──> fallida   └──> fallida       └──> cert-agotado
```

**2 · El DNS se comprueba, no se espera dentro de un proceso.** Cada pasada resuelve el
dominio y compara con la IP anotada. Si no coincide, **no hace nada y lo deja igual**: el
coste de esperar es cero porque no hay nada corriendo. Así una solicitud puede esperar
**días** a que el owner apunte su zona, que es el caso real.

**3 · El certificado se emite solo, con la cuota escrita en el estado.** `emitiendo-cert`
lleva un contador de intentos y la hora del último. **Máximo 3 por hora y por dominio** —por
debajo de los cinco de Let's Encrypt, a propósito— y al agotarlos pasa a `cert-agotado`,
que es un estado **que espera a una persona** y no reintenta. Un límite que no está escrito
en el estado no es un límite: es una intención que se pierde al reiniciar.

**4 · Las comprobaciones van DENTRO de la solicitud.** `login 200`, `signup 503` y
`login-post 401` se ejecutan al final y se guardan en la solicitud, no se imprimen en la
pantalla de quien lo lanzó. Un alta cuyo resultado solo existe en un `journalctl` no es
auditable tres semanas después — y es exactamente lo que costó el defecto 27.

**5 · El bootstrap NO se automatiza en este ADR, y la razón no es técnica.** Crear la
primera empresa produce la contraseña del Dueño, y **esa contraseña tiene que llegarle a
él**. Hoy se imprime en la consola del operador, que es justo el vector que el ADR 0028
elimina. Hay dos salidas, y las dos están fuera de este documento:

- **Con el ADR 0028 construido, el paso desaparece**: el Dueño entra con Google y **no
  existe ninguna contraseña que entregar**. Es el camino limpio.
- Con correo saliente en el PADRE, que hoy no existe ni como variable.

Mientras ninguna de las dos esté, `lista` significa *«instancia servida con certificado, a
falta de la primera empresa»*, y ese último comando lo corre una persona.

**6 · El token de flota se entrega por archivo, no por reinicio.** El ejecutor corre como
`altas` y el panel como `flota`: son usuarios distintos a propósito (ADR 0027). Para que el
panel vea una instancia nueva, `altas` escribe **`/etc/space-os/flota-tokens.env`**
(`altas:flota`, modo **640**: escribe uno, lee el otro) y `estado.mjs` lo lee **en cada
petición**, como segunda fuente después del entorno.

> **Por qué así y no reiniciando el panel:** que el ejecutor pueda reiniciar un servicio
> exige darle `sudo`, y con eso el proceso que tiene los tres tokens gana además la
> capacidad de tocar unidades del sistema. Un archivo con permisos de grupo consigue lo
> mismo sin que nadie escale nada. Y de paso el panel deja de necesitar un reinicio para
> ver una instancia nueva, que hoy sí lo necesita.

**7 · Y el orden no es negociable: el arnés va antes.** No se automatiza la emisión de
certificados ni ningún paso nuevo de `provision-instancia.sh` **hasta que ese guion tenga
arnés de pruebas** para los caminos que se van a automatizar. La razón está medida, no
supuesta: seis defectos en un solo día, en el único guion grande sin pruebas, y el que crea
las máquinas de los clientes. Automatizarlo sin arnés convierte un fallo con una persona
delante en un fallo desatendido en la máquina de un cliente.

## Alternativas consideradas

**A · Dejarlo manual y mejorar la tarjeta.** Es lo que hay hoy, y hoy funciona:
`TH-ALTA_despues-del-formulario.txt` tiene los cinco pasos con sus tres puertas.
**Descartada como destino, no como presente**: cada alta depende de que una persona
recuerde correr los comandos **como `altas`** —lo que ya falló una vez el mismo día que se
escribió— y de que esté disponible cuando el owner apunte su DNS, que puede ser un sábado.
Se conserva como el camino de hoy y como la vuelta atrás de este ADR.

**B · Un solo comando «alta completa» que espere el DNS en un bucle dentro.** Más simple de
leer: un proceso, de arriba abajo. **Descartada por una razón concreta**: un proceso que
espera horas a un DNS ajeno es un proceso colgado, y la unidad lo mata —
`flota-altas.service` lleva `TimeoutStartSec=1800`—. Y colgado no da error, que es como se
perdió una hora el 03/09 con `needrestart`. **El estado en disco es lo que permite esperar
días sin nada corriendo.**

**C · Un orquestador de verdad: cola con reintentos, workers, un motor de trabajos.**
Resolvería esto y lo que venga. **Descartada por ahora**: son unas pocas altas al mes, y
`apps/flota` **no tiene ni una dependencia npm a propósito** —nada que actualizar, nada que
audite un CVE—. Meter un motor de trabajos por cinco altas al mes es pagar una dependencia
permanente por un problema que un `switch` sobre un JSON resuelve. Se reabre el día que las
altas sean diarias.

**D · Que el owner apunte su DNS a través de nosotros** (delegarnos su zona), y con eso
automatizar también ese paso. **Descartada, y no por coste**: contradice el modelo. Que la
zona sea del owner es la parte de «soberana» que se puede comprobar (ADR 0022), y pedirle
las llaves de su DNS para ahorrarnos una espera es cambiar la promesa del producto por
comodidad operativa.

## Consecuencias

**Positivas**

- **Un alta con dominio nuestro pasa a ser cero comandos.** Con dominio del owner, cero
  comandos más un aviso suyo — y la espera deja de consumir atención de nadie.
- **El resultado de cada alta queda escrito en la solicitud**, no en la pantalla de quien la
  lanzó. Eso es lo que la hace auditable meses después.
- **El panel deja de necesitar un reinicio** para ver una instancia nueva.
- **La cuota de Let's Encrypt pasa a estar en el estado**, o sea que sobrevive a un
  reinicio y se puede leer. Hoy no existe como concepto en ningún sitio.
- No añade ni un proceso residente ni una dependencia: sigue siendo un temporizador y un
  JSON.

**Negativas**

- **Más estados es más superficie donde quedarse a medias.** Hoy un alta acaba en
  `esperando-dns` o `fallida`; con esto hay cinco sitios donde pararse, y cada uno necesita
  que alguien sepa qué significa. Se paga con el punto 4: el estado y su motivo van dentro
  de la solicitud, que es lo que el panel enseña.
- **Un certificado emitido sin nadie delante es un certificado que nadie miró.** El límite
  de 3/hora y el estado `cert-agotado` acotan el daño, pero no lo eliminan.
- **`cert-agotado` es un estado nuevo que espera a una persona**, y si nadie mira el panel
  se queda ahí para siempre. No se le pone reintento automático a propósito: reintentar
  contra una cuota agotada la mantiene agotada.
- **Exige el arnés de `provision-instancia.sh` primero**, que es trabajo de días y no de
  una tarde. Esta decisión no acelera nada por sí sola: ordena.

**Implicaciones de seguridad**

- **Superficie que se agrega:** el ejecutor gana la capacidad de emitir certificados y
  correr comprobaciones **sin nadie delante**. Ya podía crear droplets, así que no es una
  clase nueva de poder — pero sí más veces y sin testigo. Lo que lo acota es que sigue
  actuando **solo sobre solicitudes que un humano autorizó** por el formulario, con sesión
  y permiso `administracion`, y que la región, el tamaño y el canal **no** los decide la
  solicitud (ADR 0027).
- **Superficie que se quita:** desaparece el paso en el que una persona pega comandos con
  los tres tokens volcados en su shell interactivo. Eso ya se redujo hoy (defecto 31) y con
  esto deja de ocurrir.
- **Dónde viven los secretos y quién los rota:** sin cambios en el ejecutor
  (`/etc/space-os/ejecutor.env`, `altas`, 600). **Aparece un archivo nuevo**,
  `/etc/space-os/flota-tokens.env`, `altas:flota` **640**: lo escribe el ejecutor y lo lee
  el panel. Contiene tokens de flota, cuyo alcance es deliberadamente diminuto — `/api/version`
  no devuelve nada de negocio (F6.1), así que uno filtrado revela la versión y la última
  migración de **esa** instancia y nada más. **No debe ser legible por `otros`**, y esa es
  la única cosa que hay que comprobar al desplegarlo.
- **Autenticación/autorización:** sin cambios. El panel sigue sin credenciales de usuario ni
  de base: toma la cookie del navegador y le pregunta al PADRE quién eres.
- **Superficie de auditoría:** **mejora**, y es una de las razones del cambio. Hoy el
  recorrido de un alta vive en `journalctl`; con esto vive en la solicitud, con estado, hora
  y motivo. Lo que **sigue sin registrarse** es quién emitió un certificado a mano fuera de
  este camino.
- **Dependencias nuevas:** ninguna. Es la razón de descartar la alternativa C.

## Cómo revertir

Barato, y por diseño:

1. **Quitar el caso nuevo de `siguienteQueAvanza()`** devuelve `esperando-dns` a ser
   terminal, y el ejecutor a «una pasada, un alta».
2. **La tarjeta manual sigue existiendo y sigue siendo válida** —es la alternativa A, que se
   conserva a propósito—, así que revertir no deja el alta sin camino: la deja como hoy.
3. `flota-tokens.env` se puede borrar; `estado.mjs` cae al entorno, que es lo que hace hoy.

**Lo que no se revierte con un interruptor:** las solicitudes que ya estén en un estado
nuevo (`emitiendo-cert`, `cert-agotado`). Habría que llevarlas a mano a `esperando-dns` o a
`lista`. Son archivos JSON y son pocos, pero es deuda y va dicho aquí.
