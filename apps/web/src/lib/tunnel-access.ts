import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { tunnels, tunnelSessions } from '@agentj/contracts';

import { getWebEnv } from './env';
import { db } from './db';
import { deriveTunnelOnlineGraceMs, deriveTunnelStatus } from './tunnel-status';

type TunnelRow = typeof tunnels.$inferSelect;

async function withDerivedStatuses(rows: TunnelRow[]): Promise<TunnelRow[]> {
  if (rows.length === 0) {
    return rows;
  }

  const tunnelIds = rows.map((row) => row.id);
  const sessionRows = await db
    .select({
      tunnelId: tunnelSessions.tunnelId,
      lastHeartbeatAt: sql<Date | string>`max(${tunnelSessions.lastHeartbeatAt})`.as('last_heartbeat_at')
    })
    .from(tunnelSessions)
    .where(and(inArray(tunnelSessions.tunnelId, tunnelIds), isNull(tunnelSessions.disconnectReason)))
    .groupBy(tunnelSessions.tunnelId);

  const env = getWebEnv();
  const nowMs = Date.now();
  const onlineGraceMs = deriveTunnelOnlineGraceMs(
    env.AGENTJ_AGENT_PING_INTERVAL_MS,
    env.AGENTJ_AGENT_MAX_MISSED_PONGS,
    env.AGENTJ_TUNNEL_ONLINE_GRACE_MS
  );
  const lastHeartbeatByTunnelId = new Map(sessionRows.map((row) => [row.tunnelId, row.lastHeartbeatAt]));

  return rows.map((row) => {
    const derivedStatus = deriveTunnelStatus(
      row.status,
      lastHeartbeatByTunnelId.get(row.id) ?? null,
      nowMs,
      onlineGraceMs
    );

    if (derivedStatus === row.status) {
      return row;
    }

    return {
      ...row,
      status: derivedStatus
    };
  });
}

export async function listAccessibleTunnels(
  userId: string,
  patTokenId: string
): Promise<TunnelRow[]> {
  const rows = await db
    .select()
    .from(tunnels)
    .where(and(eq(tunnels.createdBy, userId), eq(tunnels.patTokenId, patTokenId)))
    .orderBy(desc(tunnels.createdAt));

  return withDerivedStatuses(rows);
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
