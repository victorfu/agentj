import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  await db.execute(sql`select 1`);
  return jsonNoStore({ ok: true });
}
