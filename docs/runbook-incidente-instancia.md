# Runbook — la instancia de un cliente falla

- **Para:** quien atienda el incidente. No hace falta haber tocado este proyecto antes.
- **Modelo de acceso:** [ADR 0025](adr/0025-acceso-de-soporte-a-una-instancia.md)
- **Relacionados:** `runbook-actualizar-instancia.md` · `runbook-alta-de-owner.md` ·
  `infra/scripts/update.sh` (sus códigos de salida)

> [!important] La regla que ordena todo este documento
> **Se diagnostica sin entrar hasta que sea imposible seguir sin entrar.**
>
> No es ceremonia ni desconfianza: entrar al droplet de un cliente es entrar a la
> base de datos de su negocio. El contrato lo autoriza (ADR 0025 ①) y el cliente
> puede consultar el registro, así que **cada sesión que abras va a quedar escrita
> con tu nombre**. Que quede escrita es lo correcto; que sobre, no.
>
> Y hay una razón práctica además de la ética: **la mitad de los incidentes de este
> sistema se diagnostican sin abrir una sesión**, porque la instancia ya cuenta lo
> que le pasó.

---

## Paso 0 · Qué dice la instancia sin que nadie entre

La instancia **reporta hacia fuera** al terminar cada actualización
(`update.sh:589-639`). El padre nunca le pregunta: es ella la que habla. Así que lo
primero es leer lo que ya dijo.

**Desde el PADRE:**

```bash
# El estado de la flota, que es la última cosa que reportó cada instancia
cd /var/www/Spaces/apps/flota && node estado.mjs
```

```bash
# Y lo que la instancia dijo de sí misma la última vez
cat estado/<instancia>.json 2>/dev/null | head -40
```

**Qué buscar, y qué significa:**

| Lo que ves | Qué te dice |
|---|---|
| Un reporte reciente con la versión esperada | La instancia terminó su última actualización bien. El problema es **posterior** o es de red |
| Un reporte con una versión **anterior** a `estable` | Se quedó atrás: su `update.sh` no corrió, o corrió y volvió atrás |
| **Ningún reporte nuevo** desde hace días | El cron no corre, o la máquina no llega al padre. Ojo: **no** significa que la aplicación esté caída |
| Un reporte que dice que hubo vuelta atrás | La versión nueva no pasó la salud y la instancia se rescató sola. **Eso no es un incidente urgente: es el diseño funcionando** |

> [!warning] Un silencio no es una caída
> Que no haya reporte sólo dice que **la instancia no habló**. El envío es a
> propósito «mejor esfuerzo»: si el padre no está, la instancia sigue y guarda el
> reporte para la corrida siguiente (`update.sh:637`). Confundir silencio con
> caída es cómo se abre una sesión que no hacía falta.

---

## Paso 1 · Preguntarle a la instancia desde fuera

Todavía sin entrar. Desde tu máquina, sustituyendo el dominio del cliente:

```bash
curl -s -o /dev/null -w 'login   -> %{http_code}\n' https://<dominio>/spaces-dooh/login/
curl -s -o /dev/null -w 'metodos -> %{http_code}\n' https://<dominio>/spaces-dooh/api/auth/metodos/
curl -s -o /dev/null -w 'version -> %{http_code}\n' https://<dominio>/spaces-dooh/api/version/
```

`auth/metodos/` es la misma ruta que usa la sonda de salud del actualizador: es
pública, no lleva sesión y **toca la aplicación de verdad**, no sólo el nginx.

**El árbol de decisión, y es el que más tiempo ahorra:**

| login | metodos | Lectura |
|---|---|---|
| 200 | 200 | **La aplicación está sana.** Lo que falla es algo de negocio dentro: pide al cliente qué pantalla y qué hizo. No hace falta entrar todavía |
| 200 | 5xx | nginx sirve y la aplicación responde, pero **algo detrás falla** — casi siempre la base. Aquí sí se va a entrar |
| 000 / timeout | 000 | Nadie escucha: contenedor caído, la máquina apagada, o el firewall. **Mira primero si el droplet existe** (paso 2) |
| 502 / 504 | 502 / 504 | nginx está arriba y **la aplicación no**: contenedor muerto o arrancando |
| Aviso de certificado | — | El certificado venció y no se renovó. **No es una caída de la aplicación** y se arregla sin tocar la base |

Y la versión, con el token de flota si lo tienes a mano:

```bash
curl -s -H 'Authorization: Bearer <FLOTA_TOKEN>' https://<dominio>/spaces-dooh/api/version/
```

Sin token responde `{"ok":true}` y **eso es correcto**, no un error: la versión sólo
se revela al panel autenticado (`app/api/version/route.ts:95-97`).

---

## Paso 2 · Lo que se ve desde la cuenta, sin abrir sesión

Desde el PADRE, con `doctl`:

```bash
doctl compute droplet list --format Name,PublicIPv4,Status,Memory,Disk
```

Un `Status` que no sea `active`, o un disco lleno, explican la mitad de los casos
del cuadro de arriba **sin necesidad de entrar**.

