// pi-agent/src/index.js
// Agente de Raspberry Pi 5 para SPACE EYE. Se presenta ante el backend como un
// equipo mas, con el mismo contrato que la APK de Android y que el agente de PC.
//
// La programacion de fotos NO vive aqui: el scheduleWorker del backend inserta
// comandos TAKE_PHOTO igual que para los telefonos y este agente los obedece.
// Por eso los horarios se configuran en el dashboard, sin tocar el equipo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io } = require('socket.io-client');
const { Camara } = require('./camara');
const { Transmision } = require('./transmision');
const { Api } = require('./api');
const tele = require('./telemetria');
const rutas = require('./rutas');

const VERSION = '0.1.0';
const SERVIDOR_POR_OMISION = 'http://159.203.188.58:4000';

const ahora = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// Corriendo como servicio no hay consola que mirar, asi que el registro va
// tambien a un archivo (acotado para que no crezca sin fin).
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

// La configuracion es OPCIONAL a proposito: recien sacada de la caja, la Pi
// arranca contra el servidor de produccion sin que nadie edite un archivo.
function cargarConfig() {
  let cfg = {};
  if (fs.existsSync(rutas.config)) {
    try {
      cfg = JSON.parse(fs.readFileSync(rutas.config, 'utf8'));
    } catch (e) {
      log(`AVISO: ${rutas.config} no es JSON valido (${e.message}); se usan los valores por omision`);
    }
  }
  cfg.server_url = process.env.SPACEEYE_SERVER || cfg.server_url || SERVIDOR_POR_OMISION;
  cfg.camara = cfg.camara || {};
  return cfg;
}

function cargarEstado() {
  if (fs.existsSync(rutas.estado)) {
    try { return JSON.parse(fs.readFileSync(rutas.estado, 'utf8')); } catch { /* se regenera */ }
  }
  return {};
}

function guardarEstado(estado) {
  try { fs.writeFileSync(rutas.estado, JSON.stringify(estado, null, 2)); }
  catch (e) { log(`no pude guardar el estado: ${e.message}`); }
}

// El device_uid debe ser ESTABLE: si cambia, el backend da de alta un equipo
// nuevo y se pierde el historial del sitio. Se toma del numero de serie de la
// placa, que sobrevive incluso a reinstalar el sistema.
function uidEstable(estado, identidad) {
  if (estado.device_uid) return estado.device_uid;
  estado.device_uid = identidad.device_uid
    || `pi-${require('crypto').randomBytes(12).toString('hex')}`;
  guardarEstado(estado);
  return estado.device_uid;
}

