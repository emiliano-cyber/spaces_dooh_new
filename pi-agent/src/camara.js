// pi-agent/src/camara.js
// Captura una foto JPEG en la Raspberry. Hay tres formas y se elige la primera
// disponible, para poder avanzar sin esperar material:
//
//   libcamera -> camara oficial (Module 3) por el puerto MIPI. Es el destino.
//   usb       -> cualquier webcam USB. Sirve mientras no llega el cable
//                adaptador 22<->15 pines que la Module 3 necesita en la Pi 5.
//   prueba    -> imagen generada. Permite demostrar el circuito completo
//                (comando -> foto -> galeria -> verificacion) sin ninguna camara.
//
// El modo se puede fijar en config.json ("camara": { "modo": "usb" }); por
// omision se detecta solo.
const fs = require('fs');
const { spawn } = require('child_process');

const ANCHO = 1920;
const ALTO = 1080;

// Tope de cuadros a promediar. Mas alla no se gana casi nada -la mejora va con
// la raiz de N- y la captura empieza a tardar de mas: 32 cuadros a 30 por
// segundo ya es mas de un segundo de escena, y si pasa un coche o cambia el
// creativo a media captura, sale mezclado.
const CUADROS_MAX = 32;

// spawn en vez de execFile: la foto es binaria y puede pesar varios MB, mas de
// lo que aguanta el buffer por omision de execFile.
function ejecutar(cmd, args, { entradaVacia = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const salida = [];
    const errores = [];
    p.stdout.on('data', (d) => salida.push(d));
    p.stderr.on('data', (d) => errores.push(d));
    p.on('error', (e) => reject(new Error(`${cmd}: ${e.message}`)));
    p.on('close', (codigo) => {
      const buf = Buffer.concat(salida);
      if (codigo !== 0) {
        const msg = Buffer.concat(errores).toString().trim().split('\n').slice(-3).join(' ');
        return reject(new Error(`${cmd} termino con codigo ${codigo}: ${msg || 'sin detalle'}`));
      }
      if (entradaVacia && buf.length === 0) {
        return reject(new Error(`${cmd} no devolvio ninguna imagen`));
      }
      resolve(buf);
    });
    if (p.stdin) p.stdin.end();
  });
}

// Dos procesos encadenados: la salida del primero entra al segundo, y lo que
// devuelve el segundo es el resultado. Sin shell de por medio, igual que en la
// transmision: los argumentos van como argumentos y no hay nada que
// entrecomillar ni que se pueda colar en una linea de comandos.
function ejecutarTuberia(cmdA, argsA, cmdB, argsB) {
  return new Promise((resolve, reject) => {
    const a = spawn(cmdA, argsA, { stdio: ['ignore', 'pipe', 'pipe'] });
    const b = spawn(cmdB, argsB, { stdio: ['pipe', 'pipe', 'pipe'] });
    const salida = [];
    const errA = [];
    const errB = [];
    a.stdout.pipe(b.stdin);
    // Si el segundo muere primero, la tuberia da EPIPE: no es un fallo nuestro.
    a.stdout.on('error', () => {});
    b.stdin.on('error', () => {});
    a.stderr.on('data', (d) => errA.push(d));
    b.stderr.on('data', (d) => errB.push(d));
    b.stdout.on('data', (d) => salida.push(d));
    const rechazar = (e) => reject(e instanceof Error ? e : new Error(String(e)));
    a.on('error', (e) => rechazar(new Error(`${cmdA}: ${e.message}`)));
    b.on('error', (e) => rechazar(new Error(`${cmdB}: ${e.message}`)));
    b.on('close', (codigo) => {
      const cola = (l) => Buffer.concat(l).toString().trim().split('\n').slice(-2).join(' ');
      if (codigo !== 0) {
        return reject(new Error(`${cmdB} termino con codigo ${codigo}: ${cola(errB) || cola(errA) || 'sin detalle'}`));
      }
      resolve(Buffer.concat(salida));
    });
  });
}

