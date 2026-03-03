import { createDb, createPool } from '@agentj/contracts';

import { getWebEnv } from './env';

const pool = createPool(getWebEnv().DATABASE_URL);

export const db = createDb(pool);
