---
tipo: manual
estado: en-curso
actualizado: 2026-10-07
tags: [manual, usuario-final, space-eyes, camaras, raspberry, telefono, vinculacion]
archivos:
  - apps/web/components/demo/space-eyes/AltaDispositivo.tsx
  - apps/web/components/demo/space-eyes/DemoSpaceEyes.tsx
  - apps/web/components/demo/space-eyes/SinRespuesta.tsx
  - apps/web/components/demo/space-eyes/EquipoAdmin.tsx
  - apps/web/lib/space-eyes-kit-pi.ts
  - docs/adr/0041-space-eye-vive-dentro-de-cada-instancia.md
---

# Manual de usuario — Space Eyes

> [!info] Borrador que crece por etapas
> Se escribe a la par que se construye la integración definitiva de Space Eyes
> (plan del 06/10). Cada sección dice desde qué etapa existe. Las capturas se
> agregan al cerrar la etapa 5, con la versión que vaya a producción.

## 1. Qué es Space Eyes

Un equipo pequeño junto a cada pantalla —un **teléfono Android**, una
**Raspberry Pi** o una **PC con cámara IP**— que:

- toma **fotos** de lo que está al aire (programadas o cuando las pides);
- te deja ver la pantalla **en vivo** desde SPACE OS;
- **vigila la pantalla** y avisa cuando algo falla (gabinetes apagados o
  congelados, pantalla apagada, cámara movida), con la foto del problema;
- registra cada **creativo nuevo** que aparece en la pantalla.

Todo se consulta y se administra dentro de **SPACE OS › Space Eyes**. Los datos
de tus cámaras viven en el servidor de tu empresa: nadie más los ve.

## 2. Si tu empresa todavía no tiene Space Eyes *(etapa 1)*

Al entrar a **Space Eyes** verás una **demostración**: equipos, fotos, una falla
de ejemplo, métricas e historial. Todo lo que aparece ahí dice **EJEMPLO** y no
son equipos tuyos.

Para contratarlo, pulsa **Solicitar activación**. Se abre un ticket de soporte
que puedes seguir en **Administración › Configuración › Soporte**. Si no ves el
botón, pídele a un administrador de tu empresa que lo solicite.

Cuando se active, esa misma sección muestra tus equipos reales. No hay que
configurar nada.

## 3. Cómo leer el estado de un equipo *(etapa 1)*

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| **En línea** (verde) | El equipo se comunicó en los últimos 10 minutos. | Nada. |
| **Sin comunicación** (rojo) | Lleva más de 10 minutos sin comunicarse. | Revisa la luz o el internet del sitio. Desde la ficha › **Equipo** puedes reiniciar la app o, si es Raspberry, el equipo completo. |
| **Pendiente de vincular** (ámbar) | Se dio de alta pero nunca se ha comunicado. | Termina su instalación (ver § 4). |

Un equipo nunca se da por funcionando solo por estar en la lista: lo dice su
**última comunicación**.

Si sale **«El servicio de cámaras no responde en este momento»**, el servidor
de cámaras de tu empresa se está actualizando o reiniciando. Tus equipos siguen
trabajando y lo que tomen aparece cuando vuelva. Pulsa **Volver a intentar**
en unos minutos; si pasa más de una hora, abre un ticket de soporte.

## 4. Agregar un equipo *(etapa 2)*

**Space Eyes › Equipos › Agregar dispositivo.** Necesitas permiso de edición en
Inventario.

Cada equipo nuevo entra con un **código de vinculación** que se genera ahí
mismo:

- sirve **una sola vez** (el primer equipo que lo usa lo gasta);
- **vence**: 1 hora el de un teléfono, 14 días el de una Raspberry o una PC;
- se puede **cancelar** desde la lista «Códigos de vinculación»;
- queda registrado quién lo generó y qué equipo lo usó.

Sin código, un equipo nuevo **no puede** entrar a tu empresa.

### 4.1 Un teléfono Android

1. Instala la app **Space Eye** en el teléfono (el enlace de descarga está en la
   misma pantalla).
