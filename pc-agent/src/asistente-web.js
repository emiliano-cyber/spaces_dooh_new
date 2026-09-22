// pc-agent/src/asistente-web.js
// El asistente de instalacion, con ventanas.
//
// POR QUE
// -------
// El asistente de consola pide los datos bien, pero quien va al sitio no
// siempre es una persona tecnica: una ventana negra con texto se lee como un
// error incluso cuando todo salio bien. Y lo peor es que el resultado se juzga
// mal: en REVOLUCION la instalacion decia "OK" tres veces y "no pude registrar
// el arranque automatico" una, en medio del texto, y se dio por buena. El
// equipo moria al primer reinicio.
//
// Aqui la instalacion es una pagina: un formulario, un boton para probar la
// camara que MUESTRA la foto -no que diga en que carpeta la guardo-, y al final
// un tablero con un renglon por cosa y su palomita o su tache.
//
// POR QUE EL NAVEGADOR Y NO UNA VENTANA DE VERDAD
// -----------------------------------------------
// Porque no cuesta nada. Una interfaz nativa en Windows obligaria a Electron
// (+100 MB sobre los 82 que ya pesa) o a generar PowerShell con Windows Forms,
// que es fragil y no se puede probar. El navegador ya esta instalado en toda
// PC, el HTML se puede leer y corregir, y el ejecutable no engorda ni un byte:
// el servidor se levanta con el modulo `http` que Node ya trae dentro.
//
// SEGURIDAD
// ---------
// El servidor escucha SOLO en 127.0.0.1 y en un puerto al azar, pero eso no
// alcanza: cualquier pagina abierta en el mismo navegador podria mandarle una
// peticion y disparar una instalacion. Por eso cada peticion tiene que traer un
// testigo secreto que se genera al arrancar y viaja en la URL que se abre, y se
// comprueba la cabecera Host para que no sirva por otro nombre. Al terminar, el
// servidor se cierra.
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const rutas = require('./rutas');
const { Camara } = require('./camera');
const { hayFfmpegVecino, rutaVecina } = require('./transmision');
const inst = require('./instalar');

// Si nadie contesta el formulario, no se deja un servidor abierto para siempre.
const INACTIVIDAD_MS = 30 * 60 * 1000;

function abrirNavegador(url) {
  // `start` es del interprete de comandos, no un programa: hay que invocarlo a
  // traves de cmd. El primer argumento vacio es el TITULO de la ventana; sin el,
  // cmd toma la URL como titulo y no abre nada.
  execFile('cmd', ['/c', 'start', '', url], (e) => {
    if (e) {
      console.log(`  No pude abrir el navegador solo. Abre esta direccion a mano:\n  ${url}`);
    }
  });
}

function json(res, codigo, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
    'Cache-Control': 'no-store',
  });
  res.end(cuerpo);
}

function leerCuerpo(req, limite = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const trozos = [];
    req.on('data', (d) => {
      total += d.length;
      if (total > limite) { reject(new Error('cuerpo demasiado grande')); req.destroy(); return; }
      trozos.push(d);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('el navegador mando algo que no es JSON')); }
    });
    req.on('error', reject);
  });
}

// --- Los tres pasos, cada uno como una operacion aparte --------------------
//
// Se separan a proposito: asi la pagina puede probar la camara tantas veces como
// haga falta -cambiando la IP, la clave o el canal- sin escribir nada en disco.
// Nada se guarda hasta que la persona ve la foto y aprieta Instalar.

async function probarServidor(servidor) {
  const base = String(servidor || '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/app/version`, { signal: AbortSignal.timeout(15000) });
    // 401 = responde pero pide sesion: es exactamente lo que se espera aqui.
    if (res.status === 401 || res.ok) return { ok: true, mensaje: 'El servidor responde.' };
    return { ok: false, mensaje: `Respondio HTTP ${res.status}. Revisa la direccion.` };
  } catch (e) {
    return { ok: false, mensaje: `No pude contactarlo: ${e.message}` };
  }
}

