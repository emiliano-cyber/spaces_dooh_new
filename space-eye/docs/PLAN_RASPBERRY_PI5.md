# SPACE EYE sobre Raspberry Pi 5 — Plan de implementación

Análisis de la cotización **573982 de AG Electrónica (30-jul-2026, $3,760 MXN)** y plan
para convertir SPACE Eyes en un dispositivo propio basado en Raspberry Pi 5, conviviendo
con los teléfonos Android y las cámaras IP que ya están en producción.

> Estado: **propuesta para aprobación**. No se ha escrito código del agente todavía.

---

## 0. Resumen ejecutivo

**Lo bueno:** la arquitectura actual ya está preparada para esto. El backend no distingue
"teléfono" de "otra cosa": expone un contrato `/api/device/*` + Socket.IO, y ya existe un
segundo tipo de equipo (`pc-agent`, Node.js) funcionando en producción con ese mismo
contrato. **La Pi 5 entra como un tercer tipo de equipo sin cambiar el backend.** El
agente de PC es el punto de partida del agente de Pi: se reaprovecha su estructura
completa y se cambia el módulo de cámara.

**Lo malo — 3 hallazgos bloqueantes en lo comprado:**

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | La **fuente es de 5.1 V 2.5 A micro-USB** (partida 1) y el **cable es USB-A → micro-USB** (partida 5). La Pi 5 se alimenta por **USB-C** y pide 5 V/5 A (27 W). | **No enciende.** Ni siquiera conecta físicamente. Ambas partidas son de la era Pi 3. |
| 2 | La **cámara Module 3** trae cable plano de **15 pines**; la Pi 5 usa conectores **MIPI de 22 pines (mini)**. | **No conecta.** Falta el cable adaptador 22↔15 pines. |
| 3 | **No hay nada de conectividad**: ni módem LTE, ni antenas, ni SIM. | Sin esto el equipo no reporta nada. |

Además, la Pi 5 **no tiene codificador H.264 por hardware** (Broadcom lo eliminó respecto
a la Pi 4). Eso condiciona la vista en vivo: hay que codificar por software y bajar la
meta a 720p, no 1080p. No es un impedimento, pero sí un cambio de expectativa.

**Costo real:** los $3,760 cotizados cubren ~35% de un equipo de campo. Un dispositivo
completo y montable en un espectacular sale en el orden de **$9,000–13,000 MXN**. Un
teléfono Android de gama media hace lo mismo por menos. La Pi se justifica por control
(sin Google Play matando servicios en segundo plano, OTA real, sin bloqueos de
fabricante), por disponibilidad de refacciones a 10 años y por expansión (Ethernet, PoE,
NVMe, GPIO). Conviene decidirlo con ese dato sobre la mesa.

---

## 1. Componentes adquiridos (lectura del PDF)

| # | Clave | Descripción | Precio | Veredicto |
|---|---|---|---|---|
| 1 | KSA-13B-051250HU | Fuente 5.1 V 2.5 A micro-USB | $154.31 | ❌ **Incompatible** (Pi 5 = USB-C) |
| 2 | RASPBERRY-PI-NOIR-CAMERA3 | Cámara NoIR 12 MP oficial (Module 3) | $662.93 | ⚠️ **Sirve, pero falta cable adaptador** y hay que validar el NoIR |
| 3 | RASPBERRYPI-5/4GB | Raspberry Pi 5, 4 GB RAM | $2,237.07 | ✅ Correcto |
| 4 | RASPBERRYPI5-MSD-RASPBIAN | microSD 16 GB con Raspbian | $154.31 | ⚠️ Sirve para el prototipo; **insuficiente para producción** |
| 5 | RPI-CABLE-USB-A-MICRO-USB | Cable USB-A → micro-USB | $32.76 | ❌ **No aplica** a la Pi 5 |

Subtotal $3,241.38 + IVA = **$3,760.00 MXN**. Vigencia 15 días naturales (vence ~14-ago-2026).

---

## 2. Función de cada componente y cómo se integra

### 2.1 Raspberry Pi 5 / 4 GB — el cerebro ✅
Sustituye al teléfono completo: corre el agente, la captura, la telemetría y el streaming.

- CPU Cortex-A76 quad a 2.4 GHz, muy holgada para el agente (el trabajo pesado es la
  codificación de video).
