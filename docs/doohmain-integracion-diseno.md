# Integración con Doohmain — Diseño y análisis previo

> Documento de trabajo para planear la conexión con la API de Doohmain v2.8.4
> (ver `doohmain-api-2.8.4.md` y el PDF original en este mismo directorio).
> **Todavía no hay código de integración escrito.** Este documento fija el estado
> actual, las decisiones a tomar y los bloqueos, para no improvisar al programar.
>
> Objetivo del negocio: **publicar cada campaña de SPACES como una sublista
> (`list`) en las pantallas de Doohmain.**
>
> **Revisión 2** — Se cierra el concepto de sublista (folio, una por campaña,
> creada desde cero), se añade el requisito de "número de repeticiones del spot",
> se agrega la sección de validaciones, y se verifica el soporte de varias
> imágenes HTML.

## 1. Estado actual: tres andamiajes desconectados

Al analizar el repo aparecen **tres** mecanismos de integración distintos, y
ninguno habla con los otros:

### A. Stack de conectores en `apps/api` (completo en forma, muerto en fondo)
- Interfaz `CMSConnector` — `apps/api/src/connectors/connector.interface.ts`
- `DoohmainConnector` — `apps/api/src/connectors/doohmain/doohmain.connector.ts`
  → **esqueleto**: sus 5 métodos lanzan `Error('DoohmainConnector: credenciales no configuradas')`.
- `ConnectorRegistry.fromTenantConfig()` — `connector.registry.ts` → nadie lo llama fuera de tests.
- Orquestación de traffic orders — `apps/api/src/modules/comercial/traffic.service.ts`
  y el `publish()` real en `campanas.service.ts:250`.
- Tabla `ConnectorConfig` (schema `apps/api/prisma/schema.prisma:508`) + UI admin
  (`apps/web/app/admin/config/page.tsx` → `admin.routes.ts`) para guardar `apiKey`/`baseUrl`.

**Problema 1 — no corre en producción.** pm2 en el servidor solo tiene `spaces-web`.
Todo `apps/api` está apagado.

**Problema 2 — el publish real está hardcodeado a MANUAL.** `campanas.service.ts:223`
hace `const connector = new ManualConnector()`. Nunca consulta el registry ni la
config del tenant. Aunque se configuraran credenciales de Doohmain, este código
jamás las usaría.

### B. Envío a dominio en `apps/web` (vivo, pero solo cambia banderas)
- Ruta Next `apps/web/app/api/campanas/[id]/enviar-dominio/route.ts` (LIVE en prod).
- Controlador `enviarADominioCtrl` → `enviarADominio()` en `campanas-repo.ts:571`.
- **Solo actualiza banderas** (`enviada_dominio`, `validacion_estatus='PENDIENTE'`) y
  registra la acción "Envió campaña al dominio". **No llama a ningún CMS.**

### C. Página demo de integraciones (vivo, basado en env vars)
- `apps/web/app/demo/(shell)/integraciones/page.tsx` → ruta `/api/integraciones`.
- Muestra estado "Conectado / Modo demo" según variables de entorno. Sin lógica de
  publicación.

> **Conclusión:** lo que está vivo (B y C, en `apps/web`) no publica nada; lo que
> sabe publicar (A, en `apps/api`) está apagado y, aun encendido, ignora el
> conector configurado. La integración real hay que **construirla**, no "activarla".

## 2. Decisión de arquitectura (bloqueante — elegir antes de programar)

**¿Dónde vive la integración de Doohmain?**

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| **1. Levantar `apps/api` en prod** | Arrancar Fastify con pm2, apuntar `spaces-web` a él, migrar Prisma | Reusa `CMSConnector`, `TrafficOrder`, `ConnectorConfig`, registry ya diseñados | Nuevo proceso que operar; hoy prod sirve el demo con mockAdapter, no el API |
| **2. Implementar en `apps/web/lib/server`** | Escribir el conector como módulo del web, colgado de `enviar-dominio` | Es lo único vivo hoy; un solo proceso | Duplica el modelo de conectores; hay que crear persistencia del lado web |

Recomendación a discutir: **Opción 1** si la meta es el producto real, porque el
modelo de datos ya existe. Esta decisión condiciona TODO lo que sigue.

