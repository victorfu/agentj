import type { SessionAuthContext } from './auth';

interface CacheEntry {
  result: SessionAuthContext;
  expiresAt: number;
}

const SESSION_CACHE_TTL_MS = 60_000;
const CLEANUP_INTERVAL = 100;
const MAX_CACHE_SIZE = 10_000;

const cache = new Map<string, CacheEntry>();
const userIndex = new Map<string, Set<string>>();
let lookupCount = 0;

export function getSessionCache(tokenHash: string): SessionAuthContext | null {
  lookupCount += 1;
  if (lookupCount % CLEANUP_INTERVAL === 0) {
    pruneExpired();
  }

  const entry = cache.get(tokenHash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(tokenHash);
    return null;
  }
  return entry.result;
}

export function setSessionCache(tokenHash: string, result: SessionAuthContext): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) deleteEntry(firstKey);
  }
  cache.set(tokenHash, {
    result,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
  let hashes = userIndex.get(result.userId);
  if (!hashes) {
    hashes = new Set();
    userIndex.set(result.userId, hashes);
  }
  hashes.add(tokenHash);
}

export function evictSessionCache(tokenHash: string): void {
  deleteEntry(tokenHash);
}

export function evictByUserId(userId: string): void {
  const hashes = userIndex.get(userId);
  if (!hashes) return;
  for (const h of hashes) cache.delete(h);
  userIndex.delete(userId);
}

function deleteEntry(tokenHash: string): void {
  const entry = cache.get(tokenHash);
  if (entry) {
    const hashes = userIndex.get(entry.result.userId);
    if (hashes) {
      hashes.delete(tokenHash);
      if (hashes.size === 0) userIndex.delete(entry.result.userId);
    }
  }
  cache.delete(tokenHash);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) {
      deleteEntry(key);
    }
  }
}
