// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../config/database';
import { userJwt } from '../utils/jwt';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.password_hash, u.full_name, u.active, r.name as role
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.email = ? LIMIT 1`,
    [email]
  );

  const user = (rows as any[])[0];
  if (!user || !user.active) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const access = userJwt.sign({ uid: user.id, role: user.role }, 'access');
  const refresh = userJwt.sign({ uid: user.id, role: user.role }, 'refresh');

  const refreshHash = crypto.createHash('sha256').update(refresh).digest('hex');
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [user.id, refreshHash]
  );

  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

  res.json({
    access_token: access,
    refresh_token: refresh,
    user: { id: user.id, name: user.full_name, role: user.role },
  });
}

export async function refresh(req: Request, res: Response) {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'missing_refresh_token' });
  }

  try {
    const payload = userJwt.verify(refresh_token);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'invalid_token_type' });
    }

    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const [rows] = await pool.query<any[]>(
      `SELECT id FROM refresh_tokens
       WHERE user_id = ? AND token_hash = ? AND revoked = FALSE AND expires_at > NOW()
       LIMIT 1`,
      [payload.uid, tokenHash]
    );

    if (!(rows as any[])[0]) {
      return res.status(401).json({ error: 'invalid_refresh_token' });
    }

    const access = userJwt.sign({ uid: payload.uid, role: payload.role }, 'access');
    res.json({ access_token: access });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export async function logout(req: Request, res: Response) {
  const { refresh_token } = req.body;
  if (refresh_token) {
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    await pool.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?`,
      [tokenHash]
    );
  }
  res.json({ ok: true });
}

export async function me(req: Request, res: Response) {
  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.email, u.full_name, r.name as role
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [req.user!.uid]
  );
  const user = (rows as any[])[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  res.json(user);
}

// Cambia la contrasena del usuario autenticado (verifica la actual).
const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
});
export async function changePassword(req: Request, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });

  const [rows] = await pool.query<any[]>(`SELECT password_hash FROM users WHERE id = ?`, [req.user!.uid]);
  const user = (rows as any[])[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const ok = await bcrypt.compare(parsed.data.current_password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'current_password_incorrect' });

  const hash = await bcrypt.hash(parsed.data.new_password, 12);
  await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, req.user!.uid]);
  // Revoca las sesiones (refresh tokens) para forzar re-login en otros dispositivos.
  await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?`, [req.user!.uid]);
  res.json({ ok: true });
}
