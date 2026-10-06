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
const actualizar = require('./actualizar');
const mudanza = require('./mudanza');
const rutas = require('./rutas');

// OJO: subir esto en CADA build que se lleve a un sitio.
//
// Se quedo en 1.0.0 durante tres versiones distintas del programa, y eso costo
// caro: el sitio de REVOLUCION 267 seguia con el binario ORIGINAL -el anterior a
// que existiera la vista en vivo- pero se anunciaba como "pc-agent 1.0.0" igual
// que los demas. El dashboard le ofrecia el boton de transmitir, el agente
// contestaba "vista en vivo no disponible en el agente de PC", y en el navegador
// eso salia como "la camara esta ocupada". Nadie podia saber, mirando el
// dashboard, que ese equipo tenia un programa viejo.
const VERSION = '1.6.0';
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

// El servidor rechaza un testigo que no reconoce con un nombre propio, y por eso
// se mira el nombre y no el 401 a secas: un 401 del alta puede ser eso, y
// tambien puede ser cualquier otra cosa del dia que el servidor cambie.
const esTestigoInvalido = (e) => e?.status === 401 && /testigo_de_alta_invalido/.test(e.cuerpo || '');

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
  // Testigo de alta (SE.6): lo escribe el instalador con lo que venia en el
  // paquete de descarga. Se acepta tambien con el nombre que usa el servidor,
  // para que un config.json generado del otro lado funcione tal cual.
  cfg.testigo_de_alta = String(cfg.testigo_de_alta || cfg.provision_token || '').trim();
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
  // Si venimos de una actualizacion, el programa anterior sigue en la carpeta.
  // Se borra ahora y no antes: mientras este proceso no arranque bien, ese
  // archivo es la unica forma de volver atras.
  actualizar.limpiarAnterior(log);
  log(`servidor: ${cfg.server_url}`);
  log(`camara:   ${cfg.camara.host}:${cfg.camara.puerto || 80} (canal ${cfg.camara.canal || 101})`);
  if (cfg.testigo_de_alta) log('testigo:  presente — este equipo se dara de alta con su dueno');

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
    // Va tal cual lo trae el archivo. El agente NO sabe de quien es -ni tiene
    // por que saberlo-: solo lo entrega y el servidor estampa el dueno.
    provision_token: cfg.testigo_de_alta || undefined,
    // Desde la 1.6.0: el codigo de vinculacion que dio SPACE OS (lo escribe el
    // asistente). Solo cuenta la primera vez.
    codigo_vinculacion: cfg.codigo_vinculacion || undefined,
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
      // lo instalo ya se fue del sitio. Asi que se da de alta sin el, igual que
      // un equipo viejo: nace sin dueno, visible para el padre y a la espera de
      // que alguien lo asigne. No hay riesgo de que se cuele en la vista de un
      // cliente ajeno, porque sin dueno no es de nadie.
      if (esTestigoInvalido(e) && datosRegistro.provision_token) {
        delete datosRegistro.provision_token;
        sinTestigo = true;
        log('AVISO: el servidor RECHAZO el testigo de alta de este equipo.');
        log('       Se da de alta SIN dueno; hay que asignarlo desde el dashboard');
        log('       y revisar el testigo que trae el paquete de descarga.');
        continue;
      }
      // El Space Eye de una empresa no deja entrar a un equipo nuevo sin un
      // codigo vigente: se avisa claro y se reintenta cada 5 min, por si
      // mientras tanto le ponen un codigo nuevo en config.json.
      if (e?.status === 403 && /vinculacion_requerida|codigo_invalido/.test(e.cuerpo || '')) {
        log(/codigo_invalido/.test(e.cuerpo || '')
          ? 'AVISO: el servidor RECHAZO el codigo de vinculacion (vencido, ya usado o cancelado).'
          : 'AVISO: este equipo es nuevo y no trae codigo de vinculacion.');
        log('       Genera uno en SPACE OS > Space Eyes > Agregar dispositivo > PC y vuelve a');
        log('       abrir el asistente. Reintento en 5 min.');
        await dormir(5 * 60 * 1000);
        try { datosRegistro.codigo_vinculacion = JSON.parse(fs.readFileSync(rutas.config, 'utf8')).codigo_vinculacion || undefined; } catch { /* sigue */ }
        continue;
      }
      // Recien mudado y el servidor nuevo no responde: pasado el plazo, de
      // vuelta al anterior en vez de quedarse mudo (ver src/mudanza.js).
      if (mudanza.vencida(cfg)) {
        const m = mudanza.revertir(cfg);
        log(`MUDANZA: el servidor nuevo no respondio en el plazo; regreso a ${m.anterior}`);
        return process.exit(1);
      }
      const espera = Math.min(60, intento * 10);
      log(`no pude registrarme (intento ${intento}): ${e.message}`);
      log(`  -> reintento en ${espera}s. Revisa server_url en config.json y la conexion.`);
      await dormir(espera * 1000);
    }
  }
  estado.device_id = reg.device_id;
  guardarEstado(estado);
  log(`registrado como equipo #${reg.device_id} (uid ${uid})`);
  if (mudanza.pendiente(cfg)) log(`MUDANZA: estrenando ${cfg.server_url} (antes ${cfg.mudanza.anterior}); se confirma con el primer reporte`);
  if (cfg.mudanza_fallida) {
    const f = cfg.mudanza_fallida;
    api.log('error', 'mudanza', `La mudanza a ${f.a} no se completo: el servidor nuevo no respondio y el equipo regreso solo a este`).catch(() => {});
    mudanza.escribirConfig({ mudanza_fallida: undefined });
    delete cfg.mudanza_fallida;
  }
  api.log('info', 'startup', `Agente de PC v${VERSION} iniciado en ${os.hostname()}`);
  // Que el rechazo no se quede en el log de la PC del sitio: el sintoma que se ve
  // desde el dashboard es un equipo sin dueno, y sin esto nadie sabria por que.
  if (sinTestigo) {
    api.log('error', 'startup',
      'El servidor rechazo el testigo de alta: este equipo quedo SIN dueno y hay que asignarlo a mano');
  }

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

  // Ordenes ya atendidas, para no repetirlas.
  //
  // Los comandos llegan por DOS caminos: el socket (al momento) y el sondeo de
  // respaldo (por si el socket se cayo). El servidor marca la orden como
  // entregada cuando la reparte por sondeo, y como "en curso" cuando el agente
  // acusa recibo por socket... pero ese acuse llega despues, asi que entre uno y
  // otro el sondeo alcanza a repartir la MISMA orden otra vez. Resultado medido
  // en REVOLUCION 267: cada foto programada se tomaba y se subia dos veces, el
  // doble de datos por nada.
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
        try {
          const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
          // Se espera a que la transmision arranque de verdad antes de contestar:
          // asi el dashboard recibe el motivo del fallo (falta ffmpeg, la camara
          // rechazo la clave...) en vez de un "OK" que termina en 40 s de espera.
          const info = await transmision.iniciar(payload.publish_url);
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
        try {
          const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
          // Transmitir mientras se reemplaza el programa no tiene sentido: el
          // proceso se va a ir en unos segundos.
          transmision.detener('actualizacion del agente');
          const r = await actualizar.instalar(payload, log, VERSION);

          // Se avisa ANTES de reiniciar: si el agente se fuera primero, el
          // dashboard esperaria un resultado que ya nadie va a mandar.
          await api.resultadoComando(cmd.id, true, { version: r.version, ya_estaba: !!r.yaEstaba });
          if (r.yaEstaba) return;

          api.log('info', 'update', `Actualizado a la version ${r.version}`);
          const ok = await r.arrancar();
          if (ok) process.exit(0);   // el nuevo ya esta corriendo; este sobra
          return;                    // se volvio al anterior: este sigue trabajando
        } catch (e) {
          log(`ERROR al actualizar: ${e.message}`);
          api.log('error', 'update', `No se pudo actualizar: ${e.message}`);
          return api.resultadoComando(cmd.id, false, null, e.message.slice(0, 500));
        }
      }
      case 'UPDATE_CONFIG': {
        const payload = typeof cmd.payload === 'string' ? JSON.parse(cmd.payload || '{}') : (cmd.payload || {});
        if (!payload.mudanza) return api.resultadoComando(cmd.id, true, { ignorado: 'UPDATE_CONFIG' });
        try {
          if (transmision.activa && transmision.activa()) transmision.detener('el equipo se muda de servidor');
          const r = await mudanza.preparar({ payload: payload.mudanza, cfg, datosRegistro, Api });
          log(`MUDANZA: listo para ${r.servidor} (equipo #${r.device_id} alla); reiniciando`);
          await api.resultadoComando(cmd.id, true, { mudanza: r.servidor, device_id_nuevo: r.device_id });
          await api.log('info', 'mudanza', `El equipo se muda a ${r.servidor}`).catch(() => {});
          return process.exit(0);
        } catch (e) {
          log(`MUDANZA: no se hizo (${e.message})`);
          api.log('error', 'mudanza', `No se pudo mudar: ${e.message}`).catch(() => {});
          return api.resultadoComando(cmd.id, false, null, `No se pudo mudar: ${e.message}`.slice(0, 500));
        }
      }
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
          // Los mismos datos del alta, no una copia escrita a mano: esa copia ya
          // se habia quedado atras -sin el recorte de os_version- y ahora
          // ademas dejaria fuera el testigo.
          try { await api.registrar(datosRegistro); } catch { /* reintenta en el siguiente ciclo */ }
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
        const m = mudanza.confirmar(cfg);
        if (m) {
          log(`MUDANZA: confirmada en ${cfg.server_url}`);
          api.log('info', 'mudanza', `Equipo mudado desde ${m.anterior}`).catch(() => {});
        }
        if (!viva) api.log('warning', 'camera', 'La camara no responde en la red local');
      } catch (e) {
        log(`no pude reportar estado: ${e.message}`);
        if (mudanza.vencida(cfg)) {
          const m = mudanza.revertir(cfg);
          log(`MUDANZA: sin reportar en ${cfg.server_url} en el plazo; regreso a ${m.anterior}`);
          process.exit(1);
        }
      }
      await dormir(intervaloEstado);
    }
  })();

  log('agente listo; esperando comandos del dashboard');
}