async function existe(cmd) {
  try {
    await ejecutar('sh', ['-c', `command -v ${cmd}`], { entradaVacia: false });
    return true;
  } catch {
    return false;
  }
}

// En Bookworm los binarios se llaman rpicam-*; en Bullseye eran libcamera-*.
async function binarioLibcamera() {
  for (const c of ['rpicam-still', 'libcamera-still']) {
    if (await existe(c)) return c;
  }
  return null;
}

async function hayCamaraMipi() {
  const bin = await binarioLibcamera();
  if (!bin) return null;
  try {
    const salida = await ejecutar('sh', ['-c', `${bin} --list-cameras 2>&1`], { entradaVacia: false });
    const txt = salida.toString();
    // Sin camara conectada imprime "No cameras available!".
    if (/no cameras available/i.test(txt)) return null;
    // El nombre del sensor ("0 : imx708_noir [4608x2592 ...]") hace falta para
    // encontrar su archivo de perfil de color.
    const cd = /^\s*\d+\s*:\s*([a-z0-9_]+)/im.exec(txt);
    return { bin, sensor: cd ? cd[1] : null };
  } catch {
    return null;
  }
}

async function dispositivoUsb(preferido) {
  const candidatos = preferido ? [preferido] : [];
  try {
    for (const f of fs.readdirSync('/dev')) {
      if (/^video\d+$/.test(f)) candidatos.push(`/dev/${f}`);
    }
  } catch { /* sin /dev/video* */ }
  return candidatos.find((d) => fs.existsSync(d)) || null;
}

const entre = (v, min, max, porDefecto) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : porDefecto;
};

// Modos de balance de blancos que entiende rpicam-still.
const MODOS_AWB = ['auto', 'incandescent', 'tungsten', 'fluorescent', 'indoor', 'daylight', 'cloudy'];

// A que parte del cuadro le hace caso el automatico de exposicion.
const MODOS_MEDICION = ['centre', 'spot', 'average', 'matrix'];

/**
 * Traduce el encuadre y los ajustes de imagen del dashboard a banderas de
 * rpicam-still.
 *
 *   zoom     0 = cuadro completo .. 0.9 = muy cerrado. Es recorte digital
 *            (--roi), no zoom optico: la Module 3 no tiene zoom de verdad, asi
 *            que acercarse cuesta resolucion. Es el mismo criterio que en los
 *            telefonos.
 *   centro_x/y  a donde apunta el recorte (0.5, 0.5 = al centro). Sirve para
 *            encuadrar la pantalla sin mover el poste.
 *
 * Sobre el color: esta camara es la NoIR, SIN filtro infrarrojo. La vegetacion
 * refleja muchisimo infrarrojo cercano, esa luz entra al sensor y por eso las
 * hojas salen moradas. Ningun ajuste de aqui lo arregla del todo -es fisica del
 * sensor, no una mala configuracion-, pero bajar la ganancia de rojo con
 * awb_rojo/awb_azul y quitarle algo de saturacion lo deja mucho mas presentable.
 * El arreglo de verdad es un filtro de corte infrarrojo o la Module 3 estandar.
 */
