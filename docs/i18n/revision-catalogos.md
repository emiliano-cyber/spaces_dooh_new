# Tabla de revisión · lote de inglés «catálogos de precio»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/catalogos.ts` y de
los usos en el código (búsqueda literal de la clave). **194 claves** de catálogos, todas con
al menos un uso, más las 13 `compartidos.cifra.*` de `lib/captura-cifra.ts` (segunda vuelta). Rama `feat/ingles-operaciones` (lote «operaciones, clientes y
catálogos»; de él, en esta entrega solo está terminada la parte de catálogos).

- **Pantallas:** `/paquetes` (`GestionPaquetes`), `/franjas-y-temporadas`
  (`GestionRejilla` y `ProgramacionPorFranja`), el cuadro «Tarifas por franja y
  temporada» de la ficha de pantalla (`RejillaDialog`) y `/descuentos-por-volumen`
  (`GestionVolumen`).
- **español** es la copia literal de lo que decía cada componente. Comprobado
  rindiendo **15 estados** en español antes y después de tocar los componentes
  (`lib/i18n/pantallas-catalogos.test.ts` con `I18N_VOLCAR`): `diff -rq` vacío.
- **Motivos de rechazo** (`catalogos.motivo.*`): los devuelven
  `motivoPaqueteInvalido`, `motivoFranjaInvalida`, `motivoTemporadaInvalida` y
  `motivoTramoInvalido`, que usa también el servidor. Ganaron `idioma` como último
  parámetro con `'es'` por omisión; el servidor no lo pasa y sigue mandando el
  literal. `textos/catalogos.fuentes.test.ts` recorre las 27 ramas y exige que el
  español del diccionario sea el literal (con «numero» y «mas» sin acento, como
  los escribe el módulo).
- Los títulos de las tres páginas reutilizan las claves del menú
  (`nav.paquetes`, `nav.franjas-y-temporadas`, `nav.descuentos-por-volumen`), y
  además `comun.cancelar`, `comun.cargando` y `compartidos.campo.obligatorio`.
- Las cifras de ejemplo con separador de miles («180,000», «15,000.50») entran
  por hueco `{ejemplo}`: ningún diccionario lleva cifras (guardia 2 de
  `dinero.test.ts`). El dinero va por `formatMonto(n, idioma)` (`MX$` en inglés en
  una instancia MXN); las fechas de temporada por `formatFecha(iso, idioma)`.
- La unidad de venta: en español se pinta como siempre (el dato, o la etiqueta
  de `UNIDADES`); en inglés, `etiquetaUnidad(u, 'en')`.
- `␣` marca un espacio al principio o al final del texto: es intencional.

## Términos decididos en este lote

| español | inglés | motivo |
|---|---|---|
| paquete cerrado | bundle | glosario (menú «Bundles») |
| precio cerrado | fixed price | |
| a prorrata / reparto / parte del paquete | pro rata / split / bundle share | |
| al peso / cuadra al peso | to the peso / adds up to the peso | |
| dar de baja / dada de baja (franja, temporada) | deactivate / Deactivated | baja lógica; decisión del orquestador en la segunda vuelta, igual que Campañas y compartidos (antes «retire / Retired») |
| tramo / escalón / escala plana | tier / step / flat scale | |
| rejilla (de tarifas) | rate grid | |
| programar (el horario) / horario de transmisión | schedule / Broadcast schedule | «Broadcast schedule» ya lo usaba Campañas |
| se transmite | airs | |
| tarifa de lista | list rate | |
| ¿Códigos? / admite código / precio final | Negotiation codes / Takes negotiation codes / Final price | orquestador, segunda vuelta |
| motivos de `CampoCifra` | Enter digits only… / It cannot be negative… | sin contracciones en errores |
| «pesos enteros», «al peso» | whole pesos / to the peso | **pendiente**: falso en una instancia USD; redactarlo neutro es otra tarea |

## Diccionario

