# Diseño · el alta en droplet propio, y la licencia firmada

- **Fecha:** 2026-09-10
- **Estado:** aprobado por Emiliano en la sesión del 10/09
- **Decisión de negocio:** [ADR 0032](../../adr/0032-el-alta-en-droplet-propio-del-cliente.md)
- **Rama:** `feat/alta-droplet-propio` — `main` no se toca
- **Alcance:** `infra/scripts/` (nuevo instalador, `update.sh`), `infra/nginx/`,
  `infra/licencias/` (nueva), `apps/web` (sólo el aviso), `apps/flota` (un código
  de salida más)
- **Riesgo:** 🔴 introduce un mecanismo que **apaga instancias de clientes**, y
  🟡 toca `update.sh`, que es la ruta crítica de toda la flota

---

## 1 · El problema, y por qué ahora

SPACE OS se vende hoy de una sola manera: nosotros creamos el droplet en **nuestra
cuenta de DigitalOcean**, lo aprovisionamos por SSH y lo mantenemos. El cliente
no crea nada y no puede comprobar nada por sí mismo.

El 2026-09-10 Emiliano decidió abrir un **segundo camino de venta**: el cliente
crea y paga su propio droplet, y nosotros le entregamos el sistema encima. El
ADR 0032 recoge la decisión y sus consecuencias; este documento describe **cómo
se construye**.

Los dos caminos conviven. Un hijo es un hijo — `g500`, `DEMO` y los que vengan
corren la misma imagen; lo que cambia es por qué camino nacieron.

---

## 2 · Las cinco piezas, y dónde vive cada una

| Pieza | Dónde | Qué hace |
|---|---|---|
| **Par de llaves** | privada en el PADRE (cifrada); pública en el repositorio | firmar y comprobar licencias |
| **`firmar-licencia.mjs`** | PADRE, lo corre una persona | emite y renueva licencias |
| **La comprobación** | `update.sh`, en cada hijo | decide: sana, aviso, gracia o apagado |
| **La página de vencimiento** | nginx, en cada hijo | lo que se ve cuando está apagado |
| **El aviso** | `apps/web`, en el shell | la banda dentro del sistema |
| **`instalar-hijo.sh`** | corre **dentro** del droplet del cliente | el alta que hace él |

Y la regla que las ordena, del ADR 0032 punto 5: **`update.sh` apaga, la
aplicación avisa.** La aplicación nunca bloquea nada y nunca comprueba una firma.

---

## 3 · La licencia

### 3.1 · Qué es, y por qué es legible

Dos archivos en `/etc/space-os/licencia/`:

```
licencia.json     el contenido, en JSON legible por una persona
licencia.firma    la firma Ed25519 de ese archivo, en binario
```

`licencia.json`:

```json
{
  "instancia": "pixeled",
  "dominio": "pixeled.ejemplo.com",
  "emitida": "2026-09-10",
  "vence": "2027-09-10",
  "aviso_dias": 30,
  "gracia_dias": 15
}
```

**Legible a propósito.** El cliente puede abrirlo y ver exactamente qué se le ha
concedido y hasta cuándo. Un archivo opaco no compraría nada —la firma es lo que
lo sujeta, no la ofuscación— y sí costaría confianza en una venta que se llama
soberana.

**`instancia` y `dominio` están dentro y los cubre la firma.** Copiar la licencia
a un segundo droplet no funciona: `update.sh` compara los dos campos con su
propia configuración, y cambiarlos invalida la firma.

### 3.2 · Ed25519, y `openssl` como única herramienta

La firma es **Ed25519**, y se comprueba con el `openssl` que ya está en el
droplet:

```sh
openssl pkeyutl -verify -pubin -inkey "$LICENCIA_PUB" \
        -rawin -in "$LICENCIA_JSON" -sigfile "$LICENCIA_FIRMA"
```

Ed25519 y `-rawin` están en OpenSSL 3.0, que es el de Ubuntu 22.04 — la versión
que `setup-droplet.sh` da por supuesta. **No entra ninguna dependencia nueva en
el droplet**, que es la misma razón por la que `update.sh` se niega a usar `jq`.

**El orden importa: primero se comprueba la firma, después se leen los campos.**
Leer un JSON sin firmar y decidir con él sería confiar en un archivo que
cualquiera puede escribir.

