# Space Eyes — arquitectura definitiva (padre / hijos)

Decisiones tomadas por Carlos el 2026-09-22. Este documento dice cómo funciona
hoy, qué cambia, y cómo queda. Se escribió **antes** de tocar código, a petición
suya, para que la implementación no sea una solución temporal.

---

## 1. Cómo funciona hoy

Hay **dos planos** que conviene no confundir, porque casi todas las decisiones de
abajo salen de dónde está la frontera entre ellos.

### El plano de dispositivos — Space Eye

Un servicio nuestro, hoy único, en `http://159.203.188.58:4000`. Es el que habla
con el hardware:

| Pieza | Cómo funciona hoy |
|---|---|
| **Alta** | El agente arranca, manda `device_uid` + modelo + versión a `POST /api/device/register`, y recibe un **JWT de equipo** (365 días) cuyo hash queda en `devices.auth_token_hash`. Desde la v0.6.0 / 1.5.0, `pi-agent` y `pc-agent` mandan además un **testigo de alta**, y el servidor estampa el dueño: el equipo **no** declara de quién es. |
| **A dónde apunta** | **Compilado o en configuración.** La APK lo lleva horneado (`SERVER_URL`, propiedad `serverUrl` de Gradle); `pc-agent` y `pi-agent` lo traen como valor por omisión y admiten `server_url` en su `config.json`. |
| **Estados** | El equipo reporta cada 60–180 s a `POST /api/device/status`: batería, temperaturas, señal, red, consumo. Se guarda en `device_status`; a los 10 min sin reportar se da por caído. |
| **Capturas** | Órdenes en cola (`commands`) que el equipo recoge por socket o por sondeo; la foto sube a `POST /api/device/photo` y de ahí al verificador de IA. |
| **Vista en vivo** | RTSP del agente a **MediaMTX** (8554), y del navegador se consume por **WHEP** (8889, medios en 8189/udp). Con NAT de por medio entra **coturn** (3478 + 49160-49200/udp). La APK va por P2P; `pi-agent` y `pc-agent` por servidor de medios. |
| **Actualización remota** | El dashboard manda `UPDATE_APP`; el agente baja el binario publicado, **comprueba su SHA-256**, lo prueba con `--version` y solo entonces lo sustituye. Si no arranca, vuelve solo al anterior. |

### El plano de negocio — SPACE OS

Un sistema multi-instancia: un **padre** y **hijos**, cada uno en su droplet con
su propio Postgres y su RLS. Consume Space Eye **por API**, nunca al revés:

- **Llave de servicio con alcance** (`api_keys.owner`): la instancia solo ve los
  equipos de su empresa. Sin alcance (el padre) ve la flota entera.
- **Dos usos de credencial, que no se mezclan**: `lectura` consulta; `alta` es el
  testigo que viaja dentro de un instalador y **no lee nada**.
- **El espejo** (`GET /api/eyes/cambios?desde=`): de aquí cada instancia saca su
  copia local. Existe porque la RLS de una instancia **no puede proteger datos
  que no están en su base**, y porque preguntar al tercero en cada pintada sería
  un viaje por cada lista, filtro e historial.

### Qué es «espejo» hoy, exactamente

Que los equipos de g500 viven en **nuestro** Space Eye y SPACE OS los **refleja**
leyendo por API. Aplica al padre y a g500. No significa que los datos estén
duplicados a medias: significa que el dueño del dato es Space Eye y SPACE OS
guarda una copia para poder trabajar con ella.

---

## 2. Qué cambia

Cuatro decisiones, tomadas el 22-sep:

1. **Un Space Eye por cada hijo.** Cada droplet hijo lleva su Space Eye completo.
2. **Dominio + TLS, y además proxy** de fotos y vivo a través de la instancia.
3. **Una build por empresa** (APK, agente de PC, agente de Pi).
4. **El dashboard de Space Eye se conserva** como herramienta de operación.