## 3. Flujo objetivo: campaña → sublista en Doohmain

**Sublista = una por campaña. Su nombre = el folio de la campaña (`Campana.folio`).
Se crea desde cero en cada pantalla.** Los folios reales (`EYRO20260709622`,
`G50020260707660`) son alfanuméricos y únicos, así que sirven tal cual como `list`.

Secuencia de llamadas:

1. `create_campaign` (name, fechas, status, client, **cant_\*** ← repeticiones §6)
   → **devuelve `auth`**. El `auth` es el handle para pausar/cancelar/stats; guardarlo
   **a nivel campaña** (una sublista = un auth).
2. Por cada creativo: `upload` (file) → **devuelve id del arte** (formato sin documentar).
3. Por cada pantalla de la campaña: `create_spot`
   - `name` = nombre del equipo en Doohmain (de `Pantalla.cmsScreenId`)
   - `list` = **el folio de la campaña** (mismo para todas sus pantallas)
   - `campaign` = el `auth` del paso 1
   - `elements` = ids de arte del paso 2, con `start_time`/`end_time`/`days`.
4. Estado y métricas: `get_stats` (por campaña) / `get_metrics` (por equipo), por
   **sondeo** (no hay webhooks).

Pausar / reanudar / cancelar = `update_campaign` con `status` = `pause` / `active` / `finished`.

## 4. Mapeo `CMSConnector` → acciones Doohmain

| Método de la interfaz | Acción(es) Doohmain |
|---|---|
| `publish(instruction)` | `upload` (×creativo) + `create_campaign` + `create_spot` (×pantalla) |
| `pause(ref)` | `update_campaign` auth=ref, status=`pause` |
| `resume(ref)` | `update_campaign` auth=ref, status=`active` |
| `cancel(ref)` | `update_campaign` auth=ref, status=`finished` |
| `getDeliveryReport(ref, periodo)` | `get_stats` auth=ref, start_date, end_date |
| `healthCheck()` | `get_screen_list` (⚠ hoy pega a `/health`, que no existe) |

`referenciaExterna` (interfaz) ≙ `auth` (Doohmain).

## 5. Mapeo de campos SPACES ↔ Doohmain

### Campaña (`create_campaign`)
| Doohmain | SPACES | Nota |
|---|---|---|
| `name` | `Campana.nombre` | ok |
| `start_date` / `end_date` | `Campana.fechaInicio` / `fechaFin` | formatear a `YYYY-MM-DD` |
| `status` | derivar de `estadoComercial` | mapear estados SPACES→(active/pause/finished/pending) |
| `cant_total` / `cant_day` / `cant_hour` / `auto_cant` | **número de repeticiones** (§6) | campo NUEVO; hoy no existe con esa semántica |
| `client` | `Cliente` | ver abajo |

### Cliente (`client` / `update_client`)
| Doohmain | SPACES |
|---|---|
| `name` | `Cliente.nombre` |
| `cuit` | `Cliente.rfc` (⚠ semántica distinta MX/AR) |
| `real_name` / `address` / `client_type` | `Cliente.contactoJson` / `tipo` |

### Sublista y artes (`upload` + `create_spot`)
| Doohmain | SPACES | Nota |
|---|---|---|
| `list` | `Campana.folio` | ✅ RESUELTO — una por campaña |
| `file` | `Creatividad.archivoUrl` / `codigo` | ⚠ creativos son **HTML**; ver §8 |
| `elements[].id` | id que devuelva `upload` | sin documentar |
| `start_time`/`end_time`/`days` | `CampaignLine.horarioJson` | `days` = arreglo 0..6 (0=domingo) |
| `name` (pantalla) | `Pantalla.cmsScreenId` | ⚠ hoy siempre NULL (§9) |

Campos SPACES que Doohmain ignora: `resolucion`, `prioridad`, `sovPorcentaje`, `tipoVenta`, `duracionSpot`.

## 6. Número de repeticiones del spot (REQUISITO NUEVO — falta en el modelo)

