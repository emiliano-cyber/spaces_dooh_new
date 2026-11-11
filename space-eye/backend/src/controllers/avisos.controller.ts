// backend/src/controllers/avisos.controller.ts
//
// A quien se le avisa por correo cuando una pantalla falla, y la prueba de que
// el correo sale de verdad.
//
// Solo se avisa de las fallas GRAVES: la pantalla entera apagada o congelada, o
// la camara sin imagen. Un gabinete suelto -o una camara movida- se ve en el
// tablero y no vale un correo a las tres de la manana: "media pantalla apagada"
// en una cuadricula grande son cientos de gabinetes, y un correo por cada uno
// es un buzon que nadie vuelve a abrir.
import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import {
  cuentaDeCorreo, destinatariosDe, enviarCorreo, panelBase, pistaDeLlave, plantilla, remitenteValido,
} from '../services/correo.service';

/** Las que merecen sacar a alguien de la cama. */
export const GRAVES = ['pantalla_apagada', 'pantalla_congelada', 'sin_imagen'] as const;

export type Config = {
  activo: boolean;
  destinatarios: string;
  agrupar_min: number;
  ultimo_envio_en: Date | null;
  ultimo_error: string | null;
};

export async function configDeAvisos(): Promise<Config> {
  const [f] = await pool.query<any[]>(
    `SELECT activo, destinatarios, agrupar_min, ultimo_envio_en, ultimo_error FROM avisos_correo WHERE id = 1`);
  const c = (f as any[])[0];
  // La fila la crea la migracion; si falta (base a medio migrar) se responde
  // apagado en vez de reventar la pagina de fallas entera.
  if (!c) return { activo: false, destinatarios: '', agrupar_min: 15, ultimo_envio_en: null, ultimo_error: null };
  return { ...c, activo: !!c.activo, agrupar_min: Number(c.agrupar_min) };
}

export async function anotarEnvio(error: string | null) {
  await pool.query(
    `UPDATE avisos_correo SET ultimo_envio_en = NOW(), ultimo_error = ? WHERE id = 1`, [error]);
}

// --- Que la falta de la migracion se diga con su nombre ----------------------
//
// Un error aqui no deja la peticion colgada: `asyncRouter` ya lo convierte en un
// 500. Pero un 500 generico no dice QUE falta, y lo que falta casi siempre es la
// migracion 031: el codigo nuevo subio y `update-eyes.sh` no la aplico. Por eso
// tiene nombre propio. Con `falta_migracion` el panel puede decir "esta
// instancia aun no tiene esta version" en vez de un error sin explicacion.
//
// (Lo de g500 del 9-nov-2026 fue otra cosa: su Space Eye era ANTERIOR a
// /api/avisos, y el respaldo SPA de app.ts dejaba sin respuesta las rutas /api/
// que no conocia. Eso se arreglo alla, contestando 404.)
const SIN_MIGRAR = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR', 'ER_BAD_FIELD_ERROR']);

async function contestando(res: Response, trabajo: () => Promise<unknown>) {
  try {
    await trabajo();
  } catch (err: any) {
    if (SIN_MIGRAR.has(String(err?.code))) {
      return res.status(503).json({
        error: 'falta_migracion',
        detalle: 'Falta la migracion 031 en este Space Eye.',
      });
    }
    console.error('[avisos] no se pudo contestar:', err);
    res.status(500).json({ error: 'error_interno' });
  }
}

export async function leer(req: Request, res: Response) {
  await contestando(res, async () => {
    const c = await configDeAvisos();
    const cuenta = await cuentaDeCorreo();
    res.json({
      ...c,
      // La llave NO sale de aqui: solo sus ultimos cuatro, que es lo que hace
      // falta para reconocer cual esta puesta. Quien la cambia la escribe entera
      // o no la toca; nadie necesita leerla desde el navegador.
      llave_pista: pistaDeLlave(cuenta.llave),
      remitente: cuenta.remitente,
      // El panel necesita distinguir "nadie lo ha encendido" de "esta encendido
      // pero no hay cuenta de correo": son dos arreglos distintos. Y de donde sale
      // la cuenta, porque si viene del entorno, cambiarla aqui no basta.
      hay_llave: !!(cuenta.llave && cuenta.remitente),
      cuenta_del_panel: cuenta.delPanel,
      tipos: GRAVES,
    });
  });
}

