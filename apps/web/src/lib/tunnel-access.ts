import { and, desc, eq } from 'drizzle-orm';

import { tunnels } from '@agentj/contracts';

import { db } from './db';

export async function listAccessibleTunnels(
  userId: string,
  patTokenId: string
): Promise<Array<typeof tunnels.$inferSelect>> {
  return db
    .select()
    .from(tunnels)
    .where(and(eq(tunnels.createdBy, userId), eq(tunnels.patTokenId, patTokenId)))
    .orderBy(desc(tunnels.createdAt));
}

export async function findAccessibleTunnel(
  userId: string,
  tunnelId: string,
  patTokenId: string
): Promise<typeof tunnels.$inferSelect | null> {
  return (
    (await db.query.tunnels.findFirst({
      where: and(eq(tunnels.id, tunnelId), eq(tunnels.createdBy, userId), eq(tunnels.patTokenId, patTokenId))
    })) ?? null
  );
}
