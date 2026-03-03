import { openApiDocument } from '@agentj/contracts';

import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonNoStore(openApiDocument);
}