La decisión 1 arrastra una consecuencia que hay que resolver a propósito: **el
padre deja de tener un solo sitio de donde leer.** Se resuelve con el mecanismo
que ya existe —el espejo—, ahora del hijo hacia el padre.

---

## 3. La arquitectura definitiva

```
  ┌─────────────────── DROPLET DEL HIJO (una empresa) ───────────────────┐
  │                                                                      │
  │   equipos de ESA empresa                                             │
  │   (APK / Pi / PC)                                                    │
  │        │  HTTPS + JWT de equipo                                      │
  │        │  RTSP 8554 (vivo)                                           │
  │        ▼                                                             │
  │   ┌──────────────┐        llave de lectura        ┌──────────────┐   │
  │   │  SPACE EYE   │ ◀───────  (red interna)  ──────│  SPACE OS    │   │
  │   │  del hijo    │                                │  hijo        │   │
  │   │              │   fotos y vivo POR PROXY  ────▶│  (HTTPS)     │   │
  │   │  MySQL       │                                └──────┬───────┘   │
  │   │  MediaMTX    │                                       │           │
  │   │  coturn      │                                       │           │
  │   │  worker IA   │                                       │           │
  │   │  dashboard   │ ◀── operación (nosotros)              │           │
  │   └──────┬───────┘                                       │           │
  └──────────┼───────────────────────────────────────────────┼───────────┘
             │  espejo: GET /api/eyes/cambios?desde=          │
             │  (llave de LECTURA del padre, por hijo)        │
             ▼                                                ▼
        ┌─────────────────────────────────────────────────────────┐
        │                  SPACE OS — PADRE                        │
        │   agrega la flota de TODOS los hijos en su copia local    │
        └─────────────────────────────────────────────────────────┘
```

### Las reglas que no se rompen

**Un equipo habla SIEMPRE con el Space Eye de su empresa, y con nadie más.** No
habla con SPACE OS —ni hijo ni padre—, no habla con el Space Eye de otra empresa
y no cambia de servidor por su cuenta. Un equipo es del plano de dispositivos.

**SPACE OS nunca habla con un equipo.** Todo lo que quiere de un equipo lo pide a
su Space Eye por una ruta acotada. Por eso una instancia comprometida no puede
encender cámaras ajenas ni reiniciar agentes: no tiene con qué.

**El padre lee, no manda.** Agrega por el espejo, con una llave de **lectura** por
hijo. No opera equipos de un hijo desde el padre.

### Pieza por pieza

| Pieza | Cómo queda |
|---|---|
| **Equipos actuales (g500)** | **No se tocan.** `159.203.188.58` pasa a ser el Space Eye de g500; los equipos ya apuntan ahí y siguen igual. Lo único que cambia es el rótulo y que el padre lo lea por espejo. |
| **Equipos nuevos** | Se instalan con la build **de su empresa**, que apunta al Space Eye de su hijo, y con el **testigo de alta** de esa instancia. Nacen con dueño, sin que nadie los asigne a mano. |
| **APK** | Una build por empresa: `./gradlew assembleRelease -PserverUrl=https://<space-eye del hijo>`. El mecanismo **ya existe** en `build.gradle.kts`. Falta que la APK acepte el **testigo** (hoy no lo manda: se registra sola con la URL compilada). |
| **Raspberry Pi** | `config.json` con `server_url` y `testigo_de_alta`. **Ya funciona** desde la v0.6.0. |
| **PC + Hikvision** | El paquete lleva `SpaceEyeAgente.exe`, `ffmpeg.exe` y `testigo.txt`. **Ya funciona** desde la v1.5.0; el instalador recoge el testigo solo. |
| **Autenticación de equipos** | Sin cambios: testigo de alta (una vez) → JWT de equipo (365 d, hash en base). El testigo **no lee nada** y se revoca. |
| **Comunicación segura** | **HTTPS obligatorio**, con dominio por instancia. Hoy es HTTP plano y **eso rompe el módulo en producción**: una página HTTPS no carga imágenes HTTP. Además, fotos y vivo se sirven **por proxy de la instancia**, así el navegador del cliente nunca habla directo con Space Eye. |
| **Estados y capturas** | Igual que hoy, pero contra el Space Eye del hijo: `/api/device/status`, cola de órdenes, y `POST /api/eyes/devices/:id/captura` desde SPACE OS —la única ruta que una llave puede escribir—. |
| **Vista en vivo** | MediaMTX y coturn **en el droplet del hijo**. El navegador consume WHEP a través del proxy de la instancia, en su mismo dominio HTTPS. Requiere abrir 8554/tcp, 8889/tcp, 8189/udp y 3478 + 49160-49200/udp en ese droplet. |
| **Alta de equipos** | La pantalla de Space Eyes entrega el instalador **de esa empresa** y su testigo. El testigo completo se pide con un clic y solo con permiso de crear. |
| **Actualizaciones futuras** | Un canal de publicación **por empresa**: cada Space Eye publica sus manifiestos (`space-eye.json`, `space-eye-agente.json`, `space-eye-pi-agent.json`) y sus binarios. El agente ya verifica SHA-256 y revierte si no arranca. |
| **Dashboard de Space Eye** | Uno por instancia, para nosotros: reiniciar agentes, actualizar por red, asignar dueños, revocar llaves. Las operaciones de flota **no** pasan al cliente. |

