# Tabla de revisión · lote de inglés «campañas y finanzas»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/campanas.ts` (396
claves) y `apps/web/lib/i18n/textos/finanzas.ts` (175 claves) y de los usos en el
código (búsqueda literal de la clave). **571 claves.** Regenerada en la segunda vuelta (correcciones del validador, `docs/i18n/validacion-campanas-finanzas.md`, y decisiones del orquestador). Rama
`feat/ingles-campanas-finanzas`, sobre `integra/ingles` (27047bfe).

- **español** es la copia literal de lo que decía el componente antes del lote.
  Comprobado con el HTML rendido de **54 estados de pantalla** antes y después:
  idéntico byte a byte (`diff -rq`; ver la cabecera de
  `lib/i18n/pantallas-campanas-finanzas.test.ts`, variable `I18N_VOLCAR`).
- Los huecos `{nombre}` se rellenan con datos o con importes ya formateados
  (`formatMonto`); ninguna cifra vive en el diccionario. El ejemplo «212,500.50»
  del candado entra por hueco (`{ejemplo}`) por la GUARDIA 2 de `dinero.test.ts`.
- `␣` marca un espacio intencional al principio o al final.
- Las claves de estado (`campanas.estado.*`, `.etapa.*`, `.validacion-pub.*`,
  `.creatividad.*`, `.reserva.*`, `.ot.*`, `.impresion.*`, `.remoto.*`,
  `finanzas.cobranza.*` de semáforo, `finanzas.periodo.*` de opción,
  `finanzas.parcialidad.*`, `finanzas.vence.*`) se usan a través de los mapas
  `components/demo/campanas/etiquetas.ts` y `components/demo/finanzas/etiquetas.ts`;
  su español lo ata una prueba al módulo de origen, que no se tocó.
- Plurales `.uno`/`.otros`: el español de las dos es el de siempre (si decía
  «pantalla(s)» lo sigue diciendo); el inglés concuerda.
- Las fechas pasan por `formatFecha(…, idioma)` / `formatFechaHora(…, idioma)`.
- Las claves globales reutilizadas (`comun.cancelar`, `comun.guardar`,
  `comun.cerrar`, `comun.cargando`) ya estaban traducidas y no salen aquí.

## Términos nuevos (no estaban en el glosario)

| español | inglés | nota |
|---|---|---|
| candado de facturación | billing lock | «Candado» suelto en la franja de resumen: «Lock» |
| lista para facturar | ready to invoice | |
| OC / orden de compra | PO / purchase order | «Folio ODC» → «Internal PO ref.» |
| enviada al dominio | **submitted for publishing** | el «dominio» es el CMS de destino (DOOHmain u otro, p. ej. Broadsign): no siempre es DOOHmain |
| validación de publicación | publication review | «Validar» → «Review» |
| evidencia(s) fotográfica(s) | photo evidence | **elegido «evidence»** para lo físico; lo digital sigue «proof of play» |
| testigos (fotos) / fotografías comprobatorias | proof photos | en el código son lo mismo: `testigos` cuenta las evidencias de las OT y `derive.ts:92` dice «fotos comprobatorias = testigos de la OT de montaje» |
| reproducciones | plays | como «salidas/pases» del glosario |
| reporte de cumplimiento / entregado | delivery report / delivered | |
| rentabilidad / margen | profitability / margin | |
| horario de transmisión | broadcast schedule | «Se transmite en» → «Airs in» |
| cuota / parcialidades | installment(s) | «Cobrar en parcialidades» → «Bill in installments»; bimestral → «every two months» |
| abono | partial payment (botón) · payment (columna) | |
| liquidar total | **record full payment** (botón) · «Paid in full» (aviso) | quien lo pulsa registra el cobro, no paga |
| saldo / cargo | balance / charge | |
| al corriente · por vencer · vencida | current · due soon · overdue | |
| emitida · anulada | issued · voided | |
| plazo de cobranza | **payment terms** | |
| razón social | legal name (del cliente) · legal entity (las mías, como el menú) | |
| folio de una factura | **Invoice no.** | «Internal ref.» queda solo para el folio interno de propuestas y campañas |
| folio fiscal | **CFDI UUID** | |
| comprobante (de la factura) | **payment receipt** | el documento imprimible; «La recibe» → «Billed to» |
| comprobante (de un pago, el archivo adjunto) | **proof of payment** | |
| régimen fiscal · CP fiscal · uso CFDI · RFC | tax regime · tax ZIP code · CFDI use · RFC (tax ID) | |
| hilo conductor | **demo storyline** | es la insignia fija de la campaña del guion de la demostración (`camp-telco`, «Telco Andina») |
| reservada (etapa) | **Booked** | alineado con el lote de comercial (book / booking) |
| tipo de campaña HIBRIDA | Hybrid | el español sigue siendo el valor crudo «HIBRIDA» |
| selector de periodo | This month · Last month · This quarter · Last quarter · This year · Custom range | glosario del lote de compartidos |

