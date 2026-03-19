import type {
  CreateLineChannelRequest,
  ConnectTokenResponse,
  LineApiProxyResponse,
  LineChannel,
  LineWebhookInfoResponse,
  LineWebhookSyncResponse,
  LoginRequest,
  CreateTunnelRequest,
  RegisterRequest,
  MeResponse,
  PaginatedTunnelRequestLogs,
  SessionResponse,
  Tunnel,
  TunnelRequestLogDetail,
  UpdateLineChannelRequest
} from '@agentj/contracts/api/types';
import { TRACE_HEADER, buildTraceId } from '@agentj/contracts/otel';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface AgentjSdkOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface ListRequestLogsQuery {
  cursor?: string;
  after?: string;
}

export class AgentjApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  token?: string;

  constructor(options: AgentjSdkOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, '');
    this.#fetch = options.fetchImpl ?? fetch;
    this.token = options.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async me(): Promise<MeResponse> {
    return this.#request('/api/v1/me', 'GET');
  }

  async register(input: RegisterRequest): Promise<SessionResponse> {
    return this.#request('/api/v1/auth/register', 'POST', input);
  }

  async login(input: LoginRequest): Promise<SessionResponse> {
    return this.#request('/api/v1/auth/login', 'POST', input);
  }

  async logout(): Promise<{ ok: boolean }> {
    return this.#request('/api/v1/auth/logout', 'POST');
  }

  async getSession(): Promise<SessionResponse> {
    return this.#request('/api/v1/auth/session', 'GET');
  }

  async listTunnels(): Promise<Tunnel[]> {
    return this.#request('/api/v1/tunnels', 'GET');
  }

  async createTunnel(input: CreateTunnelRequest): Promise<Tunnel> {
    return this.#request('/api/v1/tunnels', 'POST', input);
  }

  async createConnectToken(tunnelId: string): Promise<ConnectTokenResponse> {
    return this.#request(`/api/v1/tunnels/${tunnelId}/connect-token`, 'POST');
  }

  async stopTunnel(tunnelId: string): Promise<void> {
    await this.#request(`/api/v1/tunnels/${tunnelId}`, 'DELETE');
  }

  async listRequestLogs(
    tunnelId: string,
    query?: string | ListRequestLogsQuery
  ): Promise<PaginatedTunnelRequestLogs> {
    const queryParams =
      typeof query === 'string'
        ? { cursor: query, after: undefined }
        : {
            cursor: query?.cursor,
            after: query?.after
          };

    if (queryParams.cursor && queryParams.after) {
      throw new Error('listRequestLogs accepts either cursor or after, not both');
    }

    const urlParams = new URLSearchParams();
    if (queryParams.cursor) {
      urlParams.set('cursor', queryParams.cursor);
    }
    if (queryParams.after) {
      urlParams.set('after', queryParams.after);
    }

    const suffix = urlParams.size > 0 ? `?${urlParams.toString()}` : '';
    return this.#request(`/api/v1/tunnels/${tunnelId}/requests${suffix}`, 'GET');
  }

  async getRequestLogDetail(tunnelId: string, requestId: string): Promise<TunnelRequestLogDetail> {
    return this.#request(`/api/v1/tunnels/${tunnelId}/requests/${requestId}`, 'GET');
  }

  async listLineChannels(): Promise<LineChannel[]> {
    return this.#request('/api/v1/line/channels', 'GET');
  }

  async createLineChannel(input: CreateLineChannelRequest): Promise<LineChannel> {
    return this.#request('/api/v1/line/channels', 'POST', input);
  }

  async getLineChannel(channelId: string): Promise<LineChannel> {
    return this.#request(`/api/v1/line/channels/${channelId}`, 'GET');
  }

  async updateLineChannel(channelId: string, input: UpdateLineChannelRequest): Promise<LineChannel> {
    return this.#request(`/api/v1/line/channels/${channelId}`, 'PATCH', input);
  }

  async getLineWebhook(channelId: string): Promise<LineWebhookInfoResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/webhook`, 'GET');
  }

  async syncLineWebhook(channelId: string): Promise<LineWebhookSyncResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/webhook/sync`, 'POST');
  }

  async testLineWebhook(channelId: string): Promise<LineApiProxyResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/webhook/test`, 'POST');
  }

  async lineReply(channelId: string, body: Record<string, unknown>): Promise<LineApiProxyResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/messages/reply`, 'POST', body);
  }

  async linePush(channelId: string, body: Record<string, unknown>): Promise<LineApiProxyResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/messages/push`, 'POST', body);
  }

  async lineMulticast(channelId: string, body: Record<string, unknown>): Promise<LineApiProxyResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/messages/multicast`, 'POST', body);
  }

  async lineBroadcast(channelId: string, body: Record<string, unknown>): Promise<LineApiProxyResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/messages/broadcast`, 'POST', body);
  }

  async lineProfile(channelId: string, userId: string): Promise<LineApiProxyResponse> {
    return this.#request(`/api/v1/line/channels/${channelId}/profiles/${encodeURIComponent(userId)}`, 'GET');
  }

  async #request<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      [TRACE_HEADER]: buildTraceId()
    };

    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 204) {
      return undefined as T;
    }

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`API ${method} ${path} failed (${response.status}): ${payload}`);
    }

    return (await response.json()) as T;
  }
}