// --- cola de fotos que no se pudieron subir (sin red) ---------------------
function encolarFoto(jpeg, meta) {
  try {
    fs.mkdirSync(rutas.cola, { recursive: true });
    const base = path.join(rutas.cola, `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    fs.writeFileSync(`${base}.jpg`, jpeg);
    fs.writeFileSync(`${base}.json`, JSON.stringify(meta));
    return true;
  } catch (e) {
    log(`no pude encolar la foto: ${e.message}`);
    return false;
  }
}

async function vaciarCola(api) {
  let pendientes;
  try { pendientes = fs.readdirSync(rutas.cola).filter((f) => f.endsWith('.json')); }
  catch { return; }

  for (const nombre of pendientes) {
    const base = path.join(rutas.cola, nombre.replace(/\.json$/, ''));
    try {
      const meta = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'));
      const jpeg = fs.readFileSync(`${base}.jpg`);
      await api.subirFoto(jpeg, meta);
      fs.unlinkSync(`${base}.json`);
      fs.unlinkSync(`${base}.jpg`);
      log(`foto en cola subida (${Math.round(jpeg.length / 1024)} KB)`);
    } catch (e) {
      // Sigue sin haber red: se queda en la cola para el proximo intento.
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 401) {
        log(`descarto foto en cola (el servidor la rechaza: ${e.message})`);
        try { fs.unlinkSync(`${base}.json`); fs.unlinkSync(`${base}.jpg`); } catch {}
      }
      return;
    }
  }
}

async function main() {
  const cfg = cargarConfig();
  const estado = cargarEstado();
  const identidad = tele.identidad();
  const camara = new Camara(cfg.camara);
  const api = new Api(cfg.server_url);

  const intervaloEstado = (cfg.intervalo_estado_seg || 60) * 1000;
  const intervaloSondeo = (cfg.intervalo_sondeo_seg || 30) * 1000;

  log(`SPACE EYE — agente de Raspberry Pi v${VERSION}`);
  log(`equipo:    ${identidad.model}`);
  log(`sistema:   ${identidad.os_version}`);
  log(`servidor:  ${cfg.server_url}`);

  // Avisar de una fuente insuficiente ANTES de nada: es la causa mas comun de
  // que una Pi 5 se comporte raro (se reinicia sola, la camara falla).
  const energia = tele.alimentacion();
  if (energia?.subvoltaje_ahora || energia?.subvoltaje_ocurrido) {
    log('AVISO: la Pi reporta falta de voltaje. Usa una fuente USB-C de 5V/3A o mas;');
    log('       el puerto USB de una laptop no alcanza y provoca fallos intermitentes.');
  }

  let modoCamara;
  try {
    modoCamara = await camara.describir();
    log(`camara:    ${modoCamara}`);
  } catch (e) {
    modoCamara = 'sin camara';
    log(`camara:    NO DISPONIBLE -> ${e.message}`);
  }

  // --- registro con reintentos ---
  // Un equipo desatendido no puede rendirse porque en ese momento no hubiera
  // internet o el servidor estuviera reiniciando.
  const uid = uidEstable(estado, identidad);
  const datosRegistro = {
    device_uid: uid,
    app_version: `pi-agent ${VERSION}`,
    model: identidad.model,
    manufacturer: identidad.manufacturer,
    os_version: identidad.os_version,
  };

  let reg = null;
  for (let intento = 1; !reg; intento++) {
    try {
      reg = await api.registrar(datosRegistro);
    } catch (e) {
      const espera = Math.min(60, intento * 10);
      log(`no pude registrarme (intento ${intento}): ${e.message}`);
      log(`  -> reintento en ${espera}s. Revisa la conexion y server_url.`);
      await dormir(espera * 1000);
    }
  }
  estado.device_id = reg.device_id;
  guardarEstado(estado);
  log(`registrado como equipo #${reg.device_id} (uid ${uid})`);
  api.log('info', 'startup', `Agente de Raspberry Pi v${VERSION} iniciado — ${modoCamara}`);
  if (camara.esPrueba()) {
    api.log('warning', 'camera', 'Sin camara conectada: se estan subiendo imagenes de prueba');
  }

  const enCurso = new Set();
  const transmision = new Transmision(log, cfg.stream || {});

  async function tomarYSubir(cmd) {
    if (enCurso.has(cmd.id)) return;
    enCurso.add(cmd.id);
    const t0 = Date.now();
    try {
      const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
      // Un solo sensor: no se puede transmitir y fotografiar a la vez. La foto
      // manda, porque es la funcion del negocio; la vista en vivo se corta.
      if (transmision.activa()) {
        transmision.detener('hay que tomar una foto');
        api.log('info', 'stream', 'Transmision cortada para atender una foto programada');
        await dormir(600);
      }
      const jpeg = await camara.tomarFoto();
      const meta = {
        taken_at: new Date().toISOString(),
        command_id: cmd.id,
        schedule_id: cmd.schedule_id || payload.schedule_id,
        campaign_id: payload.campaign_id,
        // Si el comando viene de un horario, cuenta como programada.
        source: (cmd.schedule_id || payload.schedule_id) ? 'scheduled' : 'on_demand',
      };
      try {
        await api.subirFoto(jpeg, meta);
        log(`foto subida (comando ${cmd.id}, ${Math.round(jpeg.length / 1024)} KB, ${Date.now() - t0} ms)`);
      } catch (e) {
        // La foto ya se tomo: no se tira porque falle la red.
        if (encolarFoto(jpeg, meta)) {
          log(`sin conexion al subir; foto guardada en la cola (comando ${cmd.id})`);
        } else {
          throw e;
        }
      }
      await api.resultadoComando(cmd.id, true, { bytes: jpeg.length, ms: Date.now() - t0 });
    } catch (e) {
      log(`ERROR al tomar/subir la foto (comando ${cmd.id}): ${e.message}`);
      await api.resultadoComando(cmd.id, false, null, e.message.slice(0, 500)).catch(() => {});
      api.log('error', 'photo', `No se pudo capturar: ${e.message}`);
    } finally {
      enCurso.delete(cmd.id);
    }
  }

  // Ordenes ya atendidas, para no repetirlas.
  //
  // Los comandos llegan por DOS caminos: el socket (al momento) y el sondeo de
  // respaldo (por si el socket se cayo). El servidor marca la orden como
  // entregada cuando la reparte por sondeo, y como "en curso" cuando el agente
  // acusa recibo por socket... pero ese acuse llega despues, asi que entre uno y
  // otro el sondeo alcanza a repartir la MISMA orden otra vez. Se vio en el
  // agente de PC: cada foto programada se tomaba y se subia dos veces, el doble
  // de datos por nada. Este agente tiene la misma estructura, asi que le puede
  // pasar igual.
  //
  // `enCurso` no alcanzaba: libera el id al terminar, y la segunda entrega suele
  // llegar despues de que la primera foto ya subio. Esta lista se queda con los
  // ids, acotada para no crecer sin fin.
  const atendidas = new Set();
  const recordar = (id) => {
    atendidas.add(id);
    if (atendidas.size > 500) {
      for (const viejo of atendidas) { atendidas.delete(viejo); if (atendidas.size <= 400) break; }
    }
  };

  async function atender(cmd) {
    // Sin id no se puede saber si es repetida; se atiende y ya (no deberia pasar).
    if (cmd.id) {
      if (atendidas.has(cmd.id)) return;
      recordar(cmd.id);
    }

    switch (cmd.command_type) {
      case 'TAKE_PHOTO':
        return tomarYSubir(cmd);
      case 'START_STREAM': {
        // La camara no puede tomar fotos y transmitir a la vez: es el mismo
        // sensor. Se avisa claro en vez de fallar de forma rara.
        if (enCurso.size) {
          return api.resultadoComando(cmd.id, false, null, 'el equipo esta tomando una foto en este momento');
        }
        try {
          const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
          const info = transmision.iniciar(payload.publish_url, payload);
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
      case 'UPDATE_APP':
        return api.resultadoComando(cmd.id, false, null, 'actualizacion remota todavia no disponible en el agente de Raspberry');
      case 'REBOOT_APP':
        log('reinicio solicitado desde el dashboard');
        await api.resultadoComando(cmd.id, true);
        return process.exit(0); // systemd lo vuelve a levantar
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
        await vaciarCola(api);
      } catch (e) {
        if (e.status === 401) {
          log('token rechazado; volviendo a registrar...');
          try { await api.registrar(datosRegistro); } catch { /* reintenta en el siguiente ciclo */ }
        }
      }
      await dormir(intervaloSondeo);
    }
  })();

  // --- telemetria periodica: mantiene el equipo "en linea" en el dashboard ---
  (async function reportar() {
    let avisoVoltaje = false;
    for (;;) {
      try {
        await api.reportarEstado(tele.recolectar());
        const e = tele.alimentacion();
        if (e?.subvoltaje_ahora && !avisoVoltaje) {
          avisoVoltaje = true;
          api.log('warning', 'power', 'Falta de voltaje: la fuente no alcanza para la Pi 5');
        }
      } catch (e) {
        log(`no pude reportar estado: ${e.message}`);
      }
      await dormir(intervaloEstado);
    }
  })();

  log('agente listo; esperando comandos del dashboard');
}

process.on('unhandledRejection', (e) => log('fallo no controlado:', e?.message || e));

main().catch((e) => {
  log('ERROR FATAL:', e.message);
  process.exit(1);
});
