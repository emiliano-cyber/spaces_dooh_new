// ============================================================================
//  LOTE DE TRADUCCION — lo que esta rama le agrega al modulo Space Eyes.
// ----------------------------------------------------------------------------
//  ESTO NO SE COMPILA NI SE IMPORTA. Es el lote listo para pegar dentro de
//  `apps/web/lib/i18n/textos/spaceeyes.ts` DESPUES de fusionar esta rama, que es
//  cuando ese archivo existe: en esta rama no esta (el lote «Space Eyes» entro
//  en main el 2-nov y la rama arranca del 26-oct).
//
//  Cada bloque de abajo va al final de su diccionario: ES_SPACEEYES,
//  EN_SPACEEYES, IT_SPACEEYES y PT_SPACEEYES, en ese orden. Las claves son las
//  mismas en los cuatro y los huecos `{…}` tambien, que es lo que comprueban
//  `cobertura-italiano` y `cobertura-portugues`.
//
//  DE DONDE SALE CADA GRUPO
//  ------------------------
//    A · El brillo de noche y el panel por tipo de equipo (`EquipoAdmin.tsx`).
//        El vocabulario del panel -brillo, contraste, saturacion, nitidez,
//        exposicion, los balances- YA esta en main: se comprobo clave por clave.
//        Lo de aqui es solo lo que la rama agrega.
//    B · Los avisos por correo (`AvisosCorreo.tsx`, componente nuevo).
//    C · Quien cerro una falla (`FallasFlota.tsx`): el servidor ahora tambien
//        puede cerrarla, y el historial lo dice.
//
//  GLOSARIO DE ESTE LOTE, siguiendo el del archivo (equipo → device, falla →
//  fault, vigilancia → monitoring): aviso por correo → «email alert»; llave →
//  «key» («API key» cuando se nombra el proveedor); remitente → «sender»;
//  destinatario → «recipient»; registro del servidor → «server log»; Dueño →
//  «Owner» (el rol, como en el resto del sistema).
//
//  LO QUE NO SE TRADUCE, por lo mismo que el resto del archivo: el nombre del
//  proveedor (Resend), los correos de ejemplo de los `placeholder`, y el texto
//  del `ultimo_error`, que lo escribe el servidor (y a veces Resend).
//
//  AL APLICARLO hay que acordarse de dos cosas:
//    · pasar los literales de `AvisosCorreo.tsx` y del bloque de noche de
//      `EquipoAdmin.tsx` a `t('…')`;
//    · actualizar el volcado de `pantallas-spaceeyes.test.ts`, que compara el
//      HTML en espanol pantalla por pantalla.
// ============================================================================

