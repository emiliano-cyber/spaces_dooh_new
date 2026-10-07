// pc-agent/src/instalar.js
// Asistente de instalacion: lo que ve quien va al sitio.
//
// Objetivo: copiar UN archivo, doble clic, tres preguntas y listo. Nada de
// instalar Node, editar JSON ni configurar el Programador de tareas a mano.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const rutas = require('./rutas');
const { Camara } = require('./camera');
const { hayFfmpegVecino, rutaVecina } = require('./transmision');

const SERVIDOR_POR_DEFECTO = 'http://159.203.188.58:4000';
const TAREA = 'SPACE EYE Agente';

function preguntar(rl, texto, porDefecto) {
  const sufijo = porDefecto ? ` [${porDefecto}]` : '';
  return new Promise((res) => rl.question(`${texto}${sufijo}: `, (r) => res(r.trim() || porDefecto || '')));
}

// Sin admin no se puede crear una tarea que arranque con Windows.
function esAdministrador() {
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// La tarea se define por XML y no con los parametros simples de schtasks, porque
// hacen falta cosas que esos no permiten y que aqui son imprescindibles:
//   - arrancar al encender la PC, sin que nadie inicie sesion;
//   - REPETIR cada 10 minutos: si el proceso muere, vuelve solo. Antes, con un
//     unico disparador al encender, un fallo dejaba el sitio mudo hasta que
//     alguien reiniciara la computadora;
//   - IgnoreNew: si ya esta corriendo, la repeticion no abre otra copia;
//   - reintentos ante fallo y sin limite de duracion (opera 24/7).
function xmlTarea() {
  const cmd = rutas.ejecutable.replace(/&/g, '&amp;');
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Agente SPACE EYE: captura fotos de la camara del sitio y reporta al dashboard.</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger><Enabled>true</Enabled></BootTrigger>
    <TimeTrigger>
      <StartBoundary>2020-01-01T00:00:00</StartBoundary>
      <Repetition>
        <Interval>PT10M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>99</Count>
    </RestartOnFailure>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <Priority>5</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${cmd}</Command>
      <Arguments>--servicio</Arguments>
      <WorkingDirectory>${rutas.BASE}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
}

function instalarTarea() {
  const xml = path.join(rutas.BASE, 'tarea.xml');
  // El Programador de tareas exige UTF-16 CON MARCA DE ORDEN DE BYTES (BOM).
  //
  // `writeFileSync(..., 'utf16le')` de Node escribe UTF-16 SIN BOM, y sin ella
  // schtasks lee el archivo como si fuera de un byte por caracter: encuentra el
  // '<' y despues el NUL que va detras, y aborta con
  //   (1,2)::ERROR: elemento de raiz unico
  // que suena a XML mal armado y no lo es -la columna 2 es justamente ese NUL-.
  // Visto en el sitio de REVOLUCION el 09-sep: la camara quedaba configurada y
  // el arranque automatico no, o sea que el equipo moria al primer reinicio.
  fs.writeFileSync(xml, '\uFEFF' + xmlTarea(), 'utf16le');
  try {
    execFileSync('schtasks', ['/Create', '/F', '/TN', TAREA, '/XML', xml], { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(xml); } catch (_) {}
  }
}

/**
 * Respaldo sin XML, por si el Programador de tareas rechaza el archivo en alguna
 * version de Windows.
 *
 * Con banderas simples no se puede pedir IgnoreNew, pero no hace falta: el agente
 * tiene candado de instancia unica (el puerto 47713 en index.js), asi que una
 * segunda copia no toma el puerto y se sale sola. `/SC MINUTE /MO 10` cubre las
 * dos cosas que importan -arranca despues de encender la PC y vuelve si el
 * proceso murio-; lo unico que se pierde es arrancar en el segundo cero del
 * encendido en vez de dentro de los primeros diez minutos.
 */
function instalarTareaSimple() {
  execFileSync('schtasks', [
    '/Create', '/F', '/TN', TAREA,
    '/TR', `"${rutas.ejecutable}" --servicio`,
    '/SC', 'MINUTE', '/MO', '10',
    '/RU', 'SYSTEM', '/RL', 'HIGHEST',
  ], { stdio: 'pipe' });
}

/** Que la tarea EXISTA de verdad, no que el comando no haya dado error. */
function tareaRegistrada() {
  try {
    execFileSync('schtasks', ['/Query', '/TN', TAREA], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function arrancarTarea() {
  execFileSync('schtasks', ['/Run', '/TN', TAREA], { stdio: 'pipe' });
}

function pausar() {
  // El .exe se abre con doble clic: sin esto la ventana se cierra y nadie lee
  // el resultado.
  try {
    console.log('\nPresiona ENTER para cerrar.');
    fs.readSync(0, Buffer.alloc(1), 0, 1, null);
  } catch { /* sin consola interactiva */ }
}

// Permite instalar sin contestar preguntas, util para varios sitios de golpe:
//   SpaceEyeAgente.exe --instalar --camara 192.168.1.64 --usuario admin --clave xxx
// Opcionales: --servidor --puerto --canal --canal-stream --puerto-rtsp --testigo
function leerParametros(argv) {
  const p = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) p[a.slice(2)] = argv[++i];
  }
  return p;
}

// --- El testigo de alta (SE.6) -------------------------------------------
//
// Es lo que hace que el equipo nazca ya asignado a su dueno, y el agente NO
// puede llevar el NOMBRE del dueno: eso lo podria escribir cualquiera. Lleva un
// testigo que solo existe para una instancia, y el servidor mira de quien es.
//
// Viaja en un archivo suelto junto al programa y no compilado dentro, porque el
// .exe es UNO para toda la flota: la pantalla de descarga arma el ZIP metiendo
// el testigo de ese cliente al lado, sin recompilar nada.
const NOMBRE_TESTIGO = 'testigo.txt';

// `se_<12>_<43>`: la forma que genera el servidor. Se comprueba aqui para que un
// pegado a medias o un archivo con otra cosa dentro se vea en el sitio, y no
// tres semanas despues al notar que el equipo no es de nadie.
function pareceTestigo(valor) {
  return /^se_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/.test(String(valor || '').trim());
}

// Lo que trae el paquete. Devuelve tambien lo mal escrito, para poder avisar:
// un testigo ilegible tiene que dar la cara, no desaparecer en silencio.
function testigoDelPaquete() {
  const ruta = path.join(rutas.BASE, NOMBRE_TESTIGO);
  if (!fs.existsSync(ruta)) return '';
  try {
    // Se limpian comillas y BOM: el archivo puede venir de un copiar y pegar.
    return fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '').trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

// El que ya tiene instalado este equipo. Reconfigurar la camara de un sitio no
// puede dejarlo sin dueno de rebote: el paquete con el testigo.txt suele estar
// solo en la instalacion original, y quien vuelve meses despues a cambiar una IP
// no trae nada.
function testigoInstalado() {
  try {
    return String(JSON.parse(fs.readFileSync(rutas.config, 'utf8')).testigo_de_alta || '').trim();
  } catch {
    return '';
  }
}

// De donde salio, para poder decirlo en pantalla: no es lo mismo "lo trae el
// paquete" que "se conserva el que ya tenia".
function resolverTestigo(dado) {
  const aMano = String(dado || '').trim();
  if (aMano) return { testigo: aMano, origen: 'dado a mano' };
  const delPaquete = testigoDelPaquete();
  if (delPaquete) return { testigo: delPaquete, origen: 'del paquete de descarga' };
  const yaEstaba = testigoInstalado();
  if (yaEstaba) return { testigo: yaEstaba, origen: 'el que ya tenia este equipo' };
  return { testigo: '', origen: '' };
}

// El prefijo viaja en claro justamente para poder ensenarlo sin revelar nada; el
// secreto no se imprime NUNCA, y menos en la pantalla de una PC ajena.
function testigoParaVer(valor) {
  const t = String(valor || '');
  return t.length > 15 ? `${t.slice(0, 15)}...` : t;
}

// Acepta "192.168.1.64" o "192.168.1.64:8000": algunas camaras no usan el 80.
function partirHost(valor, puertoPorDefecto) {
  const m = /^(.+?):(\d+)$/.exec(valor || '');
  return m ? { host: m[1], puerto: Number(m[2]) } : { host: valor, puerto: puertoPorDefecto };
}

async function asistente() {
  console.log('');
  console.log('  ===========================================');
  console.log('   SPACE EYE — instalacion del agente de PC');
  console.log('  ===========================================');
  console.log('');
  console.log('  Para sitios con camara IP fija en lugar de telefono.');
  console.log('  Necesitas: la IP de la camara y su usuario/clave.');
  console.log('');
  console.log('  OJO: son las credenciales de la camara (las que usas para');
  console.log('  entrar a http://<ip> desde el navegador), NO las de Hik-Connect.');
  console.log('');

  const par = leerParametros(process.argv.slice(2));
  const desatendido = Boolean(par.camara && par.clave);

  let servidor, destino, usuario, clave;
  if (desatendido) {
    servidor = par.servidor || SERVIDOR_POR_DEFECTO;
    destino = par.camara;
    usuario = par.usuario || 'admin';
    clave = par.clave;
    console.log(`  Instalacion desatendida: camara ${destino}, usuario ${usuario}`);
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    servidor = await preguntar(rl, '  Servidor Space Eye', SERVIDOR_POR_DEFECTO);
    destino = await preguntar(rl, '  IP de la camara en la red local', '192.168.1.64');
    usuario = await preguntar(rl, '  Usuario de la camara', 'admin');
    clave = await preguntar(rl, '  Clave de la camara');
    rl.close();
  }

  if (!clave) {
    console.log('\n  Sin la clave no puedo continuar. Vuelve a ejecutar el instalador.');
    return pausar();
  }

  // Se comprueba el servidor ANTES de instalar. Sin esto, una direccion mal
  // escrita solo se nota cuando el equipo nunca aparece en el dashboard, y para
  // entonces la persona ya se fue del sitio.
  console.log(`\n  Probando el servidor ${servidor}...`);
  try {
    const res = await fetch(`${servidor.replace(/\/+$/, '')}/api/app/version`, {
      signal: AbortSignal.timeout(15000),
    });
    // 401 = responde pero pide sesion: es exactamente lo que se espera aqui.
    if (res.status === 401 || res.ok) console.log('  OK — el servidor responde.');
    else console.log(`  AVISO: respondio HTTP ${res.status}. Revisa la direccion.`);
  } catch (e) {
    console.log(`  NO PUDE CONTACTAR AL SERVIDOR: ${e.message}`);
    console.log('  Revisa la direccion y que esta PC tenga internet.');
    console.log('  (Se continua de todos modos: el agente reintenta solo cuando haya red.)');
  }

  // --testigo permite darlo a mano (instalacion desatendida, o rehacer una que
  // salio sin el); lo normal es que venga en el paquete.
  const { testigo, origen } = resolverTestigo(par.testigo);
  if (testigo && pareceTestigo(testigo)) {
    console.log('');
    console.log(`  Testigo de alta: ${testigoParaVer(testigo)}  (${origen})`);
    console.log('  El equipo quedara asignado a su dueno al darse de alta.');
  } else if (testigo) {
    console.log('');
    console.log('  AVISO: el testigo de alta no tiene la forma que espera el servidor');
    console.log(`         (se_...): "${testigoParaVer(testigo)}"`);
    console.log('         Se instala SIN testigo: el equipo quedara SIN dueno y habra');
    console.log('         que asignarlo desde el dashboard.');
  } else {
    console.log('');
    console.log('  Sin testigo de alta en el paquete: el equipo quedara SIN dueno');
    console.log('  hasta que se le asigne desde el dashboard.');
  }

  const { host, puerto } = partirHost(destino, Number(par.puerto) || 80);
  const cfg = {
    server_url: servidor,
    // Solo si es legible: escribir uno roto seria dejar al agente reintentando
    // contra un rechazo seguro.
    ...(pareceTestigo(testigo) ? { testigo_de_alta: testigo } : {}),
    camara: {
      host,
      puerto,
      usuario,
      clave,
      // canal = de donde sale la FOTO: siempre el principal, a maxima calidad.
      canal: Number(par.canal) || 101,
      // canal_stream = QUE canal usar si se pide el ahorro de datos; solo entra
      // en juego con "sub_stream": true. Por omision la vista en vivo sale del
      // mismo canal que la foto, para que el encuadre sea el mismo.
      canal_stream: Number(par['canal-stream'] || par.canal_stream) || 102,
      // Ahorro de subida a costa de mostrar OTRO encuadre (el secundario suele
      // ser 4:3 contra el 16:9 del principal). Se pide a proposito, sitio por
      // sitio; tipicamente donde hay modem LTE con tope de datos.
      sub_stream: par['sub-stream'] === true || par.sub_stream === true,
      puerto_rtsp: Number(par['puerto-rtsp'] || par.puerto_rtsp) || 554,
      timeout_ms: 15000,
    },
    intervalo_estado_seg: 60,
    intervalo_sondeo_seg: 30,
  };

  // Se prueba ANTES de instalar nada: es preferible fallar aqui, con la persona
  // enfrente de la camara, que dejar un servicio instalado que no funciona.
  console.log('\n  Probando la camara...');
  const cam = new Camara(cfg.camara);
  let jpeg;
  try {
    const info = await cam.infoDispositivo();
    if (info?.modelo) console.log(`  Detectada: ${info.modelo}  (firmware ${info.firmware || '?'})`);
    jpeg = await cam.tomarFoto();
  } catch (e) {
    console.log(`\n  NO PUDE TOMAR LA FOTO: ${e.message}`);
    console.log('');
    console.log('  Revisa:');
    console.log(`   - Que ${host} sea la IP correcta (abrela en el navegador de esta PC).`);
    console.log('   - Que el usuario y la clave sean los de la camara.');
    console.log('   - Que esta PC y la camara esten en la misma red.');
    return pausar();
  }

  const muestra = require('path').join(rutas.BASE, 'prueba.jpg');
  fs.writeFileSync(muestra, jpeg);
  console.log(`  OK — foto de ${Math.round(jpeg.length / 1024)} KB guardada en:`);
  console.log(`       ${muestra}`);
  console.log('       Abrela para confirmar el encuadre.');

  fs.writeFileSync(rutas.config, JSON.stringify(cfg, null, 2));
  console.log(`\n  Configuracion guardada.`);

  // --- Sustituir un equipo, en vez de crear uno nuevo ---------------------
  //
  // El backend reconoce a un equipo por su `device_uid`, y el agente lo deriva
  // del nombre de la PC mas la camara. Cambiar la PC cambia el nombre, asi que
  // sale un equipo NUEVO y se pierde el historial del sitio: galeria, ajustes
  // de camara, marca de informacion, campanas y las huellas de creativos.
  //
  // Con `--uid` se le dice cual es su identidad y el sitio sigue siendo el
  // mismo. El uid viejo se saca de la base:
  //   SELECT device_uid FROM devices WHERE id = <equipo>;
  // Funciona incluso cuando la PC anterior ya no existe, que es justo el caso
  // cuando se sustituye por averia -y es el caso en que antes no habia salida.
  if (par.uid) {
    const uid = String(par.uid).trim();
    if (!/^pc-[0-9a-f]{8,}$/i.test(uid)) {
      console.log('');
      console.log(`  AVISO: "${uid}" no parece un uid de agente de PC.`);
      console.log('         Se esperaba algo como pc-1a2b3c4d5e6f... Se ignora,');
      console.log('         y el equipo se dara de alta como NUEVO.');
    } else {
      fs.writeFileSync(rutas.estado, JSON.stringify({ device_uid: uid }, null, 2));
      console.log(`  Identidad fijada: sustituye al equipo ${uid}`);
      console.log('  (conserva galeria, ajustes y campanas del sitio)');
    }
  }

  if (!esAdministrador()) {
    console.log('');
    console.log('  FALTA UN PASO: para que arranque solo con Windows necesito');
    console.log('  permisos de administrador.');
    console.log('');
    console.log('  Cierra esta ventana, haz CLIC DERECHO sobre el archivo y elige');
    console.log('  "Ejecutar como administrador". La camara ya quedo configurada,');
    console.log('  solo te volvera a preguntar para confirmar.');
    if (!hayFfmpegVecino()) {
      console.log('');
      console.log('  Y aprovecha para copiar ffmpeg.exe junto a este programa:');
      console.log(`  ${rutaVecina()}  (sin el no hay vista en vivo)`);
    }
    return pausar();
  }

  // --- Arranque automatico ------------------------------------------------
  //
  // Se intenta por XML y, si Windows lo rechaza, con banderas simples. Antes un
  // fallo aqui dejaba la instalacion A MEDIAS -camara si, arranque no- y el
  // equipo moria al primer reinicio del sitio, avisado con una sola linea en
  // medio de la pantalla que es facil pasar por alto. Paso en REVOLUCION.
  console.log('');
  console.log('  Registrando el arranque automatico...');

  let modo = null;
  let detalle = '';
  try {
    instalarTarea();
    modo = 'completo';
  } catch (e) {
    detalle = primeraLinea(e);
    console.log(`  El Programador de tareas rechazo el XML (${detalle}).`);
    console.log('  Reintentando de otra forma...');
    try {
      instalarTareaSimple();
      modo = 'simple';
    } catch (e2) {
      detalle = primeraLinea(e2);
    }
  }

  // Que el comando no diera error no prueba que la tarea exista.
  if (modo && !tareaRegistrada()) {
    modo = null;
    detalle = 'el comando no fallo pero la tarea no quedo registrada';
  }
  if (modo) {
    try { arrancarTarea(); } catch (e) { /* la tarea existe; arrancara sola */ }
  }

  const faltaFfmpeg = !hayFfmpegVecino();

  console.log('');
  console.log('  ===========================================');
  console.log(modo ? '   LISTO' : '   INSTALACION A MEDIAS');
  console.log('  ===========================================');
  console.log('');
  console.log(`   [OK] Camara ${cfg.camara.host} conectada y probada`);
  console.log('   [OK] Configuracion guardada');
  console.log(modo
    ? `   [OK] Arranca solo con Windows (tarea "${TAREA}")`
    : '   [!!] NO arranca solo con Windows');
  console.log(faltaFfmpeg
    ? '   [!!] Falta ffmpeg.exe: no habra VISTA EN VIVO (las fotos si)'
    : '   [OK] ffmpeg.exe presente: vista en vivo disponible');

  if (modo === 'simple') {
    console.log('');
    console.log('   Nota: quedo registrado de la forma sencilla. Funciona igual;');
    console.log('   la unica diferencia es que al encender la PC puede tardar');
    console.log('   hasta 10 minutos en arrancar en vez de hacerlo al instante.');
  }

  console.log('');
  console.log('  QUE SIGUE:');
  if (!modo) {
    console.log('');
    console.log('   1. Abre CMD como administrador y pega esta linea:');
    console.log('');
    console.log(`      schtasks /Create /F /TN "${TAREA}" /TR "\"${rutas.ejecutable}\" --servicio" /SC MINUTE /MO 10 /RU SYSTEM /RL HIGHEST`);
    console.log('');
    console.log('   2. Para no dejar el sitio mudo mientras tanto, arrancalo a mano:');
    console.log(`      "${rutas.ejecutable}" --servicio`);
    console.log('');
    console.log(`   Motivo del fallo: ${detalle || 'desconocido'}`);
  } else {
    let paso = 1;
    if (faltaFfmpeg) {
      console.log('');
      console.log(`   ${paso++}. Copia ffmpeg.exe junto a este programa:`);
      console.log(`      ${rutaVecina()}`);
      console.log('      Se baja de http://159.203.188.58:4000/ffmpeg.exe');
      console.log(`      Comprueba con: "${rutas.ejecutable}" --probar-stream`);
    }
    console.log('');
    console.log(`   ${paso++}. Abre ${muestra} y confirma`);
    console.log('      que el encuadre de la pantalla es el correcto.');
    console.log('');
    console.log(`   ${paso++}. En el dashboard aparece como equipo NUEVO, sin nombre.`);
    console.log('      Entra a su ficha y ponle el nombre del sitio.');
  }
  console.log('');
  console.log('  IDENTIDAD DE ESTE EQUIPO:');
  console.log(`   ${rutas.estado}`);
  console.log('   GUARDA UNA COPIA de ese archivo. Si algun dia hay que cambiar');
  console.log('   esta PC, es lo unico que permite sustituirla sin perder la');
  console.log('   galeria y los ajustes del sitio.');
  console.log('');
  console.log(`  Registro de lo que haga el agente: ${rutas.registro}`);
  pausar();
}

/** El primer renglon de un error: los mensajes de schtasks traen varios. */
function primeraLinea(e) {
  return String((e && (e.stderr || e.message)) || e)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0] || 'sin detalle';
}

function desinstalar() {
  try {
    execFileSync('schtasks', ['/End', '/TN', TAREA], { stdio: 'ignore' });
  } catch { /* puede no estar corriendo */ }
  try {
    execFileSync('schtasks', ['/Delete', '/F', '/TN', TAREA], { stdio: 'pipe' });
    console.log('  Arranque automatico eliminado.');
  } catch (e) {
    console.log(`  No habia nada que desinstalar (${e.message.split('\n')[0]}).`);
  }
  console.log('  La configuracion y la identidad del equipo se conservan.');
  pausar();
}

/**
 * Doble clic cuando el equipo YA esta configurado.
 *
 * Antes esto arrancaba el agente directo: si la configuracion estaba mal, fallaba
 * y la ventana se cerraba de golpe, sin forma de corregir nada. Ahora muestra lo
 * que hay y ofrece reconfigurar.
 */
async function menu(cfgActual) {
  console.log('');
  console.log('  ===========================================');
  console.log('   SPACE EYE — agente de PC (ya configurado)');
  console.log('  ===========================================');
  console.log('');
  console.log(`  Servidor: ${cfgActual.server_url}`);
  console.log(`  Camara:   ${cfgActual.camara?.host}:${cfgActual.camara?.puerto || 80}`);
  console.log(`  Vivo:     canal ${cfgActual.camara?.sub_stream === true
      ? `${cfgActual.camara?.canal_stream || 102} (ahorro de datos, otro encuadre)`
      : `${cfgActual.camara?.canal || 101} (el mismo de la foto)`}` +
    (hayFfmpegVecino() ? '' : '   (SIN ffmpeg.exe: la vista en vivo no funcionara)'));
  console.log(`  Testigo:  ${cfgActual.testigo_de_alta
      ? `${testigoParaVer(cfgActual.testigo_de_alta)} (el equipo tiene dueno)`
      : 'ninguno (el equipo no esta asignado a ningun cliente)'}`);
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await preguntar(
    rl,
    '  ¿Que quieres hacer?  [1] Reconfigurar  [2] Arrancar el agente  [3] Probar la vista en vivo  [4] Salir',
    '1',
  )).trim();
  rl.close();

  if (r === '2') return 'arrancar';
  if (r === '3') return 'probar';
  if (r === '4') return 'salir';
  // Reconfigurar abre el asistente con ventanas, igual que una instalacion
  // nueva. Se carga aqui y no arriba para no crear un require circular:
  // asistente-web reutiliza las piezas de este archivo.
  await require('./asistente-web').asistenteWeb();
  return 'salir';
}

// El asistente con ventanas (asistente-web.js) reutiliza estas piezas en vez de
// duplicarlas: el registro de la tarea y sus respaldos son justo donde una copia
// divergente costaria caro.
module.exports = {
  asistente, desinstalar, menu, pausar, TAREA, SERVIDOR_POR_DEFECTO,
  esAdministrador, instalarTarea, instalarTareaSimple, tareaRegistrada,
  arrancarTarea, partirHost, primeraLinea, leerParametros,
  testigoDelPaquete, testigoInstalado, resolverTestigo, pareceTestigo,
  testigoParaVer, NOMBRE_TESTIGO,
};
