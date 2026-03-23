import { Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { Column, formatTable, statusDot, timeAgo } from '../../lib/format.js';
import { ensureLoggedIn } from '../../lib/project.js';

import type { Tunnel } from '@agentj/contracts';

const columns: Column<Tunnel>[] = [
  { header: 'STATUS', get: (t) => statusDot(t.status) },
  { header: 'ID', key: 'id' },
  { header: 'SUBDOMAIN', key: 'subdomain' },
  { header: 'PUBLIC URL', key: 'publicUrl' },
  { header: 'TARGET', get: (t) => `${t.targetHost}:${t.targetPort}` },
  { header: 'CREATED', get: (t) => timeAgo(t.createdAt) }
];

export default class TunnelList extends Command {
  static description = 'List accessible tunnels';

  static flags = {
    json: Flags.boolean({ description: 'Output as JSON', default: false })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TunnelList);
    const client = await loadApiClient();

    ensureLoggedIn(client);
    const tunnels = await client.listTunnels();

    if (flags.json) {
      this.log(JSON.stringify(tunnels, null, 2));
      return;
    }

    if (tunnels.length === 0) {
      this.log('No tunnels found.');
      return;
    }

    this.log(formatTable(tunnels, columns));
  }
}
