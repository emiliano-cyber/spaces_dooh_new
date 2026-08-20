# SPACE EYE — Estado y handoff

Bitacora de sesiones de trabajo: que se hizo, que quedo desplegado, que se
verifico y que sigue pendiente. Lo mas reciente primero.

---

## 2026-08-17 — Revision de la Raspberry antes de mandarla a produccion

Se reviso el equipo #13 contra produccion, con el equipo en linea, no sobre el
papel. **El circuito completo funciona**: se le disparo una foto y llego a la
galeria en menos de 20 s, y la vista en vivo entrega 720p a 15 fps al servidor
de medios. Tres hallazgos.

### 1. La vista en vivo gastaba 50 MB por minuto

Se grabaron 30 s del RTSP que publica la Pi: **24.9 MB, o sea 6.96 Mbps**. La
cifra que estaba anotada en este mismo documento, 1.2 Mbps, estaba mal por un
factor de seis. Y se midio **apuntando a una pared lisa**, la escena mas facil de
comprimir que existe: es el piso, no el techo.

Causa: `transmision.js` llamaba a `rpicam-vid` sin `--bitrate`, asi que usaba el
de fabrica. Una sesion de tres minutos costaba **150 MB** — mas de la mitad de lo
que el equipo gastaba en todo el mes. En un sitio con modem LTE eso se lleva el
plan en una semana.

Ahora el caudal se calcula del tamano (0.11 bits por pixel y cuadro): 720p15
queda en ~1.5 Mbps, **~11 MB/min**. Se puede fijar a mano con
`"stream": { "bitrate": N }`.

### 2. El equipo hablaba mucho mas de lo necesario

Telemetria cada 60 s y sondeo de comandos cada 30 s daban **~230 MB/mes de puro
"sigo aqui"**, mas que las fotos. Los tamanos se midieron contra el servidor:
cada intercambio son ~1.5 KB de los que 740 bytes son cabeceras de respuesta.

Ahora: telemetria cada **180 s** y sondeo cada **300 s** — el backend da por
caido a un equipo a los **10 minutos**, asi que hay margen de sobra, y las
ordenes no llegan por el sondeo sino por el socket, al instante. El sondeo
**vuelve a 30 s solo mientras el socket este caido**, que es cuando de verdad es
el unico camino. Quedan **~40 MB/mes** de fondo, ~80 MB/mes con las tres fotos
diarias de evidencia.

### 3. El enfoque fijo del dashboard, la Pi lo ignoraba

El equipo tenia `camera_ajustes.enfoque_fijo = true` guardado y seguia haciendo
una pasada de autofoco en cada disparo: solo se miraba `config.json` del propio
equipo. Ahora manda el dashboard (y `config.json` queda de respaldo). Al video
solo se le tocan las banderas si el enfoque es fijo: no es momento de cambiarle
el comportamiento a la vista en vivo de un equipo que **no se puede actualizar
por red**.

### Lo que sigue pendiente para dejarla sola en un espectacular

- **`UPDATE_APP` no existe en la Raspberry**: contesta "todavia no disponible".
  Sin OTA y sin SSH por LTE, cualquier cambio exige ir al sitio. Es lo mas
  importante que le falta.
- **La camara esta ciega**: las fotos del 11-ago en adelante son gris uniforme
  (140 KB; las del 4-ago, con imagen, pesaban 380-470 KB). Protector de lente.
- Telemetria incompleta: bateria fija en 100, sin GPS, la senal es la del WiFi, y
  `data_usage` llega vacio (falta vnstat) — la pantalla de consumo del dashboard
  no muestra nada de este equipo.
- `creative_watch`: el backend lo expone y el dashboard lo configura, pero
  **ningun agente lo implementa**. `pi-agent/src/huella.js` existe y solo lo usa
  el script de prueba; la APK tampoco lo trae.
- microSD de 16 GB con 6.2 GB libres, y sin watchdog de hardware.
- Avisos de subvoltaje el 3 y el 7 de agosto: la fuente no alcanza (ya se va a
  cambiar).

### 4. La verificacion daba por INCORRECTA la creatividad correcta