- **4 GB es suficiente**: el agente en Node ronda 80–150 MB; la captura de una foto de
  12 MP pide picos de ~200 MB. Sobra margen.
- Conectores relevantes: 2× MIPI CSI/DSI de 22 pines (cámara), PCIe FFC (NVMe), header
  40 pines (HATs), 4-pin PWM (ventilador), **conector de pila RTC**, USB-C (alimentación),
  Gigabit Ethernet, 2× USB 3.0 + 2× USB 2.0.
- **Sin codificador H.264 por hardware.** Fotos no se afectan (el ISP hace JPEG); el
  video en vivo se codifica con CPU.
- Consumo: ~3 W reposo, 7–9 W bajo carga, picos superiores con periféricos.

### 2.2 Cámara NoIR Module 3 (IMX708, 12 MP, autofoco) ⚠️
Se conecta por cable plano MIPI CSI-2 al puerto CAM/DISP de la Pi. Da autofoco por
detección de fase, HDR y control fino de exposición vía `libcamera`/`picamera2` — más
control del que teníamos en Android.

**Dos advertencias serias:**

1. **Falta el cable.** La Module 3 viene con cable de 15 pines (formato Pi 4). La Pi 5
   usa 22 pines mini. Hay que comprar el *Raspberry Pi Camera Cable Standard–Mini*
   (200/300/500 mm). **Sin ese cable la cámara no se puede conectar.** Conviene el de
   300 o 500 mm para acomodar la cámara dentro del gabinete.
2. **"NoIR" significa sin filtro de infrarrojo.** Está pensada para visión nocturna *con
   iluminador IR*. De día, la luz infrarroja contamina los canales de color y las fotos
   salen con tono lavado/magenta. Para nuestro caso de uso —**verificar que la lona o la
   pantalla muestra la creatividad correcta**— el color importa. Recomendación: comprar
   también una **Camera Module 3 estándar** (con filtro IR) y comparar ambas en el mismo
   sitio antes de decidir la de flota. La NoIR queda para sitios sin iluminación nocturna,
   acompañada de iluminador IR.

También hay que definir el **lente**: la versión estándar cubre ~75° en diagonal y la
*Wide* ~120°. Si la Pi se monta cerca del espectacular (en el propio bastidor), casi
seguro se necesita la **Wide** para que quepa la cara completa. Depende de la distancia
de montaje real → es una de las preguntas al final.

### 2.3 Fuente 5.1 V 2.5 A micro-USB ❌
Es la fuente de la Raspberry Pi 3. La Pi 5 alimenta por **USB-C** y negocia 5 V/5 A por
USB-PD. Con una fuente de 5 V/3 A arranca pero limita los periféricos USB a 600 mA
(`usb_max_current_enable`), lo que no alcanza con módem LTE + SSD. **Hay que comprar la
fuente oficial de 27 W USB-C.** Esta se puede devolver o reutilizar para otra cosa.

### 2.4 microSD 16 GB con Raspbian ⚠️
Sirve para el primer arranque, pero para un equipo 24/7 en la calle tiene dos problemas:

- **16 GB se queda corto** con fotos en cola, logs y sistema.
- **La microSD es el punto de falla #1 de las Pi en campo**: escrituras continuas la
  desgastan y termina corrompiéndose. Un equipo en un espectacular no se puede reparar
  con un cambio de tarjeta cada mes.

Además la imagen precargada estará desactualizada: de todos modos vamos a flashear
**Raspberry Pi OS Bookworm 64-bit Lite** limpio. Plan: microSD de **64 GB alta resistencia
(A2/High Endurance)** para el piloto y **SSD NVMe con HAT M.2** para la flota.

### 2.5 Cable USB-A → micro-USB ❌
No tiene función en esta arquitectura.

---

## 3. Qué falta por comprar

### Crítico — sin esto no hay dispositivo

| Componente | Para qué | Estimado MXN |
|---|---|---|
| **Fuente oficial USB-C 27 W (5.1 V/5 A)** | Alimentar la Pi 5 | $500–700 |
| **Cable cámara 22↔15 pines (300–500 mm)** | Conectar la Module 3 | $150–250 |
| **Active Cooler oficial** (o gabinete con ventilador) | La Pi 5 se estrangula a ~80 °C; dentro de un gabinete al sol en México es obligatorio | $200–350 |
| **Módem LTE + antenas** (HAT Waveshare SIM7600G-H / Sixfab EG25-G, o dongle USB) | Conectividad + **GPS incluido** en esos módulos | $1,500–3,000 |
| **SIM M2M con plan de datos** | Enlace | según operador |
| **Gabinete exterior IP65/IP66** + ventana óptica + visera + prensaestopas + soporte | Intemperie, sol y lluvia | $800–2,500 |