### 3.3 · Cómo se leen los campos sin `jq`

Con `grep -o` sobre claves conocidas, **después** de que la firma haya pasado:

```sh
campo_licencia() {   # $1 = nombre del campo
  grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$LICENCIA_JSON" \
    | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
}
```

Es un analizador pobre y es suficiente: el archivo lo escribimos nosotros, su
forma es fija, y la firma garantiza que nadie la ha cambiado. Los numéricos
(`aviso_dias`, `gracia_dias`) llevan su propia función sin comillas.

**Si un campo falta o no se puede leer, se trata como licencia inválida.** No se
inventa un valor por omisión: una licencia a medias es una licencia rota.

### 3.4 · Los cuatro estados

Con `hoy`, `vence`, `aviso_dias` y `gracia_dias`, en segundos desde época
(`date -d "$vence" +%s`):

| Estado | Cuándo | Qué pasa |
|---|---|---|
| `sana` | `hoy < vence - aviso_dias` | **silencio**. Ni banda ni línea en el log |
| `aviso` | `vence - aviso_dias ≤ hoy < vence` | banda discreta en el sistema |
| `gracia` | `vence ≤ hoy < vence + gracia_dias` | **sigue funcionando**, banda imposible de ignorar |
| `vencida` | `hoy ≥ vence + gracia_dias` | el contenedor no se levanta |

El silencio del estado sano es el mismo criterio que el panel de flota: **si algo
está bien, no se dice nada.**

---

## 4 · `update.sh` — la autoridad del apagado

### 4.1 · Dónde entra en el guion

La comprobación va **antes de levantar el contenedor**, no después: apagar algo
que ya levantaste es una carrera que se puede perder.

```
… candado → configuración → LICENCIA → pull → respaldo → migraciones → conmutar
```

### 4.2 · La configuración que la gobierna

En `instancia.env`, una sola variable:

```sh
LICENCIA_REQUERIDA="${LICENCIA_REQUERIDA:-0}"
```

**Cero por omisión, y eso es lo que hace que los hijos administrados no cambien
en absoluto** — es el último punto de «lo que esta decisión NO dice» del
ADR 0032. Sin la variable, el bloque entero de licencia se salta y `update.sh` se
comporta exactamente como hoy. El instalador de droplet propio es el único que la
pone a 1.

Y dos rutas, con sus valores por omisión:

```sh
LICENCIA_DIR="${LICENCIA_DIR:-/etc/space-os/licencia}"
LICENCIA_PUB="${LICENCIA_PUB:-/opt/space-os/space-os.pub}"
```

### 4.3 · El código de salida nuevo

`update.sh` gana **uno**, el siguiente libre después del 7 (los que hay son 0–7,
75 y 91, así que el 8 estaba vacío y no reordena nada):

```sh
EX_LICENCIA=8    # la licencia vencio: esta instancia esta APAGADA a proposito
```

Y **por eso este trabajo llega justo después de la fase 2 del panel de flota**:
ese código viaja solo al PADRE en el reporte, sin tocar nada del canal. Lo único
que hay que añadir es su frase en `apps/flota/diagnostico.mjs`:

```js
8: 'la licencia vencio y la instancia esta apagada a proposito',
```

Un hijo apagado por licencia **no se ve como una avería** en el panel: se ve como
lo que es.

### 4.4 · Qué hace exactamente al apagar

Tres cosas, en este orden:

1. **No levanta el contenedor.** Si hay uno corriendo de una versión anterior, lo
   detiene — `docker stop`, nunca `rm`: sus datos están en Postgres, pero el
   contenedor se conserva para que reanudar sea arrancarlo.
2. **Cambia el sitio de nginx** al de vencimiento (§5) y recarga.
3. **Sale con `EX_LICENCIA`**, que es lo que lleva el aviso al panel.

**Y lo que NO hace, a propósito:** no toca la base, no borra nada, no retira el
respaldo. Apagar retira lo nuestro; no toca nada suyo.

### 4.5 · Reanudar es el camino inverso, y automático

Cuando llega una licencia válida —una persona copia los dos archivos nuevos— la
siguiente corrida del cron encuentra el estado `sana`, devuelve el sitio de nginx
al normal, arranca el contenedor y sale con 0. **No hay ningún comando de
reanudación que alguien tenga que recordar.**

