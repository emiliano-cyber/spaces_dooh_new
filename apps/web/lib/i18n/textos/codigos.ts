// ============================================================================
//  lib/i18n/textos/codigos.ts — LOS TEXTOS DE LOS CODIGOS DE NEGOCIACION.
// ----------------------------------------------------------------------------
//  Lote «comercial» de la version en ingles (2026-11-02): la pantalla
//  `/codigos-promocionales` (`app/(app)/(shell)/codigos-promocionales/page.tsx`)
//  y su lista y alta (`components/demo/codigos/GestionCodigos.tsx`). El bloque
//  del codigo DENTRO de una propuesta (`BloqueCodigoPropuesta`) ya lo tradujo el
//  piloto y vive en `textos/propuestas.ts`.
//
//  Mismas reglas que `textos/propuestas.ts` y `textos/comercial.ts`: claves en
//  espanol, espanol LITERAL, `EN_CODIGOS` como `Record` (una clave que falte no
//  compila), ni dinero ni moneda, frases con negritas ENTERAS y con huecos.
//
//  GLOSARIO: codigo promocional / cupon / codigo de negociacion → «negotiation
//  code», como el menu («Negotiation codes», decision del dueno del
//  2026-11-02). Donde la frase ya lo dejo claro, basta «code» para no repetir.
//  Porcentajes en ingles SIN espacio («20%»); el espanol conserva su «20 %».
// ============================================================================

