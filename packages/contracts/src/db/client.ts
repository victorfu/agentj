import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function createDb(pool: Pool) {
  return drizzle(pool, { schema });
}

export type AgentjDb = ReturnType<typeof createDb>;