> [!danger] La consola web NO es el camino de diagnóstico
> La cuenta de DigitalOcean ofrece consola con root desde el navegador. **No la
> uses para diagnosticar**: no pasa por `sshd`, así que **no deja rastro en el
> registro de accesos** que el cliente puede consultar (ADR 0025 §4), y con eso se
> pierde justamente la garantía que se le vendió.
>
> Se reserva para lo único que no admite alternativa: que `sshd` esté caído y no
> haya otra forma de entrar. **Y si la usas, se anota a mano en el registro.**

---

## Paso 3 · Entrar. Y a partir de aquí queda escrito

Se llega aquí sólo si los pasos 0 a 2 no alcanzaron. **Antes de abrir la sesión,
ten claro qué vas a mirar**: una sesión con un objetivo dura tres minutos y una
sesión exploratoria dura una hora y toca cosas que no hacía falta tocar.

```bash
# Desde el PADRE, que es el único origen que el firewall de la instancia acepta
ssh soporte@<ip-de-la-instancia>
```

Si eso se rechaza, comprueba en este orden: que tu llave esté en el inventario
(`infra/acceso/personas.yml`), que el `ufw` de la instancia permita el 22 desde el
PADRE, y sólo entonces la consola web con su anotación.

**Lo primero dentro, siempre, y en este orden:**

```bash
# 1 · Qué dice el actualizador de su última corrida. Casi siempre está aquí
sudo tail -60 /var/log/space-os/update.log
```

```bash
# 2 · El contenedor: si está, desde cuándo, y con qué imagen
sudo docker ps -a --format '{{.Names}} | {{.Image}} | {{.Status}}'
```

```bash
# 3 · Y si está caído, por qué murió
sudo docker logs --tail 50 space-os
```

```bash
# 4 · Disco. Un disco lleno se disfraza de todo lo demás
df -h /
```

```bash
# 5 · La base responde
sudo -u postgres psql -d spaces -tc 'select 1'
```

### Lo que NO se hace dentro, nunca

- **No se edita código en el servidor de una instancia.** Todo nace en el PADRE y
  llega por `update.sh`. Un parche a mano hace que la máquina deje de ser
  reproducible y que la siguiente actualización lo borre sin avisar.
- **No se corren migraciones a mano.** Las aplica el actualizador, con su respaldo
  previo y su huella de la base. A mano no hay ninguna de las dos cosas.
- **No se tocan datos del cliente para «arreglar» algo** sin dejarlo escrito en
  `docs/datos/` con su rollback capturado **antes**, que es la regla del proyecto.
- **No se desactiva el guard del arnés ni el firewall** para que algo pase.

---

## Paso 4 · Cerrar

1. **Sal de la sesión.** El registro de acceso anota la duración, y una sesión
   abierta y olvidada es una línea que dice que estuviste dentro toda la noche.
2. **Escribe qué pasó.** Si se tocó algo que se nota desde la aplicación, va a
   `docs/Registro_Cambios.md` en lenguaje llano. Si fue un cambio de datos, a
   `docs/datos/`.
3. **Si la causa está en el código, la corrección no se aplica aquí**: se hace en
   el PADRE, sale en una versión, pasa por DEMO y llega por `update.sh`. Ese es el
   modelo entero.
4. **Si el incidente destapó un defecto de este runbook, corrígelo.** Los doce
   defectos del camino de aprovisionamiento aparecieron así, y seis sólo al
   ejecutar.

---

## Si el cliente pide su registro de accesos

Tiene derecho por contrato y **se conserva un año** (ADR 0025 §4 y ②).

Se le entrega **sólo el tramo de su instancia**, nunca el de la flota. El envío
escribe una ruta por instancia justamente para que atender esta petición no
consista en filtrar a mano — filtrar a mano es como se filtra de más.

> [!warning] Y ojo con lo que se le promete
> El registro dice **quién entró, cuándo, desde dónde y cuánto duró**. **No dice
> qué se hizo dentro**: no hay grabación de sesión. Es correcto decir «cada acceso
> por SSH queda registrado»; **no** es correcto decir «sabemos todo lo que se
> hizo». La tabla de la superficie de auditoría del ADR 0025 lo detalla.

---

## Lo que este runbook todavía no puede hacer, y hay que saberlo

Se escribe en vez de omitirse, porque descubrirlo durante un incidente es peor.

- **El registro de accesos no está construido todavía** — es el punto 4 del ADR
  0025 y depende de que Spaces se configure (`SPACES_KEY` está vacío). Hasta
  entonces, **anota tus sesiones a mano**.
- **Los logs no salen del droplet**, así que el paso 3 es hoy la única forma de
  leer el `update.log` de una instancia. Ese es justo el motivo por el que el ADR
  0025 pone el envío como requisito y no como mejora.
- **El respaldo tampoco sale del droplet**: si la máquina se pierde, el dump se
  pierde con ella (medido el 02/09 en
  `docs/evidencias/f3-5-demo-instancia-20260902.md`). En un incidente de máquina
  perdida, **hoy no hay de dónde restaurar**. Es el otro frente abierto de la
  auditoría del 01/09.
- **`soporte`, el firewall restringido y el inventario de llaves son la decisión
  del ADR 0025, no el estado de hoy.** Hoy se entra como `root` y el 22 está
  abierto al mundo (`setup-droplet.sh:84-87`). Mientras eso siga así, el `ssh
  soporte@` del paso 3 es `ssh root@`.