### Importante — para paridad con la APK y vida útil

| Componente | Para qué | Estimado MXN |
|---|---|---|
| **UPS / batería de respaldo con medidor I²C** (Waveshare UPS HAT, Geekworm X1200/X1202, PiSugar 3) | El backend **exige** `battery_pct`; permite apagado seguro y avisar del corte de energía | $700–1,500 |
| **microSD 64 GB alta resistencia** (piloto) o **HAT NVMe + SSD 256 GB** (flota) | Evitar la corrupción por desgaste | $300 / $1,200–1,800 |
| **Pila RTC para Pi 5** | Mantener la hora sin energía → `taken_at` correcto tras un corte | $150–250 |
| **Antena GPS activa** | Si se usa el GNSS del módem | $200–400 |
| **Protección contra sobretensión / fuente industrial DIN 5 V** | El espectacular tiene su propia acometida; los picos matan fuentes de consumo | $500–1,200 |

### Opcional / según sitio
- **Iluminador IR** (si se queda la NoIR en sitios sin luz).
- **HAT PoE+** (si el sitio ya tiene Ethernet: alimenta y conecta con un solo cable, y sale más barato que LTE por sitio).
- **Cable de red corto** para diagnóstico en sitio.

> **Los precios son estimaciones para dimensionar, no cotizaciones.** Hay que pedirle a
> Eduardo Sánchez (AG Electrónica) la cotización formal de la lista crítica; conviene
> preguntarle si manejan Waveshare/Sixfab, porque si no habrá que importarlo y eso agrega
> semanas al calendario.

---

## 4. Arquitectura de hardware propuesta

```
                    ┌──────────── GABINETE IP66 con visera ────────────┐
                    │                                                  │
   AC del           │   ┌──────────────┐      ┌────────────────────┐   │
   espectacular ────┼──▶│ Fuente 5V/5A │─────▶│  UPS / batería     │   │
   (con protección) │   │  (industrial)│      │  (medidor I²C)     │   │
                    │   └──────────────┘      └─────────┬──────────┘   │
                    │                                   │ 5 V          │
                    │                         ┌─────────▼──────────┐   │
                    │   Cámara Module 3       │                    │   │
                    │   ┌──────────┐  MIPI    │   RASPBERRY PI 5   │   │
                    │   │  IMX708  │─────────▶│   + Active Cooler  │   │
                    │   └────┬─────┘ 22↔15    │                    │   │
                    │        │ ventana        │  ┌──────────────┐  │   │
                    │        │ óptica         │  │ SSD NVMe     │  │   │
                    │        ▼                │  │ (o microSD)  │  │   │
                    │    (al exterior)        │  └──────────────┘  │   │
                    │                         └──┬──────────────┬──┘   │
                    │                            │ USB/HAT      │ RJ45 │
                    │                     ┌──────▼───────┐      │      │
                    │                     │ Módem LTE    │      │(opc.)│
                    │                     │ + GNSS       │      │      │
                    │                     └──┬────────┬──┘      │      │
                    └────────────────────────┼────────┼─────────┼──────┘
                                    antena LTE   antena GPS   Ethernet
                                    (pasamuros)  (pasamuros)   (PoE)
```

**Variante A — recomendada para el piloto.** Módem LTE **por USB** en vez de HAT: deja
libre el header de 40 pines para el UPS y evita el conflicto mecánico con el Active
Cooler. Más fácil de reemplazar en campo.

**Variante B — a evaluar para la flota.** Pi 5 + **router LTE industrial** en el mismo
gabinete, unidos por Ethernet (o PoE). Más caro y voluminoso, pero la conectividad la
resuelve un equipo diseñado para eso (doble SIM, watchdog de enlace propio, homologado).
Si la flota crece a decenas de sitios, esta variante baja muchísimo el soporte en campo.

**Presupuesto eléctrico:** Pi 5 bajo carga 7–9 W + cámara ~1 W + módem en picos de
transmisión 2–3 W + SSD 1–2 W ⇒ **pico ~15 W**. Por eso la fuente de 5 V/5 A (25–27 W),
no la de 2.5 A.

