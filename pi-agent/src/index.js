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
const actualizar = require('./actualizar');
const { Puente } = require('./puente');

// SUBIR SIEMPRE al publicar una version nueva. Si dos paquetes distintos dicen
// la misma version, no hay forma de saber que corre cada sitio -y eso ya costo
// caro en la flota: REVOLUCION 267 llevaba TRES versiones de atraso sin que el
// dashboard lo delatara, porque el numero nunca cambiaba.
const VERSION = '0.7.0';
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

// El servidor rechaza un testigo que no reconoce con un nombre propio, y por eso
// se mira el nombre y no el 401 a secas: un 401 del alta puede ser eso, y
// tambien puede ser cualquier otra cosa del dia que el servidor cambie.
const esTestigoInvalido = (e) => e?.status === 401 && /testigo_de_alta_invalido/.test(e.cuerpo || '');

// La forma que genera el servidor: se_<prefijo de 12>_<secreto de 43>.
const FORMA_TESTIGO = /^se_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/;

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
  // Testigo de alta (SE.6): la credencial que la pantalla de descarga mete en el
  // perfil del equipo. Se acepta tambien con el nombre que usa el servidor, para
  // que un config.json generado del otro lado funcione tal cual.
  cfg.testigo_de_alta = String(cfg.testigo_de_alta || cfg.provision_token || '').trim();
  // El config.json de la Pi se escribe a mano por ssh, que es justo donde un
  // testigo se pega a medias. Se avisa al arrancar -no se calla y no se corrige-:
  // se manda igual para que el servidor lo rechace y el rechazo llegue al
  // dashboard, que es donde se ve el sintoma (un equipo sin dueno).
  if (cfg.testigo_de_alta && !FORMA_TESTIGO.test(cfg.testigo_de_alta)) {
    log('AVISO: testigo_de_alta no tiene la forma que espera el servidor (se_<12>_<43>).');
  }
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
  // --version: lo usa la actualizacion por red para comprobar que el paquete
  // recien bajado es codigo vivo ANTES de reemplazar al que funciona. Tiene que
  // contestar sin tocar la camara, la red ni el archivo de estado.
  if (process.argv.includes('--version')) {
    console.log(VERSION);
    return;
  }

  // Lo PRIMERO, antes de la camara y antes de la red: si venimos de una
  // actualizacion que no logra arrancar, esto la revierte sola. Si se dejara
  // para despues, un fallo al abrir la camara impediria llegar hasta aqui y el
  // equipo quedaria en un ciclo de reinicios que nadie puede romper a distancia.
  const trasActualizar = actualizar.revisarArranque(log);
  actualizar.completar(log);

  const cfg = cargarConfig();
  const estado = cargarEstado();
  const identidad = tele.identidad();
  const camara = new Camara(cfg.camara);
  const api = new Api(cfg.server_url);

  // Cada cuanto habla el equipo cuando NO esta pasando nada. Es casi todo lo que
  // gasta un sitio al mes, asi que los numeros importan:
  //
  //   telemetria cada 60 s + sondeo cada 30 s = ~230 MB/mes de puro "sigo aqui".
  //   telemetria cada 180 s + sondeo cada 300 s = ~40 MB/mes.
  //
  // No se pierde nada: el servidor da por caido a un equipo a los 10 MINUTOS
  // (offline_minutes en telemetry.controller.ts), asi que 3 minutos deja margen
  // de sobra; y las ordenes no llegan por el sondeo sino por el socket, al
  // instante. El sondeo es solo el respaldo por si el socket se cayo... y
  // justamente por eso se acelera cuando eso pasa.
  const intervaloEstado = (cfg.intervalo_estado_seg || 180) * 1000;
  const intervaloSondeo = (cfg.intervalo_sondeo_seg || 300) * 1000;
  const intervaloSondeoCaido = (cfg.intervalo_sondeo_caido_seg || 30) * 1000;

  log(`SPACE EYE — agente de Raspberry Pi v${VERSION}`);
  log(`equipo:    ${identidad.model}`);
  log(`sistema:   ${identidad.os_version}`);
  log(`servidor:  ${cfg.server_url}`);
  // Que quede por escrito en el registro del equipo: quien mira el log de un
  // sitio tiene que poder ver de un vistazo que su consumo se esta cobrando
  // como movil, sin ir a abrir el config.json.
  if (cfg.enlace) log(`enlace:    ${cfg.enlace}${cfg.operador ? ` (${cfg.operador})` : ''} — el consumo se reporta como datos moviles`);
  if (cfg.testigo_de_alta) {
    log(`testigo:   ${FORMA_TESTIGO.test(cfg.testigo_de_alta)
      ? 'presente — este equipo se dara de alta con su dueno'
      : 'presente pero con forma dudosa — el servidor lo va a rechazar'}`);
  }

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
    // Va tal cual lo trae el archivo. El agente NO sabe de quien es -ni tiene
    // por que saberlo-: solo lo entrega.
    provision_token: cfg.testigo_de_alta || undefined,
  };

  let reg = null;
  let sinTestigo = false;
  for (let intento = 1; !reg; intento++) {
    try {
      reg = await api.registrar(datosRegistro);
    } catch (e) {
      // Un testigo que el servidor no reconoce -mal copiado, revocado, de otro
      // servidor- no va a empezar a funcionar por reintentar. Y quedarse en el
      // bucle seria el peor final: el equipo no aparece en NINGUN lado y quien
      // lo instalo ya se fue del sitio. Asi que se da de alta sin el, que es lo
      // mismo que hace un equipo viejo: nace sin dueno, visible para el padre y
      // a la espera de que alguien lo asigne. No hay riesgo de que se cuele en
      // la vista de un cliente ajeno, porque sin dueno no es de nadie.
      if (esTestigoInvalido(e) && datosRegistro.provision_token) {
        delete datosRegistro.provision_token;
        sinTestigo = true;
        log('AVISO: el servidor RECHAZO el testigo de alta de este equipo.');
        log('       Se da de alta SIN dueno; hay que asignarlo desde el dashboard');
        log('       y revisar el testigo que trae el perfil de descarga.');
        continue;
      }
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
  // Que el rechazo no se quede en el log del equipo: el sintoma que se ve desde
  // el dashboard es un equipo sin dueno, y sin esto nadie sabria por que.
  if (sinTestigo) {
    api.log('error', 'startup',
      'El servidor rechazo el testigo de alta: este equipo quedo SIN dueno y hay que asignarlo a mano');
  }

  // Ya nos registramos: la version nueva no solo arranca, tambien habla. Recien
  // ahora se da por buena la actualizacion y se deja de contar intentos.
  if (trasActualizar.pendiente) {
    if (actualizar.confirmar(log)) {
      api.log('info', 'update', `Actualizado a la version ${VERSION} y operando con normalidad`);
    }
  } else if (trasActualizar.revertido) {
    // Que esto llegue al dashboard importa: si no, un equipo que volvio solo a
    // la version anterior se veria "al dia" y nadie sabria que la nueva fallo.
    api.log('error', 'update',
      `La version ${trasActualizar.version} no logró arrancar; el equipo volvió solo a la ${trasActualizar.anterior || 'anterior'}`);
  }
  if (camara.esPrueba()) {
    api.log('warning', 'camera', 'Sin camara conectada: se estan subiendo imagenes de prueba');
  }

  const enCurso = new Set();
  const transmision = new Transmision(log, cfg.stream || {});

  // Vigilancia del loop de la pantalla. Con un solo sensor no se puede mirar
  // mientras se atiende una foto o una transmision, asi que se le da la forma de
  // saberlo: la evidencia y la vista en vivo mandan sobre la vigilancia.
  //
  // La vigilancia es la misma del telefono (fallas de la pantalla y creativos
  // nuevos), en Python con OpenCV; ver src/puente.js. Lo que aprende vive en
  // `pantalla/`, fuera de lo que reemplaza una actualizacion.
  const vigilancia = new Puente({
    camara, api, log,
    ocupada: () => enCurso.size > 0 || transmision.activa(),
    dirEstado: path.join(rutas.BASE, 'pantalla'),
  });
  // Al irse el agente (actualizacion, reinicio) se va tambien monitor.py: si
  // quedara huerfano, el nuevo arrancaria otro y habria dos mirando la camara.
  process.on('exit', () => vigilancia.detener());

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
      // Si la vigilancia esta a mitad de una toma, se la deja terminar: dos
      // capturas a la vez sobre el mismo sensor hacen fallar a las dos.
      await vigilancia.esperarCamara();
      // Encuadre y ajustes de imagen que fija el dashboard por equipo. Viajan en
      // la orden, igual que en los telefonos; antes se llamaba a tomarFoto() sin
      // nada y la Raspberry ignoraba el zoom por completo.
      const jpeg = await camara.tomarFoto({
        zoom: payload.camera_zoom,
        ajustes: payload.camera_ajustes,
      });
      // Si la captura tuvo algo que contar -por ejemplo que no pudo promediar
      // cuadros y fue con un disparo simple-, tiene que llegar al dashboard: si
      // no, la foto sale con lineas y nadie sabe por que.
      const aviso = camara.tomarAviso && camara.tomarAviso();
      if (aviso) {
        log(`camara: ${aviso}`);
        api.log('warning', 'camera', aviso);
      }

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
          // El visor tiene que mostrar el mismo encuadre y el mismo color que va
          // a tener la foto; si no, no sirve para decidir como encuadrar.
          const ajustesArgs = await camara.argumentosDeCaptura({
            zoom: payload.camera_zoom,
            ajustes: payload.camera_ajustes,
          });
          const info = transmision.iniciar(payload.publish_url, { ...payload, ajustesArgs });
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
      case 'UPDATE_APP': {
        // Transmitir y actualizarse a la vez no tiene sentido y deja el visor
        // colgado: se corta la vista en vivo antes de tocar los archivos.
        if (transmision.activa()) transmision.detener('el equipo se va a actualizar');
        try {
          const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
          // Un Space Eye sin PUBLIC_BASE_URL manda la ruta sola ("/space-eye-
          // pi-agent.tar.gz"): se completa con el servidor de este equipo, que
          // es justo de donde hay que bajarla.
          if (payload.url && !/^https?:\/\//i.test(payload.url)) {
            payload.url = new URL(payload.url, cfg.server_url.replace(/\/+$/, '') + '/').toString();
          }
          const r = await actualizar.instalar(payload, log, VERSION);
          if (r.yaEstaba) return api.resultadoComando(cmd.id, true, { ya_estaba: true, version: r.version });

          // Se avisa ANTES de irse: al reiniciar ya no hay quien conteste, y el
          // dashboard se quedaria esperando un resultado que nunca llega.
          await api.resultadoComando(cmd.id, true, { version: r.version, bytes: r.bytes, sistema: r.sistema });
          await api.log('info', 'update', `Instalada la version ${r.version}; reiniciando`);
          return r.arrancar();
        } catch (e) {
          log(`ERROR al actualizar: ${e.message}`);
          api.log('error', 'update', `No se pudo actualizar: ${e.message}`);
          return api.resultadoComando(cmd.id, false, null, e.message.slice(0, 500));
        }
      }
      case 'REBOOT_DEVICE': {
        // Reiniciar la Pi entera: lo que destraba una camara que libcamera dejo
        // colgada o una red que no volvio tras un corte del modem. Es el unico
        // permiso de root del agente ademas de apt (instalar.sh).
        log('reinicio del EQUIPO solicitado desde el dashboard');
        if (transmision.activa()) transmision.detener('el equipo se va a reiniciar');
        // Primero se pregunta si hay permiso (sin hacerlo), para poder contestar
        // un error claro; despues se avisa al servidor y recien entonces se
        // reinicia: con la Pi apagandose ya no sale ninguna respuesta.
        const sudo = (args) => new Promise((resolve) => {
          require('child_process').execFile('sudo', ['-n', ...args], { timeout: 20000 },
            (err, _o, stderr) => resolve(err ? String(stderr || err.message).trim().slice(0, 300) : null));
        });
        const sinPermiso = await sudo(['-l', 'systemctl', 'reboot']);
        if (sinPermiso) {
          log(`no puedo reiniciar el equipo: ${sinPermiso}`);
          return api.resultadoComando(cmd.id, false, null,
            'El equipo no tiene permiso para reiniciarse: falta correr instalar.sh una vez en la Pi');
        }
        await api.resultadoComando(cmd.id, true, { reiniciando: true });
        await api.log('info', 'power', 'Reinicio del equipo pedido desde el panel').catch(() => {});
        const fallo = await sudo(['systemctl', 'reboot']);
        if (fallo) api.log('error', 'power', `No se pudo reiniciar el equipo: ${fallo}`).catch(() => {});
        return;
      }
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
      // Con el socket vivo el sondeo no aporta nada -las ordenes ya llegaron por
      // ahi- y solo gasta datos. Sin el, es el UNICO camino, y entonces si
      // conviene preguntar seguido.
      await dormir(socket.connected ? intervaloSondeo : intervaloSondeoCaido);
    }
  })();

  // --- telemetria periodica: mantiene el equipo "en linea" en el dashboard ---
  let ultimoLatido = Date.now();
  (async function reportar() {
    let avisoVoltaje = false;
    for (;;) {
      try {
        // El resultado del recorrido viaja PEGADO al reporte de estado, no en
        // una peticion propia: son huellas de 64 caracteres y asi detectar un
        // creativo nuevo no le cuesta datos moviles al sitio.
        const resumen = vigilancia.tomarPendiente();
        try {
          await api.reportarEstado({ ...tele.recolectar(cfg), ...(resumen || {}) });
        } catch (e) {
          // Si el reporte no salio, el resumen espera al siguiente.
          vigilancia.devolver(resumen);
          throw e;
        }
        const e = tele.alimentacion();
        if (e?.subvoltaje_ahora && !avisoVoltaje) {
          avisoVoltaje = true;
          api.log('warning', 'power', 'Falta de voltaje: la fuente no alcanza para la Pi 5');
        }
      } catch (e) {
        log(`no pude reportar estado: ${e.message}`);
      }
      // Se marca pase lo que pase: un error de red NO es un cuelgue, y el
      // vigilante de abajo solo debe disparar cuando el ciclo deja de girar.
      ultimoLatido = Date.now();
      await dormir(intervaloEstado);
    }
  })();

  // --- vigilante interno ---
  //
  // systemd tiene Restart=always, pero eso solo cubre que el proceso MUERA. Si
  // Node se queda colgado -una peticion sin respuesta, un promise que nunca
  // resuelve- el proceso sigue vivo, systemd no ve nada raro y el equipo se
  // queda mudo hasta que alguien viaje al sitio. Que es justo lo que este
  // agente ya no deberia necesitar nunca.
  //
  // Si el ciclo de telemetria deja de girar, se sale con error y systemd
  // levanta un proceso limpio. El umbral va holgado (4 vueltas, minimo 10 min)
  // para no reiniciar por una red lenta.
  const TOPE_SIN_LATIDO = Math.max(10 * 60 * 1000, intervaloEstado * 4);
  setInterval(() => {
    const quieto = Date.now() - ultimoLatido;
    if (quieto > TOPE_SIN_LATIDO) {
      log(`VIGILANTE: ${Math.round(quieto / 60000)} min sin reportar estado; reinicio el agente`);
      process.exit(1); // systemd lo vuelve a levantar
    }
  }, 60000).unref();

  // --- vigilancia del loop de la pantalla ---
  // En su propio bucle, no atado al de comandos: un recorrido dura minutos y no
  // debe retrasar una orden del dashboard.
  // Antes, lo que el sistema necesita para vigilar (python3-opencv). Puede
  // tardar minutos la primera vez; el agente ya esta trabajando mientras tanto.
  actualizar.asegurarRequisitos(log)
    .then((r) => {
      if (r.instalados.length) api.log('info', 'update', `Instalado en el equipo: ${r.instalados.join(', ')}`).catch(() => {});
      if (r.faltan.length) api.log('warning', 'update', `Falta en el equipo: ${r.faltan.join(', ')}; la vigilancia de la pantalla no puede correr`).catch(() => {});
    })
    .catch((e) => log(`no pude revisar los requisitos del sistema: ${e.message}`))
    .finally(() => vigilancia.iniciar()
      .then(() => vigilancia.vigilar())
      .catch((e) => log(`vigilancia detenida: ${e?.message || e}`)));

  log('agente listo; esperando comandos del dashboard');
}

process.on('unhandledRejection', (e) => log('fallo no controlado:', e?.message || e));

main().catch((e) => {
  log('ERROR FATAL:', e.message);
  process.exit(1);
});
