# SPACE EYE — Agente de PC (camara IP fija)

Para sitios donde en lugar de un telefono hay una **camara IP** (HiLook / Hikvision)
conectada a una PC que permanece encendida.

## Instalacion en el sitio

1. Copia **`SpaceEyeAgente.exe`** a la PC (donde sea, por ejemplo el Escritorio).
2. **Clic derecho → Ejecutar como administrador.**
3. Contesta tres preguntas: IP de la camara, usuario y clave.

Eso es todo. El programa prueba la camara, guarda una foto de muestra para que
confirmes el encuadre, y queda arrancando solo cada vez que prende la PC.

No hace falta instalar nada mas: el ejecutable lleva todo dentro.

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
- Windows puede advertir que el programa no esta firmado (SmartScreen):
  *Mas informacion → Ejecutar de todas formas*. Es porque no compramos un
  certificado de firma de codigo.

## Instalar en varios sitios de golpe

Sin preguntas, para automatizar:

```bat
SpaceEyeAgente.exe --instalar --camara 192.168.1.64 --usuario admin --clave LACLAVE
```

Parametros opcionales: `--servidor`, `--puerto`, `--canal` (`101` = calidad
principal, `102` = secundaria).

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
el boton de vista en vivo responde con un mensaje claro pidiendolo. Se descarga
de https://www.gyan.dev/ffmpeg/builds/ (basta `ffmpeg.exe` de la version
*essentials*).

Opciones en `config.json`, dentro de `camara`:

| Opcion | Para que | Por omision |
|---|---|---|
| `puerto_rtsp` | Puerto RTSP de la camara | `554` |
| `canal_stream` | Canal para la vista en vivo. `102` (calidad secundaria) gasta mucho menos ancho de banda del sitio que `101` | el mismo `canal` de las fotos |

Si el sitio tiene poco subida, poner `"canal_stream": 102`.

## Para desarrolladores

```bat
npm install
npm start                    REM correrlo con Node, sin empaquetar
npm run build                REM genera dist/SpaceEyeAgente.exe
```

El ejecutable se arma con **SEA** (Single Executable Applications, nativo de
Node 20+): `build.js` empaqueta el codigo con esbuild, genera la carga y la
inyecta en una copia de `node.exe`. Se descarto `pkg` porque sin binarios
precompilados intenta compilar Node desde cero y eso exige Visual Studio.

`state.json` guarda la identidad del equipo. **No lo borres**: si se pierde, el
backend da de alta un sitio nuevo y se corta el historial del actual.
