// backend/src/workers/avisosWorker.ts
//
// El correo de "tu pantalla esta fallando". Corre DENTRO del backend, como el
// de programacion: el droplet ya carga seis contenedores y esto es una consulta
// por minuto.
//
// POR QUE SE ESPERA Y SE AGRUPA
// -----------------------------
// Se espera `agrupar_min` desde la PRIMERA falla pendiente de cada equipo y
// sale UN correo con todas. Dos razones, las dos aprendidas a golpes:
//
//   · "Media pantalla apagada" son cientos de gabinetes a la vez. Un correo por
//     cada uno es un buzon que nadie vuelve a abrir, y el aviso de verdad se
//     pierde entre ellos.
//   · Una falla que se arregla sola en ese rato no llega a molestar a nadie: a
//     los 15 minutos ya no esta abierta y el correo nunca sale.
//
// `aviso_en` es la marca de que ya salio. Sin ella, un reinicio del backend
// volveria a mandar el correo de todo lo que siguiera abierto.
import cron from 'node-cron';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { anotarEnvio, configDeAvisos, GRAVES } from '../controllers/avisos.controller';
import { correoDeFallas, destinatariosDe, enviarCorreo } from '../services/correo.service';

const HUECOS = GRAVES.map(() => '?').join(', ');

/**
 * Candado de un minuto, igual que el de las fotos programadas: si algun dia se
 * levanta una segunda instancia del backend, sin esto el mismo aviso sale dos
 * veces. Si Redis no contesta se manda igual: mas vale un correo repetido que
 * una pantalla apagada toda la noche en silencio.
 */
async function tomarElTurno(): Promise<boolean> {
  const minuto = Math.floor(Date.now() / 60000);
  try {
    return (await redis.set(`avisos:tick:${minuto}`, '1', { EX: 90, NX: true })) === 'OK';
  } catch (err) {
    console.error('[avisosWorker] no se pudo tomar el turno:', (err as any)?.message);
    return true;
  }
}

async function unaVuelta() {
  const cfg = await configDeAvisos();
  if (!cfg.activo) return;
  const para = destinatariosDe(cfg.destinatarios);
  if (!para.length) return;

  const [filas] = await pool.query<any[]>(
    `SELECT f.id, f.device_id, d.name AS equipo, f.tipo, f.fila, f.gabinete, f.detectada_en
       FROM pantalla_fallas f JOIN devices d ON d.id = f.device_id
      WHERE f.aviso_en IS NULL AND f.estado = 'abierta' AND f.tipo IN (${HUECOS})
      ORDER BY f.device_id, f.detectada_en`, [...GRAVES]);
  if (!(filas as any[]).length) return;

  const porEquipo = new Map<number, any[]>();
  for (const f of filas as any[]) {
    if (!porEquipo.has(f.device_id)) porEquipo.set(f.device_id, []);
    porEquipo.get(f.device_id)!.push(f);
  }

  const espera = cfg.agrupar_min * 60_000;
  for (const [, fallas] of porEquipo) {
    // Todavia puede llegar otra del mismo equipo: se deja reposar.
    const primera = Math.min(...fallas.map((f) => new Date(f.detectada_en).getTime()));
    if (Date.now() - primera < espera) continue;

    const { asunto, html } = correoDeFallas(fallas[0].equipo || `Equipo ${fallas[0].device_id}`, fallas);
    const ids = fallas.map((f) => f.id);
    try {
      const salida = await enviarCorreo({ para, asunto, html });
      // Se marcan DESPUES de que salio: si Resend falla, el siguiente minuto lo
      // reintenta en vez de perder el aviso.
      await pool.query(`UPDATE pantalla_fallas SET aviso_en = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      await anotarEnvio(salida === 'registrado' ? 'Sin llave de correo: quedó en el registro del servidor.' : null);
      console.log(`[avisosWorker] ${salida}: "${asunto}" -> ${para.length} destinatario(s)`);
    } catch (err: any) {
      const motivo = String(err?.message || err).slice(0, 500);
      await anotarEnvio(motivo);
      console.error(`[avisosWorker] no salio "${asunto}": ${motivo}`);
    }
  }
}

cron.schedule('* * * * *', () => {
  void (async () => {
    try {
      if (await tomarElTurno()) await unaVuelta();
    } catch (err: any) {
      console.error('[avisosWorker] vuelta fallida:', err?.sqlMessage || err?.message || err);
    }
  })();
});

console.log('[avisosWorker] vigilando fallas para avisar por correo');
