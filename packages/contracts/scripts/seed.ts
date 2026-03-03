import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { createDb, createPool } from '../src/db/client.js';
import { users } from '../src/db/schema.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  const userId = `usr_${randomUUID()}`;

  const existingUser = await db.query.users.findFirst({ where: eq(users.email, 'dev@agentj.local') });

  const ensuredUserId = existingUser?.id ?? userId;

  if (!existingUser) {
    await db.insert(users).values({
      id: ensuredUserId,
      email: 'dev@agentj.local',
      name: 'Dev User'
    });
  }

  console.log('Seed complete');
  console.log(`Seed user: ${ensuredUserId} (dev@agentj.local)`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
