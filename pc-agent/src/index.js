// pc-agent/src/index.js
// Agente de PC para sitios con camara IP fija (HiLook / Hikvision) en lugar de
// telefono. Corre en la PC del sitio, que es quien alcanza a la camara en la red
// local, y se presenta ante el backend como un equipo mas.
//
// La programacion de fotos NO vive aqui: el scheduleWorker del backend inserta
// comandos TAKE_PHOTO igual que para los telefonos y este agente los obedece.
// Por eso los horarios se configuran en el dashboard, sin tocar la PC.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { io } = require('socket.io-client');
const { Camara } = require('./camera');
const { Transmision } = require('./transmision');
const { Api } = require('./api');
const rutas = require('./rutas');

const VERSION = '1.0.0';
const RAIZ = rutas.BASE;
const RUTA_CONFIG = rutas.config;
const RUTA_ESTADO = rutas.estado;

const ahora = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// Corriendo como tarea de Windows no hay consola que mirar, asi que el registro
// va tambien a un archivo junto al ejecutable (acotado para que no crezca sin fin).
function aArchivo(linea) {
  try {
    if (fs.existsSync(rutas.registro) && fs.statSync(rutas.registro).size > 5 * 1024 * 1024) {
      fs.renameSync(rutas.registro, rutas.registro + '.old');
    }
    fs.appendFileSync(rutas.registro, linea + os.EOL);
  } catch { /* si no se puede escribir, seguimos igual */ }
}

