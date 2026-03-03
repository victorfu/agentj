import { NextResponse, type NextRequest } from 'next/server';

const TRACE_HEADER = 'x-request-id';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const traceId = requestHeaders.get(TRACE_HEADER) ?? crypto.randomUUID();
  requestHeaders.set(TRACE_HEADER, traceId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set(TRACE_HEADER, traceId);
  return response;
}

export const config = {
  matcher: ['/api/:path*']
};
