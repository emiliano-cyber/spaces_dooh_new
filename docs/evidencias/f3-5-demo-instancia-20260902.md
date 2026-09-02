---
Para: quien retome el modelo de instancias soberanas
De: la ejecución del 2026-09-02
Qué cierra: **F3.5** — el ensayo real de `update.sh` contra una instancia
Medido: en el PADRE (`137.184.107.53`), no simulado
---

# F3.5 · DEMO deja de ser el repo y pasa a ser un contenedor

## Qué se hizo, en una frase

El proceso del **3001** dentro del PADRE dejó de ser `next start` sobre el repositorio
clonado y pasó a ser **un contenedor desde la imagen del registro**, con su
`update.sh` y su cron — el mismo camino exacto que recorrerá la instancia de un
cliente.

**Y eso es lo que convierte a F3.5 en «hecha» y no en «simulada»:** el ensayo del
18/08 fue en WSL con un `docker pull` doblado. Este usó registro real,
autenticación real, digest real y una migración real sobre una base con historia.

---

## Lo que quedó demostrado, con la línea del log

Todo sale de `/var/log/space-os/update.log`, corrida de las **16:30:22 UTC**.

| Qué | Evidencia |
|---|---|
| Registro real | `registro: autenticado en registry.digitalocean.com` · digest `sha256:6494bbca…` |
| El runner viaja en la imagen | `runner: el de la imagen (/app/scripts/migrar.mjs)` — no se montó nada |
| **Respaldo antes de migrar** | `respaldo de 177135 bytes` — **ya no vacío**; cierra el defecto 10 |
| La `@tipo: datos` se omite sola | `omitida (migracion de DATOS, pidela con --con-datos): 20260731_calendario_meses_cortos.sql` |
| Migración aplicada | `== 20260901_doohmain_tracking.sql` → `1 aplicadas, 1 de datos pendientes.` |
| **La huella, no la prosa** | `74` → `75`, `cambio=si`, esquema `f642b4db…` estable y registro `047c9e7e…` → `c4b641cf…` |
| Salud con reintentos | `intento 1/10 -> 000`, luego `200 en el intento 2/10` |
| Conmutación | `OK: v0.3.0 sirviendo.` |
| **Idempotencia** | 2.ª corrida a las 16:33: `sin cambios: la instancia ya corre v0.3.0` |
| Desde fuera | `https://prueba.space-os.io/spaces-dooh/login/` → **200**; `…/api/auth/metodos/` → **200** |

> [!success] La cuenta final es **75**, y el 76 que se anunció antes era un error
> `scripts/migrar.mjs:7`: las `@tipo: datos` entran **solo** con `--con-datos`, y
> `update.sh` no la pasa a propósito — una migración de datos la decide una persona.
> Así que 74 + la de esquema = 75, y `20260731_calendario_meses_cortos.sql` **sigue
> pendiente por diseño**, no por olvido.

> [!note] `{"ok":true}` en `/api/version/` es la respuesta CORRECTA
> `apps/web/app/api/version/route.ts:95-97` solo revela versión, canal y última
> migración **al panel autenticado**. La sonda de salud recibe su 200 y no se filtra
> nada. Para que DEMO reporte su versión hace falta `FLOTA_TOKEN` en su `app.env`.

---

## D1 de F3.4 queda enterrado, y con el caso que lo mataba

El dry-run listó **dos** pendientes, y una era `20260731_calendario_meses_cortos.sql`
— **el archivo del defecto D1**: cuando `update.sh` decidía si restaurar leyendo la
prosa del runner, una `@tipo: datos` pendiente hacía caer la cuenta a 0 y la vuelta
atrás anunciaba que no había nada que restaurar, de forma permanente y muda.

**Comprobado contra el código y contra la corrida:** `update.sh:1529/1543` toma una
**huella de la base** antes y después, y la decisión de restaurar sale de comparar
las dos (`:1829`). El log lo enseña haciéndolo: `huella previa: … 74` → `huella: … 75`
→ `cambio=si`. La prosa del runner ya no gobierna nada.

Que ese archivo estuviera pendiente hizo el ensayo **más** valioso, no más peligroso.

