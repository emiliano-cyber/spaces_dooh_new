# SPACE EYE — Agente de PC (camara IP fija)

Para sitios donde en lugar de un telefono hay una **camara IP** (HiLook / Hikvision)
conectada a una PC que permanece encendida.

La camara vive en la red local del sitio, detras del NAT: el servidor no puede
entrar a buscarla. Este agente corre en esa PC —que si la alcanza— y se presenta
ante el backend como un equipo mas, hablando los mismos endpoints `/api/device/*`
que la APK de Android. El sitio aparece en el dashboard como cualquier otro y
hereda galeria, marca de informacion, verificacion con IA y telemetria.

**Los horarios se configuran en el dashboard, no aqui.** La programacion vive en
el servidor: inserta comandos `TAKE_PHOTO` igual que para los telefonos y el
agente los obedece.

## Requisitos

- **Node.js 18 o superior** en la PC del sitio: <https://nodejs.org> (instalador LTS).
- Que la PC alcance la camara en la red local (comprueba abriendo `http://<ip-camara>` en el navegador).
- **Usuario y clave de la camara**, no los de Hik-Connect. Son credenciales distintas.

## Instalacion

```bat
cd pc-agent
npm install
copy config.example.json config.json
notepad config.json
```

En `config.json`:

| Campo | Que poner |
|---|---|
| `server_url` | `http://159.203.188.58:4000` |
| `camara.host` | IP local de la camara (ej. `192.168.1.64`) |
| `camara.usuario` / `clave` | credenciales del equipo (las de su interfaz web) |
| `camara.canal` | `101` = camara 1, calidad principal. `102` = calidad secundaria |

## 1) Probar solo la camara

Antes de dar de alta el sitio, verifica que la camara responde:

```bat
npm run probar-camara
```

Guarda `prueba.jpg` con lo que ve la camara. Si falla, el problema esta entre la
PC y la camara (IP, credenciales o red), no en Space Eye.

## 2) Arrancar el agente

```bat
npm start
```

Aparecera en el dashboard como equipo nuevo, en estado `provisioning`. Entra a su
ficha y ponle el **nombre del sitio**; de ahi en adelante se usa igual que un
telefono: fotos programadas, galeria, marca configurable y verificacion.

## 3) Dejarlo corriendo siempre

El agente debe sobrevivir a reinicios de la PC. La forma mas simple en Windows:

**Programador de tareas** → Crear tarea:
- General: *Ejecutar aunque el usuario no haya iniciado sesion*, *Ejecutar con privilegios maximos*
- Desencadenadores: *Al iniciar el equipo*
- Acciones: Programa `node`, Argumentos `src\index.js`, Iniciar en `C:\ruta\a\pc-agent`
- Configuracion: *Reiniciar la tarea si se produce un error*, cada 1 minuto

Alternativa mas robusta si prefieres un servicio real: [NSSM](https://nssm.cc)
(`nssm install SpaceEyeAgent`).

## Que hace y que no

| | |
|---|---|
| Fotos programadas desde el dashboard | si |
| Foto bajo demanda (boton "Tomar foto") | si |
| Galeria, marca de informacion, descarga, album | si |
| Verificacion con IA | si |
| Telemetria (equipo en linea, almacenamiento, RAM) | si |
| Registros remotos en el dashboard | si |
| **Vista en vivo** | **no** — ver abajo |

La vista en vivo de una camara IP requiere convertir su RTSP a WebRTC (con
MediaMTX o go2rtc junto a los demas contenedores). Es una pieza aparte, todavia
no construida. Mientras tanto, el agente responde a `START_STREAM` con un error
claro en lugar de dejar el comando colgado.

## Diagnostico

- El agente escribe en consola cada comando y cada foto subida.
- Sus errores tambien llegan al dashboard, en el panel **Registros del dispositivo**
  de la ficha del equipo.
- `state.json` guarda el identificador del equipo. **No lo borres**: si se pierde,
  el backend da de alta un sitio nuevo y se corta el historial del actual.
