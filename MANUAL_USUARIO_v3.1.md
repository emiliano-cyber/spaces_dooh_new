# SPACES OS — Manual de usuario (v3.1, con capturas)

> **Plataforma de gestión DOOH/OOH.** Este manual recorre el sistema **siguiendo el
> flujo real de creación de una campaña**, con apartados dedicados al **Cliente** y a la
> **Agencia**, y cierra con el **detalle de todos los cambios recientes**. Incluye **capturas
> de la interfaz actual**.
>
> Demo · datos ficticios. Acceso de demostración: **jose@pixeled.com.mx / spaces123** (rol Dueño).

---

## Contenido

1. Acceso y roles
2. El menú (orden por flujo de creación)
3. Flujo de creación de una campaña (paso a paso)
4. Apartado **Cliente**
5. Apartado **Agencia**
6. Administración, Actividad e Integraciones
7. **Cambios recientes** (todo lo nuevo)

---

## 1. Acceso y roles

Se entra con correo y contraseña. Cada **rol** ve solo los módulos que le corresponden.

![Login](manual-shots/v3/01-login.png)

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
**Dashboard → Agregar inventario → Campañas** (fijos arriba), luego la base de inventario
(**Arrendadores, Network**), el ciclo comercial (**Clientes, Comercial, Propuestas**), la
producción (**Creativos, Imprenta**), y la operación y cobranza (**Operaciones, Finanzas,
Comisiones**). Al final: **Integraciones, Actividad, Administración**.

![Dashboard y menú reordenado](manual-shots/v3/02-dashboard.png)

---

## 3. Flujo de creación de una campaña

### 3.1 Dashboard

Punto de entrada: métricas del negocio, campañas en curso y pendientes por atender
(validaciones, OT abiertas, facturación).

### 3.2 Agregar inventario (pantallas y **slots**)

Registras tus **pantallas/sitios** por alta manual (formulario por pestañas) o por
**importación Excel/CSV** con la plantilla (hojas **Instrucciones / Sitios / Listas**).

![Agregar inventario](manual-shots/v3/03-agregar-inventario.png)

**Modelo de slots (digital).** Cada pantalla digital se comercializa por **slots** (antes
“spots”): por default **12 slots por pantalla** y **20 segundos por slot**. Los campos
numéricos muestran el ejemplo como **leyenda gris** (placeholder), sin valores pre-cargados
que haya que borrar.

> Una campaña usará **una parte** de esos 12 slots; varias campañas pueden **compartir** la
> misma pantalla mientras le queden slots libres.

### 3.3 Base de inventario: Arrendadores y Network

- **Arrendadores** — propietarios de los predios/pantallas, sus **contratos**, renta,
  periodicidad de pago y vigencia.
- **Network** — publica/comparte inventario a la red.

![Arrendadores](manual-shots/v3/17-arrendadores.png)

![Network](manual-shots/v3/18-network.png)

### 3.4 Clientes

Das de alta a los **anunciantes**, tipo **Directo** o **Agencia** (ver apartado Agencia).
Aquí capturas los **datos fiscales** (RFC, razón social, uso de CFDI) para poder facturar.

![Clientes](manual-shots/v3/05-clientes.png)

### 3.5 Comercial (reservar en el mapa)

El módulo **Comercial** es el mapa de tu red. Los **datos de cada pantalla** en la lista se
muestran **más grandes** (nombre, código, distrito, tarifa, **slots libres** y propietario).

![Comercial — mapa e inventario con slots](manual-shots/v3/04-comercial.png)

**Regla de ocupación por slots:** una pantalla digital es **seleccionable mientras le queden
slots libres**; cuando llega a **0 slots (ocupada)**, **ya no se puede seleccionar** para otra
campaña. Con las pantallas seleccionadas defines cliente, fechas, tipo y **cuántos slots**
usa la campaña (con su duración de 20s). Se crea una **reserva tentativa**.

En la **ficha de un sitio** ves todos sus datos y, con **Editar**, puedes ajustar la
**Cantidad de slots** y la **Duración por slot**:

![Ficha del sitio](manual-shots/v3/20-ficha-sitio.png)

![Editar — cantidad de slots](manual-shots/v3/21-editar-slots.png)

### 3.6 Propuestas

Generas una **Propuesta** (cotización) con ítems, comisión, fechas y totales (bruto,
comisión, neto, IVA, total). Se puede compartir su **liga pública** (solo lectura), ahora a
**ancho completo y responsive**, con resumen económico, sitios y **mapa**.

![Propuestas](manual-shots/v3/06-propuestas.png)

![Liga pública de propuesta (ancho completo)](manual-shots/v3/07-propuesta-publica.png)

### 3.7 Campañas (pipeline)

Cada campaña recorre su **pipeline** (OOH/DOOH/Híbrida). Al entrar al detalle aparece un
**menú lateral con todas las campañas** (la actual resaltada) para **saltar entre ellas**
sin volver al listado. Ves pipeline, validación, candado de facturación, presupuesto,
rentabilidad, cumplimiento, sitios, OT, creatividades y evidencias.

![Campañas](manual-shots/v3/08-campanas.png)

![Detalle de campaña — pipeline + menú lateral de campañas](manual-shots/v3/09-campana-pipeline.png)

### 3.8 Creativos

Subes y apruebas el **arte** y asignas cuál va en cada **slot** reservado. **Toda imagen que
subes se convierte a HTML** (creativo `text/html` para el player DOOH); las miniaturas y el
preview siguen mostrando la imagen. También puedes pegar **código HTML**.

