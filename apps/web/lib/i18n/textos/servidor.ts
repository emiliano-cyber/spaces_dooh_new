// ============================================================================
//  lib/i18n/textos/servidor.ts — LOS MOTIVOS QUE COMPARTEN SERVIDOR Y PANTALLA.
// ----------------------------------------------------------------------------
//  Lote «servidor» de la version en ingles (ola 4, 2026-11-02). Son las frases
//  de las reglas puras de `lib/` que se usan en los DOS lados:
//
//    · la pantalla las pinta directamente (el `title` de un paso, el aviso de
//      una ficha en revision, el error de un horario antes de enviarlo), y
//    · el servidor las lanza por variable (`new AppError(motivo)`) o las manda
//      en el cuerpo de la respuesta (el aviso de la franja programada).
//
//  Por eso viven en el diccionario Y alimentan el catalogo de errores del
//  servidor (`CATALOGO_LIB` en `errores-servidor.ts`): el ingles se escribe
//  UNA vez y el mismo fallo no puede decirse de dos maneras segun lo detecte
//  el navegador o el servidor.
//
//  Mismas reglas que los demas archivos de `textos/`:
//
//    · CLAVES `servidor.<modulo>.<elemento>`, en espanol, sin acentos.
//    · El ESPANOL es una copia LITERAL del modulo, que lo conserva: las
//      funciones devuelven su literal en espanol y solo el otro idioma pasa por
//      aqui. `servidor.test.ts` exige que las dos copias digan lo mismo.
//    · Comillas curvas en ingles y «Click», nunca «Tap».
// ============================================================================

export const ES_SERVIDOR = {
  // ── Comercial negociacion (`lib/negociacion.ts`) ──
  'servidor.negociacion.etapa-no-existe': 'Esa etapa de la búsqueda del responsable no existe',
  'servidor.negociacion.falta-quien-firma': 'Para confirmar al responsable legal, marca primero qué contacto firma',
  'servidor.negociacion.quitar-quien-firma':
    'Es quien firma y el responsable legal ya está confirmado: marca antes a otro contacto que firme, o baja la etapa',
  'servidor.negociacion.presupuesto': 'El mínimo del presupuesto no puede ser mayor que el máximo',
  'servidor.negociacion.oferta-cerrada.aceptada': 'Esa oferta ya está aceptada: haz una nueva versión',
  'servidor.negociacion.oferta-cerrada.rechazada': 'Esa oferta ya está rechazada: haz una nueva versión',
  'servidor.negociacion.perdido': 'El espacio está perdido: ya solo admite notas',
  'servidor.negociacion.en-revision': 'Está en revisión: espera la decisión antes de cambiar la ficha',

  // ── El horario individual de DOOHmain (`motivoHorarioInvalido`) ──
  'servidor.horario.formato': 'Las horas van como HH:mm, por ejemplo 07:30',
  'servidor.horario.iguales': 'La hora de inicio y la de fin no pueden ser iguales',
  'servidor.horario.sin-dias': 'Elige al menos un día, o ninguno para que sean todos',
  'servidor.horario.dia-no-existe': 'Ese día de la semana no existe',
  'servidor.horario.dia-repetido': 'Hay un día repetido',

  // ── La ubicacion (`lib/interpretar-ubicacion.ts`) ──
  'servidor.ubicacion.vacio':
    'Escribe una dirección, pega unas coordenadas (19.4326, -99.1332) o un enlace de Google Maps',
  'servidor.ubicacion.otro-dominio': 'Solo se aceptan enlaces de Google Maps (google.com/maps o maps.app.goo.gl)',
  'servidor.ubicacion.sin-coordenadas':
    'Ese enlace de Google Maps no trae coordenadas. En Google Maps toca el lugar, copia las coordenadas que salen arriba y pégalas aquí',
  'servidor.ubicacion.enlace-corto': 'Ese enlace corto no es de Google Maps, o le falta el final',
  'servidor.ubicacion.latitud':
    'La latitud va de -90 a 90. ¿Están al revés? Primero va la latitud (en México, alrededor de 14 a 33)',
  'servidor.ubicacion.longitud': 'La longitud va de -180 a 180',
  'servidor.ubicacion.cero': 'El punto (0, 0) está en el mar: no es una ubicación',
  'servidor.ubicacion.minutos': 'Los minutos y los segundos van de 0 a 59',
  'servidor.ubicacion.orden': 'Primero va la latitud (N o S) y después la longitud (E u O)',

  // ── El aviso de la franja programada (`avisosDeProgramacion`) ──
  'servidor.franja.aviso':
    'Se vendió como {vendida} ({pantallas}) y se programa en «{programada}». El precio y lo contratado no cambian; ' +
    'confirma con el cliente que el horario de transmisión es el acordado.',
  'servidor.franja.vendida': '«{nombre}»',
  'servidor.franja.otra': 'otra franja',
  'servidor.franja.pantallas.uno': '{n} pantalla',
  'servidor.franja.pantallas.otros': '{n} pantallas',

  // ── El cupon pendiente (`MSJ_APROBAR_CON_PENDIENTE`, `lib/codigo-aprobacion.ts`) ──
  'servidor.codigo.aprobar-con-pendiente':
    'Primero aprueba o rechaza el código promocional: está pendiente de aprobación y el cliente todavía no lo ve.',

  // ── Aprobar en $0 (`PropuestaCeroError`, `lib/server/propuestas-repo.ts`) ──
  // La ruta lo responde a mano con `requiereConfirmacionCero` y la pantalla lo
  // pregunta en un `window.confirm`: pinta ESTA clave, no el `error` del
  // servidor. `{total}` es `formatearDineroRedondo(0, idioma)` —«$0» en
  // español, como el literal del servidor—: ninguna cifra en el diccionario.
  'servidor.propuesta.aprobar-en-cero':
    'Estás por aprobar una propuesta con Total {total}. Confirma explícitamente para continuar.',

  // ── El periodo de los tableros (`periodoDe` y los esquemas que lo leen) ──
  // Viajan por variable (`AppError(e.message)`) o como motivo de zod: la
  // guardia de literales no los ve.
  'servidor.periodo.invalido': 'Periodo inválido',
  'servidor.periodo.rango': 'El rango necesita fecha de inicio y de fin (AAAA-MM-DD)',
  'servidor.periodo.cliente-invalido': 'Cliente inválido',
} as const