export const ES_CODIGOS = {
  // ── La pagina ──
  'codigos.pagina.titulo': 'Códigos de negociación',
  'codigos.pagina.descripcion':
    'Códigos con vencimiento y cupo que un vendedor aplica a una cotización. Los pone esta empresa y no se comparten con nadie más.',

  // ── Estados (el chip de cada fila y los conteos del encabezado) ──
  'codigos.estado.vigente': 'Vigente',
  'codigos.estado.proximo': 'Próximo',
  'codigos.estado.vencido': 'Vencido',
  'codigos.estado.agotado': 'Agotado',
  'codigos.estados.vigentes': 'Vigentes',
  'codigos.estados.proximos': 'Próximos',
  'codigos.estados.agotados': 'Agotados',
  'codigos.estados.vencidos': 'Vencidos',

  // ── Mensajes ──
  'codigos.error.leer': 'No se pudieron leer los códigos',
  'codigos.error.guardar': 'No se pudo guardar',
  'codigos.error.eliminar': 'No se pudo eliminar',
  'codigos.error.elige-propuesta': 'Elige la propuesta a la que se asigna el código',
  'codigos.error.asignar': 'No se pudo asignar',
  'codigos.asignado': 'Código {codigo} asignado a {folio}: pendiente de aprobación',
  'codigos.asignado.reactivada': 'Código {codigo} asignado a {folio}: pendiente de aprobación. La propuesta vuelve a borrador.',
  'codigos.cargando': 'Cargando los códigos',

  // ── El aviso de arriba ──
  'codigos.aviso.uso': 'El uso se cuenta cuando alguien aplica el código a una cotización, no cuando se cierra la venta.',
  'codigos.aviso.por-que':
    'Es lo que permite decirle al cliente «sí, tu código vale» en el momento en que lo teclea, en vez de descubrir al firmar que ya se había acabado. A cambio, una cotización abandonada con el código puesto retiene un uso: quitarle el código, o borrarla, lo devuelve.',
  'codigos.aviso.compone':
    'Y se {compone} con las demás capas: un 20 % por volumen, un 20 % comercial y un 20 % de código dejan al cliente pagando el {resultado}, no el 40 %.',
  'codigos.aviso.compone.palabra': 'compone',
  'codigos.aviso.compone.resultado': '51,2 %',

  // ── La lista ──
  'codigos.lista.titulo': 'Códigos de esta empresa',
  'codigos.lista.subtitulo': 'Solo de esta empresa · vigencia inclusiva',
  'codigos.lista.ayuda':
    'Las promociones las pone cada empresa: estos códigos no se comparten con nadie más. Los dos extremos de la vigencia son {inclusivos} — «hasta el 30» incluye el 30. Dejar el tope de usos vacío significa {sinTope}; entonces el único freno es la fecha.',
  'codigos.lista.inclusivos': 'inclusivos',
  'codigos.col.codigo': 'Código',
  'codigos.col.estado': 'Estado',
  'codigos.col.descuento': 'Descuento',
  'codigos.col.vigencia': 'Vigencia',
  'codigos.col.usos': 'Usos',
  'codigos.lista.vacia': 'Todavía no hay ninguno. Sin códigos, todo se vende como hoy.',
  'codigos.pct': '{pct} %',
  'codigos.usos': '{usos} de {tope}',
  'codigos.usos.sin-tope': '{usos} de sin tope',
  'codigos.sin-tope': 'sin tope',
  'codigos.asignar-a-propuesta': 'Asignar a propuesta',
  'codigos.eliminar.ayuda':
    'Eliminar: deja de poder aplicarse. Lo ya cotizado y lo ya aprobado no se mueven, pero su cuenta de usos se pierde: si vuelves a crearlo con el mismo código, empieza de cero.',
  'codigos.eliminar': 'Eliminar',

  // ── Asignar a una propuesta ──
  'codigos.asignar.sin-propuestas':
    'No hay propuestas a las que asignarlo: solo se puede en una propuesta en borrador, enviada o rechazada, y que no lleve ya otro código.',
  'codigos.asignar.propuesta-para': 'Propuesta para {codigo}',
  'codigos.asignar.elige': 'Elige una propuesta…',
  'codigos.asignar.sin-cliente': 'sin cliente',
  'codigos.asignar.asignando': 'Asignando…',
  'codigos.asignar.asignar': 'Asignar',
  'codigos.asignar.ayuda':
    'Consume un uso del código y queda {pendiente}: el cliente no lo ve hasta que un administrador o gerente lo apruebe desde la propuesta.',
  'codigos.asignar.pendiente': 'pendiente de aprobación',
  'codigos.asignar.rechazada': ' Esta propuesta está rechazada: asignarle el código la reactiva a borrador.',

  // ── El alta ──
  'codigos.nuevo.titulo': 'Nuevo código',
  'codigos.nuevo.codigo': 'Código',
  'codigos.nuevo.descuento': 'Descuento (%)',
  'codigos.nuevo.descuento-etiqueta': 'Descuento por ciento',
  'codigos.nuevo.desde': 'Vigente desde',
  'codigos.nuevo.hasta': 'Vigente hasta',
  'codigos.nuevo.tope': 'Tope de usos',
  'codigos.nuevo.tope-etiqueta': 'Tope de usos (vacío = sin tope)',
  'codigos.nuevo.anadir': 'Añadir código',
  'codigos.obligatorio': ' (obligatorio)',
} as const

export type ClaveCodigos = keyof typeof ES_CODIGOS