**Expectativa realista de la batería:** los UPS para Pi (2× 18650 ≈ 7 Wh) dan del orden de
**30–45 minutos** con la Pi trabajando. Su función es (1) apagar de forma segura sin
corromper el disco, (2) aguantar cortes breves y (3) **avisar del corte al dashboard** —
no operar horas sin energía. Si se requiere autonomía real de horas, hay que dimensionar
una batería aparte y eso cambia el gabinete.

⚠️ **Ojo con el litio dentro de un gabinete al sol.** Un gabinete cerrado en un
espectacular puede pasar de 60 °C. Las celdas Li-ion se degradan y se vuelven peligrosas a
esa temperatura. Recomiendo **LiFePO4** (mucho más tolerante) o, si solo se busca apagado
seguro, un módulo de supercapacitores. Es un punto a validar con el gabinete elegido.

---

## 5. Arquitectura de software

### 5.1 Principio rector
**El contrato de dispositivo no se toca.** La Pi habla exactamente los mismos endpoints
que la APK y el agente de PC:

```
POST /api/device/register          → { device_id, token }   (JWT de 365 días)
POST /api/device/status            → telemetría periódica
GET  /api/device/pending-commands  → respaldo si se cae el socket
POST /api/device/command-result
POST /api/device/upload-photo      → multipart, campo "photo"
POST /api/device/log
GET  /api/device/ice-servers       → STUN + TURN (coturn)

Socket.IO namespace /devices (auth: token del equipo)
  recibe: command, webrtc_answer, webrtc_ice_candidate, camera_control
  envía:  command_ack, webrtc_offer, webrtc_ice_candidate
```

Consecuencia: **cero cambios en el backend para que la Pi aparezca en el dashboard** con
galería, marca de información, verificación con IA, telemetría, horarios y campañas. Ya
está demostrado: es lo que hizo el agente de PC.

### 5.2 Sistema operativo
- **Raspberry Pi OS Bookworm 64-bit Lite** (sin escritorio), flasheado limpio.
- Zona horaria `America/Mexico_City`, `systemd-timesyncd` con NTP.
- **Watchdog por hardware** (`bcm2835_wdt`) + `systemd` con `Restart=always` y
  `WatchdogSec`: sustituye al `MonitorService`/`WatchdogWorker`/`BootReceiver` de Android.
- SSH por llave, sin contraseña; `unattended-upgrades` solo de seguridad.
- Sistema de archivos: `/var/log` en tmpfs o `journald` acotado, para no desgastar la SD.

### 5.3 El agente (Node.js) — reutilizando `pc-agent`
Estructura propuesta, calcada del agente de PC que ya funciona:

```
pi-agent/
  src/
    index.js       identidad estable, registro con reintentos, bucles de sondeo y telemetría
    api.js         cliente /api/device/*        ← se reutiliza casi tal cual
    camara.js      NUEVO: libcamera/picamera2 en vez de cámara IP
    telemetria.js  NUEVO: batería I²C, señal LTE, GPS, temperatura, consumo de datos
    stream.js      NUEVO: WebRTC por GStreamer
    comandos.js    TAKE_PHOTO, START_STREAM, STOP_STREAM, CHANGE_QUALITY, REBOOT_APP, UPDATE_APP
    actualizar.js  NUEVO: OTA del propio agente
```

- **Identidad estable:** el `device_uid` se deriva del **número de serie de la Pi**
  (`/proc/cpuinfo`) y se guarda en disco. Si se reinstala el agente, el equipo y su
  historial se conservan (mismo criterio que el agente de PC).
- **Captura:** `rpicam-still`/`picamera2` sobre `libcamera`. Se sube **la foto limpia**
  con `watermark_baked=false` — la marca la dibuja el dashboard, igual que hoy. **Nada que
  portar del overlay.**
- **Cola store-and-forward:** si el LTE se cae, la foto se guarda en disco con sus metadatos
  y se reintenta. La APK no tiene esto y es una **mejora**, no solo paridad.
- **Empaquetado:** un solo binario con **Node SEA**, igual que `SpaceEyeAgente.exe`
  (`pc-agent/build.js` ya hace exactamente eso). Así el OTA es "descargar binario,
  verificar hash, sustituir, reiniciar servicio" — que encaja con el comando `UPDATE_APP`
  y con la pantalla de actualización remota que ya existe en el dashboard.