// ─── ES_SPACEEYES ───────────────────────────────────────────────────────────
export const ES = {
  // A · El panel de imagen enseña lo que cada tipo de equipo aplica de verdad
  'spaceeyes.imagen.solo-pc':
    'Esta cámara se configura desde su propia página, no desde aquí: el agente de PC solo le pide la foto.',
  'spaceeyes.imagen.solo-telefono':
    'Un teléfono solo acepta la exposición, el balance de blancos y el enfoque fijo. El resto de los ajustes son de la Raspberry: aquí no se enseñan porque no harían nada.',
  'spaceeyes.imagen.ayuda.exposicion': 'En pasos de diafragma: −1 es la mitad de luz.',
  'spaceeyes.imagen.ayuda.brillo': 'Cada paso oscurece un poco. El telefono lo recorta a lo que aguante su camara.',

  // A · La luz por horario
  'spaceeyes.noche.activar': 'Bajar la luz de noche automáticamente',
  'spaceeyes.noche.desde': 'Desde',
  'spaceeyes.noche.hasta': 'Hasta',
  'spaceeyes.noche.exposicion': 'Exposición en ese tramo',
  'spaceeyes.noche.mas-oscuro': ' · más oscuro',
  'spaceeyes.noche.mas-claro': ' · más claro',
  'spaceeyes.noche.igual': ' · igual que de día',
  'spaceeyes.noche.ayuda':
    'Es la hora del sitio, no la del servidor, y puede cruzar la medianoche. Solo cambia la exposición: el encuadre y el balance de blancos siguen siendo los de arriba. Aplica a la vista en vivo y a todas las fotos, incluidas las programadas.',

  // B · Avisos por correo cuando una pantalla falla
  'spaceeyes.avisos.titulo': 'Avisos por correo',
  'spaceeyes.avisos.apagados': 'apagados',
  'spaceeyes.avisos.sin-correos': 'encendidos, pero sin ningún correo',
  'spaceeyes.avisos.resumen': 'a {quien}, agrupados cada {min} min',
  'spaceeyes.avisos.correos': '{n} correos',
  'spaceeyes.avisos.configurar': 'Configurar',
  'spaceeyes.avisos.cerrar': 'Cerrar',
  'spaceeyes.avisos.que-avisa':
    'Se avisa de la pantalla apagada o congelada y de la cámara sin imagen. Un gabinete suelto no manda correo: se ve aquí abajo. Las fallas del mismo equipo salen juntas en un solo correo, así que una que se arregla sola antes de la espera no molesta a nadie.',
  'spaceeyes.avisos.sin-cuenta':
    'Todavía no hay cuenta de correo, así que no sale ninguno: los avisos quedan escritos en el registro del servidor.',
  'spaceeyes.avisos.sin-cuenta.dueno': 'Llénala aquí abajo.',
  'spaceeyes.avisos.sin-cuenta.otros': 'La pone el Dueño.',
  'spaceeyes.avisos.activar': 'Mandar correo cuando una pantalla falle',
  'spaceeyes.avisos.destinatarios': 'Correos que reciben el aviso',
  'spaceeyes.avisos.destinatarios.ayuda': 'Separados por coma. Se guardan solo los que son direcciones válidas.',
  'spaceeyes.avisos.espera': 'Esperar antes de mandar',
  'spaceeyes.avisos.espera.unidad': 'minutos desde la primera falla del equipo',
  'spaceeyes.avisos.guardar': 'Guardar',
  'spaceeyes.avisos.probar': 'Mandar un correo de prueba',
  'spaceeyes.avisos.guardado': 'Guardado.',
  'spaceeyes.avisos.error.sin-destinatarios': 'Para encenderlos hace falta al menos un correo válido.',
  'spaceeyes.avisos.error.remitente': 'El remitente tiene que ser un correo, o «Nombre <correo@dominio>».',
  'spaceeyes.avisos.error.llave': 'Esa no parece una llave: va completa, sin espacios.',
  'spaceeyes.avisos.error.guardar': 'No se pudo guardar.',
  'spaceeyes.avisos.prueba.registrada': 'Sin llave de correo: quedó escrito en el registro del servidor.',
  'spaceeyes.avisos.prueba.enviada': 'Correo de prueba mandado a {correos}.',
  'spaceeyes.avisos.prueba.error': 'No salió el correo de prueba.',
  'spaceeyes.avisos.ultimo-intento': 'Último intento: {motivo}',
  'spaceeyes.avisos.cuenta.abrir': 'Cambiar la cuenta de correo',
  'spaceeyes.avisos.cuenta.cerrar': 'Ocultar la cuenta de correo',
  'spaceeyes.avisos.cuenta.ninguna': 'Sin cuenta: no sale ningún correo.',
  'spaceeyes.avisos.cuenta.del-panel': 'Sale de {remitente}, con la llave {pista}.',
  'spaceeyes.avisos.cuenta.del-entorno':
    'Sale de {remitente} — viene del entorno del contenedor, no de aquí. Si la escribes aquí, manda esta.',
  'spaceeyes.avisos.remitente': 'De quién salen los correos',
  'spaceeyes.avisos.remitente.ayuda': 'El dominio tiene que estar verificado en Resend, o el correo se rechaza.',
  'spaceeyes.avisos.llave': 'Llave de Resend',
  'spaceeyes.avisos.llave.puesta': 'Puesta: {pista} — escribe otra para cambiarla',
  'spaceeyes.avisos.llave.ayuda':
    'Se escribe, no se lee: una vez guardada nadie vuelve a verla desde aquí. Dejarla en blanco no la borra.',
  'spaceeyes.avisos.llave.quitar': 'Quitar la llave guardada',
  'spaceeyes.avisos.llave.quitar.titulo': 'Quitar la llave de correo',
  'spaceeyes.avisos.llave.quitar.confirmar': 'Quitar',
  'spaceeyes.avisos.llave.quitar.aviso':
    'Sin llave no sale ningún aviso: quedan escritos en el registro del servidor. Se puede volver a poner cuando sea.',

  // C · Quién cerró la falla
  'spaceeyes.fallas.cerrada.servidor': ' · el servidor no se la creyó',
}

