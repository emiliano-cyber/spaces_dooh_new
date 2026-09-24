# SPACE OS — de 0 a 100 %

**Guía de implementación.** Qué ocurre desde que un cliente dice que sí hasta que
opera solo, quién hace cada paso y qué lo puede parar.

Fecha: 2026-09-24 · ADR de referencia: 0022, 0027, 0029, 0032, 0037, 0038.

---

## El modelo, en un párrafo

**Un solo código, muchas instancias.** Cada cliente corre **su copia completa** en
**su propio servidor**, con **su base de datos** y **su dominio**. No comparten
máquina ni base: el aislamiento no depende de que el software lo haga bien, sino
de que no hay nada que compartir.

El trabajo se hace una vez en el **PADRE** —la máquina de AS OOH—, se prueba en
**DEMO**, y cada instancia **jala** la versión cuando le toca. Nadie entra por SSH
a desplegar: la instancia se actualiza sola.

---

## 0 % → 20 % · El alta

**Quién:** AS OOH, desde el panel. **Dónde:** `/flota/altas/` en el PADRE.

Se rellena un formulario con el nombre del cliente y su dominio. La solicitud
**no ejecuta nada**: entra en una cola. Un ejecutor la recoge cuando le toca, de
una en una, y nunca dos a la vez.

**Por qué una cola y no un botón que aprovisiona:** crear un servidor tarda
minutos y puede fallar a mitad. Con la cola, el fallo deja un estado legible y
reintentable en vez de una pestaña colgada y una máquina a medio hacer.

> **Lo que puede pararlo:** que el dominio no esté en una zona DNS que
> gestionemos. El guard lo rechaza **antes** de crear nada.

---

## 20 % → 45 % · El servidor del cliente

**Quién:** el ejecutor, solo. **Con qué:** `provision-instancia.sh`.

Se crea el droplet **en la cuenta de DigitalOcean del propio cliente** (ADR 0032),
no en la nuestra. Es una decisión deliberada y tiene consecuencias que conviene
entender antes de firmar:

- **El cliente es dueño de su infraestructura.** Si mañana se va, se lleva su
  servidor y sus datos. No hay rehén.
- **Paga su factura directamente.** No hay reventa de cómputo.
- **Y nosotros no tenemos acceso permanente.** El soporte entra cuando el cliente
  abre la puerta, no cuando quiere.

Se registra el DNS, se emite el certificado y se deja la máquina lista para
recibir la aplicación.

---

## 45 % → 70 % · La instalación

**Quién:** el ejecutor. **Con qué:** `instalar-hijo.sh`.

Se deja en el servidor tres cosas, y solo tres:

1. **`update.sh`** en `/opt/space-os/` — el actualizador. Vive en el anfitrión.
2. **`instancia.env`** — su configuración: base, canal, dominio, credenciales.
3. **Un cron** — que despierta al actualizador cada madrugada.

> **La distinción que más cuesta y más se paga:** `update.sh` vive en la máquina;
> **la aplicación y sus migraciones viajan dentro de la imagen**. Son dos vehículos
> distintos. **Nada actualiza `update.sh` solo**: si cambia, alguien lo instala.

---

## 70 % → 85 % · La primera versión

**Quién:** el actualizador, solo.

`update.sh` se despierta, jala la imagen del registro, y si hay algo nuevo:

1. **Respalda la base entera** y sube el respaldo fuera del servidor.
2. **Aplica las migraciones** con un contenedor efímero de la imagen nueva.
3. **Conmuta** al contenedor nuevo, guardando el anterior.
4. **Comprueba la salud** y **vuelve atrás sola** si no responde.

**Mide la base antes y después** en vez de creerse el mensaje del runner. Si algo
salió a medias, **no conmuta el tráfico y no restaura por su cuenta**: deja el
estado escrito y para. Con una base viva y en uso, esa es la respuesta correcta.

---

## 85 % → 95 % · El primer usuario

**Quién:** AS OOH, una sola vez.

Se crea el **Dueño** de la organización con una **contraseña temporal**. La
primera vez que entra, **lo único que puede hacer es cambiarla**: ni ver datos, ni
tocar nada. A partir de ahí él crea a los suyos y reparte permisos por módulo.

---

## 95 % → 100 % · Opera solo

**Quién:** el cliente.

- **Las versiones llegan por canal.** Las instancias de cliente siguen `estable`;
  `beta` es el banco de pruebas interno y solo lo consume DEMO.
- **Y el cliente decide si las toma** (ADR 0037). En modo `aprobacion`, su
  actualizador ve que hay algo nuevo, **lo anuncia en su pantalla y espera**. La
  aprobación va atada **al identificador exacto de la imagen**, no al nombre de la
  versión: si se publica otra, la aprobación caduca sola.
- **El soporte se escribe desde dentro** (ADR 0038). El cliente abre una
  incidencia en su aplicación; AS OOH la ve y la contesta desde el panel, sin
  entrar a su servidor.
- **La flota se vigila de un vistazo**: qué versión corre cada instancia, desde
  cuándo, y quién no contesta.

---

## Lo que hay que saber antes de prometer fechas

**Una instancia que no contesta y una instancia sin incidencias se parecen mucho.**
Todo el sistema está construido para distinguirlas: un silencio nunca se pinta
como una buena noticia. Si algo se ve verde, es porque alguien lo midió.

**Las tres cosas que de verdad frenan una implantación** no son técnicas:

| | |
|---|---|
| **El dominio** | tiene que estar en una zona que gestionemos, o el alta se rechaza |
| **La cuenta de DigitalOcean** | la abre el cliente, y con su tarjeta |
| **La versión de PostgreSQL** | el servidor tiene que ir por **15 o superior** |

Esa tercera se aprendió caro: una instancia nacida sobre una imagen antigua se
quedó en PostgreSQL 14 y **no pudo tomar ninguna versión nueva** hasta migrar el
motor. Desde entonces cada migración declara qué versión necesita y el runner
**se niega antes de aplicar nada** en vez de fallar a mitad.

---

## Cuánto tarda, honestamente

| Fase | Tiempo | Quién lo mueve |
|---|---|---|
| Alta y aprovisionamiento | minutos | automático |
| Instalación y primera versión | minutos | automático |
| Primer usuario | un rato | AS OOH |
| **Que el cliente tenga SUS datos dentro** | **días o semanas** | **el cliente** |

**La última fila es la que manda.** El software está en pie en menos de una hora;
cargar el inventario real, los contratos y los arrendadores es el trabajo de
verdad, y lo hace el cliente. Prometer «operativo en un día» es cierto para la
máquina y falso para el negocio.
