export interface TunnelHostContext {
  hostHeader: string;
  parsedHost: string;
  expectedBaseDomain: string;
  expectedSuffix: string;
}

export interface TunnelNotFoundClosePayload {
  code: 4404;
  reason: string;
}

export const TUNNEL_NOT_FOUND_CLOSE_REASON = 'Tunnel ID not found in gateway DB';

export function parseHostHeader(hostHeader: string | string[] | undefined): string {
  const raw = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return (raw ?? '').split(':')[0] ?? '';
}

export function resolveTunnelSubdomain(
  parsedHost: string,
  baseDomain: string
): string | null {
  const suffix = `.${baseDomain}`;
  if (!parsedHost.endsWith(suffix)) {
    return null;
  }

  const subdomain = parsedHost.slice(0, -suffix.length);
  if (!subdomain) {
    return null;
  }

  return subdomain;
}

export function buildTunnelHostContext(
  hostHeader: string | string[] | undefined,
  baseDomain: string
): TunnelHostContext {
  const raw = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return {
    hostHeader: raw ?? '',
    parsedHost: parseHostHeader(hostHeader),
    expectedBaseDomain: baseDomain,
    expectedSuffix: `.${baseDomain}`
  };
}

export function unknownTunnelClosePayload(found: boolean): TunnelNotFoundClosePayload | null {
  if (found) {
    return null;
  }

  return {
    code: 4404,
    reason: TUNNEL_NOT_FOUND_CLOSE_REASON
  };
}
