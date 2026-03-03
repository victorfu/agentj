import { createHash, randomBytes } from 'node:crypto';

export function hashPatToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getPatPrefix(token: string): string {
  return token.slice(0, 12);
}

export function generatePatToken(): string {
  const random = randomBytes(24).toString('base64url');
  return `agentj_pat_${random}`;
}
