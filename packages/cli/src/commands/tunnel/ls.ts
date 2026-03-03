import { Command } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { ensureLoggedIn } from '../../lib/project.js';

export default class TunnelList extends Command {
  static description = 'List accessible tunnels';

  async run(): Promise<void> {
    await this.parse(TunnelList);
    const client = await loadApiClient();

    ensureLoggedIn(client);
    const tunnels = await client.listTunnels();
    this.log(JSON.stringify(tunnels, null, 2));
  }
}
