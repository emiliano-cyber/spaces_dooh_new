# Plan de capturas — manual de usuario de septiembre

- **Manual origen:** `vault/08-Manuales/manual-usuario-2026-09-18.md` (apartados 1-10,
  `actualizado: 2026-09-24`). Es el único manual de usuario vigente: el de agosto se
  retiró el 24/09, y con él el plan que ocupaba este archivo (queda en la historia de git).
- **Guion:** `manuales/capturas-2026-09-18.spec.ts` · config
  `manuales/playwright.2026-09-18.config.ts`.
- **Salida:** `vault/08-Manuales/capturas-2026-09-18/NN-MM-PP-descripcion.png`, donde `NN`
  es el apartado del manual, `MM` el subapartado (`00` si no tiene) y `PP` el paso. El orden
  alfabético es el orden del manual. **Sustituye la numeración del 21/09**, que se quedó
  corrida al entrar los apartados 1, 6 y 7 (ver `## PENDIENTES` del manual).
- **Entorno:** `next build && next start` local, base propia `spaces_manual_0924` en el
  Postgres del 5433, sembrada con `scripts/semilla-demo.mjs --org=demo-rentabilidad`, más una
  organización vacía `demo-bienvenida` para el cuestionario. Datos sintéticos (correos
  `.invalid`, RFC `DMO…`). Nunca contra un servidor.
- **Viewport:** 1440x900 fijo. Las vistas largas se toman a página completa con ese mismo
  ancho; los detalles, recortados al elemento.
- **Fecha del plan:** 2026-09-24.

Efecto: **L** solo lectura · **W** escribe en la base propia (y solo en ella) · **P** pendiente.

