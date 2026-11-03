# Revisión · lote L4 del italiano (Campañas, Finanzas, Clientes, Reportes y Dashboard)

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l4-campanas`, sobre
`integra/idiomas` (`6fea374a`) · **Tablero:** `vault/03-Frontend/italiano-olas.md`
(subsección «Lote L4»).

**1082 claves**, todas con italiano: `campanas` 396 · `finanzas` 170 ·
`clientes` 220 · `reportes` 148 · `inicio` 148. Los cinco `IT_*` son ya
`Record<…>` completos: una clave sin italiano no compila.

## 1 · Cómo se midió

| Medición | Resultado |
|---|---|
| HTML de `lib/i18n` y `components` (`I18N_VOLCAR_TODO`), antes (`6fea374a`) y después | 3020 antes, 3441 después: `diff -rq` **0 distintos, 0 desaparecidos**; 421 nuevos (los estados italianos de las pruebas nuevas) |
| `ES_*` y `EN_*` de los cinco ámbitos | Idénticos clave a clave (volcados a JSON antes y después, `cmp`) |
| HTML español del Dashboard | Su instantánea congelada (`__snapshots__`) sin tocar, en verde |
| Cobertura (`cobertura-italiano.test.ts`) | `campanas`, `finanzas`, `clientes`, `reportes`, `inicio`: **0 pendientes** (antes 1082) |
| Espejo italiano (`I18N_VOLCAR_IT`) | 358 → **326** huellas: las 32 del Dashboard («1,234 space·days») desaparecen; ninguna en los cuatro archivos del lote |
| Suite completa | `typecheck` limpio · **383 archivos, 7309 pruebas** en verde |

## 2 · Pruebas nuevas (rojo antes de traducir)

En `pantallas-campanas-finanzas`, `pantallas-clientes`, `pantallas-reportes` y
`pantallas-inicio`, un bloque «en ITALIANO» por archivo:

- **Barrido** (`lib/test/barrido-italiano-l4.ts`, `fugasItaliano`): ningún trozo
  INGLÉS de los diccionarios del lote (la caída al inglés) ni ESPAÑOL (un texto
  sin `t()`), en nodos y en `title`/`aria-label`/`placeholder`/`alt`. El inglés
  de claves de OTROS lotes que aún caen (la etapa de Comercial negociación en
  Captación, el aviso de la franja de `compartidos`) no cuenta: un trozo
  ambiguo («Approved») se descarta, uno solo nuestro no.
- **Formatos** (`huellasEnItaliano`) en cada estado, con dos datos declarados:
  el ejemplo «212,500.50» del aviso del campo de cifra y el folio «CA-0001.1».
- **Dinero**: el símbolo italiano de la moneda de la instancia, MXN y USD.
- **Copias**: ningún `IT_*` igual al inglés o al español, salvo 45 cognados y
  anglicismos declarados uno por uno (`IGUALES_A_PROPOSITO_L4`), con una
  comprobación de que la lista no caduca.
- **CSV** del estado de cuenta en italiano, byte a byte
  (`estado-cuenta-csv-idioma.test.ts`).

Rojo medido con los `IT_*` vacíos: **9 pruebas en rojo, 567 trozos ingleses**;
con el Dashboard de antes, además, 6 estados con «1,234».

**Mutantes: 13, mueren 13.** Un subtítulo en inglés y uno en español pegados en
`IT_*`; un plural sin concordar; el Dashboard sin el idioma en sus cifras; un
`title` en inglés; una nota del motor en inglés; el CSV sin la moneda en el
encabezado; la costura sin la excepción «Vencida»; la guardia sin el permitido
del folio; un `title` y un texto pintados SIN `t()` (literal inglés y español);
y una nota del motor con el idioma fijo. Los dos primeros sobrevivían en la
primera medición —el barrido no ve un `IT_*` que ES el inglés— y por eso
existe la prueba de copias.

## 3 · Decisiones de este lote (términos que el glosario no traía)

| Español | Italiano | Por qué |
|---|---|---|
| OC / orden de compra | OdA / ordine d’acquisto (m.) | «OdA ricevuto» |
| candado (de facturación) | lucchetto | «il lucchetto si apre» conserva la imagen |
| creativo | creatività (f., invariable) | el uso del sector en Italia |
| arte | grafica | |
| imprenta | tipografia | |
| evidencias | prove fotografiche / prove | |
| prospecto | prospect | invariable, uso comercial |
| bitácora (de captación) | registro | |
| predio | immobile | |
| captación | acquisizione | |
| luz / recibo | luce / bolletta | |
| Finanzas (módulo) | Finanza | **lo decide L5** con el menú; aquí solo en «richiede il permesso di Finanza» |
| Configuración | Configurazione | sección de Impostazioni |
| pantalla de la APLICACIÓN | schermata | distinta de «schermo» e «impianto» |
| Abono (estado de cuenta) | Accredito | junto a «Addebito» |
| Recordar / recordatorio de cobro | Sollecita / sollecito | |
| trimestre en reportes | T1 2026 | **P2**: se confirma la letra «T» de la ola 0 |

## 4 · Lo que queda fuera, y por qué

- **El campo de cifra lee es-MX en todos los idiomas** (`lib/captura-cifra.ts`,
  `CampoCifra`): un italiano que teclee «212.500,50» ve el rechazo. El aviso
  (`campanas.candado.monto-ilegible`) lo dice con verdad y con su ejemplo.
  Cambiar la lectura es dinero (zona ROJA) y es de `compartidos`: **pendiente
  para el dueño / L5**.
- **El catálogo SAT del alta de cliente** (`USOS_CFDI`, `REGIMENES` en
  `clientes/page.tsx`) sale en español en inglés y en italiano: el texto ES el
  valor que se guarda. Igual que en el inglés.
- **Textos de otros lotes que aún caen al inglés** en estas pantallas: la etapa
  de Captación (L2, `comercial`), «(required)» y el aviso de la franja (L5,
  `compartidos`).

## 5 · Las claves

## `textos/campanas.ts` · 396 claves

| clave | español | italiano |
|---|---|---|
| `campanas.comun.campana` | Campaña | Campagna |
| `campanas.comun.ver-menos` | Ver menos | Mostra meno |
| `campanas.comun.ver-todas` | Ver todas ({n}) | Mostra tutte ({n}) |
| `campanas.comun.lista-facturar` | Lista para facturar | Pronta da fatturare |
| `campanas.comun.sin-presupuesto` | Sin presupuesto capturado en la propuesta | Nessun budget inserito nella proposta |
| `campanas.comun.minimizar` | Minimizar | Riduci |
| `campanas.comun.monto` | Monto | Importo |
| `campanas.comun.fecha` | Fecha | Data |
| `campanas.comun.total` | Total | Totale |
| `campanas.comun.margen` | Margen | Margine |
| `campanas.comun.pendiente` | Pendiente | In sospeso |
| `campanas.comun.ver-contrato` | Ver contrato | Vedi contratto |
| `campanas.comun.subiendo` | Subiendo… | Caricamento… |
| `campanas.comun.contrato-supera` | El contrato supera {mb} MB | Il contratto supera {mb} MB |
| `campanas.comun.leer-archivo` | No se pudo leer el archivo | Impossibile leggere il file |
| `campanas.comun.rango-horas` | {inicio} a {fin} | {inicio}–{fin} |
| `campanas.comun.error` | Error | Errore |
| `campanas.estado.draft` | Borrador | Bozza |
| `campanas.estado.cotizacion` | Cotización | Preventivo |
| `campanas.estado.confirmada` | Confirmada | Confermata |
| `campanas.estado.activa` | Activa | Attiva |
| `campanas.estado.completada` | Completada | Completata |
| `campanas.estado.cancelada` | Cancelada | Annullata |
| `campanas.estado.lista-facturar` | Lista para facturar | Pronta da fatturare |
| `campanas.etapa.reservada` | Reservada | Prenotata |
| `campanas.etapa.confirmada` | Confirmada | Confermata |
| `campanas.etapa.oc-recibida` | OC recibida | OdA ricevuto |
| `campanas.etapa.creativo-recibido` | Creativo recibido | Creatività ricevuta |
| `campanas.etapa.creativo-validado` | Creativo validado | Creatività approvata |
| `campanas.etapa.enviada-dominio` | Enviada al dominio | Inviata per la pubblicazione |
| `campanas.etapa.publicada` | Publicada | Pubblicata |
| `campanas.etapa.en-imprenta` | En imprenta | In tipografia |
| `campanas.etapa.en-produccion` | En producción | In produzione |
| `campanas.etapa.instalada` | Instalada / al aire | Installata / in onda |
| `campanas.etapa.reporte-generado` | Reporte generado | Report generato |
| `campanas.etapa.lista-facturar` | Lista para facturar | Pronta da fatturare |
| `campanas.etapa.facturada` | Facturada | Fatturata |
| `campanas.validacion-pub.pendiente` | Pendiente de validar | In attesa di convalida |
| `campanas.validacion-pub.aprobada` | Publicación aprobada | Pubblicazione approvata |
| `campanas.validacion-pub.rechazada` | Publicación rechazada | Pubblicazione rifiutata |
| `campanas.creatividad.pendiente` | Pendiente | In sospeso |
| `campanas.creatividad.validada` | Validada | Approvata |
| `campanas.creatividad.rechazada` | Rechazada | Rifiutata |
| `campanas.reserva.tentativa` | Tentativa | Provvisoria |
| `campanas.reserva.confirmada` | Confirmada | Confermata |
| `campanas.reserva.cancelada` | Cancelada | Annullata |
| `campanas.ot.pendiente` | Pendiente | In sospeso |
| `campanas.ot.asignada` | Asignada | Assegnato |
| `campanas.ot.en-proceso` | En proceso | In corso |
| `campanas.ot.bloqueada` | Bloqueada | Bloccato |
| `campanas.ot.en-revision` | En revisión | In revisione |
| `campanas.ot.completada` | Completada | Completato |
| `campanas.ot.rechazada` | Rechazada | Rifiutato |
| `campanas.ot.cancelada` | Cancelada | Annullato |
| `campanas.impresion.arte-recibido` | Arte recibido | Grafica ricevuta |
| `campanas.impresion.validado` | Validado | Approvato |
| `campanas.impresion.en-produccion` | En producción | In produzione |
| `campanas.impresion.impreso` | Impreso | Stampato |
| `campanas.impresion.listo-montaje` | Listo para montaje | Pronto per il montaggio |
| `campanas.remoto.active` | Al aire | In onda |
| `campanas.remoto.pause` | En pausa | In pausa |
| `campanas.remoto.finished` | Finalizada | Terminata |
| `campanas.remoto.pending` | Pendiente | In sospeso |
| `campanas.remoto.vencida` | Terminó | Conclusa |
| `campanas.remoto.programada` | Programada | Programmata |
| `campanas.remoto.eliminada` | Eliminada en DOOHmain | Eliminata in DOOHmain |
| `campanas.remoto.no-encontrada` | No está en DOOHmain | Non è in DOOHmain |
| `campanas.tipo.ooh` | OOH | OOH |
| `campanas.tipo.dooh` | DOOH | DOOH |
| `campanas.tipo.hibrida` | HIBRIDA | Ibrida |
| `campanas.lista.titulo` | Campañas | Campagne |
| `campanas.lista.subtitulo` | Cada campaña viaja sola por la empresa · pipeline en vivo | Ogni campagna fa il suo percorso in azienda · pipeline in tempo reale |
| `campanas.lista.por-validar.titulo` | Por validar ({n}) | Da convalidare ({n}) |
| `campanas.lista.por-validar.sub` | Enviadas al dominio, esperan aprobación antes de publicar | Inviate per la pubblicazione, attendono l’approvazione prima di andare in onda |
| `campanas.lista.validar` | Validar | Convalida |
| `campanas.lista.buscar` | Buscar por nombre, folio o cliente… | Cerca per nome, rif. interno o cliente… |
| `campanas.lista.todos-estados` | Todos los estados | Tutti gli stati |
| `campanas.lista.compacta.volver` | Volver a mostrar el pipeline de cada campaña | Mostra di nuovo la pipeline di ogni campagna |
| `campanas.lista.compacta.esconder` | Esconder los pipelines: una fila por campaña | Nascondi le pipeline: una riga per campagna |
| `campanas.lista.mostrar-pipelines` | Mostrar pipelines | Mostra pipeline |
| `campanas.lista.vista-compacta` | Vista compacta | Vista compatta |
| `campanas.lista.mostrar-ocultas` | Mostrar ocultas ({n}) | Mostra nascoste ({n}) |
| `campanas.lista.conteo` | {visibles} de {total} | {visibles} di {total} |
| `campanas.lista.sin-resultados.titulo` | Ninguna campaña coincide con la búsqueda | Nessuna campagna corrisponde alla ricerca |
| `campanas.lista.sin-resultados.texto` | No hay resultados para «{q}». | Nessun risultato per «{q}». |
| `campanas.lista.sin-resultados.texto-estado` | No hay resultados para «{q}» en estado {estado}. | Nessun risultato per «{q}» con stato {estado}. |
| `campanas.lista.sin-resultados.estado` | No hay campañas en estado {estado}. | Non ci sono campagne con stato {estado}. |
| `campanas.lista.limpiar` | Limpiar filtros | Cancella i filtri |
| `campanas.lista.vacia.titulo` | Todavía no hay campañas | Ancora nessuna campagna |
| `campanas.lista.vacia.texto` | Las campañas se generan al aprobar una propuesta. Crea una propuesta y apruébala para verla aquí. | Le campagne si generano quando si approva una proposta. Crea una proposta e approvala per vederla qui. |
| `campanas.lista.vacia.ir` | Ir a Propuestas | Vai a Proposte |
| `campanas.lista.ocultas.titulo` | Ocultaste todas las campañas de esta vista | Hai nascosto tutte le campagne di questa vista |
| `campanas.lista.ocultas.texto` | Ocultar solo las quita de tu lista en este navegador: siguen activas para todos. | Nasconderle le toglie solo dal tuo elenco in questo browser: restano attive per tutti. |
| `campanas.lista.hilo` | hilo conductor | filo conduttore |
| `campanas.lista.vencida.title` | El periodo contratado ya terminó. | Il periodo prenotato è già terminato. |
| `campanas.lista.antes.title` | Se marcó como completada antes de que terminara su periodo. | È stata segnata come completata prima della fine del suo periodo. |
| `campanas.lista.vencida` | · periodo terminado | · periodo terminato |
| `campanas.lista.antes` | · cerrada antes de tiempo | · chiusa in anticipo |
| `campanas.lista.mostrar-pipeline` | Mostrar el pipeline | Mostra la pipeline |
| `campanas.lista.minimizar.title` | Minimizar esta campaña | Riduci questa campagna |
| `campanas.lista.ocultar` | Ocultar de mi lista | Nascondi dal mio elenco |
| `campanas.lista.ocultar.title` | Ocultar de mi lista (solo en este navegador; la campaña sigue igual para todos) | Nascondi dal mio elenco (solo in questo browser; la campagna resta invariata per tutti) |
| `campanas.lista.ver-pipeline` | Ver pipeline | Vedi pipeline |
| `campanas.kpi.activas` | Activas | Attive |
| `campanas.kpi.activas.sub.uno` | {n} confirmada por arrancar | {n} confermata da avviare |
| `campanas.kpi.activas.sub.otros` | {n} confirmadas por arrancar | {n} confermate da avviare |
| `campanas.kpi.por-validar` | Por validar publicación | Pubblicazione da convalidare |
| `campanas.kpi.por-validar.sub` | enviadas al dominio | inviate per la pubblicazione |
| `campanas.kpi.listas` | Listas para facturar | Pronte da fatturare |
| `campanas.kpi.listas.sub` | candado abierto | lucchetto aperto |
| `campanas.kpi.contratado` | Contratado vigente | Contrattato in corso |
| `campanas.kpi.contratado.sin-activas` | sin campañas activas | nessuna campagna attiva |
| `campanas.kpi.contratado.sin-presupuesto.uno` | {n} activa sin presupuesto capturado | {n} attiva senza budget inserito |
| `campanas.kpi.contratado.sin-presupuesto.otros` | {n} activas sin presupuesto capturado | {n} attive senza budget inserito |
| `campanas.kpi.contratado.sub` | de las campañas activas | delle campagne attive |
| `campanas.ficha.no-encontrada` | Campaña no encontrada. | Campagna non trovata. |
| `campanas.ficha.volver` | Volver a campañas | Torna alle campagne |
| `campanas.ficha.portal` | Portal del cliente | Portale del cliente |
| `campanas.ficha.ia.uno` | Esta campaña incluye {n} pantalla con IA · medición de audiencia (AdMobilize) | Questa campagna include {n} schermo con IA · misurazione dell’audience (AdMobilize) |
| `campanas.ficha.ia.otros` | Esta campaña incluye {n} pantallas con IA · medición de audiencia (AdMobilize) | Questa campagna include {n} schermi con IA · misurazione dell’audience (AdMobilize) |
| `campanas.ficha.creativos` | Creativos | Creatività |
| `campanas.ficha.creativos.sin` | Sin creativos | Nessuna creatività |
| `campanas.ficha.creativos.todos` | Todos aprobados | Tutte approvate |
| `campanas.ficha.creativos.por-aprobar` | Por aprobar | Da approvare |
| `campanas.ficha.creativos.gestionar` | Gestionar | Gestisci |
| `campanas.ficha.creativos.vacio` | Aún no hay creativos. Súbelos aquí mismo. | Ancora nessuna creatività. Caricale direttamente qui. |
| `campanas.ficha.pipeline` | Pipeline | Pipeline |
| `campanas.ficha.extensiones` | Extensiones | Estensioni |
| `campanas.ficha.candado` | Candado de facturación | Lucchetto di fatturazione |
| `campanas.ficha.comercial` | Comercial | Dati commerciali |
| `campanas.ficha.subtotal-neto` | Subtotal (neto) | Subtotale (netto) |
| `campanas.ficha.iva-pct` | IVA ({pct}%) | IVA ({pct}%) |
| `campanas.ficha.agencia` | Agencia | Agenzia |
| `campanas.ficha.directo` | Directo | Diretto |
| `campanas.ficha.oc-recibida` | OC recibida | OdA ricevuto |
| `campanas.ficha.si` | Sí | Sì |
| `campanas.ficha.no` | No | No |
| `campanas.ficha.facturacion` | Datos de facturación | Dati di fatturazione |
| `campanas.ficha.rentabilidad` | Rentabilidad | Redditività |
| `campanas.ficha.margen-pct` | Margen {pct}% | Margine {pct}% |
| `campanas.ficha.total-contratado` | Total contratado (cliente) | Totale contrattato (cliente) |
| `campanas.ficha.snapshot` | snapshot | snapshot |
| `campanas.ficha.snapshot.title` | Snapshot económico congelado en la aceptación — igual al total de la propuesta y de la factura (IVA incluido) | Snapshot economico congelato all’accettazione — uguale al totale della proposta e della fattura (IVA inclusa) |
| `campanas.ficha.ingreso` | Ingreso del medio (neto) | Ricavi del mezzo (netto) |
| `campanas.ficha.costo-espacios` | − Costo de espacios | − Costo degli spazi |
| `campanas.ficha.estimado` | estimado | stimato |
| `campanas.ficha.estimado.title` | Costo de compra interno estimado — no está ligado a un contrato de arrendador vigente | Costo d’acquisto interno stimato — non legato a un contratto di locazione vigente |
| `campanas.ficha.costo-impresion` | − Costo de impresión | − Costo di stampa |
| `campanas.ficha.costo-operacion` | − Costo de operación | − Costo operativo |
| `campanas.ficha.cumplimiento` | Reporte de cumplimiento | Report di erogazione |
| `campanas.ficha.entregado-pct` | {pct}% entregado | {pct}% erogato |
| `campanas.ficha.sitios-contratados` | Sitios contratados | Siti prenotati |
| `campanas.ficha.sitios-entregados` | Sitios entregados | Siti erogati |
| `campanas.ficha.testigos` | Testigos (fotos) | Foto di verifica |
| `campanas.ficha.dias-contratados` | Días contratados | Giorni prenotati |
| `campanas.ficha.orden-compra` | Orden de compra | Ordine d’acquisto |
| `campanas.ficha.folio-odc` | Folio ODC | Rif. interno OdA |
| `campanas.ficha.numero-oc` | Número de OC (cliente) | Numero OdA (cliente) |
| `campanas.ficha.documento` | Documento | Documento |
| `campanas.ficha.sitios` | Sitios de la campaña | Siti della campagna |
| `campanas.ficha.sitios.vacio` | Sin sitios asignados. | Nessun sito assegnato. |
| `campanas.ficha.imprenta` | Imprenta | Tipografia |
| `campanas.ficha.ots` | Órdenes de trabajo | Ordini di lavoro |
| `campanas.ficha.evidencias` | Evidencias fotográficas | Prove fotografiche |
| `campanas.ficha.reproducciones` | Reproducciones (proof of play) | Passaggi (proof of play) |
| `campanas.ficha.seccion.completo` | Completo | Completo |
| `campanas.ficha.seccion.no-aplica` | No aplica | Non applicabile |
| `campanas.ficha.seccion.expandir` | Expandir | Espandi |
| `campanas.resumen.entregado` | Entregado | Erogato |
| `campanas.resumen.candado` | Candado | Lucchetto |
| `campanas.resumen.ot` | OT | OdL |
| `campanas.resumen.ot.uno` | {n} abierta de {total} | {n} aperto su {total} |
| `campanas.resumen.ot.otros` | {n} abiertas de {total} | {n} aperti su {total} |
| `campanas.resumen.evidencias` | Evidencias | Prove |
| `campanas.menu.mostrar` | Mostrar el menú de campañas | Mostra il menu delle campagne |
| `campanas.menu.ocultar` | Ocultar el menú de campañas | Nascondi il menu delle campagne |
| `campanas.menu.titulo` | Campañas ({n}) | Campagne ({n}) |
| `campanas.menu.boton.mostrar` | Mostrar | Mostra |
| `campanas.menu.boton.ocultar` | Ocultar | Nascondi |
| `campanas.menu.otras` | Otras campañas | Altre campagne |
| `campanas.creativo.imagen-supera` | La imagen supera {mb} MB | L’immagine supera {mb} MB |
| `campanas.creativo.nombre-codigo` | Creativo (código) | Creatività (codice) |
| `campanas.creativo.agregado` | Creativo agregado | Creatività aggiunta |
| `campanas.creativo.no-subir` | No se pudo subir | Impossibile caricare |
| `campanas.creativo.imagen` | Imagen | Immagine |
| `campanas.creativo.codigo` | Código | Codice |
| `campanas.creativo.nombre` | Nombre del creativo | Nome della creatività |
| `campanas.creativo.pega` | Pega aquí el código del creativo (HTML/UTF)… | Incolla qui il codice della creatività (HTML/UTF)… |
| `campanas.creativo.vista-previa` | Vista previa | Anteprima |
| `campanas.creativo.vista-previa.titulo` | Vista previa del creativo | Anteprima della creatività |
| `campanas.creativo.subir` | Subir creativo | Carica creatività |
| `campanas.creativo.asi-se-vera` | Así se verá el creativo en la pantalla: | Ecco come apparirà la creatività sullo schermo: |
| `campanas.candado.no-registrar` | No se pudo registrar la OC | Impossibile registrare l’OdA |
| `campanas.candado.cerrado` | Cerrado: faltan condiciones por cumplir | Chiuso: mancano condizioni da soddisfare |
| `campanas.candado.oc` | Orden de compra recibida | Ordine d’acquisto ricevuto |
| `campanas.candado.fotos` | Fotografías comprobatorias | Foto di verifica |
| `campanas.candado.reporte` | Reporte de publicación | Report di pubblicazione |
| `campanas.candado.registrar.titulo` | Registrar OC del cliente | Registra l’OdA del cliente |
| `campanas.candado.numero` | Número de OC del cliente | Numero OdA del cliente |
| `campanas.candado.registrando` | Registrando… | Registrazione… |
| `campanas.candado.registrar` | Registrar OC | Registra OdA |
| `campanas.candado.monto-ilegible` | El monto no se entiende: la coma separa miles y el punto, decimales ({ejemplo}). | L’importo non si capisce: la virgola separa le migliaia e il punto i decimali ({ejemplo}). |
| `campanas.candado.precargados` | Número, monto y fecha vienen precargados de la campaña; ajústalos si el cliente dio otros. El documento de la OC es el contrato (se adjunta en “Datos de facturación”). | Numero, importo e data sono precompilati dalla campagna; modificali se il cliente ne ha indicati altri. Il documento dell’OdA è il contratto (si allega in «Dati di fatturazione»). |
| `campanas.candado.se-abre` | El candado se abre cuando se cumplen estas condiciones. | Il lucchetto si apre quando queste condizioni sono soddisfatte. |
| `campanas.doohmain-ahora.no-leer` | No se pudo leer el estado en DOOHmain | Impossibile leggere lo stato in DOOHmain |
| `campanas.doohmain-ahora.pausado` | “{nombre}” quedó en pausa en DOOHmain | «{nombre}» è in pausa in DOOHmain |
| `campanas.doohmain-ahora.reanudado` | “{nombre}” volvió al aire en DOOHmain | «{nombre}» è di nuovo in onda in DOOHmain |
| `campanas.doohmain-ahora.no-cambiar` | No se pudo cambiar en DOOHmain | Impossibile modificarlo in DOOHmain |
| `campanas.doohmain-ahora.titulo` | En DOOHmain ahora | In DOOHmain ora |
| `campanas.doohmain-ahora.preguntar` | Volver a preguntar a DOOHmain | Chiedi di nuovo a DOOHmain |
| `campanas.doohmain-ahora.sin-pantallas` | sin pantallas registradas | nessuno schermo registrato |
| `campanas.doohmain-ahora.sin-confirmar` | Sin confirmar | Non confermato |
| `campanas.doohmain-ahora.pausar` | Pausar | Metti in pausa |
| `campanas.doohmain-ahora.reanudar` | Reanudar | Riprendi |
| `campanas.doohmain-ahora.pausar.titulo` | Pausar en DOOHmain | Metti in pausa in DOOHmain |
| `campanas.doohmain-ahora.reanudar.titulo` | Reanudar en DOOHmain | Riprendi in DOOHmain |
| `campanas.doohmain-ahora.pausar.si` | Sí, pausar | Sì, metti in pausa |
| `campanas.doohmain-ahora.reanudar.si` | Sí, reanudar | Sì, riprendi |
| `campanas.doohmain-ahora.pausar.texto.uno` | {nombre} deja de reproducirse en {n} pantalla(s) de DOOHmain. El arte se queda en su lista y se puede reanudar cuando quieras. | La riproduzione di {nombre} si interrompe su {n} schermo di DOOHmain. La grafica resta nel suo elenco e si può riprendere quando vuoi. |
| `campanas.doohmain-ahora.pausar.texto.otros` | {nombre} deja de reproducirse en {n} pantalla(s) de DOOHmain. El arte se queda en su lista y se puede reanudar cuando quieras. | La riproduzione di {nombre} si interrompe su {n} schermi di DOOHmain. La grafica resta nel suo elenco e si può riprendere quando vuoi. |
| `campanas.doohmain-ahora.reanudar.texto` | {nombre} vuelve a reproducirse en DOOHmain con la programación que ya tenía. | La riproduzione di {nombre} riprende in DOOHmain con la programmazione che aveva già. |
| `campanas.facturacion.uso.g01` | G01 · Adquisición de mercancías | G01 · Acquisto di merci |
| `campanas.facturacion.uso.g03` | G03 · Gastos en general | G03 · Spese in generale |
| `campanas.facturacion.uso.p01` | P01 · Por definir | P01 · Da definire |
| `campanas.facturacion.adjuntado` | Contrato adjuntado | Contratto allegato |
| `campanas.facturacion.no-adjuntar` | No se pudo adjuntar | Impossibile allegare |
| `campanas.facturacion.sin-cliente` | Esta campaña no tiene cliente asignado. | Questa campagna non ha un cliente assegnato. |
| `campanas.facturacion.cliente` | Cliente | Cliente |
| `campanas.facturacion.razon-social` | Razón social | Ragione sociale |
| `campanas.facturacion.rfc` | RFC | RFC |
| `campanas.facturacion.regimen` | Régimen fiscal | Regime fiscale |
| `campanas.facturacion.cp` | CP fiscal | CAP fiscale |
| `campanas.facturacion.uso` | Uso CFDI | Uso CFDI |
| `campanas.facturacion.iva` | IVA | IVA |
| `campanas.facturacion.completa` | Completa RFC y razón social en {clientes} para poder facturar esta campaña. | Completa RFC e ragione sociale in {clientes} per poter fatturare questa campagna. |
| `campanas.facturacion.clientes` | Clientes | Clienti |
| `campanas.facturacion.contrato` | Contrato del cliente | Contratto del cliente |
| `campanas.facturacion.sin-contrato` | Sin contrato adjunto | Nessun contratto allegato |
| `campanas.facturacion.reemplazar` | Reemplazar contrato | Sostituisci contratto |
| `campanas.facturacion.subir` | Subir contrato (PDF) | Carica contratto (PDF) |
| `campanas.facturacion.listo` | Cliente listo para facturar | Cliente pronto per la fatturazione |
| `campanas.facturacion.faltan` | Faltan datos fiscales | Mancano dati fiscali |
| `campanas.facturacion.falta` | — falta — | — manca — |
| `campanas.evidencia.vacia` | Aún sin fotografías | Ancora nessuna foto |
| `campanas.evidencia.vacia.texto` | Las evidencias se suben al cerrar la OT móvil. | Le prove si caricano alla chiusura dell’OdL da mobile. |
| `campanas.evidencia.alt` | evidencia | prova |
| `campanas.evidencia.foto` | foto | foto |
| `campanas.evidencia.tomada` | Fecha de creación de la imagen | Data di creazione dell’immagine |
| `campanas.evidencia.subida` | Fecha de subida | Data di caricamento |
| `campanas.extender.pdf` | El contrato tiene que ser un PDF | Il contratto deve essere un PDF |
| `campanas.extender.no-extender` | No se pudo extender | Impossibile estendere |
| `campanas.extender.titulo` | Extender campaña | Estendi campagna |
| `campanas.extender.extendiendo` | Extendiendo… | Estensione in corso… |
| `campanas.extender.extender` | Extender | Estendi |
| `campanas.extender.fin` | Nueva fecha de fin | Nuova data di fine |
| `campanas.extender.contrato` | Contrato firmado de la extensión (PDF) | Contratto firmato dell’estensione (PDF) |
| `campanas.extender.quitar` | Quitar contrato | Rimuovi contratto |
| `campanas.extender.adjuntar` | Adjuntar contrato (PDF) | Allega contratto (PDF) |
| `campanas.extender.nota` | Sin el contrato firmado de la extensión no se puede extender. Queda en el expediente de la campaña junto con el folio del tramo nuevo; el contrato original del cliente no se toca. | Senza il contratto firmato dell’estensione non si può estendere. Resta nel fascicolo della campagna insieme al rif. interno del nuovo tratto; il contratto originale del cliente non si tocca. |
| `campanas.extensiones.termina` | Termina el {fecha}. Para alargarla hace falta el contrato firmado de la extensión. | Termina il {fecha}. Per prolungarla serve il contratto firmato dell’estensione. |
| `campanas.extensiones.vacio` | Sin extensiones con contrato. | Nessuna estensione con contratto. |
| `campanas.extensiones.hecha` | {nombre} extendida | {nombre} estesa |
| `campanas.horario.no-leer` | No se pudo leer el horario de transmisión | Impossibile leggere l’orario di trasmissione |
| `campanas.horario.no-programar` | No se pudo programar | Impossibile programmare |
| `campanas.horario.otra-franja` | otra franja | altra fascia oraria |
| `campanas.horario.todo-el-dia` | Todo el día | Tutto il giorno |
| `campanas.horario.titulo` | Horario de transmisión | Orario di trasmissione |
| `campanas.horario.vendida` | Vendida (no cambia aquí) | Venduta (non cambia qui) |
| `campanas.horario.se-transmite` | Se transmite en | Va in onda in |
| `campanas.horario.dada-de-baja` |  (dada de baja) |  (disattivata) |
| `campanas.horario.sin-franja` | Sin franja programada | Nessuna fascia oraria programmata |
| `campanas.horario.sin-permiso` | Solo el gerente de ventas, el director comercial y la dirección pueden cambiar el horario de transmisión. | Solo il responsabile vendite, il direttore commerciale e la direzione possono cambiare l’orario di trasmissione. |
| `campanas.horario.franja` | Franja de transmisión | Fascia oraria di trasmissione |
| `campanas.listas.sin-impresion` | Sin órdenes de impresión. | Nessun ordine di stampa. |
| `campanas.listas.sin-ot` | Sin órdenes de trabajo. | Nessun ordine di lavoro. |
| `campanas.listas.compromiso` | Fecha compromiso | Data prevista |
| `campanas.listas.vencida` | Vencida | Scaduto |
| `campanas.playlogs.no-consultar` | No se pudo consultar | Impossibile eseguire la richiesta |
| `campanas.playlogs.intro` | Cuántas veces se reprodujo el creativo en las pantallas digitales, según lo que reporta DOOHmain. Es la prueba que respalda lo que se le cobra al anunciante, así que se muestra exactamente lo que responde el proveedor. | Quante volte la creatività è passata sugli schermi digitali, secondo quanto riporta DOOHmain. È la prova che giustifica ciò che si addebita all’inserzionista, quindi si mostra esattamente ciò che risponde il fornitore. |
| `campanas.playlogs.no-publicada` | Esta campaña no está publicada en DOOHmain, así que no hay reproducciones que consultar. Las pantallas fijas se comprueban con las evidencias fotográficas. | Questa campagna non è pubblicata in DOOHmain, quindi non ci sono passaggi da consultare. Gli impianti statici si verificano con le prove fotografiche. |
| `campanas.playlogs.tab.campana` | De esta campaña | Di questa campagna |
| `campanas.playlogs.tab.pantallas` | Historial de sus pantallas | Storico dei suoi schermi |
| `campanas.playlogs.pantallas.texto` | Todo lo que DOOHmain registró en las pantallas donde se publicó esta campaña, día por día. Incluye otras campañas de esas pantallas: sirve para ver que estuvieron reproduciendo, pero {noCuenta} ni abre el candado de facturación. | Tutto ciò che DOOHmain ha registrato sugli schermi dove è stata pubblicata questa campagna, giorno per giorno. Include altre campagne di quegli schermi: serve a vedere che erano in riproduzione, ma {noCuenta} né apre il lucchetto di fatturazione. |
| `campanas.playlogs.pantallas.no-cuenta` | no cuenta como prueba de esta campaña | non vale come prova di questa campagna |
| `campanas.playlogs.desde` | Desde | Da |
| `campanas.playlogs.hasta` | Hasta | A |
| `campanas.playlogs.consultar` | Consultar a DOOHmain | Chiedi a DOOHmain |
| `campanas.playlogs.sin-consulta` | Aún no se ha consultado. Elige un rango y pregunta. | Non ancora consultato. Scegli un intervallo e chiedi. |
| `campanas.playlogs.rango` | {desde} a {hasta} | dal {desde} al {hasta} |
| `campanas.playlogs.fuente` | Fuente: DOOHmain · consultado {fecha} | Fonte: DOOHmain · consultato il {fecha} |
| `campanas.playlogs.vacio` | DOOHmain no reporta reproducciones en ese rango. | DOOHmain non riporta passaggi in quell’intervallo. |
| `campanas.playlogs.vacio.nota` | Es lo esperado mientras la campaña no haya salido al aire. Un cero aquí es lo que dice el proveedor, no una estimación nuestra. | È normale finché la campagna non è andata in onda. Uno zero qui è ciò che dice il fornitore, non una nostra stima. |
| `campanas.playlogs.con-datos.texto` | DOOHmain devolvió datos. Se muestran sin interpretar: todavía no hemos visto una respuesta con contenido, así que no se convierten en totales para no arriesgar números equivocados en la prueba de cobro. | DOOHmain ha restituito dati. Si mostrano senza interpretarli: non abbiamo ancora visto una risposta con contenuto, quindi non si trasformano in totali per non rischiare cifre sbagliate nella prova di addebito. |
| `campanas.playlogs.anteriores` | Consultas anteriores ({n}) | Richieste precedenti ({n}) |
| `campanas.playlogs.estado.error` | error | errore |
| `campanas.playlogs.estado.vacio` | sin reproducciones | nessun passaggio |
| `campanas.playlogs.estado.datos` | con datos | con dati |
| `campanas.doohmain.destino.otro-cms` | No va a DOOHmain: la opera otro CMS | Non va a DOOHmain: lo gestisce un altro CMS |
| `campanas.doohmain.destino.sin-pantalla` | Sin pantalla de DOOHmain asignada | Nessuno schermo di DOOHmain assegnato |
| `campanas.doohmain.dia.1` | Lun | Lun |
| `campanas.doohmain.dia.2` | Mar | Mar |
| `campanas.doohmain.dia.3` | Mié | Mer |
| `campanas.doohmain.dia.4` | Jue | Gio |
| `campanas.doohmain.dia.5` | Vie | Ven |
| `campanas.doohmain.dia.6` | Sáb | Sab |
| `campanas.doohmain.dia.0` | Dom | Dom |
| `campanas.doohmain.no-guardar` | No se pudo guardar | Impossibile salvare |
| `campanas.doohmain.no-leer` | No se pudo leer | Impossibile leggere |
| `campanas.doohmain.franja.programada` | Horario en DOOHmain: la franja programada | Orario in DOOHmain: la fascia oraria programmata |
| `campanas.doohmain.franja.contratada` | Horario en DOOHmain: la franja contratada | Orario in DOOHmain: la fascia oraria contrattata |
| `campanas.doohmain.franja.texto` | {nombre}, {inicio} a {fin}. La campaña ya tiene franja, así que no lleva otro horario. | {nombre}, {inicio}–{fin}. La campagna ha già una fascia oraria, quindi non prende un altro orario. |
| `campanas.doohmain.franja.ademas` | Tiene además un horario propio ({inicio} a {fin}), de antes, y es el que se manda: quítalo para que viaje la franja. | Ha anche un orario proprio ({inicio}–{fin}), precedente, ed è quello che viene inviato: rimuovilo perché venga inviata la fascia oraria. |
| `campanas.doohmain.quitar` | Quitar | Rimuovi |
| `campanas.doohmain.horario-campana` | Horario de la campaña: | Orario della campagna: |
| `campanas.doohmain.horario.titulo` | Horario de esta campaña en DOOHmain | Orario di questa campagna in DOOHmain |
| `campanas.doohmain.horario.de` | De | Dalle |
| `campanas.doohmain.horario.a` | a | alle |
| `campanas.doohmain.horario.inicio` | Hora de inicio | Ora di inizio |
| `campanas.doohmain.horario.fin` | Hora de fin | Ora di fine |
| `campanas.doohmain.horario.dias` | Días de la semana | Giorni della settimana |
| `campanas.doohmain.horario.nota` | Solo para campañas sin franja horaria. Sin días marcados, sale todos los días. | Solo per campagne senza fascia oraria. Senza giorni selezionati, va in onda tutti i giorni. |
| `campanas.doohmain.horario.guardar` | Guardar horario | Salva orario |
| `campanas.doohmain.titulo` | Lo que se manda a DOOHmain | Cosa viene inviato a DOOHmain |
| `campanas.doohmain.actualizar` | Actualizar | Aggiorna |
| `campanas.doohmain.apagada` | La publicación en DOOHmain está apagada en esta instancia: esto es lo que se mandaría. | La pubblicazione su DOOHmain è disattivata in questa istanza: ecco cosa verrebbe inviato. |
| `campanas.doohmain.cliente` | Cliente: | Cliente: |
| `campanas.doohmain.lista` |  · lista {lista} |  · elenco {lista} |
| `campanas.doohmain.sin-pantallas` | Esta campaña no tiene pantallas digitales que mandar. | Questa campagna non ha schermi digitali da inviare. |
| `campanas.doohmain.col.pantalla` | Pantalla | Schermo |
| `campanas.doohmain.col.creativo` | Creativo | Creatività |
| `campanas.doohmain.col.horario` | Horario | Orario |
| `campanas.doohmain.col.por-dia` | Por día | Al giorno |
| `campanas.doohmain.col.total` | Total campaña | Totale campagna |
| `campanas.doohmain.sin-creativo` | Sin creativo aprobado asignado: al publicar, esta pantalla no recibe nada. | Nessuna creatività approvata assegnata: alla pubblicazione, questo schermo non riceve nulla. |
| `campanas.doohmain.pie` | Del {inicio} al {fin}. Si la campaña tiene franja, DOOHmain reparte las del día dentro de ese horario. Un anuncio ya publicado no cambia de horario al volver a publicar. | Dal {inicio} al {fin}. Se la campagna ha una fascia oraria, DOOHmain distribuisce i passaggi del giorno dentro quell’orario. Un annuncio già pubblicato non cambia orario quando si ripubblica. |
| `campanas.validacion.aviso-pantalla` | Recuerda no estar en la pantalla dentro del sitio de DOOHmain para permitir el proceso: ciérrala allí antes de enviar o publicar. | Ricorda di non avere aperta la schermata nel sito di DOOHmain, perché il processo possa andare avanti: chiudila lì prima di inviare o pubblicare. |
| `campanas.validacion.no-enviar` | No se pudo enviar al dominio | Impossibile inviare per la pubblicazione |
| `campanas.validacion.motivo-prompt` | Motivo del rechazo (qué corregir en los anuncios): | Motivo del rifiuto (cosa correggere negli annunci): |
| `campanas.validacion.no-validar` | No se pudo validar la publicación | Impossibile convalidare la pubblicazione |
| `campanas.validacion.toast.ninguna` | Ninguna pantalla de esta campaña va a DOOHmain | Nessuno schermo di questa campagna va a DOOHmain |
| `campanas.validacion.toast.publicada.uno` | Publicada en DOOHmain: {n} pantalla(s) | Pubblicata in DOOHmain: {n} schermo |
| `campanas.validacion.toast.publicada.otros` | Publicada en DOOHmain: {n} pantalla(s) | Pubblicata in DOOHmain: {n} schermi |
| `campanas.validacion.toast.parcial.uno` | DOOHmain: {n} pantalla(s) con error | DOOHmain: {n} schermo con errore |
| `campanas.validacion.toast.parcial.otros` | DOOHmain: {n} pantalla(s) con error | DOOHmain: {n} schermi con errore |
| `campanas.validacion.toast.error` | No se publicó en DOOHmain | Non pubblicata in DOOHmain |
| `campanas.validacion.no-republicar` | No se pudo volver a publicar | Impossibile ripubblicare |
| `campanas.validacion.retirado.toast` | “{nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel | «{nombre}» è stata ritirata. La sua grafica è ancora in DOOHmain — rimuovila dal suo pannello |
| `campanas.validacion.bajado.toast` | “{nombre}” se bajó | «{nombre}» è stata rimossa |
| `campanas.validacion.no-bajar` | No se pudo bajar el creativo | Impossibile rimuovere la creatività |
| `campanas.validacion.titulo` | Validación de publicación | Convalida della pubblicazione |
| `campanas.validacion.enviada` | Enviada al dominio / CMS | Inviata per la pubblicazione / CMS |
| `campanas.validacion.anuncios` | Anuncios cargados ({validadas}/{total} validados) | Annunci caricati ({validadas}/{total} approvati) |
| `campanas.validacion.informacion` | Información de los anuncios | Informazioni sugli annunci |
| `campanas.validacion.retirado.title` | Retirado; su arte sigue en DOOHmain (quítalo en su panel) | Ritirata; la sua grafica è ancora in DOOHmain (rimuovila dal suo pannello) |
| `campanas.validacion.retirado` | Retirado | Ritirata |
| `campanas.validacion.bajar.title` | Bajar creativo (finaliza su campaña en DOOHmain) | Rimuovi la creatività (termina la sua campagna in DOOHmain) |
| `campanas.validacion.sello.aprobada` | Aprobada por {por} · {fecha} | Approvata da {por} · {fecha} |
| `campanas.validacion.sello.rechazada` | Rechazada por {por} · {fecha} | Rifiutata da {por} · {fecha} |
| `campanas.validacion.motivo` | Motivo: {motivo} | Motivo: {motivo} |
| `campanas.validacion.enviando` | Enviando… | Invio… |
| `campanas.validacion.corregir` | Corregir y reenviar al dominio | Correggi e invia di nuovo per la pubblicazione |
| `campanas.validacion.enviar` | Enviar al dominio | Invia per la pubblicazione |
| `campanas.validacion.aprobar` | Aprobar publicación | Approva la pubblicazione |
| `campanas.validacion.rechazar` | Rechazar | Rifiuta |
| `campanas.validacion.publicando` | Publicando… | Pubblicazione… |
| `campanas.validacion.republicar` | Volver a publicar en DOOHmain | Ripubblica in DOOHmain |
| `campanas.validacion.pendiente.sin` | Aprobar los creativos no los sube a DOOHmain. Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain al aprobar la publicación. | Approvare le creatività non le carica su DOOHmain. Invia la campagna per la pubblicazione e approvala qui: la grafica si pubblica in DOOHmain quando si approva la pubblicazione. |
| `campanas.validacion.pendiente.uno` | Aprobar los creativos no los sube a DOOHmain. Tienes {n} aprobado listo. Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain al aprobar la publicación. | Approvare le creatività non le carica su DOOHmain. Hai {n} creatività approvata pronta. Invia la campagna per la pubblicazione e approvala qui: la grafica si pubblica in DOOHmain quando si approva la pubblicazione. |
| `campanas.validacion.pendiente.otros` | Aprobar los creativos no los sube a DOOHmain. Tienes {n} aprobados listos. Envía la campaña al dominio y apruébala aquí: el arte se publica en DOOHmain al aprobar la publicación. | Approvare le creatività non le carica su DOOHmain. Hai {n} creatività approvate pronte. Invia la campagna per la pubblicazione e approvala qui: la grafica si pubblica in DOOHmain quando si approva la pubblicazione. |
| `campanas.validacion.bajar.titulo` | Bajar creativo | Rimuovi la creatività |
| `campanas.validacion.bajar.si` | Sí, bajar | Sì, rimuovi |
| `campanas.validacion.bajar.texto` | ¿Seguro que quieres bajar {nombre}? Si estaba publicado, su campaña se finaliza, pero {arte}(su API no lo permite): quedará marcado como “pendiente en DOOHmain”. | Vuoi davvero rimuovere {nombre}? Se era pubblicata, la sua campagna termina, ma {arte} (la sua API non lo consente): resterà segnata come «in sospeso in DOOHmain». |
| `campanas.validacion.bajar.arte` | el arte no se puede quitar de DOOHmain | la grafica non si può togliere da DOOHmain |
| `campanas.validacion.aprobar.titulo` | Aprobar y publicar en DOOHmain | Approva e pubblica in DOOHmain |
| `campanas.validacion.aprobar.si` | Sí, publicar | Sì, pubblica |
| `campanas.validacion.aprobar.texto` | Al aprobar, los anuncios se suben a DOOHmain. {noSe} (la API de DOOHmain no lo permite): cualquier cambio posterior deberá hacerse {manual}. ¿Continuar? | Con l’approvazione, gli annunci vengono caricati su DOOHmain. {noSe} (l’API di DOOHmain non lo consente): qualsiasi modifica successiva andrà fatta {manual}. Continuare? |
| `campanas.validacion.aprobar.no-se` | Una vez publicados no se pueden eliminar ni reemplazar desde el sistema | Una volta pubblicati non si possono eliminare né sostituire dal sistema |
| `campanas.validacion.aprobar.manual` | manualmente en el panel de DOOHmain | manualmente nel pannello di DOOHmain |
| `campanas.validacion.republicar.si` | Sí, volver a publicar | Sì, ripubblica |
| `campanas.validacion.republicar.texto` | Se manda otra vez a DOOHmain cada pantalla de la campaña con la pieza que tiene asignada {hoy}. Lo que ya está publicado no se duplica. La campaña no cambia de estado. | Ogni schermo della campagna viene inviato di nuovo a DOOHmain con la creatività che ha assegnata {hoy}. Ciò che è già pubblicato non si duplica. La campagna non cambia stato. |
| `campanas.validacion.republicar.hoy` | hoy | oggi |
| `campanas.validacion.resultado.publicada` | Publicada | Pubblicata |
| `campanas.validacion.resultado.ya-publicada` | Ya estaba publicada | Era già pubblicata |
| `campanas.validacion.resultado.otro-cms` | Se programa en su CMS | Si programma nel suo CMS |
| `campanas.validacion.resultado.apagada` | No se subió nada a DOOHmain: la publicación está apagada en esta instancia | Non è stato caricato nulla su DOOHmain: la pubblicazione è disattivata in questa istanza |
| `campanas.validacion.resultado.sin-pantallas` | No había pantallas digitales que subir a DOOHmain | Non c’erano schermi digitali da caricare su DOOHmain |
| `campanas.validacion.resultado.error-detalle` | No se publicó en DOOHmain: {error} | Non pubblicata in DOOHmain: {error} |
| `campanas.validacion.resultado.sin-detalle` | sin detalle | nessun dettaglio |
| `campanas.validacion.resultado.error` | No se publicó en ninguna pantalla de DOOHmain | Non pubblicata su nessuno schermo di DOOHmain |
| `campanas.validacion.resultado.parcial.uno` | Publicada en DOOHmain con {n} pantalla(s) con error | Pubblicata in DOOHmain con {n} schermo con errore |
| `campanas.validacion.resultado.parcial.otros` | Publicada en DOOHmain con {n} pantalla(s) con error | Pubblicata in DOOHmain con {n} schermi con errore |
| `campanas.validacion.resultado.todas-otro-cms` | Ninguna pantalla de esta campaña va a DOOHmain: todas usan otro CMS | Nessuno schermo di questa campagna va a DOOHmain: usano tutti un altro CMS |
| `campanas.validacion.resultado.ok` | Publicada en DOOHmain | Pubblicata in DOOHmain |
| `campanas.validacion.resultado.la-opera` | no va a DOOHmain: la opera {cms} | non va a DOOHmain: lo gestisce {cms} |
| `campanas.validacion.resultado.otro-cms-nombre` | otro CMS | un altro CMS |
| `campanas.validacion.resultado.sin-pantalla` | sin pantalla en DOOHmain | nessuno schermo in DOOHmain |

## `textos/finanzas.ts` · 170 claves

| clave | español | italiano |
|---|---|---|
| `finanzas.comun.ver-menos` | Ver menos | Mostra meno |
| `finanzas.comun.ver-todas` | Ver todas ({n}) | Mostra tutte ({n}) |
| `finanzas.comun.folio` | Folio | N. fattura |
| `finanzas.comun.folio-fiscal` | Folio fiscal | UUID CFDI |
| `finanzas.comun.cliente` | Cliente | Cliente |
| `finanzas.comun.monto` | Monto | Importo |
| `finanzas.comun.campana` | Campaña | Campagna |
| `finanzas.comun.la-emite` | La emite | Emessa da |
| `finanzas.comun.subtotal-neto` | Subtotal (neto) | Subtotale (netto) |
| `finanzas.comun.iva-pct` | IVA ({pct}%) | IVA ({pct}%) |
| `finanzas.comun.total` | Total | Totale |
| `finanzas.comun.dias` | {n} días | {n} giorni |
| `finanzas.comun.enviando` | Enviando… | Invio… |
| `finanzas.comun.todos-clientes` | Todos los clientes | Tutti i clienti |
| `finanzas.cobranza.al-corriente` | Al corriente | In regola |
| `finanzas.cobranza.por-vencer` | Por vencer | In scadenza |
| `finanzas.cobranza.vencida` | Vencida | Scaduta |
| `finanzas.cobranza.pagada` | Pagada | Pagata |
| `finanzas.parcialidad.quincenal` | {n} cuotas quincenales | {n} rate due volte al mese |
| `finanzas.parcialidad.mensual` | {n} cuotas mensuales | {n} rate mensili |
| `finanzas.parcialidad.bimestral` | {n} cuotas bimestrales | {n} rate ogni due mesi |
| `finanzas.parcialidad.trimestral` | {n} cuotas trimestrales | {n} rate trimestrali |
| `finanzas.parcialidad.semestral` | {n} cuotas semestrales | {n} rate ogni sei mesi |
| `finanzas.parcialidad.anual` | {n} cuotas anuales | {n} rate annuali |
| `finanzas.vence.pagada` | pagada | pagata |
| `finanzas.vence.vencida` | {n}d vencida | scaduta da {n} g |
| `finanzas.vence.dias` | {n}d | tra {n} g |
| `finanzas.titulo` | Finanzas | Finanza |
| `finanzas.subtitulo` | Facturación, cobranza y renta a arrendadores | Fatturazione, incassi e affitti ai locatori |
| `finanzas.recordatorio.enviado` | Recordatorio de cobro enviado | Sollecito di pagamento inviato |
| `finanzas.recordatorio.no-enviar` | No se pudo enviar el recordatorio | Impossibile inviare il sollecito |
| `finanzas.listas.titulo` | Listas para facturar | Pronte da fatturare |
| `finanzas.listas.vacio` | Nada por facturar ahora. Cuando una campaña complete su candado (OC + fotos + reporte) aparecerá aquí. | Niente da fatturare per ora. Quando una campagna completa il suo lucchetto (OdA + foto + report) apparirà qui. |
| `finanzas.listas.iva-inc` | {monto} · IVA inc. | {monto} · IVA incl. |
| `finanzas.listas.generar` | Generar factura | Genera fattura |
| `finanzas.listas.requiere` | Lista · requiere Finanzas | Pronta · richiede Finanza |
| `finanzas.cobranza.titulo` | Cobranza | Incassi |
| `finanzas.cobranza.cuotas` | Cuotas | Rate |
| `finanzas.cobranza.chip.vencidas` | Vencidas | Scadute |
| `finanzas.cobranza.chip.por-vencer` | Por vencer | In scadenza |
| `finanzas.cobranza.chip.al-corriente` | Al corriente | In regola |
| `finanzas.cobranza.vacia` | Sin facturas en cobranza. | Nessuna fattura in incasso. |
| `finanzas.cobranza.col.plazo` | Plazo | Termini di pagamento |
| `finanzas.cobranza.col.vence` | Vence | Scadenza |
| `finanzas.cobranza.col.estatus` | Estatus | Stato |
| `finanzas.cobranza.emite` | Emite: {entidad} | Emittente: {entidad} |
| `finanzas.cobranza.cuotas-pagadas` | {pagadas} de {total} cuotas pagadas | {pagadas} di {total} rate pagate |
| `finanzas.cobranza.cuota` | Cuota {n} de {total} | Rata {n} di {total} |
| `finanzas.cobranza.saldo` | saldo {monto} | saldo {monto} |
| `finanzas.cobranza.pagos` | Pagos y comprobantes | Pagamenti e prove di pagamento |
| `finanzas.cobranza.registrar-pago` | Registrar pago | Registra pagamento |
| `finanzas.cobranza.recordar` | Recordar | Sollecita |
| `finanzas.cobranza.ultimo` | Último: {fecha} | Ultimo: {fecha} |
| `finanzas.cobranza.enviados.uno` | {n} enviado | {n} inviato |
| `finanzas.cobranza.enviados.otros` | {n} enviados | {n} inviati |
| `finanzas.facturas.titulo` | Facturas | Fatture |
| `finanzas.facturas.chip.emitidas` | Emitidas | Emesse |
| `finanzas.facturas.chip.pagadas` | Pagadas | Pagate |
| `finanzas.facturas.chip.anuladas` | Anuladas | Annullate |
| `finanzas.facturas.vacio.titulo` | Todavía no hay facturas | Ancora nessuna fattura |
| `finanzas.facturas.vacio.texto` | Aquí aparecerán en cuanto emitas la primera desde «Listas para facturar». | Appariranno qui non appena emetterai la prima da «Pronte da fatturare». |
| `finanzas.facturas.col.emitida` | Emitida | Emessa |
| `finanzas.facturas.ver` | Ver el comprobante | Vedi la ricevuta di pagamento |
| `finanzas.facturas.estatus.pagada` | Pagada | Pagata |
| `finanzas.facturas.estatus.anulada` | Anulada | Annullata |
| `finanzas.facturas.estatus.emitida` | Emitida | Emessa |
| `finanzas.renta.titulo` | Renta por pagar a propietarios | Affitti da pagare ai locatori |
| `finanzas.factura.generada` | Factura generada | Fattura generata |
| `finanzas.factura.no-generar` | No se pudo generar la factura | Impossibile generare la fattura |
| `finanzas.factura.titulo` | Generar factura | Genera fattura |
| `finanzas.factura.confirmar` | Confirmar y emitir | Conferma ed emetti |
| `finanzas.factura.generando` | Generando… | Generazione… |
| `finanzas.factura.emitir` | Emitir factura | Emetti fattura |
| `finanzas.factura.emisora` | Con cuál de tus razones sociales se emite | Con quale delle tue ragioni sociali viene emessa |
| `finanzas.factura.la-que-vende` |  — la que vende |  — quella che vende |
| `finanzas.factura.sin-entidades` | Todavía no tienes razones sociales capturadas. Se dan de alta en Razones sociales; la factura se emite igual y queda «sin asignar». | Non hai ancora inserito ragioni sociali. Si registrano in Ragioni sociali; la fattura viene emessa comunque e resta «non assegnata». |
| `finanzas.factura.sin-elegir` | Sin elegir, el comprobante queda «sin asignar». No se inventa: hay más de una razón social que vende, o ninguna la tiene marcada. | Se non ne scegli una, la ricevuta resta «non assegnata». Non si tira a indovinare: c’è più di una ragione sociale che vende, oppure nessuna è contrassegnata. |
| `finanzas.factura.dura.uno` | Esta campaña dura {n} mes: no admite un reparto en cuotas iguales, así que se cobra en una sola exhibición. | Questa campagna dura {n} mese: non ammette una ripartizione in rate uguali, quindi si incassa in un’unica soluzione. |
| `finanzas.factura.dura.otros` | Esta campaña dura {n} meses: no admite un reparto en cuotas iguales, así que se cobra en una sola exhibición. | Questa campagna dura {n} mesi: non ammette una ripartizione in rate uguali, quindi si incassa in un’unica soluzione. |
| `finanzas.factura.en-cuotas` | Cobrar en parcialidades | Incassa a rate |
| `finanzas.factura.campana-de.uno` | · campaña de {n} mes | · campagna di {n} mese |
| `finanzas.factura.campana-de.otros` | · campaña de {n} meses | · campagna di {n} mesi |
| `finanzas.factura.cuotas` | Cuotas | Rate |
| `finanzas.factura.primer-venc` | Primer vencimiento | Prima scadenza |
| `finanzas.factura.reparto` | {n} cuotas de {monto} (la última ajusta el redondeo) · suman {total} | {n} rate da {monto} (l’ultima assorbe l’arrotondamento) · totale {total} |
| `finanzas.factura.plazo` | Plazo de cobranza | Termini di pagamento |
| `finanzas.factura.plazo.informativo` | Plazo de cobranza (informativo con parcialidades) | Termini di pagamento (indicativi con le rate) |
| `finanzas.pago.liquidada` | Cobranza liquidada | Incasso saldato |
| `finanzas.pago.abono-registrado` | Abono registrado | Acconto registrato |
| `finanzas.pago.no-registrar` | No se pudo registrar el pago | Impossibile registrare il pagamento |
| `finanzas.pago.titulo` | Registrar pago | Registra pagamento |
| `finanzas.pago.subtitulo` | {folio} · saldo {saldo} | {folio} · saldo {saldo} |
| `finanzas.pago.confirmar` | Confirmar y registrar | Conferma e registra |
| `finanzas.pago.liquidar` | Liquidar total | Salda il totale |
| `finanzas.pago.guardando` | Guardando… | Salvataggio… |
| `finanzas.pago.registrar-abono` | Registrar abono | Registra acconto |
| `finanzas.pago.monto` | Monto del abono | Importo dell’acconto |
| `finanzas.pago.fecha` | Fecha en que se recibió | Data di ricezione |
| `finanzas.pago.excede` | ⚠ El monto excede el saldo ({saldo}). Solo se aplicará el saldo pendiente. | ⚠ L’importo supera il saldo ({saldo}). Verrà applicato solo il saldo residuo. |
| `finanzas.pago.al-cubrir` | Al cubrir el saldo total, la cobranza pasa a {pagada} y se detienen los recordatorios. | Coprendo l’intero saldo, l’incasso passa a {pagada} e i solleciti si fermano. |
| `finanzas.pago.pagada` | Pagada | Pagata |
| `finanzas.comprobante-pago.tipo` | Debe ser un PDF o una imagen (PNG, JPG o WebP) | Deve essere un PDF o un’immagine (PNG, JPG o WebP) |
| `finanzas.comprobante-pago.supera` | El archivo supera {mb} MB | Il file supera {mb} MB |
| `finanzas.comprobante-pago.no-leer` | No se pudo leer el archivo | Impossibile leggere il file |
| `finanzas.comprobante-pago.titulo` | Comprobante de pago | Prova di pagamento |
| `finanzas.comprobante-pago.quitar` | Quitar | Rimuovi |
| `finanzas.comprobante-pago.adjuntar` | Adjuntar PDF o imagen | Allega PDF o immagine |
| `finanzas.pagos.no-cargar` | No se pudieron cargar los pagos | Impossibile caricare i pagamenti |
| `finanzas.pagos.no-guardar` | No se pudo guardar el comprobante | Impossibile salvare la prova di pagamento |
| `finanzas.pagos.titulo` | Pagos recibidos | Pagamenti ricevuti |
| `finanzas.pagos.vacio` | Esta cobranza aún no tiene pagos registrados. | Questo incasso non ha ancora pagamenti registrati. |
| `finanzas.pagos.sin-fecha` | Sin fecha | Senza data |
| `finanzas.pagos.historico` |  · cobrado antes del 08/10 (aproximado) |  · incassato prima dell’8 ott (approssimativo) |
| `finanzas.pagos.comprobante` | Comprobante | Prova di pagamento |
| `finanzas.pagos.sin-comprobante` | Sin comprobante | Nessuna prova di pagamento |
| `finanzas.pagos.subiendo` | Subiendo… | Caricamento… |
| `finanzas.pagos.reemplazar` | Reemplazar | Sostituisci |
| `finanzas.pagos.adjuntar` | Adjuntar | Allega |
| `finanzas.estado-cuenta.no-calcular` | No se pudo calcular el estado de cuenta | Impossibile calcolare l’estratto conto |
| `finanzas.estado-cuenta.titulo` | Estado de cuenta | Estratto conto |
| `finanzas.estado-cuenta.mes` | Mes | Mese |
| `finanzas.estado-cuenta.saldo-inicio` | Saldo al inicio | Saldo iniziale |
| `finanzas.estado-cuenta.facturado` | + Facturado | + Fatturato |
| `finanzas.estado-cuenta.cobrado` | − Cobrado | − Incassato |
| `finanzas.estado-cuenta.saldo-cierre` | = Saldo al cierre | = Saldo finale |
| `finanzas.estado-cuenta.vencido-al` | Vencido al {fecha} | Scaduto al {fecha} |
| `finanzas.estado-cuenta.vacio` | Sin facturas ni pagos en {periodo}. | Nessuna fattura né pagamento in {periodo}. |
| `finanzas.estado-cuenta.vacio-rango` | Sin facturas ni pagos del {desde} al {hasta}. | Nessuna fattura né pagamento dal {desde} al {hasta}. |
| `finanzas.estado-cuenta.col.fecha` | Fecha | Data |
| `finanzas.estado-cuenta.col.movimiento` | Movimiento | Movimento |
| `finanzas.estado-cuenta.col.cargo` | Cargo | Addebito |
| `finanzas.estado-cuenta.col.abono` | Abono | Accredito |
| `finanzas.estado-cuenta.col.saldo` | Saldo | Saldo |
| `finanzas.estado-cuenta.factura` | Factura | Fattura |
| `finanzas.estado-cuenta.pago` | Pago recibido | Pagamento ricevuto |
| `finanzas.estado-cuenta.aproximada.title` | Pago anterior a que el sistema guardara fechas: lleva la fecha de su factura | Pagamento precedente al salvataggio delle date nel sistema: porta la data della sua fattura |
| `finanzas.estado-cuenta.aproximada` | fecha aproximada | data approssimativa |
| `finanzas.csv.periodo` | Periodo | Periodo |
| `finanzas.csv.saldo-cierre` | Saldo al cierre | Saldo finale |
| `finanzas.csv.pago-aproximado` | Pago recibido (fecha aproximada) | Pagamento ricevuto (data approssimativa) |
| `finanzas.csv.archivo` | estado-de-cuenta | estratto-conto |
| `finanzas.csv.archivo.cliente` | cliente | cliente |
| `finanzas.periodo.no-calcular` | No se pudo calcular el periodo | Impossibile calcolare il periodo |
| `finanzas.periodo.titulo` | Resumen del periodo | Riepilogo del periodo |
| `finanzas.periodo.subtitulo` | {etiqueta} · {desde} a {hasta} | {etiqueta} · dal {desde} al {hasta} |
| `finanzas.periodo.por-cobrar` | Por cobrar al cierre | Da incassare alla chiusura |
| `finanzas.periodo.al-inicio` | al inicio: {monto} | all’inizio: {monto} |
| `finanzas.periodo.vencido` | Vencido | Scaduto |
| `finanzas.periodo.vencido.sub.uno` | {n} factura al {fecha} | {n} fattura al {fecha} |
| `finanzas.periodo.vencido.sub.otros` | {n} facturas al {fecha} | {n} fatture al {fecha} |
| `finanzas.periodo.facturado` | Facturado | Fatturato |
| `finanzas.periodo.facturas.uno` | {n} factura | {n} fattura |
| `finanzas.periodo.facturas.otros` | {n} facturas | {n} fatture |
| `finanzas.periodo.cobrado` | Cobrado | Incassato |
| `finanzas.periodo.cobrado.sub` | pagos recibidos en el periodo | pagamenti ricevuti nel periodo |
| `finanzas.periodo.renta` | Renta a propietarios | Affitti ai locatori |
| `finanzas.periodo.renta.pagada` | Pagada {monto} | Pagati {monto} |
| `finanzas.periodo.renta.por-pagar` | Por pagar del periodo {monto} | Da pagare nel periodo {monto} |
| `finanzas.periodo.sin-fecha` | {monto} de lo cobrado son pagos de antes de que el sistema guardara la fecha de cada pago: se fecharon con la fecha de su factura, así que su mes es aproximado. | {monto} dell’incassato sono pagamenti precedenti al salvataggio nel sistema della data di ogni pagamento: sono stati datati con la data della loro fattura, quindi il loro mese è approssimativo. |
| `finanzas.comprobante.titulo` | Comprobante {folio} | Ricevuta di pagamento {folio} |
| `finanzas.comprobante.cerrar` | Cerrar | Chiudi |
| `finanzas.comprobante.imprimir` | Imprimir | Stampa |
| `finanzas.comprobante.la-recibe` | La recibe | Intestata a |
| `finanzas.comprobante.uso` | Uso: {uso} | Uso CFDI: {uso} |
| `finanzas.comprobante.serie` | Serie | Serie |
| `finanzas.comprobante.fecha` | Fecha de emisión | Data di emissione |
| `finanzas.comprobante.subtotal` | Subtotal | Subtotale |
| `finanzas.comprobante.iva` | IVA | IVA |
| `finanzas.comprobante.no-cuadra` | Los importes de este comprobante no cuadran: el subtotal más el IVA no da el total. Revísalo antes de entregarlo. | Gli importi di questa ricevuta non quadrano: il subtotale più l’IVA non dà il totale. Controllala prima di consegnarla. |
| `finanzas.comprobante.aviso` | Comprobante de pago. NO es un CFDI timbrado ante el SAT: el timbrado se emite por separado y este documento no sustituye al comprobante fiscal. | Ricevuta di pagamento. NON è un CFDI timbrato presso il SAT: il CFDI timbrato si emette a parte e questo documento non sostituisce la fattura fiscale. |

## `textos/clientes.ts` · 220 claves

| clave | español | italiano |
|---|---|---|
| `clientes.titulo` | Clientes | Clienti |
| `clientes.subtitulo` | Catálogo de clientes y sus datos fiscales | Anagrafica dei clienti e dei loro dati fiscali |
| `clientes.nuevo` | Nuevo cliente | Nuovo cliente |
| `clientes.vacia` | Aún no hay clientes. | Ancora nessun cliente. |
| `clientes.vacia.alta` |  Da de alta el primero con «Nuevo cliente». |  Registra il primo con «Nuovo cliente». |
| `clientes.lista.titulo` | Lista de clientes | Elenco clienti |
| `clientes.lista.de` | {n} de {total} | {n} di {total} |
| `clientes.lista.cliente.uno` | cliente | cliente |
| `clientes.lista.cliente.otros` | clientes | clienti |
| `clientes.lista.buscar` | Buscar cliente | Cerca cliente |
| `clientes.lista.buscar.ejemplo` | Nombre, RFC o razón social… | Nome, RFC o ragione sociale… |
| `clientes.lista.tipo` | Tipo de cliente | Tipo di cliente |
| `clientes.lista.tipo.todos` | Directos y agencias | Diretti e agenzie |
| `clientes.lista.tipo.directos` | Solo directos | Solo diretti |
| `clientes.lista.tipo.agencias` | Solo agencias | Solo agenzie |
| `clientes.col.cliente` | Cliente | Cliente |
| `clientes.col.rfc` | RFC | RFC |
| `clientes.col.razon-social` | Razón social | Ragione sociale |
| `clientes.col.tipo` | Tipo | Tipo |
| `clientes.col.pipeline` | En pipeline | In pipeline |
| `clientes.col.en-curso` | Campañas en curso | Campagne in corso |
| `clientes.col.contacto` | Contacto | Contatto |
| `clientes.filtro.ninguno` | Ningún cliente coincide{busqueda}{tipo}. Quita el filtro para ver los {n}. | Nessun cliente corrisponde{busqueda}{tipo}. Rimuovi il filtro per vedere tutti i {n}. |
| `clientes.filtro.con` |  con «{texto}» |  a «{texto}» |
| `clientes.filtro.entre-agencias` |  entre las agencias |  tra le agenzie |
| `clientes.filtro.entre-directos` |  entre los directos |  tra i diretti |
| `clientes.ver-ficha` | Ver pipeline y campañas | Vedi pipeline e campagne |
| `clientes.tipo.agencia` | Agencia | Agenzia |
| `clientes.tipo.directo` | Directo | Diretto |
| `clientes.negociacion.validada` | Negociación validada | Negoziazione convalidata |
| `clientes.negociacion.sin-validar` | Negociación sin validar | Negoziazione non convalidata |
| `clientes.negociacion.bloquea` | Mientras no esté validada, no se pueden crear ni aprobar propuestas con esta agencia. | Finché non è convalidata, non si possono creare né approvare proposte con questa agenzia. |
| `clientes.pipeline.titulo-fila` | Borrador + enviadas, con IVA | Bozza + inviate, IVA inclusa |
| `clientes.sin-contacto` | Sin contacto | Nessun contatto |
| `clientes.editar.nombre` | Editar {nombre} | Modifica {nombre} |
| `clientes.editar` | Editar cliente | Modifica cliente |
| `clientes.borrar.nombre` | Borrar {nombre} | Elimina {nombre} |
| `clientes.borrar` | Borrar cliente | Elimina cliente |
| `clientes.borrar.no-se-pudo` | No se pudo borrar el cliente | Impossibile eliminare il cliente |
| `clientes.borrar.subtitulo` | Esta acción no se puede deshacer | Questa azione non si può annullare |
| `clientes.borrar.borrando` | Borrando… | Eliminazione… |
| `clientes.borrar.confirmar` | Confirmar y borrar | Conferma ed elimina |
| `clientes.borrar.de-todos-modos` | Borrar de todos modos | Elimina comunque |
| `clientes.borrar.boton` | Borrar | Elimina |
| `clientes.borrar.irreversible` | Borrar un cliente es irreversible, así que hace falta tu contraseña. | Eliminare un cliente è irreversibile, quindi serve la tua password. |
| `clientes.borrar.se-borrara` | Se borrará {nombre}{rfc}. | Verrà eliminato {nombre}{rfc}. |
| `clientes.form.rfc-invalido` | RFC inválido. Formato SAT (p. ej. XAXX010101000) | RFC non valido. Formato SAT (es. XAXX010101000) |
| `clientes.form.cp-invalido` | Código postal inválido (5 dígitos) | CAP non valido (5 cifre) |
| `clientes.form.telefono-invalido` | Teléfono inválido. Escribe 10 dígitos (p. ej. 55 1234 5678) | Telefono non valido. Inserisci 10 cifre (es. 55 1234 5678) |
| `clientes.form.revisa` | Revisa los campos marcados. | Controlla i campi evidenziati. |
| `clientes.form.no-se-pudo-guardar` | No se pudo guardar | Impossibile salvare |
| `clientes.form.subtitulo` | Datos generales y fiscales (para facturar) | Dati generali e fiscali (per fatturare) |
| `clientes.form.nombre` | Nombre del cliente | Nome del cliente |
| `clientes.form.tipo` | Tipo | Tipo |
| `clientes.form.correo` | Correo de contacto | Email di contatto |
| `clientes.form.correo.ejemplo` | cuentas@cliente.com | contabilita@cliente.com |
| `clientes.form.telefono` | Teléfono | Telefono |
| `clientes.form.comision` | Comisión de la agencia (%) | Commissione dell’agenzia (%) |
| `clientes.form.iva` | IVA (%) | IVA (%) |
| `clientes.form.iva.ayuda` | Se elige del catálogo de IVAs (Administración → Configuración). Se aplica al facturar y al presupuesto de sus campañas. | Si sceglie dal catalogo delle aliquote IVA (Impostazioni → Configurazione). Si applica in fattura e al budget delle sue campagne. |
| `clientes.form.negociacion` | Negociación con la agencia | Negoziazione con l’agenzia |
| `clientes.form.hay-negociacion` | ¿Hay negociación con la agencia? | C’è una negoziazione con l’agenzia? |
| `clientes.form.terminos` | Términos de la negociación | Termini della negoziazione |
| `clientes.form.terminos.ejemplo` | p. ej. comisión especial 18%, condiciones de pago a 60 días… | es. commissione speciale del 18%, pagamento a 60 giorni… |
| `clientes.form.fiscales` | Datos fiscales | Dati fiscali |
| `clientes.form.cp` | C.P. fiscal | CAP fiscale |
| `clientes.form.regimen` | Régimen fiscal | Regime fiscale |
| `clientes.form.uso-cfdi` | Uso de CFDI | Uso del CFDI |
| `clientes.form.selecciona` | — Selecciona — | — Seleziona — |
| `clientes.ficha.subtitulo` | {tipo}{rfc} · pipeline y campañas | {tipo}{rfc} · pipeline e campagne |
| `clientes.pipeline.titulo` | Pipeline | Pipeline |
| `clientes.pipeline.resumen` | Montos con IVA · en pipeline {valor} · tasa de cierre histórica {tasa} | Importi IVA inclusa · in pipeline {valor} · tasso di chiusura storico {tasa} |
| `clientes.pipeline.sin-capturar` | monto sin capturar | importo non inserito |
| `clientes.pipeline.sin-monto` | —, sin monto | —, senza importo |
| `clientes.pipeline.fuera` | Fuera del embudo: {rechazadas} ({monto}) · {canceladas} | Fuori dal funnel: {rechazadas} ({monto}) · {canceladas} |
| `clientes.pipeline.rechazadas.uno` | {n} propuesta rechazada | {n} proposta rifiutata |
| `clientes.pipeline.rechazadas.otros` | {n} propuestas rechazadas | {n} proposte rifiutate |
| `clientes.pipeline.canceladas.uno` | {n} campaña cancelada | {n} campagna annullata |
| `clientes.pipeline.canceladas.otros` | {n} campañas canceladas | {n} campagne annullate |
| `clientes.pipeline.etapa.borrador` | Borrador | Bozza |
| `clientes.pipeline.etapa.enviada` | Enviada | Inviata |
| `clientes.pipeline.etapa.aprobada` | Aprobada | Approvata |
| `clientes.pipeline.etapa.en-curso` | Campaña en curso | Campagna in corso |
| `clientes.pipeline.etapa.terminada` | Terminada | Terminata |
| `clientes.campanas.titulo` | Campañas | Campagne |
| `clientes.campanas.vacia` | Este cliente aún no tiene campañas. | Questo cliente non ha ancora campagne. |
| `clientes.campanas.sin-presupuesto` | Sin presupuesto | Senza budget |
| `clientes.comisiones.titulo` | Comisiones | Commissioni |
| `clientes.comisiones.subtitulo` | Ajusta la comisión por agencia y la agencia asignada a cada cliente. | Regola la commissione di ogni agenzia e l’agenzia assegnata a ogni cliente. |
| `clientes.comisiones.chip.agencias` | Agencias | Agenzie |
| `clientes.comisiones.chip.sin-validar` | Negociación sin validar | Negoziazione non convalidata |
| `clientes.comisiones.chip.sin-validar.ayuda` | Sin validar, no se pueden crear ni aprobar propuestas con esa agencia | Senza convalida non si possono creare né approvare proposte con quell’agenzia |
| `clientes.comisiones.chip.sin-agencia` | Clientes sin agencia | Clienti senza agenzia |
| `clientes.comisiones.agencias.titulo` | Agencias y su comisión | Agenzie e la loro commissione |
| `clientes.comisiones.nueva` | Nueva agencia | Nuova agenzia |
| `clientes.comisiones.agencias.vacia` | Aún no hay agencias | Ancora nessuna agenzia |
| `clientes.comisiones.agencias.vacia.crear` | Usa «Nueva agencia» para crear una. | Usa «Nuova agenzia» per crearne una. |
| `clientes.comisiones.agencias.vacia.esperar` | Cuando se dé de alta una agencia aparecerá aquí. | Quando verrà registrata un’agenzia, apparirà qui. |
| `clientes.comisiones.col.agencia` | Agencia | Agenzia |
| `clientes.comisiones.col.comision` | Comisión | Commissione |
| `clientes.comisiones.col.negociacion` | Negociación | Negoziazione |
| `clientes.comisiones.col.clientes` | Clientes | Clienti |
| `clientes.comisiones.clientes.titulo` | Clientes y su agencia | Clienti e la loro agenzia |
| `clientes.comisiones.clientes.vacia` | No hay clientes directos | Non ci sono clienti diretti |
| `clientes.comisiones.col.cliente` | Cliente | Cliente |
| `clientes.comisiones.col.aplicada` | Comisión aplicada | Commissione applicata |
| `clientes.comisiones.no-se-pudo-crear` | No se pudo crear la agencia | Impossibile creare l’agenzia |
| `clientes.comisiones.nueva.subtitulo` | Alta de cliente tipo Agencia con su comisión | Registrazione di un cliente di tipo Agenzia con la sua commissione |
| `clientes.comisiones.crear` | Crear agencia | Crea agenzia |
| `clientes.comisiones.nombre` | Nombre de la agencia | Nome dell’agenzia |
| `clientes.comisiones.nombre.ejemplo` | p. ej. Andina Media | es. Andina Media |
| `clientes.comisiones.terminos.ejemplo` | Términos negociados (comisión especial, condiciones de pago…) | Termini negoziati (commissione speciale, condizioni di pagamento…) |
| `clientes.comisiones.validada.ayuda` | Sin validar, no se pueden crear ni aprobar propuestas con esta agencia. | Senza convalida non si possono creare né approvare proposte con questa agenzia. |
| `clientes.comisiones.comision-de` | Comisión de {nombre} (%) | Commissione di {nombre} (%) |
| `clientes.comisiones.sin-negociacion` | Sin negociación | Nessuna negoziazione |
| `clientes.comisiones.validada` | Validada | Convalidata |
| `clientes.comisiones.quitar` | Quitar | Rimuovi |
| `clientes.comisiones.sin-validar` | Sin validar | Non convalidata |
| `clientes.comisiones.validar` | Validar | Convalida |
| `clientes.comisiones.no-se-pudo-asignar` | No se pudo asignar | Impossibile assegnare |
| `clientes.comisiones.selecciona-agencia` | — Selecciona agencia — | — Seleziona agenzia — |
| `clientes.comisiones.sin-agencia` | Cliente sin agencia asignada | Cliente senza agenzia assegnata |
| `clientes.comisiones.directo-sin-comision` | Directo · sin comisión | Diretto · senza commissione |
| `clientes.captacion.titulo` | Captación | Acquisizione |
| `clientes.captacion.subtitulo` | Clientes, arrendadores, predios y pantallas que se están trabajando, con la bitácora de cada uno. Cuando uno está listo se envía a revisión, y al aprobarlo se da de alta. | Clienti, locatori, immobili e impianti in lavorazione, ciascuno con il proprio registro. Quando uno è pronto si invia in revisione e, una volta approvato, viene registrato. |
| `clientes.captacion.vista.curso` | En curso | In corso |
| `clientes.captacion.vista.revision` | Por aprobar | Da approvare |
| `clientes.captacion.vista.cerrados` | Cerrados | Chiusi |
| `clientes.captacion.vista.todos` | Todos | Tutti |
| `clientes.captacion.tipo.cliente` | Cliente | Cliente |
| `clientes.captacion.tipo.arrendador` | Arrendador | Locatore |
| `clientes.captacion.tipo.predio` | Predio | Immobile |
| `clientes.captacion.tipo.pantalla` | Pantalla | Impianto |
| `clientes.captacion.campo.rfc` | RFC | RFC |
| `clientes.captacion.campo.razon-social` | Razón social | Ragione sociale |
| `clientes.captacion.campo.giro` | Giro | Settore |
| `clientes.captacion.campo.presupuesto` | Presupuesto estimado ({moneda}) | Budget stimato ({moneda}) |
| `clientes.captacion.campo.tipo-ubicacion` | Tipo de ubicación (azotea, terreno…) | Tipo di ubicazione (tetto, terreno…) |
| `clientes.captacion.campo.m2` | Metros cuadrados | Metri quadrati |
| `clientes.captacion.campo.renta` | Renta que piden ({moneda} / mes) | Affitto richiesto ({moneda} / mese) |
| `clientes.captacion.campo.tipo-pantalla` | Tipo | Tipo |
| `clientes.captacion.campo.ancho` | Ancho (m) | Larghezza (m) |
| `clientes.captacion.campo.alto` | Alto (m) | Altezza (m) |
| `clientes.captacion.campo.caras` | Caras | Facce |
| `clientes.captacion.estatica` | Estática | Statico |
| `clientes.captacion.digital` | Digital | Digitale |
| `clientes.captacion.form.que-captas` | ¿Qué estás captando? | Cosa stai acquisendo? |
| `clientes.captacion.form.tipo-fijo` | El tipo no se cambia: decide qué registro se crea al aprobar. | Il tipo non si cambia: decide quale record si crea all’approvazione. |
| `clientes.captacion.form.nombre` | Nombre | Nome |
| `clientes.captacion.form.nombre.empresa` | Empresa o marca | Azienda o marchio |
| `clientes.captacion.form.nombre.ubicacion` | Nombre de la ubicación | Nome dell’ubicazione |
| `clientes.captacion.form.dueno` | Dueño del terreno (se dará de alta como arrendador al aprobar) | Proprietario del terreno (verrà registrato come locatore all’approvazione) |
| `clientes.captacion.form.contacto` | Contacto | Contatto |
| `clientes.captacion.form.contacto.nombre` | Nombre del contacto | Nome del contatto |
| `clientes.captacion.form.telefono` | Teléfono | Telefono |
| `clientes.captacion.form.correo` | Correo | Email |
| `clientes.captacion.form.direccion` | Dirección | Indirizzo |
| `clientes.captacion.form.notas` | Notas | Note |
| `clientes.captacion.form.siguiente` | Siguiente paso | Prossimo passo |
| `clientes.captacion.form.siguiente.ejemplo` | Ej. llamar para agendar visita | Es. chiamare per fissare una visita |
| `clientes.captacion.form.para-cuando` | ¿Para cuándo? | Entro quando? |
| `clientes.captacion.form.primera-nota` | Primera nota de la bitácora | Prima nota del registro |
| `clientes.captacion.form.primera-nota.ejemplo` | Cómo surgió este prospecto | Com’è nato questo prospect |
| `clientes.captacion.falta.contacto` | un teléfono o un correo de contacto | un telefono o un’email di contatto |
| `clientes.captacion.falta.direccion` | la dirección | l’indirizzo |
| `clientes.captacion.falta.dueno` | el dueño: un arrendador existente o el nombre y teléfono del contacto | il proprietario: un locatore esistente o il nome e il telefono del contatto |
| `clientes.captacion.para-revision` | Para enviarlo a revisión falta: {faltan} | Per inviarlo in revisione manca ancora: {faltan} |
| `clientes.captacion.para-revision.punto` | Para enviarlo a revisión falta: {faltan}. | Per inviarlo in revisione manca ancora: {faltan}. |
| `clientes.captacion.error.avance` | No se pudo registrar el avance | Impossibile registrare l’avanzamento |
| `clientes.captacion.error.aprobar` | No se pudo aprobar | Impossibile approvare |
| `clientes.captacion.error.rechazar` | No se pudo rechazar | Impossibile rifiutare |
| `clientes.captacion.error.leer` | No se pudieron leer los prospectos | Impossibile leggere i prospect |
| `clientes.captacion.error.abrir` | No se pudo abrir el prospecto | Impossibile aprire il prospect |
| `clientes.captacion.error.guardar` | No se pudo guardar | Impossibile salvare |
| `clientes.captacion.detalle.etapa` | Etapa | Fase |
| `clientes.captacion.detalle.vendedor` | Vendedor | Commerciale |
| `clientes.captacion.detalle.para-el` |  · para el {fecha} |  · entro il {fecha} |
| `clientes.captacion.rechazado` | Rechazado: | Rifiutato: |
| `clientes.captacion.rechazado-por` | Rechazado por {nombre}: | Rifiutato da {nombre}: |
| `clientes.captacion.aprobado` | Aprobado. | Approvato. |
| `clientes.captacion.aprobado-por` | Aprobado por {nombre}. | Approvato da {nombre}. |
| `clientes.captacion.falta-inventario` | Falta darla de alta en Inventario con sus medidas y tarifas. | Manca ancora la registrazione in Inventario con le sue misure e tariffe. |
| `clientes.captacion.ya-existe` | El {tipo} ya existe en el sistema. | Il {tipo} esiste già nel sistema. |
| `clientes.captacion.editar-datos` | Editar datos | Modifica dati |
| `clientes.captacion.revision` | Revisión | Revisione |
| `clientes.captacion.al-aprobar.predio` | Al aprobar se da de alta el predio (y su arrendador, si es nuevo). | All’approvazione viene registrato l’immobile (e il suo locatore, se è nuovo). |
| `clientes.captacion.al-aprobar.pantalla` | Al aprobar se da de alta nada todavía: la pantalla se completa en Inventario. | All’approvazione non viene ancora registrato nulla: l’impianto si completa in Inventario. |
| `clientes.captacion.al-aprobar.otro` | Al aprobar se da de alta el {tipo}. | All’approvazione viene registrato il {tipo}. |
| `clientes.captacion.aprobar` | Aprobar | Approva |
| `clientes.captacion.otro-distinto` | Es otro distinto: aprobar de todos modos | È un altro: approva comunque |
| `clientes.captacion.motivo` | Motivo del rechazo (lo lee el vendedor) | Motivo del rifiuto (lo legge il commerciale) |
| `clientes.captacion.rechazar` | Rechazar | Rifiuta |
| `clientes.captacion.avance` | Registrar avance | Registra avanzamento |
| `clientes.captacion.solo-nota` | {etapa} (solo una nota) | {etapa} (solo una nota) |
| `clientes.captacion.que-paso` | Qué pasó | Cosa è successo |
| `clientes.captacion.fecha-siguiente` | Fecha del siguiente paso | Data del prossimo passo |
| `clientes.captacion.guardar-avance` | Guardar avance | Salva avanzamento |
| `clientes.captacion.bitacora` | Bitácora | Registro |
| `clientes.captacion.usuario-eliminado` | Usuario eliminado | Utente eliminato |
| `clientes.captacion.todos-los-tipos` | Todos los tipos | Tutti i tipi |
| `clientes.captacion.nuevo` | Nuevo prospecto | Nuovo prospect |
| `clientes.captacion.esperan` | Estos esperan a que un gerente, director o administrador los revise. | Questi attendono che un manager, un direttore o un amministratore li esamini. |
| `clientes.captacion.prospectos` | Prospectos | Prospect |
| `clientes.captacion.col.nombre` | Nombre | Nome |
| `clientes.captacion.col.tipo` | Tipo | Tipo |
| `clientes.captacion.col.etapa` | Etapa | Fase |
| `clientes.captacion.col.siguiente` | Siguiente paso | Prossimo passo |
| `clientes.captacion.col.vendedor` | Vendedor | Commerciale |
| `clientes.captacion.col.actualizado` | Actualizado | Aggiornato |
| `clientes.captacion.vacia.curso` | No hay prospectos en curso. Da de alta el primero con «Nuevo prospecto». | Nessun prospect in corso. Registra il primo con «Nuovo prospect». |
| `clientes.captacion.vacia.revision` | Nada espera aprobación. | Nulla attende approvazione. |
| `clientes.captacion.vacia.cerrados` | Aún no hay prospectos cerrados. | Ancora nessun prospect chiuso. |
| `clientes.captacion.vacia.todos` | Aún no hay prospectos. | Ancora nessun prospect. |
| `clientes.captacion.vencido-hace` | vencido hace {n} d | scaduto da {n} g |
| `clientes.captacion.vencido` | vencido | scaduto |
| `clientes.captacion.anterior` | Anterior | Precedente |
| `clientes.captacion.pagina` | Página {n} de {paginas} · {total} prospectos | Pagina {n} di {paginas} · {total} prospect |
| `clientes.captacion.siguiente` | Siguiente | Successiva |
| `clientes.captacion.editar` | Editar prospecto | Modifica prospect |
| `clientes.captacion.form.subtitulo` | Captura lo que tengas; lo mínimo para enviarlo a revisión se pide al enviarlo. | Inserisci quello che hai; il minimo per inviarlo in revisione viene richiesto al momento dell’invio. |

## `textos/reportes.ts` · 148 claves

| clave | español | italiano |
|---|---|---|
| `reportes.titulo` | Reportes de rentabilidad | Report di redditività |
| `reportes.subtitulo` | Qué ingresa y qué cuesta cada pantalla en el periodo que elijas. | Quanto incassa e quanto costa ogni impianto nel periodo che scegli. |
| `reportes.indicadores` | Indicadores del periodo | Indicatori del periodo |
| `reportes.kpi.ingreso` | Ingreso del periodo | Ricavi del periodo |
| `reportes.kpi.costo-sub` | Espacio {espacio} · Operación {operacion} · Luz {luz} | Spazio {espacio} · Operazioni {operacion} · Luce {luz} |
| `reportes.kpi.margen` | Margen sobre ingreso | Margine sui ricavi |
| `reportes.kpi.margen-sub` | Margen {monto} | Margine {monto} |
| `reportes.rango` | Del {desde} al {hasta} | Dal {desde} al {hasta} |
| `reportes.resultado` | Resultado | Risultato |
| `reportes.periodos` | {n} {periodos} | {n} {periodos} |
| `reportes.periodos.palabra.uno` | periodo | periodo |
| `reportes.periodos.palabra.otros` | periodos | periodi |
| `reportes.error.titulo` | No se pudo calcular el reporte | Impossibile calcolare il report |
| `reportes.error.sin-mensaje` | No se pudo calcular el reporte. La petición no llegó a buen término. | Impossibile calcolare il report. La richiesta non è andata a buon fine. |
| `reportes.error.red` | No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar. | Impossibile contattare il server. Controlla la connessione e riprova. |
| `reportes.invalido.titulo` | Revisa el periodo | Controlla il periodo |
| `reportes.vacio.titulo` | Sin movimiento en este periodo | Nessun movimento in questo periodo |
| `reportes.vacio.detalle` | Entre el {desde} y el {hasta} ninguna pantalla registró ingreso, renta ni órdenes de trabajo. Una pantalla sin nada de eso no aparece en el reporte; prueba con un rango más amplio. | Tra il {desde} e il {hasta} nessun impianto ha registrato ricavi, affitti né ordini di lavoro. Un impianto senza nulla di tutto ciò non compare nel report; prova con un intervallo più ampio. |
| `reportes.notas` | Notas sobre estas cifras ({n}) | Note su queste cifre ({n}) |
| `reportes.inicial.titulo` | Elige un periodo | Scegli un periodo |
| `reportes.inicial.detalle` | El reporte se calcula al elegir las fechas. | Il report si calcola quando scegli le date. |
| `reportes.filtro.agrupar` | Agrupar | Raggruppa |
| `reportes.filtro.desde` | Desde | Da |
| `reportes.filtro.hasta` | Hasta | A |
| `reportes.filtro.periodos` | Periodos | Periodi |
| `reportes.dim.sitio` | Por pantalla | Per impianto |
| `reportes.dim.sitio.ayuda` | Ingreso y las tres fuentes de costo de cada pantalla —espacio, operación y luz—. Peor margen primero. | I ricavi e le tre fonti di costo di ogni impianto —spazio, operazioni e luce—. Prima il margine peggiore. |
| `reportes.dim.trimestre` | Por trimestre | Per trimestre |
| `reportes.dim.trimestre.ayuda` | Cómo evoluciona el negocio: una fila por trimestre natural, en orden cronológico. | Come evolve l’attività: una riga per trimestre solare, in ordine cronologico. |
| `reportes.dim.operacion` | Por operación | Per operazioni |
| `reportes.dim.operacion.ayuda` | Dónde se va el dinero en visitas: órdenes de trabajo, su costo y las horas en sitio. | Dove vanno i soldi nelle visite: ordini di lavoro, il loro costo e le ore sul posto. |
| `reportes.dim.m2` | Por metro cuadrado | Per metro quadrato |
| `reportes.dim.m2.ayuda` | Qué superficie estática rinde. Las digitales no entran: su denominador son spots. | Quale superficie statica rende. Gli impianti digitali non entrano: il loro denominatore sono gli spot. |
| `reportes.dim.luz` | Por consumo de luz | Per consumo di luce |
| `reportes.dim.luz.ayuda` | Qué pantallas se comen la energía. El recibo del predio se reparte entre sus pantallas. | Quali impianti divorano l’energia. La bolletta dell’immobile si ripartisce tra i suoi impianti. |
| `reportes.dim.entidad` | Por razón social | Per ragione sociale |
| `reportes.dim.entidad.ayuda` | Cuánto factura y cuánta renta paga cada una de tus razones sociales. La operación y la luz no se reparten: no hay dato que diga de quién son. | Quanto fattura e quanto affitto paga ciascuna delle tue ragioni sociali. Le operazioni e la luce non si ripartiscono: nessun dato dice a chi appartengono. |
| `reportes.dim.tarifa` | Publicada vs neta | Pubblicata vs netta |
| `reportes.dim.tarifa.ayuda` | Qué tarifa se publicó y qué entró de ella. Lo vendido desde Comercial no tiene tarifa publicada congelada y sale con una raya, no con un cero. | Quale tariffa è stata pubblicata e quanto ne è entrato. Ciò che è stato venduto da Vendite non ha una tariffa pubblicata congelata ed esce con un trattino, non con uno zero. |
| `reportes.dim.vendedor` | Por vendedor | Per commerciale |
| `reportes.dim.vendedor.ayuda` | Cuánto vendió cada persona y cuánto descuento concedió. El vendedor es quien crea la propuesta, y se guarda desde el 2026-09-28: lo anterior sale en «Sin vendedor» y no se puede recuperar. | Quanto ha venduto ogni persona e quanto sconto ha concesso. Il commerciale è chi crea la proposta, e si registra dal 2026-09-28: ciò che è precedente esce in «Nessun commerciale» e non si può recuperare. |
| `reportes.gran.mes` | Mensual | Mensile |
| `reportes.gran.trimestre` | Trimestral | Trimestrale |
| `reportes.motivo.sin-inicio` | Falta la fecha de inicio del reporte | Manca la data di inizio del report |
| `reportes.motivo.sin-fin` | Falta la fecha de fin del reporte | Manca la data di fine del report |
| `reportes.motivo.formato` | Usa fechas con formato AAAA-MM-DD | Usa date nel formato AAAA-MM-GG |
| `reportes.motivo.invertido` | La fecha de fin no puede ser anterior a la de inicio | La data di fine non può essere precedente a quella di inizio |
| `reportes.motivo.tope` | El reporte abarca como máximo 24 meses por consulta. Acorta el rango de fechas. | Il report copre al massimo 24 mesi per richiesta. Accorcia l’intervallo di date. |
| `reportes.col.pantalla` | Pantalla | Impianto |
| `reportes.col.trimestre` | Trimestre | Trimestre |
| `reportes.col.razon-social` | Razón social | Ragione sociale |
| `reportes.col.vendedor` | Vendedor | Commerciale |
| `reportes.col.ingreso` | Ingreso | Ricavi |
| `reportes.col.costo-espacio` | Costo del espacio | Costo dello spazio |
| `reportes.col.costo-operacion` | Costo de operación | Costo operativo |
| `reportes.col.costo-luz` | Costo de la luz | Costo della luce |
| `reportes.col.costo-total` | Costo total | Costo totale |
| `reportes.col.margen-bruto` | Margen bruto | Margine lordo |
| `reportes.col.margen-bruto-pct` | Margen bruto % | Margine lordo % |
| `reportes.col.visitas` | Visitas | Visite |
| `reportes.col.operacion-ingreso` | Operación / ingreso | Operazioni / ricavi |
| `reportes.col.horas` | Horas en sitio | Ore sul posto |
| `reportes.col.superficie` | Superficie | Superficie |
| `reportes.col.ingreso-m2` | Ingreso / m² | Ricavi / m² |
| `reportes.col.margen-m2` | Margen bruto / m² | Margine lordo / m² |
| `reportes.col.consumo` | Consumo | Consumo |
| `reportes.col.costo-kwh` | Costo / kWh | Costo / kWh |
| `reportes.col.saldo-atribuido` | Saldo atribuido | Saldo attribuito |
| `reportes.col.pct-facturacion` | % de la facturación | % del fatturato |
| `reportes.col.tarifa-publicada` | Tarifa publicada | Tariffa pubblicata |
| `reportes.col.neto-comparable` | Neto comparable | Netto confrontabile |
| `reportes.col.descuento-comision` | Descuento y comisión | Sconto e commissione |
| `reportes.col.pct-publicada` | % sobre publicada | % sulla pubblicata |
| `reportes.desglose.periodo` | Periodo | Periodo |
| `reportes.desglose.espacio` | Espacio | Spazio |
| `reportes.desglose.operacion` | Operación | Operazioni |
| `reportes.desglose.luz` | Luz | Luce |
| `reportes.tabla.total` | Total ({n}) | Totale ({n}) |
| `reportes.tabla.desglose.ocultar` | Ocultar el desglose por periodo | Nascondi il dettaglio per periodo |
| `reportes.tabla.desglose.ver` | Ver el desglose por periodo | Mostra il dettaglio per periodo |
| `reportes.tabla.raya.margen-pct` | Sin ingreso en el rango: no hay porcentaje que calcular | Nessun ricavo nell’intervallo: non c’è una percentuale da calcolare |
| `reportes.tabla.raya.operacion-pct` | Sin ingreso en el rango: no hay proporción que calcular | Nessun ricavo nell’intervallo: non c’è una proporzione da calcolare |
| `reportes.tabla.raya.horas` | Ninguna visita del rango tiene registradas sus dos marcas de tiempo | Nessuna visita dell’intervallo ha registrati entrambi i suoi orari |
| `reportes.tabla.horas-de` | de {n} {visitas} | su {n} {visitas} |
| `reportes.tabla.visitas.uno` | visita | visita |
| `reportes.tabla.visitas.otros` | visitas | visite |
| `reportes.tabla.propia` | propia | di proprietà |
| `reportes.tabla.sin-contrato` | sin contrato | senza contratto |
| `reportes.fila.sin-asignar` | Sin asignar | Non assegnato |
| `reportes.fila.sin-asignar.detalle` | Sin razón social en el dato de origen | Nessuna ragione sociale nel dato di origine |
| `reportes.fila.sin-vendedor` | Sin vendedor | Nessun commerciale |
| `reportes.fila.sin-vendedor.detalle` | Campañas de Comercial y propuestas anteriores al 2026-09-28 | Campagne da Vendite e proposte precedenti al 2026-09-28 |
| `reportes.cuenta.pantalla.uno` | {n} pantalla | {n} impianto |
| `reportes.cuenta.pantalla.otros` | {n} pantallas | {n} impianti |
| `reportes.cuenta.trimestre.uno` | {n} trimestre | {n} trimestre |
| `reportes.cuenta.trimestre.otros` | {n} trimestres | {n} trimestri |
| `reportes.cuenta.razon-social.uno` | {n} razón social | {n} ragione sociale |
| `reportes.cuenta.razon-social.otros` | {n} razones sociales | {n} ragioni sociali |
| `reportes.cuenta.vendedor.uno` | {n} vendedor | {n} commerciale |
| `reportes.cuenta.vendedor.otros` | {n} vendedores | {n} commerciali |
| `reportes.con-movimiento` | {cuenta} con movimiento | {cuenta} con movimenti |
| `reportes.aviso.en-curso.uno` | El periodo que estás viendo toca {etiqueta}, que está EN CURSO: llevan {corridos} de sus {totales} días. La renta de los espacios ya corrió esos {corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado. | Il periodo che stai guardando comprende {etiqueta}, che è IN CORSO: è trascorso {corridos} dei suoi {totales} giorni. L’affitto degli spazi ha già maturato quel {corridos} giorno intero, ma ciò che è stato venduto si fattura alla chiusura, quindi i ricavi non sono ancora dentro e il margine risulta peggiore di quanto sarà. Non confrontarlo con un trimestre concluso. |
| `reportes.aviso.en-curso.otros` | El periodo que estás viendo toca {etiqueta}, que está EN CURSO: llevan {corridos} de sus {totales} días. La renta de los espacios ya corrió esos {corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado. | Il periodo che stai guardando comprende {etiqueta}, che è IN CORSO: sono trascorsi {corridos} dei suoi {totales} giorni. L’affitto degli spazi ha già maturato quei {corridos} giorni interi, ma ciò che è stato venduto si fattura alla chiusura, quindi i ricavi non sono ancora dentro e il margine risulta peggiore di quanto sarà. Non confrontarlo con un trimestre concluso. |
| `reportes.aviso.margen-bruto` | El margen de este reporte es BRUTO: es el ingreso menos los costos DIRECTOS de la pantalla —el espacio, la operación y la luz—. NO es el margen neto, y no se llega a él restando nada de lo que hay en esta tabla: al neto le faltarían los costos indirectos (nómina, oficina, estructura) y este sistema no captura ninguno. Mientras no se capturen, el margen neto del negocio no se puede calcular aquí y no es que esté escondido en otra pantalla. | Il margine di questo report è LORDO: sono i ricavi meno i costi DIRETTI dell’impianto —spazio, operazioni e luce—. NON è il margine netto, e non ci si arriva sottraendo nulla di ciò che c’è in questa tabella: al netto mancherebbero i costi indiretti (personale, ufficio, struttura) e questo sistema non ne registra nessuno. Finché non verranno registrati, il margine netto dell’attività non si può calcolare qui, e non è nascosto in un’altra schermata. |
| `reportes.aviso.m2.todas-las-caras` | La superficie suma TODAS las caras de cada pantalla: una de dos caras de 3 × 6 cuenta 36 m², no 18. Es la superficie que se vende, y cada pantalla aporta la de sus propias caras. | La superficie somma TUTTE le facce di ogni impianto: uno bifacciale da 3 × 6 conta 36 m², non 18. È la superficie che si vende, e ogni impianto apporta quella delle sue facce. |
| `reportes.aviso.m2.una-cara` | La superficie es la de UNA cara: una pantalla de dos caras de 3 × 6 cuenta 18 m², no 36. Mide la superficie del soporte y no la que se vende, así que las pantallas de varias caras salen mejor situadas que si se contaran todas. | La superficie è quella di UNA faccia: un impianto bifacciale da 3 × 6 conta 18 m², non 36. Misura la superficie del supporto e non quella che si vende, quindi gli impianti con più facce risultano meglio posizionati che se si contassero tutte. |
| `reportes.aviso.sin-contrato.uno` | {cuenta} no tiene contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es. | {cuenta} non ha un contratto di locazione nel periodo: il suo costo dello spazio risulta zero perché manca il dato, non perché sia gratis, e il suo margine sembra migliore di quanto sia. |
| `reportes.aviso.sin-contrato.otros` | {cuenta} no tienen contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es. | {cuenta} non hanno un contratto di locazione nel periodo: il loro costo dello spazio risulta zero perché manca il dato, non perché sia gratis, e il loro margine sembra migliore di quanto sia. |
| `reportes.aviso.sin-ingreso.trimestre.uno` | {cuenta} sin ingreso en el rango. Aparece en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada». | {cuenta} senza ricavi nell’intervallo. Compare a zero di proposito: in una serie temporale un vuoto si legge come «mancano dati» e uno zero come «non è successo nulla». |
| `reportes.aviso.sin-ingreso.trimestre.otros` | {cuenta} sin ingreso en el rango. Aparecen en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada». | {cuenta} senza ricavi nell’intervallo. Compaiono a zero di proposito: in una serie temporale un vuoto si legge come «mancano dati» e uno zero come «non è successo nulla». |
| `reportes.aviso.sin-ingreso.uno` | {cuenta} costó sin vender nada en el periodo, así que no tiene margen porcentual (la columna sale con «—»). | {cuenta} ha avuto costi senza vendere nulla nel periodo, quindi non ha un margine percentuale (la colonna mostra «—»). |
| `reportes.aviso.sin-ingreso.otros` | {cuenta} costaron sin vender nada en el periodo, así que no tienen margen porcentual (la columna sale con «—»). | {cuenta} hanno avuto costi senza vendere nulla nel periodo, quindi non hanno un margine percentuale (la colonna mostra «—»). |
| `reportes.nota.ot.sin-visitas` | No hubo ninguna visita en este periodo, así que el costo de operación es cero porque no se fue a ninguna pantalla, no porque falte capturarlo. | Non c’è stata nessuna visita in questo periodo, quindi il costo operativo è zero perché non si è andati a nessun impianto, non perché manchi da registrarlo. |
| `reportes.nota.ot.intro` | El costo de operación se arma de dos fuentes y NO son lo mismo: lo que de verdad costó cada visita, cuando alguien lo capturó en su orden de trabajo, y una ESTIMACIÓN por tipo de orden —la de Configuración— cuando no. La estimación cobra igual una herrería de {caro} que una de {barato}. | Il costo operativo si compone di due fonti e NON sono la stessa cosa: quanto è costata davvero ogni visita, quando qualcuno l’ha registrato nel suo ordine di lavoro, e una STIMA per tipo di ordine —quella di Configurazione— quando no. La stima addebita allo stesso modo un lavoro di carpenteria metallica da {caro} e uno da {barato}. |
| `reportes.nota.ot.estimacion.uno` | {estimadas} de las {total} visita del periodo entra con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye. | {estimadas} su {total} visita del periodo entra con la stima per tipo ({estimado}) e {reales} con il suo costo reale ({capturado}). Quella parte del costo —e il margine che ne deriva— è una stima, non una misura: registrare il costo nell’ordine di lavoro la sostituisce. |
| `reportes.nota.ot.estimacion.una-de-varias` | {estimadas} de las {total} visitas del periodo entra con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye. | {estimadas} delle {total} visite del periodo entra con la stima per tipo ({estimado}) e {reales} con il loro costo reale ({capturado}). Quella parte del costo —e il margine che ne deriva— è una stima, non una misura: registrare il costo nell’ordine di lavoro la sostituisce. |
| `reportes.nota.ot.estimacion.otros` | {estimadas} de las {total} visitas del periodo entran con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye. | {estimadas} delle {total} visite del periodo entrano con la stima per tipo ({estimado}) e {reales} con il loro costo reale ({capturado}). Quella parte del costo —e il margine che ne deriva— è una stima, non una misura: registrare il costo nell’ordine di lavoro la sostituisce. |
| `reportes.nota.ot.reales.uno` | Las 1 visita del periodo van con su costo REAL capturado ({capturado}): aquí no hay ninguna estimación, el costo de operación que ves es lo que se pagó. | L’unica visita del periodo è al suo costo REALE registrato ({capturado}): qui non c’è nessuna stima, il costo operativo che vedi è quello che è stato pagato. |
| `reportes.nota.ot.reales.otros` | Las {total} visitas del periodo van con su costo REAL capturado ({capturado}): aquí no hay ninguna estimación, el costo de operación que ves es lo que se pagó. | Tutte le {total} visite del periodo sono al loro costo REALE registrato ({capturado}): qui non c’è nessuna stima, il costo operativo che vedi è quello che è stato pagato. |
| `reportes.nota.m2.ninguna` | No se excluyó ninguna pantalla: todas las que tuvieron movimiento son estáticas y tienen sus medidas capturadas. | Non è stato escluso nessun impianto: tutti quelli con movimenti sono statici e hanno le misure registrate. |
| `reportes.nota.m2.fuera` | Quedaron fuera del ranking: {partes}. | Sono rimasti fuori dalla classifica: {partes}. |
| `reportes.nota.m2.digitales.uno` | {n} pantalla digital o rotativa, porque su denominador correcto son spots y no metros | {n} impianto digitale o rotativo, perché il suo denominatore corretto sono gli spot e non i metri |
| `reportes.nota.m2.digitales.otros` | {n} pantallas digitales o rotativas, porque su denominador correcto son spots y no metros | {n} impianti digitali o rotativi, perché il loro denominatore corretto sono gli spot e non i metri |
| `reportes.nota.m2.sin-medidas.uno` | {n} estática sin ancho o sin alto capturados | {n} statico senza larghezza o altezza registrate |
| `reportes.nota.m2.sin-medidas.otros` | {n} estáticas sin ancho o sin alto capturados | {n} statici senza larghezza o altezza registrate |
| `reportes.nota.entidad.intro` | La operación ({operacion}) y la luz ({luz}) NO se reparten entre razones sociales: ningún dato dice a nombre de quién se pagan. Por eso esta vista no muestra margen — saldría mejor que el real. | Le operazioni ({operacion}) e la luce ({luz}) NON si ripartiscono tra ragioni sociali: nessun dato dice a nome di chi si pagano. Per questo questa vista non mostra il margine — risulterebbe migliore di quello reale. |
| `reportes.nota.entidad.sin-emisora.uno` | {n} reserva del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar». | {n} prenotazione del periodo senza ricevuta con emittente: i suoi ricavi escono in «Non assegnato». |
| `reportes.nota.entidad.sin-emisora.otros` | {n} reservas del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar». | {n} prenotazioni del periodo senza ricevuta con emittente: i loro ricavi escono in «Non assegnato». |
| `reportes.nota.entidad.sin-entidad.uno` | {n} contrato sin razón social asignada: su renta sale en «Sin asignar». | {n} contratto senza ragione sociale assegnata: il suo affitto esce in «Non assegnato». |
| `reportes.nota.entidad.sin-entidad.otros` | {n} contratos sin razón social asignada: su renta sale en «Sin asignar». | {n} contratti senza ragione sociale assegnata: il loro affitto esce in «Non assegnato». |
| `reportes.nota.tarifa.intro` | La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa por pantalla. | La differenza tra la tariffa pubblicata e il netto è lo sconto commerciale PIÙ la commissione d’agenzia: i due si congelano insieme nella proposta e il dato non li separa per impianto. |
| `reportes.nota.tarifa.sin-tarifa.uno` | {sin} de las {total} reserva del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera. | {sin} su {total} prenotazione del periodo non ha una tariffa pubblicata con cui confrontarla ({ingreso} di ricavi): o è nata in Vendite —dove il prezzo salvato È GIÀ la tariffa di listino— o il suo prezzo non coincide con il netto congelato dalla sua proposta. Quelle righe escono con un trattino e non con uno zero: uno zero direbbe che è stata regalata l’intera tariffa. |
| `reportes.nota.tarifa.sin-tarifa.una-de-varias` | {sin} de las {total} reservas del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera. | {sin} delle {total} prenotazioni del periodo non ha una tariffa pubblicata con cui confrontarla ({ingreso} di ricavi): o è nata in Vendite —dove il prezzo salvato È GIÀ la tariffa di listino— o il suo prezzo non coincide con il netto congelato dalla sua proposta. Quelle righe escono con un trattino e non con uno zero: uno zero direbbe che è stata regalata l’intera tariffa. |
| `reportes.nota.tarifa.sin-tarifa.otros` | {sin} de las {total} reservas del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera. | {sin} delle {total} prenotazioni del periodo non hanno una tariffa pubblicata con cui confrontarle ({ingreso} di ricavi): o sono nate in Vendite —dove il prezzo salvato È GIÀ la tariffa di listino— o il loro prezzo non coincide con il netto congelato dalla loro proposta. Quelle righe escono con un trattino e non con uno zero: uno zero direbbe che è stata regalata l’intera tariffa. |
| `reportes.nota.vendedor.intro` | La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa. No es todo rebaja que el vendedor concediera. | La differenza tra la tariffa pubblicata e il netto è lo sconto commerciale PIÙ la commissione d’agenzia: i due si congelano insieme nella proposta e il dato non li separa. Non è tutto uno sconto concesso dal commerciale. |
| `reportes.nota.vendedor.sin-propuesta` | {n} de campañas creadas directamente en Comercial, que nunca tuvieron propuesta y por tanto no tienen a quién atribuirse | {n} da campagne create direttamente in Vendite, che non hanno mai avuto una proposta e quindi non hanno nessuno a cui essere attribuite |
| `reportes.nota.vendedor.historicas` | {n} de propuestas anteriores al 2026-09-28, cuando todavía no se guardaba quién las hacía: ese dato NO SE PUEDE RECUPERAR —la bitácora guarda el nombre de la propuesta, no su identificador— así que esas ventas se quedan sin vendedor para siempre | {n} da proposte precedenti al 2026-09-28, quando non si registrava ancora chi le creava: quel dato NON SI PUÒ RECUPERARE —il registro salva il nome della proposta, non il suo identificativo— quindi quelle vendite restano senza commerciale per sempre |
| `reportes.nota.vendedor.sin-vendedor.uno` | {sin} de las {total} reserva del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}. | {sin} su {total} prenotazione del periodo esce in «Nessun commerciale» ({ingreso} di ricavi): {causas}. |
| `reportes.nota.vendedor.sin-vendedor.una-de-varias` | {sin} de las {total} reservas del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}. | {sin} delle {total} prenotazioni del periodo esce in «Nessun commerciale» ({ingreso} di ricavi): {causas}. |
| `reportes.nota.vendedor.sin-vendedor.otros` | {sin} de las {total} reservas del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}. | {sin} delle {total} prenotazioni del periodo escono in «Nessun commerciale» ({ingreso} di ricavi): {causas}. |
| `reportes.nota.vendedor.raya` | Esas filas salen con una raya y no con un cero: un cero en «Descuento y comisión» afirmaría que no se concedió ninguno. | Quelle righe escono con un trattino e non con uno zero: uno zero in «Sconto e commissione» affermerebbe che non ne è stato concesso nessuno. |
| `reportes.nota.luz.sin-esperados` | No hay recibos de luz que esperar en este periodo. | Non ci sono bollette della luce da attendersi in questo periodo. |
| `reportes.nota.luz.completa.uno` | No falta ningún recibo: están capturados los {esperados} del periodo, así que el costo de la luz está completo. | Non manca nessuna bolletta: risulta registrata {esperados} bolletta attesa nel periodo, quindi il costo della luce è completo. |
| `reportes.nota.luz.completa.otros` | No falta ningún recibo: están capturados los {esperados} del periodo, así que el costo de la luz está completo. | Non manca nessuna bolletta: risultano registrate tutte le {esperados} bollette attese nel periodo, quindi il costo della luce è completo. |
| `reportes.nota.luz.faltan.uno` | Faltan {faltantes} de {esperados} recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía. | Mancanti: {faltantes} su {esperados} bolletta del periodo, quindi il costo della luce che vedi è INCOMPLETO e il margine risulta migliore di quanto sarà. Un mese senza bolletta non è un mese senza consumo: è un dato che nessuno ha ancora registrato. |
| `reportes.nota.luz.faltan.otros` | Faltan {faltantes} de {esperados} recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía. | Mancanti: {faltantes} su {esperados} bollette del periodo, quindi il costo della luce che vedi è INCOMPLETO e il margine risulta migliore di quanto sarà. Un mese senza bolletta non è un mese senza consumo: è un dato che nessuno ha ancora registrato. |
| `reportes.nota.luz.sin-destino.uno` | Además, {n} recibo por {importe} no aparece en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta. | Inoltre, {n} bolletta da {importe} non compare in nessuna riga, perché il suo immobile non ha ancora impianti registrati. |
| `reportes.nota.luz.sin-destino.otros` | Además, {n} recibos por {importe} no aparecen en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta. | Inoltre, {n} bollette da {importe} non compaiono in nessuna riga, perché i loro immobili non hanno ancora impianti registrati. |

## `textos/inicio.ts` · 148 claves

| clave | español | italiano |
|---|---|---|
| `inicio.razon-social` | Razón social: {nombre} | Ragione sociale: {nombre} |
| `inicio.nombre-comercial` | Nombre comercial: {nombre} | Nome commerciale: {nombre} |
| `inicio.indicadores` | Indicadores del mes | Indicatori del mese |
| `inicio.ingreso-de` | Ingreso de {mes} | Ricavi di {mes} |
| `inicio.ingreso-sub` | lo que se devenga este mes, prorrateado por días | quanto maturato nel mese, ripartito in proporzione ai giorni |
| `inicio.margen-de` | Margen de {mes} | Margine di {mes} |
| `inicio.margen-sub` | {margen} · costo {costo} | {margen} · costo {costo} |
| `inicio.requiere-finanzas` | requiere permiso de Finanzas | richiede il permesso di Finanza |
| `inicio.no-calcular` | no se pudo calcular | impossibile calcolare |
| `inicio.pipeline-abierto` | Pipeline abierto | Pipeline aperta |
| `inicio.pipeline-sub` | {propuestas} · {enviadas} | {propuestas} · {enviadas} |
| `inicio.propuestas.uno` | {n} propuesta | {n} proposta |
| `inicio.propuestas.otros` | {n} propuestas | {n} proposte |
| `inicio.enviadas.uno` | {n} enviada | {n} inviata |
| `inicio.enviadas.otros` | {n} enviadas | {n} inviate |
| `inicio.tasa` | Tasa de cierre | Tasso di chiusura |
| `inicio.tasa-sub` | aprobadas de las decididas en {n} días | approvate tra quelle decise in {n} giorni |
| `inicio.ganado-en` | Ganado en {mes} | Vinto a {mes} |
| `inicio.aprobadas-propuestas.uno` | {n} propuesta aprobada | {n} proposta approvata |
| `inicio.aprobadas-propuestas.otros` | {n} propuestas aprobadas | {n} proposte approvate |
| `inicio.ocupacion-red` | Ocupación de la red | Occupazione della rete |
| `inicio.ocupacion-red-sub` | {ocupados} de {capacidad} espacios · digital {dOcupados}/{dCapacidad} · fijas {fOcupados}/{fCapacidad} | {ocupados} di {capacidad} spazi · digitali {dOcupados}/{dCapacidad} · statici {fOcupados}/{fCapacidad} |
| `inicio.costos-de` | Costos de {mes} | Costi di {mes} |
| `inicio.costo.renta` | Renta | Affitto |
| `inicio.costo.operacion` | Operación | Operazioni |
| `inicio.costo.luz` | Luz | Luce |
| `inicio.costo.total` | Total | Totale |
| `inicio.costo.impresion` | Impresión (aparte) | Stampa (a parte) |
| `inicio.ver-por-pantalla` | Ver por pantalla | Vedi per impianto |
| `inicio.rendimiento` | Rendimiento | Rendimento |
| `inicio.renta-ingreso` | Renta / ingreso | Affitto / ricavi |
| `inicio.tarifa-cobrada` | Tarifa publicada cobrada | Tariffa pubblicata incassata |
| `inicio.de-ventas.uno` | de {n} venta con tarifa publicada | su {n} vendita con tariffa pubblicata |
| `inicio.de-ventas.otros` | de {n} ventas con tarifa publicada | su {n} vendite con tariffa pubblicata |
| `inicio.sin-tarifa` |  · {n} sin tarifa con qué comparar |  · {n} senza tariffa con cui confrontare |
| `inicio.sin-ventas` | sin ventas con tarifa publicada este mes | nessuna vendita con tariffa pubblicata questo mese |
| `inicio.ocupacion` | Ocupación | Occupazione |
| `inicio.ocupacion-sub` | {ocupados} espacios·día ocupados de {disponibles} disponibles | {ocupados} spazi·giorno occupati su {disponibles} disponibili |
| `inicio.gran.dia` | Día | Giorno |
| `inicio.gran.semana` | Semana | Settimana |
| `inicio.gran.mes` | Mes | Mese |
| `inicio.pipeline` | Pipeline comercial | Pipeline commerciale |
| `inicio.abierto` | Abierto | Aperto |
| `inicio.aprobadas.uno` | {n} aprobada | {n} approvata |
| `inicio.aprobadas.otros` | {n} aprobadas | {n} approvate |
| `inicio.ultimos` | últimos {n} días | ultimi {n} giorni |
| `inicio.por-vendedor` | Ganado por vendedor | Vinto per commerciale |
| `inicio.nada-aprobado` | Nada aprobado en {mes} todavía. | Ancora nulla di approvato a {mes}. |
| `inicio.otros-vendedores` | Otros vendedores | Altri commerciali |
| `inicio.sin-vendedor` | Sin vendedor | Nessun commerciale |
| `inicio.alertas` | Alertas | Avvisi |
| `inicio.sin-alertas` | Sin alertas activas. | Nessun avviso attivo. |
| `inicio.sin-alertas-tipo` | No hay alertas de los tipos que elegiste mostrar. | Non ci sono avvisi dei tipi che hai scelto di mostrare. |
| `inicio.urgentes.uno` | {n} urgente | {n} urgente |
| `inicio.urgentes.otros` | {n} urgentes | {n} urgenti |
| `inicio.ver-menos` | Ver menos | Mostra meno |
| `inicio.ver-todas` | Ver todas ({n}) | Mostra tutte ({n}) |
| `inicio.ver-todos` | Ver todos ({n}) | Mostra tutti ({n}) |
| `inicio.config-alertas` | Configurar alertas | Configura gli avvisi |
| `inicio.elegir-alertas` | Elegir qué alertas ver | Scegli quali avvisi vedere |
| `inicio.alertas-a-mostrar` | Alertas a mostrar | Avvisi da mostrare |
| `inicio.tipo-alerta.pago` | Rentas vencidas | Affitti scaduti |
| `inicio.tipo-alerta.contrato` | Contratos por vencer | Contratti in scadenza |
| `inicio.tipo-alerta.cobranza` | Facturas (cobranza) | Fatture (incassi) |
| `inicio.tipo-alerta.incidencia` | Sitios bloqueados por incidencia | Siti bloccati per incidente |
| `inicio.tipo-alerta.ot` | Órdenes de trabajo (SLA) | Ordini di lavoro (SLA) |
| `inicio.tipo-alerta.licencia` | Licencias y permisos | Licenze e permessi |
| `inicio.huecos` | Huecos y renovaciones | Spazi liberi e rinnovi |
| `inicio.huecos-sub` | lo que se queda sin campaña en los próximos {n} días | ciò che resta senza campagna nei prossimi {n} giorni |
| `inicio.huecos-nada` | Nada se queda libre en los próximos {n} días. | Nulla si libera nei prossimi {n} giorni. |
| `inicio.slots-libres.uno` | {n} slot libre | {n} slot libero |
| `inicio.slots-libres.otros` | {n} slots libres | {n} slot liberi |
| `inicio.slots-libres` | slots libres | slot liberi |
| `inicio.cara-libre` | cara libre | faccia libera |
| `inicio.sale` | Sale {cliente} · {campana} · termina {fecha} | Esce {cliente} · {campana} · termina il {fecha} |
| `inicio.sin-cliente` | sin cliente | senza cliente |
| `inicio.en-propuesta-lista` | En propuesta: {lista} | In proposta: {lista} |
| `inicio.hoy` | hoy | oggi |
| `inicio.en-dias` | en {n} d | tra {n} g |
| `inicio.por-cobrar` | Por cobrar por antigüedad | Da incassare per anzianità |
| `inicio.sin-saldos` | No hay saldos por cobrar. | Nessun saldo da incassare. |
| `inicio.tramo-titulo.uno` | {tramo}: {monto} en {n} cuota | {tramo}: {monto} in {n} rata |
| `inicio.tramo-titulo.otros` | {tramo}: {monto} en {n} cuotas | {tramo}: {monto} in {n} rate |
| `inicio.tramo.corriente` | Sin vencer | Non scaduto |
| `inicio.tramo.d1-30` | 1–30 días | 1–30 giorni |
| `inicio.tramo.d31-60` | 31–60 días | 31–60 giorni |
| `inicio.tramo.d61-90` | 61–90 días | 61–90 giorni |
| `inicio.tramo.d90` | Más de 90 | Oltre 90 |
| `inicio.vencido` | Vencido: {monto} | Scaduto: {monto} |
| `inicio.mapa` | Tu red en el mapa | La tua rete sulla mappa |
| `inicio.ver-comercial` | Ver comercial | Vedi Vendite |
| `inicio.leyenda.digital` | Digital | Digitale |
| `inicio.leyenda.libre` | Libre hoy | Libero oggi |
| `inicio.leyenda.ocupado` | Ocupado hoy | Occupato oggi |
| `inicio.leyenda.en-propuesta` | En propuesta | In proposta |
| `inicio.grafica.tentativas` | Tentativas | Provvisorie |
| `inicio.grafica.confirmadas` | Confirmadas | Confermate |
| `inicio.alerta.sitio` | Sitio | Sito |
| `inicio.alerta.renta-vencida` | Renta vencida | Affitto scaduto |
| `inicio.alerta.renta-vencida.una` | {sitio} — pago {periodo} sin liquidar ({monto}) | {sitio} — pagamento {periodo} non saldato ({monto}) |
| `inicio.alerta.renta-vencida.varias` | {sitio} — {n} cuotas sin liquidar desde {periodo} ({monto}) | {sitio} — {n} rate non saldate dal {periodo} ({monto}) |
| `inicio.alerta.renta-por-vencer` | Renta por vencer | Affitto in scadenza |
| `inicio.alerta.renta-hoy` | {sitio} — vence hoy ({monto}) | {sitio} — scade oggi ({monto}) |
| `inicio.alerta.renta-en.uno` | {sitio} — vence en {n} día ({monto}) | {sitio} — scade tra {n} giorno ({monto}) |
| `inicio.alerta.renta-en.otros` | {sitio} — vence en {n} días ({monto}) | {sitio} — scade tra {n} giorni ({monto}) |
| `inicio.alerta.contrato-incompleto` | Contrato incompleto | Contratto incompleto |
| `inicio.alerta.contrato-incompleto.detalle` | {sitio} — falta arrendador e importe de renta | {sitio} — mancano locatore e importo dell’affitto |
| `inicio.alerta.contrato-por-vencer` | Contrato por vencer | Contratto in scadenza |
| `inicio.alerta.contrato-vence.uno` | {sitio} — vence en {n} días | {sitio} — scade tra {n} giorno |
| `inicio.alerta.contrato-vence.otros` | {sitio} — vence en {n} días | {sitio} — scade tra {n} giorni |
| `inicio.alerta.contrato-vencido` | Contrato vencido | Contratto scaduto |
| `inicio.alerta.contrato-vencio.uno` | {sitio} — venció hace {n} días | {sitio} — scaduto da {n} giorno |
| `inicio.alerta.contrato-vencio.otros` | {sitio} — venció hace {n} días | {sitio} — scaduto da {n} giorni |
| `inicio.alerta.ubicacion` | Ubicación | Ubicazione |
| `inicio.alerta.licencia-vencida` | Licencia vencida | Licenza scaduta |
| `inicio.alerta.licencia-vencio.uno` | {donde} — {que} venció hace {n} días | {donde} — {que}, scadenza superata da {n} giorno |
| `inicio.alerta.licencia-vencio.otros` | {donde} — {que} venció hace {n} días | {donde} — {que}, scadenza superata da {n} giorni |
| `inicio.alerta.licencia-por-vencer` | Licencia por vencer | Licenza in scadenza |
| `inicio.alerta.licencia-vence.uno` | {donde} — {que} vence en {n} días | {donde} — {que} scade tra {n} giorno |
| `inicio.alerta.licencia-vence.otros` | {donde} — {que} vence en {n} días | {donde} — {que} scade tra {n} giorni |
| `inicio.licencia.municipal` | Licencia municipal | Licenza comunale |
| `inicio.licencia.ambiental` | Permiso ambiental | Permesso ambientale |
| `inicio.licencia.estructural` | Dictamen estructural | Perizia strutturale |
| `inicio.licencia.otro` | Permiso | Permesso |
| `inicio.alerta.campana` | campaña | campagna |
| `inicio.alerta.cobertura` | El contrato no cubre la campaña | Il contratto non copre la campagna |
| `inicio.alerta.cobertura.vence` | {sitio} — «{campana}» va hasta {hasta} y el contrato vence el {fin} | {sitio} — «{campana}» dura fino al {hasta} e il contratto scade il {fin} |
| `inicio.alerta.cobertura.sin-fin` | {sitio} — «{campana}» va hasta {hasta} y el contrato no tiene fecha de fin | {sitio} — «{campana}» dura fino al {hasta} e il contratto non ha una data di fine |
| `inicio.alerta.factura-vencida` | Factura vencida | Fattura scaduta |
| `inicio.alerta.factura-por-vencer` | Factura por vencer | Fattura in scadenza |
| `inicio.alerta.factura` | Factura | Fattura |
| `inicio.alerta.pausa-legal` | Pantalla en pausa legal | Impianto in sospensione legale |
| `inicio.alerta.incidencia` | Sitio bloqueado por incidencia | Sito bloccato per incidente |
| `inicio.incidencia.clima` | clima | meteo |
| `inicio.incidencia.mantenimiento` | mantenimiento | manutenzione |
| `inicio.incidencia.legal` | legal | questione legale |
| `inicio.incidencia.vandalismo` | vandalismo | vandalismo |
| `inicio.incidencia.suspension-operativa` | suspension_operativa | sospensione operativa |
| `inicio.incidencia.accidente` | accidente | incidente |
| `inicio.incidencia.otro` | otro | altro |
| `inicio.alerta.ot-vencida` | OT vencida | Ordine di lavoro scaduto |
| `inicio.alerta.ot-por-vencer` | OT por vencer | Ordine di lavoro in scadenza |
| `inicio.alerta.ot-sin-sitio` | sin sitio | senza sito |
| `inicio.alerta.ot-vencio.uno` | {folio} · {sitio} — venció hace {n} día(s){sinAsignar} | {folio} · {sitio} — scaduto da {n} giorno{sinAsignar} |
| `inicio.alerta.ot-vencio.otros` | {folio} · {sitio} — venció hace {n} día(s){sinAsignar} | {folio} · {sitio} — scaduto da {n} giorni{sinAsignar} |
| `inicio.alerta.ot-vence.uno` | {folio} · {sitio} — vence en {n} día(s){sinAsignar} | {folio} · {sitio} — scade tra {n} giorno{sinAsignar} |
| `inicio.alerta.ot-vence.otros` | {folio} · {sitio} — vence en {n} día(s){sinAsignar} | {folio} · {sitio} — scade tra {n} giorni{sinAsignar} |
| `inicio.alerta.ot-sin-asignar` |  · sin asignar |  · non assegnato |