El retraso máximo es el del cron: hasta 24 horas. Para acortarlo en una
renovación en caliente basta con correr `update.sh` a mano, que es lo que la
tarjeta de renovación dirá.

---

## 5 · nginx — lo que se ve cuando está apagado

Dos archivos de sitio, y un enlace simbólico que decide cuál está activo:

```
/etc/nginx/sites-available/space-os.conf              el normal (existe hoy)
/etc/nginx/sites-available/space-os-sin-licencia.conf el de vencimiento (nuevo)
/etc/nginx/sites-enabled/space-os.conf  →  enlace a uno de los dos
```

`update.sh` cambia el enlace con `ln -sfn`, valida con `nginx -t` y recarga.
**Si `nginx -t` falla, no recarga y lo registra**: dejar a un cliente sin nginx
por un error de plantilla sería peor que el problema que se está resolviendo.

**Por qué un cambio de enlace y no un `if` dentro de nginx:** `if` dentro de un
`location` de nginx es célebre por comportarse de forma distinta a como se lee, y
esto tiene que ser predecible. Y por qué no un `error_page 502`: eso confundiría
«la licencia venció» con «la aplicación se cayó», que son exactamente las dos
cosas que el panel de flota existe para no mezclar.

El sitio de vencimiento sirve una página estática que dice, en castellano llano,
que la licencia venció, desde cuándo, y a quién llamar. **Certificado incluido**:
usa el mismo, así que no aparece un aviso de seguridad encima del de licencia.

---

## 6 · La aplicación — sólo avisa

### 6.1 · Cómo llega la licencia al contenedor

Se monta **el directorio**, en sólo lectura:

```sh
docker run … -v /etc/space-os/licencia:/etc/space-os/licencia:ro …
```

**El directorio y no el archivo, y esto no es un detalle de estilo:** montar un
archivo suelto ata el montaje a su inodo, así que reemplazarlo al renovar deja al
contenedor viendo el viejo para siempre. Montando el directorio, sustituir los
archivos dentro funciona.

Si el directorio no existe —el caso administrado— el `-v` no se añade y la
aplicación no ve nada. **Sin licencia montada no hay banda**, y ese es el
comportamiento de hoy sin escribir ninguna condición nueva.

### 6.2 · Qué hace la aplicación con ella

Lee `vence`, `aviso_dias` y `gracia_dias`. **No comprueba la firma.** Duplicar la
criptografía aquí no compraría nada: la aplicación corre en la máquina del
cliente y él tiene root, así que su veredicto nunca sería de fiar. El veredicto
que cuenta ya lo dio `update.sh`, fuera. Aquí sólo se pinta.

Se lee en servidor —nunca en el middleware, por lo del runtime edge
(`middleware.ts:33-34`)— y se pinta en el shell autenticado
(`apps/web/app/(app)/(shell)/layout.tsx`, que es el que ya añade el sidebar y la
topbar). Fuera del shell no se pinta: las páginas públicas de propuesta las ve el
cliente **del** cliente, y nuestras cuentas comerciales no son asunto suyo.

### 6.3 · Los tres textos

| Estado | Qué se ve |
|---|---|
| `sana` | nada |
| `aviso` | banda discreta: «tu licencia de SPACE OS vence el <fecha>» |
| `gracia` | banda destacada: «tu licencia venció el <fecha>. El sistema dejará de funcionar el <fecha+gracia>» |

Las dos bandas dicen **a quién contactar**. Una banda que avisa de algo y no dice
qué hacer es ruido.

---

## 7 · `firmar-licencia.mjs` — el PADRE emite

Un guion en el PADRE que corre **una persona**:

```
node infra/licencias/firmar-licencia.mjs \
     --instancia pixeled --dominio pixeled.ejemplo.com --vence 2027-09-10
```

Pide la frase de paso por terminal (nunca por argumento: acabaría en el
historial), descifra la llave privada **en memoria**, firma y escribe los dos
archivos. Imprime el `sha256` de cada uno para que la entrega se pueda verificar.

**No entra en la máquina de estados desatendida del ADR 0029**, por la misma
razón que su punto 5 dejó fuera el bootstrap: firmar dice *«este cliente pagó,
hasta esta fecha»*, y eso es un acto comercial.

### 7.1 · La custodia de la llave

