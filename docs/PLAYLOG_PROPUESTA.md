# PlayLog / Histórico de Telemetría — Análisis y propuesta

_Diseño previo a la implementación. Objetivo: registrar y visualizar el comportamiento de cada dispositivo en el tiempo, con gráficas, alertas, filtros y exportación, sin afectar el rendimiento del servidor ni el consumo de datos/batería de los equipos._

---

## 1. Punto de partida: gran parte YA existe

El sistema **ya captura telemetría periódica**. El agente (`DeviceStatusCollector`) recolecta el estado cada **60 s** y lo envía a `POST /api/device/status`; el backend inserta **una fila por reporte** en la tabla **`device_status`**, que **ya está particionada por mes** (`PARTITION BY RANGE (UNIX_TIMESTAMP(reported_at))`).

**Casi todas las métricas pedidas ya se guardan hoy:**

| Métrica pedida | Dónde está hoy |
|---|---|
| Temp CPU | `device_status.cpu_temp` |
| Temp batería | `device_status.battery_temp` |
| Nivel batería % | `device_status.battery_pct` |
| Estado de carga | `device_status.battery_charging` |
| Señal móvil | `device_status.signal_dbm` |
| Tipo de conexión (WiFi/móvil) | `device_status.network_type` |
| Operador | `device_status.network_operator` |
| RAM | `device_status.ram_free_mb` |
| Almacenamiento | `device_status.storage_free_mb` |
| Uptime | `device_status.uptime_seconds` |
| Última conexión | `devices.last_seen_at` |
| Estado del dispositivo | derivado (`devices.online` + `last_seen_at`) |
| **Estado de conexión a Internet** | ⚠️ NUEVO campo (validación real de red) |

> **Implicación clave:** el PlayLog se puede construir **para toda la flota — incluidos los teléfonos viejos que no se pueden actualizar** — usando la historia que **ya se está guardando**. Las mejoras del lado de la app (batching, cadencia adaptativa, campo "internet válido") aplican solo a APK nuevas/reflasheables, pero **no son un requisito** para ver el histórico de los equipos actuales.

El trabajo real es: (a) **almacenamiento escalable con rollups**, (b) **APIs de consulta/exportación**, (c) **UI del dashboard** (gráficas/alertas/filtros), (d) **motor de alertas**, y (e) **optimización de cadencia** en la app.

---

## 2. Almacenamiento escalable (la mejor forma)

A 60 s por muestra: **1 440 filas/día por dispositivo** (~43 k/mes). Con 100 equipos = ~4.3 M filas/mes. MySQL lo aguanta con particiones, pero **graficar un mes leyendo filas crudas es caro**. Solución: **dos niveles (raw + agregados)**.

### Nivel 1 — Crudo (`device_status`, ya existe)
- Se mantiene tal cual (partición mensual). Retención **corta**: p. ej. **14–30 días**. La poda es barata: **`DROP PARTITION`** de meses viejos (no `DELETE`).
- Sirve para: estado actual, gráficas **por hora** (alta resolución reciente), diagnóstico fino.

### Nivel 2 — Rollups agregados (NUEVO)
Tablas resumidas pre-calculadas por dispositivo y periodo, con **avg / min / max** de cada métrica numérica:
- **`telemetry_hourly`** (device_id, hora, avg/min/max de temp/batería/señal/ram/storage, muestras, %online…). Retención **larga** (p. ej. 13–24 meses).
- **`telemetry_daily`** (opcional, para semana/mes/año). Retención de años (es minúscula).

Se calculan con **reconciliación idempotente** (al vuelo en cada consulta que cierre una hora, o un job ligero cada hora — el sistema ya usa este patrón). Ventaja: **las gráficas de día/semana/mes leen cientos de filas, no millones** → rápido y constante sin importar la antigüedad.

**Regla de resolución en las gráficas:**
| Rango | Fuente | Puntos aprox. |
|---|---|---|
| Hora | `device_status` crudo | ~60 |
| Día | `telemetry_hourly` | 24 |
| Semana | `telemetry_hourly` | 168 |
| Mes | `telemetry_daily` (o hourly agregado) | ~30 |

**Mantenimiento de particiones:** un job mensual crea la partición del mes siguiente y elimina las que superan la retención cruda.

---

## 3. Cadencia de envío y ahorro de datos/batería

El costo real no es leer la telemetría (barato), sino **despertar el radio** para cada request. Hoy son 1 440 requests/día (~40–60 MB/mes solo de telemetría por equipo con overhead TLS/HTTP).

**Estrategia recomendada (para la APK nueva):**
1. **Muestrear local cada 60 s** (mantiene granularidad de 1 min) → guardar en buffer local (Room/archivo).
2. **Enviar por lotes**: 1 request con varias muestras. **Cada 5 min en datos móviles**, **cada 1–2 min en WiFi o cargando**. → ~5–6× menos requests.
3. **Envío inmediato solo ante eventos importantes**: cambio de carga, cambio de red/operador, o **cruce de un umbral de alerta** (para que la alerta llegue sin demora).
4. **Store-and-forward**: si no hay red, se acumula y se **vacía al reconectar** (cero pérdida de historial).
5. **Compresión** (gzip) del lote y payload mínimo.

