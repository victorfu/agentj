import { Args, Command, Flags } from '@oclif/core';
import { ux } from '@oclif/core';

import { loadApiClient } from '../../../lib/client.js';
import { ensureLoggedIn } from '../../../lib/project.js';

export default class LineWebhookSync extends Command {
  static description = 'Sync LINE webhook endpoint and optionally run LINE webhook test';

  static aliases = ['line:webhook:sync'];

  static args = {
    channelId: Args.string({ required: true, description: 'LINE channel id' })
  };

  static flags = {
    test: Flags.boolean({ default: true, description: 'Run webhook test after sync' }),
    json: Flags.boolean({ description: 'Output as JSON', default: false })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LineWebhookSync);
    const client = await loadApiClient();
    ensureLoggedIn(client);

    const synced = await client.syncLineWebhook(args.channelId);

    if (flags.json) {
      const result: Record<string, unknown> = { synced };
      if (flags.test) {
        result.tested = await client.testLineWebhook(args.channelId);
      }
      this.log(JSON.stringify(result, null, 2));
      return;
    }

    const syncStatus = synced.webhookActive
      ? ux.colorize('green', 'active')
      : ux.colorize('yellow', 'inactive');
    this.log(`Webhook synced → ${synced.endpoint} (${syncStatus})`);

    if (flags.test) {
      const tested = await client.testLineWebhook(args.channelId);
      const testStatus = tested.ok
        ? ux.colorize('green', 'passed')
        : ux.colorize('red', 'failed');
      this.log(`Webhook test: ${testStatus}`);
    }
  }
}
