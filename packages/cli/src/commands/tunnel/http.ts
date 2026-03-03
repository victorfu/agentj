import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { runAgent } from '../../lib/gateway-agent.js';
import { resolveLocalHttpTarget } from '../../lib/http-target.js';
import { ensureLoggedIn } from '../../lib/project.js';
import { resolveCliConfig } from '../../lib/config.js';

export default class TunnelHttp extends Command {
  static description = 'Expose a local HTTP server through Agentj tunnel';

  static aliases = ['http'];

  static args = {
    target: Args.string({ required: true, description: 'Local address:port or port' })
  };

  static flags = {
    host: Flags.string({
      default: '127.0.0.1',
      description: 'Default local host when TARGET is only a port'
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(TunnelHttp);
    const client = await loadApiClient();
    const config = resolveCliConfig();

    const target = resolveLocalHttpTarget(args.target, flags.host);

    ensureLoggedIn(client);

    const tunnel = await client.createTunnel({
      targetHost: target.host,
      targetPort: target.port
    });

    const connect = await client.createConnectToken(tunnel.id);

    this.log(`Tunnel: ${tunnel.id}`);
    this.log(`Forwarding: ${tunnel.publicUrl} -> http://${target.host}:${target.port}`);

    await runAgent({
      connectToken: connect.connectToken,
      tunnelId: tunnel.id,
      gatewayWebsocketUrl: connect.gatewayWebsocketUrl || config.gatewayUrl,
      targetHost: target.host,
      targetPort: target.port
    });
  }
}
