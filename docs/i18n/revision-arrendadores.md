# Tabla de revisión · lote de inglés «inventario y arrendadores» · Arrendadores, contratos y firma

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/arrendadores.ts` y de los usos en
el código (búsqueda literal de la clave). **407 claves** (`arrendadores.*`).

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
- **El contrato NO se traduce**: ni `lib/contrato-documento.ts`, ni la cantidad
  con letra, ni nada de lo que entra en el hash de las firmas, ni lo que se
  imprime con el documento (encabezados DECLARACIONES / CLÁUSULAS, los sellos
  «FIRMADO ELECTRÓNICAMENTE» / «FIRMA INVALIDADA», la constancia de firma
  electrónica y el aviso de borrador). Lo prueban `textos/arrendadores.test.ts`
  y el estado «documento del contrato» de la prueba de pantallas (en inglés, el
  documento sale en español y la barra y el panel en inglés).

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `arrendadores.titulo` | `app/(app)/(shell)/arrendadores/page.tsx:194`<br>`app/(app)/(shell)/arrendadores/page.tsx:976` | título | Arrendadores | Landlords |
| `arrendadores.comun.arrendador` | `app/(app)/(shell)/arrendadores/page.tsx:371`<br>`app/(app)/(shell)/arrendadores/page.tsx:796`<br>`app/(app)/(shell)/arrendadores/page.tsx:876`<br>`app/(app)/(shell)/arrendadores/page.tsx:1000`<br>`components/demo/arrendadores/ContratoSheet.tsx:329`<br>`components/demo/arrendadores/ContratoSheet.tsx:740`<br>`components/demo/arrendadores/CambiosContrato.tsx:459` | cabecera de columna · texto en pantalla · rótulo | Arrendador | Landlord |
| `arrendadores.comun.pantalla` | `app/(app)/(shell)/arrendadores/page.tsx:875`<br>`components/demo/arrendadores/PagosRentaCard.tsx:248`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:86` | cabecera de columna | Pantalla | Screen |
| `arrendadores.comun.renta` | `app/(app)/(shell)/arrendadores/page.tsx:373`<br>`components/demo/arrendadores/CambiosContrato.tsx:516`<br>`components/demo/arrendadores/PanelFirmas.tsx:328`<br>`components/demo/arrendadores/PagosRentaCard.tsx:249`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:87` | cabecera de columna · rótulo · texto en pantalla | Renta | Rent |
| `arrendadores.comun.contratos` | `app/(app)/(shell)/arrendadores/page.tsx:291`<br>`app/(app)/(shell)/arrendadores/page.tsx:797`<br>`app/(app)/(shell)/arrendadores/page.tsx:1007` | rótulo · cabecera de columna | Contratos | Contracts |
| `arrendadores.comun.predios` | `app/(app)/(shell)/arrendadores/page.tsx:798`<br>`app/(app)/(shell)/arrendadores/page.tsx:1008` | cabecera de columna | Predios | Properties |
| `arrendadores.comun.estatus` | `app/(app)/(shell)/arrendadores/page.tsx:376`<br>`components/demo/arrendadores/PagosRentaCard.tsx:252`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:91` | cabecera de columna | Estatus | Status |
| `arrendadores.comun.cada-cuando` | `app/(app)/(shell)/arrendadores/page.tsx:374`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:88` | cabecera de columna | Cada cuándo | Frequency |
| `arrendadores.comun.vence-contrato` | `app/(app)/(shell)/arrendadores/page.tsx:375`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:90` | cabecera de columna | Vence | Expires |
| `arrendadores.comun.renta-mensual` | `app/(app)/(shell)/arrendadores/page.tsx:280`<br>`app/(app)/(shell)/arrendadores/page.tsx:799`<br>`components/demo/arrendadores/ContratoSheet.tsx:186` | rótulo · cabecera de columna | Renta mensual | Monthly rent |
| `arrendadores.comun.razon-social` | `app/(app)/(shell)/arrendadores/page.tsx:727`<br>`app/(app)/(shell)/arrendadores/page.tsx:795`<br>`components/demo/arrendadores/ContratoSheet.tsx:758`<br>`components/demo/arrendadores/PanelFirmas.tsx:303`<br>`components/demo/arrendadores/PanelFirmas.tsx:313`<br>`components/demo/arrendadores/GestionRazonesSociales.tsx:157` | rótulo · cabecera de columna · texto en pantalla | Razón social | Legal name |
| `arrendadores.comun.razones-sociales` | `components/demo/arrendadores/GestionRazonesSociales.tsx:213`<br>`app/(app)/(shell)/razones-sociales/page.tsx:89` | título | Razones sociales | Legal entities |
| `arrendadores.comun.regimen` | `app/(app)/(shell)/arrendadores/page.tsx:735`<br>`components/demo/arrendadores/ContratoSheet.tsx:760`<br>`components/demo/arrendadores/GestionRazonesSociales.tsx:175` | rótulo | Régimen fiscal | Tax regime |
| `arrendadores.comun.domicilio` | `app/(app)/(shell)/arrendadores/page.tsx:704`<br>`app/(app)/(shell)/arrendadores/page.tsx:1005`<br>`components/demo/arrendadores/PanelFirmas.tsx:315` | rótulo · cabecera de columna · texto en pantalla | Domicilio | Address |
| `arrendadores.comun.por-definir` | `app/(app)/(shell)/arrendadores/page.tsx:395`<br>`components/demo/arrendadores/ContratoSheet.tsx:186`<br>`components/demo/arrendadores/ContratoSheet.tsx:194` | texto en pantalla · rótulo | Por definir | To be defined |
| `arrendadores.comun.completar` | `app/(app)/(shell)/arrendadores/page.tsx:463`<br>`app/(app)/(shell)/arrendadores/page.tsx:1091` | texto en pantalla | Completar | Complete |
| `arrendadores.comun.completar-informacion` | `components/demo/arrendadores/ContratoSheet.tsx:164`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:165` | botón · texto en pantalla | Completar información | Complete information |
| `arrendadores.comun.agregar` | `components/demo/arrendadores/GestionRazonesSociales.tsx:261`<br>`components/demo/arrendadores/LicenciasCard.tsx:80` | botón | Agregar | Add |
| `arrendadores.comun.no-guardar-contrato` | `components/demo/arrendadores/ContratoSheet.tsx:693` | mensaje de error | No se pudo guardar el contrato | Could not save the contract |
| `arrendadores.comun.revisa-rojo` | `components/demo/arrendadores/ContratoSheet.tsx:899`<br>`components/demo/arrendadores/CambiosContrato.tsx:408` | texto en pantalla | Revisa los campos marcados en rojo. | Review the fields marked in red. |
| `arrendadores.comun.sin-razon` | `app/(app)/(shell)/arrendadores/page.tsx:782`<br>`components/demo/arrendadores/CambiosContrato.tsx:480`<br>`components/demo/arrendadores/GestionRazonesSociales.tsx:241` | texto en pantalla · opción de un selector | Sin razón social | No legal name |
| `arrendadores.comun.la-paga` | `components/demo/arrendadores/ContratoSheet.tsx:213`<br>`components/demo/arrendadores/CambiosContrato.tsx:488` | texto en pantalla · rótulo | La paga | Paid by |
| `arrendadores.comun.la-que-arrienda` | `components/demo/arrendadores/ContratoSheet.tsx:523`<br>`components/demo/arrendadores/ContratoSheet.tsx:853` | opción de un selector | ␣— la que arrienda | ␣— the one that leases |
| `arrendadores.comun.con-cual-se-paga` | `components/demo/arrendadores/ContratoSheet.tsx:499`<br>`components/demo/arrendadores/ContratoSheet.tsx:844` | título / tooltip · rótulo | Con cuál de tus razones sociales se paga | Which of your legal entities pays it |
| `arrendadores.comun.periodicidad` | `components/demo/arrendadores/ContratoSheet.tsx:188`<br>`components/demo/arrendadores/CambiosContrato.tsx:530`<br>`components/demo/arrendadores/PanelFirmas.tsx:330` | rótulo · texto en pantalla | Periodicidad | Frequency |
| `arrendadores.comun.vigencia` | `components/demo/arrendadores/ContratoSheet.tsx:197`<br>`components/demo/arrendadores/PanelFirmas.tsx:338` | rótulo · texto en pantalla | Vigencia | Term |
| `arrendadores.comun.deposito` | `components/demo/arrendadores/CambiosContrato.tsx:548`<br>`components/demo/arrendadores/PanelFirmas.tsx:341` | rótulo · texto en pantalla | Depósito | Security deposit |
| `arrendadores.comun.motivo` | `components/demo/arrendadores/CambiosContrato.tsx:148`<br>`components/demo/arrendadores/CambiosContrato.tsx:232` | texto en pantalla | «{motivo}» | “{motivo}” |
| `arrendadores.comun.hoy` | `app/(app)/(shell)/arrendadores/page.tsx:438` | texto en pantalla | hoy | today |
| `arrendadores.comun.en-dias` | `app/(app)/(shell)/arrendadores/page.tsx:439` | texto en pantalla | en {n} d | in {n} d |
| `arrendadores.comun.mes` | `components/demo/arrendadores/CompromisoRentaCard.tsx:73` | texto en pantalla | /mes | /mo |
| `arrendadores.comun.monto-mes` | `components/demo/arrendadores/CompromisoRentaCard.tsx:107` | texto en pantalla | {monto}/mes | {monto}/mo |
| `arrendadores.comun.confirmar-renovar` | `components/demo/arrendadores/ContratoSheet.tsx:390` | subtítulo | Confirmar y renovar | Confirm and renew |
| `arrendadores.falta.arrendador` | `components/demo/arrendadores/etiquetas.ts:29` | etiqueta de un valor (mapa de claves) | arrendador | landlord |
| `arrendadores.falta.vigencia` | `components/demo/arrendadores/etiquetas.ts:30` | etiqueta de un valor (mapa de claves) | vigencia | term |
| `arrendadores.falta.importe` | `components/demo/arrendadores/etiquetas.ts:31` | etiqueta de un valor (mapa de claves) | importe | amount |
| `arrendadores.falta.periodicidad` | `components/demo/arrendadores/etiquetas.ts:32` | etiqueta de un valor (mapa de claves) | periodicidad | frequency |
| `arrendadores.falta.y` | `components/demo/arrendadores/etiquetas.ts:42` | etiqueta de un valor (mapa de claves) | {lista} y {ultimo} | {lista} and {ultimo} |
| `arrendadores.vence.hoy` | `components/demo/arrendadores/etiquetas.ts:20` | etiqueta de un valor (mapa de claves) | hoy | today |
| `arrendadores.vence.en.uno` | `components/demo/arrendadores/etiquetas.ts:21` | etiqueta de un valor (mapa de claves) | en {n} día | in {n} day |
| `arrendadores.vence.en.otros` | `components/demo/arrendadores/etiquetas.ts:21` | etiqueta de un valor (mapa de claves) | en {n} días | in {n} days |
| `arrendadores.vence.hace.uno` | `components/demo/arrendadores/etiquetas.ts:23` | etiqueta de un valor (mapa de claves) | hace {n} día | {n} day ago |
| `arrendadores.vence.hace.otros` | `components/demo/arrendadores/etiquetas.ts:23` | etiqueta de un valor (mapa de claves) | hace {n} días | {n} days ago |
| `arrendadores.subtitulo` | `app/(app)/(shell)/arrendadores/page.tsx:195` | subtítulo | El otro lado de la red · contratos, rentas y vencimientos | The other side of the network · contracts, rents and expirations |
| `arrendadores.descarga.ninguno` | `app/(app)/(shell)/arrendadores/page.tsx:87` | aviso emergente | No hay contratos vigentes que descargar | There are no active contracts to download |
| `arrendadores.descarga.hecha.uno` | `app/(app)/(shell)/arrendadores/page.tsx:88` | aviso emergente | Descargados {n} contrato vigente | Downloaded {n} active contract |
| `arrendadores.descarga.hecha.otros` | `app/(app)/(shell)/arrendadores/page.tsx:88` | aviso emergente | Descargados {n} contratos vigentes | Downloaded {n} active contracts |
| `arrendadores.descarga.error` | `app/(app)/(shell)/arrendadores/page.tsx:91` | aviso emergente | No se pudo generar el archivo | Could not generate the file |
| `arrendadores.nuevo` | `app/(app)/(shell)/arrendadores/page.tsx:200`<br>`app/(app)/(shell)/arrendadores/page.tsx:645` | botón · título / tooltip | Nuevo arrendador | New landlord |
| `arrendadores.nuevo-contrato` | `app/(app)/(shell)/arrendadores/page.tsx:203` | botón | Nuevo contrato | New contract |
| `arrendadores.buscar` | `app/(app)/(shell)/arrendadores/page.tsx:217` | texto de ejemplo (placeholder) | Buscar arrendador, pantalla o RFC… | Search landlord, screen or RFC… |
| `arrendadores.todos` | `app/(app)/(shell)/arrendadores/page.tsx:226` | opción de un selector | Todos los arrendadores | All landlords |
| `arrendadores.contratos-todos` | `app/(app)/(shell)/arrendadores/page.tsx:236` | opción de un selector | Contratos: todos | Contracts: all |
| `arrendadores.filtrados` | `app/(app)/(shell)/arrendadores/page.tsx:246` | texto en pantalla | {n} de {total} contratos | {n} of {total} contracts |
| `arrendadores.kpi.por-capturar` | `app/(app)/(shell)/arrendadores/page.tsx:284` | subtítulo | + {n} por capturar | + {n} to enter |
| `arrendadores.kpi.activos.uno` | `app/(app)/(shell)/arrendadores/page.tsx:285` | subtítulo | {n} contrato activo | {n} active contract |
| `arrendadores.kpi.activos.otros` | `app/(app)/(shell)/arrendadores/page.tsx:285` | subtítulo | {n} contratos activos | {n} active contracts |
| `arrendadores.kpi.de-arrendadores.uno` | `app/(app)/(shell)/arrendadores/page.tsx:293` | subtítulo | de {n} arrendador | from {n} landlord |
| `arrendadores.kpi.de-arrendadores.otros` | `app/(app)/(shell)/arrendadores/page.tsx:293` | subtítulo | de {n} arrendadores | from {n} landlords |
| `arrendadores.kpi.por-vencer` | `app/(app)/(shell)/arrendadores/page.tsx:299` | rótulo | Por vencer | Expiring soon |
| `arrendadores.kpi.por-vencer.sub` | `app/(app)/(shell)/arrendadores/page.tsx:301` | subtítulo | contratos que hay que renovar o terminar | contracts to renew or end |
| `arrendadores.kpi.renta-vencida` | `app/(app)/(shell)/arrendadores/page.tsx:306` | rótulo | Renta vencida | Overdue rent |
| `arrendadores.kpi.renta-vencida.sub` | `app/(app)/(shell)/arrendadores/page.tsx:308` | subtítulo | pagos de renta vencidos | overdue rent payments |
| `arrendadores.incompletos.uno` | `app/(app)/(shell)/arrendadores/page.tsx:328` | texto en pantalla | La renta mensual no incluye {n} contrato incompleto, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contract, so the real cost is higher. |
| `arrendadores.incompletos.otros` | `app/(app)/(shell)/arrendadores/page.tsx:328` | texto en pantalla | La renta mensual no incluye {n} contratos incompletos, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contracts, so the real cost is higher. |
| `arrendadores.incompletos.falta.uno` | `app/(app)/(shell)/arrendadores/page.tsx:324` | texto en pantalla | La renta mensual no incluye {n} contrato incompleto: falta capturar {falta}, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contract (still missing: {falta}), so the real cost is higher. |
| `arrendadores.incompletos.falta.otros` | `app/(app)/(shell)/arrendadores/page.tsx:324` | texto en pantalla | La renta mensual no incluye {n} contratos incompletos: falta capturar {falta}, así que el costo real es mayor. | The monthly rent doesn’t include {n} incomplete contracts (still missing: {falta}), so the real cost is higher. |
| `arrendadores.contratos.titulo` | `app/(app)/(shell)/arrendadores/page.tsx:343` | título | Contratos de arrendamiento | Lease agreements |
| `arrendadores.contratos.excel` | `app/(app)/(shell)/arrendadores/page.tsx:356` | texto en pantalla | Vigentes en Excel | Active ones in Excel |
| `arrendadores.contratos.excel-title` | `app/(app)/(shell)/arrendadores/page.tsx:354` | título / tooltip | Descargar los contratos vigentes en Excel | Download the active contracts in Excel |
| `arrendadores.contratos.sitio` | `app/(app)/(shell)/arrendadores/page.tsx:372` | cabecera de columna | Sitio | Site |
| `arrendadores.contratos.vendida-en` | `app/(app)/(shell)/arrendadores/page.tsx:407` | texto en pantalla | Vendida en {lista} | Sold in {lista} |
| `arrendadores.contratos.vendida-item` | `app/(app)/(shell)/arrendadores/page.tsx:408` | texto en pantalla | «{nombre}» | “{nombre}” |
| `arrendadores.nuevo-contrato.titulo` | `app/(app)/(shell)/arrendadores/page.tsx:524` | título / tooltip | Nuevo contrato de arrendamiento | New lease agreement |
| `arrendadores.nuevo-contrato.sub` | `app/(app)/(shell)/arrendadores/page.tsx:525` | título / tooltip | Arrendador → contrato (fechas pasadas permitidas) → pantalla | Landlord → contract (past dates allowed) → screen |
| `arrendadores.alta.razon-fallo` | `app/(app)/(shell)/arrendadores/page.tsx:617` | aviso emergente | Arrendador creado, pero su razón social no: {error}. Agrégala desde su ficha. | Landlord created, but not its legal name: {error}. Add it from its profile. |
| `arrendadores.alta.error-desconocido` | `app/(app)/(shell)/arrendadores/page.tsx:618` | aviso emergente | error desconocido | unknown error |
| `arrendadores.alta.agregado` | `app/(app)/(shell)/arrendadores/page.tsx:625` | aviso emergente | Propietario agregado | Landlord added |
| `arrendadores.alta.sub` | `app/(app)/(shell)/arrendadores/page.tsx:646` | título / tooltip | Alta de arrendador (dueño del predio) | Add a landlord (owner of the property) |
| `arrendadores.alta.crear-igual` | `app/(app)/(shell)/arrendadores/page.tsx:653` | botón | Crear de todos modos | Create anyway |
| `arrendadores.alta.repetido` | `app/(app)/(shell)/arrendadores/page.tsx:675` | texto en pantalla | Si te equivocaste, cierra y búscalo en la lista; si de verdad es otro propietario distinto, vuelve a pulsar. | If it was a mistake, close and look for it in the list; if it really is a different landlord, click again. |
| `arrendadores.alta.rfc-malo` | `app/(app)/(shell)/arrendadores/page.tsx:685` | mensaje de error | Formato inválido. Son 3 letras (empresa) o 4 (persona), fecha AAMMDD y 3 caracteres de homoclave. | Invalid format. It’s 3 letters (company) or 4 (person), a YYMMDD date and 3 homoclave characters. |
| `arrendadores.alta.domicilio-ph` | `app/(app)/(shell)/arrendadores/page.tsx:709` | texto de ejemplo (placeholder) | Calle, número, colonia, CP, ciudad, estado | Street, number, neighborhood, ZIP code, city, state |
| `arrendadores.alta.domicilio-ayuda` | `app/(app)/(shell)/arrendadores/page.tsx:714` | texto en pantalla | El contrato de arrendamiento lo necesita para las notificaciones. Sin él, el documento sale con ese hueco en blanco. | The lease agreement needs it for notices. Without it, the document comes out with that gap left blank. |
| `arrendadores.alta.fiscales` | `app/(app)/(shell)/arrendadores/page.tsx:722` | texto en pantalla | Datos fiscales | Tax details |
| `arrendadores.alta.fiscales-ayuda` | `app/(app)/(shell)/arrendadores/page.tsx:724` | texto en pantalla | Es a quien se le factura la renta. Si lo dejas en blanco, el arrendador queda dado de alta igual y puedes capturarlo después desde su ficha. | It’s who the rent is invoiced to. If you leave it blank, the landlord is added anyway and you can enter it later from its profile. |
| `arrendadores.alta.regimen-ayuda` | `app/(app)/(shell)/arrendadores/page.tsx:745` | texto en pantalla | Se habilita al capturar la razón social: el régimen es de ella. | It’s enabled once you enter the legal name: the regime belongs to it. |
| `arrendadores.por-razon.titulo` | `app/(app)/(shell)/arrendadores/page.tsx:787` | título | Por razón social | By legal name |
| `arrendadores.por-razon.vacio` | `app/(app)/(shell)/arrendadores/page.tsx:789` | texto en pantalla | — Sin razones sociales dadas de alta. | — No legal names added. |
| `arrendadores.por-razon.pagos-vencidos` | `app/(app)/(shell)/arrendadores/page.tsx:800` | cabecera de columna | Pagos vencidos | Overdue payments |
| `arrendadores.rentabilidad.titulo` | `app/(app)/(shell)/arrendadores/page.tsx:854` | título | Rentabilidad por pantalla | Profitability by screen |
| `arrendadores.rentabilidad.sub` | `app/(app)/(shell)/arrendadores/page.tsx:855` | título | Margen mensual = ingreso de reservas vigentes − renta del arrendador. Las de margen negativo son candidatas a renegociar o dar de baja. | Monthly margin = revenue from active bookings − landlord rent. Those with a negative margin are candidates to renegotiate or drop. |
| `arrendadores.rentabilidad.sin-filtro` | `app/(app)/(shell)/arrendadores/page.tsx:865` | texto en pantalla | Ninguna pantalla coincide con el filtro. | No screen matches the filter. |
| `arrendadores.rentabilidad.vacio` | `app/(app)/(shell)/arrendadores/page.tsx:866` | texto en pantalla | Sin contratos ni reservas activas todavía. | No contracts or active bookings yet. |
| `arrendadores.rentabilidad.ingreso` | `app/(app)/(shell)/arrendadores/page.tsx:877` | cabecera de columna | Ingreso/mes | Revenue/mo |
| `arrendadores.rentabilidad.renta` | `app/(app)/(shell)/arrendadores/page.tsx:878` | cabecera de columna | Renta/mes | Rent/mo |
| `arrendadores.rentabilidad.margen` | `app/(app)/(shell)/arrendadores/page.tsx:879` | cabecera de columna | Margen/mes | Margin/mo |
| `arrendadores.rentabilidad.sin-contrato` | `app/(app)/(shell)/arrendadores/page.tsx:887` | texto en pantalla | sin contrato de renta | no rent contract |
| `arrendadores.lista.rfc-malo` | `app/(app)/(shell)/arrendadores/page.tsx:955` | aviso emergente | El RFC no tiene un formato válido | The RFC doesn’t have a valid format |
| `arrendadores.lista.actualizado` | `app/(app)/(shell)/arrendadores/page.tsx:964` | aviso emergente | Propietario actualizado | Landlord updated |
| `arrendadores.lista.sub` | `app/(app)/(shell)/arrendadores/page.tsx:977` | título | Dueños de predio dados de alta. | Property owners on record. |
| `arrendadores.lista.sin-filtro` | `app/(app)/(shell)/arrendadores/page.tsx:992` | texto en pantalla | Ningún arrendador coincide con el filtro. | No landlord matches the filter. |
| `arrendadores.lista.vacio` | `app/(app)/(shell)/arrendadores/page.tsx:993` | texto en pantalla | Aún no hay arrendadores. Usa {boton} para dar de alta uno. | There are no landlords yet. Use {boton} to add one. |
| `arrendadores.lista.vacio-boton` | `app/(app)/(shell)/arrendadores/page.tsx:993` | texto en pantalla | “Nuevo arrendador” | “New landlord” |
| `arrendadores.lista.contacto` | `app/(app)/(shell)/arrendadores/page.tsx:1006` | cabecera de columna | Contacto | Contact |
| `arrendadores.lista.domicilio-ph` | `app/(app)/(shell)/arrendadores/page.tsx:1047` | texto de ejemplo (placeholder) | Calle, número, colonia, CP, ciudad | Street, number, neighborhood, ZIP code, city |
| `arrendadores.lista.falta` | `app/(app)/(shell)/arrendadores/page.tsx:1038`<br>`app/(app)/(shell)/arrendadores/page.tsx:1051` | texto en pantalla | Falta | Missing |
| `arrendadores.lista.activos-title` | `app/(app)/(shell)/arrendadores/page.tsx:1063` | título / tooltip | {activos} activo(s) de {total}. Solo los activos impiden dar de baja. | {activos} active out of {total}. Only active ones prevent deactivation. |
| `arrendadores.lista.predios-title` | `app/(app)/(shell)/arrendadores/page.tsx:1069` | título / tooltip | Un propietario con predios a su nombre no se puede dar de baja. | A landlord with properties in their name can’t be deactivated. |
| `arrendadores.baja.aria` | `app/(app)/(shell)/arrendadores/page.tsx:1103`<br>`app/(app)/(shell)/arrendadores/page.tsx:1198` | etiqueta accesible (aria-label) · título / tooltip | Dar de baja a {nombre} | Deactivate {nombre} |
| `arrendadores.baja.boton` | `app/(app)/(shell)/arrendadores/page.tsx:1104`<br>`app/(app)/(shell)/arrendadores/page.tsx:1210` | título / tooltip · texto en pantalla | Dar de baja | Deactivate |
| `arrendadores.baja.hecha` | `app/(app)/(shell)/arrendadores/page.tsx:1184` | aviso emergente | Propietario dado de baja | Landlord deactivated |
| `arrendadores.baja.error` | `app/(app)/(shell)/arrendadores/page.tsx:1189` | mensaje de error | No se pudo dar de baja al propietario | Could not deactivate the landlord |
| `arrendadores.baja.sub` | `app/(app)/(shell)/arrendadores/page.tsx:1199` | título / tooltip | Deja de aparecer en la aplicación y no se puede reactivar desde aquí | Stops appearing in the app and can’t be reactivated from here |
| `arrendadores.baja.dando` | `app/(app)/(shell)/arrendadores/page.tsx:1210` | texto en pantalla | Dando de baja… | Deactivating… |
| `arrendadores.baja.confirmar` | `app/(app)/(shell)/arrendadores/page.tsx:1210` | texto en pantalla | Confirmar y dar de baja | Confirm and deactivate |
| `arrendadores.baja.pide-clave` | `app/(app)/(shell)/arrendadores/page.tsx:1219` | texto en pantalla | Dar de baja a un propietario no se puede deshacer desde la aplicación, así que hace falta tu contraseña. | Deactivating a landlord can’t be undone from the app, so your password is needed. |
| `arrendadores.baja.tu-clave` | `app/(app)/(shell)/arrendadores/page.tsx:1222` | texto en pantalla | Tu contraseña | Your password |
| `arrendadores.baja.dejara` | `app/(app)/(shell)/arrendadores/page.tsx:1237` | texto en pantalla | {nombre} dejará de aparecer en Arrendadores y no podrá elegirse en contratos nuevos. | {nombre} will stop appearing in Landlords and can’t be chosen for new contracts. |
| `arrendadores.baja.conserva` | `app/(app)/(shell)/arrendadores/page.tsx:1243` | texto en pantalla | Sus contratos y pagos anteriores se conservan. Para volver a verlo hace falta alguien con acceso a la base de datos. | Their past contracts and payments are kept. Bringing them back requires someone with database access. |
| `arrendadores.razones.agregada.uno` | `components/demo/arrendadores/GestionRazonesSociales.tsx:125` | aviso emergente (éxito) | Razón social agregada · se asignó a {n} contrato que no tenía ninguna | Legal name added · assigned to {n} contract that had none |
| `arrendadores.razones.agregada.otros` | `components/demo/arrendadores/GestionRazonesSociales.tsx:125` | aviso emergente (éxito) | Razón social agregada · se asignó a {n} contratos que no tenían ninguna | Legal name added · assigned to {n} contracts that had none |
| `arrendadores.razones.agregada` | `components/demo/arrendadores/GestionRazonesSociales.tsx:128` | texto en pantalla | Razón social agregada | Legal name added |
| `arrendadores.razones.actualizada` | `components/demo/arrendadores/GestionRazonesSociales.tsx:132` | aviso emergente (éxito) | Razón social actualizada | Legal name updated |
| `arrendadores.razones.eliminada` | `components/demo/arrendadores/GestionRazonesSociales.tsx:146` | aviso emergente (éxito) | Razón social eliminada | Legal name deleted |
| `arrendadores.razones.no-eliminar` | `components/demo/arrendadores/GestionRazonesSociales.tsx:148` | aviso emergente (éxito) | No se pudo eliminar | Could not delete |
| `arrendadores.razones.nombre-ph` | `components/demo/arrendadores/GestionRazonesSociales.tsx:162` | texto de ejemplo (placeholder) | Nombre o denominación fiscal | Name or registered business name |
| `arrendadores.razones.rfc-malo` | `components/demo/arrendadores/GestionRazonesSociales.tsx:187` | texto en pantalla | El RFC no tiene un formato válido (3–4 letras, 6 dígitos de fecha y 3 caracteres). | The RFC doesn’t have a valid format (3–4 letters, 6 date digits and 3 characters). |
| `arrendadores.razones.sub` | `components/demo/arrendadores/GestionRazonesSociales.tsx:214` | título | A nombre de quién factura cada arrendador. Un mismo arrendador puede tener varias; el contrato elige cuál usa. | Whose name each landlord invoices under. One landlord can have several; the contract chooses which one it uses. |
| `arrendadores.razones.sin-n` | `components/demo/arrendadores/GestionRazonesSociales.tsx:218` | texto en pantalla | {n} sin razón social | {n} without a legal name |
| `arrendadores.razones.sin-arrendadores` | `components/demo/arrendadores/GestionRazonesSociales.tsx:226` | texto en pantalla | Aún no hay arrendadores dados de alta. | There are no landlords yet. |
| `arrendadores.razones.aviso-varios` | `components/demo/arrendadores/GestionRazonesSociales.tsx:234` | texto en pantalla | Sin razón social, los contratos de estos arrendadores no podrán anclar a quién se factura. | Without a legal name, these landlords’ contracts can’t pin down who is invoiced. |
| `arrendadores.razones.agregar-flecha` | `components/demo/arrendadores/GestionRazonesSociales.tsx:245` | botón | Agregar → | Add → |
| `arrendadores.razones.aviso-uno` | `components/demo/arrendadores/GestionRazonesSociales.tsx:272` | texto en pantalla | Sin razón social. Los contratos de este arrendador no podrán anclar a quién se factura. | No legal name. This landlord’s contracts can’t pin down who is invoiced. |
| `arrendadores.razones.regimen` | `components/demo/arrendadores/GestionRazonesSociales.tsx:288` | texto en pantalla | Régimen: | Regime: |
| `arrendadores.razones.falta` | `components/demo/arrendadores/GestionRazonesSociales.tsx:286`<br>`components/demo/arrendadores/GestionRazonesSociales.tsx:288` | texto en pantalla | falta | missing |
| `arrendadores.razones.facturan.uno` | `components/demo/arrendadores/GestionRazonesSociales.tsx:294` | texto en pantalla | {n} contrato factura aquí | {n} contract invoices here |
| `arrendadores.razones.facturan.otros` | `components/demo/arrendadores/GestionRazonesSociales.tsx:295` | texto en pantalla | {n} contratos facturan aquí | {n} contracts invoice here |
| `arrendadores.razones.no-borrar` | `components/demo/arrendadores/GestionRazonesSociales.tsx:316` | texto en pantalla | Hay contratos que facturan a esta razón social | There are contracts invoiced to this legal name |
| `arrendadores.incidencia.legal` | `components/demo/arrendadores/etiquetas.ts:54` | etiqueta de un valor (mapa de claves) | Legal / permiso | Legal / permit |
| `arrendadores.incidencia.mantenimiento` | `components/demo/arrendadores/etiquetas.ts:55` | etiqueta de un valor (mapa de claves) | Mantenimiento | Maintenance |
| `arrendadores.incidencia.vandalismo` | `components/demo/arrendadores/etiquetas.ts:56` | etiqueta de un valor (mapa de claves) | Vandalismo | Vandalism |
| `arrendadores.incidencia.clima` | `components/demo/arrendadores/etiquetas.ts:57` | etiqueta de un valor (mapa de claves) | Clima | Weather |
| `arrendadores.incidencia.suspension` | `components/demo/arrendadores/etiquetas.ts:58` | etiqueta de un valor (mapa de claves) | Suspensión operativa | Operational suspension |
| `arrendadores.incidencia.accidente` | `components/demo/arrendadores/etiquetas.ts:59` | etiqueta de un valor (mapa de claves) | Accidente | Accident |
| `arrendadores.incidencia.otro` | `components/demo/arrendadores/etiquetas.ts:60` | etiqueta de un valor (mapa de claves) | Otro | Other |
| `arrendadores.ficha.contrato` | `components/demo/arrendadores/ContratoSheet.tsx:110` | título / tooltip | Contrato | Contract |
| `arrendadores.ficha.reportar` | `components/demo/arrendadores/ContratoSheet.tsx:115`<br>`components/demo/arrendadores/ContratoSheet.tsx:1241` | botón · título / tooltip | Reportar incidencia | Report incident |
| `arrendadores.ficha.renovacion-iniciada` | `components/demo/arrendadores/ContratoSheet.tsx:142` | aviso emergente | Renovación iniciada | Renewal started |
| `arrendadores.ficha.no-renovar` | `components/demo/arrendadores/ContratoSheet.tsx:144` | aviso emergente | No se pudo iniciar la renovación | Could not start the renewal |
| `arrendadores.ficha.renovar` | `components/demo/arrendadores/ContratoSheet.tsx:148` | texto en pantalla | Renovar | Renew |
| `arrendadores.ficha.incompleto` | `components/demo/arrendadores/ContratoSheet.tsx:158` | texto en pantalla | Este contrato se abrió automáticamente al vender la pantalla, para que no quedara sin registro. Falta capturar el arrendador, el importe de la renta, la periodicidad y la fecha de fin. Mientras tanto no cuenta como costo en el P&L ni genera calendario de pagos. | This contract was opened automatically when the screen was sold, so it wouldn’t be left unrecorded. The landlord, the rent amount, the payment frequency and the end date still have to be entered. Until then it doesn’t count as a cost in the P&L and doesn’t generate a payment schedule. |
| `arrendadores.ficha.contrato-arrendamiento` | `components/demo/arrendadores/ContratoSheet.tsx:181` | título | Contrato de arrendamiento | Lease agreement |
| `arrendadores.ficha.por-definir` | `components/demo/arrendadores/ContratoSheet.tsx:197` | rótulo | por definir | to be defined |
| `arrendadores.ficha.tiempo-restante` | `components/demo/arrendadores/ContratoSheet.tsx:199` | rótulo | Tiempo restante | Time remaining |
| `arrendadores.ficha.vencido` | `components/demo/arrendadores/ContratoSheet.tsx:200` | texto en pantalla | Vencido | Expired |
| `arrendadores.ficha.renovacion` | `components/demo/arrendadores/ContratoSheet.tsx:202`<br>`components/demo/arrendadores/CambiosContrato.tsx:563` | rótulo · texto en pantalla | Renovación automática | Automatic renewal |
| `arrendadores.ficha.cambiar` | `components/demo/arrendadores/ContratoSheet.tsx:221` | texto en pantalla | Cambiar | Change |
| `arrendadores.ficha.generar` | `components/demo/arrendadores/ContratoSheet.tsx:236` | texto en pantalla | Generar contrato | Generate contract |
| `arrendadores.ficha.ver-firmado` | `components/demo/arrendadores/ContratoSheet.tsx:248` | texto en pantalla | Ver documento firmado (PDF) | View signed document (PDF) |
| `arrendadores.ficha.pagos` | `components/demo/arrendadores/ContratoSheet.tsx:270`<br>`components/demo/arrendadores/PagosRentaCard.tsx:96` | título · texto en pantalla | Pagos de renta | Rent payments |
| `arrendadores.ficha.sin-pagos` | `components/demo/arrendadores/ContratoSheet.tsx:272` | texto en pantalla | Sin pagos registrados. | No payments recorded. |
| `arrendadores.ficha.factura` | `components/demo/arrendadores/ContratoSheet.tsx:294` | texto en pantalla | Factura | Invoice |
| `arrendadores.ficha.comprobante` | `components/demo/arrendadores/ContratoSheet.tsx:304` | texto en pantalla | Comprobante | Proof of payment |
| `arrendadores.ficha.adjuntos` | `components/demo/arrendadores/ContratoSheet.tsx:314` | botón | Adjuntos | Attachments |
| `arrendadores.ficha.registrar` | `components/demo/arrendadores/ContratoSheet.tsx:316` | texto en pantalla | Registrar | Record |
| `arrendadores.ficha.ruc` | `components/demo/arrendadores/ContratoSheet.tsx:332` | rótulo | RUC | Tax ID (RUC) |
| `arrendadores.ficha.correo` | `components/demo/arrendadores/ContratoSheet.tsx:333`<br>`components/demo/arrendadores/ContratoSheet.tsx:761` | rótulo | Correo | Email |
| `arrendadores.ficha.incidencia-reportada` | `components/demo/arrendadores/ContratoSheet.tsx:348` | aviso emergente | Incidencia reportada · {nombre} bloqueado en Comercial | Incident reported · {nombre} blocked in Sales |
| `arrendadores.ficha.renovar-sensible` | `components/demo/arrendadores/ContratoSheet.tsx:389` | título | Renovar un contrato es un cambio sensible: tu organización pide que vuelvas a identificarte. | Renewing a contract is a sensitive change: your organization asks you to confirm your identity again. |
| `arrendadores.pagadora.asignada` | `components/demo/arrendadores/ContratoSheet.tsx:476` | aviso emergente | Razón social asignada al contrato | Legal entity assigned to the contract |
| `arrendadores.pagadora.sin` | `components/demo/arrendadores/ContratoSheet.tsx:477` | aviso emergente | El contrato quedó sin razón social asignada | The contract was left without an assigned legal entity |
| `arrendadores.pagadora.sub` | `components/demo/arrendadores/ContratoSheet.tsx:500` | título / tooltip | Solo cambia a nombre de quién sale esta renta. No toca el importe. | It only changes whose name this rent is paid under. It doesn’t touch the amount. |
| `arrendadores.pagadora.sin-entidades` | `components/demo/arrendadores/ContratoSheet.tsx:529` | texto en pantalla | Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales. | You don’t have any legal entities yet. They are added in Legal entities. |
| `arrendadores.pagadora.sin-asignar` | `components/demo/arrendadores/ContratoSheet.tsx:534` | texto en pantalla | Dejarlo sin asignar es legítimo: el contrato es un acuerdo real aunque todavía no se haya decidido con qué sociedad se paga. | Leaving it unassigned is legitimate: the contract is a real agreement even if it hasn’t been decided yet which company pays it. |
| `arrendadores.completar.falta-razon` | `components/demo/arrendadores/ContratoSheet.tsx:637` | texto en pantalla | razón social | legal name |
| `arrendadores.completar.falta-rfc` | `components/demo/arrendadores/ContratoSheet.tsx:638` | texto en pantalla | RFC | RFC (tax ID) |
| `arrendadores.completar.falta-regimen` | `components/demo/arrendadores/ContratoSheet.tsx:639` | texto en pantalla | régimen fiscal | tax regime |
| `arrendadores.completar.hecho` | `components/demo/arrendadores/ContratoSheet.tsx:699` | aviso emergente | Contrato completado · se generó su calendario de pagos | Contract completed · its payment schedule was generated |
| `arrendadores.completar.titulo` | `components/demo/arrendadores/ContratoSheet.tsx:721` | título / tooltip | Completar contrato de arrendamiento | Complete lease agreement |
| `arrendadores.completar.sub` | `components/demo/arrendadores/ContratoSheet.tsx:722` | título / tooltip | Los cuatro datos que faltan para que cuente como acuerdo real | The four details missing for it to count as a real agreement |
| `arrendadores.completar.guardar` | `components/demo/arrendadores/ContratoSheet.tsx:734` | texto en pantalla | Guardar contrato | Save contract |
| `arrendadores.completar.elige` | `components/demo/arrendadores/ContratoSheet.tsx:746` | opción de un selector | Elige el arrendador… | Choose the landlord… |
| `arrendadores.completar.varias` | `components/demo/arrendadores/ContratoSheet.tsx:766` | texto en pantalla | Tiene {n} razones sociales; se muestra la primera. Cuál factura este contrato se elige en su ficha. | It has {n} legal names; the first one is shown. Which one invoices this contract is chosen in its profile. |
| `arrendadores.completar.le-falta` | `components/demo/arrendadores/ContratoSheet.tsx:773` | texto en pantalla | Le falta {lista}. Puedes guardar el contrato igual, pero sin eso no se le podrá facturar la renta cuando toque pagarle. | It’s missing {lista}. You can save the contract anyway, but without it the rent can’t be invoiced when it’s time to pay. |
| `arrendadores.completar.importe` | `components/demo/arrendadores/ContratoSheet.tsx:782` | rótulo | Importe de la renta | Rent amount |
| `arrendadores.completar.importe-cero` | `components/demo/arrendadores/ContratoSheet.tsx:785` | mensaje de error | Captura un importe mayor que cero | Enter an amount greater than zero |
| `arrendadores.completar.cada-cuando` | `components/demo/arrendadores/ContratoSheet.tsx:796` | rótulo | Cada cuándo se paga | Payment frequency |
| `arrendadores.completar.desde` | `components/demo/arrendadores/ContratoSheet.tsx:810` | rótulo | Desde | From |
| `arrendadores.completar.hasta` | `components/demo/arrendadores/ContratoSheet.tsx:820` | rótulo | Hasta | To |
| `arrendadores.completar.antes-inicio` | `components/demo/arrendadores/ContratoSheet.tsx:825` | mensaje de error | No puede ser anterior al inicio ({fecha}) | Can’t be earlier than the start ({fecha}) |
| `arrendadores.completar.sin-entidades` | `components/demo/arrendadores/ContratoSheet.tsx:859` | texto en pantalla | Todavía no tienes razones sociales capturadas. Se pueden dar de alta en Razones sociales, y el contrato se guarda igual mientras tanto. | You don’t have any legal entities yet. They can be added in Legal entities, and the contract is saved anyway in the meantime. |
| `arrendadores.completar.sin-asignar` | `components/demo/arrendadores/ContratoSheet.tsx:863` | texto en pantalla | Se puede dejar sin asignar: el contrato es un acuerdo real aunque todavía no se haya decidido con qué sociedad se paga. | It can be left unassigned: the contract is a real agreement even if it hasn’t been decided yet which company pays it. |
| `arrendadores.completar.al-guardar` | `components/demo/arrendadores/ContratoSheet.tsx:871` | texto en pantalla | Al guardar, el contrato deja de estar incompleto: empieza a contar como costo de renta en el P&L y se genera su calendario de pagos. | When you save, the contract stops being incomplete: it starts counting as a rent cost in the P&L and its payment schedule is generated. |
| `arrendadores.completar.al-guardar-per` | `components/demo/arrendadores/ContratoSheet.tsx:870` | texto en pantalla | Al guardar, el contrato deja de estar incompleto: empieza a contar como costo de renta en el P&L y se genera su calendario de pagos {periodicidad}. | When you save, the contract stops being incomplete: it starts counting as a rent cost in the P&L and its payment schedule ({periodicidad}) is generated. |
| `arrendadores.adjunto.tipo` | `components/demo/arrendadores/ContratoSheet.tsx:936` | mensaje de error | Debe ser un PDF o una imagen (PNG, JPG o WebP) | It must be a PDF or an image (PNG, JPG or WebP) |
| `arrendadores.adjunto.tamano` | `components/demo/arrendadores/ContratoSheet.tsx:941` | mensaje de error | El archivo supera {mb} MB | The file exceeds {mb} MB |
| `arrendadores.adjunto.leer` | `components/demo/arrendadores/ContratoSheet.tsx:947` | mensaje de error | No se pudo leer el archivo | Could not read the file |
| `arrendadores.adjunto.listo` | `components/demo/arrendadores/ContratoSheet.tsx:959` | texto en pantalla | Archivo listo | File ready |
| `arrendadores.adjunto.quitar` | `components/demo/arrendadores/ContratoSheet.tsx:961`<br>`components/demo/arrendadores/ContratoSheet.tsx:987` | etiqueta accesible (aria-label) · texto en pantalla | Quitar | Remove |
| `arrendadores.adjunto.reemplazar` | `components/demo/arrendadores/ContratoSheet.tsx:969` | texto en pantalla | Reemplazar | Replace |
| `arrendadores.adjunto.adjuntar` | `components/demo/arrendadores/ContratoSheet.tsx:969` | texto en pantalla | Adjuntar | Attach |
| `arrendadores.adjunto.ver` | `components/demo/arrendadores/ContratoSheet.tsx:980` | texto en pantalla | Ver | View |
| `arrendadores.metodo.transferencia` | `components/demo/arrendadores/etiquetas.ts:65` | etiqueta de un valor (mapa de claves) | Transferencia | Bank transfer |
| `arrendadores.metodo.efectivo` | `components/demo/arrendadores/etiquetas.ts:66` | etiqueta de un valor (mapa de claves) | Efectivo | Cash |
| `arrendadores.metodo.cheque` | `components/demo/arrendadores/etiquetas.ts:67` | etiqueta de un valor (mapa de claves) | Cheque | Check |
| `arrendadores.metodo.tarjeta` | `components/demo/arrendadores/etiquetas.ts:68` | etiqueta de un valor (mapa de claves) | Tarjeta | Card |
| `arrendadores.metodo.otro` | `components/demo/arrendadores/etiquetas.ts:69` | etiqueta de un valor (mapa de claves) | Otro | Other |
| `arrendadores.pago.adjuntos-guardados` | `components/demo/arrendadores/ContratoSheet.tsx:1091` | aviso emergente | Adjuntos guardados | Attachments saved |
| `arrendadores.pago.registrado` | `components/demo/arrendadores/ContratoSheet.tsx:1091`<br>`components/demo/arrendadores/PagosRentaCard.tsx:178` | aviso emergente | Pago registrado | Payment recorded |
| `arrendadores.pago.adjuntos-titulo` | `components/demo/arrendadores/ContratoSheet.tsx:1113` | título / tooltip | Adjuntos del pago | Payment attachments |
| `arrendadores.pago.guardar-adjuntos` | `components/demo/arrendadores/ContratoSheet.tsx:1125` | texto en pantalla | Guardar adjuntos | Save attachments |
| `arrendadores.pago.pagado-el` | `components/demo/arrendadores/ContratoSheet.tsx:1134` | texto en pantalla | Pagado el {fecha}{metodo}. Aquí solo se adjuntan los documentos: el pago no se vuelve a registrar. | Paid on {fecha}{metodo}. Only the documents are attached here: the payment isn’t recorded again. |
| `arrendadores.pago.fecha` | `components/demo/arrendadores/ContratoSheet.tsx:1146` | rótulo | Fecha de pago | Payment date |
| `arrendadores.pago.metodo` | `components/demo/arrendadores/ContratoSheet.tsx:1149` | rótulo | Método de pago | Payment method |
| `arrendadores.pago.factura` | `components/demo/arrendadores/ContratoSheet.tsx:1160` | rótulo | Factura del arrendador | Landlord’s invoice |
| `arrendadores.pago.comprobante` | `components/demo/arrendadores/ContratoSheet.tsx:1168` | rótulo | Comprobante de pago | Proof of payment |
| `arrendadores.pago.observaciones` | `components/demo/arrendadores/ContratoSheet.tsx:1176` | rótulo | Observaciones | Notes |
| `arrendadores.pago.formato` | `components/demo/arrendadores/ContratoSheet.tsx:1184` | texto en pantalla | PDF o imagen, hasta {mb} MB por archivo. | PDF or image, up to {mb} MB per file. |
| `arrendadores.incidencia.bloquear` | `components/demo/arrendadores/ContratoSheet.tsx:1259` | texto en pantalla | Reportar y bloquear sitio | Report and block site |
| `arrendadores.incidencia.tipo` | `components/demo/arrendadores/ContratoSheet.tsx:1265`<br>`components/demo/arrendadores/LicenciasCard.tsx:209` | rótulo | Tipo | Type |
| `arrendadores.incidencia.descripcion` | `components/demo/arrendadores/ContratoSheet.tsx:1272` | rótulo | Descripción | Description |
| `arrendadores.incidencia.descripcion-ph` | `components/demo/arrendadores/ContratoSheet.tsx:1277` | texto de ejemplo (placeholder) | Describe la incidencia… | Describe the incident… |
| `arrendadores.incidencia.aviso` | `components/demo/arrendadores/ContratoSheet.tsx:1281` | texto en pantalla | Al reportar, el sitio pasa a {bloqueado} y aparece en rojo en el mapa de Comercial al instante. | When you report it, the site becomes {bloqueado} and shows up in red on the Sales map instantly. |
| `arrendadores.incidencia.bloqueado` | `components/demo/arrendadores/ContratoSheet.tsx:1282` | texto en pantalla | bloqueado | blocked |
| `arrendadores.parte.arrendador` | `components/demo/arrendadores/PanelFirmas.tsx:310`<br>`components/demo/arrendadores/etiquetas.ts:73` | texto en pantalla · etiqueta de un valor (mapa de claves) | El arrendador | The landlord |
| `arrendadores.parte.arrendatario` | `components/demo/arrendadores/etiquetas.ts:74` | etiqueta de un valor (mapa de claves) | Nosotros | Us |
| `arrendadores.cambios.no-historial` | `components/demo/arrendadores/CambiosContrato.tsx:96` | mensaje de error | No se pudo leer el historial | Could not read the history |
| `arrendadores.cambios.titulo` | `components/demo/arrendadores/CambiosContrato.tsx:112` | texto en pantalla | Cambios al contrato | Contract changes |
| `arrendadores.cambios.editar` | `components/demo/arrendadores/CambiosContrato.tsx:116` | botón | Editar términos | Edit terms |
| `arrendadores.cambios.ya-firmado` | `components/demo/arrendadores/CambiosContrato.tsx:122` | texto en pantalla | Ya está firmado. Si cambias sus términos, esta versión se archiva tal como se firmó y el contrato se vuelve a firmar con los datos actuales. | It’s already signed. If you change its terms, this version is archived exactly as it was signed and the contract is signed again with the current data. |
| `arrendadores.cambios.vacio` | `components/demo/arrendadores/CambiosContrato.tsx:127` | texto en pantalla | Sin cambios registrados desde que se dio de alta. | No changes recorded since it was created. |
| `arrendadores.cambios.lo-propuso` | `components/demo/arrendadores/CambiosContrato.tsx:137` | texto en pantalla | Lo propuso {parte} | Proposed by {parte} |
| `arrendadores.cambios.interna` | `components/demo/arrendadores/CambiosContrato.tsx:142` | texto en pantalla | Captura interna | Internal entry |
| `arrendadores.cambios.registro` | `components/demo/arrendadores/CambiosContrato.tsx:144` | texto en pantalla | ␣· lo registró {nombre} | ␣· recorded by {nombre} |
| `arrendadores.cambios.vacio-valor` | `components/demo/arrendadores/CambiosContrato.tsx:153`<br>`components/demo/arrendadores/CambiosContrato.tsx:155` | texto en pantalla | vacío | empty |
| `arrendadores.cambios.archivada` | `components/demo/arrendadores/CambiosContrato.tsx:161` | texto en pantalla | Estaba firmado: se archivó como versión firmada {n} y se anularon sus firmas. | It was signed: it was archived as signed version {n} and its signatures were voided. |
| `arrendadores.cambios.envio-anulado` | `components/demo/arrendadores/CambiosContrato.tsx:165` | texto en pantalla | Ya se había enviado a firma: ese enlace dejó de servir y hubo que reenviarlo. | It had already been sent for signature: that link stopped working and had to be sent again. |
| `arrendadores.versiones.no-leer` | `components/demo/arrendadores/CambiosContrato.tsx:205` | mensaje de error | No se pudo leer la versión firmada | Could not read the signed version |
| `arrendadores.versiones.titulo` | `components/demo/arrendadores/CambiosContrato.tsx:212` | texto en pantalla | Versiones firmadas anteriores | Previous signed versions |
| `arrendadores.versiones.version` | `components/demo/arrendadores/CambiosContrato.tsx:219` | texto en pantalla | Versión {n} | Version {n} |
| `arrendadores.versiones.archivada` | `components/demo/arrendadores/CambiosContrato.tsx:220` | texto en pantalla | ␣· archivada {fecha} | ␣· archived {fecha} |
| `arrendadores.versiones.ver` | `components/demo/arrendadores/CambiosContrato.tsx:227` | texto en pantalla | Ver texto firmado | View signed text |
| `arrendadores.versiones.firmo` | `components/demo/arrendadores/CambiosContrato.tsx:238` | texto en pantalla | {parte} firmó {nombre} | {parte} signed by {nombre} |
| `arrendadores.versiones.firmo-el` | `components/demo/arrendadores/CambiosContrato.tsx:238` | texto en pantalla | {parte} firmó {nombre} el {fecha} | {parte} signed by {nombre} on {fecha} |
| `arrendadores.versiones.modal` | `components/demo/arrendadores/CambiosContrato.tsx:254` | título / tooltip | Versión firmada {n} | Signed version {n} |
| `arrendadores.versiones.sello` | `components/demo/arrendadores/CambiosContrato.tsx:255` | título / tooltip | Sello SHA-256: {hash} | SHA-256 seal: {hash} |
| `arrendadores.editar.no-guardar` | `components/demo/arrendadores/CambiosContrato.tsx:374` | mensaje de error | No se pudo guardar el cambio | Could not save the change |
| `arrendadores.editar.hecho-firmado` | `components/demo/arrendadores/CambiosContrato.tsx:380` | aviso emergente | Cambio guardado · la versión firmada quedó archivada; envía el contrato a firma otra vez | Change saved · the signed version was archived; send the contract for signature again |
| `arrendadores.editar.hecho-enviado` | `components/demo/arrendadores/CambiosContrato.tsx:382` | texto en pantalla | Cambio guardado · vuelve a enviar el contrato a firma | Change saved · send the contract for signature again |
| `arrendadores.editar.hecho` | `components/demo/arrendadores/CambiosContrato.tsx:383` | texto en pantalla | Cambio guardado en el historial | Change saved in the history |
| `arrendadores.editar.titulo` | `components/demo/arrendadores/CambiosContrato.tsx:400` | título / tooltip | Editar términos del contrato | Edit contract terms |
| `arrendadores.editar.sub-firmado` | `components/demo/arrendadores/CambiosContrato.tsx:403` | subtítulo | Ya firmado: la versión firmada se archiva y se vuelve a firmar. | Already signed: the signed version is archived and it is signed again. |
| `arrendadores.editar.sub` | `components/demo/arrendadores/CambiosContrato.tsx:404` | subtítulo | Antes de firmarse. Cada cambio queda en el historial con quién lo pidió. | Before signing. Each change stays in the history with who asked for it. |
| `arrendadores.editar.guardar` | `components/demo/arrendadores/CambiosContrato.tsx:414` | botón | Guardar cambio | Save change |
| `arrendadores.editar.aviso-firmado` | `components/demo/arrendadores/CambiosContrato.tsx:422` | texto en pantalla | Este contrato {firmado}. Si guardas un cambio, la versión firmada se archiva tal como se firmó —texto y firmas— y las firmas actuales se anulan. Después tendrás que enviarlo a firma otra vez, con los datos actuales, para que las dos partes lo revisen y lo firmen de nuevo. Escribe el motivo: queda en el historial. | This contract {firmado}. If you save a change, the signed version is archived exactly as it was signed —text and signatures— and the current signatures are voided. Then you’ll have to send it for signature again, with the current data, so both parties review it and sign it again. Write the reason: it stays in the history. |
| `arrendadores.editar.aviso-firmado-b` | `components/demo/arrendadores/CambiosContrato.tsx:422` | texto en pantalla | ya está firmado | is already signed |
| `arrendadores.editar.aviso-enviado` | `components/demo/arrendadores/CambiosContrato.tsx:426` | texto en pantalla | Este contrato {enviado}. Si guardas un cambio, el enlace que tiene el arrendador deja de servir y tendrás que enviarlo otra vez con el texto nuevo. | This contract {enviado}. If you save a change, the link the landlord has stops working and you’ll have to send it again with the new text. |
| `arrendadores.editar.aviso-enviado-b` | `components/demo/arrendadores/CambiosContrato.tsx:426` | texto en pantalla | ya se envió a firma | was already sent for signature |
| `arrendadores.editar.quien` | `components/demo/arrendadores/CambiosContrato.tsx:430` | rótulo | ¿Quién propuso el cambio? | Who proposed the change? |
| `arrendadores.editar.motivo` | `components/demo/arrendadores/CambiosContrato.tsx:447` | rótulo | Motivo | Reason |
| `arrendadores.editar.motivo-ph` | `components/demo/arrendadores/CambiosContrato.tsx:453` | texto de ejemplo (placeholder) | Ej. pidió bajar la renta a cambio de un plazo más largo | E.g. asked to lower the rent in exchange for a longer term |
| `arrendadores.editar.razon-arrendador` | `components/demo/arrendadores/CambiosContrato.tsx:473` | rótulo | Razón social del arrendador | Landlord’s legal name |
| `arrendadores.editar.inicio` | `components/demo/arrendadores/CambiosContrato.tsx:502` | rótulo | Inicio | Start |
| `arrendadores.editar.fin` | `components/demo/arrendadores/CambiosContrato.tsx:507` | rótulo | Fin | End |
| `arrendadores.editar.mayor-cero` | `components/demo/arrendadores/CambiosContrato.tsx:523` | texto en pantalla | Tiene que ser mayor que cero | It must be greater than zero |
| `arrendadores.editar.moneda` | `components/demo/arrendadores/CambiosContrato.tsx:544` | rótulo | Moneda | Currency |
| `arrendadores.editar.negativo` | `components/demo/arrendadores/CambiosContrato.tsx:553` | texto en pantalla | No puede ser negativo | Can’t be negative |
| `arrendadores.licencias.vencio` | `components/demo/arrendadores/LicenciasCard.tsx:43` | texto en pantalla | Venció hace {n} d | Expired {n} d ago |
| `arrendadores.licencias.vence-en` | `components/demo/arrendadores/LicenciasCard.tsx:44`<br>`components/demo/arrendadores/LicenciasCard.tsx:45` | texto en pantalla | Vence en {n} d | Expires in {n} d |
| `arrendadores.licencias.vigente` | `components/demo/arrendadores/LicenciasCard.tsx:46` | texto en pantalla | Vigente | Active |
| `arrendadores.licencias.titulo` | `components/demo/arrendadores/LicenciasCard.tsx:77` | texto en pantalla | Licencias y permisos | Permits and licenses |
| `arrendadores.licencias.amparan` | `components/demo/arrendadores/LicenciasCard.tsx:86` | texto en pantalla | Amparan a todas las pantallas de este predio. | They cover all the screens on this property. |
| `arrendadores.licencias.vacio` | `components/demo/arrendadores/LicenciasCard.tsx:92` | texto en pantalla | Sin licencias registradas. Al capturar la vigencia, el sistema avisa con {n} días de anticipación. | No permits recorded. Once the expiration date is entered, the system warns {n} days ahead. |
| `arrendadores.licencias.vence` | `components/demo/arrendadores/LicenciasCard.tsx:110` | texto en pantalla | vence {fecha} | expires {fecha} |
| `arrendadores.licencias.borrar` | `components/demo/arrendadores/LicenciasCard.tsx:117` | etiqueta accesible (aria-label) | Borrar licencia | Delete permit |
| `arrendadores.licencias.borrada` | `components/demo/arrendadores/LicenciasCard.tsx:122` | aviso emergente | Licencia borrada | Permit deleted |
| `arrendadores.licencias.registrada` | `components/demo/arrendadores/LicenciasCard.tsx:178` | aviso emergente | Licencia registrada | Permit recorded |
| `arrendadores.licencias.alta` | `components/demo/arrendadores/LicenciasCard.tsx:191` | título / tooltip | Registrar licencia o permiso | Record a license or permit |
| `arrendadores.licencias.alta-sub` | `components/demo/arrendadores/LicenciasCard.tsx:192` | título / tooltip | La fecha de vencimiento es lo que dispara el aviso | The expiration date is what triggers the warning |
| `arrendadores.licencias.folio` | `components/demo/arrendadores/LicenciasCard.tsx:218` | rótulo | Folio | Permit number |
| `arrendadores.licencias.autoridad` | `components/demo/arrendadores/LicenciasCard.tsx:221` | rótulo | Autoridad que la expide | Issuing authority |
| `arrendadores.licencias.expedicion` | `components/demo/arrendadores/LicenciasCard.tsx:225` | rótulo | Expedición | Issue date |
| `arrendadores.licencias.vencimiento` | `components/demo/arrendadores/LicenciasCard.tsx:234` | rótulo | Vencimiento | Expiration |
| `arrendadores.licencias.antes-expedicion` | `components/demo/arrendadores/LicenciasCard.tsx:237` | mensaje de error | No puede ser anterior a la expedición | Can’t be earlier than the issue date |
| `arrendadores.licencias.invertidas` | `components/demo/arrendadores/LicenciasCard.tsx:249` | texto en pantalla | La licencia no puede vencer antes de expedirse. | The permit can’t expire before it is issued. |
| `arrendadores.licencia.municipal` | `components/demo/arrendadores/etiquetas.ts:47` | etiqueta de un valor (mapa de claves) | Licencia municipal | Municipal license |
| `arrendadores.licencia.ambiental` | `components/demo/arrendadores/etiquetas.ts:48` | etiqueta de un valor (mapa de claves) | Permiso ambiental | Environmental permit |
| `arrendadores.licencia.estructural` | `components/demo/arrendadores/etiquetas.ts:49` | etiqueta de un valor (mapa de claves) | Dictamen estructural | Structural report |
| `arrendadores.licencia.otro` | `components/demo/arrendadores/LicenciasCard.tsx:50`<br>`components/demo/arrendadores/etiquetas.ts:50` | texto en pantalla · etiqueta de un valor (mapa de claves) | Permiso | Permit |
| `arrendadores.cuadre.titulo` | `components/demo/arrendadores/ConciliacionCard.tsx:231` | título | Cuadre de renta por arrendador | Rent reconciliation by landlord |
| `arrendadores.cuadre.sub` | `components/demo/arrendadores/ConciliacionCard.tsx:233` | título | Qué se le debe a cada uno y qué ya se le pagó. Primero quien tiene vencidos. | What is owed to each one and what has already been paid. Those with overdue payments first. |
| `arrendadores.cuadre.vacio` | `components/demo/arrendadores/ConciliacionCard.tsx:93` | texto en pantalla | — Sin pagos de renta generados todavía: se calculan al capturar el importe del contrato. | — No rent payments generated yet: they are calculated when the contract amount is entered. |
| `arrendadores.cuadre.col.arrendador` | `components/demo/arrendadores/ConciliacionCard.tsx:121` | cabecera de columna | Arrendador / emplazamiento | Landlord / location |
| `arrendadores.cuadre.col.vencido` | `components/demo/arrendadores/ConciliacionCard.tsx:122` | cabecera de columna | Vencido | Overdue |
| `arrendadores.cuadre.col.pendiente` | `components/demo/arrendadores/ConciliacionCard.tsx:123` | cabecera de columna | Pendiente | Pending |
| `arrendadores.cuadre.col.pagado` | `components/demo/arrendadores/ConciliacionCard.tsx:124` | cabecera de columna | Pagado | Paid |
| `arrendadores.cuadre.col.proximo` | `components/demo/arrendadores/ConciliacionCard.tsx:125` | cabecera de columna | Próximo | Next |
| `arrendadores.cuadre.emplazamientos.uno` | `components/demo/arrendadores/ConciliacionCard.tsx:154` | texto en pantalla | {n} emplazamiento | {n} location |
| `arrendadores.cuadre.emplazamientos.otros` | `components/demo/arrendadores/ConciliacionCard.tsx:154` | texto en pantalla | {n} emplazamientos | {n} locations |
| `arrendadores.cuadre.predio` | `components/demo/arrendadores/ConciliacionCard.tsx:179` | texto en pantalla | Predio | Property |
| `arrendadores.cuadre.suelta` | `components/demo/arrendadores/ConciliacionCard.tsx:179` | texto en pantalla | Pantalla suelta | Individual screen |
| `arrendadores.cuadre.contratos.uno` | `components/demo/arrendadores/ConciliacionCard.tsx:180` | texto en pantalla | {n} contrato | {n} contract |
| `arrendadores.cuadre.contratos.otros` | `components/demo/arrendadores/ConciliacionCard.tsx:180` | texto en pantalla | {n} contratos | {n} contracts |
| `arrendadores.cuadre.sin-arrendador` | `components/demo/arrendadores/ConciliacionCard.tsx:151` | texto en pantalla | Sin arrendador asignado | No landlord assigned |
| `arrendadores.pagos.pagado` | `components/demo/arrendadores/PagosRentaCard.tsx:49` | texto en pantalla | Pagado | Paid |
| `arrendadores.pagos.vencido` | `components/demo/arrendadores/PagosRentaCard.tsx:50` | texto en pantalla | Vencido | Overdue |
| `arrendadores.pagos.por-vencer` | `components/demo/arrendadores/PagosRentaCard.tsx:51` | texto en pantalla | Por vencer | Due soon |
| `arrendadores.pagos.programado` | `components/demo/arrendadores/PagosRentaCard.tsx:52` | texto en pantalla | Programado | Scheduled |
| `arrendadores.pagos.vencidas.uno` | `components/demo/arrendadores/PagosRentaCard.tsx:199` | texto en pantalla | {n} vencida ({monto}) ·␣ | {n} overdue ({monto}) ·␣ |
| `arrendadores.pagos.vencidas.otros` | `components/demo/arrendadores/PagosRentaCard.tsx:199` | texto en pantalla | {n} vencidas ({monto}) ·␣ | {n} overdue ({monto}) ·␣ |
| `arrendadores.pagos.por-vencer-n` | `components/demo/arrendadores/PagosRentaCard.tsx:206` | texto en pantalla | {n} por vencer ·␣ | {n} due soon ·␣ |
| `arrendadores.pagos.por-pagar` | `components/demo/arrendadores/PagosRentaCard.tsx:208` | texto en pantalla | {monto} por pagar | {monto} to pay |
| `arrendadores.pagos.sin-importe.uno` | `components/demo/arrendadores/PagosRentaCard.tsx:224` | texto en pantalla | No se puede calcular lo que hay que pagar: {n} contrato sin importe capturado. {enlace} y el calendario de pagos se genera solo. | Can’t calculate what has to be paid: {n} contract without an amount. {enlace} and the payment schedule is generated automatically. |
| `arrendadores.pagos.sin-importe.otros` | `components/demo/arrendadores/PagosRentaCard.tsx:224` | texto en pantalla | No se puede calcular lo que hay que pagar: {n} contratos sin importe capturado. {enlace} y el calendario de pagos se genera solo. | Can’t calculate what has to be paid: {n} contracts without an amount. {enlace} and the payment schedule is generated automatically. |
| `arrendadores.pagos.completalo` | `components/demo/arrendadores/PagosRentaCard.tsx:230`<br>`components/demo/arrendadores/PagosRentaCard.tsx:233` | texto en pantalla | Complétalo en Arrendadores | Complete it in Landlords |
| `arrendadores.pagos.sin-pendientes` | `components/demo/arrendadores/PagosRentaCard.tsx:240` | texto en pantalla | No hay rentas pendientes de pago. | There is no rent pending payment. |
| `arrendadores.pagos.vacio` | `components/demo/arrendadores/PagosRentaCard.tsx:240` | texto en pantalla | Sin pagos de renta registrados. | No rent payments recorded. |
| `arrendadores.pagos.col.vence` | `components/demo/arrendadores/PagosRentaCard.tsx:250` | cabecera de columna | Vence | Due |
| `arrendadores.pagos.col.monto` | `components/demo/arrendadores/PagosRentaCard.tsx:251` | cabecera de columna | Monto | Amount |
| `arrendadores.pagos.col.contrato-hasta` | `components/demo/arrendadores/PagosRentaCard.tsx:253` | cabecera de columna | Contrato hasta | Contract until |
| `arrendadores.pagos.col.pagado-el` | `components/demo/arrendadores/PagosRentaCard.tsx:254` | cabecera de columna | Pagado el | Paid on |
| `arrendadores.pagos.registrando` | `components/demo/arrendadores/PagosRentaCard.tsx:307` | texto en pantalla | Registrando… | Recording… |
| `arrendadores.pagos.sensible` | `components/demo/arrendadores/PagosRentaCard.tsx:328` | título | Dar por pagada una renta es un cambio sensible: tu organización pide que vuelvas a identificarte. | Marking a rent as paid is a sensitive change: your organization asks you to confirm your identity again. |
| `arrendadores.pagos.confirmar` | `components/demo/arrendadores/PagosRentaCard.tsx:329` | subtítulo | Confirmar y registrar el pago | Confirm and record the payment |
| `arrendadores.compromiso.titulo` | `components/demo/arrendadores/CompromisoRentaCard.tsx:38`<br>`components/demo/arrendadores/CompromisoRentaCard.tsx:69` | título | Renta comprometida a arrendadores | Rent committed to landlords |
| `arrendadores.compromiso.vacio` | `components/demo/arrendadores/CompromisoRentaCard.tsx:79` | texto en pantalla | No hay contratos con importe capturado todavía. | There are no contracts with an amount yet. |
| `arrendadores.compromiso.equivale` | `components/demo/arrendadores/CompromisoRentaCard.tsx:89` | cabecera de columna | Equivale a | Equivalent to |
| `arrendadores.compromiso.incompletos.uno` | `components/demo/arrendadores/CompromisoRentaCard.tsx:160` | texto en pantalla | El total no incluye {n} contrato incompleto: el costo real es mayor. | The total doesn’t include {n} incomplete contract: the real cost is higher. |
| `arrendadores.compromiso.incompletos.otros` | `components/demo/arrendadores/CompromisoRentaCard.tsx:160` | texto en pantalla | El total no incluye {n} contratos incompletos: el costo real es mayor. | The total doesn’t include {n} incomplete contracts: the real cost is higher. |
| `arrendadores.compromiso.incompletos-falta.uno` | `components/demo/arrendadores/CompromisoRentaCard.tsx:156` | texto en pantalla | El total no incluye {n} contrato incompleto (falta {falta}): el costo real es mayor. | The total doesn’t include {n} incomplete contract (missing {falta}): the real cost is higher. |
| `arrendadores.compromiso.incompletos-falta.otros` | `components/demo/arrendadores/CompromisoRentaCard.tsx:157` | texto en pantalla | El total no incluye {n} contratos incompletos (falta {falta}): el costo real es mayor. | The total doesn’t include {n} incomplete contracts (missing {falta}): the real cost is higher. |
| `arrendadores.compromiso.vencidos.uno` | `components/demo/arrendadores/CompromisoRentaCard.tsx:172` | texto en pantalla | Se listan {n} contrato vencido para que se vean, pero no suman al total: ya no devengan renta. Renuévalos en Arrendadores o quedarán sin cobertura. | {n} expired contract is listed so it can be seen, but it doesn’t add to the total: it no longer accrues rent. Renew it in Landlords or it will be left without coverage. |
| `arrendadores.compromiso.vencidos.otros` | `components/demo/arrendadores/CompromisoRentaCard.tsx:172` | texto en pantalla | Se listan {n} contratos vencidos para que se vean, pero no suman al total: ya no devengan renta. Renuévalos en Arrendadores o quedarán sin cobertura. | {n} expired contracts are listed so they can be seen, but they don’t add to the total: they no longer accrue rent. Renew them in Landlords or they will be left without coverage. |
| `arrendadores.firmas.parte.arrendador` | `components/demo/arrendadores/PanelFirmas.tsx:46` | texto en pantalla | El arrendador (dueño del espacio) | The landlord (owner of the space) |
| `arrendadores.firmas.parte.arrendatario` | `components/demo/arrendadores/PanelFirmas.tsx:47`<br>`components/demo/arrendadores/PanelFirmas.tsx:301` | texto en pantalla | Tu empresa (arrendataria) | Your company (lessee) |
| `arrendadores.firmas.no-accion` | `components/demo/arrendadores/PanelFirmas.tsx:94`<br>`components/demo/arrendadores/PanelFirmas.tsx:99` | texto en pantalla · aviso emergente (éxito) | No se pudo completar la acción | Could not complete the action |
| `arrendadores.firmas.enviado` | `components/demo/arrendadores/PanelFirmas.tsx:97` | aviso emergente (éxito) | Documento congelado y enviado a firma | Document frozen and sent for signature |
| `arrendadores.firmas.firmado` | `components/demo/arrendadores/PanelFirmas.tsx:97` | aviso emergente (éxito) | Firmado | Signed |
| `arrendadores.firmas.copiado` | `components/demo/arrendadores/PanelFirmas.tsx:108` | aviso emergente (éxito) | Enlace copiado. Envíaselo al arrendador. | Link copied. Send it to the landlord. |
| `arrendadores.firmas.no-copiar` | `components/demo/arrendadores/PanelFirmas.tsx:109` | aviso emergente (éxito) | No se pudo copiar. El enlace es: {url} | Could not copy. The link is: {url} |
| `arrendadores.firmas.titulo` | `components/demo/arrendadores/PanelFirmas.tsx:115` | título | Firma del contrato | Contract signature |
| `arrendadores.firmas.nota` | `components/demo/arrendadores/PanelFirmas.tsx:120` | texto en pantalla | Al enviar a firma, el sistema {congela} el texto exacto de este contrato y lo sella con SHA-256. A partir de ese momento, lo que se firma es esa versión y no «lo que diga la base de datos». Si después se edita el contrato, las firmas se marcan como invalidadas. | When you send it for signature, the system {congela} the exact text of this contract and seals it with SHA-256. From then on, what gets signed is that version and not “whatever the database says”. If the contract is edited afterwards, the signatures are marked as invalidated. |
| `arrendadores.firmas.congela` | `components/demo/arrendadores/PanelFirmas.tsx:120` | texto en pantalla | congela | freezes |
| `arrendadores.firmas.faltan` | `components/demo/arrendadores/PanelFirmas.tsx:124` | texto en pantalla | No se puede enviar a firma mientras falten datos por capturar (ver arriba). | It can’t be sent for signature while there is data missing (see above). |
| `arrendadores.firmas.enviar` | `components/demo/arrendadores/PanelFirmas.tsx:142` | texto en pantalla | Enviar a firma | Send for signature |
| `arrendadores.firmas.congelado` | `components/demo/arrendadores/PanelFirmas.tsx:149` | texto en pantalla | Documento congelado el {fecha}. Sello SHA-256: {hash} | Document frozen on {fecha}. SHA-256 seal: {hash} |
| `arrendadores.firmas.ya-tiene` | `components/demo/arrendadores/PanelFirmas.tsx:161` | texto en pantalla | {titulo} Si hay que modificar renta, vigencia o cualquier otra condición, edítalo desde «Editar términos» en su ficha: esta versión se archiva tal como se firmó —texto y firmas— y el contrato se vuelve a enviar a firma con los datos actuales. | {titulo} If the rent, the term or any other condition has to change, edit it from “Edit terms” in its profile: this version is archived exactly as it was signed —text and signatures— and the contract is sent for signature again with the current data. |
| `arrendadores.firmas.ya-tiene-titulo` | `components/demo/arrendadores/PanelFirmas.tsx:161` | texto en pantalla | Este contrato ya tiene firmas. | This contract already has signatures. |
| `arrendadores.firmas.desfasado` | `components/demo/arrendadores/PanelFirmas.tsx:169` | texto en pantalla | {titulo} Las firmas ya no corresponden al texto actual. Vuelve a enviar a firma para sellar la versión nueva y recabar las firmas otra vez. | {titulo} The signatures no longer match the current text. Send it for signature again to seal the new version and collect the signatures again. |
| `arrendadores.firmas.desfasado-titulo` | `components/demo/arrendadores/PanelFirmas.tsx:169` | texto en pantalla | El contrato cambió después de congelarse. | The contract changed after it was frozen. |
| `arrendadores.firmas.invalidada` | `components/demo/arrendadores/PanelFirmas.tsx:184` | texto en pantalla | Firma invalidada (el documento cambió) | Signature invalidated (the document changed) |
| `arrendadores.firmas.firmada` | `components/demo/arrendadores/PanelFirmas.tsx:188` | texto en pantalla | Firmada | Signed |
| `arrendadores.firmas.firmo` | `components/demo/arrendadores/PanelFirmas.tsx:193` | texto en pantalla | Firmó: {nombre} · {fecha} | Signed by: {nombre} · {fecha} |
| `arrendadores.firmas.ip` | `components/demo/arrendadores/PanelFirmas.tsx:199` | texto en pantalla | IP: {ip} · Navegador: {navegador} | IP: {ip} · Browser: {navegador} |
| `arrendadores.firmas.documento` | `components/demo/arrendadores/PanelFirmas.tsx:201` | texto en pantalla | Documento firmado: {hash} | Signed document: {hash} |
| `arrendadores.firmas.pendiente` | `components/demo/arrendadores/PanelFirmas.tsx:209` | texto en pantalla | Pendiente | Pending |
| `arrendadores.firmas.pendiente-de` | `components/demo/arrendadores/PanelFirmas.tsx:208` | texto en pantalla | Pendiente — se espera la firma de {nombre} | Pending — waiting for {nombre} to sign |
| `arrendadores.firmas.firmando` | `components/demo/arrendadores/PanelFirmas.tsx:220`<br>`components/demo/arrendadores/FirmaPublica.tsx:147` | texto en pantalla · botón | Firmando… | Signing… |
| `arrendadores.firmas.firmar-arrendataria` | `components/demo/arrendadores/PanelFirmas.tsx:220` | texto en pantalla | Firmar como arrendataria | Sign as lessee |
| `arrendadores.firmas.copiar` | `components/demo/arrendadores/PanelFirmas.tsx:231` | texto en pantalla | Copiar enlace de firma | Copy signature link |
| `arrendadores.firmas.envia` | `components/demo/arrendadores/PanelFirmas.tsx:234` | texto en pantalla | Envíaselo al arrendador. Vence el {fecha}. Quien tenga el enlace puede firmar, así que trátalo como una credencial. | Send it to the landlord. It expires on {fecha}. Anyone with the link can sign, so treat it like a credential. |
| `arrendadores.firmas.anula` | `components/demo/arrendadores/PanelFirmas.tsx:250` | texto en pantalla | Las firmas actuales se anulan. La versión firmada queda archivada tal como se firmó. | The current signatures are voided. The signed version stays archived exactly as it was signed. |
| `arrendadores.firmas.reenviar-archiva` | `components/demo/arrendadores/PanelFirmas.tsx:266` | texto en pantalla | Volver a enviar a firma (archiva las firmas actuales) | Send it again for signature (archives the current signatures) |
| `arrendadores.firmas.reenviar-reinicia` | `components/demo/arrendadores/PanelFirmas.tsx:267` | texto en pantalla | Volver a enviar a firma (reinicia las firmas) | Send it again for signature (restarts the signatures) |
| `arrendadores.revision.domicilio-fiscal` | `components/demo/arrendadores/PanelFirmas.tsx:305` | texto en pantalla | Domicilio fiscal | Tax address |
| `arrendadores.revision.representante` | `components/demo/arrendadores/PanelFirmas.tsx:306` | texto en pantalla | Representante legal | Legal representative |
| `arrendadores.revision.nombre` | `components/demo/arrendadores/PanelFirmas.tsx:312`<br>`components/demo/arrendadores/PanelFirmas.tsx:321` | texto en pantalla | Nombre | Name |
| `arrendadores.revision.espacio` | `components/demo/arrendadores/PanelFirmas.tsx:319` | texto en pantalla | El espacio | The space |
| `arrendadores.revision.direccion` | `components/demo/arrendadores/PanelFirmas.tsx:322` | texto en pantalla | Dirección | Address |
| `arrendadores.revision.terminos` | `components/demo/arrendadores/PanelFirmas.tsx:326` | texto en pantalla | Términos | Terms |
| `arrendadores.revision.rango` | `components/demo/arrendadores/PanelFirmas.tsx:339` | texto en pantalla | {desde} a {hasta} | {desde} to {hasta} |
| `arrendadores.revision.titulo` | `components/demo/arrendadores/PanelFirmas.tsx:348` | texto en pantalla | Revisa los datos que llevará el contrato | Review the data the contract will include |
| `arrendadores.revision.nota` | `components/demo/arrendadores/PanelFirmas.tsx:351` | texto en pantalla | Son los datos actuales. Si alguno está mal, corrígelo antes de enviar: los de tu empresa en Administración, los del arrendador en su ficha y los términos con «Editar términos». | This is the current data. If anything is wrong, fix it before sending: your company’s in Settings, the landlord’s in its profile and the terms with “Edit terms”. |
| `arrendadores.revision.fila` | `components/demo/arrendadores/PanelFirmas.tsx:360` | texto en pantalla | {campo}: {valor} | {campo}: {valor} |
| `arrendadores.revision.sin-capturar` | `components/demo/arrendadores/PanelFirmas.tsx:362` | texto en pantalla | sin capturar | not entered |
| `arrendadores.revision.congelando` | `components/demo/arrendadores/PanelFirmas.tsx:375` | botón | Congelando… | Freezing… |
| `arrendadores.revision.correctos` | `components/demo/arrendadores/PanelFirmas.tsx:375` | botón | Los datos son correctos, enviar a firma | The data is correct, send for signature |
| `arrendadores.revision.corregir` | `components/demo/arrendadores/PanelFirmas.tsx:384` | texto en pantalla | Corregir antes | Fix it first |
| `arrendadores.barra.nota` | `components/demo/arrendadores/BarraDocumento.tsx:28` | texto en pantalla | En el diálogo de impresión elige «Guardar como PDF» como destino. | In the print dialog choose “Save as PDF” as the destination. |
| `arrendadores.barra.faltan.uno` | `components/demo/arrendadores/BarraDocumento.tsx:36` | texto en pantalla | Faltan {n} dato por capturar. | {n} field is missing. |
| `arrendadores.barra.faltan.otros` | `components/demo/arrendadores/BarraDocumento.tsx:36` | texto en pantalla | Faltan {n} datos por capturar. | {n} fields are missing. |
| `arrendadores.barra.en-blanco` | `components/demo/arrendadores/BarraDocumento.tsx:37` | texto en pantalla | El documento los deja marcados en blanco en vez de inventarlos. | The document leaves them marked blank instead of making them up. |
| `arrendadores.barra.en` | `components/demo/arrendadores/BarraDocumento.tsx:40` | texto en pantalla | En {donde}: | In {donde}: |
| `arrendadores.documento.sin-permiso` | `app/(app)/contrato/[id]/page.tsx:65` | texto en pantalla | No tienes permiso para ver este contrato. | You don’t have permission to view this contract. |
| `arrendadores.documento.falta-title` | `app/(app)/contrato/[id]/page.tsx:50` | título / tooltip | Dato pendiente de capturar | Data still to be entered |
| `arrendadores.publica.no-valido` | `app/(app)/firmar/[token]/page.tsx:21` | título | Enlace no válido | Invalid link |
| `arrendadores.publica.no-valido-texto` | `app/(app)/firmar/[token]/page.tsx:23` | texto en pantalla | Este enlace de firma no existe o fue reemplazado por uno nuevo. Pide al remitente que te envíe el enlace vigente. | This signature link doesn’t exist or was replaced by a new one. Ask the sender to send you the current link. |
| `arrendadores.publica.no-firmar` | `components/demo/arrendadores/FirmaPublica.tsx:53`<br>`components/demo/arrendadores/FirmaPublica.tsx:56` | texto en pantalla · mensaje de error | No se pudo firmar | Could not sign |
| `arrendadores.publica.firmado` | `components/demo/arrendadores/FirmaPublica.tsx:69` | texto en pantalla | {titulo} Se registró tu firma con la fecha y hora de este momento. Puedes guardar una copia con Ctrl+P → «Guardar como PDF». | {titulo} Your signature was recorded with the date and time of this moment. You can save a copy with Ctrl+P → “Save as PDF”. |
| `arrendadores.publica.firmado-titulo` | `components/demo/arrendadores/FirmaPublica.tsx:69` | texto en pantalla | Contrato firmado. | Contract signed. |
| `arrendadores.publica.ya-firmada` | `components/demo/arrendadores/FirmaPublica.tsx:75` | texto en pantalla | Este contrato ya fue firmado con este enlace. | This contract was already signed with this link. |
| `arrendadores.publica.expiro` | `components/demo/arrendadores/FirmaPublica.tsx:81` | texto en pantalla | {titulo} Pide al remitente que te envíe uno nuevo. | {titulo} Ask the sender to send you a new one. |
| `arrendadores.publica.expiro-titulo` | `components/demo/arrendadores/FirmaPublica.tsx:81` | texto en pantalla | El enlace expiró. | The link expired. |
| `arrendadores.publica.lee` | `components/demo/arrendadores/FirmaPublica.tsx:88` | texto en pantalla | Lee el contrato completo. Al final encontrarás el espacio para firmarlo electrónicamente. | Read the whole contract. At the end you’ll find the space to sign it electronically. |
| `arrendadores.publica.expiro-h1` | `components/demo/arrendadores/FirmaPublica.tsx:105` | título | El enlace expiró | The link has expired |
| `arrendadores.publica.expiro-texto` | `components/demo/arrendadores/FirmaPublica.tsx:107` | texto en pantalla | Por seguridad, el texto del contrato ya no se muestra desde este enlace. Pide al remitente que te envíe uno nuevo y podrás leerlo y firmarlo. | For security, the contract text is no longer shown from this link. Ask the sender to send you a new one and you’ll be able to read and sign it. |
| `arrendadores.publica.firmar-titulo` | `components/demo/arrendadores/FirmaPublica.tsx:118` | título | Firmar electrónicamente | Sign electronically |
| `arrendadores.publica.enviado-a` | `components/demo/arrendadores/FirmaPublica.tsx:121` | texto en pantalla | Este contrato se envió a firma de {nombre}. | This contract was sent to {nombre} for signature. |
| `arrendadores.publica.nombre` | `components/demo/arrendadores/FirmaPublica.tsx:126` | texto en pantalla | Escribe tu nombre completo | Type your full name |
| `arrendadores.publica.nombre-ph` | `components/demo/arrendadores/FirmaPublica.tsx:130` | texto de ejemplo (placeholder) | Nombre y apellidos | First and last name |
| `arrendadores.publica.acepto` | `components/demo/arrendadores/FirmaPublica.tsx:139` | texto en pantalla | He leído el contrato en su totalidad y manifiesto mi voluntad de obligarme en sus términos. Acepto que mi firma electrónica producirá los mismos efectos que la firma autógrafa. | I have read the whole contract and state my will to be bound by its terms. I accept that my electronic signature will have the same effects as a handwritten signature. |
| `arrendadores.publica.firmar` | `components/demo/arrendadores/FirmaPublica.tsx:147` | botón | Firmar contrato | Sign contract |
| `arrendadores.publica.nota` | `components/demo/arrendadores/FirmaPublica.tsx:151` | texto en pantalla | Al firmar se registrará la fecha y hora, tu dirección IP y el navegador desde el que firmas, junto con un sello digital (SHA-256) del texto exacto que estás firmando. Ese sello permite demostrar después que el documento no se modificó. | When you sign, the date and time, your IP address and the browser you sign from will be recorded, together with a digital seal (SHA-256) of the exact text you are signing. That seal makes it possible to prove later that the document wasn’t modified. |
| `arrendadores.entidades.sin-acceso` | `app/(app)/(shell)/razones-sociales/page.tsx:69` | mensaje de error | Tu rol no tiene acceso a la administración de la organización. | Your role doesn’t have access to the organization’s settings. |
| `arrendadores.entidades.no-cargar` | `app/(app)/(shell)/razones-sociales/page.tsx:70`<br>`app/(app)/(shell)/razones-sociales/page.tsx:77` | mensaje de error | No se pudieron cargar las razones sociales | Could not load the legal entities |
| `arrendadores.entidades.sub` | `app/(app)/(shell)/razones-sociales/page.tsx:91` | texto en pantalla | Las de tu empresa · con cuál pagas las rentas, compras los activos, tramitas licencias y vendes | Your company’s · which one pays the rent, buys the assets, handles permits and sells |
