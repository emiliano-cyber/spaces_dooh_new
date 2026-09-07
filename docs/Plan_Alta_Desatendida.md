# Plan — el alta desatendida

> **Qué implementa:** el [ADR 0029](adr/0029-el-alta-desatendida-y-la-maquina-de-estados.md).
> **Estado:** propuesto el 2026-09-07, **sin aprobar para ejecución**.
> **De dónde sale:** del primer alta real desde el panel (2026-09-07), que llegó a
> `esperando-dns` en 6 min 02 s y dejó cuatro pasos a mano.

---

## La regla que ordena todo el plano

**El arnés va antes que la automatización.** No es preferencia: está medido. Seis defectos
en un día (31–36), todos en `provision-instancia.sh`, que es **el único guion grande sin
arnés de pruebas** y el que crea las máquinas de los clientes. Su hermano `update.sh` tiene
un arnés de 126 KB —más grande que el propio guion— y por eso sus fallos se cazan antes de
producción.

Automatizar sobre un guion sin pruebas convierte un fallo **con una persona delante** en un
fallo **desatendido en la máquina de un cliente**.

Por eso la Fase 1 no automatiza nada.

---

## Fase 0 · Lo que se puede hacer ya, sin riesgo y sin arnés — ✅ **HECHA**

Estas dos no tocan `provision-instancia.sh` y no pueden dejar una instancia peor: si fallan,
el alta queda exactamente como hoy.

> **Las dos cerradas el 2026-09-07**, con 17 casos nuevos: `apps/flota` pasa de **116 a 133
> pruebas** en 10 archivos.

### A0.1 · Las comprobaciones van dentro de la solicitud `[código]` — ✅ hecha

- **Objetivo:** que el resultado de un alta sea auditable tres semanas después, y no solo
  mientras el `journalctl` lo conserve.
- **Archivos:** `apps/flota/comprobaciones.mjs` (nuevo), `comprobaciones.test.ts` (nuevo),
  `altas.mjs`.
- **Qué hace:** al terminar un alta, ejecuta `login`, `signup` y `login-post` y las guarda
  en la solicitud, en `comprobaciones`, con su hora en el historial.

> [!warning] Corrección al escribir esta tarea: van sobre `http://`, no `https://`
> Este plan las describía como las del paso 5 de la tarjeta, que son sobre `https`. **No
> pueden funcionar ahí:** cuando el alta termina **todavía no hay certificado** —el vhost es
> de solo HTTP hasta que se emite— así que por `https` darían un fallo de red y no dirían
> nada de la aplicación. Sobre `http` sí, y dicen lo mismo. Las de `https` son la puerta 2
> del paso del certificado, y esas son de la Fase 2.
>
> Y una consecuencia que hay que saber leer: **si el dominio es del owner y aún no lo ha
> apuntado, los tres salen `0`.** Eso no es un fallo del alta, es la foto de ese momento.

- **Probado primero y en rojo.** 9 casos, **cinco negativos**: un código inesperado queda
  **anotado** y no descartado; una petición que revienta se anota `0` y **las otras dos
  siguen** —una comprobación que se lleva por delante a las demás deja ciego—; nunca lanza
  aunque todo falle; el intento de login usa un dominio **reservado por la RFC 2606**, para
  que no sea un acceso válido registrado en la máquina de un cliente; y un **200 en
  `signup` NO es ok**, que es la lectura al revés más fácil de cometer.
- **Y un fallo mío de camino, que vale anotar:** los tres primeros rojos eran de mi
  *fixture*, no del código — el doble de `fetch` casaba por `includes`, y la clave `/login/`
  casa también con `/api/auth/login/`. Un doble demasiado laxo da rojos que no existen, y
  del mismo modo puede dar verdes que tampoco.

### A0.2 · El token de flota se entrega por archivo `[código + infra]` — ✅ hecha (código)

- **Objetivo:** que una instancia nueva aparezca en el panel **sin reiniciarlo** y sin que
  el ejecutor tenga que escalar privilegios. Punto 6 del ADR 0029.