function argumentosDeAjuste(opciones = {}) {
  const a = opciones.ajustes || {};
  const args = [];

  // --- Encuadre -------------------------------------------------------------
  const zoom = entre(opciones.zoom, 0, 0.9, 0);
  if (zoom > 0.01) {
    const lado = 1 - zoom;
    const cx = entre(a.centro_x, 0, 1, 0.5);
    const cy = entre(a.centro_y, 0, 1, 0.5);
    // El recorte no puede salirse del cuadro.
    const x = Math.min(1 - lado, Math.max(0, cx - lado / 2));
    const y = Math.min(1 - lado, Math.max(0, cy - lado / 2));
    args.push('--roi', `${x.toFixed(4)},${y.toFixed(4)},${lado.toFixed(4)},${lado.toFixed(4)}`);
  }

  // --- Imagen ---------------------------------------------------------------
  if (a.brillo !== undefined) args.push('--brightness', String(entre(a.brillo, -1, 1, 0)));
  if (a.contraste !== undefined) args.push('--contrast', String(entre(a.contraste, 0, 2, 1)));
  if (a.saturacion !== undefined) args.push('--saturation', String(entre(a.saturacion, 0, 2, 1)));
  if (a.nitidez !== undefined) args.push('--sharpness', String(entre(a.nitidez, 0, 2, 1)));
  if (a.ev !== undefined) args.push('--ev', String(entre(a.ev, -10, 10, 0)));

  // --- Exposicion -----------------------------------------------------------
  //
  // ESTO es lo que arregla una pantalla de LED, y no el 'brillo'. Medido en la
  // foto del 27-ago del espectacular: el 21.4% de los pixeles de la pantalla
  // tenia al menos un canal pegado en 250, o sea recortado. Un canal recortado
  // ya perdio el dato; `--brightness` suma luz DESPUES de revelar la imagen y
  // no lo puede devolver. Lo unico que lo evita es exponer menos.
  //
  //   ev        -1 aprox = la mitad de luz. Es la forma facil: se deja el
  //             automatico y solo se le dice "menos".
  //   medicion  a que le hace caso el automatico. 'spot' mide el centro del
  //             cuadro: con la pantalla al centro, la expone para ella y no
  //             para el cielo, que es lo que la estaba quemando.
  //   obturador tiempo de exposicion FIJO, en microsegundos. Es el mando
  //             directo contra las LINEAS del LED (ver _fotoPromediada), pero
  //             al fijarlo se pierde el automatico: hay que fijar tambien la
  //             ganancia o la foto sale a oscuras o quemada segun la hora.
  //   ganancia  ganancia analogica fija (1 = la minima, la mas limpia).
  if (MODOS_MEDICION.includes(String(a.medicion))) {
    args.push('--metering', String(a.medicion));
  }
  const obturador = Math.round(entre(a.obturador, 0, 200000, 0));
  if (obturador > 0) args.push('--shutter', String(obturador));
  const ganancia = entre(a.ganancia, 0, 16, 0);
  if (ganancia > 0) args.push('--gain', String(ganancia));

  // --- Balance de blancos ---------------------------------------------------
  // Las ganancias manuales mandan sobre el modo: es lo que sirve contra el tinte
  // morado, porque el automatico se despista justo con el infrarrojo.
  const r = Number(a.awb_rojo), b = Number(a.awb_azul);
  if (Number.isFinite(r) && Number.isFinite(b) && r > 0 && b > 0) {
    args.push('--awbgains', `${entre(r, 0.1, 8, 1)},${entre(b, 0.1, 8, 1)}`);
  } else if (a.awb && MODOS_AWB.includes(String(a.awb))) {
    args.push('--awb', String(a.awb));
  }

  // --- Ruido y volteo -------------------------------------------------------
  if (['auto', 'off', 'cdn_off', 'cdn_fast', 'cdn_hq'].includes(String(a.ruido))) {
    args.push('--denoise', String(a.ruido));
  }
  if (a.hflip) args.push('--hflip');
  if (a.vflip) args.push('--vflip');

  return args;
}

class Camara {
  constructor(cfg = {}) {
    this.cfg = cfg;
    this.ancho = cfg.ancho || ANCHO;
    this.alto = cfg.alto || ALTO;
    this._modo = null;   // resuelto en detectar()
    this._detalle = '';
  }