// ─── EN_SPACEEYES ───────────────────────────────────────────────────────────
export const EN = {
  'spaceeyes.imagen.solo-pc':
    'This camera is configured on its own page, not here: the PC agent only asks it for the photo.',
  'spaceeyes.imagen.solo-telefono':
    'A phone only accepts exposure, white balance and fixed focus. The rest of the settings belong to the Raspberry: they are not shown here because they would do nothing.',
  'spaceeyes.imagen.ayuda.exposicion': 'In f-stops: −1 is half the light.',
  'spaceeyes.imagen.ayuda.brillo': 'Each step darkens it a little. The phone clamps it to what its camera can take.',

  'spaceeyes.noche.activar': 'Lower the light automatically at night',
  'spaceeyes.noche.desde': 'From',
  'spaceeyes.noche.hasta': 'To',
  'spaceeyes.noche.exposicion': 'Exposure during that stretch',
  'spaceeyes.noche.mas-oscuro': ' · darker',
  'spaceeyes.noche.mas-claro': ' · brighter',
  'spaceeyes.noche.igual': ' · same as daytime',
  'spaceeyes.noche.ayuda':
    "It is the site's time, not the server's, and it may cross midnight. It only changes the exposure: the framing and the white balance stay as set above. It applies to the live view and to every photo, scheduled ones included.",

  'spaceeyes.avisos.titulo': 'Email alerts',
  'spaceeyes.avisos.apagados': 'off',
  'spaceeyes.avisos.sin-correos': 'on, but with no address',
  'spaceeyes.avisos.resumen': 'to {quien}, grouped every {min} min',
  'spaceeyes.avisos.correos': '{n} addresses',
  'spaceeyes.avisos.configurar': 'Configure',
  'spaceeyes.avisos.cerrar': 'Close',
  'spaceeyes.avisos.que-avisa':
    'You get an alert when the screen is off or frozen and when the camera has no image. A single cabinet does not send email: it shows below. Faults from the same device go out together in one email, so one that fixes itself before the wait is over bothers nobody.',
  'spaceeyes.avisos.sin-cuenta':
    'There is no email account yet, so nothing goes out: the alerts are written to the server log.',
  'spaceeyes.avisos.sin-cuenta.dueno': 'Fill it in below.',
  'spaceeyes.avisos.sin-cuenta.otros': 'The Owner sets it.',
  'spaceeyes.avisos.activar': 'Send an email when a screen fails',
  'spaceeyes.avisos.destinatarios': 'Addresses that get the alert',
  'spaceeyes.avisos.destinatarios.ayuda': 'Separated by commas. Only valid addresses are saved.',
  'spaceeyes.avisos.espera': 'Wait before sending',
  'spaceeyes.avisos.espera.unidad': "minutes from the device's first fault",
  'spaceeyes.avisos.guardar': 'Save',
  'spaceeyes.avisos.probar': 'Send a test email',
  'spaceeyes.avisos.guardado': 'Saved.',
  'spaceeyes.avisos.error.sin-destinatarios': 'To turn them on you need at least one valid address.',
  'spaceeyes.avisos.error.remitente': 'The sender has to be an address, or «Name <address@domain>».',
  'spaceeyes.avisos.error.llave': 'That does not look like a key: paste it whole, with no spaces.',
  'spaceeyes.avisos.error.guardar': 'It could not be saved.',
  'spaceeyes.avisos.prueba.registrada': 'No email key: it was written to the server log.',
  'spaceeyes.avisos.prueba.enviada': 'Test email sent to {correos}.',
  'spaceeyes.avisos.prueba.error': 'The test email did not go out.',
  'spaceeyes.avisos.ultimo-intento': 'Last attempt: {motivo}',
  'spaceeyes.avisos.cuenta.abrir': 'Change the email account',
  'spaceeyes.avisos.cuenta.cerrar': 'Hide the email account',
  'spaceeyes.avisos.cuenta.ninguna': 'No account: no email goes out.',
  'spaceeyes.avisos.cuenta.del-panel': 'Sent from {remitente}, with key {pista}.',
  'spaceeyes.avisos.cuenta.del-entorno':
    'Sent from {remitente} — it comes from the container environment, not from here. If you write one here, that one wins.',
  'spaceeyes.avisos.remitente': 'Who the emails come from',
  'spaceeyes.avisos.remitente.ayuda': 'The domain has to be verified in Resend, or the email is rejected.',
  'spaceeyes.avisos.llave': 'Resend key',
  'spaceeyes.avisos.llave.puesta': 'Set: {pista} — write another one to change it',
  'spaceeyes.avisos.llave.ayuda':
    'It is written, not read: once saved, nobody sees it again from here. Leaving it blank does not erase it.',
  'spaceeyes.avisos.llave.quitar': 'Remove the saved key',
  'spaceeyes.avisos.llave.quitar.titulo': 'Remove the email key',
  'spaceeyes.avisos.llave.quitar.confirmar': 'Remove',
  'spaceeyes.avisos.llave.quitar.aviso':
    'With no key no alert goes out: they are written to the server log. You can put one back whenever you want.',

  'spaceeyes.fallas.cerrada.servidor': ' · the server did not buy it',
}

