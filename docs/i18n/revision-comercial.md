# Tabla de revisión · lote de inglés «comercial»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/comercial.ts` y
`textos/codigos.ts`, y de los usos en el código (búsqueda literal de la clave).
**559 claves** (500 de `comercial.*` y 59 de `codigos.*`). Regenerada tras la segunda vuelta (hallazgos del validador y decisiones del orquestador).

- **español** es la copia literal de lo que decía el componente antes del lote,
  comprobado comparando el HTML rendido de **23 estados de pantalla** antes y
  después: idénticos byte a byte (`diff -rq`; ver
  `lib/i18n/pantallas-comercial.test.ts`, que con `VOLCAR_HTML=<carpeta>` vuelca
  el HTML español de cada estado).
- `␣` marca un espacio al principio o al final: es intencional, el texto va
  pegado a otro nodo.
- Los huecos `{nombre}` se rellenan en tiempo de ejecución con datos, importes
  ya formateados (`formatMonto`) o elementos (`interpolarNodos`). Ninguna cifra
  de dinero ni símbolo de moneda vive en el diccionario: el «$» del rótulo de la
  tarifa y el ejemplo «15,000.50» entran por hueco.
- «qué es» lo asigna una heurística sobre cada línea de uso; si discrepa de lo
  que se ve en pantalla, manda la pantalla. Las claves de los **espejos**
  (`comercial.sitio-estatus.*`, `tipo-medio.*`, `contrato-estatus.*`,
  `pago-estatus.*`, `negociacion.etapa.*`, `visibilidad.*`, `canal.*`,
  `oferta.*`, `responsable.1-5`) apuntan al mapa que las declara; su español es
  EXACTAMENTE la etiqueta compartida (`SITIO_LABEL`, `TIPO_MEDIO_LABEL`,
  `CONTRATO_LABEL`, `PAGO_LABEL`, `ETIQUETA_ETAPA`, `lib/negociacion.ts`), y lo
  exige una prueba.
- Las fechas pasan por `formatFecha(…, idioma)`: en inglés «Dec 1, 2026». No
  están en el diccionario.