const schema = z.object({
  activo: z.boolean(),
  destinatarios: z.string().max(2000),
  agrupar_min: z.coerce.number().int().min(1).max(240),
  // La cuenta de correo. Las dos son opcionales porque el panel guarda tambien
  // cuando solo se cambio la lista de destinatarios, y entonces NO manda la
  // llave: no la tiene (ver `leer`).
  llave: z.string().max(255).optional(),
  remitente: z.string().max(255).optional(),
  // Quitar la llave es un acto aparte y explicito. Si bastara con mandarla
  // vacia, cambiar cualquier otro ajuste dejaria los avisos mudos sin que nadie
  // se diera cuenta hasta el dia de la falla.
  borrar_llave: z.boolean().optional(),
});

export async function guardar(req: Request, res: Response) {
  await contestando(res, async () => {
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'invalid_input', detalle: p.error.issues });
    const validos = destinatariosDe(p.data.destinatarios);
    if (p.data.activo && !validos.length) {
      return res.status(400).json({ error: 'sin_destinatarios' });
    }
    const remitente = (p.data.remitente ?? '').trim();
    if (remitente && !remitenteValido(remitente)) {
      return res.status(400).json({ error: 'remitente_invalido' });
    }
    const llave = (p.data.llave ?? '').trim();
    // Una llave es una cadena larga sin espacios. No se exige el prefijo `re_` de
    // Resend: el dia que cambien el formato, un panel que rechaza la llave buena
    // es peor que uno que la acepta y deja que el correo de prueba diga la verdad.
    if (llave && !/^[A-Za-z0-9_.-]{16,255}$/.test(llave)) {
      return res.status(400).json({ error: 'llave_invalida' });
    }

    // Se guarda la lista ya limpia y normalizada: lo que se teclea lleva comas,
    // renglones y espacios de mas, y asi el panel ensena exactamente lo que el
    // servidor va a usar.
    const campos: string[] = ['activo = ?', 'destinatarios = ?', 'agrupar_min = ?', 'user_id = ?'];
    const valores: any[] = [p.data.activo, validos.join(', '), p.data.agrupar_min, req.user?.uid ?? null];
    if (p.data.remitente !== undefined) { campos.push('remitente = ?'); valores.push(remitente); }
    if (p.data.borrar_llave) { campos.push("llave = ''"); }
    else if (llave) { campos.push('llave = ?'); valores.push(llave); }

    await pool.query(`UPDATE avisos_correo SET ${campos.join(', ')} WHERE id = 1`, valores);
    // Nunca se devuelve la llave, ni siquiera a quien la acaba de escribir: en
    // cuanto sale al navegador acaba en el historial de alguien.
    const cuenta = await cuentaDeCorreo();
    res.json({
      ok: true,
      destinatarios: validos.join(', '),
      llave_pista: pistaDeLlave(cuenta.llave),
      remitente: cuenta.remitente,
      hay_llave: !!(cuenta.llave && cuenta.remitente),
      cuenta_del_panel: cuenta.delPanel,
    });
  });
}

/** Un correo de prueba a la lista guardada, para no descubrir el fallo el dia de la falla. */
export async function probar(req: Request, res: Response) {
  await contestando(res, async () => {
    const c = await configDeAvisos();
    const para = destinatariosDe(c.destinatarios);
    if (!para.length) return res.status(400).json({ error: 'sin_destinatarios' });
    const html = plantilla(
      'Prueba de los avisos de Space Eye',
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.6">Este correo confirma que los avisos de falla
        llegan a esta dirección. No hay ninguna pantalla fallando.</p>
       <p style="margin:0;font-size:14px;line-height:1.6">
         <a href="${panelBase()}/fallas.html" style="color:#0a66ff">Ver las fallas en el panel</a></p>`,
      'Lo pidió alguien desde el panel, en Fallas → Avisos por correo.');
    try {
      const salida = await enviarCorreo({ para, asunto: 'Space Eye — prueba de avisos', html });
      await anotarEnvio(salida === 'registrado' ? 'Sin llave de correo: quedó en el registro del servidor.' : null);
      res.json({ ok: true, salida, para });
    } catch (err: any) {
      const motivo = String(err?.message || err).slice(0, 500);
      await anotarEnvio(motivo);
      res.status(502).json({ error: 'no_salio', detalle: motivo });
    }
  });
}
