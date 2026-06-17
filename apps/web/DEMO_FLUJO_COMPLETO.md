# Flujo completo de demo — Spaces (con subida de inventario)

App en modo desarrollo: `http://localhost:3000/spaces-dooh/demo/`
En celular (misma WiFi): `http://192.168.100.169:3000/spaces-dooh/demo/`

> Todo es mock en memoria: un **refresh** o el botón **"Reiniciar demo"** vuelve al estado inicial.

---

## 0. Preparación
1. Abre `/demo/` → te lleva al login.
2. Entra como **Cliente_ RGB Catorce** (acceso rápido; cualquier contraseña). Aterrizas en el **Dashboard** con rol Dueño (ve todos los módulos).
3. Ten a la mano el archivo de prueba: `C:\Users\Server\Downloads\sitios-demo-prueba.csv`.

---

## PARTE A — Subida de inventario

### A1. Importar archivo (carga masiva)
1. En el **Dashboard**, baja hasta **"Agregar inventario"** → botón **Agregar inventario**.
2. Se abre **Carga masiva de inventario**. Muestra:
   - **Descargar plantilla** (baja la plantilla vacía: solo hoja Sitios con 23 columnas).
   - **+ Nueva pantalla** (alta manual — ver A2).
   - **Precio de impresión por m²** (default 65).
   - Selector de **codificación** y zona **drag-drop**.
3. Arrastra o selecciona `sitios-demo-prueba.csv`.
4. (Opcional) Sube imágenes en bulk: el nombre del archivo debe ser el código (ej. `PRB-001.jpg`).
5. Pulsa **Procesar importación**. Resultado esperado:

| código | resultado | por qué |
|---|---|---|
| PRB-001 | **creado** | estático válido (tarifa de impresión = 12.9×7.2×65) |
| PRB-002 | **creado** | digital válido |
| GRP-010 | **creado (3 modalidades)** | 3 filas mismo código → 1 sitio con mensual/catorcenal/semanal |
| ADV-077 | **advertencia** | tipo_medio "kiosko" no validado + sin coords (default, pendiente de verificación) |
| PRB-ERR | **error** | faltan nombre, exhibicion, unidad, tarifa, costo |

   **Resumen:** total 7 · creadas 3 · advertencias 1 · errores 1.
6. Pulsa **Ver información añadida** → mini-modal con las 4 pantallas que entraron (con sus modalidades).

### A2. Alta manual (una sola pantalla)
1. En el mismo modal, **+ Nueva pantalla** → formulario de **5 tabs**:
   - **Básico:** nombre, dirección, lat/lng, tipo, estado.
   - **Especificaciones:** resolución, caras, modalidades, spots.
   - **IA/Vision:** activa Computer Vision → pide **ID AdMobilize** (obligatorio si está activo).
   - **Precios:** tarifa, costo, precio m².
   - **Imágenes:** **imagen obligatoria** (JPG/PNG ≤5MB) — sin ella no se puede guardar.
2. **Guardar pantalla** → aparece de inmediato en el inventario.

---

## PARTE B — Todo conectado (los imports se ven en cada pantalla)

### Acto 1 — Dashboard
- El **total de pantallas / ocupación** ya considera las recién importadas.
- Panel **"Campañas por finalizar"** y alertas.

### Acto 2 — Comercial (mapa + inventario)
- `/demo/comercial`: los sitios importados (**PRB-001, PRB-002, GRP-010, ADV-077**) aparecen en el **mapa** (coords de Lima) y en la **lista** con su **código de proveedor**.
- Abre la ficha de **GRP-010** → verás sus **3 modalidades** con tarifa cada una; en **ADV-077** verás "coords por verificar".

### Acto 3 — Reservar (mutación en vivo)
1. En Comercial, selecciona **PRB-001** (disponible) + otros 2 → **Reservar** (pines a ámbar).
2. **Confirmar** → pines a verde y el **Dashboard recalcula ocupación**.

### Acto 4 — La campaña viaja (Telco Andina)
1. `/demo/campanas/camp-telco` → pipeline en "en imprenta", candado apagado.
2. En el celular: `/demo/m/ot/ot-telco` → checklist + **tomar foto** + capturar ubicación + **Cerrar OT**.
3. Vuelve a la campaña → pipeline avanzó y **candado encendido**.

### Acto 5 — Finanzas
- `/demo/finanzas`: Telco Andina aparece en **"Listas para facturar"** → **Generar factura** (plazo 60/90/120) → entra a **Cobranza** (semáforo 3 colores).

### Acto 6 — Portal del cliente
- `/demo/portal/telco-andina-2026`: mismo pipeline + evidencias, **sin financieros**.

### Extra — Network y Actividad
- `/demo/network`: indicadores (total, programáticos, tradicionales, CMS). **PRB-002** (digital) puede compartirse a la Network con el toggle.
- `/demo/actividad`: la **bitácora** registra cada acción (importar, reservar, confirmar, cerrar OT, facturar…) con **usuario y fecha/hora**.

---

## Casos de prueba del importador (resumen)
- **Válido estático/digital** → creado.
- **Mismo `codigo_proveedor` en varias filas** → 1 sitio + N modalidades (agrupado).
- **Valor fuera de lista** (tipo_medio/unidad/exhibicion) o **coords vacías** → advertencia (se importa).
- **Falta requerido** (nombre/exhibicion/unidad/tarifa/costo) → error (no se importa, las demás sí).
- **Reimportar el mismo archivo** → pregunta **Actualizar** vs **Crear -v2** antes de procesar.

## Reinicio
- "Reiniciar demo" (barra superior) o refresh → vuelve al estado inicial.
