import { z } from 'zod';

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

const headerValueSchema = z.union([z.string(), z.array(z.string())]);
const headersSchema = z.record(z.string(), headerValueSchema);

const agentHelloMessageSchema = z.object({
  type: z.literal('agent_hello'),
  agentInstanceId: z.string(),
  tunnelId: z.string()
});

const agentReadyMessageSchema = z.object({
  type: z.literal('agent_ready'),
  tunnelId: z.string()
});

const pingMessageSchema = z.object({
  type: z.literal('ping'),
  ts: z.number()
});

const pongMessageSchema = z.object({
  type: z.literal('pong'),
  ts: z.number()
});

const ingressRequestStartMessageSchema = z.object({
  type: z.literal('ingress_request_start'),
  streamId: z.string(),
  protocol: z.enum(['http', 'ws']),
  method: z.string(),
  path: z.string(),
  query: z.string(),
  headers: headersSchema
});

const ingressRequestChunkMessageSchema = z.object({
  type: z.literal('ingress_request_chunk'),
  streamId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  isBinary: z.boolean(),
  dataText: z.string().optional(),
  dataBase64: z.string().optional()
});

const ingressRequestEndMessageSchema = z.object({
  type: z.literal('ingress_request_end'),
  streamId: z.string()
});

const agentResponseStartMessageSchema = z.object({
  type: z.literal('agent_response_start'),
  streamId: z.string(),
  statusCode: z.number().int(),
  headers: headersSchema
});

const agentResponseChunkMessageSchema = z.object({
  type: z.literal('agent_response_chunk'),
  streamId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  isBinary: z.boolean(),
  dataText: z.string().optional(),
  dataBase64: z.string().optional()
});

const agentResponseEndMessageSchema = z.object({
  type: z.literal('agent_response_end'),
  streamId: z.string()
});

const streamErrorMessageSchema = z.object({
  type: z.literal('stream_error'),
  streamId: z.string(),
  message: z.string()
});

export const gatewayMessageSchema = z.discriminatedUnion('type', [
  agentHelloMessageSchema,
  agentReadyMessageSchema,
  pingMessageSchema,
  pongMessageSchema,
  ingressRequestStartMessageSchema,
  ingressRequestChunkMessageSchema,
  ingressRequestEndMessageSchema,
  agentResponseStartMessageSchema,
  agentResponseChunkMessageSchema,
  agentResponseEndMessageSchema,
  streamErrorMessageSchema
]);

export function parseGatewayMessage(value: string): GatewayMessage {
  const raw = JSON.parse(value) as unknown;
  return gatewayMessageSchema.parse(raw);
}

export function serializeGatewayMessage(message: GatewayMessage): string {
  return JSON.stringify(message);
}
