import { randomUUID } from 'node:crypto';

export const TRACE_HEADER = 'x-request-id';

export function buildTraceId(): string {
  return randomUUID();
}
