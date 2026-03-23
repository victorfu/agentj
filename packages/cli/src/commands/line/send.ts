import { readFile } from 'node:fs/promises';

import { Args, Command, Flags } from '@oclif/core';
import { ux } from '@oclif/core';

import { loadApiClient } from '../../lib/client.js';
import { resolveLineChannel } from '../../lib/line-channel-resolver.js';
import { ensureLoggedIn } from '../../lib/project.js';

export default class LineSend extends Command {
  static description = 'Send LINE message via control plane (reply/push/multicast/broadcast)';

  static aliases = ['line:send'];

  static args = {
    channel: Args.string({
      required: true,
      description: 'Channel name, LINE Channel ID, or internal ID'
    }),
    type: Args.string({
      required: true,
      description: 'Message type: reply | push | multicast | broadcast',
      options: ['reply', 'push', 'multicast', 'broadcast']
    })
  };

  static flags = {
    body: Flags.string({ description: 'Raw JSON body string' }),
    bodyFile: Flags.string({ description: 'Path to JSON body file' }),
    json: Flags.boolean({ description: 'Output as JSON', default: false })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LineSend);
    const client = await loadApiClient();
    ensureLoggedIn(client);

    const channel = await resolveLineChannel(client, args.channel);
    const body = await this.resolveBody(flags.body, flags.bodyFile);

    let response;
    switch (args.type) {
      case 'reply':
        response = await client.lineReply(channel.id, body);
        break;
      case 'push':
        response = await client.linePush(channel.id, body);
        break;
      case 'multicast':
        response = await client.lineMulticast(channel.id, body);
        break;
      case 'broadcast':
        response = await client.lineBroadcast(channel.id, body);
        break;
      default:
        throw new Error(`Unsupported message type: ${args.type}`);
    }

    if (flags.json) {
      this.log(JSON.stringify(response, null, 2));
      return;
    }

    const status = response.ok ? ux.colorize('green', 'OK') : ux.colorize('red', 'FAILED');
    this.log(`${args.type} ${status}`);
    if (response.lineRequestId) {
      this.log(`Request ID: ${response.lineRequestId}`);
    }
  }

  private async resolveBody(
    bodyFlag: string | undefined,
    bodyFileFlag: string | undefined
  ): Promise<Record<string, unknown>> {
    if (bodyFlag && bodyFileFlag) {
      throw new Error('Use either --body or --body-file, not both');
    }

    if (!bodyFlag && !bodyFileFlag) {
      throw new Error('Provide --body or --body-file with LINE API payload JSON');
    }

    const source = bodyFileFlag ? await readFile(bodyFileFlag, 'utf8') : bodyFlag ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new Error(`Invalid JSON body: ${(error as Error).message}`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('LINE payload must be a JSON object');
    }

    return parsed as Record<string, unknown>;
  }
}
