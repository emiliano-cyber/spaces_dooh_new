# SPACE EYE — Resiliencia del agente Android (operación desatendida)

Objetivo: que el agente instalado en sitio opere de forma autónoma el mayor
tiempo posible, se recupere solo ante fallos y minimice la intervención humana.

Este documento describe **qué mecanismos implementa la app**, **qué limita
Android** y **qué configuración manual maximiza la disponibilidad**.

---

## 1. Mecanismos implementados en la app

| Mecanismo | Qué hace | Archivo |
|---|---|---|
| **Foreground Service** | El `MonitorService` corre en primer plano con notificación persistente → el sistema lo prioriza y rara vez lo mata. | `service/MonitorService.kt` |
| **START_STICKY** | Si el sistema mata el servicio por memoria, lo vuelve a crear automáticamente. | `MonitorService.kt` |
| **Reinicio ante crash** | Un `UncaughtExceptionHandler` global agenda (AlarmManager) un reinicio del servicio ~2 s antes de que muera el proceso. | `SpaceEyeApp.kt` → `RestartReceiver.kt` |
| **Sobrevive "quitar de recientes"** | `onTaskRemoved` agenda un reinicio del servicio. | `MonitorService.kt` |
| **Auto-arranque en boot** | `BootReceiver` levanta el servicio tras reiniciar el equipo. | `service/BootReceiver.kt` |
| **Watchdog periódico** | `WorkManager` revisa cada ~15 min que el servicio esté vivo y lo reactiva. Persiste a reinicios y muertes del proceso. | `service/WatchdogWorker.kt` |
| **Latido (~4 min)** | Alarma `setAndAllowWhileIdle` que se re-programa sola y revive el servicio; AlarmManager recrea el proceso aunque esté muerto. Baja el peor caso de 15 min a ~4. | `SpaceEyeApp.kt` → `RestartReceiver.kt` |
| **Exención de batería** | Al abrir, pide excluir la app de la optimización de batería (Doze). | `MainActivity.kt` |
| **Modo kiosco (Lock Task)** | Si el equipo es *device owner*, fija la app en pantalla sin salida. | `MainActivity.kt` + `KioskAdminReceiver.kt` |
| **WakeLock parcial** | Mantiene la CPU activa con pantalla apagada/bloqueada → heartbeat, comandos y capturas siguen operando. | `MonitorService.kt` |
| **Reinicio en `onDestroy`** | Al destruirse el servicio por cualquier causa, agenda su reinicio. | `MonitorService.kt` |
| **Mostrar sobre lockscreen** | `setShowWhenLocked/TurnScreenOn` para operar/recuperar con el equipo bloqueado. | `MainActivity.kt` |
| **Logging remoto** | El agente reporta eventos/errores (crash, cámara, foto, reinicios) al backend → visibles en el dashboard sin USB. | `network/RemoteLog.kt` |

Capas de recuperación (de más a menos frecuente): Foreground+START_STICKY →
onTaskRemoved/crash restart → Watchdog (15 min) → BootReceiver (tras reinicio).

---

## 2. Limitaciones de Android y cómo las manejamos

### 2.1 Arrancar un Foreground Service desde segundo plano (Android 12+)
Desde Android 12, iniciar un FGS desde background puede lanzar
`ForegroundServiceStartNotAllowedException`. Afecta al **watchdog** y al
**reinicio por AlarmManager**.
- **Mitigación**: se captura la excepción; el reinicio real recae en
  `START_STICKY` (lo hace el sistema, sin restricción) y en el `BootReceiver`.
  La exención de batería reduce estos bloqueos.
- **Alternativa**: en modo kiosco/device owner estas restricciones se relajan.

### 2.2 Doze y App Standby
Con la pantalla apagada, el sistema difiere red/alarmas para ahorrar batería.
- **Mitigación**: exención de optimización de batería (`MainActivity`), y estos
  equipos normalmente están **conectados a corriente** (un espectacular), lo que
  evita Doze profundo.

### 2.3 Fabricantes agresivos (MIUI/Xiaomi, Huawei, Oppo, Samsung…)
**El mayor riesgo real.** MIUI mata apps en segundo plano de forma agresiva y
requiere permisos propietarios NO controlables por código:
- **Autostart / Inicio automático**: debe activarse **a mano** por app.
- **Sin límite de batería** / "Sin restricciones" para la app.
- Bloquear la app en recientes (candado).
- **No hay API pública** para conceder esto programáticamente → es configuración
  manual de una sola vez por equipo (ver §3).

### 2.4 Modo kiosco sin *device owner*
`startLockTask()` sin ser device owner solo entra en **screen pinning** débil
(el usuario puede salir). Por eso la app **solo** activa Lock Task si detecta que
es device owner (kiosco real). Si no, no hace nada para no molestar.
- **Requisito del kiosco real**: convertir la app en device owner, que **exige un
  equipo sin cuentas configuradas** (recién reseteado) — ver §4.

### 2.5 Intervalo mínimo del Watchdog
`WorkManager` no permite periodicidad menor a **15 minutos**. Es el mínimo del
SO; para huecos más cortos dependemos de START_STICKY (inmediato).

---

## 3. Checklist de configuración por equipo (maximiza disponibilidad)

Hacer **una vez** al instalar cada teléfono:

1. **Optimización de batería** → *Sin restricciones* para SPACE EYE
   (Ajustes → Batería → o el diálogo que pide la app al abrir).
2. **Autostart / Inicio automático** = ON (Xiaomi: Ajustes → Apps → Permisos →
   Inicio automático). **Imprescindible en MIUI.**
3. **Bloquear en recientes** (Xiaomi: abrir recientes, mantener la tarjeta →
   candado) para que no la limpie el "clear all".
4. Mantener el equipo **conectado a corriente**.
5. Conceder permisos de **Cámara** y **Ubicación** (y notificaciones en A13+).
6. (Opcional, máxima robustez) Activar **modo kiosco** — §4.

---

## 4. Modo kiosco real (device owner)

Solo en un equipo **recién reseteado y sin cuentas de Google**. Con el teléfono
conectado por USB y depuración activada:

```bash
adb shell dpm set-device-owner com.spaceeye.agent/.service.KioskAdminReceiver
```

A partir de ahí la app, al abrir, se auto-whitelistea y entra en **Lock Task**
(pantalla fija sin salida). Beneficios como device owner:
- La app queda anclada; el usuario no puede salir ni abrir otras apps.
- Se relajan varias restricciones de background/FGS.
- Se puede impedir desinstalación y desactivar la barra de estado.

Para revertir: `adb shell dpm remove-active-admin com.spaceeye.agent/.service.KioskAdminReceiver`
(o resetear el equipo).

> Nota: si el equipo ya tiene cuentas configuradas, `set-device-owner` fallará.
> En ese caso la alternativa es un **MDM** (gestor de dispositivos) o dejar la
> app con las mitigaciones de §1–§3 (que ya dan alta disponibilidad).

---

## 5. Resumen de "hasta dónde se puede"

- **Sin tocar el equipo**: foreground service + START_STICKY + watchdog + boot +
  crash-restart → la app se recupera de crashes, del "quitar de recientes" y de
  reinicios. Es robusto para la mayoría de escenarios.
- **Con config manual (§3)**: se evita que MIUI/fabricante la mate → disponibilidad
  alta y sostenida.
- **Con device owner (§4)**: kiosco real, la app queda esencialmente imposible de
  cerrar por el usuario → disponibilidad máxima.

Android **no permite** garantizar 100% de persistencia solo por código; la
combinación de código + config por equipo (+ kiosco cuando se pueda) es la
estrategia recomendada.
