// ============================================================================
//  Codigos de vinculacion desde el panel (SPACE OS > Space Eyes > Agregar).
// ----------------------------------------------------------------------------
//  POST   /api/vinculaciones          genera uno para un tipo de equipo
//  GET    /api/vinculaciones          los vigentes y los ultimos usados
//  DELETE /api/vinculaciones/:codigo  lo cancela
//
//  Quien lo genero: con la llave de la instancia (SPACE OS) el usuario real
//  viaja en la cabecera X-SpaceOS-Usuario, que pone la puerta de SPACE OS; con
//  sesion propia de Space Eye, el usuario de la sesion.
// ============================================================================
import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import { env } from '../config/env';
import { duenoPorOmision } from '../utils/instancia';
import * as vinc from '../utils/vinculaciones';

function autor(req: Request): string {
  if ((req as any).servicio) {
    const u = String(req.headers['x-spaceos-usuario'] || '').slice(0, 150).trim();
    return u ? `SPACE OS · ${u}` : 'SPACE OS';
  }
  return String(req.user?.uid || '').slice(0, 190);
}

function presentar(f: any) {
  const ahora = Date.now();
  const estado = f.usado_en ? 'usado'
    : f.cancelado_en ? 'cancelado'
    : new Date(f.expira_en).getTime() <= ahora ? 'vencido'
    : 'vigente';
  return {
    codigo: vinc.mostrar(f.codigo),
    tipo: f.tipo,
    nota: f.nota,
    estado,
    creado_por: f.creado_por,
    creado_en: f.creado_en,
    expira_en: f.expira_en,
    usado_en: f.usado_en,
    equipo: f.device_id ? { id: f.device_id, nombre: f.nombre_equipo ?? null } : null,
  };
}

const crearSchema = z.object({
  tipo: z.enum(['telefono', 'raspberry', 'pc']),
  nota: z.string().trim().max(120).optional(),
});

export async function crear(req: Request, res: Response) {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const { tipo, nota } = parsed.data;
  const minutos = vinc.VIGENCIA_MIN[tipo];

  // Un choque de codigo es casi imposible (5e11), pero si pasa se reintenta en
  // vez de devolver un error: el UNIQUE de la tabla es quien decide.
  for (let intento = 0; intento < 5; intento++) {
    const codigo = vinc.generarCodigo();
    try {
      await pool.query(
        `INSERT INTO vinculaciones (codigo, tipo, owner, nota, creado_por, expira_en)
         VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL ? MINUTE)`,
        [codigo, tipo, duenoPorOmision(), nota || null, autor(req), minutos]
      );
      const [filas] = await pool.query<any[]>(`SELECT * FROM vinculaciones WHERE codigo = ?`, [codigo]);
      const servidor = env.PUBLIC_BASE_URL || '';
      return res.status(201).json({
        ...presentar((filas as any[])[0]),
        servidor,
        // Lo que se pone en el QR del telefono: trae el servidor y el codigo,
        // asi un mismo APK sirve para todas las empresas.
        enlace: vinc.enlaceDeVinculacion(servidor, codigo),
      });
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  return res.status(500).json({ error: 'no_se_pudo_generar' });
}

export async function listar(_req: Request, res: Response) {
  const [filas] = await pool.query<any[]>(
    `SELECT v.*, d.name AS nombre_equipo FROM vinculaciones v
       LEFT JOIN devices d ON d.id = v.device_id
      WHERE (v.usado_en IS NULL AND v.cancelado_en IS NULL AND v.expira_en > NOW())
         OR v.creado_en > NOW() - INTERVAL 30 DAY
      ORDER BY v.creado_en DESC LIMIT 100`
  );
  res.json({ vinculaciones: (filas as any[]).map(presentar), servidor: env.PUBLIC_BASE_URL || '' });
}

export async function cancelar(req: Request, res: Response) {
  const codigo = vinc.normalizar(req.params.codigo);
  if (!codigo) return res.status(400).json({ error: 'invalid_input' });
  const [r] = await pool.query<any>(
    `UPDATE vinculaciones SET cancelado_en = NOW() WHERE codigo = ? AND usado_en IS NULL AND cancelado_en IS NULL`,
    [codigo]
  );
  if (!(r as any).affectedRows) return res.status(404).json({ error: 'no_vigente' });
  res.json({ ok: true });
}
