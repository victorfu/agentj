import { Command } from '@oclif/core';

import { loadApiClient } from '../lib/client.js';

export default class WhoAmI extends Command {
  static description = 'Verify token and print current identity';

  async run(): Promise<void> {
    const client = await loadApiClient();
    if (!client.token) {
      throw new Error('No token found. Run `aj login <PAT>` first.');
    }

    const me = await client.me();
    this.log(JSON.stringify(me, null, 2));
  }
}