  async detectar() {
    if (this._modo) return this._modo;
    const forzado = this.cfg.modo && this.cfg.modo !== 'auto' ? this.cfg.modo : null;

    if (!forzado || forzado === 'libcamera') {
      const mipi = await hayCamaraMipi();
      if (mipi) {
        this._bin = mipi.bin;
        this._sensor = mipi.sensor;
        this._detalle = `camara oficial ${mipi.sensor || ''} via ${mipi.bin}`.replace(/\s+/g, ' ');
        return (this._modo = 'libcamera');
      }
      if (forzado) throw new Error('modo "libcamera" forzado pero no hay camara MIPI detectada');
    }

    if (!forzado || forzado === 'usb') {
      const dev = await dispositivoUsb(this.cfg.dispositivo);
      if (dev) {
        if (await existe('fswebcam')) { this._usbBin = 'fswebcam'; }
        else if (await existe('ffmpeg')) { this._usbBin = 'ffmpeg'; }
        else if (forzado) throw new Error('hay webcam pero falta fswebcam o ffmpeg (sudo apt install fswebcam)');
        if (this._usbBin) {
          this._dev = dev;
          this._detalle = `webcam USB ${dev} via ${this._usbBin}`;
          return (this._modo = 'usb');
        }
      }
      if (forzado) throw new Error('modo "usb" forzado pero no encuentro /dev/video*');
    }

    for (const c of ['convert', 'magick']) {
      if (await existe(c)) {
        this._imBin = c;
        this._detalle = 'IMAGEN DE PRUEBA (no hay camara conectada)';
        return (this._modo = 'prueba');
      }
    }

    throw new Error(
      'no hay forma de tomar una foto: sin camara MIPI, sin webcam USB y sin ImageMagick ' +
      '(sudo apt install -y imagemagick) para generar la imagen de prueba'
    );
  }

  async describir() {
    await this.detectar();
    return this._detalle;
  }

  /**
   * Las banderas de encuadre y color para una captura, perfil incluido.
   *
   * Lo usan la foto Y la vista en vivo, para que lo que se ve en el visor sea lo
   * que va a salir en la foto. Antes solo lo aplicaba la foto: en el dashboard se
   * movia el zoom, no pasaba nada en el video, y el color de la transmision
   * seguia igual de lavado aunque las fotos ya salieran bien.
   */
  async argumentosDeCaptura(opciones = {}) {
    await this.detectar();
    if (this._modo !== 'libcamera') return [];
    const args = [];
    const perfil = this._rutaPerfil((opciones.ajustes || {}).perfil);
    if (perfil) args.push('--tuning-file', perfil);
    args.push(...argumentosDeAjuste(opciones));
    args.push(...this._argumentosDeEnfoque(opciones.ajustes || {}, { video: true }));
    return args;
  }

  /**
   * Ruta del archivo de perfil de color pedido, o null para dejar que libcamera
   * elija. La carpeta cambia segun el modelo (pisp en la Pi 5, vc4 en las
   * anteriores) y el sensor puede ser otro, asi que se busca en vez de darla por
   * sentada: si no aparece, se sigue sin perfil en lugar de fallar la foto.
   */
  _rutaPerfil(perfil) {
    if (!perfil || perfil === 'auto') return null;
    if (this._perfilResuelto && this._perfilResuelto.clave === perfil) {
      return this._perfilResuelto.ruta;
    }

    const base = '/usr/share/libcamera/ipa/rpi';
    const sensor = (this._sensor || 'imx708').replace(/_noir$/, '');
    const nombre = perfil === 'noir' ? `${sensor}_noir.json` : `${sensor}.json`;

    let ruta = null;
    for (const carpeta of ['pisp', 'vc4']) {
      const candidata = `${base}/${carpeta}/${nombre}`;
      if (fs.existsSync(candidata)) { ruta = candidata; break; }
    }
    this._perfilResuelto = { clave: perfil, ruta };
    return ruta;
  }

  esPrueba() {
    return this._modo === 'prueba';
  }

