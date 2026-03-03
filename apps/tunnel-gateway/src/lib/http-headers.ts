import type { OutgoingHttpHeaders } from 'node:http';

export function toOutgoingHttpHeaders(
  headers: Record<string, string | string[]>
): OutgoingHttpHeaders {
  const output: OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    output[key] = value;
  }
  return output;
}
