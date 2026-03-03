import { createDb, createPool, type AgentjDb } from '@agentj/contracts';

let cachedDb: AgentjDb | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return databaseUrl;
}

function getDb(): AgentjDb {
  if (cachedDb) {
    return cachedDb;
  }

  const pool = createPool(getDatabaseUrl());
  cachedDb = createDb(pool);
  return cachedDb;
}

// Lazily create DB client so Next.js build-time imports don't fail on missing runtime env.
export const db: AgentjDb = new Proxy({} as AgentjDb, {
  get(_target, prop, receiver) {
    const instance = getDb() as object;
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});
