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

## 5. Lo que este documento NO decide

- **Qué dominio** usa cada Space Eye. Hace falta que lo definan ustedes.
- **Quién paga y opera** los droplets de cada hijo.
- Si un cliente puede **mover el zoom y el brillo** de su cámara, o si eso se
  queda del lado de operación. Afecta a qué se migra en el paso 6.
