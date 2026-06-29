# SPACES OS — Manual de usuario completo

> Recorrido de **todas las funciones** del sistema, en el orden del flujo real de
> una operadora DOOH/OOH: configuración → agencias/clientes → inventario →
> **propuesta** → campaña → **creativos** → **imprenta** → operaciones →
> **validación de publicación** → **facturación**, más arrendadores, dashboard y bitácora.
> Capturas reales del demo · datos ficticios · moneda MXN · IVA por cliente.

---

## 0. Configuración del negocio (Administración → Configuración)

La app es multi-cliente. Cada empresa define aquí su identidad y parámetros, que se usan en toda la app: **logo**, **nombre de empresa**, **IVA(s)** con los que trabaja, y la **reproducción digital** (tamaño de **loop** y duración de **spot** → spots por loop). También plazos de cobranza y tipos de tarea.

![Configuración del negocio](manual-shots/full/20-ajustes.png)

---

## 1. Agencias y comisiones (Comisiones)

La **comisión es por agencia**. En **Comisiones** creas una **agencia** (cliente tipo Agencia), defines su **comisión (%)** y, si aplica, su **negociación** (que debe **validarse** para poder usarla en propuestas). Abajo se asigna la agencia a cada cliente, que hereda esa comisión.

![Comisiones — agencias y su comisión](manual-shots/full/01-comisiones.png)

---

## 2. Clientes (Clientes)

Catálogo de clientes con sus **datos fiscales** (RFC, razón social, régimen, CP, uso CFDI) e **IVA** (del catálogo de Ajustes). Estos datos se usan para facturar.

![Clientes](manual-shots/full/02-clientes.png)

---

## 3. Inventario (Agregar inventario)

Tabla del inventario con todas las pantallas: tipo, ubicación, **medio (fija/digital)**, tarifa, estatus, **propietario**, renta y periodicidad. Se cargan por **alta manual** (con **Exhibición** fija/digital) o por **carga masiva** (Excel/CSV con plantilla). La fila es clicable para abrir su ficha.

![Inventario](manual-shots/full/03-inventario.png)

---

## 4. Propuestas (Propuestas)

Cotización por el **método del divisor** (precio de lista bruto → neto según comisión de la agencia), con **aprobación sitio por sitio**.

1. **Nueva propuesta**: elige cliente y agencia (la comisión se precarga), fechas y sitios.
2. Marca los **sitios aprobados**, luego **Aprobar** la propuesta (queda inmutable).

![Lista de propuestas](manual-shots/full/04-propuestas.png)

En el **detalle** se ve el desglose (bruto → comisión → neto → IVA → total), los sitios con su renta, y los botones **Copiar liga** / **Copiar código** (para que el cliente la vea sin login) y **Generar campaña**.

![Detalle de propuesta](manual-shots/full/05-propuesta-detalle.png)

---

## 5. Campaña y pipeline (Campañas)

Al **Generar campaña** desde la propuesta aprobada, se crea la campaña (con sus reservas, solo los sitios aprobados). Como esta propuesta tenía una pantalla fija y una digital, la campaña es **híbrida** (con imprenta y creativos).

El **detalle** muestra el **pipeline** (todas las etapas y cómo van), la validación de publicación, el **candado de facturación**, lo **comercial** (subtotal + IVA del cliente + total + agencia) y la **rentabilidad** (margen).

![Detalle de campaña con pipeline](manual-shots/full/06-campana-detalle.png)

---

## 6. Creativos — subir y aprobar (Creativos)

Para las pantallas digitales, se suben los **creativos** (imagen o código) y se **aprueban** antes de exhibirse.

1. Sube el creativo (**Imagen** o **Código**). Queda **Pendiente**.
2. Revisa y pulsa **Aprobar** (o **Rechazar** con motivo).

![Creativo pendiente — Aprobar / Rechazar](manual-shots/full/07-creativos-pendiente.png)

3. Una vez **Validado**, se **asigna** a los spots reservados (cuántas veces va cada uno).

![Creativo aprobado — asignar a spots](manual-shots/full/08-creativos-aprobado.png)

---

## 7. Imprenta — orden y prueba de color (Imprenta)

Para las pantallas fijas, se genera la **orden de impresión** de la lona.

1. **Nueva orden**: elige la campaña/sitio, material y medidas.
2. Revisa la **prueba de color** y pulsa **Aprobar prueba de color**.

![Orden de impresión — prueba de color pendiente](manual-shots/full/09-imprenta-pendiente.png)

3. Con la prueba aprobada, la orden avanza a producción / listo para montaje.

![Orden de impresión — prueba aprobada](manual-shots/full/10-imprenta-aprobada.png)

---

## 8. Operaciones — órdenes de trabajo (Operaciones)

Se generan **órdenes de trabajo (OT)** de cuadrilla (montaje/mantenimiento). Al elegir la campaña, el sitio se autoselecciona. En campo, la OT se cierra con **checklist + foto comprobatoria + ubicación**, lo que alimenta el pipeline y el candado de facturación.

![Operaciones — órdenes de trabajo](manual-shots/full/11-operaciones.png)

---

## 9. Validación de publicación (detalle de campaña)

Antes de salir al aire, la campaña se **envía al dominio/CMS** y un revisor **verifica los anuncios** y **aprueba** la publicación.

1. **Enviar al dominio** → la validación queda *Pendiente* y se revisan los anuncios cargados.
2. **Aprobar publicación** → la campaña pasa a **Activa** (al aire). (O **Rechazar** con motivo.)

![Validación de publicación — pendiente](manual-shots/full/12-validacion-pendiente.png)

![Validación de publicación — aprobada](manual-shots/full/13-validacion-aprobada.png)

---

## 10. Facturación — su pago (Finanzas)

Cuando la campaña completa su **candado** (OC + fotos comprobatorias + reporte), aparece en **Finanzas → Listas para facturar**.

![Listas para facturar](manual-shots/full/14-finanzas-listas.png)

Pulsa **Generar factura**, revisa el desglose (**Subtotal + IVA del cliente = Total**), elige el **plazo de cobranza** y **Emitir factura**.

![Generar factura](manual-shots/full/15-factura-modal.png)

La factura se emite (con **folio fiscal** simulado y RFC) y pasa a **Cobranza** con su semáforo.

![Cobranza](manual-shots/full/16-cobranza.png)

---

## 11. Arrendadores — propietarios y rentas (Arrendadores)

El otro lado de la red: **propietarios** de los predios, **contratos** (renta, periodicidad, vencimiento) y **pagos de renta** con su semáforo.

![Arrendadores — contratos y pagos](manual-shots/full/19-arrendadores.png)

---

## 12. Dashboard (Dashboard)

Vista de negocio de un vistazo: **KPIs** (ingreso, margen, por cobrar, ocupación), desglose de **costos**, ocupación, **alertas**, mapa de la red y campañas por finalizar.

![Dashboard](manual-shots/full/17-dashboard.png)

---

## 13. Actividad — bitácora (Actividad)

Registro de **quién hizo qué y cuándo**, filtrable por **fecha, hora y usuario**. Aquí queda la traza completa de todo el proceso anterior.

![Actividad — bitácora](manual-shots/full/18-actividad.png)

---

*Demo · datos ficticios. Recorrido probado de extremo a extremo: configuración → agencia/cliente → inventario → propuesta → campaña híbrida → creativos → imprenta → operaciones → validación → facturación. El folio fiscal es simulado; el IVA aplicado es el configurado por cliente.*
