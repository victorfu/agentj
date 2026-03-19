import { Args, Command } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { ensureLoggedIn } from '../../lib/project.js';

export default class LineStatus extends Command {
  static description = 'Show LINE channel status and webhook info';

  static aliases = ['line:status'];

  static args = {
    channelId: Args.string({ required: false, description: 'LINE channel id' })
  };

  async run(): Promise<void> {
    const { args } = await this.parse(LineStatus);
    const client = await loadApiClient();
    ensureLoggedIn(client);

    if (args.channelId) {
      const [channel, webhook] = await Promise.all([
        client.getLineChannel(args.channelId),
        client.getLineWebhook(args.channelId)
      ]);

      this.log(JSON.stringify({ channel, webhook }, null, 2));
      return;
    }

    const channels = await client.listLineChannels();
    this.log(JSON.stringify(channels, null, 2));
  }
}
