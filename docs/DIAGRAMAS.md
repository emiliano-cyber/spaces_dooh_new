# SPACE EYE — Diagramas

> Complemento visual de los manuales. Los diagramas están en formato Mermaid: se
> ven renderizados en GitHub, VS Code y la mayoría de visores de Markdown.
> Última revisión: 12 de agosto de 2026.

---

## Índice

1. [Diagrama general: SPACE EYE de principio a fin](#1-diagrama-general-space-eye-de-principio-a-fin)
2. [Arquitectura de despliegue](#2-arquitectura-de-despliegue)
3. [Autenticación](#3-autenticación)
4. [Flujo de una fotografía](#4-flujo-de-una-fotografía)
5. [Comunicación equipo → servidor](#5-comunicación-equipo--servidor)
6. [Fotos programadas](#6-fotos-programadas)
7. [Vista en vivo](#7-vista-en-vivo)
8. [Telemetría](#8-telemetría)
9. [Verificación con IA](#9-verificación-con-ia)
10. [Detección de creativo nuevo](#10-detección-de-creativo-nuevo)
11. [Manejo de errores](#11-manejo-de-errores)
12. [Flujo de datos y su costo](#12-flujo-de-datos-y-su-costo)
13. [Comunicación con SPACE OS](#13-comunicación-con-space-os)

---

## 1. Diagrama general: SPACE EYE de principio a fin

Todo el sistema en una vista.

```mermaid
graph TB
    subgraph SITIO["🏙️ EN EL SITIO"]
        CAM["Cámara apuntando<br/>al espectacular"]
        AG["Agente<br/>Android / Raspberry / PC"]
        CAM --> AG
    end

    subgraph SRV["☁️ SERVIDOR"]
        API["Backend<br/>Express :4000"]
        DB[("MySQL<br/>equipos, fotos,<br/>telemetría")]
        RDS[("Redis<br/>bus + cola")]
        DISK[("Almacén<br/>de fotos")]
        WRK["scheduleWorker<br/>cada minuto"]
        AIW["ai-worker<br/>verificación"]
        MTX["MediaMTX<br/>video"]
    end

    subgraph USO["💻 QUIEN LO USA"]
        DASH["Dashboard"]
        EV["Evidencia<br/>descargada"]
    end

    AG -->|"1. estado cada 60 s"| API
    AG -->|"3. sube la foto"| API
    API -->|"2. órdenes"| AG
    AG -->|"video"| MTX
    MTX --> DASH

    API --> DB
    API --> DISK
    API <--> RDS
    WRK -->|"dispara fotos<br/>a la hora sorteada"| API
    RDS --> AIW
    AIW --> API

    API --> DASH
    DASH --> EV

    style SITIO fill:#e8f4ff
    style SRV fill:#fff4e8
    style USO fill:#e8ffe8
```

**Lectura en una frase:** el agente vigila la pantalla y reporta; el servidor
guarda, ordena y programa; el dashboard muestra y entrega la evidencia.

---

## 2. Arquitectura de despliegue

Lo que corre en el droplet `159.203.188.58` y sus puertos.

```mermaid
graph TB
    subgraph DROPLET["Droplet DigitalOcean — 2 GB RAM"]
        subgraph DOCKER["Docker (infra-*)"]
            BE["backend<br/>:4000"]
            MY[("mysql:8.0")]
            RD[("redis:7")]
            AI["ai-worker"]
            MTX["mediamtx<br/>:8554 :8889 :8189/udp"]
            TURN["coturn<br/>:3478 (host)"]
        end
        AP["Apache<br/>:80 :443<br/>(Marketplace, otro proyecto)"]
    end

    INT["Internet"] -->|"4000"| BE
    INT -->|"8554 RTSP"| MTX
    INT -->|"8889 WHEP"| MTX
    INT -->|"3478 TURN"| TURN
    INT -->|"80 / 443"| AP

    BE --> MY
    BE --> RD
    AI --> RD
    AI --> BE

    style AP fill:#ffe8e8
```

> ⚠️ **Apache sirve otro proyecto en el mismo droplet.** No habilitar nginx: pelea
> por el puerto 80 y tumba Apache en el siguiente reinicio.

---

## 3. Autenticación

Tres identidades distintas, con secretos distintos.

```mermaid
graph TB
    subgraph ID["Tres identidades"]
        U["👤 Usuario"]
        D["📱 Equipo"]
        W["🐍 ai-worker"]
    end

    U -->|"POST /api/auth/login"| L["access 15 min<br/>+ refresh 7 días"]
    L -->|"Bearer"| RU["requireUser"]
    RU --> ROL{"requireRole"}
    ROL -->|"admin"| OK1["Todo"]
    ROL -->|"operator"| OK2["Operar"]
    ROL -->|"viewer"| OK3["Solo leer"]

    D -->|"POST /api/device/register"| DT["JWT device<br/>365 días"]
    DT -->|"Bearer"| RD2["requireDevice"]

    W -->|"X-Worker-Secret"| RW["requireWorker"]
```

### Sesión deslizante

```mermaid
sequenceDiagram
    participant N as Navegador
    participant B as Backend
    participant D as MySQL

    N->>B: petición con access token
    B-->>N: 401 (caducó a los 15 min)
    N->>B: POST /api/auth/refresh
    B->>D: ¿existe el hash, sin revocar y vigente?
    D-->>B: sí, le quedan 4 días
    Note over B: quedan menos de 6 días → renovar
    B->>D: guarda un refresh NUEVO
    Note over B: el anterior NO se revoca:<br/>otra pestaña podría estar usándolo
    B-->>N: {access_token, refresh_token}
    N->>N: guarda ambos y reintenta
```

**Por qué importa:** antes la sesión moría a los 7 días exactos y todo el mundo
tenía que volver a capturar contraseña el mismo día.

---

## 4. Flujo de una fotografía

```mermaid
sequenceDiagram
    autonumber
    participant N as Dashboard
    participant B as Backend
    participant R as Redis
    participant E as Equipo
    participant S as Almacén
    participant D as MySQL

    N->>B: POST /api/devices/:id/command {TAKE_PHOTO}
    B->>D: encuadreDe(id) → lente, zoom, ajustes
    B->>D: INSERT commands (expira en 10 min)
    B->>R: publish device:command
    R->>E: socket "command"
    E->>B: command_ack → status='executing'

    Note over E: abre cámara, aplica encuadre,<br/>espera enfoque, captura

    E->>B: POST /api/device/upload-photo
    B->>B: source = schedule_id ? 'scheduled' : source
    B->>B: display_rotation según si transmitía
    B->>S: original + miniatura 400 px
    B->>D: INSERT photos
    alt campaña con verificación activa
        B->>R: encola verificación
    end
    B-->>E: {photo_id}
    E->>B: POST /api/device/command-result
    N->>B: GET /api/photos (sondeo)
    B-->>N: la foto nueva
```

**Dónde falla en la práctica:**

```mermaid
graph LR
    A["Orden enviada"] --> B{"¿Equipo<br/>encendido?"}
    B -->|"no"| C["Vence a los 10 min<br/>y se descarta"]
    B -->|"sí"| D{"¿Cámara<br/>libre?"}
    D -->|"transmitiendo"| E["Android: captura de la<br/>misma sesión<br/>Pi: corta el stream"]
    D -->|"libre"| F["Captura"]
    E --> F
    F --> G{"¿Hay red<br/>para subir?"}
    G -->|"sí"| H["✅ Foto guardada"]
    G -->|"no, Pi/PC"| I["Cola en disco<br/>reintenta después"]
    G -->|"no, Android"| J["❌ Foto perdida<br/>(sin cola)"]

    style J fill:#ffe8e8
    style H fill:#e8ffe8
```

---

## 5. Comunicación equipo → servidor

Dos caminos para las órdenes: socket (inmediato) y sondeo (respaldo).

```mermaid
sequenceDiagram
    participant E as Equipo
    participant B as Backend
    participant R as Redis

    Note over E,B: Al arrancar
    E->>B: POST /api/device/register {device_uid}
    B-->>E: {device_id, token}
    E->>B: socket.io /devices (auth: token)
    B->>R: publish device:online
    B->>B: UPDATE devices SET online=TRUE

    Note over E,B: Cada 60 segundos
    loop mientras viva
        E->>B: POST /api/device/status
        B->>R: publish device:status
    end

    Note over E,B: Órdenes — camino 1 (inmediato)
    R->>E: socket "command"
    E->>B: command_ack

    Note over E,B: Órdenes — camino 2 (respaldo)
    loop cada 30 s
        E->>B: GET /api/device/pending-commands
        B-->>E: solo órdenes de más de 20 s
    end

    Note over E,B: Al desconectar
    E--xB: socket cerrado
    B->>B: UPDATE devices SET online=FALSE
```

> **Los 20 segundos de gracia** existen para que una orden no llegue por los dos
> caminos y el equipo la ejecute dos veces.

---

## 6. Fotos programadas

```mermaid
graph TB
    START["⏰ Cada minuto"] --> LOCK{"¿Tomo el turno<br/>en Redis?"}
    LOCK -->|"no, otra instancia"| END1["Fin"]
    LOCK -->|"sí"| Q["SELECT schedules<br/>activos y vencidos"]
    Q --> LOOP{"Por cada uno"}
    LOOP --> LATE{"¿Vencido hace<br/>más de 60 min?"}
    LATE -->|"sí"| RESCHED["Reprograma SIN foto<br/>(no gasta datos por nada)"]
    LATE -->|"no"| TARGET{"¿A quién<br/>apunta?"}
    TARGET -->|"device_id"| T1["Ese equipo"]
    TARGET -->|"campaign_id"| T2["Equipos de la campaña"]
    TARGET -->|"todos NULL"| T3["TODA la flota"]
    T1 --> SEND["INSERT commands<br/>+ publish"]
    T2 --> SEND
    T3 --> SEND
    SEND --> NEXT["next_fire_at =<br/>proximoDisparo(yaDisparo=true)"]
    RESCHED --> NEXT

    style RESCHED fill:#fff4e8
```

### Cómo se sortea la hora en una franja

```mermaid
graph LR
    A["Franjas:<br/>8–11, 13–16, 18–21"] --> B["Convierte a la zona<br/>del schedule (no UTC)"]
    B --> C["Descarta franjas<br/>ya pasadas"]
    C --> D{"¿yaDisparo?"}
    D -->|"sí"| E["Salta la franja<br/>en curso"]
    D -->|"no"| F["Puede usar<br/>la actual"]
    E --> G["Minuto al azar<br/>dentro de la franja"]
    F --> G
    G --> H["next_fire_at"]
```

> El **cierre no cuenta**: "de 8 a 10" es 08:00–09:59. Si contara, dos franjas
> pegadas se pisarían en el borde.

---

## 7. Vista en vivo

Dos arquitecturas según el tipo de equipo.

```mermaid
graph TB
    subgraph A["📱 Teléfono Android — punto a punto"]
        A1["CameraX"] --> A2["WebRTC"]
        A2 -->|"SDP + ICE vía backend"| A3["Navegador"]
        A2 -.->|"si la red lo exige"| A4["coturn TURN"]
        A4 -.-> A3
    end

    subgraph B["🍓 Raspberry / 🖥️ PC — por servidor de medios"]
        B1["rpicam-vid / RTSP<br/>de la cámara IP"] --> B2["ffmpeg"]
        B2 -->|"RTSP a ruta<br/>aleatoria de un solo uso"| B3["MediaMTX"]
        B3 -->|"WHEP"| B4["Navegador"]
    end
```

### Los tres cortes de seguridad

```mermaid
graph LR
    S["Transmisión activa"] --> C1["1. Navegador<br/>corta a 3:00"]
    S --> C2["2. streamWatchdog<br/>corta a 3:15"]
    S --> C3["3. Sala vacía →<br/>corte inmediato"]
    C1 --> STOP["STOP_STREAM"]
    C2 --> STOP
    C3 --> STOP
```

**Por qué tres:** transmitir consume datos sin parar. Si el navegador se cierra de
golpe, los otros dos garantizan el corte.

---

## 8. Telemetría

```mermaid
graph LR
    E["Equipo<br/>cada 60 s"] -->|"POST /device/status"| B["Backend"]
    B --> DS[("device_status<br/>~1440 filas/día/equipo")]
    B --> DU[("device_data_usage<br/>upsert")]
    B --> RD["Redis<br/>device:status"]
    RD --> DASH["Dashboard<br/>en vivo"]

    DS --> TEL["GET /telemetry"]
    TEL --> RAW["raw: filas crudas"]
    TEL --> HOUR["hour: AVG/MIN/MAX"]
    TEL --> AL["Alertas al vuelo<br/>sobre THRESHOLDS"]
    AL --> PL["PlayLog"]
    DS --> CSV["Exportar CSV"]
```

| Alerta | Umbral |
|---|---|
| CPU caliente | > 60 °C |
| Batería caliente | > 45 °C |
| Batería baja | < 20 % |
| Señal débil | < −105 dBm |
| Poco espacio | < 500 MB |
| Sin reportar | > 10 min |

> **Riesgo:** sin política de retención, ~3 millones de filas al año.

---

## 9. Verificación con IA

```mermaid
sequenceDiagram
    participant B as Backend
    participant R as Redis
    participant W as ai-worker
    participant S as Almacén

    Note over B: al subir una foto con campaign_id<br/>y verification_enabled
    B->>R: encola {photo_id}
    W->>R: rpoplpush wait → active
    W->>B: GET /internal/.../context
    alt campaña sin creatividad
        B-->>W: 422
        W->>B: POST result {error}
        B->>B: photos.verification_status='failed'
    else
        B->>B: status='running'
        B-->>W: URLs + umbrales
        W->>S: descarga foto y creatividad
        W->>W: SSIM + pHash + histograma + OCR
        W->>W: PDF de evidencia
        W->>B: POST result (multipart)
        B->>B: UPSERT verifications
        B->>B: photos: verified + is_correct
    end
```

> **Estado real:** 1 campaña, sin creatividad, sin equipos. **No está en uso.**

---

## 10. Detección de creativo nuevo

Diseñado para **no gastar datos**: se comparan huellas, no fotos.

```mermaid
graph TB
    A["Cada N horas:<br/>recorrido del loop"] --> B["Abre cámara<br/>~4.5 min"]
    B --> C["Un cuadro cada 15 s<br/>≈18 cuadros"]
    C --> D["Calcula huella<br/>256 bits"]
    D --> E["🗑️ TIRA la imagen"]
    E --> F{"¿La conoce?<br/>distancia ≤ 24 bits"}
    F -->|"sí"| G["Solo refresca<br/>'sigue en rotación'"]
    F -->|"no"| H{"¿Aprendiendo?<br/>(primeras 24 h)"}
    H -->|"sí"| I["Registra sin fotografiar"]
    H -->|"no"| J["📸 Foto AHORA<br/>(el creativo sigue en pantalla)"]
    G --> K["Huellas al reporte<br/>de estado que ya se manda"]
    I --> K
    J --> K

    style E fill:#e8ffe8
    style J fill:#fff4e8
```

**El ahorro:** una foto son 1.5 MB; un recorrido completo con sus doce creativos
no llega a 1 KB. Detectar cuesta ~0.12 MB al mes contra los ~20 MB que ya gasta
cada equipo.

**Por qué la decisión vive en el equipo:** el creativo dura 20 segundos. Para
cuando el servidor mandara la orden, la pantalla ya habría cambiado.

---

## 11. Manejo de errores

```mermaid
graph TB
    subgraph BE["Backend"]
        R["Handler de ruta"] -->|"promesa rechazada"| AR["asyncRouter"]
        AR --> EH["Manejador de errores<br/>→ 500 + log"]
        UR["unhandledRejection"] --> LOG["Registra y sigue"]
    end

    subgraph AG["Agente"]
        C["Orden"] --> T{"¿Falla?"}
        T -->|"sí"| RES["command-result<br/>{success:false}"]
        RES --> RL["RemoteLog → device_logs"]
        T -->|"sin red"| Q["Cola en disco<br/>(Pi/PC)"]
    end

    subgraph FE["Dashboard"]
        F["Petición"] --> S{"¿401?"}
        S -->|"sí"| RF["Refresca token"]
        RF -->|"falla"| LO["Borra sesión<br/>y va al login"]
        S -->|"otro error"| TO["toast de error"]
    end

    style LOG fill:#e8ffe8
```

**El principio de fondo:** un fallo aislado **no puede tumbar el backend de toda
la flota**. Por eso `asyncRouter` y el `unhandledRejection`: se responde 500, se
registra, y el servidor sigue atendiendo a los demás equipos.

---

## 12. Flujo de datos y su costo

```mermaid
graph LR
    subgraph BARATO["💚 Casi gratis"]
        T["Estado cada 60 s<br/>~20 MB/mes"]
        H["Huellas de creativos<br/>~0.12 MB/mes"]
        L["Logs remotos"]
    end
    subgraph CARO["💸 Lo que cuesta"]
        F["Foto: 0.15 – 3.4 MB"]
        V["Vista en vivo:<br/>continuo"]
        U["Actualizar app:<br/>~50 MB"]
    end

    BARATO --> S["Servidor"]
    CARO --> S
```

| Escenario | Consumo mensual por equipo |
|---|---|
| Solo telemetría | ~20 MB |
| + 3 fotos al día (equipo ligero, 400 KB) | ~56 MB |
| + 3 fotos al día (equipo pesado, 3.1 MB) | ~299 MB |

**La palanca sin usar:** la columna `devices.capture_quality` existe en la base
pero **ningún agente la aplica**. Bajar la calidad de captura reduciría el
consumo entre 5 y 7 veces sin quitar ni una foto de evidencia.

---

## 13. Comunicación con SPACE OS

```mermaid
graph LR
    SE["SPACE EYE"] -.->|"❌ NO IMPLEMENTADO"| SO["SPACE OS<br/>(spaces-dooh)"]
```

**No existe integración.** Se buscó en todo el código
(`grep -riE "spaceos|space-os|spaces-dooh"` sobre `.ts`, `.js`, `.kt`, `.py`,
`.yml`) y el único resultado está en `docs/PLAN_RASPBERRY_PI5.md`, como plan
entregado y pendiente de aprobación.

Lo que sí existe hoy: en el **mismo droplet** conviven SPACE EYE (puerto 4000, en
Docker) y el proyecto spaces-dooh (puertos 3000/3001, tras Apache). Comparten
servidor, pero **no se comunican entre sí**.

> Si algún día se integran, este diagrama debe actualizarse antes de escribir la
> primera línea de código.

---

*Estos diagramas describen el sistema tal como está hoy. Si cambias un flujo,
actualiza el diagrama en el mismo commit: un diagrama desactualizado engaña más
de lo que ayuda.*
