import { asc, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { users, workspaceMembers, workspaces } from '@agentj/contracts';

import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { verifyPassword } from '@/lib/password';
import { buildSessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.passwordHash) {
    return jsonError('UNAUTHORIZED', 'Invalid email or password', 401);
  }

  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    return jsonError('UNAUTHORIZED', 'Invalid email or password', 401);
  }

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(asc(workspaceMembers.createdAt), asc(workspaceMembers.id))
    .limit(1);

  if (!membership) {
    return jsonError('FORBIDDEN', 'No workspace membership found', 403);
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, membership.workspaceId) });
  if (!workspace) {
    return jsonError('FORBIDDEN', 'Workspace not found', 403);
  }

  const issued = await createSession(user.id, membership.workspaceId);

  const response = jsonNoStore({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      role: membership.role
    }
  });

  response.cookies.set(SESSION_COOKIE_NAME, issued.token, buildSessionCookieOptions(issued.expiresAt));
  return response;
}
