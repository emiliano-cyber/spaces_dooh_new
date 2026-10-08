# SPACE EYE — Despliegue en producción (equipos remotos)

Para operar teléfonos en distintas zonas (datos móviles / redes ajenas) el
backend debe ser **público** y el streaming necesita un **servidor TURN**. Este
stack levanta todo con Docker: backend + ai-worker + MySQL + Redis + **coturn**
(TURN) + **Caddy** (HTTPS automático).

## 0. Requisitos
- Un **VPS** con IP pública (Ubuntu/Debian recomendado) y Docker + Docker Compose.
- Un **dominio** con un registro **A** apuntando a la IP del VPS
  (p.ej. `espaceeye.tudominio.com → 203.0.113.10`).
- Puertos abiertos en el firewall del VPS:
  - `80/tcp`, `443/tcp` (HTTPS / Caddy)
  - `3478/udp`, `3478/tcp` (TURN)
  - `49160-49200/udp` (relay de TURN)

## 1. Clonar y configurar
```bash
git clone <repo> && cd Space_eye

# Backend .env de produccion
cp backend/.env.prod.example backend/.env
#  -> edita: DOMAIN, DB_PASSWORD, JWT_SECRET, JWT_DEVICE_SECRET, WORKER_SECRET,
#     PUBLIC_BASE_URL (https://tu-dominio), TURN_URL (turn:tu-dominio:3478),
#     TURN_SECRET (genera uno fuerte).

# coturn: edita los 3 REPLACE_
nano infra/coturn/turnserver.conf
#  -> external-ip = IP publica del VPS
#  -> static-auth-secret = MISMO valor que TURN_SECRET del .env
#  -> realm = tu dominio
```

Generar secretos:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # TURN/WORKER
```

## 2. Levantar el stack
```bash
docker compose -f infra/docker-compose.prod.yml --env-file backend/.env up -d --build
```
Caddy obtiene el certificado TLS automáticamente (necesita el DNS ya apuntando y
los puertos 80/443 abiertos). Verifica: abre `https://tu-dominio` → login.

Las migraciones de MySQL corren solas la primera vez. Crea el usuario admin
(adapta `backend/scripts/create-admin.ts`, o insértalo en la BD).

## 3. Compilar el APK apuntando al dominio público
```bash
cd android
./gradlew assembleDebug -PserverUrl=https://espaceeye.tudominio.com
#  APK en app/build/outputs/apk/debug/app-debug.apk
```
Con HTTPS ya no se usa tráfico en claro (el `network_security_config` de IPs
locales deja de aplicar). El socket usa WSS a través de Caddy automáticamente.

## 4. Instalar en cada teléfono de campo
1. Instala el APK (descarga desde `https://tu-dominio/space-eye.apk` si lo
   publicas ahí, o vía USB).
2. Concede **Cámara + Ubicación**, acepta **excluir de batería**.
3. **MIUI/Xiaomi**: activa **Autostart** y **sin restricción de batería**
   (imprescindible) — ver `ANDROID_RESILIENCE.md`.
4. (Opcional) Modo kiosco (device owner) para máxima disponibilidad.

El teléfono se auto-registra al abrir y aparece en el dashboard, sin importar la
red en la que esté.

## 5. Verificar el TURN (streaming remoto)
- En el dashboard, `GET /api/ice-servers` debe incluir una entrada `turn:` con
  `username`/`credential`.
- Prueba el TURN con el *Trickle ICE* de WebRTC
  (https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
  usando `turn:tu-dominio:3478`, el username/credential que devuelve el backend,
  y confirma que aparezcan candidatos `relay`.
- Si el video no conecta en datos móviles: casi siempre es el firewall del TURN
  (abre 3478 y el rango relay) o `external-ip` mal puesto en coturn.

## Notas
- **Almacenamiento**: por defecto `STORAGE_DRIVER=local` (volumen `storage_data`).
  Para escalar, usa `spaces` (S3/DigitalOcean) llenando las `SPACES_*`.
- **TURN sobre TLS (turns:5349)**: opcional, útil si alguna red bloquea UDP;
  requiere montar el certificado en coturn. El `turn:3478` (UDP/TCP) cubre la
  mayoría de los casos.
- **Backups**: respalda el volumen `mysql_data` y `storage_data`.
- Si cambias la IP/dominio del backend, hay que **recompilar el APK** (la URL va
  incrustada) — por eso conviene un dominio estable.
