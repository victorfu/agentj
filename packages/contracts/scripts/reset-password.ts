import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

import { eq } from 'drizzle-orm';

import { createDb, createPool } from '../src/db/client.js';
import { users } from '../src/db/schema.js';

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const args = process.argv.slice(2).filter((a) => a !== '--');
  const [email, password] = args;
  if (!email || !password) {
    console.error('Usage: db:reset-password -- <email> <password>');
    process.exitCode = 1;
    return;
  }

  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  console.log(`Password reset for ${user.email} (${user.id})`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