// ─── IT_SPACEEYES ───────────────────────────────────────────────────────────
export const IT = {
  'spaceeyes.imagen.solo-pc':
    'Questa telecamera si configura dalla sua pagina, non da qui: l’agente del PC le chiede solo la foto.',
  'spaceeyes.imagen.solo-telefono':
    'Un telefono accetta solo l’esposizione, il bilanciamento del bianco e la messa a fuoco fissa. Le altre regolazioni sono del Raspberry: qui non si mostrano perché non farebbero nulla.',
  'spaceeyes.imagen.ayuda.exposicion': 'In stop di diaframma: −1 è metà della luce.',
  'spaceeyes.imagen.ayuda.brillo': 'Ogni passo scurisce un po’. Il telefono lo limita a quanto regge la sua telecamera.',

  'spaceeyes.noche.activar': 'Abbassare la luce di notte automaticamente',
  'spaceeyes.noche.desde': 'Dalle',
  'spaceeyes.noche.hasta': 'Alle',
  'spaceeyes.noche.exposicion': 'Esposizione in quella fascia',
  'spaceeyes.noche.mas-oscuro': ' · più scuro',
  'spaceeyes.noche.mas-claro': ' · più chiaro',
  'spaceeyes.noche.igual': ' · come di giorno',
  'spaceeyes.noche.ayuda':
    'È l’ora del sito, non quella del server, e può oltrepassare la mezzanotte. Cambia solo l’esposizione: l’inquadratura e il bilanciamento del bianco restano quelli di sopra. Vale per la vista dal vivo e per tutte le foto, comprese quelle programmate.',

  'spaceeyes.avisos.titulo': 'Avvisi via email',
  'spaceeyes.avisos.apagados': 'spenti',
  'spaceeyes.avisos.sin-correos': 'accesi, ma senza nessun indirizzo',
  'spaceeyes.avisos.resumen': 'a {quien}, raggruppati ogni {min} min',
  'spaceeyes.avisos.correos': '{n} indirizzi',
  'spaceeyes.avisos.configurar': 'Configura',
  'spaceeyes.avisos.cerrar': 'Chiudi',
  'spaceeyes.avisos.que-avisa':
    'Si avvisa quando lo schermo è spento o bloccato e quando la telecamera non ha immagine. Un singolo cabinet non manda email: si vede qui sotto. I guasti dello stesso dispositivo escono insieme in una sola email, così uno che si risolve da solo prima dell’attesa non disturba nessuno.',
  'spaceeyes.avisos.sin-cuenta':
    'Non c’è ancora un account email, quindi non esce niente: gli avvisi restano scritti nel registro del server.',
  'spaceeyes.avisos.sin-cuenta.dueno': 'Compilalo qui sotto.',
  'spaceeyes.avisos.sin-cuenta.otros': 'Lo imposta il Proprietario.',
  'spaceeyes.avisos.activar': 'Mandare un’email quando uno schermo si guasta',
  'spaceeyes.avisos.destinatarios': 'Indirizzi che ricevono l’avviso',
  'spaceeyes.avisos.destinatarios.ayuda': 'Separati da virgola. Si salvano solo quelli validi.',
  'spaceeyes.avisos.espera': 'Attendere prima di mandare',
  'spaceeyes.avisos.espera.unidad': 'minuti dal primo guasto del dispositivo',
  'spaceeyes.avisos.guardar': 'Salva',
  'spaceeyes.avisos.probar': 'Manda un’email di prova',
  'spaceeyes.avisos.guardado': 'Salvato.',
  'spaceeyes.avisos.error.sin-destinatarios': 'Per accenderli serve almeno un indirizzo valido.',
  'spaceeyes.avisos.error.remitente': 'Il mittente dev’essere un indirizzo, o «Nome <indirizzo@dominio>».',
  'spaceeyes.avisos.error.llave': 'Questa non sembra una chiave: va intera, senza spazi.',
  'spaceeyes.avisos.error.guardar': 'Non si è potuto salvare.',
  'spaceeyes.avisos.prueba.registrada': 'Senza chiave email: è rimasta scritta nel registro del server.',
  'spaceeyes.avisos.prueba.enviada': 'Email di prova mandata a {correos}.',
  'spaceeyes.avisos.prueba.error': 'L’email di prova non è uscita.',
  'spaceeyes.avisos.ultimo-intento': 'Ultimo tentativo: {motivo}',
  'spaceeyes.avisos.cuenta.abrir': 'Cambia l’account email',
  'spaceeyes.avisos.cuenta.cerrar': 'Nascondi l’account email',
  'spaceeyes.avisos.cuenta.ninguna': 'Senza account: non esce nessuna email.',
  'spaceeyes.avisos.cuenta.del-panel': 'Esce da {remitente}, con la chiave {pista}.',
  'spaceeyes.avisos.cuenta.del-entorno':
    'Esce da {remitente} — viene dall’ambiente del container, non da qui. Se la scrivi qui, vale questa.',
  'spaceeyes.avisos.remitente': 'Da chi escono le email',
  'spaceeyes.avisos.remitente.ayuda': 'Il dominio dev’essere verificato in Resend, o l’email viene rifiutata.',
  'spaceeyes.avisos.llave': 'Chiave di Resend',
  'spaceeyes.avisos.llave.puesta': 'Impostata: {pista} — scrivine un’altra per cambiarla',
  'spaceeyes.avisos.llave.ayuda':
    'Si scrive, non si legge: una volta salvata nessuno la rivede da qui. Lasciarla in bianco non la cancella.',
  'spaceeyes.avisos.llave.quitar': 'Togli la chiave salvata',
  'spaceeyes.avisos.llave.quitar.titulo': 'Togliere la chiave email',
  'spaceeyes.avisos.llave.quitar.confirmar': 'Togli',
  'spaceeyes.avisos.llave.quitar.aviso':
    'Senza chiave non esce nessun avviso: restano scritti nel registro del server. Si può rimettere quando vuoi.',

  'spaceeyes.fallas.cerrada.servidor': ' · il server non ci ha creduto',
}

