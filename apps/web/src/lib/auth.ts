import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { hashPatToken, patTokens, sessions, users, workspaceMembers } from '@agentj/contracts';

import { db } from './db';
import { getWebEnv } from './env';

export const SESSION_COOKIE_NAME = 'agentj_session';

export interface PatAuthContext {
  userId: string;
  workspaceId: string;
  patTokenId: string;
  scopes: string[];
  email: string;
  name: string;
}

export interface SessionAuthContext {
  sessionId: string;
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
  name: string;
}

export interface SessionIssueResult {
  sessionId: string;
  token: string;
  expiresAt: Date;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function issueSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string, workspaceId: string): Promise<SessionIssueResult> {
  const token = issueSessionToken();
  const tokenHash = hashSessionToken(token);
  const env = getWebEnv();
  const expiresAt = new Date(Date.now() + env.AGENTJ_AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const sessionId = `ses_${randomUUID()}`;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    workspaceId,
    sessionTokenHash: tokenHash,
    expiresAt
  });

  return {
    sessionId,
    token,
    expiresAt
  };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.sessionTokenHash, tokenHash), isNull(sessions.revokedAt)));
}

export async function requireSessionAuth(request: NextRequest): Promise<SessionAuthContext | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.sessionTokenHash, tokenHash),
      isNull(sessions.revokedAt),
      sql`${sessions.expiresAt} > now()`
    )
  });
  if (!session) {
    return null;
  }

  const [user, member] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, session.workspaceId), eq(workspaceMembers.userId, session.userId))
    })
  ]);

  if (!user || !member) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: user.id,
    workspaceId: session.workspaceId,
    role: member.role,
    email: user.email,
    name: user.name
  };
}

export async function requirePatAuth(request: NextRequest): Promise<PatAuthContext | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  const tokenHash = hashPatToken(token);

  const tokenRecord = await db.query.patTokens.findFirst({
    where: and(
      eq(patTokens.tokenHash, tokenHash),
      isNull(patTokens.revokedAt),
      or(isNull(patTokens.expiresAt), sql`${patTokens.expiresAt} > now()`)
    )
  });

  if (!tokenRecord) {
    return null;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, tokenRecord.userId) });
  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    workspaceId: tokenRecord.workspaceId,
    patTokenId: tokenRecord.id,
    scopes: tokenRecord.scopes,
    email: user.email,
    name: user.name
  };
}

export async function requireAuth(request: NextRequest): Promise<PatAuthContext | null> {
  return requirePatAuth(request);
}
