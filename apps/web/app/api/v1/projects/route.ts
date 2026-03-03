import { randomUUID } from 'node:crypto';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { orgMemberships, projects } from '@agentj/contracts';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';

const createProjectSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(120)
});

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  const memberships = await db
    .select({ orgId: orgMemberships.orgId })
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, auth.userId));

  if (memberships.length === 0) {
    return jsonNoStore([]);
  }

  const orgIds = memberships.map((membership) => membership.orgId);
  const rows = await db
    .select()
    .from(projects)
    .where(inArray(projects.orgId, orgIds))
    .orderBy(desc(projects.createdAt));

  return jsonNoStore(
    rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      requestLogsEnabled: row.requestLogsEnabled,
      createdAt: row.createdAt.toISOString()
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return jsonError('UNAUTHORIZED', 'Invalid PAT token', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 400);
  }

  const canCreate = await db.query.orgMemberships.findFirst({
    where: and(eq(orgMemberships.userId, auth.userId), eq(orgMemberships.orgId, parsed.data.orgId))
  });

  if (!canCreate) {
    return jsonError('FORBIDDEN', 'No access to organization', 403);
  }

  const [created] = await db
    .insert(projects)
    .values({
      id: `prj_${randomUUID()}`,
      orgId: parsed.data.orgId,
      name: parsed.data.name,
      requestLogsEnabled: true
    })
    .returning();

  if (!created) {
    return jsonError('INTERNAL_ERROR', 'Failed to create project', 500);
  }

  return jsonNoStore(
    {
      id: created.id,
      orgId: created.orgId,
      name: created.name,
      requestLogsEnabled: created.requestLogsEnabled,
      createdAt: created.createdAt.toISOString()
    },
    201
  );
}