export type ClaveServidor = keyof typeof ES_SERVIDOR

export const EN_SERVIDOR: Record<ClaveServidor, string> = {
  'servidor.negociacion.etapa-no-existe': 'That stage of finding the decision-maker does not exist',
  'servidor.negociacion.falta-quien-firma': 'To confirm the legal representative, first mark which contact signs',
  'servidor.negociacion.quitar-quien-firma':
    'This is the contact who signs and the legal representative is already confirmed: first mark another contact who signs, or move the stage back',
  'servidor.negociacion.presupuesto': 'The minimum budget cannot be greater than the maximum',
  'servidor.negociacion.oferta-cerrada.aceptada': 'That offer is already accepted: make a new version',
  'servidor.negociacion.oferta-cerrada.rechazada': 'That offer is already rejected: make a new version',
  'servidor.negociacion.perdido': 'The space is lost: it only accepts notes now',
  'servidor.negociacion.en-revision': 'It is in review: wait for the decision before changing the spec sheet',

  'servidor.horario.formato': 'Times go as HH:mm, for example 07:30',
  'servidor.horario.iguales': 'The start time and the end time cannot be the same',
  'servidor.horario.sin-dias': 'Choose at least one day, or none so that it runs every day',
  'servidor.horario.dia-no-existe': 'That day of the week does not exist',
  'servidor.horario.dia-repetido': 'A day is repeated',

  'servidor.ubicacion.vacio': 'Enter an address, paste coordinates (19.4326, -99.1332) or a Google Maps link',
  'servidor.ubicacion.otro-dominio': 'Only Google Maps links are accepted (google.com/maps or maps.app.goo.gl)',
  'servidor.ubicacion.sin-coordenadas':
    'That Google Maps link has no coordinates. In Google Maps click the place, copy the coordinates shown at the top and paste them here',
  'servidor.ubicacion.enlace-corto': 'That short link is not from Google Maps, or its ending is missing',
  'servidor.ubicacion.latitud':
    'Latitude goes from -90 to 90. Are they reversed? Latitude comes first (in Mexico, around 14 to 33)',
  'servidor.ubicacion.longitud': 'Longitude goes from -180 to 180',
  'servidor.ubicacion.cero': 'The point (0, 0) is in the ocean: it is not a location',
  'servidor.ubicacion.minutos': 'Minutes and seconds go from 0 to 59',
  'servidor.ubicacion.orden': 'Latitude (N or S) comes first, then longitude (E or W)',

  'servidor.franja.aviso':
    'Sold as {vendida} ({pantallas}) and scheduled in “{programada}”. The price and what was contracted do not change; ' +
    'confirm with the client that the broadcast schedule is the one agreed.',
  'servidor.franja.vendida': '“{nombre}”',
  'servidor.franja.otra': 'another daypart',
  'servidor.franja.pantallas.uno': '{n} screen',
  'servidor.franja.pantallas.otros': '{n} screens',

  'servidor.codigo.aprobar-con-pendiente':
    'First approve or reject the negotiation code: it is pending approval and the client cannot see it yet.',
  'servidor.propuesta.aprobar-en-cero':
    'You are about to approve a proposal with a total of {total}. Confirm explicitly to continue.',

  'servidor.periodo.invalido': 'Invalid period',
  'servidor.periodo.rango': 'The range needs a start date and an end date (YYYY-MM-DD)',
  'servidor.periodo.cliente-invalido': 'Invalid client',
}

