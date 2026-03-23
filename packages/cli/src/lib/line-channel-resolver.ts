import type { AgentjApiClient } from '@agentj/sdk';
import type { LineChannel } from '@agentj/contracts';

/**
 * Resolve a LINE channel by name, LINE Channel ID, or internal ID.
 * If no identifier is provided and exactly one channel exists, return it automatically.
 */
export async function resolveLineChannel(
  client: AgentjApiClient,
  identifier?: string
): Promise<LineChannel> {
  const channels = await client.listLineChannels();

  if (channels.length === 0) {
    throw new Error('No LINE channels found. Run "agentj line init" first.');
  }

  if (!identifier) {
    if (channels.length === 1) {
      return channels[0]!;
    }
    throw new Error(
      `Multiple LINE channels found. Specify one:\n${channels.map((c) => `  ${c.name} (${c.lineChannelId})`).join('\n')}`
    );
  }

  const match = channels.find(
    (c) => c.id === identifier || c.name === identifier || c.lineChannelId === identifier
  );

  if (!match) {
    throw new Error(
      `LINE channel "${identifier}" not found. Available:\n${channels.map((c) => `  ${c.name} (${c.lineChannelId})`).join('\n')}`
    );
  }

  return match;
}
