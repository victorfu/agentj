import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { users } from '@agentj/contracts';

import { db } from './db';

const MVP_USER_EMAIL = 'dev@agentj.local';
const MVP_USER_NAME = 'Dev User';

export async function ensureMvpUser(): Promise<typeof users.$inferSelect> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, MVP_USER_EMAIL),
  });
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      id: `usr_${randomUUID()}`,
      email: MVP_USER_EMAIL,
      name: MVP_USER_NAME,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const resolved = await db.query.users.findFirst({
    where: eq(users.email, MVP_USER_EMAIL),
  });
  if (!resolved) {
    throw new Error('Failed to resolve MVP user');
  }

  return resolved;
}
