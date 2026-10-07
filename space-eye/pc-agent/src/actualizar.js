// pc-agent/src/actualizar.js
// Actualizacion por red del propio agente.
//
// POR QUE HACIA FALTA
// -------------------
// Hasta ahora, cambiar algo en el agente de una PC exigia ir al sitio o entrar
// por escritorio remoto. El resultado se vio en REVOLUCION 267: esa PC llevaba
// TRES versiones de atraso -corria el binario anterior a que existiera la vista
// en vivo- y desde el dashboard era imposible notarlo. El boton de transmitir
// aparecia, el agente contestaba "no disponible", y el navegador lo traducia a
// "la camara esta ocupada".
//
// COMO SE HACE SIN DEJAR EL SITIO MUDO
// ------------------------------------
// Reemplazar un .exe mientras corre parece imposible, pero Windows SI deja
// RENOMBRAR un ejecutable en uso: solo prohibe sobrescribirlo. Sobre eso se
// apoya todo esto.
//
//   1. Se baja el programa nuevo AL LADO del actual (no encima).
//   2. Se comprueba su huella SHA-256. El archivo viaja por HTTP en claro, asi
//      que la huella es la unica defensa contra que le metan otra cosa.
//   3. Se ARRANCA el binario nuevo con --version, solo para ver si vive. Un .exe
//      corrupto que pase la huella es improbable, pero uno compilado para otra
//      cosa, o truncado, aqui se cae. Vale mas descubrirlo antes del cambio.
//   4. Recien entonces se renombra el actual a .anterior.exe y el nuevo ocupa su
//      lugar y su nombre (la tarea de Windows apunta a esa ruta: no se toca).
//   5. Se lanza el nuevo y este proceso se va.
//   6. Si el nuevo se muere en los primeros segundos, se DESHACE el cambio y se
//      vuelve a levantar el anterior.
//
// Y por debajo de todo hay una red mas: la tarea programada se repite cada 10
// minutos con IgnoreNew, asi que aunque este proceso muriera a media maniobra,
// Windows vuelve a levantar lo que haya quedado en esa ruta.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const rutas = require('./rutas');

// Cuanto se espera a que el binario nuevo demuestre que arranca.
const ESPERA_PRUEBA_MS = 20000;
// Cuanto se vigila al recien lanzado antes de dar por buena la actualizacion.
const ESPERA_VIGILANCIA_MS = 15000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function rutasDeTrabajo() {
  const actual = rutas.ejecutable;                    // el nombre que le hayan puesto
  const carpeta = path.dirname(actual);
  const base = path.basename(actual, path.extname(actual));
  return {
    actual,
    nuevo: path.join(carpeta, `${base}.nuevo.exe`),
    anterior: path.join(carpeta, `${base}.anterior.exe`),
  };
}

function borrarSiEsta(archivo) {
  try { if (fs.existsSync(archivo)) fs.unlinkSync(archivo); } catch { /* lo intentara el proximo */ }
}

async function descargar(url, destino, log) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!res.ok) throw new Error(`el servidor respondio HTTP ${res.status} al pedir el programa`);

  const trozos = [];
  let bytes = 0;
  for await (const trozo of res.body) {
    trozos.push(trozo);
    bytes += trozo.length;
  }
  fs.writeFileSync(destino, Buffer.concat(trozos));
  log(`actualizacion: descargados ${(bytes / 1048576).toFixed(0)} MB`);
  return bytes;
}

function huella(archivo) {
  return crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
}

// Arranca el binario nuevo con --version para comprobar que es un programa vivo
// y no un archivo roto que caso la huella por casualidad.
function pruebaDeVida(exe) {
  return new Promise((resolve) => {
    execFile(exe, ['--version'], { timeout: ESPERA_PRUEBA_MS }, (err, salida) => {
      if (err) return resolve({ ok: false, motivo: err.message });
      const texto = String(salida).trim();
      if (!/\d+\.\d+\.\d+/.test(texto)) {
        return resolve({ ok: false, motivo: `no dijo su version (respondio "${texto.slice(0, 60)}")` });
      }
      resolve({ ok: true, version: texto });
    });
  });
}

