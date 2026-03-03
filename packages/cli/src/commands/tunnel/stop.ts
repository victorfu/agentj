import { Args, Command } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { ensureLoggedIn } from '../../lib/project.js';

export default class TunnelStop extends Command {
  static description = 'Stop a tunnel';

  static args = {
    tunnelId: Args.string({ required: true, description: 'Tunnel ID to stop' })
  };

  async run(): Promise<void> {
    const { args } = await this.parse(TunnelStop);
    const client = await loadApiClient();

    ensureLoggedIn(client);
    await client.stopTunnel(args.tunnelId);
    this.log(`Stopped tunnel ${args.tunnelId}`);
  }
}
