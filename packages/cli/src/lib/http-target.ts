export interface LocalHttpTarget {
  host: string;
  port: number;
}

const HTTP_PROTOCOL = /^https?:\/\//i;

export function resolveLocalHttpTarget(input: string, defaultHost: string): LocalHttpTarget {
  const target = input.trim();
  if (!target) {
    throw new Error('Target is required. Use a local port (e.g. 3000) or host:port.');
  }

  if (/^\d+$/.test(target)) {
    return {
      host: defaultHost,
      port: parsePort(target)
    };
  }

  if (HTTP_PROTOCOL.test(target)) {
    const url = new URL(target);
    const portFromUrl = url.port ? parsePort(url.port) : url.protocol === 'https:' ? 443 : 80;
    return {
      host: url.hostname,
      port: portFromUrl
    };
  }

  const separator = target.lastIndexOf(':');
  if (separator > 0 && separator < target.length - 1) {
    const host = target.slice(0, separator).trim();
    const port = parsePort(target.slice(separator + 1));
    if (!host) {
      throw new Error(`Invalid target "${input}". Host cannot be empty.`);
    }

    return { host, port };
  }

  throw new Error(
    `Invalid target "${input}". Use a local port (3000), host:port (localhost:3000), or URL (http://localhost:3000).`
  );
}

function parsePort(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid port "${raw}". Port must be between 1 and 65535.`);
  }

  const port = Number(trimmed);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid port "${raw}". Port must be between 1 and 65535.`);
  }
  return port;
}