- La privada se guarda **cifrada**, con la frase de paso fuera de todo archivo.
- La pública va **en el repositorio** (`infra/licencias/space-os.pub`) y el
  instalador la copia al droplet. No es un secreto.
- **Lo que la cifra protege de verdad:** instantáneas del droplet, respaldos de
  la cuenta de DO y cualquier copia del disco. **Lo que no:** alguien con root en
  el PADRE mientras se está firmando. Se acota, no se cierra — la misma honestidad
  que con root en la máquina del cliente.

---

## 8 · `instalar-hijo.sh` — el alta que corre el cliente

### 8.1 · La dirección se invierte

`provision-instancia.sh` corre **desde nuestra máquina** y empuja por SSH: todo
pasa por `remoto()`. Aquí el guion corre **dentro del droplet**, lanzado por el
cliente. Nuestro acceso `soporte` queda para las averías, que es para lo que se
pidió.

**Lo que sí se reutiliza tal cual:** `setup-droplet.sh`, que ya se ejecuta como
root en la propia máquina y ya comprueba que lo es.

### 8.2 · Cómo se entrega, y por qué no es `curl | bash`

Se descarga, se compara su `sha256` contra el que va en la tarjeta, y se ejecuta.
Un `curl | bash` ejecuta lo que llegue por el cable sin que nadie pueda mirarlo
antes, y este repositorio no hace eso ni con sus propias máquinas.

**Sin `--confirmar` se comporta como `--dry-run`**, igual que
`provision-instancia.sh`: el modo por omisión de algo que crea una base y un
usuario Dueño es «cuéntame qué harías».

### 8.3 · Qué pide y qué hace

Pide lo que va en el paquete de alta: el **nombre**, el **dominio**, el **token
de flota**, y la ruta a la **licencia**. Y hace, en orden: `setup-droplet.sh` →
escribir `instancia.env` y `app.env` (con `LICENCIA_REQUERIDA=1`) → instalar la
llave pública → `docker login` → primera corrida de `update.sh` → nginx y
certificado.

**Se detiene y pide sus claves de Spaces** para los respaldos (ADR 0032, punto
8). Si el cliente no las tiene todavía, **avisa fuerte y sigue** — un alta que se
bloquea por eso deja la máquina a medias, que es peor que una máquina servida sin
respaldo remoto y con un aviso repetido cada noche en el log.

---

## 9 · El paquete de alta, y el registro en flota

Lo que se le entrega al cliente son cuatro cosas:

| | Qué es | Quién lo genera |
|---|---|---|
| El **nombre** | `pixeled`… así aparece en flota | nosotros, al registrarlo |
| El **token de flota** | con el que su instancia reporta | el PADRE |
| La **licencia firmada** | los dos archivos de §3.1 | el PADRE, con la frase de paso |
| El **instalador y la tarjeta** | con el `sha256` dentro | del repositorio |

**El token de flota ES el registro.** No hay un alta nuestra y otra suya: se crea
la entrada en el inventario del PADRE, sale un token, y ese token es lo que hace
aparecer la máquina en el panel.

Desde ahí **todo lo demás lo cuenta el hijo solo**. Y el estado «entregué el
paquete y todavía no ha reportado» es información por sí solo: distingue «no lo
ha instalado» de «lo instaló y algo falló».

> En el alta administrada verificamos **haciendo**; en la de droplet propio
> verificamos **escuchando**. Es el mismo canal de flota en dos direcciones de
> uso, no un parche.

---

## 10 · Lo que NO se construye, y por qué

**La credencial por cliente del registro de imágenes.** El riesgo, la razón de
aplazarlo y **el disparador escrito para retomarlo** están en el ADR 0032, en «lo
que queda abierto». Lo que sí entra en este trabajo son las dos mitigaciones
baratas: que el origen de la imagen sea **un solo valor de configuración**, y la
**tarjeta de rotación** del token probada una vez.

**Licencia en los hijos administrados.** `LICENCIA_REQUERIDA=0` por omisión.
Decidido por Emiliano el 10/09.

**Revocación en el acto.** La licencia se comprueba sin salir a internet, así que
retirar a un cliente surte efecto cuando caduca su archivo, no el mismo día. Es
el precio deliberado de que el PADRE no sea indispensable para que funcione el
sistema de nadie.

---

## 11 · Pruebas

### 11.1 · Dónde se prueba cada cosa

