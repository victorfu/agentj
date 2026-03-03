import { describe, expect, it } from 'vitest';

import { formatRequestLogCursor, parseRequestLogCursor } from './request-log-cursor.js';

describe('request log cursor', () => {
  it('round trips cursor values', () => {
    const startedAt = new Date('2026-03-03T12:00:00.000Z');
    const encoded = formatRequestLogCursor({
      startedAt,
      requestId: 'req_123'
    });

    const decoded = parseRequestLogCursor(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(decoded?.requestId).toBe('req_123');
  });

  it('rejects malformed cursor strings', () => {
    expect(parseRequestLogCursor('not-a-number:req_1')).toBeNull();
    expect(parseRequestLogCursor('')).toBeNull();
  });
});