/**
 * Prueba de la vista en vivo, para hacerla en el sitio.
 *
 * Lee la camara igual que lo haria una transmision real, pero SIN publicar nada
 * en el servidor: dice si ffmpeg esta, si la camara acepta el RTSP y que
 * entrega cada canal. Asi quien va al sitio confirma en unos segundos, frente a
 * la camara, en vez de depender de que el dashboard responda.
 */
async function probarStream() {
  const { hayFfmpegVecino, rutaVecina, buscarFfmpeg } = require('./transmision');
  const cfg = cargarConfig();

  console.log('');
  console.log('  ===========================================');
  console.log('   SPACE EYE — prueba de la vista en vivo');
  console.log('  ===========================================');
  console.log('');
  console.log(`  Camara: ${cfg.camara.host}:${cfg.camara.puerto_rtsp || 554} (RTSP)`);

  if (hayFfmpegVecino()) {
    console.log(`  ffmpeg: ${buscarFfmpeg()}`);
  } else {
    console.log('');
    console.log('  AVISO: no hay ffmpeg.exe junto al agente.');
    console.log(`         Deberia estar en: ${rutaVecina()}`);
    console.log(`         Probare con "${buscarFfmpeg()}" del PATH, pero si tampoco`);
    console.log('         esta ahi, la vista en vivo NO va a funcionar en este sitio.');
    console.log('         (Las fotos si funcionan: no usan ffmpeg.)');
  }

  const transmision = new Transmision((m) => console.log(`  ${m}`), cfg.camara);
  console.log('\n  Probando... (unos segundos por canal)\n');

  const resultados = await transmision.probar(6);
  let alguno = false;

  for (const r of resultados) {
    const cual = r.canal === 101 ? 'principal' : r.canal === 102 ? 'secundario' : 'extra';
    if (r.ok) {
      alguno = true;
      const detalle = [r.resolucion, r.codec, r.fps ? `${r.fps} fps` : null, r.tasa]
        .filter(Boolean).join('  ');
      console.log(`  [OK]    canal ${r.canal} (${cual}):  ${detalle}   ${r.cuadros} cuadros`);
    } else {
      console.log(`  [FALLA] canal ${r.canal} (${cual}):  ${r.error}`);
    }
  }

  console.log('');
  if (alguno) {
    const bueno = resultados.find((r) => r.ok);
    console.log('  LA VISTA EN VIVO VA A FUNCIONAR.');
    console.log(`  Se usara el canal ${bueno.canal}${bueno.canal === 102 ? ' (secundario: gasta mucha menos subida)' : ''}.`);
    if (bueno.canal === 101 && resultados.some((r) => r.canal === 102 && !r.ok)) {
      console.log('');
      console.log('  Ojo: el canal secundario (102) no respondio. Es el que ahorra datos.');
      console.log('  Si el sitio va por modem LTE, conviene habilitarlo en la camara:');
      console.log('  entra a http://' + cfg.camara.host + ' -> Configuracion -> Video -> Sub-stream.');
    }
  } else {
    console.log('  LA VISTA EN VIVO NO VA A FUNCIONAR TODAVIA.');
    console.log('  Que hacer, segun lo que dice arriba:');
    console.log('   - no encuentro ffmpeg  -> copia ffmpeg.exe junto a este programa.');
    console.log('   - usuario o clave      -> son las de entrar a http://' + cfg.camara.host);
    console.log('                             desde el navegador, NO las de Hik-Connect.');
    console.log('   - no contesto          -> revisa la IP y que la camara este encendida.');
    console.log('   - RTSP cerrado         -> habilitalo en la camara: Configuracion ->');
    console.log('                             Red -> Avanzada -> Protocolos (puerto 554).');
    console.log('   - ese canal no existe  -> habilita el sub-stream en la camara, o quita');
    console.log('                             "canal_stream" de config.json.');
    console.log('');
    console.log('  Las FOTOS no dependen de nada de esto: si el equipo ya aparece en el');
    console.log('  dashboard, siguen funcionando aunque el video en vivo no.');
  }
  console.log('');
}

