import { and, eq } from 'drizzle-orm';

import { lineChannels, tunnels } from '@agentj/contracts';

import { db } from './db';

export async function listAccessibleLineChannels(workspaceId: string) {
  return db.query.lineChannels.findMany({
    where: eq(lineChannels.workspaceId, workspaceId),
    orderBy: (fields, { desc }) => [desc(fields.createdAt)]
  });
}

export async function findAccessibleLineChannel(workspaceId: string, channelId: string) {
  return (
    (await db.query.lineChannels.findFirst({
      where: and(eq(lineChannels.id, channelId), eq(lineChannels.workspaceId, workspaceId))
    })) ?? null
  );
}

export async function findAccessibleLineChannelWithTunnel(workspaceId: string, channelId: string) {
  const channel = await findAccessibleLineChannel(workspaceId, channelId);
  if (!channel) {
    return null;
  }

  const tunnel = await db.query.tunnels.findFirst({
    where: and(eq(tunnels.id, channel.tunnelId), eq(tunnels.workspaceId, workspaceId))
  });

  if (!tunnel) {
    return null;
  }

  return { channel, tunnel };
}
