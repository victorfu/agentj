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
  const normalized = (raw ?? '').trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('[')) {
    const closingBracket = normalized.indexOf(']');
    if (closingBracket === -1) {
      return normalized;
    }

    return normalized.slice(0, closingBracket + 1);
  }

  const firstColon = normalized.indexOf(':');
  if (firstColon === -1) {
    return normalized;
  }

  const lastColon = normalized.lastIndexOf(':');
  if (firstColon !== lastColon) {
    return normalized;
  }

  return normalized.slice(0, firstColon);
}

export function resolveTunnelSubdomain(
  parsedHost: string,
  baseDomain: string
): string | null {
  const normalizedHost = parsedHost.trim().toLowerCase();
  const normalizedBaseDomain = baseDomain.trim().toLowerCase();
  const suffix = `.${normalizedBaseDomain}`;
  if (!normalizedHost.endsWith(suffix)) {
    return null;
  }

  const subdomain = normalizedHost.slice(0, -suffix.length);
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
  const normalizedBaseDomain = baseDomain.trim().toLowerCase();
  return {
    hostHeader: raw ?? '',
    parsedHost: parseHostHeader(hostHeader),
    expectedBaseDomain: normalizedBaseDomain,
    expectedSuffix: `.${normalizedBaseDomain}`
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