Con la camara ya destapada y el creativo de Si Vale en pantalla, el verificador
daba 0.337 de confianza (necesita 0.60) y la marcaba incorrecta. No era cuestion
de umbrales; los cuatro casos medidos con fotos reales:

| foto | confianza | SSIM |
|---|---|---|
| creatividad correcta, foto completa | 0.337 | 0.353 |
| creatividad correcta, recortada a la pantalla | 0.465 | 0.590 |
| creatividad EQUIVOCADA | 0.291 | 0.270 |
| **camara TAPADA (gris uniforme)** | **0.539** | **0.882** |

**Una foto en blanco sacaba la nota mas alta de todas.** El SSIM premia las
imagenes planas. Bajando `min_ssim` a 0.35 la pared gris seguia ganandole a la
foto buena (0.539 contra 0.528): cualquier umbral que dejara pasar las fotos
reales dejaba pasar primero a un equipo ciego.

**Ahora se localiza la creatividad dentro de la foto** (puntos caracteristicos
ORB + homografia) y se exige que sus cuatro esquinas proyectadas formen un
cuadrilatero convexo de tamano razonable. Ese segundo requisito es el que de
verdad separa: un primer plano del borde de una laptop llegaba a 16 puntos —mas
que la foto buena vista de lejos, que da 27— pero su cuadro colapsa a area cero.

| foto | veredicto | confianza | puntos |
|---|---|---|---|
| correcta, foto completa | CORRECTA | 0.748 | 27 |
| correcta, con el zoom ajustado | CORRECTA | 0.947 | 122 |
| creatividad equivocada | incorrecta | 0.227 | 7 |
| borde de laptop | incorrecta | 0.439 | 14 |
| camara tapada | incorrecta | 0.000 | — |

Ademas: **guardia de "la foto no muestra nada"** (desviacion tipica < 8 o menos
de 50 puntos) que corta antes de puntuar y avisa de que la camara puede estar
tapada — medido, una foto ciega da 3.5 de desviacion y la peor foto real 26.8.
Y la confianza ya no puede contradecir al veredicto: por encima de 0.60 solo las
correctas. Antes salia "incorrecta, confianza 0.73".

SSIM, histograma y pHash se siguen calculando y guardando (sirven para revisar un
caso a mano y ya viven en la base), pero solo mueven el numero dentro de su
banda. `MIN_PUNTOS_CREATIVO` (por omision 15) permite ajustarlo sin tocar codigo.

**PENDIENTE: desplegarlo.** El `ai-worker` corre en el droplet y hay que
reconstruir su contenedor.

### 5. El encuadre de la Raspberry

La creatividad ocupaba el 34% del cuadro (el resto era la laptop, el escritorio y
la silla). Con `zoom = 0.25` pasa al 53% y la verificacion sube de 27 a **122
puntos** y de 0.748 a **0.947**. Comprobado con foto real, no en teoria.

### 6. REVOLUCION 267 "ocupado": el sitio tiene un programa de hace tres versiones

**Sintoma:** el dashboard decia que la vista en vivo estaba ocupada y nadie mas
podia verla.

**No estaba ocupada.** El backend hace bien su trabajo: se comprobo pidiendo la
transmision dos veces seguidas y la segunda devuelve `compartida: true` con la
misma URL, que es lo que debe hacer un equipo relay. Y nadie la veia porque **no
habia nada que ver**: el servidor de medios devuelve 404 en esa ruta, nadie
publica.

**La causa, en la tabla `commands`:**

```
2466  START_STREAM  failed  vista en vivo no disponible en el agente de PC
```

Ese mensaje **no existe en el codigo actual**: se borro en el commit `af3dc37`,
que es el que agrego la vista en vivo al agente de PC. O sea que la PC de ese
sitio corre el binario **original** (`a9d7ed2`), anterior a que la funcion
existiera... pero se anuncia como `pc-agent 1.0.0`, igual que todos, porque la
version nunca se subio. Desde el dashboard era imposible saberlo.

El "ocupado" que se veia en el navegador sale de `frontend/src/js/whep.js:116`
("...o con la camara ocupada"): es el visor rindiendose tras esperar a que el
equipo publique. Dice lo unico que no era.

