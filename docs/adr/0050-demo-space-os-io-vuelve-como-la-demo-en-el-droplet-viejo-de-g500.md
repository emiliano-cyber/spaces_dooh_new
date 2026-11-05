# ADR 0050 — `demo.space-os.io` vuelve: es la DEMO, servida por el droplet viejo de g500

- **Fecha:** 2026-11-05
- **Estado:** Aceptada
- **Decide:** Emiliano (dueño), 2026-11-05
- **Sustituye a:** [ADR 0024](0024-demo-space-os-io-es-la-demo-original-y-se-elimina.md)
- **Relacionadas:** [ADR 0015](0015-demo-dentro-del-padre.md) ·
  [ADR 0017](0017-todo-se-concentra-en-el-padre.md) ·
  [ADR 0021](0021-demo-space-os-io-se-queda.md) ·
  [ADR 0022](0022-instancia-dedicada-por-owner.md) ·
  [ADR 0023](0023-el-droplet-viejo-sale-del-modelo.md) ·
  guía `docs/evidencias/31-g500-viejo-como-demo-20261105.md` ·
  guía `docs/evidencias/30-mudar-g500-a-droplet-limpio-20261104.md`

> [!important] Esto REVIERTE el 0024, y lo dice a propósito
> El 0024 cerró el asunto con la frase «no se vuelve a preguntar ni se vuelve a
> deducir». Este ADR no lo deduce: lo **decide el dueño** el 05/11, con dos
> hechos nuevos que el 0024 no tenía (abajo). Lo que manda es el ADR con el
> número más alto que trate el nombre, y desde hoy es **este**.

---

## Contexto

El 0024 (27/08) decidió que `demo.space-os.io` era solo la demostración
**original** —la de la máquina de julio, `209.97.146.136`—, que no se movía a
ninguna parte y que se eliminaría cuando naciera la primera instancia de owner.
La DEMO de verdad, el banco de pruebas del canal `beta`, quedó dentro del PADRE
como contenedor `space-os-demo` con el nombre nuevo `prueba.space-os.io`
(ADR 0015/0017, conversión del 02/09).

Dos cosas cambiaron desde entonces:

1. **Hay una máquina libre, del tamaño justo y ya pagada.** La mudanza de g500
   del 04/11 (guía 30) dejó a g500 en el droplet nuevo `gh500` y el viejo
   (`142.93.113.106`, NYC1, 2 GB) **apagado e intacto**, «seguro de encender»
   (D13 de esa guía) y pensado desde el principio para reutilizarse como DEMO
   (guía 30 §6).
2. **La DEMO dentro del PADRE arrastra tres defectos conocidos**, todos escritos
   en `vault/01-Arquitectura/entorno-y-despliegue.md`:
   - **no es una instancia como las demás**: comparte máquina, roles de Postgres
     y directorio de respaldos con el PADRE, y por eso cada guion necesita
     `SPACE_OS_CONF=/etc/space-os/demo-instancia.env` delante (guía 12 §B: sin
     él se respalda **la base equivocada sin error**);
   - **su certificado no se renueva**: `prueba.space-os.io` va en el mismo
     certificado que `space-os.io`, que se renueva por `webroot`, y el ápice ya
     no resuelve al PADRE. **Caduca el 2026-11-29** y desde ~el 30/10 certbot
     falla al renovarlo. Con él caducado, `promover.yml` no puede hacer su
     smoke y **no se puede promover nada a `estable`**;
   - lo que se valida en ella **no es lo que corre un owner**: un owner está en
     su propio droplet, solo, con `/etc/space-os/instancia.env` y nginx de
     `instancia.conf.tpl`. La DEMO dentro del PADRE no.

## Decisión

1. **El droplet viejo de g500 se convierte en la DEMO**, instalada **como una
   instancia de owner más** —`provision-instancia.sh`, `/etc/space-os/instancia.env`,
   `update.sh` por cron— con la única diferencia de que sigue el canal **`beta`**
   (invariante 13: nada llega a un owner sin pasar antes por aquí).
2. **Su nombre es `demo.space-os.io`**, con registro A a `142.93.113.106` en
   Cloudflare (nube gris) y certificado propio emitido en esa máquina.
3. **Antes de servir nada, se le quita la identidad de g500** entera: ni sus
   secretos (`FLOTA_TOKEN`, claves de Spaces con prefijo `g500/`, DOOHmain real,
   Google, Resend, Maps), ni su base, ni los volúmenes de Space Eyes con datos de
   un cliente, ni el material de la mudanza. La guía 31 recomienda reinstalar el
   disco desde cero (*Rebuild*) en vez de vaciarlo a mano.
4. **Sus datos son de demostración**: base nueva con las semillas del
   repositorio (`scripts/semilla-demo.mjs` y `scripts/semilla-catalogo-demo.mjs`),
   nada copiado de g500 ni de otra base real.
5. **`DEMO_URL` pasa a `https://demo.space-os.io/spaces-dooh`** cuando la DEMO
   nueva corra la versión que se vaya a promover. Hasta entonces se promueve con
   la DEMO del PADRE (la v0.12.6 se promueve así, el 05/11).
