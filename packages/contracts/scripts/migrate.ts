import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPool } from '../src/db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = createPool(databaseUrl);
  const sqlFile = resolve(__dirname, '../src/db/migrations/0001_initial.sql');
  const sql = await readFile(sqlFile, 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied: 0001_initial.sql');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
