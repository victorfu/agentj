export type TunnelStatus = 'offline' | 'online' | 'stopped';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type LineWebhookMode = 'relay' | 'managed';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
}

export interface MeResponse {
  user: ApiUser;
}

export interface SessionWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface SessionResponse {
  user: ApiUser;
  workspace: SessionWorkspace;
}

export interface RegisterRequest {
  email: string;
  name?: string;
  password: string;
  workspaceName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AnonymousProvisionResponse {
  token: string;
  userId: string;
  workspaceId: string;
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

export interface LineChannel {
  id: string;
  workspaceId: string;
  tunnelId: string;
  name: string;
  lineChannelId: string;
  mode: LineWebhookMode;
  webhookPath: string;
  webhookActive: boolean;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLineChannelRequest {
  name: string;
  tunnelId: string;
  lineChannelId: string;
  channelSecret: string;
  channelAccessToken: string;
  mode?: LineWebhookMode;
}

export interface UpdateLineChannelRequest {
  name?: string;
  channelSecret?: string;
  channelAccessToken?: string;
  mode?: LineWebhookMode;
}

export interface LineWebhookInfoResponse {
  channelId: string;
  expectedWebhookUrl: string;
  webhookActive: boolean;
  lineStatus: number;
  lineResult: Record<string, unknown> | null;
  lineRequestId: string | null;
}

export interface LineWebhookSyncResponse {
  channelId: string;
  endpoint: string;
  webhookActive: boolean;
  lineRequestId: string | null;
}

export interface LineApiProxyResponse {
  ok: boolean;
  lineRequestId: string | null;
  lineAcceptedRequestId?: string | null;
  result: Record<string, unknown> | null;
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
