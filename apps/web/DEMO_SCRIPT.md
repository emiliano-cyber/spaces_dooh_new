# DEMO_SCRIPT — Spaces (Billboards Perú SA)

Guion de clics para la junta. La demo es **100% mock** (sin backend) y vive bajo
`/demo`. Un refresh reinicia todo; también hay botón **"Reiniciar demo"** en la
barra superior.

> **Rutas.** La app corre con `basePath = /spaces-dooh`. Las URLs reales son
> `…/spaces-dooh/demo/…`. Abajo se escriben en forma corta (`/demo/…`); el
> navegador y los links internos agregan el prefijo solos.
>
> - Local: `http://localhost:3000/spaces-dooh/demo/`
> - Deploy: `https://<host>/spaces-dooh/demo/`

## Antes de empezar
1. Abre `/demo/` — te llevará a **`/demo/login`** (login mock).
2. Entra como **Dueña (María Quispe)** con el acceso rápido (cualquier
   contraseña funciona). Aterrizas en el Dashboard.
3. Ten a la mano el teléfono con `/demo/m/ot/ot-telco/` (Acto 4) o el QR.
4. Menú de **usuario** (arriba a la derecha): *Cambiar de usuario* y *Cerrar
   sesión* — se usan para mostrar el RBAC por rol (Acto 6).

> **Login mock (sin backend).** Cada usuario demo entra y aterriza en la vista
> de su rol; lo que el rol no debe ver, no se renderiza. Usuarios: Dueña,
> Comercial, Operaciones, Imprenta, Finanzas y Cliente externo (Telco Andina,
> que entra directo a su portal). "Reiniciar demo" también cierra sesión.

---

## ACTO 1 — "Tu negocio de un vistazo"  ·  `/demo/`
- Señala los **KPIs**: ingreso del mes, **margen** (verde = sano), por cobrar,
  **% de ocupación**.
- Cambia el toggle de ocupación **Día / Semana / Mes** (la gráfica reacciona).
- Muestra **Reservas vs confirmaciones** (tentativo ámbar vs confirmado azul).
- Señala **Alertas** (renta vencida, contrato por vencer, factura vencida,
  sitio bloqueado) y el **mini-mapa** de la red.

## ACTO 2 — "Tu red en el mapa"  ·  `/demo/comercial/`
- 14 sitios de Lima, pines por estatus. Leyenda abajo del mapa.
- Hay **un sitio en ROJO** (Av. Salaverry) — clic en su fila → la **ficha**
  explica la incidencia (renta vencida + suspensión) reportada desde
  Arrendadores. **Ese es el acople.**
- Prueba los **filtros** (tipo, distrito, disponibilidad, precio) y el buscador.

## ACTO 3 — "Vender una campaña" (mutación en vivo)  ·  `/demo/comercial/`
1. En la lista, **marca 3 sitios disponibles** (checkbox; sólo los verdes).
2. Barra inferior → **Reservar** → escribe un cliente nuevo (p. ej. "Seguros
   Andinos") y fechas → **Reservar (tentativo)**.
   → Los pines pasan a **ámbar**; aparece arriba en **Reservas tentativas**.
3. En "Reservas tentativas" → **Confirmar**.
   → Los pines pasan a **ocupado (azul)**.
4. Vuelve a `/demo/` → la **ocupación del dashboard subió sola**.
   *(Opcional: "Extender" cambia las fechas de la campaña.)*

## ACTO 4 — "La campaña viaja sola"  ·  Telco Andina
1. `/demo/campanas/` → abre **Telco Andina — Lanzamiento 5G** (tiene la etiqueta
   *hilo conductor*). Está en **"En imprenta"**; el **candado** está cerrado
   (faltan fotos + reporte).
2. Muestra **Imprenta** (`/demo/imprenta/`): la orden de Telco en *En
   producción*, ligada a la campaña.
3. **En el teléfono** abre la **OT móvil**: `/demo/m/ot/ot-telco/`
   - Marca el **checklist**, **toma una foto**, **captura ubicación**.
   - **Cerrar OT.**
4. Vuelve a la campaña (`/demo/campanas/camp-telco/`):
   → el **pipeline avanzó** y el **candado se encendió** (Lista para facturar);
   la **evidencia** ya está en la galería.

## ACTO 5 — "El dinero"  ·  `/demo/finanzas/`
- Telco Andina aparece en **"Listas para facturar"** → **Generar factura** →
  elige plazo **60 / 90 / 120** → **Emitir**.
- En **Cobranza**, el semáforo muestra los **3 colores** (al corriente, por
  vencer, vencida) con días a vencer.
- *(El otro lado:)* `/demo/arrendadores/` → contratos, **pagos de renta**
  (registrar pago), **vencimientos** y **renovación**. Aquí también puedes
  **reportar una incidencia** en un sitio y verlo ponerse **rojo** en Comercial.

## ACTO 6 — "Tu cliente lo ve solo"  ·  Portal público
- Abre el portal sin login: `/demo/portal/telco-andina-2026/`
- Es el **mismo pipeline** de Telco + fechas + **evidencias**, pero **sin un
  solo dato financiero** (ni costo, margen, rebate ni comisión).
- *(RBAC sin auth:)* menú de usuario → **Cambiar de usuario** → inicia sesión
  como **Telco Andina (cliente externo)**: entra directo a su portal y no ve
  ningún módulo interno. Inicia sesión como **Comercial** y verás que su sidebar
  no incluye Arrendadores ni Finanzas.

---

## Reinicio entre ensayos
- **Reiniciar demo** (barra superior) o un **refresh** dejan todo como al inicio
  (Telco en "En imprenta", candado apagado, pines originales).
