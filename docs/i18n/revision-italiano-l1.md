# Revisión · lote L1 del italiano «Space Eyes y luz»

**Fecha:** 2026-11-03 · **Rama:** `feat/italiano-l1-spaceeyes` (sale de
`integra/idiomas`, `6fea374a`) · **Tablero:** `vault/03-Frontend/italiano-olas.md`
(subsección «Lote L1») · **Estado:** hecho, sin validar.

## 1 · Qué se hizo

| Ámbito | Claves | Con italiano | Archivo |
|---|---:|---:|---|
| `spaceeyes` | 1001 | 1001 | `apps/web/lib/i18n/textos/spaceeyes.ts` (`IT_SPACEEYES`) |
| `energia` | 121 | 121 | `apps/web/lib/i18n/textos/energia.ts` (`IT_ENERGIA`) |
| `donde-falla.ts` | (usa `spaceeyes.fallas.*`) | — | `apps/web/lib/i18n/donde-falla.ts`, sin tocar: ya traducía por clave |

- Los dos `IT_*` pasan de `Partial<Record<…>>` a `Record<…>`: `tsc` exige cada
  clave, como en el inglés. `coberturaItaliano()` da 0 pendientes en las dos
  filas.
- Traducido desde el **español**, con el inglés solo de apoyo. Registro «tu»,
  mayúscula solo al inicio, apóstrofo tipográfico (’), comillas « », sin
  espacio antes de «%», periodicidades en letra («ogni due ore», «ogni due
  mesi»), botones en imperativo breve («Salva», «Elimina», «Aggiorna»), y en la
  web siempre «Clicca» (el teléfono «conferma»).
- **Código fuera de `textos/`** (solo cifras; ni un texto nuevo):
  - `components/demo/space-eyes/piezas.tsx`: `fijo(n, decimales, idioma)` y
    `cifra(n, idioma)`. En es y en devuelven `toFixed`/`String` tal cual; en it,
    coma decimal y punto de millar. `gigas()` recibe el idioma.
  - Space Eyes: `AjustarTexto` (deslizadores), `EquipoAdmin` (deslizadores,
    almacenamiento, obturador), `Graficas` (`fmtBytes`, °C, muestras, eje),
    `Programacion` (GB/mes, fotos al día), `Verificacion` (SSIM),
    `CreativosConfig` (datos del mes), `FichaEquipo`, `CampanasEyes`,
    `FallasFlota`, `Galeria`, `Historial`, `ListaEquipos`: `formatNumero` con
    el idioma.
  - Energía: `recibos.ts` (kWh leídos), `IndicadoresEnergia.tsx`,
    `SubirRecibos.tsx`, `app/(app)/(shell)/energia/page.tsx` (`formatNumero`
    con el idioma) y `captura.ts` (`pesos` con los dos límites de decimales,
    §4).
  - `lib/i18n/catalogos-italiano.test.ts`: la igualdad `it = en` de las fallas
    se rompe a propósito, como pedía su cabecera.

## 2 · Español e inglés idénticos — medido

| Medición | Resultado |
|---|---|
| HTML de **toda** la suite (`I18N_VOLCAR_TODO`), base `6fea374a` (3027 archivos) frente a la rama (3391) | `diff -rq`: **0 distintos, 0 desaparecidos**; los 364 nuevos son de las pruebas italianas nuevas |
| `DICCIONARIOS.es` / `.en` | 5590 valores cada uno, **0 cambiados**, 0 quitados, 0 nuevos |
| Instantáneas `ES_*`/`EN_*` de `spaceeyes` y `energia` | Sin cambios (el `.snap` solo suma el italiano) |

El «antes» se midió con las fuentes y pruebas de `6fea374a` restauradas sobre
el mismo árbol (`git checkout 6fea374a -- <los 28 archivos>`), y se volvió a
`HEAD` después.

## 3 · El italiano, comprobado

- **`pantallas-spaceeyes.test.ts` (95 estados) y `pantallas-energia.test.ts`
  (11)** se rinden también en `it`: ninguna frase española de la lista de cada
  estado (con límite de palabra: «Mes» está dentro de «Mese»), el italiano
  esperado en 7 + 11 estados, **ninguna huella** de formato español o inglés
  (`huellasEnItaliano`; la marca de la foto se quita y otra prueba exige que
  siga en es-MX), el dinero con el símbolo de la instancia en `it` (MXN y USD),
  y un **barrido** del diccionario del ámbito: ningún trozo español NI INGLÉS en
  el HTML italiano. Es el que caza la caída al inglés de una clave sin italiano,
  que no da ningún error.
- **`textos/spaceeyes.test.ts` y `textos/energia.test.ts`**: completo,
  instantánea, ninguna igual al español o al inglés salvo las declaradas, mismos
  huecos que el español, sin espacio antes de «%», apóstrofo tipográfico, sin
  cifras con punto decimal (salvo versiones), frecuencias en letra, nunca
  «tocca/premi», ninguna moneda. Las funciones de `captura.ts`/`recibos.ts` en
  `it` dan otro texto que en `en` y sin formatos ajenos.
- **`donde-falla.test.ts`**: las tres formas del `donde` y los ocho nombres de
  falla del teléfono, en italiano.
- **Espejo** (`I18N_VOLCAR_IT`, `lib/i18n` + `components`): Space Eyes pasa de
  **87 huellas a 0**; energía, 0. El total baja de 358 a 271 (lo que queda es de
  propuestas, inicio, comercial e inventario).
- **Rojo antes de traducir:** 66 fallos en los cuatro archivos (commit
  `726ee9c4`).

### Mutantes — 11, mueren los 11

| # | Mutante | Muere en |
|---|---|---|
| M1 | `AjustarTexto` vuelve a `toFixed` | huellas italianas (4) |
| M2 | Falta una clave italiana | completitud y barrido (4) |
| M3 | kWh leídos sin idioma | energía (5) |
| M4 | `pesos` sin mínimo de decimales | energía, «MX$ 50» (2) |
| M5 | Un italiano que se quedó en español | barrido y «iguales» (3) |
| M6 | `fijo()` ignora el idioma | huellas italianas (9) |
| M7 | «Ogni 2 ore» | frecuencias en letra (2) |
| M8 | `gigas` sin idioma en el medidor | huellas (1) |
| M9 | Apóstrofo recto | forma (2) |
| M10 | Plural italiano al revés | italiano esperado (1) |
| M11 | Un `donde` que cae al inglés | barrido y `donde-falla` (2) |

## 4 · Hallazgos para otros

1. **`lib/i18n/dinero.ts` (ola 0 / L5):** `formatearDinero(m, 'it', {
   maximumFractionDigits: 2 })` da «MX$ 3.400,5» y «MX$ 50»:
   `dineroSimboloDelante` pasa a `Intl` el mínimo **indefinido**, y sin el
   estilo `currency` no hay mínimo de la moneda. En es/en sale bien porque ese
   estilo pone 2. Aquí se arregló en el llamador; conviene que `dinero.ts` use
   el mínimo de la moneda cuando no llega. Puede afectar a otros lotes.
2. **`guardias-italiano.ts`:** «0,812» (una cifra italiana con tres decimales)
   cae en «cifra con coma de millar». Un millar inglés nunca empieza por «0,».
   La prueba de Space Eyes lo permite con `permitidos: [/^0,\d{3}$/]`.
3. **L5:** «Administración › Configuración › Soporte» va como «Impostazioni ›
   Impostazioni aziendali › Supporto», como el inglés. Si L5 fija otro nombre
   para la pestaña, hay que cambiarlo aquí (3 claves).
4. **L2:** el veredicto de la foto (`comercial.eye.*`) sale en inglés en la
   pantalla italiana de Space Eyes hasta que L2 lo traduzca; el barrido de L1
   lo quita antes de barrer.

## 5 · Decisiones que conviene que mire el dueño

- **«schermo» / «impianto»:** en Space Eyes, *schermo* es la pantalla LED que
  mira el equipo (gabinetes, apagada, marcarla); *impianto*, la del inventario
  (asignada, asociada, su galería, «I tuoi impianti»). En energía, siempre
  *impianto*.
- **«creatività»** (femenino, invariable) para creativo/creatividad; «cabinet»
  invariable para gabinete.
- **Fechas con artículo:** «Inizia il 1 dic 2026», «valido fino al 1 dic 2026».
  El italiano esmerado diría «l’1» o «il 1°»; se deja la forma corriente de
  interfaz.
- Plurales sin forma en español: «{n} con il mese già registrato» (era «{n} ya
  capturados») y «Bollette mancanti nel periodo: {faltan} su {esperados}» para
  que concuerden con cualquier cifra.

## 6 · Tabla de revisión

`␣` marca un espacio al principio o al final (el texto va pegado a otro nodo).
Los huecos `{nombre}` se rellenan en tiempo de ejecución.

## Space Eyes (`textos/spaceeyes.ts`) · 1001 claves

