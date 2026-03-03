export type GatewayMessage =
  | AgentHelloMessage
  | AgentReadyMessage
  | PingMessage
  | PongMessage
  | IngressRequestStartMessage
  | IngressRequestChunkMessage
  | IngressRequestEndMessage
  | AgentResponseStartMessage
  | AgentResponseChunkMessage
  | AgentResponseEndMessage
  | StreamErrorMessage;

export interface AgentHelloMessage {
  type: 'agent_hello';
  agentInstanceId: string;
  tunnelId: string;
}

export interface AgentReadyMessage {
  type: 'agent_ready';
  tunnelId: string;
}

export interface PingMessage {
  type: 'ping';
  ts: number;
}

export interface PongMessage {
  type: 'pong';
  ts: number;
}

export interface IngressRequestStartMessage {
  type: 'ingress_request_start';
  streamId: string;
  protocol: 'http' | 'ws';
  method: string;
  path: string;
  query: string;
  headers: Record<string, string | string[]>;
}

export interface IngressRequestChunkMessage {
  type: 'ingress_request_chunk';
  streamId: string;
  chunkIndex: number;
  isBinary: boolean;
  dataText?: string;
  dataBase64?: string;
}

export interface IngressRequestEndMessage {
  type: 'ingress_request_end';
  streamId: string;
}

export interface AgentResponseStartMessage {
  type: 'agent_response_start';
  streamId: string;
  statusCode: number;
  headers: Record<string, string | string[]>;
}

export interface AgentResponseChunkMessage {
  type: 'agent_response_chunk';
  streamId: string;
  chunkIndex: number;
  isBinary: boolean;
  dataText?: string;
  dataBase64?: string;
}

export interface AgentResponseEndMessage {
  type: 'agent_response_end';
  streamId: string;
}

export interface StreamErrorMessage {
  type: 'stream_error';
  streamId: string;
  message: string;
}

export function parseGatewayMessage(value: string): GatewayMessage {
  return JSON.parse(value) as GatewayMessage;
}

export function serializeGatewayMessage(message: GatewayMessage): string {
  return JSON.stringify(message);
}