**Resultado:** se conserva 1 min de resolución, pero el consumo baja de **~40–60 MB/mes a ~10–15 MB/mes por equipo**, con menos despertares de radio → **menos batería**. Requiere un endpoint nuevo `POST /api/device/status/batch` (el actual de 1 muestra se mantiene por compatibilidad con los equipos viejos).

---

## 4. Estado del dispositivo y motor de alertas

**Estado (derivado, sin columna nueva):**
- **En línea:** reporte/socket dentro de ~2× el intervalo esperado.
- **Sin conexión:** sin reporte dentro del umbral.
- **Error:** cruza umbral crítico (temp/batería) o hay errores repetidos en `device_logs`.

**Alertas por umbral (NUEVO, evaluación server-side barata en cada reporte):**
- Umbrales **configurables** (globales y/o por dispositivo): p. ej. `cpu_temp > 60°C`, `battery_temp > 45°C`, `battery_pct < 20%`, `signal_dbm < -105`, `storage_free_mb < 500`, `offline > 10 min`.
- Al **cruzar** un umbral se crea una fila en una tabla **`alerts`** (device_id, tipo, valor, nivel, abierta/cerrada, timestamps). **Con debounce/estado** para no spamear (una alerta por episodio, se cierra al normalizar).
- El dashboard muestra alertas activas + historial; opcional: notificación in-app (ya existe el patrón de logs/eventos).

---

## 5. Visualización en el Dashboard (producción actual: Alpine + Tailwind)

- **Estado actual** de cada dispositivo: ya existe la tarjeta; se enriquece con "estado" (En línea/Sin conexión/Error) y alertas activas.
- **PlayLog (historial):** tabla paginada de muestras con fecha/hora y todas las métricas; filtros por dispositivo y **rango de fechas**.
- **Gráficas hora/día/semana/mes:** líneas de temp CPU/batería, batería %, señal, RAM, storage. Se añade una librería de gráficas ligera por CDN (**Chart.js** o **uPlot**) al dashboard actual (que hoy no tiene charts).
- **Alertas:** panel con activas e historial, filtrable.
- **Exportación:** **CSV nativo** (trivial, sin dependencias) como primera opción; **Excel (.xlsx)** con SheetJS (CDN) o generado en el backend. Export respeta los filtros activos (dispositivo + rango).

---

## 6. APIs nuevas (backend)

- `GET /api/devices/:id/telemetry?from&to&granularity=raw|hour|day` → serie para las gráficas.
- `GET /api/devices/:id/telemetry/export?format=csv|xlsx&from&to` → descarga.
- `POST /api/device/status/batch` → ingesta por lotes (APK nueva; el `/status` de 1 muestra se conserva).
- `GET /api/alerts?device_id&status` · `GET/PUT /api/alerts/thresholds` → alertas y config de umbrales.
- (Opcional) `GET /api/devices/:id/health` → estado derivado actual.

---

## 7. Por qué NO afecta el rendimiento

- **Ingesta:** igual que hoy (o menos requests con batching). La evaluación de alertas es O(1) por reporte.
- **Consulta:** las gráficas históricas leen **rollups** (cientos de filas), no la tabla cruda (millones).
- **Almacenamiento:** raw acotado por **retención + `DROP PARTITION`**; los rollups son pequeños y crecen lento.
- **Servidor:** el rollup horario es un agregado incremental barato; sin picos.

---

## 8. Aplicabilidad: equipos viejos vs nuevos

| | Equipos en campo (APK vieja) | Equipos nuevos / reflasheados (APK nueva) |
|---|---|---|
| Histórico/PlayLog en dashboard | ✅ Sí (usa `device_status` ya existente) | ✅ Sí |
| Gráficas, alertas, filtros, export | ✅ Sí | ✅ Sí |
| Cadencia adaptativa + batching (ahorro datos/batería) | ❌ siguen a 60 s | ✅ Sí |
| Campo "internet válido" | ❌ n/d | ✅ Sí |

**El PlayLog es útil de inmediato para toda la flota**; las optimizaciones de la app llegan con las APK nuevas.

---

## 9. Fases sugeridas

- **F1 — Backend de consulta:** endpoints de telemetría (raw/hour) + export CSV, leyendo `device_status` existente. (Valor inmediato, sin tocar la app.)
- **F2 — Rollups:** tablas `telemetry_hourly`/`daily` + agregación + retención por particiones.
- **F3 — Dashboard:** gráficas (Chart.js), tabla PlayLog, filtros, export Excel.
- **F4 — Alertas:** umbrales configurables + tabla `alerts` + panel + (opcional) notificaciones.
- **F5 — App (APK nueva):** muestreo local + batching + cadencia adaptativa + store-and-forward + campo internet válido.

---

## Decisiones a confirmar antes de implementar
1. **Retención cruda** (14 vs 30 días) y **de rollups** (13 vs 24 meses).
2. **Cadencia objetivo** de la APK nueva (propuesta: 5 min móvil / 1–2 min WiFi-cargando, batching).
3. **Umbrales de alerta** iniciales (valores por defecto de temp/batería/señal/storage/offline).
4. **Librería de gráficas** para el dashboard actual (Chart.js recomendada) y **formato de export** prioritario (CSV vs Excel).
5. ¿Las alertas generan **notificación** (in-app/otro canal) o solo se muestran en el panel?
