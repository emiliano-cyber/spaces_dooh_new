// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../config/database';
import { userJwt, UserTokenPayload } from '../utils/jwt';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Sesion deslizante: al refrescar se emite tambien un refresh token nuevo si al
// actual ya le queda poca vida. Asi quien usa el sistema no vuelve a capturar
// su contrasena cada 7 dias; solo caduca de verdad quien no entra en 7 dias.
// Con JWT_REFRESH_TTL=7d, renovar cuando quedan <6 dias significa como mucho un
// token nuevo al dia por navegador (y no uno por cada refresh, cada 15 min).
const RENOVAR_SI_QUEDA_MENOS_DE_MS = 6 * 24 * 60 * 60 * 1000;

// Guarda el hash de un refresh token con la MISMA caducidad que lleva el JWT
// dentro (asi la fila de la BD y el token nunca se desincronizan aunque cambie
// JWT_REFRESH_TTL).
async function guardarRefreshToken(userId: number, token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { exp } = userJwt.verify(token) as UserTokenPayload & { exp: number };
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, FROM_UNIXTIME(?))`,
    [userId, tokenHash, exp]
  );
}

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

  await guardarRefreshToken(user.id, refresh);

  // Limpieza: las filas ya caducadas no autorizan nada y la tabla solo crecia.
  await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)`);

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
      `SELECT id, expires_at FROM refresh_tokens
       WHERE user_id = ? AND token_hash = ? AND revoked = FALSE AND expires_at > NOW()
       LIMIT 1`,
      [payload.uid, tokenHash]
    );

    const fila = (rows as any[])[0];
    if (!fila) {
      return res.status(401).json({ error: 'invalid_refresh_token' });
    }

    const access = userJwt.sign({ uid: payload.uid, role: payload.role }, 'access');
    const respuesta: { access_token: string; refresh_token?: string } = { access_token: access };

    // Sesion deslizante (ver RENOVAR_SI_QUEDA_MENOS_DE_MS).
    const restanteMs = new Date(fila.expires_at).getTime() - Date.now();
    if (restanteMs < RENOVAR_SI_QUEDA_MENOS_DE_MS) {
      const nuevoRefresh = userJwt.sign({ uid: payload.uid, role: payload.role }, 'refresh');
      await guardarRefreshToken(payload.uid, nuevoRefresh);
      // El anterior NO se revoca: otra pestana del mismo navegador puede estar a
      // punto de usarlo y la cerrariamos sin motivo. Caduca solo (<=7 dias).
      respuesta.refresh_token = nuevoRefresh;
    }

    res.json(respuesta);
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
