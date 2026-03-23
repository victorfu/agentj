import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { Column, formatTable } from '../../lib/format.js';
import { ensureLoggedIn } from '../../lib/project.js';

import type { LineChannel } from '@agentj/contracts';

const columns: Column<LineChannel>[] = [
  { header: 'NAME', key: 'name' },
  { header: 'LINE CHANNEL ID', key: 'lineChannelId' },
  { header: 'MODE', key: 'mode' },
  {
    header: 'WEBHOOK',
    get: (ch) => (ch.webhookActive ? 'active' : 'inactive')
  },
  { header: 'PATH', key: 'webhookPath' }
];

export default class LineStatus extends Command {
  static description = 'Show LINE channel status and webhook info';

  static aliases = ['line:status'];

  static args = {
    channelId: Args.string({ required: false, description: 'LINE channel id' })
  };

  static flags = {
    json: Flags.boolean({ description: 'Output as JSON', default: false })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LineStatus);
    const client = await loadApiClient();
    ensureLoggedIn(client);

    if (args.channelId) {
      const [channel, webhook] = await Promise.all([
        client.getLineChannel(args.channelId),
        client.getLineWebhook(args.channelId)
      ]);

      if (flags.json) {
        this.log(JSON.stringify({ channel, webhook }, null, 2));
        return;
      }

      this.log(`Channel:    ${channel.name} (${channel.lineChannelId})`);
      this.log(`Mode:       ${channel.mode}`);
      this.log(`Webhook:    ${channel.webhookActive ? 'active' : 'inactive'}`);
      this.log(`Endpoint:   ${channel.webhookUrl ?? '—'}`);
      this.log(`Path:       ${channel.webhookPath}`);
      this.log(`Tunnel:     ${channel.tunnelId}`);
      return;
    }

    const channels = await client.listLineChannels();

    if (flags.json) {
      this.log(JSON.stringify(channels, null, 2));
      return;
    }

    if (channels.length === 0) {
      this.log('No LINE channels found.');
      return;
    }

    this.log(formatTable(channels, columns));
  }
}
