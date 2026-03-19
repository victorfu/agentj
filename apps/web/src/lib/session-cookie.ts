export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  };
}

export function buildExpiredSessionCookieOptions() {
  return buildSessionCookieOptions(new Date(0));
}