6. **Qué pasa con `prueba.space-os.io` y el contenedor `space-os-demo` del PADRE
   queda para decidir después** de la primera promoción con la DEMO nueva. La
   guía 31 deja escrito cómo apagarlo de forma reversible.

### Lo que esto retira del 0024

| | El 0024 decía | Ahora |
|---|---|---|
| `demo.space-os.io` | Demostración original; se eliminará | **Es la DEMO** (banco de pruebas `beta`) |
| Máquina que lo sirve | La de julio, `209.97.146.136`, hasta eliminarlo | El droplet viejo de g500, `142.93.113.106` |
| Certificado | No se renueva ni se reemite | **Se emite y se renueva** en esa máquina (`certbot --webroot`, como toda instancia) |
| «La demostración de las instancias hijas será una instancia hija de verdad» | La primera de `F5.7` | **Se cumple ya**: la DEMO es una instancia instalada como las de owner |
| `F4.3` (dominio y certificado de DEMO) | Sin objeto | Sigue **sin objeto** como tarea del plan v3 (pedía DEMO **dentro del PADRE**); el trabajo equivalente lo hace la guía 31 |

## Alternativas consideradas

### A · Dejar la DEMO en el PADRE y arreglar su certificado

Dar a `prueba.space-os.io` un certificado propio, como se hizo con
`spaceos.space-os.io` el 01/10. Barato y arregla el plazo del 29/11. **Se
descarta** porque deja los otros dos defectos: la DEMO sigue sin parecerse a una
instancia de owner y sigue compartiendo máquina y respaldos con el plano de
control.

### B · Un droplet nuevo para la DEMO y destruir el viejo

Lo mismo que esta decisión, en una máquina limpia. **Se descarta por coste y
porque no aporta**: si el viejo se reinstala desde cero (*Rebuild*, que conserva
la IP), queda igual de limpio que uno nuevo.

### C · Usar el viejo como DEMO conservando lo que tiene (base de g500 vaciada)

Más rápido, pero un disco que tuvo los datos de un cliente, sus secretos y su
base en claro (`/root/g500-mudanza/`) solo queda limpio si alguien acierta con
la lista entera de lo que hay que borrar. La guía 31 lo admite como camino B,
con su comprobación, pero **recomienda el *Rebuild*** por esto.

## Consecuencias

### Positivas

- **La DEMO valida lo que corre un owner**: mismo instalador, misma
  configuración, misma plantilla de nginx, mismo cron. Lo que falle en una
  instancia nueva falla antes aquí.
- **Desaparece `SPACE_OS_CONF`** de las guías de publicación: en la DEMO nueva
  `update.sh` lee su `instancia.env` de siempre.
- **El plazo del 29/11 deja de bloquear las promociones** en cuanto `DEMO_URL`
  apunte al nombre nuevo.
- **El PADRE pierde una carga** (proceso, base `spaces_demo`, cron, respaldos)
  cuando se retire la DEMO de dentro.

### Negativas

- **Una máquina más que mantener y pagar** (la que ya se pagaba apagada).
- **Se pierde la vuelta atrás de la mudanza de g500**: el disco viejo era la
  última copia completa fuera de `gh500`, **incluidas las fotos y el MySQL de
  Space Eyes, que no tienen respaldo fuera del droplet** (guía 30 §7). Lo
  pregunta la guía 31 antes de borrar.
- **Durante la transición hay dos DEMO** (`prueba.` en el PADRE y `demo.` en el
  viejo). Una publicación tiene que actualizar las dos hasta que se retire una.

### Implicaciones de seguridad

- **Un disco con datos y secretos de un cliente pasa a ser una máquina pública
  de demostración.** Es el riesgo central y lo cubre el paso 2 de la guía 31,
  con verificación (*Rebuild*, o vaciado con `grep` de los valores de los
  secretos sin imprimirlos).
- **Ningún secreto de g500 se reutiliza**: la DEMO nace con claves de Postgres,
  `BOOTSTRAP_TOKEN` y `FLOTA_TOKEN` nuevos (`provision-instancia.sh`), sin
  credenciales de Spaces de g500, sin DOOHmain real, sin Google ni Resend de g500.
- **La IP `142.93.113.106` fue de g500.** Cualquier lista de IP permitidas que
  la nombre (la clave de Google Maps de servidor, si alguna la tuviera; un filtro
  por origen en DOOHmain, si existiera) dejaría a la DEMO hablar en nombre de
  g500. La guía 31 lo revisa.
- **HSTS con `includeSubDomains`** en `space-os.io`: `demo.` tiene que servir
  siempre un certificado válido o el navegador no deja ni saltarse el error.

## Cómo revertir

- **Antes de cambiar `DEMO_URL`**: no hay nada que revertir en el flujo de
  publicación; basta con no usar la DEMO nueva.
- **Después**: `DEMO_URL` de vuelta a la DEMO del PADRE (si sigue viva y con
  certificado), y el registro A de `demo` borrado o apuntado a otra parte.
- **Lo irreversible** es el paso 2 de la guía 31: una vez reinstalado o vaciado
  el disco, los datos de g500 que solo estuvieran ahí no vuelven.

## Cuándo revisar

Tras la **primera promoción a `estable` validada contra la DEMO nueva**: es el
momento de decidir el destino de `prueba.space-os.io` y del contenedor
`space-os-demo` del PADRE.