2. En SPACE OS elige **Teléfono Android** y pulsa **Generar código**. Aparece un
   **QR**.
3. Abre la app en el teléfono: la primera vez muestra **Vincular este
   teléfono**. Toca **Escanear código QR** y apunta al QR de la pantalla.
   - Si la cámara no lo lee, escribe el código (por ejemplo `ABCD-2345`) y la
     dirección del servidor que aparece en SPACE OS.
4. En unos segundos el teléfono aparece en **Equipos**. Ábrelo y ponle el nombre
   del sitio.

Si el teléfono dice que **el código no sirve**, venció, ya se usó o se canceló:
genera otro.

### 4.2 Una Raspberry Pi — se instala sola (recomendado)

No hace falta conectarse a la Raspberry, ni saber su IP, ni escribir comandos.

1. En SPACE OS elige **Raspberry Pi › Se instala sola**.
2. Escribe el **nombre del sitio** (opcional) y cómo se conecta a internet:
   - **WiFi**: nombre de la red y contraseña;
   - **Cable o módem**: no hay que escribir nada.
3. Pulsa **Descargar archivo para la microSD**. Se descarga
   `space-eye-raspberry-XXXXXXXX.zip`. La contraseña del WiFi solo queda dentro
   de ese archivo; no se envía a ningún servidor.
4. En tu computadora, graba la microSD con **Raspberry Pi Imager**:
   - Dispositivo: Raspberry Pi 5. Sistema: **Raspberry Pi OS Lite (64-bit)**.
   - Cuando pregunte si quieres personalizar la configuración, elige **No**.
5. Sin sacar la microSD, ábrela en el explorador de archivos (aparece como
   **bootfs**). Abre el `.zip` descargado y copia **user-data** y
   **network-config** a la microSD. Cuando pregunte, **reemplaza** los que trae.
6. Pon la microSD en la Raspberry. Conecta la cámara (cable 22↔15), el cable de
   red o el módem si se usa, y la **fuente de 5V/3A** (la de una laptop no
   alcanza).
7. En **5 a 15 minutos** aparece sola en **Equipos**.

Un mismo archivo sirve para **una** Raspberry y vence en 14 días. Para varias,
descarga uno por cada una.

> [!warning] Requisito
> La microSD tiene que grabarse con una imagen de Raspberry Pi OS **del 24 de
> noviembre de 2025 o posterior** (la que trae Imager hoy). Las anteriores no
> leen estos archivos.

### 4.3 Una Raspberry Pi — que ya está encendida

Si ya tienes la Raspberry funcionando y con internet:

1. En SPACE OS elige **Raspberry Pi › Ya está encendida** y pulsa **Generar
   código**.
2. Copia el comando que aparece y pégalo en una terminal de la Raspberry.
3. Aparece en **Equipos** en uno o dos minutos.

### 4.4 Una PC con cámara IP

1. En SPACE OS elige **PC con cámara IP** y pulsa **Generar código**.
2. Descarga el instalador **SpaceEyeAgente** en la PC del sitio y ábrelo como
   administrador.
3. En el asistente escribe la **dirección del servidor de tu empresa** y el
   **código** (los dos aparecen en SPACE OS), y los datos de la cámara IP.
4. La PC aparece en **Equipos** al terminar.

## 5. Administrar un equipo a distancia

En la ficha del equipo › **Equipo**:

- **Actualizar app**: instala la versión publicada. El equipo la prueba antes de
  reemplazar nada y, si la nueva no arranca, **regresa sola** a la anterior.
- **Reiniciar app**: reinicia el programa del equipo.
- **Reiniciar equipo** *(solo Raspberry)*: reinicia la Raspberry completa. Es lo
  que destraba una cámara o una red que se quedaron colgadas.

## Pendiente de escribir

- Mudar equipos existentes a otro servidor *(etapa 3)*.
- Activar o desactivar Space Eyes por empresa desde el panel *(etapa 4)*.
- Capturas de pantalla de la versión final *(etapa 5)*.
