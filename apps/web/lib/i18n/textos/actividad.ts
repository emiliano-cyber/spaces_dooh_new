// ============================================================================
//  lib/i18n/textos/actividad.ts — LA BITACORA DE «ACTIVIDAD», AL PINTARLA.
// ----------------------------------------------------------------------------
//  Revision del ingles (18/11). El dueño: «no todo está traducido: hay pedazos
//  en español». Con la interfaz en ingles, la pantalla de Actividad salia
//  ENTERA en espanol: cada renglon es un texto que el servidor GUARDA en
//  `acciones.accion` al registrar lo que alguien hizo (`registrarAccion()` y
//  cuatro `insert` a mano).
//
//  El dato NO cambia, y es a proposito (vault/03-Frontend/idiomas-es-en.md §8:
//  «lo que es REGISTRO se queda en español»): una bitacora guardada en dos
//  idiomas segun quien hizo cada cosa no se puede filtrar ni comparar. Lo que
//  hace este archivo es lo mismo que la ola 6 hizo con la campanita
//  (`textos/notificaciones.ts`): el espanol de cada clave es la PLANTILLA EXACTA
//  que escribe el servidor, con huecos `{x}` donde va un dato; la pantalla
//  reconoce el texto guardado y lo rearma en el idioma de quien lee
//  (`lib/i18n/actividad.ts`). Lo que no casa con ninguna plantilla se pinta
//  tal cual: mejor el original que uno inventado.
//
//  `actividad.test.ts` saca del arbol los literales de cada `registrarAccion`
//  y exige que esten aqui: un renglon nuevo de la bitacora sin plantilla pone
//  la prueba en rojo.
//
//  Plurales con `.uno/.otros` (el espanol puede ser el mismo: es lo que guarda
//  el servidor). El sufijo « (vN)» de las propuestas lo quita y lo vuelve a
//  poner `lib/i18n/actividad.ts`; las plantillas van sin el.
//
//  Italiano y portugues: primera version del revisor del ingles (18/11), a
//  repasar por sus revisores. Lo que falte en ellos se pinta en espanol.
// ============================================================================

type Fila = readonly [clave: string, es: string, en: string, it: string, pt: string]

