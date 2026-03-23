import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { resolveCliConfig } from '../../lib/config.js';
import { computeReconnectDelayMs, mapGatewayCloseAction, runAgent } from '../../lib/gateway-agent.js';
import { resolveLocalHttpTarget } from '../../lib/http-target.js';
import { resolveLineChannel } from '../../lib/line-channel-resolver.js';
import { ensureLoggedIn } from '../../lib/project.js';

const STABLE_CONNECTION_RESET_MS = 30000;

export default class LineConnect extends Command {
  static description = 'Reconnect to an existing LINE channel tunnel (no credentials needed)';

  static aliases = ['line:connect'];

  static args = {
    channel: Args.string({
      required: false,
      description: 'Channel name, LINE Channel ID, or internal ID (auto-selected if only one exists)'
    }),
    target: Args.string({
      required: false,
      description: 'Local address:port or port (defaults to tunnel\'s original target)'
    })
  };

  static flags = {
    host: Flags.string({
      default: '127.0.0.1',
      description: 'Default local host when TARGET is only a port'
    }),
    sync: Flags.boolean({
      default: true,
      description: 'Sync LINE webhook before connecting',
      allowNo: true
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LineConnect);

    const client = await loadApiClient();
    const config = resolveCliConfig();
    ensureLoggedIn(client);

    const channel = await resolveLineChannel(client, args.channel);
    this.log(`Channel: ${channel.name} (${channel.lineChannelId})`);

    // Resolve target: user override or tunnel's stored target
    let targetHost: string;
    let targetPort: number;

    if (args.target) {
      const target = resolveLocalHttpTarget(args.target, flags.host);
      targetHost = target.host;
      targetPort = target.port;
    } else {
      const tunnels = await client.listTunnels();
      const tunnel = tunnels.find((t) => t.id === channel.tunnelId);
      if (!tunnel) {
        throw new Error(
          `Tunnel ${channel.tunnelId} not found. Run "agentj line init" to create a new setup.`
        );
      }
      targetHost = tunnel.targetHost;
      targetPort = tunnel.targetPort;
    }

    this.log(`Forwarding: → http://${targetHost}:${targetPort}`);

    if (flags.sync) {
      try {
        const synced = await client.syncLineWebhook(channel.id);
        const status = synced.webhookActive ? 'active' : 'inactive';
        this.log(`Webhook synced: ${synced.endpoint} (${status})`);
      } catch (error) {
        this.warn(`Webhook sync failed: ${(error as Error).message}. Continuing anyway.`);
      }
    }

    let retryAttempt = 0;

    while (true) {
      let connectToken: string;
      let gatewayWebsocketUrl: string;

      try {
        const connect = await client.createConnectToken(channel.tunnelId);
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
          tunnelId: channel.tunnelId,
          gatewayWebsocketUrl,
          targetHost,
          targetPort
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