// CUIDADO con la palabra: en este archivo "testigo" a secas es el del navegador
// (el que impide que otra pestana dispare una instalacion). El de alta -la
// credencial que le pone dueno al equipo- se llama SIEMPRE testigoDeAlta.
function configDesde(d) {
  const { host, puerto } = inst.partirHost(String(d.camara || '').trim(), 80);
  const { testigo: testigoDeAlta } = inst.resolverTestigo(d.testigo_alta);
  return {
    server_url: String(d.servidor || inst.SERVIDOR_POR_DEFECTO).replace(/\/+$/, ''),
    // Solo si es legible: escribir uno roto seria dejar al agente reintentando
    // contra un rechazo seguro.
    ...(inst.pareceTestigo(testigoDeAlta) ? { testigo_de_alta: testigoDeAlta } : {}),
    camara: {
      host,
      puerto,
      usuario: String(d.usuario || 'admin'),
      clave: String(d.clave || ''),
      canal: Number(d.canal) || 101,
      canal_stream: Number(d.canal_stream) || 102,
      puerto_rtsp: Number(d.puerto_rtsp) || 554,
      timeout_ms: 15000,
    },
    intervalo_estado_seg: 60,
    intervalo_sondeo_seg: 30,
  };
}

async function probarCamara(d) {
  const cfg = configDesde(d);
  if (!cfg.camara.host) return { ok: false, mensaje: 'Falta la IP de la camara.' };
  if (!cfg.camara.clave) return { ok: false, mensaje: 'Falta la clave de la camara.' };

  const cam = new Camara(cfg.camara);
  let modelo = null;
  let firmware = null;
  try {
    const info = await cam.infoDispositivo();
    modelo = info?.modelo || null;
    firmware = info?.firmware || null;
  } catch (_) { /* la foto es la prueba que manda; el modelo es un adorno */ }

  try {
    const jpeg = await cam.tomarFoto();
    // La foto viaja al navegador y se PINTA. Se guarda tambien junto al programa,
    // como antes, para quien quiera abrirla con otra cosa.
    try { fs.writeFileSync(require('path').join(rutas.BASE, 'prueba.jpg'), jpeg); } catch (_) {}
    return {
      ok: true,
      modelo,
      firmware,
      kb: Math.round(jpeg.length / 1024),
      foto: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    };
  } catch (e) {
    return {
      ok: false,
      mensaje: e.message,
      pistas: [
        `Que ${cfg.camara.host} sea la IP correcta: abrela en el navegador de esta PC.`,
        'Que el usuario y la clave sean los DE LA CAMARA, no los de Hik-Connect.',
        'Que esta PC y la camara esten en la misma red.',
      ],
    };
  }
}

function instalar(d) {
  // Un testigo escrito a mano y mal copiado se atrapa AQUI, con la persona
  // enfrente de la pantalla. Si se dejara pasar, el equipo se daria de alta sin
  // dueno y eso no se ve hasta dias despues, desde el dashboard, cuando ya nadie
  // esta en el sitio. El aviso de la pagina se calcula al abrirla y no puede
  // saber lo que se escribio despues.
  const aMano = String(d.testigo_alta || '').trim();
  if (aMano && !inst.pareceTestigo(aMano)) {
    return { error: `El testigo de alta "${inst.testigoParaVer(aMano)}" no tiene la forma que espera el servidor (se_...). Copialo completo o dejalo vacio.` };
  }

  const cfg = configDesde(d);
  fs.writeFileSync(rutas.config, JSON.stringify(cfg, null, 2));

  // Sustituir un equipo en vez de crear uno nuevo. El uid viejo se saca de la
  // base (`SELECT device_uid FROM devices WHERE id = <equipo>`) y con esto el
  // sitio conserva galeria, ajustes, marca y campanas.
  let identidad = null;
  const uid = String(d.uid || '').trim();
  if (uid) {
    if (!/^pc-[0-9a-f]{8,}$/i.test(uid)) return { error: `"${uid}" no parece un uid de agente de PC (se esperaba pc-...).` };
    fs.writeFileSync(rutas.estado, JSON.stringify({ device_uid: uid }, null, 2));
    identidad = uid;
  }

  if (!inst.esAdministrador()) {
    return {
      camara: true,
      identidad,
      tarea: null,
      admin: false,
      ffmpeg: hayFfmpegVecino(),
      motivo: 'Hace falta abrir el programa como administrador para registrar el arranque.',
    };
  }

  let tarea = null;
  let motivo = '';
  try {
    inst.instalarTarea();
    tarea = 'completo';
  } catch (e) {
    motivo = inst.primeraLinea(e);
    try { inst.instalarTareaSimple(); tarea = 'simple'; } catch (e2) { motivo = inst.primeraLinea(e2); }
  }
  // Que el comando no diera error no prueba que la tarea exista.
  if (tarea && !inst.tareaRegistrada()) { tarea = null; motivo = 'el comando no fallo pero la tarea no quedo registrada'; }
  if (tarea) { try { inst.arrancarTarea(); } catch (_) { /* existe; arrancara sola */ } }

  return {
    camara: true,
    identidad,
    tarea,
    admin: true,
    ffmpeg: hayFfmpegVecino(),
    motivo,
    comando: `schtasks /Create /F /TN "${inst.TAREA}" /TR "\\"${rutas.ejecutable}\\" --servicio" /SC MINUTE /MO 10 /RU SYSTEM /RL HIGHEST`,
  };
}