- **Archivos:** `apps/flota/estado.mjs` (segunda fuente de tokens), `apps/flota/estado.test.ts`,
  `apps/flota/README.md`.
- **Qué hace:** `tokenDe()` pasa a mirar, en este orden: el entorno
  (`FLOTA_TOKEN_<NOMBRE>`), luego `/etc/space-os/flota-tokens.env` si existe, y luego el
  `FLOTA_TOKEN` compartido. **La ruta entra por parámetro**, para poder probarla sin tocar
  `/etc`.
- **Prueba que falla primero:** tres casos, **dos negativos** — que el entorno gana sobre el
  archivo (para poder anular uno malo sin editar el archivo); que un archivo ausente **no
  es un error** sino ausencia de token; y que un archivo ilegible tampoco tumba el panel,
  como ya hace `listar()` con un JSON roto.
- **Criterio:** con el archivo puesto, `estado.mjs` reconoce la instancia sin reinicio; sin
  archivo, se comporta exactamente como hoy.
- **Y la parte de servidor, que corre una persona:** crear el archivo `altas:flota` **640**
  y comprobar que `otros` **no** puede leerlo. Va como tarjeta.
- **Commit:** `feat(flota): los tokens de instancia entran tambien por archivo`

---

## Fase 1 · El arnés de `provision-instancia.sh` — el prerrequisito

> **Nada de la Fase 2 se empieza antes de cerrar esta.** Es la regla del ADR 0029, punto 7.

### A1.1 · Arnés base, con los seis defectos de hoy como casos `[pruebas]`

- **Objetivo:** que los defectos 31–36 no puedan volver, y que exista dónde poner el
  siguiente.
- **Archivos:** `infra/scripts/pruebas-provision.sh` (nuevo), al lado de
  `pruebas-update.sh`, con su misma forma.
- **Los seis casos, que ya sabemos que fallaban:**
  1. `--emitir-certificado` y `--bootstrap` **sin** `REGISTRY` ni `REGISTRY_TOKEN` → llegan
     y simulan (defecto 31).
  2. `CERTBOT_EMAIL` ausente → se para **antes** de tocar nada, y lo dice (32).
  3. Un `ssh` que falla → el mensaje **no** habla del `BOOTSTRAP_TOKEN` (33).
  4. La comprobación del certificado con un código distinto de 200 → **sale con error** (34).
  5. Un aprovisionamiento completo → **la aplicación queda levantada**, no esperando al cron (35).
  6. El bootstrap con 404 y con 500 → **no** afirma que la organización existe (36).
- **Cómo, sin servidores:** el arnés sustituye `ssh`, `doctl` y `curl` por dobles en el
  `PATH`, igual que hace `pruebas-update.sh` con `docker`. **Ningún caso toca una máquina
  remota ni gasta un céntimo**, y eso es un criterio de aceptación, no un detalle.
- **Criterio:** los seis casos en verde, y **cada uno demostrado en rojo** revirtiendo su
  arreglo antes de darlo por bueno.
- **Commit:** `test(altas): el arnes de provision-instancia, con los seis de hoy dentro`

### A1.2 · El arnés entra en CI `[infra]`

- **Objetivo:** que corra en máquina limpia y no solo en la de quien lo escribió.
- **Archivos:** `.github/workflows/ci.yml`.
- **Criterio:** un PR que rompa cualquiera de los seis casos **se pone rojo solo**.
- **Depende de:** A1.1.

---

## Fase 2 · La máquina de estados

### A2.1 · `esperando-dns` deja de ser terminal `[código]`

- **Archivos:** `apps/flota/cola.mjs`, `apps/flota/ejecutor.mjs`, `apps/flota/altas.mjs` y sus pruebas.
- **Qué hace:** nace `siguienteQueAvanza()`, hermana de `siguientePendiente()`. La regla de
  **UNA A LA VEZ** no cambia: sigue siendo `en-curso` lo que bloquea.
- **Prueba que falla primero:** **cuatro casos, tres negativos** — una `esperando-dns` se
  retoma; una `fallida` **no**; una `lista` **no**; y con una `en-curso` presente **no se
  retoma ninguna**, que es la regla que impide dos altas en paralelo.