export const EN_CODIGOS: Record<ClaveCodigos, string> = {
  'codigos.pagina.titulo': 'Negotiation codes',
  'codigos.pagina.descripcion':
    'Codes with an expiry date and a usage cap that a sales rep applies to a quote. This company sets them and they are not shared with anyone else.',

  'codigos.estado.vigente': 'Active',
  'codigos.estado.proximo': 'Upcoming',
  'codigos.estado.vencido': 'Expired',
  'codigos.estado.agotado': 'Limit reached',
  'codigos.estados.vigentes': 'Active',
  'codigos.estados.proximos': 'Upcoming',
  'codigos.estados.agotados': 'Limit reached',
  'codigos.estados.vencidos': 'Expired',

  'codigos.error.leer': 'Could not load the negotiation codes',
  'codigos.error.guardar': 'Could not save',
  'codigos.error.eliminar': 'Could not delete',
  'codigos.error.elige-propuesta': 'Choose the proposal to assign the code to',
  'codigos.error.asignar': 'Could not assign',
  'codigos.asignado': 'Negotiation code {codigo} assigned to {folio}: pending approval',
  'codigos.asignado.reactivada':
    'Negotiation code {codigo} assigned to {folio}: pending approval. The proposal goes back to draft.',
  'codigos.cargando': 'Loading negotiation codes',

  'codigos.aviso.uso': 'A use is counted when someone applies the code to a quote, not when the sale closes.',
  'codigos.aviso.por-que':
    'That is what lets you tell the client “yes, your code is valid” the moment they enter it, instead of finding out at signing that it had run out. In exchange, an abandoned quote with the code applied holds on to a use: removing the code, or deleting the quote, gives it back.',
  'codigos.aviso.compone':
    'And it {compone} with the other layers: 20% volume, 20% commercial and 20% code discounts leave the client paying {resultado}, not 40%.',
  'codigos.aviso.compone.palabra': 'compounds',
  'codigos.aviso.compone.resultado': '51.2%',

  'codigos.lista.titulo': 'Negotiation codes for this company',
  'codigos.lista.subtitulo': 'This company only · validity dates inclusive',
  'codigos.lista.ayuda':
    'Each company sets its own promotions: these codes are not shared with anyone else. Both ends of the validity period are {inclusivos} — “until the 30th” includes the 30th. Leaving the usage cap empty means {sinTope}; then the only limit is the date.',
  'codigos.lista.inclusivos': 'inclusive',
  'codigos.col.codigo': 'Code',
  'codigos.col.estado': 'Status',
  'codigos.col.descuento': 'Discount',
  'codigos.col.vigencia': 'Validity',
  'codigos.col.usos': 'Uses',
  'codigos.lista.vacia': 'None yet. Without negotiation codes, everything sells as it does today.',
  'codigos.pct': '{pct}%',
  'codigos.usos': '{usos} of {tope}',
  'codigos.usos.sin-tope': '{usos} (no cap)',
  'codigos.sin-tope': 'no cap',
  'codigos.asignar-a-propuesta': 'Assign to proposal',
  'codigos.eliminar.ayuda':
    'Delete: it can no longer be applied. What was already quoted or approved does not change, but its usage count is lost: if you create it again with the same code, it starts from zero.',
  'codigos.eliminar': 'Delete',

  'codigos.asignar.sin-propuestas':
    'There are no proposals to assign it to: it can only go on a draft, sent or rejected proposal that does not already have another code.',
  'codigos.asignar.propuesta-para': 'Proposal for {codigo}',
  'codigos.asignar.elige': 'Choose a proposal…',
  'codigos.asignar.sin-cliente': 'no client',
  'codigos.asignar.asignando': 'Assigning…',
  'codigos.asignar.asignar': 'Assign',
  'codigos.asignar.ayuda':
    'It consumes one use of the code and stays {pendiente}: the client does not see it until an admin or manager approves it from the proposal.',
  'codigos.asignar.pendiente': 'pending approval',
  'codigos.asignar.rechazada': ' This proposal is rejected: assigning the code reactivates it as a draft.',

  'codigos.nuevo.titulo': 'New negotiation code',
  'codigos.nuevo.codigo': 'Code',
  'codigos.nuevo.descuento': 'Discount (%)',
  'codigos.nuevo.descuento-etiqueta': 'Discount percentage',
  'codigos.nuevo.desde': 'Valid from',
  'codigos.nuevo.hasta': 'Valid until',
  'codigos.nuevo.tope': 'Usage cap',
  'codigos.nuevo.tope-etiqueta': 'Usage cap (empty = no cap)',
  'codigos.nuevo.anadir': 'Add negotiation code',
  'codigos.obligatorio': ' (required)',
}

