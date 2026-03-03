import { Command, Flags } from '@oclif/core';

import { resolveCliConfig } from '../lib/config.js';
import { saveToken } from '../lib/token-store.js';

export default class Login extends Command {
  static description = 'Store a Personal Access Token for CLI use';

  static flags = {
    token: Flags.string({
      char: 't',
      description: 'Personal access token',
      required: true
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);
    const config = resolveCliConfig();
    const backend = await saveToken(flags.token, config.tokenStorageFile);
    this.log(`Token saved via ${backend}`);
  }
}