const FILAS = [
  // ── Comercial: propuestas, oportunidades, prospectos ──
  ['actividad.creo-propuesta', 'Creó propuesta', 'Created a proposal', 'Ha creato una proposta', 'Criou uma proposta'],
  ['actividad.actualizo-propuesta', 'Actualizó propuesta', 'Updated a proposal', 'Ha aggiornato una proposta', 'Atualizou uma proposta'],
  ['actividad.quito-descuento', 'Quitó el descuento de la propuesta', 'Removed the discount from the proposal', 'Ha rimosso lo sconto dalla proposta', 'Removeu o desconto da proposta'],
  ['actividad.puso-descuento', 'Puso {pct} % de descuento en la propuesta', 'Set a {pct}% discount on the proposal', 'Ha impostato uno sconto del {pct}% sulla proposta', 'Aplicou {pct}% de desconto na proposta'],
  ['actividad.propuesta-estatus', 'Propuesta → {estatus}', 'Proposal → {estatus}', 'Proposta → {estatus}', 'Proposta → {estatus}'],
  ['actividad.propuesta-enviada-sin-correo', 'Propuesta → ENVIADA (el correo no está configurado: la liga se manda a mano)', 'Proposal → Sent (email isn’t set up: the link is sent by hand)', 'Proposta → Inviata (l’email non è configurata: il link si invia a mano)', 'Proposta → Enviada (o e-mail não está configurado: o link é enviado manualmente)'],
  ['actividad.envio-propuesta-correo', 'Envió la propuesta por correo a {para}', 'Emailed the proposal to {para}', 'Ha inviato la proposta via email a {para}', 'Enviou a proposta por e-mail para {para}'],
  ['actividad.aprobo-propuesta-cero', 'Aprobó propuesta en $0 (confirmado) · snapshot v{v}', 'Approved a proposal at zero (confirmed) · snapshot v{v}', 'Ha approvato una proposta a zero (confermato) · snapshot v{v}', 'Aprovou uma proposta a zero (confirmado) · snapshot v{v}'],
  ['actividad.aprobo-propuesta', 'Aprobó propuesta · snapshot económico v{v} (total {monto})', 'Approved a proposal · financial snapshot v{v} (total {monto})', 'Ha approvato una proposta · snapshot economico v{v} (totale {monto})', 'Aprovou uma proposta · snapshot financeiro v{v} (total {monto})'],
  ['actividad.borro-borrador', 'Borró el borrador de propuesta {folio}', 'Deleted draft proposal {folio}', 'Ha eliminato la bozza di proposta {folio}', 'Excluiu o rascunho de proposta {folio}'],
  ['actividad.agrego-sitios.uno', 'Agregó {n} sitio a la propuesta', 'Added {n} site to the proposal', 'Ha aggiunto {n} sito alla proposta', 'Adicionou {n} local à proposta'],
  ['actividad.agrego-sitios.otros', 'Agregó {n} sitios a la propuesta', 'Added {n} sites to the proposal', 'Ha aggiunto {n} siti alla proposta', 'Adicionou {n} locais à proposta'],
  ['actividad.quito-un-sitio', 'Quitó un sitio de la propuesta', 'Removed a site from the proposal', 'Ha rimosso un sito dalla proposta', 'Removeu um local da proposta'],
  ['actividad.aprobo-sitio', 'Aprobó sitio de propuesta', 'Approved a proposal site', 'Ha approvato un sito della proposta', 'Aprovou um local da proposta'],
  ['actividad.quito-sitio', 'Quitó sitio de propuesta', 'Unapproved a proposal site', 'Ha tolto l’approvazione a un sito della proposta', 'Retirou a aprovação de um local da proposta'],
  ['actividad.tarifa-sin-calculada', 'Puso la tarifa de «{sitio}» ({unidad}) en {monto}, sin tarifa calculada{motivo}, en la propuesta', 'Set the rate of “{sitio}” ({unidad}) to {monto}, with no calculated rate{motivo}, on the proposal', 'Ha impostato la tariffa di «{sitio}» ({unidad}) a {monto}, senza tariffa calcolata{motivo}, nella proposta', 'Definiu a tarifa de “{sitio}” ({unidad}) em {monto}, sem tarifa calculada{motivo}, na proposta'],
  ['actividad.tarifa-cambio', 'Cambió la tarifa de «{sitio}» ({unidad}) de {monto} a {monto2}{motivo} en la propuesta', 'Changed the rate of “{sitio}” ({unidad}) from {monto} to {monto2}{motivo} on the proposal', 'Ha cambiato la tariffa di «{sitio}» ({unidad}) da {monto} a {monto2}{motivo} nella proposta', 'Alterou a tarifa de “{sitio}” ({unidad}) de {monto} para {monto2}{motivo} na proposta'],
  ['actividad.motivo-roadblock', ' por Roadblock con prima del {pct} %', ' for a Roadblock with a {pct}% premium', ' per Roadblock con un premio del {pct}%', ' por Roadblock com prêmio de {pct}%'],
  ['actividad.aplico-codigo', 'Aplicó un código promocional a la propuesta (pendiente de aprobación)', 'Applied a negotiation code to the proposal (pending approval)', 'Ha applicato un codice di negoziazione alla proposta (in attesa di approvazione)', 'Aplicou um código de negociação à proposta (aguardando aprovação)'],
  ['actividad.quito-codigo', 'Quitó el código promocional de la propuesta', 'Removed the negotiation code from the proposal', 'Ha rimosso il codice di negoziazione dalla proposta', 'Removeu o código de negociação da proposta'],
  ['actividad.reactivo-codigo', 'Reactivó la propuesta con el código {codigo}', 'Reactivated the proposal with negotiation code {codigo}', 'Ha riattivato la proposta con il codice {codigo}', 'Reativou a proposta com o código {codigo}'],
  ['actividad.aprobo-codigo', 'Aprobó el código promocional {codigo} ({pct} %)', 'Approved negotiation code {codigo} ({pct}%)', 'Ha approvato il codice di negoziazione {codigo} ({pct}%)', 'Aprovou o código de negociação {codigo} ({pct}%)'],
  ['actividad.rechazo-codigo', 'Rechazó el código promocional {codigo} — motivo: {razon}', 'Rejected negotiation code {codigo} — reason: {razon}', 'Ha rifiutato il codice di negoziazione {codigo} — motivo: {razon}', 'Recusou o código de negociação {codigo} — motivo: {razon}'],
  ['actividad.codigo-quitado-al-aceptar', 'El cliente aceptó la propuesta sin el código {codigo}: estaba pendiente de aprobación, se quitó y su uso volvió al cupón', 'The client accepted the proposal without negotiation code {codigo}: it was pending approval, so it was removed and the use it consumed is available again', 'Il cliente ha accettato la proposta senza il codice {codigo}: era in attesa di approvazione, è stato rimosso e il suo utilizzo è di nuovo disponibile', 'O cliente aceitou a proposta sem o código {codigo}: estava aguardando aprovação, foi removido e o uso voltou a ficar disponível'],
  ['actividad.aplico-paquete', 'Aplicó un paquete cerrado a la propuesta', 'Applied a bundle to the proposal', 'Ha applicato un pacchetto alla proposta', 'Aplicou um pacote fechado à proposta'],
  ['actividad.quito-paquete', 'Quitó el paquete cerrado de la propuesta', 'Removed the bundle from the proposal', 'Ha rimosso il pacchetto dalla proposta', 'Removeu o pacote fechado da proposta'],
  ['actividad.mostro-imprenta', 'Mostró la imprenta al cliente en la liga', 'Showed the print shop to the client on the link', 'Ha mostrato la stamperia al cliente nel link', 'Mostrou a gráfica ao cliente no link'],
  ['actividad.oculto-imprenta', 'Ocultó la imprenta al cliente en la liga', 'Hid the print shop from the client on the link', 'Ha nascosto la stamperia al cliente nel link', 'Ocultou a gráfica do cliente no link'],
  ['actividad.ligo-oportunidad', 'Ligó la propuesta a una oportunidad', 'Linked the proposal to an opportunity', 'Ha collegato la proposta a un’opportunità', 'Vinculou a proposta a uma oportunidade'],
  ['actividad.desligo-oportunidad', 'Desligó la propuesta de su oportunidad', 'Unlinked the proposal from its opportunity', 'Ha scollegato la proposta dalla sua opportunità', 'Desvinculou a proposta da sua oportunidade'],
  ['actividad.abrio-oportunidad', 'Abrió una oportunidad', 'Opened an opportunity', 'Ha aperto un’opportunità', 'Abriu uma oportunidade'],
  ['actividad.movio-oportunidad', 'Movió una oportunidad', 'Moved an opportunity', 'Ha spostato un’opportunità', 'Moveu uma oportunidade'],
  ['actividad.creo-organizacion-crm', 'Creó organización (CRM)', 'Created an organization (CRM)', 'Ha creato un’organizzazione (CRM)', 'Criou uma organização (CRM)'],
  ['actividad.registro-prospecto', 'Registró un prospecto', 'Recorded a prospect', 'Ha registrato un prospect', 'Registrou um prospecto'],
  ['actividad.aprobo-prospecto', 'Aprobó un prospecto', 'Approved a prospect', 'Ha approvato un prospect', 'Aprovou um prospecto'],
  ['actividad.rechazo-prospecto', 'Rechazó un prospecto', 'Rejected a prospect', 'Ha rifiutato un prospect', 'Recusou um prospecto'],
  ['actividad.confirmo-reserva', 'Confirmó reserva', 'Confirmed a booking', 'Ha confermato una prenotazione', 'Confirmou uma reserva'],
  ['actividad.reservo-tentativa', 'Reservó (tentativa)', 'Booked (tentative)', 'Ha prenotato (provvisoria)', 'Reservou (provisória)'],
  ['actividad.creo-cliente', 'Creó cliente', 'Created a client', 'Ha creato un cliente', 'Criou um cliente'],
  ['actividad.edito-cliente', 'Editó cliente', 'Edited a client', 'Ha modificato un cliente', 'Editou um cliente'],
  ['actividad.borro-cliente', 'Borró cliente', 'Deleted a client', 'Ha eliminato un cliente', 'Excluiu um cliente'],

  // ── Precios: franjas, temporadas, volumen, codigos, paquetes ──
  ['actividad.creo-franja', 'Creó una franja horaria', 'Created a daypart', 'Ha creato una fascia oraria', 'Criou uma faixa horária'],
  ['actividad.edito-franja', 'Editó una franja horaria', 'Edited a daypart', 'Ha modificato una fascia oraria', 'Editou uma faixa horária'],
  ['actividad.baja-franja', 'Dio de baja una franja horaria', 'Deactivated a daypart', 'Ha disattivato una fascia oraria', 'Desativou uma faixa horária'],
  ['actividad.creo-temporada', 'Creó una temporada', 'Created a season', 'Ha creato una stagione', 'Criou uma temporada'],
  ['actividad.edito-temporada', 'Editó una temporada', 'Edited a season', 'Ha modificato una stagione', 'Editou uma temporada'],
  ['actividad.baja-temporada', 'Dio de baja una temporada', 'Deactivated a season', 'Ha disattivato una stagione', 'Desativou uma temporada'],
  ['actividad.creo-tramo', 'Creó un tramo de descuento por volumen', 'Created a volume discount tier', 'Ha creato una fascia di sconto per volume', 'Criou uma faixa de desconto por volume'],
  ['actividad.edito-tramo', 'Editó un tramo de descuento por volumen', 'Edited a volume discount tier', 'Ha modificato una fascia di sconto per volume', 'Editou uma faixa de desconto por volume'],
  ['actividad.borro-tramo', 'Borró un tramo de descuento por volumen', 'Deleted a volume discount tier', 'Ha eliminato una fascia di sconto per volume', 'Excluiu uma faixa de desconto por volume'],
  ['actividad.creo-codigo', 'Creó un código promocional', 'Created a negotiation code', 'Ha creato un codice di negoziazione', 'Criou um código de negociação'],
  ['actividad.edito-codigo', 'Editó un código promocional', 'Edited a negotiation code', 'Ha modificato un codice di negoziazione', 'Editou um código de negociação'],
  ['actividad.borro-codigo', 'Borró un código promocional', 'Deleted a negotiation code', 'Ha eliminato un codice di negoziazione', 'Excluiu um código de negociação'],
  ['actividad.creo-paquete', 'Creó un paquete cerrado', 'Created a bundle', 'Ha creato un pacchetto', 'Criou um pacote fechado'],
  ['actividad.edito-paquete', 'Editó un paquete cerrado', 'Edited a bundle', 'Ha modificato un pacchetto', 'Editou um pacote fechado'],
  ['actividad.borro-paquete', 'Borró un paquete cerrado', 'Deleted a bundle', 'Ha eliminato un pacchetto', 'Excluiu um pacote fechado'],
  ['actividad.cambio-tarifas-franja', 'Cambió las tarifas por franja', 'Changed the daypart rates', 'Ha cambiato le tariffe per fascia oraria', 'Alterou as tarifas por faixa horária'],
  ['actividad.cambio-tarifas-unidad', 'Cambió las tarifas por unidad', 'Changed the per-unit rates', 'Ha cambiato le tariffe per unità', 'Alterou as tarifas por unidade'],

  // ── Campañas, creativos, DOOHmain, imprenta, OT ──
  ['actividad.genero-campana', 'Generó campaña desde propuesta', 'Generated a campaign from a proposal', 'Ha generato una campagna da una proposta', 'Gerou uma campanha a partir de uma proposta'],
  ['actividad.envio-campana-dominio', 'Envió campaña al dominio', 'Submitted a campaign for publishing', 'Ha inviato una campagna per la pubblicazione', 'Enviou uma campanha para publicação'],
  ['actividad.aprobo-publicacion', 'Aprobó publicación de campaña', 'Approved a campaign for publishing', 'Ha approvato la pubblicazione di una campagna', 'Aprovou a publicação de uma campanha'],
  ['actividad.rechazo-publicacion', 'Rechazó publicación de campaña', 'Rejected a campaign for publishing', 'Ha rifiutato la pubblicazione di una campagna', 'Recusou a publicação de uma campanha'],
  ['actividad.publico-doohmain', 'Publicó campaña en DOOHmain', 'Published a campaign in DOOHmain', 'Ha pubblicato una campagna in DOOHmain', 'Publicou uma campanha no DOOHmain'],
  ['actividad.publicacion-errores.uno', 'Publicación en DOOHmain con {n} error(es): {detalle}', 'Published in DOOHmain with {n} error: {detalle}', 'Pubblicazione in DOOHmain con {n} errore: {detalle}', 'Publicação no DOOHmain com {n} erro: {detalle}'],
  ['actividad.publicacion-errores.otros', 'Publicación en DOOHmain con {n} error(es): {detalle}', 'Published in DOOHmain with {n} errors: {detalle}', 'Pubblicazione in DOOHmain con {n} errori: {detalle}', 'Publicação no DOOHmain com {n} erros: {detalle}'],
  ['actividad.reintento-sin-errores', 'Reintento de publicación en DOOHmain sin errores', 'Retried publishing in DOOHmain with no errors', 'Nuovo tentativo di pubblicazione in DOOHmain senza errori', 'Nova tentativa de publicação no DOOHmain sem erros'],
  ['actividad.reintento-errores.uno', 'Reintento de publicación en DOOHmain con {n} error(es): {detalle}', 'Retried publishing in DOOHmain with {n} error: {detalle}', 'Nuovo tentativo di pubblicazione in DOOHmain con {n} errore: {detalle}', 'Nova tentativa de publicação no DOOHmain com {n} erro: {detalle}'],
  ['actividad.reintento-errores.otros', 'Reintento de publicación en DOOHmain con {n} error(es): {detalle}', 'Retried publishing in DOOHmain with {n} errors: {detalle}', 'Nuovo tentativo di pubblicazione in DOOHmain con {n} errori: {detalle}', 'Nova tentativa de publicação no DOOHmain com {n} erros: {detalle}'],
  ['actividad.extendio-campana', 'Extendió campaña {folio} hasta {fecha} con contrato', 'Extended campaign {folio} until {fecha} with a contract', 'Ha esteso la campagna {folio} fino al {fecha} con contratto', 'Estendeu a campanha {folio} até {fecha} com contrato'],
  ['actividad.campana-completada-auto', 'Campaña completada automáticamente al vencer su periodo', 'Campaign completed automatically when its period ended', 'Campagna completata automaticamente alla scadenza del periodo', 'Campanha concluída automaticamente ao fim do período'],
  ['actividad.campana-activada-auto', 'Campaña activada automáticamente al iniciar y estar publicada', 'Campaign activated automatically on starting while published', 'Campagna attivata automaticamente all’avvio, essendo pubblicata', 'Campanha ativada automaticamente ao começar estando publicada'],
  ['actividad.programo-franja.uno', 'Programó la franja «{franja}» en {n} campaña', 'Scheduled the “{franja}” daypart in {n} campaign', 'Ha programmato la fascia «{franja}» in {n} campagna', 'Programou a faixa “{franja}” em {n} campanha'],
  ['actividad.programo-franja.otros', 'Programó la franja «{franja}» en {n} campañas', 'Scheduled the “{franja}” daypart in {n} campaigns', 'Ha programmato la fascia «{franja}» in {n} campagne', 'Programou a faixa “{franja}” em {n} campanhas'],
  ['actividad.quito-franja-programada.uno', 'Quitó la franja programada de {n} campaña', 'Removed the scheduled daypart from {n} campaign', 'Ha rimosso la fascia programmata da {n} campagna', 'Removeu a faixa programada de {n} campanha'],
  ['actividad.quito-franja-programada.otros', 'Quitó la franja programada de {n} campañas', 'Removed the scheduled daypart from {n} campaigns', 'Ha rimosso la fascia programmata da {n} campagne', 'Removeu a faixa programada de {n} campanhas'],
  ['actividad.fijo-horario', 'Fijó el horario en DOOHmain: {inicio} a {fin}', 'Set the schedule in DOOHmain: {inicio} to {fin}', 'Ha fissato l’orario in DOOHmain: dalle {inicio} alle {fin}', 'Definiu o horário no DOOHmain: {inicio} às {fin}'],
  ['actividad.fijo-horario-dias', 'Fijó el horario en DOOHmain: {inicio} a {fin} (días {dias})', 'Set the schedule in DOOHmain: {inicio} to {fin} (days {dias})', 'Ha fissato l’orario in DOOHmain: dalle {inicio} alle {fin} (giorni {dias})', 'Definiu o horário no DOOHmain: {inicio} às {fin} (dias {dias})'],
  ['actividad.quito-horario', 'Quitó el horario individual en DOOHmain', 'Removed the individual schedule in DOOHmain', 'Ha rimosso l’orario individuale in DOOHmain', 'Removeu o horário individual no DOOHmain'],
  ['actividad.consulto-historial', 'Consultó el historial de pantallas en DOOHmain', 'Looked up the screen history in DOOHmain', 'Ha consultato lo storico degli schermi in DOOHmain', 'Consultou o histórico de telas no DOOHmain'],
  ['actividad.consulto-reproducciones', 'Consultó reproducciones en DOOHmain', 'Looked up plays in DOOHmain', 'Ha consultato le riproduzioni in DOOHmain', 'Consultou as exibições no DOOHmain'],
  ['actividad.subio-creativo', 'Subió creativo', 'Uploaded a creative', 'Ha caricato una creatività', 'Enviou um criativo'],
  ['actividad.reemplazo-creativo', 'Reemplazó creativo', 'Replaced a creative', 'Ha sostituito una creatività', 'Substituiu um criativo'],
  ['actividad.aprobo-creativo', 'Aprobó creativo', 'Approved a creative', 'Ha approvato una creatività', 'Aprovou um criativo'],
  ['actividad.rechazo-creativo', 'Rechazó creativo', 'Rejected a creative', 'Ha rifiutato una creatività', 'Recusou um criativo'],
  ['actividad.envio-creativo-cliente', 'Envió un creativo para revisión', 'Sent a creative for review', 'Ha inviato una creatività per la revisione', 'Enviou um criativo para revisão'],
  ['actividad.aprobo-envio-cliente', 'Aprobó creativo enviado por el cliente', 'Approved a creative sent by the client', 'Ha approvato una creatività inviata dal cliente', 'Aprovou um criativo enviado pelo cliente'],
  ['actividad.asigno-pantalla-cliente', 'Se asignó solo a la pantalla que eligió el cliente', 'Assigned only to the screen the client chose', 'Assegnata solo allo schermo scelto dal cliente', 'Atribuído apenas à tela escolhida pelo cliente'],
  ['actividad.rechazo-envio-cliente', 'Rechazó creativo enviado por el cliente', 'Rejected a creative sent by the client', 'Ha rifiutato una creatività inviata dal cliente', 'Recusou um criativo enviado pelo cliente'],
  ['actividad.retiro-creativo', 'Retiró creativo (pendiente en DOOHmain)', 'Withdrew a creative (pending in DOOHmain)', 'Ha ritirato una creatività (in sospeso in DOOHmain)', 'Retirou um criativo (pendente no DOOHmain)'],
  ['actividad.elimino-creativo', 'Eliminó creativo', 'Deleted a creative', 'Ha eliminato una creatività', 'Excluiu um criativo'],
  ['actividad.pauso-creativo', 'Pausó creativo en DOOHmain', 'Paused a creative in DOOHmain', 'Ha messo in pausa una creatività in DOOHmain', 'Pausou um criativo no DOOHmain'],
  ['actividad.reanudo-creativo', 'Reanudó creativo en DOOHmain', 'Resumed a creative in DOOHmain', 'Ha ripreso una creatività in DOOHmain', 'Retomou um criativo no DOOHmain'],
  ['actividad.repartio-creativos', 'Repartió creativos en la campaña', 'Distributed creatives across the campaign', 'Ha distribuito le creatività nella campagna', 'Distribuiu criativos na campanha'],
  ['actividad.autoasignado.uno', 'Se asignó automáticamente a {n} pantalla: los creativos aprobados rotan en partes iguales', 'Automatically assigned to {n} screen: approved creatives rotate in equal parts', 'Assegnata automaticamente a {n} schermo: le creatività approvate ruotano in parti uguali', 'Atribuído automaticamente a {n} tela: os criativos aprovados se alternam em partes iguais'],
  ['actividad.autoasignado.otros', 'Se asignó automáticamente a {n} pantallas: los creativos aprobados rotan en partes iguales', 'Automatically assigned to {n} screens: approved creatives rotate in equal parts', 'Assegnata automaticamente a {n} schermi: le creatività approvate ruotano in parti uguali', 'Atribuído automaticamente a {n} telas: os criativos aprovados se alternam em partes iguais'],
  ['actividad.creo-orden-impresion', 'Creó orden de impresión', 'Created a print order', 'Ha creato un ordine di stampa', 'Criou uma ordem de impressão'],
  ['actividad.avanzo-impresion', 'Avanzó impresión → {estatus}', 'Moved printing forward → {estatus}', 'Ha fatto avanzare la stampa → {estatus}', 'Avançou a impressão → {estatus}'],
  ['actividad.alta-imprenta', 'Dio de alta una imprenta', 'Added a print shop', 'Ha aggiunto una tipografia', 'Cadastrou uma gráfica'],
  ['actividad.actualizo-imprenta', 'Actualizó una imprenta', 'Updated a print shop', 'Ha aggiornato una tipografia', 'Atualizou uma gráfica'],
  // VALLAS (esqueleto, 19/11) · app/api/vallas/**
  ['actividad.alta-valla', 'Dio de alta una valla', 'Added a poster panel', 'Ha aggiunto un poster', 'Cadastrou um outdoor'],
  ['actividad.actualizo-valla', 'Actualizó una valla', 'Updated a poster panel', 'Ha aggiornato un poster', 'Atualizou um outdoor'],
  ['actividad.borro-valla', 'Borró una valla', 'Deleted a poster panel', 'Ha eliminato un poster', 'Excluiu um outdoor'],
  ['actividad.alta-grupo-vallas', 'Dio de alta un grupo de vallas', 'Added a poster panel group', 'Ha aggiunto un gruppo di poster', 'Cadastrou um grupo de outdoors'],
  ['actividad.actualizo-grupo-vallas', 'Actualizó un grupo de vallas', 'Updated a poster panel group', 'Ha aggiornato un gruppo di poster', 'Atualizou um grupo de outdoors'],
  ['actividad.borro-grupo-vallas', 'Borró un grupo de vallas', 'Deleted a poster panel group', 'Ha eliminato un gruppo di poster', 'Excluiu um grupo de outdoors'],
  ['actividad.alta-categoria-competencia', 'Dio de alta una categoría de competencia', 'Added a competing brands category', 'Ha aggiunto una categoria di marchi concorrenti', 'Cadastrou uma categoria de marcas concorrentes'],
  ['actividad.actualizo-categoria-competencia', 'Actualizó una categoría de competencia', 'Updated a competing brands category', 'Ha aggiornato una categoria di marchi concorrenti', 'Atualizou uma categoria de marcas concorrentes'],
  ['actividad.asigno-imprenta', 'Asignó la imprenta de una orden', 'Set the print shop of an order', 'Ha assegnato la tipografia di un ordine', 'Definiu a gráfica de uma ordem'],
  ['actividad.puso-fecha-especial', 'Puso fecha especial de impresión: {fecha}', 'Set a special print date: {fecha}', 'Ha impostato una data speciale di stampa: {fecha}', 'Definiu uma data especial de impressão: {fecha}'],
  ['actividad.quito-fecha-especial', 'Quitó la fecha especial de impresión', 'Removed the special print date', 'Ha tolto la data speciale di stampa', 'Removeu a data especial de impressão'],
  ['actividad.aprobo-prueba-color', 'Aprobó prueba de color', 'Approved a color proof', 'Ha approvato una prova colore', 'Aprovou uma prova de cor'],
  ['actividad.prueba-color-pendiente', 'Marcó prueba de color pendiente', 'Marked a color proof as pending', 'Ha segnato una prova colore come in sospeso', 'Marcou uma prova de cor como pendente'],
  ['actividad.creo-ot', 'Creó OT', 'Created a work order', 'Ha creato un OdL', 'Criou uma OS'],
  ['actividad.cerro-ot-testigo', 'Cerró OT con testigo', 'Closed a work order with proof', 'Ha chiuso un OdL con prova', 'Fechou uma OS com comprovação'],
  ['actividad.reporto-incidencia', 'Reportó incidencia', 'Reported an issue', 'Ha segnalato un problema', 'Reportou uma ocorrência'],
  ['actividad.borro-costo-ot', 'Borró el costo real de la OT (vuelve a la estimación por tipo)', 'Cleared the work order’s actual cost (back to the estimate by type)', 'Ha cancellato il costo reale dell’OdL (torna alla stima per tipo)', 'Apagou o custo real da OS (volta à estimativa por tipo)'],
  ['actividad.capturo-costo-ot', 'Capturó el costo real de la OT: {monto}', 'Entered the work order’s actual cost: {monto}', 'Ha registrato il costo reale dell’OdL: {monto}', 'Registrou o custo real da OS: {monto}'],

  // ── Finanzas ──
  ['actividad.genero-factura', 'Generó factura', 'Generated an invoice', 'Ha generato una fattura', 'Gerou uma fatura'],
  ['actividad.registro-pago-liquidado', 'Registró pago {monto} (liquidado)', 'Recorded payment {monto} (paid in full)', 'Ha registrato un pagamento di {monto} (saldato)', 'Registrou pagamento de {monto} (quitado)'],
  ['actividad.registro-abono', 'Registró abono {monto}', 'Recorded partial payment {monto}', 'Ha registrato un acconto di {monto}', 'Registrou pagamento parcial de {monto}'],
  ['actividad.envio-recordatorio-cobro', 'Envió recordatorio de cobro', 'Sent a collection reminder', 'Ha inviato un promemoria di incasso', 'Enviou um lembrete de cobrança'],
  ['actividad.registro-oc', 'Registró OC del cliente', 'Recorded the client’s PO', 'Ha registrato l’ordine d’acquisto del cliente', 'Registrou o pedido de compra do cliente'],
  ['actividad.registro-odc', 'Registró ODC del cliente', 'Recorded the client’s PO', 'Ha registrato l’ordine d’acquisto del cliente', 'Registrou o pedido de compra do cliente'],
  ['actividad.adjunto-comprobante', 'Adjuntó comprobante de pago', 'Attached a proof of payment', 'Ha allegato una prova di pagamento', 'Anexou um comprovante de pagamento'],
  ['actividad.actualizo-adjuntos-pago', 'Actualizó adjuntos del pago', 'Updated the payment attachments', 'Ha aggiornato gli allegati del pagamento', 'Atualizou os anexos do pagamento'],
  ['actividad.adjunto-contrato-cliente', 'Adjuntó contrato del cliente', 'Attached the client’s contract', 'Ha allegato il contratto del cliente', 'Anexou o contrato do cliente'],
  ['actividad.capturo-recibo-luz', 'Capturó recibo de luz', 'Entered an electricity bill', 'Ha registrato una bolletta elettrica', 'Registrou uma conta de luz'],
  ['actividad.borro-recibo-luz', 'Borró recibo de luz', 'Deleted an electricity bill', 'Ha eliminato una bolletta elettrica', 'Excluiu uma conta de luz'],

  // ── Inventario, arrendadores, almacén ──
  ['actividad.dio-alta-pantalla', 'Dio de alta pantalla', 'Added a screen', 'Ha registrato uno schermo', 'Cadastrou uma tela'],
  ['actividad.edito-pantalla', 'Editó pantalla', 'Edited a screen', 'Ha modificato uno schermo', 'Editou uma tela'],
  ['actividad.elimino-pantalla', 'Eliminó pantalla', 'Deleted a screen', 'Ha eliminato uno schermo', 'Excluiu uma tela'],
  ['actividad.importo-inventario', 'Importó inventario', 'Imported inventory', 'Ha importato l’inventario', 'Importou o inventário'],
  ['actividad.compartio-network', 'Compartió en Network', 'Shared on the Network', 'Ha condiviso nel Network', 'Compartilhou na Network'],
  ['actividad.quito-network', 'Quitó de Network', 'Removed from the Network', 'Ha rimosso dal Network', 'Removeu da Network'],
  ['actividad.pauso-legal', 'Pausó por situación legal', 'Paused for legal reasons', 'Ha sospeso per motivi legali', 'Pausou por questão legal'],
  ['actividad.reanudo-legal', 'Reanudó (fin de pausa legal)', 'Resumed (end of legal pause)', 'Ha ripreso (fine della sospensione legale)', 'Retomou (fim da pausa legal)'],
  ['actividad.reubico-pantalla', 'Reubicó pantalla al predio {predio}', 'Moved the screen to property {predio}', 'Ha spostato lo schermo nell’immobile {predio}', 'Realocou a tela para o imóvel {predio}'],
  ['actividad.creo-predio', 'Creó predio', 'Created a property', 'Ha creato un immobile', 'Criou um imóvel'],
  ['actividad.edito-predio', 'Editó predio', 'Edited a property', 'Ha modificato un immobile', 'Editou um imóvel'],
  ['actividad.agrego-pantalla-predio', 'Agregó pantalla al predio', 'Added a screen to the property', 'Ha aggiunto uno schermo all’immobile', 'Adicionou uma tela ao imóvel'],
  ['actividad.creo-propietario', 'Creó propietario', 'Created a landlord', 'Ha creato un locatore', 'Criou um locador'],
  ['actividad.edito-propietario', 'Editó propietario', 'Edited a landlord', 'Ha modificato un locatore', 'Editou um locador'],
  ['actividad.borro-propietario', 'Borró propietario (soft-delete)', 'Deleted a landlord (can be restored)', 'Ha eliminato un locatore (recuperabile)', 'Excluiu um locador (recuperável)'],
  ['actividad.cambio-datos-bancarios', 'Cambió datos bancarios del propietario', 'Changed the landlord’s bank details', 'Ha cambiato i dati bancari del locatore', 'Alterou os dados bancários do locador'],
  ['actividad.creo-contrato-arrendamiento', 'Creó contrato de arrendamiento', 'Created a lease contract', 'Ha creato un contratto di locazione', 'Criou um contrato de locação'],
  ['actividad.completo-contrato-arrendamiento', 'Completó contrato de arrendamiento', 'Completed a lease contract', 'Ha completato un contratto di locazione', 'Completou um contrato de locação'],
  ['actividad.edito-contrato', 'Editó contrato', 'Edited a contract', 'Ha modificato un contratto', 'Editou um contrato'],
  ['actividad.cancelo-contrato', 'Canceló contrato', 'Cancelled a contract', 'Ha annullato un contratto', 'Cancelou um contrato'],
  ['actividad.envio-contrato-firma', 'Envió contrato a firma', 'Sent a contract for signature', 'Ha inviato un contratto alla firma', 'Enviou um contrato para assinatura'],
  ['actividad.firmo-contrato', 'Firmó contrato (arrendatario)', 'Signed a contract (lessee)', 'Ha firmato un contratto (locatario)', 'Assinou um contrato (locatário)'],
  ['actividad.inicio-renovacion', 'Inició renovación de contrato', 'Started a contract renewal', 'Ha avviato il rinnovo di un contratto', 'Iniciou a renovação de um contrato'],
  ['actividad.registro-pago-renta', 'Registró pago de renta', 'Recorded a rent payment', 'Ha registrato un pagamento d’affitto', 'Registrou um pagamento de aluguel'],
  ['actividad.registro-licencia', 'Registró licencia', 'Recorded a license', 'Ha registrato una licenza', 'Registrou uma licença'],
  ['actividad.edito-licencia', 'Editó licencia', 'Edited a license', 'Ha modificato una licenza', 'Editou uma licença'],
  ['actividad.borro-licencia', 'Borró licencia', 'Deleted a license', 'Ha eliminato una licenza', 'Excluiu uma licença'],
  ['actividad.registro-activo', 'Registró activo en almacén', 'Registered an asset in the warehouse', 'Ha registrato un bene in magazzino', 'Registrou um ativo no almoxarifado'],
  ['actividad.movio-activo', 'Movió activo', 'Moved an asset', 'Ha spostato un bene', 'Moveu um ativo'],
  ['actividad.regreso-almacen', 'Regresó a almacén', 'Returned to the warehouse', 'È tornato in magazzino', 'Voltou ao almoxarifado'],
  ['actividad.instalo-activo', 'Instaló activo', 'Installed an asset', 'Ha installato un bene', 'Instalou um ativo'],
  ['actividad.puso-traslado', 'Puso en traslado', 'Put in transit', 'Ha messo in trasferimento', 'Colocou em trânsito'],
  ['actividad.baja-activo', 'Dio de baja activo', 'Retired an asset', 'Ha dismesso un bene', 'Baixou um ativo'],

  // ── Space Eyes ──
  ['actividad.pidio-foto', 'Pidió una foto a Space Eyes', 'Requested a photo from Space Eyes', 'Ha richiesto una foto a Space Eyes', 'Pediu uma foto ao Space Eyes'],
  ['actividad.cambio-encuadre', 'Cambió el encuadre de un equipo de Space Eyes', 'Changed the framing of a Space Eyes device', 'Ha cambiato l’inquadratura di un dispositivo Space Eyes', 'Alterou o enquadramento de um equipamento Space Eyes'],
  ['actividad.cambio-llave-correo', 'Cambió la llave de correo de los avisos de Space Eyes', 'Changed the email key for Space Eyes alerts', 'Ha cambiato la chiave email degli avvisi di Space Eyes', 'Alterou a chave de e-mail dos avisos do Space Eyes'],
  ['actividad.reinicio-equipo', 'Reinició un equipo de Space Eyes', 'Restarted a Space Eyes device', 'Ha riavviato un dispositivo Space Eyes', 'Reiniciou um equipamento Space Eyes'],
  ['actividad.reinicio-app', 'Reinició la app de un equipo de Space Eyes', 'Restarted the app on a Space Eyes device', 'Ha riavviato l’app di un dispositivo Space Eyes', 'Reiniciou o app de um equipamento Space Eyes'],
  ['actividad.actualizo-app', 'Actualizó la app de un equipo de Space Eyes', 'Updated the app on a Space Eyes device', 'Ha aggiornato l’app di un dispositivo Space Eyes', 'Atualizou o app de um equipamento Space Eyes'],

  // ── Administración, cuenta, empresa ──
  ['actividad.invito-usuario', 'Invitó usuario', 'Invited a user', 'Ha invitato un utente', 'Convidou um usuário'],
  ['actividad.edito-usuario', 'Editó usuario', 'Edited user', 'Ha modificato l’utente', 'Editou o usuário'],
  ['actividad.elimino-usuario', 'Eliminó usuario', 'Deleted user', 'Ha eliminato l’utente', 'Excluiu o usuário'],
  ['actividad.activo-usuario', 'Activó usuario', 'Activated user', 'Ha attivato l’utente', 'Ativou o usuário'],
  ['actividad.desactivo-usuario', 'Desactivó usuario', 'Deactivated user', 'Ha disattivato l’utente', 'Desativou o usuário'],
  ['actividad.cambio-rol', 'Cambió rol', 'Changed the role of', 'Ha cambiato il ruolo di', 'Alterou a função de'],
  ['actividad.cambio-contrasena-de', 'Cambió la contraseña de', 'Changed the password of', 'Ha cambiato la password di', 'Alterou a senha de'],
  ['actividad.restablecio-contrasena-de', 'Restableció la contraseña de', 'Reset the password of', 'Ha reimpostato la password di', 'Redefiniu a senha de'],
  ['actividad.concedio-permiso', 'Concedió permiso', 'Granted a permission', 'Ha concesso un permesso', 'Concedeu uma permissão'],
  ['actividad.quito-permiso', 'Quitó permiso', 'Removed a permission', 'Ha tolto un permesso', 'Removeu uma permissão'],
  ['actividad.actualizo-cuenta', 'Actualizó su cuenta', 'Updated their account', 'Ha aggiornato il proprio account', 'Atualizou a própria conta'],
  ['actividad.regenero-codigos', 'Regeneró sus códigos de recuperación', 'Regenerated their recovery codes', 'Ha rigenerato i propri codici di recupero', 'Gerou novamente seus códigos de recuperação'],
  ['actividad.vinculo-google', 'Vinculó su cuenta de Google', 'Linked their Google account', 'Ha collegato il proprio account Google', 'Vinculou sua conta do Google'],
  ['actividad.actualizo-configuracion', 'Actualizó configuración', 'Updated settings', 'Ha aggiornato le impostazioni', 'Atualizou as configurações'],
  ['actividad.renombro-empresa', 'Renombró la empresa', 'Renamed the company', 'Ha rinominato l’azienda', 'Renomeou a empresa'],
  ['actividad.contesto-cuestionario', 'Contestó el cuestionario de bienvenida', 'Answered the welcome questionnaire', 'Ha risposto al questionario di benvenuto', 'Respondeu ao questionário de boas-vindas'],
  ['actividad.abrio-ticket', 'Abrió ticket de soporte', 'Opened a support ticket', 'Ha aperto un ticket di assistenza', 'Abriu um chamado de suporte'],
  ['actividad.activo-control', 'Activó el control de cambios', 'Turned on change control', 'Ha attivato il controllo delle modifiche', 'Ativou o controle de alterações'],
  ['actividad.desactivo-control', 'Desactivó el control de cambios', 'Turned off change control', 'Ha disattivato il controllo delle modifiche', 'Desativou o controle de alterações'],
  ['actividad.asigno-contrasena-cambios', 'Asignó la contraseña del control de cambios', 'Set the change-control password', 'Ha impostato la password del controllo delle modifiche', 'Definiu a senha do controle de alterações'],
  ['actividad.desbloqueo-cambios', 'Desbloqueó los cambios', 'Unlocked changes', 'Ha sbloccato le modifiche', 'Desbloqueou as alterações'],
  ['actividad.contrasena-cambios-incorrecta', 'Contraseña de cambios incorrecta', 'Wrong change-control password', 'Password del controllo delle modifiche errata', 'Senha do controle de alterações incorreta'],
  ['actividad.cambio-modo-actualizacion', 'Cambio el modo de actualizacion a "{modo}"', 'Changed the update mode to “{modo}”', 'Ha cambiato la modalità di aggiornamento in «{modo}»', 'Alterou o modo de atualização para “{modo}”'],
  ['actividad.aprobo-instalar-version', 'Aprobo instalar la version disponible', 'Approved installing the available version', 'Ha approvato l’installazione della versione disponibile', 'Aprovou a instalação da versão disponível'],
  ['actividad.cambio-idiomas', 'Cambio los idiomas del servidor: {idiomas}', 'Changed the server languages: {idiomas}', 'Ha cambiato le lingue del server: {idiomas}', 'Alterou os idiomas do servidor: {idiomas}'],
  ['actividad.creo-razon-social', 'Creó razón social', 'Created a legal entity', 'Ha creato una ragione sociale', 'Criou uma razão social'],
  ['actividad.creo-razon-social-asigno.uno', 'Creó razón social y la asignó a {n} contrato(s) sin razón social', 'Created a legal entity and assigned it to {n} contract without one', 'Ha creato una ragione sociale e l’ha assegnata a {n} contratto che non ne aveva', 'Criou uma razão social e a atribuiu a {n} contrato sem razão social'],
  ['actividad.creo-razon-social-asigno.otros', 'Creó razón social y la asignó a {n} contrato(s) sin razón social', 'Created a legal entity and assigned it to {n} contracts without one', 'Ha creato una ragione sociale e l’ha assegnata a {n} contratti che non ne avevano', 'Criou uma razão social e a atribuiu a {n} contratos sem razão social'],
  ['actividad.edito-razon-social', 'Editó razón social', 'Edited a legal entity', 'Ha modificato una ragione sociale', 'Editou uma razão social'],
  ['actividad.elimino-razon-social', 'Eliminó razón social', 'Deleted a legal entity', 'Ha eliminato una ragione sociale', 'Excluiu uma razão social'],
  ['actividad.creo-entidad', 'Creó entidad fiscal', 'Created a legal entity', 'Ha creato un’entità fiscale', 'Criou uma entidade fiscal'],
  ['actividad.creo-entidad-roles', 'Creó entidad fiscal ({roles})', 'Created a legal entity ({roles})', 'Ha creato un’entità fiscale ({roles})', 'Criou uma entidade fiscal ({roles})'],
  ['actividad.edito-entidad', 'Editó entidad fiscal', 'Edited a legal entity', 'Ha modificato un’entità fiscale', 'Editou uma entidade fiscal'],
  ['actividad.baja-entidad', 'Dio de baja una entidad fiscal', 'Deactivated a legal entity', 'Ha disattivato un’entità fiscale', 'Desativou uma entidade fiscal'],

  // ── Lo que el servidor escribe en la ENTIDAD (no en la accion) ──
  ['actividad.entidad.actualizaciones', 'Actualizaciones', 'Updates', 'Aggiornamenti', 'Atualizações'],
  ['actividad.entidad.contrasena-rotada', 'Contraseña compartida rotada', 'Shared password rotated', 'Password condivisa cambiata', 'Senha compartilhada trocada'],
  ['actividad.entidad.idiomas', 'Idiomas', 'Languages', 'Lingue', 'Idiomas'],
  ['actividad.entidad.desbloqueo-fallido', 'Intento fallido de desbloqueo', 'Failed unlock attempt', 'Tentativo di sblocco non riuscito', 'Tentativa de desbloqueio malsucedida'],
  ['actividad.entidad.codigos-anteriores', 'Los anteriores dejaron de valer', 'The previous ones are no longer valid', 'I precedenti non sono più validi', 'Os anteriores deixaram de valer'],
  ['actividad.entidad.negocio', 'Negocio', 'Business', 'Attività', 'Negócio'],
  ['actividad.entidad.avisos', 'avisos', 'alerts', 'avvisi', 'avisos'],
  ['actividad.entidad.equipo', 'equipo {id}', 'device {id}', 'dispositivo {id}', 'equipamento {id}'],
  ['actividad.entidad.desbloqueo-hasta', 'Con la contraseña del Dueño, hasta {hora}', 'With the Owner’s password, until {hora}', 'Con la password del Titolare, fino alle {hora}', 'Com a senha do Proprietário, até {hora}'],
  ['actividad.entidad.codigo-alta', '{codigo}: {pct} % · del {desde} al {hasta} · {usos} usos', '{codigo}: {pct}% · from {desde} to {hasta} · {usos} uses', '{codigo}: {pct}% · dal {desde} al {hasta} · {usos} utilizzi', '{codigo}: {pct}% · de {desde} a {hasta} · {usos} usos'],
  ['actividad.entidad.codigo-alta-sin-tope', '{codigo}: {pct} % · del {desde} al {hasta} · sin tope de usos', '{codigo}: {pct}% · from {desde} to {hasta} · no usage cap', '{codigo}: {pct}% · dal {desde} al {hasta} · senza limite di utilizzi', '{codigo}: {pct}% · de {desde} a {hasta} · sem limite de usos'],
  ['actividad.entidad.codigo-vigencia', '{codigo}: {pct} % · del {desde} al {hasta}', '{codigo}: {pct}% · from {desde} to {hasta}', '{codigo}: {pct}% · dal {desde} al {hasta}', '{codigo}: {pct}% · de {desde} a {hasta}'],
  ['actividad.entidad.codigo-pct', '{codigo}: {pct} %', '{codigo}: {pct}%', '{codigo}: {pct}%', '{codigo}: {pct}%'],
  ['actividad.entidad.paquete-admite.uno', '{nombre}: {monto} por {n} pantalla(s) · admite código promocional', '{nombre}: {monto} for {n} screen · accepts negotiation codes', '{nombre}: {monto} per {n} schermo · ammette codici di negoziazione', '{nombre}: {monto} por {n} tela · aceita código de negociação'],
  ['actividad.entidad.paquete-admite.otros', '{nombre}: {monto} por {n} pantalla(s) · admite código promocional', '{nombre}: {monto} for {n} screens · accepts negotiation codes', '{nombre}: {monto} per {n} schermi · ammette codici di negoziazione', '{nombre}: {monto} por {n} telas · aceita código de negociação'],
  ['actividad.entidad.paquete-final.uno', '{nombre}: {monto} por {n} pantalla(s) · precio final, sin códigos', '{nombre}: {monto} for {n} screen · final price, no negotiation codes', '{nombre}: {monto} per {n} schermo · prezzo finale, senza codici', '{nombre}: {monto} por {n} tela · preço final, sem códigos'],
  ['actividad.entidad.paquete-final.otros', '{nombre}: {monto} por {n} pantalla(s) · precio final, sin códigos', '{nombre}: {monto} for {n} screens · final price, no negotiation codes', '{nombre}: {monto} per {n} schermi · prezzo finale, senza codici', '{nombre}: {monto} por {n} telas · preço final, sem códigos'],
  ['actividad.entidad.paquete-aplicado.uno', '{nombre}: {monto} por {n} pantalla(s) — el precio del paquete SUSTITUYE la suma de las tarifas de lista', '{nombre}: {monto} for {n} screen — the bundle price REPLACES the sum of the list rates', '{nombre}: {monto} per {n} schermo — il prezzo del pacchetto SOSTITUISCE la somma delle tariffe di listino', '{nombre}: {monto} por {n} tela — o preço do pacote SUBSTITUI a soma das tarifas de tabela'],
  ['actividad.entidad.paquete-aplicado.otros', '{nombre}: {monto} por {n} pantalla(s) — el precio del paquete SUSTITUYE la suma de las tarifas de lista', '{nombre}: {monto} for {n} screens — the bundle price REPLACES the sum of the list rates', '{nombre}: {monto} per {n} schermi — il prezzo del pacchetto SOSTITUISCE la somma delle tariffe di listino', '{nombre}: {monto} por {n} telas — o preço do pacote SUBSTITUI a soma das tarifas de tabela'],
  ['actividad.entidad.paquete-quitado', '{id} — vuelve a los precios de lista de cada pantalla', '{id} — back to each screen’s list rate', '{id} — torna alle tariffe di listino di ogni schermo', '{id} — volta às tarifas de tabela de cada tela'],
  ['actividad.entidad.tramo', '{unidad}: desde {n} → {pct} %', '{unidad}: from {n} → {pct}%', '{unidad}: da {n} → {pct}%', '{unidad}: a partir de {n} → {pct}%'],
  ['actividad.entidad.licencia', '{licencia} — vence {fechaA}', '{licencia} — expires {fechaA}', '{licencia} — scade il {fechaA}', '{licencia} — vence em {fechaA}'],
  ['actividad.entidad.recibo-luz', '{periodo} — {kwh} kWh por {monto}', '{periodo} — {kwh} kWh for {monto}', '{periodo} — {kwh} kWh per {monto}', '{periodo} — {kwh} kWh por {monto}'],
  ['actividad.entidad.recibo-luz-medidor', '{periodo} — {kwh} kWh por {monto} (medidor {medidor})', '{periodo} — {kwh} kWh for {monto} (meter {medidor})', '{periodo} — {kwh} kWh per {monto} (contatore {medidor})', '{periodo} — {kwh} kWh por {monto} (medidor {medidor})'],
  ['actividad.entidad.rango-fechas', '{fechaA} a {fechaB}', '{fechaA} to {fechaB}', 'dal {fechaA} al {fechaB}', '{fechaA} a {fechaB}'],
  ['actividad.entidad.pantallas.uno', '{n} pantalla(s)', '{n} screen', '{n} schermo', '{n} tela'],
  ['actividad.entidad.pantallas.otros', '{n} pantalla(s)', '{n} screens', '{n} schermi', '{n} telas'],
  ['actividad.entidad.importacion', '{n} nuevos · {m} actualizados', '{n} new · {m} updated', '{n} nuovi · {m} aggiornati', '{n} novos · {m} atualizados'],
  ['actividad.entidad.sesiones-cerradas', '{usuario} · se cerraron sus sesiones y deberá cambiarla al entrar', '{usuario} · their sessions were closed and they must change it when signing in', '{usuario} · le sue sessioni sono state chiuse e dovrà cambiarla all’accesso', '{usuario} · as sessões foram encerradas e será preciso trocá-la ao entrar'],

  // ── Quien lo hizo, cuando no es una persona de la organizacion ──
  ['actividad.quien.sistema', 'Sistema', 'System', 'Sistema', 'Sistema'],
  ['actividad.quien.cliente-liga', 'Cliente (liga pública): {nombre}', 'Client (public link): {nombre}', 'Cliente (link pubblico): {nombre}', 'Cliente (link público): {nombre}'],
] as const satisfies readonly Fila[]

export type ClaveActividad = (typeof FILAS)[number][0]

const columna = (i: 1 | 2 | 3 | 4) =>
  Object.fromEntries(FILAS.map((f) => [f[0], f[i]])) as Record<ClaveActividad, string>

export const ES_ACTIVIDAD = columna(1)
export const EN_ACTIVIDAD = columna(2)
export const IT_ACTIVIDAD = columna(3)
export const PT_ACTIVIDAD = columna(4)
