# Plan de avance — Semana del 21 al 27 de julio 2026

**Proyecto:** SPACES OS — ERP para medios OOH / DOOH
**Alcance de la semana:** cerrar lo validado en la auditoría técnica integral e implementar el
**conteo de repeticiones de imagen y visualizaciones** (integración con SPACE EYE).
**Objetivo:** dejar todo implementado y en verde esta semana.

---

## 1. Resumen ejecutivo

La semana arranca con el sistema SPACES OS ya endurecido y auditado: hoy se cerró por completo
la fase de **Hardening de seguridad** (7 bloques de la auditoría integral) y se avanzaron tres
funciones de negocio, todo verificado contra base de datos real y con las pruebas en verde.

El resto de la semana tiene dos frentes:

1. **Cerrar los pendientes "cerrables por código"** que la auditoría integral dejó identificados
   (storage real, scheduler, correo, proof-of-play interpretado).
2. **Implementar la función nueva:** contabilizar cuántas veces se repite cada imagen (creativo)
   en las pantallas y las visualizaciones, integrando **SPACE EYE** (verificación por cámara + IA
   de espectaculares) con SPACES OS.

Al cierre de la semana se entrega el reporte final de la fase y el tablero de visualizaciones por
campaña funcionando.

---

## 2. Lo realizado hoy (lunes 21 de julio)

Todo lo de esta sección está **implementado y verificado** (base de datos real, smoke E2E 13/13,
72 pruebas unitarias, compilación y build limpios).

### 2.1 Hardening de seguridad — auditoría integral (7 bloques cerrados)

| Bloque | Qué se cerró | Estado |
|---|---|---|
| **A — Aislamiento de usuarios** | Se cerró un IDOR: editar/borrar usuarios ahora filtra por organización; la tabla `usuarios` quedó con seguridad a nivel de fila (RLS) fail-closed | ✅ verificado (404 cross-tenant) |
| **B — RLS en todas las tablas** | Las 16 tablas restantes con `tenant_id` quedaron fail-closed + FORCE; sin sesión no se ve nada de ningún cliente | ✅ query de control en 0 filas |
| **C — Permisos de lectura** | Cada consulta (GET) exige el permiso del módulo; el dashboard filtra sus secciones según el rol | ✅ 13/13 aserciones |
| **D — Validación de subidas** | Los 7 puntos de subida validan tamaño y tipo real (magic bytes); se rechaza un ejecutable disfrazado o un SVG con scripts | ✅ 422 en los 7 |
| **E — Endurecimiento de acceso** | Rate-limit en el desbloqueo del Dueño; cambio de correo/contraseña pide la contraseña actual; cookie segura por default; token anti-CSRF en todas las operaciones | ✅ 4/4 gates |
| **F — Matriz de permisos** | La matriz de la pantalla de administración se lee de la base de datos (misma fuente que los permisos reales), ya no de una copia desincronizada | ✅ refleja cambios sin desplegar |
| **G — Limpieza de código muerto** | Se archivó el segundo frontend y el backend Fastify que nunca se desplegó; el proyecto compila solo con lo vivo | ✅ build y CI limpios |

### 2.2 Integración con DOOHmain (pantallas digitales)

- Al publicar una campaña en DOOHmain se envían **las fechas contratadas** (inicio/fin), y se
  mantienen sincronizadas si la campaña se extiende o se re-publica.
- Se envía la **programación de spots por día** como cuota diaria (`cant_day`) de la pantalla.
- Probado **contra la API real de DOOHmain** (publicación y actualización con respuesta correcta).

### 2.3 Contratación por tiempo en propuestas y campañas

- Al armar una propuesta, cada sitio se contrata por **unidad de tiempo** (mensual, catorcenal,
  semanal, diaria, por spot o por hora) tomada de sus tarifas publicadas.
- El **precio se calcula solo** (tarifa × periodos del rango) y se captura la **programación de
  spots por día**.
- Esta contratación por tiempo **fluye a la campaña** (las reservas heredan unidad, cantidad y
  programación). Verificado de extremo a extremo.

### 2.4 Mejoras de operación y de interfaz

- Subir creativos **directamente desde la ficha de la campaña** (sin ir a la pantalla de Creativos).
- Menú en el **dashboard para elegir qué alertas mostrar** en pantalla.
- Ajustes de marca en el menú (identidad y legibilidad de botones).

---

## 3. Lo que sigue esta semana

### 3.1 Cierre de pendientes de la auditoría (martes–miércoles)

Los pendientes que la auditoría integral marcó como "cerrables por código":