### Lo que esta decisión cuesta, dicho claro

Un Space Eye por hijo multiplica por N: MySQL, MediaMTX, coturn, almacenamiento
de fotos, worker de IA, certificados, copias de seguridad y actualizaciones de
servidor. Y **una APK firmada por cliente**, con su canal de actualización.

Se mitiga así, y conviene hacerlo desde el primer hijo:

- **Un solo `docker-compose` parametrizado** para levantar un Space Eye entero
  (ya existe: `infra/docker-compose.ip.yml`); un hijo nuevo es un `.env`.
- **La misma imagen** para todos: lo que cambia es configuración, nunca código.
- **Una llave de alta y una de lectura por instancia**, creadas en su alta.
- La APK es lo único que se compila aparte; el resto de agentes solo cambia un
  archivo de texto.

### Cómo se migra sin romper nada

1. **Nada se mueve de sitio.** Los equipos de g500 siguen contra
   `159.203.188.58`, que pasa a ser su Space Eye.
2. Ese Space Eye estrena **dominio y certificado**, y los agentes cambian su
   `server_url` al dominio en su siguiente actualización remota —sin ir al sitio—.
   La APK necesita una versión nueva; hasta entonces sigue por IP y funciona.
3. El **padre** estrena su llave de lectura contra ese Space Eye y llena su
   espejo. Lo que hoy ve por API, mañana lo ve igual.
4. El **siguiente hijo** nace ya con su Space Eye propio y su build sellada.

---

## 4. Qué falta implementar, en orden

| # | Qué | Por qué primero | Esfuerzo |
|---|---|---|---|
| 1 | `SPACE_EYE_*` en `infra/env/instancia.env.example` | Hoy un droplet hijo **no puede** nacer sabiendo hablar con Space Eye | 1 h |
| 2 | **Proxy de fotos** por la instancia | Sin esto el módulo **no se ve** en producción (HTTPS vs HTTP) | 3 h |
| 3 | Dominio + TLS para el Space Eye de g500 | Cierra el bloqueador de raíz y deja de viajar en claro | media jornada |
| 4 | APK con **testigo de alta** y `serverUrl` por empresa | Cierra el alta de teléfonos sin asignar a mano | 1 jornada |
| 5 | Proxy del **vivo** (WHEP) y su prueba en producción | Es la función que hoy no funciona fuera del servidor | 2 jornadas |
| 6 | Resto de funciones a SPACE OS (ajustes de imagen, programadas, campañas, galería, verificaciones) | Ya con la base en producción | 3–4 jornadas |

---

## 5. El mapa real de dominios, y los nombres que faltan

Lo que existe hoy (22-sep), confirmado contra los servidores:

| Nombre | IP | Qué es | Protocolo |
|---|---|---|---|
| `space-os.io` | 137.184.107.53 | **el padre**, sistema real | HTTPS ✔ |
| `g500.space-os.io` | 142.93.113.106 | **hijo de g500** | HTTPS ✔ |
| `demo` · `ensayo4` · `prueba` | varias | demos | HTTPS ✔ |
| — | 159.203.188.58 | **Space Eye** (todas las cámaras) | **HTTP, sin nombre** ⚠ |

La convención que se propone, para que no haya que inventarla en cada alta:

```
eyes.<instancia>.space-os.io   →  el Space Eye de esa instancia
```

Es decir **`eyes.g500.space-os.io`** para el de g500, y `eyes.<hijo>.space-os.io`
para cada hijo nuevo. El registro es un `A`, «DNS only», igual que los demás.

**Dónde vive el Space Eye de g500: se queda en 159.203.188.58.** Mudarlo al
droplet de g500 obligaría a mover MySQL, las fotos, MediaMTX y coturn, y los
equipos en campo apuntan a esa IP: sería una migración con riesgo y sin premio.
«Un Space Eye por hijo» se cumple igual — cada hijo tiene el suyo; que además
comparta máquina con su SPACE OS es un detalle de despliegue, no de
arquitectura. Los hijos nuevos sí pueden nacer con el suyo en su propio droplet.

## 6. Cómo se pone en producción, sin romper la flota

Dos cosas que faltaban en el repositorio y que habrían mordido en el despliegue,
ya arregladas:

- **El compose de producción no tenía MediaMTX.** Estaba solo en el de IP, así
  que no existía una configuración con HTTPS *y* vista en vivo a la vez: o
  certificado sin vivo, o vivo sin certificado. Con el cliente entrando por
  https, lo segundo es no tener vivo.
- **El compose de producción no publicaba el 4000.** Con Caddy delante todo
  entra por 443, que es lo correcto… salvo que **los equipos ya instalados
  apuntan a `http://<ip>:4000`**. Cambiar de compose sin más habría dejado a la
  flota entera sin servidor, en silencio. Ahora el 4000 sigue abierto como
  **puente de migración** y se cierra el día que ningún equipo apunte a la IP.

### ATENCIÓN: en el droplet de Space Eye **manda Apache**, no Caddy

Comprobado el 22-sep contra el servidor: **Apache 2.4.58 es el dueño del 80 y
del 443** en `159.203.188.58`, sirviendo `market.adavailable.com` con su
certificado de Let's Encrypt. `eyes.g500.space-os.io` ya resuelve ahí y cae en el
vhost por omisión.

O sea que **Caddy no puede tomar los puertos en esta máquina**, y el plan de
cambiar de compose no aplica aquí. La buena noticia es que el camino que sí
aplica es **mucho menos arriesgado**: no se toca el compose, no se reinicia la
pila, y los equipos en campo ni se enteran. Solo se agrega un vhost delante.

(El compose con Caddy queda igual de válido para un **hijo nuevo** que nazca en
un droplet limpio. Por eso se corrigió y no se retiró.)

### Los pasos, en orden

1. **DNS** — hecho: `eyes.g500.space-os.io` → `A` → `159.203.188.58`.

2. **Módulos y vhost** (en el droplet, como root):
   ```bash
   a2enmod proxy proxy_http proxy_wstunnel ssl rewrite headers
   # el archivo está en el repo: infra/apache/eyes.g500.space-os.io.conf
   scp infra/apache/eyes.g500.space-os.io.conf root@159.203.188.58:/etc/apache2/sites-available/
   ```

3. **El certificado**, antes de habilitar el vhost de 443 (el archivo apunta a
   rutas que todavía no existen, así que habilitarlo antes tumba Apache al
   recargar):
   ```bash
   certbot certonly --apache -d eyes.g500.space-os.io
   a2ensite eyes.g500.space-os.io
   apache2ctl configtest && systemctl reload apache2
   ```
   `configtest` antes del reload no es adorno: un vhost con un error deja
   Apache sin arrancar, y ahí se cae **también market.adavailable.com**.