**Arreglado en el codigo:** `VERSION` del agente de PC sube a **1.1.0** y queda
anotado que hay que subirla en cada build que se lleve a un sitio.

**Pendiente:** instalar el agente actual en esa PC (no tiene `UPDATE_APP`, asi
que hay que entrar al equipo), y hacer que el visor muestre el motivo real —el
backend ya lo tiene guardado en `commands.error_message`— en vez de suponer que
la camara esta ocupada.

### 7. Actualizacion por red para las PCs con camara IP (desplegada)

Consecuencia directa de lo anterior: si actualizar un sitio exige ir, los sitios
se quedan atras y no se nota. Ahora el agente de PC se actualiza desde el
dashboard, como los telefonos.

**Servidor** (`backend/src/utils/apkInfo.ts`, `dashboard.controller.ts`): la
funcion que publicaba el APK se generalizo, y `UPDATE_APP` elige que binario
mandar segun el tipo de equipo — APK a los telefonos, `SpaceEyeAgente.exe` a las
PCs. A la Raspberry le contesta `sin_actualizacion_remota` en vez de mandarle un
APK que no puede instalar. Publicados en `frontend/public/`:
`SpaceEyeAgente.exe` + `space-eye-agente.json` (version y huella), y tambien
`ffmpeg.exe`, para poder instalar un sitio bajando los dos archivos del servidor.

**Agente** (`pc-agent/src/actualizar.js`): baja al lado del actual, **verifica el
SHA-256** -el archivo viaja por HTTP en claro, la huella es la unica defensa-,
**arranca el binario nuevo con `--version`** para comprobar que no esta roto, y
solo entonces renombra. Windows no deja sobrescribir un .exe en uso pero **si
renombrarlo**: comprobado con el binario real corriendo. Si el nuevo se cae en
los primeros 15 s, **vuelve solo al anterior**. El binario viejo se borra al
arrancar bien, no antes: mientras no levante, es la unica forma de volver atras.
Y por debajo, la tarea de Windows se repite cada 10 min con IgnoreNew.

**Probado:** la maniobra completa (renombrar en caliente, sustituir, arrancar el
nuevo) con el .exe real; el binario se sirve por HTTP con la huella correcta; y
la orden a REVOLUCION lleva el payload correcto. Ese equipo la contesta
`{"ignorado": "UPDATE_APP"}` porque corre el agente viejo: **la primera
instalacion sigue siendo a mano**, de ahi en adelante ya no.

### Una campana NO dispara fotos