process.on('unhandledRejection', (e) => log('fallo no controlado:', e?.message || e));

// Como lo abran decide que hace:
//   --servicio       -> corre el agente (asi lo lanza la tarea de Windows)
//   --desinstalar    -> quita el arranque automatico
//   --probar-stream  -> prueba la vista en vivo sin tocar el servidor
//   doble clic       -> asistente de instalacion, o el agente si ya esta configurado
const flags = process.argv.slice(2);
const { asistente, desinstalar, menu, pausar } = require('./instalar');
const { asistenteWeb } = require('./asistente-web');

// Con ventanas o en la consola.
//
// La instalacion NORMAL -doble clic en el sitio- abre una pagina en el
// navegador: quien va a instalar no siempre es una persona tecnica, y una
// ventana negra con texto se lee como un error aunque todo haya salido bien.
//
// La consola se conserva para dos casos donde es lo correcto: la instalacion
// DESATENDIDA por parametros (varios sitios de golpe, sin navegador de por
// medio) y `--consola`, por si en alguna PC el navegador no abre.
function instalacion() {
  const desatendida = flags.includes('--camara') && flags.includes('--clave');
  if (flags.includes('--consola') || desatendida) return asistente();
  return asistenteWeb();
}

// Candado de instancia unica.
//
// El agente arranca solo con la PC (tarea de Windows). Si ademas alguien abre el
// programa a mano y elige "arrancar", quedan DOS agentes en la misma PC: los dos
// se conectan, los dos reciben cada orden y los dos suben su propia foto. Se vio
// en REVOLUCION 267, que reportaba 120 veces por hora en vez de 60 y subia cada
// foto por duplicado: el doble de datos y la galeria llena de fotos repetidas.
//
// Se resuelve apartando un puerto local: solo un proceso puede tenerlo. No se
// usa un archivo de bloqueo porque si la PC se apaga de golpe queda ahi tirado y
// el agente ya no vuelve a arrancar nunca.
const PUERTO_CANDADO = 47713;

