// pi-agent/src/actualizar.js
// Actualizacion por red del propio agente.
//
// POR QUE HACIA FALTA
// -------------------
// Era el ULTIMO equipo de la flota que obligaba a viajar. Los telefonos se
// actualizan con UPDATE_APP y las PCs con camara IP desde que existe
// `pc-agent/src/actualizar.js`; la Raspberry contestaba "todavia no disponible",
// asi que cualquier arreglo -incluso uno de una linea, como el caudal del video
// que se comia 50 MB por minuto- exigia SSH o presentarse en el sitio. Y en un
// sitio con modem LTE no hay SSH que valga.
//
// EN QUE SE DIFERENCIA DEL AGENTE DE PC
// -------------------------------------
// Aquel reemplaza UN ejecutable y se apoya en que Windows deja renombrar un .exe
// en uso. Aqui lo que corre es codigo Node: hay que cambiar una CARPETA (`src/`,
// `package.json` y `node_modules/`) sin llevarse por delante la identidad del
// equipo, que vive en la misma carpeta.
//
// Se conserva SIEMPRE: config.json, state.json, agente.log y cola/.
// Perder `state.json` daria de alta un equipo nuevo y partiria el historial del
// sitio en dos, asi que nunca entra en la maniobra.
//
// COMO SE HACE SIN DEJAR EL SITIO MUDO
// ------------------------------------
//   1. Se baja el paquete y se comprueba su huella SHA-256. Viaja por HTTP en
//      claro: la huella es la unica defensa real contra que le metan otra cosa.
//   2. Se descomprime APARTE y se arranca con --version, solo para ver si vive.
//      Un paquete truncado o con una dependencia faltante se cae aqui, antes de
//      tocar lo que funciona.
//   3. Recien entonces se aparta lo viejo a `.anterior/` y lo nuevo ocupa su
//      lugar. Se deja una marca de "actualizacion sin confirmar".
//   4. El agente sale; systemd (Restart=always) levanta la version nueva.
//   5. Si la nueva arranca y logra registrarse, BORRA la marca: se da por buena.
//   6. Si no arranca, cada intento suma uno a la marca. Al tercero, el propio
//      agente restaura `.anterior/` y vuelve solo a la version que funcionaba.
//
// Ese paso 6 es la diferencia entre una actualizacion y un viaje de cuatro horas
// al sitio: sin el, un paquete malo deja la Pi en un ciclo de reinicios que
// nadie puede romper a distancia.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const rutas = require('./rutas');

// Lo que se reemplaza al actualizar. Todo lo demas de la carpeta se respeta.
const CONTENIDO = ['src', 'package.json', 'node_modules'];

// Cuantos arranques fallidos se toleran antes de volver a la version anterior.
// Tres da margen a un tropiezo puntual (la red del sitio caida al arrancar) sin
// dejar al equipo dando vueltas indefinidamente.
const INTENTOS_MAX = 3;

const ESPERA_PRUEBA_MS = 25000;
const ESPERA_DESCARGA_MS = 15 * 60 * 1000;

const dir = {
  trabajo: path.join(rutas.BASE, '.actualizacion'),
  anterior: path.join(rutas.BASE, '.anterior'),
};
const marca = path.join(dir.trabajo, 'estado.json');

function borrarArbol(ruta) {
  try { fs.rmSync(ruta, { recursive: true, force: true }); } catch { /* lo intentara el proximo */ }
}

function leerMarca() {
  try { return JSON.parse(fs.readFileSync(marca, 'utf8')); } catch { return null; }
}

function escribirMarca(datos) {
  fs.mkdirSync(dir.trabajo, { recursive: true });
  fs.writeFileSync(marca, JSON.stringify(datos, null, 2));
}

function huella(archivo) {
  return crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
}