4. **El backend**, en `backend/.env` del droplet. **Se agrega UNA sola línea**:
   ```
   MEDIAMTX_WHEP_PUBLIC=https://eyes.g500.space-os.io/whep
   ```

   **NO se toca `PUBLIC_BASE_URL`, y no es pereza.** La auditoría encontró que
   esa variable decide tres cosas más, todas hacia los equipos:

   - **De dónde bajan las actualizaciones**: la orden `UPDATE_APP` lleva
     `${PUBLIC_BASE_URL}/space-eye.apk`. Cambiarla mueve el origen de la OTA de
     toda la flota en el mismo momento, y si el dominio o el certificado
     fallaran, los equipos se quedan sin poder actualizarse.
   - **Por dónde publican el RTSP**: si `MEDIAMTX_HOST` está vacío, el host sale
     de aquí. Hoy los agentes publican contra una IP literal; cambiarlo les
     agrega una dependencia de DNS que antes no tenían.
   - **Qué URL recibe el verificador de IA** para leer cada foto.

   Ninguna de las tres necesita cambiar para que el módulo funcione por HTTPS.
   Se mueven después, una por una y con su propia comprobación. **La regla del
   despliegue es cambiar lo mínimo que resuelve el problema.**

   Reiniciar **solo** el backend, sin tocar el resto de la pila:
   ```bash
   docker compose -f infra/docker-compose.ip.yml --env-file backend/.env up -d backend
   ```
   Siempre con `--env-file`, o `MEDIAMTX_PASS` se queda vacía y el vivo deja de
   autenticar.

5. **Comprobar, en este orden** (el segundo es el que importa):
   ```bash
   curl -sI https://eyes.g500.space-os.io/api/app/version   # 401 = vivo y pidiendo credencial
   curl -sI http://159.203.188.58:4000/api/app/version      # 401 = LA FLOTA NO SE ENTERO
   curl -sI https://market.adavailable.com/                 # el vecino sigue en pie
   ```

6. **El hijo de g500** (`g500.space-os.io`), en su `.env`:
   ```
   SPACE_EYE_BASE_URL=https://eyes.g500.space-os.io
   SPACE_EYE_KEY=se_...
   SPACE_EYE_PROVISION_TOKEN=se_...
   ```

7. **Las builds nuevas** ya apuntan al dominio:
   ```bash
   ./gradlew assembleRelease -PserverUrl=https://eyes.g500.space-os.io
   ```

Los equipos viejos **no se tocan**: siguen por IP hasta que una actualización les
cambie el `server_url`. La APK necesita versión nueva; los agentes de PC y Pi,
solo un archivo.

## 7. Lo que este documento NO decide

- El registro DNS `eyes.g500.space-os.io` lo tienen que crear ustedes (§6, paso 1).
- **Quién paga y opera** los droplets de cada hijo.
- Si un cliente puede **mover el zoom y el brillo** de su cámara, o si eso se
  queda del lado de operación. Afecta a qué se migra en el paso 6.

---

## 8. La auditoría antes de subir (22-sep)

Se ensayó el despliegue en local **con el mismo Apache 2.4.58 del droplet**, en
un contenedor, con el vhost real delante del backend real. Resultados:

| Prueba | Resultado |
|---|---|
| `apache2ctl configtest` del vhost | **Syntax OK** |
| `/api/app/version` a través del proxy | 401 — llega al backend |
| El dashboard de operación | 200, HTML completo |
| `/whep/clave/whep` | llega a MediaMTX como `/clave/whep`, que es lo que espera |
| Una ruta cualquiera | va al backend, el `/whep/` no se la lleva |
| **Una foto real firmada** | **idéntica byte por byte** por el proxy y directa |
| Firma alterada | **403** a través del proxy |
| socket.io, sondeo | 200 |
| socket.io, WebSocket | **101 Switching Protocols** |
| La URL del vivo con el dominio puesto | `https://eyes.g500.space-os.io/whep/<clave>/whep` |

