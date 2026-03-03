import { Args, Command, Flags } from '@oclif/core';

import { resolveCliConfig } from '../lib/config.js';
import { saveToken } from '../lib/token-store.js';

export default class Login extends Command {
  static description = 'Store a Personal Access Token for CLI use';

  static aliases = ['authtoken', 'config:add-authtoken'];

  static args = {
    token: Args.string({
      required: false,
      description: 'Personal access token'
    })
  };

  static flags = {
    token: Flags.string({
      char: 't',
      description: 'Personal access token',
      required: false
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Login);
    const token = flags.token ?? args.token;
    if (!token) {
      throw new Error('Token is required. Provide `--token <PAT>` or `aj authtoken <PAT>`.');
    }

    const config = resolveCliConfig();
    await saveToken(token, config.configFile);
    this.log(`Authtoken saved to config file: ${config.configFile}`);
  }
}
