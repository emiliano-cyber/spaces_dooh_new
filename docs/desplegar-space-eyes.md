# Desplegar lo nuevo de Space Eyes — instrucciones para Emiliano

Escrito el 18-nov-2026 contra la rama `fix/space-eyes-fotos-rapidas`, punta
`742afa90`. Lo que dice de `update-eyes.sh` está leído del guion; lo del
despliegue de g500 está comprobado el 2-nov-2026 subiendo la 0.16.24-local, y
lo marco donde toca.

## Lo primero, porque decide todo lo demás

**Esto son DOS despliegues, no uno.**

| | Qué lleva | Cómo se despliega |
|---|---|---|
| **SPACE OS** (`apps/web`) | El menú de Ajustes, las pestañas de la ficha, el aviso de pantalla caída | Con el despliegue normal de la aplicación |
| **Space Eye** (`space-eye/`) | Avisos por correo, foto al recuperar, obstrucción, auditoría diaria, pantalla apagada de TLALPAN | **Imagen propia del contenedor**, aparte |

Si solo se hace el primero, lo que se ve es el menú y poco más: **todo lo que
cuenta pasa en el servidor de Space Eye**. Es la misma imagen vieja donde
`/api/avisos` se queda colgado sin contestar — si al probar los avisos por
correo la tarjeta no aparece, es eso y no un fallo de la interfaz.

## 1 · SPACE OS

Fusionar la rama y desplegar como siempre. Las traducciones de lo nuevo ya van
dentro (28 claves en los cuatro idiomas); no hay lote aparte que aplicar.

Una sola prueba que conviene hacer después: entrar a Space Eyes → **Ajustes**.
Si se ven las cinco pestañas (Brillo por horas, Ajustar texto, Programación,
Verificación, Gráficas), el merge entró entero.

## 2 · La imagen de Space Eye en g500

Comprobado el 2-nov-2026. Cuatro pasos:

```bash
# 1. Empaquetar el código de space-eye/ y subirlo por scp (~1 MB).
#    OJO: `/root/spaces-repo` del droplet NO es un clon de git. Es una copia
#    suelta del 8-oct, sin `.git`: ahí NO sirve `git fetch`.

# 2. Construir EN el droplet:
docker build -f Dockerfile.instancia \
  -t space-eye:<version>-local --build-arg VERSION=<version> .

# 3. Cambiar EYES_IMAGEN en /etc/space-os/eyes.env   ← ZONA ROJA
#    Es configuración de instancia: pedir permiso antes.

# 4. Correr el guion (vive ahí, no en /usr/local/bin):
/opt/space-os/update-eyes.sh
```

Tres cosas que cuestan una hora si no se saben:

- **`EYES_IMAGEN` sin barra = imagen local.** `update-eyes.sh` no jala nada del
  registro si el nombre no lleva `/`. g500 usa `space-eye:<version>-local`, así
  que no hace falta registry aunque `REGISTRY` y `REGISTRY_TOKEN` existan.
- **El `.dockerignore` excluye `frontend/public/*.apk` y `*.exe` a propósito**
  (130 MB, y esa APK está compilada contra OTRO servidor: servida desde g500,
  alguien se bajaría la equivocada). Al empaquetar a mano hay que respetarlo.
- **El Dockerfile pide `pi-agent/dist/space-eye-pi-agent.tar.gz`**. Está en la
  rama, pero si se empaqueta a mano y se olvida, el build falla.

**Si solo se cambia `EYES_IMAGEN` y no se corre el guion**, el despliegue ocurre
igual, pero a las **4:27 AM** por cron, sin nadie mirando. Mejor correrlo.

## 3 · Las migraciones: 031 a 036

**En las instancias se aplican solas.** `update-eyes.sh` las corre con la imagen
NUEVA, en un contenedor desechable, **antes** de cambiar de versión; si una
falla, restaura el respaldo y no cambia nada (código 4). No hay nada que hacer a
mano.

En el **`:4000` de producción sí van a mano**: ahí no corre ese guion.

```
031_avisos_por_correo.sql        avisos por correo
032_foto_al_recuperar.sql        la foto cuando una persona marca la falla
033_creativo_por_dia.sql         la auditoría diaria de creativos
034_foto_de_que_creativo.sql     qué creativo enseña cada foto
035_creativo_de_que_campana.sql  de qué campaña es cada creativo
036_bitacora_de_pasadas.sql      cuántas veces salió cada uno y a qué hora
```

La tabla de control es **`_migrations`**, no `migrations`.

### Después de la 034: etiquetar las fotos de antes (opcional)

La 034 hace que **cada foto nueva** quede marcada con el creativo que enseña, y
eso es lo que permite juntar los comprobantes de una campaña de un clic. Las
fotos **anteriores** quedan sin marcar, que es la verdad: nadie miró qué
enseñaban. El reconocimiento hacia atrás va aparte, **equipo por equipo**:

