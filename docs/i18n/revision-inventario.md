# Tabla de revisión · lote de inglés «inventario y arrendadores» · Inventario

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/inventario.ts` y de los usos en
el código (búsqueda literal de la clave). Regenerada en la segunda vuelta (hallazgos del validador, decisiones del dueño y del orquestador). **360 claves** (`inventario.*`).

- **español** es la copia literal de lo que decía el componente antes del lote,
  comprobado comparando el HTML rendido de **81 estados de pantalla** con los
  componentes de `integra/ingles` (ec427a66) y con los del lote: idénticos byte
  a byte (`diff -rq`; ver `lib/i18n/pantallas-inventario-arrendadores.test.ts`,
  que con `I18N_VOLCAR=<carpeta>` vuelca el HTML español de cada estado).
- `␣` marca un espacio al principio o al final: es intencional, el texto va
  pegado a otro nodo.
- Los huecos `{nombre}` se rellenan con datos, importes ya formateados
  (`formatMonto(…, idioma)`, que en inglés de una instancia MXN escribe `MX$`)
  o elementos (`interpolarNodos`). Ningún importe ni símbolo de moneda vive en
  el diccionario: los ejemplos «15,000.50» y «8,000.50» entran por hueco.
- Las fechas pasan por `formatFecha(…, idioma)` («Dec 1, 2026»); las horas de
  los sellos de firma en pantalla, por `toLocaleString` con `es-MX` / `en-US`.
- «por clave calculada» = la clave se elige con un ternario de singular/plural o
  sale de un mapa (`CLAVE_*`), y la búsqueda literal no la encuentra en una sola
  línea; la prueba de pantallas o la de «qué clave usa cada aviso» la cubre.
- Las claves de otros lotes que se reutilizan (`comun.*`, `comercial.comun.*`,
  `comercial.contrato-estatus.*`, `comercial.pago-estatus.*`,
  `comercial.sitio-estatus.*`, `comercial.tipo-medio.*`,
  `compartidos.candado.*`, `compartidos.periodicidad.*` vía
  `periodicidadLabel`, `finanzas.pago.*`, `finanzas.comun.dias`,
  `propuestas.documento.imprimir`, `campanas.comun.total`) no salen aquí.

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `inventario.titulo` | `app/(app)/(shell)/inventario/page.tsx:69`<br>`app/(app)/(shell)/inventario/page.tsx:101`<br>`app/(app)/(shell)/inventario/page.tsx:141` | título · texto en pantalla | Inventario | Inventory |
| `inventario.sin-permiso` | `app/(app)/(shell)/inventario/page.tsx:71` | texto en pantalla | Esta sección es exclusiva del Dueño y del administrador. | This section is only for the Owner and the administrator. |
| `inventario.sub.lista` | `app/(app)/(shell)/inventario/page.tsx:104` | texto en pantalla | Consulta el inventario completo, o agrega pantallas por carga masiva o alta manual. | Browse the full inventory, or add screens by bulk upload or manual entry. |
| `inventario.sub.contrato` | `app/(app)/(shell)/inventario/page.tsx:106` | texto en pantalla | Alta de una pantalla junto con su contrato de arrendamiento. | Add a screen together with its lease agreement. |
| `inventario.sub.masiva` | `app/(app)/(shell)/inventario/page.tsx:108` | texto en pantalla | Carga masiva de pantallas desde la plantilla de Excel. | Bulk upload of screens from the Excel template. |
| `inventario.sub.manual` | `app/(app)/(shell)/inventario/page.tsx:109` | texto en pantalla | Alta manual de una pantalla. | Manual entry of one screen. |
| `inventario.via.contrato` | `app/(app)/(shell)/inventario/page.tsx:122` | botón | Contrato + pantalla | Contract + screen |
| `inventario.via.masiva` | `app/(app)/(shell)/inventario/page.tsx:125`<br>`components/demo/inventario/AgregarInventario.tsx:51` | botón | Carga masiva | Bulk upload |
| `inventario.via.manual` | `app/(app)/(shell)/inventario/page.tsx:128`<br>`components/demo/inventario/AgregarInventario.tsx:48` | botón | Alta manual | Manual entry |
| `inventario.toast.contrato-creado` | `app/(app)/(shell)/inventario/page.tsx:150`<br>`app/(app)/(shell)/arrendadores/page.tsx:530` | aviso emergente | Contrato y pantalla "{nombre}" creados | Contract and screen “{nombre}” created |
| `inventario.toast.pantalla-agregada` | `app/(app)/(shell)/inventario/page.tsx:180`<br>`components/demo/inventario/AgregarInventario.tsx:63` | aviso emergente | Pantalla "{nombre}" agregada al inventario | Screen “{nombre}” added to the inventory |
| `inventario.toast.importado` | `app/(app)/(shell)/inventario/page.tsx:171` | aviso emergente | Inventario importado: {partes} | Inventory imported: {partes} |
| `inventario.toast.nuevas.uno` | `app/(app)/(shell)/inventario/page.tsx:165` | texto en pantalla | {n} nueva | {n} new |
| `inventario.toast.nuevas.otros` | `app/(app)/(shell)/inventario/page.tsx:165` | texto en pantalla | {n} nuevas | {n} new |
| `inventario.toast.actualizadas.uno` | `app/(app)/(shell)/inventario/page.tsx:167` | texto en pantalla | {n} actualizada | {n} updated |
| `inventario.toast.actualizadas.otros` | `app/(app)/(shell)/inventario/page.tsx:167` | texto en pantalla | {n} actualizadas | {n} updated |
| `inventario.toast.con-advertencias` | `app/(app)/(shell)/inventario/page.tsx:169` | texto en pantalla | {n} con advertencias | {n} with warnings |
| `inventario.toast.sin-cambios` | `app/(app)/(shell)/inventario/page.tsx:171` | aviso emergente | sin cambios | no changes |
| `inventario.indicadores` | `components/demo/inventario/ResumenInventario.tsx:91`<br>`app/(app)/(shell)/arrendadores/page.tsx:264` | título | Indicadores | Indicators |
| `inventario.kpi.pantallas` | `components/demo/inventario/ResumenInventario.tsx:96`<br>`components/demo/inventario/InventarioTabla.tsx:408` | rótulo · título | Pantallas | Screens |
| `inventario.kpi.medios` | `components/demo/inventario/ResumenInventario.tsx:98` | subtítulo | {digitales} digitales · {fijas} fijas | {digitales} digital · {fijas} static |
| `inventario.kpi.disponibles` | `components/demo/inventario/ResumenInventario.tsx:105` | rótulo | Disponibles | Available |
| `inventario.kpi.disponibles.sub` | `components/demo/inventario/ResumenInventario.tsx:110` | subtítulo | de {total} | of {total} |
| `inventario.kpi.disponibles.sub-parciales` | `components/demo/inventario/ResumenInventario.tsx:109` | subtítulo | de {total} · {n} con slots vendidos | of {total} · {n} with slots sold |
| `inventario.kpi.sin-contrato` | `components/demo/inventario/ResumenInventario.tsx:116`<br>`components/demo/inventario/ResumenInventario.tsx:215` | rótulo · texto en pantalla | Sin contrato | No contract |
| `inventario.kpi.sin-contrato.sub` | `components/demo/inventario/ResumenInventario.tsx:118` | subtítulo | captúralo en Arrendadores | add it in Landlords |
| `inventario.kpi.sin-contrato.ninguno` | `components/demo/inventario/ResumenInventario.tsx:118` | subtítulo | todas tienen contrato o son propias | all have a contract or are owned |
| `inventario.kpi.propias` | `components/demo/inventario/ResumenInventario.tsx:123` | rótulo | Propias | Owned |
| `inventario.kpi.propias.sub` | `components/demo/inventario/ResumenInventario.tsx:125` | subtítulo | sin renta: su costo es luz y operación | no rent: their only costs are electricity and operations |
| `inventario.disp.verde` | `components/demo/inventario/ResumenInventario.tsx:53` | texto en pantalla | Disponible | Available |
| `inventario.disp.ambar` | `components/demo/inventario/ResumenInventario.tsx:54` | texto en pantalla | Con slots vendidos | With slots sold |
| `inventario.disp.rojo` | `components/demo/inventario/ResumenInventario.tsx:55` | texto en pantalla | Ocupada | Occupied |
| `inventario.disp.neutro` | `components/demo/inventario/ResumenInventario.tsx:56` | texto en pantalla | Fuera de venta o sin dato | Not for sale or no data |
| `inventario.chips.disponibilidad` | `components/demo/inventario/ResumenInventario.tsx:194` | título | Disponibilidad | Availability |
| `inventario.chips.medio` | `components/demo/inventario/ResumenInventario.tsx:202` | título | Medio | Medium |
| `inventario.chips.contrato` | `components/demo/inventario/ResumenInventario.tsx:210` | título | Contrato | Contract |
| `inventario.chips.con-contrato` | `components/demo/inventario/ResumenInventario.tsx:212` | texto en pantalla | Con contrato | With contract |
| `inventario.chips.propia` | `components/demo/inventario/ResumenInventario.tsx:218`<br>`components/demo/inventario/InventarioTabla.tsx:1013` | texto en pantalla | Propia | Owned |
| `inventario.medio.digital` | `components/demo/inventario/ResumenInventario.tsx:204`<br>`components/demo/inventario/etiquetas.ts:26` | texto en pantalla · etiqueta de un valor (mapa de claves) | Digital | Digital |
| `inventario.medio.fija` | `components/demo/inventario/ResumenInventario.tsx:207`<br>`components/demo/inventario/etiquetas.ts:26` | texto en pantalla · etiqueta de un valor (mapa de claves) | Fija | Static |
| `inventario.disponibilidad.sin-slots` | `components/demo/inventario/etiquetas.ts:41` | etiqueta de un valor (mapa de claves) | Sin slots capturados | No slots entered |
| `inventario.disponibilidad.sin-libres` | `components/demo/inventario/etiquetas.ts:42` | etiqueta de un valor (mapa de claves) | Sin slots libres | No free slots |
| `inventario.disponibilidad.libres` | `components/demo/inventario/etiquetas.ts:43` | etiqueta de un valor (mapa de claves) | {libres} de {total} libres | {libres} of {total} free |
| `inventario.disponibilidad.ocupado` | `components/demo/inventario/etiquetas.ts:46` | etiqueta de un valor (mapa de claves) | Ocupado | Occupied |
| `inventario.disponibilidad.disponible` | `components/demo/inventario/etiquetas.ts:46` | etiqueta de un valor (mapa de claves) | Disponible | Available |
| `inventario.lote.base` | `components/demo/inventario/InventarioTabla.tsx:72` | texto en pantalla | Este cambio es sensible: tu organización pide que vuelvas a identificarte. | This change is sensitive: your organization asks you to confirm your identity again. |
| `inventario.lote.uno-uno` | `components/demo/inventario/InventarioTabla.tsx:78` | texto en pantalla | {frase} Confirmar aplica SOLO la que falta; la que ya cambió no se vuelve a tocar. {base} | {frase} Confirming applies ONLY the one left; the one already changed is not touched again. {base} |
| `inventario.lote.uno-otros` | `components/demo/inventario/InventarioTabla.tsx:78` | texto en pantalla | {frase} Confirmar aplica SOLO la que falta; las {ya} que ya cambiaron no se vuelven a tocar. {base} | {frase} Confirming applies ONLY the one left; the {ya} already changed are not touched again. {base} |
| `inventario.lote.otros-uno` | `components/demo/inventario/InventarioTabla.tsx:79` | texto en pantalla | {frase} Confirmar aplica SOLO las {faltan} que faltan; la que ya cambió no se vuelve a tocar. {base} | {frase} Confirming applies ONLY the {faltan} left; the one already changed is not touched again. {base} |
| `inventario.lote.otros-otros` | `components/demo/inventario/InventarioTabla.tsx:79` | texto en pantalla | {frase} Confirmar aplica SOLO las {faltan} que faltan; las {ya} que ya cambiaron no se vuelven a tocar. {base} | {frase} Confirming applies ONLY the {faltan} left; the {ya} already changed are not touched again. {base} |
| `inventario.lote.frase` | `components/demo/inventario/InventarioTabla.tsx:69` | texto en pantalla | Se aplicó en {ya} de {total} {unidad}; {faltan} sin cambiar. | Applied to {ya} of {total} {unidad}; {faltan} unchanged. |
| `inventario.lote.unidad.pantalla` | `components/demo/inventario/InventarioTabla.tsx:67` | texto en pantalla | pantalla | screen |
| `inventario.lote.unidad.pantallas` | `components/demo/inventario/InventarioTabla.tsx:67` | texto en pantalla | pantallas | screens |
| `inventario.lote.unidad.contrato` | `components/demo/inventario/InventarioTabla.tsx:68` | texto en pantalla | contrato | contract |
| `inventario.lote.unidad.contratos` | `components/demo/inventario/InventarioTabla.tsx:68` | texto en pantalla | contratos | contracts |
| `inventario.tabla.no-archivo` | `components/demo/inventario/InventarioTabla.tsx:134` | aviso emergente | No se pudo generar el archivo. Prueba a filtrar para descargar menos pantallas. | Could not generate the file. Try filtering to download fewer screens. |
| `inventario.tabla.cifra-ilegible` | `components/demo/inventario/InventarioTabla.tsx:237` | aviso emergente | La cifra no se entiende: la coma separa miles y el punto, decimales ({ejemplo}) | The figure can’t be read: the comma separates thousands and the period, decimals ({ejemplo}) |
| `inventario.tabla.numero-valido` | `components/demo/inventario/InventarioTabla.tsx:242` | aviso emergente | Escribe un número válido | Enter a valid number |
| `inventario.tabla.renta-negativa` | `components/demo/inventario/InventarioTabla.tsx:246` | aviso emergente | La renta no puede ser negativa | Rent can’t be negative |
| `inventario.tabla.tarifa-negativa` | `components/demo/inventario/InventarioTabla.tsx:246` | aviso emergente | La tarifa no puede ser negativa | The rate can’t be negative |
| `inventario.tabla.fijar-tarifa-en` | `components/demo/inventario/InventarioTabla.tsx:260` | texto en pantalla | fijar la tarifa en {monto} | set the rate to {monto} |
| `inventario.tabla.ajustar-tarifa` | `components/demo/inventario/InventarioTabla.tsx:261` | texto en pantalla | ajustar la tarifa {pct}% | adjust the rate by {pct}% |
| `inventario.tabla.aplicar-pantallas.uno` | `components/demo/inventario/InventarioTabla.tsx:264` | confirmación del navegador | ¿Aplicar «{resumen}» a {n} pantalla? | Apply “{resumen}” to {n} screen? |
| `inventario.tabla.aplicar-pantallas.otros` | `components/demo/inventario/InventarioTabla.tsx:264` | confirmación del navegador | ¿Aplicar «{resumen}» a {n} pantallas? | Apply “{resumen}” to {n} screens? |
| `inventario.tabla.tarifa-actualizada.uno` | `components/demo/inventario/InventarioTabla.tsx:288` | aviso emergente | Tarifa actualizada en {n} pantalla | Rate updated on {n} screen |
| `inventario.tabla.tarifa-actualizada.otros` | `components/demo/inventario/InventarioTabla.tsx:288` | aviso emergente | Tarifa actualizada en {n} pantallas | Rate updated on {n} screens |
| `inventario.tabla.no-masivo` | `components/demo/inventario/InventarioTabla.tsx:299` | aviso emergente | No se pudo aplicar el cambio masivo | Could not apply the bulk change |
| `inventario.tabla.renta-mayor-cero` | `components/demo/inventario/InventarioTabla.tsx:316`<br>`components/demo/inventario/InventarioTabla.tsx:783` | aviso emergente | La renta debe ser mayor que cero | Rent must be greater than zero |
| `inventario.tabla.sin-contrato-masivo` | `components/demo/inventario/InventarioTabla.tsx:329` | aviso emergente | Esas pantallas no tienen contrato todavía: captura la renta en Arrendadores. | Those screens don’t have a contract yet: enter the rent in Landlords. |
| `inventario.tabla.sin-importe-masivo` | `components/demo/inventario/InventarioTabla.tsx:330` | aviso emergente | No hay rentas que ajustar (las seleccionadas no tienen importe capturado). | There are no rents to adjust (the selected ones have no amount entered). |
| `inventario.tabla.fijar-renta-en` | `components/demo/inventario/InventarioTabla.tsx:338` | texto en pantalla | fijar la renta en {monto} | set the rent to {monto} |
| `inventario.tabla.ajustar-renta` | `components/demo/inventario/InventarioTabla.tsx:339` | texto en pantalla | ajustar la renta {pct}% | adjust the rent by {pct}% |
| `inventario.tabla.aplicar-contratos.uno` | `components/demo/inventario/InventarioTabla.tsx:343` | texto en pantalla | ¿Aplicar «{resumen}» a {n} contrato? | Apply “{resumen}” to {n} contract? |
| `inventario.tabla.aplicar-contratos.otros` | `components/demo/inventario/InventarioTabla.tsx:343` | texto en pantalla | ¿Aplicar «{resumen}» a {n} contratos? | Apply “{resumen}” to {n} contracts? |
| `inventario.tabla.alcance-extra.uno` | `components/demo/inventario/InventarioTabla.tsx:346` | texto en pantalla | OJO: son contratos de predio compartidos. El cambio alcanza también a {n} pantalla que NO seleccionaste. | CAREFUL: these are shared property contracts. The change also reaches {n} screen you did NOT select. |
| `inventario.tabla.alcance-extra.otros` | `components/demo/inventario/InventarioTabla.tsx:346` | texto en pantalla | OJO: son contratos de predio compartidos. El cambio alcanza también a {n} pantallas que NO seleccionaste. | CAREFUL: these are shared property contracts. The change also reaches {n} screens you did NOT select. |
| `inventario.tabla.omitir-sin-contrato.uno` | `components/demo/inventario/InventarioTabla.tsx:352` | texto en pantalla | {n} pantalla sin contrato se omitirá. | {n} screen without a contract will be skipped. |
| `inventario.tabla.omitir-sin-contrato.otros` | `components/demo/inventario/InventarioTabla.tsx:352` | texto en pantalla | {n} pantallas sin contrato se omitirán. | {n} screens without a contract will be skipped. |
| `inventario.tabla.omitir-sin-importe.uno` | `components/demo/inventario/InventarioTabla.tsx:360` | texto en pantalla | {n} contrato sin importe capturado se omitirá: no hay sobre qué aplicar el porcentaje. | {n} contract without an amount will be skipped: there is nothing to apply the percentage to. |
| `inventario.tabla.omitir-sin-importe.otros` | `components/demo/inventario/InventarioTabla.tsx:361` | texto en pantalla | {n} contratos sin importe capturado se omitirán: no hay sobre qué aplicar el porcentaje. | {n} contracts without an amount will be skipped: there is nothing to apply the percentage to. |
| `inventario.tabla.renta-actualizada.uno` | `components/demo/inventario/InventarioTabla.tsx:383` | aviso emergente | Renta actualizada en {n} contrato | Rent updated on {n} contract |
| `inventario.tabla.renta-actualizada.otros` | `components/demo/inventario/InventarioTabla.tsx:383` | aviso emergente | Renta actualizada en {n} contratos | Rent updated on {n} contracts |
| `inventario.tabla.no-masivo-renta` | `components/demo/inventario/InventarioTabla.tsx:390` | aviso emergente | No se pudo aplicar el cambio masivo de renta | Could not apply the bulk rent change |
| `inventario.tabla.de` | `components/demo/inventario/InventarioTabla.tsx:411` | texto en pantalla | {n} de {total} | {n} of {total} |
| `inventario.tabla.excel-title` | `components/demo/inventario/InventarioTabla.tsx:421` | título / tooltip | Descargar en Excel, con el mismo formato que la plantilla de carga | Download in Excel, in the same format as the upload template |
| `inventario.tabla.csv-title` | `components/demo/inventario/InventarioTabla.tsx:429` | título / tooltip | Descargar en CSV, con el mismo formato que la plantilla de carga | Download in CSV, in the same format as the upload template |
| `inventario.tabla.buscar` | `components/demo/inventario/InventarioTabla.tsx:443` | texto de ejemplo (placeholder) | Buscar pantalla, código, distrito… | Search screen, code, district… |
| `inventario.tabla.quitar-filtros` | `components/demo/inventario/InventarioTabla.tsx:459` | texto en pantalla | Quitar filtros | Clear filters |
| `inventario.tabla.seleccionadas.uno` | `components/demo/inventario/InventarioTabla.tsx:469` | texto en pantalla | {n} seleccionada | {n} selected |
| `inventario.tabla.seleccionadas.otros` | `components/demo/inventario/InventarioTabla.tsx:469` | texto en pantalla | {n} seleccionadas | {n} selected |
| `inventario.tabla.tarifa` | `components/demo/inventario/InventarioTabla.tsx:482`<br>`components/demo/inventario/InventarioTabla.tsx:570` | texto en pantalla · cabecera de columna | Tarifa | Rate |
| `inventario.tabla.renta` | `components/demo/inventario/InventarioTabla.tsx:489`<br>`components/demo/inventario/InventarioTabla.tsx:575` | texto en pantalla · cabecera de columna | Renta | Rent |
| `inventario.tabla.fijar-renta` | `components/demo/inventario/InventarioTabla.tsx:500` | texto en pantalla | Fijar renta | Set rent |
| `inventario.tabla.fijar-tarifa` | `components/demo/inventario/InventarioTabla.tsx:500` | texto en pantalla | Fijar tarifa | Set rate |
| `inventario.tabla.ajustar` | `components/demo/inventario/InventarioTabla.tsx:507` | texto en pantalla | Ajustar % | Adjust (%) |
| `inventario.tabla.ph-ajuste` | `components/demo/inventario/InventarioTabla.tsx:522` | texto en pantalla | p. ej. 10 o -5 | e.g. 10 or -5 |
| `inventario.tabla.ph-renta` | `components/demo/inventario/InventarioTabla.tsx:523` | texto en pantalla | Nueva renta | New rent |
| `inventario.tabla.ph-tarifa` | `components/demo/inventario/InventarioTabla.tsx:523` | texto en pantalla | Nueva tarifa | New rate |
| `inventario.tabla.aplicando` | `components/demo/inventario/InventarioTabla.tsx:539` | texto en pantalla | Aplicando… | Applying… |
| `inventario.tabla.aplicar` | `components/demo/inventario/InventarioTabla.tsx:539` | texto en pantalla | Aplicar | Apply |
| `inventario.tabla.limpiar` | `components/demo/inventario/InventarioTabla.tsx:546`<br>`components/demo/inventario/ImportarInventarioDialog.tsx:259`<br>`app/(app)/(shell)/arrendadores/page.tsx:253` | texto en pantalla · botón | Limpiar | Clear |
| `inventario.tabla.seleccionar-todo` | `components/demo/inventario/InventarioTabla.tsx:561` | título / tooltip | Seleccionar todo | Select all |
| `inventario.tabla.col.pantalla` | `components/demo/inventario/InventarioTabla.tsx:566` | cabecera de columna | Pantalla | Screen |
| `inventario.tabla.col.tipo` | `components/demo/inventario/InventarioTabla.tsx:567`<br>`components/demo/inventario/ContratoWizard.tsx:666` | cabecera de columna · rótulo | Tipo | Type |
| `inventario.tabla.col.ubicacion` | `components/demo/inventario/InventarioTabla.tsx:568`<br>`components/demo/inventario/ContratoWizard.tsx:674` | cabecera de columna · rótulo | Ubicación | Location |
| `inventario.tabla.col.medio` | `components/demo/inventario/InventarioTabla.tsx:569`<br>`components/demo/inventario/ContratoWizard.tsx:672` | cabecera de columna · rótulo | Medio | Medium |
| `inventario.tabla.col.disponibilidad` | `components/demo/inventario/InventarioTabla.tsx:571` | cabecera de columna | Disponibilidad | Availability |
| `inventario.tabla.col.arrendador` | `components/demo/inventario/InventarioTabla.tsx:572` | cabecera de columna | Arrendador | Landlord |
| `inventario.tabla.vacio.busqueda` | `components/demo/inventario/InventarioTabla.tsx:586` | texto en pantalla | Ningún sitio coincide con «{q}». | No sites match “{q}”. |
| `inventario.tabla.vacio.busqueda-filtros` | `components/demo/inventario/InventarioTabla.tsx:586` | texto en pantalla | Ningún sitio coincide con «{q}» y los filtros elegidos. | No sites match “{q}” and the chosen filters. |
| `inventario.tabla.vacio.filtros` | `components/demo/inventario/InventarioTabla.tsx:588` | texto en pantalla | Ninguna pantalla coincide con los filtros elegidos. | No screens match the chosen filters. |
| `inventario.tabla.vacio.inventario` | `components/demo/inventario/InventarioTabla.tsx:589` | texto en pantalla | Todavía no hay pantallas en el inventario. Agrégalas una a una o por carga masiva. | There are no screens in the inventory yet. Add them one by one or by bulk upload. |
| `inventario.tabla.doohmain-title` | `components/demo/inventario/InventarioTabla.tsx:628` | texto en pantalla | Id en DOOHmain: {id} | DOOHmain ID: {id} |
| `inventario.tabla.doohmain-title-servidor` | `components/demo/inventario/InventarioTabla.tsx:627` | texto en pantalla | Id en DOOHmain: {id} (lo pone el servidor; no está escrito en la ficha) | DOOHmain ID: {id} (set by the server; not written in the profile) |
| `inventario.tabla.doohmain-servidor` | `components/demo/inventario/InventarioTabla.tsx:633` | texto en pantalla | ␣· servidor | ␣· server |
| `inventario.tabla.confirma` | `components/demo/inventario/InventarioTabla.tsx:699`<br>`components/demo/inventario/InventarioTabla.tsx:826`<br>`components/demo/inventario/InventarioTabla.tsx:947`<br>`components/demo/inventario/InventarioTabla.tsx:1092`<br>`components/demo/arrendadores/ContratoSheet.tsx:388`<br>`components/demo/arrendadores/PagosRentaCard.tsx:327` | título | Confirma con tu contraseña | Confirm with your password |
| `inventario.tabla.confirmar-aplicar` | `components/demo/inventario/InventarioTabla.tsx:701` | subtítulo | Confirmar y aplicar | Confirm and apply |
| `inventario.renta.ilegible` | `components/demo/inventario/InventarioTabla.tsx:775` | aviso emergente | La renta no se entiende: no se guardó. La coma separa miles y el punto, decimales. | The rent can’t be read: it wasn’t saved. The comma separates thousands and the period, decimals. |
| `inventario.renta.compartida-confirm` | `components/demo/inventario/InventarioTabla.tsx:787` | confirmación del navegador | Esta renta es del contrato del predio y la comparten {n} pantallas. Cambiarla a {monto} aplica a todas. ¿Continuar? | This rent belongs to the property’s contract and is shared by {n} screens. Changing it to {monto} applies to all of them. Continue? |
| `inventario.renta.predio-actualizada` | `components/demo/inventario/InventarioTabla.tsx:801` | aviso emergente | Renta del predio actualizada ({n} pantallas) | Property rent updated ({n} screens) |
| `inventario.renta.actualizada` | `components/demo/inventario/InventarioTabla.tsx:802` | aviso emergente | Renta de "{nombre}" actualizada | Rent for “{nombre}” updated |
| `inventario.renta.no-actualizar` | `components/demo/inventario/InventarioTabla.tsx:805` | aviso emergente | No se pudo actualizar la renta | Could not update the rent |
| `inventario.renta.sensible` | `components/demo/inventario/InventarioTabla.tsx:827` | título | Cambiar la renta de "{nombre}" es un cambio sensible: tu organización pide que vuelvas a identificarte. | Changing the rent for “{nombre}” is a sensitive change: your organization asks you to confirm your identity again. |
| `inventario.renta.title-compartida` | `components/demo/inventario/InventarioTabla.tsx:840` | texto en pantalla | Renta del contrato del predio — la comparten {n} pantallas | Property contract rent — shared by {n} screens |
| `inventario.renta.title` | `components/demo/inventario/InventarioTabla.tsx:841` | texto en pantalla | Editar la renta que se le paga al arrendador | Edit the rent paid to the landlord |
| `inventario.tarifa.ilegible` | `components/demo/inventario/InventarioTabla.tsx:914` | aviso emergente | La tarifa no se entiende: no se guardó. La coma separa miles y el punto, decimales. | The rate can’t be read: it wasn’t saved. The comma separates thousands and the period, decimals. |
| `inventario.tarifa.actualizada` | `components/demo/inventario/InventarioTabla.tsx:925` | aviso emergente | Tarifa de "{nombre}" actualizada | Rate for “{nombre}” updated |
| `inventario.tarifa.no-actualizar` | `components/demo/inventario/InventarioTabla.tsx:927` | aviso emergente | No se pudo actualizar la tarifa | Could not update the rate |
| `inventario.tarifa.sensible` | `components/demo/inventario/InventarioTabla.tsx:948` | título | Cambiar la tarifa de "{nombre}" es un cambio sensible: tu organización pide que vuelvas a identificarte. | Changing the rate for “{nombre}” is a sensitive change: your organization asks you to confirm your identity again. |
| `inventario.tarifa.title` | `components/demo/inventario/InventarioTabla.tsx:959` | título / tooltip | Editar tarifa | Edit rate |
| `inventario.propia.title` | `components/demo/inventario/InventarioTabla.tsx:1012` | título / tooltip | Pantalla propia: sin renta ni contrato; su costo es luz y operación | Owned screen: no rent or contract; its costs are electricity and operations |
| `inventario.sin-arrendador` | `components/demo/inventario/InventarioTabla.tsx:1021` | texto en pantalla | Sin arrendador | No landlord |
| `inventario.sin-arrendador.opcion` | `components/demo/inventario/InventarioTabla.tsx:1141` | opción de un selector | — Sin arrendador — | — No landlord — |
| `inventario.arrendador.actualizado` | `components/demo/inventario/InventarioTabla.tsx:1068` | aviso emergente | Arrendador actualizado en "{nombre}" | Landlord updated on “{nombre}” |
| `inventario.arrendador.quitado` | `components/demo/inventario/InventarioTabla.tsx:1069` | aviso emergente | Arrendador quitado de "{nombre}" | Landlord removed from “{nombre}” |
| `inventario.arrendador.no-actualizar` | `components/demo/inventario/InventarioTabla.tsx:1072` | aviso emergente | No se pudo actualizar el arrendador | Could not update the landlord |
| `inventario.arrendador.sensible` | `components/demo/inventario/InventarioTabla.tsx:1093` | título | Cambiar el arrendador de "{nombre}" es un cambio sensible: decide a quién se le paga la renta, así que tu organización pide que vuelvas a identificarte. | Changing the landlord of “{nombre}” is a sensitive change: it decides who the rent is paid to, so your organization asks you to confirm your identity again. |
| `inventario.arrendador.asignar` | `components/demo/inventario/InventarioTabla.tsx:1116` | título / tooltip | Asignar arrendador | Assign landlord |
| `inventario.wizard.paso.arrendador` | `components/demo/inventario/ContratoWizard.tsx:48` | texto en pantalla | Arrendador y predio | Landlord and property |
| `inventario.wizard.paso.contrato` | `components/demo/inventario/ContratoWizard.tsx:49` | texto en pantalla | Contrato | Contract |
| `inventario.wizard.paso.pantalla` | `components/demo/inventario/ContratoWizard.tsx:50` | texto en pantalla | Pantalla | Screen |
| `inventario.tipo.espectacular` | `components/demo/inventario/ContratoWizard.tsx:35`<br>`components/demo/inventario/NuevaPantallaForm.tsx:34`<br>`components/demo/inventario/etiquetas.ts:57` | texto en pantalla · etiqueta de un valor (mapa de claves) | Espectacular | Billboard |
| `inventario.tipo.pantalla-digital` | `components/demo/inventario/ContratoWizard.tsx:36`<br>`components/demo/inventario/etiquetas.ts:58` | texto en pantalla · etiqueta de un valor (mapa de claves) | Pantalla digital | Digital screen |
| `inventario.tipo.muro` | `components/demo/inventario/ContratoWizard.tsx:37`<br>`components/demo/inventario/NuevaPantallaForm.tsx:35`<br>`components/demo/inventario/etiquetas.ts:59` | texto en pantalla · etiqueta de un valor (mapa de claves) | Muro | Wall |
| `inventario.tipo.valla` | `components/demo/inventario/ContratoWizard.tsx:38`<br>`components/demo/inventario/NuevaPantallaForm.tsx:36`<br>`components/demo/inventario/etiquetas.ts:60` | texto en pantalla · etiqueta de un valor (mapa de claves) | Valla | Poster panel |
| `inventario.tipo.mobiliario` | `components/demo/inventario/ContratoWizard.tsx:39`<br>`components/demo/inventario/etiquetas.ts:61` | texto en pantalla · etiqueta de un valor (mapa de claves) | Mobiliario urbano | Street furniture |
| `inventario.tipo.mobiliario-detalle` | `components/demo/inventario/NuevaPantallaForm.tsx:37` | texto en pantalla | Mobiliario urbano (parabús/mupi/publitienda) | Street furniture (bus shelter/mupi/store display) |
| `inventario.tipo.puente` | `components/demo/inventario/ContratoWizard.tsx:40`<br>`components/demo/inventario/NuevaPantallaForm.tsx:38`<br>`components/demo/inventario/etiquetas.ts:62` | texto en pantalla · etiqueta de un valor (mapa de claves) | Puente | Bridge |
| `inventario.tipo.otro` | `components/demo/inventario/ContratoWizard.tsx:41`<br>`components/demo/inventario/NuevaPantallaForm.tsx:39`<br>`components/demo/inventario/etiquetas.ts:63` | texto en pantalla · etiqueta de un valor (mapa de claves) | Otro | Other |
| `inventario.wizard.renta-ilegible` | `components/demo/inventario/ContratoWizard.tsx:217` | mensaje de error | La renta no se entiende: la coma separa miles y el punto, decimales ({ejemplo}). | The rent can’t be read: the comma separates thousands and the period, decimals ({ejemplo}). |
| `inventario.wizard.fin-antes` | `components/demo/inventario/ContratoWizard.tsx:219` | mensaje de error | La fecha de fin no puede ser anterior a la de inicio. | The end date cannot be earlier than the start date. |
| `inventario.wizard.arrendado-hasta` | `components/demo/inventario/ContratoWizard.tsx:225`<br>`components/demo/inventario/ContratoWizard.tsx:278` | mensaje de error | Ese espacio estuvo arrendado hasta el {fin}. El contrato nuevo debe empezar el {desde} o después. | That space was leased until {fin}. The new contract must start on {desde} or later. |
| `inventario.wizard.renta-negativa` | `components/demo/inventario/ContratoWizard.tsx:231` | mensaje de error | Captura la renta (no negativa). | Enter the rent (not negative). |
| `inventario.wizard.pdf-tipo` | `components/demo/inventario/ContratoWizard.tsx:246` | aviso emergente (error) | El documento debe ser un PDF | The document must be a PDF |
| `inventario.wizard.pdf-tamano` | `components/demo/inventario/ContratoWizard.tsx:251` | aviso emergente (error) | El PDF supera 8 MB | The PDF is over 8 MB |
| `inventario.wizard.pdf-leer` | `components/demo/inventario/ContratoWizard.tsx:257` | aviso emergente (error) | No se pudo leer el PDF | Could not read the PDF |
| `inventario.wizard.ok.predio` | `components/demo/inventario/ContratoWizard.tsx:372` | aviso emergente (éxito) | Pantalla agregada al predio | Screen added to the property |
| `inventario.wizard.ok.asignada` | `components/demo/inventario/ContratoWizard.tsx:374` | texto en pantalla | Contrato creado y pantalla asignada | Contract created and screen assigned |
| `inventario.wizard.ok.creados` | `components/demo/inventario/ContratoWizard.tsx:375` | texto en pantalla | Contrato y pantalla creados | Contract and screen created |
| `inventario.wizard.no-crear` | `components/demo/inventario/ContratoWizard.tsx:383` | mensaje de error | No se pudo crear el contrato | Could not create the contract |
| `inventario.wizard.p1.intro` | `components/demo/inventario/ContratoWizard.tsx:430` | texto en pantalla | ¿A quién le rentas este espacio? Elige el arrendador ya registrado o da de alta uno nuevo. | Who are you renting this space from? Choose a registered landlord or add a new one. |
| `inventario.wizard.existente` | `components/demo/inventario/ContratoWizard.tsx:434` | botón | Existente | Existing |
| `inventario.wizard.nuevo` | `components/demo/inventario/ContratoWizard.tsx:438` | botón | Nuevo | New |
| `inventario.wizard.arrendador` | `components/demo/inventario/ContratoWizard.tsx:443` | rótulo | Arrendador | Landlord |
| `inventario.wizard.selecciona` | `components/demo/inventario/ContratoWizard.tsx:445`<br>`components/demo/inventario/ContratoWizard.tsx:482`<br>`components/demo/inventario/ContratoWizard.tsx:633` | opción de un selector | — Selecciona — | — Select — |
| `inventario.wizard.sin-arrendadores` | `components/demo/inventario/ContratoWizard.tsx:449` | opción de un selector | No hay arrendadores aún. Cambia a “Nuevo” para dar de alta uno. | No landlords yet. Switch to “New” to add one. |
| `inventario.wizard.nombre-razon` | `components/demo/inventario/ContratoWizard.tsx:454`<br>`app/(app)/(shell)/arrendadores/page.tsx:660` | texto de ejemplo (placeholder) · rótulo | Nombre / razón social | Name / legal name |
| `inventario.wizard.rfc` | `components/demo/inventario/ContratoWizard.tsx:455`<br>`app/(app)/(shell)/arrendadores/page.tsx:682`<br>`app/(app)/(shell)/arrendadores/page.tsx:1001`<br>`components/demo/arrendadores/ContratoSheet.tsx:759`<br>`components/demo/arrendadores/PanelFirmas.tsx:304`<br>`components/demo/arrendadores/PanelFirmas.tsx:314`<br>`components/demo/arrendadores/GestionRazonesSociales.tsx:166` | texto de ejemplo (placeholder) · rótulo · cabecera de columna · texto en pantalla | RFC | RFC (tax ID) |
| `inventario.wizard.telefono` | `components/demo/inventario/ContratoWizard.tsx:456`<br>`app/(app)/(shell)/arrendadores/page.tsx:697`<br>`components/demo/arrendadores/ContratoSheet.tsx:334`<br>`components/demo/arrendadores/ContratoSheet.tsx:762` | rótulo | Teléfono | Phone |
| `inventario.wizard.correo` | `components/demo/inventario/ContratoWizard.tsx:457`<br>`app/(app)/(shell)/arrendadores/page.tsx:701` | rótulo | Correo | Email |
| `inventario.wizard.p1.predio` | `components/demo/inventario/ContratoWizard.tsx:463` | texto en pantalla | ¿Qué predio se renta? El contrato y la renta pertenecen al predio: si varias pantallas están en el mismo predio, elige el que ya existe y la renta se reparte entre ellas. | Which property is rented? The contract and the rent belong to the property: if several screens are on the same property, choose the existing one and the rent is split among them. |
| `inventario.wizard.predio-existente` | `components/demo/inventario/ContratoWizard.tsx:469` | botón | Predio existente | Existing property |
| `inventario.wizard.predio-nuevo` | `components/demo/inventario/ContratoWizard.tsx:473` | botón | Predio nuevo | New property |
| `inventario.wizard.predio` | `components/demo/inventario/ContratoWizard.tsx:480` | rótulo | Predio | Property |
| `inventario.wizard.predio-con-contrato` | `components/demo/inventario/ContratoWizard.tsx:490` | texto en pantalla | Este predio ya tiene un contrato vigente de {monto} ({periodicidad}). No se firma otro: la pantalla se agrega al predio y comparte esa renta con las demás. Para cambiar la renta, edita el contrato. | This property already has an active contract of {monto} ({periodicidad}). No other one is signed: the screen is added to the property and shares that rent with the others. To change the rent, edit the contract. |
| `inventario.wizard.importe-por-definir` | `components/demo/inventario/ContratoWizard.tsx:495` | texto en pantalla | importe por definir | amount to be defined |
| `inventario.wizard.nombre-predio` | `components/demo/inventario/ContratoWizard.tsx:505` | rótulo | Nombre del predio | Property name |
| `inventario.wizard.direccion-predio` | `components/demo/inventario/ContratoWizard.tsx:508` | rótulo | Dirección del predio | Property address |
| `inventario.wizard.direccion-predio-ph` | `components/demo/inventario/ContratoWizard.tsx:509` | texto de ejemplo (placeholder) | Se toma la de la pantalla si lo dejas vacío | The screen’s address is used if you leave it empty |
| `inventario.wizard.p2.intro` | `components/demo/inventario/ContratoWizard.tsx:521` | texto en pantalla | Condiciones del arrendamiento. {pasadas} para registrar contratos ya firmados. | Lease terms. {pasadas} to record contracts that are already signed. |
| `inventario.wizard.p2.pasadas` | `components/demo/inventario/ContratoWizard.tsx:522` | texto en pantalla | Puedes usar fechas pasadas | You can use past dates |
| `inventario.wizard.inicio-vigencia` | `components/demo/inventario/ContratoWizard.tsx:526` | rótulo | Inicio de vigencia | Start date |
| `inventario.wizard.fin-vigencia` | `components/demo/inventario/ContratoWizard.tsx:546` | rótulo | Fin de vigencia | End date |
| `inventario.wizard.historial` | `components/demo/inventario/ContratoWizard.tsx:538` | texto en pantalla | Este espacio estuvo arrendado hasta el {fin}. El contrato nuevo empieza el {desde} o después. | This space was leased until {fin}. The new contract starts on {desde} or later. |
| `inventario.wizard.no-antes-inicio` | `components/demo/inventario/ContratoWizard.tsx:549`<br>`components/demo/arrendadores/CambiosContrato.tsx:514` | mensaje de error | No puede ser anterior al inicio | Can’t be earlier than the start |
| `inventario.wizard.renta` | `components/demo/inventario/ContratoWizard.tsx:554` | rótulo | Renta | Rent |
| `inventario.wizard.cifra` | `components/demo/inventario/ContratoWizard.tsx:557`<br>`components/demo/inventario/ContratoWizard.tsx:698`<br>`components/demo/arrendadores/CambiosContrato.tsx:525`<br>`components/demo/arrendadores/CambiosContrato.tsx:555` | mensaje de error | No se entiende la cifra | The figure can’t be read |
| `inventario.wizard.periodicidad` | `components/demo/inventario/ContratoWizard.tsx:561` | rótulo | Periodicidad del pago | Payment frequency |
| `inventario.wizard.renovacion` | `components/demo/inventario/ContratoWizard.tsx:587` | texto en pantalla | Renovación automática | Automatic renewal |
| `inventario.wizard.documento` | `components/demo/inventario/ContratoWizard.tsx:592` | rótulo | Documento del contrato (PDF) | Contract document (PDF) |
| `inventario.wizard.quitar` | `components/demo/inventario/ContratoWizard.tsx:597` | título / tooltip | Quitar | Remove |
| `inventario.wizard.adjuntar-pdf` | `components/demo/inventario/ContratoWizard.tsx:604` | texto en pantalla | Adjuntar PDF del contrato firmado (máx. 8 MB) | Attach the signed contract PDF (max. 8 MB) |
| `inventario.wizard.p3.intro` | `components/demo/inventario/ContratoWizard.tsx:616` | texto en pantalla | ¿Qué pantalla ampara este contrato? Si ya está en tu inventario, elígela y no captures nada: se le asigna el arrendador y el predio. | Which screen does this contract cover? If it’s already in your inventory, choose it and don’t enter anything: the landlord and the property are assigned to it. |
| `inventario.wizard.del-inventario` | `components/demo/inventario/ContratoWizard.tsx:621` | botón | Del inventario | From inventory |
| `inventario.wizard.pantalla-nueva` | `components/demo/inventario/ContratoWizard.tsx:625` | botón | Pantalla nueva | New screen |
| `inventario.wizard.pantalla-libres` | `components/demo/inventario/ContratoWizard.tsx:631` | rótulo | Pantalla ({n} sin arrendador) | Screen ({n} without landlord) |
| `inventario.wizard.pantalla-historial` | `components/demo/inventario/ContratoWizard.tsx:646` | texto en pantalla | Esta pantalla estuvo arrendada hasta el {fin}. La vigencia que capturaste empieza el {inicio}: regresa al paso 2 y muévela al {desde} o después. | This screen was leased until {fin}. The term you entered starts on {inicio}: go back to step 2 and move it to {desde} or later. |
| `inventario.wizard.todas-asignadas` | `components/demo/inventario/ContratoWizard.tsx:655` | texto en pantalla | Todas tus pantallas ya están asignadas a un predio. Cambia a “Pantalla nueva”. | All your screens are already assigned to a property. Switch to “New screen”. |
| `inventario.wizard.datos-que-tiene` | `components/demo/inventario/ContratoWizard.tsx:663` | texto en pantalla | Datos que ya tiene | Data it already has |
| `inventario.wizard.caras` | `components/demo/inventario/ContratoWizard.tsx:673`<br>`components/demo/inventario/ContratoWizard.tsx:697`<br>`components/demo/inventario/NuevaPantallaForm.tsx:336` | rótulo · texto de ejemplo (placeholder) | Caras | Faces |
| `inventario.wizard.tarifa-publicada` | `components/demo/inventario/ContratoWizard.tsx:675`<br>`components/demo/inventario/ContratoWizard.tsx:698`<br>`components/demo/inventario/NuevaPantallaForm.tsx:393` | rótulo · mensaje de error · texto de ejemplo (placeholder) | Tarifa publicada | Published rate |
| `inventario.wizard.direccion` | `components/demo/inventario/ContratoWizard.tsx:676`<br>`components/demo/inventario/ContratoWizard.tsx:694`<br>`components/demo/inventario/NuevaPantallaForm.tsx:298` | rótulo · opción de un selector | Dirección | Address |
| `inventario.wizard.se-ligara` | `components/demo/inventario/ContratoWizard.tsx:679` | texto en pantalla | Se ligará al predio del contrato. Para cambiar estos datos, edita la pantalla en Inventario. | It will be linked to the contract’s property. To change this data, edit the screen in Inventory. |
| `inventario.wizard.nombre-pantalla` | `components/demo/inventario/ContratoWizard.tsx:688`<br>`components/demo/inventario/NuevaPantallaForm.tsx:295` | texto de ejemplo (placeholder) · rótulo | Nombre de la pantalla | Screen name |
| `inventario.wizard.tipo-medio` | `components/demo/inventario/ContratoWizard.tsx:689` | rótulo | Tipo de medio | Media type |
| `inventario.wizard.distrito` | `components/demo/inventario/ContratoWizard.tsx:695` | rótulo | Distrito / alcaldía | District / borough |
| `inventario.wizard.ciudad` | `components/demo/inventario/ContratoWizard.tsx:696` | rótulo | Ciudad | City |
| `inventario.wizard.slots` | `components/demo/inventario/ContratoWizard.tsx:707` | texto de ejemplo (placeholder) | Slots (digital) | Slots (digital screen) |
| `inventario.wizard.duracion-slot` | `components/demo/inventario/ContratoWizard.tsx:708`<br>`components/demo/inventario/NuevaPantallaForm.tsx:351` | texto de ejemplo (placeholder) | Duración por slot (s) | Slot length (s) |
| `inventario.wizard.resumen.solo-pantalla` | `components/demo/inventario/ContratoWizard.tsx:718` | texto en pantalla | La pantalla “{nombre}” se agregará al predio, que ya tiene contrato vigente. Su renta se repartirá entre las pantallas del predio. | The screen “{nombre}” will be added to the property, which already has an active contract. Its rent will be split among the property’s screens. |
| `inventario.wizard.resumen.asignar` | `components/demo/inventario/ContratoWizard.tsx:724` | texto en pantalla | Se creará el contrato ({inicio} → {fin}, renta {monto} {periodicidad}) y se asignará la pantalla “{nombre}”, todo vinculado al arrendador. | The contract will be created ({inicio} → {fin}, rent {monto} {periodicidad}) and the screen “{nombre}” will be assigned, all linked to the landlord. |
| `inventario.wizard.resumen.crear` | `components/demo/inventario/ContratoWizard.tsx:724` | texto en pantalla | Se creará el contrato ({inicio} → {fin}, renta {monto} {periodicidad}) y se creará la pantalla “{nombre}”, todo vinculado al arrendador. | The contract will be created ({inicio} → {fin}, rent {monto} {periodicidad}) and the screen “{nombre}” will be created, all linked to the landlord. |
| `inventario.wizard.atras` | `components/demo/inventario/ContratoWizard.tsx:763` | texto en pantalla | Atrás | Back |
| `inventario.wizard.siguiente` | `components/demo/inventario/ContratoWizard.tsx:769` | botón | Siguiente | Next |
| `inventario.wizard.creando` | `components/demo/inventario/ContratoWizard.tsx:786` | texto en pantalla | Creando… | Creating… |
| `inventario.wizard.confirmar-crear` | `components/demo/inventario/ContratoWizard.tsx:788` | texto en pantalla | Confirmar y crear | Confirm and create |
| `inventario.wizard.crear` | `components/demo/inventario/ContratoWizard.tsx:788` | texto en pantalla | Crear contrato y pantalla | Create contract and screen |
| `inventario.alta.estado.disponible` | `components/demo/inventario/NuevaPantallaForm.tsx:42` | texto en pantalla | Disponible | Available |
| `inventario.alta.estado.ocupada` | `components/demo/inventario/NuevaPantallaForm.tsx:43` | texto en pantalla | Ocupada | Occupied |
| `inventario.alta.estado.mantenimiento` | `components/demo/inventario/NuevaPantallaForm.tsx:44` | texto en pantalla | Mantenimiento | Maintenance |
| `inventario.alta.modalidad.mensual` | `components/demo/inventario/NuevaPantallaForm.tsx:51` | texto en pantalla | Mensual | Monthly |
| `inventario.alta.modalidad.catorcenal` | `components/demo/inventario/NuevaPantallaForm.tsx:52` | texto en pantalla | Catorcenal | Every two weeks |
| `inventario.alta.imagen-tamano` | `components/demo/inventario/NuevaPantallaForm.tsx:146` | aviso emergente (error) | La imagen supera 5MB | The image is over 5MB |
| `inventario.alta.imagen-leer` | `components/demo/inventario/NuevaPantallaForm.tsx:156` | aviso emergente (error) | No se pudo leer la imagen | Could not read the image |
| `inventario.alta.falta-admobilize` | `components/demo/inventario/NuevaPantallaForm.tsx:219` | texto en pantalla | ID AdMobilize requerido (pestaña IA/Vision) | AdMobilize ID required (AI/Vision tab) |
| `inventario.alta.falta-imagen` | `components/demo/inventario/NuevaPantallaForm.tsx:221` | texto en pantalla | Imagen obligatoria (pestaña Imágenes) | Image required (Images tab) |
| `inventario.alta.falta-basico` | `components/demo/inventario/NuevaPantallaForm.tsx:223` | texto en pantalla | Faltan datos obligatorios (pestaña Básico) | Required fields missing (Basics tab) |
| `inventario.alta.falta-ubicacion` | `components/demo/inventario/NuevaPantallaForm.tsx:226` | texto en pantalla | Latitud y longitud obligatorias (pestaña Ubicación) | Latitude and longitude required (Location tab) |
| `inventario.alta.cifra-roja` | `components/demo/inventario/NuevaPantallaForm.tsx:229` | texto en pantalla | Hay una cifra en rojo que no se entiende (renta, tarifa, precio por m² o slots) | There is a figure in red that can’t be read (rent, rate, price per m² or slots) |
| `inventario.alta.guardar` | `components/demo/inventario/NuevaPantallaForm.tsx:238` | botón | Guardar pantalla | Save screen |
| `inventario.alta.tab.basico` | `components/demo/inventario/NuevaPantallaForm.tsx:248`<br>`components/demo/inventario/NuevaPantallaForm.tsx:401` | texto en pantalla | Básico | Basics |
| `inventario.alta.tab.specs` | `components/demo/inventario/NuevaPantallaForm.tsx:249` | texto en pantalla | Especificaciones | Specifications |
| `inventario.alta.tab.ia` | `components/demo/inventario/NuevaPantallaForm.tsx:250` | texto en pantalla | IA/Vision | AI/Vision |
| `inventario.alta.tab.precios` | `components/demo/inventario/NuevaPantallaForm.tsx:251`<br>`components/demo/inventario/NuevaPantallaForm.tsx:392` | texto en pantalla · título | Precios | Prices |
| `inventario.alta.tab.imagenes` | `components/demo/inventario/NuevaPantallaForm.tsx:252`<br>`components/demo/inventario/NuevaPantallaForm.tsx:414` | texto en pantalla · título | Imágenes | Images |
| `inventario.alta.info-basica` | `components/demo/inventario/NuevaPantallaForm.tsx:256` | título | Información básica | Basic information |
| `inventario.alta.arrendador` | `components/demo/inventario/NuevaPantallaForm.tsx:267` | rótulo | Arrendador (dueño del espacio) | Landlord (space owner) |
| `inventario.alta.elige-arrendador` | `components/demo/inventario/NuevaPantallaForm.tsx:273`<br>`components/demo/inventario/ImportarInventarioDialog.tsx:323` | opción de un selector | Elige un arrendador… | Choose a landlord… |
| `inventario.alta.renta` | `components/demo/inventario/NuevaPantallaForm.tsx:283` | rótulo | Renta al arrendador | Rent to landlord |
| `inventario.alta.renta-ayuda` | `components/demo/inventario/NuevaPantallaForm.tsx:291` | texto en pantalla | Lo que se le paga al arrendador, no lo que se le cobra al cliente. Puedes dejarlo vacío y capturarlo después: el contrato queda pendiente en Arrendadores. | What is paid to the landlord, not what the client is charged. You can leave it empty and enter it later: the contract stays pending in Landlords. |
| `inventario.alta.exhibicion` | `components/demo/inventario/NuevaPantallaForm.tsx:301` | rótulo | Exhibición | Display |
| `inventario.alta.fija` | `components/demo/inventario/NuevaPantallaForm.tsx:303` | opción de un selector | Fija (impresa) | Static (printed) |
| `inventario.alta.digital` | `components/demo/inventario/NuevaPantallaForm.tsx:304` | opción de un selector | Digital (pantalla) | Digital (screen) |
| `inventario.alta.ayuda-digital` | `components/demo/inventario/NuevaPantallaForm.tsx:308` | texto en pantalla | Pantalla digital: se comercializa por slots (ver pestaña Especificaciones). | Digital screen: sold by slots (see the Specifications tab). |
| `inventario.alta.ayuda-fija` | `components/demo/inventario/NuevaPantallaForm.tsx:309` | texto en pantalla | Pantalla fija: se imprime y se comercializa por periodo. | Static screen: printed and sold by period. |
| `inventario.alta.latitud` | `components/demo/inventario/NuevaPantallaForm.tsx:313` | mensaje de error | Latitud | Latitude |
| `inventario.alta.longitud` | `components/demo/inventario/NuevaPantallaForm.tsx:314` | mensaje de error | Longitud | Longitude |
| `inventario.alta.fuera-rango` | `components/demo/inventario/NuevaPantallaForm.tsx:313` | mensaje de error | Coordenadas fuera de rango | Coordinates out of range |
| `inventario.alta.tipo-pantalla` | `components/demo/inventario/NuevaPantallaForm.tsx:317` | rótulo | Tipo de pantalla | Screen type |
| `inventario.alta.estado` | `components/demo/inventario/NuevaPantallaForm.tsx:322` | opción de un selector | Estado | Status |
| `inventario.alta.specs` | `components/demo/inventario/NuevaPantallaForm.tsx:331` | título | Especificaciones técnicas | Technical specifications |
| `inventario.alta.res-ancho` | `components/demo/inventario/NuevaPantallaForm.tsx:333` | texto de ejemplo (placeholder) | Resolución ancho (px) | Resolution width (px) |
| `inventario.alta.res-alto` | `components/demo/inventario/NuevaPantallaForm.tsx:334` | texto de ejemplo (placeholder) | Resolución alto (px) | Resolution height (px) |
| `inventario.alta.modalidades` | `components/demo/inventario/NuevaPantallaForm.tsx:338` | texto en pantalla | Modalidades de contratación | Sales modes |
| `inventario.alta.config-slots` | `components/demo/inventario/NuevaPantallaForm.tsx:349` | texto en pantalla | Configuración de slots | Slot setup |
| `inventario.alta.total-slots` | `components/demo/inventario/NuevaPantallaForm.tsx:352` | texto de ejemplo (placeholder) | Total slots | Total slots |
| `inventario.alta.slots-disponibles` | `components/demo/inventario/NuevaPantallaForm.tsx:353` | texto de ejemplo (placeholder) | Slots disponibles | Available slots |
| `inventario.alta.admobilize` | `components/demo/inventario/NuevaPantallaForm.tsx:361` | texto en pantalla | {marca} permite detectar y contabilizar vehículos y personas que pasan frente a la pantalla utilizando tecnología de Computer Vision. | {marca} detects and counts the vehicles and people passing in front of the screen using Computer Vision technology. |
| `inventario.alta.cv` | `components/demo/inventario/NuevaPantallaForm.tsx:367` | texto en pantalla | Esta pantalla cuenta con tecnología de Computer Vision (IA) | This screen has Computer Vision (AI) technology |
| `inventario.alta.cv-ayuda` | `components/demo/inventario/NuevaPantallaForm.tsx:368` | texto en pantalla | Actívala si tu pantalla usa AdMobilize para el conteo de audiencia | Turn it on if your screen uses AdMobilize for audience counting |
| `inventario.alta.admobilize-id` | `components/demo/inventario/NuevaPantallaForm.tsx:374` | rótulo | ID del dispositivo AdMobilize | AdMobilize device ID |
| `inventario.alta.admobilize-id-ayuda` | `components/demo/inventario/NuevaPantallaForm.tsx:376` | texto en pantalla | Identificador único del dispositivo instalado en esta pantalla. | Unique identifier of the device installed on this screen. |
| `inventario.alta.deteccion-vivo` | `components/demo/inventario/NuevaPantallaForm.tsx:379` | texto en pantalla | Vista de detección en vivo | Live detection view |
| `inventario.alta.deteccion-previa` | `components/demo/inventario/NuevaPantallaForm.tsx:381` | texto en pantalla | Vista previa de la detección de vehículos y personas por Computer Vision. | Preview of vehicle and people detection by Computer Vision. |
| `inventario.alta.ver-ia` | `components/demo/inventario/NuevaPantallaForm.tsx:384` | botón | Ver imagen de detección IA | View AI detection image |
| `inventario.alta.costo` | `components/demo/inventario/NuevaPantallaForm.tsx:399` | texto en pantalla | El costo de esta pantalla es la {renta}, que se captura en la pestaña {basico}. {estado} | The cost of this screen is the {renta}, which is entered in the {basico} tab. {estado} |
| `inventario.alta.costo-renta` | `components/demo/inventario/NuevaPantallaForm.tsx:400` | texto en pantalla | renta al arrendador | rent to the landlord |
| `inventario.alta.costo-actual` | `components/demo/inventario/NuevaPantallaForm.tsx:404` | texto en pantalla | Actualmente: {n}. | Currently: {n}. |
| `inventario.alta.costo-sin` | `components/demo/inventario/NuevaPantallaForm.tsx:405` | texto en pantalla | Aún sin capturar. | Not entered yet. |
| `inventario.alta.precio-m2` | `components/demo/inventario/NuevaPantallaForm.tsx:408` | rótulo | Precio por m² (estáticas) | Price per m² (static) |
| `inventario.alta.precio-m2-ph` | `components/demo/inventario/NuevaPantallaForm.tsx:409` | texto de ejemplo (placeholder) | Se aplica a las estáticas del lote | Applied to the batch’s static screens |
| `inventario.alta.imagen` | `components/demo/inventario/NuevaPantallaForm.tsx:415` | rótulo | Imagen promocional | Promotional image |
| `inventario.alta.imagen-formato` | `components/demo/inventario/NuevaPantallaForm.tsx:416` | texto en pantalla | JPG o PNG · máximo 5MB | JPG or PNG · max. 5MB |
| `inventario.alta.cambiar-imagen` | `components/demo/inventario/NuevaPantallaForm.tsx:430` | texto en pantalla | Cambiar imagen | Change image |
| `inventario.alta.subir-imagen` | `components/demo/inventario/NuevaPantallaForm.tsx:430` | texto en pantalla | Subir imagen | Upload image |
| `inventario.alta.ia-titulo` | `components/demo/inventario/NuevaPantallaForm.tsx:445` | título / tooltip | Detección por Computer Vision | Computer Vision detection |
| `inventario.alta.ia-sub` | `components/demo/inventario/NuevaPantallaForm.tsx:446` | título / tooltip | Vista de muestra del conteo de vehículos y personas (AdMobilize) | Sample view of vehicle and people counting (AdMobilize) |
| `inventario.alta.ia-alt` | `components/demo/inventario/NuevaPantallaForm.tsx:451` | texto en pantalla | Detección de vehículos y personas por IA | AI detection of vehicles and people |
| `inventario.alta.ia-nota` | `components/demo/inventario/NuevaPantallaForm.tsx:455` | texto en pantalla | Las cajas y métricas (velocidad, conteo por zona) las genera el módulo de Computer Vision en tiempo real. | The boxes and metrics (speed, count by area) are generated by the Computer Vision module in real time. |
| `inventario.alta.titulo` | `components/demo/inventario/NuevaPantallaForm.tsx:463`<br>`components/demo/inventario/NuevaPantallaForm.tsx:476` | título / tooltip | Nueva pantalla | New screen |
| `inventario.alta.sub` | `components/demo/inventario/NuevaPantallaForm.tsx:463`<br>`components/demo/inventario/NuevaPantallaForm.tsx:477` | título / tooltip | Alta manual de una sola pantalla | Manual entry of a single screen |
| `inventario.carga.no-leer` | `components/demo/inventario/ImportarInventarioDialog.tsx:177` | aviso emergente (error) | No se pudo leer el archivo. Verifica que sea .xlsx o .csv válido. | Could not read the file. Check that it is a valid .xlsx or .csv. |
| `inventario.carga.no-importar` | `components/demo/inventario/ImportarInventarioDialog.tsx:240` | aviso emergente (error) | No se pudo importar | Could not import |
| `inventario.carga.falta-arrendador` | `components/demo/inventario/ImportarInventarioDialog.tsx:252` | texto en pantalla | Falta elegir el arrendador | Choose the landlord |
| `inventario.carga.filas.uno` | `components/demo/inventario/ImportarInventarioDialog.tsx:254` | texto en pantalla | {n} filas leídas | {n} row read |
| `inventario.carga.filas.otros` | `components/demo/inventario/ImportarInventarioDialog.tsx:254` | texto en pantalla | {n} filas leídas | {n} rows read |
| `inventario.carga.sin-archivo` | `components/demo/inventario/ImportarInventarioDialog.tsx:255`<br>`components/demo/arrendadores/ContratoSheet.tsx:991` | texto en pantalla | Sin archivo | No file |
| `inventario.carga.cerrar` | `components/demo/inventario/ImportarInventarioDialog.tsx:259` | botón | Cerrar | Close |
| `inventario.carga.procesando` | `components/demo/inventario/ImportarInventarioDialog.tsx:262` | botón | Procesando… | Processing… |
| `inventario.carga.procesar` | `components/demo/inventario/ImportarInventarioDialog.tsx:262` | botón | Procesar importación | Process import |
| `inventario.carga.primera-vez` | `components/demo/inventario/ImportarInventarioDialog.tsx:273` | texto en pantalla | ¿Primera vez cargando inventario? | First time uploading inventory? |
| `inventario.carga.descarga-plantilla` | `components/demo/inventario/ImportarInventarioDialog.tsx:274` | texto en pantalla | Descarga la plantilla con el formato correcto | Download the template with the right format |
| `inventario.carga.descargar-plantilla` | `components/demo/inventario/ImportarInventarioDialog.tsx:281` | texto en pantalla | Descargar plantilla | Download template |
| `inventario.carga.propias` | `components/demo/inventario/ImportarInventarioDialog.tsx:289` | texto en pantalla | Son pantallas propias | They are owned screens |
| `inventario.carga.propias-ayuda` | `components/demo/inventario/ImportarInventarioDialog.tsx:291` | texto en pantalla | De la empresa: sin renta ni contrato. Se pueden vender y su costo es solo luz y operación. Si les pones un predio, será un lugar propio. | Company-owned: no rent or contract. They can be sold and their only costs are electricity and operations. If you give them a property, it will be an owned location. |
| `inventario.carga.arrendador` | `components/demo/inventario/ImportarInventarioDialog.tsx:308` | texto en pantalla | Arrendador de estas pantallas | Landlord of these screens |
| `inventario.carga.arrendador-predio` | `components/demo/inventario/ImportarInventarioDialog.tsx:314` | texto en pantalla | El predio y su contrato se abrirán a nombre de este arrendador | The property and its contract will be opened in this landlord’s name |
| `inventario.carga.arrendador-sueltas` | `components/demo/inventario/ImportarInventarioDialog.tsx:315` | texto en pantalla | A cada pantalla se le abrirá un contrato pendiente con este arrendador | Each screen will get a pending contract with this landlord |
| `inventario.carga.requiere` | `components/demo/inventario/ImportarInventarioDialog.tsx:335` | texto en pantalla | {titulo} Elige el arrendador de estas pantallas para poder importarlas: sin él no se puede abrir su contrato de arrendamiento, y una pantalla sin contrato no se puede vender. | {titulo} Choose the landlord of these screens to be able to import them: without one their lease agreement can’t be opened, and a screen without a contract can’t be sold. |
| `inventario.carga.requiere-titulo` | `components/demo/inventario/ImportarInventarioDialog.tsx:335` | texto en pantalla | Se requiere el arrendador. | The landlord is required. |
| `inventario.carga.predio` | `components/demo/inventario/ImportarInventarioDialog.tsx:347` | texto en pantalla | Predio | Property |
| `inventario.carga.predio-existente` | `components/demo/inventario/ImportarInventarioDialog.tsx:352` | texto en pantalla | Se añadirán al predio que ya existe, bajo su contrato. | They will be added to the existing property, under its contract. |
| `inventario.carga.predio-nuevo` | `components/demo/inventario/ImportarInventarioDialog.tsx:353` | texto en pantalla | Se creará el predio y todas compartirán UN solo contrato. | The property will be created and all of them will share ONE contract. |
| `inventario.carga.predio-sin` | `components/demo/inventario/ImportarInventarioDialog.tsx:354` | texto en pantalla | Sin nombre entran como pantallas sueltas, cada una con su contrato. | Without a name they come in as individual screens, each with its own contract. |
| `inventario.carga.predio-ph` | `components/demo/inventario/ImportarInventarioDialog.tsx:362` | texto de ejemplo (placeholder) | Nombre del predio | Property name |
| `inventario.carga.lejos-una` | `components/demo/inventario/ImportarInventarioDialog.tsx:381` | texto en pantalla | Una pantalla no parece estar en este predio. | One screen doesn’t seem to be on this property. |
| `inventario.carga.lejos-varias` | `components/demo/inventario/ImportarInventarioDialog.tsx:382` | texto en pantalla | {n} pantallas no parecen estar en este predio. | {n} screens don’t seem to be on this property. |
| `inventario.carga.lejos-explica` | `components/demo/inventario/ImportarInventarioDialog.tsx:384` | texto en pantalla | Un predio es un solo inmueble y su renta se reparte entre sus pantallas, así que una que está lejos abarataría a las demás. Puedes continuar si sabes que es correcto. | A property is a single building and its rent is split among its screens, so one that is far away would make the others cheaper. You can continue if you know it’s correct. |
| `inventario.carga.lejos-mas` | `components/demo/inventario/ImportarInventarioDialog.tsx:390` | texto en pantalla | · …y {n} más | · …and {n} more |
| `inventario.carga.sin-arrendadores` | `components/demo/inventario/ImportarInventarioDialog.tsx:401` | texto en pantalla | No hay arrendadores dados de alta. Crea al menos uno en {arrendadores} antes de importar inventario: sin arrendador no se puede abrir el contrato de la pantalla. | There are no landlords yet. Create at least one in {arrendadores} before importing inventory: without a landlord the screen’s contract can’t be opened. |
| `inventario.carga.arrendadores` | `components/demo/inventario/ImportarInventarioDialog.tsx:402` | texto en pantalla | Arrendadores | Landlords |
| `inventario.carga.precio-m2` | `components/demo/inventario/ImportarInventarioDialog.tsx:416` | texto en pantalla | Precio de impresión por m² (pantallas estáticas) | Printing price per m² (static screens) |
| `inventario.carga.precio-m2-ayuda` | `components/demo/inventario/ImportarInventarioDialog.tsx:417` | texto en pantalla | Este valor se aplicará a todas las pantallas estáticas | This value will apply to all static screens |
| `inventario.carga.precio-m2-ilegible` | `components/demo/inventario/ImportarInventarioDialog.tsx:434` | texto en pantalla | El precio por m² no se entiende: la coma separa miles y el punto, decimales (65.50). | The price per m² can’t be read: the comma separates thousands and the period, decimals (65.50). |
| `inventario.carga.hoja` | `components/demo/inventario/ImportarInventarioDialog.tsx:443` | texto en pantalla | Sube el archivo usando la hoja {hoja} de la plantilla. El sistema lee solo esa hoja, {limpia} y {agrupa}: una fila por modalidad de venta → un sitio con varias modalidades. Requeridos: nombre, exhibición, unidad y tarifa. | Upload the file using the {hoja} sheet of the template. The system reads only that sheet, {limpia} and {agrupa}: one row per sales mode → one site with several modes. Required: name, display, unit and rate. |
| `inventario.carga.hoja-limpia` | `components/demo/inventario/ImportarInventarioDialog.tsx:445` | texto en pantalla | limpia automáticamente los encabezados | cleans up the headers automatically |
| `inventario.carga.hoja-agrupa` | `components/demo/inventario/ImportarInventarioDialog.tsx:446` | texto en pantalla | agrupa por código de proveedor | groups by supplier code |
| `inventario.carga.costo` | `components/demo/inventario/ImportarInventarioDialog.tsx:458` | texto en pantalla | El costo de una pantalla es {uno}: la columna {renta}, lo que se le paga al dueño del espacio. No es la tarifa, que es lo que se le cobra al cliente. Si tu archivo trae la columna vieja {costo}, su importe se registra como la renta —es el mismo dinero— y se te avisa fila por fila. Si no viene ninguna de las dos, el contrato queda pendiente de completar en Arrendadores y la pantalla no se podrá reservar. | A screen has {uno} cost: the {renta} column, what is paid to the owner of the space. It isn’t the rate, which is what the client is charged. If your file has the old {costo} column, its amount is recorded as the rent —it is the same money— and you are warned row by row. If neither of the two comes, the contract stays pending in Landlords and the screen can’t be booked. |
| `inventario.carga.costo-uno` | `components/demo/inventario/ImportarInventarioDialog.tsx:459` | texto en pantalla | uno solo | just one |
| `inventario.carga.codificacion` | `components/demo/inventario/ImportarInventarioDialog.tsx:467` | rótulo | Codificación del archivo | File encoding |
| `inventario.carga.codificacion-ayuda` | `components/demo/inventario/ImportarInventarioDialog.tsx:474` | opción de un selector | El sistema intentará detectar automáticamente la codificación correcta si la seleccionada no funciona. | The system will try to detect the right encoding automatically if the selected one doesn’t work. |
| `inventario.carga.archivo` | `components/demo/inventario/ImportarInventarioDialog.tsx:480` | rótulo | Archivo | File |
| `inventario.carga.leyendo` | `components/demo/inventario/ImportarInventarioDialog.tsx:501` | texto en pantalla | Leyendo… | Reading… |
| `inventario.carga.arrastra` | `components/demo/inventario/ImportarInventarioDialog.tsx:501` | texto en pantalla | Arrastra un archivo o selecciónalo | Drag a file or select it |
| `inventario.carga.formatos` | `components/demo/inventario/ImportarInventarioDialog.tsx:504` | texto en pantalla | .xlsx o .csv | .xlsx or .csv |
| `inventario.carga.imagenes` | `components/demo/inventario/ImportarInventarioDialog.tsx:512` | texto en pantalla | Imágenes (bulk) | Images (bulk) |
| `inventario.carga.imagenes-cargadas.uno` | `components/demo/inventario/ImportarInventarioDialog.tsx:516` | texto en pantalla | {n} imágenes cargadas | {n} image uploaded |
| `inventario.carga.imagenes-cargadas.otros` | `components/demo/inventario/ImportarInventarioDialog.tsx:516` | texto en pantalla | {n} imágenes cargadas | {n} images uploaded |
| `inventario.carga.subir-imagenes` | `components/demo/inventario/ImportarInventarioDialog.tsx:519` | texto en pantalla | Subir imágenes (JPG/PNG ≤5MB) | Upload images (JPG/PNG ≤5MB) |
| `inventario.carga.nombra` | `components/demo/inventario/ImportarInventarioDialog.tsx:523` | texto en pantalla | Nombra cada archivo con el {codigo}: {a} (principal) o {b}, {c}… para varias por pantalla. | Name each file with the {codigo}: {a} (main) or {b}, {c}… for several per screen. |
| `inventario.carga.codigo-proveedor` | `components/demo/inventario/ImportarInventarioDialog.tsx:524` | texto en pantalla | código de proveedor | supplier code |
| `inventario.carga.duplicados.uno` | `components/demo/inventario/ImportarInventarioDialog.tsx:537` | texto en pantalla | {n} código(s) ya existen | {n} code already exists |
| `inventario.carga.duplicados.otros` | `components/demo/inventario/ImportarInventarioDialog.tsx:537` | texto en pantalla | {n} código(s) ya existen | {n} codes already exist |
| `inventario.carga.como-proceder` | `components/demo/inventario/ImportarInventarioDialog.tsx:539` | texto en pantalla | Elige cómo proceder antes de importar: | Choose how to proceed before importing: |
| `inventario.carga.actualizar` | `components/demo/inventario/ImportarInventarioDialog.tsx:543` | texto en pantalla | {accion} campos modificados (conserva la imagen anterior si no se sube una nueva) | {accion} the changed fields (keeps the previous image if no new one is uploaded) |
| `inventario.carga.actualizar-accion` | `components/demo/inventario/ImportarInventarioDialog.tsx:543` | texto en pantalla | Actualizar | Update |
| `inventario.carga.nueva` | `components/demo/inventario/ImportarInventarioDialog.tsx:547` | texto en pantalla | {accion} con sufijo -v2, -v3… | {accion} with suffix -v2, -v3… |
| `inventario.carga.nueva-accion` | `components/demo/inventario/ImportarInventarioDialog.tsx:547` | texto en pantalla | Crear nueva | Create new |
| `inventario.carga.resumen.creadas` | `components/demo/inventario/ImportarInventarioDialog.tsx:561` | rótulo | Creadas | Created |
| `inventario.carga.resumen.actualizadas` | `components/demo/inventario/ImportarInventarioDialog.tsx:562` | rótulo | Actualizadas | Updated |
| `inventario.carga.resumen.advertencias` | `components/demo/inventario/ImportarInventarioDialog.tsx:563` | rótulo | Advertencias | Warnings |
| `inventario.carga.resumen.errores` | `components/demo/inventario/ImportarInventarioDialog.tsx:564` | rótulo | Errores | Errors |
| `inventario.carga.ver-info` | `components/demo/inventario/ImportarInventarioDialog.tsx:568` | botón | Ver información añadida ({n}) | View added information ({n}) |
| `inventario.carga.titulo` | `components/demo/inventario/ImportarInventarioDialog.tsx:584`<br>`components/demo/inventario/ImportarInventarioDialog.tsx:600` | título / tooltip | Carga masiva de inventario | Bulk inventory upload |
| `inventario.carga.sub` | `components/demo/inventario/ImportarInventarioDialog.tsx:585`<br>`components/demo/inventario/ImportarInventarioDialog.tsx:601` | título / tooltip | Sube tu inventario por archivo o agrega una sola pantalla | Upload your inventory by file or add a single screen |
| `inventario.carga.vista-previa` | `components/demo/inventario/ImportarInventarioDialog.tsx:614` | texto en pantalla | Vista previa | Preview |
| `inventario.carga.estado.valida` | `components/demo/inventario/etiquetas.ts:68` | etiqueta de un valor (mapa de claves) | válida | valid |
| `inventario.carga.estado.creado` | `components/demo/inventario/etiquetas.ts:69` | etiqueta de un valor (mapa de claves) | creado | created |
| `inventario.carga.estado.actualizado` | `components/demo/inventario/etiquetas.ts:70` | etiqueta de un valor (mapa de claves) | actualizado | updated |
| `inventario.carga.estado.advertencia` | `components/demo/inventario/etiquetas.ts:71` | etiqueta de un valor (mapa de claves) | advertencia | warning |
| `inventario.carga.estado.error` | `components/demo/inventario/etiquetas.ts:72` | etiqueta de un valor (mapa de claves) | error | failed |
| `inventario.info.titulo` | `components/demo/inventario/InfoAnadidaModal.tsx:26` | título / tooltip | Información añadida | Added information |
| `inventario.info.sub.uno` | `components/demo/inventario/InfoAnadidaModal.tsx:27` | título / tooltip | {n} pantalla en el inventario | {n} screen in the inventory |
| `inventario.info.sub.otros` | `components/demo/inventario/InfoAnadidaModal.tsx:27` | título / tooltip | {n} pantallas en el inventario | {n} screens in the inventory |
| `inventario.info.vacio` | `components/demo/inventario/InfoAnadidaModal.tsx:31` | texto en pantalla | No hay pantallas para mostrar. | There are no screens to show. |
| `inventario.info.coords` | `components/demo/inventario/InfoAnadidaModal.tsx:48` | texto en pantalla | ␣· coords por verificar | ␣· coordinates to verify |
| `inventario.info.modalidades.uno` | `components/demo/inventario/InfoAnadidaModal.tsx:52` | texto en pantalla | {n} modalidad | {n} sales mode |
| `inventario.info.modalidades.otros` | `components/demo/inventario/InfoAnadidaModal.tsx:52` | texto en pantalla | {n} modalidades | {n} sales modes |
| `inventario.agregar.titulo` | `components/demo/inventario/AgregarInventario.tsx:37` | texto en pantalla | Agregar inventario | Add inventory |
| `inventario.agregar.sub` | `components/demo/inventario/AgregarInventario.tsx:39` | texto en pantalla | Carga masiva por Excel/CSV con plantilla, o alta manual de una pantalla. | Bulk upload by Excel/CSV with a template, or manual entry of one screen. |