**Dos cosas se corrigieron por lo que encontró la auditoría:**

1. **`LimitRequestBody` se quitó del vhost.** Llevaba un comentario diciendo que
   cortaba las subidas grandes. Se probó con el tope en 1 KB y un cuerpo de
   10 KB **llegó igual al backend**, tanto en el vhost como dentro de un
   `<Location>`: la directiva no se aplica a lo que reenvía `mod_proxy`. El
   límite de verdad es el de multer en el backend (20 MB). Una línea que promete
   algo que no hace es peor que no tenerla.
2. **`PUBLIC_BASE_URL` sale del paso 4** (ver arriba).

Lo que la auditoría **no** puede comprobar desde aquí, y hay que mirar en el
droplet: que `certbot` emita el certificado, y que Apache siga sirviendo
`market.adavailable.com` después del `reload` — por eso el `configtest` es
obligatorio antes de recargar.

---

## 9. En qué orden se sube, y quién empuja a quién

Son **tres cosas distintas, en tres sitios distintos**, y el orden entre ellas no
es una preferencia: una depende de la otra.

### Nadie empuja nada a los hijos

El runbook de ellos lo dice en su primera línea: **«la instancia jala; el padre
no empuja»**. Cada instancia corre `update.sh` por cron, compara el **canal** que
tiene configurado (`beta` o `estable`), jala la imagen, comprueba salud y
**vuelve atrás sola** si no arranca. El padre no participa.

O sea que el orden entre instancias **se consigue con los canales**, no mandando
nada: quien esté en `beta` lo recibe primero; los de `estable`, cuando se
promueve. Promover no reconstruye — es el mismo binario, byte por byte.

### El orden

| # | Qué | Dónde | Por qué ahí |
|---|---|---|---|
| 0 | Aplicar el parche y hacer merge | repo de SPACE OS | No commiteamos en su repo; el parche es la entrega |
| 1 | **Space Eye** | droplet `159.203.188.58` | **Va primero**, ver abajo |
| 2 | Tag `vX.Y.Z` → canal `beta` | CI de ellos | La suite completa corre antes de construir la imagen |
| 3 | Una **demo** toma `beta` | `prueba` / `ensayo4` | Confirma que el resto de SPACE OS no se movió |
| 4 | El **padre** con su llave | `space-os.io` | Es quien ve la flota entera: aquí se valida el módulo con datos reales |
| 5 | Promover a `estable` | CI | g500 lo jala por cron, sin que nadie entre |

### Por qué Space Eye va primero

Porque el módulo **depende de rutas que hoy no existen** en producción. Al revés,
lo que se ve es esto:

- «Tomar foto» → **404**, la ruta de captura no está.
- La tarjeta de histórico → **403**, `/telemetry` no está en la lista blanca.

Y al derecho no pasa nada: desplegar Space Eye primero **no cambia nada para
nadie**. Agrega rutas que todavía no usa ningún cliente, y el candado de dueño
que se le puso a `/telemetry` no afecta al dashboard, que entra con sesión de
usuario y no con llave.

### El módulo se degrada solo, y eso da margen

Sin `SPACE_EYE_*` configuradas, la pantalla dice «la integración no está
configurada» y **nada más se rompe**. Así que la imagen puede llegar a una
instancia antes que su configuración, y el orden entre los pasos 3, 4 y 5 no es
frágil.

### Una nota sobre la CI de ellos

`release.yml` corre typecheck, unitarias, build y **e2e** antes de publicar la
imagen. Los 17 casos de `space-eyes.e2e.test.ts` necesitan un Space Eye y sus
variables; **en su CI no estarán, y entonces se reportan SALTADOS, no fallidos**.
Está hecho a propósito: una prueba que no puede correr no debe tumbar un release
ajeno, y tampoco debe pasar en verde fingiendo que comprobó algo.
