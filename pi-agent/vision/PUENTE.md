# El puente entre el agente (Node) y la vigilancia (Python)

La vigilancia de la pantalla de la Raspberry es la MISMA que la del teléfono
(`android/.../pantalla/` y `creativos/Reconocedor.kt`, APK 0.15.x), portada a
Python con OpenCV (`python3-opencv` de Debian: viene compilado para la Pi, no
hay que construir nada en el equipo).

Reparto, igual que en el teléfono:

- **Node** (`src/`) es dueño de la cámara y de la red: la foto pedida y la
  vista en vivo mandan, y la vigilancia se aparta. Él tiene la llave del
  equipo, los reintentos y la cola.
- **Python** (`vision/`) mira, aprende y decide: el `Monitor.kt` entero
  (`vision/monitor.py`) y sus piezas. No habla con el servidor ni abre la
  cámara: todo lo pide al puente.

Node arranca `python3 vision/monitor.py --puente http://127.0.0.1:<puerto>
--dir <estado>/pantalla` y lo vuelve a levantar si muere. El puerto es al azar
y solo escucha en 127.0.0.1. Cada petición lleva la cabecera
`X-Puente: <secreto>` (el secreto llega en la variable `PUENTE_SECRETO`).

Si `import cv2` o `import numpy` fallan, `monitor.py` sale con código **3**
(al arrancar y con `--version`): el guardián espera una hora en vez de
relanzarlo cada 30 s. `--version` sale con 0 solo si los dos cargan.

## Lo que ofrece el puente (todo JSON salvo la toma)

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /ocupada` | — | `{"ocupada": bool}`: hay una foto o una vista en vivo en curso |
| `POST /camara/abrir` | `{"lente": "main", "zoom": 0}` | `{"ok": bool}` |
| `GET /camara/tomar` | — | `200 image/jpeg` (tal como sale del sensor, sin girar) o `503` |
| `POST /camara/cerrar` | — | `{"ok": true}` |
| `GET /monitoreo` | — | la configuración de `/api/device/monitoreo` tal cual, o `502` |
| `POST /falla` | `{"campos": {...}, "foto": "<jpeg en base64>" \| null}` | `{"id": n}` · `{"rechazada": true}` (el servidor dijo 4xx) · `502` (sin red: encolar) |
| `POST /creativo` | `{"foto": "<base64>", "huella": "..."}` | `{"ok": bool}` (sube con `source=creative_change`) |
| `POST /log` | `{"nivel": "info"\|"warn"\|"error", "etiqueta": "monitor", "texto": "..."}` | `{"ok": true}` |
| `POST /resumen` | `{"creativos": {...}}` o `{"salud": {...}}` | `{"ok": true}`: Node lo pega al próximo reporte de estado con la misma regla de `Monitor.devolver` (creativos se unen, salud vale la más reciente) |

`campos` de `/falla` son exactamente los de `Monitor.kt` (`evento`, `tipo`,
`confianza`, `detectada_en`, `detalle`, `fila`, `columna`, `falla_id`): Node los
manda como multipart a `POST /api/device/fallas` con la foto en `photo`.

En la Pi no hay lente ni zoom: `abrir` los ignora. `camara_permitida` siempre es
`true`.