```
# Primero en ENSAYO: no escribe nada, solo dice cuántas reconocería.
docker compose -p space-eyes exec api node dist/etiquetar-fotos.js <device_id> --tope=200

# Y si el resultado convence:
docker compose -p space-eyes exec api node dist/etiquetar-fotos.js <device_id> --tope=200 --aplicar
```

**Va despacio a propósito**: hay que decodificar y enderezar cada JPEG, y
medido en la instancia local sale a **varios segundos por foto**. Con 3 000
fotos son horas. Por eso lleva `--tope` y se corre por equipo, fuera de las
horas de más subidas. No estorba a nada: si se corta a la mitad, lo etiquetado
se queda etiquetado y se puede seguir otro día.

Lo que **no** hace es registrar creativos que no estén ya en el catálogo. En
vivo sí los registra -ahí la foto acaba de llegar y se sabe de cuándo es-, pero
en lote, sobre meses de historia, llenaría el catálogo de anuncios que ya no
existen con fecha de hoy.

**Antes de correrlo, el equipo necesita la pantalla marcada.** Sin las esquinas
no se puede enderezar nada y no hay nada que comparar; el guion lo comprueba y
se planta en vez de pasarse horas para decir «ilegibles».

### Después de la 035: de quién es cada creativo (recomendado)

Esto es lo que pone nombre a los anuncios **sin que nadie teclee nada y sin
costar un peso**: compara cada creativo del catálogo con la creatividad que
Operaciones ya subió para su campaña. Mismo normalizador, misma huella de 256
bits, cero llamadas a internet.

```
# Toda la flota, en ENSAYO:
docker compose -p space-eyes exec api node dist/identificar-creativos.js

# Un solo equipo:
docker compose -p space-eyes exec api node dist/identificar-creativos.js <device_id>

# Y cuando el resultado convenza:
docker compose -p space-eyes exec api node dist/identificar-creativos.js --aplicar
```

Va rápido: compara huellas ya calculadas, no vuelve a leer fotos. En vivo cada
creativo nuevo se identifica solo al registrarse, así que esto solo hace falta
**una vez** para el catálogo que ya existe, y después de que Operaciones suba
campañas nuevas (lo que ya se había visto en pantalla queda identificado hacia
atrás).

Medido el 25-nov-2026 en el ensayo local: 43 de 324 creativos casaron, a 0-10
bits; los 281 restantes son de un sitio sin campañas registradas y se quedan
sin identificar, que es la respuesta correcta. El umbral está deliberadamente
corto (20 bits, contra los 24 de tolerancia normal): lo dudoso se deja sin
nombre, porque un anunciante equivocado en un comprobante es peor que
ninguno.

## 3 bis · Lo que cambia de comportamiento con la 034

Dos cosas que conviene saber ANTES de desplegar, porque se notan solas:

1. **El catálogo de creativos va a crecer.** Hasta ahora un anuncio solo
   entraba si el equipo lo detectaba por esquinas (ORB), y con programática
   -Hivestack- eso se pierde casi siempre. Ahora el servidor mira también las
   fotos por horario y registra lo que no conocía, marcándolo como
   `descubierto='servidor'`. En un sitio con programática eso pueden ser
   decenas al día: no es un error, es lo que ya estaba pasando en la pantalla
   y no se contaba. Hay un freno de 100 al día por equipo, y si se alcanza lo
   dice en el registro del equipo: eso sí es señal de que algo está mal
   (cámara movida, encuadre perdido).

2. **No cuesta datos móviles.** Ni una foto más: todo sale de las que ya
   llegaban. Lo que cuesta es CPU del droplet en cada subida, y no es nueva:
   el servidor ya enderezaba cada foto para decidir si tocaba refoto.

## 3 ter · Lo que cambia de comportamiento con la 035

**El número de fotos de una campaña va a subir.** Hasta ahora eran solo las que
se pidieron PARA ella; ahora también cuentan todas en las que salió su anuncio,
aunque la foto fuera por horario. Eso es exactamente lo que se pidió -«en fotos
programadas sale un creativo de la campaña»- y es el número que aparece en la
tarjeta y al que lleva el enlace, así que los dos dicen lo mismo.

Ese número solo crece para las fotos que estén **etiquetadas** (034). Las
viejas no lo están hasta que se corra `etiquetar-fotos`, así que en los
primeros días la cuenta subirá poco a poco.

## 4 · El agente de Raspberry

El manifiesto que se sirve hoy está **desactualizado**: dice 0.3.0 (22-ago) y no
corresponde al paquete que hay. El de la rama sí:

```
space-eye/pi-agent/dist/space-eye-pi-agent.tar.gz
    versión 0.7.12 · 746 564 bytes
    sha256 ab7d3c927ae4df2f332193b3ad7d25888222a34c28e278f1f84bf413d91ed5b9
```

