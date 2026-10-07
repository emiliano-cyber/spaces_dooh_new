# SPACE EYE — Estado y handoff

Bitacora de sesiones de trabajo: que se hizo, que quedo desplegado, que se
verifico y que sigue pendiente. Lo mas reciente primero.

---

## 2026-09-24 al 2026-10-01 — Monitoreo en el telefono real, rediseño, vivo para varios y V2 como espejo

Rama `feature/playlog-logs`, commits `3ce38e7` a `209ca5a`. Hay TRES instancias
en el droplet; produccion (4000) no se toco en ningun paso:

```
:4000  V1, produccion. Los equipos de campo entran aqui (su APK lo trae fijo).
:4100  pruebas (/var/www/Marketplace/space-eye-pruebas, proyecto seprueba).
:4200  V2 (/var/www/Marketplace/space-eye-v2, proyecto space-eye-v2): todo lo
       nuevo, ESPEJO de los equipos de V1 + el telefono de pruebas directo.
```

### 1. Monitoreo de pantalla probado en el telefono de pruebas (0.15.x)

Ciclo completo validado en :4100 tapando y destapando la pantalla: alertas
abiertas con evidencia y recuperadas solas por el equipo con su foto. En el
camino se corrigio, todo con pruebas unitarias (43 en verde):

- La camara en segundo plano (Android 14 niega el tipo FGS camara si la app no
  esta al frente): se conserva y el dashboard avisa si Android la niega.
- La exposicion automatica escondia las zonas quietas: se fija AE/AWB durante
  cada vuelta, y se limpia al volver a la vista en vivo (la dejaba negra).
- "Camara movida" se mide con la mediana de los puntos que casan, y solo con
  rasgos FUERA de la pantalla (lo que se mueve dentro no cuenta).
- Una alerta agrupada ("varios gabinetes") con su clave del servidor ya no tumba
  la vuelta; una vuelta interrumpida se juzga solo con su tramo mas largo.
- Aprendizaje configurable por equipo (2 h por omision; "solo la primera vuelta"
  para pruebas) y creativos en modo continuo.

### 2. Rediseño UX/UI con el Brand Book (`a1e50f5`, `2e3631e`)

Tema comun (`frontend/src/js/tema.js` + `styles.css`, componentes `se-*`),
ficha del equipo en pestañas, indicadores y historiales consistentes. "Tomar
foto" siempre a la mano: dentro del vivo, disparador sobre el video y barra fija
al bajar (abajo en el celular). Revisado sin desbordes a 360/768/1024/1920 px.

### 3. Vista en vivo para varias personas (`5faec7d`)

El telefono manda su video UNA vez al servidor de medios (MediaMTX) y este lo
reparte: el backend contesta la oferta del telefono por WHIP y los navegadores
ven por WHEP. Sin cambiar la APK. Espectador por PESTAÑA (todos usan la misma
cuenta); se corta al irse el ultimo. MediaMTX espera 10 s los primeros cuadros
(con 2 s colgaba a los telefonos que conectan por TURN).

### 4. Auditoria antes de produccion (`bce869c`)

Tres revisiones en paralelo (APK, backend, frontend). Lo grave, corregido:
una alerta rechazada se reenviaba con su foto en cada vuelta (cientos de MB/dia);
cada vistazo guardaba su JPEG de 3-5 MB (memoria); el catalogo de creativos no
tenia tope; la evidencia de fallas se iba a las instancias de SPACE OS; marcar
la pantalla de una Pi borraba sus creativos; la migracion del ENUM de fotos va
con ALGORITHM=INSTANT.

### 5. V2 en :4200 como ESPEJO de V1 (`3828d12` y siguientes)

Los equipos de campo no se pueden reinstalar, asi que V2 no los tiene: los
refleja. Cada 4 s copia de la base de V1 lo que reportan (solo columnas comunes,
INSERT ... ON DUPLICATE, nunca REPLACE) y les manda ordenes por el Redis de V1
(`backend/src/utils/espejo.ts`, `workers/espejoWorker.ts`). Fotos de V1
montadas solo lectura. Probado en local con V1 real (`c7a10ee`) y un telefono
simulado: foto, vivo con dos visores, corte al irse el ultimo, edicion escrita en
las dos. Las migraciones 015-019 corrieron sobre una copia de la base real.