Se creo la campana "Si vale" y no tomaba ninguna foto. No es una falla: quien
dispara es el `scheduleWorker`, y la foto queda ligada a la campana solo si el
**schedule** trae `campaign_id`. La unica programacion activa ("Evidencia diaria
— toda la flota") no tiene campana, asi que cada foto sube suelta y la campana
se queda en 0. Para juntar evidencia de una campana hay que crear una
programacion con esa campana seleccionada.

---

## 2026-07-31 — Sesion de arranque de Raspberry Pi 5 y vista en vivo

### 1. El parpadeo del login (resuelto y desplegado)

**Sintoma:** abrir `http://159.203.188.58:4000/dashboard.html` en un equipo
parpadeaba entre login y dashboard sin parar; en incognito no pasaba.

**Causa:** con un `access_token` muerto en localStorage, `dashboard.html` solo
miraba "existe token" y dejaba entrar; el backend respondia 401; `api.js` mandaba
al login **sin borrar los tokens**; e `index.html` miraba lo mismo y devolvia al
dashboard. Bucle infinito.

**Arreglo:** `api.js` borra la sesion completa antes de ir al login (con
`location.replace` y un candado para que varias peticiones no naveguen a la vez);
`index.html` valida el token contra `/api/auth/me` antes de redirigir.
Commits `dbb8fce`.

**Por que le pasaba a tanta gente:** 89 de 90 sesiones son de la misma cuenta
`admin@spaceeye.app`, y el refresh token duraba 7 dias sin renovarse. Cada
navegador quedaba fuera a los 7 dias exactos. Se veia en los inicios de sesion:
1–8 por dia hasta el 27-jul, **40 el 28-jul**.

### 2. Sesion deslizante (resuelto y desplegado)

`/api/auth/refresh` ahora emite un refresh token nuevo cuando al actual le quedan
menos de 6 dias, **sin revocar el anterior** (otra pestana podria estar por
usarlo). Quien usa el sistema ya no vuelve a capturar contrasena. Ademas se
limpian las sesiones caducadas al iniciar sesion. Commit `b053dd3`.

**Sigue vigente:** cambiar la contrasena revoca TODAS las sesiones del usuario, y
como la cuenta es compartida, cierra la sesion de toda la empresa a la vez.
Pendiente sugerido: un usuario por persona.

### 3. Raspberry Pi 5 en produccion

**Equipo #13**, uid `pi-09dacd8cac3186cc`, nombre "Raspberry Pi 5".

- Hardware en la red local: `192.168.100.191` (cable) y `.190` (WiFi).
  Usuario `adavailable`. Debian 13 (trixie), 64 bits, Node 20.19.2.
- Camara oficial **Module 3 NoIR** (`imx708_noir`) conectada y funcionando.
- Alimentacion correcta (`vcgencmd get_throttled` = `0x0`).
- Agente en `/home/adavailable/pi-agent`, servicio systemd
  `space-eye-agente` (arranca solo, se reinicia solo).

**Lo comprado que NO sirve** (ver `docs/PLAN_RASPBERRY_PI5.md`): la fuente es
micro-USB de 5.1V 2.5A (la Pi 5 es USB-C 5V/5A) y el cable USB-A→micro-USB no
aplica. La camara NoIR da color lavado de dia: para verificar creatividades
conviene comprar tambien la Module 3 **estandar**.

### 4. Vista en vivo para equipos que no son telefonos

Arquitectura elegida: **servidor de medios en el droplet**. Los agentes empujan
el video con ffmpeg solo mientras alguien mira; el dashboard lo consume por
WebRTC. Los telefonos Android NO cambian: siguen punto a punto.

```
Raspberry Pi  --RTSP (ffmpeg)-->  [ MediaMTX ]  --WebRTC/WHEP-->  Dashboard
Camara IP     --RTSP (ffmpeg)-->   (droplet)
```

- Contenedor `infra-mediamtx-1` (MediaMTX v1.19.3), config en
  `infra/mediamtx/mediamtx.yml`. **Puertos nuevos: 8554/tcp, 8889/tcp,
  8189/udp.** El API (9997) NO se publica.
- Publicar exige usuario/contrasena (`MEDIAMTX_PASS` en `backend/.env`); **ver**
  depende de que la ruta sea impredecible: el backend genera una ruta al azar y
  de un solo uso en cada `START_STREAM`. Los equipos no guardan credenciales.
- La Pi 5 **no tiene codificador de video por hardware**: codifica H.264 por
  software. Medido: 720p a ~14 fps, 56 °C. (El caudal que se anoto aqui,
  1.2 Mbps, resulto estar **mal**: ver la sesion del 17-ago.)
- Dos trampas encontradas: `rpicam-vid` exige `--libav-format` al escribir a
  salida estandar (si no, falla), y ffmpeg analizaba 5 MB/5 s antes de conectar
  (se bajo a 200 KB/1 s). Con eso el video aparece en **3.4 s** en vez de ~15 s.
- El dashboard elige visor segun `app_version` (`pi-agent`/`pc-agent` → WHEP).
  Nuevo endpoint `GET /api/devices/:id/stream-status?key=` para saber si el
  equipo ya publica, en vez de tocar la puerta y llenar la consola de 404.

**Camaras Hikvision: codigo listo, SIN PROBAR en sitio.** ffmpeg reenvia el RTSP
de la camara **sin recodificar**. Requiere dejar `ffmpeg.exe` junto a
`SpaceEyeAgente.exe`. Opcion `canal_stream: 102` para gastar menos subida.

**Preparativos para esa prueba (14-ago).** Se cerraron tres huecos que la habrian
hecho fallar en el sitio por motivos tontos:

- **`ffmpeg.exe` ya no hay que acordarse de bajarlo**: `npm run bajar-ffmpeg` lo
  descarga (build estatica LGPL de BtbN, no necesita DLLs) a `pc-agent/vendor/`,
  y `build.js` lo copia a `dist/` junto al agente. El binario NO se versiona
  (pesa demasiado para el repo); `vendor/` esta en `.gitignore` y el build avisa
  fuerte si falta.
- **El sub-stream era inalcanzable desde el instalador**: escribia solo
  `canal: 101`, nunca `canal_stream`, asi que toda instalacion hecha con el
  asistente transmitia el stream principal a maxima calidad — justo lo que no
  conviene sobre LTE. Ahora escribe `canal_stream: 102` y, si ese canal no
  responde (hay camaras sin sub-stream habilitado), `transmision.js` **se cae
  solo al principal** en vez de dejar el sitio sin vista en vivo.
- **Un fallo del vivo era invisible en el dashboard**: `iniciar()` respondia
  "comando OK" en cuanto lanzaba el proceso, y el `ENOENT` de ffmpeg llegaba
  despues. En el navegador eso eran 40 s de espera y un "el equipo no comenzo a
  transmitir". Ahora `iniciar()` es asincrono: espera hasta 15 s a que la camara
  **entregue cuadros de verdad** (ffmpeg `-progress`, no basta con que el proceso
  siga vivo) y **rechaza con el motivo real**, que es lo que ve el dashboard.

Y para verificar estando en el sitio, sin depender del dashboard ni de que la red
alcance al servidor: **`SpaceEyeAgente.exe --probar-stream`** (o la opcion `[3]`
al abrir el programa). Prueba cada canal y reporta resolucion, fps y ancho de
banda, o el motivo del fallo traducido (401 = clave mal, 404 = ese canal no
existe, Connection refused = RTSP cerrado).

### 5. Borrar un dispositivo exige escribir ELIMINAR

Modal con el nombre del equipo, lo que se pierde, y un campo donde hay que
escribir la palabra; el boton nace deshabilitado. Reutilizable desde cualquier
pagina: `window.confirmarEscribiendo`.

### 6. La lista de equipos ya no se mueve

Ordenaba por `last_seen_at DESC`, que cambia cada vez que un equipo reporta: las
tarjetas se reacomodaban solas. Ahora es alfabetico y estable (fijados arriba),
ordenado en servidor y en navegador.

---

### Como retomar

```bash
ssh adavailable@192.168.100.191          # clave: la del equipo
systemctl status space-eye-agente
journalctl -u space-eye-agente -f
cd ~/pi-agent && npm run probar-camara   # prueba la camara sin tocar el servidor
```

Despliegue (ver `docs/DEPLOYMENT.md` y la memoria de produccion):

```bash
# Frontend: copiar y listo (el usuario debe hacer Ctrl+Shift+R)
# Backend/infra: SIEMPRE con --env-file, o MEDIAMTX_PASS se queda vacia
docker compose -f infra/docker-compose.ip.yml --env-file backend/.env up -d --build backend
```

### Pendientes

1. **Probar la vista en vivo de una Hikvision en un sitio real** (falta
   `ffmpeg.exe` en la PC del sitio).
2. **Quitar el protector de la lente** de la camara de la Pi y reevaluar el
   color del NoIR contra una foto del telefono del mismo sitio.
3. Comprar lo critico que falta: fuente USB-C 27 W, enfriamiento activo, modem
   LTE + antenas + SIM, gabinete IP66. Ver `docs/PLAN_RASPBERRY_PI5.md`.
4. Actualizacion remota del agente de la Pi (`UPDATE_APP`) — todavia responde
   que no esta disponible.
5. **Migrar a dominio con HTTPS.** Hoy todo va en HTTP plano: las cabeceras de
   seguridad que ya manda el backend las ignora el navegador, y la ruta de una
   transmision viaja en claro.
6. El equipo **TLALPAN 985** no reporta desde el 29-jul (anterior a estos
   cambios).
