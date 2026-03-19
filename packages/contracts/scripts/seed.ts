import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { createDb, createPool } from '../src/db/client.js';
import { users, workspaceMembers, workspaces } from '../src/db/schema.js';

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

  let workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.createdBy, ensuredUserId)
  });

  if (!workspace) {
    const workspaceId = `ws_${randomUUID()}`;
    await db.insert(workspaces).values({
      id: workspaceId,
      name: 'Dev Workspace',
      createdBy: ensuredUserId
    });
    workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId)
    });
  }

  if (!workspace) {
    throw new Error('Failed to resolve workspace in seed');
  }

  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.workspaceId, workspace.id)
  });

  if (!membership) {
    await db.insert(workspaceMembers).values({
      id: `wm_${randomUUID()}`,
      workspaceId: workspace.id,
      userId: ensuredUserId,
      role: 'owner'
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
