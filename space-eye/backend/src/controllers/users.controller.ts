// backend/src/controllers/users.controller.ts
// Gestion de usuarios (solo admin). Listar, crear y habilitar/deshabilitar.
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { z } from 'zod';

export async function listUsers(_req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.email, u.full_name, u.active, u.last_login_at, u.created_at, r.name as role
     FROM users u JOIN roles r ON u.role_id = r.id
     ORDER BY u.created_at DESC`
  );
  res.json({ users: rows });
}

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
  role: z.enum(['admin', 'operator', 'viewer']),
});
export async function createUser(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  const { email, full_name, password, role } = parsed.data;

  const [exists] = await pool.query<any[]>(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
  if ((exists as any[])[0]) return res.status(409).json({ error: 'email_exists' });

  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query<any>(
    `INSERT INTO users (email, password_hash, full_name, role_id, active)
     VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?), TRUE)`,
    [email, hash, full_name, role]
  );
  res.json({ id: (result as any).insertId, email, full_name, role, active: true });
}

const updateSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  full_name: z.string().min(1).optional(),
});
export async function updateUser(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const id = Number(req.params.id);
  // No permitir que un admin se deshabilite a si mismo (evita quedarse fuera).
  if (id === req.user!.uid && parsed.data.active === false) {
    return res.status(400).json({ error: 'cannot_disable_self' });
  }

  const sets: string[] = [];
  const values: any[] = [];
  if (parsed.data.active !== undefined) { sets.push('active = ?'); values.push(parsed.data.active); }
  if (parsed.data.full_name !== undefined) { sets.push('full_name = ?'); values.push(parsed.data.full_name); }
  if (parsed.data.role !== undefined) { sets.push('role_id = (SELECT id FROM roles WHERE name = ?)'); values.push(parsed.data.role); }
  if (sets.length === 0) return res.status(400).json({ error: 'no_fields' });

  const [r] = await pool.query<any>(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
  if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'not_found' });
  // Si se deshabilita, revoca sus sesiones.
  if (parsed.data.active === false) {
    await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?`, [id]);
  }
  res.json({ ok: true });
}
