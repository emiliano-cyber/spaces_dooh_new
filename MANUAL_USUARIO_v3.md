# SPACES OS — Manual de usuario (v3)

> **Plataforma de gestión DOOH/OOH.** Este manual recorre el sistema **siguiendo el
> flujo real de creación de una campaña**, con apartados dedicados al **Cliente** y a la
> **Agencia**, y cierra con el **detalle de todos los cambios recientes**.
>
> Demo · datos ficticios. Acceso de demostración: **jose@pixeled.com.mx / spaces123** (rol Dueño).

---

## Contenido

1. Acceso y roles
2. El menú (orden por flujo de creación)
3. Flujo de creación de una campaña (paso a paso)
   1. Dashboard
   2. Agregar inventario (pantallas y **slots**)
   3. Base de inventario: Arrendadores y Network
   4. Clientes
   5. Comercial (reservar en el mapa)
   6. Propuestas
   7. Campañas (pipeline)
   8. Creativos
   9. Imprenta
   10. Operaciones (OT)
   11. Finanzas
   12. Comisiones
4. Apartado **Cliente**
5. Apartado **Agencia**
6. Administración, Actividad e Integraciones
7. **Cambios recientes** (todo lo nuevo)

---

## 1. Acceso y roles

Se entra con correo y contraseña. Cada **rol** ve solo los módulos que le corresponden
(lo que un rol no debe ver, no se muestra):

| Rol | Ve principalmente |
|---|---|
| **Dueño** | Todo el sistema |
| **Comercial** | Campañas, Clientes, Comercial, Propuestas, Creativos, Comisiones, Network |
| **Operaciones** | Operaciones (órdenes de trabajo) |
| **Imprenta** | Imprenta (producción de estáticas) |
| **Finanzas** | Finanzas (facturación y cobranza) |
| **Cliente externo** | Solo su **portal de cliente** (avance, ubicaciones, evidencias) |

La sesión es segura (cookie de sesión, cierre por expiración). Toda acción queda
registrada en **Actividad** (bitácora inmutable).

---

## 2. El menú (orden por flujo de creación)

El menú lateral está **ordenado según el flujo real** en que se crean y operan las cosas:

1. **Dashboard** — panorama
2. **Agregar inventario** — das de alta tus pantallas
3. **Campañas** — el corazón operativo
4. **Arrendadores** — dueños de los predios/pantallas
5. **Network** — compartir inventario
6. **Clientes** — anunciantes (directos o de agencia)
7. **Comercial** — reservar espacios en el mapa
8. **Propuestas** — cotización al cliente
9. **Creativos** — arte que se exhibe
10. **Imprenta** — producción de lonas (estáticas)
11. **Operaciones** — montaje y evidencia (OT)
12. **Finanzas** — facturación y cobranza
13. **Comisiones** — comisión de agencia
14. **Integraciones** · 15. **Actividad** · 16. **Administración**

---

## 3. Flujo de creación de una campaña

### 3.1 Dashboard

Punto de entrada: métricas del negocio, campañas en curso, pendientes por atender
(validaciones, OT abiertas, facturación) y accesos rápidos.

### 3.2 Agregar inventario (pantallas y **slots**)

Aquí registras tus **pantallas/sitios**. Dos vías:

- **Alta manual** (formulario por pestañas: Básico, Especificaciones, IA, Precios, Imágenes).
- **Importación por Excel/CSV**: descarga la **plantilla** —que ahora incluye una hoja de
  **Instrucciones**, la hoja **Sitios** con ejemplos y la hoja **Listas** con los valores
  válidos— llénala y súbela.

**Modelo de slots (digital).** Cada pantalla digital se comercializa por **slots**
(antes “spots”):

- Por **default, 12 slots por pantalla**, con **20 segundos por slot**.
- En el alta puedes ajustar *Total slots*, *Slots disponibles* y *Duración por slot*.
- Los campos numéricos muestran el ejemplo como **leyenda gris** (placeholder); ya no
  traen un valor pre-cargado que haya que borrar.

> Una campaña usará **una parte** de esos 12 slots; varias campañas pueden **compartir**
> la misma pantalla mientras le queden slots libres.

### 3.3 Base de inventario: Arrendadores y Network

- **Arrendadores** — los propietarios de los predios/pantallas, sus **contratos de
  arrendamiento**, renta, periodicidad de pago y vigencia. De aquí sale el propietario y la
  renta que ves en la ficha de cada sitio.
- **Network** — publica/comparte inventario a la red para comercializarlo.

### 3.4 Clientes

Das de alta a los **anunciantes**. Cada cliente es de tipo:

- **Directo** — el anunciante te compra directo.
- **Agencia** — intermediario con **comisión** (ver apartado Agencia).