// ─── ITALIANO · lote L5 (2026-11-03) ────────────────────────────────────────
// COMPLETO: `Record`, asi que una clave nueva sin italiano no compila, como
// en el ingles. Traducido desde el ESPANOL (el ingles, solo de apoyo), con
// el glosario de `vault/03-Frontend/italiano-olas.md`.
export const IT_SERVIDOR: Record<ClaveServidor, string> = {
  'servidor.negociacion.etapa-no-existe': 'Questa fase della ricerca del responsabile non esiste',
  'servidor.negociacion.falta-quien-firma': 'Per confermare il responsabile legale, indica prima quale contatto firma',
  'servidor.negociacion.quitar-quien-firma':
    'È il contatto che firma e il responsabile legale è già confermato: indica prima un altro contatto che firmi, oppure riporta indietro la fase',
  'servidor.negociacion.presupuesto': 'Il minimo del budget non può essere maggiore del massimo',
  'servidor.negociacion.oferta-cerrada.aceptada': 'Questa offerta è già stata accettata: crea una nuova versione',
  'servidor.negociacion.oferta-cerrada.rechazada': 'Questa offerta è già stata rifiutata: crea una nuova versione',
  'servidor.negociacion.perdido': 'Lo spazio è perso: ormai accetta solo note',
  'servidor.negociacion.en-revision': 'È in revisione: attendi la decisione prima di modificare la scheda',

  'servidor.horario.formato': 'Gli orari vanno nel formato HH:mm, per esempio 07:30',
  'servidor.horario.iguales': 'L’ora di inizio e quella di fine non possono essere uguali',
  'servidor.horario.sin-dias': 'Scegli almeno un giorno, o nessuno perché siano tutti',
  'servidor.horario.dia-no-existe': 'Questo giorno della settimana non esiste',
  'servidor.horario.dia-repetido': 'C’è un giorno ripetuto',

  // Las coordenadas de ejemplo son las que se teclean (con punto), no una cifra pintada.
  'servidor.ubicacion.vacio':
    'Scrivi un indirizzo, incolla delle coordinate (19.4326, -99.1332) o un link di Google Maps',
  'servidor.ubicacion.otro-dominio': 'Si accettano solo link di Google Maps (google.com/maps o maps.app.goo.gl)',
  'servidor.ubicacion.sin-coordenadas':
    'Questo link di Google Maps non contiene coordinate. In Google Maps clicca sul luogo, copia le coordinate che compaiono in alto e incollale qui',
  'servidor.ubicacion.enlace-corto': 'Questo link breve non è di Google Maps, oppure manca la parte finale',
  'servidor.ubicacion.latitud':
    'La latitudine va da -90 a 90. Sono invertite? Prima va la latitudine (in Messico, circa da 14 a 33)',
  'servidor.ubicacion.longitud': 'La longitudine va da -180 a 180',
  'servidor.ubicacion.cero': 'Il punto (0, 0) è in mare: non è una posizione',
  'servidor.ubicacion.minutos': 'I minuti e i secondi vanno da 0 a 59',
  'servidor.ubicacion.orden': 'Prima va la latitudine (N o S) e poi la longitudine (E o O)',

  'servidor.franja.aviso':
    'Venduta come {vendida} ({pantallas}) e programmata in «{programada}». Il prezzo e quanto contrattato non cambiano; ' +
    'conferma con il cliente che l’orario di trasmissione sia quello concordato.',
  'servidor.franja.vendida': '«{nombre}»',
  'servidor.franja.otra': 'un’altra fascia oraria',
  'servidor.franja.pantallas.uno': '{n} schermo',
  'servidor.franja.pantallas.otros': '{n} schermi',

  'servidor.codigo.aprobar-con-pendiente':
    'Prima approva o rifiuta il codice di negoziazione: è in attesa di approvazione e il cliente non lo vede ancora.',

  'servidor.propuesta.aprobar-en-cero':
    'Stai per approvare una proposta con un totale di {total}. Conferma esplicitamente per continuare.',

  'servidor.periodo.invalido': 'Periodo non valido',
  'servidor.periodo.rango': 'L’intervallo richiede una data di inizio e una di fine (AAAA-MM-GG)',
  'servidor.periodo.cliente-invalido': 'Cliente non valido',
}

