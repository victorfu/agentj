import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../lib/client.js';
import { ensureLoggedIn } from '../lib/project.js';

export default class Logs extends Command {
  static description = 'Fetch tunnel request logs';

  static args = {
    tunnelId: Args.string({ required: true, description: 'Tunnel ID' })
  };

  static flags = {
    follow: Flags.boolean({ default: false, description: 'Poll for new logs' })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Logs);
    const client = await loadApiClient();

    ensureLoggedIn(client);
    const tunnelId = await this.resolveTunnelId(client, args.tunnelId);

    const render = (
      items: Array<{
        id: string;
        method: string;
        path: string;
        statusCode: number | null;
        latencyMs: number | null;
      }>
    ): void => {
      for (const item of items) {
        this.log(`${item.id}\t${item.method}\t${item.path}\t${item.statusCode ?? '-'}\t${item.latencyMs ?? '-'}ms`);
      }
    };

    const toCursor = (item: { id: string; startedAt: string }): string | undefined => {
      const startedAtMs = Date.parse(item.startedAt);
      if (!Number.isFinite(startedAtMs)) {
        return undefined;
      }
      return `${startedAtMs}:${item.id}`;
    };

    if (!flags.follow) {
      let cursor: string | undefined;
      while (true) {
        const page = await client.listRequestLogs(tunnelId, { cursor });
        render(page.items);
        cursor = page.nextCursor ?? undefined;
        if (!cursor) {
          return;
        }
      }
    }

    const initialPage = await client.listRequestLogs(tunnelId);
    render(initialPage.items);

    let after = initialPage.items[0] ? toCursor(initialPage.items[0]) : `${Date.now()}`;

    while (true) {
      let pageAfter = after;

      while (true) {
        const page = await client.listRequestLogs(tunnelId, { after: pageAfter });
        render(page.items);

        const tail = page.items[page.items.length - 1];
        const nextAfter = tail ? toCursor(tail) : undefined;
        if (nextAfter) {
          after = nextAfter;
          pageAfter = nextAfter;
        }

        if (!page.nextCursor) {
          break;
        }

        after = page.nextCursor;
        pageAfter = page.nextCursor;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private async resolveTunnelId(
    client: Awaited<ReturnType<typeof loadApiClient>>,
    input: string
  ): Promise<string> {
    if (input.startsWith('tun_')) {
      return input;
    }

    const tunnels = await client.listTunnels();
    const matched = tunnels.find((tunnel) => tunnel.subdomain === input);
    if (matched) {
      return matched.id;
    }

    this.error(
      `Tunnel "${input}" not found. Use a tunnel id (tun_...) or an existing subdomain.`
    );
  }
}