- Escribe en V1 solo: filas de `commands` y las ediciones de un equipo.
- Rechaza (409): campañas, programacion y borrados — se hacen en :4000.
- Programador APAGADO en V2 (lo dispara V1; si no, cada foto saldria doble).
- Respaldo de V1 del despliegue: `/root/respaldos/espejo-2026-10-01_1024/`.
- TRAMPA: el backend de V2 vive en dos redes; sus servicios se llaman v2mysql,
  v2redis y v2mediamtx para que "redis" nunca resuelva al de produccion.

**Equipos propios de V2**: numeran desde 1.000.000.000 (`BASE_PROPIO`); el
espejo no los borra ni los pisa. El telefono de pruebas se mudo de :4100 con todo
su historial (81 fotos, 13 fallas, 12 creativos) como equipo `1000000002`
(`infra/deploy/v2/mudar-prueba-a-v2.sh`). La APK 0.15.15 apunta a :4200 y se da
de alta sola si el servidor rechaza su llave.

### Pendientes

1. **Mudar el telefono**: encenderlo y, en :4100, Mas -> Actualizar (0.15.15).
2. **Probar desde :4200 con un equipo de campo real**: una foto y el vivo con dos
   navegadores (no se hizo para no gastar datos de una pantalla real sin aviso).
3. **Conmutar** cuando V2 sea la buena (README de `infra/deploy/v2`): migraciones
   ya ensayadas; despues, APK 0.15+ a la flota para que tengan monitoreo.
4. Programacion de fotos para los equipos propios de V2 (hoy apagada para todos).
5. Memoria del droplet: ~660 MB libres con las tres instancias (swap 4 GB). Si se
   pone lento, apagar :4100 primero.
6. Siguen de antes: SE.4 aviso saliente, pantalla de descarga del instalador,
   dominio + HTTPS, Pi/PC con el mismo analisis de fallas.

---

## 2026-09-21 — Space Eyes se convierte en un modulo de SPACE OS

Se cerro el encargo de llevar el modulo a un dashboard de monitoreo. Primero la
maqueta (aprobada antes de escribir codigo, cuatro tableros: listado, ficha,
comparar y movil) y luego la implementacion sobre lo que ya funcionaba. **Nada
de lo que habia se quito**: la camara dentro de la ficha comercial
(`SpaceEyeVision.tsx`) sigue igual.

### Lo que se abrio en ESTE backend, y lo que NO se abrio

`POST /api/eyes/devices/:id/captura` — pedirle una foto ahora a un equipo, desde
una instancia. Ruta propia y no `POST /api/devices/:id/command` a proposito: esa
acepta ocho tipos de orden (reiniciar la app, abrir la transmision, cambiar la
configuracion, actualizar el programa), asi que dejar entrar una llave ahi seria
dar las ocho para conseguir una, y la novena que se agregue vendria de regalo.
Aqui el tipo de orden **no es un parametro**. Ademas aquella ruta apunta el autor
con `req.user!.uid`, y una llave no es un usuario: con ella entrando, esa linea
revienta con 500 en vez de negar.

`GET /api/devices/:id/telemetry` entro en la lista blanca de llaves, y con el
mismo movimiento se le puso el **candado del dueno**, que no tenia. Sin eso,
abrir esa ruta habria entregado el historico —bateria, senal, temperaturas— de la
flota entera a cualquier instancia que supiera un id: el mismo agujero que se
cerro en la lista de equipos en septiembre, otra vez y por otra puerta.

La captura es **la unica ruta de la lista blanca que no es GET**. Por eso la
marca `escritura` de una llave alcanza exactamente eso y nada mas. El dia que se
agregue otra, hay que volver a mirar que significa esa marca.

### Como se verifica, sin depender de que alguien se acuerde

`npm run prueba:captura-instancia` (en `backend/`). Crea sus propias llaves,
prueba los seis caminos y las revoca. Comprueba que el dueno pide la foto; que
una llave de solo lectura y un testigo de alta **no**; que **un equipo ajeno da
404** aunque la llave tenga escritura; que el historico respeta al dueno; y que
`command`, `logs`, el export CSV, `schedules`, `llaves` y `reaprender` **siguen
cerradas**. Esa ultima parte es la que de verdad importa.