Doohmain controla la exhibición con `cant_total`, `cant_day`, `cant_hour` y
`auto_cant` (repartir por hora, 0/1). **SPACES no tiene un campo con esa semántica.**
Lo más cercano es `CampaignLine.frecuencia` (`Int?`, nullable) y `CampaignLine.cantidad`
(default 1), pero son por línea, opcionales y su significado no es "repeticiones del
spot". No hay captura explícita de repeticiones al enviar.

**Qué hay que añadir** (a definir; aquí queda como requisito, no como código):
- Un dato **"número de repeticiones"** capturado **al enviar la campaña como sublista**.
- Decidir su granularidad y a qué `cant_*` mapea:
  - repeticiones totales → `cant_total`
  - por día → `cant_day`
  - por hora → `cant_hour`
  - `auto_cant` (repartir a la hora) → checkbox on/off
- Decidir si es a nivel campaña (recomendado, porque la sublista y el `auth` son por
  campaña) o por pantalla.
- Validar que sea entero ≥ 1 (ver §7).

> **Todo lo demás de esta sección es validación**: capturar el número, validarlo, y
> mandarlo en `create_campaign`. No requiere cambiar el flujo de sublista.

## 7. Validaciones antes de publicar la sublista

Qué debe validar el sistema antes de llamar a Doohmain (falla temprano, no a mitad
de la secuencia de llamadas):

**Ya existe hoy:**
- Campaña confirmada por el cliente (`enviarADominio` exige estado comprometido).
- Al menos un creativo para DOOH/HIBRIDA (`enviarADominio` lanza "no tiene anuncios").

**Falta añadir:**
- **Número de repeticiones** presente y entero ≥ 1 (§6); si `auto_cant=1`, coherencia
  con `cant_hour`/`cant_day`.
- **Cada creativo tiene contenido usable** (`archivoUrl` o `codigo` no vacío) — hoy el
  armado de instrucción ignora `codigo` (§8).
- **Formato aceptado por Doohmain** (imagen/video). Si el creativo es HTML, decidir
  rasterizar o rechazar (§8).
- **Cada pantalla tiene `cmsScreenId`** (mapeada a un `name` de Doohmain). Sin esto,
  `create_spot` no tiene destino.
- **Lista de pantallas no vacía** para la campaña.
- **Cliente con `name`** (obligatorio en `create_campaign`).
- **Fechas válidas**: `fechaInicio ≤ fechaFin`, formato `YYYY-MM-DD`.
- **Horario**: `start_time`/`end_time` en `HH:mm`; `days` en rango 0..6.
- **Folio no reenviado en conflicto** — ver idempotencia (§13). Si la sublista ya se
  creó, decidir qué hacer antes de reenviar.

## 8. Soporte de varias imágenes HTML para la sublista (verificación)

**Cardinalidad: SÍ.** `TrafficInstruction.creatividades` es un `Array<…>` y
`campanas.service.ts:232` hace `campana.creatividades.map(...)`, recogiendo **todos**
los creativos de la campaña. Enviar N imágenes a una sublista está soportado en forma;
en `create_spot` caen como `elements` (arreglo).

**Contenido HTML: INCOMPLETO.** Dos huecos concretos:
1. El armado solo lee `url: c.archivoUrl ?? ''` (`campanas.service.ts:233`). Un creativo
   guardado en `codigo` (como `TEST_creativo.png` en prod, con `archivoUrl=NULL`)
   produce `url: ''` — **se manda vacío**.
2. La interfaz `TrafficInstruction.creatividades[]` **no tiene ningún campo para el
   HTML/`codigo` inline** — solo `url`, `storageKey`, `formato`, `duracionSeg`,
   `resolucion`. El HTML que vive embebido no tiene por dónde viajar.

> Conclusión: se pueden mandar **varias** imágenes (arreglo), pero el pipeline actual
> **no traslada bien los creativos HTML**. Antes de publicar HTML hay que resolver §9
> (¿`upload` acepta HTML? ¿se rasteriza?) y ampliar la instrucción para llevar el
> contenido inline, no solo `archivoUrl`.

## 9. Bloqueos vigentes

1. **`cmsScreenId` nunca se llena.** La columna existe (`Pantalla.cmsScreenId`) pero
   ningún código la escribe; siempre NULL. Falta una **sincronización de pantallas**
   (`get_screen_list` → `Pantalla.cmsScreenId`).
