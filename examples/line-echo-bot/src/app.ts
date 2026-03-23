import express from 'express';
import { middleware, messagingApi } from '@line/bot-sdk';

import type { Config } from './config.js';
import { handleEvent } from './handlers/webhook.js';

export function createApp(config: Config) {
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.lineChannelAccessToken,
  });

  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post(
    '/line/webhook',
    middleware({ channelSecret: config.lineChannelSecret }),
    (req, res) => {
      Promise.all(
        req.body.events.map((event: Parameters<typeof handleEvent>[1]) =>
          handleEvent(client, event),
        ),
      )
        .then(() => res.json({ ok: true }))
        .catch((err: unknown) => {
          console.error('Webhook handling error:', err);
          res.status(500).end();
        });
    },
  );

  return app;
}
