import { describe, expect, it } from 'vitest';

import { deriveTunnelOnlineGraceMs, deriveTunnelStatus } from './tunnel-status';

describe('deriveTunnelOnlineGraceMs', () => {
  it('returns override when provided', () => {
    expect(deriveTunnelOnlineGraceMs(30_000, 2, 12_345)).toBe(12_345);
  });

  it('uses ping interval and missed pong budget', () => {
    expect(deriveTunnelOnlineGraceMs(30_000, 2)).toBe(100_000);
  });
});

describe('deriveTunnelStatus', () => {
  const nowMs = Date.now();

  it('keeps stopped status', () => {
    expect(deriveTunnelStatus('stopped', new Date(nowMs), nowMs, 90_000)).toBe('stopped');
  });

  it('returns offline when no heartbeat is present', () => {
    expect(deriveTunnelStatus('online', null, nowMs, 90_000)).toBe('offline');
  });

  it('returns online when heartbeat is fresh', () => {
    expect(deriveTunnelStatus('offline', new Date(nowMs - 5_000), nowMs, 90_000)).toBe('online');
  });

  it('accepts ISO timestamp strings from SQL aggregates', () => {
    expect(deriveTunnelStatus('offline', new Date(nowMs - 5_000).toISOString(), nowMs, 90_000)).toBe(
      'online'
    );
  });

  it('returns offline when heartbeat is stale', () => {
    expect(deriveTunnelStatus('online', new Date(nowMs - 120_000), nowMs, 90_000)).toBe('offline');
  });

  it('returns offline for invalid heartbeat values', () => {
    expect(deriveTunnelStatus('online', 'not-a-date', nowMs, 90_000)).toBe('offline');
  });
});
