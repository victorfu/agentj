import { randomUUID } from 'node:crypto';

import { lineApiCalls } from '@agentj/contracts';

import { db } from './db';
import { getWebEnv } from './env';

export interface LineApiCallOptions {
  lineChannelId: string;
  channelAccessToken: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  retryKey?: string;
}

export interface LineApiCallResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  rawText: string;
  lineRequestId: string | null;
  lineAcceptedRequestId: string | null;
}

export function tunnelPublicUrl(subdomain: string): string {
  const env = getWebEnv();
  const defaultPort = env.AGENTJ_TUNNEL_PUBLIC_SCHEME === 'https' ? 443 : 80;
  const portSuffix =
    env.AGENTJ_TUNNEL_PUBLIC_PORT === defaultPort ? '' : `:${env.AGENTJ_TUNNEL_PUBLIC_PORT}`;
  return `${env.AGENTJ_TUNNEL_PUBLIC_SCHEME}://${subdomain}.${env.AGENTJ_TUNNEL_BASE_DOMAIN}${portSuffix}`;
}

export function lineWebhookUrl(subdomain: string): string {
  return `${tunnelPublicUrl(subdomain)}/line/webhook`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function callLineApi(options: LineApiCallOptions): Promise<LineApiCallResult> {
  const env = getWebEnv();
  const url = `${env.AGENTJ_LINE_MESSAGING_API_BASE_URL}${options.endpoint}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${options.channelAccessToken}`
  };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  if (options.retryKey) {
    headers['x-line-retry-key'] = options.retryKey;
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = { rawText };
    }
  }

  const lineRequestId = response.headers.get('x-line-request-id');
  const lineAcceptedRequestId = response.headers.get('x-line-accepted-request-id');

  await db.insert(lineApiCalls).values({
    id: `lac_${randomUUID()}`,
    lineChannelId: options.lineChannelId,
    endpoint: options.endpoint,
    method: options.method,
    statusCode: response.status,
    lineRequestId,
    lineAcceptedRequestId,
    retryKey: options.retryKey ?? null,
    requestBody: toRecord(options.body),
    responseBody: response.ok ? toRecord(parsed) : null,
    errorBody: response.ok ? null : toRecord(parsed)
  });

  return {
    ok: response.ok,
    status: response.status,
    data: toRecord(parsed),
    rawText,
    lineRequestId,
    lineAcceptedRequestId
  };
}