### 5.4 Telemetría — de dónde sale cada campo

| Campo que pide el backend | En Android | En la Pi 5 |
|---|---|---|
| `battery_pct` **(obligatorio)** | BatteryManager | Medidor I²C del UPS (o `100` fijo si se instala sin UPS, como hace el pc-agent) |
| `battery_charging`, `battery_temp` | BatteryManager | UPS por I²C |
| `signal_dbm`, `network_type`, `network_operator` | TelephonyManager | `mmcli -m 0 --signal-get` (ModemManager) |
| `gps_lat/lng/accuracy` | FusedLocation | GNSS del módem (`mmcli --location-get`) o `gpsd` |
| `storage_free_mb`, `ram_free_mb`, `uptime_seconds` | Android API | `statfs`, `os.freemem()`, `os.uptime()` — **ya resuelto en pc-agent** |
| `cpu_temp` | — | `/sys/class/thermal/thermal_zone0/temp` (la Pi lo reporta mejor que el teléfono) |
| `data_mobile_*`, `data_wifi_*` | NetworkStatsManager | **vnstat** por interfaz (`wwan0`, `wlan0`) → hoy/semana/mes/total |
| `app_version_code` | BuildConfig | versión del agente |

### 5.5 Vista en vivo (WebRTC) — la parte delicada
El protocolo actual lo inicia el dispositivo: **el equipo genera la oferta**, el dashboard
contesta, y las candidatas ICE viajan por Redis. Hay que replicar ese rol en la Pi.

- **Sin encoder H.264 por hardware**: se codifica con `x264` (`ultrafast`, `zerolatency`).
  Meta realista: **720p a 15–20 fps**, ~1–1.5 núcleos. 1080p30 por software es posible pero
  calienta y no aporta para verificar un espectacular. De todos modos **el cuello de
  botella real es el enlace LTE** (subida de 1–3 Mbps típica).
- **Implementación recomendada:** `GStreamer` con `webrtcbin` (maneja ICE/DTLS/SRTP),
  manejado por un proceso auxiliar; el agente Node sigue siendo el único cliente Socket.IO
  y le pasa SDP/ICE por stdin/stdout. Evita depender de `node-webrtc`, que está
  abandonado y compila mal en ARM64.
- `CHANGE_QUALITY` mapea a presets de resolución/bitrate. `camera_control` mapea a los
  controles de `picamera2` (`AfMode`, `LensPosition`, `ExposureTime`, `AnalogueGain`,
  `AwbMode`) — **más control que en Android**.
- La rotación por dispositivo (`stream_rotation`, ya en la BD) se aplica como transformación
  de libcamera.

### 5.6 Integración con SPACE OS
Según el plan ya entregado, SPACE OS (`spaces-dooh`, Next.js 14 + PostgreSQL con RLS
multi-tenant) integra SPACE Eyes con tres piezas: **(A)** módulo BFF `app/api/eyes/*` + UI,
**(B)** un **Device Gateway** dedicado (Node + Socket.IO + WebRTC) que es el puente de
protocolo, y **(C)** el AI Worker reutilizado.

**La Pi encaja sin fricción porque el Gateway expone el mismo contrato de dispositivo.**
En la práctica:

- El agente apunta a `server_url` en su configuración. Migrar un equipo de la plataforma
  legacy al Gateway de SPACE OS es **cambiar una línea de config y reiniciar el servicio** —
  no reflashear el equipo. Esto es justo lo que **no** se puede hacer con los teléfonos ya
  instalados (que por eso necesitan el puente de datos).
- En el alta, el agente debe poder mandar la **clave interna del sitio** para amarrarse a
  `eyes_dispositivos.sitio_id → sitios(id)` y que aparezca ya vinculado al espacio
  publicitario, sin trabajo manual.
- Multi-tenant: el token de equipo tendrá que cargar `tenant_id`. Es un cambio del Gateway,
  no del agente, pero hay que preverlo para no re-provisionar la flota después.

**Recomendación de secuencia:** construir el piloto contra el backend **legacy**
(`159.203.188.58`), que ya está probado, y migrar al Gateway cuando exista. Amarrar el
piloto de hardware al calendario de SPACE OS retrasaría ambos.

---

## 6. Orden de ensamblaje y configuración

**Siempre con la Pi desconectada de la corriente.** El cable plano de la cámara **no se
conecta en caliente**.

