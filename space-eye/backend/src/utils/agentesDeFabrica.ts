// ============================================================================
//  Los agentes que trae la imagen, publicados para los equipos de la empresa.
// ----------------------------------------------------------------------------
//  En una instancia no hay repositorio en el servidor: lo que se ofrece a los
//  equipos para actualizarse vive en el volumen de descargas (DESCARGAS_DIR).
//  Si nadie lo llena, el boton "Actualizar" de una Raspberry no tiene a que
//  actualizarla.
//
//  Asi que la imagen trae el paquete del agente de Raspberry (/app/agentes,
//  armado con `npm run empaquetar` de pi-agent) y, al arrancar, se publica si
//  es MAS NUEVO que lo que ya hay. Actualizar el Space Eye de una empresa
//  (update-eyes.sh) basta para que sus Raspberry tengan la version nueva a un
//  boton de distancia; nadie copia archivos a mano en cada droplet.
//
//  Nunca baja de version: si alguien publico a mano algo mas nuevo (una prueba
//  en un sitio), se respeta.
//
//  El agente de Raspberry es el mismo para todas las empresas: la direccion de
//  su servidor vive en el config.json del equipo, no en el paquete. La APK si
//  es por empresa y por eso no viaja aqui.
// ============================================================================
import fs from 'fs';
import path from 'path';

const FABRICA = process.env.AGENTES_DIR || '/app/agentes';

// Paquete y manifiesto. El manifiesto se escribe AL FINAL: es lo que el
// servidor lee para ofrecer la version, y no debe apuntar a un paquete a medio
// copiar.
// `extras` viaja con su version: el instalador de una Pi nueva baja ESTE paquete.
const AGENTES = [
  { paquete: 'space-eye-pi-agent.tar.gz', meta: 'space-eye-pi-agent.json', nombre: 'Raspberry', extras: ['instalar-pi.sh'] },
];

/** -1, 0 o 1, comparando "0.7.0" con "0.6.12" por numeros, no por texto. */
export function compararVersiones(a: string, b: string): number {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function leerMeta(archivo: string): { version: string | null; sha256: string | null } {
  try {
    const m = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    return { version: String(m.version || '') || null, sha256: m.sha256 ? String(m.sha256) : null };
  } catch {
    return { version: null, sha256: null };
  }
}

/** El archivo de la imagen existe y no es igual al publicado (o no hay publicado). */
function distinto(deFabrica: string, publicado: string): boolean {
  if (!fs.existsSync(deFabrica)) return false;
  if (!fs.existsSync(publicado)) return true;
  return !fs.readFileSync(deFabrica).equals(fs.readFileSync(publicado));
}

/** Publica en `destino` los agentes de la imagen que sean mas nuevos. */
export function publicarAgentesDeFabrica(destino = process.env.DESCARGAS_DIR || '', origen = FABRICA): string[] {
  if (!destino || !fs.existsSync(origen)) return [];
  const hechos: string[] = [];
  for (const a of AGENTES) {
    const fab = leerMeta(path.join(origen, a.meta));
    const deFabrica = fab.version;
    if (!deFabrica || !fs.existsSync(path.join(origen, a.paquete))) continue;
    const pub = leerMeta(path.join(destino, a.meta));
    const publicada = pub.version;
    // Mas vieja: nunca. Misma version con OTRO paquete (un ensayo que se
    // reconstruyo sin subir el numero): manda el de la imagen, que es el que
    // se probo junto con este servidor.
    const comparacion = publicada ? compararVersiones(deFabrica, publicada) : 1;
    if (comparacion < 0) continue;
    if (comparacion === 0 && pub.sha256 === fab.sha256) {
      // Mismo agente, pero el instalador pudo cambiar solo (p. ej. la zona
      // horaria, 6-oct): sin esto un arreglo del instalador nunca se publicaba,
      // porque solo se copiaba junto con un paquete nuevo.
      const cambiados = a.extras.filter((x) => distinto(path.join(origen, x), path.join(destino, x)));
      for (const x of cambiados) {
        try {
          fs.copyFileSync(path.join(origen, x), path.join(destino, x));
          hechos.push(`${a.nombre}: ${x}`);
        } catch (e: any) {
          console.error(`[Agentes] no pude publicar ${x}: ${e.message}`);
        }
      }
      continue;
    }
    try {
      fs.mkdirSync(destino, { recursive: true });
      fs.copyFileSync(path.join(origen, a.paquete), path.join(destino, a.paquete));
      for (const x of a.extras) {
        if (fs.existsSync(path.join(origen, x))) fs.copyFileSync(path.join(origen, x), path.join(destino, x));
      }
      fs.copyFileSync(path.join(origen, a.meta), path.join(destino, a.meta));
      hechos.push(`${a.nombre} ${publicada || '(nada)'} -> ${deFabrica}`);
    } catch (e: any) {
      console.error(`[Agentes] no pude publicar el agente de ${a.nombre}: ${e.message}`);
    }
  }
  if (hechos.length) console.log(`[Agentes] publicados: ${hechos.join(', ')}`);
  return hechos;
}