  /**
   * Banderas de enfoque.
   *
   * El enfoque fijo lo decide el DASHBOARD, por equipo (`camera_ajustes`), y
   * viaja en cada orden igual que el zoom y el color. Antes solo se miraba
   * `config.json` del propio equipo, asi que la casilla del dashboard estaba
   * marcada y la Raspberry seguia haciendo una pasada de autofoco en cada
   * disparo: en un espectacular la distancia no cambia nunca y ese autofoco solo
   * hace que la imagen "salte" cada vez que pasa un creativo de muchos colores.
   *
   * Sin nada del dashboard se respeta lo que diga config.json, como siempre.
   *
   * Al VIDEO solo se le tocan las banderas si el enfoque es fijo. Si no lo es,
   * se deja tal cual venia funcionando: no es momento de cambiarle el
   * comportamiento a la vista en vivo en un equipo que no se puede actualizar
   * por red.
   */
  _argumentosDeEnfoque(ajustes = {}, { video = false } = {}) {
    const fijo = ajustes.enfoque_fijo !== undefined
      ? !!ajustes.enfoque_fijo
      : this.cfg.enfoque === 'manual';

    if (fijo) {
      // Dioptrias = 1/metros; 0 = infinito, que es lo que corresponde a una
      // pantalla a decenas de metros.
      const d = Number(ajustes.enfoque_dioptrias ?? this.cfg.lente_dioptrias ?? 0);
      return ['--autofocus-mode', 'manual', '--lens-position', String(Number.isFinite(d) ? d : 0)];
    }

    return video ? [] : ['--autofocus-mode', 'auto', '--autofocus-on-capture'];
  }

  /**
   * Una mirada barata a la pantalla, en gris, para calcular su huella.
   *
   * NO es una foto: no se sube a ningun lado ni se guarda. Sirve para reconocer
   * si el creativo que esta puesto ya se habia visto antes, y eso tiene que
   * costar CERO datos moviles -por eso se resuelve dentro del equipo.
   *
   * Se pide `--encoding rgb`, que sale sin comprimir y SIN relleno de filas:
   * exactamente ancho*alto*3 bytes (comprobado en la Pi: 320x180 -> 172800).
   * Con JPEG habria que decodificar, y con yuv420 hay que adivinar el `stride`
   * que use cada version de rpicam. En crudo no hay nada que interpretar.
   *
   * `-t 1` en vez de la espera larga de las fotos: aqui no importa que la
   * exposicion converja del todo, solo el reparto de luces y sombras, y la
   * huella se compara contra la mediana de la propia imagen -o sea que aguanta
   * que la escena entera este mas clara o mas oscura.
   */
  async mirarEnGris({ ancho = 320, alto = 180 } = {}) {
    const modo = await this.detectar();
    if (modo !== 'libcamera') return null;   // el modo prueba no mira nada real

    const crudo = await ejecutar(this._bin, [
      '-n', '-t', '1',
      '--width', String(ancho), '--height', String(alto),
      '--encoding', 'rgb', '-o', '-',
    ]);

    const esperado = ancho * alto * 3;
    if (!crudo || crudo.length < esperado) return null;

    // Luminancia estandar (Rec. 601). El resto del sistema razona en gris.
    const gris = new Uint8Array(ancho * alto);
    for (let i = 0, p = 0; i < gris.length; i++, p += 3) {
      gris[i] = (crudo[p] * 299 + crudo[p + 1] * 587 + crudo[p + 2] * 114) / 1000;
    }
    return { gris, ancho, alto };
  }