/**
 * Baja, verifica e instala la version nueva.
 *
 * NO reinicia: devuelve una funcion `arrancar()` para que quien llama pueda
 * avisarle al servidor ANTES de irse. Si el agente se reiniciara primero, el
 * dashboard se quedaria esperando un resultado que ya nadie va a mandar.
 */
async function instalar(payload, log, versionActual) {
  if (!rutas.esExe) {
    throw new Error('corriendo desde el codigo fuente: la actualizacion por red es solo para el .exe');
  }
  const { url, sha256, version } = payload || {};
  if (!url || !sha256) throw new Error('la orden no trae de donde bajar el programa o su huella');

  if (version && version === versionActual) {
    log(`actualizacion: ya tengo la version ${version}; no hago nada`);
    return { yaEstaba: true, version };
  }

  const r = rutasDeTrabajo();
  borrarSiEsta(r.nuevo);

  log(`actualizacion: bajando ${version || 'la version publicada'} desde ${url}`);
  const bytes = await descargar(url, r.nuevo, log);

  const calculada = huella(r.nuevo);
  if (calculada.toLowerCase() !== String(sha256).toLowerCase()) {
    borrarSiEsta(r.nuevo);
    throw new Error('el programa descargado no coincide con su huella: se descarta');
  }
  log('actualizacion: huella correcta');

  const prueba = await pruebaDeVida(r.nuevo);
  if (!prueba.ok) {
    borrarSiEsta(r.nuevo);
    throw new Error(`el programa descargado no arranca (${prueba.motivo}): se descarta`);
  }
  log(`actualizacion: el programa nuevo responde (${prueba.version})`);

  // El cambio propiamente dicho. Windows deja renombrar un .exe en uso.
  borrarSiEsta(r.anterior);
  fs.renameSync(r.actual, r.anterior);
  try {
    fs.renameSync(r.nuevo, r.actual);
  } catch (e) {
    // Quedarse sin ejecutable en esa ruta dejaria el sitio mudo para siempre,
    // porque es a donde apunta la tarea de Windows. Se deshace en el acto.
    fs.renameSync(r.anterior, r.actual);
    throw new Error(`no pude poner el programa nuevo en su sitio (${e.message}); se dejo el anterior`);
  }
  log(`actualizacion: instalada ${version || prueba.version}; reiniciando`);

  return { yaEstaba: false, version: version || prueba.version, bytes, arrancar: () => reiniciar(r, log) };
}

// Lanza el binario recien instalado y se queda mirando unos segundos. Si se cae,
// devuelve el anterior a su sitio y lo arranca a el.
async function reiniciar(r, log) {
  const hijo = spawn(r.actual, ['--servicio'], { detached: true, stdio: 'ignore' });
  hijo.unref();

  let murio = false;
  hijo.on('exit', () => { murio = true; });
  await dormir(ESPERA_VIGILANCIA_MS);

  if (murio) {
    log('actualizacion: el programa nuevo se cayo al arrancar; vuelvo al anterior');
    try {
      borrarSiEsta(r.nuevo);
      fs.renameSync(r.actual, r.nuevo);        // el nuevo, apartado como sospechoso
      fs.renameSync(r.anterior, r.actual);     // vuelve el de siempre
      spawn(r.actual, ['--servicio'], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) {
      log(`actualizacion: no pude volver atras (${e.message}); la tarea de Windows lo levantara en 10 min`);
    }
    return false;
  }
  return true;
}

/**
 * Borra el programa anterior que dejo una actualizacion.
 *
 * Se llama al ARRANCAR, no al terminar de instalar: mientras el binario nuevo no
 * haya demostrado que levanta y se conecta, ese archivo es la unica forma de
 * volver atras sin que alguien viaje al sitio.
 */
function limpiarAnterior(log) {
  if (!rutas.esExe) return;
  const r = rutasDeTrabajo();
  for (const sobra of [r.anterior, r.nuevo]) {
    if (fs.existsSync(sobra)) {
      borrarSiEsta(sobra);
      if (!fs.existsSync(sobra)) log(`actualizacion: limpiado ${path.basename(sobra)}`);
    }
  }
}

module.exports = { instalar, limpiarAnterior };