// ─── ITALIANO · lote L2 «Comercial y propuestas» (2026-11-03) ──────────────
// Completo: desde este lote el tipo es `Record` y `tsc` exige cada clave, como
// en el ingles. Traducido desde el ESPANOL (el ingles solo como apoyo).
// Glosario (`vault/03-Frontend/italiano-olas.md`): codigo promocional / cupon /
// codigo de negociacion → «codice di negoziazione» (donde la frase ya lo dejo
// claro, basta «codice»); vigente → «attivo»; agotado → «Limite raggiunto»;
// vendedor → «commerciale»; cotizacion → «preventivo». Registro de «tu»
// («Scegli», «Aggiungi»). Porcentajes sin espacio («20%»), como el ingles.
// «Se compone» → «si applica a cascata»: los descuentos se encadenan, no se
// suman, y «a cascata» es como se dice en italiano.
export const IT_CODIGOS: Record<ClaveCodigos, string> = {
  'codigos.pagina.titulo': 'Codici di negoziazione',
  'codigos.pagina.descripcion':
    'Codici con scadenza e limite di utilizzi che un commerciale applica a un preventivo. Li stabilisce questa azienda e non sono condivisi con nessun altro.',

  'codigos.estado.vigente': 'Attivo',
  'codigos.estado.proximo': 'In arrivo',
  'codigos.estado.vencido': 'Scaduto',
  'codigos.estado.agotado': 'Limite raggiunto',
  'codigos.estados.vigentes': 'Attivi',
  'codigos.estados.proximos': 'In arrivo',
  'codigos.estados.agotados': 'Limite raggiunto',
  'codigos.estados.vencidos': 'Scaduti',

  'codigos.error.leer': 'Impossibile leggere i codici di negoziazione',
  'codigos.error.guardar': 'Impossibile salvare',
  'codigos.error.eliminar': 'Impossibile eliminare',
  'codigos.error.elige-propuesta': 'Scegli la proposta a cui assegnare il codice',
  'codigos.error.asignar': 'Impossibile assegnare',
  'codigos.asignado': 'Codice di negoziazione {codigo} assegnato a {folio}: in attesa di approvazione',
  'codigos.asignado.reactivada':
    'Codice di negoziazione {codigo} assegnato a {folio}: in attesa di approvazione. La proposta torna in bozza.',
  'codigos.cargando': 'Caricamento dei codici di negoziazione',

  'codigos.aviso.uso': 'Un utilizzo viene conteggiato quando qualcuno applica il codice a un preventivo, non quando si chiude la vendita.',
  'codigos.aviso.por-que':
    'È ciò che permette di dire al cliente «sì, il tuo codice è valido» nel momento in cui lo digita, invece di scoprire alla firma che era già esaurito. In cambio, un preventivo abbandonato con il codice applicato trattiene un utilizzo: togliere il codice, o eliminare il preventivo, lo restituisce.',
  'codigos.aviso.compone':
    'E si applica {compone} sugli altri livelli: un 20% per volume, un 20% commerciale e un 20% di codice lasciano al cliente da pagare il {resultado}, non il 40%.',
  'codigos.aviso.compone.palabra': 'a cascata',
  'codigos.aviso.compone.resultado': '51,2%',

  'codigos.lista.titulo': 'Codici di negoziazione di questa azienda',
  'codigos.lista.subtitulo': 'Solo di questa azienda · validità con estremi inclusi',
  'codigos.lista.ayuda':
    'Ogni azienda stabilisce le proprie promozioni: questi codici non sono condivisi con nessun altro. Entrambi gli estremi della validità sono {inclusivos} — «fino al 30» include il 30. Lasciare vuoto il limite di utilizzi significa {sinTope}; allora l’unico freno è la data.',
  'codigos.lista.inclusivos': 'inclusi',
  'codigos.col.codigo': 'Codice',
  'codigos.col.estado': 'Stato',
  'codigos.col.descuento': 'Sconto',
  'codigos.col.vigencia': 'Validità',
  'codigos.col.usos': 'Utilizzi',
  'codigos.lista.vacia': 'Non ce n’è ancora nessuno. Senza codici di negoziazione, tutto si vende come oggi.',
  'codigos.pct': '{pct}%',
  'codigos.usos': '{usos} di {tope}',
  'codigos.usos.sin-tope': '{usos} (senza limite)',
  'codigos.sin-tope': 'senza limite',
  'codigos.asignar-a-propuesta': 'Assegna a una proposta',
  'codigos.eliminar.ayuda':
    'Elimina: non si può più applicare. Ciò che è già stato quotato o approvato non cambia, ma il conteggio degli utilizzi si perde: se lo ricrei con lo stesso codice, riparte da zero.',
  'codigos.eliminar': 'Elimina',

  'codigos.asignar.sin-propuestas':
    'Non ci sono proposte a cui assegnarlo: si può solo su una proposta in bozza, inviata o rifiutata, che non abbia già un altro codice.',
  'codigos.asignar.propuesta-para': 'Proposta per {codigo}',
  'codigos.asignar.elige': 'Scegli una proposta…',
  'codigos.asignar.sin-cliente': 'senza cliente',
  'codigos.asignar.asignando': 'Assegnazione…',
  'codigos.asignar.asignar': 'Assegna',
  'codigos.asignar.ayuda':
    'Consuma un utilizzo del codice e resta {pendiente}: il cliente non lo vede finché un amministratore o un manager non lo approva dalla proposta.',
  'codigos.asignar.pendiente': 'in attesa di approvazione',
  'codigos.asignar.rechazada': ' Questa proposta è rifiutata: assegnarle il codice la riporta in bozza.',

  'codigos.nuevo.titulo': 'Nuovo codice di negoziazione',
  'codigos.nuevo.codigo': 'Codice',
  'codigos.nuevo.descuento': 'Sconto (%)',
  'codigos.nuevo.descuento-etiqueta': 'Sconto percentuale',
  'codigos.nuevo.desde': 'Valido dal',
  'codigos.nuevo.hasta': 'Valido fino al',
  'codigos.nuevo.tope': 'Limite di utilizzi',
  'codigos.nuevo.tope-etiqueta': 'Limite di utilizzi (vuoto = senza limite)',
  'codigos.nuevo.anadir': 'Aggiungi codice di negoziazione',
  'codigos.obligatorio': ' (obbligatorio)',
}