| Captura | Manual | Qué se ve | Cómo se llega | Efecto |
|---|---|---|---|---|
| — | 1.1, pasos 1-5 | Pantalla de primera entrada con Google | Exige una sesión abierta con Google | **P** |
| 01-02-01-codigos-generar-nuevos | 1.2 · 1 | «Códigos de recuperación» con «Generar códigos nuevos» | Dueño con un primer lote ya generado, `/codigos-recuperacion/` | W |
| 01-02-02-codigos-pide-contrasena | 1.2 · 2 | La contraseña pedida y «Confirmar y generar» | Pulsar «Generar códigos nuevos» | L |
| 01-02-04-codigos-lista-nueva | 1.2 · 4 | La lista nueva con «Copiar» y la casilla (códigos difuminados) | Teclear la contraseña y confirmar | W |
| 01-03-00-acceso-cuenta-google | 1.3 | El aviso «Esta cuenta entra con Google…» en el acceso | Entrar con contraseña con una cuenta `solo_google` | L |
| 02-01-03-bienvenida-cinco-campos | 2.1 · 1-3 | El cuestionario, varias razones, operación y ventas separadas, cinco campos llenos | Dueño de `demo-bienvenida`, `/bienvenida/` | L |
| 02-02-01-bienvenida-lo-hago-mas-tarde | 2.2 · 1 | Los dos botones al pie del cuestionario | Misma vista, recorte | L |
| 02-01-04-bienvenida-resultado | 2.1 · Salió bien | «Razones sociales» con lo recién creado | «Guardar y continuar» | W |
| 03-00-01-razones-sociales-sano | 3 | El listado sin avisos | Menú «Razones sociales» | L |
| 03-01-03-razones-sociales-tras-baja | 3.1 · 3 | Una razón social dada de baja, con «Reactivar» | «Dar de baja» | W |
| 03-02-01-razones-sociales-avisos | 3.2 | Los dos avisos | Baja + un papel compartido; se restaura al final | W |
| 04-01-02-contrato-la-paga | 4.1 · 2 | La ficha del contrato con «La paga: Sin asignar» y «Cambiar» | «Arrendadores» → contrato de Mural DEMO Viaducto | L |
| 04-01-04-contrato-elegir-razon-social | 4.1 · 3-4 | El cuadro «Con cuál de tus razones sociales se paga» con una elegida | «Cambiar» | L |
| 04-01-05-contrato-pide-contrasena | 4.1 · 5 | El cuadro solo avisa de la contraseña, sin campo | «Guardar» con los cambios bloqueados | L |
| 04-01-05-contrato-desbloquear-cambios | 4.1 · 7 | «Desbloquear cambios» con la contraseña | «Cambios bloqueados», barra superior | W |
| 04-01-06-contrato-la-paga-asignada | 4.1 · Salió bien | «La paga» con el nombre elegido | Teclear la contraseña | W |
| 04-02-01-finanzas-listas-para-facturar | 4.2 · 1 | «Listas para facturar» con dos campañas | «Finanzas» (el botón NO está en la campaña) | L |
| 04-02-03-generar-factura-emisora | 4.2 · 2-3 | «Generar factura» con la emisora propuesta | «Generar factura» | L |
| 04-02-05-comprobante-emite | 4.2 · Salió bien | El comprobante nuevo con «Emite:» | «Emitir factura» | W |
| 05-00-01-contrato-sin-asignar | 5 | «La paga: Sin asignar», recortado | Misma ficha del 4.1 antes de asignar | L |
| 06-01-01-actualizaciones-tarjeta | 6.1 | La tarjeta «Actualizaciones» con su frase y los cuatro datos | «Administración» → «Configuración» | L |
| 06-01-02-actualizaciones-version-esperando | 6.1 | Versión nueva esperando aprobación, con «Instalar» | `--version-disponible` (preparado a mano en local) | W |
| 06-02-01-actualizaciones-modo-con-aprobacion | 6.2 · 1 | «Con aprobación» marcado, con «Instalar» | «Con aprobación» | W |
| 06-02-02-actualizaciones-modo-automatica | 6.2 · 2 | «Automática» marcado, sin «Instalar» | «Automática» | W |
| 06-03-02-actualizaciones-confirmar-instalar | 6.3 · 1-2 | El cuadro de confirmación | «Instalar v0.8.0» | L |
| 06-03-03-actualizaciones-aprobada | 6.3 · Salió bien | «Aprobaste v0.8.0…» | «Instalar» en la confirmación (solo guarda la aprobación) | W |
| 07-01-04-soporte-formulario | 7.1 · 1-4 | El formulario de ticket lleno | Tarjeta «Soporte» → «Nuevo ticket» | L |
| 07-01-05-soporte-ticket-abierto | 7.1 · 5 | El aviso «Ticket abierto» y el ticket «Abierto», esperando respuesta | «Abrir ticket» | W |
| 07-02-00-soporte-respuesta | 7.2 | El recuadro «Respuesta de AS OOH» | La respuesta entra por el `PATCH /api/tickets` del panel, en local | W |
| 08-01-01-consumo-luz-rejilla | 8.1 / 8.4 | La rejilla con celdas en ámbar y el aviso de faltantes | Operaciones → «Consumo de luz» | L |
| 08-01-05-consumo-luz-formulario | 8.1 · 1-5 | El formulario lleno | Misma pantalla | L |
| 08-01-06-consumo-luz-guardado | 8.1 · Salió bien | La celda capturada y el contador en uno menos | «Guardar recibo» | W |
| 08-02-00-consumo-luz-dos-medidores | 8.2 | Una celda con dos recibos, uno por medidor | Otro recibo del mismo mes con otro medidor | W |
| 08-03-02-consumo-luz-confirmar-borrado | 8.3 · 2 | El cuadro «Borrar este recibo» | Dueño → papelera | L |
| 08-03-03-consumo-luz-tras-borrar | 8.3 · 2 | La rejilla tras borrar | «Borrar el recibo» | W |
| 08-03-03-operaciones-borrar-403 | 8.3 | Operaciones: «No tienes permiso para esta acción» sobre la rejilla | Operaciones → papelera → confirmar | L |
| 09-00-01-operaciones-intenta-reportes | 9 | Operaciones termina en su tablero | Operaciones → `/reportes/` | L |
| 09-01-01-reportes-periodo-en-curso | 9.1 / 9.2 | El reporte recién abierto, con el aviso ámbar | Dueño → «Reportes» | L |
| 09-02-01-reportes-trimestre-cerrado | 9.2 | T2 2026: el aviso ámbar ya no está | «Desde»/«Hasta» | L |
| 09-03-02-reportes-por-trimestre | 9.3 · Por trimestre | Cuatro trimestres en orden | «Agrupar» | L |
| 09-03-03-reportes-por-operacion | 9.3 · Por operación | Visitas, horas y desglose por tipo | «Agrupar» | L |
| 09-03-04-reportes-por-metro-cuadrado | 9.3 · Por metro cuadrado | Superficie y cifras por metro | «Agrupar» | L |
| 09-03-05-reportes-por-consumo-de-luz | 9.3 · Por consumo de luz | kWh y costo por kWh | «Agrupar» | L |
| 09-04-01-reportes-avisos | 9.4 / 9.5 | Los avisos grises y la convención del metro cuadrado | Mirada por metro cuadrado, recorte | L |
| 09-06-01-reportes-desglose | 9.6 | Una fila desplegada por periodo | «Ver el desglose por periodo» | L |
| 10-01-01-consumo-luz-registro-ya-existe | 10.1 | «El registro ya existe» al repetir un recibo | Mismo predio, mes y medidor | L |

Lo que no se fotografía y no es un pendiente: los pasos que no cambian nada en pantalla
(«Guárdalos donde no se pierdan», 1.1 · 3), el 7.3 (dice lo que el ticket NO hace) y el
10.2 y el 10.3 (el menú de Operaciones ya sale en 09-00-01).
