# SPACE EYE — Estado y handoff

Bitacora de sesiones de trabajo: que se hizo, que quedo desplegado, que se
verifico y que sigue pendiente. Lo mas reciente primero.

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
  software. Medido: 720p a ~14 fps, **1.2 Mbps**, 56 °C.
- Dos trampas encontradas: `rpicam-vid` exige `--libav-format` al escribir a
  salida estandar (si no, falla), y ffmpeg analizaba 5 MB/5 s antes de conectar
  (se bajo a 200 KB/1 s). Con eso el video aparece en **3.4 s** en vez de ~15 s.
- El dashboard elige visor segun `app_version` (`pi-agent`/`pc-agent` → WHEP).
  Nuevo endpoint `GET /api/devices/:id/stream-status?key=` para saber si el
  equipo ya publica, en vez de tocar la puerta y llenar la consola de 404.

**Camaras Hikvision: codigo listo, SIN PROBAR en sitio.** ffmpeg reenvia el RTSP
de la camara **sin recodificar**. Requiere dejar `ffmpeg.exe` junto a
`SpaceEyeAgente.exe`. Opcion `canal_stream: 102` para gastar menos subida.

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
