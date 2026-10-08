// backend/src/utils/firmaArchivos.ts
// Firma de los archivos servidos en /storage (fotos, creatividades, evidencias).
//
// EL PROBLEMA QUE CIERRA
// ----------------------
// Hasta ahora `/storage` se servia con `express.static` sin ninguna comprobacion
// y montado ANTES de las rutas de API, asi que ni siquiera pasaba por el
// limitador de peticiones. Cualquiera con la URL veia la foto de cualquier
// pantalla de cualquier cliente, y una URL que se filtra -un WhatsApp
// reenviado, un correo, el historial del navegador, el log de un proxy- queda
// publica para siempre. Las rutas llevan un UUID, o sea que no se adivinan,
// pero eso no es una proteccion: es una contraseña que se reparte sola.
//
// POR QUE FIRMA Y NO SESION
// -------------------------
// Porque hay TRES consumidores y solo uno tiene sesion:
//
//   1. el navegador de quien usa el dashboard, que pide la imagen con <img src>
//      y por ahi no viaja el token;
//   2. el ai-worker, que la descarga con un GET pelado, sin cabeceras
//      (ai-worker/app/worker.py);
//   3. manana, la instancia de un cliente en otro servidor.
//
// Exigir sesion solo arregla al primero y rompe al segundo. Una URL firmada
// sirve a los tres sin darle a ninguno una credencial permanente.
//
// LO QUE ESTO SI Y NO RESUELVE
// ----------------------------
// Una URL firmada sigue siendo compartible mientras no venza: quien la reciba
// dentro de la ventana ve la foto. Eso es inherente y es el trato que se acepta
// a cambio de que funcione con <img> y con el worker. Lo que cambia es que el
// daño de una fuga deja de ser eterno y pasa a durar lo que dure la firma.
import crypto from 'crypto';
import { env } from '../config/env';

// Horas que vale un enlace. Suficiente para que alguien deje la galeria abierta
// o baje un album entero, y corto para que una URL filtrada sirva de poco.
const VIGENCIA_S = 6 * 3600;

// Secreto propio si esta puesto; si no, uno derivado del de sesiones. Se deriva
// en vez de reutilizarlo tal cual para que una firma de archivo no sea material
// util contra los tokens, y para que esto funcione sin tocar el .env de
// produccion: un despliegue que exigiera configurar algo nuevo antes de arrancar
// deja el agujero abierto mientras tanto.
const SECRETO = crypto
  .createHash('sha256')
  .update(`space-eye|firma-archivos|${process.env.STORAGE_SIGN_SECRET || env.JWT_SECRET}`)
  .digest();

function calcular(ruta: string, expira: number): string {
  return crypto
    .createHmac('sha256', SECRETO)
    .update(`${ruta}\n${expira}`)
    .digest('base64url')
    .slice(0, 27);
}

/** Solo las rutas locales se firman; una URL absoluta (S3) no pasa por aqui. */
export function esRutaLocal(ruta: unknown): ruta is string {
  return typeof ruta === 'string' && ruta.startsWith('/storage/');
}

/**
 * Agrega vigencia y firma a una ruta de /storage. Si no es local se devuelve
 * intacta: en modo 'spaces' el archivo lo sirve DigitalOcean y esto no aplica.
 */
export function firmar(ruta: string, vigenciaS: number = VIGENCIA_S): string {
  if (!esRutaLocal(ruta)) return ruta;
  const expira = Math.floor(Date.now() / 1000) + vigenciaS;
  return `${ruta}?exp=${expira}&sig=${calcular(ruta, expira)}`;
}

/** Firma, sobre un objeto, los campos de ruta que existan. Devuelve uno nuevo. */
export function firmarCampos<T extends Record<string, any>>(fila: T): T {
  if (!fila || typeof fila !== 'object') return fila;
  const campos = ['storage_path', 'thumbnail_path', 'creative_path', 'aligned_path', 'diff_path'];
  let copia: T | null = null;
  for (const campo of campos) {
    if (esRutaLocal(fila[campo])) {
      if (!copia) copia = { ...fila };
      (copia as any)[campo] = firmar(fila[campo]);
    }
  }
  return copia ?? fila;
}

/** La version de lista, que es como salen casi siempre. */
export function firmarFilas<T extends Record<string, any>>(filas: T[]): T[] {
  return Array.isArray(filas) ? filas.map(firmarCampos) : filas;
}

/**
 * Comprueba la firma de una peticion a /storage.
 *
 * `rutaPedida` es el pathname COMPLETO y ya descodificado (`/storage/...`), que
 * es lo mismo que se firmo: si se comparara la version codificada, un `%2F` o
 * un acento romperia la comprobacion de forma intermitente y dificil de ver.
 */
export function firmaValida(rutaPedida: string, exp: unknown, sig: unknown): boolean {
  const expira = Number(exp);
  if (!Number.isFinite(expira) || typeof sig !== 'string') return false;
  if (expira < Math.floor(Date.now() / 1000)) return false;

  const esperada = Buffer.from(calcular(rutaPedida, expira));
  const recibida = Buffer.from(sig);
  // Longitudes distintas: timingSafeEqual lanza en vez de devolver false.
  if (esperada.length !== recibida.length) return false;
  return crypto.timingSafeEqual(esperada, recibida);
}
