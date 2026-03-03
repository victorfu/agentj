import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { hashPatToken, orgMemberships, orgs, patTokens, users } from '@agentj/contracts';

import { db } from './db';

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  memberships: Array<{
    orgId: string;
    orgName: string;
    role: 'owner' | 'member';
  }>;
}

export async function requireAuth(request: NextRequest): Promise<AuthContext | null> {
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

  const memberships = await db
    .select({
      orgId: orgMemberships.orgId,
      orgName: orgs.name,
      role: orgMemberships.role
    })
    .from(orgMemberships)
    .innerJoin(orgs, eq(orgMemberships.orgId, orgs.id))
    .where(eq(orgMemberships.userId, user.id));

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    memberships
  };
}