1. **Active Cooler primero.** Va sobre el SoC y se ancla en los dos barrenos con resortes;
   una vez montados los HATs ya no entra. Conectar su cable al header de 4 pines (PWM).
2. **Pila RTC** al conector dedicado.
3. **Cable de cámara**: extremo mini (22 pines) al puerto `CAM/DISP 0` de la Pi, extremo
   estándar (15 pines) a la cámara. Contactos hacia el lado correcto, seguro levantado,
   insertar a fondo, bajar seguro. Es la conexión que más se maltrata: sin forzar.
4. **Almacenamiento**: microSD ya flasheada, o HAT NVMe por el conector PCIe FFC (y en ese
   caso configurar el arranque desde NVMe).
5. **UPS/batería** sobre el header de 40 pines con separadores. Verificar que no toque el
   ventilador.
6. **Módem LTE**: si es USB, a un puerto **USB 3.0**; SIM insertada **antes** de energizar.
   Antenas conectadas **siempre antes de encender** (transmitir sin antena daña el módulo).
7. **Primer arranque en banco** (sin gabinete), con Ethernet y monitor si se puede: es
   mucho más fácil diagnosticar en la mesa que en un poste.
8. **Ya validado en banco**: montar en el gabinete, pasar antenas por prensaestopas,
   alinear la cámara con la ventana óptica, sellar, poner desecante.
9. **Prueba térmica**: 24 h dentro del gabinete cerrado, registrando `cpu_temp`, **antes**
   de subirlo a un espectacular.

---

## 7. Cómo empezar el desarrollo y las pruebas

### Paso 1 — Sistema base (día 1)
```bash
# Con Raspberry Pi Imager: Raspberry Pi OS Bookworm 64-bit Lite
# En "Ajustes avanzados": hostname, usuario, llave SSH, WiFi y zona horaria.
sudo apt update && sudo apt full-upgrade
sudo raspi-config          # I2C on, SPI si aplica, expandir sistema de archivos
```

### Paso 2 — Validar la cámara (día 1)
```bash
rpicam-hello --list-cameras          # debe listar el IMX708
rpicam-hello -t 5000                 # vista previa 5 s
rpicam-jpeg -o prueba.jpg --width 4608 --height 2592
```
**Aquí se decide el tema NoIR:** tomar la misma escena de día y de noche, y compararla
contra la foto que hoy sube el teléfono del mismo sitio. Si el color de día no sirve para
verificar creatividades, se compra la Module 3 estándar.

### Paso 3 — Conectividad LTE (día 2)
```bash
sudo apt install modemmanager
mmcli -L                              # detectar el módem
mmcli -m 0 --signal-setup=5
nmcli con add type gsm ifname '*' con-name lte apn <APN-del-operador>
mmcli -m 0 --signal-get                # RSSI/RSRP → signal_dbm
mmcli -m 0 --location-enable-gps-nmea  # GNSS → gps_lat/lng
```
Prueba de aceptación: desconectar Ethernet y que el equipo siga alcanzando
`http://159.203.188.58:4000` de forma sostenida.

### Paso 4 — Primer agente mínimo (días 3-5)
Portar `pc-agent` cambiando **solo** `camera.js`:
1. `registrar()` con `device_uid` derivado del serial de la Pi.
2. `reportarEstado()` con la telemetría básica (batería fija en 100 al inicio).
3. Atender `TAKE_PHOTO` → `rpicam-still` → `subirFoto()`.

**Criterio de éxito:** el equipo aparece en el dashboard en estado `provisioning`, se le
pone nombre, y una foto programada desde la pantalla de Programación llega a la galería y
pasa por la verificación con IA. En ese momento ya es un SPACE Eye funcional.

### Paso 5 — Telemetría completa y robustez (semana 2)
UPS por I²C, señal del módem, GPS, vnstat, cola store-and-forward, systemd + watchdog,
prueba de corte de energía y de pérdida de red.

### Paso 6 — Vista en vivo (semana 3)
GStreamer `webrtcbin`, oferta desde el equipo, ICE con el TURN de coturn ya desplegado.
Medir consumo de datos: **es el rubro que más puede disparar la factura del SIM.**

### Paso 7 — OTA y endurecimiento (semana 4)
Binario SEA, `UPDATE_APP`, arranque automático, reversión si el binario nuevo no levanta.

---

## 8. Cómo se conecta cada cosa (referencia rápida)

