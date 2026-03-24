import { randomUUID } from 'node:crypto';

import { type NextRequest } from 'next/server';

import {
  generatePatToken,
  getPatPrefix,
  hashPatToken,
  patTokens,
  users,
  workspaceMembers,
  workspaces
} from '@agentj/contracts';

import { db } from '@/lib/db';
import { isUniqueViolation } from '@/lib/db-errors';
import { jsonError, jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

const ANONYMOUS_PAT_SCOPES = ['tunnels:write', 'requests:read', 'line:manage'];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return jsonError('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  const userId = `usr_${randomUUID()}`;
  const workspaceId = `ws_${randomUUID()}`;
  const memberId = `wm_${randomUUID()}`;
  const anonEmail = `anon_${randomUUID()}@anonymous.local`;

  for (let i = 0; i < 5; i += 1) {
    const token = generatePatToken();
    const tokenHash = hashPatToken(token);

    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: anonEmail,
          name: 'Anonymous',
          isAnonymous: true
        });

        await tx.insert(workspaces).values({
          id: workspaceId,
          name: 'Anonymous',
          createdBy: userId
        });

        await tx.insert(workspaceMembers).values({
          id: memberId,
          workspaceId,
          userId,
          role: 'owner'
        });

        await tx.insert(patTokens).values({
          id: `pat_${randomUUID()}`,
          userId,
          workspaceId,
          createdByUserId: userId,
          prefix: getPatPrefix(token),
          tokenPlaintext: token,
          tokenHash,
          scopes: ANONYMOUS_PAT_SCOPES
        });
      });

      return jsonNoStore({ token, userId, workspaceId }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }

      console.error('anonymous provisioning failed', error);
      return jsonError('INTERNAL_ERROR', 'Failed to provision anonymous access', 500);
    }
  }

  return jsonError('CONFLICT', 'Unable to provision anonymous access', 409);
}
