import { Args, Command } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { ensureLoggedIn } from '../../lib/project.js';

export default class TunnelStop extends Command {
  static description = 'Stop a tunnel';

  static args = {
    tunnelId: Args.string({ required: true, description: 'Tunnel ID or subdomain' })
  };

  async run(): Promise<void> {
    const { args } = await this.parse(TunnelStop);
    const client = await loadApiClient();

    ensureLoggedIn(client);

    let tunnelId = args.tunnelId;

    // If it doesn't look like a tunnel ID, resolve subdomain to ID
    if (!tunnelId.startsWith('tun_')) {
      const tunnels = await client.listTunnels();
      const match = tunnels.find((t) => t.subdomain === tunnelId);
      if (!match) {
        this.error(`No tunnel found with subdomain "${tunnelId}"`);
      }

      tunnelId = match.id;
    }

    await client.stopTunnel(tunnelId);
    this.log(`Stopped tunnel ${tunnelId}`);
  }
}