![Creativos](manual-shots/v3/10-creativos.png)

### 3.9 Imprenta

Para piezas **estáticas (OOH)**, genera las **órdenes de impresión** y su seguimiento.

![Imprenta](manual-shots/v3/11-imprenta.png)

### 3.10 Operaciones (OT)

Las **órdenes de trabajo** cubren montaje y **evidencia comprobatoria** (checklist, foto,
sello de ubicación). Al **cerrar la OT con foto** se encienden dos candados de la campaña
(**fotos comprobatorias** y **reporte de publicación**). La pantalla de la OT ahora ocupa
**todo el ancho y es responsive**: en escritorio se divide en dos columnas (Checklist | Foto
+ Ubicación + Cerrar).

![Operaciones](manual-shots/v3/12-operaciones.png)

![OT — ancho completo, dos columnas](manual-shots/v3/13-ot.png)

### 3.11 Finanzas

Con el **candado de facturación** completo (**OC recibida + Fotos comprobatorias + Reporte de
publicación**) y el cliente con datos fiscales, la campaña queda **Lista para facturar**. Al
facturar se emite la **factura** (subtotal + IVA) y se crea la **cobranza** con su plazo.

![Finanzas](manual-shots/v3/14-finanzas.png)

### 3.12 Comisiones

Ajuste de la **comisión por agencia** y su negociación, y asignación de la agencia a cada
cliente directo.

![Comisiones](manual-shots/v3/15-comisiones.png)

---

## 4. Apartado — Cliente

El **cliente/anunciante** tiene visibilidad sin entrar a la operación interna:

- **Liga pública de la propuesta** (`/p/…`): solo lectura, con resumen económico, sitios y
  **mapa**; ahora a **ancho completo y responsive** (ver captura 3.6).
- **Portal de la campaña** (por token): muestra **avance**, **ubicaciones** y **evidencias de
  instalación** (fotos comprobatorias). Se activa desde el detalle de la campaña.
- **Portal de cliente** autenticado: consulta **sus sitios** y **órdenes de trabajo**, sin
  ver datos internos (costos, márgenes).

> El cliente **nunca** ve costos de compra, márgenes ni datos de otros clientes.

---

## 5. Apartado — Agencia

Una **agencia** es un cliente intermediario que cobra **comisión** sobre la venta.

- **Alta como Agencia** (en Clientes): tipo *Agencia*, con **% de comisión** y opcionalmente
  una **negociación** especial (con nota y validación).
- **Cliente directo con agencia:** se le puede **asignar una agencia**, que determina la
  **comisión aplicada**.
- **Módulo Comisiones:** ajusta la comisión de cada agencia y su negociación, y asigna la
  agencia a los clientes. La comisión impacta el desglose de la propuesta y la campaña
  (**bruto → comisión de agencia → neto → IVA → total**).

![Comisiones (agencias)](manual-shots/v3/15-comisiones.png)

---

## 6. Administración, Actividad e Integraciones

- **Administración** — configuración del negocio: logo, moneda, IVA(s), plazos de cobranza,
  tipos de tarea y **reproducción digital** (tamaño del loop y **duración por slot** →
  *slots por loop*). Con **loop 240s / slot 20s** salen **12 slots por loop**.

![Administración](manual-shots/v3/16-administracion.png)

- **Actividad** — bitácora **inmutable**: quién hizo qué y cuándo, con filtros. No se edita
  ni se borra.

![Actividad](manual-shots/v3/19-actividad.png)

- **Integraciones** — conectores externos (AdMobilize/Computer Vision, CMS/players, CFDI). En
  el demo operan en **modo simulado** y así lo indican; se activan al configurar sus llaves.

---

## 7. Cambios recientes (todo lo nuevo)

### Modelo de **slots** (reemplaza “spots”)
- Terminología **spot → slots** en toda la interfaz.
- **12 slots por pantalla** digital por default y **20 segundos por slot**.
- La **campaña define cuántos slots** usa (con duración visible).
- **Editar la cantidad de slots** desde la ficha del sitio (recalcula disponibles sin perder
  lo ya reservado).
- **Pantalla ocupada = sin slots:** una digital pasa a **Ocupado** solo al llegar a 0 slots;
  mientras le queden, sigue disponible. **No se puede seleccionar ni reservar** sin slots.

### Comercial / Inventario
- **Datos de cada pantalla más grandes** en la lista de Comercial.
- **Placeholders** (leyenda gris) en toda la carga manual, sin valores pre-cargados.
- **Plantilla de inventario** con hojas **Instrucciones / Sitios (con ejemplos) / Listas**.

### Campañas / Propuestas
- **Menú lateral de campañas** dentro del pipeline.
- **Liga pública de propuesta** a **ancho completo y responsive**.

### Creativos
- **Imágenes subidas se convierten a HTML** (creativo `text/html`); miniaturas y preview
  siguen mostrando la imagen.

### Operaciones
- **Vista de OT a ancho completo y responsive** (dos columnas en escritorio).

### Navegación
- **Menú lateral reordenado** al flujo real de creación.

### Interno (sin impacto de uso)
- Ajustes técnicos: el **build de producción** compila correctamente y **Tailwind** genera
  las utilidades de la vista de OT (2 columnas).

---

*SPACES OS · manual de usuario v3.1 · demo con datos ficticios.*
