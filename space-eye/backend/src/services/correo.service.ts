// backend/src/services/correo.service.ts
//
// Correo transaccional por Resend, con `fetch` a su API REST y sin dependencia
// nueva (igual que lo hace SPACE OS en apps/web/lib/server/email.ts). Node 22
// trae fetch: meter un paquete de correo solo para esto obligaria a reconstruir
// la imagen de toda la flota.
//
// Si no hay llave NO es un error: el correo se escribe en el registro del
// servidor tal como habria salido. Asi se puede probar el aviso completo -a
// quien, con que asunto, con que texto- en una instancia sin cuenta de correo,
// y el panel lo dice en su sitio en vez de callarse.
import { pool } from '../config/database';
import { env } from '../config/env';
import { nombreDe } from '../controllers/monitoreo.controller';

export type Salida = 'enviado' | 'registrado';
export type Cuenta = { llave: string; remitente: string; delPanel: boolean };

/**
 * Con que cuenta sale el correo. Manda lo que haya en el panel; el entorno del
 * contenedor queda de respaldo.
 *
 * Ese orden y no al reves: el dia que la empresa cambie de cuenta de correo,
 * quien opera las pantallas lo arregla desde el panel en un minuto. Si mandara
 * el entorno, lo escrito en el panel no serviria de nada y nadie entenderia por
 * que. El respaldo existe para que una instancia que YA tenia sus variables no
 * se quede muda al aplicar la migracion 031.
 *
 * Se lee en CADA envio, sin cache: cambiar la llave tiene que surtir efecto sin
 * reiniciar nada, que es justo el motivo de haberla sacado del entorno.
 */
export async function cuentaDeCorreo(): Promise<Cuenta> {
  let llave = '';
  let remitente = '';
  try {
    const [f] = await pool.query<any[]>(`SELECT llave, remitente FROM avisos_correo WHERE id = 1`);
    llave = String((f as any[])[0]?.llave || '').trim();
    remitente = String((f as any[])[0]?.remitente || '').trim();
  } catch (err) {
    // Base a medio migrar: se sigue con el entorno en vez de dejar de avisar.
    console.error('[correo] no se pudo leer la cuenta del panel:', (err as any)?.message);
  }
  return {
    llave: llave || env.RESEND_API_KEY,
    remitente: remitente || env.EMAIL_FROM,
    delPanel: !!(llave && remitente),
  };
}

export async function correoHabilitado(): Promise<boolean> {
  const c = await cuentaDeCorreo();
  return !!(c.llave && c.remitente);
}

/** Los ultimos cuatro de la llave: lo unico de ella que puede salir al navegador. */
export function pistaDeLlave(llave: string): string {
  const l = (llave || '').trim();
  return l ? '••••' + l.slice(-4) : '';
}

/** "correo@dominio" o "Nombre <correo@dominio>", que es lo que acepta Resend. */
export function remitenteValido(v: string): boolean {
  const m = /^(?:([^<>]{1,80})\s*<([^<>\s]+)>|([^<>\s]+))$/.exec((v || '').trim());
  if (!m) return false;
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(m[2] || m[3]);
}

/** Lo que el correo NO puede llevar: una direccion por renglon o separada por comas. */
export function destinatariosDe(texto: string): string[] {
  return (texto || '')
    .split(/[,;\s]+/)
    .map((d) => d.trim())
    .filter((d) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(d));
}

export async function enviarCorreo(opts: { para: string[]; asunto: string; html: string }): Promise<Salida> {
  if (!opts.para.length) throw new Error('sin_destinatarios');
  const cuenta = await cuentaDeCorreo();
  if (!cuenta.llave || !cuenta.remitente) {
    console.warn(`[correo] sin cuenta de correo: NO se mando. Para: ${opts.para.join(', ')}`);
    console.warn(`[correo] Asunto: ${opts.asunto}`);
    console.warn(`[correo] Texto:\n${soloTexto(opts.html)}`);
    return 'registrado';
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cuenta.llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cuenta.remitente, to: opts.para, subject: opts.asunto, html: opts.html }),
  });
  if (!r.ok) {
    // El cuerpo de Resend dice QUE esta mal (dominio sin verificar, direccion
    // invalida); sin el, el panel solo podria ensenar un numero.
    const detalle = await r.text().catch(() => '');
    throw new Error(`Resend ${r.status}: ${detalle.slice(0, 300)}`);
  }
  return 'enviado';
}

function soloTexto(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h1|h2|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Nada de lo que escribe una persona -el nombre de un equipo, una nota- entra crudo. */
export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * La envoltura de los correos de Space Eye. Estilos EN LINEA y tabla de ancho
 * fijo: Gmail borra el <style> del encabezado y Outlook no entiende flex, asi
 * que lo que se ve bien en el navegador puede llegar deshecho.
 */
export function plantilla(titulo: string, cuerpo: string, pie?: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;
  font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="width:560px;max-width:100%;background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:20px 24px;background:#0a0a0a;color:#fff;font-size:15px;font-weight:600">
        SPACE EYE</td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 16px;font-size:18px;line-height:1.3">${esc(titulo)}</h1>
        ${cuerpo}
      </td></tr>
      <tr><td style="padding:16px 24px;background:#fafafa;color:#737373;font-size:12px;line-height:1.5">
        ${pie ?? 'Aviso automático de la vigilancia de pantallas. Para dejar de recibirlo, quita tu correo en Fallas → Avisos por correo.'}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** La direccion del panel para los enlaces del correo. */
export function panelBase(): string {
  return (env.PANEL_BASE_URL || env.PUBLIC_BASE_URL).replace(/\/+$/, '');
}

export function fecha(v: any): string {
  return new Date(v).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export function correoDeFallas(equipo: string, fallas: any[]): { asunto: string; html: string } {
  const titulo = fallas.length === 1
    ? `${equipo}: ${nombreDe(fallas[0].tipo, fallas[0].fila).toLowerCase()}`
    : `${equipo}: ${fallas.length} fallas`;
  const renglones = fallas.map((f) => `
    <tr>
      <td style="padding:8px 0;border-top:1px solid #e5e5e5;font-size:14px">
        <strong>${esc(nombreDe(f.tipo, f.fila))}</strong>${f.gabinete ? ` · gabinete ${esc(f.gabinete)}` : ''}
      </td>
      <td style="padding:8px 0;border-top:1px solid #e5e5e5;font-size:13px;color:#737373;text-align:right;white-space:nowrap">
        ${esc(fecha(f.detectada_en))}
      </td>
    </tr>`).join('');
  const html = plantilla(titulo, `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">El equipo <strong>${esc(equipo)}</strong>
      detectó esto al revisar su pantalla:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${renglones}</table>
    <p style="margin:20px 0 0;font-size:14px">
      <a href="${panelBase()}/fallas.html?device_id=${encodeURIComponent(fallas[0].device_id)}"
         style="display:inline-block;padding:10px 16px;background:#0a66ff;color:#fff;border-radius:8px;
                text-decoration:none">Ver la evidencia</a></p>`);
  return { asunto: `Space Eye — ${titulo}`, html };
}
