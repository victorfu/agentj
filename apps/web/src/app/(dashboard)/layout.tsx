import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { sessions } from '@agentj/contracts';

import { SESSION_COOKIE_NAME, hashSessionToken } from '@/lib/auth';
import { db } from '@/lib/db';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect('/login');
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
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgba(6,198,86,0.07)_0%,transparent_60%),radial-gradient(ellipse_60%_50%_at_90%_100%,rgba(6,198,86,0.05)_0%,transparent_60%)]">
      {children}
    </div>
  );
}