const log = (...a) => {
  const linea = `[${ahora()}] ` + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  console.log(linea);
  aArchivo(linea);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function cargarConfig() {
  if (!fs.existsSync(RUTA_CONFIG)) {
    console.error(`No encuentro la configuracion en ${RUTA_CONFIG}.`);
    console.error('Ejecuta el instalador (doble clic al programa) para configurarlo.');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8'));
  for (const campo of ['server_url', 'camara']) {
    if (!cfg[campo]) { console.error(`Falta "${campo}" en config.json`); process.exit(1); }
  }
  for (const campo of ['host', 'usuario', 'clave']) {
    if (!cfg.camara[campo]) { console.error(`Falta "camara.${campo}" en config.json`); process.exit(1); }
  }
  return cfg;
}

// El device_uid debe ser ESTABLE: si cambia, el backend crea un equipo nuevo y se
// pierde el historial del sitio. Se genera una vez y se guarda en disco.
function cargarEstado() {
  if (fs.existsSync(RUTA_ESTADO)) {
    try { return JSON.parse(fs.readFileSync(RUTA_ESTADO, 'utf8')); } catch { /* se regenera */ }
  }
  return {};
}

function guardarEstado(estado) {
  fs.writeFileSync(RUTA_ESTADO, JSON.stringify(estado, null, 2));
}

function uidEstable(estado, cfg) {
  if (estado.device_uid) return estado.device_uid;
  // Derivado del hostname + la camara: reinstalar el agente en la misma PC y con
  // la misma camara reutiliza el equipo en lugar de duplicarlo.
  const semilla = `${os.hostname()}|${cfg.camara.host}|${cfg.camara.canal || 101}`;
  estado.device_uid = 'pc-' + crypto.createHash('sha256').update(semilla).digest('hex').slice(0, 24);
  guardarEstado(estado);
  return estado.device_uid;
}

function telemetriaPc(camaraViva) {
  const libreMb = (() => {
    try { return Math.round(fs.statfsSync(RAIZ).bavail * fs.statfsSync(RAIZ).bsize / 1048576); }
    catch { return undefined; }
  })();
  return {
    // La PC no tiene bateria; el backend exige el campo, asi que se reporta
    // "conectada a corriente" para que el dashboard no la marque en riesgo.
    battery_pct: 100,
    battery_charging: true,
    network_type: 'ETHERNET',
    network_operator: camaraViva ? 'CAMARA OK' : 'CAMARA SIN RESPUESTA',
    storage_free_mb: libreMb,
    ram_free_mb: Math.round(os.freemem() / 1048576),
    uptime_seconds: Math.round(os.uptime()),
  };
}

async function main() {
  const cfg = cargarConfig();
  const estado = cargarEstado();
  const camara = new Camara(cfg.camara);
  const api = new Api(cfg.server_url);

  const intervaloEstado = (cfg.intervalo_estado_seg || 60) * 1000;
  const intervaloSondeo = (cfg.intervalo_sondeo_seg || 30) * 1000;

  log(`SPACE EYE — agente de PC v${VERSION}`);
  log(`servidor: ${cfg.server_url}`);
  log(`camara:   ${cfg.camara.host}:${cfg.camara.puerto || 80} (canal ${cfg.camara.canal || 101})`);

  // --- registro ---
  const uid = uidEstable(estado, cfg);
  const info = await camara.infoDispositivo();
  if (info) log(`camara detectada: ${info.modelo || '?'} fw ${info.firmware || '?'}`);
  else log('AVISO: no pude leer los datos de la camara (revisa IP, usuario y clave).');

  // Registro con reintentos: un sitio desatendido no puede rendirse porque en ese
  // momento no hubiera internet, el servidor estuviera reiniciando o la
  // configuracion tuviera un dato mal. Antes el proceso moria aqui y no volvia
  // hasta reiniciar la PC.
  const datosRegistro = {
    device_uid: uid,
    app_version: `pc-agent ${VERSION}`,
    model: info?.modelo || cfg.camara.modelo || 'Camara IP',
    manufacturer: 'HiLook/Hikvision',
    // Se recorta: la columna del servidor tiene limite y un valor largo hacia
    // fallar el registro.
    os_version: `${os.type()} ${os.release()}`.slice(0, 60),
  };

  let reg = null;
  for (let intento = 1; !reg; intento++) {
    try {
      reg = await api.registrar(datosRegistro);
    } catch (e) {
      const espera = Math.min(60, intento * 10);
      log(`no pude registrarme (intento ${intento}): ${e.message}`);
      log(`  -> reintento en ${espera}s. Revisa server_url en config.json y la conexion.`);
      await dormir(espera * 1000);
    }
  }
  estado.device_id = reg.device_id;
  guardarEstado(estado);
  log(`registrado como equipo #${reg.device_id} (uid ${uid})`);
  api.log('info', 'startup', `Agente de PC v${VERSION} iniciado en ${os.hostname()}`);

  const enCurso = new Set();
  const transmision = new Transmision(log, cfg.camara);

  async function tomarYSubir(cmd) {
    if (enCurso.has(cmd.id)) return;
    enCurso.add(cmd.id);
    const t0 = Date.now();
    try {
      const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
      const jpeg = await camara.tomarFoto();
      await api.subirFoto(jpeg, {
        taken_at: new Date().toISOString(),
        command_id: cmd.id,
        schedule_id: cmd.schedule_id || payload.schedule_id,
        campaign_id: payload.campaign_id,
        // Si el comando viene de un horario, cuenta como programada.
        source: (cmd.schedule_id || payload.schedule_id) ? 'scheduled' : 'on_demand',
      });
      await api.resultadoComando(cmd.id, true, { bytes: jpeg.length, ms: Date.now() - t0 });
      log(`foto subida (comando ${cmd.id}, ${Math.round(jpeg.length / 1024)} KB, ${Date.now() - t0} ms)`);
    } catch (e) {
      log(`ERROR al tomar/subir la foto (comando ${cmd.id}): ${e.message}`);
      await api.resultadoComando(cmd.id, false, null, e.message.slice(0, 500)).catch(() => {});
      api.log('error', 'photo', `No se pudo capturar: ${e.message}`);
    } finally {
      enCurso.delete(cmd.id);
    }
  }

  async function atender(cmd) {
    switch (cmd.command_type) {
      case 'TAKE_PHOTO':
        return tomarYSubir(cmd);
      case 'START_STREAM': {
        try {
          const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
          const info = transmision.iniciar(payload.publish_url);
          return api.resultadoComando(cmd.id, true, info);
        } catch (e) {
          log(`ERROR al iniciar la transmision: ${e.message}`);
          api.log('error', 'stream', `No se pudo transmitir: ${e.message}`);
          return api.resultadoComando(cmd.id, false, null, e.message.slice(0, 500));
        }
      }
      case 'STOP_STREAM':
        transmision.detener('solicitado desde el dashboard');
        return api.resultadoComando(cmd.id, true);
      case 'REBOOT_APP':
        log('reinicio solicitado desde el dashboard');
        await api.resultadoComando(cmd.id, true);
        return process.exit(0); // el servicio de Windows lo vuelve a levantar
      default:
        return api.resultadoComando(cmd.id, true, { ignorado: cmd.command_type });
    }
  }

  // --- comandos en vivo por socket.io (igual que los telefonos) ---
  const socket = io(`${cfg.server_url}/devices`, {
    auth: { token: api.token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelayMax: 30000,
  });
  socket.on('connect', () => log('socket conectado'));
  socket.on('disconnect', (r) => log(`socket desconectado (${r})`));
  socket.on('connect_error', (e) => log(`socket error: ${e.message}`));
  socket.on('command', (cmd) => {
    log(`comando recibido: ${cmd.command_type} (${cmd.id})`);
    socket.emit('command_ack', { command_id: cmd.id });
    atender(cmd);
  });

  // --- sondeo de respaldo: si el socket se cayo, los comandos igual llegan ---
  (async function sondear() {
    for (;;) {
      try {
        const { commands } = await api.comandosPendientes();
        for (const c of commands || []) await atender(c);
      } catch (e) {
        if (e.status === 401) {
          log('token rechazado; volviendo a registrar...');
          try { await api.registrar({
            device_uid: uid, app_version: `pc-agent ${VERSION}`,
            model: info?.modelo || 'Camara IP', manufacturer: 'HiLook/Hikvision',
            os_version: `${os.type()} ${os.release()}`,
          }); } catch { /* reintenta en el siguiente ciclo */ }
        }
      }
      await dormir(intervaloSondeo);
    }
  })();

  // --- telemetria periodica: mantiene el equipo "en linea" en el dashboard ---
  (async function reportar() {
    for (;;) {
      try {
        const viva = await camara.estaViva();
        await api.reportarEstado(telemetriaPc(viva));
        if (!viva) api.log('warning', 'camera', 'La camara no responde en la red local');
      } catch (e) {
        log(`no pude reportar estado: ${e.message}`);
      }
      await dormir(intervaloEstado);
    }
  })();

  log('agente listo; esperando comandos del dashboard');
}

process.on('unhandledRejection', (e) => log('fallo no controlado:', e?.message || e));

// Como lo abran decide que hace:
//   --servicio     -> corre el agente (asi lo lanza la tarea de Windows)
//   --desinstalar  -> quita el arranque automatico
//   doble clic     -> asistente de instalacion, o el agente si ya esta configurado
const flags = process.argv.slice(2);
const { asistente, desinstalar, menu, pausar } = require('./instalar');

// Arranca el agente. Si lo lanzo una persona (no la tarea de Windows) y algo
// falla, la ventana NO se cierra de golpe: antes un dato mal escrito hacia que
// el programa se cerrara al instante y no habia forma de corregirlo.
function arrancar(interactivo) {
  main().catch((e) => {
    log('ERROR FATAL:', e.message);
    if (interactivo) {
      console.log('\n  El agente no pudo arrancar. Lo mas comun es que la direccion del');
      console.log('  servidor este mal o que esta PC no tenga internet.');
      console.log('  Vuelve a abrir este programa y elige "Reconfigurar".');
      pausar();
    } else {
      // La tarea de Windows lo reintenta; salir con codigo != 0 lo deja registrado.
      process.exit(1);
    }
  });
}

if (flags.includes('--desinstalar')) {
  desinstalar();
} else if (flags.includes('--instalar') || flags.includes('--configurar')) {
  asistente().catch((e) => { console.error('Fallo la instalacion:', e.message); process.exit(1); });
} else if (flags.includes('--servicio')) {
  arrancar(false);
} else if (fs.existsSync(RUTA_CONFIG)) {
  // Doble clic con configuracion existente: se ofrece corregirla.
  let cfgActual = {};
  try { cfgActual = JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8')); } catch (_) {}
  menu(cfgActual)
    .then((accion) => { if (accion === 'arrancar') arrancar(true); })
    .catch((e) => { console.error('Error:', e.message); pausar(); });
} else {
  asistente().catch((e) => {
    console.error('Fallo la instalacion:', e.message);
    process.exit(1);
  });
}