| Pendiente | Qué falta | Prioridad |
|---|---|---|
| **Storage real (DO Spaces)** | Activar el bucket de objetos y migrar imágenes de base64 en BD a archivos; las llaves ya existen | Alta |
| **Scheduler / cron** | Hoy el vencimiento de reservas, OT y cobranzas corre "a demanda"; pasarlo a un proceso programado | Alta |
| **Proveedor de correo** | Las alertas son solo internas; conectar el envío de correo para notificaciones externas | Media |
| **Proof-of-play interpretado** | Las reproducciones de DOOHmain se guardan crudas; interpretarlas para el conteo por creativo | Alta (habilita §3.2) |
| **Reporte final de Hardening** | Documento de cierre de la fase con la evidencia de cada gate | Media |
| **Timbrado fiscal (CFDI/PAC)** | Bloqueante **externo** (trámite con el PAC); no depende de nuestro código | — externo |

### 3.2 Función nueva — conteo de repeticiones de imagen y visualizaciones (miércoles–viernes)

**Objetivo:** contabilizar, por campaña, **cuántas veces se muestra cada imagen (creativo) en las
pantallas** y las **visualizaciones** (exhibiciones confirmadas), unificando el mundo digital y el
fijo.

El conteo tiene dos fuentes que se suman en un solo tablero por campaña:

- **Pantallas digitales (DOOH) — vía DOOHmain:** cada reproducción reportada por DOOHmain es una
  repetición del creativo en la pantalla. Se interpreta el proof-of-play (§3.1) para obtener el
  conteo por creativo y por pantalla.
- **Espectaculares fijos (OOH) — vía SPACE EYE:** un teléfono en campo toma fotos programadas del
  espectacular y la IA de SPACE EYE verifica cada foto contra la creatividad. **Cada verificación
  "CORRECTO" es una exhibición confirmada** del creativo en ese espectacular. Se cuenta por
  creativo, por espectacular y por periodo, con el PDF de evidencia como respaldo.

**Integración SPACES OS ↔ SPACE EYE:**

1. **Mapeo de entidades:** campaña de SPACES ↔ campaña de SPACE EYE; sitio/espectacular de SPACES
   ↔ dispositivo de SPACE EYE (por código de espectacular).
2. **Ingesta de conteos:** SPACE EYE ya guarda las verificaciones (correcto/incorrecto, confianza,
   fecha, dispositivo). Se expone / consume un resumen de "exhibiciones confirmadas por campaña,
   creativo y fecha" hacia SPACES OS.
3. **Tablero de visualizaciones por campaña** en SPACES OS: repeticiones por creativo (digital +
   fijo), total de exhibiciones confirmadas y ventana de fechas, junto al proof-of-play y las
   evidencias fotográficas que ya tiene la ficha de campaña.

**Nota técnica:** SPACE EYE corre sobre su propio stack (Node/Express + MySQL + Redis + worker de
IA en Python); SPACES OS sobre Next.js + PostgreSQL. La integración es por **API / ingesta
programada** entre ambos, sin fusionar las bases de datos. Esto permite avanzar el conteo digital
(DOOHmain, ya conectado) en paralelo al fijo (SPACE EYE).

---

## 4. Cronograma de la semana

| Día | Frente | Entregable |
|---|---|---|
| **Lun 21** | Hardening + DOOHmain + contratación por tiempo | ✅ Hecho y verificado (ver §2) |
| **Mar 22** | Storage real + scheduler | Imágenes en objeto; barridos programados |
| **Mié 23** | Proof-of-play interpretado + correo | Conteo digital por creativo; alertas por correo |
| **Jue 24** | Integración SPACE EYE (mapeo + ingesta de conteos) | Exhibiciones de fijos ingiriéndose en SPACES |
| **Vie 25** | Tablero de visualizaciones por campaña + reporte final | Función nueva funcionando; reporte de cierre |
| **Sáb–Dom** | Colchón / pruebas de campo | Ajustes y verificación E2E |

---

## 5. Objetivo y entregables de la semana

Al cierre de la semana se entrega:

1. **Todos los pendientes "cerrables por código" de la auditoría** implementados y verificados.
2. **La función de conteo de repeticiones y visualizaciones** operando: por cada campaña se ve
   cuántas veces se mostró cada imagen (digital vía DOOHmain + fijo vía SPACE EYE) y el total de
   exhibiciones confirmadas, con evidencia.
3. **Reporte final** con la evidencia de cada punto cerrado.

Quedan como **bloqueantes externos** (no dependen del código, se gestionan por trámite): el
timbrado fiscal con el PAC y las llaves/contrato del CMS para el proof-of-play interpretado.

---

*Documento de seguimiento semanal · SPACES OS + SPACE EYE · 21 de julio de 2026.*
