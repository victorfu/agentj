import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { users, workspaceMembers, workspaces } from '@agentj/contracts';

import { SESSION_COOKIE_NAME, createSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonError, jsonNoStore } from '@/lib/http';
import { hashPassword } from '@/lib/password';
import { buildSessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).max(128),
  workspaceName: z.string().min(1).max(120).optional()
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 400);
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) {
    return jsonError('CONFLICT', 'Email already registered', 409);
  }

  const userId = `usr_${randomUUID()}`;
  const workspaceId = `ws_${randomUUID()}`;
  const memberId = `wm_${randomUUID()}`;
  const passwordHash = await hashPassword(parsed.data.password);

  const userName = parsed.data.name?.trim() || normalizedEmail.split('@')[0] || 'User';
  const workspaceName = parsed.data.workspaceName?.trim() || `${userName}'s workspace`;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        name: userName,
        passwordHash
      });

      await tx.insert(workspaces).values({
        id: workspaceId,
        name: workspaceName,
        createdBy: userId
      });

      await tx.insert(workspaceMembers).values({
        id: memberId,
        workspaceId,
        userId,
        role: 'owner'
      });
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    ) {
      return jsonError('CONFLICT', 'Email already registered', 409);
    }

    console.error('register failed', error);
    return jsonError('INTERNAL_ERROR', 'Failed to register user', 500);
  }

  const issued = await createSession(userId, workspaceId);

  const response = jsonNoStore(
    {
      user: {
        id: userId,
        email: normalizedEmail,
        name: userName
      },
      workspace: {
        id: workspaceId,
        name: workspaceName,
        role: 'owner' as const
      }
    },
    201
  );

  response.cookies.set(SESSION_COOKIE_NAME, issued.token, buildSessionCookieOptions(issued.expiresAt));
  return response;
}