| clave | archivo:línea donde se usa | español | inglés |
|---|---|---|---|
| `campanas.comun.campana` | `app/(app)/(shell)/campanas/[id]/page.tsx:75` | Campaña | Campaign |
| `campanas.comun.ver-menos` | `app/(app)/(shell)/campanas/page.tsx:162`<br>`components/demo/campanas/ListasCampana.tsx:35` | Ver menos | Show less |
| `campanas.comun.ver-todas` | `app/(app)/(shell)/campanas/page.tsx:162`<br>`components/demo/campanas/ListasCampana.tsx:35` | Ver todas ({n}) | Show all ({n}) |
| `campanas.comun.lista-facturar` | `app/(app)/(shell)/campanas/page.tsx:360`<br>`components/demo/campanas/CandadoPanel.tsx:93`<br>`components/demo/campanas/ResumenCampana.tsx:71` | Lista para facturar | Ready to invoice |
| `campanas.comun.sin-presupuesto` | `app/(app)/(shell)/campanas/page.tsx:435`<br>`components/demo/campanas/ResumenCampana.tsx:57` | Sin presupuesto capturado en la propuesta | No budget entered in the proposal |
| `campanas.comun.minimizar` | `app/(app)/(shell)/campanas/page.tsx:369`<br>`app/(app)/(shell)/campanas/[id]/page.tsx:549` | Minimizar | Minimize |
| `campanas.comun.monto` | `app/(app)/(shell)/campanas/[id]/page.tsx:375`<br>`components/demo/campanas/CandadoPanel.tsx:113` | Monto | Amount |
| `campanas.comun.fecha` | `app/(app)/(shell)/campanas/[id]/page.tsx:376`<br>`components/demo/campanas/CandadoPanel.tsx:121` | Fecha | Date |
| `campanas.comun.total` | `app/(app)/(shell)/campanas/[id]/page.tsx:279`<br>`components/demo/campanas/ResumenCampana.tsx:55` | Total | Total |
| `campanas.comun.margen` | `app/(app)/(shell)/campanas/[id]/page.tsx:339`<br>`components/demo/campanas/ResumenCampana.tsx:60` | Margen | Margin |
| `campanas.comun.pendiente` | `app/(app)/(shell)/campanas/[id]/page.tsx:529`<br>`components/demo/campanas/ResumenCampana.tsx:71` | Pendiente | Pending |
| `campanas.comun.ver-contrato` | `components/demo/campanas/DatosFacturacion.tsx:103`<br>`components/demo/campanas/ExtensionesCampana.tsx:89` | Ver contrato | View contract |
| `campanas.comun.subiendo` | `components/demo/campanas/AgregarCreativo.tsx:146`<br>`components/demo/campanas/DatosFacturacion.tsx:115` | Subiendo… | Uploading… |
| `campanas.comun.contrato-supera` | `components/demo/campanas/DatosFacturacion.tsx:48`<br>`components/demo/campanas/ExtenderCampanaDialog.tsx:73` | El contrato supera {mb} MB | The contract exceeds {mb} MB |
| `campanas.comun.leer-archivo` | `components/demo/campanas/ExtenderCampanaDialog.tsx:78` | No se pudo leer el archivo | Could not read the file |
| `campanas.comun.rango-horas` | `components/demo/campanas/ProgramacionDoohmain.tsx:136` | {inicio} a {fin} | {inicio} to {fin} |
| `campanas.comun.error` | `components/demo/campanas/ValidacionPanel.tsx:493` | Error | Error |
| `campanas.estado.draft` | `components/demo/campanas/etiquetas.ts:35` | Borrador | Draft |
| `campanas.estado.cotizacion` | `components/demo/campanas/etiquetas.ts:36` | Cotización | Quote |
| `campanas.estado.confirmada` | `components/demo/campanas/etiquetas.ts:37` | Confirmada | Confirmed |
| `campanas.estado.activa` | `components/demo/campanas/etiquetas.ts:38` | Activa | Active |
| `campanas.estado.completada` | `components/demo/campanas/etiquetas.ts:39` | Completada | Completed |
| `campanas.estado.cancelada` | `components/demo/campanas/etiquetas.ts:40` | Cancelada | Cancelled |
| `campanas.estado.lista-facturar` | `components/demo/campanas/etiquetas.ts:41` | Lista para facturar | Ready to invoice |
| `campanas.etapa.reservada` | `components/demo/campanas/etiquetas.ts:45` | Reservada | Booked |
| `campanas.etapa.confirmada` | `components/demo/campanas/etiquetas.ts:46` | Confirmada | Confirmed |
| `campanas.etapa.oc-recibida` | `components/demo/campanas/etiquetas.ts:47` | OC recibida | PO received |
| `campanas.etapa.creativo-recibido` | `components/demo/campanas/etiquetas.ts:48` | Creativo recibido | Creative received |
| `campanas.etapa.creativo-validado` | `components/demo/campanas/etiquetas.ts:49` | Creativo validado | Creative approved |
| `campanas.etapa.enviada-dominio` | `components/demo/campanas/etiquetas.ts:50` | Enviada al dominio | Submitted for publishing |
| `campanas.etapa.publicada` | `components/demo/campanas/etiquetas.ts:51` | Publicada | Published |
| `campanas.etapa.en-imprenta` | `components/demo/campanas/etiquetas.ts:52` | En imprenta | At the printer |
| `campanas.etapa.en-produccion` | `components/demo/campanas/etiquetas.ts:53` | En producción | In production |
| `campanas.etapa.instalada` | `components/demo/campanas/etiquetas.ts:54` | Instalada / al aire | Installed / on air |
| `campanas.etapa.reporte-generado` | `components/demo/campanas/etiquetas.ts:55` | Reporte generado | Report generated |
| `campanas.etapa.lista-facturar` | `components/demo/campanas/etiquetas.ts:56` | Lista para facturar | Ready to invoice |
| `campanas.etapa.facturada` | `components/demo/campanas/etiquetas.ts:57` | Facturada | Invoiced |
| `campanas.validacion-pub.pendiente` | `components/demo/campanas/etiquetas.ts:61` | Pendiente de validar | Pending review |
| `campanas.validacion-pub.aprobada` | `components/demo/campanas/etiquetas.ts:62` | Publicación aprobada | Publication approved |
| `campanas.validacion-pub.rechazada` | `components/demo/campanas/etiquetas.ts:63` | Publicación rechazada | Publication rejected |
| `campanas.creatividad.pendiente` | `components/demo/campanas/etiquetas.ts:67` | Pendiente | Pending |
| `campanas.creatividad.validada` | `components/demo/campanas/etiquetas.ts:68` | Validada | Approved |
| `campanas.creatividad.rechazada` | `components/demo/campanas/etiquetas.ts:69` | Rechazada | Rejected |
| `campanas.reserva.tentativa` | `components/demo/campanas/etiquetas.ts:73` | Tentativa | Tentative |
| `campanas.reserva.confirmada` | `components/demo/campanas/etiquetas.ts:74` | Confirmada | Confirmed |
| `campanas.reserva.cancelada` | `components/demo/campanas/etiquetas.ts:75` | Cancelada | Cancelled |
| `campanas.ot.pendiente` | `components/demo/campanas/etiquetas.ts:79` | Pendiente | Pending |
| `campanas.ot.asignada` | `components/demo/campanas/etiquetas.ts:80` | Asignada | Assigned |
| `campanas.ot.en-proceso` | `components/demo/campanas/etiquetas.ts:81` | En proceso | In progress |
| `campanas.ot.bloqueada` | `components/demo/campanas/etiquetas.ts:82` | Bloqueada | Blocked |
| `campanas.ot.en-revision` | `components/demo/campanas/etiquetas.ts:83` | En revisión | In review |
| `campanas.ot.completada` | `components/demo/campanas/etiquetas.ts:84` | Completada | Completed |
| `campanas.ot.rechazada` | `components/demo/campanas/etiquetas.ts:85` | Rechazada | Rejected |
| `campanas.ot.cancelada` | `components/demo/campanas/etiquetas.ts:86` | Cancelada | Cancelled |
| `campanas.impresion.arte-recibido` | `components/demo/campanas/etiquetas.ts:90` | Arte recibido | Artwork received |
| `campanas.impresion.validado` | `components/demo/campanas/etiquetas.ts:91` | Validado | Approved |
| `campanas.impresion.en-produccion` | `components/demo/campanas/etiquetas.ts:92` | En producción | In production |
| `campanas.impresion.impreso` | `components/demo/campanas/etiquetas.ts:93` | Impreso | Printed |
| `campanas.impresion.listo-montaje` | `components/demo/campanas/etiquetas.ts:94` | Listo para montaje | Ready to install |
| `campanas.remoto.active` | `components/demo/campanas/etiquetas.ts:98` | Al aire | On air |
| `campanas.remoto.pause` | `components/demo/campanas/etiquetas.ts:99` | En pausa | Paused |
| `campanas.remoto.finished` | `components/demo/campanas/etiquetas.ts:100` | Finalizada | Finished |
| `campanas.remoto.pending` | `components/demo/campanas/etiquetas.ts:101` | Pendiente | Pending |
| `campanas.remoto.vencida` | `components/demo/campanas/etiquetas.ts:102` | Terminó | Ended |
| `campanas.remoto.programada` | `components/demo/campanas/etiquetas.ts:103` | Programada | Scheduled |
| `campanas.remoto.eliminada` | `components/demo/campanas/etiquetas.ts:104` | Eliminada en DOOHmain | Deleted in DOOHmain |
| `campanas.remoto.no-encontrada` | `components/demo/campanas/etiquetas.ts:105` | No está en DOOHmain | Not in DOOHmain |
| `campanas.tipo.ooh` | `components/demo/campanas/etiquetas.ts:29` | OOH | OOH |
| `campanas.tipo.dooh` | `components/demo/campanas/etiquetas.ts:30` | DOOH | DOOH |
| `campanas.tipo.hibrida` | `components/demo/campanas/etiquetas.ts:31` | HIBRIDA | Hybrid |
| `campanas.lista.titulo` | `app/(app)/(shell)/campanas/page.tsx:109`<br>`app/(app)/(shell)/campanas/[id]/page.tsx:70`<br>`app/(app)/(shell)/campanas/[id]/page.tsx:73` | Campañas | Campaigns |
| `campanas.lista.subtitulo` | `app/(app)/(shell)/campanas/page.tsx:111` | Cada campaña viaja sola por la empresa · pipeline en vivo | Every campaign’s path through the company · live pipeline |
| `campanas.lista.por-validar.titulo` | `app/(app)/(shell)/campanas/page.tsx:127` | Por validar ({n}) | To review ({n}) |
| `campanas.lista.por-validar.sub` | `app/(app)/(shell)/campanas/page.tsx:129` | Enviadas al dominio, esperan aprobación antes de publicar | Submitted for publishing, awaiting approval before going live |
| `campanas.lista.validar` | `app/(app)/(shell)/campanas/page.tsx:149` | Validar | Review |
| `campanas.lista.buscar` | `app/(app)/(shell)/campanas/page.tsx:180` | Buscar por nombre, folio o cliente… | Search by name, Internal ref. or client… |
| `campanas.lista.todos-estados` | `app/(app)/(shell)/campanas/page.tsx:189` | Todos los estados | All statuses |
| `campanas.lista.compacta.volver` | `app/(app)/(shell)/campanas/page.tsx:201` | Volver a mostrar el pipeline de cada campaña | Show each campaign’s pipeline again |
| `campanas.lista.compacta.esconder` | `app/(app)/(shell)/campanas/page.tsx:201` | Esconder los pipelines: una fila por campaña | Hide the pipelines: one row per campaign |
| `campanas.lista.mostrar-pipelines` | `app/(app)/(shell)/campanas/page.tsx:204` | Mostrar pipelines | Show pipelines |
| `campanas.lista.vista-compacta` | `app/(app)/(shell)/campanas/page.tsx:206` | Vista compacta | Compact view |
| `campanas.lista.mostrar-ocultas` | `app/(app)/(shell)/campanas/page.tsx:211`<br>`app/(app)/(shell)/campanas/page.tsx:283` | Mostrar ocultas ({n}) | Show hidden ({n}) |
| `campanas.lista.conteo` | `app/(app)/(shell)/campanas/page.tsx:216` | {visibles} de {total} | {visibles} of {total} |
| `campanas.lista.sin-resultados.titulo` | `app/(app)/(shell)/campanas/page.tsx:238` | Ninguna campaña coincide con la búsqueda | No campaign matches the search |
| `campanas.lista.sin-resultados.texto` | `app/(app)/(shell)/campanas/page.tsx:246` | No hay resultados para «{q}». | No results for “{q}”. |
| `campanas.lista.sin-resultados.texto-estado` | `app/(app)/(shell)/campanas/page.tsx:242` | No hay resultados para «{q}» en estado {estado}. | No results for “{q}” with status {estado}. |
| `campanas.lista.sin-resultados.estado` | `app/(app)/(shell)/campanas/page.tsx:247` | No hay campañas en estado {estado}. | There are no campaigns with status {estado}. |
| `campanas.lista.limpiar` | `app/(app)/(shell)/campanas/page.tsx:259` | Limpiar filtros | Clear filters |
| `campanas.lista.vacia.titulo` | `app/(app)/(shell)/campanas/page.tsx:266` | Todavía no hay campañas | No campaigns yet |
| `campanas.lista.vacia.texto` | `app/(app)/(shell)/campanas/page.tsx:267` | Las campañas se generan al aprobar una propuesta. Crea una propuesta y apruébala para verla aquí. | Campaigns are generated when a proposal is approved. Create a proposal and approve it to see it here. |
| `campanas.lista.vacia.ir` | `app/(app)/(shell)/campanas/page.tsx:270` | Ir a Propuestas | Go to Proposals |
| `campanas.lista.ocultas.titulo` | `app/(app)/(shell)/campanas/page.tsx:281` | Ocultaste todas las campañas de esta vista | You hid every campaign in this view |
| `campanas.lista.ocultas.texto` | `app/(app)/(shell)/campanas/page.tsx:282` | Ocultar solo las quita de tu lista en este navegador: siguen activas para todos. | Hiding only removes them from your list in this browser: they stay active for everyone. |
| `campanas.lista.hilo` | `app/(app)/(shell)/campanas/page.tsx:306` | hilo conductor | demo storyline |
| `campanas.lista.vencida.title` | `app/(app)/(shell)/campanas/page.tsx:348` | El periodo contratado ya terminó. | The booked period has already ended. |
| `campanas.lista.antes.title` | `app/(app)/(shell)/campanas/page.tsx:349` | Se marcó como completada antes de que terminara su periodo. | It was marked as completed before its period ended. |
| `campanas.lista.vencida` | `app/(app)/(shell)/campanas/page.tsx:352` | · periodo terminado | · period ended |
| `campanas.lista.antes` | `app/(app)/(shell)/campanas/page.tsx:352` | · cerrada antes de tiempo | · closed early |
| `campanas.lista.mostrar-pipeline` | `app/(app)/(shell)/campanas/page.tsx:369`<br>`app/(app)/(shell)/campanas/page.tsx:370` | Mostrar el pipeline | Show the pipeline |
| `campanas.lista.minimizar.title` | `app/(app)/(shell)/campanas/page.tsx:370` | Minimizar esta campaña | Minimize this campaign |
| `campanas.lista.ocultar` | `app/(app)/(shell)/campanas/page.tsx:379` | Ocultar de mi lista | Hide from my list |
| `campanas.lista.ocultar.title` | `app/(app)/(shell)/campanas/page.tsx:380` | Ocultar de mi lista (solo en este navegador; la campaña sigue igual para todos) | Hide from my list (only in this browser; the campaign stays the same for everyone) |
| `campanas.lista.ver-pipeline` | `app/(app)/(shell)/campanas/page.tsx:438` | Ver pipeline | View pipeline |
| `campanas.kpi.activas` | `components/demo/campanas/IndicadoresCampanas.tsx:53` | Activas | Active |
| `campanas.kpi.activas.sub.uno` | `components/demo/campanas/IndicadoresCampanas.tsx:55` | {n} confirmada por arrancar | {n} confirmed, yet to start |
| `campanas.kpi.activas.sub.otros` | `components/demo/campanas/IndicadoresCampanas.tsx:55` | {n} confirmadas por arrancar | {n} confirmed, yet to start |
| `campanas.kpi.por-validar` | `components/demo/campanas/IndicadoresCampanas.tsx:61` | Por validar publicación | Awaiting publication review |
| `campanas.kpi.por-validar.sub` | `components/demo/campanas/IndicadoresCampanas.tsx:63` | enviadas al dominio | submitted for publishing |
| `campanas.kpi.listas` | `components/demo/campanas/IndicadoresCampanas.tsx:67` | Listas para facturar | Ready to invoice |
| `campanas.kpi.listas.sub` | `components/demo/campanas/IndicadoresCampanas.tsx:69` | candado abierto | billing lock open |
| `campanas.kpi.contratado` | `components/demo/campanas/IndicadoresCampanas.tsx:75` | Contratado vigente | Active booked value |
| `campanas.kpi.contratado.sin-activas` | `components/demo/campanas/IndicadoresCampanas.tsx:79` | sin campañas activas | no active campaigns |
| `campanas.kpi.contratado.sin-presupuesto.uno` | `components/demo/campanas/IndicadoresCampanas.tsx:83` | {n} activa sin presupuesto capturado | {n} active campaign with no budget entered |
| `campanas.kpi.contratado.sin-presupuesto.otros` | `components/demo/campanas/IndicadoresCampanas.tsx:84` | {n} activas sin presupuesto capturado | {n} active campaigns with no budget entered |
| `campanas.kpi.contratado.sub` | `components/demo/campanas/IndicadoresCampanas.tsx:87` | de las campañas activas | from active campaigns |
| `campanas.ficha.no-encontrada` | `app/(app)/(shell)/campanas/[id]/page.tsx:83` | Campaña no encontrada. | Campaign not found. |
| `campanas.ficha.volver` | `app/(app)/(shell)/campanas/[id]/page.tsx:85` | Volver a campañas | Back to campaigns |
| `campanas.ficha.portal` | `app/(app)/(shell)/campanas/[id]/page.tsx:157` | Portal del cliente | Client portal |
| `campanas.ficha.ia.uno` | `app/(app)/(shell)/campanas/[id]/page.tsx:170` | Esta campaña incluye {n} pantalla con IA · medición de audiencia (AdMobilize) | This campaign includes {n} AI screen · audience measurement (AdMobilize) |
| `campanas.ficha.ia.otros` | `app/(app)/(shell)/campanas/[id]/page.tsx:170` | Esta campaña incluye {n} pantallas con IA · medición de audiencia (AdMobilize) | This campaign includes {n} AI screens · audience measurement (AdMobilize) |
| `campanas.ficha.creativos` | `app/(app)/(shell)/campanas/[id]/page.tsx:193` | Creativos | Creatives |
| `campanas.ficha.creativos.sin` | `app/(app)/(shell)/campanas/[id]/page.tsx:196` | Sin creativos | No creatives |
| `campanas.ficha.creativos.todos` | `app/(app)/(shell)/campanas/[id]/page.tsx:198` | Todos aprobados | All approved |
| `campanas.ficha.creativos.por-aprobar` | `app/(app)/(shell)/campanas/[id]/page.tsx:199` | Por aprobar | Pending approval |
| `campanas.ficha.creativos.gestionar` | `app/(app)/(shell)/campanas/[id]/page.tsx:206` | Gestionar | Manage |
| `campanas.ficha.creativos.vacio` | `app/(app)/(shell)/campanas/[id]/page.tsx:222` | Aún no hay creativos. Súbelos aquí mismo. | No creatives yet. Upload them right here. |
| `campanas.ficha.pipeline` | `app/(app)/(shell)/campanas/[id]/page.tsx:241` | Pipeline | Pipeline |
| `campanas.ficha.extensiones` | `app/(app)/(shell)/campanas/[id]/page.tsx:255` | Extensiones | Extensions |
| `campanas.ficha.candado` | `app/(app)/(shell)/campanas/[id]/page.tsx:264` | Candado de facturación | Billing lock |
| `campanas.ficha.comercial` | `app/(app)/(shell)/campanas/[id]/page.tsx:269` | Comercial | Commercial |
| `campanas.ficha.subtotal-neto` | `app/(app)/(shell)/campanas/[id]/page.tsx:271` | Subtotal (neto) | Subtotal (net) |
| `campanas.ficha.iva-pct` | `app/(app)/(shell)/campanas/[id]/page.tsx:273` | IVA ({pct}%) | VAT ({pct}%) |
| `campanas.ficha.agencia` | `app/(app)/(shell)/campanas/[id]/page.tsx:280` | Agencia | Agency |
| `campanas.ficha.directo` | `app/(app)/(shell)/campanas/[id]/page.tsx:280` | Directo | Direct |
| `campanas.ficha.oc-recibida` | `app/(app)/(shell)/campanas/[id]/page.tsx:281` | OC recibida | PO received |
| `campanas.ficha.si` | `app/(app)/(shell)/campanas/[id]/page.tsx:281` | Sí | Yes |
| `campanas.ficha.no` | `app/(app)/(shell)/campanas/[id]/page.tsx:281` | No | No |
| `campanas.ficha.facturacion` | `app/(app)/(shell)/campanas/[id]/page.tsx:286`<br>`components/demo/campanas/DatosFacturacion.tsx:132` | Datos de facturación | Billing details |
| `campanas.ficha.rentabilidad` | `app/(app)/(shell)/campanas/[id]/page.tsx:294` | Rentabilidad | Profitability |
| `campanas.ficha.margen-pct` | `app/(app)/(shell)/campanas/[id]/page.tsx:302` | Margen {pct}% | Margin {pct}% |
| `campanas.ficha.total-contratado` | `app/(app)/(shell)/campanas/[id]/page.tsx:310` | Total contratado (cliente) | Total booked (client) |
| `campanas.ficha.snapshot` | `app/(app)/(shell)/campanas/[id]/page.tsx:315` | snapshot | snapshot |
| `campanas.ficha.snapshot.title` | `app/(app)/(shell)/campanas/[id]/page.tsx:313` | Snapshot económico congelado en la aceptación — igual al total de la propuesta y de la factura (IVA incluido) | Financial snapshot frozen at acceptance — equal to the proposal and invoice total (VAT included) |
| `campanas.ficha.ingreso` | `app/(app)/(shell)/campanas/[id]/page.tsx:321` | Ingreso del medio (neto) | Media owner revenue (net) |
| `campanas.ficha.costo-espacios` | `app/(app)/(shell)/campanas/[id]/page.tsx:324` | − Costo de espacios | − Space cost |
| `campanas.ficha.estimado` | `app/(app)/(shell)/campanas/[id]/page.tsx:330` | estimado | estimated |
| `campanas.ficha.estimado.title` | `app/(app)/(shell)/campanas/[id]/page.tsx:328` | Costo de compra interno estimado — no está ligado a un contrato de arrendador vigente | Estimated internal purchase cost — not tied to an active landlord contract |
| `campanas.ficha.costo-impresion` | `app/(app)/(shell)/campanas/[id]/page.tsx:336` | − Costo de impresión | − Printing cost |
| `campanas.ficha.costo-operacion` | `app/(app)/(shell)/campanas/[id]/page.tsx:337` | − Costo de operación | − Operating cost |
| `campanas.ficha.cumplimiento` | `app/(app)/(shell)/campanas/[id]/page.tsx:349` | Reporte de cumplimiento | Delivery report |
| `campanas.ficha.entregado-pct` | `app/(app)/(shell)/campanas/[id]/page.tsx:356` | {pct}% entregado | {pct}% delivered |
| `campanas.ficha.sitios-contratados` | `app/(app)/(shell)/campanas/[id]/page.tsx:361` | Sitios contratados | Sites booked |
| `campanas.ficha.sitios-entregados` | `app/(app)/(shell)/campanas/[id]/page.tsx:362` | Sitios entregados | Sites delivered |
| `campanas.ficha.testigos` | `app/(app)/(shell)/campanas/[id]/page.tsx:363` | Testigos (fotos) | Proof photos |
| `campanas.ficha.dias-contratados` | `app/(app)/(shell)/campanas/[id]/page.tsx:364` | Días contratados | Days booked |
| `campanas.ficha.orden-compra` | `app/(app)/(shell)/campanas/[id]/page.tsx:371` | Orden de compra | Purchase order |
| `campanas.ficha.folio-odc` | `app/(app)/(shell)/campanas/[id]/page.tsx:373` | Folio ODC | Internal PO ref. |
| `campanas.ficha.numero-oc` | `app/(app)/(shell)/campanas/[id]/page.tsx:374` | Número de OC (cliente) | PO number (client) |
| `campanas.ficha.documento` | `app/(app)/(shell)/campanas/[id]/page.tsx:377` | Documento | Document |
| `campanas.ficha.sitios` | `app/(app)/(shell)/campanas/[id]/page.tsx:383` | Sitios de la campaña | Campaign sites |
| `campanas.ficha.sitios.vacio` | `app/(app)/(shell)/campanas/[id]/page.tsx:385` | Sin sitios asignados. | No sites assigned. |
| `campanas.ficha.imprenta` | `app/(app)/(shell)/campanas/[id]/page.tsx:429` | Imprenta | Printing |
| `campanas.ficha.ots` | `app/(app)/(shell)/campanas/[id]/page.tsx:439` | Órdenes de trabajo | Work orders |
| `campanas.ficha.evidencias` | `app/(app)/(shell)/campanas/[id]/page.tsx:449` | Evidencias fotográficas | Photo evidence |
| `campanas.ficha.reproducciones` | `app/(app)/(shell)/campanas/[id]/page.tsx:461` | Reproducciones (proof of play) | Plays (proof of play) |
| `campanas.ficha.seccion.completo` | `app/(app)/(shell)/campanas/[id]/page.tsx:526` | Completo | Complete |
| `campanas.ficha.seccion.no-aplica` | `app/(app)/(shell)/campanas/[id]/page.tsx:528` | No aplica | N/A |
| `campanas.ficha.seccion.expandir` | `app/(app)/(shell)/campanas/[id]/page.tsx:549` | Expandir | Expand |
| `campanas.resumen.entregado` | `components/demo/campanas/ResumenCampana.tsx:65` | Entregado | Delivered |
| `campanas.resumen.candado` | `components/demo/campanas/ResumenCampana.tsx:70` | Candado | Lock |
| `campanas.resumen.ot` | `components/demo/campanas/ResumenCampana.tsx:76` | OT | Work orders |
| `campanas.resumen.ot.uno` | `components/demo/campanas/ResumenCampana.tsx:80` | {n} abierta de {total} | {n} of {total} open |
| `campanas.resumen.ot.otros` | `components/demo/campanas/ResumenCampana.tsx:80` | {n} abiertas de {total} | {n} of {total} open |
| `campanas.resumen.evidencias` | `components/demo/campanas/ResumenCampana.tsx:86` | Evidencias | Evidence |
| `campanas.menu.mostrar` | `components/demo/campanas/CampanasNav.tsx:68` | Mostrar el menú de campañas | Show the campaign menu |
| `campanas.menu.ocultar` | `components/demo/campanas/CampanasNav.tsx:68` | Ocultar el menú de campañas | Hide the campaign menu |
| `campanas.menu.titulo` | `components/demo/campanas/CampanasNav.tsx:86` | Campañas ({n}) | Campaigns ({n}) |
| `campanas.menu.boton.mostrar` | `components/demo/campanas/CampanasNav.tsx:99` | Mostrar | Show |
| `campanas.menu.boton.ocultar` | `components/demo/campanas/CampanasNav.tsx:99` | Ocultar | Hide |
| `campanas.menu.otras` | `components/demo/campanas/CampanasNav.tsx:116` | Otras campañas | Other campaigns |
| `campanas.creativo.imagen-supera` | `components/demo/campanas/AgregarCreativo.tsx:48` | La imagen supera {mb} MB | The image exceeds {mb} MB |
| `campanas.creativo.nombre-codigo` | `components/demo/campanas/AgregarCreativo.tsx:63` | Creativo (código) | Creative (code) |
| `campanas.creativo.agregado` | `components/demo/campanas/AgregarCreativo.tsx:76` | Creativo agregado | Creative added |
| `campanas.creativo.no-subir` | `components/demo/campanas/AgregarCreativo.tsx:83` | No se pudo subir | Could not upload |
| `campanas.creativo.imagen` | `components/demo/campanas/AgregarCreativo.tsx:93` | Imagen | Image |
| `campanas.creativo.codigo` | `components/demo/campanas/AgregarCreativo.tsx:96`<br>`components/demo/campanas/AgregarCreativo.tsx:109` | Código | Code |
| `campanas.creativo.nombre` | `components/demo/campanas/AgregarCreativo.tsx:102` | Nombre del creativo | Creative name |
| `campanas.creativo.pega` | `components/demo/campanas/AgregarCreativo.tsx:113` | Pega aquí el código del creativo (HTML/UTF)… | Paste the creative’s code here (HTML/UTF)… |
| `campanas.creativo.vista-previa` | `components/demo/campanas/AgregarCreativo.tsx:130` | Vista previa | Preview |
| `campanas.creativo.vista-previa.titulo` | `components/demo/campanas/AgregarCreativo.tsx:140`<br>`components/demo/campanas/AgregarCreativo.tsx:156` | Vista previa del creativo | Creative preview |
| `campanas.creativo.subir` | `components/demo/campanas/AgregarCreativo.tsx:146` | Subir creativo | Upload creative |
| `campanas.creativo.asi-se-vera` | `components/demo/campanas/AgregarCreativo.tsx:152` | Así se verá el creativo en la pantalla: | This is how the creative will look on the screen: |
| `campanas.candado.no-registrar` | `components/demo/campanas/CandadoPanel.tsx:71` | No se pudo registrar la OC | Could not record the PO |
| `campanas.candado.cerrado` | `components/demo/campanas/CandadoPanel.tsx:93` | Cerrado: faltan condiciones por cumplir | Closed: conditions still pending |
| `campanas.candado.oc` | `components/demo/campanas/CandadoPanel.tsx:102` | Orden de compra recibida | Purchase order received |
| `campanas.candado.fotos` | `components/demo/campanas/CandadoPanel.tsx:103` | Fotografías comprobatorias | Proof photos |
| `campanas.candado.reporte` | `components/demo/campanas/CandadoPanel.tsx:104` | Reporte de publicación | Publication report |
| `campanas.candado.registrar.titulo` | `components/demo/campanas/CandadoPanel.tsx:108` | Registrar OC del cliente | Record the client’s PO |
| `campanas.candado.numero` | `components/demo/campanas/CandadoPanel.tsx:109` | Número de OC del cliente | Client PO number |
| `campanas.candado.registrando` | `components/demo/campanas/CandadoPanel.tsx:131` | Registrando… | Recording… |
| `campanas.candado.registrar` | `components/demo/campanas/CandadoPanel.tsx:131` | Registrar OC | Record PO |
| `campanas.candado.monto-ilegible` | `components/demo/campanas/CandadoPanel.tsx:135` | El monto no se entiende: la coma separa miles y el punto, decimales ({ejemplo}). | The amount can’t be read: commas separate thousands and the period separates decimals ({ejemplo}). |
| `campanas.candado.precargados` | `components/demo/campanas/CandadoPanel.tsx:139` | Número, monto y fecha vienen precargados de la campaña; ajústalos si el cliente dio otros. El documento de la OC es el contrato (se adjunta en “Datos de facturación”). | Number, amount and date are prefilled from the campaign; adjust them if the client gave different ones. The PO document is the contract (attached under “Billing details”). |
| `campanas.candado.se-abre` | `components/demo/campanas/CandadoPanel.tsx:147` | El candado se abre cuando se cumplen estas condiciones. | The lock opens when these conditions are met. |
| `campanas.doohmain-ahora.no-leer` | `components/demo/campanas/CreativosEnDoohmain.tsx:63` | No se pudo leer el estado en DOOHmain | Could not read the status in DOOHmain |
| `campanas.doohmain-ahora.pausado` | `components/demo/campanas/CreativosEnDoohmain.tsx:78` | “{nombre}” quedó en pausa en DOOHmain | “{nombre}” is now paused in DOOHmain |
| `campanas.doohmain-ahora.reanudado` | `components/demo/campanas/CreativosEnDoohmain.tsx:79` | “{nombre}” volvió al aire en DOOHmain | “{nombre}” is back on air in DOOHmain |
| `campanas.doohmain-ahora.no-cambiar` | `components/demo/campanas/CreativosEnDoohmain.tsx:84` | No se pudo cambiar en DOOHmain | Could not change it in DOOHmain |
| `campanas.doohmain-ahora.titulo` | `components/demo/campanas/CreativosEnDoohmain.tsx:95` | En DOOHmain ahora | In DOOHmain now |
| `campanas.doohmain-ahora.preguntar` | `components/demo/campanas/CreativosEnDoohmain.tsx:96` | Volver a preguntar a DOOHmain | Ask DOOHmain again |
| `campanas.doohmain-ahora.sin-pantallas` | `components/demo/campanas/CreativosEnDoohmain.tsx:111` | sin pantallas registradas | no screens recorded |
| `campanas.doohmain-ahora.sin-confirmar` | `components/demo/campanas/CreativosEnDoohmain.tsx:115` | Sin confirmar | Unconfirmed |
| `campanas.doohmain-ahora.pausar` | `components/demo/campanas/CreativosEnDoohmain.tsx:121` | Pausar | Pause |
| `campanas.doohmain-ahora.reanudar` | `components/demo/campanas/CreativosEnDoohmain.tsx:126` | Reanudar | Resume |
| `campanas.doohmain-ahora.pausar.titulo` | `components/demo/campanas/CreativosEnDoohmain.tsx:138` | Pausar en DOOHmain | Pause in DOOHmain |
| `campanas.doohmain-ahora.reanudar.titulo` | `components/demo/campanas/CreativosEnDoohmain.tsx:138` | Reanudar en DOOHmain | Resume in DOOHmain |
| `campanas.doohmain-ahora.pausar.si` | `components/demo/campanas/CreativosEnDoohmain.tsx:139` | Sí, pausar | Yes, pause |
| `campanas.doohmain-ahora.reanudar.si` | `components/demo/campanas/CreativosEnDoohmain.tsx:139` | Sí, reanudar | Yes, resume |
| `campanas.doohmain-ahora.pausar.texto.uno` | `components/demo/campanas/CreativosEnDoohmain.tsx:149` | {nombre} deja de reproducirse en {n} pantalla(s) de DOOHmain. El arte se queda en su lista y se puede reanudar cuando quieras. | {nombre} stops playing on {n} DOOHmain screen. The artwork stays in its list and can be resumed whenever you want. |
| `campanas.doohmain-ahora.pausar.texto.otros` | `components/demo/campanas/CreativosEnDoohmain.tsx:150` | {nombre} deja de reproducirse en {n} pantalla(s) de DOOHmain. El arte se queda en su lista y se puede reanudar cuando quieras. | {nombre} stops playing on {n} DOOHmain screens. The artwork stays in its list and can be resumed whenever you want. |
| `campanas.doohmain-ahora.reanudar.texto` | `components/demo/campanas/CreativosEnDoohmain.tsx:157` | {nombre} vuelve a reproducirse en DOOHmain con la programación que ya tenía. | {nombre} starts playing again in DOOHmain with the schedule it already had. |
| `campanas.facturacion.uso.g01` | `components/demo/campanas/DatosFacturacion.tsx:25` | G01 · Adquisición de mercancías | G01 · Purchase of goods |
| `campanas.facturacion.uso.g03` | `components/demo/campanas/DatosFacturacion.tsx:26` | G03 · Gastos en general | G03 · General expenses |
| `campanas.facturacion.uso.p01` | `components/demo/campanas/DatosFacturacion.tsx:27` | P01 · Por definir | P01 · To be defined |
| `campanas.facturacion.adjuntado` | `components/demo/campanas/DatosFacturacion.tsx:56` | Contrato adjuntado | Contract attached |
| `campanas.facturacion.no-adjuntar` | `components/demo/campanas/DatosFacturacion.tsx:58` | No se pudo adjuntar | Could not attach |
| `campanas.facturacion.sin-cliente` | `components/demo/campanas/DatosFacturacion.tsx:68` | Esta campaña no tiene cliente asignado. | This campaign has no client assigned. |
| `campanas.facturacion.cliente` | `components/demo/campanas/DatosFacturacion.tsx:71` | Cliente | Client |
| `campanas.facturacion.razon-social` | `components/demo/campanas/DatosFacturacion.tsx:72` | Razón social | Legal name |
| `campanas.facturacion.rfc` | `components/demo/campanas/DatosFacturacion.tsx:73` | RFC | RFC (tax ID) |
| `campanas.facturacion.regimen` | `components/demo/campanas/DatosFacturacion.tsx:74` | Régimen fiscal | Tax regime |
| `campanas.facturacion.cp` | `components/demo/campanas/DatosFacturacion.tsx:75` | CP fiscal | Tax ZIP code |
| `campanas.facturacion.uso` | `components/demo/campanas/DatosFacturacion.tsx:77` | Uso CFDI | CFDI use |
| `campanas.facturacion.iva` | `components/demo/campanas/DatosFacturacion.tsx:80` | IVA | VAT |
| `campanas.facturacion.completa` | `components/demo/campanas/DatosFacturacion.tsx:86` | Completa RFC y razón social en {clientes} para poder facturar esta campaña. | Complete the RFC and legal name in {clientes} to be able to invoice this campaign. |
| `campanas.facturacion.clientes` | `components/demo/campanas/DatosFacturacion.tsx:86` | Clientes | Clients |
| `campanas.facturacion.contrato` | `components/demo/campanas/DatosFacturacion.tsx:94` | Contrato del cliente | Client contract |
| `campanas.facturacion.sin-contrato` | `components/demo/campanas/DatosFacturacion.tsx:106` | Sin contrato adjunto | No contract attached |
| `campanas.facturacion.reemplazar` | `components/demo/campanas/DatosFacturacion.tsx:117` | Reemplazar contrato | Replace contract |
| `campanas.facturacion.subir` | `components/demo/campanas/DatosFacturacion.tsx:118` | Subir contrato (PDF) | Upload contract (PDF) |
| `campanas.facturacion.listo` | `components/demo/campanas/DatosFacturacion.tsx:141` | Cliente listo para facturar | Client ready to invoice |
| `campanas.facturacion.faltan` | `components/demo/campanas/DatosFacturacion.tsx:141` | Faltan datos fiscales | Tax details missing |
| `campanas.facturacion.falta` | `components/demo/campanas/DatosFacturacion.tsx:170` | — falta — | — missing — |
| `campanas.evidencia.vacia` | `components/demo/campanas/EvidenciaGaleria.tsx:22` | Aún sin fotografías | No photos yet |
| `campanas.evidencia.vacia.texto` | `components/demo/campanas/EvidenciaGaleria.tsx:23` | Las evidencias se suben al cerrar la OT móvil. | Evidence is uploaded when the mobile work order is closed. |
| `campanas.evidencia.alt` | `components/demo/campanas/EvidenciaGaleria.tsx:37` | evidencia | evidence |
| `campanas.evidencia.foto` | `components/demo/campanas/EvidenciaGaleria.tsx:43` | foto | photo |
| `campanas.evidencia.tomada` | `components/demo/campanas/EvidenciaGaleria.tsx:48` | Fecha de creación de la imagen | Image creation date |
| `campanas.evidencia.subida` | `components/demo/campanas/EvidenciaGaleria.tsx:52` | Fecha de subida | Upload date |
| `campanas.extender.pdf` | `components/demo/campanas/ExtenderCampanaDialog.tsx:69` | El contrato tiene que ser un PDF | The contract must be a PDF |
| `campanas.extender.no-extender` | `components/demo/campanas/ExtenderCampanaDialog.tsx:92` | No se pudo extender | Could not extend |
| `campanas.extender.titulo` | `components/demo/campanas/ExtenderCampanaDialog.tsx:101`<br>`components/demo/campanas/ExtensionesCampana.tsx:61` | Extender campaña | Extend campaign |
| `campanas.extender.extendiendo` | `components/demo/campanas/ExtenderCampanaDialog.tsx:109` | Extendiendo… | Extending… |
| `campanas.extender.extender` | `components/demo/campanas/ExtenderCampanaDialog.tsx:109` | Extender | Extend |
| `campanas.extender.fin` | `components/demo/campanas/ExtenderCampanaDialog.tsx:115` | Nueva fecha de fin | New end date |
| `campanas.extender.contrato` | `components/demo/campanas/ExtenderCampanaDialog.tsx:125` | Contrato firmado de la extensión (PDF) | Signed extension contract (PDF) |
| `campanas.extender.quitar` | `components/demo/campanas/ExtenderCampanaDialog.tsx:135` | Quitar contrato | Remove contract |
| `campanas.extender.adjuntar` | `components/demo/campanas/ExtenderCampanaDialog.tsx:144` | Adjuntar contrato (PDF) | Attach contract (PDF) |
| `campanas.extender.nota` | `components/demo/campanas/ExtenderCampanaDialog.tsx:150` | Sin el contrato firmado de la extensión no se puede extender. Queda en el expediente de la campaña junto con el folio del tramo nuevo; el contrato original del cliente no se toca. | Without the signed extension contract the campaign can’t be extended. It is kept in the campaign file together with the Internal ref. of the new segment; the client’s original contract is not touched. |
| `campanas.extensiones.termina` | `components/demo/campanas/ExtensionesCampana.tsx:53` | Termina el {fecha}. Para alargarla hace falta el contrato firmado de la extensión. | Ends on {fecha}. To extend it you need the signed extension contract. |
| `campanas.extensiones.vacio` | `components/demo/campanas/ExtensionesCampana.tsx:69` | Sin extensiones con contrato. | No extensions with a contract. |
| `campanas.extensiones.hecha` | `components/demo/campanas/ExtensionesCampana.tsx:103` | {nombre} extendida | {nombre} extended |
| `campanas.horario.no-leer` | `components/demo/campanas/FranjaProgramadaCampana.tsx:54` | No se pudo leer el horario de transmisión | Could not read the broadcast schedule |
| `campanas.horario.no-programar` | `components/demo/campanas/FranjaProgramadaCampana.tsx:71` | No se pudo programar | Could not schedule |
| `campanas.horario.otra-franja` | `components/demo/campanas/FranjaProgramadaCampana.tsx:88` | otra franja | another daypart |
| `campanas.horario.todo-el-dia` | `components/demo/campanas/FranjaProgramadaCampana.tsx:89` | Todo el día | All day |
| `campanas.horario.titulo` | `components/demo/campanas/FranjaProgramadaCampana.tsx:96` | Horario de transmisión | Broadcast schedule |
| `campanas.horario.vendida` | `components/demo/campanas/FranjaProgramadaCampana.tsx:106` | Vendida (no cambia aquí) | Sold (doesn’t change here) |
| `campanas.horario.se-transmite` | `components/demo/campanas/FranjaProgramadaCampana.tsx:114` | Se transmite en | Airs during |
| `campanas.horario.dada-de-baja` | `components/demo/campanas/FranjaProgramadaCampana.tsx:117` | ␣(dada de baja) | ␣(deactivated) |
| `campanas.horario.sin-franja` | `components/demo/campanas/FranjaProgramadaCampana.tsx:118`<br>`components/demo/campanas/FranjaProgramadaCampana.tsx:135` | Sin franja programada | No daypart scheduled |
| `campanas.horario.sin-permiso` | `components/demo/campanas/FranjaProgramadaCampana.tsx:125` | Solo el gerente de ventas, el director comercial y la dirección pueden cambiar el horario de transmisión. | Only the sales manager, the sales director and management can change the broadcast schedule. |
| `campanas.horario.franja` | `components/demo/campanas/FranjaProgramadaCampana.tsx:130` | Franja de transmisión | Broadcast daypart |
| `campanas.listas.sin-impresion` | `components/demo/campanas/ListasCampana.tsx:43` | Sin órdenes de impresión. | No print orders. |
| `campanas.listas.sin-ot` | `components/demo/campanas/ListasCampana.tsx:65` | Sin órdenes de trabajo. | No work orders. |
| `campanas.listas.compromiso` | `components/demo/campanas/ListasCampana.tsx:87` | Fecha compromiso | Due date |
| `campanas.listas.vencida` | `components/demo/campanas/ListasCampana.tsx:94` | Vencida | Overdue |
| `campanas.playlogs.no-consultar` | `components/demo/campanas/PlaylogsPanel.tsx:81` | No se pudo consultar | Could not run the query |
| `campanas.playlogs.intro` | `components/demo/campanas/PlaylogsPanel.tsx:92` | Cuántas veces se reprodujo el creativo en las pantallas digitales, según lo que reporta DOOHmain. Es la prueba que respalda lo que se le cobra al anunciante, así que se muestra exactamente lo que responde el proveedor. | How many times the creative played on the digital screens, as reported by DOOHmain. It is the proof behind what the advertiser is charged, so it shows exactly what the provider returns. |
| `campanas.playlogs.no-publicada` | `components/demo/campanas/PlaylogsPanel.tsx:97` | Esta campaña no está publicada en DOOHmain, así que no hay reproducciones que consultar. Las pantallas fijas se comprueban con las evidencias fotográficas. | This campaign is not published in DOOHmain, so there are no plays to query. Static screens are verified with photo evidence. |
| `campanas.playlogs.tab.campana` | `components/demo/campanas/PlaylogsPanel.tsx:105` | De esta campaña | This campaign |
| `campanas.playlogs.tab.pantallas` | `components/demo/campanas/PlaylogsPanel.tsx:106` | Historial de sus pantallas | Screen history |
| `campanas.playlogs.pantallas.texto` | `components/demo/campanas/PlaylogsPanel.tsx:122` | Todo lo que DOOHmain registró en las pantallas donde se publicó esta campaña, día por día. Incluye otras campañas de esas pantallas: sirve para ver que estuvieron reproduciendo, pero {noCuenta} ni abre el candado de facturación. | Everything DOOHmain recorded on the screens where this campaign was published, day by day. It includes other campaigns on those screens: it shows that they were playing, but {noCuenta} and does not open the billing lock. |
| `campanas.playlogs.pantallas.no-cuenta` | `components/demo/campanas/PlaylogsPanel.tsx:123` | no cuenta como prueba de esta campaña | does not count as proof for this campaign |
| `campanas.playlogs.desde` | `components/demo/campanas/PlaylogsPanel.tsx:130` | Desde | From |
| `campanas.playlogs.hasta` | `components/demo/campanas/PlaylogsPanel.tsx:134` | Hasta | To |
| `campanas.playlogs.consultar` | `components/demo/campanas/PlaylogsPanel.tsx:139` | Consultar a DOOHmain | Ask DOOHmain |
| `campanas.playlogs.sin-consulta` | `components/demo/campanas/PlaylogsPanel.tsx:147` | Aún no se ha consultado. Elige un rango y pregunta. | Not queried yet. Choose a range and ask. |
| `campanas.playlogs.rango` | `components/demo/campanas/PlaylogsPanel.tsx:153`<br>`components/demo/campanas/PlaylogsPanel.tsx:193` | {desde} a {hasta} | {desde} to {hasta} |
| `campanas.playlogs.fuente` | `components/demo/campanas/PlaylogsPanel.tsx:156` | Fuente: DOOHmain · consultado {fecha} | Source: DOOHmain · queried {fecha} |
| `campanas.playlogs.vacio` | `components/demo/campanas/PlaylogsPanel.tsx:166` | DOOHmain no reporta reproducciones en ese rango. | DOOHmain reports no plays in that range. |
| `campanas.playlogs.vacio.nota` | `components/demo/campanas/PlaylogsPanel.tsx:168` | Es lo esperado mientras la campaña no haya salido al aire. Un cero aquí es lo que dice el proveedor, no una estimación nuestra. | That is expected while the campaign has not gone on air. A zero here is what the provider says, not our estimate. |
| `campanas.playlogs.con-datos.texto` | `components/demo/campanas/PlaylogsPanel.tsx:174` | DOOHmain devolvió datos. Se muestran sin interpretar: todavía no hemos visto una respuesta con contenido, así que no se convierten en totales para no arriesgar números equivocados en la prueba de cobro. | DOOHmain returned data. It is shown uninterpreted: we have not yet seen a response with content, so it is not turned into totals to avoid wrong numbers in the billing proof. |
| `campanas.playlogs.anteriores` | `components/demo/campanas/PlaylogsPanel.tsx:188` | Consultas anteriores ({n}) | Previous queries ({n}) |
| `campanas.playlogs.estado.error` | `components/demo/campanas/PlaylogsPanel.tsx:196` | error | failed |
| `campanas.playlogs.estado.vacio` | `components/demo/campanas/PlaylogsPanel.tsx:198` | sin reproducciones | no plays |
| `campanas.playlogs.estado.datos` | `components/demo/campanas/PlaylogsPanel.tsx:199` | con datos | with data |
| `campanas.doohmain.destino.otro-cms` | `components/demo/campanas/ProgramacionDoohmain.tsx:36` | No va a DOOHmain: la opera otro CMS | Not sent to DOOHmain: another CMS runs it |
| `campanas.doohmain.destino.sin-pantalla` | `components/demo/campanas/ProgramacionDoohmain.tsx:37` | Sin pantalla de DOOHmain asignada | No DOOHmain screen assigned |
| `campanas.doohmain.dia.1` | `components/demo/campanas/ProgramacionDoohmain.tsx:43` | Lun | Mon |
| `campanas.doohmain.dia.2` | `components/demo/campanas/ProgramacionDoohmain.tsx:43` | Mar | Tue |
| `campanas.doohmain.dia.3` | `components/demo/campanas/ProgramacionDoohmain.tsx:43` | Mié | Wed |
| `campanas.doohmain.dia.4` | `components/demo/campanas/ProgramacionDoohmain.tsx:44` | Jue | Thu |
| `campanas.doohmain.dia.5` | `components/demo/campanas/ProgramacionDoohmain.tsx:44` | Vie | Fri |
| `campanas.doohmain.dia.6` | `components/demo/campanas/ProgramacionDoohmain.tsx:44` | Sáb | Sat |
| `campanas.doohmain.dia.0` | `components/demo/campanas/ProgramacionDoohmain.tsx:45` | Dom | Sun |
| `campanas.doohmain.no-guardar` | `components/demo/campanas/ProgramacionDoohmain.tsx:95` | No se pudo guardar | Could not save |
| `campanas.doohmain.no-leer` | `components/demo/campanas/ProgramacionDoohmain.tsx:212` | No se pudo leer | Could not load |
| `campanas.doohmain.franja.programada` | `components/demo/campanas/ProgramacionDoohmain.tsx:105` | Horario en DOOHmain: la franja programada | Schedule in DOOHmain: the scheduled daypart |
| `campanas.doohmain.franja.contratada` | `components/demo/campanas/ProgramacionDoohmain.tsx:106` | Horario en DOOHmain: la franja contratada | Schedule in DOOHmain: the booked daypart |
| `campanas.doohmain.franja.texto` | `components/demo/campanas/ProgramacionDoohmain.tsx:108` | {nombre}, {inicio} a {fin}. La campaña ya tiene franja, así que no lleva otro horario. | {nombre}, {inicio} to {fin}. The campaign already has a daypart, so it doesn’t take another schedule. |
| `campanas.doohmain.franja.ademas` | `components/demo/campanas/ProgramacionDoohmain.tsx:118` | Tiene además un horario propio ({inicio} a {fin}), de antes, y es el que se manda: quítalo para que viaje la franja. | It also has its own schedule ({inicio} to {fin}) from before, and that is the one being sent: remove it so the daypart is sent instead. |
| `campanas.doohmain.quitar` | `components/demo/campanas/ProgramacionDoohmain.tsx:122`<br>`components/demo/campanas/ProgramacionDoohmain.tsx:179` | Quitar | Remove |
| `campanas.doohmain.horario-campana` | `components/demo/campanas/ProgramacionDoohmain.tsx:135` | Horario de la campaña: | Campaign schedule: |
| `campanas.doohmain.horario.titulo` | `components/demo/campanas/ProgramacionDoohmain.tsx:143` | Horario de esta campaña en DOOHmain | This campaign’s schedule in DOOHmain |
| `campanas.doohmain.horario.de` | `components/demo/campanas/ProgramacionDoohmain.tsx:146` | De | From |
| `campanas.doohmain.horario.a` | `components/demo/campanas/ProgramacionDoohmain.tsx:150` | a | to |
| `campanas.doohmain.horario.inicio` | `components/demo/campanas/ProgramacionDoohmain.tsx:147` | Hora de inicio | Start time |
| `campanas.doohmain.horario.fin` | `components/demo/campanas/ProgramacionDoohmain.tsx:151` | Hora de fin | End time |
| `campanas.doohmain.horario.dias` | `components/demo/campanas/ProgramacionDoohmain.tsx:153` | Días de la semana | Days of the week |
| `campanas.doohmain.horario.nota` | `components/demo/campanas/ProgramacionDoohmain.tsx:174` | Solo para campañas sin franja horaria. Sin días marcados, sale todos los días. | Only for campaigns without a daypart. With no days selected, it runs every day. |
| `campanas.doohmain.horario.guardar` | `components/demo/campanas/ProgramacionDoohmain.tsx:187` | Guardar horario | Save schedule |
| `campanas.doohmain.titulo` | `components/demo/campanas/ProgramacionDoohmain.tsx:229` | Lo que se manda a DOOHmain | What gets sent to DOOHmain |
| `campanas.doohmain.actualizar` | `components/demo/campanas/ProgramacionDoohmain.tsx:236` | Actualizar | Refresh |
| `campanas.doohmain.apagada` | `components/demo/campanas/ProgramacionDoohmain.tsx:241` | La publicación en DOOHmain está apagada en esta instancia: esto es lo que se mandaría. | Publishing to DOOHmain is turned off in this instance: this is what would be sent. |
| `campanas.doohmain.cliente` | `components/demo/campanas/ProgramacionDoohmain.tsx:252` | Cliente: | Client: |
| `campanas.doohmain.lista` | `components/demo/campanas/ProgramacionDoohmain.tsx:254` | ␣· lista {lista} | ␣· list {lista} |
| `campanas.doohmain.sin-pantallas` | `components/demo/campanas/ProgramacionDoohmain.tsx:258` | Esta campaña no tiene pantallas digitales que mandar. | This campaign has no digital screens to send. |
| `campanas.doohmain.col.pantalla` | `components/demo/campanas/ProgramacionDoohmain.tsx:264` | Pantalla | Screen |
| `campanas.doohmain.col.creativo` | `components/demo/campanas/ProgramacionDoohmain.tsx:265` | Creativo | Creative |
| `campanas.doohmain.col.horario` | `components/demo/campanas/ProgramacionDoohmain.tsx:266` | Horario | Schedule |
| `campanas.doohmain.col.por-dia` | `components/demo/campanas/ProgramacionDoohmain.tsx:267` | Por día | Per day |
| `campanas.doohmain.col.total` | `components/demo/campanas/ProgramacionDoohmain.tsx:268` | Total campaña | Campaign total |
| `campanas.doohmain.sin-creativo` | `components/demo/campanas/ProgramacionDoohmain.tsx:294` | Sin creativo aprobado asignado: al publicar, esta pantalla no recibe nada. | No approved creative assigned: when publishing, this screen receives nothing. |
| `campanas.doohmain.pie` | `components/demo/campanas/ProgramacionDoohmain.tsx:303` | Del {inicio} al {fin}. Si la campaña tiene franja, DOOHmain reparte las del día dentro de ese horario. Un anuncio ya publicado no cambia de horario al volver a publicar. | From {inicio} to {fin}. If the campaign has a daypart, DOOHmain spreads the day’s plays within that schedule. An ad that is already published keeps its schedule when published again. |
| `campanas.validacion.aviso-pantalla` | `components/demo/campanas/ValidacionPanel.tsx:41` | Recuerda no estar en la pantalla dentro del sitio de DOOHmain para permitir el proceso: ciérrala allí antes de enviar o publicar. | Remember not to have the screen open on the DOOHmain site so the process can run: close it there before sending or publishing. |
| `campanas.validacion.no-enviar` | `components/demo/campanas/ValidacionPanel.tsx:74` | No se pudo enviar al dominio | Could not submit for publishing |
| `campanas.validacion.motivo-prompt` | `components/demo/campanas/ValidacionPanel.tsx:82` | Motivo del rechazo (qué corregir en los anuncios): | Reason for rejection (what to fix in the ads): |
| `campanas.validacion.no-validar` | `components/demo/campanas/ValidacionPanel.tsx:93` | No se pudo validar la publicación | Could not save the publication review |
| `campanas.validacion.toast.ninguna` | `components/demo/campanas/ValidacionPanel.tsx:103` | Ninguna pantalla de esta campaña va a DOOHmain | None of this campaign’s screens go to DOOHmain |
| `campanas.validacion.toast.publicada.uno` | `components/demo/campanas/ValidacionPanel.tsx:106` | Publicada en DOOHmain: {n} pantalla(s) | Published in DOOHmain: {n} screen |
| `campanas.validacion.toast.publicada.otros` | `components/demo/campanas/ValidacionPanel.tsx:106` | Publicada en DOOHmain: {n} pantalla(s) | Published in DOOHmain: {n} screens |
| `campanas.validacion.toast.parcial.uno` | `components/demo/campanas/ValidacionPanel.tsx:112` | DOOHmain: {n} pantalla(s) con error | DOOHmain: {n} screen failed |
| `campanas.validacion.toast.parcial.otros` | `components/demo/campanas/ValidacionPanel.tsx:112` | DOOHmain: {n} pantalla(s) con error | DOOHmain: {n} screens failed |
| `campanas.validacion.toast.error` | `components/demo/campanas/ValidacionPanel.tsx:116` | No se publicó en DOOHmain | Not published in DOOHmain |
| `campanas.validacion.no-republicar` | `components/demo/campanas/ValidacionPanel.tsx:124` | No se pudo volver a publicar | Could not publish again |
| `campanas.validacion.retirado.toast` | `components/demo/campanas/ValidacionPanel.tsx:139` | “{nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel | “{nombre}” was withdrawn. Its artwork is still in DOOHmain — remove it in its panel |
| `campanas.validacion.bajado.toast` | `components/demo/campanas/ValidacionPanel.tsx:140` | “{nombre}” se bajó | “{nombre}” was removed |
| `campanas.validacion.no-bajar` | `components/demo/campanas/ValidacionPanel.tsx:144` | No se pudo bajar el creativo | Could not remove the creative |
| `campanas.validacion.titulo` | `components/demo/campanas/ValidacionPanel.tsx:162` | Validación de publicación | Publication review |
| `campanas.validacion.enviada` | `components/demo/campanas/ValidacionPanel.tsx:171` | Enviada al dominio / CMS | Submitted for publishing (CMS) |
| `campanas.validacion.anuncios` | `components/demo/campanas/ValidacionPanel.tsx:175` | Anuncios cargados ({validadas}/{total} validados) | Ads loaded ({validadas}/{total} approved) |
| `campanas.validacion.informacion` | `components/demo/campanas/ValidacionPanel.tsx:184` | Información de los anuncios | Ad details |
| `campanas.validacion.retirado.title` | `components/demo/campanas/ValidacionPanel.tsx:201` | Retirado; su arte sigue en DOOHmain (quítalo en su panel) | Withdrawn; its artwork is still in DOOHmain (remove it in its panel) |
| `campanas.validacion.retirado` | `components/demo/campanas/ValidacionPanel.tsx:203` | Retirado | Withdrawn |
| `campanas.validacion.bajar.title` | `components/demo/campanas/ValidacionPanel.tsx:213` | Bajar creativo (finaliza su campaña en DOOHmain) | Remove creative (ends its campaign in DOOHmain) |
| `campanas.validacion.sello.aprobada` | `components/demo/campanas/ValidacionPanel.tsx:238` | Aprobada por {por} · {fecha} | Approved by {por} · {fecha} |
| `campanas.validacion.sello.rechazada` | `components/demo/campanas/ValidacionPanel.tsx:238` | Rechazada por {por} · {fecha} | Rejected by {por} · {fecha} |
| `campanas.validacion.motivo` | `components/demo/campanas/ValidacionPanel.tsx:243` | Motivo: {motivo} | Reason: {motivo} |
| `campanas.validacion.enviando` | `components/demo/campanas/ValidacionPanel.tsx:278` | Enviando… | Sending… |
| `campanas.validacion.corregir` | `components/demo/campanas/ValidacionPanel.tsx:280` | Corregir y reenviar al dominio | Fix and resubmit for publishing |
| `campanas.validacion.enviar` | `components/demo/campanas/ValidacionPanel.tsx:281` | Enviar al dominio | Submit for publishing |
| `campanas.validacion.aprobar` | `components/demo/campanas/ValidacionPanel.tsx:292` | Aprobar publicación | Approve publication |
| `campanas.validacion.rechazar` | `components/demo/campanas/ValidacionPanel.tsx:302` | Rechazar | Reject |
| `campanas.validacion.publicando` | `components/demo/campanas/ValidacionPanel.tsx:317` | Publicando… | Publishing… |
| `campanas.validacion.republicar` | `components/demo/campanas/ValidacionPanel.tsx:317`<br>`components/demo/campanas/ValidacionPanel.tsx:381` | Volver a publicar en DOOHmain | Publish again in DOOHmain |
| `campanas.validacion.pendiente.sin` | `components/demo/campanas/ValidacionPanel.tsx:336` | Aprobar los creativos no los sube a DOOHmain. Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain al aprobar la publicación. | Approving the creatives does not upload them to DOOHmain. Submit the campaign for publishing and approve it here: the artwork is published in DOOHmain when the publication is approved. |
| `campanas.validacion.pendiente.uno` | `components/demo/campanas/ValidacionPanel.tsx:338` | Aprobar los creativos no los sube a DOOHmain. Tienes {n} aprobado listo. Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain al aprobar la publicación. | Approving the creatives does not upload them to DOOHmain. You have {n} approved creative ready. Submit the campaign for publishing and approve it here: the artwork is published in DOOHmain when the publication is approved. |
| `campanas.validacion.pendiente.otros` | `components/demo/campanas/ValidacionPanel.tsx:339` | Aprobar los creativos no los sube a DOOHmain. Tienes {n} aprobados listos. Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain al aprobar la publicación. | Approving the creatives does not upload them to DOOHmain. You have {n} approved creatives ready. Submit the campaign for publishing and approve it here: the artwork is published in DOOHmain when the publication is approved. |
| `campanas.validacion.bajar.titulo` | `components/demo/campanas/ValidacionPanel.tsx:349` | Bajar creativo | Remove creative |
| `campanas.validacion.bajar.si` | `components/demo/campanas/ValidacionPanel.tsx:350` | Sí, bajar | Yes, remove |
| `campanas.validacion.bajar.texto` | `components/demo/campanas/ValidacionPanel.tsx:354` | ¿Seguro que quieres bajar {nombre}? Si estaba publicado, su campaña se finaliza, pero {arte}(su API no lo permite): quedará marcado como “pendiente en DOOHmain”. | Are you sure you want to remove {nombre}? If it was published, its campaign is ended, but {arte} (its API does not allow it): it will be marked as “pending in DOOHmain”. |
| `campanas.validacion.bajar.arte` | `components/demo/campanas/ValidacionPanel.tsx:356` | el arte no se puede quitar de DOOHmain | the artwork cannot be removed from DOOHmain |
| `campanas.validacion.aprobar.titulo` | `components/demo/campanas/ValidacionPanel.tsx:363` | Aprobar y publicar en DOOHmain | Approve and publish in DOOHmain |
| `campanas.validacion.aprobar.si` | `components/demo/campanas/ValidacionPanel.tsx:364` | Sí, publicar | Yes, publish |
| `campanas.validacion.aprobar.texto` | `components/demo/campanas/ValidacionPanel.tsx:371` | Al aprobar, los anuncios se suben a DOOHmain. {noSe} (la API de DOOHmain no lo permite): cualquier cambio posterior deberá hacerse {manual}. ¿Continuar? | When approved, the ads are uploaded to DOOHmain. {noSe} (the DOOHmain API does not allow it): any later change will have to be made {manual}. Continue? |
| `campanas.validacion.aprobar.no-se` | `components/demo/campanas/ValidacionPanel.tsx:372` | Una vez publicados no se pueden eliminar ni reemplazar desde el sistema | Once published they cannot be deleted or replaced from the system |
| `campanas.validacion.aprobar.manual` | `components/demo/campanas/ValidacionPanel.tsx:373` | manualmente en el panel de DOOHmain | manually in the DOOHmain panel |
| `campanas.validacion.republicar.si` | `components/demo/campanas/ValidacionPanel.tsx:382` | Sí, volver a publicar | Yes, publish again |
| `campanas.validacion.republicar.texto` | `components/demo/campanas/ValidacionPanel.tsx:390` | Se manda otra vez a DOOHmain cada pantalla de la campaña con la pieza que tiene asignada {hoy}. Lo que ya está publicado no se duplica. La campaña no cambia de estado. | Each screen of the campaign is sent to DOOHmain again with the piece assigned to it {hoy}. Anything already published is not duplicated. The campaign status does not change. |
| `campanas.validacion.republicar.hoy` | `components/demo/campanas/ValidacionPanel.tsx:391` | hoy | today |
| `campanas.validacion.resultado.publicada` | `components/demo/campanas/ValidacionPanel.tsx:438`<br>`components/demo/campanas/ValidacionPanel.tsx:492` | Publicada | Published |
| `campanas.validacion.resultado.ya-publicada` | `components/demo/campanas/ValidacionPanel.tsx:439` | Ya estaba publicada | Already published |
| `campanas.validacion.resultado.otro-cms` | `components/demo/campanas/ValidacionPanel.tsx:440` | Se programa en su CMS | Scheduled in its CMS |
| `campanas.validacion.resultado.apagada` | `components/demo/campanas/ValidacionPanel.tsx:451` | No se subió nada a DOOHmain: la publicación está apagada en esta instancia | Nothing was uploaded to DOOHmain: publishing is turned off in this instance |
| `campanas.validacion.resultado.sin-pantallas` | `components/demo/campanas/ValidacionPanel.tsx:452` | No había pantallas digitales que subir a DOOHmain | There were no digital screens to upload to DOOHmain |
| `campanas.validacion.resultado.error-detalle` | `components/demo/campanas/ValidacionPanel.tsx:454` | No se publicó en DOOHmain: {error} | Not published in DOOHmain: {error} |
| `campanas.validacion.resultado.sin-detalle` | `components/demo/campanas/ValidacionPanel.tsx:454` | sin detalle | no details |
| `campanas.validacion.resultado.error` | `components/demo/campanas/ValidacionPanel.tsx:455` | No se publicó en ninguna pantalla de DOOHmain | Not published on any DOOHmain screen |
| `campanas.validacion.resultado.parcial.uno` | `components/demo/campanas/ValidacionPanel.tsx:457` | Publicada en DOOHmain con {n} pantalla(s) con error | Published in DOOHmain; {n} screen failed |
| `campanas.validacion.resultado.parcial.otros` | `components/demo/campanas/ValidacionPanel.tsx:457` | Publicada en DOOHmain con {n} pantalla(s) con error | Published in DOOHmain; {n} screens failed |
| `campanas.validacion.resultado.todas-otro-cms` | `components/demo/campanas/ValidacionPanel.tsx:460` | Ninguna pantalla de esta campaña va a DOOHmain: todas usan otro CMS | None of this campaign’s screens go to DOOHmain: they all use another CMS |
| `campanas.validacion.resultado.ok` | `components/demo/campanas/ValidacionPanel.tsx:461` | Publicada en DOOHmain | Published in DOOHmain |
| `campanas.validacion.resultado.la-opera` | `components/demo/campanas/ValidacionPanel.tsx:481` | no va a DOOHmain: la opera {cms} | not sent to DOOHmain: {cms} runs it |
| `campanas.validacion.resultado.otro-cms-nombre` | `components/demo/campanas/ValidacionPanel.tsx:482` | otro CMS | another CMS |
| `campanas.validacion.resultado.sin-pantalla` | `components/demo/campanas/ValidacionPanel.tsx:484` | sin pantalla en DOOHmain | no screen in DOOHmain |
| `finanzas.comun.ver-menos` | `app/(app)/(shell)/finanzas/page.tsx:435` | Ver menos | Show less |
| `finanzas.comun.ver-todas` | `app/(app)/(shell)/finanzas/page.tsx:435` | Ver todas ({n}) | Show all ({n}) |
| `finanzas.comun.folio` | `app/(app)/(shell)/finanzas/page.tsx:268`<br>`app/(app)/(shell)/finanzas/page.tsx:379`<br>`components/demo/finanzas/ComprobanteDialog.tsx:87`<br>`components/demo/finanzas/EstadoCuenta.tsx:151` | Folio | Invoice no. |
| `finanzas.comun.folio-fiscal` | `app/(app)/(shell)/finanzas/page.tsx:272`<br>`app/(app)/(shell)/finanzas/page.tsx:380`<br>`components/demo/finanzas/ComprobanteDialog.tsx:89` | Folio fiscal | CFDI UUID |
| `finanzas.comun.cliente` | `app/(app)/(shell)/finanzas/page.tsx:273`<br>`app/(app)/(shell)/finanzas/page.tsx:382`<br>`components/demo/finanzas/EstadoCuenta.tsx:111`<br>`components/demo/finanzas/EstadoCuenta.tsx:152` | Cliente | Client |
| `finanzas.comun.monto` | `app/(app)/(shell)/finanzas/page.tsx:274`<br>`app/(app)/(shell)/finanzas/page.tsx:385` | Monto | Amount |
| `finanzas.comun.campana` | `app/(app)/(shell)/finanzas/page.tsx:383`<br>`components/demo/finanzas/ComprobanteDialog.tsx:91` | Campaña | Campaign |
| `finanzas.comun.la-emite` | `app/(app)/(shell)/finanzas/page.tsx:384`<br>`components/demo/finanzas/ComprobanteDialog.tsx:71` | La emite | Issued by |
| `finanzas.comun.subtotal-neto` | `app/(app)/(shell)/finanzas/page.tsx:677` | Subtotal (neto) | Subtotal (net) |
| `finanzas.comun.iva-pct` | `app/(app)/(shell)/finanzas/page.tsx:684` | IVA ({pct}%) | VAT ({pct}%) |
| `finanzas.comun.total` | `app/(app)/(shell)/finanzas/page.tsx:697`<br>`components/demo/finanzas/ComprobanteDialog.tsx:98` | Total | Total |
| `finanzas.comun.dias` | `app/(app)/(shell)/finanzas/page.tsx:326`<br>`app/(app)/(shell)/finanzas/page.tsx:828`<br>`app/(app)/(shell)/finanzas/page.tsx:1068` | {n} días | {n} days |
| `finanzas.comun.enviando` | `app/(app)/(shell)/finanzas/page.tsx:1114` | Enviando… | Sending… |
| `finanzas.comun.desde` | `components/demo/finanzas/TableroPeriodo.tsx:79` | Desde | From |
| `finanzas.comun.hasta` | `components/demo/finanzas/TableroPeriodo.tsx:81` | Hasta | To |
| `finanzas.comun.a` | `components/demo/finanzas/TableroPeriodo.tsx:80` | a | to |
| `finanzas.comun.todos-clientes` | `components/demo/finanzas/EstadoCuenta.tsx:54`<br>`components/demo/finanzas/EstadoCuenta.tsx:114` | Todos los clientes | All clients |
| `finanzas.cobranza.al-corriente` | `components/demo/finanzas/etiquetas.ts:17` | Al corriente | Current |
| `finanzas.cobranza.por-vencer` | `components/demo/finanzas/etiquetas.ts:18` | Por vencer | Due soon |
| `finanzas.cobranza.vencida` | `components/demo/finanzas/etiquetas.ts:19` | Vencida | Overdue |
| `finanzas.cobranza.pagada` | `components/demo/finanzas/etiquetas.ts:20` | Pagada | Paid |
| `finanzas.periodo.mes` | `components/demo/finanzas/etiquetas.ts:24` | Este mes | This month |
| `finanzas.periodo.mes-anterior` | `components/demo/finanzas/etiquetas.ts:25` | Mes pasado | Last month |
| `finanzas.periodo.trimestre` | `components/demo/finanzas/etiquetas.ts:26` | Trimestre | This quarter |
| `finanzas.periodo.trimestre-anterior` | `components/demo/finanzas/etiquetas.ts:27` | Trimestre pasado | Last quarter |
| `finanzas.periodo.anio` | `components/demo/finanzas/etiquetas.ts:28` | Año | This year |
| `finanzas.periodo.rango` | `components/demo/finanzas/etiquetas.ts:29` | Rango | Custom range |
| `finanzas.parcialidad.quincenal` | `components/demo/finanzas/etiquetas.ts:34` | {n} cuotas quincenales | {n} semi-monthly installments |
| `finanzas.parcialidad.mensual` | `components/demo/finanzas/etiquetas.ts:35` | {n} cuotas mensuales | {n} monthly installments |
| `finanzas.parcialidad.bimestral` | `components/demo/finanzas/etiquetas.ts:36` | {n} cuotas bimestrales | {n} installments every two months |
| `finanzas.parcialidad.trimestral` | `components/demo/finanzas/etiquetas.ts:37` | {n} cuotas trimestrales | {n} quarterly installments |
| `finanzas.parcialidad.semestral` | `components/demo/finanzas/etiquetas.ts:38` | {n} cuotas semestrales | {n} semiannual installments |
| `finanzas.parcialidad.anual` | `components/demo/finanzas/etiquetas.ts:39` | {n} cuotas anuales | {n} annual installments |
| `finanzas.vence.pagada` | `components/demo/finanzas/etiquetas.ts:54` | pagada | paid |
| `finanzas.vence.vencida` | `components/demo/finanzas/etiquetas.ts:55` | {n}d vencida | {n}d overdue |
| `finanzas.vence.dias` | `components/demo/finanzas/etiquetas.ts:56` | {n}d | in {n}d |
| `finanzas.titulo` | `app/(app)/(shell)/finanzas/page.tsx:227` | Finanzas | Finance |
| `finanzas.subtitulo` | `app/(app)/(shell)/finanzas/page.tsx:228` | Facturación, cobranza y renta a arrendadores | Invoicing, collections and rent to landlords |
| `finanzas.recordatorio.enviado` | `app/(app)/(shell)/finanzas/page.tsx:85` | Recordatorio de cobro enviado | Payment reminder sent |
| `finanzas.recordatorio.no-enviar` | `app/(app)/(shell)/finanzas/page.tsx:87` | No se pudo enviar el recordatorio | Could not send the reminder |
| `finanzas.listas.titulo` | `app/(app)/(shell)/finanzas/page.tsx:186` | Listas para facturar | Ready to invoice |
| `finanzas.listas.vacio` | `app/(app)/(shell)/finanzas/page.tsx:194` | Nada por facturar ahora. Cuando una campaña complete su candado (OC + fotos + reporte) aparecerá aquí. | Nothing to invoice right now. When a campaign completes its billing lock (PO + photos + report) it will show up here. |
| `finanzas.listas.iva-inc` | `app/(app)/(shell)/finanzas/page.tsx:207` | {monto} · IVA inc. | {monto} · incl. VAT |
| `finanzas.listas.generar` | `app/(app)/(shell)/finanzas/page.tsx:212` | Generar factura | Generate invoice |
| `finanzas.listas.requiere` | `app/(app)/(shell)/finanzas/page.tsx:215` | Lista · requiere Finanzas | Ready · requires Finance |
| `finanzas.cobranza.titulo` | `app/(app)/(shell)/finanzas/page.tsx:241` | Cobranza | Collections |
| `finanzas.cobranza.cuotas` | `app/(app)/(shell)/finanzas/page.tsx:248` | Cuotas | Installments |
| `finanzas.cobranza.chip.vencidas` | `app/(app)/(shell)/finanzas/page.tsx:249` | Vencidas | Overdue |
| `finanzas.cobranza.chip.por-vencer` | `app/(app)/(shell)/finanzas/page.tsx:250` | Por vencer | Due soon |
| `finanzas.cobranza.chip.al-corriente` | `app/(app)/(shell)/finanzas/page.tsx:251` | Al corriente | Current |
| `finanzas.cobranza.vacia` | `app/(app)/(shell)/finanzas/page.tsx:262` | Sin facturas en cobranza. | No invoices in collections. |
| `finanzas.cobranza.col.plazo` | `app/(app)/(shell)/finanzas/page.tsx:275` | Plazo | Payment terms |
| `finanzas.cobranza.col.vence` | `app/(app)/(shell)/finanzas/page.tsx:276` | Vence | Due |
| `finanzas.cobranza.col.estatus` | `app/(app)/(shell)/finanzas/page.tsx:277`<br>`app/(app)/(shell)/finanzas/page.tsx:386` | Estatus | Status |
| `finanzas.cobranza.emite` | `app/(app)/(shell)/finanzas/page.tsx:310`<br>`app/(app)/(shell)/finanzas/page.tsx:1044` | Emite: {entidad} | Issued by: {entidad} |
| `finanzas.cobranza.cuotas-pagadas` | `app/(app)/(shell)/finanzas/page.tsx:323` | {pagadas} de {total} cuotas pagadas | {pagadas} of {total} installments paid |
| `finanzas.cobranza.cuota` | `app/(app)/(shell)/finanzas/page.tsx:1032` | Cuota {n} de {total} | Installment {n} of {total} |
| `finanzas.cobranza.saldo` | `app/(app)/(shell)/finanzas/page.tsx:1065` | saldo {monto} | balance {monto} |
| `finanzas.cobranza.pagos` | `app/(app)/(shell)/finanzas/page.tsx:1093` | Pagos y comprobantes | Payments and proof of payment |
| `finanzas.cobranza.registrar-pago` | `app/(app)/(shell)/finanzas/page.tsx:1106` | Registrar pago | Record payment |
| `finanzas.cobranza.recordar` | `app/(app)/(shell)/finanzas/page.tsx:1114` | Recordar | Remind |
| `finanzas.cobranza.ultimo` | `app/(app)/(shell)/finanzas/page.tsx:1117` | Último: {fecha} | Last: {fecha} |
| `finanzas.cobranza.enviados.uno` | `app/(app)/(shell)/finanzas/page.tsx:1118` | {n} enviado | {n} sent |
| `finanzas.cobranza.enviados.otros` | `app/(app)/(shell)/finanzas/page.tsx:1118` | {n} enviados | {n} sent |
| `finanzas.facturas.titulo` | `app/(app)/(shell)/finanzas/page.tsx:349` | Facturas | Invoices |
| `finanzas.facturas.chip.emitidas` | `app/(app)/(shell)/finanzas/page.tsx:353` | Emitidas | Issued |
| `finanzas.facturas.chip.pagadas` | `app/(app)/(shell)/finanzas/page.tsx:354` | Pagadas | Paid |
| `finanzas.facturas.chip.anuladas` | `app/(app)/(shell)/finanzas/page.tsx:355` | Anuladas | Voided |
| `finanzas.facturas.vacio.titulo` | `app/(app)/(shell)/finanzas/page.tsx:369` | Todavía no hay facturas | No invoices yet |
| `finanzas.facturas.vacio.texto` | `app/(app)/(shell)/finanzas/page.tsx:370` | Aquí aparecerán en cuanto emitas la primera desde «Listas para facturar». | They will show up here as soon as you issue the first one from “Ready to invoice”. |
| `finanzas.facturas.col.emitida` | `app/(app)/(shell)/finanzas/page.tsx:381` | Emitida | Issued |
| `finanzas.facturas.ver` | `app/(app)/(shell)/finanzas/page.tsx:395` | Ver el comprobante | View the payment receipt |
| `finanzas.facturas.estatus.pagada` | `app/(app)/(shell)/finanzas/page.tsx:417` | Pagada | Paid |
| `finanzas.facturas.estatus.anulada` | `app/(app)/(shell)/finanzas/page.tsx:419` | Anulada | Voided |
| `finanzas.facturas.estatus.emitida` | `app/(app)/(shell)/finanzas/page.tsx:420` | Emitida | Issued |
| `finanzas.renta.titulo` | `app/(app)/(shell)/finanzas/page.tsx:468` | Renta por pagar a propietarios | Rent payable to landlords |
| `finanzas.factura.generada` | `app/(app)/(shell)/finanzas/page.tsx:491` | Factura generada | Invoice generated |
| `finanzas.factura.no-generar` | `app/(app)/(shell)/finanzas/page.tsx:638` | No se pudo generar la factura | Could not generate the invoice |
| `finanzas.factura.titulo` | `app/(app)/(shell)/finanzas/page.tsx:646` | Generar factura | Generate invoice |
| `finanzas.factura.confirmar` | `app/(app)/(shell)/finanzas/page.tsx:666` | Confirmar y emitir | Confirm and issue |
| `finanzas.factura.generando` | `app/(app)/(shell)/finanzas/page.tsx:668` | Generando… | Generating… |
| `finanzas.factura.emitir` | `app/(app)/(shell)/finanzas/page.tsx:669` | Emitir factura | Issue invoice |
| `finanzas.factura.emisora` | `app/(app)/(shell)/finanzas/page.tsx:709` | Con cuál de tus razones sociales se emite | Which of your legal entities issues it |
| `finanzas.factura.la-que-vende` | `app/(app)/(shell)/finanzas/page.tsx:721` | ␣— la que vende | ␣— selling entity |
| `finanzas.factura.sin-entidades` | `app/(app)/(shell)/finanzas/page.tsx:727` | Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales; la factura se emite igual y queda «sin asignar». | You have no legal entities entered yet. They are added under Legal entities; the invoice is issued anyway and stays “unassigned”. |
| `finanzas.factura.sin-elegir` | `app/(app)/(shell)/finanzas/page.tsx:731` | Sin elegir, el comprobante queda «sin asignar». No se inventa: hay más de una razón social que vende, o ninguna la tiene marcada. | If none is chosen, the payment receipt stays “unassigned”. It is not guessed: more than one legal entity sells, or none is marked as selling. |
| `finanzas.factura.dura.uno` | `app/(app)/(shell)/finanzas/page.tsx:743` | Esta campaña dura {n} mes: no admite un reparto en cuotas iguales, así que se cobra en una sola exhibición. | This campaign lasts {n} month: it can’t be split into equal installments, so it is billed in a single payment. |
| `finanzas.factura.dura.otros` | `app/(app)/(shell)/finanzas/page.tsx:743` | Esta campaña dura {n} meses: no admite un reparto en cuotas iguales, así que se cobra en una sola exhibición. | This campaign lasts {n} months: it can’t be split into equal installments, so it is billed in a single payment. |
| `finanzas.factura.en-cuotas` | `app/(app)/(shell)/finanzas/page.tsx:757` | Cobrar en parcialidades | Bill in installments |
| `finanzas.factura.campana-de.uno` | `app/(app)/(shell)/finanzas/page.tsx:759` | · campaña de {n} mes | · {n}-month campaign |
| `finanzas.factura.campana-de.otros` | `app/(app)/(shell)/finanzas/page.tsx:759` | · campaña de {n} meses | · {n}-month campaign |
| `finanzas.factura.cuotas` | `app/(app)/(shell)/finanzas/page.tsx:765` | Cuotas | Installments |
| `finanzas.factura.primer-venc` | `app/(app)/(shell)/finanzas/page.tsx:779` | Primer vencimiento | First due date |
| `finanzas.factura.reparto` | `app/(app)/(shell)/finanzas/page.tsx:790` | {n} cuotas de {monto} (la última ajusta el redondeo) · suman {total} | {n} installments of {monto} (the last one absorbs the rounding) · total {total} |
| `finanzas.factura.plazo` | `app/(app)/(shell)/finanzas/page.tsx:809` | Plazo de cobranza | Payment terms |
| `finanzas.factura.plazo.informativo` | `app/(app)/(shell)/finanzas/page.tsx:809` | Plazo de cobranza (informativo con parcialidades) | Payment terms (for reference only when billing in installments) |
| `finanzas.pago.liquidada` | `app/(app)/(shell)/finanzas/page.tsx:882` | Cobranza liquidada | Paid in full |
| `finanzas.pago.abono-registrado` | `app/(app)/(shell)/finanzas/page.tsx:882` | Abono registrado | Partial payment recorded |
| `finanzas.pago.no-registrar` | `app/(app)/(shell)/finanzas/page.tsx:884` | No se pudo registrar el pago | Could not record the payment |
| `finanzas.pago.titulo` | `app/(app)/(shell)/finanzas/page.tsx:892` | Registrar pago | Record payment |
| `finanzas.pago.subtitulo` | `app/(app)/(shell)/finanzas/page.tsx:893` | {folio} · saldo {saldo} | {folio} · balance {saldo} |
| `finanzas.pago.confirmar` | `app/(app)/(shell)/finanzas/page.tsx:912` | Confirmar y registrar | Confirm and record |
| `finanzas.pago.liquidar` | `app/(app)/(shell)/finanzas/page.tsx:924` | Liquidar total | Record full payment |
| `finanzas.pago.guardando` | `app/(app)/(shell)/finanzas/page.tsx:931` | Guardando… | Saving… |
| `finanzas.pago.registrar-abono` | `app/(app)/(shell)/finanzas/page.tsx:931` | Registrar abono | Record partial payment |
| `finanzas.pago.monto` | `app/(app)/(shell)/finanzas/page.tsx:942` | Monto del abono | Payment amount |
| `finanzas.pago.fecha` | `app/(app)/(shell)/finanzas/page.tsx:955` | Fecha en que se recibió | Date received |
| `finanzas.pago.excede` | `app/(app)/(shell)/finanzas/page.tsx:975` | ⚠ El monto excede el saldo ({saldo}). Solo se aplicará el saldo pendiente. | ⚠ The amount exceeds the balance ({saldo}). Only the outstanding balance will be applied. |
| `finanzas.pago.al-cubrir` | `app/(app)/(shell)/finanzas/page.tsx:979` | Al cubrir el saldo total, la cobranza pasa a {pagada} y se detienen los recordatorios. | When the full balance is covered, this item is marked {pagada} and reminders stop. |
| `finanzas.pago.pagada` | `app/(app)/(shell)/finanzas/page.tsx:979` | Pagada | Paid |
| `finanzas.comprobante-pago.tipo` | `components/demo/finanzas/ComprobantePago.tsx:39` | Debe ser un PDF o una imagen (PNG, JPG o WebP) | It must be a PDF or an image (PNG, JPG or WebP) |
| `finanzas.comprobante-pago.supera` | `components/demo/finanzas/ComprobantePago.tsx:40` | El archivo supera {mb} MB | The file exceeds {mb} MB |
| `finanzas.comprobante-pago.no-leer` | `components/demo/finanzas/ComprobantePago.tsx:43` | No se pudo leer el archivo | Could not read the file |
| `finanzas.comprobante-pago.titulo` | `components/demo/finanzas/ComprobantePago.tsx:65` | Comprobante de pago | Proof of payment |
| `finanzas.comprobante-pago.quitar` | `components/demo/finanzas/ComprobantePago.tsx:74` | Quitar | Remove |
| `finanzas.comprobante-pago.adjuntar` | `components/demo/finanzas/ComprobantePago.tsx:87` | Adjuntar PDF o imagen | Attach PDF or image |
| `finanzas.pagos.no-cargar` | `components/demo/finanzas/ComprobantePago.tsx:127` | No se pudieron cargar los pagos | Could not load the payments |
| `finanzas.pagos.no-guardar` | `components/demo/finanzas/ComprobantePago.tsx:142` | No se pudo guardar el comprobante | Could not save the proof of payment |
| `finanzas.pagos.titulo` | `components/demo/finanzas/ComprobantePago.tsx:152` | Pagos recibidos | Payments received |
| `finanzas.pagos.vacio` | `components/demo/finanzas/ComprobantePago.tsx:164` | Esta cobranza aún no tiene pagos registrados. | This collection has no payments recorded yet. |
| `finanzas.pagos.sin-fecha` | `components/demo/finanzas/ComprobantePago.tsx:174` | Sin fecha | No date |
| `finanzas.pagos.historico` | `components/demo/finanzas/ComprobantePago.tsx:175` | ␣· cobrado antes del 08/10 (aproximado) | ␣· collected before Oct 8 (approximate) |
| `finanzas.pagos.comprobante` | `components/demo/finanzas/ComprobantePago.tsx:187` | Comprobante | Proof of payment |
| `finanzas.pagos.sin-comprobante` | `components/demo/finanzas/ComprobantePago.tsx:190` | Sin comprobante | No proof of payment |
| `finanzas.pagos.subiendo` | `components/demo/finanzas/ComprobantePago.tsx:201` | Subiendo… | Uploading… |
| `finanzas.pagos.reemplazar` | `components/demo/finanzas/ComprobantePago.tsx:203` | Reemplazar | Replace |
| `finanzas.pagos.adjuntar` | `components/demo/finanzas/ComprobantePago.tsx:204` | Adjuntar | Attach |
| `finanzas.estado-cuenta.no-calcular` | `components/demo/finanzas/EstadoCuenta.tsx:44` | No se pudo calcular el estado de cuenta | Could not calculate the account statement |
| `finanzas.estado-cuenta.titulo` | `components/demo/finanzas/EstadoCuenta.tsx:75` | Estado de cuenta | Account statement |
| `finanzas.estado-cuenta.mes` | `components/demo/finanzas/EstadoCuenta.tsx:88` | Mes | Month |
| `finanzas.estado-cuenta.saldo-inicio` | `components/demo/finanzas/EstadoCuenta.tsx:134` | Saldo al inicio | Opening balance |
| `finanzas.estado-cuenta.facturado` | `components/demo/finanzas/EstadoCuenta.tsx:135` | + Facturado | + Invoiced |
| `finanzas.estado-cuenta.cobrado` | `components/demo/finanzas/EstadoCuenta.tsx:136` | − Cobrado | − Collected |
| `finanzas.estado-cuenta.saldo-cierre` | `components/demo/finanzas/EstadoCuenta.tsx:137` | = Saldo al cierre | = Closing balance |
| `finanzas.estado-cuenta.vencido-al` | `components/demo/finanzas/EstadoCuenta.tsx:140` | Vencido al {fecha} | Overdue as of {fecha} |
| `finanzas.estado-cuenta.vacio` | `components/demo/finanzas/EstadoCuenta.tsx:143` | Sin facturas ni pagos en {periodo}. | No invoices or payments in {periodo}. |
| `finanzas.estado-cuenta.col.fecha` | `components/demo/finanzas/EstadoCuenta.tsx:149` | Fecha | Date |
| `finanzas.estado-cuenta.col.movimiento` | `components/demo/finanzas/EstadoCuenta.tsx:150` | Movimiento | Transaction |
| `finanzas.estado-cuenta.col.cargo` | `components/demo/finanzas/EstadoCuenta.tsx:153` | Cargo | Charge |
| `finanzas.estado-cuenta.col.abono` | `components/demo/finanzas/EstadoCuenta.tsx:154` | Abono | Payment |
| `finanzas.estado-cuenta.col.saldo` | `components/demo/finanzas/EstadoCuenta.tsx:155` | Saldo | Balance |
| `finanzas.estado-cuenta.factura` | `components/demo/finanzas/EstadoCuenta.tsx:163` | Factura | Invoice |
| `finanzas.estado-cuenta.pago` | `components/demo/finanzas/EstadoCuenta.tsx:163` | Pago recibido | Payment received |
| `finanzas.estado-cuenta.aproximada.title` | `components/demo/finanzas/EstadoCuenta.tsx:165` | Pago anterior a que el sistema guardara fechas: lleva la fecha de su factura | Payment from before the system stored dates: it carries its invoice’s date |
| `finanzas.estado-cuenta.aproximada` | `components/demo/finanzas/EstadoCuenta.tsx:166` | fecha aproximada | approximate date |
| `finanzas.periodo.no-calcular` | `components/demo/finanzas/TableroPeriodo.tsx:64` | No se pudo calcular el periodo | Could not calculate the period |
| `finanzas.periodo.titulo` | `components/demo/finanzas/TableroPeriodo.tsx:91` | Resumen del periodo | Period summary |
| `finanzas.periodo.subtitulo` | `components/demo/finanzas/TableroPeriodo.tsx:94` | {etiqueta} · {desde} a {hasta} | {etiqueta} · {desde} to {hasta} |
| `finanzas.periodo.aria` | `components/demo/finanzas/TableroPeriodo.tsx:110` | Periodo | Period |
| `finanzas.periodo.elige` | `components/demo/finanzas/TableroPeriodo.tsx:139` | Elige la fecha de inicio y la de fin. | Choose the start and end dates. |
| `finanzas.periodo.por-cobrar` | `components/demo/finanzas/TableroPeriodo.tsx:159` | Por cobrar al cierre | Receivable at close |
| `finanzas.periodo.al-inicio` | `components/demo/finanzas/TableroPeriodo.tsx:161` | al inicio: {monto} | opening: {monto} |
| `finanzas.periodo.vencido` | `components/demo/finanzas/TableroPeriodo.tsx:166` | Vencido | Overdue |
| `finanzas.periodo.vencido.sub.uno` | `components/demo/finanzas/TableroPeriodo.tsx:168` | {n} factura al {fecha} | {n} invoice as of {fecha} |
| `finanzas.periodo.vencido.sub.otros` | `components/demo/finanzas/TableroPeriodo.tsx:168` | {n} facturas al {fecha} | {n} invoices as of {fecha} |
| `finanzas.periodo.facturado` | `components/demo/finanzas/TableroPeriodo.tsx:176` | Facturado | Invoiced |
| `finanzas.periodo.facturas.uno` | `components/demo/finanzas/TableroPeriodo.tsx:178` | {n} factura | {n} invoice |
| `finanzas.periodo.facturas.otros` | `components/demo/finanzas/TableroPeriodo.tsx:178` | {n} facturas | {n} invoices |
| `finanzas.periodo.cobrado` | `components/demo/finanzas/TableroPeriodo.tsx:184` | Cobrado | Collected |
| `finanzas.periodo.cobrado.sub` | `components/demo/finanzas/TableroPeriodo.tsx:186` | pagos recibidos en el periodo | payments received in the period |
| `finanzas.periodo.renta` | `components/demo/finanzas/TableroPeriodo.tsx:195` | Renta a propietarios | Rent to landlords |
| `finanzas.periodo.renta.pagada` | `components/demo/finanzas/TableroPeriodo.tsx:197` | Pagada {monto} | Paid {monto} |
| `finanzas.periodo.renta.por-pagar` | `components/demo/finanzas/TableroPeriodo.tsx:202` | Por pagar del periodo {monto} | Payable this period {monto} |
| `finanzas.periodo.sin-fecha` | `components/demo/finanzas/TableroPeriodo.tsx:215` | {monto} de lo cobrado son pagos de antes de que el sistema guardara la fecha de cada pago: se fecharon con la fecha de su factura, así que su mes es aproximado. | {monto} of what was collected comes from payments made before the system stored each payment’s date: they were dated with their invoice’s date, so their month is approximate. |
| `finanzas.comprobante.titulo` | `components/demo/finanzas/ComprobanteDialog.tsx:50` | Comprobante {folio} | Payment receipt {folio} |
| `finanzas.comprobante.cerrar` | `components/demo/finanzas/ComprobanteDialog.tsx:56` | Cerrar | Close |
| `finanzas.comprobante.imprimir` | `components/demo/finanzas/ComprobanteDialog.tsx:59` | Imprimir | Print |
| `finanzas.comprobante.la-recibe` | `components/demo/finanzas/ComprobanteDialog.tsx:78` | La recibe | Billed to |
| `finanzas.comprobante.uso` | `components/demo/finanzas/ComprobanteDialog.tsx:82` | Uso: {uso} | CFDI use: {uso} |
| `finanzas.comprobante.serie` | `components/demo/finanzas/ComprobanteDialog.tsx:88` | Serie | Series |
| `finanzas.comprobante.fecha` | `components/demo/finanzas/ComprobanteDialog.tsx:90` | Fecha de emisión | Issue date |
| `finanzas.comprobante.subtotal` | `components/demo/finanzas/ComprobanteDialog.tsx:95` | Subtotal | Subtotal |
| `finanzas.comprobante.iva` | `components/demo/finanzas/ComprobanteDialog.tsx:96` | IVA | VAT |
| `finanzas.comprobante.no-cuadra` | `components/demo/finanzas/ComprobanteDialog.tsx:110` | Los importes de este comprobante no cuadran: el subtotal más el IVA no da el total. Revísalo antes de entregarlo. | The amounts on this payment receipt do not add up: the subtotal plus VAT does not equal the total. Check it before handing it over. |
| `finanzas.comprobante.aviso` | `components/demo/finanzas/ComprobanteDialog.tsx:120` | Comprobante de pago. NO es un CFDI timbrado ante el SAT: el timbrado se emite por separado y este documento no sustituye al comprobante fiscal. | Payment receipt. It is NOT a CFDI stamped with the SAT: the stamped invoice is issued separately and this document does not replace it. |