async function descargar(url, destino, log) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ESPERA_DESCARGA_MS) });
  if (!res.ok) throw new Error(`el servidor respondio HTTP ${res.status} al pedir el paquete`);
  const trozos = [];
  let bytes = 0;
  for await (const trozo of res.body) {
    trozos.push(trozo);
    bytes += trozo.length;
  }
  fs.writeFileSync(destino, Buffer.concat(trozos));
  log(`actualizacion: descargados ${(bytes / 1048576).toFixed(1)} MB`);
  return bytes;
}

// Se invoca con rutas RELATIVAS y cwd, nunca absolutas. GNU tar interpreta un
// "C:\..." como si "C" fuera un servidor remoto e intenta conectarse por rsh; en
// la Pi no se da (no hay letra de unidad), pero asi el mismo codigo se puede
// probar en Windows antes de mandarlo a campo, que es como se encontro esto.
function descomprimir(carpeta, archivo, subcarpeta) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.join(carpeta, subcarpeta), { recursive: true });
    execFile('tar', ['-xzf', archivo, '-C', subcarpeta], { cwd: carpeta, timeout: 120000 }, (err, _o, stderr) => {
      if (err) return reject(new Error(`no pude descomprimir el paquete (${String(stderr || err.message).slice(0, 200)})`));
      resolve();
    });
  });
}

