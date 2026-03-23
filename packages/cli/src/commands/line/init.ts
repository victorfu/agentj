import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { resolveCliConfig } from '../../lib/config.js';
import { computeReconnectDelayMs, mapGatewayCloseAction, runAgent } from '../../lib/gateway-agent.js';
import { resolveLocalHttpTarget } from '../../lib/http-target.js';
import { ensureLoggedIn } from '../../lib/project.js';

const STABLE_CONNECTION_RESET_MS = 30000;

export default class LineInit extends Command {
  static description = 'Create tunnel + LINE channel + webhook setup, then run the tunnel agent';

  static aliases = ['line:init'];

  static args = {
    target: Args.string({ required: true, description: 'Local address:port or port' })
  };

  static flags = {
    host: Flags.string({
      default: '127.0.0.1',
      description: 'Default local host when TARGET is only a port'
    }),
    name: Flags.string({ description: 'Display name for LINE channel record' }),
    channelId: Flags.string({ description: 'LINE Channel ID' }),
    channelSecret: Flags.string({ description: 'LINE Channel Secret' }),
    channelAccessToken: Flags.string({ description: 'LINE Channel access token' }),
    mode: Flags.string({
      options: ['relay', 'managed'],
      default: 'relay',
      description: 'Webhook mode'
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LineInit);

    const client = await loadApiClient();
    const config = resolveCliConfig();
    ensureLoggedIn(client);

    const target = resolveLocalHttpTarget(args.target, flags.host);
    const tunnel = await client.createTunnel({
      targetHost: target.host,
      targetPort: target.port
    });

    this.log(`Tunnel: ${tunnel.id}`);
    this.log(`Forwarding: ${tunnel.publicUrl} -> http://${target.host}:${target.port}`);

    const rl = createInterface({ input, output });
    try {
      const lineChannelId = flags.channelId ?? (await rl.question('LINE Channel ID: ')).trim();
      const channelSecret = flags.channelSecret ?? (await rl.question('LINE Channel secret: ')).trim();
      const channelAccessToken =
        flags.channelAccessToken ?? (await rl.question('LINE Channel access token: ')).trim();

      if (!lineChannelId || !channelSecret || !channelAccessToken) {
        throw new Error('LINE channelId/channelSecret/channelAccessToken are required');
      }

      const defaultName = flags.name ?? `line-${tunnel.subdomain}`;
      const promptedName = flags.name ?? (await rl.question(`Channel name [${defaultName}]: `)).trim();
      const chosenName = promptedName || defaultName;

      const lineChannel = await client.createLineChannel({
        name: chosenName,
        tunnelId: tunnel.id,
        lineChannelId,
        channelSecret,
        channelAccessToken,
        mode: flags.mode as 'relay' | 'managed'
      });

      this.log(`LINE channel created: ${lineChannel.id}`);
      this.log(`Expected webhook URL: ${lineChannel.webhookUrl ?? '(unknown)'}`);

      try {
        const synced = await client.syncLineWebhook(lineChannel.id);
        this.log(`Webhook synced: ${synced.endpoint}`);

        const tested = await client.testLineWebhook(lineChannel.id);
        this.log(`Webhook test status: ${tested.ok ? 'ok' : 'not ok'}`);
        if (tested.lineRequestId) {
          this.log(`LINE request id: ${tested.lineRequestId}`);
        }
      } catch (error) {
        this.warn(
          `Webhook sync failed: ${(error as Error).message}. The tunnel agent will still start, but LINE events will not arrive until the webhook is synced. Run "agentj line webhook sync" after configuring HTTPS.`
        );
      }
    } finally {
      rl.close();
    }

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
