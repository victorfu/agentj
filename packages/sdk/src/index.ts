import type {
  ConnectTokenResponse,
  CreateTunnelRequest,
  MeResponse,
  PaginatedTunnelRequestLogs,
  Tunnel,
  TunnelRequestLogDetail
} from '@agentj/contracts/api/types';
import { TRACE_HEADER, buildTraceId } from '@agentj/contracts/otel';

type HttpMethod = 'GET' | 'POST' | 'DELETE';

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