### Del lado de SPACE OS (su repo, SIN COMMITEAR, se entrega como parche)

Menu con grupo propio entre Inventario y Comercial; listado tipo centro de
monitoreo; ficha con la fotografia de protagonista, la barra de estado encima de
la imagen, las dos procedencias de foto separadas y comparables, y el historico
en graficas. Permisos reutilizados (`inventario.ver` para mirar,
`inventario.crear` para encender la camara) para **no necesitar migracion**: su
catalogo de permisos viaja en sus migraciones y `tienePermiso` es fail-closed, o
sea que un modulo nuevo sin su fila deja la pantalla en 403 para todos.

La «foto del cliente» NO es almacenamiento nuevo: es la galeria de la pantalla
(`sitios.fotos`), que ya existe y que el cliente ya llena desde Inventario.

Verificado con SU arnes: 11 casos e2e con sesion y RLS de verdad
(`lib/test/space-eyes.e2e.test.ts`), y las 1158 pruebas unitarias suyas en verde
—una se puso roja por mi culpa y con razon: su pantalla de 404 exige un atajo por
cada fase del menu, y yo habia agregado una fase sin atajo—.

Todo el detalle, y lo que su equipo tiene que aplicar, en
`docs/ENTREGA_MODULO_SPACE_EYES.md`.

### Pendientes que deja

1. **Desplegar.** Migraciones 015/016/017 primero, luego backend y frontend.
2. **El parche de `SPACE_EYE_KEY`** sigue sin aplicarse en su repo. Mientras
   entren con la cuenta admin, el aislamiento entre instancias es decorativo.
3. La pantalla de descarga del instalador sellado (su lado) y `SPACE_EYE_*` en
   su `instancia.env.example`.

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

---

## 24-sep-2026 — Monitoreo de la pantalla en el equipo (APK 0.15.0; ver la entrada del 1-oct para lo que siguio)

El celular vigila su pantalla por si mismo: reconoce creativos y busca fallas
SIN mandar imagenes; solo avisa cuando algo cambia de estado. Todo en la rama
`feature/playlog-logs`, sin commitear ni desplegar. SPACE OS no se toco.

**Que detecta** (ver `android/.../pantalla/SaludAnalisis.kt`): pantalla apagada
en horario, pantalla congelada, gabinete apagado, gabinete congelado, camara
movida, sin imagen. La idea: una falla NO cambia cuando cambia el anuncio; se
juzga una vuelta completa del loop (~4 min), nunca una foto. No detecta pixeles
sueltos, brillo desparejo leve ni parpadeo.

**Contra falsas alarmas** (`Seguimiento.kt`): 2 vueltas seguidas separadas 25+
min, umbral de confianza, una alerta por falla, recuperacion tras 2 vueltas
sanas, 24 h de aprendizaje (excluye solas las zonas que nunca cambian, p. ej. la
barda de TLALPAN), lo descartado a mano calla 7 dias, tope diario.

**Medido con fotos reales** (MANUEL DUBLAN, vuelta de 4 min; TLALPAN, 12 fotos) y
fallas simuladas: 0 falsas alarmas; gabinete apagado detectado con 0.87-0.89.
Pruebas: `cd android && ./gradlew testDebugUnitTest` (30) y
`cd backend && npm run prueba:monitoreo` (22, contra el backend local).

**Datos**: ~600 bytes de configuracion por vuelta + resumen en el latido; una
foto de evidencia (~200-400 KB) solo al abrir o cerrar una falla.

**Dashboard**: tarjeta "Pantalla y fallas" en la ficha (4 esquinas, gabinetes,
zonas tapadas, horario de 6 a 24 por omision, historial) y pagina `/fallas.html`
con el numero de abiertas en el menu.

**Para desplegar**: migracion `018_monitoreo_pantalla.sql`; backend; frontend;
APK 0.15.0 (solo arm64: 43.7 MB). No probado todavia en un telefono real.

**Pendiente**: el mismo analisis en la Raspberry y el PC + Hikvision (Python con
las mismas pruebas); integracion con SPACE OS; la vigilancia de creativos de la
Raspberry sigue encendida en produccion y subiendo fotos basura.
