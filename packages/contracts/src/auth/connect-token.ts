import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ConnectTokenPayload {
  userId: string;
  tunnelId: string;
  exp: number;
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromB64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

export function createConnectToken(payload: ConnectTokenPayload, secret: string): string {
  const encoded = b64url(JSON.stringify(payload));
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyConnectToken(token: string, secret: string): ConnectTokenPayload {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw new Error('Malformed connect token');
  }

  const expected = sign(encoded, secret);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid connect token signature');
  }

  const payload = JSON.parse(fromB64url(encoded)) as ConnectTokenPayload;
  if (payload.exp * 1000 < Date.now()) {
    throw new Error('Connect token expired');
  }

  return payload;
}