Aquí también capturas los **datos fiscales** (RFC, razón social, uso de CFDI), necesarios
para poder **facturar** más adelante.

### 3.5 Comercial (reservar en el mapa)

El módulo **Comercial** es el mapa de tu red. Filtras por tipo, distrito, disponibilidad y
precio, y **seleccionas pantallas** para reservar.

Novedades clave:

- Los **datos de cada pantalla** en la lista se muestran **más grandes** (nombre, código,
  distrito, tarifa, slots libres y propietario) para lectura rápida.
- En digitales, la lista muestra **“X/12 slots libres”**.
- **Regla de ocupación por slots:** una pantalla digital es **seleccionable mientras le
  queden slots libres**; cuando llega a **0 slots (ocupada)**, **ya no se puede
  seleccionar** para otra campaña.

Con las pantallas seleccionadas, abres **Reservar** y defines:

- **Cliente**, **nombre de campaña**, **fechas**, **tipo** (Automático/Digital/Fijo/Híbrida).
- Por cada pantalla digital, **cuántos slots** usa la campaña (de los disponibles), y ves la
  **duración por slot (20s)** y el total. Se crea una **reserva tentativa**.

### 3.6 Propuestas

Con la reserva/selección, generas una **Propuesta** (cotización) para el cliente:

- Ítems (pantallas + precio), comisión, fechas, totales (bruto, comisión, neto, IVA, total).
- **Liga pública de la propuesta** (solo lectura) que puedes compartir; ahora se muestra a
  **ancho completo y responsive**, con resumen económico, sitios y **mapa de ubicaciones**.
- Flujo: **Enviada → Aprobada** (se aprueban los ítems) → **Generar campaña**.

### 3.7 Campañas (pipeline)

Cada campaña recorre su **pipeline** según su tipo (OOH/DOOH/Híbrida). En el detalle ves:

- **Pipeline** en vivo, **Validación de publicación**, **Candado de facturación**,
  **Comercial** (presupuesto), **Rentabilidad** (margen), **Reporte de cumplimiento**,
  **Orden de compra**, **Sitios**, **Imprenta**, **Órdenes de trabajo**, **Creatividades** y
  **Evidencias**.
- **Menú lateral de campañas (nuevo):** al entrar al pipeline de una campaña aparece un
  **menú a la izquierda con todas las campañas**, con la actual resaltada, para **saltar
  entre ellas** sin volver al listado.
- Si la campaña tiene **portal activo**, se muestra el botón **“Portal del cliente”**.

### 3.8 Creativos

Subes y apruebas el **arte** de cada campaña y asignas cuál va en cada **slot** reservado.

- **Toda imagen que subes se convierte a HTML (nuevo):** la imagen se incrusta en un
  documento HTML (a pantalla completa, ajustada) y se guarda como **creativo `text/html`**,
  el formato que consume el player DOOH. Las **miniaturas y el preview siguen mostrando la
  imagen** con normalidad.
- También puedes pegar **código HTML** directamente como creativo.
- Cada creativo pasa por **aprobación** antes de asignarse.

### 3.9 Imprenta

Para piezas **estáticas (OOH)**, genera las **órdenes de impresión** (material, medidas,
costo por m²) y su seguimiento de producción.

### 3.10 Operaciones (OT)

Las **órdenes de trabajo** cubren el montaje y la **evidencia comprobatoria** en campo:

- Checklist, **fotografía comprobatoria** y **sello de ubicación** (geo).
- Al **cerrar la OT con foto**, se encienden dos candados de la campaña: **fotos
  comprobatorias** y **reporte de publicación**.
- **La pantalla de la OT ahora ocupa todo el ancho y es responsive (nuevo):** en escritorio
  se divide en dos columnas (Checklist | Foto + Ubicación + Cerrar); en móvil se apila. La
  vista móvil de la cuadrilla en campo se conserva igual.

### 3.11 Finanzas

Cuando el **candado de facturación** está completo, se factura:

> **Candado = OC recibida ✔ + Fotos comprobatorias ✔ + Reporte de publicación ✔**

- Con los tres en verde y el cliente con **RFC/razón social**, la campaña queda
  **Lista para facturar**.
- Al facturar se emite la **factura** (subtotal + IVA) y se crea la **cobranza** con su plazo
  (60/90/120 días). La campaña pasa a **Completada**.

### 3.12 Comisiones

Ajuste de la **comisión por agencia** y su negociación, y asignación de la agencia a cada
cliente directo (ver apartado Agencia).

---

## 4. Apartado — Cliente

El **cliente/anunciante** tiene visibilidad sin entrar a la operación interna:

- **Liga pública de la propuesta** (`/p/…`): documento **de solo lectura** con el resumen
  económico, los sitios y el **mapa** de ubicaciones. Ahora a **ancho completo y responsive**.
- **Portal de la campaña** (por token): muestra **“Avance de tu campaña”**, **Ubicaciones** y
  **Evidencias de instalación** (las fotos comprobatorias que sube la cuadrilla). Se activa
  desde el detalle de la campaña (botón **Portal del cliente**).
- **Portal de cliente** autenticado: el cliente externo puede consultar **sus sitios** y sus
  **órdenes de trabajo** (avance/evidencia), sin ver datos internos (costos, márgenes).

> El cliente **nunca** ve costos de compra, márgenes ni datos de otros clientes.

---

## 5. Apartado — Agencia

Una **agencia** es un cliente intermediario que cobra **comisión** sobre la venta.

- **Alta como Agencia** (en Clientes): tipo *Agencia*, con **% de comisión**, y opcionalmente
  una **negociación** especial (con nota y validación).
- **Cliente directo con agencia:** a un cliente directo se le puede **asignar una agencia**;
  esa relación determina la **comisión que se le aplica**.
- **Módulo Comisiones:** se ajusta la comisión de cada agencia y su negociación, y se asigna
  la agencia a los clientes. La comisión impacta el desglose de la propuesta y la campaña
  (**bruto → comisión de agencia → neto → IVA → total**).

En la **propuesta** y en el detalle de la **campaña** se ve reflejado el porcentaje de
comisión y su efecto en el neto.

---

## 6. Administración, Actividad e Integraciones

- **Administración** — configuración del negocio: logo, moneda, IVA(s), plazos de cobranza,
  tipos de tarea y **reproducción digital** (tamaño del loop y **duración por slot** →
  *slots por loop*). Con **loop 240s / slot 20s** salen **12 slots por loop**.
- **Actividad** — bitácora **inmutable**: quién hizo qué y cuándo, con filtros por fecha,
  hora y usuario. No se puede editar ni borrar.
- **Integraciones** — conectores externos (AdMobilize/Computer Vision, CMS/players, CFDI).
  En el demo operan en **modo simulado** y así lo indican; se activan al configurar sus llaves.

---

## 7. Cambios recientes (todo lo nuevo)

Resumen de todas las mejoras incorporadas en esta iteración:

### Modelo de **slots** (reemplaza “spots”)
- Terminología **spot → slots** en toda la interfaz (Comercial, ficha de sitio, alta de
  inventario, reserva, creativos, administración).
- **12 slots por pantalla** digital por default y **20 segundos por slot**.
- La **campaña define cuántos slots** usa de una pantalla (ya existía por sitio; ahora con
  duración visible).
- **Editar la cantidad de slots** de una pantalla desde su ficha (Editar): *Cantidad de
  slots* y *Duración por slot*, recalculando disponibles sin perder lo ya reservado.
- **Pantalla ocupada = sin slots:** una digital pasa a **Ocupado** solo cuando sus slots
  llegan a 0; mientras le queden, sigue disponible para más campañas. **No se puede
  seleccionar ni reservar** una pantalla sin slots (validado en front y backend).

### Comercial / Inventario
- **Datos de cada pantalla más grandes** en la lista de Comercial (mejor lectura).
- **Placeholders en la carga manual:** todos los campos de alta (coordenadas, dimensiones,
  resolución, caras, precios, precio por m²) muestran el ejemplo como **leyenda gris** en
  vez de un valor pre-cargado que haya que borrar.
- **Plantilla de inventario** con hojas **Instrucciones / Sitios (con ejemplos) / Listas**
  (valores válidos), para llenar correctamente el Excel/CSV.

### Campañas / Propuestas
- **Menú lateral de campañas** dentro del pipeline: salta entre campañas sin volver al
  listado, con la activa resaltada.
- **Liga pública de propuesta** a **ancho completo y responsive**.

### Creativos
- **Imágenes subidas se convierten a HTML** (creativo `text/html` listo para el player DOOH);
  miniaturas y preview siguen mostrando la imagen.

### Operaciones
- **Vista de OT a ancho completo y responsive** (dos columnas en escritorio; móvil intacto).

### Navegación
- **Menú lateral reordenado** al flujo real de creación (Dashboard · Agregar inventario ·
  Campañas al inicio; Integraciones · Actividad · Administración al final).

### Interno (sin impacto de uso)
- Ajustes técnicos para que el **build de producción** compile correctamente.

---

*SPACES OS · manual de usuario v3 · demo con datos ficticios. Para el detalle de procesos y
funciones específicas, consulta también los manuales previos (`MANUAL_COMPLETO.md`).*
