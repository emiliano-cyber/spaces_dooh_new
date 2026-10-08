// backend/src/controllers/llaves.controller.ts
// Alta, listado y revocacion de las llaves de servicio.
//
// Solo admin (ver las rutas). Es la puerta por la que otro sistema lee Space
// Eye sin que haya que entregarle la cuenta admin y su contrasena.
import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database';
import { generar } from '../utils/llaveServicio';

export async function listar(_req: Request, res: Response) {
  // Nunca sale el hash. Lo que se muestra es el prefijo, que es justo lo que
  // permite reconocer una llave en una pantalla sin poder usarla.
  const [filas] = await pool.query<any[]>(
    `SELECT k.id, k.nombre, k.prefijo, k.escritura, k.owner, k.uso, k.creada_en, k.ultimo_uso,
            k.revocada_en, u.full_name AS creada_por
       FROM api_keys k
       LEFT JOIN users u ON u.id = k.creada_por
      ORDER BY k.revocada_en IS NOT NULL, k.creada_en DESC`
  );
  res.json({ llaves: filas });
}

export async function crear(req: Request, res: Response) {
  const esquema = z.object({
    nombre: z.string().min(3).max(100),
    // Hay que pedirlo a proposito: el valor seguro es el que no se escribe.
    escritura: z.boolean().optional().default(false),
    // Alcance. Sin esto la llave ve la FLOTA ENTERA, que es lo que necesita el
    // padre y nuestra propia operacion; para la llave de una instancia hay que
    // ponerlo, y es lo unico que la separa de ver camaras de otro cliente.
    owner: z.string().min(1).max(64).nullable().optional(),
    // 'alta' es el testigo que viaja dentro del instalador; solo sirve para
    // registrar un equipo y estamparle este dueno. Exige alcance: un testigo sin
    // dueno no sabria a quien asignar el equipo.
    uso: z.enum(['lectura', 'alta']).optional().default('lectura'),
  });
  const leido = esquema.safeParse(req.body);
  if (!leido.success) return res.status(400).json({ error: 'invalid_input', details: leido.error.flatten() });

  if (leido.data.uso === 'alta' && !leido.data.owner) {
    return res.status(400).json({ error: 'un_testigo_de_alta_exige_dueno' });
  }

  const { llave, prefijo, hash } = generar();
  const [r] = await pool.query<any>(
    `INSERT INTO api_keys (nombre, prefijo, hash, escritura, owner, uso, creada_por) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [leido.data.nombre, prefijo, hash, leido.data.escritura, leido.data.owner ?? null,
     leido.data.uso, req.user?.uid ?? null]
  );

  // La llave completa viaja UNA sola vez, aqui. No se guarda en ningun lado:
  // si se pierde, se revoca esta y se crea otra. Es a proposito — una llave que
  // se puede volver a consultar es una llave que se puede volver a filtrar.
  res.json({
    id: (r as any).insertId,
    nombre: leido.data.nombre,
    escritura: leido.data.escritura,
    owner: leido.data.owner ?? null,
    uso: leido.data.uso,
    llave,
    aviso: 'Guardala ahora: no se vuelve a mostrar.',
  });
}

export async function revocar(req: Request, res: Response) {
  // No se borra la fila: queda el rastro de que existio, quien la creo y cuando
  // se uso por ultima vez. Borrarla dejaria un hueco justo donde importa mirar.
  const [r] = await pool.query<any>(
    `UPDATE api_keys SET revocada_en = NOW() WHERE id = ? AND revocada_en IS NULL`,
    [req.params.id]
  );
  if ((r as any).affectedRows === 0) return res.status(404).json({ error: 'not_found_o_ya_revocada' });
  res.json({ ok: true });
}