| clave | español | inglés | italiano |
|---|---|---|---|
| `spaceeyes.hace.nunca` | nunca | never | mai |
| `spaceeyes.hace.segundos` | hace segundos | seconds ago | pochi secondi fa |
| `spaceeyes.hace.min` | hace {n} min | {n} min ago | {n} min fa |
| `spaceeyes.hace.h` | hace {n} h | {n} h ago | {n} h fa |
| `spaceeyes.hace.d` | hace {n} d | {n} d ago | {n} g fa |
| `spaceeyes.hace.semanas` | hace {n} semanas | {n} weeks ago | {n} settimane fa |
| `spaceeyes.comun.sin-dato` | sin dato | no data | nessun dato |
| `spaceeyes.senal.buena` | buena | good | buono |
| `spaceeyes.senal.regular` | regular | fair | discreto |
| `spaceeyes.senal.debil` | débil | weak | debole |
| `spaceeyes.senal.movil` | Móvil | Mobile | Rete mobile |
| `spaceeyes.conexion.en-linea` | En línea | Online | Online |
| `spaceeyes.conexion.pendiente` | Pendiente de vincular | Pending pairing | In attesa di abbinamento |
| `spaceeyes.conexion.sin` | Sin comunicación | Not reporting | Non comunica |
| `spaceeyes.visor.completo` | Abrir en tamaño completo | Open full size | Apri a dimensione piena |
| `spaceeyes.sin-respuesta.titulo` | El servicio de cámaras no responde en este momento | The camera service is not responding right now | Il servizio delle fotocamere non risponde in questo momento |
| `spaceeyes.sin-respuesta.texto` | Tus equipos siguen trabajando en los sitios: lo que tomen mientras tanto aparecerá aquí en cuanto el servicio vuelva. Suele resolverse solo en unos minutos (por ejemplo, durante una actualización). | Your devices keep working on site: anything they capture in the meantime will show up here as soon as the service is back. It usually sorts itself out within a few minutes (for example, during an update). | I tuoi dispositivi continuano a lavorare nei siti: ciò che scattano nel frattempo apparirà qui non appena il servizio tornerà disponibile. Di solito si risolve da solo in pochi minuti (per esempio durante un aggiornamento). |
| `spaceeyes.sin-respuesta.reintentar` | Volver a intentar | Try again | Riprova |
| `spaceeyes.sin-respuesta.soporte` | Si sigue así más de una hora, avisa a soporte desde Administración › Configuración › Soporte. | If it stays like this for more than an hour, contact support from Settings › Business settings › Support. | Se continua così per più di un’ora, avvisa il supporto da Impostazioni › Impostazioni aziendali › Supporto. |
| `spaceeyes.solicitudes.titulo` | Solicitudes de activación de Space Eyes | Space Eyes activation requests | Richieste di attivazione di Space Eyes |
| `spaceeyes.solicitudes.ninguna` | Ninguna pendiente | None pending | Nessuna in sospeso |
| `spaceeyes.solicitudes.pendientes.uno` | {n} pendiente(s) | {n} pending | {n} in sospeso |
| `spaceeyes.solicitudes.pendientes.otros` | {n} pendiente(s) | {n} pending | {n} in sospeso |
| `spaceeyes.solicitudes.vacio` | Cuando una empresa pida Space Eyes desde su demostración, aparece aquí con la orden para activarlo. | When a company requests Space Eyes from its demo, it shows up here with the command to activate it. | Quando un’azienda richiede Space Eyes dalla sua demo, compare qui con il comando per attivarlo. |
| `spaceeyes.solicitudes.folio` | ␣· folio {folio} | ␣· ticket {folio} | ␣· ticket {folio} |
| `spaceeyes.solicitudes.copiada` | Copiada | Copied | Copiato |
| `spaceeyes.solicitudes.copiar` | Copiar orden | Copy command | Copia comando |
| `spaceeyes.solicitudes.pie` | La orden se corre en el padre y pide la frase de paso de la llave de licencias. La empresa ve Space Eyes en unos 15 minutos. Después, cierra su ticket en el {panel}. | The command runs on the parent server and asks for the license key passphrase. The company sees Space Eyes in about 15 minutes. Then close its ticket in the {panel}. | Il comando si esegue sul server padre e chiede la passphrase della chiave delle licenze. L’azienda vede Space Eyes in circa 15 minuti. Poi chiudi il suo ticket nel {panel}. |
| `spaceeyes.solicitudes.panel` | panel de tickets | ticket panel | pannello dei ticket |
| `spaceeyes.ficha.no-encontrado` | Equipo no encontrado | Device not found | Dispositivo non trovato |
| `spaceeyes.pagina.id-invalido` | La dirección no corresponde a ningún equipo Space Eyes. | This address does not match any Space Eyes device. | L’indirizzo non corrisponde a nessun dispositivo Space Eyes. |
| `spaceeyes.demo.ejemplo` | EJEMPLO | EXAMPLE | ESEMPIO |
| `spaceeyes.demo.anuncio.a1` | TU MARCA | YOUR BRAND | IL TUO MARCHIO |
| `spaceeyes.demo.anuncio.a2` | AQUÍ | HERE | QUI |
| `spaceeyes.demo.anuncio.b1` | OFERTA | SEASONAL | OFFERTA |
| `spaceeyes.demo.anuncio.b2` | DE TEMPORADA | OFFER | DI STAGIONE |
| `spaceeyes.demo.anuncio.c1` | NUEVO | NEW | NUOVO |
| `spaceeyes.demo.anuncio.c2` | LANZAMIENTO | LAUNCH | LANCIO |
| `spaceeyes.demo.ilustracion` | Ilustración de un espectacular de ejemplo | Illustration of a sample billboard | Illustrazione di un cartellone di esempio |
| `spaceeyes.demo.falla-franja` | Varios gabinetes apagados · Gabinetes 4, 9 (2 de 15) | Several cabinets off · Cabinets 4, 9 (2 of 15) | Diversi cabinet spenti · Cabinet 4, 9 (2 di 15) |
| `spaceeyes.demo.equipo.a` | Av. Principal 120 · Cara A | 120 Main Ave. · Side A | Via Principale 120 · Lato A |
| `spaceeyes.demo.equipo.b` | Blvd. del Parque · Cara B | Park Blvd. · Side B | Viale del Parco · Lato B |
| `spaceeyes.demo.equipo.c` | Glorieta Norte | North Roundabout | Rotonda Nord |
| `spaceeyes.demo.ciudad` | Ciudad de ejemplo | Sample city | Città di esempio |
| `spaceeyes.demo.hace.2min` | hace 2 min | 2 min ago | 2 min fa |
| `spaceeyes.demo.hace.5min` | hace 5 min | 5 min ago | 5 min fa |
| `spaceeyes.demo.hace.2h` | hace 2 h | 2 h ago | 2 h fa |
| `spaceeyes.demo.historial.1` | Foto programada tomada | Scheduled photo taken | Foto programmata scattata |
| `spaceeyes.demo.historial.2` | Creativo nuevo detectado en la pantalla: se guardó su foto | New creative detected on the screen: its photo was saved | Nuova creatività rilevata sullo schermo: la sua foto è stata salvata |
| `spaceeyes.demo.historial.3` | Falla: 2 gabinetes apagados (con foto de evidencia) | Fault: 2 cabinets off (with an evidence photo) | Guasto: 2 cabinet spenti (con foto di prova) |
| `spaceeyes.demo.historial.4` | Falla recuperada: el equipo vio la pantalla completa otra vez | Fault cleared: the device saw the whole screen again | Guasto risolto: il dispositivo ha rivisto lo schermo intero |
| `spaceeyes.demo.historial.5` | Foto pedida desde la oficina, recibida en 9 segundos | Photo requested from the office, received in 9 seconds | Foto richiesta dall’ufficio, ricevuta in 9 secondi |
| `spaceeyes.demo.beneficio.1.titulo` | Prueba de exhibición | Proof of display | Prova di affissione |
| `spaceeyes.demo.beneficio.1.texto` | Fotos con fecha, hora y ubicación de cada anuncio al aire, listas para enviar al cliente. | Photos with the date, time and location of every ad on air, ready to send to the client. | Foto con data, ora e posizione di ogni annuncio in onda, pronte da inviare al cliente. |
| `spaceeyes.demo.beneficio.2.titulo` | Fallas antes que el cliente | Faults before the client sees them | I guasti prima del cliente |
| `spaceeyes.demo.beneficio.2.texto` | El equipo detecta gabinetes apagados o una pantalla congelada y avisa con la foto del problema. | The device detects cabinets that are off or a frozen screen and alerts you with a photo of the problem. | Il dispositivo rileva cabinet spenti o uno schermo bloccato e avvisa con la foto del problema. |
| `spaceeyes.demo.beneficio.3.titulo` | Menos visitas al sitio | Fewer site visits | Meno sopralluoghi |
| `spaceeyes.demo.beneficio.3.texto` | Foto o vista en vivo desde la oficina cuando la necesites, sin mandar a nadie. | A photo or the live view from the office whenever you need it, without sending anyone. | Foto o vista in diretta dall’ufficio quando ti serve, senza mandare nessuno. |
| `spaceeyes.demo.beneficio.4.titulo` | Qué estuvo al aire | What was on air | Cosa è andato in onda |
| `spaceeyes.demo.beneficio.4.texto` | Cada creativo nuevo que aparece en la pantalla queda registrado con su foto. | Every new creative that appears on the screen is logged with its photo. | Ogni nuova creatività che compare sullo schermo viene registrata con la sua foto. |
| `spaceeyes.demo.estado.conexion` | Conexión | Connection | Connessione |
| `spaceeyes.demo.estado.conexion.v` | En línea · Móvil, señal buena | Online · Mobile, good signal | Online · Rete mobile, segnale buono |
| `spaceeyes.demo.estado.ultima` | Última comunicación | Last report | Ultima comunicazione |
| `spaceeyes.demo.estado.bateria` | Batería | Battery | Batteria |
| `spaceeyes.demo.estado.bateria.v` | 92 % · cargando | 92% · charging | 92% · in carica |
| `spaceeyes.demo.estado.temperatura` | Temperatura | Temperature | Temperatura |
| `spaceeyes.demo.estado.temperatura.v` | 38 °C | 38 °C | 38 °C |
| `spaceeyes.demo.estado.datos` | Datos este mes | Data this month | Dati questo mese |
| `spaceeyes.demo.estado.datos.v` | 312 MB | 312 MB | 312 MB |
| `spaceeyes.demo.estado.vigilancia` | Vigilancia de la pantalla | Screen monitoring | Monitoraggio dello schermo |
| `spaceeyes.demo.estado.vigilancia.v` | Encendida · 15 gabinetes | On · 15 cabinets | Attivo · 15 cabinet |
| `spaceeyes.demo.enviada` | Solicitud enviada | Request sent | Richiesta inviata |
| `spaceeyes.demo.solicitar` | Solicitar activación | Request activation | Richiedi l’attivazione |
| `spaceeyes.demo.sin-permiso` | Para activarlo, pide a un administrador de tu empresa que lo solicite desde esta misma pantalla. | To activate it, ask an admin at your company to request it from this same screen. | Per attivarlo, chiedi a un amministratore della tua azienda di richiederlo da questa stessa schermata. |
| `spaceeyes.demo.listo` | Listo: recibimos tu solicitud y te contactaremos. Puedes seguirla en Administración › Configuración › Soporte. | Done: we received your request and will get in touch. You can follow it in Settings › Business settings › Support. | Fatto: abbiamo ricevuto la tua richiesta e ti contatteremo. Puoi seguirla in Impostazioni › Impostazioni aziendali › Supporto. |
| `spaceeyes.demo.listo.folio` | Listo: recibimos tu solicitud (folio {folio}) y te contactaremos. Puedes seguirla en Administración › Configuración › Soporte. | Done: we received your request (ticket {folio}) and will get in touch. You can follow it in Settings › Business settings › Support. | Fatto: abbiamo ricevuto la tua richiesta (ticket {folio}) e ti contatteremo. Puoi seguirla in Impostazioni › Impostazioni aziendali › Supporto. |
| `spaceeyes.demo.error` | No se pudo enviar la solicitud. Inténtalo de nuevo en unos minutos. | The request could not be sent. Try again in a few minutes. | Impossibile inviare la richiesta. Riprova tra qualche minuto. |
| `spaceeyes.demo.aviso` | Estás viendo una {demo} con datos de ejemplo. Tu empresa todavía no tiene Space Eyes activado; ninguno de estos equipos es tuyo. | You are viewing a {demo} with sample data. Your company does not have Space Eyes activated yet; none of these devices are yours. | Stai guardando una {demo} con dati di esempio. La tua azienda non ha ancora Space Eyes attivato; nessuno di questi dispositivi è tuo. |
| `spaceeyes.demo.aviso.demo` | demostración | demo | demo |
| `spaceeyes.demo.titulo` | Tus pantallas, vistas desde el sitio, sin ir al sitio | Your screens, seen from the site, without going to the site | I tuoi impianti, visti dal sito, senza andare sul sito |
| `spaceeyes.demo.lema.1` | Incidencias reportadas antes de que voltee a ver el sitio. | Issues reported before anyone looks at the site. | Problemi segnalati prima che qualcuno guardi il sito. |
| `spaceeyes.demo.lema.2` | Campaña programática comprobada en cuanto se reproduce. | Programmatic campaigns verified as soon as they play. | Campagne programmatic verificate appena vanno in onda. |
| `spaceeyes.demo.equipos` | Así se ven tus equipos | This is how your devices look | Ecco come appaiono i tuoi dispositivi |
| `spaceeyes.demo.caido` | Sin comunicación desde hace 2 h. Así se ve cuando un equipo deja de reportar: nunca se da por funcionando solo por estar registrado. | Not reporting for 2 h. This is how it looks when a device stops reporting: it is never assumed to be working just because it is registered. | Non comunica da 2 h. Ecco cosa succede quando un dispositivo smette di inviare dati: non viene mai considerato funzionante solo perché è registrato. |
| `spaceeyes.demo.detalle` | El detalle de un equipo | A device up close | Il dettaglio di un dispositivo |
| `spaceeyes.demo.captura` | Captura · 08:12 · con fecha, hora y nombre del sitio | Capture · 08:12 · with date, time and site name | Scatto · 08:12 · con data, ora e nome del sito |
| `spaceeyes.demo.evidencia` | Evidencia de una falla, marcada por el propio equipo | Evidence of a fault, marked by the device itself | Prova di un guasto, segnalata dal dispositivo stesso |
| `spaceeyes.demo.estado` | Estado del equipo | Device status | Stato del dispositivo |
| `spaceeyes.demo.historial` | Historial y alertas de un día | A day of history and alerts | Cronologia e avvisi di una giornata |
| `spaceeyes.demo.beneficios` | Para qué le sirve a tu operación | What it does for your operation | A cosa serve per la tua operatività |
| `spaceeyes.demo.cierre` | ¿Lo quieres para tus pantallas? | Want it for your screens? | Lo vuoi per i tuoi impianti? |
| `spaceeyes.demo.cierre.texto` | Al activarlo, esta sección se convierte en la de tus equipos reales. No hay que configurar nada de tu empresa. | Once activated, this section becomes the one for your real devices. Nothing in your company needs to be configured. | Una volta attivato, questa sezione diventa quella dei tuoi dispositivi reali. Non c’è niente da configurare nella tua azienda. |
| `spaceeyes.comun.actualizar` | Actualizar | Refresh | Aggiorna |
| `spaceeyes.comun.no-consultar` | No se pudo consultar Space Eyes | Could not reach Space Eyes | Impossibile consultare Space Eyes |
| `spaceeyes.comun.sin-equipos` | Todavía no hay equipos Space Eyes dados de alta para esta cuenta. | There are no Space Eyes devices registered for this account yet. | Non ci sono ancora dispositivi Space Eyes registrati per questo account. |
| `spaceeyes.comun.sin-pantalla` | sin pantalla asignada | no screen assigned | nessun impianto assegnato |
| `spaceeyes.lista.descripcion` | Los equipos que vigilan tus pantallas: qué están viendo y cómo están. | The devices that watch your screens: what they see and how they are doing. | I dispositivi che sorvegliano i tuoi impianti: cosa stanno vedendo e come stanno. |
| `spaceeyes.alta.titulo` | Agregar dispositivo | Add device | Aggiungi dispositivo |
| `spaceeyes.lista.no-configurado` | La integración con Space Eyes no está configurada en este entorno. | The Space Eyes integration is not configured in this environment. | L’integrazione con Space Eyes non è configurata in questo ambiente. |
| `spaceeyes.lista.kpi.de-equipos.uno` | de {n} equipos | of {n} device | di {n} dispositivo |
| `spaceeyes.lista.kpi.de-equipos.otros` | de {n} equipos | of {n} devices | di {n} dispositivi |
| `spaceeyes.lista.kpi.mas-10` | más de 10 min | over 10 min | oltre 10 min |
| `spaceeyes.lista.kpi.bateria` | Batería crítica | Critical battery | Batteria critica |
| `spaceeyes.lista.kpi.bajo-20` | bajo 20% | under 20% | sotto il 20% |
| `spaceeyes.lista.kpi.ultima` | Última captura | Last capture | Ultimo scatto |
| `spaceeyes.lista.kpi.flota` | de toda la flota | across the fleet | di tutta la flotta |
| `spaceeyes.lista.kpi.sin-fotos` | sin fotos todavía | no photos yet | ancora nessuna foto |
| `spaceeyes.lista.filtro.todos` | Todos · {n} | All · {n} | Tutti · {n} |
| `spaceeyes.lista.filtro.linea` | En línea · {n} | Online · {n} | Online · {n} |
| `spaceeyes.lista.filtro.atencion` | Con atención · {n} | Need attention · {n} | Da controllare · {n} |
| `spaceeyes.lista.filtro.manual` | Se actualizan a mano · {n} | Manual updates · {n} | Si aggiornano manualmente · {n} |
| `spaceeyes.lista.empresa` | Empresa | Company | Azienda |
| `spaceeyes.lista.empresas` | Todas las empresas | All companies | Tutte le aziende |
| `spaceeyes.lista.buscar` | Buscar equipo o pantalla | Search device or screen | Cerca dispositivo o impianto |
| `spaceeyes.lista.sin-coincidencias` | Ningún equipo coincide con el filtro. | No devices match the filter. | Nessun dispositivo corrisponde al filtro. |
| `spaceeyes.lista.alt-captura` | Última captura de {nombre} | Last capture from {nombre} | Ultimo scatto di {nombre} |
| `spaceeyes.lista.sin-capturas` | Sin capturas todavía | No captures yet | Ancora nessuno scatto |
| `spaceeyes.lista.actualizar.visita` | Para actualizar necesita una visita | Needs a site visit to update | Per aggiornarlo serve un sopralluogo |
| `spaceeyes.lista.actualizar.toque` | Para actualizar pide un toque | Needs a confirmation on the phone to update | Per aggiornarlo serve una conferma sul telefono |
| `spaceeyes.comun.respondio` | Space Eye respondió {status} | Space Eye returned {status} | Space Eye ha risposto {status} |
| `spaceeyes.comun.sin-hablar` | No se pudo hablar con Space Eyes | Could not reach Space Eyes | Impossibile comunicare con Space Eyes |
| `spaceeyes.comun.equipo` | Equipo | Device | Dispositivo |
| `spaceeyes.comun.modelo` | Modelo | Model | Modello |
| `spaceeyes.comun.almacenamiento` | Almacenamiento libre | Free storage | Spazio libero |
| `spaceeyes.comun.descargar` | Descargar | Download | Scarica |
| `spaceeyes.comun.tomar-foto` | Tomar foto | Take photo | Scatta foto |
| `spaceeyes.comun.pidiendo` | Pidiendo… | Requesting… | Richiesta in corso… |
| `spaceeyes.comun.no-pedir-foto` | No se pudo pedir la foto | Could not request the photo | Impossibile richiedere la foto |
| `spaceeyes.ficha.llego` | Llegó la foto: es la que estás viendo. | The photo arrived: it is the one you are looking at. | La foto è arrivata: è quella che stai vedendo. |
| `spaceeyes.ficha.no-llego` | La foto no ha llegado todavía. La orden sigue en pie: el equipo la subirá en cuanto pueda. | The photo has not arrived yet. The request still stands: the device will upload it as soon as it can. | La foto non è ancora arrivata. Il comando resta valido: il dispositivo la caricherà appena possibile. |
| `spaceeyes.ficha.no-leer-imagen` | No se pudo leer la imagen | Could not read the image | Impossibile leggere l’immagine |
| `spaceeyes.ficha.no-subir` | No se pudo subir la foto | Could not upload the photo | Impossibile caricare la foto |
| `spaceeyes.ficha.no-abrir` | No se pudo abrir el equipo | Could not open the device | Impossibile aprire il dispositivo |
| `spaceeyes.ficha.esperando` | Esperando la foto… | Waiting for the photo… | In attesa della foto… |
| `spaceeyes.ficha.subir.sin-pantalla` | Este equipo no tiene una pantalla asignada donde guardar la foto | This device has no assigned screen to store the photo | Questo dispositivo non ha un impianto assegnato in cui salvare la foto |
| `spaceeyes.ficha.subir` | Subir foto | Upload photo | Carica foto |
| `spaceeyes.ficha.actualizar-estado` | Actualizar estado | Refresh status | Aggiorna stato |
| `spaceeyes.ficha.tab.fotos` | Fotos | Photos | Foto |
| `spaceeyes.ficha.tab.creativos` | Creativos | Creatives | Creatività |
| `spaceeyes.ficha.captura` | Captura Space Eyes | Space Eyes capture | Scatto Space Eyes |
| `spaceeyes.ficha.cliente` | Foto del cliente | Client photo | Foto del cliente |
| `spaceeyes.ficha.comparar` | Comparar | Compare | Confronta |
| `spaceeyes.ficha.subida` | Subida a la galería de la pantalla | Uploaded to the screen gallery | Caricata nella galleria dell’impianto |
| `spaceeyes.ficha.alt-cliente` | Foto del cliente de {nombre} | Client photo of {nombre} | Foto del cliente di {nombre} |
| `spaceeyes.ficha.alt-captura` | Captura de Space Eyes de {nombre} | Space Eyes capture of {nombre} | Scatto Space Eyes di {nombre} |
| `spaceeyes.ficha.sin-capturas-min` | sin capturas | no captures | nessuno scatto |
| `spaceeyes.ficha.sin-fotos` | Este equipo todavía no ha subido ninguna foto. | This device has not uploaded any photos yet. | Questo dispositivo non ha ancora caricato nessuna foto. |
| `spaceeyes.ficha.cliente.vacio` | Nadie ha subido todavía una foto de esta pantalla. Usa «Subir foto». | Nobody has uploaded a photo of this screen yet. Use “Upload photo”. | Nessuno ha ancora caricato una foto di questo impianto. Usa «Carica foto». |
| `spaceeyes.ficha.cliente.sin-pantalla` | Este equipo no tiene una pantalla asignada, así que no hay galería donde guardar la foto del cliente. | This device has no assigned screen, so there is no gallery to store the client photo. | Questo dispositivo non ha un impianto assegnato, quindi non c’è una galleria in cui salvare la foto del cliente. |
| `spaceeyes.ficha.barra.conexion` | Última conexión {valor} | Last connection {valor} | Ultima connessione {valor} |
| `spaceeyes.ficha.barra.bateria` | Batería {valor} | Battery {valor} | Batteria {valor} |
| `spaceeyes.ficha.barra.red` | Red | Network | Rete |
| `spaceeyes.ficha.barra.captura` | Última captura {valor} | Last capture {valor} | Ultimo scatto {valor} |
| `spaceeyes.ficha.origen.demanda` | a demanda | on demand | su richiesta |
| `spaceeyes.ficha.origen.programada` | programada | scheduled | programmata |
| `spaceeyes.ficha.ampliar` | Ampliar | Enlarge | Ingrandisci |
| `spaceeyes.ficha.ampliar-sello` | Ampliar: {sello} | Enlarge: {sello} | Ingrandisci: {sello} |
| `spaceeyes.ficha.velo` | Pidiéndole la foto al equipo… | Asking the device for the photo… | Richiesta della foto al dispositivo… |
| `spaceeyes.ficha.velo.tarda` | Suele tardar entre 5 y 20 segundos | It usually takes 5 to 20 seconds | Di solito ci vogliono tra 5 e 20 secondi |
| `spaceeyes.ficha.sin-capturas` | Sin capturas | No captures | Nessuno scatto |
| `spaceeyes.ficha.recientes` | Recientes | Recent | Recenti |
| `spaceeyes.ficha.captura-del` | Captura del {fecha} | Capture from {fecha} | Scatto del {fecha} |
| `spaceeyes.ficha.energia` | Energía | Power | Alimentazione |
| `spaceeyes.ficha.cargando` | cargando | charging | in carica |
| `spaceeyes.ficha.sin-cargar` | sin cargar | not charging | non in carica |
| `spaceeyes.ficha.temp-bateria` | Temp. batería | Battery temp. | Temp. batteria |
| `spaceeyes.ficha.temp-equipo` | Temp. equipo | Device temp. | Temp. dispositivo |
| `spaceeyes.ficha.conexion` | Conexión | Connection | Connessione |
| `spaceeyes.ficha.datos-mes` | Datos de este mes | Data this month | Dati di questo mese |
| `spaceeyes.ficha.pantalla` | Pantalla asociada | Linked screen | Impianto associato |
| `spaceeyes.ficha.abrir-ficha` | Abrir la ficha → | Open the profile → | Apri la scheda → |
| `spaceeyes.ficha.sin-sitio` | Ningún sitio de tu inventario tiene el código {codigo}, así que este equipo no está enlazado a una pantalla. | No site in your inventory has the code {codigo}, so this device is not linked to a screen. | Nessun sito del tuo inventario ha il codice {codigo}, quindi questo dispositivo non è collegato a un impianto. |
| `spaceeyes.ficha.detalles` | Detalles del equipo | Device details | Dettagli del dispositivo |
| `spaceeyes.ficha.version-agente` | Versión del agente | Agent version | Versione dell’agente |
| `spaceeyes.ficha.capturas` | Capturas guardadas | Saved captures | Scatti salvati |
| `spaceeyes.ficha.alt-fotografia` | Fotografía de {nombre} | Photo of {nombre} | Fotografia di {nombre} |
| `spaceeyes.ficha.sin-fotografia` | Sin fotografía | No photo | Nessuna fotografia |
| `spaceeyes.ficha.ia-pendiente` | Verificación de IA pendiente | AI verification pending | Verifica IA in sospeso |
| `spaceeyes.historial.no-leer` | No se pudo leer el histórico | Could not read the history | Impossibile leggere lo storico |
| `spaceeyes.historial.titulo` | Histórico del equipo | Device history | Storico del dispositivo |
| `spaceeyes.historial.reportes.uno` | {n} reportes | {n} report | {n} rilevazione |
| `spaceeyes.historial.reportes.otros` | {n} reportes | {n} reports | {n} rilevazioni |
| `spaceeyes.historial.vacio` | Este equipo no reportó nada en el rango elegido, así que no hay nada que dibujar. Prueba con un rango más amplio. | This device reported nothing in the chosen range, so there is nothing to plot. Try a wider range. | Questo dispositivo non ha inviato nulla nell’intervallo scelto, quindi non c’è niente da disegnare. Prova con un intervallo più ampio. |
| `spaceeyes.historial.bateria` | Batería | Battery | Batteria |
| `spaceeyes.historial.senal` | Señal | Signal | Segnale |
| `spaceeyes.historial.umbral.bateria` | 20% · batería baja | 20% · low battery | 20% · batteria scarica |
| `spaceeyes.historial.umbral.senal` | −105 dBm · señal débil | −105 dBm · weak signal | −105 dBm · segnale debole |
| `spaceeyes.historial.ver-datos` | Ver los datos | Show the data | Vedi i dati |
| `spaceeyes.historial.caption` | Batería y señal por hora | Battery and signal per hour | Batteria e segnale per ora |
| `spaceeyes.historial.hora` | Hora | Time | Ora |
| `spaceeyes.historial.peor` | peor {valor} | worst {valor} | peggiore {valor} |
| `spaceeyes.historial.aria` | {titulo} por hora. Peor valor del rango: {valor}. | {titulo} per hour. Worst value in the range: {valor}. | {titulo} per ora. Valore peggiore dell’intervallo: {valor}. |
| `spaceeyes.comun.estado` | Estado | Status | Stato |
| `spaceeyes.comun.encendida` | Encendida de {inicio} a {fin} | On from {inicio} to {fin} | Accesa dalle {inicio} alle {fin} |
| `spaceeyes.pantalla.titulo` | Pantalla y fallas | Screen and faults | Schermo e guasti |
| `spaceeyes.vigilancia.aprendiendo` | Aprendiendo | Learning | In apprendimento |
| `spaceeyes.vigilancia.vigilando` | Vigilando | Monitoring | In monitoraggio |
| `spaceeyes.falla.estado.abierta` | Abierta | Open | Aperto |
| `spaceeyes.falla.estado.recuperada` | Recuperada | Cleared | Risolto |
| `spaceeyes.falla.estado.descartada` | No era falla | Not a fault | Non era un guasto |
| `spaceeyes.falla.ver-evidencia` | Ver la foto de evidencia | View the evidence photo | Vedi la foto di prova |
| `spaceeyes.falla.alt-evidencia` | Evidencia de la falla | Fault evidence | Prova del guasto |
| `spaceeyes.falla.detectada` | Detectada | Detected | Rilevato |
| `spaceeyes.falla.falla` | Falla | Fault | Guasto |
| `spaceeyes.falla.evidencia` | Evidencia | Evidence | Prova |
| `spaceeyes.falla.a-mano` | ␣· a mano | ␣· manually | ␣· manuale |
| `spaceeyes.falla.al-detectar` | al detectar | when detected | al rilevamento |
| `spaceeyes.falla.al-recuperar` | al recuperar | when cleared | alla risoluzione |
| `spaceeyes.creativo.alt` | Creativo detectado | Detected creative | Creatività rilevata |
| `spaceeyes.creativo.aparecio` | Apareció {fecha} | First seen {fecha} | Comparsa {fecha} |
| `spaceeyes.creativo.visto.uno` | Visto {n} veces · último {hace} | Seen {n} time · last seen {hace} | Vista {n} volta · l’ultima {hace} fa |
| `spaceeyes.creativo.visto.otros` | Visto {n} veces · último {hace} | Seen {n} times · last seen {hace} | Vista {n} volte · l’ultima {hace} fa |
| `spaceeyes.creativo.ninguno` | Todavía no ha detectado creativos nuevos. | No new creatives detected yet. | Non ha ancora rilevato nuove creatività. |
| `spaceeyes.pyc.error` | No se pudo leer lo que el equipo vio en su pantalla: {error} | Could not read what the device saw on its screen: {error} | Impossibile leggere cosa ha visto il dispositivo sul suo schermo: {error} |
| `spaceeyes.pyc.leyendo` | Leyendo la vigilancia de la pantalla… | Reading the screen monitoring… | Lettura del monitoraggio dello schermo… |
| `spaceeyes.pyc.historial` | Historial de fallas | Fault history | Cronologia dei guasti |
| `spaceeyes.pyc.descripcion` | El equipo revisa su pantalla y avisa solo cuando confirma una falla o cuando se arregla. | The device checks its screen and only alerts when it confirms a fault or when it is fixed. | Il dispositivo controlla il suo schermo e avvisa solo quando conferma un guasto o quando viene risolto. |
| `spaceeyes.pyc.pantalla` | Pantalla: {valor} | Screen: {valor} | Schermo: {valor} |
| `spaceeyes.pyc.gabinetes` | {n} gabinetes | {n} cabinets | {n} cabinet |
| `spaceeyes.pyc.sin-marcar` | sin marcar | not marked | non segnato |
| `spaceeyes.pyc.ultima-revision` | Última revisión: {valor} | Last check: {valor} | Ultimo controllo: {valor} |
| `spaceeyes.pyc.ninguna` | todavía ninguna | none yet | ancora nessuno |
| `spaceeyes.pyc.detectada` | Detectada {fecha} · confianza {pct} | Detected {fecha} · confidence {pct} | Rilevato {fecha} · affidabilità {pct} |
| `spaceeyes.pyc.sin-abiertas` | Sin fallas abiertas. | No open faults. | Nessun guasto aperto. |
| `spaceeyes.pyc.donde` | Dónde | Where | Dove |
| `spaceeyes.pyc.cerrada` | Cerrada | Closed | Chiuso |
| `spaceeyes.pyc.sin-vigilar` | Este equipo no está vigilando su pantalla. Se enciende en Space Eye (necesita la app 0.15 o posterior). | This device is not monitoring its screen. It is turned on in Space Eye (requires app 0.15 or later). | Questo dispositivo non sta monitorando il suo schermo. Si attiva in Space Eye (serve l’app 0.15.0 o successiva). |
| `spaceeyes.pyc.sin-datos` | Space Eye no tiene datos de pantalla de este equipo. | Space Eye has no screen data for this device. | Space Eye non ha dati dello schermo di questo dispositivo. |
| `spaceeyes.pyc.creativos` | Creativos detectados | Detected creatives | Creatività rilevate |
| `spaceeyes.pyc.creativos.texto` | Cada anuncio distinto que ha pasado por la pantalla, reconocido por el propio equipo. | Every distinct ad that has played on the screen, recognized by the device itself. | Ogni annuncio diverso passato sullo schermo, riconosciuto dal dispositivo stesso. |
| `spaceeyes.pyc.sin-vigilar-creativos` | Este equipo no está vigilando los creativos de su pantalla. | This device is not monitoring the creatives on its screen. | Questo dispositivo non sta monitorando le creatività del suo schermo. |
| `spaceeyes.pyc.sin-datos-corto` | Sin datos | No data | Nessun dato |
| `spaceeyes.pyc.apagada` | Apagada | Off | Spento |
| `spaceeyes.comun.sin-permiso-cambiar` | No tienes permiso para cambiar esto. | You do not have permission to change this. | Non hai il permesso di modificare questa impostazione. |
| `spaceeyes.comun.no-guardar` | No se pudo guardar: {motivo} | Could not save: {motivo} | Impossibile salvare: {motivo} |
| `spaceeyes.comun.apagado` | Apagado | Off | Disattivato |
| `spaceeyes.comun.frecuencia` | Frecuencia | Frequency | Frequenza |
| `spaceeyes.comun.ver-grande` | Ver en grande | View larger | Vedi in grande |
| `spaceeyes.frecuencia.30` | Cada 30 min | Every half hour | Ogni mezz’ora |
| `spaceeyes.frecuencia.60` | Cada hora | Every hour | Ogni ora |
| `spaceeyes.frecuencia.120` | Cada 2 horas | Every two hours | Ogni due ore |
| `spaceeyes.frecuencia.180` | Cada 3 horas | Every three hours | Ogni tre ore |
| `spaceeyes.frecuencia.360` | Cada 6 horas | Every six hours | Ogni sei ore |
| `spaceeyes.frecuencia.720` | Cada 12 horas | Every twelve hours | Ogni dodici ore |
| `spaceeyes.frecuencia.otra` | Cada {n} min | Every {n} min | Ogni {n} min |
| `spaceeyes.creativos.frecuencia.0` | Continuo (avisa al minuto) | Continuous (alerts within a minute) | Continuo (avvisa entro un minuto) |
| `spaceeyes.creativos.envio.0` | Al momento | Right away | Subito |
| `spaceeyes.creativos.envio.120` | Juntas cada 2 horas | Batched every two hours | Raggruppate ogni due ore |
| `spaceeyes.creativos.envio.240` | Juntas cada 4 horas | Batched every four hours | Raggruppate ogni quattro ore |
| `spaceeyes.creativos.envio.480` | Juntas cada 8 horas | Batched every eight hours | Raggruppate ogni otto ore |
| `spaceeyes.creativos.envio.720` | Juntas cada 12 horas | Batched every twelve hours | Raggruppate ogni dodici ore |
| `spaceeyes.creativos.envio.otra` | Juntas cada {n} min | Batched every {n} min | Raggruppate ogni {n} min |
| `spaceeyes.creativos.mes` | Datos del chip este mes | SIM data this month | Dati della SIM questo mese |
| `spaceeyes.creativos.mes.ayuda` | Datos móviles (chip) que el equipo lleva este mes, según su propio reporte. Casi todo lo gasta la vista en vivo; las fotos de creativos pesan poco. | Mobile data (SIM) the device has used this month, as it reports itself. The live view uses almost all of it; creative photos weigh little. | Dati mobili (SIM) che il dispositivo ha consumato questo mese, secondo la sua stessa rilevazione. Quasi tutto lo consuma la vista in diretta; le foto delle creatività pesano poco. |
| `spaceeyes.creativos.mes.sin` | El equipo todavía no reporta su consumo. | The device does not report its usage yet. | Il dispositivo non comunica ancora il suo consumo. |
| `spaceeyes.creativos.no-reiniciar` | No se pudo reiniciar: {motivo} | Could not reset: {motivo} | Impossibile azzerare: {motivo} |
| `spaceeyes.creativos.no-descartar` | No se pudo descartar: {motivo} | Could not dismiss: {motivo} | Impossibile scartare: {motivo} |
| `spaceeyes.creativos.error` | No se pudo leer la vigilancia de creativos: {error} | Could not read the creative monitoring: {error} | Impossibile leggere il monitoraggio delle creatività: {error} |
| `spaceeyes.creativos.leyendo` | Leyendo la vigilancia de creativos… | Reading the creative monitoring… | Lettura del monitoraggio delle creatività… |
| `spaceeyes.creativos.titulo` | Vigilancia de creativos | Creative monitoring | Monitoraggio delle creatività |
| `spaceeyes.creativos.descripcion` | El equipo reconoce los anuncios de su pantalla sin gastar datos y solo sube foto cuando aparece uno que no conocía. | The device recognizes the ads on its screen without using data and only uploads a photo when one it did not know appears. | Il dispositivo riconosce gli annunci del suo schermo senza consumare dati e carica una foto solo quando ne compare uno che non conosceva. |
| `spaceeyes.creativos.continuo` | Vigilando en continuo | Monitoring continuously | Monitoraggio continuo |
| `spaceeyes.creativos.vigilar` | Vigilar la pantalla | Monitor the screen | Monitora lo schermo |
| `spaceeyes.creativos.no-sabe` | Este equipo no sabe vigilar su pantalla todavía: los celulares necesitan la app 0.15.0 o posterior, y el agente de PC no lo tiene. | This device cannot monitor its screen yet: phones need app 0.15.0 or later, and the PC agent does not have it. | Questo dispositivo non sa ancora monitorare il suo schermo: i telefoni hanno bisogno dell’app 0.15.0 o successiva, e l’agente per PC non ha questa funzione. |
| `spaceeyes.creativos.sin-marcar` | Falta marcar la pantalla (en «Pantalla y fallas»): sin eso el equipo no reconoce creativos, porque el fondo los confunde entre sí. | The screen still has to be marked (in “Screen and faults”): without that the device cannot recognize creatives, because the background mixes them up. | Manca da segnare lo schermo (in «Schermo e guasti»): senza questo il dispositivo non riconosce le creatività, perché lo sfondo le confonde tra loro. |
| `spaceeyes.creativos.aprendiendo` | Aprendiendo el loop hasta {fin}: en este plazo no toma fotos. | Learning the loop until {fin}: it takes no photos during this time. | Apprendimento del loop fino a {fin}: in questo periodo non scatta foto. |
| `spaceeyes.creativos.fotos-hoy` | Fotos hoy | Photos today | Foto oggi |
| `spaceeyes.creativos.catalogo` | En el catálogo | In the catalog | Nel catalogo |
| `spaceeyes.creativos.frecuencia.ayuda` | Continuo: el equipo mira su pantalla todo el día dentro del horario y avisa en menos de un minuto cuando sale un creativo nuevo. Sigue sin gastar datos: solo manda la foto de lo nuevo. | Continuous: the device watches its screen all day within operating hours and alerts within a minute when a new creative appears. It still uses no data: it only sends the photo of what is new. | Continuo: il dispositivo guarda il suo schermo tutto il giorno entro l’orario e avvisa in meno di un minuto quando compare una nuova creatività. Continua a non consumare dati: invia solo la foto delle novità. |
| `spaceeyes.creativos.reaprender` | Volver a aprender | Relearn | Riapprendi |
| `spaceeyes.creativos.envio.ayuda` | Mirar y mandar son dos cosas: el equipo mira todo el tiempo y aquí se elige cuándo viajan las fotos. Juntas llega una por creativo, la más nítida; un creativo que se repite no se vuelve a mandar. | Watching and sending are two different things: the device watches all the time, and here you choose when the photos travel. Batched, one arrives per creative, the sharpest; a creative that repeats is not sent again. | Guardare e inviare sono due cose distinte: il dispositivo guarda sempre e qui si sceglie quando partono le foto. Raggruppate ne arriva una per creatività, la più nitida; una creatività che si ripete non viene inviata di nuovo. |
| `spaceeyes.creativos.envio` | Mandar las fotos nuevas | Send new photos | Invia le foto nuove |
| `spaceeyes.creativos.envio.pie` | Solo las nuevas: una foto por creativo. Mirar no gasta datos. | Only new ones: one photo per creative. Watching uses no data. | Solo le nuove: una foto per creatività. Guardare non consuma dati. |
| `spaceeyes.creativos.intervalos` | Mirando por intervalos, un creativo que sale una sola vez entre dos miradas no se ve. Para no perder ninguno, usa «Continuo»: mirar no gasta datos, y con «Juntas cada N horas» decides cuándo llegan las fotos. | Watching at intervals, a creative that plays only once between two looks is missed. To miss none, use “Continuous”: watching uses no data, and with “Batched every N hours” you decide when the photos arrive. | Guardando a intervalli, una creatività che compare una sola volta tra due controlli non si vede. Per non perderne nessuna, usa «Continuo»: guardare non consuma dati, e con «Raggruppate ogni N ore» decidi quando arrivano le foto. |
| `spaceeyes.creativos.nuevos` | Creativos nuevos detectados | New creatives detected | Nuove creatività rilevate |
| `spaceeyes.creativos.no-nuevo.ayuda` | No era un creativo nuevo (reflejo, pantalla apagada…) | It was not a new creative (reflection, screen off…) | Non era una nuova creatività (riflesso, schermo spento…) |
| `spaceeyes.creativos.descartando` | Descartando… | Dismissing… | Scarto in corso… |
| `spaceeyes.creativos.no-nuevo` | No es nuevo | Not new | Non è nuova |
| `spaceeyes.creativos.reaprender.titulo` | Volver a aprender la pantalla | Relearn the screen | Riapprendi lo schermo |
| `spaceeyes.creativos.reaprender.texto` | Se borra todo lo que el equipo aprendió de esta pantalla. Vuelve a aprender durante el plazo de aprendizaje, y en ese tiempo no toma fotos. | Everything the device learned about this screen is erased. It learns again during the learning period, and takes no photos in that time. | Si cancella tutto ciò che il dispositivo ha appreso di questo schermo. Lo riapprende durante il periodo di apprendimento, e in quel tempo non scatta foto. |
| `spaceeyes.comun.encendido` | Encendido | On | Attivo |
| `spaceeyes.comun.guardando` | Guardando… | Saving… | Salvataggio… |
| `spaceeyes.pconfig.aprendizaje.0` | Solo la primera vuelta (pruebas) | First pass only (testing) | Solo il primo giro (prove) |
| `spaceeyes.pconfig.aprendizaje.30` | 30 minutos | 30 minutes | 30 minuti |
| `spaceeyes.pconfig.aprendizaje.120` | 2 horas | 2 hours | 2 ore |
| `spaceeyes.pconfig.aprendizaje.360` | 6 horas | 6 hours | 6 ore |
| `spaceeyes.pconfig.aprendizaje.1440` | 24 horas | 24 hours | 24 ore |
| `spaceeyes.pconfig.frecuencia.5` | Cada 5 min (pruebas) | Every five minutes (testing) | Ogni cinque minuti (prove) |
| `spaceeyes.pconfig.frecuencia.15` | Cada 15 min (pruebas) | Every fifteen minutes (testing) | Ogni quindici minuti (prove) |
| `spaceeyes.pconfig.guardada.reinicia` | Pantalla guardada. El equipo vuelve a aprenderla desde cero. | Screen saved. The device learns it again from scratch. | Schermo salvato. Il dispositivo lo riapprende da zero. |
| `spaceeyes.pconfig.guardada` | Pantalla guardada. | Screen saved. | Schermo salvato. |
| `spaceeyes.pconfig.no-guardar` | No se pudo guardar la pantalla: {motivo} | Could not save the screen: {motivo} | Impossibile salvare lo schermo: {motivo} |
| `spaceeyes.pconfig.error` | No se pudo leer la pantalla del equipo: {error} | Could not read the device screen: {error} | Impossibile leggere lo schermo del dispositivo: {error} |
| `spaceeyes.pconfig.leyendo` | Leyendo la pantalla del equipo… | Reading the device screen… | Lettura dello schermo del dispositivo… |
| `spaceeyes.pconfig.descripcion` | El equipo revisa su pantalla por sí mismo y solo avisa cuando confirma una falla o cuando se arregla. No manda video ni fotos mientras todo está bien. | The device checks its own screen and only alerts when it confirms a fault or when it is fixed. It sends no video or photos while everything is fine. | Il dispositivo controlla il suo schermo da solo e avvisa solo quando conferma un guasto o quando viene risolto. Non invia video né foto finché va tutto bene. |
| `spaceeyes.pconfig.apagada` | Vigilancia apagada | Monitoring off | Monitoraggio disattivato |
| `spaceeyes.pconfig.vigilar` | Vigilar fallas | Monitor faults | Monitora i guasti |
| `spaceeyes.pconfig.no-sabe` | La vigilancia de fallas necesita la app 0.15.0 o posterior en el celular, o el agente 0.7.0 en la Raspberry. El agente de PC todavía no la tiene. | Fault monitoring needs app 0.15.0 or later on the phone, or agent 0.7.0 on the Raspberry. The PC agent does not have it yet. | Il monitoraggio dei guasti richiede l’app 0.15.0 o successiva sul telefono, o l’agente 0.7.0 sul Raspberry. L’agente per PC non ha ancora questa funzione. |
| `spaceeyes.pconfig.sin-marcar.aviso` | Falta marcar dónde está la pantalla en la foto: sin eso el equipo no vigila fallas ni creativos. | You still need to mark where the screen is in the photo: without that the device monitors neither faults nor creatives. | Manca da segnare dove si trova lo schermo nella foto: senza questo il dispositivo non monitora né guasti né creatività. |
| `spaceeyes.pconfig.pantalla` | Pantalla | Screen | Schermo |
| `spaceeyes.pconfig.gabinetes` | {n} gabinetes {medida} | {n} cabinets {medida} | {n} cabinet {medida} |
| `spaceeyes.pconfig.sin-marcar` | Sin marcar | Not marked | Non segnato |
| `spaceeyes.pconfig.cambiar` | Cambiar pantalla | Change screen | Cambia schermo |
| `spaceeyes.pconfig.marcar` | Marcar la pantalla | Mark the screen | Segna lo schermo |
| `spaceeyes.pconfig.solo-dueno` | Marcar la pantalla la cambia para el equipo y borra lo que aprendió: solo lo hace el Dueño. | Marking the screen changes it for the device and erases what it learned: only the Owner can do it. | Segnare lo schermo lo cambia per il dispositivo e cancella ciò che ha appreso: lo fa solo il Titolare. |
| `spaceeyes.pconfig.aprendizaje.ayuda` | Antes de avisar, el equipo aprende cómo se ve la pantalla normalmente. Siempre aprende al menos su primera vuelta con la pantalla funcionando. | Before alerting, the device learns what the screen normally looks like. It always learns at least its first pass with the screen working. | Prima di avvisare, il dispositivo impara come appare normalmente lo schermo. Apprende sempre almeno il suo primo giro con lo schermo funzionante. |
| `spaceeyes.pconfig.aprendizaje` | Aprendizaje | Learning | Apprendimento |
| `spaceeyes.pconfig.aprendizaje.texto` | Cuánto observa antes de empezar a avisar. | How long it watches before it starts alerting. | Quanto osserva prima di iniziare ad avvisare. |
| `spaceeyes.pconfig.frecuencia.texto` | Cada cuánto revisa la pantalla (dentro del horario). | How often it checks the screen (within operating hours). | Ogni quanto controlla lo schermo (entro l’orario). |
| `spaceeyes.pconfig.rapido.ayuda` | Mientras mira su pantalla, si el equipo la ve entera apagada tres veces seguidas (con luz alrededor) avisa en ese momento, con su foto, sin esperar la siguiente revisión. De noche o con la lente tapada no avisa así: eso lo decide la revisión de siempre. | While watching its screen, if the device sees it completely off three times in a row (with light around) it alerts right then, with its photo, without waiting for the next check. At night or with the lens covered it does not alert this way: the usual check decides that. | Mentre guarda il suo schermo, se il dispositivo lo vede completamente spento tre volte di seguito (con luce intorno) avvisa in quel momento, con la sua foto, senza aspettare il controllo successivo. Di notte o con l’obiettivo coperto non avvisa così: lo decide il controllo di sempre. |
| `spaceeyes.pconfig.rapido` | Avisar al instante si la pantalla se apaga completa | Alert immediately if the whole screen goes off | Avvisa subito se lo schermo si spegne completamente |
| `spaceeyes.pconfig.rapido.texto` | En menos de un minuto y una sola vez por apagón; se cierra sola cuando vuelve. | Within a minute and only once per outage; it closes itself when the screen comes back. | In meno di un minuto e una sola volta per spegnimento; si chiude da solo quando torna. |
| `spaceeyes.pconfig.esquinas` | Esquinas | Corners | Angoli |
| `spaceeyes.pconfig.zonas` | Zonas tapadas | Blocked areas | Zone coperte |
| `spaceeyes.pconfig.filas` | Filas | Rows | Righe |
| `spaceeyes.pconfig.columnas` | Columnas | Columns | Colonne |
| `spaceeyes.pconfig.editor.desde` | Encendida de | On from | Acceso dalle |
| `spaceeyes.pconfig.editor.a` | a | to | alle |
| `spaceeyes.pconfig.horario-mal` | El horario va en HH:MM, de 00:00 a 24:00. | Hours go in HH:MM, from 00:00 to 24:00. | L’orario va in HH:MM, da 00:00 a 24:00. |
| `spaceeyes.pconfig.ayuda.esquinas` | Toca las 4 esquinas de la pantalla en orden: {orden}. Después puedes arrastrarlas. Pon filas y columnas de gabinetes para que las líneas coincidan con las uniones. Si cambias el zoom o el lente del equipo, hay que volver a marcarla. | Click the 4 corners of the screen in order: {orden}. Then you can drag them. Set the cabinet rows and columns so the lines match the seams. If you change the device zoom or lens, you have to mark it again. | Clicca i 4 angoli dello schermo in ordine: {orden}. Poi puoi trascinarli. Indica righe e colonne di cabinet perché le linee coincidano con le giunture. Se cambi lo zoom o l’obiettivo del dispositivo, bisogna segnarlo di nuovo. |
| `spaceeyes.pconfig.ayuda.orden` | arriba izquierda, arriba derecha, abajo derecha, abajo izquierda | top left, top right, bottom right, bottom left | in alto a sinistra, in alto a destra, in basso a destra, in basso a sinistra |
| `spaceeyes.pconfig.ayuda.zonas` | Toca los gabinetes que algo tapa siempre (una barda, un árbol, un poste): no se revisan. El equipo también las aprende solo en sus primeras 24 horas. | Click the cabinets that something always blocks (a wall, a tree, a pole): they are not checked. The device also learns them on its own in its first 24 hours. | Clicca i cabinet che qualcosa copre sempre (un muro, un albero, un palo): non vengono controllati. Il dispositivo li impara anche da solo nelle sue prime 24 ore. |
| `spaceeyes.pconfig.sin-foto` | Toma primero una foto del equipo para poder marcar la pantalla. | Take a photo with the device first so you can mark the screen. | Scatta prima una foto dal dispositivo per poter segnare lo schermo. |
| `spaceeyes.pconfig.alt-foto` | Última foto del equipo | Latest photo from the device | Ultima foto del dispositivo |
| `spaceeyes.pconfig.guardar` | Guardar pantalla | Save screen | Salva schermo |
| `spaceeyes.pconfig.empezar` | Volver a empezar | Start over | Ricomincia |
| `spaceeyes.pconfig.ultima` | Última revisión | Last check | Ultimo controllo |
| `spaceeyes.pconfig.aprendiendo` | Aprendiendo la pantalla hasta {fin}: en este plazo no avisa de fallas. | Learning the screen until {fin}: it does not alert about faults during this time. | Apprendimento dello schermo fino a {fin}: in questo periodo non avvisa dei guasti. |
| `spaceeyes.pconfig.primera-vuelta` | Aprendiendo con su primera vuelta: la siguiente ya vigila. | Learning on its first pass: the next one already monitors. | Apprendimento con il primo giro: dal prossimo è già in monitoraggio. |
| `spaceeyes.pconfig.camara-bloqueada` | Android no le deja usar la cámara en segundo plano, así que no está revisando la pantalla. Abre la app Space Eye en el celular una vez y se arregla sola. Pasa tras reiniciar el celular, salvo que la app sea dueña del dispositivo. | Android does not let it use the camera in the background, so it is not checking the screen. Open the Space Eye app on the phone once and it fixes itself. This happens after the phone restarts, unless the app is the device owner. | Android non gli permette di usare la fotocamera in background, quindi non sta controllando lo schermo. Apri una volta l’app Space Eye sul telefono e si risolve da solo. Succede dopo il riavvio del telefono, a meno che l’app non sia proprietaria del dispositivo. |
| `spaceeyes.pconfig.quietos` | Gabinetes que nunca cambian (no se revisan): {lista}. Suelen estar tapados por algo; si no hay nada delante, revísalos: podrían llevar tiempo apagados. | Cabinets that never change (not checked): {lista}. Something usually blocks them; if nothing is in front, check them: they could have been off for a while. | Cabinet che non cambiano mai (non vengono controllati): {lista}. Di solito sono coperti da qualcosa; se davanti non c’è niente, controllali: potrebbero essere spenti da tempo. |
| `spaceeyes.pconfig.confirmar.titulo` | Cambió el encuadre de la pantalla | The screen framing changed | L’inquadratura dello schermo è cambiata |
| `spaceeyes.pconfig.confirmar.boton` | Guardar de todos modos | Save anyway | Salva comunque |
| `spaceeyes.pconfig.confirmar.texto` | Cambiaron las esquinas o los gabinetes, así que el equipo olvida lo que había aprendido. Vuelve a aprender antes de poder avisar de fallas. | The corners or the cabinets changed, so the device forgets what it had learned. It learns again before it can alert about faults. | Sono cambiati gli angoli o i cabinet, quindi il dispositivo dimentica ciò che aveva appreso. Deve riapprendere prima di poter avvisare dei guasti. |
| `spaceeyes.pconfig.revision.ninguna` | El equipo todavía no ha hecho ninguna revisión. | The device has not done any check yet. | Il dispositivo non ha ancora fatto nessun controllo. |
| `spaceeyes.pconfig.revision.ok` | se ve bien | looks fine | si vede bene |
| `spaceeyes.pconfig.revision.apagada` | apagada | off | spento |
| `spaceeyes.pconfig.revision.congelada` | congelada | frozen | bloccato |
| `spaceeyes.pconfig.revision.inconcluso` | no se pudo juzgar | could not be judged | non valutabile |
| `spaceeyes.pconfig.revision.movida` | ␣· la cámara se movió | ␣· the camera moved | ␣· la fotocamera si è spostata |
| `spaceeyes.pconfig.revision.sin-imagen` | ␣· sin imagen | ␣· no image | ␣· nessuna immagine |
| `spaceeyes.pconfig.revision.corte` | ␣La vuelta se interrumpió (vista en vivo o una foto): se usaron {usados} de {total} vistazos. | ␣The pass was interrupted (live view or a photo): {usados} of {total} looks were used. | ␣Il giro si è interrotto (vista in diretta o una foto): sono state usate {usados} di {total} osservazioni. |
| `spaceeyes.pconfig.vistazos.uno` | {n} vistazos | {n} look | {n} osservazione |
| `spaceeyes.pconfig.vistazos.otros` | {n} vistazos | {n} looks | {n} osservazioni |
| `spaceeyes.pconfig.cambios.uno` | {n} cambios de anuncio | {n} ad change | {n} cambio di annuncio |
| `spaceeyes.pconfig.cambios.otros` | {n} cambios de anuncio | {n} ad changes | {n} cambi di annuncio |
| `spaceeyes.pconfig.revision` | {cuando} · pantalla {pantalla}{camara} ({vistazos}, {cambios}).{corte} | {cuando} · screen {pantalla}{camara} ({vistazos}, {cambios}).{corte} | {cuando} · schermo {pantalla}{camara} ({vistazos}, {cambios}).{corte} |
| `spaceeyes.actualizacion.sola` | Se actualiza sola. | Updates on its own. | Si aggiorna da sola. |
| `spaceeyes.actualizacion.kiosco` | Se actualiza sola (modo kiosco). | Updates on its own (kiosk mode). | Si aggiorna da sola (modalità kiosk). |
| `spaceeyes.actualizacion.sin-tocar` | Se actualiza sola, sin tocar el teléfono. | Updates on its own, without touching the phone. | Si aggiorna da sola, senza toccare il telefono. |
| `spaceeyes.actualizacion.android-viejo` | Pide un toque en el teléfono en cada actualización: tiene Android 11 o anterior. | Someone has to confirm on the phone for every update: it runs Android 11 or earlier. | A ogni aggiornamento serve una conferma sul telefono: ha Android 11 o precedente. |
| `spaceeyes.actualizacion.sin-instalar-apps` | Pide un toque: en el teléfono está apagado «Instalar apps desconocidas» para Space Eye. | Someone has to confirm on the phone: “Install unknown apps” is turned off for Space Eye. | Serve una conferma sul telefono: per Space Eye è disattivato «Installa app sconosciute». |
| `spaceeyes.actualizacion.otro-dueno` | Pide un toque: otra tienda administra sus actualizaciones. | Someone has to confirm on the phone: another store manages its updates. | Serve una conferma sul telefono: un altro store gestisce i suoi aggiornamenti. |
| `spaceeyes.actualizacion.proxima` | La próxima actualización pide un toque en el teléfono; después se actualiza sola. | The next update needs a confirmation on the phone; after that it updates on its own. | Il prossimo aggiornamento richiede una conferma sul telefono; poi si aggiorna da sola. |
| `spaceeyes.actualizacion.visita` | Necesita una visita: esta versión no se puede actualizar a distancia. | Needs a site visit: this version cannot be updated remotely. | Serve un sopralluogo: questa versione non si può aggiornare a distanza. |
| `spaceeyes.comun.sin-permiso` | No tienes permiso para esto. | You do not have permission for this. | Non hai il permesso per farlo. |
| `spaceeyes.comun.nombre` | Nombre | Name | Nome |
| `spaceeyes.comun.brillo` | Brillo | Brightness | Luminosità |
| `spaceeyes.comun.exposicion` | Exposición | Exposure | Esposizione |
| `spaceeyes.comun.balance` | Balance de blancos | White balance | Bilanciamento del bianco |
| `spaceeyes.balance.daylight` | Luz de día | Daylight | Luce diurna |
| `spaceeyes.balance.cloudy` | Nublado | Cloudy | Nuvoloso |
| `spaceeyes.balance.fluorescent` | Fluorescente | Fluorescent | Fluorescente |
| `spaceeyes.admin.estado.provisioning` | En operación | In operation | In esercizio |
| `spaceeyes.admin.estado.active` | Activa | Active | Attivo |
| `spaceeyes.admin.estado.maintenance` | En mantenimiento | Under maintenance | In manutenzione |
| `spaceeyes.admin.estado.inactive` | Dada de baja | Decommissioned | Dismesso |
| `spaceeyes.admin.control.centro-x` | Centro horizontal | Horizontal center | Centro orizzontale |
| `spaceeyes.admin.control.centro-y` | Centro vertical | Vertical center | Centro verticale |
| `spaceeyes.admin.control.contraste` | Contraste | Contrast | Contrasto |
| `spaceeyes.admin.control.saturacion` | Saturación | Saturation | Saturazione |
| `spaceeyes.admin.control.nitidez` | Nitidez | Sharpness | Nitidezza |
| `spaceeyes.admin.medicion.centre` | Centro del cuadro (normal) | Center of the frame (normal) | Centro dell’inquadratura (normale) |
| `spaceeyes.admin.medicion.spot` | Solo el centro — para exponer la pantalla | Center only — to expose for the screen | Solo il centro — per esporre lo schermo |
| `spaceeyes.admin.medicion.average` | Todo el cuadro por igual | Whole frame equally | Tutta l’inquadratura in modo uniforme |
| `spaceeyes.admin.medicion.matrix` | Por zonas | By zones | Per zone |
| `spaceeyes.admin.balance.auto` | Automático | Automatic | Automatico |
| `spaceeyes.admin.balance.tungsten` | Foco incandescente | Incandescent bulb | Lampadina a incandescenza |
| `spaceeyes.admin.balance.indoor` | Interior | Indoor | Interno |
| `spaceeyes.admin.error` | No se pudo leer el equipo: {error} | Could not read the device: {error} | Impossibile leggere il dispositivo: {error} |
| `spaceeyes.admin.leyendo` | Leyendo el equipo… | Reading the device… | Lettura del dispositivo… |
| `spaceeyes.admin.datos.guardados` | Datos del sitio guardados. | Site details saved. | Dati del sito salvati. |
| `spaceeyes.admin.ficha` | Ficha del equipo | Device profile | Scheda del dispositivo |
| `spaceeyes.admin.ficha.texto` | Dónde está y qué aparato es. | Where it is and what hardware it is. | Dove si trova e che apparecchio è. |
| `spaceeyes.admin.editar` | Editar datos | Edit details | Modifica dati |
| `spaceeyes.admin.sitio` | Sitio | Site | Sito |
| `spaceeyes.admin.codigo` | Código del espectacular | Billboard code | Codice del cartellone |
| `spaceeyes.admin.direccion` | Dirección | Address | Indirizzo |
| `spaceeyes.admin.aparato` | Aparato | Hardware | Apparecchio |
| `spaceeyes.admin.version-app` | Versión de la app | App version | Versione dell’app |
| `spaceeyes.admin.salud` | Conexión y salud | Connection and health | Connessione e salute |
| `spaceeyes.admin.red` | Red | Network | Rete |
| `spaceeyes.admin.operador` | Operador | Carrier | Operatore |
| `spaceeyes.admin.ip` | IP pública | Public IP | IP pubblico |
| `spaceeyes.admin.ultima-conexion` | Última conexión | Last connection | Ultima connessione |
| `spaceeyes.admin.temp-cpu` | Temperatura CPU | CPU temperature | Temperatura CPU |
| `spaceeyes.admin.temp-bateria` | Temperatura batería | Battery temperature | Temperatura batteria |
| `spaceeyes.admin.editar.titulo` | Editar datos del sitio | Edit site details | Modifica i dati del sito |
| `spaceeyes.admin.nombre-ej` | Ej. Espectacular Reforma 222 | E.g. Reforma 222 billboard | Es. Cartellone Reforma 222 |
| `spaceeyes.admin.ciudad` | Ciudad | City | Città |
| `spaceeyes.admin.estado-region` | Estado | State | Stato/Regione |
| `spaceeyes.admin.latitud` | Latitud | Latitude | Latitudine |
| `spaceeyes.admin.longitud` | Longitud | Longitude | Longitudine |
| `spaceeyes.admin.coordenadas-mal` | La latitud va de −90 a 90 y la longitud de −180 a 180. | Latitude goes from −90 to 90 and longitude from −180 to 180. | La latitudine va da −90 a 90 e la longitudine da −180 a 180. |
| `spaceeyes.admin.coordenadas` | Déjalas vacías si no las sabes. Sirven para ubicar la pantalla y para calcular la luz de su sitio, que es lo que decide a qué horas la foto sale limpia y a qué horas sale con líneas. | Leave them empty if you do not know them. They place the screen on the map and work out the light at its site, which decides at what times the photo comes out clean and at what times it shows lines. | Lasciale vuote se non le conosci. Servono a localizzare l’impianto e a calcolare la luce del suo sito, che è ciò che decide a che ora la foto viene pulita e a che ora viene con le righe. |
| `spaceeyes.admin.estado-pantalla` | Estado de la pantalla | Screen status | Stato dell’impianto |
| `spaceeyes.admin.estado-ayuda` | Mantenimiento y dada de baja dejan a la pantalla fuera de las programaciones: no le llegan fotos y deja de gastar datos, sin borrar nada. En operación y activa hoy se comportan igual. | Maintenance and decommissioned take the screen out of the schedules: it gets no photos and stops using data, without deleting anything. “In operation” and “Active” currently behave the same. | In manutenzione e Dismesso lasciano l’impianto fuori dalle programmazioni: non riceve foto e smette di consumare dati, senza cancellare nulla. In esercizio e Attivo oggi si comportano allo stesso modo. |
| `spaceeyes.admin.actualizar.pc` | Se instalará el agente publicado en esta PC. Verifica la huella del archivo antes de sustituirlo y, si el programa nuevo no arranca, vuelve solo al anterior. | The published agent will be installed on this PC. It verifies the file checksum before replacing it and, if the new program does not start, it rolls back on its own. | Verrà installato l’agente pubblicato su questo PC. Verifica l’impronta del file prima di sostituirlo e, se il nuovo programma non si avvia, torna da solo al precedente. |
| `spaceeyes.admin.actualizar.pi` | Se instalará el agente publicado en esta Raspberry. Verifica la huella y lo prueba antes de reemplazar nada; si la versión nueva no arranca, vuelve sola a la anterior. La identidad del equipo y sus fotos pendientes se conservan. | The published agent will be installed on this Raspberry. It verifies the checksum and tests it before replacing anything; if the new version does not start, it rolls back on its own. The device identity and its pending photos are kept. | Verrà installato l’agente pubblicato su questo Raspberry. Verifica l’impronta e lo prova prima di sostituire qualsiasi cosa; se la nuova versione non si avvia, torna da sola alla precedente. L’identità del dispositivo e le sue foto in sospeso vengono conservate. |
| `spaceeyes.admin.actualizar.version` | Se instalará la versión {version} en este equipo. Tardará un par de minutos y la app se reiniciará sola. | Version {version} will be installed on this device. It takes a couple of minutes and the app restarts on its own. | Verrà installata la versione {version} su questo dispositivo. Ci vorrà un paio di minuti e l’app si riavvierà da sola. |
| `spaceeyes.admin.actualizar.publicada` | Se instalará la versión publicada en este equipo. Tardará un par de minutos y la app se reiniciará sola. | The published version will be installed on this device. It takes a couple of minutes and the app restarts on its own. | Verrà installata la versione pubblicata su questo dispositivo. Ci vorrà un paio di minuti e l’app si riavvierà da sola. |
| `spaceeyes.admin.actualizar.de-todos-modos` | {como} ¿Enviar de todos modos? | {como} Send anyway? | {como} Inviare comunque? |
| `spaceeyes.admin.orden.reiniciar` | Orden enviada: la app se reinicia en el equipo. | Command sent: the app restarts on the device. | Comando inviato: l’app si riavvia sul dispositivo. |
| `spaceeyes.admin.orden.equipo` | Orden enviada: la Raspberry se reinicia; vuelve a reportar en uno o dos minutos. | Command sent: the Raspberry restarts; it reports again in a minute or two. | Comando inviato: il Raspberry si riavvia; tornerà a comunicare in uno o due minuti. |
| `spaceeyes.admin.orden.actualizar` | Actualización enviada; el equipo se reiniciará al terminar. | Update sent; the device will restart when it finishes. | Aggiornamento inviato; il dispositivo si riavvierà al termine. |
| `spaceeyes.admin.orden.confirmar` | Orden enviada: falta confirmar la instalación en el equipo. | Command sent: the installation still has to be confirmed on the device. | Comando inviato: manca la conferma dell’installazione sul dispositivo. |
| `spaceeyes.admin.motivo.apk` | No hay APK publicada en el servidor. | There is no APK published on the server. | Non c’è nessun APK pubblicato sul server. |
| `spaceeyes.admin.motivo.pc` | No hay agente de PC publicado en el servidor. | There is no PC agent published on the server. | Non c’è nessun agente per PC pubblicato sul server. |
| `spaceeyes.admin.motivo.pi` | No hay agente de Raspberry publicado en el servidor. | There is no Raspberry agent published on the server. | Non c’è nessun agente per Raspberry pubblicato sul server. |
| `spaceeyes.admin.orden.error` | No se pudo enviar la orden: {motivo} | Could not send the command: {motivo} | Impossibile inviare il comando: {motivo} |
| `spaceeyes.admin.programa` | Programa del equipo | Device software | Software del dispositivo |
| `spaceeyes.admin.programa.texto` | Reiniciar la app, o instalarle la versión publicada, sin ir al sitio. | Restart the app, or install the published version, without going to the site. | Riavvia l’app, o installa la versione pubblicata, senza andare sul sito. |
| `spaceeyes.admin.programa.texto-pi` | Reiniciar la app o el equipo, o instalarle la versión publicada, sin ir al sitio. | Restart the app or the device, or install the published version, without going to the site. | Riavvia l’app o il dispositivo, o installa la versione pubblicata, senza andare sul sito. |
| `spaceeyes.admin.instalada` | Instalada | Installed | Installata |
| `spaceeyes.admin.publicada` | Publicada | Published | Pubblicata |
| `spaceeyes.admin.sin-numero` | sin número | no number | senza numero |
| `spaceeyes.admin.nada-publicado` | nada publicado | nothing published | niente di pubblicato |
| `spaceeyes.admin.nueva` | Hay una versión nueva: {version}. | A new version is available: {version}. | C’è una nuova versione: {version}. |
| `spaceeyes.admin.se-instala-sola` | Se instala sola, sin tocar el equipo. | It installs on its own, without touching the device. | Si installa da sola, senza toccare il dispositivo. |
| `spaceeyes.admin.al-dia` | Tiene la versión publicada. | It has the published version. | Ha la versione pubblicata. |
| `spaceeyes.admin.actualizaciones` | Actualizaciones: {como} | Update mode: {como} | Modalità di aggiornamento: {como} |
| `spaceeyes.admin.boton.actualizar` | Actualizar app | Update app | Aggiorna app |
| `spaceeyes.admin.boton.reiniciar` | Reiniciar app | Restart app | Riavvia app |
| `spaceeyes.admin.boton.reiniciar-equipo` | Reiniciar equipo | Restart device | Riavvia dispositivo |
| `spaceeyes.admin.reiniciar.titulo` | Reiniciar la aplicación | Restart the app | Riavvia l’applicazione |
| `spaceeyes.admin.reiniciar.boton` | Reiniciar | Restart | Riavvia |
| `spaceeyes.admin.reiniciar.texto` | Se reinicia la aplicación en el equipo. Deja de reportar unos segundos y vuelve sola. | The app restarts on the device. It stops reporting for a few seconds and comes back on its own. | L’applicazione si riavvia sul dispositivo. Smette di comunicare per qualche secondo e poi torna da sola. |
| `spaceeyes.admin.reiniciar-pi.titulo` | Reiniciar la Raspberry | Restart the Raspberry | Riavvia il Raspberry |
| `spaceeyes.admin.reiniciar-pi.texto` | Se reinicia la Raspberry entera, no solo la app: es lo que destraba una cámara o una red que se quedaron colgadas. Deja de reportar uno o dos minutos y vuelve sola. | The whole Raspberry restarts, not just the app: this is what unsticks a camera or a network that hung. It stops reporting for a minute or two and comes back on its own. | Si riavvia l’intero Raspberry, non solo l’app: è ciò che sblocca una fotocamera o una rete rimaste bloccate. Smette di comunicare per uno o due minuti e poi torna da solo. |
| `spaceeyes.admin.actualizar.titulo` | Actualizar el programa del equipo | Update the device software | Aggiorna il software del dispositivo |
| `spaceeyes.admin.actualizar.boton` | Actualizar | Update | Aggiorna |
| `spaceeyes.admin.ajustes.guardados` | Ajustes guardados: se aplican a todas las fotos del equipo. | Settings saved: they apply to every photo from the device. | Impostazioni salvate: si applicano a tutte le foto del dispositivo. |
| `spaceeyes.admin.ajustes.no-guardar` | No se pudieron guardar: {motivo} | Could not save them: {motivo} | Impossibile salvarle: {motivo} |
| `spaceeyes.admin.prueba.asi` | Así se ve con estos ajustes. | This is how it looks with these settings. | Ecco come si vede con queste impostazioni. |
| `spaceeyes.admin.prueba.no-llego` | No llegó la foto: el equipo puede estar apagado o transmitiendo. | The photo did not arrive: the device may be off or streaming. | La foto non è arrivata: il dispositivo potrebbe essere spento o in trasmissione. |
| `spaceeyes.admin.prueba.error` | No se pudo pedir la foto de prueba: {motivo} | Could not request the test photo: {motivo} | Impossibile richiedere la foto di prova: {motivo} |
| `spaceeyes.admin.ajustes` | Ajustes de imagen | Image settings | Impostazioni dell’immagine |
| `spaceeyes.admin.ajustes.texto` | Se guardan en el equipo y se aplican a todas sus fotos, incluidas las programadas. | They are stored on the device and apply to all its photos, scheduled ones included. | Si salvano sul dispositivo e si applicano a tutte le sue foto, comprese quelle programmate. |
| `spaceeyes.admin.ocultar` | Ocultar | Hide | Nascondi |
| `spaceeyes.admin.mostrar` | Mostrar | Show | Mostra |
| `spaceeyes.admin.giro` | Giro de la foto | Photo rotation | Rotazione della foto |
| `spaceeyes.admin.sin-giro` | Sin giro | No rotation | Nessuna rotazione |
| `spaceeyes.admin.giro.texto` | Endereza la foto al recibirla. Es distinto de la orientación de la vista en vivo. | Straightens the photo when it arrives. It is separate from the live view orientation. | Raddrizza la foto quando la riceve. È diverso dall’orientamento della vista in diretta. |
| `spaceeyes.admin.led` | Pantalla de LED | LED screen | Schermo LED |
| `spaceeyes.admin.cuadros` | Cuadros a promediar | Frames to average | Fotogrammi da mediare |
| `spaceeyes.admin.cuadros.n` | {n} cuadros | {n} frames | {n} fotogrammi |
| `spaceeyes.admin.cuadros.un-disparo` | un disparo | single shot | uno scatto |
| `spaceeyes.admin.cuadros.texto` | Contra las líneas de la pantalla: cada cuadro las agarra en otra posición y al promediarlos se cancelan (con 16 la marca baja de 40% a 10%). Tarda ~1 s más y, si el creativo cambia a media captura, sale mezclado. | Reduces screen lines: each frame catches them in a different position and averaging cancels them out (with 16 the banding drops from 40% to 10%). It takes ~1 s longer and, if the creative changes mid-capture, it comes out blended. | Contro le righe dello schermo: ogni fotogramma le coglie in una posizione diversa e facendone la media si annullano (con 16 il segno scende dal 40% al 10%). Ci vuole ~1 s in più e, se la creatività cambia a metà scatto, viene mista. |
| `spaceeyes.admin.medicion` | Dónde mide la luz | Where it meters light | Dove misura la luce |
| `spaceeyes.admin.exposicion-mano` | Fijar la exposición a mano | Set exposure manually | Imposta l’esposizione manualmente |
| `spaceeyes.admin.obturador` | Obturador | Shutter | Otturatore |
| `spaceeyes.admin.ganancia` | Ganancia | Gain | Guadagno |
| `spaceeyes.admin.exposicion-mano.texto` | Al fijarlo se pierde el automático: hay que mover los dos juntos o la foto sale quemada o a oscuras según la hora. | Setting it turns off auto: move both together or the photo comes out blown out or dark depending on the time of day. | Fissandola si perde l’automatico: bisogna regolare i due valori insieme, altrimenti la foto viene bruciata o scura a seconda dell’ora. |
| `spaceeyes.admin.color-mano` | Ajustar el color a mano (necesario si las hojas salen moradas) | Set color manually (needed if leaves come out purple) | Regola il colore manualmente (necessario se le foglie vengono viola) |
| `spaceeyes.admin.rojo` | Rojo | Red | Rosso |
| `spaceeyes.admin.azul` | Azul | Blue | Blu |
| `spaceeyes.admin.receta.led.ayuda` | Promedia 16 cuadros, baja la exposición y mide la luz en la pantalla | Averages 16 frames, lowers exposure and meters light on the screen | Media 16 fotogrammi, abbassa l’esposizione e misura la luce sullo schermo |
| `spaceeyes.admin.receta.led.aplicada` | Punto de partida para pantalla aplicado. Prueba y sube o baja la exposición. | Screen starting point applied. Test it and raise or lower the exposure. | Punto di partenza per lo schermo applicato. Prova e alza o abbassa l’esposizione. |
| `spaceeyes.admin.receta.led` | Pantalla de LED: punto de partida | LED screen: starting point | Schermo LED: punto di partenza |
| `spaceeyes.admin.receta.hojas.ayuda` | Para cámaras sin filtro infrarrojo, donde la vegetación sale morada | For cameras without an infrared filter, where vegetation comes out purple | Per fotocamere senza filtro infrarosso, dove la vegetazione viene viola |
| `spaceeyes.admin.receta.hojas.aplicada` | Punto de partida aplicado. Prueba y afina con los deslizadores. | Starting point applied. Test it and fine-tune with the sliders. | Punto di partenza applicato. Prova e rifinisci con i cursori. |
| `spaceeyes.admin.receta.hojas` | Hojas moradas: punto de partida | Purple leaves: starting point | Foglie viola: punto di partenza |
| `spaceeyes.admin.restablecidos` | Ajustes en blanco. Guarda para que el equipo los tome. | Settings cleared. Save so the device picks them up. | Impostazioni azzerate. Salva perché il dispositivo le applichi. |
| `spaceeyes.admin.restablecer` | Restablecer | Reset | Ripristina |
| `spaceeyes.admin.prueba` | Foto de prueba | Test photo | Foto di prova |
| `spaceeyes.admin.tomando` | Tomando… | Taking… | Scatto in corso… |
| `spaceeyes.admin.probar` | Probar | Test | Prova |
| `spaceeyes.admin.solo-dueno` | Estos ajustes cambian lo que la cámara ve en todas sus fotos: solo los mueve el Dueño. | These settings change what the camera sees in all its photos: only the Owner can change them. | Queste impostazioni cambiano ciò che la fotocamera vede in tutte le sue foto: le modifica solo il Titolare. |
| `spaceeyes.admin.probar.texto` | «Probar» guarda los ajustes y pide una foto para ver cómo quedan. | “Test” saves the settings and requests a photo to see how they look. | «Prova» salva le impostazioni e richiede una foto per vedere il risultato. |
| `spaceeyes.admin.prueba.datos` | Cada prueba consume una foto de datos. En equipos con SIM, úsala con medida. | Each test uses one photo’s worth of data. On devices with a SIM, use it sparingly. | Ogni prova consuma i dati di una foto. Sui dispositivi con SIM, usala con moderazione. |
| `spaceeyes.admin.registros` | Registros del equipo | Device logs | Log del dispositivo |
| `spaceeyes.admin.registros.texto` | Lo que el equipo reporta de sí mismo, para diagnosticarlo en campo. | What the device reports about itself, to diagnose it in the field. | Ciò che il dispositivo comunica di sé, per diagnosticarlo sul campo. |
| `spaceeyes.admin.registros.error` | No se pudieron leer los registros: {error} | Could not read the logs: {error} | Impossibile leggere i log: {error} |
| `spaceeyes.admin.registros.leyendo` | Leyendo registros… | Reading logs… | Lettura dei log… |
| `spaceeyes.admin.registros.vacio` | Sin registros todavía. | No logs yet. | Ancora nessun log. |
| `spaceeyes.comun.reintentar` | Reintentar | Retry | Riprova |
| `spaceeyes.comun.descartar` | Descartar | Discard | Scarta |
| `spaceeyes.vivo.balance.auto` | Balance auto | Auto balance | Bilanciamento auto |
| `spaceeyes.vivo.balance.incandescent` | Incandescente | Incandescent | Incandescenza |
| `spaceeyes.vivo.sin-permiso` | No tienes permiso para cambiar este equipo | You do not have permission to change this device | Non hai il permesso di modificare questo dispositivo |
| `spaceeyes.vivo.sin-servidor` | El servidor de video no está configurado. Es cosa del servidor, no del equipo. | The video server is not configured. It is a server issue, not a device issue. | Il server video non è configurato. È un problema del server, non del dispositivo. |
| `spaceeyes.vivo.no-leer` | No se pudo leer el equipo | Could not read the device | Impossibile leggere il dispositivo |
| `spaceeyes.vivo.otra-persona` | otra persona | someone else | un’altra persona |
| `spaceeyes.vivo.otra-persona.may` | Otra persona | Someone else | Un’altra persona |
| `spaceeyes.vivo.no-iniciar.punto` | No se pudo iniciar la transmisión. | Could not start the stream. | Impossibile avviare la trasmissione. |
| `spaceeyes.vivo.compartida` | Viendo la transmisión que abrió {quien} | Watching the stream opened by {quien} | Stai guardando la trasmissione aperta da {quien} |
| `spaceeyes.vivo.corte-auto` | Transmisión detenida automáticamente a los 3 minutos | Stream stopped automatically after 3 minutes | Trasmissione interrotta automaticamente dopo 3 minuti |
| `spaceeyes.vivo.sin-imagen` | Conectado con el servidor pero no está llegando imagen del equipo. | Connected to the server, but no image is arriving from the device. | Connesso al server, ma non arriva l’immagine dal dispositivo. |
| `spaceeyes.vivo.no-encuadre` | No se pudo guardar el encuadre | Could not save the framing | Impossibile salvare l’inquadratura |
| `spaceeyes.vivo.encuadre-fijado` | Encuadre fijado: se aplica también a las fotos programadas | Framing locked: it also applies to scheduled photos | Inquadratura fissata: si applica anche alle foto programmate |
| `spaceeyes.vivo.ver-asi.compartida` | {quien} está viendo este equipo: la vista sigue con su encuadre. La foto que pidas sí sale como la tienes puesta. | {quien} is watching this device: the view keeps their framing. The photo you request does come out the way you set it. | {quien} sta guardando questo dispositivo: la vista mantiene la sua inquadratura. La foto che richiedi invece esce come l’hai impostata tu. |
| `spaceeyes.vivo.ver-asi.lente` | Así se ve con este lente. No cambió el encuadre del sitio. | This is how it looks with this lens. The site framing did not change. | Ecco come si vede con questo obiettivo. L’inquadratura del sito non è cambiata. |
| `spaceeyes.vivo.ver-asi.nitido` | Ya se ve nítido a este acercamiento. No cambió el encuadre del sitio. | It now looks sharp at this zoom. The site framing did not change. | Ora si vede nitido a questo ingrandimento. L’inquadratura del sito non è cambiata. |
| `spaceeyes.vivo.enfoque.fijado` | Enfoque fijado: se aplica solo cada vez que se abra la vista | Focus locked: it applies automatically every time the view opens | Messa a fuoco fissata: si applica da sola ogni volta che si apre la vista |
| `spaceeyes.vivo.enfoque.libre` | Enfoque libre: la cámara vuelve a enfocar sola | Focus unlocked: the camera focuses on its own again | Messa a fuoco libera: la fotocamera torna a mettere a fuoco da sola |
| `spaceeyes.vivo.enfoque.no-guardar` | No se pudo guardar el enfoque | Could not save the focus | Impossibile salvare la messa a fuoco |
| `spaceeyes.vivo.orientacion.fijada` | Orientación fijada para todos | Orientation locked for everyone | Orientamento fissato per tutti |
| `spaceeyes.vivo.orientacion.no-fijar` | No se pudo fijar la orientación | Could not lock the orientation | Impossibile fissare l’orientamento |
| `spaceeyes.vivo.foto.pedida` | Foto pedida: llega en unos segundos | Photo requested: it arrives in a few seconds | Foto richiesta: arriva tra qualche secondo |
| `spaceeyes.vivo.titulo` | Vista en vivo | Live view | Vista in diretta |
| `spaceeyes.vivo.en-vivo` | En vivo | Live | In diretta |
| `spaceeyes.vivo.corte.ayuda` | La transmisión se detiene sola para no gastar datos del equipo | The stream stops on its own so it does not use the device’s data | La trasmissione si interrompe da sola per non consumare i dati del dispositivo |
| `spaceeyes.vivo.corte` | Corte en␣ | Stops in␣ | Stop tra␣ |
| `spaceeyes.vivo.foto` | Foto | Photo | Foto |
| `spaceeyes.vivo.iniciar` | Iniciar | Start | Avvia |
| `spaceeyes.vivo.conectando` | Conectando… | Connecting… | Connessione… |
| `spaceeyes.vivo.detener` | Detener | Stop | Interrompi |
| `spaceeyes.vivo.agente-viejo` | Agente anterior a la vista en vivo | Agent older than the live view | Agente precedente alla vista in diretta |
| `spaceeyes.vivo.agente-viejo.texto` | Esta PC corre el agente v1.0. Actualízala y la vista en vivo se enciende sola. Mientras tanto, usa «Foto» para ver el sitio. | This PC runs agent v1.0. Update it and the live view turns on by itself. Meanwhile, use “Photo” to see the site. | Questo PC usa l’agente v1. Aggiornalo e la vista in diretta si attiva da sola. Nel frattempo, usa «Foto» per vedere il sito. |
| `spaceeyes.vivo.p2p` | Este equipo transmite punto a punto | This device streams peer to peer | Questo dispositivo trasmette punto a punto |
| `spaceeyes.vivo.p2p.texto` | Su versión no pasa el video por el servidor de medios, y desde aquí solo se puede ver por ahí. Actualiza la app del equipo para verlo en vivo. | Its version does not route video through the media server, and from here it can only be watched that way. Update the device app to watch it live. | La sua versione non fa passare il video dal server multimediale, e da qui si può vedere solo attraverso di esso. Aggiorna l’app del dispositivo per vederlo in diretta. |
| `spaceeyes.vivo.conectando.equipo` | Conectando con el equipo… | Connecting to the device… | Connessione al dispositivo… |
| `spaceeyes.vivo.conectando.texto` | Puede tardar unos segundos mientras la cámara arranca. No hace falta volver a presionar. | It can take a few seconds while the camera starts. No need to click again. | Può richiedere qualche secondo mentre la fotocamera si avvia. Non serve cliccare di nuovo. |
| `spaceeyes.vivo.no-iniciar` | No se pudo iniciar la transmisión | Could not start the stream | Impossibile avviare la trasmissione |
| `spaceeyes.vivo.apagada` | Vista en vivo apagada | Live view off | Vista in diretta spenta |
| `spaceeyes.vivo.iniciar-vista` | Iniciar vista en vivo | Start live view | Avvia vista in diretta |
| `spaceeyes.vivo.sin-permiso-abrir` | Necesitas permiso para operar equipos para abrir la vista. | You need permission to operate devices to open the view. | Per aprire la vista ti serve il permesso di gestire i dispositivi. |
| `spaceeyes.vivo.no-reporta` | El equipo no está reportando: puede que no conteste. | The device is not reporting: it may not answer. | Il dispositivo non sta comunicando: potrebbe non rispondere. |
| `spaceeyes.vivo.se-detiene` | Se detiene sola a los 3 minutos para no gastar datos del equipo. | It stops on its own after 3 minutes so it does not use the device’s data. | Si interrompe da sola dopo 3 minuti per non consumare i dati del dispositivo. |
| `spaceeyes.vivo.enfoque-fijo` | Enfoque fijo | Focus locked | Messa a fuoco fissa |
| `spaceeyes.vivo.fijar-enfoque` | Fijar enfoque | Lock focus | Fissa la messa a fuoco |
| `spaceeyes.vivo.mover-lados` | Mover a los lados | Move sideways | Sposta lateralmente |
| `spaceeyes.vivo.mover-arriba` | Mover arriba y abajo | Move up and down | Sposta in alto e in basso |
| `spaceeyes.vivo.girar-izq` | Girar a la izquierda | Rotate left | Ruota a sinistra |
| `spaceeyes.vivo.girar-der` | Girar a la derecha | Rotate right | Ruota a destra |
| `spaceeyes.vivo.lente` | Lente | Lens | Obiettivo |
| `spaceeyes.vivo.lente.ayuda` | Gran angular: abarca más desde la misma distancia. Solo si el equipo lo tiene. | Wide angle: covers more from the same distance. Only if the device has it. | Grandangolo: inquadra di più dalla stessa distanza. Solo se il dispositivo lo ha. |
| `spaceeyes.vivo.lente.normal` | Lente normal | Normal lens | Obiettivo normale |
| `spaceeyes.vivo.lente.gran-angular` | Gran angular 0.5x | Wide angle 0.5x | Grandangolo 0,5x |
| `spaceeyes.vivo.ver-lente.ayuda` | Abre la vista con este lente. No cambia el encuadre del sitio. | Opens the view with this lens. It does not change the site framing. | Apre la vista con questo obiettivo. Non cambia l’inquadratura del sito. |
| `spaceeyes.vivo.ver-nitido.ayuda` | Abre la vista a este acercamiento, ya nítida. No cambia el encuadre del sitio. | Opens the view at this zoom, sharp. It does not change the site framing. | Apre la vista a questo ingrandimento, già nitida. Non cambia l’inquadratura del sito. |
| `spaceeyes.vivo.abriendo` | Abriendo… | Opening… | Apertura… |
| `spaceeyes.vivo.ver-lente` | Ver con este lente | View with this lens | Vedi con questo obiettivo |
| `spaceeyes.vivo.ver-nitido` | Ver nítido | View sharp | Vedi nitido |
| `spaceeyes.vivo.fijar-encuadre.ayuda` | Guarda el encuadre actual. Se aplica también a las fotos programadas. | Saves the current framing. It also applies to scheduled photos. | Salva l’inquadratura attuale. Si applica anche alle foto programmate. |
| `spaceeyes.vivo.aplicando` | Aplicando… | Applying… | Applicazione… |
| `spaceeyes.vivo.fijar-encuadre` | Fijar encuadre | Lock framing | Fissa l’inquadratura |
| `spaceeyes.vivo.encuadre-guardado` | Encuadre guardado | Framing saved | Inquadratura salvata |
| `spaceeyes.vivo.descartar.ayuda` | Volver al encuadre que tiene guardado el equipo | Go back to the framing saved on the device | Torna all’inquadratura salvata sul dispositivo |
| `spaceeyes.vivo.fijar-orientacion.ayuda` | Fijar esta orientación para todos | Lock this orientation for everyone | Fissa questo orientamento per tutti |
| `spaceeyes.vivo.fijar-orientacion` | Fijar orientación | Lock orientation | Fissa l’orientamento |
| `spaceeyes.vivo.volver.ayuda` | Volver a la orientación guardada del equipo | Go back to the orientation saved on the device | Torna all’orientamento salvato del dispositivo |
| `spaceeyes.vivo.volver` | Volver | Revert | Torna indietro |
| `spaceeyes.vivo.pie.mirar` | Mueve el zoom, el lente, la luz y el enfoque a tu gusto y pide la foto: {asi}. | Adjust the zoom, lens, light and focus as you like and request the photo: {asi}. | Regola zoom, obiettivo, luce e messa a fuoco come preferisci e richiedi la foto: {asi}. |
| `spaceeyes.vivo.pie.mirar.asi` | sale como la estás viendo | it comes out as you see it | esce come la stai vedendo |
| `spaceeyes.vivo.pie.mirar.relay` | Aquí el acercamiento es una vista previa: «Ver nítido» abre la imagen de verdad.␣ | Here the zoom is a preview: “View sharp” opens the real image.␣ | Qui l’ingrandimento è un’anteprima: «Vedi nitido» apre l’immagine reale.␣ |
| `spaceeyes.vivo.pie.mirar.nada` | Nada de esto se guarda, así que el encuadre del sitio no cambia —fijarlo para todos lo hace solo el Dueño, porque borra lo que el equipo aprendió de su pantalla—. | None of this is saved, so the site framing does not change (only the Owner locks it for everyone, because it erases what the device learned about its screen). | Niente di tutto questo viene salvato, quindi l’inquadratura del sito non cambia —fissarla per tutti lo fa solo il Titolare, perché cancella ciò che il dispositivo ha appreso del suo schermo—. |
| `spaceeyes.vivo.pie.relay` | Lo que ves al mover los deslizadores es una vista previa: el equipo no cambia hasta que pulses {boton} (ahí la vista se reabre un segundo para traer la imagen nítida). | What you see while moving the sliders is a preview: the device does not change until you click {boton} (then the view reopens for a second to bring in the sharp image). | Ciò che vedi muovendo i cursori è un’anteprima: il dispositivo non cambia finché non clicchi {boton} (a quel punto la vista si riapre per un secondo per portare l’immagine nitida). |
| `spaceeyes.vivo.pie.telefono` | Toca el video para enfocar. El zoom, la exposición y el balance cambian la cámara al momento, pero son temporales: solo el zoom y el lente se guardan, al pulsar {boton}. | Click the video to focus. Zoom, exposure and balance change the camera instantly, but they are temporary: only zoom and lens are saved, when you click {boton}. | Clicca il video per mettere a fuoco. Zoom, esposizione e bilanciamento cambiano subito la fotocamera, ma sono temporanei: si salvano solo lo zoom e l’obiettivo, cliccando {boton}. |
| `spaceeyes.vivo.pie.orientacion` | La orientación fija es la que todos ven al abrir la vista. | The locked orientation is the one everyone sees when opening the view. | L’orientamento fisso è quello che tutti vedono aprendo la vista. |
| `spaceeyes.vivo.en-uso` | Vista en uso | View in use | Vista in uso |
| `spaceeyes.vivo.en-uso.quien` | {quien} está viendo este equipo desde hace {min} min. | {quien} has been watching this device for {min} min. | {quien} sta guardando questo dispositivo da {min} min. |
| `spaceeyes.vivo.en-uso.texto` | Este equipo solo admite un espectador a la vez: cada conexión de video gasta datos móviles del sitio. La transmisión se corta sola a los 3 minutos. | This device allows only one viewer at a time: each video connection uses the site’s mobile data. The stream stops on its own after 3 minutes. | Questo dispositivo ammette un solo spettatore alla volta: ogni connessione video consuma i dati mobili del sito. La trasmissione si interrompe da sola dopo 3 minuti. |
| `spaceeyes.vivo.aplicando-encuadre` | Aplicando el encuadre nuevo… | Applying the new framing… | Applicazione della nuova inquadratura… |
| `spaceeyes.whep.sin-direccion` | Space Eye no entregó la dirección de la transmisión | Space Eye did not provide the stream address | Space Eye non ha fornito l’indirizzo della trasmissione |
| `spaceeyes.whep.no-transmite` | El equipo no comenzó a transmitir. Puede estar sin señal o con la cámara ocupada. | The device did not start streaming. It may have no signal, or its camera may be busy. | Il dispositivo non ha iniziato a trasmettere. Potrebbe essere senza segnale o con la fotocamera occupata. |
| `spaceeyes.whep.no-conectar` | No se pudo conectar el video ({motivo}). | Could not connect the video ({motivo}). | Impossibile collegare il video ({motivo}). |
| `spaceeyes.whep.perdida` | Se perdió la conexión de video con el servidor. | The video connection to the server was lost. | Si è persa la connessione video con il server. |
| `spaceeyes.comun.desde` | Desde | From | Dal |
| `spaceeyes.comun.hasta` | Hasta | To | Al |
| `spaceeyes.comun.todos-equipos` | Todos los equipos | All devices | Tutti i dispositivi |
| `spaceeyes.comun.equipo-n` | Equipo {id} | Device {id} | Dispositivo {id} |
| `spaceeyes.comun.anterior` | Anterior | Previous | Precedente |
| `spaceeyes.comun.siguiente` | Siguiente | Next | Successiva |
| `spaceeyes.comun.pagina` | Página {pagina} | Page {pagina} | Pagina {pagina} |
| `spaceeyes.comun.pagina-de` | Página {pagina} de {paginas} | Page {pagina} of {paginas} | Pagina {pagina} di {paginas} |
| `spaceeyes.comun.eliminar` | Eliminar | Delete | Elimina |
| `spaceeyes.comun.error-desconocido` | error desconocido | unknown error | errore sconosciuto |
| `spaceeyes.galeria.origen.manual` | Manual | Manual | Manuale |
| `spaceeyes.galeria.origen.scheduled` | Programada | Scheduled | Programmata |
| `spaceeyes.galeria.origen.on-demand` | A petición | On demand | Su richiesta |
| `spaceeyes.galeria.origen.creative` | Creativo nuevo | New creative | Nuova creatività |
| `spaceeyes.galeria.origen.falla` | Falla de pantalla | Screen fault | Guasto dello schermo |
| `spaceeyes.galeria.origen.boot` | Al encender | At startup | All’accensione |
| `spaceeyes.galeria.verif.pending` | Sin verificar | Not verified | Non verificata |
| `spaceeyes.galeria.verif.queued` | En cola | Queued | In coda |
| `spaceeyes.galeria.verif.running` | Verificando | Verifying | Verifica in corso |
| `spaceeyes.galeria.verif.verified` | Verificada | Verified | Verificata |
| `spaceeyes.galeria.verif.failed` | Falló la verificación | Verification failed | Verifica non riuscita |
| `spaceeyes.galeria.verif.skipped` | Omitida | Skipped | Saltata |
| `spaceeyes.galeria.verif.correcta` | Verificada · correcta | Verified · correct | Verificata · corretta |
| `spaceeyes.galeria.verif.no-coincide` | Verificada · no coincide | Verified · does not match | Verificata · non corrisponde |
| `spaceeyes.galeria.error` | No se pudieron consultar las fotos | Could not load the photos | Impossibile consultare le foto |
| `spaceeyes.galeria.eliminada` | Fotografía eliminada | Photo deleted | Fotografia eliminata |
| `spaceeyes.galeria.no-eliminar` | No se pudo eliminar la fotografía: {motivo} | Could not delete the photo: {motivo} | Impossibile eliminare la fotografia: {motivo} |
| `spaceeyes.galeria.preparando` | Preparando… | Preparing… | Preparazione… |
| `spaceeyes.galeria.album.vacio` | Sin fotos para descargar | No photos to download | Nessuna foto da scaricare |
| `spaceeyes.galeria.album.ninguna` | No se pudo descargar ninguna foto del álbum | Could not download any photo from the album | Impossibile scaricare qualsiasi foto dell’album |
| `spaceeyes.galeria.album.parcial.uno` | Álbum descargado; {n} foto no se pudo incluir | Album downloaded; {n} photo could not be included | Album scaricato; non è stato possibile includere {n} foto |
| `spaceeyes.galeria.album.parcial.otros` | Álbum descargado; {n} fotos no se pudo incluir | Album downloaded; {n} photos could not be included | Album scaricato; non è stato possibile includere {n} foto |
| `spaceeyes.galeria.album.listo` | Álbum descargado | Album downloaded | Album scaricato |
| `spaceeyes.galeria.album.error` | Error al descargar el álbum: {motivo} | Error downloading the album: {motivo} | Errore durante lo scaricamento dell’album: {motivo} |
| `spaceeyes.galeria.titulo` | Galería de fotos | Photo gallery | Galleria foto |
| `spaceeyes.galeria.descripcion` | Todas las fotos de los equipos: programadas, pedidas a mano, de creativos nuevos y de fallas. | Every photo from the devices: scheduled, requested manually, of new creatives and of faults. | Tutte le foto dei dispositivi: programmate, richieste manualmente, di nuove creatività e di guasti. |
| `spaceeyes.galeria.album.ayuda` | Descarga en un .zip todas las fotos que coinciden con los filtros, con su marca | Downloads every photo that matches the filters as a .zip, with its label | Scarica in un .zip tutte le foto che corrispondono ai filtri, con la loro etichetta |
| `spaceeyes.galeria.descargando` | Descargando {progreso} | Downloading {progreso} | Scaricamento {progreso} |
| `spaceeyes.galeria.album` | Descargar álbum | Download album | Scarica album |
| `spaceeyes.galeria.origen` | Origen | Source | Origine |
| `spaceeyes.galeria.origenes` | Todos los orígenes | All sources | Tutte le origini |
| `spaceeyes.galeria.quitar-filtros` | Quitar filtros | Clear filters | Rimuovi filtri |
| `spaceeyes.galeria.vacio.filtros` | Sin fotos para los filtros seleccionados. | No photos for the selected filters. | Nessuna foto per i filtri selezionati. |
| `spaceeyes.galeria.vacio` | Todavía no hay fotos de ningún equipo. | No photos from any device yet. | Non ci sono ancora foto di nessun dispositivo. |
| `spaceeyes.galeria.total.uno` | {n} fotos | {n} photo | {n} foto |
| `spaceeyes.galeria.total.otros` | {n} fotos | {n} photos | {n} foto |
| `spaceeyes.galeria.filtradas` | Fotos filtradas | Filtered photos | Foto filtrate |
| `spaceeyes.galeria.eliminar` | Eliminar fotografía | Delete photo | Elimina fotografia |
| `spaceeyes.galeria.eliminar.pregunta` | ¿Eliminar esta fotografía? | Delete this photo? | Eliminare questa fotografia? |
| `spaceeyes.galeria.eliminar.pregunta.de` | ¿Eliminar esta fotografía de {nombre}? | Delete this photo from {nombre}? | Eliminare questa fotografia di {nombre}? |
| `spaceeyes.galeria.eliminar.texto` | No se puede deshacer. | This cannot be undone. | Non si può annullare. |
| `spaceeyes.galeria.equipo` | equipo | device | dispositivo |
| `spaceeyes.galeria.ver-grande` | Ver foto de {nombre} en grande | View photo from {nombre} larger | Vedi la foto di {nombre} in grande |
| `spaceeyes.galeria.alt` | Foto {id} de {nombre} | Photo {id} from {nombre} | Foto {id} di {nombre} |
| `spaceeyes.galeria.no-cargar` | No se pudo cargar | Could not load | Impossibile caricare |
| `spaceeyes.galeria.sin-archivo` | La foto no tiene archivo | The photo has no file | La foto non ha un file |
| `spaceeyes.galeria.descargando-foto` | Descargando foto… | Downloading photo… | Scaricamento della foto… |
| `spaceeyes.galeria.no-descargar` | No se pudo descargar la foto: {motivo} | Could not download the photo: {motivo} | Impossibile scaricare la foto: {motivo} |
| `spaceeyes.galeria.foto-de` | Foto de {nombre} | Photo from {nombre} | Foto di {nombre} |
| `spaceeyes.galeria.anterior` | Foto anterior | Previous photo | Foto precedente |
| `spaceeyes.galeria.siguiente` | Foto siguiente | Next photo | Foto successiva |
| `spaceeyes.galeria.no-cargar-foto` | No se pudo cargar la foto. | Could not load the photo. | Impossibile caricare la foto. |
| `spaceeyes.galeria.rotar` | Rotar | Rotate | Ruota |
| `spaceeyes.comun.confianza` | Confianza | Confidence | Affidabilità |
| `spaceeyes.comun.opcional` | (opcional) | (optional) | (facoltativo) |
| `spaceeyes.fallas.filtro.todas` | Todas | All | Tutti |
| `spaceeyes.fallas.abiertas` | Abiertas | Open | Aperti |
| `spaceeyes.fallas.recuperadas` | Recuperadas | Cleared | Risolti |
| `spaceeyes.fallas.descartadas` | No eran falla | Not faults | Non erano guasti |
| `spaceeyes.fallas.donde.gabinete` | Gabinete {n} (fila {fila}, columna {columna}) | Cabinet {n} (row {fila}, column {columna}) | Cabinet {n} (riga {fila}, colonna {columna}) |
| `spaceeyes.fallas.donde.gabinetes.uno` | Gabinetes {lista} | Cabinet {lista} | Cabinet {lista} |
| `spaceeyes.fallas.donde.gabinetes.otros` | Gabinetes {lista} | Cabinets {lista} | Cabinet {lista} |
| `spaceeyes.fallas.donde.de` | ␣({n} de {total}) | ␣({n} of {total}) | ␣({n} di {total}) |
| `spaceeyes.fallas.donde.camara` | Cámara (hay que volver a marcar la pantalla) | Camera (the screen has to be marked again) | Fotocamera (bisogna segnare di nuovo lo schermo) |
| `spaceeyes.fallas.donde.sin-imagen` | Lente tapada, o pantalla apagada de noche | Lens covered, or screen off at night | Obiettivo coperto, o schermo spento di notte |
| `spaceeyes.fallas.donde.toda` | Toda la pantalla | The whole screen | Tutto lo schermo |
| `spaceeyes.fallas.nombre.zona-apagada` | Posible gabinete apagado | Possible cabinet off | Possibile cabinet spento |
| `spaceeyes.fallas.nombre.zona-congelada` | Posible gabinete congelado o tapado | Possible cabinet frozen or covered | Possibile cabinet bloccato o coperto |
| `spaceeyes.fallas.nombre.pantalla-apagada` | Pantalla apagada en horario | Screen off during operating hours | Schermo spento in orario di accensione |
| `spaceeyes.fallas.nombre.pantalla-congelada` | Pantalla congelada (no cambia el contenido) | Screen frozen (the content is not changing) | Schermo bloccato (il contenuto non cambia) |
| `spaceeyes.fallas.nombre.camara-movida` | La cámara se movió: hay que volver a marcar la pantalla | The camera moved: the screen has to be marked again | La fotocamera si è spostata: bisogna segnare di nuovo lo schermo |
| `spaceeyes.fallas.nombre.sin-imagen` | Sin imagen: lente tapada, o pantalla apagada de noche | No image: lens covered, or screen off at night | Nessuna immagine: obiettivo coperto, o schermo spento di notte |
| `spaceeyes.fallas.nombre.varios-apagados` | Varios gabinetes apagados | Several cabinets off | Diversi cabinet spenti |
| `spaceeyes.fallas.nombre.varios-congelados` | Varios gabinetes congelados o tapados | Several cabinets frozen or covered | Diversi cabinet bloccati o coperti |
| `spaceeyes.fallas.no-consultar` | No se pudo consultar Space Eye | Could not reach Space Eye | Impossibile consultare Space Eye |
| `spaceeyes.fallas.descartada` | Falla descartada. | Fault dismissed. | Guasto scartato. |
| `spaceeyes.fallas.arreglada` | Falla marcada como arreglada. | Fault marked as fixed. | Guasto segnato come risolto. |
| `spaceeyes.fallas.sin-permiso` | No tienes permiso para cerrar fallas. | You do not have permission to close faults. | Non hai il permesso di chiudere i guasti. |
| `spaceeyes.fallas.ya-cerrada` | Esta falla ya no está abierta. | This fault is no longer open. | Questo guasto non è più aperto. |
| `spaceeyes.fallas.no-cerrar` | No se pudo cerrar: {motivo} | Could not close it: {motivo} | Impossibile chiudere: {motivo} |
| `spaceeyes.fallas.titulo` | Fallas de pantalla | Screen faults | Guasti degli schermi |
| `spaceeyes.fallas.descripcion` | Lo que cada equipo detectó por sí mismo al revisar su pantalla. Se actualiza cada minuto. | What each device detected on its own while checking its screen. Refreshes every minute. | Ciò che ogni dispositivo ha rilevato da solo controllando il suo schermo. Si aggiorna ogni minuto. |
| `spaceeyes.fallas.error` | No se pudieron leer las fallas | Could not read the faults | Impossibile leggere i guasti |
| `spaceeyes.fallas.atencion` | Requieren atención · {n} | Need attention · {n} | Da controllare · {n} |
| `spaceeyes.fallas.detectada` | Falla detectada | Fault detected | Guasto rilevato |
| `spaceeyes.fallas.zona` | Zona | Area | Zona |
| `spaceeyes.fallas.ya-arreglada` | Ya se arregló | It is fixed | Già risolto |
| `spaceeyes.fallas.no-es` | No es falla | Not a fault | Non è un guasto |
| `spaceeyes.fallas.historial` | Historial | History | Cronologia |
| `spaceeyes.fallas.leyendo` | Leyendo las fallas… | Reading the faults… | Lettura dei guasti… |
| `spaceeyes.fallas.vacio` | Sin fallas con este filtro. | No faults with this filter. | Nessun guasto con questo filtro. |
| `spaceeyes.fallas.foto-detectar` | Foto al detectar | Photo when detected | Foto al rilevamento |
| `spaceeyes.fallas.foto-recuperar` | Foto al recuperar | Photo when cleared | Foto alla risoluzione |
| `spaceeyes.fallas.recuperacion` | Recuperación | Cleared | Risoluzione |
| `spaceeyes.fallas.cierre.no-es` | No es una falla | Not a fault | Non è un guasto |
| `spaceeyes.fallas.cierre.arreglada` | Marcar como arreglada | Mark as fixed | Segna come risolto |
| `spaceeyes.fallas.cierre.boton` | Marcar arreglada | Mark fixed | Segna risolto |
| `spaceeyes.fallas.cierre.texto-descartar` | El equipo no volverá a avisar de esta zona durante 7 días. | The device will not alert about this area again for 7 days. | Il dispositivo non avviserà più di questa zona per 7 giorni. |
| `spaceeyes.fallas.cierre.texto-arreglada` | Se cierra sin esperar a que el equipo lo compruebe en su próxima foto. | It closes without waiting for the device to confirm it in its next photo. | Si chiude senza aspettare che il dispositivo lo verifichi nella prossima foto. |
| `spaceeyes.fallas.cierre.nota` | Qué se hizo {opcional} | What was done {opcional} | Cosa è stato fatto {opcional} |
| `spaceeyes.fallas.cierre.ej-descartar` | Por ejemplo: es un reflejo del sol | For example: it is a sun reflection | Per esempio: è un riflesso del sole |
| `spaceeyes.fallas.cierre.ej-arreglada` | Por ejemplo: se cambió la fuente | For example: the power supply was replaced | Per esempio: è stato sostituito l’alimentatore |
| `spaceeyes.comun.dato-invalido` | Hay un dato inválido en el formulario | There is an invalid value in the form | C’è un dato non valido nel modulo |
| `spaceeyes.comun.guardar-cambios` | Guardar cambios | Save changes | Salva modifiche |
| `spaceeyes.comun.activa` | Activa | Active | Attiva |
| `spaceeyes.comun.equipos` | Equipos | Devices | Dispositivi |
| `spaceeyes.comun.periodo` | Periodo | Period | Periodo |
| `spaceeyes.comun.editar` | Editar | Edit | Modifica |
| `spaceeyes.campanas.error.sin-archivo` | No se recibió la imagen | The image was not received | L’immagine non è stata ricevuta |
| `spaceeyes.campanas.error.not-found` | La campaña ya no existe | The campaign no longer exists | La campagna non esiste più |
| `spaceeyes.campanas.error.forbidden` | No tienes permiso para esto | You do not have permission for this | Non hai il permesso per farlo |
| `spaceeyes.campanas.error.cargar` | No se pudieron cargar las campañas | Could not load the campaigns | Impossibile caricare le campagne |
| `spaceeyes.campanas.error.asignados` | No se pudieron leer los equipos asignados. Vuelve a elegirlos antes de guardar. | Could not read the assigned devices. Choose them again before saving. | Impossibile leggere i dispositivi assegnati. Selezionali di nuovo prima di salvare. |
| `spaceeyes.campanas.error.pesada` | La imagen pesa más de 20 MB | The image is larger than 20 MB | L’immagine pesa più di 20 MB |
| `spaceeyes.campanas.error.nombre` | Ponle un nombre a la campaña | Give the campaign a name | Dai un nome alla campagna |
| `spaceeyes.campanas.error.fechas` | Faltan las fechas de la campaña | The campaign dates are missing | Mancano le date della campagna |
| `spaceeyes.campanas.error.fin-antes` | La fecha de fin es anterior a la de inicio | The end date is before the start date | La data di fine è precedente a quella di inizio |
| `spaceeyes.campanas.error.creatividad` | La campaña se guardó, pero la creatividad no se pudo subir: {motivo} | The campaign was saved, but the creative could not be uploaded: {motivo} | La campagna è stata salvata, ma non è stato possibile caricare la creatività: {motivo} |
| `spaceeyes.campanas.error.guardar` | No se pudo guardar la campaña | Could not save the campaign | Impossibile salvare la campagna |
| `spaceeyes.campanas.creada` | Campaña creada | Campaign created | Campagna creata |
| `spaceeyes.campanas.actualizada` | Campaña actualizada | Campaign updated | Campagna aggiornata |
| `spaceeyes.campanas.titulo` | Campañas de verificación | Verification campaigns | Campagne di verifica |
| `spaceeyes.campanas.descripcion` | La creatividad de referencia es la imagen contra la que las cámaras comparan lo que aparece en la pantalla. | The reference creative is the image the cameras compare against what appears on the screen. | La creatività di riferimento è l’immagine con cui le fotocamere confrontano ciò che appare sullo schermo. |
| `spaceeyes.campanas.nueva` | Nueva campaña | New campaign | Nuova campagna |
| `spaceeyes.campanas.editar` | Editar campaña | Edit campaign | Modifica campagna |
| `spaceeyes.campanas.nombre-ej` | Ej. Verano 2026 | E.g. Summer 2026 | Es. Estate 2026 |
| `spaceeyes.campanas.anunciante` | Anunciante | Advertiser | Inserzionista |
| `spaceeyes.campanas.anunciante-ej` | Ej. Coca-Cola | E.g. Coca-Cola | Es. Coca-Cola |
| `spaceeyes.campanas.inicio` | Fecha inicio | Start date | Data di inizio |
| `spaceeyes.campanas.fin` | Fecha fin | End date | Data di fine |
| `spaceeyes.campanas.equipos` | Equipos donde va esta campaña | Devices where this campaign runs | Dispositivi su cui va questa campagna |
| `spaceeyes.campanas.sin-equipos` | No hay equipos | No devices | Non ci sono dispositivi |
| `spaceeyes.campanas.leyendo-asignados` | Leyendo equipos asignados… | Reading assigned devices… | Lettura dei dispositivi assegnati… |
| `spaceeyes.campanas.seleccionados.uno` | {n} seleccionados | {n} selected | {n} selezionato |
| `spaceeyes.campanas.seleccionados.otros` | {n} seleccionados | {n} selected | {n} selezionati |
| `spaceeyes.campanas.verificar` | Verificar automáticamente las fotos contra la creatividad | Automatically verify photos against the creative | Verifica automaticamente le foto rispetto alla creatività |
| `spaceeyes.campanas.verificar.texto` | Requiere subir la creatividad. Sin ella la verificación no puede hacer nada. | Requires uploading the creative. Without it, verification cannot do anything. | Richiede di caricare la creatività. Senza di essa la verifica non può fare nulla. |
| `spaceeyes.campanas.creatividad` | Creatividad de referencia | Reference creative | Creatività di riferimento |
| `spaceeyes.campanas.sube` | Sube la imagen del anuncio | Upload the ad image | Carica l’immagine dell’annuncio |
| `spaceeyes.campanas.formatos` | JPG o PNG, hasta 20 MB | JPG or PNG, up to 20 MB | JPG o PNG, fino a 20 MB |
| `spaceeyes.campanas.cambiar-imagen` | Cambiar imagen | Change image | Cambia immagine |
| `spaceeyes.campanas.elegir-imagen` | Elegir imagen | Choose image | Scegli immagine |
| `spaceeyes.campanas.creatividad.texto` | Es la imagen tal como debe verse en la pantalla. Sirve para comprobar que la campaña está al aire y, más adelante, para que el sistema reconozca ese creativo entre los que rotan en el sitio. | It is the image exactly as it should look on the screen. It is used to check that the campaign is on air and, later, so the system can recognize that creative among those rotating at the site. | È l’immagine così come deve apparire sullo schermo. Serve a verificare che la campagna sia in onda e, più avanti, perché il sistema riconosca quella creatività tra quelle che ruotano sul sito. |
| `spaceeyes.campanas.ya-tiene` | Esta campaña ya tiene creatividad guardada. | This campaign already has a saved creative. | Questa campagna ha già una creatività salvata. |
| `spaceeyes.campanas.se-sube` | La imagen nueva se sube al guardar. | The new image is uploaded when you save. | La nuova immagine viene caricata al salvataggio. |
| `spaceeyes.campanas.crear` | Crear campaña | Create campaign | Crea campagna |
| `spaceeyes.campanas.vacio` | No hay campañas creadas | No campaigns created | Non ci sono campagne create |
| `spaceeyes.campanas.vacio.texto` | Crea una para agrupar las fotos de un cliente y comprobar que su anuncio está al aire. | Create one to group a client’s photos and check that their ad is on air. | Creane una per raggruppare le foto di un cliente e verificare che il suo annuncio sia in onda. |
| `spaceeyes.campanas.alt` | Creatividad de {nombre} | Creative for {nombre} | Creatività di {nombre} |
| `spaceeyes.campanas.sin-creatividad` | Sin creatividad de referencia | No reference creative | Nessuna creatività di riferimento |
| `spaceeyes.campanas.inactiva` | Inactiva | Inactive | Inattiva |
| `spaceeyes.campanas.sin-anunciante` | Sin anunciante | No advertiser | Nessun inserzionista |
| `spaceeyes.campanas.de-operaciones` | ␣· De Operaciones | ␣· From Operations | ␣· Da Operazioni |
| `spaceeyes.campanas.verif.activa` | Verificación activa | Verification on | Verifica attiva |
| `spaceeyes.campanas.verif.sin-creatividad` | Verificación sin creatividad | Verification without a creative | Verifica senza creatività |
| `spaceeyes.campanas.verif.sin` | Sin verificación | No verification | Nessuna verifica |
| `spaceeyes.campanas.operaciones.ayuda` | Llegó de Operaciones: se cambia allá (creativo, pantallas y fechas de sus reservas) y aquí se actualiza solo. | It came from Operations: change it there (creative, screens and booking dates) and it updates here on its own. | Arriva da Operazioni: si modifica lì (creatività, impianti e date delle sue prenotazioni) e qui si aggiorna da sola. |
| `spaceeyes.campanas.operaciones` | Se cambia en Operaciones | Changed in Operations | Si modifica in Operazioni |
| `spaceeyes.prog.error.franjas` | Revisa las franjas: alguna tiene una hora inválida | Check the dayparts: one has an invalid time | Controlla le fasce orarie: una ha un’ora non valida |
| `spaceeyes.prog.error.horas` | Agrega al menos una hora | Add at least one time | Aggiungi almeno un orario |
| `spaceeyes.prog.error.intervalo` | Falta el intervalo en minutos | The interval in minutes is missing | Manca l’intervallo in minuti |
| `spaceeyes.prog.error.cron` | Falta la expresión de programación | The schedule expression is missing | Manca l’espressione di programmazione |
| `spaceeyes.prog.error.cargar` | No se pudieron cargar las programaciones | Could not load the schedules | Impossibile caricare le programmazioni |
| `spaceeyes.prog.destino.campana` | Campaña: {nombre} | Campaign: {nombre} | Campagna: {nombre} |
| `spaceeyes.prog.destino.grupo` | Grupo: {nombre} | Group: {nombre} | Gruppo: {nombre} |
| `spaceeyes.prog.sin-franjas` | Sin franjas | No dayparts | Nessuna fascia oraria |
| `spaceeyes.prog.al-azar` | {lista} (al azar) | {lista} (random) | {lista} (casuale) |
| `spaceeyes.prog.cada-h` | Cada {n} h | Every {n} h | Ogni {n} h |
| `spaceeyes.prog.estado.pausada` | Pausada | Paused | In pausa |
| `spaceeyes.prog.estado.empieza` | Empieza el {fecha} | Starts {fecha} | Inizia il {fecha} |
| `spaceeyes.prog.estado.vencio` | Venció el {fecha} | Expired on {fecha} | Scaduta il {fecha} |
| `spaceeyes.prog.proxima.espera` | No dispara hasta el {fecha} | Does not fire until {fecha} | Non scatta fino al {fecha} |
| `spaceeyes.prog.proxima.vencida` | No dispara: vencida | Does not fire: expired | Non scatta: scaduta |
| `spaceeyes.prog.proxima.sin-calcular` | Sin calcular | Not calculated | Non calcolata |
| `spaceeyes.prog.proxima.cola` | {fecha} (en cola) | {fecha} (queued) | {fecha} (in coda) |
| `spaceeyes.prog.proxima.min` | {fecha} (en {n} min) | {fecha} (in {n} min) | {fecha} (tra {n} min) |
| `spaceeyes.prog.proxima.h` | {fecha} (en {n} h) | {fecha} (in {n} h) | {fecha} (tra {n} h) |
| `spaceeyes.prog.sin-fotos` | sin fotos | no photos | nessuna foto |
| `spaceeyes.prog.fotos-dia.uno` | {n} foto al día | {n} photo a day | {n} foto al giorno |
| `spaceeyes.prog.fotos-dia.otros` | {n} fotos al día | {n} photos a day | {n} foto al giorno |
| `spaceeyes.prog.gb-mes` | {n} GB al mes | {n} GB a month | {n} GB al mese |
| `spaceeyes.prog.mb-mes` | {n} MB al mes | {n} MB a month | {n} MB al mese |
| `spaceeyes.prog.toast.nombre` | Ponle un nombre a la programación | Give the schedule a name | Dai un nome alla programmazione |
| `spaceeyes.prog.toast.equipo` | Elige el equipo | Choose the device | Scegli il dispositivo |
| `spaceeyes.prog.toast.campana` | Elige la campaña | Choose the campaign | Scegli la campagna |
| `spaceeyes.prog.toast.franja` | Agrega al menos una franja de horario | Add at least one daypart | Aggiungi almeno una fascia oraria |
| `spaceeyes.prog.toast.franja-mal` | Hay una franja sin horas o con la misma hora de inicio y fin | A daypart has no times or the same start and end time | C’è una fascia oraria senza orari o con la stessa ora di inizio e fine |
| `spaceeyes.prog.toast.intervalo` | El intervalo mínimo es de 5 minutos | The minimum interval is 5 minutes | L’intervallo minimo è di 5 minuti |
| `spaceeyes.prog.toast.actualizada` | Programación actualizada | Schedule updated | Programmazione aggiornata |
| `spaceeyes.prog.toast.creada` | Programación creada | Schedule created | Programmazione creata |
| `spaceeyes.prog.toast.no-guardar` | No se pudo guardar la programación | Could not save the schedule | Impossibile salvare la programmazione |
| `spaceeyes.prog.toast.pausada` | Programación pausada | Schedule paused | Programmazione in pausa |
| `spaceeyes.prog.toast.activada` | Programación activada | Schedule activated | Programmazione attivata |
| `spaceeyes.prog.toast.no-estado` | No se pudo cambiar el estado | Could not change the status | Impossibile cambiare lo stato |
| `spaceeyes.prog.toast.eliminada` | Programación eliminada | Schedule deleted | Programmazione eliminata |
| `spaceeyes.prog.toast.no-eliminar` | No se pudo eliminar | Could not delete | Impossibile eliminare |
| `spaceeyes.prog.titulo` | Programación de fotos | Photo scheduling | Programmazione delle foto |
| `spaceeyes.prog.descripcion` | Las fotos se toman solas, a una hora impredecible dentro de las franjas que definas. | Photos are taken automatically, at an unpredictable time within the dayparts you define. | Le foto si scattano da sole, a un’ora imprevedibile all’interno delle fasce orarie che definisci. |
| `spaceeyes.prog.nueva` | Nueva programación | New schedule | Nuova programmazione |
| `spaceeyes.prog.editar` | Editar programación | Edit schedule | Modifica programmazione |
| `spaceeyes.prog.crear` | Crear programación | Create schedule | Crea programmazione |
| `spaceeyes.prog.vacio` | Todavía no hay ninguna programación. | There are no schedules yet. | Non c’è ancora nessuna programmazione. |
| `spaceeyes.prog.vacio.texto` | Hoy las fotos solo se toman cuando alguien las pide a mano. | Right now photos are only taken when someone requests them manually. | Oggi le foto si scattano solo quando qualcuno le richiede manualmente. |
| `spaceeyes.prog.linea.uno` | Próxima: {proxima} · {n} fotos {semana} | Next: {proxima} · {n} photo {semana} | Prossima: {proxima} · {n} foto {semana} |
| `spaceeyes.prog.linea.otros` | Próxima: {proxima} · {n} fotos {semana} | Next: {proxima} · {n} photos {semana} | Prossima: {proxima} · {n} foto {semana} |
| `spaceeyes.prog.semana` | ({n} esta semana) | ({n} this week) | ({n} questa settimana) |
| `spaceeyes.prog.pausar` | Pausar | Pause | Metti in pausa |
| `spaceeyes.prog.activar` | Activar | Activate | Attiva |
| `spaceeyes.prog.aplica-a` | Aplica a | Applies to | Si applica a |
| `spaceeyes.prog.cuando` | Cuándo | When | Quando |
| `spaceeyes.prog.proxima-foto` | Próxima foto | Next photo | Prossima foto |
| `spaceeyes.prog.acciones` | Acciones | Actions | Azioni |
| `spaceeyes.prog.eliminar` | Eliminar programación | Delete schedule | Elimina programmazione |
| `spaceeyes.prog.eliminar.palabra` | ELIMINAR | DELETE | ELIMINA |
| `spaceeyes.prog.eliminar.pregunta` | Se eliminará «{nombre}». | “{nombre}” will be deleted. | Verrà eliminata «{nombre}». |
| `spaceeyes.prog.eliminar.texto` | Las fotos que ya se tomaron se conservan; lo que se pierde es la programación futura. | Photos already taken are kept; what is lost is the future schedule. | Le foto già scattate vengono conservate; ciò che si perde è la programmazione futura. |
| `spaceeyes.prog.destino.un-equipo` | Un equipo | One device | Un dispositivo |
| `spaceeyes.prog.destino.una-campana` | Una campaña | One campaign | Una campagna |
| `spaceeyes.prog.nombre-ej` | Ej. Evidencia diaria de la ruta norte | E.g. Daily evidence for the north route | Es. Prova giornaliera del percorso nord |
| `spaceeyes.prog.aplicar-a` | Aplicar a | Apply to | Applica a |
| `spaceeyes.prog.todos.texto.uno` | Aplica a los {n} equipos de la flota, incluyendo los que se den de alta después. | Applies to the {n} device in the fleet, including any registered later. | Si applica a tutti i dispositivi della flotta ({n}), compresi quelli che verranno registrati in seguito. |
| `spaceeyes.prog.todos.texto.otros` | Aplica a los {n} equipos de la flota, incluyendo los que se den de alta después. | Applies to the {n} devices in the fleet, including any registered later. | Si applica ai {n} dispositivi della flotta, compresi quelli che verranno registrati in seguito. |
| `spaceeyes.prog.elegir-equipo` | — Elegir equipo — | — Choose device — | — Scegli il dispositivo — |
| `spaceeyes.prog.campana` | Campaña | Campaign | Campagna |
| `spaceeyes.prog.elegir-campana` | — Elegir campaña — | — Choose campaign — | — Scegli la campagna — |
| `spaceeyes.prog.campana-equipos.uno` | {nombre} · {n} equipos | {nombre} · {n} device | {nombre} · {n} dispositivo |
| `spaceeyes.prog.campana-equipos.otros` | {nombre} · {n} equipos | {nombre} · {n} devices | {nombre} · {n} dispositivi |
| `spaceeyes.prog.tipo.franjas` | Hora al azar dentro de franjas (recomendado) | Random time within dayparts (recommended) | Ora casuale all’interno di fasce orarie (consigliato) |
| `spaceeyes.prog.tipo.horas` | Horas exactas | Exact times | Orari esatti |
| `spaceeyes.prog.tipo.intervalo` | Cada cierto tiempo | At a fixed interval | A intervalli regolari |
| `spaceeyes.prog.tipo.cron` | Expresión cron (no editable aquí) | Cron expression (not editable here) | Espressione cron (non modificabile qui) |
| `spaceeyes.prog.franjas.texto` | Una foto por franja, en un minuto sorteado cada día. La hora no se repite, así que la evidencia no se puede acomodar de antemano. | One photo per daypart, at a minute drawn at random each day. The time never repeats, so the evidence cannot be staged in advance. | Una foto per fascia oraria, in un minuto estratto a sorte ogni giorno. L’ora non si ripete, quindi la prova non si può preparare in anticipo. |
| `spaceeyes.prog.franja` | Franja {n} | Daypart {n} | Fascia oraria {n} |
| `spaceeyes.prog.franja.inicio` | Inicio de la franja {n} | Start of daypart {n} | Inizio della fascia oraria {n} |
| `spaceeyes.prog.franja.fin` | Fin de la franja {n} | End of daypart {n} | Fine della fascia oraria {n} |
| `spaceeyes.prog.franja.quitar` | Quitar la franja {n} | Remove daypart {n} | Rimuovi la fascia oraria {n} |
| `spaceeyes.prog.quitar` | Quitar | Remove | Rimuovi |
| `spaceeyes.prog.franja.agregar` | Agregar franja | Add daypart | Aggiungi fascia oraria |
| `spaceeyes.prog.rapido` | Rápido: | Quick: | Rapido: |
| `spaceeyes.prog.rapido.tres` | Mañana, tarde y noche | Morning, afternoon and evening | Mattina, pomeriggio e sera |
| `spaceeyes.prog.rapido.una` | Una al día | Once a day | Una al giorno |
| `spaceeyes.prog.horas.texto` | Siempre al mismo minuto. Sirve para un reporte fijo, pero como evidencia es débil: una hora predecible se puede preparar. | Always at the same minute. Useful for a fixed report, but weak as evidence: a predictable time can be prepared for. | Sempre allo stesso minuto. Serve per un report fisso, ma come prova è debole: un’ora prevedibile si può preparare. |
| `spaceeyes.prog.hora` | Hora {n} | Time {n} | Orario {n} |
| `spaceeyes.prog.hora.quitar` | Quitar la hora {n} | Remove time {n} | Rimuovi l’orario {n} |
| `spaceeyes.prog.hora.agregar` | Agregar hora | Add time | Aggiungi orario |
| `spaceeyes.prog.intervalo` | Cada cuántos minutos | Interval in minutes | Ogni quanti minuti |
| `spaceeyes.prog.intervalo.ojo` | Ojo con los datos móviles: a este ritmo son {fotos}. | Watch the mobile data: at this rate that is {fotos}. | Attenzione ai dati mobili: a questo ritmo sono {fotos}. |
| `spaceeyes.prog.consumo` | Consumo estimado por equipo | Estimated usage per device | Consumo stimato per dispositivo |
| `spaceeyes.prog.consumo.texto` | A 1.5 MB por foto, que es lo que pesan hoy. Cada equipo gasta ~20 MB al mes sin fotos programadas. | At 1.5 MB per photo, which is what they weigh today. Each device uses ~20 MB a month without scheduled photos. | A 1,5 MB per foto, che è quanto pesano oggi. Ogni dispositivo consuma ~20 MB al mese senza foto programmate. |
| `spaceeyes.verif.titulo` | Verificación | Verification | Verifica |
| `spaceeyes.verif.descripcion` | Comparación de cada foto contra la creatividad de su campaña. | Each photo compared against its campaign creative. | Confronto di ogni foto con la creatività della sua campagna. |
| `spaceeyes.verif.filtro.todos` | Todos los resultados | All results | Tutti i risultati |
| `spaceeyes.verif.filtro.correctos` | Correctos | Correct | Corretti |
| `spaceeyes.verif.filtro.incorrectos` | Incorrectos | Incorrect | Non corretti |
| `spaceeyes.verif.error` | No se pudieron cargar las verificaciones | Could not load the verifications | Impossibile caricare le verifiche |
| `spaceeyes.verif.vacio` | Sin resultados de verificación | No verification results | Nessun risultato di verifica |
| `spaceeyes.verif.ver-completa` | Ver la foto completa | View the full photo | Vedi la foto intera |
| `spaceeyes.verif.correcto` | Correcto | Correct | Corretto |
| `spaceeyes.verif.incorrecto` | Incorrecto | Incorrect | Non corretto |
| `spaceeyes.verif.confianza` | Confianza {pct} | Confidence {pct} | Affidabilità {pct} |
| `spaceeyes.verif.si` | Sí | Yes | Sì |
| `spaceeyes.verif.no` | No | No | No |
| `spaceeyes.verif.ocr` | Coincidencia OCR | OCR match | Corrispondenza OCR |
| `spaceeyes.verif.resultado` | Resultado | Result | Risultato |
| `spaceeyes.verif.fecha` | Fecha | Date | Data |
| `spaceeyes.verif.pagina-anterior` | Página anterior | Previous page | Pagina precedente |
| `spaceeyes.verif.pagina-siguiente` | Página siguiente | Next page | Pagina successiva |
| `spaceeyes.graficas.periodo.24h` | Hoy (24 h) | Today (24 h) | Oggi (24 h) |
| `spaceeyes.graficas.semana` | Semana | Week | Settimana |
| `spaceeyes.graficas.mes` | Mes | Month | Mese |
| `spaceeyes.graficas.periodo.custom` | Personalizado | Custom | Personalizzato |
| `spaceeyes.graficas.hoy` | Hoy | Today | Oggi |
| `spaceeyes.graficas.total` | Total | Total | Totale |
| `spaceeyes.graficas.error.telemetria` | No se pudo leer la telemetría | Could not read the telemetry | Impossibile leggere la telemetria |
| `spaceeyes.graficas.error.csv` | No se pudo exportar el CSV. {motivo} | Could not export the CSV. {motivo} | Impossibile esportare il CSV. {motivo} |
| `spaceeyes.graficas.titulo` | Gráficas | Charts | Grafici |
| `spaceeyes.graficas.descripcion` | Estadísticas y telemetría de cada equipo: cómo ha estado y cuánto consume. | Statistics and telemetry for each device: how it has been doing and how much it uses. | Statistiche e telemetria di ogni dispositivo: come è stato e quanto consuma. |
| `spaceeyes.graficas.exportar` | Exportar CSV | Export CSV | Esporta CSV |
| `spaceeyes.graficas.dispositivo` | Dispositivo | Device | Dispositivo |
| `spaceeyes.graficas.sin-conexion` | ␣· sin conexión | ␣· offline | ␣· non connesso |
| `spaceeyes.graficas.aplicar` | Aplicar | Apply | Applica |
| `spaceeyes.graficas.exportacion-fallida` | Exportación fallida | Export failed | Esportazione non riuscita |
| `spaceeyes.graficas.cpu-max` | Temp CPU máx | Max CPU temp | Temp. CPU max |
| `spaceeyes.graficas.nd` | n/d | n/a | n/d |
| `spaceeyes.graficas.bateria-min` | Batería mín | Min battery | Batteria min |
| `spaceeyes.graficas.pct` | {n} % | {n}% | {n}% |
| `spaceeyes.graficas.muestras` | Muestras | Samples | Campioni |
| `spaceeyes.graficas.consumo` | Consumo de datos (chip / WiFi) | Data usage (SIM / WiFi) | Consumo di dati (SIM / WiFi) |
| `spaceeyes.graficas.consumo.sin` | Sin datos de consumo (requiere la app v0.7.0 en el equipo). | No usage data (requires app v0.7.0 on the device). | Nessun dato di consumo (serve l’app v0.7.0 sul dispositivo). |
| `spaceeyes.graficas.movil-mb` | Móvil (MB) | Mobile (MB) | Rete mobile (MB) |
| `spaceeyes.graficas.consumo.caption` | Consumo de datos por periodo | Data usage per period | Consumo di dati per periodo |
| `spaceeyes.graficas.temperatura` | Temperatura (CPU / batería) | Temperature (CPU / battery) | Temperatura (CPU / batteria) |
| `spaceeyes.graficas.serie.cpu` | Temp CPU °C | CPU temp °C | Temp. CPU °C |
| `spaceeyes.graficas.serie.bat-temp` | Temp batería °C | Battery temp °C | Temp. batteria °C |
| `spaceeyes.graficas.bateria` | Nivel de batería | Battery level | Livello della batteria |
| `spaceeyes.graficas.serie.bateria` | Batería % | Battery (%) | Batteria (%) |
| `spaceeyes.graficas.senal` | Intensidad de señal | Signal strength | Intensità del segnale |
| `spaceeyes.graficas.serie.senal` | Señal dBm | Signal dBm | Segnale dBm |
| `spaceeyes.graficas.almacenamiento` | Almacenamiento y memoria libres | Free storage and memory | Spazio e memoria liberi |
| `spaceeyes.graficas.sin-telemetria` | Sin telemetría en el periodo seleccionado para este dispositivo. | No telemetry in the selected period for this device. | Nessuna telemetria nel periodo selezionato per questo dispositivo. |
| `spaceeyes.texto.confirmar-descartar` | Hay cambios sin guardar en la marca de este equipo. ¿Descartarlos? | There are unsaved changes to this device’s label. Discard them? | Ci sono modifiche non salvate nell’etichetta di questo dispositivo. Scartarle? |
| `spaceeyes.texto.capturada` | Fotografía capturada | Photo captured | Fotografia scattata |
| `spaceeyes.texto.no-llego` | No llegó la foto. ¿El equipo está en línea? | The photo did not arrive. Is the device online? | La foto non è arrivata. Il dispositivo è online? |
| `spaceeyes.texto.sin-permiso-foto` | No tienes permiso para tomar fotos | You do not have permission to take photos | Non hai il permesso di scattare foto |
| `spaceeyes.texto.no-orden` | No se pudo enviar la orden al equipo | Could not send the command to the device | Impossibile inviare il comando al dispositivo |
| `spaceeyes.texto.guardada` | Configuración guardada y aplicada al equipo | Settings saved and applied to the device | Configurazione salvata e applicata al dispositivo |
| `spaceeyes.texto.sin-permiso-marca` | No tienes permiso para cambiar la marca | You do not have permission to change the label | Non hai il permesso di modificare l’etichetta |
| `spaceeyes.texto.no-guardar` | No se pudo guardar la configuración | Could not save the settings | Impossibile salvare la configurazione |
| `spaceeyes.texto.titulo` | Ajustar texto de las fotos | Photo label | Regola il testo delle foto |
| `spaceeyes.texto.descripcion` | Toma una fotografía de prueba y acomoda cómo se verá {marca}. Se aplica a todas las fotos del equipo. | Take a test photo and arrange how {marca} will look. It applies to every photo from the device. | Scatta una fotografia di prova e sistema come apparirà {marca}. Si applica a tutte le foto del dispositivo. |
| `spaceeyes.texto.marca` | nombre · fecha · hora | name · date · time | nome · data · ora |
| `spaceeyes.texto.sin-comunicacion` | ␣(sin comunicación) | ␣(not reporting) | ␣(non comunica) |
| `spaceeyes.texto.capturando` | Capturando… | Capturing… | Scatto in corso… |
| `spaceeyes.texto.tomar` | Tomar fotografía | Take photo | Scatta fotografia |
| `spaceeyes.texto.solo-boton` | La cámara solo captura al pulsar el botón. | The camera only captures when you click the button. | La fotocamera scatta solo quando clicchi il pulsante. |
| `spaceeyes.texto.esperando` | Esperando la foto del equipo (hasta 30 s)… | Waiting for the device photo (up to 30 s)… | In attesa della foto dal dispositivo (fino a 30 s)… |
| `spaceeyes.texto.sin-permiso` | Solo quien puede editar inventario puede tomar la foto y guardar la marca. | Only someone who can edit inventory can take the photo and save the label. | Solo chi può modificare l’inventario può scattare la foto e salvare l’etichetta. |
| `spaceeyes.texto.arrastra` | Arrastra sobre la foto para mover la marca (o usa las flechas del teclado). Los cambios se ven al momento. | Drag over the photo to move the label (or use the arrow keys). Changes show up instantly. | Trascina sulla foto per spostare l’etichetta (o usa le frecce della tastiera). Le modifiche si vedono subito. |
| `spaceeyes.texto.fecha-foto` | La fecha y la hora de la vista previa son las de esta foto. | The date and time in the preview are this photo’s. | La data e l’ora dell’anteprima sono quelle di questa foto. |
| `spaceeyes.texto.sin-guardar` | sin guardar | unsaved | non salvato |
| `spaceeyes.texto.guardar` | Guardar configuración | Save settings | Salva configurazione |
| `spaceeyes.texto.posicion` | Posición de la marca: arrastra o usa las flechas | Label position: drag or use the arrow keys | Posizione dell’etichetta: trascina o usa le frecce |
| `spaceeyes.texto.alt` | Foto de referencia del equipo | Device reference photo | Foto di riferimento del dispositivo |
| `spaceeyes.texto.previsualizar` | Toma una fotografía para previsualizar | Take a photo to preview | Scatta una fotografia per l’anteprima |
| `spaceeyes.texto.desactivada` | Marca desactivada | Label turned off | Etichetta disattivata |
| `spaceeyes.texto.mostrar` | Mostrar marca | Show label | Mostra etichetta |
| `spaceeyes.texto.tamano` | Tamaño | Size | Dimensione |
| `spaceeyes.texto.peso` | Peso de la fuente | Font weight | Spessore del carattere |
| `spaceeyes.texto.normal` | Normal | Normal | Normale |
| `spaceeyes.texto.negrita` | Negrita | Bold | Grassetto |
| `spaceeyes.texto.color` | Color del texto | Text color | Colore del testo |
| `spaceeyes.texto.alineacion` | Alineación | Alignment | Allineamento |
| `spaceeyes.texto.izquierda` | Izquierda | Left | Sinistra |
| `spaceeyes.texto.centro` | Centro | Center | Centro |
| `spaceeyes.texto.derecha` | Derecha | Right | Destra |
| `spaceeyes.texto.interlineado` | Espaciado entre líneas | Line spacing | Interlinea |
| `spaceeyes.texto.interletra` | Espaciado entre letras | Letter spacing | Spaziatura tra le lettere |
| `spaceeyes.texto.sombra` | Sombra | Shadow | Ombra |
| `spaceeyes.texto.fondo` | Fondo semitransparente | Semi-transparent background | Sfondo semitrasparente |
| `spaceeyes.alta.tipo.telefono` | Teléfono Android | Android phone | Telefono Android |
| `spaceeyes.alta.tipo.telefono.detalle` | Se vincula escaneando un QR | Pairs by scanning a QR | Si abbina scansionando un QR |
| `spaceeyes.alta.tipo.raspberry` | Raspberry Pi | Raspberry Pi | Raspberry Pi |
| `spaceeyes.alta.tipo.raspberry.detalle` | Se instala sola desde la microSD | Installs itself from the microSD | Si installa da solo dalla microSD |
| `spaceeyes.alta.tipo.pc` | PC con cámara IP | PC with IP camera | PC con telecamera IP |
| `spaceeyes.alta.tipo.pc.detalle` | Con un código en el instalador | With a code in the installer | Con un codice nel programma di installazione |
| `spaceeyes.alta.nombre.telefono` | Teléfono | Phone | Telefono |
| `spaceeyes.alta.nombre.raspberry` | Raspberry | Raspberry | Raspberry |
| `spaceeyes.alta.nombre.pc` | PC | PC | PC |
| `spaceeyes.alta.error.permiso` | No tienes permiso para agregar equipos. | You do not have permission to add devices. | Non hai il permesso di aggiungere dispositivi. |
| `spaceeyes.alta.error.no-se-pudo` | No se pudo: {motivo} | Could not do it: {motivo} | Non è stato possibile: {motivo} |
| `spaceeyes.alta.error.completar` | No se pudo completar | Could not complete it | Impossibile completare |
| `spaceeyes.alta.error.red` | Escribe el nombre de la red WiFi del sitio, o elige "Cable o módem". | Type the name of the site WiFi network, or choose “Cable or modem”. | Scrivi il nome della rete WiFi del sito, o scegli «Cavo o modem». |
| `spaceeyes.alta.copiado` | Copiado | Copied | Copiato |
| `spaceeyes.alta.copiar` | Copiar | Copy | Copia |
| `spaceeyes.alta.copiar-comando` | Copiar comando | Copy command | Copia comando |
| `spaceeyes.alta.sirve.varios` | Sirve para {n} equipos | Works for {n} devices | Vale per {n} dispositivi |
| `spaceeyes.alta.sirve.una` | Sirve una sola vez | Works only once | Vale una sola volta |
| `spaceeyes.alta.vence` | ␣· vence {fecha} | ␣· expires {fecha} | ␣· scade {fecha} |
| `spaceeyes.alta.generar` | Generar código | Generate code | Genera codice |
| `spaceeyes.alta.descripcion` | Cada equipo nuevo entra con un código de un solo uso que se genera aquí. Elige qué equipo vas a instalar. | Each new device joins with a single-use code generated here. Choose which device you are going to install. | Ogni nuovo dispositivo entra con un codice monouso generato qui. Scegli quale dispositivo installerai. |
| `spaceeyes.alta.sin-permiso` | Para agregar equipos necesitas permiso de edición en Inventario. Pídeselo a un administrador de tu empresa. | To add devices you need edit permission in Inventory. Ask an admin at your company for it. | Per aggiungere dispositivi ti serve il permesso di modifica in Inventario. Chiedilo a un amministratore della tua azienda. |
| `spaceeyes.alta.cuantos` | ¿Cuántos equipos vas a instalar? | How many devices are you going to install? | Quanti dispositivi installerai? |
| `spaceeyes.alta.dura` | El código dura | The code lasts | Il codice dura |
| `spaceeyes.alta.dias.uno` | {n} día | {n} day | {n} giorno |
| `spaceeyes.alta.dias.otros` | {n} días | {n} days | {n} giorni |
| `spaceeyes.alta.lote.qr` | Un solo QR para los {n}: cada equipo entra por separado. Al equipo {siguiente} ya no lo deja entrar, y puedes cancelarlo en cualquier momento. | One QR for {n} devices: each one joins on its own. From device no. {siguiente} on, nobody else gets in, and you can cancel the QR at any time. | Un solo QR per {n} dispositivi: ognuno entra separatamente. Dal dispositivo n. {siguiente} in poi non entra più nessuno, e puoi annullare il QR in qualsiasi momento. |
| `spaceeyes.alta.lote.archivo` | Un solo archivo para los {n}: cada equipo entra por separado. Al equipo {siguiente} ya no lo deja entrar, y puedes cancelarlo en cualquier momento. | One file for {n} devices: each one joins on its own. From device no. {siguiente} on, nobody else gets in, and you can cancel the file at any time. | Un solo file per {n} dispositivi: ognuno entra separatamente. Dal dispositivo n. {siguiente} in poi non entra più nessuno, e puoi annullare il file in qualsiasi momento. |
| `spaceeyes.alta.lote.codigo` | Un solo código para los {n}: cada equipo entra por separado. Al equipo {siguiente} ya no lo deja entrar, y puedes cancelarlo en cualquier momento. | One code for {n} devices: each one joins on its own. From device no. {siguiente} on, nobody else gets in, and you can cancel the code at any time. | Un solo codice per {n} dispositivi: ognuno entra separatamente. Dal dispositivo n. {siguiente} in poi non entra più nessuno, e puoi annullare il codice in qualsiasi momento. |
| `spaceeyes.alta.uno-solo` | Uno solo: el código sirve una vez. | Just one: the code works once. | Uno solo: il codice vale una volta. |
| `spaceeyes.alta.tel.1` | Instala la app {app} en el teléfono{enlace}. | Install the {app} app on the phone{enlace}. | Installa l’app {app} sul telefono{enlace}. |
| `spaceeyes.alta.tel.descargar` | descargar la app {version} | download app {version} | scarica l’app {version} |
| `spaceeyes.alta.tel.2` | Genera el código y ábrelo junto al teléfono. | Generate the code and keep it open next to the phone. | Genera il codice e aprilo accanto al telefono. |
| `spaceeyes.alta.tel.3` | En la app, toca {vincular} y escanea el QR. Si la cámara no lo lee, escribe el código. | On the phone, open the app, choose {vincular} and scan the QR. If the camera cannot read it, type the code. | Sul telefono, apri l’app, conferma con {vincular} e scansiona il QR. Se la fotocamera non lo legge, scrivi il codice. |
| `spaceeyes.alta.tel.vincular` | Vincular | Vincular | Vincular |
| `spaceeyes.alta.tel.4` | El teléfono aparece en Equipos en unos segundos. Ahí le pones el nombre del sitio. | The phone shows up in Devices within seconds. Give it the site name there. | Il telefono compare in Dispositivi in pochi secondi. Lì gli dai il nome del sito. |
| `spaceeyes.alta.tel.escanea` | Escanéalo desde la app Space Eye | Scan it from the Space Eye app | Scansionalo dall’app Space Eye |
| `spaceeyes.alta.tel.qr` | Aquí aparecerá el QR | The QR will show up here | Qui comparirà il QR |
| `spaceeyes.alta.pi.sola` | Se instala sola (recomendado) | Installs itself (recommended) | Si installa da solo (consigliato) |
| `spaceeyes.alta.pi.encendida` | Ya está encendida | Already running | È già acceso |
| `spaceeyes.alta.pi.nombre` | Nombre del sitio (opcional) | Site name (optional) | Nome del sito (facoltativo) |
| `spaceeyes.alta.pi.nombre.vacio` | Déjalo vacío para varias | Leave it empty for several | Lascialo vuoto per più dispositivi |
| `spaceeyes.alta.pi.nombre.ej` | Av. Juárez 120 · Cara A | 120 Juárez Ave. · Side A | Via Garibaldi 120 · Lato A |
| `spaceeyes.alta.pi.mismo-archivo` | El mismo archivo va en las {n} microSD. A cada Raspberry le pones el nombre de su sitio en Equipos cuando aparezca. | The same file goes on all {n} microSD cards. Give each Raspberry its site name in Devices when it shows up. | Lo stesso file va su tutte le {n} microSD. A ogni Raspberry dai il nome del suo sito in Dispositivi quando compare. |
| `spaceeyes.alta.pi.conexion` | ¿Cómo se conecta a internet en el sitio? | How does it connect to the internet at the site? | Come si collega a internet nel sito? |
| `spaceeyes.alta.pi.cable` | Cable o módem | Cable or modem | Cavo o modem |
| `spaceeyes.alta.pi.red` | Nombre de la red | Network name | Nome della rete |
| `spaceeyes.alta.pi.clave` | Contraseña | Password | Password |
| `spaceeyes.alta.pi.clave.texto` | La contraseña solo se guarda dentro del archivo que descargas; no se envía a ningún servidor. | The password is only stored inside the file you download; it is not sent to any server. | La password viene salvata solo all’interno del file che scarichi; non viene inviata a nessun server. |
| `spaceeyes.alta.pi.descargar` | Descargar archivo para la microSD | Download file for the microSD | Scarica il file per la microSD |
| `spaceeyes.alta.pi.listo` | Listo: se descargó el archivo con el código {codigo}. | Done: the file with code {codigo} was downloaded. | Fatto: è stato scaricato il file con il codice {codigo}. |
| `spaceeyes.alta.pi.listo.varias` | Cópialo en las {n} microSD; sirve hasta para {n} Raspberry. | Copy it to all {n} microSD cards; it works for up to {n} Raspberry devices. | Copialo sulle {n} microSD; vale per un massimo di {n} Raspberry. |
| `spaceeyes.alta.pi.listo.una` | Sirve para una sola Raspberry. | It works for a single Raspberry. | Vale per un solo Raspberry. |
| `spaceeyes.alta.pi.listo.vence` | Vence {fecha}. | Expires {fecha}. | Scade {fecha}. |
| `spaceeyes.alta.pi.1` | En tu computadora, graba la microSD con {imager}: Raspberry Pi OS Lite (64-bit). Cuando pregunte si quieres personalizar, elige {no}. | On your computer, flash the microSD with {imager}: Raspberry Pi OS Lite (64-bit). When it asks whether to customize, choose {no}. | Sul tuo computer, scrivi la microSD con {imager}: Raspberry Pi OS Lite (64-bit). Quando chiede se vuoi personalizzare, scegli {no}. |
| `spaceeyes.alta.pi.1.no` | No | No | No |
| `spaceeyes.alta.pi.2` | Sin sacar la microSD, ábrela en el explorador (se llama {bootfs}) y copia ahí {userdata} y {network} del archivo descargado. Reemplaza los que trae. | Without removing the microSD, open it in the file explorer (it is called {bootfs}) and copy {userdata} and {network} from the downloaded file there. Replace the ones it has. | Senza estrarre la microSD, aprila in Esplora file (si chiama {bootfs}) e copia lì {userdata} e {network} dal file scaricato. Sostituisci quelli già presenti. |
| `spaceeyes.alta.pi.3` | Pon la microSD en la Raspberry, conecta la cámara, el cable o módem si se usa, y la fuente de 5V/3A. | Put the microSD in the Raspberry, connect the camera, the cable or modem if used, and the 5V/3A power supply. | Inserisci la microSD nel Raspberry, collega la telecamera, il cavo o il modem se si usa, e l’alimentatore da 5V/3A. |
| `spaceeyes.alta.pi.4` | En 5 a 15 minutos aparece sola en {equipos}. Nadie tiene que conectarse a ella. | In 5 to 15 minutes it shows up on its own in {equipos}. Nobody has to connect to it. | In 5–15 minuti compare da solo in {equipos}. Nessuno deve collegarsi. |
| `spaceeyes.alta.enc.1` | Genera el código. | Generate the code. | Genera il codice. |
| `spaceeyes.alta.enc.2` | En la Raspberry (con internet), abre una terminal y pega el comando. | On the Raspberry (with internet), open a terminal and paste the command. | Sul Raspberry (con internet), apri un terminale e incolla il comando. |
| `spaceeyes.alta.enc.3` | Aparece en Equipos en uno o dos minutos. | It shows up in Devices in a minute or two. | Compare in Dispositivi in uno o due minuti. |
| `spaceeyes.alta.sin-direccion.pi` | Falta configurar la dirección pública de Space Eye de esta empresa (quedó apuntando al propio servidor): sin ella el comando instalaría la Raspberry contra una dirección que desde el sitio no existe. | This company’s public Space Eye address is not configured (it points to the server itself): without it the command would install the Raspberry against an address that does not exist from the site. | Manca la configurazione dell’indirizzo pubblico di Space Eye di questa azienda (è rimasto puntato al server stesso): senza di esso il comando installerebbe il Raspberry su un indirizzo che dal sito non esiste. |
| `spaceeyes.alta.pc.1` | Descarga el instalador en la PC del sitio{enlace} y ábrelo. | Download the installer on the site PC{enlace} and open it. | Scarica il programma di installazione sul PC del sito{enlace} e aprilo. |
| `spaceeyes.alta.pc.2` | Genera el código y escríbelo cuando el asistente te lo pida, junto con la cámara IP. | Generate the code and type it when the wizard asks for it, along with the IP camera. | Genera il codice e scrivilo quando la procedura guidata te lo chiede, insieme alla telecamera IP. |
| `spaceeyes.alta.pc.3` | La PC aparece en Equipos al terminar el asistente. | The PC shows up in Devices when the wizard finishes. | Il PC compare in Dispositivi al termine della procedura guidata. |
| `spaceeyes.alta.pc.servidor` | Dirección del servidor de tu empresa (el asistente la pide): {servidor} | Your company server address (the wizard asks for it): {servidor} | Indirizzo del server della tua azienda (la procedura guidata lo chiede): {servidor} |
| `spaceeyes.alta.sin-direccion.pc` | Falta configurar la dirección pública de Space Eye de esta empresa (quedó apuntando al propio servidor): pídesela a quien lo administra antes de correr el asistente. | This company’s public Space Eye address is not configured (it points to the server itself): ask whoever manages it before running the wizard. | Manca la configurazione dell’indirizzo pubblico di Space Eye di questa azienda (è rimasto puntato al server stesso): chiedilo a chi lo amministra prima di avviare la procedura guidata. |
| `spaceeyes.alta.codigos` | Códigos de vinculación | Pairing codes | Codici di abbinamento |
| `spaceeyes.alta.codigos.texto` | Los de los últimos 30 días. Uno vigente que ya no vayas a usar, cancélalo. | From the last 30 days. Cancel any active one you are not going to use. | Quelli degli ultimi 30 giorni. Se uno ancora valido non ti serve più, annullalo. |
| `spaceeyes.alta.codigos.vacio` | Todavía no se ha generado ninguno. | None has been generated yet. | Non ne è stato ancora generato nessuno. |
| `spaceeyes.alta.col.codigo` | Código | Code | Codice |
| `spaceeyes.alta.col.genero` | Generó | Created by | Generato da |
| `spaceeyes.alta.usos` | {usos} de {max} equipos | {usos} of {max} devices | {usos} di {max} dispositivi |
| `spaceeyes.alta.lote.vigente` | ␣· vigente hasta {fecha} | ␣· valid until {fecha} | ␣· valido fino al {fecha} |
| `spaceeyes.alta.lote.completo` | ␣· completo | ␣· full | ␣· esaurito |
| `spaceeyes.alta.lote.cancelado` | ␣· cancelado | ␣· cancelled | ␣· annullato |
| `spaceeyes.alta.lote.vencido` | ␣· vencido | ␣· expired | ␣· scaduto |
| `spaceeyes.alta.equipo-n` | equipo {id} | device {id} | dispositivo {id} |
| `spaceeyes.alta.usado-por` | Usado · {nombre} | Used · {nombre} | Usato · {nombre} |
| `spaceeyes.alta.vigente-hasta` | Vigente hasta {fecha} | Valid until {fecha} | Valido fino al {fecha} |
| `spaceeyes.alta.estado.vencido` | Vencido | Expired | Scaduto |
| `spaceeyes.alta.estado.cancelado` | Cancelado | Cancelled | Annullato |
| `spaceeyes.alta.estado.usado` | Usado | Used | Usato |

