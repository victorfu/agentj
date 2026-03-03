import { Args, Command, Flags } from '@oclif/core';

import { loadApiClient } from '../lib/client.js';

export default class Logs extends Command {
  static description = 'Fetch tunnel request logs';

  static args = {
    tunnelId: Args.string({ required: true, description: 'Tunnel ID' })
  };

  static flags = {
    project: Flags.string({ required: true, description: 'Project ID' }),
    follow: Flags.boolean({ default: false, description: 'Poll for new logs' })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Logs);
    const client = await loadApiClient();

    let cursor: string | undefined;
    const seen = new Set<string>();

    const render = (items: Array<{ id: string; method: string; path: string; statusCode: number | null; latencyMs: number | null }>): void => {
      for (const item of items) {
        if (seen.has(item.id)) {
          continue;
        }
        seen.add(item.id);
        this.log(`${item.id}\t${item.method}\t${item.path}\t${item.statusCode ?? '-'}\t${item.latencyMs ?? '-'}ms`);
      }
    };

    let keepPolling = true;
    while (keepPolling) {
      const page = await client.listRequestLogs(
        flags.project,
        args.tunnelId,
        flags.follow ? undefined : cursor
      );
      render(page.items);
      if (!flags.follow) {
        cursor = page.nextCursor ?? undefined;
        if (!cursor) {
          keepPolling = false;
          continue;
        }
      }

      if (flags.follow) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}