- **Criterio:** el temporizador avanza una solicitud por pasada y jamás dos a la vez.
- **Depende de:** A1.1.
- **Commit:** `feat(altas): el ejecutor retoma las solicitudes que esperan DNS`

### A2.2 · El DNS se comprueba y no se espera `[código]`

- **Qué hace:** cada pasada resuelve el dominio y compara con la IP anotada. Si no coincide,
  **no cambia nada**: coste cero, y una solicitud puede esperar días.
- **Prueba que falla primero:** **dos negativos** — un dominio que no resuelve deja la
  solicitud **intacta** (ni la avanza ni la falla); y un dominio que resuelve a **otra IP**
  tampoco avanza, y lo anota. Ese segundo caso es el que evita emitir un certificado sobre
  la máquina de otro.
- **Depende de:** A2.1.

### A2.3 · El certificado, con la cuota en el estado `[código]`

- **Qué hace:** `emitiendo-cert` lleva intentos y hora del último. **Máximo 3 por hora**, y
  al agotarse pasa a `cert-agotado`, que **no reintenta** y espera a una persona.
- **Prueba que falla primero:** **tres negativos** — al 4.º intento en la misma hora **no
  se llama a certbot**; una `cert-agotado` **no** se retoma nunca; y el contador **sobrevive
  a releer el archivo**, porque un límite que se pierde al reiniciar no es un límite.
- **Por qué 3 y no 5:** Let's Encrypt permite cinco por hora y por dominio. Dejar dos de
  margen es lo que permite que una persona lo intente a mano cuando el automático se rinde.
- **Depende de:** A2.2, **A1.1 y A1.2 cerradas**.

### A2.4 · Que el panel cuente el recorrido `[código]`

- **Qué hace:** la pantalla de altas enseña el estado, la hora, el motivo si falló y los
  intentos de certificado. Es lo que hace soportable tener cinco estados en vez de dos —
  la consecuencia negativa que el ADR 0029 declara.
- **Depende de:** A2.1.

---

## Fase 3 · El último tramo, y no depende de este plan

### A3.1 · El bootstrap sin persona `[bloqueada]`

- **Bloqueada por:** el **ADR 0028**. Crear la primera empresa produce la contraseña del
  Dueño, y esa tiene que llegarle a él.
- **Con el ADR 0028 construido, esta tarea DESAPARECE**: el Dueño entra con Google y no hay
  contraseña que entregar. No es que se automatice mejor — es que deja de existir el paso.
- **La otra salida** es correo saliente en el PADRE, que hoy no existe ni como variable.
- **No se planifica aquí**, y se dice para que nadie la busque: mientras eso no esté,
  `lista` significa *«servida y con certificado, a falta de la primera empresa»*.

---

## Lo que este plan NO hace, dicho a propósito

- **No automatiza el DNS del owner.** Es su zona. Automatizarlo exigiría que nos delegara
  las llaves de su DNS, y eso cambia la promesa del producto (alternativa D del ADR 0029).
- **No añade ni una dependencia npm** a `apps/flota`. Es la razón de descartar un motor de
  trabajos.
- **No toca la regla de UNA A LA VEZ.** Sigue siendo lo que impide que dos altas compitan
  por el mismo `doctl` y la misma clave.
- **No toca `aislamiento.e2e.test.ts`.** Si alguna tarea obliga a abrirlo, esa tarea está
  mal.

## Y una condición previa que no es técnica

Antes de la Fase 2 hay que **decidir si `DO_SSH_KEYS` lleva también la clave de `padre`**.
Hoy no la lleva, y por eso una instancia creada por el panel **solo la alcanza `altas`** —
medido el 07/09, con `Permission denied (publickey)` desde root del PADRE. Eso choca con el
camino de soporte del [ADR 0025](adr/0025-acceso-de-soporte-a-una-instancia.md), que da por
hecho que una persona salta desde el PADRE cuando hay una avería.

Automatizar más pasos sobre máquinas a las que **ninguna persona puede entrar** es
construir sobre eso sin haberlo resuelto.
