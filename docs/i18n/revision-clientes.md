# Tabla de revisión · lote de inglés «operaciones y clientes», ámbito clientes

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/clientes.ts` y de
los usos en el código (búsqueda literal de la clave). **220 claves**
`clientes.*`. Pantallas: `/clientes` (con su ficha: pipeline y campañas del
cliente), `/comisiones` y `/captacion`.

- **español** es la copia literal de lo que decía el componente antes del lote,
  comprobado comparando el HTML rendido de **25 estados de pantalla** antes
  (fuentes de `HEAD` antes del commit) y después: idénticos byte a byte
  (`diff -rq`; ver `lib/i18n/pantallas-clientes.test.ts`, que con
  `I18N_VOLCAR=<carpeta>` vuelca el HTML español de cada estado).
- `␣` marca un espacio al principio o al final: es intencional, el texto va
  pegado a otro nodo.
- Los huecos `{nombre}` se rellenan en tiempo de ejecución con datos, importes
  ya formateados (`formatMontoCorto(…, idioma)`) o elementos
  (`interpolarNodos`). Ninguna cifra de dinero ni símbolo de moneda vive en el
  diccionario; `{moneda}` es el código ISO de la instancia (`monedaInstancia()`).
- **Espejos:** `clientes.pipeline.etapa.*` reproduce `ETAPA_CLIENTE_LABEL`
  (`lib/cliente-pipeline.ts`), `clientes.captacion.tipo.*` reproduce
  `ETIQUETA_TIPO` (`lib/captacion.ts`), y `clientes.form.cp-invalido` /
  `clientes.form.telefono-invalido` reproducen `CP_INVALIDO` /
  `TELEFONO_INVALIDO` (`lib/validacion.ts`). Lo exige `textos/clientes.test.ts`.
  `clientes.captacion.falta.*` son las frases que devuelve
  `faltantesParaRevision` (ahora con `idioma`, `'es'` por omisión).
- Las claves de otros lotes que se reusan (`comun.cancelar`, `comun.guardar`,
  `validacion.email`, `propuestas.comun.guardando`, `compartidos.candado.falta`,
  `compartidos.contrasena.etiqueta`, las etapas de `comercial.negociacion.etapa.*`
  y las de campaña `campanas.estado.*` / `campanas.etapa.*`) no salen en esta
  tabla.
- «qué es» lo asigna una heurística sobre cada línea de uso; si discrepa de lo
  que se ve en pantalla, manda la pantalla.

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `clientes.titulo` | `app/(app)/(shell)/clientes/page.tsx:100` | texto en pantalla | Clientes | Clients |
| `clientes.subtitulo` | `app/(app)/(shell)/clientes/page.tsx:101` | texto en pantalla | Catálogo de clientes y sus datos fiscales | Client catalog and tax details |
| `clientes.nuevo` | `app/(app)/(shell)/clientes/page.tsx:105`<br>`app/(app)/(shell)/clientes/page.tsx:524` | texto en pantalla · título / tooltip | Nuevo cliente | New client |
| `clientes.vacia` | `app/(app)/(shell)/clientes/page.tsx:114` | texto en pantalla | Aún no hay clientes. | No clients yet. |
| `clientes.vacia.alta` | `app/(app)/(shell)/clientes/page.tsx:114` | texto en pantalla | ␣Da de alta el primero con «Nuevo cliente». | ␣Add the first one with “New client”. |
| `clientes.lista.titulo` | `app/(app)/(shell)/clientes/page.tsx:119` | rótulo / encabezado | Lista de clientes | Client list |
| `clientes.lista.de` | `app/(app)/(shell)/clientes/page.tsx:122` | texto en pantalla | {n} de {total} | {n} of {total} |
| `clientes.lista.cliente.uno` | `app/(app)/(shell)/clientes/page.tsx:123` | texto en pantalla | cliente | client |
| `clientes.lista.cliente.otros` | `app/(app)/(shell)/clientes/page.tsx:123` | texto en pantalla | clientes | clients |
| `clientes.lista.buscar` | `app/(app)/(shell)/clientes/page.tsx:133` | etiqueta accesible (aria-label) | Buscar cliente | Search clients |
| `clientes.lista.buscar.ejemplo` | `app/(app)/(shell)/clientes/page.tsx:136` | texto de ejemplo (placeholder) | Nombre, RFC o razón social… | Name, RFC or legal name… |
| `clientes.lista.tipo` | `app/(app)/(shell)/clientes/page.tsx:141` | etiqueta accesible (aria-label) | Tipo de cliente | Client type |
| `clientes.lista.tipo.todos` | `app/(app)/(shell)/clientes/page.tsx:146` | opción de lista | Directos y agencias | Direct and agencies |
| `clientes.lista.tipo.directos` | `app/(app)/(shell)/clientes/page.tsx:147` | opción de lista | Solo directos | Direct only |
| `clientes.lista.tipo.agencias` | `app/(app)/(shell)/clientes/page.tsx:148` | opción de lista | Solo agencias | Agencies only |
| `clientes.col.cliente` | `app/(app)/(shell)/clientes/page.tsx:161` | rótulo / encabezado | Cliente | Client |
| `clientes.col.rfc` | `app/(app)/(shell)/clientes/page.tsx:162`<br>`app/(app)/(shell)/clientes/page.tsx:639` | rótulo / encabezado | RFC | RFC |
| `clientes.col.razon-social` | `app/(app)/(shell)/clientes/page.tsx:163`<br>`app/(app)/(shell)/clientes/page.tsx:646` | rótulo / encabezado | Razón social | Legal name |
| `clientes.col.tipo` | `app/(app)/(shell)/clientes/page.tsx:164` | rótulo / encabezado | Tipo | Type |
| `clientes.col.pipeline` | `app/(app)/(shell)/clientes/page.tsx:165` | rótulo / encabezado | En pipeline | In pipeline |
| `clientes.col.en-curso` | `app/(app)/(shell)/clientes/page.tsx:166` | rótulo / encabezado | Campañas en curso | Active campaigns |
| `clientes.col.contacto` | `app/(app)/(shell)/clientes/page.tsx:167` | rótulo / encabezado | Contacto | Contact |
| `clientes.filtro.ninguno` | `app/(app)/(shell)/clientes/page.tsx:175` | texto en pantalla | Ningún cliente coincide{busqueda}{tipo}. Quita el filtro para ver los {n}. | No client matches{busqueda}{tipo}. Clear the filter to see all {n}. |
| `clientes.filtro.con` | `app/(app)/(shell)/clientes/page.tsx:176` | texto en pantalla | ␣con «{texto}» | ␣“{texto}” |
| `clientes.filtro.entre-agencias` | `app/(app)/(shell)/clientes/page.tsx:178` | etiqueta de un valor (mapa de claves) | ␣entre las agencias | ␣among agencies |
| `clientes.filtro.entre-directos` | `app/(app)/(shell)/clientes/page.tsx:178` | etiqueta de un valor (mapa de claves) | ␣entre los directos | ␣among direct clients |
| `clientes.ver-ficha` | `app/(app)/(shell)/clientes/page.tsx:197` | título / tooltip | Ver pipeline y campañas | View pipeline and campaigns |
| `clientes.tipo.agencia` | `app/(app)/(shell)/clientes/page.tsx:207`<br>`app/(app)/(shell)/clientes/page.tsx:548`<br>`components/demo/clientes/FichaCliente.tsx:25` | texto en pantalla · opción de lista | Agencia | Agency |
| `clientes.tipo.directo` | `app/(app)/(shell)/clientes/page.tsx:207`<br>`app/(app)/(shell)/clientes/page.tsx:548`<br>`app/(app)/(shell)/comisiones/page.tsx:416`<br>`components/demo/clientes/FichaCliente.tsx:25` | texto en pantalla · opción de lista | Directo | Direct |
| `clientes.negociacion.validada` | `app/(app)/(shell)/clientes/page.tsx:225`<br>`app/(app)/(shell)/clientes/page.tsx:612`<br>`app/(app)/(shell)/clientes/page.tsx:625`<br>`app/(app)/(shell)/comisiones/page.tsx:259` | texto en pantalla | Negociación validada | Negotiation validated |
| `clientes.negociacion.sin-validar` | `app/(app)/(shell)/clientes/page.tsx:225`<br>`app/(app)/(shell)/clientes/page.tsx:620` | texto en pantalla | Negociación sin validar | Negotiation not validated |
| `clientes.negociacion.bloquea` | `app/(app)/(shell)/clientes/page.tsx:222`<br>`app/(app)/(shell)/clientes/page.tsx:614` | texto en pantalla | Mientras no esté validada, no se pueden crear ni aprobar propuestas con esta agencia. | Until it is validated, proposals with this agency can’t be created or approved. |
| `clientes.pipeline.titulo-fila` | `app/(app)/(shell)/clientes/page.tsx:236` | título / tooltip | Borrador + enviadas, con IVA | Draft + sent, incl. VAT |
| `clientes.sin-contacto` | `app/(app)/(shell)/clientes/page.tsx:252` | texto en pantalla | Sin contacto | No contact |
| `clientes.editar.nombre` | `app/(app)/(shell)/clientes/page.tsx:262` | etiqueta accesible (aria-label) | Editar {nombre} | Edit {nombre} |
| `clientes.editar` | `app/(app)/(shell)/clientes/page.tsx:263`<br>`app/(app)/(shell)/clientes/page.tsx:524` | título / tooltip | Editar cliente | Edit client |
| `clientes.borrar.nombre` | `app/(app)/(shell)/clientes/page.tsx:273`<br>`app/(app)/(shell)/clientes/page.tsx:358` | etiqueta accesible (aria-label) · título / tooltip | Borrar {nombre} | Delete {nombre} |
| `clientes.borrar` | `app/(app)/(shell)/clientes/page.tsx:274` | título / tooltip | Borrar cliente | Delete client |
| `clientes.borrar.no-se-pudo` | `app/(app)/(shell)/clientes/page.tsx:348` | mensaje de error | No se pudo borrar el cliente | The client could not be deleted |
| `clientes.borrar.subtitulo` | `app/(app)/(shell)/clientes/page.tsx:359` | título / tooltip | Esta acción no se puede deshacer | This action can’t be undone |
| `clientes.borrar.borrando` | `app/(app)/(shell)/clientes/page.tsx:369` | texto en pantalla | Borrando… | Deleting… |
| `clientes.borrar.confirmar` | `app/(app)/(shell)/clientes/page.tsx:371` | texto en pantalla | Confirmar y borrar | Confirm and delete |
| `clientes.borrar.de-todos-modos` | `app/(app)/(shell)/clientes/page.tsx:373` | texto en pantalla | Borrar de todos modos | Delete anyway |
| `clientes.borrar.boton` | `app/(app)/(shell)/clientes/page.tsx:374` | texto en pantalla | Borrar | Delete |
| `clientes.borrar.irreversible` | `app/(app)/(shell)/clientes/page.tsx:383` | texto en pantalla | Borrar un cliente es irreversible, así que hace falta tu contraseña. | Deleting a client is irreversible, so your password is required. |
| `clientes.borrar.se-borrara` | `app/(app)/(shell)/clientes/page.tsx:399` | texto en pantalla | Se borrará {nombre}{rfc}. | {nombre}{rfc} will be deleted. |
| `clientes.form.rfc-invalido` | `app/(app)/(shell)/clientes/page.tsx:473` | texto en pantalla | RFC inválido. Formato SAT (p. ej. XAXX010101000) | Invalid RFC. SAT format (e.g. XAXX010101000) |
| `clientes.form.cp-invalido` | `app/(app)/(shell)/clientes/page.tsx:474` | texto en pantalla | Código postal inválido (5 dígitos) | Invalid ZIP code (5 digits) |
| `clientes.form.telefono-invalido` | `app/(app)/(shell)/clientes/page.tsx:476` | texto en pantalla | Teléfono inválido. Escribe 10 dígitos (p. ej. 55 1234 5678) | Invalid phone number. Enter 10 digits (e.g. 55 1234 5678) |
| `clientes.form.revisa` | `app/(app)/(shell)/clientes/page.tsx:486` | mensaje de error | Revisa los campos marcados. | Check the highlighted fields. |
| `clientes.form.no-se-pudo-guardar` | `app/(app)/(shell)/clientes/page.tsx:514`<br>`app/(app)/(shell)/comisiones/page.tsx:294` | mensaje de error · aviso (toast) | No se pudo guardar | Could not save |
| `clientes.form.subtitulo` | `app/(app)/(shell)/clientes/page.tsx:525` | título / tooltip | Datos generales y fiscales (para facturar) | General and tax details (for invoicing) |
| `clientes.form.nombre` | `app/(app)/(shell)/clientes/page.tsx:542` | rótulo / encabezado | Nombre del cliente | Client name |
| `clientes.form.tipo` | `app/(app)/(shell)/clientes/page.tsx:546` | rótulo / encabezado | Tipo | Type |
| `clientes.form.correo` | `app/(app)/(shell)/clientes/page.tsx:551` | rótulo / encabezado | Correo de contacto | Contact email |
| `clientes.form.correo.ejemplo` | `app/(app)/(shell)/clientes/page.tsx:552` | texto de ejemplo (placeholder) | cuentas@cliente.com | accounts@client.com |
| `clientes.form.telefono` | `app/(app)/(shell)/clientes/page.tsx:556` | rótulo / encabezado | Teléfono | Phone |
| `clientes.form.comision` | `app/(app)/(shell)/clientes/page.tsx:561`<br>`app/(app)/(shell)/comisiones/page.tsx:234` | rótulo / encabezado | Comisión de la agencia (%) | Agency commission (%) |
| `clientes.form.iva` | `app/(app)/(shell)/clientes/page.tsx:566` | rótulo / encabezado | IVA (%) | VAT (%) |
| `clientes.form.iva.ayuda` | `app/(app)/(shell)/clientes/page.tsx:571` | texto en pantalla | Se elige del catálogo de IVAs (Administración → Configuración). Se aplica al facturar y al presupuesto de sus campañas. | Chosen from the VAT catalog (Settings → Configuration). Applied when invoicing and to the budget of their campaigns. |
| `clientes.form.negociacion` | `app/(app)/(shell)/clientes/page.tsx:579` | texto en pantalla | Negociación con la agencia | Negotiation with the agency |
| `clientes.form.hay-negociacion` | `app/(app)/(shell)/clientes/page.tsx:591`<br>`app/(app)/(shell)/comisiones/page.tsx:246` | texto en pantalla | ¿Hay negociación con la agencia? | Is there a negotiation with the agency? |
| `clientes.form.terminos` | `app/(app)/(shell)/clientes/page.tsx:596` | rótulo / encabezado | Términos de la negociación | Negotiation terms |
| `clientes.form.terminos.ejemplo` | `app/(app)/(shell)/clientes/page.tsx:601` | texto de ejemplo (placeholder) | p. ej. comisión especial 18%, condiciones de pago a 60 días… | e.g. special 18% commission, payment at 60 days… |
| `clientes.form.fiscales` | `app/(app)/(shell)/clientes/page.tsx:635` | texto en pantalla | Datos fiscales | Tax details |
| `clientes.form.cp` | `app/(app)/(shell)/clientes/page.tsx:642` | rótulo / encabezado | C.P. fiscal | Tax ZIP code |
| `clientes.form.regimen` | `app/(app)/(shell)/clientes/page.tsx:649` | rótulo / encabezado | Régimen fiscal | Tax regime |
| `clientes.form.uso-cfdi` | `app/(app)/(shell)/clientes/page.tsx:655` | rótulo / encabezado | Uso de CFDI | CFDI use |
| `clientes.form.selecciona` | `app/(app)/(shell)/clientes/page.tsx:651`<br>`app/(app)/(shell)/clientes/page.tsx:657` | opción de lista | — Selecciona — | — Select — |
| `clientes.ficha.subtitulo` | `components/demo/clientes/FichaCliente.tsx:24` | título / tooltip | {tipo}{rfc} · pipeline y campañas | {tipo}{rfc} · pipeline and campaigns |
| `clientes.pipeline.titulo` | `components/demo/clientes/PipelineCliente.tsx:53` | texto en pantalla | Pipeline | Pipeline |
| `clientes.pipeline.resumen` | `components/demo/clientes/PipelineCliente.tsx:55` | texto en pantalla | Montos con IVA · en pipeline {valor} · tasa de cierre histórica {tasa} | Amounts incl. VAT · in pipeline {valor} · historical close rate {tasa} |
| `clientes.pipeline.sin-capturar` | `components/demo/clientes/PipelineCliente.tsx:69` | título / tooltip | monto sin capturar | amount not entered |
| `clientes.pipeline.sin-monto` | `components/demo/clientes/PipelineCliente.tsx:70` | texto en pantalla | —, sin monto | —, no amount |
| `clientes.pipeline.fuera` | `components/demo/clientes/PipelineCliente.tsx:84` | texto en pantalla | Fuera del embudo: {rechazadas} ({monto}) · {canceladas} | Outside the funnel: {rechazadas} ({monto}) · {canceladas} |
| `clientes.pipeline.rechazadas.uno` | `components/demo/clientes/PipelineCliente.tsx:87` | etiqueta de un valor (mapa de claves) | {n} propuesta rechazada | {n} rejected proposal |
| `clientes.pipeline.rechazadas.otros` | `components/demo/clientes/PipelineCliente.tsx:87` | etiqueta de un valor (mapa de claves) | {n} propuestas rechazadas | {n} rejected proposals |
| `clientes.pipeline.canceladas.uno` | `components/demo/clientes/PipelineCliente.tsx:91` | etiqueta de un valor (mapa de claves) | {n} campaña cancelada | {n} cancelled campaign |
| `clientes.pipeline.canceladas.otros` | `components/demo/clientes/PipelineCliente.tsx:91` | etiqueta de un valor (mapa de claves) | {n} campañas canceladas | {n} cancelled campaigns |
| `clientes.pipeline.etapa.borrador` | `components/demo/clientes/PipelineCliente.tsx:30` | etiqueta de un valor (mapa de claves) | Borrador | Draft |
| `clientes.pipeline.etapa.enviada` | `components/demo/clientes/PipelineCliente.tsx:31` | etiqueta de un valor (mapa de claves) | Enviada | Sent |
| `clientes.pipeline.etapa.aprobada` | `components/demo/clientes/PipelineCliente.tsx:32` | etiqueta de un valor (mapa de claves) | Aprobada | Approved |
| `clientes.pipeline.etapa.en-curso` | `components/demo/clientes/PipelineCliente.tsx:33` | etiqueta de un valor (mapa de claves) | Campaña en curso | Active campaign |
| `clientes.pipeline.etapa.terminada` | `components/demo/clientes/PipelineCliente.tsx:34` | etiqueta de un valor (mapa de claves) | Terminada | Finished |
| `clientes.campanas.titulo` | `components/demo/clientes/CampanasDelCliente.tsx:36` | texto en pantalla | Campañas | Campaigns |
| `clientes.campanas.vacia` | `components/demo/clientes/CampanasDelCliente.tsx:40` | texto en pantalla | Este cliente aún no tiene campañas. | This client has no campaigns yet. |
| `clientes.campanas.sin-presupuesto` | `components/demo/clientes/CampanasDelCliente.tsx:62` | texto en pantalla | Sin presupuesto | No budget |
| `clientes.comisiones.titulo` | `app/(app)/(shell)/comisiones/page.tsx:39` | texto en pantalla | Comisiones | Commissions |
| `clientes.comisiones.subtitulo` | `app/(app)/(shell)/comisiones/page.tsx:41` | texto en pantalla | Ajusta la comisión por agencia y la agencia asignada a cada cliente. | Set the commission for each agency and the agency assigned to each client. |
| `clientes.comisiones.chip.agencias` | `app/(app)/(shell)/comisiones/page.tsx:76` | rótulo / encabezado | Agencias | Agencies |
| `clientes.comisiones.chip.sin-validar` | `app/(app)/(shell)/comisiones/page.tsx:78` | rótulo / encabezado | Negociación sin validar | Negotiation not validated |
| `clientes.comisiones.chip.sin-validar.ayuda` | `app/(app)/(shell)/comisiones/page.tsx:81` | título / tooltip | Sin validar, no se pueden crear ni aprobar propuestas con esa agencia | Until it is validated, proposals with that agency can’t be created or approved |
| `clientes.comisiones.chip.sin-agencia` | `app/(app)/(shell)/comisiones/page.tsx:83` | rótulo / encabezado | Clientes sin agencia | Clients without an agency |
| `clientes.comisiones.agencias.titulo` | `app/(app)/(shell)/comisiones/page.tsx:91` | rótulo / encabezado | Agencias y su comisión | Agencies and their commission |
| `clientes.comisiones.nueva` | `app/(app)/(shell)/comisiones/page.tsx:97`<br>`app/(app)/(shell)/comisiones/page.tsx:216` | texto en pantalla · título / tooltip | Nueva agencia | New agency |
| `clientes.comisiones.agencias.vacia` | `app/(app)/(shell)/comisiones/page.tsx:106` | rótulo / encabezado | Aún no hay agencias | No agencies yet |
| `clientes.comisiones.agencias.vacia.crear` | `app/(app)/(shell)/comisiones/page.tsx:107` | texto en pantalla | Usa «Nueva agencia» para crear una. | Use “New agency” to create one. |
| `clientes.comisiones.agencias.vacia.esperar` | `app/(app)/(shell)/comisiones/page.tsx:107` | texto en pantalla | Cuando se dé de alta una agencia aparecerá aquí. | Once an agency is added, it will show up here. |
| `clientes.comisiones.col.agencia` | `app/(app)/(shell)/comisiones/page.tsx:116`<br>`app/(app)/(shell)/comisiones/page.tsx:154` | rótulo / encabezado | Agencia | Agency |
| `clientes.comisiones.col.comision` | `app/(app)/(shell)/comisiones/page.tsx:117` | rótulo / encabezado | Comisión | Commission |
| `clientes.comisiones.col.negociacion` | `app/(app)/(shell)/comisiones/page.tsx:118` | rótulo / encabezado | Negociación | Negotiation |
| `clientes.comisiones.col.clientes` | `app/(app)/(shell)/comisiones/page.tsx:119` | rótulo / encabezado | Clientes | Clients |
| `clientes.comisiones.clientes.titulo` | `app/(app)/(shell)/comisiones/page.tsx:140` | rótulo / encabezado | Clientes y su agencia | Clients and their agency |
| `clientes.comisiones.clientes.vacia` | `app/(app)/(shell)/comisiones/page.tsx:146` | rótulo / encabezado | No hay clientes directos | No direct clients |
| `clientes.comisiones.col.cliente` | `app/(app)/(shell)/comisiones/page.tsx:153` | rótulo / encabezado | Cliente | Client |
| `clientes.comisiones.col.aplicada` | `app/(app)/(shell)/comisiones/page.tsx:155` | rótulo / encabezado | Comisión aplicada | Applied commission |
| `clientes.comisiones.no-se-pudo-crear` | `app/(app)/(shell)/comisiones/page.tsx:207` | mensaje de error | No se pudo crear la agencia | The agency could not be created |
| `clientes.comisiones.nueva.subtitulo` | `app/(app)/(shell)/comisiones/page.tsx:217` | título / tooltip | Alta de cliente tipo Agencia con su comisión | Add an agency-type client with its commission |
| `clientes.comisiones.crear` | `app/(app)/(shell)/comisiones/page.tsx:224` | texto en pantalla | Crear agencia | Create agency |
| `clientes.comisiones.nombre` | `app/(app)/(shell)/comisiones/page.tsx:231` | rótulo / encabezado | Nombre de la agencia | Agency name |
| `clientes.comisiones.nombre.ejemplo` | `app/(app)/(shell)/comisiones/page.tsx:232` | texto de ejemplo (placeholder) | p. ej. Andina Media | e.g. Andina Media |
| `clientes.comisiones.terminos.ejemplo` | `app/(app)/(shell)/comisiones/page.tsx:254` | texto de ejemplo (placeholder) | Términos negociados (comisión especial, condiciones de pago…) | Negotiated terms (special commission, payment terms…) |
| `clientes.comisiones.validada.ayuda` | `app/(app)/(shell)/comisiones/page.tsx:260` | texto en pantalla | Sin validar, no se pueden crear ni aprobar propuestas con esta agencia. | Until it is validated, proposals with this agency can’t be created or approved. |
| `clientes.comisiones.comision-de` | `app/(app)/(shell)/comisiones/page.tsx:311` | etiqueta accesible (aria-label) | Comisión de {nombre} (%) | {nombre} commission (%) |
| `clientes.comisiones.sin-negociacion` | `app/(app)/(shell)/comisiones/page.tsx:341` | texto en pantalla | Sin negociación | No negotiation |
| `clientes.comisiones.validada` | `app/(app)/(shell)/comisiones/page.tsx:345` | texto en pantalla | Validada | Validated |
| `clientes.comisiones.quitar` | `app/(app)/(shell)/comisiones/page.tsx:354` | texto en pantalla | Quitar | Remove |
| `clientes.comisiones.sin-validar` | `app/(app)/(shell)/comisiones/page.tsx:361` | texto en pantalla | Sin validar | Not validated |
| `clientes.comisiones.validar` | `app/(app)/(shell)/comisiones/page.tsx:365` | texto en pantalla | Validar | Validate |
| `clientes.comisiones.no-se-pudo-asignar` | `app/(app)/(shell)/comisiones/page.tsx:396` | aviso (toast) | No se pudo asignar | Could not assign |
| `clientes.comisiones.selecciona-agencia` | `app/(app)/(shell)/comisiones/page.tsx:412` | opción de lista | — Selecciona agencia — | — Select agency — |
| `clientes.comisiones.sin-agencia` | `app/(app)/(shell)/comisiones/page.tsx:423` | título / tooltip | Cliente sin agencia asignada | Client with no agency assigned |
| `clientes.comisiones.directo-sin-comision` | `app/(app)/(shell)/comisiones/page.tsx:423` | título / tooltip | Directo · sin comisión | Direct · no commission |
| `clientes.captacion.titulo` | `app/(app)/(shell)/captacion/page.tsx:18` | texto en pantalla | Captación | Prospecting |
| `clientes.captacion.subtitulo` | `app/(app)/(shell)/captacion/page.tsx:20` | texto en pantalla | Clientes, arrendadores, predios y pantallas que se están trabajando, con la bitácora de cada uno. Cuando uno está listo se envía a revisión, y al aprobarlo se da de alta. | Clients, landlords, properties and screens being worked on, each with its log. When one is ready it is sent for review, and once approved it is added. |
| `clientes.captacion.vista.curso` | `components/demo/captacion/Captacion.tsx:96` | rótulo / encabezado | En curso | In progress |
| `clientes.captacion.vista.revision` | `components/demo/captacion/Captacion.tsx:97` | rótulo / encabezado | Por aprobar | Pending approval |
| `clientes.captacion.vista.cerrados` | `components/demo/captacion/Captacion.tsx:98` | rótulo / encabezado | Cerrados | Closed |
| `clientes.captacion.vista.todos` | `components/demo/captacion/Captacion.tsx:99` | rótulo / encabezado | Todos | All |
| `clientes.captacion.tipo.cliente` | `components/demo/captacion/Captacion.tsx:74` | etiqueta de un valor (mapa de claves) | Cliente | Client |
| `clientes.captacion.tipo.arrendador` | `components/demo/captacion/Captacion.tsx:75` | etiqueta de un valor (mapa de claves) | Arrendador | Landlord |
| `clientes.captacion.tipo.predio` | `components/demo/captacion/Captacion.tsx:76` | etiqueta de un valor (mapa de claves) | Predio | Property |
| `clientes.captacion.tipo.pantalla` | `components/demo/captacion/Captacion.tsx:77` | etiqueta de un valor (mapa de claves) | Pantalla | Screen |
| `clientes.captacion.campo.rfc` | `components/demo/captacion/Captacion.tsx:110`<br>`components/demo/captacion/Captacion.tsx:115` | rótulo / encabezado | RFC | RFC |
| `clientes.captacion.campo.razon-social` | `components/demo/captacion/Captacion.tsx:111` | rótulo / encabezado | Razón social | Legal name |
| `clientes.captacion.campo.giro` | `components/demo/captacion/Captacion.tsx:112` | rótulo / encabezado | Giro | Line of business |
| `clientes.captacion.campo.presupuesto` | `components/demo/captacion/Captacion.tsx:113` | rótulo / encabezado | Presupuesto estimado ({moneda}) | Estimated budget ({moneda}) |
| `clientes.captacion.campo.tipo-ubicacion` | `components/demo/captacion/Captacion.tsx:117` | rótulo / encabezado | Tipo de ubicación (azotea, terreno…) | Location type (rooftop, lot…) |
| `clientes.captacion.campo.m2` | `components/demo/captacion/Captacion.tsx:118` | rótulo / encabezado | Metros cuadrados | Square meters |
| `clientes.captacion.campo.renta` | `components/demo/captacion/Captacion.tsx:119`<br>`components/demo/captacion/Captacion.tsx:126` | rótulo / encabezado | Renta que piden ({moneda} / mes) | Asking rent ({moneda} / month) |
| `clientes.captacion.campo.tipo-pantalla` | `components/demo/captacion/Captacion.tsx:122` | rótulo / encabezado | Tipo | Type |
| `clientes.captacion.campo.ancho` | `components/demo/captacion/Captacion.tsx:123` | rótulo / encabezado | Ancho (m) | Width (m) |
| `clientes.captacion.campo.alto` | `components/demo/captacion/Captacion.tsx:124` | rótulo / encabezado | Alto (m) | Height (m) |
| `clientes.captacion.campo.caras` | `components/demo/captacion/Captacion.tsx:125` | rótulo / encabezado | Caras | Faces |
| `clientes.captacion.estatica` | `components/demo/captacion/Captacion.tsx:254` | opción de lista | Estática | Static |
| `clientes.captacion.digital` | `components/demo/captacion/Captacion.tsx:254` | opción de lista | Digital | Digital |
| `clientes.captacion.form.que-captas` | `components/demo/captacion/Captacion.tsx:196` | rótulo / encabezado | ¿Qué estás captando? | What are you prospecting? |
| `clientes.captacion.form.tipo-fijo` | `components/demo/captacion/Captacion.tsx:212` | texto en pantalla | El tipo no se cambia: decide qué registro se crea al aprobar. | The type can’t be changed: it decides which record is created on approval. |
| `clientes.captacion.form.nombre` | `components/demo/captacion/Captacion.tsx:215`<br>`components/demo/captacion/Captacion.tsx:217`<br>`components/demo/captacion/Captacion.tsx:226` | rótulo / encabezado · texto de ejemplo (placeholder) · etiqueta accesible (aria-label) | Nombre | Name |
| `clientes.captacion.form.nombre.empresa` | `components/demo/captacion/Captacion.tsx:217` | texto de ejemplo (placeholder) | Empresa o marca | Company or brand |
| `clientes.captacion.form.nombre.ubicacion` | `components/demo/captacion/Captacion.tsx:217` | texto de ejemplo (placeholder) | Nombre de la ubicación | Location name |
| `clientes.captacion.form.dueno` | `components/demo/captacion/Captacion.tsx:224` | texto en pantalla | Dueño del terreno (se dará de alta como arrendador al aprobar) | Land owner (added as a landlord on approval) |
| `clientes.captacion.form.contacto` | `components/demo/captacion/Captacion.tsx:224`<br>`components/demo/captacion/Captacion.tsx:378` | texto en pantalla | Contacto | Contact |
| `clientes.captacion.form.contacto.nombre` | `components/demo/captacion/Captacion.tsx:226` | etiqueta accesible (aria-label) | Nombre del contacto | Contact name |
| `clientes.captacion.form.telefono` | `components/demo/captacion/Captacion.tsx:228` | etiqueta accesible (aria-label) | Teléfono | Phone |
| `clientes.captacion.form.correo` | `components/demo/captacion/Captacion.tsx:230` | etiqueta accesible (aria-label) | Correo | Email |
| `clientes.captacion.form.direccion` | `components/demo/captacion/Captacion.tsx:240`<br>`components/demo/captacion/Captacion.tsx:381` | rótulo / encabezado · texto en pantalla | Dirección | Address |
| `clientes.captacion.form.notas` | `components/demo/captacion/Captacion.tsx:265`<br>`components/demo/captacion/Captacion.tsx:391` | rótulo / encabezado · texto en pantalla | Notas | Notes |
| `clientes.captacion.form.siguiente` | `components/demo/captacion/Captacion.tsx:271`<br>`components/demo/captacion/Captacion.tsx:386`<br>`components/demo/captacion/Captacion.tsx:460` | rótulo / encabezado · texto en pantalla · etiqueta accesible (aria-label) | Siguiente paso | Next step |
| `clientes.captacion.form.siguiente.ejemplo` | `components/demo/captacion/Captacion.tsx:272` | texto de ejemplo (placeholder) | Ej. llamar para agendar visita | E.g. call to schedule a visit |
| `clientes.captacion.form.para-cuando` | `components/demo/captacion/Captacion.tsx:275` | rótulo / encabezado | ¿Para cuándo? | By when? |
| `clientes.captacion.form.primera-nota` | `components/demo/captacion/Captacion.tsx:282` | rótulo / encabezado | Primera nota de la bitácora | First log note |
| `clientes.captacion.form.primera-nota.ejemplo` | `components/demo/captacion/Captacion.tsx:283` | texto de ejemplo (placeholder) | Cómo surgió este prospecto | How this prospect came up |
| `clientes.captacion.falta.contacto` | `lib/captacion.ts:142` | texto en pantalla | un teléfono o un correo de contacto | a contact phone or email |
| `clientes.captacion.falta.direccion` | `lib/captacion.ts:145` | texto en pantalla | la dirección | the address |
| `clientes.captacion.falta.dueno` | `lib/captacion.ts:152` | texto en pantalla | el dueño: un arrendador existente o el nombre y teléfono del contacto | the owner: an existing landlord or the contact’s name and phone |
| `clientes.captacion.para-revision` | `components/demo/captacion/Captacion.tsx:330` | mensaje de error | Para enviarlo a revisión falta: {faltan} | To send it for review, it still needs: {faltan} |
| `clientes.captacion.para-revision.punto` | `components/demo/captacion/Captacion.tsx:467` | texto en pantalla | Para enviarlo a revisión falta: {faltan}. | To send it for review, it still needs: {faltan}. |
| `clientes.captacion.error.avance` | `components/demo/captacion/Captacion.tsx:337` | mensaje de error | No se pudo registrar el avance | The update could not be recorded |
| `clientes.captacion.error.aprobar` | `components/demo/captacion/Captacion.tsx:350` | mensaje de error | No se pudo aprobar | Could not approve |
| `clientes.captacion.error.rechazar` | `components/demo/captacion/Captacion.tsx:360` | mensaje de error | No se pudo rechazar | Could not reject |
| `clientes.captacion.error.leer` | `components/demo/captacion/Captacion.tsx:527` | mensaje de error | No se pudieron leer los prospectos | The prospects could not be loaded |
| `clientes.captacion.error.abrir` | `components/demo/captacion/Captacion.tsx:547` | mensaje de error | No se pudo abrir el prospecto | The prospect could not be opened |
| `clientes.captacion.error.guardar` | `components/demo/captacion/Captacion.tsx:562` | mensaje de error | No se pudo guardar | Could not save |
| `clientes.captacion.detalle.etapa` | `components/demo/captacion/Captacion.tsx:376`<br>`components/demo/captacion/Captacion.tsx:446` | texto en pantalla · rótulo / encabezado | Etapa | Stage |
| `clientes.captacion.detalle.vendedor` | `components/demo/captacion/Captacion.tsx:377` | texto en pantalla | Vendedor | Sales rep |
| `clientes.captacion.detalle.para-el` | `components/demo/captacion/Captacion.tsx:387` | texto en pantalla | ␣· para el {fecha} | ␣· by {fecha} |
| `clientes.captacion.rechazado` | `components/demo/captacion/Captacion.tsx:395` | texto en pantalla | Rechazado: | Rejected: |
| `clientes.captacion.rechazado-por` | `components/demo/captacion/Captacion.tsx:395` | texto en pantalla | Rechazado por {nombre}: | Rejected by {nombre}: |
| `clientes.captacion.aprobado` | `components/demo/captacion/Captacion.tsx:400` | texto en pantalla | Aprobado. | Approved. |
| `clientes.captacion.aprobado-por` | `components/demo/captacion/Captacion.tsx:400` | texto en pantalla | Aprobado por {nombre}. | Approved by {nombre}. |
| `clientes.captacion.falta-inventario` | `components/demo/captacion/Captacion.tsx:402` | texto en pantalla | Falta darla de alta en Inventario con sus medidas y tarifas. | It still has to be added in Inventory with its dimensions and rates. |
| `clientes.captacion.ya-existe` | `components/demo/captacion/Captacion.tsx:403` | etiqueta de un valor (mapa de claves) | El {tipo} ya existe en el sistema. | The {tipo} already exists in the system. |
| `clientes.captacion.editar-datos` | `components/demo/captacion/Captacion.tsx:409` | texto en pantalla | Editar datos | Edit details |
| `clientes.captacion.revision` | `components/demo/captacion/Captacion.tsx:414` | texto en pantalla | Revisión | Review |
| `clientes.captacion.al-aprobar.predio` | `components/demo/captacion/Captacion.tsx:417` | texto en pantalla | Al aprobar se da de alta el predio (y su arrendador, si es nuevo). | Approving adds the property (and its landlord, if new). |
| `clientes.captacion.al-aprobar.pantalla` | `components/demo/captacion/Captacion.tsx:419` | texto en pantalla | Al aprobar se da de alta nada todavía: la pantalla se completa en Inventario. | Approving doesn’t add anything yet: the screen is completed in Inventory. |
| `clientes.captacion.al-aprobar.otro` | `components/demo/captacion/Captacion.tsx:420` | etiqueta de un valor (mapa de claves) | Al aprobar se da de alta el {tipo}. | Approving adds the {tipo}. |
| `clientes.captacion.aprobar` | `components/demo/captacion/Captacion.tsx:424` | texto en pantalla | Aprobar | Approve |
| `clientes.captacion.otro-distinto` | `components/demo/captacion/Captacion.tsx:428` | texto en pantalla | Es otro distinto: aprobar de todos modos | It’s a different one: approve anyway |
| `clientes.captacion.motivo` | `components/demo/captacion/Captacion.tsx:433` | texto de ejemplo (placeholder) | Motivo del rechazo (lo lee el vendedor) | Reason for rejection (the sales rep reads it) |
| `clientes.captacion.rechazar` | `components/demo/captacion/Captacion.tsx:436` | texto en pantalla | Rechazar | Reject |
| `clientes.captacion.avance` | `components/demo/captacion/Captacion.tsx:444` | texto en pantalla | Registrar avance | Record update |
| `clientes.captacion.solo-nota` | `components/demo/captacion/Captacion.tsx:449` | opción de lista | {etapa} (solo una nota) | {etapa} (note only) |
| `clientes.captacion.que-paso` | `components/demo/captacion/Captacion.tsx:453`<br>`components/demo/captacion/Captacion.tsx:454` | rótulo / encabezado · texto de ejemplo (placeholder) | Qué pasó | What happened |
| `clientes.captacion.fecha-siguiente` | `components/demo/captacion/Captacion.tsx:462` | etiqueta accesible (aria-label) | Fecha del siguiente paso | Next step date |
| `clientes.captacion.guardar-avance` | `components/demo/captacion/Captacion.tsx:469` | texto en pantalla | Guardar avance | Save update |
| `clientes.captacion.bitacora` | `components/demo/captacion/Captacion.tsx:474` | texto en pantalla | Bitácora | Log |
| `clientes.captacion.usuario-eliminado` | `components/demo/captacion/Captacion.tsx:481` | texto en pantalla | Usuario eliminado | Deleted user |
| `clientes.captacion.todos-los-tipos` | `components/demo/captacion/Captacion.tsx:588` | opción de lista | Todos los tipos | All types |
| `clientes.captacion.nuevo` | `components/demo/captacion/Captacion.tsx:592`<br>`components/demo/captacion/Captacion.tsx:684` | texto en pantalla · título / tooltip | Nuevo prospecto | New prospect |
| `clientes.captacion.esperan` | `components/demo/captacion/Captacion.tsx:598` | texto en pantalla | Estos esperan a que un gerente, director o administrador los revise. | These are waiting for a manager, director or admin to review them. |
| `clientes.captacion.prospectos` | `components/demo/captacion/Captacion.tsx:606` | rótulo / encabezado | Prospectos | Prospects |
| `clientes.captacion.col.nombre` | `components/demo/captacion/Captacion.tsx:611` | rótulo / encabezado | Nombre | Name |
| `clientes.captacion.col.tipo` | `components/demo/captacion/Captacion.tsx:587`<br>`components/demo/captacion/Captacion.tsx:612` | etiqueta accesible (aria-label) · rótulo / encabezado | Tipo | Type |
| `clientes.captacion.col.etapa` | `components/demo/captacion/Captacion.tsx:613` | rótulo / encabezado | Etapa | Stage |
| `clientes.captacion.col.siguiente` | `components/demo/captacion/Captacion.tsx:614` | rótulo / encabezado | Siguiente paso | Next step |
| `clientes.captacion.col.vendedor` | `components/demo/captacion/Captacion.tsx:615` | rótulo / encabezado | Vendedor | Sales rep |
| `clientes.captacion.col.actualizado` | `components/demo/captacion/Captacion.tsx:616` | rótulo / encabezado | Actualizado | Updated |
| `clientes.captacion.vacia.curso` | `components/demo/captacion/Captacion.tsx:633` | texto en pantalla | No hay prospectos en curso. Da de alta el primero con «Nuevo prospecto». | No prospects in progress. Add the first one with “New prospect”. |
| `clientes.captacion.vacia.revision` | `components/demo/captacion/Captacion.tsx:635` | texto en pantalla | Nada espera aprobación. | Nothing is waiting for approval. |
| `clientes.captacion.vacia.cerrados` | `components/demo/captacion/Captacion.tsx:637` | texto en pantalla | Aún no hay prospectos cerrados. | No closed prospects yet. |
| `clientes.captacion.vacia.todos` | `components/demo/captacion/Captacion.tsx:638` | texto en pantalla | Aún no hay prospectos. | No prospects yet. |
| `clientes.captacion.vencido-hace` | `components/demo/captacion/Captacion.tsx:660` | texto en pantalla | vencido hace {n} d | overdue by {n} d |
| `clientes.captacion.vencido` | `components/demo/captacion/Captacion.tsx:660` | texto en pantalla | vencido | overdue |
| `clientes.captacion.anterior` | `components/demo/captacion/Captacion.tsx:673` | texto en pantalla | Anterior | Previous |
| `clientes.captacion.pagina` | `components/demo/captacion/Captacion.tsx:674` | texto en pantalla | Página {n} de {paginas} · {total} prospectos | Page {n} of {paginas} · {total} prospects |
| `clientes.captacion.siguiente` | `components/demo/captacion/Captacion.tsx:675` | texto en pantalla | Siguiente | Next |
| `clientes.captacion.editar` | `components/demo/captacion/Captacion.tsx:684` | título / tooltip | Editar prospecto | Edit prospect |
| `clientes.captacion.form.subtitulo` | `components/demo/captacion/Captacion.tsx:685` | título / tooltip | Captura lo que tengas; lo mínimo para enviarlo a revisión se pide al enviarlo. | Enter what you have; the minimum needed for review is asked for when you send it. |
