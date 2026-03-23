import type { WebhookEvent } from '@line/bot-sdk';
import type { messagingApi } from '@line/bot-sdk';

export async function handleEvent(
  client: messagingApi.MessagingApiClient,
  event: WebhookEvent,
): Promise<void> {
  console.log('[webhook] event received:', JSON.stringify(event, null, 2));

  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log('[webhook] skipping non-text event:', event.type);
    return;
  }

  console.log('[webhook] echoing message:', event.message.text);
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: event.message.text }],
  });
}
