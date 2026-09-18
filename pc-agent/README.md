# SPACE EYE — Agente de PC (camara IP fija)

Para sitios donde en lugar de un telefono hay una **camara IP** (HiLook / Hikvision)
conectada a una PC que permanece encendida.

## De donde se baja

Los dos archivos estan publicados en el servidor, asi que no hace falta llevarlos
en USB:

- **http://159.203.188.58:4000/SpaceEyeAgente.exe** (el agente)
- **http://159.203.188.58:4000/ffmpeg.exe** (solo lo necesita la vista en vivo)

Tambien salen de `pc-agent/dist/` despues de `npm run build`.

## Actualizacion por red

A partir de la **v1.1.0** el agente se actualiza solo desde el dashboard: en la
ficha del equipo, boton de actualizar. Baja el programa publicado, **comprueba su
huella SHA-256**, lo arranca con `--version` para ver que no este roto, y recien
entonces lo sustituye. Si el programa nuevo no levanta, **vuelve solo al
anterior**; y si algo saliera muy mal, la tarea de Windows reintenta cada 10 min.

Para publicar una version nueva: `npm run build`, copiar `dist/SpaceEyeAgente.exe`
a `frontend/public/` del servidor y actualizar ahi `space-eye-agente.json` con la
version y la huella (`sha256sum`). **Subir siempre `VERSION` en `src/index.js`**:
si dos builds distintos dicen la misma version, no hay forma de saber que corre
cada sitio — ya paso.

> La primera instalacion **si** hay que hacerla a mano: un equipo con el agente
> viejo no sabe actualizarse. De ahi en adelante, todo por red.

## Instalacion en el sitio

1. Copia a la PC (donde sea, por ejemplo el Escritorio) **los dos archivos
   juntos, en la misma carpeta**: `SpaceEyeAgente.exe` y `ffmpeg.exe`.
2. **Clic derecho sobre `SpaceEyeAgente.exe` → Ejecutar como administrador.**
3. **Se abre solo en el navegador** un formulario: IP de la camara, usuario y
   clave. El boton "Probar camara" **muestra la foto ahi mismo**, para confirmar
   el encuadre sin ir a buscar ningun archivo.
4. "Instalar". Al terminar sale un tablero con un renglon por cosa: camara,
   configuracion, arranque automatico y ffmpeg, cada uno con su palomita o su
   tache. Si algo quedo a medias **lo dice en el titulo** y da la linea exacta
   para completarlo.

Eso es todo; queda arrancando solo cada vez que prende la PC.

> **Por que en el navegador y no una ventana negra.** Quien va al sitio no
> siempre es una persona tecnica, y una consola con texto se lee como un error
> aunque todo haya salido bien. Peor: el resultado se juzga mal. En REVOLUCION la
> instalacion decia "OK" tres veces y "no pude registrar el arranque automatico"
> una, en medio del texto, y se dio por buena — el equipo murio al primer
> reinicio. En el tablero eso no se puede pasar por alto.
>
> No engorda el ejecutable ni un byte: el servidor se levanta con el modulo
> `http` que Node ya trae dentro, escucha **solo** en `127.0.0.1`, en un puerto
> al azar y exigiendo un testigo secreto en cada peticion, y se cierra al
> terminar.

Si en alguna PC el navegador no abriera, `--consola` vuelve al asistente de
preguntas de siempre:

```bat
SpaceEyeAgente.exe --consola
```

## Sustituir la PC de un sitio

El backend reconoce un equipo por su `device_uid`, que el agente deriva del
**nombre de la PC + la camara**. Cambiar la PC cambia el nombre, asi que por
omision sale un equipo **nuevo** y se pierde el historial del sitio: galeria,
ajustes de camara, marca de informacion, campanas y las huellas de creativos.

Para que el sitio siga siendo el mismo, en "Opciones avanzadas" del formulario
esta **"Sustituir un equipo existente (uid)"**. El uid se saca de la base:

```sql
SELECT device_uid FROM devices WHERE id = <equipo>;
```

Funciona **aunque la PC anterior ya no exista**, que es justo el caso cuando se
sustituye por averia. Por linea de comandos es `--uid pc-...`.

El archivo `state.json`, junto al ejecutable, es esa identidad. **Conviene
guardar una copia** de cada sitio: con el, sustituir una PC es copiarlo y listo.

No hace falta instalar nada mas: el ejecutable lleva todo dentro. El unico
archivo aparte es `ffmpeg.exe`, y solo lo necesita la **vista en vivo** (las
fotos funcionan sin el). Si falta, el instalador te lo dice al terminar.

> **Las credenciales son las de la camara**, las que usas para entrar a
> `http://<ip-de-la-camara>` desde el navegador. **No son las de Hik-Connect.**
> Es el error mas comun y es lo que hace fallar la instalacion.

Si la camara no usa el puerto 80, escribela como `192.168.1.64:8000`.

## Despues de instalar

El sitio aparece en el dashboard como un equipo nuevo, en estado `provisioning`.
Entra a su ficha y ponle el **nombre del sitio**. De ahi en adelante se usa igual
que un telefono: fotos programadas, galeria, marca de informacion, verificacion
con IA y telemetria.