function tomarCandado() {
  return new Promise((resolve) => {
    const net = require('net');
    const servidor = net.createServer();
    servidor.once('error', (e) => resolve(e.code !== 'EADDRINUSE'));
    servidor.once('listening', () => {
      servidor.unref(); // que no impida al proceso terminar
      resolve(true);
    });
    servidor.listen(PUERTO_CANDADO, '127.0.0.1');
  });
}

// Arranca el agente. Si lo lanzo una persona (no la tarea de Windows) y algo
// falla, la ventana NO se cierra de golpe: antes un dato mal escrito hacia que
// el programa se cerrara al instante y no habia forma de corregirlo.
async function arrancar(interactivo) {
  if (!(await tomarCandado())) {
    log('ya hay otro agente corriendo en esta PC: este no arranca');
    if (interactivo) {
      console.log('\n  Ya hay un agente funcionando en esta PC.');
      console.log('  No hace falta abrirlo otra vez: arranca solo con Windows.');
      console.log('  (Si abrieras dos, cada foto se subiria por duplicado.)');
      pausar();
    }
    return;
  }

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

// --version es la prueba de vida de la actualizacion por red: antes de sustituir
// el programa, el agente viejo arranca el nuevo con esta bandera para comprobar
// que es un ejecutable sano. Tiene que imprimir la version y salir con 0, sin
// tocar nada mas (ni configuracion, ni red).
if (flags.includes('--version') || flags.includes('-v')) {
  console.log(VERSION);
  process.exit(0);
}

if (flags.includes('--desinstalar')) {
  desinstalar();
} else if (flags.includes('--instalar') || flags.includes('--configurar')) {
  instalacion().catch((e) => { console.error('Fallo la instalacion:', e.message); process.exit(1); });
} else if (flags.includes('--probar-stream')) {
  probarStream()
    .catch((e) => console.log(`\n  No pude completar la prueba: ${e.message}\n`))
    .finally(() => pausar());
} else if (flags.includes('--servicio')) {
  arrancar(false);
} else if (fs.existsSync(RUTA_CONFIG)) {
  // Doble clic con configuracion existente: se ofrece corregirla.
  let cfgActual = {};
  try { cfgActual = JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8')); } catch (_) {}
  menu(cfgActual)
    .then((accion) => {
      if (accion === 'arrancar') arrancar(true);
      else if (accion === 'probar') {
        probarStream()
          .catch((e) => console.log(`\n  No pude completar la prueba: ${e.message}\n`))
          .finally(() => pausar());
      }
    })
    .catch((e) => { console.error('Error:', e.message); pausar(); });
} else {
  instalacion().catch((e) => {
    console.error('Fallo la instalacion:', e.message);
    process.exit(1);
  });
}
