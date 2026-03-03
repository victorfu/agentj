import { and, eq } from 'drizzle-orm';

import { orgMemberships, projects } from '@agentj/contracts';

import { db } from './db';

export async function hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) {
    return false;
  }

  const membership = await db.query.orgMemberships.findFirst({
    where: and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, project.orgId))
  });

  return Boolean(membership);
}
