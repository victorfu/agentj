import type { TunnelStatus } from '@agentj/contracts';

const HEARTBEAT_JITTER_GRACE_MS = 10_000;
type HeartbeatTimestamp = Date | string | number;

export function deriveTunnelOnlineGraceMs(
  pingIntervalMs: number,
  maxMissedPongs: number,
  overrideMs?: number
): number {
  if (overrideMs && overrideMs > 0) {
    return overrideMs;
  }

  return pingIntervalMs * (maxMissedPongs + 1) + HEARTBEAT_JITTER_GRACE_MS;
}

export function deriveTunnelStatus(
  persistedStatus: TunnelStatus,
  lastHeartbeatAt: HeartbeatTimestamp | null,
  nowMs: number,
  onlineGraceMs: number
): TunnelStatus {
  if (persistedStatus === 'stopped') {
    return 'stopped';
  }

  if (!lastHeartbeatAt) {
    return 'offline';
  }

  const lastHeartbeatMs = toEpochMs(lastHeartbeatAt);
  if (lastHeartbeatMs === null) {
    return 'offline';
  }

  return nowMs - lastHeartbeatMs <= onlineGraceMs ? 'online' : 'offline';
}

function toEpochMs(value: HeartbeatTimestamp): number | null {
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? ts : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
