import { randomUUID } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { getPatPrefix, hashPatToken } from '../src/auth/pat.js';
import { createDb, createPool } from '../src/db/client.js';
import { orgMemberships, orgs, patTokens, users } from '../src/db/schema.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const seedPat = process.env.SEED_PAT_TOKEN ?? process.env.AGENTJ_DEV_PAT_TOKEN ?? 'agentj_pat_dev_local_token';
  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  const userId = `usr_${randomUUID()}`;
  const orgId = `org_${randomUUID()}`;

  const existingUser = await db.query.users.findFirst({ where: eq(users.email, 'dev@agentj.local') });

  const ensuredUserId = existingUser?.id ?? userId;

  if (!existingUser) {
    await db.insert(users).values({
      id: ensuredUserId,
      email: 'dev@agentj.local',
      name: 'Dev User'
    });
  }

  const existingOrg = await db.query.orgs.findFirst({ where: eq(orgs.name, 'Dev Org') });
  const ensuredOrgId = existingOrg?.id ?? orgId;

  if (!existingOrg) {
    await db.insert(orgs).values({
      id: ensuredOrgId,
      name: 'Dev Org'
    });
  }

  const existingMembership = await db.query.orgMemberships.findFirst({
    where: and(eq(orgMemberships.orgId, ensuredOrgId), eq(orgMemberships.userId, ensuredUserId))
  });

  if (!existingMembership) {
    await db.insert(orgMemberships).values({
      id: `mem_${randomUUID()}`,
      orgId: ensuredOrgId,
      userId: ensuredUserId,
      role: 'owner'
    });
  }

  const tokenHash = hashPatToken(seedPat);
  const existingPat = await db.query.patTokens.findFirst({ where: eq(patTokens.tokenHash, tokenHash) });

  if (!existingPat) {
    await db
      .insert(patTokens)
      .values({
        id: `pat_${randomUUID()}`,
        userId: ensuredUserId,
        prefix: getPatPrefix(seedPat),
        tokenHash,
        scopes: ['tunnels:write', 'requests:read']
      })
      .onConflictDoNothing();
  }

  const activePatCount = await db
    .select({ id: patTokens.id })
    .from(patTokens)
    .where(and(eq(patTokens.userId, ensuredUserId), isNull(patTokens.revokedAt)));

  console.log('Seed complete');
  console.log(`PAT token: ${seedPat}`);
  console.log(`Active PAT count for dev user: ${activePatCount.length}`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
