# SPACE EYE — Agente de Raspberry Pi 5

Convierte una Raspberry Pi 5 en un equipo SPACE EYE. Habla el mismo contrato que
la APK de Android y que el agente de PC, asi que aparece en el dashboard como un
equipo mas: galeria, marca de informacion, verificacion con IA, telemetria,
fotos programadas y campanas, **sin tocar el servidor**.

Estado: **listo para campo desde la v0.2.0**. Funciona el circuito completo
(registro, telemetria, comandos, foto, galeria), la **vista en vivo** y la
**actualizacion por red**: ya no hace falta viajar al sitio para cambiar nada.

La vista en vivo no va punto a punto como en los telefonos: la Pi 5 no trae
codificador de video por hardware ni GStreamer, asi que codifica H.264 por
software (720p a 15 fps, ~1.5 Mbps) y **empuja** el video al servidor de medios
del droplet, de donde lo consume el dashboard. El equipo no guarda credenciales:
el backend le manda una ruta al azar y de un solo uso en cada `START_STREAM`.

## Cuanto gasta al mes

Con los valores por omision, un equipo que nadie mira gasta **~40 MB al mes**
(telemetria cada 3 min + sondeo cada 5 min) mas **~40 MB** de las tres fotos
diarias de evidencia: **~80 MB/mes**.

**La vista en vivo es otra cosa: ~11 MB por MINUTO.** Es el unico rubro capaz de
disparar la factura de un SIM, asi que conviene saberlo antes de dejar el visor
abierto: tres minutos de video cuestan mas que un dia entero de operacion.

Medido el 17-ago: sin `--bitrate`, `rpicam-vid` mandaba ~7 Mbps, o sea **50 MB
por minuto**. Ese era el gasto real de cada vistazo hasta esa fecha.

---

Desde la v0.2.0 ese consumo **se ve en el dashboard**, en la pantalla de consumo
del equipo: el agente lo lee de `vnstat`. Antes llegaba vacio, justo en el equipo
donde mas importa vigilarlo.

## Actualizacion por red

**Desde la v0.2.0 la Raspberry se actualiza sola desde el dashboard**, igual que
los telefonos y las PCs con camara IP. Era el ultimo equipo de la flota que
obligaba a ir al sitio por cualquier cambio — y en un sitio con modem LTE no hay
SSH que valga.

En la ficha del equipo, boton de actualizar. El agente:

1. Baja el paquete y **comprueba su huella SHA-256**. Viaja por HTTP en claro:
   la huella es la unica defensa contra que le metan otra cosa.
2. Lo descomprime aparte y lo arranca con `--version`, solo para ver si vive. Un
   paquete truncado o con una dependencia faltante se cae aqui, **antes** de
   tocar lo que funciona.
3. Recien entonces reemplaza `src/`, `package.json` y `node_modules/`, y sale;
   systemd levanta la version nueva en segundos.
4. Si la nueva arranca y logra registrarse, la da por buena.
5. **Si no arranca, al tercer intento vuelve sola a la anterior.** Sin eso, un
   paquete malo dejaria la Pi en un ciclo de reinicios imposible de romper a
   distancia.

**Nunca se tocan** `config.json`, `state.json`, `agente.log` ni `cola/`. Perder
`state.json` daria de alta un equipo nuevo y partiria el historial del sitio en
dos, asi que jamas entra en la maniobra.

El paquete pesa **~0.7 MB**: actualizar cuesta menos que un minuto de vista en
vivo.

### Publicar una version nueva

```bash
cd pi-agent
npm install          # una vez: el paquete lleva node_modules dentro
npm run empaquetar   # deja dist/space-eye-pi-agent.tar.gz y .json
```

Copiar **los dos** a `frontend/public/` del servidor, **el `.json` al final**:
mientras el manifiesto apunte a un paquete que no esta, la huella no casa y los
equipos rechazan la actualizacion sin romperse.

> **Subir siempre `VERSION` en `src/index.js` y `version` en `package.json`.** El
> empaquetador se niega si no coinciden. Si dos paquetes distintos dicen la misma
> version, no hay forma de saber que corre cada sitio — ya paso en la flota.

## ⚠️ Antes de nada: la alimentacion

La Pi 5 se alimenta por **USB-C** y pide **5 V / 5 A (27 W)** para trabajar con
periferico. Con 5 V/3 A arranca bien.

**El puerto USB de una laptop NO alcanza** (da 0.5–0.9 A por USB-A, y 5 V/3 A por
USB-C solo si es un puerto con carga). Con poca corriente la Pi se reinicia sola,
falla la camara y corrompe la tarjeta. Sirve cualquier **cargador USB-C de
celular de 15 W o mas**.

Para comprobarlo, ya arrancada:

```bash
vcgencmd get_throttled
# throttled=0x0            -> todo bien
# cualquier otro valor     -> falta voltaje (bit 0 = ahora, bit 16 = ocurrio)
```

El agente tambien lo detecta solo y lo avisa en el arranque y en el dashboard.

---

## 1. Preparar la tarjeta (desde tu PC)

Con **Raspberry Pi Imager**:

1. Dispositivo: **Raspberry Pi 5**.
2. Sistema: **Raspberry Pi OS Lite (64-bit)** (sin escritorio; se opera por SSH).
3. Antes de grabar, entrar a **Ajustes** (el engrane) y llenar:
   - Nombre del equipo: `spaceeye-pi01`
   - Usuario y contrasena (usa `pi` para que coincida con el servicio de ejemplo)
   - **Activar SSH**
   - **Red WiFi**: SSID y contrasena (sirve el hotspot del celular)
   - Zona horaria: `America/Mexico_City`
4. Grabar sobre la microSD de 16 GB (la Raspbian que trae de fabrica se
   sustituye; viene desactualizada y sin WiFi ni SSH configurados).

Sin este paso **no hay forma de entrar a la Pi sin monitor**, porque la Pi 5 usa
micro-HDMI y normalmente no se tiene el cable a la mano.

## 2. Arrancar y entrar

Insertar la tarjeta, conectar la alimentacion y esperar ~1 minuto:

```bash
ping spaceeye-pi01.local
ssh pi@spaceeye-pi01.local
```

## 3. Instalar lo necesario en la Pi

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v                       # necesita 18 o mas

# Para que el consumo de datos se vea en el dashboard (el sitio tiene tope
# mensual: sin esto la pantalla de consumo sale vacia para este equipo).
sudo apt install -y vnstat
sudo systemctl enable --now vnstat

# Solo si NO hay camara conectada y quieres demostrar el circuito completo:
sudo apt install -y imagemagick
# Solo si vas a usar una webcam USB:
sudo apt install -y fswebcam
```

> Si `node -v` muestra menos de 18, instalar desde NodeSource:
> `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`

## 4. Copiar el agente y probarlo

Desde tu PC, en la raiz del repo:

```bash
scp -r pi-agent pi@spaceeye-pi01.local:~/
```

En la Pi:

```bash
cd ~/pi-agent
npm install
npm run probar-camara        # dice que camara encontro y guarda prueba.jpg
npm start                    # arranca el agente
```

No hace falta crear `config.json`: por omision apunta al servidor de produccion
(`http://159.203.188.58:4000`). Para cambiarlo, copiar `config.example.json` a
`config.json`, o arrancar con `SPACEEYE_SERVER=http://otro:4000 npm start`.

## 5. Que deberias ver

En la consola de la Pi:

```
SPACE EYE — agente de Raspberry Pi v0.1.0
equipo:    Raspberry Pi 5 Model B Rev 1.0
camara:    IMAGEN DE PRUEBA (no hay camara conectada)
registrado como equipo #13 (uid pi-10000000abcd1234)
socket conectado
agente listo; esperando comandos del dashboard
```

En el dashboard (`http://159.203.188.58:4000/dashboard.html`):

1. Aparece un equipo nuevo en estado `provisioning` → entrar a su ficha y
   ponerle el nombre del sitio.
2. La telemetria es **real**: temperatura del SoC, RAM y disco libres, tiempo
   encendido, red y senal WiFi.
3. Boton **Tomar foto** → la foto llega a la galeria con la marca de informacion
   dibujada por el dashboard, y entra a la cola de verificacion con IA.
4. **Programacion** → los horarios funcionan igual que con los telefonos.

## 6. Dejarlo como servicio (arranca solo)

```bash
sudo cp ~/pi-agent/space-eye-agente.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now space-eye-agente
systemctl status space-eye-agente
journalctl -u space-eye-agente -f      # ver el registro en vivo
```

## 7. De donde sale la foto

El agente elige sola la primera opcion disponible:

| Modo | Cuando se usa | Requiere |
|---|---|---|
| `libcamera` | Camara oficial Module 3 por el puerto MIPI | **Cable adaptador 22↔15 pines** (no viene con la camara) |
| `usb` | Cualquier webcam USB | `fswebcam` o `ffmpeg` |
| `prueba` | No hay ninguna camara: genera una imagen | `imagemagick` |

Para forzar uno, en `config.json`: `"camara": { "modo": "usb" }`.

## 8. Si algo sale mal

- Registro del agente: `~/pi-agent/agente.log`, y `journalctl -u space-eye-agente`.
- Sus errores tambien llegan al dashboard, en **Registros del dispositivo**.
- Probar solo la camara, sin tocar el servidor: `npm run probar-camara`.
- **No borres `state.json`**: guarda la identidad del equipo. Si se pierde, el
  backend da de alta un equipo nuevo y se corta el historial del sitio. La
  actualizacion por red nunca lo toca.
- Si el agente se **cuelga sin morir** (una peticion que nunca contesta), un
  vigilante interno lo detecta a los ~12 minutos sin reportar estado y se
  reinicia solo. `systemd` cubre que el proceso muera; esto cubre que se quede
  tieso, que es lo que antes dejaba al equipo mudo hasta que alguien viajara.
- Si una actualizacion salio mal, el equipo vuelve solo a la version anterior y
  lo dice en **Registros del dispositivo** del dashboard. Ahi tambien queda
  anotado cuando una actualizacion se instala bien.
- Fotos que no se pudieron subir por falta de red quedan en `cola/` y se
  reintentan solas.
