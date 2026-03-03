import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';

export default class TunnelStop extends Command {
  static description = 'Stop a tunnel';

  static args = {
    tunnelId: Args.string({ required: true, description: 'Tunnel ID to stop' })
  };

  static flags = {
    project: Flags.string({ required: true, description: 'Project ID' })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TunnelStop);
    const client = await loadApiClient();
    await client.stopTunnel(flags.project, args.tunnelId);
    this.log(`Stopped tunnel ${args.tunnelId}`);
  }
}