// ─── PORTUGUES (pt-BR) · lote L2 (2026-11-05) ──────────────────────────────
// Cupon / codigo promocional / codigo de negociacion → «código de negociação»
// (decision del dueno); donde la frase ya lo dejo claro, basta «código». «Se
// compone» → «se aplica em cascata» (descuentos encadenados, no sumados).
// Porcentaje pegado («20%», D4). Vigencia de un codigo → «validade».
export const PT_CODIGOS: Record<ClaveCodigos, string> = {
  // ── La pagina ──
  'codigos.pagina.titulo': 'Códigos de negociação',
  'codigos.pagina.descripcion':
    'Códigos com validade e limite de usos que um vendedor aplica a uma cotação. São definidos por esta empresa e não são compartilhados com mais ninguém.',

  // ── Estados ──
  'codigos.estado.vigente': 'Vigente',
  'codigos.estado.proximo': 'Em breve',
  'codigos.estado.vencido': 'Vencido',
  'codigos.estado.agotado': 'Esgotado',
  'codigos.estados.vigentes': 'Vigentes',
  'codigos.estados.proximos': 'Em breve',
  'codigos.estados.agotados': 'Esgotados',
  'codigos.estados.vencidos': 'Vencidos',

  // ── Mensajes ──
  'codigos.error.leer': 'Não foi possível ler os códigos',
  'codigos.error.guardar': 'Não foi possível salvar',
  'codigos.error.eliminar': 'Não foi possível excluir',
  'codigos.error.elige-propuesta': 'Escolha a proposta à qual o código será atribuído',
  'codigos.error.asignar': 'Não foi possível atribuir',
  'codigos.asignado': 'Código {codigo} atribuído a {folio}: aguardando aprovação',
  'codigos.asignado.reactivada': 'Código {codigo} atribuído a {folio}: aguardando aprovação. A proposta volta para rascunho.',
  'codigos.cargando': 'Carregando os códigos',

  // ── El aviso de arriba ──
  'codigos.aviso.uso': 'O uso é contado quando alguém aplica o código a uma cotação, não quando a venda é fechada.',
  'codigos.aviso.por-que':
    'É o que permite dizer ao cliente “sim, seu código vale” no momento em que ele o digita, em vez de descobrir na assinatura que ele já tinha acabado. Em troca, uma cotação abandonada com o código aplicado retém um uso: remover o código, ou excluir a cotação, o devolve.',
  'codigos.aviso.compone':
    'E se {compone} sobre as outras camadas: 20% por volume, 20% comercial e 20% de código deixam o cliente pagando {resultado}, não 40%.',
  'codigos.aviso.compone.palabra': 'aplica em cascata',
  'codigos.aviso.compone.resultado': '51,2%',

  // ── La lista ──
  'codigos.lista.titulo': 'Códigos desta empresa',
  'codigos.lista.subtitulo': 'Só desta empresa · validade inclusiva',
  'codigos.lista.ayuda':
    'As promoções são definidas por cada empresa: estes códigos não são compartilhados com mais ninguém. As duas pontas da validade são {inclusivos} — “até 30” inclui o dia 30. Deixar o limite de usos vazio significa {sinTope}; aí o único freio é a data.',
  'codigos.lista.inclusivos': 'inclusivas',
  'codigos.col.codigo': 'Código',
  'codigos.col.estado': 'Situação',
  'codigos.col.descuento': 'Desconto',
  'codigos.col.vigencia': 'Validade',
  'codigos.col.usos': 'Usos',
  'codigos.lista.vacia': 'Ainda não há nenhum. Sem códigos, tudo é vendido como hoje.',
  'codigos.pct': '{pct}%',
  'codigos.usos': '{usos} de {tope}',
  'codigos.usos.sin-tope': '{usos} (sem limite)',
  'codigos.sin-tope': 'sem limite',
  'codigos.asignar-a-propuesta': 'Atribuir a uma proposta',
  'codigos.eliminar.ayuda':
    'Excluir: deixa de poder ser aplicado. O que já foi cotado e o que já foi aprovado não muda, mas a contagem de usos se perde: se você o criar de novo com o mesmo código, ele começa do zero.',
  'codigos.eliminar': 'Excluir',

  // ── Asignar a una propuesta ──
  'codigos.asignar.sin-propuestas':
    'Não há propostas às quais atribuí-lo: só é possível em uma proposta em rascunho, enviada ou recusada, e que ainda não tenha outro código.',
  'codigos.asignar.propuesta-para': 'Proposta para {codigo}',
  'codigos.asignar.elige': 'Escolha uma proposta…',
  'codigos.asignar.sin-cliente': 'sem cliente',
  'codigos.asignar.asignando': 'Atribuindo…',
  'codigos.asignar.asignar': 'Atribuir',
  'codigos.asignar.ayuda':
    'Consome um uso do código e fica {pendiente}: o cliente não o vê até que um administrador ou gerente o aprove na proposta.',
  'codigos.asignar.pendiente': 'aguardando aprovação',
  'codigos.asignar.rechazada': ' Esta proposta está recusada: atribuir o código a reativa como rascunho.',

  // ── El alta ──
  'codigos.nuevo.titulo': 'Novo código',
  'codigos.nuevo.codigo': 'Código',
  'codigos.nuevo.descuento': 'Desconto (%)',
  'codigos.nuevo.descuento-etiqueta': 'Desconto percentual',
  'codigos.nuevo.desde': 'Válido a partir de',
  'codigos.nuevo.hasta': 'Válido até',
  'codigos.nuevo.tope': 'Limite de usos',
  'codigos.nuevo.tope-etiqueta': 'Limite de usos (vazio = sem limite)',
  'codigos.nuevo.anadir': 'Adicionar código',
  'codigos.obligatorio': ' (obrigatório)',
}