| clave | español | inglés | dónde |
|---|---|---|---|
| `catalogos.comun.nombre` | Nombre | Name | GestionPaquetes.tsx:308, GestionRejilla.tsx:199, GestionRejilla.tsx:315 |
| `catalogos.comun.desde` | Desde | From | GestionRejilla.tsx:200, GestionRejilla.tsx:316 |
| `catalogos.comun.hasta` | Hasta | To | GestionRejilla.tsx:201, GestionRejilla.tsx:317 |
| `catalogos.comun.estado` | Estado | Status | GestionRejilla.tsx:203, GestionRejilla.tsx:318 |
| `catalogos.comun.anadir` | Añadir | Add | GestionRejilla.tsx:291, GestionRejilla.tsx:390 |
| `catalogos.comun.eliminar` | Eliminar | Delete | GestionPaquetes.tsx:288, GestionVolumen.tsx:227 |
| `catalogos.comun.activa` | Activa | Active | GestionRejilla.tsx:226, GestionRejilla.tsx:337 |
| `catalogos.comun.dada-de-baja` | Dada de baja | Deactivated | GestionRejilla.tsx:226, GestionRejilla.tsx:337 |
| `catalogos.comun.dar-de-baja` | Dar de baja | Deactivate | GestionRejilla.tsx:238, GestionRejilla.tsx:348 |
| `catalogos.comun.unidad` | Unidad | Unit | RejillaDialog.tsx:230, GestionVolumen.tsx:186 |
| `catalogos.comun.franja` | Franja | Daypart | RejillaDialog.tsx:231 |
| `catalogos.comun.temporada` | Temporada | Season | RejillaDialog.tsx:232 |
| `catalogos.comun.tarifa` | Tarifa | Rate | RejillaDialog.tsx:233 |
| `catalogos.comun.todo-el-dia` | Todo el día | All day | RejillaDialog.tsx:106, RejillaDialog.tsx:296 |
| `catalogos.comun.todo-el-ano` | Todo el año | All year | RejillaDialog.tsx:114, RejillaDialog.tsx:311 |
| `catalogos.comun.no-guardar` | No se pudo guardar | Could not save | GestionRejilla.tsx:113, GestionRejilla.tsx:131, GestionVolumen.tsx:98 |
| `catalogos.comun.no-eliminar` | No se pudo eliminar | Could not delete | GestionVolumen.tsx:107 |
| `catalogos.paquetes.descripcion` | Un conjunto de pantallas con un precio del conjunto. Sustituye la suma de sus tarifas de lista; no la descuenta. | A set of screens with a price for the whole set. It replaces the sum of their list rates; it does not discount it. | page.tsx:37 |
| `catalogos.paquetes.no-leer` | No se pudo leer el catálogo de paquetes | Could not load the bundle catalog | GestionPaquetes.tsx:83 |
| `catalogos.paquetes.no-guardar` | No se pudo guardar el paquete | Could not save the bundle | GestionPaquetes.tsx:150 |
| `catalogos.paquetes.no-cambiar` | No se pudo cambiar el paquete | Could not change the bundle | GestionPaquetes.tsx:159 |
| `catalogos.paquetes.no-eliminar` | No se pudo eliminar el paquete | Could not delete the bundle | GestionPaquetes.tsx:168 |
| `catalogos.paquetes.cargando` | Cargando los paquetes | Loading bundles | GestionPaquetes.tsx:175 |
| `catalogos.paquetes.aviso.sustituye` | El precio del paquete SUSTITUYE la suma de las tarifas de lista: no la descuenta, la reemplaza. | The bundle price REPLACES the sum of the list rates: it does not discount it, it replaces it. | GestionPaquetes.tsx:194 |
| `catalogos.paquetes.aviso.da-igual` | Da igual lo que sumen las pantallas — se cobra el precio del paquete. | Whatever the screens add up to, the bundle price is what gets billed. | GestionPaquetes.tsx:195 |
| `catalogos.paquetes.aviso.volumen` | Por eso un paquete {negrita} (su precio ya lo lleva dentro) ni código de negociación, salvo que marques la casilla de abajo. El descuento comercial de la propuesta sí se sigue aplicando encima. | That is why a bundle {negrita} (its price already includes it), nor a negotiation code unless you check the box below. The proposal’s commercial discount still applies on top. | GestionPaquetes.tsx:197 |
| `catalogos.paquetes.aviso.volumen.negrita` | no admite descuento por volumen | does not take a volume discount | GestionPaquetes.tsx:197 |
| `catalogos.paquetes.aviso.quitar` | Y {negrita}: el reparto se recalcula entre las que quedan y la propuesta lo avisa. | And {negrita}: the split is recalculated among the remaining screens and the proposal says so. | GestionPaquetes.tsx:199 |
| `catalogos.paquetes.aviso.quitar.negrita` | quitar una pantalla de una propuesta ya cotizada NO baja el precio | removing a screen from an already quoted proposal does NOT lower the price | GestionPaquetes.tsx:199 |
| `catalogos.paquetes.lista.titulo` | Paquetes de la organización | Bundles in your organization | GestionPaquetes.tsx:211 |
| `catalogos.paquetes.lista.subtitulo` | Se reparte a prorrata de la tarifa de lista | Split pro rata by list rate | GestionPaquetes.tsx:212 |
| `catalogos.paquetes.lista.explicacion` | El precio se reparte entre las pantallas {prorrata}, y la suma de las partes da el precio del paquete {peso}. Ese reparto es el ingreso que el reporte de rentabilidad le atribuye a cada pantalla. | The price is split among the screens {prorrata}, and the shares add up to the bundle price {peso}. That split is the revenue the profitability report assigns to each screen. | GestionPaquetes.tsx:216 |
| `catalogos.paquetes.lista.explicacion.prorrata` | a prorrata de su tarifa de lista | in proportion to their list rate | GestionPaquetes.tsx:217 |
| `catalogos.paquetes.lista.explicacion.peso` | al peso | to the peso | GestionPaquetes.tsx:218 |
| `catalogos.paquetes.col.paquete` | Paquete | Bundle | GestionPaquetes.tsx:225 |
| `catalogos.paquetes.col.pantallas` | Pantallas | Screens | GestionPaquetes.tsx:226 |
| `catalogos.paquetes.col.precio` | Precio cerrado | Fixed price | GestionPaquetes.tsx:227 |
| `catalogos.paquetes.col.codigos` | ¿Códigos? | Negotiation codes | GestionPaquetes.tsx:228 |
| `catalogos.paquetes.col.en-uso` | En uso | In use | GestionPaquetes.tsx:229 |
| `catalogos.paquetes.vacio` | Todavía no hay ninguno. Sin paquetes, todo se vende al precio de tarifa — que es exactamente como funciona hoy. | None yet. Without bundles, everything sells at the list rate — which is exactly how it works today. | GestionPaquetes.tsx:237 |
| `catalogos.paquetes.activo` | Activo | Active | GestionPaquetes.tsx:247 |
| `catalogos.paquetes.desactivado` | Desactivado | Deactivated | GestionPaquetes.tsx:247 |
| `catalogos.paquetes.pantallas.uno` | {n} pantalla | {n} screen | GestionPaquetes.tsx:254 |
| `catalogos.paquetes.pantallas.otros` | {n} pantallas | {n} screens | GestionPaquetes.tsx:254 |
| `catalogos.paquetes.admite-codigo` | Admite código | Takes negotiation codes | GestionPaquetes.tsx:260 |
| `catalogos.paquetes.precio-final` | Precio final | Final price | GestionPaquetes.tsx:260 |
| `catalogos.paquetes.en-uso.title` | Propuestas que aplican este paquete | Proposals that use this bundle | GestionPaquetes.tsx:266 |
| `catalogos.paquetes.en-uso` | En uso · {n} | In use · {n} | GestionPaquetes.tsx:268 |
| `catalogos.paquetes.desactivar` | Desactivar | Deactivate | GestionPaquetes.tsx:278 |
| `catalogos.paquetes.activar` | Activar | Activate | GestionPaquetes.tsx:278 |
| `catalogos.paquetes.desactivar.title` | Desactivar conserva la definición y deja de poder venderse. Lo ya cotizado y lo ya aprobado no se mueven. | Deactivating keeps the definition and stops it from being sold. What is already quoted or approved does not change. | GestionPaquetes.tsx:276 |
| `catalogos.paquetes.eliminar.title` | Eliminar: ninguna venta se mueve, porque su precio ya está copiado en cada propuesta. Lo que se pierde es saber de qué paquete salió. | Delete: no sale changes, because its price is already copied into each proposal. What is lost is knowing which bundle it came from. | GestionPaquetes.tsx:286 |
| `catalogos.paquetes.nuevo` | Nuevo paquete | New bundle | GestionPaquetes.tsx:304 |
| `catalogos.paquetes.nombre.aria` | Nombre del paquete | Bundle name | GestionPaquetes.tsx:310 |
| `catalogos.paquetes.nombre.placeholder` | p. ej. Paquete Periférico | e.g. Outer ring bundle | GestionPaquetes.tsx:312 |
| `catalogos.paquetes.precio` | Precio del conjunto (pesos enteros) | Price for the set (whole pesos) | GestionPaquetes.tsx:318 |
| `catalogos.paquetes.precio.aria` | Precio cerrado del paquete | Bundle fixed price | GestionPaquetes.tsx:323 |
| `catalogos.paquetes.precio.placeholder` | p. ej. {ejemplo} | e.g. {ejemplo} | GestionPaquetes.tsx:327 |
| `catalogos.paquetes.admite-codigo-encima` | Admite código de negociación encima | Takes a negotiation code on top | GestionPaquetes.tsx:335, GestionPaquetes.tsx:339 |
| `catalogos.paquetes.pantallas-del-paquete` | Pantallas del paquete | Bundle screens | GestionPaquetes.tsx:345 |
| `catalogos.paquetes.minimo` | ␣(mínimo 2). Una propuesta solo puede aplicar este paquete si tiene {exactamente} estas pantallas. | ␣(at least 2). A proposal can only use this bundle if it has {exactamente} these screens. | GestionPaquetes.tsx:348 |
| `catalogos.paquetes.minimo.exactamente` | exactamente | exactly | GestionPaquetes.tsx:348 |
| `catalogos.paquetes.elegidas.uno` | {n} elegida | {n} selected | GestionPaquetes.tsx:351 |
| `catalogos.paquetes.elegidas.otros` | {n} elegidas | {n} selected | GestionPaquetes.tsx:351 |
| `catalogos.paquetes.de-lista` | {monto} de lista | {monto} at list | GestionPaquetes.tsx:372 |
| `catalogos.paquetes.resumen.lista` | Lista {monto} | List {monto} | GestionPaquetes.tsx:386 |
| `catalogos.paquetes.resumen.paquete` | Paquete {monto} | Bundle {monto} | GestionPaquetes.tsx:389 |
| `catalogos.paquetes.resumen.deja-de-cobrar` | se deja de cobrar {monto} | {monto} below list | GestionPaquetes.tsx:394 |
| `catalogos.paquetes.resumen.por-encima` | se cobra {monto} POR ENCIMA de la lista | {monto} ABOVE list | GestionPaquetes.tsx:395 |
| `catalogos.paquetes.reparto.intro` | Así se repartiría entre las pantallas — y esto es lo que el reporte de rentabilidad le atribuirá a cada una: | This is how it would be split among the screens — and what the profitability report will assign to each one: | GestionPaquetes.tsx:400 |
| `catalogos.paquetes.reparto.pantalla` | Pantalla | Screen | GestionPaquetes.tsx:406 |
| `catalogos.paquetes.reparto.lista` | Lista | List | GestionPaquetes.tsx:407 |
| `catalogos.paquetes.reparto.parte` | Parte del paquete | Bundle share | GestionPaquetes.tsx:408 |
| `catalogos.paquetes.reparto.suma` | Suma de las partes {cuadra} | Sum of the shares {cuadra} | GestionPaquetes.tsx:423 |
| `catalogos.paquetes.reparto.cuadra` | — cuadra al peso | — adds up to the peso | GestionPaquetes.tsx:423 |
| `catalogos.paquetes.crear` | Crear paquete | Create bundle | GestionPaquetes.tsx:442 |
| `catalogos.rejilla.descripcion` | Las dos dimensiones de la tarifa: la hora del día y la época del año. Se capturan una vez y valen para todo el inventario. | The two dimensions of the rate: the time of day and the time of year. They are entered once and apply to the whole inventory. | page.tsx:36 |
| `catalogos.rejilla.no-leer` | No se pudo leer el catálogo | Could not load the catalog | GestionRejilla.tsx:83 |
| `catalogos.rejilla.no-dar-de-baja` | No se pudo dar de baja | Could not deactivate | GestionRejilla.tsx:141 |
| `catalogos.rejilla.cargando` | Cargando el catálogo | Loading the catalog | GestionRejilla.tsx:149 |
| `catalogos.rejilla.candado.titulo` | Confirma con tu contraseña | Confirm with your password | GestionRejilla.tsx:165 |
| `catalogos.rejilla.candado.subtitulo` | Franjas y temporadas son precio: tu organización pide la contraseña para cambiarlas. | Dayparts and seasons are pricing: your organization requires your password to change them. | GestionRejilla.tsx:166 |
| `catalogos.rejilla.candado.confirmar` | Confirmar y guardar | Confirm and save | GestionRejilla.tsx:167, RejillaDialog.tsx:197 |
| `catalogos.rejilla.franjas.titulo` | Franjas horarias | Dayparts | GestionRejilla.tsx:186 |
| `catalogos.rejilla.franjas.subtitulo` | Fin exclusivo · sin solapes | End is exclusive · no overlaps | GestionRejilla.tsx:187 |
| `catalogos.rejilla.franjas.explicacion` | El fin es {exclusivo}: 06:00–10:00 y 10:00–14:00 se tocan y no se pisan. Dos franjas no pueden solaparse — si pudieran, el precio de un spot a las 09:30 dependería de un desempate que nadie decidió. | The end is {exclusivo}: 06:00–10:00 and 10:00–14:00 touch without overlapping. Two dayparts cannot overlap — if they could, the price of a spot at 09:30 would depend on a tie-break nobody decided. | GestionRejilla.tsx:191 |
| `catalogos.rejilla.franjas.explicacion.exclusivo` | exclusivo | exclusive | GestionRejilla.tsx:192 |
| `catalogos.rejilla.col.orden` | Orden | Order | GestionRejilla.tsx:202, GestionRejilla.tsx:276 |
| `catalogos.rejilla.franjas.vacio` | Todavía no hay ninguna. Sin franjas, todo se vende con la tarifa base — que es exactamente como funciona hoy. | None yet. Without dayparts, everything sells at the base rate — which is exactly how it works today. | GestionRejilla.tsx:211 |
| `catalogos.rejilla.dar-de-baja.title` | Dar de baja: deja de ofrecerse, y lo ya contratado sigue en pie | Deactivate: it is no longer offered, and what is already booked stays in place | GestionRejilla.tsx:236 |
| `catalogos.rejilla.franja.nombre.aria` | Nombre de la franja | Daypart name | GestionRejilla.tsx:249 |
| `catalogos.rejilla.franja.nombre.placeholder` | p. ej. Prime | e.g. Prime | GestionRejilla.tsx:251 |
| `catalogos.rejilla.franja.inicio.aria` | Hora de inicio | Start time | GestionRejilla.tsx:258 |
| `catalogos.rejilla.franja.fin.aria` | Hora de fin | End time | GestionRejilla.tsx:267 |
| `catalogos.rejilla.temporadas.titulo` | Temporadas | Seasons | GestionRejilla.tsx:302 |
| `catalogos.rejilla.temporadas.subtitulo` | Fechas con año · ambos extremos entran | Dates with year · both ends included | GestionRejilla.tsx:303 |
| `catalogos.rejilla.temporadas.explicacion` | Fechas {concretas}, con año: «Buen Fin 2026» y «Buen Fin 2027» son dos temporadas, porque las fechas cambian cada año. Ambos extremos entran. Tampoco pueden solaparse: si «Diciembre» y «Buen Fin» se pisan, hay que decidir qué precio manda esos días. | {concretas} dates, with year: “Buen Fin 2026” and “Buen Fin 2027” are two seasons, because the dates change every year. Both ends are included. They cannot overlap either: if “December” and “Buen Fin” overlap, you have to decide which price applies on those days. | GestionRejilla.tsx:307 |
| `catalogos.rejilla.temporadas.explicacion.concretas` | concretas | Specific | GestionRejilla.tsx:308 |
| `catalogos.rejilla.temporadas.vacio` | Todavía no hay ninguna. | None yet. | GestionRejilla.tsx:326 |
| `catalogos.rejilla.temporada.nombre.aria` | Nombre de la temporada | Season name | GestionRejilla.tsx:357 |
| `catalogos.rejilla.temporada.nombre.placeholder` | p. ej. Buen Fin 2026 | e.g. Buen Fin 2026 | GestionRejilla.tsx:359 |
| `catalogos.rejilla.temporada.inicio.aria` | Fecha de inicio | Start date | GestionRejilla.tsx:366 |
| `catalogos.rejilla.temporada.fin.aria` | Fecha de fin | End date | GestionRejilla.tsx:375 |
| `catalogos.programacion.no-leer` | No se pudo leer la programación | Could not load the schedule | ProgramacionPorFranja.tsx:64 |
| `catalogos.programacion.no-programar` | No se pudo programar | Could not schedule | ProgramacionPorFranja.tsx:84 |
| `catalogos.programacion.cargando` | Cargando la programación | Loading the schedule | ProgramacionPorFranja.tsx:92 |
| `catalogos.programacion.titulo` | Horario de transmisión | Broadcast schedule | ProgramacionPorFranja.tsx:107 |
| `catalogos.programacion.subtitulo` | No cambia ningún precio | No price changes | ProgramacionPorFranja.tsx:109 |
| `catalogos.programacion.explicacion` | En qué franja {negrita} cada campaña. No cambia ningún precio: lo vendido ya está en la campaña desde la propuesta. Puedes marcar varias campañas y programarlas de una vez; si alguna no se puede, no se programa ninguna. | Which daypart each campaign {negrita} in. No price changes: what was sold already came into the campaign from the proposal. You can select several campaigns and schedule them at once; if any of them can’t be scheduled, none is. | ProgramacionPorFranja.tsx:113 |
| `catalogos.programacion.explicacion.negrita` | se transmite | airs | ProgramacionPorFranja.tsx:113 |
| `catalogos.programacion.sin-permiso` | Solo el gerente de ventas, el director comercial y la dirección pueden programar el horario. Aquí ves cómo está. | Only the sales manager, the sales director and management can schedule broadcasts. You can view the current schedule here. | ProgramacionPorFranja.tsx:124 |
| `catalogos.programacion.sin-franjas` | Da de alta al menos una franja arriba para poder programar campañas en ella. | Add at least one daypart above to schedule campaigns in it. | ProgramacionPorFranja.tsx:138 |
| `catalogos.programacion.campanas.uno` | {n} campaña | {n} campaign | ProgramacionPorFranja.tsx:155 |
| `catalogos.programacion.campanas.otros` | {n} campañas | {n} campaigns | ProgramacionPorFranja.tsx:155 |
| `catalogos.programacion.ninguna` | Ninguna campaña se transmite en esta franja. | No campaign airs in this daypart. | ProgramacionPorFranja.tsx:160 |
| `catalogos.programacion.quitar.aria` | Quitar {campana} de {franja} | Remove {campana} from {franja} | ProgramacionPorFranja.tsx:174 |
| `catalogos.programacion.quitar.title` | Quitar de esta franja (no toca lo vendido) | Remove from this daypart (doesn’t affect what was sold) | ProgramacionPorFranja.tsx:175 |
| `catalogos.programacion.programar-en` | Programar campañas en {franja} | Schedule campaigns in {franja} | ProgramacionPorFranja.tsx:200 |
| `catalogos.programacion.marcadas.uno` | ␣({n} marcada) | ␣({n} selected) | ProgramacionPorFranja.tsx:201 |
| `catalogos.programacion.marcadas.otros` | ␣({n} marcadas) | ␣({n} selected) | ProgramacionPorFranja.tsx:201 |
| `catalogos.programacion.hoy-en` | (hoy en {franja}) | (now in {franja}) | ProgramacionPorFranja.tsx:219 |
| `catalogos.programacion.boton` | Programar {n} en {franja} | Schedule {n} in {franja} | ProgramacionPorFranja.tsx:232 |
| `catalogos.programacion.boton.vacio` | Programar  en {franja} | Schedule in {franja} | ProgramacionPorFranja.tsx:233 |
| `catalogos.tarifas.no-leer` | No se pudo leer la rejilla | Could not load the rate grid | RejillaDialog.tsx:98 |
| `catalogos.tarifas.guardadas` | Tarifas por franja guardadas | Daypart rates saved | RejillaDialog.tsx:157 |
| `catalogos.tarifas.no-guardar` | No se pudieron guardar las tarifas por franja | Could not save the daypart rates | RejillaDialog.tsx:161 |
| `catalogos.tarifas.titulo` | Tarifas por franja y temporada | Rates by daypart and season | RejillaDialog.tsx:182 |
| `catalogos.tarifas.guardando` | Guardando… | Saving… | RejillaDialog.tsx:195 |
| `catalogos.tarifas.guardar` | Guardar tarifas | Save rates | RejillaDialog.tsx:198 |
| `catalogos.tarifas.invalida` | Hay una tarifa en rojo que no se entiende: la coma separa miles y el punto, decimales ({ejemplo}). | A rate in red cannot be read: the comma separates thousands and the period, decimals ({ejemplo}). | RejillaDialog.tsx:208 |
| `catalogos.tarifas.sin-catalogo` | Esta organización todavía no tiene franjas ni temporadas. Se declaran una sola vez en {pantalla}, y valen para todo el inventario. | This organization has no dayparts or seasons yet. They are set up once in {pantalla}, and apply to the whole inventory. | RejillaDialog.tsx:214 |
| `catalogos.tarifas.dispersa` | Solo hace falta capturar las combinaciones que tengan un precio distinto. Lo que no esté aquí se cobra con la tarifa por unidad de siempre — la rejilla no obliga a llenar nada. | You only need to enter the combinations that have a different price. Anything not here is billed at the usual per-unit rate — the grid doesn’t require filling anything in. | RejillaDialog.tsx:220 |
| `catalogos.tarifas.tarifa-de.aria` | Tarifa de {unidad} | Rate for {unidad} | RejillaDialog.tsx:248 |
| `catalogos.tarifas.conservar` | Conservar | Keep | RejillaDialog.tsx:260 |
| `catalogos.tarifas.quitar` | Quitar | Remove | RejillaDialog.tsx:260 |
| `catalogos.tarifas.nueva.unidad.aria` | Unidad de la nueva tarifa | Unit for the new rate | RejillaDialog.tsx:276 |
| `catalogos.tarifas.nueva.unidad` | Unidad… | Unit… | RejillaDialog.tsx:281 |
| `catalogos.tarifas.nueva.franja.aria` | Franja de la nueva tarifa | Daypart for the new rate | RejillaDialog.tsx:291 |
| `catalogos.tarifas.nueva.temporada.aria` | Temporada de la nueva tarifa | Season for the new rate | RejillaDialog.tsx:306 |
| `catalogos.tarifas.nueva.tarifa.aria` | Tarifa de la nueva fila | Rate for the new row | RejillaDialog.tsx:321 |
| `catalogos.volumen.descripcion` | Qué descuento gana quien compra mucho. Se captura una vez por unidad de venta y vale para todo el inventario. | The discount a high-volume buyer gets. It is entered once per sales unit and applies to the whole inventory. | page.tsx:36 |
| `catalogos.volumen.no-leer` | No se pudo leer la escala | Could not load the scale | GestionVolumen.tsx:66 |
| `catalogos.volumen.cargando` | Cargando la escala | Loading the scale | GestionVolumen.tsx:114 |
| `catalogos.volumen.aviso.todas` | El descuento se aplica sobre TODAS las unidades, no solo sobre las que pasan del umbral. | The discount applies to ALL units, not only to those above the threshold. | GestionVolumen.tsx:153 |
| `catalogos.volumen.aviso.ejemplo` | «A partir de 50 spots, 10 %» quiere decir que quien compra 50 paga los 50 con el 10 % menos. Consecuencia: quien compra 49 paga más que quien compra 50, y el salto puede ser mayor que el precio de una unidad. | “From 50 spots, 10%” means that whoever buys 50 pays for all 50 at 10% off. Consequence: whoever buys 49 pays more than whoever buys 50, and the jump can be larger than the price of one unit. | GestionVolumen.tsx:154 |
| `catalogos.volumen.aviso.compone` | Y se {compone} con el descuento comercial: un 20 % aquí y un 20 % en la propuesta dejan al cliente pagando el {pct}, no el 60 %. | And it {compone} with the commercial discount: 20% here and 20% on the proposal leave the client paying {pct}, not 60%. | GestionVolumen.tsx:156 |
| `catalogos.volumen.aviso.compone.negrita` | compone | compounds | GestionVolumen.tsx:157 |
| `catalogos.volumen.aviso.compone.pct` | 64 % | 64% | GestionVolumen.tsx:158 |
| `catalogos.volumen.tramos.titulo` | Tramos por unidad de venta | Tiers by sales unit | GestionVolumen.tsx:167 |
| `catalogos.volumen.tramos.subtitulo` | Cada unidad tiene su propia escala | Each unit has its own scale | GestionVolumen.tsx:168 |
| `catalogos.volumen.escala.title` | El descuento del tramo alcanzado se aplica a TODAS las unidades | The discount of the tier reached applies to ALL units | GestionVolumen.tsx:173 |
| `catalogos.volumen.escala` | Escala plana (volumen) | Flat scale (volume) | GestionVolumen.tsx:174 |
| `catalogos.volumen.explicacion` | Cada unidad tiene su propia escala, porque 50 spots y 50 meses no son la misma compra. Los tramos tienen que {crecer}: comprar más nunca puede descontar menos. | Each unit has its own scale, because 50 spots and 50 months are not the same purchase. Tiers have to {crecer}: buying more can never discount less. | GestionVolumen.tsx:180 |
| `catalogos.volumen.explicacion.crecer` | crecer | increase | GestionVolumen.tsx:180 |
| `catalogos.volumen.col.a-partir` | A partir de | From | GestionVolumen.tsx:187 |
| `catalogos.volumen.col.descuento` | Descuento | Discount | GestionVolumen.tsx:188 |
| `catalogos.volumen.vacio` | Todavía no hay ninguno. Sin tramos, todo se vende al precio de tarifa — que es exactamente como funciona hoy. | None yet. Without tiers, everything sells at the list rate — which is exactly how it works today. | GestionVolumen.tsx:196 |
| `catalogos.volumen.tramos.uno` | ␣· {n} tramo | ␣· {n} tier | GestionVolumen.tsx:205 |
| `catalogos.volumen.tramos.otros` | ␣· {n} tramos | ␣· {n} tiers | GestionVolumen.tsx:205 |
| `catalogos.volumen.escalon` | Escalón {n} | Step {n} | GestionVolumen.tsx:210 |
| `catalogos.volumen.desde` | desde {cantidad} {unidad} | from {cantidad} {unidad} | GestionVolumen.tsx:212 |
| `catalogos.volumen.pct` | → {pct} % | → {pct}% | GestionVolumen.tsx:217 |
| `catalogos.volumen.eliminar.title` | Eliminar: deja de aplicarse a partir de ahora. Lo ya cotizado y lo ya aprobado no se mueven. | Delete: it stops applying from now on. What is already quoted or approved does not change. | GestionVolumen.tsx:225 |
| `catalogos.volumen.unidad.aria` | Unidad de venta | Sales unit | GestionVolumen.tsx:240 |
| `catalogos.volumen.cantidad.aria` | A partir de qué cantidad | From what quantity | GestionVolumen.tsx:256 |
| `catalogos.volumen.cantidad.placeholder` | p. ej. 50 | e.g. 50 | GestionVolumen.tsx:261 |
| `catalogos.volumen.pct.aria` | Descuento por ciento | Discount percentage | GestionVolumen.tsx:268 |
| `catalogos.volumen.pct.placeholder` | p. ej. 10 | e.g. 10 | GestionVolumen.tsx:274 |
| `catalogos.volumen.anadir` | Añadir tramo | Add tier | GestionVolumen.tsx:286 |
| `catalogos.motivo.paquete.nombre` | El paquete necesita un nombre. | The bundle needs a name. | paquete.ts:267 |
| `catalogos.motivo.paquete.nombre-largo` | El nombre del paquete no puede pasar de 120 caracteres. | The bundle name cannot be longer than 120 characters. | paquete.ts:268 |
| `catalogos.motivo.paquete.precio-numero` | El precio del paquete tiene que ser un numero. | The bundle price has to be a number. | paquete.ts:272, paquete.ts:275 |
| `catalogos.motivo.paquete.precio-cero` | El precio de un paquete tiene que ser mayor que 0: un paquete gratis no es un paquete. | A bundle price has to be greater than 0: a free bundle is not a bundle. | paquete.ts:277 |
| `catalogos.motivo.paquete.precio-entero` | El precio del paquete tiene que ser un numero entero de pesos: el reparto entre las pantallas no admite centavos. | The bundle price has to be a whole number of pesos: the split among the screens does not allow cents. | paquete.ts:282 |
| `catalogos.motivo.paquete.dos-pantallas` | Un paquete necesita al menos 2 pantallas; con una sola, eso es una tarifa y va en la ficha de la pantalla. | A bundle needs at least 2 screens; with only one, that is a rate and it goes on the screen’s profile. | paquete.ts:290 |
| `catalogos.motivo.paquete.repetida` | Hay una pantalla repetida en el paquete. | A screen is repeated in the bundle. | paquete.ts:294 |
| `catalogos.motivo.franja.nombre` | La franja necesita un nombre. | The daypart needs a name. | rejilla.ts:174 |
| `catalogos.motivo.franja.hora` | Hora no válida en "{nombre}": se escribe HH:MM en 24 horas, de 00:00 a 23:59. | Invalid time in “{nombre}”: use HH:MM in 24-hour format, from 00:00 to 23:59. | rejilla.ts:179 |
| `catalogos.motivo.franja.misma-hora` | La franja "{nombre}" empieza y termina a la misma hora: no cubre nada. | The daypart “{nombre}” starts and ends at the same time: it covers nothing. | rejilla.ts:183 |
| `catalogos.motivo.franja.solape` | La franja "{nombre}" ({inicio}–{fin}) se solapa con "{otra}" ({otraInicio}–{otraFin}). | The daypart “{nombre}” ({inicio}–{fin}) overlaps “{otra}” ({otraInicio}–{otraFin}). | rejilla.ts:196 |
| `catalogos.motivo.temporada.nombre` | La temporada necesita un nombre. | The season needs a name. | rejilla.ts:226 |
| `catalogos.motivo.temporada.fecha` | Fecha no válida en "{nombre}": se escribe AAAA-MM-DD. | Invalid date in “{nombre}”: use YYYY-MM-DD. | rejilla.ts:231 |
| `catalogos.motivo.temporada.al-reves` | La temporada "{nombre}" termina antes de empezar. | The season “{nombre}” ends before it starts. | rejilla.ts:235 |
| `catalogos.motivo.temporada.solape` | La temporada "{nombre}" ({desde} a {hasta}) se solapa con "{otra}" ({otraDesde} a {otraHasta}). | The season “{nombre}” ({desde} to {hasta}) overlaps “{otra}” ({otraDesde} to {otraHasta}). | rejilla.ts:244 |
| `catalogos.motivo.tramo.unidad` | El tramo necesita una unidad de venta. | The tier needs a sales unit. | volumen.ts:162 |
| `catalogos.motivo.tramo.cantidad-entera` | La cantidad desde la que aplica tiene que ser un numero entero. | The quantity it applies from has to be a whole number. | volumen.ts:166, volumen.ts:169 |
| `catalogos.motivo.tramo.sin-fracciones` | La cantidad desde la que aplica tiene que ser un numero entero: no se venden fracciones de unidad. | The quantity it applies from has to be a whole number: fractions of a unit are not sold. | volumen.ts:171 |
| `catalogos.motivo.tramo.desde-dos` | Un tramo de volumen empieza desde 2 unidades o mas; "desde 1" seria bajar el tarifario entero. | A volume tier starts at 2 units or more; “from 1” would lower the whole rate card. | volumen.ts:175 |
| `catalogos.motivo.tramo.pct-numero` | El descuento tiene que ser un numero. | The discount has to be a number. | volumen.ts:179, volumen.ts:182 |
| `catalogos.motivo.tramo.pct-cero` | El descuento de un tramo tiene que ser mayor que 0 %: un tramo al 0 % no hace nada. | A tier’s discount has to be greater than 0%: a tier at 0% does nothing. | volumen.ts:183 |
| `catalogos.motivo.tramo.pct-cien` | El descuento de un tramo no puede pasar del 100 %. | A tier’s discount cannot exceed 100%. | volumen.ts:184 |
| `catalogos.motivo.tramo.mismo-umbral` | Ya hay un tramo desde {n} para esta unidad ({pct} %). Dos tramos con el mismo umbral son dos precios para la misma compra. | There is already a tier from {n} for this unit ({pct}%). Two tiers with the same threshold are two prices for the same purchase. | volumen.ts:195 |
| `catalogos.motivo.tramo.mas-y-menos` | No se puede comprar mas y descontar menos: el tramo desde {otroDesde} ya da {otroPct} % y este, desde {n}, daria {pct} %. | Buying more cannot discount less: the tier from {otroDesde} already gives {otroPct}% and this one, from {n}, would give {pct}%. | volumen.ts:204 |
| `catalogos.motivo.tramo.menos-y-mas` | No se puede comprar mas y descontar menos: el tramo desde {otroDesde} da {otroPct} % y este, desde {n}, daria {pct} %. | Buying more cannot discount less: the tier from {otroDesde} gives {otroPct}% and this one, from {n}, would give {pct}%. | volumen.ts:210 |
| `compartidos.cifra.forma` | Escribe solo cifras: la coma separa miles y el punto, decimales. Ejemplo: {ejemplo} | Enter digits only: the comma separates thousands and the period, decimals. Example: {ejemplo} | captura-cifra.ts:65 |
| `compartidos.cifra.comas` | Las comas van cada tres cifras, como en {ejemplo}. Si querías decimales, usa punto: {decimal} | Commas go every three digits, as in {ejemplo}. If you meant decimals, use a period: {decimal} | captura-cifra.ts:95 |
| `compartidos.cifra.europeo` | Aquí el punto es decimal y la coma separa miles: escribe {ejemplo} | Here the period is the decimal point and the comma separates thousands: enter {ejemplo} | captura-cifra.ts:86 |
| `compartidos.cifra.puntos` | Solo puede haber un punto, y es el decimal. Para miles usa coma: {ejemplo} | There can be only one period, and it is the decimal point. For thousands use a comma: {ejemplo} | captura-cifra.ts:87 |
| `compartidos.cifra.vacia` | Escribe una cifra | Enter a number | captura-cifra.ts:70 |
| `compartidos.cifra.punto-decimal` | En México el punto es decimal: «{texto}» sería {decimal}. Para {miles} escribe {sinComas} o {miles} | Here the period is the decimal point: “{texto}” would be {decimal}. For {miles} enter {sinComas} or {miles} | captura-cifra.ts:107 |
| `compartidos.cifra.enteras` | Solo cifras enteras, sin decimales | Whole numbers only, no decimals | captura-cifra.ts:116 |
| `compartidos.cifra.max-decimales.uno` | Máximo {n} decimal | At most {n} decimal place | captura-cifra.ts:119 |
| `compartidos.cifra.max-decimales.otros` | Máximo {n} decimales | At most {n} decimal places | captura-cifra.ts:119 |
| `compartidos.cifra.grande` | Esa cifra es demasiado grande | That number is too large | captura-cifra.ts:129 |
| `compartidos.cifra.negativo` | No puede ser negativo | It cannot be negative | captura-cifra.ts:139 |
| `compartidos.cifra.menor` | No puede ser menor que {n} | It cannot be less than {n} | captura-cifra.ts:140 |
| `compartidos.cifra.mayor` | No puede ser mayor que {n} | It cannot be greater than {n} | captura-cifra.ts:144 |