| Elemento | Conexión física | Software |
|---|---|---|
| **Cámara** | MIPI CSI `CAM/DISP 0`, cable 22↔15 pines | Autodetectada en Bookworm; `rpicam-*` / `picamera2` |
| **Alimentación** | USB-C, fuente 5.1 V/5 A | Vigilar `vcgencmd get_throttled` (0x0 = sin problemas) |
| **Batería de respaldo** | HAT sobre el header de 40 pines | I²C (`i2cdetect -y 1`); leer porcentaje y estado de carga |
| **LTE** | USB 3.0 (o HAT), SIM + 2 antenas | ModemManager + NetworkManager (`wwan0`) |
| **GPS** | Antena activa al módem | `mmcli --location-get` o `gpsd` |
| **Almacenamiento** | microSD, o SSD en HAT NVMe (PCIe FFC) | Fotos en cola bajo `/var/lib/space-eye/` |
| **Enfriamiento** | Header de 4 pines (PWM) | Curva automática del firmware |
| **Red cableada (opcional)** | RJ45 / HAT PoE+ | Respaldo del LTE o enlace principal donde exista |
| **Hora** | Pila RTC | NTP cuando hay red; RTC cuando no |

---

## 9. Migración de la APK a la Pi sin perder capacidades

Matriz de paridad, funcionalidad por funcionalidad:

| Capacidad de la APK | Implementación en Android | En la Pi 5 | Riesgo |
|---|---|---|---|
| Registro e identidad estable | `TokenStore` + ANDROID_ID | Serial de la Pi + `state.json` | Bajo |
| Comandos en vivo | `SocketManager` | `socket.io-client` (igual que pc-agent) | **Ninguno** — ya probado |
| Sondeo de respaldo | `CommandHandler` | Igual que pc-agent | Ninguno |
| Foto programada / bajo demanda | `PhotoCapture` (CameraX) | `rpicam-still` / picamera2 | Bajo |
| Marca de información | Se dibuja en el dashboard | **Idéntico**, no se porta nada | Ninguno |
| Verificación con IA | Backend + ai-worker | **Idéntico** | Ninguno |
| Telemetría | `DeviceStatusCollector` | ModemManager + I²C + sysfs | Medio (depende del UPS elegido) |
| Consumo de datos | `DataUsageCollector` | vnstat | Bajo |
| Registros remotos | `RemoteLog` | Igual que pc-agent | Ninguno |
| **Vista en vivo** | `WebRTCClient` (CameraX + WebRTC) | GStreamer `webrtcbin`, 720p software | **Alto** — es el trabajo mayor |
| Control manual de cámara | Controles de CameraX | Controles de libcamera | Bajo (la Pi da más control) |
| Rotación del stream | Config por dispositivo | Transformación de libcamera | Bajo |
| Reinicio remoto | `RestartReceiver` | `systemctl restart` / `reboot` | Ninguno |
| Auto-arranque y auto-reparación | `BootReceiver`, `WatchdogWorker`, kiosco | systemd + watchdog de hardware | **Bajo — sale más confiable** |
| Actualización remota (OTA) | `AppUpdater` (device owner) | Binario SEA + `systemctl` | Medio |

**Estrategia recomendada: convivencia, no reemplazo.**

1. **No migrar sitios existentes al principio.** Los teléfonos que ya funcionan se quedan.
   La Pi entra en **sitios nuevos** y en uno o dos sitios piloto **en paralelo con el
   teléfono** — misma escena, dos equipos, comparando fotos y telemetría durante 2–4 semanas.
2. El backend ya soporta flota heterogénea (teléfonos + PC con cámara IP). No hay que
   migrar datos ni cambiar el dashboard.
3. Solo cuando el equipo Pi acumule **30 días sin intervención humana**, se plantea
   sustituir teléfonos, empezando por los sitios más problemáticos.
4. **Lo único que puede perderse** en el camino es la vista en vivo con la misma fluidez.
   Si eso es inaceptable, hay que resolver WebRTC **antes** de comprometer la migración; por
   eso está como fase propia y con riesgo alto.

---

## 10. Roadmap por fases