## Consumo de luz (`textos/energia.ts`) · 121 claves

| clave | español | inglés | italiano |
|---|---|---|---|
| `energia.descripcion` | Un recibo por predio y por mes. Se reparte entre sus pantallas igual que la renta. | One bill per property per month. It is split among its screens the same way as the rent. | Una bolletta per proprietà e per mese. Si ripartisce tra i suoi impianti come l’affitto. |
| `energia.error.cargar` | No se pudo cargar la captura de consumos | Could not load the consumption entries | Impossibile caricare i consumi registrati |
| `energia.error.contactar` | No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar. | Could not reach the server. Check your connection and try again. | Impossibile contattare il server. Controlla la connessione e riprova. |
| `energia.error.guardar-recibo` | No se pudo guardar el recibo | Could not save the bill | Impossibile salvare la bolletta |
| `energia.error.borrar-recibo` | No se pudo borrar el recibo | Could not delete the bill | Impossibile eliminare la bolletta |
| `energia.capturar` | Capturar un recibo | Enter a bill | Registra una bolletta |
| `energia.cargando-puntos` | Cargando los puntos de medición… | Loading the metering points… | Caricamento dei punti di misura… |
| `energia.sin-donde-abajo` | No hay dónde capturar todavía: el motivo está abajo. | There is nowhere to enter bills yet: the reason is below. | Non c’è ancora dove registrare bollette: il motivo è qui sotto. |
| `energia.cobertura.titulo` | Qué está capturado y qué falta | What’s entered and what’s missing | Cosa è registrato e cosa manca |
| `energia.meses.uno` | {n} mes | {n} month | {n} mese |
| `energia.meses.otros` | {n} meses | {n} months | {n} mesi |
| `energia.puntos.uno` | {n} punto | {n} metering point | {n} punto di misura |
| `energia.puntos.otros` | {n} puntos | {n} metering points | {n} punti di misura |
| `energia.resumen` | {meses} · {puntos} | {meses} · {puntos} | {meses} · {puntos} |
| `energia.vacio.error` | No se pudo cargar la captura | Could not load the entries | Impossibile caricare le registrazioni |
| `energia.vacio.periodo` | Revisa el periodo | Check the period | Controlla il periodo |
| `energia.vacio.sin-puntos` | Todavía no hay dónde capturar | Nowhere to enter bills yet | Non c’è ancora dove registrare bollette |
| `energia.vacio.sin-puntos-detalle` | Un recibo de luz cuelga de un predio con pantallas, o de una pantalla sin predio. Da de alta el inventario y esta pantalla se llena sola. | An electricity bill belongs to a property with screens, or to a screen with no property. Set up the inventory and this page fills itself in. | Una bolletta della luce appartiene a una proprietà con impianti, o a un impianto senza proprietà. Registra l’inventario e questa pagina si riempie da sola. |
| `energia.kpi.capturados` | Recibos capturados | Bills entered | Bollette registrate |
| `energia.kpi.no-cargar` | no se pudo cargar | could not be loaded | impossibile caricare |
| `energia.kpi.faltan` | Faltan | Missing | Mancanti |
| `energia.kpi.importe` | Importe del periodo | Period amount | Importo del periodo |
| `energia.kpi.kwh` | kWh del periodo | Period kWh | kWh del periodo |
| `energia.kpi.de` | {a} de {b} | {a} of {b} | {a} di {b} |
| `energia.kpi.del-periodo` | del periodo | in the period | del periodo |
| `energia.kpi.menos-luz` | el reporte enseña menos luz de la real | the report shows less electricity than the real figure | il report mostra meno elettricità di quella reale |
| `energia.kpi.completa` | captura completa | all entered | registrazione completa |
| `energia.kpi.solo-capturado` | solo lo capturado | entered only | solo il registrato |
| `energia.kpi.sin-pantalla.uno` | solo lo capturado · {n} recibo sin pantalla | entered only · {n} bill with no screen | solo il registrato · {n} bolletta senza impianto |
| `energia.kpi.sin-pantalla.otros` | solo lo capturado · {n} recibos sin pantalla | entered only · {n} bills with no screen | solo il registrato · {n} bollette senza impianto |
| `energia.predio-o-pantalla` | Predio o pantalla | Property or screen | Proprietà o impianto |
| `energia.opcion.pantallas.uno` | ␣· {n} pantalla | ␣· {n} screen | ␣· {n} impianto |
| `energia.opcion.pantallas.otros` | ␣· {n} pantallas | ␣· {n} screens | ␣· {n} impianti |
| `energia.opcion.suelta` | ␣· pantalla suelta | ␣· standalone screen | ␣· impianto isolato |
| `energia.mes-recibo` | Mes del recibo | Bill month | Mese della bolletta |
| `energia.medidor` | Medidor | Meter | Contatore |
| `energia.importe` | Importe | Amount | Importo |
| `energia.guardar-recibo` | Guardar recibo | Save bill | Salva bolletta |
| `energia.rejilla.faltan` | Faltan | Missing | Mancanti |
| `energia.rejilla.pantallas.uno` | {n} pantalla | {n} screen | {n} impianto |
| `energia.rejilla.pantallas.otros` | {n} pantallas | {n} screens | {n} impianti |
| `energia.rejilla.suelta` | Pantalla suelta | Standalone screen | Impianto isolato |
| `energia.rejilla.hueco` | Sin recibo capturado: no es un consumo de cero, es un dato que falta | No bill entered: this is not zero consumption, it is missing data | Nessuna bolletta registrata: non è un consumo pari a zero, è un dato mancante |
| `energia.rejilla.borrar-este` | Borrar este recibo | Delete this bill | Elimina questa bolletta |
| `energia.rejilla.borrar-aria` | Borrar el recibo del medidor {medidor} | Delete the bill for meter {medidor} | Elimina la bolletta del contatore {medidor} |
| `energia.rejilla.borrar` | Borrar el recibo | Delete the bill | Elimina la bolletta |
| `energia.sin-numero` | sin número | (no number) | (senza numero) |
| `energia.subir.error-leer` | No se pudieron leer los archivos | Could not read the files | Impossibile leggere i file |
| `energia.subir.no-guardar` | No se pudo guardar | Could not save | Impossibile salvare |
| `energia.subir.no-contactar` | No se pudo contactar al servidor | Could not reach the server | Impossibile contattare il server |
| `energia.subir.pregunta` | 1 · ¿Cuántos meses de calendario cubre cada recibo de esta tanda? | 1 · How many calendar months does each bill in this batch cover? | 1 · Quanti mesi di calendario copre ogni bolletta di questo lotto? |
| `energia.subir.elige-antes` | — elige antes de subir — | — choose before uploading — | — scegli prima di caricare — |
| `energia.subir.opcion.1` | 1 mes de calendario — un periodo corto, dentro de un solo mes | 1 calendar month — a short period, within a single month | 1 mese di calendario — un periodo breve, dentro un solo mese |
| `energia.subir.opcion.2` | 2 meses de calendario — lo normal en un recibo MENSUAL | 2 calendar months — the usual for a MONTHLY bill | 2 mesi di calendario — il normale per una bolletta MENSILE |
| `energia.subir.opcion.3` | 3 meses de calendario — lo normal en un recibo BIMESTRAL | 3 calendar months — the usual for a bill issued EVERY TWO MONTHS | 3 mesi di calendario — il normale per una bolletta emessa OGNI DUE MESI |
| `energia.subir.opcion.4` | 4 meses de calendario — un periodo largo o atrasado | 4 calendar months — a long or late period | 4 mesi di calendario — un periodo lungo o arretrato |
| `energia.subir.explica` | Se cuentan los meses de calendario que {toca} el periodo, no lo que dura. Un recibo mensual empieza a mitad de mes, así que casi siempre toca {dos}; uno bimestral, {tres}. Si mezclas mensuales y bimestrales en la misma tanda, muchos saldrán marcados: súbelos por separado. | Count the calendar months the period {toca}, not how long it lasts. A monthly bill starts mid-month, so it almost always touches {dos}; one issued every two months, {tres}. If you mix monthly bills and bills issued every two months in the same batch, many will be flagged: upload them separately. | Si contano i mesi di calendario che il periodo {toca}, non quanto dura. Una bolletta mensile inizia a metà mese, quindi quasi sempre ne tocca {dos}; una emessa ogni due mesi, {tres}. Se mescoli bollette mensili e bollette emesse ogni due mesi nello stesso lotto, molte risulteranno segnalate: caricale separatamente. |
| `energia.subir.toca` | toca | touches | tocca |
| `energia.subir.dos` | dos | two | due |
| `energia.subir.tres` | tres | three | tre |
| `energia.subir.leyendo` | Leyendo… | Reading… | Lettura… |
| `energia.subir.subir` | 2 · Subir PDF del recibo | 2 · Upload the bill PDF | 2 · Carica il PDF della bolletta |
| `energia.subir.elige-arriba` | Elige arriba cuántos meses esperas antes de subir los archivos. | Choose above how many months you expect before uploading the files. | Scegli qui sopra quanti mesi ti aspetti prima di caricare i file. |
| `energia.subir.se-leen` | Se leen en el servidor y no se guarda nada: revisa cada renglón contra el recibo y confírmalo. | They are read on the server and nothing is saved: check each row against the bill and confirm it. | Vengono letti sul server e non si salva nulla: controlla ogni riga con la bolletta e confermala. |
| `energia.subir.col.mes` | Mes | Month | Mese |
| `energia.subir.col.dias` | Días | Days | Giorni |
| `energia.subir.elige` | — elige — | — choose — | — scegli — |
| `energia.subir.escribelo` | escríbelo | type it | scrivilo |
| `energia.subir.guardado` | Guardado | Saved | Salvato |
| `energia.subir.guardando` | Guardando… | Saving… | Salvataggio… |
| `energia.subir.guardar` | Guardar | Save | Salva |
| `energia.subir.declaraste.uno` | Declaraste {n} mes y este recibo cubre {pdf}. Se repartió según el PDF. | You declared {n} month and this bill covers {pdf}. It was split according to the PDF. | Hai dichiarato {n} mese e questa bolletta ne copre {pdf}. È stata ripartita secondo il PDF. |
| `energia.subir.declaraste.otros` | Declaraste {n} meses y este recibo cubre {pdf}. Se repartió según el PDF. | You declared {n} months and this bill covers {pdf}. It was split according to the PDF. | Hai dichiarato {n} mesi e questa bolletta ne copre {pdf}. È stata ripartita secondo il PDF. |
| `energia.subir.ya-capturado` | Ya hay uno capturado en {mes}: {kwh} kWh por {monto}. Guardar otra vez DUPLICA el costo de ese mes. | One is already entered for {mes}: {kwh} kWh for {monto}. Saving again DOUBLES that month’s cost. | Ce n’è già una registrata per {mes}: {kwh} kWh per {monto}. Salvarla di nuovo RADDOPPIA il costo di quel mese. |
| `energia.motivo.falta-inicio` | Falta el mes de inicio | The start month is missing | Manca il mese di inizio |
| `energia.motivo.falta-fin` | Falta el mes de fin | The end month is missing | Manca il mese di fine |
| `energia.motivo.formato` | Usa fechas con formato AAAA-MM-DD | Use dates in YYYY-MM-DD format | Usa date nel formato AAAA-MM-GG |
| `energia.motivo.orden` | El mes de fin no puede ser anterior al de inicio | The end month cannot be before the start month | Il mese di fine non può essere precedente a quello di inizio |
| `energia.motivo.punto` | Elige a qué predio o pantalla corresponde el recibo | Choose which property or screen the bill belongs to | Scegli a quale proprietà o impianto corrisponde la bolletta |
| `energia.motivo.mes` | Elige el mes del recibo | Choose the bill month | Scegli il mese della bolletta |
| `energia.motivo.kwh.falta` | Captura los kWh del recibo | Enter the bill’s kWh | Inserisci i kWh della bolletta |
| `energia.motivo.importe.falta` | Captura el importe del recibo | Enter the bill amount | Inserisci l’importo della bolletta |
| `energia.motivo.kwh.numero` | los kWh tiene que ser un número | The kWh must be a number | i kWh devono essere un numero |
| `energia.motivo.importe.numero` | el importe tiene que ser un número | The amount must be a number | l’importo deve essere un numero |
| `energia.motivo.kwh.mayor` | los kWh tiene que ser mayor que cero | The kWh must be greater than zero | i kWh devono essere maggiori di zero |
| `energia.motivo.importe.mayor` | el importe tiene que ser mayor que cero | The amount must be greater than zero | l’importo deve essere maggiore di zero |
| `energia.motivo.futuro` | Ese mes todavía no ha terminado: no puede haber recibo | That month hasn’t ended yet: there can’t be a bill for it | Quel mese non è ancora finito: non può esserci una bolletta |
| `energia.cobertura.huerfanos.uno` | {n} recibo capturado por {monto} no llega a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad. | {n} entered bill for {monto} doesn’t reach any screen, because its property has none set up. That money does not appear in the profitability report. | {n} bolletta registrata per {monto} non arriva a nessun impianto, perché la sua proprietà non ne ha nessuno registrato. Quel denaro non compare nel report di redditività. |
| `energia.cobertura.huerfanos.otros` | {n} recibos capturados por {monto} no llegan a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad. | {n} entered bills for {monto} don’t reach any screen, because their property has none set up. That money does not appear in the profitability report. | {n} bollette registrate per {monto} non arrivano a nessun impianto, perché la loro proprietà non ne ha nessuno registrato. Quel denaro non compare nel report di redditività. |
| `energia.cobertura.sin-puntos` | Todavía no hay dónde capturar recibos: hace falta al menos un predio con pantallas, o una pantalla sin predio. | There is nowhere to enter bills yet: you need at least one property with screens, or a screen with no property. | Non c’è ancora dove registrare bollette: serve almeno una proprietà con impianti, o un impianto senza proprietà. |
| `energia.cobertura.completa.uno` | Captura completa: están los {n} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad. | All entered: the period’s {n} bill is in. The electricity cost in the profitability report is the real total. | Registrazione completa: è presente la bolletta del periodo ({n}). Il costo della luce nel report di redditività è il totale reale. |
| `energia.cobertura.completa.otros` | Captura completa: están los {n} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad. | All entered: all {n} bills for the period are in. The electricity cost in the profitability report is the real total. | Registrazione completa: ci sono tutte le {n} bollette del periodo. Il costo della luce nel report di redditività è il totale reale. |
| `energia.cobertura.faltan` | Faltan {faltan} de {esperados} recibos del periodo. Mientras falten, el reporte de rentabilidad suma solo lo capturado y enseña un costo de luz MENOR del real, sin avisar de nada: un mes sin recibo no es un mes sin consumo. | {faltan} of {esperados} bills for the period are missing. Until they are entered, the profitability report adds up only what has been entered and shows an electricity cost LOWER than the real one, with no warning: a month with no bill is not a month with no consumption. | Bollette mancanti nel periodo: {faltan} su {esperados}. Finché mancano, il report di redditività somma solo il registrato e mostra un costo della luce MINORE di quello reale, senza nessun avviso: un mese senza bolletta non è un mese senza consumo. |
| `energia.borrado.confirmacion` | Se borra el recibo del medidor {medidor}, de {mes}, por {monto}. No se puede deshacer: ese mes vuelve a contar como un hueco, y hasta que lo captures otra vez el reporte de rentabilidad enseñará un costo de luz menor del real. | This deletes the bill for meter {medidor}, for {mes}, for {monto}. It cannot be undone: that month counts as a gap again, and until you enter it again the profitability report will show an electricity cost lower than the real one. | Si elimina la bolletta del contatore {medidor}, di {mes}, per {monto}. Non si può annullare: quel mese torna a contare come un buco, e finché non la registri di nuovo il report di redditività mostrerà un costo della luce minore di quello reale. |
| `energia.lectura.punto` | Elige a qué predio o pantalla corresponde este recibo | Choose which property or screen this bill belongs to | Scegli a quale proprietà o impianto corrisponde questa bolletta |
| `energia.lectura.kwh.falta` | Escribe los kWh: no se pudieron leer del PDF | Enter the kWh: they could not be read from the PDF | Scrivi i kWh: non è stato possibile leggerli dal PDF |
| `energia.lectura.importe.falta` | Escribe el importe: no se pudieron leer del PDF | Enter the amount: it could not be read from the PDF | Scrivi l’importo: non è stato possibile leggerlo dal PDF |
| `energia.lectura.no-recibo.uno` | {n} archivo no es un recibo de CFE | {n} file is not a CFE bill | {n} file non è una bolletta CFE |
| `energia.lectura.no-recibo.otros` | {n} archivos no son un recibo de CFE | {n} files are not CFE bills | {n} file non sono bollette CFE |
| `energia.lectura.desajuste.uno` | {n} no coincide con los {esperados} meses que declaraste | {n} doesn’t match the number of months you declared ({esperados}) | {n} non corrisponde al numero di mesi che hai dichiarato ({esperados}) |
| `energia.lectura.desajuste.otros` | {n} no coinciden con los {esperados} meses que declaraste | {n} don’t match the number of months you declared ({esperados}) | {n} non corrispondono al numero di mesi che hai dichiarato ({esperados}) |
| `energia.lectura.cubre.uno` | {base}: cubre {unico} meses de calendario | {base}: the number of calendar months it covers is {unico} | {base}: i mesi di calendario che copre sono {unico} |
| `energia.lectura.cubre.otros` | {base}: los {n} cubren {unico} meses de calendario | {base}: the number of calendar months covered by those {n} is {unico} | {base}: i mesi di calendario coperti da quei {n} sono {unico} |
| `energia.lectura.sin-predio` | {n} sin predio: eligelo tú | {n} with no property: choose it yourself | {n} senza proprietà: sceglila tu |
| `energia.lectura.sin-cifra` | {n} con una cifra que no se pudo leer | {n} with a figure that could not be read | {n} con una cifra che non è stato possibile leggere |
| `energia.lectura.repetidos` | {n} ya capturados: volver a guardarlos DUPLICA el costo | {n} already entered: saving them again DOUBLES the cost | {n} con il mese già registrato: salvare di nuovo RADDOPPIA il costo |
| `energia.lectura.alerta` | Se leyeron {leidos} de {total} archivos y salen {filas} renglones. Revisa antes de confirmar: {pegas}. | Files read: {leidos} of {total}; rows: {filas}. Check before confirming: {pegas}. | File letti: {leidos} su {total}; righe: {filas}. Controlla prima di confermare: {pegas}. |
| `energia.lectura.ninguno` | No salió ningún renglón de estos archivos. | These files produced no rows. | Da questi file non è uscita nessuna riga. |
| `energia.lectura.ok.uno` | Se leyeron los {total} {archivos} y salen {filas} {renglones}. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar. | {total} {archivos} was read and it produces {filas} {renglones}. Check each row against the bill and confirm it: nothing is saved until you click save. | È stato letto {total} {archivos} e contiene {filas} {renglones}. Controlla ogni riga con la bolletta e confermala: non si salva nulla finché non clicchi salva. |
| `energia.lectura.ok.otros` | Se leyeron los {total} {archivos} y salen {filas} {renglones}. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar. | {total} {archivos} were read and they produce {filas} {renglones}. Check them against the bill and confirm them: nothing is saved until you click save. | Sono stati letti {total} {archivos} e contengono {filas} {renglones}. Controlla ogni riga con la bolletta e confermala: non si salva nulla finché non clicchi salva. |
| `energia.lectura.archivo.uno` | archivo | file | file |
| `energia.lectura.archivo.otros` | archivos | files | file |
| `energia.lectura.renglon.uno` | renglón | row | riga |
| `energia.lectura.renglon.otros` | renglones | rows | righe |
| `energia.leido.servicio` | servicio {n} | service {n} | servizio {n} |
| `energia.leido.medidor` | medidor {n} | meter {n} | contatore {n} |
| `energia.leido.periodo` | periodo {desde} → {hasta} | period {desde} → {hasta} | periodo {desde} → {hasta} |
| `energia.leido.pdf-dice` | el PDF dice {kwh} kWh | the PDF says {kwh} kWh | il PDF indica {kwh} kWh |
| `energia.leido.facturacion` | facturación {monto} | period charges {monto} | fatturazione {monto} |
| `energia.leido.alumbrado` | alumbrado {monto} | street lighting {monto} | illuminazione pubblica {monto} |
| `energia.leido.total` | Total del recibo {monto} (incluye adeudos y pagos) | Bill total {monto} (includes past-due balances and payments) | Totale della bolletta {monto} (include arretrati e pagamenti) |