2. **Creativos HTML vs `upload` imagen/video.** Si Doohmain no acepta HTML, hay que
   **rasterizar** (HTML → imagen/video) antes de subir. Ligado a §8.
3. **`upload` no documenta qué retorna**, y `create_spot` necesita ese id.
4. **`pantallasIds` mal usado.** `campanas.service.ts:231` mete ids internos (cuid) en
   `pantallasExternas`; en los seeds siempre está `[]`. Debe llevar los `name` externos.

## 10. Desajustes de datos a decidir

- **RFC vs CUIT.** `Cliente.rfc` (México) → campo `cuit` (Argentina). Validaciones distintas.
- **`update_client` se identifica por `auth` de campaña**, no por id de cliente.
- **Creativos a nivel campaña, no por pantalla.** `Creatividad` cuelga solo de
  `campanaId`. Como `create_spot` es por pantalla, **cada pantalla recibiría todos los
  creativos**. Decidir si se filtra por resolución/orientación.

## 11. Componentes a construir (checklist)

- [ ] Decidir arquitectura (§2) — **primero**.
- [ ] Cliente HTTP de Doohmain (endpoint único `index.php?action=…`, `api_key`).
- [ ] Implementar los 6 métodos de `DoohmainConnector` (hoy stubs).
- [ ] Enganchar el registry: usar el conector configurado, no `new ManualConnector()`.
- [ ] Captura + validación del **número de repeticiones** (§6, §7).
- [ ] Ampliar `TrafficInstruction` para llevar el HTML inline (§8).
- [ ] Sincronización de pantallas (`get_screen_list` → `Pantalla.cmsScreenId`).
- [ ] Estrategia para creativos HTML (rasterizar o no).
- [ ] Sondeo de métricas/entrega (`get_stats`/`get_metrics`).
- [ ] Mapear estados de campaña SPACES → `status` Doohmain.
- [ ] Correcciones de seguridad (§12).
- [ ] Pruebas contra el entorno real de Doohmain (necesita `api_key`).

## 12. Correcciones de seguridad a incluir

- **Credenciales en base64, no cifradas.** `admin.routes.ts:116` hace
  `Buffer.from(...).toString('base64')` pese a llamarse `credencialesEnc` y a que la UI
  dice "se guardan cifradas".
- **`api_key` como parámetro.** Enviarlo en el cuerpo por POST, no en query string.
- **`healthCheck` roto.** Pega a `/health` (inexistente) y no revisa `res.ok`. Cambiar a
  `get_screen_list`.

## 13. Lo que el PDF NO responde (pendiente con Doohmain / requiere api_key)

1. **⚠ IDEMPOTENCIA DEL REENVÍO (máxima prioridad).** La sublista se crea desde cero y
   una campaña **se puede reenviar** (`validarPublicacion` pone `enviada_dominio=false`
   al rechazar). ¿Qué hace `create_spot` si llega un `list` (folio) que **ya existe** en
   esa pantalla: lo duplica, lo reemplaza o da error? El PDF **no documenta `update_spot`
   ni `delete_spot`**, así que no hay forma descrita de corregir/borrar una sublista ya
   creada. Sin resolver esto, un reenvío puede duplicar spots en pantalla.
2. Si `upload` acepta HTML.
3. Qué devuelve `upload` (y de ahí el `id` del arte).
4. Método HTTP, `Content-Type`, formato de respuestas y códigos de error.
5. Sensibilidad a mayúsculas de los parámetros (`Auth`/`Screens` vs `auth`).

**Una sola sesión de llamadas reales** a `get_screen_list`, `upload` y un
`create_spot`/reenvío de prueba cerraría casi todas estas incógnitas.

## 14. Próximos pasos sugeridos

1. Cerrar la **decisión de arquitectura** (§2).
2. Conseguir el `api_key` y (si existe) el entorno de pruebas.
3. Confirmar con Doohmain la **idempotencia del reenvío** (§13.1) y el formato de
   respuesta de `upload`/`get_screen_list`.
4. Definir la captura del **número de repeticiones** (§6).
5. Con eso, escribir el cliente HTTP + `DoohmainConnector` y las migraciones de modelo.
