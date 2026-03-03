export interface RequestLogCursor {
  startedAt: Date;
  requestId: string | null;
}

export function parseRequestLogCursor(raw: string): RequestLogCursor | null {
  const [timestampPart, requestIdPart] = raw.split(':');
  if (!timestampPart) {
    return null;
  }

  const cursorMs = Number(timestampPart);
  if (!Number.isFinite(cursorMs)) {
    return null;
  }

  const startedAt = new Date(cursorMs);
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  return {
    startedAt,
    requestId: requestIdPart && requestIdPart.length > 0 ? requestIdPart : null
  };
}

export function formatRequestLogCursor(cursor: { startedAt: Date; requestId: string }): string {
  return `${cursor.startedAt.getTime()}:${cursor.requestId}`;
}