**El paquete viaja EN LA RAMA y la imagen lo mete dentro**
(`Dockerfile.instancia:39` lo copia a `/app/agentes/`). Si alguien cambia el
código del agente y no vuelve a correr `npm run empaquetar` en `pi-agent/`, la
rama sigue llevando el paquete anterior y se construye una imagen con el agente
viejo: el cambio no llega a ninguna Raspberry y nada avisa, porque el build no
falla. Al tocar `pi-agent/`, los tres pasos van juntos: subir la versión en
`package.json` **y** en `src/index.js` (el empaquetador se planta si no
coinciden), empaquetar, y commitear `dist/`.

Se copian los dos al `frontend/public/` del servidor, el **manifiesto al final**:

1. `space-eye-pi-agent.tar.gz`
2. `space-eye-pi-agent.json` (el de `pi-agent/dist/`, no el viejo de
   `frontend/public/`)

Al revés, los equipos ven un manifiesto nuevo apuntando a un paquete que todavía
no está y rechazan la actualización.

Esta versión lleva el arreglo de la cámara movida. **En los teléfonos ese mismo
arreglo no entra**: necesita APK, y las que hay están en la calle. Por eso el
servidor lleva su propio filtro.

## 3 quater · Lo que cambia de comportamiento con la 036

**El equipo empieza a contar las veces, no solo a decir qué vio.** Hasta ahora
reportaba las huellas reconocidas como un conjunto, así que doce apariciones
dentro de una vuelta de cinco minutos se guardaban como una. Desde la 036 la
Raspberry cuenta cada mirada, la mete en su hora, y al cambiar el día manda un
cierre con su total.

**Los teléfonos no mandan nada de esto y no lo van a mandar**: su APK ya está
en la calle. Esos equipos conservan la resolución que tenían -la vuelta- y
siguen dentro de la auditoría; cada fila declara con qué vara se midió
(`medida` = `vuelta` o `vistazo`) y de dónde salió la hora (`zona` = `equipo` o
`servidor`). Un reporte que mezcle las dos sin decirlo es un reporte que no se
puede defender, así que la vara de un periodo es la **peor** de sus días.

**Esto no son reproducciones.** Una cámara que mira cada tantos segundos puede
decir en cuántas de SUS MIRADAS estaba el anuncio, no cuántas veces lo sacó el
reproductor. Por eso ningún número sale sin su denominador y la palabra no
aparece en el código.

**El cierre es una suma de comprobación.** El equipo manda el total del día; lo
que no cuadre con lo que fue llegando queda en `device_dias.perdidos`. En el
registro sale como:

```
[auditoria] equipo 900000022 cerro 2026-11-26 con 14 miradas que nunca
            llegaron (guardadas 1826)
```

Un día con huecos sigue sirviendo; lo que no puede es no saberse.

**No hay pantalla todavía.** La 036 trae la base, los agentes y dos rutas de
lectura (`/api/devices/:id/auditoria` y `/api/campaigns/:id/auditoria`), pero
nada en el panel las enseña aún. Desplegarla igualmente tiene sentido: la
bitácora empieza a acumularse desde el primer día, y cuando la pantalla llegue
habrá historia que enseñar en vez de empezar de cero.

## 5 · Comprobar que quedó

Tres comprobaciones, en orden de lo que más se rompe:

1. **La API contesta:** `GET /api/app/version` desde el droplet. Un 401 es
   señal de vida (es lo que `update-eyes.sh` espera).
2. **Los avisos por correo ya no se cuelgan:** abrir Space Eyes → Fallas. Si la
   tarjeta «Avisos por correo» aparece, la imagen nueva está arriba. Si la
   pantalla se queda sin esa tarjeta, sigue la vieja.
3. **La auditoría diaria escribe:** `SELECT COUNT(*) FROM device_creative_dias
   WHERE dia = CURDATE();` en la base de la instancia. A la hora de que los
   equipos reporten tiene que haber filas.

## 6 · Volver atrás

Dejar `EYES_IMAGEN` en la versión anterior y correr `update-eyes.sh`. La imagen
vieja sigue en el droplet. Las columnas de las migraciones se quedan, pero son
aditivas y el código viejo las ignora.

**Lo que `update-eyes.sh` NO respalda: las fotos** (volumen `space-eyes_fotos`,
1.1 GB el 2-nov). Su `mysqldump` es solo de la base, y se queda en el mismo
droplet. Para un respaldo de verdad hay que sacarlo fuera.

## 7 · Lo que NO hay que dar por bueno todavía

**El portero de obstrucción («algo tapando la pantalla») tiene el umbral sin
medir.** El 0.45 sale de la geometría del caso —un vehículo tapa entre un cuarto
y la mitad de la pantalla desde la altura de la cámara—, no de un conteo contra
fotos reales de camiones.

Esas fotos ya están en el catálogo de producción: entraron como «creativos» que
se vieron una vez y nunca más. `space-eye/backend/scripts/medir-obstruccion.ts`
hace exactamente esa cuenta y dice si el umbral separa.

Conviene correrlo antes de confiar en ese portero: si se quedara corto, un sitio
dejaría de registrar creativos de verdad **y eso no avisa de nada**.
