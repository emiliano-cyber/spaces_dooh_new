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
  // El Programador de tareas exige UTF-16 para el XML.
  fs.writeFileSync(xml, xmlTarea(), 'utf16le');
  try {
    execFileSync('schtasks', ['/Create', '/F', '/TN', TAREA, '/XML', xml], { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(xml); } catch (_) {}
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
// Opcionales: --servidor --puerto --canal --canal-stream --puerto-rtsp
function leerParametros(argv) {
  const p = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) p[a.slice(2)] = argv[++i];
  }
  return p;
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

  const { host, puerto } = partirHost(destino, Number(par.puerto) || 80);
  const cfg = {
    server_url: servidor,
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

  // La vista en vivo necesita ffmpeg, que no viene con Windows. Se avisa AQUI,
  // con la persona todavia en el sitio: si se entera despues, hay que volver.
  if (!hayFfmpegVecino()) {
    console.log('');
    console.log('  AVISO: falta ffmpeg.exe para la VISTA EN VIVO.');
    console.log(`         Copialo junto a este programa: ${rutaVecina()}`);
    console.log('         Las fotos funcionan sin el; solo el video en vivo lo necesita.');
    console.log('         Despues puedes comprobarlo con:');
    console.log(`         "${rutas.ejecutable}" --probar-stream`);
  }

  if (!esAdministrador()) {
    console.log('');
    console.log('  FALTA UN PASO: para que arranque solo con Windows necesito');
    console.log('  permisos de administrador.');
    console.log('');
    console.log('  Cierra esta ventana, haz CLIC DERECHO sobre el archivo y elige');
    console.log('  "Ejecutar como administrador". La camara ya quedo configurada,');
    console.log('  solo te volvera a preguntar para confirmar.');
    return pausar();
  }

  try {
    instalarTarea();
    arrancarTarea();
    console.log('');
    console.log('  ===========================================');
    console.log('   INSTALADO Y FUNCIONANDO');
    console.log('  ===========================================');
    console.log('');
    console.log(`  El agente arranca solo con Windows (tarea "${TAREA}").`);
    console.log('  Ya aparece en el dashboard como equipo nuevo: entra a su ficha');
    console.log('  y ponle el nombre del sitio.');
    console.log('');
    console.log(`  Si algo falla, revisa: ${rutas.registro}`);
  } catch (e) {
    console.log(`\n  No pude registrar el arranque automatico: ${e.message}`);
    console.log('  La camara si quedo configurada; puedes arrancarlo a mano');
    console.log(`  ejecutando: "${rutas.ejecutable}" --servicio`);
  }
  pausar();
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
  await asistente();
  return 'salir';
}

module.exports = { asistente, desinstalar, menu, pausar, TAREA };