| Fase | Contenido | Entregable / criterio de salida | Estimado |
|---|---|---|---|
| **F0 — Compras y decisiones** | Cotizar y comprar lo crítico; resolver NoIR vs estándar y lente; definir operador y APN | Material en mano; decisiones cerradas | 1–3 semanas (según importación) |
| **F1 — Hardware en banco** | Armado, Active Cooler, cámara, arranque, prueba térmica | `rpicam-jpeg` produce foto correcta; sin `throttled` | 2 días |
| **F2 — Sistema operativo** | Bookworm Lite, SSH, timezone, watchdog, endurecimiento, imagen base clonable | Imagen `.img` reproducible para clonar equipos | 2 días |
| **F3 — Comunicación** | LTE + APN + GPS + failover, medición de consumo | 48 h en línea solo por LTE, sin caídas | 3 días |
| **F4 — Captura e integración** | Agente Node: registro, telemetría, TAKE_PHOTO, cola offline | **El equipo aparece en el dashboard y sube fotos programadas** | 1 semana |
| **F5 — Telemetría completa** | UPS/batería, señal, consumo de datos, logs remotos, systemd | Ficha del equipo igual de completa que la de un teléfono | 1 semana |
| **F6 — Vista en vivo** | WebRTC por GStreamer, control de cámara, calidad | Stream estable 720p desde LTE con TURN | 1–2 semanas |
| **F7 — OTA y operación** | Binario SEA, `UPDATE_APP`, reversión, documentación de instalación | Actualizar el equipo desde el dashboard sin tocarlo | 1 semana |
| **F8 — Piloto en campo** | Gabinete, montaje, 30 días junto a un teléfono | 30 días sin intervención; fotos comparables | 4–6 semanas |
| **F9 — SPACE OS** | Apuntar al Device Gateway, `sitio_id`, multi-tenant | El equipo reporta dentro de SPACE OS | según calendario de SPACE OS |
| **F10 — Producción** | Procedimiento de armado, lote inicial, capacitación de instalación | Segundo equipo armado por otra persona siguiendo el manual | continuo |

Las fases **F1–F3 dependen del material**; F4–F7 son software y pueden adelantarse en la
misma Pi de escritorio con WiFi, sin esperar gabinete ni LTE.

---

## 11. Riesgos principales

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| La NoIR no da color usable de día | **Alta** | Comprar también la estándar y comparar en F1 |
| WebRTC por software no alcanza calidad aceptable | Media | Bajar a 720p/15 fps; el límite real es el LTE. Definir el mínimo aceptable **antes** de F6 |
| Corrupción de microSD en campo | **Alta** a 12 meses | NVMe en flota, logs en RAM, imagen clonable para reponer rápido |
| Calor dentro del gabinete (>70 °C) | Alta en México | Active Cooler + visera + ventilación filtrada + prueba térmica de 24 h obligatoria |
| Litio degradado o peligroso por calor | Media | LiFePO4 o supercapacitores |
| Costo por equipo mayor que un teléfono | **Cierta** | Decisión de negocio explícita; evaluar PoE donde haya Ethernet para ahorrar el LTE |
| Importación de HATs (LTE/UPS) | Media | Confirmar disponibilidad local con AG Electrónica antes de comprometer fechas |

---

## 12. Decisiones que necesito de ti para cerrar el plan

1. **¿A qué distancia y en qué posición se montará la cámara respecto a la cara del
   espectacular?** Define lente estándar (~75°) vs Wide (~120°). Es lo que más puede
   obligar a recomprar.
2. **¿Los sitios están iluminados de noche?** Define si se queda la NoIR (con iluminador
   IR) o se compra la Module 3 estándar.
3. **¿Hay energía 24/7 y se puede tomar acometida? ¿Hay Ethernet en algún sitio?** Si hay
   red cableada, PoE ahorra el módem y el SIM por sitio.
4. **Operador y plan de datos M2M** (¿Telcel?), y presupuesto de datos por equipo/mes:
   condiciona la calidad del stream y la frecuencia de fotos.
5. **¿Cuántos equipos contempla la flota y cuál es el costo objetivo por unidad?** Decide
   NVMe vs microSD y HAT vs router industrial.
6. **¿La Pi sustituye teléfonos existentes o solo cubre sitios nuevos?**
7. **¿El piloto apunta al backend legacy o esperamos al Device Gateway de SPACE OS?**
   (Recomiendo legacy, para no encadenar los dos proyectos.)
8. **¿Cuál es el mínimo aceptable de vista en vivo?** Si 720p/15 fps no es suficiente, hay
   que decidirlo ahora porque cambia la fase F6.
