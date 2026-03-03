import { Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';

export default class TunnelList extends Command {
  static description = 'List tunnels in a project';

  static flags = {
    project: Flags.string({ required: true, description: 'Project ID' })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TunnelList);
    const client = await loadApiClient();
    const tunnels = await client.listTunnels(flags.project);
    this.log(JSON.stringify(tunnels, null, 2));
  }
}
