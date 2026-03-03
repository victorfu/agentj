import { and, desc, eq, inArray } from 'drizzle-orm';

import { orgMemberships, tunnels } from '@agentj/contracts';

import { db } from './db';

async function listAccessibleOrgIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ orgId: orgMemberships.orgId })
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId));

  if (memberships.length === 0) {
    return [];
  }

  return memberships.map((membership) => membership.orgId);
}

export async function resolveDefaultOrgId(userId: string): Promise<string | null> {
  const [firstMembership] = await db
    .select({ orgId: orgMemberships.orgId })
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .orderBy(desc(orgMemberships.createdAt))
    .limit(1);

  if (!firstMembership) {
    return null;
  }

  return firstMembership.orgId;
}

export async function listAccessibleTunnels(userId: string): Promise<Array<typeof tunnels.$inferSelect>> {
  const orgIds = await listAccessibleOrgIds(userId);
  if (orgIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(tunnels)
    .where(inArray(tunnels.orgId, orgIds))
    .orderBy(desc(tunnels.createdAt));
}

export async function findAccessibleTunnel(
  userId: string,
  tunnelId: string
): Promise<typeof tunnels.$inferSelect | null> {
  const orgIds = await listAccessibleOrgIds(userId);
  if (orgIds.length === 0) {
    return null;
  }

  return (
    (await db.query.tunnels.findFirst({
      where: and(eq(tunnels.id, tunnelId), inArray(tunnels.orgId, orgIds))
    })) ?? null
  );
}
