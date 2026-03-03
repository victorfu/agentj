import type {
  ConnectTokenResponse,
  CreateProjectRequest,
  CreateTunnelRequest,
  MeResponse,
  PaginatedTunnelRequestLogs,
  Project,
  Tunnel,
  TunnelRequestLogDetail
} from '@agentj/contracts';
import { TRACE_HEADER, buildTraceId } from '@agentj/contracts';

type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface AgentjSdkOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
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

  async listProjects(): Promise<Project[]> {
    return this.#request('/api/v1/projects', 'GET');
  }

  async createProject(input: CreateProjectRequest): Promise<Project> {
    return this.#request('/api/v1/projects', 'POST', input);
  }

  async listTunnels(projectId: string): Promise<Tunnel[]> {
    return this.#request(`/api/v1/projects/${projectId}/tunnels`, 'GET');
  }

  async createTunnel(projectId: string, input: CreateTunnelRequest): Promise<Tunnel> {
    return this.#request(`/api/v1/projects/${projectId}/tunnels`, 'POST', input);
  }

  async createConnectToken(projectId: string, tunnelId: string): Promise<ConnectTokenResponse> {
    return this.#request(`/api/v1/projects/${projectId}/tunnels/${tunnelId}/connect-token`, 'POST');
  }

  async stopTunnel(projectId: string, tunnelId: string): Promise<void> {
    await this.#request(`/api/v1/projects/${projectId}/tunnels/${tunnelId}`, 'DELETE');
  }

  async listRequestLogs(projectId: string, tunnelId: string, cursor?: string): Promise<PaginatedTunnelRequestLogs> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.#request(`/api/v1/projects/${projectId}/tunnels/${tunnelId}/requests${query}`, 'GET');
  }

  async getRequestLogDetail(
    projectId: string,
    tunnelId: string,
    requestId: string
  ): Promise<TunnelRequestLogDetail> {
    return this.#request(
      `/api/v1/projects/${projectId}/tunnels/${tunnelId}/requests/${requestId}`,
      'GET'
    );
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