---

## Los cuatro defectos que aparecieron ejecutando

Ninguno se veía leyendo. Van del 11 al 12 del camino de aprovisionamiento, más dos
que eran míos, en la tarjeta.

### 11 · `systemctl disable` BORRA la unidad de DEMO, no la apaga

`systemctl is-enabled spaces-demo` respondió **`not-found`**, no `disabled`. La
unidad es un **symlink al repo** (`docs/evidencias/bloque-2-comandos.txt:166`), así
que systemd la trata como *linked* y `disable` retira el symlink entero.

**Por qué importaba:** la vuelta atrás escrita en las dos tarjetas
—`systemctl enable --now spaces-demo`— **fallaba**. La red de seguridad no existía, y
se habría descubierto intentando usarla. Reenlazar antes lo arregla, y **aplica igual
a `spaces-web`**, el PADRE.

### 12 · `instancia.env` se SOURCEA: los valores con espacios van entrecomillados

`update.sh:700` hace `. "$CONF"`. La tarjeta escribió
`DOCKER_OPCIONES_APP=--network host` sin comillas, así que bash asignó
`DOCKER_OPCIONES_APP=--network` y **ejecutó `host`** —el de DNS—, que sin argumentos
sale con 1, y el script corre con `set -e`. El `--dry-run` respondió con **la ayuda
del comando `host`**, un mensaje que no menciona el archivo, ni la variable, ni las
comillas.

Eran **dos**: `PULL_ESPERAS=1 5 30` tenía lo mismo. La plantilla real
(`infra/env/instancia.env.example:69`) las trae bien las dos, **así que el fallo fue
escribir el archivo a mano en vez de copiarlo de la plantilla.**

La puerta que lo caza cuesta una línea y va en un subshell:

```bash
bash -c 'set -e; . /etc/space-os/instancia.env; echo "[$DOCKER_OPCIONES_APP] [$PULL_ESPERAS]"'
```

---

## Lo que este ensayo NO probó — y conviene decirlo

- **Crear un droplet desde cero.** No se instaló PostgreSQL en una máquina virgen, ni
  se aplicó el esquema a una base vacía, ni se entregó DNS. Eso es **F5.6**, y sigue
  sin hacerse nunca.
- **La vuelta atrás completa del contenedor.** El log dice
  `no hay contenedor 'space-os-demo' corriendo: no habra a donde volver` — era la
  primera corrida. `update.sh:1818` sale **antes** del bloque que restaura la base si
  no hay versión anterior, así que en esa situación la base se queda migrada. La
  segunda corrida de DEMO ya tendrá contenedor anterior y esa rama sí se podrá
  ensayar.
- **El coste incremental del registro.** El digest no cambió (la imagen ya estaba
  descargada), así que este ensayo no dice nada del almacenamiento. Sigue pendiente
  desde el 31/08.

---

## Dos avisos del propio log que apuntan al bloqueante de soporte

No son de esta tarea, pero salieron aquí y valen escritos:

> `respaldo remoto NO CONFIGURADO: faltan SPACES_KEY/SPACES_SECRET. Esta instancia NO
> tiene respaldo fuera del droplet: si la maquina desaparece, el dump desaparece con
> ella.`

> `log remoto NO CONFIGURADO … diagnosticarla exige entrar al servidor del owner.`

En DEMO da igual: vive en el PADRE. **En la instancia de un cliente son otra cosa** —
el primero es pérdida de datos ante un fallo de máquina, y el segundo dice que
diagnosticar significa **entrar a los datos del negocio del cliente**. Es la 🔴
BLOQUEANTE 2 de la auditoría del 01/09 asomando por el log, y sigue sin construirse.

---

## Estado del plan tras esto

**Quedan DOS tareas**: `F5.6` (ensayo del alta en un droplet desechable) y `F5.7`
(alta de PIXELED). Las dos son de servidor y las corre una persona.

Y `F5.6` es ahora la que más riesgo retira, porque es lo único que este ensayo no
pudo tocar: la primera vez que `provision-instancia.sh` cree un droplet de verdad no
debería ser con el cliente esperando.