- Las claves globales que el lote reutiliza (`comun.cancelar`, `comun.guardar`)
  y las de propuestas (`propuestas.estatus.*`, por `CLAVE_ESTATUS`) ya estaban
  traducidas y no salen en esta tabla.

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `comercial.unidad.sitio` | `app/(app)/(shell)/comercial/page.tsx:249` | texto en pantalla | sitio | site |
| `comercial.unidad.sitios` | `app/(app)/(shell)/comercial/page.tsx:249` | texto en pantalla | sitios | sites |
| `comercial.unidad.pantalla` | `app/(app)/(shell)/comercial/page.tsx:84`<br>`components/demo/comercial/ReservaDialog.tsx:284` | texto en pantalla | pantalla | screen |
| `comercial.unidad.pantallas` | `app/(app)/(shell)/comercial/page.tsx:84`<br>`components/demo/comercial/ReservaDialog.tsx:284` | texto en pantalla | pantallas | screens |
| `comercial.unidad.resultado` | `app/(app)/(shell)/comercial/page.tsx:422` | texto en pantalla | resultado | result |
| `comercial.unidad.resultados` | `app/(app)/(shell)/comercial/page.tsx:422` | texto en pantalla | resultados | results |
| `comercial.unidad.propuesta-abierta` | `app/(app)/(shell)/comercial/page.tsx:301` | texto en pantalla | propuesta abierta | open proposal |
| `comercial.unidad.propuestas-abiertas` | `app/(app)/(shell)/comercial/page.tsx:302` | texto en pantalla | propuestas abiertas | open proposals |
| `comercial.comun.ej` | `components/demo/comercial/SiteFicha.tsx:1560`<br>`components/demo/comercial/SiteFicha.tsx:1563`<br>`components/demo/comercial/SiteFicha.tsx:1566`<br>`components/demo/comercial/SiteFicha.tsx:1625`<br>`components/demo/comercial/AltaSitioDialog.tsx:193`<br>`components/demo/comercial/AltaSitioDialog.tsx:194`<br>`components/demo/comercial/AltaSitioDialog.tsx:200`<br>`components/demo/comercial/AltaSitioDialog.tsx:201`<br>`components/demo/comercial/AltaSitioDialog.tsx:222` | texto de ejemplo (placeholder) · texto de ejemplo (placeholder) · rótulo | Ej. {valor} | E.g. {valor} |
| `comercial.comun.p-ej` | `components/demo/comercial/AltaSitioDialog.tsx:173`<br>`components/demo/comercial/AltaSitioDialog.tsx:184`<br>`components/demo/comercial/ReservaDialog.tsx:215`<br>`components/demo/comercial/ReservaDialog.tsx:224` | texto de ejemplo (placeholder) | p. ej. {valor} | e.g. {valor} |
| `comercial.comun.si` | `components/demo/comercial/SiteFicha.tsx:500`<br>`components/demo/comercial/SiteFicha.tsx:547`<br>`components/demo/comercial/SiteFicha.tsx:1494` | texto en pantalla · opción de lista | Sí | Yes |
| `comercial.comun.no` | `components/demo/comercial/SiteFicha.tsx:500`<br>`components/demo/comercial/SiteFicha.tsx:547`<br>`components/demo/comercial/SiteFicha.tsx:1495` | texto en pantalla · opción de lista | No | No |
| `comercial.comun.nombre` | `components/demo/comercial/SiteFicha.tsx:1443`<br>`components/demo/comercial/AltaSitioDialog.tsx:172`<br>`components/demo/comercial-opex/ComercialOpex.tsx:603`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1065`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1075` | rótulo · texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo · texto de ejemplo (placeholder) | Nombre | Name |
| `comercial.comun.notas` | `components/demo/comercial/SiteFicha.tsx:1630`<br>`components/demo/comercial-opex/ComercialOpex.tsx:688` | rótulo · texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Notas | Notes |
| `comercial.comun.editar` | `components/demo/comercial/SiteFicha.tsx:397`<br>`components/demo/comercial/SiteFicha.tsx:626`<br>`components/demo/comercial/SiteFicha.tsx:663` | texto en pantalla | Editar | Edit |
| `comercial.comun.eliminar` | `components/demo/comercial/SiteFicha.tsx:423` | texto en pantalla | Eliminar | Delete |
| `comercial.comun.eliminando` | `components/demo/comercial/SiteFicha.tsx:423` | texto en pantalla | Eliminando… | Deleting… |
| `comercial.comun.guardando` | `components/demo/comercial/SiteFicha.tsx:1066`<br>`components/demo/comercial/SiteFicha.tsx:1419` | texto en pantalla | Guardando… | Saving… |
| `comercial.comun.confirmar-guardar` | `components/demo/comercial/SiteFicha.tsx:1068`<br>`components/demo/comercial/SiteFicha.tsx:1421` | texto en pantalla | Confirmar y guardar | Confirm and save |
| `comercial.comun.no-se-pudo-guardar` | `components/demo/comercial/SiteFicha.tsx:1379`<br>`components/demo/comercial-opex/ComercialOpex.tsx:925` | mensaje de error | No se pudo guardar | Could not save |
| `comercial.comun.obligatorio` | `components/demo/comercial/SiteFicha.tsx:1131` | texto en pantalla | ␣(obligatorio) | ␣(required) |
| `comercial.comun.pantalla-propia` | `app/(app)/(shell)/comercial/page.tsx:549`<br>`components/demo/comercial/SiteFicha.tsx:1437`<br>`components/demo/comercial/AltaSitioDialog.tsx:156` | título / tooltip · texto en pantalla | Pantalla propia | Owned screen |
| `comercial.comun.video` | `components/demo/comercial/SiteFicha.tsx:511`<br>`components/demo/comercial/SiteFicha.tsx:1574`<br>`components/demo/comercial/AltaSitioDialog.tsx:208` | texto en pantalla · opción de lista | Video | Video |
| `comercial.comun.imagen` | `components/demo/comercial/SiteFicha.tsx:511`<br>`components/demo/comercial/SiteFicha.tsx:1575`<br>`components/demo/comercial/AltaSitioDialog.tsx:209` | texto en pantalla · opción de lista | Imagen | Image |
| `comercial.comun.tradicional` | `components/demo/comercial/SiteFicha.tsx:542`<br>`components/demo/comercial/AltaSitioDialog.tsx:236` | texto en pantalla | Tradicional | Traditional |
| `comercial.comun.programatico` | `components/demo/comercial/SiteFicha.tsx:542`<br>`components/demo/comercial/AltaSitioDialog.tsx:236` | texto en pantalla | Programático | Programmatic |
| `comercial.comun.cms-otro` | `components/demo/comercial/SiteFicha.tsx:101`<br>`components/demo/comercial/AltaSitioDialog.tsx:46` | texto en pantalla · etiqueta de un valor (mapa de claves) | Otros | Other |
| `comercial.comun.ancho` | `components/demo/comercial/SiteFicha.tsx:1477`<br>`components/demo/comercial/AltaSitioDialog.tsx:200`<br>`components/demo/comercial-opex/ComercialOpex.tsx:334` | rótulo · texto de ejemplo (placeholder) · rótulo | Ancho (m) | Width (m) |
| `comercial.comun.alto` | `components/demo/comercial/SiteFicha.tsx:1480`<br>`components/demo/comercial/AltaSitioDialog.tsx:201`<br>`components/demo/comercial-opex/ComercialOpex.tsx:338` | rótulo · texto de ejemplo (placeholder) · rótulo | Alto (m) | Height (m) |
| `comercial.comun.resolucion-px` | `components/demo/comercial/SiteFicha.tsx:1568`<br>`components/demo/comercial/AltaSitioDialog.tsx:205` | rótulo · texto de ejemplo (placeholder) · rótulo | Resolución (px) | Resolution (px) |
| `comercial.comun.ubicacion` | `components/demo/comercial/SiteFicha.tsx:744`<br>`components/demo/comercial/AltaSitioDialog.tsx:182`<br>`components/demo/comercial-opex/ComercialOpex.tsx:432` | encabezado | Ubicación | Location |
| `comercial.comun.direccion-comercial` | `components/demo/comercial/SiteFicha.tsx:747`<br>`components/demo/comercial/SiteFicha.tsx:1469`<br>`components/demo/comercial/AltaSitioDialog.tsx:189` | texto en pantalla · rótulo | Dirección comercial | Display address |
| `comercial.comun.direccion-predio` | `components/demo/comercial/SiteFicha.tsx:751`<br>`components/demo/comercial/AltaSitioDialog.tsx:186` | texto en pantalla · rótulo | Dirección del predio | Property address |
| `comercial.comun.comercializacion` | `components/demo/comercial/SiteFicha.tsx:541`<br>`components/demo/comercial/AltaSitioDialog.tsx:220` | rótulo · encabezado | Comercialización | Sales model |
| `comercial.comun.caracteristicas` | `components/demo/comercial/SiteFicha.tsx:468`<br>`components/demo/comercial/SiteFicha.tsx:1475` | encabezado · texto en pantalla | Características | Specifications |
| `comercial.comun.disponibilidad` | `components/demo/comercial/SiteFicha.tsx:763`<br>`components/demo/comercial/SiteFicha.tsx:1452` | encabezado · rótulo | Disponibilidad | Availability |
| `comercial.comun.no-disponible` | `app/(app)/(shell)/comercial/page.tsx:383` | opción de lista | No disponible | Not available |
| `comercial.comun.telefono` | `components/demo/comercial-opex/ComercialOpex.tsx:605`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1078` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo · rótulo | Teléfono | Phone |
| `comercial.comun.hace.segundos` | `components/demo/comercial/SpaceEyeVision.tsx:213` | texto en pantalla | hace segundos | seconds ago |
| `comercial.comun.hace.min` | `components/demo/comercial/SpaceEyeVision.tsx:214` | texto en pantalla | hace {n} min | {n} min ago |
| `comercial.comun.hace.horas` | `components/demo/comercial/SpaceEyeVision.tsx:216` | texto en pantalla | hace {n} h | {n} h ago |
| `comercial.comun.hace.dias` | `components/demo/comercial/SpaceEyeVision.tsx:218`<br>`components/demo/comercial-opex/ComercialOpex.tsx:192` | texto en pantalla | hace {n} d | {n} d ago |
| `comercial.sitio-estatus.disponible` | `components/demo/comercial/claves.ts:22` | etiqueta de un valor (mapa de claves) | Disponible | Available |
| `comercial.sitio-estatus.reservado` | `components/demo/comercial/claves.ts:23` | etiqueta de un valor (mapa de claves) | Reservado · sin OC | Booked · no PO |
| `comercial.sitio-estatus.ocupado` | `components/demo/comercial/claves.ts:24` | etiqueta de un valor (mapa de claves) | Ocupado | Occupied |
| `comercial.sitio-estatus.bloqueado` | `components/demo/comercial/claves.ts:25` | etiqueta de un valor (mapa de claves) | Bloqueado | Blocked |
| `comercial.sitio-estatus.en-mantenimiento` | `components/demo/comercial/claves.ts:26` | etiqueta de un valor (mapa de claves) | En mantenimiento | Under maintenance |
| `comercial.sitio-estatus.baja` | `components/demo/comercial/claves.ts:27` | etiqueta de un valor (mapa de claves) | Baja | Decommissioned |
| `comercial.tipo-medio.espectacular` | `components/demo/comercial/claves.ts:31` | etiqueta de un valor (mapa de claves) | Espectacular | Billboard |
| `comercial.tipo-medio.pantalla-digital` | `components/demo/comercial/claves.ts:32` | etiqueta de un valor (mapa de claves) | Pantalla digital | Digital screen |
| `comercial.tipo-medio.puente-peatonal` | `components/demo/comercial/claves.ts:33` | etiqueta de un valor (mapa de claves) | Puente peatonal | Pedestrian bridge |
| `comercial.tipo-medio.mobiliario-urbano` | `components/demo/comercial/claves.ts:34` | etiqueta de un valor (mapa de claves) | Mobiliario urbano | Street furniture |
| `comercial.tipo-medio.mural` | `components/demo/comercial/claves.ts:35` | etiqueta de un valor (mapa de claves) | Mural | Mural |
| `comercial.tipo-medio.valla` | `components/demo/comercial/claves.ts:36` | etiqueta de un valor (mapa de claves) | Valla | Poster panel |
| `comercial.tipo-medio.otro` | `components/demo/comercial/claves.ts:37` | etiqueta de un valor (mapa de claves) | Otro | Other |
| `comercial.contrato-estatus.vigente` | `components/demo/comercial/claves.ts:41` | etiqueta de un valor (mapa de claves) | Vigente | Active |
| `comercial.contrato-estatus.por-vencer` | `components/demo/comercial/claves.ts:42` | etiqueta de un valor (mapa de claves) | Por vencer | Expiring soon |
| `comercial.contrato-estatus.vencido` | `components/demo/comercial/claves.ts:43` | etiqueta de un valor (mapa de claves) | Vencido | Expired |
| `comercial.contrato-estatus.renovado` | `components/demo/comercial/claves.ts:44` | etiqueta de un valor (mapa de claves) | Renovado | Renewed |
| `comercial.contrato-estatus.cancelado` | `components/demo/comercial/claves.ts:45` | etiqueta de un valor (mapa de claves) | Cancelado | Cancelled |
| `comercial.contrato-estatus.incompleto` | `components/demo/comercial/claves.ts:46` | etiqueta de un valor (mapa de claves) | Incompleto | Incomplete |
| `comercial.pago-estatus.pagado` | `components/demo/comercial/claves.ts:50` | etiqueta de un valor (mapa de claves) | Pagado | Paid |
| `comercial.pago-estatus.pendiente` | `components/demo/comercial/claves.ts:51` | etiqueta de un valor (mapa de claves) | Pendiente | Pending |
| `comercial.pago-estatus.vencido` | `components/demo/comercial/claves.ts:52` | etiqueta de un valor (mapa de claves) | Vencido | Overdue |
| `comercial.pagina.titulo` | `app/(app)/(shell)/comercial/page.tsx:246` | encabezado | Comercial | Sales |
| `comercial.pagina.subtitulo` | `app/(app)/(shell)/comercial/page.tsx:248` | texto en pantalla | Tu red en el mapa · {sitios} | Your network on the map · {sitios} |
| `comercial.pagina.nueva-pantalla` | `app/(app)/(shell)/comercial/page.tsx:255` | texto en pantalla | Nueva pantalla | New screen |
| `comercial.pagina.descargadas.uno` | `app/(app)/(shell)/comercial/page.tsx:137` | aviso emergente · etiqueta de un valor (mapa de claves) | Descargadas {n} pantalla | Downloaded {n} screen |
| `comercial.pagina.descargadas.otros` | `app/(app)/(shell)/comercial/page.tsx:137` | aviso emergente · etiqueta de un valor (mapa de claves) | Descargadas {n} pantallas | Downloaded {n} screens |
| `comercial.pagina.descarga-error` | `app/(app)/(shell)/comercial/page.tsx:139` | aviso emergente | No se pudo generar el archivo. Prueba a filtrar para descargar menos pantallas. | Could not generate the file. Try filtering to download fewer screens. |
| `comercial.pagina.kpi.libres` | `app/(app)/(shell)/comercial/page.tsx:272` | rótulo | Libres para vender | Free to sell |
| `comercial.pagina.kpi.libres.sub` | `app/(app)/(shell)/comercial/page.tsx:274` | subtítulo · etiqueta de un valor (mapa de claves) | de {pantallas} | of {pantallas} |
| `comercial.pagina.kpi.libres.sub-filtradas` | `app/(app)/(shell)/comercial/page.tsx:274` | subtítulo · etiqueta de un valor (mapa de claves) | de {pantallas} filtradas | of {pantallas} (filtered) |
| `comercial.pagina.kpi.slots` | `app/(app)/(shell)/comercial/page.tsx:281` | rótulo | Slots digitales libres | Free digital slots |
| `comercial.pagina.kpi.slots.sin-digitales` | `app/(app)/(shell)/comercial/page.tsx:285` | texto en pantalla | no hay digitales en la vista | no digital screens in view |
| `comercial.pagina.kpi.slots.sin-capturar` | `app/(app)/(shell)/comercial/page.tsx:287` | texto en pantalla | las digitales no tienen slots capturados | digital screens have no slots entered |
| `comercial.pagina.kpi.slots.sub` | `app/(app)/(shell)/comercial/page.tsx:288` | texto en pantalla | sumando las digitales de la vista | total across the digital screens in view |
| `comercial.pagina.en-propuesta` | `app/(app)/(shell)/comercial/page.tsx:294`<br>`app/(app)/(shell)/comercial/page.tsx:329` | rótulo · encabezado | En propuesta | In a proposal |
| `comercial.pagina.kpi.propuesta.sub` | `app/(app)/(shell)/comercial/page.tsx:298` | texto en pantalla | pantallas en {propuestas} · no bloquean | screens in {propuestas} · not blocking |
| `comercial.pagina.kpi.propuesta.ninguna` | `app/(app)/(shell)/comercial/page.tsx:305` | texto en pantalla | ninguna propuesta abierta | no open proposals |
| `comercial.pagina.kpi.bloqueadas` | `app/(app)/(shell)/comercial/page.tsx:311` | rótulo | Bloqueadas por contrato | Blocked by contract |
| `comercial.pagina.kpi.bloqueadas.sub` | `app/(app)/(shell)/comercial/page.tsx:313` | subtítulo | contrato incompleto: se arreglan en Arrendadores | incomplete contract: fix them in Landlords |
| `comercial.pagina.kpi.bloqueadas.ninguna` | `app/(app)/(shell)/comercial/page.tsx:313` | subtítulo | todas con contrato completo | all with a complete contract |
| `comercial.pagina.en-propuesta.sub` | `app/(app)/(shell)/comercial/page.tsx:330` | encabezado · subtítulo | pantallas que piden propuestas abiertas · avisan, no bloquean | screens requested by open proposals · a heads-up, not a block |
| `comercial.pagina.en-propuesta.sin-cliente` | `app/(app)/(shell)/comercial/page.tsx:343` | texto en pantalla | sin cliente todavía | no client yet |
| `comercial.pagina.buscar` | `app/(app)/(shell)/comercial/page.tsx:364` | texto de ejemplo (placeholder) | Buscar avenida, distrito… | Search avenue, district… |
| `comercial.pagina.filtro.tipos` | `app/(app)/(shell)/comercial/page.tsx:369` | opción de lista | Todos los tipos | All types |
| `comercial.pagina.filtro.distritos` | `app/(app)/(shell)/comercial/page.tsx:375` | opción de lista | Todos los distritos | All districts |
| `comercial.pagina.filtro.disponibilidad` | `app/(app)/(shell)/comercial/page.tsx:381` | opción de lista | Toda disponibilidad | Any availability |
| `comercial.pagina.filtro.precio` | `app/(app)/(shell)/comercial/page.tsx:388` | opción de lista | Cualquier precio | Any price |
| `comercial.pagina.limpiar` | `app/(app)/(shell)/comercial/page.tsx:404` | texto en pantalla | Limpiar ({n}) | Clear ({n}) |
| `comercial.pagina.inventario` | `app/(app)/(shell)/comercial/page.tsx:417` | encabezado | Inventario | Inventory |
| `comercial.pagina.descargar-excel` | `app/(app)/(shell)/comercial/page.tsx:434` | título / tooltip · encabezado | Descargar estas pantallas en Excel | Download these screens as Excel |
| `comercial.pagina.descargar-csv` | `app/(app)/(shell)/comercial/page.tsx:442` | título / tooltip · encabezado | Descargar estas pantallas en CSV | Download these screens as CSV |
| `comercial.pagina.vacio` | `app/(app)/(shell)/comercial/page.tsx:461` | texto en pantalla | Ninguna pantalla cumple: {filtros}. | No screens match: {filtros}. |
| `comercial.pagina.vacio.busqueda` | `app/(app)/(shell)/comercial/page.tsx:464` | texto en pantalla | «{q}» | “{q}” |
| `comercial.pagina.vacio.tipo` | `app/(app)/(shell)/comercial/page.tsx:466` | texto en pantalla | tipo «{tipo}» | type “{tipo}” |
| `comercial.pagina.vacio.no-disponible` | `app/(app)/(shell)/comercial/page.tsx:475` | texto en pantalla | no disponible | not available |
| `comercial.pagina.vacio.inventario-vacio` | `app/(app)/(shell)/comercial/page.tsx:482` | texto en pantalla | sin pantallas en el inventario | no screens in the inventory |
| `comercial.pagina.vacio.quitar-filtro` | `app/(app)/(shell)/comercial/page.tsx:484` | texto en pantalla | ␣Quita un filtro o pulsa Limpiar. | ␣Remove a filter or click Clear. |
| `comercial.pagina.quitar-seleccion` | `app/(app)/(shell)/comercial/page.tsx:510` | etiqueta accesible (aria-label) · rótulo | Quitar de selección | Remove from selection |
| `comercial.pagina.seleccionar` | `app/(app)/(shell)/comercial/page.tsx:510` | etiqueta accesible (aria-label) · rótulo | Seleccionar para reservar | Select to book |
| `comercial.pagina.propia` | `app/(app)/(shell)/comercial/page.tsx:550` | texto en pantalla | Propia | Owned |
| `comercial.pagina.sin-arrendador` | `app/(app)/(shell)/comercial/page.tsx:549`<br>`app/(app)/(shell)/comercial/page.tsx:550` | título / tooltip · texto en pantalla | Sin arrendador | No landlord |
| `comercial.pagina.completar-contrato` | `app/(app)/(shell)/comercial/page.tsx:586` | título / tooltip · encabezado | Completar el contrato en Arrendadores | Complete the contract in Landlords |
| `comercial.pagina.contrato-incompleto` | `app/(app)/(shell)/comercial/page.tsx:589`<br>`app/(app)/(shell)/comercial/page.tsx:594` | texto en pantalla | Contrato incompleto | Incomplete contract |
| `comercial.pagina.sin-slots` | `app/(app)/(shell)/comercial/page.tsx:608` | texto en pantalla | Sin slots libres | No free slots |
| `comercial.pagina.seleccion` | `app/(app)/(shell)/comercial/page.tsx:622` | texto en pantalla | {n} sel. · {total}/mes | {n} selected · {total}/mo |
| `comercial.pagina.reservar` | `app/(app)/(shell)/comercial/page.tsx:628` | texto en pantalla | Reservar | Book |
| `comercial.pagina.mapa` | `app/(app)/(shell)/comercial/page.tsx:635` | encabezado | Mapa | Map |
| `comercial.pagina.leyenda.digital` | `app/(app)/(shell)/comercial/page.tsx:62` | texto en pantalla | Digital | Digital |
| `comercial.pagina.leyenda.no-libre` | `app/(app)/(shell)/comercial/page.tsx:66` | texto en pantalla | {ocupado} o {bloqueado} | {ocupado} or {bloqueado} |
| `comercial.pagina.alta-hecha` | `app/(app)/(shell)/comercial/page.tsx:655` | aviso emergente | Pantalla "{nombre}" dada de alta | Screen “{nombre}” added |
| `comercial.pagina.sin-contrato-error` | `app/(app)/(shell)/comercial/page.tsx:671` | aviso emergente | Esa pantalla tiene el contrato de arrendamiento incompleto. Complétalo en Arrendadores para poder venderla. | That screen has an incomplete lease contract. Complete it in Landlords to be able to sell it. |
| `comercial.pagina.reservados` | `app/(app)/(shell)/comercial/page.tsx:687` | aviso emergente | Sitios reservados: "{nombre}" | Sites booked for “{nombre}” |
| `comercial.ficha.operativo.activo` | `components/demo/comercial/SiteFicha.tsx:107` | etiqueta de un valor (mapa de claves) | Operativo | Operational |
| `comercial.ficha.operativo.en-mantenimiento` | `components/demo/comercial/SiteFicha.tsx:108` | etiqueta de un valor (mapa de claves) | En mantenimiento | Under maintenance |
| `comercial.ficha.operativo.apagado` | `components/demo/comercial/SiteFicha.tsx:109` | etiqueta de un valor (mapa de claves) | Apagado | Off |
| `comercial.ficha.operativo.danado` | `components/demo/comercial/SiteFicha.tsx:110` | etiqueta de un valor (mapa de claves) | Dañado | Damaged |
| `comercial.ficha.operativo.baja` | `components/demo/comercial/SiteFicha.tsx:111` | etiqueta de un valor (mapa de claves) | Baja | Decommissioned |
| `comercial.ficha.legal.en-orden` | `components/demo/comercial/SiteFicha.tsx:114` | etiqueta de un valor (mapa de claves) | Permiso en orden | Permit in order |
| `comercial.ficha.legal.permiso-vencido` | `components/demo/comercial/SiteFicha.tsx:115` | etiqueta de un valor (mapa de claves) | Permiso vencido | Permit expired |
| `comercial.ficha.legal.en-tramite` | `components/demo/comercial/SiteFicha.tsx:116` | etiqueta de un valor (mapa de claves) | Permiso en trámite | Permit in process |
| `comercial.ficha.legal.suspendido` | `components/demo/comercial/SiteFicha.tsx:117` | etiqueta de un valor (mapa de claves) | Permiso suspendido | Permit suspended |
| `comercial.ficha.legal.sin-permiso` | `components/demo/comercial/SiteFicha.tsx:118` | etiqueta de un valor (mapa de claves) | Sin permiso | No permit |
| `comercial.ficha.reubicada.ot` | `components/demo/comercial/SiteFicha.tsx:215` | aviso emergente | Pantalla reubicada · OT {folio} generada | Screen relocated · work order {folio} created |
| `comercial.ficha.reubicada` | `components/demo/comercial/SiteFicha.tsx:215` | aviso emergente | Pantalla reubicada | Screen relocated |
| `comercial.ficha.reubicar-error` | `components/demo/comercial/SiteFicha.tsx:219` | aviso emergente | No se pudo reubicar | Could not relocate |
| `comercial.ficha.pausar-error` | `components/demo/comercial/SiteFicha.tsx:232` | aviso emergente | No se pudo pausar | Could not pause |
| `comercial.ficha.reanudar-confirmar` | `components/demo/comercial/SiteFicha.tsx:238` | confirmación (diálogo del navegador) | ¿Reanudar "{nombre}"? Volverá a estar disponible comercialmente. | Resume “{nombre}”? It will be available for sale again. |
| `comercial.ficha.reanudar-error` | `components/demo/comercial/SiteFicha.tsx:243` | aviso emergente | No se pudo reanudar | Could not resume |
| `comercial.ficha.eliminar-error` | `components/demo/comercial/SiteFicha.tsx:254` | mensaje de error | No se pudo eliminar la pantalla | Could not delete the screen |
| `comercial.ficha.galeria-guardada` | `components/demo/comercial/SiteFicha.tsx:301` | aviso emergente | Galería guardada | Gallery saved |
| `comercial.ficha.galeria-error` | `components/demo/comercial/SiteFicha.tsx:303` | aviso emergente | No se pudo guardar la imagen | Could not save the image |
| `comercial.ficha.reservar` | `components/demo/comercial/SiteFicha.tsx:361` | texto en pantalla | Reservar este sitio | Book this site |
| `comercial.ficha.no-reservable` | `components/demo/comercial/SiteFicha.tsx:368` | texto en pantalla | Sitio {estatus} · no disponible para reservar | Not available to book (status: {estatus}) |
| `comercial.ficha.pausar-legal` | `components/demo/comercial/SiteFicha.tsx:402`<br>`components/demo/comercial/SiteFicha.tsx:790` | texto en pantalla · título / tooltip · encabezado | Pausar por situación legal | Pause for legal reasons |
| `comercial.ficha.reubicar` | `components/demo/comercial/SiteFicha.tsx:407`<br>`components/demo/comercial/SiteFicha.tsx:827` | texto en pantalla | Reubicar | Relocate |
| `comercial.ficha.pausada` | `components/demo/comercial/SiteFicha.tsx:434` | texto en pantalla | Pausada por situación legal | Paused for legal reasons |
| `comercial.ficha.pausada.desde` | `components/demo/comercial/SiteFicha.tsx:437` | texto en pantalla | ␣· desde {fecha} | ␣· since {fecha} |
| `comercial.ficha.pausada.nota` | `components/demo/comercial/SiteFicha.tsx:439` | texto en pantalla | No disponible comercialmente mientras esté en pausa. | Not available for sale while paused. |
| `comercial.ficha.reanudar` | `components/demo/comercial/SiteFicha.tsx:443` | texto en pantalla | Reanudar | Resume |
| `comercial.ficha.incidencia` | `components/demo/comercial/SiteFicha.tsx:454` | texto en pantalla | Incidencia activa | Active incident |
| `comercial.ficha.galeria` | `components/demo/comercial/SiteFicha.tsx:462` | encabezado | Galería | Gallery |
| `comercial.ficha.agregar-foto` | `components/demo/comercial/SiteFicha.tsx:463` | rótulo | Agregar foto | Add photo |
| `comercial.ficha.codigo-proveedor` | `components/demo/comercial/SiteFicha.tsx:470` | rótulo | Código proveedor | Supplier code |
| `comercial.ficha.tipo` | `components/demo/comercial/SiteFicha.tsx:473` | rótulo | Tipo | Type |
| `comercial.ficha.medidas` | `components/demo/comercial/SiteFicha.tsx:478` | rótulo | Medidas | Dimensions |
| `comercial.ficha.caras` | `components/demo/comercial/SiteFicha.tsx:482`<br>`components/demo/comercial/SiteFicha.tsx:1483` | rótulo | Caras | Faces |
| `comercial.ficha.estructura` | `components/demo/comercial/SiteFicha.tsx:483`<br>`components/demo/comercial/SiteFicha.tsx:1486` | rótulo | Estructura | Structure |
| `comercial.ficha.vista` | `components/demo/comercial/SiteFicha.tsx:488` | rótulo | Vista | Facing |
| `comercial.ficha.tramo` | `components/demo/comercial/SiteFicha.tsx:491`<br>`components/demo/comercial/SiteFicha.tsx:1489` | rótulo | Tramo | Road segment |
| `comercial.ficha.exhibicion` | `components/demo/comercial/SiteFicha.tsx:494` | rótulo | Exhibición | Display |
| `comercial.ficha.exhibicion.digital` | `components/demo/comercial/SiteFicha.tsx:123` | etiqueta de un valor (mapa de claves) | digital | digital |
| `comercial.ficha.exhibicion.fija` | `components/demo/comercial/SiteFicha.tsx:124` | etiqueta de un valor (mapa de claves) | fija | static |
| `comercial.ficha.exhibicion.rotativo` | `components/demo/comercial/SiteFicha.tsx:125` | etiqueta de un valor (mapa de claves) | rotativo | rotating |
| `comercial.ficha.exhibicion.rotativa` | `components/demo/comercial/SiteFicha.tsx:495` | texto en pantalla | ␣· rotativo | ␣· rotating |
| `comercial.ficha.iluminado` | `components/demo/comercial/SiteFicha.tsx:499`<br>`components/demo/comercial/SiteFicha.tsx:1492` | rótulo | Iluminado | Illuminated |
| `comercial.ficha.resolucion` | `components/demo/comercial/SiteFicha.tsx:507` | rótulo | Resolución | Resolution |
| `comercial.ficha.contenido` | `components/demo/comercial/SiteFicha.tsx:510`<br>`components/demo/comercial/SiteFicha.tsx:1571` | rótulo | Contenido | Content |
| `comercial.ficha.total-slots` | `components/demo/comercial/SiteFicha.tsx:513` | rótulo | Total de slots | Total slots |
| `comercial.ficha.slots-disponibles` | `components/demo/comercial/SiteFicha.tsx:514` | rótulo | Slots disponibles | Available slots |
| `comercial.ficha.slots-hora` | `components/demo/comercial/SiteFicha.tsx:515`<br>`components/demo/comercial/SiteFicha.tsx:1565` | rótulo | Slots por hora | Slots per hour |
| `comercial.ficha.duracion-slot` | `components/demo/comercial/SiteFicha.tsx:516` | rótulo | Duración por slot | Slot length |
| `comercial.ficha.horario` | `components/demo/comercial/SiteFicha.tsx:517`<br>`components/demo/comercial/SiteFicha.tsx:1624` | rótulo | Horario | Operating hours |
| `comercial.ficha.id-doohmain` | `components/demo/comercial/SiteFicha.tsx:525`<br>`components/demo/comercial/SiteFicha.tsx:1585` | rótulo | Id en DOOHmain | DOOHmain ID |
| `comercial.ficha.en-network` | `components/demo/comercial/SiteFicha.tsx:546` | rótulo | En Network | On the Network |
| `comercial.ficha.datos-comerciales` | `components/demo/comercial/SiteFicha.tsx:558` | encabezado | Datos comerciales | Commercial data |
| `comercial.ficha.tarifa-publicada` | `components/demo/comercial/SiteFicha.tsx:560` | rótulo | Tarifa publicada ({unidad}) | Published rate ({unidad}) |
| `comercial.ficha.renta-mensual` | `components/demo/comercial/SiteFicha.tsx:566` | rótulo | Renta al arrendador (mensual) | Rent to landlord (monthly) |
| `comercial.ficha.propia-sin-renta` | `components/demo/comercial/SiteFicha.tsx:569` | texto en pantalla | Propia: sin renta | Owned: no rent |
| `comercial.ficha.sin-contrato-activo` | `components/demo/comercial/SiteFicha.tsx:570` | texto en pantalla | Sin contrato activo | No active contract |
| `comercial.ficha.propia.aviso` | `components/demo/comercial/SiteFicha.tsx:580` | texto en pantalla | Pantalla propia: no se le paga renta a nadie. Su costo es la luz y la operación; el margen real lo ves en {reportes}. | Owned screen: no rent is paid to anyone. Its costs are electricity and operations; you can see the real margin in {reportes}. |
| `comercial.ficha.propia.reportes` | `components/demo/comercial/SiteFicha.tsx:580` | texto en pantalla | Reportes | Reports |
| `comercial.ficha.sin-contrato.aviso` | `components/demo/comercial/SiteFicha.tsx:588` | texto en pantalla | Sin contrato de arrendamiento activo no se puede calcular el margen: falta saber qué se paga por el espacio. Complétalo en {arrendadores}. | Without an active lease contract the margin cannot be calculated: we need to know what is paid for the space. Complete it in {arrendadores}. |
| `comercial.ficha.arrendadores` | `components/demo/comercial/SiteFicha.tsx:589` | texto en pantalla | Arrendadores | Landlords |
| `comercial.ficha.margen` | `components/demo/comercial/SiteFicha.tsx:599` | texto en pantalla | Margen | Margin |
| `comercial.ficha.tarifas-unidad` | `components/demo/comercial/SiteFicha.tsx:618` | texto en pantalla | Tarifas por unidad | Rates per unit |
| `comercial.ficha.tarifas-unidad.vacio` | `components/demo/comercial/SiteFicha.tsx:641` | texto en pantalla | Sin tarifas por unidad. Se vende solo con la tarifa publicada de arriba; para cotizar por spot, hora o programático hay que añadirlas aquí. | No rates per unit. It is sold only at the published rate above; to quote per spot, per hour or programmatic, add them here. |
| `comercial.ficha.tarifas-franja` | `components/demo/comercial/SiteFicha.tsx:656` | texto en pantalla | Tarifas por franja | Rates per daypart |
| `comercial.ficha.tarifas-franja.vacio` | `components/demo/comercial/SiteFicha.tsx:668` | texto en pantalla | Sin rejilla: esta pantalla se vende con las tarifas de arriba a cualquier hora y en cualquier época. Añade una solo si el prime o una temporada cuestan distinto. | No rate grid: this screen sells at the rates above at any hour and in any season. Add one only if prime time or a season is priced differently. |
| `comercial.ficha.arrendador-renta` | `components/demo/comercial/SiteFicha.tsx:677` | encabezado | Arrendador y renta | Landlord and rent |
| `comercial.ficha.arrendador-sin-asignar` | `components/demo/comercial/SiteFicha.tsx:683` | texto en pantalla | Arrendador sin asignar | Landlord not assigned |
| `comercial.ficha.arrendador-del-predio` | `components/demo/comercial/SiteFicha.tsx:685` | texto en pantalla | Arrendador del predio / pantalla | Landlord of the property / screen |
| `comercial.ficha.renta` | `components/demo/comercial/SiteFicha.tsx:696` | rótulo | Renta | Rent |
| `comercial.ficha.periodicidad` | `components/demo/comercial/SiteFicha.tsx:697` | rótulo | Cada cuándo se paga | Payment frequency |
| `comercial.ficha.vigencia` | `components/demo/comercial/SiteFicha.tsx:701` | rótulo | Vigencia | Term |
| `comercial.ficha.por-definir` | `components/demo/comercial/SiteFicha.tsx:702` | texto en pantalla | por definir | to be defined |
| `comercial.ficha.renovacion` | `components/demo/comercial/SiteFicha.tsx:709` | rótulo | Renovación | Renewal |
| `comercial.ficha.renovacion.automatica` | `components/demo/comercial/SiteFicha.tsx:710` | texto en pantalla | Automática | Automatic |
| `comercial.ficha.renovacion.manual` | `components/demo/comercial/SiteFicha.tsx:710` | texto en pantalla | Manual | Manual |
| `comercial.ficha.ultimo-pago` | `components/demo/comercial/SiteFicha.tsx:719` | texto en pantalla | Último pago | Last payment |
| `comercial.ficha.proximo` | `components/demo/comercial/SiteFicha.tsx:724` | texto en pantalla | Próximo: | Next: |
| `comercial.ficha.sin-pagos` | `components/demo/comercial/SiteFicha.tsx:728` | texto en pantalla | Sin pagos pendientes | No pending payments |
| `comercial.ficha.propia.sin-renta` | `components/demo/comercial/SiteFicha.tsx:736` | texto en pantalla | Pantalla propia: sin arrendador ni renta. | Owned screen: no landlord and no rent. |
| `comercial.ficha.sin-renta` | `components/demo/comercial/SiteFicha.tsx:737` | texto en pantalla | Sin arrendador ni renta registrados para este espacio. | No landlord or rent on record for this space. |
| `comercial.ficha.coordenadas` | `components/demo/comercial/SiteFicha.tsx:755` | texto en pantalla | Coordenadas | Coordinates |
| `comercial.ficha.pausar.ayuda` | `components/demo/comercial/SiteFicha.tsx:803` | texto en pantalla | La pantalla saldrá de la disponibilidad comercial (queda bloqueada) hasta que la reanudes. | The screen will be taken off sale (blocked) until you resume it. |
| `comercial.ficha.pausar.motivo` | `components/demo/comercial/SiteFicha.tsx:805` | rótulo | Motivo | Reason |
| `comercial.ficha.pausar.motivo-ej` | `components/demo/comercial/SiteFicha.tsx:810` | texto de ejemplo (placeholder) | Ej. Litigio del predio, permiso suspendido, orden de autoridad… | E.g. property dispute, suspended permit, official order… |
| `comercial.ficha.pausar.pausando` | `components/demo/comercial/SiteFicha.tsx:796` | texto en pantalla | Pausando… | Pausing… |
| `comercial.ficha.pausar.boton` | `components/demo/comercial/SiteFicha.tsx:796` | texto en pantalla | Pausar | Pause |
| `comercial.ficha.reubicar.titulo` | `components/demo/comercial/SiteFicha.tsx:821` | título / tooltip · encabezado | Reubicar pantalla | Relocate screen |
| `comercial.ficha.reubicar.reubicando` | `components/demo/comercial/SiteFicha.tsx:827` | texto en pantalla | Reubicando… | Relocating… |
| `comercial.ficha.reubicar.ayuda` | `components/demo/comercial/SiteFicha.tsx:834` | texto en pantalla | Mueve la pantalla a otro predio. Se generará una OT de reubicación en Operaciones. | Moves the screen to another property. A relocation work order will be created in Operations. |
| `comercial.ficha.reubicar.destino` | `components/demo/comercial/SiteFicha.tsx:836` | rótulo | Predio destino | Destination property |
| `comercial.ficha.reubicar.elige` | `components/demo/comercial/SiteFicha.tsx:838` | opción de lista | — Elige el predio — | — Choose the property — |
| `comercial.ficha.eliminar.titulo` | `components/demo/comercial/SiteFicha.tsx:858` | título / tooltip · encabezado | Eliminar {nombre} | Delete {nombre} |
| `comercial.ficha.eliminar.confirmar` | `components/demo/comercial/SiteFicha.tsx:859` | texto en pantalla | Confirmar y eliminar | Confirm and delete |
| `comercial.ficha.eliminar.boton` | `components/demo/comercial/SiteFicha.tsx:859` | texto en pantalla | Eliminar pantalla | Delete screen |
| `comercial.ficha.eliminar.texto` | `components/demo/comercial/SiteFicha.tsx:867` | texto en pantalla | Se elimina la pantalla y deja de poder reservarse. Sus reservas y su historial quedan como estén: {aviso}. | The screen is deleted and can no longer be booked. Its bookings and history stay as they are: {aviso}. |
| `comercial.ficha.eliminar.aviso` | `components/demo/comercial/SiteFicha.tsx:868` | texto en pantalla | esta acción no se puede deshacer | this cannot be undone |
| `comercial.vista.norte` | `components/demo/comercial/SiteFicha.tsx:897` | etiqueta de un valor (mapa de claves) | Norte | North |
| `comercial.vista.sur` | `components/demo/comercial/SiteFicha.tsx:898` | etiqueta de un valor (mapa de claves) | Sur | South |
| `comercial.vista.este` | `components/demo/comercial/SiteFicha.tsx:899` | etiqueta de un valor (mapa de claves) | Este | East |
| `comercial.vista.oeste` | `components/demo/comercial/SiteFicha.tsx:900` | etiqueta de un valor (mapa de claves) | Oeste | West |
| `comercial.vista.noreste` | `components/demo/comercial/SiteFicha.tsx:901` | etiqueta de un valor (mapa de claves) | Noreste | Northeast |
| `comercial.vista.noroeste` | `components/demo/comercial/SiteFicha.tsx:902` | etiqueta de un valor (mapa de claves) | Noroeste | Northwest |
| `comercial.vista.sureste` | `components/demo/comercial/SiteFicha.tsx:903` | etiqueta de un valor (mapa de claves) | Sureste | Southeast |
| `comercial.vista.suroeste` | `components/demo/comercial/SiteFicha.tsx:904` | etiqueta de un valor (mapa de claves) | Suroeste | Southwest |
| `comercial.tarifas.guardadas` | `components/demo/comercial/SiteFicha.tsx:1014` | aviso emergente | Tarifas por unidad guardadas | Rates per unit saved |
| `comercial.tarifas.error` | `components/demo/comercial/SiteFicha.tsx:1018` | mensaje de error | No se pudieron guardar las tarifas | Could not save the rates |
| `comercial.tarifas.titulo` | `components/demo/comercial/SiteFicha.tsx:1047` | título / tooltip · encabezado | Tarifas por unidad de venta | Rates per sales unit |
| `comercial.tarifas.guardar` | `components/demo/comercial/SiteFicha.tsx:1069` | texto en pantalla | Guardar tarifas | Save rates |
| `comercial.tarifas.ayuda` | `components/demo/comercial/SiteFicha.tsx:1078` | texto en pantalla | Una tarifa por cada forma de vender esta pantalla. Es lo que usa el cotizador de Propuestas: sin una tarifa de «spot» no se puede cotizar por spot. | One rate for each way this screen is sold. The Proposals quote builder uses them: without a “spot” rate it cannot be quoted per spot. |
| `comercial.tarifas.fija` | `components/demo/comercial/SiteFicha.tsx:1080` | texto en pantalla | ␣Esta pantalla es {fija}, así que solo se vende por mensual o catorcenal. | ␣This screen is {fija}, so it is only sold monthly or every two weeks. |
| `comercial.tarifas.fija.palabra` | `components/demo/comercial/SiteFicha.tsx:1081` | texto en pantalla | fija | static |
| `comercial.tarifas.vacio` | `components/demo/comercial/SiteFicha.tsx:1087` | texto en pantalla | Todavía no hay ninguna. Añade la primera abajo. | None yet. Add the first one below. |
| `comercial.tarifas.conservar` | `components/demo/comercial/SiteFicha.tsx:1107` | título / tooltip | Conservar esta unidad | Keep this unit |
| `comercial.tarifas.dejar` | `components/demo/comercial/SiteFicha.tsx:1107` | título / tooltip | Dejar de vender por esta unidad | Stop selling by this unit |
| `comercial.tarifas.tarifa` | `components/demo/comercial/SiteFicha.tsx:1135` | texto de ejemplo (placeholder) | Tarifa | Rate |
| `comercial.tarifas.quitar` | `components/demo/comercial/SiteFicha.tsx:1145` | título / tooltip · encabezado | Quitar | Remove |
| `comercial.tarifas.falta` | `components/demo/comercial/SiteFicha.tsx:1156` | texto en pantalla | Falta la tarifa de la unidad en rojo. Escríbela o quita la unidad. | The rate for the unit in red is missing. Enter it or remove the unit. |
| `comercial.tarifas.no-se-entiende` | `components/demo/comercial/SiteFicha.tsx:1161` | texto en pantalla | Hay una tarifa en rojo que no se entiende: la coma separa miles y el punto, decimales ({ejemplo}). | A rate in red cannot be read: the comma separates thousands and the period, decimals ({ejemplo}). |
| `comercial.tarifas.anadir-unidad` | `components/demo/comercial/SiteFicha.tsx:1172` | opción de lista | Añadir unidad… | Add unit… |
| `comercial.tarifas.anadir` | `components/demo/comercial/SiteFicha.tsx:1178` | texto en pantalla | Añadir | Add |
| `comercial.editar.titulo` | `components/demo/comercial/SiteFicha.tsx:1396` | título / tooltip · encabezado | Editar pantalla | Edit screen |
| `comercial.editar.guardar` | `components/demo/comercial/SiteFicha.tsx:1422` | texto en pantalla | Guardar cambios | Save changes |
| `comercial.editar.propia.ayuda` | `components/demo/comercial/SiteFicha.tsx:1439` | texto en pantalla | De la empresa: sin renta ni contrato. Se vende sin contrato y su costo es luz y operación. | Company-owned: no rent and no contract. It is sold without a contract and its costs are electricity and operations. |
| `comercial.editar.tipo-medio` | `components/demo/comercial/SiteFicha.tsx:1447` | rótulo | Tipo de medio | Media type |
| `comercial.editar.vista` | `components/demo/comercial/SiteFicha.tsx:1457` | rótulo | Vista (dirección) | Facing (direction) |
| `comercial.editar.sin-definir` | `components/demo/comercial/SiteFicha.tsx:1459`<br>`components/demo/comercial/SiteFicha.tsx:1573`<br>`components/demo/comercial/SiteFicha.tsx:1580` | opción de lista | — Sin definir — | — Not set — |
| `comercial.editar.alcaldia` | `components/demo/comercial/SiteFicha.tsx:1466` | rótulo | Distrito / alcaldía | District / borough |
| `comercial.editar.estructura-ej` | `components/demo/comercial/SiteFicha.tsx:1487` | texto de ejemplo (placeholder) | unipolar, mupi… | monopole, mupi… |
| `comercial.editar.tarifa` | `components/demo/comercial/SiteFicha.tsx:1502` | rótulo | Tarifa publicada (mensual) | Published rate (monthly) |
| `comercial.editar.arrendador` | `components/demo/comercial/SiteFicha.tsx:1511`<br>`components/demo/comercial/SiteFicha.tsx:1512` | texto en pantalla · rótulo | Arrendador | Landlord |
| `comercial.editar.sin-asignar` | `components/demo/comercial/SiteFicha.tsx:1514` | opción de lista | — Sin asignar — | — Unassigned — |
| `comercial.editar.renta.ayuda` | `components/demo/comercial/SiteFicha.tsx:1521` | texto en pantalla | La renta y su periodicidad viven en el contrato, no en la pantalla. El importe se puede corregir desde la tabla de Inventario; la periodicidad y la vigencia, en Arrendadores. | Rent and its payment frequency live in the contract, not on the screen. The amount can be corrected from the Inventory table; the frequency and the term, in Landlords. |
| `comercial.editar.cupo` | `components/demo/comercial/SiteFicha.tsx:1529` | texto en pantalla | Cupo de clientes | Client cap |
| `comercial.editar.cupo.maximo` | `components/demo/comercial/SiteFicha.tsx:1530` | rótulo | Máximo de clientes distintos | Maximum distinct clients |
| `comercial.editar.cupo.global-ph` | `components/demo/comercial/SiteFicha.tsx:1537` | texto de ejemplo (placeholder) | Global: {n} | Global: {n} |
| `comercial.editar.cupo.sin-limite` | `components/demo/comercial/SiteFicha.tsx:1537` | texto de ejemplo (placeholder) | Sin límite | No limit |
| `comercial.editar.cupo.ayuda` | `components/demo/comercial/SiteFicha.tsx:1542` | texto en pantalla | Cuántos anunciantes distintos pueden compartir esta pantalla a la vez. Vacío = {vacio} Un cliente que ya está en la pantalla puede seguir metiendo campañas mientras queden slots. | How many distinct advertisers can share this screen at the same time. Empty = {vacio} A client already on the screen can keep adding campaigns while slots remain. |
| `comercial.editar.cupo.global` | `components/demo/comercial/SiteFicha.tsx:1545` | texto en pantalla | usa el valor global ({n}), que se fija en Administración. | uses the global value ({n}), set in Settings. |
| `comercial.editar.cupo.sin-global` | `components/demo/comercial/SiteFicha.tsx:1546` | texto en pantalla | sin límite (no hay valor global configurado). | no limit (no global value configured). |
| `comercial.editar.cupo.ahora.uno` | `components/demo/comercial/SiteFicha.tsx:1550` | etiqueta de un valor (mapa de claves) | ␣Ahora mismo tiene {n}. | ␣It currently has {n} client. |
| `comercial.editar.cupo.ahora.otros` | `components/demo/comercial/SiteFicha.tsx:1550` | etiqueta de un valor (mapa de claves) | ␣Ahora mismo tiene {n}. | ␣It currently has {n} clients. |
| `comercial.editar.dooh` | `components/demo/comercial/SiteFicha.tsx:1557` | texto en pantalla | Especificaciones DOOH | DOOH specifications |
| `comercial.editar.cantidad-slots` | `components/demo/comercial/SiteFicha.tsx:1559` | rótulo | Cantidad de slots | Number of slots |
| `comercial.editar.duracion-slot` | `components/demo/comercial/SiteFicha.tsx:1562` | rótulo | Duración por slot (s) | Slot length (s) |
| `comercial.editar.doohmain.hoy` | `components/demo/comercial/SiteFicha.tsx:1592` | texto en pantalla | Hoy se usa {id} ({origen}) | Currently using {id} ({origen}) |
| `comercial.editar.doohmain.mapa` | `components/demo/comercial/SiteFicha.tsx:1596` | texto en pantalla | mapa del servidor | server map |
| `comercial.editar.doohmain.omision` | `components/demo/comercial/SiteFicha.tsx:1597` | texto en pantalla | por omisión | default |
| `comercial.editar.doohmain.vacio` | `components/demo/comercial/SiteFicha.tsx:1599` | texto en pantalla | Vacío = la decide el servidor | Empty = the server decides |
| `comercial.editar.doohmain.al-publicar` | `components/demo/comercial/SiteFicha.tsx:1608` | texto en pantalla | Al publicar se usa {id}, {origen}. Escríbelo aquí para fijarlo en la ficha. | When publishing, {id} is used, {origen}. Enter it here to pin it on the profile. |
| `comercial.editar.doohmain.error` | `components/demo/comercial/SiteFicha.tsx:1619` | texto en pantalla | No se pudo leer la lista de DOOHmain ({error}); escribe el nombre tal como aparece allí. | Could not read the DOOHmain list ({error}); enter the name exactly as it appears there. |
| `comercial.editar.estatus.disponible` | `components/demo/comercial/SiteFicha.tsx:884` | etiqueta de un valor (mapa de claves) | Disponible | Available |
| `comercial.editar.estatus.reservado` | `components/demo/comercial/SiteFicha.tsx:885` | etiqueta de un valor (mapa de claves) | Reservado | Booked |
| `comercial.editar.estatus.ocupado` | `components/demo/comercial/SiteFicha.tsx:886` | etiqueta de un valor (mapa de claves) | Ocupado | Occupied |
| `comercial.editar.estatus.bloqueado` | `components/demo/comercial/SiteFicha.tsx:887` | etiqueta de un valor (mapa de claves) | Bloqueado | Blocked |
| `comercial.alta.titulo` | `components/demo/comercial/AltaSitioDialog.tsx:138` | título / tooltip · encabezado | Alta de pantalla | Add a screen |
| `comercial.alta.subtitulo` | `components/demo/comercial/AltaSitioDialog.tsx:139` | título / tooltip · encabezado · subtítulo | Registra una nueva ubicación en tu inventario | Register a new location in your inventory |
| `comercial.alta.creando` | `components/demo/comercial/AltaSitioDialog.tsx:146` | texto en pantalla | Creando… | Creating… |
| `comercial.alta.crear` | `components/demo/comercial/AltaSitioDialog.tsx:146` | texto en pantalla | Crear pantalla | Create screen |
| `comercial.alta.identificacion` | `components/demo/comercial/AltaSitioDialog.tsx:152` | encabezado | Identificación | Identification |
| `comercial.alta.propia.ayuda` | `components/demo/comercial/AltaSitioDialog.tsx:158` | texto en pantalla | Es de la empresa: no se le paga renta a nadie. Se puede vender sin contrato y su costo es solo luz y operación. | It belongs to the company: no rent is paid to anyone. It can be sold without a contract and its only costs are electricity and operations. |
| `comercial.alta.arrendador` | `components/demo/comercial/AltaSitioDialog.tsx:163` | rótulo | Arrendador (dueño del espacio) | Landlord (space owner) |
| `comercial.alta.elige-arrendador` | `components/demo/comercial/AltaSitioDialog.tsx:165` | opción de lista | Elige un arrendador… | Choose a landlord… |
| `comercial.alta.nombre-ej` | `components/demo/comercial/AltaSitioDialog.tsx:173` | texto de ejemplo (placeholder) | Espectacular Av. Brasil | Billboard Av. Brasil |
| `comercial.alta.tipo` | `components/demo/comercial/AltaSitioDialog.tsx:175` | rótulo | Tipo / formato | Type / format |
| `comercial.alta.distrito` | `components/demo/comercial/AltaSitioDialog.tsx:183` | rótulo | Distrito / plaza | District / market |
| `comercial.alta.direccion-fisica` | `components/demo/comercial/AltaSitioDialog.tsx:187` | texto de ejemplo (placeholder) | Dirección física | Physical address |
| `comercial.alta.direccion-mostrada` | `components/demo/comercial/AltaSitioDialog.tsx:190` | texto de ejemplo (placeholder) | Dirección que se muestra | Address shown |
| `comercial.alta.latitud` | `components/demo/comercial/AltaSitioDialog.tsx:193` | texto de ejemplo (placeholder) · rótulo | Latitud | Latitude |
| `comercial.alta.longitud` | `components/demo/comercial/AltaSitioDialog.tsx:194` | texto de ejemplo (placeholder) · rótulo | Longitud | Longitude |
| `comercial.alta.caracteristicas` | `components/demo/comercial/AltaSitioDialog.tsx:198` | encabezado | Características del espacio | Space specifications |
| `comercial.alta.tipo-contenido` | `components/demo/comercial/AltaSitioDialog.tsx:206` | rótulo | Tipo de contenido | Content type |
| `comercial.alta.iluminacion` | `components/demo/comercial/AltaSitioDialog.tsx:216` | texto en pantalla | Cuenta con iluminación | Has lighting |
| `comercial.alta.tarifa` | `components/demo/comercial/AltaSitioDialog.tsx:221` | rótulo | Tarifa publicada ({simbolo}) | Published rate ({simbolo}) |
| `comercial.alta.regla` | `components/demo/comercial/AltaSitioDialog.tsx:224` | rótulo | Regla de comercialización | Sales rule |
| `comercial.alta.network` | `components/demo/comercial/AltaSitioDialog.tsx:250` | texto en pantalla | Compartir a la Network (inventario no vendido) | Share to the Network (unsold inventory) |
| `comercial.reserva.tipo.dooh` | `components/demo/comercial/ReservaDialog.tsx:40` | etiqueta de un valor (mapa de claves) | Digital | Digital |
| `comercial.reserva.tipo.ooh` | `components/demo/comercial/ReservaDialog.tsx:41` | etiqueta de un valor (mapa de claves) | Fijo | Static |
| `comercial.reserva.tipo.hibrida` | `components/demo/comercial/ReservaDialog.tsx:42` | etiqueta de un valor (mapa de claves) | Híbrida | Hybrid |
| `comercial.reserva.nombre-por-omision` | `components/demo/comercial/ReservaDialog.tsx:157` | texto en pantalla | {cliente} — campaña | {cliente} — campaign |
| `comercial.reserva.titulo` | `components/demo/comercial/ReservaDialog.tsx:178` | título / tooltip · encabezado | Reservar sitios | Book sites |
| `comercial.reserva.seleccionados.uno` | `components/demo/comercial/ReservaDialog.tsx:179` | título / tooltip · encabezado · subtítulo · etiqueta de un valor (mapa de claves) | {n} sitio seleccionado | {n} site selected |
| `comercial.reserva.seleccionados.otros` | `components/demo/comercial/ReservaDialog.tsx:179` | título / tooltip · encabezado · subtítulo · etiqueta de un valor (mapa de claves) | {n} sitios seleccionados | {n} sites selected |
| `comercial.reserva.total` | `components/demo/comercial/ReservaDialog.tsx:183` | texto en pantalla | Total mensual {monto} | Monthly total {monto} |
| `comercial.reserva.slots` | `components/demo/comercial/ReservaDialog.tsx:188` | texto en pantalla | ␣· {n} slots | ␣· {n} slots |
| `comercial.reserva.cada-uno` | `components/demo/comercial/ReservaDialog.tsx:192` | texto en pantalla | ␣· {seg} c/u | ␣· {seg} each |
| `comercial.reserva.reservando` | `components/demo/comercial/ReservaDialog.tsx:203` | texto en pantalla | Reservando… | Booking… |
| `comercial.reserva.reservar` | `components/demo/comercial/ReservaDialog.tsx:203` | texto en pantalla | Reservar (tentativa) | Book (tentative) |
| `comercial.reserva.cliente` | `components/demo/comercial/ReservaDialog.tsx:210` | rótulo | Cliente | Client |
| `comercial.reserva.cliente-ej` | `components/demo/comercial/ReservaDialog.tsx:215` | texto de ejemplo (placeholder) | Seguros Andinos | Seguros Andinos |
| `comercial.reserva.nombre` | `components/demo/comercial/ReservaDialog.tsx:219` | rótulo | Nombre de campaña | Campaign name |
| `comercial.reserva.nombre-ej` | `components/demo/comercial/ReservaDialog.tsx:224` | texto de ejemplo (placeholder) | Lanzamiento Q3 | Q3 launch |
| `comercial.reserva.inicio` | `components/demo/comercial/ReservaDialog.tsx:228` | rótulo | Inicio | Start |
| `comercial.reserva.fin` | `components/demo/comercial/ReservaDialog.tsx:231` | rótulo | Fin | End |
| `comercial.reserva.tipo` | `components/demo/comercial/ReservaDialog.tsx:235` | rótulo | Tipo de campaña | Campaign type |
| `comercial.reserva.tipo.auto` | `components/demo/comercial/ReservaDialog.tsx:241` | opción de lista | Automático ({tipo} — según sitios) | Automatic ({tipo} — based on the sites) |
| `comercial.reserva.tipo.dooh-opcion` | `components/demo/comercial/ReservaDialog.tsx:242` | opción de lista | Digital (DOOH) — sin imprenta | Digital (DOOH) — no printing |
| `comercial.reserva.tipo.ooh-opcion` | `components/demo/comercial/ReservaDialog.tsx:243` | opción de lista | Fijo (OOH) — con imprenta | Static (OOH) — with printing |
| `comercial.reserva.tipo.hibrida-opcion` | `components/demo/comercial/ReservaDialog.tsx:244` | opción de lista | Híbrida — con imprenta | Hybrid — with printing |
| `comercial.reserva.loop` | `components/demo/comercial/ReservaDialog.tsx:254` | texto en pantalla | Loop de {loop} · slot de {slot} → {n} slots por loop | Loop of {loop} · slot of {slot} → {n} slots per loop |
| `comercial.reserva.loop.referencia` | `components/demo/comercial/ReservaDialog.tsx:259` | texto en pantalla | (referencia, de Administración → Configuración) | (reference value, set in Settings) |
| `comercial.reserva.slots-propios.uno` | `components/demo/comercial/ReservaDialog.tsx:263` | texto en pantalla | {nombre} tiene {n} slots propios y manda sobre este número. | {nombre} has its own {n} slots, which take precedence over this number. |
| `comercial.reserva.slots-propios.otros` | `components/demo/comercial/ReservaDialog.tsx:267` | texto en pantalla | {n} de las pantallas elegidas tienen su propio número de slots, y manda el suyo. | {n} of the selected screens have their own number of slots, and theirs takes precedence. |
| `comercial.reserva.sin-cupo.uno` | `components/demo/comercial/ReservaDialog.tsx:282` | texto en pantalla | Una pantalla ya llegó a su cupo de clientes | One screen has reached its client cap |
| `comercial.reserva.sin-cupo.otros` | `components/demo/comercial/ReservaDialog.tsx:283` | texto en pantalla | {pantallas} ya llegaron a su cupo de clientes | {pantallas} have reached their client cap |
| `comercial.reserva.sin-cupo.fila.uno` | `components/demo/comercial/ReservaDialog.tsx:291` | etiqueta de un valor (mapa de claves) | {nombre} — {cupo} cliente en esas fechas ({ocupantes}) | {nombre} — cap of {cupo} client on those dates, taken by {ocupantes} |
| `comercial.reserva.sin-cupo.fila.otros` | `components/demo/comercial/ReservaDialog.tsx:291` | etiqueta de un valor (mapa de claves) | {nombre} — {cupo} clientes en esas fechas ({ocupantes}) | {nombre} — cap of {cupo} clients on those dates, taken by {ocupantes} |
| `comercial.reserva.sin-cupo.ayuda` | `components/demo/comercial/ReservaDialog.tsx:302` | texto en pantalla | La reserva se rechazará completa. Quita esas pantallas, cambia las fechas, o sube su cupo desde su ficha. | The whole booking will be rejected. Remove the screen(s) above, change the dates, or raise the cap from each screen’s profile. |
| `comercial.reserva.de-slots` | `components/demo/comercial/ReservaDialog.tsx:325` | texto en pantalla | Reserva {campo} de {disp} slots | Book {campo} of {disp} slots |
| `comercial.reserva.quedan` | `components/demo/comercial/ReservaDialog.tsx:346` | texto en pantalla | Quedan {n} | {n} left |
| `comercial.eye.sin-conexion` | `components/demo/comercial/SpaceEyeVision.tsx:44`<br>`components/demo/comercial/SpaceEyeVision.tsx:78` | mensaje de error · texto en pantalla | No se pudo conectar con Space Eye | Could not connect to Space Eye |
| `comercial.eye.titulo` | `components/demo/comercial/SpaceEyeVision.tsx:59` | encabezado | Inteligencia artificial · Space Eye | Artificial intelligence · Space Eye |
| `comercial.eye.sincronizar.titulo` | `components/demo/comercial/SpaceEyeVision.tsx:65` | título / tooltip · encabezado | Sincronizar con Space Eye | Sync with Space Eye |
| `comercial.eye.sincronizar` | `components/demo/comercial/SpaceEyeVision.tsx:68` | texto en pantalla | Sincronizar | Sync |
| `comercial.eye.no-configurado` | `components/demo/comercial/SpaceEyeVision.tsx:85` | texto en pantalla | La integración con Space Eye no está configurada en este entorno. | The Space Eye integration is not configured in this environment. |
| `comercial.eye.sin-camara` | `components/demo/comercial/SpaceEyeVision.tsx:86` | texto en pantalla | Esta pantalla no tiene una cámara Space Eye vinculada (sin dispositivo con ese código). | This screen has no linked Space Eye camera (no device with that code). |
| `comercial.eye.en-linea` | `components/demo/comercial/SpaceEyeVision.tsx:94` | texto en pantalla | En línea | Online |
| `comercial.eye.desconectado` | `components/demo/comercial/SpaceEyeVision.tsx:96` | texto en pantalla | Desconectado | Offline |
| `comercial.eye.ultima-senal` | `components/demo/comercial/SpaceEyeVision.tsx:106` | texto en pantalla | Última señal {hace} | Last signal {hace} |
| `comercial.eye.ver-foto` | `components/demo/comercial/SpaceEyeVision.tsx:118` | título / tooltip · encabezado | Ver foto en grande | View larger photo |
| `comercial.eye.alt` | `components/demo/comercial/SpaceEyeVision.tsx:123`<br>`components/demo/comercial/SpaceEyeVision.tsx:158` | texto en pantalla | Cámara Space Eye de {sitio} | Space Eye camera at {sitio} |
| `comercial.eye.foto` | `components/demo/comercial/SpaceEyeVision.tsx:127` | texto en pantalla | foto | photo |
| `comercial.eye.sin-fotos` | `components/demo/comercial/SpaceEyeVision.tsx:134` | texto en pantalla | La cámara está vinculada pero aún no ha subido fotos. | The camera is linked but has not uploaded any photos yet. |
| `comercial.eye.camara` | `components/demo/comercial/SpaceEyeVision.tsx:146` | título / tooltip · encabezado | Cámara Space Eye | Space Eye camera |
| `comercial.eye.correcto` | `components/demo/comercial/SpaceEyeVision.tsx:182` | texto en pantalla | Anuncio correcto | Correct ad |
| `comercial.eye.confianza` | `components/demo/comercial/SpaceEyeVision.tsx:183` | texto en pantalla | ␣· confianza {pct} | ␣· confidence {pct} |
| `comercial.eye.no-coincide` | `components/demo/comercial/SpaceEyeVision.tsx:190` | texto en pantalla | No coincide con la creatividad | Does not match the creative |
| `comercial.eye.sin-verificar` | `components/demo/comercial/SpaceEyeVision.tsx:197` | texto en pantalla | Sin verificación IA aún | No AI check yet |
| `comercial.negociacion.titulo` | `components/demo/comercial-opex/ComercialOpex.tsx:1163` | encabezado | Comercial negociación | Lease negotiation |
| `comercial.negociacion.descripcion` | `components/demo/comercial-opex/ComercialOpex.tsx:1165` | texto en pantalla | Prospección de arrendadores: los espacios que se están persiguiendo, quién manda en cada uno y cómo va la negociación de su renta. | Landlord prospecting: the spaces being pursued, who decides on each one, and how the rent negotiation is going. |
| `comercial.negociacion.nuevo` | `components/demo/comercial-opex/ComercialOpex.tsx:1038`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1169`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1359` | título / tooltip · encabezado · texto en pantalla | Nuevo espacio | New space |
| `comercial.negociacion.estado.negociacion` | `components/demo/comercial-opex/ComercialOpex.tsx:115`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1201`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1257` | etiqueta de un valor (mapa de claves) · rótulo · texto en pantalla | En negociación | In negotiation |
| `comercial.negociacion.estado.activo` | `components/demo/comercial-opex/ComercialOpex.tsx:116` | etiqueta de un valor (mapa de claves) | Activo | Active |
| `comercial.negociacion.estado.inactivo` | `components/demo/comercial-opex/ComercialOpex.tsx:117` | etiqueta de un valor (mapa de claves) | Inactivo | Inactive |
| `comercial.negociacion.sin-contacto` | `components/demo/comercial-opex/ComercialOpex.tsx:188` | texto en pantalla | Sin contacto | No contact |
| `comercial.negociacion.hoy` | `components/demo/comercial-opex/ComercialOpex.tsx:192` | texto en pantalla | hoy | today |
| `comercial.negociacion.responsable` | `components/demo/comercial-opex/ComercialOpex.tsx:236`<br>`components/demo/comercial-opex/ComercialOpex.tsx:962` | etiqueta accesible (aria-label) · rótulo · encabezado | Búsqueda del responsable | Finding the decision-maker |
| `comercial.negociacion.responsable.pasar` | `components/demo/comercial-opex/ComercialOpex.tsx:250` | título / tooltip | Pasar a «{nombre}» | Move to “{nombre}” |
| `comercial.negociacion.responsable.1` | `components/demo/comercial-opex/ComercialOpex.tsx:156` | texto en pantalla | Sin contacto | No contact |
| `comercial.negociacion.responsable.2` | `components/demo/comercial-opex/ComercialOpex.tsx:157` | texto en pantalla | Vecinos o intermediarios | Neighbors or intermediaries |
| `comercial.negociacion.responsable.3` | `components/demo/comercial-opex/ComercialOpex.tsx:158` | texto en pantalla | Dueño identificado | Owner identified |
| `comercial.negociacion.responsable.4` | `components/demo/comercial-opex/ComercialOpex.tsx:159` | texto en pantalla | En contacto con el dueño | In contact with the owner |
| `comercial.negociacion.responsable.5` | `components/demo/comercial-opex/ComercialOpex.tsx:160` | texto en pantalla | Responsable legal confirmado | Legal representative confirmed |
| `comercial.negociacion.visibilidad.cercana` | `components/demo/comercial-opex/ComercialOpex.tsx:126` | etiqueta de un valor (mapa de claves) | Cercana | Close |
| `comercial.negociacion.visibilidad.media` | `components/demo/comercial-opex/ComercialOpex.tsx:127` | etiqueta de un valor (mapa de claves) | Media | Medium |
| `comercial.negociacion.visibilidad.lejana` | `components/demo/comercial-opex/ComercialOpex.tsx:128` | etiqueta de un valor (mapa de claves) | Lejana | Far |
| `comercial.negociacion.canal.llamada` | `components/demo/comercial-opex/ComercialOpex.tsx:131` | etiqueta de un valor (mapa de claves) | Llamada | Call |
| `comercial.negociacion.canal.visita` | `components/demo/comercial-opex/ComercialOpex.tsx:132` | etiqueta de un valor (mapa de claves) | Visita en sitio | Site visit |
| `comercial.negociacion.canal.reunion` | `components/demo/comercial-opex/ComercialOpex.tsx:133` | etiqueta de un valor (mapa de claves) | Reunión | Meeting |
| `comercial.negociacion.canal.correo` | `components/demo/comercial-opex/ComercialOpex.tsx:134` | etiqueta de un valor (mapa de claves) | Correo | Email |
| `comercial.negociacion.canal.whatsapp` | `components/demo/comercial-opex/ComercialOpex.tsx:135` | etiqueta de un valor (mapa de claves) | WhatsApp | WhatsApp |
| `comercial.negociacion.canal.otro` | `components/demo/comercial-opex/ComercialOpex.tsx:136` | etiqueta de un valor (mapa de claves) | Otro | Other |
| `comercial.negociacion.oferta.enviada` | `components/demo/comercial-opex/ComercialOpex.tsx:139` | etiqueta de un valor (mapa de claves) | Enviada | Sent |
| `comercial.negociacion.oferta.contraoferta` | `components/demo/comercial-opex/ComercialOpex.tsx:140` | etiqueta de un valor (mapa de claves) | Contraoferta | Counteroffer |
| `comercial.negociacion.oferta.rechazada` | `components/demo/comercial-opex/ComercialOpex.tsx:141` | etiqueta de un valor (mapa de claves) | Rechazada | Rejected |
| `comercial.negociacion.oferta.aceptada` | `components/demo/comercial-opex/ComercialOpex.tsx:142` | etiqueta de un valor (mapa de claves) | Aceptada | Accepted |
| `comercial.negociacion.etapa.prospecto` | `components/demo/comercial-opex/ComercialOpex.tsx:145` | etiqueta de un valor (mapa de claves) | Prospecto | Prospect |
| `comercial.negociacion.etapa.contactado` | `components/demo/comercial-opex/ComercialOpex.tsx:146` | etiqueta de un valor (mapa de claves) | Contactado | Contacted |
| `comercial.negociacion.etapa.visita` | `components/demo/comercial-opex/ComercialOpex.tsx:147` | etiqueta de un valor (mapa de claves) | Visita | Visit |
| `comercial.negociacion.etapa.negociacion` | `components/demo/comercial-opex/ComercialOpex.tsx:148` | etiqueta de un valor (mapa de claves) | Negociación | Negotiation |
| `comercial.negociacion.etapa.en-revision` | `components/demo/comercial-opex/ComercialOpex.tsx:149` | etiqueta de un valor (mapa de claves) | En revisión | In review |
| `comercial.negociacion.etapa.aprobado` | `components/demo/comercial-opex/ComercialOpex.tsx:150` | etiqueta de un valor (mapa de claves) | Aprobado | Approved |
| `comercial.negociacion.etapa.rechazado` | `components/demo/comercial-opex/ComercialOpex.tsx:151` | etiqueta de un valor (mapa de claves) | Rechazado | Rejected |
| `comercial.negociacion.etapa.perdido` | `components/demo/comercial-opex/ComercialOpex.tsx:152` | etiqueta de un valor (mapa de claves) | Perdido | Lost |
| `comercial.negociacion.ficha` | `components/demo/comercial-opex/ComercialOpex.tsx:316` | encabezado | Ficha técnica | Spec sheet |
| `comercial.negociacion.ficha.tipo` | `components/demo/comercial-opex/ComercialOpex.tsx:319` | rótulo | Tipo de espacio | Space type |
| `comercial.negociacion.ficha.tipo-ej` | `components/demo/comercial-opex/ComercialOpex.tsx:320` | texto de ejemplo (placeholder) | Ej. espectacular en azotea, muro, unipolar | E.g. rooftop billboard, wall, monopole |
| `comercial.negociacion.ficha.visibilidad` | `components/demo/comercial-opex/ComercialOpex.tsx:323` | rótulo | Visibilidad | Visibility |
| `comercial.negociacion.sin-definir` | `components/demo/comercial-opex/ComercialOpex.tsx:325` | opción de lista | Sin definir | Not set |
| `comercial.negociacion.ficha.area` | `components/demo/comercial-opex/ComercialOpex.tsx:342` | rótulo | Área de la cara | Face area |
| `comercial.negociacion.ficha.superficie` | `components/demo/comercial-opex/ComercialOpex.tsx:346` | rótulo | Superficie del terreno (m²) | Lot area (m²) |
| `comercial.negociacion.ficha.renta-min` | `components/demo/comercial-opex/ComercialOpex.tsx:350` | rótulo | Renta autorizada, mínimo | Authorized rent, minimum |
| `comercial.negociacion.ficha.renta-max` | `components/demo/comercial-opex/ComercialOpex.tsx:354` | rótulo | Renta autorizada, máximo | Authorized rent, maximum |
| `comercial.negociacion.ficha.autoriza` | `components/demo/comercial-opex/ComercialOpex.tsx:358` | rótulo | Quién autoriza | Who authorizes |
| `comercial.negociacion.ficha.autoriza-ej` | `components/demo/comercial-opex/ComercialOpex.tsx:359` | texto de ejemplo (placeholder) | Ej. Dirección comercial | E.g. Sales management |
| `comercial.negociacion.ficha.guardar` | `components/demo/comercial-opex/ComercialOpex.tsx:365` | texto en pantalla | Guardar ficha | Save spec sheet |
| `comercial.negociacion.pin.enlace` | `components/demo/comercial-opex/ComercialOpex.tsx:404` | etiqueta de un valor (mapa de claves) | Pin en el punto del enlace. Arrástralo para afinarlo y guarda la ubicación. | Pin placed at the point in the link. Drag it to fine-tune it and save the location. |
| `comercial.negociacion.pin.coordenadas` | `components/demo/comercial-opex/ComercialOpex.tsx:404` | etiqueta de un valor (mapa de claves) | Pin en esas coordenadas. Arrástralo para afinarlo y guarda la ubicación. | Pin placed at those coordinates. Drag it to fine-tune it and save the location. |
| `comercial.negociacion.pin.candidato` | `components/demo/comercial-opex/ComercialOpex.tsx:474` | texto en pantalla | Arrastra el pin para afinarlo y guarda la ubicación. | Drag the pin to fine-tune it and save the location. |
| `comercial.negociacion.buscar.sin-resultados` | `components/demo/comercial-opex/ComercialOpex.tsx:425` | mensaje de error | No se encontró esa dirección. Pega coordenadas o marca el punto en el mapa. | That address was not found. Paste coordinates or mark the point on the map. |
| `comercial.negociacion.buscar.error` | `components/demo/comercial-opex/ComercialOpex.tsx:427` | mensaje de error | No se pudo buscar | Could not search |
| `comercial.negociacion.buscar.etiqueta` | `components/demo/comercial-opex/ComercialOpex.tsx:442` | etiqueta accesible (aria-label) · rótulo | Buscar dirección, coordenadas o enlace de Google Maps | Search for an address, coordinates or a Google Maps link |
| `comercial.negociacion.buscar.ph` | `components/demo/comercial-opex/ComercialOpex.tsx:446` | texto de ejemplo (placeholder) | Calle y número, coordenadas o enlace de Google Maps | Street and number, coordinates or a Google Maps link |
| `comercial.negociacion.buscar.ubicar` | `components/demo/comercial-opex/ComercialOpex.tsx:450` | texto en pantalla | Ubicar | Locate |
| `comercial.negociacion.buscar.ayuda` | `components/demo/comercial-opex/ComercialOpex.tsx:456` | texto en pantalla | También puedes pegar coordenadas (19.4326, -99.1332 o 19°25'57"N 99°07'59"W) o un enlace de Google Maps. Después arrastra el pin para afinarlo. | You can also paste coordinates (19.4326, -99.1332 or 19°25'57"N 99°07'59"W) or a Google Maps link. Then drag the pin to fine-tune it. |
| `comercial.negociacion.resultados.google` | `components/demo/comercial-opex/ComercialOpex.tsx:484` | texto en pantalla | Resultados de Google | Results from Google |
| `comercial.negociacion.resultados.osm` | `components/demo/comercial-opex/ComercialOpex.tsx:484` | texto en pantalla | Resultados de © OpenStreetMap | Results from © OpenStreetMap |
| `comercial.negociacion.ubicacion.guardada` | `components/demo/comercial-opex/ComercialOpex.tsx:500` | texto en pantalla | Guardada{por}{el}{origen} | Saved{por}{el}{origen} |
| `comercial.negociacion.ubicacion.por` | `components/demo/comercial-opex/ComercialOpex.tsx:502` | texto en pantalla | ␣por {nombre} | ␣by {nombre} |
| `comercial.negociacion.ubicacion.el` | `components/demo/comercial-opex/ComercialOpex.tsx:504` | texto en pantalla | ␣el {fecha} | ␣on {fecha} |
| `comercial.negociacion.ubicacion.buscador` | `components/demo/comercial-opex/ComercialOpex.tsx:507` | texto en pantalla | ␣· desde el buscador | ␣· from the address search |
| `comercial.negociacion.ubicacion.mapa` | `components/demo/comercial-opex/ComercialOpex.tsx:509` | texto en pantalla | ␣· marcada en el mapa | ␣· marked on the map |
| `comercial.negociacion.ubicacion.sin` | `components/demo/comercial-opex/ComercialOpex.tsx:512` | texto en pantalla | Sin ubicación guardada | No location saved |
| `comercial.negociacion.ubicacion.gps` | `components/demo/comercial-opex/ComercialOpex.tsx:514` | texto en pantalla | GPS del teléfono: pendiente | Phone GPS: pending |
| `comercial.negociacion.ubicacion.guardar` | `components/demo/comercial-opex/ComercialOpex.tsx:527` | texto en pantalla | Guardar ubicación | Save location |
| `comercial.negociacion.contactos` | `components/demo/comercial-opex/ComercialOpex.tsx:541` | encabezado | Responsables y contactos | Decision-makers and contacts |
| `comercial.negociacion.contactos.vacio` | `components/demo/comercial-opex/ComercialOpex.tsx:543` | texto en pantalla | Todavía no se sabe con quién hablar. | We do not know who to talk to yet. |
| `comercial.negociacion.contactos.firma-chip` | `components/demo/comercial-opex/ComercialOpex.tsx:554` | texto en pantalla | firma | signs |
| `comercial.negociacion.contactos.no-firma` | `components/demo/comercial-opex/ComercialOpex.tsx:579` | texto en pantalla | No firma | Does not sign |
| `comercial.negociacion.contactos.firma` | `components/demo/comercial-opex/ComercialOpex.tsx:579` | texto en pantalla | Firma | Signs |
| `comercial.negociacion.quitar-a` | `components/demo/comercial-opex/ComercialOpex.tsx:584`<br>`components/demo/comercial-opex/ComercialOpex.tsx:724` | etiqueta accesible (aria-label) · rótulo | Quitar a {nombre} | Remove {nombre} |
| `comercial.negociacion.contactos.nombre` | `components/demo/comercial-opex/ComercialOpex.tsx:603` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Nombre del contacto | Contact name |
| `comercial.negociacion.contactos.papel` | `components/demo/comercial-opex/ComercialOpex.tsx:604` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Papel | Role |
| `comercial.negociacion.contactos.papel-ph` | `components/demo/comercial-opex/ComercialOpex.tsx:604` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Papel (dueño, vecina…) | Role (owner, neighbor…) |
| `comercial.negociacion.contactos.correo` | `components/demo/comercial-opex/ComercialOpex.tsx:606` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Correo | Email |
| `comercial.negociacion.contactos.es-firma` | `components/demo/comercial-opex/ComercialOpex.tsx:608` | texto en pantalla | Es quien firma | Is the signer |
| `comercial.negociacion.contactos.agregar` | `components/demo/comercial-opex/ComercialOpex.tsx:612` | texto en pantalla | Agregar contacto | Add contact |
| `comercial.negociacion.ofertas` | `components/demo/comercial-opex/ComercialOpex.tsx:626` | encabezado | Ofertas de renta al arrendador | Rent offers to the landlord |
| `comercial.negociacion.ofertas.vacio` | `components/demo/comercial-opex/ComercialOpex.tsx:628` | texto en pantalla | Todavía no se le ha ofrecido nada. | Nothing has been offered yet. |
| `comercial.negociacion.ofertas.version` | `components/demo/comercial-opex/ComercialOpex.tsx:634` | cabecera de columna | Versión | Version |
| `comercial.negociacion.ofertas.fecha` | `components/demo/comercial-opex/ComercialOpex.tsx:635` | cabecera de columna | Fecha | Date |
| `comercial.negociacion.ofertas.renta` | `components/demo/comercial-opex/ComercialOpex.tsx:636` | cabecera de columna | Renta | Rent |
| `comercial.negociacion.ofertas.plazo` | `components/demo/comercial-opex/ComercialOpex.tsx:637` | cabecera de columna | Plazo | Term |
| `comercial.negociacion.ofertas.estado` | `components/demo/comercial-opex/ComercialOpex.tsx:638` | cabecera de columna | Estado | Status |
| `comercial.negociacion.ofertas.por-mes` | `components/demo/comercial-opex/ComercialOpex.tsx:646` | texto en pantalla | {monto}/mes | {monto}/mo |
| `comercial.negociacion.ofertas.meses.uno` | `components/demo/comercial-opex/ComercialOpex.tsx:648` | etiqueta de un valor (mapa de claves) | {n} meses | {n} month |
| `comercial.negociacion.ofertas.meses.otros` | `components/demo/comercial-opex/ComercialOpex.tsx:648` | etiqueta de un valor (mapa de claves) | {n} meses | {n} months |
| `comercial.negociacion.ofertas.estado-de` | `components/demo/comercial-opex/ComercialOpex.tsx:653` | etiqueta accesible (aria-label) · rótulo | Estado de la oferta v{version} | Offer status v{version} |
| `comercial.negociacion.ofertas.renta-mensual` | `components/demo/comercial-opex/ComercialOpex.tsx:686` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Renta mensual | Monthly rent |
| `comercial.negociacion.ofertas.plazo-meses` | `components/demo/comercial-opex/ComercialOpex.tsx:687` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Plazo en meses | Term in months |
| `comercial.negociacion.ofertas.meses-ph` | `components/demo/comercial-opex/ComercialOpex.tsx:687` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Meses | Months |
| `comercial.negociacion.ofertas.notas` | `components/demo/comercial-opex/ComercialOpex.tsx:688` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Notas de la oferta | Offer notes |
| `comercial.negociacion.ofertas.nueva` | `components/demo/comercial-opex/ComercialOpex.tsx:690` | texto en pantalla | Nueva versión | New version |
| `comercial.negociacion.competencia` | `components/demo/comercial-opex/ComercialOpex.tsx:703` | encabezado | Competencia | Competition |
| `comercial.negociacion.competencia.vacio` | `components/demo/comercial-opex/ComercialOpex.tsx:705` | texto en pantalla | Sin competencia identificada. | No competition identified. |
| `comercial.negociacion.competencia.desde` | `components/demo/comercial-opex/ComercialOpex.tsx:715` | texto en pantalla | desde {fecha} | since {fecha} |
| `comercial.negociacion.competencia.competidor` | `components/demo/comercial-opex/ComercialOpex.tsx:746` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Competidor | Competitor |
| `comercial.negociacion.competencia.quien` | `components/demo/comercial-opex/ComercialOpex.tsx:746` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Quién | Who |
| `comercial.negociacion.competencia.desde-etiqueta` | `components/demo/comercial-opex/ComercialOpex.tsx:747` | etiqueta accesible (aria-label) · rótulo | Desde | Since |
| `comercial.negociacion.competencia.ofrece` | `components/demo/comercial-opex/ComercialOpex.tsx:748` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Qué ofrece | What they offer |
| `comercial.negociacion.competencia.ofrece-ph` | `components/demo/comercial-opex/ComercialOpex.tsx:748` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Qué ofrece o qué se sabe | What they offer or what is known |
| `comercial.negociacion.agregar` | `components/demo/comercial-opex/ComercialOpex.tsx:751` | texto en pantalla | Agregar | Add |
| `comercial.negociacion.historial` | `components/demo/comercial-opex/ComercialOpex.tsx:781` | encabezado | Historial | History |
| `comercial.negociacion.historial.canal` | `components/demo/comercial-opex/ComercialOpex.tsx:799` | etiqueta accesible (aria-label) · rótulo | Canal | Channel |
| `comercial.negociacion.historial.canal-ph` | `components/demo/comercial-opex/ComercialOpex.tsx:800` | opción de lista | Canal… | Channel… |
| `comercial.negociacion.historial.con-quien` | `components/demo/comercial-opex/ComercialOpex.tsx:807` | etiqueta accesible (aria-label) · rótulo | Con quién | With whom |
| `comercial.negociacion.historial.con-quien-ph` | `components/demo/comercial-opex/ComercialOpex.tsx:808` | opción de lista | Con quién… | With whom… |
| `comercial.negociacion.historial.que-paso` | `components/demo/comercial-opex/ComercialOpex.tsx:815` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Qué pasó | What happened |
| `comercial.negociacion.siguiente-paso` | `components/demo/comercial-opex/ComercialOpex.tsx:816` | texto de ejemplo (placeholder) · etiqueta accesible (aria-label) · rótulo | Siguiente paso | Next step |
| `comercial.negociacion.historial.etapa` | `components/demo/comercial-opex/ComercialOpex.tsx:817` | etiqueta accesible (aria-label) · rótulo | Etapa | Stage |
| `comercial.negociacion.historial.registrar` | `components/demo/comercial-opex/ComercialOpex.tsx:826` | texto en pantalla | Registrar contacto | Log contact |
| `comercial.negociacion.historial.vacio` | `components/demo/comercial-opex/ComercialOpex.tsx:832` | texto en pantalla | Sin contactos registrados. | No contacts logged. |
| `comercial.negociacion.historial.con` | `components/demo/comercial-opex/ComercialOpex.tsx:850` | texto en pantalla | con {nombre} | with {nombre} |
| `comercial.negociacion.usuario-eliminado` | `components/demo/comercial-opex/ComercialOpex.tsx:852`<br>`components/demo/comercial-opex/ComercialOpex.tsx:903` | texto en pantalla | Usuario eliminado | Deleted user |
| `comercial.negociacion.notas` | `components/demo/comercial-opex/ComercialOpex.tsx:873` | encabezado | Notas adicionales | Additional notes |
| `comercial.negociacion.notas.nueva` | `components/demo/comercial-opex/ComercialOpex.tsx:882` | etiqueta accesible (aria-label) · rótulo | Nota nueva | New note |
| `comercial.negociacion.notas.ph` | `components/demo/comercial-opex/ComercialOpex.tsx:885` | texto de ejemplo (placeholder) | Acceso, horarios, permisos, lo que haga falta recordar… | Access, hours, permits, anything worth remembering… |
| `comercial.negociacion.notas.ayuda` | `components/demo/comercial-opex/ComercialOpex.tsx:890` | texto en pantalla | Las notas no se editan ni se borran: quedan con su autor y su fecha. | Notes cannot be edited or deleted: they keep their author and date. |
| `comercial.negociacion.notas.agregar` | `components/demo/comercial-opex/ComercialOpex.tsx:892` | texto en pantalla | Agregar nota | Add note |
| `comercial.negociacion.notas.vacio` | `components/demo/comercial-opex/ComercialOpex.tsx:897` | texto en pantalla | Sin notas todavía. | No notes yet. |
| `comercial.negociacion.sin-direccion` | `components/demo/comercial-opex/ComercialOpex.tsx:938` | texto en pantalla | Sin dirección | No address |
| `comercial.negociacion.seguimiento-desde` | `components/demo/comercial-opex/ComercialOpex.tsx:939` | texto en pantalla | ␣· en seguimiento desde {fecha} | ␣· tracked since {fecha} |
| `comercial.negociacion.ultimo` | `components/demo/comercial-opex/ComercialOpex.tsx:973` | texto en pantalla | Último contacto | Last contact |
| `comercial.negociacion.ultimo.con` | `components/demo/comercial-opex/ComercialOpex.tsx:972` | texto en pantalla | Último contacto: {nombre} | Last contact: {nombre} |
| `comercial.negociacion.siguiente-paso.etiqueta` | `components/demo/comercial-opex/ComercialOpex.tsx:982` | texto en pantalla | Siguiente paso: | Next step: |
| `comercial.negociacion.alta.error` | `components/demo/comercial-opex/ComercialOpex.tsx:1031` | mensaje de error | No se pudo dar de alta | Could not add the space |
| `comercial.negociacion.alta.subtitulo` | `components/demo/comercial-opex/ComercialOpex.tsx:1039` | título / tooltip · encabezado · subtítulo | Lo mínimo para empezar a darle seguimiento. La ficha, la ubicación y los contactos se completan después. | The minimum to start tracking it. The spec sheet, location and contacts are filled in later. |
| `comercial.negociacion.alta.que-es` | `components/demo/comercial-opex/ComercialOpex.tsx:1058` | rótulo | Qué es | What it is |
| `comercial.negociacion.alta.predio` | `components/demo/comercial-opex/ComercialOpex.tsx:1060` | opción de lista | Un predio (muro, azotea, terreno) | A property (wall, rooftop, lot) |
| `comercial.negociacion.alta.pantalla` | `components/demo/comercial-opex/ComercialOpex.tsx:1061` | opción de lista | Una pantalla que ya existe | An existing screen |
| `comercial.negociacion.alta.nombre-ej` | `components/demo/comercial-opex/ComercialOpex.tsx:1066` | texto de ejemplo (placeholder) | Ej. Azotea Insurgentes 1420 | E.g. Rooftop Insurgentes 1420 |
| `comercial.negociacion.alta.direccion` | `components/demo/comercial-opex/ComercialOpex.tsx:1069` | rótulo | Dirección | Address |
| `comercial.negociacion.alta.primer-contacto` | `components/demo/comercial-opex/ComercialOpex.tsx:1074` | rótulo | Primer contacto | First contact |
| `comercial.negociacion.alta.como-surgio` | `components/demo/comercial-opex/ComercialOpex.tsx:1083` | rótulo | Cómo surgió | How it came up |
| `comercial.negociacion.cargar-error` | `components/demo/comercial-opex/ComercialOpex.tsx:1111` | mensaje de error | No se pudieron leer los espacios | Could not load the spaces |
| `comercial.negociacion.abrir-error` | `components/demo/comercial-opex/ComercialOpex.tsx:1131` | mensaje de error | No se pudo abrir el espacio | Could not open the space |
| `comercial.negociacion.kpi.seguimiento` | `components/demo/comercial-opex/ComercialOpex.tsx:1191` | rótulo | En seguimiento | Tracked |
| `comercial.negociacion.kpi.seguimiento.parcial` | `components/demo/comercial-opex/ComercialOpex.tsx:1195` | texto en pantalla | se muestran los {n} con algo más reciente de {total} | showing the most recently active {n} of {total} |
| `comercial.negociacion.kpi.seguimiento.sub` | `components/demo/comercial-opex/ComercialOpex.tsx:1196` | texto en pantalla | predios y pantallas | properties and screens |
| `comercial.negociacion.kpi.negociacion.sub` | `components/demo/comercial-opex/ComercialOpex.tsx:1203` | subtítulo | todavía sin cerrar con el dueño | not yet closed with the owner |
| `comercial.negociacion.kpi.activos` | `components/demo/comercial-opex/ComercialOpex.tsx:1208`<br>`components/demo/comercial-opex/ComercialOpex.tsx:1258` | rótulo · texto en pantalla | Activos | Active |
| `comercial.negociacion.kpi.activos.sub` | `components/demo/comercial-opex/ComercialOpex.tsx:1210` | subtítulo | negociación cerrada | negotiation closed |
| `comercial.negociacion.kpi.frios` | `components/demo/comercial-opex/ComercialOpex.tsx:1215` | rótulo | Sin contacto +30 días | No contact in 30+ days |
| `comercial.negociacion.kpi.frios.sub` | `components/demo/comercial-opex/ComercialOpex.tsx:1217` | subtítulo | en negociación y sin bitácora reciente | in negotiation with no recent log entry |
| `comercial.negociacion.lista` | `components/demo/comercial-opex/ComercialOpex.tsx:1228` | encabezado | Espacios en seguimiento | Spaces being tracked |
| `comercial.negociacion.lista.de` | `components/demo/comercial-opex/ComercialOpex.tsx:1232` | texto en pantalla | {n} de {total} | {n} of {total} |
| `comercial.negociacion.lista.buscar` | `components/demo/comercial-opex/ComercialOpex.tsx:1246` | etiqueta accesible (aria-label) · rótulo | Buscar espacio | Search spaces |
| `comercial.negociacion.lista.buscar-ph` | `components/demo/comercial-opex/ComercialOpex.tsx:1249` | texto de ejemplo (placeholder) | Nombre o dirección… | Name or address… |
| `comercial.negociacion.lista.estado` | `components/demo/comercial-opex/ComercialOpex.tsx:1253` | etiqueta accesible (aria-label) · rótulo | Estado | Status |
| `comercial.negociacion.lista.todos` | `components/demo/comercial-opex/ComercialOpex.tsx:1256` | texto en pantalla | Todos | All |
| `comercial.negociacion.lista.inactivos` | `components/demo/comercial-opex/ComercialOpex.tsx:1259` | texto en pantalla | Inactivos | Inactive |
| `comercial.negociacion.lista.frios` | `components/demo/comercial-opex/ComercialOpex.tsx:1260` | texto en pantalla | Sin contacto +30 d | No contact 30+ d |
| `comercial.negociacion.lista.vacia` | `components/demo/comercial-opex/ComercialOpex.tsx:1292` | texto en pantalla | Todavía no hay espacios. Da de alta el primero con «Nuevo espacio». | No spaces yet. Add the first one with “New space”. |
| `comercial.negociacion.lista.sin-resultados` | `components/demo/comercial-opex/ComercialOpex.tsx:1294` | texto en pantalla | Ningún espacio coincide. Quita el filtro para ver los {n}. | No spaces match. Clear the filter to see all spaces ({n}). |
| `comercial.negociacion.detalle.vacio` | `components/demo/comercial-opex/ComercialOpex.tsx:1355` | texto en pantalla | Aquí verás el detalle de cada espacio: quién manda, la ficha, las ofertas al dueño y la bitácora. Da de alta el primero para empezar. | Here you will see the details of each space: who decides, the spec sheet, the offers to the owner and the log. Add the first one to get started. |
| `codigos.pagina.titulo` | `app/(app)/(shell)/codigos-promocionales/page.tsx:39` | encabezado | Códigos de negociación | Negotiation codes |
| `codigos.pagina.descripcion` | `app/(app)/(shell)/codigos-promocionales/page.tsx:41` | texto en pantalla | Códigos con vencimiento y cupo que un vendedor aplica a una cotización. Los pone esta empresa y no se comparten con nadie más. | Codes with an expiry date and a usage cap that a sales rep applies to a quote. This company sets them and they are not shared with anyone else. |
| `codigos.estado.vigente` | `components/demo/codigos/GestionCodigos.tsx:86` | etiqueta de un valor (mapa de claves) | Vigente | Active |
| `codigos.estado.proximo` | `components/demo/codigos/GestionCodigos.tsx:87` | etiqueta de un valor (mapa de claves) | Próximo | Upcoming |
| `codigos.estado.vencido` | `components/demo/codigos/GestionCodigos.tsx:88` | etiqueta de un valor (mapa de claves) | Vencido | Expired |
| `codigos.estado.agotado` | `components/demo/codigos/GestionCodigos.tsx:89` | etiqueta de un valor (mapa de claves) | Agotado | Limit reached |
| `codigos.estados.vigentes` | `components/demo/codigos/GestionCodigos.tsx:519` | etiqueta de un valor (mapa de claves) | Vigentes | Active |
| `codigos.estados.proximos` | `components/demo/codigos/GestionCodigos.tsx:520` | etiqueta de un valor (mapa de claves) | Próximos | Upcoming |
| `codigos.estados.agotados` | `components/demo/codigos/GestionCodigos.tsx:521` | etiqueta de un valor (mapa de claves) | Agotados | Limit reached |
| `codigos.estados.vencidos` | `components/demo/codigos/GestionCodigos.tsx:522` | etiqueta de un valor (mapa de claves) | Vencidos | Expired |
| `codigos.error.leer` | `components/demo/codigos/GestionCodigos.tsx:129` | mensaje de error | No se pudieron leer los códigos | Could not load the negotiation codes |
| `codigos.error.guardar` | `components/demo/codigos/GestionCodigos.tsx:171` | mensaje de error | No se pudo guardar | Could not save |
| `codigos.error.eliminar` | `components/demo/codigos/GestionCodigos.tsx:180` | mensaje de error | No se pudo eliminar | Could not delete |
| `codigos.error.elige-propuesta` | `components/demo/codigos/GestionCodigos.tsx:186` | mensaje de error | Elige la propuesta a la que se asigna el código | Choose the proposal to assign the code to |
| `codigos.error.asignar` | `components/demo/codigos/GestionCodigos.tsx:202` | mensaje de error | No se pudo asignar | Could not assign |
| `codigos.asignado` | `components/demo/codigos/GestionCodigos.tsx:192` | aviso emergente · etiqueta de un valor (mapa de claves) | Código {codigo} asignado a {folio}: pendiente de aprobación | Negotiation code {codigo} assigned to {folio}: pending approval |
| `codigos.asignado.reactivada` | `components/demo/codigos/GestionCodigos.tsx:192` | aviso emergente · etiqueta de un valor (mapa de claves) | Código {codigo} asignado a {folio}: pendiente de aprobación. La propuesta vuelve a borrador. | Negotiation code {codigo} assigned to {folio}: pending approval. The proposal goes back to draft. |
| `codigos.cargando` | `components/demo/codigos/GestionCodigos.tsx:221` | etiqueta accesible (aria-label) · rótulo | Cargando los códigos | Loading negotiation codes |
| `codigos.aviso.uso` | `components/demo/codigos/GestionCodigos.tsx:241` | texto en pantalla | El uso se cuenta cuando alguien aplica el código a una cotización, no cuando se cierra la venta. | A use is counted when someone applies the code to a quote, not when the sale closes. |
| `codigos.aviso.por-que` | `components/demo/codigos/GestionCodigos.tsx:242` | texto en pantalla | Es lo que permite decirle al cliente «sí, tu código vale» en el momento en que lo teclea, en vez de descubrir al firmar que ya se había acabado. A cambio, una cotización abandonada con el código puesto retiene un uso: quitarle el código, o borrarla, lo devuelve. | That is what lets you tell the client “yes, your code is valid” the moment they enter it, instead of finding out at signing that it had run out. In exchange, an abandoned quote with the code applied holds on to a use: removing the code, or deleting the quote, gives it back. |
| `codigos.aviso.compone` | `components/demo/codigos/GestionCodigos.tsx:244` | texto en pantalla | Y se {compone} con las demás capas: un 20 % por volumen, un 20 % comercial y un 20 % de código dejan al cliente pagando el {resultado}, no el 40 %. | And it {compone} with the other layers: 20% volume, 20% commercial and 20% code discounts leave the client paying {resultado}, not 40%. |
| `codigos.aviso.compone.palabra` | `components/demo/codigos/GestionCodigos.tsx:245` | texto en pantalla | compone | compounds |
| `codigos.aviso.compone.resultado` | `components/demo/codigos/GestionCodigos.tsx:246` | texto en pantalla | 51,2 % | 51.2% |
| `codigos.lista.titulo` | `components/demo/codigos/GestionCodigos.tsx:255` | encabezado | Códigos de esta empresa | Negotiation codes for this company |
| `codigos.lista.subtitulo` | `components/demo/codigos/GestionCodigos.tsx:259` | encabezado · subtítulo | Solo de esta empresa · vigencia inclusiva | This company only · validity dates inclusive |
| `codigos.lista.ayuda` | `components/demo/codigos/GestionCodigos.tsx:279` | texto en pantalla | Las promociones las pone cada empresa: estos códigos no se comparten con nadie más. Los dos extremos de la vigencia son {inclusivos} — «hasta el 30» incluye el 30. Dejar el tope de usos vacío significa {sinTope}; entonces el único freno es la fecha. | Each company sets its own promotions: these codes are not shared with anyone else. Both ends of the validity period are {inclusivos} — “until the 30th” includes the 30th. Leaving the usage cap empty means {sinTope}; then the only limit is the date. |
| `codigos.lista.inclusivos` | `components/demo/codigos/GestionCodigos.tsx:280` | texto en pantalla | inclusivos | inclusive |
| `codigos.col.codigo` | `components/demo/codigos/GestionCodigos.tsx:288` | cabecera de columna | Código | Code |
| `codigos.col.estado` | `components/demo/codigos/GestionCodigos.tsx:289` | cabecera de columna | Estado | Status |
| `codigos.col.descuento` | `components/demo/codigos/GestionCodigos.tsx:290` | cabecera de columna | Descuento | Discount |
| `codigos.col.vigencia` | `components/demo/codigos/GestionCodigos.tsx:291` | cabecera de columna | Vigencia | Validity |
| `codigos.col.usos` | `components/demo/codigos/GestionCodigos.tsx:292` | cabecera de columna | Usos | Uses |
| `codigos.lista.vacia` | `components/demo/codigos/GestionCodigos.tsx:300` | texto en pantalla | Todavía no hay ninguno. Sin códigos, todo se vende como hoy. | None yet. Without negotiation codes, everything sells as it does today. |
| `codigos.pct` | `components/demo/codigos/GestionCodigos.tsx:315` | texto en pantalla | {pct} % | {pct}% |
| `codigos.usos` | `components/demo/codigos/GestionCodigos.tsx:328` | texto en pantalla | {usos} de {tope} | {usos} of {tope} |
| `codigos.usos.sin-tope` | `components/demo/codigos/GestionCodigos.tsx:327` | texto en pantalla | {usos} de sin tope | {usos} (no cap) |
| `codigos.sin-tope` | `components/demo/codigos/GestionCodigos.tsx:281`<br>`components/demo/codigos/GestionCodigos.tsx:497` | texto en pantalla · texto de ejemplo (placeholder) | sin tope | no cap |
| `codigos.asignar-a-propuesta` | `components/demo/codigos/GestionCodigos.tsx:351` | texto en pantalla | Asignar a propuesta | Assign to proposal |
| `codigos.eliminar.ayuda` | `components/demo/codigos/GestionCodigos.tsx:359` | título / tooltip · encabezado | Eliminar: deja de poder aplicarse. Lo ya cotizado y lo ya aprobado no se mueven, pero su cuenta de usos se pierde: si vuelves a crearlo con el mismo código, empieza de cero. | Delete: it can no longer be applied. What was already quoted or approved does not change, but its usage count is lost: if you create it again with the same code, it starts from zero. |
| `codigos.eliminar` | `components/demo/codigos/GestionCodigos.tsx:361` | texto en pantalla | Eliminar | Delete |
| `codigos.asignar.sin-propuestas` | `components/demo/codigos/GestionCodigos.tsx:376` | texto en pantalla | No hay propuestas a las que asignarlo: solo se puede en una propuesta en borrador, enviada o rechazada, y que no lleve ya otro código. | There are no proposals to assign it to: it can only go on a draft, sent or rejected proposal that does not already have another code. |
| `codigos.asignar.propuesta-para` | `components/demo/codigos/GestionCodigos.tsx:381` | etiqueta accesible (aria-label) · rótulo | Propuesta para {codigo} | Proposal for {codigo} |
| `codigos.asignar.elige` | `components/demo/codigos/GestionCodigos.tsx:387` | opción de lista | Elige una propuesta… | Choose a proposal… |
| `codigos.asignar.sin-cliente` | `components/demo/codigos/GestionCodigos.tsx:211` | texto en pantalla | sin cliente | no client |
| `codigos.asignar.asignando` | `components/demo/codigos/GestionCodigos.tsx:406` | texto en pantalla | Asignando… | Assigning… |
| `codigos.asignar.asignar` | `components/demo/codigos/GestionCodigos.tsx:406` | texto en pantalla | Asignar | Assign |
| `codigos.asignar.ayuda` | `components/demo/codigos/GestionCodigos.tsx:412` | texto en pantalla | Consume un uso del código y queda {pendiente}: el cliente no lo ve hasta que un administrador o gerente lo apruebe desde la propuesta. | It consumes one use of the code and stays {pendiente}: the client does not see it until an admin or manager approves it from the proposal. |
| `codigos.asignar.pendiente` | `components/demo/codigos/GestionCodigos.tsx:413` | texto en pantalla | pendiente de aprobación | pending approval |
| `codigos.asignar.rechazada` | `components/demo/codigos/GestionCodigos.tsx:417` | texto en pantalla | ␣Esta propuesta está rechazada: asignarle el código la reactiva a borrador. | ␣This proposal is rejected: assigning the code reactivates it as a draft. |
| `codigos.nuevo.titulo` | `components/demo/codigos/GestionCodigos.tsx:441` | texto en pantalla | Nuevo código | New negotiation code |
| `codigos.nuevo.codigo` | `components/demo/codigos/GestionCodigos.tsx:445`<br>`components/demo/codigos/GestionCodigos.tsx:447` | rótulo · etiqueta accesible (aria-label) · rótulo | Código | Code |
| `codigos.nuevo.descuento` | `components/demo/codigos/GestionCodigos.tsx:455` | rótulo | Descuento (%) | Discount (%) |
| `codigos.nuevo.descuento-etiqueta` | `components/demo/codigos/GestionCodigos.tsx:457` | etiqueta accesible (aria-label) · rótulo | Descuento por ciento | Discount percentage |
| `codigos.nuevo.desde` | `components/demo/codigos/GestionCodigos.tsx:469`<br>`components/demo/codigos/GestionCodigos.tsx:471` | rótulo · etiqueta accesible (aria-label) · rótulo | Vigente desde | Valid from |
| `codigos.nuevo.hasta` | `components/demo/codigos/GestionCodigos.tsx:479`<br>`components/demo/codigos/GestionCodigos.tsx:481` | rótulo · etiqueta accesible (aria-label) · rótulo | Vigente hasta | Valid until |
| `codigos.nuevo.tope` | `components/demo/codigos/GestionCodigos.tsx:489` | rótulo | Tope de usos | Usage cap |
| `codigos.nuevo.tope-etiqueta` | `components/demo/codigos/GestionCodigos.tsx:494` | etiqueta accesible (aria-label) · rótulo | Tope de usos (vacío = sin tope) | Usage cap (empty = no cap) |
| `codigos.nuevo.anadir` | `components/demo/codigos/GestionCodigos.tsx:503` | texto en pantalla | Añadir código | Add negotiation code |
| `codigos.obligatorio` | `components/demo/codigos/GestionCodigos.tsx:538` | texto en pantalla | ␣(obligatorio) | ␣(required) |
