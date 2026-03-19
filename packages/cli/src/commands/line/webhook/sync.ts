import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../../lib/client.js';
import { ensureLoggedIn } from '../../../lib/project.js';

export default class LineWebhookSync extends Command {
  static description = 'Sync LINE webhook endpoint and optionally run LINE webhook test';

  static aliases = ['line:webhook:sync'];

  static args = {
    channelId: Args.string({ required: true, description: 'LINE channel id' })
  };

  static flags = {
    test: Flags.boolean({ default: true, description: 'Run webhook test after sync' })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LineWebhookSync);
    const client = await loadApiClient();
    ensureLoggedIn(client);

    const synced = await client.syncLineWebhook(args.channelId);
    this.log(JSON.stringify({ synced }, null, 2));

    if (flags.test) {
      const tested = await client.testLineWebhook(args.channelId);
      this.log(JSON.stringify({ tested }, null, 2));
    }
  }
}
