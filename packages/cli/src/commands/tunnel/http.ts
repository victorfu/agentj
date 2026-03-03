import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { resolveCliConfig } from '../../lib/config.js';
import { runAgent } from '../../lib/gateway-agent.js';

export default class TunnelHttp extends Command {
  static description = 'Expose a local HTTP server through Agentj tunnel';

  static args = {
    localPort: Args.integer({ required: true, description: 'Local HTTP port' })
  };

  static flags = {
    project: Flags.string({ required: true, description: 'Project ID' }),
    host: Flags.string({ default: '127.0.0.1', description: 'Local host target' })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TunnelHttp);
    const client = await loadApiClient();
    const config = resolveCliConfig();

    if (!client.token) {
      throw new Error('No token found. Run `aj login --token <PAT>` first.');
    }

    const tunnel = await client.createTunnel(flags.project, {
      targetHost: flags.host,
      targetPort: args.localPort
    });

    const connect = await client.createConnectToken(flags.project, tunnel.id);

    this.log(`Tunnel: ${tunnel.id}`);
    this.log(`Public URL: ${tunnel.publicUrl}`);

    await runAgent({
      connectToken: connect.connectToken,
      tunnelId: tunnel.id,
      gatewayWebsocketUrl: connect.gatewayWebsocketUrl || config.gatewayUrl,
      targetHost: flags.host,
      targetPort: args.localPort
    });
  }
}