// ─── PT_SPACEEYES ───────────────────────────────────────────────────────────
export const PT = {
  'spaceeyes.imagen.solo-pc':
    'Esta câmera é configurada na própria página dela, não aqui: o agente de PC só pede a foto.',
  'spaceeyes.imagen.solo-telefono':
    'Um celular só aceita a exposição, o balanço de branco e o foco fixo. Os demais ajustes são do Raspberry: aqui não aparecem porque não fariam nada.',
  'spaceeyes.imagen.ayuda.exposicion': 'Em passos de diafragma: −1 é metade da luz.',
  'spaceeyes.imagen.ayuda.brillo': 'Cada passo escurece um pouco. O celular limita ao que a câmera dele aguenta.',

  'spaceeyes.noche.activar': 'Baixar a luz à noite automaticamente',
  'spaceeyes.noche.desde': 'Das',
  'spaceeyes.noche.hasta': 'Às',
  'spaceeyes.noche.exposicion': 'Exposição nesse intervalo',
  'spaceeyes.noche.mas-oscuro': ' · mais escuro',
  'spaceeyes.noche.mas-claro': ' · mais claro',
  'spaceeyes.noche.igual': ' · igual ao dia',
  'spaceeyes.noche.ayuda':
    'É a hora do site, não a do servidor, e pode atravessar a meia-noite. Só muda a exposição: o enquadramento e o balanço de branco continuam os de cima. Vale para a vista ao vivo e para todas as fotos, incluindo as programadas.',

  'spaceeyes.avisos.titulo': 'Avisos por e-mail',
  'spaceeyes.avisos.apagados': 'desligados',
  'spaceeyes.avisos.sin-correos': 'ligados, mas sem nenhum endereço',
  'spaceeyes.avisos.resumen': 'para {quien}, agrupados a cada {min} min',
  'spaceeyes.avisos.correos': '{n} endereços',
  'spaceeyes.avisos.configurar': 'Configurar',
  'spaceeyes.avisos.cerrar': 'Fechar',
  'spaceeyes.avisos.que-avisa':
    'Avisa quando a tela está apagada ou congelada e quando a câmera está sem imagem. Um gabinete sozinho não manda e-mail: aparece aqui embaixo. As falhas do mesmo equipamento saem juntas num só e-mail, então uma que se resolve sozinha antes da espera não incomoda ninguém.',
  'spaceeyes.avisos.sin-cuenta':
    'Ainda não há conta de e-mail, então não sai nenhum: os avisos ficam escritos no registro do servidor.',
  'spaceeyes.avisos.sin-cuenta.dueno': 'Preencha aqui embaixo.',
  'spaceeyes.avisos.sin-cuenta.otros': 'Quem define é o Dono.',
  'spaceeyes.avisos.activar': 'Mandar e-mail quando uma tela falhar',
  'spaceeyes.avisos.destinatarios': 'Endereços que recebem o aviso',
  'spaceeyes.avisos.destinatarios.ayuda': 'Separados por vírgula. Só são salvos os endereços válidos.',
  'spaceeyes.avisos.espera': 'Esperar antes de mandar',
  'spaceeyes.avisos.espera.unidad': 'minutos desde a primeira falha do equipamento',
  'spaceeyes.avisos.guardar': 'Salvar',
  'spaceeyes.avisos.probar': 'Mandar um e-mail de teste',
  'spaceeyes.avisos.guardado': 'Salvo.',
  'spaceeyes.avisos.error.sin-destinatarios': 'Para ligar, é preciso pelo menos um endereço válido.',
  'spaceeyes.avisos.error.remitente': 'O remetente tem que ser um endereço, ou «Nome <endereco@dominio>».',
  'spaceeyes.avisos.error.llave': 'Isso não parece uma chave: vai inteira, sem espaços.',
  'spaceeyes.avisos.error.guardar': 'Não foi possível salvar.',
  'spaceeyes.avisos.prueba.registrada': 'Sem chave de e-mail: ficou escrito no registro do servidor.',
  'spaceeyes.avisos.prueba.enviada': 'E-mail de teste mandado para {correos}.',
  'spaceeyes.avisos.prueba.error': 'O e-mail de teste não saiu.',
  'spaceeyes.avisos.ultimo-intento': 'Última tentativa: {motivo}',
  'spaceeyes.avisos.cuenta.abrir': 'Mudar a conta de e-mail',
  'spaceeyes.avisos.cuenta.cerrar': 'Ocultar a conta de e-mail',
  'spaceeyes.avisos.cuenta.ninguna': 'Sem conta: não sai nenhum e-mail.',
  'spaceeyes.avisos.cuenta.del-panel': 'Sai de {remitente}, com a chave {pista}.',
  'spaceeyes.avisos.cuenta.del-entorno':
    'Sai de {remitente} — vem do ambiente do contêiner, não daqui. Se você escrever uma aqui, vale esta.',
  'spaceeyes.avisos.remitente': 'De quem saem os e-mails',
  'spaceeyes.avisos.remitente.ayuda': 'O domínio tem que estar verificado no Resend, ou o e-mail é recusado.',
  'spaceeyes.avisos.llave': 'Chave do Resend',
  'spaceeyes.avisos.llave.puesta': 'Posta: {pista} — escreva outra para trocá-la',
  'spaceeyes.avisos.llave.ayuda':
    'Ela se escreve, não se lê: depois de salva ninguém a vê de novo daqui. Deixar em branco não apaga.',
  'spaceeyes.avisos.llave.quitar': 'Tirar a chave salva',
  'spaceeyes.avisos.llave.quitar.titulo': 'Tirar a chave de e-mail',
  'spaceeyes.avisos.llave.quitar.confirmar': 'Tirar',
  'spaceeyes.avisos.llave.quitar.aviso':
    'Sem chave não sai nenhum aviso: ficam escritos no registro do servidor. Dá para pôr outra quando quiser.',

  'spaceeyes.fallas.cerrada.servidor': ' · o servidor não acreditou',
}