**Los horarios se configuran en el dashboard**, no en la PC. La programacion vive
en el servidor: manda comandos `TAKE_PHOTO` igual que a los telefonos.

## Si algo sale mal

- El programa deja un registro junto a si mismo: **`agente.log`**.
- Sus errores tambien llegan al dashboard, en **Registros del dispositivo** de la
  ficha del equipo.
- Para verificar solo la camara, sin tocar el servidor: `SpaceEyeAgente.exe --instalar`
  vuelve a probarla y guarda `prueba.jpg`.
- Para verificar solo la **vista en vivo**, tambien sin tocar el servidor:
  `SpaceEyeAgente.exe --probar-stream`. Dice si `ffmpeg.exe` esta, si la camara
  acepta el RTSP y que entrega cada canal (resolucion, fps, ancho de banda).
  Tarda unos segundos por canal. Tambien esta como opcion **[3]** al abrir el
  programa con doble clic.
- Windows puede advertir que el programa no esta firmado (SmartScreen):
  *Mas informacion → Ejecutar de todas formas*. Es porque no compramos un
  certificado de firma de codigo.

## Instalar en varios sitios de golpe

Sin preguntas, para automatizar:

```bat
SpaceEyeAgente.exe --instalar --camara 192.168.1.64 --usuario admin --clave LACLAVE
```

Parametros opcionales: `--servidor`, `--puerto`, `--canal` (canal de las FOTOS,
`101` = calidad principal), `--canal-stream` (canal de la VISTA EN VIVO, `102` =
calidad secundaria) y `--puerto-rtsp`.

Para quitar el arranque automatico: `SpaceEyeAgente.exe --desinstalar`
(conserva la configuracion y la identidad del equipo).

## Que hace y que no

| | |
|---|---|
| Fotos programadas desde el dashboard | si |
| Foto bajo demanda (boton "Tomar foto") | si |
| Galeria, marca de informacion, descarga, album | si |
| Verificacion con IA | si |
| Telemetria y registros remotos | si |
| **Vista en vivo** | **si** — requiere `ffmpeg.exe`, ver abajo |

## Vista en vivo

La camara ya entrega H.264 por RTSP, asi que el agente **no recodifica nada**:
reenvia ese mismo video al servidor de medios y el dashboard lo consume de ahi.
El consumo de CPU de la PC es practicamente cero.

**Requisito: `ffmpeg.exe` junto a `SpaceEyeAgente.exe`** (o en el PATH). Sin el,
el boton de vista en vivo del dashboard responde con el motivo exacto. Se
descarga de https://github.com/BtbN/FFmpeg-Builds/releases (basta `bin/ffmpeg.exe`
del paquete `win64-lgpl`, que es estatico y no necesita DLLs).

Opciones en `config.json`, dentro de `camara`:

| Opcion | Para que | Por omision |
|---|---|---|
| `puerto_rtsp` | Puerto RTSP de la camara | `554` |
| `canal` | Canal de las **fotos**, y tambien de la vista en vivo. Siempre el principal, a maxima calidad | `101` |
| `sub_stream` | Sacar la vista en vivo del canal secundario para gastar menos subida. **Cambia el encuadre** | `false` |
| `canal_stream` | Que canal usar cuando `sub_stream` esta encendido | `102` |

**La vista en vivo sale del MISMO canal que la foto.** Es a proposito: en estas
camaras el canal principal suele ser 16:9 y el secundario 4:3, asi que el
sub-stream no es "la misma imagen con menos calidad" sino **otro encuadre, con
menos campo de vision**. Quien revisa un sitio compara lo que ve en vivo contra
la foto de evidencia, y no cuadraban.

Si un sitio necesita ahorrar datos (modem LTE con tope), enciende
`"sub_stream": true` sabiendo que el visor va a mostrar un recorte distinto del
que llega en las fotos. **No todas las camaras traen el sub-stream habilitado**:
para habilitarlo, entra a `http://<ip-de-la-camara>` → Configuracion → Video →
Sub-stream.

Si el canal principal no responde, el agente se cae solo al secundario antes que
dejar al sitio sin vista en vivo, y lo deja anotado en `agente.log`.

## Para desarrolladores

```bat
npm install
npm run bajar-ffmpeg         REM una sola vez: deja vendor/ffmpeg.exe
npm start                    REM correrlo con Node, sin empaquetar
npm run probar-stream        REM probar la vista en vivo contra config.json
npm run build                REM genera dist/ (SpaceEyeAgente.exe + ffmpeg.exe)
```

`ffmpeg.exe` **no se versiona**: pesa 110 MB y engordaria el repo para
siempre. `npm run bajar-ffmpeg` lo descarga a `vendor/` (build estatica LGPL de
BtbN) y `npm run build` lo copia a `dist/`. Al sitio se llevan **los dos
archivos de `dist/`**.

El ejecutable se arma con **SEA** (Single Executable Applications, nativo de
Node 20+): `build.js` empaqueta el codigo con esbuild, genera la carga y la
inyecta en una copia de `node.exe`. Se descarto `pkg` porque sin binarios
precompilados intenta compilar Node desde cero y eso exige Visual Studio.

`state.json` guarda la identidad del equipo. **No lo borres**: si se pierde, el
backend da de alta un sitio nuevo y se corta el historial del actual.