// Arranca el agente nuevo con --version para comprobar que es codigo vivo y no
// un paquete roto que caso la huella de casualidad. Tambien atrapa el caso mas
// probable: que falte una dependencia dentro de node_modules.
function pruebaDeVida(carpeta) {
  return new Promise((resolve) => {
    const entrada = path.join(carpeta, 'src', 'index.js');
    if (!fs.existsSync(entrada)) {
      return resolve({ ok: false, motivo: 'el paquete no trae src/index.js' });
    }
    execFile(process.execPath, [entrada, '--version'], { timeout: ESPERA_PRUEBA_MS }, (err, salida, stderr) => {
      if (err) {
        const detalle = String(stderr || err.message).trim().slice(0, 200);
        return resolve({ ok: false, motivo: detalle || 'no arranco' });
      }
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
 * NO reinicia: devuelve `arrancar()` para que quien llama pueda avisarle al
 * servidor ANTES de irse. Si el agente se reiniciara primero, el dashboard se
 * quedaria esperando un resultado que ya nadie va a mandar.
 */
async function instalar(payload, log, versionActual) {
  const { url, sha256, version } = payload || {};
  if (!url || !sha256) throw new Error('la orden no trae de donde bajar el paquete o su huella');

  if (version && version === versionActual) {
    log(`actualizacion: ya tengo la version ${version}; no hago nada`);
    return { yaEstaba: true, version };
  }

  borrarArbol(dir.trabajo);
  fs.mkdirSync(dir.trabajo, { recursive: true });

  const paquete = path.join(dir.trabajo, 'nuevo.tar.gz');
  const desempacado = path.join(dir.trabajo, 'nuevo');

  log(`actualizacion: bajando ${version || 'la version publicada'} desde ${url}`);
  const bytes = await descargar(url, paquete, log);

  const calculada = huella(paquete);
  if (calculada.toLowerCase() !== String(sha256).toLowerCase()) {
    borrarArbol(dir.trabajo);
    throw new Error('el paquete descargado no coincide con su huella: se descarta');
  }
  log('actualizacion: huella correcta');

  await descomprimir(dir.trabajo, 'nuevo.tar.gz', 'nuevo');

  const prueba = await pruebaDeVida(desempacado);
  if (!prueba.ok) {
    borrarArbol(dir.trabajo);
    throw new Error(`el paquete descargado no arranca (${prueba.motivo}): se descarta`);
  }
  log(`actualizacion: el agente nuevo responde (${prueba.version})`);

  // El cambio propiamente dicho. Se aparta lo viejo ANTES de mover lo nuevo, y
  // si algo falla a media maniobra se deshace en el acto: quedarse sin `src/`
  // dejaria al sitio mudo hasta que alguien vaya.
  borrarArbol(dir.anterior);
  fs.mkdirSync(dir.anterior, { recursive: true });

  const movidos = [];
  try {
    for (const nombre of CONTENIDO) {
      const vivo = path.join(rutas.BASE, nombre);
      if (fs.existsSync(vivo)) {
        fs.renameSync(vivo, path.join(dir.anterior, nombre));
        movidos.push(nombre);
      }
    }
    for (const nombre of CONTENIDO) {
      const recien = path.join(desempacado, nombre);
      if (fs.existsSync(recien)) fs.renameSync(recien, path.join(rutas.BASE, nombre));
    }
  } catch (e) {
    log(`actualizacion: fallo al cambiar los archivos (${e.message}); deshaciendo`);
    for (const nombre of movidos) {
      const guardado = path.join(dir.anterior, nombre);
      const destino = path.join(rutas.BASE, nombre);
      borrarArbol(destino);
      try { fs.renameSync(guardado, destino); } catch { /* se intenta con el resto */ }
    }
    throw new Error(`no pude instalar la version nueva (${e.message}); se dejo la anterior`);
  }

  escribirMarca({
    version: version || prueba.version,
    anterior: versionActual,
    intentos: 0,
    cuando: new Date().toISOString(),
  });

  log(`actualizacion: instalada ${version || prueba.version}; reiniciando`);
  return {
    yaEstaba: false,
    version: version || prueba.version,
    bytes,
    // systemd (Restart=always) lo vuelve a levantar en segundos.
    arrancar: () => process.exit(0),
  };
}

/**
 * Se llama al ARRANCAR, antes de nada.
 *
 * Si venimos de una actualizacion sin confirmar, cuenta el intento. Al tercero
 * da por mala la version nueva y restaura la anterior: es la unica forma de que
 * un paquete defectuoso no deje al equipo inservible a distancia.
 */
function revisarArranque(log) {
  const m = leerMarca();
  if (!m) return { pendiente: false };

  m.intentos = (Number(m.intentos) || 0) + 1;

  if (m.intentos > INTENTOS_MAX) {
    log(`actualizacion: la version ${m.version} no logro arrancar en ${INTENTOS_MAX} intentos; vuelvo a la anterior`);
    const rescatado = restaurar(log);
    borrarArbol(dir.trabajo);
    return { pendiente: false, revertido: rescatado, version: m.version, anterior: m.anterior };
  }

  escribirMarca(m);
  log(`actualizacion: estrenando ${m.version} (intento ${m.intentos} de ${INTENTOS_MAX})`);
  return { pendiente: true, version: m.version, anterior: m.anterior, intentos: m.intentos };
}

function restaurar(log) {
  if (!fs.existsSync(dir.anterior)) {
    log('actualizacion: no hay copia anterior que restaurar; queda lo que haya');
    return false;
  }
  try {
    for (const nombre of CONTENIDO) {
      const guardado = path.join(dir.anterior, nombre);
      if (!fs.existsSync(guardado)) continue;
      const destino = path.join(rutas.BASE, nombre);
      borrarArbol(destino);
      fs.renameSync(guardado, destino);
    }
    borrarArbol(dir.anterior);
    return true;
  } catch (e) {
    log(`actualizacion: no pude restaurar la version anterior (${e.message})`);
    return false;
  }
}

/**
 * Da por buena la actualizacion. Se llama cuando el agente ya se registro contra
 * el servidor: es la prueba de que la version nueva no solo arranca, tambien
 * habla. Se conserva `.anterior/` como red por si acaso; la borra la siguiente
 * actualizacion.
 */
function confirmar(log) {
  if (!fs.existsSync(marca)) return false;
  borrarArbol(dir.trabajo);
  log('actualizacion: confirmada, el equipo esta operando con la version nueva');
  return true;
}

module.exports = { instalar, revisarArranque, confirmar };