| Pieza | Arnés | Cómo |
|---|---|---|
| La comprobación en `update.sh` | `pruebas-update.sh` | escenarios con licencias fabricadas al vuelo |
| La frase del código 8 | `apps/flota/diagnostico.test.ts` | como los otros ocho códigos |
| El aviso | pruebas de `apps/web` | los tres estados, y que fuera del shell no se pinta |
| `firmar-licencia.mjs` | pruebas propias | firma y verificación, ida y vuelta |

### 11.2 · Los casos que tienen que estar

El arnés genera **su propio par de llaves** en el directorio temporal de cada
escenario y firma con él: sin llaves de verdad y sin red.

**En positivo:**
- una licencia sana → el update corre como hoy, y **no dice nada**;
- una en `aviso` y una en `gracia` → el update corre igual, con su línea en el log;
- una `vencida` → no levanta el contenedor, cambia el sitio de nginx, sale con **8**;
- `LICENCIA_REQUERIDA=0` → **ni se mira el archivo**, aunque exista y esté vencido.

**En negativo, que es donde vive el valor:**
- firma que no valida → **inválida**, se apaga; nunca «se asume buena»;
- licencia de **otra instancia** o de **otro dominio** → inválida;
- `licencia.json` presente y `licencia.firma` ausente → inválida;
- un campo que falta o no se puede leer → inválida, sin valores por omisión;
- `nginx -t` falla al cambiar el sitio → **no recarga**, lo registra, y el código
  de salida sigue siendo el de licencia;
- una licencia válida detrás de una vencida → **reanuda solo**, sin comando.

**Y dos mutantes**, que es lo que hace que las comprobaciones muerdan:
- verificar la firma **después** de leer los campos;
- tratar la licencia ilegible como sana.

### 11.3 · El ensayo antes de que ningún cliente reciba una licencia

Con `LICENCIA_REQUERIDA=1` **en DEMO** y una licencia caducada a propósito: se
comprueba que apaga, que nginx sirve la página, que el 8 llega al panel y que una
licencia nueva lo reanima. Después se vuelve a poner en 0.

Es la reserva que Emiliano resolvió el 10/09 sin poner licencia a los hijos
administrados: **probar el mecanismo no exige que DEMO viva con licencia.** Un
interruptor de apagado cuyo primer uso real fuera contra un cliente que paga sería
la peor forma posible de estrenarlo.

---

## 12 · Riesgos

| Riesgo | Qué se hace |
|---|---|
| **Root del cliente derrota cualquier licencia** | Se acepta y está escrito (ADR 0032). El objetivo es que no se pueda **esconder**, no que no se pueda |
| **Apagar a un cliente al corriente por un error de facturación** | Aviso + gracia; y el ensayo en DEMO antes de que exista el primer cliente |
| **`update.sh` es la ruta crítica de TODA la flota** | El bloque entero queda detrás de `LICENCIA_REQUERIDA`, que es 0 por omisión: sin ella, el guion se comporta exactamente como hoy |
| **Perder la llave privada** | Ninguna licencia nueva se puede emitir ni renovar. Necesita procedimiento de respaldo de la llave — **y ese respaldo es tan valioso como la llave** |
| **Filtración de la llave privada** | Cualquiera podría emitir licencias. Necesita rotación: llave nueva en la imagen y relicenciar a todos. Que sea caro es la razón de custodiarla bien |
| **La página de vencimiento sin certificado** | Reutiliza el mismo, para que no salga un aviso de seguridad encima del de licencia |

---

## 13 · El orden en que conviene construirlo

1. **Las llaves y `firmar-licencia.mjs`** — sin licencias que firmar no se puede
   probar nada más.
2. **La comprobación en `update.sh`**, con su arnés, detrás de
   `LICENCIA_REQUERIDA=0`. Aquí ya se puede demostrar que la flota de hoy no
   cambia.
3. **El apagado**: nginx y el código 8, con su frase en el panel.
4. **El aviso en la aplicación.**
5. **`instalar-hijo.sh` y la tarjeta del paquete de alta.**
6. **El ensayo en DEMO** (§11.3) — la puerta antes de vender esto.

Los pasos 1 a 4 no tocan a ningún cliente: son código que duerme hasta que
alguien ponga `LICENCIA_REQUERIDA=1`.
