import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { resolveCliConfig } from '../../lib/config.js';
import { computeReconnectDelayMs, mapGatewayCloseAction, runAgent } from '../../lib/gateway-agent.js';
import { resolveLocalHttpTarget } from '../../lib/http-target.js';
import { saveToken } from '../../lib/token-store.js';

const STABLE_CONNECTION_RESET_MS = 30000;

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

    if (!client.token) {
      this.log('No account found. Provisioning anonymous access...');
      try {
        const result = await client.provisionAnonymous();
        await saveToken(result.token, config.configFile);
        client.setToken(result.token);
        this.log(`Anonymous mode active (1 tunnel max). Register at ${config.appBaseUrl} for full features.`);
      } catch (error) {
        this.error(`Failed to provision anonymous access: ${(error as Error).message}`);
      }
    }

    const tunnel = await client.createTunnel({
      targetHost: target.host,
      targetPort: target.port
    });

    this.log(`Tunnel: ${tunnel.id}`);
    this.log(`Forwarding: ${tunnel.publicUrl} -> http://${target.host}:${target.port}`);

    let retryAttempt = 0;

    while (true) {
      let connectToken: string;
      let gatewayWebsocketUrl: string;

      try {
        const connect = await client.createConnectToken(tunnel.id);
        connectToken = connect.connectToken;
        gatewayWebsocketUrl = connect.gatewayWebsocketUrl || config.gatewayUrl;
      } catch (error) {
        retryAttempt += 1;
        const delayMs = computeReconnectDelayMs(retryAttempt);
        this.warn(
          `Failed to fetch connect token (attempt ${retryAttempt}): ${(error as Error).message}. ` +
            `Retrying in ${delayMs}ms...`
        );
        await sleep(delayMs);
        continue;
      }

      let result: Awaited<ReturnType<typeof runAgent>>;
      try {
        result = await runAgent({
          connectToken,
          tunnelId: tunnel.id,
          gatewayWebsocketUrl,
          targetHost: target.host,
          targetPort: target.port
        });
      } catch (error) {
        retryAttempt += 1;
        const delayMs = computeReconnectDelayMs(retryAttempt);
        this.warn(
          `Gateway connection setup failed (attempt ${retryAttempt}): ${(error as Error).message}. ` +
            `Retrying in ${delayMs}ms...`
        );
        await sleep(delayMs);
        continue;
      }

      const closeAction = result.closeCode === null ? null : mapGatewayCloseAction(result.closeCode);
      if (closeAction) {
        this.warn(closeAction.message);
      }

      if (!result.retryable) {
        if (closeAction?.shouldExitNonZero) {
          process.exitCode = 1;
        }
        return;
      }

      if (result.connectedDurationMs >= STABLE_CONNECTION_RESET_MS) {
        retryAttempt = 0;
      }

      retryAttempt += 1;
      const delayMs = computeReconnectDelayMs(retryAttempt);
      const reason =
        result.closeCode === null
          ? `error: ${result.closeReason || 'unknown'}`
          : `close ${result.closeCode}${result.closeReason ? ` (${result.closeReason})` : ''}`;

      this.warn(`Gateway connection ended (${reason}). Reconnecting in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