// ─── PORTUGUES (pt-BR) · lote L5 (2026-11-05) ────────────────────────────────
// COMPLETO: el tipo es `Record` y `tsc` exige cada clave. Brasil, «voce»,
// el glosario comun de `vault/03-Frontend/portugues-olas.md` (§2 bis) y lo no
// obvio, clave por clave, en `docs/i18n/revision-portugues-l5.md`. La prueba
// estatica es `textos/portugues-l5.test.ts`.
export const PT_SERVIDOR: Record<ClaveServidor, string> = {
  'servidor.negociacion.etapa-no-existe': 'Essa etapa da busca pelo responsável não existe',
  'servidor.negociacion.falta-quien-firma': 'Para confirmar o responsável legal, marque primeiro qual contato assina',
  'servidor.negociacion.quitar-quien-firma':
    'É quem assina e o responsável legal já está confirmado: marque antes outro contato que assine, ou volte a etapa',
  'servidor.negociacion.presupuesto': 'O mínimo do orçamento não pode ser maior que o máximo',
  'servidor.negociacion.oferta-cerrada.aceptada': 'Essa oferta já foi aceita: faça uma nova versão',
  'servidor.negociacion.oferta-cerrada.rechazada': 'Essa oferta já foi recusada: faça uma nova versão',
  'servidor.negociacion.perdido': 'O espaço foi perdido: agora só aceita notas',
  'servidor.negociacion.en-revision': 'Está em revisão: aguarde a decisão antes de alterar a ficha',
  'servidor.horario.formato': 'Os horários vão como HH:mm, por exemplo 07:30',
  'servidor.horario.iguales': 'O horário de início e o de término não podem ser iguais',
  'servidor.horario.sin-dias': 'Escolha pelo menos um dia, ou nenhum para que sejam todos',
  'servidor.horario.dia-no-existe': 'Esse dia da semana não existe',
  'servidor.horario.dia-repetido': 'Há um dia repetido',
  // Las coordenadas se pegan de un mapa, con punto: el ejemplo se queda como esta.
  'servidor.ubicacion.vacio': 'Digite um endereço, cole coordenadas (19.4326, -99.1332) ou um link do Google Maps',
  'servidor.ubicacion.otro-dominio': 'Só são aceitos links do Google Maps (google.com/maps ou maps.app.goo.gl)',
  'servidor.ubicacion.sin-coordenadas':
    'Esse link do Google Maps não traz coordenadas. No Google Maps, clique no lugar, copie as coordenadas que aparecem em cima e cole aqui',
  'servidor.ubicacion.enlace-corto': 'Esse link curto não é do Google Maps, ou está faltando o final',
  'servidor.ubicacion.latitud':
    'A latitude vai de -90 a 90. Estão invertidas? Primeiro vem a latitude (no México, entre 14 e 33, aproximadamente)',
  'servidor.ubicacion.longitud': 'A longitude vai de -180 a 180',
  'servidor.ubicacion.cero': 'O ponto (0, 0) fica no mar: não é uma localização',
  'servidor.ubicacion.minutos': 'Os minutos e os segundos vão de 0 a 59',
  'servidor.ubicacion.orden': 'Primeiro vem a latitude (N ou S) e depois a longitude (L ou O)',
  'servidor.franja.aviso':
    'Foi vendido como {vendida} ({pantallas}) e está programado em “{programada}”. O preço e o que foi contratado não mudam; confirme com o cliente que o horário de veiculação é o combinado.',
  'servidor.franja.vendida': '“{nombre}”',
  'servidor.franja.otra': 'outra faixa horária',
  'servidor.franja.pantallas.uno': '{n} tela',
  'servidor.franja.pantallas.otros': '{n} telas',
  'servidor.codigo.aprobar-con-pendiente':
    'Primeiro aprove ou recuse o código de negociação: ele está aguardando aprovação e o cliente ainda não o vê.',
  'servidor.propuesta.aprobar-en-cero':
    'Você está prestes a aprovar uma proposta com total de {total}. Confirme explicitamente para continuar.',
  'servidor.periodo.invalido': 'Período inválido',
  'servidor.periodo.rango': 'O período precisa de data de início e de término (AAAA-MM-DD)',
  'servidor.periodo.cliente-invalido': 'Cliente inválido',
}
