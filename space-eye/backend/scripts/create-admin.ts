// backend/scripts/create-admin.ts
import bcrypt from 'bcrypt';
import { pool } from '../src/config/database';

async function createAdmin() {
  const email = process.argv[2] || 'admin@spaceeye.app';
  const password = process.argv[3] || 'admin123456';
  const name = process.argv[4] || 'Administrador';

  const hash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'admin'))
       ON DUPLICATE KEY UPDATE password_hash = ?, full_name = ?`,
      [email, hash, name, hash, name]
    );
    console.log(`Admin created/updated:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();
