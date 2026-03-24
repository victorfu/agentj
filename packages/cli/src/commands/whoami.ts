import { Command, Flags } from '@oclif/core';

import { loadApiClient } from '../lib/client.js';

export default class WhoAmI extends Command {
  static description = 'Verify token and print current identity';

  static flags = {
    json: Flags.boolean({ description: 'Output as JSON', default: false })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WhoAmI);
    const client = await loadApiClient();
    if (!client.token) {
      throw new Error('No token found. Run `agentj-cli login <PAT>` first.');
    }

    const me = await client.me();

    if (flags.json) {
      this.log(JSON.stringify(me, null, 2));
      return;
    }

    this.log(`Logged in as ${me.user.name} (${me.user.email})`);
  }
}