function pagina(testigo, datos) {
  const j = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPACE EYE — instalar el agente</title>
<style>
 :root{--az:#0A66FF;--ok:#15803d;--mal:#b91c1c;--bd:#e5e5e5;--tx:#171717;--gr:#737373}
 *{box-sizing:border-box}
 body{margin:0;background:#f5f5f5;color:var(--tx);font:15px/1.5 "Segoe UI",system-ui,sans-serif}
 .caja{max-width:760px;margin:0 auto;padding:24px 16px 64px}
 h1{font-size:22px;margin:0 0 4px}
 .sub{color:var(--gr);margin:0 0 24px}
 .tarjeta{background:#fff;border:1px solid var(--bd);border-radius:12px;padding:20px;margin-bottom:16px}
 .tarjeta h2{font-size:15px;margin:0 0 14px;display:flex;align-items:center;gap:8px}
 .num{background:var(--az);color:#fff;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;flex:none}
 label{display:block;font-size:13px;color:var(--gr);margin:12px 0 4px}
 input{width:100%;padding:10px 12px;border:1px solid #d4d4d4;border-radius:8px;font-size:15px;font-family:inherit}
 input:focus{outline:2px solid var(--az);outline-offset:-1px;border-color:var(--az)}
 .fila{display:flex;gap:12px}.fila>div{flex:1}
 button{background:var(--az);color:#fff;border:0;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
 button:disabled{opacity:.5;cursor:default}
 button.sec{background:#fff;color:var(--tx);border:1px solid #d4d4d4;font-weight:400}
 .aviso{background:#fffbeb;border:1px solid #fde68a;color:#78350f;padding:12px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
 .res{margin-top:14px;padding:12px 14px;border-radius:8px;font-size:14px;display:none}
 .res.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:var(--ok);display:block}
 .res.mal{background:#fef2f2;border:1px solid #fecaca;color:var(--mal);display:block}
 .res ul{margin:8px 0 0;padding-left:20px}
 img.foto{width:100%;border-radius:8px;border:1px solid var(--bd);margin-top:12px;display:block}
 .avanzado summary{cursor:pointer;color:var(--az);font-size:13px;margin-top:14px}
 .tablero{list-style:none;padding:0;margin:0}
 .tablero li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f0f0f0;align-items:flex-start}
 .tablero li:last-child{border:0}
 .mk{font-weight:700;flex:none;width:20px;text-align:center}
 .mk.si{color:var(--ok)}.mk.no{color:var(--mal)}
 code{background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:12px;word-break:break-all;display:inline-block}
 .cmd{background:#171717;color:#e5e5e5;padding:12px;border-radius:8px;font:12px/1.6 Consolas,monospace;word-break:break-all;margin-top:8px}
 .oculto{display:none}
</style></head><body><div class="caja">

<h1>Instalar el agente SPACE EYE</h1>
<p class="sub">Para sitios con camara IP fija en lugar de telefono.</p>

<div class="aviso"><b>Las credenciales son las de la camara</b> — las que usas para entrar a
<code>http://IP-de-la-camara</code> desde el navegador. <b>No son las de Hik-Connect.</b>
Es el error mas comun y es lo que hace fallar la instalacion.</div>

<div id="admin" class="aviso oculto"><b>Falta abrir como administrador.</b>
Cierra esta ventana, haz <b>clic derecho</b> sobre <code>SpaceEyeAgente.exe</code> y elige
<b>Ejecutar como administrador</b>. Sin eso se puede configurar la camara, pero el agente
no arrancara solo cuando se reinicie la PC.</div>

<form id="f" onsubmit="return false">
<div class="tarjeta">
  <h2><span class="num">1</span> Datos de la camara</h2>
  <label>IP de la camara en la red local</label>
  <input id="camara" placeholder="192.168.1.100" autocomplete="off">
  <div class="fila">
    <div><label>Usuario</label><input id="usuario" value="admin" autocomplete="off"></div>
    <div><label>Clave</label><input id="clave" type="password" autocomplete="off"></div>
  </div>
  <details class="avanzado"><summary>Opciones avanzadas</summary>
    <label>Servidor SPACE EYE</label><input id="servidor">
    <div class="fila">
      <div><label>Canal de fotos</label><input id="canal" value="101"></div>
      <div><label>Canal de vista en vivo</label><input id="canal_stream" value="102"></div>
    </div>
    <label>Sustituir un equipo existente (uid)</label>
    <input id="uid" placeholder="pc-... — dejalo vacio para dar de alta un equipo nuevo" autocomplete="off">
    <label>Testigo de alta</label>
    <div id="alta" class="sub" style="margin:0 0 6px"></div>
    <input id="testigo_alta" placeholder="se_... — dejalo vacio si el paquete ya lo trae" autocomplete="off">
  </details>
</div>

<div class="tarjeta">
  <h2><span class="num">2</span> Probar antes de instalar</h2>
  <p class="sub" style="margin:0">Se prueba primero: es preferible fallar aqui, contigo enfrente de la
  camara, que dejar instalado algo que no funciona.</p>
  <div style="margin-top:14px"><button id="bProbar">Probar camara</button></div>
  <div id="rProbar" class="res"></div>
  <img id="foto" class="foto oculto" alt="Foto de prueba de la camara">
</div>

<div class="tarjeta">
  <h2><span class="num">3</span> Instalar</h2>
  <p class="sub" style="margin:0">Se habilita cuando la camara responda y hayas visto la foto.</p>
  <div style="margin-top:14px"><button id="bInstalar" disabled>Instalar</button></div>
</div>
</form>

<div id="final" class="tarjeta oculto"></div>

<script>
const T = ${j(testigo)};
const D = ${j(datos)};
const $ = (id) => document.getElementById(id);
$('servidor').value = D.servidor;
if (D.cfg) {
  $('camara').value = D.cfg.host || '';
  $('usuario').value = D.cfg.usuario || 'admin';
  $('canal').value = D.cfg.canal || 101;
  $('canal_stream').value = D.cfg.canal_stream || 102;
}
if (!D.admin) $('admin').classList.remove('oculto');
// El dueno es lo que separa a un cliente de otro, asi que se dice en pantalla
// ANTES de instalar: descubrirlo despues obliga a volver al sitio o a corregirlo
// a mano en el dashboard.
$('alta').innerHTML = D.alta.valido
  ? 'Este equipo se dara de alta <b>con su dueno</b>. Testigo: <code>' + D.alta.visible + '</code> (' + D.alta.origen + ').'
  : (D.alta.visible
      ? '<b>El testigo que encontre no tiene la forma correcta</b> (<code>' + D.alta.visible + '</code>). Revisa el archivo <code>' + D.alta.archivo + '</code> o pega uno aqui.'
      : 'No encontre ningun testigo (<code>' + D.alta.archivo + '</code> junto al programa). El equipo quedara <b>sin dueno</b> hasta que se le asigne desde el dashboard.');

const datos = () => ({
  servidor: $('servidor').value.trim(), camara: $('camara').value.trim(),
  usuario: $('usuario').value.trim(), clave: $('clave').value,
  canal: $('canal').value, canal_stream: $('canal_stream').value, uid: $('uid').value.trim(),
  testigo_alta: $('testigo_alta').value.trim(),
});

async function pedir(ruta, cuerpo) {
  const r = await fetch(ruta + '?t=' + encodeURIComponent(T), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return r.json();
}

$('bProbar').onclick = async () => {
  const b = $('bProbar'), caja = $('rProbar');
  b.disabled = true; b.textContent = 'Probando...';
  caja.className = 'res'; caja.textContent = ''; $('foto').classList.add('oculto');
  try {
    const s = await pedir('/probar-servidor', datos());
    const c = await pedir('/probar-camara', datos());
    if (c.ok) {
      caja.className = 'res ok';
      caja.innerHTML = '<b>La camara responde.</b>' +
        (c.modelo ? ' Detectada: ' + c.modelo + (c.firmware ? ' (firmware ' + c.firmware + ')' : '') : '') +
        '<br>Foto de ' + c.kb + ' KB. <b>Mirala y confirma que el encuadre de la pantalla es el correcto.</b>' +
        (s.ok ? '' : '<br><br>Ojo: ' + s.mensaje + ' El agente reintenta solo cuando haya red.');
      $('foto').src = c.foto; $('foto').classList.remove('oculto');
      $('bInstalar').disabled = false;
    } else {
      caja.className = 'res mal';
      caja.innerHTML = '<b>No pude tomar la foto.</b><br>' + c.mensaje +
        (c.pistas ? '<ul>' + c.pistas.map(p => '<li>' + p + '</li>').join('') + '</ul>' : '');
      $('bInstalar').disabled = true;
    }
  } catch (e) {
    caja.className = 'res mal'; caja.textContent = 'Fallo la prueba: ' + e.message;
  }
  b.disabled = false; b.textContent = 'Probar camara';
};

$('bInstalar').onclick = async () => {
  const b = $('bInstalar');
  b.disabled = true; b.textContent = 'Instalando...';
  const r = await pedir('/instalar', datos());
  const caja = $('final');
  if (r.error) {
    caja.className = 'tarjeta'; caja.innerHTML = '<div class="res mal">' + r.error + '</div>';
    b.disabled = false; b.textContent = 'Instalar';
    return;
  }
  const li = (ok, txt) => '<li><span class="mk ' + (ok ? 'si">OK' : 'no">X') + '</span><span>' + txt + '</span></li>';
  let h = '<h2 style="font-size:18px">' + (r.tarea ? 'Listo' : 'Instalacion a medias') + '</h2><ul class="tablero">';
  h += li(true, 'Camara conectada y probada');
  h += li(true, 'Configuracion guardada');
  if (r.identidad) h += li(true, 'Sustituye al equipo <code>' + r.identidad + '</code>: conserva galeria, ajustes y campanas');
  h += li(!!r.tarea, r.tarea
    ? 'Arranca solo con Windows' + (r.tarea === 'simple'
        ? ' (registro sencillo: tras encender la PC puede tardar hasta 10 minutos en arrancar)' : '')
    : 'NO arranca solo con Windows' + (r.motivo ? ' — ' + r.motivo : ''));
  h += li(r.ffmpeg, r.ffmpeg
    ? 'ffmpeg.exe presente: hay vista en vivo'
    : 'Falta ffmpeg.exe: no habra vista en vivo (las fotos si funcionan)');
  h += '</ul>';
  if (!r.tarea) {
    h += '<p style="margin-top:16px"><b>Para completarla:</b> abre CMD como administrador y pega esta linea.</p>' +
         '<div class="cmd">' + r.comando.replace(/</g, '&lt;') + '</div>';
  }
  if (!r.ffmpeg) {
    h += '<p style="margin-top:16px"><b>Para la vista en vivo:</b> copia <code>ffmpeg.exe</code> junto al programa, en ' +
         '<code>' + D.carpeta + '</code>. Se baja de <code>' + D.servidor + '/ffmpeg.exe</code></p>';
  }
  h += '<p style="margin-top:16px"><b>En el dashboard</b> aparece como equipo nuevo, sin nombre: entra a su ficha y ponle el nombre del sitio.</p>';
  h += '<p><b>Identidad de este equipo:</b> <code>' + D.estado + '</code><br>' +
       'Guarda una copia de ese archivo. Si algun dia hay que cambiar esta PC, es lo que permite ' +
       'sustituirla sin perder la galeria y los ajustes del sitio.</p>';
  h += '<div style="margin-top:20px"><button class="sec" onclick="cerrar()">Cerrar</button></div>';
  caja.className = 'tarjeta'; caja.innerHTML = h;
  caja.scrollIntoView({ behavior: 'smooth' });
  b.textContent = 'Instalado';
};

async function cerrar() {
  try { await pedir('/salir', {}); } catch (e) {}
  document.body.innerHTML = '<div class="caja"><div class="tarjeta">' +
    '<h2 style="font-size:16px">Ya puedes cerrar esta pestana.</h2></div></div>';
}
</script></div></body></html>`;
}

/**
 * Levanta el asistente y devuelve cuando la persona termina (o se cansa).
 *
 * Resuelve siempre: si el navegador no abre, se imprime la direccion para
 * pegarla a mano, que es mejor que quedarse esperando sin explicacion.
 */
function asistenteWeb() {
  return new Promise((resolve) => {
    const testigo = crypto.randomBytes(24).toString('hex');
    let cfgActual = null;
    try {
      const c = JSON.parse(fs.readFileSync(rutas.config, 'utf8'));
      cfgActual = c.camara || null;
    } catch (_) { /* instalacion nueva */ }

    const datos = {
      servidor: (cfgActual && JSON.parse(fs.readFileSync(rutas.config, 'utf8')).server_url) || inst.SERVIDOR_POR_DEFECTO,
      cfg: cfgActual,
      admin: inst.esAdministrador(),
      carpeta: rutas.BASE,
      estado: rutas.estado,
      // Nunca el secreto: solo el prefijo, que existe justamente para poder
      // ensenarlo. La pagina la abre un navegador de una PC ajena.
      alta: (() => {
        const { testigo, origen } = inst.resolverTestigo('');
        return {
          visible: inst.testigoParaVer(testigo),
          origen,
          valido: inst.pareceTestigo(testigo),
          archivo: inst.NOMBRE_TESTIGO,
        };
      })(),
    };

    let temporizador = null;
    const servidor = http.createServer(async (req, res) => {
      // Cada peticion, incluida la de la pagina, tiene que traer el testigo: sin
      // esto cualquier pestana abierta en el mismo navegador podria disparar una
      // instalacion contra este servidor.
      const url = new URL(req.url, 'http://127.0.0.1');
      const host = String(req.headers.host || '');
      if (!host.startsWith('127.0.0.1:') || url.searchParams.get('t') !== testigo) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Abre el asistente desde el programa, no a mano.');
      }

      if (temporizador) { clearTimeout(temporizador); temporizador = setTimeout(fin, INACTIVIDAD_MS); }

      try {
        if (req.method === 'GET' && url.pathname === '/') {
          const html = pagina(testigo, datos);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(html),
            'Cache-Control': 'no-store',
          });
          return res.end(html);
        }
        if (req.method === 'POST' && url.pathname === '/probar-servidor') {
          return json(res, 200, await probarServidor((await leerCuerpo(req)).servidor));
        }
        if (req.method === 'POST' && url.pathname === '/probar-camara') {
          return json(res, 200, await probarCamara(await leerCuerpo(req)));
        }
        if (req.method === 'POST' && url.pathname === '/instalar') {
          const r = instalar(await leerCuerpo(req));
          if (r.tarea) console.log('  Instalacion completada desde el asistente.');
          return json(res, 200, r);
        }
        if (req.method === 'POST' && url.pathname === '/salir') {
          json(res, 200, { ok: true });
          return setTimeout(fin, 300);
        }
        res.writeHead(404); res.end();
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });

    let terminado = false;
    function fin() {
      if (terminado) return;
      terminado = true;
      if (temporizador) clearTimeout(temporizador);
      try { servidor.close(); } catch (_) {}
      resolve();
    }

    servidor.on('error', (e) => {
      console.log(`  No pude abrir el asistente con ventanas (${e.message}).`);
      fin();
    });

    // Puerto al azar que asigna el sistema: nada que reservar ni que choque.
    servidor.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${servidor.address().port}/?t=${testigo}`;
      console.log('');
      console.log('  Abriendo el asistente en tu navegador...');
      console.log('');
      console.log(`  Si no se abre solo, copia esta direccion: ${url}`);
      console.log('');
      console.log('  (Esta ventana puede quedarse abierta; se cierra al terminar.)');
      temporizador = setTimeout(fin, INACTIVIDAD_MS);
      abrirNavegador(url);
    });
  });
}

module.exports = { asistenteWeb };