  /**
   * Foto promediando varios cuadros seguidos. Es lo que borra las LINEAS de la
   * pantalla.
   *
   * POR QUE APARECEN LAS LINEAS
   * ---------------------------
   * Un LED no esta encendido de continuo: prende y apaga miles de veces por
   * segundo y la pantalla ademas se refresca por franjas. A mediodia la camara
   * expone en menos de un milisegundo, o sea que atrapa solo un pedazo de ese
   * ciclo: la franja que estaba encendida sale clara y la que no, oscura. De
   * ahi las bandas. Medido en la foto del 27-ago del espectacular: 40% de
   * amplitud sobre el nivel del naranja.
   *
   * POR QUE PROMEDIAR SI FUNCIONA
   * -----------------------------
   * Porque el patron NO se repite. Entre las dos capturas de ese dia la
   * correlacion de las bandas es -0.10: cada cuadro pilla el ciclo en otra
   * fase. Promediando N cuadros la amplitud baja con la raiz de N, asi que con
   * 16 cuadros se va del 40% al 10%. De paso baja el ruido en la misma
   * proporcion, que es lo que hace que la pantalla se lea.
   *
   * El mando directo seria alargar la exposicion (`obturador`) hasta cubrir
   * varios ciclos completos, pero a plena luz eso quema la foto entera: harian
   * falta 8 pasos de luz menos, o sea un filtro ND sobre la lente. Promediar da
   * el mismo resultado sin tocar el hardware.
   *
   * COMO
   * ----
   * rpicam-vid graba unos cuadros y ffmpeg los promedia (`tmix`). Los dos ya
   * estan en el equipo -ffmpeg lo usa la vista en vivo-, asi que no hace falta
   * instalar nada nuevo.
   *
   * Se graba en MJPEG y NO en crudo a proposito: en crudo habria que adivinar
   * el relleno de filas de cada version de rpicam-vid, y una suposicion mala
   * sale como una imagen rasgada (el mismo motivo por el que mirarEnGris pide
   * `rgb`). En MJPEG los cuadros vienen delimitados y ffmpeg los lee sin que
   * nadie tenga que interpretar nada; se graba a calidad 95 y el promedio, por
   * ser una media, se come el ruido de esa compresion.
   *
   * La imagen sale a un archivo en /dev/shm -memoria, no la tarjeta SD- porque
   * con `-update` ffmpeg reescribe el archivo en cada cuadro y al terminar
   * queda el ULTIMO: el unico que promedio la ventana completa, y ademas el que
   * tiene la exposicion ya estabilizada. Por una tuberia no se puede, saldrian
   * todas las imagenes pegadas una tras otra.
   */
  async _fotoPromediada(cuadros, comunes, ajustes) {
    const fps = Math.round(entre(this.cfg.fps_promedio, 5, 60, 30));
    // Se graba la espera de convergencia MAS los cuadros que hay que promediar,
    // con margen por si alguno se cae.
    const ms = Math.round((this.cfg.espera_ms || 1500) + ((cuadros + 4) / fps) * 1000);
    const binVid = this._bin.replace('-still', '-vid');
    const archivo = `/dev/shm/space-eye-promedio-${process.pid}.jpg`;

    try {
      await ejecutarTuberia(
        binVid,
        [
          '-n', '-t', String(ms),
          '--framerate', String(fps),
          '--codec', 'mjpeg', '--quality', '95',
          ...comunes,
          // {video:true}: `--autofocus-on-capture` no existe al grabar video.
          ...this._argumentosDeEnfoque(ajustes, { video: true }),
          '-o', '-',
        ],
        'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error',
          '-f', 'mjpeg', '-i', '-',
          '-vf', `tmix=frames=${cuadros}`,
          '-q:v', String(entre(this.cfg.calidad_promedio, 2, 31, 2)),
          '-f', 'image2', '-update', '1', '-y', archivo,
        ]
      );
      const jpeg = fs.readFileSync(archivo);
      if (!jpeg.length) throw new Error('el promedio salio vacio');
      return jpeg;
    } finally {
      try { fs.unlinkSync(archivo); } catch { /* puede no haberse creado */ }
    }
  }

  /** Aviso del ultimo intento de captura, si hubo algo que contar (y se consume). */
  tomarAviso() {
    const a = this._aviso;
    this._aviso = null;
    return a;
  }

  async tomarFoto(opciones = {}) {
    const modo = await this.detectar();

    if (modo === 'libcamera') {
      const ajustes = opciones.ajustes || {};

      // Banderas que valen para las DOS formas de capturar -un disparo suelto o
      // varios cuadros promediados-, para que las dos den la misma imagen.
      const comunes = ['--width', String(this.ancho), '--height', String(this.alto)];

      // Perfil de color del sensor.
      //
      // libcamera elige solo el perfil "noir" porque la camara se identifica como
      // imx708_noir. Ese perfil esta pensado para vigilancia nocturna y de dia
      // deja la imagen lechosa y sin contraste. Con el perfil ESTANDAR mas unas
      // ganancias de blanco a mano, la misma escena sale con cielo, nubes y
      // colores naturales. (Comprobado a mediodia, comparando ocho variantes.)
      //
      // El perfil estandar SOLO, sin ganancias, tiñe todo de rosa: van juntos.
      const perfil = this._rutaPerfil(ajustes.perfil);
      if (perfil) comunes.push('--tuning-file', perfil);

      // Encuadre y color que manda el dashboard en la orden. Hasta ahora la Pi
      // los ignoraba: el zoom que se ajustaba desde el dashboard funcionaba en
      // los telefonos y en la Raspberry no hacia absolutamente nada.
      comunes.push(...argumentosDeAjuste(opciones));

      // --- Varios cuadros promediados ---------------------------------------
      // Es lo unico que borra las LINEAS del LED. Se intenta primero y, si por
      // lo que sea no se puede, se cae al disparo simple: la foto nunca se
      // pierde por esto.
      const cuadros = Math.round(entre(ajustes.cuadros, 1, CUADROS_MAX, 1));
      if (cuadros > 1) {
        try {
          return await this._fotoPromediada(cuadros, comunes, ajustes);
        } catch (e) {
          this._aviso = `no pude promediar ${cuadros} cuadros, va con un disparo simple (${e.message})`;
        }
      }

      // La Module 3 tiene autofoco, pero NO enfoca por su cuenta al capturar:
      // sin pedirselo la foto sale borrosa. Dos formas:
      //   auto   -> hace una pasada de enfoque antes de cada disparo.
      //   manual -> enfoque fijo en dioptrias (1/metros; 0 = infinito). Es lo
      //             que conviene en un espectacular: la distancia no cambia y
      //             se evita que el autofoco se despiste de noche o con lluvia.
      //
      // -n sin vista previa, -t deja converger exposicion y balance de blancos.
      return ejecutar(this._bin, [
        '-n', '-t', String(this.cfg.espera_ms || 1500),
        ...comunes,
        '-q', String(this.cfg.calidad || 90),
        ...this._argumentosDeEnfoque(ajustes),
        '-o', '-',
      ]);
    }

    if (modo === 'usb') {
      if (this._usbBin === 'fswebcam') {
        return ejecutar('fswebcam', [
          '-d', this._dev, '-r', `${this.ancho}x${this.alto}`,
          '--no-banner', '-q', '--jpeg', String(this.cfg.calidad || 90), '-',
        ]);
      }
      return ejecutar('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'v4l2', '-video_size', `${this.ancho}x${this.alto}`,
        '-i', this._dev, '-frames:v', '1', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1',
      ]);
    }

    // Imagen de prueba. Sin texto a proposito: el dashboard ya dibuja encima la
    // marca de informacion (nombre del equipo, fecha y hora), asi que no hace
    // falta ninguna tipografia instalada y la foto se ve igual que las reales.
    const args = [
      '-size', `${this.ancho}x${this.alto}`,
      'gradient:#0a2a5e-#0a66ff',
      '-quality', String(this.cfg.calidad || 90),
      'jpg:-',
    ];
    return ejecutar(this._imBin, this._imBin === 'magick' ? args : args);
  }
}

module.exports = { Camara, argumentosDeAjuste };
