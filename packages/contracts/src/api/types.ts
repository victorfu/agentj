export type TunnelStatus = 'offline' | 'online' | 'stopped';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
}

export interface ApiOrgMembership {
  orgId: string;
  orgName: string;
  role: 'owner' | 'member';
}

export interface MeResponse {
  user: ApiUser;
  memberships: ApiOrgMembership[];
}

export interface Tunnel {
  id: string;
  subdomain: string;
  publicUrl: string;
  status: TunnelStatus;
  targetHost: string;
  targetPort: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTunnelRequest {
  targetHost: string;
  targetPort: number;
}

export interface ConnectTokenResponse {
  connectToken: string;
  expiresInSeconds: number;
  gatewayWebsocketUrl: string;
}

export interface TunnelRequestLog {
  id: string;
  tunnelId: string;
  streamId: string;
  method: string;
  host: string;
  path: string;
  query: string;
  statusCode: number | null;
  latencyMs: number | null;
  startedAt: string;
  endedAt: string | null;
  requestTruncated: boolean;
  responseTruncated: boolean;
}

export interface TunnelRequestLogDetail extends TunnelRequestLog {
  requestHeaders: Record<string, string | string[]>;
  responseHeaders: Record<string, string | string[]>;
  chunks: Array<{
    direction: 'request' | 'response';
    index: number;
    isBinary: boolean;
    contentType: string | null;
    dataText: string | null;
    dataBase64: string | null;
    truncated: boolean;
    createdAt: string;
  }>;
}

export interface PaginatedTunnelRequestLogs {
  items: TunnelRequestLog[];
  nextCursor: string | null;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
